import { useEffect, useState } from 'react';
import './AuditLogsPage.css';
import { getAuditLogs } from '../../services/api';
import Logo from '../../picture/Logo.png';

interface AuditLogEntry {
    id: number;
    history_record_kind: string;
    history_record_id: number;
    actor_user_id: number;
    actor_username: string | null;
    owner_user_id: number | null;
    deleted_at: string | null;
    action: 'soft' | 'hard';
}

interface AuditLogsPageProps {
    onBack: () => void;
}

const PAGE_SIZE = 25;

export default function AuditLogsPage({ onBack }: AuditLogsPageProps) {
    const [entries, setEntries] = useState<AuditLogEntry[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    const loadLogs = async (targetPage: number) => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAuditLogs({ page: targetPage, pageSize: PAGE_SIZE });
            if (res.status === 'success') {
                setEntries(res.items || []);
                setTotal(res.total || 0);
                setPage(res.page || targetPage);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load audit logs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadLogs(1);
    }, []);

    return (
        <div className="audit-log-page">
            <header className="audit-log-header">
                <div className="brand">
                    <div className="logo-icon">
                        <img src={Logo} alt="BaeSpy" />
                    </div>
                    <div className="audit-log-header-text">
                        <h1>Audit Logs</h1>
                        <p>Read-only history of scan and OSINT record deletions</p>
                    </div>
                </div>
                <button className="audit-log-back" onClick={onBack} type="button">
                    ← Back
                </button>
            </header>

            {error && <div className="audit-log-error">{error}</div>}

            <section className="audit-log-content">
                {loading ? (
                    <div className="audit-log-loading">Loading audit logs…</div>
                ) : (
                    <>
                        <div className="audit-log-table">
                            <div className="audit-log-thead">
                                <div>Timestamp</div>
                                <div>Actor</div>
                                <div>Action</div>
                                <div>Record Kind</div>
                                <div>Record ID</div>
                                <div>Owner</div>
                            </div>
                            {entries.map((entry) => {
                                const showOwner = entry.owner_user_id != null && entry.owner_user_id !== entry.actor_user_id;
                                return (
                                    <div key={entry.id} className="audit-log-tr">
                                        <div className="audit-log-cell" data-label="Timestamp">
                                            {entry.deleted_at ? new Date(entry.deleted_at).toLocaleString() : '—'}
                                        </div>
                                        <div className="audit-log-cell" data-label="Actor">
                                            {entry.actor_username || `User #${entry.actor_user_id}`}
                                        </div>
                                        <div className="audit-log-cell" data-label="Action">
                                            <span className={`audit-action-badge ${entry.action}`}>
                                                {entry.action === 'hard' ? 'PERMANENT' : 'SOFT DELETE'}
                                            </span>
                                        </div>
                                        <div className="audit-log-cell" data-label="Record Kind">
                                            {entry.history_record_kind === 'scan' ? 'Scan' : entry.history_record_kind === 'osint' ? 'OSINT' : entry.history_record_kind}
                                        </div>
                                        <div className="audit-log-cell" data-label="Record ID">#{entry.history_record_id}</div>
                                        <div className="audit-log-cell" data-label="Owner">
                                            {showOwner ? `User #${entry.owner_user_id}` : '—'}
                                        </div>
                                    </div>
                                );
                            })}
                            {entries.length === 0 && (
                                <div className="audit-log-empty">No deletions recorded yet.</div>
                            )}
                        </div>

                        {totalPages > 1 && (
                            <div className="audit-log-pagination">
                                <button
                                    type="button"
                                    disabled={page <= 1}
                                    onClick={() => loadLogs(page - 1)}
                                >
                                    ← Previous
                                </button>
                                <span>Page {page} of {totalPages} ({total} total)</span>
                                <button
                                    type="button"
                                    disabled={page >= totalPages}
                                    onClick={() => loadLogs(page + 1)}
                                >
                                    Next →
                                </button>
                            </div>
                        )}
                    </>
                )}
            </section>
        </div>
    );
}
