import React, { useCallback, useEffect, useState } from 'react';
import type { BrandOverview, BrandPersistentCampaign } from '../../../types/index';
import { getBrandOverview, getBrandPersistentCampaigns, createBrandMonitor } from '../../../services/api';

// BRAND_INTELLIGENCE_PASS7.md §4/§19/§25 — brand-scoped (not per-job) view:
// the persistent campaign identities that survive across investigations,
// the real-data overview, and the monitoring opt-in. Distinct from the
// per-investigation OverviewPane.tsx, which stays exactly as-is (§2 "Do not
// rebuild any of these features").

interface Props {
    brandId: number;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
}

function riskClass(level: string | null | undefined): string {
    switch ((level || '').toLowerCase()) {
        case 'critical': return 'bi-risk-critical';
        case 'high':     return 'bi-risk-high';
        case 'medium':   return 'bi-risk-medium';
        case 'low':      return 'bi-risk-low';
        default:         return 'bi-risk-none';
    }
}

function campaignStatusLabel(status: BrandPersistentCampaign['status']): string {
    switch (status) {
        case 'active':            return 'Active';
        case 'dormant':           return 'Dormant';
        case 'resolved':          return 'Resolved';
        case 'confirmed_takedown': return 'Confirmed Takedown';
        default:                  return status;
    }
}

const BrandOverviewPane: React.FC<Props> = ({ brandId }) => {
    const [overview, setOverview] = useState<BrandOverview | null>(null);
    const [campaigns, setCampaigns] = useState<BrandPersistentCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [monitoring, setMonitoring] = useState(false);
    const [monitorError, setMonitorError] = useState<string | null>(null);
    const [monitorEnabled, setMonitorEnabled] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        Promise.all([getBrandOverview(brandId), getBrandPersistentCampaigns(brandId)])
            .then(([ov, camp]) => {
                setOverview(ov.overview);
                setCampaigns(camp.campaigns ?? []);
            })
            .catch((err) => setError(err.message || 'Failed to load overview'))
            .finally(() => setLoading(false));
    }, [brandId]);

    useEffect(() => { load(); }, [load]);
    // Monitor state resets whenever the brand changes — this pane doesn't
    // currently have a "is a monitor already configured" read endpoint, so
    // the button re-offers itself per brand switch rather than guessing.
    useEffect(() => { setMonitorEnabled(false); setMonitorError(null); }, [brandId]);

    const handleEnableMonitoring = useCallback(async () => {
        setMonitoring(true);
        setMonitorError(null);
        try {
            await createBrandMonitor(brandId);
            setMonitorEnabled(true);
        } catch (err: any) {
            setMonitorError(err.message || 'Failed to enable monitoring');
        } finally {
            setMonitoring(false);
        }
    }, [brandId]);

    if (loading) return <div className="bi-loading" style={{ fontSize: '0.85rem' }}>Loading overview…</div>;
    if (error) return <div className="bi-error" role="alert">{error}</div>;
    if (!overview) return null;

    return (
        <div className="bi-pane">
            {!overview.hasCompletedInvestigation && campaigns.length === 0 && (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No completed investigation yet</p>
                    <p className="bi-empty-sub">Run an investigation below to populate the brand overview and enable monitoring.</p>
                </div>
            )}

            {(overview.hasCompletedInvestigation || campaigns.length > 0) && (
                <>
                    <p className="bi-section-title">Brand Overview</p>
                    <div className="bi-overview-counts">
                        <div className={`bi-count-card ${riskClass(overview.brandRiskLevel)}`}>
                            <div className="bi-count-num">{overview.brandRiskLevel}</div>
                            <div className="bi-count-label">
                                Brand Risk{overview.brandRiskSource ? ` (${overview.brandRiskSource === 'active_persistent_campaign' ? 'active campaign' : 'latest investigation'})` : ''}
                            </div>
                        </div>
                        <div className="bi-count-card">
                            <div className="bi-count-num">{overview.officialDomains}</div>
                            <div className="bi-count-label">Official Domains</div>
                        </div>
                        <div className="bi-count-card bi-risk-high">
                            <div className="bi-count-num">{overview.suspiciousDomains}</div>
                            <div className="bi-count-label">Suspicious Domains</div>
                        </div>
                        <div className="bi-count-card bi-risk-medium">
                            <div className="bi-count-num">{overview.impersonatingSocialAccounts}</div>
                            <div className="bi-count-label">Impersonating Social Accounts</div>
                        </div>
                        <div className="bi-count-card bi-risk-high">
                            <div className="bi-count-num">{overview.activeCampaigns}</div>
                            <div className="bi-count-label">Active Campaigns</div>
                        </div>
                        <div className="bi-count-card">
                            <div className="bi-count-num">{overview.historicalCampaigns}</div>
                            <div className="bi-count-label">Historical Campaigns</div>
                        </div>
                        <div className="bi-count-card">
                            <div className="bi-count-num">{overview.deepScans}</div>
                            <div className="bi-count-label">Deep Scans</div>
                        </div>
                        <div className="bi-count-card bi-risk-medium">
                            <div className="bi-count-num">{overview.openAlerts}</div>
                            <div className="bi-count-label">Open Alerts</div>
                        </div>
                        <div className="bi-count-card">
                            <div className="bi-count-num">{overview.infrastructureRelationships}</div>
                            <div className="bi-count-label">Infrastructure Relationships</div>
                        </div>
                    </div>

                    {overview.recentRiskChanges.length > 0 && (
                        <div className="bi-signal-note" style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            {overview.recentRiskChanges.map((c) => (
                                <div key={c.persistentCampaignId}>
                                    Risk changed for <strong>{c.name}</strong>: {c.from ?? 'Unknown'} → {c.to ?? 'Unknown'} ({formatDate(c.at)})
                                </div>
                            ))}
                        </div>
                    )}

                    {/* §19 "BRAND MONITORING" — reuses the existing monitoring system. */}
                    <div className="bi-scan-panel" style={{ marginTop: '0.5rem' }}>
                        <div className="bi-scan-panel-info">
                            <p className="bi-scan-panel-title">Continuous Monitoring</p>
                            <p className="bi-scan-panel-sub">
                                {monitorEnabled
                                    ? 'This brand is now a monitoring target — new suspicious domains, social accounts, campaign growth, risk changes and Deep Scan findings will raise alerts in the Alert Center.'
                                    : 'Register this brand with the existing monitoring system. Monitoring re-checks the latest investigation’s results periodically — it never starts a new investigation on its own.'}
                            </p>
                            {monitorError && <div className="bi-error" role="alert">{monitorError}</div>}
                        </div>
                        {!monitorEnabled && (
                            <button
                                type="button"
                                className="bi-btn-secondary"
                                onClick={handleEnableMonitoring}
                                disabled={monitoring || !overview.hasCompletedInvestigation}
                                aria-busy={monitoring}
                                title={overview.hasCompletedInvestigation ? undefined : 'Run an investigation first'}
                            >
                                {monitoring ? 'Enabling…' : 'Enable Monitoring'}
                            </button>
                        )}
                    </div>
                </>
            )}

            {/* §4 "CAMPAIGN HISTORY" — persistent identities, cross-scan. */}
            {campaigns.length > 0 && (
                <>
                    <p className="bi-section-title">Persistent Campaigns</p>
                    <div className="bi-campaign-overview-list">
                        {campaigns.map((c) => (
                            <div key={c.id} className={`bi-campaign-overview-row ${riskClass(c.current_risk_level)}`}>
                                <span className="bi-campaign-name">
                                    {c.name}
                                    <span style={{ marginLeft: '8px', fontSize: '0.72rem', color: '#64748b' }}>
                                        {campaignStatusLabel(c.status)} · {c.member_count} member{c.member_count !== 1 ? 's' : ''}
                                    </span>
                                </span>
                                <span className={`bi-risk-badge ${riskClass(c.current_risk_level)}`}>{c.current_risk_level || 'Unknown'}</span>
                                <span className="bi-campaign-score" style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                    First seen {formatDate(c.first_seen_at)} · Last seen {formatDate(c.last_seen_at)}
                                    {c.historical_risk_level && c.historical_risk_level !== c.current_risk_level
                                        ? ` · was ${c.historical_risk_level}` : ''}
                                </span>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

export default BrandOverviewPane;
