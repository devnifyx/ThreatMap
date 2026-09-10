// PERFORMANCE_MONITOR_PHASE1.md §33 + PHASE2.md §30 — frontend rendering
// tests. The api module is mocked with realistic snapshot shapes (including
// unavailable categories in degraded cases) so these tests cover: rendering,
// resource switching, unavailable-category isolation (§28), graph updates
// from successive real samples, pause behavior, and Phase 2's System vs
// Application sections.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, act } from '@testing-library/react';
import PerformanceMonitorPage from '../PerformanceMonitorPage';
import { getSystemPerformance, getApplicationPerformance, getIntelligencePerformance, getAnalyticsPerformance, getMetricSeriesApi, getAiPerformanceSummary, type PmSnapshot, type PmApplicationSnapshot, type PmIntelligenceSnapshot, type PmAnalyticsSnapshot, type PmMetricSeries, type PmAiSummary } from '../../../services/api';

vi.mock('../../../services/api', () => ({
    getSystemPerformance: vi.fn(),
    getApplicationPerformance: vi.fn(),
    getIntelligencePerformance: vi.fn(),
    getAnalyticsPerformance: vi.fn(),
    getMetricSeriesApi: vi.fn(),
    getAiPerformanceSummary: vi.fn()
}));

// lucide-react pulls a second React copy through frontend/node_modules in the
// vitest alias setup — mock the icons this page uses.
vi.mock('lucide-react', () => ({
    Cpu: () => <span data-testid="icon-cpu" />,
    MemoryStick: () => <span data-testid="icon-memory" />,
    HardDrive: () => <span data-testid="icon-disk" />,
    Network: () => <span data-testid="icon-network" />,
    Info: () => <span data-testid="icon-info" />,
    RefreshCw: () => <span data-testid="icon-refresh" />,
    Pause: () => <span data-testid="icon-pause" />,
    Play: () => <span data-testid="icon-play" />,
    Gauge: () => <span data-testid="icon-gauge" />,
    Server: () => <span data-testid="icon-server" />,
    Database: () => <span data-testid="icon-database" />,
    Bot: () => <span data-testid="icon-bot" />,
    ListVideo: () => <span data-testid="icon-queue" />,
    Users: () => <span data-testid="icon-users" />,
    ActivitySquare: () => <span data-testid="icon-api" />,
    Radar: () => <span data-testid="icon-intel" />,
    ListChecks: () => <span data-testid="icon-jobs" />,
    LayoutGrid: () => <span data-testid="icon-modules" />,
    ShieldAlert: () => <span data-testid="icon-threat" />,
    Send: () => <span data-testid="icon-telegram" />,
    Images: () => <span data-testid="icon-image" />,
    Plug: () => <span data-testid="icon-providers" />,
    AlertTriangle: () => <span data-testid="icon-bottlenecks" />,
    TrendingUp: () => <span data-testid="icon-analytics" />,
    History: () => <span data-testid="icon-trends" />,
    Sparkles: () => <span data-testid="icon-ai" />,
    Target: () => <span data-testid="icon-slo" />,
    FileText: () => <span data-testid="icon-report" />
}));

function appSnap(overrides: Partial<PmApplicationSnapshot> = {}): PmApplicationSnapshot {
    return {
        timestamp: new Date().toISOString(),
        api: {
            available: true, windowSeconds: 60, totalRequests: 120, requestsPerSecond: 2,
            activeRequests: 1, averageLatencyMs: 128, medianLatencyMs: 95, p95LatencyMs: 310,
            errorRatePercent: 0.4, count2xx: 118, count3xx: 0, count4xx: 1, count5xx: 1,
            successRatePercent: 98.3, clientErrorRatePercent: 0.8, serverErrorRatePercent: 0.8,
            slowRequestThresholdMs: 500, slowRequestsInWindow: 1,
            slowRequests: [{ method: 'GET', path: '/api/companies', ms: 842, at: Date.now() }]
        },
        runtime: {
            available: true, processCpuPercent: 8, rssBytes: 420_000_000, heapUsedBytes: 180_000_000,
            heapTotalBytes: 256_000_000, externalBytes: 3_000_000, arrayBuffersBytes: 1_000_000,
            eventLoopDelayMs: 12, eventLoopStatus: 'Healthy', eventLoopThresholdsMs: { elevated: 35, critical: 100 },
            processUptimeSeconds: 16_320, nodeVersion: 'v22.13.0', processId: 4242
        },
        database: {
            available: true, status: 'Healthy', totalConnections: 12, activeConnections: 2,
            idleConnections: 10, maxConnections: 20, poolUtilizationPercent: 60,
            waitingRequests: 0, latencyMs: 18, checkedAt: new Date().toISOString()
        },
        workers: {
            available: true, queue: 'brand_scan_jobs', jobsQueued: 12, jobsRunning: 5, jobsCompleted: 1284,
            jobsFailed: 3, jobsCancelled: 0, stuckJobs: 0, averageJobDurationSeconds: 4.2,
            oldestQueuedAgeSeconds: 18, lastCompletedAt: new Date().toISOString(),
            queueStatus: 'Busy', pollers: [{ name: 'brandScanWorker', intervalMs: 3000 }]
        },
        sessions: { available: true, activeSessions: 3, maxSessions: 10, sessionUtilizationPercent: 30 },
        health: {
            overall: 'Healthy',
            components: {
                api: { status: 'Healthy', reason: null },
                node: { status: 'Healthy', reason: null },
                database: { status: 'Healthy', reason: null },
                workers: { status: 'Healthy', reason: null },
                sessions: { status: 'Healthy', reason: null }
            }
        },
        applicationUptimeSeconds: 16_320,
        ...overrides
    };
}

function snap(overrides: Partial<PmSnapshot> = {}): PmSnapshot {
    return {
        timestamp: new Date().toISOString(),
        cpu: { available: true, usagePercent: 12.5 },
        cpuSpeed: { available: true, speedMHz: 2970 },
        memory: {
            available: true, totalBytes: 34_000_000_000, usedBytes: 20_300_000_000,
            availableBytes: 13_700_000_000, freeBytes: 13_700_000_000, usedPercent: 59.7, source: 'freemem'
        },
        disks: {
            available: true,
            disks: [
                { mount: 'C:\\', totalBytes: 1e12, usedBytes: 3.42e11, availableBytes: 6.58e11, usedPercent: 34.2 },
                { mount: 'D:\\', totalBytes: 2e12, usedBytes: 1.1e12, availableBytes: 0.9e12, usedPercent: 55 }
            ]
        },
        diskActivity: {
            available: true,
            volumes: [
                { mount: 'C:\\', diskNumber: 0, readBytesPerSec: 1024, writeBytesPerSec: 2048 },
                { mount: 'D:\\', diskNumber: 1, readBytesPerSec: 0, writeBytesPerSec: 0 }
            ]
        },
        network: {
            available: true,
            interfaces: [
                {
                    name: 'Ethernet', addressV4: '192.168.1.10', addressV6: null, internal: false, virtual: false,
                    rxBytesPerSec: 3000, txBytesPerSec: 1000, totalRxBytes: 5e9, totalTxBytes: 1e9
                },
                { name: 'Loopback', addressV4: '127.0.0.1', addressV6: '::1', internal: true, virtual: true, rxBytesPerSec: 0, txBytesPerSec: 0, totalRxBytes: 0, totalTxBytes: 0 }
            ]
        },
        info: {
            available: true, os: 'Windows_NT 10.0.26200', platform: 'win32', hostname: 'TESTHOST', arch: 'x64',
            cpuModel: 'Test CPU', baseSpeedMHz: 2200, physicalCores: 16, logicalCores: 24,
            totalMemoryBytes: 34_000_000_000, nodeVersion: 'v22.13.0', appVersion: '1.0.0',
            processId: 4242, systemUptimeSeconds: 356_000, processUptimeSeconds: 16_000,
            processStartTime: '2026-08-17T00:00:00.000Z', environment: 'Development', loadAverage: null
        },
        ...overrides
    };
}

const back = vi.fn();

function seriesSnap(overrides: Partial<PmMetricSeries> = {}): PmMetricSeries {
    const now = Date.now();
    return {
        available: true, metric: 'app.api.latency_ms', range: '1h', resolution: 1,
        coveragePercent: 95, insufficientData: false,
        points: Array.from({ length: 10 }, (_, i) => ({
            t: new Date(now - (10 - i) * 60_000).toISOString(),
            samples: 6, min: 100 + i, max: 400 + i, avg: 200 + i * 5,
            p50: 200 + i * 5, p95: 380 + i, p99: 400 + i
        })),
        ...overrides
    };
}

function analyticsSnap(overrides: Partial<PmAnalyticsSnapshot> = {}): PmAnalyticsSnapshot {
    const nowIso = new Date().toISOString();
    return {
        timestamp: nowIso,
        overview: {
            systemHealth: 'Healthy', applicationHealth: 'Healthy', intelligenceHealth: 'Healthy',
            openAnomalies: 1, recentAnomalies: 3, capacityRisk: 'Elevated', sloStatus: 'Meeting'
        },
        anomalies: {
            available: true,
            events: [{
                kind: 'anomaly', condition: 'HIGH_API_LATENCY', component: 'API', metric: 'app.api.latency_ms',
                severity: 'medium', startedAt: nowIso, endedAt: null, durationSeconds: null,
                peakValue: 820, baselineValue: null, deviationPercent: null,
                sampleCount: 42, evidence: 'API metric app.api.latency_ms at 820 vs threshold 500', alertId: 17
            }]
        },
        bottlenecks: {
            available: true,
            bottlenecks: [{
                condition: 'HIGH_API_LATENCY', component: 'API', firstDetectedAt: nowIso, lastDetectedAt: nowIso,
                occurrences: 4, totalDurationSeconds: 1500, durations: 3, averageDurationSeconds: 500,
                peakValue: 900, openNow: true
            }]
        },
        capacity: {
            available: true,
            capacity: [
                { metric: 'system.cpu.percent', label: 'CPU', unit: '%', hardMax: 100, current: 42, currentOfMax: '42 / 100', utilizationPercent: 42, thirtyDayAverage: 31, thirtyDayPeak: 49, band: 'Normal', historyStatus: 'Available', forecast: { available: false, reason: 'no sustained upward trend detected' } },
                { metric: 'app.db.connections', label: 'Database Connections', unit: 'conn', hardMax: 20, current: 42, currentOfMax: '42 / 50', utilizationPercent: 84, thirtyDayAverage: 31, thirtyDayPeak: 49, band: 'Elevated', historyStatus: 'Available', forecast: { available: false, reason: 'no sustained upward trend detected' } }
            ]
        },
        slo: {
            available: true,
            windows: [
                { window: 'daily', label: 'Daily', measuredMinutes: 1440, dataStatus: 'Available', availabilityTargetPercent: 99.9, availabilityPercent: 99.95, latencyTargetMs: 500, latencyCompliancePercent: 99.4, errorBudgetUsedPercent: 40, status: 'Meeting' },
                { window: 'monthly', label: 'Monthly', measuredMinutes: 0, dataStatus: 'Not Available', availabilityTargetPercent: 99.9, availabilityPercent: null, latencyTargetMs: 500, latencyCompliancePercent: null, errorBudgetUsedPercent: null, status: 'Not Available' }
            ]
        },
        overhead: {
            available: true, samplingIntervalMs: 10000, samplesCollected: 120, bucketsWritten: 2,
            rowsStored: 24, lastCollectionMs: 8, lastStorageMs: 3,
            averageCollectionMs: 9.5, averageStorageMs: 4, activeEpisodes: 1
        },
        ...overrides
    };
}

function intelSnap(overrides: Partial<PmIntelligenceSnapshot> = {}): PmIntelligenceSnapshot {
    return {
        timestamp: new Date().toISOString(),
        overview: {
            runningJobs: 3, queuedJobs: 4, activeInvestigations: 2, failedJobsRecent: 1,
            osintRunsLastHour: 8, providerRequestsLastMinute: 12,
            threatFeedRunsLastHour: 2, imageJobsQueued: 1
        },
        activeJobs: {
            available: true,
            jobs: [{
                id: 'JOB1', type: 'Recon Scan', module: 'Web Intelligence', status: 'Running',
                startedAt: new Date().toISOString(), durationSeconds: 12, worker: 'in-process',
                targetType: 'domain', targetLength: 11
            }]
        },
        investigations: { available: true, running: 1, waiting: 1, completedToday: 5, failedToday: 0, stuckRunningNote: null },
        modules: {
            available: true,
            modules: [
                { module: 'domain-intelligence', activeJobs: 1, avgDurationMs: 2800, medianDurationMs: 2600, p95DurationMs: 4100, runsLastHour: 4, totalRuns: 42, jobs24h: 42, failureRatePercent: 0.6 },
                { module: 'email-intelligence', activeJobs: 0, avgDurationMs: 1200, runsLastHour: 2, totalRuns: 12, jobs24h: 12, failureRatePercent: 0 }
            ]
        },
        threat: {
            available: true, feedRunsLastHour: 2, itemsCollectedLastHour: 282, itemsProcessedLastHour: 142,
            duplicatesLastHour: 20, rejectedLastHour: 0, failedRunsLastHour: 0, avgRunSeconds: 0.3,
            feeds: [{ key: 'abuseipdb', runsLastHour: 1, errorsLastHour: 0, lastSuccessAt: new Date().toISOString() }]
        },
        image: {
            available: true, queued: 1, possiblyStuck: 0, completed24h: 5, failed24h: 0,
            rateLimited24h: 1, unavailable24h: 0, avgDurationSeconds: 5.8, images24h: 3
        },
        telegram: {
            available: true, status: 'Not Configured',
            capability: { crawler: 'NOT_CONFIGURED', publicUsernameCheck: 'AVAILABLE' }
        },
        providers: {
            available: true,
            providers: [
                { id: 'ip-api', status: 'Healthy', configured: true, requests: 38, successRatePercent: 99.2, failureRatePercent: 0.8, averageLatencyMs: 420, rateLimitEvents: 0, lastSuccessfulRequestAt: new Date().toISOString() },
                { id: 'googleVision', status: 'Not Configured', configured: false },
                { id: 'shodan', status: 'No Traffic Recorded', configured: true }
            ]
        },
        queues: {
            available: true,
            queues: [{ name: 'brand_scan_jobs', pending: 4, running: 1, failed: 0, oldestJobAgeSeconds: 18, status: 'Busy' }]
        },
        workers: {
            available: true,
            workers: [
                { name: 'Brand Scan Worker', kind: 'brandScanWorker', status: 'Busy', currentJob: 'Brand Intelligence Scan', intervalMs: 3000, utilization: null },
                { name: 'Monitoring Scheduler', kind: 'monitoringScheduler', status: 'Idle', currentJob: null, intervalMs: 60000, utilization: 0 }
            ]
        },
        bottlenecks: {
            available: true, label: 'Potential Bottlenecks',
            findings: [
                { condition: 'HIGH_QUEUE_DEPTH', area: 'Brand Intelligence Queue', evidence: 'oldest queued job waiting 900s (depth 74)', severity: 'medium' }
            ]
        },
        workload: {
            available: true, attribution: 'unavailable',
            attributionNote: 'Workload attribution unavailable — LekirraX does not record per-job CPU/memory.',
            observations: [
                { kind: 'Observed Correlation', observation: 'CPU at 86% coincides with 2 Brand Intelligence job(s)' }
            ]
        },
        ...overrides
    };
}

beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
    vi.useRealTimers();
    cleanup();
});

async function renderWithFirstSnapshot(overrides: Partial<PmSnapshot> = {}, appOverrides: Partial<PmApplicationSnapshot> = {}, intelOverrides: Partial<PmIntelligenceSnapshot> = {}, analyticsOverrides: Partial<PmAnalyticsSnapshot> = {}) {
    (getSystemPerformance as any).mockResolvedValue(snap(overrides));
    (getApplicationPerformance as any).mockResolvedValue(appSnap(appOverrides));
    (getIntelligencePerformance as any).mockResolvedValue(intelSnap(intelOverrides));
    (getAnalyticsPerformance as any).mockResolvedValue(analyticsSnap(analyticsOverrides));
    (getMetricSeriesApi as any).mockResolvedValue(seriesSnap());
    render(<PerformanceMonitorPage onBack={back} />);
    await waitFor(() => expect(screen.getByText('LekirraX Performance')).toBeTruthy());
    // first poll resolves with fake timers in place
    await act(async () => { await vi.runOnlyPendingTimersAsync(); });
}

describe('PerformanceMonitorPage', () => {
    it('renders header, description and the live sampling pill', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getByText('Real-time system resource and runtime performance monitoring.')).toBeTruthy();
        expect(screen.getByText(/LIVE — 2s SAMPLING/)).toBeTruthy();
    });

    it('builds the resource sidebar dynamically from real snapshot data', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getByRole('button', { name: /CPU/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Memory/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Disk C:/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Disk D:/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /Ethernet/ })).toBeTruthy();
        // loopback is internal — never offered as a selectable resource
        expect(screen.queryByRole('button', { name: /^Loopback/ })).toBeNull();
    });

    it('CPU panel shows real values from the snapshot', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0); // 12.5 → 13%
        expect(screen.getByText('16')).toBeTruthy();           // physical cores
        expect(screen.getByText('24')).toBeTruthy();           // logical processors
        expect(screen.getAllByText('2.97 GHz').length).toBeGreaterThanOrEqual(1); // current speed (sidebar + panel)
        expect(screen.getByText('2.20 GHz')).toBeTruthy();     // base speed
    });

    it('switching resources changes the main panel', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /Ethernet/ }));
        expect(screen.getByText('192.168.1.10')).toBeTruthy();
        expect(screen.getByText(/current throughput/)).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /Disk C:/ }));
        expect(screen.getByText(/capacity in use/)).toBeTruthy();
        expect(screen.getByText('Disk I/O Activity — last 60 seconds')).toBeTruthy();

        fireEvent.click(screen.getByRole('button', { name: /^Memory/ }));
        expect(screen.getByText(/system memory in use/)).toBeTruthy();
    });

    it('renders System Information and Application Runtime sections', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getByText('System Information')).toBeTruthy();
        expect(screen.getByText('Application Runtime')).toBeTruthy();
        expect(screen.getByText('TESTHOST')).toBeTruthy();
        expect(screen.getByText('v22.13.0')).toBeTruthy();
        expect(screen.getByText('4242')).toBeTruthy();
    });

    it('one unavailable category does not break the page (§21)', async () => {
        await renderWithFirstSnapshot({
            network: { available: false, reason: 'perf-counters-unavailable', interfaces: [] },
            diskActivity: { available: false, reason: 'perf-counters-unavailable', volumes: [] }
        });
        // page + CPU values still render
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0);
        // unavailable network entry is present and labeled
        expect(screen.getByText('No interface data available')).toBeTruthy();
    });

    it('unavailable CPU percent renders as Unavailable, not a fake zero', async () => {
        await renderWithFirstSnapshot({ cpu: { available: false, reason: 'warming-up', usagePercent: null } });
        const cpuBtn = screen.getByRole('button', { name: /CPU/ });
        expect(cpuBtn.textContent).toContain('Unavailable');
    });

    it('chart accumulates samples across polls and Pause stops polling', async () => {
        const snapshots = [
            snap({ cpu: { available: true, usagePercent: 10 }, timestamp: '2026-08-17T00:00:02.000Z' }),
            snap({ cpu: { available: true, usagePercent: 20 }, timestamp: '2026-08-17T00:00:04.000Z' }),
            snap({ cpu: { available: true, usagePercent: 30 }, timestamp: '2026-08-17T00:00:06.000Z' })
        ];
        (getSystemPerformance as any).mockImplementation(async () => snapshots.shift() || snap());
        render(<PerformanceMonitorPage onBack={back} />);
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        const calls = () => (getSystemPerformance as any).mock.calls.length;
        const firstCount = calls();
        expect(firstCount).toBeGreaterThanOrEqual(1);

        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(calls()).toBeGreaterThan(firstCount);

        await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
        expect(calls()).toBeGreaterThan(firstCount + 1);

        // multiple real samples collected → svg chart present with path data
        const svg = document.querySelector('.pm-chart-svg');
        expect(svg).toBeTruthy();
        const path = svg!.querySelector('path[stroke]');
        expect(path?.getAttribute('d')).toBeTruthy();

        // pause → no further polls regardless of elapsed time
        fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
        const beforePause = calls();
        await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
        expect(calls()).toBe(beforePause);
        expect(screen.getByText(/PAUSED/)).toBeTruthy();
    });

    it('Back button invokes onBack', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /← Back/ }));
        expect(back).toHaveBeenCalledTimes(1);
    });

    it('sidebar scroller is exempt from Lenis wheel hijacking (data-lenis-prevent)', async () => {
        await renderWithFirstSnapshot();
        const sidebar = document.querySelector('.pm-sidebar');
        expect(sidebar?.getAttribute('data-lenis-prevent')).not.toBeNull();
    });
});

describe('PerformanceMonitorPage — Phase 2 application sections', () => {
    it('renders System and Application sidebar groups with all application resources', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getByText('System')).toBeTruthy();
        expect(screen.getAllByText('Application').length).toBeGreaterThanOrEqual(1);
        // application resource entries (labels appear in sidebar buttons)
        expect(screen.getByRole('button', { name: /^Overview/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^API/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Node\.js/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Database/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Workers/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Queue/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Sessions/ })).toBeTruthy();
    });

    it('Application Overview shows the health cards and reasons when degraded', async () => {
        await renderWithFirstSnapshot({}, {
            health: {
                overall: 'Degraded',
                components: {
                    api: { status: 'Healthy', reason: null },
                    node: { status: 'Healthy', reason: null },
                    database: { status: 'Unavailable', reason: 'ECONNREFUSED' },
                    workers: { status: 'Healthy', reason: null },
                    sessions: { status: 'Healthy', reason: null }
                }
            }
        });
        fireEvent.click(screen.getByRole('button', { name: /^Overview/ }));
        expect(screen.getByText('Application Health')).toBeTruthy();
        expect(screen.getAllByText('Degraded').length).toBeGreaterThan(0);
        // transparent reason shown (§28) — component name + status + reason
        expect(screen.getAllByText('Database').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Unavailable', { exact: true }).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/ECONNREFUSED/)).toBeTruthy();
    });

    it('API panel shows real request metrics and the slow-request list', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^API/ }));
        expect(screen.getByText('API Performance')).toBeTruthy();
        expect(screen.getAllByText('2 req/s').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('128 ms').length).toBeGreaterThanOrEqual(1);  // average latency
        expect(screen.getByText('842 ms')).toBeTruthy();                        // slow sample duration
        expect(screen.getByText(/GET \/api\/companies/)).toBeTruthy();
    });

    it('Node.js panel distinguishes process memory from system memory', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Node\.js/ }));
        expect(screen.getByText('Node.js Runtime')).toBeTruthy();
        expect(screen.getByText(/distinct from System Memory/)).toBeTruthy();
        expect(screen.getAllByText('4242').length).toBeGreaterThanOrEqual(1);   // PID (sidebar + panel)
    });

    it('Database panel shows pool, latency and status badge', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Database/ }));
        expect(screen.getByText(/response time/)).toBeTruthy();
        expect(screen.getByText('12 / 20')).toBeTruthy();          // connections
        expect(screen.getAllByText('18 ms').length).toBeGreaterThanOrEqual(1); // latency (sidebar + panel)
    });

    it('Workers panel shows jobs and in-process pollers', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Workers/ }));
        expect(screen.getByText('Background Jobs')).toBeTruthy();
        expect(screen.getByText('1,284')).toBeTruthy();            // completed (localized)
        expect(screen.getByText(/brandScanWorker/)).toBeTruthy();
    });

    it('Queue panel shows depth and queue status', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Queue/ }));
        expect(screen.getByText('Queue — brand_scan_jobs')).toBeTruthy();
        expect(screen.getAllByText(/pending/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    });

    it('Sessions panel shows counts and the no-surveillance note', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Sessions/ }));
        expect(screen.getAllByText('Active Sessions').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/does not track per-user activity/)).toBeTruthy();
    });

    it('degraded database renders Unavailable honestly; rest of page still works (§28)', async () => {
        await renderWithFirstSnapshot({}, {
            database: { available: false, status: 'Unavailable', reason: 'connection failed' },
            health: {
                overall: 'Critical',
                components: {
                    api: { status: 'Healthy', reason: null },
                    node: { status: 'Healthy', reason: null },
                    database: { status: 'Unavailable', reason: 'connection failed' },
                    workers: { status: 'Healthy', reason: null },
                    sessions: { status: 'Healthy', reason: null }
                }
            }
        });
        // system metrics still render
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0);
        // application overview still renders with the critical badge + reason
        fireEvent.click(screen.getByRole('button', { name: /^Overview/ }));
        expect(screen.getAllByText('Critical').length).toBeGreaterThan(0);
        // database detail shows the honest unavailable state (sidebar sub + panel)
        fireEvent.click(screen.getByRole('button', { name: /^Database/ }));
        expect(screen.getAllByText(/Database metrics unavailable/).length).toBeGreaterThanOrEqual(1);
    });

    it('application metrics endpoint failing does not break system sections', async () => {
        (getSystemPerformance as any).mockResolvedValue(snap());
        (getApplicationPerformance as any).mockRejectedValue(new Error('boom'));
        (getIntelligencePerformance as any).mockResolvedValue(intelSnap());
        render(<PerformanceMonitorPage onBack={back} />);
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        // Phase 1 panel data still on screen
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0);
        // application error surfaced honestly
        expect(screen.getByText(/Application metrics temporarily unavailable: boom/)).toBeTruthy();
    });
});

describe('PerformanceMonitorPage — Phase 3 intelligence sections', () => {
    it('renders the Intelligence sidebar group with all intelligence resources', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getAllByText('Intelligence').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: /^Active Jobs/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^OSINT Modules/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Threat Intel/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Telegram/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Image Analysis/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Providers/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Bottlenecks/ })).toBeTruthy();
    });

    it('Intelligence Overview shows real workload cards', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Intelligence/ }));
        expect(screen.getByText('Intelligence Workload')).toBeTruthy();
        expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(1);       // running jobs
        expect(screen.getByText('8/h')).toBeTruthy();                            // OSINT runs
        expect(screen.getByText('142/h')).toBeTruthy();                          // IOC processing
    });

    it('Active Jobs table lists in-flight jobs and queues without target values', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Active Jobs/ }));
        expect(screen.getByText('Active Intelligence Jobs')).toBeTruthy();
        expect(screen.getByText('JOB1')).toBeTruthy();
        expect(screen.getByText('Recon Scan')).toBeTruthy();
        expect(screen.getByText('brand_scan_jobs')).toBeTruthy();
        // §2/§28 — no target VALUE anywhere (only length metadata in the model)
        expect(screen.queryByText('example.com')).toBeNull();
    });

    it('OSINT Modules table shows measured module performance', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^OSINT Modules/ }));
        expect(screen.getByText('OSINT Module Performance')).toBeTruthy();
        expect(screen.getByText('domain-intelligence')).toBeTruthy();
        expect(screen.getByText('2.80s')).toBeTruthy();     // avg duration
        expect(screen.getByText('0.6%')).toBeTruthy();     // failure rate
    });

    it('Threat Intel panel shows real feed telemetry', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Threat Intel/ }));
        expect(screen.getByText('Threat Intelligence')).toBeTruthy();
        expect(screen.getByText('abuseipdb')).toBeTruthy();
        expect(screen.getAllByText(/IOCs processed \/ hour/).length).toBeGreaterThanOrEqual(1);
    });

    it('Telegram panel honestly shows Not Configured (§32 Test 6)', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Telegram/ }));
        expect(screen.getByText('Telegram Intelligence')).toBeTruthy();
        expect(screen.getByText(/crawler is Not Configured/)).toBeTruthy();
        expect(screen.getByText(/No statistics are fabricated/)).toBeTruthy();
        expect(screen.getByText('crawler')).toBeTruthy();       // capability row
    });

    it('Image Analysis panel shows measured search workload', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Image Analysis/ }));
        expect(screen.getByText('Image Intelligence')).toBeTruthy();
        expect(screen.getByText(/reverse searches completed/)).toBeTruthy();
    });

    it('Providers table shows measured + Not Configured + no-traffic states distinctly', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Providers/ }));
        expect(screen.getByText('External Providers')).toBeTruthy();
        expect(screen.getByText('ip-api')).toBeTruthy();
        expect(screen.getAllByText('Not Configured').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/No Traffic Recorded/)).toBeTruthy();
    });

    it('Bottlenecks panel shows evidence-based findings and correlation language', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Bottlenecks/ }));
        expect(screen.getByText('Potential Bottlenecks')).toBeTruthy();
        expect(screen.getByText('HIGH_QUEUE_DEPTH')).toBeTruthy();
        expect(screen.getByText(/oldest queued job waiting 900s/)).toBeTruthy();
        expect(screen.getByText(/Observed Correlations \(not confirmed causes\)/)).toBeTruthy();
        expect(screen.getByText(/coincides with/)).toBeTruthy();
        expect(screen.getByText(/Workload attribution unavailable/)).toBeTruthy();
    });

    it('intelligence endpoint failing does not break system/application sections', async () => {
        (getSystemPerformance as any).mockResolvedValue(snap());
        (getApplicationPerformance as any).mockResolvedValue(appSnap());
        (getIntelligencePerformance as any).mockRejectedValue(new Error('intel down'));
        (getAnalyticsPerformance as any).mockResolvedValue(analyticsSnap());
        render(<PerformanceMonitorPage onBack={back} />);
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0);   // system still fine
        expect(screen.getByText(/Intelligence metrics temporarily unavailable: intel down/)).toBeTruthy();
    });
});

describe('PerformanceMonitorPage — Phase 4 analytics sections', () => {
    it('renders the Analytics sidebar group with all analytics resources', async () => {
        await renderWithFirstSnapshot();
        expect(screen.getAllByText('Analytics').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('button', { name: /^Trends/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Anomalies/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Bottleneck History/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Capacity/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^SLO/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Timeline/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^Report/ })).toBeTruthy();
        expect(screen.getByRole('button', { name: /^AI Analysis/ })).toBeTruthy();
    });

    it('Analytics Overview shows health cards, episodes and monitoring overhead', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Analytics/ }));
        expect(screen.getByText('Historical Analytics')).toBeTruthy();
        expect(screen.getAllByText('Elevated').length).toBeGreaterThanOrEqual(1);   // capacity risk card
        expect(screen.getByText(/24 rows stored/)).toBeTruthy();                    // overhead line
        expect(screen.getAllByText('HIGH_API_LATENCY').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/\(ongoing\)/).length).toBeGreaterThanOrEqual(1);
    });

    it('Trends renders series with baseline honest gap handling', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Trends/ }));
        expect(screen.getByText('Historical Trends')).toBeTruthy();
        expect(screen.getByText('API Latency')).toBeTruthy();
        expect(screen.getByRole('button', { name: '6h' })).toBeTruthy();
        // real series rendered as SVG
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        expect(document.querySelector('.pm-chart-svg')).toBeTruthy();
    });

    it('Trends shows Insufficient historical data honestly for empty series', async () => {
        (getSystemPerformance as any).mockResolvedValue(snap());
        (getApplicationPerformance as any).mockResolvedValue(appSnap());
        (getIntelligencePerformance as any).mockResolvedValue(intelSnap());
        (getAnalyticsPerformance as any).mockResolvedValue(analyticsSnap());
        (getMetricSeriesApi as any).mockResolvedValue(seriesSnap({ available: false, insufficientData: true, points: [] }));
        render(<PerformanceMonitorPage onBack={back} />);
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        fireEvent.click(screen.getByRole('button', { name: /^Trends/ }));
        expect(screen.getByText(/Insufficient historical data for this metric\/range/)).toBeTruthy();
    });

    it('Anomalies table lists deduplicated episodes with severity badges', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Anomalies/ }));
        expect(screen.getByText('Anomaly Episodes')).toBeTruthy();
        expect(screen.getByText(/ongoing — deduplicated episodes, not samples/)).toBeTruthy();
        expect(screen.getByText('#17')).toBeTruthy();   // linked Alert Center row
    });

    it('Bottleneck History shows occurrence aggregates', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Bottleneck History/ }));
        expect(screen.getAllByText('Bottleneck History').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByRole('table', { name: 'Bottleneck history' })).toBeTruthy();
        expect(screen.getByText(/never root cause/)).toBeTruthy();
        expect(screen.getAllByText('4').length).toBeGreaterThanOrEqual(1);   // occurrences
    });

    it('Capacity table shows bands, 30d stats and honest forecast refusals', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Capacity/ }));
        expect(screen.getByRole('table', { name: 'Capacity table' })).toBeTruthy();
        expect(screen.getAllByText(/no sustained upward trend detected/).length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/never certain/)).toBeTruthy();
    });

    it('SLO table distinguishes Meeting from Not Available windows', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^SLO/ }));
        expect(screen.getByText('SLA / SLO')).toBeTruthy();
        expect(screen.getAllByText('Meeting').length).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText('Not Available').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/never treated as compliance/)).toBeTruthy();
    });

    it('Timeline lists events with Observed Correlation framing', async () => {
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^Timeline/ }));
        expect(screen.getByText('Incident Timeline')).toBeTruthy();
        expect(screen.getByText(/not causation/)).toBeTruthy();
        expect(screen.getByText(/— ongoing/)).toBeTruthy();   // the open HIGH_API_LATENCY episode entry
    });

    it('AI Analysis generates an evidence-based summary with separated sections', async () => {
        (getAiPerformanceSummary as any).mockResolvedValue({
            available: true,
            summary: {
                executiveSummary: 'API latency is within baseline. One open episode observed.',
                majorChanges: ['Queue depth elevated vs 7-day baseline'],
                correlatedEvents: ['CPU rise coincided with image workload increase (observed correlation)'],
                inference: ['Workload pressure may be transient'],
                operationalPriorities: ['Watch queue depth over the next hour'],
                recommendedActions: ['Investigate queue backlog — 4 recurring episodes in stored history'],
                note: 'AI-generated interpretation of stored evidence — not itself evidence.'
            } as PmAiSummary
        });
        await renderWithFirstSnapshot();
        fireEvent.click(screen.getByRole('button', { name: /^AI Analysis/ }));
        fireEvent.click(screen.getByRole('button', { name: /Generate/ }));
        await waitFor(() => expect(screen.getByText(/API latency is within baseline/)).toBeTruthy());
        expect(screen.getByText(/Correlated Events \(observed correlation\)/)).toBeTruthy();
        expect(screen.getByText(/Inference \(AI interpretation\)/)).toBeTruthy();
        expect(screen.getByText(/Recommended Actions \(evidence-based\)/)).toBeTruthy();
        expect(screen.getByText(/not itself evidence/)).toBeTruthy();
    });

    it('analytics endpoint failing does not break live sections', async () => {
        (getSystemPerformance as any).mockResolvedValue(snap());
        (getApplicationPerformance as any).mockResolvedValue(appSnap());
        (getIntelligencePerformance as any).mockResolvedValue(intelSnap());
        (getAnalyticsPerformance as any).mockRejectedValue(new Error('history down'));
        render(<PerformanceMonitorPage onBack={back} />);
        await act(async () => { await vi.runOnlyPendingTimersAsync(); });
        expect(screen.getAllByText('13%').length).toBeGreaterThan(0);
        expect(screen.getByText(/Analytics temporarily unavailable: history down/)).toBeTruthy();
    });
});
