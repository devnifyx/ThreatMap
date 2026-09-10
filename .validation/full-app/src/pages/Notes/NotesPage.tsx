// NOTES_PHASE1.md — Centralized Analyst Notes, Search, Context & Case
// Integration. A VIEW/adapter over case_notes (authoritative for case
// notes) + the new generic `notes` table (entity notes) + intelligence_
// history (Evidence/Timeline's existing note writers) — §2 "ONE coherent
// Notes experience, not multiple competing note systems." Reuses the SAME
// LekirraX design system every other centralized page already uses.
import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    StickyNote, UserCheck, User, CalendarPlus, History, Search, FileText, Layers,
    Tag as TagIcon, CircleDot, Calendar as CalendarIcon, ArrowUpDown, Plus, Download,
    ListChecks, RefreshCw, MoreVertical, Info, ChevronRight,
} from 'lucide-react';
import {
    getNotesPage, getNoteDetail, getNotesStats, getNotesMeta,
    createCentralNote, updateCentralNote, archiveCentralNote, restoreCentralNote,
    addNoteReference, removeNoteReference, addNoteTag, removeNoteTag, getRelatedNotes, exportNotesPage, notesToCsv,
    type NoteListItem, type NoteDetail, type NotesStats, type NotesMeta, type NoteType, type NoteContextFilter,
    type NoteContext, type RelatedNoteGroup,
    // NOTES_PHASE3.md — AI Note Analysis, Entity Extraction, Intelligence
    // Suggestions & Knowledge Extraction.
    getNoteAiSummary, getMultiNoteSummary, analyzeNoteAi, getNoteAiConflicts, getNoteAiDuplicates,
    createKnowledgeCandidateFromNotes, getReviewQueue, approveSuggestion, rejectSuggestion, applySuggestion,
    type NoteAiSummaryResult, type MultiNoteSummaryResult, type NoteAnalysis, type NoteConflict, type NoteDuplicate,
    type ReviewQueueItem,
} from '../../services/api';
import { formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import { timeAgo } from '../../utils/timeAgo';
import { ENTITY_TYPE_VIEW } from '../../utils/entityRoutes';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import '../Investigations/CasesPage.css';
import '../Timeline/TimelinePage.css';
import './NotesPage.css';
import Pagination from '../../components/shared/Pagination';  // P2-8
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here

const NOTE_TYPE_LABEL: Record<string, string> = {
    general: 'General', observation: 'Observation', analysis: 'Analysis', decision: 'Decision',
    hypothesis: 'Hypothesis', finding: 'Finding', follow_up: 'Follow Up', conclusion: 'Conclusion',
};

const DATE_RANGES = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '24h', label: 'Last 24 Hours' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
] as const;
type DateRangeId = typeof DATE_RANGES[number]['id'];
function computeRange(id: DateRangeId): { from?: string } {
    const now = new Date();
    switch (id) {
        case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return { from: d.toISOString() }; }
        case '24h': return { from: new Date(now.getTime() - 24 * 3_600_000).toISOString() };
        case '7d': return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString() };
        case '30d': return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() };
        default: return {};
    }
}

// KPI row config — every value read below is stats.<field> from
// getNotesStats(); nothing here is computed or invented.
type NtTone = 'cyan' | 'green' | 'purple' | 'amber';
const KPI_ITEMS: { key: keyof NotesStats; label: string; sub: string; icon: React.ComponentType<{ size?: number | string }>; tone: NtTone }[] = [
    { key: 'total', label: 'Total Notes', sub: 'All analyst notes', icon: StickyNote, tone: 'cyan' },
    { key: 'myNotes', label: 'My Notes', sub: 'Notes created by you', icon: User, tone: 'green' },
    { key: 'createdToday', label: 'Created Today', sub: 'New notes today', icon: CalendarPlus, tone: 'purple' },
    { key: 'updatedToday', label: 'Updated Today', sub: 'Notes modified today', icon: History, tone: 'amber' },
];

// §9 CONTEXT VISIBILITY — classifies a note's real NoteContext fields into
// one honest badge. Never invents a context that isn't actually present;
// a note with none of these set is genuinely context-less ("General").
function noteContextBadge(ctx: NoteContext): { label: string; tone: NtTone } | null {
    if (ctx.caseId != null) return { label: ctx.caseNumber ? `Case ${ctx.caseNumber}` : 'Case', tone: 'cyan' };
    if (ctx.findingId != null) return { label: 'Finding', tone: 'purple' };
    if (ctx.hypothesisId != null) return { label: 'Hypothesis', tone: 'purple' };
    if (ctx.entityType) {
        const typeLabel = ctx.entityType.charAt(0).toUpperCase() + ctx.entityType.slice(1);
        const entityLabel = ctx.entity?.label;
        // Some entity references only carry a raw numeric id as their
        // label (no friendlier name from the backend) — pairing it with
        // the real entityType ("Evidence: 10844") keeps the badge honest
        // without inventing a name that doesn't exist.
        return { label: entityLabel && entityLabel !== ctx.entityType ? `${typeLabel}: ${entityLabel}` : typeLabel, tone: 'cyan' };
    }
    return null;
}

// NOTES_PHASE2.md §13/§62 — a Notes-scoped deep-link context, handed off
// from another module page via the SAME lifted-state pattern App.tsx
// already uses for Knowledge Base ("View Related Knowledge").
export interface NotesFilterContext {
    entityType?: string; entityId?: string; caseId?: number; label: string;
}

interface NotesPageProps {
    onNavigate?: (view: string) => void;
    onOpenCase?: (caseId: number) => void;
    initialFilter?: NotesFilterContext | null;
    onInitialFilterConsumed?: () => void;
    // NOTES_PHASE3.md §50 "[Ask AI About This Note]"
    onAskAiAboutNote?: (question: string, pageContext?: { type: string; id: string | number; label?: string } | null) => void;
}

const NotesPage: React.FC<NotesPageProps> = ({ onNavigate, onOpenCase, initialFilter, onInitialFilterConsumed, onAskAiAboutNote }) => {
    const [meta, setMeta] = useState<NotesMeta | null>(null);
    const [stats, setStats] = useState<NotesStats | null>(null);
    const [items, setItems] = useState<NoteListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [sort, setSort] = useState('updated_desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(true);

    // §17/§18/§43 FILTERS
    const [noteType, setNoteType] = useState('all');
    const [context, setContext] = useState<NoteContextFilter>('all');
    const [archived, setArchived] = useState<'false' | 'true'>('false');
    const [dateRange, setDateRange] = useState<DateRangeId>('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');
    // NOTES_PHASE2.md §22/§50/§62.
    const [tagFilter, setTagFilter] = useState('');
    const [entityFilter, setEntityFilter] = useState<{ entityType?: string; entityId?: string; caseId?: number; label: string } | null>(null);

    // §13/§62 CROSS MODULE DEEP LINK — consume a filter handed off from
    // another module page's [View Notes] action exactly once.
    useEffect(() => {
        if (!initialFilter) return;
        setEntityFilter(initialFilter);
        setPage(1);
        onInitialFilterConsumed?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFilter]);

    useEffect(() => {
        const t = setTimeout(() => { setSearch((v) => (v === searchInput ? v : searchInput)); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => {
        getNotesMeta().then(setMeta).catch(() => {});
        getNotesStats().then(setStats).catch(() => {});
    }, []);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        const { from } = computeRange(dateRange);
        getNotesPage({
            search: search || undefined,
            noteType: noteType !== 'all' ? noteType : undefined,
            context: context !== 'all' ? context : undefined,
            archived,
            updatedFrom: from,
            tag: tagFilter || undefined,
            entityType: entityFilter?.entityType, entityId: entityFilter?.entityId, caseId: entityFilter?.caseId,
            sort, page, pageSize,
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err: any) => setError(err?.message || 'Notes unavailable.'))
            .finally(() => setLoading(false));
    }, [search, noteType, context, archived, dateRange, tagFilter, entityFilter, sort, page]);
    useEffect(() => { load(); }, [load]);

    const refreshAll = () => { load(); getNotesStats().then(setStats).catch(() => {}); };
    const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !search && noteType === 'all' && context === 'all' && dateRange === 'all' && !tagFilter && !entityFilter;

    // §4 "Clear Filters" — resets every filter setter that already exists
    // above; the existing load() effect (deps on these same state vars)
    // re-fires on its own once they change, same pattern as every other
    // filter change on this page.
    const clearFilters = () => {
        setSearchInput(''); setSearch('');
        setNoteType('all'); setContext('all'); setArchived('false'); setDateRange('all');
        setTagFilter(''); setEntityFilter(null);
        setPage(1);
    };

    // §7 per-row "More actions" menu — reuses the exact same
    // archiveCentralNote/restoreCentralNote calls already wired to the
    // detail modal's Archive/Restore buttons (runArchive/runRestore
    // below), just invoked directly from the row without opening it
    // first. Gated on n.editable, mirroring the modal's own gate.
    const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
    const quickArchive = async (id: string) => {
        setMenuOpenId(null);
        try { await archiveCentralNote(id); refreshAll(); } catch { /* surfaced via unchanged list state */ }
    };
    const quickRestore = async (id: string) => {
        setMenuOpenId(null);
        try { await restoreCentralNote(id); refreshAll(); } catch { /* surfaced via unchanged list state */ }
    };

    // §22 NOTE DETAIL
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [detail, setDetail] = useState<NoteDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [editTitle, setEditTitle] = useState('');
    const [editContent, setEditContent] = useState('');
    const [saving, setSaving] = useState(false);

    // NOTES_PHASE2.md §8/§10/§18/§34/§35 — References, Tags, Related Notes.
    const [relatedGroups, setRelatedGroups] = useState<RelatedNoteGroup[]>([]);
    const [newRefType, setNewRefType] = useState('');
    const [newRefId, setNewRefId] = useState('');
    const [refError, setRefError] = useState<string | null>(null);
    const [newTagName, setNewTagName] = useState('');
    const [refTagPending, setRefTagPending] = useState(false);

    // NOTES_PHASE3.md §5/§8/§26/§27 — AI Summary / Analyze / Conflicts / Duplicates.
    const [aiSummary, setAiSummary] = useState<NoteAiSummaryResult | null>(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [analysis, setAnalysis] = useState<NoteAnalysis | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [conflicts, setConflicts] = useState<NoteConflict[] | null>(null);
    const [duplicates, setDuplicates] = useState<NoteDuplicate[] | null>(null);
    const [checkingConflicts, setCheckingConflicts] = useState(false);
    const [suggestionBusy, setSuggestionBusy] = useState<number | null>(null);
    const [suggestionResult, setSuggestionResult] = useState<Record<number, string>>({});

    const loadRelated = (id: string) => { getRelatedNotes(id).then(setRelatedGroups).catch(() => setRelatedGroups([])); };
    const openDetail = (id: string) => {
        setSelectedId(id); setDetail(null); setDetailLoading(true);
        setRelatedGroups([]); setNewRefType(''); setNewRefId(''); setRefError(''); setNewTagName('');
        setAiSummary(null); setAnalysis(null); setConflicts(null); setDuplicates(null); setSuggestionResult({});
        getNoteDetail(id).then((d) => { setDetail(d); setEditTitle(d.title || ''); setEditContent(d.content); }).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
        loadRelated(id);
    };

    const runAiSummary = async () => {
        if (!detail) return;
        setAiSummaryLoading(true);
        try { setAiSummary(await getNoteAiSummary(detail.id)); } catch (err: any) { setAiSummary({ summary: err?.message || 'AI Unavailable', note: '' }); } finally { setAiSummaryLoading(false); }
    };
    const runAnalyze = async () => {
        if (!detail) return;
        setAnalyzing(true);
        try { setAnalysis(await analyzeNoteAi(detail.id)); } catch { setAnalysis(null); } finally { setAnalyzing(false); }
    };
    const runCheckConflicts = async () => {
        if (!detail) return;
        setCheckingConflicts(true);
        try { const [c, d] = await Promise.all([getNoteAiConflicts(detail.id), getNoteAiDuplicates(detail.id)]); setConflicts(c); setDuplicates(d); }
        catch { setConflicts([]); setDuplicates([]); }
        finally { setCheckingConflicts(false); }
    };
    // §33/§34/§74 "ACTION PREVIEW / EXECUTION" — [Approve] runs the state
    // transition then IMMEDIATELY the real apply call; the result shown is
    // always the literal API response, never claimed before it returns.
    const runApproveAndApply = async (suggestion: { id: number }) => {
        setSuggestionBusy(suggestion.id);
        try {
            await approveSuggestion(suggestion.id);
            const applied = await applySuggestion(suggestion.id);
            setSuggestionResult((r) => ({ ...r, [suggestion.id]: `Applied: ${JSON.stringify(applied.result)}` }));
            if (detail) { refreshDetail(detail.id); }
            if (analysis) setAnalysis((a) => a ? { ...a, suggestions: a.suggestions.map((s) => s.id === suggestion.id ? { ...s, status: 'applied' } : s) } : a);
        } catch (err: any) {
            setSuggestionResult((r) => ({ ...r, [suggestion.id]: `Action unavailable — ${err?.message || 'Insufficient Permission'}` }));
        } finally {
            setSuggestionBusy(null);
        }
    };
    // NOTES_PHASE3.md §50 — reuses the existing Ask AI chat unchanged; the
    // Note's own content is quoted directly into the seeded question, and
    // its Case/Entity (if any) becomes Ask AI's ambient pageContext.
    const runAskAiAboutNote = () => {
        if (!detail || !onAskAiAboutNote) return;
        const question = `Regarding ${detail.id}: "${detail.content.slice(0, 500)}" — what should I know about this?`;
        const pageContext = detail.context.entityType
            ? { type: detail.context.entityType, id: detail.context.entity?.id ?? '', label: detail.context.entity?.label ?? undefined }
            : detail.context.caseId != null
                ? { type: 'case', id: detail.context.caseId, label: detail.context.caseNumber ?? undefined }
                : null;
        onAskAiAboutNote(question, pageContext);
        setSelectedId(null);
    };
    const runRejectSuggestion = async (suggestion: { id: number }) => {
        setSuggestionBusy(suggestion.id);
        try {
            await rejectSuggestion(suggestion.id);
            if (analysis) setAnalysis((a) => a ? { ...a, suggestions: a.suggestions.map((s) => s.id === suggestion.id ? { ...s, status: 'rejected' } : s) } : a);
        } finally { setSuggestionBusy(null); }
    };
    const refreshDetail = (id: string) => { getNoteDetail(id).then((d) => { setDetail(d); setEditTitle(d.title || ''); setEditContent(d.content); }).catch(() => {}); };

    const submitReference = async () => {
        if (!detail || !newRefType || !newRefId.trim()) return;
        setRefTagPending(true); setRefError(null);
        try { await addNoteReference(detail.id, newRefType, newRefId.trim()); setNewRefType(''); setNewRefId(''); refreshDetail(detail.id); loadRelated(detail.id); }
        catch (err: any) { setRefError(err?.message || 'Failed to add reference.'); }
        finally { setRefTagPending(false); }
    };
    const runRemoveReference = async (referenceType: string, referenceId: string) => {
        if (!detail) return;
        setRefTagPending(true);
        try { await removeNoteReference(detail.id, referenceType, referenceId); refreshDetail(detail.id); loadRelated(detail.id); } finally { setRefTagPending(false); }
    };
    const submitTag = async () => {
        if (!detail || !newTagName.trim()) return;
        setRefTagPending(true);
        try { await addNoteTag(detail.id, newTagName.trim()); setNewTagName(''); refreshDetail(detail.id); refreshAll(); } finally { setRefTagPending(false); }
    };
    const runRemoveTag = async (tagId: number) => {
        if (!detail) return;
        setRefTagPending(true);
        try { await removeNoteTag(detail.id, tagId); refreshDetail(detail.id); refreshAll(); } finally { setRefTagPending(false); }
    };
    const viewReference = (referenceType: string, referenceId: string) => {
        if (referenceType === 'case') { onOpenCase?.(Number(referenceId)); setSelectedId(null); return; }
        const view = ENTITY_TYPE_VIEW[referenceType];
        if (view) { onNavigate?.(view); setSelectedId(null); }
    };

    const saveEdit = async () => {
        if (!detail || !editContent.trim()) return;
        setSaving(true);
        try { await updateCentralNote(detail.id, { title: editTitle || undefined, content: editContent }); refreshDetail(detail.id); refreshAll(); } finally { setSaving(false); }
    };
    const runArchive = async () => {
        if (!detail) return;
        setSaving(true);
        try { await archiveCentralNote(detail.id); refreshDetail(detail.id); refreshAll(); } finally { setSaving(false); }
    };
    const runRestore = async () => {
        if (!detail) return;
        setSaving(true);
        try { await restoreCentralNote(detail.id); refreshDetail(detail.id); refreshAll(); } finally { setSaving(false); }
    };

    // §29 NAVIGATION
    const viewContext = (ctx: NoteDetail['context'] | NoteListItem['context']) => {
        if (ctx.caseId != null) { onOpenCase?.(ctx.caseId); setSelectedId(null); return; }
        if (ctx.entityType) {
            const view = ENTITY_TYPE_VIEW[ctx.entityType];
            if (view) { onNavigate?.(view); setSelectedId(null); }
        }
    };

    // §30 NOTE CREATION
    const [creating, setCreating] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newContent, setNewContent] = useState('');
    const [newType, setNewType] = useState<NoteType>('general');
    const [newContextKind, setNewContextKind] = useState<'case' | 'finding' | 'hypothesis' | 'entity'>('entity');
    const [newCaseId, setNewCaseId] = useState('');
    const [newFindingId, setNewFindingId] = useState('');
    const [newHypothesisId, setNewHypothesisId] = useState('');
    const [newEntityType, setNewEntityType] = useState('');
    const [newEntityId, setNewEntityId] = useState('');
    const [createError, setCreateError] = useState<string | null>(null);
    const [createPending, setCreatePending] = useState(false);

    // §27-31 NOTE EXPORT — client-side CSV conversion of already-authorized,
    // server-filtered rows (no new server dependency, §27's own instruction
    // to only implement formats the project already supports).
    const [exporting, setExporting] = useState(false);
    const runExport = async () => {
        setExporting(true);
        try {
            const { from } = computeRange(dateRange);
            const result = await exportNotesPage({
                search: search || undefined, noteType: noteType !== 'all' ? noteType : undefined,
                context: context !== 'all' ? context : undefined, tag: tagFilter || undefined,
                entityType: entityFilter?.entityType, entityId: entityFilter?.entityId, caseId: entityFilter?.caseId,
                updatedFrom: from,
            });
            const csv = notesToCsv(result.items);
            const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
            downloadBlob(blob, `notes-export-${new Date().toISOString().slice(0, 10)}.csv`);
        } catch { /* surfaced via unchanged state; export is best-effort */ } finally {
            setExporting(false);
        }
    };

    // NOTES_PHASE3.md §6/§18/§51 — MULTI NOTE SELECTION, SUMMARY & KNOWLEDGE CANDIDATE.
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const toggleSelected = (id: string) => setSelectedIds((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const [multiSummary, setMultiSummary] = useState<MultiNoteSummaryResult | null>(null);
    const [multiSummaryLoading, setMultiSummaryLoading] = useState(false);
    const runMultiSummary = async () => {
        if (selectedIds.size === 0) return;
        setMultiSummaryLoading(true);
        try { setMultiSummary(await getMultiNoteSummary([...selectedIds])); } catch (err: any) { setMultiSummary({ noteIds: [], keyThemes: [], importantEntities: [], observations: [], conflicts: [], unknowns: [], note: err?.message || 'AI Unavailable' }); }
        finally { setMultiSummaryLoading(false); }
    };
    const [knowledgeCandidateBusy, setKnowledgeCandidateBusy] = useState(false);
    const [knowledgeCandidateResult, setKnowledgeCandidateResult] = useState<string | null>(null);
    const runKnowledgeCandidate = async () => {
        if (selectedIds.size < 2) return;
        setKnowledgeCandidateBusy(true);
        try { const r = await createKnowledgeCandidateFromNotes([...selectedIds]); setKnowledgeCandidateResult(`Knowledge Candidate suggestion #${r.id} created (${r.created ? 'new' : 'already pending'}) — review it in the Review Queue.`); }
        catch (err: any) { setKnowledgeCandidateResult(err?.message || 'AI Unavailable'); }
        finally { setKnowledgeCandidateBusy(false); }
    };

    // §61-§64 REVIEW QUEUE.
    const [showReviewQueue, setShowReviewQueue] = useState(false);
    const [reviewQueue, setReviewQueue] = useState<ReviewQueueItem[]>([]);
    const [reviewQueueLoading, setReviewQueueLoading] = useState(false);
    const [reviewBusy, setReviewBusy] = useState<number | null>(null);
    const loadReviewQueue = () => {
        setReviewQueueLoading(true);
        getReviewQueue({ status: 'pending' }).then(setReviewQueue).catch(() => setReviewQueue([])).finally(() => setReviewQueueLoading(false));
    };
    const toggleReviewQueue = () => { const next = !showReviewQueue; setShowReviewQueue(next); if (next) loadReviewQueue(); };
    const runQueueApprove = async (item: ReviewQueueItem) => {
        setReviewBusy(item.id);
        try { await approveSuggestion(item.id); await applySuggestion(item.id); loadReviewQueue(); refreshAll(); }
        catch { loadReviewQueue(); }
        finally { setReviewBusy(null); }
    };
    const runQueueReject = async (item: ReviewQueueItem) => {
        setReviewBusy(item.id);
        try { await rejectSuggestion(item.id); loadReviewQueue(); } finally { setReviewBusy(null); }
    };

    const resetCreateForm = () => {
        setNewTitle(''); setNewContent(''); setNewType('general'); setNewContextKind('entity');
        setNewCaseId(''); setNewFindingId(''); setNewHypothesisId(''); setNewEntityType(''); setNewEntityId(''); setCreateError(null);
    };
    const submitCreate = async () => {
        if (!newContent.trim()) { setCreateError('Content is required.'); return; }
        setCreatePending(true); setCreateError(null);
        try {
            const payload: Parameters<typeof createCentralNote>[0] = { title: newTitle || undefined, content: newContent, noteType: newType };
            if (newContextKind === 'case') { if (!newCaseId) { setCreateError('Case ID is required.'); return; } payload.caseId = Number(newCaseId); }
            else if (newContextKind === 'finding') { if (!newFindingId) { setCreateError('Finding ID is required.'); return; } payload.findingId = Number(newFindingId); }
            else if (newContextKind === 'hypothesis') { if (!newHypothesisId) { setCreateError('Hypothesis ID is required.'); return; } payload.hypothesisId = Number(newHypothesisId); }
            else { if (!newEntityType || !newEntityId) { setCreateError('Entity Type and Entity ID are required.'); return; } payload.entityType = newEntityType; payload.entityId = newEntityId; }
            await createCentralNote(payload);
            setCreating(false); resetCreateForm(); refreshAll();
        } catch (err: any) {
            setCreateError(err?.message || 'Failed to create note.');
        } finally {
            setCreatePending(false);
        }
    };

    return (
        <div className="nt-page">
            {/* §1 HEADER */}
            <div className="nt-header">
                <div className="nt-header-left">
                    <div className="nt-header-icon"><FileText size={24} /></div>
                    <div>
                        <div className="nt-title-row">
                            <h1 className="nt-title">Notes</h1>
                            <span className="nt-trust-chip"><UserCheck size={11} /> Analyst Authored</span>
                        </div>
                        <p className="nt-subtitle">The analyst's authored working record — observations, analysis, decisions, and context. Notes are never automatically Evidence, a Finding, a Hypothesis, or Knowledge.</p>
                    </div>
                </div>
                <button className="nt-btn nt-btn--primary" onClick={() => { setCreating(true); resetCreateForm(); }}><Plus size={15} /> New Note</button>
            </div>

            {/* §2 KPI SUMMARY — every value is stats.<field> from getNotesStats(), no derived or invented numbers. */}
            <div className="nt-kpi-row">
                {KPI_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const value = stats ? stats[item.key] as number : null;
                    return (
                        <div className={`nt-kpi-card nt-tone--${item.tone}`} key={item.key}>
                            <div className="nt-kpi-icon"><Icon size={18} /></div>
                            <div className="nt-kpi-body">
                                <div className="nt-kpi-label">{item.label}</div>
                                <div className="nt-kpi-value">{value ?? '—'}</div>
                                <div className="nt-kpi-sub">{item.sub}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* §3 NOTES WORKSPACE */}
            <div className="nt-card nt-workspace-card">
                <div className="nt-workspace-head">
                    <div>
                        <span className="nt-card-title">Notes</span>
                        <p className="nt-card-subtitle">Search, filter, and manage your analyst notes.</p>
                    </div>
                    <div className="ti-row-actions nt-toolbar-actions">
                        <button className="nt-btn nt-btn--primary nt-btn--sm" onClick={() => { setCreating(true); resetCreateForm(); }}><Plus size={13} /> New Note</button>
                        <button className="ti-action-btn" disabled={exporting} onClick={runExport}><Download size={12} /> {exporting ? 'Exporting…' : 'Export'}</button>
                        {/* NOTES_PHASE3.md §61 NOTES REVIEW QUEUE */}
                        <button className={`ti-action-btn${showReviewQueue ? ' active' : ''}`} onClick={toggleReviewQueue}><ListChecks size={12} /> {showReviewQueue ? 'Hide Review Queue' : 'Review Queue'}</button>
                        <button className="ti-action-btn timeline-filter-toggle" onClick={() => setFiltersOpen((v) => !v)}>{filtersOpen ? 'Hide Filters' : 'Show Filters'}</button>
                        <button className="ti-refresh-btn" onClick={refreshAll} disabled={loading}><RefreshCw size={12} /> {loading ? 'Loading…' : 'Refresh'}</button>
                    </div>
                </div>

                {entityFilter && (
                    <div className="nt-context-filter-chip">
                        <span className="ti-chip">Context: {entityFilter.label}</span>
                        <button onClick={() => setEntityFilter(null)} aria-label="Clear context filter">×</button>
                    </div>
                )}

                {/* NOTES_PHASE3.md §61-§64 REVIEW QUEUE */}
                {showReviewQueue && (
                    <div className="timeline-context-section" style={{ marginBottom: '10px' }}>
                        <div className="ti-modal-subtitle">Notes Review Queue — Pending AI Suggestions</div>
                        {reviewQueueLoading ? <div className="ti-loading">Loading…</div> : reviewQueue.length === 0 ? (
                            <div className="ti-empty">No pending suggestions.</div>
                        ) : (
                            <div className="notes-list">
                                {reviewQueue.map((item) => (
                                    <div key={item.id} className="ti-note">
                                        <div><b>{item.noteId}</b> — {item.noteTitle || '(untitled)'}</div>
                                        <div>{item.type === 'reference' ? `Add Reference: ${item.payload.label}` : item.type === 'tag' ? `Apply Tags: ${item.payload.tagNames?.join(', ')}` : `Potential ${item.type}`}</div>
                                        <div style={{ opacity: 0.8 }}>Reason: {item.reason} · Confidence: {item.confidence || 'N/A'}</div>
                                        <div className="ti-row-actions" style={{ marginTop: '4px' }}>
                                            <button className="ti-action-btn" disabled={reviewBusy === item.id} onClick={() => runQueueApprove(item)}>{reviewBusy === item.id ? 'Working…' : 'Approve'}</button>
                                            <button className="ti-action-btn" disabled={reviewBusy === item.id} onClick={() => runQueueReject(item)}>Reject</button>
                                            <button className="ti-action-btn" onClick={() => { setShowReviewQueue(false); openDetail(item.noteId); }}>View Note</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* §6/§18/§51 MULTI NOTE SELECTION */}
                {selectedIds.size > 0 && (
                    <div className="ti-filters" style={{ marginBottom: '8px' }}>
                        <span className="ti-chip">{selectedIds.size} selected</span>
                        <button className="ti-action-btn" disabled={multiSummaryLoading} onClick={runMultiSummary}>{multiSummaryLoading ? 'Summarizing…' : 'Analyze with AI'}</button>
                        <button className="ti-action-btn" disabled={selectedIds.size < 2 || knowledgeCandidateBusy} onClick={runKnowledgeCandidate}>{knowledgeCandidateBusy ? 'Working…' : 'Create Knowledge Candidate'}</button>
                        <button className="ti-action-btn" onClick={() => { setSelectedIds(new Set()); setMultiSummary(null); setKnowledgeCandidateResult(null); }}>Clear Selection</button>
                    </div>
                )}
                {multiSummary && (
                    <div className="timeline-context-section" style={{ marginBottom: '10px' }}>
                        <div className="ti-modal-subtitle">Multi-Note Summary ({multiSummary.noteIds.length} notes)</div>
                        <div><b>Key Themes:</b> {multiSummary.keyThemes.join(', ') || 'None'}</div>
                        <div><b>Important Entities:</b> {multiSummary.importantEntities.join(', ') || 'None'}</div>
                        {multiSummary.observations.length > 0 && <ul className="timeline-context-list">{multiSummary.observations.map((o, i) => <li key={i}>{o}</li>)}</ul>}
                        {multiSummary.conflicts.length > 0 && (<><b>Conflicts:</b><ul className="timeline-context-list">{multiSummary.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul></>)}
                        {multiSummary.unknowns.length > 0 && (<><b>Unknowns:</b><ul className="timeline-context-list">{multiSummary.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul></>)}
                        <div className="ti-note" style={{ marginTop: '6px', opacity: 0.7 }}>{multiSummary.note}</div>
                    </div>
                )}
                {knowledgeCandidateResult && <div className="ti-note" style={{ marginBottom: '8px' }}>{knowledgeCandidateResult}</div>}

                {/* §4 FILTER TOOLBAR */}
                {filtersOpen && (
                    <div className="nt-filters">
                        <div className="nt-filters-row">
                            <div className="nt-field nt-field--search">
                                <Search size={14} />
                                <input type="text" placeholder="Search notes, title, content, author, case…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                            </div>
                            <div className="nt-field">
                                <FileText size={14} />
                                <select value={noteType} onChange={(e) => setFilter(setNoteType)(e.target.value)}>
                                    <option value="all">All Types</option>
                                    {(meta?.noteTypes || []).map((t) => <option key={t} value={t}>{NOTE_TYPE_LABEL[t] || t}</option>)}
                                </select>
                            </div>
                            <div className="nt-field">
                                <Layers size={14} />
                                <select value={context} onChange={(e) => setFilter(setContext)(e.target.value as NoteContextFilter)}>
                                    <option value="all">All Contexts</option>
                                    <option value="cases">Cases</option>
                                    <option value="findings">Findings</option>
                                    <option value="hypotheses">Hypotheses</option>
                                    <option value="evidence">Evidence</option>
                                    <option value="entities">Entities</option>
                                    <option value="timeline">Timeline</option>
                                </select>
                            </div>
                            <div className="nt-field nt-field--tag">
                                <TagIcon size={14} />
                                <input type="text" placeholder="Tag…" value={tagFilter} onChange={(e) => setFilter(setTagFilter)(e.target.value)} />
                            </div>
                        </div>
                        <div className="nt-filters-row">
                            <div className="nt-field">
                                <CircleDot size={14} />
                                <select value={archived} onChange={(e) => setFilter(setArchived)(e.target.value as 'false' | 'true')}>
                                    <option value="false">Active</option>
                                    <option value="true">Archived</option>
                                </select>
                            </div>
                            <div className="nt-field">
                                <CalendarIcon size={14} />
                                <select value={dateRange} onChange={(e) => setFilter(setDateRange)(e.target.value as DateRangeId)}>
                                    {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                            </div>
                            <div className="nt-field">
                                <ArrowUpDown size={14} />
                                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                                    <option value="updated_desc">Newest Updated</option>
                                    <option value="updated_asc">Oldest Updated</option>
                                    <option value="created_desc">Newest Created</option>
                                    <option value="created_asc">Oldest Created</option>
                                </select>
                            </div>
                            {!filtersAreDefault && <button className="nt-clear-filters-btn" onClick={clearFilters}>Clear Filters</button>}
                        </div>
                    </div>
                )}

                {error ? (
                    <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>
                ) : loading ? (
                    <div className="ti-loading">Loading notes…</div>
                ) : items.length === 0 ? (
                    /* §5 EMPTY STATE */
                    <div className="nt-empty">
                        <div className="nt-empty-icon">
                            <FileText size={38} />
                            <span className="nt-empty-icon-badge"><Plus size={13} /></span>
                        </div>
                        <div className="nt-empty-title">No notes found</div>
                        <div className="nt-empty-desc">
                            {filtersAreDefault
                                ? 'Create your first analyst note to record observations, analysis, decisions, or context related to your investigations.'
                                : 'No notes match the current search and filters.'}
                        </div>
                        {filtersAreDefault ? (
                            <button className="nt-btn nt-btn--primary" onClick={() => { setCreating(true); resetCreateForm(); }}><Plus size={14} /> New Note</button>
                        ) : (
                            <button className="ti-action-btn" onClick={clearFilters}>Clear Filters</button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="nt-list">
                            {items.map((n) => {
                                const ctxBadge = noteContextBadge(n.context);
                                return (
                                    <div key={n.id} className="nt-row">
                                        <input type="checkbox" checked={selectedIds.has(n.id)} onChange={() => toggleSelected(n.id)} aria-label={`Select ${n.id}`} className="nt-row-checkbox" />
                                        <div className="nt-row-icon"><FileText size={15} /></div>
                                        <div className="nt-row-body">
                                            {/* §7/§8 top line: id + type + status + context */}
                                            <div className="nt-row-top">
                                                <span className="nt-row-id">{n.id}</span>
                                                <span className="ti-chip">{NOTE_TYPE_LABEL[n.noteType] || n.noteType}</span>
                                                {!n.isArchived && <span className="ti-badge nt-badge--active">Active</span>}
                                                {n.isArchived && <span className="ti-badge ti-badge--info">Archived</span>}
                                                {!n.editable && <span className="ti-badge ti-badge--info">Read-only</span>}
                                                {ctxBadge && <span className={`nt-context-badge nt-tone--${ctxBadge.tone}`}>{ctxBadge.label}</span>}
                                            </div>
                                            {n.title && <div className="nt-row-title">{n.title}</div>}
                                            <div className="nt-row-preview">"{n.contentPreview}"</div>
                                            {n.tags.length > 0 && (
                                                <div className="nt-row-tags">
                                                    {n.tags.map((t) => <span key={t} className="ti-chip nt-tag-chip" onClick={() => setFilter(setTagFilter)(t)}>{t}</span>)}
                                                </div>
                                            )}
                                            <div className="nt-row-meta">
                                                <span>Author: {n.createdBy || 'Unknown'}</span>
                                                <span className="nt-row-meta-time">Updated: {formatDateTime(n.updatedAt)} ({timeAgo(n.updatedAt)})</span>
                                            </div>
                                        </div>
                                        {/* §7 actions: View Details / More actions */}
                                        <div className="nt-row-actions">
                                            <button className="ti-action-btn" onClick={() => openDetail(n.id)}>View Details</button>
                                            {n.editable && (
                                                <div className="nt-row-more">
                                                    <button className="nt-more-btn" aria-label="More actions" onClick={() => setMenuOpenId((cur) => (cur === n.id ? null : n.id))}><MoreVertical size={15} /></button>
                                                    {menuOpenId === n.id && (
                                                        <>
                                                            <div className="nt-menu-backdrop" onClick={() => setMenuOpenId(null)} />
                                                            <div className="nt-menu">
                                                                {!n.isArchived ? (
                                                                    <button onClick={() => quickArchive(n.id)}>Archive</button>
                                                                ) : (
                                                                    <button onClick={() => quickRestore(n.id)}>Restore</button>
                                                                )}
                                                                <button onClick={() => { setMenuOpenId(null); openDetail(n.id); }}>Open Full Note <ChevronRight size={12} /></button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                    </>
                )}
            </div>

            {/* §40 NOTES BY TYPE — real stats.byType, kept as its own secondary panel. */}
            {stats && stats.byType.length > 0 && (
                <div className="nt-card">
                    <div className="nt-card-title">Notes by Type</div>
                    <div className="timeline-trend-bars">
                        {stats.byType.map((t) => (
                            <div key={t.noteType} className="timeline-trend-row">
                                <span className="timeline-trend-label">{NOTE_TYPE_LABEL[t.noteType] || t.noteType}</span>
                                <div className="timeline-trend-bar-track"><div className="timeline-trend-bar-fill" style={{ width: `${Math.min(100, (t.count / stats.byType[0].count) * 100)}%` }} /></div>
                                <span className="timeline-trend-count">{t.count}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* §10 ABOUT NOTES — mirrors the real header subtitle rather than adding a new claim. */}
            <div className="nt-about-note">
                <Info size={14} />
                <div>
                    <div className="nt-about-title">About Notes</div>
                    <div className="nt-about-text">Notes are analyst-authored working records for observations, analysis, decisions, and context. They are not automatically treated as Evidence, Findings, Hypotheses, or Knowledge.</div>
                </div>
            </div>

            {/* §22 NOTE DETAIL */}
            {selectedId != null && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Note detail" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedId(null); }}>
                    <div className="ti-modal" style={{ width: '600px', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div className="ti-modal-header"><h2>{detail?.id || 'Note'}</h2><button className="ti-modal-close" onClick={() => setSelectedId(null)}>×</button></div>
                        <div className="ti-modal-body">
                            {detailLoading ? (
                                <div className="ti-loading">Loading note detail…</div>
                            ) : !detail ? (
                                <div className="ti-empty">Note not found.</div>
                            ) : (
                                <>
                                    <div className="ti-kv">
                                        <span className="k">Type</span><span className="v">{NOTE_TYPE_LABEL[detail.noteType] || detail.noteType}</span>
                                        <span className="k">Author</span><span className="v">{detail.createdBy || 'Unknown'}</span>
                                        <span className="k">Created</span><span className="v">{formatDateTime(detail.createdAt)}</span>
                                        {detail.updatedBy && (<><span className="k">Updated By</span><span className="v">{detail.updatedBy}</span></>)}
                                        <span className="k">Updated</span><span className="v">{formatDateTime(detail.updatedAt)}</span>
                                        <span className="k">Status</span><span className="v">{detail.isArchived ? 'Archived' : 'Active'}</span>
                                    </div>

                                    {(detail.context.caseId != null || detail.context.entityType) && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Context</div>
                                            <div className="ti-kv">
                                                {detail.context.caseNumber && (<><span className="k">Case</span><span className="v">{detail.context.caseNumber} — {detail.context.caseTitle}</span></>)}
                                                {detail.context.findingTitle && (<><span className="k">Finding</span><span className="v">{detail.context.findingTitle}</span></>)}
                                                {detail.context.hypothesisStatement && (<><span className="k">Hypothesis</span><span className="v">{detail.context.hypothesisStatement}</span></>)}
                                                {detail.context.entityType && (<><span className="k">Entity</span><span className="v">{detail.context.entity?.label || detail.context.entityType}</span></>)}
                                            </div>
                                            <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                                <button className="ti-action-btn" onClick={() => viewContext(detail.context)}>
                                                    {detail.context.caseId != null ? 'View Case' : 'View Entity'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Content</div>
                                        {detail.editable ? (
                                            <>
                                                <input type="text" placeholder="Title (optional)" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
                                                <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={6} style={{ width: '100%' }} />
                                                <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                                    <button className="ti-action-btn" disabled={saving || !editContent.trim()} onClick={saveEdit}>{saving ? 'Saving…' : 'Save Changes'}</button>
                                                    {!detail.isArchived ? (
                                                        <button className="ti-action-btn" disabled={saving} onClick={runArchive}>Archive</button>
                                                    ) : (
                                                        <button className="ti-action-btn" disabled={saving} onClick={runRestore}>Restore</button>
                                                    )}
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                {detail.title && <div className="notes-card-title">{detail.title}</div>}
                                                {/* §47 — plain text interpolation only, never dangerouslySetInnerHTML. */}
                                                <div className="ti-note" style={{ whiteSpace: 'pre-wrap' }}>{detail.content}</div>
                                                <div className="ti-note" style={{ opacity: 0.7, marginTop: '6px' }}>This note was recorded as part of an append-only history feed and cannot be edited here.</div>
                                            </>
                                        )}
                                    </div>

                                    {/* NOTES_PHASE3.md §5/§7-§17/§26/§27 — AI ANALYSIS */}
                                    {detail.source !== 'H' && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">AI Analysis</div>
                                            <div className="ti-row-actions">
                                                <button className="ti-action-btn" disabled={aiSummaryLoading} onClick={runAiSummary}>{aiSummaryLoading ? 'Summarizing…' : 'AI Summary'}</button>
                                                <button className="ti-action-btn" disabled={analyzing} onClick={runAnalyze}>{analyzing ? 'Analyzing…' : 'Analyze with AI'}</button>
                                                <button className="ti-action-btn" disabled={checkingConflicts} onClick={runCheckConflicts}>{checkingConflicts ? 'Checking…' : 'Check Conflicts / Duplicates'}</button>
                                                {onAskAiAboutNote && <button className="ti-action-btn" onClick={runAskAiAboutNote}>Ask AI About This Note</button>}
                                            </div>

                                            {aiSummary && (
                                                <div className="ti-note" style={{ marginTop: '8px' }}>
                                                    <div style={{ whiteSpace: 'pre-wrap' }}>{aiSummary.summary}</div>
                                                    <div className="ti-note" style={{ marginTop: '4px', opacity: 0.7 }}>{aiSummary.note}</div>
                                                </div>
                                            )}

                                            {analysis && (
                                                <div style={{ marginTop: '10px' }}>
                                                    {/* §7-§10 EXTRACTED ENTITIES */}
                                                    <div className="ti-modal-subtitle">Extracted Entities</div>
                                                    {analysis.entities.length === 0 ? <div className="ti-empty">No entities detected.</div> : (
                                                        <ul className="timeline-context-list">
                                                            {analysis.entities.map((e, i) => (
                                                                <li key={i}>
                                                                    <b>{e.phrase}</b> ({e.sourceType}) —{' '}
                                                                    {e.status === 'resolved' && <span>{e.entity!.label} · Confidence: {e.confidence} · {e.matchedBy}</span>}
                                                                    {e.status === 'ambiguous' && <span>Multiple Matches — {e.candidates!.map((c) => c.label).join(', ')} (analyst selection required)</span>}
                                                                    {e.status === 'not_found' && <span style={{ opacity: 0.7 }}>Not Found</span>}
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    )}

                                                    {/* §11-§17/§41 ACTIONABLE SUGGESTIONS */}
                                                    <div className="ti-modal-subtitle" style={{ marginTop: '8px' }}>Suggestions</div>
                                                    {analysis.suggestions.length === 0 ? <div className="ti-empty">No suggestions.</div> : (
                                                        <div className="notes-list">
                                                            {analysis.suggestions.map((s) => (
                                                                <div key={s.id} className="ti-note" style={{ marginBottom: '6px' }}>
                                                                    <div><b>{s.type === 'reference' ? `Add Reference: ${s.payload.label}` : s.type === 'tag' ? `Apply Tags: ${s.payload.tagNames.join(', ')}` : `Potential ${s.type.charAt(0).toUpperCase() + s.type.slice(1)}`}</b></div>
                                                                    <div style={{ opacity: 0.8 }}>Reason: {s.reason}</div>
                                                                    <div style={{ opacity: 0.8 }}>Confidence: {s.confidence || 'N/A'} · Status: {s.status}</div>
                                                                    {s.status === 'pending' && (
                                                                        <div className="ti-row-actions" style={{ marginTop: '4px' }}>
                                                                            <button className="ti-action-btn" disabled={suggestionBusy === s.id} onClick={() => runApproveAndApply(s)}>{suggestionBusy === s.id ? 'Working…' : 'Approve'}</button>
                                                                            <button className="ti-action-btn" disabled={suggestionBusy === s.id} onClick={() => runRejectSuggestion(s)}>Reject</button>
                                                                        </div>
                                                                    )}
                                                                    {suggestionResult[s.id] && <div className="ti-note" style={{ marginTop: '4px' }}>{suggestionResult[s.id]}</div>}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {/* §58/§59 QUALITY WARNINGS */}
                                                    {analysis.qualityWarnings.length > 0 && (
                                                        <>
                                                            <div className="ti-modal-subtitle" style={{ marginTop: '8px' }}>Quality Warnings</div>
                                                            <ul className="timeline-context-list">
                                                                {analysis.qualityWarnings.map((w, i) => <li key={i}><b>{w.warning}</b> — {w.detail}</li>)}
                                                            </ul>
                                                        </>
                                                    )}

                                                    {/* §31 EVIDENCE GAPS */}
                                                    {analysis.evidenceGaps.length > 0 && (
                                                        <>
                                                            <div className="ti-modal-subtitle" style={{ marginTop: '8px' }}>Evidence Gaps</div>
                                                            <ul className="timeline-context-list">
                                                                {analysis.evidenceGaps.map((g, i) => <li key={i}><b>{g.gap}</b> — {g.detail}</li>)}
                                                            </ul>
                                                        </>
                                                    )}
                                                </div>
                                            )}

                                            {(conflicts || duplicates) && (
                                                <div style={{ marginTop: '10px' }}>
                                                    <div className="ti-modal-subtitle">Potential Conflicts</div>
                                                    {!conflicts || conflicts.length === 0 ? <div className="ti-empty">None detected.</div> : (
                                                        <ul className="timeline-context-list">
                                                            {conflicts.map((c, i) => (
                                                                <li key={i}>{c.reason}<br /><span style={{ opacity: 0.8 }}>{c.noteA.id}: "{c.noteA.content.slice(0, 100)}" vs {c.noteB.id}: "{c.noteB.content.slice(0, 100)}"</span></li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                    <div className="ti-modal-subtitle" style={{ marginTop: '8px' }}>Potential Duplicates</div>
                                                    {!duplicates || duplicates.length === 0 ? <div className="ti-empty">None detected.</div> : (
                                                        <ul className="timeline-context-list">
                                                            {duplicates.map((d, i) => (
                                                                <li key={i}>Similarity: {d.similarity} — <button className="timeline-inline-link" onClick={() => openDetail(d.note.id)}>{d.note.id}</button></li>
                                                            ))}
                                                        </ul>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* NOTES_PHASE2.md §8/§34 REFERENCED ENTITIES */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Referenced Entities</div>
                                        {detail.references.length === 0 ? (
                                            <div className="ti-empty">No References</div>
                                        ) : (
                                            <ul className="timeline-context-list">
                                                {detail.references.map((r) => (
                                                    <li key={r.id}>
                                                        <span className="ti-chip">{r.referenceType}</span> {r.label}
                                                        {(r.referenceType === 'case' || ENTITY_TYPE_VIEW[r.referenceType]) && (
                                                            <button className="timeline-inline-link" onClick={() => viewReference(r.referenceType, r.referenceId)} style={{ marginLeft: '8px' }}>View</button>
                                                        )}
                                                        {detail.editable && (
                                                            <button className="timeline-inline-link" disabled={refTagPending} onClick={() => runRemoveReference(r.referenceType, r.referenceId)} style={{ marginLeft: '8px' }}>Remove</button>
                                                        )}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                        {detail.editable && (
                                            <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                                <select value={newRefType} onChange={(e) => setNewRefType(e.target.value)}>
                                                    <option value="">Reference Type…</option>
                                                    {(meta?.referenceTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
                                                </select>
                                                <input type="text" placeholder="Entity/Case/Finding/Hypothesis ID" value={newRefId} onChange={(e) => setNewRefId(e.target.value)} style={{ flex: 1 }} />
                                                <button className="ti-action-btn" disabled={refTagPending || !newRefType || !newRefId.trim()} onClick={submitReference}>Add Reference</button>
                                            </div>
                                        )}
                                        {refError && <div className="ti-error" style={{ marginTop: '6px' }}>{refError}</div>}
                                    </div>

                                    {/* NOTES_PHASE2.md §18-24 TAGS */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Tags</div>
                                        {detail.tags.length === 0 ? (
                                            <div className="ti-empty">No Tags</div>
                                        ) : (
                                            <div className="evidence-card-meta">
                                                {detail.tags.map((t) => (
                                                    <span key={t.id} className="ti-chip">
                                                        {t.name}
                                                        {detail.editable && <button onClick={() => runRemoveTag(t.id)} disabled={refTagPending} style={{ marginLeft: '4px', cursor: 'pointer' }}>×</button>}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                        {detail.editable && (
                                            <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                                <input type="text" placeholder="Add a tag (e.g. Important, Follow Up)…" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} style={{ flex: 1 }} />
                                                <button className="ti-action-btn" disabled={refTagPending || !newTagName.trim()} onClick={submitTag}>Add Tag</button>
                                            </div>
                                        )}
                                    </div>

                                    {/* NOTES_PHASE2.md §35/§36 RELATED NOTES */}
                                    {relatedGroups.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Notes</div>
                                            {relatedGroups.map((g) => (
                                                <div key={g.reason} style={{ marginBottom: '8px' }}>
                                                    <div className="ti-note" style={{ opacity: 0.75 }}>Related because: {g.reason}</div>
                                                    <ul className="timeline-context-list">
                                                        {g.notes.map((n) => (
                                                            <li key={n.id}>
                                                                <button className="timeline-inline-link" onClick={() => openDetail(n.id)}>{n.title || n.contentPreview}</button>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div className="ti-row-actions" style={{ marginTop: '14px' }}>
                                        <button className="ti-action-btn" onClick={() => setSelectedId(null)}>Close</button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* §30 NOTE CREATION */}
            {creating && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="New note" onMouseDown={(e) => { if (e.target === e.currentTarget) setCreating(false); }}>
                    <div className="ti-modal" style={{ width: '560px' }}>
                        <div className="ti-modal-header"><h2>New Note</h2><button className="ti-modal-close" onClick={() => setCreating(false)}>×</button></div>
                        <div className="ti-modal-body">
                            <input type="text" placeholder="Title (optional)" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} style={{ width: '100%', marginBottom: '8px' }} />
                            <textarea placeholder="Note content…" value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={5} style={{ width: '100%', marginBottom: '8px' }} />
                            <select value={newType} onChange={(e) => setNewType(e.target.value as NoteType)} style={{ marginBottom: '8px' }}>
                                {(meta?.noteTypes || []).map((t) => <option key={t} value={t}>{NOTE_TYPE_LABEL[t] || t}</option>)}
                            </select>

                            <div className="ti-modal-subtitle">Attach To</div>
                            <div className="ti-row-actions" style={{ marginBottom: '8px' }}>
                                {(['entity', 'case', 'finding', 'hypothesis'] as const).map((k) => (
                                    <button key={k} className={`ti-action-btn${newContextKind === k ? ' active' : ''}`} onClick={() => setNewContextKind(k)}>{k.charAt(0).toUpperCase() + k.slice(1)}</button>
                                ))}
                            </div>
                            {newContextKind === 'case' && (
                                <input type="number" placeholder="Case ID" value={newCaseId} onChange={(e) => setNewCaseId(e.target.value)} style={{ width: '100%' }} />
                            )}
                            {newContextKind === 'finding' && (
                                <input type="number" placeholder="Finding ID" value={newFindingId} onChange={(e) => setNewFindingId(e.target.value)} style={{ width: '100%' }} />
                            )}
                            {newContextKind === 'hypothesis' && (
                                <input type="number" placeholder="Hypothesis ID" value={newHypothesisId} onChange={(e) => setNewHypothesisId(e.target.value)} style={{ width: '100%' }} />
                            )}
                            {newContextKind === 'entity' && (
                                <div className="ti-row-actions">
                                    <select value={newEntityType} onChange={(e) => setNewEntityType(e.target.value)}>
                                        <option value="">Entity Type…</option>
                                        {(meta?.entityTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
                                    </select>
                                    <input type="text" placeholder="Entity ID" value={newEntityId} onChange={(e) => setNewEntityId(e.target.value)} style={{ flex: 1 }} />
                                </div>
                            )}
                            {createError && <div className="ti-error" style={{ marginTop: '8px' }}>{createError}</div>}
                            <div className="ti-row-actions" style={{ marginTop: '14px' }}>
                                <button className="ti-action-btn" disabled={createPending || !newContent.trim()} onClick={submitCreate}>{createPending ? 'Saving…' : 'Create Note'}</button>
                                <button className="ti-action-btn" onClick={() => setCreating(false)}>Cancel</button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default NotesPage;
