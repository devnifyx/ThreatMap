import React, { useCallback, useEffect, useState } from 'react';
import { getIntelligenceHistory, type IntelligenceHistoryItem } from '../../../services/api';
import { EntityChip, formatDateTime } from '../ThreatIntelligenceShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8

const ENTITY_TYPES = ['ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability', 'attack_technique', 'report', 'workspace'];
const ACTIONS = ['created', 'updated', 'risk_changed', 'published', 'assessed', 'added_to_workspace', 'removed_from_workspace', 'added_to_watchlist'];

interface Props {
    onOpenEntity?: (type: string, id: string) => void;
}

const ACTION_LABELS: Record<string, string> = {
    created: 'Created', updated: 'Updated', risk_changed: 'Risk Changed', published: 'Published',
    assessed: 'Assessed', added_to_workspace: 'Added to Workspace', removed_from_workspace: 'Removed from Workspace',
    added_to_watchlist: 'Added to Watchlist'
};

const IntelligenceHistorySection: React.FC<Props> = ({ onOpenEntity }) => {
    const [filters, setFilters] = useState({ q: '', entityType: 'all', action: 'all', source: '', dateFrom: '', dateTo: '' });
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [items, setItems] = useState<IntelligenceHistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getIntelligenceHistory({
            q: filters.q || undefined, entityType: filters.entityType !== 'all' ? filters.entityType : undefined,
            action: filters.action !== 'all' ? filters.action : undefined, source: filters.source || undefined,
            dateFrom: filters.dateFrom || undefined, dateTo: filters.dateTo || undefined, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load intelligence history'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.entityType === 'all' && filters.action === 'all' && !filters.source && !filters.dateFrom && !filters.dateTo;

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Intelligence History</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="ti-filters">
                <input type="text" placeholder="Search entity…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.entityType} onChange={(e) => { setFilters((f) => ({ ...f, entityType: e.target.value })); setPage(1); }}>
                    <option value="all">All Entity Types</option>
                    {ENTITY_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={filters.action} onChange={(e) => { setFilters((f) => ({ ...f, action: e.target.value })); setPage(1); }}>
                    <option value="all">All Actions</option>
                    {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
                </select>
                <input type="text" placeholder="Source…" value={filters.source} onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setPage(1); }} style={{ minWidth: '110px', flex: 'initial' }} />
                <input type="date" value={filters.dateFrom} onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }} aria-label="From" />
                <input type="date" value={filters.dateTo} onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }} aria-label="To" />
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No history recorded yet.' : 'No history entries match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Entity</th><th>Action</th><th>Previous</th><th>New</th><th>Source</th><th>User</th><th>When</th></tr></thead>
                            <tbody>
                                {items.map((h) => (
                                    <tr key={h.id}>
                                        <td><EntityChip entity={h.entity} onOpen={onOpenEntity} /></td>
                                        <td>{ACTION_LABELS[h.action] ?? h.action}</td>
                                        <td className="ti-note" title={h.previous_value ?? undefined}>{h.previous_value ? (h.previous_value.length > 30 ? h.previous_value.slice(0, 30) + '…' : h.previous_value) : '—'}</td>
                                        <td className="ti-note" title={h.new_value ?? undefined}>{h.new_value ? (h.new_value.length > 30 ? h.new_value.slice(0, 30) + '…' : h.new_value) : '—'}</td>
                                        <td>{h.source}</td>
                                        <td>{h.username ?? 'system'}</td>
                                        <td>{formatDateTime(h.created_at)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}
        </div>
    );
};

export default IntelligenceHistorySection;
