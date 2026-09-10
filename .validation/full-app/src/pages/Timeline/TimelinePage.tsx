// TIMELINE_PHASE1.md — Unified Temporal Intelligence Foundation.
//
// Timeline is a VIEW / CORRELATION LAYER over EXISTING historical
// intelligence (§1/§2) — it owns no events. This page reuses the SAME
// LekirraX design system (dark + cyan, ti-* cards/tables/badges from
// ThreatIntelligencePage.css) every other module page already uses, and
// the existing date utilities (timeAgo/formatDateTime) — never a new
// visual language (§10 "Use existing LekirraX visual language").
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import {
    getTimelineEvents, getTimelineMeta, type TimelineEvent, type TimelineMeta,
    getEventContext, type EventContext, getEntityTimeline, type EntityCentricTimeline,
    addTimelineBookmark, removeTimelineBookmark, listTimelineBookmarks, addTimelineNote,
    getActivityBursts, type ActivityBurst, getTemporalComparison, type TemporalComparison,
    getModuleActivityTrends, type ModuleTrend, getEventTypeTrends, type EventTypeTrend,
    analyzeTimelinePeriod, type TimelineAiAnalysis,
    createThreatBriefDraftFromTimeline, createKnowledgeDraftFromTimeline,
} from '../../services/api';
import { formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import { timeAgo } from '../../utils/timeAgo';
import { ENTITY_TYPE_VIEW } from '../../utils/entityRoutes';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import '../Investigations/CasesPage.css'; // reuses .case-timeline* (§10 "use existing visual language")
import './TimelinePage.css';
import Pagination from '../../components/shared/Pagination';  // P2-8

// §14 ENTITY NAVIGATION / §13 SOURCE NAVIGATION — reuse EXISTING routes,
// never a duplicate detail page. 'case' and 'knowledge_entry' get a real
// deep-link (initialOpenId, the same handoff Alert Center/Knowledge Context
// Panel already use); everything else opens its owning module's real page.
// Shared with EvidencePage.tsx — see utils/entityRoutes.ts.

const DATE_RANGES = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: '24h', label: 'Last 24 Hours' },
    { id: '7d', label: 'Last 7 Days' },
    { id: '30d', label: 'Last 30 Days' },
    { id: '90d', label: 'Last 90 Days' },
    { id: 'custom', label: 'Custom Range' },
] as const;
type DateRangeId = typeof DATE_RANGES[number]['id'];

// TIMELINE_PHASE2.md §36 FILTER PRESETS — each maps to REAL module/entity-type
// filters the backend already accepts (module accepts a comma-list; entityType
// now does too, TIMELINE_PHASE2.md's own additive change to getTimelineEvents)
// — never a new filter dimension of its own.
const FILTER_PRESETS: { id: string; label: string; module?: string; entityType?: string }[] = [
    { id: 'all', label: 'All Activity' },
    { id: 'alerts', label: 'Security Alerts', module: 'Alerts' },
    { id: 'ti', label: 'Threat Intelligence', module: 'Threat Intelligence' },
    { id: 'inv', label: 'Investigations', module: 'Investigations' },
    { id: 'apt', label: 'APT Activity', entityType: 'threat_actor' },
    { id: 'malware', label: 'Malware Activity', entityType: 'malware,malware_sample' },
    { id: 'brand', label: 'Brand Activity', module: 'Brand Intelligence' },
    { id: 'monitoring', label: 'Monitoring Changes', module: 'Monitoring' },
];

function computeRange(id: DateRangeId, customFrom: string, customTo: string): { from?: string; to?: string } {
    const now = new Date();
    switch (id) {
        case 'today': { const d = new Date(now); d.setHours(0, 0, 0, 0); return { from: d.toISOString() }; }
        case '24h': return { from: new Date(now.getTime() - 24 * 3_600_000).toISOString() };
        case '7d': return { from: new Date(now.getTime() - 7 * 86_400_000).toISOString() };
        case '30d': return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString() };
        case '90d': return { from: new Date(now.getTime() - 90 * 86_400_000).toISOString() };
        case 'custom': return { from: customFrom ? new Date(customFrom).toISOString() : undefined, to: customTo ? new Date(customTo).toISOString() : undefined };
        default: return {};
    }
}

function dayLabel(iso: string): string {
    // §23 EVENT GROUPING by Day — display grouping only, never alters the
    // event's own real timestamp.
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
}

interface TimelinePageProps {
    onNavigate?: (view: string) => void;
    onOpenCase?: (caseId: number) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
}

// TIMELINE_PHASE3.md §51 UI — "Enhance Timeline UI with: Timeline, Activity,
// Trends, Correlated Activity" — a tab switcher within the SAME page/visual
// identity, never a separate module.
type TopTab = 'timeline' | 'activity' | 'trends';

const TimelinePage: React.FC<TimelinePageProps> = ({ onNavigate, onOpenCase, onOpenKnowledgeEntry }) => {
    const [topTab, setTopTab] = useState<TopTab>('timeline');
    const [meta, setMeta] = useState<TimelineMeta | null>(null);
    const [items, setItems] = useState<TimelineEvent[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [order, setOrder] = useState<'desc' | 'asc'>('desc');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<TimelineEvent | null>(null);
    const [filtersOpen, setFiltersOpen] = useState(true);

    // §15 GLOBAL FILTERS
    const [dateRange, setDateRange] = useState<DateRangeId>('all');
    const [customFrom, setCustomFrom] = useState('');
    const [customTo, setCustomTo] = useState('');
    const [module, setModule] = useState('all');
    const [entityTypeFilter, setEntityTypeFilter] = useState<string | undefined>(undefined); // §36 presets only — not a manual dropdown
    const [eventType, setEventType] = useState('');
    const [severity, setSeverity] = useState('all');
    const [confidence, setConfidence] = useState('all');
    const [entity, setEntity] = useState(''); // §17 free-text search (title/description/entity name/event type/module)

    // TIMELINE_PHASE2.md §21/§26/§33/§34/§40 — extended event details.
    const [context, setContext] = useState<EventContext | null>(null);
    const [contextLoading, setContextLoading] = useState(false);
    const [bookmarkReason, setBookmarkReason] = useState('');
    const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());
    const [noteDraft, setNoteDraft] = useState('');
    const [noteStatus, setNoteStatus] = useState<string | null>(null);

    // TIMELINE_PHASE2.md §4/§5/§6 — Entity Centric / Related Entity Timeline panel.
    const [entityFocus, setEntityFocus] = useState<{ type: string; id: string } | null>(null);
    const [entityFocusData, setEntityFocusData] = useState<EntityCentricTimeline | null>(null);
    const [entityFocusRelated, setEntityFocusRelated] = useState(false);
    const [entityFocusLoading, setEntityFocusLoading] = useState(false);

    // TIMELINE_PHASE3.md §5-10 — Activity Bursts tab.
    const [bursts, setBursts] = useState<ActivityBurst[]>([]);
    const [burstsLoading, setBurstsLoading] = useState(false);
    const [burstsError, setBurstsError] = useState<string | null>(null);
    const [burstWindow, setBurstWindow] = useState('6h');
    const [comparison, setComparison] = useState<TemporalComparison | null>(null);
    const [comparisonLoading, setComparisonLoading] = useState(false);
    const [selectedBurst, setSelectedBurst] = useState<ActivityBurst | null>(null);
    const [aiAnalysis, setAiAnalysis] = useState<TimelineAiAnalysis | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiQuestion, setAiQuestion] = useState('');
    const [draftStatus, setDraftStatus] = useState<string | null>(null);

    // TIMELINE_PHASE3.md §25/§26 — Trends tab.
    const [moduleTrends, setModuleTrends] = useState<ModuleTrend[]>([]);
    const [eventTypeTrends, setEventTypeTrends] = useState<EventTypeTrend[]>([]);
    const [trendsLoading, setTrendsLoading] = useState(false);
    const [trendsDays, setTrendsDays] = useState(7);

    const loadBursts = useCallback(() => {
        setBurstsLoading(true); setBurstsError(null);
        getActivityBursts({ window: burstWindow })
            .then((res) => setBursts(res.bursts))
            .catch((err: any) => setBurstsError(err?.message || 'Timeline unavailable.'))
            .finally(() => setBurstsLoading(false));
    }, [burstWindow]);
    useEffect(() => { if (topTab === 'activity') loadBursts(); }, [topTab, loadBursts]);

    const loadComparison = () => {
        setComparisonLoading(true);
        getTemporalComparison({ days: 7 }).then(setComparison).catch(() => setComparison(null)).finally(() => setComparisonLoading(false));
    };

    useEffect(() => {
        if (topTab !== 'trends') return;
        setTrendsLoading(true);
        Promise.all([getModuleActivityTrends(trendsDays), getEventTypeTrends(trendsDays)])
            .then(([m, e]) => { setModuleTrends(m.modules); setEventTypeTrends(e.eventTypes); })
            .catch(() => { setModuleTrends([]); setEventTypeTrends([]); })
            .finally(() => setTrendsLoading(false));
    }, [topTab, trendsDays]);

    // §56 ACTIVITY DETAIL — clicking a burst opens the SAME Correlated
    // Activity / AI Analysis machinery Phase 2's event details already use.
    const openBurstDetail = (burst: ActivityBurst) => {
        setSelectedBurst(burst); setAiAnalysis(null); setAiQuestion(''); setDraftStatus(null);
    };
    const runAiAnalysis = (burst: ActivityBurst, question?: string) => {
        setAiLoading(true);
        const params = burst.entity
            ? { from: burst.window.from, to: burst.window.to, window: burst.windowMinutes ? `${burst.windowMinutes}m` : undefined, question }
            : { from: burst.window.from, to: burst.window.to, question };
        analyzeTimelinePeriod(params).then(setAiAnalysis).catch(() => setAiAnalysis(null)).finally(() => setAiLoading(false));
    };
    const draftFromBurst = async (burst: ActivityBurst, kind: 'brief' | 'knowledge') => {
        setDraftStatus('Creating draft…');
        try {
            if (kind === 'brief') {
                const res = await createThreatBriefDraftFromTimeline({ from: burst.window.from, to: burst.window.to, skipAi: true });
                setDraftStatus(`Threat Brief draft created (#${res.id}) — review it in Threat Briefs.`);
            } else {
                const res = await createKnowledgeDraftFromTimeline({ from: burst.window.from, to: burst.window.to, title: `${burst.label || 'Activity'} — ${new Date(burst.window.from).toLocaleDateString()}` });
                setDraftStatus(`Knowledge draft created (#${res.id}) — review it in Knowledge Base.`);
            }
        } catch (err: any) {
            setDraftStatus(err?.message || 'Failed to create draft.');
        }
    };

    // §17 debounced search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const t = setTimeout(() => { setEntity((v) => (v === searchInput ? v : searchInput)); setPage(1); }, 300);
        return () => clearTimeout(t);
    }, [searchInput]);

    useEffect(() => { getTimelineMeta().then(setMeta).catch(() => { /* filters degrade gracefully without meta */ }); }, []);
    // §33 — load the analyst's own bookmark set once so cards can show a
    // filled/outline star without a per-card round trip.
    useEffect(() => { listTimelineBookmarks(1, 100).then((res) => setBookmarkedIds(new Set(res.items.map((b) => b.eventId)))).catch(() => { /* bookmarks are a convenience, never block the page */ }); }, []);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        const { from, to } = computeRange(dateRange, customFrom, customTo);
        getTimelineEvents({
            from, to,
            module: module !== 'all' ? module : undefined,
            entityType: entityTypeFilter,
            eventType: eventType || undefined,
            severity: severity !== 'all' ? severity : undefined,
            confidence: confidence !== 'all' ? confidence : undefined,
            search: entity || undefined,
            page, pageSize, order,
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err: any) => setError(err?.message || 'Timeline unavailable.'))
            .finally(() => setLoading(false));
    }, [dateRange, customFrom, customTo, module, entityTypeFilter, eventType, severity, confidence, entity, page, order]);
    useEffect(() => { load(); }, [load]);

    const applyPreset = (p: typeof FILTER_PRESETS[number]) => {
        setModule(p.module ?? 'all');
        setEntityTypeFilter(p.entityType);
        setPage(1);
    };
    // Highlight whichever preset (if any) exactly matches the current
    // module/entityType combination — computed, never a separate source of
    // truth that could drift from the real filters actually applied.
    const activePresetId = useMemo(
        () => FILTER_PRESETS.find((p) => (p.module ?? 'all') === module && p.entityType === entityTypeFilter)?.id ?? null,
        [module, entityTypeFilter]
    );

    // §23 EVENT GROUPING — visual grouping by day, never altering timestamps.
    const grouped = useMemo(() => {
        const groups: { day: string; events: TimelineEvent[] }[] = [];
        for (const ev of items) {
            const day = dayLabel(ev.timestamp);
            const last = groups[groups.length - 1];
            if (last && last.day === day) last.events.push(ev);
            else groups.push({ day, events: [ev] });
        }
        return groups;
    }, [items]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = dateRange === 'all' && module === 'all' && !eventType && severity === 'all' && confidence === 'all' && !entity;

    const setFilter = <T,>(setter: (v: T) => void) => (v: T) => { setter(v); setPage(1); };

    // §13/§14 Source / Entity navigation — reuse existing routes only.
    const viewEntity = (ev: TimelineEvent) => {
        if (ev.entity_type === 'case') { onOpenCase?.(Number(ev.entity_id)); return; }
        if (ev.entity_type === 'knowledge_entry') { onOpenKnowledgeEntry?.(Number(ev.entity_id)); return; }
        const view = ENTITY_TYPE_VIEW[ev.entity_type];
        if (view) onNavigate?.(view);
    };

    // TIMELINE_PHASE2.md §21/§26 — open Event Details AND fetch its
    // Correlation Context (before/after, related events, shared context,
    // evidence) in the same action; the original event card never blocks on
    // this (§26 "the original source event remains authoritative").
    const openDetails = (ev: TimelineEvent) => {
        setSelected(ev); setContext(null); setBookmarkReason(''); setNoteDraft(''); setNoteStatus(null);
        setContextLoading(true);
        getEventContext(ev.id).then(setContext).catch(() => setContext(null)).finally(() => setContextLoading(false));
    };

    const toggleBookmark = async (ev: TimelineEvent) => {
        if (bookmarkedIds.has(ev.id)) {
            const existing = await listTimelineBookmarks(1, 100).catch(() => null);
            const row = existing?.items.find((b) => b.eventId === ev.id);
            if (row) await removeTimelineBookmark(row.id).catch(() => {});
            setBookmarkedIds((prev) => { const next = new Set(prev); next.delete(ev.id); return next; });
        } else {
            await addTimelineBookmark(ev.id, bookmarkReason || undefined).catch(() => {});
            setBookmarkedIds((prev) => new Set(prev).add(ev.id));
        }
    };

    const submitNote = async (ev: TimelineEvent) => {
        if (!noteDraft.trim()) return;
        setNoteStatus('Saving…');
        try {
            await addTimelineNote(ev.entity_type, ev.entity_id, noteDraft.trim());
            setNoteStatus('Note added.');
            setNoteDraft('');
        } catch (err: any) {
            setNoteStatus(err?.message || 'Failed to add note.');
        }
    };

    // §4/§5/§6 — Entity Centric / Related Entity Timeline panel.
    const openEntityFocus = (type: string, id: string, related = false) => {
        setEntityFocus({ type, id }); setEntityFocusRelated(related); setEntityFocusData(null); setEntityFocusLoading(true);
        getEntityTimeline(type, id, { related, pageSize: 20 }).then(setEntityFocusData).catch(() => setEntityFocusData(null)).finally(() => setEntityFocusLoading(false));
    };

    return (
        <div className="ti-page timeline-page">
            <div className="ti-header">
                <h1>Timeline</h1>
                <p className="ti-subtitle">The unified chronological view of existing LekirraX intelligence events — a correlation layer, never a second event store.</p>
            </div>

            {/* TIMELINE_PHASE3.md §51 UI — Timeline / Activity / Trends. */}
            <div className="timeline-top-tabs">
                <button className={`timeline-top-tab${topTab === 'timeline' ? ' active' : ''}`} onClick={() => setTopTab('timeline')}>Timeline</button>
                <button className={`timeline-top-tab${topTab === 'activity' ? ' active' : ''}`} onClick={() => setTopTab('activity')}>Activity</button>
                <button className={`timeline-top-tab${topTab === 'trends' ? ' active' : ''}`} onClick={() => setTopTab('trends')}>Trends</button>
            </div>

            {topTab === 'timeline' && (
            <div className="ti-container">
                <div className="ti-content">
                    <div className="ti-card">
                        <div className="ti-section-header">
                            <span className="ti-card-title">Timeline</span>
                            <div className="ti-row-actions">
                                <button className="ti-action-btn timeline-filter-toggle" onClick={() => setFiltersOpen((v) => !v)}>{filtersOpen ? 'Hide Filters' : 'Show Filters'}</button>
                                {/* NOTES_PHASE3.md §4 "REMAINING NAVIGATION GAP" — a page-level deep
                                    link; the analyst can pick the "Timeline" context filter on the
                                    Notes page itself for Timeline-sourced notes. */}
                                <button className="ti-action-btn" onClick={() => onNavigate?.('notes')}>View Notes</button>
                                <button className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                            </div>
                        </div>

                        {/* TIMELINE_PHASE2.md §36 FILTER PRESETS */}
                        <div className="timeline-presets">
                            {FILTER_PRESETS.map((p) => (
                                <button
                                    key={p.id}
                                    className={`timeline-preset-btn${activePresetId === p.id ? ' active' : ''}`}
                                    onClick={() => applyPreset(p)}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>

                        {/* §15 GLOBAL FILTERS / §38 RESPONSIVE — collapsible on mobile. */}
                        {filtersOpen && (
                            <div className="ti-filters timeline-filters">
                                <select value={dateRange} onChange={(e) => setFilter(setDateRange)(e.target.value as DateRangeId)}>
                                    {DATE_RANGES.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                                </select>
                                {dateRange === 'custom' && (
                                    <>
                                        <input type="datetime-local" value={customFrom} onChange={(e) => setFilter(setCustomFrom)(e.target.value)} />
                                        <input type="datetime-local" value={customTo} onChange={(e) => setFilter(setCustomTo)(e.target.value)} />
                                    </>
                                )}
                                <select value={module} onChange={(e) => setFilter(setModule)(e.target.value)}>
                                    <option value="all">All Sources</option>
                                    {(meta?.modules || []).map((m) => <option key={m} value={m}>{m}</option>)}
                                </select>
                                <input type="text" placeholder="Event Type (e.g. status_changed)" value={eventType} onChange={(e) => setFilter(setEventType)(e.target.value)} />
                                <select value={severity} onChange={(e) => setFilter(setSeverity)(e.target.value)}>
                                    <option value="all">All Severity</option>
                                    {(meta?.severities || ['Low', 'Medium', 'High', 'Critical']).map((s) => <option key={s} value={s}>{s}</option>)}
                                </select>
                                <select value={confidence} onChange={(e) => setFilter(setConfidence)(e.target.value)}>
                                    <option value="all">All Confidence</option>
                                    {(meta?.confidences || ['High', 'Medium', 'Low', 'Unknown']).map((c) => <option key={c} value={c}>{c}</option>)}
                                </select>
                                <select value={order} onChange={(e) => setOrder(e.target.value as 'desc' | 'asc')}>
                                    <option value="desc">Newest First</option>
                                    <option value="asc">Oldest First</option>
                                </select>
                                <input type="text" placeholder="Search title, description, entity, event type, module…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
                            </div>
                        )}

                        {/* §25 ERROR STATE */}
                        {error ? (
                            <div className="ti-error">{error}<button className="ti-retry-btn" onClick={load}>Retry</button></div>
                        ) : loading ? (
                            // §26 LOADING STATE
                            <div className="ti-loading">Loading timeline…</div>
                        ) : items.length === 0 ? (
                            // §24 EMPTY STATE
                            <div className="ti-empty">{filtersAreDefault ? 'No timeline events found.' : 'No timeline events match these filters.'}</div>
                        ) : (
                            <>
                                <div className="timeline-groups">
                                    {grouped.map((g) => (
                                        <div key={g.day} className="timeline-day-group">
                                            <div className="timeline-day-heading">{g.day}</div>
                                            <div className="case-timeline">
                                                {g.events.map((ev) => (
                                                    <div key={ev.id} className="case-timeline-row timeline-event-row">
                                                        <div className="case-timeline-dot" />
                                                        <div className="case-timeline-content timeline-event-card">
                                                            <div className="timeline-event-head">
                                                                <span className="case-timeline-time">{formatDateTime(ev.timestamp)}</span>
                                                                {ev.severity && <span className={`ti-badge ti-badge--${ev.severity.toLowerCase()}`}>{ev.severity}</span>}
                                                                {ev.confidence && <span className="ti-chip">{ev.confidence} confidence</span>}
                                                            </div>
                                                            <div className="case-timeline-action">{ev.event_type}</div>
                                                            <div className="timeline-event-title">{ev.title}</div>
                                                            <div className="timeline-event-meta">
                                                                <span className="ti-chip">{ev.source_module}</span>
                                                                {ev.entity_label && <span className="ti-target">{ev.entity_label}</span>}
                                                                {ev.actor && <span>by {ev.actor}</span>}
                                                                <span>{timeAgo(ev.timestamp)}</span>
                                                            </div>
                                                            <div className="ti-row-actions">
                                                                <button className="ti-action-btn" onClick={() => openDetails(ev)}>View Details</button>
                                                                {(ENTITY_TYPE_VIEW[ev.entity_type] || ev.entity_type === 'case' || ev.entity_type === 'knowledge_entry') && (
                                                                    <button className="ti-action-btn" onClick={() => viewEntity(ev)}>View Entity</button>
                                                                )}
                                                                {/* §4/§5 Entity Centric Timeline — temporal context, not a duplicate profile. */}
                                                                <button className="ti-action-btn" onClick={() => openEntityFocus(ev.entity_type, ev.entity_id)}>Entity Timeline</button>
                                                                {/* §33 Bookmarks */}
                                                                <button className="ti-action-btn" title="Bookmark this event" onClick={() => toggleBookmark(ev)}>{bookmarkedIds.has(ev.id) ? '★ Bookmarked' : '☆ Bookmark'}</button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                            </>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* TIMELINE_PHASE3.md §5-10/§22-23 ACTIVITY TAB — Activity Bursts + Timeline Comparison. */}
            {topTab === 'activity' && (
            <div className="ti-container">
                <div className="ti-content">
                    <div className="ti-card">
                        <div className="ti-section-header">
                            <span className="ti-card-title">Activity Bursts</span>
                            <div className="ti-row-actions">
                                <select value={burstWindow} onChange={(e) => setBurstWindow(e.target.value)}>
                                    <option value="1h">Last 1 Hour</option>
                                    <option value="6h">Last 6 Hours</option>
                                    <option value="24h">Last 24 Hours</option>
                                </select>
                                <button className="ti-refresh-btn" onClick={loadBursts} disabled={burstsLoading}>{burstsLoading ? 'Loading…' : 'Refresh'}</button>
                            </div>
                        </div>
                        {burstsError ? (
                            <div className="ti-error">{burstsError}<button className="ti-retry-btn" onClick={loadBursts}>Retry</button></div>
                        ) : burstsLoading ? (
                            <div className="ti-loading">Detecting activity bursts…</div>
                        ) : bursts.length === 0 ? (
                            <div className="ti-empty">No activity bursts detected in this window.</div>
                        ) : (
                            <div className="timeline-burst-grid">
                                {bursts.map((b, i) => (
                                    <div key={i} className="timeline-burst-card">
                                        <div className="timeline-burst-head">
                                            <span className={`ti-badge ti-badge--${b.activityConfidence.toLowerCase()}`}>{b.activityConfidence} Activity</span>
                                            <span className="ti-chip">Threat Significance: {b.threatSignificance}</span>
                                        </div>
                                        <div className="timeline-burst-title">{b.label || b.type}</div>
                                        <div className="timeline-burst-stats">
                                            <span><strong>{b.current}</strong> events</span>
                                            <span>Baseline: <strong>{b.baseline}</strong></span>
                                            <span>Increase: <strong>{b.ratio}x</strong></span>
                                        </div>
                                        <button className="ti-action-btn" onClick={() => openBurstDetail(b)}>View Activity</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* §22/§23/§54 TEMPORAL COMPARISON */}
                    <div className="ti-card">
                        <div className="ti-section-header">
                            <span className="ti-card-title">Timeline Comparison</span>
                            <button className="ti-action-btn" onClick={loadComparison} disabled={comparisonLoading}>{comparisonLoading ? 'Comparing…' : 'Compare Last 7 Days vs Previous 7 Days'}</button>
                        </div>
                        {comparison && (
                            <div className="timeline-comparison-grid">
                                <div className="timeline-comparison-col">
                                    <div className="ti-modal-subtitle">Current Period</div>
                                    <div className="timeline-comparison-big">{comparison.currentPeriod.events}</div>
                                    <div className="timeline-context-time">events</div>
                                </div>
                                <div className="timeline-comparison-col">
                                    <div className="ti-modal-subtitle">Previous Period</div>
                                    <div className="timeline-comparison-big">{comparison.previousPeriod.events}</div>
                                    <div className="timeline-context-time">events</div>
                                </div>
                                <div className="timeline-comparison-col">
                                    <div className="ti-modal-subtitle">Change</div>
                                    <div className="timeline-comparison-big">{comparison.change.events! >= 0 ? '+' : ''}{comparison.change.events}</div>
                                    <div className="timeline-context-time">{comparison.changePct.events != null ? `${comparison.changePct.events! >= 0 ? '+' : ''}${comparison.changePct.events}%` : '—'} (descriptive only, not a threat level)</div>
                                </div>
                                <div className="timeline-comparison-col">
                                    <div className="ti-modal-subtitle">High Severity</div>
                                    <div className="timeline-comparison-big">{comparison.currentPeriod.highSeverity} <span className="timeline-context-time">vs {comparison.previousPeriod.highSeverity}</span></div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* TIMELINE_PHASE3.md §25/§26 TRENDS TAB */}
            {topTab === 'trends' && (
            <div className="ti-container">
                <div className="ti-content">
                    <div className="ti-card">
                        <div className="ti-section-header">
                            <span className="ti-card-title">Module Activity Trends</span>
                            <select value={trendsDays} onChange={(e) => setTrendsDays(Number(e.target.value))}>
                                <option value={7}>Last 7 Days</option>
                                <option value={30}>Last 30 Days</option>
                                <option value={90}>Last 90 Days</option>
                            </select>
                        </div>
                        {trendsLoading ? <div className="ti-loading">Loading trends…</div> : moduleTrends.length === 0 ? <div className="ti-empty">No activity in this window.</div> : (
                            <div className="timeline-trend-bars">
                                {moduleTrends.map((m) => (
                                    <div key={m.module} className="timeline-trend-row">
                                        <span className="timeline-trend-label">{m.module}</span>
                                        <div className="timeline-trend-bar-track"><div className="timeline-trend-bar-fill" style={{ width: `${Math.min(100, (m.count / moduleTrends[0].count) * 100)}%` }} /></div>
                                        <span className="timeline-trend-count">{m.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="ti-card">
                        <div className="ti-section-header"><span className="ti-card-title">Event Type Trends</span></div>
                        {trendsLoading ? <div className="ti-loading">Loading trends…</div> : eventTypeTrends.length === 0 ? <div className="ti-empty">No activity in this window.</div> : (
                            <div className="timeline-trend-bars">
                                {eventTypeTrends.map((e) => (
                                    <div key={e.eventType} className="timeline-trend-row">
                                        <span className="timeline-trend-label">{e.eventType}</span>
                                        <div className="timeline-trend-bar-track"><div className="timeline-trend-bar-fill" style={{ width: `${Math.min(100, (e.count / eventTypeTrends[0].count) * 100)}%` }} /></div>
                                        <span className="timeline-trend-count">{e.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
            )}

            {/* §56 ACTIVITY DETAIL — reuses Phase 2 correlation/AI, never a duplicate view. */}
            {selectedBurst && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Activity detail" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedBurst(null); }}>
                    <div className="ti-modal" style={{ width: '620px', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div className="ti-modal-header"><h2>{selectedBurst.label || selectedBurst.type}</h2><button className="ti-modal-close" onClick={() => setSelectedBurst(null)}>×</button></div>
                        <div className="ti-modal-body">
                            {/* §57 ACTIVITY EXPLANATION — never hide the calculation. */}
                            <div className="ti-kv">
                                <span className="k">Current</span><span className="v">{selectedBurst.current} events</span>
                                <span className="k">Baseline</span><span className="v">{selectedBurst.baseline}</span>
                                <span className="k">Increase</span><span className="v">{selectedBurst.ratio}x</span>
                                <span className="k">Time Range</span><span className="v">{formatDateTime(selectedBurst.window.from)} – {formatDateTime(selectedBurst.window.to)}</span>
                                <span className="k">Activity Confidence</span><span className="v">{selectedBurst.activityConfidence}</span>
                                <span className="k">Threat Significance</span><span className="v">{selectedBurst.threatSignificance} (kept separate from activity volume)</span>
                            </div>

                            <div className="timeline-context-section" style={{ marginTop: '14px' }}>
                                <div className="ti-modal-subtitle">AI Timeline Analyst</div>
                                <div className="ti-row-actions">
                                    <input type="text" placeholder="Ask a question (optional) — e.g. Why was this period unusually active?" value={aiQuestion} onChange={(e) => setAiQuestion(e.target.value)} style={{ flex: 1 }} />
                                    <button className="ti-action-btn" onClick={() => runAiAnalysis(selectedBurst, aiQuestion || undefined)} disabled={aiLoading}>{aiLoading ? 'Analyzing…' : 'Analyze Timeline'}</button>
                                </div>
                                {aiAnalysis && (
                                    <div className="timeline-ai-result">
                                        <p>{aiAnalysis.summary}</p>
                                        {aiAnalysis.observed.length > 0 && <><div className="ti-modal-subtitle">Observed</div><ul className="timeline-context-list">{aiAnalysis.observed.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                                        {aiAnalysis.correlated.length > 0 && <><div className="ti-modal-subtitle">Correlated</div><ul className="timeline-context-list">{aiAnalysis.correlated.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                                        {aiAnalysis.inferred.length > 0 && <><div className="ti-modal-subtitle">Inferred</div><ul className="timeline-context-list">{aiAnalysis.inferred.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                                        {aiAnalysis.unknown.length > 0 && <><div className="ti-modal-subtitle">Unknown</div><ul className="timeline-context-list">{aiAnalysis.unknown.map((o, i) => <li key={i}>{o}</li>)}</ul></>}
                                        {aiAnalysis.note && <div className="timeline-context-time">{aiAnalysis.note}</div>}
                                    </div>
                                )}
                            </div>

                            <div className="timeline-context-section">
                                <div className="ti-modal-subtitle">Create Draft From This Activity</div>
                                <div className="ti-row-actions">
                                    <button className="ti-action-btn" onClick={() => draftFromBurst(selectedBurst, 'brief')}>Create Threat Brief Draft</button>
                                    <button className="ti-action-btn" onClick={() => draftFromBurst(selectedBurst, 'knowledge')}>Create Knowledge Draft</button>
                                </div>
                                {draftStatus && <div className="timeline-context-time">{draftStatus}</div>}
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* §12 EVENT DETAILS + TIMELINE_PHASE2.md §21/§22/§26/§33/§34/§40 extension */}
            {selected && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Event details" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }}>
                    <div className="ti-modal" style={{ width: '620px', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div className="ti-modal-header"><h2>{selected.event_type}</h2><button className="ti-modal-close" onClick={() => setSelected(null)}>×</button></div>
                        <div className="ti-modal-body">
                            <div className="ti-kv">
                                <span className="k">Timestamp</span><span className="v">{formatDateTime(selected.timestamp)}</span>
                                <span className="k">Source</span><span className="v">{selected.source_module}</span>
                                <span className="k">Entity</span><span className="v">{selected.entity_label ?? `${selected.entity_type} #${selected.entity_id}`}</span>
                                {selected.severity && (<><span className="k">Severity</span><span className="v">{selected.severity}</span></>)}
                                {selected.confidence && (<><span className="k">Confidence</span><span className="v">{selected.confidence}</span></>)}
                                {selected.actor && (<><span className="k">Actor</span><span className="v">{selected.actor}</span></>)}
                                <span className="k">Original Module</span><span className="v">{selected.provenance.source_module} ({selected.provenance.original_entity_type} #{selected.provenance.original_event_id})</span>
                            </div>
                            {selected.description && <div style={{ marginTop: '12px' }}><div className="ti-modal-subtitle">Description</div><div className="ti-note">{selected.description}</div></div>}
                            <div className="ti-row-actions" style={{ marginTop: '14px' }}>
                                {(ENTITY_TYPE_VIEW[selected.entity_type] || selected.entity_type === 'case' || selected.entity_type === 'knowledge_entry') && (
                                    <button className="ti-action-btn" onClick={() => { viewEntity(selected); setSelected(null); }}>View Source</button>
                                )}
                                <button className="ti-action-btn" onClick={() => openEntityFocus(selected.entity_type, selected.entity_id)}>Entity Timeline</button>
                                <button className="ti-action-btn" onClick={() => setSelected(null)}>Close</button>
                            </div>

                            {contextLoading ? (
                                <div className="ti-loading" style={{ marginTop: '16px' }}>Loading correlation context…</div>
                            ) : context ? (
                                <div className="timeline-context">
                                    {/* §21 BEFORE / AFTER CONTEXT */}
                                    {(context.before.length > 0 || context.after.length > 0) && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Before / After (temporal context, not causal proof)</div>
                                            {context.before.length > 0 && (
                                                <div><span className="k">Before</span>
                                                    <ul className="timeline-context-list">
                                                        {context.before.map((e) => <li key={e.id}><button className="timeline-inline-link" onClick={() => openDetails(e)}>{e.event_type} — {e.entity_label ?? e.entity_id}</button> <span className="timeline-context-time">{timeAgo(e.timestamp)}</span></li>)}
                                                    </ul>
                                                </div>
                                            )}
                                            {context.after.length > 0 && (
                                                <div><span className="k">After</span>
                                                    <ul className="timeline-context-list">
                                                        {context.after.map((e) => <li key={e.id}><button className="timeline-inline-link" onClick={() => openDetails(e)}>{e.event_type} — {e.entity_label ?? e.entity_id}</button> <span className="timeline-context-time">{timeAgo(e.timestamp)}</span></li>)}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* §22 EVENT IMPACT CONTEXT — only ever a real before/after value. */}
                                    {context.impact && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Impact</div>
                                            <div className="ti-note">{context.impact.before ?? '—'} → {context.impact.after ?? '—'}</div>
                                        </div>
                                    )}

                                    {/* §25/§26 CORRELATION CONTEXT / RELATED EVENTS / SHARED ENTITIES */}
                                    {context.correlation.relatedEvents.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Events (Activity Window {formatDateTime(context.correlation.activityWindow.from)} – {formatDateTime(context.correlation.activityWindow.to)})</div>
                                            <ul className="timeline-context-list">
                                                {context.correlation.relatedEvents.map((e) => (
                                                    <li key={e.id}>
                                                        <button className="timeline-inline-link" onClick={() => openDetails(e)}>{e.event_type} — {e.entity_label ?? e.entity_id}</button>{' '}
                                                        <span className={`ti-chip timeline-confidence-${e.correlation.confidence.toLowerCase()}`}>{e.correlation.label ?? e.correlation.confidence}</span>{' '}
                                                        <span className="timeline-context-time">Related because: {e.correlation.reasons.join(', ')}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                            {(context.correlation.sharedContext.iocs.length > 0 || context.correlation.sharedContext.campaigns.length > 0) && (
                                                <div className="timeline-shared-context">
                                                    {context.correlation.sharedContext.iocs.map((i) => <span key={`ioc-${i.id}`} className="ti-chip">Shared IOC: {i.label}</span>)}
                                                    {context.correlation.sharedContext.campaigns.map((c) => <span key={`camp-${c.id}`} className="ti-chip">Shared Campaign: {c.label}</span>)}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* §40 EVIDENCE CONTEXT */}
                                    {context.evidence.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Evidence</div>
                                            <ul className="timeline-context-list">
                                                {context.evidence.map((ev) => <li key={ev.id}>{ev.source}{ev.description ? ` — ${ev.description}` : ''}{ev.confidence ? ` (${ev.confidence} confidence)` : ''}</li>)}
                                            </ul>
                                        </div>
                                    )}

                                    {/* §33 BOOKMARK */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Bookmark</div>
                                        <div className="ti-row-actions">
                                            <input type="text" placeholder="Reason (e.g. Important campaign development)" value={bookmarkReason} onChange={(e) => setBookmarkReason(e.target.value)} style={{ flex: 1 }} />
                                            <button className="ti-action-btn" onClick={() => toggleBookmark(selected)}>{bookmarkedIds.has(selected.id) ? 'Remove Bookmark' : 'Bookmark'}</button>
                                        </div>
                                    </div>

                                    {/* §34 TIMELINE NOTES */}
                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Add Timeline Note</div>
                                        <div className="ti-row-actions">
                                            <input type="text" placeholder="Note…" value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} style={{ flex: 1 }} />
                                            <button className="ti-action-btn" onClick={() => submitNote(selected)}>Add Note</button>
                                        </div>
                                        {noteStatus && <div className="timeline-context-time">{noteStatus}</div>}
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* TIMELINE_PHASE2.md §4/§5/§6 ENTITY CENTRIC / RELATED ENTITY TIMELINE */}
            {entityFocus && createPortal(
                <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Entity timeline" onMouseDown={(e) => { if (e.target === e.currentTarget) setEntityFocus(null); }}>
                    <div className="ti-modal" style={{ width: '620px', maxHeight: '86vh', overflowY: 'auto' }}>
                        <div className="ti-modal-header">
                            <h2>{entityFocusData?.entity.label ?? `${entityFocus.type} #${entityFocus.id}`}</h2>
                            <button className="ti-modal-close" onClick={() => setEntityFocus(null)}>×</button>
                        </div>
                        <div className="ti-modal-body">
                            {entityFocusLoading ? (
                                <div className="ti-loading">Loading entity timeline…</div>
                            ) : entityFocusData ? (
                                <>
                                    <div className="ti-kv">
                                        <span className="k">Entity Type</span><span className="v">{entityFocus.type}</span>
                                        {entityFocusData.currentRisk && (<><span className="k">Current Risk</span><span className="v">{entityFocusData.currentRisk}</span></>)}
                                        <span className="k">Events</span><span className="v">{entityFocusData.timeline.total}</span>
                                    </div>

                                    {entityFocusData.relatedEntities.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Related Entities</div>
                                            <div className="timeline-shared-context">
                                                {entityFocusData.relatedEntities.map((r) => (
                                                    <button key={`${r.type}:${r.id}`} className="ti-chip timeline-inline-link" onClick={() => openEntityFocus(r.type, r.id)}>{r.label}</button>
                                                ))}
                                            </div>
                                            <div className="ti-row-actions" style={{ marginTop: '8px' }}>
                                                <button className="ti-action-btn" onClick={() => openEntityFocus(entityFocus.type, entityFocus.id, !entityFocusRelated)}>
                                                    {entityFocusRelated ? 'Show This Entity Only' : 'Include Related Entities’ Events'}
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {entityFocusData.majorChanges.length > 0 && (
                                        <div className="timeline-context-section">
                                            <div className="ti-modal-subtitle">Major Changes</div>
                                            <ul className="timeline-context-list">
                                                {entityFocusData.majorChanges.map((e) => <li key={e.id}>{e.description} <span className="timeline-context-time">{timeAgo(e.timestamp)}</span></li>)}
                                            </ul>
                                        </div>
                                    )}

                                    <div className="timeline-context-section">
                                        <div className="ti-modal-subtitle">Timeline</div>
                                        <ul className="timeline-context-list">
                                            {entityFocusData.timeline.items.map((e) => (
                                                <li key={e.id}>
                                                    <button className="timeline-inline-link" onClick={() => openDetails(e)}>{e.event_type}</button>
                                                    {e.entity_id !== entityFocus.id && <span className="ti-chip">{e.entity_label ?? e.entity_id}</span>}
                                                    <span className="timeline-context-time">{formatDateTime(e.timestamp)}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                </>
                            ) : (
                                <div className="ti-empty">No timeline events found.</div>
                            )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default TimelinePage;
