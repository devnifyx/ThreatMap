// KNOWLEDGE_BASE_PHASE2.md §26 "KNOWLEDGE CONTEXT PANEL" — ONE reusable
// component mounted on relevant intelligence pages (§20 "avoid creating
// separate code for every entity type"). Self-contained: given just
// entityType+entityId it fetches everything from the single bundled
// /api/knowledge/context/:entityType/:entityId endpoint.
import React, { useCallback, useEffect, useState } from 'react';
import './KnowledgeBasePage.css';
import {
    getKnowledgeContext, askKnowledgeAi, submitKnowledgeFeedback, generateKnowledgeDraft,
    type KnowledgeContext, type KnowledgeQueryResult
} from '../../services/api';
import { ConfidenceBadge } from '../ThreatIntelligence/ThreatIntelligenceShared';

const REASON_LABELS: Record<string, (detail: string) => string> = {
    entity: (d) => `Direct: ${d}`,
    explicit: (d) => `Explicit: ${d}`,
    tag: (d) => `Tag: ${d}`,
    category: (d) => `Category: ${d}`
};

const COVERAGE_LABELS: Record<string, string> = {
    profile: 'Profile', techniques: 'Techniques', campaigns: 'Campaigns',
    malware: 'Malware', detection: 'Detection', mitigation: 'Mitigation'
};

export interface KnowledgeContextPanelProps {
    entityType: string;
    entityId: string | number;
    entityLabel: string;
    /** Opens a Knowledge Entry in the Knowledge Base page (App-level navigation). */
    onOpenEntry?: (id: number) => void;
    /** §10 "KNOWLEDGE TO THREAT BRIEF" — [Add to Brief Context], only passed by ThreatBriefsPage. */
    onAddToBriefContext?: (knowledgeEntryId: number) => void;
    /** §24 "KNOWLEDGE GAP DETECTION" — [Create Knowledge Entry], prefilled from the current entity. */
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    defaultCategory?: string;
}

const KnowledgeContextPanel: React.FC<KnowledgeContextPanelProps> = ({ entityType, entityId, entityLabel, onOpenEntry, onAddToBriefContext, onCreateKnowledgeEntry, defaultCategory }) => {
    const [context, setContext] = useState<KnowledgeContext | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [aiResult, setAiResult] = useState<KnowledgeQueryResult | null>(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [feedbackBusy, setFeedbackBusy] = useState<number | null>(null);
    const [feedbackGiven, setFeedbackGiven] = useState<Record<number, 'useful' | 'not_relevant'>>({});
    // KNOWLEDGE_BASE_PHASE3.md §13/§14 "KNOWLEDGE CREATION ASSISTANT" / "AI
    // KNOWLEDGE DRAFTING" — drafts from exactly the SELECTED entries already
    // shown above (never automatic external research).
    const [drafting, setDrafting] = useState(false);
    const [draftError, setDraftError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getKnowledgeContext(entityType, entityId).then(setContext).catch((err) => setError(err?.message || 'Failed to load knowledge context')).finally(() => setLoading(false));
    }, [entityType, entityId]);
    useEffect(() => { load(); }, [load]);

    const runAi = async () => {
        setAiBusy(true);
        try { setAiResult(await askKnowledgeAi(entityType, entityId)); } finally { setAiBusy(false); }
    };

    const runAiDraft = async () => {
        if (!context) return;
        setDrafting(true);
        setDraftError(null);
        try {
            const result = await generateKnowledgeDraft({
                entityType, entityId, entityLabel,
                selectedEntryIds: context.relatedKnowledge.slice(0, 5).map((e) => e.id)
            });
            onOpenEntry?.(result.id);
        } catch (err: any) {
            setDraftError(err?.message || 'Failed to generate draft');
        } finally {
            setDrafting(false);
        }
    };

    const giveFeedback = async (entryId: number, feedback: 'useful' | 'not_relevant') => {
        setFeedbackBusy(entryId);
        try {
            await submitKnowledgeFeedback(entryId, entityType, entityId, feedback);
            setFeedbackGiven((f) => ({ ...f, [entryId]: feedback }));
        } finally {
            setFeedbackBusy(null);
        }
    };

    if (loading) return <div className="ti-card"><div className="ti-loading">Loading Knowledge Context…</div></div>;
    if (error) return <div className="ti-card"><div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div></div>;
    if (!context) return null;

    if (context.restricted) {
        return (
            <div className="ti-card">
                <div className="ti-section-header"><span className="ti-card-title">Knowledge Context</span></div>
                <div className="ti-empty">Restricted Entity — you do not have permission to view this entity's knowledge context.</div>
            </div>
        );
    }

    return (
        <div className="ti-card kb-context-panel">
            <div className="ti-section-header">
                <span className="ti-card-title">Knowledge Context</span>
                <button type="button" className="ti-refresh-btn" onClick={load}>Refresh</button>
            </div>

            {context.knowledgeGap ? (
                <div className="kb-gap-banner">
                    <strong>Knowledge Gap</strong> — no related Knowledge Entries found for {entityLabel}.
                    {onCreateKnowledgeEntry && (
                        <button type="button" className="ti-action-btn" style={{ marginLeft: '10px', background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }}
                            onClick={() => onCreateKnowledgeEntry({ title: `${entityLabel} Overview`, category: defaultCategory || 'Threat Actor', relatedEntityType: entityType, relatedEntityId: String(entityId) })}>
                            + Create Knowledge Entry
                        </button>
                    )}
                </div>
            ) : (
                <div style={{ marginBottom: '12px' }}>
                    <div className="ti-modal-subtitle">Related Knowledge ({context.relatedKnowledge.length})</div>
                    <div className="kb-context-related-list">
                        {context.relatedKnowledge.map((item, i) => {
                            const tally = context.feedback[item.id];
                            const given = feedbackGiven[item.id];
                            return (
                                <div key={item.id} className="kb-context-related-item">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                                        <button type="button" className="ti-target" style={{ background: 'none', border: 'none', textAlign: 'left', cursor: onOpenEntry ? 'pointer' : 'default', padding: 0 }} onClick={() => onOpenEntry?.(item.id)}>
                                            {i + 1}. {item.title}
                                        </button>
                                        <ConfidenceBadge confidence={item.confidence} />
                                    </div>
                                    <div className="ti-chip-list" style={{ marginTop: '4px' }}>
                                        {item.matchReasons.map((r, j) => <span key={j} className="ti-chip" style={{ cursor: 'default' }}>{(REASON_LABELS[r.type] || ((d: string) => d))(r.detail)}</span>)}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '6px', flexWrap: 'wrap' }}>
                                        {onAddToBriefContext && (
                                            <button type="button" className="ti-action-btn" onClick={() => onAddToBriefContext(item.id)}>+ Add to Brief Context</button>
                                        )}
                                        <button type="button" className="ti-action-btn" disabled={feedbackBusy === item.id} style={given === 'useful' ? { borderColor: 'rgba(63,185,80,0.5)', color: '#3fb950' } : undefined} onClick={() => giveFeedback(item.id, 'useful')}>
                                            👍 Useful{tally?.useful ? ` (${tally.useful})` : ''}
                                        </button>
                                        <button type="button" className="ti-action-btn" disabled={feedbackBusy === item.id} style={given === 'not_relevant' ? { borderColor: 'rgba(248,81,73,0.5)', color: '#f85149' } : undefined} onClick={() => giveFeedback(item.id, 'not_relevant')}>
                                            👎 Not Relevant{tally?.not_relevant ? ` (${tally.not_relevant})` : ''}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            <div style={{ marginBottom: '12px' }}>
                <div className="ti-modal-subtitle">Knowledge Coverage</div>
                <div className="kb-coverage-grid">
                    {Object.entries(context.coverage).map(([dim, covered]) => (
                        <div key={dim} className={`kb-coverage-item ${covered ? 'covered' : 'missing'}`}>
                            <span>{COVERAGE_LABELS[dim] || dim}</span><span>{covered ? '✓' : '✗'}</span>
                        </div>
                    ))}
                </div>
                <div className="ti-note" style={{ marginTop: '4px' }}>Coverage indicator only — not a security score.</div>
            </div>

            {(context.sources.length > 0 || context.references.length > 0) && (
                <div style={{ marginBottom: '12px' }}>
                    <div className="ti-modal-subtitle">Sources &amp; References</div>
                    {context.sources.length > 0 && <div className="ti-chip-list">{context.sources.map((s, i) => <span key={i} className="ti-chip" style={{ cursor: 'default' }}>{s.sourceType}</span>)}</div>}
                    {context.references.length > 0 && (
                        <ul className="tb-findings-list" style={{ marginTop: '6px' }}>
                            {context.references.map((r, i) => <li key={i} style={{ display: 'list-item' }}>{r.url ? <a href={r.url} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</li>)}
                        </ul>
                    )}
                </div>
            )}

            <div>
                {/* KNOWLEDGE_BASE_PHASE3.md §13/§14 — drafts from the SAME
                    related entries already shown above; disabled with no
                    evidence rather than performing external research. */}
                <button type="button" className="ti-action-btn" onClick={runAiDraft} disabled={drafting || context.relatedKnowledge.length === 0} style={{ marginRight: '8px' }}>
                    {drafting ? 'Drafting…' : 'AI Draft Knowledge Entry'}
                </button>
                {draftError && <div className="ti-error" style={{ marginTop: '6px' }}>{draftError}</div>}
                <button type="button" className="ti-action-btn" onClick={runAi} disabled={aiBusy || context.relatedKnowledge.length === 0}>
                    {aiBusy ? 'Asking…' : 'Ask AI: What do we know about this?'}
                </button>
                {aiResult && (
                    <div className="ti-note tb-ai-draft" style={{ marginTop: '8px' }}>
                        <div style={{ whiteSpace: 'pre-wrap' }}>{aiResult.answer}</div>
                        {aiResult.citedEntryIds.length > 0 && (
                            <div style={{ marginTop: '6px' }}>
                                <strong>Sources:</strong>{' '}
                                {aiResult.citedEntryIds.map((id) => {
                                    const e = context.relatedKnowledge.find((r) => r.id === id);
                                    return <span key={id} className="ti-chip" style={{ cursor: onOpenEntry ? 'pointer' : 'default', marginRight: '4px' }} onClick={() => onOpenEntry?.(id)}>{e?.title || `Entry #${id}`}</span>;
                                })}
                            </div>
                        )}
                        <div className="ti-note" style={{ marginTop: '4px' }}>{aiResult.note}</div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default KnowledgeContextPanel;
