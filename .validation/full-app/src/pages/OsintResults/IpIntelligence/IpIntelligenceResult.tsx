import React, { useState } from 'react';
import { Compass, MapPin, Network, ShieldCheck, Star, Bot } from 'lucide-react';
import PillarSubnav from '../../../components/PillarSubnav';
import type { IpIntelligenceData } from '../../../types';
import OverviewPane from './OverviewPane';
import GeolocationPane from './GeolocationPane';
import NetworkPane from './NetworkPane';
import FirewallPane from './FirewallPane';
import ReputationPane from './ReputationPane';
import AIAnalysisPane from './AIAnalysisPane';
import './IpIntelligence.css';

const PILLARS = [
    { id: 'overview',    label: 'Overview',                 icon: <Compass size={16} /> },
    { id: 'geolocation', label: 'Geolocation',               icon: <MapPin size={16} /> },
    { id: 'network',     label: 'Network',                   icon: <Network size={16} /> },
    { id: 'firewall',    label: 'Firewall',                  icon: <ShieldCheck size={16} /> },
    { id: 'reputation',  label: 'Reputation & Threat Intel',  icon: <Star size={16} /> },
    { id: 'ai',          label: 'AI Summary',                 icon: <Bot size={16} /> }
];

interface IpIntelligenceResultProps {
    data: IpIntelligenceData;
    risk?: string;
}

const IpIntelligenceResult: React.FC<IpIntelligenceResultProps> = ({ data, risk }) => {
    const [activePillar, setActivePillar] = useState('overview');

    return (
        <div className="iint-result" aria-label="IP intelligence results">
            <div className="ei-layout">
                <PillarSubnav pillars={PILLARS} activeId={activePillar} onSelect={setActivePillar} ariaLabel="IP Intelligence pillars" />

                <div className="ei-tab-content">
                    {activePillar === 'overview' && <OverviewPane data={data} risk={risk} />}
                    {activePillar === 'geolocation' && <GeolocationPane data={data} />}
                    {activePillar === 'network' && <NetworkPane data={data} />}
                    {activePillar === 'firewall' && <FirewallPane data={data} />}
                    {activePillar === 'reputation' && <ReputationPane data={data} />}
                    {activePillar === 'ai' && <AIAnalysisPane data={data} />}
                </div>
            </div>
        </div>
    );
};

export default IpIntelligenceResult;
