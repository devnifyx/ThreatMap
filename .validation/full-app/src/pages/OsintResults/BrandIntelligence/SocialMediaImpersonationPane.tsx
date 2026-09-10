import React, { useState, useMemo } from 'react';
import type { BrandScanCandidate, SocialClassificationEntry } from '../../../types/index';

interface SocialMediaImpersonationPaneProps {
    candidates: BrandScanCandidate[];
}

type ClassificationFilter = 'all' | 'Official' | 'Likely Official' | 'Possible Impersonation' | 'Likely Impersonation' | 'Unknown';

function classificationClass(c: string): string {
    switch (c) {
        case 'Official':               return 'bi-social-official';
        case 'Likely Official':        return 'bi-social-likely-official';
        case 'Possible Impersonation': return 'bi-social-possible';
        case 'Likely Impersonation':   return 'bi-social-likely-impersonation';
        default:                       return 'bi-social-unknown';
    }
}

function classificationBadge(c: string): string {
    switch (c) {
        case 'Official':               return '✓ Official';
        case 'Likely Official':        return '~ Likely Official';
        case 'Possible Impersonation': return '⚠ Possible';
        case 'Likely Impersonation':   return '⚠ Likely Impersonation';
        default:                       return '? Unknown';
    }
}

const SocialMediaImpersonationPane: React.FC<SocialMediaImpersonationPaneProps> = ({ candidates }) => {
    const [filter, setFilter] = useState<ClassificationFilter>('all');
    const [expandedRow, setExpandedRow] = useState<string | null>(null);

    // Flatten: one row per (handle × platform) finding
    const allFindings = useMemo(() => {
        const rows: Array<{ candidateId: number; handle: string; entry: SocialClassificationEntry }> = [];
        for (const c of candidates) {
            if (c.candidate_type !== 'social_account') continue;
            const findings = c.social_classification_json;
            if (!findings || !findings.length) {
                // Candidate evaluated but no 'taken' platforms found — single placeholder row
                rows.push({
                    candidateId: c.id,
                    handle: c.value,
                    entry: {
                        platform: '—',
                        handle: c.value,
                        status: c.status === 'failed' ? 'failed' : 'not_found',
                        url: '',
                        profile: null,
                        avatarComparison: { faviconSimilarity: null, logoSimilarity: null },
                        classification: 'Unknown',
                        confidence: 0,
                        reasons: c.status === 'failed'
                            ? ['Evaluation failed — handle may be unavailable or rate-limited.']
                            : ['Handle was not found as "taken" on any monitored platform.']
                    }
                });
                continue;
            }
            for (const entry of findings) {
                rows.push({ candidateId: c.id, handle: c.value, entry });
            }
        }
        return rows;
    }, [candidates]);

    const filtered = useMemo(() => {
        if (filter === 'all') return allFindings;
        return allFindings.filter((r) => r.entry.classification === filter);
    }, [allFindings, filter]);

    // Count per classification for the filter bar
    const counts = useMemo(() => {
        const m: Record<string, number> = {};
        for (const r of allFindings) {
            const k = r.entry.classification;
            m[k] = (m[k] || 0) + 1;
        }
        return m;
    }, [allFindings]);

    const socialCandidates = candidates.filter((c) => c.candidate_type === 'social_account');

    if (socialCandidates.length === 0) {
        return (
            <div className="bi-pane">
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No social handle candidates discovered</p>
                    <p className="bi-empty-sub">
                        Social media impersonation scanning requires the brand name to generate handle variants.
                        Ensure the brand profile has a name set and rerun the investigation.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bi-pane">
            <p className="bi-section-title">Social Media Impersonation</p>
            <p className="bi-section-sub">
                {socialCandidates.length} handle variant{socialCandidates.length !== 1 ? 's' : ''} checked across social platforms.
                {allFindings.length > 0 && ` ${allFindings.length} platform finding${allFindings.length !== 1 ? 's' : ''} total.`}
            </p>

            {/* Filter bar */}
            <div className="bi-filter-bar">
                {([
                    ['all', `All (${allFindings.length})`],
                    ['Likely Impersonation', `Likely Impersonation (${counts['Likely Impersonation'] ?? 0})`],
                    ['Possible Impersonation', `Possible (${counts['Possible Impersonation'] ?? 0})`],
                    ['Likely Official', `Likely Official (${counts['Likely Official'] ?? 0})`],
                    ['Official', `Official (${counts['Official'] ?? 0})`],
                    ['Unknown', `Unknown (${counts['Unknown'] ?? 0})`],
                ] as [ClassificationFilter, string][]).map(([val, label]) => (
                    <button
                        key={val}
                        type="button"
                        className={`bi-filter-btn${filter === val ? ' active' : ''}`}
                        onClick={() => setFilter(val)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {filtered.length === 0 ? (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No findings match this filter</p>
                </div>
            ) : (
                <div className="bi-social-table">
                    {/* Header */}
                    <div className="bi-social-header">
                        <span>Handle</span>
                        <span>Platform</span>
                        <span>Classification</span>
                        <span>Confidence</span>
                        <span>Avatar</span>
                        <span>Link</span>
                    </div>

                    {filtered.map((row, idx) => {
                        const key = `${row.candidateId}-${row.entry.platform}-${idx}`;
                        const isExpanded = expandedRow === key;
                        const avatarUrl = row.entry.profile?.avatarUrl;
                        const simScore = Math.max(
                            row.entry.avatarComparison?.faviconSimilarity ?? 0,
                            row.entry.avatarComparison?.logoSimilarity ?? 0
                        );
                        return (
                            <React.Fragment key={key}>
                                <button
                                    type="button"
                                    className={`bi-social-row${isExpanded ? ' expanded' : ''}`}
                                    onClick={() => setExpandedRow(isExpanded ? null : key)}
                                    aria-expanded={isExpanded}
                                >
                                    <span className="bi-social-handle">@{row.entry.handle}</span>
                                    <span className="bi-social-platform">{row.entry.platform}</span>
                                    <span className={`bi-social-badge ${classificationClass(row.entry.classification)}`}>
                                        {classificationBadge(row.entry.classification)}
                                    </span>
                                    <span className="bi-social-confidence">
                                        {row.entry.confidence > 0 ? `${row.entry.confidence}%` : '—'}
                                    </span>
                                    <span className="bi-social-avatar">
                                        {avatarUrl ? (
                                            <img
                                                src={avatarUrl}
                                                alt={`Avatar for @${row.entry.handle}`}
                                                className="bi-avatar-thumb"
                                                loading="lazy"
                                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                            />
                                        ) : (
                                            simScore > 0
                                                ? <span className="bi-avatar-sim">{simScore}%</span>
                                                : <span className="bi-avatar-none">—</span>
                                        )}
                                    </span>
                                    <span className="bi-social-link">
                                        {row.entry.url ? (
                                            <a
                                                href={row.entry.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bi-ext-link"
                                                onClick={(e) => e.stopPropagation()}
                                            >
                                                ↗
                                            </a>
                                        ) : '—'}
                                    </span>
                                </button>

                                {/* Expanded detail panel */}
                                {isExpanded && (
                                    <div className="bi-social-detail">
                                        {row.entry.profile && (
                                            <div className="bi-social-profile-block">
                                                {avatarUrl && (
                                                    <img
                                                        src={avatarUrl}
                                                        alt={`Avatar for @${row.entry.handle}`}
                                                        className="bi-avatar-large"
                                                        loading="lazy"
                                                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                                    />
                                                )}
                                                <div className="bi-social-profile-text">
                                                    {row.entry.profile.displayName && (
                                                        <div className="bi-social-display-name">{row.entry.profile.displayName}</div>
                                                    )}
                                                    {row.entry.profile.bio && (
                                                        <div className="bi-social-bio">{row.entry.profile.bio}</div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        <div className="bi-social-signals">
                                            <p className="bi-social-signals-title">Evidence</p>
                                            {row.entry.reasons.length > 0 ? (
                                                <ul className="bi-social-reasons">
                                                    {row.entry.reasons.map((r, i) => (
                                                        <li key={i}>{r}</li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="bi-meta-value">No reasons recorded.</p>
                                            )}
                                        </div>

                                        {(row.entry.avatarComparison.faviconSimilarity !== null ||
                                          row.entry.avatarComparison.logoSimilarity !== null) && (
                                            <div className="bi-social-avatar-sim">
                                                <p className="bi-social-signals-title">Avatar vs Brand Logo</p>
                                                <p className="bi-meta-value">
                                                    Similarity: {simScore}%
                                                    {simScore >= 90 ? ' — High visual match' :
                                                     simScore >= 70 ? ' — Medium visual match' :
                                                     simScore >= 40 ? ' — Low visual match' :
                                                     ' — No significant visual match'}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </React.Fragment>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default SocialMediaImpersonationPane;
