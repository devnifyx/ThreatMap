import React, { useState, useEffect, useCallback } from 'react';
import type { BrandScanJob } from '../../../types/index';
import { getBrandFindings, getBrandFinding, resolveBrandFinding, type BrandPersistentFinding } from '../../../services/api';

// BRAND_INTELLIGENCE_IMPROVEMENT.md §47-§52 — the persistent, cross-scan CTI
// view: every finding here survived the Stable Finding Fingerprint (§4-§10)
// and carries real IOC/MISP/Threat Intelligence correlation state (§11-§27),
// never a per-job candidate list. This is additive to the existing pillars
// (Domain/Website/Social/Logo/Campaigns) — it does not replace any of them.

function riskClass(level: string | null | undefined): string {
    switch ((level || '').toLowerCase()) {
        case 'critical': return 'bi-risk-critical';
        case 'high':     return 'bi-risk-high';
        case 'medium':   return 'bi-risk-medium';
        case 'low':      return 'bi-risk-low';
        default:         return 'bi-risk-none';
    }
}
function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
}

const STATUS_LABELS: Record<string, string> = { active: 'Active', dormant: 'Dormant', resolved: 'Resolved', reappeared: 'Reappeared' };
const THREAT_INTEL_LABELS: Record<string, string> = {
    no_match: 'No Match', observed_correlation: 'Observed Correlation', suspicious_correlation: 'Suspicious Correlation',
    known_threat_intelligence_match: 'Known Threat Intelligence Match', confirmed_by_existing_intelligence: 'Confirmed by Existing Intelligence'
};
const MISP_LABELS: Record<string, string> = { not_configured: 'Not Configured', no_match: 'No Match', match: 'Matched', unavailable: 'Unavailable' };

const inputStyle: React.CSSProperties = { background: 'var(--bg-secondary, #0d0f14)', border: '1px solid var(--ui-border, #2a2f3a)', color: 'inherit', borderRadius: '6px', padding: '6px 10px', fontSize: '0.85rem' };

const FindingDetailModal: React.FC<{ findingId: number; onClose: () => void; onChanged: () => void }> = ({ findingId, onClose, onChanged }) => {
    const [finding, setFinding] = useState<BrandPersistentFinding | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [resolving, setResolving] = useState(false);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getBrandFinding(findingId).then((r) => setFinding(r.finding)).catch((e) => setError(e.message || 'Failed to load finding')).finally(() => setLoading(false));
    }, [findingId]);
    useEffect(() => { load(); }, [load]);

    const resolve = async () => {
        setResolving(true);
        try { await resolveBrandFinding(findingId); load(); onChanged(); } finally { setResolving(false); }
    };

    return (
        <div
            role="dialog" aria-modal="true" aria-label="Finding detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}
        >
            <div style={{ maxWidth: '720px', width: '92%', maxHeight: '85vh', overflowY: 'auto', padding: '20px', background: 'var(--bg-primary, #12151c)', border: '1px solid var(--ui-border, #2a2f3a)', borderRadius: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h3 style={{ margin: 0 }}>{finding?.normalized_value || 'Finding'}</h3>
                    <button type="button" className="bi-btn-secondary" onClick={onClose}>Close</button>
                </div>
                {error ? <p className="bi-error">{error}</p> : loading || !finding ? <p className="bi-loading">Loading…</p> : (
                    <>
                        {/* §47 — Brand / Candidate / Finding Type / Status / Fingerprint / Risk / Confidence / First-Last Seen */}
                        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', rowGap: '6px', fontSize: '0.85rem', marginBottom: '14px' }}>
                            <span>Finding Type</span><span style={{ textTransform: 'capitalize' }}>{finding.finding_type.replace('_', ' ')}</span>
                            <span>Status</span><span>{STATUS_LABELS[finding.status]}</span>
                            <span>Fingerprint</span><span style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>{finding.fingerprint.slice(0, 16)}…</span>
                            <span>Risk</span><span className={`bi-risk-badge ${riskClass(finding.risk_level)}`}>{finding.risk_level || 'None'}</span>
                            <span>Confidence</span><span>{finding.confidence_state}</span>
                            <span>First Seen</span><span>{formatDateTime(finding.first_seen_at)}</span>
                            <span>Last Seen</span><span>{formatDateTime(finding.last_seen_at)}</span>
                            {finding.resolved_at && <><span>Resolved</span><span>{formatDateTime(finding.resolved_at)}</span></>}
                        </div>

                        {finding.status !== 'resolved' && (
                            <button type="button" className="bi-btn-secondary" onClick={resolve} disabled={resolving} style={{ marginBottom: '14px' }}>
                                {resolving ? 'Resolving…' : 'Mark Resolved'}
                            </button>
                        )}

                        {/* §48 "IOC SECTION" */}
                        <div style={{ marginBottom: '14px' }}>
                            <h4 style={{ margin: '0 0 6px' }}>Related Indicators ({finding.iocs?.length || 0})</h4>
                            {!finding.iocs?.length ? <p className="bi-loading">No indicators extracted for this finding.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    {finding.iocs.map((ioc) => (
                                        <div key={ioc.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', fontSize: '0.82rem', flexWrap: 'wrap' }}>
                                            <span className="bi-chip">{ioc.type}</span>
                                            <span>{ioc.value}</span>
                                            <span className={`bi-risk-badge ${riskClass(ioc.risk)}`}>{ioc.risk || 'None'}</span>
                                            <span style={{ opacity: 0.7 }}>via {ioc.source} · {formatDateTime(ioc.first_seen_at)} → {formatDateTime(ioc.last_seen_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* §49 "MISP SECTION" — never displays MISP data if not configured. */}
                        <div style={{ marginBottom: '14px' }}>
                            <h4 style={{ margin: '0 0 6px' }}>MISP Correlations</h4>
                            <p style={{ fontSize: '0.85rem', margin: '0 0 6px' }}>Status: <strong>{MISP_LABELS[finding.misp_status]}</strong>{finding.misp_checked_at ? ` · checked ${formatDateTime(finding.misp_checked_at)}` : ''}</p>
                            {finding.misp_status === 'match' && finding.misp_matches?.length ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {finding.misp_matches.map((m, i) => (
                                        <div key={i} style={{ fontSize: '0.82rem', border: '1px solid var(--ui-border, #2a2f3a)', borderRadius: '6px', padding: '8px' }}>
                                            <div>Event: {m.mispEventId ?? '—'} · Attribute: {m.mispAttributeId ?? '—'}</div>
                                            <div>IOC: {m.iocValue} ({m.iocType})</div>
                                            {m.threatLevel && <div>Threat Level: {m.threatLevel}</div>}
                                            {m.category && <div>Category: {m.category}</div>}
                                            {m.tags.length > 0 && <div>Tags: {m.tags.join(', ')}</div>}
                                            {m.references.length > 0 && <div><a href={m.references[0]} target="_blank" rel="noreferrer">{m.references[0]}</a></div>}
                                        </div>
                                    ))}
                                </div>
                            ) : null}
                        </div>

                        {/* §16 "THREAT INTELLIGENCE MATCH STATES" */}
                        <p style={{ fontSize: '0.85rem', marginBottom: '10px' }}>Threat Intelligence: <strong>{THREAT_INTEL_LABELS[finding.threat_intel_status]}</strong></p>

                        {/* §50 "THREAT RELATIONSHIPS SECTION" — hedged language throughout. */}
                        {((finding.threatActorRelationships?.length || 0) + (finding.malwareRelationships?.length || 0) + (finding.campaignRelationships?.length || 0)) > 0 && (
                            <div style={{ marginBottom: '14px' }}>
                                <h4 style={{ margin: '0 0 6px' }}>Threat Relationships</h4>
                                {finding.threatActorRelationships?.map((r) => (
                                    <div key={`ta-${r.id}`} style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Threat Actor: <strong>{r.name}</strong> — Potentially Associated ({r.confidence || 'Low'} confidence, via {r.source})</div>
                                ))}
                                {finding.malwareRelationships?.map((r) => (
                                    <div key={`m-${r.id}`} style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Malware: <strong>{r.name}</strong> — Related Malware ({r.confidence || 'Low'} confidence, via {r.source})</div>
                                ))}
                                {finding.campaignRelationships?.map((r) => (
                                    <div key={`c-${r.id}`} style={{ fontSize: '0.82rem', marginBottom: '4px' }}>Campaign: <strong>{r.name}</strong> — Related Campaign (via {r.source})</div>
                                ))}
                            </div>
                        )}

                        {/* §51 "SOURCE ATTRIBUTION" — every evidence row shows its real source. */}
                        <div>
                            <h4 style={{ margin: '0 0 6px' }}>Evidence ({finding.evidence?.length || 0})</h4>
                            {!finding.evidence?.length ? <p className="bi-loading">No evidence recorded yet.</p> : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                    {finding.evidence.map((e) => (
                                        <div key={e.id} style={{ fontSize: '0.82rem', borderLeft: '2px solid var(--ui-border, #2a2f3a)', paddingLeft: '8px' }}>
                                            <div><strong>{e.finding}</strong> <span style={{ opacity: 0.7 }}>({e.source}, {e.confidence}% confidence)</span></div>
                                            <div style={{ opacity: 0.85 }}>{e.detection_reason}</div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

interface CtiFindingsPaneProps {
    job: BrandScanJob;
}

const CtiFindingsPane: React.FC<CtiFindingsPaneProps> = ({ job }) => {
    const [filters, setFilters] = useState({ status: 'all', findingType: 'all', confidenceState: 'all', mispStatus: 'all', threatIntelStatus: 'all' });
    const [items, setItems] = useState<BrandPersistentFinding[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getBrandFindings(job.brand_id, {
            status: filters.status !== 'all' ? filters.status : undefined,
            findingType: filters.findingType !== 'all' ? filters.findingType : undefined,
            confidenceState: filters.confidenceState !== 'all' ? filters.confidenceState : undefined,
            mispStatus: filters.mispStatus !== 'all' ? filters.mispStatus : undefined,
            threatIntelStatus: filters.threatIntelStatus !== 'all' ? filters.threatIntelStatus : undefined,
            pageSize: 100
        }).then((res) => { setItems(res.items); setTotal(res.total); }).catch((e) => setError(e.message || 'Failed to load findings')).finally(() => setLoading(false));
    }, [job.brand_id, filters]);
    useEffect(() => { load(); }, [load]);

    return (
        <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0 }}>CTI &amp; Threat Intelligence ({total})</h3>
                <button type="button" className="bi-btn-secondary" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <p style={{ fontSize: '0.82rem', opacity: 0.75, marginBottom: '12px' }}>
                Persistent findings — one stable identity per candidate across every scan (§4-§10), enriched with extracted indicators, MISP correlation, and existing Threat Intelligence relationships.
            </p>

            {/* §52 "SEARCH / FILTER" */}
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <select style={inputStyle} value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="all">All Status</option><option value="active">Active</option><option value="dormant">Dormant</option><option value="reappeared">Reappeared</option><option value="resolved">Resolved</option>
                </select>
                <select style={inputStyle} value={filters.findingType} onChange={(e) => setFilters((f) => ({ ...f, findingType: e.target.value }))}>
                    <option value="all">All Types</option><option value="domain">Domain</option><option value="social_account">Social Account</option>
                </select>
                <select style={inputStyle} value={filters.confidenceState} onChange={(e) => setFilters((f) => ({ ...f, confidenceState: e.target.value }))}>
                    <option value="all">All Confidence</option><option value="Observed">Observed</option><option value="Correlated">Correlated</option><option value="Confirmed">Confirmed</option>
                </select>
                <select style={inputStyle} value={filters.mispStatus} onChange={(e) => setFilters((f) => ({ ...f, mispStatus: e.target.value }))}>
                    <option value="all">All MISP</option><option value="not_configured">Not Configured</option><option value="no_match">No Match</option><option value="match">Matched</option><option value="unavailable">Unavailable</option>
                </select>
                <select style={inputStyle} value={filters.threatIntelStatus} onChange={(e) => setFilters((f) => ({ ...f, threatIntelStatus: e.target.value }))}>
                    <option value="all">All Threat Intel</option>
                    {Object.entries(THREAT_INTEL_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                </select>
            </div>

            {error ? <p className="bi-error">{error}</p> : loading ? <p className="bi-loading">Loading…</p> : items.length === 0 ? (
                <p className="bi-loading">No CTI findings yet — findings appear here once an investigation evaluates a domain or social candidate with a real risk signal.</p>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {items.map((f) => (
                        <button key={f.id} type="button" onClick={() => setSelectedId(f.id)} className="bi-campaign-member-row" style={{ textAlign: 'left', width: '100%' }}>
                            <span className="bi-candidate-value">{f.normalized_value}</span>
                            <span className={`bi-risk-badge ${riskClass(f.risk_level)}`}>{f.risk_level || 'None'}</span>
                            <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>{STATUS_LABELS[f.status]}</span>
                            <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>{f.confidence_state}</span>
                            <span style={{ fontSize: '0.78rem', opacity: 0.8 }}>MISP: {MISP_LABELS[f.misp_status]}</span>
                        </button>
                    ))}
                </div>
            )}

            {selectedId != null && <FindingDetailModal findingId={selectedId} onClose={() => setSelectedId(null)} onChanged={load} />}
        </div>
    );
};

export default CtiFindingsPane;
