import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import JsonViewer from '../../../components/JsonViewer';
import { timeAgo } from '../../../utils/timeAgo';
import {
    getInvestigationOverview, getInvestigationCriticalFindings, getInvestigationQueue,
    getRecentInvestigations, getInvestigationActivity, getInvestigationStatistics,
    updateOsintInvestigationStatus, getHistoryOsint, getUserHistoryOsint,
    getHistoryOsintDetails, getUserHistoryOsintDetails, deleteHistoryOsint, deleteUserHistoryOsint,
    type InvestigationOverview, type InvestigationListItem, type InvestigationActivityItem,
    type InvestigationQueueJob, type InvestigationStatistics,
} from '../../../services/api';
import './InvestigationDashboardHome.css';
import Pagination from '../../../components/shared/Pagination';  // P2-8

// ─── shared bits ──────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
    open: 'Open',
    in_progress: 'In Progress',
    resolved: 'Resolved',
    false_positive: 'False Positive',
};
const STATUS_ORDER = ['open', 'in_progress', 'resolved', 'false_positive'];
const STATUS_COLORS: Record<string, string> = {
    open: '#58a6ff',
    in_progress: '#d29922',
    resolved: '#3fb950',
    false_positive: '#8b949e',
};

const TYPE_OPTIONS = [
    { value: 'all', label: 'All Types' },
    { value: 'username', label: 'Username' },
    { value: 'name', label: 'Name' },
    { value: 'email', label: 'Email' },
    { value: 'phone', label: 'Phone' },
    { value: 'phishing', label: 'Phishing' },
    { value: 'credential', label: 'Credential' },
    { value: 'dorking', label: 'Dorking' },
    { value: 'asset', label: 'Asset' },
    { value: 'geo', label: 'Geo' },
    { value: 'code', label: 'Code' },
    { value: 'osint', label: 'Other' },
];

function RiskBadge({ risk }: { risk: string | null }) {
    if (!risk) return <span className="invdash-risk-badge invdash-risk-badge--none">—</span>;
    return <span className={`invdash-risk-badge invdash-risk-badge--${risk.toLowerCase()}`}>{risk}</span>;
}

function KindBadge({ module }: { module: string }) {
    return <span className="invdash-kind-badge">{module}</span>;
}

interface InvestigationDashboardHomeProps {
    isAdmin: boolean;
    modules: { id: string; name: string; implemented: boolean }[];
    moduleSlugMap: Record<string, string>;
    onNavigateToModule: (moduleId: string, target?: string) => void;
}

function useTabIdBySlug(moduleSlugMap: Record<string, string>) {
    return useMemo(() => {
        const map = new Map<string, string>();
        for (const [tabId, slug] of Object.entries(moduleSlugMap)) map.set(slug, tabId);
        return map;
    }, [moduleSlugMap]);
}

const InvestigationDashboardHome: React.FC<InvestigationDashboardHomeProps> = ({ isAdmin, modules, moduleSlugMap, onNavigateToModule }) => {
    const tabIdBySlug = useTabIdBySlug(moduleSlugMap);

    const resolveModuleTarget = useCallback((moduleSlug: string): string | undefined => {
        return tabIdBySlug.get(moduleSlug);
    }, [tabIdBySlug]);

    // ── 7a. Overview ──────────────────────────────────────────────────────
    const [overview, setOverview] = useState<InvestigationOverview | null>(null);
    const [overviewLoading, setOverviewLoading] = useState(true);
    const [overviewError, setOverviewError] = useState<string | null>(null);

    const loadOverview = useCallback(() => {
        setOverviewLoading(true);
        setOverviewError(null);
        getInvestigationOverview()
            .then((d) => setOverview(d))
            .catch((err) => setOverviewError(err?.message || 'Failed to load overview'))
            .finally(() => setOverviewLoading(false));
    }, []);
    useEffect(() => { loadOverview(); }, [loadOverview]);

    // ── 7b. Active Investigations (extended existing history/osint endpoint) ─
    const [filters, setFilters] = useState({
        q: '', type: 'all', risk: 'all', status: 'all', analyst: '', from: '', to: '',
    });
    const [sortBy, setSortBy] = useState<'created_at' | 'risk_level' | 'module' | 'status'>('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [tableItems, setTableItems] = useState<any[]>([]);
    const [tableTotal, setTableTotal] = useState(0);
    const [tableLoading, setTableLoading] = useState(true);
    const [tableError, setTableError] = useState<string | null>(null);
    const [statusBusyId, setStatusBusyId] = useState<number | null>(null);

    // Debounced search — 300ms, same convention as FindingsFeedPage.tsx.
    const [qInput, setQInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => {
            setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [qInput]);

    const loadTable = useCallback(() => {
        setTableLoading(true);
        setTableError(null);
        const params = {
            q: filters.q || undefined,
            type: filters.type !== 'all' ? filters.type : undefined,
            risk: filters.risk !== 'all' ? filters.risk : undefined,
            status: filters.status !== 'all' ? filters.status : undefined,
            analyst: filters.analyst || undefined,
            from: filters.from || undefined,
            to: filters.to || undefined,
            sortBy, sortDir, page, pageSize,
        };
        const fn = isAdmin ? getHistoryOsint : getUserHistoryOsint;
        fn(params)
            .then((res: any) => {
                setTableItems(res.items ?? []);
                setTableTotal(res.total ?? 0);
            })
            .catch((err: any) => setTableError(err?.message || 'Failed to load investigations'))
            .finally(() => setTableLoading(false));
    }, [filters, sortBy, sortDir, page, isAdmin]);
    useEffect(() => { loadTable(); }, [loadTable]);

    const tableTotalPages = Math.max(1, Math.ceil(tableTotal / pageSize));
    const filtersAreDefault = !filters.q && filters.type === 'all' && filters.risk === 'all'
        && filters.status === 'all' && !filters.analyst && !filters.from && !filters.to;

    const setFilter = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) => {
        setFilters((f) => ({ ...f, [key]: value }));
        setPage(1);
    };

    const toggleSort = (col: typeof sortBy) => {
        if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(col); setSortDir('desc'); }
        setPage(1);
    };

    const applyKpiFilter = (patch: Partial<typeof filters>) => {
        setFilters((f) => ({ ...f, type: 'all', risk: 'all', status: 'all', analyst: '', ...patch }));
        setPage(1);
    };

    // ── status change (optimistic, with rollback) ─────────────────────────
    const handleStatusChange = useCallback(async (id: number, newStatus: string) => {
        const prevItems = tableItems;
        setTableItems((items) => items.map((it) => (it.id === id ? { ...it, status: newStatus } : it)));
        setStatusBusyId(id);
        try {
            await updateOsintInvestigationStatus(id, newStatus, isAdmin);
        } catch (err) {
            setTableItems(prevItems); // rollback
        } finally {
            setStatusBusyId(null);
        }
    }, [tableItems, isAdmin]);

    // ── detail view ("View" / "Investigate") ───────────────────────────────
    const [detailId, setDetailId] = useState<number | null>(null);
    const [detail, setDetail] = useState<any | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [detailError, setDetailError] = useState<string | null>(null);

    const openDetail = useCallback((id: number) => {
        setDetailId(id);
        setDetail(null);
        setDetailError(null);
        setDetailLoading(true);
        const fn = isAdmin ? getHistoryOsintDetails : getUserHistoryOsintDetails;
        fn(id)
            .then((res: any) => setDetail(res.data))
            .catch((err: any) => setDetailError(err?.message || 'Failed to load investigation detail'))
            .finally(() => setDetailLoading(false));
    }, [isAdmin]);
    const closeDetail = useCallback(() => { setDetailId(null); setDetail(null); setDetailError(null); }, []);

    // ── delete (confirm required, §18) ─────────────────────────────────────
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const confirmDeleteTarget = tableItems.find((it) => it.id === confirmDeleteId)?.target
        ?? (detail && detail.id === confirmDeleteId ? detail.target : null);

    const runDelete = useCallback(async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        try {
            const fn = isAdmin ? deleteHistoryOsint : deleteUserHistoryOsint;
            await fn(confirmDeleteId);
            setTableItems((items) => items.filter((it) => it.id !== confirmDeleteId));
            setTableTotal((t) => Math.max(0, t - 1));
            if (detailId === confirmDeleteId) closeDetail();
            setConfirmDeleteId(null);
            loadOverview();
        } catch {
            // leave the dialog open with the row intact — user can retry or cancel
        } finally {
            setDeleting(false);
        }
    }, [confirmDeleteId, isAdmin, detailId, closeDetail, loadOverview]);

    const continueInvestigation = useCallback((moduleSlug: string, target: string) => {
        const tabId = resolveModuleTarget(moduleSlug);
        if (!tabId) return;
        onNavigateToModule(tabId, tabId === 'brand-intel' ? undefined : target);
    }, [resolveModuleTarget, onNavigateToModule]);

    // ── 7c. Critical Findings ──────────────────────────────────────────────
    const [critical, setCritical] = useState<InvestigationListItem[] | null>(null);
    const [criticalLoading, setCriticalLoading] = useState(true);
    const [criticalError, setCriticalError] = useState<string | null>(null);
    const loadCritical = useCallback(() => {
        setCriticalLoading(true);
        setCriticalError(null);
        getInvestigationCriticalFindings(10)
            .then(setCritical)
            .catch((err) => setCriticalError(err?.message || 'Failed to load critical findings'))
            .finally(() => setCriticalLoading(false));
    }, []);
    useEffect(() => { loadCritical(); }, [loadCritical]);

    // ── 7d. Investigation Queue ─────────────────────────────────────────────
    const [queue, setQueue] = useState<{ available: boolean; jobs: InvestigationQueueJob[] } | null>(null);
    const [queueLoading, setQueueLoading] = useState(true);
    const [queueError, setQueueError] = useState<string | null>(null);
    const loadQueue = useCallback(() => {
        setQueueLoading(true);
        setQueueError(null);
        getInvestigationQueue()
            .then(setQueue)
            .catch((err) => setQueueError(err?.message || 'Failed to load investigation queue'))
            .finally(() => setQueueLoading(false));
    }, []);
    useEffect(() => { loadQueue(); }, [loadQueue]);

    // ── 7e. Recent Investigations ───────────────────────────────────────────
    const [recent, setRecent] = useState<InvestigationListItem[] | null>(null);
    const [recentLoading, setRecentLoading] = useState(true);
    const [recentError, setRecentError] = useState<string | null>(null);
    const loadRecent = useCallback(() => {
        setRecentLoading(true);
        setRecentError(null);
        getRecentInvestigations(15)
            .then(setRecent)
            .catch((err) => setRecentError(err?.message || 'Failed to load recent investigations'))
            .finally(() => setRecentLoading(false));
    }, []);
    useEffect(() => { loadRecent(); }, [loadRecent]);

    // ── 7f. Investigation Activity ─────────────────────────────────────────
    const [activity, setActivity] = useState<InvestigationActivityItem[] | null>(null);
    const [activityLoading, setActivityLoading] = useState(true);
    const [activityError, setActivityError] = useState<string | null>(null);
    const loadActivity = useCallback(() => {
        setActivityLoading(true);
        setActivityError(null);
        getInvestigationActivity(30)
            .then(setActivity)
            .catch((err) => setActivityError(err?.message || 'Failed to load investigation activity'))
            .finally(() => setActivityLoading(false));
    }, []);
    useEffect(() => { loadActivity(); }, [loadActivity]);

    // ── 7g. Investigation Statistics ────────────────────────────────────────
    const [stats, setStats] = useState<InvestigationStatistics | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);
    const [statsError, setStatsError] = useState<string | null>(null);
    const loadStats = useCallback(() => {
        setStatsLoading(true);
        setStatsError(null);
        getInvestigationStatistics()
            .then(setStats)
            .catch((err) => setStatsError(err?.message || 'Failed to load investigation statistics'))
            .finally(() => setStatsLoading(false));
    }, []);
    useEffect(() => { loadStats(); }, [loadStats]);

    const quickActionModules = useMemo(
        () => modules.filter((m) => m.implemented && m.id !== 'dashboard'),
        [modules]
    );

    return (
        <div className="invdash">
            {/* 7a. Investigation Overview */}
            <section className="invdash-section" aria-label="Investigation overview">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Investigation Overview</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadOverview} disabled={overviewLoading}>
                        {overviewLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {overviewError ? (
                    <div className="invdash-error">
                        {overviewError}
                        <button type="button" className="invdash-retry-btn" onClick={loadOverview}>Retry</button>
                    </div>
                ) : (
                    <div className="invdash-kpi-row">
                        <button type="button" className="invdash-kpi-card" onClick={() => applyKpiFilter({ status: 'active' })}>
                            <div className="invdash-kpi-value">{overview ? overview.active.toLocaleString() : '—'}</div>
                            <div className="invdash-kpi-label">Active Investigations</div>
                        </button>
                        <button type="button" className="invdash-kpi-card" onClick={() => applyKpiFilter({ risk: 'Critical' })}>
                            <div className="invdash-kpi-value invdash-kpi-value--critical">{overview ? overview.critical.toLocaleString() : '—'}</div>
                            <div className="invdash-kpi-label">Critical</div>
                        </button>
                        <button type="button" className="invdash-kpi-card" onClick={() => applyKpiFilter({ risk: 'High' })}>
                            <div className="invdash-kpi-value invdash-kpi-value--high">{overview ? overview.high.toLocaleString() : '—'}</div>
                            <div className="invdash-kpi-label">High</div>
                        </button>
                        <button type="button" className="invdash-kpi-card" onClick={() => applyKpiFilter({ status: 'in_progress' })}>
                            <div className="invdash-kpi-value">{overview ? overview.inProgress.toLocaleString() : '—'}</div>
                            <div className="invdash-kpi-label">In Progress</div>
                        </button>
                        <button type="button" className="invdash-kpi-card" onClick={() => applyKpiFilter({ status: 'resolved' })}>
                            <div className="invdash-kpi-value">{overview ? overview.completed.toLocaleString() : '—'}</div>
                            <div className="invdash-kpi-label">Completed</div>
                        </button>
                    </div>
                )}
            </section>

            {/* 7b. Active Investigations */}
            <section className="invdash-section" aria-label="Active investigations">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Active Investigations</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadTable} disabled={tableLoading}>
                        {tableLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>

                <div className="invdash-filters">
                    <input
                        type="text"
                        placeholder="Search target, module, analyst…"
                        value={qInput}
                        onChange={(e) => setQInput(e.target.value)}
                        aria-label="Search investigations"
                    />
                    <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)} aria-label="Filter by type">
                        {TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <select value={filters.risk} onChange={(e) => setFilter('risk', e.target.value)} aria-label="Filter by risk">
                        <option value="all">All Risk</option>
                        <option value="Critical">Critical</option>
                        <option value="High">High</option>
                        <option value="Medium">Medium</option>
                        <option value="Low">Low</option>
                    </select>
                    <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)} aria-label="Filter by status">
                        <option value="all">All Status</option>
                        {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                    </select>
                    <input
                        type="text"
                        placeholder="Analyst"
                        value={filters.analyst}
                        onChange={(e) => setFilter('analyst', e.target.value)}
                        aria-label="Filter by analyst"
                        style={{ minWidth: 100, flex: 'initial', width: 120 }}
                    />
                    <input type="date" value={filters.from} onChange={(e) => setFilter('from', e.target.value)} aria-label="From date" />
                    <input type="date" value={filters.to} onChange={(e) => setFilter('to', e.target.value)} aria-label="To date" />
                </div>

                {tableError ? (
                    <div className="invdash-error">
                        {tableError}
                        <button type="button" className="invdash-retry-btn" onClick={loadTable}>Retry</button>
                    </div>
                ) : tableLoading ? (
                    <div className="invdash-loading">Loading investigations…</div>
                ) : tableItems.length === 0 ? (
                    <div className="invdash-empty">
                        {filtersAreDefault ? 'No investigations yet.' : 'No investigations match these filters.'}
                    </div>
                ) : (
                    <>
                        <div className="invdash-table-wrap">
                            <table className="invdash-table">
                                <thead>
                                    <tr>
                                        <th>Investigation</th>
                                        <th>Target</th>
                                        <th><button type="button" onClick={() => toggleSort('module')}>Type {sortBy === 'module' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                        <th><button type="button" onClick={() => toggleSort('risk_level')}>Risk {sortBy === 'risk_level' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                        <th>Analyst</th>
                                        <th><button type="button" onClick={() => toggleSort('status')}>Status {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                        <th><button type="button" onClick={() => toggleSort('created_at')}>Last Updated {sortBy === 'created_at' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableItems.map((it) => (
                                        <tr key={it.id}>
                                            {/* osint_activity has no separate title — Investigation shows the
                                                same target value as the Target column (§7b's note). */}
                                            <td><span className="invdash-target" title={it.target}>{it.target}</span></td>
                                            <td><span className="invdash-target" title={it.target}>{it.target}</span></td>
                                            <td><KindBadge module={it.module} /></td>
                                            <td><RiskBadge risk={it.risk_level} /></td>
                                            <td>{it.username || '—'}</td>
                                            <td>
                                                <select
                                                    className={`invdash-status-select invdash-status-select--${it.status}`}
                                                    value={it.status}
                                                    disabled={statusBusyId === it.id}
                                                    onChange={(e) => handleStatusChange(it.id, e.target.value)}
                                                    aria-label={`Change status for ${it.target}`}
                                                >
                                                    {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
                                                </select>
                                            </td>
                                            <td>{it.created_at ? timeAgo(it.created_at) : '—'}</td>
                                            <td>
                                                <div className="invdash-row-actions">
                                                    <button type="button" className="invdash-action-btn" onClick={() => openDetail(it.id)}>View</button>
                                                    {/* Only shown when the row's module slug maps back to a real
                                                        OsintPage tab — e.g. Web-Check-only sub-modules like
                                                        'alias-finder' have nowhere to route to. */}
                                                    {resolveModuleTarget(it.module) && (
                                                        <button type="button" className="invdash-action-btn" onClick={() => continueInvestigation(it.module, it.target)}>Continue</button>
                                                    )}
                                                    <button type="button" className="invdash-action-btn invdash-action-btn--danger" onClick={() => setConfirmDeleteId(it.id)}>Delete</button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination prefix="invdash" page={page} totalPages={tableTotalPages} total={tableTotal} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} nextDisabled={page >= tableTotalPages} />
                    </>
                )}
            </section>

            {/* 7c. Critical Findings */}
            <section className="invdash-section" aria-label="Critical findings">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Critical Findings</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadCritical} disabled={criticalLoading}>
                        {criticalLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {criticalError ? (
                    <div className="invdash-error">{criticalError}<button type="button" className="invdash-retry-btn" onClick={loadCritical}>Retry</button></div>
                ) : criticalLoading ? (
                    <div className="invdash-loading">Loading critical findings…</div>
                ) : !critical || critical.length === 0 ? (
                    <div className="invdash-empty">No critical findings.</div>
                ) : (
                    <div className="invdash-list">
                        {critical.map((c) => (
                            <button key={c.id} type="button" className="invdash-list-row" onClick={() => openDetail(c.id)}>
                                <RiskBadge risk={c.risk_level} />
                                <span className="invdash-list-target" title={c.target}>{c.target}</span>
                                <span className="invdash-list-actor">{c.module}</span>
                                <span className="invdash-list-time">{c.created_at ? timeAgo(c.created_at) : '—'}</span>
                                <span className="invdash-action-btn">Investigate</span>
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* 7d. Investigation Queue */}
            <section className="invdash-section" aria-label="Investigation queue">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Investigation Queue</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadQueue} disabled={queueLoading}>
                        {queueLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {queueError ? (
                    <div className="invdash-error">{queueError}<button type="button" className="invdash-retry-btn" onClick={loadQueue}>Retry</button></div>
                ) : queueLoading ? (
                    <div className="invdash-loading">Loading queue…</div>
                ) : !queue?.available ? (
                    <div className="invdash-empty">Brand Intelligence queue not installed.</div>
                ) : queue.jobs.length === 0 ? (
                    <div className="invdash-empty">No active jobs.</div>
                ) : (
                    <div className="invdash-queue-list">
                        {queue.jobs.map((j) => {
                            const pct = j.progress_total > 0 ? Math.min(100, Math.round((j.progress_current / j.progress_total) * 100)) : 0;
                            return (
                                <div className="invdash-queue-job" key={j.id}>
                                    <div className="invdash-queue-job-head">
                                        <span className="invdash-queue-job-brand">{j.brand_name}</span>
                                        <span className="invdash-queue-job-status">{j.status}</span>
                                    </div>
                                    <div className="invdash-progress-track">
                                        <div className="invdash-progress-fill" style={{ width: `${pct}%` }} />
                                    </div>
                                    <div className="invdash-progress-label">
                                        {j.progress_total > 0 ? `${j.progress_current} / ${j.progress_total} (${pct}%)` : 'Starting…'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>

            {/* 7e. Recent Investigations */}
            <section className="invdash-section" aria-label="Recent investigations">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Recent Investigations</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadRecent} disabled={recentLoading}>
                        {recentLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {recentError ? (
                    <div className="invdash-error">{recentError}<button type="button" className="invdash-retry-btn" onClick={loadRecent}>Retry</button></div>
                ) : recentLoading ? (
                    <div className="invdash-loading">Loading recent investigations…</div>
                ) : !recent || recent.length === 0 ? (
                    <div className="invdash-empty">No recent investigations.</div>
                ) : (
                    <div className="invdash-list">
                        {recent.map((r) => (
                            <button key={r.id} type="button" className="invdash-list-row" onClick={() => openDetail(r.id)}>
                                <RiskBadge risk={r.risk_level} />
                                <span className="invdash-list-target" title={r.target}>{r.target}</span>
                                <span className="invdash-list-actor">{r.module}</span>
                                <span className="invdash-list-time">{r.created_at ? timeAgo(r.created_at) : '—'}</span>
                                <span />
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* 7f. Investigation Activity */}
            <section className="invdash-section" aria-label="Recent activity">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Recent Activity</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadActivity} disabled={activityLoading}>
                        {activityLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {activityError ? (
                    <div className="invdash-error">{activityError}<button type="button" className="invdash-retry-btn" onClick={loadActivity}>Retry</button></div>
                ) : activityLoading ? (
                    <div className="invdash-loading">Loading activity…</div>
                ) : !activity || activity.length === 0 ? (
                    <div className="invdash-empty">No recent investigation activity.</div>
                ) : (
                    <div className="invdash-list">
                        {activity.map((a) => (
                            <button key={a.id} type="button" className="invdash-list-row" onClick={() => openDetail(a.id)}>
                                <RiskBadge risk={a.risk_level} />
                                <span className="invdash-list-target" title={a.target}>{a.target}</span>
                                <span className="invdash-list-actor">{a.username || a.actor}</span>
                                <span className="invdash-list-time">{a.created_at ? timeAgo(a.created_at) : '—'}</span>
                                <span />
                            </button>
                        ))}
                    </div>
                )}
            </section>

            {/* 7g. Investigation Statistics */}
            <section className="invdash-section" aria-label="Investigation statistics">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Investigation Statistics</span>
                    <button type="button" className="invdash-refresh-btn" onClick={loadStats} disabled={statsLoading}>
                        {statsLoading ? 'Loading…' : 'Refresh'}
                    </button>
                </div>
                {statsError ? (
                    <div className="invdash-error">{statsError}<button type="button" className="invdash-retry-btn" onClick={loadStats}>Retry</button></div>
                ) : statsLoading ? (
                    <div className="invdash-loading">Loading statistics…</div>
                ) : !stats || (stats.byModule.length === 0 && Object.values(stats.byStatus).every((v) => v === 0)) ? (
                    <div className="invdash-empty">No investigation data yet.</div>
                ) : (
                    <div className="invdash-stats-grid">
                        <div>
                            {stats.byModule.length === 0 ? (
                                <div className="invdash-empty">No module data yet.</div>
                            ) : (
                                <div className="invdash-module-bar-list">
                                    {stats.byModule.map((m) => {
                                        const max = Math.max(...stats.byModule.map((x) => x.total), 1);
                                        const segs = [
                                            { key: 'critical', v: m.critical, color: '#f85149' },
                                            { key: 'high',     v: m.high,     color: '#d29922' },
                                            { key: 'medium',   v: m.medium,   color: '#58a6ff' },
                                            { key: 'low',      v: m.low,      color: '#3fb950' },
                                        ];
                                        return (
                                            <div className="invdash-module-bar-row" key={m.module}>
                                                <span className="invdash-module-bar-name" title={m.module}>{m.module}</span>
                                                <div className="invdash-module-bar-track" style={{ width: `${(m.total / max) * 100}%` }}>
                                                    {segs.map((s) => (
                                                        s.v > 0 ? (
                                                            <div
                                                                key={s.key}
                                                                className="invdash-module-bar-seg"
                                                                style={{ width: `${(s.v / m.total) * 100}%`, background: s.color }}
                                                            />
                                                        ) : null
                                                    ))}
                                                </div>
                                                <span className="invdash-module-bar-total">{m.total}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                        <div className="invdash-status-breakdown">
                            {STATUS_ORDER.map((s) => (
                                <div className="invdash-status-row" key={s}>
                                    <span className="invdash-status-dot" style={{ background: STATUS_COLORS[s] }} />
                                    <span className="invdash-status-row-label">{STATUS_LABELS[s]}</span>
                                    <span className="invdash-status-row-count">{(stats.byStatus as any)[s] ?? 0}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </section>

            {/* 7h. Quick Actions */}
            <section className="invdash-section" aria-label="Quick actions">
                <div className="invdash-section-header">
                    <span className="invdash-section-title">Quick Actions</span>
                </div>
                <div className="invdash-quick-actions">
                    {quickActionModules.map((m) => (
                        <button
                            key={m.id}
                            type="button"
                            className="invdash-quick-action-btn"
                            onClick={() => onNavigateToModule(m.id)}
                        >
                            + {m.name}
                        </button>
                    ))}
                </div>
            </section>

            {/* Detail modal — reuses JsonViewer, the same underlying payload
                renderer HistoryPage.tsx's own detail view uses (§8). */}
            {detailId != null && createPortal(
                <div className="invdash-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Investigation detail" onMouseDown={(e) => { if (e.target === e.currentTarget) closeDetail(); }}>
                    <div className="invdash-modal">
                        <div className="invdash-modal-header">
                            <h2>Investigation Detail</h2>
                            <button type="button" className="invdash-modal-close" onClick={closeDetail} aria-label="Close">×</button>
                        </div>
                        <div className="invdash-modal-body">
                            {detailError ? (
                                <div className="invdash-error">{detailError}</div>
                            ) : detailLoading || !detail ? (
                                <div className="invdash-loading">Loading…</div>
                            ) : (
                                <>
                                    <div className="invdash-modal-kv">
                                        <span className="k">Target</span><span className="v">{detail.target}</span>
                                        <span className="k">Module</span><span className="v">{detail.module}</span>
                                        <span className="k">Risk</span><span className="v"><RiskBadge risk={detail.risk_level} /></span>
                                        <span className="k">Status</span><span className="v">{STATUS_LABELS[detail.status] ?? detail.status}</span>
                                        <span className="k">Analyst</span><span className="v">{detail.username || '—'}</span>
                                        <span className="k">Created</span><span className="v">{detail.created_at ? new Date(detail.created_at).toLocaleString() : '—'}</span>
                                        {detail.error_message && (<><span className="k">Error</span><span className="v">{detail.error_message}</span></>)}
                                    </div>
                                    {detail.payload_available ? (
                                        <JsonViewer value={detail.payload} mode="tree" />
                                    ) : (
                                        <div className="invdash-empty">No payload available for this record.</div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Delete confirmation (§18) */}
            {confirmDeleteId != null && createPortal(
                <div className="invdash-confirm-overlay" role="dialog" aria-modal="true" aria-label="Confirm delete" onMouseDown={(e) => { if (!deleting && e.target === e.currentTarget) setConfirmDeleteId(null); }}>
                    <div className="invdash-confirm">
                        <div className="invdash-confirm-title">Confirm deletion</div>
                        <div className="invdash-confirm-text">
                            {isAdmin ? 'Mark this investigation as deleted?' : 'Remove this investigation from your history?'}
                        </div>
                        {confirmDeleteTarget && <div className="invdash-confirm-meta">{confirmDeleteTarget}</div>}
                        <div className="invdash-confirm-actions">
                            <button type="button" className="invdash-confirm-cancel" onClick={() => setConfirmDeleteId(null)} disabled={deleting}>Cancel</button>
                            <button type="button" className="invdash-confirm-danger" onClick={runDelete} disabled={deleting} autoFocus>
                                {deleting ? 'Deleting…' : 'Delete'}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default InvestigationDashboardHome;
