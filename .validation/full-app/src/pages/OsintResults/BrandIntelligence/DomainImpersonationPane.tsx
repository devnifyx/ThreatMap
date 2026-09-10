import React, { useState } from 'react';
import type {
    BrandScanCandidate,
    DeepScanResult,
    DeepScanRedirectHop,
    DeepScanForm
} from '../../../types/index';
import { runBrandDeepScan } from '../../../services/api';
import DomainIntelligenceResult from '../DomainIntelligence/DomainIntelligenceResult';

interface DomainImpersonationPaneProps {
    candidates: BrandScanCandidate[];
    /** Pre-selected candidate (when navigating from Overview's top-risk list) */
    initialSelected?: BrandScanCandidate | null;
    /** Campaign name by candidateId, for the "Part of: <name>" badge (Pass 4) */
    campaignByCandidateId?: Map<number, string>;
    job: { id: number };
}

type SortKey = 'risk' | 'similarity' | 'domain' | 'method';

function riskClass(level: string | null): string {
    switch ((level || '').toLowerCase()) {
        case 'critical': return 'bi-risk-critical';
        case 'high':     return 'bi-risk-high';
        case 'medium':   return 'bi-risk-medium';
        case 'low':      return 'bi-risk-low';
        default:         return 'bi-risk-none';
    }
}

/** Check if the current user is an admin (reads the cached user from localStorage) */
function currentUserIsAdmin(): boolean {
    try {
        const saved = localStorage.getItem('user');
        if (!saved) return false;
        const user = JSON.parse(saved);
        return user?.role === 'admin';
    } catch {
        return false;
    }
}

// ---- Deep Scan results sub-components ------------------------------------

function RedirectChain({ hops }: { hops: DeepScanRedirectHop[] }) {
    if (!hops.length) return <p className="bi-ds-none">No redirects detected — page loaded at target URL.</p>;
    return (
        <ol className="bi-ds-redirect-chain">
            {hops.map((hop, i) => (
                <li key={i} className="bi-ds-redirect-hop">
                    <span className={`bi-ds-status bi-ds-status-${hop.status >= 400 ? 'error' : 'redirect'}`}>
                        HTTP {hop.status}
                    </span>
                    <span className="bi-ds-hop-url">{hop.url}</span>
                </li>
            ))}
        </ol>
    );
}

const FIELD_CLASS_LABELS: Record<string, string> = {
    password: '🔑 Password',
    otp:      '🔢 OTP / verification code',
    phone:    '📱 Phone number',
    email:    '📧 Email address',
    other:    'Other'
};

const FIELD_CLASS_DANGER: Record<string, boolean> = {
    password: true,
    otp:      true,
    phone:    false,
    email:    false,
    other:    false
};

function FormDetails({ forms }: { forms: DeepScanForm[] }) {
    if (!forms.length) return <p className="bi-ds-none">No forms detected on the page.</p>;
    return (
        <div className="bi-ds-forms">
            {forms.map((form, i) => (
                <div key={i} className="bi-ds-form">
                    <p className="bi-ds-form-title">
                        Form {i + 1}
                        {form.action ? <span className="bi-ds-form-action"> → {form.action.slice(0, 80)}</span> : ''}
                        <span className="bi-ds-form-method">{form.method}</span>
                    </p>
                    <ul className="bi-ds-field-list">
                        {form.fields.map((field, j) => (
                            <li
                                key={j}
                                className={`bi-ds-field${FIELD_CLASS_DANGER[field.fieldClass] ? ' bi-ds-field-danger' : ''}`}
                            >
                                <span className="bi-ds-field-class">{FIELD_CLASS_LABELS[field.fieldClass] || field.fieldClass}</span>
                                {field.name && <span className="bi-ds-field-name">name="{field.name}"</span>}
                                {field.type && <span className="bi-ds-field-type">type="{field.type}"</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    );
}

function InteractionOutcome({ interaction }: { interaction: import('../../../types/index').DeepScanMeta }) {
    if (!interaction || !interaction.interaction) {
        return <p className="bi-ds-none">No interaction data recorded.</p>;
    }
    const ix = interaction.interaction;
    if (!ix.ran) {
        return <p className="bi-ds-none">No matching clickable element was found (verify / continue / sign in / etc.).</p>;
    }
    return (
        <div className="bi-ds-interaction">
            <p>
                Clicked: <strong>"{ix.clickedText}"</strong>
            </p>
            <p>
                URL before: <span className="bi-ds-url">{ix.urlBefore}</span>
            </p>
            <p>
                URL after: <span className={`bi-ds-url${ix.hostnameChanged ? ' bi-ds-url-danger' : ''}`}>{ix.urlAfter}</span>
                {ix.hostnameChanged && (
                    <span className="bi-ds-badge-danger" title="The hostname changed after clicking — suspicious redirect">
                        ⚠ Hostname changed
                    </span>
                )}
            </p>
            {ix.error && <p className="bi-ds-error">Click error: {ix.error}</p>}
        </div>
    );
}

function DeepScanResults({
    deepScan,
    riskScore,
    riskLevel,
    reasons
}: {
    deepScan: DeepScanResult;
    riskScore: number;
    riskLevel: string;
    reasons: string[];
}) {
    const meta                    = deepScan.meta;
    const screenshotPath          = deepScan.screenshotPath;
    const afterClickScreenshotPath = deepScan.afterClickScreenshotPath;

    return (
        <div className="bi-ds-results">
            {/* Updated risk badge */}
            <div className="bi-ds-risk-row">
                <span className="bi-ds-section-label">Updated risk after Deep Scan</span>
                <span className={`bi-risk-badge ${riskClass(riskLevel)}`}>{riskLevel}</span>
                <span className="bi-risk-score-pill">Score {riskScore}</span>
            </div>

            {reasons.length > 0 && (
                <div className="bi-ds-reasons">
                    <p className="bi-social-signals-title">Risk factors (post-scan)</p>
                    <ul className="bi-risk-reasons-list">
                        {reasons.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                </div>
            )}

            {/* Screenshots side-by-side */}
            {(screenshotPath || afterClickScreenshotPath) && (
                <div className="bi-ds-screenshots">
                    {screenshotPath && (
                        <div className="bi-ds-screenshot-col">
                            <p className="bi-ds-screenshot-label">Before click</p>
                            <img
                                src={`/api/brand-intel/screenshots/${encodeURIComponent(screenshotPath.split(/[\\/]/).pop() || '')}`}
                                alt="Before-click screenshot"
                                className="bi-ds-screenshot"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}
                    {afterClickScreenshotPath && (
                        <div className="bi-ds-screenshot-col">
                            <p className="bi-ds-screenshot-label">After click</p>
                            <img
                                src={`/api/brand-intel/screenshots/${encodeURIComponent(afterClickScreenshotPath.split(/[\\/]/).pop() || '')}`}
                                alt="After-click screenshot"
                                className="bi-ds-screenshot"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                        </div>
                    )}
                </div>
            )}

            {/* Redirect chain */}
            <div className="bi-ds-section">
                <p className="bi-social-signals-title">
                    Redirect chain
                    {meta?.redirectChain?.length ? ` (${meta.redirectChain.length} hop${meta.redirectChain.length > 1 ? 's' : ''})` : ''}
                </p>
                {meta ? <RedirectChain hops={meta.redirectChain ?? []} /> : <p className="bi-ds-none">No meta data.</p>}
                {meta?.finalUrl && (
                    <p className="bi-ds-final-url">
                        Final destination: <span className="bi-ds-url">{meta.finalUrl}</span>
                        {meta.httpStatus != null && (
                            <span className="bi-discovery-badge" style={{ marginLeft: '0.4rem' }}>HTTP {meta.httpStatus}</span>
                        )}
                    </p>
                )}
            </div>

            {/* Forms */}
            <div className="bi-ds-section">
                <p className="bi-social-signals-title">
                    Forms detected
                    {meta?.forms?.length ? ` (${meta.forms.length})` : ''}
                </p>
                {meta ? <FormDetails forms={meta.forms ?? []} /> : <p className="bi-ds-none">No meta data.</p>}
            </div>

            {/* Interaction outcome */}
            <div className="bi-ds-section">
                <p className="bi-social-signals-title">Click interaction outcome</p>
                {meta ? <InteractionOutcome interaction={meta} /> : <p className="bi-ds-none">No meta data.</p>}
            </div>
        </div>
    );
}

// ---- Main pane -----------------------------------------------------------

const DomainImpersonationPane: React.FC<DomainImpersonationPaneProps> = ({
    candidates,
    initialSelected,
    campaignByCandidateId,
    job
}) => {
    const [sortKey, setSortKey] = useState<SortKey>('risk');
    const [filterRisk, setFilterRisk] = useState<string>('all');
    const [filterMethod, setFilterMethod] = useState<string>('all');
    const [selectedCandidate, setSelectedCandidate] = useState<BrandScanCandidate | null>(initialSelected ?? null);
    const [showReasons, setShowReasons] = useState<number | null>(null);

    // Deep Scan state
    const [deepScanLoading, setDeepScanLoading] = useState(false);
    const [deepScanError,   setDeepScanError]   = useState<string | null>(null);
    const [deepScanResult,  setDeepScanResult]  = useState<{
        deepScan:  DeepScanResult;
        riskScore: number;
        riskLevel: string;
        reasons:   string[];
    } | null>(null);

    // Reset deep scan state whenever the selected candidate changes
    const selectCandidate = (c: BrandScanCandidate | null) => {
        setSelectedCandidate(c);
        setDeepScanLoading(false);
        setDeepScanError(null);
        setDeepScanResult(null);
    };

    const isAdmin = currentUserIsAdmin();

    const handleRunDeepScan = async () => {
        if (!selectedCandidate || deepScanLoading) return;
        setDeepScanLoading(true);
        setDeepScanError(null);
        setDeepScanResult(null);
        try {
            const result = await runBrandDeepScan(job.id, selectedCandidate.id);
            setDeepScanResult({
                deepScan:  result.deepScan,
                riskScore: result.riskScore,
                riskLevel: result.riskLevel,
                reasons:   result.reasons
            });
        } catch (err: any) {
            setDeepScanError(err.message || 'Deep Scan failed');
        } finally {
            setDeepScanLoading(false);
        }
    };

    const evaluated = candidates.filter((c) => c.candidate_type === 'domain' && c.status === 'evaluated');

    const filtered = evaluated.filter((c) => {
        if (filterRisk !== 'all' && (c.risk_level || 'unknown').toLowerCase() !== filterRisk) return false;
        if (filterMethod !== 'all' && c.discovery_method !== filterMethod) return false;
        return true;
    });

    const sorted = [...filtered].sort((a, b) => {
        if (sortKey === 'risk') return (b.risk_score ?? 0) - (a.risk_score ?? 0);
        if (sortKey === 'similarity') {
            const sa = a.domain_intelligence_json?.data?.brandSimilarity?.similarityScore ?? 0;
            const sb = b.domain_intelligence_json?.data?.brandSimilarity?.similarityScore ?? 0;
            return sb - sa;
        }
        if (sortKey === 'domain') return a.value.localeCompare(b.value);
        if (sortKey === 'method') return a.discovery_method.localeCompare(b.discovery_method);
        return 0;
    });

    if (selectedCandidate) {
        const di      = selectedCandidate.domain_intelligence_json;
        const reasons = selectedCandidate.risk_reasons_json;
        // Display the rescored level/score after a deep scan, falling back to the stored values
        const displayLevel = deepScanResult?.riskLevel ?? selectedCandidate.risk_level;
        const displayScore = deepScanResult?.riskScore ?? selectedCandidate.risk_score;

        return (
            <div className="bi-pane">
                <button
                    type="button"
                    className="bi-btn-secondary"
                    style={{ marginBottom: '1rem' }}
                    onClick={() => selectCandidate(null)}
                >
                    ← Back to candidate list
                </button>
                <div className="bi-candidate-detail-header">
                    <span className="bi-candidate-detail-domain">{selectedCandidate.value}</span>
                    <span className={`bi-risk-badge ${riskClass(displayLevel)}`}>
                        {displayLevel || 'N/A'}
                    </span>
                    {displayScore != null && (
                        <span className="bi-risk-score-pill">Score {displayScore}</span>
                    )}
                </div>

                {/* Pass 4: Risk reasons */}
                {reasons && reasons.length > 0 && (
                    <div className="bi-risk-reasons-block">
                        <p className="bi-social-signals-title">Why this risk score?</p>
                        <ul className="bi-risk-reasons-list">
                            {reasons.map((r, i) => <li key={i}>{r}</li>)}
                        </ul>
                    </div>
                )}

                {/* BRAND_INTELLIGENCE_PASS7.md §10 CASE 3 — a failed Deep
                    Scan trigger never hides existing results; it's just
                    surfaced alongside them. */}
                {selectedCandidate.deep_scan_error && !deepScanResult && (
                    <div className="bi-error" role="alert">
                        Last Deep Scan attempt failed: {selectedCandidate.deep_scan_error}
                    </div>
                )}

                {/* §17/§18 "INFRASTRUCTURE PIVOTING" — optional, provider-backed. */}
                {selectedCandidate.infrastructure_pivot_json && (
                    <div className="bi-risk-reasons-block">
                        <p className="bi-social-signals-title">Infrastructure Pivot</p>
                        {!selectedCandidate.infrastructure_pivot_json.available ? (
                            <p className="bi-empty-sub">
                                {selectedCandidate.infrastructure_pivot_json.provider === 'Not Configured'
                                    ? 'Provider: Not Configured'
                                    : `Unavailable${selectedCandidate.infrastructure_pivot_json.reason ? ` (${selectedCandidate.infrastructure_pivot_json.reason})` : ''}`}
                            </p>
                        ) : selectedCandidate.infrastructure_pivot_json.potentialInfrastructureRelationship ? (
                            <>
                                <p className="bi-empty-sub">
                                    Potential Infrastructure Relationship — {selectedCandidate.infrastructure_pivot_json.otherHostnamesOnSameIp?.length ?? 0} other host(s)
                                    observed on the same IP ({selectedCandidate.infrastructure_pivot_json.ip}) via {selectedCandidate.infrastructure_pivot_json.provider}.
                                </p>
                                <ul className="bi-risk-reasons-list">
                                    {(selectedCandidate.infrastructure_pivot_json.otherHostnamesOnSameIp ?? []).slice(0, 10).map((h, i) => <li key={i}>{h}</li>)}
                                </ul>
                                <p className="bi-logo-note">{selectedCandidate.infrastructure_pivot_json.note}</p>
                            </>
                        ) : (
                            <p className="bi-empty-sub">No other hosts observed on the same IP via {selectedCandidate.infrastructure_pivot_json.provider}.</p>
                        )}
                    </div>
                )}

                {/* Pass 6: Deep Scan button (admin only) */}
                {isAdmin && (
                    <div className="bi-ds-trigger-row">
                        <button
                            type="button"
                            className="bi-btn-primary"
                            disabled={deepScanLoading}
                            onClick={handleRunDeepScan}
                        >
                            {deepScanLoading ? '⏳ Scanning…' : '🔬 Run Deep Scan'}
                        </button>
                        {deepScanLoading && (
                            <span className="bi-ds-loading-hint">
                                This may take a minute or two — Playwright is navigating and
                                interacting with the live page inside an isolated container.
                            </span>
                        )}
                        {deepScanError && (
                            <div className="bi-error bi-ds-error-inline" role="alert">{deepScanError}</div>
                        )}
                    </div>
                )}

                {/* Pass 6: Deep Scan results */}
                {deepScanResult && (
                    <DeepScanResults
                        deepScan={deepScanResult.deepScan}
                        riskScore={deepScanResult.riskScore}
                        riskLevel={deepScanResult.riskLevel}
                        reasons={deepScanResult.reasons}
                    />
                )}

                {di?.data
                    ? (
                        <DomainIntelligenceResult
                            data={di.data}
                            risk={selectedCandidate.risk_level ?? di.risk ?? undefined}
                        />
                    )
                    : (
                        <div className="bi-empty" role="status">
                            <p className="bi-empty-title">No intelligence data</p>
                            <p className="bi-empty-sub">This candidate's evaluation did not produce results (it may have failed during processing).</p>
                        </div>
                    )
                }
            </div>
        );
    }

    return (
        <div className="bi-pane">
            {/* Filters + sort */}
            <div className="bi-filter-bar">
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Risk</span>
                    <select className="bi-select bi-filter-select" value={filterRisk} onChange={(e) => setFilterRisk(e.target.value)}>
                        <option value="all">All</option>
                        <option value="critical">Critical</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                    </select>
                </label>
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Method</span>
                    <select className="bi-select bi-filter-select" value={filterMethod} onChange={(e) => setFilterMethod(e.target.value)}>
                        <option value="all">All</option>
                        <option value="permutation">Permutation</option>
                        <option value="tld_swap">TLD Swap</option>
                        <option value="crt_sh">Certificate CT</option>
                    </select>
                </label>
                <label className="bi-filter-group">
                    <span className="bi-filter-label">Sort</span>
                    <select className="bi-select bi-filter-select" value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                        <option value="risk">Risk (highest first)</option>
                        <option value="similarity">Similarity score</option>
                        <option value="domain">Domain name</option>
                        <option value="method">Discovery method</option>
                    </select>
                </label>
            </div>

            {sorted.length === 0 && (
                <div className="bi-empty" role="status">
                    <p className="bi-empty-title">No candidates</p>
                    <p className="bi-empty-sub">{evaluated.length === 0 ? 'No domains were evaluated yet.' : 'No candidates match the selected filters.'}</p>
                </div>
            )}

            {sorted.length > 0 && (
                <div className="bi-candidate-table" role="list">
                    <div className="bi-candidate-header">
                        <span>Domain</span>
                        <span>Match type</span>
                        <span>Sim.</span>
                        <span>Method</span>
                        <span>Risk</span>
                        <span>Score</span>
                        <span>Why?</span>
                    </div>
                    {sorted.map((c) => {
                        const bs = c.domain_intelligence_json?.data?.brandSimilarity;
                        const campaignName = campaignByCandidateId?.get(c.id);
                        const reasons = c.risk_reasons_json;
                        const isReasonOpen = showReasons === c.id;
                        return (
                            <React.Fragment key={c.id}>
                                <button
                                    type="button"
                                    className="bi-candidate-row"
                                    role="listitem"
                                    onClick={() => selectCandidate(c)}
                                    aria-label={`View details for ${c.value}`}
                                >
                                    <span className="bi-candidate-value">
                                        {c.value}
                                        {campaignName && (
                                            <span className="bi-campaign-tag" title={campaignName}>
                                                ⛓ Campaign
                                            </span>
                                        )}
                                        {c.deep_scan_json && (
                                            <span className="bi-ds-scanned-badge" title="Deep Scan completed">
                                                🔬
                                            </span>
                                        )}
                                    </span>
                                    <span className="bi-match-type">{bs?.matchType ?? '—'}</span>
                                    <span>{bs?.similarityScore != null ? `${bs.similarityScore}%` : '—'}</span>
                                    <span className="bi-discovery-badge">{c.discovery_method.replace(/_/g, ' ')}</span>
                                    <span className={`bi-risk-badge ${riskClass(c.risk_level)}`}>
                                        {c.risk_level || '—'}
                                    </span>
                                    <span className="bi-risk-score-col">
                                        {c.risk_score != null ? c.risk_score : '—'}
                                    </span>
                                    <span>
                                        {reasons && reasons.length > 0 ? (
                                            <button
                                                type="button"
                                                className={`bi-reasons-toggle${isReasonOpen ? ' open' : ''}`}
                                                onClick={(e) => { e.stopPropagation(); setShowReasons(isReasonOpen ? null : c.id); }}
                                                title="Show risk reasoning"
                                                aria-expanded={isReasonOpen}
                                            >
                                                {isReasonOpen ? '▲' : '▼'}
                                            </button>
                                        ) : '—'}
                                    </span>
                                </button>

                                {isReasonOpen && reasons && reasons.length > 0 && (
                                    <div className="bi-inline-reasons">
                                        <ul className="bi-risk-reasons-list">
                                            {reasons.map((r, i) => <li key={i}>{r}</li>)}
                                        </ul>
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

export default DomainImpersonationPane;
