import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { ScanLine, Radar, Activity, ShieldAlert } from 'lucide-react';
import CyberThreatMap from '../../components/CyberThreatMap';
import HostingCountriesMap from '../../components/HostingCountriesMap';
import './DashboardPage.css';
import { getDashboardStats, getDashboardSystemHealth } from '../../services/api';
import { threatMapSocket, type ThreatEvent } from '../../services/threatMapSocket';
import type { HostingCountryEntry } from '../../types';

interface DashboardPageProps {
    onNavigateToScan: () => void;
    onNavigateToOsint: () => void;
}

interface DashboardStats {
    totalScans: number;
    totalScans24h: number;
    totalOsintInvestigations: number;
    totalOsintInvestigations24h: number;
    highCriticalFindings: number;
    highCriticalFindings24h: number;
    activeThreats: number;
    mostUsedModules: { module: string; count: number }[];
    scansOverTime: { day: string; count: number }[];
    recentActivity: { id: string; target: string; timestamp: string; kind: string; risk: string | null }[];
    activeBrandCampaigns: number | null;
}

interface SystemHealth {
    database: 'ok' | 'error' | 'unknown';
    brandIntelWorker: { status: 'ok' | 'busy' | 'stuck'; activeJobs: number; stuckJobs: number } | null;
    threatFeed: string;
    configuredProviders: Record<string, boolean>;
}

const StatusDot: React.FC<{ status: 'ok' | 'warn' | 'error' | 'unknown' | 'info' }> = ({ status }) => (
    <span className={`dash-health-dot dash-health-dot--${status}`} aria-hidden="true" />
);

const SystemHealthWidget: React.FC = () => {
    const [health, setHealth] = React.useState<SystemHealth | null>(null);

    React.useEffect(() => {
        let cancelled = false;
        getDashboardSystemHealth()
            .then(h => { if (!cancelled) setHealth(h as SystemHealth); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    if (!health) return null;

    const workerStatus = health.brandIntelWorker?.status ?? 'unknown';
    const workerDot: 'ok' | 'warn' | 'error' | 'unknown' =
        workerStatus === 'ok' ? 'ok' : workerStatus === 'busy' ? 'warn' : workerStatus === 'stuck' ? 'error' : 'unknown';

    const configuredCount = Object.values(health.configuredProviders).filter(Boolean).length;
    const totalProviders  = Object.keys(health.configuredProviders).length;

    return (
        <section className="dash-health-widget" aria-label="System health">
            <div className="dash-chart-panel-title">System Status</div>
            <div className="dash-health-rows">
                <div className="dash-health-row">
                    <StatusDot status={health.database === 'ok' ? 'ok' : 'error'} />
                    <span>Database</span>
                    <span className="dash-health-value">{health.database}</span>
                </div>
                {health.brandIntelWorker !== null ? (
                    <div className="dash-health-row">
                        <StatusDot status={workerDot} />
                        <span>Brand Intel Worker</span>
                        <span className="dash-health-value">
                            {workerStatus === 'ok' ? 'idle' :
                             workerStatus === 'busy' ? `${health.brandIntelWorker!.activeJobs} active` :
                             `${health.brandIntelWorker!.stuckJobs} stuck`}
                        </span>
                    </div>
                ) : (
                    <div className="dash-health-row">
                        <StatusDot status="unknown" />
                        <span>Brand Intel Worker</span>
                        <span className="dash-health-value">not installed</span>
                    </div>
                )}
                <div className="dash-health-row">
                    <StatusDot status={configuredCount > 0 ? 'ok' : 'warn'} />
                    <span>API Providers</span>
                    <span className="dash-health-value">{configuredCount}/{totalProviders} configured</span>
                </div>
            </div>
        </section>
    );
};

const STATS_REFRESH_MS = 60_000;
const MAX_TRACKED_LIVE_THREATS = 100;

function formatCount(n: number): string {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
    return String(n);
}

const KpiTile: React.FC<{
    icon: React.ReactNode;
    label: string;
    value: number | null;
    delta24h?: number;
    live?: boolean;
}> = ({ icon, label, value, delta24h, live }) => (
    <div className="dash-kpi-tile">
        <div className="dash-kpi-tile-head">
            <span className="dash-kpi-tile-label">{label}</span>
            <span className="dash-kpi-tile-icon">{icon}</span>
        </div>
        <div className="dash-kpi-tile-value">{value === null ? '—' : formatCount(value)}</div>
        {live ? (
            <div className="dash-kpi-tile-delta dash-kpi-tile-delta--live">
                <span className="pulse-dot" /> LIVE
            </div>
        ) : (
            <div className="dash-kpi-tile-delta">
                {typeof delta24h === 'number' ? (
                    <>
                        <span className="dash-kpi-tile-delta-arrow">↑</span> {delta24h}
                    </>
                ) : (
                    '—'
                )}{' '}
                <span className="dash-kpi-tile-delta-window">(24 hours)</span>
            </div>
        )}
    </div>
);

const ChartPanel: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <section className="dash-chart-panel" aria-label={title}>
        <div className="dash-chart-panel-title">{title}</div>
        <div className="dash-chart-panel-body">{children}</div>
    </section>
);

const BarMeterList: React.FC<{ items: { label: string; count: number }[]; emptyText: string }> = ({ items, emptyText }) => {
    if (!items.length) return <div className="dash-chart-empty">{emptyText}</div>;
    const max = Math.max(...items.map((i) => i.count), 1);
    return (
        <div className="dash-bar-list" role="list">
            {items.map((item) => (
                <div className="dash-bar-row" role="listitem" key={item.label}>
                    <span className="dash-bar-label" title={item.label}>{item.label}</span>
                    <div className="dash-bar-track">
                        <div className="dash-bar-fill" style={{ width: `${(item.count / max) * 100}%` }} />
                    </div>
                    <span className="dash-bar-count">{item.count}</span>
                </div>
            ))}
        </div>
    );
};

const TrendLine: React.FC<{ points: { day: string; count: number }[]; emptyText: string }> = ({ points, emptyText }) => {
    if (!points.length) return <div className="dash-chart-empty">{emptyText}</div>;
    const width = 100;
    const height = 100;
    const max = Math.max(...points.map((p) => p.count), 1);
    const stepX = points.length > 1 ? width / (points.length - 1) : 0;
    const coords = points.map((p, i) => ({
        x: points.length > 1 ? i * stepX : width / 2,
        y: height - (p.count / max) * (height - 8) - 4
    }));
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(2)} ${c.y.toFixed(2)}`).join(' ');
    const areaPath = `${linePath} L ${coords[coords.length - 1].x.toFixed(2)} ${height} L ${coords[0].x.toFixed(2)} ${height} Z`;
    const first = points[0]?.day;
    const last = points[points.length - 1]?.day;

    return (
        <div className="dash-trend">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="dash-trend-svg" role="img" aria-label="Scans over the last 30 days">
                <path d={areaPath} className="dash-trend-area" />
                <path d={linePath} className="dash-trend-line" />
            </svg>
            <div className="dash-trend-axis">
                <span>{first}</span>
                <span>{last}</span>
            </div>
        </div>
    );
};

const RecentActivityList: React.FC<{ items: DashboardStats['recentActivity'] }> = ({ items }) => {
    if (!items.length) return <div className="dash-chart-empty">No scans or investigations yet.</div>;
    return (
        <ul className="dash-activity-list" role="list" data-lenis-prevent>
            {items.map((item) => (
                <li className="dash-activity-row" key={item.id}>
                    <span className="dash-activity-kind">{item.kind}</span>
                    <span className="dash-activity-target" title={item.target}>{item.target}</span>
                    {item.risk && (
                        <span className={`dash-activity-risk dash-activity-risk--${item.risk.toLowerCase()}`}>{item.risk}</span>
                    )}
                    <span className="dash-activity-time">{new Date(item.timestamp).toLocaleString()}</span>
                </li>
            ))}
        </ul>
    );
};

const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToScan, onNavigateToOsint }) => {
    const [selectedThreat, setSelectedThreat] = useState<any | null>(null);
    const [filter, setFilter] = useState<string>('all');
    const [error, setError] = useState<string | null>(null);
    const [stats, setStats] = useState<DashboardStats | null>(null);
    // Previously a failed dashboard-stats fetch was only logged to the
    // console — every KPI tile silently rendered "—" with no indication to
    // the user of WHY (expired session, transient 500, network error).
    // Surface it and offer a manual retry instead.
    const [statsError, setStatsError] = useState<string | null>(null);
    const [statsLoading, setStatsLoading] = useState(true);

    const [liveTypeCounts, setLiveTypeCounts] = useState<Record<string, number>>({});
    const [liveCountryCounts, setLiveCountryCounts] = useState<Record<string, { name: string; count: number }>>({});
    const liveThreatsRef = useRef<Map<string, ThreatEvent>>(new Map());

    const recomputeLiveAggregates = useCallback(() => {
        const typeCounts: Record<string, number> = {};
        const countryCounts: Record<string, { name: string; count: number }> = {};
        for (const t of liveThreatsRef.current.values()) {
            typeCounts[t.type] = (typeCounts[t.type] || 0) + 1;
            const code = t.source?.countryCode;
            if (code) {
                const existing = countryCounts[code];
                countryCounts[code] = { name: t.source.country || code, count: (existing?.count || 0) + 1 };
            }
        }
        setLiveTypeCounts(typeCounts);
        setLiveCountryCounts(countryCounts);
    }, []);

    const ingestThreatEvents = useCallback((events: ThreatEvent[], { replace = false } = {}) => {
        if (replace) liveThreatsRef.current.clear();
        for (const e of events) {
            if (liveThreatsRef.current.has(e.id)) continue;
            liveThreatsRef.current.set(e.id, e);
        }
        while (liveThreatsRef.current.size > MAX_TRACKED_LIVE_THREATS) {
            const oldestKey = liveThreatsRef.current.keys().next().value;
            if (oldestKey === undefined) break;
            liveThreatsRef.current.delete(oldestKey);
        }
        recomputeLiveAggregates();
    }, [recomputeLiveAggregates]);

    useEffect(() => {
        const unsubSnapshot = threatMapSocket.onSnapshot((events) => ingestThreatEvents(events, { replace: true }));
        const unsubEvents = threatMapSocket.onEvents((events) => ingestThreatEvents(events));
        threatMapSocket.connect();
        return () => {
            unsubSnapshot();
            unsubEvents();
        };
    }, [ingestThreatEvents]);

    const loadStats = useCallback(async () => {
        setStatsLoading(true);
        try {
            const res = await getDashboardStats();
            setStats(res.stats);
            setStatsError(null);
        } catch (err: any) {
            console.error('Failed to load dashboard stats:', err);
            // Surfaced to the user below instead of silently leaving every
            // KPI tile on "—" with no explanation.
            setStatsError(err?.message || 'Failed to load dashboard statistics.');
        } finally {
            setStatsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            if (!cancelled) await loadStats();
        })();
        const interval = window.setInterval(() => { if (!cancelled) loadStats(); }, STATS_REFRESH_MS);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [loadStats]);

    const handleThreatClick = useCallback((threat: any) => {
        setSelectedThreat(threat);
    }, []);

    const handleError = useCallback((err: string | null) => {
        setError(err);
    }, []);

    const threatTypes = ['all', 'DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'];

    const threatTypeBarItems = useMemo(
        () => Object.entries(liveTypeCounts)
            .map(([label, count]) => ({ label, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 8),
        [liveTypeCounts]
    );

    const moduleBarItems = useMemo(
        () => (stats?.mostUsedModules ?? []).map((m) => ({ label: m.module, count: m.count })),
        [stats]
    );

    const threatOriginCountries: HostingCountryEntry[] = useMemo(
        () => Object.entries(liveCountryCounts)
            .map(([code, v]) => ({ code, name: v.name, count: v.count }))
            .sort((a, b) => b.count - a.count),
        [liveCountryCounts]
    );

    return (
        <div className="dashboard-page">
            <main className="dashboard-content">
                {statsError && (
                    <div className="map-error" role="alert" style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                        <span>Dashboard statistics failed to load: {statsError}{/authentication/i.test(statsError) ? ' — try logging out and back in.' : ''}</span>
                        <button type="button" onClick={() => loadStats()} disabled={statsLoading} className="filter-btn">
                            {statsLoading ? 'Retrying…' : 'Retry'}
                        </button>
                    </div>
                )}
                <section className="dash-kpi-row" aria-label="Key metrics">
                    <KpiTile
                        icon={<ScanLine size={20} />}
                        label="Total Scans"
                        value={stats?.totalScans ?? null}
                        delta24h={stats?.totalScans24h}
                    />
                    <KpiTile
                        icon={<Radar size={20} />}
                        label="OSINT Investigations"
                        value={stats?.totalOsintInvestigations ?? null}
                        delta24h={stats?.totalOsintInvestigations24h}
                    />
                    <KpiTile
                        icon={<Activity size={20} />}
                        label="Active Threats"
                        value={stats?.activeThreats ?? null}
                        live
                    />
                    <KpiTile
                        icon={<ShieldAlert size={20} />}
                        label="High/Critical Findings"
                        value={stats?.highCriticalFindings ?? null}
                        delta24h={stats?.highCriticalFindings24h}
                    />
                </section>

                <div className="mission-control">
                    <button className="mission-card" onClick={onNavigateToScan}>
                        <div className="card-icon">
                            <img src="/WebCheck.png" alt="Web Check" style={{width: '48px', height: '48px', objectFit: 'contain'}} />
                        </div>
                        <div className="card-content">
                            <h3>Web-Check</h3>
                            <p>Deep scan domains & infrastructure</p>
                        </div>
                        <div className="card-arrow">→</div>
                    </button>
                    <button className="mission-card" onClick={onNavigateToOsint}>
                        <div className="card-icon">
                            <img src="/OSINT.png" alt="OSINT" style={{width: '48px', height: '48px', objectFit: 'contain'}} />
                        </div>
                        <div className="card-content">
                            <h3>OSINT Toolkit</h3>
                            <p>Investigate identities & digital footprints</p>
                        </div>
                        <div className="card-arrow">→</div>
                    </button>
                </div>

                <div className="map-controls">
                    <h3>Threat Filter</h3>
                    <div className="filter-buttons">
                        {threatTypes.map(type => (
                            <button
                                key={type}
                                className={`filter-btn ${filter === type ? 'active' : ''}`}
                                onClick={() => setFilter(type)}
                            >
                                {type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="map-container">
                    {error && (
                        <div className="map-error" role="alert">
                            {error}
                        </div>
                    )}
                    <CyberThreatMap
                        filterType={filter}
                        onThreatClick={handleThreatClick}
                        onError={handleError}
                    />
                </div>

                <section className="dash-charts-row" aria-label="Threat and usage trends">
                    <ChartPanel title="Most Active Threat Types (Live Feed)">
                        <BarMeterList items={threatTypeBarItems} emptyText="No live threat data yet." />
                    </ChartPanel>
                    <ChartPanel title="Most Used OSINT Modules">
                        <BarMeterList items={moduleBarItems} emptyText="No OSINT investigations recorded yet." />
                    </ChartPanel>
                    <ChartPanel title="Scans Over Time (30 Days)">
                        <TrendLine points={stats?.scansOverTime ?? []} emptyText="No scans recorded yet." />
                    </ChartPanel>
                </section>

                <section className="dash-secondary-row" aria-label="Threat origins and recent activity">
                    <ChartPanel title="Threat Origins (Live Feed)">
                        <HostingCountriesMap countries={threatOriginCountries} />
                    </ChartPanel>
                    <ChartPanel title="Recent Activity">
                        <RecentActivityList items={stats?.recentActivity ?? []} />
                    </ChartPanel>
                </section>

                <div className="dash-health-row-container">
                    <SystemHealthWidget />
                </div>

                {selectedThreat && (
                    <div className="threat-modal-overlay" data-lenis-prevent onClick={() => setSelectedThreat(null)}>
                        <div className="threat-modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2>THREAT DETECTED</h2>
                                <button className="close-btn" onClick={() => setSelectedThreat(null)}>×</button>
                            </div>
                            <div className="modal-body">
                                <div className="threat-row">
                                    <span className="label">ID:</span>
                                    <span className="value mono">{selectedThreat.id}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">TYPE:</span>
                                    <span className="value highlight">{selectedThreat.type}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">SEVERITY:</span>
                                    <span className={`value badge ${selectedThreat.severity}`}>{selectedThreat.severity.toUpperCase()}</span>
                                </div>
                                <div className="threat-row">
                                    <span className="label">TIMESTAMP:</span>
                                    <span className="value mono">{new Date(selectedThreat.timestamp).toLocaleString()}</span>
                                </div>
                                <hr className="divider"/>
                                <div className="geo-info">
                                    <div>
                                        <h4>SOURCE</h4>
                                        <p>{selectedThreat.source.country}</p>
                                        <p>{selectedThreat.source.lat.toFixed(2)}, {selectedThreat.source.lng.toFixed(2)}</p>
                                    </div>
                                    {selectedThreat.destination && (
                                        <>
                                            <div className="arrow">➔</div>
                                            <div>
                                                <h4>TARGET</h4>
                                                <p>{selectedThreat.destination.country}</p>
                                                <p>{selectedThreat.destination.lat.toFixed(2)}, {selectedThreat.destination.lng.toFixed(2)}</p>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;
