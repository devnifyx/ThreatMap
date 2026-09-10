import React, { useState, useEffect, useMemo } from 'react';
import { ScanLine, Search, AlertTriangle, Megaphone, LineChart } from 'lucide-react';
import { getDashboardTrends } from '../../services/api';
import { PeriodToggle, TREND_OPTIONS, TrendPeriod } from '../../components/PeriodToggle';
import { MultiSeriesChart, ChartSeries } from '../../components/MultiSeriesChart';
import './TrendsPage.css';

// ── Types ──────────────────────────────────────────────────────────────────

interface TrendPoint { date: string; count: number }

interface TrendsData {
    period:  string;
    groupBy: 'DAY' | 'WEEK';
    series: {
        scans:          TrendPoint[];
        osint:          TrendPoint[];
        highCritical:   TrendPoint[];
        brandCampaigns: TrendPoint[] | null;
    };
}

// ── Helpers ────────────────────────────────────────────────────────────────

function sumPoints(pts: TrendPoint[]): number {
    return pts.reduce((acc, p) => acc + p.count, 0);
}

// ── Sub-components ─────────────────────────────────────────────────────────

// One KPI tile — a real period total only. No period-over-period trend
// arrow/percentage is shown here: the API response carries no comparison
// value to derive one from honestly.
const KpiCard: React.FC<{
    icon:  React.ComponentType<{ size?: number | string }>;
    label: string;
    value: number | null;
    tone:  'blue' | 'green' | 'red' | 'purple';
}> = ({ icon: Icon, label, value, tone }) => (
    <div className="trends-kpi-card">
        <div className={`trends-kpi-icon trends-kpi-icon--${tone}`}><Icon size={16} /></div>
        <div className="trends-kpi-body">
            <div className="trends-kpi-value">{value === null ? '—' : value.toLocaleString()}</div>
            <div className="trends-kpi-label">{label}</div>
        </div>
    </div>
);

const ChartCardHeader: React.FC<{ title: string; badge?: React.ReactNode }> = ({ title, badge }) => (
    <div className="trends-card-head">
        <div className="trends-card-title">{title}</div>
        {badge}
    </div>
);

// ── Main component ─────────────────────────────────────────────────────────

const TrendsPage: React.FC<{ embedded?: boolean }> = ({ embedded }) => {
    const [period, setPeriod]   = useState<TrendPeriod>('30d');
    const [data, setData]       = useState<TrendsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        getDashboardTrends(period)
            .then(d => { if (!cancelled) { setData(d as TrendsData); setLoading(false); } })
            .catch(e => { if (!cancelled) { setError(String(e?.message || 'Failed to load trends')); setLoading(false); } });
        return () => { cancelled = true; };
    }, [period]);

    // ── Build chart series ──
    const mainSeries = useMemo<ChartSeries[]>(() => {
        if (!data) return [];
        const s: ChartSeries[] = [
            { label: 'Web Checks',     color: '#58a6ff', points: data.series.scans },
            { label: 'Investigations', color: '#3fb950', points: data.series.osint },
        ];
        if (data.series.brandCampaigns) {
            s.push({ label: 'Brand Campaigns', color: '#a371f7', points: data.series.brandCampaigns });
        }
        return s;
    }, [data]);

    const highCritSeries = useMemo<ChartSeries[]>(() => {
        if (!data) return [];
        return [{ label: 'High / Critical Findings', color: '#f85149', points: data.series.highCritical }];
    }, [data]);

    const brandSeries = useMemo<ChartSeries[]>(() => {
        if (!data || !data.series.brandCampaigns) return [];
        return [{ label: 'Brand Campaigns', color: '#a371f7', points: data.series.brandCampaigns }];
    }, [data]);

    // ── KPI totals — real sums over the selected period only; the API
    // carries no prior-period comparison value, so no trend arrow or
    // percentage is derived or displayed anywhere on this page. ──
    const stats = useMemo(() => {
        if (!data) return null;
        return {
            scans:          sumPoints(data.series.scans),
            osint:          sumPoints(data.series.osint),
            highCritical:   sumPoints(data.series.highCritical),
            brandCampaigns: data.series.brandCampaigns ? sumPoints(data.series.brandCampaigns) : null,
        };
    }, [data]);

    return (
        <div className="trends-page">
            {/* ── Header ── */}
            <div className="trends-header">
                {!embedded && <h1 className="trends-title">Trends</h1>}
                <PeriodToggle value={period} options={TREND_OPTIONS} onChange={setPeriod} />
            </div>

            {loading && <div className="trends-loading">Loading…</div>}
            {error   && <div className="trends-error">{error}</div>}

            {!loading && !error && data && stats && (
                <>
                    {/* ── KPI row ── */}
                    <div className="trends-kpi-row">
                        <KpiCard icon={ScanLine}      label="Web Checks"      value={stats.scans}          tone="blue" />
                        <KpiCard icon={Search}        label="Investigations"  value={stats.osint}          tone="green" />
                        <KpiCard icon={AlertTriangle} label="High / Critical" value={stats.highCritical}   tone="red" />
                        <KpiCard icon={Megaphone}     label="Brand Campaigns" value={stats.brandCampaigns} tone="purple" />
                    </div>

                    {/* ── Main combined chart — full-width, dominant ── */}
                    <section className="trends-card trends-card--main">
                        <ChartCardHeader
                            title="Activity Over Time"
                            badge={<span className="trends-chart-type-badge"><LineChart size={12} />Line Chart</span>}
                        />
                        <MultiSeriesChart
                            series={mainSeries}
                            height={220}
                            emptyText="No activity data for this period."
                        />
                    </section>

                    {/* ── Secondary charts ── */}
                    <div className={`trends-secondary-grid${data.series.brandCampaigns ? '' : ' trends-secondary-grid--single'}`}>
                        <section className="trends-card">
                            <ChartCardHeader
                                title="High / Critical Findings"
                                badge={<span className="trends-card-badge trends-card-badge--red">{stats.highCritical.toLocaleString()} Total</span>}
                            />
                            <MultiSeriesChart
                                series={highCritSeries}
                                height={140}
                                emptyText="No high/critical findings in this period."
                            />
                        </section>

                        {data.series.brandCampaigns && (
                            <section className="trends-card">
                                <ChartCardHeader
                                    title="Brand Campaigns"
                                    badge={<span className="trends-card-badge trends-card-badge--purple">{(stats.brandCampaigns ?? 0).toLocaleString()} Total</span>}
                                />
                                <MultiSeriesChart
                                    series={brandSeries}
                                    height={140}
                                    emptyText="No brand campaign activity in this period."
                                />
                            </section>
                        )}
                    </div>
                </>
            )}
        </div>
    );
};

export default TrendsPage;
