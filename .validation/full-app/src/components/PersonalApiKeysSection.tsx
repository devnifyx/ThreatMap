import { useEffect, useState, type FormEvent } from 'react';
import './PersonalApiKeysSection.css';
import { getMyApiKeys, createMyApiKey, revokeMyApiKey } from '../services/api';

// ADMINISTRATION_PASS4.md Part C — second section on the existing API Keys
// page (ADMINISTRATION_PASS2.md's ApiKeysPage.tsx), not a competing page.
// This is the only place the full key is ever shown — createMyApiKey()'s
// response is used once, right here, and then discarded; every other view
// of a key (this table, revoke, everywhere else) only ever sees key_prefix.
interface ApiKeyEntry {
    id: number;
    label: string;
    key_prefix: string;
    created_at: string;
    last_used_at: string | null;
    revoked_at: string | null;
}

export default function PersonalApiKeysSection() {
    const [keys, setKeys] = useState<ApiKeyEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showCreate, setShowCreate] = useState(false);
    const [label, setLabel] = useState('');
    const [creating, setCreating] = useState(false);
    const [createError, setCreateError] = useState<string | null>(null);
    const [newKey, setNewKey] = useState<string | null>(null);
    const [copyFeedback, setCopyFeedback] = useState(false);
    const [revokingId, setRevokingId] = useState<number | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getMyApiKeys();
            if (res.status === 'success') setKeys(res.keys || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load API keys');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openCreate = () => {
        setLabel('');
        setCreateError(null);
        setNewKey(null);
        setCopyFeedback(false);
        setShowCreate(true);
    };

    const closeCreate = () => {
        setShowCreate(false);
        setNewKey(null);
    };

    const handleCreate = async (e: FormEvent) => {
        e.preventDefault();
        if (!label.trim()) {
            setCreateError('Label is required');
            return;
        }
        setCreating(true);
        setCreateError(null);
        try {
            const res = await createMyApiKey(label.trim());
            // fullKey lives in component state only for as long as this
            // modal stays open — never written to any persisted store here.
            setNewKey(res.fullKey);
            await load();
        } catch (e: any) {
            setCreateError(e?.message || 'Failed to create API key');
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async () => {
        if (!newKey) return;
        try {
            await navigator.clipboard.writeText(newKey);
            setCopyFeedback(true);
            setTimeout(() => setCopyFeedback(false), 2000);
        } catch {
            // Clipboard API unavailable (permissions/non-secure context) —
            // the reveal box still shows the key for manual select+copy.
        }
    };

    const handleRevoke = async (id: number) => {
        setRevokingId(id);
        try {
            await revokeMyApiKey(id);
            await load();
        } catch (e: any) {
            setError(e?.message || 'Failed to revoke API key');
        } finally {
            setRevokingId(null);
        }
    };

    return (
        <section className="personal-api-keys-section">
            <div className="personal-api-keys-header">
                <h2>Your Personal API Keys</h2>
                <button type="button" className="personal-api-keys-create-btn" onClick={openCreate}>
                    + Create New Key
                </button>
            </div>
            <p className="personal-api-keys-hint">
                Authenticate programmatically with <code>Authorization: Bearer lkx_...</code> instead of
                logging in. The full key is shown only once, right after creation.
            </p>

            {error && <div className="personal-api-keys-error">{error}</div>}

            {loading ? (
                <div className="personal-api-keys-loading">Loading…</div>
            ) : (
                <div className="personal-api-keys-table">
                    <div className="personal-api-keys-thead">
                        <div>Label</div>
                        <div>Key</div>
                        <div>Created</div>
                        <div>Last Used</div>
                        <div>Status</div>
                        <div />
                    </div>
                    {keys.map((k) => {
                        const revoked = !!k.revoked_at;
                        return (
                            <div key={k.id} className="personal-api-keys-tr">
                                <div className="personal-api-keys-cell" data-label="Label">{k.label}</div>
                                <div className="personal-api-keys-cell personal-api-keys-prefix" data-label="Key">{k.key_prefix}…</div>
                                <div className="personal-api-keys-cell" data-label="Created">{new Date(k.created_at).toLocaleString()}</div>
                                <div className="personal-api-keys-cell" data-label="Last Used">
                                    {k.last_used_at ? new Date(k.last_used_at).toLocaleString() : 'Never'}
                                </div>
                                <div className="personal-api-keys-cell" data-label="Status">
                                    <span className={`personal-api-key-status-badge ${revoked ? 'revoked' : 'active'}`}>
                                        {revoked ? 'Revoked' : 'Active'}
                                    </span>
                                </div>
                                <div className="personal-api-keys-cell personal-api-keys-actions" data-label="">
                                    {!revoked && (
                                        <button
                                            type="button"
                                            className="personal-api-keys-revoke-btn"
                                            disabled={revokingId === k.id}
                                            onClick={() => handleRevoke(k.id)}
                                        >
                                            {revokingId === k.id ? 'Revoking…' : 'Revoke'}
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {keys.length === 0 && <div className="personal-api-keys-empty">No personal API keys yet.</div>}
                </div>
            )}

            {showCreate && (
                <div className="personal-api-keys-modal-overlay" onClick={closeCreate}>
                    <div className="personal-api-keys-modal" data-lenis-prevent onClick={(e) => e.stopPropagation()}>
                        <div className="personal-api-keys-modal-header">
                            <h2>{newKey ? 'API Key Created' : 'Create New Key'}</h2>
                            <button type="button" className="personal-api-keys-modal-close" onClick={closeCreate}>×</button>
                        </div>
                        {newKey ? (
                            <div className="personal-api-keys-modal-body">
                                <p className="personal-api-keys-warning">
                                    Copy this key now — you won't be able to see it again.
                                </p>
                                <div className="personal-api-keys-reveal-box">
                                    <code>{newKey}</code>
                                    <button type="button" onClick={handleCopy}>
                                        {copyFeedback ? 'Copied!' : 'Copy'}
                                    </button>
                                </div>
                                <div className="personal-api-keys-modal-actions">
                                    <button type="button" onClick={closeCreate}>Done</button>
                                </div>
                            </div>
                        ) : (
                            <form className="personal-api-keys-modal-body" onSubmit={handleCreate}>
                                <div className="form-group">
                                    <label>Label</label>
                                    <input
                                        type="text"
                                        value={label}
                                        onChange={(e) => setLabel(e.target.value)}
                                        placeholder="e.g. CI pipeline, my laptop"
                                        autoFocus
                                    />
                                </div>
                                {createError && <div className="personal-api-keys-error">{createError}</div>}
                                <div className="personal-api-keys-modal-actions">
                                    <button type="button" onClick={closeCreate}>Cancel</button>
                                    <button type="submit" disabled={creating}>{creating ? 'Creating…' : 'Create'}</button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </section>
    );
}
