// THREAT_SUMMARY_PHASE1.md — replaces the former "Threat Summary is planned
// for a future update and isn't available yet." placeholder with a real,
// structured operational threat overview. §2 "CORE DISTINCTION" — this is a
// dashboard, not a chatbot (Ask AI) and not a publication (Threat Briefs).
// Reuses ThreatIntelligence's existing ti-* visual system (RiskBadge,
// EntityChip, ti-kpi-card, ti-bar-*) — the same established convention
// every other module page already follows (AskAIPage.tsx's own comment).
// §56 "AI" — this page has ZERO dependency on Ask AI or any LLM call.
import React, { useCallback, useEffect, useState } from 'react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
// Premium visual redesign layer, scoped to `.ts-dashboard` only — see the
// file header comment in ThreatSummaryPage.css for why this doesn't touch
// (or risk) the other 15 pages that share ThreatIntelligencePage.css.
import './ThreatSummaryPage.css';
import {
    ShieldAlert, ShieldHalf, TriangleAlert, FileClock, Target, Search, RefreshCw, Sparkles,
    CalendarClock, Radar, Globe2, Bug, Users, Flag, Building2, BellRing, Cpu, ArrowRight, ChevronDown,
} from 'lucide-react';
import { RiskBadge, formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import {
    getThreatSummary, searchThreatSummary, getThreatCorrelations, getThreatTrends,
    type ThreatSummaryData, type ThreatSummaryWindow, type PriorityThreatItem,
    type ThreatCorrelationsData, type ThreatTrendsData, type ThreatTrendPoint, type TopActiveEntity,
    // THREAT_SUMMARY_PHASE3.md — AI Threat Analyst, Executive Summary, Explainable Prioritization & Forecasting.
    getAiStatus, analyzeThreatSummary, getThreatSummaryAssessment, getThreatSummaryForecast,
    getThreatSummaryRecommendations, approveAiRecommendation,
    type AiAnalyzeResponse, type AiAssessmentData, type ThreatForecast, type AiRecommendation, type AiActionPreview,
} from '../../services/api';

// THREAT_SUMMARY_PHASE2.md §10 "ENTITY LEVEL DEEP LINKING" — these entity
// types open the EXACT entity (via onOpenEntity); anything else (alerts,
// monitoring) falls back to section-level navigation (onNavigate) same as Phase 1.
const REAL_ENTITY_TYPES = new Set(['ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability']);

// §28 "ENTITY DRILL DOWN" / §27 "DRILL DOWN" — the SAME module→View mapping
// AskAIPage.tsx's own SOURCE_LABEL_TO_VIEW already established for its
// citations; reused here verbatim rather than inventing a second one.
const MODULE_TO_VIEW: Record<string, string> = {
    ioc: 'ti-iocs', campaign: 'ti-campaigns', threat_actor: 'ti-actors', malware: 'ti-malware',
    vulnerability: 'ti-vulnerabilities', brand: 'osint-brand-intel', alerts: 'mon-alert-center',
    monitoring: 'mon-alert-center', monitor_event: 'mon-alert-center', alert: 'mon-alert-center',
};
function viewForItem(sourceModule: string): string { return MODULE_TO_VIEW[sourceModule] || 'ti-overview'; }

const WINDOW_LABELS: Record<ThreatSummaryWindow, string> = { '24h': '24H', '7d': '7D', '30d': '30D' };

// §49 "METRIC DEFINITIONS" — every metric shown gets real, non-ambiguous help
// text. Only "High Risk" remains: the other entries backed the now-removed
// 7-tile ThreatMetricsSection, whose numbers were redundant with Alert
// Summary / Monitoring Summary / the per-module summary cards / Activity
// Trends (which shows the same categories WITH previous + % change).
const METRIC_DEFINITIONS: Record<string, string> = {
    'High Risk': 'Entities (IOCs, Malware, Campaigns, Vulnerabilities) whose OWN stored risk/severity field is Critical or High.',
};

// ── Premium redesign presentation helpers — none of these compute or
// invent intelligence; they only classify/format text the real API
// already returned (severity keywords, IPs, CVE ids) for colour-coding. ──
const SEVERITY_RANK: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
    critical: 'critical', high: 'high', medium: 'medium', low: 'low',
};
/** Finds the first severity WORD mentioned in a real AI/heuristic string
 * (e.g. "93.152.220.87: New IOC (Critical)") — used only to colour a dot
 * or icon; never used to alter or infer a severity that isn't stated. */
function detectSeverity(text: string): 'critical' | 'high' | 'medium' | 'low' | null {
    const m = text.match(/\b(critical|high|medium|low)\b/i);
    return m ? SEVERITY_RANK[m[1].toLowerCase()] : null;
}
const CVE_RE = /\bCVE-\d{4}-\d{4,}\b/i;
const IP_RE = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
/** Picks a representative icon for a real entity/development string based
 * on its own shape (an IP, a CVE, otherwise a generic threat icon). */
function iconForEntity(text: string) {
    if (IP_RE.test(text)) return Globe2;
    if (CVE_RE.test(text)) return Bug;
    return ShieldAlert;
}
/** Colour-highlights IPs, CVE ids and severity words inside a real,
 * already-generated AI/heuristic sentence — pure presentation over text
 * the API returned, never a rewrite of its content. */
function highlightSummaryText(text: string): React.ReactNode {
    const pattern = /((?:\d{1,3}\.){3}\d{1,3})|(\bCVE-\d{4}-\d{4,}\b)|\((Critical|High|Medium|Low)\)|\b(unresolved conflicts?)\b/gi;
    const nodes: React.ReactNode[] = [];
    let last = 0; let m: RegExpExecArray | null; let key = 0;
    while ((m = pattern.exec(text))) {
        if (m.index > last) nodes.push(text.slice(last, m.index));
        if (m[1]) nodes.push(<span key={key++} className="ts-hl-ip">{m[1]}</span>);
        else if (m[2]) nodes.push(<span key={key++} className="ts-hl-cve">{m[2]}</span>);
        else if (m[3]) nodes.push(<>(<span key={key++} className={`ts-hl-${m[3].toLowerCase()}`}>{m[3]}</span>)</>);
        else if (m[4]) nodes.push(<span key={key++} className="ts-hl-conflict">{m[4]}</span>);
        last = pattern.lastIndex;
    }
    if (last < text.length) nodes.push(text.slice(last));
    return nodes;
}
const CATEGORY_META: Record<string, { icon: React.ComponentType<{ size?: number | string }>; color: string }> = {
    APT: { icon: Users, color: '#a78bfa' },
    Malware: { icon: Bug, color: '#ff3366' },
    Campaign: { icon: Flag, color: '#fb923c' },
    IOC: { icon: Globe2, color: '#00e5ff' },
    Brand: { icon: Building2, color: '#f472b6' },
    Vulnerability: { icon: ShieldAlert, color: '#eab308' },
    Monitoring: { icon: Radar, color: '#38bdf8' },
    Alerts: { icon: BellRing, color: '#2dd4bf' },
};

interface ThreatSummaryPageProps {
    onNavigate?: (view: string) => void;
    // THREAT_SUMMARY_PHASE2.md §10 "ENTITY LEVEL DEEP LINKING" — opens the
    // EXACT real entity (App.tsx re-derives its own authorization; §58 "Do
    // not trust a frontend entity ID" is enforced server-side regardless).
    onOpenEntity?: (entityType: string, entityId: string) => void;
}

const ThreatSummaryPage: React.FC<ThreatSummaryPageProps> = ({ onNavigate, onOpenEntity }) => {
    const [windowPreset, setWindowPreset] = useState<ThreatSummaryWindow>('24h');
    const [severity, setSeverity] = useState('all');
    const [risk, setRisk] = useState('all');
    const [module, setModule] = useState('all');
    const [data, setData] = useState<ThreatSummaryData | null>(null);
    const [correlations, setCorrelations] = useState<ThreatCorrelationsData | null>(null);
    const [trends, setTrends] = useState<ThreatTrendsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [q, setQ] = useState('');
    const [searchResults, setSearchResults] = useState<{ type: string; id: string; label: string; meta: string | null }[] | null>(null);
    const [searching, setSearching] = useState(false);

    // THREAT_SUMMARY_PHASE3.md §58 "AI MODEL STATUS" / §54-56 "FRESHNESS,
    // REGENERATION" — the AI section loads INDEPENDENTLY of the deterministic
    // dashboard above (§58 "if unavailable, Threat Summary deterministic
    // features continue working" — a slow/failed AI call must never block
    // or fail the rest of the page).
    const [aiAvailable, setAiAvailable] = useState<boolean | null>(null);
    const [analysis, setAnalysis] = useState<AiAnalyzeResponse | null>(null);
    const [assessment, setAssessment] = useState<AiAssessmentData | null>(null);
    const [forecast, setForecast] = useState<ThreatForecast | null>(null);
    const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [summaryView, setSummaryView] = useState<'executive' | 'analyst'>('executive');

    // Density pass — the deep-dive sections (trends/correlation, per-module
    // summaries, data coverage) are collapsed by default so the default
    // scroll ends at the "quick glance" content above them; nothing here
    // removes data, it only changes what's expanded on load.
    const [trendsOpen, setTrendsOpen] = useState(false);
    const [modulesOpen, setModulesOpen] = useState(false);
    // The hero "Unresolved Conflicts" card scrolls to Open Conflicts, which
    // now lives inside the collapsible Trends & Correlation section — open
    // it first, then scroll once it's actually in the DOM.
    const openConflicts = () => { setTrendsOpen(true); setTimeout(() => scrollToId('ts-conflicts-section'), 60); };

    const load = useCallback(() => {
        setLoading(true); setError(null);
        const params = { window: windowPreset, severity: severity === 'all' ? undefined : severity, risk: risk === 'all' ? undefined : risk, module: module === 'all' ? undefined : module };
        Promise.all([getThreatSummary(params), getThreatCorrelations({ window: windowPreset, module: params.module }), getThreatTrends({ window: windowPreset })])
            .then(([s, c, t]) => { setData(s); setCorrelations(c); setTrends(t); })
            .catch((err) => setError(err?.message || 'Failed to load Threat Summary'))
            .finally(() => setLoading(false));
    }, [windowPreset, severity, risk, module]);
    useEffect(() => { load(); }, [load]);

    const loadAi = useCallback(() => {
        setAiLoading(true); setAiError(null);
        const params = { window: windowPreset };
        Promise.all([
            getAiStatus().catch(() => ({ available: false })),
            analyzeThreatSummary(params),
            getThreatSummaryAssessment(params),
            getThreatSummaryForecast(params),
            getThreatSummaryRecommendations(params),
        ])
            .then(([status, a, assess, f, recs]) => { setAiAvailable(status.available); setAnalysis(a); setAssessment(assess); setForecast(f); setRecommendations(recs); })
            .catch((err) => setAiError(err?.message || 'Failed to generate AI Threat Overview'))
            .finally(() => setAiLoading(false));
    }, [windowPreset]);
    useEffect(() => { loadAi(); }, [loadAi]);

    const runSearch = async () => {
        if (!q.trim()) { setSearchResults(null); return; }
        setSearching(true);
        try { setSearchResults(await searchThreatSummary(q.trim())); } finally { setSearching(false); }
    };

    // THREAT_SUMMARY_PHASE3.md §19-22 "NO AUTONOMOUS ACTION" / "ACTION
    // PREVIEW" / "ACTION CONFIRMATION" / "RBAC FOR ACTIONS" — a
    // recommendation NEVER executes on its own. Clicking a recommendation
    // only opens this preview; the target API is called ONLY when the
    // analyst clicks Approve in the modal, and its RBAC check (already
    // enforced by the real Monitor/Timeline/Notes route) is the ONLY
    // authority on whether the action is allowed — never assumed here.
    const [previewRec, setPreviewRec] = useState<AiRecommendation | null>(null);
    const [approving, setApproving] = useState(false);
    const [approveResult, setApproveResult] = useState<{ ok: boolean; message: string } | null>(null);

    const openPreview = (rec: AiRecommendation) => { setApproveResult(null); setPreviewRec(rec); };
    const closePreview = () => { setPreviewRec(null); setApproveResult(null); };
    const approveRecommendation = async (preview: AiActionPreview) => {
        setApproving(true); setApproveResult(null);
        try {
            await approveAiRecommendation(preview);
            setApproveResult({ ok: true, message: 'Action completed — the existing API confirmed the result.' });
            loadAi(); // recommendations reflect the new state (e.g. the monitor now exists).
        } catch (err: any) {
            const message = err?.status === 403 ? 'Permission Required — you do not have permission to perform this action.' : (err?.message || 'The action could not be completed.');
            setApproveResult({ ok: false, message });
        } finally {
            setApproving(false);
        }
    };

    const go = (view: string) => onNavigate?.(view);
    // §10 — opens the EXACT entity when the item is a real, drill-into-able
    // entity type; otherwise falls back to Phase 1's section-level navigation.
    const openItem = (entityType: string | undefined, entityId: string | number | undefined, fallbackView: string) => {
        if (entityType && entityId != null && REAL_ENTITY_TYPES.has(entityType) && onOpenEntity) onOpenEntity(entityType, String(entityId));
        else go(fallbackView);
    };

    return (
        <div className="ti-container ts-dashboard">
          <div className="ti-content">
            {/* ── Hero header — same page identity as before (h1 "Threat
                Summary"), now with a subtitle and a real freshness/LIVE
                readout sourced from data.dataFreshness (already fetched,
                already shown lower on the page — just surfaced up top too). */}
            <div className="ts-hero">
                <div className="ts-hero-left">
                    <div className="ts-hero-icon"><ShieldHalf size={24} /></div>
                    <div className="ts-hero-titles">
                        <h1>Threat Summary</h1>
                        <p>Real-time overview of critical threats and intelligence updates</p>
                    </div>
                </div>
                <div className="ts-hero-right">
                    <div className="ts-hero-updated">
                        <span className="ts-label">Last updated</span>
                        <span className="ts-value">{data ? formatDateTime(data.dataFreshness) : '—'}</span>
                    </div>
                    <span className="ts-live-badge"><span className="ts-live-dot" />Live</span>
                </div>
            </div>

            {/* ── Control bar: window presets, refresh, search, filters —
                identical state/handlers, restyled markup only. */}
            <div className="ts-controlbar">
                <div className="ts-window-toggle">
                    {(['24h', '7d', '30d'] as const).map((w) => (
                        <button key={w} type="button" className={`ts-window-btn${w === windowPreset ? ' active' : ''}`} onClick={() => setWindowPreset(w)}>
                            {WINDOW_LABELS[w]}
                        </button>
                    ))}
                </div>
                <button type="button" className="ts-refresh-btn" onClick={load} disabled={loading}>
                    <RefreshCw size={14} className={loading ? 'spin' : undefined} />
                    {loading ? 'Refreshing…' : 'Refresh'}
                </button>
                <div className="ts-search-wrap">
                    <Search size={15} />
                    <input type="text" className="ts-search-input" placeholder="Search entity, IOC, campaign, threat actor, malware, brand, vulnerability…" value={q}
                        onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
                </div>
                <button type="button" className="ts-search-btn" onClick={runSearch} disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
                {/* §26 FILTERS */}
                <select className="ts-filter-select" value={severity} onChange={(e) => setSeverity(e.target.value)}>
                    <option value="all">All Alert Severities</option>
                    <option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option>
                </select>
                <select className="ts-filter-select" value={risk} onChange={(e) => setRisk(e.target.value)}>
                    <option value="all">All Risk Levels</option>
                    <option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
                <select className="ts-filter-select" value={module} onChange={(e) => setModule(e.target.value)}>
                    <option value="all">All Modules</option>
                    <option value="apt">APT</option><option value="malware">Malware</option><option value="ioc">IOC</option>
                    <option value="campaign">Campaign</option><option value="brand">Brand</option><option value="vulnerability">Vulnerability</option>
                    <option value="alerts">Alerts</option><option value="monitoring">Monitoring</option>
                </select>
            </div>
            {searchResults && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Search Results ({searchResults.length}) <button type="button" className="ti-action-btn" onClick={() => setSearchResults(null)} style={{ float: 'right' }}>Clear</button></div>
                    {searchResults.length === 0 ? <div className="ti-empty">No matches.</div> : (
                        <div className="ti-chip-list">
                            {searchResults.map((r) => <span key={`${r.type}:${r.id}`} className="ti-chip" onClick={() => go(MODULE_TO_VIEW[r.type] || 'ti-overview')}>{r.label} <span className="ti-note">({r.type.replace('_', ' ')})</span></span>)}
                        </div>
                    )}
                </div>
            )}

            {/* THREAT_SUMMARY_PHASE1/2.md — real, deterministic hero stats
                (Critical/High from data.riskSummary.combined — the SAME
                numbers the donut chart below renders; Intelligence Changes
                from data.recentIntelligence; Unresolved Conflicts from
                correlations.conflicts). Nothing here is a new computation —
                every value already exists elsewhere on this page. */}
            <HeroMetrics data={data} correlations={correlations} trends={trends} onOpen={go} onOpenConflicts={openConflicts} />

            {/* THREAT_SUMMARY_PHASE3.md — AI Threat Analyst, Executive Summary,
                Explainable Prioritization & Forecasting. The deterministic
                right column (§7 — Threat Severity Breakdown / Intelligence
                Categories) is rendered INSIDE this same panel by
                AiOverviewSection itself, gated on `data` only — so it still
                renders even when the AI generation above it is loading or
                has failed (§58 "if unavailable, deterministic features
                continue working"). Both panels read data already fetched by
                the deterministic load() above (riskSummary.combined is the
                SAME source as the "Risk Distribution" bar card further down;
                categoryActivity is the SAME source as "Activity by Module"
                further down) — a second, denser view of real numbers already
                on this page, not a new computation. */}
            <AiOverviewSection
                aiAvailable={aiAvailable} analysis={analysis} loading={aiLoading} error={aiError}
                summaryView={summaryView} onSummaryViewChange={setSummaryView} onRegenerate={loadAi}
                data={data} onOpenItem={openItem}
            />
            <ForecastSection forecast={forecast} />
            <RecommendationsSection recommendations={recommendations} onReview={openPreview} />
            {previewRec && (
                <ActionPreviewModal
                    rec={previewRec} approving={approving} result={approveResult}
                    onApprove={() => previewRec.actionPreview && approveRecommendation(previewRec.actionPreview)}
                    onClose={closePreview}
                />
            )}

            {error && <div className="ti-error">{error}</div>}
            {loading && !data ? <div className="ti-loading">Loading Threat Summary…</div> : data && (
                <>
                    <SourceHealthBanner data={data} />
                    {data.emptyState ? (
                        <div className="ti-card">
                            <div className="ti-card-title">No Significant Threat Activity</div>
                            <div className="ti-note">Time window: {formatDateTime(data.window.from)} – {formatDateTime(data.window.to)}</div>
                            <div className="ti-note">Sources checked: {data.sourcesChecked.join(', ')}</div>
                        </div>
                    ) : (
                        <>
                            {/* Quick-glance content — always visible. Three things
                                were dropped from this section as redundant, not
                                hidden elsewhere:
                                - "Activity by Module" / "Risk Distribution" bar
                                  cards duplicated data.categoryActivity /
                                  data.riskSummary.combined, already shown as the
                                  Intelligence Categories bars and Threat Severity
                                  Breakdown donut inside the AI panel above.
                                - The 7-tile ThreatMetricsSection (New Alerts, New
                                  IOCs, Campaign Changes, APT/Malware Activity, Risk
                                  Changes, Monitoring Events) duplicated Alert
                                  Summary, Monitoring Summary, the per-module
                                  summary cards, and Activity Trends below — which
                                  shows the same categories WITH previous + %
                                  change, strictly more information.
                                - Recent Intelligence was an unfiltered, uncurated
                                  raw event feed (mostly low-signal workflow noise —
                                  "case CREATED" repeated many times), not a priority
                                  view — its own "Open Timeline" button admitted the
                                  real, fuller version already lives on a dedicated
                                  page. The count + a link to that same page is kept
                                  via the "Intelligence Changes" hero card up top.
                                - Alert Summary / Monitoring Summary weren't
                                  duplicates of anything else here (their numbers
                                  are unique to this page), but this is a threat
                                  priority overview, not an alert/monitor status
                                  board — both cards' own "Alert Center" /
                                  "Monitoring" buttons already point at the
                                  dedicated pages for that. */}
                            <PriorityThreatsSection items={data.priorityThreats} onOpenItem={openItem} />

                            {/* Deep-dive content — collapsed by default, nothing
                                removed. Prioritization Explanation lives here now:
                                it lists the SAME entities as Priority Threats
                                above (same severity, same order — both come from
                                the same underlying priority list), just with the
                                "why" reasoning instead of the "what changed" /
                                drill-down columns. Keeping both always visible
                                back-to-back read as one duplicated list; this way
                                the operational table stays up top and the
                                explanation is one click away for whoever wants it. */}
                            <CollapsibleSection title="Trends & Correlation" open={trendsOpen} onToggle={() => setTrendsOpen((o) => !o)}>
                                {assessment && <PrioritizationExplanationSection assessment={assessment} />}
                                {correlations && <TopActiveEntitiesSection items={correlations.topActiveEntities} onOpenItem={openItem} />}
                                {trends && <ActivityTrendsSection trends={trends} />}
                                {correlations && <CorrelationSection data={correlations} onOpen={go} />}
                                {trends && <SeverityTrendSection trend={trends.severityTrend} />}
                                {trends && <VelocityBurstSection trends={trends} />}
                                {correlations && correlations.corroboration.length > 0 && <CorroborationSection items={correlations.corroboration} onOpenItem={openItem} />}
                                {correlations && correlations.conflicts.length > 0 && <ConflictsSection items={correlations.conflicts} />}
                            </CollapsibleSection>
                            <CollapsibleSection title="Module Summaries & Data Health" open={modulesOpen} onToggle={() => setModulesOpen((o) => !o)}>
                                <RiskChangeCard summary={data.riskChangeSummary} />
                                <ModuleSummariesSection data={data} onOpen={go} />
                                <SourceModuleSummarySection data={data.sourceModuleSummary} />
                                {data.sourceHealthDetailed && <DataHealthPanel health={data.sourceHealthDetailed} />}
                            </CollapsibleSection>
                        </>
                    )}
                    <div className="ti-note" style={{ marginTop: '10px' }}>
                        Last Updated: {formatDateTime(data.dataFreshness)} · Data Sources: {data.dataSources.join(', ')}
                    </div>
                </>
            )}
          </div>
        </div>
    );
};

// §41/§42 "SUMMARY HEALTH" / "PARTIAL DATA" — never hidden, never folded into a zero count.
const SourceHealthBanner: React.FC<{ data: ThreatSummaryData }> = ({ data }) => {
    if (!data.partialIntelligence) return null;
    const unavailable = Object.entries(data.sourceHealth).filter(([, v]) => v !== 'Available');
    return (
        <div className="ti-card" style={{ borderColor: 'rgba(234,179,8,0.4)', marginBottom: '16px' }}>
            <div className="ti-card-title">Partial Intelligence</div>
            {Object.entries(data.sourceHealth).map(([k, v]) => (
                <div key={k} className="ti-note">{k}: <strong style={{ color: v === 'Available' ? undefined : 'var(--ui-warning, #eab308)' }}>{v}</strong></div>
            ))}
            <div className="ti-note" style={{ fontStyle: 'italic' }}>{unavailable.map(([k]) => k).join(', ')} unavailable — this does NOT mean no threats exist for that source.</div>
        </div>
    );
};

type OpenItemFn = (entityType: string | undefined, entityId: string | number | undefined, fallbackView: string) => void;

function scrollToId(id: string) {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Density pass — wraps the deep-dive sections (Trends & Correlation, Module
// Summaries & Data Health) in a named, collapsible panel. Collapsed by
// default; nothing inside is removed or lazily-fetched differently, this
// only changes what's expanded on first render. `open`/`onToggle` are
// lifted to the page so an outside action (the hero "Unresolved Conflicts"
// card) can force a section open before scrolling to content inside it.
const CollapsibleSection: React.FC<{ title: string; open: boolean; onToggle: () => void; children: React.ReactNode }> = ({ title, open, onToggle, children }) => (
    <div className="ts-collapsible">
        <button type="button" className="ts-collapsible-head" onClick={onToggle} aria-expanded={open}>
            <ChevronDown size={16} className={`ts-chevron${open ? ' open' : ''}`} />
            <span>{title}</span>
        </button>
        {open && <div className="ts-collapsible-body">{children}</div>}
    </div>
);

// §4 THREAT METRIC CARDS — four "at a glance" hero stats. Every value is
// real and already computed elsewhere on this page, never a new metric:
// Critical/High come from data.riskSummary.combined (the exact source the
// Threat Severity Breakdown donut renders), Intelligence Changes is
// data.recentIntelligence.length (the exact "Recent Intelligence" section
// count below), Unresolved Conflicts is correlations.conflicts.length (the
// exact "Open Conflicts" section count, inside the collapsible Trends &
// Correlation panel — onOpenConflicts expands it and scrolls there).
const HeroMetrics: React.FC<{
    data: ThreatSummaryData | null; correlations: ThreatCorrelationsData | null; trends: ThreatTrendsData | null; onOpen: (v: string) => void;
    onOpenConflicts: () => void;
}> = ({ data, correlations, trends, onOpen, onOpenConflicts }) => {
    if (!data) {
        return (
            <div className="ts-metric-grid">
                {[0, 1, 2, 3].map((i) => <div key={i} className="ts-metric-card"><div className="ts-metric-skel" style={{ width: '100%' }} /></div>)}
            </div>
        );
    }
    const conflictCount = correlations?.conflicts.length ?? null;
    const cards: {
        key: string; label: string; value: number; delta?: number | null; sub: string; variant: 'critical' | 'high' | 'amber' | 'cyan';
        icon: React.ComponentType<{ size?: number | string }>; onClick?: () => void;
    }[] = [
        { key: 'critical', label: 'Critical Threats', value: data.riskSummary.combined.Critical, delta: trends?.severityTrend.Critical.change, sub: 'In Current Window', variant: 'critical', icon: ShieldAlert, onClick: () => onOpen('ti-risk') },
        { key: 'high', label: 'High Risk', value: data.riskSummary.combined.High, delta: trends?.severityTrend.High.change, sub: 'In Current Window', variant: 'high', icon: TriangleAlert, onClick: () => onOpen('ti-risk') },
        { key: 'intel', label: 'Intelligence Changes', value: data.recentIntelligence.length, sub: 'Recent Updates', variant: 'amber', icon: FileClock, onClick: () => onOpen('timeline') },
        { key: 'conflicts', label: 'Unresolved Conflicts', value: conflictCount ?? 0, sub: 'In Current Window', variant: 'cyan', icon: Target, onClick: conflictCount ? onOpenConflicts : undefined },
    ];
    return (
        <div className="ts-metric-grid">
            {cards.map((c) => {
                const Icon = c.icon;
                return (
                    <div key={c.key} className={`ts-metric-card ${c.variant}${c.onClick ? ' clickable' : ''}`} onClick={c.onClick} title={c.onClick ? METRIC_DEFINITIONS[c.label] || 'View details' : undefined}>
                        <div className="ts-metric-icon"><Icon size={20} /></div>
                        <div className="ts-metric-body">
                            <div className="ts-metric-label">{c.label}</div>
                            <div className="ts-metric-value-row">
                                <span className="ts-metric-value">{c.value}</span>
                                {c.delta != null && c.delta !== 0 && (
                                    <span className={`ts-metric-delta ${c.delta > 0 ? 'up' : 'down'}`}>{c.delta > 0 ? '+' : ''}{c.delta} new</span>
                                )}
                            </div>
                            <div className="ts-metric-sub">{c.sub}</div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

// §7 RIGHT ANALYTICS COLUMN, panel 1 — renders data.riskSummary.combined,
// the EXACT SAME real object the "Risk Distribution" bar card (further
// down the page) renders — a proportional donut instead of a second,
// duplicate set of bars for the same four real numbers.
const RISK_COLORS: Record<string, string> = { Critical: 'var(--ts-critical)', High: 'var(--ts-high)', Medium: 'var(--ts-medium)', Low: 'var(--ts-low)' };
const SeverityDonut: React.FC<{ riskSummary: ThreatSummaryData['riskSummary'] }> = ({ riskSummary }) => {
    const c = riskSummary.combined;
    const order: (keyof typeof c)[] = ['Critical', 'High', 'Medium', 'Low'];
    const total = order.reduce((s, k) => s + (c[k] || 0), 0);
    const R = 54; const CIRC = 2 * Math.PI * R;
    let cursor = 0;
    const segments = order.map((k) => {
        const value = c[k] || 0;
        const frac = total > 0 ? value / total : 0;
        const seg = { key: k, value, dash: frac * CIRC, offset: cursor };
        cursor += frac * CIRC;
        return seg;
    });
    return (
        <div className="ts-subcard">
            <div className="ts-subcard-title">Threat Severity Breakdown</div>
            <div className="ts-donut-row">
                <svg className="ts-donut-svg" width="132" height="132" viewBox="0 0 132 132">
                    <circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
                    {segments.filter((s) => s.value > 0).map((s) => (
                        <circle key={s.key} cx="66" cy="66" r={R} fill="none" stroke={RISK_COLORS[s.key]} strokeWidth="14"
                            strokeDasharray={`${s.dash} ${CIRC - s.dash}`} strokeDashoffset={-s.offset} transform="rotate(-90 66 66)" />
                    ))}
                    <text x="66" y="62" textAnchor="middle" className="ts-donut-center-value">{total}</text>
                    <text x="66" y="80" textAnchor="middle" className="ts-donut-center-label">TOTAL</text>
                </svg>
                <div className="ts-donut-legend">
                    {order.map((k) => (
                        <div key={k} className="ts-donut-legend-row">
                            <span className="ts-donut-dot" style={{ background: RISK_COLORS[k] }} />
                            <span className="ts-donut-legend-label">{k}</span>
                            <span className="ts-donut-legend-value">{total > 0 ? Math.round(((c[k] || 0) / total) * 100) : 0}% ({c[k] || 0})</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

// §7 RIGHT ANALYTICS COLUMN, panel 2 — same data.categoryActivity the
// "Activity by Module" bar card (further down the page) already renders;
// this is a smaller, colour-coded preview of that same real breakdown.
const IntelligenceCategories: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const entries = Object.entries(data);
    const max = Math.max(1, ...entries.map(([, v]) => v));
    return (
        <div className="ts-subcard">
            <div className="ts-subcard-title">Intelligence Categories</div>
            {entries.every(([, v]) => v === 0) ? <div className="ti-empty">No activity.</div> : (
                <div className="ts-cat-list">
                    {entries.map(([k, v]) => {
                        const meta = CATEGORY_META[k] || { icon: Radar, color: '#00e5ff' };
                        const Icon = meta.icon;
                        return (
                            <div key={k} className="ts-cat-row">
                                <span className="ts-cat-icon" style={{ background: `${meta.color}22`, color: meta.color }}><Icon size={13} /></span>
                                <span className="ts-cat-label">{k}</span>
                                <span className="ts-cat-track"><span className="ts-cat-fill" style={{ width: `${(v / max) * 100}%`, background: meta.color }} /></span>
                                <span className="ts-cat-count">{v}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const PriorityThreatsSection: React.FC<{ items: PriorityThreatItem[]; onOpenItem: OpenItemFn }> = ({ items, onOpenItem }) => (
    <div className="ti-card" id="ts-priority-threats-full" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Priority Threats ({items.length})</div>
        {items.length === 0 ? <div className="ti-empty">No priority threats in this window.</div> : (
            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead>
                        <tr><th>Severity</th><th>Entity</th><th>Change</th><th>Time</th><th>Source</th><th></th></tr>
                    </thead>
                    <tbody>
                        {items.map((it, i) => (
                            <tr key={i} className="ti-row-clickable" onClick={() => onOpenItem(it.refType, it.refId, viewForItem(it.sourceModule))} title={`Risk: ${it.severity} · ${it.change} · Source: ${it.source}`}>
                                <td><RiskBadge risk={it.severity} /></td>
                                <td style={{ fontWeight: 600 }}>{it.entity}</td>
                                <td className="ti-note">{it.change}</td>
                                <td className="ti-note">{formatDateTime(it.time)}</td>
                                <td className="ti-note">{it.source}</td>
                                <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); onOpenItem(it.refType, it.refId, viewForItem(it.sourceModule)); }}>View</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        )}
    </div>
);

// §11/§12/§30/§62 "THREAT CONCENTRATION" / "TOP ACTIVE ENTITIES" — ranked by
// AUTHORIZED event count only (never a danger ranking).
const TopActiveEntitiesSection: React.FC<{ items: TopActiveEntity[]; onOpenItem: OpenItemFn }> = ({ items, onOpenItem }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Top Active Entities</div>
        {items.length === 0 ? <div className="ti-empty">No concentrated activity in this window.</div> : (
            <ol style={{ margin: 0, paddingLeft: '20px' }}>
                {items.slice(0, 10).map((e) => (
                    <li key={`${e.entityType}:${e.entityId}`} style={{ padding: '4px 0', cursor: 'pointer' }} onClick={() => onOpenItem(e.entityType, e.entityId, viewForItem(e.entityType))}>
                        <strong>{e.label}</strong> <span className="ti-note">— {e.eventCount} event(s){e.recentHighSeverityEvents > 0 ? `, ${e.recentHighSeverityEvents} high-severity` : ''}</span>
                    </li>
                ))}
            </ol>
        )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Basis: number of authorized events — Activity Concentration, not a Danger Ranking.</div>
    </div>
);

// §7/§8/§63 "THREAT ACTIVITY GROUPS" / "THREAT CLUSTER SUMMARY" / "CORRELATION CARD"
const CorrelationSection: React.FC<{ data: ThreatCorrelationsData; onOpen: (v: string) => void }> = ({ data, onOpen }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Cross Source Correlation <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('timeline')}>View Activity</button></div>
        <div className="ti-note" style={{ marginBottom: '8px' }}>{data.totalEvents} total events · {data.correlatedEvents} correlated · Sources: {data.modules.join(', ') || '—'}</div>
        {data.clusters.length === 0 ? <div className="ti-empty">No correlated activity groups in this window.</div> : (
            <ul className="ti-list">
                {data.clusters.slice(0, 10).map((c) => (
                    <li key={c.key} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="ti-badge">{c.label}</span>
                            <strong>{c.eventCount} event(s)</strong>
                            <span className="ti-note">{c.entityCount} entit{c.entityCount === 1 ? 'y' : 'ies'} · Sources: {c.sources.join(', ')}</span>
                        </div>
                        <div className="ti-note">Related because: {c.reasons.join(', ')}</div>
                    </li>
                ))}
            </ul>
        )}
        {data.sharedContext.iocs.length > 0 && <div className="ti-note">Shared IOC: {data.sharedContext.iocs.map((i) => i.label).join(', ')}</div>}
        {data.sharedContext.campaigns.length > 0 && <div className="ti-note">Shared Campaign: {data.sharedContext.campaigns.map((c) => c.label).join(', ')}</div>}
    </div>
);

// §40/§41/§68 "CORROBORATION" / "SOURCE INDEPENDENCE" / "CORROBORATION PANEL"
const CorroborationSection: React.FC<{ items: ThreatCorrelationsData['corroboration']; onOpenItem: OpenItemFn }> = ({ items, onOpenItem }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Corroborated Intelligence</div>
        <ul className="ti-list">
            {items.map((c) => (
                <li key={`${c.entityType}:${c.entityId}`} style={{ padding: '4px 0', cursor: 'pointer' }} onClick={() => onOpenItem(c.entityType, c.entityId, 'ti-iocs')}>
                    <strong>{c.label}</strong> <span className="ti-note">— {c.sourceCount} independent source(s): {c.sources.join(', ')}</span>
                </li>
            ))}
        </ul>
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Corroboration does not automatically classify maliciousness or attribution.</div>
    </div>
);

// §42/§67 "CONFLICTS" / "CONFLICT PANEL"
const ConflictsSection: React.FC<{ items: ThreatCorrelationsData['conflicts'] }> = ({ items }) => (
    <div className="ti-card" id="ts-conflicts-section" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)' }}>
        <div className="ti-card-title">Open Conflicts</div>
        <ul className="ti-list">
            {items.map((c) => (
                <li key={c.id} style={{ padding: '4px 0' }}>
                    <strong>{c.object}</strong> attribution: <span className="ti-note">{c.claimA} vs {c.claimB}</span> — <span className="ti-badge">{c.status}</span>
                </li>
            ))}
        </ul>
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Never resolved automatically — an analyst decision.</div>
    </div>
);

// §13/§14/§64 "TREND ANALYSIS" / "CATEGORY TRENDS" / "TREND CARD"
const TrendPointView: React.FC<{ label: string; point: ThreatTrendPoint }> = ({ label, point }) => (
    <div className="ti-kpi-card">
        <div className="ti-kpi-value">{point.current}</div>
        <div className="ti-kpi-label">{label}</div>
        <div className="ti-note">Previous: {point.previous} · Change: {point.change >= 0 ? '+' : ''}{point.change}{point.changePercent != null ? ` (${point.changePercent >= 0 ? '+' : ''}${point.changePercent}%)` : ''}</div>
    </div>
);
const ActivityTrendsSection: React.FC<{ trends: ThreatTrendsData }> = ({ trends }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Activity Trends — Current vs Previous Period</div>
        <div className="ti-kpi-row">
            {Object.entries(trends.categoryTrends).map(([k, v]) => <TrendPointView key={k} label={`${k} Activity`} point={v} />)}
        </div>
        <div className="ti-note" style={{ fontStyle: 'italic' }}>{trends.note}</div>
    </div>
);
const SeverityTrendSection: React.FC<{ trend: ThreatTrendsData['severityTrend'] }> = ({ trend }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Severity Trends</div>
        <div className="ti-kpi-row">
            {(['Critical', 'High', 'Medium', 'Low'] as const).map((k) => <TrendPointView key={k} label={k} point={trend[k]} />)}
        </div>
    </div>
);
// §26/§27/§28 "ACTIVITY VELOCITY" / "ACTIVITY BURST" / "BASELINE"
const VelocityBurstSection: React.FC<{ trends: ThreatTrendsData }> = ({ trends }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        <div className="ti-card">
            <div className="ti-card-title">Activity Velocity</div>
            {trends.velocity.insufficientHistory ? <div className="ti-empty">Insufficient History</div> : (
                <div className="ti-kv">
                    <span className="k">Current</span><span className="v">{trends.velocity.current} events/hour</span>
                    <span className="k">Baseline</span><span className="v">{trends.velocity.baseline} events/hour</span>
                    <span className="k">Velocity</span><span className="v">{trends.velocity.velocity != null ? `${trends.velocity.velocity}x` : '—'}</span>
                </div>
            )}
        </div>
        <div className="ti-card">
            <div className="ti-card-title">Activity Burst</div>
            {trends.burst.insufficientHistory ? <div className="ti-empty">Insufficient History</div> : !trends.burst.detected ? <div className="ti-note">{trends.burst.label || 'Normal Activity'}</div> : (
                <div className="ti-kv">
                    <span className="k">Current</span><span className="v">{trends.burst.currentPerHour}/hour</span>
                    <span className="k">Baseline</span><span className="v">{trends.burst.baselinePerHour}/hour</span>
                    <span className="k">Increase</span><span className="v">{trends.burst.increase}x</span>
                </div>
            )}
            {trends.burst.note && <div className="ti-note" style={{ fontStyle: 'italic' }}>{trends.burst.note}</div>}
        </div>
    </div>
);

// §43/§44/§69 "THREAT SUMMARY HEALTH" / "DATA COVERAGE" / "DATA HEALTH PANEL"
const DataHealthPanel: React.FC<{ health: Record<string, string> }> = ({ health }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Data Coverage</div>
        <div className="ti-kv">
            {Object.entries(health).map(([k, v]) => (<React.Fragment key={k}><span className="k">{k}</span><span className="v">{v}</span></React.Fragment>))}
        </div>
    </div>
);

const RiskChangeCard: React.FC<{ summary: ThreatSummaryData['riskChangeSummary'] }> = ({ summary }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Risk Change Summary</div>
        <div className="ti-kv">
            <span className="k">Risk Increased</span><span className="v">{summary.increased}</span>
            <span className="k">Risk Decreased</span><span className="v">{summary.decreased}</span>
            <span className="k">New High Risk</span><span className="v">{summary.newHighRisk}</span>
        </div>
        <div className="ti-note">Derived from real risk history — never a recalculated score.</div>
    </div>
);

const ModuleSummariesSection: React.FC<{ data: ThreatSummaryData; onOpen: (v: string) => void }> = ({ data, onOpen }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div className="ti-card">
            <div className="ti-card-title">APT Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('ti-actors')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New Threat Actors</span><span className="v">{data.aptSummary.newThreatActors}</span>
                <span className="k">New Campaign Links</span><span className="v">{data.aptSummary.newCampaigns}</span>
                <span className="k">New Malware Links</span><span className="v">{data.aptSummary.newMalwareLinks}</span>
                <span className="k">Risk Changes</span><span className="v">{data.aptSummary.riskChanges}</span>
            </div>
        </div>
        <div className="ti-card">
            <div className="ti-card-title">Malware Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('ti-malware')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New Malware</span><span className="v">{data.malwareSummary.newMalware}</span>
                <span className="k">New Samples</span><span className="v">{data.malwareSummary.newSamples}</span>
                <span className="k">New IOC Links</span><span className="v">{data.malwareSummary.newIocs}</span>
                <span className="k">Risk Changes</span><span className="v">{data.malwareSummary.riskChanges}</span>
            </div>
        </div>
        <div className="ti-card">
            <div className="ti-card-title">Brand Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('osint-brand-intel')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New Domains</span><span className="v">{data.brandSummary.newDomains}</span>
                <span className="k">New Social Findings</span><span className="v">{data.brandSummary.newSocialFindings}</span>
                <span className="k">MISP Matches</span><span className="v">{data.brandSummary.mispMatches}</span>
                <span className="k">Campaign Changes</span><span className="v">{data.brandSummary.campaignChanges}</span>
            </div>
        </div>
        <div className="ti-card">
            <div className="ti-card-title">IOC Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('ti-iocs')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New IOCs</span><span className="v">{data.iocSummary.newIocs}</span>
                <span className="k">High Risk IOCs</span><span className="v">{data.iocSummary.highRiskIocs}</span>
                <span className="k">Recently Observed</span><span className="v">{data.iocSummary.recentlyObserved}</span>
                <span className="k">MISP Matches</span><span className="v">{data.iocSummary.mispMatches}</span>
            </div>
        </div>
        <div className="ti-card">
            <div className="ti-card-title">Campaign Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('ti-campaigns')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New Campaigns</span><span className="v">{data.campaignSummary.newCampaigns}</span>
                <span className="k">Campaign Growth</span><span className="v">{data.campaignSummary.campaignGrowth}</span>
                <span className="k">Risk Changes</span><span className="v">{data.campaignSummary.riskChanges}</span>
            </div>
        </div>
        <div className="ti-card">
            <div className="ti-card-title">Vulnerability Summary <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onOpen('ti-vulnerabilities')}>View</button></div>
            <div className="ti-kv">
                <span className="k">New CVEs</span><span className="v">{data.vulnerabilitySummary.newVulnerabilities}</span>
                <span className="k">High Severity</span><span className="v">{data.vulnerabilitySummary.highSeverity}</span>
                <span className="k">Related Malware</span><span className="v">{data.vulnerabilitySummary.relatedMalware}</span>
                <span className="k">Related Campaigns</span><span className="v">{data.vulnerabilitySummary.relatedCampaigns}</span>
            </div>
        </div>
    </div>
);

// §11 SOURCE MODULE SUMMARY — "Do not imply source count equals threat severity."
// database/threatSummaryStorage.js's getSourceModuleSummary() re-buckets
// numbers already shown twice elsewhere on this page: 'APT Intelligence' /
// 'Malware Intelligence' / 'Brand Intelligence' are the EXACT SAME counts as
// Intelligence Categories' APT/Malware/Brand bars in the AI panel above (and
// Activity Trends' same categories, with previous + % change on top);
// 'Threat Intelligence' is just IOC+Campaign+Vulnerability added together,
// and 'Monitoring' here is Monitoring+Alerts added together — both already
// broken out individually in those same two places. Only 'Investigations'
// (case activity) isn't captured anywhere else on this page, so that's the
// only line actually worth its own card.
const KNOWN_DUPLICATE_SOURCE_MODULES = new Set(['Threat Intelligence', 'APT Intelligence', 'Malware Intelligence', 'Brand Intelligence', 'Monitoring']);
const SourceModuleSummarySection: React.FC<{ data: Record<string, number> }> = ({ data }) => {
    const unique = Object.entries(data).filter(([k]) => !KNOWN_DUPLICATE_SOURCE_MODULES.has(k));
    if (unique.length === 0) return null;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Source Module Summary</div>
            <div className="ti-kv">
                {unique.map(([k, v]) => (<React.Fragment key={k}><span className="k">{k}</span><span className="v">{v} event(s)</span></React.Fragment>))}
            </div>
            <div className="ti-note">Event counts only — a higher count does not imply higher severity. Module-level counts already shown in Intelligence Categories / Activity Trends above aren't repeated here.</div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// THREAT_SUMMARY_PHASE3.md — AI Threat Analyst, Executive Summary,
// Explainable Prioritization & Forecasting.
// ═══════════════════════════════════════════════════════════════════════

// §58 "AI MODEL STATUS" — Available/Unavailable, always visible regardless
// of whether a generation has run yet.
const AiStatusBadge: React.FC<{ available: boolean | null }> = ({ available }) => {
    if (available === null) return null;
    return <span className={`ts-ai-badge ${available ? 'on' : 'off'}`}>AI: {available ? 'Available' : 'Unavailable'}</span>;
};

// §6 LOWER LEFT PANELS — compact "Top Developments" / "Priority Threats"
// preview, nested inside the AI panel. Both read data already fetched
// elsewhere on the page (analysis.executiveSummary.topDevelopments is the
// SAME array the Analyst tab's "Key Developments" shows in full;
// data.priorityThreats is the SAME array the full Priority Threats table
// further down the page renders) — "View all" wires to that real, existing
// content instead of a dead link.
const AiPreviewGrid: React.FC<{
    analysis: AiAnalyzeResponse; data: ThreatSummaryData | null; onOpenItem: OpenItemFn; onViewDevelopments: () => void;
}> = ({ analysis, data, onOpenItem, onViewDevelopments }) => (
    <div className="ts-preview-grid">
        <div className="ts-subcard">
            <div className="ts-subcard-title">Top Developments</div>
            {analysis.executiveSummary.topDevelopments.length === 0 ? <div className="ti-empty">No developments in this window.</div> : (
                <div className="ts-feed-list">
                    {analysis.executiveSummary.topDevelopments.map((t, i) => (
                        <div key={i} className="ts-feed-row" style={{ cursor: 'default' }}>
                            <span className={`ts-feed-dot ${detectSeverity(t) || 'none'}`} />
                            <span className="ts-feed-text"><span className="ts-feed-title">{t}</span></span>
                        </div>
                    ))}
                </div>
            )}
            <button type="button" className="ts-view-all" onClick={onViewDevelopments}>View all developments <ArrowRight size={13} /></button>
        </div>
        <div className="ts-subcard">
            <div className="ts-subcard-title">Priority Threats</div>
            {!data || data.priorityThreats.length === 0 ? <div className="ti-empty">No priority threats in this window.</div> : (
                <div className="ts-feed-list">
                    {data.priorityThreats.slice(0, 3).map((it, i) => {
                        const Icon = iconForEntity(it.entity);
                        return (
                            <div key={i} className="ts-feed-row" onClick={() => onOpenItem(it.refType, it.refId, viewForItem(it.sourceModule))}>
                                <span className={`ts-feed-icon ${(it.severity || '').toLowerCase()}`}><Icon size={14} /></span>
                                <span className="ts-feed-text">
                                    <span className="ts-feed-title">{it.entity}</span>
                                    <span className="ts-feed-sub">{it.change}</span>
                                </span>
                                <RiskBadge risk={it.severity} />
                            </div>
                        );
                    })}
                </div>
            )}
            <button type="button" className="ts-view-all" onClick={() => scrollToId('ts-priority-threats-full')}>View all threats <ArrowRight size={13} /></button>
        </div>
    </div>
);

// §5-9/§70-72 AI THREAT OVERVIEW — Executive vs Analyst summary, rendered
// from the SAME grounded generation (never two independently-asked-for,
// possibly-inconsistent paragraphs). §54-56 freshness + Regenerate. §59
// Fallback is labeled plainly, never presented as if it came from a live model.
const AiOverviewSection: React.FC<{
    aiAvailable: boolean | null; analysis: AiAnalyzeResponse | null; loading: boolean; error: string | null;
    summaryView: 'executive' | 'analyst'; onSummaryViewChange: (v: 'executive' | 'analyst') => void; onRegenerate: () => void;
    data: ThreatSummaryData | null; onOpenItem: OpenItemFn;
}> = ({ aiAvailable, analysis, loading, error, summaryView, onSummaryViewChange, onRegenerate, data, onOpenItem }) => (
    <div className="ti-card ts-ai-panel">
        <div className="ti-card-title ts-ai-panel-head">
            <span className="ts-ai-panel-title"><Radar size={16} />AI Threat Overview</span>
            <AiStatusBadge available={aiAvailable} />
            {analysis?.fallback && <span className="ts-ai-badge fallback">AI Summary: Fallback</span>}
            <button type="button" className="ts-regenerate-btn" onClick={onRegenerate} disabled={loading}>
                <Sparkles size={14} className={loading ? 'spin' : undefined} />
                {loading ? 'Generating…' : 'Regenerate'}
            </button>
        </div>
        {/* §7 RIGHT ANALYTICS COLUMN, nested in the SAME bordered panel as the
            AI content (not a separate card beside it) — gated on `data`
            only, so it still renders while the AI generation to its left is
            loading or has failed (§58 "deterministic features continue
            working" independently of AI availability). */}
        <div className="ts-ai-body-grid">
            <div className="ts-ai-main-col">
                {error && <div className="ti-error">{error}</div>}
                {loading && !analysis ? <div className="ti-loading">Generating AI Threat Overview…</div> : analysis && (
                    <>
                        {/* §55 SUMMARY FRESHNESS — never let AI output look more current than it is. */}
                        <div className="ts-ai-meta">
                            <span className="ts-ai-meta-item"><CalendarClock size={13} />Generated: <strong>{formatDateTime(analysis.generatedAt)}</strong></span>
                            <span className="ts-ai-meta-item"><FileClock size={13} />Data Window: <strong>{formatDateTime(analysis.dataWindow.from)} – {formatDateTime(analysis.dataWindow.to)}</strong></span>
                        </div>
                        {/* §72 EXECUTIVE VS ANALYST — two different views of the same grounded facts, never the same paragraph. */}
                        <div className="ts-ai-tabs">
                            <button type="button" className={`ts-ai-tab${summaryView === 'executive' ? ' active' : ''}`} onClick={() => onSummaryViewChange('executive')}>Executive Summary</button>
                            <button type="button" className={`ts-ai-tab${summaryView === 'analyst' ? ' active' : ''}`} onClick={() => onSummaryViewChange('analyst')}>Analyst Summary</button>
                        </div>
                        {summaryView === 'executive' ? (
                            <div>
                                <p className="ts-ai-summary-text">{highlightSummaryText(analysis.executiveSummary.overallSituation)}</p>
                                {/* AiPreviewGrid already renders topDevelopments and
                                    priorityThreats — the exact same two arrays — as
                                    icon/badge cards with click-through, immediately
                                    above. Repeating them again here as plain bullet
                                    lists was pure duplication, not a different view
                                    of the data. */}
                                <AiPreviewGrid analysis={analysis} data={data} onOpenItem={onOpenItem} onViewDevelopments={() => onSummaryViewChange('analyst')} />
                                <AiListBlock title="Major Changes" items={analysis.executiveSummary.majorChanges} />
                                <AiListBlock title="Unknowns" items={analysis.executiveSummary.unknowns} />
                                <AiListBlock title="Recommended Analyst Attention" items={analysis.executiveSummary.recommendedAttention} />
                            </div>
                        ) : (
                            <div>
                                <p className="ts-ai-summary-text">{highlightSummaryText(analysis.analystSummary.executiveAssessment)}</p>
                                <AiListBlock title="Key Developments" items={analysis.analystSummary.keyDevelopments} />
                                <AiListBlock title="Correlations / Supporting Evidence" items={analysis.analystSummary.correlations} />
                                <AiListBlock title="Notable Changes" items={analysis.analystSummary.notableChanges} />
                                <AiListBlock title="Conflicts" items={analysis.analystSummary.conflicts} />
                                <AiListBlock title="Unknowns" items={analysis.analystSummary.unknowns} />
                                <AiListBlock title="Recommendations" items={analysis.analystSummary.recommendations} />
                                {/* §9/§10/§64 CITATIONS — real record references only, never invented, never "Database". */}
                                {analysis.analystSummary.sources.length > 0 && (
                                    <div>
                                        <div className="ti-modal-subtitle">Sources</div>
                                        <div className="ti-chip-list">{analysis.analystSummary.sources.map((s, i) => <span key={i} className="ti-chip">{s}</span>)}</div>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>
            {data && (
                <div className="ts-side-col">
                    <SeverityDonut riskSummary={data.riskSummary} />
                    <IntelligenceCategories data={data.categoryActivity} />
                </div>
            )}
        </div>
        {/* §8 FOOTER INSIGHT — analysis.overview.note is the real disclaimer
            the backend already attaches to every generation (grounded
            synthesis vs. heuristic fallback), never rewritten here. Spans
            the full panel width, under both columns. */}
        {analysis && <div className="ts-ai-footnote"><Cpu size={14} />{analysis.overview.note}</div>}
    </div>
);

const AiListBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => {
    if (!items.length) return null;
    return (
        <div style={{ marginTop: '8px' }}>
            <div className="ti-modal-subtitle">{title}</div>
            <ul className="ti-list">{items.map((it, i) => <li key={i} style={{ padding: '3px 0' }}>{it}</li>)}</ul>
        </div>
    );
};

// §23-29/§75-76 AI THREAT FORECASTING — Activity Outlook, honest confidence,
// never predictive certainty about a specific attack.
const ForecastSection: React.FC<{ forecast: ThreatForecast | null }> = ({ forecast }) => {
    if (!forecast) return null;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Activity Outlook</div>
            {forecast.status === 'insufficient_data' ? (
                <div className="ti-empty">Forecast Unavailable — Insufficient Historical Data.</div>
            ) : (
                <>
                    {/* Dedicated card, not the generic ti-kpi-card/ti-kpi-value
                        pair (built for a single large number, line-height: 1) —
                        that squashed this wrapped 2-3 word direction text
                        against its label with almost no line spacing. */}
                    <div className="ts-outlook-grid">
                        {forecast.horizons.map((h) => (
                            <div key={h.label} className="ts-outlook-card">
                                <div className="ts-outlook-direction">{h.direction}</div>
                                <div className="ts-outlook-window">{h.label}</div>
                                <div className={`ts-outlook-confidence conf-${h.confidence.toLowerCase()}`}>Confidence: {h.confidence}</div>
                            </div>
                        ))}
                    </div>
                    <div className="ti-note">Basis: {forecast.basis}</div>
                    <div className="ti-note" style={{ fontStyle: 'italic' }}>{forecast.language}</div>
                </>
            )}
            <div className="ti-note" style={{ fontStyle: 'italic' }}>{forecast.note}</div>
        </div>
    );
};

// §11/§12/§13/§17 PRIORITIZATION EXPLANATION / INTELLIGENCE GAPS — explains
// Phase 2's existing priority logic; never a hidden AI score.
const PrioritizationExplanationSection: React.FC<{ assessment: AiAssessmentData }> = ({ assessment }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">Prioritization Explanation</div>
        {assessment.priorityExplanations.length === 0 ? <div className="ti-empty">No priority items to explain in this window.</div> : (
            <ul className="ti-list">
                {assessment.priorityExplanations.map((p, i) => (
                    <li key={i} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><RiskBadge risk={p.severity} /><strong>{p.entity}</strong></div>
                        <div className="ti-note">{p.whyImportant}</div>
                        <div className="ti-note">Sources: {p.sources.join(', ')}</div>
                        {p.unknowns.length > 0 && <div className="ti-note" style={{ fontStyle: 'italic' }}>{p.unknowns.join(' ')}</div>}
                    </li>
                ))}
            </ul>
        )}
        {assessment.intelligenceGaps.length > 0 && (
            <>
                <div className="ti-modal-subtitle" style={{ marginTop: '10px' }}>Intelligence Gaps</div>
                <ul className="ti-list">
                    {assessment.intelligenceGaps.map((g, i) => <li key={i} style={{ padding: '3px 0' }}><strong>{g.type}</strong> — <span className="ti-note">{g.description}</span></li>)}
                </ul>
            </>
        )}
    </div>
);

// §18-22/§74 AI RECOMMENDATIONS — Reason/Source/Priority always visible;
// state-changing recommendations open an Action Preview, never execute directly.
// The backend also returns "informational" recommendations (Review <entity>
// / Review Conflict — database/threatSummaryAiStorage.js's getAiRecommendations,
// type 'investigate_entity' / 'review_conflict') for every priority item
// that isn't independently actionable. Their `reason` literally restates
// "<entity> was flagged <severity> (<change>)" — the exact same entity,
// severity and change already shown in Priority Threats (or the exact same
// conflict already shown in Open Conflicts) — with no button and no
// drill-down, so they add nothing here. Only the actionable ones (a real
// Approve-gated state change: create a monitor, draft a brief/knowledge
// entry) are unique to this section; those are what's shown.
const RecommendationsSection: React.FC<{ recommendations: AiRecommendation[]; onReview: (rec: AiRecommendation) => void }> = ({ recommendations, onReview }) => {
    const actionable = recommendations.filter((r) => r.stateChanging);
    const informationalCount = recommendations.length - actionable.length;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Analyst Recommendations ({actionable.length})</div>
            {actionable.length === 0 ? <div className="ti-empty">No actionable recommendations for this window.</div> : (
                <ul className="ti-list">
                    {actionable.map((r) => (
                        <li key={r.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                            <span className="ti-badge" style={{ background: r.priority === 'High' ? 'rgba(239,68,68,0.15)' : r.priority === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(148,163,184,0.15)', color: r.priority === 'High' ? '#f87171' : r.priority === 'Medium' ? '#eab308' : '#94a3b8' }}>{r.priority}</span>
                            <div style={{ flex: 1 }}>
                                <strong>{r.label}</strong>
                                <div className="ti-note">{r.reason}</div>
                                <div className="ti-note">Source: {r.source.join(', ')}</div>
                            </div>
                            <button type="button" className="ti-action-btn" onClick={() => onReview(r)}>Review</button>
                        </li>
                    ))}
                </ul>
            )}
            <div className="ti-note" style={{ fontStyle: 'italic' }}>
                Recommendations only — no action is ever taken automatically.
                {informationalCount > 0 ? ` ${informationalCount} informational item(s) for this window restate entities already shown in Priority Threats / Open Conflicts and aren't repeated here.` : ''}
            </div>
        </div>
    );
};

// §20/§21/§22 ACTION PREVIEW — Recommended Action / Target / Reason /
// Source, then [Review] (already open) / [Approve]. The target API is
// called ONLY on Approve, and its own RBAC check is the sole authority on
// whether it succeeds (§22 "No bypass").
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

export default ThreatSummaryPage;
