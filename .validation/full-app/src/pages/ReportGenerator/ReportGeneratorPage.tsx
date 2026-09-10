// REPORT_GENERATOR_PHASE1.md — Report Foundation, Templates, Intelligence
// Selection, Structured Composition, Preview, Draft & Export. Replaces the
// former "Report Generator is planned for a future update and isn't
// available yet." placeholder. §2 "CRITICAL DISTINCTION" — this page
// COMPILES existing intelligence; it never becomes a second IOC/Evidence/
// Timeline/Risk/Case repository. Reuses ThreatIntelligence's existing ti-*
// visual system, the same convention every other analysis page (IOC
// Analyzer, Threat Summary) already follows.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
// Premium visual redesign layer, scoped to `.rg-page` only — same approach
// as ThreatSummaryPage.css: restyles the shared ti-* classes without
// touching the other 15 pages that import ThreatIntelligencePage.css.
import './ReportGeneratorPage.css';
import {
    FileText, LayoutGrid, Scale, PenLine, CheckCircle2, UploadCloud, History, Plus,
    ShieldCheck, Database, CalendarClock, Tag, ChevronRight, FileStack,
    ArrowLeftRight, SearchCheck, Diff, ListChecks, Search, SlidersHorizontal, User, X, MapPinOff,
    ArrowLeft, Lock, Target, FolderOpen, Archive, Copy, RefreshCw, ClipboardCheck, Trash2,
    Network, ArrowRight, Filter, Layers, Users, Bug, Flag, ShieldAlert, FileSearch2,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import {
    getReportGeneratorTemplates, getReportGeneratorDashboard, getReportGeneratorReports, createReportGeneratorReport,
    getReportGeneratorReport, updateReportGeneratorReport, setReportGeneratorStatus, deleteReportGeneratorReport, duplicateReportGeneratorReport,
    addReportGeneratorSelection, removeReportGeneratorSelection, getReportGeneratorPreview, reportGeneratorExportUrl, exportReportGeneratorReport,
    searchReportGeneratorEntities, addReportGeneratorSelectionsBulk, getReportGeneratorDiscovery,
    getReportGeneratorRefreshDiff, applyReportGeneratorRefresh, dismissReportGeneratorRefresh,
    getReportGeneratorHistory, getReportGeneratorReviewChecklist, updateReportGeneratorReviewChecklist,
    compareReportGeneratorReports, getReportGeneratorReadyCheck,
    generateReportGeneratorAiDraft, getReportGeneratorAiDrafts, insertReportGeneratorAiDraft, discardReportGeneratorAiDraft,
    runReportGeneratorFactCheck, getReportGeneratorActionCandidates, proposeReportGeneratorAction, listReportGeneratorActions,
    approveReportGeneratorAction, rejectReportGeneratorAction,
    type ReportGeneratorTemplatesResponse, type ReportGeneratorDashboard, type ReportGeneratorReport, type ReportGeneratorReportDetail,
    type ReportGeneratorPreview, type ReportGeneratorStatus, type ReportGeneratorItemType, type ReportGeneratorClassification,
    type ReportGeneratorSearchableType, type ReportGeneratorSearchResultItem, type ReportGeneratorDiscoveryCandidate,
    type ReportGeneratorRefreshDiff, type ReportGeneratorHistoryEntry, type ReportGeneratorReviewChecklist as ReviewChecklistData,
    type ReportGeneratorComparison, type ReportGeneratorReadyCheck,
    type ReportGeneratorAiSectionType, type ReportGeneratorAiView, type ReportGeneratorAiDraft, type ReportGeneratorFactCheckFinding,
    type ReportGeneratorActionCandidate, type ReportGeneratorAiAction,
} from '../../services/api';

interface ReportGeneratorPageProps {
    onOpenEntity?: (entityType: string, entityId: string) => void;
    onOpenCase?: (caseId: number) => void;
    onViewNotesForEntity?: (entityType: string, entityId: string, label: string) => void;
    onViewNotesForCase?: (caseId: number, label: string) => void;
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
}

type Mode = 'dashboard' | 'list' | 'builder' | 'compare';

const ITEM_TYPE_OPTIONS: { value: ReportGeneratorItemType; label: string }[] = [
    { value: 'ioc', label: 'IOC' }, { value: 'threat_actor', label: 'Threat Actor / APT' }, { value: 'malware', label: 'Malware' },
    { value: 'campaign', label: 'Campaign' }, { value: 'vulnerability', label: 'Vulnerability (CVE ID)' }, { value: 'brand', label: 'Brand' },
    { value: 'company', label: 'Company' }, { value: 'case', label: 'Case / Investigation' }, { value: 'dark_web_observation', label: 'Dark Web Observation' },
    { value: 'credential_exposure', label: 'Credential Exposure' }, { value: 'social_investigation', label: 'OSINT Investigation' },
    { value: 'evidence', label: 'Evidence' }, { value: 'attack_technique', label: 'MITRE ATT&CK Technique' },
];
// REPORT_GENERATOR_PHASE2.md §4 — only the subset with a real, searchable backend list.
const SEARCHABLE_TYPE_OPTIONS: { value: ReportGeneratorSearchableType; label: string }[] =
    ITEM_TYPE_OPTIONS.filter((o) => o.value !== 'evidence' && o.value !== 'attack_technique') as { value: ReportGeneratorSearchableType; label: string }[];
const STATUS_COLOR: Record<string, { background: string; color: string }> = {
    draft: { background: 'rgba(167,139,250,0.15)', color: '#a78bfa' },
    ready: { background: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    published: { background: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    archived: { background: 'rgba(148,163,184,0.1)', color: '#64748b' },
};
const TAB_ICON: Record<Mode, React.ComponentType<{ size?: number | string }>> = { dashboard: LayoutGrid, list: FileText, compare: Scale, builder: FileText };
// Real, existing keys from database/reportGeneratorStorage.js's own
// FINGERPRINT_LIST_KEYS — friendlier display labels only, never a new
// category invented on the frontend.
const SECTION_DISPLAY_LABEL: Record<string, string> = {
    iocs: 'IOCs', threatActors: 'Threat Actors', malware: 'Malware', campaigns: 'Campaigns',
    vulnerabilities: 'Vulnerabilities', brand: 'Brand', darkWeb: 'Dark Web', credentialLeak: 'Credential Leak',
    attack: 'ATT&CK Techniques', evidence: 'Evidence', timeline: 'Timeline',
};

const ReportGeneratorPage: React.FC<ReportGeneratorPageProps> = (props) => {
    const [mode, setMode] = useState<Mode>('dashboard');
    const [openReportId, setOpenReportId] = useState<number | null>(null);
    const [templates, setTemplates] = useState<ReportGeneratorTemplatesResponse | null>(null);

    useEffect(() => { getReportGeneratorTemplates().then(setTemplates).catch(() => {}); }, []);

    const openBuilder = (id: number) => { setOpenReportId(id); setMode('builder'); };

    return (
        <div className="ti-container rg-page">
            <div className="ti-content">
                {/* Same real statement the page always carried (§2 "CRITICAL
                    DISTINCTION" in the comment at the top of this file), just
                    presented as a hero instead of one small note line. */}
                <div className="rg-hero">
                    <div className="rg-hero-left">
                        <div className="rg-hero-icon"><FileStack size={26} /></div>
                        <div className="rg-hero-titles">
                            <h1>Report Generator</h1>
                            <p className="rg-subtitle">Compile existing LekirraX intelligence into a structured analyst report.</p>
                            <div className="rg-hero-desc">
                                <div className="rg-hero-desc-line"><CheckCircle2 size={13} />No duplicate intelligence repository — this page never creates a second IOC/Evidence/Timeline/Risk repository.</div>
                                <div className="rg-hero-desc-line"><CheckCircle2 size={13} />Source grounded reporting — every value shown is read from its real, existing source.</div>
                            </div>
                        </div>
                    </div>
                    <div className="rg-hero-badges">
                        <span className="rg-hero-badge"><ShieldCheck size={12} />Source Grounded</span>
                        <span className="rg-hero-badge"><Database size={12} />Internal Intelligence</span>
                    </div>
                </div>

                <div className="rg-tabs">
                    {(['dashboard', 'list', 'compare'] as Mode[]).map((m) => {
                        const Icon = TAB_ICON[m];
                        return (
                            <button key={m} type="button" className={`rg-tab${mode === m ? ' active' : ''}`} onClick={() => { setMode(m); setOpenReportId(null); }}>
                                <Icon size={15} />{m === 'dashboard' ? 'Dashboard' : m === 'list' ? 'All Reports' : 'Compare Reports'}
                            </button>
                        );
                    })}
                </div>

                {mode === 'dashboard' && <DashboardView templates={templates} onOpenReport={openBuilder} onCreated={openBuilder} />}
                {mode === 'list' && <ListView onOpenReport={openBuilder} />}
                {mode === 'compare' && <CompareView />}
                {mode === 'builder' && openReportId != null && (
                    <BuilderView reportId={openReportId} templates={templates} onBack={() => setMode('list')} onDeleted={() => { setMode('list'); setOpenReportId(null); }} {...props} />
                )}
            </div>
        </div>
    );
};

// §9/§10/§11/§55 REPORT DASHBOARD — real counts, recent reports, [Create Report].
const DashboardView: React.FC<{ templates: ReportGeneratorTemplatesResponse | null; onOpenReport: (id: number) => void; onCreated: (id: number) => void }> = ({ templates, onOpenReport, onCreated }) => {
    const [dash, setDash] = useState<ReportGeneratorDashboard | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const load = useCallback(() => { getReportGeneratorDashboard().then(setDash).catch(() => {}); }, []);
    useEffect(() => { load(); }, [load]);

    return (
        <>
            {/* §7 INTELLIGENCE SOURCE — same real statement as the hero header
                above, restated as the small indicator the brief asked for. */}
            <div className="rg-source-note">
                <ShieldCheck size={16} className="rg-source-note-icon" />
                <div>
                    <div className="rg-source-note-title">Intelligence Source</div>
                    <div className="rg-source-note-text">Reports are generated from intelligence records already available inside LekirraX. No external data is added automatically.</div>
                </div>
            </div>

            <div className="rg-stat-grid">
                <div className="rg-stat-card total">
                    <div className="rg-stat-icon"><FileText size={20} /></div>
                    <div className="rg-stat-body">
                        <div className="rg-stat-value">{dash?.total ?? '—'}</div>
                        <div className="rg-stat-label">Total Reports</div>
                        <div className="rg-stat-sub">All time</div>
                    </div>
                </div>
                <div className="rg-stat-card draft">
                    <div className="rg-stat-icon"><PenLine size={20} /></div>
                    <div className="rg-stat-body">
                        <div className="rg-stat-value">{dash?.drafts ?? '—'}</div>
                        <div className="rg-stat-label">Drafts</div>
                        <div className="rg-stat-sub">In progress</div>
                    </div>
                </div>
                <div className="rg-stat-card ready">
                    <div className="rg-stat-icon"><CheckCircle2 size={20} /></div>
                    <div className="rg-stat-body">
                        <div className="rg-stat-value">{dash?.ready ?? '—'}</div>
                        <div className="rg-stat-label">Ready</div>
                        <div className="rg-stat-sub">Ready to publish</div>
                    </div>
                </div>
                <div className="rg-stat-card published">
                    <div className="rg-stat-icon"><UploadCloud size={20} /></div>
                    <div className="rg-stat-body">
                        <div className="rg-stat-value">{dash?.published ?? '—'}</div>
                        <div className="rg-stat-label">Published</div>
                        <div className="rg-stat-sub">Published reports</div>
                    </div>
                </div>
            </div>

            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="rg-recent-head">
                    <div>
                        <div className="rg-recent-title"><History size={15} />Recent Reports</div>
                        <p className="rg-recent-subtitle">Your most recent reports and drafts</p>
                    </div>
                    <button type="button" className="ti-action-btn rg-create-btn" onClick={() => setShowCreate(true)}><Plus size={15} />Create Report</button>
                </div>
                {!dash || dash.recent.length === 0 ? (
                    <div className="rg-empty">
                        <div className="rg-empty-icon"><FileStack size={26} /></div>
                        <div className="rg-empty-title">No reports yet</div>
                        <div className="rg-empty-desc">Create your first report using intelligence already stored inside LekirraX.</div>
                        <button type="button" className="ti-action-btn rg-create-btn" onClick={() => setShowCreate(true)}><Plus size={15} />Create Report</button>
                    </div>
                ) : (
                    <div className="rg-report-list">
                        {dash.recent.map((r) => (
                            <div key={r.id} className="rg-report-row" onClick={() => onOpenReport(r.id)}>
                                <div className="rg-report-icon"><FileText size={17} /></div>
                                <div className="rg-report-main">
                                    <div className="rg-report-title-row"><span className="rg-report-title">{r.title}</span></div>
                                    <div className="rg-report-meta">
                                        <span className="rg-report-meta-item"><Tag size={12} />{r.reportType}</span>
                                        {r.updatedAt && <span className="rg-report-meta-item"><CalendarClock size={12} />{formatDateTime(r.updatedAt)}</span>}
                                    </div>
                                </div>
                                <span className="ti-badge rg-report-status" style={STATUS_COLOR[r.status]}>{r.status}</span>
                                <ChevronRight size={16} className="rg-report-chevron" />
                            </div>
                        ))}
                    </div>
                )}
            </div>
            {showCreate && templates && (
                <CreateReportForm templates={templates} onClose={() => setShowCreate(false)} onCreated={(id) => { setShowCreate(false); load(); onCreated(id); }} />
            )}
        </>
    );
};

// §9/§12/§13 REPORT CREATION — Title/Type/Template/Classification/
// Description/Primary Scope. §15 — the id is revalidated server side; this
// form never assumes it is correct.
const CreateReportForm: React.FC<{ templates: ReportGeneratorTemplatesResponse; onClose: () => void; onCreated: (id: number) => void }> = ({ templates, onClose, onCreated }) => {
    const [title, setTitle] = useState('');
    const [reportType, setReportType] = useState(templates.reportTypes[0] || 'Threat Assessment');
    const [classification, setClassification] = useState<ReportGeneratorClassification>('Internal');
    const [description, setDescription] = useState('');
    const [scopeType, setScopeType] = useState<ReportGeneratorItemType | ''>('');
    const [scopeId, setScopeId] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        if (!title.trim()) { setErr('Title is required.'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await createReportGeneratorReport({
                title: title.trim(), reportType, classification, description: description.trim() || undefined,
                primaryScope: scopeType && scopeId.trim() ? { type: scopeType, id: scopeId.trim() } : undefined,
                // SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout
                // order — Reports inherits its client via case_id (a
                // pre-existing, singular 1:1 FK). Setting Primary Scope to
                // "Case" is the natural, already-existing way an analyst
                // relates a report to one case — this just also threads
                // that same id into case_id, so a report about Client X's
                // case actually becomes visible in Client X's portal once
                // published, instead of case_id silently staying NULL.
                caseId: scopeType === 'case' && scopeId.trim() ? Number(scopeId.trim()) : undefined,
            });
            if (res.duplicateTitle) setErr('Note: a report with this title already existed — this created a separate, new report (never an overwrite).');
            onCreated(res.id);
        } catch (e: any) { setErr(e?.message || 'Failed to create report.'); } finally { setBusy(false); }
    };

    const template = templates.templates[reportType];
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Create Report</div>
            <div className="ti-kv" style={{ gridTemplateColumns: '160px 1fr' }}>
                <span className="k">Title</span><span className="v"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} /></span>
                <span className="k">Report Type</span><span className="v">
                    <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                        {templates.reportTypes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                </span>
                <span className="k">Classification</span><span className="v">
                    <select value={classification} onChange={(e) => setClassification(e.target.value as ReportGeneratorClassification)}>
                        {(['Unclassified', 'Internal', 'Confidential', 'Restricted'] as const).map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                </span>
                <span className="k">Description</span><span className="v"><textarea value={description} onChange={(e) => setDescription(e.target.value)} style={{ width: '100%', minHeight: '50px' }} /></span>
                <span className="k">Primary Scope (optional)</span>
                <span className="v" style={{ display: 'flex', gap: '8px' }}>
                    <select value={scopeType} onChange={(e) => setScopeType(e.target.value as ReportGeneratorItemType | '')} style={{ maxWidth: '220px' }}>
                        <option value="">None</option>
                        {ITEM_TYPE_OPTIONS.filter((o) => o.value !== 'evidence' && o.value !== 'attack_technique').map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                    <input type="text" placeholder="ID (e.g. 42, or CVE-2024-1234)" value={scopeId} onChange={(e) => setScopeId(e.target.value)} style={{ flex: 1 }} />
                </span>
            </div>
            {scopeType === 'case' && scopeId.trim() && (
                <div className="ti-note" style={{ marginTop: '8px' }}>
                    Scoping this report to a case also makes it visible in that client's Client Portal once published — the client sees only published reports for their own case(s).
                </div>
            )}
            {template && <div className="ti-note" style={{ marginTop: '8px' }}>Template sections: {template.sections.map((s) => templates.sectionLabels[s] || s).join(', ')}</div>}
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Report'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

// §36-§38 REPORT COMPARISON — deterministic field-by-field diff of two
// reports, never a semantic/AI similarity judgment. State, the `run()` call,
// and the /api/report-generator/compare request are UNCHANGED from before —
// only the presentation below is new.
const CompareView: React.FC = () => {
    const [options, setOptions] = useState<ReportGeneratorReport[]>([]);
    const [idA, setIdA] = useState('');
    const [idB, setIdB] = useState('');
    const [cmp, setCmp] = useState<ReportGeneratorComparison | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);

    useEffect(() => { getReportGeneratorReports({ pageSize: 100 }).then((res) => setOptions(res.items)).catch(() => {}); }, []);

    const run = async () => {
        if (!idA || !idB) { setErr('Select two reports to compare.'); return; }
        setBusy(true); setErr(null); setCmp(null);
        try { setCmp(await compareReportGeneratorReports(idA, idB)); } catch (e: any) { setErr(e?.message || 'Failed to compare reports.'); } finally { setBusy(false); }
    };

    // Richer metadata (type/status/date) for the selector + summary cards —
    // reads the SAME `options` list already fetched above, never a second
    // API call. compareReportGeneratorReports()'s own result only carries
    // {id, title} for each side; this is what fills in the rest, and only
    // ever with a report's OWN real fields.
    const reportA = options.find((o) => String(o.id) === idA) || null;
    const reportB = options.find((o) => String(o.id) === idB) || null;

    const sectionEntries = Object.entries(cmp?.sections || {}).filter(([, d]) => d.added.length || d.removed.length || d.unchanged.length);
    const changedSectionCount = sectionEntries.filter(([, d]) => d.added.length || d.removed.length).length;

    return (
        <>
            <div className="rg-cmp-header">
                <div className="rg-cmp-header-title"><Scale size={16} />Compare Reports</div>
                <p className="rg-cmp-header-sub">Compare intelligence findings, assessments, and report changes side by side.</p>
            </div>

            <div className="ti-card rg-cmp-picker">
                <ReportSelectorCard label="Report A" placeholder="Select Report A…" report={reportA} value={idA} onChange={setIdA} options={options} />
                <div className="rg-cmp-arrow"><ArrowLeftRight size={18} /></div>
                <ReportSelectorCard label="Report B" placeholder="Select Report B…" report={reportB} value={idB} onChange={setIdB} options={options} />
            </div>
            <div className="rg-cmp-action">
                {/* Same run() as before — still shows the same inline error
                    when either side is empty, rather than a silently
                    disabled button with no explanation. */}
                <button type="button" className="ti-action-btn rg-create-btn" onClick={run} disabled={busy}>
                    <ArrowLeftRight size={15} />{busy ? 'Comparing…' : 'Compare Reports'}
                </button>
                {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            </div>

            {!cmp ? (
                <div className="ti-card rg-cmp-empty">
                    <div className="rg-empty-icon"><Scale size={26} /></div>
                    <div className="rg-empty-title">Select two reports to compare</div>
                    <div className="rg-empty-desc">Choose two existing reports to analyse differences in intelligence findings, assessments, and key observations.</div>
                    <div className="rg-cmp-features">
                        <div className="rg-cmp-feature"><SearchCheck size={14} />Compare Findings</div>
                        <div className="rg-cmp-feature"><Diff size={14} />Identify Changes</div>
                        <div className="rg-cmp-feature"><ListChecks size={14} />Review Key Differences</div>
                    </div>
                </div>
            ) : (
                <>
                    <div className="rg-cmp-summary-grid">
                        <div className="ti-card">
                            <div className="rg-cmp-card-label">Report A</div>
                            <ReportMetaBlock report={reportA} fallbackTitle={cmp.reportA.title} fallbackId={cmp.reportA.id} />
                        </div>
                        <div className="ti-card">
                            <div className="rg-cmp-card-label">Report B</div>
                            <ReportMetaBlock report={reportB} fallbackTitle={cmp.reportB.title} fallbackId={cmp.reportB.id} />
                        </div>
                    </div>

                    {/* Executive Overview — a count computed from the real
                        arrays below, not a new judgment; the underlying
                        note is the exact disclaimer the API itself returns. */}
                    <div className="ti-card" style={{ marginBottom: '16px' }}>
                        <div className="ti-card-title">Executive Overview</div>
                        <p className="ti-note">
                            {cmp.metadata.changed.length} metadata field(s) differ, {cmp.narrative.changed.length} narrative section(s) differ,
                            {sectionEntries.length > 0
                                ? ` and ${changedSectionCount} of ${sectionEntries.length} intelligence categories changed between these two reports.`
                                : ' and neither report has intelligence entities added yet to compare.'}
                        </p>
                        <div className="ti-note" style={{ fontStyle: 'italic' }}>{cmp.note}</div>
                    </div>

                    <div className="ti-card" style={{ marginBottom: '16px' }}>
                        <div className="ti-card-title">Metadata Differences</div>
                        {cmp.metadata.changed.length === 0 ? <div className="ti-empty">No metadata differences.</div> : (
                            <ul className="ti-list">
                                {cmp.metadata.changed.map((c) => (
                                    <li key={c.field}><span className="rg-diff-tag changed">Changed</span> <strong>{c.field}</strong>: {String(c.from) || '—'} → {String(c.to) || '—'}</li>
                                ))}
                            </ul>
                        )}
                        {cmp.metadata.unchanged.length > 0 && <div className="ti-note"><span className="rg-diff-tag matching">Matching</span> {cmp.metadata.unchanged.join(', ')}</div>}
                    </div>

                    <div className="ti-card" style={{ marginBottom: '16px' }}>
                        <div className="ti-card-title">Narrative Sections</div>
                        {cmp.narrative.changed.length === 0 ? <div className="ti-empty">No narrative differences.</div> : (
                            <ul className="ti-list">
                                {cmp.narrative.changed.map((f) => <li key={f}><span className="rg-diff-tag changed">Changed</span> {f}</li>)}
                            </ul>
                        )}
                        {cmp.narrative.unchanged.length > 0 && <div className="ti-note"><span className="rg-diff-tag matching">Matching</span> {cmp.narrative.unchanged.join(', ')}</div>}
                    </div>

                    {sectionEntries.length > 0 && (
                        <>
                            <div className="ti-card-title" style={{ margin: '4px 4px 12px' }}>Intelligence Differences</div>
                            <div className="rg-cmp-sections-grid">
                                {sectionEntries.map(([key, d]) => (
                                    <div key={key} className="ti-card">
                                        <div className="ti-card-title">{SECTION_DISPLAY_LABEL[key] || key}</div>
                                        <div className="rg-diff-row"><span className="rg-diff-tag added">Added</span><span className="rg-diff-count">{d.added.length}</span></div>
                                        <div className="rg-diff-row"><span className="rg-diff-tag removed">Removed</span><span className="rg-diff-count">{d.removed.length}</span></div>
                                        <div className="rg-diff-row"><span className="rg-diff-tag matching">Matching</span><span className="rg-diff-count">{d.unchanged.length}</span></div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </>
            )}
        </>
    );
};

const ReportSelectorCard: React.FC<{
    label: string; placeholder: string; report: ReportGeneratorReport | null; value: string;
    onChange: (v: string) => void; options: ReportGeneratorReport[];
}> = ({ label, placeholder, report, value, onChange, options }) => (
    <div className="rg-cmp-card">
        <div className="rg-cmp-card-label">{label}</div>
        {report ? <ReportMetaBlock report={report} fallbackTitle={report.title} fallbackId={report.id} /> : (
            <div className="rg-cmp-card-placeholder">
                <div className="rg-cmp-card-placeholder-title">Select a report</div>
                <div className="rg-cmp-card-placeholder-desc">Choose {label === 'Report A' ? 'the first' : 'the second'} report to compare</div>
            </div>
        )}
        <select className="rg-cmp-select" value={value} onChange={(e) => onChange(e.target.value)}>
            <option value="">{placeholder}</option>
            {options.map((r) => <option key={r.id} value={r.id}>#{r.id} — {r.title}</option>)}
        </select>
    </div>
);

// Real fields only (title, reportType, status, createdAt) — reused by both
// the selector cards above and the after-comparison summary cards.
const ReportMetaBlock: React.FC<{ report: ReportGeneratorReport | null; fallbackTitle: string; fallbackId: number }> = ({ report, fallbackTitle, fallbackId }) => (
    <div className="rg-cmp-card-selected">
        <div className="rg-cmp-card-title">{report?.title || fallbackTitle} <span className="ti-note">#{report?.id ?? fallbackId}</span></div>
        {report ? (
            <>
                <div className="rg-cmp-card-meta">
                    <span className="ti-badge">{report.reportType}</span>
                    <span className="ti-badge" style={STATUS_COLOR[report.status]}>{report.status}</span>
                </div>
                {report.createdAt && <div className="rg-cmp-card-date"><CalendarClock size={12} />{formatDateTime(report.createdAt)}</div>}
            </>
        ) : <div className="ti-note" style={{ fontStyle: 'italic' }}>Full metadata unavailable — this report is outside the first 100 results.</div>}
    </div>
);

// §52/§53/§54 SEARCH / FILTERS / PAGINATION — server side.
const REPORT_TYPE_OPTIONS = ['Threat Assessment', 'APT / Threat Actor Assessment', 'Malware Analysis', 'IOC Analysis', 'Incident Investigation', 'Credential Exposure Report', 'Brand Exposure Report', 'Vulnerability Assessment', 'Intelligence Summary'];

const ListView: React.FC<{ onOpenReport: (id: number) => void }> = ({ onOpenReport }) => {
    const [items, setItems] = useState<ReportGeneratorReport[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [q, setQ] = useState('');
    const [status, setStatus] = useState('');
    const [reportType, setReportType] = useState('');
    const [hasEvidence, setHasEvidence] = useState(false);
    const [hasTimeline, setHasTimeline] = useState(false);
    const [hasIoc, setHasIoc] = useState(false);
    const [loading, setLoading] = useState(true);
    // Presentation-only: which filters are active, and whether the "More
    // Filters" popover (Has Evidence/Timeline/IOC — same 3 checkboxes,
    // same state, just relocated) is open. Neither touches the query logic.
    const [showMoreFilters, setShowMoreFilters] = useState(false);
    const moreFiltersRef = useRef<HTMLDivElement>(null);

    const load = useCallback((p = 1) => {
        setLoading(true);
        const params: any = { page: p, pageSize };
        if (q.trim()) params.q = q.trim();
        if (status) params.status = status;
        if (reportType) params.reportType = reportType;
        if (hasEvidence) params.hasEvidence = 'true';
        if (hasTimeline) params.hasTimeline = 'true';
        if (hasIoc) params.hasIoc = 'true';
        getReportGeneratorReports(params).then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); }).finally(() => setLoading(false));
    }, [q, status, reportType, hasEvidence, hasTimeline, hasIoc]);
    useEffect(() => { load(1); }, [load]);

    useEffect(() => {
        if (!showMoreFilters) return;
        const onClick = (e: MouseEvent) => { if (moreFiltersRef.current && !moreFiltersRef.current.contains(e.target as Node)) setShowMoreFilters(false); };
        document.addEventListener('mousedown', onClick);
        return () => document.removeEventListener('mousedown', onClick);
    }, [showMoreFilters]);

    const moreFiltersActive = (hasEvidence ? 1 : 0) + (hasTimeline ? 1 : 0) + (hasIoc ? 1 : 0);
    const activeFilterCount = (q.trim() ? 1 : 0) + (status ? 1 : 0) + (reportType ? 1 : 0) + moreFiltersActive;
    const clearFilters = () => { setQ(''); setStatus(''); setReportType(''); setHasEvidence(false); setHasTimeline(false); setHasIoc(false); };

    const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const rangeEnd = Math.min(page * pageSize, total);

    return (
        <>
            <div className="rg-list-header">
                <div>
                    <div className="rg-list-header-title">All Reports</div>
                    <p className="rg-list-header-sub">Browse, search, and manage intelligence reports generated from LekirraX.</p>
                </div>
                <span className="rg-list-count">{total} Report{total === 1 ? '' : 's'}</span>
            </div>

            <div className="ti-card rg-filter-toolbar">
                <div className="rg-filter-search">
                    <Search size={15} />
                    <input type="text" placeholder="Search by title or entity..." value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} />
                </div>
                <select className="rg-filter-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                    <option value="">All Status</option><option value="draft">Draft</option><option value="ready">Ready</option><option value="published">Published</option><option value="archived">Archived</option>
                </select>
                <select className="rg-filter-select" value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    <option value="">All Types</option>
                    {REPORT_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <div className="rg-more-filters" ref={moreFiltersRef}>
                    <button type="button" className={`rg-filter-more-btn${moreFiltersActive > 0 ? ' active' : ''}`} onClick={() => setShowMoreFilters((v) => !v)}>
                        <SlidersHorizontal size={14} />More Filters{moreFiltersActive > 0 && <span className="rg-filter-more-badge">{moreFiltersActive}</span>}
                    </button>
                    {showMoreFilters && (
                        <div className="rg-filter-popover">
                            <div className="rg-filter-popover-title">Filter Options</div>
                            <label className="rg-filter-checkbox-row"><input type="checkbox" checked={hasEvidence} onChange={(e) => setHasEvidence(e.target.checked)} /> Has Evidence</label>
                            <label className="rg-filter-checkbox-row"><input type="checkbox" checked={hasTimeline} onChange={(e) => setHasTimeline(e.target.checked)} /> Has Timeline</label>
                            <label className="rg-filter-checkbox-row"><input type="checkbox" checked={hasIoc} onChange={(e) => setHasIoc(e.target.checked)} /> Has IOC</label>
                        </div>
                    )}
                </div>
                <button type="button" className="ti-action-btn rg-filter-apply-btn" onClick={() => load(1)}>Apply</button>
            </div>

            <div className="rg-results-summary">
                <span>{loading ? 'Loading…' : `Showing ${total === 0 ? 0 : items.length} report${items.length === 1 ? '' : 's'}`}</span>
                {activeFilterCount > 0 && <button type="button" className="rg-clear-filters-link" onClick={clearFilters}><X size={12} />Clear Filters</button>}
            </div>

            <div className="ti-card rg-table-card">
                <div className="ti-table-wrap">
                    <table className="ti-table rg-report-table">
                        <thead><tr><th>ID</th><th>Title</th><th>Type</th><th>Status</th><th>Primary Scope</th><th>Created By</th><th>Updated</th></tr></thead>
                        <tbody>
                            {loading ? <tr><td colSpan={7} className="ti-empty">Loading…</td></tr> : items.length === 0 ? (
                                <tr><td colSpan={7}>
                                    <div className="rg-empty">
                                        <div className="rg-empty-icon"><FileStack size={26} /></div>
                                        <div className="rg-empty-title">No reports found</div>
                                        <div className="rg-empty-desc">Try adjusting your search or filters to find the intelligence reports you are looking for.</div>
                                        {activeFilterCount > 0 && <button type="button" className="ti-action-btn rg-create-btn" onClick={clearFilters}>Clear Filters</button>}
                                    </div>
                                </td></tr>
                            ) : items.map((r) => (
                                <tr key={r.id} className="ti-row-clickable" onClick={() => onOpenReport(r.id)}>
                                    <td className="ti-note">#{r.id}</td>
                                    <td>
                                        <div className="rg-table-title"><FileText size={14} />
                                            <div>
                                                <div className="rg-table-title-text">{r.title}</div>
                                                {r.description && <div className="rg-table-title-sub">{r.description}</div>}
                                            </div>
                                        </div>
                                    </td>
                                    <td><span className="ti-badge rg-type-badge">{r.reportType}</span></td>
                                    <td><span className="ti-badge rg-status-dot" style={STATUS_COLOR[r.status]}><i /> {r.status}</span></td>
                                    <td className="ti-note">
                                        {r.primaryScope ? `${r.primaryScope.type} #${r.primaryScope.id}` : <span className="rg-scope-none"><MapPinOff size={12} />No primary scope</span>}
                                    </td>
                                    <td className="ti-note"><span className="rg-table-author"><User size={12} />{r.authorUsername || '—'}</span></td>
                                    <td className="ti-note">
                                        {r.updatedAt ? (
                                            <div className="rg-table-updated">
                                                <span>{formatDate(r.updatedAt)}</span>
                                                <span className="rg-table-updated-time">{new Date(r.updatedAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        ) : '—'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="ti-pagination rg-pagination-bar">
                    <span className="ti-pagination-info">{total === 0 ? 'No reports' : `Showing ${rangeStart}–${rangeEnd} of ${total.toLocaleString()} report${total === 1 ? '' : 's'}`}</span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <button type="button" disabled={page <= 1} onClick={() => load(page - 1)}>‹ Previous</button>
                        <span className="ti-pagination-info">Page {page} of {Math.max(1, Math.ceil(total / pageSize))}</span>
                        <button type="button" disabled={page * pageSize >= total} onClick={() => load(page + 1)}>Next ›</button>
                    </div>
                </div>
            </div>
        </>
    );
};

type BuilderTab = 'scope' | 'narrative' | 'sections' | 'preview' | 'review' | 'history' | 'ai';
const BUILDER_TAB_LABEL: Record<BuilderTab, string> = {
    scope: 'Scope & Intelligence', narrative: 'Narrative', sections: 'Sections', preview: 'Preview & Export',
    ai: 'AI Assist', review: 'Review Checklist', history: 'Change History',
};

// §57 REPORT DETAIL — Overview/Metadata/Sections/Entities/Evidence/
// Timeline/Sources/Risk/Export, all in one detail page navigable by tab
// (§60's recommended step flow, without forcing strict linearity — every
// tab remains reachable at any time, matching how every other builder-style
// page in this codebase already works).
const BuilderView: React.FC<{ reportId: number; templates: ReportGeneratorTemplatesResponse | null; onBack: () => void; onDeleted: () => void } & ReportGeneratorPageProps> = ({ reportId, templates, onBack, onDeleted, onOpenEntity, onOpenCase, onViewNotesForEntity, onViewNotesForCase, onViewKnowledge, onCreateThreatBrief }) => {
    const [report, setReport] = useState<ReportGeneratorReportDetail | null>(null);
    const [tab, setTab] = useState<BuilderTab>('scope');
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [showRefresh, setShowRefresh] = useState(false);
    const [readyCheck, setReadyCheck] = useState<ReportGeneratorReadyCheck | null>(null);
    const [readyCheckBusy, setReadyCheckBusy] = useState(false);

    const load = useCallback(() => { getReportGeneratorReport(reportId).then(setReport).catch((e) => setMsg({ ok: false, text: e?.message || 'Failed to load report.' })); }, [reportId]);
    useEffect(() => { setReport(null); load(); }, [load]);

    if (!report) return <div className="ti-empty">Loading report…</div>;
    const isEditable = report.status === 'draft' || report.status === 'ready';

    // §"READY-STATE VALIDATION" — "Ready" is a checked transition, never a
    // silent one; the analyst sees exactly which checks passed/failed.
    const setStatus = async (status: ReportGeneratorStatus) => {
        setBusy(true); setMsg(null);
        try {
            const res: any = await setReportGeneratorStatus(reportId, status);
            const note = res?.validation?.note || res?.note;
            setMsg({ ok: true, text: note ? `Marked ${status}. ${note}` : `Marked ${status}.` });
            load();
        }
        catch (e: any) { setMsg({ ok: false, text: e?.message || 'Failed to update status.' }); } finally { setBusy(false); }
    };
    const remove = async () => {
        setBusy(true);
        try { await deleteReportGeneratorReport(reportId); onDeleted(); } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Failed to delete.' }); } finally { setBusy(false); }
    };
    const duplicate = async () => {
        setBusy(true);
        try { const res = await duplicateReportGeneratorReport(reportId); setMsg({ ok: true, text: `Duplicated as report #${res.id}.` }); }
        catch (e: any) { setMsg({ ok: false, text: e?.message || 'Failed to duplicate.' }); } finally { setBusy(false); }
    };
    // §"READY-STATE VALIDATION" preview — lets the analyst see the SAME
    // completeness/source-authorization/conflicts/freshness checks Mark
    // Ready itself runs, before actually attempting the transition.
    const checkReady = async () => {
        setReadyCheckBusy(true);
        try { setReadyCheck(await getReportGeneratorReadyCheck(reportId)); } catch (e: any) { setMsg({ ok: false, text: e?.message || 'Failed to run Ready-state check.' }); } finally { setReadyCheckBusy(false); }
    };

    return (
        <>
            <button type="button" className="rg-back-link" onClick={onBack}><ArrowLeft size={14} />Back to Reports</button>

            <div className="ti-card rg-builder-header">
                <div className="rg-builder-header-main">
                    <div className="rg-builder-icon"><FileText size={22} /></div>
                    <div className="rg-builder-titles">
                        <div className="rg-builder-title-row">
                            <h1>{report.title}</h1>
                            <span className="ti-badge" style={STATUS_COLOR[report.status]}>{report.status}</span>
                        </div>
                        <div className="rg-builder-meta-row">
                            <span className="rg-builder-meta-item"><ShieldCheck size={13} />{report.reportType}</span>
                            <span className="rg-builder-meta-item"><Lock size={13} />Classification: <strong>{report.classification}</strong></span>
                            <span className="rg-builder-meta-item"><Target size={13} />Primary Scope: {report.primaryScope ? `${report.primaryScope.type} #${report.primaryScope.id}` : 'None'}</span>
                            <span className="rg-builder-meta-item">
                                <FolderOpen size={13} />Case: {report.caseId ? <button type="button" className="rg-inline-link" onClick={() => onOpenCase?.(report.caseId!)}>#{report.caseId}</button> : 'None'}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="rg-builder-actions">
                    <div className="rg-actions-primary">
                        {report.status === 'draft' && <button type="button" className="rg-btn-primary" onClick={() => setStatus('ready')} disabled={busy}><CheckCircle2 size={14} />Mark Ready</button>}
                        {report.status === 'ready' && <button type="button" className="rg-btn-primary" onClick={() => setStatus('published')} disabled={busy}><UploadCloud size={14} />Publish</button>}
                        {onCreateThreatBrief && <button type="button" className="rg-btn-primary rg-btn-primary--outline" onClick={() => onCreateThreatBrief('report_generator', String(reportId))}><FileStack size={14} />Create Threat Brief Draft</button>}
                    </div>
                    <div className="rg-actions-secondary">
                        {report.status !== 'archived' && <button type="button" className="ti-action-btn" onClick={() => setStatus('archived')} disabled={busy}><Archive size={13} />Archive</button>}
                        <button type="button" className="ti-action-btn" onClick={duplicate} disabled={busy}><Copy size={13} />Duplicate Draft</button>
                        {isEditable && <button type="button" className="ti-action-btn" onClick={() => setShowRefresh(true)} disabled={busy}><RefreshCw size={13} />Refresh Intelligence</button>}
                        {report.status === 'draft' && <button type="button" className="ti-action-btn" onClick={checkReady} disabled={readyCheckBusy}><ClipboardCheck size={13} />{readyCheckBusy ? 'Checking…' : 'Check Ready State'}</button>}
                        <button type="button" className="ti-action-btn rg-btn-danger" onClick={remove} disabled={busy}><Trash2 size={13} />Delete</button>
                    </div>
                </div>

                {!isEditable && <div className="ti-note" style={{ marginTop: '10px', fontStyle: 'italic' }}>This report is {report.status} — duplicate it as a new draft to make further changes.</div>}
                {msg && <div className={msg.ok ? 'ti-note' : 'ti-error'} style={msg.ok ? { color: '#4ade80', marginTop: '10px' } : { marginTop: '10px' }}>{msg.text}</div>}
                {showRefresh && <RefreshIntelligencePanel reportId={reportId} onClose={() => setShowRefresh(false)} onApplied={() => { setShowRefresh(false); load(); }} />}
                {readyCheck && (
                    <div className="ti-card" style={{ marginTop: '10px' }}>
                        <div className="ti-card-title">Ready-State Check</div>
                        <div className="ti-note" style={{ marginBottom: '6px', fontStyle: 'italic' }}>{readyCheck.note}</div>
                        <ul className="ti-list">
                            <li style={{ color: readyCheck.sourceAuthorization.pass ? '#4ade80' : '#f87171' }}>{readyCheck.sourceAuthorization.pass ? '✓' : '✗'} Source Authorization {readyCheck.sourceAuthorization.pass ? '' : `— ${readyCheck.sourceAuthorization.issues.length} broken reference(s), blocks Ready`}</li>
                            <li style={{ color: readyCheck.completeness.percent === 100 ? '#4ade80' : '#eab308' }}>{readyCheck.completeness.percent === 100 ? '✓' : '○'} Completeness — {readyCheck.completeness.percent}%</li>
                            <li style={{ color: readyCheck.conflicts.pass ? '#4ade80' : '#eab308' }}>{readyCheck.conflicts.pass ? '✓' : '○'} Conflicts — {readyCheck.conflicts.count} unresolved</li>
                            <li style={{ color: readyCheck.freshness.pass ? '#4ade80' : '#eab308' }}>{readyCheck.freshness.pass ? '✓' : '○'} Freshness — {readyCheck.freshness.stale ? 'Updated since last refresh' : 'Up to date'}</li>
                        </ul>
                        <button type="button" className="ti-action-btn" onClick={() => setReadyCheck(null)}>Close</button>
                    </div>
                )}
            </div>

            {/* §2 REPORT WORKFLOW — same 7 tabs, same setTab(t), same
                non-linear reachability (every tab stays clickable at any
                time, per this file's own established convention) — just a
                numbered-step presentation instead of a flat button row. */}
            <div className="ti-card rg-report-workflow">
                <div className="rg-report-workflow-title">Report Workflow</div>
                <div className="rg-workflow-tabs">
                    {(['scope', 'narrative', 'sections', 'preview', 'ai', 'review', 'history'] as BuilderTab[]).map((t, i, arr) => (
                        <React.Fragment key={t}>
                            <button type="button" className={`rg-workflow-tab${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
                                <span className="rg-workflow-tab-num">{i + 1}</span>
                                <span>{BUILDER_TAB_LABEL[t]}</span>
                            </button>
                            {i < arr.length - 1 && <span className="rg-workflow-tab-connector" />}
                        </React.Fragment>
                    ))}
                </div>
            </div>

            {tab === 'scope' && <ScopeTab report={report} editable={isEditable} onChanged={load} onOpenEntity={onOpenEntity} onOpenCase={onOpenCase} onViewNotesForEntity={onViewNotesForEntity} onViewNotesForCase={onViewNotesForCase} onViewKnowledge={onViewKnowledge} />}
            {tab === 'narrative' && <NarrativeTab report={report} editable={isEditable} onChanged={load} />}
            {tab === 'sections' && <SectionsTab report={report} templates={templates} editable={isEditable} onChanged={load} />}
            {tab === 'preview' && <PreviewTab reportId={reportId} />}
            {tab === 'ai' && <AiAssistTab reportId={reportId} editable={isEditable} onNarrativeChanged={load} />}
            {tab === 'review' && <ReviewChecklistTab reportId={reportId} />}
            {tab === 'history' && <HistoryTab reportId={reportId} />}
        </>
    );
};

// §12/§13/§14/§15/§16 SCOPE / RELATED ENTITIES / INTELLIGENCE SELECTION —
// every add is revalidated server side; a rejection here is the real §15/§76
// guarantee at work, not a bug.
const ScopeTab: React.FC<{
    report: ReportGeneratorReportDetail; editable: boolean; onChanged: () => void;
} & Pick<ReportGeneratorPageProps, 'onOpenEntity' | 'onOpenCase' | 'onViewNotesForEntity' | 'onViewNotesForCase' | 'onViewKnowledge'>> = ({ report, editable, onChanged, onOpenEntity, onOpenCase, onViewNotesForEntity, onViewNotesForCase, onViewKnowledge }) => {
    const [role, setRole] = useState<'primary' | 'related'>('related');
    const [err, setErr] = useState<string | null>(null);

    const addItem = async (itemType: ReportGeneratorItemType, itemId: string) => {
        setErr(null);
        try { await addReportGeneratorSelection(report.id, { itemType, itemId, role }); onChanged(); }
        catch (e: any) { setErr(e?.message || 'You do not have access to this item, or it does not exist.'); }
    };
    const remove = async (t: ReportGeneratorItemType, id: string) => {
        await removeReportGeneratorSelection(report.id, t, id).catch(() => {});
        onChanged();
    };
    const viewItem = (t: string, id: string) => {
        if (t === 'case') { onOpenCase?.(Number(id)); return; }
        if (['ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability', 'attack_technique'].includes(t)) { onOpenEntity?.(t, id); return; }
    };
    const selectedKeys = new Set(report.selections.map((s) => `${s.itemType}:${s.itemId}`));

    return (
        <div className="rg-workflow">
            {editable && (
                <WorkflowStep num={1}>
                    <div className="ti-card rg-step-card">
                        <div className="rg-step-card-head">
                            <div>
                                <div className="rg-step-card-title">Add Intelligence</div>
                                <p className="rg-step-card-desc">Search existing LekirraX intelligence records and add relevant intelligence to this report.</p>
                            </div>
                            <span className="rg-integrity-badge"><ShieldCheck size={12} />Existing Intelligence Only</span>
                        </div>
                        <div className="rg-add-intel-grid">
                            <div className="rg-field">
                                <label className="rg-field-label">Relationship to Report</label>
                                <select className="rg-filter-select" value={role} onChange={(e) => setRole(e.target.value as 'primary' | 'related')}>
                                    <option value="related">Related</option><option value="primary">Primary</option>
                                </select>
                                <div className="rg-field-hint">Define how this intelligence is related to the report scope.</div>
                            </div>
                            <EntityPicker onPick={(t, id) => addItem(t, id)} alreadySelected={selectedKeys} />
                        </div>
                        {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
                        <div className="ti-note" style={{ marginTop: '10px', fontStyle: 'italic' }}>Search reuses each module's own real, existing records — every add is still revalidated server side; an item you cannot access will be rejected, never silently included.</div>
                    </div>
                </WorkflowStep>
            )}
            {editable && <DiscoveryPanel reportId={report.id} alreadySelected={selectedKeys} onAdded={onChanged} />}
            <WorkflowStep num={4}>
                <div className="ti-card rg-step-card">
                    <div className="rg-step-card-head">
                        <div>
                            <div className="rg-step-card-title">Selected Intelligence <span className="rg-count-badge">{report.selections.length}</span></div>
                            <p className="rg-step-card-desc">Selected intelligence will be included in this report's analysis and supporting context.</p>
                        </div>
                    </div>
                    {report.selections.length === 0 ? (
                        <div className="rg-empty rg-empty-compact">
                            <div className="rg-empty-icon"><Layers size={22} /></div>
                            <div className="rg-empty-title">No intelligence selected</div>
                            <div className="rg-empty-desc">Selected intelligence will become part of this report's analysis and supporting context.</div>
                        </div>
                    ) : (
                        <div className="rg-selected-list">
                            {report.selections.map((s) => {
                                const Icon = ENTITY_TYPE_ICON[s.itemType] || Tag;
                                return (
                                    <div key={`${s.itemType}:${s.itemId}`} className="rg-selected-row">
                                        <span className="rg-selected-icon"><Icon size={14} /></span>
                                        <div className="rg-selected-main">
                                            <div className="rg-selected-title">#{s.itemId} <span className="ti-badge rg-type-badge">{ITEM_TYPE_OPTIONS.find((o) => o.value === s.itemType)?.label || s.itemType}</span></div>
                                            <div className="rg-selected-sub">Relationship: <strong>{s.role}</strong></div>
                                        </div>
                                        <div className="rg-selected-actions">
                                            {(s.itemType === 'case' || ['ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability', 'attack_technique'].includes(s.itemType)) && (
                                                <button type="button" className="ti-action-btn" onClick={() => viewItem(s.itemType, s.itemId)}>View</button>
                                            )}
                                            {onViewNotesForCase && s.itemType === 'case' && (
                                                <button type="button" className="ti-action-btn" onClick={() => onViewNotesForCase(Number(s.itemId), `Case #${s.itemId}`)}>Notes</button>
                                            )}
                                            {onViewNotesForEntity && s.itemType !== 'case' && s.itemType !== 'evidence' && s.itemType !== 'timeline_event' && (
                                                <button type="button" className="ti-action-btn" onClick={() => onViewNotesForEntity(s.itemType, s.itemId, s.itemId)}>Notes</button>
                                            )}
                                            {onViewKnowledge && s.itemType !== 'case' && s.itemType !== 'evidence' && s.itemType !== 'timeline_event' && (
                                                <button type="button" className="ti-action-btn" onClick={() => onViewKnowledge(s.itemType, s.itemId, s.itemId)}>Knowledge</button>
                                            )}
                                            {editable && <button type="button" className="ti-action-btn rg-remove-btn" onClick={() => remove(s.itemType, s.itemId)}><Trash2 size={12} />Remove</button>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </WorkflowStep>
        </div>
    );
};

// Pure layout wrapper for the vertical intelligence workflow — a numbered
// circle + connecting line (drawn once, by .rg-workflow's own ::before) next
// to whatever step content is passed in. No state, no logic of its own.
const WorkflowStep: React.FC<{ num: number; children: React.ReactNode }> = ({ num, children }) => (
    <div className="rg-workflow-step">
        <div className="rg-workflow-step-num">{num}</div>
        <div className="rg-workflow-step-content">{children}</div>
    </div>
);

// Icons are cosmetic only — every key here is a real ReportGeneratorItemType
// already used throughout this file (ITEM_TYPE_OPTIONS); nothing invented.
const ENTITY_TYPE_ICON: Record<string, React.ComponentType<{ size?: number | string }>> = {
    ioc: Target, threat_actor: Users, malware: Bug, campaign: Flag, vulnerability: ShieldAlert,
    brand: ShieldCheck, company: FolderOpen, case: FolderOpen, dark_web_observation: Search,
    credential_exposure: Lock, social_investigation: Users, evidence: FileSearch2, attack_technique: Network,
};

// REPORT_GENERATOR_PHASE2.md §4-§9 SEARCHABLE ENTITY PICKER — server-side,
// debounced (300ms), bounded (20 results/page), RBAC-aware (results only
// ever come from each module's own already-RBAC-scoped list endpoint).
// Duplicate-selection prevention: an already-selected result is shown
// disabled rather than omitted, so the analyst can see why it's inert.
const EntityPicker: React.FC<{ onPick: (itemType: ReportGeneratorItemType, itemId: string) => void; alreadySelected: Set<string> }> = ({ onPick, alreadySelected }) => {
    const [itemType, setItemType] = useState<ReportGeneratorSearchableType>('ioc');
    const [q, setQ] = useState('');
    const [results, setResults] = useState<ReportGeneratorSearchResultItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!q.trim()) { setResults([]); setOpen(false); return; }
        setLoading(true);
        const handle = setTimeout(() => {
            searchReportGeneratorEntities({ itemType, q: q.trim(), pageSize: 20 })
                .then((res) => { setResults(res.items); setOpen(true); })
                .catch(() => setResults([]))
                .finally(() => setLoading(false));
        }, 300); // debounce
        return () => clearTimeout(handle);
    }, [itemType, q]);

    // Two `.rg-field` siblings (not one wrapping div) so they land as
    // direct children of ScopeTab's `.rg-add-intel-grid` — same debounced
    // search effect and results dropdown above, just laid out as its own
    // grid columns instead of a single flex row.
    return (
        <>
            <div className="rg-field">
                <label className="rg-field-label">Intelligence Type</label>
                <select className="rg-filter-select" value={itemType} onChange={(e) => { setItemType(e.target.value as ReportGeneratorSearchableType); setQ(''); setResults([]); }}>
                    {SEARCHABLE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
            </div>
            <div className="rg-field rg-field-wide" style={{ position: 'relative' }}>
                <label className="rg-field-label">&nbsp;</label>
                <div className="rg-search-input-wrap">
                    <Search size={15} />
                    <input
                        type="text" placeholder={`Search ${SEARCHABLE_TYPE_OPTIONS.find((o) => o.value === itemType)?.label}...`}
                        value={q} onChange={(e) => setQ(e.target.value)} onFocus={() => q.trim() && setOpen(true)}
                    />
                    {loading && <span className="rg-search-loading">Searching…</span>}
                </div>
                {open && (
                    <div className="ti-card rg-search-results">
                        {results.length === 0 ? <div className="ti-empty">{loading ? 'Searching…' : 'No matches.'}</div> : (
                            <ul className="ti-list">
                                {results.map((r) => {
                                    const already = alreadySelected.has(`${r.itemType}:${r.id}`);
                                    return (
                                        <li key={`${r.itemType}:${r.id}`} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            <span style={{ flex: 1 }}>{r.label}</span>
                                            <button type="button" className="ti-action-btn" disabled={already} onClick={() => { onPick(r.itemType, r.id); setQ(''); setOpen(false); }}>
                                                {already ? 'Already Added' : 'Add'}
                                            </button>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                        <button type="button" className="ti-action-btn" style={{ marginTop: '6px' }} onClick={() => setOpen(false)}>Close</button>
                    </div>
                )}
            </div>
        </>
    );
};

// §11-§14 RELATED INTELLIGENCE DISCOVERY — every candidate is a
// SUGGESTION only; nothing here is ever auto-included. Category-level
// "Select All" asks for confirmation before inserting a large set (§17).
const DiscoveryPanel: React.FC<{ reportId: number; alreadySelected: Set<string>; onAdded: () => void }> = ({ reportId, alreadySelected, onAdded }) => {
    const [candidates, setCandidates] = useState<ReportGeneratorDiscoveryCandidate[] | null>(null);
    const [relatedKnowledge, setRelatedKnowledge] = useState<{ id: string; label: string }[]>([]);
    const [relatedThreatBriefs, setRelatedThreatBriefs] = useState<{ id: string; label: string }[]>([]);
    const [loading, setLoading] = useState(false);
    const [checked, setChecked] = useState<Record<string, boolean>>({});
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    // Presentation-only: reorders/filters the SAME already-fetched
    // `candidates` array client-side — no new API call, no invented data,
    // `relevance` is simply "how many real reasons support this candidate".
    const [sortBy, setSortBy] = useState<'relevance' | 'type' | 'label'>('relevance');
    const [hideTemporal, setHideTemporal] = useState(false);

    const run = () => {
        setLoading(true); setMsg(null);
        getReportGeneratorDiscovery(reportId)
            .then((res) => {
                setCandidates(res.candidates.filter((c) => !alreadySelected.has(`${c.itemType}:${c.id}`)));
                setRelatedKnowledge(res.relatedKnowledge || []); setRelatedThreatBriefs(res.relatedThreatBriefs || []);
                setChecked({});
            })
            .catch((e) => setMsg(e?.message || 'Failed to discover related intelligence.'))
            .finally(() => setLoading(false));
    };

    const toggle = (key: string) => setChecked((c) => ({ ...c, [key]: !c[key] }));
    const selectAllForType = (type: ReportGeneratorItemType) => {
        const ofType = (candidates || []).filter((c) => c.itemType === type);
        if (!ofType.length) return;
        if (!window.confirm(`Add all ${ofType.length} discovered ${type.replace(/_/g, ' ')} item(s) to this report?`)) return;
        setChecked((c) => { const next = { ...c }; for (const item of ofType) next[`${item.itemType}:${item.id}`] = true; return next; });
    };

    const addChecked = async () => {
        const items = (candidates || []).filter((c) => checked[`${c.itemType}:${c.id}`]).map((c) => ({ itemType: c.itemType, itemId: c.id, role: 'related' as const }));
        if (!items.length) { setMsg('Select at least one candidate first.'); return; }
        setBusy(true); setMsg(null);
        try {
            const res = await addReportGeneratorSelectionsBulk(reportId, items);
            setMsg(`Added ${res.added.length} of ${items.length}.${res.rejected.length ? ` ${res.rejected.length} rejected (no longer accessible).` : ''}`);
            onAdded();
            run();
        } catch (e: any) { setMsg(e?.message || 'Failed to add selected candidates.'); } finally { setBusy(false); }
    };

    const visible = (candidates || []).filter((c) => !hideTemporal || c.reasons.some((r) => !r.temporalOnly));
    const sorted = [...visible].sort((a, b) => {
        if (sortBy === 'type') return a.itemType.localeCompare(b.itemType);
        if (sortBy === 'label') return a.label.localeCompare(b.label);
        return b.reasons.length - a.reasons.length; // relevance — more corroborating reasons first
    });
    const byType = new Map<string, ReportGeneratorDiscoveryCandidate[]>();
    for (const c of sorted) { if (!byType.has(c.itemType)) byType.set(c.itemType, []); byType.get(c.itemType)!.push(c); }

    return (
        <>
            <WorkflowStep num={2}>
                <div className="ti-card rg-step-card">
                    <div className="rg-step-card-head">
                        <div>
                            <div className="rg-step-card-title">Discover Related Intelligence</div>
                            <p className="rg-step-card-desc">Explore intelligence connected through existing relationships inside LekirraX.</p>
                        </div>
                        <button type="button" className="rg-btn-primary" onClick={run} disabled={loading}>
                            <Network size={14} />{loading ? 'Discovering…' : candidates === null ? 'Discover Related Intelligence' : 'Re-run Discovery'}
                        </button>
                    </div>
                    <div className="ti-note" style={{ fontStyle: 'italic', marginBottom: '10px' }}>Candidates are discovered from real, existing relationships. Nothing is added automatically — review the reason for each and select what belongs in this report.</div>
                    <div className="rg-process-hint">
                        <span><Search size={13} />Discover</span><ArrowRight size={13} />
                        <span><FileText size={13} />Review</span><ArrowRight size={13} />
                        <span><CheckCircle2 size={13} />Select</span>
                    </div>
                </div>
            </WorkflowStep>

            <WorkflowStep num={3}>
                <div className="ti-card rg-step-card">
                    <div className="rg-step-card-head">
                        <div>
                            <div className="rg-step-card-title">Intelligence Candidate Panel</div>
                            <p className="rg-step-card-desc">Review intelligence candidates discovered from existing relationships.</p>
                        </div>
                        {candidates !== null && candidates.length > 0 && (
                            <div className="rg-candidate-controls">
                                <select className="rg-filter-select" value={sortBy} onChange={(e) => setSortBy(e.target.value as 'relevance' | 'type' | 'label')}>
                                    <option value="relevance">Sort by: Relevance</option>
                                    <option value="type">Sort by: Type</option>
                                    <option value="label">Sort by: Name</option>
                                </select>
                                <button type="button" className={`rg-filter-more-btn${hideTemporal ? ' active' : ''}`} onClick={() => setHideTemporal((v) => !v)} title="Hide temporal-proximity-only matches">
                                    <Filter size={14} />
                                </button>
                            </div>
                        )}
                    </div>

                    {candidates === null ? (
                        <div className="rg-empty">
                            <div className="rg-empty-icon"><Network size={26} /></div>
                            <div className="rg-empty-title">No intelligence candidates discovered yet</div>
                            <div className="rg-empty-desc">Add intelligence above or discover related records to identify relevant intelligence connections.</div>
                            <div className="rg-candidate-chip-row">
                                <span className="rg-candidate-chip"><Target size={12} />Related IOCs</span>
                                <span className="rg-candidate-chip"><Users size={12} />Threat Actors</span>
                                <span className="rg-candidate-chip"><Flag size={12} />Campaigns</span>
                                <span className="rg-candidate-chip"><Bug size={12} />Malware</span>
                                <span className="rg-candidate-chip"><ShieldAlert size={12} />Vulnerabilities</span>
                                <span className="rg-candidate-chip"><FileSearch2 size={12} />Evidence</span>
                            </div>
                        </div>
                    ) : candidates.length === 0 ? (
                        <div className="ti-empty">No new related intelligence discovered from this report's current scope.</div>
                    ) : (
                        <>
                            <div className="rg-candidate-actions">
                                <button type="button" className="ti-action-btn" onClick={addChecked} disabled={busy}>{busy ? 'Adding…' : 'Add Selected'}</button>
                            </div>
                            {sorted.length === 0 ? <div className="ti-empty">No candidates match the current filter.</div> : (
                                [...byType.entries()].map(([type, items]) => (
                                    <div key={type} className="rg-candidate-group">
                                        <div className="rg-candidate-group-head">
                                            <strong>{ITEM_TYPE_OPTIONS.find((o) => o.value === type)?.label || type} ({items.length})</strong>
                                            <button type="button" className="ti-action-btn" onClick={() => selectAllForType(type as ReportGeneratorItemType)}>Select All</button>
                                        </div>
                                        <ul className="rg-candidate-list">
                                            {items.map((c) => {
                                                const key = `${c.itemType}:${c.id}`;
                                                const Icon = ENTITY_TYPE_ICON[c.itemType] || Tag;
                                                return (
                                                    <li key={key} className="rg-candidate-item">
                                                        <input type="checkbox" checked={!!checked[key]} onChange={() => toggle(key)} />
                                                        <span className="rg-candidate-item-icon"><Icon size={13} /></span>
                                                        <div className="rg-candidate-item-body">
                                                            <div className="rg-candidate-item-label">{c.label}</div>
                                                            <div className="rg-candidate-item-reasons">
                                                                {c.reasons.map((r, i) => (
                                                                    <span key={i} className={`rg-reason-tag${r.temporalOnly ? ' weak' : ''}`} title={r.temporalOnly ? 'Temporal proximity only — not a confirmed relationship' : undefined}>
                                                                        {r.reason}{r.confidence ? ` · ${r.confidence}` : ''}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    </li>
                                                );
                                            })}
                                        </ul>
                                    </div>
                                ))
                            )}
                            {(relatedKnowledge.length > 0 || relatedThreatBriefs.length > 0) && (
                                <div style={{ marginTop: '10px' }}>
                                    {relatedKnowledge.length > 0 && (
                                        <div style={{ marginBottom: '8px' }}>
                                            <strong>Related Knowledge Base Entries ({relatedKnowledge.length})</strong>
                                            <ul className="ti-list">{relatedKnowledge.map((k) => <li key={k.id}>{k.label}</li>)}</ul>
                                        </div>
                                    )}
                                    {relatedThreatBriefs.length > 0 && (
                                        <div>
                                            <strong>Related Threat Briefs ({relatedThreatBriefs.length})</strong>
                                            <div className="ti-note" style={{ fontStyle: 'italic' }}>Shown for reference only — never merged into this report's own records.</div>
                                            <ul className="ti-list">{relatedThreatBriefs.map((t) => <li key={t.id}>{t.label}</li>)}</ul>
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                    {msg && <div className="ti-note" style={{ marginTop: '8px' }}>{msg}</div>}
                </div>
            </WorkflowStep>
        </>
    );
};

// §44-§49 REFRESH INTELLIGENCE — shows a Refresh Diff the analyst must
// explicitly Apply or Keep Current; NEVER touches narrative fields.
const RefreshIntelligencePanel: React.FC<{ reportId: number; onClose: () => void; onApplied: () => void }> = ({ reportId, onClose, onApplied }) => {
    const [diff, setDiff] = useState<ReportGeneratorRefreshDiff | null>(null);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);

    useEffect(() => { getReportGeneratorRefreshDiff(reportId).then(setDiff).catch((e) => setMsg(e?.message || 'Failed to build refresh diff.')); }, [reportId]);

    const apply = async () => {
        setBusy(true);
        try { await applyReportGeneratorRefresh(reportId); onApplied(); } catch (e: any) { setMsg(e?.message || 'Failed to apply refresh.'); } finally { setBusy(false); }
    };
    const keepCurrent = async () => {
        setBusy(true);
        try { await dismissReportGeneratorRefresh(reportId); onClose(); } catch (e: any) { setMsg(e?.message || 'Failed to dismiss.'); } finally { setBusy(false); }
    };

    const addedEntries = diff ? Object.entries(diff.added).filter(([, ids]) => ids.length) : [];
    const removedEntries = diff ? Object.entries(diff.removed).filter(([, ids]) => ids.length) : [];

    return (
        <div className="ti-card" style={{ marginTop: '10px' }}>
            <div className="ti-card-title">Refresh Diff</div>
            <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>{diff?.note || 'Refresh Diff never touches your written narrative.'}</div>
            {!diff ? <div className="ti-empty">Loading…</div> : !diff.hasChanges ? (
                <div className="ti-empty">No changes since {diff.neverComposedBefore ? 'this report was created' : 'the last refresh'} — the underlying intelligence is unchanged.</div>
            ) : (
                <>
                    {addedEntries.length > 0 && (
                        <div style={{ marginBottom: '8px' }}><strong>New Intelligence</strong>
                            <ul className="ti-list">{addedEntries.map(([k, ids]) => <li key={k}>{k}: {ids.length} new ({ids.slice(0, 5).join(', ')}{ids.length > 5 ? '…' : ''})</li>)}</ul>
                        </div>
                    )}
                    {removedEntries.length > 0 && (
                        <div style={{ marginBottom: '8px' }}><strong>Removed Intelligence</strong>
                            <ul className="ti-list">{removedEntries.map(([k, ids]) => <li key={k}>{k}: {ids.length} removed ({ids.slice(0, 5).join(', ')}{ids.length > 5 ? '…' : ''})</li>)}</ul>
                        </div>
                    )}
                    {diff.changedRisk.length > 0 && (
                        <div style={{ marginBottom: '8px' }}><strong>Changed Risk</strong>
                            <ul className="ti-list">{diff.changedRisk.map((r, i) => <li key={i}>{r.entity}: {r.from || 'Not Available'} → {r.to || 'Not Available'}</li>)}</ul>
                        </div>
                    )}
                    {diff.caseStatusChanged && <div className="ti-note">Case status changed: {diff.caseStatusChanged.from || 'Not Available'} → {diff.caseStatusChanged.to || 'Not Available'}</div>}
                </>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={apply} disabled={busy || !diff?.hasChanges}>Apply</button>
                <button type="button" className="ti-action-btn" onClick={keepCurrent} disabled={busy}>Keep Current</button>
                <button type="button" className="ti-action-btn" onClick={onClose} disabled={busy}>Close</button>
            </div>
            {msg && <div className="ti-error" style={{ marginTop: '8px' }}>{msg}</div>}
        </div>
    );
};

// §"REVIEW CHECKLIST" — workflow-only; explicitly NOT a second publish lifecycle.
const ReviewChecklistTab: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [data, setData] = useState<ReviewChecklistData | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => { getReportGeneratorReviewChecklist(reportId).then(setData).catch(() => {}); }, [reportId]);
    useEffect(() => { load(); }, [load]);

    const toggleItem = async (key: string, checked: boolean) => {
        if (!data) return;
        setBusy(true);
        try { await updateReportGeneratorReviewChecklist(reportId, { items: { [key]: checked } }); load(); } finally { setBusy(false); }
    };
    const setStatus = async (reviewStatus: ReviewChecklistData['reviewStatus']) => {
        setBusy(true);
        try { await updateReportGeneratorReviewChecklist(reportId, { reviewStatus }); load(); } finally { setBusy(false); }
    };

    if (!data) return <div className="ti-empty">Loading review checklist…</div>;
    return (
        <div className="ti-card">
            <div className="ti-card-title">Review Checklist</div>
            <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>Workflow tracking only — this is not a second publish lifecycle; report status stays Draft/Ready/Published/Archived regardless of review status.</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                <span>Review Status:</span>
                <select value={data.reviewStatus} onChange={(e) => setStatus(e.target.value as ReviewChecklistData['reviewStatus'])} disabled={busy}>
                    <option value="not_reviewed">Not Reviewed</option><option value="in_review">In Review</option><option value="reviewed">Reviewed</option>
                </select>
                {data.reviewedAt && <span className="ti-note">Last marked Reviewed: {formatDateTime(data.reviewedAt)}</span>}
            </div>
            <ul className="ti-list">
                {data.items.map((i) => (
                    <li key={i.key} style={{ padding: '4px 0' }}>
                        <label><input type="checkbox" checked={i.checked} disabled={busy} onChange={(e) => toggleItem(i.key, e.target.checked)} /> {i.label}</label>
                    </li>
                ))}
            </ul>
        </div>
    );
};

// §72 REPORT CHANGE HISTORY — reuses the existing audit trail verbatim.
const HistoryTab: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [items, setItems] = useState<ReportGeneratorHistoryEntry[] | null>(null);
    useEffect(() => { getReportGeneratorHistory(reportId).then(setItems).catch(() => setItems([])); }, [reportId]);
    if (!items) return <div className="ti-empty">Loading history…</div>;
    return (
        <div className="ti-card">
            <div className="ti-card-title">Change History</div>
            {items.length === 0 ? <div className="ti-empty">No history yet.</div> : (
                <ul className="ti-list">
                    {items.map((h) => (
                        <li key={h.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="ti-badge">{h.action.replace(/_/g, ' ')}</span>{' '}
                            {h.newValue && <span>{h.newValue}</span>}{' '}
                            <span className="ti-note">by {h.username || 'Unknown'} — {h.createdAt ? formatDateTime(h.createdAt) : 'Unknown time'}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// REPORT_GENERATOR_PHASE3.md §93/§94 AI ASSIST — one panel per generation
// action; every result is a DRAFT the analyst must explicitly [Insert] or
// [Discard] (§48) — nothing here ever silently changes the report.
const AI_SECTION_OPTIONS: { value: ReportGeneratorAiSectionType; label: string }[] = [
    { value: 'executive_summary', label: 'Generate Executive Summary' }, { value: 'key_findings', label: 'Generate Key Findings' },
    { value: 'timeline_summary', label: 'Summarize Timeline' }, { value: 'risk_explanation', label: 'Explain Risk' },
    { value: 'change_summary', label: 'Explain Changes' }, { value: 'intelligence_gaps', label: 'Identify Gaps' },
    { value: 'recommendations', label: 'Generate Recommendations' }, { value: 'conclusion', label: 'Draft Conclusion' },
    { value: 'quality_review', label: 'Review Report' },
];

const AiAssistTab: React.FC<{ reportId: number; editable: boolean; onNarrativeChanged: () => void }> = ({ reportId, editable, onNarrativeChanged }) => {
    const [drafts, setDrafts] = useState<Record<string, ReportGeneratorAiDraft>>({});
    const [busySection, setBusySection] = useState<string | null>(null);
    const [view, setView] = useState<ReportGeneratorAiView | ''>('');
    const [msg, setMsg] = useState<string | null>(null);
    const [factCheck, setFactCheck] = useState<{ findings: ReportGeneratorFactCheckFinding[]; provider: string; note?: string } | null>(null);
    const [candidates, setCandidates] = useState<ReportGeneratorActionCandidate[] | null>(null);
    const [actions, setActions] = useState<ReportGeneratorAiAction[]>([]);

    const loadDrafts = useCallback(() => { getReportGeneratorAiDrafts(reportId).then(setDrafts).catch(() => {}); }, [reportId]);
    const loadActions = useCallback(() => { listReportGeneratorActions(reportId).then(setActions).catch(() => {}); }, [reportId]);
    useEffect(() => { loadDrafts(); loadActions(); }, [loadDrafts, loadActions]);

    const generate = async (sectionType: ReportGeneratorAiSectionType) => {
        setBusySection(sectionType); setMsg(null);
        try {
            await generateReportGeneratorAiDraft(reportId, sectionType, view || undefined);
            loadDrafts();
        } catch (e: any) {
            setMsg(e?.message?.includes('already in progress') ? 'A generation request for this section is already running.' : (e?.message || 'Generation failed.'));
        } finally { setBusySection(null); }
    };
    const insert = async (sectionType: ReportGeneratorAiSectionType, overwrite = false) => {
        try { await insertReportGeneratorAiDraft(reportId, sectionType, overwrite); loadDrafts(); onNarrativeChanged(); setMsg(null); }
        catch (e: any) {
            if (e?.message?.includes('already contains analyst content')) {
                if (window.confirm('This section already has analyst-written content. Overwrite it with the AI draft?')) await insert(sectionType, true);
            } else setMsg(e?.message || 'Failed to insert draft.');
        }
    };
    const discard = async (sectionType: ReportGeneratorAiSectionType) => { await discardReportGeneratorAiDraft(reportId, sectionType).catch(() => {}); loadDrafts(); };

    const runFactCheck = async () => {
        setBusySection('__fact_check'); setMsg(null);
        try { setFactCheck(await runReportGeneratorFactCheck(reportId)); } catch (e: any) { setMsg(e?.message || 'Fact check failed.'); } finally { setBusySection(null); }
    };
    const loadCandidates = async () => { try { setCandidates(await getReportGeneratorActionCandidates(reportId)); } catch { setCandidates([]); } };
    const propose = async (c: ReportGeneratorActionCandidate) => {
        try { await proposeReportGeneratorAction(reportId, c); loadActions(); } catch (e: any) { setMsg(e?.message || 'Failed to propose action.'); }
    };
    const approve = async (actionId: number) => { try { await approveReportGeneratorAction(reportId, actionId); loadActions(); } catch (e: any) { setMsg(e?.message || 'Failed to approve action.'); } };
    const reject = async (actionId: number) => { try { await rejectReportGeneratorAction(reportId, actionId); loadActions(); } catch (e: any) { setMsg(e?.message || 'Failed to reject action.'); } };

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">AI Report Assistant <span className="ti-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>● Ready</span></div>
                <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>An assistant, not the source of truth. Every result below is a DRAFT grounded only in this report's own selected intelligence — review it, then explicitly Insert or Discard. If no AI provider is configured, results are built deterministically instead and clearly labeled as such.</div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                    <span>View:</span>
                    <select value={view} onChange={(e) => setView(e.target.value as ReportGeneratorAiView | '')}>
                        <option value="">Default</option><option value="executive">Executive View</option><option value="technical">Technical View</option><option value="analyst">Analyst View</option>
                    </select>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {AI_SECTION_OPTIONS.map((o) => (
                        <button key={o.value} type="button" className="ti-action-btn" disabled={!editable || busySection === o.value} onClick={() => generate(o.value)}>
                            {busySection === o.value ? 'Generating…' : o.label}
                        </button>
                    ))}
                    <button type="button" className="ti-action-btn" disabled={!editable || busySection === '__fact_check'} onClick={runFactCheck}>{busySection === '__fact_check' ? 'Checking…' : 'Fact Check'}</button>
                    <button type="button" className="ti-action-btn" onClick={loadCandidates}>Show Recommended Actions</button>
                </div>
                {msg && <div className="ti-error" style={{ marginTop: '8px' }}>{msg}</div>}
            </div>

            {AI_SECTION_OPTIONS.map((o) => {
                const draft = drafts[o.value];
                if (!draft) return null;
                const insertable = o.value === 'executive_summary' || o.value === 'key_findings' || o.value === 'recommendations' || o.value === 'conclusion';
                return (
                    <div key={o.value} className="ti-card" style={{ marginBottom: '10px' }}>
                        <div className="ti-card-title">
                            {o.label.replace(/^Generate |^Draft |^Summarize |^Explain |^Identify /, '')} — AI Draft
                            <span className="ti-badge" style={{ marginLeft: '8px' }}>{draft.provider === 'openai' ? 'AI Generated' : 'Deterministic Fallback'}</span>
                            {draft.status === 'inserted' && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Inserted{draft.analystEdited ? ' + Analyst Edited' : ''}</span>}
                            {draft.stale && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>AI Draft May Be Stale</span>}
                        </div>
                        <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr', marginBottom: '8px' }}>
                            <span className="k">Generated</span><span className="v">{formatDateTime(draft.generatedAt)}</span>
                            <span className="k">Data As Of</span><span className="v">{draft.dataAsOf ? formatDateTime(draft.dataAsOf) : 'Not Available'}</span>
                            <span className="k">Sources</span><span className="v">{draft.citations.length}</span>
                        </div>
                        <p style={{ whiteSpace: 'pre-wrap' }}>{draft.text}</p>
                        {draft.citations.length > 0 && <div style={{ marginBottom: '6px' }}>{draft.citations.map((c) => <span key={c} className="ti-badge" style={{ marginRight: '4px' }}>[{c}]</span>)}</div>}
                        {draft.gaps && draft.gaps.length > 0 && <ul className="ti-list">{draft.gaps.map((g) => <li key={g}>{g}</li>)}</ul>}
                        {draft.recommendations && draft.recommendations.length > 0 && (
                            <ul className="ti-list">{draft.recommendations.map((r, i) => <li key={i}><span className="ti-badge">{r.group}</span> {r.action} — {r.reason}</li>)}</ul>
                        )}
                        {draft.issues && draft.issues.length > 0 && (
                            <ul className="ti-list">{draft.issues.map((iss, i) => <li key={i}><span className="ti-badge">{iss.category}</span> {iss.detail}</li>)}</ul>
                        )}
                        {draft.note && <div className="ti-note" style={{ fontStyle: 'italic' }}>{draft.note}</div>}
                        {editable && (
                            <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                {insertable && <button type="button" className="ti-action-btn" onClick={() => insert(o.value)}>Insert</button>}
                                <button type="button" className="ti-action-btn" onClick={() => generate(o.value)} disabled={busySection === o.value}>Regenerate</button>
                                <button type="button" className="ti-action-btn" onClick={() => discard(o.value)}>Discard</button>
                            </div>
                        )}
                    </div>
                );
            })}

            {factCheck && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Fact Check</div>
                    {factCheck.findings.length === 0 ? <div className="ti-empty">No unsupported statements identified.</div> : (
                        <ul className="ti-list">{factCheck.findings.map((f, i) => <li key={i}><span className="ti-badge">{f.category}</span> {f.field}: "{f.excerpt}" — {f.detail}</li>)}</ul>
                    )}
                    {factCheck.note && <div className="ti-note" style={{ fontStyle: 'italic' }}>{factCheck.note}</div>}
                </div>
            )}

            {candidates !== null && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Recommended Actions</div>
                    <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>Recommendations are not actions — nothing happens until you Approve.</div>
                    {candidates.length === 0 ? <div className="ti-empty">No recommended actions right now.</div> : (
                        <ul className="ti-list">
                            {candidates.map((c, i) => (
                                <li key={i} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ flex: 1 }}>{c.action.replace(/_/g, ' ')} — {c.targetLabel}: {c.reason}</span>
                                    {editable && <button type="button" className="ti-action-btn" onClick={() => propose(c)}>Review</button>}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {actions.length > 0 && (
                <div className="ti-card">
                    <div className="ti-card-title">Action History</div>
                    <ul className="ti-list">
                        {actions.map((a) => (
                            <li key={a.id} style={{ padding: '4px 0', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span className="ti-badge">{a.status}</span>
                                <span>{a.action.replace(/_/g, ' ')} — {a.targetLabel}</span>
                                {a.status === 'proposed' && editable && (
                                    <>
                                        <button type="button" className="ti-action-btn" onClick={() => approve(a.id)}>Approve</button>
                                        <button type="button" className="ti-action-btn" onClick={() => reject(a.id)}>Reject</button>
                                    </>
                                )}
                                {a.status === 'unavailable' && <span className="ti-note">Unavailable</span>}
                                {a.error && <span className="ti-error">{a.error}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
};

// §19/§41/§42 REPORT NARRATIVE — analyst-editable; never touches authoritative source data.
const NarrativeTab: React.FC<{ report: ReportGeneratorReportDetail; editable: boolean; onChanged: () => void }> = ({ report, editable, onChanged }) => {
    const [values, setValues] = useState(report.narrative);
    const [busy, setBusy] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    useEffect(() => { setValues(report.narrative); }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const save = async () => {
        setBusy(true); setMsg(null);
        try {
            await updateReportGeneratorReport(report.id, {
                introduction: values.introduction, executiveSummary: values.executiveSummary,
                keyFindingsNarrative: values.keyFindingsNarrative, recommendations: values.recommendations, conclusion: values.conclusion,
            });
            setMsg('Saved.'); onChanged();
        } catch (e: any) { setMsg(e?.message || 'Failed to save.'); } finally { setBusy(false); }
    };
    const field = (label: string, key: keyof typeof values) => (
        <div className="ti-card" style={{ marginBottom: '12px' }}>
            <div className="ti-card-title">{label}</div>
            <textarea
                value={values[key]} onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                disabled={!editable} style={{ width: '100%', minHeight: '90px' }} placeholder={`Write the ${label}…`}
            />
        </div>
    );
    return (
        <>
            {field('Introduction', 'introduction')}
            {field('Executive Summary', 'executiveSummary')}
            {field('Key Findings', 'keyFindingsNarrative')}
            {field('Recommendations', 'recommendations')}
            {field('Conclusion', 'conclusion')}
            {editable && <button type="button" className="ti-action-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Narrative'}</button>}
            {msg && <div className="ti-note" style={{ marginTop: '8px' }}>{msg}</div>}
        </>
    );
};

// §17/§18 SECTION SELECTION / ORDER — Move Up/Down (reliable across every
// browser, never a fragile drag-and-drop-only implementation).
const SectionsTab: React.FC<{ report: ReportGeneratorReportDetail; templates: ReportGeneratorTemplatesResponse | null; editable: boolean; onChanged: () => void }> = ({ report, templates, editable, onChanged }) => {
    const [sections, setSections] = useState(report.sections);
    const [busy, setBusy] = useState(false);
    useEffect(() => { setSections(report.sections); }, [report.id]); // eslint-disable-line react-hooks/exhaustive-deps

    const move = (i: number, dir: -1 | 1) => {
        const next = [...sections];
        const j = i + dir;
        if (j < 0 || j >= next.length) return;
        [next[i], next[j]] = [next[j], next[i]];
        setSections(next);
    };
    const toggle = (i: number) => setSections((s) => s.map((x, idx) => (idx === i ? { ...x, enabled: !x.enabled } : x)));
    const save = async () => {
        setBusy(true);
        try { await updateReportGeneratorReport(report.id, { sections }); onChanged(); } finally { setBusy(false); }
    };

    return (
        <div className="ti-card">
            <div className="ti-card-title">Sections (in report order)</div>
            <ul className="ti-list">
                {sections.map((s, i) => (
                    <li key={s.key} style={{ padding: '6px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input type="checkbox" checked={s.enabled} onChange={() => editable && toggle(i)} disabled={!editable} />
                        <span style={{ flex: 1 }}>{templates?.sectionLabels[s.key] || s.key}</span>
                        {editable && <>
                            <button type="button" className="ti-action-btn" onClick={() => move(i, -1)} disabled={i === 0}>▲</button>
                            <button type="button" className="ti-action-btn" onClick={() => move(i, 1)} disabled={i === sections.length - 1}>▼</button>
                        </>}
                    </li>
                ))}
            </ul>
            {editable && <button type="button" className="ti-action-btn" onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save Section Order'}</button>}
        </div>
    );
};

// §43/§44/§45/§46/§47/§61-66 QUALITY CHECK / PREVIEW / EXPORT.
const PreviewTab: React.FC<{ reportId: number }> = ({ reportId }) => {
    const [preview, setPreview] = useState<ReportGeneratorPreview | null>(null);
    const [forceAll, setForceAll] = useState(false);
    const [busy, setBusy] = useState(false);
    const [exportMsg, setExportMsg] = useState<string | null>(null);

    const load = useCallback(() => { getReportGeneratorPreview(reportId, forceAll).then(setPreview).catch(() => {}); }, [reportId, forceAll]);
    useEffect(() => { load(); }, [load]);

    const exportAs = async (format: 'json' | 'html' | 'csv' | 'pdf') => {
        if (format === 'html' || format === 'csv') {
            const a = document.createElement('a');
            a.href = reportGeneratorExportUrl(reportId, format);
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.click();
            return;
        }
        setBusy(true); setExportMsg(null);
        try {
            const res = await exportReportGeneratorReport(reportId, format);
            if (res.notConfigured) setExportMsg(res.message || 'PDF Export: Not Configured');
            else setExportMsg('JSON export generated — see browser download/network tab, or use the HTML/CSV buttons for a direct file.');
        } catch (e: any) { setExportMsg(e?.message || 'Export failed.'); } finally { setBusy(false); }
    };

    if (!preview) return <div className="ti-empty">Loading preview…</div>;

    return (
        <>
            {preview.warnings.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Quality Check</div>
                    <ul className="ti-list">{preview.warnings.map((w) => <li key={w} className="ti-note" style={{ color: '#eab308' }}>⚠ {w}</li>)}</ul>
                    <div className="ti-note" style={{ fontStyle: 'italic', marginTop: '6px' }}>Warnings only — export is never blocked.</div>
                </div>
            )}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Intelligence Correlation</div>
                <div className="ti-kv">
                    <span className="k">Entities in Scope</span><span className="v">{preview.correlationSummary.totalEntities} ({preview.correlationSummary.primaryEntities} Primary / {preview.correlationSummary.relatedEntities} Related)</span>
                    <span className="k">IOCs</span><span className="v">{preview.correlationSummary.iocCount}</span>
                    <span className="k">Threat Actors</span><span className="v">{preview.correlationSummary.threatActorCount}</span>
                    <span className="k">Malware</span><span className="v">{preview.correlationSummary.malwareCount}</span>
                    <span className="k">Campaigns</span><span className="v">{preview.correlationSummary.campaignCount}</span>
                    <span className="k">Vulnerabilities</span><span className="v">{preview.correlationSummary.vulnerabilityCount}</span>
                    <span className="k">ATT&CK Techniques</span><span className="v">{preview.correlationSummary.attackTechniqueCount}</span>
                    <span className="k">Evidence</span><span className="v">{preview.correlationSummary.evidenceCount}</span>
                    <span className="k">Timeline Events</span><span className="v">{preview.correlationSummary.timelineEventCount}</span>
                    <span className="k">MISP Matches</span><span className="v">{preview.correlationSummary.mispMatchCount}</span>
                </div>
            </div>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Completeness</div>
                <div className="ti-note" style={{ marginBottom: '6px', fontStyle: 'italic' }}>{preview.completeness.label}</div>
                <div style={{ fontSize: '1.4em', fontWeight: 700 }}>{preview.completeness.percent}%</div>
                <ul className="ti-list">
                    {preview.completeness.checklist.map((c) => <li key={c.key} style={{ color: c.pass ? '#4ade80' : '#eab308' }}>{c.pass ? '✓' : '○'} {c.label}</li>)}
                </ul>
            </div>
            {preview.conflicts.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">⚠ Conflicts Detected — Not Auto-Resolved</div>
                    <div className="ti-note" style={{ marginBottom: '6px', fontStyle: 'italic' }}>Reused from Threat Summary's own conflict engine, scoped to this report's selected entities. Review each before publishing.</div>
                    <ul className="ti-list">
                        {preview.conflicts.map((c) => (
                            <li key={c.id} style={{ padding: '4px 0' }}>
                                <strong>{c.object}</strong> — "{c.claimA}" vs "{c.claimB}" <span className="ti-badge">{c.status}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">LEKIRRAX — THREAT INTELLIGENCE REPORT</div>
                <div className="ti-kv">
                    <span className="k">Title</span><span className="v">{preview.header.title}</span>
                    <span className="k">Type</span><span className="v">{preview.header.reportType}</span>
                    <span className="k">Classification</span><span className="v"><span className="ti-badge">{preview.header.classification}</span></span>
                    <span className="k">Generated</span><span className="v">{formatDateTime(preview.header.generatedAt)}</span>
                    <span className="k">Data As Of</span><span className="v">{preview.header.dataAsOf ? formatDateTime(preview.header.dataAsOf) : 'Not Available'}</span>
                </div>
                <label style={{ display: 'block', marginTop: '8px' }}><input type="checkbox" checked={forceAll} onChange={(e) => setForceAll(e.target.checked)} /> Show empty sections too (review mode)</label>
            </div>
            {preview.sections.length === 0 ? <div className="ti-empty">No sections have data yet — add entities/evidence under Scope & Intelligence.</div> : preview.sections.map((s) => (
                <div key={s.key} className="ti-card" style={{ marginBottom: '10px' }}>
                    <div className="ti-card-title">{s.label}</div>
                    {!s.hasData ? <div className="ti-empty">No Relevant Data</div> : <SectionPreviewBody sectionKey={s.key} context={preview.context} />}
                </div>
            ))}
            <div className="ti-card" style={{ marginTop: '16px' }}>
                <div className="ti-card-title">Generated by LekirraX</div>
                <div className="ti-kv">
                    <span className="k">Sources</span><span className="v">{preview.footer.sources}</span>
                    <span className="k">Evidence</span><span className="v">{preview.footer.evidence}</span>
                    <span className="k">Timeline Events</span><span className="v">{preview.footer.timelineEvents}</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                    <button type="button" className="ti-action-btn" onClick={() => exportAs('json')} disabled={busy}>Export JSON</button>
                    <button type="button" className="ti-action-btn" onClick={() => exportAs('html')} disabled={busy}>Export HTML</button>
                    <button type="button" className="ti-action-btn" onClick={() => exportAs('csv')} disabled={busy}>Export CSV</button>
                    <button type="button" className="ti-action-btn" onClick={() => exportAs('pdf')} disabled={busy}>Export PDF</button>
                </div>
                {exportMsg && <div className="ti-note" style={{ marginTop: '8px' }}>{exportMsg}</div>}
            </div>
        </>
    );
};

// Safe JSX interpolation only — §70 never dangerouslySetInnerHTML. URLs
// (§71) are shown as plain text, never auto-navigated/fetched.
const SectionPreviewBody: React.FC<{ sectionKey: string; context: any }> = ({ sectionKey, context }) => {
    const s = context.sections;
    const na = (v: any) => (v === null || v === undefined || v === '' ? 'Not Available' : v);
    switch (sectionKey) {
        case 'executive_summary': return <p>{na(context.report.narrative.executiveSummary)}</p>;
        case 'scope': return <ul className="ti-list">{context.scope.map((e: any) => <li key={`${e.type}:${e.id}`}>{e.label} <span className="ti-badge">{e.type}</span> <span className="ti-note">({e.role})</span></li>)}</ul>;
        case 'key_findings': return <p>{na(context.report.narrative.keyFindingsNarrative)}</p>;
        case 'threat_actors': return <ul className="ti-list">{s.threatActors.map((t: any, i: number) => <li key={i}>{t.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{t.name} — Risk: {na(t.risk)} · Related Campaigns: {t.relatedCampaignCount} · Related Malware: {t.relatedMalwareCount}</>}</li>)}</ul>;
        case 'campaigns': return <ul className="ti-list">{s.campaigns.map((c: any, i: number) => <li key={i}>{c.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{c.name} — {na(c.status)}, Severity: {na(c.severity)}</>}</li>)}</ul>;
        case 'malware': return <ul className="ti-list">{s.malware.map((m: any, i: number) => <li key={i}>{m.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{m.name} ({na(m.family)}) — Risk: {na(m.risk)}</>}</li>)}</ul>;
        case 'iocs': return <ul className="ti-list">{s.iocs.map((x: any, i: number) => <li key={i}>{x.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{x.value} <span className="ti-badge">{x.type}</span> — Risk: {na(x.risk)}, Status: {na(x.status)}, First Seen: {x.firstSeenAt ? formatDateTime(x.firstSeenAt) : 'Not Available'}, Last Seen: {x.lastSeenAt ? formatDateTime(x.lastSeenAt) : 'Not Available'}</>}</li>)}</ul>;
        case 'vulnerabilities': return <ul className="ti-list">{s.vulnerabilities.map((v: any, i: number) => <li key={i}>{v.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{v.cveId} — {na(v.severity)} (CVSS {na(v.cvss)}) — {na(v.description)}</>}</li>)}</ul>;
        case 'attack': return <ul className="ti-list">{s.attack.map((a: any, i: number) => <li key={i}>{a.techniqueId} {a.name} — {(a.tactics || []).join(', ')} <span className="ti-note">({a.contextSource})</span></li>)}</ul>;
        case 'evidence': return <ul className="ti-list">{s.evidence.map((e: any) => <li key={e.id}>{e.description} — Source: {e.source}{e.url ? <> · URL: <span className="ti-note">{e.url}</span></> : ''} · Confidence: {na(e.confidence)}</li>)}</ul>;
        case 'timeline': return <ul className="ti-list">{s.timeline.map((t: any) => <li key={t.id}>{t.timestamp ? formatDateTime(t.timestamp) : 'Unknown'} — {t.event} <span className="ti-note">({na(t.source)})</span></li>)}</ul>;
        case 'risk': return <ul className="ti-list">{s.risk.map((r: any, i: number) => <li key={i}>{r.entityType} #{r.entityId} — {r.level} ({r.score}) <span className="ti-note">{(r.reasons || []).join('; ')}</span></li>)}</ul>;
        case 'case': return s.case ? <p>{s.case.title} — {s.case.status} · Findings: {(s.case.findings || []).length} · Targets: {(s.case.targets || []).length}</p> : <div className="ti-empty">No Relevant Data</div>;
        case 'brand': return <ul className="ti-list">{s.brand.map((b: any, i: number) => <li key={i}>{b.sourceNoLongerAvailable ? 'Source No Longer Available' : b.name}</li>)}</ul>;
        case 'dark_web': return <ul className="ti-list">{s.darkWeb.map((d: any, i: number) => <li key={i}>{d.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{d.formattedId} {d.title} — {d.source}</>}</li>)}</ul>;
        case 'credential_leak': return <ul className="ti-list">{s.credentialLeak.map((c: any, i: number) => <li key={i}>{c.sourceNoLongerAvailable ? 'Source No Longer Available' : <>{c.formattedId} {c.domain} — {c.exposureType}, Risk: {na(c.risk)}</>}</li>)}</ul>;
        case 'misp': return s.misp.status === 'checked' && s.misp.matches.length ? <ul className="ti-list">{s.misp.matches.map((m: any, i: number) => <li key={i}>{m.value} — MISP Match</li>)}</ul> : <p>{s.misp.status.replace(/_/g, ' ')}</p>;
        case 'recommendations': return <p>{na(context.report.narrative.recommendations)}</p>;
        case 'sources': return <ul className="ti-list">{context.sources.map((src: any, i: number) => <li key={i}>{src.type} #{src.id}</li>)}</ul>;
        default: return <div className="ti-empty">No Relevant Data</div>;
    }
};

export default ReportGeneratorPage;
