import React, { useState, useEffect } from 'react';
import type { BrandScanJob, BrandScanCandidate, BrandCampaign, SocialClassificationEntry } from '../../../types/index';
import { getBrandCampaigns } from '../../../services/api';

interface OverviewPaneProps {
    job: BrandScanJob;
    candidates: BrandScanCandidate[];
    onSelectCandidate: (c: BrandScanCandidate) => void;
}

function formatDate(iso: string | null | undefined): string {
    if (!iso) return '—';
    try { return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
    catch { return iso; }
}

function riskClass(level: string | null): string {
    switch ((level || '').toLowerCase()) {
        case 'critical': return 'bi-risk-critical';
        case 'high':     return 'bi-risk-high';
        case 'medium':   return 'bi-risk-medium';
        case 'low':      return 'bi-risk-low';
        default:         return 'bi-risk-none';
    }
}

const OverviewPane: React.FC<OverviewPaneProps> = ({ job, candidates, onSelectCandidate }) => {
    const [campaigns, setCampaigns] = useState<BrandCampaign[]>([]);

    useEffect(() => {
        getBrandCampaigns(job.id).then((res) => setCampaigns(res.campaigns ?? [])).catch(() => {});
    }, [job.id]);

    const evaluated = candidates.filter((c) => c.status === 'evaluated');
    const domainCandidates = candidates.filter((c) => c.candidate_type === 'domain');
    const socialCandidates = candidates.filter((c) => c.candidate_type === 'social_account');

    const byRisk: Record<string, number> = {};
    for (const c of evaluated) {
        const k = (c.risk_level || 'unknown').toLowerCase();
        byRisk[k] = (byRisk[k] || 0) + 1;
    }

    const topRisk = [...evaluated]
        .sort((a, b) => (b.risk_score ?? 0) - (a.risk_score ?? 0))
        .slice(0, 5);

    // Social classification breakdown — flatten all per-platform entries
    const socialCounts: Record<string, number> = {};
    for (const c of socialCandidates) {
        const findings: SocialClassificationEntry[] = c.social_classification_json ?? [];
        for (const f of findings) {
            const k = f.classification;
            socialCounts[k] = (socialCounts[k] || 0) + 1;
        }
    }
    const hasSocialFindings = Object.keys(socialCounts).length > 0;

    return (
        <div className="bi-pane">
            {/* Job meta */}
            <div className="bi-overview-meta">
                <div className="bi-meta-row">
                    <span className="bi-meta-label">Status</span>
                    <span className={`bi-job-status-badge bi-job-${job.status}`}>{job.status}</span>
                </div>
                <div className="bi-meta-row">
                    <span className="bi-meta-label">Started</span>
                    <span>{formatDate(job.started_at)}</span>
                </div>
                <div className="bi-meta-row">
                    <span className="bi-meta-label">Completed</span>
                    <span>{formatDate(job.completed_at)}</span>
                </div>
            </div>

            {/* Domain counts section */}
            {domainCandidates.length > 0 && (
                <>
                    <p className="bi-section-title">Domain Candidates</p>
                    <div className="bi-overview-counts">
                        <div className="bi-count-card">
                            <div className="bi-count-num">{domainCandidates.length}</div>
                            <div className="bi-count-label">Discovered</div>
                        </div>
                        <div className="bi-count-card">
                            <div className="bi-count-num">{domainCandidates.filter((c) => c.status === 'evaluated').length}</div>
                            <div className="bi-count-label">Evaluated</div>
                        </div>
                        {['critical', 'high', 'medium', 'low'].map((level) => (
                            byRisk[level] ? (
                                <div key={level} className={`bi-count-card ${riskClass(level)}`}>
                                    <div className="bi-count-num">{byRisk[level]}</div>
                                    <div className="bi-count-label">{level.charAt(0).toUpperCase() + level.slice(1)}</div>
                                </div>
                            ) : null
                        ))}
                    </div>
                </>
            )}

            {/* Social counts section */}
            {socialCandidates.length > 0 && (
                <>
                    <p className="bi-section-title">Social Media Handles</p>
                    <div className="bi-overview-counts">
                        <div className="bi-count-card">
                            <div className="bi-count-num">{socialCandidates.length}</div>
                            <div className="bi-count-label">Handle Variants</div>
                        </div>
                        {hasSocialFindings && (
                            <>
                                {socialCounts['Likely Impersonation'] ? (
                                    <div className="bi-count-card bi-risk-high">
                                        <div className="bi-count-num">{socialCounts['Likely Impersonation']}</div>
                                        <div className="bi-count-label">Likely Impersonation</div>
                                    </div>
                                ) : null}
                                {socialCounts['Possible Impersonation'] ? (
                                    <div className="bi-count-card bi-risk-medium">
                                        <div className="bi-count-num">{socialCounts['Possible Impersonation']}</div>
                                        <div className="bi-count-label">Possible Impersonation</div>
                                    </div>
                                ) : null}
                                {socialCounts['Official'] ? (
                                    <div className="bi-count-card bi-risk-none">
                                        <div className="bi-count-num">{socialCounts['Official']}</div>
                                        <div className="bi-count-label">Official</div>
                                    </div>
                                ) : null}
                                {socialCounts['Unknown'] ? (
                                    <div className="bi-count-card">
                                        <div className="bi-count-num">{socialCounts['Unknown']}</div>
                                        <div className="bi-count-label">Unknown</div>
                                    </div>
                                ) : null}
                            </>
                        )}
                        {!hasSocialFindings && socialCandidates.some((c) => c.status === 'evaluated') && (
                            <div className="bi-count-card">
                                <div className="bi-count-num">0</div>
                                <div className="bi-count-label">Platform Findings</div>
                            </div>
                        )}
                    </div>
                </>
            )}

            {/* Top-risk candidates (domain focus) */}
            {topRisk.length > 0 && topRisk.some((c) => c.candidate_type === 'domain') && (
                <div className="bi-top-risk">
                    <p className="bi-section-title">Highest Risk Domains</p>
                    <div className="bi-candidate-table">
                        <div className="bi-candidate-header">
                            <span>Domain</span>
                            <span>Method</span>
                            <span>Risk</span>
                        </div>
                        {topRisk.filter((c) => c.candidate_type === 'domain').map((c) => (
                            <button
                                key={c.id}
                                type="button"
                                className="bi-candidate-row"
                                onClick={() => onSelectCandidate(c)}
                            >
                                <span className="bi-candidate-value">{c.value}</span>
                                <span className="bi-discovery-badge">{c.discovery_method.replace(/_/g, ' ')}</span>
                                <span className={`bi-risk-badge ${riskClass(c.risk_level)}`}>
                                    {c.risk_level || 'N/A'}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Campaign summary (Pass 4) */}
            {campaigns.length > 0 && (
                <>
                    <p className="bi-section-title">Correlated Campaigns</p>
                    <div className="bi-overview-counts">
                        <div className="bi-count-card bi-risk-high">
                            <div className="bi-count-num">{campaigns.length}</div>
                            <div className="bi-count-label">Campaign{campaigns.length !== 1 ? 's' : ''} Detected</div>
                        </div>
                    </div>
                    <div className="bi-campaign-overview-list">
                        {campaigns.slice(0, 3).map((c) => (
                            <div key={c.id} className={`bi-campaign-overview-row ${riskClass(c.campaign_risk)}`}>
                                <span className="bi-campaign-name">{c.name}</span>
                                <span className={`bi-risk-badge ${riskClass(c.campaign_risk)}`}>{c.campaign_risk}</span>
                                <span className="bi-campaign-score">Score {c.campaign_risk_score}</span>
                            </div>
                        ))}
                        {campaigns.length > 3 && (
                            <p style={{ fontSize: '0.75rem', color: '#64748b', margin: '0.25rem 0 0' }}>
                                +{campaigns.length - 3} more — see Phishing Campaigns pillar
                            </p>
                        )}
                    </div>
                </>
            )}

            {candidates.length === 0 && (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No suspicious candidates found</p>
                    <p className="bi-empty-sub">The discovery phase found no registered domains matching common impersonation patterns for this brand.</p>
                </div>
            )}
        </div>
    );
};

export default OverviewPane;
