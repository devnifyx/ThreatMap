import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getMonitoringOverview, type MonitoringOverview } from '../../../services/api';
import MonitorListSection from './MonitorListSection';

// MONITORING_CODE.md §1 — the Monitoring landing page. Every KPI here is a
// real COUNT(*) against monitors/alerts (database/storage.js's
// getMonitoringOverview) — no hardcoded values (§0's own "do not create
// fake statistics").
//
// The Monitors list used to be its own sidebar leaf/section ('mon-monitors'),
// but it showed largely the same ground (active/failed monitor counts, one
// row per monitor) as this page's own KPI tiles and Monitor Health list —
// two views a click apart over the same handful of facts. It is now mounted
// directly below, on this one page, instead of behind a second nav leaf; the
// old leaf, hash (#/mon-monitors), and the six legacy per-type redirects into
// it all still land here (App.tsx's LEGACY_VIEW_REDIRECTS).
interface OverviewSectionProps {
    onNavigate: (section: string) => void;
    // Preselects the Monitors list's type filter when a legacy per-type route
    // (e.g. #/mon-domain-monitor) redirects in — passed through from
    // MonitoringPage, which used to hand this straight to MonitorListSection
    // itself before the two sections merged.
    initialMonitorType?: string | null;
    onInitialMonitorTypeConsumed?: () => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate, initialMonitorType, onInitialMonitorTypeConsumed }) => {
    const [data, setData] = useState<MonitoringOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // "Active Monitors"/"Failed Monitors" used to jump to the separate
    // Monitors section; now that list lives on this same page, so they just
    // scroll to it instead of navigating away.
    const monitorsRef = useRef<HTMLDivElement>(null);
    const scrollToMonitors = () => monitorsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getMonitoringOverview()
            .then(setData)
            .catch((err) => setError(err?.message || 'Failed to load monitoring overview'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <>
            <div className="mon-card">
                <div className="mon-section-header">
                    <span className="mon-card-title">Monitoring Overview</span>
                    <button type="button" className="mon-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                </div>

                {error ? (
                    <div className="mon-error">{error}<button type="button" className="mon-retry-btn" onClick={load}>Retry</button></div>
                ) : loading || !data ? (
                    <div className="mon-loading">Loading…</div>
                ) : (
                    <>
                        <div className="mon-kpi-row">
                            <button type="button" className="mon-kpi-card" onClick={scrollToMonitors}>
                                <div className="mon-kpi-value">{data.activeMonitors.toLocaleString()}</div>
                                <div className="mon-kpi-label">Active Monitors</div>
                            </button>
                            <button type="button" className="mon-kpi-card" onClick={() => onNavigate('alert-center')}>
                                <div className="mon-kpi-value">{data.newAlerts.toLocaleString()}</div>
                                <div className="mon-kpi-label">New Alerts</div>
                            </button>
                            <button type="button" className="mon-kpi-card" onClick={() => onNavigate('alert-center')}>
                                <div className="mon-kpi-value mon-kpi-value--critical">{data.criticalAlerts.toLocaleString()}</div>
                                <div className="mon-kpi-label">Critical Alerts</div>
                            </button>
                            <button type="button" className="mon-kpi-card" onClick={() => onNavigate('monitoring-history')}>
                                <div className="mon-kpi-value">{data.triggeredToday.toLocaleString()}</div>
                                <div className="mon-kpi-label">Triggered Today</div>
                            </button>
                            <button type="button" className="mon-kpi-card" onClick={scrollToMonitors}>
                                <div className="mon-kpi-value mon-kpi-value--warn">{data.failedMonitors.toLocaleString()}</div>
                                <div className="mon-kpi-label">Failed Monitors</div>
                            </button>
                        </div>

                        <div style={{ marginTop: '18px' }}>
                            <div className="mon-card-title" style={{ marginBottom: '10px' }}>Monitor Health</div>
                            {data.health.length === 0 ? (
                                <div className="mon-empty">No active monitors yet.</div>
                            ) : (
                                <div className="mon-health-list">
                                    {data.health.map((h) => (
                                        <div className="mon-health-row" key={h.type}>
                                            <span className={`mon-health-dot mon-health-dot--${h.status}`} />
                                            <span className="mon-health-label">{h.type} Monitor ({h.total})</span>
                                            <span className={`mon-health-status mon-badge mon-badge--${h.status === 'operational' ? 'low' : h.status === 'degraded' ? 'medium' : h.status === 'failed' ? 'critical' : 'info'}`}>
                                                {h.status}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div ref={monitorsRef}>
                <MonitorListSection
                    key={initialMonitorType ?? 'all'}
                    initialType={initialMonitorType ?? undefined}
                    onMounted={onInitialMonitorTypeConsumed}
                />
            </div>
        </>
    );
};

export default OverviewSection;
