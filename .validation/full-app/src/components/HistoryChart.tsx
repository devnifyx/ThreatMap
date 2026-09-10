// PERFORMANCE_MONITOR_PHASE4.md §31 — historical series chart with baseline
// line, threshold line, anomaly markers and honest gaps (missing buckets are
// never interpolated). Hand-rolled SVG like every other LekirraX chart.
import React, { useMemo } from 'react';

export interface HistorySeriesPoint {
    t: string;
    avg: number | null;
    min?: number | null;
    max?: number | null;
    p95?: number | null;
}

interface HistoryChartProps {
    points: HistorySeriesPoint[];
    baseline?: number | null;
    threshold?: number | null;
    /** markers: ISO timestamps where anomaly episodes started */
    anomalyMarkers?: string[];
    formatY?: (v: number) => string;
    height?: number;
    emptyText?: string;
}

const HistoryChart: React.FC<HistoryChartProps> = ({
    points, baseline, threshold, anomalyMarkers = [], formatY,
    height = 190, emptyText = 'Insufficient historical data'
}) => {
    const width = 640;
    const PADDING = { top: 12, right: 14, bottom: 24, left: 52 };

    const valid = useMemo(() => points.filter((p) => p.avg !== null && Number.isFinite(p.avg as number)), [points]);
    if (!valid.length) {
        return <div className="pm-chart-empty">{emptyText}</div>;
    }

    const innerW = width - PADDING.left - PADDING.right;
    const innerH = height - PADDING.top - PADDING.bottom;

    const allVals = valid.map((p) => p.avg as number);
    if (baseline != null) allVals.push(baseline);
    if (threshold != null) allVals.push(threshold);
    const yMax = Math.max(...allVals) * 1.1 || 1;
    const yMin = 0;

    const t0 = new Date(valid[0].t).getTime();
    const t1 = new Date(valid[valid.length - 1].t).getTime();
    const span = Math.max(1, t1 - t0);
    const xAt = (t: number) => PADDING.left + ((t - t0) / span) * innerW;
    const yAt = (v: number) => PADDING.top + innerH - ((v - yMin) / (yMax - yMin)) * innerH;

    // contiguous segments split at missing buckets (gaps stay gaps — §38 Test 6)
    const segments: { x: number; y: number; t: number }[][] = [];
    let cur: { x: number; y: number; t: number }[] = [];
    let prevT = 0;
    for (const p of points) {
        const t = new Date(p.t).getTime();
        if (p.avg === null || !Number.isFinite(p.avg as number)) {
            if (cur.length > 1) segments.push(cur);
            cur = [];
        } else {
            // large gap between consecutive points → break the line too
            if (prevT && t - prevT > span * 0.08 && cur.length > 1) {
                segments.push(cur);
                cur = [];
            }
            cur.push({ x: xAt(t), y: yAt(p.avg as number), t });
        }
        prevT = t;
    }
    if (cur.length > 1) segments.push(cur);
    else if (cur.length === 1) segments.push([...cur, cur[0]]);

    const gridLevels = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        y: yAt(yMin + (yMax - yMin) * f),
        label: formatY ? formatY(yMin + (yMax - yMin) * f) : String(Math.round(yMin + (yMax - yMin) * f))
    }));

    const fmtTime = (iso: string) => {
        try { return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }); }
        catch { return iso; }
    };

    return (
        <div className="pm-chart-wrapper">
            <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" className="pm-chart-svg" role="img" aria-label="Historical metric chart">
                {gridLevels.map((g, i) => (
                    <g key={i}>
                        <line x1={PADDING.left} y1={g.y} x2={width - PADDING.right} y2={g.y} className="pm-chart-grid" />
                        <text x={PADDING.left - 6} y={g.y + 4} className="pm-chart-axis-label" textAnchor="end">{g.label}</text>
                    </g>
                ))}
                {/* baseline line (§31) */}
                {baseline != null && baseline <= yMax && (
                    <g>
                        <line x1={PADDING.left} y1={yAt(baseline)} x2={width - PADDING.right} y2={yAt(baseline)} className="pm-hist-baseline" strokeDasharray="6 4" />
                        <text x={width - PADDING.right} y={yAt(baseline) - 4} className="pm-chart-axis-label" textAnchor="end">baseline {formatY ? formatY(baseline) : Math.round(baseline)}</text>
                    </g>
                )}
                {/* threshold line */}
                {threshold != null && threshold <= yMax && (
                    <g>
                        <line x1={PADDING.left} y1={yAt(threshold)} x2={width - PADDING.right} y2={yAt(threshold)} className="pm-hist-threshold" strokeDasharray="3 3" />
                        <text x={PADDING.left + 4} y={yAt(threshold) - 4} className="pm-chart-axis-label">threshold {formatY ? formatY(threshold) : Math.round(threshold)}</text>
                    </g>
                )}
                {/* anomaly episode markers */}
                {anomalyMarkers.map((iso, i) => {
                    const t = new Date(iso).getTime();
                    if (t < t0 || t > t1) return null;
                    return (
                        <g key={`m${i}`}>
                            <line x1={xAt(t)} y1={PADDING.top} x2={xAt(t)} y2={PADDING.top + innerH} className="pm-hist-anomaly" />
                            <circle cx={xAt(t)} cy={PADDING.top + 4} r={3} className="pm-hist-anomaly-dot" />
                        </g>
                    );
                })}
                {segments.map((seg, si) => {
                    const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                    const area = seg.length > 1
                        ? `${d} L ${seg[seg.length - 1].x.toFixed(1)} ${yAt(yMin)} L ${seg[0].x.toFixed(1)} ${yAt(yMin)} Z`
                        : '';
                    return (
                        <g key={si}>
                            {area && <path d={area} fill="var(--pm-cyan)" fillOpacity={0.06} />}
                            <path d={d} fill="none" stroke="var(--pm-cyan)" strokeWidth={1.5} strokeLinejoin="round" />
                        </g>
                    );
                })}
                <text x={PADDING.left} y={height - 6} className="pm-chart-axis-label" textAnchor="start">{fmtTime(valid[0].t)}</text>
                <text x={width - PADDING.right} y={height - 6} className="pm-chart-axis-label" textAnchor="end">{fmtTime(valid[valid.length - 1].t)}</text>
            </svg>
        </div>
    );
};

export default HistoryChart;
