import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    getAptGroups, getAptGroupDashboard, getAptGroup, createAptGroup, updateAptGroupAttribution,
    addAptGroupAlias, removeAptGroupAlias, getAptGroupTimeline, getAptGroupRelatedAlerts, generateAptGroupAiSummary,
    getEvidence, addEvidence, deleteEvidence,
    searchAptGroups, getAptGroupActivity, createAptGroupMonitor, generateAptChangeSummary,
    getMonitors, getMonitorEvents, updateMonitor, checkMonitorNow,
    updateMonitorThresholds, testMonitorThresholds, getAptActivityDigest, getAptLeaderboard, getAptAttributionConflicts,
    getAptCrossCorrelation, generateAptCrossSummary, getAptAttackAnalytics, generateAptAttackSummary,
    getAptRiskEvolution, getAptAttributionEvolution, getAptEvidenceGaps, getAptGroupScorecard, generateAptExecutiveSummary,
    getCampaignEvolution,
    type ThreatActor, type ThreatActorDetail, type AptGroupDashboard, type AptGroupTimelineItem,
    type AptGroupRelatedAlert, type AptGroupAiSummary, type EvidenceItem, type EntityRelationship,
    type AptGroupSearchResultItem, type AptGroupActivityItem, type AptChangeSummary, type Monitor, type MonitorEvent,
    type MonitorThreshold, type ThresholdTestResult, type AptActivityDigest, type AptLeaderboardItem, type AptAttributionConflict,
    type AptCrossCorrelationItem, type AptAttackAnalytics, type AptRiskEvolution, type AptAttributionEvolutionEntry,
    type AptEvidenceGaps, type AptGroupScorecard, type CampaignEvolution
} from '../../../services/api';
import { RiskBadge, ConfidenceBadge, formatDate, formatDateTime, EntityChip, InvestigateButton } from '../ThreatIntelligenceShared';
import RiskAssessmentBlock from './RiskAssessmentBlock';
import KnowledgeContextPanel from '../../KnowledgeBase/KnowledgeContextPanel';
import Pagination from '../../../components/shared/Pagination';  // P2-8

const ATTRIBUTION_CONFIDENCE_OPTIONS = ['Confirmed', 'Strongly Supported', 'Likely', 'Possible', 'Unconfirmed', 'Disputed'];

const inputStyle: React.CSSProperties = { background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 8px', fontSize: '0.85rem', fontFamily: 'inherit' };

export function hedgedRelationshipLabel(entityType: string, basis: string): string {
    switch (entityType) {
        case 'campaign': return 'Associated Campaign';
        case 'malware': return 'Associated Malware';
        case 'vulnerability': return 'Associated Vulnerability';
        case 'attack_technique': return 'Reported';
        case 'ioc': return 'Associated Indicator';
        case 'telegram_source': return basis === 'observed' ? 'Observed Telegram Relationship' : 'Potential Telegram Relationship';
        case 'social_account': return basis === 'observed' ? 'Observed Social Relationship' : 'Potential Social Relationship';
        case 'company': case 'brand': return basis === 'observed' ? 'Observed Relationship' : 'Potential Relationship';
        default: return basis === 'observed' ? 'Observed Relationship' : 'Potential Relationship';
    }
}

const INFRA_IOC_TYPES = new Set(['domain', 'ipv4', 'ipv6', 'url']);

const RelationshipRows: React.FC<{ rows: EntityRelationship[]; onOpenEntity?: (type: string, id: string) => void }> = ({ rows, onOpenEntity }) => (
    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
        {rows.map((r) => (
            <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap' }}>
                <span className="ti-note" style={{ minWidth: '170px' }}>{hedgedRelationshipLabel(r.entity.type, r.basis)}</span>
                <EntityChip entity={r.entity} onOpen={onOpenEntity} />
                {r.entity.meta?.type != null && <span className="ti-note">({String(r.entity.meta.type)})</span>}
                <ConfidenceBadge confidence={r.confidence} />
                <span className="ti-note">via {r.source}</span>
                <span className="ti-note" style={{ marginLeft: 'auto' }}>{formatDateTime(r.updated_at)}</span>
            </div>
        ))}
    </div>
);

const AliasesBlock: React.FC<{ actor: ThreatActorDetail; canEdit: boolean; onChanged: () => void }> = ({ actor, canEdit, onChanged }) => {
    const [newAlias, setNewAlias] = useState('');
    const [busy, setBusy] = useState(false);
    const records = actor.aliasRecords || [];

    const add = async () => {
        if (!newAlias.trim()) return;
        setBusy(true);
        try { await addAptGroupAlias(actor.id, newAlias.trim()); setNewAlias(''); onChanged(); } finally { setBusy(false); }
    };
    const remove = async (aliasId: number) => {
        setBusy(true);
        try { await removeAptGroupAlias(actor.id, aliasId); onChanged(); } finally { setBusy(false); }
    };

    return (
        <div>
            {records.length === 0 ? <div className="ti-empty">No known aliases.</div> : (
                <div className="ti-chip-list">
                    {records.map((a) => (
                        <span key={a.id} className="ti-chip" style={{ cursor: 'default', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                            {a.alias}
                            {canEdit && <button type="button" onClick={() => remove(a.id)} disabled={busy} aria-label={`Remove alias ${a.alias}`} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>×</button>}
                        </span>
                    ))}
                </div>
            )}
            {canEdit && (
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input type="text" placeholder="Add alias…" value={newAlias} onChange={(e) => setNewAlias(e.target.value)} style={{ ...inputStyle, minWidth: '200px' }} />
                    <button type="button" className="ti-action-btn" onClick={add} disabled={busy || !newAlias.trim()}>{busy ? 'Saving…' : 'Add Alias'}</button>
                </div>
            )}
            {/* §36 "DATA INTEGRITY" — do not merge similarly-named identities without evidence. */}
            <div className="ti-note" style={{ marginTop: '8px' }}>Aliases are recorded evidence of naming overlap, not proof two names are the same operation unless the analyst has separately confirmed it.</div>
        </div>
    );
};

const AttributionBlock: React.FC<{ actor: ThreatActorDetail; canEdit: boolean; onChanged: () => void }> = ({ actor, canEdit, onChanged }) => {
    const [editing, setEditing] = useState(false);
    const [form, setForm] = useState({
        attributionCountry: actor.attribution?.country || '', attributionConfidence: actor.attribution?.confidence || '', attributionReasoning: actor.attribution?.reasoning || ''
    });
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        setForm({ attributionCountry: actor.attribution?.country || '', attributionConfidence: actor.attribution?.confidence || '', attributionReasoning: actor.attribution?.reasoning || '' });
    }, [actor.id, actor.attribution?.country, actor.attribution?.confidence, actor.attribution?.reasoning]);

    const save = async () => {
        setSaving(true);
        try {
            await updateAptGroupAttribution(actor.id, {
                attributionCountry: form.attributionCountry || null,
                attributionConfidence: (form.attributionConfidence || null) as any,
                attributionReasoning: form.attributionReasoning || null
            });
            setEditing(false);
            onChanged();
        } finally { setSaving(false); }
    };

    const unclassify = async () => {
        setSaving(true);
        try { await updateAptGroupAttribution(actor.id, { isAptGroup: false }); onChanged(); } finally { setSaving(false); }
    };

    const isDisputed = actor.attribution?.confidence === 'Disputed';
    const isUnconfirmed = !actor.attribution?.confidence || actor.attribution.confidence === 'Unconfirmed';

    return (
        <div>
            {!editing ? (
                <>
                    <div className="ti-kv">
                        <span className="k">Attribution</span><span className="v">{actor.attribution?.country || 'Unknown'}</span>
                        <span className="k">Attribution Confidence</span><span className="v">{actor.attribution?.confidence || 'Unconfirmed'}{isDisputed && <span className="ti-note"> — do not choose one side.</span>}</span>
                        <span className="k">Reasoning</span><span className="v">{actor.attribution?.reasoning || 'Not Available'}</span>
                        <span className="k">Last Updated</span><span className="v">{formatDateTime(actor.attribution?.updated_at)}</span>
                    </div>
                    {isUnconfirmed && <div className="ti-note" style={{ marginTop: '4px' }}>Attribution is unconfirmed / incomplete — do not treat as a confirmed source country.</div>}
                    {canEdit && (
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button type="button" className="ti-action-btn" onClick={() => setEditing(true)}>Edit Attribution</button>
                            {actor.is_apt_group && <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={unclassify} disabled={saving}>Remove APT Classification</button>}
                        </div>
                    )}
                </>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxWidth: '480px' }}>
                    <label className="ti-note">Attribution (Country / Organization — leave blank if Unknown)
                        <input type="text" value={form.attributionCountry} onChange={(e) => setForm((f) => ({ ...f, attributionCountry: e.target.value }))} style={{ ...inputStyle, width: '100%', marginTop: '4px' }} />
                    </label>
                    <label className="ti-note">Attribution Confidence
                        <select value={form.attributionConfidence} onChange={(e) => setForm((f) => ({ ...f, attributionConfidence: e.target.value }))} style={{ width: '100%', marginTop: '4px' }}>
                            <option value="">Unconfirmed</option>
                            {ATTRIBUTION_CONFIDENCE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </label>
                    <label className="ti-note">Reasoning / Evidence
                        <textarea rows={3} value={form.attributionReasoning} onChange={(e) => setForm((f) => ({ ...f, attributionReasoning: e.target.value }))} style={{ ...inputStyle, width: '100%', marginTop: '4px' }} placeholder="e.g. Multiple public intelligence sources associate this activity with…" />
                    </label>
                    <div className="ti-note">§9 — do not base attribution solely on language, timezone, target geography, malware naming, or infrastructure location; these are signals, not standalone proof.</div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button type="button" className="ti-action-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Attribution'}</button>
                        <button type="button" className="ti-action-btn" onClick={() => setEditing(false)} disabled={saving}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const TimelineBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [items, setItems] = useState<AptGroupTimelineItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        setLoading(true);
        getAptGroupTimeline(actorId, { pageSize: 30 }).then((r) => setItems(r.items)).finally(() => setLoading(false));
    }, [actorId]);
    if (loading) return <div className="ti-loading">Loading timeline…</div>;
    if (items.length === 0) return <div className="ti-empty">No timeline events recorded yet.</div>;
    return (
        <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {items.map((t) => (
                <div key={t.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div><strong style={{ textTransform: 'capitalize' }}>{t.action.replace(/_/g, ' ')}</strong> <span className="ti-note">{formatDateTime(t.createdAt)}{t.username ? ` · ${t.username}` : ''}</span></div>
                    {t.newValue && <div className="ti-note">{t.previousValue ? `${t.previousValue} → ` : ''}{t.newValue}</div>}
                </div>
            ))}
        </div>
    );
};

const EvidenceBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [items, setItems] = useState<EvidenceItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAdd, setShowAdd] = useState(false);
    const [form, setForm] = useState({ source: '', url: '', description: '', confidence: '' });
    const [saving, setSaving] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        getEvidence('threat_actor', actorId).then(setItems).finally(() => setLoading(false));
    }, [actorId]);
    useEffect(() => { load(); }, [load]);

    const submit = async () => {
        if (!form.source.trim()) return;
        setSaving(true);
        try {
            await addEvidence({ entityType: 'threat_actor', entityId: actorId, source: form.source.trim(), url: form.url.trim() || undefined, description: form.description.trim() || undefined, confidence: form.confidence || undefined });
            setForm({ source: '', url: '', description: '', confidence: '' });
            setShowAdd(false);
            load();
        } finally { setSaving(false); }
    };
    const remove = async (id: number) => { await deleteEvidence(id); load(); };

    return (
        <div>
            <button type="button" className="ti-action-btn" style={{ marginBottom: '10px' }} onClick={() => setShowAdd((v) => !v)}>+ Add Evidence</button>
            {showAdd && (
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <input type="text" placeholder="Evidence source (e.g. Official Advisory, Security Vendor)…" value={form.source} onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))} style={{ ...inputStyle, minWidth: '240px' }} />
                    <input type="text" placeholder="Reference URL (optional)…" value={form.url} onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))} style={{ ...inputStyle, minWidth: '220px' }} />
                    <input type="text" placeholder="Description (optional)…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minWidth: '220px' }} />
                    <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value }))}>
                        <option value="">Confidence…</option><option>Low</option><option>Medium</option><option>High</option>
                    </select>
                    <button type="button" className="ti-action-btn" onClick={submit} disabled={saving || !form.source.trim()}>{saving ? 'Saving…' : 'Save'}</button>
                </div>
            )}
            {loading ? <div className="ti-loading">Loading…</div> : items.length === 0 ? <div className="ti-empty">No evidence attached yet.</div> : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {items.map((e) => (
                        <div key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                            <div style={{ flex: 1 }}>
                                <div><strong>{e.source}</strong> {e.confidence && <ConfidenceBadge confidence={e.confidence} />}</div>
                                {e.url && <div><a href={e.url} target="_blank" rel="noreferrer" className="ti-note">{e.url}</a></div>}
                                {e.description && <div className="ti-note">{e.description}</div>}
                                <div className="ti-note">{formatDateTime(e.created_at)}{e.username ? ` · ${e.username}` : ''}</div>
                            </div>
                            <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => remove(e.id)}>Remove</button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

// §35 "ALERTS" (partial) — read-only reference; never created here.
const RelatedAlertsBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [alerts, setAlerts] = useState<AptGroupRelatedAlert[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { setLoading(true); getAptGroupRelatedAlerts(actorId).then(setAlerts).finally(() => setLoading(false)); }, [actorId]);
    if (loading) return null;
    if (alerts.length === 0) return null;
    return (
        <div>
            <div className="ti-modal-subtitle">Related Alerts ({alerts.length})</div>
            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                {alerts.map((a) => (
                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                        <RiskBadge risk={a.severity} /><span>{a.title}</span><span className="ti-note" style={{ marginLeft: 'auto' }}>{formatDateTime(a.createdAt)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// §30/§31 "AI SUMMARY" / "AI ATTRIBUTION SAFETY".
const AiSummaryBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [summary, setSummary] = useState<AptGroupAiSummary | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setBusy(true); setError(null);
        try { setSummary(await generateAptGroupAiSummary(actorId)); }
        catch (err: any) { setError(err?.message || 'Failed to generate AI summary'); }
        finally { setBusy(false); }
    };

    return (
        <div>
            <button type="button" className="ti-action-btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : summary ? 'Regenerate AI Summary' : 'Generate AI Summary'}</button>
            {error && <div className="ti-error" style={{ marginTop: '8px' }}>{error}</div>}
            {summary && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px' }}>
                    <div><strong>Profile</strong><div className="ti-note">{summary.profileSummary}</div></div>
                    <div><strong>Attribution</strong><div className="ti-note">{summary.attributionSummary}</div></div>
                    <div><strong>Campaigns</strong><div className="ti-note">{summary.campaignSummary}</div></div>
                    <div><strong>Malware</strong><div className="ti-note">{summary.malwareSummary}</div></div>
                    <div><strong>TTPs</strong><div className="ti-note">{summary.ttpSummary}</div></div>
                    <div><strong>Vulnerabilities</strong><div className="ti-note">{summary.vulnSummary}</div></div>
                    <div><strong>IOCs</strong><div className="ti-note">{summary.iocSummary}</div></div>
                    <div><strong>Timeline</strong><div className="ti-note">{summary.timelineSummary}</div></div>
                    <div><strong>Risk</strong><div className="ti-note">{summary.riskSummary}</div></div>
                    <div className="ti-note" style={{ fontStyle: 'italic' }}>{summary.note}</div>
                </div>
            )}
        </div>
    );
};

const MonitoringBlock: React.FC<{ actorId: number; actorName: string; canMonitor: boolean; onInvestigate?: (target: string, tab?: string) => void }> = ({ actorId, actorName, canMonitor, onInvestigate }) => {
    const [monitor, setMonitor] = useState<Monitor | null | undefined>(undefined);
    const [events, setEvents] = useState<MonitorEvent[]>([]);
    const [creating, setCreating] = useState(false);
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showEvents, setShowEvents] = useState(false);
    const [showThresholds, setShowThresholds] = useState(false);

    const load = useCallback(() => {
        getMonitors({ type: 'threat_actor', pageSize: 100 }).then((res) => {
            const m = res.items.find((x) => x.target === String(actorId)) || null;
            setMonitor(m);
            if (m) getMonitorEvents(m.id, { pageSize: 20 }).then((r) => setEvents(r.items)).catch(() => {});
            else setEvents([]);
        }).catch(() => setMonitor(null));
    }, [actorId]);
    useEffect(() => { load(); }, [load]);

    const createIt = async () => {
        setCreating(true); setError(null);
        try { await createAptGroupMonitor(actorId); load(); }
        catch (err: any) { setError(err?.message || 'Failed to create monitor'); }
        finally { setCreating(false); }
    };
    const togglePause = async () => {
        if (!monitor) return;
        await updateMonitor(monitor.id, { status: monitor.status === 'active' ? 'paused' : 'active' });
        load();
    };
    const runCheck = async () => {
        if (!monitor) return;
        setChecking(true);
        try { await checkMonitorNow(monitor.id); } finally { setChecking(false); load(); }
    };

    if (monitor === undefined) return <div className="ti-loading">Loading monitoring status…</div>;

    if (!monitor) {
        return (
            <div>
                <div className="ti-empty">Not currently monitored.</div>
                {canMonitor ? (
                    <div style={{ marginTop: '8px' }}>
                        <button type="button" className="ti-action-btn" onClick={createIt} disabled={creating}>{creating ? 'Enabling…' : 'Monitor APT Group'}</button>
                        {error && <div className="ti-error" style={{ marginTop: '6px' }}>{error}</div>}
                    </div>
                ) : (
                    <div className="ti-note" style={{ marginTop: '6px' }}>Monitoring requires the apt_intel.monitor permission.</div>
                )}
            </div>
        );
    }

    return (
        <div>
            <div className="ti-kv">
                <span className="k">Status</span><span className="v">{monitor.status === 'active' ? 'Enabled' : 'Paused'}</span>
                <span className="k">Last Check</span><span className="v">{formatDateTime(monitor.last_checked_at)}</span>
                <span className="k">Last Event</span><span className="v">{events[0]?.summary || 'None yet'}</span>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', flexWrap: 'wrap' }}>
                <button type="button" className="ti-action-btn" onClick={togglePause}>{monitor.status === 'active' ? 'Pause Monitoring' : 'Resume Monitoring'}</button>
                <button type="button" className="ti-action-btn" onClick={runCheck} disabled={checking}>{checking ? 'Checking…' : 'Run Check'}</button>
                <button type="button" className="ti-action-btn" onClick={() => setShowEvents((v) => !v)}>{showEvents ? 'Hide Events' : 'View Events'}</button>
                {canMonitor && <button type="button" className="ti-action-btn" onClick={() => setShowThresholds((v) => !v)}>{showThresholds ? 'Hide Thresholds' : 'Configure Thresholds'}</button>}
            </div>
            {showEvents && (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none', marginTop: '10px' }}>
                    {events.length === 0 ? <div className="ti-empty">No events recorded yet.</div> : events.map((e) => (
                        <div key={e.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)', flexWrap: 'wrap' }}>
                            <span className={`ti-badge ti-badge--${e.severity}`}>{e.severity}</span>
                            <span style={{ flex: 1 }}>{e.summary}</span>
                            <span className="ti-note">{formatDateTime(e.created_at)}</span>
                            <InvestigateButton target={actorName} onInvestigate={onInvestigate} />
                        </div>
                    ))}
                </div>
            )}
            {showThresholds && <ThresholdConfigBlock monitor={monitor} onChanged={load} />}
        </div>
    );
};

const THRESHOLD_CONDITIONS: MonitorThreshold['condition'][] = ['risk_level', 'new_campaign_count', 'new_ioc_count', 'new_malware_count', 'new_ttp_count', 'new_vulnerability_count', 'new_infrastructure_count'];
const THRESHOLD_CONDITION_LABELS: Record<string, string> = {
    risk_level: 'Risk', new_campaign_count: 'New Campaigns', new_ioc_count: 'New IOCs', new_malware_count: 'New Malware',
    new_ttp_count: 'New TTPs', new_vulnerability_count: 'New Vulnerabilities', new_infrastructure_count: 'New Infrastructure'
};

const ThresholdConfigBlock: React.FC<{ monitor: Monitor; onChanged: () => void }> = ({ monitor, onChanged }) => {
    const [thresholds, setThresholds] = useState<MonitorThreshold[]>(monitor.config_json?.thresholds || []);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [testResult, setTestResult] = useState<ThresholdTestResult | null>(null);
    const [testing, setTesting] = useState(false);

    useEffect(() => { setThresholds(monitor.config_json?.thresholds || []); }, [monitor.id, monitor.config_json]);

    const addRow = () => setThresholds((t) => [...t, { condition: 'new_ioc_count', operator: '>=', value: 10, severity: 'high', enabled: true }]);
    const removeRow = (i: number) => setThresholds((t) => t.filter((_, idx) => idx !== i));
    const updateRow = (i: number, patch: Partial<MonitorThreshold>) => setThresholds((t) => t.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));

    const save = async () => {
        setSaving(true); setError(null);
        try { await updateMonitorThresholds(monitor.id, thresholds); onChanged(); }
        catch (err: any) { setError(err?.message || 'Failed to save thresholds'); }
        finally { setSaving(false); }
    };
    const test = async () => {
        setTesting(true); setTestResult(null);
        try { setTestResult(await testMonitorThresholds(monitor.id)); }
        catch (err: any) { setError(err?.message || 'Failed to test thresholds'); }
        finally { setTesting(false); }
    };

    return (
        <div style={{ marginTop: '10px', padding: '10px', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)' }}>
            <div className="ti-note" style={{ marginBottom: '8px' }}>
                Existing monitors work unchanged with no thresholds configured — the default Phase 2 alert rules still apply. Custom thresholds add ONE additional combined alert when any enabled condition is met.
            </div>
            {thresholds.length === 0 ? <div className="ti-empty">No custom thresholds configured.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {thresholds.map((t, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <select value={t.condition} onChange={(e) => updateRow(i, { condition: e.target.value as MonitorThreshold['condition'] })}>
                                {THRESHOLD_CONDITIONS.map((c) => <option key={c} value={c}>{THRESHOLD_CONDITION_LABELS[c]}</option>)}
                            </select>
                            <select value={t.operator} onChange={(e) => updateRow(i, { operator: e.target.value as MonitorThreshold['operator'] })}>
                                <option value=">=">≥</option><option value=">">&gt;</option><option value="==">=</option>
                            </select>
                            {t.condition === 'risk_level' ? (
                                <select value={String(t.value)} onChange={(e) => updateRow(i, { value: e.target.value })}>
                                    <option value="Low">Low</option><option value="Medium">Medium</option><option value="High">High</option><option value="Critical">Critical</option>
                                </select>
                            ) : (
                                <input type="number" min={0} value={Number(t.value)} onChange={(e) => updateRow(i, { value: Math.max(0, Number(e.target.value) || 0) })} style={{ ...inputStyle, width: '70px' }} />
                            )}
                            <select value={t.severity} onChange={(e) => updateRow(i, { severity: e.target.value as MonitorThreshold['severity'] })}>
                                <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option>
                            </select>
                            <label className="ti-note" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <input type="checkbox" checked={t.enabled} onChange={(e) => updateRow(i, { enabled: e.target.checked })} /> Enabled
                            </label>
                            <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={() => removeRow(i)}>Remove</button>
                        </div>
                    ))}
                </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={addRow}>+ Add Threshold</button>
                <button type="button" className="ti-action-btn" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Thresholds'}</button>
                <button type="button" className="ti-action-btn" onClick={test} disabled={testing}>{testing ? 'Testing…' : 'Test Thresholds'}</button>
            </div>
            {error && <div className="ti-error" style={{ marginTop: '8px' }}>{error}</div>}
            {testResult && (
                <div style={{ marginTop: '10px' }}>
                    <div className="ti-note">Threshold Test — read-only, no alert created.</div>
                    {!testResult.results?.length ? <div className="ti-empty">No thresholds configured to test.</div> : (
                        <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                            {testResult.results.map((r, i) => (
                                <div key={i} style={{ padding: '4px 0', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <span>{THRESHOLD_CONDITION_LABELS[r.condition]} {r.operator} {String(r.value)}</span>
                                    <span className="ti-note">(actual: {String(r.actualValue)})</span>
                                    <span className={`ti-badge ti-badge--${r.wouldTrigger ? r.severity : 'none'}`}>{r.wouldTrigger ? `Would Trigger ${r.severity.toUpperCase()}` : 'Would NOT Trigger'}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

const ChangeSummaryBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [summary, setSummary] = useState<AptChangeSummary | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setBusy(true); setError(null);
        try { setSummary(await generateAptChangeSummary(actorId)); }
        catch (err: any) { setError(err?.message || 'Failed to generate change summary'); }
        finally { setBusy(false); }
    };

    return (
        <div style={{ marginTop: '14px' }}>
            <button type="button" className="ti-action-btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate APT Change Summary'}</button>
            {error && <div className="ti-error" style={{ marginTop: '8px' }}>{error}</div>}
            {summary && (
                <div style={{ marginTop: '10px' }}>
                    <div>{summary.changeSummary}</div>
                    <div className="ti-note" style={{ marginTop: '6px' }}>Confidence: {summary.confidence} · Evidence: {summary.evidenceNote}</div>
                    <div className="ti-note" style={{ fontStyle: 'italic', marginTop: '4px' }}>{summary.note}</div>
                </div>
            )}
        </div>
    );
};

const ScorecardBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [card, setCard] = useState<AptGroupScorecard | null>(null);
    useEffect(() => { getAptGroupScorecard(actorId).then(setCard).catch(() => setCard(null)); }, [actorId]);
    if (!card) return <div className="ti-loading">Loading scorecard…</div>;
    const tiles: [string, React.ReactNode][] = [
        ['Risk', <RiskBadge key="r" risk={card.risk} />], ['Active Campaigns', card.activeCampaigns],
        ['New IOCs (7d)', card.newIOCs], ['New Malware (7d)', card.newMalware], ['New Techniques (7d)', card.newTechniques],
        ['Recent Alerts (7d)', card.recentAlerts], ['Last Activity', card.lastActivity ? formatDateTime(card.lastActivity) : 'Unknown']
    ];
    return (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
            {tiles.map(([label, value]) => (
                <div key={label} style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', padding: '10px', textAlign: 'center' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{value}</div>
                    <div className="ti-note" style={{ marginTop: '4px' }}>{label}</div>
                </div>
            ))}
        </div>
    );
};

const ExecutiveSummaryBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [summary, setSummary] = useState<{ executiveSummary: string; evidenceGapsSummary: string; note: string } | null>(null);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const generate = async () => {
        setBusy(true); setError(null);
        try { setSummary(await generateAptExecutiveSummary(actorId)); }
        catch (err: any) { setError(err?.message || 'Failed to generate executive summary'); }
        finally { setBusy(false); }
    };
    return (
        <div>
            <button type="button" className="ti-action-btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate Executive Summary'}</button>
            {error && <div className="ti-error" style={{ marginTop: '8px' }}>{error}</div>}
            {summary && (
                <div style={{ marginTop: '10px' }}>
                    <div>{summary.executiveSummary}</div>
                    <div className="ti-note" style={{ marginTop: '6px' }}>{summary.evidenceGapsSummary}</div>
                    <div className="ti-note" style={{ fontStyle: 'italic', marginTop: '4px' }}>{summary.note}</div>
                </div>
            )}
        </div>
    );
};

const AttackAnalyticsBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [data, setData] = useState<AptAttackAnalytics | null>(null);
    const [summary, setSummary] = useState<{ attackSummary: string; note: string } | null>(null);
    const [busy, setBusy] = useState(false);
    useEffect(() => { getAptAttackAnalytics(actorId).then(setData).catch(() => setData(null)); }, [actorId]);
    const generate = async () => {
        setBusy(true);
        try { setSummary(await generateAptAttackSummary(actorId)); } finally { setBusy(false); }
    };
    if (!data) return <div className="ti-loading">Loading ATT&amp;CK analytics…</div>;
    if (data.techniques.length === 0) return <div className="ti-empty">No documented MITRE ATT&amp;CK technique relationships.</div>;
    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '6px' }}>Tactic coverage — number of documented technique relationships per tactic (not operational capability).</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
                {data.tacticCoverage.map((t) => (
                    <div key={t.tactic} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ minWidth: '160px', fontSize: '0.82rem' }}>{t.tactic}</span>
                        <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.06)', borderRadius: '4px', overflow: 'hidden' }}>
                            <div style={{ width: `${Math.min(100, t.percentage)}%`, height: '100%', background: 'rgba(0,229,255,0.7)' }} />
                        </div>
                        <span className="ti-note" style={{ minWidth: '90px' }}>{t.observedCount}/{t.totalTechniquesInTactic} ({t.percentage}%)</span>
                    </div>
                ))}
            </div>
            {data.newTechniques.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <div className="ti-note"><strong>Recently documented:</strong></div>
                    {data.newTechniques.map((t, i) => <div key={i} className="ti-note">{t.summary} — {formatDateTime(t.observedAt)}</div>)}
                </div>
            )}
            {data.mostFrequentAcrossAllApt.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                    <div className="ti-note"><strong>Most frequently associated across all APT groups:</strong> {data.mostFrequentAcrossAllApt.slice(0, 5).map((t) => `${t.techniqueId} (${t.actorCount})`).join(', ')}</div>
                </div>
            )}
            <button type="button" className="ti-action-btn" onClick={generate} disabled={busy}>{busy ? 'Generating…' : 'Generate ATT&CK AI Summary'}</button>
            {summary && (
                <div style={{ marginTop: '8px' }}>
                    <div>{summary.attackSummary}</div>
                    <div className="ti-note" style={{ fontStyle: 'italic', marginTop: '4px' }}>{summary.note}</div>
                </div>
            )}
        </div>
    );
};

// §24 "RISK EVOLUTION" — computeEntityRisk (current) + real recorded history, no second risk score.
const RiskEvolutionBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [data, setData] = useState<AptRiskEvolution | null>(null);
    useEffect(() => { getAptRiskEvolution(actorId).then(setData).catch(() => setData(null)); }, [actorId]);
    if (!data) return <div className="ti-loading">Loading risk evolution…</div>;
    return (
        <div>
            {data.current && (
                <div className="ti-kv">
                    <span className="k">Current Risk</span><span className="v"><RiskBadge risk={data.current.level} /> (score {data.current.score}/100)</span>
                </div>
            )}
            {data.current?.reasons?.length ? <ul className="ti-list">{data.current.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul> : null}
            <div className="ti-note" style={{ margin: '8px 0 4px' }}>History (from recorded risk changes):</div>
            {data.history.length === 0 ? <div className="ti-empty">No recorded risk changes yet.</div> : (
                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                    {data.history.map((h, i) => <div key={i} style={{ padding: '4px 0' }}>{h.summary} <span className="ti-note">— {formatDateTime(h.changedAt)}</span></div>)}
                </div>
            )}
        </div>
    );
};

// §25 "ATTRIBUTION EVOLUTION" — analyst-controlled chain; AI may summarize, never decide.
const AttributionEvolutionBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [history, setHistory] = useState<AptAttributionEvolutionEntry[] | null>(null);
    useEffect(() => { getAptAttributionEvolution(actorId).then((r) => setHistory(r.history)).catch(() => setHistory([])); }, [actorId]);
    if (!history) return <div className="ti-loading">Loading attribution evolution…</div>;
    if (history.length === 0) return <div className="ti-empty">No recorded attribution changes yet.</div>;
    return (
        <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {history.map((h, i) => (
                <div key={i} style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div>{h.summary}</div>
                    <div className="ti-note">Changed by: {h.changedBy} · {formatDateTime(h.changedAt)}</div>
                </div>
            ))}
        </div>
    );
};

// §27 "EVIDENCE GAPS" — real, grounded gap checks, never fabricated.
const EvidenceGapsBlock: React.FC<{ actorId: number }> = ({ actorId }) => {
    const [data, setData] = useState<AptEvidenceGaps | null>(null);
    useEffect(() => { getAptEvidenceGaps(actorId).then(setData).catch(() => setData(null)); }, [actorId]);
    if (!data) return <div className="ti-loading">Loading evidence gaps…</div>;
    if (data.gaps.length === 0) return <div className="ti-empty">No significant evidence gaps identified.</div>;
    return (
        <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {data.gaps.map((g, i) => (
                <div key={i} style={{ padding: '5px 0', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                    <span className="ti-badge ti-badge--medium">Evidence Gap</span>
                    <span>{g.description}</span>
                </div>
            ))}
        </div>
    );
};

// §12/§13/§32 "MULTI-APT CORRELATION" / "AI CROSS-APT SUMMARY" — CASE 3,
// always "Potential Cross-APT Relationship", never "Confirmed Common Actor".
const CrossCorrelationBlock: React.FC<{ actorId: number; actorName: string }> = ({ actorId, actorName }) => {
    const [items, setItems] = useState<AptCrossCorrelationItem[] | null>(null);
    const [summaries, setSummaries] = useState<Record<number, string>>({});
    const [busyId, setBusyId] = useState<number | null>(null);
    useEffect(() => { getAptCrossCorrelation(actorId).then((r) => setItems(r.items)).catch(() => setItems([])); }, [actorId]);

    const generateFor = async (otherId: number) => {
        setBusyId(otherId);
        try { const r = await generateAptCrossSummary(actorId, otherId); setSummaries((s) => ({ ...s, [otherId]: r.crossAptSummary })); }
        finally { setBusyId(null); }
    };

    if (!items) return <div className="ti-loading">Loading cross-APT correlation…</div>;
    if (items.length === 0) return <div className="ti-empty">No shared signals with other APT groups.</div>;
    return (
        <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
            {items.map((i) => (
                <div key={i.otherActorId} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong>{actorName} ↔ {i.otherActorName}</strong>
                        <ConfidenceBadge confidence={i.confidence} />
                    </div>
                    <div className="ti-note" style={{ marginTop: '4px' }}>{i.signals.map((s) => `${s.label} (${s.count})`).join(', ')}</div>
                    <div className="ti-note" style={{ marginTop: '2px' }}>{i.note}</div>
                    <button type="button" className="ti-action-btn" style={{ marginTop: '6px' }} onClick={() => generateFor(i.otherActorId)} disabled={busyId === i.otherActorId}>
                        {busyId === i.otherActorId ? 'Generating…' : 'Generate AI Summary'}
                    </button>
                    {summaries[i.otherActorId] && <div className="ti-note" style={{ marginTop: '6px' }}>{summaries[i.otherActorId]}</div>}
                </div>
            ))}
        </div>
    );
};

// §14-16 "CAMPAIGN EVOLUTION" — Current vs Previous state, real timestamps only.
const CampaignEvolutionRow: React.FC<{ campaignId: number; campaignName: string }> = ({ campaignId, campaignName }) => {
    const [open, setOpen] = useState(false);
    const [data, setData] = useState<CampaignEvolution | null>(null);
    const [loading, setLoading] = useState(false);
    const toggle = () => {
        setOpen((v) => !v);
        if (!data && !open) { setLoading(true); getCampaignEvolution(campaignId).then(setData).catch(() => {}).finally(() => setLoading(false)); }
    };
    return (
        <div style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <button type="button" className="ti-action-btn" onClick={toggle}>{open ? 'Hide' : 'View'} Evolution — {campaignName}</button>
            {open && (loading || !data ? <div className="ti-loading">Loading…</div> : (
                <div style={{ marginTop: '8px' }}>
                    <div className="ti-note">Since {data.sinceDays} days ago:</div>
                    <div className="ti-kv">
                        <span className="k">Domains</span><span className="v">{data.previous.domains} → {data.current.domains} ({data.change.domains >= 0 ? '+' : ''}{data.change.domains})</span>
                        <span className="k">IPs</span><span className="v">{data.previous.ips} → {data.current.ips} ({data.change.ips >= 0 ? '+' : ''}{data.change.ips})</span>
                        <span className="k">Other IOCs</span><span className="v">{data.previous.otherIocs} → {data.current.otherIocs} ({data.change.otherIocs >= 0 ? '+' : ''}{data.change.otherIocs})</span>
                        <span className="k">Techniques</span><span className="v">{data.previous.techniques} → {data.current.techniques} ({data.change.techniques >= 0 ? '+' : ''}{data.change.techniques})</span>
                    </div>
                    {data.risk.current && <div className="ti-note" style={{ marginTop: '6px' }}>Current risk: {data.risk.current.level} (score {data.risk.current.score}/100)</div>}
                    {data.risk.history.length > 0 && <div className="ti-note">Risk history: {data.risk.history.map((h) => h.summary).join('; ')}</div>}
                    {data.timeline.length > 0 && (
                        <div style={{ marginTop: '6px' }}>
                            <div className="ti-note"><strong>Timeline:</strong></div>
                            {data.timeline.map((t) => <div key={t.id} className="ti-note">{formatDate(t.occurredAt)} — {t.summary}</div>)}
                        </div>
                    )}
                </div>
            ))}
        </div>
    );
};

const AptGroupDetailModal: React.FC<{
    id: number; onClose: () => void; onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void; onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    // KNOWLEDGE_BASE_PHASE1.md §22 "ENTITY TO KNOWLEDGE LINK"
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    // NOTES_PHASE2.md §13/§62 "[View Notes]" — same one-linked-entity-page scope.
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    // KNOWLEDGE_BASE_PHASE2.md §11 "KNOWLEDGE TO APT GROUP" / §26 "KNOWLEDGE CONTEXT PANEL"
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    isAdmin?: boolean;
}> = ({ id, onClose, onOpenEntity, onInvestigate, onCreateThreatBrief, onViewKnowledge, onViewNotes, onOpenKnowledgeEntry, onCreateKnowledgeEntry, isAdmin }) => {
    const [actor, setActor] = useState<ThreatActorDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getAptGroup(id).then(setActor).catch((err) => setError(err?.message || 'Failed to load APT group')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const relationships = actor?.relationships || [];
    const byType = useMemo(() => {
        const m: Record<string, EntityRelationship[]> = {};
        for (const r of relationships) { (m[r.entity.type] ||= []).push(r); }
        return m;
    }, [relationships]);
    const campaigns = byType.campaign || [];
    const malware = byType.malware || [];
    const techniques = byType.attack_technique || [];
    const vulnerabilities = byType.vulnerability || [];
    const iocs = byType.ioc || [];
    const infrastructure = iocs.filter((r) => INFRA_IOC_TYPES.has(String(r.entity.meta?.type)));
    const telegram = byType.telegram_source || [];
    const social = byType.social_account || [];
    const companyBrand = [...(byType.company || []), ...(byType.brand || [])];

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="APT group profile" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal">
                <div className="ti-modal-header">
                    <h2>{actor?.name ?? 'APT Group'}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !actor ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            {/* §6 "APT PROFILE" / Overview */}
                            <div className="ti-kv">
                                <span className="k">Status</span><span className="v" style={{ textTransform: 'capitalize' }}>{actor.status}</span>
                                <span className="k">Risk</span><span className="v"><RiskBadge risk={actor.risk} /></span>
                                <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={actor.confidence} /></span>
                                <span className="k">Motivation</span><span className="v">{actor.motivation ?? 'Unknown'}</span>
                                <span className="k">First Known Activity</span><span className="v">{formatDate(actor.first_seen_at) === '—' ? 'Unknown' : formatDate(actor.first_seen_at)}</span>
                                <span className="k">Last Known Activity</span><span className="v">{formatDate(actor.last_seen_at) === '—' ? 'Unknown' : formatDate(actor.last_seen_at)}</span>
                                <span className="k">Campaigns</span><span className="v">{actor.campaign_count ?? 0}</span>
                                <span className="k">Malware Families</span><span className="v">{actor.malware_count ?? 0}</span>
                                <span className="k">Known IOCs</span><span className="v">{actor.ioc_count ?? 0}</span>
                                <span className="k">MITRE Techniques</span><span className="v">{actor.technique_count ?? 0}</span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', margin: '10px 0' }}>
                                <InvestigateButton target={actor.name} onInvestigate={onInvestigate} />
                                {onCreateThreatBrief && (
                                    <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)' }} onClick={() => onCreateThreatBrief('threat_actor', String(actor.id))}>
                                        Create Threat Brief
                                    </button>
                                )}
                                {/* KNOWLEDGE_BASE_PHASE1.md §22 — natural, not blind: added only here
                                    (and Malware/MITRE), the same "one linked-entity page" scope
                                    onCreateThreatBrief above already uses. */}
                                {onViewKnowledge && (
                                    <button type="button" className="ti-action-btn" onClick={() => onViewKnowledge('threat_actor', String(actor.id), actor.name)}>
                                        View Related Knowledge
                                    </button>
                                )}
                                {/* NOTES_PHASE2.md §13/§62 "[View Notes]" — deep link to the
                                    centralized Notes page, pre-filtered to this APT Group. */}
                                {onViewNotes && (
                                    <button type="button" className="ti-action-btn" onClick={() => onViewNotes('threat_actor', String(actor.id), actor.name)}>
                                        View Notes
                                    </button>
                                )}
                            </div>
                            {actor.description && <div className="ti-note">{actor.description}</div>}

                            <div>
                                <div className="ti-modal-subtitle">Primary Targets — Sectors</div>
                                {actor.target_sectors.length === 0 ? <div className="ti-empty">Not Available.</div> : <div className="ti-chip-list">{actor.target_sectors.map((s) => <span key={s} className="ti-chip" style={{ cursor: 'default' }}>{s}</span>)}</div>}
                            </div>
                            <div>
                                <div className="ti-modal-subtitle">Primary Targets — Regions</div>
                                {actor.target_regions.length === 0 ? <div className="ti-empty">Not Available.</div> : <div className="ti-chip-list">{actor.target_regions.map((r) => <span key={r} className="ti-chip" style={{ cursor: 'default' }}>{r}</span>)}</div>}
                            </div>

                            {/* §7 "ALIASES" */}
                            <div>
                                <div className="ti-modal-subtitle">Aliases ({(actor.aliasRecords || []).length})</div>
                                <AliasesBlock actor={actor} canEdit={!!isAdmin} onChanged={load} />
                            </div>

                            {/* §8/§9 "ATTRIBUTION" */}
                            <div>
                                <div className="ti-modal-subtitle">Attribution</div>
                                <AttributionBlock actor={actor} canEdit={!!isAdmin} onChanged={load} />
                            </div>

                            {/* §10 "CAMPAIGN RELATIONSHIPS" — only shown when there's real data. */}
                            {campaigns.length > 0 && (
                                <div>
                                    <div className="ti-modal-subtitle">Associated Campaigns ({campaigns.length})</div>
                                    <RelationshipRows rows={campaigns} onOpenEntity={onOpenEntity} />
                                    {/* §14-16 "CAMPAIGN EVOLUTION" */}
                                    <div style={{ marginTop: '8px' }}>
                                        {campaigns.map((c) => <CampaignEvolutionRow key={c.entity.id} campaignId={Number(c.entity.id)} campaignName={c.entity.label} />)}
                                    </div>
                                </div>
                            )}
                            {/* §11 "MALWARE RELATIONSHIPS" */}
                            {malware.length > 0 && <div><div className="ti-modal-subtitle">Associated Malware ({malware.length})</div><RelationshipRows rows={malware} onOpenEntity={onOpenEntity} /></div>}
                            {/* §12/§13 "MITRE ATT&CK" / "TTP CONFIDENCE" */}
                            {techniques.length > 0 && <div><div className="ti-modal-subtitle">MITRE ATT&CK Techniques ({techniques.length})</div><RelationshipRows rows={techniques} onOpenEntity={onOpenEntity} /></div>}
                            {/* §14 "VULNERABILITY RELATIONSHIPS" */}
                            {vulnerabilities.length > 0 && <div><div className="ti-modal-subtitle">Associated Vulnerabilities ({vulnerabilities.length})</div><RelationshipRows rows={vulnerabilities} onOpenEntity={onOpenEntity} /></div>}
                            {/* §15 "INFRASTRUCTURE RELATIONSHIPS" — Domain/IP/URL subset of linked IOCs. */}
                            {infrastructure.length > 0 && <div><div className="ti-modal-subtitle">Infrastructure ({infrastructure.length})</div><RelationshipRows rows={infrastructure} onOpenEntity={onOpenEntity} /></div>}
                            {/* §16 "IOC RELATIONSHIPS" */}
                            {iocs.length > 0 && <div><div className="ti-modal-subtitle">Indicators of Compromise ({iocs.length})</div><RelationshipRows rows={iocs} onOpenEntity={onOpenEntity} /></div>}
                            {/* §17 "TELEGRAM CORRELATION" */}
                            {telegram.length > 0 && <div><div className="ti-modal-subtitle">Telegram ({telegram.length})</div><RelationshipRows rows={telegram} onOpenEntity={onOpenEntity} /></div>}
                            {/* §18 "SOCIAL MEDIA CORRELATION" */}
                            {social.length > 0 && <div><div className="ti-modal-subtitle">Social Media ({social.length})</div><RelationshipRows rows={social} onOpenEntity={onOpenEntity} /></div>}
                            {/* §19 "BRAND / COMPANY RELATIONSHIPS" */}
                            {companyBrand.length > 0 && <div><div className="ti-modal-subtitle">Company / Brand ({companyBrand.length})</div><RelationshipRows rows={companyBrand} onOpenEntity={onOpenEntity} /></div>}

                            <RelatedAlertsBlock actorId={actor.id} />

                            {/* §30 "MONITORING UI" / §33/§34 "AI CHANGE SUMMARY" */}
                            <div>
                                <div className="ti-modal-subtitle">Monitoring</div>
                                <MonitoringBlock actorId={actor.id} actorName={actor.name} canMonitor={!!isAdmin} onInvestigate={onInvestigate} />
                                <ChangeSummaryBlock actorId={actor.id} />
                            </div>

                            {/* §22 "TIMELINE" */}
                            <div><div className="ti-modal-subtitle">Timeline</div><TimelineBlock actorId={actor.id} /></div>

                            {/* §20 "EVIDENCE" */}
                            <div><div className="ti-modal-subtitle">Evidence</div><EvidenceBlock actorId={actor.id} /></div>

                            {/* §23/§24 "RISK" / "RISK EXPLANATION" — reuses computeEntityRisk('threat_actor', id), no second engine. */}
                            <div><div className="ti-modal-subtitle">Risk Assessment</div><RiskAssessmentBlock entityType="threat_actor" entityId={actor.id} /></div>

                            {/* KNOWLEDGE_BASE_PHASE2.md §11 "KNOWLEDGE TO APT GROUP" */}
                            <KnowledgeContextPanel entityType="threat_actor" entityId={actor.id} entityLabel={actor.name} defaultCategory="APT Group"
                                onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} />

                            {/* §30/§31 "AI SUMMARY" / "AI ATTRIBUTION SAFETY" */}
                            <div><div className="ti-modal-subtitle">AI Summary</div><AiSummaryBlock actorId={actor.id} /></div>

                            {/* APT_GROUP_PHASE3.md §21/§22 "APT ACTIVITY SCORECARD" */}
                            <div><div className="ti-modal-subtitle">Operational Scorecard</div><ScorecardBlock actorId={actor.id} /></div>

                            {/* §17-§20/§31 "ATT&CK GROUP ANALYTICS" / "AI ATT&CK SUMMARY" */}
                            <div><div className="ti-modal-subtitle">ATT&CK Analytics</div><AttackAnalyticsBlock actorId={actor.id} /></div>

                            {/* §24 "RISK EVOLUTION" */}
                            <div><div className="ti-modal-subtitle">Risk Evolution</div><RiskEvolutionBlock actorId={actor.id} /></div>

                            {/* §25 "ATTRIBUTION EVOLUTION" */}
                            <div><div className="ti-modal-subtitle">Attribution Evolution</div><AttributionEvolutionBlock actorId={actor.id} /></div>

                            {/* §27 "EVIDENCE GAPS" */}
                            <div><div className="ti-modal-subtitle">Evidence Gaps</div><EvidenceGapsBlock actorId={actor.id} /></div>

                            {/* §12/§13/§32 "MULTI-APT CORRELATION" / "AI CROSS-APT SUMMARY" */}
                            <div><div className="ti-modal-subtitle">Cross-APT Correlation</div><CrossCorrelationBlock actorId={actor.id} actorName={actor.name} /></div>

                            {/* §30 "EXECUTIVE APT SUMMARY" */}
                            <div><div className="ti-modal-subtitle">Executive Summary</div><ExecutiveSummaryBlock actorId={actor.id} /></div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const AdvancedSearchBlock: React.FC<{ onOpenActor: (id: number) => void }> = ({ onOpenActor }) => {
    const [q, setQ] = useState('');
    const [results, setResults] = useState<AptGroupSearchResultItem[] | null>(null);
    const [loading, setLoading] = useState(false);

    const search = async () => {
        if (!q.trim()) { setResults(null); return; }
        setLoading(true);
        try { const r = await searchAptGroups(q.trim()); setResults(r.items); } finally { setLoading(false); }
    };

    return (
        <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', gap: '8px' }}>
                <input
                    type="text" placeholder="Advanced search — malware, CVE, technique, IOC, Telegram source, campaign…"
                    value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') search(); }}
                    style={{ ...inputStyle, flex: 1 }}
                />
                <button type="button" className="ti-action-btn" onClick={search} disabled={loading || !q.trim()}>{loading ? 'Searching…' : 'Search'}</button>
                {results && <button type="button" className="ti-action-btn" onClick={() => { setResults(null); setQ(''); }}>Clear</button>}
            </div>
            {results && (
                results.length === 0 ? <div className="ti-empty" style={{ marginTop: '8px' }}>No APT groups matched.</div> : (
                    <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {results.map(({ actor, matches }) => (
                            <div key={actor.id} className="ti-row-clickable" onClick={() => onOpenActor(actor.id)} style={{ padding: '8px', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                    <strong>{actor.name}</strong><RiskBadge risk={actor.risk} />
                                </div>
                                <div className="ti-note" style={{ marginTop: '4px' }}>
                                    Matched: {matches.map((m) => `${m.field} — ${m.value}`).join('; ')}
                                </div>
                            </div>
                        ))}
                    </div>
                )
            )}
        </div>
    );
};

// §32 "RECENT APT ACTIVITY" — a real monitor_events stream, never fabricated.
const RecentActivityBlock: React.FC<{ onOpenActor: (id: number) => void }> = ({ onOpenActor }) => {
    const [items, setItems] = useState<AptGroupActivityItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { getAptGroupActivity(15).then(setItems).catch(() => {}).finally(() => setLoading(false)); }, []);
    if (loading || items.length === 0) return null;
    return (
        <div style={{ marginBottom: '14px' }}>
            <div className="ti-modal-subtitle">Recent APT Activity</div>
            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                {items.map((i) => (
                    <div key={i.id} className="ti-row-clickable" onClick={() => onOpenActor(i.actorId)} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', cursor: 'pointer', flexWrap: 'wrap' }}>
                        <span className={`ti-badge ti-badge--${i.severity}`}>{i.severity}</span>
                        <strong>{i.actorName}</strong>
                        <span style={{ flex: 1 }}>{i.eventType.replace(/_/g, ' ')}</span>
                        <span className="ti-note">{formatDateTime(i.createdAt)}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const DIGEST_WINDOW_OPTIONS: { hours: number; label: string }[] = [
    { hours: 1, label: 'Last 1 hour' }, { hours: 6, label: 'Last 6 hours' }, { hours: 24, label: 'Last 24 hours' }, { hours: 168, label: 'Last 7 days' }
];
const DigestBlock: React.FC<{ onOpenActor: (id: number) => void }> = ({ onOpenActor }) => {
    const [windowHours, setWindowHours] = useState(24);
    const [digest, setDigest] = useState<AptActivityDigest | null>(null);
    const [loading, setLoading] = useState(true);
    useEffect(() => { setLoading(true); getAptActivityDigest(windowHours).then(setDigest).catch(() => setDigest(null)).finally(() => setLoading(false)); }, [windowHours]);

    return (
        <div style={{ marginBottom: '14px', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span className="ti-card-title" style={{ fontSize: '0.95rem' }}>APT Activity Digest</span>
                <select value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))}>
                    {DIGEST_WINDOW_OPTIONS.map((o) => <option key={o.hours} value={o.hours}>{o.label}</option>)}
                </select>
            </div>
            {loading ? <div className="ti-loading">Loading…</div> : !digest || digest.groupsChanged === 0 ? (
                <div className="ti-empty" style={{ marginTop: '8px' }}>No monitored APT group activity in this window.</div>
            ) : (
                <>
                    <div className="ti-note" style={{ margin: '8px 0' }}>
                        {digest.groupsChanged} monitored group(s) changed · {digest.totalAlerts} alert(s) · {digest.highPriorityAlerts} high-priority · {digest.requiresReviewCount} require analyst review.
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {digest.groups.map((g) => (
                            <div key={g.actorId} className="ti-row-clickable" onClick={() => onOpenActor(g.actorId)} style={{ padding: '6px 8px', border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}>
                                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                    <strong>{g.actorName}</strong>
                                    <span className={`ti-badge ti-badge--${g.priority.toLowerCase()}`}>{g.priority}</span>
                                    {g.riskChange && <span className="ti-note">{g.riskChange}</span>}
                                </div>
                                <div className="ti-note" style={{ marginTop: '2px' }}>
                                    {Object.entries(g.changes).map(([type, count]) => `${type.replace(/_/g, ' ')}: ${count > 1 ? `${count} related events` : '1 event'}`).join(' · ')}
                                </div>
                                <div className="ti-note">{g.priorityReason}</div>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
};

// §23 "APT LEADERBOARD" — labeled "Activity Priority", never "most dangerous".
const LeaderboardBlock: React.FC<{ onOpenActor: (id: number) => void }> = ({ onOpenActor }) => {
    const [items, setItems] = useState<AptLeaderboardItem[]>([]);
    const [loading, setLoading] = useState(true);
    useEffect(() => { getAptLeaderboard(10).then((r) => setItems(r.items)).catch(() => setItems([])).finally(() => setLoading(false)); }, []);
    if (loading || items.length === 0) return null;
    return (
        <div style={{ marginBottom: '14px' }}>
            <div className="ti-modal-subtitle">Activity Priority — Monitored APT Groups</div>
            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>APT Group</th><th>Risk</th><th>Open Alerts</th><th>New Campaigns (7d)</th><th>New IOCs (7d)</th><th>Priority Score</th></tr></thead>
                    <tbody>
                        {items.map((i) => (
                            <tr key={i.actorId} className="ti-row-clickable" onClick={() => onOpenActor(i.actorId)}>
                                <td>{i.actorName}</td><td><RiskBadge risk={i.risk} /></td><td>{i.openAlerts}</td><td>{i.newCampaigns7d}</td><td>{i.newIOCs7d}</td><td>{i.activityPriorityScore}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// §26 "SOURCE CONSISTENCY" — reuses Phase 1's 'Disputed' attribution value; never auto-resolved.
const AttributionConflictsBlock: React.FC<{ onOpenActor: (id: number) => void }> = ({ onOpenActor }) => {
    const [items, setItems] = useState<AptAttributionConflict[]>([]);
    useEffect(() => { getAptAttributionConflicts().then(setItems).catch(() => setItems([])); }, []);
    if (items.length === 0) return null;
    return (
        <div style={{ marginBottom: '14px' }}>
            <div className="ti-modal-subtitle">Attribution Conflicts — Analyst Review Required</div>
            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                {items.map((i) => (
                    <div key={i.actorId} className="ti-row-clickable" onClick={() => onOpenActor(i.actorId)} style={{ padding: '5px 0', cursor: 'pointer' }}>
                        <strong>{i.actorName}</strong> <span className="ti-note">{i.reasoning || 'No reasoning recorded.'}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

// §4/§5 "Create manually" — admin-only, name_key-dedupe-checked server-side.
const CreateAptGroupForm: React.FC<{ onCreated: (id: number) => void; onCancel: () => void }> = ({ onCreated, onCancel }) => {
    const [form, setForm] = useState({ name: '', description: '', motivation: '', status: 'active', confidence: 'Medium' });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        if (!form.name.trim()) return;
        setSaving(true); setError(null);
        try {
            const actor = await createAptGroup({ ...form, isAptGroup: true });
            onCreated(actor.id);
        } catch (err: any) {
            setError(err?.message || 'Failed to create APT group');
        } finally { setSaving(false); }
    };

    return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', paddingBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {error && <div className="ti-error" style={{ width: '100%' }}>{error}</div>}
            <input type="text" placeholder="Name…" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} style={{ ...inputStyle, minWidth: '200px' }} />
            <input type="text" placeholder="Motivation (optional)…" value={form.motivation} onChange={(e) => setForm((f) => ({ ...f, motivation: e.target.value }))} style={{ ...inputStyle, minWidth: '180px' }} />
            <input type="text" placeholder="Description (optional)…" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minWidth: '220px' }} />
            <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}>
                <option value="active">Active</option><option value="dormant">Dormant</option><option value="inactive">Inactive</option>
            </select>
            <button type="button" className="ti-action-btn" onClick={submit} disabled={saving || !form.name.trim()}>{saving ? 'Creating…' : 'Create'}</button>
            <button type="button" className="ti-action-btn" onClick={onCancel} disabled={saving}>Cancel</button>
            {/* §5 "AVOID DUPLICATE IDENTITIES" — server rejects a name_key collision rather than silently merging. */}
            <div className="ti-note" style={{ width: '100%' }}>If an equivalent Threat Actor already exists, creation will be rejected — classify the existing entity instead.</div>
        </div>
    );
};

interface Props {
    onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    onViewKnowledge?: (entityType: string, entityId: string, label: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
    isAdmin?: boolean;
    openEntityId?: string | null;
    onEntityOpened?: () => void;
}

const ThreatActorsSection: React.FC<Props> = ({ onOpenEntity, onInvestigate, onCreateThreatBrief, onViewKnowledge, onViewNotes, onOpenKnowledgeEntry, onCreateKnowledgeEntry, isAdmin, openEntityId, onEntityOpened }) => {
    const [dashboard, setDashboard] = useState<AptGroupDashboard | null>(null);
    const [filters, setFilters] = useState({ q: '', status: 'all', attribution: '', attributionConfidence: 'all', region: '', sector: '', risk: 'all', techniqueId: '', cveId: '', classification: 'all' });
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<ThreatActor[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);

    useEffect(() => {
        if (openEntityId != null) { setSelectedId(Number(openEntityId)); onEntityOpened?.(); }
    }, [openEntityId]);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        getAptGroups({
            q: filters.q || undefined, status: filters.status !== 'all' ? filters.status : undefined,
            attribution: filters.attribution || undefined,
            attributionConfidence: filters.attributionConfidence !== 'all' ? filters.attributionConfidence : undefined,
            region: filters.region || undefined, sector: filters.sector || undefined,
            techniqueId: filters.techniqueId || undefined, cveId: filters.cveId || undefined,
            risk: filters.risk !== 'all' ? filters.risk : undefined,
            classification: filters.classification as 'all' | 'apt' | 'non-apt',
            page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load threat actors'))
            .finally(() => setLoading(false));
    }, [filters, page]);
    useEffect(() => { load(); }, [load]);
    useEffect(() => { getAptGroupDashboard().then(setDashboard).catch(() => setDashboard(null)); }, []);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.status === 'all' && !filters.attribution && filters.attributionConfidence === 'all'
        && !filters.region && !filters.sector && filters.risk === 'all' && !filters.techniqueId && !filters.cveId
        && filters.classification === 'all';

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title" title="Every threat actor, with the APT-classified subset available as a filter.">Threat Actors</span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    {isAdmin && <button type="button" className="ti-action-btn" onClick={() => setShowCreate((v) => !v)}>+ New APT Group</button>}  {/* creates is_apt_group = 1; a plain actor arrives from a feed, never by hand */}
                    <button type="button" className="ti-refresh-btn" onClick={() => { load(); getAptGroupDashboard().then(setDashboard).catch(() => {}); }} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                </div>
            </div>
            {/* P1-7 — "Threat Actors" and "APT Group Intelligence" were two menu
                entries, two lists and two detail views over the SAME
                `threat_actors` rows, separated only by the `is_apt_group`
                boolean. That is a subtype, not a second entity, so it is a
                filter here rather than a second module. Every actor now reaches
                the full workspace: the per-actor routes (timeline, scorecard,
                ATT&CK analytics, risk/attribution evolution, evidence gaps)
                never filtered on is_apt_group — only the *list* did, so non-APT
                actors were denied this workspace by navigation accident alone. */}
            <div className="ti-note" style={{ marginBottom: '10px' }}>Threat actor directory and analysis workspace — attribution, campaigns, malware, ATT&amp;CK, infrastructure, evidence and risk in one place. Use <strong>Classification</strong> to narrow to APT-classified groups.</div>

            {/* P1-7 — these panels aggregate over is_apt_group = 1 rows only
                (getAptGroupDashboard / digest / leaderboard / attribution
                conflicts / recent activity all hardcode that predicate). They
                are an APT-programme overview, not an all-actor one, so they
                render only under the APT filter rather than sitting above a
                list that may contain non-APT actors and silently disagreeing
                with it. */}
            {filters.classification === 'apt' && <>
            {/* §27 "APT GROUP DASHBOARD" — every value is a real query, never a placeholder. */}
            {dashboard && (
                <div className="ti-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', marginBottom: '14px' }}>
                    {[
                        ['Total APT Groups', dashboard.totalAptGroups], ['Active Groups', dashboard.activeGroups],
                        ['Recently Active (30d)', dashboard.recentlyActive], ['High Risk', dashboard.highRisk],
                        ['Active Campaigns', dashboard.activeCampaigns], ['Recent Intelligence (7d)', dashboard.recentIntelligence],
                        // APT_GROUP_PHASE2.md §31 — additive tiles.
                        ['Monitored Groups', dashboard.monitoredGroups], ['Open APT Alerts', dashboard.openAptAlerts],
                        ['Recent Changes (7d)', dashboard.recentChanges], ['Recent Risk Changes (7d)', dashboard.recentRiskChanges],
                        ['New Campaigns (7d)', dashboard.newCampaigns], ['New IOCs (7d)', dashboard.newIOCs],
                        ['Active High Risk Groups', dashboard.activeHighRiskGroups]
                    ].map(([label, value]) => (
                        <div key={label as string} style={{ border: '1px solid var(--ui-border)', borderRadius: 'var(--radius-md)', padding: '12px', textAlign: 'center' }}>
                            <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'rgba(0,229,255,0.95)' }}>{value as number}</div>
                            <div className="ti-note" style={{ marginTop: '4px' }}>{label}</div>
                        </div>
                    ))}
                </div>
            )}

            {showCreate && <CreateAptGroupForm onCreated={(id) => { setShowCreate(false); load(); getAptGroupDashboard().then(setDashboard).catch(() => {}); setSelectedId(id); }} onCancel={() => setShowCreate(false)} />}

            {/* APT_GROUP_PHASE3.md §8-11/§35/§36/§23/§26 */}
            <DigestBlock onOpenActor={setSelectedId} />
            <LeaderboardBlock onOpenActor={setSelectedId} />
            <AttributionConflictsBlock onOpenActor={setSelectedId} />

            <RecentActivityBlock onOpenActor={setSelectedId} />

            {/* §25-§27 "ADVANCED SEARCH" / "SEARCH RESULTS" */}
            <AdvancedSearchBlock onOpenActor={setSelectedId} />
            </>}

            {/* §26/§28 "SEARCH ARCHITECTURE" / "FILTERS" */}
            <div className="ti-filters">
                <select aria-label="Classification" value={filters.classification} onChange={(e) => { setFilters((f) => ({ ...f, classification: e.target.value })); setPage(1); }}>
                    <option value="all">All Actors</option>
                    <option value="apt">APT Groups Only</option>
                    <option value="non-apt">Not Classified as APT</option>
                </select>
                <input type="text" placeholder="Search name, alias, country…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                    <option value="all">All Status</option><option value="active">Active</option><option value="dormant">Dormant</option><option value="inactive">Inactive</option>
                </select>
                <select value={filters.attributionConfidence} onChange={(e) => { setFilters((f) => ({ ...f, attributionConfidence: e.target.value })); setPage(1); }}>
                    <option value="all">All Attribution Confidence</option>
                    {ATTRIBUTION_CONFIDENCE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
                <input type="text" placeholder="Attribution country…" value={filters.attribution} onChange={(e) => { setFilters((f) => ({ ...f, attribution: e.target.value })); setPage(1); }} />
                <input type="text" placeholder="Target region…" value={filters.region} onChange={(e) => { setFilters((f) => ({ ...f, region: e.target.value })); setPage(1); }} />
                <input type="text" placeholder="Target sector…" value={filters.sector} onChange={(e) => { setFilters((f) => ({ ...f, sector: e.target.value })); setPage(1); }} />
                <input type="text" placeholder="MITRE technique (e.g. T1566)…" value={filters.techniqueId} onChange={(e) => { setFilters((f) => ({ ...f, techniqueId: e.target.value })); setPage(1); }} />
                <input type="text" placeholder="CVE (e.g. CVE-2026-12345)…" value={filters.cveId} onChange={(e) => { setFilters((f) => ({ ...f, cveId: e.target.value })); setPage(1); }} />
                <select value={filters.risk} onChange={(e) => { setFilters((f) => ({ ...f, risk: e.target.value })); setPage(1); }}>
                    <option value="all">All Risk</option><option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                </select>
            </div>

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">{filtersAreDefault ? 'No threat actors found.'
                    : filters.classification === 'apt' ? 'No APT groups match these filters. Classify an existing threat actor via its Attribution tab, or create one above.'
                    : 'No threat actors match these filters.'}</div>
            ) : (
                <>
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead><tr><th>Threat Actor</th><th>Classification</th><th>Attribution</th><th>Confidence</th><th>Risk</th><th>Campaigns</th><th>Malware</th><th>Last Activity</th><th>Status</th><th>Action</th></tr></thead>
                            <tbody>
                                {items.map((a) => (
                                    <tr key={a.id} className="ti-row-clickable" onClick={() => setSelectedId(a.id)}>
                                        <td><span className="ti-target" title={a.name}>{a.name}</span></td>
                                        {/* Reads the stored is_apt_group flag and nothing else — an
                                            actor is never inferred into APT framing. */}
                                        <td>{a.is_apt_group ? 'APT Group' : 'Threat Actor'}</td>
                                        <td>{a.attribution?.country || 'Unknown'}</td>
                                        <td>{a.attribution?.confidence || 'Unconfirmed'}</td>
                                        <td><RiskBadge risk={a.risk} /></td>
                                        <td>{a.campaign_count ?? 0}</td>
                                        <td>{a.malware_count ?? 0}</td>
                                        <td>{formatDate(a.last_seen_at)}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{a.status}</td>
                                        <td><button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(a.id); }}>View</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                </>
            )}

            {selectedId != null && (
                <AptGroupDetailModal
                    id={selectedId} onClose={() => { setSelectedId(null); load(); }} onOpenEntity={onOpenEntity}
                    onInvestigate={onInvestigate} onCreateThreatBrief={onCreateThreatBrief} onViewKnowledge={onViewKnowledge} onViewNotes={onViewNotes}
                    onOpenKnowledgeEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry} isAdmin={isAdmin}
                />
            )}
        </div>
    );
};

export default ThreatActorsSection;
