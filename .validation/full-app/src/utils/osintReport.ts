import type { OsintResult } from '../types/osint';

export interface OsintModuleDefinition {
    module: string;
    title: string;
    icon: string;
}

export interface OsintModuleState {
    result: OsintResult | null;
    loading: boolean;
    error: string | null;
}

export interface OsintReportRow {
    label: string;
    value: string;
}

export interface OsintValidation {
    isConsistent: boolean;
    missingFields: string[];
    message: string | null;
}

export interface OsintReportEntry {
    module: string;
    title: string;
    icon: string;
    loading: boolean;
    error: string | null;
    risk: string;
    summaryRows: OsintReportRow[];
    sourceRows: OsintReportRow[];
    metricRows: OsintReportRow[];
    rawFindings: string;
    validation: OsintValidation;
}

export interface OsintConsistencyReport {
    loadedCount: number;
    totalCount: number;
    loadingModules: string[];
    errorModules: string[];
    inconsistentModules: string[];
}

export const WEB_CHECK_OSINT_MODULES: OsintModuleDefinition[] = [
    { module: 'asset-radar', title: 'AssetRadar', icon: '📡' },
    { module: 'alias-finder', title: 'AliasFinder', icon: '🕵️' },
    { module: 'geo-spy', title: 'GeoSpy', icon: '🌍' }
];

function isRecord(value: unknown): value is Record<string, any> {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}

function toLabel(key: string) {
    return key
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (match) => match.toUpperCase());
}

function formatValue(value: unknown, maxLen = 160) {
    if (value == null || value === '') return 'Not Available';

    let text = '';
    if (Array.isArray(value)) {
        if (value.length === 0) return 'None';
        if (value.every((item) => ['string', 'number', 'boolean'].includes(typeof item))) {
            text = value.map((item) => String(item)).join(', ');
        } else {
            text = `${value.length} items`;
        }
    } else if (typeof value === 'object') {
        text = `${Object.keys(value as Record<string, unknown>).length} fields`;
    } else {
        text = String(value);
    }

    return text.length > maxLen ? `${text.slice(0, maxLen - 3)}...` : text;
}

function findTarget(data: Record<string, any>) {
    return formatValue(data.target || data.domain || data.url || data.username || data.email);
}

// Every distinct source that contributed to this module's result: an explicit
// `sources` array, a single `source`, the `provider`, and the per-result
// `platform` values — de-duplicated, because the same name usually appears in
// more than one of those places.
function findSources(data: Record<string, any>): string[] {
    const sources = new Set<string>();

    if (Array.isArray(data.sources)) {
        data.sources.forEach((source) => {
            if (typeof source === 'string' && source.trim()) sources.add(source.trim());
        });
    }
    if (typeof data.source === 'string' && data.source.trim()) sources.add(data.source.trim());
    if (typeof data.provider === 'string' && data.provider.trim()) sources.add(data.provider.trim());
    if (Array.isArray(data.results)) {
        data.results.forEach((item) => {
            if (typeof item?.platform === 'string' && item.platform.trim()) sources.add(item.platform.trim());
        });
    }

    return Array.from(sources);
}

function extractSourceRows(data: Record<string, any>): OsintReportRow[] {
    const rows: OsintReportRow[] = [];
    if (typeof data.provider === 'string' && data.provider.trim()) {
        rows.push({ label: 'Provider', value: data.provider.trim() });
    }
    // Restored: commit 6ee442a deleted this row and findSources as "unused
    // code". It was not unused — this test asserts it and the OSINT report
    // renders it, so the report quietly stopped showing which sources a
    // finding came from. Provenance is the point of the report.
    const sources = findSources(data);
    if (sources.length) {
        rows.push({ label: 'Sources', value: formatValue(sources, 220) });
    }
    if (typeof data.note === 'string' && data.note.trim()) {
        rows.push({ label: 'Note', value: formatValue(data.note, 220) });
    }
    return rows;
}

function extractMetricRows(data: Record<string, any>): OsintReportRow[] {
    const preferredKeys = [
        'risk_score',
        'score',
        'confidence',
        'total_exposures',
        'latest_exposure',
        'matches',
        'count',
        'severity',
        'exposed_data_types'
    ];

    const rows: OsintReportRow[] = [];
    for (const key of preferredKeys) {
        if (!(key in data)) continue;
        rows.push({ label: toLabel(key), value: formatValue(data[key], 220) });
        if (rows.length >= 6) return rows;
    }

    Object.entries(data).forEach(([key, value]) => {
        if (rows.length >= 6) return;
        if (preferredKeys.includes(key)) return;
        if (['target', 'domain', 'url', 'username', 'email', 'results', 'findings', 'sources', 'source', 'provider', 'note'].includes(key)) return;
        if (['string', 'number', 'boolean'].includes(typeof value)) {
            rows.push({ label: toLabel(key), value: formatValue(value, 220) });
        }
    });

    return rows;
}

function toRawFindings(data: unknown) {
    try {
        return JSON.stringify(data ?? {}, null, 2);
    } catch {
        return 'Raw findings unavailable.';
    }
}

function validateEntry(module: string, result: OsintResult | null, error: string | null): OsintValidation {
    const missingFields: string[] = [];
    if (error) missingFields.push('fetch');
    if (!result) missingFields.push('result');
    if (result && !result.module) missingFields.push('module');
    if (result && (result.risk == null || result.risk === '')) missingFields.push('risk');
    if (result && !isRecord(result.data)) missingFields.push('data');

    return {
        isConsistent: missingFields.length === 0,
        missingFields,
        message: missingFields.length ? `${module} is missing: ${missingFields.join(', ')}` : null
    };
}

export function buildOsintEntries(
    modules: OsintModuleDefinition[],
    state: Record<string, OsintModuleState | undefined>
): OsintReportEntry[] {
    return modules.map((definition) => {
        const current = state[definition.module] ?? { result: null, loading: false, error: null };
        const result = current.result;
        const payload = isRecord(result?.data) ? result.data : {};
        const sources = extractSourceRows(payload);
        const metrics = extractMetricRows(payload);
        const validation = validateEntry(definition.title, result, current.error);

        return {
            module: definition.module,
            title: definition.title,
            icon: definition.icon,
            loading: current.loading,
            error: current.error,
            risk: result?.risk ? String(result.risk) : 'Unknown',
            summaryRows: [
                { label: 'Target', value: findTarget(payload) }
            ],
            sourceRows: sources,
            metricRows: metrics,
            rawFindings: toRawFindings(result?.data ?? {}),
            validation
        };
    });
}

export function buildOsintStateFromStoredResults(storedResults: any[]): Record<string, OsintModuleState> {
    const state: Record<string, OsintModuleState> = {};
    WEB_CHECK_OSINT_MODULES.forEach((definition) => {
        const matching = Array.isArray(storedResults)
            ? storedResults.find((row) => row?.module === definition.module)
            : null;

        let payload = matching?.result_json ?? null;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch {
                payload = null;
            }
        }

        state[definition.module] = {
            loading: false,
            error: null,
            result: payload && typeof payload === 'object'
                ? {
                    module: payload.module || matching?.module || definition.module,
                    risk: payload.risk || matching?.risk_level || 'Unknown',
                    data: payload.data && typeof payload.data === 'object' ? payload.data : {}
                }
                : null
        };
    });

    return state;
}

export function validateOsintEntries(entries: OsintReportEntry[]): OsintConsistencyReport {
    const loadingModules = entries.filter((entry) => entry.loading).map((entry) => entry.title);
    const errorModules = entries.filter((entry) => !!entry.error).map((entry) => entry.title);
    const inconsistentModules = entries
        .filter((entry) => !entry.loading && !entry.error && !entry.validation.isConsistent)
        .map((entry) => entry.title);

    return {
        loadedCount: entries.filter((entry) => !entry.loading && !entry.error && entry.validation.isConsistent).length,
        totalCount: entries.length,
        loadingModules,
        errorModules,
        inconsistentModules
    };
}
