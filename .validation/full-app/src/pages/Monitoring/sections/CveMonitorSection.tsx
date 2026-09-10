import React, { useCallback, useEffect, useState } from 'react';
import {
    getCveWatchCriteria, createCveWatchCriteria, updateCveWatchCriteria, deleteCveWatchCriteria, getCveMatches,
    type CveWatchCriteria, type CveMatch
} from '../../../services/api';
import { timeAgo } from '../../../utils/timeAgo';
import { RiskBadge, ConfirmDialog } from '../MonitoringShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8

// MONITORING_CODE.md §4 — criteria-based, not target-based like the other
// monitor types, so it's its own section rather than reusing
// MonitorListSection. No manual "Check Now" per criteria row — NVD's
// keyless rate limit (5 req/30s) is shared across every criteria row on
// this server, and an on-demand button per row risks tripping it; the
// scheduler already rechecks every criteria row hourly.
const SEVERITY_OPTIONS = ['', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

const CveMonitorSection: React.FC = () => {
    const [criteria, setCriteria] = useState<CveWatchCriteria[]>([]);
    const [criteriaLoading, setCriteriaLoading] = useState(true);
    const [criteriaError, setCriteriaError] = useState<string | null>(null);

    const loadCriteria = useCallback(() => {
        setCriteriaLoading(true);
        setCriteriaError(null);
        getCveWatchCriteria()
            .then(setCriteria)
            .catch((err) => setCriteriaError(err?.message || 'Failed to load CVE watch criteria'))
            .finally(() => setCriteriaLoading(false));
    }, []);
    useEffect(() => { loadCriteria(); }, [loadCriteria]);

    const [matches, setMatches] = useState<CveMatch[]>([]);
    const [matchesTotal, setMatchesTotal] = useState(0);
    const [matchesLoading, setMatchesLoading] = useState(true);
    const [matchesError, setMatchesError] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const pageSize = 20;

    const loadMatches = useCallback(() => {
        setMatchesLoading(true);
        setMatchesError(null);
        getCveMatches({ page, pageSize })
            .then((res) => { setMatches(res.items); setMatchesTotal(res.total); })
            .catch((err) => setMatchesError(err?.message || 'Failed to load CVE matches'))
            .finally(() => setMatchesLoading(false));
    }, [page]);
    useEffect(() => { loadMatches(); }, [loadMatches]);

    // ── Add criteria ──────────────────────────────────────────────────────────
    const [showAdd, setShowAdd] = useState(false);
    const [vendor, setVendor] = useState('');
    const [product, setProduct] = useState('');
    const [keyword, setKeyword] = useState('');
    const [minSeverity, setMinSeverity] = useState('');
    const [minCvss, setMinCvss] = useState('');
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const submitAdd = async () => {
        setAdding(true);
        setAddError(null);
        try {
            await createCveWatchCriteria({
                vendor: vendor || undefined, product: product || undefined, keyword: keyword || undefined,
                minSeverity: minSeverity || undefined, minCvss: minCvss ? Number(minCvss) : undefined
            });
            setVendor(''); setProduct(''); setKeyword(''); setMinSeverity(''); setMinCvss('');
            setShowAdd(false);
            loadCriteria();
        } catch (err: any) {
            setAddError(err?.message || 'Failed to add watch criteria');
        } finally {
            setAdding(false);
        }
    };

    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const handleTogglePause = async (c: CveWatchCriteria) => {
        await updateCveWatchCriteria(c.id, { status: c.status === 'active' ? 'paused' : 'active' });
        loadCriteria();
    };

    const runDelete = async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        try {
            await deleteCveWatchCriteria(confirmDeleteId);
            setConfirmDeleteId(null);
            loadCriteria();
        } finally {
            setDeleting(false);
        }
    };

    const criteriaLabel = (c: CveWatchCriteria) => [c.vendor, c.product, c.keyword].filter(Boolean).join(' / ') || `#${c.id}`;
    const totalPages = Math.max(1, Math.ceil(matchesTotal / pageSize));

    return (
        <>
            <div className="mon-card">
                <div className="mon-section-header">
                    <span className="mon-card-title">CVE Watch Criteria</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="mon-refresh-btn" onClick={loadCriteria} disabled={criteriaLoading}>{criteriaLoading ? 'Loading…' : 'Refresh'}</button>
                        <button type="button" className="mon-submit-btn" onClick={() => setShowAdd((v) => !v)}>+ Add Criteria</button>
                    </div>
                </div>

                {showAdd && (
                    <div style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="mon-form-row">
                            <input type="text" placeholder="Vendor (e.g. Microsoft)" value={vendor} onChange={(e) => setVendor(e.target.value)} />
                            <input type="text" placeholder="Product (e.g. Exchange)" value={product} onChange={(e) => setProduct(e.target.value)} />
                            <input type="text" placeholder="Keyword (e.g. Remote Code Execution)" value={keyword} onChange={(e) => setKeyword(e.target.value)} style={{ minWidth: '220px' }} />
                            <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value)}>
                                <option value="">Any severity</option>
                                {SEVERITY_OPTIONS.filter(Boolean).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <input type="number" placeholder="Min CVSS" min={0} max={10} step={0.1} value={minCvss} onChange={(e) => setMinCvss(e.target.value)} style={{ width: '90px' }} />
                            <button type="button" className="mon-submit-btn" onClick={submitAdd} disabled={adding || (!vendor && !product && !keyword)}>{adding ? 'Adding…' : 'Add'}</button>
                        </div>
                        <div className="mon-note" style={{ marginTop: '6px' }}>At least one of vendor, product, or keyword is required. Source: NIST NVD (public, keyless).</div>
                        {addError && <div className="mon-note" style={{ color: '#f85149' }}>{addError}</div>}
                    </div>
                )}

                {criteriaError ? (
                    <div className="mon-error">{criteriaError}<button type="button" className="mon-retry-btn" onClick={loadCriteria}>Retry</button></div>
                ) : criteriaLoading ? (
                    <div className="mon-loading">Loading…</div>
                ) : criteria.length === 0 ? (
                    <div className="mon-empty">No CVE watch criteria configured yet.</div>
                ) : (
                    <div className="mon-table-wrap">
                        <table className="mon-table">
                            <thead>
                                <tr><th>Criteria</th><th>Min Severity</th><th>Min CVSS</th><th>Status</th><th>Last Checked</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {criteria.map((c) => (
                                    <tr key={c.id}>
                                        <td><span className="mon-target" title={criteriaLabel(c)}>{criteriaLabel(c)}</span></td>
                                        <td>{c.min_severity || '—'}</td>
                                        <td>{c.min_cvss ?? '—'}</td>
                                        <td>
                                            <button type="button" className="mon-action-btn" onClick={() => handleTogglePause(c)}>
                                                {c.status === 'active' ? 'Active — Pause' : 'Paused — Resume'}
                                            </button>
                                            {c.last_error && <div className="mon-note" style={{ color: '#f85149', marginTop: '4px', fontSize: '0.75rem' }}>{c.last_error}</div>}
                                        </td>
                                        <td>{c.last_checked_at ? timeAgo(c.last_checked_at) : 'Never'}</td>
                                        <td>
                                            <button type="button" className="mon-action-btn mon-action-btn--danger" onClick={() => setConfirmDeleteId(c.id)}>Remove</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="mon-card">
                <div className="mon-section-header">
                    <span className="mon-card-title">Matching Vulnerabilities</span>
                    <button type="button" className="mon-refresh-btn" onClick={loadMatches} disabled={matchesLoading}>{matchesLoading ? 'Loading…' : 'Refresh'}</button>
                </div>
                {matchesError ? (
                    <div className="mon-error">{matchesError}<button type="button" className="mon-retry-btn" onClick={loadMatches}>Retry</button></div>
                ) : matchesLoading ? (
                    <div className="mon-loading">Loading…</div>
                ) : matches.length === 0 ? (
                    <div className="mon-empty">No CVE matches yet.</div>
                ) : (
                    <>
                        <div className="mon-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                            {matches.map((m) => (
                                <div key={m.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <RiskBadge risk={m.severity} />
                                        <a href={`https://nvd.nist.gov/vuln/detail/${m.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ fontWeight: 700, color: '#58a6ff' }}>{m.cve_id}</a>
                                        {m.cvss != null && <span className="mon-note">CVSS {m.cvss}</span>}
                                        <span style={{ flex: 1 }} />
                                        <span className="mon-note">{m.detected_at ? timeAgo(m.detected_at) : ''}</span>
                                    </div>
                                    {m.affected_product && <div className="mon-note" style={{ marginTop: '4px' }}>Affected: {m.affected_product}</div>}
                                    {m.title && <div className="mon-note" style={{ marginTop: '4px' }}>{m.title.length > 220 ? `${m.title.slice(0, 220)}…` : m.title}</div>}
                                </div>
                            ))}
                        </div>
                        <Pagination prefix="mon" page={page} totalPages={totalPages} total={matchesTotal} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                    </>
                )}
            </div>

            {confirmDeleteId != null && (
                <ConfirmDialog
                    title="Remove CVE watch criteria"
                    text="Stop watching for CVEs matching this criteria?"
                    busy={deleting}
                    confirmLabel="Remove"
                    onCancel={() => setConfirmDeleteId(null)}
                    onConfirm={runDelete}
                />
            )}
        </>
    );
};

export default CveMonitorSection;
