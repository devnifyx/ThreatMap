// IOC_PHASE1.md — IOC Analysis Foundation, Normalization, Context &
// Existing Intelligence. Replaces the former "IOC Analyzer is planned for a
// future update and isn't available yet." placeholder. §2 "CRITICAL
// ARCHITECTURE RULE" — this is an ANALYSIS layer, not a repository: every
// number/relationship/evidence/note/case/brief shown here is read from an
// EXISTING system (Indicators, Threat Intelligence, MISP, Evidence,
// Timeline, Monitoring, Investigations, Notes, Knowledge Base, Threat
// Briefs). Reuses ThreatIntelligence's existing ti-* visual system, the
// same established convention every other analysis page (Threat Summary)
// already follows.
import React, { useState } from 'react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import { RiskBadge, formatDateTime, EntityChip } from '../ThreatIntelligence/ThreatIntelligenceShared';
import {
    analyzeIoc, type IocAnalyzerResult, type IocAnalyzerType,
    addEvidence, createCentralNote,
    // IOC_PHASE3.md — AI IOC Analyst, Advanced Correlation Explanation,
    // Intelligence Assessment & Operational Support.
    getIocAiSummary, type IocAiSummaryResponse,
    approveAiRecommendation, type AiRecommendation, type AiActionPreview,
} from '../../services/api';
import IocBulkAnalysisSection from './IocBulkAnalysisSection';
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here

interface IocAnalyzerPageProps {
    onNavigate?: (view: string) => void;
    onOpenEntity?: (entityType: string, entityId: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
}

const TYPE_OPTIONS: { value: IocAnalyzerType; label: string }[] = [
    { value: 'auto', label: 'Auto Detect' },
    { value: 'ipv4', label: 'IPv4' }, { value: 'ipv6', label: 'IPv6' }, { value: 'domain', label: 'Domain' },
    { value: 'url', label: 'URL' }, { value: 'email', label: 'Email' }, { value: 'md5', label: 'MD5' },
    { value: 'sha1', label: 'SHA1' }, { value: 'sha256', label: 'SHA256' }, { value: 'cve', label: 'CVE' },
    { value: 'username', label: 'Username' }, { value: 'phone', label: 'Phone' },
];

const TYPE_TO_TI_ENTITY: Record<string, string> = {
    domain: 'ioc', ipv4: 'ioc', ipv6: 'ioc', url: 'ioc', md5: 'ioc', sha1: 'ioc', sha256: 'ioc', email: 'ioc',
    cve: 'vulnerability',
};

// §46/§47/§48 RECENT ANALYSES — client-side only (localStorage). No
// existing backend "search history" mechanism fits a synchronous, no-job
// lookup like this one (the app's real Scan History table is for async
// recon jobs); building a NEW backend table purely to remember what an
// analyst recently typed would be exactly the "second search-history
// table" §48 says not to create, and would also mean persisting raw
// analyst-supplied indicator text server-side beyond what §47 calls for.
// Keeping it client-only, per-browser, satisfies both rules at once.
const RECENT_KEY = 'lekirrax_ioc_analyzer_recent';
function loadRecent(): string[] {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); } catch { return []; }
}
function pushRecent(value: string) {
    try {
        const list = loadRecent().filter((v) => v !== value);
        list.unshift(value);
        localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, 10)));
    } catch { /* best effort only */ }
}

type TabKey = 'overview' | 'reputation' | 'relationships' | 'misp' | 'evidence' | 'timeline' | 'investigations' | 'monitoring' | 'alerts' | 'notes' | 'ai';

const IocAnalyzerPage: React.FC<IocAnalyzerPageProps> = ({ onNavigate, onOpenEntity, onViewNotes, onViewKnowledge, onCreateThreatBrief }) => {
    // IOC_PHASE2.md §1 "turn IOC Analyzer from a single indicator analyzer
    // into a practical multi-indicator investigation tool" — the SAME page,
    // an added mode, never a second nav entry or a second page.
    const [mode, setMode] = useState<'single' | 'bulk'>('single');
    const [input, setInput] = useState('');
    const [type, setType] = useState<IocAnalyzerType>('auto');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<IocAnalyzerResult | null>(null);
    const [recent, setRecent] = useState<string[]>(() => loadRecent());
    const [tab, setTab] = useState<TabKey>('overview');

    // §41-45 ANALYST ACTIONS — every action below calls an EXISTING API
    // directly; nothing here is auto-triggered by analysis itself.
    const [caseIdInput, setCaseIdInput] = useState('');
    const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [noteText, setNoteText] = useState('');

    // IOC_PHASE3.md §6/§7 "ASK AI ABOUT IOC" — loaded ONLY on explicit
    // analyst click (never automatically on every analysis, §60 rate
    // limiting), and never blocking the deterministic Phase 1/2 tabs above
    // if it fails (§78 "an AI failure must never fail IOC Analyzer").
    const [aiSummary, setAiSummary] = useState<IocAiSummaryResponse | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [previewRec, setPreviewRec] = useState<AiRecommendation | null>(null);
    const [approving, setApproving] = useState(false);
    const [approveResult, setApproveResult] = useState<{ ok: boolean; message: string } | null>(null);

    const askAiAboutIoc = async () => {
        if (!result) return;
        setAiLoading(true); setAiError(null); setTab('ai');
        try {
            const summary = await getIocAiSummary(result.input, (result.type as IocAnalyzerType) || 'auto');
            setAiSummary(summary);
        } catch (err: any) {
            setAiError(err?.message || 'Failed to generate AI assessment');
        } finally {
            setAiLoading(false);
        }
    };
    // §19-22 "NO AUTONOMOUS ACTION" / "ACTION PREVIEW" — a recommendation
    // NEVER executes on its own; the target API is called ONLY on Approve,
    // and its own RBAC check (already enforced by the real Monitor/
    // Evidence/Notes/Knowledge Draft route) is the sole authority.
    const openPreview = (rec: AiRecommendation) => { setApproveResult(null); setPreviewRec(rec); };
    const closePreview = () => { setPreviewRec(null); setApproveResult(null); };
    const approveRecommendation = async (preview: AiActionPreview) => {
        setApproving(true); setApproveResult(null);
        try {
            await approveAiRecommendation(preview);
            setApproveResult({ ok: true, message: 'Action completed — the existing API confirmed the result.' });
            askAiAboutIoc(); // recommendations reflect the new state (e.g. the monitor now exists).
        } catch (err: any) {
            const message = err?.status === 403 ? 'Permission Required — you do not have permission to perform this action.' : (err?.message || 'The action could not be completed.');
            setApproveResult({ ok: false, message });
        } finally {
            setApproving(false);
        }
    };

    const run = async (value?: string, valueType?: IocAnalyzerType) => {
        const raw = (value ?? input).trim();
        if (!raw) { setError('Enter an indicator to analyze.'); return; }
        setLoading(true); setError(null); setActionMessage(null);
        setAiSummary(null); setAiError(null); // a new indicator invalidates any prior AI assessment
        try {
            const data = await analyzeIoc(raw, valueType ?? type);
            setResult(data);
            setTab('overview');
            if (data.status !== 'invalid') { pushRecent(raw); setRecent(loadRecent()); }
        } catch (err: any) {
            setError(err?.message || 'Failed to analyze IOC');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const openRecent = (value: string) => { setInput(value); setType('auto'); run(value, 'auto'); };

    const entityTypeForOpen = result?.type ? TYPE_TO_TI_ENTITY[result.type] : null;
    const entityIdForOpen = result?.type === 'cve' ? result?.vulnerability?.id : result?.ioc?.id;
    const entityLabel = result?.normalized || result?.input || '';

    const openThisEntity = () => {
        if (entityTypeForOpen && entityIdForOpen != null && onOpenEntity) onOpenEntity(entityTypeForOpen, String(entityIdForOpen));
    };

    const addToCase = async () => {
        if (!caseIdInput.trim() || !entityIdForOpen) return;
        setActionBusy(true); setActionMessage(null);
        try {
            const res = await fetch(`/api/investigations/cases/${encodeURIComponent(caseIdInput.trim())}/targets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: JSON.stringify({ entityType: entityTypeForOpen, entityId: entityIdForOpen }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.message || 'Failed to add to case');
            setActionMessage({ ok: true, text: `Added to Case ${caseIdInput.trim()}.` });
        } catch (err: any) {
            setActionMessage({ ok: false, text: err?.message || 'Failed to add to case.' });
        } finally {
            setActionBusy(false);
        }
    };

    const createEvidenceForThis = async () => {
        if (!entityTypeForOpen || entityIdForOpen == null) return;
        setActionBusy(true); setActionMessage(null);
        try {
            await addEvidence({
                entityType: entityTypeForOpen, entityId: entityIdForOpen,
                source: 'IOC Analyzer', description: `IOC observed via IOC Analyzer: ${entityLabel}`,
            });
            setActionMessage({ ok: true, text: 'Evidence created.' });
            run(result?.input, result?.type as IocAnalyzerType); // refresh so the new Evidence shows up
        } catch (err: any) {
            setActionMessage({ ok: false, text: err?.message || 'Failed to create evidence.' });
        } finally {
            setActionBusy(false);
        }
    };

    const addNote = async () => {
        if (!noteText.trim() || !entityTypeForOpen || entityIdForOpen == null) return;
        setActionBusy(true); setActionMessage(null);
        try {
            await createCentralNote({ content: noteText.trim(), entityType: entityTypeForOpen, entityId: entityIdForOpen });
            setActionMessage({ ok: true, text: 'Note added.' });
            setNoteText('');
            run(result?.input, result?.type as IocAnalyzerType);
        } catch (err: any) {
            setActionMessage({ ok: false, text: err?.message || 'Failed to add note.' });
        } finally {
            setActionBusy(false);
        }
    };

    const exportAnalysis = () => {
        if (!result) return;
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `ioc-analysis-${(result.normalized || result.input || 'result').replace(/[^a-z0-9.-]/gi, '_')}.json`);
    };

    // §33 IOC ANALYSIS TABS — only tabs with actual supported content.
    const allTabs: { key: TabKey; label: string; show: boolean }[] = [
        { key: 'overview', label: 'Overview', show: true },
        { key: 'reputation', label: 'Reputation', show: !!result?.reputation },
        { key: 'relationships', label: 'Relationships', show: !!(result?.relationships && result.relationships.length) },
        { key: 'misp', label: 'MISP', show: !!result?.misp },
        { key: 'evidence', label: 'Evidence', show: !!(result?.evidence && result.evidence.length) },
        { key: 'timeline', label: 'Timeline', show: !!(result?.timeline && result.timeline.length) },
        { key: 'investigations', label: 'Investigations', show: !!(result?.cases && result.cases.length) },
        { key: 'monitoring', label: 'Monitoring', show: !!result?.monitoring },
        { key: 'alerts', label: 'Alerts', show: !!(result?.ioc?.relatedAlerts && result.ioc.relatedAlerts.length) },
        { key: 'notes', label: 'Notes', show: true }, // Add Note is always offered
        { key: 'ai', label: 'AI Assessment', show: true }, // §33 — always offered; the tab itself explains when nothing has been requested yet
    ];
    const availableTabs = result && result.status === 'existing' ? allTabs.filter((t) => t.show)
        : result && result.status === 'unknown' ? allTabs.filter((t) => t.key === 'ai') // §13/CASE 13 — AI can still honestly report "No IOC Record" for an unknown indicator
        : [];

    return (
        <div className="ti-container">
            <div className="ti-content">
                <div className="ti-header">
                    <h1>IOC Analyzer</h1>
                </div>
                <div className="ti-note" style={{ marginBottom: '10px' }}>
                    Submit an observable to see what LekirraX already knows about it — an analysis layer over the existing Indicators repository, Threat Intelligence, MISP, Evidence, Timeline, Monitoring, Investigations, Notes and Knowledge Base. This is not a second IOC repository.
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    <button type="button" className="ti-action-btn" style={mode === 'single' ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setMode('single')}>Single</button>
                    <button type="button" className="ti-action-btn" style={mode === 'bulk' ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setMode('bulk')}>Bulk</button>
                </div>

                {mode === 'bulk' ? (
                    <IocBulkAnalysisSection onOpenEntity={onOpenEntity} onNavigate={onNavigate} />
                ) : (
                <>
                {/* §5 IOC INPUT */}
                <div className="ti-filters">
                    <input type="text" placeholder="example.com, 8.8.8.8, a SHA256 hash, CVE-2026-1234…" value={input}
                        onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') run(); }} style={{ flex: '1 1 360px' }} />
                    <select value={type} onChange={(e) => setType(e.target.value as IocAnalyzerType)}>
                        {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" className="ti-action-btn" onClick={() => run()} disabled={loading}>{loading ? 'Analyzing…' : 'Analyze'}</button>
                    {result && <button type="button" className="ti-action-btn" onClick={exportAnalysis}>Export</button>}
                    {result && result.status !== 'invalid' && (
                        <button type="button" className="ti-action-btn" onClick={askAiAboutIoc} disabled={aiLoading}>{aiLoading ? 'Asking AI…' : 'Ask AI About IOC'}</button>
                    )}
                </div>

                {/* §46/§47 RECENT IOC ANALYSES */}
                {recent.length > 0 && (
                    <div className="ti-chip-list" style={{ marginBottom: '16px' }}>
                        <span className="ti-note" style={{ marginRight: '6px' }}>Recent:</span>
                        {recent.map((v) => <span key={v} className="ti-chip" onClick={() => openRecent(v)}>{v}</span>)}
                    </div>
                )}

                {error && <div className="ti-error">{error}</div>}

                {result && result.status === 'invalid' && (
                    <div className="ti-card" style={{ borderColor: 'rgba(239,68,68,0.35)' }}>
                        <div className="ti-card-title">Invalid IOC</div>
                        <div className="ti-note">{result.reason}</div>
                    </div>
                )}

                {result && result.status !== 'invalid' && (
                    <>
                        {/* §9/§34 ANALYSIS SUMMARY / OVERVIEW header, always shown regardless of tab. */}
                        <div className="ti-card" style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                                {result.normalized || result.input}
                                {entityTypeForOpen && entityIdForOpen != null && (
                                    <button type="button" className="ti-action-btn" style={{ marginLeft: 'auto' }} onClick={openThisEntity}>View Entity</button>
                                )}
                            </div>
                            <div className="ti-kv">
                                <span className="k">Type</span><span className="v" style={{ textTransform: 'uppercase' }}>{result.type}</span>
                                <span className="k">Normalized Value</span><span className="v">{result.normalized ?? '—'}</span>
                                <span className="k">Original Input</span><span className="v">{result.input}</span>
                                <span className="k">Validation Status</span><span className="v">{result.status === 'existing' ? 'Existing IOC' : 'IOC not found in LekirraX'}</span>
                                <span className="k">Risk</span><span className="v"><RiskBadge risk={result.risk || 'Not Available'} /></span>
                                {result.age != null && <><span className="k">Age</span><span className="v">{result.age} day(s)</span></>}
                                {result.sourceCount != null && <><span className="k">Sources</span><span className="v">{result.sourceCount} — {result.sources?.join(', ') || '—'}</span></>}
                            </div>
                            {result.status === 'unknown' && (
                                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>{result.note}</div>
                            )}
                        </div>

                        {availableTabs.length > 0 && (
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                {availableTabs.map((t) => (
                                    <button key={t.key} type="button" className="ti-action-btn"
                                        style={tab === t.key ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined}
                                        onClick={() => setTab(t.key)}>{t.label}</button>
                                ))}
                            </div>
                        )}

                        {actionMessage && <div className={actionMessage.ok ? 'ti-note' : 'ti-error'} style={actionMessage.ok ? { color: '#4ade80', marginBottom: '10px' } : { marginBottom: '10px' }}>{actionMessage.text}</div>}

                        {tab === 'overview' && <OverviewTab result={result} onOpenEntity={onOpenEntity} onCreateThreatBrief={onCreateThreatBrief} entityTypeForOpen={entityTypeForOpen} entityIdForOpen={entityIdForOpen} />}
                        {tab === 'reputation' && <ReputationTab reputation={result.reputation} />}
                        {tab === 'relationships' && <RelationshipsTab relationships={result.relationships} onOpenEntity={onOpenEntity} />}
                        {tab === 'misp' && <MispTab misp={result.misp} />}
                        {tab === 'evidence' && <EvidenceTab evidence={result.evidence} />}
                        {tab === 'timeline' && <TimelineTab timeline={result.timeline} />}
                        {tab === 'investigations' && <InvestigationsTab cases={result.cases} onNavigate={onNavigate} />}
                        {tab === 'monitoring' && <MonitoringTab monitoring={result.monitoring} />}
                        {tab === 'alerts' && <AlertsTab alerts={result.ioc?.relatedAlerts} onNavigate={onNavigate} />}
                        {tab === 'notes' && (
                            <NotesTab
                                notes={result.notes} noteText={noteText} setNoteText={setNoteText} onAddNote={addNote} busy={actionBusy}
                                onViewNotes={entityTypeForOpen && entityIdForOpen != null ? () => onViewNotes?.(entityTypeForOpen, String(entityIdForOpen), entityLabel) : undefined}
                            />
                        )}
                        {tab === 'ai' && (
                            <AiAssessmentTab
                                loading={aiLoading} error={aiError} data={aiSummary}
                                onAsk={askAiAboutIoc} onReview={openPreview}
                            />
                        )}

                        {/* §41-43 ANALYST ACTIONS */}
                        {entityTypeForOpen && entityIdForOpen != null && (
                            <div className="ti-card" style={{ marginTop: '16px' }}>
                                <div className="ti-card-title">Analyst Actions</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                                    <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e) => setCaseIdInput(e.target.value)} style={{ width: '100px' }} />
                                    <button type="button" className="ti-action-btn" onClick={addToCase} disabled={actionBusy || !caseIdInput.trim()}>Add to Case</button>
                                    <button type="button" className="ti-action-btn" onClick={createEvidenceForThis} disabled={actionBusy}>Create Evidence</button>
                                    {onViewKnowledge && <button type="button" className="ti-action-btn" onClick={() => onViewKnowledge(entityTypeForOpen, String(entityIdForOpen), entityLabel)}>View Knowledge</button>}
                                    {onCreateThreatBrief && <button type="button" className="ti-action-btn" onClick={() => onCreateThreatBrief(entityTypeForOpen, String(entityIdForOpen))}>Create Threat Brief</button>}
                                </div>
                                <div className="ti-note" style={{ marginTop: '6px', fontStyle: 'italic' }}>Every action calls the existing Investigation/Evidence/Knowledge/Threat Brief API directly — nothing is created automatically by analysis.</div>
                            </div>
                        )}
                    </>
                )}
                {previewRec && (
                    <ActionPreviewModal rec={previewRec} approving={approving} result={approveResult}
                        onApprove={() => previewRec.actionPreview && approveRecommendation(previewRec.actionPreview)} onClose={closePreview} />
                )}
                </>
                )}
            </div>
        </div>
    );
};

const OverviewTab: React.FC<{
    result: IocAnalyzerResult; onOpenEntity?: (t: string, id: string) => void; onCreateThreatBrief?: (t: string, id: string) => void;
    entityTypeForOpen: string | null; entityIdForOpen: number | string | undefined;
}> = ({ result }) => {
    const related = result.relationships || [];
    const byType: Record<string, number> = {};
    for (const r of related) byType[r.entity.type] = (byType[r.entity.type] || 0) + 1;
    const campaignCount = result.ioc?.relatedCampaigns?.length || 0;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Related</div>
            {campaignCount === 0 && Object.keys(byType).length === 0 && (result.evidence?.length || 0) === 0 && (result.cases?.length || 0) === 0 ? (
                <div className="ti-empty">No Related Intelligence Found in LekirraX. This does not mean no threat exists — only that no related record is stored here.</div>
            ) : (
                <div className="ti-chip-list">
                    {campaignCount > 0 && <span className="ti-chip">{campaignCount} Campaign(s)</span>}
                    {Object.entries(byType).map(([t, c]) => <span key={t} className="ti-chip">{c} {t.replace('_', ' ')}(s)</span>)}
                </div>
            )}
            {result.vulnerability?.description && <div className="ti-note" style={{ marginTop: '10px' }}>{result.vulnerability.description}</div>}
        </div>
    );
};

const ReputationTab: React.FC<{ reputation?: IocAnalyzerResult['reputation'] }> = ({ reputation }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Reputation</div>
        {!reputation || reputation.status === 'not_configured' ? (
            <div className="ti-empty">Reputation: Not Configured{reputation?.reason ? ` — ${reputation.reason}` : ''}</div>
        ) : (
            <div className="ti-kv">
                <span className="k">Overall</span><span className="v">{reputation.threatIntel?.reputation ?? '—'}</span>
                <span className="k">Phishing</span><span className="v">{reputation.threatIntel?.phishing ?? '—'}</span>
                <span className="k">Malware</span><span className="v">{reputation.threatIntel?.malware ?? '—'}</span>
                {reputation.blocklists && Object.entries(reputation.blocklists).map(([k, v]) => (
                    <React.Fragment key={k}><span className="k">{k}</span><span className="v">{v}</span></React.Fragment>
                ))}
            </div>
        )}
    </div>
);

const RelationshipsTab: React.FC<{ relationships?: IocAnalyzerResult['relationships']; onOpenEntity?: (t: string, id: string) => void }> = ({ relationships, onOpenEntity }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Relationships ({relationships?.length || 0})</div>
        {!relationships || relationships.length === 0 ? <div className="ti-empty">No known relationships.</div> : (
            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                {relationships.map((r) => (
                    <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                        <span className="ti-badge" style={{ textTransform: 'capitalize' }}>{r.relationship_type.replace(/_/g, ' ')}</span>
                        <EntityChip entity={r.entity} onOpen={onOpenEntity} />
                        <span className="ti-note">Source: {r.source}</span>
                        {r.confidence && <span className="ti-badge ti-badge--none">{r.confidence}</span>}
                    </div>
                ))}
            </div>
        )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Only real, already-stored relationships — never inferred from shared timing or a shared IOC alone.</div>
    </div>
);

const MispTab: React.FC<{ misp?: IocAnalyzerResult['misp'] }> = ({ misp }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">MISP</div>
        {!misp || misp.status === 'not_configured' ? <div className="ti-empty">MISP: Not Configured</div>
            : misp.status === 'not_applicable' ? <div className="ti-empty">MISP does not track this indicator type.</div>
            : misp.status === 'unavailable' ? <div className="ti-error">MISP: Unavailable{misp.errorMessage ? ` — ${misp.errorMessage}` : ''}</div>
            : misp.status === 'no_match' ? <div className="ti-note">No Match</div>
            : (
                <div>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>MISP Match</div>
                    {(misp.matches || []).map((m: any, i: number) => (
                        <div key={i} className="ti-kv" style={{ marginBottom: '8px' }}>
                            <span className="k">Event</span><span className="v">{m.mispEventId ?? '—'}</span>
                            <span className="k">Attribute</span><span className="v">{m.mispAttributeId ?? '—'} ({m.category ?? '—'})</span>
                            <span className="k">Threat Level</span><span className="v">{m.threatLevel ?? '—'}</span>
                        </div>
                    ))}
                </div>
            )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>MISP Match does not automatically mean malicious — an analyst decision.</div>
    </div>
);

const EvidenceTab: React.FC<{ evidence?: IocAnalyzerResult['evidence'] }> = ({ evidence }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Evidence ({evidence?.length || 0})</div>
        {!evidence || evidence.length === 0 ? <div className="ti-empty">No related evidence.</div> : (
            <ul className="ti-list">
                {evidence.map((e) => (
                    <li key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div><strong>EV-{e.id}</strong> — {e.description || '(no description)'}</div>
                        <div className="ti-note">Source: {e.source} · {formatDateTime(e.observed_at || e.created_at)}</div>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const TimelineTab: React.FC<{ timeline?: IocAnalyzerResult['timeline'] }> = ({ timeline }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Timeline</div>
        {!timeline || timeline.length === 0 ? <div className="ti-empty">No recorded activity.</div> : (
            <ul className="ti-list">
                {timeline.map((t, i) => (
                    <li key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="ti-note" style={{ minWidth: '150px' }}>{formatDateTime(t.created_at)}</span>
                        <span className="ti-badge">{t.action?.replace(/_/g, ' ')}</span>
                        <span className="ti-note">{t.previous_value && t.new_value ? `${t.previous_value} → ${t.new_value}` : (t.new_value || '')}</span>
                        <span className="ti-note" style={{ marginLeft: 'auto' }}>{t.source}</span>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const InvestigationsTab: React.FC<{ cases?: IocAnalyzerResult['cases']; onNavigate?: (v: string) => void }> = ({ cases, onNavigate }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Investigations <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onNavigate?.('cases')}>Open Investigations</button></div>
        {!cases || cases.length === 0 ? <div className="ti-empty">No authorized cases reference this IOC.</div> : (
            <ul className="ti-list">
                {cases.map((c) => (
                    <li key={c.id} style={{ padding: '5px 0' }}>
                        <strong>{c.case_number}</strong> — {c.title} <span className="ti-badge">{c.status}</span>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const MonitoringTab: React.FC<{ monitoring?: IocAnalyzerResult['monitoring'] }> = ({ monitoring }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Monitoring</div>
        {!monitoring || monitoring.status === 'not_configured' ? <div className="ti-empty">Monitoring: Not Configured{monitoring?.reason ? ` — ${monitoring.reason}` : ''}</div> : (
            <>
                <div className="ti-kv">
                    <span className="k">Monitor Status</span><span className="v">{monitoring.monitorStatus}</span>
                    <span className="k">Last Checked</span><span className="v">{monitoring.lastChecked ? formatDateTime(monitoring.lastChecked) : '—'}</span>
                </div>
                {monitoring.recentEvents && monitoring.recentEvents.length > 0 && (
                    <ul className="ti-list" style={{ marginTop: '8px' }}>
                        {monitoring.recentEvents.map((e) => <li key={e.id} className="ti-note">{formatDateTime(e.createdAt)} — {e.summary}</li>)}
                    </ul>
                )}
            </>
        )}
    </div>
);

const AlertsTab: React.FC<{ alerts?: { id: number; severity: string; title: string; status: string; created_at: string | null }[]; onNavigate?: (v: string) => void }> = ({ alerts, onNavigate }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Alerts <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onNavigate?.('mon-alert-center')}>Alert Center</button></div>
        {!alerts || alerts.length === 0 ? <div className="ti-empty">No alerts for this indicator.</div> : (
            <ul className="ti-list">
                {alerts.map((a) => (
                    <li key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0' }}>
                        <RiskBadge risk={a.severity} /><strong>{a.title}</strong><span className="ti-note">{formatDateTime(a.created_at)}</span>
                    </li>
                ))}
            </ul>
        )}
    </div>
);

const NotesTab: React.FC<{ notes?: IocAnalyzerResult['notes']; noteText: string; setNoteText: (v: string) => void; onAddNote: () => void; busy: boolean; onViewNotes?: () => void }> = ({ notes, noteText, setNoteText, onAddNote, busy, onViewNotes }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Notes {onViewNotes && <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={onViewNotes}>View Notes</button>}</div>
        {!notes || notes.length === 0 ? <div className="ti-empty">No notes yet.</div> : (
            <ul className="ti-list">
                {notes.map((n) => <li key={n.id} className="ti-note" style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{n.contentPreview} — <em>{n.createdBy}</em>, {formatDateTime(n.createdAt)}</li>)}
            </ul>
        )}
        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <input type="text" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ flex: 1 }} />
            <button type="button" className="ti-action-btn" onClick={onAddNote} disabled={busy || !noteText.trim()}>Add Note</button>
        </div>
    </div>
);

// IOC_PHASE3.md §6/§7/§58/§78 — AI ASSESSMENT tab. A failed/unavailable AI
// call NEVER blocks the rest of IOC Analyzer (Phase 1/2 tabs above remain
// fully usable regardless); this tab simply reports its own honest state.
const AiAssessmentTab: React.FC<{
    loading: boolean; error: string | null; data: IocAiSummaryResponse | null;
    onAsk: () => void; onReview: (rec: AiRecommendation) => void;
}> = ({ loading, error, data, onAsk, onReview }) => {
    if (loading) return <div className="ti-card"><div className="ti-empty">Generating AI assessment…</div></div>;
    if (error) return (
        <div className="ti-card">
            <div className="ti-error">{error}</div>
            <button type="button" className="ti-action-btn" onClick={onAsk} style={{ marginTop: '8px' }}>Retry</button>
        </div>
    );
    if (!data) return (
        <div className="ti-card">
            <div className="ti-empty">No AI assessment requested yet.</div>
            <button type="button" className="ti-action-btn" onClick={onAsk} style={{ marginTop: '8px' }}>Ask AI About IOC</button>
        </div>
    );
    const s = data.summary;
    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    AI Assessment
                    <span className="ti-badge" style={{ marginLeft: 'auto' }}>{data.aiStatus}{data.fallback ? ' (Fallback)' : ''}</span>
                </div>
                <div>{s.assessment}</div>
                <div className="ti-note" style={{ marginTop: '8px' }}>Generated {formatDateTime(data.generatedAt)}</div>
            </div>
            <AiListBlock title="Key Findings" items={s.keyFindings} />
            {s.supportingIntelligence && <AiListBlock title="Supporting Intelligence" items={s.supportingIntelligence} />}
            <AiListBlock title="Major Changes" items={s.majorChanges} />
            <AiListBlock title="Conflicts" items={s.conflicts} warn />
            <AiListBlock title="Unknowns / Intelligence Gaps" items={s.unknowns} />
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Sources</div>
                {s.sources.length === 0 ? <div className="ti-empty">No citations available.</div> : (
                    <div className="ti-chip-list">{s.sources.map((c, i) => <span key={i} className="ti-chip">{c}</span>)}</div>
                )}
            </div>
            <RecommendationsSection recommendations={data.recommendations} onReview={onReview} />
            <div className="ti-note" style={{ fontStyle: 'italic' }}>{s.note}</div>
        </>
    );
};

const AiListBlock: React.FC<{ title: string; items: string[]; warn?: boolean }> = ({ title, items, warn }) => (
    <div className="ti-card" style={warn ? { marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)' } : { marginBottom: '16px' }}>
        <div className="ti-card-title">{title}</div>
        {items.length === 0 ? <div className="ti-empty">None reported.</div> : (
            <ul className="ti-list">{items.map((it, i) => <li key={i} style={{ padding: '4px 0' }}>{it}</li>)}</ul>
        )}
    </div>
);

// §18-22 AI RECOMMENDATIONS — Reason/Source/Priority always visible;
// state-changing recommendations open an Action Preview, never execute
// directly. Mirrors ThreatSummaryPage.tsx's own RecommendationsSection.
const RecommendationsSection: React.FC<{ recommendations: AiRecommendation[]; onReview: (rec: AiRecommendation) => void }> = ({ recommendations, onReview }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Recommendations ({recommendations.length})</div>
        {recommendations.length === 0 ? <div className="ti-empty">No recommendations.</div> : (
            <ul className="ti-list">
                {recommendations.map((r) => (
                    <li key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <span className="ti-badge" style={{ background: r.priority === 'High' ? 'rgba(239,68,68,0.15)' : r.priority === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(148,163,184,0.15)', color: r.priority === 'High' ? '#f87171' : r.priority === 'Medium' ? '#eab308' : '#94a3b8' }}>{r.priority}</span>
                        <div style={{ flex: 1 }}>
                            <strong>{r.label}</strong>
                            <div className="ti-note">{r.reason}</div>
                            <div className="ti-note">Source: {r.source.join(', ')}</div>
                        </div>
                        {r.stateChanging ? (
                            <button type="button" className="ti-action-btn" onClick={() => onReview(r)}>Review</button>
                        ) : (
                            <span className="ti-note" style={{ fontStyle: 'italic' }}>Informational</span>
                        )}
                    </li>
                ))}
            </ul>
        )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Recommendations only — no action is ever taken automatically.</div>
    </div>
);

// §20/§21/§22 ACTION PREVIEW — Recommended Action / Target / Reason /
// Source, then [Review] (already open) / [Approve]. The target API is
// called ONLY on Approve; its own RBAC check is the sole authority on
// whether it succeeds. Mirrors ThreatSummaryPage.tsx's own ActionPreviewModal.
const ActionPreviewModal: React.FC<{
    rec: AiRecommendation; approving: boolean; result: { ok: boolean; message: string } | null;
    onApprove: () => void; onClose: () => void;
}> = ({ rec, approving, result, onApprove, onClose }) => (
    <div className="ti-modal-overlay" onClick={onClose}>
        <div className="ti-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ti-modal-header"><h2>Action Preview</h2><button type="button" className="ti-modal-close" onClick={onClose}>×</button></div>
            <div className="ti-modal-body">
                <div><div className="ti-modal-subtitle">Recommended Action</div><div>{rec.label}</div></div>
                <div><div className="ti-modal-subtitle">Reason</div><div className="ti-note">{rec.reason}</div></div>
                <div><div className="ti-modal-subtitle">Source</div><div className="ti-note">{rec.source.join(', ')}</div></div>
                {rec.actionPreview && (
                    <div>
                        <div className="ti-modal-subtitle">Target</div>
                        <div className="ti-kv">
                            {Object.entries(rec.actionPreview.payload).filter(([, v]) => v != null && v !== '').map(([k, v]) => (
                                <React.Fragment key={k}><span className="k">{k}</span><span className="v">{String(v)}</span></React.Fragment>
                            ))}
                        </div>
                    </div>
                )}
                {result && (
                    <div className={result.ok ? 'ti-note' : 'ti-error'} style={result.ok ? { color: '#4ade80' } : undefined}>{result.message}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="ti-action-btn" onClick={onClose}>{result?.ok ? 'Close' : 'Cancel'}</button>
                    {!result?.ok && (
                        <button type="button" className="ti-action-btn" onClick={onApprove} disabled={approving || !rec.actionPreview}
                            style={{ background: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.5)' }}>
                            {approving ? 'Approving…' : 'Approve'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
);

export default IocAnalyzerPage;
