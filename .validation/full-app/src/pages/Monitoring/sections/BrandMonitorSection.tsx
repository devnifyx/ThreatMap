import React, { useCallback, useEffect, useState } from 'react';
import { getBrands, getBrandJobs, getMonitors, checkMonitorNow, updateMonitor, createBrandMonitor, type Monitor } from '../../../services/api';
import type { Brand, BrandScanJob } from '../../../types/index';
import { timeAgo } from '../../../utils/timeAgo';
import { RiskBadge } from '../MonitoringShared';
import { MonitorDetailModal } from './MonitorListSection';

interface BrandRow extends Brand {
    latestJob: BrandScanJob | null;
    jobsLoading: boolean;
    monitor: Monitor | null;
    monitorLoading: boolean;
}

// The monitor's own baseline_json.findings is the SAME stable
// "id|status|confidenceState|threatIntelStatus|mispStatus|riskLevel" row
// checkBrandMonitor() (services/monitoring/checkers.js) already writes —
// reading the mispStatus field out of it is a real read, never a fabricated
// summary.
function mispStatusOf(monitor: Monitor | null): 'Matched' | 'No Match' | 'Unknown' {
    const findings = (monitor?.baseline_json as any)?.findings;
    if (!Array.isArray(findings) || findings.length === 0) return 'Unknown';
    const matched = findings.some((row: string) => String(row).split('|')[4] === 'match');
    return matched ? 'Matched' : 'No Match';
}

// BRAND.md §35 "UI STATUS" — the possible states listed there, mapped onto
// what this monitor row actually is; never a hardcoded "PARTIALLY
// IMPLEMENTED" for a feature that is now real.
function monitorStatusLabel(monitor: Monitor | null, checking: boolean): string {
    if (!monitor) return 'Not Monitored';
    if (checking) return 'Check Running';
    if (monitor.reference_status === 'stale_reference') return 'Stale Reference';
    return monitor.status === 'active' ? 'Active' : 'Paused';
}

// BRAND.md §34/§35/§36 — replaces the former read-only "PARTIALLY
// IMPLEMENTED" lens with a real control over each brand's own Brand Monitor
// (a `monitors` row, type='brand', target=brand id — the SAME generic
// monitoring system every other monitor type already uses; see
// MonitorListSection.tsx). Brand Intelligence scans themselves are still
// started manually from OSINT → Brand Intelligence — crawling + AI analysis
// stay too costly to run on a fixed schedule (§12 "do not trigger full
// scans from monitoring") — what's new is that a COMPLETED scan now
// automatically runs this brand's monitor check
// (services/monitoring/brandScanTrigger.js, §4), and this pane is the real
// Check Now / Pause / View Events surface for the result.
const BrandMonitorSection: React.FC = () => {
    const [brands, setBrands] = useState<BrandRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [checkingId, setCheckingId] = useState<number | null>(null);
    const [enablingBrandId, setEnablingBrandId] = useState<number | null>(null);
    const [enableError, setEnableError] = useState<string | null>(null);
    const [detailMonitor, setDetailMonitor] = useState<Monitor | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getBrands();
            const list: Brand[] = res.brands ?? [];
            const rows: BrandRow[] = list.map((b) => ({ ...b, latestJob: null, jobsLoading: true, monitor: null, monitorLoading: true }));
            setBrands(rows);
            setLoading(false);

            // One shared lookup of every existing Brand Monitor rather than
            // one request per brand row.
            getMonitors({ type: 'brand', pageSize: 100 })
                .then((mr) => {
                    const byTarget = new Map(mr.items.map((m) => [String(m.target), m]));
                    setBrands((cur) => cur.map((b) => ({ ...b, monitor: byTarget.get(String(b.id)) || null, monitorLoading: false })));
                })
                .catch(() => setBrands((cur) => cur.map((b) => ({ ...b, monitorLoading: false }))));

            // Fetch latest job per brand independently so the list renders immediately.
            list.forEach((b) => {
                getBrandJobs(b.id)
                    .then((jr) => {
                        const jobs: BrandScanJob[] = jr.jobs ?? [];
                        const latest = jobs.length > 0 ? jobs[0] : null;
                        setBrands((cur) => {
                            const next = [...cur];
                            const i = next.findIndex((x) => x.id === b.id);
                            if (i >= 0) next[i] = { ...next[i], latestJob: latest, jobsLoading: false };
                            return next;
                        });
                    })
                    .catch(() => {
                        setBrands((cur) => {
                            const next = [...cur];
                            const i = next.findIndex((x) => x.id === b.id);
                            if (i >= 0) next[i] = { ...next[i], jobsLoading: false };
                            return next;
                        });
                    });
            });
        } catch (err: any) {
            setError(err?.message || 'Failed to load brands');
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const handleEnableMonitoring = async (brandId: number) => {
        setEnablingBrandId(brandId);
        setEnableError(null);
        try {
            await createBrandMonitor(brandId);
            await load();
        } catch (err: any) {
            setEnableError(err?.message || 'Failed to enable monitoring');
        } finally {
            setEnablingBrandId(null);
        }
    };

    // BRAND.md §14 "CHECK NOW UX" — disable, show "Checking…", then a
    // concise result; never a raw stack trace.
    const handleCheckNow = async (monitorId: number) => {
        setCheckingId(monitorId);
        try {
            await checkMonitorNow(monitorId);
        } catch {
            // surfaced via the row's own last_error field after reload
        } finally {
            setCheckingId(null);
            load();
        }
    };

    const handleTogglePause = async (monitor: Monitor) => {
        await updateMonitor(monitor.id, { status: monitor.status === 'active' ? 'paused' : 'active' });
        load();
    };

    return (
        <div className="mon-card">
            <div className="mon-section-header">
                <span className="mon-card-title">Brand Monitor</span>
                <button type="button" className="mon-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <div className="mon-note" style={{ marginBottom: '12px' }}>
                Watches each brand's own Brand Intelligence findings for change (new suspicious domains, impersonating
                social accounts, credential-harvesting pages, campaign growth, and MISP correlation). Scans themselves
                are still started manually from OSINT → Brand Intelligence — a completed scan automatically runs this
                check; the interval shown is only the periodic fallback.
            </div>
            {enableError && <div className="mon-note" style={{ marginBottom: '12px', color: '#f85149' }}>{enableError}</div>}

            {error ? (
                <div className="mon-error">{error}<button type="button" className="mon-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="mon-loading">Loading…</div>
            ) : brands.length === 0 ? (
                <div className="mon-empty">No brand profiles configured yet. Add one from OSINT → Brand Intelligence.</div>
            ) : (
                <div className="mon-table-wrap">
                    <table className="mon-table">
                        <thead>
                            <tr><th>Brand</th><th>Monitor Status</th><th>Last Checked</th><th>Risk</th><th>MISP</th><th>Action</th></tr>
                        </thead>
                        <tbody>
                            {brands.map((b) => {
                                const checking = b.monitor != null && checkingId === b.monitor.id;
                                const stale = b.monitor?.reference_status === 'stale_reference';
                                return (
                                    <tr key={b.id}>
                                        <td style={{ fontWeight: 700 }}>
                                            {b.name}
                                            <div className="mon-note" style={{ fontWeight: 400, fontSize: '0.75rem' }}>
                                                {b.jobsLoading ? '' : b.latestJob ? `Last scan: ${b.latestJob.status}` : 'No scans yet'}
                                            </div>
                                        </td>
                                        <td>
                                            {b.monitorLoading ? '…' : <span style={{ textTransform: 'capitalize' }}>{monitorStatusLabel(b.monitor, checking)}</span>}
                                            {b.monitor && b.monitor.consecutive_failures > 0 && (
                                                <div className="mon-note" style={{ color: '#d29922', marginTop: '4px', fontSize: '0.75rem' }}>{b.monitor.consecutive_failures} failed check(s)</div>
                                            )}
                                        </td>
                                        <td>{b.monitor?.last_checked_at ? timeAgo(b.monitor.last_checked_at) : '—'}</td>
                                        <td>{b.monitor?.last_risk ? <RiskBadge risk={b.monitor.last_risk} /> : '—'}</td>
                                        <td>{b.monitorLoading ? '…' : mispStatusOf(b.monitor)}</td>
                                        <td>
                                            <div className="mon-row-actions">
                                                {!b.monitor ? (
                                                    <button type="button" className="mon-action-btn" disabled={enablingBrandId === b.id} onClick={() => handleEnableMonitoring(b.id)}>
                                                        {enablingBrandId === b.id ? 'Enabling…' : 'Enable Monitoring'}
                                                    </button>
                                                ) : (
                                                    <>
                                                        <button
                                                            type="button" className="mon-action-btn"
                                                            disabled={checking || stale}
                                                            title={stale ? 'This monitor references a Brand that no longer exists' : undefined}
                                                            onClick={() => handleCheckNow(b.monitor!.id)}
                                                        >
                                                            {checking ? 'Checking…' : 'Check Now'}
                                                        </button>
                                                        {!stale && (
                                                            <button type="button" className="mon-action-btn" onClick={() => handleTogglePause(b.monitor!)}>
                                                                {b.monitor.status === 'active' ? 'Pause' : 'Resume'}
                                                            </button>
                                                        )}
                                                        <button type="button" className="mon-action-btn" onClick={() => setDetailMonitor(b.monitor)}>View Events</button>
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            {detailMonitor && <MonitorDetailModal monitor={detailMonitor} onClose={() => setDetailMonitor(null)} />}
        </div>
    );
};

export default BrandMonitorSection;
