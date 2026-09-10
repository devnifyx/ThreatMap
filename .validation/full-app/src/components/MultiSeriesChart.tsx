// DASHBOARD_PHASE2.md §4 — Hand-rolled SVG multi-series trend chart.
// No charting library — consistent with DashboardPage's TrendLine approach.
import React, { useMemo, useRef, useState } from 'react';
import './MultiSeriesChart.css';

export interface ChartSeries {
    label:  string;
    color:  string;
    points: { date: string; count: number }[];
}

interface MultiSeriesChartProps {
    series:     ChartSeries[];
    height?:    number;   // default 160
    emptyText?: string;
}

// Merge all series onto a shared sorted date axis, filling zeros for missing dates.
function alignSeries(series: ChartSeries[]): { dates: string[]; aligned: number[][] } {
    const dateSet = new Set<string>();
    for (const s of series) s.points.forEach(p => dateSet.add(p.date));
    const dates = Array.from(dateSet).sort();
    const aligned = series.map(s => {
        const map: Record<string, number> = {};
        s.points.forEach(p => { map[p.date] = p.count; });
        return dates.map(d => map[d] ?? 0);
    });
    return { dates, aligned };
}

function dateLabel(iso: string): string {
    try {
        const d = new Date(iso + 'T00:00:00Z');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch { return iso; }
}

function dateLabelFull(iso: string): string {
    try {
        const d = new Date(iso + 'T00:00:00Z');
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    } catch { return iso; }
}

export const MultiSeriesChart: React.FC<MultiSeriesChartProps> = ({
    series,
    height = 160,
    emptyText = 'No data yet.',
}) => {
    const width   = 500;
    const PADDING = { top: 8, right: 8, bottom: 28, left: 32 };
    const svgRef  = useRef<SVGSVGElement>(null);

    // Index of the date column currently under the pointer — drives the
    // hover guide line, the emphasized data-point markers, and the tooltip.
    // null means "not hovering".
    const [hoverIdx, setHoverIdx] = useState<number | null>(null);

    const { dates, aligned } = useMemo(() => alignSeries(series), [series]);

    if (!dates.length || series.every(s => s.points.length === 0)) {
        return <div className="msc-empty">{emptyText}</div>;
    }

    const globalMax = Math.max(...aligned.flat(), 1);
    const innerW    = width  - PADDING.left - PADDING.right;
    const innerH    = height - PADDING.top  - PADDING.bottom;
    const n         = dates.length;

    function xAt(i: number) {
        return n <= 1 ? PADDING.left + innerW / 2 : PADDING.left + (i / (n - 1)) * innerW;
    }
    function yAt(v: number) {
        return PADDING.top + innerH - (v / globalMax) * innerH;
    }

    // Y-axis grid lines (5 levels)
    const gridLevels = [0, 0.25, 0.5, 0.75, 1].map(f => ({
        y:     yAt(globalMax * f),
        label: String(Math.round(globalMax * f)),
    }));

    // X-axis tick labels: show at most 6 evenly-spaced dates
    const tickIndices = dates.length <= 6
        ? dates.map((_, i) => i)
        : Array.from({ length: 6 }, (_, k) => Math.round((k / 5) * (dates.length - 1)));

    function handlePointerMove(e: React.MouseEvent<SVGSVGElement>) {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        if (!rect.width) return;
        // Convert the real pointer position into the SVG's own viewBox
        // coordinate space (the element is scaled by preserveAspectRatio),
        // then snap to the nearest date column.
        const scaleX = width / rect.width;
        const mouseX = (e.clientX - rect.left) * scaleX;
        let nearest = 0;
        let minDist = Infinity;
        for (let i = 0; i < n; i++) {
            const d = Math.abs(xAt(i) - mouseX);
            if (d < minDist) { minDist = d; nearest = i; }
        }
        setHoverIdx(nearest);
    }
    function handlePointerLeave() {
        setHoverIdx(null);
    }

    // Tooltip horizontal placement as a percentage of chart width, clamped
    // near the edges so it doesn't overflow the card.
    const hoverPct = hoverIdx !== null ? (xAt(hoverIdx) / width) * 100 : null;
    const tooltipAlign: 'left' | 'center' | 'right' =
        hoverPct === null ? 'center' : hoverPct < 15 ? 'left' : hoverPct > 85 ? 'right' : 'center';

    return (
        <div className="msc-wrapper">
            <div className="msc-chart-area">
                <svg
                    ref={svgRef}
                    viewBox={`0 0 ${width} ${height}`}
                    preserveAspectRatio="xMidYMid meet"
                    className="msc-svg"
                    role="img"
                    aria-label="Multi-series trend chart"
                    onMouseMove={handlePointerMove}
                    onMouseLeave={handlePointerLeave}
                >
                    {/* Grid lines */}
                    {gridLevels.map((g, i) => (
                        <g key={i}>
                            <line
                                x1={PADDING.left} y1={g.y}
                                x2={width - PADDING.right} y2={g.y}
                                className="msc-grid"
                            />
                            <text
                                x={PADDING.left - 4} y={g.y + 4}
                                className="msc-axis-label"
                                textAnchor="end"
                            >
                                {g.label}
                            </text>
                        </g>
                    ))}

                    {/* Hover guide line */}
                    {hoverIdx !== null && (
                        <line
                            x1={xAt(hoverIdx)} y1={PADDING.top}
                            x2={xAt(hoverIdx)} y2={height - PADDING.bottom}
                            className="msc-hover-line"
                        />
                    )}

                    {/* Series paths */}
                    {aligned.map((values, si) => {
                        const coords  = values.map((v, i) => ({ x: xAt(i), y: yAt(v) }));
                        const linePath = coords
                            .map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
                            .join(' ');
                        const areaPath = n > 1
                            ? `${linePath} L ${coords[n-1].x.toFixed(1)} ${yAt(0)} L ${coords[0].x.toFixed(1)} ${yAt(0)} Z`
                            : '';
                        return (
                            <g key={si}>
                                {areaPath && (
                                    <path
                                        d={areaPath}
                                        fill={series[si].color}
                                        fillOpacity={0.08}
                                    />
                                )}
                                <path
                                    d={linePath}
                                    fill="none"
                                    stroke={series[si].color}
                                    strokeWidth={1.5}
                                    strokeLinejoin="round"
                                />
                                {/* Subtle markers at every real data point */}
                                {coords.map((c, i) => (
                                    <circle
                                        key={i}
                                        cx={c.x} cy={c.y}
                                        r={hoverIdx === i ? 3.5 : 2}
                                        fill={hoverIdx === i ? '#0b0e14' : series[si].color}
                                        stroke={series[si].color}
                                        strokeWidth={hoverIdx === i ? 2 : 0}
                                        className={hoverIdx === i ? 'msc-point msc-point--active' : 'msc-point'}
                                    />
                                ))}
                            </g>
                        );
                    })}

                    {/* X-axis tick labels */}
                    {tickIndices.map(i => (
                        <text
                            key={i}
                            x={xAt(i)}
                            y={height - 6}
                            className="msc-axis-label"
                            textAnchor="middle"
                        >
                            {dateLabel(dates[i])}
                        </text>
                    ))}
                </svg>

                {/* Tooltip — real values only, snapped to the hovered date column */}
                {hoverIdx !== null && hoverPct !== null && (
                    <div
                        className={`msc-tooltip msc-tooltip--${tooltipAlign}`}
                        style={{ left: `${hoverPct}%` }}
                    >
                        <div className="msc-tooltip-date">{dateLabelFull(dates[hoverIdx])}</div>
                        {series.map((s, si) => (
                            <div className="msc-tooltip-row" key={si}>
                                <span className="msc-tooltip-dot" style={{ background: s.color }} />
                                <span className="msc-tooltip-label">{s.label}</span>
                                <span className="msc-tooltip-value">{aligned[si][hoverIdx].toLocaleString()}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="msc-legend">
                {series.map((s, i) => (
                    <div className="msc-legend-item" key={i}>
                        <span className="msc-legend-dot" style={{ background: s.color }} />
                        <span>{s.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default MultiSeriesChart;
