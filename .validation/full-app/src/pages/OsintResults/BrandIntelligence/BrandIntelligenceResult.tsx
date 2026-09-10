import React, { useState, useEffect, useCallback } from 'react';
import { Compass, Globe, LayoutTemplate, Share2, ImageIcon, Network, FileSearch, History, Bot, ShieldAlert } from 'lucide-react';
import PillarSubnav from '../../../components/PillarSubnav';
import type { BrandScanJob, BrandScanCandidate } from '../../../types/index';
import { getBrandScanCandidates } from '../../../services/api';
import OverviewPane from './OverviewPane';
import DomainImpersonationPane from './DomainImpersonationPane';
import WebsiteImpersonationPane from './WebsiteImpersonationPane';
import SocialMediaImpersonationPane from './SocialMediaImpersonationPane';
import LogoVisualSimilarityPane from './LogoVisualSimilarityPane';
import PhishingCampaignsPane from './PhishingCampaignsPane';
import EvidencePane from './EvidencePane';
import TimelinePane from './TimelinePane';
import AIAnalysisPane from './AIAnalysisPane';
import CtiFindingsPane from './CtiFindingsPane';

const PILLARS = [
    { id: 'overview',   label: 'Overview',                icon: <Compass        size={16} /> },
    { id: 'domain',     label: 'Domain Impersonation',    icon: <Globe          size={16} /> },
    { id: 'website',    label: 'Website Impersonation',   icon: <LayoutTemplate size={16} /> },
    { id: 'social',     label: 'Social Media',            icon: <Share2         size={16} /> },
    { id: 'logo',       label: 'Logo & Visual Similarity',icon: <ImageIcon      size={16} /> },
    { id: 'campaigns',  label: 'Phishing Campaigns',      icon: <Network        size={16} /> },
    // BRAND_INTELLIGENCE_IMPROVEMENT.md §47 — persistent, cross-scan CTI findings.
    { id: 'cti',        label: 'CTI & Threat Intel',      icon: <ShieldAlert    size={16} /> },
    { id: 'evidence',   label: 'Evidence',                icon: <FileSearch     size={16} /> },
    { id: 'timeline',   label: 'Timeline',                icon: <History        size={16} /> },
    { id: 'ai',         label: 'AI Analysis',             icon: <Bot            size={16} /> }
];

interface BrandIntelligenceResultProps {
    job: BrandScanJob;
    brandName: string;
    onBack: () => void;
}

const BrandIntelligenceResult: React.FC<BrandIntelligenceResultProps> = ({ job, brandName, onBack }) => {
    const [activePillar, setActivePillar] = useState('overview');
    const [candidates, setCandidates] = useState<BrandScanCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedForOverview, setSelectedForOverview] = useState<BrandScanCandidate | null>(null);

    const loadAllCandidates = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getBrandScanCandidates(job.id, { page: 1, pageSize: 200 });
            setCandidates(res.candidates ?? []);
        } catch (err: any) {
            setError(err.message || 'Failed to load candidates');
        } finally {
            setLoading(false);
        }
    }, [job.id]);

    useEffect(() => { loadAllCandidates(); }, [loadAllCandidates]);

    const handleOverviewSelectCandidate = useCallback((c: BrandScanCandidate) => {
        setSelectedForOverview(c);
        setActivePillar('domain');
    }, []);

    return (
        <div className="bi-home">
            <div className="bi-toolbar">
                <div>
                    <h2 className="bi-title">{brandName} — Investigation Results</h2>
                    <p className="bi-subtitle">
                        {job.status === 'cancelled' ? 'Partial results (investigation was cancelled)' : 'Investigation complete'}
                        {candidates.length > 0 ? ` · ${candidates.filter(c => c.status === 'evaluated').length} candidates evaluated` : ''}
                    </p>
                </div>
                <button type="button" className="bi-btn-secondary" onClick={onBack}>← Back</button>
            </div>

            {error && <div className="bi-error" role="alert">{error}</div>}
            {loading && <p className="bi-loading">Loading results…</p>}

            {!loading && (
                <div className="ei-layout">
                    <PillarSubnav
                        pillars={PILLARS}
                        activeId={activePillar}
                        onSelect={(id) => { setActivePillar(id); setSelectedForOverview(null); }}
                        ariaLabel="Brand Intelligence result pillars"
                    />
                    <div className="ei-tab-content">
                        {activePillar === 'overview' && (
                            <OverviewPane
                                job={job}
                                candidates={candidates}
                                onSelectCandidate={handleOverviewSelectCandidate}
                            />
                        )}
                        {activePillar === 'domain' && (
                            <DomainImpersonationPane
                                key={selectedForOverview?.id ?? 'default'}
                                job={job}
                                candidates={candidates}
                                initialSelected={selectedForOverview}
                            />
                        )}
                        {activePillar === 'website' && (
                            <WebsiteImpersonationPane candidates={candidates} />
                        )}
                        {activePillar === 'social' && (
                            <SocialMediaImpersonationPane candidates={candidates} />
                        )}
                        {activePillar === 'logo' && (
                            <LogoVisualSimilarityPane candidates={candidates} />
                        )}
                        {activePillar === 'campaigns' && (
                            <PhishingCampaignsPane job={job} candidates={candidates} />
                        )}
                        {activePillar === 'cti' && (
                            <CtiFindingsPane job={job} />
                        )}
                        {activePillar === 'evidence' && (
                            <EvidencePane job={job} />
                        )}
                        {activePillar === 'timeline' && (
                            <TimelinePane job={job} />
                        )}
                        {activePillar === 'ai' && (
                            <AIAnalysisPane job={job} />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default BrandIntelligenceResult;
