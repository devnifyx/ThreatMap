import React, { useState } from 'react';
import type { BrandScanCandidate } from '../../../types/index';
import DomainIntelligenceResult from '../DomainIntelligence/DomainIntelligenceResult';

interface WebsiteImpersonationPaneProps {
    candidates: BrandScanCandidate[];
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

const WebsiteImpersonationPane: React.FC<WebsiteImpersonationPaneProps> = ({ candidates }) => {
    const [selectedCandidate, setSelectedCandidate] = useState<BrandScanCandidate | null>(null);

    const evaluated = candidates.filter(
        (c) => c.status === 'evaluated' && c.domain_intelligence_json?.data
    );

    // Sort by the highest of (websiteComparison OR screenshotComparison) similarity
    const withScores = evaluated.map((c) => {
        const data = c.domain_intelligence_json!.data;
        const ws = data.websiteComparison?.similarityScore ?? null;
        const ss = data.screenshotComparison?.visualSimilarityScore ?? null;
        const top = Math.max(ws ?? 0, ss ?? 0);
        return { c, ws, ss, top };
    }).sort((a, b) => b.top - a.top);

    if (selectedCandidate) {
        const di = selectedCandidate.domain_intelligence_json!;
        return (
            <div className="bi-pane">
                <button
                    type="button"
                    className="bi-btn-secondary"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => setSelectedCandidate(null)}
                >
                    ← Back to website comparison list
                </button>
                <div className="bi-candidate-detail-header">
                    <span className="bi-candidate-detail-domain">{selectedCandidate.value}</span>
                    <span className={`bi-risk-badge ${riskClass(selectedCandidate.risk_level)}`}>
                        {selectedCandidate.risk_level || 'N/A'}
                    </span>
                </div>
                {/* Reuse existing DomainIntelligenceResult — already has Website + Screenshot tabs */}
                <DomainIntelligenceResult
                    data={di.data}
                    risk={selectedCandidate.risk_level ?? di.risk ?? undefined}
                />
            </div>
        );
    }

    if (withScores.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No website data yet</p>
                    <p className="bi-empty-sub">Website comparison data is available once candidates have been evaluated.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="bi-pane">
            <p className="bi-section-title">
                Visual &amp; Structural Similarity — cross-candidate summary
            </p>
            <p className="bi-section-sub">
                Sorted highest-similarity first. Click any row for the full Website Comparison and Screenshot Comparison detail.
            </p>

            <div className="bi-candidate-table" role="list">
                <div className="bi-candidate-header bi-website-header">
                    <span>Domain</span>
                    <span>Website similarity</span>
                    <span>Screenshot similarity</span>
                    <span>Risk</span>
                </div>
                {withScores.map(({ c, ws, ss }) => (
                    <button
                        key={c.id}
                        type="button"
                        className="bi-candidate-row"
                        role="listitem"
                        onClick={() => setSelectedCandidate(c)}
                        aria-label={`View website comparison for ${c.value}`}
                    >
                        <span className="bi-candidate-value">{c.value}</span>
                        <span className="bi-similarity-score">
                            {ws != null ? (
                                <span className={ws >= 70 ? 'bi-score-high' : ws >= 40 ? 'bi-score-med' : 'bi-score-low'}>
                                    {ws}%
                                </span>
                            ) : '—'}
                        </span>
                        <span className="bi-similarity-score">
                            {ss != null ? (
                                <span className={ss >= 70 ? 'bi-score-high' : ss >= 40 ? 'bi-score-med' : 'bi-score-low'}>
                                    {ss}%
                                </span>
                            ) : '—'}
                        </span>
                        <span className={`bi-risk-badge ${riskClass(c.risk_level)}`}>
                            {c.risk_level || '—'}
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
};

export default WebsiteImpersonationPane;
