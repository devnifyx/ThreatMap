import React, { useCallback, useEffect, useState } from 'react';
import {
    getMonitors, createMonitor, updateMonitor, deleteMonitor, checkMonitorNow, getMonitorEvents,
    type Monitor, type MonitorEvent
} from '../../../services/api';
import { timeAgo } from '../../../utils/timeAgo';
import { RiskBadge, SeverityBadge, ConfirmDialog, formatMinutesInterval } from '../MonitoringShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8

// MONITORING_CODE.md §3/§5/§6/§8/§13 — one shared component over the generic
// `monitors` table (add/pause/resume/remove/check-now/view-history).
//
// It used to be mounted six times behind six sidebar leaves (IOC Watchlist,
// Domain, IP, Credential Exposure, Social Username, APT Group) that differed
// only by a `type` prop, while the OTHER seven monitor types the backend
// supports had no sidebar entry at all — so more than half of what the
// scheduler actually monitors was invisible here. It is now ONE "Monitors"
// view with a type filter covering every type, which is what the API already
// did: GET /api/monitoring/monitors defaults `type` to 'all'
// (server.js) and getMonitorsPage() only adds a WHERE when type !== 'all'
// (database/storage.js). No backend change was needed.
const IOC_TYPE_OPTIONS = [
    { value: 'ip', label: 'IP' },
    { value: 'domain', label: 'Domain' },
    { value: 'url', label: 'URL' },
    { value: 'hash', label: 'Hash' },
    { value: 'email', label: 'Email' },
    { value: 'username', label: 'Username' },
    { value: 'phone', label: 'Phone' }
];
const AUTOCHECK_IOC_TYPES = new Set(['ip', 'domain']);

// Every value of `monitors.type` the backend actually supports — matched
// 1:1 against services/monitoring/checkers.js's runMonitorCheck() dispatch
// and scheduler.js's SOURCE_LABEL map.
//
// `createdFrom` is set for the types whose monitor is created from the
// entity's own module (the id here is an internal row id, not something an
// analyst can meaningfully type). For those, this view lists and manages —
// it never offers a raw "+ Add Monitor" form. That rule already existed for
// threat_actor; it just applies to seven more types now that they are
// visible. Each string is the verified creation path in the code.
type MonitorTypeDef = { value: string; label: string; placeholder?: string; createdFrom?: string };
const MONITOR_TYPES: MonitorTypeDef[] = [
    { value: 'domain', label: 'Domain', placeholder: 'example.com' },
    { value: 'ip', label: 'IP', placeholder: '8.8.8.8' },
    { value: 'ioc', label: 'IOC Watchlist', placeholder: 'IP, domain, URL, hash, email, username, or phone…' },
    { value: 'credential', label: 'Credential Exposure (email)', placeholder: 'you@company.com' },
    { value: 'social_username', label: 'Social Username', placeholder: 'username123' },
    { value: 'brand', label: 'Brand', createdFrom: 'OSINT → Brand Intelligence (open a brand → "Monitor Brand")' },
    { value: 'threat_actor', label: 'APT Group', createdFrom: 'Threat Intelligence → APT Group Intelligence (open a group → "Monitor APT Group")' },
    { value: 'malware_family', label: 'Malware Family', createdFrom: 'Threat Intelligence → Malware Intelligence (open a family → "Monitor Family")' },
    { value: 'telegram_source', label: 'Telegram Source', createdFrom: 'OSINT → Telegram Intelligence (open a source → "Monitor Source")' },
    { value: 'dark_web_source', label: 'Dark Web Source', createdFrom: 'OSINT → Dark Web Intelligence' },
    { value: 'dark_web_ioc', label: 'Dark Web IOC', createdFrom: 'OSINT → Dark Web Intelligence' },
    { value: 'dark_web_entity', label: 'Dark Web Entity', createdFrom: 'OSINT → Dark Web Intelligence' },
    { value: 'credential_leak_domain', label: 'Credential Leak Domain', createdFrom: 'OSINT → Credential Leak (Watchlist Domains)' },
];
const MONITOR_TYPE_BY_VALUE = new Map(MONITOR_TYPES.map((t) => [t.value, t]));
const monitorTypeLabel = (value: string) => MONITOR_TYPE_BY_VALUE.get(value)?.label ?? value;

// Exported so BrandMonitorSection.tsx (BRAND.md §36 "reuse existing event
// display components where possible") can reuse this exact history view
// instead of a second implementation.
export const MonitorDetailModal: React.FC<{ monitor: Monitor; onClose: () => void }> = ({ monitor, onClose }) => {
    const [events, setEvents] = useState<MonitorEvent[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true);
        setError(null);
        getMonitorEvents(monitor.id, { pageSize: 30 })
            .then((res) => setEvents(res.items))
            .catch((err) => setError(err?.message || 'Failed to load history'))
            .finally(() => setLoading(false));
    }, [monitor.id]);

    return (
        <div className="mon-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Monitor detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="mon-modal">
                <div className="mon-modal-header">
                    <h2>{monitor.label || monitor.target}</h2>
                    <button type="button" className="mon-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="mon-modal-body">
                    <div className="mon-kv">
                        <span className="k">Target</span><span className="v">{monitor.target}</span>
                        <span className="k">Type</span><span className="v">{monitor.type}{monitor.ioc_type ? ` (${monitor.ioc_type})` : ''}</span>
                        <span className="k">Risk</span><span className="v"><RiskBadge risk={monitor.last_risk} /></span>
                        <span className="k">Status</span><span className="v">{monitor.status}</span>
                        <span className="k">Check interval</span><span className="v">{formatMinutesInterval(monitor.check_interval_minutes)}</span>
                        <span className="k">Last checked</span><span className="v">{monitor.last_checked_at ? timeAgo(monitor.last_checked_at) : 'Never'}</span>
                        <span className="k">Last success</span><span className="v">{monitor.last_success_at ? timeAgo(monitor.last_success_at) : '—'}</span>
                        {monitor.last_error && (<><span className="k">Last error</span><span className="v" style={{ color: '#f85149' }}>{monitor.last_error}</span></>)}
                    </div>

                    <div>
                        <div className="mon-card-title" style={{ marginTop: '14px', marginBottom: '8px' }}>History</div>
                        {error ? (
                            <div className="mon-error">{error}</div>
                        ) : loading ? (
                            <div className="mon-loading">Loading…</div>
                        ) : !events || events.length === 0 ? (
                            <div className="mon-empty">No events recorded yet.</div>
                        ) : (
                            <div className="mon-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                {events.map((e) => (
                                    <div key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                        <SeverityBadge severity={e.severity} />
                                        <span style={{ flex: 1, fontSize: '0.85rem' }}>{e.summary}</span>
                                        <span style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.75)' }}>{e.created_at ? timeAgo(e.created_at) : ''}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

interface MonitorListSectionProps {
    title?: string;
    // Preselects the type filter on arrival, so a deep link from another
    // module (or a redirected legacy per-type route) lands on the right slice.
    initialType?: string;
    // Lets the caller clear its one-shot initialType once consumed, so a
    // later plain visit to Monitors isn't stuck on the old filter.
    onMounted?: () => void;
}

const MonitorListSection: React.FC<MonitorListSectionProps> = ({ title = 'Monitors', initialType, onMounted }) => {
    const [filters, setFilters] = useState({ q: '', status: 'all', type: initialType || 'all' });
    const type = filters.type;
    const typeDef = MONITOR_TYPE_BY_VALUE.get(type) ?? null;
    // 'all' has no single creatable target shape, and a module-owned type is
    // never created by typing a raw row id — so the form is offered only for
    // a concrete, analyst-enterable type.
    const canCreate = !!typeDef && !typeDef.createdFrom;
    const targetPlaceholder = typeDef?.placeholder ?? '';
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<Monitor[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getMonitors({ type: type !== 'all' ? type : undefined, status: filters.status !== 'all' ? filters.status : undefined, q: filters.q || undefined, page, pageSize })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load monitors'))
            .finally(() => setLoading(false));
    }, [type, filters, page]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { onMounted?.(); /* one-shot: clears the caller's initialType */ // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Add monitor ──────────────────────────────────────────────────────────
    const [showAdd, setShowAdd] = useState(false);
    const [newTarget, setNewTarget] = useState('');
    const [newLabel, setNewLabel] = useState('');
    const [newIocType, setNewIocType] = useState('ip');
    const [newInterval, setNewInterval] = useState(60);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    const submitAdd = async () => {
        setAdding(true);
        setAddError(null);
        try {
            await createMonitor({
                type, iocType: type === 'ioc' ? newIocType : undefined,
                target: newTarget, label: newLabel || undefined, checkIntervalMinutes: newInterval
            });
            setNewTarget(''); setNewLabel('');
            setShowAdd(false);
            setPage(1);
            load();
        } catch (err: any) {
            setAddError(err?.message || 'Failed to add monitor');
        } finally {
            setAdding(false);
        }
    };

    // ── Per-row actions ──────────────────────────────────────────────────────
    const [checkingId, setCheckingId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [detailMonitor, setDetailMonitor] = useState<Monitor | null>(null);

    const handleCheckNow = async (id: number) => {
        setCheckingId(id);
        try {
            await checkMonitorNow(id);
        } catch {
            // surfaced via the row's own last_error field after reload
        } finally {
            setCheckingId(null);
            load();
        }
    };

    const handleTogglePause = async (m: Monitor) => {
        await updateMonitor(m.id, { status: m.status === 'active' ? 'paused' : 'active' });
        load();
    };

    const runDelete = async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        try {
            await deleteMonitor(confirmDeleteId);
            setConfirmDeleteId(null);
            load();
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.status === 'all' && filters.type === 'all';
    const confirmDeleteTarget = items.find((m) => m.id === confirmDeleteId)?.target ?? null;

    return (
        <div className="mon-card">
            <div className="mon-section-header">
                <span className="mon-card-title">{title}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="mon-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    {canCreate && <button type="button" className="mon-submit-btn" onClick={() => setShowAdd((v) => !v)}>+ Add Monitor</button>}
                </div>
            </div>

            {typeDef?.createdFrom && (
                <div className="mon-note" style={{ marginBottom: '14px' }}>
                    {typeDef.label} monitors are created from the entity's own module ({typeDef.createdFrom}), not here — this view lists and manages monitors already created that way.
                </div>
            )}
            {type === 'all' && (
                <div className="mon-note" style={{ marginBottom: '14px' }}>
                    Showing every monitor type. Pick a type to add one, or to see the guidance for types created from their own module.
                </div>
            )}

            {showAdd && (
                <div className="mon-form-row" style={{ marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    {type === 'ioc' && (
                        <select value={newIocType} onChange={(e) => setNewIocType(e.target.value)} aria-label="IOC type">
                            {IOC_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                    )}
                    <input type="text" placeholder={targetPlaceholder} value={newTarget} onChange={(e) => setNewTarget(e.target.value)} style={{ minWidth: '220px' }} />
                    <input type="text" placeholder="Label (optional)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} style={{ minWidth: '140px' }} />
                    <input type="number" min={5} max={10080} value={newInterval} onChange={(e) => setNewInterval(Number(e.target.value) || 60)} style={{ width: '90px' }} title="Check interval (minutes)" />
                    <span style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.85)' }}>min interval</span>
                    <button type="button" className="mon-submit-btn" onClick={submitAdd} disabled={adding || !newTarget.trim()}>{adding ? 'Adding…' : 'Add'}</button>
                    {type === 'ioc' && !AUTOCHECK_IOC_TYPES.has(newIocType) && (
                        <div className="mon-note" style={{ width: '100%' }}>
                            Automatic rechecking isn't available yet for this IOC type — it will be tracked here but only checked manually via the relevant Intelligence module.
                        </div>
                    )}
                    {addError && <div className="mon-note" style={{ width: '100%', color: '#f85149' }}>{addError}</div>}
                </div>
            )}

            <div className="mon-filters">
                <input type="text" placeholder="Search target or label…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.type} aria-label="Monitor type" onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setShowAdd(false); setPage(1); }}>
                    <option value="all">All Types</option>
                    {MONITOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                </select>
            </div>

            {error ? (
                <div className="mon-error">{error}<button type="button" className="mon-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="mon-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="mon-empty">{filtersAreDefault ? 'No monitors yet.' : 'No monitors match these filters.'}</div>
            ) : (
                <>
                    <div className="mon-table-wrap">
                        <table className="mon-table">
                            <thead>
                                <tr>
                                    <th>Target</th>
                                    {/* Only when the list is mixed — a single-type
                                        view already says the type in its filter. */}
                                    {type === 'all' && <th>Type</th>}
                                    {type === 'ioc' && <th>IOC Type</th>}
                                    <th>Risk</th>
                                    <th>Status</th>
                                    <th>Interval</th>
                                    <th>Last Checked</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((m) => (
                                    <tr key={m.id}>
                                        <td><span className="mon-target" title={m.target}>{m.label ? `${m.label} (${m.target})` : m.target}</span></td>
                                        {type === 'all' && <td>{monitorTypeLabel(m.type)}</td>}
                                        {type === 'ioc' && <td>{m.ioc_type}</td>}
                                        <td><RiskBadge risk={m.last_risk} /></td>
                                        <td>
                                            <button type="button" className="mon-action-btn" onClick={() => handleTogglePause(m)}>
                                                {m.status === 'active' ? 'Active — Pause' : 'Paused — Resume'}
                                            </button>
                                            {m.consecutive_failures > 0 && <div className="mon-note" style={{ color: '#d29922', marginTop: '4px', fontSize: '0.75rem' }}>{m.consecutive_failures} failed check(s)</div>}
                                        </td>
                                        <td>{formatMinutesInterval(m.check_interval_minutes)}</td>
                                        <td>{m.last_checked_at ? timeAgo(m.last_checked_at) : 'Never'}</td>
                                        <td>
                                            <div className="mon-row-actions">
                                                <button type="button" className="mon-action-btn" disabled={checkingId === m.id} onClick={() => handleCheckNow(m.id)}>
                                                    {checkingId === m.id ? 'Checking…' : 'Check Now'}
                                                </button>
                                                <button type="button" className="mon-action-btn" onClick={() => setDetailMonitor(m)}>View</button>
                                                <button type="button" className="mon-action-btn mon-action-btn--danger" onClick={() => setConfirmDeleteId(m.id)}>Remove</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="mon" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}

            {confirmDeleteId != null && (
                <ConfirmDialog
                    title="Remove monitor"
                    text="Stop monitoring this target? Its history is kept."
                    meta={confirmDeleteTarget}
                    busy={deleting}
                    confirmLabel="Remove"
                    onCancel={() => setConfirmDeleteId(null)}
                    onConfirm={runDelete}
                />
            )}

            {detailMonitor && <MonitorDetailModal monitor={detailMonitor} onClose={() => setDetailMonitor(null)} />}
        </div>
    );
};

export default MonitorListSection;
