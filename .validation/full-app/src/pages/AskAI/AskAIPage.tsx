// ASK_AI_PHASE1.md — replaces the former placeholder ("Ask AI is planned
// for a future update and isn't available yet.") with a real, grounded
// intelligence chat. Reuses ThreatIntelligence's existing ti-* visual
// system (RiskBadge-adjacent buttons/loading/error patterns) the same
// established convention every other module page already follows.
//
// ASK_AI_PHASE2.md §75 "UI" — adds a Mode Selector, and an insight panel
// for Relationship Paths / Comparison / Evidence Ranking / Contradictions
// / Gaps / Change Analysis / Recommendations. These Phase 2 sections are
// NOT persisted per-message (§73 "Do not create a large AI data
// warehouse" — only Query Context / Structured Conversation Context /
// Recommendation Audit were added), so the panel reflects the LATEST
// live answer only; reopening an older conversation shows its plain
// transcript (Phase 1 behavior, unchanged).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bot, Sparkles, Send, PlusCircle } from 'lucide-react';
import '../ThreatIntelligence/ThreatIntelligencePage.css';
// Reuses the SAME hero header component (.ti-hero / .ti-hero-icon / .ti-hero-title /
// .ti-hero-desc) every other module's own landing page already uses.
import '../OsintResults/TelegramIntelligence/TelegramIntelligence.css';
import './AskAIPage.css';
import {
    askAi, getAskAiConversations, createAskAiConversation, getAskAiConversation, deleteAskAiConversation,
    approveAskAiAction, rejectAskAiAction, runAskAiTool, getAskAiJob,
    type AskAiConversationSummary, type AskAiMessage, type AskAiPageContext, type AskAiAnswer, type AskAiMode, type AskAiRecommendation,
    type AskAiOperationalMode, type AskAiActionProposal, type AskAiInvestigationPlan, type AskAiThreatHunt, type AskAiEvidenceGapReport, type AskAiPriority, type AskAiHypothesisDraft
} from '../../services/api';

// §16 "SOURCE CITATIONS" / §52 "SOURCE PANEL" — "Clicking a source should
// navigate to the existing module." Phase 1 scope: navigates to the right
// TOP-LEVEL module (not a deep link to the specific entity) — the exact
// module-label strings this maps from are the SAME ones
// services/ai/llm.js's MODULE_LABEL_BY_ENTITY_TYPE produces, so a citation
// the backend actually emitted always has a real destination here.
const SOURCE_LABEL_TO_VIEW: Record<string, string> = {
    'APT Group Intelligence': 'ti-actors', 'Malware Intelligence': 'ti-malware', 'Malware Analysis': 'malware-analysis',
    'Malware Analysis — Clusters': 'malware-analysis', 'Malware Analysis — Detection Rules': 'malware-analysis',
    'Threat Intelligence — Campaigns': 'ti-campaigns', 'IOC Repository': 'ti-iocs', 'MITRE ATT&CK': 'mitre-mapper',
    'Vulnerability Intelligence': 'ti-vulnerabilities', 'Company Intelligence': 'osint-company-intel', 'Brand Intelligence': 'osint-brand-intel',
    'Telegram Intelligence': 'osint-telegram-intel', 'Threat Briefs': 'threat-briefs', 'Investigations': 'osint-social-media-intel',
    'Alert Center': 'mon-alert-center', 'Knowledge Base': 'knowledge-base', 'Relationship Graph': 'ti-correlation'
};

// ASK_AI_PHASE2.md §32 "ACTION BUTTONS" — "Open Entity" for a recommended/
// referenced entity navigates to its TOP-LEVEL module, same non-deep-link
// scope as source citations above (§75 "Keep the existing LekirraX design
// language" — no new navigation primitive introduced for this).
const ENTITY_TYPE_TO_VIEW: Record<string, string> = {
    threat_actor: 'ti-actors', malware: 'ti-malware', malware_sample: 'malware-analysis', malware_cluster: 'malware-analysis',
    detection_rule: 'malware-analysis', campaign: 'ti-campaigns', ioc: 'ti-iocs', attack_technique: 'mitre-mapper',
    vulnerability: 'ti-vulnerabilities', company: 'osint-company-intel', brand: 'osint-brand-intel', telegram_source: 'osint-telegram-intel',
    report: 'threat-briefs', social_investigation: 'osint-social-media-intel', alert: 'mon-alert-center', knowledge_entry: 'knowledge-base'
};

const MODES: { value: AskAiMode; label: string; title: string }[] = [
    { value: 'analyst', label: 'Analyst', title: 'Detailed evidence, relationships, confidence, and unknowns' },
    { value: 'executive', label: 'Executive', title: 'Risk, what changed, why it matters, and the top action' },
    { value: 'technical', label: 'Technical', title: 'Indicators, techniques, and timeline detail' }
];

// ASK_AI_PHASE3.md §4/§50 "OPERATIONAL AI MODES" / "UI" — a SEPARATE
// selector from the response-style Mode above: WHICH Phase 3 capability
// handles the turn, not how the answer is phrased.
const OPERATIONAL_MODES: { value: AskAiOperationalMode; label: string; title: string }[] = [
    { value: 'analyze', label: 'Analyze', title: 'Understand current intelligence (read-only default)' },
    { value: 'investigate', label: 'Investigate', title: 'Build an investigation path' },
    { value: 'threat_hunt', label: 'Threat Hunt', title: 'Generate hypotheses and queries' },
    { value: 'explain', label: 'Explain', title: 'Explain why something happened' },
    { value: 'compare', label: 'Compare', title: 'Compare entities or states' },
    { value: 'plan', label: 'Plan', title: 'Create a structured investigation plan' },
    { value: 'review', label: 'Review', title: 'Review evidence and identify gaps' }
];

interface Props {
    onNavigate?: (view: string) => void;
    /** §9 "PAGE CONTEXT" — the entity (if any) the analyst is currently viewing elsewhere in the app. */
    pageContext?: AskAiPageContext | null;
    // NOTES_PHASE3.md §50 "CONVERSATION INTEGRATION" — "Notes should open Ask
    // AI with Note context... Do not create Notes-specific AI infrastructure."
    // A prefilled question (with the Note's own content already quoted in) is
    // auto-sent through this SAME existing chat pipeline — no parallel system.
    initialQuestion?: string | null;
    onInitialQuestionConsumed?: () => void;
}

const ConversationSidebar: React.FC<{ activeId: number | null; onSelect: (id: number) => void; onNew: () => void; reloadKey: number }> = ({ activeId, onSelect, onNew, reloadKey }) => {
    const [items, setItems] = useState<AskAiConversationSummary[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(() => {
        setLoading(true);
        getAskAiConversations().then(setItems).catch(() => setItems([])).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load, reloadKey]);

    const runDelete = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        await deleteAskAiConversation(id).catch(() => {});
        load();
        if (id === activeId) onNew();
    };

    return (
        <div className="ti-card askai-sidebar">
            <div className="ti-section-header">
                <span className="ti-card-title">Conversations</span>
                <button type="button" className="ti-action-btn askai-new-btn" onClick={onNew}><PlusCircle size={14} /> New</button>
            </div>
            <div className="askai-sidebar-list">
                {loading ? <div className="ti-loading">Loading…</div> : items.length === 0 ? <div className="ti-empty">No conversations yet.</div> : (
                    items.map((c) => (
                        <div key={c.id} className={`askai-conversation-item${c.id === activeId ? ' active' : ''}`} onClick={() => onSelect(c.id)}>
                            <span className="askai-conversation-title" title={c.title}>{c.title}</span>
                            <button type="button" className="ti-action-btn ti-action-btn--danger" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={(e) => runDelete(e, c.id)}>×</button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

const MessageBubble: React.FC<{ msg: AskAiMessage; onSource: (label: string) => void; onSuggested: (q: string) => void }> = ({ msg, onSource, onSuggested }) => (
    <div className={`askai-message askai-message--${msg.role}`}>
        <div className="askai-bubble">{msg.content}</div>
        {msg.role === 'assistant' && (
            <>
                {msg.resultStatus === 'not_found' && <div className="ti-note" style={{ marginTop: '4px' }}>Not available in the current intelligence.</div>}
                {msg.aiProvider === 'heuristic' && <span className="ti-badge ti-badge--none" style={{ marginTop: '4px', display: 'inline-block' }}>Heuristic Summary</span>}
                {msg.sources.length > 0 && (
                    <div className="askai-sources">
                        {msg.sources.map((s, i) => <button key={i} type="button" className="askai-source-chip" onClick={() => onSource(s.label)}>{s.label}</button>)}
                    </div>
                )}
                {msg.suggestedQuestions.length > 0 && (
                    <div className="askai-suggested">
                        {msg.suggestedQuestions.map((q, i) => <button key={i} type="button" className="ti-action-btn" style={{ fontSize: '12px' }} onClick={() => onSuggested(q)}>{q}</button>)}
                    </div>
                )}
            </>
        )}
    </div>
);

// ASK_AI_PHASE2.md §6/§7 "PATH EXPLANATION" — the exact hop chain, nothing more.
const RelationshipPathView: React.FC<{ path: NonNullable<AskAiAnswer['relationshipPath']> }> = ({ path }) => {
    if (!path.supported) return <div className="ti-note">{path.reason || 'A relationship path could not be determined.'}</div>;
    return (
        <div className="askai-insight-block">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>Relationship Path</div>
            {(path.paths || []).map((p, i) => (
                <div key={i} className="askai-path-row">
                    {p.restricted ? (
                        <span className="ti-note">A path toward {p.to.label} passes through an entity you don't have access to.</span>
                    ) : !p.found ? (
                        <span className="ti-note">No relationship path was found connecting {p.from.label} and {p.to.label}.</span>
                    ) : (
                        <span className="askai-path-chain">
                            <strong>{p.from.label}</strong>
                            {p.hops.map((h, j) => (
                                <React.Fragment key={j}>
                                    <span className="askai-path-arrow"> — {h.relationshipType || 'related to'} → </span>
                                    <strong>{h.to?.label}</strong>
                                </React.Fragment>
                            ))}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

const ComparisonView: React.FC<{ comparison: NonNullable<AskAiAnswer['comparison']> }> = ({ comparison }) => {
    if (!comparison.supported) return <div className="ti-note">{comparison.reason || 'Comparison could not be completed.'}</div>;
    if (comparison.type === 'malware_sample') {
        return (
            <div className="askai-insight-block">
                <div className="ti-card-title" style={{ fontSize: '13px' }}>Sample Comparison</div>
                <div>Similarity score: <strong>{comparison.similarity?.overallScore ?? 'Unknown'}</strong></div>
            </div>
        );
    }
    const a = comparison.a, b = comparison.b;
    return (
        <div className="askai-insight-block">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>Comparison</div>
            <table className="askai-compare-table">
                <tbody>
                    <tr><td>{a?.restricted ? <em>Restricted / Not Available</em> : (a?.label || a?.id)}</td><td>vs</td><td>{b?.restricted ? <em>Restricted / Not Available</em> : (b?.label || b?.id)}</td></tr>
                    {!a?.restricted && !b?.restricted && (
                        <tr><td>Risk: {a?.riskLevel || 'Unknown'}</td><td /><td>Risk: {b?.riskLevel || 'Unknown'}</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );
};

const RecommendationsView: React.FC<{ items: AskAiRecommendation[]; onOpen: (view: string) => void }> = ({ items, onOpen }) => (
    <div className="askai-insight-block">
        <div className="ti-card-title" style={{ fontSize: '13px' }}>Suggested Actions</div>
        {items.map((r, i) => {
            const view = r.targetType ? ENTITY_TYPE_TO_VIEW[r.targetType] : null;
            return (
                <div key={i} className="askai-recommendation-row">
                    <div><strong>{r.action}</strong>{r.targetLabel ? ` — ${r.targetLabel}` : ''}</div>
                    <div className="ti-note" style={{ margin: '2px 0 4px' }}>{r.reason}</div>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {view && <button type="button" className="ti-action-btn" style={{ fontSize: '11px' }} onClick={() => onOpen(view)}>Open Entity</button>}
                        <button type="button" className="ti-action-btn" style={{ fontSize: '11px' }} onClick={() => onOpen('ti-correlation')}>View Graph</button>
                    </div>
                </div>
            );
        })}
        <div className="ti-note" style={{ marginTop: '4px' }}>Actions require your explicit confirmation in the relevant module — nothing above is executed automatically.</div>
    </div>
);

// ASK_AI_PHASE2.md §37 "ANSWER CONFIDENCE" — three separate badges, never collapsed.
const ConfidenceBadges: React.FC<{ answer: AskAiAnswer }> = ({ answer }) => {
    if (!answer.dataAvailability && !answer.evidenceConfidence && !answer.interpretationConfidence) return null;
    return (
        <div className="askai-confidence-row">
            {answer.dataAvailability && <span className="ti-badge ti-badge--none">Data: {answer.dataAvailability}</span>}
            {answer.evidenceConfidence && <span className="ti-badge ti-badge--none">Evidence: {answer.evidenceConfidence}</span>}
            {answer.interpretationConfidence && <span className="ti-badge ti-badge--none">Interpretation: {answer.interpretationConfidence}</span>}
        </div>
    );
};

// ASK_AI_PHASE3.md §5-§7 "INVESTIGATION PLANNER" / "PLAN EXECUTION" — each
// step is READ-ONLY (the tool registry only ever holds read tools), so
// "[Run]" here needs no approval workflow — it just previews the result inline.
const InvestigationPlanView: React.FC<{ plan: AskAiInvestigationPlan }> = ({ plan }) => {
    const [results, setResults] = useState<Record<number, string>>({});
    const [running, setRunning] = useState<number | null>(null);
    const runStep = async (i: number) => {
        setRunning(i);
        try {
            const res = await runAskAiTool(plan.steps[i].toolName, plan.steps[i].params);
            setResults((prev) => ({ ...prev, [i]: res.status === 'ok' ? 'Done — see the relevant module for full detail.' : `Unavailable — ${res.error || 'service unavailable'}` }));
        } catch {
            setResults((prev) => ({ ...prev, [i]: 'Failed to run this step.' }));
        } finally {
            setRunning(null);
        }
    };
    return (
        <div className="askai-insight-block">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>Investigation Plan</div>
            <ol className="askai-plan-list">
                {plan.steps.map((s, i) => (
                    <li key={i}>
                        <span>{s.label}</span>
                        <button type="button" className="ti-action-btn" style={{ fontSize: '11px', marginLeft: '8px' }} disabled={running === i} onClick={() => runStep(i)}>{running === i ? 'Running…' : 'Run'}</button>
                        {results[i] && <div className="ti-note" style={{ marginTop: '2px' }}>{results[i]}</div>}
                    </li>
                ))}
            </ol>
            <div className="ti-note">Each step is read-only and runs only when you click Run — nothing above executes automatically.</div>
        </div>
    );
};

const ThreatHuntView: React.FC<{ hunt: AskAiThreatHunt }> = ({ hunt }) => (
    <div className="askai-insight-block">
        <div className="ti-card-title" style={{ fontSize: '13px' }}>Threat Hunt Hypothesis <span className="ti-badge ti-badge--none">{hunt.status}</span></div>
        <div>{hunt.hypothesis}</div>
        <div className="ti-note" style={{ margin: '4px 0' }}>Confidence: {hunt.confidence}</div>
        {hunt.relevantTechniques.length > 0 && <div><strong>MITRE:</strong> {hunt.relevantTechniques.map((t) => t.label).join(', ')}</div>}
        {hunt.relevantIocs.length > 0 && <div><strong>IOCs:</strong> {hunt.relevantIocs.map((i) => i.label).join(', ')}</div>}
        {hunt.suggestedQueries.length > 0 && (
            <ul className="askai-claim-list">
                {hunt.suggestedQueries.map((q, i) => <li key={i}>{q.dataSource}: {q.target} <span className="ti-note">({q.scope})</span></li>)}
            </ul>
        )}
        {hunt.expectedSignals.length > 0 && <div className="ti-note" style={{ marginTop: '4px' }}>Expected signals: {hunt.expectedSignals.join(' ')}</div>}
    </div>
);

const HypothesisDraftView: React.FC<{ hypothesis: AskAiHypothesisDraft }> = ({ hypothesis }) => (
    <div className="askai-insight-block">
        <div className="ti-card-title" style={{ fontSize: '13px' }}>Draft Hypothesis <span className="ti-badge ti-badge--none">{hypothesis.status}</span></div>
        <div>{hypothesis.statement}</div>
        {hypothesis.supporting.length > 0 && <div className="ti-note" style={{ marginTop: '4px' }}>Supporting: {hypothesis.supporting.join('; ')}</div>}
        {hypothesis.contradicting.length > 0 && <div className="ti-note">Contradicting: {hypothesis.contradicting.join('; ')}</div>}
        {hypothesis.unknowns.length > 0 && <div className="ti-note">Unknown: {hypothesis.unknowns.join('; ')}</div>}
    </div>
);

const EvidenceGapReportView: React.FC<{ report: AskAiEvidenceGapReport }> = ({ report }) => {
    const rows: Array<[string, number]> = [
        ['Missing', report.missingEvidence.length], ['Weak', report.weakEvidence.length], ['Conflicting', report.conflictingEvidence.length],
        ['Outdated', report.outdatedEvidence.length], ['Unverified relationships', report.unverifiedRelationships.length]
    ];
    return (
        <div className="askai-insight-block">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>Evidence Gap Review</div>
            <div className="askai-evidence-counts">{rows.map(([label, n]) => <span key={label} className="ti-badge ti-badge--none">{label}: {n}</span>)}</div>
            {report.missingEvidence.length > 0 && <ul className="askai-claim-list">{report.missingEvidence.map((g, i) => <li key={i}>{g}</li>)}</ul>}
        </div>
    );
};

const PriorityBadge: React.FC<{ priority: AskAiPriority }> = ({ priority }) => {
    const cls = priority.level === 'HIGH' ? 'ti-badge--high' : priority.level === 'MEDIUM' ? 'ti-badge--medium' : 'ti-badge--none';
    return (
        <div className="askai-insight-block">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>Investigation Priority</div>
            <span className={`ti-badge ${cls}`}>{priority.level}</span>
            <div className="ti-note" style={{ marginTop: '4px' }}>{priority.reasons.join('; ')}</div>
        </div>
    );
};

// ASK_AI_PHASE3.md §9-§12/§51-§53/§62 "CONTROLLED ACTIONS" / "ACTION
// APPROVAL UI" / "ACTION RESULT" / "ACTION FAILURE" — CASE 2/3/4: no
// mutation happens until [Approve] is clicked, and the result shown is
// ALWAYS the real API response, never assumed success.
const ActionProposalCard: React.FC<{ proposal: AskAiActionProposal; onDecided: (updated: AskAiActionProposal) => void }> = ({ proposal, onDecided }) => {
    const [busy, setBusy] = useState(false);
    const approve = async () => {
        setBusy(true);
        try {
            const res = await approveAskAiAction(proposal.id);
            onDecided({ ...proposal, status: res.status as AskAiActionProposal['status'], result: res.result as Record<string, unknown> | null, error: res.error || null });
        } catch (err: any) {
            onDecided({ ...proposal, status: 'failed', error: err?.message || 'Failed to approve' });
        } finally {
            setBusy(false);
        }
    };
    const reject = async () => {
        setBusy(true);
        try {
            const res = await rejectAskAiAction(proposal.id);
            onDecided({ ...proposal, status: res.status as AskAiActionProposal['status'] });
        } catch {
            onDecided({ ...proposal, status: 'rejected' });
        } finally {
            setBusy(false);
        }
    };
    return (
        <div className="askai-action-card">
            <div className="ti-card-title" style={{ fontSize: '13px' }}>{proposal.label || proposal.action}</div>
            {proposal.target && <div><strong>Target:</strong> {proposal.target}</div>}
            {proposal.reason && <div className="ti-note">Reason: {proposal.reason}</div>}
            {proposal.impact && <div className="ti-note">Impact: {proposal.impact}</div>}
            <div className="ti-note">Permission: {proposal.requiredPermission || 'Standard analyst access'}</div>
            {proposal.status === 'unavailable' && <div className="ti-error" style={{ marginTop: '4px' }}>Action: Unavailable — {proposal.unavailableReason || 'Insufficient Permission'}</div>}
            {proposal.status === 'proposed' && (
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button type="button" className="ti-action-btn" disabled={busy} onClick={approve}>{busy ? 'Working…' : 'Approve'}</button>
                    <button type="button" className="ti-action-btn ti-action-btn--danger" disabled={busy} onClick={reject}>Cancel</button>
                </div>
            )}
            {proposal.status === 'executed' && <div className="ti-badge ti-badge--low" style={{ marginTop: '4px' }}>Completed{proposal.result ? ` — ${JSON.stringify(proposal.result)}` : ''}</div>}
            {proposal.status === 'failed' && <div className="ti-error" style={{ marginTop: '4px' }}>Failed — {proposal.error}</div>}
            {proposal.status === 'rejected' && <div className="ti-note" style={{ marginTop: '4px' }}>Cancelled.</div>}
        </div>
    );
};

/** ASK_AI_PHASE2.md §75 "UI" — everything beyond plain prose for the LATEST
 *  live answer only (see file header comment for why this isn't persisted). */
const Phase2InsightPanel: React.FC<{ answer: AskAiAnswer; onNavigate: (view: string) => void }> = ({ answer, onNavigate }) => {
    const [proposals, setProposals] = useState<AskAiActionProposal[]>(answer.actionProposals || []);
    useEffect(() => { setProposals(answer.actionProposals || []); }, [answer]);
    const hasAnything = answer.relationshipPath || answer.comparison || answer.evidenceRanking || (answer.contradictions?.length) || answer.gaps || answer.changeAnalysis || (answer.recommendations?.length)
        || answer.dataAvailability || answer.investigationPlan || answer.threatHunt || answer.evidenceGapReport || answer.priority || answer.hypothesisDraft || proposals.length;
    if (!hasAnything) return null;
    const gapItems = answer.gaps ? [...answer.gaps.evidence, ...answer.gaps.knowledge, ...answer.gaps.investigation] : [];
    return (
        <div className="ti-card askai-insight-panel">
            <ConfidenceBadges answer={answer} />
            {answer.assessment && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Assessment</div>
                    <div>{answer.assessment}</div>
                    {answer.reasoningSummary && <div className="ti-note" style={{ marginTop: '4px' }}>{answer.reasoningSummary}</div>}
                </div>
            )}
            {answer.unknowns && answer.unknowns.length > 0 && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Unknowns</div>
                    <ul className="askai-claim-list">{answer.unknowns.map((u, i) => <li key={i}>{u}</li>)}</ul>
                </div>
            )}
            {answer.investigationPlan && <InvestigationPlanView plan={answer.investigationPlan} />}
            {answer.threatHunt && <ThreatHuntView hunt={answer.threatHunt} />}
            {answer.hypothesisDraft && <HypothesisDraftView hypothesis={answer.hypothesisDraft} />}
            {answer.evidenceGapReport && <EvidenceGapReportView report={answer.evidenceGapReport} />}
            {answer.priority && <PriorityBadge priority={answer.priority} />}
            {proposals.length > 0 && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Recommended Actions</div>
                    {proposals.map((p) => (
                        <ActionProposalCard key={p.id} proposal={p} onDecided={(updated) => setProposals((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))} />
                    ))}
                </div>
            )}
            {answer.relationshipPath && <RelationshipPathView path={answer.relationshipPath} />}
            {answer.comparison && <ComparisonView comparison={answer.comparison} />}
            {answer.evidenceRanking && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Evidence Ranking</div>
                    <div className="askai-evidence-counts">
                        <span className="ti-badge ti-badge--high">Primary: {answer.evidenceRanking.primary.length}</span>
                        <span className="ti-badge ti-badge--medium">Supporting: {answer.evidenceRanking.supporting.length}</span>
                        <span className="ti-badge ti-badge--none">Contextual: {answer.evidenceRanking.contextual.length}</span>
                        <span className="ti-badge ti-badge--none">Weak: {answer.evidenceRanking.weak.length}</span>
                    </div>
                    {answer.evidenceRanking.strongest ? (
                        <div className="ti-note" style={{ marginTop: '4px' }}>Strongest: {answer.evidenceRanking.strongest.description || answer.evidenceRanking.strongest.source} ({answer.evidenceRanking.strongest.source}, {answer.evidenceRanking.strongest.confidence || 'Unknown'} confidence)</div>
                    ) : (
                        <div className="ti-note" style={{ marginTop: '4px' }}>No strong evidence found.</div>
                    )}
                </div>
            )}
            {answer.contradictions && answer.contradictions.length > 0 && (
                <div className="askai-insight-block askai-insight-block--warning">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Conflicting Information</div>
                    {answer.contradictions.map((c, i) => (
                        <div key={i}>
                            <div>{c.statement}</div>
                            <ul className="askai-claim-list">
                                {c.claims.map((cl, j) => <li key={j}>{cl.value}{cl.sources.length ? ` — ${cl.sources.join(', ')}` : ''}</li>)}
                            </ul>
                        </div>
                    ))}
                </div>
            )}
            {answer.changeAnalysis && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Change Analysis — {answer.changeAnalysis.timeRange.label}</div>
                    {!answer.changeAnalysis.supported ? (
                        <div className="ti-note">{answer.changeAnalysis.reason}</div>
                    ) : answer.changeAnalysis.hasChanges ? (
                        <ul className="askai-claim-list">{(answer.changeAnalysis.events || []).map((e, i) => <li key={i}>{e.label}</li>)}</ul>
                    ) : (
                        <div className="ti-note">No changes found in this window.</div>
                    )}
                </div>
            )}
            {gapItems.length > 0 && (
                <div className="askai-insight-block">
                    <div className="ti-card-title" style={{ fontSize: '13px' }}>Gaps</div>
                    <ul className="askai-claim-list">{gapItems.map((g, i) => <li key={i}>{g}</li>)}</ul>
                </div>
            )}
            {answer.recommendations && answer.recommendations.length > 0 && <RecommendationsView items={answer.recommendations} onOpen={onNavigate} />}
        </div>
    );
};

const AskAIPage: React.FC<Props> = ({ onNavigate, pageContext = null, initialQuestion = null, onInitialQuestionConsumed }) => {
    const [conversationId, setConversationId] = useState<number | null>(null);
    const [messages, setMessages] = useState<AskAiMessage[]>([]);
    const [question, setQuestion] = useState('');
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sidebarReloadKey, setSidebarReloadKey] = useState(0);
    const [lastContext, setLastContext] = useState<{ type: string; label?: string } | null>(null);
    // ASK_AI_PHASE2.md §46/§75 "AI SUMMARY MODES" / "Mode Selector" — null =
    // no explicit selection (backend default), so an untouched selector
    // never changes the request Phase 1 already sends.
    const [mode, setMode] = useState<AskAiMode | null>(null);
    // ASK_AI_PHASE3.md §4/§75 "OPERATIONAL AI MODES" / "Mode Selector" — same
    // "null = untouched, backend default" contract as the response Mode above.
    const [operationalMode, setOperationalMode] = useState<AskAiOperationalMode | null>(null);
    const [lastAnswer, setLastAnswer] = useState<AskAiAnswer | null>(null);
    const [jobPending, setJobPending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => { messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' }); }, [messages]);

    const openConversation = async (id: number) => {
        setConversationId(id);
        setError(null);
        setLastAnswer(null); // §75 file header — insight panel only ever reflects the LATEST live answer
        try {
            const conv = await getAskAiConversation(id);
            setMessages(conv.messages);
            const lastWithContext = [...conv.messages].reverse().find((m) => m.contextType);
            setLastContext(lastWithContext ? { type: lastWithContext.contextType! } : null);
        } catch (err: any) {
            setError(err?.message || 'Failed to load conversation');
        }
    };
    const startNewConversation = async () => {
        setError(null);
        try {
            const created = await createAskAiConversation();
            setConversationId(created.id);
            setMessages([]);
            setLastContext(null);
            setLastAnswer(null);
            setSidebarReloadKey((k) => k + 1);
        } catch (err: any) {
            setError(err?.message || 'Failed to start a new conversation');
        }
    };

    const runSend = async (text?: string) => {
        const q = (text ?? question).trim();
        if (!q || sending) return;
        setSending(true);
        setError(null);
        setQuestion('');
        // Optimistic — show the user's own turn immediately; the real
        // persisted rows (with ids) replace this on the next successful reload.
        setMessages((prev) => [...prev, { id: -1, conversation_id: conversationId || -1, role: 'user', content: q, sources: [], entities: [], suggestedQuestions: [], confidence: null, queryType: null, contextType: null, contextEntityId: null, aiProvider: null, resultStatus: null, created_at: null }]);
        try {
            const res = await askAi(q, { conversationId, pageContext, ...(mode ? { mode } : {}), ...(operationalMode ? { operationalMode } : {}) });
            setConversationId(res.conversationId);
            setLastContext(res.context.type !== 'global' ? { type: res.context.type, label: res.context.label } : null);
            setLastAnswer(res);
            setSidebarReloadKey((k) => k + 1);
            // Re-fetch the real persisted conversation so ids/timestamps are accurate.
            const conv = await getAskAiConversation(res.conversationId);
            setMessages(conv.messages);
            // ASK_AI_PHASE3.md §54/CASE10 "BACKGROUND TASKS" — a full-Case
            // analysis returns a jobId instead of an answer; poll until it
            // completes, then refresh the conversation to pick up the
            // background worker's own posted assistant message.
            if (res.jobId) pollJob(res.jobId, res.conversationId);
        } catch (err: any) {
            setError(err?.message || 'Ask AI is temporarily unavailable');
            setMessages((prev) => prev.slice(0, -1)); // roll back the optimistic user bubble
        } finally {
            setSending(false);
        }
    };

    const pollJob = async (jobId: number, forConversationId: number) => {
        setJobPending(true);
        try {
            for (let i = 0; i < 40; i++) {
                await new Promise((r) => setTimeout(r, 2000));
                const job = await getAskAiJob(jobId).catch(() => null);
                if (!job || job.status === 'completed' || job.status === 'failed') {
                    if (conversationId === forConversationId || conversationId === null) {
                        const conv = await getAskAiConversation(forConversationId).catch(() => null);
                        if (conv) setMessages(conv.messages);
                    }
                    break;
                }
            }
        } finally {
            setJobPending(false);
        }
    };

    // NOTES_PHASE3.md §50 — consume a Note-seeded question exactly once,
    // through the SAME runSend a manually-typed question already uses.
    useEffect(() => {
        if (!initialQuestion) return;
        runSend(initialQuestion);
        onInitialQuestionConsumed?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialQuestion]);

    const handleSource = (label: string) => {
        const view = SOURCE_LABEL_TO_VIEW[label];
        if (view && onNavigate) onNavigate(view);
    };
    const handleInsightNavigate = (view: string) => { if (onNavigate) onNavigate(view); };

    return (
        <div className="ti-page tb-page kb-page">
            {/* Same hero treatment as Telegram Intelligence's own landing page. */}
            <div className="ti-hero askai-hero">
                <div className="ti-hero-top">
                    <span className="ti-hero-icon" aria-hidden="true"><Bot size={22} /></span>
                    <h2 className="ti-hero-title">Ask AI</h2>
                </div>
                <p className="ti-hero-desc">
                    Ask natural-language questions about intelligence already inside LekirraX. Every answer is grounded in real
                    records with source citations — Ask AI never invents intelligence and never mixes in external web knowledge.
                </p>
            </div>
            <div className="ti-container">
                <div className="askai-page">
                    <ConversationSidebar activeId={conversationId} onSelect={openConversation} onNew={startNewConversation} reloadKey={sidebarReloadKey} />
                    <div className="ti-card askai-main">
                        <div className="askai-toolbar">
                            {pageContext && (
                                <div className="askai-context-bar">
                                    <span className="ti-note">Context:</span>
                                    <span className="ti-badge ti-badge--medium">{pageContext.label || `${pageContext.type} #${pageContext.id}`}</span>
                                </div>
                            )}
                            {!pageContext && lastContext && (
                                <div className="askai-context-bar">
                                    <span className="ti-note">Context:</span>
                                    <span className="ti-badge ti-badge--none" style={{ textTransform: 'capitalize' }}>{lastContext.label || lastContext.type.replace(/_/g, ' ')}</span>
                                </div>
                            )}
                            {!pageContext && !lastContext && messages.length === 0 && <div className="askai-context-bar"><span className="ti-note">Context: Global</span></div>}

                            <div className="askai-toolbar-right">
                                {/* ASK_AI_PHASE3.md §4/§75 "OPERATIONAL AI MODES" / "Mode Selector" */}
                                <div className="askai-mode-group">
                                    <span className="askai-mode-group-label">Mode</span>
                                    <div className="askai-mode-selector" role="group" aria-label="Operational mode">
                                        {OPERATIONAL_MODES.map((m) => (
                                            <button
                                                key={m.value} type="button" title={m.title}
                                                className={`ti-action-btn${operationalMode === m.value ? ' askai-mode-btn--active' : ''}`}
                                                style={{ fontSize: '12px' }}
                                                onClick={() => setOperationalMode((prev) => (prev === m.value ? null : m.value))}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <span className="askai-mode-divider" aria-hidden="true" />
                                {/* ASK_AI_PHASE2.md §46/§75 "AI SUMMARY MODES" / "Mode Selector" */}
                                <div className="askai-mode-group">
                                    <span className="askai-mode-group-label">Style</span>
                                    <div className="askai-mode-selector" role="group" aria-label="Response mode">
                                        {MODES.map((m) => (
                                            <button
                                                key={m.value} type="button" title={m.title}
                                                className={`ti-action-btn${mode === m.value ? ' askai-mode-btn--active' : ''}`}
                                                style={{ fontSize: '12px' }}
                                                onClick={() => setMode((prev) => (prev === m.value ? null : m.value))}
                                            >
                                                {m.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="askai-messages">
                            {messages.length === 0 ? (
                                <div className="askai-empty-state">
                                    <Sparkles size={26} className="askai-empty-icon" aria-hidden="true" />
                                    <div className="askai-empty-title">Ask anything about your intelligence</div>
                                    <div className="ti-note">e.g. "What do we know about Kimsuky?" or "What connects Kimsuky, Gomir and example.com?"</div>
                                </div>
                            ) : (
                                messages.map((m) => <MessageBubble key={m.id} msg={m} onSource={handleSource} onSuggested={(q) => runSend(q)} />)
                            )}
                            {sending && <div className="ti-loading">Thinking…</div>}
                            {jobPending && <div className="ti-loading">Analyzing in the background — this may take a moment…</div>}
                            <div ref={messagesEndRef} />
                        </div>

                        {lastAnswer && conversationId === lastAnswer.conversationId && <Phase2InsightPanel answer={lastAnswer} onNavigate={handleInsightNavigate} />}

                        {error && <div className="ti-error" style={{ marginTop: '8px' }}>{error}</div>}

                        <div className="askai-input-row">
                            <textarea
                                placeholder="Ask something..."
                                value={question}
                                disabled={sending}
                                onChange={(e) => setQuestion(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); runSend(); } }}
                            />
                            <button type="button" className="ti-action-btn askai-send-btn" disabled={sending || !question.trim()} onClick={() => runSend()}>
                                {sending ? 'Sending…' : <><Send size={14} /> Send</>}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AskAIPage;
