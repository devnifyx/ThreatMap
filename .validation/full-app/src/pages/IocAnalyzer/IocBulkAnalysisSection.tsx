// IOC_PHASE2.md — Bulk IOC Analysis, Cross IOC Correlation, IOC Evolution &
// Operational Context. §2 "CRITICAL PRINCIPLE" — still an analysis layer:
// every action below calls an EXISTING API (Case targets / Evidence /
// Notes / Monitors) directly, per selected item, only on explicit analyst
// click — nothing here is auto-triggered by analysis.
import React, { useEffect, useRef, useState } from 'react';
import { RiskBadge } from '../ThreatIntelligence/ThreatIntelligenceShared';
import Pagination from '../../components/shared/Pagination';  // P2-8
import { downloadBlob } from '../../components/shared/downloadFile';  // P1-5 — was open-coded here
import {
    submitIocBulkAnalysis, getIocBulkJob, getIocBulkJobResults, cancelIocBulkJob, addEvidence, createCentralNote,
    type IocBulkJob, type IocBulkResults, type IocBulkItem,
    // IOC_PHASE3.md §6/§7/§54 — "ANALYZE RESULTS WITH AI".
    getIocBulkAiSummary, type IocBulkAiSummaryResponse,
    approveAiRecommendation, type AiRecommendation, type AiActionPreview,
} from '../../services/api';

interface Props {
    onOpenEntity?: (entityType: string, entityId: string) => void;
    onNavigate?: (view: string) => void;
}

const MONITOR_TYPE_FOR: Record<string, string> = { domain: 'domain', ipv4: 'ip', ipv6: 'ip', md5: 'hash', sha1: 'hash', sha256: 'hash', email: 'email', url: 'url' };
const ENTITY_TYPE_FOR = (item: IocBulkItem) => (item.type === 'cve' ? 'vulnerability' : 'ioc');
const ENTITY_ID_FOR = (item: IocBulkItem) => (item.type === 'cve' ? item.vulnerabilityId : item.iocId);

const IocBulkAnalysisSection: React.FC<Props> = ({ onOpenEntity }) => {
    const [input, setInput] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [job, setJob] = useState<IocBulkJob | null>(null);
    const [results, setResults] = useState<IocBulkResults | null>(null);
    const [selected, setSelected] = useState<Set<number>>(new Set());
    const [actionMessage, setActionMessage] = useState<{ ok: boolean; text: string } | null>(null);
    const [actionBusy, setActionBusy] = useState(false);
    const [caseIdInput, setCaseIdInput] = useState('');
    const [noteText, setNoteText] = useState('');

    // IOC_PHASE3.md §6/§7/§54 "ANALYZE RESULTS WITH AI" — on-demand only
    // (never automatic on every completed job, §60 rate limiting); a
    // failed/unavailable AI call never blocks the deterministic results above.
    const [aiSummary, setAiSummary] = useState<IocBulkAiSummaryResponse | null>(null);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [previewRec, setPreviewRec] = useState<AiRecommendation | null>(null);
    const [approving, setApproving] = useState(false);
    const [approveResult, setApproveResult] = useState<{ ok: boolean; message: string } | null>(null);

    const analyzeWithAi = async () => {
        if (!job) return;
        setAiLoading(true); setAiError(null);
        try {
            const summary = await getIocBulkAiSummary(job.id);
            setAiSummary(summary);
        } catch (err: any) {
            setAiError(err?.message || 'Failed to generate AI summary');
        } finally {
            setAiLoading(false);
        }
    };
    const openPreview = (rec: AiRecommendation) => { setApproveResult(null); setPreviewRec(rec); };
    const closePreview = () => { setPreviewRec(null); setApproveResult(null); };
    const approveRecommendation = async (preview: AiActionPreview) => {
        setApproving(true); setApproveResult(null);
        try {
            await approveAiRecommendation(preview);
            setApproveResult({ ok: true, message: 'Action completed — the existing API confirmed the result.' });
            analyzeWithAi();
        } catch (err: any) {
            const message = err?.status === 403 ? 'Permission Required — you do not have permission to perform this action.' : (err?.message || 'The action could not be completed.');
            setApproveResult({ ok: false, message });
        } finally {
            setApproving(false);
        }
    };

    // §51-54 SEARCH / FILTERS / SORTING / PAGINATION
    const [q, setQ] = useState('');
    const [filters, setFilters] = useState({ type: 'all', risk: 'all', status: 'all', existing: 'all', mispMatch: 'all', hasEvidence: 'all', hasAlert: 'all', hasMonitor: 'all' });
    const [sortBy, setSortBy] = useState('input_order');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
    const [page, setPage] = useState(1);
    const pageSize = 25;

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const stopPolling = () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
    useEffect(() => () => stopPolling(), []);

    const loadResults = async (jobId: number, pageOverride = page) => {
        const params: Record<string, string> = { page: String(pageOverride), pageSize: String(pageSize), sortBy, sortDir };
        if (q.trim()) params.q = q.trim();
        if (filters.type !== 'all') params.type = filters.type;
        if (filters.risk !== 'all') params.risk = filters.risk;
        if (filters.status !== 'all') params.status = filters.status;
        if (filters.existing !== 'all') params.existing = filters.existing;
        if (filters.mispMatch !== 'all') params.mispMatch = 'true';
        if (filters.hasEvidence !== 'all') params.hasEvidence = 'true';
        if (filters.hasAlert !== 'all') params.hasAlert = 'true';
        if (filters.hasMonitor !== 'all') params.hasMonitor = 'true';
        const data = await getIocBulkJobResults(jobId, params);
        setResults(data);
        setJob(data.job);
    };

    const submit = async () => {
        if (!input.trim()) { setError('Enter at least one IOC (one per line).'); return; }
        setSubmitting(true); setError(null); setResults(null); setJob(null); setSelected(new Set());
        setAiSummary(null); setAiError(null); // a new batch invalidates any prior AI summary
        try {
            const { status, data } = await submitIocBulkAnalysis(input);
            if (status === 200) {
                // §11 — small batch, already fully processed synchronously.
                setJob(data.job || null);
                setResults(data as any);
            } else {
                // §11/§66 — large batch: 202 + jobId, poll until terminal (§12 real progress).
                const j = await getIocBulkJob(data.jobId);
                setJob(j);
                pollRef.current = setInterval(async () => {
                    try {
                        const latest = await getIocBulkJob(data.jobId);
                        setJob(latest);
                        if (['completed', 'partial', 'failed', 'cancelled'].includes(latest.status)) {
                            stopPolling();
                            await loadResults(data.jobId, 1);
                        }
                    } catch { /* transient — keep polling */ }
                }, 1500);
            }
        } catch (err: any) {
            setError(err?.message || 'Failed to start bulk analysis');
        } finally {
            setSubmitting(false);
        }
    };

    const cancel = async () => {
        if (!job) return;
        await cancelIocBulkJob(job.id).catch(() => {});
    };

    const runFilterSearch = () => { if (job) { setPage(1); loadResults(job.id, 1); } };
    const changePage = (p: number) => { setPage(p); if (job) loadResults(job.id, p); };
    const changeSort = (col: string) => {
        const dir = sortBy === col && sortDir === 'asc' ? 'desc' : 'asc';
        setSortBy(col); setSortDir(dir);
        if (job) loadResults(job.id, page);
    };

    const toggleSelect = (id: number) => setSelected((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    const toggleSelectAll = () => {
        if (!results) return;
        setSelected((prev) => prev.size === results.items.length ? new Set() : new Set(results.items.map((i) => i.id)));
    };

    const selectedItems = () => (results?.items || []).filter((i) => selected.has(i.id));

    // §45/§46/§47/§48 CASE / EVIDENCE / NOTE / MONITOR ACTIONS — existing
    // per-entity APIs, called once per selected item, only on explicit click.
    const addSelectedToCase = async () => {
        if (!caseIdInput.trim()) return;
        setActionBusy(true); setActionMessage(null);
        const items = selectedItems().filter((i) => ENTITY_ID_FOR(i) != null);
        let ok = 0, fail = 0;
        for (const item of items) {
            try {
                const res = await fetch(`/api/investigations/cases/${encodeURIComponent(caseIdInput.trim())}/targets`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                    body: JSON.stringify({ entityType: ENTITY_TYPE_FOR(item), entityId: ENTITY_ID_FOR(item) }),
                });
                if (res.ok) ok++; else fail++;
            } catch { fail++; }
        }
        setActionMessage({ ok: fail === 0, text: `Added ${ok} item(s) to Case ${caseIdInput.trim()}.${fail ? ` ${fail} failed.` : ''}` });
        setActionBusy(false);
    };

    const createEvidenceForSelected = async () => {
        setActionBusy(true); setActionMessage(null);
        const items = selectedItems().filter((i) => ENTITY_ID_FOR(i) != null);
        let ok = 0, fail = 0;
        for (const item of items) {
            try {
                await addEvidence({ entityType: ENTITY_TYPE_FOR(item), entityId: ENTITY_ID_FOR(item)!, source: 'IOC Analyzer (Bulk)', description: `IOC observed via bulk IOC Analyzer batch: ${item.normalizedValue}` });
                ok++;
            } catch { fail++; }
        }
        setActionMessage({ ok: fail === 0, text: `Created Evidence for ${ok} item(s).${fail ? ` ${fail} failed.` : ''}` });
        setActionBusy(false);
        if (job) loadResults(job.id, page);
    };

    const addNoteToSelected = async () => {
        if (!noteText.trim()) return;
        setActionBusy(true); setActionMessage(null);
        const items = selectedItems().filter((i) => ENTITY_ID_FOR(i) != null);
        let ok = 0, fail = 0;
        for (const item of items) {
            try { await createCentralNote({ content: noteText.trim(), entityType: ENTITY_TYPE_FOR(item), entityId: ENTITY_ID_FOR(item)! }); ok++; } catch { fail++; }
        }
        setActionMessage({ ok: fail === 0, text: `Added note to ${ok} item(s).${fail ? ` ${fail} failed.` : ''}` });
        setNoteText('');
        setActionBusy(false);
    };

    const createMonitorsForSelected = async () => {
        setActionBusy(true); setActionMessage(null);
        const items = selectedItems().filter((i) => i.type && MONITOR_TYPE_FOR[i.type] && i.normalizedValue);
        let ok = 0, fail = 0;
        for (const item of items) {
            try {
                const res = await fetch('/api/monitoring/monitors', {
                    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
                    body: JSON.stringify({ type: MONITOR_TYPE_FOR[item.type!], iocType: ['md5', 'sha1', 'sha256'].includes(item.type!) ? 'hash' : (item.type === 'ipv4' || item.type === 'ipv6' ? 'ip' : item.type), target: item.normalizedValue, label: `Monitor for ${item.normalizedValue}` }),
                });
                if (res.ok) ok++; else fail++;
            } catch { fail++; }
        }
        setActionMessage({ ok: fail === 0, text: `Created ${ok} monitor(s) (only monitorable types).${fail ? ` ${fail} failed.` : ''}` });
        setActionBusy(false);
        if (job) loadResults(job.id, page);
    };

    // §49/§50 EXPORT — client-side, same pattern as Phase 1's single-IOC export.
    const exportResults = (format: 'json' | 'csv') => {
        if (!results) return;
        let blob: Blob, filename: string;
        if (format === 'json') {
            blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
            filename = `ioc-bulk-analysis-${results.job.id}.json`;
        } else {
            const header = ['IOC', 'Type', 'Status', 'Risk', 'MISP', 'Sources', 'First Seen', 'Last Seen'];
            const rows = results.items.map((i) => [i.normalizedValue || '', i.type || '', i.existingStatus || i.validationStatus, i.risk || '', i.mispStatus || '', (i.result?.sources || []).join('; '), i.firstSeenAt || '', i.lastSeenAt || '']);
            const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            blob = new Blob([csv], { type: 'text/csv' });
            filename = `ioc-bulk-analysis-${results.job.id}.csv`;
        }
        downloadBlob(blob, filename);
    };

    const isRunning = job && ['queued', 'validating', 'normalizing', 'analyzing', 'correlating', 'finalizing'].includes(job.status);

    return (
        <div>
            <div className="ti-note" style={{ marginBottom: '10px' }}>
                Paste one indicator per line (up to 500). Small batches complete immediately; larger batches run as a background job with real progress.
            </div>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} rows={6} style={{ width: '100%', marginBottom: '10px' }}
                placeholder={'example.com\n1.2.3.4\nbad-domain.example\n<sha256 hash>\nCVE-2026-1234'} />
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <button type="button" className="ti-action-btn" onClick={submit} disabled={submitting || !!isRunning}>{submitting ? 'Submitting…' : 'Analyze Bulk'}</button>
                {results && <button type="button" className="ti-action-btn" onClick={() => exportResults('json')}>Export JSON</button>}
                {results && <button type="button" className="ti-action-btn" onClick={() => exportResults('csv')}>Export CSV</button>}
                {job && ['completed', 'partial'].includes(job.status) && (
                    <button type="button" className="ti-action-btn" onClick={analyzeWithAi} disabled={aiLoading}>{aiLoading ? 'Analyzing with AI…' : 'Analyze Results with AI'}</button>
                )}
            </div>

            {error && <div className="ti-error">{error}</div>}

            {job && (
                <div className="ti-card" style={{ marginBottom: '16px' }}>
                    <div className="ti-card-title">
                        Job #{job.id} — {job.status}
                        {isRunning && <button type="button" className="ti-action-btn" style={{ float: 'right' }} onClick={cancel} disabled={job.cancelRequested}>{job.cancelRequested ? 'Cancelling…' : 'Cancel'}</button>}
                    </div>
                    <div className="ti-note">{job.progressLabel || `${job.progressCurrent} / ${job.progressTotal}`}</div>
                    {job.lastError && <div className="ti-note" style={{ fontStyle: 'italic' }}>{job.lastError}</div>}
                </div>
            )}

            {results && (
                <>
                    {/* §29 CROSS IOC SUMMARY */}
                    <div className="ti-kpi-row" style={{ marginBottom: '16px' }}>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{job?.inputCount ?? '—'}</div><div className="ti-kpi-label">Input</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.summary.unique}</div><div className="ti-kpi-label">Unique</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.summary.existing}</div><div className="ti-kpi-label">Existing</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.summary.new}</div><div className="ti-kpi-label">New</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.summary.mispMatches}</div><div className="ti-kpi-label">MISP Matches</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.groups.length}</div><div className="ti-kpi-label">Correlated Groups</div></div>
                        <div className="ti-kpi-card"><div className="ti-kpi-value">{results.summary.invalid}</div><div className="ti-kpi-label">Invalid</div></div>
                    </div>

                    {/* §30 COVERAGE */}
                    <div className="ti-card" style={{ marginBottom: '16px' }}>
                        <div className="ti-card-title">IOC Coverage</div>
                        <div className="ti-kv">
                            <span className="k">Existing IOC</span><span className="v">{results.coverage.existingIoc}</span>
                            <span className="k">No IOC Record</span><span className="v">{results.coverage.noIocRecord}</span>
                            <span className="k">MISP</span><span className="v">{results.coverage.misp}</span>
                            <span className="k">Evidence</span><span className="v">{results.coverage.evidence}</span>
                            <span className="k">Campaign</span><span className="v">{results.coverage.campaign}</span>
                            <span className="k">Malware</span><span className="v">{results.coverage.malware}</span>
                            <span className="k">Actor</span><span className="v">{results.coverage.actor}</span>
                        </div>
                        <div className="ti-note" style={{ fontStyle: 'italic' }}>Coverage does not imply maliciousness.</div>
                    </div>

                    {/* §31/§32 RISK DISTRIBUTION / ATTENTION */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="ti-card">
                            <div className="ti-card-title">Risk Distribution</div>
                            <div className="ti-kv">
                                {Object.entries(results.riskDistribution).map(([k, v]) => (<React.Fragment key={k}><span className="k">{k}</span><span className="v">{v}</span></React.Fragment>))}
                            </div>
                        </div>
                        <div className="ti-card">
                            <div className="ti-card-title">Analyst Attention ({results.attention.length})</div>
                            {results.attention.length === 0 ? <div className="ti-empty">Nothing flagged for attention.</div> : (
                                <ul className="ti-list">
                                    {results.attention.slice(0, 8).map((a) => (
                                        <li key={a.id} style={{ padding: '4px 0' }}>
                                            <strong>{a.value}</strong> — <span className="ti-note">{a.reasons.join(', ')}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                            <div className="ti-note" style={{ fontStyle: 'italic' }}>Analyst Attention, not a Threat Score.</div>
                        </div>
                    </div>

                    {/* §23-25 IOC GROUPS */}
                    {results.groups.length > 0 && (
                        <div className="ti-card" style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title">IOC Groups ({results.groups.length})</div>
                            <ul className="ti-list">
                                {results.groups.map((g) => (
                                    <li key={g.key} style={{ padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                            <span className="ti-badge">{g.confidence}</span>
                                            <strong>{g.label}</strong>
                                            <span className="ti-note">{g.memberCount} member(s) · {g.types.join(', ')}</span>
                                        </div>
                                        <div className="ti-note">Related because: {g.reason}{g.sources.length ? ` · Sources: ${g.sources.join(', ')}` : ''}</div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* §43 CONFLICTS */}
                    {results.conflicts.length > 0 && (
                        <div className="ti-card" style={{ marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)' }}>
                            <div className="ti-card-title">Conflicts ({results.conflicts.length})</div>
                            <ul className="ti-list">
                                {results.conflicts.map((c: any) => (
                                    <li key={c.id} style={{ padding: '4px 0' }}><strong>{c.object}</strong> attribution: <span className="ti-note">{c.claimA} vs {c.claimB}</span> — <span className="ti-badge">{c.status}</span></li>
                                ))}
                            </ul>
                            <div className="ti-note" style={{ fontStyle: 'italic' }}>Never resolved automatically.</div>
                        </div>
                    )}

                    {/* IOC_PHASE3.md §6/§7/§54 AI ASSESSMENT — on-demand only. */}
                    {(aiLoading || aiError || aiSummary) && (
                        <BulkAiAssessment loading={aiLoading} error={aiError} data={aiSummary} onRetry={analyzeWithAi} onReview={openPreview} />
                    )}
                    {previewRec && (
                        <ActionPreviewModal rec={previewRec} approving={approving} result={approveResult}
                            onApprove={() => previewRec.actionPreview && approveRecommendation(previewRec.actionPreview)} onClose={closePreview} />
                    )}

                    {/* §51/§52/§53 SEARCH / FILTERS / SORTING */}
                    <div className="ti-filters" style={{ marginBottom: '10px' }}>
                        <input type="text" placeholder="Search IOC / type…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') runFilterSearch(); }} style={{ flex: '1 1 240px' }} />
                        <select value={filters.risk} onChange={(e) => setFilters((f) => ({ ...f, risk: e.target.value }))}>
                            <option value="all">All Risk</option><option>Critical</option><option>High</option><option>Medium</option><option>Low</option>
                        </select>
                        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}>
                            <option value="all">All Status</option><option value="valid">Valid</option><option value="invalid">Invalid</option>
                        </select>
                        <select value={filters.existing} onChange={(e) => setFilters((f) => ({ ...f, existing: e.target.value }))}>
                            <option value="all">Existing / New</option><option value="existing">Existing</option><option value="new">New</option>
                        </select>
                        <select value={filters.mispMatch} onChange={(e) => setFilters((f) => ({ ...f, mispMatch: e.target.value }))}>
                            <option value="all">MISP: Any</option><option value="true">MISP Match</option>
                        </select>
                        <select value={filters.hasEvidence} onChange={(e) => setFilters((f) => ({ ...f, hasEvidence: e.target.value }))}>
                            <option value="all">Evidence: Any</option><option value="true">Has Evidence</option>
                        </select>
                        <button type="button" className="ti-action-btn" onClick={runFilterSearch}>Apply</button>
                    </div>

                    {/* §33-36 selection + actions */}
                    <div className="ti-card" style={{ marginBottom: '16px' }}>
                        <div className="ti-card-title">Analyst Actions ({selected.size} selected)</div>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <input type="text" placeholder="Case ID" value={caseIdInput} onChange={(e) => setCaseIdInput(e.target.value)} style={{ width: '100px' }} />
                            <button type="button" className="ti-action-btn" onClick={addSelectedToCase} disabled={actionBusy || !selected.size || !caseIdInput.trim()}>Add Selected to Case</button>
                            <button type="button" className="ti-action-btn" onClick={createEvidenceForSelected} disabled={actionBusy || !selected.size}>Create Evidence</button>
                            <input type="text" placeholder="Note text" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ width: '180px' }} />
                            <button type="button" className="ti-action-btn" onClick={addNoteToSelected} disabled={actionBusy || !selected.size || !noteText.trim()}>Add Note</button>
                            <button type="button" className="ti-action-btn" onClick={createMonitorsForSelected} disabled={actionBusy || !selected.size}>Create Monitor</button>
                        </div>
                        {actionMessage && <div className={actionMessage.ok ? 'ti-note' : 'ti-error'} style={actionMessage.ok ? { color: '#4ade80', marginTop: '8px' } : { marginTop: '8px' }}>{actionMessage.text}</div>}
                        <div className="ti-note" style={{ marginTop: '6px', fontStyle: 'italic' }}>Every action calls the existing Investigation/Evidence/Notes/Monitoring API per selected item — nothing is created automatically by analysis.</div>
                    </div>

                    {/* §54 PAGINATION table */}
                    <div className="ti-table-wrap">
                        <table className="ti-table">
                            <thead>
                                <tr>
                                    <th><input type="checkbox" checked={results.items.length > 0 && selected.size === results.items.length} onChange={toggleSelectAll} /></th>
                                    <th onClick={() => changeSort('type')} style={{ cursor: 'pointer' }}>Type</th>
                                    <th>IOC</th>
                                    <th>Status</th>
                                    <th onClick={() => changeSort('risk')} style={{ cursor: 'pointer' }}>Risk</th>
                                    <th>MISP</th>
                                    <th onClick={() => changeSort('occurrence_count')} style={{ cursor: 'pointer' }}>Occurrences</th>
                                    <th onClick={() => changeSort('first_seen_at')} style={{ cursor: 'pointer' }}>First Seen</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {results.items.map((item) => (
                                    <tr key={item.id} className={ENTITY_ID_FOR(item) != null ? 'ti-row-clickable' : ''}>
                                        <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                                        <td style={{ textTransform: 'uppercase' }}>{item.type || '—'}</td>
                                        <td style={{ fontWeight: 600 }}>{item.normalizedValue || item.originalInputs[0]}</td>
                                        <td>{item.validationStatus === 'invalid' ? <span className="ti-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#f87171' }}>Invalid</span> : item.existingStatus === 'existing' ? 'Existing' : 'Not Found'}</td>
                                        <td>{item.risk ? <RiskBadge risk={item.risk} /> : '—'}</td>
                                        <td>{item.mispStatus || '—'}</td>
                                        <td>{item.occurrenceCount}</td>
                                        <td className="ti-note">{item.firstSeenAt ? new Date(item.firstSeenAt).toLocaleDateString() : '—'}</td>
                                        <td>{ENTITY_ID_FOR(item) != null && <button type="button" className="ti-action-btn" onClick={() => onOpenEntity?.(ENTITY_TYPE_FOR(item), String(ENTITY_ID_FOR(item)))}>View</button>}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <Pagination prefix="ti" page={results.page} totalPages={Math.max(1, Math.ceil(results.total / results.pageSize))} total={results.total} onPrev={() => changePage(page - 1)} onNext={() => changePage(page + 1)} nextDisabled={page * pageSize >= results.total} />
                </>
            )}
        </div>
    );
};

// IOC_PHASE3.md §6/§7/§54/§78 — an AI failure/unavailability NEVER blocks
// the deterministic results above; this section simply reports its own
// honest state (Available/Unavailable/Fallback).
const BulkAiAssessment: React.FC<{
    loading: boolean; error: string | null; data: IocBulkAiSummaryResponse | null;
    onRetry: () => void; onReview: (rec: AiRecommendation) => void;
}> = ({ loading, error, data, onRetry, onReview }) => {
    if (loading) return <div className="ti-card" style={{ marginBottom: '16px' }}><div className="ti-empty">Generating AI summary…</div></div>;
    if (error) return (
        <div className="ti-card" style={{ marginBottom: '16px' }}>
            <div className="ti-error">{error}</div>
            <button type="button" className="ti-action-btn" onClick={onRetry} style={{ marginTop: '8px' }}>Retry</button>
        </div>
    );
    if (!data) return null;
    const s = data.summary;
    return (
        <>
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    AI Assessment
                    <span className="ti-badge" style={{ marginLeft: 'auto' }}>{data.aiStatus}{data.fallback ? ' (Fallback)' : ''}</span>
                </div>
                <div>{s.assessment}</div>
                <div className="ti-note" style={{ marginTop: '8px' }}>Generated {new Date(data.generatedAt).toLocaleString()}</div>
            </div>
            <AiListBlock title="Key Findings" items={s.keyFindings} />
            {s.importantGroups && <AiListBlock title="Important IOC Groups" items={s.importantGroups} />}
            <AiListBlock title="Conflicts" items={s.conflicts} warn />
            <AiListBlock title="Unknowns / Intelligence Gaps" items={s.unknowns} />
            <div className="ti-card" style={{ marginBottom: '16px' }}>
                <div className="ti-card-title">Sources</div>
                {s.sources.length === 0 ? <div className="ti-empty">No citations available.</div> : (
                    <div className="ti-chip-list">{s.sources.map((c, i) => <span key={i} className="ti-chip">{c}</span>)}</div>
                )}
            </div>
            <RecommendationsSection recommendations={data.recommendations} onReview={onReview} />
            <div className="ti-note" style={{ fontStyle: 'italic', marginBottom: '16px' }}>{s.note}</div>
        </>
    );
};

const AiListBlock: React.FC<{ title: string; items: string[]; warn?: boolean }> = ({ title, items, warn }) => (
    <div className="ti-card" style={warn ? { marginBottom: '16px', borderColor: 'rgba(239,68,68,0.35)' } : { marginBottom: '16px' }}>
        <div className="ti-card-title">{title}</div>
        {items.length === 0 ? <div className="ti-empty">None reported.</div> : (
            <ul className="ti-list">{items.map((it, i) => <li key={i} style={{ padding: '4px 0' }}>{it}</li>)}</ul>
        )}
    </div>
);

const RecommendationsSection: React.FC<{ recommendations: AiRecommendation[]; onReview: (rec: AiRecommendation) => void }> = ({ recommendations, onReview }) => (
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
                        {r.stateChanging ? (
                            <button type="button" className="ti-action-btn" onClick={() => onReview(r)}>Review</button>
                        ) : (
                            <span className="ti-note" style={{ fontStyle: 'italic' }}>Informational</span>
                        )}
                    </li>
                ))}
            </ul>
        )}
        <div className="ti-note" style={{ fontStyle: 'italic' }}>Recommendations only — no action is ever taken automatically.</div>
    </div>
);

const ActionPreviewModal: React.FC<{
    rec: AiRecommendation; approving: boolean; result: { ok: boolean; message: string } | null;
    onApprove: () => void; onClose: () => void;
}> = ({ rec, approving, result, onApprove, onClose }) => (
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
                {result && (
                    <div className={result.ok ? 'ti-note' : 'ti-error'} style={result.ok ? { color: '#4ade80' } : undefined}>{result.message}</div>
                )}
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                    <button type="button" className="ti-action-btn" onClick={onClose}>{result?.ok ? 'Close' : 'Cancel'}</button>
                    {!result?.ok && (
                        <button type="button" className="ti-action-btn" onClick={onApprove} disabled={approving || !rec.actionPreview}
                            style={{ background: 'rgba(34,197,94,0.16)', borderColor: 'rgba(34,197,94,0.5)' }}>
                            {approving ? 'Approving…' : 'Approve'}
                        </button>
                    )}
                </div>
            </div>
        </div>
    </div>
);

export default IocBulkAnalysisSection;
