import React, { useEffect, useState } from 'react';
import { BarChart3, LineChart, PieChart } from 'lucide-react';
import StatisticsPage from './StatisticsPage';
import TrendsPage from './TrendsPage';
import AnalyticsPage from './AnalyticsPage';
import './AnalyticsPage.css';

// P1-3 — Analytics, Trends and Statistics were three nav leaves, three pages
// and three endpoints serving one analytical intent. They are NOT three views
// of the same numbers — Statistics is point-in-time counts, Trends is a time
// series, Analytics is derived rates (module effectiveness, activity by day /
// hour) — so nothing is deduplicated here and no endpoint is retired. What
// changes is that one question ("how are we doing?") stops being three
// separate menu entries the analyst has to know to compare by hand.
//
// Each tab keeps its own period control: Statistics has none, Trends offers
// 7d/30d/90d and Analytics 30d/90d/all. A single shared control would have
// silently broken two of the three, so the bodies are rendered unchanged.
export type AnalyticsTab = 'statistics' | 'trends' | 'analytics';

const TABS: { id: AnalyticsTab; label: string; icon: React.ComponentType<{ size?: number | string }> }[] = [
    { id: 'statistics', label: 'Statistics', icon: BarChart3 },
    { id: 'trends', label: 'Trends', icon: LineChart },
    { id: 'analytics', label: 'Analytics', icon: PieChart },
];

interface Props {
    // A redirected #/trends or #/statistics bookmark lands on its own tab
    // rather than dumping the analyst on the default one.
    initialTab?: AnalyticsTab | null;
    onInitialTabConsumed?: () => void;
}

const AnalyticsWorkspacePage: React.FC<Props> = ({ initialTab, onInitialTabConsumed }) => {
    const [tab, setTab] = useState<AnalyticsTab>(initialTab ?? 'statistics');

    useEffect(() => {
        if (initialTab) { setTab(initialTab); onInitialTabConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialTab]);

    return (
        // A new, dedicated wrapper class — NOT the shared "analytics-page"
        // class AnalyticsPage.tsx's own root div also uses (and StatisticsPage/
        // TrendsPage each carry their own padding + max-width too). Reusing it
        // here meant the visible tab body was double-padded — this page's own
        // header/tabs need no padding or max-width of their own.
        <div className="aw-page">
            <div className="aw-header">
                <div className="aw-header-icon"><BarChart3 size={20} /></div>
                <div>
                    <h1 className="aw-title">Analytics</h1>
                    <p className="aw-subtitle">Transform intelligence data into actionable insights.</p>
                </div>
            </div>

            {/* Segmented tab control — same tablist semantics, same setTab(t),
                same one-at-a-time mount (each body fetches on mount, so
                rendering all three would fire three requests for one visible
                view). Statistics has no period control of its own (it's
                point-in-time counts, not a series); Trends (7d/30d/90d) and
                Analytics (30d/90d/all) each keep their own real period
                selector inside their own body, exactly as before — a shared
                header-level date range would silently not apply to two of
                the three tabs, so none is added here. */}
            <div className="aw-tabs" role="tablist" aria-label="Analytics views">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.id} type="button" role="tab" id={`analytics-tab-${t.id}`}
                            aria-selected={tab === t.id} aria-controls="analytics-tabpanel"
                            className={`aw-tab${tab === t.id ? ' active' : ''}`}
                            onClick={() => setTab(t.id)}
                        >
                            <Icon size={14} />{t.label}
                        </button>
                    );
                })}
            </div>
            <div role="tabpanel" id="analytics-tabpanel" aria-labelledby={`analytics-tab-${tab}`}>
                {/* Mounted one at a time: each body fetches on mount, so rendering
                    all three would fire three requests for one visible view. */}
                {tab === 'statistics' && <StatisticsPage embedded />}
                {tab === 'trends' && <TrendsPage embedded />}
                {tab === 'analytics' && <AnalyticsPage embedded />}
            </div>
        </div>
    );
};

export default AnalyticsWorkspacePage;
