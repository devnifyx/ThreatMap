import React, { useCallback, useEffect, useState } from 'react';
import { timeAgo } from '../../../utils/timeAgo';
import {
    startTelegramExtraction, getTelegramExtractionJob, cancelTelegramExtractionJob,
    getTelegramEntities, getTelegramEntityOccurrences, getTelegramIntelStats,
    type TelegramEntitySummary, type TelegramEntityType, type TelegramExtractionJob,
    type TelegramIntelStats, type TelegramMessageEntity, type TelegramSource
} from '../../../services/api';

// TELEGRAM_INTELLIGENCE_PHASE2.md §33/§34/§35 — the Message Intelligence view.
//
// §3 — analysis runs over messages ALREADY collected by Phase 1; nothing here
// re-crawls Telegram. §42 — the button only ENQUEUES a job and then polls it.
//
// §24-§31 — extracted entities carry cross-module actions that navigate to the
// EXISTING intelligence modules with the target pre-filled. §24 is explicit:
// "Do NOT automatically launch a scan without analyst confirmation", so these
// only navigate — the analyst still presses Analyze on the destination module.
//
// §4/§6/§34 — nothing here labels anything malicious. Confidence is shown with
// the reason the backend recorded, and the §15-18 types show their MENTION
// claim rather than an activity or attribution claim.

const ACTIVE = ['queued', 'running'];

// §19 — display order groups indicators first, then context, then the
// conservative known-entity mentions.
const TYPE_ORDER: TelegramEntityType[] = [
    'URL', 'Domain', 'IPv4', 'IPv6', 'Email', 'Phone', 'Username',
    'MD5', 'SHA1', 'SHA256', 'Crypto', 'CVE', 'Hashtag', 'Mention',
    'Malware', 'ThreatActor', 'Company', 'Brand'
];

const TYPE_LABEL: Record<string, string> = {
    URL: 'URLs', Domain: 'Domains', IPv4: 'IPv4', IPv6: 'IPv6', Email: 'Emails',
    Phone: 'Phones', Username: 'Usernames', Hashtag: 'Hashtags', Mention: 'Mentions',
    Crypto: 'Crypto Addresses', MD5: 'MD5', SHA1: 'SHA1', SHA256: 'SHA256', CVE: 'CVEs',
    Malware: 'Malware Mentions', ThreatActor: 'Threat Actor Mentions',
    Company: 'Company Mentions', Brand: 'Brand Mentions'
};

interface Props {
    investigationId: number;
    sources: TelegramSource[];
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
}

const TelegramEntitiesPane: React.FC<Props> = ({ investigationId, sources, onNavigateToModule }) => {
    const [stats, setStats] = useState<TelegramIntelStats | null>(null);
    const [entities, setEntities] = useState<TelegramEntitySummary[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('');
    const [filterSource, setFilterSource] = useState<string>('');
    const [query, setQuery] = useState('');
    const [job, setJob] = useState<TelegramExtractionJob | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [scopeSourceId, setScopeSourceId] = useState<string>('');
    const [occurrences, setOccurrences] = useState<{ entity: TelegramEntitySummary; rows: TelegramMessageEntity[] } | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            getTelegramIntelStats(investigationId),
            getTelegramEntities(investigationId, {
                entityType: (filterType || undefined) as TelegramEntityType | undefined,
                sourceId: filterSource ? Number(filterSource) : undefined,
                q: query || undefined,
                pageSize: 100
            })
        ])
            .then(([s, e]) => { setStats(s); setEntities(e.items); setTotal(e.total); })
            .catch(() => { setStats(null); setEntities([]); setTotal(0); })
            .finally(() => setLoading(false));
    }, [investigationId, filterType, filterSource, query]);

    useEffect(() => { load(); }, [load]);

    // §42 — poll the job; never block on extraction.
    useEffect(() => {
        if (!job || !ACTIVE.includes(job.status)) return;
        const t = setTimeout(() => {
            getTelegramExtractionJob(job.id)
                .then((j) => { setJob(j); if (!ACTIVE.includes(j.status)) load(); })
                .catch(() => { /* a poll failure is not a job failure */ });
        }, 2500);
        return () => clearTimeout(t);
    }, [job, load]);

    const runAnalysis = async () => {
        setError(null);
        try {
            const res = await startTelegramExtraction(investigationId,
                scopeSourceId
                    ? { scope: 'source', sourceId: Number(scopeSourceId) }
                    : { scope: 'investigation' });
            setJob(await getTelegramExtractionJob(res.jobId));
        } catch (err: any) {
            setError(err?.message || 'Failed to start message analysis.');
        }
    };

    const cancel = async () => {
        if (!job) return;
        try {
            await cancelTelegramExtractionJob(job.id);
            setJob(await getTelegramExtractionJob(job.id));
        } catch (err: any) {
            setError(err?.message || 'Failed to cancel analysis.');
        }
    };

    const openOccurrences = async (entity: TelegramEntitySummary) => {
        try {
            const rows = await getTelegramEntityOccurrences(investigationId, entity.entityType, entity.normalizedValue);
            setOccurrences({ entity, rows });
        } catch { /* leave the list as-is */ }
    };

    // §24-§29 — pre-filled navigation into the EXISTING modules. Navigation
    // only; the destination module still requires the analyst to run it.
    const crossNavFor = (e: TelegramEntitySummary): { label: string; module: string; value: string } | null => {
        switch (e.entityType) {
            case 'Domain': return { label: 'Analyze Domain', module: 'domain-intel', value: e.normalizedValue };
            case 'URL': return { label: 'Analyze Domain', module: 'domain-intel', value: e.normalizedValue };
            case 'IPv4':
            case 'IPv6': return { label: 'Analyze IP', module: 'ip-intel', value: e.normalizedValue };
            case 'Email': return { label: 'Analyze Email', module: 'email', value: e.normalizedValue };
            case 'Phone': return { label: 'Analyze Phone', module: 'phone', value: e.normalizedValue };
            case 'Username':
            case 'Mention': return { label: 'Investigate Username', module: 'social', value: e.normalizedValue };
            case 'Company': return { label: 'Analyze Company', module: 'company-intel', value: e.normalizedValue };
            case 'Brand': return { label: 'Analyze Brand', module: 'brand-intel', value: e.normalizedValue };
            default: return null;
        }
    };

    const statFor = (t: string) => stats?.byType?.[t]?.distinct ?? 0;

    return (
        <>
            {/* §33/§35 — statistics computed from real stored data. */}
            <div className="smi-card">
                <div className="smi-card-title">Message Intelligence</div>
                <p className="smi-muted">
                    Extracts entities from Telegram messages already collected. This never re-crawls Telegram,
                    and nothing extracted here is classified as malicious — values are observations with their
                    own recorded confidence and reason.
                </p>

                <div className="smi-overview-grid">
                    <label className="smi-kv">
                        <span className="k">Analyze</span>
                        <span className="v">
                            <select value={scopeSourceId} onChange={(e) => setScopeSourceId(e.target.value)} aria-label="Analysis scope">
                                <option value="">All sources</option>
                                {sources.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.target}</option>)}
                            </select>
                        </span>
                    </label>
                </div>
                <button
                    type="button" className="smi-btn smi-btn--primary" style={{ marginTop: '12px' }}
                    onClick={runAnalysis} disabled={!!job && ACTIVE.includes(job.status)}
                >
                    {job && ACTIVE.includes(job.status) ? 'Analyzing…' : 'Analyze Messages'}
                </button>

                {job && (
                    <div className="smi-signal-note">
                        Analysis job #{job.id} — {job.status}. Processed {job.messagesProcessed} of {job.messagesTotal} message(s);
                        {' '}{job.entitiesExtracted} entity occurrence(s), {job.observablesUpserted} observable(s).
                        {job.lastError && ` ${job.lastError}`}
                        {ACTIVE.includes(job.status) && (
                            <> {' '}<button type="button" className="smi-btn smi-btn--sm" onClick={cancel}>Cancel</button></>
                        )}
                    </div>
                )}
                {error && <div className="smi-error" style={{ marginTop: '10px' }}>{error}</div>}

                {stats && (
                    <>
                        <div className="smi-card-subtitle">Extracted Intelligence</div>
                        <div className="smi-summary">
                            <div className="smi-summary-card">
                                <span className="smi-summary-label">Messages</span>
                                <span className="smi-summary-value">{stats.messages}</span>
                            </div>
                            <div className="smi-summary-card">
                                <span className="smi-summary-label">With Entities</span>
                                <span className="smi-summary-value">{stats.messagesWithEntities}</span>
                            </div>
                            {TYPE_ORDER.filter((t) => statFor(t) > 0).map((t) => (
                                <div className="smi-summary-card" key={t}>
                                    <span className="smi-summary-label">{TYPE_LABEL[t] || t}</span>
                                    <span className="smi-summary-value">{statFor(t)}</span>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {/* §22/§34 — distinct entities with real occurrence counts. */}
            <div className="smi-card">
                <div className="smi-card-title">Extracted Entities</div>
                <div className="smi-overview-grid">
                    <label className="smi-kv">
                        <span className="k">Entity Type</span>
                        <span className="v">
                            <select value={filterType} onChange={(e) => setFilterType(e.target.value)} aria-label="Filter by entity type">
                                <option value="">All Types</option>
                                {TYPE_ORDER.map((t) => <option key={t} value={t}>{TYPE_LABEL[t] || t}</option>)}
                            </select>
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Source</span>
                        <span className="v">
                            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} aria-label="Filter by source">
                                <option value="">All Sources</option>
                                {sources.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.target}</option>)}
                            </select>
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Value contains</span>
                        <span className="v">
                            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)}
                                placeholder="Filter values" aria-label="Filter entity values" />
                        </span>
                    </label>
                </div>

                {loading ? (
                    <div className="smi-loading">Loading…</div>
                ) : entities.length === 0 ? (
                    <div className="smi-empty">
                        No entities extracted yet. Run <strong>Analyze Messages</strong> above to extract intelligence
                        from the messages already collected.
                    </div>
                ) : (
                    <>
                        <div className="smi-card-subtitle">{total} distinct entit{total === 1 ? 'y' : 'ies'}</div>
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead>
                                    <tr>
                                        <th>Type</th><th>Value</th><th>Claim</th><th>Confidence</th>
                                        <th>Messages</th><th>First Seen</th><th>Last Seen</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {entities.map((e) => {
                                        const nav = crossNavFor(e);
                                        return (
                                            <tr key={`${e.entityType}:${e.normalizedValue}`}>
                                                <td data-label="Type">{TYPE_LABEL[e.entityType] || e.entityType}{e.entitySubtype ? ` (${e.entitySubtype})` : ''}</td>
                                                <td data-label="Value" className="smi-mono">{e.normalizedValue}</td>
                                                <td data-label="Claim">{e.claim || '—'}</td>
                                                <td data-label="Confidence">
                                                    <span className={`smi-strength-badge smi-strength-badge--${e.confidence === 'High' || e.confidence === 'Confirmed' ? 'strong' : e.confidence === 'Medium' ? 'medium' : 'weak'}`}>
                                                        {e.confidence}
                                                    </span>
                                                    {e.confidenceReason && <div className="smi-muted">{e.confidenceReason}</div>}
                                                </td>
                                                <td data-label="Messages">{e.occurrenceCount}</td>
                                                <td data-label="First Seen">{e.firstSeen ? timeAgo(e.firstSeen) : '—'}</td>
                                                <td data-label="Last Seen">{e.lastSeen ? timeAgo(e.lastSeen) : '—'}</td>
                                                <td data-label="Actions">
                                                    <button type="button" className="smi-btn smi-btn--sm" onClick={() => openOccurrences(e)}>
                                                        View Messages
                                                    </button>
                                                    {nav && onNavigateToModule && (
                                                        <> {' '}
                                                            <button
                                                                type="button" className="smi-btn smi-btn--sm"
                                                                onClick={() => onNavigateToModule(nav.module, nav.value)}
                                                                title="Opens the module with this value pre-filled — it does not start a scan"
                                                            >
                                                                {nav.label}
                                                            </button>
                                                        </>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* §22 — "Preserve all source occurrences." */}
            {occurrences && (
                <div className="smi-card">
                    <div className="smi-card-title">
                        Occurrences — {occurrences.entity.entityType}: {occurrences.entity.normalizedValue}
                    </div>
                    {occurrences.rows.length === 0 ? (
                        <div className="smi-empty">No occurrences recorded.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Message ID</th><th>Source</th><th>Observed</th><th>Extraction Method</th><th>Confidence</th></tr></thead>
                                <tbody>
                                    {occurrences.rows.map((o) => (
                                        <tr key={o.id}>
                                            <td data-label="Message ID" className="smi-mono">{o.telegramMessageId ?? o.messageRowId}</td>
                                            <td data-label="Source" className="smi-mono">{o.sourceDisplayName || o.sourceTarget || o.sourceId}</td>
                                            <td data-label="Observed">{o.messageDate ? new Date(o.messageDate).toLocaleString() : '—'}</td>
                                            <td data-label="Extraction Method">{o.extractionMethod}</td>
                                            <td data-label="Confidence">{o.confidence}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '12px' }} onClick={() => setOccurrences(null)}>
                        Close
                    </button>
                </div>
            )}
        </>
    );
};

export default TelegramEntitiesPane;
