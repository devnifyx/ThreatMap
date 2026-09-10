// KNOWLEDGE_BASE_PHASE1.md — a curated, reusable KNOWLEDGE LAYER (§2 "NOT a
// second Threat Intel/Evidence/Threat Brief/Investigation system"). Reuses
// ThreatIntelligencePage.css's existing ti-* visual system (§37 "Use the
// existing LekirraX design") — this file only adds the handful of
// Knowledge-Base-specific layouts (kb-*) that don't already exist, the same
// convention ThreatBriefsPage.css already established for tb-*.
import React, { useCallback, useEffect, useState } from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
import './KnowledgeBasePage.css';
import {
    getKnowledgeMetadata, getKnowledgeEntries, createKnowledgeEntry, getKnowledgeEntry, updateKnowledgeEntry,
    deleteKnowledgeEntry, submitKnowledgeForReview, getKnowledgeQualityCheck, publishKnowledgeEntry, archiveKnowledgeEntry,
    createKnowledgeEntryRevision, getKnowledgeRevisions, addKnowledgeSource, removeKnowledgeSource,
    addKnowledgeReference, removeKnowledgeReference, addKnowledgeEntity, removeKnowledgeEntity, getRelatedKnowledge,
    markKnowledgeReviewed, getKnowledgeDashboard, getAptGroupKnowledgeGaps,
    // KNOWLEDGE_BASE_PHASE3.md
    getKnowledgeHealth, getKnowledgeReviewQueue, getKnowledgeCoverageDashboard, setKnowledgeReviewInterval,
    dismissKnowledgeConflict, checkKnowledgeReferenceAvailability, suggestKnowledgeUpdate, getKnowledgeSuggestions,
    applyKnowledgeSuggestion, rejectKnowledgeSuggestion,
    type KnowledgeEntry, type KnowledgeEntryDetail, type KnowledgeMetadata, type KnowledgeRevision,
    type KnowledgeQualityCheck, type RelatedKnowledgeEntry, type SearchResultItem,
    type KnowledgeDashboardStats, type KnowledgeGapEntity,
    type KnowledgeHealth, type KnowledgeConflict, type KnowledgeSuggestion, type KnowledgeReviewQueueItem, type KnowledgeCoverageDashboard
} from '../../services/api';
import { ConfidenceBadge, EntityChip, ConfirmDialog, formatDate, formatDateTime } from '../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../components/shared/Pagination';  // P2-8
import EntityPicker from '../../components/shared/EntityPicker';  // P1-5 — was KnowledgeEntityPicker

const STATUS_LABELS: Record<string, string> = { draft: 'Draft', review: 'In Review', published: 'Published', archived: 'Archived' };
function isLocked(status: string) { return status === 'published' || status === 'archived'; }

// §12 "ENTITY REFERENCES" — the exact GRAPH_ENTITY_TYPES set server.js
// validates knowledge_entity_links against (see server.js/entityRelationships.js).
const KB_LINKABLE_ENTITY_TYPES = new Set([
    'ioc', 'campaign', 'threat_actor', 'malware', 'vulnerability', 'attack_technique',
    'company', 'image', 'social_investigation', 'brand', 'social_account', 'telegram_source', 'report', 'alert', 'monitor'
    // Deliberately excludes 'knowledge_entry' here — searchIntelligence()
    // (the backend for this picker) doesn't surface Knowledge Entries as
    // search results (see database/storage.js's searchIntelligence
    // comment), so it would never appear as a pick option regardless.
]);

function textInputStyle(): React.CSSProperties {
    return { background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' };
}
function textareaStyle(): React.CSSProperties {
    return { width: '100%', background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '8px', fontFamily: 'inherit', fontSize: '0.88rem' };
}

// §9 "RICH TEXT/MARKDOWN" — the app's existing react-markdown dependency
// (already used by PrintableScanReport.tsx/SecurityReport.tsx), never a
// dangerouslySetInnerHTML/rehype-raw path — §32 "CONTENT SECURITY" (no
// stored XSS) holds by construction, not a bespoke sanitizer.
const MarkdownPreview: React.FC<{ text: string }> = ({ text }) => (
    <div className="kb-markdown">
        <Markdown remarkPlugins={[remarkGfm]}>{text || '*Nothing written yet.*'}</Markdown>
    </div>
);

// §9/§8 — a plain textarea with a Write/Preview toggle, the lightest
// reuse of react-markdown that supports Headings/Paragraphs/Lists/Code/
// Tables/Links/Quotes without introducing a second editor framework.
const MarkdownField: React.FC<{ value: string; onChange: (v: string) => void; rows?: number; placeholder?: string }> = ({ value, onChange, rows = 10, placeholder }) => {
    const [tab, setTab] = useState<'write' | 'preview'>('write');
    return (
        <div>
            <div className="kb-md-tabs">
                <button type="button" className={`ti-action-btn${tab === 'write' ? ' tb-view-toggle-active' : ''}`} onClick={() => setTab('write')}>Write</button>
                <button type="button" className={`ti-action-btn${tab === 'preview' ? ' tb-view-toggle-active' : ''}`} onClick={() => setTab('preview')}>Preview</button>
                <span className="ti-note" style={{ marginLeft: 'auto' }}>Markdown — headings, lists, code, tables, links, quotes</span>
            </div>
            {tab === 'write' ? (
                <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={rows} style={textareaStyle()} placeholder={placeholder} />
            ) : (
                <div style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-sm)', padding: '10px', minHeight: `${rows * 1.4}em` }}>
                    <MarkdownPreview text={value} />
                </div>
            )}
        </div>
    );
};

// §7 "TAGS" — reusable free-text chips, the SAME KeyFindingsEditor-style
// add/remove-chip interaction ThreatBriefsPage already uses for a similar
// list-of-strings field.
const TagsEditor: React.FC<{ items: string[]; disabled: boolean; onChange: (items: string[]) => void }> = ({ items, disabled, onChange }) => {
    const [draft, setDraft] = useState('');
    const add = () => {
        const v = draft.trim().toLowerCase();
        if (!v || items.includes(v)) { setDraft(''); return; }
        onChange([...items, v]);
        setDraft('');
    };
    return (
        <div>
            <div className="ti-chip-list">
                {items.map((t) => (
                    <span key={t} className="ti-chip" style={{ cursor: disabled ? 'default' : undefined }}>
                        {t}
                        {!disabled && <button type="button" aria-label={`Remove tag ${t}`} onClick={() => onChange(items.filter((x) => x !== t))} className="kb-chip-remove">×</button>}
                    </span>
                ))}
                {items.length === 0 && <span className="ti-note">No tags yet.</span>}
            </div>
            {!disabled && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <input type="text" placeholder="Add a tag…" value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }} style={{ flex: 1, maxWidth: '240px', ...textInputStyle() }} />
                    <button type="button" className="ti-action-btn" onClick={add} disabled={!draft.trim()}>Add</button>
                </div>
            )}
        </div>
    );
};

// §12 "ENTITY REFERENCES" — searches the SAME unified search entity pickers
// elsewhere already use, filtered to the types a Knowledge Entry may
// reference (KB_LINKABLE_ENTITY_TYPES).
const EntitiesPanel: React.FC<{ entry: KnowledgeEntryDetail; locked: boolean; meta: KnowledgeMetadata | null; onChanged: () => void; onOpenEntity?: (type: string, id: string) => void }> = ({ entry, locked, meta, onChanged, onOpenEntity }) => {
    const [showPicker, setShowPicker] = useState(false);
    const [relationshipType, setRelationshipType] = useState('About');

    const pick = async (item: SearchResultItem) => {
        await addKnowledgeEntity(entry.id, item.type, item.id, relationshipType);
        setShowPicker(false);
        onChanged();
    };
    const remove = async (entityType: string, entityId: string) => {
        await removeKnowledgeEntity(entry.id, entityType, entityId);
        onChanged();
    };

    return (
        <div>
            {!locked && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '10px', flexWrap: 'wrap' }}>
                    <button type="button" className="ti-action-btn" onClick={() => setShowPicker((v) => !v)}>+ Link Existing Entity</button>
                    <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value)}>
                        {(meta?.relationshipTypes || ['About']).map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                </div>
            )}
            {showPicker && <EntityPicker onPick={pick} onCancel={() => setShowPicker(false)}
                placeholder="Search APT Groups, Campaigns, Malware, MITRE, IOCs, Brands, Companies, Threat Briefs, Investigations…"
                filter={(i) => KB_LINKABLE_ENTITY_TYPES.has(i.type)} />}
            {entry.entities.length === 0 ? <div className="ti-empty">No entities linked yet — link an APT Group, Campaign, Malware, MITRE Technique, IOC, Threat Brief, Investigation, or other existing entity.</div> : (
                <div className="kb-entity-list">
                    {entry.entities.map((e) => (
                        <div key={`${e.entity_type}:${e.entity_id}`} className="kb-entity-row">
                            <span className="ti-note" style={{ textTransform: 'capitalize', minWidth: '90px' }}>{e.relationship_type}</span>
                            {e.resolved ? <EntityChip entity={e.entity} onOpen={onOpenEntity} /> : <span className="ti-note">{e.entity.label} (no longer available)</span>}
                            {!locked && <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => remove(e.entity_type, e.entity_id)}>Remove</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const SourcesPanel: React.FC<{ entry: KnowledgeEntryDetail; locked: boolean; meta: KnowledgeMetadata | null; onChanged: () => void }> = ({ entry, locked, meta, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ sourceType: '', description: '' });
    const submit = async () => {
        if (!form.sourceType) return;
        await addKnowledgeSource(entry.id, { sourceType: form.sourceType, description: form.description.trim() || undefined });
        setForm({ sourceType: '', description: '' });
        setAdding(false);
        onChanged();
    };
    const remove = async (id: number) => { await removeKnowledgeSource(entry.id, id); onChanged(); };
    return (
        <div>
            {!locked && (
                <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={() => setAdding((v) => !v)}>+ Add Source</button>
            )}
            {adding && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <select value={form.sourceType} onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value }))}>
                        <option value="">Source type…</option>
                        {(meta?.sourceTypes || []).map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input type="text" placeholder="Description (optional)…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ minWidth: '240px', ...textInputStyle() }} />
                    <button type="button" className="ti-action-btn" onClick={submit} disabled={!form.sourceType}>Save</button>
                </div>
            )}
            {entry.sources.length === 0 ? <div className="ti-empty">No sources recorded yet.</div> : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {entry.sources.map((s) => (
                        <div key={s.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ flex: 1 }}>
                                <div><strong>{s.source_type}</strong></div>
                                {s.description && <div className="ti-note">{s.description}</div>}
                                <div className="ti-note">{formatDateTime(s.created_at)}{s.username ? ` · ${s.username}` : ''}</div>
                            </div>
                            {!locked && <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => remove(s.id)}>Remove</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ReferencesPanel: React.FC<{ entry: KnowledgeEntryDetail; locked: boolean; onChanged: () => void }> = ({ entry, locked, onChanged }) => {
    const [adding, setAdding] = useState(false);
    const [form, setForm] = useState({ title: '', url: '', source: '', publishedDate: '', accessedDate: '', notes: '' });
    const submit = async () => {
        if (!form.title.trim()) return;
        await addKnowledgeReference(entry.id, {
            title: form.title.trim(), url: form.url.trim() || undefined, source: form.source.trim() || undefined,
            publishedDate: form.publishedDate || undefined, accessedDate: form.accessedDate || undefined, notes: form.notes.trim() || undefined
        });
        setForm({ title: '', url: '', source: '', publishedDate: '', accessedDate: '', notes: '' });
        setAdding(false);
        onChanged();
    };
    const remove = async (id: number) => { await removeKnowledgeReference(entry.id, id); onChanged(); };
    return (
        <div>
            {!locked && (
                <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={() => setAdding((v) => !v)}>+ Add Reference</button>
            )}
            {adding && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <input type="text" placeholder="Title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ minWidth: '220px', ...textInputStyle() }} />
                    <input type="text" placeholder="URL (optional — leave blank for internal sources)…" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} style={{ minWidth: '260px', ...textInputStyle() }} />
                    <input type="text" placeholder="Source label (optional)…" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={{ minWidth: '160px', ...textInputStyle() }} />
                    <input type="date" title="Published date" value={form.publishedDate} onChange={(e) => setForm((f) => ({ ...f, publishedDate: e.target.value }))} style={textInputStyle()} />
                    <input type="date" title="Accessed date" value={form.accessedDate} onChange={(e) => setForm((f) => ({ ...f, accessedDate: e.target.value }))} style={textInputStyle()} />
                    <input type="text" placeholder="Notes (optional)…" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} style={{ minWidth: '200px', ...textInputStyle() }} />
                    <button type="button" className="ti-action-btn" onClick={submit} disabled={!form.title.trim()}>Save</button>
                </div>
            )}
            {entry.references.length === 0 ? <div className="ti-empty">No references recorded yet.</div> : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {entry.references.map((r) => (
                        <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ flex: 1 }}>
                                <div><strong>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</strong> {r.source && <span className="ti-note">· {r.source}</span>}</div>
                                {(r.published_date || r.accessed_date) && <div className="ti-note">{r.published_date ? `Published ${r.published_date}` : ''}{r.published_date && r.accessed_date ? ' · ' : ''}{r.accessed_date ? `Accessed ${r.accessed_date}` : ''}</div>}
                                {r.notes && <div className="ti-note">{r.notes}</div>}
                            </div>
                            {!locked && <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => remove(r.id)}>Remove</button>}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// §16 "VERSION HISTORY"
const RevisionsPanel: React.FC<{ entryId: number; status: string; onRevised: () => void }> = ({ entryId, status, onRevised }) => {
    const [revisions, setRevisions] = useState<KnowledgeRevision[]>([]);
    const [loading, setLoading] = useState(true);
    const [starting, setStarting] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getKnowledgeRevisions(entryId).then(setRevisions).finally(() => setLoading(false));
    }, [entryId]);
    useEffect(() => { load(); }, [load]);

    const startRevision = async () => {
        setStarting(true);
        try { await createKnowledgeEntryRevision(entryId); onRevised(); } finally { setStarting(false); }
    };

    return (
        <div>
            {status === 'published' && (
                <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={startRevision} disabled={starting}>{starting ? 'Starting…' : 'Create New Revision'}</button>
            )}
            {loading ? <div className="ti-loading">Loading…</div> : revisions.length === 0 ? (
                <div className="ti-empty">No published revisions yet — publishing this entry will record v1.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Version</th><th>Title</th><th>Confidence</th><th>Published</th><th>Author</th></tr></thead>
                        <tbody>
                            {revisions.map((r) => (
                                <tr key={r.id}>
                                    <td>v{r.revision_number}</td>
                                    <td>{r.title}</td>
                                    <td><ConfidenceBadge confidence={r.confidence} /></td>
                                    <td>{formatDate(r.published_at)}</td>
                                    <td>{r.published_by_username || '—'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// KNOWLEDGE_BASE_PHASE3.md §4/§8/§9/§18/§19 "KNOWLEDGE HEALTH" / "CONFLICT
// DETECTION" / "AI KNOWLEDGE UPDATE" / "DIFF VIEW" — one panel: the real
// health metrics, open conflicts (dismiss = analyst judgment, §8 "never
// automatic"), and any pending AI update suggestion with its Current-vs-
// Suggested diff (Apply/Reject — "Edit" is simply closing this and editing
// the entry normally, per §19's own three actions, never a second editor).
const HealthPanel: React.FC<{ entry: KnowledgeEntryDetail; onChanged: () => void }> = ({ entry, onChanged }) => {
    const [health, setHealth] = useState<KnowledgeHealth | null>(null);
    const [conflicts, setConflicts] = useState<KnowledgeConflict[]>([]);
    const [suggestions, setSuggestions] = useState<KnowledgeSuggestion[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [suggesting, setSuggesting] = useState(false);
    const [suggestNote, setSuggestNote] = useState<string | null>(null);
    const [busyId, setBusyId] = useState<number | null>(null);
    const [checkingRefId, setCheckingRefId] = useState<number | null>(null);
    const [refStatus, setRefStatus] = useState<Record<number, string>>({});

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        Promise.all([getKnowledgeHealth(entry.id), getKnowledgeSuggestions(entry.id)])
            .then(([h, s]) => { setHealth(h.health); setConflicts(h.conflicts); setSuggestions(s); })
            .catch((err) => setError(err?.message || 'Failed to load knowledge health'))
            .finally(() => setLoading(false));
    }, [entry.id]);
    useEffect(() => { load(); }, [load]);

    const runSuggestUpdate = async () => {
        setSuggesting(true);
        setSuggestNote(null);
        try {
            const result = await suggestKnowledgeUpdate(entry.id);
            if (!result.diff?.length) setSuggestNote('No update suggested — this entry appears current relative to existing intelligence.');
            else if (result.conflictNote) setSuggestNote(result.conflictNote);
            load();
        } catch (err: any) {
            setSuggestNote(err?.message || 'Failed to generate suggestion');
        } finally {
            setSuggesting(false);
        }
    };
    const runDismissConflict = async (conflictId: number) => {
        setBusyId(conflictId);
        try { await dismissKnowledgeConflict(entry.id, conflictId); load(); } finally { setBusyId(null); }
    };
    const runApply = async (suggestionId: number) => {
        setBusyId(suggestionId);
        try { await applyKnowledgeSuggestion(suggestionId); load(); onChanged(); } finally { setBusyId(null); }
    };
    const runReject = async (suggestionId: number) => {
        setBusyId(suggestionId);
        try { await rejectKnowledgeSuggestion(suggestionId); load(); } finally { setBusyId(null); }
    };
    const runCheckReference = async (referenceId: number) => {
        setCheckingRefId(referenceId);
        try { const r = await checkKnowledgeReferenceAvailability(entry.id, referenceId); setRefStatus((s) => ({ ...s, [referenceId]: r.status })); } finally { setCheckingRefId(null); }
    };

    if (error) return <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>;
    if (loading || !health) return <div className="ti-loading">Loading…</div>;

    const pendingSuggestions = suggestions.filter((s) => s.status === 'pending');
    const resolvedSuggestions = suggestions.filter((s) => s.status !== 'pending');

    return (
        <div>
            <div className="ti-kv" style={{ marginBottom: '14px' }}>
                <span className="k">Freshness</span><span className="v" style={{ textTransform: 'capitalize' }}>{health.freshness}{health.reviewRecommendedReason ? ` — ${health.reviewRecommendedReason}` : ''}</span>
                <span className="k">Quality</span><span className="v">{health.qualityPercent}%</span>
                <span className="k">Sources</span><span className="v">{health.sourceAvailability.total} ({health.sourceAvailability.primary} primary, {health.sourceAvailability.secondary} secondary{health.sourceAvailability.unavailableReferences ? `, ${health.sourceAvailability.unavailableReferences} unavailable` : ''})</span>
                <span className="k">Related Entities</span><span className="v">{health.entityLinkIntegrity.total}{health.entityLinkIntegrity.broken ? ` (${health.entityLinkIntegrity.broken} broken)` : ''}</span>
                <span className="k">Open Conflicts</span><span className="v">{health.openConflicts}</span>
            </div>
            {health.missing.length > 0 && (
                <div className="ti-note" style={{ marginBottom: '14px' }}>
                    <strong>Missing:</strong> {health.missing.join('; ')}
                </div>
            )}

            <div style={{ marginBottom: '16px' }}>
                <div className="ti-modal-subtitle">References — Availability</div>
                {entry.references.length === 0 ? <div className="ti-empty">No references to check.</div> : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {entry.references.map((r) => (
                            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                <span className="ti-note" style={{ flex: 1 }}>{r.title}</span>
                                <span className="ti-note">{refStatus[r.id] || r.availability_status}</span>
                                {r.url && <button type="button" className="ti-action-btn" disabled={checkingRefId === r.id} onClick={() => runCheckReference(r.id)}>{checkingRefId === r.id ? 'Checking…' : 'Check'}</button>}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div style={{ marginBottom: '16px' }}>
                <div className="ti-modal-subtitle">Potential Conflicts ({conflicts.filter((c) => c.status === 'open').length} open)</div>
                {conflicts.filter((c) => c.status === 'open').length === 0 ? <div className="ti-empty">No conflicts detected.</div> : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {conflicts.filter((c) => c.status === 'open').map((c) => (
                            <div key={c.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                <div style={{ flex: 1 }}>{c.description}</div>
                                <button type="button" className="ti-action-btn" disabled={busyId === c.id} onClick={() => runDismissConflict(c.id)}>{busyId === c.id ? 'Dismissing…' : 'Dismiss'}</button>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div>
                <div className="ti-modal-subtitle" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>AI Update Suggestions</span>
                    <button type="button" className="ti-action-btn" onClick={runSuggestUpdate} disabled={suggesting}>{suggesting ? 'Analyzing…' : 'Suggest Update'}</button>
                </div>
                {suggestNote && <div className="ti-note" style={{ marginTop: '6px' }}>{suggestNote}</div>}
                {pendingSuggestions.map((s) => (
                    <div key={s.id} className="ti-note tb-ai-draft" style={{ marginTop: '10px' }}>
                        <div>{s.reason}</div>
                        {s.diff.map((d, i) => (
                            <div key={i} style={{ marginTop: '8px' }}>
                                <div className="ti-note" style={{ textTransform: 'capitalize' }}>{d.field}</div>
                                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                    <div style={{ flex: 1, minWidth: '200px' }}><div className="ti-note">Current</div><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.8rem' }}>{typeof d.current === 'string' ? d.current : JSON.stringify(d.current, null, 2)}</pre></div>
                                    <div style={{ flex: 1, minWidth: '200px' }}><div className="ti-note">Suggested</div><pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: '0.8rem' }}>{typeof d.suggested === 'string' ? d.suggested : JSON.stringify(d.suggested, null, 2)}</pre></div>
                                </div>
                            </div>
                        ))}
                        <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                            <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} disabled={busyId === s.id} onClick={() => runApply(s.id)}>{busyId === s.id ? 'Applying…' : 'Apply'}</button>
                            <button type="button" className="ti-action-btn ti-action-btn--danger" disabled={busyId === s.id} onClick={() => runReject(s.id)}>Reject</button>
                        </div>
                    </div>
                ))}
                {resolvedSuggestions.length > 0 && (
                    <div style={{ marginTop: '10px' }}>
                        <div className="ti-note">History</div>
                        {resolvedSuggestions.map((s) => <div key={s.id} className="ti-note">{s.reason} — <span style={{ textTransform: 'capitalize' }}>{s.status}</span></div>)}
                    </div>
                )}
            </div>
        </div>
    );
};

// §21 "RELATED KNOWLEDGE" — transparent, rule-based (matchedVia surfaces
// exactly why each item matched — never an opaque score).
const RelatedKnowledgePanel: React.FC<{ entryId: number; onOpen: (id: number) => void }> = ({ entryId, onOpen }) => {
    const [items, setItems] = useState<RelatedKnowledgeEntry[] | null>(null);
    useEffect(() => { getRelatedKnowledge(entryId).then(setItems).catch(() => setItems([])); }, [entryId]);
    if (items === null) return <div className="ti-loading">Loading…</div>;
    if (items.length === 0) return <div className="ti-empty">No related knowledge found yet — link entities or tags in common with other entries.</div>;
    return (
        <div className="kb-related-list">
            {items.map((it) => (
                <button type="button" key={it.id} className="kb-related-item" onClick={() => onOpen(it.id)}>
                    <span className="ti-target">{it.title}</span>
                    <span className="ti-note">{it.category} · matched via {it.matchedVia.join(', ')}</span>
                </button>
            ))}
        </div>
    );
};

// ─── Detail / Editor view ────────────────────────────────────────────────
const KnowledgeEntryDetailView: React.FC<{ id: number; onBack: () => void; onOpenEntity?: (type: string, id: string) => void; onOpenEntry: (id: number) => void }> = ({ id, onBack, onOpenEntity, onOpenEntry }) => {
    const [entry, setEntry] = useState<KnowledgeEntryDetail | null>(null);
    const [meta, setMeta] = useState<KnowledgeMetadata | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [actionBusy, setActionBusy] = useState<string | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [qualityBlock, setQualityBlock] = useState<KnowledgeQualityCheck | null>(null);
    const [publishing, setPublishing] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [tab, setTab] = useState<'entities' | 'sources' | 'references' | 'related' | 'history' | 'health'>('entities');
    // KNOWLEDGE_BASE_PHASE2.md §33 "KNOWLEDGE REVIEW"
    const [reviewNote, setReviewNote] = useState('');
    const [showReviewForm, setShowReviewForm] = useState(false);
    const [reviewing, setReviewing] = useState(false);

    const [draft, setDraft] = useState({ title: '', summary: '', content: '', category: '', confidence: 'Unknown', tags: [] as string[] });

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getKnowledgeEntry(id).then((e) => {
            setEntry(e);
            setDraft({ title: e.title, summary: e.summary || '', content: e.content || '', category: e.category, confidence: e.confidence, tags: e.tags });
        }).catch((err) => setError(err?.message || 'Failed to load knowledge entry')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { getKnowledgeMetadata().then(setMeta).catch(() => setMeta(null)); }, []);

    const locked = entry ? isLocked(entry.status) : false;

    const save = async () => {
        setSaving(true);
        setActionError(null);
        try {
            await updateKnowledgeEntry(id, draft);
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
        try { await fn(); load(); } catch (err: any) { setActionError(err?.message || `Failed to ${name}`); } finally { setActionBusy(null); }
    };

    const runPublish = async (force = false) => {
        setPublishing(true);
        setActionError(null);
        try {
            if (!force) {
                const quality = await getKnowledgeQualityCheck(id);
                if (!quality.canPublish) { setQualityBlock(quality); setPublishing(false); return; }
            }
            await publishKnowledgeEntry(id, force);
            setQualityBlock(null);
            load();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to publish');
        } finally {
            setPublishing(false);
        }
    };

    const runMarkReviewed = async () => {
        setReviewing(true);
        setActionError(null);
        try {
            await markKnowledgeReviewed(id, reviewNote.trim() || undefined);
            setReviewNote('');
            setShowReviewForm(false);
            load();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to mark reviewed');
        } finally {
            setReviewing(false);
        }
    };

    const runDelete = async () => {
        setActionBusy('delete');
        setActionError(null);
        try { await deleteKnowledgeEntry(id); onBack(); } catch (err: any) { setActionError(err?.message || 'Failed to delete'); setConfirmDelete(false); } finally { setActionBusy(null); }
    };

    if (error) return <div className="ti-card"><div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div></div>;
    if (loading || !entry) return <div className="ti-card"><div className="ti-loading">Loading…</div></div>;

    return (
        <div className="tb-detail">
            <div className="ti-card">
                <div className="ti-section-header">
                    <div>
                        <button type="button" className="ti-refresh-btn" onClick={onBack} style={{ marginBottom: '8px' }}>‹ Back to Knowledge Base</button>
                        {locked ? <h2 style={{ margin: 0 }}>{entry.title}</h2> : (
                            <input type="text" value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} placeholder="Knowledge Entry Title" style={{ ...textInputStyle(), fontSize: '1.15rem', width: '100%', maxWidth: '640px' }} />
                        )}
                    </div>
                    <div className="tb-lifecycle-actions">
                        {entry.status === 'draft' && <button type="button" className="ti-action-btn" disabled={!!actionBusy} onClick={() => runAction('submit', () => submitKnowledgeForReview(id))}>{actionBusy === 'submit' ? 'Submitting…' : 'Submit for Review'}</button>}
                        {(entry.status === 'draft' || entry.status === 'review') && <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} disabled={publishing} onClick={() => runPublish(false)}>{publishing ? 'Publishing…' : 'Publish'}</button>}
                        {entry.status !== 'archived' && <button type="button" className="ti-action-btn" disabled={!!actionBusy} onClick={() => runAction('archive', () => archiveKnowledgeEntry(id))}>{actionBusy === 'archive' ? 'Archiving…' : 'Archive'}</button>}
                        {/* §33 "KNOWLEDGE REVIEW" — allowed even while locked (published); marking reviewed never touches authored content. */}
                        {entry.status === 'published' && <button type="button" className="ti-action-btn" onClick={() => setShowReviewForm((v) => !v)}>Mark Reviewed</button>}
                        <button type="button" className="ti-action-btn ti-action-btn--danger" disabled={!!actionBusy} onClick={() => setConfirmDelete(true)}>Delete</button>
                    </div>
                </div>

                {actionError && <div className="ti-error" style={{ marginBottom: '10px' }}>{actionError}</div>}
                {showReviewForm && (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                        <input type="text" placeholder="Review note (optional)…" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} style={{ minWidth: '260px', ...textInputStyle() }} />
                        <button type="button" className="ti-action-btn" onClick={runMarkReviewed} disabled={reviewing}>{reviewing ? 'Saving…' : 'Confirm Reviewed'}</button>
                    </div>
                )}
                {qualityBlock && (
                    <div className="ti-error" style={{ marginBottom: '10px' }}>
                        Cannot publish yet: {qualityBlock.issues.join('; ')}
                        <div style={{ marginTop: '6px' }}>
                            <button type="button" className="ti-action-btn" onClick={() => runPublish(true)} disabled={publishing}>Publish Anyway</button>
                        </div>
                    </div>
                )}

                <div className="ti-kv">
                    <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{STATUS_LABELS[entry.status] || entry.status}</span>
                    <span className="k">Category</span><span className="v">{entry.category}</span>
                    <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={draft.confidence || entry.confidence} /></span>
                    <span className="k">Author</span><span className="v">{entry.author_username || '—'}</span>
                    <span className="k">Version</span><span className="v">v{entry.current_revision || 0}</span>
                    <span className="k">Created</span><span className="v">{formatDate(entry.created_at)}</span>
                    <span className="k">Updated</span><span className="v">{formatDate(entry.updated_at)}</span>
                    {entry.published_at && <><span className="k">Published</span><span className="v">{formatDate(entry.published_at)}</span></>}
                    {entry.archived_at && <><span className="k">Archived</span><span className="v">{formatDate(entry.archived_at)}</span></>}
                    {/* §32 "KNOWLEDGE FRESHNESS" */}
                    <span className="k">Last Reviewed</span>
                    <span className="v">
                        {entry.last_reviewed_at ? `${formatDate(entry.last_reviewed_at)}${entry.reviewer_username ? ` · ${entry.reviewer_username}` : ''}` : 'Never'}
                        {entry.review_status === 'review_recommended' && <span className="ti-badge ti-badge--medium" style={{ marginLeft: '8px' }} title={entry.review_recommended_reason || undefined}>Review Recommended</span>}
                    </span>
                    {/* KNOWLEDGE_BASE_PHASE3.md §22 "KNOWLEDGE FRESHNESS" — configurable review period */}
                    <span className="k">Review Period</span>
                    <span className="v">
                        <select
                            value={entry.review_interval_days ?? ''}
                            onChange={async (e) => { const v = e.target.value ? Number(e.target.value) : null; await setKnowledgeReviewInterval(entry.id, v); load(); }}
                        >
                            <option value="">Default (180 days)</option>
                            <option value="30">30 days</option>
                            <option value="90">90 days</option>
                            <option value="180">180 days</option>
                            <option value="365">365 days</option>
                        </select>
                    </span>
                </div>

                {locked && (
                    <div className="ti-note tb-lock-banner">
                        This entry is {entry.status} — its authored content is a locked snapshot (KNOWLEDGE_BASE_PHASE1.md §16/§30). Use “Create New Revision” below to edit it again.
                    </div>
                )}

                {!locked && (
                    <div className="tb-field-grid">
                        <label>
                            <span>Category</span>
                            <select value={draft.category} onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}>
                                {(meta?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Confidence</span>
                            <select value={draft.confidence} onChange={(e) => setDraft((d) => ({ ...d, confidence: e.target.value }))}>
                                {(meta?.confidenceLevels || ['High', 'Medium', 'Low', 'Unknown']).map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                    </div>
                )}

                <div style={{ marginTop: '12px' }}>
                    <div className="ti-modal-subtitle">Tags</div>
                    <TagsEditor items={draft.tags} disabled={locked} onChange={(tags) => setDraft((d) => ({ ...d, tags }))} />
                </div>

                {!locked && <button type="button" className="ti-action-btn" style={{ marginTop: '12px' }} onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Summary</span></div>
                {locked ? <p className="tb-readonly-text">{entry.summary || '—'}</p> : (
                    <textarea value={draft.summary} onChange={(e) => setDraft((d) => ({ ...d, summary: e.target.value }))} rows={2} style={textareaStyle()} placeholder="One or two sentences — what is this knowledge about?" />
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Content</span></div>
                {locked ? <MarkdownPreview text={entry.content || ''} /> : (
                    <MarkdownField value={draft.content} onChange={(v) => setDraft((d) => ({ ...d, content: v }))} rows={16} placeholder={'## Overview\n\n## Technical Details\n\n## Observed Behavior\n\n## Detection\n\n## Indicators\n\n## Mitigation\n\n(Only include the sections that apply — nothing here is mandatory.)'} />
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header">
                    <span className="ti-card-title">Related Information</span>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {(['health', 'entities', 'sources', 'references', 'related', 'history'] as const).map((t) => (
                            <button key={t} type="button" className={`ti-action-btn${tab === t ? ' tb-view-toggle-active' : ''}`} onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
                                {t === 'entities' ? 'Related Entities' : t === 'related' ? 'Related Knowledge' : t === 'history' ? 'Version History' : t === 'health' ? `Health${entry.review_recommended ? ' ⚠' : ''}` : t}
                            </button>
                        ))}
                    </div>
                </div>
                {tab === 'health' && <HealthPanel entry={entry} onChanged={load} />}
                {tab === 'entities' && <EntitiesPanel entry={entry} locked={locked} meta={meta} onChanged={load} onOpenEntity={onOpenEntity} />}
                {tab === 'sources' && <SourcesPanel entry={entry} locked={locked} meta={meta} onChanged={load} />}
                {tab === 'references' && <ReferencesPanel entry={entry} locked={locked} onChanged={load} />}
                {tab === 'related' && <RelatedKnowledgePanel entryId={entry.id} onOpen={onOpenEntry} />}
                {tab === 'history' && <RevisionsPanel entryId={entry.id} status={entry.status} onRevised={load} />}
            </div>

            {confirmDelete && (
                <ConfirmDialog title="Delete Knowledge Entry" text="Delete this entry? This cannot be undone." meta={actionError} busy={actionBusy === 'delete'} confirmLabel="Delete" onCancel={() => setConfirmDelete(false)} onConfirm={runDelete} />
            )}
        </div>
    );
};

// ─── List view ───────────────────────────────────────────────────────────
export interface KnowledgeCreatePrefill { title: string; category: string; relatedEntityType: string; relatedEntityId: string }
interface KnowledgeBaseListProps {
    onOpen: (id: number) => void;
    onCreated: (id: number) => void;
    initialFilter?: { relatedEntityType: string; relatedEntityId: string; label: string } | null;
    // KNOWLEDGE_BASE_PHASE2.md §24 "KNOWLEDGE GAP DETECTION" — [Create Knowledge Entry],
    // pre-opens the create form filled from the originating entity; never auto-created.
    createPrefill?: KnowledgeCreatePrefill | null;
    onCreatePrefillConsumed?: () => void;
}
const KnowledgeBaseList: React.FC<KnowledgeBaseListProps> = ({ onOpen, onCreated, initialFilter, createPrefill, onCreatePrefillConsumed }) => {
    const [meta, setMeta] = useState<KnowledgeMetadata | null>(null);
    const [items, setItems] = useState<KnowledgeEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filters, setFilters] = useState({ q: '', category: 'all', status: 'all', confidence: 'all', tag: '' });
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(!!createPrefill);
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [form, setForm] = useState({ title: createPrefill?.title || '', category: createPrefill?.category || '', confidence: 'Unknown' });

    useEffect(() => { getKnowledgeMetadata().then((m) => { setMeta(m); setForm((f) => ({ ...f, category: f.category || m.categories[0] || '' })); }).catch(() => setMeta(null)); }, []);
    useEffect(() => {
        if (createPrefill) {
            setForm({ title: createPrefill.title, category: createPrefill.category, confidence: 'Unknown' });
            setShowCreate(true);
            onCreatePrefillConsumed?.();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [createPrefill]);

    const relatedFilter = initialFilter ? { relatedEntityType: initialFilter.relatedEntityType, relatedEntityId: initialFilter.relatedEntityId } : {};

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getKnowledgeEntries({
            q: filters.q || undefined, category: filters.category !== 'all' ? filters.category : undefined,
            status: filters.status !== 'all' ? filters.status : undefined, confidence: filters.confidence !== 'all' ? filters.confidence : undefined,
            tag: filters.tag || undefined, page, pageSize, ...relatedFilter
        }).then((res) => { setItems(res.items); setTotal(res.total); }).catch((err) => setError(err?.message || 'Failed to load Knowledge Base')).finally(() => setLoading(false));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filters, page, initialFilter]);
    useEffect(() => { load(); }, [load]);

    const runCreate = async () => {
        if (!form.title.trim() || !form.category) return;
        setCreating(true);
        setCreateError(null);
        try {
            const result = await createKnowledgeEntry({ title: form.title.trim(), category: form.category, confidence: form.confidence });
            // §24 — the analyst explicitly triggered this from a Knowledge
            // Gap on a real entity, so linking it back is the whole point of
            // the action (still never automatic knowledge GENERATION — the
            // entry's content stays entirely analyst-written).
            if (createPrefill?.relatedEntityType && createPrefill?.relatedEntityId) {
                await addKnowledgeEntity(result.id, createPrefill.relatedEntityType, createPrefill.relatedEntityId, 'About').catch(() => {});
            }
            setShowCreate(false);
            setForm((f) => ({ ...f, title: '' }));
            onCreated(result.id);
        } catch (err: any) {
            setCreateError(err?.message || 'Failed to create knowledge entry');
        } finally {
            setCreating(false);
        }
    };

    const runDelete = async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        setDeleteError(null);
        try { await deleteKnowledgeEntry(confirmDeleteId); setConfirmDeleteId(null); load(); } catch (err: any) { setDeleteError(err?.message || 'Failed to delete'); } finally { setDeleting(false); }
    };

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.category === 'all' && filters.status === 'all' && filters.confidence === 'all' && !filters.tag;

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Knowledge Base{initialFilter ? ` — Related to ${initialFilter.label}` : ''}</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={() => setShowCreate((v) => !v)}>+ New Knowledge Entry</button>
                </div>
            </div>

            {showCreate && (
                <div className="tb-create-form">
                    {createError && <div className="ti-error">{createError}</div>}
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <input type="text" placeholder="Knowledge Entry title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} style={{ minWidth: '260px', ...textInputStyle() }} />
                        <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                            {(meta?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                            {(meta?.confidenceLevels || ['High', 'Medium', 'Low', 'Unknown']).map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                        <button type="button" className="ti-action-btn" onClick={runCreate} disabled={creating || !form.title.trim() || !form.category}>{creating ? 'Creating…' : 'Create'}</button>
                    </div>
                </div>
            )}

            <div className="ti-filters">
                <input type="text" placeholder="Search title, summary, content, tags, category, author…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.category} onChange={(e) => { setFilters((f) => ({ ...f, category: e.target.value })); setPage(1); }}>
                    <option value="all">All Categories</option>
                    {(meta?.categories || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option>
                    {(meta?.statuses || ['draft', 'review', 'published', 'archived']).map((s) => <option key={s} value={s}>{STATUS_LABELS[s] || s}</option>)}
                </select>
                <select value={filters.confidence} onChange={(e) => { setFilters((f) => ({ ...f, confidence: e.target.value })); setPage(1); }}>
                    <option value="all">All Confidence</option>
                    {(meta?.confidenceLevels || []).map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Tag…" value={filters.tag} onChange={(e) => { setFilters((f) => ({ ...f, tag: e.target.value })); setPage(1); }} style={{ maxWidth: '140px' }} />
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No Knowledge Entries yet — create the first one.' : 'No Knowledge Entries match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Title</th><th>Category</th><th>Status</th><th>Confidence</th><th>Author</th><th>Updated</th><th>Tags</th><th>Action</th></tr></thead>
                            <tbody>
                                {items.map((r) => (
                                    <tr key={r.id} className="ti-row-clickable" onClick={() => onOpen(r.id)}>
                                        <td><span className="ti-target" title={r.title}>{r.title}</span></td>
                                        <td>{r.category}</td>
                                        <td style={{ textTransform: 'capitalize' }}>
                                            {STATUS_LABELS[r.status] || r.status}
                                            {r.review_status === 'review_recommended' && <span className="ti-badge ti-badge--medium" style={{ marginLeft: '6px' }} title="Review Recommended">⚠</span>}
                                        </td>
                                        <td><ConfidenceBadge confidence={r.confidence} /></td>
                                        <td>{r.author_username || '—'}</td>
                                        <td>{formatDate(r.updated_at)}</td>
                                        <td>{r.tags.length ? r.tags.slice(0, 3).join(', ') + (r.tags.length > 3 ? '…' : '') : '—'}</td>
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
                <ConfirmDialog title="Delete Knowledge Entry" text="Delete this entry? This cannot be undone." meta={deleteError} busy={deleting} confirmLabel="Delete" onCancel={() => { setConfirmDeleteId(null); setDeleteError(null); }} onConfirm={runDelete} />
            )}
        </div>
    );
};

// KNOWLEDGE_BASE_PHASE3.md §9/§10 "KNOWLEDGE REVIEW QUEUE" / "REVIEW
// PRIORITY" — every item's priority carries a real, visible reason (never
// an opaque score); clicking a row opens the entry directly.
const ReviewQueueView: React.FC<{ onOpenEntry: (id: number) => void }> = ({ onOpenEntry }) => {
    const [items, setItems] = useState<KnowledgeReviewQueueItem[] | null>(null);
    const [highPriorityCount, setHighPriorityCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState('all');

    const load = useCallback(() => {
        setLoading(true);
        getKnowledgeReviewQueue(category !== 'all' ? category : undefined).then((r) => { setItems(r.items); setHighPriorityCount(r.highPriorityCount); }).finally(() => setLoading(false));
    }, [category]);
    useEffect(() => { load(); }, [load]);

    const categories = ['Newly Created', 'Review Recommended', 'Entity Changed', 'Potential Conflict', 'Low Confidence', 'Missing References', 'Missing Related Entities'];

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Knowledge Review Queue {items ? `— ${items.length} entr${items.length === 1 ? 'y' : 'ies'}` : ''}{highPriorityCount > 0 ? ` (${highPriorityCount} high priority)` : ''}</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>
            <div className="ti-filters">
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="all">All Categories</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
            </div>
            {loading || !items ? <div className="ti-loading">Loading…</div> : items.length === 0 ? (
                <div className="ti-empty">Nothing needs review right now.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Title</th><th>Priority</th><th>Reason</th><th>Categories</th><th>Action</th></tr></thead>
                        <tbody>
                            {items.map((item) => (
                                <tr key={item.id} className="ti-row-clickable" onClick={() => onOpenEntry(item.id)}>
                                    <td><span className="ti-target">{item.title}</span></td>
                                    <td><span className={`ti-badge ti-badge--${item.priority === 'HIGH' ? 'high' : item.priority === 'MEDIUM' ? 'medium' : 'low'}`}>{item.priority}</span></td>
                                    <td>{item.priorityReason}</td>
                                    <td>{item.categories.join(', ')}</td>
                                    <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); onOpenEntry(item.id); }}>Open</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// KNOWLEDGE_BASE_PHASE3.md §12 "KNOWLEDGE COVERAGE DASHBOARD" — a knowledge
// COMPLETENESS indicator, explicitly not a security score (§12's own words).
const CoverageDashboardView: React.FC = () => {
    const [coverage, setCoverage] = useState<KnowledgeCoverageDashboard | null>(null);
    useEffect(() => { getKnowledgeCoverageDashboard().then(setCoverage).catch(() => setCoverage({})); }, []);
    if (!coverage) return <div className="ti-loading">Loading…</div>;
    return (
        <div style={{ marginTop: '16px' }}>
            <div className="ti-modal-subtitle">Knowledge Coverage</div>
            <div className="ti-note" style={{ marginBottom: '8px' }}>Completeness indicator only — not a security risk score.</div>
            <div className="kb-coverage-grid">
                {Object.entries(coverage).map(([label, c]) => (
                    <div key={label} className={`kb-coverage-item ${c.status === 'Covered' ? 'covered' : c.status === 'Partial' ? 'partial' : 'missing'}`}>
                        <span>{label}</span><span>{c.status}{c.total != null ? ` (${c.covered}/${c.total})` : ''}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// §37 "KNOWLEDGE BASE DASHBOARD" — every value real (getKnowledgeDashboardStats).
const KnowledgeDashboardView: React.FC<{ onOpenEntry: (id: number) => void; onOpenReviewQueue: () => void }> = ({ onOpenEntry, onOpenReviewQueue }) => {
    const [stats, setStats] = useState<KnowledgeDashboardStats | null>(null);
    const [gaps, setGaps] = useState<KnowledgeGapEntity[] | null>(null);
    const [loading, setLoading] = useState(true);
    const [showGaps, setShowGaps] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getKnowledgeDashboard().then(setStats).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    const loadGaps = () => { setShowGaps((v) => !v); if (!gaps) getAptGroupKnowledgeGaps().then(setGaps).catch(() => setGaps([])); };

    if (loading || !stats) return <div className="ti-card"><div className="ti-loading">Loading…</div></div>;

    const tiles: { label: string; value: number; warn?: boolean; onClick?: () => void }[] = [
        { label: 'Total Entries', value: stats.total },
        { label: 'Published', value: stats.published },
        { label: 'Draft', value: stats.draft },
        { label: 'In Review', value: stats.review },
        { label: 'Archived', value: stats.archived },
        { label: 'Review Recommended', value: stats.reviewRecommended, warn: stats.reviewRecommended > 0, onClick: onOpenReviewQueue },
        { label: 'Knowledge Conflicts', value: stats.conflicts, warn: stats.conflicts > 0, onClick: onOpenReviewQueue },
        { label: 'Pending AI Suggestions', value: stats.pendingSuggestions, warn: stats.pendingSuggestions > 0 },
        { label: 'Knowledge Gaps (APT Groups)', value: stats.knowledgeGaps, warn: stats.knowledgeGaps > 0 }
    ];

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Knowledge Base Dashboard</span>
                <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>Refresh</button>
            </div>
            <div className="kb-dashboard-grid">
                {tiles.map((t) => (
                    <div className={`kb-dashboard-tile${t.warn ? ' warn' : ''}`} key={t.label} style={t.onClick ? { cursor: 'pointer' } : undefined} onClick={t.onClick}>
                        <div className="kb-dashboard-value">{t.value}</div>
                        <div className="kb-dashboard-label">{t.label}</div>
                    </div>
                ))}
            </div>
            <CoverageDashboardView />
            {stats.knowledgeGaps > 0 && (
                <div style={{ marginTop: '12px' }}>
                    <button type="button" className="ti-action-btn" onClick={loadGaps}>{showGaps ? 'Hide' : 'View'} APT Groups with No Knowledge</button>
                    {showGaps && gaps && (
                        <div className="ti-chip-list" style={{ marginTop: '8px' }}>
                            {gaps.map((g) => <span key={g.id} className="ti-chip" style={{ cursor: 'default' }}>{g.label}</span>)}
                            {gaps.length === 0 && <span className="ti-note">No gaps found.</span>}
                        </div>
                    )}
                </div>
            )}
            <div style={{ marginTop: '16px' }}>
                <div className="ti-modal-subtitle">Recently Updated</div>
                {stats.recentUpdates.length === 0 ? <div className="ti-empty">No recent activity.</div> : (
                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                        {stats.recentUpdates.map((r) => (
                            <div key={r.id} className="ti-row-clickable" style={{ display: 'flex', gap: '8px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => onOpenEntry(r.id)}>
                                <span className="ti-target">{r.title}</span>
                                <span className="ti-note" style={{ textTransform: 'capitalize' }}>{r.status}</span>
                                <span style={{ flex: 1 }} />
                                <span className="ti-note">{r.author} · {formatDateTime(r.updatedAt)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Page ────────────────────────────────────────────────────────────────
export interface KnowledgeBaseFilterContext { relatedEntityType: string; relatedEntityId: string; label: string; }
interface KnowledgeBasePageProps {
    isAdmin: boolean;
    initialFilter?: KnowledgeBaseFilterContext | null;
    onInitialFilterConsumed?: () => void;
    initialCreatePrefill?: KnowledgeCreatePrefill | null;
    onInitialCreatePrefillConsumed?: () => void;
    // §26 "KNOWLEDGE CONTEXT PANEL" — open one specific recommended entry directly.
    initialOpenId?: number | null;
    onInitialOpenIdConsumed?: () => void;
    onOpenEntity?: (type: string, id: string) => void;
}
type KnowledgeBasePageMode = 'list' | 'detail' | 'dashboard' | 'review-queue';

const KnowledgeBasePage: React.FC<KnowledgeBasePageProps> = ({ initialFilter, onInitialFilterConsumed, initialCreatePrefill, onInitialCreatePrefillConsumed, initialOpenId, onInitialOpenIdConsumed, onOpenEntity }) => {
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [mode, setMode] = useState<KnowledgeBasePageMode>('list');
    const [activeFilter, setActiveFilter] = useState<KnowledgeBaseFilterContext | null>(initialFilter || null);
    const [createPrefill, setCreatePrefill] = useState<KnowledgeCreatePrefill | null>(initialCreatePrefill || null);

    useEffect(() => {
        if (initialFilter) { setActiveFilter(initialFilter); setMode('list'); setSelectedId(null); onInitialFilterConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialFilter]);
    useEffect(() => {
        if (initialCreatePrefill) { setCreatePrefill(initialCreatePrefill); setMode('list'); setSelectedId(null); onInitialCreatePrefillConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialCreatePrefill]);
    useEffect(() => {
        if (initialOpenId != null) { setSelectedId(initialOpenId); setMode('detail'); onInitialOpenIdConsumed?.(); }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialOpenId]);

    const openEntry = (id: number) => { setSelectedId(id); setMode('detail'); };

    return (
        <div className="ti-page tb-page kb-page">
            <div className="ti-header">
                <h1>Knowledge Base</h1>
                <p className="ti-subtitle">Curated, reusable analyst knowledge — methodology, detections, and documented behaviors — connected to LekirraX's existing Threat Intelligence, APT Groups, MITRE ATT&amp;CK, Threat Briefs, and Investigations. Not a second Threat Intelligence, Evidence, or Investigation system.</p>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                    <button type="button" className={`ti-action-btn${mode === 'list' || mode === 'detail' ? ' tb-view-toggle-active' : ''}`} onClick={() => { setMode('list'); setSelectedId(null); }}>Entries</button>
                    <button type="button" className={`ti-action-btn${mode === 'dashboard' ? ' tb-view-toggle-active' : ''}`} onClick={() => setMode('dashboard')}>Dashboard</button>
                    <button type="button" className={`ti-action-btn${mode === 'review-queue' ? ' tb-view-toggle-active' : ''}`} onClick={() => setMode('review-queue')}>Review Queue</button>
                </div>
                {activeFilter && (
                    <div className="ti-note" style={{ marginTop: '6px' }}>
                        Filtered to entries related to <strong>{activeFilter.label}</strong>.
                        <button type="button" className="ti-action-btn" style={{ marginLeft: '8px' }} onClick={() => setActiveFilter(null)}>Clear Filter</button>
                    </div>
                )}
            </div>
            <div className="ti-container">
                <div className="ti-content">
                    {mode === 'detail' && selectedId != null ? (
                        <KnowledgeEntryDetailView id={selectedId} onBack={() => { setSelectedId(null); setMode('list'); }} onOpenEntity={onOpenEntity} onOpenEntry={openEntry} />
                    ) : mode === 'dashboard' ? (
                        <KnowledgeDashboardView onOpenEntry={(id) => { setSelectedId(id); setMode('detail'); }} onOpenReviewQueue={() => setMode('review-queue')} />
                    ) : mode === 'review-queue' ? (
                        <ReviewQueueView onOpenEntry={(id) => { setSelectedId(id); setMode('detail'); }} />
                    ) : (
                        <KnowledgeBaseList onOpen={openEntry} onCreated={openEntry} initialFilter={activeFilter} createPrefill={createPrefill} onCreatePrefillConsumed={() => setCreatePrefill(null)} />
                    )}
                </div>
            </div>
        </div>
    );
};

export default KnowledgeBasePage;
