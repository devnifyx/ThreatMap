import React, { useCallback, useEffect, useState } from 'react';
import { getMonitoringHistory, type MonitoringHistoryItem } from '../../../services/api';
import { timeAgo } from '../../../utils/timeAgo';
import { SeverityBadge } from '../MonitoringShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8

// MONITORING_CODE.md §12 — cross-monitor event feed (every monitor_events
// row, not just ones that became alerts) with search/filter/date range.
const MonitoringHistorySection: React.FC = () => {
    const [filters, setFilters] = useState({ q: '', monitorType: 'all', severity: 'all', from: '', to: '' });
    const [page, setPage] = useState(1);
    const pageSize = 30;
    const [items, setItems] = useState<MonitoringHistoryItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getMonitoringHistory({
            q: filters.q || undefined,
            monitorType: filters.monitorType !== 'all' ? filters.monitorType : undefined,
            severity: filters.severity !== 'all' ? filters.severity : undefined,
            from: filters.from || undefined, to: filters.to || undefined,
            page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load monitoring history'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.monitorType === 'all' && filters.severity === 'all' && !filters.from && !filters.to;

    return (
        <div className="mon-card">
            <div className="mon-section-header">
                <span className="mon-card-title">Monitoring History</span>
                <button type="button" className="mon-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="mon-filters">
                <input type="text" placeholder="Search target or event…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.monitorType} onChange={(e) => { setFilters((f) => ({ ...f, monitorType: e.target.value })); setPage(1); }}>
                    <option value="all">All Monitor Types</option>
                    <option value="domain">Domain</option>
                    <option value="ip">IP</option>
                    <option value="ioc">IOC</option>
                    <option value="credential">Credential</option>
                </select>
                <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }}>
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="info">Info</option>
                </select>
                <input type="date" value={filters.from} onChange={(e) => { setFilters((f) => ({ ...f, from: e.target.value })); setPage(1); }} aria-label="From date" />
                <input type="date" value={filters.to} onChange={(e) => { setFilters((f) => ({ ...f, to: e.target.value })); setPage(1); }} aria-label="To date" />
            </div>

            {error ? (
                <div className="mon-error">{error}<button type="button" className="mon-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="mon-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="mon-empty">{filtersAreDefault ? 'No monitoring history yet.' : 'No events match these filters.'}</div>
            ) : (
                <>
                    <div className="mon-table-wrap">
                        <table className="mon-table">
                            <thead>
                                <tr><th>Time</th><th>Monitor</th><th>Target</th><th>Event</th><th>Severity</th></tr>
                            </thead>
                            <tbody>
                                {items.map((e) => (
                                    <tr key={e.id}>
                                        <td>{e.created_at ? timeAgo(e.created_at) : '—'}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{e.monitor_type}</td>
                                        <td><span className="mon-target" title={e.monitor_target}>{e.monitor_target}</span></td>
                                        <td>{e.summary}</td>
                                        <td><SeverityBadge severity={e.severity} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="mon" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}
        </div>
    );
};

export default MonitoringHistorySection;
