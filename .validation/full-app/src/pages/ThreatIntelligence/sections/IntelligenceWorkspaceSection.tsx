import React, { useCallback, useEffect, useState } from 'react';
import {
    getWorkspaces, createWorkspace, getWorkspace, deleteWorkspace, addWorkspaceEntity, removeWorkspaceEntity,
    addWorkspaceNote, addToWatchlist, createReport as createReportApi, addReportEntity,
    type IntelligenceWorkspace, type WorkspaceDetail, type SearchResultItem
} from '../../../services/api';
import { EntityChip, InvestigateButton, ConfirmDialog, formatDateTime } from '../ThreatIntelligenceShared';
import EntityPicker from '../../../components/shared/EntityPicker';  // P1-5 — was a local copy

interface Props {
    openEntityId?: string | null;
    onEntityOpened?: () => void;
    onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
    onReportCreated?: () => void;
}

const WorkspaceDetailView: React.FC<{ id: number; onClose: () => void; onOpenEntity?: (type: string, id: string) => void; onInvestigate?: (target: string, tab?: string) => void; onReportCreated?: () => void }> = ({ id, onClose, onOpenEntity, onInvestigate, onReportCreated }) => {
    const [workspace, setWorkspace] = useState<WorkspaceDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showPicker, setShowPicker] = useState(false);
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [busyEntity, setBusyEntity] = useState<string | null>(null);
    const [reportBusy, setReportBusy] = useState(false);
    const [actionNote, setActionNote] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getWorkspace(id).then(setWorkspace).catch((err) => setError(err?.message || 'Failed to load workspace')).finally(() => setLoading(false));
    }, [id]);
    useEffect(() => { load(); }, [load]);

    const pickEntity = async (item: SearchResultItem) => {
        await addWorkspaceEntity(id, item.type, item.id);
        setShowPicker(false);
        load();
    };

    const removeEntity = async (entityType: string, entityId: string) => {
        await removeWorkspaceEntity(id, entityType, entityId);
        load();
    };

    const runAddNote = async () => {
        if (!noteText.trim()) return;
        setSavingNote(true);
        try {
            await addWorkspaceNote(id, noteText.trim());
            setNoteText('');
            load();
        } finally {
            setSavingNote(false);
        }
    };

    const runAddToWatchlist = async (entityType: string, entityId: string) => {
        setBusyEntity(`${entityType}:${entityId}`);
        setActionNote(null);
        try {
            await addToWatchlist(id, entityType, entityId);
            setActionNote('Added to Monitoring watchlist.');
        } catch (err: any) {
            setActionNote(err?.message || 'Failed to add to watchlist.');
        } finally {
            setBusyEntity(null);
        }
    };

    const runCreateReport = async () => {
        if (!workspace) return;
        setReportBusy(true);
        try {
            const result = await createReportApi({ title: workspace.name, reportType: 'Threat Assessment' });
            for (const e of workspace.entities) {
                await addReportEntity(result.id, e.entity_type, e.entity_id);
            }
            setActionNote('Report created from this workspace.');
            onReportCreated?.();
        } finally {
            setReportBusy(false);
        }
    };

    return (
        <div className="ti-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Workspace detail" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="ti-modal" style={{ maxWidth: '720px' }}>
                <div className="ti-modal-header">
                    <h2>{workspace?.name ?? 'Workspace'}</h2>
                    <button type="button" className="ti-modal-close" onClick={onClose} aria-label="Close">×</button>
                </div>
                <div className="ti-modal-body">
                    {error ? (
                        <div className="ti-error">{error}</div>
                    ) : loading || !workspace ? (
                        <div className="ti-loading">Loading…</div>
                    ) : (
                        <>
                            {workspace.description && <div className="ti-note">{workspace.description}</div>}

                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button type="button" className="ti-action-btn" onClick={runCreateReport} disabled={reportBusy || workspace.entities.length === 0}>{reportBusy ? 'Creating…' : 'Create Report'}</button>
                                <InvestigateButton target={workspace.name} onInvestigate={onInvestigate} />
                            </div>
                            {actionNote && <div className="ti-note">{actionNote}</div>}

                            <div>
                                <div className="ti-modal-subtitle">Entities ({workspace.entities.length}) <button type="button" className="ti-action-btn" style={{ marginLeft: '8px' }} onClick={() => setShowPicker((v) => !v)}>+ Add Entity</button></div>
                                {showPicker && <EntityPicker onPick={pickEntity} onCancel={() => setShowPicker(false)} placeholder="Search IOCs, campaigns, actors, malware, CVEs, techniques…" />}
                                {workspace.entities.length === 0 ? <div className="ti-empty">Workspace is empty.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {workspace.entities.map((e, i) => (
                                            <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap' }}>
                                                <EntityChip entity={e.entity} onOpen={onOpenEntity} />
                                                {e.entity_type === 'ioc' && (
                                                    <button type="button" className="ti-action-btn" disabled={busyEntity === `ioc:${e.entity_id}`} onClick={() => runAddToWatchlist('ioc', e.entity_id)}>
                                                        {busyEntity === `ioc:${e.entity_id}` ? 'Adding…' : 'Add to Watchlist'}
                                                    </button>
                                                )}
                                                <button type="button" className="ti-action-btn ti-action-btn--danger" style={{ marginLeft: 'auto' }} onClick={() => removeEntity(e.entity_type, e.entity_id)}>Remove</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div>
                                <div className="ti-modal-subtitle">Analyst Notes ({workspace.notes.length})</div>
                                <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                                    <input type="text" placeholder="Add a note…" value={noteText} onChange={(e) => setNoteText(e.target.value)} style={{ flex: 1, background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' }} />
                                    <button type="button" className="ti-action-btn" onClick={runAddNote} disabled={savingNote || !noteText.trim()}>{savingNote ? 'Saving…' : 'Add'}</button>
                                </div>
                                {workspace.notes.length === 0 ? <div className="ti-empty">No notes yet.</div> : (
                                    <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                        {workspace.notes.map((n) => (
                                            <div key={n.id} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                                                <div style={{ fontSize: '0.85rem' }}>{n.note}</div>
                                                <div className="ti-note">{n.username || 'Analyst'} · {formatDateTime(n.created_at)}</div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

const IntelligenceWorkspaceSection: React.FC<Props> = ({ openEntityId, onEntityOpened, onOpenEntity, onInvestigate, onReportCreated }) => {
    const [items, setItems] = useState<IntelligenceWorkspace[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
    const [deleting, setDeleting] = useState(false);

    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [creating, setCreating] = useState(false);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getWorkspaces({ page: 1, pageSize: 50 })
            .then((res) => { setItems(res.items); setTotal(res.total); })
            .catch((err) => setError(err?.message || 'Failed to load workspaces'))
            .finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    useEffect(() => {
        if (openEntityId) { setSelectedId(Number(openEntityId)); onEntityOpened?.(); }
    }, [openEntityId, onEntityOpened]);

    const runCreate = async () => {
        if (!newName.trim()) return;
        setCreating(true);
        try {
            const result = await createWorkspace({ name: newName.trim() });
            setNewName('');
            setShowCreate(false);
            load();
            setSelectedId(result.id);
        } finally {
            setCreating(false);
        }
    };

    const runDelete = async () => {
        if (confirmDeleteId == null) return;
        setDeleting(true);
        try {
            await deleteWorkspace(confirmDeleteId);
            setConfirmDeleteId(null);
            load();
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Intelligence Workspace <span className="ti-note">({total.toLocaleString()} total)</span></span>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                    <button type="button" className="ti-action-btn" onClick={() => setShowCreate((v) => !v)}>+ New Workspace</button>
                </div>
            </div>

            {showCreate && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', paddingBottom: '14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <input type="text" placeholder="Workspace name…" value={newName} onChange={(e) => setNewName(e.target.value)} style={{ minWidth: '220px', background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '6px 10px', fontSize: '0.85rem' }} />
                    <button type="button" className="ti-action-btn" onClick={runCreate} disabled={creating || !newName.trim()}>{creating ? 'Creating…' : 'Create'}</button>
                </div>
            )}

            {error ? (
                <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
            ) : loading ? (
                <div className="ti-loading">Loading…</div>
            ) : items.length === 0 ? (
                <div className="ti-empty">No workspaces yet.</div>
            ) : (
                <div className="ti-table-wrap">
                    <table className="ti-table">
                        <thead><tr><th>Name</th><th>Entities</th><th>Updated</th><th>Action</th></tr></thead>
                        <tbody>
                            {items.map((w) => (
                                <tr key={w.id} className="ti-row-clickable" onClick={() => setSelectedId(w.id)}>
                                    <td><span className="ti-target" title={w.name}>{w.name}</span></td>
                                    <td>{w.entity_count ?? 0}</td>
                                    <td>{formatDateTime(w.updated_at)}</td>
                                    <td>
                                        <div className="ti-row-actions">
                                            <button type="button" className="ti-action-btn" onClick={(e) => { e.stopPropagation(); setSelectedId(w.id); }}>Open</button>
                                            <button type="button" className="ti-action-btn ti-action-btn--danger" onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(w.id); }}>Remove</button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {selectedId != null && <WorkspaceDetailView id={selectedId} onClose={() => { setSelectedId(null); load(); }} onOpenEntity={onOpenEntity} onInvestigate={onInvestigate} onReportCreated={onReportCreated} />}
            {confirmDeleteId != null && (
                <ConfirmDialog title="Remove workspace" text="Delete this workspace? Its entities remain untouched." busy={deleting} confirmLabel="Remove" onCancel={() => setConfirmDeleteId(null)} onConfirm={runDelete} />
            )}
        </div>
    );
};

export default IntelligenceWorkspaceSection;
