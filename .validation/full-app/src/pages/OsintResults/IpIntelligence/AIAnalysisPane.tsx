import React from 'react';
import type { IpIntelligenceData } from '../../../types';

interface AIAnalysisPaneProps {
    data: IpIntelligenceData;
}

const AIAnalysisPane: React.FC<AIAnalysisPaneProps> = ({ data }) => {
    const ai = data?.aiAnalysis;

    if (!ai) {
        return (
            <section className="iint-card" aria-label="AI summary">
                <div className="iint-card-title">AI Summary</div>
                <div className="iint-empty">AI Summary is not available for this scan.</div>
            </section>
        );
    }

    const findings = Array.isArray(ai.technicalFindings) ? ai.technicalFindings : [];
    const recommendations = Array.isArray(ai.recommendations) ? ai.recommendations : [];
    const nextSteps = Array.isArray(ai.nextInvestigationSteps) ? ai.nextInvestigationSteps : [];

    return (
        <>
            <section className="iint-card" aria-label="AI summary">
                <div className="iint-card-title">AI Summary {ai.overallRisk ? `— ${ai.overallRisk}` : ''}</div>
                <div className="iint-note">{ai.executiveSummary ?? '—'}</div>
                {typeof ai.confidenceScore === 'number' && (
                    <div className="iint-empty" style={{ marginTop: '8px' }}>Confidence: {ai.confidenceScore}/100</div>
                )}
            </section>

            <section className="iint-card" aria-label="Technical findings" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Technical Findings</div>
                {findings.length ? (
                    <ul className="iint-list">
                        {findings.map((f, i) => <li key={`${f}-${i}`}>{f}</li>)}
                    </ul>
                ) : (
                    <div className="iint-empty">No technical findings reported.</div>
                )}
            </section>

            <section className="iint-card" aria-label="Recommendations" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Recommendations</div>
                {recommendations.length ? (
                    <ul className="iint-list">
                        {recommendations.map((r, i) => <li key={`${r}-${i}`}>{r}</li>)}
                    </ul>
                ) : (
                    <div className="iint-empty">No recommendations reported.</div>
                )}
            </section>

            <section className="iint-card" aria-label="Next investigation steps" style={{ marginTop: '12px' }}>
                <div className="iint-card-title">Next Investigation Steps</div>
                {nextSteps.length ? (
                    <ul className="iint-list">
                        {nextSteps.map((s, i) => <li key={`${s}-${i}`}>{s}</li>)}
                    </ul>
                ) : (
                    <div className="iint-empty">No next steps reported.</div>
                )}
            </section>
        </>
    );
};

export default AIAnalysisPane;
