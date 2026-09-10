import React, { useState, useEffect } from 'react';
import { getDashboardRiskScores } from '../../services/api';
import './RiskScoresPage.css';

interface ModuleRisk {
    module: string;
    slug: string;
    critical: number;
    high: number;
    medium: number;
    low: number;
    total: number;
}

interface RecentHighCritical {
    id: string;
    target: string;
    kind: string;
    kindSlug: string;
    risk: string;
    timestamp: string | null;
}

interface RiskScoresData {
    overall: { Critical: number; High: number; Medium: number; Low: number };
    byModule: ModuleRisk[];
    recentHighCritical: RecentHighCritical[];
}

function timeAgo(isoString: string): string {
    const diff = Date.now() - new Date(isoString).getTime();
    const mins  = Math.floor(diff / 60_000);
    if (mins < 1)  return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)  return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

const RISK_LEVELS = [
    { key: 'Critical' as const, color: '#f85149' },
    { key: 'High'     as const, color: '#d29922' },
    { key: 'Medium'   as const, color: '#58a6ff' },
    { key: 'Low'      as const, color: '#3fb950' },
];

const RiskDistributionBars: React.FC<{ overall: RiskScoresData['overall'] }> = ({ overall }) => {
    const total = RISK_LEVELS.reduce((s, l) => s + (overall[l.key] || 0), 0);
    const max   = Math.max(...RISK_LEVELS.map(l => overall[l.key] || 0), 1);

    return (
        <div className="risk-dist-bars">
            {RISK_LEVELS.map(({ key, color }) => {
                const count = overall[key] || 0;
                const pct   = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';
                return (
                    <div className="risk-dist-row" key={key}>
                        <span className="risk-dist-label">{key}</span>
                        <div className="risk-dist-track">
                            <div
                                className="risk-dist-fill"
                                style={{ width: `${(count / max) * 100}%`, background: color }}
                            />
                        </div>
                        <span className="risk-dist-count">{count.toLocaleString()}</span>
                        <span className="risk-dist-pct">({pct}%)</span>
                    </div>
                );
            })}
            <div className="risk-dist-total">Total findings: {total.toLocaleString()}</div>
        </div>
    );
};

const RiskBadge: React.FC<{ risk: string }> = ({ risk }) => (
    <span className={`findings-risk-badge findings-risk-badge--${risk.toLowerCase()}`}>{risk}</span>
);

const RiskScoresPage: React.FC = () => {
    const [data, setData]       = useState<RiskScoresData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        getDashboardRiskScores()
            .then((res) => {
                if (!cancelled) {
                    setData(res as unknown as RiskScoresData);
                    setLoading(false);
                }
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(String(err?.message || 'Failed to load risk scores'));
                    setLoading(false);
                }
            });
        return () => { cancelled = true; };
    }, []);

    if (loading) {
        return <div className="risk-scores-page"><div className="risk-loading">Loading…</div></div>;
    }
    if (error) {
        return <div className="risk-scores-page"><div className="risk-error">{error}</div></div>;
    }
    if (!data) return null;

    return (
        <div className="risk-scores-page">
            <h1 className="risk-scores-title">Risk Scores</h1>

            {/* Overall Distribution */}
            <section className="risk-section">
                <div className="risk-section-title">Overall Risk Distribution</div>
                <RiskDistributionBars overall={data.overall} />
            </section>

            {/* Per-module breakdown */}
            <section className="risk-section">
                <div className="risk-section-title">Risk by Module</div>
                {data.byModule.length === 0 ? (
                    <div className="risk-empty">No module data yet.</div>
                ) : (
                    <div className="risk-table-wrap">
                        <table className="risk-module-table">
                            <thead>
                                <tr>
                                    <th>Module</th>
                                    <th>Critical</th>
                                    <th>High</th>
                                    <th>Medium</th>
                                    <th>Low</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.byModule.map((r) => (
                                    <tr key={r.slug}>
                                        <td>{r.module}</td>
                                        <td className={r.critical > 0 ? 'risk-cell--critical' : ''}>{r.critical}</td>
                                        <td className={r.high > 0     ? 'risk-cell--high'     : ''}>{r.high}</td>
                                        <td>{r.medium}</td>
                                        <td>{r.low}</td>
                                        <td>{r.total}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Recent High/Critical */}
            <section className="risk-section">
                <div className="risk-section-title">Recent High / Critical Findings</div>
                {data.recentHighCritical.length === 0 ? (
                    <div className="risk-empty">None yet.</div>
                ) : (
                    <div className="risk-recent-list">
                        {data.recentHighCritical.map((r) => (
                            <div className="risk-recent-row" key={r.id}>
                                <span className="risk-recent-target" title={r.target}>{r.target}</span>
                                <span className="findings-kind-badge">{r.kind}</span>
                                <RiskBadge risk={r.risk} />
                                <span className="risk-recent-time">
                                    {r.timestamp ? timeAgo(r.timestamp) : '—'}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
};

export default RiskScoresPage;
