import React from 'react';
import type { BrandScanCandidate, LogoSimilarityResult } from '../../../types/index';

interface LogoVisualSimilarityPaneProps {
    candidates: BrandScanCandidate[];
}

function matchClass(match: string): string {
    switch (match) {
        case 'High':   return 'bi-logo-high';
        case 'Medium': return 'bi-logo-medium';
        case 'Low':    return 'bi-logo-low';
        default:       return 'bi-logo-none';
    }
}

function matchLabel(match: string): string {
    switch (match) {
        case 'High':   return '⚠ High Match';
        case 'Medium': return '~ Medium Match';
        case 'Low':    return '≈ Low Match';
        default:       return '— None';
    }
}

const LogoVisualSimilarityPane: React.FC<LogoVisualSimilarityPaneProps> = ({ candidates }) => {
    // Only domain candidates have logo_similarity_json
    const domainCandidates = candidates.filter(
        (c) => c.candidate_type === 'domain' && c.status === 'evaluated'
    );

    const withLogo = domainCandidates.filter(
        (c) => c.logo_similarity_json != null
    );

    const withNoBrandLogo = domainCandidates.length > 0 && domainCandidates.every(
        (c) => c.logo_similarity_json != null &&
               !c.logo_similarity_json.available &&
               c.logo_similarity_json.reason?.includes('no reference logo')
    );

    // Sort by best similarity score descending
    const sorted = [...withLogo].sort((a, b) => {
        const sa = Math.max(a.logo_similarity_json?.faviconSimilarity ?? 0, a.logo_similarity_json?.logoSimilarity ?? 0);
        const sb = Math.max(b.logo_similarity_json?.faviconSimilarity ?? 0, b.logo_similarity_json?.logoSimilarity ?? 0);
        return sb - sa;
    });

    if (domainCandidates.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No domain candidates to compare</p>
                    <p className="bi-empty-sub">Logo comparison requires evaluated domain candidates.</p>
                </div>
            </div>
        );
    }

    if (withNoBrandLogo || withLogo.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No brand logo set</p>
                    <p className="bi-empty-sub">
                        Visual similarity comparison requires a reference logo URL in the brand profile.
                        Edit the brand profile and add a Logo URL, then rerun the investigation.
                    </p>
                </div>
            </div>
        );
    }

    // Tally match levels
    const matchCounts: Record<string, number> = {};
    for (const c of withLogo) {
        const k = c.logo_similarity_json?.visualMatch ?? 'None';
        matchCounts[k] = (matchCounts[k] || 0) + 1;
    }

    return (
        <div className="bi-pane">
            <p className="bi-section-title">Logo & Visual Similarity</p>
            <p className="bi-section-sub">
                Perceptual hash (dHash) comparison between the brand's reference logo and
                logos/favicons extracted from {withLogo.length} candidate domain{withLogo.length !== 1 ? 's' : ''}.
            </p>

            {/* Summary tally */}
            <div className="bi-logo-summary">
                {['High', 'Medium', 'Low', 'None'].map((level) =>
                    matchCounts[level] ? (
                        <div key={level} className={`bi-count-card ${matchClass(level)}`}>
                            <div className="bi-count-num">{matchCounts[level]}</div>
                            <div className="bi-count-label">{level} Match</div>
                        </div>
                    ) : null
                )}
            </div>

            {/* Detail rows */}
            <div className="bi-logo-table">
                <div className="bi-logo-header">
                    <span>Domain</span>
                    <span>Favicon Sim.</span>
                    <span>Logo Sim.</span>
                    <span>Visual Match</span>
                    {/* BRAND_INTELLIGENCE_PASS7.md §15/§16 — the vision
                        enhancement is what this column was waiting for. */}
                    <span>Vision Detection</span>
                </div>

                {sorted.map((c) => {
                    const lr = c.logo_similarity_json as LogoSimilarityResult;
                    const vision = lr.vision;
                    return (
                        <div key={c.id} className={`bi-logo-row ${matchClass(lr.visualMatch)}`}>
                            <span className="bi-logo-domain">{c.value}</span>
                            <span className="bi-logo-score">
                                {lr.faviconSimilarity !== null ? `${lr.faviconSimilarity}%` : '—'}
                            </span>
                            <span className="bi-logo-score">
                                {lr.logoSimilarity !== null ? `${lr.logoSimilarity}%` : '—'}
                            </span>
                            <span className={`bi-logo-match-badge ${matchClass(lr.visualMatch)}`}>
                                {matchLabel(lr.visualMatch)}
                            </span>
                            <span className="bi-logo-ocr" title={vision?.detail || undefined}>
                                {!vision ? (
                                    <span className="bi-logo-ocr-na">Not analyzed</span>
                                ) : !vision.available ? (
                                    // §31 CASE 6 — honest "Unavailable", never a fabricated result.
                                    <span className="bi-logo-ocr-na">Vision: Unavailable{vision.reason ? ` (${vision.reason})` : ''}</span>
                                ) : (
                                    <span>
                                        {vision.brandNamePresent || vision.logoPresent
                                            ? `Possible brand mark (${vision.visualBrandPresence || 'Weak'} · ${vision.confidence || 'Low'} confidence)`
                                            : 'No brand mark detected'}
                                    </span>
                                )}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Note on high-match candidates */}
            {matchCounts['High'] > 0 && (
                <div className="bi-logo-alert">
                    <strong>{matchCounts['High']} domain{matchCounts['High'] !== 1 ? 's' : ''}</strong> showed
                    High visual similarity to your brand logo — these are strong candidates for
                    phishing or lookalike impersonation.
                </div>
            )}

            <p className="bi-logo-note">
                Vision Detection identifies possible brand-mark PRESENCE only — it is never proof of
                authenticity or ownership (§16). It runs only for candidates the deterministic hash above
                already flagged, and only where an AI provider is configured.
            </p>
        </div>
    );
};

export default LogoVisualSimilarityPane;
