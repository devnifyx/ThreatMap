import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './SocialMediaIntelligence.css';
import { timeAgo } from '../../../utils/timeAgo';
import PillarSubnav, { type PillarSubnavItem } from '../../../components/PillarSubnav';
import JsonViewer from '../../../components/JsonViewer';
import RelationshipGraphViz from '../../ThreatIntelligence/sections/RelationshipGraph';
import KnowledgeContextPanel from '../../KnowledgeBase/KnowledgeContextPanel'; // KNOWLEDGE_BASE_PHASE2.md §9/§17
import {
    Info, UserCircle, Link2, Fingerprint, Users, Globe2, Building2, Mail, Search, FileText,
    Network, Image as ImageIcon, ShieldAlert, Clock, Gauge, Sparkles
} from 'lucide-react';
import { deriveUsernameFromEmail, deriveUsernameFromPhone } from '../../../utils/usernameCandidates';
import { downloadBlob } from '../../../components/shared/downloadFile';  // P1-5 — was open-coded here
import {
    runSocialInvestigation, getSocialInvestigations, getSocialInvestigationResults,
    getSocialToolHealth, type SocialToolHealth,
    getSocialProfileJob, getLatestSocialProfileJob, cancelSocialProfileJob, type SocialProfileJob,
    analyzeSocialProfiles, getSocialInvestigationLinks, getSocialInvestigationCorrelations,
    getSocialInvestigationDorks, addSocialObservable, getSocialInvestigationEvidence, addSocialInvestigationEvidence,
    runSocialDeepAnalysis, getSocialDeepAnalysisJob, getLatestSocialDeepAnalysisJob, cancelSocialDeepAnalysisJob, type SocialDeepAnalysisJob,
    getSocialInvestigationImages, getSocialInvestigationImageMatches,
    getSocialInvestigationDorkResults, saveSocialDorkResult, getSocialGoogleDorkingCapability, getSocialInvestigationThreatContext,
    getSocialInvestigationTimeline, getSocialInvestigationRisk, getSocialInvestigationAiSummary, getRelationshipGraph,
    type SocialInvestigation, type SocialAccountResult, type SocialInvestigationSummary, type SocialToolOutcome,
    type SocialProfileLink, type SocialCorrelation, type SocialCorrelationSignal, type SocialDorkQuery, type SocialEvidence,
    type SocialProfileImage, type SocialImageMatch, type SocialDorkResult,
    type SocialGoogleDorkingCapability, type SocialThreatMatch, type SocialTimelineEvent, type SocialRisk, type SocialAiSummary,
    type RelationshipGraph as RelationshipGraphData
} from '../../../services/api';

const STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'All Statuses' },
    { value: 'FOUND', label: 'Found' },
    { value: 'NOT_FOUND', label: 'Not Found' },
    { value: 'UNKNOWN', label: 'Unknown' },
    { value: 'BLOCKED', label: 'Blocked' },
    { value: 'RATE_LIMITED', label: 'Rate Limited' },
    { value: 'ERROR', label: 'Error' }
];
const CONFIDENCE_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'All Confidence' },
    { value: 'High', label: 'High' },
    { value: 'Medium', label: 'Medium' },
    { value: 'Low', label: 'Low' },
    { value: 'Unknown', label: 'Unknown' }
];

function StatusBadge({ status }: { status: string }) {
    const cls = status.toLowerCase().replace(/_/g, '-');
    return <span className={`smi-badge smi-badge--${cls}`}>{status.replace(/_/g, ' ')}</span>;
}
function ConfidenceBadge({ confidence }: { confidence: string }) {
    return <span className={`smi-badge smi-badge--conf-${confidence.toLowerCase()}`}>{confidence}</span>;
}
function InvestigationStatusBadge({ status }: { status: string }) {
    return <span className={`smi-inv-badge smi-inv-badge--${status}`}>{status.toUpperCase()}</span>;
}
function ToolStatusBadge({ status }: { status: string }) {
    const label = status === 'completed' ? 'Completed' : status === 'unavailable' ? 'Unavailable' : 'Error';
    return <span className={`smi-tool-badge smi-tool-badge--${status}`}>{label}</span>;
}

function ProfileStatusBadge({ status }: { status: string }) {
    const cls = status.toLowerCase().replace(/_/g, '-');
    const label = status === 'NOT_APPLICABLE' ? 'Not Analyzed' : status.charAt(0) + status.slice(1).toLowerCase();
    return <span className={`smi-profile-badge smi-profile-badge--${cls}`}>{label}</span>;
}

function SignalList({ signals }: { signals: SocialCorrelationSignal[] }) {
    return (
        <ul className="smi-signal-list">
            {signals.map((s, i) => (
                <li key={i}>
                    ✓ {s.label} <span className={`smi-strength-badge smi-strength-badge--${s.strength.toLowerCase()}`}>{s.strength}</span>
                </li>
            ))}
        </ul>
    );
}

interface SocialMediaIntelligenceHomeProps {
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    prefillValue?: string;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
}

const SocialMediaIntelligenceHome: React.FC<SocialMediaIntelligenceHomeProps> = ({ onNavigateToModule, prefillValue, onOpenKnowledgeEntry, onCreateKnowledgeEntry }) => {
    const [username, setUsername] = useState(prefillValue ?? '');
    const [investigating, setInvestigating] = useState(false);
    const [investigateError, setInvestigateError] = useState<string | null>(null);
    const [recent, setRecent] = useState<SocialInvestigation[]>([]);
    const [recentLoading, setRecentLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [toolHealth, setToolHealth] = useState<SocialToolHealth | null>(null);
    const [healthLoading, setHealthLoading] = useState(true);

    const loadHealth = useCallback((refresh = false) => {
        setHealthLoading(true);
        getSocialToolHealth(refresh)
            .then(setToolHealth)
            .catch(() => setToolHealth(null))
            .finally(() => setHealthLoading(false));
    }, []);
    useEffect(() => { loadHealth(); }, [loadHealth]);

    const loadRecent = useCallback(() => {
        setRecentLoading(true);
        getSocialInvestigations({ pageSize: 20 })
            .then((res) => setRecent(res.items))
            .catch(() => {})
            .finally(() => setRecentLoading(false));
    }, []);
    useEffect(() => { loadRecent(); }, [loadRecent]);

    useEffect(() => {
        if (!prefillValue) return;
        setUsername(prefillValue);
        setSelectedId(null);
    }, [prefillValue]);

    const [targetType, setTargetType] = useState<'username' | 'email' | 'phone'>('username');
    const derivedCandidate = useMemo(() => {
        if (targetType === 'email') return deriveUsernameFromEmail(username);
        if (targetType === 'phone') return deriveUsernameFromPhone(username);
        return null;
    }, [targetType, username]);

    const resolvedUsername = targetType === 'username' ? username.trim() : (derivedCandidate ?? '');

    const investigate = async () => {
        if (!resolvedUsername) return;
        setInvestigating(true); setInvestigateError(null);
        try {
            const result = await runSocialInvestigation(resolvedUsername);
            setSelectedId(result.investigationId);
            setUsername('');
            setTargetType('username');
            loadRecent();
        } catch (err: any) {
            setInvestigateError(err?.message || 'Failed to run investigation.');
        } finally {
            setInvestigating(false);
        }
    };

    if (selectedId != null) {
        return <InvestigationDetail investigationId={selectedId} onBack={() => { setSelectedId(null); loadRecent(); }} onNavigateToModule={onNavigateToModule} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />;
    }

    return (
        <div className="smi-page">
            <div className="input-section">
                <h2>Social Media Intelligence</h2>
                <p className="osint-subtitle">Discover and investigate publicly accessible social media profiles and online identities.</p>
                <div className="search-box search-box--social">
                    <label className="phone-cc" aria-label="Target type">
                        <span className="sr-only">Target type</span>
                        <select
                            className="phone-cc-select" value={targetType}
                            onChange={(e) => { setTargetType(e.target.value as 'username' | 'email' | 'phone'); setInvestigateError(null); }}
                            aria-label="Target type" disabled={investigating}
                        >
                            <option value="username">Username</option>
                            <option value="email">Email</option>
                            <option value="phone">Phone</option>
                        </select>
                    </label>
                    <input
                        type="text"
                        placeholder={targetType === 'email' ? 'name@example.com' : targetType === 'phone' ? '+1 555 123 4567' : 'username_here'}
                        value={username}
                        aria-label={targetType === 'email' ? 'Email to derive a candidate username from' : targetType === 'phone' ? 'Phone number to derive a candidate username from' : 'Username to investigate'}
                        onChange={(e) => { setUsername(e.target.value); setInvestigateError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && investigate()}
                        disabled={investigating}
                    />
                    <button type="button" onClick={investigate} disabled={investigating || !resolvedUsername} aria-busy={investigating}>
                        {investigating ? 'Running Account Discovery…' : 'Investigate'}
                    </button>
                </div>
                {targetType !== 'username' && username.trim() && (
                    <div className="input-helper" role="note">
                        {derivedCandidate
                            ? `Will search for candidate username: ${derivedCandidate}`
                            : `No usable username candidate could be derived from this ${targetType}.`}
                    </div>
                )}
                {investigating && (
                    <div className="input-helper" role="note">Running Account Discovery — checking Maigret, Sherlock, Social Analyzer…</div>
                )}
                {investigateError && <div className="error-message" role="alert">{investigateError}</div>}
            </div>

            <div className="smi-card">
                <div className="smi-card-title">
                    Discovery Engines
                    <button
                        type="button" className="smi-btn smi-btn--sm" style={{ marginLeft: 'auto' }}
                        onClick={() => loadHealth(true)} disabled={healthLoading}
                    >
                        {healthLoading ? 'Checking…' : 'Re-check'}
                    </button>
                </div>
                {healthLoading && !toolHealth && <div className="smi-loading">Checking discovery engines…</div>}
                {!healthLoading && !toolHealth && (
                    <div className="smi-signal-note">Engine readiness could not be determined.</div>
                )}
                {toolHealth && (
                    <>
                        <div className="smi-tools-row">
                            {toolHealth.tools.map((t) => (
                                <div key={t.tool} className="smi-tool-chip">
                                    <span className="smi-tool-chip-name">{t.tool}</span>
                                    <span className={`smi-strength-badge smi-strength-badge--${t.available ? 'strong' : 'weak'}`}>
                                        {t.state === 'AVAILABLE' ? 'Available' : t.state === 'ERROR' ? 'Error' : 'Unavailable'}
                                    </span>
                                    {t.version && <span className="smi-tool-chip-reason">v{t.version}</span>}
                                    {t.reason && <span className="smi-tool-chip-reason" title={t.reason}>{t.reason}</span>}
                                </div>
                            ))}
                        </div>
                        <div className="smi-summary">
                            <div className="smi-summary-card"><span className="smi-summary-label">Tools Available</span><span className="smi-summary-value">{toolHealth.toolsAvailable}</span></div>
                            <div className="smi-summary-card"><span className="smi-summary-label">Tools Failed</span><span className="smi-summary-value">{toolHealth.toolsFailed}</span></div>
                        </div>
                        {toolHealth.toolsAvailable === 0 && (
                            <div className="smi-signal-note" role="alert">
                                No discovery engine is currently executable, so an investigation cannot search for accounts.
                                This is not the same as finding no accounts. See docs/SOCIAL_MEDIA_TOOLS.md for setup.
                            </div>
                        )}
                    </>
                )}
            </div>

            <div className="smi-card">
                <div className="smi-card-title">Recent Investigations</div>
                {recentLoading ? (
                    <div className="smi-loading">Loading…</div>
                ) : recent.length === 0 ? (
                    <div className="smi-empty">Enter a username to begin social media discovery.</div>
                ) : (
                    <div className="smi-list">
                        {recent.map((inv) => (
                            <div key={inv.id} className="smi-inv-row" onClick={() => setSelectedId(inv.id)}>
                                <div>
                                    <div className="smi-inv-row-target">{inv.target}</div>
                                    <div className="smi-inv-row-meta">{inv.createdAt ? timeAgo(inv.createdAt) : ''}{inv.ownerUsername ? ` · ${inv.ownerUsername}` : ''}</div>
                                </div>
                                <InvestigationStatusBadge status={inv.status} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface Phase2State {
    links: SocialProfileLink[];
    correlations: SocialCorrelation[];
    dorks: SocialDorkQuery[];
    evidence: SocialEvidence[];
}

const INVESTIGATION_PILLARS: PillarSubnavItem[] = [
    { id: 'overview', label: 'Overview', icon: <Info size={16} /> },
    { id: 'correlations', label: 'Correlations', icon: <Fingerprint size={16} /> },
    { id: 'graph', label: 'Identity Graph', icon: <Network size={16} /> },
    { id: 'images', label: 'Image Correlation', icon: <ImageIcon size={16} /> },
    { id: 'search', label: 'Search Discovery', icon: <Search size={16} /> },
    { id: 'threat', label: 'Threat Context', icon: <ShieldAlert size={16} /> },
    { id: 'risk', label: 'Risk', icon: <Gauge size={16} /> },
    { id: 'timeline', label: 'Timeline', icon: <Clock size={16} /> },
    { id: 'evidence', label: 'Evidence', icon: <FileText size={16} /> },
    { id: 'ai', label: 'AI Summary', icon: <Sparkles size={16} /> }
];

function InvestigationDetail({ investigationId, onBack, onNavigateToModule, onOpenKnowledgeEntry, onCreateKnowledgeEntry }: {
    investigationId: number; onBack: () => void; onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
}) {
    const [investigation, setInvestigation] = useState<SocialInvestigation | null>(null);
    const [accounts, setAccounts] = useState<SocialAccountResult[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [search, setSearch] = useState('');
    const [platformFilter, setPlatformFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [confidenceFilter, setConfidenceFilter] = useState('');
    const [phase2, setPhase2] = useState<Phase2State>({ links: [], correlations: [], dorks: [], evidence: [] });
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [profileJob, setProfileJob] = useState<SocialProfileJob | null>(null);
    const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
    const [activePillar, setActivePillar] = useState('overview');
    const [resultView, setResultView] = useState<'pretty' | 'raw'>('pretty');
    const [deepAnalyzing, setDeepAnalyzing] = useState(false);
    const [deepAnalyzeError, setDeepAnalyzeError] = useState<string | null>(null);
    const [deepAnalysisJob, setDeepAnalysisJob] = useState<SocialDeepAnalysisJob | null>(null);
    const [images, setImages] = useState<SocialProfileImage[]>([]);
    const [imageMatches, setImageMatches] = useState<SocialImageMatch[]>([]);
    const [imagesLoaded, setImagesLoaded] = useState(false);
    const [graph, setGraph] = useState<RelationshipGraphData | null>(null);
    const [dorkResults, setDorkResults] = useState<SocialDorkResult[]>([]);
    const [dorkCapability, setDorkCapability] = useState<SocialGoogleDorkingCapability | null>(null);
    const [dorkForm, setDorkForm] = useState({ query: '', category: '', resultUrl: '', title: '', snippet: '' });
    const [savingDork, setSavingDork] = useState(false);
    const [threatContext, setThreatContext] = useState<{ observablesChecked: number; matches: SocialThreatMatch[] } | null>(null);
    const [timeline, setTimeline] = useState<SocialTimelineEvent[]>([]);
    const [risk, setRisk] = useState<SocialRisk | null>(null);
    const [aiSummary, setAiSummary] = useState<SocialAiSummary | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [loadedTabs, setLoadedTabs] = useState<Set<string>>(new Set());

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getSocialInvestigationResults(investigationId, { search: search || undefined, platform: platformFilter || undefined, status: statusFilter || undefined, source: sourceFilter || undefined, confidence: confidenceFilter || undefined })
            .then((res) => { setInvestigation(res.investigation); setAccounts(res.accounts); })
            .catch((err) => setError(err?.message || 'Failed to load investigation'))
            .finally(() => setLoading(false));
    }, [investigationId, search, platformFilter, statusFilter, sourceFilter, confidenceFilter]);
    useEffect(() => { load(); }, [load]);

    const loadPhase2 = useCallback(() => {
        Promise.all([
            getSocialInvestigationLinks(investigationId).catch(() => []),
            getSocialInvestigationCorrelations(investigationId).catch(() => []),
            getSocialInvestigationDorks(investigationId).catch(() => []),
            getSocialInvestigationEvidence(investigationId).catch(() => [])
        ]).then(([links, correlations, dorks, evidence]) => setPhase2({ links, correlations, dorks, evidence }));
    }, [investigationId]);
    useEffect(() => { loadPhase2(); }, [loadPhase2]);

    useEffect(() => {
        if (investigation?.status !== 'running') return;
        const t = setTimeout(load, 3000);
        return () => clearTimeout(t);
    }, [investigation?.status, load]);

    useEffect(() => {
        let cancelled = false;
        getLatestSocialProfileJob(investigationId)
            .then((job) => {
                if (cancelled || !job) return;
                setProfileJob(job);
                if (job.status === 'queued' || job.status === 'running') setAnalyzing(true);
            })
            .catch(() => { /* absence of a job is not an error */ });
        return () => { cancelled = true; };
    }, [investigationId]);

    useEffect(() => {
        if (!profileJob || !['queued', 'running'].includes(profileJob.status)) return;
        const t = setTimeout(() => {
            getSocialProfileJob(profileJob.id)
                .then((job) => {
                    setProfileJob(job);
                    if (!['queued', 'running'].includes(job.status)) {
                        setAnalyzing(false);
                        if (job.status === 'failed' && job.lastError) setAnalyzeError(job.lastError);
                        load();
                        loadPhase2();
                    }
                })
                .catch(() => { /* keep the last known state; a poll failure is not a job failure */ });
        }, 2000);
        return () => clearTimeout(t);
    }, [profileJob, load, loadPhase2]);

    const runAnalyzeProfiles = async () => {
        setAnalyzing(true); setAnalyzeError(null);
        try {
            const { jobId } = await analyzeSocialProfiles(investigationId);
            setProfileJob(await getSocialProfileJob(jobId));
        } catch (err: any) {
            setAnalyzeError(err?.message || 'Failed to queue profile analysis.');
            setAnalyzing(false);
        }
    };

    const cancelAnalyzeProfiles = async () => {
        if (!profileJob) return;
        try {
            await cancelSocialProfileJob(profileJob.id);
        } catch (err: any) {
            setAnalyzeError(err?.message || 'Failed to cancel profile analysis.');
        }
    };

    useEffect(() => {
        let cancelled = false;
        getLatestSocialDeepAnalysisJob(investigationId)
            .then((job) => {
                if (cancelled || !job) return;
                setDeepAnalysisJob(job);
                if (job.status === 'queued' || job.status === 'running') setDeepAnalyzing(true);
            })
            .catch(() => { /* absence of a job is not an error */ });
        return () => { cancelled = true; };
    }, [investigationId]);

    useEffect(() => {
        if (!deepAnalysisJob || !['queued', 'running'].includes(deepAnalysisJob.status)) return;
        const t = setTimeout(() => {
            getSocialDeepAnalysisJob(deepAnalysisJob.id)
                .then((job) => {
                    setDeepAnalysisJob(job);
                    if (!['queued', 'running'].includes(job.status)) {
                        setDeepAnalyzing(false);
                        if (job.status === 'failed' && job.lastError) setDeepAnalyzeError(job.lastError);
                        setImagesLoaded(false);
                        setLoadedTabs((s) => { const next = new Set(s); next.delete('images'); next.delete('threat'); next.delete('graph'); next.delete('risk'); return next; });
                        if (activePillar === 'images') loadTab('images');
                        if (activePillar === 'threat') loadTab('threat');
                        if (activePillar === 'graph') loadTab('graph');
                        if (activePillar === 'risk') loadTab('risk');
                        loadPhase2();
                    }
                })
                .catch(() => { /* keep the last known state; a poll failure is not a job failure */ });
        }, 2000);
        return () => clearTimeout(t);
    }, [deepAnalysisJob, activePillar]);

    const runDeepAnalysis = async () => {
        setDeepAnalyzing(true); setDeepAnalyzeError(null);
        try {
            const { jobId } = await runSocialDeepAnalysis(investigationId);
            setDeepAnalysisJob(await getSocialDeepAnalysisJob(jobId));
        } catch (err: any) {
            setDeepAnalyzeError(err?.message || 'Failed to queue deep analysis.');
            setDeepAnalyzing(false);
        }
    };

    const cancelDeepAnalysis = async () => {
        if (!deepAnalysisJob) return;
        try {
            await cancelSocialDeepAnalysisJob(deepAnalysisJob.id);
        } catch (err: any) {
            setDeepAnalyzeError(err?.message || 'Failed to cancel deep analysis.');
        }
    };

    const loadTab = useCallback((tab: string) => {
        switch (tab) {
            case 'graph':
                getRelationshipGraph('social_investigation', investigationId).then(setGraph).catch(() => setGraph({ nodes: [], edges: [], truncated: false }));
                break;
            case 'images':
                Promise.all([getSocialInvestigationImages(investigationId), getSocialInvestigationImageMatches(investigationId)])
                    .then(([imgs, matches]) => { setImages(imgs); setImageMatches(matches); setImagesLoaded(true); })
                    .catch(() => setImagesLoaded(true));
                break;
            case 'search':
                Promise.all([getSocialInvestigationDorkResults(investigationId), getSocialGoogleDorkingCapability()])
                    .then(([results, cap]) => { setDorkResults(results); setDorkCapability(cap); })
                    .catch(() => {});
                break;
            case 'threat':
                getSocialInvestigationThreatContext(investigationId).then(setThreatContext).catch(() => {});
                break;
            case 'risk':
                getSocialInvestigationRisk(investigationId).then(setRisk).catch(() => {});
                break;
            case 'timeline':
                getSocialInvestigationTimeline(investigationId).then((res) => setTimeline(res.items)).catch(() => {});
                break;
            default:
                break;
        }
        setLoadedTabs((s) => new Set(s).add(tab));
    }, [investigationId]);

    useEffect(() => {
        if (!loadedTabs.has(activePillar)) loadTab(activePillar);
    }, [activePillar]);

    const runAiSummary = () => {
        setAiLoading(true); setAiError(null);
        getSocialInvestigationAiSummary(investigationId)
            .then(setAiSummary)
            .catch((err) => setAiError(err?.message || 'Failed to generate AI summary.'))
            .finally(() => setAiLoading(false));
    };

    const exportResults = (format: 'json' | 'csv') => {
        if (!investigation) return;
        const combined = { investigation, accounts, links: phase2.links, correlations: phase2.correlations, dorks: phase2.dorks, evidence: phase2.evidence };
        let blob: Blob;
        const filename = `social_media_intel_${investigation.target}.${format}`;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(combined, null, 2)], { type: 'application/json' });
        } else {
            const headers = 'Platform,Username,Status,Confidence,ProfileURL\n';
            const rows = accounts.map((a) => `${a.platform},${a.username},${a.status},${a.confidence},${a.profileUrl || ''}`).join('\n');
            blob = new Blob([headers + rows], { type: 'text/csv' });
        }
        downloadBlob(blob, filename);
    };

    const saveDorkResult = async () => {
        if (!dorkForm.resultUrl.trim()) return;
        setSavingDork(true);
        try {
            const saved = await saveSocialDorkResult(investigationId, {
                query: dorkForm.query || undefined, category: dorkForm.category || undefined,
                resultUrl: dorkForm.resultUrl.trim(), title: dorkForm.title || undefined, snippet: dorkForm.snippet || undefined
            });
            setDorkResults((s) => [saved, ...s]);
            setDorkForm({ query: '', category: '', resultUrl: '', title: '', snippet: '' });
        } catch { /* best-effort, mirrors the rest of this page's save actions */ }
        finally { setSavingDork(false); }
    };

    if (loading && !investigation) return <div className="smi-page"><div className="smi-loading">Loading investigation…</div></div>;
    if (error || !investigation) return (
        <div className="smi-page"><div className="smi-error">{error || 'Investigation not found'}<button type="button" className="smi-btn smi-btn--sm" onClick={onBack}>Back</button></div></div>
    );

    if (selectedAccountId != null) {
        const account = accounts.find((a) => a.id === selectedAccountId);
        if (account) {
            return (
                <AccountDetail
                    account={account} allAccounts={accounts} links={phase2.links} correlations={phase2.correlations}
                    dorks={phase2.dorks} evidence={phase2.evidence}
                    onBack={() => setSelectedAccountId(null)}
                    onSelectAccount={(id) => setSelectedAccountId(id)}
                    onNavigateToModule={onNavigateToModule}
                    onSaveEvidence={async (payload) => { await addSocialInvestigationEvidence(investigationId, payload); loadPhase2(); }}
                    onAddObservable={async (type, value) => { await addSocialObservable(investigationId, type, value); }}
                />
            );
        }
    }

    const platforms = Array.from(new Set(accounts.map((a) => a.platform))).sort();
    const allSources = Array.from(new Set(investigation.tools.map((t) => t.tool)));
    const hasAnyFilter = !!(search || platformFilter || statusFilter || sourceFilter || confidenceFilter);
    const nonNotFoundExists = accounts.some((a) => a.status !== 'NOT_FOUND');
    const foundCount = accounts.filter((a) => a.status === 'FOUND').length;
    const analyzedCount = accounts.filter((a) => a.profile && a.profile.status !== 'NOT_APPLICABLE').length;

    const combinedData = { investigation, accounts, links: phase2.links, correlations: phase2.correlations, dorks: phase2.dorks, evidence: phase2.evidence };

    return (
        <div className="smi-page">
            <div className="result-display" aria-live="polite">
                <div className="result-header-row">
                    <div className="result-header-main">
                        <button type="button" className="smi-btn smi-btn--sm" onClick={onBack} style={{ marginBottom: '10px' }}>‹ All Investigations</button>
                        <div className="result-heading">
                            <h3 className="result-section-title">Social Media Intelligence Overview</h3>
                            <p className="result-section-subtitle">
                                Analyst-ready summary for {investigation.target}
                                {investigation.completedAt ? ` · completed ${timeAgo(investigation.completedAt)}` : ''}
                            </p>
                        </div>
                        <InvestigationStatusBadge status={investigation.status} />
                    </div>
                    <div className="result-header-actions">
                        <div className="result-view-toggle" role="group" aria-label="Result view mode">
                            <button type="button" className={`result-view-btn ${resultView === 'pretty' ? 'active' : ''}`} aria-pressed={resultView === 'pretty'} onClick={() => setResultView('pretty')}>Pretty</button>
                            <button type="button" className={`result-view-btn ${resultView === 'raw' ? 'active' : ''}`} aria-pressed={resultView === 'raw'} onClick={() => setResultView('raw')}>Raw JSON</button>
                        </div>
                        <div className="export-actions">
                            <button onClick={() => exportResults('json')} className="export-btn" aria-label="Download results as JSON">Download JSON</button>
                            <button onClick={() => exportResults('csv')} className="export-btn" aria-label="Download results as CSV">Download CSV</button>
                        </div>
                    </div>
                </div>

                <div className="result-body-scroll">
                {resultView === 'raw' ? (
                    <JsonViewer value={combinedData} mode="code" />
                ) : (
                <div className="ei-layout">
                <PillarSubnav pillars={INVESTIGATION_PILLARS} activeId={activePillar} onSelect={setActivePillar} ariaLabel="Social media investigation sections" />
                <div className="ei-tab-content">

            {activePillar === 'overview' && (
                <>
                    {/* §12 Investigation Overview */}
                    <div className="smi-card">
                        <div className="smi-card-title">Investigation Overview</div>
                        <div className="smi-overview-grid">
                            <div className="smi-kv"><span className="k">Target</span><span className="v">{investigation.target}</span></div>
                            <div className="smi-kv"><span className="k">Investigation Status</span><span className="v"><InvestigationStatusBadge status={investigation.status} /></span></div>
                        </div>
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead>
                                    <tr>
                                        <th>Discovery Engine</th><th>Status</th><th>Results</th><th>Duration</th><th>Detail</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {investigation.tools.map((t: SocialToolOutcome) => (
                                        <tr key={t.tool}>
                                            <td data-label="Discovery Engine">{t.tool}</td>
                                            <td data-label="Status"><ToolStatusBadge status={t.status} /></td>
                                            <td data-label="Results">{t.resultCount ?? '—'}</td>
                                            <td data-label="Duration">{typeof t.durationMs === 'number' ? `${(t.durationMs / 1000).toFixed(1)}s` : '—'}</td>
                                            <td data-label="Detail">{t.reason || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <SummaryCounters accounts={accounts} tools={investigation.tools} />
                    </div>

                    {/* KNOWLEDGE_BASE_PHASE2.md §9/§17 "KNOWLEDGE TO INVESTIGATION" / "KNOWLEDGE TO SOCIAL MEDIA" */}
                    <KnowledgeContextPanel entityType="social_investigation" entityId={investigation.id} entityLabel={investigation.target} defaultCategory="Social Media"
                        onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />

                    <div className="smi-card">
                        <div className="smi-card-title">Profile Analysis</div>
                        <p className="smi-muted">
                            Analyze every discovered account's public profile — display name, bio, links, and identity signals — where the platform supports it.
                            {foundCount > 0 ? ` ${analyzedCount} of ${foundCount} found account(s) analyzed.` : ' No accounts found yet.'}
                        </p>
                        <div className="smi-btn-row">
                            <button type="button" className="smi-btn smi-btn--primary" onClick={runAnalyzeProfiles} disabled={analyzing || foundCount === 0}>
                                {analyzing ? 'Analyzing Profiles…' : 'Analyze Profiles'}
                            </button>
                            {analyzing && profileJob && (
                                <button type="button" className="smi-btn" onClick={cancelAnalyzeProfiles} disabled={profileJob.cancelRequested}>
                                    {profileJob.cancelRequested ? 'Cancelling…' : 'Cancel'}
                                </button>
                            )}
                            <button type="button" className="smi-btn" onClick={runDeepAnalysis} disabled={deepAnalyzing || analyzedCount === 0} title="Image correlation and threat intelligence correlation — run after Profile Analysis">
                                {deepAnalyzing ? 'Running Deep Analysis…' : 'Run Deep Analysis'}
                            </button>
                            {deepAnalyzing && deepAnalysisJob && (
                                <button type="button" className="smi-btn" onClick={cancelDeepAnalysis} disabled={deepAnalysisJob.cancelRequested}>
                                    {deepAnalysisJob.cancelRequested ? 'Cancelling…' : 'Cancel'}
                                </button>
                            )}
                        </div>

                        {deepAnalysisJob && ['queued', 'running'].includes(deepAnalysisJob.status) && (
                            <div className="smi-signal-note" style={{ marginTop: '10px' }} role="status">
                                {deepAnalysisJob.status === 'queued'
                                    ? 'Queued — waiting for the deep analysis worker…'
                                    : deepAnalysisJob.stage === 'image_analysis'
                                        ? `Image Correlation: ${deepAnalysisJob.processedAvatars} / ${deepAnalysisJob.totalAvatars} avatars`
                                        : deepAnalysisJob.stage === 'correlating' ? 'Advanced Correlation: strengthening signal-bearing relationships…'
                                        : deepAnalysisJob.stage === 'threat_enrichment' ? 'Threat Enrichment: checking known indicators…'
                                        : 'Finalizing: recording evidence…'}
                            </div>
                        )}
                        {deepAnalysisJob?.summary && !['queued', 'running'].includes(deepAnalysisJob.status) && (
                            <div className="smi-summary" style={{ marginTop: '12px' }}>
                                <div className="smi-summary-card"><span className="smi-summary-label">Image Matches</span><span className="smi-summary-value">{deepAnalysisJob.summary.imageMatches}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Correlations Strengthened</span><span className="smi-summary-value">{deepAnalysisJob.summary.correlationsFolded}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Threat Matches</span><span className="smi-summary-value">{deepAnalysisJob.summary.threatMatches}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Evidence Recorded</span><span className="smi-summary-value">{deepAnalysisJob.summary.evidenceCreated}</span></div>
                            </div>
                        )}
                        {deepAnalysisJob?.status === 'cancelled' && (
                            <div className="smi-signal-note">Cancelled — results computed before cancellation were kept.</div>
                        )}

                        {profileJob && ['queued', 'running'].includes(profileJob.status) && (
                            <div className="smi-signal-note" style={{ marginTop: '10px' }} role="status">
                                {profileJob.status === 'queued'
                                    ? 'Queued — waiting for the analysis worker…'
                                    : `Profiles: ${profileJob.processedAccounts} / ${profileJob.totalAccounts}`}
                                {profileJob.currentPlatform ? ` · Current: ${profileJob.currentPlatform}` : ''}
                            </div>
                        )}

                        {profileJob?.summary && !['queued', 'running'].includes(profileJob.status) && (
                            <>
                                <div className="smi-summary" style={{ marginTop: '12px' }}>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Accounts</span><span className="smi-summary-value">{profileJob.summary.totalAccounts}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Analyzed</span><span className="smi-summary-value">{profileJob.summary.analyzed}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Partial</span><span className="smi-summary-value">{profileJob.summary.partial}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Blocked</span><span className="smi-summary-value">{profileJob.summary.blocked}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Rate Limited</span><span className="smi-summary-value">{profileJob.summary.rateLimited}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Unavailable</span><span className="smi-summary-value">{profileJob.summary.unavailable}</span></div>
                                    <div className="smi-summary-card"><span className="smi-summary-label">Platforms Processed</span><span className="smi-summary-value">{profileJob.summary.platformsProcessed}</span></div>
                                </div>
                                {profileJob.status === 'partial' && (
                                    <div className="smi-signal-note">
                                        Some platforms were blocked, rate limited, or expose no public profile data. Every successful profile above is still available (partial results are kept).
                                    </div>
                                )}
                                {profileJob.status === 'cancelled' && (
                                    <div className="smi-signal-note">Cancelled — profiles analyzed before cancellation were kept.</div>
                                )}
                            </>
                        )}

                        {analyzeError && <div className="smi-error" style={{ marginTop: '10px' }}>{analyzeError}</div>}
                        {deepAnalyzeError && <div className="smi-error" style={{ marginTop: '10px' }}>{deepAnalyzeError}</div>}
                    </div>

                    <div className="smi-card">
                        <div className="smi-card-title">Account Discovery Results <span className="smi-card-title-count">{accounts.length}</span></div>
                        <div className="smi-filters">
                            <input type="text" placeholder="Search platform, username, URL, status…" value={search} onChange={(e) => setSearch(e.target.value)} />
                            <select value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}>
                                <option value="">All Platforms</option>
                                {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
                            </select>
                            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                            <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
                                <option value="">All Sources</option>
                                {allSources.map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                            <select value={confidenceFilter} onChange={(e) => setConfidenceFilter(e.target.value)}>
                                {CONFIDENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                            </select>
                        </div>

                        {loading ? (
                            <div className="smi-loading">Loading results…</div>
                        ) : accounts.length === 0 ? (
                            <div className="smi-empty">
                                {hasAnyFilter
                                    ? 'No results match the current filters.'
                                    : investigation.status === 'failed'
                                        ? 'No accounts could be verified. Some platforms may have blocked, limited, or unavailable responses.'
                                        : 'No confirmed accounts found.'}
                            </div>
                        ) : !hasAnyFilter && !nonNotFoundExists ? (
                            <div className="smi-empty">No confirmed accounts found. {accounts.length} platform(s) checked, none matched.</div>
                        ) : (
                            <div className="smi-table-wrap">
                                <table className="smi-table">
                                    <thead><tr><th>Platform</th><th>Username</th><th>Profile</th><th>Status</th><th>Analysis</th><th>Source</th><th>Confidence</th><th>Detected</th><th></th></tr></thead>
                                    <tbody>
                                        {accounts.map((a) => (
                                            <tr key={a.id}>
                                                <td data-label="Platform">{a.platform}</td>
                                                <td data-label="Username" className="smi-mono">{a.username}</td>
                                                <td data-label="Profile">{a.profileUrl ? <a href={a.profileUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">Open Profile ↗</a> : '—'}</td>
                                                <td data-label="Status"><StatusBadge status={a.status} /></td>
                                                <td data-label="Analysis">{a.profile ? <ProfileStatusBadge status={a.profile.status} /> : '—'}</td>
                                                <td data-label="Source">{a.sources.join(' + ')}</td>
                                                <td data-label="Confidence"><ConfidenceBadge confidence={a.confidence} /></td>
                                                <td data-label="Detected">{a.detectedAt ? timeAgo(a.detectedAt) : '—'}</td>
                                                <td data-label="Action">
                                                    {a.status === 'FOUND' && <button type="button" className="smi-btn smi-btn--sm" onClick={() => setSelectedAccountId(a.id)}>Details</button>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}

            {activePillar === 'correlations' && (
                <div className="smi-card">
                    <div className="smi-card-title">Identity Correlation <span className="smi-card-title-count">{phase2.correlations.length}</span></div>
                    {phase2.correlations.length === 0 ? (
                        <div className="smi-empty">No correlations identified yet. Run "Analyze Profiles" from the Overview tab.</div>
                    ) : (
                        <div className="smi-correlation-list">
                            {phase2.correlations.map((c) => (
                                <div key={c.id} className="smi-correlation-card">
                                    <div className="smi-correlation-header">
                                        <button type="button" className="smi-link-btn" onClick={() => setSelectedAccountId(c.accountA.id)}>{c.accountA.platform} / {c.accountA.username}</button>
                                        <span className="smi-correlation-arrow">↔</span>
                                        <button type="button" className="smi-link-btn" onClick={() => setSelectedAccountId(c.accountB.id)}>{c.accountB.platform} / {c.accountB.username}</button>
                                        <ConfidenceBadge confidence={c.confidence} />
                                    </div>
                                    <div className="smi-correlation-label">{c.relationshipLabel}</div>
                                    <SignalList signals={c.signals} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {activePillar === 'graph' && (
                <div className="smi-card">
                    {!graph || graph.nodes.length === 0 ? (
                        <div className="smi-empty">No relationships recorded yet. Run "Analyze Profiles" and "Run Deep Analysis" from the Overview tab to build the identity graph.</div>
                    ) : (
                        <RelationshipGraphViz data={graph} onNodeOpen={(type, id) => {
                            if (type === 'social_account') setSelectedAccountId(Number(id));
                        }} />
                    )}
                </div>
            )}

            {activePillar === 'images' && (
                <div className="smi-card">
                    <div className="smi-card-subtitle">Discovered Avatars</div>
                    {!imagesLoaded ? (
                        <div className="smi-loading">Loading…</div>
                    ) : images.length === 0 ? (
                        <div className="smi-empty">No avatars checked yet. Run "Run Deep Analysis" from the Overview tab.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Account</th><th>Status</th><th>Hash (SHA256)</th><th></th></tr></thead>
                                <tbody>
                                    {images.map((img) => {
                                        const acct = accounts.find((a) => a.id === img.accountId);
                                        return (
                                            <tr key={img.id}>
                                                <td data-label="Account">{acct ? `${acct.platform} / ${acct.username}` : `#${img.accountId}`}</td>
                                                <td data-label="Status">{img.status === 'HASHED' ? 'Hashed' : img.status === 'UNAVAILABLE' ? 'Unavailable' : 'Not Available'}</td>
                                                <td data-label="Hash" className="smi-mono">{img.hashes.sha256 ? `${img.hashes.sha256.slice(0, 16)}…` : '—'}</td>
                                                <td data-label="Action">{img.imageUrl && <a className="smi-btn smi-btn--sm" href={img.imageUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">View ↗</a>}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <div className="smi-card-subtitle">Potential Profile Image Matches</div>
                    {imageMatches.length === 0 ? (
                        <div className="smi-empty">No potential image matches found.</div>
                    ) : (
                        <div className="smi-correlation-list">
                            {imageMatches.map((m, i) => {
                                const accA = accounts.find((a) => a.id === m.accountAId);
                                const accB = accounts.find((a) => a.id === m.accountBId);
                                return (
                                    <div key={i} className="smi-correlation-card">
                                        <div className="smi-correlation-header">
                                            <span>{accA ? `${accA.platform} / ${accA.username}` : `#${m.accountAId}`}</span>
                                            <span className="smi-correlation-arrow">↔</span>
                                            <span>{accB ? `${accB.platform} / ${accB.username}` : `#${m.accountBId}`}</span>
                                            <span title="Confidence in the image match itself — not an identity confidence">
                                                <ConfidenceBadge confidence={m.confidence} />
                                            </span>
                                        </div>
                                        <div className="smi-correlation-label">Potentially Reused Image — {m.similarity}% similarity ({m.method === 'sha256' ? 'exact match' : m.method}). This does not confirm the same person.</div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {activePillar === 'search' && (
                <div className="smi-card">
                    {dorkCapability && (
                        <p className="smi-muted">
                            Google Dorking: query generation <span className={`smi-strength-badge smi-strength-badge--${dorkCapability.queryGeneration === 'AVAILABLE' ? 'strong' : 'weak'}`}>{dorkCapability.queryGeneration === 'AVAILABLE' ? 'Available' : 'Not Configured'}</span>{' '}
                            · automated result retrieval <span className={`smi-strength-badge smi-strength-badge--${dorkCapability.automatedResultRetrieval === 'AVAILABLE' ? 'strong' : 'weak'}`}>{dorkCapability.automatedResultRetrieval === 'AVAILABLE' ? 'Available' : 'Not Configured'}</span>.
                            Open a generated query from an account's Search Discovery tab, then record what you find here.
                        </p>
                    )}
                    <div className="smi-card-subtitle">Record a Search Result</div>
                    <div className="smi-overview-grid">
                        <input type="text" placeholder="Result URL (required)" value={dorkForm.resultUrl} onChange={(e) => setDorkForm((f) => ({ ...f, resultUrl: e.target.value }))} />
                        <input type="text" placeholder="Query used" value={dorkForm.query} onChange={(e) => setDorkForm((f) => ({ ...f, query: e.target.value }))} />
                        <input type="text" placeholder="Title" value={dorkForm.title} onChange={(e) => setDorkForm((f) => ({ ...f, title: e.target.value }))} />
                        <input type="text" placeholder="Snippet" value={dorkForm.snippet} onChange={(e) => setDorkForm((f) => ({ ...f, snippet: e.target.value }))} />
                    </div>
                    <button type="button" className="smi-btn smi-btn--primary" style={{ marginTop: '10px' }} onClick={saveDorkResult} disabled={savingDork || !dorkForm.resultUrl.trim()}>
                        {savingDork ? 'Saving…' : 'Save Result'}
                    </button>

                    <div className="smi-card-subtitle">Saved Search Results <span className="smi-card-title-count">{dorkResults.length}</span></div>
                    {dorkResults.length === 0 ? (
                        <div className="smi-empty">No search results recorded yet.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Platform</th><th>Extracted Username</th><th>Result</th><th>Query</th><th>Recorded</th></tr></thead>
                                <tbody>
                                    {dorkResults.map((r, i) => (
                                        <tr key={r.id ?? i}>
                                            <td data-label="Platform">{r.platform || '—'}</td>
                                            <td data-label="Extracted Username" className="smi-mono">{r.extractedUsername || '—'}</td>
                                            <td data-label="Result"><a href={r.resultUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">{r.title || r.resultUrl} ↗</a></td>
                                            <td data-label="Query" className="smi-mono">{r.query || '—'}</td>
                                            <td data-label="Recorded">{r.retrievedAt ? timeAgo(r.retrievedAt) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activePillar === 'threat' && (
                <div className="smi-card">
                    {!threatContext ? (
                        <div className="smi-loading">Loading…</div>
                    ) : (
                        <>
                            <p className="smi-muted">{threatContext.observablesChecked} observable(s) checked against the existing indicator-of-compromise repository.</p>
                            {threatContext.matches.length === 0 ? (
                                <div className="smi-empty">No threat intelligence matches found.</div>
                            ) : (
                                <div className="smi-table-wrap">
                                    <table className="smi-table">
                                        <thead><tr><th>Type</th><th>Value</th><th>Risk</th></tr></thead>
                                        <tbody>
                                            {threatContext.matches.map((m) => (
                                                <tr key={m.id}>
                                                    <td data-label="Type">{m.type}</td>
                                                    <td data-label="Value" className="smi-mono">{m.value}</td>
                                                    <td data-label="Risk">{m.risk || 'Unknown'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}

            {activePillar === 'risk' && (
                <div className="smi-card">
                    {!risk ? (
                        <div className="smi-loading">Loading…</div>
                    ) : (
                        <>
                            <div className="smi-overview-grid">
                                <div className="smi-kv"><span className="k">Overall Risk</span><span className="v">{risk.level}</span></div>
                                <div className="smi-kv"><span className="k">Confidence</span><span className="v">{risk.confidence}</span></div>
                                <div className="smi-kv"><span className="k">Score</span><span className="v">{risk.score} / 100</span></div>
                            </div>
                            <div className="smi-card-subtitle">Reasons</div>
                            <ul className="smi-signal-list">{risk.reasons.map((r, i) => <li key={i}>✓ {r}</li>)}</ul>
                        </>
                    )}
                </div>
            )}

            {activePillar === 'timeline' && (
                <div className="smi-card">
                    {timeline.length === 0 ? (
                        <div className="smi-empty">No timeline events recorded yet.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>When</th><th>Event</th><th>Detail</th><th>Source</th></tr></thead>
                                <tbody>
                                    {timeline.map((e) => (
                                        <tr key={e.id}>
                                            <td data-label="When">{e.createdAt ? timeAgo(e.createdAt) : '—'}</td>
                                            <td data-label="Event" className="smi-mono">{e.action.replace(/_/g, ' ')}</td>
                                            <td data-label="Detail">{e.newValue || '—'}</td>
                                            <td data-label="Source">{e.source}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activePillar === 'evidence' && (
                <div className="smi-card">
                    {phase2.evidence.length === 0 ? (
                        <div className="smi-empty">No evidence saved for this investigation yet. Evidence can be saved from an account's Public Profile tab.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Source</th><th>Description</th><th>Saved By</th><th>When</th></tr></thead>
                                <tbody>
                                    {phase2.evidence.map((e) => (
                                        <tr key={e.id}>
                                            <td data-label="Source">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">{e.source} ↗</a> : e.source}</td>
                                            <td data-label="Description">{e.description || '—'}</td>
                                            <td data-label="Saved By">{e.username || '—'}</td>
                                            <td data-label="When">{e.created_at ? timeAgo(e.created_at) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activePillar === 'ai' && (
                <div className="smi-card">
                    {!aiSummary ? (
                        <>
                            <p className="smi-muted">Summarize this investigation's discovered accounts, correlations, and threat context using AI — an interpretation of the evidence above, never a new source of evidence.</p>
                            <button type="button" className="smi-btn smi-btn--primary" onClick={runAiSummary} disabled={aiLoading}>
                                {aiLoading ? 'Generating…' : 'Generate AI Summary'}
                            </button>
                            {aiError && <div className="smi-error" style={{ marginTop: '10px' }}>{aiError}</div>}
                        </>
                    ) : (
                        <>
                            <p>{aiSummary.executiveSummary}</p>
                            {aiSummary.note && <div className="smi-signal-note">{aiSummary.note}</div>}
                            <div className="smi-card-subtitle">Observed</div>
                            {aiSummary.observed.length === 0 ? <div className="smi-empty">None.</div> : <ul className="smi-signal-list">{aiSummary.observed.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>}
                            <div className="smi-card-subtitle">Correlated</div>
                            {aiSummary.correlated.length === 0 ? <div className="smi-empty">None.</div> : <ul className="smi-signal-list">{aiSummary.correlated.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>}
                            <div className="smi-card-subtitle">Inferred</div>
                            {aiSummary.inferred.length === 0 ? <div className="smi-empty">None.</div> : <ul className="smi-signal-list">{aiSummary.inferred.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>}
                            <div className="smi-card-subtitle">Threat Context</div>
                            {aiSummary.threatContext.length === 0 ? <div className="smi-empty">None.</div> : <ul className="smi-signal-list">{aiSummary.threatContext.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>}
                            <div className="smi-card-subtitle">Recommended Actions</div>
                            <ul className="smi-signal-list">{aiSummary.recommendedActions.map((s, i) => <li key={i}>✓ {s}</li>)}</ul>
                            <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '12px' }} onClick={runAiSummary} disabled={aiLoading}>{aiLoading ? 'Regenerating…' : 'Regenerate'}</button>
                        </>
                    )}
                </div>
            )}

                </div>
                </div>
                )}
                </div>
            </div>
        </div>
    );
}

function SummaryCounters({ accounts, tools }: { accounts: SocialAccountResult[]; tools: SocialToolOutcome[] }) {
    const summary: SocialInvestigationSummary = {
        platformsFound: accounts.filter((a) => a.status === 'FOUND').length,
        platformsNotFound: accounts.filter((a) => a.status === 'NOT_FOUND').length,
        unknown: accounts.filter((a) => a.status === 'UNKNOWN').length,
        errors: accounts.filter((a) => ['ERROR', 'BLOCKED', 'RATE_LIMITED'].includes(a.status)).length,
        toolsAvailable: tools.filter((t) => t.status === 'completed').length,
        toolsFailed: tools.filter((t) => t.status !== 'completed').length
    };
    return (
        <div className="smi-summary">
            <div className="smi-summary-card"><span className="smi-summary-label">Platforms Found</span><span className="smi-summary-value">{summary.platformsFound}</span></div>
            <div className="smi-summary-card"><span className="smi-summary-label">Not Found</span><span className="smi-summary-value">{summary.platformsNotFound}</span></div>
            <div className="smi-summary-card"><span className="smi-summary-label">Unknown</span><span className="smi-summary-value">{summary.unknown}</span></div>
            <div className="smi-summary-card"><span className="smi-summary-label">Errors</span><span className="smi-summary-value">{summary.errors}</span></div>
            <div className="smi-summary-card"><span className="smi-summary-label">Tools Available</span><span className="smi-summary-value">{summary.toolsAvailable}</span></div>
            <div className="smi-summary-card"><span className="smi-summary-label">Tools Failed</span><span className="smi-summary-value">{summary.toolsFailed}</span></div>
        </div>
    );
}

const ACCOUNT_PILLARS: PillarSubnavItem[] = [
    { id: 'overview', label: 'Overview', icon: <Info size={16} /> },
    { id: 'profile', label: 'Public Profile', icon: <UserCircle size={16} /> },
    { id: 'links', label: 'External Links', icon: <Link2 size={16} /> },
    { id: 'signals', label: 'Identity Signals', icon: <Fingerprint size={16} /> },
    { id: 'related', label: 'Related Accounts', icon: <Users size={16} /> },
    { id: 'domain', label: 'Domain Relationships', icon: <Globe2 size={16} /> },
    { id: 'company', label: 'Company Relationships', icon: <Building2 size={16} /> },
    { id: 'email', label: 'Email Signals', icon: <Mail size={16} /> },
    { id: 'search', label: 'Search Discovery', icon: <Search size={16} /> },
    { id: 'evidence', label: 'Evidence', icon: <FileText size={16} /> }
];

const DOMAIN_LINK_TYPES = ['Personal Website', 'Company Website', 'Repository'];

function AccountDetail({
    account, allAccounts, links, correlations, dorks, evidence, onBack, onSelectAccount, onNavigateToModule, onSaveEvidence, onAddObservable
}: {
    account: SocialAccountResult; allAccounts: SocialAccountResult[]; links: SocialProfileLink[]; correlations: SocialCorrelation[];
    dorks: SocialDorkQuery[]; evidence: SocialEvidence[]; onBack: () => void; onSelectAccount: (id: number) => void;
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    onSaveEvidence: (payload: { source: string; url?: string; description?: string; confidence?: string }) => Promise<void>;
    onAddObservable: (type: string, value: string) => Promise<void>;
}) {
    const [active, setActive] = useState('overview');
    const [savingEvidence, setSavingEvidence] = useState(false);
    const [addedObservables, setAddedObservables] = useState<Set<string>>(new Set());

    const accountLinks = useMemo(() => links.filter((l) => allAccounts.find((a) => a.id === account.id) && l.accountId === account.id), [links, account.id, allAccounts]);
    const accountCorrelations = useMemo(() => correlations.filter((c) => c.accountA.id === account.id || c.accountB.id === account.id), [correlations, account.id]);
    const domainLinks = useMemo(() => accountLinks.filter((l) => DOMAIN_LINK_TYPES.includes(l.linkType)), [accountLinks]);
    const sharedDisplayName = useMemo(() => {
        const name = account.profile?.displayName?.trim().toLowerCase();
        if (!name) return [] as SocialAccountResult[];
        return allAccounts.filter((a) => a.id !== account.id && a.profile?.displayName?.trim().toLowerCase() === name);
    }, [account, allAccounts]);
    const usernameVariants = useMemo(() => {
        const norm = (u: string) => u.toLowerCase().replace(/[^a-z0-9]/g, '');
        const mine = norm(account.username);
        return allAccounts.filter((a) => a.id !== account.id && a.status === 'FOUND' && a.username.toLowerCase() !== account.username.toLowerCase() && norm(a.username) === mine);
    }, [account, allAccounts]);

    const addObservable = async (type: string, value: string) => {
        const key = `${type}:${value}`;
        try { await onAddObservable(type, value); setAddedObservables((s) => new Set(s).add(key)); } catch { /* best-effort, mirrors Image Intelligence's own pattern */ }
    };
    const saveEvidence = async (source: string, url: string | undefined, description: string) => {
        setSavingEvidence(true);
        try { await onSaveEvidence({ source, url, description }); } finally { setSavingEvidence(false); }
    };

    return (
        <div className="smi-page">
            <div className="smi-header">
                <div className="smi-header-text">
                    <button type="button" className="smi-btn smi-btn--sm" onClick={onBack} style={{ marginBottom: '10px' }}>‹ Back to Results</button>
                    <h2>{account.platform} <span className="smi-mono">/ {account.username}</span></h2>
                    <p>Discovered via {account.sources.join(' + ')}</p>
                </div>
                <StatusBadge status={account.status} />
            </div>

            <div className="ei-layout">
            <PillarSubnav pillars={ACCOUNT_PILLARS} activeId={active} onSelect={setActive} ariaLabel="Social account detail sections" />
            <div className="ei-tab-content">

            {active === 'overview' && (
                <div className="smi-card">
                    <div className="smi-overview-grid">
                        <div className="smi-kv"><span className="k">Platform</span><span className="v">{account.platform}</span></div>
                        <div className="smi-kv"><span className="k">Username</span><span className="v smi-mono">{account.username}</span></div>
                        <div className="smi-kv"><span className="k">Status</span><span className="v"><StatusBadge status={account.status} /></span></div>
                        <div className="smi-kv"><span className="k">Profile Analysis</span><span className="v">{account.profile ? <ProfileStatusBadge status={account.profile.status} /> : '—'}</span></div>
                        <div className="smi-kv"><span className="k">Source(s)</span><span className="v">{account.sources.join(' + ')}</span></div>
                        <div className="smi-kv"><span className="k">LekirraX Confidence</span><span className="v"><ConfidenceBadge confidence={account.confidence} /></span></div>
                        <div className="smi-kv"><span className="k">Detected</span><span className="v">{account.detectedAt ? timeAgo(account.detectedAt) : '—'}</span></div>
                        <div className="smi-kv"><span className="k">Profile URL</span><span className="v">{account.profileUrl ? <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">Open Profile ↗</a> : '—'}</span></div>
                    </div>
                </div>
            )}

            {active === 'profile' && (
                <div className="smi-card">
                    {!account.profile || account.profile.status === 'NOT_APPLICABLE' ? (
                        <div className="smi-empty">Profile has not been analyzed yet. Run "Analyze Profiles" from the investigation view.</div>
                    ) : account.profile.status === 'UNAVAILABLE' ? (
                        <div className="smi-empty">Profile Analysis Unavailable for {account.platform} — this platform doesn't expose reliable public profile data without authentication.</div>
                    ) : (
                        <div className="smi-overview-grid">
                            <div className="smi-kv"><span className="k">Display Name</span><span className="v">{account.profile.displayName || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Bio</span><span className="v">{account.profile.bio || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Location</span><span className="v">{account.profile.location || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Website</span><span className="v">{account.profile.website || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Company</span><span className="v">{account.profile.company || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Public Email</span><span className="v">{account.profile.publicEmail || 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Avatar</span><span className="v">{account.profile.avatarUrl ? <a href={account.profile.avatarUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">Open Avatar ↗</a> : 'Not Available'}</span></div>
                            <div className="smi-kv"><span className="k">Analyzed</span><span className="v">{account.profile.analyzedAt ? timeAgo(account.profile.analyzedAt) : '—'}</span></div>
                        </div>
                    )}
                    {account.profile && Object.keys(account.profile.metadata || {}).length > 0 && (
                        <>
                            <div className="smi-card-subtitle">Public Metadata</div>
                            <div className="smi-overview-grid">
                                {Object.entries(account.profile.metadata).map(([k, v]) => v != null && v !== '' ? (
                                    <div className="smi-kv" key={k}><span className="k">{k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span><span className="v">{String(v)}</span></div>
                                ) : null)}
                            </div>
                        </>
                    )}
                    <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '12px' }} disabled={savingEvidence}
                        onClick={() => saveEvidence(`Public Profile — ${account.platform}`, account.profileUrl || undefined,
                            [account.profile?.displayName && `Display Name: ${account.profile.displayName}`, account.profile?.bio && `Bio: ${account.profile.bio}`, account.profile?.company && `Company: ${account.profile.company}`].filter(Boolean).join(' · ') || 'Public profile data')}>
                        Save Evidence
                    </button>
                </div>
            )}

            {active === 'links' && (
                <div className="smi-card">
                    {accountLinks.length === 0 ? <div className="smi-empty">No external links extracted from this profile.</div> : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>URL</th><th>Type</th><th>Detected</th><th></th></tr></thead>
                                <tbody>
                                    {accountLinks.map((l) => (
                                        <tr key={l.id}>
                                            <td data-label="URL"><a href={l.url} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">{l.url} ↗</a></td>
                                            <td data-label="Type">{l.linkType}</td>
                                            <td data-label="Detected">{l.detectedAt ? timeAgo(l.detectedAt) : '—'}</td>
                                            <td data-label="Action">
                                                <button type="button" className="smi-btn smi-btn--sm" disabled={addedObservables.has(`URL:${l.url}`)} onClick={() => addObservable('URL', l.url)}>
                                                    {addedObservables.has(`URL:${l.url}`) ? 'Added' : 'Add to Observables'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {active === 'signals' && (
                <div className="smi-card">
                    <div className="smi-card-subtitle">Display Name</div>
                    {sharedDisplayName.length === 0 ? <div className="smi-empty">No display name match observed across other discovered accounts.</div> : (
                        <div className="smi-signal-note">
                            <strong>Potential Name Match</strong> — Observed Across Profiles: {[account, ...sharedDisplayName].map((a) => `${a.platform}`).join(', ')}
                        </div>
                    )}
                    <div className="smi-card-subtitle">Username Variants</div>
                    {usernameVariants.length === 0 ? <div className="smi-empty">No observed username variants.</div> : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Platform</th><th>Username</th><th>Source</th><th>Confidence</th></tr></thead>
                                <tbody>
                                    {usernameVariants.map((a) => (
                                        <tr key={a.id}><td data-label="Platform">{a.platform}</td><td data-label="Username" className="smi-mono">{a.username}</td><td data-label="Source">{a.sources.join(' + ')}</td><td data-label="Confidence"><ConfidenceBadge confidence={a.confidence} /></td></tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {active === 'related' && (
                <div className="smi-card">
                    {accountCorrelations.length === 0 ? <div className="smi-empty">No related accounts identified yet. Run "Analyze Profiles" to compute identity correlation.</div> : (
                        <div className="smi-correlation-list">
                            {accountCorrelations.map((c) => {
                                const other = c.accountA.id === account.id ? c.accountB : c.accountA;
                                return (
                                    <div key={c.id} className="smi-correlation-card">
                                        <div className="smi-correlation-header">
                                            <button type="button" className="smi-link-btn" onClick={() => onSelectAccount(other.id)}>{other.platform} / {other.username}</button>
                                            <ConfidenceBadge confidence={c.confidence} />
                                        </div>
                                        <div className="smi-correlation-label">{c.relationshipLabel}</div>
                                        <SignalList signals={c.signals} />
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {active === 'domain' && (
                <div className="smi-card">
                    {domainLinks.length === 0 ? <div className="smi-empty">No domain relationships observed.</div> : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Domain</th><th>Referenced By</th><th>Relationship</th><th></th></tr></thead>
                                <tbody>
                                    {domainLinks.map((l) => {
                                        let host = l.url;
                                        try { host = new URL(l.url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
                                        return (
                                            <tr key={l.id}>
                                                <td data-label="Domain">{host}</td>
                                                <td data-label="Referenced By">{account.platform} / {account.username}</td>
                                                <td data-label="Relationship">Public Profile Link</td>
                                                <td data-label="Action"><button type="button" className="smi-btn smi-btn--sm" onClick={() => onNavigateToModule?.('domain-intel', host)}>Analyze Domain</button></td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {active === 'company' && (
                <div className="smi-card">
                    {!account.profile?.company ? <div className="smi-empty">No public company information found on this profile.</div> : (
                        <div className="smi-overview-grid">
                            <div className="smi-kv"><span className="k">Company</span><span className="v">{account.profile.company}</span></div>
                            <div className="smi-kv"><span className="k">Source</span><span className="v">{account.platform} Public Profile</span></div>
                            <div className="smi-kv"><span className="k">Relationship</span><span className="v">Publicly Listed Organization</span></div>
                            <div className="smi-kv"><span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={account.confidence} /></span></div>
                        </div>
                    )}
                    {account.profile?.company && <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '12px' }} onClick={() => onNavigateToModule?.('company-intel', account.profile!.company!.replace(/^@/, ''))}>Analyze Company</button>}
                </div>
            )}

            {active === 'email' && (
                <div className="smi-card">
                    {!account.profile?.publicEmail ? <div className="smi-empty">No public email exposed on this profile.</div> : (
                        <div className="smi-overview-grid">
                            <div className="smi-kv"><span className="k">Email</span><span className="v">{account.profile.publicEmail}</span></div>
                            <div className="smi-kv"><span className="k">Source</span><span className="v">Public {account.platform} Profile</span></div>
                        </div>
                    )}
                    {account.profile?.publicEmail && (
                        <div className="smi-btn-row" style={{ marginTop: '12px' }}>
                            <button type="button" className="smi-btn smi-btn--sm" onClick={() => onNavigateToModule?.('email', account.profile!.publicEmail!)}>Analyze Email</button>
                            <button type="button" className="smi-btn smi-btn--sm" disabled={addedObservables.has(`Email:${account.profile.publicEmail}`)} onClick={() => addObservable('Email', account.profile!.publicEmail!)}>
                                {addedObservables.has(`Email:${account.profile.publicEmail}`) ? 'Added' : 'Add to Observables'}
                            </button>
                        </div>
                    )}
                </div>
            )}

            {active === 'search' && (
                <div className="smi-card">
                    <p className="smi-muted">Search techniques generated from this investigation's own observed data. Results open in Google — LekirraX does not execute or store search results itself.</p>
                    {dorks.length === 0 ? <div className="smi-empty">No search queries generated yet.</div> : (
                        <div className="smi-dork-list">
                            {dorks.map((d, i) => (
                                <div key={i} className="smi-dork-row">
                                    <span className="smi-dork-category">{d.category}</span>
                                    <span className="smi-mono smi-dork-query">{d.query}</span>
                                    <a className="smi-btn smi-btn--sm" href={d.googleUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">Open in Google ↗</a>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {active === 'evidence' && (
                <div className="smi-card">
                    {evidence.length === 0 ? <div className="smi-empty">No evidence saved for this investigation yet.</div> : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Source</th><th>Description</th><th>Saved By</th><th>When</th></tr></thead>
                                <tbody>
                                    {evidence.map((e) => (
                                        <tr key={e.id}>
                                            <td data-label="Source">{e.url ? <a href={e.url} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">{e.source} ↗</a> : e.source}</td>
                                            <td data-label="Description">{e.description || '—'}</td>
                                            <td data-label="Saved By">{e.username || '—'}</td>
                                            <td data-label="When">{e.created_at ? timeAgo(e.created_at) : '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            </div>
            </div>
        </div>
    );
}

export default SocialMediaIntelligenceHome;
