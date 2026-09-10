import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Radio, Activity, PauseCircle, XCircle, MessageSquare, Image as ImageIcon, Layers, AlertTriangle } from 'lucide-react';
import '../TelegramIntelligence/TelegramIntelligence.css';
import { timeAgo } from '../../../utils/timeAgo';
import { withMinDuration } from '../../../utils/minLoadingDuration';
import TelegramEntitiesPane from './TelegramEntitiesPane';
import TelegramThreatContextPane from './TelegramThreatContextPane';
import KnowledgeContextPanel from '../../KnowledgeBase/KnowledgeContextPanel'; // KNOWLEDGE_BASE_PHASE2.md §16 "KNOWLEDGE TO TELEGRAM"
import {
    addTelegramSource, validateTelegramSource, setTelegramSourceStatus, deleteTelegramSource,
    startTelegramCrawl, getTelegramCrawlJob, cancelTelegramCrawlJob, getTelegramCrawlHistory,
    searchTelegramMessages, getTelegramMessage,
    type SocialTelegramCapability, type TelegramEngineInfo, type TelegramSource, type TelegramDashboard,
    type TelegramCrawlJob, type TelegramMessage, type TelegramSourceType, type TelegramCrawlMode,
    type SocialAccountResult
} from '../../../services/api';

// TELEGRAM_INTELLIGENCE.md §21 "TELEGRAM UI" — preserves the existing Telegram
// section layout (Telegram Client / Source Management / Crawler / Message
// Collection / Incremental Crawl / Crawl History / Message Search) and just
// replaces the blanket "Not Configured" with the real states, then adds the
// Phase 1 working surfaces beneath it. Social Media Intelligence itself is not
// redesigned, and this is NOT a new top-level sidebar module (§1).
//
// §3 — every action here calls a LekirraX API. The browser never touches
// CyberOps TSI, Python, or Telegram directly.
//
// §23 — every number rendered comes from real backend aggregates. There is no
// demo/placeholder data anywhere in this file.

const CAPABILITY_LABELS: Record<string, string> = {
    publicUsernameCheck: 'Public Username Check',
    telegramClient: 'Telegram Client',
    sourceManagement: 'Source Management',
    crawler: 'Crawler',
    messageCollection: 'Message Collection',
    incrementalCrawl: 'Incremental Crawl',
    crawlHistory: 'Crawl History',
    messageSearch: 'Message Search'
};

// §21 — the UI vocabulary. LIMITED is its own state so incremental crawl is
// never shown as plain "Available" (§18).
//
// CONFIGURATION COMPLETION §21 — `BLOCKED_<root>` (Crawler / Message
// Collection / Incremental Crawl when the Telegram Client isn't ready) is
// rendered as "Blocked — <the real root-cause label>" rather than a fifth
// hardcoded string, so it can never drift from the states above it.
function capabilityLabel(value: string): string {
    if (value.startsWith('BLOCKED_')) {
        return `Blocked — ${capabilityLabel(value.slice('BLOCKED_'.length))}`;
    }
    switch (value) {
        case 'AVAILABLE': return 'Available';
        case 'LIMITED': return 'Limited';
        case 'NOT_CONFIGURED': return 'Not Configured';
        case 'AUTH_REQUIRED': return 'Authentication Required';
        case 'DEPENDENCY_MISSING': return 'Dependency Missing';
        case 'UNAVAILABLE': return 'Unavailable';
        default: return value;
    }
}
function capabilityTone(value: string): 'strong' | 'medium' | 'weak' {
    if (value === 'AVAILABLE') return 'strong';
    if (value === 'LIMITED') return 'medium';
    return 'weak';
}

function StateBadge({ value }: { value: string }) {
    return <span className={`smi-strength-badge smi-strength-badge--${capabilityTone(value)}`}>{capabilityLabel(value)}</span>;
}

const SOURCE_TYPES: { value: TelegramSourceType; label: string }[] = [
    { value: 'username', label: 'Username' },
    { value: 'public_link', label: 'Public Link' },
    { value: 'numeric_id', label: 'Numeric ID' }
];

const CRAWL_MODES: { value: TelegramCrawlMode; label: string; hint: string }[] = [
    // CONFIGURATION COMPLETION §13 — a real, bounded verification run (5
    // messages, no media), distinct from every collection mode below it.
    { value: 'test', label: 'Test Collection', hint: 'Verifies the source and the collection pipeline with up to 5 of the most recent messages, text only. Use this before a full collection.' },
    { value: 'initial', label: 'Initial Collection', hint: 'Bounded first collection from the newest messages.' },
    { value: 'historical', label: 'Historical Collection', hint: 'Same walk, still bounded by the configured limits.' },
    { value: 'incremental', label: 'Incremental Collection', hint: 'Only messages newer than the highest already imported.' }
];

const ACTIVE_JOB_STATUSES = ['queued', 'starting', 'running'];

// Keeps the "Searching…" state on the Message Search button visible for at
// least this long, so a fast query doesn't just look like a blink.
const SEARCH_MIN_LOADING_MS = 3000;

interface Props {
    investigationId: number;
    capability: SocialTelegramCapability;
    engine: TelegramEngineInfo;
    sources: TelegramSource[];
    dashboard: TelegramDashboard;
    accounts: SocialAccountResult[];
    onRefresh: () => void;
    onOpenAccount: (accountId: number) => void;
    // TELEGRAM_INTELLIGENCE_PHASE2.md §24-§29 — pre-filled cross-navigation
    // into the EXISTING intelligence modules.
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    // TELEGRAM_INTELLIGENCE_PHASE3.md §37 — "Each finding must link to the
    // existing intelligence module." Threat Actors / Malware / Vulnerabilities
    // / IOCs / Campaigns live on the Threat Intelligence page, which is a
    // top-level view rather than an OSINT module.
    onNavigateToView?: (view: string) => void;
    onOpenKnowledgeEntry?: (id: number) => void;
    onCreateKnowledgeEntry?: (prefill: { title: string; category: string; relatedEntityType: string; relatedEntityId: string }) => void;
}

// `engine` is intentionally NOT destructured: commit 5079f1a removed the
// Collection Engine block that rendered it, which left the binding unused and
// broke `tsc -b` (TS6133). It stays on Props because callers still pass it and
// it documents the workspace payload — only the unused local binding is gone.
const TelegramIntelligencePane: React.FC<Props> = ({
    investigationId, capability, sources, dashboard, accounts, onRefresh, onOpenAccount, onNavigateToModule, onNavigateToView,
    onOpenKnowledgeEntry, onCreateKnowledgeEntry
}) => {
    const [knowledgeSourceId, setKnowledgeSourceId] = useState<number | null>(null);
    const [form, setForm] = useState<{ sourceType: TelegramSourceType; target: string; displayName: string; description: string }>({
        sourceType: 'username', target: '', displayName: '', description: ''
    });
    const [saving, setSaving] = useState(false);
    const [formError, setFormError] = useState<string | null>(null);
    const [busySourceId, setBusySourceId] = useState<number | null>(null);
    const [actionError, setActionError] = useState<string | null>(null);
    const [crawlMode, setCrawlMode] = useState<TelegramCrawlMode>('initial');
    const [activeJob, setActiveJob] = useState<TelegramCrawlJob | null>(dashboard.currentCrawl);

    const [history, setHistory] = useState<TelegramCrawlJob[]>([]);
    const [historyLoaded, setHistoryLoaded] = useState(false);

    const [search, setSearch] = useState({ q: '', sourceId: '', messageType: '', dateFrom: '', dateTo: '' });
    const [messages, setMessages] = useState<TelegramMessage[]>([]);
    const [messageTotal, setMessageTotal] = useState(0);
    const [searching, setSearching] = useState(false);
    const [selectedMessage, setSelectedMessage] = useState<TelegramMessage | null>(null);

    const engineReady = capability.crawler === 'AVAILABLE';

    const loadHistory = useCallback(() => {
        getTelegramCrawlHistory(investigationId, { pageSize: 25 })
            .then((res) => { setHistory(res.items); setHistoryLoaded(true); })
            .catch(() => setHistoryLoaded(true));
    }, [investigationId]);

    const runSearch = useCallback(() => {
        setSearching(true);
        // A search against a small/local result set often resolves in well
        // under 100ms, which made the "Searching…" state flash on and back
        // off so fast it read as the button blinking rather than loading.
        // withMinDuration keeps it visible for at least SEARCH_MIN_LOADING_MS
        // without ever slowing down a genuinely slow search.
        withMinDuration(
            searchTelegramMessages(investigationId, {
                q: search.q || undefined,
                sourceId: search.sourceId ? Number(search.sourceId) : undefined,
                messageType: (search.messageType || undefined) as 'text' | 'media' | 'service' | undefined,
                dateFrom: search.dateFrom || undefined,
                dateTo: search.dateTo || undefined,
                pageSize: 50
            }),
            SEARCH_MIN_LOADING_MS
        )
            .then((res) => { setMessages(res.items); setMessageTotal(res.total); })
            .catch(() => { setMessages([]); setMessageTotal(0); })
            .finally(() => setSearching(false));
    }, [investigationId, search]);

    useEffect(() => { loadHistory(); }, [loadHistory]);
    useEffect(() => { runSearch(); /* initial load only */ // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [investigationId]);

    // §38 — the UI polls a job id; it never blocks on the collection itself.
    useEffect(() => {
        if (!activeJob || !ACTIVE_JOB_STATUSES.includes(activeJob.status)) return;
        const t = setTimeout(() => {
            getTelegramCrawlJob(activeJob.id)
                .then((job) => {
                    setActiveJob(job);
                    if (!ACTIVE_JOB_STATUSES.includes(job.status)) {
                        loadHistory();
                        runSearch();
                        onRefresh();
                    }
                })
                .catch(() => { /* keep the last known state; a poll failure is not a job failure */ });
        }, 3000);
        return () => clearTimeout(t);
    }, [activeJob, loadHistory, runSearch, onRefresh]);

    const telegramAccounts = useMemo(() => accounts.filter((a) => a.platform === 'Telegram'), [accounts]);

    const saveSource = async () => {
        if (!form.target.trim()) return;
        setSaving(true); setFormError(null);
        try {
            await addTelegramSource(investigationId, {
                sourceType: form.sourceType,
                target: form.target.trim(),
                displayName: form.displayName.trim() || undefined,
                description: form.description.trim() || undefined
            });
            setForm({ sourceType: 'username', target: '', displayName: '', description: '' });
            onRefresh();
        } catch (err: any) {
            setFormError(err?.message || 'Failed to save the Telegram source.');
        } finally {
            setSaving(false);
        }
    };

    const doValidate = async (sourceId: number) => {
        setBusySourceId(sourceId); setActionError(null);
        try {
            await validateTelegramSource(sourceId);
            onRefresh();
        } catch (err: any) {
            setActionError(err?.message || 'Validation failed.');
        } finally {
            setBusySourceId(null);
        }
    };

    const doCrawl = async (sourceId: number) => {
        setBusySourceId(sourceId); setActionError(null);
        try {
            const res = await startTelegramCrawl(sourceId, { mode: crawlMode });
            const job = await getTelegramCrawlJob(res.jobId);
            setActiveJob(job);
            onRefresh();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to start the crawl.');
        } finally {
            setBusySourceId(null);
        }
    };

    const doCancel = async () => {
        if (!activeJob) return;
        setActionError(null);
        try {
            await cancelTelegramCrawlJob(activeJob.id);
            const job = await getTelegramCrawlJob(activeJob.id);
            setActiveJob(job);
        } catch (err: any) {
            setActionError(err?.message || 'Failed to cancel the crawl.');
        }
    };

    const doToggleStatus = async (source: TelegramSource) => {
        setBusySourceId(source.id); setActionError(null);
        try {
            await setTelegramSourceStatus(source.id, source.status === 'paused' ? 'active' : 'paused');
            onRefresh();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to update the source.');
        } finally {
            setBusySourceId(null);
        }
    };

    const doDelete = async (sourceId: number) => {
        setBusySourceId(sourceId); setActionError(null);
        try {
            await deleteTelegramSource(sourceId);
            onRefresh();
        } catch (err: any) {
            setActionError(err?.message || 'Failed to delete the source.');
        } finally {
            setBusySourceId(null);
        }
    };

    const openMessage = async (id: number) => {
        try {
            setSelectedMessage(await getTelegramMessage(id));
        } catch { /* leave the list as-is */ }
    };

    return (
        <>
            {/* §21 — the existing capability layout, now with REAL states. */}
            <div className="smi-card">
                <div className="smi-card-title">Telegram Intelligence</div>
                <div className="smi-overview-grid">
                    {Object.entries(capability).map(([k, v]) => (
                        <div className="smi-kv" key={k}>
                            <span className="k">{CAPABILITY_LABELS[k] || k}</span>
                            <span className="v"><StateBadge value={v as string} /></span>
                        </div>
                    ))}
                </div>

                {/* Collection Engine provenance block removed per analyst request —
                    engine name/version/license/state/telethon/python/session and
                    the incremental/platform/upstream notes are no longer shown
                    here. The `engine` prop is still accepted (unused in this
                    render) so nothing upstream needs to change. */}
            </div>

            {/* §23 "TELEGRAM SOURCE DASHBOARD" — all real aggregates. */}
            <div className="smi-card">
                <div className="smi-card-title">Source Dashboard</div>
                <div className="smi-summary">
                    <div className="smi-summary-card"><span className="ti-stat-icon" aria-hidden="true"><Radio size={13} /></span><span className="smi-summary-label">Configured</span><span className="smi-summary-value">{dashboard.configuredSources}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon" aria-hidden="true"><Activity size={13} /></span><span className="smi-summary-label">Active</span><span className="smi-summary-value">{dashboard.activeSources}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon ti-stat-icon--muted" aria-hidden="true"><PauseCircle size={13} /></span><span className="smi-summary-label">Paused</span><span className="smi-summary-value">{dashboard.pausedSources}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon ti-stat-icon--danger" aria-hidden="true"><XCircle size={13} /></span><span className="smi-summary-label">Failed</span><span className="smi-summary-value">{dashboard.failedSources}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon" aria-hidden="true"><MessageSquare size={13} /></span><span className="smi-summary-label">Messages</span><span className="smi-summary-value">{dashboard.messagesCollected}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon" aria-hidden="true"><ImageIcon size={13} /></span><span className="smi-summary-label">Media</span><span className="smi-summary-value">{dashboard.mediaCollected}</span></div>
                    {/* TELEGRAM_INTELLIGENCE_PHASE4_CORRECTION.md §10 "TELEGRAM OVERVIEW". */}
                    <div className="smi-summary-card"><span className="ti-stat-icon" aria-hidden="true"><Layers size={13} /></span><span className="smi-summary-label">Collections</span><span className="smi-summary-value">{dashboard.totalCollections}</span></div>
                    <div className="smi-summary-card"><span className="ti-stat-icon ti-stat-icon--warn" aria-hidden="true"><AlertTriangle size={13} /></span><span className="smi-summary-label">Failed Collections</span><span className="smi-summary-value">{dashboard.failedCollections}</span></div>
                </div>
                <div className="smi-overview-grid">
                    <div className="smi-kv"><span className="k">Last Successful Crawl</span><span className="v">{dashboard.lastSuccessfulCrawl ? timeAgo(dashboard.lastSuccessfulCrawl) : '—'}</span></div>
                    <div className="smi-kv"><span className="k">Current Crawl</span><span className="v">{activeJob && ACTIVE_JOB_STATUSES.includes(activeJob.status) ? `${activeJob.status} (job #${activeJob.id})` : 'None'}</span></div>
                    <div className="smi-kv"><span className="k">Last Error</span><span className="v">{dashboard.lastError || '—'}</span></div>
                </div>

                {activeJob && ACTIVE_JOB_STATUSES.includes(activeJob.status) && (
                    <div className="smi-signal-note">
                        Crawl job #{activeJob.id} is {activeJob.status}. Imported {activeJob.messagesImported} of {activeJob.messagesRetrieved} retrieved.
                        {' '}
                        <button type="button" className="smi-btn smi-btn--sm" onClick={doCancel}>Cancel Crawl</button>
                    </div>
                )}
                {actionError && <div className="smi-error" style={{ marginTop: '10px' }}>{actionError}</div>}
            </div>

            {/* §10 "SOURCE FORM" — Validate and Save are separate actions.
                id: TELEGRAM_INTELLIGENCE_PHASE4_CORRECTION.md §4 — the
                landing page's "Add Telegram Source" primary action scrolls here. */}
            <div className="smi-card" id="telegram-add-source">
                <div className="smi-card-title">Add Telegram Source</div>
                <div className="smi-overview-grid">
                    <label className="smi-kv">
                        <span className="k">Source Type</span>
                        <span className="v">
                            <select
                                value={form.sourceType}
                                onChange={(e) => setForm((f) => ({ ...f, sourceType: e.target.value as TelegramSourceType }))}
                                aria-label="Telegram source type"
                            >
                                {SOURCE_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Target</span>
                        <span className="v">
                            <input
                                type="text" value={form.target} placeholder="examplechannel"
                                onChange={(e) => { setForm((f) => ({ ...f, target: e.target.value })); setFormError(null); }}
                                aria-label="Telegram target"
                            />
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Display Name</span>
                        <span className="v">
                            <input
                                type="text" value={form.displayName} placeholder="Example Threat Channel"
                                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                                aria-label="Telegram source display name"
                            />
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Description</span>
                        <span className="v">
                            <input
                                type="text" value={form.description} placeholder="Optional analyst note"
                                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                                aria-label="Telegram source description"
                            />
                        </span>
                    </label>
                </div>
                <button type="button" className="smi-btn smi-btn--primary" onClick={saveSource} disabled={saving || !form.target.trim()} style={{ marginTop: '12px' }}>
                    {saving ? 'Saving…' : 'Save Source'}
                </button>
                {formError && <div className="smi-error" style={{ marginTop: '10px' }}>{formError}</div>}
            </div>

            {/* §9 Source Management + §12 crawl execution.
                id: TELEGRAM_INTELLIGENCE_PHASE4_CORRECTION.md §4 — the
                landing page's "Start Collection" secondary action scrolls
                here (collection is started per-source, from this table). */}
            <div className="smi-card" id="telegram-configured-sources">
                <div className="smi-card-title">Configured Sources</div>
                {sources.length === 0 ? (
                    <div className="smi-empty">No Telegram sources configured yet.</div>
                ) : (
                    <>
                        <label className="smi-kv" style={{ marginBottom: '10px' }}>
                            <span className="k">Collection Mode</span>
                            <span className="v">
                                <select value={crawlMode} onChange={(e) => setCrawlMode(e.target.value as TelegramCrawlMode)} aria-label="Collection mode">
                                    {CRAWL_MODES.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </span>
                        </label>
                        <div className="smi-signal-note">{CRAWL_MODES.find((m) => m.value === crawlMode)?.hint}</div>

                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead>
                                    <tr>
                                        <th>Target</th><th>Type</th><th>Status</th><th>Validation</th>
                                        <th>Messages</th><th>Media</th><th>Last Crawl</th><th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sources.map((s) => (
                                        <tr key={s.id}>
                                            <td data-label="Target">
                                                <div className="smi-mono">{s.target}</div>
                                                {s.displayName && <div className="smi-muted">{s.displayName}</div>}
                                            </td>
                                            <td data-label="Type">{SOURCE_TYPES.find((t) => t.value === s.sourceType)?.label || s.sourceType}</td>
                                            <td data-label="Status"><span className={`smi-inv-badge smi-inv-badge--${s.status === 'active' ? 'completed' : s.status === 'paused' ? 'running' : 'failed'}`}>{s.status.toUpperCase()}</span></td>
                                            <td data-label="Validation">
                                                <StateBadge value={s.validationState} />
                                                {s.validationMessage && <div className="smi-muted">{s.validationMessage}</div>}
                                            </td>
                                            <td data-label="Messages">{s.messagesCollected ?? 0}</td>
                                            <td data-label="Media">{s.mediaCollected ?? 0}</td>
                                            <td data-label="Last Crawl">{s.lastCrawlAt ? timeAgo(s.lastCrawlAt) : '—'}</td>
                                            <td data-label="Actions">
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={() => doValidate(s.id)} disabled={busySourceId === s.id}>Validate</button>
                                                {' '}
                                                <button
                                                    type="button" className="smi-btn smi-btn--sm"
                                                    onClick={() => doCrawl(s.id)}
                                                    disabled={busySourceId === s.id || !engineReady || s.validationState !== 'VALID' || s.status === 'paused'}
                                                    title={
                                                        !engineReady ? 'The collection engine is not available.'
                                                            : s.validationState !== 'VALID' ? 'Validate this source successfully first.'
                                                                : s.status === 'paused' ? 'This source is paused.' : 'Start a bounded collection'
                                                    }
                                                >
                                                    Start Crawl
                                                </button>
                                                {' '}
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={() => doToggleStatus(s)} disabled={busySourceId === s.id}>
                                                    {s.status === 'paused' ? 'Resume' : 'Pause'}
                                                </button>
                                                {' '}
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={() => doDelete(s.id)} disabled={busySourceId === s.id}>Delete</button>
                                                {' '}
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={() => setKnowledgeSourceId((cur) => (cur === s.id ? null : s.id))}>
                                                    {knowledgeSourceId === s.id ? 'Hide Knowledge' : 'Knowledge'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                    {/* KNOWLEDGE_BASE_PHASE2.md §16 "KNOWLEDGE TO TELEGRAM" */}
                                    {knowledgeSourceId != null && (
                                        <tr>
                                            <td colSpan={8} style={{ padding: 0, border: 'none' }}>
                                                <KnowledgeContextPanel
                                                    entityType="telegram_source" entityId={knowledgeSourceId}
                                                    entityLabel={sources.find((s) => s.id === knowledgeSourceId)?.displayName || sources.find((s) => s.id === knowledgeSourceId)?.target || 'Telegram Source'}
                                                    defaultCategory="Telegram" onOpenEntry={onOpenKnowledgeEntry} onCreateKnowledgeEntry={onCreateKnowledgeEntry}
                                                />
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* §20 "CRAWL HISTORY". */}
            <div className="smi-card">
                <div className="smi-card-title">Crawl History</div>
                {!historyLoaded ? (
                    <div className="smi-loading">Loading…</div>
                ) : history.length === 0 ? (
                    <div className="smi-empty">No Telegram crawls have run yet.</div>
                ) : (
                    <div className="smi-table-wrap">
                        <table className="smi-table">
                            <thead>
                                <tr>
                                    <th>Job</th><th>Source</th><th>Mode</th><th>Status</th>
                                    <th>Retrieved</th><th>Imported</th><th>Media</th><th>Started</th><th>Error</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((j) => (
                                    <tr key={j.id}>
                                        <td data-label="Job">#{j.id}</td>
                                        <td data-label="Source" className="smi-mono">{j.sourceTarget || j.sourceId}</td>
                                        <td data-label="Mode">{j.mode}</td>
                                        <td data-label="Status">
                                            <span className={`smi-inv-badge smi-inv-badge--${j.status === 'completed' ? 'completed' : j.status === 'partial' ? 'running' : j.status === 'failed' ? 'failed' : 'running'}`}>
                                                {j.status.toUpperCase()}
                                            </span>
                                            {j.truncatedReason && <div className="smi-muted">{j.truncatedReason}</div>}
                                        </td>
                                        <td data-label="Retrieved">{j.messagesRetrieved}</td>
                                        <td data-label="Imported">{j.messagesImported}</td>
                                        <td data-label="Media">{j.mediaImported}</td>
                                        <td data-label="Started">{j.startedAt ? timeAgo(j.startedAt) : '—'}</td>
                                        <td data-label="Error">{j.lastError || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* TELEGRAM_INTELLIGENCE_PHASE2.md §33/§34/§35 — Message Intelligence.
                Operates on messages Phase 1 already collected (§3). */}
            <TelegramEntitiesPane
                investigationId={investigationId}
                sources={sources}
                onNavigateToModule={onNavigateToModule}
            />

            {/* TELEGRAM_INTELLIGENCE_PHASE3.md §5-§20 / §29-§40 — CTI
                correlation, monitoring, risk, timeline and AI summary. Every
                one of these reuses an existing LekirraX system (§2/§21/§31). */}
            <TelegramThreatContextPane
                investigationId={investigationId}
                sources={sources}
                onNavigateToModule={onNavigateToModule}
                onNavigateToView={onNavigateToView}
            />

            {/* §24 "MESSAGE SEARCH" — server-side; no IOC/malware/actor search here. */}
            <div className="smi-card">
                <div className="smi-card-title">Message Search</div>
                <div className="smi-overview-grid">
                    <label className="smi-kv">
                        <span className="k">Keyword</span>
                        <span className="v">
                            <input type="text" value={search.q} placeholder="Search message text"
                                onChange={(e) => setSearch((s) => ({ ...s, q: e.target.value }))}
                                onKeyDown={(e) => e.key === 'Enter' && runSearch()} aria-label="Message keyword" />
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Source</span>
                        <span className="v">
                            <select value={search.sourceId} onChange={(e) => setSearch((s) => ({ ...s, sourceId: e.target.value }))} aria-label="Filter by source">
                                <option value="">All Sources</option>
                                {sources.map((s) => <option key={s.id} value={s.id}>{s.displayName || s.target}</option>)}
                            </select>
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">Message Type</span>
                        <span className="v">
                            <select value={search.messageType} onChange={(e) => setSearch((s) => ({ ...s, messageType: e.target.value }))} aria-label="Filter by message type">
                                <option value="">All Types</option>
                                <option value="text">Text</option>
                                <option value="media">Media</option>
                                <option value="service">Service</option>
                            </select>
                        </span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">From</span>
                        <span className="v"><input type="date" value={search.dateFrom} onChange={(e) => setSearch((s) => ({ ...s, dateFrom: e.target.value }))} aria-label="From date" /></span>
                    </label>
                    <label className="smi-kv">
                        <span className="k">To</span>
                        <span className="v"><input type="date" value={search.dateTo} onChange={(e) => setSearch((s) => ({ ...s, dateTo: e.target.value }))} aria-label="To date" /></span>
                    </label>
                </div>
                <button type="button" className="smi-btn smi-btn--primary" onClick={runSearch} disabled={searching} style={{ marginTop: '12px' }}>
                    {searching ? 'Searching…' : 'Search'}
                </button>

                {messages.length === 0 ? (
                    <div className="smi-empty" style={{ marginTop: '12px' }}>
                        {searching ? 'Searching…' : 'No collected Telegram messages match this search.'}
                    </div>
                ) : (
                    <>
                        <div className="smi-card-subtitle">{messageTotal} message(s) matched</div>
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>Message ID</th><th>Source</th><th>Timestamp</th><th>Type</th><th>Content</th><th>Media</th><th></th></tr></thead>
                                <tbody>
                                    {messages.map((m) => (
                                        <tr key={m.id}>
                                            <td data-label="Message ID" className="smi-mono">{m.telegramMessageId}</td>
                                            <td data-label="Source" className="smi-mono">{m.sourceDisplayName || m.sourceTarget}</td>
                                            <td data-label="Timestamp">{m.messageDate ? new Date(m.messageDate).toLocaleString() : '—'}</td>
                                            <td data-label="Type">{m.messageType}</td>
                                            <td data-label="Content">{m.messageText ? (m.messageText.length > 140 ? `${m.messageText.slice(0, 140)}…` : m.messageText) : '—'}</td>
                                            <td data-label="Media">{m.mediaCount ?? 0}</td>
                                            <td data-label="Action"><button type="button" className="smi-btn smi-btn--sm" onClick={() => openMessage(m.id)}>Details</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
            </div>

            {/* §25 "MESSAGE DETAILS" — no session or internal crawler data. */}
            {selectedMessage && (
                <div className="smi-card">
                    <div className="smi-card-title">Message Detail</div>
                    <div className="smi-overview-grid">
                        <div className="smi-kv"><span className="k">Message ID</span><span className="v smi-mono">{selectedMessage.telegramMessageId}</span></div>
                        <div className="smi-kv"><span className="k">Source</span><span className="v smi-mono">{selectedMessage.sourceDisplayName || selectedMessage.sourceTarget}</span></div>
                        <div className="smi-kv"><span className="k">Timestamp</span><span className="v">{selectedMessage.messageDate ? new Date(selectedMessage.messageDate).toLocaleString() : '—'}</span></div>
                        <div className="smi-kv"><span className="k">Sender</span><span className="v smi-mono">{selectedMessage.senderId || '—'}</span></div>
                        <div className="smi-kv"><span className="k">Reply To</span><span className="v">{selectedMessage.replyToMessageId ?? '—'}</span></div>
                        <div className="smi-kv"><span className="k">Forwarded From</span><span className="v">{selectedMessage.forwardedFrom || '—'}</span></div>
                        <div className="smi-kv"><span className="k">Collected</span><span className="v">{selectedMessage.collectedAt ? timeAgo(selectedMessage.collectedAt) : '—'}</span></div>
                        <div className="smi-kv">
                            <span className="k">Public URL</span>
                            <span className="v">
                                {selectedMessage.publicUrl
                                    ? <a href={selectedMessage.publicUrl} target="_blank" rel="noopener noreferrer" title="Opens an external site — you will be leaving LekirraX">Open ↗</a>
                                    : '—'}
                            </span>
                        </div>
                    </div>
                    <div className="smi-card-subtitle">Content</div>
                    <p>{selectedMessage.messageText || 'No text content.'}</p>
                    <div className="smi-card-subtitle">Media</div>
                    {!selectedMessage.media || selectedMessage.media.length === 0 ? (
                        <div className="smi-empty">No media attached to this message.</div>
                    ) : (
                        <div className="smi-table-wrap">
                            <table className="smi-table">
                                <thead><tr><th>File</th><th>Type</th><th>Size</th><th>Availability</th></tr></thead>
                                <tbody>
                                    {selectedMessage.media.map((md) => (
                                        <tr key={md.id}>
                                            <td data-label="File" className="smi-mono">{md.fileName || '—'}</td>
                                            <td data-label="Type">{md.mediaType || '—'}</td>
                                            <td data-label="Size">{md.fileSize != null ? `${Math.round(md.fileSize / 1024)} KB` : '—'}</td>
                                            <td data-label="Availability">
                                                <span className={`smi-strength-badge smi-strength-badge--${md.available ? 'strong' : 'weak'}`}>
                                                    {md.available ? 'Stored' : 'Not stored'}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <button type="button" className="smi-btn smi-btn--sm" style={{ marginTop: '12px' }} onClick={() => setSelectedMessage(null)}>Close</button>
                </div>
            )}

            {/* Phase 1/2 public-username discovery — unchanged, still real. */}
            <div className="smi-card">
                <div className="smi-card-title">Telegram Accounts Discovered</div>
                {telegramAccounts.length === 0 ? (
                    <div className="smi-empty">No Telegram accounts discovered for this username.</div>
                ) : (
                    <div className="smi-table-wrap">
                        <table className="smi-table">
                            <thead><tr><th>Username</th><th>Status</th><th></th></tr></thead>
                            <tbody>
                                {telegramAccounts.map((a) => (
                                    <tr key={a.id}>
                                        <td data-label="Username" className="smi-mono">{a.username}</td>
                                        <td data-label="Status">{a.status}</td>
                                        <td data-label="Action">
                                            {a.status === 'FOUND' && (
                                                <button type="button" className="smi-btn smi-btn--sm" onClick={() => onOpenAccount(a.id)}>Details</button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    );
};

export default TelegramIntelligencePane;
