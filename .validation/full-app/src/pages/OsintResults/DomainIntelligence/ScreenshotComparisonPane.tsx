import React from 'react';
import type { DomainIntelligenceData } from '../../../types';

interface ScreenshotComparisonPaneProps {
    data: DomainIntelligenceData;
}

const ScreenshotComparisonPane: React.FC<ScreenshotComparisonPaneProps> = ({ data }) => {
    const comparison = data?.screenshotComparison;

    if (!comparison?.available) {
        return (
            <section className="dint-card" aria-label="Screenshot comparison">
                <div className="dint-card-title">Screenshot Comparison</div>
                <div className="dint-empty">{comparison?.reason ?? 'No known brand match — nothing to compare against.'}</div>
            </section>
        );
    }

    return (
        <section className="dint-card" aria-label="Screenshot comparison">
            <div className="dint-card-title">
                Screenshot Comparison
                {typeof comparison.visualSimilarityScore === 'number' && ` — ${comparison.visualSimilarityScore}% visual similarity`}
            </div>
            <div className="dint-note">{comparison.explanation}</div>
            <div className="dint-screenshot-grid">
                <div className="dint-screenshot-cell">
                    <div className="dint-screenshot-label">Suspect Domain</div>
                    {comparison.suspectScreenshotUrl ? (
                        <img className="dint-screenshot-img" src={comparison.suspectScreenshotUrl} alt="Suspect domain screenshot" loading="lazy" />
                    ) : (
                        <div className="dint-empty">No screenshot available.</div>
                    )}
                </div>
                <div className="dint-screenshot-cell">
                    <div className="dint-screenshot-label">Official Domain</div>
                    {comparison.officialScreenshotUrl ? (
                        <img className="dint-screenshot-img" src={comparison.officialScreenshotUrl} alt="Official domain screenshot" loading="lazy" />
                    ) : (
                        <div className="dint-empty">No screenshot available.</div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ScreenshotComparisonPane;
