// DASHBOARD_PHASE2.md — Shared period toggle button group.
// Extracted from TrendsPage/AnalyticsPage to avoid duplication.
import './PeriodToggle.css';

export type TrendPeriod    = '7d' | '30d' | '90d';
export type AnalyticsPeriod = '30d' | '90d' | 'all';

interface PeriodToggleProps<T extends string> {
    value:    T;
    options:  { value: T; label: string }[];
    onChange: (p: T) => void;
}

export function PeriodToggle<T extends string>({ value, options, onChange }: PeriodToggleProps<T>) {
    return (
        <div className="period-toggle">
            {options.map(opt => (
                <button
                    key={opt.value}
                    type="button"
                    className={`period-toggle-btn${value === opt.value ? ' active' : ''}`}
                    onClick={() => onChange(opt.value)}
                >
                    {opt.label}
                </button>
            ))}
        </div>
    );
}

export const TREND_OPTIONS: { value: TrendPeriod; label: string }[] = [
    { value: '7d',  label: '7 days'  },
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
];

export const ANALYTICS_OPTIONS: { value: AnalyticsPeriod; label: string }[] = [
    { value: '30d', label: '30 days' },
    { value: '90d', label: '90 days' },
    { value: 'all', label: 'All time' },
];

export default PeriodToggle;
