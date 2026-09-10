import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import './ThreatIntelligencePage.css';
import OverviewSection from './sections/OverviewSection';
import IocListSection from './sections/IocListSection';
import CampaignsSection from './sections/CampaignsSection';
import ThreatFeedsSection from './sections/ThreatFeedsSection';
import ThreatActorsSection from './sections/ThreatActorsSection';
import MalwareSection from './sections/MalwareSection';
import VulnerabilitiesSection from './sections/VulnerabilitiesSection';
import CorrelationSection from './sections/CorrelationSection';
import ThreatHuntingSection from './sections/ThreatHuntingSection';
import RiskAssessmentSection from './sections/RiskAssessmentSection';
import IntelligenceWorkspaceSection from './sections/IntelligenceWorkspaceSection';
import IntelligenceHistorySection from './sections/IntelligenceHistorySection';
import { searchIntelligence, type SearchResultItem } from '../../services/api';

interface ThreatIntelligencePageProps {
    activeSection: string;
    onSectionChange: (section: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    isAdmin?: boolean;
    onAskAi?: (entityType: string, entityId: string, label: string) => void;
    onViewSample?: (sampleId: string) => void;
    initialOpenEntity?: { type: string; id: string } | null;
    onInitialOpenEntityConsumed?: () => void;
    onOpenThreatBrief?: (id?: string) => void;
    onOpenAttackTechnique?: (id?: string) => void;
}

const ENTITY_TYPE_TO_SECTION: Record<string, string> = {
    ioc: 'iocs', campaign: 'campaigns', threat_actor: 'actors', malware: 'malware',
    vulnerability: 'vulnerabilities', workspace: 'workspace'
};

const UnifiedSearchBar: React.FC<{ onOpenEntity: (type: string, id: string) => void; onInvestigate?: (target: string, tab?: string) => void }> = ({ onOpenEntity, onInvestigate }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!q.trim()) { setResults([]); setOpen(false); return; }
        const t = setTimeout(() => {
            setLoading(true);
            searchIntelligence(q.trim()).then((items) => { setResults(items); setOpen(true); }).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    useEffect(() => {
        const onClick = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, []);

    const pick = (r: SearchResultItem) => {
        if (r.type === 'investigation') { onInvestigate?.(r.label); }
        else if (r.type !== 'alert') { onOpenEntity(r.type, r.id); }
        setOpen(false);
        setQ('');
    };

    return (
        <div className="ti-unified-search" ref={boxRef}>
            <Search size={15} className="ti-unified-search-icon" />
            <input
                type="text" placeholder="Search all intelligence — IOCs, campaigns, actors, malware, CVEs, techniques, investigations…"
                value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => { if (results.length) setOpen(true); }}
            />
            {open && (
                <div className="ti-unified-search-results">
                    {loading ? <div className="ti-loading">Searching…</div> : results.length === 0 ? (
                        <div className="ti-empty">No matches.</div>
                    ) : results.map((r, i) => (
                        <button key={i} type="button" className="ti-unified-search-result" disabled={r.type === 'alert'} onClick={() => pick(r)}>
                            <span className="ti-unified-search-label">{r.label}</span>
                            <span className="ti-unified-search-type">{r.type.replace(/_/g, ' ')}{r.meta ? ` · ${r.meta}` : ''}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

const ThreatIntelligencePage: React.FC<ThreatIntelligencePageProps> = ({ activeSection, onSectionChange, onInvestigate, onCreateThreatBrief, onViewKnowledge, onViewNotes, onOpenKnowledgeEntry, onCreateKnowledgeEntry, isAdmin, onAskAi, onViewSample, initialOpenEntity, onInitialOpenEntityConsumed, onOpenThreatBrief, onOpenAttackTechnique }) => {
    const [pendingEntity, setPendingEntity] = useState<{ type: string; id: string } | null>(null);

    const handleOpenEntity = (type: string, id: string) => {
        if (type === 'report') { onOpenThreatBrief?.(id); return; }
        if (type === 'attack_technique') { onOpenAttackTechnique?.(id); return; }
        const section = ENTITY_TYPE_TO_SECTION[type];
        if (!section) return;
        setPendingEntity({ type, id });
        onSectionChange(section);
    };
    const clearPendingEntity = () => setPendingEntity(null);

    useEffect(() => {
        if (initialOpenEntity) {
            setPendingEntity(initialOpenEntity);
            const section = ENTITY_TYPE_TO_SECTION[initialOpenEntity.type];
            if (section) onSectionChange(section);
            onInitialOpenEntityConsumed?.();
        }
    }, [initialOpenEntity]);

    const renderSection = () => {
        switch (activeSection) {
            case 'overview': return <OverviewSection onNavigate={onSectionChange} />;
            case 'iocs': return <IocListSection openEntityId={pendingEntity?.type === 'ioc' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} onViewNotes={onViewNotes} />;
            case 'campaigns': return <CampaignsSection openEntityId={pendingEntity?.type === 'campaign' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onInvestigate={onInvestigate} onCreateThreatBrief={onCreateThreatBrief} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} onViewNotes={onViewNotes} />;
            case 'feeds': return <ThreatFeedsSection />;
            case 'actors':
            case 'apt-groups': return <ThreatActorsSection openEntityId={pendingEntity?.type === 'threat_actor' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} onCreateThreatBrief={onCreateThreatBrief} onViewKnowledge={onViewKnowledge} onViewNotes={onViewNotes} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} isAdmin={isAdmin} />;
            case 'malware': return <MalwareSection openEntityId={pendingEntity?.type === 'malware' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} onViewNotes={onViewNotes} onCreateThreatBrief={onCreateThreatBrief} onAskAi={onAskAi} onViewSample={onViewSample} isAdmin={isAdmin} />;
            case 'vulnerabilities': return <VulnerabilitiesSection openEntityId={pendingEntity?.type === 'vulnerability' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} />;
            case 'correlation': return <CorrelationSection onOpenEntity={handleOpenEntity} />;
            case 'hunting': return <ThreatHuntingSection onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} />;
            case 'risk': return <RiskAssessmentSection onOpenEntity={handleOpenEntity} />;
            case 'workspace': return <IntelligenceWorkspaceSection openEntityId={pendingEntity?.type === 'workspace' ? pendingEntity.id : null} onEntityOpened={clearPendingEntity} onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} onReportCreated={() => onOpenThreatBrief?.()} />;
            case 'history': return <IntelligenceHistorySection onOpenEntity={handleOpenEntity} />;
            default: return null;
        }
    };

    return (
        <div className="ti-page">
            <div className="ti-header">
                <h1>Threat Intelligence</h1>
                <p className="ti-subtitle">Structured, correlated indicators, campaigns, feeds, adversaries, malware, vulnerabilities, and adversary techniques — what OSINT found, organized for analysis.</p>
                <UnifiedSearchBar onOpenEntity={handleOpenEntity} onInvestigate={onInvestigate} />
            </div>
            <div className="ti-container">
                <div className="ti-content">
                    {renderSection()}
                </div>
            </div>
        </div>
    );
};

export default ThreatIntelligencePage;
