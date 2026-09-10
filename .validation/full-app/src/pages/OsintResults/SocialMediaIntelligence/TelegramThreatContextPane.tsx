import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { timeAgo } from '../../../utils/timeAgo';
import {
    runTelegramCorrelation, getTelegramThreatContext, getTelegramSourceIntelligence,
    getTelegramActivityTimeline, getTelegramTimeline, getTelegramSourceRisk,
    getTelegramAiSummary, createTelegramSourceMonitor,
    type TelegramSource, type TelegramCorrelation, type TelegramThreatContext,
    type TelegramSourceIntelligence, type TelegramActivityTimeline, type TelegramTimelineEvent,
    type TelegramAiSummary, type RiskAssessmentResult
} from '../../../services/api';

// TELEGRAM_INTELLIGENCE_PHASE3.md §5-§20 / §29-§40 — the CTI correlation,
// monitoring and investigation surfaces.
//
// §2 "Do NOT create a second CTI system": nothing here is a Telegram-private
// engine. Correlation runs against the EXISTING IOC / Threat Actor / Malware /
// Vulnerability / Company / Brand / Social repositories, risk comes from the
// EXISTING computeEntityRisk(), monitoring registers an ordinary monitor with
// the EXISTING scheduler, and alerts land in the EXISTING Alert Center.
//
// §7/§20 — every finding is rendered with its claim, its confidence and the
// real signals that produced it. §32 "Do not show unexplained risk scores."

const CLAIM_TONE: Record<string, 'strong' | 'medium' | 'weak'> = {
    Attributed: 'strong', Correlated: 'strong', Related: 'medium', Observed: 'medium', Referenced: 'weak'
};
const CONF_TONE: Record<string, 'strong' | 'medium' | 'weak'> = {
    High: 'strong', Medium: 'medium', Low: 'weak', Unknown: 'weak'
};

// §7 — plain-language meaning of each rung, shown where the analyst reads it
// so a mention is never mistaken for an attribution.
const CLAIM_MEANING: Record<string, string> = {
    Referenced: 'Mentioned in a collected message. Not a relationship and not an attribution.',
    Observed: 'Collected from a message. No matching record exists in Threat Intelligence.',
    Related: 'Shares an indicator with an existing record. Not an attribution.',
    Correlated: 'Matches an existing intelligence record.',
    Attributed: 'Analyst-assessed attribution. Never set automatically.'
};

function ClaimBadge({ claim }: { claim: string }) {
    return (
        <span className={`smi-strength-badge smi-strength-badge--${CLAIM_TONE[claim] || 'weak'}`} title={CLAIM_MEANING[claim] || claim}>
            {claim}
        </span>
    );
}
function ConfBadge({ confidence }: { confidence: string }) {
    return <span className={`smi-strength-badge smi-strength-badge--${CONF_TONE[confidence] || 'weak'}`}>{confidence}</span>;
}

interface Props {
    investigationId: number;
    sources: TelegramSource[];
    // §37 "Each finding must link to the existing intelligence module."
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    onNavigateToView?: (view: string) => void;
}

const TelegramThreatContextPane: React.FC<Props> = ({ investigationId, sources, onNavigateToModule, onNavigateToView }) => {
    const [scopeSourceId, setScopeSourceId] = useState<string>('');
    const [threat, setThreat] = useState<TelegramThreatContext | null>(null);
    const [activity, setActivity] = useState<TelegramActivityTimeline | null>(null);
    const [timeline, setTimeline] = useState<TelegramTimelineEvent[]>([]);
    const [sourceIntel, setSourceIntel] = useState<TelegramSourceIntelligence | null>(null);
    const [risk, setRisk] = useState<RiskAssessmentResult | null>(null);
    const [ai, setAi] = useState<TelegramAiSummary | null>(null);

    const [loading, setLoading] = useState(false);
    const [correlating, setCorrelating] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);

    const sid = scopeSourceId ? Number(scopeSourceId) : undefined;

    const load = useCallback(() => {
        setLoading(true);
        Promise.all([
            getTelegramThreatContext(investigationId, sid),
            getTelegramActivityTimeline(investigationId, sid),
            getTelegramTimeline(investigationId, 50),
            sid ? getTelegramSourceIntelligence(sid).catch(() => null) : Promise.resolve(null),
            sid ? getTelegramSourceRisk(sid).catch(() => null) : Promise.resolve(null)
        ])
            .then(([t, a, tl, si, r]) => {
                setThreat(t); setActivity(a); setTimeline(tl); setSourceIntel(si); setRisk(r);
            })
            .catch(() => { setThreat(null); setActivity(null); setTimeline([]); setSourceIntel(null); setRisk(null); })
            .finally(() => setLoading(false));
    }, [investigationId, sid]);

    useEffect(() => { load(); }, [load]);

    // §4/§10 — correlates data Phase 1/2 already collected. This starts no
    // crawl and contacts no external service.
    const runCorrelation = async () => {
        setCorrelating(true); setError(null); setNotice(null);
        try {
            const res = await runTelegramCorrelation(investigationId, sid);
            setNotice(
                `Evaluated ${res.entitiesEvaluated} extracted entity value(s): `
                + `${res.correlationCount} correlation(s) (${res.inserted} new, ${res.updated} updated), `
                + `${res.graphEdges} relationship edge(s) recorded.`
            );
            load();
        } catch (err: any) {
            setError(err?.message || 'Correlation failed.');
        } finally {
            setCorrelating(false);
        }
    };

    const loadAiSummary = async () => {
        setAiLoading(true); setError(null);
        try {
            setAi(await getTelegramAiSummary(investigationId, sid));
        } catch (err: any) {
            setError(err?.message || 'Failed to generate the AI summary.');
        } finally {
            setAiLoading(false);
        }
    };

    // §21 — registers the source with the EXISTING monitoring system. There is
    // no Telegram-private scheduler, alert store or lifecycle.
    const enableMonitoring = async () => {
        if (!sid) return;
        setError(null); setNotice(null);
        try {
            const res = await createTelegramSourceMonitor(sid, 60);
            setNotice(`Monitor #${res.monitor.id} created. Checks run on the existing monitoring scheduler; alerts appear in the existing Alert Center.`);
            load();
        } catch (err: any) {
            setError(err?.message || 'Failed to enable monitoring.');
        }
    };

    // §37 — pivot into the OSINT module that owns this observable type.
    const subjectNav = (c: TelegramCorrelation): { label: string; module: string } | null => {
        switch (c.subjectEntityType) {
            case 'Domain':
            case 'URL': return { label: 'Open in Domain Intelligence', module: 'domain-intel' };
            case 'IPv4':
            case 'IPv6': return { label: 'Open in IP Intelligence', module: 'ip-intel' };
            case 'Email': return { label: 'Open in Email Intelligence', module: 'email' };
            case 'Username':
            case 'Mention': return { label: 'Open in Social Media Intelligence', module: 'social' };
            case 'Company': return { label: 'Open in Company Intelligence', module: 'company-intel' };
            case 'Brand': return { label: 'Open in Brand Intelligence', module: 'brand-intel' };
            default: return null;
        }
    };

    // §37 — and into the Threat Intelligence record the match was made against.
    const matchedView = (c: TelegramCorrelation): { label: string; view: string } | null => {
        switch (c.matchedEntityType) {
            case 'ioc': return { label: 'View IOC', view: 'ti-iocs' };
            case 'threat_actor': return { label: 'View Threat Actor', view: 'ti-actors' };
            case 'malware': return { label: 'View Malware', view: 'ti-malware' };
            case 'vulnerability': return { label: 'View Vulnerability', view: 'ti-vulnerabilities' };
            case 'campaign': return { label: 'View Campaign', view: 'ti-campaigns' };
            default: return null;
        }
    };

    // §27/§28 — one [Investigate] per finding, into the EXISTING investigation
    // workflow, carrying the value as real context. No second workflow.
    const CorrelationRows = ({ items, emptyText }: { items: TelegramCorrelation[]; emptyText: string }) => {
        if (items.length === 0) return <div className="smi-empty">{emptyText}</div>;
        return (
            <div className="smi-table-wrap">
                <table className="smi-table">
                    <thead>
                        <tr>
                            <th>Telegram Value</th><th>Matched Record</th><th>Claim</th><th>Confidence</th>
                            <th>Messages</th><th>Sources</th><th>Evidence</th><th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {items.map((c) => {
                            const nav = subjectNav(c);
                            const mv = matchedView(c);
                            return (
                                <tr key={c.id}>
                                    <td data-label="Telegram Value" className="smi-mono">
                                        {c.subjectValue}
                                        <div className="smi-muted">{c.subjectEntityType}</div>
                                    </td>
                                    <td data-label="Matched Record">
                                        {c.matchedEntityLabel || '—'}
                                        <div className="smi-muted">{String(c.matchedEntityType).replace(/_/g, ' ')}</div>
                                    </td>
                                    <td data-label="Claim"><ClaimBadge claim={c.claim} /></td>
                                    <td data-label="Confidence"><ConfBadge confidence={c.confidence} /></td>
                                    <td data-label="Messages">{c.occurrenceCount}</td>
                                    <td data-label="Sources">{c.sourceCount}</td>
                                    <td data-label="Evidence">
                                        {/* §20 — the real signals, never a bare score. */}
                                        {c.signals.length === 0 ? '—' : (
                                            <ul className="smi-signal-list">
                                                {c.signals.map((s, i) => <li key={i}>{s}</li>)}
                                            </ul>
                                        )}
                                        {c.sourceTarget && <div className="smi-muted">Seen in @{c.sourceTarget}</div>}
                                    </td>
                                    <td data-label="Actions">
                                        {nav && onNavigateToModule && (
                                            <button
                                                type="button" className="smi-btn smi-btn--sm"
                                                onClick={() => onNavigateToModule(nav.module, c.subjectValue)}
                                                title="Opens the module with this value pre-filled — it does not start a scan"
                                            >
                                                Investigate
                                            </button>
                                        )}
                                        {mv && onNavigateToView && (
                                            <> {' '}
                                                <button
                                                    type="button" className="smi-btn smi-btn--sm"
                                                    onClick={() => onNavigateToView(mv.view)}
                                                    title="Opens the existing Threat Intelligence record list"
                                                >
                                                    {mv.label}
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        );
    };

    const entityStat = (k: string) => sourceIntel?.entities?.[k] ?? 0;
    const corrStat = (k: string) => sourceIntel?.correlations?.[k] ?? 0;

    const hasAnyCorrelation = useMemo(() => (threat?.total ?? 0) > 0, [threat]);

    return (
        <>
            {/* §4/§10 — the correlation pass itself. */}
            <div className="smi-card">
                <div className="smi-card-title">Cross-Intelligence Correlation</div>
                <p className="smi-muted">
                    Correlates values already extracted from collected Telegram messages against the existing IOC, Threat Actor,
                    Malware, Vulnerability, Company, Brand and Social Media repositories. This runs no crawl and contacts no
                    external service.
                </p>
                <div className="smi-overview-grid">
                    <label className="smi-kv">
                        <span className="k">Scope</span>
                        <span className="v">
                            <select value={scopeSourceId} onChange={(e) => { setScopeSourceId(e.target.value); setAi(null); }} aria-label="Correlation scope">
                                <option value="">All sources</option>
                                {sources.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.target}</option>)}
                            </select>
                        </span>
                    </label>
                    <div className="smi-kv">
                        <span className="k">Action</span>
                        <span className="v">
                            <button type="button" className="smi-btn smi-btn--sm" onClick={runCorrelation} disabled={correlating}>
                                {correlating ? 'Correlating…' : 'Run Correlation'}
                            </button>
                        </span>
                    </div>
                </div>
                {notice && <div className="smi-signal-note">{notice}</div>}
                {error && <div className="smi-error" style={{ marginTop: '10px' }}>{error}</div>}
                {/* §7 — the vocabulary, stated once where findings are read. */}
                <div className="smi-signal-note">
                    Claim ladder: <strong>Referenced</strong> = mentioned only · <strong>Observed</strong> = collected, no matching record ·
                    {' '}<strong>Related</strong> = shares an indicator with an existing record · <strong>Correlated</strong> = matches an
                    existing intelligence record · <strong>Attributed</strong> is an analyst judgement and is never set automatically.
                </div>
            </div>

            {/* §35 "TELEGRAM SOURCE INTELLIGENCE DASHBOARD" — all real aggregates. */}
            {sid && (
                <div className="smi-card">
                    <div className="smi-card-title">Source Intelligence — {sourceIntel?.displayName || sourceIntel?.target || `#${sid}`}</div>
                    {!sourceIntel ? (
                        <div className="smi-loading">{loading ? 'Loading…' : 'This source could not be loaded.'}</div>
                    ) : (
                        <>
                            <div className="smi-summary">
                                <div className="smi-summary-card"><span className="smi-summary-label">Messages</span><span className="smi-summary-value">{sourceIntel.messages}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Domains</span><span className="smi-summary-value">{entityStat('Domain')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">IPs</span><span className="smi-summary-value">{entityStat('IPv4') + entityStat('IPv6')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Emails</span><span className="smi-summary-value">{entityStat('Email')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Usernames</span><span className="smi-summary-value">{entityStat('Username') + entityStat('Mention')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Known IOC Matches</span><span className="smi-summary-value">{sourceIntel.knownIntelMatches}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Threat Actor Mentions</span><span className="smi-summary-value">{corrStat('threat_actor')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Malware Mentions</span><span className="smi-summary-value">{corrStat('malware')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">CVE Mentions</span><span className="smi-summary-value">{corrStat('vulnerability')}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Alerts</span><span className="smi-summary-value">{sourceIntel.alerts.total}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Open Alerts</span><span className="smi-summary-value">{sourceIntel.alerts.open}</span></div>
                                <div className="smi-summary-card"><span className="smi-summary-label">Risk</span><span className="smi-summary-value">{risk?.level || 'Unknown'}</span></div>
                            </div>
                            <div className="smi-overview-grid">
                                <div className="smi-kv"><span className="k">Status</span><span className="v">{sourceIntel.status}</span></div>
                                <div className="smi-kv"><span className="k">Validation</span><span className="v">{sourceIntel.validationState}</span></div>
                                <div className="smi-kv"><span className="k">Last Crawl</span><span className="v">{sourceIntel.lastCrawlAt ? timeAgo(sourceIntel.lastCrawlAt) : 'Never'}</span></div>
                                <div className="smi-kv"><span className="k">Last Error</span><span className="v">{sourceIntel.lastError || '—'}</span></div>
                                <div className="smi-kv">
                                    <span className="k">Monitoring</span>
                                    <span className="v">
                                        {sourceIntel.monitor
                                            ? `${sourceIntel.monitor.status} · every ${sourceIntel.monitor.intervalMinutes} min · last checked ${sourceIntel.monitor.lastCheckedAt ? timeAgo(sourceIntel.monitor.lastCheckedAt) : 'never'}`
                                            : (
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={enableMonitoring}>
                                                    Enable Monitoring
                                                </button>
                                            )}
                                    </span>
                                </div>
                            </div>
                            {/* §22 — monitoring re-correlates already-collected data on the
                                existing scheduler; it never crawls on its own. */}
                            <div className="smi-signal-note">
                                Monitoring re-correlates messages this source has already collected and raises alerts only for
                                genuinely new intelligence. Collection itself stays a manual, bounded action.
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* §36 "TELEGRAM ACTIVITY TIMELINE" — real windows only. */}
            <div className="smi-card">
                <div className="smi-card-title">Activity Timeline</div>
                {!activity ? (
                    <div className="smi-loading">{loading ? 'Loading…' : 'No activity data available.'}</div>
                ) : !activity.hasHistoricalData ? (
                    <div className="smi-empty">
                        No Telegram messages have been collected for this scope yet, so there is no activity history to show.
                    </div>
                ) : (
                    <div className="smi-table-wrap">
                        <table className="smi-table">
                            <thead>
                                <tr><th>Window</th><th>Messages</th><th>New Entities</th><th>Threat Matches</th><th>Alerts</th></tr>
                            </thead>
                            <tbody>
                                {([['Last 24 hours', 'last24h'], ['Last 7 days', 'last7d'], ['Last 30 days', 'last30d']] as const).map(([label, key]) => {
                                    const w = activity.windows[key];
                                    return (
                                        <tr key={key}>
                                            <td data-label="Window">{label}</td>
                                            <td data-label="Messages">{w.messages}</td>
                                            <td data-label="New Entities">{w.newEntities}</td>
                                            <td data-label="Threat Matches">{w.threatMatches}</td>
                                            <td data-label="Alerts">{w.alerts}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §37 "THREAT CONTEXT VIEW". */}
            <div className="smi-card">
                <div className="smi-card-title">Threat Context</div>
                {!threat ? (
                    <div className="smi-loading">{loading ? 'Loading…' : 'No threat context available.'}</div>
                ) : !hasAnyCorrelation ? (
                    <div className="smi-empty">
                        No correlations have been recorded for this scope yet. Analyze collected messages first, then run
                        correlation above.
                    </div>
                ) : (
                    <>
                        <div className="smi-card-subtitle">Known Intelligence Matches</div>
                        <CorrelationRows
                            items={threat.knownIntelligenceMatches}
                            emptyText="No observed value matched a known-risk indicator in existing Threat Intelligence."
                        />

                        <div className="smi-card-subtitle">Observed Indicators</div>
                        <p className="smi-muted">
                            Collected from messages and recorded as observables. No matching Threat Intelligence record exists,
                            so these are not treated as malicious.
                        </p>
                        <CorrelationRows items={threat.observedIndicators} emptyText="No indicators observed." />

                        <div className="smi-card-subtitle">Threat Actors</div>
                        <p className="smi-muted">
                            A name in a message is a reference. It never means this Telegram source is that actor.
                        </p>
                        <CorrelationRows items={threat.threatActors} emptyText="No threat actor references." />

                        <div className="smi-card-subtitle">Malware</div>
                        <CorrelationRows items={threat.malware} emptyText="No malware references." />

                        <div className="smi-card-subtitle">Vulnerabilities</div>
                        <p className="smi-muted">
                            A CVE reference does not imply exploitation. Exploitation context is shown in the evidence column
                            only where existing Vulnerability Intelligence actually records it.
                        </p>
                        <CorrelationRows items={threat.vulnerabilities} emptyText="No CVE references." />

                        <div className="smi-card-subtitle">Companies</div>
                        <CorrelationRows items={threat.companies} emptyText="No company references." />

                        <div className="smi-card-subtitle">Brands</div>
                        <CorrelationRows items={threat.brands} emptyText="No brand references." />

                        <div className="smi-card-subtitle">Potentially Related Activity</div>
                        <p className="smi-muted">
                            An indicator seen across more than one Telegram source. This is a candidate relationship, never a
                            confirmed campaign.
                        </p>
                        <CorrelationRows items={threat.campaignCandidates} emptyText="No indicator was shared across multiple sources." />
                    </>
                )}
            </div>

            {/* §38 "CROSS PLATFORM IDENTITY CONTEXT". */}
            <div className="smi-card">
                <div className="smi-card-title">Cross Platform Identity Context</div>
                <p className="smi-muted">
                    Potential Cross Platform Relationship. A shared handle is a lead, not an identity claim — LekirraX does not
                    assert that these accounts belong to the same person.
                </p>
                <CorrelationRows
                    items={threat?.crossPlatformIdentities || []}
                    emptyText="No Telegram handle matched an account discovered by Social Media Intelligence."
                />
            </div>

            {/* §31/§32 "RISK ASSESSMENT" / "RISK EXPLANATION". */}
            {sid && (
                <div className="smi-card">
                    <div className="smi-card-title">Risk Assessment</div>
                    {!risk ? (
                        <div className="smi-loading">{loading ? 'Loading…' : 'Risk could not be computed for this source.'}</div>
                    ) : (
                        <>
                            <div className="smi-overview-grid">
                                <div className="smi-kv"><span className="k">Risk Level</span><span className="v">{risk.level}</span></div>
                                <div className="smi-kv"><span className="k">Score</span><span className="v">{risk.score}</span></div>
                                <div className="smi-kv"><span className="k">Confidence</span><span className="v"><ConfBadge confidence={risk.confidence} /></span></div>
                            </div>
                            <div className="smi-card-subtitle">Risk Factors</div>
                            {risk.reasons.length === 0 ? (
                                <div className="smi-empty">
                                    No evidence-backed risk factor was found. A Telegram source existing, a malware name being
                                    mentioned, or a CVE appearing does not by itself raise risk.
                                </div>
                            ) : (
                                <ul className="smi-signal-list">
                                    {risk.reasons.map((r, i) => <li key={i}>✓ {r}</li>)}
                                </ul>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* §29 "TIMELINE" — the EXISTING intelligence history store. */}
            <div className="smi-card">
                <div className="smi-card-title">Intelligence Timeline</div>
                {timeline.length === 0 ? (
                    <div className="smi-empty">No Telegram intelligence events have been recorded yet.</div>
                ) : (
                    <div className="smi-table-wrap">
                        <table className="smi-table">
                            <thead><tr><th>When</th><th>Event</th><th>Detail</th><th>Source</th><th>Analyst</th></tr></thead>
                            <tbody>
                                {timeline.map((t) => (
                                    <tr key={t.id}>
                                        <td data-label="When">{t.createdAt ? timeAgo(t.createdAt) : '—'}</td>
                                        <td data-label="Event">{t.action.replace(/_/g, ' ')}</td>
                                        <td data-label="Detail">{t.newValue || '—'}</td>
                                        <td data-label="Source">{t.source}</td>
                                        <td data-label="Analyst">{t.username || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §39/§40 "AI SUMMARY" — Observed / Correlated / Inferred /
                Analyst Assessed / Unknown are kept strictly separate, and the
                model only ever sees evidence LekirraX actually stored. */}
            <div className="smi-card">
                <div className="smi-card-title">AI Summary</div>
                <p className="smi-muted">
                    Summarizes only Telegram intelligence already stored in LekirraX. It cannot introduce an account, message,
                    source, IOC, threat actor, campaign or relationship that is not in the evidence.
                </p>
                <button type="button" className="smi-btn smi-btn--sm" onClick={loadAiSummary} disabled={aiLoading}>
                    {aiLoading ? 'Generating…' : ai ? 'Regenerate Summary' : 'Generate Summary'}
                </button>
                {ai && (
                    <>
                        <div className="smi-card-subtitle">Executive Summary</div>
                        <p>{ai.executiveSummary}</p>
                        {ai.note && <div className="smi-signal-note">{ai.note}</div>}
                        {([
                            ['Observed', ai.observed, 'Directly collected or extracted by LekirraX.'],
                            ['Correlated', ai.correlated, 'Produced by the correlation engine against existing intelligence.'],
                            ['Inferred', ai.inferred, 'Model interpretation. Not a new fact.'],
                            ['Analyst Assessed', ai.analystAssessed, 'Recorded analyst judgement.'],
                            ['Unknown', ai.unknown, 'What the evidence does not establish.'],
                            ['Threat Context', ai.threatContext, 'Real matches against existing Threat Intelligence.'],
                            ['Risk Factors', ai.riskFactors, 'Evidence-backed factors only.'],
                            ['Recommended Actions', ai.recommendedActions, 'Suggested analyst next steps.']
                        ] as const).map(([label, items, hint]) => (
                            <React.Fragment key={label}>
                                <div className="smi-card-subtitle">{label}</div>
                                <p className="smi-muted">{hint}</p>
                                {items.length === 0 ? (
                                    <div className="smi-empty">Nothing in this category.</div>
                                ) : (
                                    <ul className="smi-signal-list">{items.map((s, i) => <li key={i}>{s}</li>)}</ul>
                                )}
                            </React.Fragment>
                        ))}
                    </>
                )}
            </div>
        </>
    );
};

export default TelegramThreatContextPane;
