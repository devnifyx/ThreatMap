import type { GeographicPoint, InvestigationPoint, NormalizedSeverity, NormalizedThreatEvent, ScanOverlayPoint } from './types';

export function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalText(value: unknown): string | undefined {
    return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function toFiniteNumber(value: unknown): number | null {
    if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

export function normalizeSeverity(value: unknown): NormalizedSeverity | null {
    const severity = optionalText(value)?.toLowerCase();
    return severity === 'low' || severity === 'medium' || severity === 'high' || severity === 'critical' ? severity : null;
}

export function normalizeThreatType(value: unknown): string | null {
    return optionalText(value) ?? null;
}

export function normalizeTimestamp(value: unknown): string | null {
    const text = optionalText(value);
    // The existing socket uses ISO timestamps. Require a timezone rather than
    // interpreting an ambiguous backend time in the browser's local timezone.
    if (!text || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})$/i.test(text)) return null;
    const [year, month, day] = text.slice(0, 10).split('-').map(Number);
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) return null;
    const time = Date.parse(text);
    return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export function normalizeGeographicPoint(value: unknown): GeographicPoint | null {
    if (!isRecord(value)) return null;
    const latitude = toFiniteNumber(value.latitude ?? value.lat);
    const longitude = toFiniteNumber(value.longitude ?? value.lng);
    if (latitude === null || longitude === null || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
    const code = optionalText(value.countryCode)?.toUpperCase();
    return {
        latitude, longitude,
        country: optionalText(value.country),
        countryCode: code && /^[A-Z]{2}$/.test(code) ? code : undefined,
        region: optionalText(value.region),
        city: optionalText(value.city),
    };
}

export function normalizeThreatEvent(raw: unknown): NormalizedThreatEvent | null {
    if (!isRecord(raw)) return null;
    const id = optionalText(raw.id);
    const type = normalizeThreatType(raw.type);
    const severity = normalizeSeverity(raw.severity);
    const timestamp = normalizeTimestamp(raw.timestamp);
    const source = normalizeGeographicPoint(raw.source);
    if (!id || !type || !severity || !timestamp || !source) return null;
    return {
        id, type, severity, timestamp, source,
        destination: normalizeGeographicPoint(raw.destination) ?? undefined,
        // These optional fields are retained only if actually present; the
        // current socket does not supply them and no ID is decoded as an IOC.
        ioc: optionalText(raw.ioc),
        identifier: optionalText(raw.identifier),
        metadata: isRecord(raw.metadata) ? { ...raw.metadata } : undefined,
    };
}

export function normalizeThreatEvents(raw: readonly unknown[]): NormalizedThreatEvent[] {
    return raw.map(normalizeThreatEvent).filter((event): event is NormalizedThreatEvent => event !== null);
}

export function mergeThreatEvents(existing: readonly NormalizedThreatEvent[], incoming: readonly NormalizedThreatEvent[]): NormalizedThreatEvent[] {
    const merged = new Map(existing.map(event => [event.id, event]));
    for (const event of incoming) merged.set(event.id, event);
    return [...merged.values()].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp) || a.id.localeCompare(b.id));
}

export function normalizeInvestigations(points: ScanOverlayPoint[]): InvestigationPoint[] {
    return points.flatMap(point => {
        const geographic = normalizeGeographicPoint(point);
        return geographic && point.id ? [{ ...geographic, id: point.id, target: point.target, kind: point.kind }] : [];
    });
}
