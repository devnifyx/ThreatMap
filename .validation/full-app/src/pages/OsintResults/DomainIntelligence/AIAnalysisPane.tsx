import React from 'react';
import type { DomainIntelligenceData } from '../../../types';

interface AIAnalysisPaneProps {
    data: DomainIntelligenceData;
}

const AIAnalysisPane: React.FC<AIAnalysisPaneProps> = ({ data }) => {
    const ai = data?.aiAnalysis;

    if (!ai) {
        return (
            <section className="dint-card" aria-label="AI investigation summary">
                <div className="dint-card-title">AI Investigation Summary</div>
                <div className="dint-empty">AI Investigation Summary is not available for this scan.</div>
            </section>
        );
    }

    const findings = Array.isArray(ai.technicalFindings) ? ai.technicalFindings : [];
    const recommendations = Array.isArray(ai.recommendations) ? ai.recommendations : [];
    const nextSteps = Array.isArray(ai.nextInvestigationSteps) ? ai.nextInvestigationSteps : [];

    return (
        <>
            <section className="dint-card" aria-label="AI investigation summary">
                <div className="dint-card-title">AI Investigation Summary {ai.overallRisk ? `— ${ai.overallRisk}` : ''}</div>
                <div className="dint-note">{ai.executiveSummary ?? '—'}</div>
                {typeof ai.confidenceScore === 'number' && (
                    <div className="dint-empty" style={{ marginTop: '8px' }}>Confidence: {ai.confidenceScore}/100</div>
                )}
            </section>

            <section className="dint-card" aria-label="Technical findings" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">Technical Findings</div>
                {findings.length ? (
                    <ul className="dint-list">
                        {findings.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}
                    </ul>
                ) : (
                    <div className="dint-empty">No technical findings reported.</div>
                )}
            </section>

            <section className="dint-card" aria-label="Recommendations" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">Recommendations</div>
                {recommendations.length ? (
                    <ul className="dint-list">
                        {recommendations.map((r, i) => <li key={`${r}-${i}`}>{r}</li>)}
                    </ul>
                ) : (
                    <div className="dint-empty">No recommendations reported.</div>
                )}
            </section>

            <section className="dint-card" aria-label="Next investigation steps" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">Next Investigation Steps</div>
                {nextSteps.length ? (
                    <ul className="dint-list">
                        {nextSteps.map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
                    </ul>
                ) : (
                    <div className="dint-empty">No next steps reported.</div>
                )}
            </section>
        </>
    );
};

export default AIAnalysisPane;
