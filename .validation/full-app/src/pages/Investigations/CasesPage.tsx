// INVESTIGATIONS_PHASE1.md — Cases (Case Management Foundation).
//
// Investigation is the CASE layer (§1). This page reuses the existing
// LekirraX design system (dark + cyan, ti-* cards/tables/badges from
// ThreatIntelligencePage.css), the existing API conventions
// (intelligenceJson / { items, total, page, pageSize }), and the existing
// cross-module handoffs (createThreatBriefFrom, createKnowledgeEntryForEntity)
// — never a duplicate intelligence/evidence/timeline/risk engine (§1/§55).

import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    getCaseMeta, getCaseDashboard, getCases, getCase, createCase, updateCase,
    addCaseTarget, removeCaseTarget,
    searchCaseEvidence, attachCaseEvidence, createCaseEvidence, removeCaseEvidence,
    addCaseNote, updateCaseNote, deleteCaseNote,
    addCaseFinding, updateCaseFinding, deleteCaseFinding,
    addCaseTag, removeCaseTag,
    getCaseTimeline, getCaseActivity,
    closeCase, reopenCase, monitorCaseTarget, exportCase,
    type CaseMeta, type CaseDashboardStats, type CaseListItem, type CaseDetail,
    type CaseStatus, type CaseSeverity, type CasePriority, type CaseNoteType,
    type CaseFindingConfidence, type CaseTimelineItem,
    // INVESTIGATIONS_PHASE2.md
    getCaseCorrelation, getCaseIocs, getCaseChanges,
    addCaseHypothesis, updateCaseHypothesis, deleteCaseHypothesis,
    addHypothesisEvidence, removeHypothesisEvidence,
    addCaseTask, updateCaseTask, deleteCaseTask,
    classifyCaseEvidence,
    getCaseRisk, getCaseAlerts, getCaseMonitoring, getCaseKnowledge, getCaseModuleContext,
    getCaseGraph, getCaseSnapshot, getCaseSummary, getCaseRecommendations, generateCaseReport,
    // INVESTIGATIONS_PHASE3.md
    getCaseAssessment, saveCaseAssessment,
    getCaseEvidenceReview, getCaseEvidenceCompleteness, getCaseEvidenceConflicts,
    getCaseClosureChecklist, archiveCase,
    getCasePostClosureActivity, getCasePostClosureIntelligence,
    getCaseRecommendationRecords, addCaseRecommendationRecord, updateCaseRecommendationRecord,
    getCaseLessons, addCaseLesson, deleteCaseLesson,
    getCaseReview, submitCaseForReview, updateCaseReviewStatus, addCaseReviewComment,
    getCaseReportVersions, createCaseReportVersion,
    getCaseQuality, getCaseMetrics,
    draftCaseClosureSummary, draftCaseLessonsLearned,
    type CaseHypothesisStatus, type CaseHypothesisConfidence, type CaseHypothesisEvidenceRole,
    type CaseTaskStatus, type CaseTaskPriority,
    type CaseFindingStatus, type CaseEvidenceClassification,
    type CaseCorrelation, type CaseIoc, type CaseChangeItem,
    type CaseRisk, type CaseAlertItem, type CaseMonitorItem, type CaseKnowledgeItem, type CaseModuleContextSection,
    type CaseGraph, type CaseSnapshot, type CaseSummary, type CaseRecommendation, type CaseReport,
    type CaseConclusionConfidence, type CaseImpactCategory, type CaseLessonCategory,
    type CaseRecommendationStatus, type CaseReviewStatus, type CaseReviewCommentType,
    type CaseEvidenceReview, type CaseEvidenceCompleteness, type CaseEvidenceConflict, type CaseClosureChecklist,
    type CaseRecommendationRecord, type CaseLesson, type CaseReview, type CaseReportVersionSummary,
    type CaseQuality, type CaseMetrics, type CasePostClosureActivity, type CasePostClosureIntelligence,
    type CaseAssessment,
    // SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order —
    // optionally tag a case to a client organization at creation.
    getClients, type PlatformClient,
} from '../../services/api';
import { searchIntelligence } from '../../services/api';
import { formatDateTime, ConfirmDialog } from '../ThreatIntelligence/ThreatIntelligenceShared';
import { timeAgo } from '../../utils/timeAgo';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import './CasesPage.css';
import Pagination from '../../components/shared/Pagination';  // P2-8
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here

// ─── Constants (mirrors the backend enums; real values only) ─────────────

const STATUS_LABELS: Record<CaseStatus, string> = {
    open: 'Open', investigating: 'Investigating', pending: 'Pending',
    resolved: 'Resolved', closed: 'Closed', archived: 'Archived',
};
const SEVERITY_LABELS: Record<CaseSeverity, string> = { Low: 'Low', Medium: 'Medium', High: 'High', Critical: 'Critical' };
const PRIORITY_LABELS: Record<CasePriority, string> = { Low: 'Low', Medium: 'Medium', High: 'High', Critical: 'Critical' };
const NOTE_TYPE_LABELS: Record<CaseNoteType, string> = {
    general: 'General', observation: 'Observation', hypothesis: 'Hypothesis',
    finding: 'Finding', decision: 'Decision',
};
// INVESTIGATIONS_PHASE2.md §13/§15/§18/§20/§39/§9 — real backend enums only.
const HYPOTHESIS_STATUS_LABELS: Record<CaseHypothesisStatus, string> = {
    open: 'Open', testing: 'Testing', supported: 'Supported',
    contradicted: 'Contradicted', rejected: 'Rejected', resolved: 'Resolved',
};
const TASK_STATUS_LABELS: Record<CaseTaskStatus, string> = {
    pending: 'Pending', in_progress: 'In Progress', blocked: 'Blocked',
    completed: 'Completed', cancelled: 'Cancelled',
};
const FINDING_STATUS_LABELS: Record<CaseFindingStatus, string> = {
    open: 'Open', under_review: 'Under Review', confirmed: 'Confirmed',
    rejected: 'Rejected', resolved: 'Resolved',
};
const EVIDENCE_CLASSIFICATION_LABELS: Record<CaseEvidenceClassification, string> = {
    primary: 'Primary', supporting: 'Supporting', contextual: 'Contextual', contradicting: 'Contradicting',
};
const CONFIDENCE_LEVELS: CaseFindingConfidence[] = ['High', 'Medium', 'Low', 'Unknown'];
const TYPE_LABELS: Record<string, string> = {
    ioc_investigation: 'IOC Investigation', malware_investigation: 'Malware Investigation',
    apt_investigation: 'APT Investigation', phishing_investigation: 'Phishing Investigation',
    brand_abuse: 'Brand Abuse', social_investigation: 'Social Media Investigation',
    telegram_investigation: 'Telegram Investigation', domain_investigation: 'Domain Investigation',
    incident_investigation: 'Incident Investigation', threat_investigation: 'Threat Investigation',
};

function textInputStyle(): React.CSSProperties {
    return { background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.82rem', fontFamily: 'inherit' };
}
function textareaStyle(): React.CSSProperties {
    return { ...textInputStyle(), width: '100%', resize: 'vertical' as const };
}

function SeverityPill({ severity }: { severity: CaseSeverity }) {
    return <span className={`ti-badge ti-badge--${severity.toLowerCase()}`}>{severity}</span>;
}
function PriorityPill({ priority }: { priority: CasePriority }) {
    return <span className={`ti-badge ti-badge--${priority.toLowerCase()}`}>{priority}</span>;
}
function StatusPill({ status }: { status: CaseStatus }) {
    return <span className={`case-pill case-pill--status-${status}`}>{STATUS_LABELS[status]}</span>;
}

interface CasesPageProps {
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    // NOTES_PHASE2.md §13/§62 "[View Notes]" — opens the centralized Notes
    // page pre-filtered to this case, same handoff shape as onCreateThreatBrief.
    onViewNotes?: (caseId: number, label: string) => void;
    onNavigate?: (view: string) => void;
    // INVESTIGATIONS_PHASE1.md §60 — Alert Center's [Investigate] hands off
    // an already-resolved case id; consumed once on mount, same handoff
    // pattern as ThreatBriefsPage's initialContext / KnowledgeBasePage's
    // initialOpenId.
    initialOpenId?: number | null;
    onInitialOpenIdConsumed?: () => void;
}

type Mode = 'list' | 'detail' | 'dashboard';

const CasesPage: React.FC<CasesPageProps> = ({ onCreateThreatBrief, onCreateKnowledgeEntry, onViewNotes, initialOpenId, onInitialOpenIdConsumed }) => {
    const [mode, setMode] = useState<Mode>(initialOpenId != null ? 'detail' : 'list');
    const [selectedId, setSelectedId] = useState<number | null>(initialOpenId ?? null);
    const [meta, setMeta] = useState<CaseMeta | null>(null);

    useEffect(() => {
        getCaseMeta().then(setMeta).catch(() => { /* meta is optional for rendering */ });
    }, []);

    // Consume the pending handoff once, so a later plain navigation to the
    // Cases list doesn't unexpectedly re-open the stale case.
    useEffect(() => {
        if (initialOpenId != null) onInitialOpenIdConsumed?.();
    }, [initialOpenId, onInitialOpenIdConsumed]);

    const openCase = useCallback((id: number) => {
        setSelectedId(id);
        setMode('detail');
    }, []);
    const backToList = useCallback(() => {
        setSelectedId(null);
        setMode('list');
    }, []);

    return (
        <div className="ti-page case-page">
            <div className="ti-header">
                <h1>Investigation Cases</h1>
                <p className="ti-subtitle">Case management and analytical workspace — connect intelligence, evidence, findings and timeline.</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <button className={`ti-action-btn${mode === 'list' ? ' tb-view-toggle-active' : ''}`} onClick={() => { setMode('list'); setSelectedId(null); }} style={mode === 'list' ? { background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' } : undefined}>Cases</button>
                    <button className={`ti-action-btn${mode === 'dashboard' ? ' tb-view-toggle-active' : ''}`} onClick={() => { setMode('dashboard'); setSelectedId(null); }} style={mode === 'dashboard' ? { background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' } : undefined}>Dashboard</button>
                </div>
            </div>
            <div className="ti-container">
                <div className="ti-content">
                    {mode === 'detail' && selectedId != null ? (
                        <CaseDetailView
                            id={selectedId}
                            meta={meta}
                            onBack={backToList}
                            onCreateThreatBrief={onCreateThreatBrief}
                            onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                            onViewNotes={onViewNotes}
                        />
                    ) : mode === 'dashboard' ? (
                        <CasesDashboard onOpenCase={openCase} />
                    ) : (
                        <CasesList meta={meta} onOpenCase={openCase} />
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── §28 CASE DASHBOARD ───────────────────────────────────────────────────

const CasesDashboard: React.FC<{ onOpenCase: (id: number) => void }> = ({ onOpenCase }) => {
    const [stats, setStats] = useState<CaseDashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getCaseDashboard().then(setStats).catch((err) => setError(err?.message || 'Failed to load dashboard')).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    if (error) return <div className="ti-card"><div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div></div>;
    if (loading || !stats) return <div className="ti-card"><div className="ti-loading">Loading dashboard…</div></div>;

    return (
        <div className="ti-card">
            <div className="ti-section-header"><span className="ti-card-title">Case Overview</span><button className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button></div>
            <div className="case-dashboard-grid">
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.total}</div><div className="case-dashboard-tile-label">Total Cases</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.open}</div><div className="case-dashboard-tile-label">Open</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.investigating}</div><div className="case-dashboard-tile-label">Investigating</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.pending}</div><div className="case-dashboard-tile-label">Pending</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value case-dashboard-tile-value--critical">{stats.bySeverity.Critical}</div><div className="case-dashboard-tile-label">Critical</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value case-dashboard-tile-value--high">{stats.bySeverity.High}</div><div className="case-dashboard-tile-label">High Severity</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.assignedToMe}</div><div className="case-dashboard-tile-label">Assigned To Me</div></div>
                {/* INVESTIGATIONS_PHASE3.md §48 CASE DASHBOARD additions. */}
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.recentlyClosed}</div><div className="case-dashboard-tile-label">Recently Closed</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.reopened}</div><div className="case-dashboard-tile-label">Reopened</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.needsReview}</div><div className="case-dashboard-tile-label">Needs Review</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{stats.newActivity}</div><div className="case-dashboard-tile-label">New Activity</div></div>
            </div>

            {stats.recentlyUpdated.length > 0 && (
                <div style={{ marginTop: '20px' }}>
                    <div className="ti-modal-subtitle">Recently Updated</div>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Case</th><th>Title</th><th>Status</th><th>Severity</th><th>Priority</th><th>Updated</th></tr></thead>
                            <tbody>
                                {stats.recentlyUpdated.map((c) => (
                                    <tr key={c.id} className="ti-row-clickable" onClick={() => onOpenCase(c.id)}>
                                        <td><span className="case-detail-number">{c.case_number}</span></td>
                                        <td><span className="ti-target">{c.title}</span></td>
                                        <td><StatusPill status={c.status} /></td>
                                        <td><SeverityPill severity={c.severity} /></td>
                                        <td><PriorityPill priority={c.priority} /></td>
                                        <td>{c.updated_at ? timeAgo(c.updated_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── §29/§26/§27 CASE LIST + SEARCH + FILTERS ────────────────────────────

const CasesList: React.FC<{ meta: CaseMeta | null; onOpenCase: (id: number) => void }> = ({ meta, onOpenCase }) => {
    const [filters, setFilters] = useState({ q: '', status: 'all', severity: 'all', priority: 'all', type: 'all', assignedTo: 'all' });
    const [sortBy, setSortBy] = useState<'updated_at' | 'created_at' | 'severity' | 'priority' | 'status' | 'case_number'>('updated_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<CaseListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    // §26 debounced search
    const [qInput, setQInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => {
            setFilters((f) => (f.q === qInput ? f : { ...f, q: qInput }));
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [qInput]);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getCases({
            q: filters.q || undefined,
            status: filters.status !== 'all' ? filters.status as CaseStatus : undefined,
            severity: filters.severity !== 'all' ? filters.severity as CaseSeverity : undefined,
            priority: filters.priority !== 'all' ? filters.priority as CasePriority : undefined,
            type: filters.type !== 'all' ? filters.type : undefined,
            assignedTo: filters.assignedTo !== 'all' ? filters.assignedTo : undefined,
            sortBy, sortDir, page, pageSize,
        }).then((res) => { setItems(res.items); setTotal(res.total); })
          .catch((err) => setError(err?.message || 'Failed to load cases'))
          .finally(() => setLoading(false));
    }, [filters, sortBy, sortDir, page]);
    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.status === 'all' && filters.severity === 'all' && filters.priority === 'all' && filters.type === 'all' && filters.assignedTo === 'all';

    const setFilter = <K extends keyof typeof filters>(key: K, value: typeof filters[K]) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
    const toggleSort = (col: typeof sortBy) => { if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc')); else { setSortBy(col); setSortDir('desc'); } setPage(1); };

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Cases</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={() => setShowCreate((v) => !v)}>+ Create Case</button>
                </div>
            </div>

            {showCreate && <CreateCaseForm meta={meta} onCreated={(id) => { setShowCreate(false); onOpenCase(id); }} onCancel={() => setShowCreate(false)} />}

            <div className="ti-filters">
                <input type="text" placeholder="Search case number, title, target, tag…" value={qInput} onChange={(e) => setQInput(e.target.value)} />
                <select value={filters.status} onChange={(e) => setFilter('status', e.target.value)}>
                    <option value="all">All Status</option>
                    {meta ? meta.statuses.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>) : Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <select value={filters.severity} onChange={(e) => setFilter('severity', e.target.value)}>
                    <option value="all">All Severity</option>
                    {(meta ? meta.severities : Object.keys(SEVERITY_LABELS)).map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.priority} onChange={(e) => setFilter('priority', e.target.value)}>
                    <option value="all">All Priority</option>
                    {(meta ? meta.priorities : Object.keys(PRIORITY_LABELS)).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={filters.type} onChange={(e) => setFilter('type', e.target.value)}>
                    <option value="all">All Types</option>
                    {(meta ? meta.types : Object.keys(TYPE_LABELS)).map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
                </select>
                <select value={filters.assignedTo} onChange={(e) => setFilter('assignedTo', e.target.value)}>
                    <option value="all">All Analysts</option>
                    <option value="me">Assigned To Me</option>
                    <option value="unassigned">Unassigned</option>
                </select>
            </div>

            {error ? (
                <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading cases…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No cases yet. Create one to begin an investigation.' : 'No cases match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead>
                                <tr>
                                    <th><button className="ti-action-btn" style={{ border: 'none', padding: 0, fontWeight: 700 }} onClick={() => toggleSort('case_number')}>Case # {sortBy === 'case_number' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                    <th>Title</th>
                                    <th>Type</th>
                                    <th><button className="ti-action-btn" style={{ border: 'none', padding: 0, fontWeight: 700 }} onClick={() => toggleSort('severity')}>Severity {sortBy === 'severity' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                    <th><button className="ti-action-btn" style={{ border: 'none', padding: 0, fontWeight: 700 }} onClick={() => toggleSort('priority')}>Priority {sortBy === 'priority' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                    <th><button className="ti-action-btn" style={{ border: 'none', padding: 0, fontWeight: 700 }} onClick={() => toggleSort('status')}>Status {sortBy === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}</button></th>
                                    <th>Analyst</th>
                                    <th>Updated</th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((c) => (
                                    <tr key={c.id} className="ti-row-clickable" onClick={() => onOpenCase(c.id)}>
                                        <td><span className="case-detail-number">{c.case_number}</span></td>
                                        <td><span className="ti-target" title={c.title}>{c.title}</span></td>
                                        <td>{TYPE_LABELS[c.type] ?? c.type}</td>
                                        <td><SeverityPill severity={c.severity} /></td>
                                        <td><PriorityPill priority={c.priority} /></td>
                                        <td><StatusPill status={c.status} /></td>
                                        <td>{c.assigned_to_username ?? c.created_by_username ?? '—'}</td>
                                        <td>{c.updated_at ? timeAgo(c.updated_at) : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}
        </div>
    );
};

// ─── §4 CREATE CASE FORM ──────────────────────────────────────────────────

const CreateCaseForm: React.FC<{ meta: CaseMeta | null; onCreated: (id: number) => void; onCancel: () => void }> = ({ meta, onCreated, onCancel }) => {
    const [form, setForm] = useState({ title: '', summary: '', description: '', objectives: '', severity: 'Medium' as CaseSeverity, priority: 'Medium' as CasePriority, type: 'threat_investigation', tags: '', clientId: '' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // SHADOWSERVER_INTEGRATION_PLAN.md §5 rollout — optional; most cases
    // aren't tied to a client, so this defaults to "none" and the list
    // loads best-effort (an analyst with no client-list access just sees
    // an empty dropdown, never an error blocking case creation).
    const [clients, setClients] = useState<PlatformClient[]>([]);
    useEffect(() => { getClients().then(setClients).catch(() => {}); }, []);

    const run = async () => {
        if (!form.title.trim()) return;
        setCreating(true); setError(null);
        try {
            const tags = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
            const result = await createCase({ title: form.title, summary: form.summary || undefined, description: form.description || undefined, objectives: form.objectives || undefined, severity: form.severity, priority: form.priority, type: form.type, tags: tags.length ? tags : undefined, clientId: form.clientId ? Number(form.clientId) : undefined });
            onCreated(result.id);
        } catch (err: any) {
            setError(err?.message || 'Failed to create case');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div className="case-create-form">
            {error && <div className="ti-error">{error}</div>}
            <input type="text" placeholder="Case title (required)" style={textInputStyle()} value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            <textarea placeholder="Summary (short)" style={textareaStyle()} value={form.summary} onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))} />
            <textarea placeholder="Description (detailed)" style={textareaStyle()} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <textarea placeholder="Objectives (what are we determining?)" style={textareaStyle()} value={form.objectives} onChange={(e) => setForm((f) => ({ ...f, objectives: e.target.value }))} />
            <div className="case-create-form-row">
                <select style={textInputStyle()} value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value as CaseSeverity }))}>
                    {(meta ? meta.severities : Object.keys(SEVERITY_LABELS)).map((s) => <option key={s} value={s}>Severity: {s}</option>)}
                </select>
                <select style={textInputStyle()} value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as CasePriority }))}>
                    {(meta ? meta.priorities : Object.keys(PRIORITY_LABELS)).map((p) => <option key={p} value={p}>Priority: {p}</option>)}
                </select>
                <select style={textInputStyle()} value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
                    {(meta ? meta.types : Object.keys(TYPE_LABELS)).map((t) => <option key={t} value={t}>{TYPE_LABELS[t] ?? t}</option>)}
                </select>
                <input type="text" placeholder="Tags (comma-separated)" style={textInputStyle()} value={form.tags} onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))} />
                {clients.length > 0 && (
                    <select style={textInputStyle()} value={form.clientId} onChange={(e) => setForm((f) => ({ ...f, clientId: e.target.value }))}>
                        <option value="">No client (default)</option>
                        {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                )}
                <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={run} disabled={creating || !form.title.trim()}>{creating ? 'Creating…' : 'Create'}</button>
                <button className="ti-action-btn" onClick={onCancel} disabled={creating}>Cancel</button>
            </div>
        </div>
    );
};

// ─── §30 CASE DETAIL ──────────────────────────────────────────────────────

type DetailTab = 'overview' | 'targets' | 'evidence' | 'timeline' | 'findings' | 'notes' | 'activity'
    // INVESTIGATIONS_PHASE2.md — new workspace tabs.
    | 'hypotheses' | 'tasks' | 'correlation' | 'iocs' | 'changes'
    // §4/§33-§35/§38/§41/§43/§45/§7 — the central investigation workspace,
    // risk/alert/monitoring/knowledge workspaces, graph and report — every
    // one of these reuses a backend function that already existed but was
    // never wired into the UI.
    | 'workspace' | 'risk' | 'alerts' | 'monitoring' | 'knowledge' | 'intelligence' | 'graph' | 'report'
    // INVESTIGATIONS_PHASE3.md — Assessment/Conclusion, Lessons Learned,
    // Peer Review, Investigation Quality + Metrics.
    | 'assessment' | 'lessons' | 'review' | 'quality';

const CaseDetailView: React.FC<{
    id: number; meta: CaseMeta | null; onBack: () => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onViewNotes?: (caseId: number, label: string) => void;
}> = ({ id, meta, onBack, onCreateThreatBrief, onCreateKnowledgeEntry, onViewNotes }) => {
    const [detail, setDetail] = useState<CaseDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<DetailTab>('overview');
    const [confirmClose, setConfirmClose] = useState(false);
    const [closureSummary, setClosureSummary] = useState('');
    // INVESTIGATIONS_PHASE3.md §16-§19 — conclusion is required to close.
    const [closureChecklist, setClosureChecklist] = useState<CaseClosureChecklist | null>(null);
    const [postClosureIntel, setPostClosureIntel] = useState<CasePostClosureIntelligence | null>(null);
    const [conclusionDraft, setConclusionDraft] = useState('');
    const [conclusionConfidenceDraft, setConclusionConfidenceDraft] = useState<CaseConclusionConfidence>('Unknown');
    const [draftingClosure, setDraftingClosure] = useState(false);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getCase(id).then(setDetail).catch((err) => setError(err?.message || 'Failed to load case')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);

    // §21/§44 — "New Intelligence Available" banner for a closed/archived case.
    useEffect(() => {
        if (!detail || (detail.status !== 'closed' && detail.status !== 'archived')) { setPostClosureIntel(null); return; }
        let cancelled = false;
        getCasePostClosureIntelligence(id).then((r) => { if (!cancelled) setPostClosureIntel(r); }).catch(() => { /* non-critical */ });
        return () => { cancelled = true; };
    }, [id, detail?.status]);

    if (error) return <div className="ti-card"><div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div></div>;
    if (loading || !detail) return <div className="ti-card"><div className="ti-loading">Loading case…</div></div>;

    const isClosed = detail.status === 'closed' || detail.status === 'archived';

    const handleStatusChange = async (newStatus: CaseStatus) => {
        try {
            await updateCase(id, { status: newStatus });
            load();
        } catch (err: any) { setError(err?.message || 'Failed to change status'); }
    };
    const handleSeverityChange = async (newSeverity: CaseSeverity) => {
        try { await updateCase(id, { severity: newSeverity }); load(); }
        catch (err: any) { setError(err?.message || 'Failed to change severity'); }
    };
    const handlePriorityChange = async (newPriority: CasePriority) => {
        try { await updateCase(id, { priority: newPriority }); load(); }
        catch (err: any) { setError(err?.message || 'Failed to change priority'); }
    };
    const openCloseModal = () => {
        setConfirmClose(true);
        setConclusionDraft(detail.conclusion || '');
        setConclusionConfidenceDraft(detail.conclusion_confidence || 'Unknown');
        getCaseClosureChecklist(id).then(setClosureChecklist).catch(() => setClosureChecklist(null));
    };
    // §40 AI CLOSURE ASSISTANCE — draft only; the analyst must review before saving.
    const handleDraftClosureSummary = async () => {
        setDraftingClosure(true);
        try { const { draft } = await draftCaseClosureSummary(id); setClosureSummary(draft); }
        catch (err: any) { setError(err?.message || 'Failed to draft closure summary'); }
        finally { setDraftingClosure(false); }
    };
    const handleClose = async () => {
        try {
            await closeCase(id, closureSummary || undefined, conclusionDraft || undefined, conclusionConfidenceDraft);
            setConfirmClose(false); setClosureSummary(''); load();
        } catch (err: any) { setError(err?.message || 'Failed to close case'); }
    };
    const handleReopen = async () => {
        try { await reopenCase(id); load(); }
        catch (err: any) { setError(err?.message || 'Failed to reopen case'); }
    };
    // §45 CASE ARCHIVE — only available once closed; never deletes intelligence.
    const handleArchive = async () => {
        try { await archiveCase(id); load(); }
        catch (err: any) { setError(err?.message || 'Failed to archive case'); }
    };
    const handleExport = () => {
        exportCase(id).then((data) => {
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            downloadBlob(blob, `case-${detail.case_number}.json`);
        }).catch((err) => setError(err?.message || 'Failed to export case'));
    };
    const handleCreateThreatBrief = () => {
        // §42 — hand off to the existing Threat Brief workflow with case context.
        onCreateThreatBrief?.('case', String(id));
    };
    const handleCreateKnowledge = () => {
        // §43 — create a Knowledge Draft from the case (stays Draft, never auto-published).
        onCreateKnowledgeEntry?.({
            title: `Investigation: ${detail.title}`,
            category: 'Incident Response',
            relatedEntityType: 'case', relatedEntityId: String(id),
        });
    };

    return (
        <div className="ti-card" style={{ padding: 0, display: 'flex', flexDirection: 'column', maxHeight: '100%' }}>
            {/* §57 CASE HEADER */}
            <div className="case-detail-header">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <button className="ti-refresh-btn" onClick={onBack}>‹ Back to Cases</button>
                    <div className="ti-row-actions">
                        <button className="ti-action-btn" onClick={handleExport}>Export</button>
                        {/* §42 THREAT BRIEF INTEGRATION */}
                        <button className="ti-action-btn" onClick={handleCreateThreatBrief}>Create Threat Brief</button>
                        {/* §43 KNOWLEDGE BASE INTEGRATION */}
                        <button className="ti-action-btn" onClick={handleCreateKnowledge}>Create Knowledge Draft</button>
                        {/* §38 REOPEN CASE */}
                        {isClosed && <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={handleReopen}>Reopen</button>}
                        {/* §45 CASE ARCHIVE — only after closure; never deletes intelligence. */}
                        {detail.status === 'closed' && <button className="ti-action-btn" onClick={handleArchive}>Archive</button>}
                        {/* §36 CASE CLOSURE */}
                        {!isClosed && <button className="ti-action-btn ti-action-btn--danger" onClick={openCloseModal}>Close</button>}
                    </div>
                </div>
                <div className="case-detail-header-row1">
                    <span className="case-detail-number">{detail.case_number}</span>
                    <h2 className="case-detail-title">{detail.title}</h2>
                </div>
                <div className="case-pill-row">
                    <StatusPill status={detail.status} />
                    <SeverityPill severity={detail.severity} />
                    <PriorityPill priority={detail.priority} />
                    <span className="case-pill" style={{ background: 'rgba(148,163,184,0.1)', color: 'rgba(148,163,184,0.9)' }}>{TYPE_LABELS[detail.type] ?? detail.type}</span>
                </div>
                <div className="case-detail-meta">
                    <span>Assigned: <b>{detail.assigned_to_username ?? 'Unassigned'}</b></span>
                    <span>Created by: <b>{detail.created_by_username ?? '—'}</b></span>
                    <span>Created: <b>{formatDateTime(detail.created_at)}</b></span>
                    <span>Updated: <b>{formatDateTime(detail.updated_at)}</b></span>
                    {detail.closed_at && <span>Closed: <b>{formatDateTime(detail.closed_at)}</b></span>}
                    {detail.archived_at && <span>Archived: <b>{formatDateTime(detail.archived_at)}</b></span>}
                </div>
                {/* INVESTIGATIONS_PHASE3.md §21/§44 — "New Intelligence Available" banner. Recommendation only — never auto-reopens. */}
                {postClosureIntel?.hasNewIntelligence && (
                    <div className="ti-note" style={{ marginTop: '10px', border: '1px solid rgba(250,204,21,0.4)', background: 'rgba(250,204,21,0.08)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                        <b>New Intelligence Available</b> since closure: {postClosureIntel.newRelationships} new relationship(s), {postClosureIntel.newAlerts} new alert(s), {postClosureIntel.newMonitoringEvents} new monitoring event(s).
                        {' '}Recommendation: <b>{postClosureIntel.recommendation}</b>. The case remains {detail.status} until you act.
                    </div>
                )}
                {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            </div>

            {/* §57 TABS */}
            <div className="case-tabs">
                {/* §4 — the central investigation workspace (snapshot + summary + recommendations). */}
                <button className={`case-tab${tab === 'workspace' ? ' case-tab--active' : ''}`} onClick={() => setTab('workspace')}>Workspace</button>
                <button className={`case-tab${tab === 'overview' ? ' case-tab--active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
                <button className={`case-tab${tab === 'targets' ? ' case-tab--active' : ''}`} onClick={() => setTab('targets')}>Targets <span className="case-tab-count">{detail.targets.length}</span></button>
                <button className={`case-tab${tab === 'evidence' ? ' case-tab--active' : ''}`} onClick={() => setTab('evidence')}>Evidence <span className="case-tab-count">{detail.evidence.length}</span></button>
                <button className={`case-tab${tab === 'findings' ? ' case-tab--active' : ''}`} onClick={() => setTab('findings')}>Findings <span className="case-tab-count">{detail.findings.length}</span></button>
                {/* INVESTIGATIONS_PHASE2.md §12 — hypotheses with supporting/contradicting evidence. */}
                <button className={`case-tab${tab === 'hypotheses' ? ' case-tab--active' : ''}`} onClick={() => setTab('hypotheses')}>Hypotheses <span className="case-tab-count">{(detail.hypotheses || []).length}</span></button>
                {/* §17 — analyst tasks. */}
                <button className={`case-tab${tab === 'tasks' ? ' case-tab--active' : ''}`} onClick={() => setTab('tasks')}>Tasks <span className="case-tab-count">{(detail.tasks || []).length}</span></button>
                {/* §5/§6 — cross-module correlation + §7 graph reuse. */}
                <button className={`case-tab${tab === 'correlation' ? ' case-tab--active' : ''}`} onClick={() => setTab('correlation')}>Correlation</button>
                <button className={`case-tab${tab === 'graph' ? ' case-tab--active' : ''}`} onClick={() => setTab('graph')}>Graph</button>
                {/* §24 — IOC workspace. */}
                <button className={`case-tab${tab === 'iocs' ? ' case-tab--active' : ''}`} onClick={() => setTab('iocs')}>IOCs</button>
                {/* §27-§32 — module context (Malware/APT/Brand/Social/Telegram/Threat Intel). */}
                <button className={`case-tab${tab === 'intelligence' ? ' case-tab--active' : ''}`} onClick={() => setTab('intelligence')}>Intelligence</button>
                {/* §33 — Risk workspace (existing Risk engine only). */}
                <button className={`case-tab${tab === 'risk' ? ' case-tab--active' : ''}`} onClick={() => setTab('risk')}>Risk</button>
                {/* §34 — Alert workspace. */}
                <button className={`case-tab${tab === 'alerts' ? ' case-tab--active' : ''}`} onClick={() => setTab('alerts')}>Alerts</button>
                {/* §35 — Monitoring workspace. */}
                <button className={`case-tab${tab === 'monitoring' ? ' case-tab--active' : ''}`} onClick={() => setTab('monitoring')}>Monitoring</button>
                {/* §43 (Phase1 §48) — Related Knowledge. */}
                <button className={`case-tab${tab === 'knowledge' ? ' case-tab--active' : ''}`} onClick={() => setTab('knowledge')}>Knowledge</button>
                {/* §36 — change analysis. */}
                <button className={`case-tab${tab === 'changes' ? ' case-tab--active' : ''}`} onClick={() => setTab('changes')}>Changes</button>
                <button className={`case-tab${tab === 'notes' ? ' case-tab--active' : ''}`} onClick={() => setTab('notes')}>Notes <span className="case-tab-count">{detail.notes.length}</span></button>
                <button className={`case-tab${tab === 'timeline' ? ' case-tab--active' : ''}`} onClick={() => setTab('timeline')}>Timeline</button>
                <button className={`case-tab${tab === 'activity' ? ' case-tab--active' : ''}`} onClick={() => setTab('activity')}>Activity</button>
                {/* §45 (Phase2 — structured Executive Summary/Scope/Findings/.../Recommendations report). */}
                <button className={`case-tab${tab === 'report' ? ' case-tab--active' : ''}`} onClick={() => setTab('report')}>Report</button>
                {/* INVESTIGATIONS_PHASE3.md §4 — structured analyst assessment. */}
                <button className={`case-tab${tab === 'assessment' ? ' case-tab--active' : ''}`} onClick={() => setTab('assessment')}>Assessment</button>
                {/* §29/§30 — Lessons Learned. */}
                <button className={`case-tab${tab === 'lessons' ? ' case-tab--active' : ''}`} onClick={() => setTab('lessons')}>Lessons</button>
                {/* §35-§37 — Peer Review. */}
                <button className={`case-tab${tab === 'review' ? ' case-tab--active' : ''}`} onClick={() => setTab('review')}>Review</button>
                {/* §31/§34 — Investigation Quality + Case Metrics. */}
                <button className={`case-tab${tab === 'quality' ? ' case-tab--active' : ''}`} onClick={() => setTab('quality')}>Quality</button>
            </div>

            <div className="case-tab-body">
                {tab === 'workspace' && <WorkspaceTab caseId={id} isClosed={isClosed} />}
                {tab === 'overview' && <OverviewTab detail={detail} meta={meta} onStatusChange={handleStatusChange} onSeverityChange={handleSeverityChange} onPriorityChange={handlePriorityChange} onChanged={load} />}
                {tab === 'targets' && <TargetsTab detail={detail} meta={meta} onChanged={load} />}
                {tab === 'evidence' && <EvidenceTab detail={detail} onChanged={load} />}
                {tab === 'findings' && <FindingsTab detail={detail} onChanged={load} />}
                {tab === 'hypotheses' && <HypothesesTab detail={detail} onChanged={load} />}
                {tab === 'tasks' && <TasksTab detail={detail} onChanged={load} />}
                {tab === 'correlation' && <CorrelationTab caseId={id} />}
                {tab === 'graph' && <GraphTab caseId={id} />}
                {tab === 'iocs' && <IocsTab caseId={id} />}
                {tab === 'intelligence' && <ModuleContextTab caseId={id} />}
                {tab === 'risk' && <RiskTab caseId={id} />}
                {tab === 'alerts' && <AlertsTab caseId={id} />}
                {tab === 'monitoring' && <MonitoringTab caseId={id} />}
                {tab === 'knowledge' && <KnowledgeTab caseId={id} />}
                {tab === 'changes' && <ChangesTab caseId={id} />}
                {tab === 'notes' && <NotesTab detail={detail} onChanged={load} onViewNotes={onViewNotes} />}
                {tab === 'timeline' && <TimelineTab id={id} />}
                {tab === 'activity' && <ActivityTab id={id} />}
                {tab === 'report' && <ReportTab caseId={id} caseNumber={detail.case_number} />}
                {tab === 'assessment' && <AssessmentTab detail={detail} onChanged={load} />}
                {tab === 'lessons' && <LessonsTab caseId={id} onCreateKnowledgeEntry={onCreateKnowledgeEntry} caseTitle={detail.title} />}
                {tab === 'review' && <ReviewTab caseId={id} />}
                {tab === 'quality' && <QualityTab caseId={id} />}
            </div>

            {/* §36 (Phase1) / §16-§19 (Phase3) closure confirm — checklist + conclusion. */}
            {confirmClose && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Close case" onMouseDown={(e) => { if (e.target === e.currentTarget) setConfirmClose(false); }}>
                    <div className="ti-modal" style={{ width: '560px' }}>
                        <div className="ti-modal-header"><h2>Close Case {detail.case_number}</h2><button className="ti-modal-close" onClick={() => setConfirmClose(false)}>×</button></div>
                        <div className="ti-modal-body">
                            <div className="case-closure-form">
                                {/* §16 CLOSURE CHECKLIST — real case state, never fake completion values. */}
                                {closureChecklist && (
                                    <div className="ti-note" style={{ marginBottom: '4px' }}>
                                        <div style={{ fontWeight: 600, marginBottom: '4px' }}>Closure Checklist</div>
                                        <div>{closureChecklist.caseSummaryExists ? '✓' : '○'} Case Summary</div>
                                        <div>{closureChecklist.targetsExist ? '✓' : '○'} Targets</div>
                                        <div>{closureChecklist.findingsReviewed ? '✓' : '⚠'} Findings reviewed{!closureChecklist.findingsReviewed ? ` (${closureChecklist.outstandingIssues.openFindings} open — warning only)` : ''}</div>
                                        <div>{closureChecklist.hypothesesReviewed ? '✓' : '⚠'} Hypotheses reviewed{!closureChecklist.hypothesesReviewed ? ` (${closureChecklist.outstandingIssues.openHypotheses} open — warning only)` : ''}</div>
                                        <div>{closureChecklist.evidenceReviewed ? '✓' : '⚠'} Evidence reviewed</div>
                                        <div>{closureChecklist.conclusionExists || conclusionDraft.trim() ? '✓' : '✗'} <b>Investigation Conclusion{!closureChecklist.conclusionExists && !conclusionDraft.trim() ? ' — REQUIRED to close' : ''}</b></div>
                                        <div>{closureChecklist.recommendationsDocumented ? '✓' : '○'} Recommendations documented</div>
                                    </div>
                                )}
                                {/* §10-§12 INVESTIGATION CONCLUSION — the one hard requirement (§17). */}
                                <label style={{ fontSize: '0.82rem', color: 'rgba(148,163,184,0.9)' }}>Investigation Conclusion (§10 — required)</label>
                                <textarea style={textareaStyle()} placeholder="e.g. Investigation determined that the domain is likely associated with a phishing campaign based on domain impersonation, threat intelligence matches, and shared infrastructure." value={conclusionDraft} onChange={(e) => setConclusionDraft(e.target.value)} />
                                <select style={textInputStyle()} value={conclusionConfidenceDraft} onChange={(e) => setConclusionConfidenceDraft(e.target.value as CaseConclusionConfidence)} title="Conclusion confidence (§11) — distinct from Risk">
                                    {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                                </select>
                                <label style={{ fontSize: '0.82rem', color: 'rgba(148,163,184,0.9)' }}>Closure Summary (§18)</label>
                                <textarea style={textareaStyle()} placeholder="What happened, what was determined, what remains unknown, what was recommended, what monitoring continues." value={closureSummary} onChange={(e) => setClosureSummary(e.target.value)} />
                                <div className="case-create-form-row">
                                    {/* §40 AI CLOSURE ASSISTANCE — draft only, analyst must review before saving. */}
                                    <button className="ti-action-btn" onClick={handleDraftClosureSummary} disabled={draftingClosure}>{draftingClosure ? 'Drafting…' : '✨ Draft with AI'}</button>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                    <button className="ti-action-btn" onClick={() => setConfirmClose(false)}>Cancel</button>
                                    <button className="ti-action-btn ti-action-btn--danger" onClick={handleClose} disabled={!closureChecklist?.conclusionExists && !conclusionDraft.trim()}>Close Case</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

// ─── Overview tab (§11 description + inline status/severity/priority editors) ─

const OverviewTab: React.FC<{ detail: CaseDetail; meta: CaseMeta | null; onStatusChange: (s: CaseStatus) => void; onSeverityChange: (s: CaseSeverity) => void; onPriorityChange: (p: CasePriority) => void; onChanged: () => void }> = ({ detail, meta, onStatusChange, onSeverityChange, onPriorityChange, onChanged }) => {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="ti-kv">
                <span className="k">Status</span>
                <span className="v"><select style={textInputStyle()} value={detail.status} onChange={(e) => onStatusChange(e.target.value as CaseStatus)}>{(meta ? meta.statuses : Object.keys(STATUS_LABELS)).map((s) => <option key={s} value={s}>{STATUS_LABELS[s as CaseStatus]}</option>)}</select></span>
                <span className="k">Severity</span>
                <span className="v"><select style={textInputStyle()} value={detail.severity} onChange={(e) => onSeverityChange(e.target.value as CaseSeverity)}>{(meta ? meta.severities : Object.keys(SEVERITY_LABELS)).map((s) => <option key={s} value={s}>{s}</option>)}</select></span>
                <span className="k">Priority</span>
                <span className="v"><select style={textInputStyle()} value={detail.priority} onChange={(e) => onPriorityChange(e.target.value as CasePriority)}>{(meta ? meta.priorities : Object.keys(PRIORITY_LABELS)).map((p) => <option key={p} value={p}>{p}</option>)}</select></span>
                <span className="k">Assigned</span>
                <span className="v">{detail.assigned_to_username ?? 'Unassigned'}</span>
            </div>

            {detail.summary && <div><div className="ti-modal-subtitle">Summary</div><div className="ti-note">{detail.summary}</div></div>}
            {detail.description && <div><div className="ti-modal-subtitle">Description</div><div className="ti-note" style={{ whiteSpace: 'pre-wrap' }}>{detail.description}</div></div>}
            {detail.objectives && <div><div className="ti-modal-subtitle">Objectives</div><div className="ti-note" style={{ whiteSpace: 'pre-wrap' }}>{detail.objectives}</div></div>}
            {detail.closure_summary && <div><div className="ti-modal-subtitle">Closure Summary</div><div className="ti-note" style={{ whiteSpace: 'pre-wrap' }}>{detail.closure_summary}</div></div>}

            {/* INVESTIGATIONS_PHASE3.md §10-§13 — Conclusion/Confidence/Impact, editable any time (not only at closure). */}
            <ConclusionEditor detail={detail} onChanged={onChanged} />

            {detail.tags.length > 0 && (
                <div>
                    <div className="ti-modal-subtitle">Tags (§25)</div>
                    <TagEditor caseId={detail.id} tags={detail.tags} onChanged={() => { /* parent reloads via other tabs */ }} />
                </div>
            )}
        </div>
    );
};

// ─── INVESTIGATIONS_PHASE3.md §10-§13 Conclusion / Confidence / Impact ────
//
// §12 "Keep distinct: Conclusion (what the analyst believes happened) vs
// Risk (how significant the situation is) — do not merge these concepts."
// §13 "Only include categories relevant to the project... do not
// automatically claim financial or data impact without evidence" — impact
// categories are a plain analyst-selected checklist, never inferred.

const ConclusionEditor: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [editing, setEditing] = useState(false);
    const [conclusion, setConclusion] = useState(detail.conclusion || '');
    const [confidence, setConfidence] = useState<CaseConclusionConfidence>(detail.conclusion_confidence || 'Unknown');
    const [categories, setCategories] = useState<CaseImpactCategory[]>(detail.impact?.categories || []);
    const [impactDescription, setImpactDescription] = useState(detail.impact?.description || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const ALL_CATEGORIES: CaseImpactCategory[] = ['Operational', 'Financial', 'Reputational', 'Security', 'Data Exposure', 'User Impact'];
    const toggleCategory = (c: CaseImpactCategory) => setCategories((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

    const save = async () => {
        setSaving(true); setError(null);
        try {
            await updateCase(detail.id, { conclusion: conclusion || null, conclusionConfidence: confidence, impact: { categories, description: impactDescription || undefined } });
            setEditing(false); onChanged();
        } catch (err: any) { setError(err?.message || 'Failed to save conclusion'); }
        finally { setSaving(false); }
    };

    if (!editing) {
        return (
            <div>
                <div className="ti-section-header"><span className="ti-modal-subtitle">Investigation Conclusion (§10)</span><button className="ti-action-btn" onClick={() => setEditing(true)}>{detail.conclusion ? 'Edit' : '+ Set Conclusion'}</button></div>
                {detail.conclusion ? (
                    <>
                        <div className="ti-note" style={{ whiteSpace: 'pre-wrap' }}>{detail.conclusion}</div>
                        {detail.conclusion_confidence && <div style={{ marginTop: '6px' }}>Confidence: <span className={`ti-badge ti-badge--${detail.conclusion_confidence.toLowerCase()}`}>{detail.conclusion_confidence}</span> <span style={{ color: 'rgba(148,163,184,0.7)', fontSize: '0.75rem' }}>(§11 — distinct from Risk)</span></div>}
                        {detail.impact && detail.impact.categories.length > 0 && (
                            <div style={{ marginTop: '6px' }}>Impact: {detail.impact.categories.map((c) => <span key={c} className="ti-chip" style={{ marginRight: '4px' }}>{c}</span>)}{detail.impact.description && <div className="ti-note">{detail.impact.description}</div>}</div>
                        )}
                    </>
                ) : <div className="ti-empty">Not yet documented — required before this case can be closed (§17).</div>}
            </div>
        );
    }

    return (
        <div>
            {error && <div className="ti-error">{error}</div>}
            <div className="ti-modal-subtitle">Investigation Conclusion (§10 — analyst controlled; AI may only draft)</div>
            <textarea style={textareaStyle()} placeholder="What did the investigation determine?" value={conclusion} onChange={(e) => setConclusion(e.target.value)} />
            <div className="case-create-form-row" style={{ marginTop: '8px' }}>
                <select style={textInputStyle()} value={confidence} onChange={(e) => setConfidence(e.target.value as CaseConclusionConfidence)} title="§11 — never inherited from Risk">
                    {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                </select>
            </div>
            <div className="ti-modal-subtitle" style={{ marginTop: '10px' }}>Impact Assessment (§13)</div>
            <div className="case-tag-editor" style={{ marginBottom: '8px' }}>
                {ALL_CATEGORIES.map((c) => (
                    <span key={c} className="ti-chip" style={{ cursor: 'pointer', opacity: categories.includes(c) ? 1 : 0.4, background: categories.includes(c) ? 'rgba(0,229,255,0.12)' : undefined }} onClick={() => toggleCategory(c)}>{c}</span>
                ))}
            </div>
            <textarea style={textareaStyle()} placeholder="Impact description (only what evidence supports — never assumed)" value={impactDescription} onChange={(e) => setImpactDescription(e.target.value)} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                <button className="ti-action-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
        </div>
    );
};

// ─── §25 Tag editor ───────────────────────────────────────────────────────

const TagEditor: React.FC<{ caseId: number; tags: string[]; onChanged: () => void }> = ({ caseId, tags, onChanged }) => {
    const [input, setInput] = useState('');
    const [busy, setBusy] = useState(false);
    const add = async () => {
        const t = input.trim(); if (!t) return;
        setBusy(true);
        try { await addCaseTag(caseId, t); setInput(''); onChanged(); }
        catch { /* ignore */ } finally { setBusy(false); }
    };
    const remove = async (t: string) => {
        try { await removeCaseTag(caseId, t); onChanged(); } catch { /* ignore */ }
    };
    return (
        <div className="case-tag-editor">
            {tags.map((t) => (
                <span key={t} className="ti-chip" style={{ cursor: 'pointer' }} onClick={() => remove(t)} title="Click to remove">{t} ×</span>
            ))}
            <input className="case-tag-input" type="text" placeholder="Add tag…" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} disabled={busy} />
            <button className="ti-action-btn" onClick={add} disabled={busy || !input.trim()}>Add</button>
        </div>
    );
};

// ─── §12/§13 Targets tab ──────────────────────────────────────────────────

const TargetsTab: React.FC<{ detail: CaseDetail; meta: CaseMeta | null; onChanged: () => void }> = ({ detail, meta, onChanged }) => {
    const [entityType, setEntityType] = useState('ioc');
    const [q, setQ] = useState('');
    const [searchResults, setSearchResults] = useState<{ type: string; id: string; label: string }[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // §26/§13 — reuse the EXISTING searchIntelligence for target discovery.
    useEffect(() => {
        if (!q.trim()) { setSearchResults([]); return; }
        setSearching(true);
        const t = setTimeout(() => {
            searchIntelligence(q).then((items) => {
                setSearchResults(items.filter((i) => (meta ? meta.targetEntityTypes : []).includes(i.type)).slice(0, 10));
            }).catch(() => setSearchResults([])).finally(() => setSearching(false));
        }, 300);
        return () => clearTimeout(t);
    }, [q, meta]);

    const addTarget = async (id: string) => {
        setError(null);
        try { await addCaseTarget(detail.id, entityType, id); onChanged(); setQ(''); setSearchResults([]); }
        catch (err: any) { setError(err?.message || 'Failed to add target'); }
    };
    const removeTarget = async (t: { entity_type: string; entity_id: string }) => {
        try { await removeCaseTarget(detail.id, t.entity_type, t.entity_id); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to remove target'); }
    };

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            {/* §13 — search existing entities, never copy records into the case. */}
            <div className="case-add-target-form">
                <select style={textInputStyle()} value={entityType} onChange={(e) => setEntityType(e.target.value)}>
                    {(meta ? meta.targetEntityTypes : ['ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability', 'brand', 'company', 'report', 'knowledge_entry']).map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <input type="text" placeholder="Search by entity ID or value…" style={textInputStyle()} value={q} onChange={(e) => setQ(e.target.value)} />
                {searching && <span style={{ fontSize: '0.75rem', color: 'rgba(148,163,184,0.7)' }}>Searching…</span>}
            </div>
            {searchResults.length > 0 && (
                <div className="case-evidence-search">
                    {searchResults.map((r) => (
                        <div key={`${r.type}:${r.id}`} className="case-evidence-search-row">
                            <span className="case-evidence-search-source">{r.label}</span>
                            <span style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)' }}>{r.type} #{r.id}</span>
                            <button className="ti-action-btn" onClick={() => addTarget(r.id)}>Add</button>
                        </div>
                    ))}
                </div>
            )}
            {q.trim() && searchResults.length === 0 && !searching && (
                <div style={{ marginBottom: '10px' }}>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>No existing {entityType} found for "{q}". Enter the entity ID directly:</div>
                    <div className="case-add-target-form">
                        <input type="text" placeholder="Entity ID" style={textInputStyle()} onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value.trim(); if (v) addTarget(v); (e.target as HTMLInputElement).value = ''; } }} />
                    </div>
                </div>
            )}

            <div className="ti-modal-subtitle" style={{ marginTop: '16px' }}>Linked Targets</div>
            {detail.targets.length === 0 ? (
                <div className="ti-empty">No targets linked yet.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Entity Type</th><th>Label</th><th>Entity ID</th><th>Added By</th><th>Added</th><th></th></tr></thead>
                        <tbody>
                            {detail.targets.map((t) => (
                                <tr key={t.id}>
                                    <td>{t.entity_type}</td>
                                    <td>{t.entity_label ?? '—'}</td>
                                    <td>{t.entity_id}</td>
                                    <td>{t.added_by_username ?? '—'}</td>
                                    <td>{t.created_at ? timeAgo(t.created_at) : '—'}</td>
                                    <td>
                                        <div className="ti-row-actions">
                                            {/* §44 MONITORING INTEGRATION — IOC targets only (existing Monitoring). */}
                                            {t.entity_type === 'ioc' && (
                                                <button className="ti-action-btn" onClick={async () => { try { await monitorCaseTarget(detail.id, t.entity_type, t.entity_id); } catch { /* ignore */ } }}>Monitor</button>
                                            )}
                                            <button className="ti-action-btn ti-action-btn--danger" onClick={() => removeTarget(t)}>Remove</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── §15/§16/§17/§18 Evidence tab ─────────────────────────────────────────

const EvidenceTab: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [showSearch, setShowSearch] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [q, setQ] = useState('');
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [searching, setSearching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // §17 [Add Existing Evidence] — search the shared evidence store.
    const runSearch = async () => {
        if (!q.trim()) return;
        setSearching(true); setError(null);
        try {
            const items = await searchCaseEvidence(detail.id, q);
            setSearchResults(items);
        } catch (err: any) { setError(err?.message || 'Evidence search failed'); }
        finally { setSearching(false); }
    };

    const attach = async (eid: number) => {
        setError(null);
        try { await attachCaseEvidence(detail.id, eid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to attach evidence'); }
    };
    const remove = async (eid: number) => {
        try { await removeCaseEvidence(detail.id, eid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to remove evidence'); }
    };
    // INVESTIGATIONS_PHASE2.md §9/§10 — analyst-controlled classification.
    const setClassification = async (eid: number, classification: CaseEvidenceClassification) => {
        try { await classifyCaseEvidence(detail.id, eid, { classification }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to classify evidence'); }
    };

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="ti-row-actions" style={{ marginBottom: '10px' }}>
                <button className="ti-action-btn" onClick={() => { setShowSearch((v) => !v); setShowNew(false); }}>+ Add Existing Evidence</button>
                <button className="ti-action-btn" onClick={() => { setShowNew((v) => !v); setShowSearch(false); }}>+ New Evidence</button>
            </div>

            {showSearch && (
                <div style={{ marginBottom: '12px' }}>
                    <div className="case-add-target-form">
                        <input type="text" placeholder="Search evidence by source, description, URL…" style={textInputStyle()} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
                        <button className="ti-action-btn" onClick={runSearch} disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
                    </div>
                    {searchResults.length > 0 && (
                        <div className="case-evidence-search">
                            {searchResults.map((ev) => (
                                <div key={ev.id} className="case-evidence-search-row">
                                    <span className="case-evidence-search-source">{ev.source}</span>
                                    <span className="case-evidence-search-desc">{ev.description ?? ev.url ?? `entity ${ev.entity_type}:${ev.entity_id}`}</span>
                                    <button className="ti-action-btn" onClick={() => attach(ev.id)}>Attach</button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showNew && <NewEvidenceForm caseId={detail.id} onChanged={() => { onChanged(); setShowNew(false); }} />}

            <div className="ti-modal-subtitle">Linked Evidence</div>
            {detail.evidence.length === 0 ? (
                <div className="ti-empty">No evidence linked yet.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Source</th><th>Description</th><th>Original Entity</th><th>Confidence</th><th>Classification</th><th>Added</th><th></th></tr></thead>
                        <tbody>
                            {detail.evidence.map((ev) => (
                                <tr key={ev.id}>
                                    <td>{ev.source}</td>
                                    <td><span className="ti-target">{ev.description ?? ev.url ?? '—'}</span></td>
                                    <td>{ev.source_entity_type}:{ev.source_entity_id}</td>
                                    <td>{ev.confidence ? <span className={`ti-badge ti-badge--${ev.confidence.toLowerCase()}`}>{ev.confidence}</span> : '—'}</td>
                                    {/* §9 — analyst-controlled classification dropdown. */}
                                    <td>
                                        <select style={textInputStyle()} value={ev.classification ?? ''} onChange={(e) => setClassification(ev.id, e.target.value as CaseEvidenceClassification)}>
                                            <option value="">—</option>
                                            {(Object.keys(EVIDENCE_CLASSIFICATION_LABELS) as CaseEvidenceClassification[]).map((c) => <option key={c} value={c}>{EVIDENCE_CLASSIFICATION_LABELS[c]}</option>)}
                                        </select>
                                    </td>
                                    <td>{ev.linked_at ? timeAgo(ev.linked_at) : '—'}</td>
                                    <td><button className="ti-action-btn ti-action-btn--danger" onClick={() => remove(ev.id)}>Remove</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const NewEvidenceForm: React.FC<{ caseId: number; onChanged: () => void }> = ({ caseId, onChanged }) => {
    const [form, setForm] = useState({ source: '', url: '', description: '', confidence: 'Medium' });
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const run = async () => {
        if (!form.source.trim()) return;
        setCreating(true); setError(null);
        try {
            await createCaseEvidence(caseId, { source: form.source, url: form.url || undefined, description: form.description || undefined, confidence: form.confidence });
            onChanged();
        } catch (err: any) { setError(err?.message || 'Failed to create evidence'); }
        finally { setCreating(false); }
    };
    return (
        <div className="case-create-form" style={{ marginBottom: '12px' }}>
            {error && <div className="ti-error">{error}</div>}
            <input type="text" placeholder="Source (required)" style={textInputStyle()} value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} />
            <input type="text" placeholder="URL (optional)" style={textInputStyle()} value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} />
            <textarea placeholder="Description" style={textareaStyle()} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            <div className="case-create-form-row">
                <select style={textInputStyle()} value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                    {['High', 'Medium', 'Low'].map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                </select>
                <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={run} disabled={creating || !form.source.trim()}>{creating ? 'Creating…' : 'Create'}</button>
            </div>
        </div>
    );
};

// ─── §23/§24 Findings tab ─────────────────────────────────────────────────

// ─── §23/§24 + PHASE2 §39 Findings tab ─────────────────────────────────────
//
// §39 FINDING WORKFLOW — each finding supports title, statement, status
// (Open/Under Review/Confirmed/Rejected/Resolved), confidence, evidence,
// notes, created by, updated. "Confirmed" is always analyst controlled
// (§39's own rule). §40 — finding ("what the analyst concludes") stays
// visibly SEPARATE from evidence ("what was observed").

const FindingsTab: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [title, setTitle] = useState('');
    const [statement, setStatement] = useState('');
    const [confidence, setConfidence] = useState<CaseFindingConfidence>('Unknown');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (!statement.trim()) return;
        setAdding(true); setError(null);
        // §39 — created as 'open'; 'confirmed' only via explicit analyst PATCH below.
        try { await addCaseFinding(detail.id, { title: title || undefined, statement, confidence }); setTitle(''); setStatement(''); setConfidence('Unknown'); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to add finding'); }
        finally { setAdding(false); }
    };
    const remove = async (fid: number) => {
        try { await deleteCaseFinding(detail.id, fid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to delete finding'); }
    };
    // §39 — analyst-controlled status transition (incl. Confirmed).
    const setStatus = async (fid: number, status: CaseFindingStatus) => {
        try { await updateCaseFinding(detail.id, fid, { status }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to update finding'); }
    };

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="case-create-form" style={{ marginBottom: '12px' }}>
                <input type="text" placeholder="Finding title (optional) — e.g. Phishing infrastructure identified" style={textInputStyle()} value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea placeholder="Finding statement — what has the analyst concluded? (separate from raw evidence)" style={textareaStyle()} value={statement} onChange={(e) => setStatement(e.target.value)} />
                <div className="case-create-form-row">
                    <select style={textInputStyle()} value={confidence} onChange={(e) => setConfidence(e.target.value as CaseFindingConfidence)}>
                        {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                    </select>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={add} disabled={adding || !statement.trim()}>{adding ? 'Adding…' : 'Add Finding'}</button>
                </div>
            </div>
            {detail.findings.length === 0 ? (
                <div className="ti-empty">No findings recorded yet.</div>
            ) : (
                detail.findings.map((f) => (
                    <div key={f.id} className="case-finding">
                        {f.title && <div className="case-finding-title">{f.title}</div>}
                        <div className="case-finding-statement">{f.statement}</div>
                        <div className="case-finding-meta">
                            <span className={`ti-badge ti-badge--${f.confidence.toLowerCase()}`}>{f.confidence}</span>
                            {/* §39 — status lifecycle select; analyst controlled. */}
                            <select style={textInputStyle()} value={f.status} onChange={(e) => setStatus(f.id, e.target.value as CaseFindingStatus)} title="Finding status (§39)">
                                {(Object.keys(FINDING_STATUS_LABELS) as CaseFindingStatus[]).map((s) => <option key={s} value={s}>{FINDING_STATUS_LABELS[s]}</option>)}
                            </select>
                            <span>by {f.author_username ?? '—'}</span>
                            <span>{f.created_at ? timeAgo(f.created_at) : '—'}</span>
                            <button className="ti-action-btn ti-action-btn--danger" onClick={() => remove(f.id)}>Delete</button>
                        </div>
                        {f.supporting_evidence_ids.length > 0 && (
                            <div className="case-finding-evidence">Supporting evidence: {f.supporting_evidence_ids.join(', ')}</div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// INVESTIGATIONS_PHASE2.md — new workspace tabs
// ═════════════════════════════════════════════════════════════════════════

// ─── §12-§16 Hypotheses tab ────────────────────────────────────────────────
//
// Structured investigation hypotheses: statement, status (§13: Open/Testing/
// Supported/Contradicted/Rejected/Resolved), confidence (§15), supporting /
// contradicting evidence (§14), analyst notes. Status is never
// auto-transitioned (§13's rule — with both supporting AND contradicting
// evidence the hypothesis stays unresolved, TEST CASE 2).

const HypothesesTab: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [statement, setStatement] = useState('');
    const [confidence, setConfidence] = useState<CaseHypothesisConfidence>('Unknown');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // §14 — evidence linking form state per hypothesis (only one open at a time).
    const [linkingHypId, setLinkingHypId] = useState<number | null>(null);
    const [linkEvidenceId, setLinkEvidenceId] = useState('');
    const [linkRole, setLinkRole] = useState<CaseHypothesisEvidenceRole>('supporting');
    const [linkNote, setLinkNote] = useState('');

    const add = async () => {
        if (!statement.trim()) return;
        setAdding(true); setError(null);
        try { await addCaseHypothesis(detail.id, { statement, confidence }); setStatement(''); setConfidence('Unknown'); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to add hypothesis'); }
        finally { setAdding(false); }
    };
    const remove = async (hid: number) => {
        try { await deleteCaseHypothesis(detail.id, hid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to delete hypothesis'); }
    };
    // §13 — analyst-controlled status transition.
    const setStatus = async (hid: number, status: CaseHypothesisStatus) => {
        try { await updateCaseHypothesis(detail.id, hid, { status }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to update hypothesis'); }
    };
    const setConfidenceFor = async (hid: number, confidence: CaseHypothesisConfidence) => {
        try { await updateCaseHypothesis(detail.id, hid, { confidence }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to update confidence'); }
    };
    // §14 — attach existing evidence (never duplicated; link rows only).
    const linkEvidence = async (hid: number) => {
        const eid = Number(linkEvidenceId);
        if (!Number.isFinite(eid) || eid <= 0) return;
        try {
            await addHypothesisEvidence(detail.id, hid, { evidenceId: eid, role: linkRole, note: linkNote || undefined });
            setLinkingHypId(null); setLinkEvidenceId(''); setLinkRole('supporting'); setLinkNote('');
            onChanged();
        } catch (err: any) { setError(err?.message || 'Failed to add evidence'); }
    };
    const unlinkEvidence = async (hid: number, eid: number) => {
        try { await removeHypothesisEvidence(detail.id, hid, eid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to remove evidence'); }
    };

    const hypotheses = detail.hypotheses || [];

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="case-create-form" style={{ marginBottom: '12px' }}>
                <textarea placeholder="Hypothesis — a testable assumption, e.g. 'example.com is associated with Campaign X'" style={textareaStyle()} value={statement} onChange={(e) => setStatement(e.target.value)} />
                <div className="case-create-form-row">
                    <select style={textInputStyle()} value={confidence} onChange={(e) => setConfidence(e.target.value as CaseHypothesisConfidence)}>
                        {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                    </select>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={add} disabled={adding || !statement.trim()}>{adding ? 'Adding…' : 'Add Hypothesis'}</button>
                </div>
            </div>
            {hypotheses.length === 0 ? (
                <div className="ti-empty">No hypotheses recorded yet.</div>
            ) : (
                hypotheses.map((h) => {
                    // §14 — assessment: unresolved while contradicting evidence exists.
                    const hasContradicting = (h.contradicting_evidence || []).length > 0;
                    const hasSupporting = (h.supporting_evidence || []).length > 0;
                    const assessment = h.analyst_assessment
                        ?? (hasContradicting && hasSupporting ? 'Unresolved' : hasSupporting ? 'Supported by evidence' : hasContradicting ? 'Contradicted by evidence' : 'No evidence yet');
                    return (
                        <div key={h.id} className="case-finding case-hypothesis">
                            <div className="case-finding-statement">{h.statement}</div>
                            <div className="case-finding-meta">
                                <span className={`ti-badge ti-badge--${h.confidence.toLowerCase()}`}>{h.confidence}</span>
                                {/* §13 — status select; transitions recorded on the case timeline (§16). */}
                                <select style={textInputStyle()} value={h.status} onChange={(e) => setStatus(h.id, e.target.value as CaseHypothesisStatus)} title="Hypothesis status (§13)">
                                    {(Object.keys(HYPOTHESIS_STATUS_LABELS) as CaseHypothesisStatus[]).map((s) => <option key={s} value={s}>{HYPOTHESIS_STATUS_LABELS[s]}</option>)}
                                </select>
                                <select style={textInputStyle()} value={h.confidence} onChange={(e) => setConfidenceFor(h.id, e.target.value as CaseHypothesisConfidence)} title="Hypothesis confidence (§15)">
                                    {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <span>by {h.author_username ?? '—'}</span>
                                <span>{h.created_at ? timeAgo(h.created_at) : '—'}</span>
                                <button className="ti-action-btn ti-action-btn--danger" onClick={() => remove(h.id)}>Delete</button>
                            </div>
                            {/* §14 — assessment row (Unresolved when evidence conflicts). */}
                            <div className="case-finding-evidence">Assessment: <b>{assessment}</b></div>
                            {h.notes && <div className="case-finding-evidence" style={{ whiteSpace: 'pre-wrap' }}>{h.notes}</div>}
                            {/* §14 — supporting / contradicting evidence lists. */}
                            <div className="case-hypothesis-evidence">
                                <div className="case-hypothesis-ev-col">
                                    <div className="case-hypothesis-ev-title supporting">Supporting ({(h.supporting_evidence || []).length})</div>
                                    {(h.supporting_evidence || []).map((ev) => (
                                        <div key={`s-${ev.id}`} className="case-hypothesis-ev-item">
                                            <span>{ev.source}</span>
                                            <span className="case-hypothesis-ev-desc">{ev.description ?? ev.url ?? `#${ev.id}`}</span>
                                            <button className="ti-action-btn ti-action-btn--danger" onClick={() => unlinkEvidence(h.id, ev.id)}>×</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="case-hypothesis-ev-col">
                                    <div className="case-hypothesis-ev-title contradicting">Contradicting ({(h.contradicting_evidence || []).length})</div>
                                    {(h.contradicting_evidence || []).map((ev) => (
                                        <div key={`c-${ev.id}`} className="case-hypothesis-ev-item">
                                            <span>{ev.source}</span>
                                            <span className="case-hypothesis-ev-desc">{ev.description ?? ev.url ?? `#${ev.id}`}</span>
                                            <button className="ti-action-btn ti-action-btn--danger" onClick={() => unlinkEvidence(h.id, ev.id)}>×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {/* §14 — link evidence form. */}
                            <div className="case-hypothesis-link">
                                {linkingHypId === h.id ? (
                                    <div className="case-create-form">
                                        <input type="text" placeholder="Existing evidence ID (from the Evidence tab)" style={textInputStyle()} value={linkEvidenceId} onChange={(e) => setLinkEvidenceId(e.target.value)} />
                                        <div className="case-create-form-row">
                                            <select style={textInputStyle()} value={linkRole} onChange={(e) => setLinkRole(e.target.value as CaseHypothesisEvidenceRole)}>
                                                <option value="supporting">Supporting</option>
                                                <option value="contradicting">Contradicting</option>
                                                <option value="contextual">Contextual</option>
                                            </select>
                                            <button className="ti-action-btn" onClick={() => linkEvidence(h.id)} disabled={!linkEvidenceId.trim()}>Link</button>
                                            <button className="ti-action-btn" onClick={() => setLinkingHypId(null)}>Cancel</button>
                                        </div>
                                    </div>
                                ) : (
                                    <button className="ti-action-btn" onClick={() => setLinkingHypId(h.id)}>+ Link Evidence</button>
                                )}
                            </div>
                        </div>
                    );
                })
            )}
        </div>
    );
};

// ─── §17-§22 Tasks tab ─────────────────────────────────────────────────────
//
// Analyst tasks: title, status (§18: Pending/In Progress/Blocked/Completed/
// Cancelled), priority (§20), assignee (§19), due date (§21), created from a
// finding (§22) or from an approved AI recommendation (§23 — approval is the
// analyst clicking Add here; AI never writes tasks directly). Tasks are never
// auto-completed (§18's rule).

const TasksTab: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState<CaseTaskPriority>('Medium');
    const [dueDate, setDueDate] = useState('');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // §22 — create task from a finding (analyst controlled).
    const [sourceFindingId, setSourceFindingId] = useState<string>('');

    const add = async () => {
        if (!title.trim()) return;
        setAdding(true); setError(null);
        try {
            await addCaseTask(detail.id, {
                title,
                description: description || undefined,
                priority,
                dueDate: dueDate || null,
                sourceFindingId: sourceFindingId ? Number(sourceFindingId) : null,
            });
            setTitle(''); setDescription(''); setPriority('Medium'); setDueDate(''); setSourceFindingId('');
            onChanged();
        } catch (err: any) { setError(err?.message || 'Failed to add task'); }
        finally { setAdding(false); }
    };
    const remove = async (tid: number) => {
        try { await deleteCaseTask(detail.id, tid); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to delete task'); }
    };
    // §18 — analyst-controlled status transition.
    const setStatus = async (tid: number, status: CaseTaskStatus) => {
        try { await updateCaseTask(detail.id, tid, { status }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to update task'); }
    };
    const setPriorityFor = async (tid: number, p: CaseTaskPriority) => {
        try { await updateCaseTask(detail.id, tid, { priority: p }); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to update task'); }
    };

    const tasks = detail.tasks || [];
    const openFindings = detail.findings.filter((f) => f.status === 'open' || f.status === 'under_review');

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="case-create-form" style={{ marginBottom: '12px' }}>
                <input type="text" placeholder="Task — e.g. Review IOC, Analyze Domain, Validate Attribution" style={textInputStyle()} value={title} onChange={(e) => setTitle(e.target.value)} />
                <textarea placeholder="Description (optional)" style={textareaStyle()} value={description} onChange={(e) => setDescription(e.target.value)} />
                <div className="case-create-form-row">
                    <select style={textInputStyle()} value={priority} onChange={(e) => setPriority(e.target.value as CaseTaskPriority)}>
                        {(['Low', 'Medium', 'High', 'Critical'] as CaseTaskPriority[]).map((p) => <option key={p} value={p}>Priority: {p}</option>)}
                    </select>
                    {/* §21 — explicit due date; never auto-generated. */}
                    <input type="date" style={textInputStyle()} value={dueDate} onChange={(e) => setDueDate(e.target.value)} title="Due date (§21)" />
                    {/* §22 — optional source finding. */}
                    <select style={textInputStyle()} value={sourceFindingId} onChange={(e) => setSourceFindingId(e.target.value)} title="Create from finding (§22)">
                        <option value="">Not from a finding</option>
                        {openFindings.map((f) => <option key={f.id} value={f.id}>From finding #{f.id}: {(f.title || f.statement).slice(0, 40)}</option>)}
                    </select>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={add} disabled={adding || !title.trim()}>{adding ? 'Adding…' : 'Add Task'}</button>
                </div>
            </div>
            {tasks.length === 0 ? (
                <div className="ti-empty">No tasks recorded yet.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Task</th><th>Status</th><th>Priority</th><th>Assigned</th><th>Due</th><th>Source</th><th></th></tr></thead>
                        <tbody>
                            {tasks.map((t) => (
                                <tr key={t.id}>
                                    <td>
                                        <div>{t.title}</div>
                                        {t.description && <div style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)' }}>{t.description}</div>}
                                    </td>
                                    {/* §18 — status select; completion recorded via case timeline. */}
                                    <td>
                                        <select style={textInputStyle()} value={t.status} onChange={(e) => setStatus(t.id, e.target.value as CaseTaskStatus)}>
                                            {(Object.keys(TASK_STATUS_LABELS) as CaseTaskStatus[]).map((s) => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
                                        </select>
                                    </td>
                                    <td>
                                        <select style={textInputStyle()} value={t.priority} onChange={(e) => setPriorityFor(t.id, e.target.value as CaseTaskPriority)}>
                                            {(['Low', 'Medium', 'High', 'Critical'] as CaseTaskPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                    </td>
                                    <td>{t.assigned_to_username ?? '—'}</td>
                                    <td>{t.due_date ?? '—'}</td>
                                    <td>
                                        {/* §22/§23 — provenance: from a finding, or an AI recommendation the analyst approved. */}
                                        {t.source_ai_recommendation ? <span className="ti-chip" title="Created from an Ask AI recommendation the analyst approved (§23)">AI-recommended</span>
                                            : t.source_finding_id ? <span className="ti-chip" title="Created from a finding (§22)">finding #{t.source_finding_id}</span>
                                            : '—'}
                                    </td>
                                    <td><button className="ti-action-btn ti-action-btn--danger" onClick={() => remove(t.id)}>Delete</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── §5/§6/§7 Correlation tab ──────────────────────────────────────────────
//
// §5 CROSS MODULE CORRELATION — given a case target, retrieve related
// existing intelligence (Domain/IP/IOC/Campaign/Threat Actor/APT/Malware/
// Brand/...), only what the analyst is authorized to access. §6 — each
// relationship shows Relationship / Source / Confidence / Evidence-basis.
// Relationships are NEVER created just because entities share a case (§6's
// own rule) — this tab only surfaces edges that already exist in the
// EXISTING entity_relationships graph.

const CorrelationTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [data, setData] = useState<CaseCorrelation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseCorrelation(caseId)
            .then((d) => { if (!cancelled) setData(d); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load correlation'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading correlation…</div>;
    if (error) return <div className="ti-error">{error}</div>;
    if (!data) return <div className="ti-empty">No correlation data.</div>;

    const totalRels = data.targets.reduce((a, t) => a + t.relationships.length, 0);

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                Related intelligence per target, from the existing Relationship Graph ({totalRels} relationship{totalRels === 1 ? '' : 's'}). Relationships are only shown where they already exist — entities appearing in the same case together is not a relationship.
            </div>
            {data.targets.length === 0 ? (
                <div className="ti-empty">No targets linked yet — add targets to see cross-module correlation.</div>
            ) : (
                data.targets.map(({ target, relationships }) => (
                    <div key={`${target.entity_type}:${target.entity_id}`} className="case-correlation-target">
                        <div className="case-correlation-target-header">
                            <span className="case-correlation-target-type">{target.entity_type}</span>
                            <span className="case-correlation-target-label">{target.entity_label ?? target.entity_id}</span>
                        </div>
                        {relationships.length === 0 ? (
                            <div className="ti-empty" style={{ padding: '8px 12px' }}>No existing relationships for this target.</div>
                        ) : (
                            <div className="ti-table-wrap">
                                <table className="ti-table">
                                    {/* §6 — every relationship shows Relationship / Source / Confidence / basis. */}
                                    <thead><tr><th>Relationship</th><th>Direction</th><th>Related Entity</th><th>Basis</th><th>Confidence</th><th>Source</th></tr></thead>
                                    <tbody>
                                        {relationships.map((r) => (
                                            <tr key={r.id}>
                                                <td>{r.relationship_type}</td>
                                                <td>{r.direction === 'outgoing' ? '→' : '←'}</td>
                                                <td><span className="ti-target">{r.entity.label}</span> <span style={{ fontSize: '0.72rem', color: 'rgba(148,163,184,0.7)' }}>({r.entity.type} #{r.entity.id})</span></td>
                                                <td>{r.basis}</td>
                                                <td>{r.confidence ? <span className={`ti-badge ti-badge--${r.confidence.toLowerCase()}`}>{r.confidence}</span> : '—'}</td>
                                                <td>{r.source}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── §24/§25/§26 IOC Workspace tab ─────────────────────────────────────────
//
// §24 — an IOC view within the investigation: IOC / Type / Source / Status /
// Risk / First Seen / Last Seen / Related Entities / Evidence. Uses EXISTING
// IOC data (getIocById — already enriched with campaigns, monitors, alerts).
// §25 — the IOC's own status from the existing IOC architecture is shown
// as-is; no separate case classification system.

const IocsTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [iocs, setIocs] = useState<CaseIoc[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseIocs(caseId)
            .then((items) => { if (!cancelled) setIocs(items); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load IOCs'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading IOCs…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                IOCs related to this case (existing IOC Repository data, §24). Status and risk come from the existing IOC architecture — this case adds no separate classification.
            </div>
            {iocs.length === 0 ? (
                <div className="ti-empty">No IOCs related to this case yet. IOCs appear when they are case targets or related to targets in the Relationship Graph.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        {/* §24 columns. */}
                        <thead><tr><th>IOC</th><th>Type</th><th>Status</th><th>Risk</th><th>Confidence</th><th>First Seen</th><th>Last Seen</th><th>Related</th></tr></thead>
                        <tbody>
                            {iocs.map((i) => (
                                <tr key={i.id}>
                                    <td><span className="ti-target">{i.value}</span></td>
                                    <td>{i.type}</td>
                                    {/* §25 — existing IOC status shown as-is. */}
                                    <td>{i.status}</td>
                                    <td>{i.risk ? <span className={`ti-badge ti-badge--${i.risk.toLowerCase()}`}>{i.risk}</span> : '—'}</td>
                                    <td>{i.confidence ? <span className={`ti-badge ti-badge--${i.confidence.toLowerCase()}`}>{i.confidence}</span> : '—'}</td>
                                    <td>{i.first_seen_at ? formatDateTime(i.first_seen_at) : '—'}</td>
                                    <td>{i.last_seen_at ? formatDateTime(i.last_seen_at) : '—'}</td>
                                    <td>
                                        <div className="ti-row-actions" style={{ flexWrap: 'wrap' }}>
                                            {(i.relatedCampaigns || []).length > 0 && <span className="ti-chip">{(i.relatedCampaigns || []).length} campaign{(i.relatedCampaigns || []).length === 1 ? '' : 's'}</span>}
                                            {(i.relatedMonitors || []).length > 0 && <span className="ti-chip">{(i.relatedMonitors || []).length} monitor{(i.relatedMonitors || []).length === 1 ? '' : 's'}</span>}
                                            {(i.relatedAlerts || []).length > 0 && <span className="ti-chip">{(i.relatedAlerts || []).length} alert{(i.relatedAlerts || []).length === 1 ? '' : 's'}</span>}
                                            {(i.sources || []).length > 0 && <span className="ti-chip">{(i.sources || []).length} source{(i.sources || []).length === 1 ? '' : 's'}</span>}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── §36 Change Analysis tab ───────────────────────────────────────────────
//
// "What changed since the investigation started?" — the case's own
// intelligence_history rows filtered to change actions (real events only,
// §36's "Do not fabricate historical changes").

const ChangesTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [changes, setChanges] = useState<CaseChangeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseChanges(caseId)
            .then((items) => { if (!cancelled) setChanges(items); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load changes'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading changes…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                What changed since the investigation started — real events from the case timeline (§36): targets, evidence, findings, hypotheses, tasks, status, risk-relevant changes.
            </div>
            {changes.length === 0 ? (
                <div className="ti-empty">No changes recorded yet.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Change</th><th>From</th><th>To</th><th>By</th><th>Source</th><th>When</th></tr></thead>
                        <tbody>
                            {changes.map((c) => (
                                <tr key={c.id}>
                                    <td>{c.action.replace(/_/g, ' ')}</td>
                                    <td>{c.previous_value ?? '—'}</td>
                                    <td>{c.new_value ?? '—'}</td>
                                    <td>{c.username ?? '—'}</td>
                                    <td>{c.source}</td>
                                    <td>{c.created_at ? timeAgo(c.created_at) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// Repair pass — these tabs wire up backend functions (getCaseRisk,
// getCaseAlerts, getCaseMonitoring, getCaseKnowledge, getCaseModuleContext,
// getCaseGraph, getCaseSnapshot/getCaseSummary/getCaseRecommendations,
// generateCaseReport) that already existed in api.ts and the server routes
// but were never rendered anywhere — INVESTIGATIONS_PHASE1.md §47/§46/§48
// and INVESTIGATIONS_PHASE2.md §4/§27-§35/§41/§45.
// ═════════════════════════════════════════════════════════════════════════

// ─── §4 Workspace tab (Snapshot §37 + Summary §38 + Recommendations §41) ──

const WorkspaceTab: React.FC<{ caseId: number; isClosed: boolean }> = ({ caseId, isClosed }) => {
    const [snapshot, setSnapshot] = useState<CaseSnapshot | null>(null);
    const [summary, setSummary] = useState<CaseSummary | null>(null);
    const [recommendations, setRecommendations] = useState<CaseRecommendation[]>([]);
    const [records, setRecords] = useState<CaseRecommendationRecord[]>([]);
    const [postClosure, setPostClosure] = useState<CasePostClosureActivity | null>(null);
    const [newAction, setNewAction] = useState('');
    const [newReason, setNewReason] = useState('');
    const [addingRec, setAddingRec] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([
            getCaseSnapshot(caseId), getCaseSummary(caseId), getCaseRecommendations(caseId),
            getCaseRecommendationRecords(caseId).catch(() => []),
            isClosed ? getCasePostClosureActivity(caseId).catch(() => null) : Promise.resolve(null),
        ])
            .then(([s, su, r, recs, pc]) => { setSnapshot(s); setSummary(su); setRecommendations(r); setRecords(recs); setPostClosure(pc); })
            .catch((err: any) => setError(err?.message || 'Failed to load workspace'))
            .finally(() => setLoading(false));
    }, [caseId, isClosed]);
    useEffect(() => { load(); }, [load]);

    // §14 RECOMMENDATIONS — persisted, analyst controlled.
    const addRecord = async () => {
        if (!newAction.trim()) return;
        setAddingRec(true);
        try { await addCaseRecommendationRecord(caseId, { action: newAction, reason: newReason || undefined }); setNewAction(''); setNewReason(''); load(); }
        catch (err: any) { setError(err?.message || 'Failed to add recommendation'); }
        finally { setAddingRec(false); }
    };
    const setRecordStatus = async (recId: number, status: CaseRecommendationStatus) => {
        try { await updateCaseRecommendationRecord(caseId, recId, status); load(); } catch { /* ignore */ }
    };

    if (loading) return <div className="ti-empty">Loading investigation workspace…</div>;
    if (error) return <div className="ti-error">{error}</div>;
    if (!snapshot || !summary) return <div className="ti-empty">No workspace data yet.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div className="ti-note">
                The central investigation workspace (§4) — a real, bounded snapshot of this case's current state. Nothing here is auto-generated as a conclusion (§38).
            </div>
            <div className="case-dashboard-grid">
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{snapshot.targets.length}</div><div className="case-dashboard-tile-label">Targets</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value case-dashboard-tile-value--high">{snapshot.highRiskEntities.length}</div><div className="case-dashboard-tile-label">High Risk Entities</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{snapshot.openFindings.length}</div><div className="case-dashboard-tile-label">Open Findings</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{snapshot.openHypotheses.length}</div><div className="case-dashboard-tile-label">Open Hypotheses</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{snapshot.openTasks.length}</div><div className="case-dashboard-tile-label">Open Tasks</div></div>
                <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{snapshot.criticalEvidence.length}</div><div className="case-dashboard-tile-label">Critical Evidence</div></div>
            </div>

            <div>
                <div className="ti-modal-subtitle">Current Assessment</div>
                <div className="ti-note">{summary.currentAssessment ?? 'Not yet documented by the analyst.'}</div>
            </div>

            {summary.risk && (
                <div>
                    <div className="ti-modal-subtitle">Risk</div>
                    <span className={`ti-badge ti-badge--${summary.risk.level.toLowerCase()}`}>{summary.risk.level}</span>
                    <span style={{ marginLeft: '8px', color: 'rgba(148,163,184,0.8)' }}>Score {summary.risk.score}</span>
                </div>
            )}

            {summary.unknowns.length > 0 && (
                <div>
                    <div className="ti-modal-subtitle">Unknowns</div>
                    {summary.unknowns.map((u) => <div key={u.id} className="ti-note">{u.statement} — <i>{u.reason}</i></div>)}
                </div>
            )}

            <div>
                <div className="ti-modal-subtitle">Rule-Based Recommendations (§41 — analyst controlled execution)</div>
                {recommendations.length === 0 ? <div className="ti-empty">No rule-based recommendations right now.</div> : (
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>
                        {recommendations.map((r, i) => <li key={i} className="ti-note" style={{ marginBottom: '4px' }}><b>{r.action}</b> — {r.reason}</li>)}
                    </ul>
                )}
            </div>

            {/* INVESTIGATIONS_PHASE3.md §14 — persisted, analyst-documented recommendations. */}
            <div>
                <div className="ti-modal-subtitle">Documented Recommendations (§14)</div>
                <div className="case-create-form" style={{ marginBottom: '10px' }}>
                    <input type="text" placeholder="Recommendation — e.g. Block IOC, Update detection rules" style={textInputStyle()} value={newAction} onChange={(e) => setNewAction(e.target.value)} />
                    <div className="case-create-form-row">
                        <input type="text" placeholder="Reason (optional)" style={{ ...textInputStyle(), flex: 1 }} value={newReason} onChange={(e) => setNewReason(e.target.value)} />
                        <button className="ti-action-btn" onClick={addRecord} disabled={addingRec || !newAction.trim()}>{addingRec ? 'Adding…' : 'Add'}</button>
                    </div>
                </div>
                {records.length === 0 ? <div className="ti-empty">No recommendations documented yet.</div> : (
                    records.map((r) => (
                        <div key={r.id} className="case-finding-meta" style={{ marginBottom: '6px' }}>
                            <span className={`ti-badge ti-badge--${r.status === 'completed' ? 'high' : r.status === 'dismissed' ? 'low' : 'medium'}`}>{r.status}</span>
                            <span><b>{r.action}</b>{r.reason ? ` — ${r.reason}` : ''}</span>
                            {r.status === 'open' && (
                                <span className="ti-row-actions">
                                    <button className="ti-action-btn" onClick={() => setRecordStatus(r.id, 'completed')}>Mark Completed</button>
                                    <button className="ti-action-btn" onClick={() => setRecordStatus(r.id, 'dismissed')}>Dismiss</button>
                                </span>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* §43 POST CLOSURE MONITORING — retained after closure, never auto-deleted. */}
            {isClosed && postClosure?.applicable && (
                <div>
                    <div className="ti-modal-subtitle">Post Closure Activity (§43)</div>
                    <div className="case-tag-editor">
                        <span className="ti-chip">{postClosure.monitoredTargets.length} monitored target(s)</span>
                        <span className="ti-chip">{postClosure.openAlerts.length} open alert(s)</span>
                        <span className="ti-chip">{postClosure.pendingTasks.length} pending task(s)</span>
                    </div>
                </div>
            )}

            {snapshot.recentChanges.length > 0 && (
                <div>
                    <div className="ti-modal-subtitle">Recent Changes</div>
                    {snapshot.recentChanges.slice(0, 5).map((c) => <div key={c.id} className="ti-note">{c.action.replace(/_/g, ' ')} — {c.created_at ? timeAgo(c.created_at) : '—'}</div>)}
                </div>
            )}
        </div>
    );
};

// ─── §7/§46 Relationship Graph tab ─────────────────────────────────────────

const GraphTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [graph, setGraph] = useState<CaseGraph | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseGraph(caseId).then((g) => { if (!cancelled) setGraph(g); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load graph'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading relationship graph…</div>;
    if (error) return <div className="ti-error">{error}</div>;
    if (!graph) return <div className="ti-empty">No graph data.</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                Case → Target → Entity → Related Entity, from the existing Relationship Graph (§7/§46). {graph.truncated ? 'Truncated to the bounded traversal depth.' : ''}
            </div>
            {graph.nodes.length === 0 ? (
                <div className="ti-empty">No graph nodes yet — add targets to populate the graph.</div>
            ) : (
                <>
                    <div className="ti-modal-subtitle">Nodes ({graph.nodes.length})</div>
                    <div className="case-tag-editor" style={{ marginBottom: '14px' }}>
                        {graph.nodes.map((n) => (
                            <span key={`${n.type}:${n.id}`} className="ti-chip">{n.type}: {n.label}{n.risk ? ` (${n.risk})` : ''}</span>
                        ))}
                    </div>
                    <div className="ti-modal-subtitle">Edges ({graph.edges.length})</div>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Source</th><th>Relationship</th><th>Target</th><th>Basis</th><th>Confidence</th></tr></thead>
                            <tbody>
                                {graph.edges.map((e) => (
                                    <tr key={e.id}>
                                        <td>{e.sourceType}:{e.sourceId}</td>
                                        <td>{e.relationshipType}</td>
                                        <td>{e.targetType}:{e.targetId}</td>
                                        <td>{e.basis}</td>
                                        <td>{e.confidence ? <span className={`ti-badge ti-badge--${e.confidence.toLowerCase()}`}>{e.confidence}</span> : '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    );
};

// ─── INVESTIGATIONS_PHASE2.md §27-§32 Module Context tab ──────────────────

const ModuleContextTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [sections, setSections] = useState<CaseModuleContextSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseModuleContext(caseId).then((s) => { if (!cancelled) setSections(s); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load module context'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading module context…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                Malware / APT / Brand / Social Media / Telegram / Threat Intelligence context per target (§27-§32) — the SAME cross-module aggregator Threat Briefs use, never a new per-module engine.
            </div>
            {sections.length === 0 ? (
                <div className="ti-empty">No targets with a dedicated module context yet.</div>
            ) : (
                sections.map(({ target, moduleLabel, context }) => (
                    <div key={`${target.entity_type}:${target.entity_id}`} className="case-correlation-target">
                        <div className="case-correlation-target-header">
                            <span className="case-correlation-target-type">{moduleLabel}</span>
                            <span className="case-correlation-target-label">{target.entity_label ?? target.entity_id}</span>
                        </div>
                        <div style={{ padding: '10px 12px', display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
                            {context.risk && <span>Risk: <span className={`ti-badge ti-badge--${context.risk.level.toLowerCase()}`}>{context.risk.level}</span></span>}
                            <span>Related entities: <b>{context.relatedEntities.length}</b></span>
                            <span>Evidence: <b>{context.evidence.length}</b></span>
                            <span>Findings: <b>{context.findings.length}</b></span>
                            <span>Alerts: <b>{context.alerts.items.length}</b></span>
                            <span>Monitors: <b>{context.monitoring.monitors.length}</b></span>
                        </div>
                        {context.recommendations.length > 0 && (
                            <div style={{ padding: '0 12px 10px' }} className="ti-note">
                                {context.recommendations.length} rule-based recommendation{context.recommendations.length === 1 ? '' : 's'} from this module's own engine.
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── §33 Risk workspace tab (existing Risk engine only, never a new one) ──

const RiskTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [risk, setRisk] = useState<CaseRisk | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseRisk(caseId).then((r) => { if (!cancelled) setRisk(r); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load risk'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading risk…</div>;
    if (error) return <div className="ti-error">{error}</div>;
    if (!risk) return <div className="ti-empty">No risk data.</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                Case risk is the highest-scoring target's risk from the existing Risk engine (§33/§47) — never a separate Investigation Risk engine. Severity and Risk remain distinct.
            </div>
            {risk.risk ? (
                <div style={{ marginBottom: '16px' }}>
                    <span className={`ti-badge ti-badge--${risk.risk.level.toLowerCase()}`}>{risk.risk.level}</span>
                    <span style={{ marginLeft: '8px', color: 'rgba(148,163,184,0.8)' }}>Score {risk.risk.score} — {risk.risk.entity_label ?? risk.risk.entity_id}</span>
                    {risk.risk.reasons.length > 0 && (
                        <ul style={{ marginTop: '8px' }}>{risk.risk.reasons.map((r, i) => <li key={i} className="ti-note">{r}</li>)}</ul>
                    )}
                </div>
            ) : <div className="ti-empty">No risk could be computed for this case's targets yet.</div>}

            {risk.targets.length > 0 && (
                <>
                    <div className="ti-modal-subtitle">Per-Target Risk</div>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Entity</th><th>Level</th><th>Score</th></tr></thead>
                            <tbody>
                                {risk.targets.map((t) => (
                                    <tr key={`${t.entity_type}:${t.entity_id}`}>
                                        <td>{t.entity_type}: {t.entity_label ?? t.entity_id}</td>
                                        <td><span className={`ti-badge ti-badge--${t.level.toLowerCase()}`}>{t.level}</span></td>
                                        <td>{t.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {risk.history.length > 0 && (
                <>
                    <div className="ti-modal-subtitle" style={{ marginTop: '16px' }}>Risk History</div>
                    {risk.history.map((h, i) => <div key={i} className="ti-note">{h.previous_value ?? '—'} → {h.new_value ?? '—'} ({formatDateTime(h.created_at)})</div>)}
                </>
            )}
        </div>
    );
};

// ─── §34 Alert workspace tab ────────────────────────────────────────────────

const AlertsTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [alerts, setAlerts] = useState<CaseAlertItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseAlerts(caseId).then((a) => { if (!cancelled) setAlerts(a); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load alerts'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading alerts…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>Alerts associated with this case's targets (§34) — the existing Alert Center, never duplicated.</div>
            {alerts.length === 0 ? <div className="ti-empty">No alerts for this case's targets yet.</div> : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Alert</th><th>Target</th><th>Severity</th><th>Status</th><th>Source</th><th>Created</th></tr></thead>
                        <tbody>
                            {alerts.map((a) => (
                                <tr key={a.id}>
                                    <td><span className="ti-target">{a.title}</span></td>
                                    <td>{a.target}</td>
                                    <td><span className={`ti-badge ti-badge--${a.severity.toLowerCase()}`}>{a.severity}</span></td>
                                    <td>{a.status}</td>
                                    <td>{a.source}</td>
                                    <td>{a.created_at ? timeAgo(a.created_at) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── §35 Monitoring workspace tab ───────────────────────────────────────────

const MonitoringTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [monitors, setMonitors] = useState<CaseMonitorItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseMonitoring(caseId).then((m) => { if (!cancelled) setMonitors(m); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load monitoring'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading monitoring…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>Monitor state for this case's targets (§35/§44) — the existing Monitoring system. Use the Targets tab's Monitor button to add one.</div>
            {monitors.length === 0 ? <div className="ti-empty">No monitors for this case's targets yet.</div> : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Target</th><th>Type</th><th>Label</th><th>Status</th><th>Last Checked</th><th>Last Risk</th></tr></thead>
                        <tbody>
                            {monitors.map((m) => (
                                <tr key={m.id}>
                                    <td>{m.target}</td>
                                    <td>{m.type}</td>
                                    <td>{m.label ?? '—'}</td>
                                    <td>{m.status}</td>
                                    <td>{m.last_checked_at ? timeAgo(m.last_checked_at) : 'Never'}</td>
                                    <td>{m.last_risk ? <span className={`ti-badge ti-badge--${m.last_risk.toLowerCase()}`}>{m.last_risk}</span> : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── §48 (Phase1)/§43 (Phase2) Knowledge tab ───────────────────────────────

const KnowledgeTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [items, setItems] = useState<CaseKnowledgeItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        getCaseKnowledge(caseId).then((i) => { if (!cancelled) setItems(i); })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load knowledge'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    if (loading) return <div className="ti-empty">Loading related knowledge…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '12px' }}>Related Knowledge Base entries for this case's targets (§48/§43) — the existing Knowledge Base, never a new one.</div>
            {items.length === 0 ? <div className="ti-empty">No related Knowledge Base entries found for this case's targets.</div> : (
                items.map((k) => (
                    <div key={k.id} className="case-finding">
                        <div className="case-finding-title">{k.title}</div>
                        <div className="case-finding-meta">
                            <span className="ti-chip">{k.category}</span>
                            <span className={`ti-badge ti-badge--${k.confidence.toLowerCase()}`}>{k.confidence}</span>
                            <span>via {k.related_target.entity_type}: {k.related_target.entity_label ?? k.related_target.entity_id}</span>
                        </div>
                        {k.summary && <div className="case-finding-evidence">{k.summary}</div>}
                    </div>
                ))
            )}
        </div>
    );
};

// ─── §45 (Phase2)/§41 (Phase1) Structured Case Report tab ──────────────────

const ReportTab: React.FC<{ caseId: number; caseNumber: string }> = ({ caseId, caseNumber }) => {
    const [report, setReport] = useState<CaseReport | null>(null);
    const [versions, setVersions] = useState<CaseReportVersionSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [savingVersion, setSavingVersion] = useState(false);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([generateCaseReport(caseId), getCaseReportVersions(caseId).catch(() => [])])
            .then(([r, v]) => { setReport(r); setVersions(v); })
            .catch((err: any) => setError(err?.message || 'Failed to generate report'))
            .finally(() => setLoading(false));
    }, [caseId]);
    useEffect(() => { load(); }, [load]);

    const download = () => {
        if (!report) return;
        const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
        downloadBlob(blob, `case-report-${caseNumber}.json`);
    };
    // §26 REPORT VERSIONING — a new version is only created if the
    // conclusion changed since the last saved version (never overwritten).
    const saveVersion = async () => {
        setSavingVersion(true);
        try {
            const result = await createCaseReportVersion(caseId);
            setError(result.created ? null : null);
            load();
        } catch (err: any) { setError(err?.message || 'Failed to save report version'); }
        finally { setSavingVersion(false); }
    };

    if (loading) return <div className="ti-empty">Generating report…</div>;
    if (error) return <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>;
    if (!report) return <div className="ti-empty">No report data.</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="ti-row-actions">
                <button className="ti-refresh-btn" onClick={load}>Regenerate</button>
                <button className="ti-action-btn" onClick={download}>Download JSON</button>
                {/* §26 REPORT VERSIONING */}
                <button className="ti-action-btn" onClick={saveVersion} disabled={savingVersion}>{savingVersion ? 'Saving…' : 'Save as Version'}</button>
            </div>
            {versions.length > 0 && (
                <div>
                    <div className="ti-modal-subtitle">Report Versions ({versions.length})</div>
                    {versions.map((v) => <div key={v.id} className="ti-note">v{v.version_number} — {v.generated_by_username ?? '—'} · {formatDateTime(v.created_at)}{v.conclusion_snapshot ? ` — "${v.conclusion_snapshot.slice(0, 80)}${v.conclusion_snapshot.length > 80 ? '…' : ''}"` : ''}</div>)}
                </div>
            )}
            <div className="ti-note">
                Structured investigation report (§45), assembled from this case's real data — never auto-published. Use "Create Threat Brief" in the header to hand this off to the authoritative Threat Brief workflow (§27 Phase 3).
            </div>
            <div><div className="ti-modal-subtitle">1. Executive Summary</div><div className="ti-note">{report.executive_summary ?? 'Not documented.'}</div></div>
            <div><div className="ti-modal-subtitle">2-3. Case Information / Scope</div>
                <div className="ti-kv">
                    <span className="k">Case</span><span className="v">{report.scope.case_number} — {report.scope.title}</span>
                    <span className="k">Status</span><span className="v">{report.scope.status}</span>
                    <span className="k">Severity</span><span className="v">{report.scope.severity}</span>
                    <span className="k">Priority</span><span className="v">{report.scope.priority}</span>
                </div>
            </div>
            <div><div className="ti-modal-subtitle">4. Targets ({report.scope.targets.length})</div>
                {report.scope.targets.map((t) => <div key={t.id} className="ti-note">{t.entity_type}: {t.entity_label ?? t.entity_id}</div>)}
            </div>
            <div><div className="ti-modal-subtitle">6. Key Findings ({report.findings.length})</div>
                {report.findings.length === 0 ? <div className="ti-empty">None recorded.</div> : report.findings.map((f) => <div key={f.id} className="ti-note">{f.title ? `${f.title}: ` : ''}{f.statement} ({f.confidence})</div>)}
            </div>
            <div><div className="ti-modal-subtitle">7. Evidence ({report.evidence.length})</div>
                {report.evidence.length === 0 ? <div className="ti-empty">None linked.</div> : <div className="ti-note">{report.evidence.length} evidence item(s) linked — see the Evidence tab for details.</div>}
            </div>
            <div><div className="ti-modal-subtitle">10. Risk</div>
                {report.risk ? <span className={`ti-badge ti-badge--${report.risk.level.toLowerCase()}`}>{report.risk.level} ({report.risk.score})</span> : <div className="ti-empty">No risk computed.</div>}
            </div>
            <div><div className="ti-modal-subtitle">11. Hypotheses ({report.hypotheses.length})</div>
                {report.hypotheses.length === 0 ? <div className="ti-empty">None recorded.</div> : report.hypotheses.map((h) => <div key={h.id} className="ti-note">{h.statement} — {h.status}</div>)}
            </div>
            <div><div className="ti-modal-subtitle">12. Conclusion</div>
                <div className="ti-note">{report.conclusion ?? 'Not yet documented — analyst controlled (§10 Phase 3).'}</div>
                {report.conclusion_confidence && <div style={{ marginTop: '4px' }}>Confidence: <span className={`ti-badge ti-badge--${report.conclusion_confidence.toLowerCase()}`}>{report.conclusion_confidence}</span></div>}
                {report.impact && report.impact.categories.length > 0 && <div style={{ marginTop: '4px' }}>Impact: {report.impact.categories.join(', ')}{report.impact.description ? ` — ${report.impact.description}` : ''}</div>}
            </div>
            <div><div className="ti-modal-subtitle">13. Recommendations ({report.recommendations.length})</div>
                {report.recommendations.length === 0 ? <div className="ti-empty">None generated.</div> : (
                    <ul style={{ margin: 0, paddingLeft: '18px' }}>{report.recommendations.map((r, i) => <li key={i} className="ti-note">{r.action} — {r.reason}</li>)}</ul>
                )}
            </div>
        </div>
    );
};

// ═════════════════════════════════════════════════════════════════════════
// INVESTIGATIONS_PHASE3.md — Assessment / Lessons Learned / Peer Review /
// Investigation Quality + Metrics tabs
// ═════════════════════════════════════════════════════════════════════════

// ─── §4 Assessment tab (also surfaces §7-§9 Evidence Review/Completeness/Conflicts) ─

const AssessmentTab: React.FC<{ detail: CaseDetail; onChanged: () => void }> = ({ detail, onChanged }) => {
    const [assessment, setAssessment] = useState<CaseAssessment | null>(null);
    const [evidenceReview, setEvidenceReview] = useState<CaseEvidenceReview | null>(null);
    const [completeness, setCompleteness] = useState<CaseEvidenceCompleteness | null>(null);
    const [conflicts, setConflicts] = useState<CaseEvidenceConflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({ executiveAssessment: '', keyFindings: '', evidenceSummary: '', threatAssessment: '', impact: '', confidence: 'Unknown' as CaseConclusionConfidence, unresolvedQuestions: '' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            getCaseAssessment(detail.id),
            getCaseEvidenceReview(detail.id).catch(() => null),
            getCaseEvidenceCompleteness(detail.id).catch(() => null),
            getCaseEvidenceConflicts(detail.id).catch(() => []),
        ]).then(([a, r, c, cf]) => {
            setAssessment(a); setEvidenceReview(r); setCompleteness(c); setConflicts(cf);
            if (a) setForm({ executiveAssessment: a.executive_assessment || '', keyFindings: a.key_findings || '', evidenceSummary: a.evidence_summary || '', threatAssessment: a.threat_assessment || '', impact: a.impact || '', confidence: a.confidence, unresolvedQuestions: a.unresolved_questions || '' });
        }).finally(() => setLoading(false));
    }, [detail.id]);
    useEffect(() => { load(); }, [load]);

    const save = async () => {
        setSaving(true); setError(null);
        try { await saveCaseAssessment(detail.id, form); setEditing(false); load(); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to save assessment'); }
        finally { setSaving(false); }
    };

    if (loading) return <div className="ti-empty">Loading assessment…</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* §5/§6 FINDINGS / HYPOTHESIS REVIEW — grouped by status from already-loaded case detail. */}
            <div>
                <div className="ti-modal-subtitle">Findings Review (§5)</div>
                {detail.findings.length === 0 ? <div className="ti-empty">No findings recorded.</div> : (
                    <div className="case-tag-editor">
                        {(['open', 'under_review', 'confirmed', 'rejected', 'resolved'] as CaseFindingStatus[]).map((s) => {
                            const count = detail.findings.filter((f) => f.status === s).length;
                            return count > 0 ? <span key={s} className="ti-chip">{FINDING_STATUS_LABELS[s]}: {count}</span> : null;
                        })}
                    </div>
                )}
            </div>
            <div>
                <div className="ti-modal-subtitle">Hypothesis Review (§6) — an unresolved hypothesis is never implied as a confirmed conclusion</div>
                {(detail.hypotheses || []).length === 0 ? <div className="ti-empty">No hypotheses recorded.</div> : (
                    <div className="case-tag-editor">
                        {(['open', 'testing', 'supported', 'contradicted', 'rejected', 'resolved'] as CaseHypothesisStatus[]).map((s) => {
                            const count = (detail.hypotheses || []).filter((h) => h.status === s).length;
                            return count > 0 ? <span key={s} className="ti-chip">{HYPOTHESIS_STATUS_LABELS[s]}: {count}</span> : null;
                        })}
                    </div>
                )}
            </div>

            {/* §7/§8 EVIDENCE REVIEW / COMPLETENESS */}
            {evidenceReview && (
                <div>
                    <div className="ti-modal-subtitle">Evidence Review (§7)</div>
                    <div className="case-dashboard-grid">
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.total}</div><div className="case-dashboard-tile-label">Total</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.primary}</div><div className="case-dashboard-tile-label">Primary</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.supporting}</div><div className="case-dashboard-tile-label">Supporting</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.contradicting}</div><div className="case-dashboard-tile-label">Contradicting</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.unreviewed}</div><div className="case-dashboard-tile-label">Unreviewed</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{evidenceReview.restricted}</div><div className="case-dashboard-tile-label">Restricted</div></div>
                    </div>
                </div>
            )}
            {completeness && (
                <div>
                    <div className="ti-modal-subtitle">Evidence Completeness (§8 — not a security score)</div>
                    <span className={`ti-badge ti-badge--${completeness.state === 'Complete' ? 'high' : completeness.state === 'Insufficient' ? 'critical' : 'medium'}`}>{completeness.state}</span>
                    {completeness.reasons.length > 0 && <ul style={{ margin: '6px 0 0', paddingLeft: '18px' }}>{completeness.reasons.map((r, i) => <li key={i} className="ti-note">{r}</li>)}</ul>}
                </div>
            )}
            {conflicts.length > 0 && (
                <div>
                    <div className="ti-modal-subtitle">Evidence Conflicts (§9 — never automatically resolved)</div>
                    {conflicts.map((c, i) => (
                        <div key={i} className="ti-note" style={{ marginBottom: '6px' }}>
                            <b>{c.subject}</b>{c.target ? ` (${c.target.entity_label ?? c.target.entity_id})` : ''}: {c.claims.map((cl) => `${cl.value}${cl.sources.length ? ` [${cl.sources.join(', ')}]` : ''}`).join(' vs. ')}
                        </div>
                    ))}
                </div>
            )}

            {/* §4 STRUCTURED INVESTIGATION ASSESSMENT */}
            <div>
                <div className="ti-section-header"><span className="ti-modal-subtitle">Investigation Assessment (§4)</span>{!editing && <button className="ti-action-btn" onClick={() => setEditing(true)}>{assessment ? 'Edit' : '+ Add Assessment'}</button>}</div>
                {error && <div className="ti-error">{error}</div>}
                {editing ? (
                    <div className="case-create-form">
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Executive Assessment</label>
                        <textarea style={textareaStyle()} value={form.executiveAssessment} onChange={(e) => setForm((f) => ({ ...f, executiveAssessment: e.target.value }))} />
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Key Findings</label>
                        <textarea style={textareaStyle()} value={form.keyFindings} onChange={(e) => setForm((f) => ({ ...f, keyFindings: e.target.value }))} />
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Evidence Summary</label>
                        <textarea style={textareaStyle()} value={form.evidenceSummary} onChange={(e) => setForm((f) => ({ ...f, evidenceSummary: e.target.value }))} />
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Threat Assessment</label>
                        <textarea style={textareaStyle()} value={form.threatAssessment} onChange={(e) => setForm((f) => ({ ...f, threatAssessment: e.target.value }))} />
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Impact</label>
                        <textarea style={textareaStyle()} value={form.impact} onChange={(e) => setForm((f) => ({ ...f, impact: e.target.value }))} />
                        <label style={{ fontSize: '0.78rem', color: 'rgba(148,163,184,0.8)' }}>Unresolved Questions</label>
                        <textarea style={textareaStyle()} value={form.unresolvedQuestions} onChange={(e) => setForm((f) => ({ ...f, unresolvedQuestions: e.target.value }))} />
                        <div className="case-create-form-row">
                            <select style={textInputStyle()} value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value as CaseConclusionConfidence }))}>
                                {CONFIDENCE_LEVELS.map((c) => <option key={c} value={c}>Confidence: {c}</option>)}
                            </select>
                            <button className="ti-action-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                            <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </div>
                ) : assessment ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {assessment.executive_assessment && <div><b>Executive Assessment:</b> <div className="ti-note">{assessment.executive_assessment}</div></div>}
                        {assessment.key_findings && <div><b>Key Findings:</b> <div className="ti-note">{assessment.key_findings}</div></div>}
                        {assessment.evidence_summary && <div><b>Evidence Summary:</b> <div className="ti-note">{assessment.evidence_summary}</div></div>}
                        {assessment.threat_assessment && <div><b>Threat Assessment:</b> <div className="ti-note">{assessment.threat_assessment}</div></div>}
                        {assessment.impact && <div><b>Impact:</b> <div className="ti-note">{assessment.impact}</div></div>}
                        {assessment.unresolved_questions && <div><b>Unresolved Questions:</b> <div className="ti-note">{assessment.unresolved_questions}</div></div>}
                        <div>Confidence: <span className={`ti-badge ti-badge--${assessment.confidence.toLowerCase()}`}>{assessment.confidence}</span></div>
                    </div>
                ) : <div className="ti-empty">No assessment documented yet.</div>}
            </div>
        </div>
    );
};

// ─── §29/§30 Lessons Learned tab ────────────────────────────────────────────

const LESSON_CATEGORY_LABELS: Record<CaseLessonCategory, string> = {
    what_worked: 'What Worked', what_failed: 'What Failed', detection_gap: 'Detection Gap',
    process_gap: 'Process Gap', data_gap: 'Data Gap', improvement: 'Investigation Improvement',
};

const LessonsTab: React.FC<{ caseId: number; caseTitle: string; onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void }> = ({ caseId, caseTitle, onCreateKnowledgeEntry }) => {
    const [lessons, setLessons] = useState<CaseLesson[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<CaseLessonCategory>('improvement');
    const [content, setContent] = useState('');
    const [adding, setAdding] = useState(false);
    const [drafting, setDrafting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        getCaseLessons(caseId).then(setLessons).finally(() => setLoading(false));
    }, [caseId]);
    useEffect(() => { load(); }, [load]);

    const add = async () => {
        if (!content.trim()) return;
        setAdding(true); setError(null);
        try { await addCaseLesson(caseId, { category, content }); setContent(''); load(); }
        catch (err: any) { setError(err?.message || 'Failed to add lesson'); }
        finally { setAdding(false); }
    };
    const remove = async (lessonId: number) => {
        try { await deleteCaseLesson(caseId, lessonId); load(); } catch { /* ignore */ }
    };
    // §41 AI LESSONS LEARNED — draft candidates from real gaps only; analyst must save each.
    const draftWithAi = async () => {
        setDrafting(true); setError(null);
        try {
            const { candidates } = await draftCaseLessonsLearned(caseId);
            for (const c of candidates) await addCaseLesson(caseId, c);
            load();
        } catch (err: any) { setError(err?.message || 'Failed to draft lessons'); }
        finally { setDrafting(false); }
    };
    // §30 LESSONS TO KNOWLEDGE — hand off to the existing Knowledge Draft flow.
    const toKnowledge = (lesson: CaseLesson) => {
        onCreateKnowledgeEntry?.({ title: `${LESSON_CATEGORY_LABELS[lesson.category]}: ${caseTitle}`, category: 'Incident Response', relatedEntityType: 'case', relatedEntityId: String(caseId) });
    };

    if (loading) return <div className="ti-empty">Loading lessons…</div>;

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="case-create-form" style={{ marginBottom: '12px' }}>
                <textarea style={textareaStyle()} placeholder="Lesson — what worked, what failed, or a real gap identified during this investigation" value={content} onChange={(e) => setContent(e.target.value)} />
                <div className="case-create-form-row">
                    <select style={textInputStyle()} value={category} onChange={(e) => setCategory(e.target.value as CaseLessonCategory)}>
                        {(Object.keys(LESSON_CATEGORY_LABELS) as CaseLessonCategory[]).map((c) => <option key={c} value={c}>{LESSON_CATEGORY_LABELS[c]}</option>)}
                    </select>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={add} disabled={adding || !content.trim()}>{adding ? 'Adding…' : 'Add Lesson'}</button>
                    {/* §41 — drafts real gaps only, never invented failures. */}
                    <button className="ti-action-btn" onClick={draftWithAi} disabled={drafting}>{drafting ? 'Drafting…' : '✨ Draft with AI'}</button>
                </div>
            </div>
            {lessons.length === 0 ? <div className="ti-empty">No lessons recorded yet.</div> : (
                lessons.map((l) => (
                    <div key={l.id} className="case-finding">
                        <div className="case-finding-meta"><span className="ti-chip">{LESSON_CATEGORY_LABELS[l.category]}</span><span>by {l.created_by_username ?? '—'}</span><span>{timeAgo(l.created_at)}</span></div>
                        <div className="case-finding-statement">{l.content}</div>
                        <div className="ti-row-actions" style={{ marginTop: '6px' }}>
                            {/* §30 LESSONS TO KNOWLEDGE */}
                            <button className="ti-action-btn" onClick={() => toKnowledge(l)}>Create Knowledge Draft</button>
                            <button className="ti-action-btn ti-action-btn--danger" onClick={() => remove(l.id)}>Delete</button>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
};

// ─── §35-§37 Peer Review tab ─────────────────────────────────────────────────

const REVIEW_STATUS_LABELS: Record<CaseReviewStatus, string> = {
    ready_for_review: 'Ready for Review', under_review: 'Under Review', approved: 'Approved', returned: 'Returned',
};

const ReviewTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [review, setReview] = useState<CaseReview | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [comment, setComment] = useState('');
    const [commentType, setCommentType] = useState<CaseReviewCommentType>('comment');
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getCaseReview(caseId).then(setReview).catch((err: any) => setError(err?.message || 'Failed to load review')).finally(() => setLoading(false));
    }, [caseId]);
    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        setBusy(true); setError(null);
        try { await submitCaseForReview(caseId); load(); }
        catch (err: any) { setError(err?.message || 'Failed to submit for review'); }
        finally { setBusy(false); }
    };
    const setStatus = async (status: CaseReviewStatus) => {
        if (!review) return;
        setBusy(true); setError(null);
        try { await updateCaseReviewStatus(caseId, review.id, status); load(); }
        catch (err: any) { setError(err?.message || 'Only an authorized reviewer can update review status'); }
        finally { setBusy(false); }
    };
    const addComment = async () => {
        if (!review || !comment.trim()) return;
        setBusy(true);
        try { await addCaseReviewComment(caseId, review.id, { commentType, content: comment }); setComment(''); load(); }
        catch (err: any) { setError(err?.message || 'Failed to add comment'); }
        finally { setBusy(false); }
    };

    if (loading) return <div className="ti-empty">Loading review…</div>;

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            <div className="ti-note" style={{ marginBottom: '12px' }}>
                Peer review (§35) — only available where the existing 'investigations.manage' permission grants reviewer access. The submitting analyst cannot review their own case.
            </div>
            {!review ? (
                <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={submit} disabled={busy}>Submit for Review</button>
            ) : (
                <div>
                    <div className="case-finding-meta" style={{ marginBottom: '10px' }}>
                        <span className="ti-chip">{REVIEW_STATUS_LABELS[review.status]}</span>
                        <span>Submitted by {review.submitted_by_username ?? '—'}</span>
                        {review.reviewer_username && <span>Reviewer: {review.reviewer_username}</span>}
                        <span>{timeAgo(review.created_at)}</span>
                    </div>
                    {/* §37 CASE CONCLUSION APPROVAL — reviewer-only status transitions. */}
                    <div className="ti-row-actions" style={{ marginBottom: '12px' }}>
                        <button className="ti-action-btn" onClick={() => setStatus('under_review')} disabled={busy}>Mark Under Review</button>
                        <button className="ti-action-btn" style={{ background: 'rgba(34,197,94,0.12)', borderColor: 'rgba(34,197,94,0.4)', color: 'rgba(34,197,94,0.95)' }} onClick={() => setStatus('approved')} disabled={busy}>Approve</button>
                        <button className="ti-action-btn ti-action-btn--danger" onClick={() => setStatus('returned')} disabled={busy}>Return</button>
                    </div>
                    <div className="ti-modal-subtitle">Comments (§36)</div>
                    {review.comments.length === 0 ? <div className="ti-empty">No comments yet.</div> : (
                        review.comments.map((c) => (
                            <div key={c.id} className="case-note">
                                <div className="case-note-head"><span className="case-note-author">{c.author_username ?? '—'}</span><span className="case-note-type">{c.comment_type.replace(/_/g, ' ')}</span><span className="case-note-time">{timeAgo(c.created_at)}</span></div>
                                <div className="case-note-body">{c.content}</div>
                            </div>
                        ))
                    )}
                    <div className="case-create-form" style={{ marginTop: '10px' }}>
                        <textarea style={textareaStyle()} placeholder="Reviewer comment / requested change / approval note" value={comment} onChange={(e) => setComment(e.target.value)} />
                        <div className="case-create-form-row">
                            <select style={textInputStyle()} value={commentType} onChange={(e) => setCommentType(e.target.value as CaseReviewCommentType)}>
                                <option value="comment">Comment</option>
                                <option value="requested_change">Requested Change</option>
                                <option value="approval_note">Approval Note</option>
                            </select>
                            <button className="ti-action-btn" onClick={addComment} disabled={busy || !comment.trim()}>Add Comment</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── §31/§32/§34 Investigation Quality + Case Metrics tab ──────────────────

const QualityTab: React.FC<{ caseId: number }> = ({ caseId }) => {
    const [quality, setQuality] = useState<CaseQuality | null>(null);
    const [metrics, setMetrics] = useState<CaseMetrics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true); setError(null);
        Promise.all([getCaseQuality(caseId), getCaseMetrics(caseId)])
            .then(([q, m]) => { if (!cancelled) { setQuality(q); setMetrics(m); } })
            .catch((err: any) => { if (!cancelled) setError(err?.message || 'Failed to load quality/metrics'); })
            .finally(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [caseId]);

    const fmtDuration = (ms: number | null) => {
        if (ms == null) return '—';
        const days = Math.floor(ms / 86_400_000);
        const hours = Math.floor((ms % 86_400_000) / 3_600_000);
        return days > 0 ? `${days}d ${hours}h` : `${hours}h`;
    };

    if (loading) return <div className="ti-empty">Loading investigation quality…</div>;
    if (error) return <div className="ti-error">{error}</div>;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {quality && (
                <div>
                    <div className="ti-modal-subtitle">Investigation Quality (§34 — {quality.passedCount}/{quality.totalCount} checks, never an opaque score)</div>
                    {quality.checks.map((c) => <div key={c.key} className="ti-note">{c.pass ? '✓' : '○'} {c.label}</div>)}
                </div>
            )}
            {metrics && (
                <div>
                    <div className="ti-modal-subtitle">Case Metrics (§31 — real timestamps only)</div>
                    <div className="case-dashboard-grid">
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{fmtDuration(metrics.investigationDurationMs)}</div><div className="case-dashboard-tile-label">Duration</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{fmtDuration(metrics.timeToFirstActionMs)}</div><div className="case-dashboard-tile-label">Time to First Action</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{fmtDuration(metrics.timeToResolutionMs)}</div><div className="case-dashboard-tile-label">Time to Resolution</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.evidenceCount}</div><div className="case-dashboard-tile-label">Evidence</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.findingsCount}</div><div className="case-dashboard-tile-label">Findings</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.hypothesesCount}</div><div className="case-dashboard-tile-label">Hypotheses</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.taskCount}</div><div className="case-dashboard-tile-label">Tasks</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.alertsCount}</div><div className="case-dashboard-tile-label">Alerts</div></div>
                        <div className="case-dashboard-tile"><div className="case-dashboard-tile-value">{metrics.reopenCount}</div><div className="case-dashboard-tile-label">Reopen Count</div></div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── §21/§22 Notes tab ────────────────────────────────────────────────────

const NotesTab: React.FC<{ detail: CaseDetail; onChanged: () => void; onViewNotes?: (caseId: number, label: string) => void }> = ({ detail, onChanged, onViewNotes }) => {
    const [content, setContent] = useState('');
    const [noteType, setNoteType] = useState<CaseNoteType>('general');
    const [adding, setAdding] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const add = async () => {
        if (!content.trim()) return;
        setAdding(true); setError(null);
        try { await addCaseNote(detail.id, content, noteType); setContent(''); setNoteType('general'); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to add note'); }
        finally { setAdding(false); }
    };

    return (
        <div>
            {error && <div className="ti-error" style={{ textAlign: 'left' }}>{error}</div>}
            {/* NOTES_PHASE2.md §13/§62 — deep link to the centralized cross-module
                Notes page, pre-filtered to this case. case_notes stays authoritative
                here; this is just a view into the combined note set. */}
            {onViewNotes && (
                <div style={{ marginBottom: '12px' }}>
                    <button className="ti-action-btn" onClick={() => onViewNotes(detail.id, detail.case_number)}>View Notes (All Sources)</button>
                </div>
            )}
            <div className="case-create-form" style={{ marginBottom: '12px' }}>
                <textarea placeholder="Note content (§21 — no anonymous notes)" style={textareaStyle()} value={content} onChange={(e) => setContent(e.target.value)} />
                <div className="case-create-form-row">
                    <select style={textInputStyle()} value={noteType} onChange={(e) => setNoteType(e.target.value as CaseNoteType)}>
                        {(['general', 'observation', 'hypothesis', 'finding', 'decision'] as CaseNoteType[]).map((t) => <option key={t} value={t}>{NOTE_TYPE_LABELS[t]}</option>)}
                    </select>
                    <button className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={add} disabled={adding || !content.trim()}>{adding ? 'Adding…' : 'Add Note'}</button>
                </div>
            </div>
            {detail.notes.length === 0 ? (
                <div className="ti-empty">No notes yet.</div>
            ) : (
                detail.notes.map((n) => <NoteRow key={n.id} note={n} caseId={detail.id} onChanged={onChanged} />)
            )}
        </div>
    );
};

const NoteRow: React.FC<{ note: CaseDetail['notes'][number]; caseId: number; onChanged: () => void }> = ({ note, caseId, onChanged }) => {
    const [editing, setEditing] = useState(false);
    const [content, setContent] = useState(note.content);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const save = async () => {
        try { await updateCaseNote(caseId, note.id, content); setEditing(false); onChanged(); }
        catch { /* ignore */ }
    };
    const del = async () => {
        try { await deleteCaseNote(caseId, note.id); onChanged(); }
        catch { /* ignore */ }
    };

    return (
        <div className="case-note">
            <div className="case-note-head">
                <span className="case-note-author">{note.author_username ?? '—'}</span>
                <span className="case-note-type">{NOTE_TYPE_LABELS[note.note_type]}</span>
                <span className="case-note-time">{note.created_at ? timeAgo(note.created_at) : '—'}</span>
            </div>
            {editing ? (
                <>
                    <textarea style={textareaStyle()} value={content} onChange={(e) => setContent(e.target.value)} />
                    <div className="case-note-actions">
                        <button className="ti-action-btn" onClick={save}>Save</button>
                        <button className="ti-action-btn" onClick={() => { setEditing(false); setContent(note.content); }}>Cancel</button>
                    </div>
                </>
            ) : (
                <>
                    <div className="case-note-body">{note.content}</div>
                    <div className="case-note-actions">
                        <button className="ti-action-btn" onClick={() => setEditing(true)}>Edit</button>
                        <button className="ti-action-btn ti-action-btn--danger" onClick={() => setConfirmDelete(true)}>Delete</button>
                    </div>
                </>
            )}
            {confirmDelete && (
                <ConfirmDialog title="Delete note" text="Delete this note? This cannot be undone." busy={false} confirmLabel="Delete" onCancel={() => setConfirmDelete(false)} onConfirm={del} />
            )}
        </div>
    );
};

// ─── §19/§20 Timeline tab ─────────────────────────────────────────────────

const TimelineTab: React.FC<{ id: number }> = ({ id }) => {
    const [items, setItems] = useState<CaseTimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [order, setOrder] = useState<'desc' | 'asc'>('desc');

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getCaseTimeline(id, order).then(setItems).catch((err) => setError(err?.message || 'Failed to load timeline')).finally(() => setLoading(false));
    }, [id, order]);
    useEffect(() => { load(); }, [load]);

    if (error) return <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>;
    if (loading) return <div className="ti-loading">Loading timeline…</div>;

    return (
        <div>
            <div className="ti-section-header">
                <span className="ti-modal-subtitle">Timeline</span>
                <button className="ti-action-btn" onClick={() => setOrder((o) => (o === 'desc' ? 'asc' : 'desc'))}>{order === 'desc' ? 'Newest First' : 'Oldest First'}</button>
            </div>
            {items.length === 0 ? <div className="ti-empty">No timeline events yet.</div> : (
                <div className="case-timeline">
                    {items.map((t) => (
                        <div key={t.id} className="case-timeline-row">
                            <div className="case-timeline-dot" />
                            <div className="case-timeline-content">
                                <div className="case-timeline-action">{t.action.replace(/_/g, ' ')}</div>
                                {t.previous_value && t.new_value && <div className="case-timeline-detail">{t.previous_value} → {t.new_value}</div>}
                                {(!t.previous_value || !t.new_value) && (t.new_value || t.previous_value) && <div className="case-timeline-detail">{t.new_value || t.previous_value}</div>}
                                <div className="case-timeline-time">{t.username ?? 'system'} · {t.created_at ? formatDateTime(t.created_at) : '—'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// ─── §31 Activity tab ────────────────────────────────────────────────────

const ActivityTab: React.FC<{ id: number }> = ({ id }) => {
    const [items, setItems] = useState<CaseTimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setLoading(true); setError(null);
        getCaseActivity(id).then(setItems).catch((err) => setError(err?.message || 'Failed to load activity')).finally(() => setLoading(false));
    }, [id]);

    if (error) return <div className="ti-error">{error}</div>;
    if (loading) return <div className="ti-loading">Loading activity…</div>;

    return (
        <div>
            <div className="ti-modal-subtitle">Activity</div>
            {items.length === 0 ? <div className="ti-empty">No activity yet.</div> : (
                <div className="case-timeline">
                    {items.map((t) => (
                        <div key={t.id} className="case-timeline-row">
                            <div className="case-timeline-dot" />
                            <div className="case-timeline-content">
                                <div className="case-timeline-action">{t.action.replace(/_/g, ' ')}</div>
                                {t.new_value && <div className="case-timeline-detail">{t.new_value}</div>}
                                <div className="case-timeline-time">{t.username ?? 'system'} · {t.created_at ? timeAgo(t.created_at) : '—'}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default CasesPage;
