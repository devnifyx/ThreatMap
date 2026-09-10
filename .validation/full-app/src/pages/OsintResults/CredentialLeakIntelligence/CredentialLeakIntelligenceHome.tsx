// CREDENTIAL_LEAK_PHASE1.md — replaces the former email-first "Enter email
// address for breach lookup" workflow. §1/§33/§67/§68 — the primary
// monitoring scope is now a WATCHLIST DOMAIN (an existing Target
// Management `target`, type='domain'), never an individual email address;
// this page must not start with an email input. Reuses ThreatIntelligence's
// existing ti-* visual system, the same convention every other OSINT
// module page already follows.
import React, { useState, useCallback, useEffect } from 'react';
import { KeyRound, PlusCircle, RefreshCw } from 'lucide-react';
import ThemedSelect from '../../../components/ThemedSelect';
import '../../ThreatIntelligence/ThreatIntelligencePage.css';
// Reuses the SAME hero header component (.ti-hero / .ti-hero-icon / .ti-hero-title /
// .ti-hero-desc / .ti-hero-actions / .ti-hero-btn) Telegram Intelligence's own landing
// page already defines — same cross-module CSS import convention Telegram's own page
// already uses (it imports SocialMediaIntelligence.css the identical way).
import '../TelegramIntelligence/TelegramIntelligence.css';
import { formatDateTime } from '../../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../../components/shared/Pagination';  // P2-8
import {
    getCredentialLeakProviderStatus, getWatchlistDomains, getWatchlistDomainDetail, checkWatchlistDomainNow,
    getCredentialExposures, getCredentialExposureDetail, reviewCredentialExposure, credentialLeakExportUrl,
    createTarget, addEvidence, createCentralNote,
    // CREDENTIAL_LEAK_PHASE2.md — Domain Monitoring, Baselines, Exposure
    // Change Detection, Alerting & Operational Integration. [Check Now]/
    // [Pause]/[Resume]/[Delete] reuse the EXISTING generic monitor
    // functions (checkMonitorNow/updateMonitor/deleteMonitor) already
    // defined in this file for every other monitor type — never a
    // duplicate monitor API (§57/§81).
    createCredentialLeakDomainMonitor, updateMonitor, deleteMonitor,
    getCredentialExposureTrend, bulkAddCredentialExposuresToCase,
    // CREDENTIAL_LEAK_PHASE3.md — Automatic Watchlist Sync, Historical
    // Analytics (Top Accounts / Company Overview enrichment), MISP/Domain
    // Comparison, and the AI Credential Analyst (Analyze Exposure / Forecast
    // / dashboard-wide Assessment). Every state-changing AI recommendation
    // is executed only after explicit analyst approval, via the EXISTING
    // API the recommendation's own actionPreview points at (§86/§88) —
    // never a new "execute" endpoint.
    syncCredentialLeakWatchlistMonitors, getTopExposedAccounts, checkMispForWatchlistDomain, compareWatchlistDomains,
    getCredentialLeakDomainAiSummary, getCredentialLeakDomainForecast, getCredentialLeakDashboardAiSummary,
    type CredentialLeakProviderStatus, type WatchlistDomain, type WatchlistDomainDetail, type CredentialExposure,
    type CredentialExposureDetail, type CredentialExposureStatus, type CredentialLeakExposureTrend,
    type CredentialLeakTopAccount, type CredentialLeakMispResult, type CredentialLeakAiRecommendation,
    type CredentialLeakForecast, type CredentialLeakAiDomainSummary, type CredentialLeakAiDashboardSummary,
} from '../../../services/api';

interface Props {
    onNavigateToModule?: (module: string) => void;
    onNavigateToView?: (view: string) => void;
    onViewNotes?: (entityType: string, entityId: string, label: string) => void;
    onCreateThreatBrief?: (contextType: string, contextId: string) => void;
    isAdmin?: boolean;
}

const PROVIDER_STATUS_LABEL: Record<string, string> = {
    available: 'Available', unavailable: 'Unavailable', not_configured: 'Not Configured',
    auth_error: 'Authentication Error', rate_limited: 'Rate Limited',
};
const PROVIDER_STATUS_COLOR: Record<string, { background: string; color: string }> = {
    available: { background: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    unavailable: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
    not_configured: { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    auth_error: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
    rate_limited: { background: 'rgba(234,179,8,0.15)', color: '#eab308' },
};

type TopMode = 'dashboard' | 'domains' | 'exposures';

const CredentialLeakIntelligenceHome: React.FC<Props> = ({ onViewNotes, onCreateThreatBrief, onNavigateToModule }) => {
    const [mode, setMode] = useState<TopMode>('dashboard');
    const [domains, setDomains] = useState<WatchlistDomain[]>([]);
    const [selectedDomainId, setSelectedDomainId] = useState<number | null>(null);
    const [loadingDomains, setLoadingDomains] = useState(true);
    const [showAddDomain, setShowAddDomain] = useState(false);
    const [providerStatus, setProviderStatus] = useState<CredentialLeakProviderStatus | null>(null);
    // CREDENTIAL_LEAK_PHASE3.md §3-9/§63/CASE 1 AUTOMATIC WATCHLIST SYNC —
    // "Enable Monitoring for All", analyst-controlled (§5's fallback
    // branch); never contacts Paranoid Lab itself.
    const [syncing, setSyncing] = useState(false);
    const [syncMessage, setSyncMessage] = useState<string | null>(null);

    const loadDomains = useCallback((selectId?: number) => {
        setLoadingDomains(true);
        getWatchlistDomains({ pageSize: 100 }).then((d) => {
            setDomains(d.items);
            if (selectId != null) setSelectedDomainId(selectId);
            else if (selectedDomainId == null && d.items.length) setSelectedDomainId(d.items[0].id);
        }).finally(() => setLoadingDomains(false));
    }, [selectedDomainId]);
    useEffect(() => { loadDomains(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { getCredentialLeakProviderStatus().then(setProviderStatus).catch(() => {}); }, []);

    const syncWatchlist = async () => {
        setSyncing(true); setSyncMessage(null);
        try {
            const res = await syncCredentialLeakWatchlistMonitors();
            setSyncMessage(`${res.created} monitor(s) created, ${res.alreadyMonitored} already monitored (${res.discovered} Watchlist Domain(s) discovered).`);
            loadDomains();
        } catch (e: any) { setSyncMessage(e?.message || 'Failed to sync Watchlist Domains.'); } finally { setSyncing(false); }
    };

    return (
        <div className="ti-container">
            <div className="ti-content">
                {/* Same hero treatment as Telegram Intelligence's own landing page. */}
                <div className="ti-hero" style={{ marginBottom: '16px' }}>
                    <div className="ti-hero-top">
                        <span className="ti-hero-icon" aria-hidden="true"><KeyRound size={22} /></span>
                        <h2 className="ti-hero-title">Credential Leak Intelligence</h2>
                    </div>
                    <p className="ti-hero-desc">
                        Monitors credential exposure for authorized company watchlist domains via Paranoid Lab. Every result is scoped to the selected Watchlist Domain — this page never analyzes an arbitrary email address.
                    </p>
                    <div className="ti-hero-actions">
                        <button type="button" className="ti-action-btn ti-hero-btn" onClick={() => setShowAddDomain(true)}>
                            <PlusCircle size={16} /> Add Watchlist Domain
                        </button>
                        <button
                            type="button" className="ti-action-btn ti-hero-btn"
                            onClick={syncWatchlist} disabled={syncing}
                            title="Create a Credential Leak monitor for every Watchlist Domain that doesn't have one yet"
                        >
                            <RefreshCw size={16} /> {syncing ? 'Syncing…' : 'Sync Watchlist'}
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                    {(['dashboard', 'domains', 'exposures'] as TopMode[]).map((m) => (
                        <button key={m} type="button" className="ti-action-btn" style={mode === m ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined} onClick={() => setMode(m)}>
                            {m === 'dashboard' ? 'Dashboard' : m === 'domains' ? 'Domains' : 'Exposures'}
                        </button>
                    ))}
                    {providerStatus && (
                        <span className="ti-badge" style={{ marginLeft: 'auto', ...(PROVIDER_STATUS_COLOR[providerStatus.status] || {}) }}>
                            Paranoid Lab: {PROVIDER_STATUS_LABEL[providerStatus.status] || providerStatus.status}
                        </span>
                    )}
                </div>

                {providerStatus?.status === 'not_configured' && (
                    <div className="ti-note" style={{ marginBottom: '16px', fontStyle: 'italic' }}>Paranoid Lab is not configured (PARANOIDLAB_API_KEY is not set server-side). Domain checks are unavailable until it is.</div>
                )}

                {/* §6 WATCHLIST DOMAIN SELECTION — dropdown over Target Management's own domain targets, never free text. */}
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-kv" style={{ gridTemplateColumns: '140px 1fr' }}>
                        <span className="k">Watchlist Domain</span>
                        <span className="v" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            {loadingDomains ? <span className="ti-note">Loading…</span> : domains.length === 0 ? (
                                <span className="ti-empty">No Watchlist Domains yet.</span>
                            ) : (
                                <ThemedSelect
                                    value={selectedDomainId != null ? String(selectedDomainId) : ''}
                                    onChange={(v) => setSelectedDomainId(Number(v))}
                                    options={domains.map((d) => ({ value: String(d.id), label: d.value }))}
                                    style={{ minWidth: '220px' }}
                                    ariaLabel="Watchlist Domain"
                                />
                            )}
                            <button type="button" className="ti-action-btn" onClick={() => setShowAddDomain(true)}>Add Domain</button>
                            {/* CREDENTIAL_LEAK_PHASE3.md §1/§5/§122 — the analyst
                                should not need to manually open each domain and
                                create a monitor; this bulk-enrolls every
                                Watchlist Domain that doesn't have one yet into
                                the EXISTING scheduler's normal rotation. */}
                            <button type="button" className="ti-action-btn" onClick={syncWatchlist} disabled={syncing} title="Create a Credential Leak monitor for every Watchlist Domain that doesn't have one yet">
                                {syncing ? 'Syncing…' : 'Sync Watchlist'}
                            </button>
                            {onNavigateToModule && <button type="button" className="ti-action-btn" onClick={() => onNavigateToModule('target-mgmt')}>Manage in Target Management</button>}
                        </span>
                    </div>
                    {syncMessage && <div className="ti-note" style={{ marginTop: '8px' }}>{syncMessage}</div>}
                </div>
                {showAddDomain && <AddDomainForm onClose={() => setShowAddDomain(false)} onCreated={(id) => { setShowAddDomain(false); loadDomains(id); }} />}

                {selectedDomainId == null ? (
                    <div className="ti-empty">Add a Watchlist Domain to begin.</div>
                ) : mode === 'dashboard' ? (
                    <DashboardView key={selectedDomainId} domainId={selectedDomainId} onOpenExposures={() => setMode('exposures')} />
                ) : mode === 'domains' ? (
                    <DomainsView domains={domains} onSelect={(id) => { setSelectedDomainId(id); setMode('dashboard'); }} />
                ) : (
                    /* CREDENTIAL_LEAK_PHASE3.md §101/§104 — the exposure browser
                       takes the WHOLE authorized Watchlist so its own
                       "Email / Domain" filter can scope to one domain or span
                       all of them, exactly like the provider console does.
                       Server-side filtering/pagination throughout (§104). */
                    <ExposuresView
                        domains={domains}
                        initialDomainId={selectedDomainId}
                        onViewNotes={onViewNotes}
                        onCreateThreatBrief={onCreateThreatBrief}
                    />
                )}
            </div>
        </div>
    );
};

const AddDomainForm: React.FC<{ onClose: () => void; onCreated: (id: number) => void }> = ({ onClose, onCreated }) => {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const submit = async () => {
        if (!value.trim()) { setErr('Domain is required (e.g. company.com).'); return; }
        setBusy(true); setErr(null);
        try {
            const res = await createTarget({ type: 'domain', value: value.trim() });
            const id = (res as any)?.duplicate ? (res as any).existing?.id : (res as any)?.target?.id;
            if (!id) throw new Error('Failed to create domain');
            onCreated(id);
        } catch (e: any) { setErr(e?.message || 'Failed to add domain'); } finally { setBusy(false); }
    };
    return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-card-title">Add Watchlist Domain</div>
            <div className="ti-note" style={{ marginBottom: '8px', fontStyle: 'italic' }}>Reuses Target Management — this creates (or reuses) a real, authorized company domain target. Multiple domains are supported.</div>
            <input type="text" placeholder="e.g. company.com" value={value} onChange={(e) => setValue(e.target.value)} style={{ width: '100%' }} />
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={busy}>{busy ? 'Adding…' : 'Add Domain'}</button>
                <button type="button" className="ti-action-btn" onClick={onClose}>Cancel</button>
            </div>
        </div>
    );
};

// §14/§29/§56 CREDENTIAL LEAK SUMMARY / DOMAIN DETAIL — real provider
// metrics only. PII is shown under its own real, documented name (never
// silently relabeled as "Autofill" — §12 "do not expose provider-specific
// raw JSON" cuts both ways: never invent a mapping the provider doesn't
// document either); Autofill/Cookie categories the provider genuinely
// doesn't expose show "Not Available", never a fabricated 0.
const DashboardView: React.FC<{ domainId: number; onOpenExposures: () => void }> = ({ domainId, onOpenExposures }) => {
    const [detail, setDetail] = useState<WatchlistDomainDetail | null>(null);
    const [trend, setTrend] = useState<CredentialLeakExposureTrend | null>(null);
    const [busy, setBusy] = useState(false);
    const [checkResult, setCheckResult] = useState<any>(null);
    // CREDENTIAL_LEAK_PHASE3.md §34/§38/§89 — Top Exposed Accounts (metadata
    // only) and the deterministic Exposure Outlook forecast; both are cheap,
    // real-data-only reads (no provider call), so they load alongside the
    // rest of the dashboard.
    const [topAccounts, setTopAccounts] = useState<CredentialLeakTopAccount[]>([]);
    const [forecast, setForecast] = useState<CredentialLeakForecast | null>(null);
    // §49/CASE 17 MISP — on-demand only, never automatic.
    const [misp, setMisp] = useState<CredentialLeakMispResult | null>(null);
    const [mispBusy, setMispBusy] = useState(false);
    // §71-96 AI CREDENTIAL ANALYST — "Analyze Exposure" is analyst-triggered
    // (never fired automatically, avoiding an unwanted LLM call per page view).
    const [aiSummary, setAiSummary] = useState<CredentialLeakAiDomainSummary | null>(null);
    const [aiRecommendations, setAiRecommendations] = useState<CredentialLeakAiRecommendation[]>([]);
    const [aiMeta, setAiMeta] = useState<{ aiStatus: string; fallback: boolean; generatedAt: string } | null>(null);
    const [aiBusy, setAiBusy] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null);

    const load = useCallback(() => {
        getWatchlistDomainDetail(domainId).then(setDetail);
        getCredentialExposureTrend(domainId).then(setTrend).catch(() => {});
        getTopExposedAccounts(domainId, 10).then((r) => setTopAccounts(r.items)).catch(() => setTopAccounts([]));
        getCredentialLeakDomainForecast(domainId).then(setForecast).catch(() => setForecast(null));
        setMisp(null); setAiSummary(null); setAiRecommendations([]); setAiMeta(null); setAiError(null);
    }, [domainId]);
    useEffect(() => { setDetail(null); load(); }, [load]);

    const checkMisp = async () => {
        setMispBusy(true);
        try { setMisp(await checkMispForWatchlistDomain(domainId)); } catch (e: any) { setMisp({ status: 'unavailable', errorMessage: e?.message } as any); } finally { setMispBusy(false); }
    };
    // §72/§86/§88 AI ANALYST — recommendations are previews only; the
    // ACTUAL action fires only after the analyst clicks Approve, and calls
    // the EXISTING API the recommendation's own actionPreview names.
    const analyzeExposure = async () => {
        setAiBusy(true); setAiError(null);
        try {
            const res = await getCredentialLeakDomainAiSummary(domainId);
            setAiSummary(res.summary); setAiRecommendations(res.recommendations);
            setAiMeta({ aiStatus: res.aiStatus, fallback: res.fallback, generatedAt: res.generatedAt });
        } catch (e: any) { setAiError(e?.message || 'Failed to generate AI summary.'); } finally { setAiBusy(false); }
    };
    const approveAction = async (rec: CredentialLeakAiRecommendation) => {
        if (!rec.actionPreview) return;
        setActionMessage(null);
        try {
            const res = await fetch(rec.actionPreview.endpoint, {
                method: rec.actionPreview.method, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: rec.actionPreview.method === 'GET' ? undefined : JSON.stringify(rec.actionPreview.payload || {}),
            });
            const body = await res.json().catch(() => ({}));
            // §88 ACTION EXECUTION — success is shown only after the actual API call succeeds.
            if (!res.ok || body?.status === 'error') throw new Error(body?.message || `Action failed (${res.status})`);
            setActionMessage({ ok: true, text: `${rec.label}: done.` });
            load();
        } catch (e: any) { setActionMessage({ ok: false, text: `${rec.label}: ${e?.message || 'failed'}` }); }
    };

    // CREDENTIAL_LEAK_PHASE3.md §60 — ONE check path. This route now resolves
    // the domain's own monitor and runs the SAME checkMonitorNow() the
    // scheduler uses, so this button and the Domain Monitor card's button can
    // no longer disagree (they used to hit two different Paranoid Lab APIs).
    const checkNow = async () => {
        setBusy(true); setCheckResult(null);
        try { const res = await checkWatchlistDomainNow(domainId); setCheckResult(res); load(); }
        catch (e: any) { setCheckResult({ providerStatus: 'unavailable', detail: e?.message }); } finally { setBusy(false); }
    };
    // §6/§57/§58/§59 MONITOR CREATION / MANUAL CHECK / PAUSE / RESUME — the
    // domain's own Credential Leak monitor, created once then managed
    // entirely through the EXISTING generic monitor API.
    const createMonitor = async () => {
        setBusy(true);
        try { await createCredentialLeakDomainMonitor(domainId); load(); } finally { setBusy(false); }
    };
    const togglePause = async () => {
        if (!detail?.monitor) return;
        setBusy(true);
        try { await updateMonitor(detail.monitor.id, { status: detail.monitor.status === 'active' ? 'paused' : 'active' }); load(); } finally { setBusy(false); }
    };
    const removeMonitor = async () => {
        if (!detail?.monitor) return;
        setBusy(true);
        try { await deleteMonitor(detail.monitor.id); load(); } finally { setBusy(false); }
    };

    if (!detail) return <div className="ti-empty">Loading domain…</div>;

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">{detail.domain.value}
                    <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={checkNow} disabled={busy}>{busy ? 'Checking…' : 'Check Now'}</button>
                </div>
                <div className="ti-kv">
                    <span className="k">Provider</span><span className="v">Paranoid Lab</span>
                    <span className="k">Monitoring Status</span><span className="v"><span className="ti-badge">{detail.monitoringStatus.replace(/_/g, ' ')}</span></span>
                    <span className="k">Last Checked</span><span className="v">{detail.state?.lastCheckedAt ? formatDateTime(detail.state.lastCheckedAt) : 'Never'}</span>
                </div>
                {checkResult && (
                    <div style={{ marginTop: '10px' }}>
                        {checkResult.checked ? (
                            <div className="ti-note" style={{ color: '#4ade80' }}>Check complete — {checkResult.newCount} new change event(s) recorded.</div>
                        ) : checkResult.needsMonitor ? (
                            <div className="ti-note" style={{ color: '#eab308' }}>{checkResult.detail}</div>
                        ) : (
                            <div className="ti-error">Paranoid Lab: {PROVIDER_STATUS_LABEL[checkResult.providerStatus] || checkResult.providerStatus}{checkResult.detail ? ` — ${checkResult.detail}` : ''}</div>
                        )}
                    </div>
                )}
            </div>

            {/* CREDENTIAL_LEAK_PHASE2.md §6/§43 DOMAIN MONITOR CARD */}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Domain Monitor</div>
                {!detail.monitor ? (
                    <button type="button" className="ti-action-btn" onClick={createMonitor} disabled={busy}>{busy ? 'Creating…' : 'Create Monitor'}</button>
                ) : (
                    <>
                        <div className="ti-kv">
                            <span className="k">Monitor Status</span><span className="v"><span className="ti-badge">{detail.monitor.status}</span></span>
                            <span className="k">Last Check</span><span className="v">{detail.monitor.lastCheckedAt ? formatDateTime(detail.monitor.lastCheckedAt) : 'Never'}</span>
                            <span className="k">Next Check</span><span className="v">{detail.monitor.nextCheckAt ? formatDateTime(detail.monitor.nextCheckAt) : '—'}</span>
                            <span className="k">Exposure Count</span><span className="v">{detail.exposureCount}</span>
                            <span className="k">New Exposure</span><span className="v">{detail.newExposureCount}</span>
                            {detail.monitor.lastError && <><span className="k">Last Error</span><span className="v ti-error">{detail.monitor.lastError}</span></>}
                        </div>
                        {/* CREDENTIAL_LEAK_PHASE3.md §119 — honest backfill progress.
                            Each check ingests a bounded slice and resumes from where
                            the last one stopped, so a large domain fills in over
                            successive checks rather than all at once. */}
                        {detail.monitor.backfill && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                                <div className="ti-note" style={{ marginBottom: '6px' }}>
                                    <strong>Provider Backfill</strong>{detail.monitor.backfill.inProgress ? ' — in progress' : ' — up to date'}
                                </div>
                                <div className="ti-kv">
                                    {(['password', 'cookie', 'autofill'] as const).map((type) => {
                                        const b = detail.monitor!.backfill![type];
                                        if (!b) return null;
                                        const label = type.charAt(0).toUpperCase() + type.slice(1);
                                        return (
                                            <React.Fragment key={type}>
                                                <span className="k">{label}</span>
                                                <span className="v">
                                                    {b.ingested.toLocaleString()}
                                                    {b.providerTotal != null ? ` of ${b.providerTotal.toLocaleString()} at the provider` : ''}
                                                    {b.sweepComplete
                                                        ? <span className="ti-note" style={{ marginLeft: '8px', color: '#4ade80' }}>full sweep complete</span>
                                                        : <span className="ti-note" style={{ marginLeft: '8px' }}>resuming at offset {b.nextOffset.toLocaleString()}</span>}
                                                </span>
                                            </React.Fragment>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                            <button type="button" className="ti-action-btn" onClick={checkNow} disabled={busy}>Check Now</button>
                            <button type="button" className="ti-action-btn" onClick={togglePause} disabled={busy}>{detail.monitor.status === 'active' ? 'Pause' : 'Resume'}</button>
                            <button type="button" className="ti-action-btn" onClick={removeMonitor} disabled={busy}>Delete</button>
                        </div>
                    </>
                )}
            </div>

            <div className="ti-kpi-row" style={{ marginBottom: '16px' }}>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.exposureCount}</div><div className="ti-kpi-label">Total Exposure</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.newExposureCount}</div><div className="ti-kpi-label">New Exposure</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.highPriorityCount}</div><div className="ti-kpi-label">High Priority</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.accountCount}</div><div className="ti-kpi-label">Compromised Accounts</div></div>
            </div>
            <div className="ti-kpi-row" style={{ marginBottom: '16px' }}>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.passwordCount}</div><div className="ti-kpi-label">Passwords</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.cookieCount}</div><div className="ti-kpi-label">Cookies</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.autofillCount}</div><div className="ti-kpi-label">Autofills</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.piiCount}</div><div className="ti-kpi-label">PII</div></div>
                <div className="ti-kpi-card" onClick={onOpenExposures} style={{ cursor: 'pointer' }}><div className="ti-kpi-value">{detail.stealerCount}</div><div className="ti-kpi-label">Stealer Records</div></div>
            </div>
            {detail.exposureCount === 0 && detail.state?.lastCheckedAt && (
                <div className="ti-note" style={{ marginBottom: '16px', fontStyle: 'italic' }}>No Credential Exposure Found for this Watchlist Domain. This means no matching exposure was returned by the provider — it does not mean the company is safe.</div>
            )}

            {/* CREDENTIAL_LEAK_PHASE2.md §45 / PHASE3.md §34 EXPOSURE TREND —
                24h/7d/30d/90d, volume only, never interpreted as attack activity. */}
            {trend && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Exposure Trend</div>
                    <div className="ti-kv">
                        <span className="k">Last 24h</span><span className="v">{trend.last24h}</span>
                        <span className="k">Last 7d</span><span className="v">{trend.last7d}</span>
                        <span className="k">Last 30d</span><span className="v">{trend.last30d}</span>
                        <span className="k">Last 90d</span><span className="v">{trend.last90d}</span>
                    </div>
                    {/* §89/§90 FORECAST — deterministic, never a specific predicted event. */}
                    {forecast && (
                        <div className="ti-note" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <strong>Exposure Outlook:</strong> {forecast.direction} (Confidence: {forecast.confidence}) — {forecast.language}
                        </div>
                    )}
                </div>
            )}

            {detail.brandContext?.matched && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Brand Context</div>
                    <div className="ti-note">Tracked by Brand Intelligence: {detail.brandContext.brandName}{detail.brandContext.status ? ` (${detail.brandContext.status})` : ''}</div>
                </div>
            )}

            {/* §49/CASE 17 MISP — on-demand, never Automatically Malicious. */}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">MISP Correlation
                    <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={checkMisp} disabled={mispBusy}>{mispBusy ? 'Checking…' : 'Check MISP'}</button>
                </div>
                {!misp ? <div className="ti-note">Not yet checked.</div> : misp.status === 'not_configured' ? (
                    <div className="ti-note">MISP is not configured.</div>
                ) : misp.status === 'unavailable' ? (
                    <div className="ti-error">MISP check failed{misp.errorMessage ? `: ${misp.errorMessage}` : '.'}</div>
                ) : misp.status === 'match' ? (
                    <ul className="ti-list">{(misp.matches || []).map((m, i) => <li key={i} style={{ padding: '4px 0' }}>MISP Event #{m.mispEventId} — Attribute #{m.mispAttributeId} <span className="ti-note">First Seen: {m.firstSeen || 'Unknown'} · Last Seen: {m.lastSeen || 'Unknown'}</span></li>)}</ul>
                ) : <div className="ti-note">No MISP Match.</div>}
            </div>

            {/* §38 TOP EXPOSED ACCOUNTS — metadata only, never a secret value. */}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Top Exposed Accounts</div>
                {topAccounts.length === 0 ? <div className="ti-empty">None yet.</div> : (
                    <ul className="ti-list">
                        {topAccounts.map((a) => (
                            <li key={a.identifier} style={{ padding: '5px 0' }}>{a.identifier} — {a.exposureTypes.map((t) => <span key={t} className="ti-badge" style={{ marginRight: '4px' }}>{t}</span>)} <span className="ti-note">{a.recordCount} record(s)</span></li>
                        ))}
                    </ul>
                )}
            </div>

            {/* CREDENTIAL_LEAK_PHASE3.md §71-96 AI CREDENTIAL ANALYST — analyst
                triggered only; recommendations are previews, never executed
                without explicit approval (§86/§88). */}
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">AI Exposure Assessment
                    <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={analyzeExposure} disabled={aiBusy}>{aiBusy ? 'Analyzing…' : 'Analyze Exposure'}</button>
                </div>
                {aiError && <div className="ti-error">{aiError}</div>}
                {!aiSummary ? <div className="ti-note">Not yet analyzed.</div> : (
                    <>
                        {aiMeta?.fallback && <div className="ti-note" style={{ fontStyle: 'italic', marginBottom: '6px' }}>AI Unavailable — showing a heuristic summary built directly from real data. Generated: {formatDateTime(aiMeta.generatedAt)}.</div>}
                        <div className="ti-note" style={{ marginBottom: '8px' }}>{aiSummary.assessment}</div>
                        {aiSummary.whatChanged.length > 0 && (
                            <div style={{ marginBottom: '8px' }}><strong>What Changed:</strong>
                                <ul className="ti-list">{aiSummary.whatChanged.map((c, i) => <li key={i} style={{ padding: '2px 0' }}>{c}</li>)}</ul>
                            </div>
                        )}
                        {aiSummary.unknowns.length > 0 && (
                            <div style={{ marginBottom: '8px' }}><strong>Unknown / Not Established:</strong>
                                <ul className="ti-list">{aiSummary.unknowns.map((u, i) => <li key={i} className="ti-note" style={{ padding: '2px 0' }}>{u}</li>)}</ul>
                            </div>
                        )}
                        {aiRecommendations.length > 0 && (
                            <div>
                                <strong>Recommendations</strong>
                                <ul className="ti-list">
                                    {aiRecommendations.map((rec) => (
                                        <li key={rec.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                            <span className="ti-badge">{rec.priority}</span> {rec.label} <span className="ti-note">— {rec.reason}</span>
                                            {rec.stateChanging && rec.actionPreview && (
                                                <button type="button" className="ti-action-btn" style={{ marginLeft: '8px' }} onClick={() => approveAction(rec)}>Approve</button>
                                            )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                        {actionMessage && <div className={actionMessage.ok ? 'ti-note' : 'ti-error'} style={actionMessage.ok ? { color: '#4ade80', marginTop: '8px' } : { marginTop: '8px' }}>{actionMessage.text}</div>}
                        <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Sources: {aiSummary.sources.join(', ') || 'None'}</div>
                    </>
                )}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="ti-card">
                    <div className="ti-card-title">Recent Exposures</div>
                    {detail.recentExposures.length === 0 ? <div className="ti-empty">None yet.</div> : (
                        <ul className="ti-list">
                            {detail.recentExposures.map((e) => (
                                <li key={e.id} style={{ padding: '5px 0' }}><strong>{e.formattedId}</strong> — <span className="ti-badge">{e.exposureType}</span> {e.exposedIdentifier || '(no identifier)'} <span className="ti-note">· {formatDateTime(e.lastSeenAt)}</span></li>
                            ))}
                        </ul>
                    )}
                </div>
                <div className="ti-card">
                    <div className="ti-card-title">Historical Changes</div>
                    {detail.historicalChanges.length === 0 ? <div className="ti-empty">No recorded checks yet.</div> : (
                        <ul className="ti-list">
                            {detail.historicalChanges.map((h) => (
                                <li key={h.id} style={{ padding: '5px 0' }}><span className="ti-badge">{h.action.replace(/^domain_check_/, '').replace(/_/g, ' ')}</span> <span className="ti-note">{h.newValue} · {formatDateTime(h.createdAt)}</span></li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
        </>
    );
};

// §57 DOMAIN LIST / §61/§100/§123 COMPANY OVERVIEW & MONITORING SUMMARY —
// real, summed totals shown above the per-domain table whenever more than
// one domain exists.
const MONITOR_STATUS_LABEL: Record<string, string> = { not_monitored: 'Not Monitored', healthy: 'Healthy', paused: 'Paused', error: 'Error', stale: 'Stale' };
const MONITOR_STATUS_COLOR: Record<string, { background: string; color: string }> = {
    healthy: { background: 'rgba(34,197,94,0.15)', color: '#4ade80' },
    paused: { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    error: { background: 'rgba(239,68,68,0.15)', color: '#f87171' },
    not_monitored: { background: 'rgba(148,163,184,0.1)', color: '#94a3b8' },
    // CREDENTIAL_LEAK_PHASE3.md §7/§64/CASE 26 — a monitor whose Watchlist
    // Domain was removed; distinct from 'error' (a live domain whose checks
    // are failing) so the analyst isn't misled into "retrying" a monitor
    // that has nothing left to point at.
    stale: { background: 'rgba(234,179,8,0.15)', color: '#eab308' },
};
const DomainsView: React.FC<{ domains: WatchlistDomain[]; onSelect: (id: number) => void }> = ({ domains, onSelect }) => {
    const [companyAi, setCompanyAi] = useState<CredentialLeakAiDashboardSummary | null>(null);
    const [companyAiBusy, setCompanyAiBusy] = useState(false);
    const [companyAiFallback, setCompanyAiFallback] = useState(false);
    const analyzeCompany = async () => {
        setCompanyAiBusy(true);
        try { const res = await getCredentialLeakDashboardAiSummary(); setCompanyAi(res.summary); setCompanyAiFallback(res.fallback); } finally { setCompanyAiBusy(false); }
    };
    const totalExposure = domains.reduce((s, d) => s + d.credentialLeak.exposureCount, 0);
    const totalNew = domains.reduce((s, d) => s + d.credentialLeak.newExposureCount, 0);
    const totalHighPriority = domains.reduce((s, d) => s + d.credentialLeak.highPriorityCount, 0);
    const totalPasswords = domains.reduce((s, d) => s + d.credentialLeak.passwordCount, 0);
    const totalCookies = domains.reduce((s, d) => s + d.credentialLeak.cookieCount, 0);
    const totalAutofills = domains.reduce((s, d) => s + d.credentialLeak.autofillCount, 0);
    const totalStealer = domains.reduce((s, d) => s + d.credentialLeak.stealerCount, 0);
    const monitored = domains.filter((d) => d.credentialLeak.monitorStatus !== 'not_monitored').length;
    const healthy = domains.filter((d) => d.credentialLeak.monitorStatus === 'healthy').length;
    const errored = domains.filter((d) => d.credentialLeak.monitorStatus === 'error').length;
    return (
        <>
            {domains.length > 1 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Company Exposure Overview</div>
                    <div className="ti-kv">
                        <span className="k">Domains</span><span className="v">{domains.length}</span>
                        <span className="k">Total Exposure</span><span className="v">{totalExposure}</span>
                        <span className="k">New Exposure</span><span className="v">{totalNew}</span>
                        <span className="k">High Priority</span><span className="v">{totalHighPriority}</span>
                        <span className="k">Passwords</span><span className="v">{totalPasswords}</span>
                        <span className="k">Cookies</span><span className="v">{totalCookies}</span>
                        <span className="k">Autofills</span><span className="v">{totalAutofills}</span>
                        <span className="k">Stealer Records</span><span className="v">{totalStealer}</span>
                    </div>
                    {/* §123 MONITORING SUMMARY */}
                    <div className="ti-note" style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        Monitored: {monitored} · Healthy: {healthy} · Provider Error: {errored}
                    </div>
                    {/* §71/§97 AI EXPOSURE ASSESSMENT — company-wide, analyst triggered. */}
                    <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                        <button type="button" className="ti-action-btn" onClick={analyzeCompany} disabled={companyAiBusy}>{companyAiBusy ? 'Analyzing…' : 'AI Exposure Assessment'}</button>
                        {companyAi && (
                            <div style={{ marginTop: '8px' }}>
                                {companyAiFallback && <div className="ti-note" style={{ fontStyle: 'italic' }}>AI Unavailable — heuristic summary from real data.</div>}
                                <div className="ti-note">{companyAi.executiveSummary}</div>
                            </div>
                        )}
                    </div>
                </div>
            )}
            <div className="ti-table-wrap">
                <table className="ti-table">
                    <thead><tr><th>Domain</th><th>Status</th><th>Monitoring</th><th>Last Check</th><th>Exposure</th><th>New</th><th>High Priority</th></tr></thead>
                    <tbody>
                        {domains.length === 0 ? <tr><td colSpan={7} className="ti-empty">No Watchlist Domains yet.</td></tr> : domains.map((d) => (
                            <tr key={d.id} className="ti-row-clickable" onClick={() => onSelect(d.id)}>
                                <td style={{ fontWeight: 600 }}>{d.value}</td>
                                <td><span className="ti-badge">{d.status}</span></td>
                                <td><span className="ti-badge" style={MONITOR_STATUS_COLOR[d.credentialLeak.monitorStatus]}>{MONITOR_STATUS_LABEL[d.credentialLeak.monitorStatus]}</span></td>
                                <td className="ti-note">{d.credentialLeak.lastCheckedAt ? formatDateTime(d.credentialLeak.lastCheckedAt) : 'Never'}</td>
                                <td>{d.credentialLeak.exposureCount}</td>
                                <td>{d.credentialLeak.newExposureCount}</td>
                                <td>{d.credentialLeak.highPriorityCount}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            {/* CREDENTIAL_LEAK_PHASE3.md §41/§75 CROSS DOMAIN ANALYSIS / AI DOMAIN
                COMPARISON — deterministic, factual side-by-side; never mixes
                baselines (each side is its own independent, RBAC-checked read). */}
            {domains.length > 1 && <DomainComparisonWidget domains={domains} />}
        </>
    );
};

const DomainComparisonWidget: React.FC<{ domains: WatchlistDomain[] }> = ({ domains }) => {
    const [idA, setIdA] = useState<number>(domains[0]?.id);
    const [idB, setIdB] = useState<number>(domains[1]?.id ?? domains[0]?.id);
    const [result, setResult] = useState<{ domainA: any; domainB: any } | null>(null);
    const [busy, setBusy] = useState(false);
    const [err, setErr] = useState<string | null>(null);
    const compare = async () => {
        setBusy(true); setErr(null); setResult(null);
        try { setResult(await compareWatchlistDomains(idA, idB)); } catch (e: any) { setErr(e?.message || 'Failed to compare domains.'); } finally { setBusy(false); }
    };
    return (
        <div className="ti-card" style={{ marginTop: '16px' }}>
            <div className="ti-card-title">Compare Domains</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <ThemedSelect value={String(idA)} onChange={(v) => setIdA(Number(v))} options={domains.map((d) => ({ value: String(d.id), label: d.value }))} style={{ minWidth: '180px' }} ariaLabel="Compare domain A" />
                <span>vs</span>
                <ThemedSelect value={String(idB)} onChange={(v) => setIdB(Number(v))} options={domains.map((d) => ({ value: String(d.id), label: d.value }))} style={{ minWidth: '180px' }} ariaLabel="Compare domain B" />
                <button type="button" className="ti-action-btn" onClick={compare} disabled={busy || idA === idB}>{busy ? 'Comparing…' : 'Compare'}</button>
            </div>
            {err && <div className="ti-error" style={{ marginTop: '8px' }}>{err}</div>}
            {result && (
                <div className="ti-table-wrap" style={{ marginTop: '10px' }}>
                    <table className="ti-table">
                        <thead><tr><th>Metric</th><th>{result.domainA.value}</th><th>{result.domainB.value}</th></tr></thead>
                        <tbody>
                            <tr><td>Exposure</td><td>{result.domainA.exposureCount}</td><td>{result.domainB.exposureCount}</td></tr>
                            <tr><td>New Exposure</td><td>{result.domainA.newExposureCount}</td><td>{result.domainB.newExposureCount}</td></tr>
                            <tr><td>High Priority</td><td>{result.domainA.highPriorityCount}</td><td>{result.domainB.highPriorityCount}</td></tr>
                            <tr><td>Passwords</td><td>{result.domainA.passwordCount}</td><td>{result.domainB.passwordCount}</td></tr>
                            <tr><td>Cookies</td><td>{result.domainA.cookieCount}</td><td>{result.domainB.cookieCount}</td></tr>
                            <tr><td>Monitor</td><td>{result.domainA.monitorStatus}</td><td>{result.domainB.monitorStatus}</td></tr>
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// CREDENTIAL_LEAK_PHASE3.md §99/§101-§105 EXPOSURE BROWSER — presented as a
// provider-console-style record list (filter panel → "Found N items" →
// per-record cards) rather than a dense table, matching the Compromised
// Passwords console analysts already read this data in. Everything it shows
// is our OWN stored, RBAC-scoped data; every filter and every page is applied
// SERVER-side (§104 — never load 89k provider records into the browser).
//
// SECRETS: the provider console renders a masked password with a reveal
// control. LekirraX deliberately CANNOT offer that — §12/§19/§28/§141 forbid
// storing or returning the value, and the normalization layer never reads
// `password`/cookie `data`/autofill `value` into a variable at all. The
// Password/Cookie rows below therefore show presence only, and say so, rather
// than rendering a reveal affordance that could never work.
const RISK_STYLE: Record<string, { background: string; color: string }> = {
    critical: { background: 'rgba(239,68,68,0.18)', color: '#f87171' },
    high:     { background: 'rgba(249,115,22,0.16)', color: '#fb923c' },
    medium:   { background: 'rgba(234,179,8,0.15)',  color: '#eab308' },
    low:      { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
};
const STATUS_STYLE: Record<string, { background: string; color: string }> = {
    new:      { background: 'rgba(0,229,255,0.16)',  color: '#22d3ee' },
    known:    { background: 'rgba(148,163,184,0.15)', color: '#94a3b8' },
    dormant:  { background: 'rgba(234,179,8,0.15)',  color: '#eab308' },
    resolved: { background: 'rgba(34,197,94,0.15)',  color: '#4ade80' },
};
const EXPOSURE_TYPE_LABEL: Record<string, string> = {
    password: 'Password', cookie: 'Cookie', autofill: 'Autofill', pii: 'PII',
};

// Date-only rendering in the provider console's own DD.MM.YYYY form. Parsed
// as UTC so a plain 'YYYY-MM-DD' can never shift a day in a negative-offset
// timezone.
function formatDay(value: string | null | undefined): string {
    if (!value) return 'Unknown';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return String(value);
    const dd = String(d.getUTCDate()).padStart(2, '0');
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

const ExposureCard: React.FC<{
    exposure: CredentialExposure;
    checked: boolean;
    onToggle: () => void;
    onOpen: () => void;
}> = ({ exposure: e, checked, onToggle, onOpen }) => (
    <div className="ti-card cl-exposure-card" style={{ marginBottom: '12px' }}>
        <div className="ti-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <input
                type="checkbox"
                checked={checked}
                onChange={onToggle}
                aria-label={`Select ${e.formattedId}`}
                onClick={(ev) => ev.stopPropagation()}
            />
            <span style={{ flex: 1 }}>{e.domainValue || '—'}</span>
            <span className="ti-badge" style={STATUS_STYLE[e.status]}>{e.status}</span>
        </div>
        <div className="ti-kv">
            {/* "Discovered" = when the provider received/ingested the record
                (uploadedAt ← `recv`); "Compromised" = when the record was
                actually captured (occurredAt ← `stealer_date`). Two genuinely
                different real fields — never the same value shown twice. */}
            <span className="k">Discovered</span>
            <span className="v">{formatDay(e.uploadedAt) === 'Unknown' ? formatDay(e.occurredAt) : formatDay(e.uploadedAt)}</span>

            <span className="k">User</span>
            <span className="v">{e.exposedIdentifier || '—'}</span>

            <span className="k">Exposure Type</span>
            <span className="v"><span className="ti-badge">{EXPOSURE_TYPE_LABEL[e.exposureType] || e.exposureType}</span></span>

            {/* Presence only — see this section's header comment. */}
            <span className="k">Password</span>
            <span className="v">
                {e.hasPassword
                    ? <>••••••••<span className="ti-note" style={{ marginLeft: '8px' }}>Present — value never stored</span></>
                    : <span className="ti-note">Not present</span>}
            </span>

            <span className="k">Cookie</span>
            <span className="v">
                {e.hasCookie
                    ? <>••••••••<span className="ti-note" style={{ marginLeft: '8px' }}>Present — value never stored</span></>
                    : <span className="ti-note">Not present</span>}
            </span>

            <span className="k">URL</span>
            <span className="v">{e.exposedUrl || '—'}</span>

            <span className="k">Risk</span>
            <span className="v">
                {e.riskLevel
                    ? <span className="ti-badge" style={RISK_STYLE[e.riskLevel]}>{e.riskLevel}</span>
                    : <span className="ti-note">Unknown</span>}
            </span>

            <span className="k">Source</span>
            <span className="v">{e.source === 'malware' ? 'Malware (Stealer)' : 'Combo List'}</span>

            <span className="k">Compromised</span>
            <span className="v">{formatDay(e.occurredAt)}</span>

            <span className="k">Record</span>
            <span className="v"><span className="ti-note">{e.formattedId}{e.providerRecordId ? ` · Provider ref ${e.providerRecordId}` : ''}</span></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '10px' }}>
            <button type="button" className="ti-action-btn" onClick={onOpen}>View Detail</button>
        </div>
    </div>
);

const ExposuresView: React.FC<{
    domains: WatchlistDomain[];
    initialDomainId: number | null;
    onViewNotes?: (t: string, id: string, label: string) => void; onCreateThreatBrief?: (t: string, id: string) => void;
}> = ({ domains, initialDomainId, onViewNotes, onCreateThreatBrief }) => {
    const [items, setItems] = useState<CredentialExposure[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const pageSize = 25;
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    // §101/§102/§103 — the full provider-console filter set, every one of
    // which maps to a REAL backend field (§102's own "only if actual backend
    // fields exist"). `domainId: ''` means "every authorized Watchlist Domain".
    const [filters, setFilters] = useState({
        domainId: initialDomainId != null ? String(initialDomainId) : '',
        q: '', user: '', exposureType: 'all', source: 'all', riskLevel: 'all', status: 'all',
        dateFrom: '', dateTo: '', sortBy: 'newest',
        hasIoc: false, hasEvidence: false, hasAlert: false,
    });

    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [caseIdInput, setCaseIdInput] = useState('');
    const [bulkBusy, setBulkBusy] = useState(false);
    const [bulkMessage, setBulkMessage] = useState<{ ok: boolean; text: string } | null>(null);

    // Built once and shared by both the list request and the Export link, so
    // Export can never disagree with what is on screen.
    const buildParams = useCallback(() => {
        const p: Record<string, string> = {};
        if (filters.domainId) p.domainId = filters.domainId;
        if (filters.q.trim()) p.q = filters.q.trim();
        if (filters.user.trim()) p.user = filters.user.trim();
        if (filters.exposureType !== 'all') p.exposureType = filters.exposureType;
        if (filters.source !== 'all') p.source = filters.source;
        if (filters.riskLevel !== 'all') p.riskLevel = filters.riskLevel;
        if (filters.status !== 'all') p.status = filters.status;
        if (filters.dateFrom) p.dateFrom = filters.dateFrom;
        if (filters.dateTo) p.dateTo = filters.dateTo;
        if (filters.sortBy) p.sortBy = filters.sortBy;
        if (filters.hasIoc) p.hasIoc = 'true';
        if (filters.hasEvidence) p.hasEvidence = 'true';
        if (filters.hasAlert) p.hasAlert = 'true';
        return p;
    }, [filters]);

    const load = useCallback((p = 1) => {
        setLoading(true);
        getCredentialExposures({ ...buildParams(), page: p, pageSize })
            .then((d) => { setItems(d.items); setTotal(d.total); setPage(d.page); setSelected(new Set()); })
            .finally(() => setLoading(false));
    }, [buildParams]);

    // Re-query whenever the analyst changes a filter — always from page 1, so
    // a narrowed result set can never leave them stranded on an empty page.
    useEffect(() => { load(1); }, [load]);

    if (selectedId != null) {
        return <ExposureDetailView exposureId={selectedId} onBack={() => { setSelectedId(null); load(page); }} onViewNotes={onViewNotes} onCreateThreatBrief={onCreateThreatBrief} />;
    }

    const set = <K extends keyof typeof filters>(key: K, value: (typeof filters)[K]) =>
        setFilters((f) => ({ ...f, [key]: value }));

    const resetFilters = () => setFilters({
        domainId: '', q: '', user: '', exposureType: 'all', source: 'all', riskLevel: 'all', status: 'all',
        dateFrom: '', dateTo: '', sortBy: 'newest', hasIoc: false, hasEvidence: false, hasAlert: false,
    });

    const toggleSelect = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const toggleSelectAll = () => setSelected((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
    const bulkAddToCase = async () => {
        if (!caseIdInput.trim()) return;
        setBulkBusy(true); setBulkMessage(null);
        try {
            const res = await bulkAddCredentialExposuresToCase([...selected], caseIdInput.trim());
            setBulkMessage({ ok: res.failed === 0, text: `Added ${res.added} of ${res.total} to Case ${caseIdInput.trim()}.${res.failed ? ` ${res.failed} failed.` : ''}` });
        } catch (e: any) { setBulkMessage({ ok: false, text: e?.message || 'Bulk case link failed.' }); } finally { setBulkBusy(false); }
    };
    const exportCurrentView = (format: 'csv' | 'json') => {
        const url = credentialLeakExportUrl({ ...buildParams(), format } as any);
        const a = document.createElement('a');
        a.href = url;
        a.click();
    };

    const scopeLabel = filters.domainId
        ? (domains.find((d) => String(d.id) === filters.domainId)?.value || 'the selected domain')
        : 'all Watchlist Domains';

    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Compromised Credentials</div>
                <div className="ti-note" style={{ marginBottom: '12px' }}>
                    Detected credential exposure across your authorized company Watchlist Domains.
                </div>

                {/* §101/§102 FILTER PANEL — the provider console's own field set,
                    every one backed by a real query parameter. */}
                {/* "ti-filters" is the SAME shared filter-input theme (dark bg,
                    rounded border, cyan focus ring) every other module's own
                    filter panel already uses — its own display:flex is
                    overridden here by the inline grid layout below. */}
                <div className="cl-filter-grid ti-filters" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Email / Domain</span>
                        <ThemedSelect
                            value={filters.domainId}
                            onChange={(v) => set('domainId', v)}
                            options={[{ value: '', label: 'All Watchlist Domains' }, ...domains.map((d) => ({ value: String(d.id), label: d.value }))]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Exposure Type</span>
                        <ThemedSelect
                            value={filters.exposureType}
                            onChange={(v) => set('exposureType', v)}
                            options={[
                                { value: 'all', label: 'All types' }, { value: 'password', label: 'Password' },
                                { value: 'cookie', label: 'Cookie' }, { value: 'autofill', label: 'Autofill' }, { value: 'pii', label: 'PII' },
                            ]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Filter by user</span>
                        <input type="text" placeholder="Enter username or email" value={filters.user} onChange={(e) => set('user', e.target.value)} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Source</span>
                        <ThemedSelect
                            value={filters.source}
                            onChange={(v) => set('source', v)}
                            options={[{ value: 'all', label: 'All sources' }, { value: 'malware', label: 'Malware (Stealer)' }, { value: 'combo', label: 'Combo List' }]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Risk level</span>
                        <ThemedSelect
                            value={filters.riskLevel}
                            onChange={(v) => set('riskLevel', v)}
                            options={[
                                { value: 'all', label: 'All risks' }, { value: 'critical', label: 'Critical' },
                                { value: 'high', label: 'High' }, { value: 'medium', label: 'Medium' }, { value: 'low', label: 'Low' },
                            ]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Status</span>
                        <ThemedSelect
                            value={filters.status}
                            onChange={(v) => set('status', v)}
                            options={[
                                { value: 'all', label: 'All status' }, { value: 'new', label: 'New' }, { value: 'known', label: 'Known' },
                                { value: 'dormant', label: 'Dormant' }, { value: 'resolved', label: 'Resolved' },
                            ]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">From compromised date</span>
                        <input type="date" value={filters.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">To compromised date</span>
                        <input type="date" value={filters.dateTo} onChange={(e) => set('dateTo', e.target.value)} />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Sort by</span>
                        {/* §103 SORTING — only the orders the backend really implements.
                            "Compromised" is the provider's own stealer date. The two
                            "ingested" orders are OUR timestamps, which are identical
                            across every row of a bulk backfill — labelled honestly so
                            they don't look like a sort that does nothing. */}
                        <ThemedSelect
                            value={filters.sortBy}
                            onChange={(v) => set('sortBy', v)}
                            options={[
                                { value: 'newest', label: 'Newest compromised' }, { value: 'oldest', label: 'Oldest compromised' },
                                { value: 'risk', label: 'Risk (critical first)' }, { value: 'newFirst', label: 'Status (new first)' },
                                { value: 'discovered', label: 'First ingested' }, { value: 'lastSeen', label: 'Last ingested' },
                            ]}
                        />
                    </label>
                    <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="ti-note">Search</span>
                        <input type="text" placeholder="Email / URL / provider ref" value={filters.q} onChange={(e) => set('q', e.target.value)} />
                    </label>
                </div>

                {/* §102 — correlation filters; all three are now really applied
                    server-side (the route used to drop them). */}
                <div className="ti-chip-list" style={{ marginTop: '12px' }}>
                    {([['hasIoc', 'Has IOC'], ['hasEvidence', 'Has Evidence'], ['hasAlert', 'Has Alert']] as const).map(([key, label]) => (
                        <span
                            key={key}
                            className="ti-chip"
                            style={filters[key] ? { background: 'rgba(0,229,255,0.16)', borderColor: 'rgba(0,229,255,0.5)' } : undefined}
                            onClick={() => set(key, !filters[key] as never)}
                        >{label}</span>
                    ))}
                    <button type="button" className="ti-action-btn" onClick={resetFilters}>Reset Filters</button>
                </div>
            </div>

            {/* "Found N items" + Export, mirroring the provider console's own
                result header. Counts are the REAL server-side total. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <strong>{loading ? 'Searching…' : `Found ${total.toLocaleString()} item${total === 1 ? '' : 's'}`}</strong>
                <span className="ti-note">across {scopeLabel}</span>
                <span style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                    {items.length > 0 && (
                        <button type="button" className="ti-action-btn" onClick={toggleSelectAll}>
                            {selected.size === items.length ? 'Clear Selection' : 'Select Page'}
                        </button>
                    )}
                    <button type="button" className="ti-action-btn" onClick={() => exportCurrentView('csv')}>Export CSV</button>
                    <button type="button" className="ti-action-btn" onClick={() => exportCurrentView('json')}>Export JSON</button>
                </span>
            </div>

            {/* §51 BULK CASE ACTION — analyst controlled, existing Investigation API. */}
            {selected.size > 0 && (
                <div className="ti-card" style={{ marginBottom: '12px' }}>
                    <div className="ti-card-title">{selected.size} selected</div>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                        <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e) => setCaseIdInput(e.target.value)} style={{ width: '90px' }} />
                        <button type="button" className="ti-action-btn" onClick={bulkAddToCase} disabled={bulkBusy || !caseIdInput.trim()}>Add Selected to Case</button>
                    </div>
                    {bulkMessage && <div className={bulkMessage.ok ? 'ti-note' : 'ti-error'} style={bulkMessage.ok ? { color: '#4ade80', marginTop: '8px' } : { marginTop: '8px' }}>{bulkMessage.text}</div>}
                </div>
            )}

            {loading ? (
                <div className="ti-empty">Loading exposures…</div>
            ) : items.length === 0 ? (
                /* §20/§154 — an empty result is "none returned", never "the
                   company is safe". */
                <div className="ti-empty">
                    No credential exposure records match these filters for {scopeLabel}. This reflects what the provider has returned so far — it is not a statement that no exposure exists.
                </div>
            ) : (
                items.map((e) => (
                    <ExposureCard
                        key={e.id}
                        exposure={e}
                        checked={selected.has(e.id)}
                        onToggle={() => toggleSelect(e.id)}
                        onOpen={() => setSelectedId(e.id)}
                    />
                ))
            )}

            {/* §104 PAGINATION — server side; the browser only ever holds one page. */}
            <Pagination prefix="ti" page={page} totalPages={Math.max(1, Math.ceil(total / pageSize))} total={total} onPrev={() => load(page - 1)} onNext={() => load(page + 1)} prevDisabled={page <= 1 || loading} nextDisabled={page * pageSize >= total || loading} />
        </>
    );
};

// §55 EXPOSURE DETAIL — never a secret.
const ExposureDetailView: React.FC<{
    exposureId: number; onBack: () => void;
    onViewNotes?: (t: string, id: string, label: string) => void; onCreateThreatBrief?: (t: string, id: string) => void;
}> = ({ exposureId, onBack, onViewNotes, onCreateThreatBrief }) => {
    const [detail, setDetail] = useState<CredentialExposureDetail | null>(null);
    const [busy, setBusy] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [caseIdInput, setCaseIdInput] = useState('');
    const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
    const entityType = 'credential_exposure';

    const load = useCallback(() => { getCredentialExposureDetail(exposureId).then(setDetail); }, [exposureId]);
    useEffect(() => { load(); }, [load]);

    if (!detail) return <div className="ti-empty">Loading exposure…</div>;
    const { exposure: e } = detail;

    const review = async (status: CredentialExposureStatus) => {
        if (status !== 'known' && status !== 'resolved') return;
        setBusy(true); setMsg(null);
        try { await reviewCredentialExposure(exposureId, status); setMsg({ ok: true, text: `Marked ${status}.` }); load(); }
        catch (err: any) { setMsg({ ok: false, text: err?.message || 'Failed to update.' }); } finally { setBusy(false); }
    };
    const createEvidence = async () => {
        setBusy(true); setMsg(null);
        try { await addEvidence({ entityType, entityId: exposureId, source: 'Paranoid Lab', description: `${e.formattedId} — ${e.exposureType} exposure for ${e.exposedIdentifier || '(no identifier)'}`.slice(0, 500) }); setMsg({ ok: true, text: 'Evidence created.' }); load(); }
        catch (err: any) { setMsg({ ok: false, text: err?.message || 'Failed to create evidence.' }); } finally { setBusy(false); }
    };
    const addToCase = async () => {
        if (!caseIdInput.trim()) return;
        setBusy(true); setMsg(null);
        try {
            const res = await fetch(`/api/investigations/cases/${encodeURIComponent(caseIdInput.trim())}/targets`, {
                method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                body: JSON.stringify({ entityType, entityId: exposureId }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(body?.message || 'Failed to add to case');
            setMsg({ ok: true, text: `Added to Case ${caseIdInput.trim()}.` }); load();
        } catch (err: any) { setMsg({ ok: false, text: err?.message || 'Failed to add to case.' }); } finally { setBusy(false); }
    };
    const addNote = async () => {
        if (!noteText.trim()) return;
        setBusy(true); setMsg(null);
        try { await createCentralNote({ content: noteText.trim(), entityType, entityId: exposureId }); setNoteText(''); setMsg({ ok: true, text: 'Note added.' }); load(); }
        catch (err: any) { setMsg({ ok: false, text: err?.message || 'Failed to add note.' }); } finally { setBusy(false); }
    };

    return (
        <>
            <button type="button" className="ti-action-btn" onClick={onBack} style={{ marginBottom: '10px' }}>‹ Back to Exposures</button>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">{e.formattedId}</div>
                <div className="ti-kv">
                    <span className="k">Domain</span><span className="v">{e.domainValue}</span>
                    <span className="k">Email / Identifier</span><span className="v">{e.exposedIdentifier || '—'}</span>
                    <span className="k">Type</span><span className="v"><span className="ti-badge">{e.exposureType}</span></span>
                    <span className="k">Source</span><span className="v">{e.source === 'malware' ? 'Malware (Stealer)' : 'Combo List'}</span>
                    <span className="k">URL</span><span className="v">{e.exposedUrl || '—'}</span>
                    <span className="k">Password</span><span className="v">{e.hasPassword ? '•••••••• (protected)' : 'Not present'}</span>
                    <span className="k">Cookie</span><span className="v">{e.hasCookie ? 'Present (protected — metadata only)' : 'Not present'}</span>
                    <span className="k">Discovered At</span><span className="v">{e.occurredAt || 'Unknown'}</span>
                    <span className="k">Last Seen</span><span className="v">{formatDateTime(e.lastSeenAt)}</span>
                    <span className="k">Risk</span><span className="v">{e.riskLevel || 'Unknown'}{e.riskScore != null ? ` (${e.riskScore})` : ''}</span>
                    <span className="k">Status</span><span className="v"><span className="ti-badge">{e.status}</span></span>
                    <span className="k">Provider Reference</span><span className="v">{e.providerRecordId || '—'}</span>
                </div>
                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Password and cookie values are never returned by this application — metadata only.</div>
            </div>

            {detail.relatedIoc && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Related IOC</div>
                    <div className="ti-note">{detail.relatedIoc.type}: {detail.relatedIoc.value} {detail.relatedIoc.risk ? `— Risk: ${detail.relatedIoc.risk}` : ''}</div>
                </div>
            )}
            {detail.brandContext?.matched && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Brand Context</div>
                    <div className="ti-note">Tracked by Brand Intelligence: {detail.brandContext.brandName}</div>
                </div>
            )}
            {/* CREDENTIAL_LEAK_PHASE2.md §40 — real, already-recorded relationships only, never inferred. */}
            {detail.threatIntelligence.length > 0 && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">Threat Intelligence Context</div>
                    <ul className="ti-list">{detail.threatIntelligence.map((r) => <li key={r.id} style={{ padding: '4px 0' }}><span className="ti-badge">{r.relationship_type.replace(/_/g, ' ')}</span> {r.entity.label} <span className="ti-note">({r.entity.type.replace(/_/g, ' ')})</span></li>)}</ul>
                </div>
            )}

            {msg && <div className={msg.ok ? 'ti-note' : 'ti-error'} style={msg.ok ? { color: '#4ade80', marginBottom: '10px' } : { marginBottom: '10px' }}>{msg.text}</div>}

            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Evidence ({detail.evidence.length})</div>
                {detail.evidence.length === 0 ? <div className="ti-empty">No related evidence.</div> : (
                    <ul className="ti-list">{detail.evidence.map((ev) => <li key={ev.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}><strong>{ev.id}</strong> — {ev.description || '(no description)'}<div className="ti-note">Source: {ev.source}</div></li>)}</ul>
                )}
            </div>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Investigations</div>
                {detail.cases.length === 0 ? <div className="ti-empty">No authorized cases reference this exposure.</div> : (
                    <ul className="ti-list">{detail.cases.map((c) => <li key={c.id} style={{ padding: '5px 0' }}><strong>{c.caseNumber}</strong> — {c.title} <span className="ti-badge">{c.status}</span></li>)}</ul>
                )}
            </div>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Notes {onViewNotes && <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={() => onViewNotes(entityType, String(exposureId), e.formattedId)}>View Notes</button>}</div>
                {detail.notes.length === 0 ? <div className="ti-empty">No notes yet.</div> : (
                    <ul className="ti-list">{detail.notes.map((n) => <li key={n.id} className="ti-note" style={{ padding: '5px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>{n.contentPreview} — <em>{n.createdBy}</em>, {formatDateTime(n.createdAt)}</li>)}</ul>
                )}
                <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                    <input type="text" placeholder="Add a note…" value={noteText} onChange={(e2) => setNoteText(e2.target.value)} style={{ flex: 1 }} />
                    <button type="button" className="ti-action-btn" onClick={addNote} disabled={busy || !noteText.trim()}>Add Note</button>
                </div>
            </div>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Timeline</div>
                {detail.timeline.length === 0 ? <div className="ti-empty">No recorded activity.</div> : (
                    <ul className="ti-list">{detail.timeline.map((t) => <li key={t.id} style={{ padding: '5px 0' }}><span className="ti-badge">{t.action.replace(/_/g, ' ')}</span> <span className="ti-note">{t.previousValue && t.newValue ? `${t.previousValue} → ${t.newValue}` : t.newValue} · {formatDateTime(t.createdAt)}</span></li>)}</ul>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-card-title">Analyst Actions</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '10px' }}>
                    <button type="button" className="ti-action-btn" onClick={() => review('known')} disabled={busy}>Mark Known</button>
                    <button type="button" className="ti-action-btn" onClick={() => review('resolved')} disabled={busy}>Mark Resolved</button>
                    <button type="button" className="ti-action-btn" onClick={createEvidence} disabled={busy}>Create Evidence</button>
                    {onCreateThreatBrief && <button type="button" className="ti-action-btn" onClick={() => onCreateThreatBrief(entityType, String(exposureId))}>Add to Threat Brief</button>}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                    <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e2) => setCaseIdInput(e2.target.value)} style={{ width: '100px' }} />
                    <button type="button" className="ti-action-btn" onClick={addToCase} disabled={busy || !caseIdInput.trim()}>Add to Case</button>
                </div>
                <div className="ti-note" style={{ marginTop: '8px', fontStyle: 'italic' }}>Every action calls the existing Investigation/Evidence/Notes/Threat-Brief system directly — nothing is created automatically.</div>
            </div>
        </>
    );
};

export default CredentialLeakIntelligenceHome;
