// SHADOWSERVER_INTEGRATION_PLAN.md Phase 1 — admin UI for the platform-wide
// client-scoping primitive (plan §5). Extended by
// MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 0/1 (plan §12):
// this page is organization/membership/entitlement/configuration ONLY — the
// actual CTI intelligence experience (findings, trend, search) lives under
// Threat Intelligence -> Shadowserver instead (ThreatIntelligence/
// ShadowserverIntelPage.tsx), never duplicated here (plan §12's explicit
// instruction). Four tabs: Clients (the core primitive — create clients,
// manage membership, "View as Client"), Service Entitlements (which CTI
// services each client can use — plan §6/§14, NOT credential configuration),
// Shadowserver Configuration (per-client credentials, watched ranges, the
// confirmed_real ingestion gate, sync — administrative setup, orthogonal to
// entitlement per plan §15), and Audit Log (every "View as Client"
// entry/exit — plan §5/§11 Q02, confirmed as a requirement, not optional).
import { useEffect, useState } from 'react';
import './ClientsPage.css';
import {
    getClients, createPlatformClient, updatePlatformClient,
    getClientMembers, addClientMember, removeClientMember, createClientContact,
    startViewAsClient, endViewAsClient, getViewAsStatus, getViewAsAudit,
    getShadowserverCredentials, createShadowserverCredential, revokeShadowserverCredential,
    getShadowserverRanges, createShadowserverRange, confirmShadowserverRangeReal, removeShadowserverRange,
    getShadowserverReadiness, syncShadowserverClient,
    getClientServiceEntitlements, setClientServiceEntitlement, getServiceEntitlementAudit,
    type PlatformClient, type ClientMember, type ViewAsAuditEntry,
    type ShadowserverCredentialMeta, type ShadowserverRange, type ShadowserverReadiness,
    type ShadowserverSyncResult, type ClientServiceEntitlement, type ServiceEntitlementAuditEntry
} from '../../services/api';

interface ClientsPageProps {
    onBack: () => void;
}

type Tab = 'clients' | 'entitlements' | 'shadowserver' | 'audit';

export default function ClientsPage({ onBack }: ClientsPageProps) {
    const [tab, setTab] = useState<Tab>('clients');
    const [clients, setClients] = useState<PlatformClient[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [viewingAs, setViewingAs] = useState<PlatformClient | null>(null);

    const loadClients = async () => {
        setLoading(true);
        setError(null);
        try {
            setClients(await getClients());
        } catch (e: any) {
            setError(e?.message || 'Failed to load clients');
        } finally {
            setLoading(false);
        }
    };

    const loadViewAsStatus = async () => {
        try {
            const status = await getViewAsStatus();
            setViewingAs(status.viewingAs);
        } catch { /* non-fatal — banner just stays hidden */ }
    };

    useEffect(() => {
        loadClients();
        loadViewAsStatus();
    }, []);

    const handleEndViewAs = async () => {
        try {
            await endViewAsClient();
            setViewingAs(null);
            loadClients();
        } catch (e: any) {
            setError(e?.message || 'Failed to end view-as');
        }
    };

    return (
        <div className="clients-page">
            <div className="clients-header">
                <div className="clients-header-text">
                    <h1>Clients</h1>
                    <p>Platform-wide client organizations, membership, and the Shadowserver integration.</p>
                </div>
                <button className="clients-back" onClick={onBack}>← Back to Administration</button>
            </div>

            {viewingAs && (
                <div className="clients-viewas-banner">
                    <span>VIEWING AS: <strong>{viewingAs.name}</strong></span>
                    <button onClick={handleEndViewAs}>Exit view-as</button>
                </div>
            )}

            {error && <div className="clients-error">{error}</div>}

            <div className="clients-tabs">
                <button className={tab === 'clients' ? 'active' : ''} onClick={() => setTab('clients')}>Clients</button>
                <button className={tab === 'entitlements' ? 'active' : ''} onClick={() => setTab('entitlements')}>Service Entitlements</button>
                <button className={tab === 'shadowserver' ? 'active' : ''} onClick={() => setTab('shadowserver')}>Shadowserver Configuration</button>
                <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>View-As Audit Log</button>
            </div>

            <div className="clients-content">
                {tab === 'clients' && (
                    <ClientsTab
                        clients={clients}
                        loading={loading}
                        onReload={loadClients}
                        onError={setError}
                        onViewAsStarted={(c) => { setViewingAs(c); }}
                    />
                )}
                {tab === 'entitlements' && (
                    <EntitlementsTab clients={clients} onError={setError} />
                )}
                {tab === 'shadowserver' && (
                    <ShadowserverConfigTab clients={clients} onError={setError} />
                )}
                {tab === 'audit' && <AuditTab onError={setError} />}
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Clients tab — create clients, manage membership, "View as Client"
// ---------------------------------------------------------------------------
function ClientsTab({ clients, loading, onReload, onError, onViewAsStarted }: {
    clients: PlatformClient[]; loading: boolean; onReload: () => void; onError: (m: string | null) => void;
    onViewAsStarted: (c: PlatformClient) => void;
}) {
    const [name, setName] = useState('');
    const [creating, setCreating] = useState(false);
    const [expandedId, setExpandedId] = useState<number | null>(null);
    const [members, setMembers] = useState<ClientMember[]>([]);
    const [memberUserId, setMemberUserId] = useState('');
    const [contactUsername, setContactUsername] = useState('');
    const [contactEmail, setContactEmail] = useState('');
    const [contactPassword, setContactPassword] = useState('');
    const [creatingContact, setCreatingContact] = useState(false);

    const handleCreate = async () => {
        if (!name.trim()) return;
        setCreating(true);
        onError(null);
        try {
            await createPlatformClient({ name: name.trim() });
            setName('');
            onReload();
        } catch (e: any) {
            onError(e?.message || 'Failed to create client');
        } finally {
            setCreating(false);
        }
    };

    const toggleStatus = async (c: PlatformClient) => {
        try {
            await updatePlatformClient(c.id, { status: c.status === 'active' ? 'inactive' : 'active' });
            onReload();
        } catch (e: any) {
            onError(e?.message || 'Failed to update client');
        }
    };

    const toggleExpand = async (c: PlatformClient) => {
        if (expandedId === c.id) { setExpandedId(null); return; }
        setExpandedId(c.id);
        try {
            setMembers(await getClientMembers(c.id));
        } catch (e: any) {
            onError(e?.message || 'Failed to load members');
        }
    };

    const handleAddMember = async (clientId: number) => {
        if (!memberUserId.trim()) return;
        try {
            await addClientMember(clientId, memberUserId.trim());
            setMemberUserId('');
            setMembers(await getClientMembers(clientId));
        } catch (e: any) {
            onError(e?.message || 'Failed to add member');
        }
    };

    const handleRemoveMember = async (clientId: number, userId: number) => {
        try {
            await removeClientMember(clientId, userId);
            setMembers(await getClientMembers(clientId));
        } catch (e: any) {
            onError(e?.message || 'Failed to remove member');
        }
    };

    // Plan §8 Phase 4 "Onboarding" — a real point-of-contact account,
    // created with the is_client_scoped role and this client's membership
    // in one action, rather than a separate User Management trip.
    const handleCreateContact = async (clientId: number) => {
        if (!contactUsername.trim() || !contactEmail.trim() || !contactPassword.trim()) return;
        setCreatingContact(true);
        try {
            await createClientContact(clientId, { username: contactUsername.trim(), email: contactEmail.trim(), password: contactPassword });
            setContactUsername(''); setContactEmail(''); setContactPassword('');
            setMembers(await getClientMembers(clientId));
        } catch (e: any) {
            onError(e?.message || 'Failed to create client contact');
        } finally {
            setCreatingContact(false);
        }
    };

    const handleViewAs = async (c: PlatformClient) => {
        try {
            const result = await startViewAsClient(c.id);
            onViewAsStarted(result.viewingAs);
        } catch (e: any) {
            onError(e?.message || 'Failed to start view-as');
        }
    };

    return (
        <div>
            <div className="clients-create-row">
                <input placeholder="New client organization name" value={name} onChange={(e) => setName(e.target.value)} />
                <button className="clients-primary" disabled={creating || !name.trim()} onClick={handleCreate}>
                    {creating ? 'Creating…' : 'Create client'}
                </button>
            </div>

            {loading ? (
                <div className="clients-loading">Loading…</div>
            ) : (
                <div className="clients-table">
                    <div className="clients-thead">
                        <div>Name</div><div>Slug</div><div>Status</div><div>Created</div><div>Actions</div>
                    </div>
                    {clients.map((c) => (
                        <div key={c.id}>
                            <div className="clients-tr">
                                <div className="clients-cell">{c.name}</div>
                                <div className="clients-cell">{c.slug}</div>
                                <div className="clients-cell"><span className={`clients-status-badge ${c.status}`}>{c.status}</span></div>
                                <div className="clients-cell">{c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</div>
                                <div className="clients-actions">
                                    <button onClick={() => toggleExpand(c)}>{expandedId === c.id ? 'Hide members' : 'Members'}</button>
                                    <button onClick={() => toggleStatus(c)}>{c.status === 'active' ? 'Deactivate' : 'Activate'}</button>
                                    <button onClick={() => handleViewAs(c)}>View as</button>
                                </div>
                            </div>
                            {expandedId === c.id && (
                                <div className="clients-members-panel">
                                    <p className="clients-note">Create a new point-of-contact account (gets the Client role and lands on the restricted Client Portal — never the full app) or link an existing user by id.</p>
                                    <div className="clients-members-add">
                                        <input placeholder="Username" value={contactUsername} onChange={(e) => setContactUsername(e.target.value)} />
                                        <input placeholder="Email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
                                        <input placeholder="Password" type="password" value={contactPassword} onChange={(e) => setContactPassword(e.target.value)} />
                                        <button className="clients-primary" disabled={creatingContact} onClick={() => handleCreateContact(c.id)}>
                                            {creatingContact ? 'Creating…' : 'Create client contact'}
                                        </button>
                                    </div>
                                    <div className="clients-members-add">
                                        <input placeholder="User id to add as a member" value={memberUserId} onChange={(e) => setMemberUserId(e.target.value)} />
                                        <button onClick={() => handleAddMember(c.id)}>Add existing user</button>
                                    </div>
                                    {members.length === 0 ? (
                                        <p className="clients-empty">No members yet.</p>
                                    ) : (
                                        <ul className="clients-members-list">
                                            {members.map((m) => (
                                                <li key={m.id}>
                                                    {m.username} ({m.email || 'no email'})
                                                    <button onClick={() => handleRemoveMember(c.id, m.id)}>Remove</button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                    {clients.length === 0 && <div className="clients-empty">No clients yet.</div>}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Service Entitlements tab — which CTI services a client can use (plan
// §6/§14), a checkbox-style toggle per registered service. Deliberately NOT
// where credentials live (plan §15: entitlement and credential model are
// orthogonal) — see ShadowserverConfigTab below for that.
// ---------------------------------------------------------------------------
function EntitlementsTab({ clients, onError }: { clients: PlatformClient[]; onError: (m: string | null) => void }) {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [entitlements, setEntitlements] = useState<ClientServiceEntitlement[]>([]);
    const [auditLog, setAuditLog] = useState<ServiceEntitlementAuditEntry[]>([]);
    const [updating, setUpdating] = useState<string | null>(null);

    useEffect(() => {
        if (clients.length && selectedClientId == null) setSelectedClientId(clients[0].id);
    }, [clients, selectedClientId]);

    const reload = async (clientId: number) => {
        try {
            const [ents, audit] = await Promise.all([
                getClientServiceEntitlements(clientId),
                getServiceEntitlementAudit(clientId, { pageSize: 20 })
            ]);
            setEntitlements(ents);
            setAuditLog(audit.items);
        } catch (e: any) {
            onError(e?.message || 'Failed to load service entitlements');
        }
    };

    useEffect(() => {
        if (selectedClientId != null) reload(selectedClientId);
    }, [selectedClientId]);

    const handleToggle = async (serviceKey: string, currentlyEnabled: boolean) => {
        if (!selectedClientId) return;
        setUpdating(serviceKey);
        try {
            await setClientServiceEntitlement(selectedClientId, serviceKey, currentlyEnabled ? 'disabled' : 'enabled');
            await reload(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to update entitlement');
        } finally {
            setUpdating(null);
        }
    };

    return (
        <div>
            <div className="clients-create-row">
                <label>Client:&nbsp;</label>
                <select value={selectedClientId ?? ''} onChange={(e) => setSelectedClientId(Number(e.target.value))}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
            </div>

            <section className="clients-section">
                <h3>Service Entitlements</h3>
                <p className="clients-note">
                    Not every client receives every CTI service — a client only gets access to a service once explicitly
                    enabled here. Entitlement is independent of credential configuration (see the Shadowserver
                    Configuration tab): a service can be enabled before, or without, credentials being fully set up.
                </p>
                <ul className="clients-simple-list">
                    {entitlements.map((s) => {
                        const enabled = s.entitlementStatus === 'enabled';
                        return (
                            <li key={s.serviceKey}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <input
                                        type="checkbox"
                                        checked={enabled}
                                        disabled={updating === s.serviceKey}
                                        onChange={() => handleToggle(s.serviceKey, enabled)}
                                    />
                                    {s.displayName}
                                </label>
                                <span className={`clients-status-badge ${enabled ? 'active' : 'inactive'}`}>
                                    {enabled ? 'enabled' : 'not subscribed'}
                                </span>
                                {s.serviceStatus !== 'active' && <span className="clients-status-badge inactive">{s.serviceStatus}</span>}
                            </li>
                        );
                    })}
                    {entitlements.length === 0 && <li className="clients-empty">No services registered.</li>}
                </ul>
            </section>

            <section className="clients-section">
                <h3>Entitlement change history</h3>
                <ul className="clients-simple-list">
                    {auditLog.map((a) => (
                        <li key={a.id}>
                            {a.serviceKey}: {a.previousStatus ?? '(none)'} → {a.newStatus} by {a.actorUsername ?? `user #${a.actorUserId}`}
                            {a.createdAt ? ` — ${new Date(a.createdAt).toLocaleString()}` : ''}
                        </li>
                    ))}
                    {auditLog.length === 0 && <li className="clients-empty">No entitlement changes yet.</li>}
                </ul>
            </section>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Shadowserver Configuration tab — credentials, watched ranges, ingestion
// gate, sync. Administrative setup only (plan §8/§15) — the intelligence
// experience (findings, trend) lives under Threat Intelligence ->
// Shadowserver instead, never duplicated here.
// ---------------------------------------------------------------------------
function ShadowserverConfigTab({ clients, onError }: { clients: PlatformClient[]; onError: (m: string | null) => void }) {
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [credentials, setCredentials] = useState<ShadowserverCredentialMeta[]>([]);
    const [ranges, setRanges] = useState<ShadowserverRange[]>([]);
    const [readiness, setReadiness] = useState<ShadowserverReadiness | null>(null);
    const [syncResult, setSyncResult] = useState<ShadowserverSyncResult | null>(null);
    const [syncing, setSyncing] = useState(false);

    const [apiKey, setApiKey] = useState('');
    const [apiSecret, setApiSecret] = useState('');
    const [credLabel, setCredLabel] = useState('');
    const [cidr, setCidr] = useState('');
    const [rangeLabel, setRangeLabel] = useState('');

    useEffect(() => {
        if (clients.length && selectedClientId == null) setSelectedClientId(clients[0].id);
    }, [clients, selectedClientId]);

    const reloadClientData = async (clientId: number) => {
        try {
            const [creds, rngs, ready] = await Promise.all([
                getShadowserverCredentials(clientId),
                getShadowserverRanges(clientId),
                getShadowserverReadiness(clientId)
            ]);
            setCredentials(creds);
            setRanges(rngs);
            setReadiness(ready);
        } catch (e: any) {
            onError(e?.message || 'Failed to load Shadowserver configuration');
        }
    };

    useEffect(() => {
        if (selectedClientId != null) reloadClientData(selectedClientId);
    }, [selectedClientId]);

    const handleAddCredential = async () => {
        if (!selectedClientId || !apiKey.trim() || !apiSecret.trim()) return;
        try {
            await createShadowserverCredential(selectedClientId, { apiKey: apiKey.trim(), apiSecret: apiSecret.trim(), label: credLabel.trim() || undefined });
            setApiKey(''); setApiSecret(''); setCredLabel('');
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to save credential');
        }
    };

    const handleRevokeCredential = async (id: number) => {
        if (!selectedClientId) return;
        try {
            await revokeShadowserverCredential(id);
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to revoke credential');
        }
    };

    const handleAddRange = async () => {
        if (!selectedClientId || !cidr.trim()) return;
        try {
            await createShadowserverRange(selectedClientId, { cidr: cidr.trim(), label: rangeLabel.trim() || undefined });
            setCidr(''); setRangeLabel('');
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to add range');
        }
    };

    const handleConfirmReal = async (rangeId: number) => {
        if (!selectedClientId) return;
        try {
            await confirmShadowserverRangeReal(rangeId);
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to confirm range');
        }
    };

    // Plan §8 Phase 3 — soft removal only: the range is deactivated and its
    // finding history is kept, and a best-effort Filters API unregistration
    // is attempted first (reported via filtersApiStatus, never blocking).
    const handleRemoveRange = async (rangeId: number) => {
        if (!selectedClientId) return;
        try {
            const result = await removeShadowserverRange(rangeId);
            if (result.filtersApiStatus === 'unavailable') {
                onError(`Range removed locally, but Shadowserver-side removal was unavailable — verify manually. (${result.filtersApiError || 'unreachable'})`);
            } else {
                onError(null);
            }
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to remove range');
        }
    };

    const handleSync = async () => {
        if (!selectedClientId) return;
        setSyncing(true);
        onError(null);
        try {
            const result = await syncShadowserverClient(selectedClientId);
            setSyncResult(result);
            reloadClientData(selectedClientId);
        } catch (e: any) {
            onError(e?.message || 'Failed to sync from Shadowserver');
        } finally {
            setSyncing(false);
        }
    };

    return (
        <div>
            <div className="clients-create-row">
                <label>Client:&nbsp;</label>
                <select value={selectedClientId ?? ''} onChange={(e) => setSelectedClientId(Number(e.target.value))}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {readiness && (
                    <span className={`clients-readiness-badge ${readiness.ready ? 'ready' : 'not-ready'}`}>
                        {readiness.ready ? 'Ingestion ready' : `Not ready — ${readiness.reason}`}
                    </span>
                )}
            </div>

            <section className="clients-section">
                <h3>Credentials</h3>
                <p className="clients-note">Confirmed 4 fully separate subscriptions — one active credential pair per client. Secrets are AES-256-GCM encrypted at rest and never returned by any API response.</p>
                <div className="clients-create-row">
                    <input placeholder="API key" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
                    <input placeholder="API secret" type="password" value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} />
                    <input placeholder="Label (optional)" value={credLabel} onChange={(e) => setCredLabel(e.target.value)} />
                    <button className="clients-primary" onClick={handleAddCredential}>Save credential</button>
                </div>
                <ul className="clients-simple-list">
                    {credentials.map((cr) => (
                        <li key={cr.id}>
                            {cr.label || 'Credential'} — <span className={`clients-status-badge ${cr.status === 'active' ? 'active' : 'inactive'}`}>{cr.status}</span>
                            {cr.status === 'active' && <button onClick={() => handleRevokeCredential(cr.id)}>Revoke</button>}
                        </li>
                    ))}
                    {credentials.length === 0 && <li className="clients-empty">No credentials yet.</li>}
                </ul>
            </section>

            <section className="clients-section">
                <h3>Watched ranges</h3>
                <p className="clients-note">Every range starts unconfirmed — only an admin's explicit "Confirm real" action lets ingestion run against it. No placeholder ranges.</p>
                <div className="clients-create-row">
                    <input placeholder="CIDR (e.g. 203.0.113.0/24)" value={cidr} onChange={(e) => setCidr(e.target.value)} />
                    <input placeholder="Label (optional)" value={rangeLabel} onChange={(e) => setRangeLabel(e.target.value)} />
                    <button className="clients-primary" onClick={handleAddRange}>Add range</button>
                    <button onClick={handleSync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync from Shadowserver'}</button>
                </div>
                {syncResult && (
                    <p className="clients-note">
                        Sync status: <strong>{syncResult.status}</strong>
                        {syncResult.status === 'ok' && ` — ${syncResult.addedCidrs?.length ?? 0} new range(s) added as candidates from your Shadowserver filter list (${syncResult.ranges.length} total registered).`}
                        {syncResult.status === 'not_configured' && ' — add a credential first.'}
                        {syncResult.errorMessage && ` — ${syncResult.errorMessage}`}
                    </p>
                )}
                <ul className="clients-simple-list">
                    {ranges.map((r) => (
                        <li key={r.id}>
                            {r.cidr} {r.label ? `(${r.label})` : ''} —{' '}
                            {!r.active ? (
                                <span className="clients-status-badge inactive">removed</span>
                            ) : (
                                <span className={`clients-status-badge ${r.confirmedReal ? 'active' : 'inactive'}`}>{r.confirmedReal ? 'confirmed real' : 'unconfirmed'}</span>
                            )}
                            {r.active && !r.confirmedReal && <button onClick={() => handleConfirmReal(r.id)}>Confirm real</button>}
                            {r.active && <button onClick={() => handleRemoveRange(r.id)}>Remove</button>}
                        </li>
                    ))}
                    {ranges.length === 0 && <li className="clients-empty">No ranges yet.</li>}
                </ul>
            </section>

            <p className="clients-note">
                Findings, trend, and search now live under <strong>Threat Intelligence → Shadowserver</strong> —
                the intelligence experience is deliberately not duplicated here (plan §12).
            </p>
        </div>
    );
}

// ---------------------------------------------------------------------------
// Audit tab — every "View as Client" entry/exit (plan §5/§11 Q02)
// ---------------------------------------------------------------------------
function AuditTab({ onError }: { onError: (m: string | null) => void }) {
    const [entries, setEntries] = useState<ViewAsAuditEntry[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        getViewAsAudit({ pageSize: 100 })
            .then((r) => setEntries(r.items))
            .catch((e) => onError(e?.message || 'Failed to load audit log'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="clients-loading">Loading…</div>;

    return (
        <div className="clients-table">
            <div className="clients-thead-audit">
                <div>Admin</div><div>Client</div><div>Started</div><div>Ended</div>
            </div>
            {entries.map((e) => (
                <div className="clients-tr-audit" key={e.id}>
                    <div className="clients-cell">{e.adminUsername}</div>
                    <div className="clients-cell">{e.clientName}</div>
                    <div className="clients-cell">{e.startedAt ? new Date(e.startedAt).toLocaleString() : '—'}</div>
                    <div className="clients-cell">{e.endedAt ? new Date(e.endedAt).toLocaleString() : <span className="clients-status-badge active">still viewing</span>}</div>
                </div>
            ))}
            {entries.length === 0 && <div className="clients-empty">No view-as activity yet.</div>}
        </div>
    );
}
