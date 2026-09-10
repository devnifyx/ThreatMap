import React, { useState } from 'react';
import { Compass, Fingerprint, LayoutTemplate, Camera, Lock, Star, Bot } from 'lucide-react';
import PillarSubnav from '../../../components/PillarSubnav';
import type { DomainIntelligenceData } from '../../../types';
import OverviewPane from './OverviewPane';
import BrandSimilarityPane from './BrandSimilarityPane';
import WebsiteComparisonPane from './WebsiteComparisonPane';
import ScreenshotComparisonPane from './ScreenshotComparisonPane';
import SslComparisonPane from './SslComparisonPane';
import ReputationPane from './ReputationPane';
import AIAnalysisPane from './AIAnalysisPane';
import './DomainIntelligence.css';

const PILLARS = [
    { id: 'overview', label: 'Overview', icon: <Compass size={16} /> },
    { id: 'brand', label: 'Brand Similarity', icon: <Fingerprint size={16} /> },
    { id: 'website', label: 'Website Comparison', icon: <LayoutTemplate size={16} /> },
    { id: 'screenshot', label: 'Screenshot Comparison', icon: <Camera size={16} /> },
    { id: 'ssl', label: 'SSL Comparison', icon: <Lock size={16} /> },
    { id: 'reputation', label: 'Reputation & Threat Intel', icon: <Star size={16} /> },
    { id: 'ai', label: 'AI Investigation Summary', icon: <Bot size={16} /> }
];

interface DomainIntelligenceResultProps {
    data: DomainIntelligenceData;
    risk?: string;
}

const DomainIntelligenceResult: React.FC<DomainIntelligenceResultProps> = ({ data, risk }) => {
    const [activePillar, setActivePillar] = useState('brand');

    return (
        <div className="dint-result" aria-label="Domain intelligence results">
            <div className="ei-layout">
                <PillarSubnav pillars={PILLARS} activeId={activePillar} onSelect={setActivePillar} ariaLabel="Domain Intelligence pillars" />

                <div className="ei-tab-content">
                    {activePillar === 'overview' && <OverviewPane data={data} risk={risk} />}
                    {activePillar === 'brand' && <BrandSimilarityPane data={data} />}
                    {activePillar === 'website' && <WebsiteComparisonPane data={data} />}
                    {activePillar === 'screenshot' && <ScreenshotComparisonPane data={data} />}
                    {activePillar === 'ssl' && <SslComparisonPane data={data} />}
                    {activePillar === 'reputation' && <ReputationPane data={data} />}
                    {activePillar === 'ai' && <AIAnalysisPane data={data} />}
                </div>
            </div>
        </div>
    );
};

export default DomainIntelligenceResult;
