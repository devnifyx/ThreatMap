import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Globe2, Target, CalendarClock, Radio } from 'lucide-react';
import CyberThreatMap, { type ScanOverlayPoint } from '../../components/CyberThreatMap';
import type { ThreatEvent } from '../../services/threatMapSocket';
import { threatMapSocket } from '../../services/threatMapSocket';
import { getDashboardScanLocations } from '../../services/api';
import { formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import './GlobalThreatMapPage.css';

const MAX_TRACKED = 200;

// ─── types ────────────────────────────────────────────────────────────────────

interface LiveStats {
    total:      number;
    bySeverity: Record<string, number>;
    byCountry:  { code: string; name: string; count: number }[];
    // Most recent real event timestamp seen this session — not a separate
    // clock, just the max of the already-ingested ThreatEvent.timestamp values.
    lastEventAt: string | null;
}

// ─── LiveStatsPanel ───────────────────────────────────────────────────────────

const SeverityDot: React.FC<{ sev: string }> = ({ sev }) => {
    const COLORS: Record<string, string> = {
        critical: '#f85149',
        high:     '#d29922',
        medium:   '#58a6ff',
        low:      '#3fb950',
    };
    return (
        <span
            className="tm-stat-dot"
            style={{ background: COLORS[sev] ?? '#8b949e' }}
        />
    );
};

const LiveStatsPanel: React.FC<{
    stats:         LiveStats;
    overlayCount:  number;
    feedConnected: boolean;
}> = ({ stats, overlayCount, feedConnected }) => {
    const maxCountry = Math.max(1, ...stats.byCountry.map(c => c.count));
    return (
        <aside className="tm-stats-panel" aria-label="Live threat statistics" data-lenis-prevent>
            <div className="tm-stats-feed-status">
                <Radio size={12} />
                <span className={`tm-stats-feed-dot ${feedConnected ? 'live' : 'offline'}`} />
                {feedConnected ? 'LIVE FEED' : 'CONNECTING…'}
            </div>

            <div className="tm-stats-card">
                <div className="tm-stats-section-title">Threat Events (Session)</div>
                <div className="tm-stats-total">{stats.total.toLocaleString()}</div>
                <div className="tm-stats-severity-list">
                    {['critical', 'high', 'medium', 'low'].map(sev => (
                        <div className="tm-stats-severity-row" key={sev}>
                            <SeverityDot sev={sev} />
                            <span className="tm-stats-severity-label">{sev}</span>
                            <span className="tm-stats-severity-count">
                                {(stats.bySeverity[sev] || 0).toLocaleString()}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="tm-stats-card">
                <div className="tm-stats-section-title">Top Origins</div>
                <div className="tm-stats-country-list">
                    {stats.byCountry.slice(0, 6).map(c => (
                        <div className="tm-stats-country-row" key={c.code}>
                            <div className="tm-stats-country-head">
                                <span className="tm-stats-country-name" title={c.name}>{c.name || c.code}</span>
                                <span className="tm-stats-country-count">{c.count}</span>
                            </div>
                            <div className="tm-stats-country-bar-track">
                                <div className="tm-stats-country-bar-fill" style={{ width: `${(c.count / maxCountry) * 100}%` }} />
                            </div>
                        </div>
                    ))}
                    {stats.byCountry.length === 0 && (
                        <div className="tm-stats-empty">Waiting for events…</div>
                    )}
                </div>
            </div>

            {overlayCount > 0 && (
                <div className="tm-stats-card">
                    <div className="tm-stats-section-title">Scan Overlay</div>
                    <div className="tm-stats-overlay-count">
                        <span className="tm-overlay-dot" />
                        {overlayCount} target{overlayCount !== 1 ? 's' : ''} mapped
                    </div>
                </div>
            )}
        </aside>
    );
};

// ─── Main page ────────────────────────────────────────────────────────────────

const GlobalThreatMapPage: React.FC = () => {
    const [filter,         setFilter]         = useState<string>('all');
    const [filterSeverity, setFilterSeverity] = useState<string>('all');
    const [selectedThreat, setSelectedThreat] = useState<any | null>(null);
    const [error,          setError]          = useState<string | null>(null);
    const [feedConnected,  setFeedConnected]  = useState(false);
    const [overlayPoints,  setOverlayPoints]  = useState<ScanOverlayPoint[]>([]);
    const [liveStats, setLiveStats] = useState<LiveStats>({
        total: 0, bySeverity: {}, byCountry: [], lastEventAt: null,
    });
    const threatsAggRef = useRef<Map<string, ThreatEvent>>(new Map());

    const recomputeStats = useCallback(() => {
        const bySeverity: Record<string, number> = {};
        const byCountry:  Record<string, { name: string; count: number }> = {};
        let lastEventAt: string | null = null;

        for (const t of threatsAggRef.current.values()) {
            bySeverity[t.severity] = (bySeverity[t.severity] || 0) + 1;
            const code = t.source?.countryCode;
            if (code) {
                const entry = byCountry[code];
                byCountry[code] = { name: t.source.country || code, count: (entry?.count || 0) + 1 };
            }
            if (t.timestamp && (!lastEventAt || t.timestamp > lastEventAt)) lastEventAt = t.timestamp;
        }

        const countryList = Object.entries(byCountry)
            .map(([code, v]) => ({ code, name: v.name, count: v.count }))
            .sort((a, b) => b.count - a.count);

        setLiveStats({
            total:     threatsAggRef.current.size,
            bySeverity,
            byCountry: countryList,
            lastEventAt,
        });
    }, []);

    const ingestEvents = useCallback((events: ThreatEvent[], replace = false) => {
        if (replace) threatsAggRef.current.clear();
        for (const e of events) {
            if (!threatsAggRef.current.has(e.id)) {
                threatsAggRef.current.set(e.id, e);
            }
        }
        while (threatsAggRef.current.size > MAX_TRACKED) {
            const oldest = threatsAggRef.current.keys().next().value;
            if (oldest === undefined) break;
            threatsAggRef.current.delete(oldest);
        }
        recomputeStats();
    }, [recomputeStats]);

    // WebSocket subscription for stats aggregation (independent of CyberThreatMap's own sub)
    useEffect(() => {
        const unsubSnap   = threatMapSocket.onSnapshot(evts => ingestEvents(evts, true));
        const unsubEvents = threatMapSocket.onEvents(evts => ingestEvents(evts));
        threatMapSocket.connect();
        // Mark connected after first snapshot arrives — simple heuristic
        const timer = setTimeout(() => setFeedConnected(true), 2000);
        return () => {
            unsubSnap();
            unsubEvents();
            clearTimeout(timer);
        };
    }, [ingestEvents]);

    // Fetch scan overlay once on mount (10-min cached on server)
    useEffect(() => {
        let cancelled = false;
        getDashboardScanLocations()
            .then(locs => { if (!cancelled) setOverlayPoints(locs); })
            .catch(() => {});   // overlay is optional — never block the globe
        return () => { cancelled = true; };
    }, []);

    const handleThreatClick = useCallback((t: any) => setSelectedThreat(t), []);
    const handleError       = useCallback((e: string | null) => setError(e), []);

    const threatTypes = useMemo(() => ['all', 'DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'], []);
    const severities  = useMemo(() => ['all', 'critical', 'high', 'medium', 'low'], []);

    return (
        <div className="threatmap-page">
            <div className="tm-top-bar">
                <div className="tm-header">
                    <div className="tm-header-left">
                        <div className="tm-header-icon"><Globe2 size={20} /></div>
                        <div>
                            <h1>Global Threat Map</h1>
                            <p className="tm-subtitle">Real-time view of global cyber threats from open-source intelligence and live feeds — AbuseIPDB + OTX.</p>
                        </div>
                    </div>
                    <div className="tm-header-right">
                        {overlayPoints.length > 0 && (
                            <div className="tm-header-meta">
                                <Target size={13} />
                                <div>
                                    <div className="tm-header-meta-value">{overlayPoints.length} scan target{overlayPoints.length !== 1 ? 's' : ''}</div>
                                    <div className="tm-header-meta-label">overlaid</div>
                                </div>
                            </div>
                        )}
                        <span className="tm-header-sep" />
                        <div className="tm-header-meta">
                            <CalendarClock size={13} />
                            <div>
                                <div className="tm-header-meta-label">Last Updated</div>
                                <div className="tm-header-meta-value">{liveStats.lastEventAt ? formatDateTime(liveStats.lastEventAt) : '—'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="tm-filters">
                    <div className="tm-filter-row">
                        <span className="tm-filter-label">Threat Type</span>
                        {threatTypes.map(type => (
                            <button
                                key={type}
                                className={`filter-btn ${filter === type ? 'active' : ''}`}
                                onClick={() => setFilter(type)}
                            >
                                {type === 'all' ? 'ALL' : type.toUpperCase()}
                            </button>
                        ))}
                    </div>
                    <span className="tm-filter-vsep" />
                    <div className="tm-filter-row">
                        <span className="tm-filter-label">Severity</span>
                        {severities.map(sev => (
                            <button
                                key={sev}
                                className={`filter-btn filter-btn--sev filter-btn--sev-${sev} ${filterSeverity === sev ? 'active' : ''}`}
                                onClick={() => setFilterSeverity(sev)}
                            >
                                {sev.toUpperCase()}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="tm-body">
                <div className="tm-map-wrapper">
                    {error && <div className="map-error" role="alert">{error}</div>}
                    <CyberThreatMap
                        filterType={filter}
                        filterSeverity={filterSeverity}
                        overlayPoints={overlayPoints}
                        onThreatClick={handleThreatClick}
                        onError={handleError}
                    />
                </div>

                <LiveStatsPanel
                    stats={liveStats}
                    overlayCount={overlayPoints.length}
                    feedConnected={feedConnected}
                />
            </div>

            {/* Threat click modal — unchanged from original */}
            {selectedThreat && (
                <div className="threat-modal-overlay" data-lenis-prevent onClick={() => setSelectedThreat(null)}>
                    <div className="threat-modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h2>THREAT DETECTED</h2>
                            <button className="close-btn" onClick={() => setSelectedThreat(null)}>×</button>
                        </div>
                        <div className="modal-body">
                            <div className="threat-row"><span className="label">ID:</span><span className="value mono">{selectedThreat.id}</span></div>
                            <div className="threat-row"><span className="label">TYPE:</span><span className="value highlight">{selectedThreat.type}</span></div>
                            <div className="threat-row"><span className="label">SEVERITY:</span><span className={`value badge ${selectedThreat.severity}`}>{selectedThreat.severity?.toUpperCase()}</span></div>
                            <div className="threat-row"><span className="label">TIMESTAMP:</span><span className="value mono">{new Date(selectedThreat.timestamp).toLocaleString()}</span></div>
                            <hr className="divider" />
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
        </div>
    );
};

export default GlobalThreatMapPage;
