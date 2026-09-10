// MITRE_MAPPER_PHASE1.md — ATT&CK Mapping Foundation, Technique Exploration,
// Manual Mapping, Evidence, Confidence & Analyst Review. Replaces the
// former "MITRE Mapper is planned for a future update and isn't available
// yet." placeholder. §2/§4 CRITICAL PRINCIPLE — this page reads the
// EXISTING, already-authoritative ATT&CK dataset and entity relationship
// graph; it never becomes a second technique/tactic/relationship database.
// Reuses ThreatIntelligence's existing ti-* visual system, the same
// convention every other analysis page (IOC Analyzer, Report Generator)
// already follows.
import React, { useCallback, useEffect, useState } from 'react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import { formatDateTime, EntityChip } from '../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../components/shared/Pagination';  // P2-8
import KnowledgeContextPanel from '../KnowledgeBase/KnowledgeContextPanel'; // KNOWLEDGE_BASE_PHASE2.md §12 "KNOWLEDGE TO MITRE"
import {
    getAttackOverview, getAttackTechniques, type AttackOverview,
    getMitreDashboard, getMitreTactics, getMitreTechniqueDetail, searchMitreEntities, getMitreEntityView,
    getMitreEntityEvidence, getMitreConflicts, createMitreMapping, reviewMitreMapping, removeMitreMapping,
    getMitreMappingsPage, searchMitre, mitreMapperExportUrl,
    type MitreDashboard, type MitreTactic, type MitreTechniqueDetail, type MitreEntitySearchResult, type MitreEntityView,
    type MitreEvidenceItem, type MitreConflict, type MitreMapping, type MitreEntityType,
    // MITRE_MAPPER_PHASE2.md — Automatic Suggestions, Review Queue + Bulk
    // Review, Coverage, Matrix status filter, Technique History/Evolution,
    // Malware Sample as a viewable entity + review delegate, Sample compare.
    getMitreSuggestionsSummary, getMitreSuggestionsQueue, recalculateMitreSuggestions, bulkReviewMitreMappings,
    getMitreMatrixData, getMitreCoverage, getMalwareFamilyCoverage, getMitreEntityEvolution,
    compareMitreMalwareSamples, reviewMalwareSampleTechnique,
    type MitreSuggestionsSummary, type MitreMatrixEntry, type MitreCoverage, type MitreFamilyCoverage,
    type MitreEvolutionEvent, type MitreSampleComparison,
    // MITRE_MAPPER_PHASE3.md — Detection Rule Correlation, Detection
    // Coverage/Gaps, Confidence Heatmap, enhanced Evolution/Trend, bundled
    // Entity Profile, enhanced Comparison + Technique Comparison, and the
    // AI MITRE Analyst layer (stateless explanation/summary/gap/conflict/
    // recommendation tasks, persisted AI Technique Suggestions, and AI
    // Action proposals reusing the shared action engine).
    getMitreDetectionCoverage, getMitreDetectionGaps, getMitreHeatmap, getMitreTechniqueTrend,
    getMitreEnhancedComparison, compareMitreTechniques,
    generateMitreAiAnalysis, generateMitreAiTechniqueSuggestion, getMitreAiSuggestions,
    acceptMitreAiSuggestion, rejectMitreAiSuggestion,
    getMitreAiActionCandidates, proposeMitreAiAction, approveMitreAiAction, rejectMitreAiAction, listMitreAiActions,
    type MitreDetectionCoverage, type MitreDetectionGap, type MitreHeatmapCell, type MitreAdoptionEntry,
    type MitreEnhancedComparison, type MitreTechniqueComparison, type MitreAiTaskType, type MitreAiDraft,
    type MitreAiSuggestion, type MitreAiActionCandidate, type MitreAiAction,
} from '../../services/api';

interface MitreMapperPageProps {
    onOpenEntity?: (entityType: string, entityId: string) => void;
    onOpenCase?: (caseId: number) => void;
    onViewNotesForEntity?: (entityType: string, entityId: string, label: string) => void;
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    // P1-8 — carried over from the retired Threat Intelligence › MITRE ATT&CK
    // section, which owned the ATT&CK end of the Knowledge Base integration.
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    // A technique id to open on mount, so #/ti-attack deep links and
    // attack_technique search hits still land on the technique itself.
    initialTechniqueId?: string | null;
    onInitialTechniqueConsumed?: () => void;
}

type Mode = 'dashboard' | 'explorer' | 'matrix' | 'entity' | 'compare' | 'mappings' | 'suggestions';

const ENTITY_TYPE_OPTIONS: { value: MitreEntityType; label: string }[] = [
    { value: 'threat_actor', label: 'Threat Actor / APT' }, { value: 'malware', label: 'Malware' }, { value: 'campaign', label: 'Campaign' },
    { value: 'case', label: 'Case / Investigation' }, { value: 'ioc', label: 'IOC' }, { value: 'brand', label: 'Brand' },
    { value: 'company', label: 'Company' }, { value: 'social_investigation', label: 'OSINT Investigation' },
    { value: 'dark_web_observation', label: 'Dark Web Observation' }, { value: 'credential_exposure', label: 'Credential Exposure' },
];
const MAPPABLE_ENTITY_TYPES = new Set(['threat_actor', 'malware', 'campaign', 'case', 'ioc', 'brand', 'company', 'social_investigation']);
const STATUS_COLOR: Record<string, { background: string; color: string }> = {
    suggested: { background: 'rgba(234,179,8,0.15)', color: '#eab308' },
    confirmed: { background: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    rejected: { background: 'rgba(248,81,73,0.15)', color: '#f85149' },
};

const MitreMapperPage: React.FC<MitreMapperPageProps> = (props) => {
    // An inbound deep link names a technique, so open the Explorer on it
    // rather than the Dashboard the module otherwise starts on.
    const [mode, setMode] = useState<Mode>(props.initialTechniqueId ? 'explorer' : 'dashboard');
    const [selectedEntity, setSelectedEntity] = useState<{ type: string; id: string; label: string } | null>(null);
    const [selectedTechniqueId, setSelectedTechniqueId] = useState<string | null>(props.initialTechniqueId ?? null);

    useEffect(() => {
        if (props.initialTechniqueId) { setSelectedTechniqueId(props.initialTechniqueId); setMode('explorer'); props.onInitialTechniqueConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [props.initialTechniqueId]);

    const openEntity = (type: string, id: string, label: string) => { setSelectedEntity({ type, id, label }); setMode('entity'); };
    const openTechnique = (id: string) => { setSelectedTechniqueId(id); setMode('explorer'); };

    return (
        <div className="ti-container">
            <div className="ti-content">
                <div className="ti-header"><h1>MITRE ATT&CK</h1></div>
                <div className="ti-note" style={{ marginBottom: '10px' }}>
                    {/* P1-8 — Threat Intelligence carried a second ATT&CK section
                        (catalogue overview, technique list, technique detail) over
                        the SAME `/api/intelligence/attack/*` endpoints this page
                        already consumed. It was a strict subset, so it folded into
                        Technique Explorer rather than staying a parallel module. */}
                    The ATT&CK technique catalogue plus the mapping and analysis layer over LekirraX's existing intelligence. This page never creates a second technique/tactic/relationship database — every value shown is read from its real, existing source, and every mapping is an analyst-reviewed suggestion until explicitly confirmed.
                </div>
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', flexWrap: 'wrap' }}>
                    {(['dashboard', 'suggestions', 'explorer', 'matrix', 'entity', 'compare', 'mappings'] as Mode[]).map((m) => (
                        <button key={m} type="button" className="ti-action-btn" style={mode === m ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setMode(m)}>
                            {m === 'dashboard' ? 'Dashboard' : m === 'suggestions' ? 'Suggestions / Review Queue' : m === 'explorer' ? 'Technique Explorer' : m === 'matrix' ? 'ATT&CK Matrix' : m === 'entity' ? 'Entity View' : m === 'compare' ? 'Compare' : 'All Mappings'}
                        </button>
                    ))}
                </div>

                {mode === 'dashboard' && <DashboardView onOpenTechnique={openTechnique} onOpenEntity={(t, id, label) => openEntity(t, id, label)} />}
                {mode === 'suggestions' && <SuggestionsView onOpenEntity={openEntity} />}
                {mode === 'explorer' && <ExplorerView {...props} initialTechniqueId={selectedTechniqueId} onOpenEntity={openEntity} />}
                {mode === 'matrix' && <MatrixView onOpenTechnique={openTechnique} />}
                {mode === 'entity' && <EntityView selected={selectedEntity} onSelect={setSelectedEntity} onOpenTechnique={openTechnique} {...props} />}
                {mode === 'compare' && <CompareView />}
                {mode === 'mappings' && <MappingsListView onOpenEntity={openEntity} />}
            </div>
        </div>
    );
};

// §75 DASHBOARD — real counts only.
const DashboardView: React.FC<{ onOpenTechnique: (id: string) => void; onOpenEntity: (type: string, id: string, label: string) => void }> = ({ onOpenTechnique, onOpenEntity }) => {
    const [dash, setDash] = useState<MitreDashboard | null>(null);
    const [autoSummary, setAutoSummary] = useState<MitreSuggestionsSummary | null>(null);
    useEffect(() => { getMitreDashboard().then(setDash).catch(() => {}); getMitreSuggestionsSummary().then(setAutoSummary).catch(() => {}); }, []);
    if (!dash) return <div className="ti-empty">Loading dashboard…</div>;
    return (
        <>
            <div className="ti-kpi-row" style={{ marginBottom: '16px' }}>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.techniquesTotal}</div><div className="ti-kpi-label">Techniques</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.mappedEntities}</div><div className="ti-kpi-label">Mapped Entities</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.mappingsTotal}</div><div className="ti-kpi-label">Mappings</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.confirmed}</div><div className="ti-kpi-label">Confirmed</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.suggested}</div><div className="ti-kpi-label">Suggested</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{dash.rejected}</div><div className="ti-kpi-label">Rejected</div></div>
            </div>
            {/* MITRE_MAPPER_PHASE2.md §75/§76 — Automatic Suggestions panel, real counts only. */}
            {autoSummary && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Automatic Suggestions</div>
                    <div className="ti-kpi-row">
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{autoSummary.newSuggestions}</div><div className="ti-kpi-label">New Suggestions</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{autoSummary.highConfidence}</div><div className="ti-kpi-label">High Confidence</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{autoSummary.needsReview}</div><div className="ti-kpi-label">Needs Review (Stale)</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{autoSummary.recentlyConfirmed}</div><div className="ti-kpi-label">Recently Confirmed (7d)</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{autoSummary.recentlyRejected}</div><div className="ti-kpi-label">Recently Rejected (7d)</div></div>
                    </div>
                </div>
            )}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Top Techniques</div>
                {dash.topTechniques.length === 0 ? <div className="ti-empty">No mappings yet.</div> : (
                    <ul className="ti-list">
                        {dash.topTechniques.map((t) => (
                            <li key={t.techniqueId} className="ti-row-clickable" onClick={() => onOpenTechnique(t.techniqueId)}>
                                <strong>{t.techniqueId}</strong> {t.name} <span className="ti-badge">{t.count} mapping{t.count === 1 ? '' : 's'}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            <div className="ti-card">
                <div className="ti-card-title">Recent Mappings</div>
                {dash.recentMappings.length === 0 ? <div className="ti-empty">No mappings yet.</div> : (
                    <table className="ti-table">
                        <thead><tr><th>Entity</th><th>Technique</th><th>Confidence</th><th>Status</th><th>Updated</th></tr></thead>
                        <tbody>
                            {dash.recentMappings.map((m) => (
                                <tr key={m.id} className="ti-row-clickable" onClick={() => onOpenEntity(m.entityType!, m.entityId!, m.entityLabel!)}>
                                    <td>{m.entityLabel}</td>
                                    <td>{m.techniqueId} {m.techniqueName}</td>
                                    <td>{m.confidence || 'Not Available'}</td>
                                    <td><span className="ti-badge" style={STATUS_COLOR[m.reviewStatus || '']}>{m.reviewStatus}</span></td>
                                    <td className="ti-note">{m.updatedAt ? formatDateTime(m.updatedAt) : '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </>
    );
};

// MITRE_MAPPER_PHASE2.md §36/§65 SUGGESTIONS / REVIEW QUEUE — Confirm/Reject
// and Bulk Review (both reuse reviewMitreMapping's own per-item RBAC/
// validation/audit path, never a shortcut), plus an explicit, analyst-
// triggered "Recalculate Suggestions" action for one entity at a time.
const SuggestionsView: React.FC<{ onOpenEntity: (type: string, id: string, label: string) => void }> = ({ onOpenEntity }) => {
    const [items, setItems] = useState<MitreMapping[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [filters, setFilters] = useState({ entityType: '', status: 'suggested', confidence: '', source: '', staleOnly: '' });
    const [search, setSearch] = useState('');
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [msg, setMsg] = useState<string | null>(null);
    const [recalcTarget, setRecalcTarget] = useState<{ type: string; id: string; label: string } | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback((p = 1) => {
        getMitreSuggestionsQueue({ ...filters, search: search || undefined, page: p, pageSize }).then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); setSelected(new Set()); });
    }, [filters, search]);
    useEffect(() => { load(1); }, [load]);

    const toggle = (id: number) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const bulkReview = async (action: 'confirmed' | 'rejected') => {
        if (!selected.size) return;
        setBusy(true); setMsg(null);
        try {
            const res = await bulkReviewMitreMappings([...selected], action);
            setMsg(`${res.succeeded.length} mapping(s) ${action}${res.failed.length ? `, ${res.failed.length} failed` : ''}.`);
            load(page);
        } catch (e: any) { setMsg(e?.message || 'Bulk review failed.'); } finally { setBusy(false); }
    };
    const review = async (id: number, action: 'confirmed' | 'rejected') => { await reviewMitreMapping(id, action).catch((e) => setMsg(e?.message)); load(page); };
    const recalc = async () => {
        if (!recalcTarget) return;
        setBusy(true); setMsg(null);
        try {
            const res = await recalculateMitreSuggestions(recalcTarget.type, recalcTarget.id);
            setMsg(`Recalculated: ${res.created.length} new, ${res.merged.length} merged with additional sources, ${res.skippedConfirmed.length} left Confirmed, ${res.skippedRejected.length} left Rejected.`);
            load(1);
        } catch (e: any) { setMsg(e?.message || 'Recalculation failed.'); } finally { setBusy(false); }
    };

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Recalculate Suggestions</div>
                <div className="ti-note" style={{ marginBottom: '6px' }}>Explicit, analyst-triggered scan of an entity's Evidence/Timeline (Case Findings too, for a Case) for deterministic technique candidates. Never runs automatically.</div>
                {recalcTarget ? (
                    <div>{recalcTarget.label} <span className="ti-badge">{recalcTarget.type}</span> <button type="button" className="ti-action-btn" onClick={() => setRecalcTarget(null)}>×</button> <button type="button" className="ti-action-btn" onClick={recalc} disabled={busy}>{busy ? 'Working…' : 'Recalculate'}</button></div>
                ) : <EntitySearchPicker onPick={(type, id, label) => setRecalcTarget({ type, id, label })} />}
            </div>

            {msg && <div className="ti-note" style={{ marginBottom: '10px' }}>{msg}</div>}

            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <input type="text" placeholder="Search reason, technique, source…" value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} />
                <select value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}>
                    <option value="">All Entity Types</option>{ENTITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="suggested">Suggested (Queue)</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option><option value="">Any Status</option>
                </select>
                <select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
                    <option value="">Any Source</option><option value="Automatic Suggestion Engine">Automatic Suggestion Engine</option><option value="Analyst">Analyst (Manual)</option>
                </select>
                <select value={filters.confidence} onChange={(e) => setFilters((f) => ({ ...f, confidence: e.target.value }))}>
                    <option value="">All Confidence</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                </select>
                <select value={filters.staleOnly} onChange={(e) => setFilters((f) => ({ ...f, staleOnly: e.target.value }))}>
                    <option value="">Stale: Any</option><option value="true">Needs Review Only</option>
                </select>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <button type="button" className="ti-action-btn" disabled={!selected.size || busy} onClick={() => bulkReview('confirmed')}>Bulk Confirm ({selected.size})</button>
                <button type="button" className="ti-action-btn" disabled={!selected.size || busy} onClick={() => bulkReview('rejected')}>Bulk Reject ({selected.size})</button>
            </div>

            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th></th><th>Entity</th><th>Technique</th><th>Source</th><th>Reason</th><th>Confidence</th><th>Status</th><th>Sources</th><th></th></tr></thead>
                    <tbody>
                        {items.length === 0 ? <tr><td colSpan={9} className="ti-empty">No suggestions match these filters.</td></tr> : items.map((m) => (
                            <tr key={m.id}>
                                <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggle(m.id)} /></td>
                                <td className="ti-row-clickable" onClick={() => onOpenEntity(m.entityType!, m.entityId!, m.entityLabel!)}>{m.entityLabel}</td>
                                <td>{m.techniqueId} {m.techniqueName}</td>
                                <td className="ti-note">{m.source}</td>
                                <td className="ti-note">{m.reason}</td>
                                <td>{m.confidence || 'Not Available'}</td>
                                <td><span className="ti-badge" style={STATUS_COLOR[m.reviewStatus || '']}>{m.reviewStatus}</span>{m.stale && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Needs Review</span>}</td>
                                <td className="ti-note">{1 + (m.sources?.length || 0)} source{(1 + (m.sources?.length || 0)) === 1 ? '' : 's'}</td>
                                <td>{m.reviewStatus === 'suggested' && (<><button type="button" className="ti-action-btn" onClick={() => review(m.id, 'confirmed')}>Confirm</button>{' '}<button type="button" className="ti-action-btn" onClick={() => review(m.id, 'rejected')}>Reject</button></>)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} nextDisabled={page * pageSize >= total} />
        </>
    );
};

// §5/§6 TECHNIQUE EXPLORER / DETAIL — the base list/overview reuse the
// EXISTING /api/intelligence/attack/* endpoints verbatim (already used by
// Threat Intelligence's own ATT&CK section); detail is mapping-enriched.
const ExplorerView: React.FC<{ initialTechniqueId: string | null; onOpenEntity: (type: string, id: string, label: string) => void } & Omit<MitreMapperPageProps, 'onOpenEntity'>> = ({ initialTechniqueId, onOpenEntity, onOpenKnowledgeEntry, onCreateKnowledgeEntry }) => {
    const [overview, setOverview] = useState<AttackOverview | null>(null);
    const [items, setItems] = useState<{ technique_id: string; name: string; tactic: string; tactics?: string[]; observed_count?: number; related_iocs_count?: number }[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [q, setQ] = useState('');
    const [tactic, setTactic] = useState('');
    const [detail, setDetail] = useState<MitreTechniqueDetail | null>(null);
    const [openId, setOpenId] = useState<string | null>(initialTechniqueId);

    useEffect(() => { getAttackOverview().then(setOverview).catch(() => {}); }, []);
    const load = useCallback((p = 1) => {
        getAttackTechniques({ q: q || undefined, tactic: tactic || undefined, page: p, pageSize }).then((d: any) => { setItems(d.items); setTotal(d.total); setPage(d.page); });
    }, [q, tactic]);
    useEffect(() => { load(1); }, [load]);
    useEffect(() => { if (openId) getMitreTechniqueDetail(openId).then(setDetail).catch(() => setDetail(null)); }, [openId]);

    if (openId) {
        return (
            <>
                <button type="button" className="ti-action-btn" onClick={() => { setOpenId(null); setDetail(null); }} style={{ marginBottom: '10px' }}>‹ Back to Technique List</button>
                {!detail ? <div className="ti-empty">Loading technique…</div> : (
                    <>
                        <div className="ti-card" style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title">{detail.technique_id} — {detail.name}</div>
                            <div className="ti-kv">
                                <span className="k">Tactics</span><span className="v">{detail.tactics.join(', ') || detail.tactic}</span>
                                {detail.parentTechniqueId && <><span className="k">Parent</span><span className="v"><a onClick={() => setOpenId(detail.parentTechniqueId!)} style={{ cursor: 'pointer', color: '#00e5ff' }}>{detail.parentTechniqueId}</a></span></>}
                                <span className="k">Description</span><span className="v">{detail.description || 'Not Available'}</span>
                                {detail.url && <><span className="k">MITRE Reference</span><span className="v ti-note">{detail.url}</span></>}
                            </div>
                        </div>
                        <div className="ti-card" style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title">Mapped Entities ({detail.mappedEntities.length}) — Sources: {detail.mappingSourceCount}</div>
                            <div className="ti-note" style={{ marginBottom: '6px' }}>Suggested: {detail.mappingCounts.suggested} · Confirmed: {detail.mappingCounts.confirmed} · Rejected: {detail.mappingCounts.rejected}</div>
                            {detail.mappedEntities.length === 0 ? <div className="ti-empty">No analyst mappings reference this technique yet.</div> : (
                                <ul className="ti-list">
                                    {detail.mappedEntities.map((m) => (
                                        <li key={m.id} className="ti-row-clickable" onClick={() => onOpenEntity(m.entityType!, m.entityId!, m.entityLabel!)} style={{ padding: '6px 0' }}>
                                            <span className="ti-badge">{m.entityType}</span> {m.entityLabel} <span className="ti-badge" style={STATUS_COLOR[m.reviewStatus || '']}>{m.reviewStatus}</span>
                                            {m.confidence && <span className="ti-note"> Confidence: {m.confidence}</span>} <span className="ti-note">— {m.reason}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                        {(detail.relatedCampaigns.length > 0 || detail.relatedIocs.length > 0 || detail.relatedThreatActors.length > 0 || detail.relatedMalware.length > 0) && (
                            <div className="ti-card">
                                <div className="ti-card-title">Existing Relationships</div>
                                {/* P1-8 — the retired ATT&CK section rendered these as
                                    EntityChips that open the entity; plain text here
                                    was a dead end. Same onOpenEntity the mapped-entity
                                    list above already uses. */}
                                {detail.relatedThreatActors.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <strong>Threat Actors:</strong>
                                        {detail.relatedThreatActors.map((t, i) => <EntityChip key={i} entity={t as any} onOpen={(type, id) => onOpenEntity(type, id, (t as any).label ?? id)} />)}
                                    </div>
                                )}
                                {detail.relatedMalware.length > 0 && (
                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                                        <strong>Malware:</strong>
                                        {detail.relatedMalware.map((m, i) => <EntityChip key={i} entity={m as any} onOpen={(type, id) => onOpenEntity(type, id, (m as any).label ?? id)} />)}
                                    </div>
                                )}
                                {detail.relatedCampaigns.length > 0 && <div><strong>Campaigns:</strong> {detail.relatedCampaigns.map((c) => c.name).join(', ')}</div>}
                                {detail.relatedIocs.length > 0 && <div><strong>IOCs:</strong> {detail.relatedIocs.length} indicator(s)</div>}
                            </div>
                        )}
                        {/* KNOWLEDGE_BASE_PHASE2.md §12 "KNOWLEDGE TO MITRE" — CASE 2's
                            own worked example (T1566 Phishing). This lived only on the
                            retired Threat Intelligence › MITRE ATT&CK detail view, so
                            without it the merge would have silently dropped a
                            documented integration point. */}
                        <KnowledgeContextPanel entityType="attack_technique" entityId={detail.technique_id} entityLabel={`${detail.technique_id} ${detail.name}`} defaultCategory="MITRE ATT&CK"
                            onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                    </>
                )}
            </>
        );
    }

    return (
        <>
{/* P1-8 — the catalogue overview the retired Threat Intelligence › MITRE
                ATT&CK section rendered: the tactic distribution bars and the recent
                campaign→technique mappings. This page already fetched
                getAttackOverview() but used only its tacticCounts to fill the
                dropdown below, so both were dropping on the floor. */}
            {overview && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-kv" style={{ marginBottom: '14px' }}>
                        <span className="k">Techniques Observed</span><span className="v">{overview.techniquesObserved}</span>
                        <span className="k">Tactics Observed</span><span className="v">{overview.tacticsObserved}</span>
                    </div>
                    <div className="ti-modal-subtitle">Tactics (by observed technique mappings)</div>
                    {overview.tacticCounts.length === 0 ? (
                        <div className="ti-empty">No ATT&CK mappings found yet.</div>
                    ) : (
                        <div className="ti-bar-list">
                            {overview.tacticCounts.map((t) => (
                                <div className="ti-bar-row" key={t.tactic}>
                                    <span className="ti-bar-label" title={t.tactic}>{t.tactic}</span>
                                    <span className="ti-bar-track"><span className="ti-bar-fill" style={{ width: `${(t.count / Math.max(1, ...overview.tacticCounts.map((x) => x.count))) * 100}%` }} /></span>
                                    <span className="ti-bar-count">{t.count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {overview.recentMappings.length > 0 && (
                        <div style={{ marginTop: '14px' }}>
                            <div className="ti-modal-subtitle">Recent Technique Mappings</div>
                            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                {overview.recentMappings.map((m, idx) => (
                                    <div key={idx} style={{ fontSize: '0.85rem', padding: '4px 0' }}>
                                        <strong>{m.campaign_name}</strong> → {m.technique_id} {m.technique_name} ({(m.tactics && m.tactics.length ? m.tactics : [m.tactic]).join(', ')})
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <input type="text" placeholder="Search T1059, PowerShell, tactic, description…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} />
                <select value={tactic} onChange={(e) => setTactic(e.target.value)}>
                    <option value="">All Tactics</option>
                    {(overview?.tacticCounts || []).map((t) => <option key={t.tactic} value={t.tactic}>{t.tactic}</option>)}
                </select>
                <button type="button" className="ti-action-btn" onClick={() => load(1)}>Apply</button>
            </div>
            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>ID</th><th>Name</th><th>Tactic(s)</th><th>Observed</th><th>Related IOCs</th></tr></thead>
                    <tbody>
                        {items.length === 0 ? <tr><td colSpan={5} className="ti-empty">No techniques found.</td></tr> : items.map((t) => (
                            <tr key={t.technique_id} className="ti-row-clickable" onClick={() => setOpenId(t.technique_id)}>
                                <td>{t.technique_id}</td><td>{t.name}</td><td>{(t.tactics && t.tactics.length ? t.tactics : [t.tactic]).join(', ')}</td><td>{t.observed_count ?? 0}</td><td>{t.related_iocs_count ?? 0}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} nextDisabled={page * pageSize >= total} />
        </>
    );
};

// §8 MATRIX VIEW — real technique/sub-technique/tactic placement, never
// hardcoded positions; a technique with multiple real tactics appears
// under every one of them (the same convention §60/attack_technique_tactics
// already establishes elsewhere in this codebase).
const MATRIX_STATUS_OPTIONS: { value: string; label: string }[] = [
    { value: '', label: 'All' }, { value: 'confirmed', label: 'Confirmed' }, { value: 'suggested', label: 'Suggested' },
    { value: 'rejected', label: 'Rejected' }, { value: 'sample_derived', label: 'Sample-derived' },
];
const MatrixView: React.FC<{ onOpenTechnique: (id: string) => void }> = ({ onOpenTechnique }) => {
    const [tactics, setTactics] = useState<MitreTactic[]>([]);
    const [byTactic, setByTactic] = useState<Record<string, { technique_id: string; name: string; tactics?: string[] }[]>>({});
    const [loading, setLoading] = useState(true);
    // MITRE_MAPPER_PHASE2.md §7 MATRIX STATUS FILTER — org-wide, RBAC-
    // filtered per-technique aggregate counts; a technique not matching the
    // selected status is dimmed rather than removed, so the matrix's real
    // shape (every technique, every tactic) never changes under a filter.
    const [status, setStatus] = useState('');
    const [byTechniqueStatus, setByTechniqueStatus] = useState<Record<string, MitreMatrixEntry>>({});
    // MITRE_MAPPER_PHASE3.md §11-§14/§80-§82 CONFIDENCE HEATMAP / MATRIX
    // VISUALIZATION — an overlay, never a replacement: toggling it off
    // returns to the plain Phase 2 status view; §81 "Do not remove
    // nonmatching techniques from the matrix. Dim them. Preserve ATT&CK
    // structure" applies identically to both modes.
    const [heatmapOn, setHeatmapOn] = useState(false);
    const [heatmapByTechnique, setHeatmapByTechnique] = useState<Record<string, MitreHeatmapCell>>({});
    const HEATMAP_TIER_COLOR: Record<number, string> = { 0: 'rgba(148,163,184,0.10)', 1: 'rgba(234,179,8,0.10)', 2: 'rgba(234,179,8,0.22)', 3: 'rgba(74,222,128,0.16)', 4: 'rgba(74,222,128,0.32)' };

    useEffect(() => {
        Promise.all([getMitreTactics(), getAttackTechniques({ pageSize: 200 })]).then(([tacticList, techPage]: any) => {
            setTactics(tacticList);
            const grouped: Record<string, any[]> = {};
            for (const t of techPage.items) {
                const list = t.tactics && t.tactics.length ? t.tactics : [t.tactic];
                for (const tac of list) { if (!grouped[tac]) grouped[tac] = []; grouped[tac].push(t); }
            }
            setByTactic(grouped);
        }).finally(() => setLoading(false));
    }, []);
    useEffect(() => { getMitreMatrixData(status || undefined).then((entries) => { setByTechniqueStatus(Object.fromEntries(entries.map((e) => [e.techniqueId, e]))); }).catch(() => setByTechniqueStatus({})); }, [status]);
    useEffect(() => { if (heatmapOn) getMitreHeatmap(status || undefined).then((d) => setHeatmapByTechnique(Object.fromEntries(d.cells.map((c) => [c.techniqueId, c])))).catch(() => setHeatmapByTechnique({})); }, [heatmapOn, status]);

    if (loading) return <div className="ti-empty">Loading matrix…</div>;
    return (
        <>
            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <select value={status} onChange={(e) => setStatus(e.target.value)}>
                    {MATRIX_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>Status: {o.label}</option>)}
                </select>
                <button type="button" className="ti-action-btn" style={heatmapOn ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setHeatmapOn((s) => !s)}>{heatmapOn ? 'Heatmap: On' : 'Heatmap: Off'}</button>
            </div>
            {heatmapOn && <div className="ti-note" style={{ marginBottom: '8px' }}>Confidence Heatmap — deterministic tier, never an unexplained AI score. 4=Confirmed+High, 3=Confirmed+Medium/Low, 2=Suggested+High, 1=Suggested+Medium/Low, 0=Rejected/Observed-only.</div>}
            <div className="ti-note" style={{ overflowX: 'auto' }}>
                <div style={{ display: 'flex', gap: '10px', minWidth: 'max-content', paddingBottom: '10px' }}>
                    {tactics.map((t) => (
                        <div key={t.tactic} className="ti-card" style={{ minWidth: '200px', maxWidth: '220px' }}>
                            <div className="ti-card-title">{t.tactic} <span className="ti-badge">{t.techniqueCount}</span></div>
                            <div style={{ maxHeight: '420px', overflowY: 'auto' }}>
                                {(byTactic[t.tactic] || []).slice(0, 200).map((tech) => {
                                    const entry = byTechniqueStatus[tech.technique_id];
                                    const matches = !status || (entry && (
                                        (status === 'confirmed' && entry.confirmed > 0) || (status === 'suggested' && entry.suggested > 0) ||
                                        (status === 'rejected' && entry.rejected > 0) || (status === 'sample_derived' && entry.sampleDerived > 0)
                                    ));
                                    const heatCell = heatmapByTechnique[tech.technique_id];
                                    const background = heatmapOn ? HEATMAP_TIER_COLOR[heatCell?.tier ?? 0] : (status && matches ? 'rgba(0,229,255,0.08)' : undefined);
                                    return (
                                        <div key={tech.technique_id} className="ti-row-clickable" title={heatmapOn ? (heatCell ? heatCell.tierLabel : 'No reviewed mapping') : (entry ? `Confirmed ${entry.confirmed} · Suggested ${entry.suggested} · Rejected ${entry.rejected} · Sample-derived ${entry.sampleDerived}` : undefined)}
                                            style={{ padding: '4px 2px', fontSize: '0.82rem', borderBottom: '1px solid rgba(255,255,255,0.05)', opacity: matches ? 1 : 0.35, background }}
                                            onClick={() => onOpenTechnique(tech.technique_id)}>
                                            {tech.technique_id.includes('.') && <span className="ti-note" style={{ marginRight: '2px' }}>↳</span>}
                                            {tech.technique_id} {tech.name}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </>
    );
};

// §9/§10 SOURCE + ENTITY SELECTION — reuses the SAME debounced
// search-as-you-type pattern Report Generator's own EntityPicker uses.
const EntitySearchPicker: React.FC<{ onPick: (type: string, id: string, label: string) => void }> = ({ onPick }) => {
    const [itemType, setItemType] = useState<MitreEntityType>('threat_actor');
    const [q, setQ] = useState('');
    const [results, setResults] = useState<MitreEntitySearchResult[]>([]);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (!q.trim()) { setResults([]); setOpen(false); return; }
        const handle = setTimeout(() => { searchMitreEntities(itemType, q.trim(), 20).then((r) => { setResults(r.items); setOpen(true); }).catch(() => setResults([])); }, 300);
        return () => clearTimeout(handle);
    }, [itemType, q]);

    return (
        <div style={{ position: 'relative' }}>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <select value={itemType} onChange={(e) => { setItemType(e.target.value as MitreEntityType); setQ(''); setResults([]); }}>
                    {ENTITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <input type="text" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} style={{ minWidth: '260px' }} onFocus={() => q.trim() && setOpen(true)} />
            </div>
            {open && (
                <div className="ti-card" style={{ marginTop: '6px', maxHeight: '260px', overflowY: 'auto' }}>
                    {results.length === 0 ? <div className="ti-empty">No matches.</div> : (
                        <ul className="ti-list">
                            {results.map((r) => (
                                <li key={r.id} className="ti-row-clickable" style={{ padding: '4px 0' }} onClick={() => { onPick(itemType, r.id, r.label); setQ(''); setOpen(false); }}>{r.label}</li>
                            ))}
                        </ul>
                    )}
                    <button type="button" className="ti-action-btn" onClick={() => setOpen(false)}>Close</button>
                </div>
            )}
        </div>
    );
};

// §19-§28/§74/§76 ENTITY VIEW — Known Techniques grouped by tactic, each
// with Source/Confidence/Evidence/Status; §11 Manual Mapping; §39 Review.
// MITRE_MAPPER_PHASE2.md additions: Malware Sample as a viewable-only
// entity (Confirm/Reject delegates to reviewMalwareSampleTechnique), a
// Malware Family's own Sample-derived rollup (never merged into Direct),
// Coverage, and Entity Evolution.
const EntityView: React.FC<{ selected: { type: string; id: string; label: string } | null; onSelect: (e: { type: string; id: string; label: string } | null) => void; onOpenTechnique: (id: string) => void } & MitreMapperPageProps> = ({ selected, onSelect, onOpenTechnique, onOpenEntity, onOpenCase, onViewNotesForEntity, onViewKnowledge }) => {
    const [view, setView] = useState<MitreEntityView | null>(null);
    const [conflicts, setConflicts] = useState<MitreConflict[]>([]);
    const [coverage, setCoverage] = useState<MitreCoverage | null>(null);
    const [familyCoverage, setFamilyCoverage] = useState<MitreFamilyCoverage | null>(null);
    const [evolution, setEvolution] = useState<MitreEvolutionEvent[]>([]);
    const [trend, setTrend] = useState<{ windows: Record<'7d' | '30d' | '90d', { eventCount: number; techniqueEvents: number }>; adoption: MitreAdoptionEntry[] } | null>(null);
    const [detectionCoverage, setDetectionCoverage] = useState<MitreDetectionCoverage | null>(null);
    const [detectionGaps, setDetectionGaps] = useState<MitreDetectionGap[] | null>(null);
    const [showMapForm, setShowMapForm] = useState(false);
    const [showCoverage, setShowCoverage] = useState(false);
    const [showEvolution, setShowEvolution] = useState(false);
    const [showDetection, setShowDetection] = useState(false);
    const [showAi, setShowAi] = useState(false);
    const [msg, setMsg] = useState<string | null>(null);
    const [sampleIdInput, setSampleIdInput] = useState('');

    const isSample = selected?.type === 'malware_sample';
    const isMalwareFamily = selected?.type === 'malware';

    const load = useCallback(() => {
        if (!selected) return;
        getMitreEntityView(selected.type, selected.id).then(setView).catch((e) => setMsg(e?.message || 'Failed to load entity.'));
        if (!isSample) getMitreConflicts(selected.type, selected.id).then(setConflicts).catch(() => setConflicts([]));
        else setConflicts([]);
        setFamilyCoverage(null);
    }, [selected, isSample]);
    useEffect(() => { setView(null); setMsg(null); setCoverage(null); setEvolution([]); setTrend(null); setDetectionCoverage(null); setDetectionGaps(null); setShowCoverage(false); setShowEvolution(false); setShowDetection(false); setShowAi(false); load(); }, [load]);

    const review = async (mappingId: number, action: 'confirmed' | 'rejected') => {
        await reviewMitreMapping(mappingId, action).catch((e) => setMsg(e?.message)); load();
    };
    const remove = async (mappingId: number) => { await removeMitreMapping(mappingId).catch((e) => setMsg(e?.message)); load(); };
    const reviewSample = async (techniqueId: string, action: 'confirmed' | 'rejected') => {
        if (!selected) return;
        await reviewMalwareSampleTechnique(selected.id, techniqueId, action).catch((e) => setMsg(e?.message)); load();
    };
    const loadCoverage = () => {
        if (!selected) return;
        setShowCoverage((s) => !s);
        if (!coverage) getMitreCoverage(selected.type, selected.id).then(setCoverage).catch((e) => setMsg(e?.message));
    };
    const loadEvolution = () => {
        if (!selected) return;
        setShowEvolution((s) => !s);
        if (!evolution || evolution.length === 0) {
            getMitreEntityEvolution(selected.type, selected.id).then((d) => setEvolution(d.timeline)).catch((e) => setMsg(e?.message));
            getMitreTechniqueTrend(selected.type, selected.id).then((d) => setTrend({ windows: d.windows, adoption: d.adoption })).catch(() => setTrend(null));
        }
    };
    const loadFamilyCoverage = () => { if (selected) getMalwareFamilyCoverage(selected.id).then(setFamilyCoverage).catch((e) => setMsg(e?.message)); };
    const loadDetection = () => {
        if (!selected) return;
        setShowDetection((s) => !s);
        if (!detectionCoverage) {
            getMitreDetectionCoverage(selected.type, selected.id).then(setDetectionCoverage).catch((e) => setMsg(e?.message));
            getMitreDetectionGaps(selected.type, selected.id).then((d) => setDetectionGaps(d.gaps)).catch(() => setDetectionGaps([]));
        }
    };

    if (!selected) {
        return (
            <div className="ti-card">
                <div className="ti-card-title">Select an Entity</div>
                <EntitySearchPicker onPick={(type, id, label) => onSelect({ type, id, label })} />
                <div className="ti-note" style={{ marginTop: '10px' }}>
                    Malware Sample (view-only — a sample's own technique findings, reviewed the same way Malware Analysis already reviews them):{' '}
                    <input type="text" placeholder="Sample ID" value={sampleIdInput} onChange={(e) => setSampleIdInput(e.target.value)} style={{ width: '100px' }} />{' '}
                    <button type="button" className="ti-action-btn" disabled={!sampleIdInput.trim()} onClick={() => { onSelect({ type: 'malware_sample', id: sampleIdInput.trim(), label: `Sample #${sampleIdInput.trim()}` }); setSampleIdInput(''); }}>Open</button>
                </div>
            </div>
        );
    }

    const grouped: Record<string, MitreEntityView['techniques']> = {};
    for (const t of view?.techniques || []) { const tacs = t.tactics && t.tactics.length ? t.tactics : ['Unclassified']; for (const tac of tacs) { if (!grouped[tac]) grouped[tac] = []; grouped[tac].push(t); } }

    return (
        <>
            <button type="button" className="ti-action-btn" onClick={() => onSelect(null)} style={{ marginBottom: '10px' }}>‹ Change Entity</button>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">{selected.label} <span className="ti-badge">{selected.type}</span>{view?.entity.isAptGroup && <span className="ti-badge">APT Group</span>}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
                    {onOpenEntity && MAPPABLE_ENTITY_TYPES.has(selected.type) && <button type="button" className="ti-action-btn" onClick={() => selected.type === 'case' ? onOpenCase?.(Number(selected.id)) : onOpenEntity(selected.type, selected.id)}>View in {selected.type === 'case' ? 'Cases' : 'Threat Intelligence'}</button>}
                    {onViewNotesForEntity && selected.type !== 'case' && selected.type !== 'malware_sample' && <button type="button" className="ti-action-btn" onClick={() => onViewNotesForEntity(selected.type, selected.id, selected.label)}>Notes</button>}
                    {onViewKnowledge && selected.type !== 'case' && selected.type !== 'malware_sample' && <button type="button" className="ti-action-btn" onClick={() => onViewKnowledge(selected.type, selected.id, selected.label)}>Knowledge</button>}
                    {view && !view.mappingsDisabled && !isSample && <button type="button" className="ti-action-btn" onClick={() => setShowMapForm((s) => !s)}>Map Technique</button>}
                    {!isSample && <button type="button" className="ti-action-btn" onClick={loadCoverage}>{showCoverage ? 'Hide' : 'Show'} Coverage</button>}
                    {!isSample && <button type="button" className="ti-action-btn" onClick={loadEvolution}>{showEvolution ? 'Hide' : 'Show'} Evolution</button>}
                    {!isSample && <button type="button" className="ti-action-btn" onClick={loadDetection}>{showDetection ? 'Hide' : 'Show'} Detection Coverage</button>}
                    {isMalwareFamily && <button type="button" className="ti-action-btn" onClick={loadFamilyCoverage}>Family Coverage (Direct + Sample + Combined)</button>}
                    {!isSample && <button type="button" className="ti-action-btn" onClick={() => setShowAi((s) => !s)}>{showAi ? 'Hide' : 'Show'} AI MITRE Analyst</button>}
                </div>
                {msg && <div className="ti-error" style={{ marginTop: '8px' }}>{msg}</div>}
            </div>

            {view?.mappingsDisabled && <div className="ti-card" style={{ marginBottom: '16px' }}><div className="ti-empty">{view.reason}</div></div>}

            {showAi && !isSample && <AiMitreAnalystPanel entityType={selected.type} entityId={selected.id} hasConflicts={conflicts.length > 0} onSuggestionAccepted={load} />}

            {showDetection && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Detection Coverage (Sigma / YARA)</div>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>Detection Rule Support is context only — it never confirms an ATT&CK mapping by itself.</div>
                    {!detectionCoverage || detectionCoverage.rows.length === 0 ? <div className="ti-empty">No techniques to show detection coverage for yet.</div> : (
                        <div className="ti-table-wrap">
                            <table className="ti-table">
                                <thead><tr><th>Technique</th><th>Evidence</th><th>Sigma</th><th>YARA</th><th>Behavior</th><th>Analyst</th></tr></thead>
                                <tbody>
                                    {detectionCoverage.rows.map((r) => (
                                        <tr key={r.techniqueId}>
                                            <td>{r.techniqueId} {r.techniqueName}</td>
                                            <td>{r.evidence ? '✓' : '—'}</td>
                                            <td>{r.sigma || '—'}</td>
                                            <td>{r.yara || '—'}</td>
                                            <td>{r.behavior ? '✓' : '—'}</td>
                                            <td>{r.analyst}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {detectionGaps && detectionGaps.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            <div className="ti-card-title" style={{ fontSize: '0.9rem' }}>Detection Gaps</div>
                            <ul className="ti-list">{detectionGaps.map((g) => <li key={g.techniqueId}>{g.techniqueId} {g.techniqueName} ({g.mappingStatus}) — {g.detectionGap}</li>)}</ul>
                        </div>
                    )}
                </div>
            )}

            {showMapForm && view && (
                <MapTechniqueForm entityType={selected.type} entityId={selected.id} onDone={() => { setShowMapForm(false); load(); }} onCancel={() => setShowMapForm(false)} />
            )}

            {showCoverage && coverage && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Coverage by Tactic</div>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>{coverage.note}</div>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Tactic</th><th>Confirmed</th><th>Suggested</th><th>Rejected</th><th>Existing Relationship</th><th>Sample-derived</th></tr></thead>
                            <tbody>
                                {coverage.tacticCoverage.map((r) => (<tr key={r.tactic}><td>{r.tactic}</td><td>{r.confirmed}</td><td>{r.suggested}</td><td>{r.rejected}</td><td>{r.existingRelationship}</td><td>{r.sampleDerived}</td></tr>))}
                                <tr style={{ fontWeight: 600 }}><td>Total</td><td>{coverage.totals.confirmed}</td><td>{coverage.totals.suggested}</td><td>{coverage.totals.rejected}</td><td>{coverage.totals.existingRelationship}</td><td>{coverage.totals.sampleDerived}</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {showEvolution && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Technique Evolution</div>
                    {/* MITRE_MAPPER_PHASE3.md §15-§17 EVOLUTION TIMELINE — a
                        visual timeline (vertical line + dated dots), every
                        entry from a real, stored timestamp (§16 "never
                        frontend render time" — formatDateTime only ever
                        formats e.createdAt, it never generates a date). */}
                    {(!evolution || evolution.length === 0) ? <div className="ti-empty">No mapping history yet.</div> : (
                        <div style={{ position: 'relative', paddingLeft: '18px', borderLeft: '2px solid rgba(255,255,255,0.1)' }}>
                            {evolution.map((e, i) => (
                                <div key={i} style={{ position: 'relative', paddingBottom: '10px' }}>
                                    <span style={{ position: 'absolute', left: '-23px', top: '3px', width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLOR[e.eventType.toLowerCase()]?.color || '#00e5ff' }} />
                                    <span className="ti-note">{e.createdAt ? formatDateTime(e.createdAt) : 'Unknown date'}</span> — <span className="ti-badge">{e.eventType}</span> {e.techniqueId || ''} <span className="ti-note">{e.source}{e.username ? ` (${e.username})` : ''}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {trend && (
                        <div style={{ marginTop: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '10px' }}>
                            <div className="ti-card-title" style={{ fontSize: '0.9rem' }}>Technique Trend &amp; Adoption</div>
                            <div className="ti-kv">
                                <span className="k">Last 7 days</span><span className="v">{trend.windows['7d'].eventCount} event(s), {trend.windows['7d'].techniqueEvents} technique-related</span>
                                <span className="k">Last 30 days</span><span className="v">{trend.windows['30d'].eventCount} event(s), {trend.windows['30d'].techniqueEvents} technique-related</span>
                                <span className="k">Last 90 days</span><span className="v">{trend.windows['90d'].eventCount} event(s), {trend.windows['90d'].techniqueEvents} technique-related</span>
                            </div>
                            {trend.adoption.length > 0 && (
                                <ul className="ti-list" style={{ marginTop: '6px' }}>
                                    {trend.adoption.map((a) => <li key={a.techniqueId}>{a.techniqueId} — <span className="ti-badge">{a.state}</span> <span className="ti-note">First seen {a.firstSeen ? formatDateTime(a.firstSeen) : 'Unknown'}, last seen {a.lastSeen ? formatDateTime(a.lastSeen) : 'Unknown'}</span></li>)}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            )}

            {familyCoverage && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Malware Family Coverage</div>
                    <div className="ti-kv">
                        <span className="k">Direct (Family)</span><span className="v">{familyCoverage.direct.count} technique(s) — Confirmed {familyCoverage.direct.confirmed}, Suggested {familyCoverage.direct.suggested}, Rejected {familyCoverage.direct.rejected}</span>
                        <span className="k">Sample-derived</span><span className="v">{familyCoverage.sampleDerived.count} technique(s) across {familyCoverage.sampleDerived.sampleCount} sample(s)</span>
                        <span className="k">Combined (Deduplicated)</span><span className="v">{familyCoverage.combined.count} unique technique(s)</span>
                    </div>
                </div>
            )}

            {conflicts.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">⚠ Mapping Conflicts — Not Auto-Resolved</div>
                    <ul className="ti-list">{conflicts.map((c) => (
                        <li key={c.techniqueId}>{c.techniqueId} {c.techniqueName} — accepted by {c.acceptedBy.map((a) => a.source).join(', ') || 'none'}, rejected by {c.rejectedBy.map((r) => r.source).join(', ') || 'none'}</li>
                    ))}</ul>
                </div>
            )}

            {isMalwareFamily && view?.sampleDerivedTechniques && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Sample-derived Techniques ({view.sampleDerivedSampleCount || 0} sample(s)) — never merged into this family's own Direct Techniques</div>
                    {view.sampleDerivedTechniques.length === 0 ? <div className="ti-empty">No linked samples have their own technique findings yet.</div> : (
                        <ul className="ti-list">
                            {view.sampleDerivedTechniques.map((t) => (
                                <li key={t.techniqueId} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <a onClick={() => onOpenTechnique(t.techniqueId)} style={{ cursor: 'pointer', color: '#00e5ff' }}>{t.techniqueId}</a> {t.techniqueName}
                                    <span className="ti-badge" style={{ marginLeft: '6px', ...STATUS_COLOR[t.status] }}>{t.status}</span>
                                    <span className="ti-note"> · From {t.sampleIds.length} sample(s)</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {!view ? <div className="ti-empty">Loading…</div> : view.techniques.length === 0 && !view.mappingsDisabled ? (
                <div className="ti-empty">No known ATT&CK techniques for this entity yet.</div>
            ) : (
                Object.entries(grouped).map(([tactic, techs]) => (
                    <div key={tactic} className="ti-card" style={{ marginBottom: '10px' }}>
                        <div className="ti-card-title">{tactic}</div>
                        <ul className="ti-list">
                            {techs.map((t) => (
                                <li key={`${t.techniqueId}:${t.id}`} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <a onClick={() => onOpenTechnique(t.techniqueId)} style={{ cursor: 'pointer', color: '#00e5ff' }}>{t.techniqueId}</a> {t.techniqueName}
                                    {t.reviewStatus && <span className="ti-badge" style={{ marginLeft: '6px', ...STATUS_COLOR[t.reviewStatus] }}>{t.reviewStatus}</span>}
                                    {t.stale && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Needs Review</span>}
                                    {t.confidence && <span className="ti-note"> · Confidence: {t.confidence}</span>}
                                    <span className="ti-note"> · Source: {t.source}</span>
                                    {t.sources && t.sources.length > 0 && <span className="ti-note"> · +{t.sources.length} additional source{t.sources.length === 1 ? '' : 's'}</span>}
                                    {t.reason && <div className="ti-note">{t.reason}</div>}
                                    {isSample ? (
                                        t.reviewStatus === 'suggested' && (
                                            <div style={{ marginTop: '4px' }}>
                                                <button type="button" className="ti-action-btn" onClick={() => reviewSample(t.techniqueId, 'confirmed')}>Confirm</button>{' '}
                                                <button type="button" className="ti-action-btn" onClick={() => reviewSample(t.techniqueId, 'rejected')}>Reject</button>
                                            </div>
                                        )
                                    ) : (
                                        <>
                                            {t.reviewStatus === 'suggested' && (
                                                <div style={{ marginTop: '4px' }}>
                                                    <button type="button" className="ti-action-btn" onClick={() => review(t.id, 'confirmed')}>Confirm</button>{' '}
                                                    <button type="button" className="ti-action-btn" onClick={() => review(t.id, 'rejected')}>Reject</button>{' '}
                                                    <button type="button" className="ti-action-btn" onClick={() => remove(t.id)}>Remove</button>
                                                </div>
                                            )}
                                            {t.reviewStatus && t.reviewStatus !== 'suggested' && (
                                                <div style={{ marginTop: '4px' }}><button type="button" className="ti-action-btn" onClick={() => remove(t.id)}>Remove</button></div>
                                            )}
                                        </>
                                    )}
                                </li>
                            ))}
                        </ul>
                    </div>
                ))
            )}
        </>
    );
};

// §11-§17 MANUAL TECHNIQUE MAPPING form — Technique search, Reason
// (required, §15), Confidence, optional Evidence (§16/§17).
const MapTechniqueForm: React.FC<{ entityType: string; entityId: string; onDone: () => void; onCancel: () => void }> = ({ entityType, entityId, onDone, onCancel }) => {
    const [techQuery, setTechQuery] = useState('');
    const [techOptions, setTechOptions] = useState<{ technique_id: string; name: string }[]>([]);
    const [techniqueId, setTechniqueId] = useState('');
    const [reason, setReason] = useState('');
    const [confidence, setConfidence] = useState<'' | 'Low' | 'Medium' | 'High'>('');
    const [evidence, setEvidence] = useState<MitreEvidenceItem[]>([]);
    const [evidenceId, setEvidenceId] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => { getMitreEntityEvidence(entityType, entityId).then(setEvidence).catch(() => setEvidence([])); }, [entityType, entityId]);
    useEffect(() => {
        if (!techQuery.trim()) { setTechOptions([]); return; }
        const handle = setTimeout(() => { getAttackTechniques({ q: techQuery.trim(), pageSize: 10 }).then((d: any) => setTechOptions(d.items)).catch(() => setTechOptions([])); }, 300);
        return () => clearTimeout(handle);
    }, [techQuery]);

    const submit = async () => {
        if (!techniqueId) { setErr('Select a technique first.'); return; }
        if (!reason.trim()) { setErr('A mapping reason is required.'); return; }
        if (!evidenceId && !confidence) { setErr('Confidence is required for a mapping with no supporting evidence.'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await createMitreMapping({ entityType, entityId, techniqueId, reason: reason.trim(), confidence: confidence || undefined, evidenceId: evidenceId ? Number(evidenceId) : undefined });
            if (res.duplicate) setErr('Note: this Entity + Technique mapping already existed — surfaced the existing mapping rather than creating a duplicate.');
            onDone();
        } catch (e: any) { setErr(e?.message || 'Failed to create mapping.'); } finally { setBusy(false); }
    };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Map Technique</div>
            <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr' }}>
                <span className="k">Technique</span>
                <span className="v">
                    {techniqueId ? <span className="ti-badge">{techniqueId} <button type="button" onClick={() => setTechniqueId('')} style={{ marginLeft: '6px' }}>×</button></span> : (
                        <>
                            <input type="text" placeholder="Search e.g. T1059.001 or PowerShell…" value={techQuery} onChange={(e) => setTechQuery(e.target.value)} style={{ width: '100%' }} />
                            {techOptions.length > 0 && (
                                <ul className="ti-list">{techOptions.map((t) => <li key={t.technique_id} className="ti-row-clickable" onClick={() => { setTechniqueId(t.technique_id); setTechQuery(''); setTechOptions([]); }}>{t.technique_id} {t.name}</li>)}</ul>
                            )}
                        </>
                    )}
                </span>
                <span className="k">Reason</span><span className="v"><textarea value={reason} onChange={(e) => setReason(e.target.value)} style={{ width: '100%', minHeight: '50px' }} placeholder="e.g. Observed PowerShell execution in selected evidence." /></span>
                <span className="k">Confidence</span><span className="v">
                    <select value={confidence} onChange={(e) => setConfidence(e.target.value as any)}>
                        <option value="">None</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                    </select>
                </span>
                <span className="k">Supporting Evidence (optional)</span><span className="v">
                    <select value={evidenceId} onChange={(e) => setEvidenceId(e.target.value)}>
                        <option value="">None — Analyst Assessment</option>
                        {evidence.map((e) => <option key={e.id} value={e.id}>{e.description || e.source} (#{e.id})</option>)}
                    </select>
                </span>
            </div>
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy}>{busy ? 'Saving…' : 'Create Mapping'}</button>
                <button type="button" className="ti-action-btn" onClick={onCancel}>Cancel</button>
            </div>
        </div>
    );
};

// MITRE_MAPPER_PHASE3.md §41-§69/§83-§90 AI MITRE ANALYST — every stateless
// task (Explain Technique/Evidence, Summarize TTPs, Explain Evolution,
// Analyze Detection Gaps, Explain Conflict, Recommendations) through one
// draft area, AI Technique Suggestion (persisted, Confirm/Reject via the
// EXISTING mapping workflow — §57/§88), and AI Recommended Actions
// (deterministic candidates → propose → analyst approve/reject, reusing
// the shared action engine — §37-§42/§90). §85 "AI vs Deterministic" — an
// AI-sourced item is ALWAYS badged "AI Suggested", never blended with a
// deterministic one.
const AI_TASK_BUTTONS: { task: MitreAiTaskType; label: string; needsTechnique?: boolean }[] = [
    { task: 'ttp_summary', label: 'Summarize TTPs' },
    { task: 'evolution_summary', label: 'Explain Evolution' },
    { task: 'detection_gap_analysis', label: 'Analyze Detection Gaps' },
    { task: 'recommendations', label: 'Get Recommendations' },
];
const AiMitreAnalystPanel: React.FC<{ entityType: string; entityId: string; hasConflicts: boolean; onSuggestionAccepted: () => void }> = ({ entityType, entityId, hasConflicts, onSuggestionAccepted }) => {
    const [draft, setDraft] = useState<MitreAiDraft | null>(null);
    const [busy, setBusy] = useState<string | null>(null);
    const [err, setErr] = useState<string | null>(null);
    const [aiSuggestions, setAiSuggestions] = useState<MitreAiSuggestion[]>([]);
    const [candidates, setCandidates] = useState<MitreAiActionCandidate[]>([]);
    const [actions, setActions] = useState<MitreAiAction[]>([]);

    const loadAiSuggestions = useCallback(() => { getMitreAiSuggestions({ entityType, entityId, status: 'suggested' }).then((d) => setAiSuggestions(d.items)).catch(() => {}); }, [entityType, entityId]);
    const loadActions = useCallback(() => {
        getMitreAiActionCandidates(entityType, entityId).then(setCandidates).catch(() => setCandidates([]));
        listMitreAiActions(entityType, entityId).then(setActions).catch(() => setActions([]));
    }, [entityType, entityId]);
    useEffect(() => { loadAiSuggestions(); loadActions(); setDraft(null); }, [loadAiSuggestions, loadActions]);

    const run = async (task: MitreAiTaskType) => {
        setBusy(task); setErr(null); setDraft(null);
        try { setDraft(await generateMitreAiAnalysis(entityType, entityId, task)); } catch (e: any) { setErr(e?.message || 'AI analysis failed.'); } finally { setBusy(null); }
    };
    const suggest = async () => {
        setBusy('technique_suggestion'); setErr(null); setDraft(null);
        try { const res = await generateMitreAiTechniqueSuggestion(entityType, entityId); setDraft({ taskType: 'technique_suggestion', text: res.text, provider: res.provider as any, note: res.note, generatedAt: new Date().toISOString(), dataAsOf: new Date().toISOString(), model: res.provider, suggestions: res.suggestions.map((s) => ({ techniqueId: s.techniqueId, reason: s.reason, confidence: 'Medium', citations: s.citations })) }); loadAiSuggestions(); } catch (e: any) { setErr(e?.message || 'AI suggestion failed.'); } finally { setBusy(null); }
    };
    const acceptSuggestion = async (id: number) => { await acceptMitreAiSuggestion(id).catch((e) => setErr(e?.message)); loadAiSuggestions(); onSuggestionAccepted(); };
    const rejectSuggestion = async (id: number) => { await rejectMitreAiSuggestion(id).catch((e) => setErr(e?.message)); loadAiSuggestions(); };
    const propose = async (c: MitreAiActionCandidate) => { await proposeMitreAiAction(entityType, entityId, c).catch((e) => setErr(e?.message)); loadActions(); };
    const approve = async (id: number) => { await approveMitreAiAction(id).catch((e) => setErr(e?.message)); loadActions(); };
    const rejectAction = async (id: number) => { await rejectMitreAiAction(id).catch((e) => setErr(e?.message)); loadActions(); };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">AI MITRE Analyst</div>
            <div className="ti-note" style={{ marginBottom: '8px' }}>Assistant only — every AI output is a DRAFT/SUGGESTION; the deterministic MITRE Mapper data remains authoritative. AI suggestions never become Confirmed without explicit analyst action.</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                {AI_TASK_BUTTONS.map((b) => <button key={b.task} type="button" className="ti-action-btn" disabled={!!busy} onClick={() => run(b.task)}>{busy === b.task ? 'Working…' : b.label}</button>)}
                {hasConflicts && <button type="button" className="ti-action-btn" disabled={!!busy} onClick={() => run('conflict_explanation')}>{busy === 'conflict_explanation' ? 'Working…' : 'Explain Conflict'}</button>}
                <button type="button" className="ti-action-btn" disabled={!!busy} onClick={suggest}>{busy === 'technique_suggestion' ? 'Working…' : 'Suggest Technique'}</button>
            </div>
            {err && <div className="ti-error" style={{ marginBottom: '8px' }}>{err}</div>}

            {draft && (
                <div className="ti-note" style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px', padding: '10px', marginBottom: '10px' }}>
                    <div><span className="ti-badge">{draft.provider === 'openai' ? 'AI Generated' : 'Heuristic (AI Unavailable)'}</span> {draft.note && <span className="ti-note"> — {draft.note}</span>}</div>
                    <div style={{ marginTop: '6px' }}>{draft.text}</div>
                    {draft.gaps && draft.gaps.length > 0 && <ul className="ti-list">{draft.gaps.map((g) => <li key={g.techniqueId}>{g.techniqueId}: {g.missingSigma ? 'Missing Sigma' : ''}{g.missingSigma && g.missingYara ? ', ' : ''}{g.missingYara ? 'Missing YARA' : ''}</li>)}</ul>}
                    {draft.recommendations && draft.recommendations.length > 0 && <ul className="ti-list">{draft.recommendations.map((r, i) => <li key={i}>{r.action} — {r.reason}</li>)}</ul>}
                    {draft.doesNotEstablish && draft.doesNotEstablish.length > 0 && <div className="ti-note" style={{ marginTop: '6px' }}>Does NOT establish: {draft.doesNotEstablish.join(', ')}</div>}
                    <div className="ti-note" style={{ marginTop: '6px' }}>Generated {formatDateTime(draft.generatedAt)} · Data as of {formatDateTime(draft.dataAsOf)}</div>
                </div>
            )}

            {aiSuggestions.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <div className="ti-card-title" style={{ fontSize: '0.9rem' }}>AI Suggested Techniques</div>
                    <ul className="ti-list">
                        {aiSuggestions.map((s) => (
                            <li key={s.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="ti-badge" style={{ background: 'rgba(0,229,255,0.15)', color: '#00e5ff' }}>AI Suggested</span> {s.techniqueId}
                                {s.stale && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Stale</span>}
                                <div className="ti-note">{s.reason}</div>
                                <div style={{ marginTop: '4px' }}>
                                    <button type="button" className="ti-action-btn" onClick={() => acceptSuggestion(s.id)}>Confirm</button>{' '}
                                    <button type="button" className="ti-action-btn" onClick={() => rejectSuggestion(s.id)}>Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {(candidates.length > 0 || actions.length > 0) && (
                <div>
                    <div className="ti-card-title" style={{ fontSize: '0.9rem' }}>Recommended Actions</div>
                    {candidates.length === 0 ? null : (
                        <ul className="ti-list">
                            {candidates.map((c, i) => (
                                <li key={i} style={{ padding: '6px 0' }}>
                                    <strong>{c.action.replace(/_/g, ' ')}</strong> — {c.targetLabel} <span className="ti-note">{c.reason}</span>{' '}
                                    <button type="button" className="ti-action-btn" onClick={() => propose(c)}>Propose</button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {actions.length > 0 && (
                        <ul className="ti-list">
                            {actions.map((a) => (
                                <li key={a.id} style={{ padding: '6px 0' }}>
                                    {a.action.replace(/_/g, ' ')} — {a.targetLabel} <span className="ti-badge">{a.status}</span> {a.error && <span className="ti-error">{a.error}</span>}
                                    {a.status === 'proposed' && (<> <button type="button" className="ti-action-btn" onClick={() => approve(a.id)}>Approve</button>{' '}<button type="button" className="ti-action-btn" onClick={() => rejectAction(a.id)}>Reject</button></>)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}
        </div>
    );
};

// §33/§79 COMPARISON
const CompareView: React.FC = () => {
    const [a, setA] = useState<{ type: string; id: string; label: string } | null>(null);
    const [b, setB] = useState<{ type: string; id: string; label: string } | null>(null);
    const [sampleIdA, setSampleIdA] = useState('');
    const [sampleIdB, setSampleIdB] = useState('');
    const [techA, setTechA] = useState('');
    const [techB, setTechB] = useState('');
    const [mode, setMode] = useState<'entity' | 'malware_sample' | 'technique'>('entity');
    const [result, setResult] = useState<MitreEnhancedComparison | null>(null);
    const [sampleResult, setSampleResult] = useState<MitreSampleComparison | null>(null);
    const [techResult, setTechResult] = useState<MitreTechniqueComparison | null>(null);
    const [err, setErr] = useState<string | null>(null);

    const run = async () => {
        setErr(null); setResult(null); setSampleResult(null); setTechResult(null);
        try {
            if (mode === 'malware_sample') {
                if (!sampleIdA.trim() || !sampleIdB.trim()) { setErr('Enter both sample IDs to compare.'); return; }
                setSampleResult(await compareMitreMalwareSamples(sampleIdA.trim(), sampleIdB.trim()));
            } else if (mode === 'technique') {
                if (!techA.trim() || !techB.trim()) { setErr('Enter both technique IDs to compare.'); return; }
                setTechResult(await compareMitreTechniques(techA.trim(), techB.trim()));
            } else {
                if (!a || !b) { setErr('Select two entities to compare.'); return; }
                // MITRE_MAPPER_PHASE3.md §30 ATT&CK COMPARISON — enhanced with
                // Shared Tactics + per-technique Detection Covered flags on
                // top of Phase 2's own source-labelled comparison.
                setResult(await getMitreEnhancedComparison(a.type, a.id, b.type, b.id));
            }
        } catch (e: any) { setErr(e?.message || 'Comparison failed.'); }
    };

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Compare</div>
                <div className="ti-filters" style={{ marginBottom: '10px' }}>
                    <select value={mode} onChange={(e) => { setMode(e.target.value as any); setResult(null); setSampleResult(null); setTechResult(null); setErr(null); }}>
                        <option value="entity">Entity Comparison (Threat Actor / Malware / Campaign / …)</option>
                        <option value="malware_sample">Malware Sample Comparison</option>
                        <option value="technique">Technique Comparison (metadata only)</option>
                    </select>
                </div>
                {mode === 'entity' && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div style={{ flex: 1, minWidth: '260px' }}><strong>Entity A</strong>{a ? <div>{a.label} <button type="button" onClick={() => setA(null)}>×</button></div> : <EntitySearchPicker onPick={(type, id, label) => setA({ type, id, label })} />}</div>
                        <div style={{ flex: 1, minWidth: '260px' }}><strong>Entity B</strong>{b ? <div>{b.label} <button type="button" onClick={() => setB(null)}>×</button></div> : <EntitySearchPicker onPick={(type, id, label) => setB({ type, id, label })} />}</div>
                    </div>
                )}
                {mode === 'malware_sample' && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div><strong>Sample A ID</strong><br /><input type="text" value={sampleIdA} onChange={(e) => setSampleIdA(e.target.value)} style={{ width: '120px' }} /></div>
                        <div><strong>Sample B ID</strong><br /><input type="text" value={sampleIdB} onChange={(e) => setSampleIdB(e.target.value)} style={{ width: '120px' }} /></div>
                    </div>
                )}
                {mode === 'technique' && (
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                        <div><strong>Technique A</strong><br /><input type="text" placeholder="e.g. T1059.001" value={techA} onChange={(e) => setTechA(e.target.value)} style={{ width: '140px' }} /></div>
                        <div><strong>Technique B</strong><br /><input type="text" placeholder="e.g. T1053.005" value={techB} onChange={(e) => setTechB(e.target.value)} style={{ width: '140px' }} /></div>
                    </div>
                )}
                <button type="button" className="ti-action-btn" onClick={run} style={{ marginTop: '10px' }}>Compare</button>
                {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            </div>
            {result && (
                <div className="ti-card">
                    <div className="ti-card-title">{result.entityA.label} vs {result.entityB.label}</div>
                    {result.sharedTactics.length > 0 && <div className="ti-note" style={{ marginBottom: '6px' }}>Shared Tactics: {result.sharedTactics.join(', ')}</div>}
                    <div className="ti-kv">
                        <span className="k">Shared ({result.shared.length})</span><span className="v">{result.shared.map((t: any) => `${t.techniqueId} ${t.techniqueName}${t.detectionCoveredA || t.detectionCoveredB ? ' [Detection Covered]' : ''} [${t.sourceA || '—'} / ${t.sourceB || '—'}]`).join(', ') || 'None'}</span>
                        <span className="k">{result.entityA.label} Only ({result.aOnly.length})</span><span className="v">{result.aOnly.map((t: any) => `${t.techniqueId} ${t.techniqueName}${t.detectionCoveredA ? ' [Detection Covered]' : ''} (${t.source || '—'})`).join(', ') || 'None'}</span>
                        <span className="k">{result.entityB.label} Only ({result.bOnly.length})</span><span className="v">{result.bOnly.map((t: any) => `${t.techniqueId} ${t.techniqueName}${t.detectionCoveredB ? ' [Detection Covered]' : ''} (${t.source || '—'})`).join(', ') || 'None'}</span>
                    </div>
                </div>
            )}
            {sampleResult && (
                <div className="ti-card">
                    <div className="ti-card-title">{sampleResult.entityA.label} vs {sampleResult.entityB.label}</div>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>
                        Behavioral similarity: {sampleResult.similarity ? `${sampleResult.similarity.overallLabel} (${sampleResult.similarity.overallScore})${sampleResult.similarity.sameFingerprint ? ' · Same Fingerprint' : ''}` : 'Not computed (Malware Analysis has not compared these two samples yet)'}
                    </div>
                    <div className="ti-kv">
                        <span className="k">Shared ({sampleResult.shared.length})</span><span className="v">{sampleResult.shared.map((t) => `${t.techniqueId} ${t.techniqueName}`).join(', ') || 'None'}</span>
                        <span className="k">{sampleResult.entityA.label} Only ({sampleResult.aOnly.length})</span><span className="v">{sampleResult.aOnly.map((t) => `${t.techniqueId} ${t.techniqueName}`).join(', ') || 'None'}</span>
                        <span className="k">{sampleResult.entityB.label} Only ({sampleResult.bOnly.length})</span><span className="v">{sampleResult.bOnly.map((t) => `${t.techniqueId} ${t.techniqueName}`).join(', ') || 'None'}</span>
                    </div>
                </div>
            )}
            {techResult && (
                <div className="ti-card">
                    <div className="ti-card-title">{techResult.techniqueA.techniqueId} vs {techResult.techniqueB.techniqueId}</div>
                    <div className="ti-note" style={{ marginBottom: '6px' }}>{techResult.note}</div>
                    <div className="ti-kv">
                        <span className="k">{techResult.techniqueA.techniqueId}</span><span className="v">{techResult.techniqueA.name} — Tactics: {techResult.techniqueA.tactics.join(', ')} — Confirmed {techResult.techniqueA.mappingCounts.confirmed}, Suggested {techResult.techniqueA.mappingCounts.suggested}</span>
                        <span className="k">{techResult.techniqueB.techniqueId}</span><span className="v">{techResult.techniqueB.name} — Tactics: {techResult.techniqueB.tactics.join(', ')} — Confirmed {techResult.techniqueB.mappingCounts.confirmed}, Suggested {techResult.techniqueB.mappingCounts.suggested}</span>
                        <span className="k">Shared Tactics</span><span className="v">{techResult.sharedTactics.join(', ') || 'None'}</span>
                        <span className="k">Same Parent Technique</span><span className="v">{techResult.sameParentTechnique ? 'Yes' : 'No'}</span>
                    </div>
                </div>
            )}
        </>
    );
};

// §34-§38/§48-§50 ALL MAPPINGS — search/filters/sorting/pagination/export.
const MappingsListView: React.FC<{ onOpenEntity: (type: string, id: string, label: string) => void }> = ({ onOpenEntity }) => {
    const [items, setItems] = useState<MitreMapping[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [filters, setFilters] = useState({ entityType: '', status: '', confidence: '', evidenceSupported: '', source: '', staleOnly: '' });
    const [sort, setSort] = useState('updated');
    const [searchQ, setSearchQ] = useState('');
    const [searchResult, setSearchResult] = useState<Awaited<ReturnType<typeof searchMitre>> | null>(null);

    const load = useCallback((p = 1) => {
        getMitreMappingsPage({ ...filters, sort, page: p, pageSize }).then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); });
    }, [filters, sort]);
    useEffect(() => { load(1); }, [load]);

    const runSearch = () => { if (searchQ.trim()) searchMitre(searchQ.trim()).then(setSearchResult); else setSearchResult(null); };

    return (
        <>
            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <input type="text" placeholder="Search technique, entity, or reason…" value={searchQ} onChange={(e) => setSearchQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} />
                <button type="button" className="ti-action-btn" onClick={runSearch}>Search</button>
                <select value={filters.entityType} onChange={(e) => setFilters((f) => ({ ...f, entityType: e.target.value }))}>
                    <option value="">All Entity Types</option>{ENTITY_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="">All Status</option><option value="suggested">Suggested</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option>
                </select>
                <select value={filters.confidence} onChange={(e) => setFilters((f) => ({ ...f, confidence: e.target.value }))}>
                    <option value="">All Confidence</option><option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option>
                </select>
                <select value={filters.evidenceSupported} onChange={(e) => setFilters((f) => ({ ...f, evidenceSupported: e.target.value }))}>
                    <option value="">Evidence: Any</option><option value="true">Evidence Supported</option><option value="false">Analyst Assessment</option>
                </select>
                <select value={filters.source} onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}>
                    <option value="">Any Source</option><option value="Automatic Suggestion Engine">Automatic Suggestion Engine</option><option value="Analyst">Analyst (Manual)</option>
                </select>
                <select value={filters.staleOnly} onChange={(e) => setFilters((f) => ({ ...f, staleOnly: e.target.value }))}>
                    <option value="">Stale: Any</option><option value="true">Needs Review Only</option>
                </select>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                    <option value="updated">Sort: Updated</option><option value="created">Sort: Created</option><option value="technique">Sort: Technique</option><option value="confidence">Sort: Confidence</option>
                </select>
            </div>

            {searchResult && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Search Results</div>
                    {searchResult.techniques.length > 0 && <div><strong>Techniques:</strong> {searchResult.techniques.map((t) => `${t.techniqueId} ${t.name}`).join(', ')}</div>}
                    {searchResult.mappings.length > 0 && <div><strong>Mappings:</strong> {searchResult.mappings.map((m) => `${m.entityLabel} → ${m.techniqueId}`).join('; ')}</div>}
                    {searchResult.techniques.length === 0 && searchResult.mappings.length === 0 && <div className="ti-empty">No matches.</div>}
                </div>
            )}

            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>Entity</th><th>Technique</th><th>Source</th><th>Reason</th><th>Confidence</th><th>Status</th><th>Evidence</th><th>Sources</th><th>Updated</th></tr></thead>
                    <tbody>
                        {items.length === 0 ? <tr><td colSpan={9} className="ti-empty">No mappings found.</td></tr> : items.map((m) => (
                            <tr key={m.id}>
                                <td className="ti-row-clickable" onClick={() => onOpenEntity(m.entityType!, m.entityId!, m.entityLabel!)}>{m.entityLabel}</td>
                                <td>{m.techniqueId} {m.techniqueName}</td>
                                <td className="ti-note">{m.source}</td>
                                <td className="ti-note">{m.reason}</td>
                                <td>{m.confidence || 'Not Available'}</td>
                                <td><span className="ti-badge" style={STATUS_COLOR[m.reviewStatus || '']}>{m.reviewStatus}</span>{m.stale && <span className="ti-badge" style={{ marginLeft: '4px', background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Needs Review</span>}</td>
                                <td>{m.evidenceId ? `Evidence Supported (#${m.evidenceId})` : 'Analyst Assessment'}</td>
                                <td className="ti-note">{1 + (m.sources?.length || 0)}</td>
                                <td className="ti-note">{m.updatedAt ? formatDateTime(m.updatedAt) : '—'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} nextDisabled={page * pageSize >= total} />
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <a className="ti-action-btn" href={mitreMapperExportUrl('json', filters as any)} target="_blank" rel="noopener noreferrer">Export JSON</a>
                <a className="ti-action-btn" href={mitreMapperExportUrl('csv', filters as any)} target="_blank" rel="noopener noreferrer">Export CSV</a>
            </div>
        </>
    );
};

export default MitreMapperPage;
