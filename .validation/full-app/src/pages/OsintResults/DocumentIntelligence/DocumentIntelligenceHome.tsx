// DOCUMENT_INTELLIGENCE_PHASE1.md — Document Repository, Ingestion,
// Metadata, Text Extraction & Search. Replaces the "planned for a future
// update" placeholder under OSINT → Media Intelligence → Document Intelligence.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import './DocumentIntelligence.css';
import {
    getDocuments, getDocumentStats, getDocument, getDocumentContent, getDocumentPages,
    searchWithinDocument as apiSearchWithinDocument, uploadDocument, downloadDocument,
    getEvidence, addEvidence, deleteEvidence, getEntityTimeline, getCasesForEntity, addCaseTarget, getCases,
    type DocumentRecord, type DocumentStats, type DocumentContent, type DocumentPage, type DocumentSearchResult,
    type EvidenceItem, type EntityCaseRef, type CaseListItem, type DocumentSource,
    // DOCUMENT_INTELLIGENCE_PHASE2.md — IOC/Entity/Relationship candidate extraction & review.
    analyzeDocument, getDocumentAnalysis, getDocumentIocCandidates, getDocumentEntityCandidates, getDocumentRelationshipCandidates,
    acceptIocCandidate, rejectIocCandidate, acceptEntityCandidate, rejectEntityCandidate,
    acceptRelationshipCandidate, rejectRelationshipCandidate, createEvidenceFromCandidate,
    type DocumentAnalysisSummary, type DocumentIocCandidate, type DocumentEntityCandidate, type DocumentRelationshipCandidate,
    // DOCUMENT_INTELLIGENCE_PHASE3.md — Claims, Conflicts, Correlation/Similarity/Duplicates, Comparison, Drafts, Export.
    markDocumentReviewed, exportDocumentAnalysis,
    getDocumentClaims, acceptClaim, rejectClaim, dismissClaim, createEvidenceFromClaim, getClaimCorroboration,
    getDocumentConflicts, reviewConflict, getRelatedDocuments, getDocumentDuplicates, compareDocumentsApi,
    getIntelligenceGaps, createKnowledgeDraftFromDocument, createThreatBriefDraftFromDocument,
    type DocumentClaim, type DocumentConflict, type RelatedDocument, type DocumentDuplicatesResult, type DocumentComparisonResult,
} from '../../../services/api';
import { formatDate, formatDateTime } from '../../ThreatIntelligence/ThreatIntelligenceShared';
import KnowledgeContextPanel from '../../KnowledgeBase/KnowledgeContextPanel';

const DOCUMENT_TYPES = ['PDF', 'DOCX', 'TXT', 'CSV', 'JSON', 'HTML', 'XML'];
const EXTRACTION_STATUSES = ['pending', 'processing', 'completed', 'partial', 'failed', 'unsupported'];
const SOURCES: { value: DocumentSource; label: string }[] = [
    { value: 'analyst_upload', label: 'Analyst Upload' },
    { value: 'threat_intelligence', label: 'Threat Intelligence' },
    { value: 'investigation', label: 'Investigation' },
    { value: 'threat_brief', label: 'Threat Brief' },
    { value: 'knowledge_base', label: 'Knowledge Base' },
    { value: 'external_report', label: 'External Report' },
    { value: 'other', label: 'Other' },
];

function formatBytes(bytes: number | null | undefined): string {
    if (bytes == null) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const ExtractionBadge: React.FC<{ status: string }> = ({ status }) => <span className={`di-badge di-badge--${status}`}>{status}</span>;

interface Props {
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    isAdmin?: boolean;
}

// §5/§6/§7 "DOCUMENT UPLOAD" — a plain file input; validation is entirely
// server-side against the real bytes (services/documents/validation.js),
// never trusted from this form.
const UploadPanel: React.FC<{ onUploaded: () => void }> = ({ onUploaded }) => {
    const [source, setSource] = useState<DocumentSource>('analyst_upload');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const onPick = async (file: File | undefined) => {
        if (!file) return;
        setBusy(true); setError(null); setWarning(null);
        try {
            const result = await uploadDocument(file, { source });
            if (result.signatureMismatch && result.mismatchReason) setWarning(result.mismatchReason);
            onUploaded();
        } catch (err: any) {
            setError(err?.message || 'Upload failed');
        } finally {
            setBusy(false);
            if (inputRef.current) inputRef.current.value = '';
        }
    };

    return (
        <div className="di-upload-panel">
            <select value={source} onChange={(e) => setSource(e.target.value as DocumentSource)} aria-label="Document source">
                {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <input ref={inputRef} type="file" accept=".pdf,.docx,.txt,.csv,.json,.html,.htm,.xml" disabled={busy} onChange={(e) => onPick(e.target.files?.[0])} />
            {busy && <span className="di-note">Uploading…</span>}
            {error && <span className="di-error" style={{ padding: 0 }}>{error}</span>}
            {warning && <span className="di-note" style={{ color: 'var(--ui-warning)' }}>{warning}</span>}
        </div>
    );
};

// §34/§35 "EVIDENCE INTEGRATION" / "DOCUMENT AS EVIDENCE" — explicit
// analyst action only; reuses the existing generic Evidence API unchanged.
const EvidenceBlock: React.FC<{ documentId: number; documentLabel: string; sha256: string }> = ({ documentId, documentLabel, sha256 }) => {
    const [items, setItems] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ source: '', description: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getEvidence('document', documentId).then(setItems).finally(() => setLoading(false));
    }, [documentId]);
    useEffect(() => { load(); }, [load]);

    // §35 "DOCUMENT AS EVIDENCE" — the resulting Evidence references
    // Document ID and SHA256 explicitly, never just a bare label.
    const addAsEvidence = async () => {
        if (!form.source.trim()) return;
        setSaving(true);
        try {
            await addEvidence({ entityType: 'document', entityId: documentId, source: form.source.trim(), description: form.description.trim() || `Document ${documentLabel} (SHA256 ${sha256})` });
            setForm({ source: '', description: '' }); setShowAdd(false); load();
        } finally { setSaving(false); }
    };
    const remove = async (id: number) => { await deleteEvidence(id); load(); };

    return (
        <div>
            <button type="button" className="di-btn" style={{ marginBottom: '10px' }} onClick={() => setShowAdd((v) => !v)}>+ Add as Evidence</button>
            {showAdd && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                    <input type="text" placeholder="Source…" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={{ minWidth: '200px' }} />
                    <input type="text" placeholder="Description (optional)…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ minWidth: '220px' }} />
                    <button type="button" className="di-btn di-btn--primary" onClick={addAsEvidence} disabled={saving || !form.source.trim()}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            )}
            {loading ? <div className="di-loading">Loading…</div> : items.length === 0 ? <div className="di-empty">No evidence attached yet.</div> : (
                <ul className="di-list">
                    {items.map((e) => (
                        <li key={e.id} className="di-list-item" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div><strong>{e.source}</strong> {e.confidence && <span className="di-badge">{e.confidence}</span>}</div>
                                {e.description && <div className="di-note">{e.description}</div>}
                                <div className="di-note">{formatDateTime(e.created_at)}{e.username ? ` · ${e.username}` : ''}</div>
                            </div>
                            <button type="button" className="di-btn di-btn--danger" onClick={() => remove(e.id)}>Remove</button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

// §36 "TIMELINE" — reuses the existing generic Timeline unchanged.
const TimelineBlock: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [items, setItems] = useState<{ id: string; type: string; label: string | null; timestamp: string | null }[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        getEntityTimeline('document', documentId, { pageSize: 30 })
            .then((r) => setItems((r.timeline?.items || []) as any))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, [documentId]);
    if (loading) return <div className="di-loading">Loading timeline…</div>;
    if (items.length === 0) return <div className="di-empty">No timeline events recorded yet.</div>;
    return (
        <ul className="di-list">
            {items.map((t: any, i: number) => (
                <li key={t.id || i} className="di-list-item">
                    <strong>{(t.label || t.action || t.type || '').toString().replace(/_/g, ' ')}</strong>
                    {t.summary || t.new_value ? <span className="di-note"> — {t.summary || t.new_value}</span> : null}
                    <div className="di-note">{formatDateTime(t.timestamp || t.created_at)}</div>
                </li>
            ))}
        </ul>
    );
};

// §32/§33 "CASE INTEGRATION" / "INVESTIGATION INTEGRATION" — reuses the
// existing Investigation authorization/linking (addCaseTarget), never a
// second case-linking mechanism.
const CasesBlock: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [cases, setCases] = useState<EntityCaseRef[]>([]);
    const [loading, setLoading] = useState(true);
    const [query, setQuery] = useState('');
    const [candidates, setCandidates] = useState<CaseListItem[]>([]);
    const [linking, setLinking] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getCasesForEntity('document', documentId).then(setCases).catch(() => setCases([])).finally(() => setLoading(false));
    }, [documentId]);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (!query.trim()) { setCandidates([]); return; }
        const t = setTimeout(() => { getCases({ q: query.trim(), pageSize: 8 }).then((r) => setCandidates(r.items)).catch(() => setCandidates([])); }, 300);
        return () => clearTimeout(t);
    }, [query]);

    const link = async (caseId: number) => {
        setLinking(true);
        try { await addCaseTarget(caseId, 'document', String(documentId)); setQuery(''); setCandidates([]); load(); }
        finally { setLinking(false); }
    };

    return (
        <div>
            {loading ? <div className="di-loading">Loading…</div> : cases.length === 0 ? <div className="di-empty">Not linked to any investigation.</div> : (
                <ul className="di-list">
                    {cases.map((c) => (
                        <li key={c.id} className="di-list-item">
                            <span className="di-note" style={{ fontFamily: 'monospace', marginRight: '8px' }}>{c.case_number}</span>
                            {c.title} <span className="di-badge" style={{ marginLeft: '6px', textTransform: 'capitalize' }}>{c.status}</span>
                        </li>
                    ))}
                </ul>
            )}
            <div style={{ marginTop: '10px', position: 'relative' }}>
                <input type="text" placeholder="Link to an investigation…" value={query} onChange={(e) => setQuery(e.target.value)} disabled={linking} style={{ minWidth: '260px' }} />
                {candidates.length > 0 && (
                    <ul className="di-list" style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
                        {candidates.map((c) => (
                            <li key={c.id} className="di-list-item di-row-clickable" style={{ padding: '6px 8px' }} onClick={() => link(c.id)}>{c.case_number} — {c.title}</li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
};

// §60/§62 "CONTENT VIEWER" / "CONTENT SEARCH HIGHLIGHT" — plain text only,
// rendered as text nodes (never dangerouslySetInnerHTML); a "highlight" is
// built by splitting on the search term and wrapping matches in <mark>,
// which React still renders as inert text content, never markup from the
// document itself.
function highlight(text: string, term: string): React.ReactNode {
    if (!term.trim()) return text;
    const idx = text.toLowerCase().indexOf(term.toLowerCase());
    if (idx === -1) return text;
    const parts: React.ReactNode[] = [];
    let cursor = 0;
    let i = idx;
    while (i !== -1) {
        parts.push(text.slice(cursor, i));
        parts.push(<mark key={i}>{text.slice(i, i + term.length)}</mark>);
        cursor = i + term.length;
        i = text.toLowerCase().indexOf(term.toLowerCase(), cursor);
    }
    parts.push(text.slice(cursor));
    return parts;
}

const ContentTab: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [content, setContent] = useState<DocumentContent | null>(null);
    const [pages, setPages] = useState<DocumentPage[]>([]);
    const [activePage, setActivePage] = useState(1);
    const [query, setQuery] = useState('');
    const [searchResult, setSearchResult] = useState<DocumentSearchResult | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        Promise.all([getDocumentContent(documentId), getDocumentPages(documentId)])
            .then(([c, p]) => { setContent(c); setPages(p); })
            .catch(() => { setContent(null); setPages([]); })
            .finally(() => setLoading(false));
    }, [documentId]);

    const runSearch = async () => {
        if (!query.trim()) { setSearchResult(null); return; }
        try { setSearchResult(await apiSearchWithinDocument(documentId, query.trim())); } catch { setSearchResult(null); }
    };

    if (loading) return <div className="di-loading">Loading content…</div>;
    if (!content) return <div className="di-error">Failed to load content.</div>;

    // §15/§16/§17 "TEXT EXTRACTION" / "OCR" / "SCANNED DOCUMENT" — honest
    // states only; never fabricated text.
    if (content.extractionStatus === 'pending' || content.extractionStatus === 'processing') {
        return <div className="di-empty">Extraction {content.extractionStatus}…</div>;
    }
    if (content.extractionStatus === 'failed') {
        return <div className="di-error">Extraction Failed{content.text ? '' : ' — no text is available for this document.'}</div>;
    }
    if (content.extractionStatus === 'unsupported') {
        return <div className="di-empty">Text extraction is not implemented for this document type.</div>;
    }
    if (content.hasTextLayer === false) {
        return (
            <div>
                <div className="di-empty">Text Extraction: No Text Layer</div>
                <div className="di-note" style={{ textAlign: 'center' }}>Suggested: OCR Required — OCR: Not Configured for scanned documents in this phase.</div>
            </div>
        );
    }

    const activePageContent = pages.find((p) => p.pageNumber === activePage);

    return (
        <div>
            {pages.length > 1 && (
                <div className="di-page-nav">
                    <button type="button" className="di-btn" disabled={activePage <= 1} onClick={() => setActivePage((p) => p - 1)}>‹ Prev</button>
                    <span className="di-note">Page {activePage} of {pages.length}</span>
                    <button type="button" className="di-btn" disabled={activePage >= pages.length} onClick={() => setActivePage((p) => p + 1)}>Next ›</button>
                </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                <input type="text" placeholder="Search within document…" value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }} style={{ flex: 1, minWidth: '200px' }} />
                <button type="button" className="di-btn" onClick={runSearch} disabled={!query.trim()}>Search</button>
            </div>
            {searchResult && (
                <div className="di-note" style={{ marginBottom: '8px' }}>
                    {searchResult.totalMatches === 0 ? 'No matches found.' : `${searchResult.totalMatches} match(es) across ${searchResult.pages.length} page(s).`}
                    {searchResult.pages.map((p) => (
                        <div key={p.pageNumber} className="di-row-clickable" style={{ marginTop: '4px' }} onClick={() => setActivePage(p.pageNumber)}>
                            Page {p.pageNumber} ({p.matchCount}): {p.snippets.map((s, i) => <span key={i}>{highlight(s, query)} </span>)}
                        </div>
                    ))}
                </div>
            )}
            <div className="di-content-viewer">{highlight(activePageContent?.content || content.text, query)}</div>
        </div>
    );
};

// DOCUMENT_INTELLIGENCE_PHASE2.md §50/§51 "DOCUMENT INTELLIGENCE VIEW" /
// "EXTRACTION REVIEW" — IOCs / Entities / Relationship Candidates / MISP
// Matches / Evidence Candidates / Review State, each a real, honestly
// labeled candidate — never confirmed intelligence (§2's critical
// principle). [Accept] always calls the existing IOC/Relationship write
// path server-side; nothing here writes IOCs/relationships directly.
const AnalysisTab: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [summary, setSummary] = useState<DocumentAnalysisSummary | null>(null);
    const [iocs, setIocs] = useState<DocumentIocCandidate[]>([]);
    const [entities, setEntities] = useState<DocumentEntityCandidate[]>([]);
    const [relationships, setRelationships] = useState<DocumentRelationshipCandidate[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([getDocumentAnalysis(documentId), getDocumentIocCandidates(documentId), getDocumentEntityCandidates(documentId), getDocumentRelationshipCandidates(documentId)])
            .then(([s, i, e, r]) => { setSummary(s); setIocs(i); setEntities(e); setRelationships(r); })
            .catch((err) => setError(err?.message || 'Failed to load analysis'))
            .finally(() => setLoading(false));
    }, [documentId]);
    useEffect(() => { load(); }, [load]);

    const runAnalyze = async () => { setBusy('analyze'); try { await analyzeDocument(documentId); await new Promise((r) => setTimeout(r, 500)); load(); } finally { setBusy(null); } };

    const withBusy = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key); setError(null);
        try { await fn(); load(); } catch (err: any) { setError(err?.message || 'Action failed'); } finally { setBusy(null); }
    };

    if (loading) return <div className="di-loading">Loading analysis…</div>;
    if (error && !summary) return <div className="di-error">{error}</div>;

    if (!summary || summary.analysisStatus === 'not_analyzed') {
        return (
            <div>
                <div className="di-empty">This document has not been analyzed yet.</div>
                <button type="button" className="di-btn di-btn--primary" onClick={runAnalyze} disabled={busy === 'analyze'}>{busy === 'analyze' ? 'Queuing…' : 'Analyze Document'}</button>
            </div>
        );
    }

    return (
        <div>
            {error && <div className="di-error" style={{ marginBottom: '10px' }}>{error}</div>}
            <div className="di-kv">
                <span className="k">Analysis Status</span><span className="v"><ExtractionBadge status={summary.analysisStatus} /></span>
                <span className="k">IOC Candidates</span><span className="v">{summary.iocCandidates.total} ({summary.iocCandidates.accepted} accepted, {summary.iocCandidates.rejected} rejected)</span>
                <span className="k">Entity Candidates</span><span className="v">{summary.entityCandidates.total} ({summary.entityCandidates.accepted} accepted, {summary.entityCandidates.rejected} rejected)</span>
                <span className="k">Relationship Candidates</span><span className="v">{summary.relationshipCandidates.total} ({summary.relationshipCandidates.accepted} accepted, {summary.relationshipCandidates.rejected} rejected)</span>
                <span className="k">Evidence Created</span><span className="v">{summary.evidenceCreated}</span>
            </div>
            <button type="button" className="di-btn" onClick={runAnalyze} disabled={busy === 'analyze'} style={{ marginBottom: '14px' }}>{busy === 'analyze' ? 'Queuing…' : 'Reprocess Document'}</button>

            {/* §6-§18 IOC CANDIDATES */}
            <div className="di-subtitle">IOC Candidates ({iocs.length})</div>
            {iocs.length === 0 ? <div className="di-empty">No IOCs extracted.</div> : (
                <ul className="di-list">
                    {iocs.map((c) => (
                        <li key={c.id} className="di-list-item">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className="di-badge">{c.type}</span>
                                <strong>{c.value}</strong>
                                <span className="di-badge" style={{ textTransform: 'none' }}>{c.status}</span>
                                {c.misp?.matched && <span className="di-badge" style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--ui-danger)' }}>MISP Match — Correlated Intelligence</span>}
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.reviewState}</span>
                            </div>
                            <div className="di-note">Page {c.pageNumber ?? '—'} · {c.occurrenceCount} occurrence(s) · {c.snippet}</div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {c.reviewState === 'unreviewed' && (
                                    <>
                                        <button type="button" className="di-btn di-btn--primary" disabled={!!busy} onClick={() => withBusy(`ioc-accept-${c.id}`, () => acceptIocCandidate(documentId, c.id))}>Accept IOC</button>
                                        <button type="button" className="di-btn di-btn--danger" disabled={!!busy} onClick={() => withBusy(`ioc-reject-${c.id}`, () => rejectIocCandidate(documentId, c.id))}>Reject</button>
                                    </>
                                )}
                                {c.reviewState === 'accepted' && !c.createdEvidenceId && (
                                    <button type="button" className="di-btn" disabled={!!busy} onClick={() => withBusy(`ioc-ev-${c.id}`, () => createEvidenceFromCandidate(documentId, 'ioc', c.id))}>Create Evidence</button>
                                )}
                                {c.createdEvidenceId && <span className="di-note">Evidence created (EV-{c.createdEvidenceId})</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* §19-§28 ENTITY CANDIDATES */}
            <div className="di-subtitle">Entity Candidates ({entities.length})</div>
            {entities.length === 0 ? <div className="di-empty">No entities extracted.</div> : (
                <ul className="di-list">
                    {entities.map((c) => (
                        <li key={c.id} className="di-list-item">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <span className="di-badge">{c.entityType.replace(/_/g, ' ')}</span>
                                <strong>{c.candidateText}</strong>
                                {c.matchedEntityLabel && <span className="di-note">→ {c.matchedEntityLabel}</span>}
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.matchConfidence}</span>
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.reviewState}</span>
                            </div>
                            <div className="di-note">Page {c.pageNumber ?? '—'} · {c.occurrenceCount} occurrence(s) · {c.snippet}</div>
                            {c.matchConfidence === 'ambiguous' && c.matches.length > 1 && (
                                <div style={{ marginTop: '4px' }}>
                                    <div className="di-note">Ambiguous — select the correct match:</div>
                                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                        {c.matches.map((m) => (
                                            <button key={`${m.entityType}:${m.entityId}`} type="button" className="di-btn" disabled={!!busy}
                                                onClick={() => withBusy(`ent-accept-${c.id}`, () => acceptEntityCandidate(documentId, c.id, m.entityId))}>
                                                {m.label}{m.viaAlias ? ' (alias)' : ''}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {c.reviewState === 'unreviewed' && c.matchConfidence !== 'ambiguous' && (
                                    <>
                                        <button type="button" className="di-btn di-btn--primary" disabled={!!busy} onClick={() => withBusy(`ent-accept-${c.id}`, () => acceptEntityCandidate(documentId, c.id, c.matchedEntityId || undefined))}>Accept</button>
                                        <button type="button" className="di-btn di-btn--danger" disabled={!!busy} onClick={() => withBusy(`ent-reject-${c.id}`, () => rejectEntityCandidate(documentId, c.id))}>Reject</button>
                                    </>
                                )}
                                {c.reviewState === 'accepted' && !c.createdEvidenceId && (
                                    <button type="button" className="di-btn" disabled={!!busy} onClick={() => withBusy(`ent-ev-${c.id}`, () => createEvidenceFromCandidate(documentId, 'entity', c.id))}>Create Evidence</button>
                                )}
                                {c.createdEvidenceId && <span className="di-note">Evidence created (EV-{c.createdEvidenceId})</span>}
                            </div>
                        </li>
                    ))}
                </ul>
            )}

            {/* §29-§32 RELATIONSHIP CANDIDATES */}
            <div className="di-subtitle">Relationship Candidates ({relationships.length})</div>
            {relationships.length === 0 ? <div className="di-empty">No relationship candidates found.</div> : (
                <ul className="di-list">
                    {relationships.map((c) => (
                        <li key={c.id} className="di-list-item">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <strong>{c.source.text}</strong> <span className="di-note">— {c.relationshipType} →</span> <strong>{c.target.text}</strong>
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.confidence} confidence</span>
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.reviewState}</span>
                            </div>
                            <div className="di-note">Page {c.pageNumber ?? '—'} · {c.snippet}</div>
                            {!c.source.entityId || !c.target.entityId ? (
                                <div className="di-note" style={{ color: 'var(--ui-warning)' }}>Both ends must resolve to a known entity before this can be accepted.</div>
                            ) : c.reviewState === 'unreviewed' && (
                                <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                    <button type="button" className="di-btn di-btn--primary" disabled={!!busy} onClick={() => withBusy(`rel-accept-${c.id}`, () => acceptRelationshipCandidate(documentId, c.id))}>Accept</button>
                                    <button type="button" className="di-btn di-btn--danger" disabled={!!busy} onClick={() => withBusy(`rel-reject-${c.id}`, () => rejectRelationshipCandidate(documentId, c.id))}>Reject</button>
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}
            <div className="di-note" style={{ marginTop: '10px', fontStyle: 'italic' }}>
                "Observed in Document" is not confirmed intelligence. Accepting an IOC or Relationship candidate uses the existing IOC repository / relationship graph — it never bypasses analyst review.
            </div>
        </div>
    );
};

// DOCUMENT_INTELLIGENCE_PHASE3.md §5-§8/§30/§52/§53 "DOCUMENT CLAIMS" /
// "RELATIONSHIP REVIEW" / KNOWLEDGE & THREAT BRIEF DRAFTS — same
// withBusy/candidate-list shape AnalysisTab above already established.
const ClaimsTab: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [claims, setClaims] = useState<DocumentClaim[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [draftBusy, setDraftBusy] = useState<string | null>(null);
    const [draftResult, setDraftResult] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getDocumentClaims(documentId).then(setClaims).catch((err) => setError(err?.message || 'Failed to load claims')).finally(() => setLoading(false));
    }, [documentId]);
    useEffect(() => { load(); }, [load]);

    const withBusy = async (key: string, fn: () => Promise<unknown>) => {
        setBusy(key); setError(null);
        try { await fn(); load(); } catch (err: any) { setError(err?.message || 'Action failed'); } finally { setBusy(null); }
    };

    const acceptedClaims = claims.filter((c) => c.reviewState === 'accepted');
    const createDraft = async (kind: 'knowledge' | 'brief') => {
        const title = window.prompt(`Title for the ${kind === 'knowledge' ? 'Knowledge Draft' : 'Threat Brief Draft'}:`);
        if (!title) return;
        setDraftBusy(kind); setDraftResult(null);
        try {
            const entityRefs = acceptedClaims.filter((c) => c.subject.matchedId).map((c) => ({ entityType: c.subject.type, entityId: c.subject.matchedId! }));
            if (kind === 'knowledge') { const r = await createKnowledgeDraftFromDocument(documentId, { title, summary: `Derived from ${acceptedClaims.length} analyst-accepted claim(s) in this document.`, entityRefs }); setDraftResult(`Knowledge Draft created (#${r.data.id}) — still a draft, not published.`); }
            else { const r = await createThreatBriefDraftFromDocument(documentId, { title, executiveSummary: `Derived from ${acceptedClaims.length} analyst-accepted claim(s) in this document.`, entityRefs }); setDraftResult(`Threat Brief Draft created (#${r.data.id}) — still a draft, not published.`); }
        } catch (err: any) { setError(err?.message || 'Draft creation failed'); } finally { setDraftBusy(null); }
    };

    if (loading) return <div className="di-loading">Loading claims…</div>;
    return (
        <div>
            {error && <div className="di-error" style={{ marginBottom: '10px' }}>{error}</div>}
            {draftResult && <div className="di-note" style={{ marginBottom: '10px' }}>{draftResult}</div>}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                <button type="button" className="di-btn" disabled={!!draftBusy || acceptedClaims.length === 0} onClick={() => createDraft('knowledge')}>{draftBusy === 'knowledge' ? 'Creating…' : 'Create Knowledge Draft'}</button>
                <button type="button" className="di-btn" disabled={!!draftBusy || acceptedClaims.length === 0} onClick={() => createDraft('brief')}>{draftBusy === 'brief' ? 'Creating…' : 'Create Threat Brief Draft'}</button>
            </div>
            {acceptedClaims.length === 0 && <div className="di-note" style={{ marginBottom: '10px' }}>Drafts require at least one analyst-accepted claim.</div>}
            {claims.length === 0 ? <div className="di-empty">No claims extracted from this document.</div> : (
                <ul className="di-list">
                    {claims.map((c) => (
                        <li key={c.id} className="di-list-item">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <strong>{c.subject.label ?? c.subject.text}</strong>
                                <span className="di-note">— {c.claimType.replace(/_/g, ' ')} →</span>
                                <strong>{c.object.label ?? c.object.text}</strong>
                                {c.context && <span className="di-note">(context: {c.context.label ?? c.context.text})</span>}
                                <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.reviewState}</span>
                            </div>
                            <div className="di-note">Page {c.pageNumber ?? '—'} · Extraction: {c.extractionConfidence} · Relationship: {c.relationshipConfidence} · {c.snippet}</div>
                            <div className="di-note" style={{ fontStyle: 'italic' }}>{c.status}</div>
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                                {c.reviewState === 'unreviewed' && (!c.subject.matchedId || !c.object.matchedId) && (
                                    <span className="di-note" style={{ color: 'var(--ui-warning)' }}>Both Subject and Object must resolve to a known entity before this can be accepted.</span>
                                )}
                                {c.reviewState === 'unreviewed' && c.subject.matchedId && c.object.matchedId && (
                                    <>
                                        <button type="button" className="di-btn di-btn--primary" disabled={!!busy} onClick={() => withBusy(`claim-accept-${c.id}`, () => acceptClaim(documentId, c.id))}>Accept</button>
                                        <button type="button" className="di-btn di-btn--danger" disabled={!!busy} onClick={() => withBusy(`claim-reject-${c.id}`, () => rejectClaim(documentId, c.id))}>Reject</button>
                                        <button type="button" className="di-btn" disabled={!!busy} onClick={() => withBusy(`claim-dismiss-${c.id}`, () => dismissClaim(documentId, c.id))}>Dismiss</button>
                                    </>
                                )}
                                {c.reviewState === 'accepted' && !c.createdEvidenceId && (
                                    <button type="button" className="di-btn" disabled={!!busy} onClick={() => withBusy(`claim-ev-${c.id}`, () => createEvidenceFromClaim(documentId, c.id))}>Create Evidence</button>
                                )}
                                {c.createdEvidenceId && <span className="di-note">Evidence created (EV-{c.createdEvidenceId})</span>}
                                {c.subject.matchedId && c.object.matchedId && (
                                    <button type="button" className="di-btn" disabled={!!busy}
                                        onClick={() => withBusy(`corrob-${c.id}`, async () => { const cor = await getClaimCorroboration(documentId, c.id); window.alert(`Sources: ${cor.sourceCount}\nIndependent sources: ${cor.independentSourceCount}${cor.sourceIndependenceNote ? `\n${cor.sourceIndependenceNote}` : ''}`); })}>
                                        Check Corroboration
                                    </button>
                                )}
                            </div>
                        </li>
                    ))}
                </ul>
            )}
            <div className="di-note" style={{ marginTop: '10px', fontStyle: 'italic' }}>
                A Claim is a statement THIS document makes — never automatically a confirmed relationship or attribution.
            </div>
        </div>
    );
};

// §22-§25 "SOURCE INDEPENDENCE" / "CORROBORATION" / "CONFLICT DETECTION" / "CLAIM CONFLICT UI"
const ConflictsTab: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [conflicts, setConflicts] = useState<DocumentConflict[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getDocumentConflicts(documentId).then(setConflicts).catch((err) => setError(err?.message || 'Failed to load conflicts')).finally(() => setLoading(false));
    }, [documentId]);
    useEffect(() => { load(); }, [load]);

    const act = async (conflictId: number, dismiss: boolean) => {
        setBusy(String(conflictId)); setError(null);
        try { await reviewConflict(conflictId, dismiss, dismiss ? (window.prompt('Optional note:') || undefined) : undefined); load(); }
        catch (err: any) { setError(err?.message || 'Action failed'); } finally { setBusy(null); }
    };

    if (loading) return <div className="di-loading">Loading conflicts…</div>;
    if (conflicts.length === 0) return <div className="di-empty">No conflicting claims detected involving this document.</div>;
    return (
        <div>
            {error && <div className="di-error" style={{ marginBottom: '10px' }}>{error}</div>}
            <ul className="di-list">
                {conflicts.map((c) => (
                    <li key={c.id} className="di-list-item">
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <span className="di-badge" style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--ui-danger)' }}>Attribution Conflict</span>
                            <span className="di-badge" style={{ textTransform: 'capitalize' }}>{c.reviewState}</span>
                        </div>
                        <div style={{ marginTop: '6px' }}>
                            <div><strong>Claim A</strong> ({c.claimA.filename}, page {c.claimA.pageNumber ?? '—'}): {c.claimA.subject.label ?? c.claimA.subject.text} → {c.claimA.object.label ?? c.claimA.object.text}</div>
                            <div><strong>Claim B</strong> ({c.claimB.filename}, page {c.claimB.pageNumber ?? '—'}): {c.claimB.subject.label ?? c.claimB.subject.text} → {c.claimB.object.label ?? c.claimB.object.text}</div>
                        </div>
                        <div className="di-note" style={{ fontStyle: 'italic' }}>Status: {c.status} — not resolved automatically.</div>
                        {c.resolutionNote && <div className="di-note">Note: {c.resolutionNote}</div>}
                        {c.reviewState === 'unreviewed' && (
                            <div style={{ display: 'flex', gap: '6px', marginTop: '4px' }}>
                                <button type="button" className="di-btn" disabled={busy === String(c.id)} onClick={() => act(c.id, false)}>Mark Reviewed</button>
                                <button type="button" className="di-btn di-btn--danger" disabled={busy === String(c.id)} onClick={() => act(c.id, true)}>Dismiss</button>
                            </div>
                        )}
                    </li>
                ))}
            </ul>
        </div>
    );
};

// §11-§14/§19-§21 "DOCUMENT SIMILARITY" / "DUPLICATE DETECTION" / "VERSION
// DETECTION" / "CROSS DOCUMENT CORRELATION" / §15-§18 "COMPARISON" / §27
// "INTELLIGENCE GAPS" — grouped into one Correlations tab (§45 allows
// "tabs / expandable sections"; a section per concern keeps this one tab legible).
const CorrelationsTab: React.FC<{ documentId: number }> = ({ documentId }) => {
    const [related, setRelated] = useState<RelatedDocument[]>([]);
    const [duplicates, setDuplicates] = useState<DocumentDuplicatesResult | null>(null);
    const [gaps, setGaps] = useState<{ type: string; description: string }[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [compareId, setCompareId] = useState('');
    const [comparison, setComparison] = useState<DocumentComparisonResult | null>(null);
    const [comparing, setComparing] = useState(false);

    useEffect(() => {
        setLoading(true); setError(null);
        Promise.all([getRelatedDocuments(documentId), getDocumentDuplicates(documentId), getIntelligenceGaps(documentId)])
            .then(([r, d, g]) => { setRelated(r); setDuplicates(d); setGaps(g); })
            .catch((err) => setError(err?.message || 'Failed to load correlations'))
            .finally(() => setLoading(false));
    }, [documentId]);

    const runCompare = async () => {
        const otherId = Number(compareId);
        if (!otherId) return;
        setComparing(true); setError(null); setComparison(null);
        try { setComparison(await compareDocumentsApi(documentId, otherId)); }
        catch (err: any) { setError(err?.message || 'Comparison failed'); } finally { setComparing(false); }
    };

    if (loading) return <div className="di-loading">Loading correlations…</div>;
    return (
        <div>
            {error && <div className="di-error" style={{ marginBottom: '10px' }}>{error}</div>}

            <div className="di-subtitle">Related Documents ({related.length})</div>
            {related.length === 0 ? <div className="di-empty">No related documents found (shared IOC/Entity/Campaign/ATT&CK).</div> : (
                <ul className="di-list">
                    {related.map((r) => (
                        <li key={r.documentId} className="di-list-item">
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}><strong>{r.filename}</strong><span className="di-badge">{r.similarityScore}% similar</span></div>
                            <div className="di-note">Because: {r.basis.join(', ')}</div>
                        </li>
                    ))}
                </ul>
            )}

            <div className="di-subtitle">Potential Duplicates &amp; Versions</div>
            {duplicates && (duplicates.exactDuplicates.length + duplicates.nearDuplicates.length + duplicates.potentialVersions.length === 0) ? (
                <div className="di-empty">No duplicate or version candidates found.</div>
            ) : (
                <ul className="di-list">
                    {duplicates?.exactDuplicates.map((d) => (<li key={`exact-${d.documentId}`} className="di-list-item"><span className="di-badge" style={{ background: 'rgba(239,68,68,0.14)', color: 'var(--ui-danger)' }}>Exact Duplicate</span> {d.filename}</li>))}
                    {duplicates?.nearDuplicates.map((d) => (<li key={`near-${d.documentId}`} className="di-list-item"><span className="di-badge">Near Duplicate</span> {d.filename} — {d.textSimilarityPercent}% text similarity</li>))}
                    {duplicates?.potentialVersions.map((d) => (<li key={`ver-${d.documentId}`} className="di-list-item"><span className="di-badge">{d.relation}</span> {d.filename} — {d.textSimilarityPercent}% text similarity</li>))}
                </ul>
            )}
            <div className="di-note" style={{ marginBottom: '14px' }}>Never automatically deleted or merged — an analyst decision.</div>

            <div className="di-subtitle">Compare Documents</div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                <input type="text" placeholder="Other document ID…" value={compareId} onChange={(e) => setCompareId(e.target.value)} style={{ maxWidth: '160px' }} />
                <button type="button" className="di-btn" disabled={comparing || !compareId} onClick={runCompare}>{comparing ? 'Comparing…' : 'Compare'}</button>
            </div>
            {comparison && (comparison.restricted ? <div className="di-empty">One or both documents are not accessible.</div> : (
                <div className="di-kv">
                    <span className="k">Text Changed</span><span className="v">{comparison.textChanged ? 'Yes' : 'No'}</span>
                    <span className="k">Intelligence Changed</span><span className="v">{comparison.intelligenceChanged ? `Yes (${comparison.totalIntelligenceChanges})` : 'No'}</span>
                    <span className="k">IOCs</span><span className="v">+{comparison.iocs?.added.length ?? 0} / −{comparison.iocs?.removed.length ?? 0}</span>
                    <span className="k">Threat Actors</span><span className="v">+{comparison.threatActors?.added.length ?? 0} / −{comparison.threatActors?.removed.length ?? 0}</span>
                    <span className="k">Malware</span><span className="v">+{comparison.malware?.added.length ?? 0} / −{comparison.malware?.removed.length ?? 0}</span>
                    <span className="k">Campaigns</span><span className="v">+{comparison.campaigns?.added.length ?? 0} / −{comparison.campaigns?.removed.length ?? 0}</span>
                    <span className="k">ATT&amp;CK</span><span className="v">+{comparison.attack?.added.length ?? 0} / −{comparison.attack?.removed.length ?? 0}</span>
                    <span className="k">Claims</span><span className="v">+{comparison.claims?.added.length ?? 0} / −{comparison.claims?.removed.length ?? 0}</span>
                </div>
            ))}

            <div className="di-subtitle">Intelligence Gaps</div>
            {gaps.length === 0 ? <div className="di-empty">No intelligence gaps detected.</div> : (
                <ul className="di-list">{gaps.map((g, i) => (<li key={i} className="di-list-item">{g.description}</li>))}</ul>
            )}
        </div>
    );
};

const DocumentDetailModal: React.FC<{
    id: number; onClose: () => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
}> = ({ id, onClose, onOpenKnowledgeEntry, onCreateKnowledgeEntry, onViewNotes }) => {
    const [doc, setDoc] = useState<DocumentRecord | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<'overview' | 'content' | 'analysis' | 'claims' | 'conflicts' | 'correlations' | 'related' | 'evidence' | 'timeline' | 'knowledge'>('overview');

    useEffect(() => {
        setLoading(true); setError(null);
        getDocument(id).then(setDoc).catch((err) => setError(err?.message || 'Failed to load document')).finally(() => setLoading(false));
    }, [id]);

    const download = () => { if (doc) downloadDocument(doc.id, doc.filename).catch((err) => setError(err?.message || 'Download failed')); };

    return (
        <div className="di-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="di-modal">
                <div className="di-modal-header">
                    <div>
                        <h2>{doc?.filename ?? 'Document'}</h2>
                        {doc && <div className="di-note">{doc.documentId}</div>}
                    </div>
                    <button type="button" className="di-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="di-modal-body">
                    {error ? <div className="di-error">{error}</div> : loading || !doc ? <div className="di-loading">Loading…</div> : (
                        <>
                            {doc.signatureMismatch && doc.mismatchReason && <div className="di-mismatch-warning">⚠ {doc.mismatchReason}</div>}
                            <div className="di-kv">
                                <span className="k">Type</span><span className="v">{doc.detectedType}</span>
                                <span className="k">SHA256</span><span className="v">{doc.sha256}</span>
                                <span className="k">Size</span><span className="v">{formatBytes(doc.fileSize)}</span>
                                <span className="k">Uploader</span><span className="v">{doc.uploadedByUsername ?? '—'}</span>
                                <span className="k">Created</span><span className="v">{formatDateTime(doc.createdAt)}</span>
                                <span className="k">Extraction</span><span className="v"><ExtractionBadge status={doc.extractionStatus} /> {doc.pageCount != null && `${doc.pagesExtracted ?? 0}/${doc.pageCount} page(s)`}</span>
                                <span className="k">Source</span><span className="v">{doc.source.replace(/_/g, ' ')}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                                <button type="button" className="di-btn di-btn--primary" onClick={download}>Download</button>
                                {onViewNotes && <button type="button" className="di-btn" onClick={() => onViewNotes('document', String(doc.id), doc.filename)}>View Notes</button>}
                                {/* DOCUMENT_INTELLIGENCE_PHASE3.md §28/§29 — a document-level "I have reviewed this" marker, distinct from any single candidate's review state. */}
                                <button type="button" className="di-btn" disabled={!!doc.reviewedAt}
                                    onClick={() => markDocumentReviewed(doc.id).then(() => getDocument(id).then(setDoc)).catch((err) => setError(err?.message || 'Failed to mark reviewed'))}>
                                    {doc.reviewedAt ? `Reviewed ${formatDateTime(doc.reviewedAt)}` : 'Mark Reviewed'}
                                </button>
                                <button type="button" className="di-btn" onClick={() => exportDocumentAnalysis(doc.id, 'analysis', doc.documentId).catch((err) => setError(err?.message || 'Export failed'))}>Export Analysis JSON</button>
                            </div>
                            {(doc.suggestedType || (doc.topics && doc.topics.length > 0)) && (
                                <div className="di-note" style={{ marginBottom: '10px' }}>
                                    {doc.suggestedType && <span>Suggested Type: <strong>{doc.suggestedType}</strong> (organizational suggestion, not authoritative) </span>}
                                    {doc.topics && doc.topics.length > 0 && <span>· Topics: {doc.topics.join(', ')}</span>}
                                </div>
                            )}
                            <div className="di-tabs">
                                {(['overview', 'content', 'analysis', 'claims', 'conflicts', 'correlations', 'related', 'evidence', 'timeline', 'knowledge'] as const).map((t) => (
                                    <button key={t} type="button" className={`di-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>
                                ))}
                            </div>
                            {tab === 'overview' && (
                                <div>
                                    <div className="di-subtitle">Metadata</div>
                                    <div className="di-kv">
                                        <span className="k">Claimed Extension</span><span className="v">{doc.claimedExtension ?? '—'}</span>
                                        <span className="k">MIME</span><span className="v">{doc.detectedMimeType ?? '—'}</span>
                                        <span className="k">SHA1</span><span className="v">{doc.sha1 ?? '—'}</span>
                                        <span className="k">MD5</span><span className="v">{doc.md5 ?? '—'}</span>
                                        <span className="k">Character Count</span><span className="v">{doc.charCount ?? '—'}</span>
                                        <span className="k">Has Text Layer</span><span className="v">{doc.hasTextLayer == null ? 'Unknown' : doc.hasTextLayer ? 'Yes' : 'No'}</span>
                                        {doc.extractionError && (<><span className="k">Extraction Error</span><span className="v" style={{ color: 'var(--ui-danger)' }}>{doc.extractionError}</span></>)}
                                    </div>
                                    <div className="di-note">SHA256 identifies this file; it does not vouch for the trustworthiness of its contents.</div>
                                </div>
                            )}
                            {tab === 'content' && <ContentTab documentId={doc.id} />}
                            {tab === 'analysis' && <AnalysisTab documentId={doc.id} />}
                            {tab === 'claims' && <ClaimsTab documentId={doc.id} />}
                            {tab === 'conflicts' && <ConflictsTab documentId={doc.id} />}
                            {tab === 'correlations' && <CorrelationsTab documentId={doc.id} />}
                            {tab === 'related' && <CasesBlock documentId={doc.id} />}
                            {tab === 'evidence' && <EvidenceBlock documentId={doc.id} documentLabel={doc.filename} sha256={doc.sha256} />}
                            {tab === 'timeline' && <TimelineBlock documentId={doc.id} />}
                            {tab === 'knowledge' && (
                                <KnowledgeContextPanel entityType="document" entityId={doc.id} entityLabel={doc.filename} defaultCategory="Document"
                                    onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const DocumentIntelligenceHome: React.FC<Props> = ({ onOpenKnowledgeEntry, onCreateKnowledgeEntry, onViewNotes }) => {
    const [filters, setFilters] = useState({
        q: '', type: 'all', extractionStatus: 'all', source: 'all', sort: 'newest',
        // DOCUMENT_INTELLIGENCE_PHASE2.md §59 "FILTERS".
        analysisStatus: 'all', hasIocs: false, hasEntities: false, hasMispMatches: false, hasEvidence: false, reviewStatus: 'all',
    });
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<DocumentRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [stats, setStats] = useState<DocumentStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([
            getDocuments({
                q: filters.q || undefined, type: filters.type !== 'all' ? filters.type : undefined,
                extractionStatus: filters.extractionStatus !== 'all' ? filters.extractionStatus : undefined,
                source: filters.source !== 'all' ? filters.source : undefined,
                sort: filters.sort, page, pageSize,
                analysisStatus: filters.analysisStatus !== 'all' ? filters.analysisStatus : undefined,
                hasIocs: filters.hasIocs ? 'true' : undefined, hasEntities: filters.hasEntities ? 'true' : undefined,
                hasMispMatches: filters.hasMispMatches ? 'true' : undefined, hasEvidence: filters.hasEvidence ? 'true' : undefined,
                reviewStatus: filters.reviewStatus !== 'all' ? filters.reviewStatus : undefined,
            } as any),
            getDocumentStats(),
        ])
            .then(([docs, s]) => { setItems(docs.items); setTotal(docs.total); setStats(s); })
            .catch((err) => setError(err?.message || 'Failed to load documents'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.type === 'all' && filters.extractionStatus === 'all' && filters.source === 'all'
        && filters.analysisStatus === 'all' && !filters.hasIocs && !filters.hasEntities && !filters.hasMispMatches && !filters.hasEvidence && filters.reviewStatus === 'all';

    return (
        <div className="di-card">
            <div className="di-header">
                <span className="di-title">Document Intelligence</span>
                <button type="button" className="di-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
            </div>

            {/* §28/§29/§63 "DOCUMENT STATISTICS" / "EXTRACTION STATISTICS" — real values only. */}
            {stats && (
                <div className="di-stats-row">
                    <div className="di-stat"><div className="di-stat-label">Documents</div><div className="di-stat-value">{stats.total}</div></div>
                    <div className="di-stat"><div className="di-stat-label">Completed</div><div className="di-stat-value">{stats.completed}</div></div>
                    <div className="di-stat"><div className="di-stat-label">Pending</div><div className="di-stat-value">{stats.pending + stats.processing}</div></div>
                    <div className="di-stat"><div className="di-stat-label">Partial</div><div className="di-stat-value">{stats.partial}</div></div>
                    <div className="di-stat"><div className="di-stat-label">Failed</div><div className="di-stat-value">{stats.failed}</div></div>
                    <div className="di-stat"><div className="di-stat-label">No Text</div><div className="di-stat-value">{stats.documentsWithoutText}</div></div>
                    <div className="di-stat"><div className="di-stat-label">Storage</div><div className="di-stat-value">{formatBytes(stats.totalStorageBytes)}</div></div>
                </div>
            )}

            <UploadPanel onUploaded={load} />

            <div className="di-filters">
                <input type="text" placeholder="Search filename, source, or content…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}>
                    <option value="all">All Types</option>
                    {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <select value={filters.extractionStatus} onChange={(e) => { setFilters((f) => ({ ...f, extractionStatus: e.target.value })); setPage(1); }}>
                    <option value="all">All Extraction Status</option>
                    {EXTRACTION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select value={filters.source} onChange={(e) => { setFilters((f) => ({ ...f, source: e.target.value })); setPage(1); }}>
                    <option value="all">All Sources</option>
                    {SOURCES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select value={filters.sort} onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value }))}>
                    <option value="newest">Newest</option>
                    <option value="oldest">Oldest</option>
                    <option value="largest">Largest</option>
                    <option value="smallest">Smallest</option>
                    <option value="filename">Filename</option>
                </select>
                {/* DOCUMENT_INTELLIGENCE_PHASE2.md §59 "FILTERS" — analysis/review status and has-* candidate filters. */}
                <select value={filters.analysisStatus} onChange={(e) => { setFilters((f) => ({ ...f, analysisStatus: e.target.value })); setPage(1); }}>
                    <option value="all">All Analysis Status</option>
                    <option value="not_analyzed">Not Analyzed</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="completed">Completed</option>
                    <option value="partial">Partial</option>
                    <option value="failed">Failed</option>
                </select>
                <select value={filters.reviewStatus} onChange={(e) => { setFilters((f) => ({ ...f, reviewStatus: e.target.value })); setPage(1); }}>
                    <option value="all">All Review Status</option>
                    <option value="unreviewed">Has Unreviewed Candidates</option>
                    <option value="accepted">Has Accepted Candidates</option>
                    <option value="rejected">Has Rejected Candidates</option>
                </select>
                <label className="di-checkbox-filter">
                    <input type="checkbox" checked={filters.hasIocs} onChange={(e) => { setFilters((f) => ({ ...f, hasIocs: e.target.checked })); setPage(1); }} /> Has IOCs
                </label>
                <label className="di-checkbox-filter">
                    <input type="checkbox" checked={filters.hasEntities} onChange={(e) => { setFilters((f) => ({ ...f, hasEntities: e.target.checked })); setPage(1); }} /> Has Entities
                </label>
                <label className="di-checkbox-filter">
                    <input type="checkbox" checked={filters.hasMispMatches} onChange={(e) => { setFilters((f) => ({ ...f, hasMispMatches: e.target.checked })); setPage(1); }} /> Has MISP Matches
                </label>
                <label className="di-checkbox-filter">
                    <input type="checkbox" checked={filters.hasEvidence} onChange={(e) => { setFilters((f) => ({ ...f, hasEvidence: e.target.checked })); setPage(1); }} /> Has Evidence
                </label>
                {!filtersAreDefault && (
                    <button type="button" className="di-btn" onClick={() => { setFilters({ q: '', type: 'all', extractionStatus: 'all', source: 'all', sort: 'newest', analysisStatus: 'all', hasIocs: false, hasEntities: false, hasMispMatches: false, hasEvidence: false, reviewStatus: 'all' }); setPage(1); }}>Clear Filters</button>
                )}
            </div>

            {error ? (
                <div className="di-error">{error}</div>
            ) : loading ? (
                <div className="di-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="di-empty">{filtersAreDefault ? 'No documents uploaded yet.' : 'No documents match these filters.'}</div>
            ) : (
                <>
                    <div className="di-table-wrap">
                        <table className="di-table">
                            <thead><tr><th>Document</th><th>Type</th><th>Size</th><th>Pages</th><th>Extraction</th><th>Source</th><th>Uploaded By</th><th>Created</th></tr></thead>
                            <tbody>
                                {items.map((d) => (
                                    <tr key={d.id} className="di-row-clickable" onClick={() => setSelectedId(d.id)}>
                                        <td><div>{d.filename}</div><div className="di-note">{d.documentId}</div></td>
                                        <td>{d.detectedType}</td>
                                        <td>{formatBytes(d.fileSize)}</td>
                                        <td>{d.pageCount ?? '—'}</td>
                                        <td><ExtractionBadge status={d.extractionStatus} /></td>
                                        <td>{d.source.replace(/_/g, ' ')}</td>
                                        <td>{d.uploadedByUsername ?? '—'}</td>
                                        <td>{formatDate(d.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="di-pagination">
                        <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>‹ Prev</button>
                        <span className="di-note">Page {page} of {totalPages} · {total.toLocaleString()} total</span>
                        <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next ›</button>
                    </div>
                </>
            )}

            {selectedId != null && (
                <DocumentDetailModal id={selectedId} onClose={() => setSelectedId(null)}
                    onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} onViewNotes={onViewNotes} />
            )}
        </div>
    );
};

export default DocumentIntelligenceHome;
