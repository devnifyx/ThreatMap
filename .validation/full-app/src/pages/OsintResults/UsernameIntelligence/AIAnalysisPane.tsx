import React from 'react';
import type { UsernameIntelligenceData } from '../../../types';

interface AIAnalysisPaneProps {
    data: UsernameIntelligenceData;
}

const AIAnalysisPane: React.FC<AIAnalysisPaneProps> = ({ data }) => {
    const ai = data?.aiAnalysis;

    if (!ai) {
        return (
            <section className="uint-card" aria-label="AI analysis">
                <div className="uint-card-title">AI Analysis</div>
                <div className="uint-empty">AI Analysis is not available for this scan.</div>
            </section>
        );
    }

    const findings = Array.isArray(ai.technicalFindings) ? ai.technicalFindings : [];
    const recommendations = Array.isArray(ai.recommendations) ? ai.recommendations : [];
    const nextSteps = Array.isArray(ai.nextInvestigationSteps) ? ai.nextInvestigationSteps : [];

    return (
        <>
            <section className="uint-card" aria-label="AI analysis summary">
                <div className="uint-card-title">AI Analysis {ai.overallRisk ? `— ${ai.overallRisk}` : ''}</div>
                <div className="uint-note">{ai.executiveSummary ?? '—'}</div>
                {typeof ai.confidenceScore === 'number' && (
                    <div className="uint-empty" style={{ marginTop: '8px' }}>Confidence: {ai.confidenceScore}/100</div>
                )}
            </section>

            <section className="uint-card" aria-label="Technical findings" style={{ marginTop: '12px' }}>
                <div className="uint-card-title">Technical Findings</div>
                {findings.length ? (
                    <ul className="uint-list">
                        {findings.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}
                    </ul>
                ) : (
                    <div className="uint-empty">No technical findings reported.</div>
                )}
            </section>

            <section className="uint-card" aria-label="Recommendations" style={{ marginTop: '12px' }}>
                <div className="uint-card-title">Recommendations</div>
                {recommendations.length ? (
                    <ul className="uint-list">
                        {recommendations.map((r, i) => <li key={`${r}-${i}`}>{r}</li>)}
                    </ul>
                ) : (
                    <div className="uint-empty">No recommendations reported.</div>
                )}
            </section>

            <section className="uint-card" aria-label="Next investigation steps" style={{ marginTop: '12px' }}>
                <div className="uint-card-title">Next Investigation Steps</div>
                {nextSteps.length ? (
                    <ul className="uint-list">
                        {nextSteps.map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
                    </ul>
                ) : (
                    <div className="uint-empty">No next steps reported.</div>
                )}
            </section>
        </>
    );
};

export default AIAnalysisPane;
