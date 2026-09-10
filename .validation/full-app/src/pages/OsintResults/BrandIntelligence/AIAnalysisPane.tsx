import React from 'react';
import type { BrandScanJob, BrandAiAnalysis, BrandAiKeyFinding } from '../../../types/index';

interface AIAnalysisPaneProps {
    job: BrandScanJob;
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

function CertaintyChip({ certainty }: { certainty: BrandAiKeyFinding['certainty'] }) {
    const labels: Record<BrandAiKeyFinding['certainty'], string> = {
        confirmed:        'Confirmed',
        strong_indicator: 'Strong indicator',
        uncertain:        'Uncertain'
    };
    return (
        <span
            className={`bi-certainty-chip bi-certainty-${certainty}`}
            title={`Certainty: ${labels[certainty]}`}
        >
            {labels[certainty]}
        </span>
    );
}

const AIAnalysisPane: React.FC<AIAnalysisPaneProps> = ({ job }) => {
    const ai: BrandAiAnalysis | null = job.ai_analysis_json ?? null;

    if (!ai) {
        return (
            <div className="bi-pane">
                <section className="bi-ai-card" aria-label="AI investigation summary">
                    <p className="bi-ai-card-title">AI Investigation Summary</p>
                    <p className="bi-empty">
                        AI analysis has not yet completed for this investigation.
                        {job.status !== 'completed' && ` The job is currently in the "${job.status}" stage.`}
                    </p>
                </section>
            </div>
        );
    }

    const keyFindings       = Array.isArray(ai.keyFindings)            ? ai.keyFindings            : [];
    const recommendations   = Array.isArray(ai.recommendations)        ? ai.recommendations        : [];
    const nextSteps         = Array.isArray(ai.nextInvestigationSteps) ? ai.nextInvestigationSteps : [];

    return (
        <div className="bi-pane">
            {/* Executive summary + risk badge */}
            <section className="bi-ai-card" aria-label="AI investigation summary">
                <div className="bi-ai-card-header">
                    <p className="bi-ai-card-title">AI Investigation Summary</p>
                    {ai.overallRisk && (
                        <span className={`bi-risk-badge ${riskClass(ai.overallRisk)}`}>
                            {ai.overallRisk}
                        </span>
                    )}
                    {typeof ai.confidenceScore === 'number' && (
                        <span className="bi-risk-score-pill">Confidence {ai.confidenceScore}%</span>
                    )}
                </div>
                <p className="bi-ai-summary">{ai.executiveSummary}</p>
                {ai.likelyImpersonatedBrand && (
                    <p className="bi-ai-brand-note">
                        Likely targeted brand: <strong>{ai.likelyImpersonatedBrand}</strong>
                    </p>
                )}
            </section>

            {/* Key findings — with per-finding certainty chips (spec requirement) */}
            <section className="bi-ai-card" aria-label="Key findings" style={{ marginTop: '0.75rem' }}>
                <p className="bi-ai-card-title">Key Findings</p>
                {keyFindings.length > 0 ? (
                    <ul className="bi-ai-findings-list">
                        {keyFindings.map((kf, i) => (
                            <li key={i} className="bi-ai-finding-row">
                                <CertaintyChip certainty={kf.certainty} />
                                <span className="bi-ai-finding-text">{kf.finding}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="bi-empty">No key findings reported.</p>
                )}
            </section>

            {/* Domain-specific assessments */}
            <section className="bi-ai-card" aria-label="Threat assessments" style={{ marginTop: '0.75rem' }}>
                <p className="bi-ai-card-title">Threat Assessments</p>
                <div className="bi-ai-assessments">
                    <div className="bi-ai-assessment-row">
                        <span className="bi-ai-assessment-label">Phishing</span>
                        <p className="bi-ai-assessment-text">{ai.phishingAssessment || '—'}</p>
                    </div>
                    <div className="bi-ai-assessment-row">
                        <span className="bi-ai-assessment-label">Credential harvesting</span>
                        <p className="bi-ai-assessment-text">{ai.credentialHarvestingAssessment || '—'}</p>
                    </div>
                    <div className="bi-ai-assessment-row">
                        <span className="bi-ai-assessment-label">Campaigns</span>
                        <p className="bi-ai-assessment-text">{ai.campaignAssessment || '—'}</p>
                    </div>
                </div>
            </section>

            {/* Evidence summary */}
            {ai.evidenceSummary && (
                <section className="bi-ai-card" aria-label="Evidence summary" style={{ marginTop: '0.75rem' }}>
                    <p className="bi-ai-card-title">Evidence Summary</p>
                    <p className="bi-ai-summary">{ai.evidenceSummary}</p>
                </section>
            )}

            {/* Recommendations */}
            <section className="bi-ai-card" aria-label="Recommendations" style={{ marginTop: '0.75rem' }}>
                <p className="bi-ai-card-title">Recommendations</p>
                {recommendations.length > 0 ? (
                    <ul className="bi-ai-list">
                        {recommendations.map((r, i) => <li key={i}>{r}</li>)}
                    </ul>
                ) : (
                    <p className="bi-empty">No recommendations reported.</p>
                )}
            </section>

            {/* Next investigation steps */}
            <section className="bi-ai-card" aria-label="Next investigation steps" style={{ marginTop: '0.75rem' }}>
                <p className="bi-ai-card-title">Next Investigation Steps</p>
                {nextSteps.length > 0 ? (
                    <ul className="bi-ai-list">
                        {nextSteps.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                ) : (
                    <p className="bi-empty">No next steps reported.</p>
                )}
            </section>
        </div>
    );
};

export default AIAnalysisPane;
