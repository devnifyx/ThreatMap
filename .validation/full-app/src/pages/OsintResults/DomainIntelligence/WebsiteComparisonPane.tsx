import React from 'react';
import type { DomainIntelligenceData } from '../../../types';

interface WebsiteComparisonPaneProps {
    data: DomainIntelligenceData;
}

const WebsiteComparisonPane: React.FC<WebsiteComparisonPaneProps> = ({ data }) => {
    const comparison = data?.websiteComparison;

    if (!comparison?.available) {
        return (
            <section className="dint-card" aria-label="Website comparison">
                <div className="dint-card-title">Website Comparison</div>
                <div className="dint-empty">{comparison?.reason ?? 'No known brand match — nothing to compare against.'}</div>
            </section>
        );
    }

    return (
        <>
            <section className="dint-card" aria-label="Website structural similarity">
                <div className="dint-card-title">Structural Similarity</div>
                <div className="dint-score-row">
                    <div className="dint-score-track">
                        <div className="dint-score-fill" style={{ width: `${comparison.similarityScore}%` }} />
                    </div>
                    <div className="dint-score-value">{comparison.similarityScore}%</div>
                </div>
                <div className="dint-note" style={{ marginTop: '10px' }}>{comparison.explanation}</div>
            </section>

            <section className="dint-card" aria-label="Structural comparison findings" style={{ marginTop: '12px' }}>
                <div className="dint-card-title">HTML/CSS Structural Findings</div>
                <div className="dint-compare-table" role="table" aria-label="Website structure comparison">
                    <div className="dint-compare-row dint-compare-row--head" role="row">
                        <div role="columnheader">Signal</div>
                        <div role="columnheader">Suspect Domain</div>
                        <div role="columnheader">Official Domain</div>
                        <div role="columnheader">Match</div>
                    </div>
                    {comparison.findings?.map((f) => (
                        <div className="dint-compare-row" role="row" key={f.label}>
                            <div role="cell">{f.label}</div>
                            <div role="cell">{String(f.suspectValue)}</div>
                            <div role="cell">{String(f.officialValue)}</div>
                            <div role="cell">
                                <span className={`pill ${f.matched ? 'pill--ok' : 'pill--bad'}`}>{f.matched ? 'Match' : 'Differs'}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>
        </>
    );
};

export default WebsiteComparisonPane;
