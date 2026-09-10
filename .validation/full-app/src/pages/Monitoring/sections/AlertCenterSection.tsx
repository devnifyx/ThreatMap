import React, { useCallback, useEffect, useState } from 'react';
import { getAlerts, updateAlertStatus, findCaseForAlert, type Alert } from '../../../services/api';
import { timeAgo } from '../../../utils/timeAgo';
import { SeverityBadge } from '../MonitoringShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8

// MONITORING_CODE.md §10 — every meaningful monitoring event flows into
// this list (services/monitoring/scheduler.js writes here via
// createAlertIfNotDuplicate whenever a checker reports a non-info-severity
// change). Status workflow matches §10's own six states exactly.
const STATUS_OPTIONS: Alert['status'][] = ['new', 'acknowledged', 'investigating', 'resolved', 'false_positive', 'suppressed'];
const STATUS_LABELS: Record<Alert['status'], string> = {
    new: 'New', acknowledged: 'Acknowledged', investigating: 'Investigating',
    resolved: 'Resolved', false_positive: 'False Positive', suppressed: 'Suppressed'
};

interface AlertCenterSectionProps {
    // INVESTIGATIONS_PHASE1.md §60 — [Investigate] button on each alert row
    // calls findCaseForAlert; if a case exists, opens it, otherwise navigates
    // to the Cases list where the analyst can create one for this alert.
    onOpenCase?: (caseId: number) => void;
    onNavigateToCases?: () => void;
}

const AlertCenterSection: React.FC<AlertCenterSectionProps> = ({ onOpenCase, onNavigateToCases }) => {
    const [filters, setFilters] = useState({ severity: 'all', status: 'all', q: '' });
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<Alert[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [investigatingId, setInvestigatingId] = useState<number | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getAlerts({
            severity: filters.severity !== 'all' ? filters.severity : undefined,
            status: filters.status !== 'all' ? filters.status : undefined,
            q: filters.q || undefined, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load alerts'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const setStatus = async (id: number, status: Alert['status']) => {
        setBusyId(id);
        const prev = items;
        setItems((cur) => cur.map((a) => (a.id === id ? { ...a, status } : a)));
        try {
            await updateAlertStatus(id, status);
        } catch {
            setItems(prev);
        } finally {
            setBusyId(null);
        }
    };

    // INVESTIGATIONS_PHASE1.md §60 — reuse-or-create flow for the alert's
    // case: findCaseForAlert returns the existing case id (if any); with a
    // case we jump straight into it, otherwise the analyst lands on the
    // Cases list ready to create one for this alert.
    const investigateAlert = async (alertId: number) => {
        setInvestigatingId(alertId);
        try {
            const found = await findCaseForAlert(alertId);
            if (found?.id && onOpenCase) onOpenCase(found.id);
            else onNavigateToCases?.();
        } catch {
            // findCaseForAlert 404s when no case references this alert yet —
            // that's the normal "create one" path, not an error state.
            onNavigateToCases?.();
        } finally {
            setInvestigatingId(null);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = filters.severity === 'all' && filters.status === 'all' && !filters.q;

    return (
        <div className="mon-card">
            <div className="mon-section-header">
                <span className="mon-card-title">Alert Center</span>
                <button type="button" className="mon-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            <div className="mon-filters">
                <input type="text" placeholder="Search title or target…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }}>
                    <option value="all">All Severity</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                </select>
            </div>

            {error ? (
                <div className="mon-error">{error}<button type="button" className="mon-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="mon-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="mon-empty">{filtersAreDefault ? 'No alerts yet.' : 'No alerts match these filters.'}</div>
            ) : (
                <>
                    <div className="mon-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {items.map((a) => (
                            <div key={a.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                                    <SeverityBadge severity={a.severity} />
                                    <div style={{ flex: 1, minWidth: '200px' }}>
                                        <div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{a.title}</div>
                                        <div className="mon-note">{a.source} · {a.target}</div>
                                    </div>
                                    <select
                                        className="mon-status-select"
                                        value={a.status}
                                        disabled={busyId === a.id}
                                        onChange={(e) => setStatus(a.id, e.target.value as Alert['status'])}
                                        aria-label={`Change status for ${a.title}`}
                                    >
                                        {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                    </select>
                                    {(onOpenCase || onNavigateToCases) && (
                                        <button
                                            type="button"
                                            className="mon-refresh-btn"
                                            style={{ whiteSpace: 'nowrap' }}
                                            disabled={investigatingId === a.id}
                                            onClick={() => investigateAlert(a.id)}
                                        >
                                            {investigatingId === a.id ? '…' : 'Investigate'}
                                        </button>
                                    )}
                                    <span className="mon-note">{a.created_at ? timeAgo(a.created_at) : ''}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Pagination prefix="mon" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}
        </div>
    );
};

export default AlertCenterSection;
