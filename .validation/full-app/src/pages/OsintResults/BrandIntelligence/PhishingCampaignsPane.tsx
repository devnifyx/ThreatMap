import React, { useState, useEffect, useCallback } from 'react';
import type { BrandScanJob, BrandCampaign, BrandCampaignMember } from '../../../types/index';
import { getBrandCampaigns, getBrandCampaignMembers } from '../../../services/api';
import DomainIntelligenceResult from '../DomainIntelligence/DomainIntelligenceResult';

interface PhishingCampaignsPaneProps {
    job: BrandScanJob;
    candidates?: unknown[];
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

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return iso; }
}

// Collapse each signal reason to a readable sentence
function signalSentence(reason: string): string {
    return reason.replace(/\s+—\s+\+\d+ pts$/, '');
}

// ---- Campaign member list (loads on expand) ----
const CampaignMembers: React.FC<{
    campaignId: number;
    onSelectMember: (member: BrandCampaignMember) => void;
}> = ({ campaignId, onSelectMember }) => {
    const [members, setMembers] = useState<BrandCampaignMember[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await getBrandCampaignMembers(campaignId);
                if (!cancelled) setMembers(res.members ?? []);
            } catch (err: any) {
                if (!cancelled) setError(err.message || 'Failed to load members');
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => { cancelled = true; };
    }, [campaignId]);

    if (loading) return <p className="bi-loading" style={{ fontSize: '0.8rem', margin: '0.5rem 0' }}>Loading members…</p>;
    if (error) return <p className="bi-error" style={{ fontSize: '0.8rem' }}>{error}</p>;

    return (
        <div className="bi-campaign-members">
            {members.map((m) => (
                <button
                    key={m.candidate_id}
                    type="button"
                    className="bi-campaign-member-row"
                    onClick={() => onSelectMember(m)}
                >
                    <span className="bi-candidate-value">{m.value}</span>
                    <span className={`bi-risk-badge ${riskClass(m.risk_level)}`}>
                        {m.risk_level || 'N/A'}
                    </span>
                    <span className="bi-member-score">
                        {m.risk_score != null ? `Score: ${m.risk_score}` : '—'}
                    </span>
                    {m.risk_reasons_json && m.risk_reasons_json.length > 0 && (
                        <span className="bi-member-reason-count">
                            {m.risk_reasons_json.length} reason{m.risk_reasons_json.length !== 1 ? 's' : ''}
                        </span>
                    )}
                </button>
            ))}
        </div>
    );
};

// ---- Main pane ----
const PhishingCampaignsPane: React.FC<PhishingCampaignsPaneProps> = ({ job }) => {
    const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCampaign, setExpandedCampaign] = useState<number | null>(null);
    // When user clicks a member, open its Domain Intelligence detail panel
    const [selectedMember, setSelectedMember] = useState<BrandCampaignMember | null>(null);

    const loadCampaigns = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getBrandCampaigns(job.id);
            setCampaigns(res.campaigns ?? []);
        } catch (err: any) {
            setError(err.message || 'Failed to load campaigns');
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

    // If a member is selected, show its Domain Intelligence detail instead of the campaign list
    if (selectedMember) {
        const di = selectedMember.domain_intelligence_json;
        return (
            <div className="bi-pane">
                <button type="button" className="bi-btn-secondary" style={{ marginBottom: '1rem' }}
                    onClick={() => setSelectedMember(null)}>
                    ← Back to Campaigns
                </button>
                {di?.data ? (
                    <DomainIntelligenceResult
                        data={di.data}
                        risk={selectedMember.risk_level ?? di.risk ?? undefined}
                    />
                ) : (
                    <div className="bi-empty">
                        <p className="bi-empty-title">No domain intelligence data available</p>
                        <p className="bi-empty-sub">This candidate was not evaluated or its data could not be loaded.</p>
                    </div>
                )}
            </div>
        );
    }

    if (loading) return <div className="bi-pane"><p className="bi-loading">Loading campaigns…</p></div>;
    if (error) return <div className="bi-pane"><div className="bi-error" role="alert">{error}</div></div>;

    if (campaigns.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No correlated campaigns detected</p>
                    <p className="bi-empty-sub">
                        Campaign correlation requires ≥2 domain candidates sharing at least 2 independent
                        signals (same IP, SSL issuer, page template, or discovery timeframe proximity).
                        Either this investigation found too few candidates or none shared enough infrastructure.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bi-pane">
            <p className="bi-section-title">Phishing Campaigns</p>
            <p className="bi-section-sub">
                {campaigns.length} coordinated campaign{campaigns.length !== 1 ? 's' : ''} detected —
                domain candidates grouped by shared infrastructure (IP, SSL issuer, page template, registration timeframe).
            </p>

            <div className="bi-campaigns-list">
                {campaigns.map((campaign) => {
                    const isExpanded = expandedCampaign === campaign.id;
                    return (
                        <div key={campaign.id} className={`bi-campaign-card ${riskClass(campaign.campaign_risk)}`}>
                            <button
                                type="button"
                                className="bi-campaign-header"
                                onClick={() => setExpandedCampaign(isExpanded ? null : campaign.id)}
                                aria-expanded={isExpanded}
                            >
                                <div className="bi-campaign-name-row">
                                    <span className="bi-campaign-name">{campaign.name}</span>
                                    <span className={`bi-risk-badge ${riskClass(campaign.campaign_risk)}`}>
                                        {campaign.campaign_risk}
                                    </span>
                                    <span className="bi-campaign-score">Score {campaign.campaign_risk_score}</span>
                                </div>
                                <div className="bi-campaign-meta">
                                    <span>First seen: {formatDate(campaign.first_seen_at)}</span>
                                    <span className={`bi-campaign-status-badge bi-status-${campaign.status}`}>
                                        {campaign.status.replace('_', ' ')}
                                    </span>
                                    <span>{isExpanded ? '▲' : '▼'}</span>
                                </div>
                            </button>

                            {isExpanded && (
                                <div className="bi-campaign-body">
                                    {/* Correlation signals explained */}
                                    <div className="bi-campaign-signals">
                                        <p className="bi-social-signals-title">Corroborating Signals</p>
                                        <ul className="bi-campaign-reasons">
                                            {campaign.correlation_reasons_json.map((r, i) => (
                                                <li key={i}>{signalSentence(r)}</li>
                                            ))}
                                        </ul>
                                    </div>

                                    {/* Member domain list */}
                                    <p className="bi-social-signals-title" style={{ marginTop: '0.75rem' }}>
                                        Member Domains <span className="bi-campaign-member-note">(click to view Domain Intelligence)</span>
                                    </p>
                                    <CampaignMembers
                                        campaignId={campaign.id}
                                        onSelectMember={setSelectedMember}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

export default PhishingCampaignsPane;
