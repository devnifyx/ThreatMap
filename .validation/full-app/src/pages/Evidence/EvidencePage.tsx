// EVIDENCE_PHASE1.md — Evidence Repository, Provenance, Search & Analyst
// Workspace. A VIEW over the EXISTING intelligence_evidence system (§1) —
// it owns no evidence, creates no second Evidence engine. Reuses the SAME
// LekirraX design system (ti-* cards/badges/chips from
// ThreatIntelligencePage.css, .case-timeline* from CasesPage.css) every
// other module page already uses — never a new visual language.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    Database, ShieldCheck, Layers, Eye, CheckCircle2, XCircle, GitCompare,
    AlertTriangle, FileQuestion, Zap, BarChart3, LineChart as LineChartIcon,
    Filter as FilterIcon, Clock, FileText, MoreVertical, ChevronRight,
} from 'lucide-react';
import {
    getEvidencePage, getEvidenceDetail, getEvidenceStats, getEvidenceMeta,
    getEvidenceHistory, reviewEvidence, addEvidenceNote, getEvidenceAiAnalysis,
    acceptEvidence, rejectEvidence, requestMoreContextOnEvidence, supersedeEvidence,
    verifyEvidenceIntegrity, setEvidenceImportance, getEvidenceReviewQueue,
    EVIDENCE_REJECT_REASONS, EVIDENCE_IMPORTANCE_LEVELS,
    type EvidenceRecord, type EvidenceDetailPhase2, type EvidenceStats, type EvidenceMeta,
    type EvidenceHistoryEntry, type EvidenceReviewAction, type EvidenceAiAnalysis,
    type EvidenceRejectReason, type EvidenceImportanceLevel, type EvidenceReviewQueueItem,
} from '../../services/api';
import { formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import { timeAgo } from '../../utils/timeAgo';
import { ENTITY_TYPE_VIEW } from '../../utils/entityRoutes';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import '../Investigations/CasesPage.css'; // reuses .case-timeline*/.ti-badge conventions
import '../Timeline/TimelinePage.css'; // reuses .timeline-context-* section styling for the detail drawer
import './EvidencePage.css';
import Pagination from '../../components/shared/Pagination';  // P2-8

const DATE_RANGES = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '24h', label: 'Last 24 Hours' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: 'custom', label: 'Custom Range' },
] as const;
type DateRangeId = typeof DATE_RANGES[number]['id'];

// EVIDENCE_PHASE3.md §57 "use badges, do not overload cards" — one small,
// consistent badge per real lifecycle state, never a fabricated status.
const LIFECYCLE_LABEL: Record<string, string> = {
    unreviewed: 'Unreviewed', reviewed: 'Reviewed', needs_review: 'Needs Review',
    accepted: 'Accepted', rejected: 'Rejected', needs_more_context: 'Needs More Context', superseded: 'Superseded',
};
function lifecycleBadgeClass(status: string): string {
    if (status === 'accepted') return 'ti-badge--low'; // green — this scheme's "good" tone
    if (status === 'rejected') return 'ti-badge--critical'; // red
    // Amber = "needs analyst attention", matching the Unreviewed KPI/Quick
    // Filter tone above rather than the shared, generic ti-badge--info gray.
    if (status === 'unreviewed' || status === 'needs_review') return 'ev-badge--amber';
    if (status === 'superseded' || status === 'needs_more_context') return 'ti-badge--medium'; // blue — neutral attention
    return 'ti-badge--info'; // reviewed — neutral, seen but no verdict yet
}

// KPI row config — every value below reads a real field already returned by
// getEvidenceStats(); nothing here is computed or invented. "Critical
// Evidence" (stats.criticalEvidence) is a distinct real stat from "High
// Impact" (stats.highImpactEvidence) and is intentionally left off this row
// to match the target layout rather than shown twice under similar names.
type KpiTone = 'cyan' | 'amber' | 'green' | 'red' | 'purple' | 'orange' | 'blue' | 'magenta';
const KPI_ITEMS: { key: keyof EvidenceStats; label: string; sub: string; icon: React.ComponentType<{ size?: number | string }>; tone: KpiTone }[] = [
    { key: 'total', label: 'Total Evidence', sub: 'All recorded evidence', icon: Layers, tone: 'cyan' },
    { key: 'unreviewed', label: 'Unreviewed', sub: 'Pending analyst review', icon: Eye, tone: 'amber' },
    { key: 'accepted', label: 'Accepted', sub: 'Validated evidence', icon: CheckCircle2, tone: 'green' },
    { key: 'rejected', label: 'Rejected', sub: 'Dismissed / invalid', icon: XCircle, tone: 'red' },
    { key: 'conflicts', label: 'Conflicts', sub: 'Conflicting indicators', icon: GitCompare, tone: 'purple' },
    { key: 'integrityWarnings', label: 'Integrity Warnings', sub: 'Data integrity issues', icon: AlertTriangle, tone: 'orange' },
    { key: 'evidenceGaps', label: 'Evidence Gaps', sub: 'Missing context', icon: FileQuestion, tone: 'blue' },
    { key: 'highImpactEvidence', label: 'High Impact', sub: 'High-impact evidence', icon: Zap, tone: 'magenta' },
];

// Quick filter tiles — only the three that map to a real, already-supported
// reviewState filter value are made clickable. "High Impact" has no matching
// query param on getEvidencePage (it's a distinct computed stat, not an
// importance level), so it's shown for visibility only, never wired to a
// filter it doesn't actually correspond to.
const QUICK_FILTERS: { key: 'unreviewed' | 'accepted' | 'rejected' | 'highImpactEvidence'; label: string; tone: KpiTone; clickable: boolean }[] = [
    { key: 'unreviewed', label: 'Unreviewed', tone: 'amber', clickable: true },
    { key: 'accepted', label: 'Accepted', tone: 'green', clickable: true },
    { key: 'rejected', label: 'Rejected', tone: 'red', clickable: true },
    { key: 'highImpactEvidence', label: 'High Impact', tone: 'magenta', clickable: false },
];

// The only 3 review-state values a quick-filter tile above can honestly map to.
const QUICK_FILTER_REVIEW_STATE: Record<string, string> = { unreviewed: 'unreviewed', accepted: 'accepted', rejected: 'rejected' };

function computeRange(id: DateRangeId, customFrom: string, customTo: string): { from?: string; to?: string } {
    const now = new Date();
    switch (id) {
        case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return { from: d.toISOString() }; }
        case '24h': return { from: new Date(now.getTime() - 24 * 3_600_000).toISOString() };
        case '7d': return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString() };
        case '30d': return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() };
        case 'custom': return { from: customFrom ? new Date(customFrom).toISOString() : undefined, to: customTo ? new Date(customTo).toISOString() : undefined };
        default: return {};
    }
}

interface EvidencePageProps {
    onNavigate?: (view: string) => void;
    onOpenCase?: (caseId: number) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
}

const EvidencePage: React.FC<EvidencePageProps> = ({ onNavigate, onOpenCase, onOpenKnowledgeEntry }) => {
    const [meta, setMeta] = useState<EvidenceMeta | null>(null);
    const [stats, setStats] = useState<EvidenceStats | null>(null);
    const [items, setItems] = useState<EvidenceRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [sort, setSort] = useState('observed_desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(true);

    // §21 FILTERS
    const [dateMode, setDateMode] = useState<'observed' | 'created'>('observed');
    const [dateRange, setDateRange] = useState<DateRangeId>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [module, setModule] = useState('all');
    const [classification, setClassification] = useState('all');
    const [confidence, setConfidence] = useState('all');
    const [reviewStateFilter, setReviewStateFilter] = useState('all');
    const [importanceFilter, setImportanceFilter] = useState('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    const [showQueue, setShowQueue] = useState(false);
    const [queueItems, setQueueItems] = useState<EvidenceReviewQueueItem[]>([]);
    const [queueLoading, setQueueLoading] = useState(false);

    // §12/§14 — Recent Activity sidebar. Its own small, independent fetch of
    // the same real /api/evidence endpoint sorted by creation time; it does
    // not follow the main list's filters (matches the reference's always-on
    // activity feed), and every row is a genuine EvidenceRecord.createdAt.
    const [recentItems, setRecentItems] = useState<EvidenceRecord[]>([]);
    const loadRecent = () => {
        getEvidencePage({ sort: 'created_desc', page: 1, pageSize: 5 }).then((r) => setRecentItems(r.items)).catch(() => setRecentItems([]));
    };
    useEffect(() => { loadRecent(); }, []);

    // §12 sidebar "Evidence by Source Module" — real stats.bySourceModule,
    // just optionally truncated with a real expand toggle (no new data).
    const [showAllModules, setShowAllModules] = useState(false);

    // §7 per-row "More actions" menu — reuses the exact same reviewEvidence
    // action already wired to the detail modal (runReview below); this only
    // adds a second, faster entry point to it from the list row.
    const [menuOpenId, setMenuOpenId] = useState<number | null>(null);

    const loadQueue = () => {
        setQueueLoading(true);
        getEvidenceReviewQueue(100).then((r) => setQueueItems(r.items)).catch(() => setQueueItems([])).finally(() => setQueueLoading(false));
    };
    useEffect(() => { if (showQueue) loadQueue(); }, [showQueue]);

    useEffect(() => {
        const t = setTimeout(() => { setSearch((v) => (v === searchInput ? v : searchInput)); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    // §1 hero header "Last Updated" — a real client-side timestamp of the
    // last successful evidence-stats fetch (there's no server-provided
    // freshness field on this endpoint, unlike Threat Summary's
    // data.dataFreshness), so it's labeled "Last Synced" rather than
    // claiming a server timestamp it doesn't have.
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const loadStats = () => {
        getEvidenceStats().then((s) => { setStats(s); setLastSyncedAt(new Date().toISOString()); }).catch(() => {});
    };

    useEffect(() => {
        getEvidenceMeta().then(setMeta).catch(() => {});
        loadStats();
    }, []);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        const { from, to } = computeRange(dateRange, customFrom, customTo);
        getEvidencePage({
            search: search || undefined,
            module: module !== 'all' ? module : undefined,
            classification: classification !== 'all' ? classification : undefined,
            confidence: confidence !== 'all' ? confidence : undefined,
            observedFrom: dateMode === 'observed' ? from : undefined,
            observedTo: dateMode === 'observed' ? to : undefined,
            createdFrom: dateMode === 'created' ? from : undefined,
            createdTo: dateMode === 'created' ? to : undefined,
            sort, page, pageSize,
            // EVIDENCE_PHASE3.md §58/§59.
            reviewState: reviewStateFilter !== 'all' ? reviewStateFilter : undefined,
            importance: importanceFilter !== 'all' ? importanceFilter : undefined,
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err: any) => setError(err?.message || 'Evidence unavailable.'))
            .finally(() => setLoading(false));
    }, [search, module, classification, confidence, reviewStateFilter, importanceFilter, dateMode, dateRange, customFrom, customTo, sort, page]);
    useEffect(() => { load(); }, [load]);

    const refreshAll = () => { load(); loadStats(); loadRecent(); };

    const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !search && module === 'all' && classification === 'all' && confidence === 'all'
        && reviewStateFilter === 'all' && importanceFilter === 'all' && dateRange === 'all';

    // §15 empty state "Clear Filters" — resets every filter setter that
    // already exists above; the pre-existing load() effect (deps on these
    // same state vars) re-fires on its own once they change, exactly like
    // every other filter change on this page.
    const clearFilters = () => {
        setSearchInput(''); setSearch('');
        setModule('all'); setClassification('all'); setConfidence('all');
        setReviewStateFilter('all'); setImportanceFilter('all');
        setDateMode('observed'); setDateRange('all'); setCustomFrom(''); setCustomTo('');
        setPage(1);
    };

    // §13 Quick Filters — jumps straight to the filtered list using the
    // existing reviewState filter, in case the list/filters were hidden
    // behind the Review Queue toggle or a collapsed filter panel.
    const applyQuickFilter = (reviewState: string) => {
        setShowQueue(false); setFiltersOpen(true);
        setFilter(setReviewStateFilter)(reviewState);
    };

    // §12/§61 EVIDENCE DETAIL
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [detail, setDetail] = useState<EvidenceDetailPhase2 | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [rawView, setRawView] = useState(false);

    // EVIDENCE_PHASE2.md §23-25 review/notes, §47-52 AI analyst.
    const [history, setHistory] = useState<EvidenceHistoryEntry[]>([]);
    const [noteText, setNoteText] = useState('');
    const [reviewPending, setReviewPending] = useState(false);
    const [aiAnalysis, setAiAnalysis] = useState<EvidenceAiAnalysis | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    // EVIDENCE_PHASE3.md §5-10 Accept/Reject/Supersede, §11-13 Integrity, §22-24 Importance.
    const [rejectReason, setRejectReason] = useState<EvidenceRejectReason>('Irrelevant');
    const [decisionNote, setDecisionNote] = useState('');
    const [supersedeTargetId, setSupersedeTargetId] = useState('');
    const [integrityResult, setIntegrityResult] = useState<{ status: string; reason?: string } | null>(null);
    const [integrityPending, setIntegrityPending] = useState(false);

    const loadHistory = (id: number) => { getEvidenceHistory(id).then(setHistory).catch(() => setHistory([])); };
    const openDetail = (id: number) => {
        setSelectedId(id); setDetail(null); setRawView(false); setDetailLoading(true);
        setHistory([]); setNoteText(''); setAiAnalysis(null);
        setDecisionNote(''); setSupersedeTargetId(''); setIntegrityResult(null); setRejectReason('Irrelevant');
        getEvidenceDetail(id).then((d) => setDetail(d as EvidenceDetailPhase2)).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
        loadHistory(id);
    };
    const refreshDetail = (id: number) => {
        getEvidenceDetail(id).then((d) => setDetail(d as EvidenceDetailPhase2)).catch(() => {});
        loadHistory(id);
    };

    const runReview = async (id: number, action: EvidenceReviewAction) => {
        setReviewPending(true);
        try { await reviewEvidence(id, action); refreshDetail(id); refreshAll(); } catch { /* surfaced via unchanged state */ } finally { setReviewPending(false); }
    };
    // Row-level "More actions" quick review — same reviewEvidence() call as
    // the modal's own buttons, just invoked without opening the modal first.
    // refreshAll() alone (no refreshDetail) since no modal is open for this row.
    const quickReview = async (id: number, action: EvidenceReviewAction) => {
        setMenuOpenId(null);
        setReviewPending(true);
        try { await reviewEvidence(id, action); refreshAll(); } catch { /* surfaced via unchanged state */ } finally { setReviewPending(false); }
    };
    const submitNote = async (id: number) => {
        const text = noteText.trim();
        if (!text) return;
        setReviewPending(true);
        try { await addEvidenceNote(id, text); setNoteText(''); refreshDetail(id); } finally { setReviewPending(false); }
    };
    const runAiAnalysis = async (entityType: string, entityId: string) => {
        setAiLoading(true); setAiAnalysis(null);
        try {
            const result = await getEvidenceAiAnalysis({ entityType, entityId, question: 'What is the strongest evidence and what conflicts or gaps exist?' });
            setAiAnalysis(result);
        } catch { setAiAnalysis(null); } finally { setAiLoading(false); }
    };
    const askWhatIfRejected = async (id: number) => {
        setAiLoading(true); setAiAnalysis(null);
        try {
            const result = await getEvidenceAiAnalysis({ evidenceId: id, question: 'What happens if this evidence is rejected?' });
            setAiAnalysis(result);
        } catch { setAiAnalysis(null); } finally { setAiLoading(false); }
    };

    const runAccept = async (id: number) => {
        setReviewPending(true);
        try { await acceptEvidence(id, decisionNote || undefined); setDecisionNote(''); refreshDetail(id); refreshAll(); } finally { setReviewPending(false); }
    };
    const runReject = async (id: number) => {
        setReviewPending(true);
        try { await rejectEvidence(id, rejectReason, decisionNote || undefined); setDecisionNote(''); refreshDetail(id); refreshAll(); } finally { setReviewPending(false); }
    };
    const runNeedsMoreContext = async (id: number) => {
        setReviewPending(true);
        try { await requestMoreContextOnEvidence(id, decisionNote || undefined); setDecisionNote(''); refreshDetail(id); refreshAll(); } finally { setReviewPending(false); }
    };
    const runSupersede = async (id: number) => {
        const targetId = Number(supersedeTargetId);
        if (!Number.isFinite(targetId) || targetId <= 0) return;
        setReviewPending(true);
        try { await supersedeEvidence(id, targetId, decisionNote || undefined); setSupersedeTargetId(''); setDecisionNote(''); refreshDetail(id); refreshAll(); } finally { setReviewPending(false); }
    };
    const runVerifyIntegrity = async (id: number) => {
        setIntegrityPending(true); setIntegrityResult(null);
        try { const result = await verifyEvidenceIntegrity(id); setIntegrityResult(result); refreshDetail(id); } finally { setIntegrityPending(false); }
    };
    const runSetImportance = async (id: number, importance: EvidenceImportanceLevel | null) => {
        setReviewPending(true);
        try { await setEvidenceImportance(id, importance); refreshDetail(id); } finally { setReviewPending(false); }
    };

    // §26/§27/§28 NAVIGATION
    const viewSource = (item: { type: string; entity: { id: string } }) => {
        if (item.type === 'case') { onOpenCase?.(Number(item.entity.id)); return; }
        if (item.type === 'knowledge_entry') { onOpenKnowledgeEntry?.(Number(item.entity.id)); return; }
        const view = ENTITY_TYPE_VIEW[item.type];
        if (view) onNavigate?.(view);
    };
    const viewInTimeline = (item: { type: string; entity: { id: string } }) => {
        onNavigate?.(`timeline?entityType=${item.type}&entityId=${item.entity.id}`);
    };

    const visibleModules = stats ? (showAllModules ? stats.bySourceModule : stats.bySourceModule.slice(0, 6)) : [];
    const moduleMax = stats && stats.bySourceModule.length > 0 ? stats.bySourceModule[0].count : 1;

    return (
        <div className="ev-page">
            {/* §1 HEADER — no "+ Add Evidence" button: the only add-evidence
                capability in the app (addEvidence()) requires an existing
                entityType/entityId to attach to, which this cross-entity
                page has none of; adding one here would mean inventing a new
                entity-picker workflow, not redesigning an existing one. */}
            <div className="ev-header">
                <div className="ev-header-left">
                    <div className="ev-header-icon"><Database size={24} /></div>
                    <div>
                        <div className="ev-title-row">
                            <h1 className="ev-title">Evidence</h1>
                            <span className="ev-trust-chip"><ShieldCheck size={11} /> Source Grounded</span>
                        </div>
                        <p className="ev-subtitle">The centralized view of evidence already recorded across LekirraX — a supporting-material layer, never a second intelligence store.</p>
                    </div>
                </div>
                {/* Last Synced — a real client-side timestamp of the last
                    successful stats fetch (set in loadStats()); labeled
                    "Synced" rather than "Live" since this page has no
                    push/poll feed the way the Threat Map or Threat Summary
                    do — it reflects the last time this view actually asked
                    the server for fresh numbers, not a continuous stream. */}
                <div className="ev-header-right">
                    <div className="ev-header-updated">
                        <span className="ev-header-updated-label">Last Synced</span>
                        <span className="ev-header-updated-value">{lastSyncedAt ? formatDateTime(lastSyncedAt) : '—'}</span>
                    </div>
                    <span className="ev-synced-badge"><span className="ev-synced-dot" />Synced</span>
                </div>
            </div>

            {/* §2 KPI SUMMARY — every value is stats.<field> from getEvidenceStats(), no derived or invented numbers. */}
            <div className="ev-kpi-row">
                {KPI_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const value = stats ? stats[item.key] as number : null;
                    return (
                        <div className={`ev-kpi-card ev-tone--${item.tone}`} key={item.key}>
                            <div className="ev-kpi-icon"><Icon size={18} /></div>
                            <div className="ev-kpi-body">
                                <div className="ev-kpi-label">{item.label}</div>
                                <div className="ev-kpi-value">{value ?? '—'}</div>
                                <div className="ev-kpi-sub">{item.sub}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* §3 NAVIGATION — only "Evidence" is a real, implemented view;
                Analytics/Trends/Gaps have no backing page or endpoint on this
                workspace yet, so they're shown as real workspace destinations
                on the roadmap rather than either faking content or omitting
                the structure the workspace is meant to grow into. */}
            <div className="ev-tabs" role="tablist" aria-label="Evidence workspace views">
                <button type="button" role="tab" aria-selected="true" className="ev-tab active"><Layers size={14} />Evidence</button>
                <button type="button" role="tab" aria-selected="false" className="ev-tab ev-tab--soon" disabled title="Not yet available"><BarChart3 size={14} />Analytics<span className="ev-soon-dot">Soon</span></button>
                <button type="button" role="tab" aria-selected="false" className="ev-tab ev-tab--soon" disabled title="Not yet available"><LineChartIcon size={14} />Trends<span className="ev-soon-dot">Soon</span></button>
                <button type="button" role="tab" aria-selected="false" className="ev-tab ev-tab--soon" disabled title="Not yet available"><FileQuestion size={14} />Gaps<span className="ev-soon-dot">Soon</span></button>
            </div>

            <div className="ev-workspace">
                {/* §4 LEFT — evidence list + filtering (dominant column) */}
                <div className="ev-main">
                    <div className="ev-card ev-toolbar-card">
                        <div className="ev-toolbar-head">
                            <span className="ev-card-title">Evidence</span>
                            <div className="ti-row-actions">
                                <button className={`ti-action-btn${showQueue ? ' active' : ''}`} onClick={() => setShowQueue((v) => !v)}>
                                    {!showQueue && !!stats?.unreviewed && <span className="ev-amber-dot" />}
                                    {showQueue ? 'Show List' : 'Review Queue'}
                                </button>
                                <button className="ti-action-btn timeline-filter-toggle" onClick={() => setFiltersOpen((v) => !v)}>{filtersOpen ? 'Hide Filters' : 'Show Filters'}</button>
                                {/* NOTES_PHASE3.md §4 "REMAINING NAVIGATION GAP" — a page-level deep
                                    link (Evidence has no single entity context of its own); the
                                    analyst can pick the "Evidence" context filter on the Notes page itself. */}
                                <button className="ti-action-btn" onClick={() => onNavigate?.('notes')}>View Notes</button>
                                <button className="ti-refresh-btn" onClick={refreshAll} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                            </div>
                        </div>

                        {filtersOpen && (
                            <div className="ti-filters timeline-filters ev-filters">
                                <input type="text" placeholder="Search evidence, entity, case, finding, hypothesis…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} className="ev-search-input" />
                                <select value={module} onChange={(e) => setFilter(setModule)(e.target.value)}>
                                    <option value="all">All Sources</option>
                                    {(meta?.modules || []).map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <select value={classification} onChange={(e) => setFilter(setClassification)(e.target.value)}>
                                    <option value="all">All Classifications</option>
                                    {(meta?.classifications || []).map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                                </select>
                                <select value={confidence} onChange={(e) => setFilter(setConfidence)(e.target.value)}>
                                    <option value="all">All Confidence</option>
                                    {(meta?.confidences || ['Low', 'Medium', 'High']).map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={reviewStateFilter} onChange={(e) => setFilter(setReviewStateFilter)(e.target.value)}>
                                    <option value="all">All Review States</option>
                                    {(meta?.reviewStates || []).map((r) => <option key={r} value={r}>{LIFECYCLE_LABEL[r] || r}</option>)}
                                </select>
                                {(meta?.importanceLevels?.length ?? 0) > 0 && (
                                    <select value={importanceFilter} onChange={(e) => setFilter(setImportanceFilter)(e.target.value)}>
                                        <option value="all">All Importance</option>
                                        {(meta?.importanceLevels || []).map((i) => <option key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</option>)}
                                    </select>
                                )}
                                <select value={dateMode} onChange={(e) => setDateMode(e.target.value as 'observed' | 'created')}>
                                    <option value="observed">Observed Date</option>
                                    <option value="created">Created Date</option>
                                </select>
                                <select value={dateRange} onChange={(e) => setFilter(setDateRange)(e.target.value as DateRangeId)}>
                                    {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                                {dateRange === 'custom' && (
                                    <>
                                        <input type="datetime-local" value={customFrom} onChange={(e) => setFilter(setCustomFrom)(e.target.value)} />
                                        <input type="datetime-local" value={customTo} onChange={(e) => setFilter(setCustomTo)(e.target.value)} />
                                    </>
                                )}
                                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                                    <option value="observed_desc">Newest Observed</option>
                                    <option value="observed_asc">Oldest Observed</option>
                                    <option value="created_desc">Newest Created</option>
                                    <option value="created_asc">Oldest Created</option>
                                </select>
                            </div>
                        )}

                        {/* §6 COUNT + PAGINATION — hidden in Review Queue mode (queue has no paging of its own). */}
                        {!showQueue && !loading && !error && (
                            <div className="ev-list-summary">
                                <span>{total.toLocaleString()} evidence item{total === 1 ? '' : 's'}</span>
                                {items.length > 0 && (
                                    <div className="ev-pager-inline">
                                        <span>Page {page} of {totalPages}</span>
                                        <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">‹</button>
                                        <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">›</button>
                                    </div>
                                )}
                            </div>
                        )}

                        {showQueue ? (
                            /* EVIDENCE_PHASE3.md §53/§54 — bounded, explainable priority ordering. */
                            queueLoading ? (
                                <div className="ti-loading">Loading review queue…</div>
                            ) : queueItems.length === 0 ? (
                                <div className="ti-empty">Nothing needs attention right now.</div>
                            ) : (
                                <div className="ev-list">
                                    {queueItems.map((ev) => (
                                        <div key={ev.rawId} className="ev-row">
                                            <div className="ev-row-icon"><FileText size={15} /></div>
                                            <div className="ev-row-body">
                                                <div className="ev-row-top">
                                                    <span className="ev-row-id">{ev.id}</span>
                                                    <span className={`ti-badge ${lifecycleBadgeClass(ev.lifecycleStatus)}`}>{LIFECYCLE_LABEL[ev.lifecycleStatus] || ev.lifecycleStatus}</span>
                                                </div>
                                                <div className="ev-row-title">{ev.description || `${ev.sourceModule} evidence`}</div>
                                                <div className="ev-row-meta">
                                                    <span className="ti-target">{ev.entity.label}</span>
                                                    <span>Age: {ev.ageDays ?? '—'}d</span>
                                                    {ev.priorityFactors.map((f) => <span key={f} className="ti-chip">{f}</span>)}
                                                </div>
                                            </div>
                                            <div className="ev-row-actions">
                                                <button className="ti-action-btn" onClick={() => openDetail(ev.rawId)}>View Details</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        ) : error ? (
                            <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>
                        ) : loading ? (
                            <div className="ti-loading">Loading evidence…</div>
                        ) : items.length === 0 ? (
                            /* §15 EMPTY STATES */
                            <div className="ev-empty">
                                <FileQuestion size={26} />
                                <div className="ev-empty-title">No evidence found</div>
                                <div className="ev-empty-desc">{filtersAreDefault ? 'No evidence has been recorded yet.' : 'No evidence matches the current search and filters.'}</div>
                                {!filtersAreDefault && <button className="ti-action-btn" onClick={clearFilters}>Clear Filters</button>}
                            </div>
                        ) : (
                            <>
                                <div className="ev-list">
                                    {items.map((ev) => (
                                        <div key={ev.rawId} className="ev-row">
                                            <div className="ev-row-icon"><FileText size={15} /></div>
                                            <div className="ev-row-body">
                                                {/* §7 top line: id + status + confidence */}
                                                <div className="ev-row-top">
                                                    <span className="ev-row-id">{ev.id}</span>
                                                    <span className={`ti-badge ${lifecycleBadgeClass(ev.lifecycleStatus)}`}>{LIFECYCLE_LABEL[ev.lifecycleStatus] || ev.lifecycleStatus}</span>
                                                    {/* §9 confidence only rendered when the real record has one */}
                                                    {ev.confidence && <span className={`ti-badge ti-badge--${ev.confidence.toLowerCase()}`}>{ev.confidence} Confidence</span>}
                                                    {ev.importance === 'critical' && <span className="ti-badge ti-badge--critical">Critical</span>}
                                                    {ev.integrityStatus === 'mismatch' && <span className="ti-badge ti-badge--critical">Integrity Warning</span>}
                                                </div>
                                                {/* §7 main line: title/description, clamped so long text can't blow out the row */}
                                                <div className="ev-row-title">{ev.description || `${ev.sourceModule} evidence`}</div>
                                                {/* §7/§10 metadata: source module, entity, observed time, classification */}
                                                <div className="ev-row-meta">
                                                    <span className="ti-chip">{ev.sourceModule}</span>
                                                    <span className="ti-target">{ev.entity.label}</span>
                                                    {ev.classification && <span className="ti-chip">{ev.classification}</span>}
                                                    <span className="ev-row-meta-time">Observed: {formatDateTime(ev.observedAt)} ({timeAgo(ev.observedAt)})</span>
                                                </div>
                                                {(ev.relationshipCounts.cases > 0 || ev.relationshipCounts.findings > 0 || ev.relationshipCounts.hypotheses > 0) && (
                                                    <div className="ev-row-relationships">
                                                        {ev.relationshipCounts.cases > 0 && <span className="ti-chip">{ev.relationshipCounts.cases} Case{ev.relationshipCounts.cases > 1 ? 's' : ''}</span>}
                                                        {ev.relationshipCounts.findings > 0 && <span className="ti-chip">{ev.relationshipCounts.findings} Finding{ev.relationshipCounts.findings > 1 ? 's' : ''}</span>}
                                                        {ev.relationshipCounts.hypotheses > 0 && <span className="ti-chip">{ev.relationshipCounts.hypotheses} Hypothes{ev.relationshipCounts.hypotheses > 1 ? 'es' : 'is'}</span>}
                                                    </div>
                                                )}
                                            </div>
                                            {/* §7 actions: View Details / View Source / More actions */}
                                            <div className="ev-row-actions">
                                                <button className="ti-action-btn" onClick={() => openDetail(ev.rawId)}>View Details</button>
                                                {(ENTITY_TYPE_VIEW[ev.type] || ev.type === 'case' || ev.type === 'knowledge_entry') && (
                                                    <button className="ti-action-btn" onClick={() => viewSource(ev)}>View Source</button>
                                                )}
                                                <div className="ev-row-more">
                                                    <button className="ev-more-btn" aria-label="More actions" onClick={() => setMenuOpenId((cur) => (cur === ev.rawId ? null : ev.rawId))}><MoreVertical size={15} /></button>
                                                    {menuOpenId === ev.rawId && (
                                                        <>
                                                            <div className="ev-menu-backdrop" onClick={() => setMenuOpenId(null)} />
                                                            <div className="ev-menu">
                                                                <button disabled={reviewPending} onClick={() => quickReview(ev.rawId, 'mark_reviewed')}>Mark Reviewed</button>
                                                                <button disabled={reviewPending} onClick={() => quickReview(ev.rawId, 'mark_needs_review')}>Mark Needs Review</button>
                                                                <button onClick={() => { setMenuOpenId(null); openDetail(ev.rawId); }}>Open Full Review <ChevronRight size={12} /></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                            </>
                        )}
                    </div>
                </div>

                {/* §12/§13/§14/§16 RIGHT — analytics & review context (secondary column) */}
                <aside className="ev-sidebar">
                    {/* §12 EVIDENCE BY SOURCE MODULE */}
                    {stats && stats.bySourceModule.length > 0 && (
                        <div className="ev-card ev-side-card">
                            <div className="ev-side-head">
                                <span className="ev-side-title"><Layers size={14} /> Evidence by Source Module</span>
                                {stats.bySourceModule.length > 6 && (
                                    <button className="ev-view-all-btn" onClick={() => setShowAllModules((v) => !v)}>{showAllModules ? 'Show Less' : 'View All'}</button>
                                )}
                            </div>
                            <div className="ev-module-bars">
                                {visibleModules.map((m) => (
                                    <div key={m.module} className="ev-module-row">
                                        <span className="ev-module-label">{m.module}</span>
                                        <div className="ev-module-bar-track"><div className="ev-module-bar-fill" style={{ width: `${Math.min(100, (m.count / moduleMax) * 100)}%` }} /></div>
                                        <span className="ev-module-count">{m.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* §13 QUICK FILTERS */}
                    {stats && (
                        <div className="ev-card ev-side-card">
                            <div className="ev-side-head"><span className="ev-side-title"><FilterIcon size={14} /> Quick Filters</span></div>
                            <div className="ev-quick-filter-grid">
                                {QUICK_FILTERS.map((qf) => {
                                    const value = stats[qf.key] as number;
                                    const clickable = qf.clickable && QUICK_FILTER_REVIEW_STATE[qf.key];
                                    return (
                                        <button
                                            key={qf.key}
                                            type="button"
                                            className={`ev-quick-filter ev-tone--${qf.tone}${clickable ? '' : ' ev-quick-filter--static'}`}
                                            disabled={!clickable}
                                            onClick={clickable ? () => applyQuickFilter(QUICK_FILTER_REVIEW_STATE[qf.key]) : undefined}
                                        >
                                            <span className="ev-quick-filter-value">{value ?? '—'}</span>
                                            <span className="ev-quick-filter-label">{qf.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* §14 RECENT ACTIVITY — real EvidenceRecord.createdAt, independent of the main list's filters. */}
                    {recentItems.length > 0 && (
                        <div className="ev-card ev-side-card">
                            <div className="ev-side-head"><span className="ev-side-title"><Clock size={14} /> Recent Activity</span></div>
                            <div className="ev-activity-list">
                                {recentItems.map((ev) => (
                                    <div className="ev-activity-row" key={ev.rawId}>
                                        <span className="ev-activity-dot" />
                                        <div className="ev-activity-body">
                                            <div className="ev-activity-time">{formatDateTime(ev.createdAt)}</div>
                                            <button className="ev-activity-link" onClick={() => openDetail(ev.rawId)}>{ev.id}</button> created
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* §16 EVIDENCE INTEGRITY trust note — this page is a read layer over
                        existing evidence, never a second store; wording mirrors the
                        real subtitle above rather than adding a new claim. */}
                    <div className="ev-integrity-note">
                        <ShieldCheck size={14} />
                        <div>
                            <div className="ev-integrity-title">Evidence Integrity</div>
                            <div className="ev-integrity-text">Evidence is read from existing LekirraX evidence sources and linked back to its originating module — this workspace does not create a second evidence repository.</div>
                        </div>
                    </div>
                </aside>
            </div>

            {/* §12/§61 EVIDENCE DETAIL */}
            {selectedId != null && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Evidence detail" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                    <div className="ti-modal" style={{ width: '620px', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div className="ti-modal-header"><h2>{detail?.id || 'Evidence'}</h2><button className="ti-modal-close" onClick={() => setSelectedId(null)}>×</button></div>
                        <div className="ti-modal-body">
                            {detailLoading ? (
                                <div className="ti-loading">Loading evidence detail…</div>
                            ) : !detail ? (
                                <div className="ti-empty">Evidence not found.</div>
                            ) : (
                                <>
                                    <div className="ti-kv">
                                        <span className="k">Type</span><span className="v">{detail.type}</span>
                                        <span className="k">Source Module</span><span className="v">{detail.sourceModule}</span>
                                        <span className="k">Source</span><span className="v">{detail.source}</span>
                                        {detail.confidence && (<><span className="k">Confidence</span><span className="v">{detail.confidence}</span></>)}
                                        <span className="k">Observed</span><span className="v">{formatDateTime(detail.observedAt)}{!detail.observedAtIsExplicit && ' (recorded time — no distinct observation time provided)'}</span>
                                        <span className="k">Recorded</span><span className="v">{formatDateTime(detail.createdAt)}</span>
                                        {detail.createdBy && (<><span className="k">Recorded By</span><span className="v">{detail.createdBy}</span></>)}
                                        <span className="k">Entity</span><span className="v">{detail.entity.label}</span>
                                        <span className="k">Lifecycle</span>
                                        <span className="v">
                                            <span className={`ti-badge ${lifecycleBadgeClass(detail.lifecycleStatus)}`}>{LIFECYCLE_LABEL[detail.lifecycleStatus] || detail.lifecycleStatus}</span>
                                            {detail.relevance ? ` · ${detail.relevance.replace('_', ' ')}` : ''}
                                        </span>
                                        {detail.decisionReason && (<><span className="k">Decision Reason</span><span className="v">{detail.decisionReason}</span></>)}
                                        {detail.reviewedByUserId != null && (<><span className="k">Reviewed</span><span className="v">{formatDateTime(detail.reviewedAt)}</span></>)}
                                        {detail.supersededByEvidenceId != null && (<><span className="k">Superseded By</span><span className="v"><button className="timeline-inline-link" onClick={() => openDetail(detail.supersededByEvidenceId as number)}>EV-{String(detail.supersededByEvidenceId).padStart(5, '0')}</button></span></>)}
                                    </div>

                                    {/* EVIDENCE_PHASE3.md §17-20 EVIDENCE IMPACT — direct relationships only. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Evidence Impact</div>
                                        <div className="ti-note">{detail.impact.downstreamCount} downstream reference(s): {detail.impact.cases} case(s), {detail.impact.findings} finding(s), {detail.impact.hypotheses} hypothesis/es, {detail.impact.threatBriefs} threat brief(s).</div>
                                    </div>

                                    {/* §22-24 CRITICAL / IMPORTANCE — analyst-controlled, never derived from confidence. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Importance</div>
                                        <div className="ti-row-actions">
                                            {EVIDENCE_IMPORTANCE_LEVELS.map((lvl) => (
                                                <button key={lvl} className={`ti-action-btn${detail.importance === lvl ? ' active' : ''}`} disabled={reviewPending} onClick={() => runSetImportance(detail.rawId, detail.importance === lvl ? null : lvl)}>
                                                    {lvl.charAt(0).toUpperCase() + lvl.slice(1)}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* §11-13 EVIDENCE INTEGRITY — reuses the file's own real hash; never fabricated. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle-row">
                                            <span className="ti-modal-subtitle">Integrity</span>
                                            <button className="ti-action-btn" disabled={integrityPending} onClick={() => runVerifyIntegrity(detail.rawId)}>{integrityPending ? 'Verifying…' : 'Verify Integrity'}</button>
                                        </div>
                                        <div className="ti-note">
                                            <span className="ti-chip">{detail.integrity.status.replace('_', ' ')}</span>
                                            {detail.integrity.hash && <span> sha256: {detail.integrity.hash}</span>}
                                            {detail.integrity.verifiedAt && <span> · verified {formatDateTime(detail.integrity.verifiedAt)}</span>}
                                        </div>
                                        {integrityResult && <div className="ti-note">{integrityResult.status === 'mismatch' ? '⚠ Integrity Warning — current file hash does not match the stored hash.' : integrityResult.reason || 'Verification complete.'}</div>}
                                    </div>

                                    {/* EVIDENCE_PHASE2.md §14-17 — Strength is distinct from Confidence,
                                        always shown WITH the signals that produced it (never a black box). */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Evidence Strength &amp; Independence</div>
                                        <div className="evidence-card-meta">
                                            <span className={`ti-badge ti-badge--${detail.strength.label.toLowerCase()}`}>{detail.strength.label}</span>
                                            {detail.strength.signals.map((s) => <span key={s} className="ti-chip">{s}</span>)}
                                        </div>
                                        <div className="ti-note" style={{ marginTop: '6px' }}>
                                            {detail.sourceIndependence.independentSourceCount} independent source lineage(s){detail.sourceIndependence.lineages.length > 0 && `: ${detail.sourceIndependence.lineages.map((l) => l.label).join(', ')}`}
                                        </div>
                                    </div>

                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Quality Checklist</div>
                                        <div className="evidence-card-meta">
                                            {Object.entries(detail.quality.checklist).map(([k, v]) => (
                                                <span key={k} className="ti-chip" style={{ opacity: v ? 1 : 0.45 }}>{v ? '✓' : '✗'} {k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())}</span>
                                            ))}
                                        </div>
                                        <div className="ti-note" style={{ marginTop: '6px' }}>{detail.quality.summary}</div>
                                    </div>

                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Chain of Custody</div>
                                        <div className="ti-note"><span className="ti-chip">{detail.chainOfCustody.status}</span> {detail.chainOfCustody.reason}</div>
                                    </div>

                                    {detail.lineage.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Provenance Chain</div>
                                            <div className="ti-note">{detail.lineage.map((l) => `${l.level}: ${l.label}`).join('  →  ')}</div>
                                            <div className="ti-note" style={{ opacity: 0.7 }}>This reflects recorded provenance ordering, not a legal chain of custody.</div>
                                        </div>
                                    )}

                                    {detail.conflicts.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Evidence Conflicts</div>
                                            <ul className="timeline-context-list">
                                                {detail.conflicts.map((c, i) => (
                                                    <li key={i}>
                                                        <span className="ti-chip">{c.status.replace('_', ' ')}</span>{' '}
                                                        {c.evidenceA.id} vs {c.evidenceB.id} — {c.reasons.join(', ')}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {detail.description && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Description</div>
                                            <div className="ti-note">{detail.description}</div>
                                        </div>
                                    )}

                                    {detail.url && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">URL</div>
                                            {/* §38 — displayed as plain text, never auto-visited. */}
                                            <div className="ti-note evidence-url">{detail.url}</div>
                                        </div>
                                    )}

                                    {Object.keys(detail.metadata).length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle-row">
                                                <span className="ti-modal-subtitle">Metadata</span>
                                                <div className="ti-row-actions">
                                                    <button className={`ti-action-btn${!rawView ? ' active' : ''}`} onClick={() => setRawView(false)}>Pretty</button>
                                                    <button className={`ti-action-btn${rawView ? ' active' : ''}`} onClick={() => setRawView(true)}>Raw</button>
                                                </div>
                                            </div>
                                            {rawView ? (
                                                <pre className="evidence-raw-json">{JSON.stringify(detail.metadata, null, 2)}</pre>
                                            ) : (
                                                <div className="ti-kv">
                                                    {Object.entries(detail.metadata).map(([k, v]) => (
                                                        <React.Fragment key={k}><span className="k">{k}</span><span className="v">{String(v)}</span></React.Fragment>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {detail.relatedCases.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Cases</div>
                                            <ul className="timeline-context-list">
                                                {detail.relatedCases.map((c) => (
                                                    <li key={c.caseId}>
                                                        <button className="timeline-inline-link" onClick={() => { onOpenCase?.(c.caseId); setSelectedId(null); }}>{c.caseNumber} — {c.title}</button>
                                                        {c.classification && <span className="ti-chip">{c.classification}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {detail.relatedFindings.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Findings</div>
                                            <ul className="timeline-context-list">
                                                {detail.relatedFindings.map((f) => (
                                                    <li key={f.findingId}>
                                                        <button className="timeline-inline-link" onClick={() => { onOpenCase?.(f.caseId); setSelectedId(null); }}>{f.title || f.statement}</button>
                                                        <span className="timeline-context-time">{f.caseNumber}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {detail.relatedHypotheses.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Hypotheses</div>
                                            <ul className="timeline-context-list">
                                                {detail.relatedHypotheses.map((h) => (
                                                    <li key={h.hypothesisId}>
                                                        <button className="timeline-inline-link" onClick={() => { onOpenCase?.(h.caseId); setSelectedId(null); }}>{h.statement}</button>
                                                        <span className="ti-chip">{h.role}</span>
                                                        <span className="timeline-context-time">{h.caseNumber}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {detail.relatedThreatBriefs.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Referenced By Threat Briefs</div>
                                            <ul className="timeline-context-list">
                                                {detail.relatedThreatBriefs.map((b) => (
                                                    <li key={b.reportId}>
                                                        <button className="timeline-inline-link" onClick={() => { onNavigate?.('threat-briefs'); setSelectedId(null); }}>{b.title}</button>
                                                        <span className="ti-chip">{b.rank}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* EVIDENCE_PHASE2.md §23-25 — review is metadata about the evidence,
                                        never a rewrite of its original stored fields. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Review</div>
                                        <div className="ti-row-actions">
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runReview(detail.rawId, 'mark_reviewed')}>Mark Reviewed</button>
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runReview(detail.rawId, 'mark_needs_review')}>Needs Review</button>
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runReview(detail.rawId, 'mark_relevant')}>Mark Relevant</button>
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runReview(detail.rawId, 'mark_not_relevant')}>Mark Not Relevant</button>
                                        </div>
                                        <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                            <input type="text" placeholder="Add an analyst note (e.g. reliability caveat)…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ flex: 1, minWidth: '220px' }} />
                                            <button className="ti-action-btn" disabled={reviewPending || !noteText.trim()} onClick={() => submitNote(detail.rawId)}>Add Note</button>
                                        </div>
                                    </div>

                                    {/* EVIDENCE_PHASE3.md §5-10 — the analyst decision workflow. Never
                                        overwrites source/description/confidence; reason is always recorded. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Accept / Reject / Supersede</div>
                                        <input type="text" placeholder="Decision note (optional)…" value={decisionNote} onChange={(e) => setDecisionNote(e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
                                        <div className="ti-row-actions">
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runAccept(detail.rawId)}>Accept Evidence</button>
                                            <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value as EvidenceRejectReason)}>
                                                {EVIDENCE_REJECT_REASONS.map((r) => <option key={r} value={r}>{r}</option>)}
                                            </select>
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runReject(detail.rawId)}>Reject Evidence</button>
                                            <button className="ti-action-btn" disabled={reviewPending} onClick={() => runNeedsMoreContext(detail.rawId)}>Needs More Context</button>
                                        </div>
                                        <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                            <input type="number" placeholder="Superseding Evidence ID…" value={supersedeTargetId} onChange={(e) => setSupersedeTargetId(e.target.value)} style={{ width: '180px' }} />
                                            <button className="ti-action-btn" disabled={reviewPending || !supersedeTargetId.trim()} onClick={() => runSupersede(detail.rawId)}>Mark Superseded By…</button>
                                        </div>
                                    </div>

                                    {history.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Review &amp; Note History</div>
                                            <ul className="timeline-context-list">
                                                {history.map((h, i) => (
                                                    <li key={i}>
                                                        <span className="ti-chip">{h.action.replace(/_/g, ' ')}</span>
                                                        {h.note && <span> — {h.note}</span>}
                                                        <span className="timeline-context-time">{h.username || 'System'} · {formatDateTime(h.createdAt)}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* EVIDENCE_PHASE2.md §47-52 — reuses Ask AI's own LLMService, bounded
                                        to this evidence's entity scope; never fabricates evidence. */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle-row">
                                            <span className="ti-modal-subtitle">AI Evidence Analysis</span>
                                            <div className="ti-row-actions">
                                                <button className="ti-action-btn" disabled={aiLoading} onClick={() => runAiAnalysis(detail.type, detail.entity.id)}>{aiLoading ? 'Analyzing…' : 'Ask AI'}</button>
                                                <button className="ti-action-btn" disabled={aiLoading} onClick={() => askWhatIfRejected(detail.rawId)}>What if rejected?</button>
                                            </div>
                                        </div>
                                        {aiAnalysis && (
                                            <>
                                                <div className="ti-note">{aiAnalysis.summary}</div>
                                                {aiAnalysis.conflicts.length > 0 && <div className="ti-note">Conflicts: {aiAnalysis.conflicts.join('; ')}</div>}
                                                {aiAnalysis.gaps.length > 0 && <div className="ti-note">Gaps: {aiAnalysis.gaps.join('; ')}</div>}
                                                {aiAnalysis.impact.length > 0 && <div className="ti-note">Impact: {aiAnalysis.impact.join('; ')}</div>}
                                                <div className="ti-note" style={{ opacity: 0.7 }}>{aiAnalysis.note}</div>
                                            </>
                                        )}
                                    </div>

                                    <div className="ti-row-actions" style={{ marginTop: '14px' }}>
                                        {(ENTITY_TYPE_VIEW[detail.type] || detail.type === 'case' || detail.type === 'knowledge_entry') && (
                                            <button className="ti-action-btn" onClick={() => { viewSource(detail); setSelectedId(null); }}>View Source</button>
                                        )}
                                        <button className="ti-action-btn" onClick={() => { viewInTimeline(detail); setSelectedId(null); }}>View in Timeline</button>
                                        <button className="ti-action-btn" onClick={() => setSelectedId(null)}>Close</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default EvidencePage;
