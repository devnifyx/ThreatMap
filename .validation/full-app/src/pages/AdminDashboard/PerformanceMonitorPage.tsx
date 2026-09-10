// PERFORMANCE_MONITOR_PHASE1.md — Administration → System Performance.
// PERFORMANCE_MONITOR_PHASE2.md — extends the same page from host/system
// metrics to LekirraX APPLICATION health: Overview, API, Node.js, Database,
// Workers, Queue, Sessions — one compact resource navigation with System and
// Application groups (§21), NOT a second sidebar module. Phase 1 panels are
// unchanged. Values come exclusively from the two admin-gated endpoints;
// there are NO mock or random values anywhere in this file (§34). Every
// category renders independently so one unavailable metric never blanks the
// page (§28/§31).
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    Cpu, MemoryStick, HardDrive, Network, Info, RefreshCw, Pause, Play,
    Gauge, Server, Database, Bot, ListVideo, Users, ActivitySquare,
    Radar, ListChecks, LayoutGrid, ShieldAlert, Send, Images, Plug, AlertTriangle,
    TrendingUp, History, Sparkles, Target, Network as CorrelationIcon, FileText
} from 'lucide-react';
import './PerformanceMonitorPage.css';
import LiveLineChart from '../../components/LiveLineChart';
import HistoryChart from '../../components/HistoryChart';
import {
    getSystemPerformance, getApplicationPerformance, getIntelligencePerformance,
    getAnalyticsPerformance, getMetricSeriesApi, getAiPerformanceSummary,
    type PmSnapshot, type PmNetworkInterface, type PmDiskVolume, type PmDiskActivityVolume,
    type PmApplicationSnapshot, type PmHealthStatus, type PmIntelligenceSnapshot,
    type PmIntelModuleRow, type PmIntelProviderRow, type PmIntelQueueRow,
    type PmAnalyticsSnapshot, type PmMetricSeries, type PmAiSummary
} from '../../services/api';

// §19/§23 — 2-second sampling, 30 samples = the 60-second rolling window.
const POLL_INTERVAL_MS = 2000;
const MAX_SAMPLES = 30;

type ResourceKey =
    | { kind: 'cpu' }
    | { kind: 'memory' }
    | { kind: 'disk'; mount: string }
    | { kind: 'network'; name: string }
    | { kind: 'app-overview' }
    | { kind: 'app-api' }
    | { kind: 'app-node' }
    | { kind: 'app-database' }
    | { kind: 'app-workers' }
    | { kind: 'app-queue' }
    | { kind: 'app-sessions' }
    | { kind: 'intel-overview' }
    | { kind: 'intel-jobs' }
    | { kind: 'intel-modules' }
    | { kind: 'intel-threat' }
    | { kind: 'intel-telegram' }
    | { kind: 'intel-image' }
    | { kind: 'intel-providers' }
    | { kind: 'intel-bottlenecks' }
    | { kind: 'analytics-overview' }
    | { kind: 'analytics-trends' }
    | { kind: 'analytics-anomalies' }
    | { kind: 'analytics-bottlenecks' }
    | { kind: 'analytics-capacity' }
    | { kind: 'analytics-slo' }
    | { kind: 'analytics-timeline' }
    | { kind: 'analytics-report' }
    | { kind: 'analytics-ai' };

interface SidebarEntry {
    key: string;
    label: string;
    sub: string;
    value: string;
    icon: string;               // key into ICONS
    resource: ResourceKey;
    unavailable?: boolean;
    status?: PmHealthStatus;    // application entries carry component status
}

const ICONS: Record<string, React.ReactNode> = {
    cpu: <Cpu size={16} />,
    memory: <MemoryStick size={16} />,
    disk: <HardDrive size={16} />,
    network: <Network size={16} />,
    overview: <Gauge size={16} />,
    api: <ActivitySquare size={16} />,
    node: <Server size={16} />,
    database: <Database size={16} />,
    workers: <Bot size={16} />,
    queue: <ListVideo size={16} />,
    sessions: <Users size={16} />,
    info: <Info size={15} />,
    intel: <Radar size={16} />,
    jobs: <ListChecks size={16} />,
    modules: <LayoutGrid size={16} />,
    threat: <ShieldAlert size={16} />,
    telegram: <Send size={16} />,
    image: <Images size={16} />,
    providers: <Plug size={16} />,
    bottlenecks: <AlertTriangle size={16} />,
    analytics: <TrendingUp size={16} />,
    trends: <History size={16} />,
    anomalies: <AlertTriangle size={16} />,
    capacity: <Gauge size={16} />,
    slo: <Target size={16} />,
    timeline: <CorrelationIcon size={16} />,
    report: <FileText size={16} />,
    ai: <Sparkles size={16} />
};

// ─── formatting helpers ─────────────────────────────────────────────────────

function fmtBytes(bytes: number | null | undefined, digits = 1): string {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Not Available';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let v = bytes;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(u >= 2 ? digits : 0)} ${units[u]}`;
}

function fmtBytesPerSec(bytes: number | null | undefined): string {
    if (bytes === null || bytes === undefined || !Number.isFinite(bytes)) return 'Not Available';
    const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    let v = bytes;
    let u = 0;
    while (v >= 1024 && u < units.length - 1) { v /= 1024; u++; }
    return `${v.toFixed(u >= 2 ? 1 : 0)} ${units[u]}`;
}

function fmtMbps(bytesPerSec: number | null | undefined): string {
    if (bytesPerSec === null || bytesPerSec === undefined || !Number.isFinite(bytesPerSec)) return 'Not Available';
    const bits = bytesPerSec * 8;
    const units = ['bps', 'Kbps', 'Mbps', 'Gbps'];
    let v = bits;
    let u = 0;
    while (v >= 1000 && u < units.length - 1) { v /= 1000; u++; }
    return `${v.toFixed(v >= 100 ? 0 : v >= 10 ? 1 : 2)} ${units[u]}`;
}

function fmtPercent(p: number | null | undefined): string {
    if (p === null || p === undefined || !Number.isFinite(p)) return 'Not Available';
    return `${Math.round(p)}%`;
}

function fmtMs(ms: number | null | undefined): string {
    if (ms === null || ms === undefined || !Number.isFinite(ms)) return 'Not Available';
    return `${ms % 1 === 0 ? ms : ms.toFixed(1)} ms`;
}

function fmtGHz(mhz: number | null | undefined): string {
    if (mhz === null || mhz === undefined || !Number.isFinite(mhz) || mhz <= 0) return 'Not Available';
    return `${(mhz / 1000).toFixed(2)} GHz`;
}

function fmtUptime(seconds: number | null | undefined): string {
    if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return 'Not Available';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d} day${d === 1 ? '' : 's'} ${h} hour${h === 1 ? '' : 's'}`;
    if (h > 0) return `${h} hour${h === 1 ? '' : 's'} ${m} minute${m === 1 ? '' : 's'}`;
    return `${m} minute${m === 1 ? '' : 's'}`;
}

function fmtDurationSec(s: number | null | undefined): string {
    if (s === null || s === undefined || !Number.isFinite(s)) return 'Not Available';
    if (s < 90) return `${s.toFixed(s % 1 === 0 ? 0 : 1)} sec`;
    return fmtUptime(Math.round(s));
}

function num(n: number | null | undefined): string {
    if (n === null || n === undefined || !Number.isFinite(n)) return 'Not Available';
    return n.toLocaleString('en-US');
}

// bounded sample buffer — fixed length, drop-oldest
function pushSample(buf: (number | null)[], v: number | null): (number | null)[] {
    const next = v === null || !Number.isFinite(v) ? null : v;
    const out = [...buf, next];
    return out.length > MAX_SAMPLES ? out.slice(out.length - MAX_SAMPLES) : out;
}

function healthClass(s?: PmHealthStatus | string | null): string {
    switch (s) {
        case 'Healthy': return 'pm-health--healthy';
        case 'Busy': return 'pm-health--busy';
        case 'Elevated': return 'pm-health--elevated';
        case 'Degraded': return 'pm-health--degraded';
        case 'Delayed': case 'Blocked': return 'pm-health--blocked';
        case 'Critical': case 'Unavailable': return 'pm-health--critical';
        default: return 'pm-health--na';
    }
}

function HealthBadge({ status }: { status?: PmHealthStatus | string | null }) {
    return <span className={`pm-health-badge ${healthClass(status)}`}>{status ?? 'Not Available'}</span>;
}

// ─── component ──────────────────────────────────────────────────────────────

interface PerformanceMonitorPageProps {
    onBack: () => void;
}

export default function PerformanceMonitorPage({ onBack }: PerformanceMonitorPageProps) {
    // Phase 1 system snapshot
    const [snapshot, setSnapshot] = useState<PmSnapshot | null>(null);
    // Phase 2 application snapshot
    const [appSnapshot, setAppSnapshot] = useState<PmApplicationSnapshot | null>(null);
    // Phase 3 intelligence snapshot
    const [intelSnapshot, setIntelSnapshot] = useState<PmIntelligenceSnapshot | null>(null);
    // Phase 4 analytics snapshot
    const [analyticsSnapshot, setAnalyticsSnapshot] = useState<PmAnalyticsSnapshot | null>(null);
    const [analyticsError, setAnalyticsError] = useState<string | null>(null);
    // Phase 4 trend drill-down state
    const [trendMetric, setTrendMetric] = useState('app.api.latency_ms');
    const [trendRange, setTrendRange] = useState<'15m' | '1h' | '6h' | '24h' | '7d' | '30d'>('1h');
    const [trendSeries, setTrendSeries] = useState<PmMetricSeries | null>(null);
    const [aiSummary, setAiSummary] = useState<PmAiSummary | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [appError, setAppError] = useState<string | null>(null);
    const [intelError, setIntelError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [paused, setPaused] = useState(false);
    const [selected, setSelected] = useState<ResourceKey>({ kind: 'cpu' });

    // rolling 60s histories, each capped at MAX_SAMPLES
    const [cpuHist, setCpuHist] = useState<(number | null)[]>([]);
    const [memHist, setMemHist] = useState<(number | null)[]>([]);
    const [diskHist, setDiskHist] = useState<Record<string, (number | null)[]>>({});
    const [netHist, setNetHist] = useState<Record<string, { rx: (number | null)[]; tx: (number | null)[] }>>({});
    // Phase 2 histories
    const [apiLatHist, setApiLatHist] = useState<(number | null)[]>([]);
    const [heapHist, setHeapHist] = useState<(number | null)[]>([]);
    const [rssHist, setRssHist] = useState<(number | null)[]>([]);
    const [dbLatHist, setDbLatHist] = useState<(number | null)[]>([]);
    const [dbConnHist, setDbConnHist] = useState<(number | null)[]>([]);
    const [jobsHist, setJobsHist] = useState<(number | null)[]>([]);
    // Phase 3 histories
    const [osintRateHist, setOsintRateHist] = useState<(number | null)[]>([]);
    const [intelRunningHist, setIntelRunningHist] = useState<(number | null)[]>([]);

    const pausedRef = useRef(paused);
    pausedRef.current = paused;
    const inFlight = useRef(false);

    const poll = useCallback(async () => {
        if (inFlight.current) return;
        inFlight.current = true;
        try {
            // All snapshots in parallel; each fails independently (§28)
            const [sysP, appP, intelP, analyticsP] = await Promise.allSettled([
                getSystemPerformance(),
                getApplicationPerformance(),
                getIntelligencePerformance(),
                getAnalyticsPerformance()
            ]);
            if (pausedRef.current) { inFlight.current = false; return; }

            if (sysP.status === 'fulfilled') {
                setError(null);
                const snap = sysP.value;
                setSnapshot(snap);
                setCpuHist((h) => pushSample(h, snap.cpu.usagePercent));
                setMemHist((h) => pushSample(h, snap.memory.available ? snap.memory.usedPercent ?? null : null));
                setDiskHist((prev) => {
                    const next = { ...prev };
                    for (const v of snap.diskActivity.volumes ?? []) {
                        next[v.mount] = pushSample(prev[v.mount] ?? [], (v.readBytesPerSec ?? 0) + (v.writeBytesPerSec ?? 0));
                    }
                    return next;
                });
                setNetHist((prev) => {
                    const next = { ...prev };
                    for (const i of snap.network.interfaces ?? []) {
                        next[i.name] = {
                            rx: pushSample(prev[i.name]?.rx ?? [], i.rxBytesPerSec),
                            tx: pushSample(prev[i.name]?.tx ?? [], i.txBytesPerSec)
                        };
                    }
                    return next;
                });
            } else if (!pausedRef.current) {
                setError(sysP.reason?.message || 'Failed to load performance metrics');
            }

            if (appP.status === 'fulfilled') {
                setAppError(null);
                const app = appP.value;
                setAppSnapshot(app);
                setApiLatHist((h) => pushSample(h, app.api.available ? app.api.averageLatencyMs : null));
                setHeapHist((h) => pushSample(h, app.runtime.available ? app.runtime.heapUsedBytes : null));
                setRssHist((h) => pushSample(h, app.runtime.available ? app.runtime.rssBytes : null));
                setDbLatHist((h) => pushSample(h, app.database.available && app.database.latencyMs !== undefined ? app.database.latencyMs! : null));
                setDbConnHist((h) => pushSample(h, app.database.available && app.database.totalConnections !== undefined ? app.database.totalConnections! : null));
                setJobsHist((h) => pushSample(h, app.workers.available
                    ? (app.workers.jobsRunning ?? 0) + (app.workers.jobsQueued ?? 0)
                    : null));
            } else if (!pausedRef.current) {
                setAppError(appP.reason?.message || 'Failed to load application metrics');
            }

            if (intelP.status === 'fulfilled') {
                setIntelError(null);
                const intel = intelP.value;
                setIntelSnapshot(intel);
                setOsintRateHist((h) => pushSample(h, intel.overview.osintRunsLastHour));
                setIntelRunningHist((h) => pushSample(h, intel.overview.runningJobs + intel.overview.queuedJobs));
            } else if (!pausedRef.current) {
                setIntelError(intelP.reason?.message || 'Failed to load intelligence metrics');
            }

            if (analyticsP.status === 'fulfilled') {
                setAnalyticsError(null);
                setAnalyticsSnapshot(analyticsP.value);
            } else if (!pausedRef.current) {
                setAnalyticsError(analyticsP.reason?.message || 'Failed to load analytics');
            }
        } finally {
            inFlight.current = false;
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        poll();
        if (paused) return;
        const id = setInterval(poll, POLL_INTERVAL_MS);
        return () => clearInterval(id);
    }, [poll, paused]);

    // Phase 4 — historical series for the Trends panel (fetched on metric/
    // range change and refreshed on each poll cycle, bounded by the API).
    const loadTrendSeries = useCallback(async () => {
        try {
            const s = await getMetricSeriesApi(trendMetric, trendRange);
            if (!pausedRef.current) setTrendSeries(s);
        } catch (e: any) {
            if (!pausedRef.current) setTrendSeries({ available: false, metric: trendMetric, range: trendRange, resolution: 1, coveragePercent: 0, insufficientData: true, points: [] });
        }
    }, [trendMetric, trendRange]);

    useEffect(() => {
        loadTrendSeries();
        if (paused) return;
        const id = setInterval(loadTrendSeries, POLL_INTERVAL_MS * 5);   // 10s — historical, no need for 2s
        return () => clearInterval(id);
    }, [loadTrendSeries, paused]);

    const loadAiSummary = useCallback(async () => {
        setAiLoading(true);
        setAiError(null);
        try {
            const r = await getAiPerformanceSummary();
            setAiSummary(r.summary);
        } catch (e: any) {
            setAiError(e?.message || 'AI summary failed');
        } finally {
            setAiLoading(false);
        }
    }, []);

    // ─── sidebar entries, derived entirely from real snapshot data ──────
    const activityByMount = useMemo(() => {
        const map = new Map<string, PmDiskActivityVolume>();
        for (const v of snapshot?.diskActivity.volumes ?? []) map.set(v.mount, v);
        return map;
    }, [snapshot]);

    const sidebar = useMemo(() => {
        const entries: SidebarEntry[] = [];

        // ── SYSTEM group (Phase 1, unchanged) ──
        entries.push({
            key: 'cpu',
            label: 'CPU',
            sub: snapshot?.cpuSpeed.available && snapshot.cpuSpeed.speedMHz
                ? fmtGHz(snapshot.cpuSpeed.speedMHz)
                : (snapshot?.info.cpuModel ?? ''),
            value: snapshot?.cpu.available ? fmtPercent(snapshot.cpu.usagePercent) : 'Unavailable',
            icon: 'cpu',
            resource: { kind: 'cpu' },
            unavailable: !snapshot?.cpu.available
        });

        entries.push({
            key: 'memory',
            label: 'Memory',
            sub: snapshot?.memory.available ? `${fmtPercent(snapshot.memory.usedPercent)} in use` : 'System memory statistics unavailable',
            value: snapshot?.memory.available
                ? `${fmtBytes(snapshot.memory.usedBytes)} / ${fmtBytes(snapshot.memory.totalBytes)}`
                : 'Unavailable',
            icon: 'memory',
            resource: { kind: 'memory' },
            unavailable: !snapshot?.memory.available
        });

        for (const d of snapshot?.disks.disks ?? []) {
            const act = activityByMount.get(d.mount);
            const busy = act ? (act.readBytesPerSec ?? 0) + (act.writeBytesPerSec ?? 0) : null;
            entries.push({
                key: `disk:${d.mount}`,
                label: `Disk ${d.mount.replace('\\', '')}`,
                sub: busy !== null ? fmtBytesPerSec(busy) : 'No activity data',
                value: fmtPercent(d.usedPercent),
                icon: 'disk',
                resource: { kind: 'disk', mount: d.mount }
            });
        }
        if (snapshot && !snapshot.disks.available) {
            entries.push({
                key: 'disk:none',
                label: 'Disk',
                sub: 'No supported storage metrics available',
                value: 'Unavailable',
                icon: 'disk',
                resource: { kind: 'memory' },
                unavailable: true
            });
        }

        for (const i of snapshot?.network.interfaces ?? []) {
            if (i.internal) continue;
            const label = i.virtual ? `${i.name} (virtual)` : i.name;
            entries.push({
                key: `net:${i.name}`,
                label,
                sub: i.rxBytesPerSec !== null ? `${fmtMbps(i.rxBytesPerSec)} ↓  ${fmtMbps(i.txBytesPerSec)} ↑` : 'No rate data',
                value: i.rxBytesPerSec !== null ? fmtMbps(i.rxBytesPerSec + (i.txBytesPerSec ?? 0)) : 'Unavailable',
                icon: 'network',
                resource: { kind: 'network', name: i.name },
                unavailable: i.rxBytesPerSec === null
            });
        }
        if (snapshot && !snapshot.network.available && !entries.some((e) => e.key.startsWith('net:'))) {
            entries.push({
                key: 'net:none',
                label: 'Network',
                sub: 'No interface data available',
                value: 'Unavailable',
                icon: 'network',
                resource: { kind: 'cpu' },
                unavailable: true
            });
        }
        return entries;
    }, [snapshot, activityByMount]);

    // ── APPLICATION group (Phase 2) ──
    const appSidebar = useMemo(() => {
        const entries: SidebarEntry[] = [];
        const app = appSnapshot;

        entries.push({
            key: 'app-overview',
            label: 'Overview',
            sub: app ? `${app.health.overall}` : 'Application health',
            value: app ? fmtMs(app.api.averageLatencyMs) : '…',
            icon: 'overview',
            resource: { kind: 'app-overview' },
            status: app?.health.overall
        });

        entries.push({
            key: 'app-api',
            label: 'API',
            sub: app?.api.available ? `${app.api.requestsPerSecond} req/s` : 'No traffic data',
            value: app?.api.available ? fmtMs(app.api.averageLatencyMs) : 'Unavailable',
            icon: 'api',
            resource: { kind: 'app-api' },
            status: app?.health.components.api.status
        });

        entries.push({
            key: 'app-node',
            label: 'Node.js',
            sub: app?.runtime.available ? `${fmtBytes(app.runtime.rssBytes)} RSS` : 'Runtime data unavailable',
            value: app?.runtime.available ? `${fmtBytes(app.runtime.heapUsedBytes)} heap` : 'Unavailable',
            icon: 'node',
            resource: { kind: 'app-node' },
            status: app?.health.components.node.status
        });

        entries.push({
            key: 'app-database',
            label: 'Database',
            sub: app?.database.available ? `${app.database.totalConnections} / ${app.database.maxConnections} connections` : 'Database metrics unavailable',
            value: app?.database.available ? fmtMs(app.database.latencyMs) : 'Unavailable',
            icon: 'database',
            resource: { kind: 'app-database' },
            status: app?.health.components.database.status
        });

        entries.push({
            key: 'app-workers',
            label: 'Workers',
            sub: app?.workers.available ? `${app.workers.jobsRunning ?? 0} running · ${app.workers.jobsCompleted ?? 0} completed` : 'Worker metrics unavailable',
            value: app?.workers.available ? (app.workers.stuckJobs ? `${app.workers.stuckJobs} stuck` : `${app.workers.jobsRunning ?? 0} running`) : 'Unavailable',
            icon: 'workers',
            resource: { kind: 'app-workers' },
            status: app?.health.components.workers.status
        });

        entries.push({
            key: 'app-queue',
            label: 'Queue',
            sub: app?.workers.available ? `${app.workers.jobsQueued ?? 0} pending` : 'Queue metrics unavailable',
            value: app?.workers.available ? (app.workers.queueStatus ?? 'Not Available') : 'Unavailable',
            icon: 'queue',
            resource: { kind: 'app-queue' },
            status: (app?.workers.available
                ? (app.workers.queueStatus === 'Busy' || app.workers.queueStatus === 'Delayed' || app.workers.queueStatus === 'Blocked' ? 'Degraded' as const
                    : app.workers.queueStatus === 'Healthy' ? 'Healthy' as const : 'Unavailable' as const)
                : 'Unavailable' as const)
        });

        entries.push({
            key: 'app-sessions',
            label: 'Sessions',
            sub: app?.sessions.available ? `${app.sessions.activeSessions} / ${app.sessions.maxSessions} capacity` : 'Session metrics unavailable',
            value: app?.sessions.available ? fmtPercent(app.sessions.sessionUtilizationPercent) : 'Unavailable',
            icon: 'sessions',
            resource: { kind: 'app-sessions' },
            status: app?.health.components.sessions.status
        });
        return entries;
    }, [appSnapshot]);

    // ── INTELLIGENCE group (Phase 3) ──
    const intelSidebar = useMemo(() => {
        const entries: SidebarEntry[] = [];
        const intel = intelSnapshot;
        const b = intel?.bottlenecks;

        entries.push({
            key: 'intel-overview',
            label: 'Intelligence',
            sub: intel ? `${intel.overview.runningJobs} running · ${intel.overview.queuedJobs} queued` : 'Intelligence workload',
            value: intel ? `${intel.overview.osintRunsLastHour}/h OSINT` : '…',
            icon: 'intel',
            resource: { kind: 'intel-overview' },
            status: b && b.findings.length ? 'Degraded' : 'Healthy'
        });

        entries.push({
            key: 'intel-jobs',
            label: 'Active Jobs',
            sub: intel ? `${intel.activeJobs.jobs.length} in flight` : 'No active job data',
            value: intel ? `${intel.activeJobs.jobs.length}` : '…',
            icon: 'jobs',
            resource: { kind: 'intel-jobs' }
        });

        entries.push({
            key: 'intel-modules',
            label: 'OSINT Modules',
            sub: intel ? `${intel.modules.modules.length} modules measured` : 'No module data',
            value: intel ? `${intel.modules.modules.filter((m) => m.activeJobs > 0).length} active` : '…',
            icon: 'modules',
            resource: { kind: 'intel-modules' }
        });

        entries.push({
            key: 'intel-threat',
            label: 'Threat Intel',
            sub: intel?.threat.available ? `${intel.threat.itemsProcessedLastHour ?? 0} IOCs / hour` : 'Threat data unavailable',
            value: intel?.threat.available ? `${intel.threat.feedRunsLastHour ?? 0} feed runs/h` : 'Unavailable',
            icon: 'threat',
            resource: { kind: 'intel-threat' },
            status: intel?.threat.available && (intel.threat.failedRunsLastHour ?? 0) > 0 ? 'Degraded' : undefined
        });

        entries.push({
            key: 'intel-telegram',
            label: 'Telegram',
            sub: intel?.telegram.status === 'Not Configured' ? 'Crawler not configured' : 'Telegram intelligence',
            value: intel?.telegram.status ?? '…',
            icon: 'telegram',
            resource: { kind: 'intel-telegram' },
            status: intel?.telegram.status === 'Not Configured' ? undefined : undefined
        });

        entries.push({
            key: 'intel-image',
            label: 'Image Analysis',
            sub: intel?.image.available ? `${intel.image.completed24h ?? 0} completed (24h)` : 'Image data unavailable',
            value: intel?.image.available ? `${intel.image.queued ?? 0} queued` : 'Unavailable',
            icon: 'image',
            resource: { kind: 'intel-image' }
        });

        entries.push({
            key: 'intel-providers',
            label: 'Providers',
            sub: intel ? `${intel.providers.providers.filter((p) => p.configured).length} configured` : 'No provider data',
            value: intel ? `${intel.providers.providers.filter((p) => p.status === 'Rate Limited').length} rate-limited` : '…',
            icon: 'providers',
            resource: { kind: 'intel-providers' },
            status: intel && intel.providers.providers.some((p) => p.status === 'Rate Limited' || p.status === 'Degraded') ? 'Degraded' : undefined
        });

        entries.push({
            key: 'intel-bottlenecks',
            label: 'Bottlenecks',
            sub: b ? (b.findings.length ? `${b.findings.length} potential` : 'None detected') : 'No analysis data',
            value: b ? `${b.findings.length}` : '…',
            icon: 'bottlenecks',
            resource: { kind: 'intel-bottlenecks' },
            status: b && b.findings.length ? 'Degraded' : 'Healthy'
        });
        return entries;
    }, [intelSnapshot]);

    // ── ANALYTICS group (Phase 4) ──
    const analyticsSidebar = useMemo(() => {
        const entries: SidebarEntry[] = [];
        const a = analyticsSnapshot;
        const o = a?.overview;

        entries.push({
            key: 'analytics-overview',
            label: 'Analytics',
            sub: o ? `${o.openAnomalies} open anomalies · capacity ${o.capacityRisk}` : 'Historical analytics',
            value: o ? `SLO ${o.sloStatus}` : '…',
            icon: 'analytics',
            resource: { kind: 'analytics-overview' },
            status: o ? (o.openAnomalies > 0 || o.capacityRisk === 'Critical' || o.capacityRisk === 'High' ? 'Degraded' : 'Healthy') : undefined
        });

        entries.push({
            key: 'analytics-trends',
            label: 'Trends',
            sub: 'Historical series with baselines',
            value: trendRange,
            icon: 'trends',
            resource: { kind: 'analytics-trends' }
        });

        entries.push({
            key: 'analytics-anomalies',
            label: 'Anomalies',
            sub: o ? `${o.recentAnomalies} recent episodes` : 'No anomaly history',
            value: o ? `${o.openAnomalies} open` : '…',
            icon: 'anomalies',
            resource: { kind: 'analytics-anomalies' },
            status: o && o.openAnomalies > 0 ? 'Degraded' : 'Healthy'
        });

        entries.push({
            key: 'analytics-bottlenecks',
            label: 'Bottleneck History',
            sub: a ? `${a.bottlenecks.bottlenecks.length} recurring conditions` : 'No bottleneck history',
            value: a ? `${a.bottlenecks.bottlenecks.length}` : '…',
            icon: 'bottlenecks',
            resource: { kind: 'analytics-bottlenecks' }
        });

        entries.push({
            key: 'analytics-capacity',
            label: 'Capacity',
            sub: o ? `Risk: ${o.capacityRisk}` : 'No capacity data',
            value: o ? o.capacityRisk : '…',
            icon: 'capacity',
            resource: { kind: 'analytics-capacity' },
            status: o && (o.capacityRisk === 'High' || o.capacityRisk === 'Critical') ? 'Degraded' : undefined
        });

        entries.push({
            key: 'analytics-slo',
            label: 'SLO',
            sub: a ? `${a.slo.windows.filter((w) => w.status === 'Meeting').length}/${a.slo.windows.length} meeting` : 'No SLO data',
            value: o ? o.sloStatus : '…',
            icon: 'slo',
            resource: { kind: 'analytics-slo' },
            status: o && o.sloStatus === 'At Risk' ? 'Degraded' : undefined
        });

        entries.push({
            key: 'analytics-timeline',
            label: 'Timeline',
            sub: 'Incident correlation',
            value: '',
            icon: 'timeline',
            resource: { kind: 'analytics-timeline' }
        });

        entries.push({
            key: 'analytics-report',
            label: 'Report',
            sub: 'Evidence-based summary',
            value: '',
            icon: 'report',
            resource: { kind: 'analytics-report' }
        });

        entries.push({
            key: 'analytics-ai',
            label: 'AI Analysis',
            sub: 'AI operational summary',
            value: '',
            icon: 'ai',
            resource: { kind: 'analytics-ai' }
        });
        return entries;
    }, [analyticsSnapshot, trendRange]);

    // keep selection valid as disks/interfaces come and go
    useEffect(() => {
        const all = [...sidebar, ...appSidebar, ...intelSidebar, ...analyticsSidebar];
        if (!all.length) return;
        const ok = all.some((e) => resourceKeyOf(e.resource) === resourceKeyOf(selected));
        if (!ok) setSelected({ kind: 'cpu' });
    }, [sidebar, appSidebar, intelSidebar, analyticsSidebar, selected]);

    // ─── main panel renderers — System (Phase 1) ────────────────────────

    const renderCpuPanel = () => {
        const info = snapshot?.info;
        const usage = snapshot?.cpu;
        return (
            <section className="pm-panel" aria-label="CPU detail">
                <header className="pm-panel-head">
                    <h2>CPU</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{usage?.available ? fmtPercent(usage.usagePercent) : 'Unavailable'}</span>
                        <span className="pm-panel-head-note">utilization</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Usage</span><b>{usage?.available ? fmtPercent(usage.usagePercent) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Speed</span><b>{snapshot?.cpuSpeed.available ? fmtGHz(snapshot.cpuSpeed.speedMHz) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Base Speed</span><b>{fmtGHz(info?.baseSpeedMHz)}</b></div>
                    <div className="pm-kv"><span>Cores</span><b>{info?.physicalCores ?? 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Logical Processors</span><b>{info?.logicalCores ?? 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Load Average (1/5/15m)</span><b>{info?.loadAverage ? info.loadAverage.join(' / ') : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>System Uptime</span><b>{fmtUptime(info?.systemUptimeSeconds)}</b></div>
                </div>
                <h3 className="pm-chart-title">CPU Usage — last 60 seconds</h3>
                {usage && !usage.available && usage.reason === 'warming-up'
                    ? <div className="pm-chart-empty">Collecting first samples…</div>
                    : <LiveLineChart series={[{ label: 'CPU utilization', color: 'var(--pm-cyan)', values: cpuHist }]} maxOverride={100} formatY={(v) => `${Math.round(v)}%`} />}
            </section>
        );
    };

    const renderMemoryPanel = () => {
        const m = snapshot?.memory;
        return (
            <section className="pm-panel" aria-label="Memory detail">
                <header className="pm-panel-head">
                    <h2>Memory</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">
                            {m?.available ? `${fmtBytes(m.usedBytes)} / ${fmtBytes(m.totalBytes)}` : 'Unavailable'}
                        </span>
                        <span className="pm-panel-head-note">system memory in use</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>In Use</span><b>{m?.available ? fmtBytes(m.usedBytes) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Available</span><b>{m?.available ? fmtBytes(m.availableBytes) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Committed-Free</span><b>{m?.available ? fmtBytes(m.freeBytes) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Total</span><b>{m?.available ? fmtBytes(m.totalBytes) : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Utilization</span><b>{m?.available ? fmtPercent(m.usedPercent) : 'Not Available'}</b></div>
                </div>
                <h3 className="pm-chart-title">Memory Usage — last 60 seconds</h3>
                {m?.available
                    ? <LiveLineChart series={[{ label: 'Memory utilization', color: 'var(--pm-violet)', values: memHist }]} maxOverride={100} formatY={(v) => `${Math.round(v)}%`} />
                    : <div className="pm-chart-empty">Memory metrics temporarily unavailable.</div>}
            </section>
        );
    };

    const renderDiskPanel = (mount: string) => {
        const cap: PmDiskVolume | undefined = (snapshot?.disks.disks ?? []).find((d) => d.mount === mount);
        const act = activityByMount.get(mount);
        const hist = diskHist[mount] ?? [];
        return (
            <section className="pm-panel" aria-label={`Disk ${mount} detail`}>
                <header className="pm-panel-head">
                    <h2>Disk {mount.replace('\\', '')}</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{cap ? fmtPercent(cap.usedPercent) : 'Unavailable'}</span>
                        <span className="pm-panel-head-note">capacity in use</span>
                    </div>
                </header>
                {cap ? (
                    <>
                        <div className="pm-kv-grid">
                            <div className="pm-kv"><span>Capacity</span><b>{fmtBytes(cap.totalBytes)}</b></div>
                            <div className="pm-kv"><span>Used</span><b>{fmtBytes(cap.usedBytes)}</b></div>
                            <div className="pm-kv"><span>Available</span><b>{fmtBytes(cap.availableBytes)}</b></div>
                        </div>
                        <h3 className="pm-chart-title">Disk I/O Activity — last 60 seconds</h3>
                        {act
                            ? <LiveLineChart series={[{ label: 'Read + Write', color: 'var(--pm-amber)', values: hist }]} formatY={(v) => fmtBytesPerSec(v)} />
                            : <div className="pm-chart-empty">Disk activity is not supported on this platform.</div>}
                        {act && (
                            <div className="pm-kv-grid pm-kv-grid--below">
                                <div className="pm-kv"><span>Read Rate</span><b>{fmtBytesPerSec(act.readBytesPerSec)}</b></div>
                                <div className="pm-kv"><span>Write Rate</span><b>{fmtBytesPerSec(act.writeBytesPerSec)}</b></div>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="pm-chart-empty">No supported storage metrics available for this volume.</div>
                )}
            </section>
        );
    };

    const renderNetworkPanel = (name: string) => {
        const i: PmNetworkInterface | undefined = (snapshot?.network.interfaces ?? []).find((x) => x.name === name);
        const hist = netHist[name];
        return (
            <section className="pm-panel" aria-label={`Network ${name} detail`}>
                <header className="pm-panel-head">
                    <h2>{i?.name ?? name}</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">
                            {i?.rxBytesPerSec !== null && i ? `${fmtMbps(i.rxBytesPerSec)} ↓ / ${fmtMbps(i.txBytesPerSec)} ↑` : 'Unavailable'}
                        </span>
                        <span className="pm-panel-head-note">current throughput</span>
                    </div>
                </header>
                {i ? (
                    <>
                        <div className="pm-kv-grid">
                            <div className="pm-kv"><span>Status</span><b>{i.virtual ? 'Connected (virtual adapter)' : 'Connected'}</b></div>
                            <div className="pm-kv"><span>IPv4</span><b>{i.addressV4 ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Download</span><b>{fmtMbps(i.rxBytesPerSec)}</b></div>
                            <div className="pm-kv"><span>Upload</span><b>{fmtMbps(i.txBytesPerSec)}</b></div>
                            <div className="pm-kv"><span>Total Received</span><b>{fmtBytes(i.totalRxBytes)}</b></div>
                            <div className="pm-kv"><span>Total Sent</span><b>{fmtBytes(i.totalTxBytes)}</b></div>
                        </div>
                        <h3 className="pm-chart-title">Throughput — last 60 seconds</h3>
                        {hist && i.rxBytesPerSec !== null
                            ? (
                                <LiveLineChart
                                    series={[
                                        { label: 'Download', color: 'var(--pm-cyan)', values: hist.rx },
                                        { label: 'Upload', color: 'var(--pm-green)', values: hist.tx }
                                    ]}
                                    formatY={(v) => fmtBytesPerSec(v)}
                                />
                            )
                            : <div className="pm-chart-empty">Network metrics temporarily unavailable.</div>}
                    </>
                ) : (
                    <div className="pm-chart-empty">No interface data available.</div>
                )}
            </section>
        );
    };

    // ─── main panel renderers — Application (Phase 2) ───────────────────

    const renderAppOverview = () => {
        const app = appSnapshot;
        if (!app) return <div className="pm-empty-state">{appError || 'No application metrics available.'}</div>;
        const cards = [
            { label: 'API', value: fmtMs(app.api.averageLatencyMs), sub: app.api.available ? `${app.api.requestsPerSecond} req/s` : '', status: app.health.components.api.status },
            { label: 'Node.js', value: fmtBytes(app.runtime.rssBytes), sub: `heap ${fmtBytes(app.runtime.heapUsedBytes)}`, status: app.health.components.node.status },
            { label: 'Database', value: app.database.available ? `${app.database.totalConnections} / ${app.database.maxConnections}` : 'Unavailable', sub: app.database.available ? fmtMs(app.database.latencyMs) : '', status: app.health.components.database.status },
            { label: 'Jobs', value: `${app.workers.jobsRunning ?? 0} running`, sub: `${app.workers.jobsQueued ?? 0} queued`, status: app.health.components.workers.status },
            { label: 'Queue', value: `${app.workers.jobsQueued ?? 0} pending`, sub: app.workers.queueStatus ?? '', status: (app.workers.queueStatus === 'Blocked' || app.workers.queueStatus === 'Delayed' ? 'Degraded' : app.workers.queueStatus === 'Healthy' ? 'Healthy' : app.workers.available ? 'Unavailable' : undefined) },
            { label: 'Sessions', value: `${app.sessions.activeSessions ?? 0} active`, sub: `max ${app.sessions.maxSessions ?? '—'}`, status: app.health.components.sessions.status },
            { label: 'Errors', value: fmtPercent(app.api.errorRatePercent), sub: `${app.api.count4xx} 4xx · ${app.api.count5xx} 5xx`, status: undefined }
        ];
        return (
            <section className="pm-panel" aria-label="Application overview">
                <header className="pm-panel-head">
                    <h2>Application Health</h2>
                    <div className="pm-panel-head-stats">
                        <HealthBadge status={app.health.overall} />
                    </div>
                </header>
                <div className="pm-overview-grid">
                    {cards.map((c) => (
                        <div key={c.label} className={`pm-overview-card ${c.status ? healthClass(c.status) : ''}`}>
                            <span className="pm-overview-card-label">{c.label}</span>
                            <span className="pm-overview-card-value">{c.value}</span>
                            {c.sub && <span className="pm-overview-card-sub">{c.sub}</span>}
                            {c.status && <span className={`pm-overview-card-status ${healthClass(c.status)}`}>{c.status}</span>}
                        </div>
                    ))}
                </div>
                {app.health.overall !== 'Healthy' && (
                    <div className="pm-health-reasons">
                        {Object.entries(app.health.components)
                            .filter(([, c]) => c.status !== 'Healthy')
                            .map(([name, c]) => (
                                <div key={name} className="pm-health-reason">
                                    <b>{name.charAt(0).toUpperCase() + name.slice(1)}</b>: {c.status}{c.reason ? ` — ${c.reason}` : ''}
                                </div>
                            ))}
                    </div>
                )}
                <h3 className="pm-chart-title">API Response Time — last 60 seconds</h3>
                {app.api.available && app.api.totalRequests > 0
                    ? <LiveLineChart series={[{ label: 'Average latency', color: 'var(--pm-cyan)', values: apiLatHist }]} formatY={(v) => fmtMs(v)} />
                    : <div className="pm-chart-empty">No API traffic recorded.</div>}
                <h3 className="pm-chart-title">Node.js Process Memory — last 60 seconds</h3>
                <LiveLineChart
                    series={[
                        { label: 'RSS', color: 'var(--pm-violet)', values: rssHist },
                        { label: 'Heap Used', color: 'var(--pm-green)', values: heapHist }
                    ]}
                    formatY={(v) => fmtBytes(v, 0)}
                />
            </section>
        );
    };

    const renderAppApi = () => {
        const api = appSnapshot?.api;
        if (!api || !api.available) return <div className="pm-empty-state">{appError || 'API metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="API performance detail">
                <header className="pm-panel-head">
                    <h2>API Performance</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{api.requestsPerSecond} req/s</span>
                        <span className="pm-panel-head-note">last {api.windowSeconds}s · {num(api.activeRequests)} in flight</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Requests</span><b>{num(api.totalRequests)} in window</b></div>
                    <div className="pm-kv"><span>Average Latency</span><b>{fmtMs(api.averageLatencyMs)}</b></div>
                    <div className="pm-kv"><span>Median Latency</span><b>{fmtMs(api.medianLatencyMs)}</b></div>
                    <div className="pm-kv"><span>95th Percentile</span><b>{fmtMs(api.p95LatencyMs)}</b></div>
                    <div className="pm-kv"><span>Success Rate (2xx)</span><b>{fmtPercent(api.successRatePercent)}</b></div>
                    <div className="pm-kv"><span>Client Errors (4xx)</span><b>{num(api.count4xx)} · {fmtPercent(api.clientErrorRatePercent)}</b></div>
                    <div className="pm-kv"><span>Server Errors (5xx)</span><b>{num(api.count5xx)} · {fmtPercent(api.serverErrorRatePercent)}</b></div>
                    <div className="pm-kv"><span>Slow Requests (&gt; {api.slowRequestThresholdMs} ms)</span><b>{api.slowRequestsInWindow}</b></div>
                </div>
                <h3 className="pm-chart-title">API Response Time — last 60 seconds</h3>
                {api.totalRequests > 0
                    ? <LiveLineChart series={[{ label: 'Average latency', color: 'var(--pm-cyan)', values: apiLatHist }]} formatY={(v) => fmtMs(v)} />
                    : <div className="pm-chart-empty">No API traffic recorded.</div>}
                <h3 className="pm-chart-title">Slow Requests — recent (method and path only)</h3>
                {api.slowRequests.length ? (
                    <ul className="pm-slow-list">
                        {api.slowRequests.map((s, i) => (
                            <li key={i}><code>{s.method} {s.path}</code><b>{s.ms} ms</b></li>
                        ))}
                    </ul>
                ) : (
                    <div className="pm-chart-empty">No slow requests above the {api.slowRequestThresholdMs} ms threshold.</div>
                )}
            </section>
        );
    };

    const renderAppNode = () => {
        const rt = appSnapshot?.runtime;
        if (!rt || !rt.available) return <div className="pm-empty-state">{appError || 'Node.js runtime metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Node.js runtime detail">
                <header className="pm-panel-head">
                    <h2>Node.js Runtime</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{fmtBytes(rt.rssBytes)}</span>
                        <span className="pm-panel-head-note">process memory (RSS)</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Process CPU</span><b>{rt.processCpuPercent === null ? 'Collecting…' : fmtPercent(rt.processCpuPercent)}</b></div>
                    <div className="pm-kv"><span>Heap Used</span><b>{fmtBytes(rt.heapUsedBytes)}</b></div>
                    <div className="pm-kv"><span>Heap Total</span><b>{fmtBytes(rt.heapTotalBytes)}</b></div>
                    <div className="pm-kv"><span>External</span><b>{fmtBytes(rt.externalBytes)}</b></div>
                    <div className="pm-kv"><span>Array Buffers</span><b>{fmtBytes(rt.arrayBuffersBytes)}</b></div>
                    <div className="pm-kv"><span>Event Loop Delay</span><b>{rt.eventLoopDelayMs === null ? 'Collecting…' : fmtMs(rt.eventLoopDelayMs)} <HealthBadge status={rt.eventLoopStatus} /></b></div>
                    <div className="pm-kv"><span>Node.js</span><b>{rt.nodeVersion}</b></div>
                    <div className="pm-kv"><span>PID</span><b>{rt.processId}</b></div>
                    <div className="pm-kv"><span>Process Uptime</span><b>{fmtUptime(rt.processUptimeSeconds)}</b></div>
                </div>
                <h3 className="pm-chart-title">Node.js Process Memory — last 60 seconds (distinct from System Memory)</h3>
                <LiveLineChart
                    series={[
                        { label: 'RSS', color: 'var(--pm-violet)', values: rssHist },
                        { label: 'Heap Used', color: 'var(--pm-green)', values: heapHist }
                    ]}
                    formatY={(v) => fmtBytes(v, 0)}
                />
            </section>
        );
    };

    const renderAppDatabase = () => {
        const db = appSnapshot?.database;
        if (!db || !db.available) {
            return (
                <div className="pm-empty-state">
                    Database metrics unavailable{db?.reason ? `: ${db.reason}` : ''}.
                </div>
            );
        }
        return (
            <section className="pm-panel" aria-label="Database detail">
                <header className="pm-panel-head">
                    <h2>Database</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{fmtMs(db.latencyMs)}</span>
                        <span className="pm-panel-head-note">response time</span>
                        <HealthBadge status={db.status} />
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Connections</span><b>{db.totalConnections} / {db.maxConnections}</b></div>
                    <div className="pm-kv"><span>Active</span><b>{db.activeConnections}</b></div>
                    <div className="pm-kv"><span>Idle</span><b>{db.idleConnections}</b></div>
                    <div className="pm-kv"><span>Pool Utilization</span><b>{fmtPercent(db.poolUtilizationPercent)}</b></div>
                    <div className="pm-kv"><span>Waiting for Connection</span><b>{db.waitingRequests}</b></div>
                </div>
                <h3 className="pm-chart-title">Database Response Time — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'SELECT 1 round-trip', color: 'var(--pm-cyan)', values: dbLatHist }]} formatY={(v) => fmtMs(v)} />
                <h3 className="pm-chart-title">Pool Connections — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'Open connections', color: 'var(--pm-violet)', values: dbConnHist }]} formatY={(v) => String(Math.round(v))} />
            </section>
        );
    };

    const renderAppWorkers = () => {
        const w = appSnapshot?.workers;
        if (!w || !w.available) return <div className="pm-empty-state">{appError || 'Worker metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Background jobs detail">
                <header className="pm-panel-head">
                    <h2>Background Jobs</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{w.jobsRunning ?? 0}</span>
                        <span className="pm-panel-head-note">running · {w.jobsQueued ?? 0} queued</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Running</span><b>{num(w.jobsRunning)}</b></div>
                    <div className="pm-kv"><span>Queued</span><b>{num(w.jobsQueued)}</b></div>
                    <div className="pm-kv"><span>Completed</span><b>{num(w.jobsCompleted)}</b></div>
                    <div className="pm-kv"><span>Failed</span><b>{num(w.jobsFailed)}</b></div>
                    <div className="pm-kv"><span>Average Duration</span><b>{fmtDurationSec(w.averageJobDurationSeconds)}</b></div>
                    <div className="pm-kv"><span>Stuck (&gt; 15 min active)</span><b>{w.stuckJobs ?? 0}</b></div>
                    <div className="pm-kv"><span>Oldest Queued</span><b>{w.oldestQueuedAgeSeconds === null || w.oldestQueuedAgeSeconds === undefined ? 'None queued' : fmtDurationSec(w.oldestQueuedAgeSeconds)}</b></div>
                    <div className="pm-kv"><span>Last Completed</span><b>{w.lastCompletedAt ? new Date(w.lastCompletedAt).toLocaleString() : 'Never'}</b></div>
                </div>
                <h3 className="pm-chart-title">Job Activity (running + queued) — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'Active + queued jobs', color: 'var(--pm-amber)', values: jobsHist }]} formatY={(v) => String(Math.round(v))} />
                <h3 className="pm-chart-title">Background Pollers (in-process)</h3>
                <ul className="pm-slow-list">
                    {(w.pollers ?? []).map((p) => (
                        <li key={p.name}><code>{p.name}</code><b>every {p.intervalMs / 1000}s</b></li>
                    ))}
                </ul>
            </section>
        );
    };

    const renderAppQueue = () => {
        const w = appSnapshot?.workers;
        if (!w || !w.available) return <div className="pm-empty-state">{appError || 'Queue metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Queue detail">
                <header className="pm-panel-head">
                    <h2>Queue — {w.queue}</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{w.jobsQueued ?? 0}</span>
                        <span className="pm-panel-head-note">pending</span>
                        <HealthBadge status={w.queueStatus} />
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Pending</span><b>{num(w.jobsQueued)}</b></div>
                    <div className="pm-kv"><span>Running</span><b>{num(w.jobsRunning)}</b></div>
                    <div className="pm-kv"><span>Completed</span><b>{num(w.jobsCompleted)}</b></div>
                    <div className="pm-kv"><span>Failed</span><b>{num(w.jobsFailed)}</b></div>
                    <div className="pm-kv"><span>Oldest Pending Age</span><b>{w.oldestQueuedAgeSeconds === null || w.oldestQueuedAgeSeconds === undefined ? 'None queued' : fmtDurationSec(w.oldestQueuedAgeSeconds)}</b></div>
                </div>
                <h3 className="pm-chart-title">Queue Depth — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'Pending jobs', color: 'var(--pm-amber)', values: jobsHist }]} formatY={(v) => String(Math.round(v))} />
            </section>
        );
    };

    const renderAppSessions = () => {
        const s = appSnapshot?.sessions;
        if (!s || !s.available) return <div className="pm-empty-state">{appError || 'Session metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Active sessions detail">
                <header className="pm-panel-head">
                    <h2>Active Sessions</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{s.activeSessions}</span>
                        <span className="pm-panel-head-note">of {s.maxSessions} max</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Active Sessions</span><b>{s.activeSessions}</b></div>
                    <div className="pm-kv"><span>Maximum Concurrent</span><b>{s.maxSessions}</b></div>
                    <div className="pm-kv"><span>Session Utilization</span><b>{fmtPercent(s.sessionUtilizationPercent)}</b></div>
                </div>
                <p className="pm-note">Operational session counts only — LekirraX Performance does not track per-user activity.</p>
            </section>
        );
    };

    // ─── main panel renderers — Intelligence (Phase 3) ──────────────────

    const renderIntelOverview = () => {
        const intel = intelSnapshot;
        if (!intel) return <div className="pm-empty-state">{intelError || 'No intelligence metrics available.'}</div>;
        const o = intel.overview;
        const cards = [
            { label: 'Active Jobs', value: `${o.runningJobs}`, sub: `${o.queuedJobs} queued` },
            { label: 'Investigations', value: `${o.activeInvestigations}`, sub: 'active' },
            { label: 'OSINT Runs', value: `${o.osintRunsLastHour}/h`, sub: 'last hour' },
            { label: 'Failed Jobs', value: `${o.failedJobsRecent}`, sub: 'recent' },
            { label: 'IOC Processing', value: `${intel.threat.itemsProcessedLastHour ?? 0}/h`, sub: `${intel.threat.feedRunsLastHour ?? 0} feed runs` },
            { label: 'Provider Calls', value: `${o.providerRequestsLastMinute}`, sub: 'recorded' },
            { label: 'Image Jobs', value: `${o.imageJobsQueued}`, sub: 'queued' },
            { label: 'Telegram', value: intel.telegram.status === 'Not Configured' ? 'Not Configured' : 'Configured', sub: 'crawler' }
        ];
        return (
            <section className="pm-panel" aria-label="Intelligence overview">
                <header className="pm-panel-head">
                    <h2>Intelligence Workload</h2>
                    <div className="pm-panel-head-stats">
                        <HealthBadge status={intel.bottlenecks.findings.length ? 'Degraded' : 'Healthy'} />
                    </div>
                </header>
                <div className="pm-overview-grid">
                    {cards.map((c) => (
                        <div key={c.label} className="pm-overview-card">
                            <span className="pm-overview-card-label">{c.label}</span>
                            <span className="pm-overview-card-value">{c.value}</span>
                            {c.sub && <span className="pm-overview-card-sub">{c.sub}</span>}
                        </div>
                    ))}
                </div>
                <h3 className="pm-chart-title">Intelligence Jobs (running + queued) — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'Active + queued jobs', color: 'var(--pm-amber)', values: intelRunningHist }]} formatY={(v) => String(Math.round(v))} />
                <h3 className="pm-chart-title">OSINT Runs (per hour, sampled) — last 60 seconds</h3>
                <LiveLineChart series={[{ label: 'OSINT runs/h', color: 'var(--pm-cyan)', values: osintRateHist }]} formatY={(v) => String(Math.round(v))} />
            </section>
        );
    };

    const renderIntelJobs = () => {
        const jobs = intelSnapshot?.activeJobs;
        if (!jobs || !jobs.available) return <div className="pm-empty-state">{intelError || 'Active job data unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Active intelligence jobs">
                <header className="pm-panel-head">
                    <h2>Active Intelligence Jobs</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{jobs.jobs.length}</span>
                        <span className="pm-panel-head-note">in flight — in-process + queued workloads</span>
                    </div>
                </header>
                {jobs.jobs.length ? (
                    <table className="pm-table" aria-label="Active jobs table">
                        <thead>
                            <tr><th>Job</th><th>Type</th><th>Module</th><th>Status</th><th>Started</th><th>Duration</th><th>Worker</th></tr>
                        </thead>
                        <tbody>
                            {jobs.jobs.map((j) => (
                                <tr key={j.id}>
                                    <td><code>{j.id}</code></td>
                                    <td>{j.type}</td>
                                    <td>{j.module}</td>
                                    <td><span className={`pm-health-badge ${j.status === 'Running' ? 'pm-health--healthy' : 'pm-health--degraded'}`}>{j.status}</span></td>
                                    <td>{j.startedAt ? new Date(j.startedAt).toLocaleTimeString() : '—'}</td>
                                    <td>{j.durationSeconds !== null ? fmtDurationSec(j.durationSeconds) : '—'}</td>
                                    <td>{j.worker}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="pm-chart-empty">No intelligence jobs currently in flight. Queued DB-backed work appears under its queue below.</div>
                )}
                {(intelSnapshot?.queues.available && intelSnapshot.queues.queues.length) ? (
                    <>
                        <h3 className="pm-chart-title">Queues</h3>
                        <table className="pm-table" aria-label="Queues table">
                            <thead><tr><th>Queue</th><th>Pending</th><th>Running</th><th>Failed</th><th>Oldest Job</th><th>Status</th></tr></thead>
                            <tbody>
                                {intelSnapshot.queues.queues.map((q: PmIntelQueueRow) => (
                                    <tr key={q.name}>
                                        <td><code>{q.name}</code></td>
                                        <td>{q.pending}</td>
                                        <td>{q.running}</td>
                                        <td>{q.failed}</td>
                                        <td>{q.oldestJobAgeSeconds !== null && q.oldestJobAgeSeconds !== undefined ? fmtDurationSec(q.oldestJobAgeSeconds) : '—'}</td>
                                        <td><HealthBadge status={q.status} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </>
                ) : null}
            </section>
        );
    };

    const renderIntelModules = () => {
        const mods = intelSnapshot?.modules;
        if (!mods || !mods.available) return <div className="pm-empty-state">{intelError || 'OSINT module metrics unavailable.'}</div>;
        const withData = mods.modules.filter((m) => m.totalRuns > 0 || m.jobs24h > 0 || m.activeJobs > 0);
        return (
            <section className="pm-panel" aria-label="OSINT module performance">
                <header className="pm-panel-head">
                    <h2>OSINT Module Performance</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{withData.length}</span>
                        <span className="pm-panel-head-note">modules with measured activity</span>
                    </div>
                </header>
                {withData.length ? (
                    <table className="pm-table" aria-label="Module performance comparison">
                        <thead>
                            <tr><th>Module</th><th>Active</th><th>Runs (1h)</th><th>Runs (24h)</th><th>Avg Duration</th><th>Median</th><th>95th</th><th>Failure</th></tr>
                        </thead>
                        <tbody>
                            {withData.map((m: PmIntelModuleRow) => (
                                <tr key={m.module}>
                                    <td>{m.module}</td>
                                    <td>{m.activeJobs}</td>
                                    <td>{m.runsLastHour}</td>
                                    <td>{m.jobs24h}</td>
                                    <td>{m.avgDurationMs !== null ? `${(m.avgDurationMs / 1000).toFixed(2)}s` : 'Not Available'}</td>
                                    <td>{m.medianDurationMs != null ? `${(m.medianDurationMs / 1000).toFixed(2)}s` : '—'}</td>
                                    <td>{m.p95DurationMs != null ? `${(m.p95DurationMs / 1000).toFixed(2)}s` : '—'}</td>
                                    <td>{m.failureRatePercent !== null ? `${m.failureRatePercent}%` : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="pm-chart-empty">No OSINT module runs recorded in this process yet.</div>
                )}
                <p className="pm-note">Durations are real measurements from this process; 24h counts come from osint_activity. DB-only modules show throughput without durations.</p>
            </section>
        );
    };

    const renderIntelThreat = () => {
        const t = intelSnapshot?.threat;
        if (!t || !t.available) return <div className="pm-empty-state">{intelError || 'Threat intelligence metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Threat intelligence performance">
                <header className="pm-panel-head">
                    <h2>Threat Intelligence</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{t.itemsProcessedLastHour ?? 0}</span>
                        <span className="pm-panel-head-note">IOCs processed / hour</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Feed Runs (1h)</span><b>{t.feedRunsLastHour ?? 0}</b></div>
                    <div className="pm-kv"><span>Items Collected (1h)</span><b>{t.itemsCollectedLastHour ?? 0}</b></div>
                    <div className="pm-kv"><span>Duplicates (1h)</span><b>{t.duplicatesLastHour ?? 0}</b></div>
                    <div className="pm-kv"><span>Rejected (1h)</span><b>{t.rejectedLastHour ?? 0}</b></div>
                    <div className="pm-kv"><span>Failed Runs (1h)</span><b>{t.failedRunsLastHour ?? 0}</b></div>
                    <div className="pm-kv"><span>Avg Run Duration</span><b>{t.avgRunSeconds !== null && t.avgRunSeconds !== undefined ? `${t.avgRunSeconds.toFixed(2)}s` : 'Not Available'}</b></div>
                </div>
                <h3 className="pm-chart-title">Feeds</h3>
                <table className="pm-table" aria-label="Threat feeds table">
                    <thead><tr><th>Feed</th><th>Runs (1h)</th><th>Errors (1h)</th><th>Last Success</th></tr></thead>
                    <tbody>
                        {(t.feeds ?? []).map((f) => (
                            <tr key={f.key}>
                                <td><code>{f.key}</code></td>
                                <td>{f.runsLastHour}</td>
                                <td>{f.errorsLastHour}</td>
                                <td>{f.lastSuccessAt ? new Date(f.lastSuccessAt).toLocaleTimeString() : 'Never'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="pm-note">Counts from feed_runs ingestion telemetry — no IOC contents are displayed.</p>
            </section>
        );
    };

    const renderIntelTelegram = () => {
        const tg = intelSnapshot?.telegram;
        if (!tg) return <div className="pm-empty-state">{intelError || 'Telegram metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Telegram crawler performance">
                <header className="pm-panel-head">
                    <h2>Telegram Intelligence</h2>
                    <div className="pm-panel-head-stats">
                        <HealthBadge status={tg.status === 'Not Configured' ? 'Unavailable' : 'Healthy'} />
                        <span className="pm-panel-head-note">{tg.status}</span>
                    </div>
                </header>
                {tg.status === 'Not Configured' ? (
                    <>
                        <div className="pm-chart-empty">Telegram crawler is Not Configured — no crawler, client or message collection exists in this deployment. No statistics are fabricated.</div>
                        <p className="pm-note">Available today: public username presence checks (t.me) via Username/Social Media Intelligence. Everything else requires Telegram client configuration in a future phase.</p>
                    </>
                ) : (
                    <div className="pm-chart-empty">Telegram crawler configured — per-capability monitoring will appear once the crawler reports activity.</div>
                )}
                <h3 className="pm-chart-title">Capability</h3>
                <ul className="pm-slow-list">
                    {Object.entries(tg.capability).map(([k, v]) => (
                        <li key={k}><code>{k}</code><b>{v === 'AVAILABLE' ? 'Available' : v === 'NOT_CONFIGURED' ? 'Not Configured' : v}</b></li>
                    ))}
                </ul>
            </section>
        );
    };

    const renderIntelImage = () => {
        const img = intelSnapshot?.image;
        if (!img || !img.available) return <div className="pm-empty-state">{intelError || 'Image intelligence metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Image intelligence performance">
                <header className="pm-panel-head">
                    <h2>Image Intelligence</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{img.completed24h ?? 0}</span>
                        <span className="pm-panel-head-note">reverse searches completed (24h)</span>
                    </div>
                </header>
                <div className="pm-kv-grid">
                    <div className="pm-kv"><span>Queued / Pending</span><b>{img.queued ?? 0}</b></div>
                    <div className="pm-kv"><span>Completed (24h)</span><b>{img.completed24h ?? 0}</b></div>
                    <div className="pm-kv"><span>Failed (24h)</span><b>{img.failed24h ?? 0}</b></div>
                    <div className="pm-kv"><span>Rate Limited (24h)</span><b>{img.rateLimited24h ?? 0}</b></div>
                    <div className="pm-kv"><span>Unavailable (24h)</span><b>{img.unavailable24h ?? 0}</b></div>
                    <div className="pm-kv"><span>Avg Search Duration</span><b>{img.avgDurationSeconds !== null && img.avgDurationSeconds !== undefined ? `${img.avgDurationSeconds.toFixed(1)}s` : 'Not Available'}</b></div>
                    <div className="pm-kv"><span>Images Analyzed (24h)</span><b>{img.images24h ?? 0}</b></div>
                    <div className="pm-kv"><span>Possibly Stuck (&gt;5m pending)</span><b>{img.possiblyStuck ?? 0}</b></div>
                </div>
                <p className="pm-note">OCR/QR jobs run inline within image analysis (no separate job rows); reverse-search jobs are the measurable unit here.</p>
            </section>
        );
    };

    const renderIntelProviders = () => {
        const prov = intelSnapshot?.providers;
        if (!prov || !prov.available) return <div className="pm-empty-state">{intelError || 'Provider metrics unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="External provider performance">
                <header className="pm-panel-head">
                    <h2>External Providers</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{prov.providers.filter((p) => p.configured).length}</span>
                        <span className="pm-panel-head-note">configured — measured from real application calls</span>
                    </div>
                </header>
                <table className="pm-table" aria-label="Provider performance table">
                    <thead>
                        <tr><th>Provider</th><th>Status</th><th>Requests</th><th>Success</th><th>Avg Latency</th><th>Rate Limits</th><th>Last Success</th></tr>
                    </thead>
                    <tbody>
                        {prov.providers.map((p: PmIntelProviderRow) => (
                            <tr key={p.id}>
                                <td><code>{p.id}</code></td>
                                <td>
                                    {/* raw operational status text + badge mapping */}
                                    <span style={{ marginRight: '0.45rem' }}>{p.status}</span>
                                    <HealthBadge status={
                                        p.status === 'Healthy' ? 'Healthy'
                                            : p.status === 'Rate Limited' ? 'Critical'
                                                : p.status === 'Degraded' ? 'Degraded'
                                                    : 'Unavailable'
                                    } />
                                </td>
                                <td>{p.requests !== undefined ? p.requests : '—'}</td>
                                <td>{p.successRatePercent !== null && p.successRatePercent !== undefined ? `${p.successRatePercent}%` : '—'}</td>
                                <td>{p.averageLatencyMs !== null && p.averageLatencyMs !== undefined ? fmtMs(p.averageLatencyMs) : '—'}</td>
                                <td>{p.rateLimitEvents !== undefined ? p.rateLimitEvents : '—'}</td>
                                <td>{p.lastSuccessfulRequestAt ? new Date(p.lastSuccessfulRequestAt).toLocaleTimeString() : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="pm-note">Latency/success measured only from real application calls — providers are never pinged just to populate this table.</p>
            </section>
        );
    };

    const renderIntelBottlenecks = () => {
        const b = intelSnapshot?.bottlenecks;
        const w = intelSnapshot?.workload;
        if (!b) return <div className="pm-empty-state">{intelError || 'Bottleneck analysis unavailable.'}</div>;
        return (
            <section className="pm-panel" aria-label="Bottleneck analysis">
                <header className="pm-panel-head">
                    <h2>Potential Bottlenecks</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{b.findings.length}</span>
                        <span className="pm-panel-head-note">evidence-based indicators — never root cause claims</span>
                    </div>
                </header>
                {b.findings.length ? (
                    <ul className="pm-bottleneck-list">
                        {b.findings.map((f, i) => (
                            <li key={i} className={`pm-bottleneck pm-bottleneck--${f.severity}`}>
                                <span className="pm-bottleneck-condition"><code>{f.condition}</code></span>
                                <span className="pm-bottleneck-area">{f.area}</span>
                                <span className="pm-bottleneck-evidence">{f.evidence}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="pm-chart-empty">No bottleneck indicators currently detected.</div>
                )}
                <h3 className="pm-chart-title">Observed Correlations (not confirmed causes)</h3>
                {w && w.observations.length ? (
                    <ul className="pm-slow-list">
                        {w.observations.map((obs, i) => (
                            <li key={i}><code>{obs.kind}</code><b style={{ color: '#c9d1d9', fontWeight: 400 }}>{obs.observation}</b></li>
                        ))}
                    </ul>
                ) : (
                    <div className="pm-chart-empty">No workload/resource correlations observed right now.</div>
                )}
                {w && (
                    <p className="pm-note">
                        {w.attributionNote} Workers: {intelSnapshot?.workers.available
                            ? intelSnapshot!.workers.workers.map((wk) => `${wk.name} (${wk.status})`).join(', ')
                            : 'unavailable'}.
                    </p>
                )}
            </section>
        );
    };

    // ─── main panel renderers — Analytics (Phase 4) ─────────────────────

    const TREND_METRICS: { key: string; label: string; fmt?: (v: number | null) => string }[] = [
        { key: 'app.api.latency_ms', label: 'API Latency', fmt: fmtMs },
        { key: 'app.api.error_rate_percent', label: 'API Error Rate', fmt: fmtPercent },
        { key: 'system.cpu.percent', label: 'CPU', fmt: fmtPercent },
        { key: 'system.memory.percent', label: 'Memory', fmt: fmtPercent },
        { key: 'app.node.rss_bytes', label: 'Node.js RSS', fmt: (v) => fmtBytes(v, 0) },
        { key: 'app.node.event_loop_delay_ms', label: 'Event Loop Delay', fmt: fmtMs },
        { key: 'app.db.latency_ms', label: 'Database Latency', fmt: fmtMs },
        { key: 'app.db.connections', label: 'DB Connections', fmt: (v) => (v === null ? '—' : String(Math.round(v))) },
        { key: 'app.queue.depth', label: 'Queue Depth', fmt: (v) => (v === null ? '—' : String(Math.round(v))) }
    ];
    const RANGES: typeof trendRange[] = ['15m', '1h', '6h', '24h', '7d', '30d'];

    const renderAnalyticsOverview = () => {
        const a = analyticsSnapshot;
        if (!a) return <div className="pm-empty-state">{analyticsError || 'No analytics data available yet.'}</div>;
        const o = a.overview;
        const cards = [
            { label: 'System Health', value: o.systemHealth, status: o.systemHealth === 'Healthy' ? 'Healthy' : 'Degraded' },
            { label: 'Application Health', value: o.applicationHealth, status: o.applicationHealth === 'Healthy' ? 'Healthy' : 'Degraded' },
            { label: 'Intelligence Health', value: o.intelligenceHealth, status: o.intelligenceHealth === 'Healthy' ? 'Healthy' : 'Degraded' },
            { label: 'Open Anomalies', value: `${o.openAnomalies}`, sub: `${o.recentAnomalies} recent` },
            { label: 'Capacity Risk', value: o.capacityRisk, status: o.capacityRisk === 'High' || o.capacityRisk === 'Critical' ? 'Degraded' : 'Healthy' },
            { label: 'SLO Status', value: o.sloStatus, status: o.sloStatus === 'At Risk' ? 'Degraded' : undefined }
        ];
        return (
            <section className="pm-panel" aria-label="Analytics overview">
                <header className="pm-panel-head">
                    <h2>Historical Analytics</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-panel-head-note">overhead: avg collect {a.overhead.averageCollectionMs ?? '—'} ms · {a.overhead.rowsStored} rows stored</span>
                    </div>
                </header>
                <div className="pm-overview-grid">
                    {cards.map((c) => (
                        <div key={c.label} className={`pm-overview-card ${c.status ? healthClass(c.status) : ''}`}>
                            <span className="pm-overview-card-label">{c.label}</span>
                            <span className="pm-overview-card-value">{c.value}</span>
                            {c.sub && <span className="pm-overview-card-sub">{c.sub}</span>}
                        </div>
                    ))}
                </div>
                <h3 className="pm-chart-title">Recent Anomaly Episodes</h3>
                {a.anomalies.events.length ? (
                    <ul className="pm-bottleneck-list">
                        {a.anomalies.events.slice(0, 5).map((e, i) => (
                            <li key={i} className={`pm-bottleneck pm-bottleneck--${e.severity === 'critical' || e.severity === 'high' ? 'high' : 'medium'}`}>
                                <span className="pm-bottleneck-condition"><code>{e.condition}</code></span>
                                <span className="pm-bottleneck-area">{e.component}{e.endedAt === null ? ' (ongoing)' : ''}</span>
                                <span className="pm-bottleneck-evidence">{new Date(e.startedAt).toLocaleString()} — {e.evidence ?? ''}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="pm-chart-empty">No anomaly episodes recorded yet — history is building.</div>
                )}
            </section>
        );
    };

    const renderAnalyticsTrends = () => {
        const fmt = TREND_METRICS.find((m) => m.key === trendMetric)?.fmt;
        const anomalyStarts = (analyticsSnapshot?.anomalies.events ?? [])
            .filter((e) => e.metric === trendMetric)
            .map((e) => e.startedAt);
        return (
            <section className="pm-panel" aria-label="Historical trends">
                <header className="pm-panel-head">
                    <h2>Historical Trends</h2>
                </header>
                <div className="pm-trend-controls">
                    <label>
                        Metric
                        <select value={trendMetric} onChange={(e) => setTrendMetric(e.target.value)}>
                            {TREND_METRICS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                        </select>
                    </label>
                    <div className="pm-range-buttons" role="group" aria-label="Time range">
                        {RANGES.map((r) => (
                            <button key={r} type="button" className={`pm-btn pm-btn--range ${trendRange === r ? 'pm-btn--range-active' : ''}`} onClick={() => setTrendRange(r)}>{r}</button>
                        ))}
                    </div>
                </div>
                {trendSeries ? (
                    <>
                        {trendSeries.insufficientData ? (
                            <div className="pm-chart-empty">Insufficient historical data for this metric/range — collection is running and history is building.</div>
                        ) : (
                            <>
                                <HistoryChart
                                    points={trendSeries.points}
                                    anomalyMarkers={anomalyStarts}
                                    formatY={fmt}
                                />
                                <p className="pm-note">Resolution {trendSeries.resolution}m · {trendSeries.points.length} buckets · coverage {trendSeries.coveragePercent}% of window. Gaps are missing data, never interpolated.</p>
                            </>
                        )}
                    </>
                ) : (
                    <div className="pm-chart-empty">Loading series…</div>
                )}
            </section>
        );
    };

    const renderAnalyticsAnomalies = () => {
        const evts = analyticsSnapshot?.anomalies;
        const fmtAnom = TREND_METRICS.find((m) => m.key === trendMetric)?.fmt;
        if (!evts || !evts.available) return <div className="pm-empty-state">{analyticsError || 'No anomaly history yet.'}</div>;
        return (
            <section className="pm-panel" aria-label="Anomaly history">
                <header className="pm-panel-head">
                    <h2>Anomaly Episodes</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-big-value">{evts.events.filter((e) => e.endedAt === null).length}</span>
                        <span className="pm-panel-head-note">ongoing — deduplicated episodes, not samples</span>
                    </div>
                </header>
                {evts.events.length ? (
                    <table className="pm-table" aria-label="Anomaly episodes">
                        <thead><tr><th>Condition</th><th>Component</th><th>Severity</th><th>Started</th><th>Ended</th><th>Duration</th><th>Peak</th><th>Alert</th></tr></thead>
                        <tbody>
                            {evts.events.map((e, i) => (
                                <tr key={i}>
                                    <td><code>{e.condition}</code></td>
                                    <td>{e.component}</td>
                                    <td><HealthBadge status={e.severity === 'critical' || e.severity === 'high' ? 'Critical' : e.severity === 'medium' ? 'Degraded' : 'Healthy'} /></td>
                                    <td>{new Date(e.startedAt).toLocaleString()}</td>
                                    <td>{e.endedAt ? new Date(e.endedAt).toLocaleTimeString() : 'ongoing'}</td>
                                    <td>{e.durationSeconds !== null ? fmtDurationSec(e.durationSeconds) : '—'}</td>
                                    <td>{e.peakValue !== null ? (fmtAnom ? fmtAnom(e.peakValue) : Math.round(e.peakValue)) : '—'}</td>
                                    <td>{e.alertId ? <code>#{e.alertId}</code> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="pm-chart-empty">No anomaly episodes recorded.</div>
                )}
                <p className="pm-note">Episodes require sustained threshold breach; severity reflects magnitude, never a single spike.</p>
            </section>
        );
    };

    const renderAnalyticsBottlenecks = () => {
        const b = analyticsSnapshot?.bottlenecks;
        if (!b || !b.available) return <div className="pm-empty-state">{analyticsError || 'No bottleneck history yet.'}</div>;
        return (
            <section className="pm-panel" aria-label="Bottleneck history">
                <header className="pm-panel-head">
                    <h2>Bottleneck History</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-panel-head-note">recurring conditions — potential bottlenecks, never root cause</span>
                    </div>
                </header>
                {b.bottlenecks.length ? (
                    <table className="pm-table" aria-label="Bottleneck history">
                        <thead><tr><th>Condition</th><th>Component</th><th>First Detected</th><th>Last Detected</th><th>Occurrences</th><th>Avg Duration</th><th>State</th></tr></thead>
                        <tbody>
                            {b.bottlenecks.map((x) => (
                                <tr key={x.condition}>
                                    <td><code>{x.condition}</code></td>
                                    <td>{x.component}</td>
                                    <td>{new Date(x.firstDetectedAt).toLocaleString()}</td>
                                    <td>{new Date(x.lastDetectedAt).toLocaleString()}</td>
                                    <td>{x.occurrences}</td>
                                    <td>{x.averageDurationSeconds !== null ? fmtDurationSec(x.averageDurationSeconds) : '—'}</td>
                                    <td>{x.openNow ? <span className="pm-health-badge pm-health--degraded">ongoing</span> : 'resolved'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <div className="pm-chart-empty">No bottleneck conditions recorded yet.</div>
                )}
            </section>
        );
    };

    const renderAnalyticsCapacity = () => {
        const c = analyticsSnapshot?.capacity;
        if (!c || !c.available) return <div className="pm-empty-state">{analyticsError || 'No capacity data yet.'}</div>;
        return (
            <section className="pm-panel" aria-label="Capacity analysis">
                <header className="pm-panel-head">
                    <h2>Capacity</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-panel-head-note">30-day utilization + drift forecasts (labeled Forecast, never certain)</span>
                    </div>
                </header>
                <table className="pm-table" aria-label="Capacity table">
                    <thead><tr><th>Resource</th><th>Current</th><th>30d Avg</th><th>30d Peak</th><th>Utilization</th><th>Band</th><th>Forecast</th></tr></thead>
                    <tbody>
                        {c.capacity.map((row) => (
                            <tr key={row.metric}>
                                <td>{row.label}</td>
                                <td>{row.current !== null ? `${Math.round(row.current * 10) / 10} ${row.unit}` : 'Not Available'}</td>
                                <td>{row.thirtyDayAverage !== null ? Math.round(row.thirtyDayAverage * 10) / 10 : 'Insufficient'}</td>
                                <td>{row.thirtyDayPeak !== null ? Math.round(row.thirtyDayPeak * 10) / 10 : 'Insufficient'}</td>
                                <td>{row.utilizationPercent !== null ? `${row.utilizationPercent}%` : '—'}</td>
                                <td><HealthBadge status={row.band === 'Normal' ? 'Healthy' : row.band === 'Elevated' ? 'Busy' : row.band === 'Not Available' ? 'Unavailable' : 'Degraded'} /><span style={{ marginLeft: '0.4rem' }}>{row.band}</span></td>
                                <td>{row.forecast.available ? `~${row.forecast.estimatedDaysToCapacity}d to capacity` : <span style={{ color: '#8b949e' }}>{row.forecast.reason ?? 'Forecast unavailable'}</span>}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="pm-note">Forecasts are linear projections of measured drift — explicitly a Forecast, not a certain outcome.</p>
            </section>
        );
    };

    const renderAnalyticsSlo = () => {
        const s = analyticsSnapshot?.slo;
        if (!s || !s.available) return <div className="pm-empty-state">{analyticsError || 'No SLO data yet.'}</div>;
        return (
            <section className="pm-panel" aria-label="SLO report">
                <header className="pm-panel-head">
                    <h2>SLA / SLO</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-panel-head-note">targets are configurable defaults (app settings)</span>
                    </div>
                </header>
                <table className="pm-table" aria-label="SLO windows">
                    <thead><tr><th>Window</th><th>Measured</th><th>Availability</th><th>Latency Compliance</th><th>Error Budget</th><th>Status</th></tr></thead>
                    <tbody>
                        {s.windows.map((w) => (
                            <tr key={w.window}>
                                <td>{w.label}</td>
                                <td>{w.measuredMinutes > 0 ? `${w.measuredMinutes} min` : 'Not Available'}{w.dataStatus.startsWith('Partial') ? ' (partial)' : ''}</td>
                                <td>{w.availabilityPercent !== null ? `${w.availabilityPercent}% (target ${w.availabilityTargetPercent}%)` : '—'}</td>
                                <td>{w.latencyCompliancePercent !== null ? `${w.latencyCompliancePercent}% ≤ ${w.latencyTargetMs}ms` : '—'}</td>
                                <td>{w.errorBudgetUsedPercent !== null ? `${w.errorBudgetUsedPercent}% used` : '—'}</td>
                                <td><HealthBadge status={w.status === 'Meeting' ? 'Healthy' : w.status === 'At Risk' ? 'Degraded' : 'Unavailable'} /><span style={{ marginLeft: '0.4rem' }}>{w.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                <p className="pm-note">Compliance is only claimed for windows with ≥30 measured minutes; missing data is never treated as compliance.</p>
            </section>
        );
    };

    const renderAnalyticsTimeline = () => {
        const t = analyticsSnapshot;
        // timeline needs a fetch — reuse anomalies events as the timeline source
        const evts = t?.anomalies.events ?? [];
        return (
            <section className="pm-panel" aria-label="Incident timeline">
                <header className="pm-panel-head">
                    <h2>Incident Timeline</h2>
                    <div className="pm-panel-head-stats">
                        <span className="pm-panel-head-note">temporal co-occurrence — Observed Correlation, not causation</span>
                    </div>
                </header>
                {evts.length ? (
                    <ul className="pm-timeline">
                        {[...evts].reverse().map((e, i) => (
                            <li key={i} className={`pm-timeline-item pm-bottleneck--${e.severity === 'critical' || e.severity === 'high' ? 'high' : 'medium'}`}>
                                <span className="pm-timeline-time">{new Date(e.startedAt).toLocaleTimeString()}</span>
                                <span className="pm-timeline-body">
                                    <b>{e.condition}</b> on {e.component}
                                    {e.endedAt ? ` — resolved ${new Date(e.endedAt).toLocaleTimeString()}` : ' — ongoing'}
                                </span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="pm-chart-empty">No performance events in the stored timeline yet.</div>
                )}
            </section>
        );
    };

    const renderAnalyticsReport = () => {
        const r = analyticsSnapshot;
        return (
            <section className="pm-panel" aria-label="Performance report">
                <header className="pm-panel-head">
                    <h2>Performance Report</h2>
                    <div className="pm-panel-head-stats">
                        <button type="button" className="pm-btn" onClick={loadAiSummary} disabled={aiLoading}>
                            <Sparkles size={14} /> {aiLoading ? 'Analyzing…' : 'Generate AI Summary'}
                        </button>
                    </div>
                </header>
                {r ? (
                    <>
                        <div className="pm-kv-grid">
                            <div className="pm-kv"><span>Monitoring Overhead</span><b>avg collect {r.overhead.averageCollectionMs ?? '—'} ms · {r.overhead.rowsStored} rows stored · {r.overhead.activeEpisodes} active episodes</b></div>
                            <div className="pm-kv"><span>Capacity Risk</span><b>{r.overview.capacityRisk}</b></div>
                            <div className="pm-kv"><span>SLO Status</span><b>{r.overview.sloStatus}</b></div>
                        </div>
                        <h3 className="pm-chart-title">Evidence-based Recommendations</h3>
                        <ul className="pm-slow-list">
                            <li><code>AI Analysis</code><b style={{ color: '#c9d1d9', fontWeight: 400 }}>Use the AI Analysis panel for the full evidence-backed operational summary</b></li>
                        </ul>
                        <p className="pm-note">Recommendations cite stored metric evidence; none are speculative.</p>
                    </>
                ) : (
                    <div className="pm-chart-empty">{analyticsError || 'Report data unavailable.'}</div>
                )}
            </section>
        );
    };

    const renderAnalyticsAi = () => {
        return (
            <section className="pm-panel" aria-label="AI performance analysis">
                <header className="pm-panel-head">
                    <h2>AI Operational Summary</h2>
                    <div className="pm-panel-head-stats">
                        <button type="button" className="pm-btn" onClick={loadAiSummary} disabled={aiLoading}>
                            <Sparkles size={14} /> {aiLoading ? 'Analyzing…' : aiSummary ? 'Regenerate' : 'Generate'}
                        </button>
                    </div>
                </header>
                {aiError && <div className="pm-error" role="alert">{aiError}</div>}
                {aiSummary ? (
                    <>
                        <p className="pm-ai-summary">{aiSummary.executiveSummary}</p>
                        {([
                            ['Major Changes (observed)', aiSummary.majorChanges],
                            ['Correlated Events (observed correlation)', aiSummary.correlatedEvents],
                            ['Inference (AI interpretation)', aiSummary.inference],
                            ['Operational Priorities', aiSummary.operationalPriorities],
                            ['Recommended Actions (evidence-based)', aiSummary.recommendedActions]
                        ] as [string, string[]][]).map(([title, items]) => (
                            items.length ? (
                                <div key={title}>
                                    <h3 className="pm-chart-title">{title}</h3>
                                    <ul className="pm-slow-list">
                                        {items.map((x, i) => <li key={i}><code>·</code><b style={{ color: '#c9d1d9', fontWeight: 400 }}>{x}</b></li>)}
                                    </ul>
                                </div>
                            ) : null
                        ))}
                        {aiSummary.note && <p className="pm-note">{aiSummary.note}</p>}
                    </>
                ) : (
                    <div className="pm-chart-empty">AI summary generated from stored evidence only — never invented metrics. Falls back to a heuristic summary when AI is unavailable.</div>
                )}
            </section>
        );
    };

    const mainPanel = (() => {
        if (loading && !snapshot) return <div className="pm-loading">Preparing performance monitor…</div>;
        switch (selected.kind) {
            case 'cpu': return renderCpuPanel();
            case 'memory': return renderMemoryPanel();
            case 'disk': return renderDiskPanel(selected.mount);
            case 'network': return renderNetworkPanel(selected.name);
            case 'app-overview': return renderAppOverview();
            case 'app-api': return renderAppApi();
            case 'app-node': return renderAppNode();
            case 'app-database': return renderAppDatabase();
            case 'app-workers': return renderAppWorkers();
            case 'app-queue': return renderAppQueue();
            case 'app-sessions': return renderAppSessions();
            case 'intel-overview': return renderIntelOverview();
            case 'intel-jobs': return renderIntelJobs();
            case 'intel-modules': return renderIntelModules();
            case 'intel-threat': return renderIntelThreat();
            case 'intel-telegram': return renderIntelTelegram();
            case 'intel-image': return renderIntelImage();
            case 'intel-providers': return renderIntelProviders();
            case 'intel-bottlenecks': return renderIntelBottlenecks();
            case 'analytics-overview': return renderAnalyticsOverview();
            case 'analytics-trends': return renderAnalyticsTrends();
            case 'analytics-anomalies': return renderAnalyticsAnomalies();
            case 'analytics-bottlenecks': return renderAnalyticsBottlenecks();
            case 'analytics-capacity': return renderAnalyticsCapacity();
            case 'analytics-slo': return renderAnalyticsSlo();
            case 'analytics-timeline': return renderAnalyticsTimeline();
            case 'analytics-report': return renderAnalyticsReport();
            case 'analytics-ai': return renderAnalyticsAi();
        }
    })();

    const info = snapshot?.info;
    const renderResourceButton = (e: SidebarEntry) => {
        const active = resourceKeyOf(e.resource) === resourceKeyOf(selected);
        return (
            <button
                key={e.key}
                type="button"
                className={`pm-resource ${active ? 'pm-resource--active' : ''} ${e.unavailable ? 'pm-resource--unavailable' : ''}`}
                onClick={() => setSelected(e.resource)}
                aria-current={active ? 'true' : undefined}
            >
                <span className="pm-resource-icon">{ICONS[e.icon] ?? ICONS.cpu}</span>
                <span className="pm-resource-copy">
                    <span className="pm-resource-label">{e.label}</span>
                    <span className="pm-resource-sub">{e.sub}</span>
                </span>
                <span className="pm-resource-value">{e.value}</span>
                {e.status && <span className={`pm-resource-dot ${healthClass(e.status)}`} title={e.status} aria-label={e.status} />}
            </button>
        );
    };

    return (
        <div className="pm-page">
            <header className="pm-header">
                <div className="pm-header-text">
                    <h1>LekirraX Performance</h1>
                    <p>Real-time system resource and runtime performance monitoring.</p>
                </div>
                <div className="pm-header-actions">
                    <span className={`pm-live-pill ${error || appError || intelError || analyticsError ? 'pm-live-pill--err' : ''}`}>
                        <span className="pulse-dot" aria-hidden="true" />
                        {error || appError || intelError || analyticsError ? 'CONNECTION ERROR' : paused ? 'PAUSED' : 'LIVE — 2s SAMPLING'}
                    </span>
                    <button type="button" className="pm-btn" onClick={() => { setPaused((p) => !p); }} aria-pressed={paused}>
                        {paused ? <Play size={14} /> : <Pause size={14} />}
                        {paused ? 'Resume' : 'Pause'}
                    </button>
                    <button type="button" className="pm-btn" onClick={poll} disabled={loading}>
                        <RefreshCw size={14} />
                        Refresh
                    </button>
                    <button type="button" className="pm-btn pm-btn--ghost" onClick={onBack}>← Back</button>
                </div>
            </header>

            <div className="pm-body">
                {error && <div className="pm-error" role="alert">System metrics temporarily unavailable: {error}</div>}
                {appError && <div className="pm-error" role="alert">Application metrics temporarily unavailable: {appError}</div>}
                {intelError && <div className="pm-error" role="alert">Intelligence metrics temporarily unavailable: {intelError}</div>}
                {analyticsError && <div className="pm-error" role="alert">Analytics temporarily unavailable: {analyticsError}</div>}
                <aside className="pm-sidebar" aria-label="Resources" data-lenis-prevent>
                    <div className="pm-sidebar-title">System</div>
                    {loading && !snapshot ? (
                        <div className="pm-sidebar-empty">Loading resources…</div>
                    ) : (
                        sidebar.map(renderResourceButton)
                    )}
                    <div className="pm-sidebar-title pm-sidebar-title--app">Application</div>
                    {loading && !appSnapshot ? (
                        <div className="pm-sidebar-empty">Loading application…</div>
                    ) : (
                        appSidebar.map(renderResourceButton)
                    )}
                    <div className="pm-sidebar-title pm-sidebar-title--app">Intelligence</div>
                    {loading && !intelSnapshot ? (
                        <div className="pm-sidebar-empty">Loading intelligence…</div>
                    ) : (
                        intelSidebar.map(renderResourceButton)
                    )}
                    <div className="pm-sidebar-title pm-sidebar-title--app pm-sidebar-title--intel">Analytics</div>
                    {loading && !analyticsSnapshot ? (
                        <div className="pm-sidebar-empty">Loading analytics…</div>
                    ) : (
                        analyticsSidebar.map(renderResourceButton)
                    )}
                </aside>

                <div className="pm-main">
                    {mainPanel}

                    <section className="pm-panel pm-panel--info" aria-label="System information">
                        <header className="pm-panel-head">
                            <h2><Info size={15} style={{ verticalAlign: '-2px' }} /> System Information</h2>
                        </header>
                        <div className="pm-kv-grid">
                            <div className="pm-kv"><span>Operating System</span><b>{info?.os ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Hostname</span><b>{info?.hostname ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Architecture</span><b>{info?.arch ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>CPU</span><b>{info?.cpuModel ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Total Memory</span><b>{fmtBytes(info?.totalMemoryBytes)}</b></div>
                            <div className="pm-kv"><span>System Uptime</span><b>{fmtUptime(info?.systemUptimeSeconds)}</b></div>
                        </div>
                        <header className="pm-panel-head pm-panel-head--app">
                            <h2>Application Runtime</h2>
                        </header>
                        <div className="pm-kv-grid">
                            <div className="pm-kv"><span>Application</span><b>LekirraX {info?.appVersion ? `v${info.appVersion}` : ''}</b></div>
                            <div className="pm-kv"><span>Node.js</span><b>{info?.nodeVersion ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Process ID</span><b>{info?.processId ?? 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Application Uptime</span><b>{fmtUptime(info?.processUptimeSeconds)}</b></div>
                            <div className="pm-kv"><span>Started</span><b>{info?.processStartTime ? new Date(info.processStartTime).toLocaleString() : 'Not Available'}</b></div>
                            <div className="pm-kv"><span>Environment</span><b>{info?.environment ?? 'Not Available'}</b></div>
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}

function resourceKeyOf(r: ResourceKey): string {
    switch (r.kind) {
        case 'cpu': return 'cpu';
        case 'memory': return 'memory';
        case 'disk': return `disk:${r.mount}`;
        case 'network': return `network:${r.name}`;
        case 'app-overview': return 'app-overview';
        case 'app-api': return 'app-api';
        case 'app-node': return 'app-node';
        case 'app-database': return 'app-database';
        case 'app-workers': return 'app-workers';
        case 'app-queue': return 'app-queue';
        case 'app-sessions': return 'app-sessions';
        case 'intel-overview': return 'intel-overview';
        case 'intel-jobs': return 'intel-jobs';
        case 'intel-modules': return 'intel-modules';
        case 'intel-threat': return 'intel-threat';
        case 'intel-telegram': return 'intel-telegram';
        case 'intel-image': return 'intel-image';
        case 'intel-providers': return 'intel-providers';
        case 'intel-bottlenecks': return 'intel-bottlenecks';
        case 'analytics-overview': return 'analytics-overview';
        case 'analytics-trends': return 'analytics-trends';
        case 'analytics-anomalies': return 'analytics-anomalies';
        case 'analytics-bottlenecks': return 'analytics-bottlenecks';
        case 'analytics-capacity': return 'analytics-capacity';
        case 'analytics-slo': return 'analytics-slo';
        case 'analytics-timeline': return 'analytics-timeline';
        case 'analytics-report': return 'analytics-report';
        case 'analytics-ai': return 'analytics-ai';
    }
}
