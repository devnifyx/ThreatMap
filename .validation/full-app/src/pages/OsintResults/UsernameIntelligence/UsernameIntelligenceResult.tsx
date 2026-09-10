import React, { useState } from 'react';
import { Compass, Search, User, Package, Star, Share2, Bot } from 'lucide-react';
import PillarSubnav from '../../../components/PillarSubnav';
import type { UsernameIntelligenceData } from '../../../types';
import OverviewPane from './OverviewPane';
import AccountDiscoveryPane from './AccountDiscoveryPane';
import ProfileAnalysisPane from './ProfileAnalysisPane';
import ReputationPane from './ReputationPane';
import CorrelationGraph from './CorrelationGraph';
import AIAnalysisPane from './AIAnalysisPane';
import OsintPlaceholderPane from '../../../components/OsintPlaceholderPane';
import './UsernameIntelligence.css';

const PILLARS = [
    { id: 'overview', label: 'Overview', icon: <Compass size={16} /> },
    { id: 'discovery', label: 'Account Discovery', icon: <Search size={16} /> },
    { id: 'profile', label: 'Profile Analysis', icon: <User size={16} /> },
    { id: 'repository', label: 'Repository Analysis', icon: <Package size={16} /> },
    { id: 'reputation', label: 'Reputation', icon: <Star size={16} /> },
    { id: 'correlation', label: 'Correlation', icon: <Share2 size={16} /> },
    { id: 'ai', label: 'AI Analysis', icon: <Bot size={16} /> }
];

interface UsernameIntelligenceResultProps {
    data: UsernameIntelligenceData;
    risk?: string;
    target: string;
}

const UsernameIntelligenceResult: React.FC<UsernameIntelligenceResultProps> = ({ data, risk, target }) => {
    const [activePillar, setActivePillar] = useState('overview');
    const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);

    return (
        <div className="uint-result" aria-label="Username intelligence results">
            <div className="ei-layout">
                <PillarSubnav pillars={PILLARS} activeId={activePillar} onSelect={setActivePillar} ariaLabel="Username Intelligence pillars" />

                <div className="ei-tab-content">
                    {activePillar === 'overview' && <OverviewPane data={data} risk={risk ?? null} />}
                    {activePillar === 'discovery' && (
                        <AccountDiscoveryPane
                            data={data}
                            target={target}
                            onSelectPlatform={(platform) => {
                                setSelectedPlatform(platform);
                                setActivePillar('profile');
                            }}
                        />
                    )}
                    {activePillar === 'profile' && (
                        <ProfileAnalysisPane data={data} selectedPlatform={selectedPlatform} onSelectPlatform={setSelectedPlatform} />
                    )}
                    {activePillar === 'repository' && <OsintPlaceholderPane title="Repository Analysis" />}
                    {activePillar === 'reputation' && <ReputationPane data={data} />}
                    {activePillar === 'correlation' && <CorrelationGraph data={data?.correlation ?? { nodes: [], edges: [] }} />}
                    {activePillar === 'ai' && <AIAnalysisPane data={data} />}
                </div>
            </div>
        </div>
    );
};

export default UsernameIntelligenceResult;
