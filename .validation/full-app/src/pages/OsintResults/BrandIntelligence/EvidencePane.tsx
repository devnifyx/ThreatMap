import React, { useState, useEffect, useCallback } from 'react';
import type { BrandScanJob, BrandEvidence } from '../../../types/index';
import { getBrandJobEvidence } from '../../../services/api';

interface EvidencePaneProps {
    job: BrandScanJob;
}

const SOURCE_LABELS: Record<string, string> = {
    brand_similarity:       'Brand Similarity',
    screenshot_comparison:  'Screenshot Comparison',
    website_comparison:     'Website Comparison',
    logo_similarity:        'Logo Similarity',
    reputation:             'Reputation',
    whois:                  'WHOIS',
    campaign_correlation:   'Campaign Correlation',
    social_impersonation:   'Social Impersonation',
    unknown:                'Unknown'
};

const SOURCE_OPTIONS = ['all', ...Object.keys(SOURCE_LABELS)];

function sourceLabel(source: string): string {
    return SOURCE_LABELS[source] ?? source;
}

function confidenceClass(confidence: number): string {
    if (confidence >= 80) return 'bi-risk-high';
    if (confidence >= 50) return 'bi-risk-medium';
    return 'bi-risk-low';
}

const EvidencePane: React.FC<EvidencePaneProps> = ({ job }) => {
    const [evidence, setEvidence] = useState<BrandEvidence[]>([]);
    const [loading, setLoading]   = useState(true);
    const [error, setError]       = useState<string | null>(null);
    const [expanded, setExpanded] = useState<number | null>(null);

    // Filters
    const [filterSource,     setFilterSource]     = useState('all');
    const [filterMinConf,    setFilterMinConf]     = useState(0);
    const [filterCandidateId, setFilterCandidateId] = useState('');

    const loadEvidence = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getBrandJobEvidence(job.id);
            setEvidence(res.evidence ?? []);
        } catch (err: any) {
            setError(err.message || 'Failed to load evidence');
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => { loadEvidence(); }, [loadEvidence]);

    if (loading) return <div className="bi-pane"><p className="bi-loading">Loading evidence…</p></div>;
    if (error)   return <div className="bi-pane"><div className="bi-error" role="alert">{error}</div></div>;

    // Apply filters
    const filtered = evidence.filter((e) => {
        if (filterSource !== 'all' && e.source !== filterSource) return false;
        if (e.confidence < filterMinConf) return false;
        if (filterCandidateId && e.candidate_id != null && String(e.candidate_id) !== filterCandidateId) return false;
        return true;
    });

    // Source breakdown counts for the summary cards
    const sourceCountMap: Record<string, number> = {};
    for (const e of evidence) {
        sourceCountMap[e.source] = (sourceCountMap[e.source] || 0) + 1;
    }
    const topSources = Object.entries(sourceCountMap)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);

    return (
        <div className="bi-pane">
            <p className="bi-section-title">Investigation Evidence</p>
            <p className="bi-section-sub">
                Every row traces back to a deterministic detector's already-computed output —
                brand similarity, visual comparison, reputation, WHOIS, or campaign correlation.
                No finding here was invented by the AI analysis.
            </p>

            {/* Source breakdown summary */}
            {topSources.length > 0 && (
                <div className="bi-overview-counts" style={{ marginBottom: '1rem' }}>
                    <div className="bi-count-card">
                        <div className="bi-count-num">{evidence.length}</div>
                        <div className="bi-count-label">Total Findings</div>
                    </div>
                    {topSources.map(([src, count]) => (
                        <div key={src} className="bi-count-card">
                            <div className="bi-count-num">{count}</div>
                            <div className="bi-count-label">{sourceLabel(src)}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* Filters */}
            <div className="bi-filter-bar" style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Source</span>
                    <select className="bi-select bi-filter-select" value={filterSource}
                        onChange={(e) => setFilterSource(e.target.value)}>
                        {SOURCE_OPTIONS.map((s) => (
                            <option key={s} value={s}>{s === 'all' ? 'All sources' : sourceLabel(s)}</option>
                        ))}
                    </select>
                </label>
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Min confidence</span>
                    <select className="bi-select bi-filter-select" value={filterMinConf}
                        onChange={(e) => setFilterMinConf(Number(e.target.value))}>
                        <option value={0}>Any</option>
                        <option value={50}>≥50%</option>
                        <option value={75}>≥75%</option>
                        <option value={90}>≥90%</option>
                    </select>
                </label>
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Candidate ID</span>
                    <input
                        type="number"
                        className="bi-select bi-filter-select"
                        style={{ width: '80px' }}
                        placeholder="any"
                        value={filterCandidateId}
                        onChange={(e) => setFilterCandidateId(e.target.value)}
                    />
                </label>
            </div>

            {filtered.length === 0 && (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No evidence rows</p>
                    <p className="bi-empty-sub">
                        {evidence.length === 0
                            ? 'No evidence was recorded for this job — either it has not yet completed the scoring stage, or no candidates were evaluated.'
                            : 'No evidence rows match the current filters.'}
                    </p>
                </div>
            )}

            {filtered.length > 0 && (
                <div className="bi-evidence-table" role="list">
                    {/* Header */}
                    <div className="bi-evidence-header">
                        <span>Finding</span>
                        <span>Source</span>
                        <span>Candidate</span>
                        <span>Confidence</span>
                        <span>Risk pts</span>
                    </div>

                    {filtered.map((ev) => {
                        const isOpen = expanded === ev.id;
                        return (
                            <React.Fragment key={ev.id}>
                                <button
                                    type="button"
                                    className="bi-evidence-row"
                                    onClick={() => setExpanded(isOpen ? null : ev.id)}
                                    aria-expanded={isOpen}
                                    role="listitem"
                                >
                                    <span className="bi-evidence-finding">{ev.finding}</span>
                                    <span className="bi-discovery-badge">{sourceLabel(ev.source)}</span>
                                    <span className="bi-evidence-domain">
                                        {ev.candidate_value ?? (ev.candidate_id != null ? `#${ev.candidate_id}` : ev.campaign_id != null ? `Campaign #${ev.campaign_id}` : '—')}
                                    </span>
                                    <span className={`bi-risk-badge ${confidenceClass(ev.confidence)}`}>
                                        {ev.confidence}%
                                    </span>
                                    <span className="bi-risk-score-col">
                                        {ev.risk_contribution != null ? `+${ev.risk_contribution}` : '—'}
                                    </span>
                                </button>

                                {isOpen && (
                                    <div className="bi-evidence-detail">
                                        <p className="bi-social-signals-title">Detection Reason</p>
                                        <p className="bi-evidence-reason">{ev.detection_reason}</p>

                                        {ev.url && (
                                            <p className="bi-evidence-url">
                                                <span className="bi-filter-label">URL: </span>
                                                <a
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="bi-evidence-link"
                                                >
                                                    {ev.url.length > 80 ? `${ev.url.slice(0, 80)}…` : ev.url}
                                                </a>
                                            </p>
                                        )}

                                        {ev.created_at && (
                                            <p style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.35rem' }}>
                                                Recorded: {new Date(ev.created_at).toLocaleString()}
                                            </p>
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

export default EvidencePane;
