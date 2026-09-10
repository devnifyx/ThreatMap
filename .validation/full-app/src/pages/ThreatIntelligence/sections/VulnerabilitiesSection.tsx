import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getVulnerabilities, getVulnerability, lookupVulnerability, syncVulnerabilities, type Vulnerability, type VulnerabilityDetail } from '../../../services/api';
import { RiskBadge, formatDate, formatDateTime, EntityChip, InvestigateButton } from '../ThreatIntelligenceShared';
import RiskAssessmentBlock from './RiskAssessmentBlock';

const CVE_ID_RE = /^CVE-\d{4}-\d{4,}$/i;

interface Props {
    openEntityId?: string | null;
    onEntityOpened?: () => void;
    onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
}

const VulnerabilityDetailModal: React.FC<{ cveId: string; onClose: () => void; onOpenEntity?: (type: string, id: string) => void; onInvestigate?: (target: string, tab?: string) => void }> = ({ cveId, onClose, onOpenEntity, onInvestigate }) => {
    const [vuln, setVuln] = useState<VulnerabilityDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getVulnerability(cveId).then(setVuln).catch((err) => setError(err?.message || 'Failed to load vulnerability')).finally(() => setLoading(false));
    }, [cveId]);

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Vulnerability detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal">
                <div className="ti-modal-header">
                    <h2>{vuln?.cve_id ?? cveId}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !vuln ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            <div className="ti-kv">
                                <span className="k">Severity</span><span className="v"><RiskBadge risk={vuln.severity} /></span>
                                <span className="k">CVSS</span><span className="v">{vuln.cvss != null ? `${vuln.cvss}${vuln.cvss_version ? ` (${vuln.cvss_version})` : ''}` : '—'}</span>
                                <span className="k">Vendor</span><span className="v">{vuln.vendor ?? '—'}</span>
                                <span className="k">Product</span><span className="v">{vuln.product ?? '—'}</span>
                                <span className="k">Exploit Availability</span><span className="v">{vuln.exploit_availability}</span>
                                <span className="k">Known Exploitation</span><span className="v" style={vuln.known_exploitation === 'Observed' ? { color: '#f85149', fontWeight: 700 } : undefined}>{vuln.known_exploitation}</span>
                                {vuln.cisa_kev_added_at && (<><span className="k">CISA KEV Added</span><span className="v">{formatDate(vuln.cisa_kev_added_at)}</span></>)}
                                <span className="k">Published</span><span className="v">{formatDate(vuln.published_at)}</span>
                                <span className="k">Last Modified</span><span className="v">{formatDate(vuln.updated_at ?? vuln.last_seen_at)}</span>
                                <span className="k">Source</span><span className="v">{vuln.source}</span>
                            </div>
                            <InvestigateButton target={vuln.cve_id} onInvestigate={onInvestigate} />
                            {vuln.description && <div className="ti-note">{vuln.description}</div>}

                            {(vuln.affected_versions ?? []).length > 0 && (
                                <div>
                                    <div className="ti-modal-subtitle">Affected Versions</div>
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {(vuln.affected_versions ?? []).map((r, i) => (
                                            <div key={i} className="ti-note">
                                                {r.startIncluding && `>= ${r.startIncluding} `}
                                                {r.startExcluding && `> ${r.startExcluding} `}
                                                {r.endIncluding && `<= ${r.endIncluding} `}
                                                {r.endExcluding && `< ${r.endExcluding}`}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {(vuln.references ?? []).length > 0 && (
                                <div>
                                    <div className="ti-modal-subtitle">References ({(vuln.references ?? []).length})</div>
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {(vuln.references ?? []).map((r, i) => (
                                            <div key={i} style={{ padding: '4px 0' }}>
                                                <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', fontSize: '0.85rem', wordBreak: 'break-all' }}>{r.url}</a>
                                                {(r.tags ?? []).length > 0 && <span className="ti-note" style={{ marginLeft: '8px' }}>{(r.tags ?? []).join(', ')}</span>}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div className="ti-modal-subtitle">Related Campaigns / Threat Actors / Malware / MITRE ATT&CK ({(vuln.relationships ?? []).length})</div>
                                {(vuln.relationships ?? []).length === 0 ? <div className="ti-empty">None known yet.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {(vuln.relationships ?? []).map((r) => (
                                            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap' }}>
                                                <span className="ti-note" style={{ minWidth: '90px' }}>{r.relationship_type.replace(/_/g, ' ')}</span>
                                                <EntityChip entity={r.entity} onOpen={onOpenEntity} />
                                                <span className="ti-note" style={{ marginLeft: 'auto' }}>{formatDateTime(r.updated_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <a href={`https://nvd.nist.gov/vuln/detail/${vuln.cve_id}`} target="_blank" rel="noopener noreferrer" style={{ color: '#58a6ff', fontSize: '0.85rem' }}>View on nvd.nist.gov →</a>

                            <RiskAssessmentBlock entityType="vulnerability" entityId={vuln.id} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const VulnerabilitiesSection: React.FC<Props> = ({ openEntityId, onEntityOpened, onOpenEntity, onInvestigate }) => {
    const [filters, setFilters] = useState({ q: '', severity: 'all', minCvss: '', vendor: '', product: '', exploitAvailability: 'all', knownExploitation: 'all', dateFrom: '', dateTo: '' });
    const [sort, setSort] = useState<'published' | 'last_modified' | 'cvss' | 'severity' | 'cve_id'>('published');
    const [order, setOrder] = useState<'desc' | 'asc'>('desc');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [items, setItems] = useState<Vulnerability[]>([]);
    const [total, setTotal] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedCveId, setSelectedCveId] = useState<string | null>(null);

    const [lookupInput, setLookupInput] = useState('');
    const [lookupBusy, setLookupBusy] = useState(false);
    const [lookupError, setLookupError] = useState<string | null>(null);

    // Admin-only NVD sync trigger state.
    const [syncBusy, setSyncBusy] = useState(false);
    const [syncMsg, setSyncMsg] = useState<string | null>(null);

    const [debouncedQ, setDebouncedQ] = useState('');
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
            setDebouncedQ(filters.q);
            setPage(1);
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [filters.q]);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getVulnerabilities({
            q: debouncedQ || undefined, severity: filters.severity !== 'all' ? filters.severity : undefined,
            minCvss: filters.minCvss ? Number(filters.minCvss) : undefined,
            vendor: filters.vendor || undefined, product: filters.product || undefined,
            exploitAvailability: filters.exploitAvailability !== 'all' ? filters.exploitAvailability : undefined,
            knownExploitation: filters.knownExploitation !== 'all' ? filters.knownExploitation : undefined,
            dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
            sort, order, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); setTotalPages(res.totalPages ?? 1); })
            .catch((err) => setError(err?.message || 'Failed to load vulnerabilities'))
            .finally(() => setLoading(false));
    }, [filters, debouncedQ, sort, order, page, pageSize]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (openEntityId) { setSelectedCveId(openEntityId); onEntityOpened?.(); }
    }, [openEntityId, onEntityOpened]);

    const runLookup = async () => {
        const cveId = lookupInput.trim().toUpperCase();
        if (!CVE_ID_RE.test(cveId)) { setLookupError('Invalid CVE ID format (expected e.g. CVE-2021-44228)'); return; }
        setLookupBusy(true);
        setLookupError(null);
        try {
            await lookupVulnerability(cveId);
            setLookupInput('');
            setPage(1);
            load();
            setSelectedCveId(cveId);
        } catch (err: any) {
            setLookupError(err?.message || 'Lookup failed');
        } finally {
            setLookupBusy(false);
        }
    };

    const runSync = async (mode: 'incremental' | 'initial') => {
        setSyncBusy(true);
        setSyncMsg(null);
        try {
            const result = await syncVulnerabilities(mode);
            setSyncMsg(`Synced ${result.cvesUpserted} CVE${result.cvesUpserted === 1 ? '' : 's'} (${result.pages} page${result.pages === 1 ? '' : 's'}${result.rateLimited ? ', rate-limited' : ''}).`);
            setPage(1);
            load();
        } catch (err: any) {
            setSyncMsg(err?.message || 'Sync failed');
        } finally {
            setSyncBusy(false);
        }
    };

    const filtersAreDefault = !debouncedQ && filters.severity === 'all' && !filters.minCvss && !filters.vendor && !filters.product && filters.exploitAvailability === 'all' && filters.knownExploitation === 'all' && !filters.dateFrom && !filters.dateTo;

    const pageWindow: (number | '…')[] = (() => {
        const pages: (number | '…')[] = [];
        const span = 2;
        const start = Math.max(1, page - span);
        const end = Math.min(totalPages, page + span);
        if (start > 1) { pages.push(1); if (start > 2) pages.push('…'); }
        for (let p = start; p <= end; p++) pages.push(p);
        if (end < totalPages) { if (end < totalPages - 1) pages.push('…'); pages.push(totalPages); }
        return pages;
    })();

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Vulnerability Intelligence</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="ti-form-row" style={{ display: 'flex', gap: '8px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', alignItems: 'center' }}>
                <input type="text" placeholder="CVE-2026-XXXXX" value={lookupInput} onChange={(e) => setLookupInput(e.target.value)} style={{ minWidth: '200px', background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' }} />
                <button type="button" className="ti-action-btn" onClick={runLookup} disabled={lookupBusy || !lookupInput.trim()} style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }}>
                    {lookupBusy ? 'Looking up…' : 'Look Up'}
                </button>
                <button type="button" className="ti-action-btn" onClick={() => runSync('incremental')} disabled={syncBusy} title="Synchronize recent NVD CVE changes (admin only)">
                    {syncBusy ? 'Syncing…' : 'Sync NVD'}
                </button>
                <button type="button" className="ti-action-btn" onClick={() => runSync('initial')} disabled={syncBusy} title="Backfill the last 120 days of NVD CVEs (admin only)">
                    {syncBusy ? 'Syncing…' : 'Backfill'}
                </button>
                <span className="ti-note">Fetches live from NVD + cross-references CISA's Known Exploited Vulnerabilities catalog.</span>
                {lookupError && <div className="ti-note" style={{ width: '100%', color: '#f85149' }}>{lookupError}</div>}
                {syncMsg && <div className="ti-note" style={{ width: '100%' }}>{syncMsg}</div>}
            </div>

            <div className="ti-filters">
                <input type="text" placeholder="Search CVE ID, title, or description…" value={filters.q} onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))} />
                <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }}>
                    <option value="all">All Severity</option>
                    <option value="CRITICAL">Critical</option><option value="HIGH">High</option>
                    <option value="MEDIUM">Medium</option><option value="LOW">Low</option>
                </select>
                <input type="number" placeholder="Min CVSS" min={0} max={10} step={0.1} value={filters.minCvss} onChange={(e) => { setFilters((f) => ({ ...f, minCvss: e.target.value })); setPage(1); }} style={{ width: '90px' }} />
                <input type="text" placeholder="Vendor…" value={filters.vendor} onChange={(e) => { setFilters((f) => ({ ...f, vendor: e.target.value })); setPage(1); }} style={{ minWidth: '110px', flex: 'initial' }} />
                <input type="text" placeholder="Product…" value={filters.product} onChange={(e) => { setFilters((f) => ({ ...f, product: e.target.value })); setPage(1); }} style={{ minWidth: '110px', flex: 'initial' }} />
                <select value={filters.exploitAvailability} onChange={(e) => { setFilters((f) => ({ ...f, exploitAvailability: e.target.value })); setPage(1); }}>
                    <option value="all">All Exploit Status</option>
                    <option value="Available">Available</option><option value="PoC">PoC</option>
                    <option value="Not Available">Not Available</option><option value="Unknown">Unknown</option>
                </select>
                <select value={filters.knownExploitation} onChange={(e) => { setFilters((f) => ({ ...f, knownExploitation: e.target.value })); setPage(1); }}>
                    <option value="all">All Exploitation</option>
                    <option value="Observed">Known Exploited</option><option value="None Observed">None Observed</option>
                </select>
                <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} aria-label="Published from" />
                <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} aria-label="Published to" />
                <select value={sort} onChange={(e) => { setSort(e.target.value as typeof sort); setPage(1); }} aria-label="Sort by">
                    <option value="published">Sort: Published</option>
                    <option value="last_modified">Sort: Last Modified</option>
                    <option value="cvss">Sort: CVSS</option>
                    <option value="severity">Sort: Severity</option>
                    <option value="cve_id">Sort: CVE ID</option>
                </select>
                <select value={order} onChange={(e) => { setOrder(e.target.value as typeof order); setPage(1); }} aria-label="Sort order">
                    <option value="desc">Descending</option>
                    <option value="asc">Ascending</option>
                </select>
                <select value={String(pageSize)} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} aria-label="Page size">
                    <option value="20">20 / page</option>
                    <option value="50">50 / page</option>
                    <option value="100">100 / page</option>
                </select>
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No vulnerabilities found. Use "Look Up" to fetch one from NVD.' : 'No vulnerabilities match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>CVE</th><th>Severity</th><th>CVSS</th><th>Vendor</th><th>Product</th><th>Exploit</th><th>Known Exploitation</th><th>Published</th><th>Action</th></tr></thead>
                            <tbody>
                                {items.map((v) => (
                                    <tr key={v.id} className="ti-row-clickable" onClick={() => setSelectedCveId(v.cve_id)}>
                                        <td><span className="ti-target" title={v.title ?? v.cve_id}>{v.cve_id}</span></td>
                                        <td><RiskBadge risk={v.severity} /></td>
                                        <td>{v.cvss ?? '—'}</td>
                                        <td>{v.vendor ?? '—'}</td>
                                        <td>{v.product ?? '—'}</td>
                                        <td>{v.exploit_availability}</td>
                                        <td style={v.known_exploitation === 'Observed' ? { color: '#f85149', fontWeight: 700 } : undefined}>{v.known_exploitation}</td>
                                        <td>{formatDate(v.published_at)}</td>
                                        <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedCveId(v.cve_id); }}>View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="ti-pagination">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                        {pageWindow.map((p, i) => (
                            p === '…' ? <span key={`e${i}`} className="ti-pagination-info">…</span>
                            : <button key={p} type="button" className={p === page ? 'ti-page-btn ti-page-btn-active' : 'ti-page-btn'} onClick={() => setPage(p)}>{p}</button>
                        ))}
                        <span className="ti-pagination-info">Page {page} of {totalPages} · {total.toLocaleString()} total</span>
                        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
                    </div>
                </>
            )}

            {selectedCveId != null && <VulnerabilityDetailModal cveId={selectedCveId} onClose={() => setSelectedCveId(null)} onOpenEntity={onOpenEntity} onInvestigate={onInvestigate} />}
        </div>
    );
};

export default VulnerabilitiesSection;
