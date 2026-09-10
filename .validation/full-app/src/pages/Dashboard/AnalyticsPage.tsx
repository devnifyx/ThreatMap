import React, { useState, useEffect } from 'react';
import { getDashboardAnalytics } from '../../services/api';
import { PeriodToggle, ANALYTICS_OPTIONS, AnalyticsPeriod } from '../../components/PeriodToggle';
import './AnalyticsPage.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface ModuleEffectiveness {
    module:           string;
    slug:             string;
    total:            number;
    critical:         number;
    high:             number;
    medium:           number;
    low:              number;
    highCriticalRate: number | null;
}

interface DowPoint  { dow:  number; label: string; count: number }
interface HourPoint { hour: number; count: number }

interface AnalyticsData {
    period: string;
    moduleEffectiveness: ModuleEffectiveness[];
    activityByDow: {
        osint: DowPoint[];
        scans: DowPoint[];
    };
    activityByHour: {
        osint: HourPoint[];
    };
}

// ── Sub-components ─────────────────────────────────────────────────────────

const ModuleEffectivenessTable: React.FC<{ rows: ModuleEffectiveness[] }> = ({ rows }) => {
    if (!rows.length) return <p className="analytics-empty">No module data available.</p>;
    return (
        <div className="met-wrapper">
            <table className="met-table">
                <thead>
                    <tr>
                        <th>Module</th>
                        <th>Total</th>
                        <th>High / Critical</th>
                        <th>HC Rate</th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map(r => {
                        const hc   = (r.critical || 0) + (r.high || 0);
                        const rate = r.highCriticalRate ?? 0;
                        const bg   = rate >= 30 ? 'rgba(248,81,73,0.18)' : rate >= 15 ? 'rgba(210,153,34,0.18)' : 'transparent';
                        const fg   = rate >= 30 ? '#f85149' : rate >= 15 ? '#d29922' : 'inherit';
                        return (
                            <tr key={r.module}>
                                <td className="met-module-name">{r.module}</td>
                                <td>{r.total.toLocaleString()}</td>
                                <td>
                                    <span className="met-rate-cell" style={{ background: bg, color: fg }}>
                                        {hc.toLocaleString()}
                                    </span>
                                </td>
                                <td>
                                    <span className="met-rate-cell" style={{ background: bg, color: fg }}>
                                        {rate.toFixed(1)}%
                                    </span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DowBarChartProps {
    data:  DowPoint[];
    color: string;
    label: string;
}

const DowBarChart: React.FC<DowBarChartProps> = ({ data, color, label }) => {
    const max = Math.max(...data.map(d => d.count), 1);
    return (
        <div className="dow-chart">
            <div className="dow-chart-label">{label}</div>
            <div className="dow-bars">
                {data.map(d => (
                    <div className="dow-bar-col" key={d.dow}>
                        <div className="dow-bar-track">
                            <div
                                className="dow-bar-fill"
                                style={{ height: `${(d.count / max) * 100}%`, background: color }}
                            />
                        </div>
                        <span className="dow-bar-day">{DOW_LABELS[d.dow] ?? d.label}</span>
                        <span className="dow-bar-count">{d.count}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const HourOfDayChart: React.FC<{ data: HourPoint[] }> = ({ data }) => {
    const max = Math.max(...data.map(d => d.count), 1);
    const HEIGHT = 80;
    const WIDTH  = 500;
    const PADR   = 8;
    const PADL   = 28;
    const PADT   = 6;
    const PADB   = 24;
    const innerW = WIDTH - PADL - PADR;
    const innerH = HEIGHT - PADT - PADB;
    const n = data.length || 24;

    function xAt(i: number) { return PADL + (i + 0.5) * (innerW / n); }
    function yAt(v: number) { return PADT + innerH - (v / max) * innerH; }

    return (
        <div className="hour-chart">
            <div className="hour-chart-title">Activity by Hour of Day</div>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                preserveAspectRatio="xMidYMid meet"
                className="hour-chart-svg"
                role="img"
                aria-label="Hourly activity chart"
            >
                {/* bars */}
                {data.map((d, i) => {
                    const barH = Math.max((d.count / max) * innerH, d.count > 0 ? 1 : 0);
                    const barW = Math.max(innerW / n - 1, 2);
                    return (
                        <rect
                            key={d.hour}
                            x={xAt(i) - barW / 2}
                            y={yAt(d.count)}
                            width={barW}
                            height={barH}
                            fill="#3fb950"
                            fillOpacity={0.65}
                            rx={1}
                        />
                    );
                })}

                {/* Hour labels every 6 hours */}
                {data.filter(d => d.hour % 6 === 0).map(d => (
                    <text
                        key={d.hour}
                        x={xAt(data.indexOf(d))}
                        y={HEIGHT - 4}
                        className="hour-axis-label"
                        textAnchor="middle"
                    >
                        {`${String(d.hour).padStart(2, '0')}:00`}
                    </text>
                ))}
            </svg>
            <div className="hour-chart-note">All times UTC</div>
        </div>
    );
};

// ── Main component ─────────────────────────────────────────────────────────

const AnalyticsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
    const [period, setPeriod]   = useState<AnalyticsPeriod>('90d');
    const [data, setData]       = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDashboardAnalytics(period)
            .then(d => { if (!cancelled) { setData(d as unknown as AnalyticsData); setLoading(false); } })
            .catch(e => { if (!cancelled) { setError(String(e?.message || 'Failed to load analytics')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [period]);

    return (
        <div className="analytics-page">
            {/* ── Header ── */}
            <div className="analytics-header">
                {!embedded && <h1 className="analytics-title">Analytics</h1>}
                <PeriodToggle value={period} options={ANALYTICS_OPTIONS} onChange={setPeriod} />
            </div>

            {loading && <div className="analytics-loading">Loading…</div>}
            {error   && <div className="analytics-error">{error}</div>}

            {!loading && !error && data && (
                <div className="analytics-body">

                    {/* ── Module effectiveness ── */}
                    <section className="analytics-card analytics-card--wide">
                        <div className="analytics-card-title">Module Effectiveness</div>
                        <ModuleEffectivenessTable rows={data.moduleEffectiveness} />
                    </section>

                    {/* ── Day-of-week charts ── */}
                    <section className="analytics-card analytics-card--wide">
                        <div className="analytics-card-title">Activity by Day of Week</div>
                        <div className="dow-row">
                            <DowBarChart
                                data={data.activityByDow.osint}
                                color="#3fb950"
                                label="Investigations (OSINT)"
                            />
                            <DowBarChart
                                data={data.activityByDow.scans}
                                color="#58a6ff"
                                label="Web Checks"
                            />
                        </div>
                    </section>

                    {/* ── Hour of day chart ── */}
                    <section className="analytics-card analytics-card--wide">
                        <div className="analytics-card-title">Investigation Activity by Hour</div>
                        <HourOfDayChart data={data.activityByHour.osint} />
                    </section>

                </div>
            )}
        </div>
    );
};

export default AnalyticsPage;
