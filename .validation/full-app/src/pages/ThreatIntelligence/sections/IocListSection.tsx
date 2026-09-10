import React, { useCallback, useEffect, useState } from 'react';
import { getIocs, getIoc, getIocSources, type Ioc, type IocDetail } from '../../../services/api';
import { RiskBadge, ConfidenceBadge, formatDateTime, IOC_TYPE_LABELS, IOC_TYPE_TO_OSINT_TAB, InvestigateButton, EntityChip } from '../ThreatIntelligenceShared';
import RiskAssessmentBlock from './RiskAssessmentBlock';
import Pagination from '../../../components/shared/Pagination';  // P2-8

const IocDetailModal: React.FC<{
    id: number; onClose: () => void; onOpenEntity?: (type: string, id: string) => void; onInvestigate?: (target: string, tab?: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
}> = ({ id, onClose, onOpenEntity, onInvestigate, onViewNotes }) => {
    const [ioc, setIoc] = useState<IocDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getIoc(id).then(setIoc).catch((err) => setError(err?.message || 'Failed to load indicator')).finally(() => setLoading(false));
    }, [id]);

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="IOC detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal">
                <div className="ti-modal-header">
                    <h2>{ioc?.value ?? 'Indicator'}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !ioc ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            <div className="ti-kv">
                                <span className="k">Type</span><span className="v">{IOC_TYPE_LABELS[ioc.type] ?? ioc.type}</span>
                                <span className="k">Risk</span><span className="v"><RiskBadge risk={ioc.risk} /></span>
                                <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={ioc.confidence} /></span>
                                <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{ioc.status}</span>
                                <span className="k">First Seen</span><span className="v">{formatDateTime(ioc.first_seen_at)}</span>
                                <span className="k">Last Seen</span><span className="v">{formatDateTime(ioc.last_seen_at)}</span>
                            </div>

                            <div style={{ display: 'flex', gap: '8px' }}>
                                <InvestigateButton target={ioc.value} tab={IOC_TYPE_TO_OSINT_TAB[ioc.type]} onInvestigate={onInvestigate} />
                                {onViewNotes && (
                                    <button type="button" className="ti-action-btn" onClick={() => onViewNotes('ioc', String(ioc.id), ioc.value)}>
                                        View Notes
                                    </button>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Sources ({ioc.sources.length})</div>
                                {ioc.sources.length === 0 ? <div className="ti-empty">No sources recorded.</div> : (
                                    <div className="ti-chip-list">
                                        {ioc.sources.map((s, i) => <span key={i} className="ti-chip" title={`${s.source_type} · last seen ${formatDateTime(s.last_seen_at)}`}>{s.source_label}</span>)}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Campaigns ({ioc.relatedCampaigns.length})</div>
                                {ioc.relatedCampaigns.length === 0 ? <div className="ti-empty">None.</div> : (
                                    <div className="ti-chip-list">{ioc.relatedCampaigns.map((c) => <span key={c.id} className="ti-chip">{c.name}</span>)}</div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Monitoring Rules ({ioc.relatedMonitors.length})</div>
                                {ioc.relatedMonitors.length === 0 ? <div className="ti-empty">None.</div> : (
                                    <div className="ti-chip-list">{ioc.relatedMonitors.map((m) => <span key={m.id} className="ti-chip" style={{ textTransform: 'capitalize' }}>{m.type} monitor · {m.status}</span>)}</div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Alerts ({ioc.relatedAlerts.length})</div>
                                {ioc.relatedAlerts.length === 0 ? <div className="ti-empty">None.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {ioc.relatedAlerts.map((a) => (
                                            <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                                <RiskBadge risk={a.severity} /><span style={{ fontSize: '0.85rem', flex: 1 }}>{a.title}</span>
                                                <span className="ti-note">{formatDateTime(a.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Investigations ({ioc.relatedInvestigations.length})</div>
                                {ioc.relatedInvestigations.length === 0 ? <div className="ti-empty">None.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {ioc.relatedInvestigations.map((r) => (
                                            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                                <span style={{ fontSize: '0.85rem', flex: 1, textTransform: 'capitalize' }}>{r.module.replace(/-/g, ' ')}</span>
                                                <RiskBadge risk={r.risk_level} />
                                                <span className="ti-note">{formatDateTime(r.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Threat Actors ({ioc.relatedThreatActors.length})</div>
                                {ioc.relatedThreatActors.length === 0 ? <div className="ti-empty">None known.</div> : (
                                    <div className="ti-chip-list">{ioc.relatedThreatActors.map((a, i) => <EntityChip key={i} entity={a} onOpen={onOpenEntity} />)}</div>
                                )}
                            </div>
                            <div>
                                <div className="ti-modal-subtitle">Related Malware ({ioc.relatedMalware.length})</div>
                                {ioc.relatedMalware.length === 0 ? <div className="ti-empty">None known.</div> : (
                                    <div className="ti-chip-list">{ioc.relatedMalware.map((m, i) => <EntityChip key={i} entity={m} onOpen={onOpenEntity} />)}</div>
                                )}
                            </div>

                            <RiskAssessmentBlock entityType="ioc" entityId={ioc.id} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

interface IocListSectionProps {
    openEntityId?: string | null;
    onEntityOpened?: () => void;
    onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
}

const IocListSection: React.FC<IocListSectionProps> = ({ openEntityId, onEntityOpened, onOpenEntity, onInvestigate, onViewNotes }) => {
    const [filters, setFilters] = useState({ q: '', type: 'all', risk: 'all', confidence: 'all', source: 'all', status: 'all', dateFrom: '', dateTo: '' });
    const [sortBy, setSortBy] = useState('last_seen_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [items, setItems] = useState<Ioc[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sources, setSources] = useState<string[]>([]);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => { getIocSources().then(setSources).catch(() => {}); }, []);

    useEffect(() => {
        if (openEntityId) { setSelectedId(Number(openEntityId)); onEntityOpened?.(); }
    }, [openEntityId, onEntityOpened]);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getIocs({
            q: filters.q || undefined, type: filters.type !== 'all' ? filters.type : undefined,
            risk: filters.risk !== 'all' ? filters.risk : undefined, confidence: filters.confidence !== 'all' ? filters.confidence : undefined,
            source: filters.source !== 'all' ? filters.source : undefined, status: filters.status !== 'all' ? filters.status : undefined,
            dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined,
            sortBy, sortDir, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load indicators'))
            .finally(() => setLoading(false));
    }, [filters, sortBy, sortDir, page]);
    useEffect(() => { load(); }, [load]);

    const toggleSort = (col: string) => {
        if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(col); setSortDir('desc'); }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.type === 'all' && filters.risk === 'all' && filters.confidence === 'all' && filters.source === 'all' && filters.status === 'all' && !filters.dateFrom && !filters.dateTo;

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Indicators (IOC)</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="ti-filters">
                <input type="text" placeholder="Search value…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}>
                    <option value="all">All Types</option>
                    {Object.entries(IOC_TYPE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filters.risk} onChange={(e) => { setFilters((f) => ({ ...f, risk: e.target.value })); setPage(1); }}>
                    <option value="all">All Risk</option>
                    <option value="Critical">Critical</option><option value="High">High</option>
                    <option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <select value={filters.confidence} onChange={(e) => { setFilters((f) => ({ ...f, confidence: e.target.value })); setPage(1); }}>
                    <option value="all">All Confidence</option>
                    <option value="Confirmed">Confirmed</option><option value="High">High</option>
                    <option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <select value={filters.source} onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setPage(1); }}>
                    <option value="all">All Sources</option>
                    {sources.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option><option value="inactive">Inactive</option><option value="expired">Expired</option>
                </select>
                <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} aria-label="First seen from" />
                <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} aria-label="First seen to" />
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No indicators found.' : 'No indicators match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead>
                                <tr>
                                    <th onClick={() => toggleSort('value')} style={{ cursor: 'pointer' }}>IOC{sortBy === 'value' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                    <th onClick={() => toggleSort('type')} style={{ cursor: 'pointer' }}>Type{sortBy === 'type' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                    <th onClick={() => toggleSort('risk')} style={{ cursor: 'pointer' }}>Risk{sortBy === 'risk' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                    <th>Confidence</th>
                                    <th>Source</th>
                                    <th onClick={() => toggleSort('first_seen_at')} style={{ cursor: 'pointer' }}>First Seen{sortBy === 'first_seen_at' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                    <th onClick={() => toggleSort('last_seen_at')} style={{ cursor: 'pointer' }}>Last Seen{sortBy === 'last_seen_at' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                    <th>Status</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((i) => (
                                    <tr key={i.id} className="ti-row-clickable" onClick={() => setSelectedId(i.id)}>
                                        <td><span className="ti-target" title={i.value}>{i.value}</span></td>
                                        <td>{IOC_TYPE_LABELS[i.type] ?? i.type}</td>
                                        <td><RiskBadge risk={i.risk} /></td>
                                        <td><ConfidenceBadge confidence={i.confidence} /></td>
                                        <td>{(i.sources ?? []).join(', ') || '—'}</td>
                                        <td>{formatDateTime(i.first_seen_at)}</td>
                                        <td>{formatDateTime(i.last_seen_at)}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{i.status}</td>
                                        <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(i.id); }}>View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}

            {selectedId != null && <IocDetailModal id={selectedId} onClose={() => setSelectedId(null)} onOpenEntity={onOpenEntity} onInvestigate={onInvestigate} onViewNotes={onViewNotes} />}
        </div>
    );
};

export default IocListSection;
