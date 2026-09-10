import React from 'react';
import type { DomainIntelligenceData } from '../../../types';

interface BrandSimilarityPaneProps {
    data: DomainIntelligenceData;
}

const MATCH_TYPE_LABEL: Record<string, string> = {
    exact_official: 'Official Domain',
    typosquat: 'Typosquat',
    brand_suffix: 'Brand + Suffix',
    homograph: 'Homograph',
    no_match: 'No Match'
};

const matchTypeClass = (matchType: string) => {
    if (matchType === 'exact_official') return 'dint-hero--ok';
    if (matchType === 'no_match') return 'dint-hero--neutral';
    return 'dint-hero--bad';
};

const BrandSimilarityPane: React.FC<BrandSimilarityPaneProps> = ({ data }) => {
    const brand = data?.brandSimilarity;

    if (!brand) {
        return (
            <section className="dint-card" aria-label="Brand similarity">
                <div className="dint-card-title">Brand Similarity</div>
                <div className="dint-empty">No brand similarity data available.</div>
            </section>
        );
    }

    return (
        <section className={`dint-hero ${matchTypeClass(brand.matchType)}`} aria-label="Brand similarity result">
            <div className="dint-hero-kicker">{MATCH_TYPE_LABEL[brand.matchType] ?? brand.matchType}</div>
            {brand.matchedBrand ? (
                <>
                    <div className="dint-hero-title">
                        Resembles <span className="dint-hero-brand">{brand.matchedBrand}</span>
                    </div>
                    <div className="dint-hero-score-row">
                        <div className="dint-hero-score-track">
                            <div className="dint-hero-score-fill" style={{ width: `${brand.similarityScore}%` }} />
                        </div>
                        <div className="dint-hero-score-value">{brand.similarityScore}%</div>
                    </div>
                    <div className="dint-hero-explanation">{brand.explanation}</div>
                    {brand.officialDomain && (
                        <div className="dint-hero-official">Official domain: <strong>{brand.officialDomain}</strong></div>
                    )}
                </>
            ) : (
                <>
                    <div className="dint-hero-title">No known brand resemblance</div>
                    <div className="dint-hero-explanation">{brand.explanation}</div>
                </>
            )}
        </section>
    );
};

export default BrandSimilarityPane;
