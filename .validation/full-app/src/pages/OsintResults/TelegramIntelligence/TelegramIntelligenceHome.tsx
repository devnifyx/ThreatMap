import React, { useCallback, useEffect, useState } from 'react';
import { Send, PlusCircle, PlayCircle, RefreshCw } from 'lucide-react';
import '../SocialMediaIntelligence/SocialMediaIntelligence.css';
import './TelegramIntelligence.css';
import TelegramIntelligencePane from '../SocialMediaIntelligence/TelegramIntelligencePane';
import { getTelegramWorkspace, type SocialAccountResult, type SocialTelegramCapability, type TelegramEngineInfo, type TelegramSource, type TelegramDashboard } from '../../../services/api';

const TelegramIntelligenceHome: React.FC<{
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    onNavigateToView?: (view: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
}> = ({ onNavigateToModule, onNavigateToView, onOpenKnowledgeEntry, onCreateKnowledgeEntry }) => {
    const [workspace, setWorkspace] = useState<{
        investigationId: number;
        capability: SocialTelegramCapability; engine: TelegramEngineInfo;
        sources: TelegramSource[]; dashboard: TelegramDashboard; accounts: SocialAccountResult[];
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getTelegramWorkspace()
            .then(setWorkspace)
            .catch((err) => setError(err?.message || 'Failed to load Telegram workspace'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    const scrollToId = (id: string) => {
        document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    return (
        <div className="smi-page">
            {/* §4 "TELEGRAM LANDING PAGE" */}
            <div className="ti-hero">
                <div className="ti-hero-top">
                    <span className="ti-hero-icon" aria-hidden="true"><Send size={22} /></span>
                    <h2 className="ti-hero-title">Telegram Intelligence</h2>
                </div>
                <p className="ti-hero-desc">Collect, investigate and analyze publicly accessible Telegram sources.</p>
                <div className="ti-hero-actions">
                    <button type="button" className="smi-btn smi-btn--primary ti-hero-btn" onClick={() => scrollToId('telegram-add-source')}>
                        <PlusCircle size={16} /> Add Telegram Source
                    </button>
                    <button
                        type="button" className="smi-btn ti-hero-btn"
                        onClick={() => scrollToId('telegram-configured-sources')}
                        disabled={!workspace || workspace.sources.length === 0}
                        title={workspace && workspace.sources.length === 0 ? 'Add a Telegram source first' : undefined}
                    >
                        <PlayCircle size={16} /> Start Collection
                    </button>
                </div>
            </div>

            {loading && <div className="smi-card"><div className="smi-loading">Loading…</div></div>}
            {error && (
                <div className="smi-card">
                    <div className="smi-error" role="alert">{error}</div>
                    <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '10px' }} onClick={load}>
                        <RefreshCw size={13} style={{ marginRight: '6px', verticalAlign: '-2px' }} /> Retry
                    </button>
                </div>
            )}

            {!loading && !error && workspace && (
                <TelegramIntelligencePane
                    investigationId={workspace.investigationId}
                    capability={workspace.capability}
                    engine={workspace.engine}
                    sources={workspace.sources}
                    dashboard={workspace.dashboard}
                    accounts={workspace.accounts}
                    onRefresh={load}
                    onOpenAccount={() => onNavigateToModule?.('social-media-intel')}
                    onNavigateToModule={onNavigateToModule}
                    onNavigateToView={onNavigateToView}
                    onOpenKnowledgeEntry={onOpenKnowledgeEntry}
                    onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                />
            )}
        </div>
    );
};

export default TelegramIntelligenceHome;
