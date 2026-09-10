import React, { useCallback, useEffect, useState } from 'react';
import { getCampaigns, getCampaign, type Campaign, type CampaignDetail } from '../../../services/api';
import { RiskBadge, ConfidenceBadge, formatDate, formatDateTime, IOC_TYPE_LABELS, InvestigateButton } from '../ThreatIntelligenceShared';
import KnowledgeContextPanel from '../../KnowledgeBase/KnowledgeContextPanel';
import Pagination from '../../../components/shared/Pagination';  // P2-8

const CampaignDetailModal: React.FC<{
    id: number; onClose: () => void; onInvestigate?: (target: string, tab?: string) => void; onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
}> = ({ id, onClose, onInvestigate, onCreateThreatBrief, onOpenKnowledgeEntry, onCreateKnowledgeEntry, onViewNotes }) => {
    const [campaign, setCampaign] = useState<CampaignDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getCampaign(id).then(setCampaign).catch((err) => setError(err?.message || 'Failed to load campaign')).finally(() => setLoading(false));
    }, [id]);

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Campaign detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal">
                <div className="ti-modal-header">
                    <h2>{campaign?.name ?? 'Campaign'}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !campaign ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            <div className="ti-kv">
                                <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{campaign.status}</span>
                                <span className="k">Risk</span><span className="v"><RiskBadge risk={campaign.severity} /></span>
                                <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={campaign.confidence} /></span>
                                <span className="k">Source</span><span className="v" style={{ textTransform: 'capitalize' }}>{campaign.source_type.replace(/_/g, ' ')}</span>
                                <span className="k">First Seen</span><span className="v">{formatDate(campaign.first_seen_at)}</span>
                                <span className="k">Last Activity</span><span className="v">{formatDate(campaign.last_seen_at)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <InvestigateButton target={campaign.name} onInvestigate={onInvestigate} />
                                {/* THREAT_BRIEF_PHASE2.md §4 example: "Campaign → Create Threat Brief → Campaign context automatically attached" */}
                                {onCreateThreatBrief && (
                                    <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={() => onCreateThreatBrief('campaign', String(campaign.id))}>
                                        Create Threat Brief
                                    </button>
                                )}
                                {onViewNotes && (
                                    <button type="button" className="ti-action-btn" onClick={() => onViewNotes('campaign', String(campaign.id), campaign.name)}>
                                        View Notes
                                    </button>
                                )}
                            </div>
                            {campaign.description && <div className="ti-note">{campaign.description}</div>}

                            <div>
                                <div className="ti-modal-subtitle">Infrastructure / IOCs ({campaign.iocs.length})</div>
                                {campaign.iocs.length === 0 ? <div className="ti-empty">None linked yet.</div> : (
                                    <div className="ti-chip-list">
                                        {campaign.iocs.slice(0, 40).map((i) => (
                                            <span key={i.id} className="ti-chip" title={IOC_TYPE_LABELS[i.type] ?? i.type}>{i.value}</span>
                                        ))}
                                        {campaign.iocs.length > 40 && <span className="ti-note">+{campaign.iocs.length - 40} more</span>}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">MITRE ATT&CK Techniques ({campaign.techniques.length})</div>
                                {campaign.techniques.length === 0 ? <div className="ti-empty">No techniques mapped yet.</div> : (
                                    <div className="ti-chip-list">
                                        {campaign.techniques.map((t) => <span key={t.technique_id} className="ti-chip">{t.technique_id} · {t.name}</span>)}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Timeline ({campaign.timeline.length})</div>
                                {campaign.timeline.length === 0 ? <div className="ti-empty">No timeline events yet.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {campaign.timeline.map((e) => (
                                            <div key={e.id} style={{ display: 'flex', gap: '10px', padding: '5px 0' }}>
                                                <span className="ti-note" style={{ flexShrink: 0 }}>{formatDate(e.occurred_at)}</span>
                                                <span style={{ fontSize: '0.85rem' }}>{e.summary}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Related Investigations ({campaign.relatedInvestigations.length})</div>
                                {campaign.relatedInvestigations.length === 0 ? <div className="ti-empty">None.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {campaign.relatedInvestigations.map((r) => (
                                            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                                <span style={{ fontSize: '0.85rem', flex: 1, textTransform: 'capitalize' }}>{r.module.replace(/-/g, ' ')} · {r.target}</span>
                                                <RiskBadge risk={r.risk_level} />
                                                <span className="ti-note">{formatDateTime(r.created_at)}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* KNOWLEDGE_BASE_PHASE2.md §16 "KNOWLEDGE TO CAMPAIGN" (§20 generic pattern) */}
                            <KnowledgeContextPanel entityType="campaign" entityId={campaign.id} entityLabel={campaign.name} defaultCategory="Campaign"
                                onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

interface CampaignsSectionProps {
    openEntityId?: string | null;
    onEntityOpened?: () => void;
    onInvestigate?: (target: string, tab?: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
}

const CampaignsSection: React.FC<CampaignsSectionProps> = ({ openEntityId, onEntityOpened, onInvestigate, onCreateThreatBrief, onOpenKnowledgeEntry, onCreateKnowledgeEntry, onViewNotes }) => {
    const [filters, setFilters] = useState({ q: '', status: 'all', severity: 'all', confidence: 'all', dateFrom: '', dateTo: '' });
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<Campaign[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (openEntityId) { setSelectedId(Number(openEntityId)); onEntityOpened?.(); }
    }, [openEntityId, onEntityOpened]);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getCampaigns({
            q: filters.q || undefined, status: filters.status !== 'all' ? filters.status : undefined,
            severity: filters.severity !== 'all' ? filters.severity : undefined, confidence: filters.confidence !== 'all' ? filters.confidence : undefined,
            dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load campaigns'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.status === 'all' && filters.severity === 'all' && filters.confidence === 'all' && !filters.dateFrom && !filters.dateTo;

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Campaigns</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="ti-filters">
                <input type="text" placeholder="Search name…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option><option value="dormant">Dormant</option><option value="closed">Closed</option>
                </select>
                <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }}>
                    <option value="all">All Risk</option>
                    <option value="Critical">Critical</option><option value="High">High</option>
                    <option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <select value={filters.confidence} onChange={(e) => { setFilters((f) => ({ ...f, confidence: e.target.value })); setPage(1); }}>
                    <option value="all">All Confidence</option>
                    <option value="Confirmed">Confirmed</option><option value="High">High</option>
                    <option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} aria-label="First seen from" />
                <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} aria-label="First seen to" />
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No active campaigns.' : 'No campaigns match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead>
                                <tr><th>Campaign</th><th>Status</th><th>Risk</th><th>Confidence</th><th>First Seen</th><th>Last Activity</th><th>IOCs</th><th>Techniques</th><th>Action</th></tr>
                            </thead>
                            <tbody>
                                {items.map((c) => (
                                    <tr key={c.id} className="ti-row-clickable" onClick={() => setSelectedId(c.id)}>
                                        <td><span className="ti-target" title={c.name}>{c.name}</span></td>
                                        <td style={{ textTransform: 'capitalize' }}>{c.status}</td>
                                        <td><RiskBadge risk={c.severity} /></td>
                                        <td><ConfidenceBadge confidence={c.confidence} /></td>
                                        <td>{formatDate(c.first_seen_at)}</td>
                                        <td>{formatDate(c.last_seen_at)}</td>
                                        <td>{c.ioc_count ?? 0}</td>
                                        <td>{c.technique_count ?? 0}</td>
                                        <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(c.id); }}>View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}

            {selectedId != null && <CampaignDetailModal id={selectedId} onClose={() => setSelectedId(null)} onInvestigate={onInvestigate} onCreateThreatBrief={onCreateThreatBrief} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} onViewNotes={onViewNotes} />}
        </div>
    );
};

export default CampaignsSection;
