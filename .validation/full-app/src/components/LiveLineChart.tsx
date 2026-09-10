// PERFORMANCE_MONITOR_PHASE1.md §6/§11 — rolling 60-second live line chart.
// Hand-rolled SVG, same no-charting-library approach as MultiSeriesChart.
// Fixed-length ring buffer (caller caps samples) so the browser never holds
// an unbounded array; path re-render is O(n) with n ≤ 60.
import React, { useMemo } from 'react';

export interface LiveSeries {
    label: string;
    color: string;
    values: (number | null)[];   // null = sample unavailable (gap, not zero)
}

interface LiveLineChartProps {
    series: LiveSeries[];
    height?: number;
    /** Fixed y-axis max (e.g. 100 for percent charts). When omitted, the max across visible samples is used. */
    maxOverride?: number;
    /** Formatter for the y-axis labels (e.g. rate formatting). */
    formatY?: (v: number) => string;
    emptyText?: string;
}

const LiveLineChart: React.FC<LiveLineChartProps> = ({
    series,
    height = 180,
    maxOverride,
    formatY,
    emptyText = 'Waiting for first sample…'
}) => {
    const width = 600;
    const PADDING = { top: 10, right: 12, bottom: 22, left: 48 };

    const n = Math.max(...series.map((s) => s.values.length), 0);
    const hasRealData = useMemo(
        () => series.some((s) => s.values.some((v) => v !== null)),
        [series]
    );

    if (!hasRealData) {
        return <div className="pm-chart-empty">{emptyText}</div>;
    }

    const innerW = width - PADDING.left - PADDING.right;
    const innerH = height - PADDING.top - PADDING.bottom;

    const sampleMax = Math.max(...series.flatMap((s) => s.values.filter((v): v is number => v !== null)), 0);
    const yMax = maxOverride ?? Math.max(sampleMax * 1.15, 1);

    // 0..n-1 map across the window; newest sample on the right.
    function xAt(i: number) {
        return n <= 1 ? PADDING.left + innerW / 2 : PADDING.left + (i / (n - 1)) * innerW;
    }
    function yAt(v: number) {
        return PADDING.top + innerH - Math.min(1, v / yMax) * innerH;
    }

    // Split each series into contiguous non-null segments so unavailable
    // samples render as gaps instead of fake drops to zero.
    const segments = series.map((s) => {
        const segs: { x: number; y: number }[][] = [];
        let cur: { x: number; y: number }[] = [];
        s.values.forEach((v, i) => {
            if (v === null) {
                if (cur.length > 1) segs.push(cur);
                cur = [];
            } else {
                cur.push({ x: xAt(i), y: yAt(v) });
            }
        });
        if (cur.length > 1) segs.push(cur);
        else if (cur.length === 1) segs.push([...cur, cur[0]]); // single point → flat tick
        return { color: s.color, segs };
    });

    const gridLevels = [0, 0.25, 0.5, 0.75, 1].map((f) => ({
        y: yAt(yMax * f),
        label: formatY ? formatY(yMax * f) : String(Math.round(yMax * f))
    }));

    return (
        <div className="pm-chart-wrapper">
            <svg
                viewBox={`0 0 ${width} ${height}`}
                preserveAspectRatio="none"
                className="pm-chart-svg"
                role="img"
                aria-label="Live metric chart, last 60 seconds"
            >
                {gridLevels.map((g, i) => (
                    <g key={i}>
                        <line x1={PADDING.left} y1={g.y} x2={width - PADDING.right} y2={g.y} className="pm-chart-grid" />
                        <text x={PADDING.left - 6} y={g.y + 4} className="pm-chart-axis-label" textAnchor="end">
                            {g.label}
                        </text>
                    </g>
                ))}
                {/* window boundary labels — 60s rolling, oldest left, newest right */}
                <text x={PADDING.left} y={height - 6} className="pm-chart-axis-label" textAnchor="start">-60s</text>
                <text x={width - PADDING.right} y={height - 6} className="pm-chart-axis-label" textAnchor="end">now</text>
                {segments.map((s, si) => (
                    <g key={si}>
                        {s.segs.map((seg, gi) => {
                            const d = seg.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
                            const area = seg.length > 1
                                ? `${d} L ${seg[seg.length - 1].x.toFixed(1)} ${yAt(0)} L ${seg[0].x.toFixed(1)} ${yAt(0)} Z`
                                : '';
                            return (
                                <g key={gi}>
                                    {area && <path d={area} fill={s.color} fillOpacity={0.07} />}
                                    <path d={d} fill="none" stroke={s.color} strokeWidth={1.6} strokeLinejoin="round" strokeLinecap="round" />
                                </g>
                            );
                        })}
                    </g>
                ))}
            </svg>
            <div className="pm-chart-legend">
                {series.map((s, i) => (
                    <div className="pm-chart-legend-item" key={i}>
                        <span className="pm-chart-legend-dot" style={{ background: s.color }} />
                        <span>{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default LiveLineChart;
