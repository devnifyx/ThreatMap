import React, { useCallback, useEffect, useState } from 'react';
import { getIntelligenceOverview, type IntelligenceOverview } from '../../../services/api';
import { formatDateTime } from '../ThreatIntelligenceShared';

interface OverviewSectionProps {
    onNavigate: (section: string) => void;
}

const OverviewSection: React.FC<OverviewSectionProps> = ({ onNavigate }) => {
    const [data, setData] = useState<IntelligenceOverview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getIntelligenceOverview()
            .then(setData)
            .catch((err) => setError(err?.message || 'Failed to load intelligence overview'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    const maxLandscapeCount = data ? Math.max(1, ...data.threatLandscape.map((c) => c.count)) : 1;

    return (
        <>
            <div className="ti-card">
                <div className="ti-section-header">
                    <span className="ti-card-title">Intelligence Overview</span>
                    <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                </div>

                {error ? (
                    <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
                ) : loading || !data ? (
                    <div className="ti-loading">Loading…</div>
                ) : (
                    <>
                        <div className="ti-kpi-row">
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('iocs')}>
                                <div className="ti-kpi-value">{data.totalIocs.toLocaleString()}</div>
                                <div className="ti-kpi-label">Total IOCs</div>
                            </button>
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('iocs')}>
                                <div className="ti-kpi-value">{data.activeIocs.toLocaleString()}</div>
                                <div className="ti-kpi-label">Active IOCs</div>
                            </button>
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('iocs')}>
                                <div className="ti-kpi-value ti-kpi-value--critical">{data.criticalIocs.toLocaleString()}</div>
                                <div className="ti-kpi-label">Critical IOCs</div>
                            </button>
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('campaigns')}>
                                <div className="ti-kpi-value">{data.activeCampaigns.toLocaleString()}</div>
                                <div className="ti-kpi-label">Active Campaigns</div>
                            </button>
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('feeds')}>
                                <div className="ti-kpi-value">{data.threatFeedsConfigured.toLocaleString()}</div>
                                <div className="ti-kpi-label">Threat Feeds</div>
                            </button>
                            <button type="button" className="ti-kpi-card" onClick={() => onNavigate('attack')}>
                                <div className="ti-kpi-value">{data.mitreTechniquesObserved.toLocaleString()}</div>
                                <div className="ti-kpi-label">MITRE Techniques</div>
                            </button>
                        </div>
                        <div className="ti-note" style={{ marginTop: '12px' }}>
                            {data.newIocsToday} new IOC{data.newIocsToday === 1 ? '' : 's'} today · {data.updatedIocsToday} updated today
                        </div>
                    </>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Threat Landscape</span></div>
                {!data || data.threatLandscape.length === 0 ? (
                    <div className="ti-empty">No categorized threat data yet.</div>
                ) : (
                    <div className="ti-bar-list">
                        {data.threatLandscape.map((c) => (
                            <div className="ti-bar-row" key={c.category}>
                                <span className="ti-bar-label" title={c.category}>{c.category}</span>
                                <span className="ti-bar-track"><span className="ti-bar-fill" style={{ width: `${(c.count / maxLandscapeCount) * 100}%` }} /></span>
                                <span className="ti-bar-count">{c.count}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Recent Activity</span></div>
                {!data || data.recentActivity.length === 0 ? (
                    <div className="ti-empty">No recent intelligence activity yet.</div>
                ) : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {data.recentActivity.map((e, i) => (
                            <div key={i} style={{ padding: '9px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                                    {e.severity && <span className={`ti-badge ti-badge--${e.severity.toLowerCase()}`}>{e.severity}</span>}
                                    <span style={{ fontSize: '0.88rem', flex: 1, minWidth: '200px' }}>{e.summary}</span>
                                    <span className="ti-note">{formatDateTime(e.occurred_at)}</span>
                                </div>
                                {e.source && <div className="ti-note" style={{ marginTop: '2px' }}>Source: {e.source}</div>}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </>
    );
};

export default OverviewSection;
