import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Download, Plus, RefreshCw } from 'lucide-react';
import './TargetManagement.css';
import { timeAgo } from '../../../utils/timeAgo';
import Pagination from '../../../components/shared/Pagination';  // P2-8
import {
    getTargetsSummary, getTargetTags, getTargets, createTarget as apiCreateTarget,
    getTarget, updateTargetFields, deleteTarget as apiDeleteTarget, addTargetNote as apiAddTargetNote,
    addTargetTag as apiAddTargetTag, removeTargetTag as apiRemoveTargetTag, bulkUpdateTargets, previewTargetImport,
    commitTargetImport, exportTargets,
    type Target, type TargetDetail, type TargetsSummary, type TargetImportPreview, type TargetImportRowResult
} from '../../../services/api';


const TARGET_TYPES: { value: string; label: string; placeholder: string }[] = [
    { value: 'domain', label: 'Domain', placeholder: 'example.com' },
    { value: 'url', label: 'URL', placeholder: 'https://example.com' },
    { value: 'ipv4', label: 'IPv4', placeholder: '8.8.8.8' },
    { value: 'ipv6', label: 'IPv6', placeholder: '2001:4860:4860::8888' },
    { value: 'email', label: 'Email', placeholder: 'user@example.com' },
    { value: 'username', label: 'Username', placeholder: 'example_user' },
    { value: 'phone', label: 'Phone', placeholder: '+15551234567' },
    { value: 'person', label: 'Person', placeholder: 'Full name' },
    { value: 'company', label: 'Company', placeholder: 'Company name' },
    { value: 'brand', label: 'Brand', placeholder: 'Brand name' },
    { value: 'file_hash', label: 'File Hash', placeholder: 'MD5 / SHA1 / SHA256' },
    { value: 'keyword', label: 'Keyword', placeholder: 'Search keyword' }
];
const TYPE_LABELS: Record<string, string> = Object.fromEntries(TARGET_TYPES.map((t) => [t.value, t.label]));

const RISK_LEVELS = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
const STATUSES = [
    { value: 'active', label: 'Active' }, { value: 'investigating', label: 'Investigating' },
    { value: 'monitoring', label: 'Monitoring' }, { value: 'resolved', label: 'Resolved' }, { value: 'archived', label: 'Archived' }
];
const PRIORITIES = ['critical', 'high', 'medium', 'low'];

function RiskBadge({ risk }: { risk: string | null }) {
    if (!risk) return <span className="tm-risk-badge tm-risk-badge--none">Not assessed</span>;
    return <span className={`tm-risk-badge tm-risk-badge--${risk.toLowerCase()}`}>{risk}</span>;
}
function StatusBadge({ status }: { status: string }) {
    return <span className={`tm-status-badge tm-status-badge--${status}`}>{status}</span>;
}

function ConfirmDialog({ title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }: {
    title: string; message: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
    return createPortal(
        <div className="tm-confirm-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="tm-confirm-box">
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="tm-confirm-actions">
                    <button type="button" className="tm-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className={`tm-btn ${danger ? 'tm-btn--danger' : 'tm-btn--primary'}`} onClick={onConfirm}>{confirmLabel}</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function CreateTargetModal({ onClose, onCreated, onViewExisting }: {
    onClose: () => void; onCreated: () => void; onViewExisting: (id: number) => void;
}) {
    const [type, setType] = useState('domain');
    const [value, setValue] = useState('');
    const [description, setDescription] = useState('');
    const [tags, setTags] = useState('');
    const [priority, setPriority] = useState('medium');
    const [status, setStatus] = useState('active');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [duplicate, setDuplicate] = useState<Target | null>(null);

    const typeInfo = TARGET_TYPES.find((t) => t.value === type)!;

    const submit = async () => {
        if (!value.trim()) { setError('Target value is required.'); return; }
        setSaving(true);
        setError(null);
        setDuplicate(null);
        try {
            const res = await apiCreateTarget({ type, value: value.trim(), description: description.trim() || undefined, tags: tags ? tags.split(/[,;]/).map((t) => t.trim()).filter(Boolean) : undefined, priority, status, notes: notes.trim() || undefined });
            void res;
            onCreated();
        } catch (err: any) {
            if (err?.status === 409 && err?.data?.existing) {
                setDuplicate(err.data.existing as Target);
            } else {
                setError(err?.message || 'Failed to create target.');
            }
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="tm-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="New target" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tm-modal">
                <div className="tm-modal-header">
                    <h2>New Target</h2>
                    <button type="button" className="tm-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="tm-modal-body">
                    {duplicate && (
                        <div className="tm-duplicate-notice">
                            <div><strong>Target already exists.</strong> "{duplicate.value}" is already tracked ({TYPE_LABELS[duplicate.type] ?? duplicate.type}, owned by {duplicate.ownerUsername ?? 'another analyst'}).</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button type="button" className="tm-btn tm-btn--primary tm-btn--sm" onClick={() => onViewExisting(duplicate.id)}>View Existing Target</button>
                                <button type="button" className="tm-btn tm-btn--sm" onClick={() => setDuplicate(null)}>Cancel</button>
                            </div>
                        </div>
                    )}
                    <div className="tm-form-grid">
                        <label className="tm-field">
                            <span>Target Type</span>
                            <select value={type} onChange={(e) => { setType(e.target.value); setDuplicate(null); }}>
                                {TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </label>
                        <label className="tm-field">
                            <span>Priority</span>
                            <select value={priority} onChange={(e) => setPriority(e.target.value)}>
                                {PRIORITIES.map((p) => <option key={p} value={p}>{p[0].toUpperCase() + p.slice(1)}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="tm-field">
                        <span>Target Value</span>
                        <input type="text" value={value} onChange={(e) => { setValue(e.target.value); setDuplicate(null); setError(null); }} placeholder={typeInfo.placeholder} />
                        <span className="tm-field-hint">e.g. {typeInfo.placeholder}</span>
                    </label>
                    <label className="tm-field">
                        <span>Description</span>
                        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this target and why does it matter?" />
                    </label>
                    <label className="tm-field">
                        <span>Tags</span>
                        <input type="text" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="phishing, executive, external" />
                        <span className="tm-field-hint">Comma-separated.</span>
                    </label>
                    <label className="tm-field">
                        <span>Status</span>
                        <select value={status} onChange={(e) => setStatus(e.target.value)}>
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                    </label>
                    <label className="tm-field">
                        <span>Notes</span>
                        <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Analyst notes (optional)" />
                    </label>
                    {error && <div className="tm-field-error">{error}</div>}
                </div>
                <div className="tm-modal-footer">
                    <button type="button" className="tm-btn tm-btn--primary" onClick={submit} disabled={saving}>{saving ? 'Creating…' : 'Create Target'}</button>
                    <button type="button" className="tm-btn" onClick={onClose} disabled={saving}>Cancel</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

function parseCsvText(text: string): Record<string, string>[] {
    const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];
    const parseLine = (line: string): string[] => {
        const cells: string[] = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const ch = line[i];
            if (inQuotes) {
                if (ch === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else inQuotes = false; }
                else cur += ch;
            } else if (ch === '"') inQuotes = true;
            else if (ch === ',') { cells.push(cur); cur = ''; }
            else cur += ch;
        }
        cells.push(cur);
        return cells.map((c) => c.trim());
    };
    const header = parseLine(lines[0]).map((h) => h.toLowerCase());
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseLine(lines[i]);
        const row: Record<string, string> = {};
        header.forEach((h, idx) => { row[h] = cells[idx] ?? ''; });
        rows.push(row);
    }
    return rows;
}

function ImportTargetsModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
    const [fileName, setFileName] = useState('');
    const [preview, setPreview] = useState<TargetImportPreview | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [committing, setCommitting] = useState(false);
    const [result, setResult] = useState<{ created: number; failed: { target: string; reason: string }[] } | null>(null);

    const onFile = async (file: File) => {
        setFileName(file.name);
        setError(null);
        setPreview(null);
        setResult(null);
        setLoading(true);
        try {
            const text = await file.text();
            const rows = parseCsvText(text);
            if (!rows.length) { setError('The file has no data rows.'); return; }
            const data = await previewTargetImport(rows as any);
            setPreview(data);
        } catch (err: any) {
            setError(err?.message || 'Failed to read or validate the file.');
        } finally {
            setLoading(false);
        }
    };

    const commit = async () => {
        if (!preview) return;
        const validRows = preview.rows.filter((r) => r.valid);
        if (!validRows.length) return;
        setCommitting(true);
        try {
            const res = await commitTargetImport(validRows as TargetImportRowResult[]);
            setResult(res);
            if (res.created > 0) onImported();
        } catch (err: any) {
            setError(err?.message || 'Import failed.');
        } finally {
            setCommitting(false);
        }
    };

    return createPortal(
        <div className="tm-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Import targets" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tm-modal tm-modal--wide">
                <div className="tm-modal-header">
                    <h2>Import Targets (CSV)</h2>
                    <button type="button" className="tm-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="tm-modal-body">
                    <div className="tm-field-hint">Header row required: <code>target,type,tags,priority</code>. Tags are semicolon-separated within a cell (e.g. <code>external;investigation</code>).</div>
                    <label className="tm-field">
                        <span>CSV File</span>
                        <input type="file" accept=".csv,text/csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
                    </label>
                    {fileName && !loading && <div className="tm-field-hint">Loaded: {fileName}</div>}
                    {loading && <div className="tm-loading">Validating…</div>}
                    {error && <div className="tm-field-error">{error}</div>}

                    {preview && !result && (
                        <>
                            <div className="tm-import-summary">
                                <span>Total: <b>{preview.total}</b></span>
                                <span>Valid: <b>{preview.valid}</b></span>
                                <span>Duplicate: <b>{preview.duplicate}</b></span>
                                <span>Invalid: <b>{preview.invalid}</b></span>
                            </div>
                            <div className="tm-table-wrap" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                                <table className="tm-import-preview-table">
                                    <thead><tr><th>Row</th><th>Target</th><th>Type</th><th>Status</th><th>Reason</th></tr></thead>
                                    <tbody>
                                        {preview.rows.map((r) => (
                                            <tr key={r.row} className={!r.valid ? (r.duplicate ? 'tm-import-row--duplicate' : 'tm-import-row--invalid') : undefined}>
                                                <td>{r.row}</td><td>{r.target}</td><td>{r.type || '—'}</td>
                                                <td>{r.valid ? 'Valid' : r.duplicate ? 'Duplicate' : 'Invalid'}</td>
                                                <td>{r.reason || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="tm-modal-actions">
                                <button type="button" className="tm-btn tm-btn--primary" onClick={commit} disabled={committing || preview.valid === 0}>
                                    {committing ? 'Importing…' : `Import ${preview.valid} Valid Row${preview.valid === 1 ? '' : 's'}`}
                                </button>
                                <button type="button" className="tm-btn" onClick={onClose}>Cancel</button>
                            </div>
                        </>
                    )}

                    {result && (
                        <>
                            <div className="tm-import-summary">
                                <span>Created: <b>{result.created}</b></span>
                                <span>Failed: <b>{result.failed.length}</b></span>
                            </div>
                            {result.failed.length > 0 && (
                                <ul className="tm-list-row" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
                                    {result.failed.map((f, i) => <li key={i}>{f.target}: {f.reason}</li>)}
                                </ul>
                            )}
                            <div className="tm-modal-actions">
                                <button type="button" className="tm-btn tm-btn--primary" onClick={onClose}>Done</button>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

function TargetDetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
    const [target, setTarget] = useState<TargetDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [noteText, setNoteText] = useState('');
    const [tagText, setTagText] = useState('');
    const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [busy, setBusy] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getTarget(id).then(setTarget).catch((err) => setError(err?.message || 'Failed to load target')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const changeStatus = async (status: string) => {
        setBusy(true);
        try { await updateTargetFields(id, { status }); await load(); onChanged(); } finally { setBusy(false); }
    };
    const changeRisk = async (risk: string) => {
        setBusy(true);
        try { await updateTargetFields(id, { risk }); await load(); onChanged(); } finally { setBusy(false); }
    };
    const addNote = async () => {
        if (!noteText.trim()) return;
        setBusy(true);
        try { await apiAddTargetNote(id, noteText.trim()); setNoteText(''); await load(); } finally { setBusy(false); }
    };
    const addTag = async () => {
        if (!tagText.trim()) return;
        setBusy(true);
        try { await apiAddTargetTag(id, tagText.trim()); setTagText(''); await load(); onChanged(); } finally { setBusy(false); }
    };
    const removeTag = async (tag: string) => {
        setBusy(true);
        try { await apiRemoveTargetTag(id, tag); await load(); onChanged(); } finally { setBusy(false); }
    };
    const archive = () => setConfirm({
        message: 'Archive this target? It will be moved to Archived status and can be reactivated later by changing its status again.',
        onConfirm: async () => { setConfirm(null); setBusy(true); try { await updateTargetFields(id, { status: 'archived' }); await load(); onChanged(); } finally { setBusy(false); } }
    });
    const remove = () => setConfirm({
        message: 'Delete this target? This will remove it and its metadata from Target Management. This action cannot be undone from this screen.',
        onConfirm: async () => { setConfirm(null); setBusy(true); try { await apiDeleteTarget(id); onChanged(); onClose(); } finally { setBusy(false); } }
    });

    const noteActivity = useMemo(() => (target?.activity ?? []).filter((a) => a.action === 'note_added'), [target]);

    return createPortal(
        <div className="tm-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Target profile" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="tm-modal tm-modal--wide">
                <div className="tm-modal-header">
                    <h2>{target?.value ?? 'Target Profile'}</h2>
                    <button type="button" className="tm-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="tm-modal-body">
                    {error ? <div className="tm-error">{error}</div> : loading || !target ? <div className="tm-loading">Loading…</div> : (
                        <>
                            <div className="tm-kv">
                                <span className="k">Type</span><span className="v">{TYPE_LABELS[target.type] ?? target.type}</span>
                                <span className="k">Manual Risk</span><span className="v"><RiskBadge risk={target.risk} /></span>
                                <span className="k">Status</span><span className="v"><StatusBadge status={target.status} /></span>
                                <span className="k">Priority</span><span className="v" style={{ textTransform: 'capitalize' }}>{target.priority}</span>
                                <span className="k">Owner</span><span className="v">{target.ownerUsername ?? '—'}</span>
                                <span className="k">Created</span><span className="v">{target.createdAt ? `${timeAgo(target.createdAt)}` : '—'}</span>
                                <span className="k">Updated</span><span className="v">{target.updatedAt ? timeAgo(target.updatedAt) : '—'}</span>
                                <span className="k">Last Scanned</span><span className="v">{target.lastScannedAt ? timeAgo(target.lastScannedAt) : 'Never'}</span>
                            </div>
                            {target.description && <div className="tm-list-row-main">{target.description}</div>}

                            <div>
                                <div className="tm-modal-subtitle">Calculated Risk</div>
                                <div className="tm-section-empty">Automated risk scoring is not yet available for targets — risk shown above is analyst-assigned only. Calculated Risk is a planned future capability.</div>
                            </div>

                            <div className="tm-modal-actions">
                                <select onChange={(e) => e.target.value && changeStatus(e.target.value)} value="" disabled={busy}>
                                    <option value="">Change Status…</option>
                                    {STATUSES.filter((s) => s.value !== target.status).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                                </select>
                                <select onChange={(e) => e.target.value && changeRisk(e.target.value)} value="" disabled={busy}>
                                    <option value="">Change Risk…</option>
                                    {RISK_LEVELS.filter((r) => r !== target.risk).map((r) => <option key={r} value={r}>{r}</option>)}
                                    {target.risk && <option value="">Clear risk</option>}
                                </select>
                                <button type="button" className="tm-btn tm-btn--sm" onClick={archive} disabled={busy || target.status === 'archived'}>Archive</button>
                                <button type="button" className="tm-btn tm-btn--danger tm-btn--sm" onClick={remove} disabled={busy}>Delete</button>
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Tags ({target.tags.length})</div>
                                {target.tags.length === 0 ? <div className="tm-section-empty">No tags yet.</div> : (
                                    <div className="tm-tag-chip-list" style={{ maxWidth: 'none' }}>
                                        {target.tags.map((t) => (
                                            <span key={t} className="tm-tag-chip">{t}<button type="button" onClick={() => removeTag(t)} aria-label={`Remove tag ${t}`}>×</button></span>
                                        ))}
                                    </div>
                                )}
                                <div className="tm-inline-form">
                                    <input type="text" placeholder="Add tag…" value={tagText} onChange={(e) => setTagText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addTag()} />
                                    <button type="button" className="tm-btn tm-btn--sm" onClick={addTag} disabled={busy || !tagText.trim()}>Add</button>
                                </div>
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Notes ({noteActivity.length})</div>
                                {noteActivity.length === 0 && !target.notes ? <div className="tm-section-empty">No notes yet.</div> : (
                                    <>
                                        {target.notes && <div className="tm-note-item"><em>Overview note:</em> {target.notes}</div>}
                                        {noteActivity.map((a) => (
                                            <div key={a.id} className="tm-note-item">
                                                <div className="tm-activity-meta">{a.username ?? 'Analyst'} · {a.createdAt ? timeAgo(a.createdAt) : ''}</div>
                                                <div>{a.newValue}</div>
                                            </div>
                                        ))}
                                    </>
                                )}
                                <div className="tm-inline-form">
                                    <textarea rows={2} placeholder="Add an analyst or investigation note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} />
                                    <button type="button" className="tm-btn tm-btn--sm" onClick={addNote} disabled={busy || !noteText.trim()}>Add Note</button>
                                </div>
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Findings ({target.findings.length})</div>
                                {target.findings.length === 0 ? <div className="tm-section-empty">No findings available.</div> : (
                                    target.findings.map((f) => (
                                        <div key={f.id} className="tm-list-row">
                                            <span className="tm-list-row-main" style={{ textTransform: 'capitalize' }}>{f.module.replace(/-/g, ' ')}</span>
                                            <RiskBadge risk={f.riskLevel} />
                                            <span className="tm-activity-meta">{f.createdAt ? timeAgo(f.createdAt) : ''}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Scans ({target.scans.length})</div>
                                {target.scans.length === 0 ? <div className="tm-section-empty">No scans recorded for this target yet.</div> : (
                                    target.scans.map((s) => (
                                        <div key={s.id} className="tm-list-row">
                                            <span className="tm-list-row-main">Scan #{s.id}</span>
                                            <span className="tm-activity-meta">{s.createdAt ? timeAgo(s.createdAt) : ''}</span>
                                        </div>
                                    ))
                                )}
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Related Targets ({target.relatedTargets.length})</div>
                                <div className="tm-section-empty">
                                    {target.relatedTargets.length === 0 ? 'No related targets yet — cross-target correlation is a planned future capability.' : null}
                                </div>
                            </div>

                            <div>
                                <div className="tm-modal-subtitle">Activity ({target.activity.length})</div>
                                {target.activity.length === 0 ? <div className="tm-section-empty">No activity recorded.</div> : (
                                    target.activity.map((a) => (
                                        <div key={a.id} className="tm-activity-item">
                                            <div className="tm-activity-item-head">
                                                <span className="tm-activity-action">{a.action.replace(/_/g, ' ')}</span>
                                                <span className="tm-activity-meta">{a.username ?? 'system'} · {a.createdAt ? timeAgo(a.createdAt) : ''}</span>
                                            </div>
                                            {(a.oldValue || a.newValue) && a.action !== 'note_added' && (
                                                <div className="tm-activity-diff">{a.oldValue ?? '—'} → {a.newValue ?? '—'}</div>
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
            {confirm && <ConfirmDialog title="Confirm" message={confirm.message} confirmLabel="Confirm" danger onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
        </div>,
        document.body
    );
}

const TargetManagementHome: React.FC = () => {
    const [summary, setSummary] = useState<TargetsSummary | null>(null);
    const [tags, setTags] = useState<string[]>([]);
    const [filters, setFilters] = useState({ q: '', type: 'all', risk: 'all', status: 'all', tag: 'all' });
    const [sortBy, setSortBy] = useState('created_at');
    const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);
    const pageSize = 20;
    const [items, setItems] = useState<Target[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [detailId, setDetailId] = useState<number | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [showImport, setShowImport] = useState(false);
    const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);
    const [bulkBusy, setBulkBusy] = useState(false);

    const loadSummary = useCallback(() => {
        getTargetsSummary().then(setSummary).catch(() => {});
        getTargetTags().then(setTags).catch(() => {});
    }, []);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getTargets({
            q: filters.q || undefined, type: filters.type !== 'all' ? filters.type : undefined,
            risk: filters.risk !== 'all' ? filters.risk : undefined, status: filters.status !== 'all' ? filters.status : undefined,
            tag: filters.tag !== 'all' ? filters.tag : undefined, sortBy, sortDir, page, pageSize
        })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load targets'))
            .finally(() => setLoading(false));
    }, [filters, sortBy, sortDir, page]);

    useEffect(() => { loadSummary(); }, [loadSummary]);
    useEffect(() => { load(); }, [load]);

    const refreshAll = useCallback(() => { load(); loadSummary(); }, [load, loadSummary]);

    const toggleSort = (col: string) => {
        if (sortBy === col) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        else { setSortBy(col); setSortDir('desc'); }
    };

    const toggleSelect = (id: number) => {
        setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    };
    const toggleSelectAll = () => {
        setSelectedIds((prev) => (prev.size === items.length ? new Set() : new Set(items.map((i) => i.id))));
    };

    const runBulk = async (action: Parameters<typeof bulkUpdateTargets>[1], payload: Record<string, any> = {}) => {
        if (!selectedIds.size) return;
        setBulkBusy(true);
        try {
            await bulkUpdateTargets([...selectedIds], action, payload);
            setSelectedIds(new Set());
            refreshAll();
        } finally {
            setBulkBusy(false);
        }
    };

    const bulkDelete = () => setConfirm({
        message: `Delete ${selectedIds.size} target${selectedIds.size === 1 ? '' : 's'}? This action cannot be undone from this screen.`,
        onConfirm: async () => { setConfirm(null); await runBulk('delete'); }
    });

    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const filtersAreDefault = !filters.q && filters.type === 'all' && filters.risk === 'all' && filters.status === 'all' && filters.tag === 'all';

    const summaryCards = useMemo(() => ([
        { key: 'total', label: 'Total Targets', value: summary?.total ?? 0, cls: '' },
        { key: 'active', label: 'Active Targets', value: summary?.active ?? 0, cls: '' },
        { key: 'highRisk', label: 'High Risk Targets', value: summary?.highRisk ?? 0, cls: 'tm-summary-card--highrisk' },
        { key: 'recentlyAdded', label: 'Recently Added (24h)', value: summary?.recentlyAdded ?? 0, cls: '' },
        { key: 'investigating', label: 'Currently Investigating', value: summary?.investigating ?? 0, cls: 'tm-summary-card--investigating' }
    ]), [summary]);

    return (
        <div className="tm-page">
            <div className="tm-header">
                <div className="tm-header-text">
                    <h2>Target Management</h2>
                    <p>Create, organize and manage investigation targets across the OSINT platform.</p>
                </div>
                <div className="tm-header-actions">
                    <button type="button" className="tm-btn" onClick={() => setShowImport(true)}><Upload size={14} style={{ marginRight: '5px', verticalAlign: '-2px' }} />Import</button>
                    <button type="button" className="tm-btn" onClick={() => exportTargets({ q: filters.q, type: filters.type !== 'all' ? filters.type : undefined, risk: filters.risk !== 'all' ? filters.risk : undefined, status: filters.status !== 'all' ? filters.status : undefined, tag: filters.tag !== 'all' ? filters.tag : undefined }).catch(() => {})}>
                        <Download size={14} style={{ marginRight: '5px', verticalAlign: '-2px' }} />Export
                    </button>
                    <button type="button" className="tm-btn tm-btn--primary" onClick={() => setShowCreate(true)}><Plus size={14} style={{ marginRight: '5px', verticalAlign: '-2px' }} />New Target</button>
                </div>
            </div>

            <div className="tm-summary">
                {summaryCards.map((c) => (
                    <div key={c.key} className={`tm-summary-card ${c.cls}`}>
                        <span className="tm-summary-card-label">{c.label}</span>
                        <span className="tm-summary-card-value">{c.value.toLocaleString()}</span>
                    </div>
                ))}
            </div>

            <div className="tm-card">
                <div className="tm-filters">
                    <input type="text" placeholder="Search value, type, tags, status, risk, owner…" value={filters.q} onChange={(e) => { setFilters((f) => ({ ...f, q: e.target.value })); setPage(1); }} />
                    <select value={filters.type} onChange={(e) => { setFilters((f) => ({ ...f, type: e.target.value })); setPage(1); }}>
                        <option value="all">All Types</option>
                        {TARGET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <select value={filters.risk} onChange={(e) => { setFilters((f) => ({ ...f, risk: e.target.value })); setPage(1); }}>
                        <option value="all">All Risk</option>
                        {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <select value={filters.status} onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value })); setPage(1); }}>
                        <option value="all">All Status</option>
                        {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <select value={filters.tag} onChange={(e) => { setFilters((f) => ({ ...f, tag: e.target.value })); setPage(1); }}>
                        <option value="all">All Tags</option>
                        {tags.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <button type="button" className="tm-btn tm-btn--sm" onClick={refreshAll} disabled={loading} aria-label="Refresh">
                        <RefreshCw size={14} />
                    </button>
                </div>

                {selectedIds.size > 0 && (
                    <div className="tm-bulk-bar">
                        <span className="tm-bulk-bar-count">{selectedIds.size} selected</span>
                        <select disabled={bulkBusy} defaultValue="" onChange={(e) => { if (e.target.value) runBulk('status', { status: e.target.value }); e.target.value = ''; }}>
                            <option value="">Change Status…</option>
                            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                        </select>
                        <select disabled={bulkBusy} defaultValue="" onChange={(e) => { if (e.target.value) runBulk('risk', { risk: e.target.value }); e.target.value = ''; }}>
                            <option value="">Change Risk…</option>
                            {RISK_LEVELS.map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                        <BulkTagControl busy={bulkBusy} onAdd={(tag) => runBulk('add_tag', { tag })} onRemove={(tag) => runBulk('remove_tag', { tag })} />
                        <button type="button" className="tm-btn tm-btn--sm" disabled={bulkBusy} onClick={() => runBulk('archive')}>Archive</button>
                        <button type="button" className="tm-btn tm-btn--danger tm-btn--sm" disabled={bulkBusy} onClick={bulkDelete}>Delete</button>
                    </div>
                )}

                {error ? (
                    <div className="tm-error">{error}<button type="button" className="tm-btn tm-btn--sm" onClick={load}>Retry</button></div>
                ) : loading ? (
                    <div className="tm-loading">Loading…</div>
                ) : items.length === 0 ? (
                    <div className="tm-empty">
                        <div className="tm-empty-title">{filtersAreDefault ? 'No targets have been added yet.' : 'No targets match these filters.'}</div>
                        {filtersAreDefault && (
                            <>
                                <div>Create a target to begin an OSINT investigation.</div>
                                <button type="button" className="tm-btn tm-btn--primary" style={{ marginTop: '12px' }} onClick={() => setShowCreate(true)}>+ New Target</button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="tm-table-wrap">
                            <table className="tm-table">
                                <thead>
                                    <tr>
                                        <th><input type="checkbox" checked={selectedIds.size === items.length && items.length > 0} onChange={toggleSelectAll} aria-label="Select all" /></th>
                                        <th onClick={() => toggleSort('value')} style={{ cursor: 'pointer' }}>Target{sortBy === 'value' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                        <th onClick={() => toggleSort('type')} style={{ cursor: 'pointer' }}>Type{sortBy === 'type' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                        <th onClick={() => toggleSort('risk')} style={{ cursor: 'pointer' }}>Risk{sortBy === 'risk' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                        <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>Status{sortBy === 'status' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                        <th>Tags</th>
                                        <th onClick={() => toggleSort('created_at')} style={{ cursor: 'pointer' }}>Created{sortBy === 'created_at' ? (sortDir === 'asc' ? ' ▲' : ' ▼') : ''}</th>
                                        <th>Last Scanned</th>
                                        <th>Owner</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {items.map((t) => (
                                        <tr key={t.id} className="tm-row-clickable" onClick={() => setDetailId(t.id)}>
                                            <td onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} aria-label={`Select ${t.value}`} /></td>
                                            <td><span className="tm-target-value" title={t.value}>{t.value}</span></td>
                                            <td><span className="tm-type-pill">{TYPE_LABELS[t.type] ?? t.type}</span></td>
                                            <td><RiskBadge risk={t.risk} /></td>
                                            <td><StatusBadge status={t.status} /></td>
                                            <td>
                                                <div className="tm-tag-chip-list">
                                                    {t.tags.slice(0, 3).map((tag) => <span key={tag} className="tm-tag-chip">{tag}</span>)}
                                                    {t.tags.length > 3 && <span className="tm-tag-chip">+{t.tags.length - 3}</span>}
                                                </div>
                                            </td>
                                            <td>{t.createdAt ? timeAgo(t.createdAt) : '—'}</td>
                                            <td>{t.lastScannedAt ? timeAgo(t.lastScannedAt) : 'Never'}</td>
                                            <td>{t.ownerUsername ?? '—'}</td>
                                            <td><button type="button" className="tm-btn tm-btn--sm" onClick={(e) => { e.stopPropagation(); setDetailId(t.id); }}>View</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination prefix="tm" page={page} totalPages={totalPages} total={total} onPrev={() => setPage((p) => p - 1)} onNext={() => setPage((p) => p + 1)} />
                    </>
                )}
            </div>

            {showCreate && (
                <CreateTargetModal
                    onClose={() => setShowCreate(false)}
                    onCreated={() => { setShowCreate(false); refreshAll(); }}
                    onViewExisting={(id) => { setShowCreate(false); setDetailId(id); }}
                />
            )}
            {showImport && <ImportTargetsModal onClose={() => setShowImport(false)} onImported={refreshAll} />}
            {detailId != null && <TargetDetailModal id={detailId} onClose={() => setDetailId(null)} onChanged={refreshAll} />}
            {confirm && <ConfirmDialog title="Confirm" message={confirm.message} confirmLabel="Delete" danger onConfirm={confirm.onConfirm} onCancel={() => setConfirm(null)} />}
        </div>
    );
};

function BulkTagControl({ busy, onAdd, onRemove }: { busy: boolean; onAdd: (tag: string) => void; onRemove: (tag: string) => void }) {
    const [tag, setTag] = useState('');
    return (
        <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <input type="text" placeholder="tag…" value={tag} onChange={(e) => setTag(e.target.value)} style={{ width: '90px' }} />
            <button type="button" className="tm-btn tm-btn--sm" disabled={busy || !tag.trim()} onClick={() => { onAdd(tag.trim()); setTag(''); }}>+Tag</button>
            <button type="button" className="tm-btn tm-btn--sm" disabled={busy || !tag.trim()} onClick={() => { onRemove(tag.trim()); setTag(''); }}>-Tag</button>
        </span>
    );
}

export default TargetManagementHome;
