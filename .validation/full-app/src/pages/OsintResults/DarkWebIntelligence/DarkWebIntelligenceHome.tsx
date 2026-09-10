// DARK_WEB_PHASE1.md — replaces the former "Dark Web Intelligence is planned
// for a future update and isn't available yet." placeholder. §2 "CRITICAL
// SAFETY RULE" — this is a structured workspace for manual/imported/
// analyst-submitted observations; nothing here crawls Tor, visits an onion
// address, or fabricates a collection result. Reuses ThreatIntelligence's
// existing ti-* visual system, the same established convention IOC
// Analyzer/Threat Summary already follow.
import React, { useState, useCallback, useEffect } from 'react';
import { Radar, PlusCircle, FileInput } from 'lucide-react';
import '../../ThreatIntelligence/ThreatIntelligencePage.css';
// Reuses the SAME hero header component (.ti-hero / .ti-hero-icon / .ti-hero-title /
// .ti-hero-desc / .ti-hero-actions / .ti-hero-btn) Telegram Intelligence's own landing
// page already defines — same cross-module CSS import convention Telegram's own page
// already uses (it imports SocialMediaIntelligence.css the identical way).
import '../TelegramIntelligence/TelegramIntelligence.css';
import { formatDateTime, EntityChip } from '../../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8
import { downloadBlob } from '../../../components/shared/downloadFile';  // P1-5 — was open-coded here
import {
    getDarkWebMeta, getDarkWebDashboard, getDarkWebSources, createDarkWebSource, getDarkWebSourceDetail, updateDarkWebSource,
    getDarkWebObservations, createDarkWebObservation, getDarkWebObservationDetail, reviewDarkWebObservation,
    checkDarkWebObservationMisp, importDarkWebObservations, addEvidence, createCentralNote,
    // DARK_WEB_PHASE2.md — Cross Source Correlation, IOC/Entity Exposure,
    // MISP Enrichment, Historical Change Detection & Analyst Investigation.
    getDarkWebObservationCorrelations, getDarkWebRelatedObservations, checkDarkWebObservationCredentialLeak,
    bulkReviewDarkWebObservations, bulkAddDarkWebObservationsToCase, darkWebExportUrl, getDarkWebObservationHistory,
    type DarkWebMeta, type DarkWebDashboard, type DarkWebSource, type DarkWebSourceDetail, type DarkWebObservation, type DarkWebObservationDetail,
    type DarkWebSourceType, type DarkWebObservationStatus, type DarkWebCorrelations, type DarkWebRelatedObservations, type DarkWebHistory,
    // DARK_WEB_PHASE3.md — Continuous Monitoring, Advanced Change Detection,
    // Exposure Intelligence, AI Analysis & Analyst Alerting.
    getDarkWebMonitors, createDarkWebMonitor, getDarkWebAttention, getDarkWebTrends, getDarkWebSourceTrend,
    getDarkWebObservationAiSummary, getDarkWebSourceAiSummary, getDarkWebDashboardAiSummary, getDarkWebSourceForecast,
    updateMonitor, deleteMonitor, checkMonitorNow, approveAiRecommendation,
    type DarkWebMonitor, type DarkWebAttentionItem, type DarkWebTrends, type DarkWebSourceTrendData, type DarkWebForecast,
    type DarkWebObservationAiSummary, type DarkWebSourceAiSummary, type DarkWebDashboardAiSummary,
    type AiRecommendation, type AiActionPreview,
} from '../../../services/api';

interface Props {
    onNavigateToModule?: (module: string) => void;
    onNavigateToView?: (view: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    isAdmin?: boolean;
}

// §59/§61 — the OSINT-level cross-navigation OsintPage.tsx already
// established for MalwareSection above (section-only, no per-record deep
// link exists at this level — the SAME accepted limitation that
// integration already carries).
const ENTITY_TYPE_TO_TI_VIEW: Record<string, string> = { threat_actor: 'ti-actors', malware: 'ti-malware', campaign: 'ti-campaigns', vulnerability: 'ti-vulnerabilities', ioc: 'ti-iocs' };
const ENTITY_TYPE_TO_OSINT_MODULE: Record<string, string> = { brand: 'brand-intel', company: 'company-intel' };

type TopMode = 'dashboard' | 'sources' | 'observations' | 'monitors';
type ObsTab = 'overview' | 'content' | 'iocs' | 'entities' | 'crosssource' | 'misp' | 'evidence' | 'timeline' | 'investigations' | 'notes' | 'related' | 'monitoring' | 'ai';

// DARK_WEB_PHASE3.md §66-68 — a plain volume-only badge color, never a
// severity/threat color (activity surge ≠ threat escalation, §24).
const SEVERITY_COLOR: Record<string, { background: string; color: string }> = {
    critical: { background: 'rgba(239,68,68,0.2)', color: '#f87171' }, high: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
    medium: { background: 'rgba(234,179,8,0.15)', color: '#eab308' }, low: { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    info: { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' },
};

const DarkWebIntelligenceHome: React.FC<Props> = ({ onNavigateToModule, onNavigateToView, onViewNotes, onCreateThreatBrief }) => {
    const [meta, setMeta] = useState<DarkWebMeta | null>(null);
    const [mode, setMode] = useState<TopMode>('dashboard');
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { getDarkWebMeta().then(setMeta).catch(() => {}); }, []);

    // §59/§61 — section-only navigation (no per-record deep link exists at
    // this OsintPage integration level; the entityId is intentionally
    // unused, matching MalwareSection's own identical limitation above).
    const openEntity = (entityType: string, _entityId: string) => {
        if (ENTITY_TYPE_TO_TI_VIEW[entityType]) onNavigateToView?.(ENTITY_TYPE_TO_TI_VIEW[entityType]);
        else if (ENTITY_TYPE_TO_OSINT_MODULE[entityType]) onNavigateToModule?.(ENTITY_TYPE_TO_OSINT_MODULE[entityType]);
    };

    return (
        <div className="ti-container">
            <div className="ti-content">
                {/* Same hero treatment as Telegram Intelligence's own landing page. */}
                <div className="ti-hero" style={{ marginBottom: '16px' }}>
                    <div className="ti-hero-top">
                        <span className="ti-hero-icon" aria-hidden="true"><Radar size={22} /></span>
                        <h2 className="ti-hero-title">Dark Web Intelligence</h2>
                    </div>
                    <p className="ti-hero-desc">
                        A structured workspace for collecting, normalizing, searching and investigating dark web related observations — manual entry, imported datasets and (where configured) an approved provider. This module never crawls Tor or visits an onion address automatically.
                    </p>
                    <div className="ti-hero-actions">
                        <button type="button" className="ti-action-btn ti-hero-btn" onClick={() => setMode('sources')}>
                            <PlusCircle size={16} /> Add Source
                        </button>
                        <button type="button" className="ti-action-btn ti-hero-btn" onClick={() => setMode('observations')}>
                            <FileInput size={16} /> Add / Import Observation
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                    {(['dashboard', 'sources', 'observations', 'monitors'] as TopMode[]).map((m) => (
                        <button key={m} type="button" className="ti-action-btn" style={mode === m ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setMode(m)}>
                            {m === 'dashboard' ? 'Dashboard' : m === 'sources' ? 'Sources' : m === 'observations' ? 'Observations' : 'Monitors'}
                        </button>
                    ))}
                </div>

                {error && <div className="ti-error">{error}</div>}

                {mode === 'dashboard' && <DashboardView onOpenSources={() => setMode('sources')} onOpenObservations={() => setMode('observations')} onOpenMonitors={() => setMode('monitors')} />}
                {mode === 'sources' && <SourcesView meta={meta} />}
                {mode === 'observations' && <ObservationsView meta={meta} onOpenEntity={openEntity} onViewNotes={onViewNotes} onCreateThreatBrief={onCreateThreatBrief} setError={setError} />}
                {mode === 'monitors' && <MonitorsView />}
            </div>
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// §23/§24/§86/§87 DASHBOARD
// ═══════════════════════════════════════════════════════════════════════
const DashboardView: React.FC<{ onOpenSources: () => void; onOpenObservations: () => void; onOpenMonitors: () => void }> = ({ onOpenSources, onOpenObservations, onOpenMonitors }) => {
    const [data, setData] = useState<DarkWebDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { getDarkWebDashboard().then(setData).finally(() => setLoading(false)); }, []);

    // DARK_WEB_PHASE3.md §37/§76 ANALYST ATTENTION + §38-42 TRENDS — read-time
    // aggregations over the SAME real monitor_events every Monitors tab/alert
    // already shows, never a second computation.
    const [attention, setAttention] = useState<DarkWebAttentionItem[] | null>(null);
    const [trends, setTrends] = useState<DarkWebTrends | null>(null);
    useEffect(() => {
        getDarkWebAttention().then((d) => setAttention(d.items)).catch(() => setAttention([]));
        getDarkWebTrends().then(setTrends).catch(() => {});
    }, []);

    if (loading) return <div className="ti-empty">Loading dashboard…</div>;
    if (!data) return <div className="ti-error">Failed to load dashboard.</div>;

    return (
        <>
            <DashboardAiAssessment />

            {attention && attention.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px', borderColor: 'rgba(234,179,8,0.4)', cursor: 'pointer' }} onClick={onOpenMonitors}>
                    <div className="ti-card-title">Analyst Attention ({attention.length})</div>
                    <ul className="ti-list">
                        {attention.slice(0, 8).map((a) => (
                            <li key={a.id} style={{ padding: '4px 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <span className="ti-badge" style={SEVERITY_COLOR[a.severity] || SEVERITY_COLOR.info}>{a.severity}</span>
                                <span>{a.summary}</span>
                                <span className="ti-note" style={{ marginLeft: 'auto' }}>{formatDateTime(a.createdAt)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {trends && (
                <div className="ti-card" style={{ marginBottom: '16px', cursor: 'pointer' }} onClick={onOpenMonitors}>
                    <div className="ti-card-title">Activity Trend</div>
                    <div className="ti-kv">
                        <span className="k">Last 24h</span><span className="v">{trends.activity.last24h}</span>
                        <span className="k">Last 7d</span><span className="v">{trends.activity.last7d}</span>
                        <span className="k">Last 30d</span><span className="v">{trends.activity.last30d}</span>
                        <span className="k">New IOC (7d)</span><span className="v">{trends.ioc.newIoc7d}</span>
                        <span className="k">Repeated IOC</span><span className="v">{trends.ioc.repeatedIoc}</span>
                        <span className="k">MISP Matches</span><span className="v">{trends.ioc.mispMatches}</span>
                        <span className="k">Credential Exposures</span><span className="v">{trends.ioc.credentialExposures}</span>
                    </div>
                    <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Activity volume only — never interpreted as threat escalation.</div>
                </div>
            )}
            <div className="ti-kpi-row" style={{ marginBottom: '16px' }}>
                <div className="ti-kpi-card" onClick={onOpenSources} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{data.sources}</div><div className="ti-kpi-label">Sources</div></div>
                <div className="ti-kpi-card" onClick={onOpenObservations} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{data.observations}</div><div className="ti-kpi-label">Observations</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{data.newObservations}</div><div className="ti-kpi-label">New (7d)</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{data.iocMentions}</div><div className="ti-kpi-label">IOC Mentions</div></div>
                <div className="ti-kpi-card"><div className="ti-kpi-value">{data.entityMentions}</div><div className="ti-kpi-label">Entity Mentions</div></div>
            </div>

            {/* §25/§26/§87 SOURCE HEALTH — honest, never fake "Live" data. */}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Collection Status</div>
                <div className="ti-kv">
                    <span className="k">Provider</span><span className="v">{data.collectionStatus.provider === 'not_configured' ? 'Not Configured' : data.collectionStatus.provider}</span>
                    <span className="k">Manual Input</span><span className="v">{data.collectionStatus.manualInput === 'available' ? 'Available' : data.collectionStatus.manualInput}</span>
                    <span className="k">Imported Data</span><span className="v">{data.collectionStatus.importedData === 'available' ? 'Available' : data.collectionStatus.importedData}</span>
                </div>
                {data.collectionStatus.provider === 'not_configured' && (
                    <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>No dark web collection provider configured. You can still add observations manually or import a dataset.</div>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div className="ti-card">
                    <div className="ti-card-title">Recent Observations</div>
                    {data.recentObservations.length === 0 ? <div className="ti-empty">No observations yet.</div> : (
                        <ul className="ti-list">
                            {data.recentObservations.map((o) => (
                                <li key={o.id} style={{ padding: '5px 0' }}><strong>{o.formattedId}</strong> — {o.title || '(untitled)'} <span className="ti-note">· {o.sourceName} · {formatDateTime(o.collectedAt)}</span></li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="ti-card">
                    <div className="ti-card-title">Top Sources</div>
                    {data.topSources.length === 0 ? <div className="ti-empty">No sources yet.</div> : (
                        <ul className="ti-list">
                            {data.topSources.map((s) => <li key={s.id} style={{ padding: '5px 0' }}>{s.name} <span className="ti-badge">{s.type.replace(/_/g, ' ')}</span> <span className="ti-note">{s.observationCount} observation(s)</span></li>)}
                        </ul>
                    )}
                </div>
            </div>

            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Recent IOC Mentions</div>
                {data.recentIocMentions.length === 0 ? <div className="ti-empty">No IOC mentions yet.</div> : (
                    <div className="ti-chip-list">
                        {data.recentIocMentions.map((m, i) => (
                            <span key={i} className="ti-chip">{m.value} <span className="ti-note">({m.matchStatus === 'existing' ? 'Existing' : 'New'}, ×{m.count})</span></span>
                        ))}
                    </div>
                )}
                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Mentions only — never an automatic maliciousness classification.</div>
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// §7/§8/§55/§56/§89 SOURCES
// ═══════════════════════════════════════════════════════════════════════
const SourcesView: React.FC<{ meta: DarkWebMeta | null }> = ({ meta }) => {
    const [items, setItems] = useState<DarkWebSource[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [q, setQ] = useState('');
    const [showAdd, setShowAdd] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    const load = useCallback((p = page) => {
        setLoading(true);
        getDarkWebSources({ q: q.trim() || undefined, page: p, pageSize }).then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); }).finally(() => setLoading(false));
    }, [q, page]);
    useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (selectedId != null) return <SourceDetailView sourceId={selectedId} onBack={() => { setSelectedId(null); load(page); }} />;

    return (
        <>
            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <input type="text" placeholder="Search source name/address…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} style={{ flex: '1 1 260px' }} />
                <button type="button" className="ti-action-btn" onClick={() => load(1)}>Search</button>
                <button type="button" className="ti-action-btn" onClick={() => setShowAdd(true)} style={{ marginLeft: 'auto' }}>Add Source</button>
            </div>

            {showAdd && meta && <AddSourceForm meta={meta} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(1); }} />}

            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>Name</th><th>Type</th><th>Status</th><th>Observations</th><th>Last Observation</th><th>Last Check</th><th></th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan={7} className="ti-empty">Loading…</td></tr> : items.length === 0 ? <tr><td colSpan={7} className="ti-empty">No sources yet. Add one to get started.</td></tr> : items.map((s) => (
                            <tr key={s.id} className="ti-row-clickable" onClick={() => setSelectedId(s.id)}>
                                <td style={{ fontWeight: 600 }}>{s.name}</td>
                                <td style={{ textTransform: 'capitalize' }}>{s.type.replace(/_/g, ' ')}</td>
                                <td><span className="ti-badge">{s.status.replace(/_/g, ' ')}</span></td>
                                <td>{s.observationCount}</td>
                                <td className="ti-note">{s.lastObservationAt ? formatDateTime(s.lastObservationAt) : '—'}</td>
                                <td className="ti-note">{s.lastCheckedAt ? formatDateTime(s.lastCheckedAt) : 'Never (no live provider)'}</td>
                                <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(s.id); }}>View</button></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} nextDisabled={page * pageSize >= total} />
        </>
    );
};

const AddSourceForm: React.FC<{ meta: DarkWebMeta; onClose: () => void; onCreated: () => void }> = ({ meta, onClose, onCreated }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<DarkWebSourceType>(meta.sourceTypes[0]);
    const [address, setAddress] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);

    const submit = async () => {
        if (!name.trim()) { setErr('Source Name is required.'); return; }
        setBusy(true); setErr(null);
        try {
            await createDarkWebSource({ name: name.trim(), type, address: address.trim() || undefined, description: description.trim() || undefined, tags: tags.split(',').map((t) => t.trim()).filter(Boolean) });
            onCreated();
        } catch (e: any) { setErr(e?.message || 'Failed to create source'); } finally { setBusy(false); }
    };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Add Source</div>
            <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>No live network connection is made when registering a source — the address is stored as a reference string only.</div>
            <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr' }}>
                <span className="k">Source Name</span><span className="v"><input type="text" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%' }} /></span>
                <span className="k">Source Type</span><span className="v">
                    <select value={type} onChange={(e) => setType(e.target.value as DarkWebSourceType)}>
                        {meta.sourceTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                    </select>
                </span>
                <span className="k">Address / Identifier</span><span className="v"><input type="text" placeholder="e.g. example.onion, forum URL, channel handle…" value={address} onChange={(e) => setAddress(e.target.value)} style={{ width: '100%' }} /></span>
                <span className="k">Description</span><span className="v"><textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} style={{ width: '100%' }} /></span>
                <span className="k">Tags</span><span className="v"><input type="text" placeholder="comma, separated" value={tags} onChange={(e) => setTags(e.target.value)} style={{ width: '100%' }} /></span>
            </div>
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Source'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

const SourceDetailView: React.FC<{ sourceId: number; onBack: () => void }> = ({ sourceId, onBack }) => {
    const [detail, setDetail] = useState<DarkWebSourceDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const load = useCallback(() => { getDarkWebSourceDetail(sourceId).then(setDetail); }, [sourceId]);
    useEffect(() => { load(); }, [load]);

    if (!detail) return <div className="ti-empty">Loading source…</div>;
    const { source } = detail;

    const setStatus = async (status: any) => {
        setBusy(true);
        try { await updateDarkWebSource(sourceId, { status }); load(); } finally { setBusy(false); }
    };

    return (
        <>
            <button type="button" className="ti-action-btn" onClick={onBack} style={{ marginBottom: '10px' }}>‹ Back to Sources</button>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">{source.name} <span className="ti-badge" style={{ marginLeft: '8px' }}>{source.type.replace(/_/g, ' ')}</span></div>
                <div className="ti-kv">
                    <span className="k">Status</span><span className="v">
                        <select value={source.status} onChange={(e) => setStatus(e.target.value)} disabled={busy}>
                            <option value="active">Active</option><option value="inactive">Inactive</option><option value="not_configured">Not Configured</option><option value="unavailable">Unavailable</option>
                        </select>
                    </span>
                    <span className="k">Address</span><span className="v">{source.address || '—'}</span>
                    <span className="k">Owner</span><span className="v">{source.owner || '—'}</span>
                    <span className="k">Observations</span><span className="v">{source.observationCount}</span>
                    <span className="k">Last Observation</span><span className="v">{source.lastObservationAt ? formatDateTime(source.lastObservationAt) : '—'}</span>
                    <span className="k">Last Check</span><span className="v">{source.lastCheckedAt ? formatDateTime(source.lastCheckedAt) : 'Never (no live provider)'}</span>
                </div>
                {source.description && <div className="ti-note" style={{ marginTop: '8px' }}>{source.description}</div>}
                {source.tags.length > 0 && <div className="ti-chip-list" style={{ marginTop: '8px' }}>{source.tags.map((t) => <span key={t} className="ti-chip">{t}</span>)}</div>}
            </div>

            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Configuration Status</div>
                <div className="ti-kv">
                    <span className="k">Provider</span><span className="v">{detail.configurationStatus.provider === 'not_configured' ? 'Not Configured' : detail.configurationStatus.provider}</span>
                    <span className="k">Manual Input</span><span className="v">Available</span>
                    <span className="k">Imported Data</span><span className="v">Available</span>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="ti-card"><div className="ti-kpi-value">{detail.iocCount}</div><div className="ti-kpi-label">IOC Mentions</div></div>
                <div className="ti-card"><div className="ti-kpi-value">{detail.entityCount}</div><div className="ti-kpi-label">Entity Mentions</div></div>
            </div>

            <SourceMonitoringPanel sourceId={sourceId} sourceName={source.name} />

            <div className="ti-card" style={{ marginTop: '16px' }}>
                <div className="ti-card-title">Recent Observations</div>
                {detail.recentObservations.length === 0 ? <div className="ti-empty">No observations from this source yet.</div> : (
                    <ul className="ti-list">
                        {detail.recentObservations.map((o) => (
                            <li key={o.id} style={{ padding: '5px 0', display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <strong>{o.formattedId}</strong> {o.title || '(untitled)'} <span className="ti-badge">{o.status}</span> <span className="ti-note" style={{ marginLeft: 'auto' }}>{o.observedAt ? formatDateTime(o.observedAt) : '—'}</span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// §19-22/§51-54/§88/§90 OBSERVATIONS
// ═══════════════════════════════════════════════════════════════════════
const ObservationsView: React.FC<{
    meta: DarkWebMeta | null; onOpenEntity: (t: string, id: string) => void;
    onViewNotes?: (t: string, id: string, label: string) => void; onCreateThreatBrief?: (t: string, id: string) => void;
    setError: (e: string | null) => void;
}> = ({ meta, onOpenEntity, onViewNotes, onCreateThreatBrief, setError }) => {
    const [items, setItems] = useState<DarkWebObservation[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [q, setQ] = useState('');
    const [filters, setFilters] = useState({ status: 'all', collectionMethod: 'all', sourceType: 'all', hasMisp: false, hasCredentialExposure: false, hasTelegram: false, hasBrand: false, hasThreatActor: false, monitored: false, hasChange: false, activitySurge: false });
    const [sortBy, setSortBy] = useState('newest_observed');
    const [showAdd, setShowAdd] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [sources, setSources] = useState<DarkWebSource[]>([]);
    const [loading, setLoading] = useState(true);
    // DARK_WEB_PHASE2.md §46/§47/§58 BULK REVIEW / CASE LINKING.
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [caseIdInput, setCaseIdInput] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkMessage, setBulkMessage] = useState<{ ok: boolean; text: string } | null>(null);

    useEffect(() => { getDarkWebSources({ pageSize: 100 }).then((d) => setSources(d.items)); }, []);

    const load = useCallback((p = page) => {
        setLoading(true);
        const params: any = { page: p, pageSize, sortBy };
        if (q.trim()) params.q = q.trim();
        if (filters.status !== 'all') params.status = filters.status;
        if (filters.collectionMethod !== 'all') params.collectionMethod = filters.collectionMethod;
        if (filters.sourceType !== 'all') params.sourceType = filters.sourceType;
        if (filters.hasMisp) params.hasMisp = 'true';
        if (filters.hasCredentialExposure) params.hasCredentialExposure = 'true';
        if (filters.hasTelegram) params.hasTelegram = 'true';
        if (filters.hasBrand) params.hasBrand = 'true';
        if (filters.hasThreatActor) params.hasThreatActor = 'true';
        // DARK_WEB_PHASE3.md §88/§89 — additive filters, resolved against real monitor/monitor_events rows.
        if (filters.monitored) params.monitored = 'true';
        if (filters.hasChange) params.hasChange = 'true';
        if (filters.activitySurge) params.activitySurge = 'true';
        getDarkWebObservations(params).then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); setSelected(new Set()); }).catch((e) => setError(e?.message || 'Failed to load observations')).finally(() => setLoading(false));
    }, [q, filters, sortBy, page, setError]);
    useEffect(() => { load(1); }, []); // eslint-disable-line react-hooks/exhaustive-deps

    if (selectedId != null) return <ObservationDetailView key={selectedId} observationId={selectedId} onBack={() => { setSelectedId(null); load(page); }} onOpenEntity={onOpenEntity} onViewNotes={onViewNotes} onCreateThreatBrief={onCreateThreatBrief} onNavigateToObservation={setSelectedId} />;

    const toggleSelect = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const toggleSelectAll = () => setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));

    const bulkReview = async (status: DarkWebObservationStatus) => {
        setBulkBusy(true); setBulkMessage(null);
        try {
            const res = await bulkReviewDarkWebObservations([...selected], status);
            setBulkMessage({ ok: res.failed === 0, text: `${res.updated} of ${res.total} updated.${res.failed ? ` ${res.failed} failed (not authorized).` : ''}` });
            load(page);
        } catch (e: any) { setBulkMessage({ ok: false, text: e?.message || 'Bulk review failed.' }); } finally { setBulkBusy(false); }
    };
    const bulkAddToCase = async () => {
        if (!caseIdInput.trim()) return;
        setBulkBusy(true); setBulkMessage(null);
        try {
            const res = await bulkAddDarkWebObservationsToCase([...selected], caseIdInput.trim());
            setBulkMessage({ ok: res.failed === 0, text: `Added ${res.added} of ${res.total} to Case ${caseIdInput.trim()}.${res.failed ? ` ${res.failed} failed.` : ''}` });
        } catch (e: any) { setBulkMessage({ ok: false, text: e?.message || 'Bulk case link failed.' }); } finally { setBulkBusy(false); }
    };
    const exportSelectedOrFiltered = async (format: 'csv' | 'json') => {
        const url = darkWebExportUrl({ observationIds: selected.size ? [...selected] : undefined, format, status: filters.status !== 'all' ? filters.status : undefined });
        const res = await fetch(url, { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } });
        const blob = await res.blob();
        downloadBlob(blob, `dark-web-observations.${format}`);
    };

    return (
        <>
            <div className="ti-filters" style={{ marginBottom: '10px' }}>
                <input type="text" placeholder="Search ID / title / snippet / username / domain / IOC / entity…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') load(1); }} style={{ flex: '1 1 320px' }} />
                <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                    <option value="all">All Status</option>{meta?.observationStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.collectionMethod} onChange={(e) => setFilters((f) => ({ ...f, collectionMethod: e.target.value }))}>
                    <option value="all">All Methods</option>{meta?.collectionMethods.filter((m) => m !== 'crawler').map((m) => <option key={m} value={m}>{m.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={filters.sourceType} onChange={(e) => setFilters((f) => ({ ...f, sourceType: e.target.value }))}>
                    <option value="all">All Source Types</option>{meta?.sourceTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                </select>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                    <option value="newest_observed">Newest Observed</option><option value="oldest_observed">Oldest Observed</option><option value="newest_collected">Newest Collected</option><option value="source">Source</option>
                </select>
                <button type="button" className="ti-action-btn" onClick={() => load(1)}>Apply</button>
            </div>
            {/* §55 FILTERS — cross source exposure filters, each backed by real stored/indexed data. */}
            <div className="ti-chip-list" style={{ marginBottom: '10px' }}>
                {([['hasMisp', 'Has MISP'], ['hasCredentialExposure', 'Has Credential Exposure'], ['hasTelegram', 'Has Telegram'], ['hasBrand', 'Has Brand'], ['hasThreatActor', 'Has Threat Actor'], ['monitored', 'Monitored'], ['hasChange', 'Has Change'], ['activitySurge', 'Activity Surge']] as const).map(([key, label]) => (
                    <span key={key} className="ti-chip" style={filters[key] ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setFilters((f) => ({ ...f, [key]: !f[key] }))}>{label}</span>
                ))}
                <button type="button" className="ti-action-btn" onClick={() => load(1)}>Apply Filters</button>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="ti-action-btn" onClick={() => setShowAdd(true)}>Add Observation</button>
                <button type="button" className="ti-action-btn" onClick={() => setShowImport(true)}>Import</button>
                <button type="button" className="ti-action-btn" onClick={() => exportSelectedOrFiltered('json')}>Export JSON</button>
                <button type="button" className="ti-action-btn" onClick={() => exportSelectedOrFiltered('csv')}>Export CSV</button>
            </div>

            {showAdd && <AddObservationForm sources={sources} onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(1); }} />}
            {showImport && <ImportForm sources={sources} onClose={() => setShowImport(false)} onImported={() => { setShowImport(false); load(1); }} />}

            {/* §46/§47/§58 BULK REVIEW / CASE LINKING */}
            {selected.size > 0 && (
                <div className="ti-card" style={{ marginBottom: '10px' }}>
                    <div className="ti-card-title">{selected.size} selected</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <button type="button" className="ti-action-btn" onClick={() => bulkReview('reviewed')} disabled={bulkBusy}>Mark Reviewed</button>
                        <button type="button" className="ti-action-btn" onClick={() => bulkReview('relevant')} disabled={bulkBusy}>Mark Relevant</button>
                        <button type="button" className="ti-action-btn" onClick={() => bulkReview('irrelevant')} disabled={bulkBusy}>Mark Irrelevant</button>
                        <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e) => setCaseIdInput(e.target.value)} style={{ width: '90px' }} />
                        <button type="button" className="ti-action-btn" onClick={bulkAddToCase} disabled={bulkBusy || !caseIdInput.trim()}>Add to Case</button>
                    </div>
                    {bulkMessage && <div className={bulkMessage.ok ? 'ti-note' : 'ti-error'} style={bulkMessage.ok ? { color: '#4ade80', marginTop: '8px' } : { marginTop: '8px' }}>{bulkMessage.text}</div>}
                    <div className="ti-note" style={{ marginTop: '6px', fontStyle: 'italic' }}>Every bulk action is explicit and calls the existing Review/Case API per selected, authorized observation.</div>
                </div>
            )}

            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th><input type="checkbox" checked={items.length > 0 && selected.size === items.length} onChange={toggleSelectAll} /></th><th>ID</th><th>Source</th><th>Title</th><th>Observed At</th><th>Method</th><th>Entities</th><th>IOCs</th><th>Status</th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan={9} className="ti-empty">Loading…</td></tr> : items.length === 0 ? <tr><td colSpan={9} className="ti-empty">No observations found.</td></tr> : items.map((o) => (
                            <tr key={o.id} className="ti-row-clickable">
                                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} /></td>
                                <td style={{ fontWeight: 600 }} onClick={() => setSelectedId(o.id)}>{o.formattedId}</td>
                                <td onClick={() => setSelectedId(o.id)}>{o.sourceName}</td>
                                <td onClick={() => setSelectedId(o.id)}>{o.title || o.snippet?.slice(0, 60) || '(untitled)'}</td>
                                <td className="ti-note" onClick={() => setSelectedId(o.id)}>{o.observedAt ? formatDateTime(o.observedAt) : 'Unknown'}</td>
                                <td onClick={() => setSelectedId(o.id)}><span className="ti-badge">{o.collectionMethod.replace(/_/g, ' ')}</span></td>
                                <td onClick={() => setSelectedId(o.id)}>{o.entities.length}</td>
                                <td onClick={() => setSelectedId(o.id)}>{o.iocs.length}</td>
                                <td onClick={() => setSelectedId(o.id)}><span className="ti-badge">{o.status}</span></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} nextDisabled={page * pageSize >= total} />
        </>
    );
};

const AddObservationForm: React.FC<{ sources: DarkWebSource[]; onClose: () => void; onCreated: () => void }> = ({ sources, onClose, onCreated }) => {
    const [sourceId, setSourceId] = useState<number | ''>(sources[0]?.id ?? '');
    const [title, setTitle] = useState('');
    const [sourceReference, setSourceReference] = useState('');
    const [content, setContent] = useState('');
    const [observedAt, setObservedAt] = useState('');
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [result, setResult] = useState<string | null>(null);

    const submit = async () => {
        if (!sourceId) { setErr('Select a source.'); return; }
        if (!content.trim()) { setErr('Observation content is required.'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await createDarkWebObservation({ sourceId: Number(sourceId), title: title.trim() || undefined, sourceReference: sourceReference.trim() || undefined, content: content.trim(), observedAt: observedAt || undefined, notes: notes.trim() || undefined });
            setResult(res.duplicate ? `This matches an existing observation (${res.formattedId}) — not duplicated.` : `Created ${res.formattedId}.`);
            setTimeout(onCreated, 900);
        } catch (e: any) { setErr(e?.message || 'Failed to add observation'); } finally { setBusy(false); }
    };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Add Observation</div>
            <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr' }}>
                <span className="k">Source</span><span className="v">
                    <select value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}>
                        {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                </span>
                <span className="k">Source Reference</span><span className="v"><input type="text" placeholder="e.g. Thread 123" value={sourceReference} onChange={(e) => setSourceReference(e.target.value)} style={{ width: '100%' }} /></span>
                <span className="k">Title</span><span className="v"><input type="text" value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: '100%' }} /></span>
                <span className="k">Observation</span><span className="v"><textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5} style={{ width: '100%' }} placeholder="Paste the observed content. It is treated as untrusted plain text — never executed." /></span>
                <span className="k">Observed At</span><span className="v"><input type="datetime-local" value={observedAt} onChange={(e) => setObservedAt(e.target.value)} /></span>
                <span className="k">Notes</span><span className="v"><input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} style={{ width: '100%' }} /></span>
            </div>
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            {result && <div className="ti-note" style={{ marginTop: '8px', color: '#4ade80' }}>{result}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy || !sources.length}>{busy ? 'Adding…' : 'Add Observation'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Cancel</button>
            </div>
            {!sources.length && <div className="ti-note" style={{ marginTop: '6px', fontStyle: 'italic' }}>Create a source first.</div>}
        </div>
    );
};

const ImportForm: React.FC<{ sources: DarkWebSource[]; onClose: () => void; onImported: () => void }> = ({ sources, onClose, onImported }) => {
    const [sourceId, setSourceId] = useState<number | ''>(sources[0]?.id ?? '');
    const [format, setFormat] = useState<'json' | 'csv'>('json');
    const [data, setData] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const [result, setResult] = useState<{ status: string; total: number; imported: number; duplicates: number; invalid: number; errors: { row: number; reason: string }[] } | null>(null);

    const submit = async () => {
        if (!sourceId || !data.trim()) { setErr('Select a source and provide data to import.'); return; }
        setBusy(true); setErr(null); setResult(null);
        try {
            const res = await importDarkWebObservations({ sourceId: Number(sourceId), format, data, importSource: `${format.toUpperCase()} import` });
            setResult(res);
            if (res.imported > 0 || res.duplicates > 0) setTimeout(onImported, 1200);
        } catch (e: any) { setErr(e?.message || 'Failed to import'); } finally { setBusy(false); }
    };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Import Observations</div>
            <div className="ti-note" style={{ marginBottom: '8px' }}>
                JSON: an array of objects with a <code>content</code> field (plus optional title/source_reference/author/observed_at/external_reference). CSV: a header row with those same column names.
            </div>
            <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr' }}>
                <span className="k">Source</span><span className="v">
                    <select value={sourceId} onChange={(e) => setSourceId(Number(e.target.value))}>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
                </span>
                <span className="k">Format</span><span className="v">
                    <select value={format} onChange={(e) => setFormat(e.target.value as any)}><option value="json">JSON</option><option value="csv">CSV</option></select>
                </span>
                <span className="k">Data</span><span className="v"><textarea value={data} onChange={(e) => setData(e.target.value)} rows={8} style={{ width: '100%', fontFamily: 'monospace' }} /></span>
            </div>
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            {result && (
                <div className="ti-card" style={{ marginTop: '10px', borderColor: result.status === 'partial' ? 'rgba(234,179,8,0.4)' : undefined }}>
                    <div className="ti-card-title">{result.status === 'complete' ? 'Import Complete' : result.status === 'partial' ? 'Partial Import' : 'Import Failed'}</div>
                    <div className="ti-kv">
                        <span className="k">Total Rows</span><span className="v">{result.total}</span>
                        <span className="k">Imported</span><span className="v">{result.imported}</span>
                        <span className="k">Duplicates</span><span className="v">{result.duplicates}</span>
                        <span className="k">Invalid</span><span className="v">{result.invalid}</span>
                    </div>
                    {result.errors.length > 0 && (
                        <ul className="ti-list" style={{ marginTop: '6px' }}>
                            {result.errors.slice(0, 10).map((e, i) => <li key={i} className="ti-note">Row {e.row}: {e.reason}</li>)}
                        </ul>
                    )}
                </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy || !sources.length}>{busy ? 'Importing…' : 'Import'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Close</button>
            </div>
        </div>
    );
};

const ObservationDetailView: React.FC<{
    observationId: number; onBack: () => void; onOpenEntity: (t: string, id: string) => void;
    onViewNotes?: (t: string, id: string, label: string) => void; onCreateThreatBrief?: (t: string, id: string) => void;
    onNavigateToObservation: (id: number) => void;
}> = ({ observationId, onBack, onOpenEntity, onViewNotes, onCreateThreatBrief, onNavigateToObservation }) => {
    const [detail, setDetail] = useState<DarkWebObservationDetail | null>(null);
    const [tab, setTab] = useState<ObsTab>('overview');
    const [caseIdInput, setCaseIdInput] = useState('');
    const [noteText, setNoteText] = useState('');
    const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [reviewReason, setReviewReason] = useState('');

    const load = useCallback(() => { getDarkWebObservationDetail(observationId).then(setDetail); }, [observationId]);
    useEffect(() => { load(); }, [load]);

    if (!detail) return <div className="ti-empty">Loading observation…</div>;
    const { observation: o } = detail;
    const entityType = 'dark_web_observation';

    const review = async (status: DarkWebObservationStatus) => {
        setBusy(true); setActionMsg(null);
        try { await reviewDarkWebObservation(observationId, { status, reason: reviewReason.trim() || undefined }); setActionMsg({ ok: true, text: `Marked ${status}.` }); load(); }
        catch (e: any) { setActionMsg({ ok: false, text: e?.message || 'Failed to update.' }); } finally { setBusy(false); }
    };
    const addToCase = async () => {
        if (!caseIdInput.trim()) return;
        setBusy(true); setActionMsg(null);
        try {
            const res = await fetch(`/api/investigations/cases/${encodeURIComponent(caseIdInput.trim())}/targets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: JSON.stringify({ entityType, entityId: observationId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.message || 'Failed to add to case');
            setActionMsg({ ok: true, text: `Added to Case ${caseIdInput.trim()}.` }); load();
        } catch (e: any) { setActionMsg({ ok: false, text: e?.message || 'Failed to add to case.' }); } finally { setBusy(false); }
    };
    const createEvidence = async () => {
        setBusy(true); setActionMsg(null);
        try {
            await addEvidence({ entityType, entityId: observationId, source: 'Dark Web Intelligence', description: `${o.formattedId} — ${o.title || o.snippet || 'observation'}`.slice(0, 500) });
            setActionMsg({ ok: true, text: 'Evidence created.' }); load();
        } catch (e: any) { setActionMsg({ ok: false, text: e?.message || 'Failed to create evidence.' }); } finally { setBusy(false); }
    };
    const addNote = async () => {
        if (!noteText.trim()) return;
        setBusy(true); setActionMsg(null);
        try { await createCentralNote({ content: noteText.trim(), entityType, entityId: observationId }); setNoteText(''); setActionMsg({ ok: true, text: 'Note added.' }); load(); }
        catch (e: any) { setActionMsg({ ok: false, text: e?.message || 'Failed to add note.' }); } finally { setBusy(false); }
    };
    const checkMisp = async () => { setTab('misp'); setBusy(true); try { await checkDarkWebObservationMisp(observationId); load(); loadCorrelations(); } finally { setBusy(false); } };
    const checkCredentialLeak = async () => { setTab('iocs'); setBusy(true); try { await checkDarkWebObservationCredentialLeak(observationId); load(); loadCorrelations(); } finally { setBusy(false); } };

    // DARK_WEB_PHASE2.md §4-25/§37-40 CROSS SOURCE CORRELATION — loaded
    // lazily (only when the tab is opened), never eagerly on every detail
    // load (the correlation engine does real bounded queries per IOC/entity).
    const [correlations, setCorrelations] = useState<DarkWebCorrelations | null>(null);
    const [correlationsLoading, setCorrelationsLoading] = useState(false);
    const loadCorrelations = useCallback(() => {
        setCorrelationsLoading(true);
        getDarkWebObservationCorrelations(observationId).then(setCorrelations).finally(() => setCorrelationsLoading(false));
    }, [observationId]);
    const [related, setRelated] = useState<DarkWebRelatedObservations | null>(null);
    const [relatedLoading, setRelatedLoading] = useState(false);
    const loadRelated = useCallback(() => {
        setRelatedLoading(true);
        getDarkWebRelatedObservations(observationId).then(setRelated).finally(() => setRelatedLoading(false));
    }, [observationId]);

    const tabs: { key: ObsTab; label: string }[] = [
        { key: 'overview', label: 'Overview' }, { key: 'content', label: 'Content' }, { key: 'iocs', label: `IOCs (${detail.iocs.length})` },
        { key: 'entities', label: `Entities (${detail.entities.length})` }, { key: 'crosssource', label: 'Cross Source' }, { key: 'misp', label: 'MISP' },
        { key: 'evidence', label: `Evidence (${detail.evidence.length})` },
        { key: 'timeline', label: 'Timeline' }, { key: 'investigations', label: `Investigations (${detail.cases.length})` }, { key: 'notes', label: `Notes (${detail.notes.length})` },
        { key: 'related', label: 'Related' },
        { key: 'monitoring', label: 'Change History' }, { key: 'ai', label: 'AI Assessment' },
    ];

    return (
        <>
            <button type="button" className="ti-action-btn" onClick={onBack} style={{ marginBottom: '10px' }}>‹ Back to Observations</button>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">{o.formattedId} — {o.title || '(untitled)'}</div>
                <div className="ti-kv">
                    <span className="k">Source</span><span className="v">{detail.source.name} ({detail.source.type.replace(/_/g, ' ')})</span>
                    <span className="k">Observed At</span><span className="v">{o.observedAt ? formatDateTime(o.observedAt) : 'Unknown'}</span>
                    <span className="k">Collected At</span><span className="v">{formatDateTime(o.collectedAt)}</span>
                    <span className="k">Collection Method</span><span className="v">{o.collectionMethod.replace(/_/g, ' ')}</span>
                    <span className="k">Status</span><span className="v"><span className="ti-badge">{o.status}</span></span>
                    {o.originalReference && <><span className="k">Original Reference</span><span className="v">{o.originalReference}</span></>}
                    {o.importSource && <><span className="k">Import Source</span><span className="v">{o.importSource}</span></>}
                </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {tabs.map((t) => (
                    <button key={t.key} type="button" className="ti-action-btn" style={tab === t.key ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined}
                        onClick={() => { setTab(t.key); if (t.key === 'crosssource' && !correlations) loadCorrelations(); if (t.key === 'related' && !related) loadRelated(); }}>{t.label}</button>
                ))}
            </div>

            {actionMsg && <div className={actionMsg.ok ? 'ti-note' : 'ti-error'} style={actionMsg.ok ? { color: '#4ade80', marginBottom: '10px' } : { marginBottom: '10px' }}>{actionMsg.text}</div>}

            {tab === 'overview' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Related</div>
                    {detail.iocs.length === 0 && detail.entities.length === 0 ? <div className="ti-empty">No IOCs or entities identified in this observation.</div> : (
                        <div className="ti-chip-list">
                            {detail.iocs.length > 0 && <span className="ti-chip">{detail.iocs.length} IOC candidate(s)</span>}
                            {detail.entities.length > 0 && <span className="ti-chip">{detail.entities.length} entity mention(s)</span>}
                        </div>
                    )}
                </div>
            )}

            {tab === 'content' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Content</div>
                    {/* §28/§79 — rendered as plain text ONLY; React never interprets this as markup. */}
                    <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', margin: 0 }}>{detail.content || '(no content)'}</pre>
                    <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Untrusted dark web content — displayed as plain text only, never executed or followed as instructions.</div>
                </div>
            )}

            {tab === 'iocs' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">IOC Candidates</div>
                    {detail.iocs.length === 0 ? <div className="ti-empty">No observable values identified.</div> : (
                        <ul className="ti-list">
                            {detail.iocs.map((i) => (
                                <li key={i.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span className="ti-badge" style={{ textTransform: 'uppercase' }}>{i.rawType || i.iocType}</span>
                                    <strong>{i.value}</strong>
                                    {i.matchStatus === 'existing' ? (
                                        <>
                                            <span className="ti-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Existing IOC Match</span>
                                            <button type="button" className="ti-action-btn" onClick={() => onOpenEntity('ioc', String(i.iocId))}>View IOC</button>
                                        </>
                                    ) : (
                                        <span className="ti-badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>New IOC Candidate — Pending Review</span>
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Observed in this dark web source only — never automatically Malicious, Confirmed, or Threat Actor owned.</div>
                </div>
            )}

            {tab === 'entities' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Entity Mentions</div>
                    {detail.entities.length === 0 ? <div className="ti-empty">No known entities mentioned.</div> : (
                        <ul className="ti-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                            {detail.entities.map((e) => (
                                <li key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', flexWrap: 'wrap' }}>
                                    <EntityChip entity={{ type: e.entityType, id: e.entityId, label: e.label || e.mentionText }} onOpen={onOpenEntity} />
                                    <span className="ti-badge" style={{ background: e.matchConfidence === 'exact' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)', color: e.matchConfidence === 'exact' ? '#4ade80' : '#eab308' }}>{e.matchConfidence === 'exact' ? 'Exact Match' : 'Possible Match'}</span>
                                    {e.claimType === 'claim' && <span className="ti-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Reported Claim</span>}
                                    <span className="ti-note">"{e.mentionText}"</span>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>A mention is never a confirmed relationship, and a claim ("We are X") is never treated as confirmed attribution.</div>
                </div>
            )}

            {tab === 'crosssource' && <CrossSourceTab loading={correlationsLoading} data={correlations} onReload={loadCorrelations} onOpenEntity={onOpenEntity} />}

            {tab === 'misp' && (
                <MispTab observationId={observationId} configured={detail.mispConfigured} iocCount={detail.iocs.filter((i) => i.iocType !== 'cve').length} busy={busy} onCheck={checkMisp} />
            )}

            {tab === 'evidence' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Evidence ({detail.evidence.length})</div>
                    {detail.evidence.length === 0 ? <div className="ti-empty">No related evidence.</div> : (
                        <ul className="ti-list">{detail.evidence.map((e: any) => <li key={e.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><strong>{e.id}</strong> — {e.description || '(no description)'}<div className="ti-note">Source: {e.source}</div></li>)}</ul>
                    )}
                </div>
            )}

            {tab === 'timeline' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Timeline</div>
                    {detail.timeline.length === 0 ? <div className="ti-empty">No recorded activity.</div> : (
                        <ul className="ti-list">{detail.timeline.map((t: any, i: number) => (
                            <li key={i} style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <span className="ti-note" style={{ minWidth: '150px' }}>{formatDateTime(t.created_at)}</span>
                                <span className="ti-badge">{t.action?.replace(/_/g, ' ')}</span>
                                <span className="ti-note">{t.previous_value && t.new_value ? `${t.previous_value} → ${t.new_value}` : (t.new_value || '')}</span>
                            </li>
                        ))}</ul>
                    )}
                </div>
            )}

            {tab === 'investigations' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Investigations</div>
                    {detail.cases.length === 0 ? <div className="ti-empty">No authorized cases reference this observation.</div> : (
                        <ul className="ti-list">{detail.cases.map((c: any) => <li key={c.id} style={{ padding: '5px 0' }}><strong>{c.case_number}</strong> — {c.title} <span className="ti-badge">{c.status}</span></li>)}</ul>
                    )}
                </div>
            )}

            {tab === 'notes' && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Notes {onViewNotes && <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onViewNotes(entityType, String(observationId), o.formattedId)}>View Notes</button>}</div>
                    {detail.notes.length === 0 ? <div className="ti-empty">No notes yet.</div> : (
                        <ul className="ti-list">{detail.notes.map((n: any) => <li key={n.id} className="ti-note" style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{n.contentPreview} — <em>{n.createdBy}</em>, {formatDateTime(n.createdAt)}</li>)}</ul>
                    )}
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                        <input type="text" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ flex: 1 }} />
                        <button type="button" className="ti-action-btn" onClick={addNote} disabled={busy || !noteText.trim()}>Add Note</button>
                    </div>
                </div>
            )}

            {tab === 'related' && <RelatedTab loading={relatedLoading} data={related} onOpen={onNavigateToObservation} />}
            {tab === 'monitoring' && <HistoryTab observationId={observationId} />}
            {tab === 'ai' && <ObservationAiTab observationId={observationId} />}

            {/* §53/§91 ANALYST REVIEW + ACTIONS */}
            <div className="ti-card" style={{ marginTop: '16px' }}>
                <div className="ti-card-title">Analyst Actions</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                    <input type="text" placeholder="Review reason (optional)" value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} style={{ width: '220px' }} />
                    <button type="button" className="ti-action-btn" onClick={() => review('reviewed')} disabled={busy}>Mark Reviewed</button>
                    <button type="button" className="ti-action-btn" onClick={() => review('relevant')} disabled={busy}>Mark Relevant</button>
                    <button type="button" className="ti-action-btn" onClick={() => review('irrelevant')} disabled={busy}>Mark Irrelevant</button>
                    <button type="button" className="ti-action-btn" onClick={() => review('archived')} disabled={busy}>Archive</button>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e) => setCaseIdInput(e.target.value)} style={{ width: '100px' }} />
                    <button type="button" className="ti-action-btn" onClick={addToCase} disabled={busy || !caseIdInput.trim()}>Add to Case</button>
                    <button type="button" className="ti-action-btn" onClick={createEvidence} disabled={busy}>Create Evidence</button>
                    <button type="button" className="ti-action-btn" onClick={checkMisp} disabled={busy}>Check MISP</button>
                    {detail.iocs.some((i) => i.iocType === 'email') && <button type="button" className="ti-action-btn" onClick={checkCredentialLeak} disabled={busy}>Check Credential Leak</button>}
                    {onCreateThreatBrief && <button type="button" className="ti-action-btn" onClick={() => onCreateThreatBrief(entityType, String(observationId))}>Add to Threat Brief Context</button>}
                </div>
                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Every action calls the existing Investigation/Evidence/Notes/MISP/Threat-Brief system directly — nothing is created automatically by collection or analysis.</div>
            </div>
        </>
    );
};

const MispTab: React.FC<{ observationId: number; configured: boolean; iocCount: number; busy: boolean; onCheck: () => void }> = ({ configured, iocCount, busy, onCheck }) => (
    <div className="ti-card" style={{ marginBottom: '16px' }}>
        <div className="ti-card-title">MISP</div>
        {!configured ? <div className="ti-empty">MISP: Not Configured</div> : iocCount === 0 ? <div className="ti-empty">No checkable IOC candidates in this observation.</div> : (
            <button type="button" className="ti-action-btn" onClick={onCheck} disabled={busy}>{busy ? 'Checking…' : 'Check MISP'}</button>
        )}
        <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>A MISP Match is a correlation, not an automatic maliciousness verdict.</div>
    </div>
);

// DARK_WEB_PHASE2.md §4-25/§37-40 CROSS SOURCE — Correlation Summary,
// Source Matrix, Exposure Summary/Level, Conflicts, Analyst Attention. All
// counts come straight from the backend's own real, RBAC-scoped computation.
const CrossSourceTab: React.FC<{ loading: boolean; data: DarkWebCorrelations | null; onReload: () => void; onOpenEntity: (t: string, id: string) => void }> = ({ loading, data, onReload, onOpenEntity }) => {
    if (loading) return <div className="ti-card"><div className="ti-empty">Loading correlations…</div></div>;
    if (!data) return <div className="ti-card"><button type="button" className="ti-action-btn" onClick={onReload}>Load Cross Source Correlations</button></div>;
    const { crossSourceSummary: s, exposureSummary: e, attention, conflicts, iocCorrelations, entityCorrelations } = data;
    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Correlation Summary</div>
                <div className="ti-kv">
                    <span className="k">IOC Matches</span><span className="v">{s.iocMatches}</span>
                    <span className="k">Entity Matches</span><span className="v">{s.entityMatches}</span>
                    <span className="k">MISP Matches</span><span className="v">{s.mispMatches}</span>
                    <span className="k">Credential Leak</span><span className="v">{s.credentialLeakMatches}</span>
                    <span className="k">Telegram</span><span className="v">{s.telegramMatches}</span>
                    <span className="k">Brand</span><span className="v">{s.brandMatches}</span>
                </div>
            </div>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Exposure Summary <span className="ti-badge" style={{ marginLeft: '8px', background: e.level === 'High' ? 'rgba(239,68,68,0.15)' : e.level === 'Medium' ? 'rgba(234,179,8,0.15)' : 'rgba(148,163,184,0.15)', color: e.level === 'High' ? '#f87171' : e.level === 'Medium' ? '#eab308' : '#94a3b8' }}>{e.level} Exposure</span></div>
                <div className="ti-kv">
                    <span className="k">Dark Web Observations</span><span className="v">{e.darkWebObservations}</span>
                    <span className="k">Known IOC</span><span className="v">{e.knownIoc}</span>
                    <span className="k">Threat Intelligence</span><span className="v">{e.threatIntelligence}</span>
                </div>
                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Exposure Context, not a Threat Score — never a substitute for the entity's own stored Risk.</div>
            </div>
            {attention.required && (
                <div className="ti-card" style={{ marginBottom: '16px', borderColor: 'rgba(234,179,8,0.4)' }}>
                    <div className="ti-card-title">Attention Required</div>
                    <div className="ti-chip-list">{attention.reasons.map((r, i) => <span key={i} className="ti-chip">{r}</span>)}</div>
                </div>
            )}
            {conflicts.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)' }}>
                    <div className="ti-card-title">Conflicts ({conflicts.length})</div>
                    <ul className="ti-list">{conflicts.map((c) => <li key={c.id} style={{ padding: '4px 0' }}><strong>{c.object}</strong>: {c.claimA} vs {c.claimB} <span className="ti-badge">{c.status}</span></li>)}</ul>
                    <div className="ti-note" style={{ fontStyle: 'italic' }}>Never resolved automatically.</div>
                </div>
            )}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Per-IOC Cross Source Detail</div>
                {iocCorrelations.filter((i) => i.kind === 'ioc').length === 0 ? <div className="ti-empty">No IOC candidates.</div> : (
                    <ul className="ti-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                        {iocCorrelations.filter((i) => i.kind === 'ioc').map((i) => (
                            <li key={i.id} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <strong>{i.value}</strong>
                                    {i.corroborated && <span className="ti-badge" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>Corroborated ({i.sourceDiversityCount})</span>}
                                    {i.reappeared?.isReappearance && <span className="ti-badge" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>Reappeared ({i.reappeared.gapDays}d gap)</span>}
                                    {i.newMispCorrelation && <span className="ti-badge">New MISP Correlation</span>}
                                    {i.newCredentialExposure && <span className="ti-badge">New Credential Exposure</span>}
                                </div>
                                <div className="ti-chip-list" style={{ marginTop: '4px' }}>
                                    <span className="ti-chip">Dark Web: {i.sourceMatrix?.darkWeb ? '✓' : '—'}</span>
                                    <span className="ti-chip">MISP: {i.sourceMatrix?.misp ? '✓' : '—'}</span>
                                    <span className="ti-chip">Brand: {i.sourceMatrix?.brand ? '✓' : '—'}</span>
                                    <span className="ti-chip">Telegram: {i.sourceMatrix?.telegram ? '✓' : '—'}</span>
                                    <span className="ti-chip">CTI: {i.sourceMatrix?.threatIntelligence ? '✓' : '—'}</span>
                                </div>
                                {i.brand?.matched && <div className="ti-note">Brand: {i.brand.brandName}</div>}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            {entityCorrelations.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Entity Context</div>
                    <ul className="ti-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                        {entityCorrelations.map((e2) => (
                            <li key={e2.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', flexWrap: 'wrap' }}>
                                <EntityChip entity={{ type: e2.entityType, id: e2.entityId, label: e2.label }} onOpen={onOpenEntity} />
                                {e2.isNewMention && <span className="ti-badge">New Context</span>}
                                {e2.context?.risk && <span className="ti-note">Risk: {e2.context.risk}</span>}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </>
    );
};

// §43 RELATED OBSERVATIONS — Same IOC/Entity/Source/Campaign/MISP Event/
// Activity Window, each with its own visible reason.
const RelatedTab: React.FC<{ loading: boolean; data: DarkWebRelatedObservations | null; onOpen: (id: number) => void }> = ({ loading, data, onOpen }) => {
    if (loading) return <div className="ti-card"><div className="ti-empty">Loading related observations…</div></div>;
    if (!data) return <div className="ti-empty">No related observations loaded yet.</div>;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Related Observations ({data.items.length})</div>
            {data.items.length === 0 ? <div className="ti-empty">No related observations found.</div> : (
                <ul className="ti-list">
                    {data.items.map((o) => (
                        <li key={o.id} className="ti-row-clickable" style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }} onClick={() => onOpen(o.id)}>
                            <strong>{o.formattedId}</strong> {o.title || o.snippet?.slice(0, 40) || '(untitled)'}
                            <span className="ti-chip-list" style={{ marginLeft: 'auto' }}>{o.reasons.map((r) => <span key={r} className="ti-chip">{r}</span>)}</span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// ═══════════════════════════════════════════════════════════════════════
// DARK_WEB_PHASE3.md §48/§76 "Dark Web Intelligence Assessment" — generated
// on demand only (never on every dashboard load, §69), always shows
// Generated At + AI Status, and degrades to the heuristic note if the LLM
// is unavailable — the dashboard's deterministic KPIs above are unaffected either way.
// ═══════════════════════════════════════════════════════════════════════
const DashboardAiAssessment: React.FC = () => {
    const [summary, setSummary] = useState<DarkWebDashboardAiSummary | null>(null);
    const [meta, setMeta] = useState<{ generatedAt: string; aiStatus: string; fallback: boolean } | null>(null);
    const [loading, setLoading] = useState(false);
    const generate = () => { setLoading(true); getDarkWebDashboardAiSummary().then((d) => { setSummary(d.summary); setMeta({ generatedAt: d.generatedAt, aiStatus: d.aiStatus, fallback: d.fallback }); }).finally(() => setLoading(false)); };

    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Dark Web Intelligence Assessment (AI) {meta && <span className="ti-badge" style={{ marginLeft: '8px' }}>{meta.aiStatus}</span>}
                <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={generate} disabled={loading}>{loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate Assessment'}</button>
            </div>
            {!summary ? <div className="ti-empty">Not yet generated.</div> : (
                <>
                    <p>{summary.executiveSummary}</p>
                    <AiListBlock title="Key Observations" items={summary.keyObservations} />
                    <AiListBlock title="New Exposure" items={summary.newExposure} />
                    <AiListBlock title="Correlations" items={summary.correlations} />
                    <AiListBlock title="Threat Actor Context" items={summary.threatActorContext} />
                    <AiListBlock title="Malware Context" items={summary.malwareContext} />
                    <AiListBlock title="Campaign Context" items={summary.campaignContext} />
                    <AiListBlock title="MISP" items={summary.misp} />
                    <AiListBlock title="Credential Exposure" items={summary.credentialExposure} />
                    <AiListBlock title="Conflicts" items={summary.conflicts} />
                    <AiListBlock title="Unknowns" items={summary.unknowns} />
                    <AiListBlock title="Sources" items={summary.sources} />
                    {meta && <div className="ti-note" style={{ marginTop: '8px' }}>Generated At: {formatDateTime(meta.generatedAt)}{meta.fallback ? ' · Fallback (heuristic) summary' : ''}</div>}
                    <div className="ti-note" style={{ fontStyle: 'italic' }}>{summary.note}</div>
                </>
            )}
        </div>
    );
};

const AiListBlock: React.FC<{ title: string; items: string[] }> = ({ title, items }) => items.length === 0 ? null : (
    <div style={{ marginTop: '8px' }}>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{title}</div>
        <ul className="ti-list">{items.map((it, i) => <li key={i} className="ti-note" style={{ padding: '2px 0' }}>{it}</li>)}</ul>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════
// DARK_WEB_PHASE3.md §18-22/§61-65 AI RECOMMENDATIONS + ACTION PREVIEW —
// the SAME generic `AiActionPreview`/`AiRecommendation`/
// `approveAiRecommendation` pattern already established for Threat Summary
// Phase 3 / IOC Analyzer Phase 3; a recommendation never executes on its
// own — Approve calls the real target API, whose own RBAC is authoritative.
// ═══════════════════════════════════════════════════════════════════════
const RecommendationsBlock: React.FC<{ recommendations: AiRecommendation[]; onReview: (rec: AiRecommendation) => void }> = ({ recommendations, onReview }) => (
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
                        {r.stateChanging ? <button type="button" className="ti-action-btn" onClick={() => onReview(r)}>Review</button> : <span className="ti-note" style={{ fontStyle: 'italic' }}>Informational</span>}
                    </li>
                ))}
            </ul>
        )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Recommendations only — no action is ever taken automatically.</div>
    </div>
);

const ActionPreviewModal: React.FC<{ rec: AiRecommendation; approving: boolean; result: { ok: boolean; message: string } | null; onApprove: () => void; onClose: () => void }> = ({ rec, approving, result, onApprove, onClose }) => (
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
                {result && <div className={result.ok ? 'ti-note' : 'ti-error'} style={result.ok ? { color: '#4ade80' } : undefined}>{result.message}</div>}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="ti-action-btn" onClick={onClose}>{result?.ok ? 'Close' : 'Cancel'}</button>
                    {!result?.ok && (
                        <button type="button" className="ti-action-btn" onClick={onApprove} disabled={approving || !rec.actionPreview} style={{ background: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.5)' }}>
                            {approving ? 'Approving…' : 'Approve'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
);

// ═══════════════════════════════════════════════════════════════════════
// DARK_WEB_PHASE3.md §77 MONITOR LIST — Source/Target/Status/Last Checked/
// Recent Events/Severity, [Check Now]/[Edit]/[Pause]/[Delete] all calling
// the EXISTING generic /api/monitoring/monitors/:id* routes directly
// (checkMonitorNow/updateMonitor/deleteMonitor — never a duplicate route).
// ═══════════════════════════════════════════════════════════════════════
const MonitorsView: React.FC = () => {
    const [items, setItems] = useState<DarkWebMonitor[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const [showAdd, setShowAdd] = useState(false);

    const load = useCallback(() => { setLoading(true); getDarkWebMonitors().then((d) => setItems(d.items)).finally(() => setLoading(false)); }, []);
    useEffect(() => { load(); }, [load]);

    const checkNow = async (id: number) => {
        setBusyId(id); setMsg(null);
        try { const res = await checkMonitorNow(id); setMsg({ ok: true, text: `Check complete — ${res.events.length} event(s).` }); load(); }
        catch (e: any) { setMsg({ ok: false, text: e?.message || 'Check failed.' }); } finally { setBusyId(null); }
    };
    const togglePause = async (m: DarkWebMonitor) => {
        setBusyId(m.id);
        try { await updateMonitor(m.id, { status: m.status === 'active' ? 'paused' : 'active' }); load(); } finally { setBusyId(null); }
    };
    const remove = async (id: number) => {
        setBusyId(id);
        try { await deleteMonitor(id); load(); } finally { setBusyId(null); }
    };

    return (
        <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div className="ti-note">Widens the existing generic Monitoring architecture — Check Now/Pause/Delete call the same monitor API used everywhere else in the app.</div>
                <button type="button" className="ti-action-btn" onClick={() => setShowAdd(true)}>Add IOC Monitor</button>
            </div>
            {showAdd && <AddIocMonitorForm onClose={() => setShowAdd(false)} onCreated={() => { setShowAdd(false); load(); }} />}
            {msg && <div className={msg.ok ? 'ti-note' : 'ti-error'} style={msg.ok ? { color: '#4ade80', marginBottom: '10px' } : { marginBottom: '10px' }}>{msg.text}</div>}
            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>Target</th><th>Type</th><th>Status</th><th>Last Checked</th><th>Recent Events</th><th>Severity</th><th></th></tr></thead>
                    <tbody>
                        {loading ? <tr><td colSpan={7} className="ti-empty">Loading…</td></tr> : items.length === 0 ? (
                            <tr><td colSpan={7} className="ti-empty">No Dark Web monitors yet. Create one from a Source or Observation's IOC candidates.</td></tr>
                        ) : items.map((m) => (
                            <tr key={m.id}>
                                <td style={{ fontWeight: 600 }}>{m.targetLabel}{m.label ? <div className="ti-note">{m.label}</div> : null}</td>
                                <td><span className="ti-badge">{m.type.replace('dark_web_', '')}</span></td>
                                <td><span className="ti-badge">{m.status}</span></td>
                                <td className="ti-note">{m.lastCheckedAt ? formatDateTime(m.lastCheckedAt) : 'Never'}</td>
                                <td>{m.recentEventCount}</td>
                                <td><span className="ti-badge" style={SEVERITY_COLOR[m.highestSeverity] || SEVERITY_COLOR.info}>{m.highestSeverity}</span></td>
                                <td style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                    <button type="button" className="ti-action-btn" onClick={() => checkNow(m.id)} disabled={busyId === m.id}>Check Now</button>
                                    <button type="button" className="ti-action-btn" onClick={() => togglePause(m)} disabled={busyId === m.id}>{m.status === 'active' ? 'Pause' : 'Resume'}</button>
                                    <button type="button" className="ti-action-btn" onClick={() => remove(m.id)} disabled={busyId === m.id}>Delete</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </>
    );
};

const AddIocMonitorForm: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const submit = async () => {
        if (!value.trim()) { setErr('IOC value is required.'); return; }
        setBusy(true); setErr(null);
        try { await createDarkWebMonitor({ kind: 'ioc', value: value.trim() }); onCreated(); }
        catch (e: any) { setErr(e?.message || 'Failed to create monitor'); } finally { setBusy(false); }
    };
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Add IOC Monitor</div>
            <input type="text" placeholder="Domain, IP, hash, email, username…" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%' }} />
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy}>{busy ? 'Creating…' : 'Create Monitor'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

// DARK_WEB_PHASE3.md §78 OBSERVATION DETAIL — Change History (Phase 2's own
// getDarkWebObservationHistory) + AI Assessment tab.
const HistoryTab: React.FC<{ observationId: number }> = ({ observationId }) => {
    const [data, setData] = useState<DarkWebHistory | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { setLoading(true); getDarkWebObservationHistory(observationId).then(setData).finally(() => setLoading(false)); }, [observationId]);
    if (loading) return <div className="ti-card"><div className="ti-empty">Loading change history…</div></div>;
    if (!data || data.status === 'insufficient_history') return <div className="ti-card"><div className="ti-empty">Insufficient History — not enough prior observations to compare against.</div></div>;
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Change History</div>
            {data.status === 'no_change' || data.changes.length === 0 ? <div className="ti-empty">No Change detected.</div> : (
                <ul className="ti-list">{data.changes.map((c, i) => <li key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><span className="ti-badge">{c.type}</span> {c.value} — <span className="ti-note">{c.detail}</span></li>)}</ul>
            )}
        </div>
    );
};

const ObservationAiTab: React.FC<{ observationId: number }> = ({ observationId }) => {
    const [summary, setSummary] = useState<DarkWebObservationAiSummary | null>(null);
    const [recommendations, setRecommendations] = useState<AiRecommendation[]>([]);
    const [meta, setMeta] = useState<{ generatedAt: string; dataAsOf: string | null; aiStatus: string; fallback: boolean } | null>(null);
    const [loading, setLoading] = useState(false);
    const [previewRec, setPreviewRec] = useState<AiRecommendation | null>(null);
    const [approving, setApproving] = useState(false);
    const [approveResult, setApproveResult] = useState<{ ok: boolean; message: string } | null>(null);

    const generate = () => {
        setLoading(true);
        getDarkWebObservationAiSummary(observationId).then((d) => { setSummary(d.summary); setRecommendations(d.recommendations); setMeta({ generatedAt: d.generatedAt, dataAsOf: d.dataAsOf, aiStatus: d.aiStatus, fallback: d.fallback }); }).finally(() => setLoading(false));
    };
    const openPreview = (rec: AiRecommendation) => { setApproveResult(null); setPreviewRec(rec); };
    const approve = async (preview: AiActionPreview) => {
        setApproving(true); setApproveResult(null);
        try { await approveAiRecommendation(preview); setApproveResult({ ok: true, message: 'Action completed — the existing API confirmed the result.' }); generate(); }
        catch (e: any) { setApproveResult({ ok: false, message: e?.status === 403 ? 'Permission Required — you do not have permission to perform this action.' : (e?.message || 'The action could not be completed.') }); }
        finally { setApproving(false); }
    };

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">AI Assessment {meta && <span className="ti-badge" style={{ marginLeft: '8px' }}>{meta.aiStatus}</span>}
                    <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={generate} disabled={loading}>{loading ? 'Generating…' : summary ? 'Regenerate' : 'Generate'}</button>
                </div>
                {!summary ? <div className="ti-empty">Not yet generated.</div> : (
                    <>
                        <p>{summary.assessment}</p>
                        <AiListBlock title="Key Observations" items={summary.keyObservations} />
                        <AiListBlock title="New Exposure" items={summary.newExposure} />
                        <AiListBlock title="Correlations" items={summary.correlations} />
                        <AiListBlock title="Threat Actor Context" items={summary.threatActorContext} />
                        <AiListBlock title="Malware Context" items={summary.malwareContext} />
                        <AiListBlock title="Campaign Context" items={summary.campaignContext} />
                        <AiListBlock title="MISP" items={summary.misp} />
                        <AiListBlock title="Credential Exposure" items={summary.credentialExposure} />
                        <AiListBlock title="Conflicts" items={summary.conflicts} />
                        <AiListBlock title="Unknowns" items={summary.unknowns} />
                        <AiListBlock title="Sources" items={summary.sources} />
                        {meta && <div className="ti-note" style={{ marginTop: '8px' }}>Generated At: {formatDateTime(meta.generatedAt)}{meta.dataAsOf ? ` · Data As Of: ${formatDateTime(meta.dataAsOf)}` : ''}{meta.fallback ? ' · Fallback (heuristic) summary' : ''}</div>}
                        <div className="ti-note" style={{ fontStyle: 'italic' }}>{summary.note}</div>
                    </>
                )}
            </div>
            {summary && <RecommendationsBlock recommendations={recommendations} onReview={openPreview} />}
            {previewRec && <ActionPreviewModal rec={previewRec} approving={approving} result={approveResult} onApprove={() => previewRec.actionPreview && approve(previewRec.actionPreview)} onClose={() => setPreviewRec(null)} />}
        </>
    );
};

// DARK_WEB_PHASE3.md §79 SOURCE DETAIL — Monitoring/Forecast/AI Assessment.
const SourceMonitoringPanel: React.FC<{ sourceId: number; sourceName: string }> = ({ sourceId, sourceName }) => {
    const [monitors, setMonitors] = useState<DarkWebMonitor[] | null>(null);
    const [trend, setTrend] = useState<DarkWebSourceTrendData | null>(null);
    const [forecast, setForecast] = useState<DarkWebForecast | null>(null);
    const [creating, setCreating] = useState(false);
    const [aiSummary, setAiSummary] = useState<DarkWebSourceAiSummary | null>(null);
    const [aiLoading, setAiLoading] = useState(false);

    const load = useCallback(() => {
        getDarkWebMonitors().then((d) => setMonitors(d.items.filter((m) => m.type === 'dark_web_source' && m.target === String(sourceId))));
        getDarkWebSourceTrend(sourceId).then(setTrend).catch(() => {});
        getDarkWebSourceForecast(sourceId).then(setForecast).catch(() => {});
    }, [sourceId]);
    useEffect(() => { load(); }, [load]);

    const createMonitor = async () => {
        setCreating(true);
        try { await createDarkWebMonitor({ kind: 'source', sourceId, label: `Dark Web Source — ${sourceName}` }); load(); } finally { setCreating(false); }
    };
    const generateAi = () => { setAiLoading(true); getDarkWebSourceAiSummary(sourceId).then((d) => setAiSummary(d.summary)).finally(() => setAiLoading(false)); };

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Monitoring</div>
                {monitors === null ? <div className="ti-empty">Loading…</div> : monitors.length === 0 ? (
                    <button type="button" className="ti-action-btn" onClick={createMonitor} disabled={creating}>{creating ? 'Creating…' : 'Create Monitor'}</button>
                ) : (
                    <div className="ti-kv">
                        <span className="k">Status</span><span className="v">{monitors[0].status}</span>
                        <span className="k">Last Checked</span><span className="v">{monitors[0].lastCheckedAt ? formatDateTime(monitors[0].lastCheckedAt) : 'Never'}</span>
                        <span className="k">Recent Events</span><span className="v">{monitors[0].recentEventCount}</span>
                    </div>
                )}
                {trend && (
                    <div className="ti-kv" style={{ marginTop: '10px' }}>
                        <span className="k">Activity (7d vs prior 7d)</span><span className="v">{trend.current} vs {trend.previous}{trend.changePercent != null ? ` (${trend.changePercent > 0 ? '+' : ''}${trend.changePercent}%)` : ''}</span>
                    </div>
                )}
            </div>
            {forecast && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Activity Outlook</div>
                    {forecast.status === 'insufficient_data' ? <div className="ti-empty">{forecast.language}</div> : (
                        <>
                            <div className="ti-kv"><span className="k">Direction</span><span className="v">{forecast.direction}</span><span className="k">Confidence</span><span className="v">{forecast.confidence}</span></div>
                            <div className="ti-note" style={{ marginTop: '6px' }}>{forecast.language}</div>
                        </>
                    )}
                    <div className="ti-note" style={{ marginTop: '6px', fontStyle: 'italic' }}>{forecast.note}</div>
                </div>
            )}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">AI Assessment <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={generateAi} disabled={aiLoading}>{aiLoading ? 'Generating…' : aiSummary ? 'Regenerate' : 'Generate'}</button></div>
                {!aiSummary ? <div className="ti-empty">Not yet generated.</div> : (
                    <>
                        <p>{aiSummary.assessment}</p>
                        <AiListBlock title="New IOCs" items={aiSummary.newIocs} />
                        <AiListBlock title="New Entities" items={aiSummary.newEntities} />
                        <AiListBlock title="Activity Trend" items={aiSummary.activityTrend} />
                        <AiListBlock title="Correlations" items={aiSummary.correlations} />
                        <AiListBlock title="Sources" items={aiSummary.sources} />
                        <div className="ti-note" style={{ fontStyle: 'italic' }}>{aiSummary.note}</div>
                    </>
                )}
            </div>
        </>
    );
};

export default DarkWebIntelligenceHome;
