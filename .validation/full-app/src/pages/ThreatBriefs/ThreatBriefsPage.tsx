import React, { useCallback, useEffect, useMemo, useState } from 'react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import './ThreatBriefsPage.css';
import KnowledgeContextPanel from '../KnowledgeBase/KnowledgeContextPanel'; // KNOWLEDGE_BASE_PHASE2.md §10 "KNOWLEDGE TO THREAT BRIEF"
import {
    getReportsMetadata, getReports, createReport, getReport, updateReportFields, deleteReport,
    submitReportForReview, archiveReport, addReportEntity, removeReportEntity,
    getReportTimeline, getReportRiskAssessment, generateReportAiSummary,
    getEvidence, addEvidence, deleteEvidence, getRelationshipGraph, searchIntelligence,
    getThreatBriefContextTypes, getThreatBriefContext, createThreatBriefJob, getThreatBriefJob, cancelThreatBriefJob,
    getReportQualityCheck, publishReportForced, regenerateReportAiDraft, getReportEvidenceRankings, setEvidenceRank,
    getReportFreshness, checkReportUpdates, createReportRevision, getReportRevisions, compareReportRevisions,
    getReportTrend, getReportPriority, getReportQualityScore, getExecutiveBriefView, generateAiExecutiveSummary,
    generateAiChangeSummary, distributeReport, getBriefingDashboard, downloadReportExportMode,
    type IntelligenceReport, type ReportDetail, type ReportsMetadata, type ReportTimelineItem,
    type ReportRiskAssessment, type EvidenceItem, type RelationshipGraph, type SearchResultItem,
    type ThreatBriefTemplate, type ThreatBriefContext, type ThreatBriefJob, type QualityCheckResult, type EvidenceRanking,
    type FreshnessInfo, type ReportRevision, type RevisionComparison, type ThreatTrendResult, type BriefPriority,
    type BriefQualityScore, type ExecutiveBriefView, type BriefingDashboard
} from '../../services/api';
import { RiskBadge, ConfidenceBadge, formatDate, formatDateTime, EntityChip, ConfirmDialog } from '../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../components/shared/Pagination';  // P2-8
import EntityPicker from '../../components/shared/EntityPicker';  // P1-5 — was a local copy

const CLASSIFICATIONS = ['Unclassified', 'Internal', 'Confidential', 'Restricted'];
const STATUS_LABELS: Record<string, string> = { draft: 'Draft', review: 'In Review', published: 'Published', archived: 'Archived' };
const EVIDENCE_TYPE_SUGGESTIONS = [
    'Threat Intelligence Record', 'Observable', 'Investigation', 'Monitoring Event', 'Telegram Message',
    'Social Profile', 'Domain Result', 'IP Result', 'Malware Result', 'Vulnerability Result', 'Screenshot', 'Analyst Note'
];

function textInputStyle(): React.CSSProperties {
    return { background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' };
}
function textareaStyle(): React.CSSProperties {
    return { width: '100%', background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '8px', fontFamily: 'inherit', fontSize: '0.88rem' };
}

function isLocked(status: string) { return status === 'published' || status === 'archived'; }

const CONTEXT_SEARCH_TYPES = new Set(['threat_actor', 'campaign', 'ioc', 'malware', 'vulnerability', 'brand', 'company', 'alert']);

const ContextPicker: React.FC<{ onPick: (item: SearchResultItem) => void; onCancel: () => void }> = ({ onPick, onCancel }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<SearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!q.trim()) { setResults([]); return; }
        const t = setTimeout(() => {
            setLoading(true);
            searchIntelligence(q.trim()).then((items) => setResults(items.filter((i) => CONTEXT_SEARCH_TYPES.has(i.type)))).finally(() => setLoading(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q]);

    return (
        <div style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', padding: '10px' }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input type="text" placeholder="Search a Threat Actor, Campaign, IOC, Malware, CVE, Brand, Company, or Alert…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus style={{ flex: 1, ...textInputStyle() }} />
                <button type="button" className="ti-action-btn" onClick={onCancel}>Cancel</button>
            </div>
            {loading ? <div className="ti-loading">Searching…</div> : (
                <div className="ti-chip-list">
                    {results.map((r, i) => (
                        <button key={i} type="button" className="ti-chip" onClick={() => onPick(r)}>{r.label} <span style={{ opacity: 0.6 }}>· {r.type.replace(/_/g, ' ')}</span></button>
                    ))}
                    {q.trim() && !loading && results.length === 0 && <span className="ti-note">No matches.</span>}
                </div>
            )}
        </div>
    );
};

const ContextPanel: React.FC<{ context: ThreatBriefContext }> = ({ context }) => (
    <div className="tb-context-panel">
        <div className="ti-kv">
            <span className="k">Primary Context</span><span className="v">{context.primary.label} <span className="ti-note">({context.contextType.replace(/_/g, ' ')})</span></span>
            <span className="k">Related Entities</span><span className="v">{Object.entries(context.relatedByType).map(([t, c]) => `${c} ${t.replace(/_/g, ' ')}${c === 1 ? '' : 's'}`).join(', ') || 'None discovered yet'}</span>
            <span className="k">Indicators</span><span className="v">{context.indicators.length}</span>
            <span className="k">Evidence</span><span className="v">{context.evidence.length} item(s) — {context.evidence.filter((e) => e.rank === 'primary').length} primary, {context.evidence.filter((e) => e.rank === 'supporting').length} supporting, {context.evidence.filter((e) => e.rank === 'contextual').length} contextual</span>
            <span className="k">Risk</span><span className="v"><RiskBadge risk={context.risk.overallLevel} /> <span className="ti-note">score {context.risk.overallScore}/100</span></span>
            <span className="k">Timeline</span><span className="v">{context.timeline.length} event(s)</span>
            <span className="k">Alerts</span><span className="v">{context.alerts.open} open, {context.alerts.resolved} resolved</span>
            <span className="k">Monitoring</span><span className="v">{context.monitoring.monitors.length} monitor(s)</span>
            {context.investigation && <><span className="k">Investigation</span><span className="v">{context.investigation.target} ({context.investigation.status}) — {context.investigation.accountCount} account(s)</span></>}
        </div>
        {context.findings.length > 0 && (
            <div style={{ marginTop: '10px' }}>
                <div className="ti-modal-subtitle">Key Findings ({context.findings.length})</div>
                <ul className="tb-findings-list" style={{ paddingLeft: '18px' }}>
                    {context.findings.slice(0, 8).map((f, i) => <li key={i} style={{ display: 'block' }}>{f.statement} <span className="ti-note">— {f.sources.join(', ')}</span></li>)}
                </ul>
            </div>
        )}
    </div>
);

const JobProgressView: React.FC<{ jobId: number; onDone: (job: ThreatBriefJob) => void; onCancelled: () => void }> = ({ jobId, onDone, onCancelled }) => {
    const [job, setJob] = useState<ThreatBriefJob | null>(null);
    const [cancelling, setCancelling] = useState(false);

    useEffect(() => {
        let stopped = false;
        const poll = () => {
            getThreatBriefJob(jobId).then((j) => {
                if (stopped) return;
                setJob(j);
                if (['completed', 'partial', 'failed'].includes(j.status)) { onDone(j); return; }
                if (j.status === 'cancelled') { onCancelled(); return; }
                setTimeout(poll, 2000);
            }).catch(() => { if (!stopped) setTimeout(poll, 3000); });
        };
        poll();
        return () => { stopped = true; };
    }, [jobId]);

    const stages = ['queued', 'collecting_evidence', 'aggregating', 'generating_draft', 'finalizing'];
    const stageIndex = job ? stages.indexOf(job.status) : 0;

    const cancel = async () => {
        setCancelling(true);
        try { await cancelThreatBriefJob(jobId); } finally { setCancelling(false); }
    };

    return (
        <div className="ti-card">
            <div className="ti-section-header"><span className="ti-card-title">Generating Threat Brief…</span></div>
            <div className="tb-job-stages">
                {stages.map((s, i) => (
                    <div key={s} className={`tb-job-stage ${i < stageIndex ? 'done' : i === stageIndex ? 'active' : ''}`}>
                        {s.replace(/_/g, ' ')}
                    </div>
                ))}
            </div>
            {job && (
                <div className="ti-kv" style={{ marginTop: '10px' }}>
                    <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{job.status.replace(/_/g, ' ')}</span>
                    {job.progress_label && <><span className="k">Stage</span><span className="v">{job.progress_label}{job.progress_total > 0 ? ` — ${job.progress_current}/${job.progress_total}` : ''}</span></>}
                    <span className="k">AI Draft</span><span className="v">{job.ai_status === 'pending' ? 'Pending…' : job.ai_status === 'generated' ? 'Generated' : job.ai_status === 'skipped' ? 'Not requested' : 'Unavailable'}</span>
                </div>
            )}
            {job?.status !== 'finalizing' && job?.status !== 'completed' && (
                <button type="button" className="ti-action-btn" style={{ marginTop: '10px' }} onClick={cancel} disabled={cancelling}>{cancelling ? 'Cancelling…' : 'Cancel'}</button>
            )}
        </div>
    );
};

const GenerateThreatBriefWizard: React.FC<{ onCreated: (reportId: number) => void; onCancel: () => void; initialContext?: { type: string; id: string } }> = ({ onCreated, onCancel, initialContext }) => {
    const [templates, setTemplates] = useState<Record<string, ThreatBriefTemplate>>({});
    const [picking, setPicking] = useState(!initialContext);
    const [selected, setSelected] = useState<{ type: string; id: string; label: string } | null>(initialContext ? { ...initialContext, label: '' } : null);
    const [templateKey, setTemplateKey] = useState('');
    const [context, setContext] = useState<ThreatBriefContext | null>(null);
    const [loadingContext, setLoadingContext] = useState(false);
    const [contextError, setContextError] = useState<string | null>(null);
    const [requestAiDraft, setRequestAiDraft] = useState(true);
    const [jobId, setJobId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);

    useEffect(() => { getThreatBriefContextTypes().then((r) => setTemplates(r.templates)).catch(() => {}); }, []);

    const loadContext = useCallback((type: string, id: string) => {
        setLoadingContext(true);
        setContextError(null);
        getThreatBriefContext(type, id).then(setContext).catch((err) => setContextError(err?.message || 'Failed to collect context')).finally(() => setLoadingContext(false));
    }, []);

    useEffect(() => { if (selected) loadContext(selected.type, selected.id); }, [selected, loadContext]);

    const pick = (item: SearchResultItem) => {
        setSelected({ type: item.type, id: item.id, label: item.label });
        setPicking(false);
    };

    const availableTemplates = Object.entries(templates).filter(([, t]) => !selected || t.contextTypes.includes(selected.type));

    const generate = async () => {
        if (!selected) return;
        setCreating(true);
        try {
            const result = await createThreatBriefJob({ contextType: selected.type, contextId: selected.id, templateKey: templateKey || undefined, requestAiDraft });
            setJobId(result.id);
        } finally {
            setCreating(false);
        }
    };

    if (jobId != null) {
        return <JobProgressView jobId={jobId} onDone={(job) => { if (job.report_id) onCreated(job.report_id); else onCancel(); }} onCancelled={onCancel} />;
    }

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Generate Threat Brief from Existing Intelligence</span>
                <button type="button" className="ti-refresh-btn" onClick={onCancel}>Cancel</button>
            </div>
            {!selected || picking ? (
                <ContextPicker onPick={pick} onCancel={() => (selected ? setPicking(false) : onCancel())} />
            ) : (
                <>
                    <div className="ti-kv">
                        <span className="k">Selected Context</span>
                        <span className="v">{selected.label || `${selected.type} #${selected.id}`} <span className="ti-note">({selected.type.replace(/_/g, ' ')})</span> <button type="button" className="ti-action-btn" style={{ marginLeft: '8px' }} onClick={() => setPicking(true)}>Change</button></span>
                    </div>
                    <div className="tb-field-grid">
                        <label>
                            <span>Template (optional)</span>
                            <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                                <option value="">None (general Threat Brief)</option>
                                {availableTemplates.map(([key, t]) => <option key={key} value={key}>{t.label}</option>)}
                            </select>
                        </label>
                        <label style={{ flexDirection: 'row', alignItems: 'center', gap: '6px' }}>
                            <input type="checkbox" checked={requestAiDraft} onChange={(e) => setRequestAiDraft(e.target.checked)} />
                            <span>Generate AI Draft (falls back to a heuristic draft if AI is unavailable — brief creation always succeeds either way)</span>
                        </label>
                    </div>

                    {loadingContext ? <div className="ti-loading">Collecting context…</div> : contextError ? (
                        <div className="ti-error">{contextError}</div>
                    ) : context ? (
                        <ContextPanel context={context} />
                    ) : null}

                    <button type="button" className="ti-action-btn" style={{ marginTop: '12px', background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={generate} disabled={creating || loadingContext || !context}>
                        {creating ? 'Starting…' : 'Generate Threat Brief'}
                    </button>
                </>
            )}
        </div>
    );
};

const KeyFindingsEditor: React.FC<{ items: string[]; disabled: boolean; onChange: (items: string[]) => void }> = ({ items, disabled, onChange }) => {
    const [draft, setDraft] = useState('');
    const add = () => {
        const v = draft.trim();
        if (!v) return;
        onChange([...items, v]);
        setDraft('');
    };
    return (
        <div>
            {items.length === 0 ? <div className="ti-empty">No key findings recorded yet.</div> : (
                <ol className="tb-findings-list">
                    {items.map((f, i) => (
                        <li key={i}>
                            <span>{f}</span>
                            {!disabled && <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => onChange(items.filter((_, idx) => idx !== i))}>Remove</button>}
                        </li>
                    ))}
                </ol>
            )}
            {!disabled && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input type="text" placeholder="Add a key finding…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ flex: 1, ...textInputStyle() }} />
                    <button type="button" className="ti-action-btn" onClick={add} disabled={!draft.trim()}>Add</button>
                </div>
            )}
        </div>
    );
};

const ThreatContextPanel: React.FC<{ reportId: number; onOpenEntity?: (type: string, id: string) => void }> = ({ reportId, onOpenEntity }) => {
    const [graph, setGraph] = useState<RelationshipGraph | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        getRelationshipGraph('report', reportId, 2).then(setGraph).catch(() => setGraph(null)).finally(() => setLoading(false));
    }, [reportId]);

    if (loading) return <div className="ti-loading">Loading…</div>;
    if (!graph || graph.edges.length === 0) return <div className="ti-empty">No related intelligence found yet — attach entities below to build context.</div>;
    const nodeByKey = new Map(graph.nodes.map((n) => [`${n.type}:${n.id}`, n]));
    return (
        <div>
            <div className="tb-context-list">
                {graph.edges.map((e) => {
                    const src = nodeByKey.get(`${e.sourceType}:${e.sourceId}`);
                    const tgt = nodeByKey.get(`${e.targetType}:${e.targetId}`);
                    return (
                        <div className="tb-context-row" key={e.id}>
                            {src ? <EntityChip entity={src} onOpen={onOpenEntity} /> : <span className="ti-note">{e.sourceType} #{e.sourceId}</span>}
                            <span className="tb-context-arrow">→ {e.relationshipType.replace(/_/g, ' ')} →</span>
                            {tgt ? <EntityChip entity={tgt} onOpen={onOpenEntity} /> : <span className="ti-note">{e.targetType} #{e.targetId}</span>}
                        </div>
                    );
                })}
            </div>
            {graph.truncated && <div className="ti-note" style={{ marginTop: '8px' }}>Graph truncated to the closest matches — open an entity's own page for its full relationship graph.</div>}
        </div>
    );
};

const RiskPanel: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [data, setData] = useState<ReportRiskAssessment | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        getReportRiskAssessment(reportId).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
    }, [reportId]);

    if (loading) return <div className="ti-loading">Loading…</div>;
    if (!data || data.items.length === 0) return <div className="ti-empty">No referenced entities yet — attach Affected Entities to see their computed risk here.</div>;
    return (
        <div className="tb-risk-grid">
            {data.items.map((item, i) => (
                <div className="tb-risk-card" key={i}>
                    <div className="tb-risk-card-head">
                        <span className="ti-target">{item.label}</span>
                        <span className="ti-note">{item.entity_type.replace(/_/g, ' ')}</span>
                    </div>
                    {item.unsupported || !item.risk ? (
                        <div className="ti-note">Risk scoring is not yet implemented for this entity type — not fabricated.</div>
                    ) : (
                        <>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', margin: '6px 0' }}>
                                <RiskBadge risk={item.risk.level} /> <span className="ti-note">score {item.risk.score}/100</span> <ConfidenceBadge confidence={item.risk.confidence} />
                            </div>
                            <ul className="tb-risk-reasons">
                                {item.risk.reasons.map((r, j) => <li key={j}>{r}</li>)}
                            </ul>
                        </>
                    )}
                </div>
            ))}
        </div>
    );
};

const TimelinePanel: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [items, setItems] = useState<ReportTimelineItem[] | null>(null);
    useEffect(() => { getReportTimeline(reportId, { pageSize: 50 }).then((r) => setItems(r.items)).catch(() => setItems([])); }, [reportId]);
    if (items === null) return <div className="ti-loading">Loading…</div>;
    if (items.length === 0) return <div className="ti-empty">No timeline events recorded yet.</div>;
    return (
        <div className="tb-timeline">
            {items.map((e) => (
                <div className="tb-timeline-row" key={e.id}>
                    <span className="tb-timeline-dot" />
                    <div>
                        <div><strong>{e.action.replace(/_/g, ' ')}</strong> <span className="ti-note">· {e.source}{e.username ? ` · ${e.username}` : ''}</span></div>
                        {e.newValue && <div className="ti-note">{e.newValue}</div>}
                        <div className="ti-note">{formatDateTime(e.createdAt)}</div>
                    </div>
                </div>
            ))}
        </div>
    );
};

const RANK_LABELS: Record<string, string> = { primary: 'Primary', supporting: 'Supporting', contextual: 'Contextual' };

const EvidencePanel: React.FC<{ reportId: number; locked: boolean }> = ({ reportId, locked }) => {
    const [items, setItems] = useState<EvidenceItem[]>([]);
    const [rankings, setRankings] = useState<Record<number, EvidenceRanking>>({});
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ source: '', url: '', description: '', confidence: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([getEvidence('report', reportId), getReportEvidenceRankings(reportId).catch(() => [])]).then(([ev, rk]) => {
            setItems(ev);
            setRankings(Object.fromEntries(rk.map((r) => [r.evidence_id, r])));
        }).finally(() => setLoading(false));
    }, [reportId]);
    useEffect(() => { load(); }, [load]);

    const rerank = async (evidenceId: number, rank: string) => {
        await setEvidenceRank(reportId, evidenceId, { rank });
        load();
    };
    const toggleIncluded = async (evidenceId: number, included: boolean) => {
        const current = rankings[evidenceId];
        await setEvidenceRank(reportId, evidenceId, { rank: current?.rank || 'supporting', included });
        load();
    };

    const submit = async () => {
        if (!form.source.trim()) return;
        setSaving(true);
        try {
            await addEvidence({ entityType: 'report', entityId: reportId, source: form.source.trim(), url: form.url.trim() || undefined, description: form.description.trim() || undefined, confidence: form.confidence || undefined });
            setForm({ source: '', url: '', description: '', confidence: '' });
            setShowAdd(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    const remove = async (id: number) => { await deleteEvidence(id); load(); };

    return (
        <div>
            {!locked && (
                <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={() => setShowAdd((v) => !v)}>+ Add Evidence</button>
            )}
            {showAdd && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <input list="tb-evidence-types" type="text" placeholder="Evidence type / source…" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={{ minWidth: '200px', ...textInputStyle() }} />
                    <datalist id="tb-evidence-types">{EVIDENCE_TYPE_SUGGESTIONS.map((t) => <option key={t} value={t} />)}</datalist>
                    <input type="text" placeholder="Reference URL (optional)…" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} style={{ minWidth: '220px', ...textInputStyle() }} />
                    <input type="text" placeholder="Description (optional)…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ minWidth: '220px', ...textInputStyle() }} />
                    <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                        <option value="">Confidence…</option><option>Low</option><option>Medium</option><option>High</option>
                    </select>
                    <button type="button" className="ti-action-btn" onClick={submit} disabled={saving || !form.source.trim()}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            )}
            {loading ? <div className="ti-loading">Loading…</div> : items.length === 0 ? (
                <div className="ti-empty">No evidence attached yet.</div>
            ) : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {items.map((e) => {
                        const ranking = rankings[e.id];
                        const rank = ranking?.rank || 'supporting';
                        const included = ranking?.included !== false;
                        return (
                            <div key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: included ? 1 : 0.5 }}>
                                <div style={{ flex: 1 }}>
                                    <div><strong>{e.source}</strong> <span className={`ti-badge ti-badge--${rank === 'primary' ? 'high' : rank === 'supporting' ? 'medium' : 'none'}`}>{RANK_LABELS[rank]}</span> {e.confidence && <ConfidenceBadge confidence={e.confidence} />} {!included && <span className="ti-note">(excluded)</span>}</div>
                                    {e.url && <div><a href={e.url} target="_blank" rel="noreferrer" className="ti-note">{e.url}</a></div>}
                                    {e.description && <div className="ti-note">{e.description}</div>}
                                    <div className="ti-note">{formatDateTime(e.created_at)}{e.username ? ` · ${e.username}` : ''}</div>
                                    {ranking?.reasons && ranking.reasons.length > 0 && <div className="ti-note">Why: {ranking.reasons.join('; ')}</div>}
                                </div>
                                {!locked && (
                                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', flexShrink: 0, maxWidth: '220px', justifyContent: 'flex-end' }}>
                                        {rank !== 'primary' && <button type="button" className="ti-action-btn" onClick={() => rerank(e.id, 'primary')}>Promote to Primary</button>}
                                        {rank !== 'contextual' && <button type="button" className="ti-action-btn" onClick={() => rerank(e.id, 'contextual')}>Mark Contextual</button>}
                                        <button type="button" className="ti-action-btn" onClick={() => toggleIncluded(e.id, !included)}>{included ? 'Exclude' : 'Include'}</button>
                                        <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => remove(e.id)}>Remove</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const FRESHNESS_LABELS: Record<string, string> = { current: 'Current', updates_available: 'Updates Available', stale: 'Stale' };
const FreshnessBadge: React.FC<{ status: string }> = ({ status }) => (
    <span className={`ti-badge ti-badge--${status === 'current' ? 'low' : status === 'updates_available' ? 'high' : 'medium'}`}>{FRESHNESS_LABELS[status] || status}</span>
);

const PriorityBadge: React.FC<{ level: string }> = ({ level }) => (
    <span className={`ti-badge ti-badge--${level.toLowerCase()}`}>Priority: {level}</span>
);

const FreshnessPanel: React.FC<{ reportId: number; onChanged?: () => void }> = ({ reportId, onChanged }) => {
    const [freshness, setFreshness] = useState<FreshnessInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [checking, setChecking] = useState(false);
    const [aiSummary, setAiSummary] = useState<{ summary: string; note: string } | null>(null);
    const [aiBusy, setAiBusy] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getReportFreshness(reportId).then(setFreshness).finally(() => setLoading(false));
    }, [reportId]);
    useEffect(() => { load(); }, [load]);

    const runCheck = async () => {
        setChecking(true);
        try {
            await checkReportUpdates(reportId);
            load();
            onChanged?.();
        } finally {
            setChecking(false);
        }
    };

    const runAiChangeSummary = async () => {
        setAiBusy(true);
        try {
            const result = await generateAiChangeSummary(reportId);
            setAiSummary(result);
        } finally {
            setAiBusy(false);
        }
    };

    if (loading || !freshness) return <div className="ti-loading">Loading…</div>;
    const changes = freshness.pending_change_summary;

    return (
        <div>
            <div className="ti-kv">
                <span className="k">Status</span><span className="v"><FreshnessBadge status={freshness.freshness_status} /></span>
                <span className="k">Published</span><span className="v">{formatDate(freshness.published_at)}</span>
                <span className="k">Last Checked</span><span className="v">{freshness.last_change_check_at ? formatDateTime(freshness.last_change_check_at) : 'Never'}</span>
            </div>
            <button type="button" className="ti-action-btn" onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : 'Check for Updates'}</button>

            {changes && changes.isMeaningful && (
                <div className="ti-note tb-lock-banner" style={{ marginTop: '10px' }}>
                    <div className="ti-modal-subtitle" style={{ marginTop: 0 }}>Threat Brief Update — since last publication:</div>
                    <ul className="tb-findings-list">{changes.lines.map((l, i) => <li key={i} style={{ display: 'list-item' }}>{l}</li>)}</ul>
                    <button type="button" className="ti-action-btn" onClick={runAiChangeSummary} disabled={aiBusy}>{aiBusy ? 'Generating…' : 'Generate Change Summary'}</button>
                    {aiSummary && <div className="ti-note" style={{ marginTop: '8px' }}><strong>AI Draft</strong>: {aiSummary.summary}<div className="ti-note">{aiSummary.note}</div></div>}
                </div>
            )}
            {(!changes || !changes.isMeaningful) && <div className="ti-empty" style={{ marginTop: '10px' }}>No changes recorded since the last publication.</div>}
        </div>
    );
};

const RevisionsPanel: React.FC<{ reportId: number; status: string; onRevised?: () => void }> = ({ reportId, status, onRevised }) => {
    const [revisions, setRevisions] = useState<ReportRevision[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);
    const [compareA, setCompareA] = useState<string>('');
    const [compareB, setCompareB] = useState<string>('current');
    const [comparison, setComparison] = useState<RevisionComparison | null>(null);
    const [comparing, setComparing] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getReportRevisions(reportId).then((rv) => { setRevisions(rv); if (rv.length && !compareA) setCompareA(String(rv[0].revision_number)); }).finally(() => setLoading(false));
    }, [reportId]);
    useEffect(() => { load(); }, [load]);

    const startRevision = async () => {
        setStarting(true);
        try {
            await createReportRevision(reportId);
            onRevised?.();
        } finally {
            setStarting(false);
        }
    };

    const runCompare = async () => {
        if (!compareA || !compareB) return;
        setComparing(true);
        try {
            const a = compareA === 'current' ? 'current' : Number(compareA);
            const b = compareB === 'current' ? 'current' : Number(compareB);
            setComparison(await compareReportRevisions(reportId, a, b));
        } finally {
            setComparing(false);
        }
    };

    return (
        <div>
            {status === 'published' && (
                <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={startRevision} disabled={starting}>{starting ? 'Starting…' : 'Create Revision'}</button>
            )}
            {loading ? <div className="ti-loading">Loading…</div> : revisions.length === 0 ? (
                <div className="ti-empty">No published revisions yet — publishing this brief will record v1.</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Version</th><th>Severity</th><th>Confidence</th><th>Published</th><th>Author</th></tr></thead>
                            <tbody>
                                {revisions.map((r) => (
                                    <tr key={r.id}>
                                        <td>v{r.revision_number}</td>
                                        <td><RiskBadge risk={r.severity} /></td>
                                        <td><ConfidenceBadge confidence={r.confidence} /></td>
                                        <td>{formatDate(r.published_at)}</td>
                                        <td>{r.published_by_username || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '12px', flexWrap: 'wrap' }}>
                        <span className="ti-note">Compare</span>
                        <select value={compareA} onChange={(e) => setCompareA(e.target.value)}>
                            {revisions.map((r) => <option key={r.revision_number} value={r.revision_number}>v{r.revision_number}</option>)}
                        </select>
                        <span className="ti-note">vs</span>
                        <select value={compareB} onChange={(e) => setCompareB(e.target.value)}>
                            <option value="current">Current (live draft)</option>
                            {revisions.map((r) => <option key={r.revision_number} value={r.revision_number}>v{r.revision_number}</option>)}
                        </select>
                        <button type="button" className="ti-action-btn" onClick={runCompare} disabled={comparing}>{comparing ? 'Comparing…' : 'Compare'}</button>
                    </div>

                    {comparison && (
                        <div className="ti-kv" style={{ marginTop: '10px' }}>
                            <span className="k">Severity</span><span className="v">{comparison.severityChanged ? `${comparison.a.severity || '—'} → ${comparison.b.severity || '—'}` : 'No change'}</span>
                            <span className="k">Confidence</span><span className="v">{comparison.confidenceChanged ? `${comparison.a.confidence || '—'} → ${comparison.b.confidence || '—'}` : 'No change'}</span>
                            <span className="k">New Findings</span><span className="v">{comparison.newFindings.length ? comparison.newFindings.join('; ') : 'None'}</span>
                            <span className="k">Removed Findings</span><span className="v">{comparison.removedFindings.length ? comparison.removedFindings.join('; ') : 'None'}</span>
                            <span className="k">New Entities</span><span className="v">{comparison.newEntities.length ? comparison.newEntities.map((e) => e.label).join(', ') : 'None'}</span>
                            <span className="k">Removed Entities</span><span className="v">{comparison.removedEntities.length ? comparison.removedEntities.map((e) => e.label).join(', ') : 'None'}</span>
                            <span className="k">New Evidence</span><span className="v">{comparison.newEvidence.length}</span>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

const TrendPanel: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [window, setWindowVal] = useState<'24h' | '7d' | '30d' | '90d'>('7d');
    const [trend, setTrend] = useState<ThreatTrendResult & { insufficientContext?: boolean } | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        getReportTrend(reportId, window).then(setTrend).finally(() => setLoading(false));
    }, [reportId, window]);

    return (
        <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                {(['24h', '7d', '30d', '90d'] as const).map((w) => (
                    <button key={w} type="button" className="ti-action-btn" style={w === window ? { background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' } : undefined} onClick={() => setWindowVal(w)}>{w}</button>
                ))}
            </div>
            {loading ? <div className="ti-loading">Loading…</div> : trend?.insufficientContext ? (
                <div className="ti-empty">This brief has no linked intelligence context — trend requires one.</div>
            ) : (
                <div className="tb-risk-grid">
                    {Object.values(trend?.metrics || {}).map((m, i) => (
                        <div className="tb-risk-card" key={i}>
                            <div className="tb-risk-card-head"><span className="ti-target">{m.label}</span></div>
                            {m.insufficientData ? <div className="ti-note">{m.reason || 'Insufficient Historical Data'}</div> : (
                                <>
                                    <div className="ti-note">Current: {m.current} · Previous: {m.previous}</div>
                                    <div className="ti-note">Change: {m.changePct != null ? `${m.changePct > 0 ? '+' : ''}${m.changePct}%` : '—'}</div>
                                    <div className="ti-note">{m.interpretation}</div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const QualityScorePanel: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [quality, setQuality] = useState<BriefQualityScore | null>(null);
    useEffect(() => { getReportQualityScore(reportId).then(setQuality).catch(() => {}); }, [reportId]);
    if (!quality) return null;
    return (
        <div className="ti-note">
            Brief Quality: <strong>{quality.score}%</strong>
            {quality.missing.length > 0 && <span> · Missing: {quality.missing.join(', ')}</span>}
        </div>
    );
};

const DistributionPanel: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [method, setMethod] = useState<'download' | 'dashboard' | 'repository'>('download');
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    const run = async () => {
        setBusy(true);
        setResult(null);
        try {
            const r = await distributeReport(reportId, method);
            setResult(`Distributed via ${r.method}.`);
        } catch (err: any) {
            setResult(err?.message || 'Failed to distribute');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select value={method} onChange={(e) => setMethod(e.target.value as any)}>
                <option value="download">Download</option>
                <option value="dashboard">Internal Dashboard</option>
                <option value="repository">Report Repository</option>
            </select>
            <button type="button" className="ti-action-btn" onClick={run} disabled={busy}>{busy ? 'Distributing…' : 'Distribute'}</button>
            {result && <span className="ti-note">{result}</span>}
        </div>
    );
};

const ExecutiveView: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [view, setView] = useState<ExecutiveBriefView | null>(null);
    const [loading, setLoading] = useState(true);
    const [aiBusy, setAiBusy] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getExecutiveBriefView(reportId).then(setView).finally(() => setLoading(false));
    }, [reportId]);
    useEffect(() => { load(); }, [load]);

    const runAi = async () => {
        setAiBusy(true);
        try { await generateAiExecutiveSummary(reportId); load(); } finally { setAiBusy(false); }
    };

    if (loading || !view) return <div className="ti-loading">Loading…</div>;
    return (
        <div className="ti-card">
            <div className="ti-section-header"><span className="ti-card-title">Executive Threat Brief</span></div>
            <div className="ti-kv">
                <span className="k">Threat</span><span className="v">{view.threat}</span>
                <span className="k">Severity</span><span className="v"><RiskBadge risk={view.severity} /></span>
                <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={view.confidence} /></span>
                <span className="k">Current Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{view.currentStatus}</span>
                <span className="k">Current Risk</span><span className="v">{view.currentRisk ? <><RiskBadge risk={view.currentRisk.level} /> <span className="ti-note">score {view.currentRisk.score}/100</span></> : 'Not Available'}</span>
            </div>
            <div className="ti-note" style={{ marginTop: '8px' }}><strong>Business Impact</strong>: {view.businessImpact || 'Not Available — generate an AI Executive Summary or write one manually.'}</div>
            {view.keyChange && <div className="ti-note"><strong>Key Change</strong>: {view.keyChange}</div>}
            <div className="ti-note"><strong>Recommended Action</strong>: {view.recommendedAction || 'Not Available'}</div>
            <div style={{ marginTop: '8px' }}>
                <div className="ti-modal-subtitle">Affected Entities</div>
                {view.affectedEntities.length === 0 ? <div className="ti-empty">None linked.</div> : <div className="ti-chip-list">{view.affectedEntities.map((e, i) => <span key={i} className="ti-chip" style={{ cursor: 'default' }}>{e}</span>)}</div>}
            </div>
            <div style={{ marginTop: '8px' }}>
                <div className="ti-modal-subtitle">Key Evidence</div>
                {view.keyEvidence.length === 0 ? <div className="ti-empty">None on record.</div> : (
                    <ul className="tb-findings-list">{view.keyEvidence.map((e, i) => <li key={i} style={{ display: 'list-item' }}>{e.source}{e.description ? ` — ${e.description}` : ''}</li>)}</ul>
                )}
            </div>
            <button type="button" className="ti-action-btn" style={{ marginTop: '10px' }} onClick={runAi} disabled={aiBusy}>{aiBusy ? 'Generating…' : view.generatedFromAi ? 'Regenerate AI Executive Summary' : 'Generate AI Executive Summary'}</button>
            {view.generatedFromAi && <span className="ti-note" style={{ marginLeft: '8px' }}>AI-generated — review before distributing.</span>}
        </div>
    );
};

const ThreatBriefDetail: React.FC<{
    id: number; isAdmin: boolean; onBack: () => void; onOpenEntity?: (type: string, id: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
}> = ({ id, isAdmin, onBack, onOpenEntity, onOpenKnowledgeEntry, onCreateKnowledgeEntry }) => {
    const [report, setReport] = useState<ReportDetail | null>(null);
    const [meta, setMeta] = useState<ReportsMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [aiBusy, setAiBusy] = useState(false);
    const [aiNote, setAiNote] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [qualityBlock, setQualityBlock] = useState<QualityCheckResult | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [viewMode, setViewMode] = useState<'analyst' | 'executive'>('analyst');
    const [priority, setPriority] = useState<BriefPriority | null>(null);

    const [draft, setDraft] = useState({
        title: '', threat_category: '', severity: '', confidence: '', classification: 'Internal', audience: '',
        reporting_period_start: '', reporting_period_end: '', executive_summary: '', threat_overview: '',
        key_findings: [] as string[], analyst_assessment: '', recommendations: ''
    });

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getReport(id).then((r) => {
            setReport(r);
            setDraft({
                title: r.title, threat_category: r.threat_category || '', severity: r.severity || '', confidence: r.confidence || '',
                classification: r.classification || 'Internal', audience: r.audience || '',
                reporting_period_start: r.reporting_period_start || '', reporting_period_end: r.reporting_period_end || '',
                executive_summary: r.executive_summary || '', threat_overview: r.threat_overview || '',
                key_findings: r.key_findings || [], analyst_assessment: r.analyst_assessment || '', recommendations: r.recommendations || ''
            });
        }).catch((err) => setError(err?.message || 'Failed to load brief')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { getReportsMetadata().then(setMeta).catch(() => setMeta(null)); }, []);
    useEffect(() => { getReportPriority(id).then(setPriority).catch(() => setPriority(null)); }, [id, report?.status, report?.severity]);

    const locked = report ? isLocked(report.status) : false;

    const save = async () => {
        setSaving(true);
        setActionError(null);
        try {
            await updateReportFields(id, draft);
            load();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    const runAction = async (name: string, fn: () => Promise<unknown>) => {
        setActionBusy(name);
        setActionError(null);
        try {
            await fn();
            load();
        } catch (err: any) {
            setActionError(err?.message || `Failed to ${name}`);
        } finally {
            setActionBusy(null);
        }
    };

    const runAiDraft = async () => {
        setAiBusy(true);
        setAiNote(null);
        try {
            const result = await generateReportAiSummary(id);
            if (result.note) setAiNote(result.note);
            load();
        } finally {
            setAiBusy(false);
        }
    };

    const regenerateAiDraft = async () => {
        setAiBusy(true);
        setAiNote(null);
        try {
            const result = await regenerateReportAiDraft(id);
            setAiNote(result.note);
            load();
        } catch (err: any) {
            setAiNote(err?.message || 'Failed to regenerate draft');
        } finally {
            setAiBusy(false);
        }
    };

    const runPublish = async (force = false) => {
        setPublishing(true);
        setActionError(null);
        try {
            if (!force) {
                const quality = await getReportQualityCheck(id);
                if (!quality.canPublish) { setQualityBlock(quality); setPublishing(false); return; }
            }
            await publishReportForced(id, force);
            setQualityBlock(null);
            load();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    const pickEntity = async (item: SearchResultItem) => {
        await addReportEntity(id, item.type, item.id);
        setShowPicker(false);
        load();
    };
    const removeEntity = async (entityType: string, entityId: string) => {
        await removeReportEntity(id, entityType, entityId);
        load();
    };

    const runDelete = async () => {
        setActionBusy('delete');
        setActionError(null);
        try {
            await deleteReport(id);
            onBack();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to delete');
            setConfirmDelete(false);
        } finally {
            setActionBusy(null);
        }
    };

    const indicators = useMemo(() => report?.entities.filter((e) => e.entity_type === 'ioc') || [], [report]);

    if (error) return <div className="ti-card"><div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div></div>;
    if (loading || !report) return <div className="ti-card"><div className="ti-loading">Loading…</div></div>;

    return (
        <div className="tb-detail">
            <div className="ti-card">
                <div className="ti-section-header">
                    <div>
                        <button type="button" className="ti-refresh-btn" onClick={onBack} style={{ marginBottom: '8px' }}>‹ Back to Threat Briefs</button>
                        {locked ? (
                            <h2 style={{ margin: 0 }}>{report.title}</h2>
                        ) : (
                            <input type="text" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Threat Brief Title" style={{ ...textInputStyle(), fontSize: '1.15rem', width: '100%', maxWidth: '640px' }} />
                        )}
                    </div>
                    <div className="tb-lifecycle-actions">
                        {report.status === 'draft' && <button type="button" className="ti-action-btn" disabled={!!actionBusy} onClick={() => runAction('submit', () => submitReportForReview(id))}>{actionBusy === 'submit' ? 'Submitting…' : 'Submit for Review'}</button>}
                        {(report.status === 'draft' || report.status === 'review') && <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} disabled={publishing} onClick={() => runPublish(false)}>{publishing ? 'Publishing…' : 'Publish'}</button>}
                        {report.status !== 'archived' && <button type="button" className="ti-action-btn" disabled={!!actionBusy} onClick={() => runAction('archive', () => archiveReport(id))}>{actionBusy === 'archive' ? 'Archiving…' : 'Archive'}</button>}
                        <button type="button" className="ti-action-btn" onClick={() => downloadReportExportMode(id, report.title, viewMode)}>Export JSON ({viewMode === 'executive' ? 'Executive' : 'Analyst'})</button>
                        {(isAdmin || report.status === 'draft') && <button type="button" className="ti-action-btn ti-action-btn--danger" disabled={!!actionBusy} onClick={() => setConfirmDelete(true)}>Delete</button>}
                    </div>
                </div>

                {actionError && <div className="ti-error" style={{ marginBottom: '10px' }}>{actionError}</div>}

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <FreshnessBadge status={report.freshness_status} />
                    {priority && <PriorityBadge level={priority.level} />}
                    <span style={{ flex: 1 }} />
                    <div className="tb-view-toggle">
                        <button type="button" className={`ti-action-btn${viewMode === 'analyst' ? ' tb-view-toggle-active' : ''}`} onClick={() => setViewMode('analyst')}>Analyst View</button>
                        <button type="button" className={`ti-action-btn${viewMode === 'executive' ? ' tb-view-toggle-active' : ''}`} onClick={() => setViewMode('executive')}>Executive View</button>
                    </div>
                </div>

                <div className="ti-kv">
                    <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{STATUS_LABELS[report.status] || report.status}</span>
                    <span className="k">Severity</span><span className="v"><RiskBadge risk={draft.severity || report.severity} /></span>
                    <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={draft.confidence || report.confidence} /></span>
                    <span className="k">Author</span><span className="v">{report.author_username || '—'}</span>
                    <span className="k">Created</span><span className="v">{formatDate(report.created_at)}</span>
                    <span className="k">Updated</span><span className="v">{formatDate(report.updated_at)}</span>
                    {report.published_at && <><span className="k">Published</span><span className="v">{formatDate(report.published_at)}</span></>}
                    {report.archived_at && <><span className="k">Archived</span><span className="v">{formatDate(report.archived_at)}</span></>}
                </div>

                {locked && (
                    <div className="ti-note tb-lock-banner">
                        This brief is {report.status} — its authored content is a locked snapshot (THREAT_BRIEF_PHASE1.md §30). Referenced entity data below (Threat Context, Risk, Timeline) always reflects current intelligence; the narrative sections do not silently change.
                    </div>
                )}

                {!locked && (
                    <div className="tb-field-grid">
                        <label>
                            <span>Threat Category</span>
                            <select value={draft.threat_category} onChange={(e) => setDraft((d) => ({ ...d, threat_category: e.target.value }))}>
                                <option value="">None</option>
                                {(meta?.threatCategories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Severity</span>
                            <select value={draft.severity} onChange={(e) => setDraft((d) => ({ ...d, severity: e.target.value }))}>
                                <option value="">None</option>
                                {(meta?.severityLevels || []).map((s) => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Confidence</span>
                            <select value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))}>
                                <option value="">None</option>
                                {(meta?.confidenceLevels || []).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Classification</span>
                            <select value={draft.classification} onChange={(e) => setDraft((d) => ({ ...d, classification: e.target.value }))}>
                                {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Audience</span>
                            <input type="text" placeholder="e.g. SOC Team, Executives" value={draft.audience} onChange={(e) => setDraft((d) => ({ ...d, audience: e.target.value }))} style={textInputStyle()} />
                        </label>
                        <label>
                            <span>Reporting Period</span>
                            <div style={{ display: 'flex', gap: '6px' }}>
                                <input type="date" value={draft.reporting_period_start} onChange={(e) => setDraft((d) => ({ ...d, reporting_period_start: e.target.value }))} style={textInputStyle()} />
                                <input type="date" value={draft.reporting_period_end} onChange={(e) => setDraft((d) => ({ ...d, reporting_period_end: e.target.value }))} style={textInputStyle()} />
                            </div>
                        </label>
                    </div>
                )}
                {locked && (
                    <div className="ti-kv">
                        <span className="k">Category</span><span className="v">{report.threat_category || '—'}</span>
                        <span className="k">Classification</span><span className="v">{report.classification}</span>
                        <span className="k">Audience</span><span className="v">{report.audience || '—'}</span>
                        <span className="k">Reporting Period</span><span className="v">{report.reporting_period_start || '—'} → {report.reporting_period_end || '—'}</span>
                    </div>
                )}
            </div>

            {viewMode === 'executive' && <ExecutiveView reportId={id} />}

            {viewMode === 'analyst' && <>
            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Executive Summary</span></div>
                {locked ? <p className="tb-readonly-text">{report.executive_summary || '—'}</p> : (
                    <textarea value={draft.executive_summary} onChange={(e) => setDraft((d) => ({ ...d, executive_summary: e.target.value }))} rows={4} style={textareaStyle()} placeholder="What happened? Why does it matter? Who or what is affected? What evidence supports the finding? What should happen next?" />
                )}
                {report.ai_draft ? (
                    <div className="ti-note tb-ai-draft">
                        <strong>AI Draft</strong> — {report.ai_draft.note} Not confirmed intelligence; review every section before applying it.
                        <div style={{ marginTop: '6px', whiteSpace: 'pre-wrap' }}>{report.ai_draft.executiveSummary}</div>
                        {!locked && <button type="button" className="ti-action-btn" style={{ marginTop: '6px' }} onClick={() => setDraft((d) => ({ ...d, executive_summary: report.ai_draft?.executiveSummary || '' }))}>Copy into Executive Summary</button>}
                    </div>
                ) : report.ai_summary_draft && (
                    <div className="ti-note tb-ai-draft">
                        <strong>AI Draft</strong> — review and edit before publishing, not confirmed intelligence:
                        <div style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{report.ai_summary_draft}</div>
                        {!locked && <button type="button" className="ti-action-btn" style={{ marginTop: '6px' }} onClick={() => setDraft((d) => ({ ...d, executive_summary: report.ai_summary_draft || '' }))}>Copy into Executive Summary</button>}
                    </div>
                )}
                {!locked && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button type="button" className="ti-action-btn" onClick={runAiDraft} disabled={aiBusy}>{aiBusy ? 'Generating…' : 'Generate AI Draft (Executive Summary only)'}</button>
                        {report.context_type && (
                            <button type="button" className="ti-action-btn" onClick={regenerateAiDraft} disabled={aiBusy}>
                                {aiBusy ? 'Regenerating…' : report.ai_draft ? '[Regenerate Draft]' : 'Generate Full AI Draft (all sections)'}
                            </button>
                        )}
                    </div>
                )}
                {aiNote && <div className="ti-note">{aiNote}</div>}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Threat Overview</span></div>
                {locked ? <p className="tb-readonly-text">{report.threat_overview || '—'}</p> : (
                    <textarea value={draft.threat_overview} onChange={(e) => setDraft((d) => ({ ...d, threat_overview: e.target.value }))} rows={4} style={textareaStyle()} />
                )}
                {report.ai_draft?.threatOverview && !locked && (
                    <div className="ti-note tb-ai-draft">
                        <strong>AI Draft</strong>: <span style={{ whiteSpace: 'pre-wrap' }}>{report.ai_draft.threatOverview}</span>
                        <div><button type="button" className="ti-action-btn" style={{ marginTop: '6px' }} onClick={() => setDraft((d) => ({ ...d, threat_overview: report.ai_draft?.threatOverview || '' }))}>Copy into Threat Overview</button></div>
                    </div>
                )}
                {report.ai_draft && (
                    <div className="tb-context-list" style={{ marginTop: '10px' }}>
                        <div className="ti-note"><strong>Affected Entities</strong>: {report.ai_draft.affectedEntitiesSummary}</div>
                        <div className="ti-note"><strong>Threat Context</strong>: {report.ai_draft.threatContext}</div>
                        <div className="ti-note"><strong>Timeline Summary</strong>: {report.ai_draft.timelineSummary}</div>
                        <div className="ti-note"><strong>Risk Summary</strong>: {report.ai_draft.riskSummary}</div>
                    </div>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Key Findings</span></div>
                <KeyFindingsEditor items={draft.key_findings} disabled={locked} onChange={(items) => setDraft((d) => ({ ...d, key_findings: items }))} />
                {report.ai_draft && report.ai_draft.keyFindings.length > 0 && !locked && (
                    <div className="ti-note tb-ai-draft" style={{ marginTop: '10px' }}>
                        <strong>AI Draft findings</strong>:
                        <ul className="tb-findings-list">{report.ai_draft.keyFindings.map((f, i) => <li key={i} style={{ display: 'list-item' }}>{f}</li>)}</ul>
                        <button type="button" className="ti-action-btn" onClick={() => setDraft((d) => ({ ...d, key_findings: [...new Set([...d.key_findings, ...(report.ai_draft?.keyFindings || [])])] }))}>Add AI findings to Key Findings</button>
                    </div>
                )}
            </div>

            {!locked && (
                <div className="ti-card" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    <button type="button" className="ti-action-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
            )}

            <div className="ti-card">
                <div className="ti-section-header">
                    <span className="ti-card-title">Affected Entities ({report.entities.length})</span>
                    {!locked && <button type="button" className="ti-action-btn" onClick={() => setShowPicker((v) => !v)}>+ Add Entity</button>}
                </div>
                {showPicker && <EntityPicker onPick={pickEntity} onCancel={() => setShowPicker(false)} placeholder="Search IOCs, campaigns, actors, malware, CVEs, companies, brands, Telegram sources, social accounts…" />}
                {report.entities.length === 0 ? <div className="ti-empty">No entities referenced yet.</div> : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {report.entities.map((e, i) => (
                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0' }}>
                                <EntityChip entity={e.entity} onOpen={onOpenEntity} />
                                <span className="ti-note">added {formatDate(e.added_at)}</span>
                                {!locked && <button type="button" className="ti-action-btn ti-action-btn--danger" style={{ marginLeft: 'auto' }} onClick={() => removeEntity(e.entity_type, e.entity_id)}>Remove</button>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Threat Indicators ({indicators.length})</span></div>
                {indicators.length === 0 ? <div className="ti-empty">No IOC-type indicators attached — add an IOC as an Affected Entity above to list it here.</div> : (
                    <div className="ti-chip-list">{indicators.map((e, i) => <EntityChip key={i} entity={e.entity} onOpen={onOpenEntity} />)}</div>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Threat Context</span></div>
                <ThreatContextPanel reportId={report.id} onOpenEntity={onOpenEntity} />
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Timeline</span></div>
                <TimelinePanel reportId={report.id} />
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Risk Assessment</span></div>
                <RiskPanel reportId={report.id} />
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Evidence</span></div>
                <EvidencePanel reportId={report.id} locked={locked} />
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Analyst Assessment</span></div>
                {locked ? <p className="tb-readonly-text">{report.analyst_assessment || '—'}</p> : (
                    <textarea value={draft.analyst_assessment} onChange={(e) => setDraft((d) => ({ ...d, analyst_assessment: e.target.value }))} rows={3} style={textareaStyle()} placeholder='e.g. "Observed infrastructure demonstrates strong overlap with an existing phishing campaign. Confidence is medium because attribution has not been independently established."' />
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Recommendations</span></div>
                {locked ? <p className="tb-readonly-text">{report.recommendations || '—'}</p> : (
                    <textarea value={draft.recommendations} onChange={(e) => setDraft((d) => ({ ...d, recommendations: e.target.value }))} rows={3} style={textareaStyle()} placeholder="Monitor IOC, investigate domain/threat actor, review related campaign, add to watchlist, open investigation, escalate incident…" />
                )}
                {report.ai_draft && report.ai_draft.recommendations.length > 0 && !locked && (
                    <div className="ti-note tb-ai-draft" style={{ marginTop: '10px' }}>
                        <strong>AI Draft recommendations</strong>:
                        <ul className="tb-findings-list">{report.ai_draft.recommendations.map((r, i) => <li key={i} style={{ display: 'list-item' }}>{r}</li>)}</ul>
                        <button type="button" className="ti-action-btn" onClick={() => setDraft((d) => ({ ...d, recommendations: [d.recommendations, ...(report.ai_draft?.recommendations || [])].filter(Boolean).join('\n') }))}>Copy into Recommendations</button>
                    </div>
                )}
            </div>

            {!locked && (
                <div className="ti-card" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.2)' }}>
                    <button type="button" className="ti-action-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                </div>
            )}

            {report.status === 'published' && (
                <div className="ti-card">
                    <div className="ti-section-header"><span className="ti-card-title">Freshness & Updates</span></div>
                    <FreshnessPanel reportId={id} onChanged={load} />
                </div>
            )}

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Version History</span></div>
                <RevisionsPanel reportId={id} status={report.status} onRevised={load} />
                <div style={{ marginTop: '10px' }}><QualityScorePanel reportId={id} /></div>
            </div>

            {report.context_type && (
                <div className="ti-card">
                    <div className="ti-section-header"><span className="ti-card-title">Threat Trends</span></div>
                    <TrendPanel reportId={id} />
                </div>
            )}

            {report.status === 'published' && (
                <div className="ti-card">
                    <div className="ti-section-header"><span className="ti-card-title">Distribution</span></div>
                    <DistributionPanel reportId={id} />
                </div>
            )}

            {/* KNOWLEDGE_BASE_PHASE2.md §10 "KNOWLEDGE TO THREAT BRIEF" — [Add to
                Brief Context] reuses the SAME addReportEntity('knowledge_entry', …)
                mechanism Phase 1 already made valid for reports, never copying
                the Knowledge Entry's content into the brief itself. */}
            {report.context_type && report.context_id && (
                <KnowledgeContextPanel entityType={report.context_type} entityId={report.context_id} entityLabel={report.title}
                    onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                    onAddToBriefContext={(knowledgeEntryId) => addReportEntity(id, 'knowledge_entry', knowledgeEntryId).then(load)} />
            )}
            </>}

            {confirmDelete && (
                <ConfirmDialog title="Delete Threat Brief" text="Delete this brief? This cannot be undone." busy={actionBusy === 'delete'} confirmLabel="Delete" onCancel={() => setConfirmDelete(false)} onConfirm={runDelete} />
            )}

            {qualityBlock && (
                <div className="ti-confirm-overlay" role="dialog" aria-modal="true" aria-label="Cannot Publish">
                    <div className="ti-confirm">
                        <div className="ti-confirm-title">Cannot Publish</div>
                        <div className="ti-confirm-text">Reason: {qualityBlock.insufficientEvidence ? 'Insufficient Evidence' : 'Quality check failed'}</div>
                        <ul className="tb-findings-list" style={{ textAlign: 'left', paddingLeft: '18px' }}>
                            {qualityBlock.issues.map((issue, i) => <li key={i} style={{ display: 'list-item' }}>{issue}</li>)}
                        </ul>
                        <div className="ti-confirm-actions">
                            <button type="button" className="ti-confirm-cancel" onClick={() => setQualityBlock(null)} disabled={publishing}>Cancel</button>
                            {isAdmin && (
                                <button type="button" className="ti-confirm-danger" onClick={() => runPublish(true)} disabled={publishing}>{publishing ? 'Publishing…' : 'Publish Anyway (Limited Assessment)'}</button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

const ThreatBriefsList: React.FC<{ isAdmin: boolean; onOpen: (id: number) => void; onCreated: (id: number) => void; onGenerate: () => void }> = ({ onOpen, onCreated, onGenerate }) => {
    const [meta, setMeta] = useState<ReportsMetadata | null>(null);
    const [filters, setFilters] = useState({ q: '', status: 'all', threatCategory: 'all', severity: 'all' });
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<IntelligenceReport[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);

    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [form, setForm] = useState({ title: '', reportType: '', threatCategory: '', severity: '', confidence: '', classification: 'Internal', audience: '', reportingPeriodStart: '', reportingPeriodEnd: '' });

    useEffect(() => { getReportsMetadata().then((m) => { setMeta(m); setForm((f) => ({ ...f, reportType: m.reportTypes[0] || '' })); }).catch(() => setMeta(null)); }, []);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getReports({
            q: filters.q || undefined, status: filters.status !== 'all' ? filters.status : undefined,
            threatCategory: filters.threatCategory !== 'all' ? filters.threatCategory : undefined,
            severity: filters.severity !== 'all' ? filters.severity : undefined, page, pageSize
        }).then((res) => { setItems(res.items); setTotal(res.total); }).catch((err) => setError(err?.message || 'Failed to load Threat Briefs')).finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const runCreate = async () => {
        if (!form.title.trim() || !form.reportType) return;
        setCreating(true);
        setCreateError(null);
        try {
            const result = await createReport({
                title: form.title.trim(), reportType: form.reportType, classification: form.classification,
                threatCategory: form.threatCategory || undefined, severity: form.severity || undefined, confidence: form.confidence || undefined,
                audience: form.audience.trim() || undefined, reportingPeriodStart: form.reportingPeriodStart || undefined, reportingPeriodEnd: form.reportingPeriodEnd || undefined
            });
            setShowCreate(false);
            setForm((f) => ({ ...f, title: '', threatCategory: '', severity: '', confidence: '', audience: '', reportingPeriodStart: '', reportingPeriodEnd: '' }));
            onCreated(result.id);
        } catch (err: any) {
            setCreateError(err?.message || 'Failed to create Threat Brief');
        } finally {
            setCreating(false);
        }
    };

    const runDelete = async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        setDeleteError(null);
        try {
            await deleteReport(confirmDeleteId);
            setConfirmDeleteId(null);
            load();
        } catch (err: any) {
            setDeleteError(err?.message || 'Failed to delete');
        } finally {
            setDeleting(false);
        }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.status === 'all' && filters.threatCategory === 'all' && filters.severity === 'all';

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Threat Briefs</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={onGenerate}>⚡ Generate from Intelligence</button>
                    <button type="button" className="ti-action-btn" onClick={() => setShowCreate((v) => !v)}>+ Create Blank Brief</button>
                </div>
            </div>

            {showCreate && (
                <div className="tb-create-form">
                    {createError && <div className="ti-error">{createError}</div>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input type="text" placeholder="Threat Brief title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ minWidth: '260px', ...textInputStyle() }} />
                        <select value={form.reportType} onChange={(e) => setForm((f) => ({ ...f, reportType: e.target.value }))}>
                            {(meta?.reportTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <select value={form.threatCategory} onChange={(e) => setForm((f) => ({ ...f, threatCategory: e.target.value }))}>
                            <option value="">Threat Category…</option>
                            {(meta?.threatCategories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))}>
                            <option value="">Severity…</option>
                            {(meta?.severityLevels || []).map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                        <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                            <option value="">Confidence…</option>
                            {(meta?.confidenceLevels || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={form.classification} onChange={(e) => setForm((f) => ({ ...f, classification: e.target.value }))}>
                            {CLASSIFICATIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <input type="text" placeholder="Audience (optional)…" value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} style={{ minWidth: '160px', ...textInputStyle() }} />
                        <input type="date" title="Reporting period start" value={form.reportingPeriodStart} onChange={(e) => setForm((f) => ({ ...f, reportingPeriodStart: e.target.value }))} style={textInputStyle()} />
                        <input type="date" title="Reporting period end" value={form.reportingPeriodEnd} onChange={(e) => setForm((f) => ({ ...f, reportingPeriodEnd: e.target.value }))} style={textInputStyle()} />
                        <button type="button" className="ti-action-btn" onClick={runCreate} disabled={creating || !form.title.trim() || !form.reportType}>{creating ? 'Creating…' : 'Create'}</button>
                    </div>
                </div>
            )}

            <div className="ti-filters">
                <input type="text" placeholder="Search title…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    {(meta?.statuses || ['draft', 'review', 'published', 'archived']).map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                </select>
                <select value={filters.threatCategory} onChange={(e) => { setFilters((f) => ({ ...f, threatCategory: e.target.value })); setPage(1); }}>
                    <option value="all">All Categories</option>
                    {(meta?.threatCategories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.severity} onChange={(e) => { setFilters((f) => ({ ...f, severity: e.target.value })); setPage(1); }}>
                    <option value="all">All Severities</option>
                    {(meta?.severityLevels || []).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No Threat Briefs yet — create one from existing intelligence.' : 'No Threat Briefs match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Title</th><th>Severity</th><th>Confidence</th><th>Status</th><th>Freshness</th><th>Category</th><th>Author</th><th>Created</th><th>Updated</th><th>Action</th></tr></thead>
                            <tbody>
                                {items.map((r) => (
                                    <tr key={r.id} className="ti-row-clickable" onClick={() => onOpen(r.id)}>
                                        <td><span className="ti-target" title={r.title}>{r.title}</span></td>
                                        <td><RiskBadge risk={r.severity} /></td>
                                        <td><ConfidenceBadge confidence={r.confidence} /></td>
                                        <td style={{ textTransform: 'capitalize' }}>{STATUS_LABELS[r.status] || r.status}</td>
                                        <td>{r.status === 'published' ? <FreshnessBadge status={r.freshness_status} /> : '—'}</td>
                                        <td>{r.threat_category || '—'}</td>
                                        <td>{r.author_username || '—'}</td>
                                        <td>{formatDate(r.created_at)}</td>
                                        <td>{formatDate(r.updated_at)}</td>
                                        <td>
                                            <div className="ti-row-actions" style={{ display: 'flex', gap: '6px' }}>
                                                <button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); onOpen(r.id); }}>View</button>
                                                <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(r.id); }}>Delete</button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}

            {confirmDeleteId != null && (
                <ConfirmDialog title="Delete Threat Brief" text="Delete this brief? This cannot be undone." meta={deleteError} busy={deleting} confirmLabel="Delete" onCancel={() => { setConfirmDeleteId(null); setDeleteError(null); }} onConfirm={runDelete} />
            )}
        </div>
    );
};

// §17/§34 "MULTI THREAT BRIEF DASHBOARD" / "THREAT REPORTING DASHBOARD" —
// real counts only (never placeholder numbers), ownership-scoped exactly
// like the list.
const BriefingDashboardView: React.FC<{ onOpenReport: (id: number) => void }> = ({ onOpenReport }) => {
    const [dashboard, setDashboard] = useState<BriefingDashboard | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        getBriefingDashboard().then(setDashboard).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    if (loading || !dashboard) return <div className="ti-card"><div className="ti-loading">Loading…</div></div>;

    const tiles: { label: string; value: number }[] = [
        { label: 'Active Briefs', value: dashboard.activeBriefs },
        { label: 'Published', value: dashboard.publishedBriefs },
        { label: 'Drafts', value: dashboard.drafts },
        { label: 'In Review', value: dashboard.inReview },
        { label: 'Updates Available', value: dashboard.updatesAvailable },
        { label: 'Stale', value: dashboard.staleBriefs },
        { label: 'High Risk', value: dashboard.highRisk },
        { label: 'Critical', value: dashboard.critical },
        { label: 'Scheduled', value: dashboard.scheduledBriefs }
    ];

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Intelligence Briefing Dashboard</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>Refresh</button>
            </div>
            <div className="tb-dashboard-grid">
                {tiles.map((t) => (
                    <div className="tb-dashboard-tile" key={t.label}>
                        <div className="tb-dashboard-value">{t.value}</div>
                        <div className="tb-dashboard-label">{t.label}</div>
                    </div>
                ))}
            </div>
            <div style={{ marginTop: '16px' }}>
                <div className="ti-modal-subtitle">Recent Changes</div>
                {dashboard.recentChanges.length === 0 ? <div className="ti-empty">No recent activity.</div> : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {dashboard.recentChanges.map((c) => (
                            <div key={c.id} className="ti-row-clickable" style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => onOpenReport(c.reportId)}>
                                <span style={{ textTransform: 'capitalize' }}>{c.action.replace(/_/g, ' ')}</span>
                                <span className="ti-note">{c.newValue}</span>
                                <span style={{ flex: 1 }} />
                                <span className="ti-note">{c.username} · {formatDateTime(c.createdAt)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

interface ThreatBriefsPageProps {
    isAdmin: boolean; initialContext?: { type: string; id: string } | null; onInitialContextConsumed?: () => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    // Opening ONE specific existing brief from outside this page — the same
    // handoff pattern KnowledgeBasePage's own initialOpenId already uses.
    // Threat Intelligence's unified search bar used to route a `report` hit
    // into its own now-removed Reports section; those rows are these rows
    // (both read /api/intelligence/reports), so the search hit opens the
    // brief here instead of a second UI over the same records.
    initialOpenId?: number | null;
    onInitialOpenIdConsumed?: () => void;
}

type ThreatBriefsPageMode = 'list' | 'detail' | 'generate' | 'dashboard';

const ThreatBriefsPage: React.FC<ThreatBriefsPageProps> = ({ isAdmin, initialContext, onInitialContextConsumed, onOpenKnowledgeEntry, onCreateKnowledgeEntry, initialOpenId, onInitialOpenIdConsumed }) => {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mode, setMode] = useState<ThreatBriefsPageMode>(initialContext ? 'generate' : 'list');

    useEffect(() => {
        if (initialContext) { setMode('generate'); onInitialContextConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialContext]);

    useEffect(() => {
        if (initialOpenId != null) { setSelectedId(initialOpenId); setMode('detail'); onInitialOpenIdConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialOpenId]);

    return (
        <div className="ti-page tb-page">
            <div className="ti-header">
                <h1>Threat Briefs</h1>
                <p className="ti-subtitle">Structured, analyst-authored briefings aggregated from existing LekirraX intelligence — Threat Intelligence, OSINT modules, Investigations, and Monitoring — never a new collection engine.</p>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className={`ti-action-btn${mode === 'list' || mode === 'detail' ? ' tb-view-toggle-active' : ''}`} onClick={() => setMode('list')}>Briefs</button>
                    <button type="button" className={`ti-action-btn${mode === 'dashboard' ? ' tb-view-toggle-active' : ''}`} onClick={() => setMode('dashboard')}>Dashboard</button>
                </div>
            </div>
            <div className="ti-container">
                <div className="ti-content">
                    {mode === 'generate' ? (
                        <GenerateThreatBriefWizard
                            initialContext={initialContext || undefined}
                            onCreated={(reportId) => { setSelectedId(reportId); setMode('detail'); }}
                            onCancel={() => setMode('list')}
                        />
                    ) : mode === 'detail' && selectedId != null ? (
                        <ThreatBriefDetail id={selectedId} isAdmin={isAdmin} onBack={() => { setSelectedId(null); setMode('list'); }} onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                    ) : mode === 'dashboard' ? (
                        <BriefingDashboardView onOpenReport={(id) => { setSelectedId(id); setMode('detail'); }} />
                    ) : (
                        <ThreatBriefsList
                            isAdmin={isAdmin}
                            onOpen={(id) => { setSelectedId(id); setMode('detail'); }}
                            onCreated={(id) => { setSelectedId(id); setMode('detail'); }}
                            onGenerate={() => setMode('generate')}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default ThreatBriefsPage;
