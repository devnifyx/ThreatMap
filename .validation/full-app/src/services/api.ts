import { notifyAuthStatus } from './authEvents';
import { downloadBlob } from '../components/shared/downloadFile';  // P1-5 — was open-coded 6x here

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/+$/, '');

type FetchWithAuthOptions = RequestInit & {
    suppressAuthRedirect?: boolean;
    includeAuthHeader?: boolean;
};

const getAuthHeaders = (): Record<string, string> => {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
};

const fetchWithAuth = async (url: string, options: FetchWithAuthOptions = {}) => {
    const {
        suppressAuthRedirect = false,
        includeAuthHeader = true,
        headers,
        ...requestOptions
    } = options;

    const res = await fetch(url, {
        credentials: 'include',
        ...requestOptions,
        headers: {
            ...headers,
            ...(includeAuthHeader ? getAuthHeaders() : {})
        }
    });
    if (!suppressAuthRedirect) {
        notifyAuthStatus(res.status);
    }
    return res;
};

export async function getHistoryScans(params: {
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    order?: string;
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetchWithAuth(`${API_BASE_URL}/api/history/scans?${qs.toString()}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history');
    }

    return res.json();
}

export async function getHistoryScanDetails(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/history/scans/${id}`);

    if (res.status === 401) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 403) {
        throw new Error('Forbidden');
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history detail');
    }
    return res.json();
}

export async function getHistoryOsint(params: {
    q?: string;
    from?: string;
    to?: string;
    module?: string;
    type?: string;
    source?: string;
    risk?: string;
    status?: string;    // INVESTIGATION_DASHBOARD.md §6
    analyst?: string;   // INVESTIGATION_DASHBOARD.md §6
    sortBy?: 'created_at' | 'risk_level' | 'module' | 'status';
    sortDir?: 'asc' | 'desc';
    encrypted?: '1' | '0';
    payloadAvailable?: '1' | '0';
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.module) qs.set('module', params.module);
    if (params.type) qs.set('type', params.type);
    if (params.source) qs.set('source', params.source);
    if (params.risk) qs.set('risk', params.risk);
    if (params.status) qs.set('status', params.status);
    if (params.analyst) qs.set('analyst', params.analyst);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.sortDir) qs.set('sortDir', params.sortDir);
    if (params.encrypted) qs.set('encrypted', params.encrypted);
    if (params.payloadAvailable) qs.set('payloadAvailable', params.payloadAvailable);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetchWithAuth(`${API_BASE_URL}/api/history/osint?${qs.toString()}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history');
    }
    return res.json();
}

export async function getHistoryOsintDetails(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/history/osint/${id}`);

    if (res.status === 401) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 403) {
        throw new Error('Forbidden');
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history detail');
    }
    return res.json();
}

async function deleteHistoryRecord(url: string, fallbackMessage: string) {
    const res = await fetchWithAuth(url, {
        method: 'DELETE'
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
    const raw = await res.text().catch(() => '');
    const msg =
      raw.trim().startsWith('<') || raw.includes('Cannot DELETE')
        ? 'Delete endpoint not available. Restart the backend server.'
        : 'Not found';
    throw new Error(msg);
    }
    if (!res.ok) {
    const raw = await res.text().catch(() => '');
    const parsed = (() => {
      try {
        return raw ? JSON.parse(raw) : null;
      } catch {
        return null;
      }
    })();
    const msgFromJson =
      parsed && typeof parsed === 'object' ? ((parsed as any).message || (parsed as any).error) : null;
    const msg =
      typeof msgFromJson === 'string' && msgFromJson.trim()
        ? msgFromJson.trim()
        : raw.trim().startsWith('<')
          ? `${fallbackMessage}: API returned HTML. Ensure the backend is running and Vite proxy is configured.`
          : fallbackMessage;
    throw new Error(msg);
    }
    return res.json();
}

export async function deleteHistoryScan(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/history/scans/${id}`, 'Failed to delete scan');
}

export async function deleteHistoryOsint(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/history/osint/${id}`, 'Failed to delete OSINT record');
}

export async function deleteUserHistoryScan(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/user/history/scans/${id}`, 'Failed to delete scan');
}

export async function deleteUserHistoryOsint(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/user/history/osint/${id}`, 'Failed to delete OSINT record');
}

async function bulkDeleteHistoryRecords(url: string, ids: number[], fallbackMessage: string) {
    const res = await fetchWithAuth(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids })
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please login.');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || fallbackMessage);
    }
    return res.json();
}

// Bulk soft-delete — matches single-item delete semantics (row stays, marked
// deleted), just for many ids in one confirmed action.
export async function bulkDeleteHistoryScans(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/history/scans/bulk-delete`, ids, 'Failed to delete scans');
}

export async function bulkDeleteUserHistoryScans(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/user/history/scans/bulk-delete`, ids, 'Failed to delete scans');
}

export async function bulkDeleteHistoryOsint(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/history/osint/bulk-delete`, ids, 'Failed to delete OSINT records');
}

export async function bulkDeleteUserHistoryOsint(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/user/history/osint/bulk-delete`, ids, 'Failed to delete OSINT records');
}

// Admin-only, irreversible. Backend rejects (409) unless the record is
// already soft-deleted — see permanentlyDeleteScanHistory in database/storage.js.
export async function permanentlyDeleteHistoryScan(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/history/scans/${id}/permanent`, 'Failed to permanently delete scan');
}

export async function permanentlyDeleteHistoryOsint(id: number) {
    return deleteHistoryRecord(`${API_BASE_URL}/api/history/osint/${id}/permanent`, 'Failed to permanently delete OSINT record');
}

// Admin-only, irreversible, bulk. Ids that aren't already soft-deleted are
// skipped server-side (not force-deleted) — see bulkPermanentlyDeleteScanHistory.
export async function bulkPermanentlyDeleteHistoryScans(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/history/scans/bulk-permanent-delete`, ids, 'Failed to permanently delete scans');
}

export async function bulkPermanentlyDeleteHistoryOsint(ids: number[]) {
    return bulkDeleteHistoryRecords(`${API_BASE_URL}/api/history/osint/bulk-permanent-delete`, ids, 'Failed to permanently delete OSINT records');
}

export async function runRecon(target: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/recon?target=${encodeURIComponent(target)}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        throw new Error("API error");
    }

    return res.json();
}

export async function getOsintData(module: string, target: string, scanId?: number) {
    let url = `${API_BASE_URL}/api/osint/${module}?target=${encodeURIComponent(target)}`;
    if (scanId) {
        url += `&scanId=${scanId}`;
    }

    const res = await fetchWithAuth(url);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        let errorMessage = `Failed to fetch OSINT data for ${module}`;
        try {
            const contentType = res.headers.get('content-type') || '';
            if (contentType.includes('application/json')) {
                const errData = await res.json();
                errorMessage = errData.error || errorMessage;
            } else {
                errorMessage = `Backend responded with non-JSON data (status ${res.status}). Check API base URL.`;
            }
        } catch {
            errorMessage = `Backend responded with non-JSON data (status ${res.status}). Check API base URL.`;
        }
        throw new Error(errorMessage);
    }

    try {
        return await res.json();
    } catch {
        throw new Error("Backend response was not valid JSON. Check API base URL.");
    }
}

export async function login(username: string, password: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        suppressAuthRedirect: true,
        includeAuthHeader: false,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
    });

    const raw = await res.text();
    const parsed = (() => {
        try {
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    })();

    if (!res.ok) {
        const msgFromJson =
            parsed && typeof parsed === 'object'
                ? ((parsed as any).message || (parsed as any).error)
                : null;
        const msg =
            typeof msgFromJson === 'string' && msgFromJson.trim()
                ? msgFromJson.trim()
                : raw.trim().startsWith('<')
                    ? 'Login failed: API returned HTML. Ensure the backend is running and Vite proxy is configured.'
                    : `Login failed (HTTP ${res.status})`;
        throw new Error(msg);
    }

    if (!parsed || typeof parsed !== 'object') {
        throw new Error('Login failed: Invalid JSON response from server');
    }
    const data = parsed as any;
    if (data.token) {
        localStorage.setItem('token', data.token);
    }
    return data;
}

export async function logout() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        suppressAuthRedirect: true
    });

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Logout failed');
    }

    return res.json().catch(() => ({ status: 'success' }));
}

export async function getAllUsers() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load users');
    }
    return res.json();
}

export async function getUserById(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${id}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load user');
    }
    return res.json();
}

export async function createUser(userData: { username: string; email: string; role: string; roleId?: number; password?: string; firstName?: string; lastName?: string }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to create user');
    }
    return res.json();
}

export async function updateUser(id: number, userData: { username?: string; email?: string; role?: string; roleId?: number; isActive?: boolean; password?: string; firstName?: string; lastName?: string }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(userData)
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to update user');
    }
    return res.json();
}

export async function deleteUser(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/users/${id}`, {
        method: 'DELETE'
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete user');
    }
    return res.json();
}

export async function getAuditLogs(params: {
    page?: number;
    pageSize?: number;
    actorUserId?: number;
    recordKind?: string;
    action?: string;
}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    if (params.actorUserId) qs.set('actorUserId', String(params.actorUserId));
    if (params.recordKind) qs.set('recordKind', params.recordKind);
    if (params.action) qs.set('action', params.action);

    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/audit-logs?${qs.toString()}`);
    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load audit logs');
    }
    return res.json();
}

export async function getProviderStatus(mode: 'presence' | 'active' = 'presence') {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/provider-status?mode=${mode}`);
    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load provider status');
    }
    return res.json();
}

// ADMINISTRATION_PASS3.md — self-service preferences, not admin-gated.
// Scoped to the logged-in user via req.user.id server-side.
export async function getUserPreferences() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/preferences`);
    if (res.status === 401) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load preferences');
    }
    return res.json();
}

export async function updateUserPreferences(prefs: { defaultPhoneCountryCode?: string; notificationsEnabled?: boolean }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/preferences`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs)
    });
    if (res.status === 401) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to save preferences');
    }
    return res.json();
}

// ADMINISTRATION_PASS4.md — self-service personal API tokens, same
// req.user.id-scoped shape as preferences above. createMyApiKey()'s
// response contains the full key exactly once — the caller must show it
// immediately and never persist it.
export async function getMyApiKeys() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/api-keys`);
    if (res.status === 401) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load API keys');
    }
    return res.json();
}

export async function createMyApiKey(label: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/api-keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label })
    });
    if (res.status === 401) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to create API key');
    }
    return res.json();
}

export async function revokeMyApiKey(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/api-keys/${id}`, { method: 'DELETE' });
    if (res.status === 401) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to revoke API key');
    }
    return res.json();
}

// ADMINISTRATION_PASS5.md — system-wide operational settings, admin-only.
// Fixed allowlist enforced server-side (services/appSettings.js) — this
// client can never write a key outside that list.
export async function getAppSettings() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/settings`);
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load settings');
    }
    return res.json();
}

export async function updateAppSetting(key: string, value: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/settings/${key}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
    });
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to update setting');
    }
    return res.json();
}

// RBAC_ROLES_IMPL.md Part D — role/permission management, users.manage-gated
// server-side (see server.js's /api/admin/roles* routes).
export async function getRoles() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/roles`);
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load roles');
    }
    return res.json();
}

export async function getPermissions() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/permissions`);
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load permissions');
    }
    return res.json();
}

export async function createRole(role: { name: string; description?: string; permissionKeys: string[] }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(role)
    });
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to create role');
    }
    return res.json();
}

export async function updateRole(id: number, updates: { name?: string; description?: string; permissionKeys?: string[] }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/roles/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to update role');
    }
    return res.json();
}

export async function deleteRole(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/roles/${id}`, { method: 'DELETE' });
    if (res.status === 401 || res.status === 403) throw new Error("Authentication required. Please login.");
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to delete role');
    }
    return res.json();
}

export async function getUserHistoryScans(params: {
    q?: string;
    from?: string;
    to?: string;
    sort?: string;
    order?: string;
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/history/scans?${qs.toString()}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }

    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history');
    }

    return res.json();
}

export async function getUserHistoryOsint(params: {
    q?: string;
    from?: string;
    to?: string;
    module?: string;
    type?: string;
    source?: string;
    risk?: string;
    status?: string;    // INVESTIGATION_DASHBOARD.md §6
    analyst?: string;   // INVESTIGATION_DASHBOARD.md §6
    sortBy?: 'created_at' | 'risk_level' | 'module' | 'status';
    sortDir?: 'asc' | 'desc';
    encrypted?: '1' | '0';
    payloadAvailable?: '1' | '0';
    page?: number;
    pageSize?: number;
}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.module) qs.set('module', params.module);
    if (params.type) qs.set('type', params.type);
    if (params.source) qs.set('source', params.source);
    if (params.risk) qs.set('risk', params.risk);
    if (params.status) qs.set('status', params.status);
    if (params.analyst) qs.set('analyst', params.analyst);
    if (params.sortBy) qs.set('sortBy', params.sortBy);
    if (params.sortDir) qs.set('sortDir', params.sortDir);
    if (params.encrypted) qs.set('encrypted', params.encrypted);
    if (params.payloadAvailable) qs.set('payloadAvailable', params.payloadAvailable);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));

    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/history/osint?${qs.toString()}`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history');
    }
    return res.json();
}

export async function getUserHistoryScanDetails(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/history/scans/${id}`);

    if (res.status === 401) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 403) {
        throw new Error('Forbidden');
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load history detail');
    }
    return res.json();
}

export async function getUserHistoryOsintDetails(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/user/history/osint/${id}`);

    if (res.status === 401) {
        throw new Error("Authentication required. Please login.");
    }
    if (res.status === 403) {
        throw new Error('Forbidden');
    }
    if (res.status === 404) {
        throw new Error('Not found');
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load OSINT history detail');
    }
    return res.json();
}

export async function getSystemStats() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/stats`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load system stats');
    }
    return res.json();
}

export async function getDashboardStats() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/stats`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load dashboard stats');
    }
    return res.json();
}

// DASHBOARD_PHASE2.md §3 — Statistics fetch
export async function getDashboardStatistics() {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/statistics`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load statistics');
    return body as {
        scans: {
            total: number; today: number; week7: number; month30: number; month90: number;
            riskBreakdown: { critical: number; high: number; medium: number; low: number };
        };
        osint: {
            total: number; uniqueTargets: number;
            byModule: { module: string; count: number; slug: string }[];
            riskBreakdown: { critical: number; high: number; medium: number; low: number; unknown: number };
        };
        correlations: { total: number };
        users: { total: number; byRole: { role: string; count: number }[] };
        brandIntel: { totalBrands: number; activeCampaigns: number; totalScans: number; totalCandidates: number } | null;
    };
}

// DASHBOARD_PHASE2.md §3 — Trends fetch
export async function getDashboardTrends(period: '7d' | '30d' | '90d' = '30d') {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/trends?period=${period}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load trends');
    return body as {
        period: string;
        groupBy: 'DAY' | 'WEEK';
        series: {
            scans:          { date: string; count: number }[];
            osint:          { date: string; count: number }[];
            highCritical:   { date: string; count: number }[];
            brandCampaigns: { date: string; count: number }[] | null;
        };
    };
}

// DASHBOARD_PHASE2.md §3 — Analytics fetch
export async function getDashboardAnalytics(period: '30d' | '90d' | 'all' = '90d') {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/analytics?period=${period}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load analytics');
    return body as {
        period: string;
        moduleEffectiveness: {
            module: string; slug: string; total: number;
            critical: number; high: number; medium: number; low: number;
            highCriticalRate: number | null;
        }[];
        activityByDow: {
            osint: { label: string; count: number }[];
            scans: { label: string; count: number }[];
        };
        activityByHour: {
            osint: { hour: number; label: string; count: number }[];
        };
    };
}

// DASHBOARD_PHASE1.md §6 — Findings Feed fetch
export async function getDashboardFindings(params: {
    type?: string; risk?: string; module?: string; period?: string; page?: number; pageSize?: number;
} = {}) {
    const q = new URLSearchParams();
    if (params.type     && params.type     !== 'all') q.set('type',     params.type);
    if (params.risk     && params.risk     !== 'all') q.set('risk',     params.risk);
    if (params.module   && params.module   !== 'all') q.set('module',   params.module);
    if (params.period   && params.period   !== 'all') q.set('period',   params.period);
    if (params.page)     q.set('page',     String(params.page));
    if (params.pageSize) q.set('pageSize', String(params.pageSize));
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/findings?${q}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load findings');
    return body as { findings: any[]; pagination: { total: number; page: number; pageSize: number; totalPages: number } };
}

// DASHBOARD_PHASE1.md §6 — Risk Scores fetch
export async function getDashboardRiskScores() {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/risk-scores`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load risk scores');
    return body as { overall: Record<string, number>; byModule: any[]; recentHighCritical: any[] };
}

// DASHBOARD_PHASE1.md §6 — System Health fetch
export async function getDashboardSystemHealth() {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/system-health`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load system health');
    return (body as any).health as {
        database: string;
        brandIntelWorker: { status: string; activeJobs: number; stuckJobs: number } | null;
        threatFeed: string;
        configuredProviders: Record<string, boolean>;
    };
}

// ─── Performance Monitor (PERFORMANCE_MONITOR_PHASE1.md §16) ────────────────
// Envelope types mirror services/systemMetrics.js: every category is
// independently enveloped with `available` so "unavailable" is always
// distinguishable from a real zero (§31), and one failing category never
// breaks the page (§21).

export interface PmCpuUsage {
    available: boolean;
    reason?: string;
    usagePercent: number | null;
}
export interface PmCpuSpeed { available: boolean; speedMHz: number | null }
export interface PmMemory {
    available: boolean;
    reason?: string;
    totalBytes?: number;
    usedBytes?: number;
    availableBytes?: number;
    freeBytes?: number;
    usedPercent?: number;
    source?: string;
}
export interface PmDiskVolume {
    mount: string;
    totalBytes: number;
    usedBytes: number;
    availableBytes: number;
    usedPercent: number;
}
export interface PmDisks { available: boolean; reason?: string; disks?: PmDiskVolume[] }
export interface PmDiskActivityVolume {
    mount: string;
    diskNumber?: number | null;
    readBytesPerSec: number | null;
    writeBytesPerSec: number | null;
}
export interface PmDiskActivity { available: boolean; reason?: string; volumes?: PmDiskActivityVolume[] }
export interface PmNetworkInterface {
    name: string;
    addressV4: string | null;
    addressV6: string | null;
    internal: boolean;
    virtual: boolean;
    rxBytesPerSec: number | null;
    txBytesPerSec: number | null;
    totalRxBytes: number | null;
    totalTxBytes: number | null;
}
export interface PmNetwork { available: boolean; reason?: string; interfaces?: PmNetworkInterface[] }
export interface PmSystemInfo {
    available: boolean;
    os: string;
    platform: string;
    hostname: string;
    arch: string;
    cpuModel: string | null;
    baseSpeedMHz: number | null;
    physicalCores: number | null;
    logicalCores: number | null;
    totalMemoryBytes: number;
    nodeVersion: string;
    appVersion: string | null;
    processId: number;
    systemUptimeSeconds: number;
    processUptimeSeconds: number;
    processStartTime: string;
    environment: string;
    loadAverage: number[] | null;
}
export interface PmSnapshot {
    timestamp: string;
    cpu: PmCpuUsage;
    cpuSpeed: PmCpuSpeed;
    memory: PmMemory;
    disks: PmDisks;
    diskActivity: PmDiskActivity;
    network: PmNetwork;
    info: PmSystemInfo;
}

export async function getSystemPerformance(): Promise<PmSnapshot> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load performance metrics');
    return (body as any).performance as PmSnapshot;
}

// ─── Application Performance (PERFORMANCE_MONITOR_PHASE2.md) ────────────────

export interface PmSlowRequest { method: string; path: string; ms: number; at: number }
export interface PmApiMetrics {
    available: boolean;
    windowSeconds: number;
    totalRequests: number;
    requestsPerSecond: number;
    activeRequests: number;
    averageLatencyMs: number | null;
    medianLatencyMs: number | null;
    p95LatencyMs: number | null;
    errorRatePercent: number | null;
    count2xx: number; count3xx: number; count4xx: number; count5xx: number;
    successRatePercent: number | null;
    clientErrorRatePercent: number | null;
    serverErrorRatePercent: number | null;
    slowRequestThresholdMs: number;
    slowRequestsInWindow: number;
    slowRequests: PmSlowRequest[];
}
export interface PmNodeRuntime {
    available: boolean;
    processCpuPercent: number | null;
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
    eventLoopDelayMs: number | null;
    eventLoopStatus: 'Healthy' | 'Elevated' | 'Critical' | 'Unavailable';
    eventLoopThresholdsMs: { elevated: number; critical: number };
    processUptimeSeconds: number;
    nodeVersion: string;
    processId: number;
}
export interface PmDatabaseMetrics {
    available: boolean;
    reason?: string;
    status?: 'Healthy' | 'Degraded' | 'Unavailable';
    totalConnections?: number;
    activeConnections?: number;
    idleConnections?: number;
    maxConnections?: number;
    poolUtilizationPercent?: number | null;
    waitingRequests?: number;
    latencyMs?: number;
    checkedAt?: string;
}
export interface PmWorkerMetrics {
    available: boolean;
    reason?: string;
    queue?: string;
    jobsQueued?: number;
    jobsRunning?: number;
    jobsCompleted?: number;
    jobsFailed?: number;
    jobsCancelled?: number;
    stuckJobs?: number;
    averageJobDurationSeconds?: number | null;
    oldestQueuedAgeSeconds?: number | null;
    lastCompletedAt?: string | null;
    queueStatus?: 'Healthy' | 'Busy' | 'Delayed' | 'Blocked' | 'Unavailable';
    pollers?: { name: string; intervalMs: number }[];
    checkedAt?: string;
}
export interface PmSessionMetrics {
    available: boolean;
    reason?: string;
    activeSessions?: number;
    maxSessions?: number;
    sessionUtilizationPercent?: number | null;
}
export type PmHealthStatus = 'Healthy' | 'Degraded' | 'Critical' | 'Unavailable';
export interface PmHealthComponent { status: PmHealthStatus; reason: string | null }
export interface PmHealth {
    overall: PmHealthStatus;
    components: {
        api: PmHealthComponent;
        node: PmHealthComponent;
        database: PmHealthComponent;
        workers: PmHealthComponent;
        sessions: PmHealthComponent;
    };
}
export interface PmApplicationSnapshot {
    timestamp: string;
    api: PmApiMetrics;
    runtime: PmNodeRuntime;
    database: PmDatabaseMetrics;
    workers: PmWorkerMetrics;
    sessions: PmSessionMetrics;
    health: PmHealth;
    applicationUptimeSeconds: number;
}

export async function getApplicationPerformance(): Promise<PmApplicationSnapshot> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/application`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load application metrics');
    return (body as any).application as PmApplicationSnapshot;
}

// ─── Intelligence Workload (PERFORMANCE_MONITOR_PHASE3.md) ──────────────────

export interface PmIntelActiveJob {
    id: string; type: string; module: string; status: string;
    startedAt: string | null; durationSeconds: number | null;
    worker: string; targetType: string; targetLength: number | null;
}
export interface PmIntelQueueRow {
    name: string; pending: number; running: number; failed: number;
    oldestJobAgeSeconds: number | null; status: string;
}
export interface PmIntelModuleRow {
    module: string; activeJobs: number; avgDurationMs: number | null;
    medianDurationMs?: number | null; p95DurationMs?: number | null;
    runsLastHour: number; totalRuns: number;
    jobs24h: number; failureRatePercent: number | null;
}
export interface PmIntelWorkerRow {
    name: string; kind: string; status: string; currentJob: string | null;
    intervalMs: number; utilization: number | null;
}
export interface PmIntelProviderRow {
    id: string; status: string; configured: boolean;
    requests?: number; successRatePercent?: number | null; failureRatePercent?: number | null;
    averageLatencyMs?: number | null; rateLimitEvents?: number;
    lastSuccessfulRequestAt?: string | null; recentLatencyMs?: number[];
}
export interface PmIntelBottleneck {
    condition: string; area: string; evidence: string; severity: 'low' | 'medium' | 'high' | 'critical';
}
export interface PmIntelWorkloadObservation { kind: string; observation: string }
export interface PmIntelligenceSnapshot {
    timestamp: string;
    overview: {
        runningJobs: number; queuedJobs: number; activeInvestigations: number;
        failedJobsRecent: number; osintRunsLastHour: number;
        providerRequestsLastMinute: number; threatFeedRunsLastHour: number;
        imageJobsQueued: number;
    };
    activeJobs: { available: boolean; jobs: PmIntelActiveJob[] };
    investigations: {
        available: boolean; reason?: string;
        running?: number; waiting?: number; completedToday?: number; failedToday?: number;
        stuckRunningNote?: string | null;
    };
    modules: { available: boolean; modules: PmIntelModuleRow[] };
    threat: {
        available: boolean; reason?: string;
        feedRunsLastHour?: number; itemsCollectedLastHour?: number; itemsProcessedLastHour?: number;
        duplicatesLastHour?: number; rejectedLastHour?: number; failedRunsLastHour?: number;
        avgRunSeconds?: number | null;
        feeds?: { key: string; runsLastHour: number; errorsLastHour: number; lastSuccessAt: string | null }[];
    };
    image: {
        available: boolean; reason?: string;
        queued?: number; possiblyStuck?: number; completed24h?: number; failed24h?: number;
        rateLimited24h?: number; unavailable24h?: number; avgDurationSeconds?: number | null; images24h?: number;
    };
    telegram: {
        available: boolean; status: string;
        capability: Record<string, string>;
    };
    providers: { available: boolean; providers: PmIntelProviderRow[] };
    queues: { available: boolean; queues: PmIntelQueueRow[] };
    workers: { available: boolean; workers: PmIntelWorkerRow[] };
    bottlenecks: { available: boolean; label: string; findings: PmIntelBottleneck[] };
    workload: {
        available: boolean; attribution: string; attributionNote: string;
        observations: PmIntelWorkloadObservation[];
    };
}

export async function getIntelligencePerformance(): Promise<PmIntelligenceSnapshot> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/intelligence`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load intelligence metrics');
    return (body as any).intelligence as PmIntelligenceSnapshot;
}

// ─── Historical Analytics (PERFORMANCE_MONITOR_PHASE4.md) ────────────────────

export interface PmSeriesPoint {
    t: string; samples: number;
    min: number | null; max: number | null; avg: number | null;
    p50: number | null; p95: number | null; p99: number | null;
}
export interface PmMetricSeries {
    available: boolean; metric: string; range: string; resolution: number;
    coveragePercent: number; insufficientData: boolean; points: PmSeriesPoint[];
}
export interface PmBaseline {
    available: boolean; status: string; metric: string; method?: string; reason?: string;
    hoursOfData?: number; requiredHours?: number;
    median?: number; p25?: number; p75?: number; sampleBuckets?: number;
}
export interface PmAnomalyAssessment {
    available: boolean; metric: string; baselineStatus: string; status: string; reason?: string;
    baselineValue?: number; currentValue?: number; deviationPercent?: number;
    anomalyDeviationThresholdPercent?: number; anomalous?: boolean;
    baselineMethod?: string; band?: { p25: number; p75: number };
}
export interface PmPerfEvent {
    kind: string; condition: string; component: string; metric: string; severity: string;
    startedAt: string; endedAt: string | null; durationSeconds: number | null;
    peakValue: number | null; baselineValue: number | null; deviationPercent: number | null;
    sampleCount: number; evidence: string | null; alertId: number | null;
}
export interface PmBottleneckAgg {
    condition: string; component: string; firstDetectedAt: string; lastDetectedAt: string;
    occurrences: number; totalDurationSeconds: number; durations: number;
    averageDurationSeconds: number | null; peakValue: number | null; openNow: boolean;
}
export interface PmCapacityRow {
    metric: string; label: string; unit: string; hardMax: number | null;
    current: number | null; currentOfMax: string | null; utilizationPercent: number | null;
    thirtyDayAverage: number | null; thirtyDayPeak: number | null; band: string; historyStatus: string;
    forecast: { available: boolean; reason?: string; label?: string; trendPerDay?: number; estimatedDaysToCapacity?: number; note?: string };
}
export interface PmSloWindow {
    window: string; label: string; measuredMinutes: number; dataStatus: string;
    availabilityTargetPercent: number; availabilityPercent: number | null;
    latencyTargetMs: number; latencyCompliancePercent: number | null;
    errorBudgetUsedPercent: number | null; status: string;
}
export interface PmComparison {
    available: boolean; metric: string;
    currentHour: number | null; previousHour: number | null; currentHourVsPreviousPercent: number | null;
    today: number | null; yesterday: number | null; todayVsYesterdayPercent: number | null;
    sevenDayAverage: number | null; todayVsSevenDayPercent: number | null;
}
export interface PmTimelineEntry {
    at: string; type: string; condition: string; component: string;
    severity: string; endedAt: string | null; evidence: string | null;
}
export interface PmAnalyticsSnapshot {
    timestamp: string;
    overview: {
        systemHealth: string; applicationHealth: string; intelligenceHealth: string;
        openAnomalies: number; recentAnomalies: number; capacityRisk: string; sloStatus: string;
    };
    anomalies: { available: boolean; events: PmPerfEvent[] };
    bottlenecks: { available: boolean; bottlenecks: PmBottleneckAgg[] };
    capacity: { available: boolean; capacity: PmCapacityRow[] };
    slo: { available: boolean; windows: PmSloWindow[] };
    overhead: {
        available: boolean; samplingIntervalMs: number; samplesCollected: number;
        bucketsWritten: number; rowsStored: number;
        lastCollectionMs: number | null; lastStorageMs: number | null;
        averageCollectionMs: number | null; averageStorageMs: number | null; activeEpisodes: number;
    };
}

export async function getAnalyticsPerformance(): Promise<PmAnalyticsSnapshot> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/analytics`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load analytics');
    return (body as any).analytics as PmAnalyticsSnapshot;
}

export async function getMetricSeriesApi(metric: string, range: string): Promise<PmMetricSeries> {
    const qs = new URLSearchParams({ metric, range });
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/analytics/series?${qs}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load series');
    return (body as any).series as PmMetricSeries;
}

export interface PmAiSummary {
    executiveSummary: string; majorChanges: string[]; correlatedEvents: string[];
    inference: string[]; operationalPriorities: string[]; recommendedActions: string[]; note?: string;
}
export async function getAiPerformanceSummary(): Promise<{ available: boolean; summary: PmAiSummary }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/analytics/ai-summary`, { method: 'POST' });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to get AI summary');
    return (body as any).ai;
}

export interface PmPerfReport {
    available: boolean; generatedAt: string;
    sections: {
        systemHealth: { cpuPercent: number | null; memoryPercent: number | null } | null;
        applicationHealth: { overall: string; components: Record<string, { status: string; reason: string | null }> } | null;
        intelligence: { runningJobs: number; bottlenecks: number } | null;
        topAnomalies: PmPerfEvent[];
        topBottlenecks: PmBottleneckAgg[];
        capacityRisks: PmCapacityRow[];
        slo: PmAnalyticsSnapshot['slo'] | null;
        monitoringOverhead: PmAnalyticsSnapshot['overhead'] | null;
    };
    recommendations: string[];
    recommendationNote: string;
}
export async function getPerformanceReport(): Promise<PmPerfReport> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/system/performance/analytics/report`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to load report');
    return (body as any).report as PmPerfReport;
}

// DASHBOARD_PHASE3.md §3 — Scan-target geo overlay
export interface ScanLocation {
    id:          string;
    target:      string;
    kind:        string;
    lat:         number;
    lng:         number;
    country:     string;
    countryCode: string;
}

export async function getDashboardScanLocations(): Promise<ScanLocation[]> {
    const res  = await fetchWithAuth(`${API_BASE_URL}/api/dashboard/scan-locations`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return [];   // overlay is optional — silently degrade
    return Array.isArray((body as any).locations) ? (body as any).locations : [];
}

// ─── Investigation Dashboard (INVESTIGATION_DASHBOARD.md §6) ─────────────────

export interface InvestigationOverview {
    active: number;
    critical: number;
    high: number;
    inProgress: number;
    completed: number;
    last24h: number;
}

export interface InvestigationListItem {
    id: number;
    module: string;
    moduleSlug: string;
    target: string;
    risk_level: string | null;
    status: string;
    created_at: string | null;
}

export interface InvestigationActivityItem extends InvestigationListItem {
    actor: string;
    username: string | null;
}

export interface InvestigationQueueJob {
    id: number;
    status: string;
    progress_current: number;
    progress_total: number;
    started_at: string | null;
    created_at: string | null;
    brand_name: string;
}

export interface InvestigationStatistics {
    byModule: {
        module: string; slug: string; total: number;
        critical: number; high: number; medium: number; low: number;
    }[];
    byStatus: { open: number; in_progress: number; resolved: number; false_positive: number };
}

async function fetchInvestigationsJson<T>(path: string, fallbackMessage: string): Promise<T> {
    const res  = await fetchWithAuth(`${API_BASE_URL}${path}`);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return (body as any).data as T;
}

export async function getInvestigationOverview(): Promise<InvestigationOverview> {
    return fetchInvestigationsJson('/api/investigations/overview', 'Failed to load investigation overview');
}

export async function getInvestigationCriticalFindings(limit = 10): Promise<InvestigationListItem[]> {
    return fetchInvestigationsJson(`/api/investigations/critical?limit=${limit}`, 'Failed to load critical findings');
}

export async function getInvestigationQueue(): Promise<{ available: boolean; jobs: InvestigationQueueJob[] }> {
    return fetchInvestigationsJson('/api/investigations/queue', 'Failed to load investigation queue');
}

export async function getRecentInvestigations(limit = 15): Promise<InvestigationListItem[]> {
    return fetchInvestigationsJson(`/api/investigations/recent?limit=${limit}`, 'Failed to load recent investigations');
}

export async function getInvestigationActivity(limit = 30): Promise<InvestigationActivityItem[]> {
    return fetchInvestigationsJson(`/api/investigations/activity?limit=${limit}`, 'Failed to load investigation activity');
}

export async function getInvestigationStatistics(): Promise<InvestigationStatistics> {
    return fetchInvestigationsJson('/api/investigations/statistics', 'Failed to load investigation statistics');
}

// ─── INVESTIGATIONS_PHASE1.md — Case management foundation ──────────────
// A Case is the analyst-facing case layer (§1). Every field below maps
// 1:1 to a real stored column; no demo metrics (§28). Follows the same
// intelligenceJson<T> / { items, total, page, pageSize } + { data: { case } }
// envelope conventions the rest of the intelligence API uses.

export type CaseStatus = 'open' | 'investigating' | 'pending' | 'resolved' | 'closed' | 'archived';
export type CaseSeverity = 'Low' | 'Medium' | 'High' | 'Critical';
export type CasePriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type CaseNoteType = 'general' | 'observation' | 'hypothesis' | 'finding' | 'decision';
export type CaseFindingConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';

export interface CaseMeta {
    statuses: CaseStatus[];
    severities: CaseSeverity[];
    priorities: CasePriority[];
    types: string[];
    targetEntityTypes: string[];
    noteTypes: CaseNoteType[];
    findingConfidence: CaseFindingConfidence[];
}

export interface CaseDashboardStats {
    total: number;
    open: number; investigating: number; pending: number; resolved: number; closed: number; archived: number;
    bySeverity: Record<CaseSeverity, number>;
    recentlyUpdated: CaseListItem[];
    assignedToMe: number;
    // INVESTIGATIONS_PHASE3.md §48 CASE DASHBOARD additions.
    recentlyClosed: number; reopened: number; needsReview: number; newActivity: number;
}

export interface CaseListItem {
    id: number;
    case_number: string;
    title: string;
    summary: string | null;
    description: string | null;
    objectives: string | null;
    status: CaseStatus;
    severity: CaseSeverity;
    priority: CasePriority;
    type: string;
    assigned_to_user_id: number | null;
    assigned_to_username: string | null;
    created_by_user_id: number;
    created_by_username: string | null;
    closure_summary: string | null;
    closed_at: string | null;
    // INVESTIGATIONS_PHASE3.md §10-§13/§45 — Conclusion/Confidence/Impact
    // are DISTINCT from Risk/Severity/Priority (§12's own rule); Archive is
    // a real status transition (existing CaseStatus already had 'archived').
    conclusion: string | null;
    conclusion_confidence: CaseConclusionConfidence | null;
    impact: { categories: CaseImpactCategory[]; description: string | null } | null;
    archived_at: string | null;
    created_at: string;
    updated_at: string;
    target_count?: number;
    note_count?: number;
    finding_count?: number;
    evidence_count?: number;
    tags?: string[];
}

export interface CaseTarget {
    id: number;
    case_id: number;
    entity_type: string;
    entity_id: string;
    entity_label: string | null;
    added_by_username: string | null;
    created_at: string;
}

export interface CaseEvidenceItem {
    id: number;
    entity_type: string;
    entity_id: string;
    source: string;
    url: string | null;
    description: string | null;
    confidence: string | null;
    added_by_username: string | null;
    created_at: string;
    linked_at: string | null;
    link_note: string | null;
    source_entity_type: string;
    source_entity_id: string | null;
    // INVESTIGATIONS_PHASE2.md §9/§10 — classification + related finding.
    classification: CaseEvidenceClassification | null;
    related_finding_id: number | null;
}

export interface CaseNote {
    id: number;
    case_id: number;
    author_user_id: number;
    author_username: string | null;
    note_type: CaseNoteType;
    content: string;
    created_at: string;
    updated_at: string;
}

export interface CaseFinding {
    id: number;
    case_id: number;
    statement: string;
    title: string | null;
    confidence: CaseFindingConfidence;
    status: CaseFindingStatus;
    supporting_evidence_ids: number[];
    author_username: string | null;
    created_by_user_id: number;
    created_at: string;
    updated_at: string;
}

export interface CaseTimelineItem {
    id: number;
    action: string;
    previous_value: string | null;
    new_value: string | null;
    source: string;
    username: string | null;
    created_at: string;
}

export interface CaseDetail extends CaseListItem {
    targets: CaseTarget[];
    evidence: CaseEvidenceItem[];
    notes: CaseNote[];
    findings: CaseFinding[];
    tags: string[];
    // INVESTIGATIONS_PHASE2.md §12/§17 — hypotheses + tasks in the detail.
    hypotheses: CaseHypothesis[];
    tasks: CaseTask[];
}

export interface CaseRisk {
    /** §33 — highest-scoring target risk from the existing engine (no case risk engine). */
    risk: { score: number; level: string; reasons: string[]; entity_type?: string; entity_id?: string; entity_label?: string | null } | null;
    /** Per-target risks from the existing engine (§33 "Risk uses existing Risk engine"). */
    targets: { entity_type: string; entity_id: string; entity_label: string | null; score: number; level: string; reasons: string[] }[];
    history: { previous_value: string | null; new_value: string | null; created_at: string }[];
}

// ═════════════════════════════════════════════════════════════════════════
// INVESTIGATIONS_PHASE2.md — Investigation Intelligence, Correlation,
// Hypotheses, Tasks & Analyst Workspace
// ═════════════════════════════════════════════════════════════════════════

export type CaseHypothesisStatus = 'open' | 'testing' | 'supported' | 'contradicted' | 'rejected' | 'resolved';
export type CaseHypothesisConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type CaseHypothesisEvidenceRole = 'supporting' | 'contradicting' | 'contextual';
export type CaseTaskStatus = 'pending' | 'in_progress' | 'blocked' | 'completed' | 'cancelled';
export type CaseTaskPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type CaseFindingStatus = 'open' | 'under_review' | 'confirmed' | 'rejected' | 'resolved';
export type CaseEvidenceClassification = 'primary' | 'supporting' | 'contextual' | 'contradicting';

export interface CaseMeta2 {
    hypothesisStatuses: CaseHypothesisStatus[];
    hypothesisConfidence: CaseHypothesisConfidence[];
    hypothesisEvidenceRoles: CaseHypothesisEvidenceRole[];
    taskStatuses: CaseTaskStatus[];
    taskPriorities: CaseTaskPriority[];
    findingStatuses: CaseFindingStatus[];
    evidenceClassifications: CaseEvidenceClassification[];
}

export interface CaseHypothesisEvidence {
    id: number;
    role: CaseHypothesisEvidenceRole;
    note: string | null;
    entity_type: string;
    entity_id: string;
    source: string;
    url: string | null;
    description: string | null;
    confidence: string | null;
    added_at: string;
}

export interface CaseHypothesis {
    id: number;
    case_id: number;
    statement: string;
    status: CaseHypothesisStatus;
    confidence: CaseHypothesisConfidence;
    analyst_assessment: string | null;
    notes: string | null;
    author_username: string | null;
    created_by_user_id: number;
    created_at: string;
    updated_at: string;
    supporting_evidence: CaseHypothesisEvidence[];
    contradicting_evidence: CaseHypothesisEvidence[];
    contextual_evidence: CaseHypothesisEvidence[];
}

export interface CaseTask {
    id: number;
    case_id: number;
    title: string;
    description: string | null;
    status: CaseTaskStatus;
    priority: CaseTaskPriority;
    assigned_to_user_id: number | null;
    assigned_to_username: string | null;
    due_date: string | null;
    source_finding_id: number | null;
    source_ai_recommendation: boolean;
    created_by_username: string | null;
    created_by_user_id: number;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
}

// §4 Investigation Context — reuses the existing cross-module bundle shape.
export interface CaseContext {
    case: CaseDetail;
    crossModule: {
        primary: { type: string; id: string; label: string; meta: string | null };
        relatedEntities: { type: string; id: string; label: string; risk?: string | null; confidence?: string | null; meta?: unknown }[];
        relatedByType: Record<string, number>;
        indicators: { type: string; id: string; label: string; risk?: string | null }[];
        risk: { level: string; score: number; reasons: string[]; confidence: string } | null;
        evidence: unknown[];
        timeline: unknown[];
        alerts: { open: number; resolved: number; items: unknown[]; events: unknown[] };
        monitoring: { monitors: unknown[]; events: unknown[] };
        findings: unknown[];
        recommendations: unknown[];
        graphTruncated: boolean;
    } | null;
    snapshot: {
        target_count: number;
        finding_count: number;
        hypothesis_count: number;
        task_count: number;
        evidence_count: number;
        open_findings: number;
        open_hypotheses: number;
        open_tasks: number;
    };
}

// §6 Correlation workspace — per-target relationships from the existing graph.
export interface CaseCorrelation {
    targets: {
        target: CaseTarget;
        relationships: {
            id: number;
            direction: 'outgoing' | 'incoming';
            relationship_type: string;
            basis: string;
            confidence: string | null;
            source: string;
            detection_method: string | null;
            created_at: string | null;
            entity: { type: string; id: string; label: string; meta: unknown };
        }[];
    }[];
    caseRelationships: {
        id: number;
        direction: 'outgoing' | 'incoming';
        relationship_type: string;
        basis: string;
        confidence: string | null;
        source: string;
        entity: { type: string; id: string; label: string; meta: unknown };
    }[];
}

// §7 Relationship graph (reuses existing graph shape).
export interface CaseGraph {
    nodes: { type: string; id: string; label: string; risk?: string | null; confidence?: string | null; meta?: unknown }[];
    edges: { id: number; sourceType: string; sourceId: string; targetType: string; targetId: string; relationshipType: string; basis: string; confidence: string | null }[];
    truncated: boolean;
}

// §24 IOC workspace — reuses the existing IOC detail shape (subset).
export interface CaseIoc {
    id: number;
    type: string;
    value: string;
    risk: string;
    confidence: string;
    status: string;
    threat_category: string | null;
    first_seen_at: string | null;
    last_seen_at: string | null;
    source_count?: number;
    sources?: string[];
    relatedCampaigns?: { id: number; name: string; status: string; severity: string }[];
    relatedMonitors?: { id: number; type: string; status: string }[];
    relatedAlerts?: { id: number; severity: string; title: string; status: string; created_at: string | null }[];
}

// §36 Change analysis.
export interface CaseChangeItem {
    id: number;
    action: string;
    previous_value: string | null;
    new_value: string | null;
    source: string;
    username: string | null;
    created_at: string;
}

// §37 Case snapshot.
export interface CaseSnapshot {
    targets: CaseTarget[];
    highRiskEntities: { entity: CaseTarget; risk: { score: number; level: string; reasons: string[]; confidence: string } }[];
    openFindings: CaseFinding[];
    openHypotheses: CaseHypothesis[];
    openTasks: CaseTask[];
    criticalEvidence: CaseEvidenceItem[];
    recentAlerts: { id: number; title: string; severity: string; status: string; target: string; created_at: string | null }[];
    recentChanges: CaseChangeItem[];
}

// §38 Investigation summary.
export interface CaseSummary {
    currentAssessment: string | null;
    keyFindings: CaseFinding[];
    strongestEvidence: CaseEvidenceItem[];
    openHypotheses: CaseHypothesis[];
    openTasks: CaseTask[];
    risk: { score: number; level: string; reasons: string[]; confidence: string } | null;
    recentChanges: CaseChangeItem[];
    unknowns: { id: number; statement: string; reason: string }[];
}

// §41 Recommendations.
export interface CaseRecommendation {
    action: string;
    target: string;
    reason: string;
}

// §34/§35 Alert & monitoring workspace.
export interface CaseAlertItem {
    id: number;
    title: string;
    description: string | null;
    severity: string;
    status: string;
    source: string;
    target: string;
    created_at: string | null;
}

export interface CaseMonitorItem {
    id: number;
    type: string;
    target: string;
    label: string | null;
    status: string;
    last_checked_at: string | null;
    last_risk: string | null;
    created_at: string | null;
}

// §45 Case report.
export interface CaseReport {
    generated_at: string;
    generated_by_user_id: number;
    executive_summary: string | null;
    scope: {
        case_number: string;
        title: string;
        type: string;
        status: CaseStatus;
        severity: CaseSeverity;
        priority: CasePriority;
        targets: CaseTarget[];
        objectives: string | null;
    };
    findings: CaseFinding[];
    evidence: CaseEvidenceItem[];
    hypotheses: CaseHypothesis[];
    tasks: CaseTask[];
    timeline: CaseTimelineItem[];
    // INVESTIGATIONS_PHASE3.md §23 — Relationships/Monitoring sections.
    relationships: CaseCorrelation['targets'];
    monitoring: CaseMonitorItem[];
    risk: { score: number; level: string; reasons: string[]; confidence: string } | null;
    conclusion: string | null;
    conclusion_confidence: CaseConclusionConfidence | null;
    impact: { categories: CaseImpactCategory[]; description: string | null } | null;
    recommendations: CaseRecommendation[];
}

// §48 (Phase1)/§43 (Phase2) Knowledge context — reuses the existing
// Knowledge Base discovery item shape (RelatedKnowledgeEntry-adjacent),
// tagged with which case target surfaced it.
export interface CaseKnowledgeItem {
    id: number; title: string; slug: string; summary: string | null; category: string;
    confidence: string; status: string; tags: string[]; updated_at: string | null;
    matchReasons: { type: 'entity' | 'tag' | 'category'; detail: string }[];
    related_target: { entity_type: string; entity_id: string; entity_label: string | null };
}

// INVESTIGATIONS_PHASE2.md §27-§32 MODULE CONTEXT — one section per case
// target that has a dedicated module context, reusing the SAME crossModule
// bundle shape getCaseContext already returns (collectThreatBriefContext).
export interface CaseModuleContextSection {
    target: { entity_type: string; entity_id: string; entity_label: string | null };
    moduleLabel: string;
    context: NonNullable<CaseContext['crossModule']>;
}

async function casesJson<T>(path: string, fallbackMessage = 'Request failed', init?: RequestInit): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

function buildQuery(params: Record<string, string | number | undefined | null>): URLSearchParams {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') qs.set(k, String(v)); });
    return qs;
}

export async function getCaseMeta(): Promise<CaseMeta> {
    const body = await casesJson<{ data: CaseMeta }>('/api/investigations/cases/meta', 'Failed to load case metadata');
    return body.data;
}

export async function getCaseDashboard(): Promise<CaseDashboardStats> {
    const body = await casesJson<{ data: CaseDashboardStats }>('/api/investigations/cases/dashboard', 'Failed to load case dashboard');
    return body.data;
}

export async function getCases(params: {
    q?: string; status?: CaseStatus | 'all'; severity?: CaseSeverity | 'all'; priority?: CasePriority | 'all';
    type?: string; assignedTo?: string; tag?: string;
    dateFrom?: string; dateTo?: string; updatedFrom?: string; updatedTo?: string;
    sortBy?: string; sortDir?: 'asc' | 'desc'; page?: number; pageSize?: number;
} = {}): Promise<{ items: CaseListItem[]; total: number; page: number; pageSize: number }> {
    const qs = buildQuery(params);
    const body = await casesJson<{ items: CaseListItem[]; total: number; page: number; pageSize: number }>(`/api/investigations/cases?${qs.toString()}`, 'Failed to load cases');
    return body;
}

export async function getCase(id: number): Promise<CaseDetail> {
    const body = await casesJson<{ data: { case: CaseDetail } }>(`/api/investigations/cases/${id}`, 'Failed to load case');
    return body.data.case;
}

export async function createCase(payload: {
    title: string; summary?: string; description?: string; objectives?: string;
    severity?: CaseSeverity; priority?: CasePriority; type?: string; tags?: string[];
    // SHADOWSERVER_INTEGRATION_PLAN.md §5 rollout — optional; omitted means
    // this case isn't tied to a client organization.
    clientId?: number;
}): Promise<{ id: number; case_number: string }> {
    const body = await casesJson<{ data: { id: number; case_number: string } }>('/api/investigations/cases', 'Failed to create case',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}

export async function updateCase(id: number, fields: Partial<{
    title: string; summary: string | null; description: string | null; objectives: string | null;
    status: CaseStatus; severity: CaseSeverity; priority: CasePriority; closureSummary: string | null;
    // INVESTIGATIONS_PHASE3.md §10-§13.
    conclusion: string | null; conclusionConfidence: CaseConclusionConfidence | null;
    impact: { categories: CaseImpactCategory[]; description?: string } | null;
}>): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}`, 'Failed to update case',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
}

export async function assignCase(id: number, assignedToUserId: number | null): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/assign`, 'Failed to assign case',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ assignedToUserId }) });
}

export async function addCaseTarget(id: number, entityType: string, entityId: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/targets`, 'Failed to add target',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId }) });
}

export async function removeCaseTarget(id: number, entityType: string, entityId: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/targets/${entityType}/${entityId}`, 'Failed to remove target', { method: 'DELETE' });
}

export async function searchCaseEvidence(id: number, q: string, entityType?: string): Promise<CaseEvidenceItem[]> {
    const qs = buildQuery({ q, entityType });
    const body = await casesJson<{ data: { items: CaseEvidenceItem[] } }>(`/api/investigations/cases/${id}/evidence/search?${qs.toString()}`, 'Failed to search evidence');
    return body.data.items;
}

export async function attachCaseEvidence(id: number, evidenceId: number, note?: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/evidence`, 'Failed to add evidence',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ evidenceId, note }) });
}

export async function createCaseEvidence(id: number, payload: { source: string; url?: string; description?: string; confidence?: string }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/evidence/new`, 'Failed to create evidence',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}

export async function removeCaseEvidence(id: number, evidenceId: number): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/evidence/${evidenceId}`, 'Failed to remove evidence', { method: 'DELETE' });
}

export async function addCaseNote(id: number, content: string, noteType: CaseNoteType = 'general'): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/notes`, 'Failed to add note',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content, noteType }) });
    return body.data;
}

export async function updateCaseNote(id: number, noteId: number, content: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/notes/${noteId}`, 'Failed to update note',
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
}

export async function deleteCaseNote(id: number, noteId: number): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/notes/${noteId}`, 'Failed to delete note', { method: 'DELETE' });
}

export async function addCaseFinding(id: number, payload: { title?: string; statement: string; confidence?: CaseFindingConfidence; status?: CaseFindingStatus; supportingEvidenceIds?: number[] }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/findings`, 'Failed to add finding',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}

export async function deleteCaseFinding(id: number, findingId: number): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/findings/${findingId}`, 'Failed to delete finding', { method: 'DELETE' });
}

export async function addCaseTag(id: number, tag: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/tags`, 'Failed to add tag',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag }) });
}

export async function removeCaseTag(id: number, tag: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/tags/${encodeURIComponent(tag)}`, 'Failed to remove tag', { method: 'DELETE' });
}

export async function getCaseTimeline(id: number, order: 'asc' | 'desc' = 'desc'): Promise<CaseTimelineItem[]> {
    const body = await casesJson<{ data: { items: CaseTimelineItem[] } }>(`/api/investigations/cases/${id}/timeline?order=${order}`, 'Failed to load timeline');
    return body.data.items;
}

export async function getCaseActivity(id: number): Promise<CaseTimelineItem[]> {
    const body = await casesJson<{ data: { items: CaseTimelineItem[] } }>(`/api/investigations/cases/${id}/activity`, 'Failed to load activity');
    return body.data.items;
}

export async function closeCase(id: number, closureSummary?: string, conclusion?: string, conclusionConfidence?: CaseConclusionConfidence): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/close`, 'Failed to close case',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ closureSummary, conclusion, conclusionConfidence }) });
}

export async function reopenCase(id: number, reason?: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/reopen`, 'Failed to reopen case',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}

export async function monitorCaseTarget(id: number, entityType: string, entityId: string): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/targets/${entityType}/${entityId}/monitor`, 'Failed to monitor target', { method: 'POST' });
}

export async function getCaseRisk(id: number): Promise<CaseRisk> {
    const body = await casesJson<{ data: CaseRisk }>(`/api/investigations/cases/${id}/risk`, 'Failed to load risk');
    return body.data;
}

export async function exportCase(id: number): Promise<unknown> {
    const body = await casesJson<unknown>(`/api/investigations/cases/${id}/export`, 'Failed to export case');
    return body;
}

export async function findCaseForAlert(alertId: number | string): Promise<{ id: number } | null> {
    const body = await casesJson<{ data: { id: number } | null }>(`/api/investigations/cases/for-alert/${alertId}`, 'Failed to find case for alert');
    return body.data;
}

// ─── INVESTIGATIONS_PHASE2.md — Investigation Intelligence, Correlation,
// Hypotheses, Tasks & Analyst Workspace ──────────────────────────────────

export async function getCaseMeta2(): Promise<CaseMeta2> {
    const body = await casesJson<{ data: CaseMeta2 }>(`/api/investigations/cases/meta2`, 'Failed to load case metadata');
    return body.data;
}

// §4 Investigation Context
export async function getCaseContext(id: number): Promise<CaseContext> {
    const body = await casesJson<{ data: CaseContext }>(`/api/investigations/cases/${id}/context`, 'Failed to load case context');
    return body.data;
}

// §5/§6 Cross-Module Correlation
export async function getCaseCorrelation(id: number, limit?: number): Promise<CaseCorrelation> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: CaseCorrelation }>(`/api/investigations/cases/${id}/correlation?${qs.toString()}`, 'Failed to load correlation');
    return body.data;
}

// §7 Relationship Graph
export async function getCaseGraph(id: number, depth?: number): Promise<CaseGraph> {
    const qs = buildQuery({ depth });
    const body = await casesJson<{ data: CaseGraph }>(`/api/investigations/cases/${id}/graph?${qs.toString()}`, 'Failed to load graph');
    return body.data;
}

// §24 IOC Workspace
export async function getCaseIocs(id: number, limit?: number): Promise<CaseIoc[]> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: { items: CaseIoc[] } }>(`/api/investigations/cases/${id}/iocs?${qs.toString()}`, 'Failed to load case IOCs');
    return body.data.items;
}

// §36 Change Analysis
export async function getCaseChanges(id: number, limit?: number): Promise<CaseChangeItem[]> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: { items: CaseChangeItem[] } }>(`/api/investigations/cases/${id}/changes?${qs.toString()}`, 'Failed to load changes');
    return body.data.items;
}

// §37 Case Snapshot
export async function getCaseSnapshot(id: number): Promise<CaseSnapshot> {
    const body = await casesJson<{ data: CaseSnapshot }>(`/api/investigations/cases/${id}/snapshot`, 'Failed to load snapshot');
    return body.data;
}

// §38 Investigation Summary
export async function getCaseSummary(id: number): Promise<CaseSummary> {
    const body = await casesJson<{ data: CaseSummary }>(`/api/investigations/cases/${id}/summary`, 'Failed to load summary');
    return body.data;
}

// §41 Recommendations
export async function getCaseRecommendations(id: number): Promise<CaseRecommendation[]> {
    const body = await casesJson<{ data: { items: CaseRecommendation[] } }>(`/api/investigations/cases/${id}/recommendations`, 'Failed to load recommendations');
    return body.data.items;
}

// §45 Case Report
export async function generateCaseReport(id: number): Promise<CaseReport> {
    const body = await casesJson<{ data: CaseReport }>(`/api/investigations/cases/${id}/report`, 'Failed to generate case report');
    return body.data;
}

// ─── §12-§16 Hypotheses ──────────────────────────────────────────────────

export async function getCaseHypotheses(id: number): Promise<CaseHypothesis[]> {
    const body = await casesJson<{ data: { items: CaseHypothesis[] } }>(`/api/investigations/cases/${id}/hypotheses`, 'Failed to load hypotheses');
    return body.data.items;
}

export async function addCaseHypothesis(id: number, data: { statement: string; status?: CaseHypothesisStatus; confidence?: CaseHypothesisConfidence; notes?: string }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/hypotheses`, 'Failed to create hypothesis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

export async function updateCaseHypothesis(id: number, hypothesisId: number, data: { statement?: string; status?: CaseHypothesisStatus; confidence?: CaseHypothesisConfidence; analystAssessment?: string | null; notes?: string | null }): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/hypotheses/${hypothesisId}`, 'Failed to update hypothesis', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

export async function deleteCaseHypothesis(id: number, hypothesisId: number): Promise<{ deleted: boolean }> {
    const body = await casesJson<{ data: { deleted: boolean } }>(`/api/investigations/cases/${id}/hypotheses/${hypothesisId}`, 'Failed to delete hypothesis', { method: 'DELETE' });
    return body.data;
}

export async function addHypothesisEvidence(id: number, hypothesisId: number, data: { evidenceId: number; role?: CaseHypothesisEvidenceRole; note?: string }): Promise<{ added: boolean }> {
    const body = await casesJson<{ data: { added: boolean } }>(`/api/investigations/cases/${id}/hypotheses/${hypothesisId}/evidence`, 'Failed to add hypothesis evidence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

export async function removeHypothesisEvidence(id: number, hypothesisId: number, evidenceId: number): Promise<{ removed: boolean }> {
    const body = await casesJson<{ data: { removed: boolean } }>(`/api/investigations/cases/${id}/hypotheses/${hypothesisId}/evidence/${evidenceId}`, 'Failed to remove hypothesis evidence', { method: 'DELETE' });
    return body.data;
}

// ─── §17-§22 Tasks ──────────────────────────────────────────────────────

export async function getCaseTasks(id: number): Promise<CaseTask[]> {
    const body = await casesJson<{ data: { items: CaseTask[] } }>(`/api/investigations/cases/${id}/tasks`, 'Failed to load tasks');
    return body.data.items;
}

export async function addCaseTask(id: number, data: { title: string; description?: string; status?: CaseTaskStatus; priority?: CaseTaskPriority; assignedToUserId?: number | null; dueDate?: string | null; sourceFindingId?: number | null; sourceAiRecommendation?: boolean }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/tasks`, 'Failed to create task', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

export async function updateCaseTask(id: number, taskId: number, data: { title?: string; description?: string; status?: CaseTaskStatus; priority?: CaseTaskPriority; assignedToUserId?: number | null; dueDate?: string | null }): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/tasks/${taskId}`, 'Failed to update task', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

export async function deleteCaseTask(id: number, taskId: number): Promise<{ deleted: boolean }> {
    const body = await casesJson<{ data: { deleted: boolean } }>(`/api/investigations/cases/${id}/tasks/${taskId}`, 'Failed to delete task', { method: 'DELETE' });
    return body.data;
}

// ─── §9/§10 Evidence Classification ──────────────────────────────────────

export async function classifyCaseEvidence(id: number, evidenceId: number, data: { classification?: CaseEvidenceClassification; relatedFindingId?: number | null }): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/evidence/${evidenceId}/classification`, 'Failed to classify evidence', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

// §39 Finding update (status lifecycle incl. analyst-controlled Confirmed)
export async function updateCaseFinding(id: number, findingId: number, data: { title?: string; statement?: string; confidence?: CaseFindingConfidence; status?: CaseFindingStatus }): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/findings/${findingId}`, 'Failed to update finding', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

// ─── §34/§35 Alert & Monitoring workspace ────────────────────────────────

export async function getCaseAlerts(id: number, limit?: number): Promise<CaseAlertItem[]> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: { items: CaseAlertItem[] } }>(`/api/investigations/cases/${id}/alerts?${qs.toString()}`, 'Failed to load case alerts');
    return body.data.items;
}

export async function getCaseMonitoring(id: number, limit?: number): Promise<CaseMonitorItem[]> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: { items: CaseMonitorItem[] } }>(`/api/investigations/cases/${id}/monitoring?${qs.toString()}`, 'Failed to load case monitoring');
    return body.data.items;
}

// §48 (Phase1)/§43 (Phase2) "Related Knowledge".
export async function getCaseKnowledge(id: number, limit?: number): Promise<CaseKnowledgeItem[]> {
    const qs = buildQuery({ limit });
    const body = await casesJson<{ data: { items: CaseKnowledgeItem[] } }>(`/api/investigations/cases/${id}/knowledge?${qs.toString()}`, 'Failed to load related knowledge');
    return body.data.items;
}

// INVESTIGATIONS_PHASE2.md §27-§32 MODULE CONTEXT.
export async function getCaseModuleContext(id: number): Promise<CaseModuleContextSection[]> {
    const body = await casesJson<{ data: { sections: CaseModuleContextSection[] } }>(`/api/investigations/cases/${id}/module-context`, 'Failed to load module context');
    return body.data.sections;
}

// ═════════════════════════════════════════════════════════════════════════
// INVESTIGATIONS_PHASE3.md — Investigation Operations, Analyst Assessment,
// Case Closure, Reporting & Lessons Learned
// ═════════════════════════════════════════════════════════════════════════

export type CaseConclusionConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export type CaseImpactCategory = 'Operational' | 'Financial' | 'Reputational' | 'Security' | 'Data Exposure' | 'User Impact';
export type CaseLessonCategory = 'what_worked' | 'what_failed' | 'detection_gap' | 'process_gap' | 'data_gap' | 'improvement';
export type CaseRecommendationStatus = 'open' | 'completed' | 'dismissed';
export type CaseRecommendationSource = 'analyst' | 'ai' | 'rule';
export type CaseReviewStatus = 'ready_for_review' | 'under_review' | 'approved' | 'returned';
export type CaseReviewCommentType = 'comment' | 'requested_change' | 'approval_note';

// §4 Investigation Assessment.
export interface CaseAssessment {
    id: number; case_id: number;
    executive_assessment: string | null; key_findings: string | null; evidence_summary: string | null;
    threat_assessment: string | null; impact: string | null; confidence: CaseConclusionConfidence;
    unresolved_questions: string | null; recommendations: string | null;
    created_by_user_id: number; updated_by_user_id: number | null;
    created_at: string; updated_at: string;
}
export async function getCaseAssessment(id: number): Promise<CaseAssessment | null> {
    const body = await casesJson<{ data: CaseAssessment | null }>(`/api/investigations/cases/${id}/assessment`, 'Failed to load assessment');
    return body.data;
}
export async function saveCaseAssessment(id: number, fields: Partial<{
    executiveAssessment: string; keyFindings: string; evidenceSummary: string; threatAssessment: string;
    impact: string; confidence: CaseConclusionConfidence; unresolvedQuestions: string; recommendations: string;
}>): Promise<{ saved: boolean }> {
    const body = await casesJson<{ data: { saved: boolean } }>(`/api/investigations/cases/${id}/assessment`, 'Failed to save assessment', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields),
    });
    return body.data;
}

// §7-§9 Evidence review / completeness / conflicts.
export interface CaseEvidenceReview { total: number; primary: number; supporting: number; contextual: number; contradicting: number; unreviewed: number; restricted: number; }
export interface CaseEvidenceCompleteness { state: 'Complete' | 'Mostly Complete' | 'Partial' | 'Insufficient'; reasons: string[]; }
export interface CaseEvidenceConflict { subject: string; target?: { entity_type: string; entity_id: string; entity_label: string | null }; claims: { value: string; sources: string[] }[]; }
export async function getCaseEvidenceReview(id: number): Promise<CaseEvidenceReview> {
    const body = await casesJson<{ data: CaseEvidenceReview }>(`/api/investigations/cases/${id}/evidence-review`, 'Failed to load evidence review');
    return body.data;
}
export async function getCaseEvidenceCompleteness(id: number): Promise<CaseEvidenceCompleteness> {
    const body = await casesJson<{ data: CaseEvidenceCompleteness }>(`/api/investigations/cases/${id}/evidence-completeness`, 'Failed to load evidence completeness');
    return body.data;
}
export async function getCaseEvidenceConflicts(id: number): Promise<CaseEvidenceConflict[]> {
    const body = await casesJson<{ data: { conflicts: CaseEvidenceConflict[] } }>(`/api/investigations/cases/${id}/evidence-conflicts`, 'Failed to load evidence conflicts');
    return body.data.conflicts;
}

// §16-§18 Closure checklist.
export interface CaseClosureChecklist {
    caseSummaryExists: boolean; targetsExist: boolean; findingsReviewed: boolean; hypothesesReviewed: boolean;
    evidenceReviewed: boolean; conclusionExists: boolean; recommendationsDocumented: boolean; closureSummaryExists: boolean;
    outstandingIssues: { openFindings: number; openHypotheses: number };
}
export async function getCaseClosureChecklist(id: number): Promise<CaseClosureChecklist> {
    const body = await casesJson<{ data: CaseClosureChecklist }>(`/api/investigations/cases/${id}/closure-checklist`, 'Failed to load closure checklist');
    return body.data;
}

// §45 Archive.
export async function archiveCase(id: number): Promise<{ archived: boolean }> {
    const body = await casesJson<{ data: { archived: boolean } }>(`/api/investigations/cases/${id}/archive`, 'Failed to archive case', { method: 'POST' });
    return body.data;
}

// §21/§43/§44 Post closure activity / new intelligence.
export interface CasePostClosureActivity { applicable: boolean; monitoredTargets: CaseMonitorItem[]; openAlerts: CaseAlertItem[]; pendingTasks: { id: number; title: string; status: string; priority: string; due_date: string | null }[]; }
export interface CasePostClosureIntelligence { hasNewIntelligence: boolean; closedAt: string | null; newIocs: number; newRelationships: number; newAlerts: number; newMonitoringEvents: number; recommendation: string | null; }
export async function getCasePostClosureActivity(id: number): Promise<CasePostClosureActivity> {
    const body = await casesJson<{ data: CasePostClosureActivity }>(`/api/investigations/cases/${id}/post-closure-activity`, 'Failed to load post closure activity');
    return body.data;
}
export async function getCasePostClosureIntelligence(id: number): Promise<CasePostClosureIntelligence> {
    const body = await casesJson<{ data: CasePostClosureIntelligence }>(`/api/investigations/cases/${id}/post-closure-intelligence`, 'Failed to load post closure intelligence');
    return body.data;
}

// §14 Recommendations (persisted, analyst controlled).
export interface CaseRecommendationRecord { id: number; case_id: number; action: string; reason: string | null; source: CaseRecommendationSource; status: CaseRecommendationStatus; created_by_username: string | null; created_at: string; updated_at: string; }
export async function getCaseRecommendationRecords(id: number): Promise<CaseRecommendationRecord[]> {
    const body = await casesJson<{ data: { items: CaseRecommendationRecord[] } }>(`/api/investigations/cases/${id}/recommendation-records`, 'Failed to load recommendations');
    return body.data.items;
}
export async function addCaseRecommendationRecord(id: number, data: { action: string; reason?: string; source?: CaseRecommendationSource }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/recommendation-records`, 'Failed to add recommendation', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}
export async function updateCaseRecommendationRecord(id: number, recId: number, status: CaseRecommendationStatus): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/recommendation-records/${recId}`, 'Failed to update recommendation', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    return body.data;
}

// §29/§30 Lessons Learned.
export interface CaseLesson { id: number; case_id: number; category: CaseLessonCategory; content: string; created_by_username: string | null; created_at: string; }
export async function getCaseLessons(id: number): Promise<CaseLesson[]> {
    const body = await casesJson<{ data: { items: CaseLesson[] } }>(`/api/investigations/cases/${id}/lessons`, 'Failed to load lessons');
    return body.data.items;
}
export async function addCaseLesson(id: number, data: { category: CaseLessonCategory; content: string }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/lessons`, 'Failed to add lesson', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}
export async function deleteCaseLesson(id: number, lessonId: number): Promise<{ deleted: boolean }> {
    const body = await casesJson<{ data: { deleted: boolean } }>(`/api/investigations/cases/${id}/lessons/${lessonId}`, 'Failed to delete lesson', { method: 'DELETE' });
    return body.data;
}

// §35-§37 Peer Review.
export interface CaseReviewComment { id: number; comment_type: CaseReviewCommentType; content: string; author_username: string | null; created_at: string; }
export interface CaseReview { id: number; case_id: number; status: CaseReviewStatus; submitted_by_user_id: number; submitted_by_username: string | null; reviewer_user_id: number | null; reviewer_username: string | null; created_at: string; updated_at: string; comments: CaseReviewComment[]; }
export async function getCaseReview(id: number): Promise<CaseReview | null> {
    const body = await casesJson<{ data: CaseReview | null }>(`/api/investigations/cases/${id}/review`, 'Failed to load review');
    return body.data;
}
export async function submitCaseForReview(id: number): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/review`, 'Failed to submit for review', { method: 'POST' });
    return body.data;
}
export async function updateCaseReviewStatus(id: number, reviewId: number, status: CaseReviewStatus): Promise<{ updated: boolean }> {
    const body = await casesJson<{ data: { updated: boolean } }>(`/api/investigations/cases/${id}/review/${reviewId}`, 'Failed to update review', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    });
    return body.data;
}
export async function addCaseReviewComment(id: number, reviewId: number, data: { commentType: CaseReviewCommentType; content: string }): Promise<{ id: number }> {
    const body = await casesJson<{ data: { id: number } }>(`/api/investigations/cases/${id}/review/${reviewId}/comments`, 'Failed to add comment', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    });
    return body.data;
}

// §23-§26 Report versioning.
export interface CaseReportVersionSummary { id: number; version_number: number; conclusion_snapshot: string | null; generated_by_username: string | null; created_at: string; }
export async function getCaseReportVersions(id: number): Promise<CaseReportVersionSummary[]> {
    const body = await casesJson<{ data: { items: CaseReportVersionSummary[] } }>(`/api/investigations/cases/${id}/report/versions`, 'Failed to load report versions');
    return body.data.items;
}
export async function getCaseReportVersion(id: number, versionId: number): Promise<CaseReport & { version_number: number }> {
    const body = await casesJson<{ data: CaseReport & { version_number: number } }>(`/api/investigations/cases/${id}/report/versions/${versionId}`, 'Failed to load report version');
    return body.data;
}
export async function createCaseReportVersion(id: number): Promise<{ id: number; version_number: number; created: boolean }> {
    const body = await casesJson<{ data: { id: number; version_number: number; created: boolean } }>(`/api/investigations/cases/${id}/report/versions`, 'Failed to create report version', { method: 'POST' });
    return body.data;
}

// §34 Investigation Quality.
export interface CaseQualityCheck { key: string; label: string; pass: boolean; }
export interface CaseQuality { checks: CaseQualityCheck[]; missing: string[]; passedCount: number; totalCount: number; }
export async function getCaseQuality(id: number): Promise<CaseQuality> {
    const body = await casesJson<{ data: CaseQuality }>(`/api/investigations/cases/${id}/quality`, 'Failed to load investigation quality');
    return body.data;
}

// §31 Case Metrics.
export interface CaseMetrics { timeToFirstActionMs: number | null; timeToResolutionMs: number | null; investigationDurationMs: number | null; evidenceCount: number; findingsCount: number; hypothesesCount: number; taskCount: number; alertsCount: number; reopenCount: number; }
export async function getCaseMetrics(id: number): Promise<CaseMetrics> {
    const body = await casesJson<{ data: CaseMetrics }>(`/api/investigations/cases/${id}/metrics`, 'Failed to load case metrics');
    return body.data;
}

// §32 Analyst Workload (own, not case-scoped).
export interface AnalystWorkload { assignedCases: number; openTasks: number; overdueTasks: number; highPriorityCases: number; }
export async function getAnalystWorkload(): Promise<AnalystWorkload> {
    const body = await casesJson<{ data: AnalystWorkload }>('/api/investigations/workload', 'Failed to load workload');
    return body.data;
}

// §40/§41 AI closure/lessons assistance (drafts only).
export async function draftCaseClosureSummary(id: number): Promise<{ draft: string; isDraft: true }> {
    const body = await casesJson<{ data: { draft: string; isDraft: true } }>(`/api/investigations/cases/${id}/ai/closure-summary`, 'Failed to draft closure summary');
    return body.data;
}
export async function draftCaseLessonsLearned(id: number): Promise<{ candidates: { category: CaseLessonCategory; content: string }[]; isDraft: true }> {
    const body = await casesJson<{ data: { candidates: { category: CaseLessonCategory; content: string }[]; isDraft: true } }>(`/api/investigations/cases/${id}/ai/lessons-learned`, 'Failed to draft lessons learned');
    return body.data;
}

// ═════════════════════════════════════════════════════════════════════════
// TIMELINE_PHASE1.md — Unified Temporal Intelligence Foundation
// ═════════════════════════════════════════════════════════════════════════

export interface TimelineEvent {
    id: string;
    timestamp: string;
    event_type: string;
    title: string;
    description: string | null;
    source_module: string;
    entity_type: string;
    entity_id: string;
    entity_label: string | null;
    severity: string | null;
    confidence: string | null;
    actor: string | null;
    reference: Record<string, unknown>;
    provenance: { source_module: string; original_entity_type: string; original_event_id: number };
}

export interface TimelinePage_ { items: TimelineEvent[]; total: number; page: number; pageSize: number; }

export interface TimelineMeta { modules: string[]; severities: string[]; confidences: string[]; }
export interface TimelineStats { eventsToday: number; highSeverityEvents: number; criticalEvents: number; modulesActive: number; }

async function timelineJson<T>(path: string, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getTimelineEvents(params: {
    from?: string; to?: string; module?: string; eventType?: string;
    entityType?: string; entityId?: string; severity?: string; confidence?: string;
    search?: string; page?: number; pageSize?: number; order?: 'asc' | 'desc';
}): Promise<TimelinePage_> {
    const qs = buildQuery({
        from: params.from, to: params.to, module: params.module, eventType: params.eventType,
        entityType: params.entityType, entityId: params.entityId, severity: params.severity,
        confidence: params.confidence, search: params.search, page: params.page, pageSize: params.pageSize, order: params.order,
    });
    return timelineJson<TimelinePage_>(`/api/timeline?${qs.toString()}`, 'Timeline unavailable.');
}

export async function getTimelineMeta(): Promise<TimelineMeta> {
    const body = await timelineJson<{ data: TimelineMeta }>('/api/timeline/meta', 'Failed to load timeline metadata');
    return body.data;
}

export async function getTimelineStats(): Promise<TimelineStats> {
    const body = await timelineJson<{ data: TimelineStats }>('/api/timeline/stats', 'Failed to load timeline statistics');
    return body.data;
}

// ═════════════════════════════════════════════════════════════════════════
// TIMELINE_PHASE2.md — Correlation, Entity Context & Cross Module Activity
// ═════════════════════════════════════════════════════════════════════════

export interface TimelineEntityRef { type: string; id: string; label: string; meta?: Record<string, unknown> }

export interface EntityCentricTimeline {
    entity: TimelineEntityRef;
    currentRisk: string | null;
    timeline: TimelinePage_;
    majorChanges: TimelineEvent[];
    relatedEntities: TimelineEntityRef[];
}

export async function getEntityTimeline(entityType: string, entityId: string | number, params: {
    from?: string; to?: string; eventType?: string; page?: number; pageSize?: number; order?: 'asc' | 'desc'; related?: boolean;
} = {}): Promise<EntityCentricTimeline> {
    const qs = buildQuery({
        from: params.from, to: params.to, eventType: params.eventType,
        page: params.page, pageSize: params.pageSize, order: params.order,
        related: params.related ? 'true' : undefined,
    });
    const body = await timelineJson<{ data: EntityCentricTimeline }>(`/api/timeline/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface InvestigationTimeline {
    case: { id: number; case_number: string; title: string; status: string };
    timeline: TimelinePage_;
    targetCount: number;
}

export async function getInvestigationTimeline(caseId: number, params: { from?: string; to?: string; page?: number; pageSize?: number; order?: 'asc' | 'desc' } = {}): Promise<InvestigationTimeline> {
    const qs = buildQuery({ from: params.from, to: params.to, page: params.page, pageSize: params.pageSize, order: params.order });
    const body = await timelineJson<{ data: InvestigationTimeline }>(`/api/timeline/investigations/${caseId}?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface CorrelatedEvent extends TimelineEvent {
    correlation: { confidence: 'High' | 'Medium' | 'Low' | 'Unknown'; label: string | null; relationship: string | null; reasons: string[] };
}
export interface CorrelationGroup { key: string; label: string; confidence: string; reasons: string[]; eventCount: number; eventIds: string[] }
export interface CorrelatedActivity {
    window: { from: string; to: string; windowMinutes: number };
    anchor: TimelineEvent | null;
    totalEvents: number;
    correlatedEvents: number;
    events: CorrelatedEvent[];
    groups: CorrelationGroup[];
    sharedContext: { iocs: TimelineEntityRef[]; campaigns: TimelineEntityRef[] };
    modules: string[];
    sourceDiversity: { moduleCount: number; eventTypeCount: number };
}

export async function getCorrelatedActivity(params: { anchorEventId?: string; from?: string; to?: string; window?: string }): Promise<CorrelatedActivity> {
    const qs = buildQuery({ anchorEventId: params.anchorEventId, from: params.from, to: params.to, window: params.window });
    const body = await timelineJson<{ data: CorrelatedActivity }>(`/api/timeline/correlated?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface EventContext {
    event: TimelineEvent;
    before: TimelineEvent[];
    after: TimelineEvent[];
    impact: { before: string | null; after: string | null; action: string; at?: string } | null;
    correlation: { relatedEvents: CorrelatedEvent[]; groups: CorrelationGroup[]; sharedContext: CorrelatedActivity['sharedContext']; activityWindow: CorrelatedActivity['window'] };
    evidence: { id: number; source: string; url: string | null; description: string | null; confidence: string | null; created_at: string | null }[];
}

export async function getEventContext(eventId: string, params: { limit?: number; window?: string } = {}): Promise<EventContext> {
    const qs = buildQuery({ limit: params.limit, window: params.window });
    const body = await timelineJson<{ data: EventContext }>(`/api/timeline/event/${encodeURIComponent(eventId)}/context?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface EntityActivitySummary {
    totalEvents: number;
    byActionType: Record<string, number>;
    alerts: number;
    riskChanges: number;
    recentActivity: TimelineEvent[];
    // Case-only named fields (real, only present when backed by an actual action).
    newFindings?: number; newEvidence?: number; newTargets?: number; newTasks?: number;
    openHypotheses?: number; closedTasks?: number;
}

export async function getEntityActivitySummary(entityType: string, entityId: string | number, days?: number): Promise<EntityActivitySummary> {
    const qs = buildQuery({ days });
    const body = await timelineJson<{ data: EntityActivitySummary }>(`/api/timeline/summary/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface TimelineBookmark { id: number; eventId: string; reason: string | null; eventTimestamp: string | null; createdAt: string | null; entity: TimelineEntityRef }

export async function listTimelineBookmarks(page = 1, pageSize = 25): Promise<{ items: TimelineBookmark[]; total: number; page: number; pageSize: number }> {
    const qs = buildQuery({ page, pageSize });
    return timelineJson(`/api/timeline/bookmarks?${qs.toString()}`, 'Failed to load bookmarks.');
}

export async function addTimelineBookmark(eventId: string, reason?: string): Promise<{ id: number; eventId: string }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/bookmarks`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ eventId, reason }) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to add bookmark.');
    return (body as any).data;
}

export async function removeTimelineBookmark(id: number): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/bookmarks/${id}`, { method: 'DELETE' });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error((body as any)?.message || 'Failed to remove bookmark.'); }
}

export async function addTimelineNote(entityType: string, entityId: string | number, note: string): Promise<void> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId, note }) });
    if (!res.ok) { const body = await res.json().catch(() => ({})); throw new Error((body as any)?.message || 'Failed to add note.'); }
}

// ═════════════════════════════════════════════════════════════════════════
// TIMELINE_PHASE3.md — Advanced Temporal Intelligence, Activity Patterns,
// Evolution & AI Analysis
// ═════════════════════════════════════════════════════════════════════════

export interface ActivityBurst {
    type: string; label: string | null; entity?: TimelineEntityRef; module?: string; eventType?: string;
    status: 'burst'; current: number; baseline: number | null; ratio: number | null;
    windowMinutes: number; window: { from: string; to: string }; baselineWindow: { from: string; to: string };
    activityConfidence: 'High' | 'Medium' | 'Low'; threatSignificance: 'Unknown';
}
export interface ActivityBurstsResult { window: { from: string; to: string; windowMinutes: number }; bursts: ActivityBurst[] }

export async function getActivityBursts(params: { window?: string; baselineWindows?: number } = {}): Promise<ActivityBurstsResult> {
    const qs = buildQuery({ window: params.window, baselineWindows: params.baselineWindows });
    const body = await timelineJson<{ data: ActivityBurstsResult }>(`/api/timeline/bursts?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface ActivityAnomaly { status: 'burst' | 'normal' | 'insufficient_data'; label: string; current: number; baseline: number | null; ratio: number | null }
export async function getActivityAnomaly(scope: { entityType?: string; entityId?: string | number; module?: string; eventType?: string }, params: { window?: string; baselineWindows?: number } = {}): Promise<ActivityAnomaly> {
    const qs = buildQuery({ ...scope, window: params.window, baselineWindows: params.baselineWindows });
    const body = await timelineJson<{ data: ActivityAnomaly }>(`/api/timeline/anomaly?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

// Named *ForTimeline* — an EXISTING getCampaignEvolution/CampaignEvolution
// already exists below (THREAT_INTELLIGENCE_MODULE's own campaign evolution
// engine, calling /api/intelligence/campaigns/:id/evolution). This Timeline
// one wraps and enriches that SAME backend engine with the unified Timeline
// stream — see database/timelineAnalytics.js's getCampaignEvolutionForTimeline.
export interface CampaignEvolutionForTimeline {
    campaignId: number; campaignName: string; sinceDays: number;
    current: { domains: number; ips: number; otherIocs: number; techniques: number };
    previous: { domains: number; ips: number; otherIocs: number; techniques: number };
    change: Record<string, number>;
    malware: null; vulnerabilities: null;
    risk: { current: { level: string; score: number; reasons: string[] } | null; history: { summary: string; changedAt: string | null }[] };
    timeline: { id: number; eventType: string; summary: string; occurredAt: string | null }[];
    activityTrend: { date: string; count: number }[];
    phase: { label: string; weeklyEventCounts: number[] } | null;
    unifiedTimeline: EntityCentricTimeline;
}
export async function getCampaignEvolutionForTimeline(campaignId: number | string, days?: number): Promise<CampaignEvolutionForTimeline> {
    const qs = buildQuery({ days });
    const body = await timelineJson<{ data: CampaignEvolutionForTimeline }>(`/api/timeline/campaigns/${campaignId}/evolution?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface AptActivityTrends {
    actor: TimelineEntityRef; days: number; totalEvents: number;
    counts: { campaignEvents: number; iocEvents: number; malwareEvents: number; ttpChanges: number; other: number };
    recentActivity: TimelineEvent[]; relatedEntityCount: number;
    riskEvolution: { current: { level: string; score: number; reasons: string[] } | null; history: { summary: string; changedAt: string | null }[] } | null;
}
export async function getAptActivityTrends(actorId: number | string, days?: number): Promise<AptActivityTrends> {
    const qs = buildQuery({ days });
    const body = await timelineJson<{ data: AptActivityTrends }>(`/api/timeline/apt/${actorId}/trends?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}
export async function compareAptActivity(actorIdA: number | string, actorIdB: number | string, days?: number): Promise<{ label: string; a: AptActivityTrends; b: AptActivityTrends }> {
    const qs = buildQuery({ a: actorIdA, b: actorIdB, days });
    const body = await timelineJson<{ data: { label: string; a: AptActivityTrends; b: AptActivityTrends } }>(`/api/timeline/apt/compare?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export async function getMalwareBehaviorEvolution(sampleId: number | string): Promise<{ history: unknown; timeline: EntityCentricTimeline }> {
    const body = await timelineJson<{ data: { history: unknown; timeline: EntityCentricTimeline } }>(`/api/timeline/malware/${sampleId}/evolution`, 'Timeline unavailable.');
    return body.data;
}
export async function compareMalwareTimeline(sampleIdA: number | string, sampleIdB: number | string): Promise<unknown> {
    const qs = buildQuery({ a: sampleIdA, b: sampleIdB });
    const body = await timelineJson<{ data: unknown }>(`/api/timeline/malware/compare?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface TemporalComparisonPeriod {
    from: string; to: string; events: number; highSeverity: number; critical: number;
    campaignActivity: number | null; aptActivity: number | null; malwareActivity: number | null; brandActivity: number | null; monitoringActivity: number | null;
}
export interface TemporalComparison { currentPeriod: TemporalComparisonPeriod; previousPeriod: TemporalComparisonPeriod; change: Record<string, number | null>; changePct: Record<string, number | null> }
export async function getTemporalComparison(params: { days?: number; currentFrom?: string; currentTo?: string; entityType?: string; entityId?: string | number } = {}): Promise<TemporalComparison> {
    const qs = buildQuery(params);
    const body = await timelineJson<{ data: TemporalComparison }>(`/api/timeline/comparison?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface ModuleTrend { module: string; count: number }
export interface EventTypeTrend { eventType: string; count: number }
export interface HeatmapCell { date: string; hour: number; count: number }
export async function getModuleActivityTrends(days?: number): Promise<{ days: number; modules: ModuleTrend[] }> {
    const qs = buildQuery({ type: 'module', days });
    const body = await timelineJson<{ data: { days: number; modules: ModuleTrend[] } }>(`/api/timeline/trends?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}
export async function getEventTypeTrends(days?: number): Promise<{ days: number; eventTypes: EventTypeTrend[] }> {
    const qs = buildQuery({ type: 'eventType', days });
    const body = await timelineJson<{ data: { days: number; eventTypes: EventTypeTrend[] } }>(`/api/timeline/trends?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}
export async function getActivityHeatmap(days?: number): Promise<{ days: number; cells: HeatmapCell[] }> {
    const qs = buildQuery({ type: 'heatmap', days });
    const body = await timelineJson<{ data: { days: number; cells: HeatmapCell[] } }>(`/api/timeline/trends?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface TemporalCorrelationSummary {
    timeRange: { from: string; to: string; windowMinutes: number }; events: number; modules: string[];
    entities: TimelineEntityRef[]; sharedIoc: TimelineEntityRef[]; sharedCampaign: TimelineEntityRef[];
    severityDistribution: Record<string, number>; confidenceDistribution: Record<string, number>;
}
export async function getTemporalCorrelationSummary(params: { anchorEventId?: string; from?: string; to?: string; window?: string }): Promise<TemporalCorrelationSummary> {
    const qs = buildQuery(params);
    const body = await timelineJson<{ data: TemporalCorrelationSummary }>(`/api/timeline/correlation-summary?${qs.toString()}`, 'Timeline unavailable.');
    return body.data;
}

export interface TimelineAiAnalysis {
    summary: string; observed: string[]; correlated: string[]; inferred: string[]; unknown: string[];
    note?: string; citations: { type: string; id: string; entity_type: string; entity_id: string; label: string }[];
}
export async function analyzeTimelinePeriod(params: { anchorEventId?: string; from?: string; to?: string; window?: string; question?: string }): Promise<TimelineAiAnalysis> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/ai/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Timeline unavailable.');
    return (body as any).data;
}

export async function createThreatBriefDraftFromTimeline(params: { anchorEventId?: string; from?: string; to?: string; window?: string; title?: string; reportType?: string; conclusion?: string; skipAi?: boolean }): Promise<{ id: number; status: string }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/threat-brief-draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to create draft.');
    return (body as any).data;
}

export async function createKnowledgeDraftFromTimeline(params: { anchorEventId?: string; from?: string; to?: string; window?: string; title: string; summary?: string; content?: string; category?: string; confidence?: string; tags?: string[] }): Promise<{ id: number; slug: string; status: string }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/timeline/knowledge-draft`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to create draft.');
    return (body as any).data;
}

// ═════════════════════════════════════════════════════════════════════════
// EVIDENCE_PHASE1.md — Evidence Repository, Provenance, Search & Analyst
// Workspace. A view over the EXISTING intelligence_evidence system.
// ═════════════════════════════════════════════════════════════════════════

// Named *Record* — an EXISTING, differently-shaped `EvidenceItem` interface
// already exists below (the older per-entity evidence list this page's own
// generic-entity routes still use) — never renamed/removed, just not
// reused here since its shape (bare id/source/url/description/confidence)
// doesn't carry Evidence Phase 1's provenance/classification/relationship
// fields.
export interface EvidenceEntityRef { type: string; id: string; label: string; meta?: Record<string, unknown> }
export type EvidenceLifecycleStatus = 'unreviewed' | 'reviewed' | 'needs_review' | 'accepted' | 'rejected' | 'needs_more_context' | 'superseded';
export type EvidenceIntegrityStatusValue = 'not_applicable' | 'unknown' | 'verified' | 'mismatch';
export type EvidenceImportanceLevel = 'critical' | 'important' | 'contextual';
export interface EvidenceRecord {
    id: string; rawId: number; type: string; sourceModule: string; source: string;
    entity: EvidenceEntityRef; observedAt: string; observedAtIsExplicit: boolean; createdAt: string;
    confidence: string | null; description: string | null; url: string | null; createdBy: string | null;
    classification: string | null;
    relationshipCounts: { cases: number; hypotheses: number; findings: number };
    // EVIDENCE_PHASE3.md §4/§22/§57 — present on every list row (§60 — no per-row extra fetch).
    lifecycleStatus: EvidenceLifecycleStatus; importance: EvidenceImportanceLevel | null;
    integrityStatus: EvidenceIntegrityStatusValue; supersededByEvidenceId: number | null;
}
export interface EvidencePageResult { items: EvidenceRecord[]; total: number; page: number; pageSize: number }

async function evidenceJson<T>(path: string, fallbackMessage = 'Evidence unavailable.'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getEvidencePage(params: {
    search?: string; module?: string; type?: string; entityId?: string; source?: string; confidence?: string;
    classification?: string; caseId?: number | string; observedFrom?: string; observedTo?: string;
    createdFrom?: string; createdTo?: string; sort?: string; page?: number; pageSize?: number;
    // EVIDENCE_PHASE3.md §58/§59.
    reviewState?: string; importance?: string; integrityStatus?: string; hasConflict?: boolean;
} = {}): Promise<EvidencePageResult> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return evidenceJson<EvidencePageResult>(`/api/evidence?${qs.toString()}`);
}

export interface EvidenceRelatedCase { caseId: number; caseNumber: string; title: string; status: string; classification: string | null; note: string | null }
export interface EvidenceRelatedFinding { findingId: number; caseId: number; caseNumber: string; title: string; statement: string; confidence: string }
export interface EvidenceRelatedHypothesis { hypothesisId: number; caseId: number; caseNumber: string; statement: string; status: string; role: string; note: string | null }
export interface EvidenceRelatedThreatBrief { reportId: number; title: string; rank: string; included: boolean }
export interface EvidenceDetail extends EvidenceRecord {
    relatedCases: EvidenceRelatedCase[]; relatedFindings: EvidenceRelatedFinding[];
    relatedHypotheses: EvidenceRelatedHypothesis[]; relatedThreatBriefs: EvidenceRelatedThreatBrief[];
    metadata: Record<string, unknown>;
}
export async function getEvidenceDetail(id: number | string): Promise<EvidenceDetail> {
    const body = await evidenceJson<{ data: EvidenceDetail }>(`/api/evidence/${id}`, 'Evidence not found');
    return body.data;
}

export interface EvidenceStats {
    total: number; recentEvidence: number; highConfidence: number; supporting: number; contradicting: number;
    bySourceModule: { module: string; count: number }[];
    // EVIDENCE_PHASE3.md §55.
    unreviewed: number; accepted: number; rejected: number; conflicts: number;
    integrityWarnings: number; criticalEvidence: number; highImpactEvidence: number; evidenceGaps: number;
}
export async function getEvidenceStats(): Promise<EvidenceStats> {
    const body = await evidenceJson<{ data: EvidenceStats }>('/api/evidence/stats');
    return body.data;
}

export interface EvidenceMeta {
    modules: string[]; entityTypes: string[]; sources: string[]; classifications: string[]; confidences: string[]; allModules: string[];
    // EVIDENCE_PHASE3.md §59 — only real, present values.
    reviewStates: string[]; importanceLevels: string[]; integrityStatuses: string[]; rejectReasons: readonly string[];
}
export async function getEvidenceMeta(): Promise<EvidenceMeta> {
    const body = await evidenceJson<{ data: EvidenceMeta }>('/api/evidence/meta');
    return body.data;
}

// ─── EVIDENCE_PHASE2.md — Correlation, Strength, Independence, Lineage,
// Conflicts, Review, Gaps, Case/Finding/Hypothesis Analysis, AI Analyst.

async function evidenceMutateJson<T>(path: string, method: 'POST' | 'PATCH', payload: unknown, fallbackMessage = 'Evidence unavailable.'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export type EvidenceStrengthLabel = 'Strong' | 'Moderate' | 'Weak' | 'Unknown';
export interface EvidenceStrength { label: EvidenceStrengthLabel; signals: string[]; }
export interface EvidenceQuality { checklist: Record<string, boolean>; summary: string; }
export interface EvidenceSourceIndependence { independentSourceCount: number; lineages: { key: string; label: string; evidenceIds: number[] }[]; }
export interface EvidenceLineageStep { level: string; label: string; detail?: unknown }
export interface EvidenceChainOfCustody { status: 'Not Established'; reason: string; }
export interface EvidenceConflictItem {
    id: number | null; evidenceA: EvidenceCorrelationMember; evidenceB: EvidenceCorrelationMember;
    reasons: string[]; status: 'open' | 'under_review' | 'resolved' | 'accepted_difference'; resolutionNote: string | null; suggested: boolean;
}
export interface EvidenceImpact { downstreamCount: number; cases: number; findings: number; hypotheses: number; threatBriefs: number; }
export interface EvidenceIntegrity { status: EvidenceIntegrityStatusValue; hash: string | null; verifiedAt: string | null; }
export interface EvidenceDetailPhase2 extends EvidenceDetail {
    strength: EvidenceStrength; quality: EvidenceQuality; sourceIndependence: EvidenceSourceIndependence;
    conflicts: EvidenceConflictItem[]; lineage: EvidenceLineageStep[]; chainOfCustody: EvidenceChainOfCustody;
    reviewState: EvidenceLifecycleStatus; relevance: 'relevant' | 'not_relevant' | null;
    // EVIDENCE_PHASE3.md §4/§6/§7/§9/§11/§22/§56.
    lifecycleStatus: EvidenceLifecycleStatus; decisionReason: string | null;
    reviewedByUserId: number | null; reviewedAt: string | null; supersededByEvidenceId: number | null;
    integrity: EvidenceIntegrity; importance: EvidenceImportanceLevel | null; impact: EvidenceImpact;
}

export interface EvidenceCorrelationMember {
    id: string; rawId: number; type: string; sourceModule: string; source: string;
    entity: EvidenceEntityRef; confidence: string | null; reviewState: string; lineageRef: string | null;
}
export interface EvidenceCorrelationGroup { reason: string; label: string; members: EvidenceCorrelationMember[]; }
export async function getEvidenceCorrelation(id: number | string): Promise<{ evidenceId: string; groups: EvidenceCorrelationGroup[] }> {
    const body = await evidenceJson<{ data: { evidenceId: string; groups: EvidenceCorrelationGroup[] } }>(`/api/evidence/${id}/correlation`);
    return body.data;
}

export async function getEvidenceLineage(id: number | string): Promise<{ evidenceId: string; chain: EvidenceLineageStep[]; disclaimer: string }> {
    const body = await evidenceJson<{ data: { evidenceId: string; chain: EvidenceLineageStep[]; disclaimer: string } }>(`/api/evidence/${id}/lineage`);
    return body.data;
}

export interface EvidenceHistoryEntry { action: string; note: string | null; source: string | null; username: string | null; createdAt: string | null }
export async function getEvidenceHistory(id: number | string): Promise<EvidenceHistoryEntry[]> {
    const body = await evidenceJson<{ data: EvidenceHistoryEntry[] }>(`/api/evidence/${id}/history`);
    return body.data;
}

export type EvidenceReviewAction = 'mark_reviewed' | 'mark_needs_review' | 'mark_unreviewed' | 'mark_relevant' | 'mark_not_relevant';
export async function reviewEvidence(id: number | string, action: EvidenceReviewAction): Promise<{ updated: boolean; action: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; action: string } }>(`/api/evidence/${id}/review`, 'POST', { action });
    return body.data;
}

export async function addEvidenceNote(id: number | string, note: string): Promise<{ added: boolean }> {
    const body = await evidenceMutateJson<{ data: { added: boolean } }>(`/api/evidence/${id}/note`, 'POST', { note });
    return body.data;
}

export async function getEvidenceConflictPairs(params: { caseId?: number; findingId?: number; hypothesisId?: number; evidenceId?: number } = {}): Promise<{ items: EvidenceConflictItem[] }> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return evidenceJson<{ items: EvidenceConflictItem[] }>(`/api/evidence/conflicts?${qs.toString()}`);
}

export async function setEvidenceConflictStatus(payload: { evidenceAId: number; evidenceBId: number; status: 'open' | 'under_review' | 'resolved' | 'accepted_difference'; reason?: string; resolutionNote?: string }): Promise<{ updated: boolean; status: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; status: string } }>('/api/evidence/conflicts', 'PATCH', payload);
    return body.data;
}

export interface EvidenceGap { type: string; message: string; recommendation: string }
export type EvidenceImpactStatus = 'ok' | 'review_required';
export interface FindingEvidenceAnalysis {
    findingId: number; caseNumber: string; title: string | null; statement: string; status: string;
    supportingEvidence: EvidenceCorrelationMember[]; contradictingEvidence: EvidenceCorrelationMember[];
    strength: EvidenceStrength; sources: EvidenceSourceIndependence['lineages']; conflicts: EvidenceConflictItem[]; unknowns: EvidenceGap[];
    impactStatus: EvidenceImpactStatus;
}
export async function getFindingEvidenceAnalysis(findingId: number): Promise<FindingEvidenceAnalysis> {
    const body = await evidenceJson<{ data: FindingEvidenceAnalysis }>(`/api/findings/${findingId}/evidence-analysis`);
    return body.data;
}

export interface HypothesisEvidenceAnalysis {
    hypothesisId: number; caseNumber: string; statement: string; status: string; currentConfidence: string;
    supporting: EvidenceCorrelationMember[]; contradicting: EvidenceCorrelationMember[]; contextual: EvidenceCorrelationMember[];
    unknownCount: number; sourceDiversity: EvidenceSourceIndependence; strength: EvidenceStrength; conflicts: EvidenceConflictItem[];
    impactStatus: EvidenceImpactStatus;
}
export async function getHypothesisEvidenceAnalysis(hypothesisId: number): Promise<HypothesisEvidenceAnalysis> {
    const body = await evidenceJson<{ data: HypothesisEvidenceAnalysis }>(`/api/hypotheses/${hypothesisId}/evidence-analysis`);
    return body.data;
}

export interface CaseEvidenceAnalysis {
    caseId: number; evidenceCount: number; total: number; supporting: number; contradicting: number;
    contextual: number; unclassified: number; unreviewed: number; conflicts: number; evidenceGaps: number;
    rejected: number; accepted: number; critical: number; persistedGaps: number; criticalGaps: number;
    caseImpact: { findingsReviewRequired: number; hypothesesReviewRequired: number; criticalRejected: number; note: string | null };
}
export async function getCaseEvidenceAnalysis(caseId: number): Promise<CaseEvidenceAnalysis> {
    const body = await evidenceJson<{ data: CaseEvidenceAnalysis }>(`/api/cases/${caseId}/evidence-analysis`);
    return body.data;
}

export interface EvidenceAiAnalysis {
    scope: string; summary: string; strongestEvidence: string[]; conflicts: string[]; gaps: string[]; impact: string[]; unknown: string[]; citations: string[]; note: string;
}
export async function getEvidenceAiAnalysis(payload: { caseId?: number; findingId?: number; hypothesisId?: number; entityType?: string; entityId?: string | number; evidenceId?: number; question?: string }): Promise<EvidenceAiAnalysis> {
    const body = await evidenceMutateJson<{ data: EvidenceAiAnalysis }>('/api/evidence/ai/analyze', 'POST', payload);
    return body.data;
}

// ─── EVIDENCE_PHASE3.md — Lifecycle Decisions, Integrity, Impact, Critical
// Evidence, Evidence Gaps/Requests, Review Queue, Export.

export interface EvidenceImpactResult {
    evidenceId: string; lifecycleStatus: EvidenceLifecycleStatus; impact: EvidenceImpact;
    relatedCases: EvidenceRelatedCase[]; relatedFindings: EvidenceRelatedFinding[];
    relatedHypotheses: EvidenceRelatedHypothesis[]; relatedThreatBriefs: EvidenceRelatedThreatBrief[];
}
export async function getEvidenceImpact(id: number | string): Promise<EvidenceImpactResult> {
    const body = await evidenceJson<{ data: EvidenceImpactResult }>(`/api/evidence/${id}/impact`);
    return body.data;
}

export async function acceptEvidence(id: number | string, note?: string): Promise<{ updated: boolean; reviewState: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; reviewState: string } }>(`/api/evidence/${id}/accept`, 'POST', { note });
    return body.data;
}

export const EVIDENCE_REJECT_REASONS = ['Irrelevant', 'Incorrect', 'Duplicate', 'Unreliable', 'Superseded', 'Insufficient Context', 'Other'] as const;
export type EvidenceRejectReason = typeof EVIDENCE_REJECT_REASONS[number];
export async function rejectEvidence(id: number | string, reason: EvidenceRejectReason, note?: string): Promise<{ updated: boolean; reviewState: string; impact: EvidenceImpactResult }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; reviewState: string; impact: EvidenceImpactResult } }>(`/api/evidence/${id}/reject`, 'POST', { reason, note });
    return body.data;
}

export async function requestMoreContextOnEvidence(id: number | string, note?: string): Promise<{ updated: boolean; reviewState: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; reviewState: string } }>(`/api/evidence/${id}/needs-more-context`, 'POST', { note });
    return body.data;
}

export async function supersedeEvidence(oldId: number | string, newEvidenceId: number, note?: string): Promise<{ updated: boolean; oldEvidenceId: number; newEvidenceId: number }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; oldEvidenceId: number; newEvidenceId: number } }>(`/api/evidence/${oldId}/supersede`, 'POST', { newEvidenceId, note });
    return body.data;
}

export interface EvidenceIntegrityResult { status: EvidenceIntegrityStatusValue; reason?: string; storedHash?: string; currentHash?: string; fileSize?: number | null; mediaType?: string | null; }
export async function verifyEvidenceIntegrity(id: number | string): Promise<EvidenceIntegrityResult> {
    const body = await evidenceMutateJson<{ data: EvidenceIntegrityResult }>(`/api/evidence/${id}/verify-integrity`, 'POST', {});
    return body.data;
}

export const EVIDENCE_IMPORTANCE_LEVELS = ['critical', 'important', 'contextual'] as const;
export async function setEvidenceImportance(id: number | string, importance: EvidenceImportanceLevel | null): Promise<{ updated: boolean; importance: EvidenceImportanceLevel | null }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; importance: EvidenceImportanceLevel | null } }>(`/api/evidence/${id}/importance`, 'POST', { importance });
    return body.data;
}

export type EvidenceGapPriority = 'Low' | 'Medium' | 'High' | 'Critical';
export type EvidenceGapStatus = 'open' | 'investigating' | 'resolved' | 'accepted_risk';
export interface EvidenceGapRecord {
    id: number; caseId: number; findingId: number | null; hypothesisId: number | null; description: string;
    priority: EvidenceGapPriority; status: EvidenceGapStatus; assignedTo: string | null; createdBy: string | null;
    resolutionNote: string | null; createdAt: string; resolvedAt: string | null;
}
export async function getEvidenceGapsForCase(caseId: number): Promise<EvidenceGapRecord[]> {
    const body = await evidenceJson<{ data: EvidenceGapRecord[] }>(`/api/cases/${caseId}/evidence-gaps`);
    return body.data;
}
export async function createEvidenceGap(caseId: number, payload: { findingId?: number; hypothesisId?: number; description: string; priority?: EvidenceGapPriority; assignedToUserId?: number }): Promise<{ id: number; status: string; priority: string }> {
    const body = await evidenceMutateJson<{ data: { id: number; status: string; priority: string } }>(`/api/cases/${caseId}/evidence-gaps`, 'POST', payload);
    return body.data;
}
export async function updateEvidenceGapStatus(gapId: number, status: EvidenceGapStatus, resolutionNote?: string): Promise<{ updated: boolean; status: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; status: string } }>(`/api/evidence-gaps/${gapId}`, 'PATCH', { status, resolutionNote });
    return body.data;
}

export type EvidenceRequestStatus = 'pending' | 'fulfilled' | 'cancelled';
export interface EvidenceRequestRecord {
    id: number; caseId: number; findingId: number | null; hypothesisId: number | null; description: string;
    status: EvidenceRequestStatus; assignedTo: string | null; createdBy: string | null;
    fulfilledByEvidenceId: number | null; createdAt: string; fulfilledAt: string | null;
}
export async function getEvidenceRequestsForCase(caseId: number): Promise<EvidenceRequestRecord[]> {
    const body = await evidenceJson<{ data: EvidenceRequestRecord[] }>(`/api/cases/${caseId}/evidence-requests`);
    return body.data;
}
export async function createEvidenceRequest(caseId: number, payload: { findingId?: number; hypothesisId?: number; description: string; assignedToUserId?: number }): Promise<{ id: number; status: string }> {
    const body = await evidenceMutateJson<{ data: { id: number; status: string } }>(`/api/cases/${caseId}/evidence-requests`, 'POST', payload);
    return body.data;
}
export async function updateEvidenceRequestStatus(requestId: number, status: EvidenceRequestStatus, fulfilledByEvidenceId?: number): Promise<{ updated: boolean; status: string }> {
    const body = await evidenceMutateJson<{ data: { updated: boolean; status: string } }>(`/api/evidence-requests/${requestId}`, 'PATCH', { status, fulfilledByEvidenceId });
    return body.data;
}

export interface EvidenceReviewQueueItem extends EvidenceRecord { priorityFactors: string[]; priorityScore: number; ageDays: number | null; }
export async function getEvidenceReviewQueue(limit = 50): Promise<{ items: EvidenceReviewQueueItem[] }> {
    return evidenceJson<{ items: EvidenceReviewQueueItem[] }>(`/api/evidence/review-queue?limit=${limit}`);
}

export interface EvidenceExportRow {
    id: string; type: string; sourceModule: string; source: string; entity: string; confidence: string | null;
    classification: string | null; observedAt: string; createdAt: string; reviewState: string;
    importance: string | null; integrityStatus: string; relationshipCounts: { cases: number; hypotheses: number; findings: number };
}
export async function exportEvidencePage(params: { caseId?: number; module?: string; type?: string; reviewState?: string; importance?: string; integrityStatus?: string; pageSize?: number } = {}): Promise<{ items: EvidenceExportRow[]; total: number; exportedAt: string }> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    const body = await evidenceJson<{ data: { items: EvidenceExportRow[]; total: number; exportedAt: string } }>(`/api/evidence/export?${qs.toString()}`, 'Evidence export unavailable.');
    return body.data;
}

// ─── NOTES_PHASE1.md — Centralized Analyst Notes ────────────────────────
export type NoteType = 'general' | 'observation' | 'analysis' | 'decision' | 'hypothesis' | 'finding' | 'follow_up' | 'conclusion';
export type NoteContextFilter = 'all' | 'cases' | 'findings' | 'hypotheses' | 'evidence' | 'entities' | 'timeline';

export interface NoteContext {
    caseId: number | null; caseNumber?: string | null; caseTitle?: string | null;
    findingId: number | null; findingTitle?: string | null;
    hypothesisId: number | null; hypothesisStatement?: string | null;
    entityType: string | null; entity: EvidenceEntityRef | null;
}
export interface NoteListItem {
    id: string; rawId: number; source: 'C' | 'G' | 'H';
    title: string | null; contentPreview: string; noteType: NoteType;
    createdBy: string | null; createdByUserId: number | null; updatedBy: string | null;
    createdAt: string; updatedAt: string; isArchived: boolean;
    context: NoteContext; editable: boolean;
    tags: string[];
}
export interface NoteReference { id: number; referenceType: string; referenceId: string; label: string; }
export interface NoteTag { id: number; name: string; }
export interface NoteDetail {
    id: string; rawId: number; source: 'C' | 'G' | 'H';
    title: string | null; content: string; noteType: NoteType;
    createdBy: string | null; updatedBy: string | null;
    createdAt: string; updatedAt: string; isArchived: boolean;
    context: NoteContext; editable: boolean; readOnlyReason?: string;
    references: NoteReference[]; tags: NoteTag[];
}
export interface NotesPageResult { items: NoteListItem[]; total: number; page: number; pageSize: number }

async function notesJson<T>(path: string, fallbackMessage = 'Notes unavailable.'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}
async function notesMutateJson<T>(path: string, method: 'POST' | 'PATCH', payload: unknown, fallbackMessage = 'Notes unavailable.'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getNotesPage(params: {
    search?: string; noteType?: string; authorUserId?: number; caseId?: number;
    entityType?: string; entityId?: string; context?: NoteContextFilter; archived?: 'true' | 'false' | 'all';
    createdFrom?: string; createdTo?: string; updatedFrom?: string; updatedTo?: string;
    sort?: string; page?: number; pageSize?: number;
    // NOTES_PHASE2.md §21/§22/§33/§50.
    tag?: string; referenceType?: string; referenceId?: string;
} = {}): Promise<NotesPageResult> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    return notesJson<NotesPageResult>(`/api/notes?${qs.toString()}`);
}

export async function getNoteDetail(id: string): Promise<NoteDetail> {
    const body = await notesJson<{ data: NoteDetail }>(`/api/notes/${id}`, 'Note not found');
    return body.data;
}

export async function createCentralNote(payload: {
    title?: string; content: string; noteType?: NoteType;
    caseId?: number; findingId?: number; hypothesisId?: number; entityType?: string; entityId?: string | number;
}): Promise<{ id: string | null }> {
    const body = await notesMutateJson<{ data: { id: string | null } }>('/api/notes', 'POST', payload);
    return body.data;
}

export async function updateCentralNote(id: string, payload: { title?: string; content: string }): Promise<{ updated: boolean }> {
    const body = await notesMutateJson<{ data: { updated: boolean } }>(`/api/notes/${id}`, 'PATCH', payload);
    return body.data;
}

export async function archiveCentralNote(id: string): Promise<{ archived: boolean }> {
    const body = await notesMutateJson<{ data: { archived: boolean } }>(`/api/notes/${id}/archive`, 'POST', {});
    return body.data;
}

export async function restoreCentralNote(id: string): Promise<{ restored: boolean }> {
    const body = await notesMutateJson<{ data: { restored: boolean } }>(`/api/notes/${id}/restore`, 'POST', {});
    return body.data;
}

export interface NotesStats {
    total: number; myNotes: number; createdToday: number; updatedToday: number;
    recentNotes: NoteListItem[]; byType: { noteType: string; count: number }[];
}
export async function getNotesStats(): Promise<NotesStats> {
    const body = await notesJson<{ data: NotesStats }>('/api/notes/stats');
    return body.data;
}

export interface NotesMeta { noteTypes: string[]; entityTypes: string[]; referenceTypes: string[]; allModules: string[]; contexts: string[]; }
export async function getNotesMeta(): Promise<NotesMeta> {
    const body = await notesJson<{ data: NotesMeta }>('/api/notes/meta');
    return body.data;
}

// ─── NOTES_PHASE2.md — References, Tags, Related Notes, Export ─────────
export async function addNoteReference(id: string, referenceType: string, referenceId: string | number): Promise<{ added: boolean; label: string }> {
    const body = await notesMutateJson<{ data: { added: boolean; label: string } }>(`/api/notes/${id}/references`, 'POST', { referenceType, referenceId });
    return body.data;
}

export async function removeNoteReference(id: string, referenceType: string, referenceId: string | number): Promise<{ removed: boolean }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/notes/${id}/references`, { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ referenceType, referenceId }) });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Notes unavailable.');
    return (body as any).data;
}

export async function getTags(search?: string): Promise<NoteTag[]> {
    const qs = search ? `?search=${encodeURIComponent(search)}` : '';
    const body = await notesJson<{ data: NoteTag[] }>(`/api/notes/tags${qs}`, 'Tags unavailable.');
    return body.data;
}

export async function renameTag(tagId: number, name: string): Promise<{ renamed: boolean; name: string }> {
    const body = await notesMutateJson<{ data: { renamed: boolean; name: string } }>(`/api/notes/tags/${tagId}`, 'PATCH', { name });
    return body.data;
}

export async function archiveTag(tagId: number): Promise<{ archived: boolean }> {
    const body = await notesMutateJson<{ data: { archived: boolean } }>(`/api/notes/tags/${tagId}/archive`, 'POST', {});
    return body.data;
}

export async function addNoteTag(id: string, name: string): Promise<{ added: boolean; tag: NoteTag }> {
    const body = await notesMutateJson<{ data: { added: boolean; tag: NoteTag } }>(`/api/notes/${id}/tags`, 'POST', { name });
    return body.data;
}

export async function removeNoteTag(id: string, tagId: number): Promise<{ removed: boolean }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/notes/${id}/tags/${tagId}`, { method: 'DELETE' });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Notes unavailable.');
    return (body as any).data;
}

export interface RelatedNoteGroup { reason: string; notes: { id: string; title: string | null; contentPreview: string; noteType: NoteType; updatedAt: string; createdAt: string }[]; }
export async function getRelatedNotes(id: string): Promise<RelatedNoteGroup[]> {
    const body = await notesJson<{ data: RelatedNoteGroup[] }>(`/api/notes/${id}/related`);
    return body.data;
}

export interface NoteExportRow {
    id: string; title: string | null; noteType: string; content: string; author: string | null;
    createdAt: string; updatedAt: string; case: string | null; entity: string | null;
    references: string[]; tags: string[];
}
export async function exportNotesPage(params: {
    search?: string; noteType?: string; authorUserId?: number; caseId?: number;
    entityType?: string; entityId?: string; context?: NoteContextFilter;
    tag?: string; referenceType?: string; referenceId?: string; pageSize?: number;
    updatedFrom?: string; updatedTo?: string;
} = {}): Promise<{ items: NoteExportRow[]; total: number; exportedAt: string }> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    const body = await notesJson<{ data: { items: NoteExportRow[]; total: number; exportedAt: string } }>(`/api/notes/export?${qs.toString()}`, 'Notes export unavailable.');
    return body.data;
}

/** Client-side CSV conversion of the already-authorized export rows — no
 * new server-side dependency, matching the project's existing convention
 * of no CSV/PDF library anywhere in the codebase (§27 "Only formats
 * actually supported by the existing project should be implemented"). */
export function notesToCsv(rows: NoteExportRow[]): string {
    const headers = ['Note ID', 'Title', 'Type', 'Content', 'Author', 'Created', 'Updated', 'Case', 'Entity', 'References', 'Tags'];
    const escape = (v: string) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    for (const r of rows) {
        lines.push([r.id, r.title || '', r.noteType, r.content, r.author || '', r.createdAt, r.updatedAt, r.case || '', r.entity || '', r.references.join('; '), r.tags.join('; ')].map(escape).join(','));
    }
    return lines.join('\n');
}

export async function restoreCaseNote(id: number, noteId: number): Promise<void> {
    await casesJson(`/api/investigations/cases/${id}/notes/${noteId}/restore`, 'Failed to restore note', { method: 'POST' });
}

// ═══════════════════════════════════════════════════════════════════════
// NOTES_PHASE3.md — AI Note Analysis, Entity Extraction, Intelligence
// Suggestions & Knowledge Extraction.
// ═══════════════════════════════════════════════════════════════════════
export interface NoteAiSummaryResult { summary: string; note: string; }
export async function getNoteAiSummary(id: string): Promise<NoteAiSummaryResult> {
    const body = await notesMutateJson<{ data: NoteAiSummaryResult }>(`/api/notes/${id}/ai-summary`, 'POST', {}, 'AI Unavailable');
    return body.data;
}

export interface MultiNoteSummaryResult {
    noteIds: string[]; keyThemes: string[]; importantEntities: string[];
    observations: string[]; conflicts: string[]; unknowns: string[]; note: string;
}
export async function getMultiNoteSummary(noteIds: string[]): Promise<MultiNoteSummaryResult> {
    const body = await notesMutateJson<{ data: MultiNoteSummaryResult }>('/api/notes/ai/summarize-selected', 'POST', { noteIds }, 'AI Unavailable');
    return body.data;
}
export async function getCaseNotesSummary(caseId: number): Promise<MultiNoteSummaryResult> {
    const body = await notesMutateJson<{ data: MultiNoteSummaryResult }>(`/api/notes/ai/summarize-case/${caseId}`, 'POST', {}, 'AI Unavailable');
    return body.data;
}
export async function getEntityNotesSummary(entityType: string, entityId: string): Promise<MultiNoteSummaryResult> {
    const body = await notesMutateJson<{ data: MultiNoteSummaryResult }>(`/api/notes/ai/summarize-entity/${entityType}/${entityId}`, 'POST', {}, 'AI Unavailable');
    return body.data;
}

export interface NoteEntityExtraction {
    phrase: string; sourceType: string; status: 'resolved' | 'ambiguous' | 'not_found';
    entity?: { type: string; id: string; label: string };
    candidates?: { type: string; id: string; label: string }[];
    confidence: string | null; matchedBy: string;
}
export interface NoteAiSuggestion {
    id: number; type: 'reference' | 'evidence' | 'finding' | 'hypothesis' | 'knowledge' | 'tag';
    created: boolean; payload: Record<string, any>; reason: string; confidence: string | null; status: string;
}
export interface NoteQualityWarning { warning: string; detail: string; }
export interface NoteEvidenceGap { gap: string; detail: string; }
export interface NoteAnalysis {
    noteId: string; entities: NoteEntityExtraction[];
    signal: { type: string; reason: string; confidence: string } | null;
    qualityWarnings: NoteQualityWarning[]; evidenceGaps: NoteEvidenceGap[]; suggestions: NoteAiSuggestion[];
}
export async function analyzeNoteAi(id: string): Promise<NoteAnalysis> {
    const body = await notesMutateJson<{ data: NoteAnalysis }>(`/api/notes/${id}/ai-analyze`, 'POST', {}, 'AI Unavailable');
    return body.data;
}

export interface NoteConflict { noteA: { id: string; content: string; author: string | null; createdAt: string }; noteB: { id: string; content: string; author: string | null; createdAt: string }; reason: string; }
export async function getNoteAiConflicts(id: string): Promise<NoteConflict[]> {
    const body = await notesJson<{ data: NoteConflict[] }>(`/api/notes/${id}/ai-conflicts`, 'AI Unavailable');
    return body.data;
}
export interface NoteDuplicate { note: { id: string; content: string; author: string | null; createdAt: string }; similarity: 'High' | 'Medium'; reason: string; }
export async function getNoteAiDuplicates(id: string): Promise<NoteDuplicate[]> {
    const body = await notesJson<{ data: NoteDuplicate[] }>(`/api/notes/${id}/ai-duplicates`, 'AI Unavailable');
    return body.data;
}

export async function createKnowledgeCandidateFromNotes(noteIds: string[]): Promise<{ id: number; created: boolean; payload: Record<string, any> }> {
    const body = await notesMutateJson<{ data: { id: number; created: boolean; payload: Record<string, any> } }>('/api/notes/ai/knowledge-candidate', 'POST', { noteIds }, 'AI Unavailable');
    return body.data;
}

// ─── §61-64 REVIEW QUEUE & SUGGESTION LIFECYCLE ────────────────────────
export interface ReviewQueueItem extends NoteAiSuggestion {
    noteId: string; noteTitle: string | null; noteContext: NoteContext;
    suggestedBy: string; createdAt: string; reviewedByUserId: number | null; reviewedAt: string | null; result: Record<string, any> | null;
}
export async function getReviewQueue(params: { status?: string; suggestionType?: string; limit?: number } = {}): Promise<ReviewQueueItem[]> {
    const qs = buildQuery(params as Record<string, string | number | undefined>);
    const body = await notesJson<{ data: ReviewQueueItem[] }>(`/api/notes/ai-suggestions?${qs.toString()}`, 'Review Queue unavailable.');
    return body.data;
}
export async function checkSuggestionPermission(id: number): Promise<{ canApprove: boolean; reason: string | null }> {
    const body = await notesJson<{ data: { canApprove: boolean; reason: string | null } }>(`/api/notes/ai-suggestions/${id}/permission`, 'Review Queue unavailable.');
    return body.data;
}
export async function approveSuggestion(id: number): Promise<{ id: number; status: string }> {
    const body = await notesMutateJson<{ data: { id: number; status: string } }>(`/api/notes/ai-suggestions/${id}/approve`, 'POST', {}, 'Review Queue unavailable.');
    return body.data;
}
export async function rejectSuggestion(id: number): Promise<{ id: number; status: string }> {
    const body = await notesMutateJson<{ data: { id: number; status: string } }>(`/api/notes/ai-suggestions/${id}/reject`, 'POST', {}, 'Review Queue unavailable.');
    return body.data;
}
export async function applySuggestion(id: number, caseId?: number): Promise<{ id: number; status: string; result: Record<string, any> }> {
    const body = await notesMutateJson<{ data: { id: number; status: string; result: Record<string, any> } }>(`/api/notes/ai-suggestions/${id}/apply`, 'POST', { caseId }, 'Review Queue unavailable.');
    return body.data;
}

export async function updateOsintInvestigationStatus(id: number, status: string, isAdmin: boolean) {
    const url = isAdmin
        ? `${API_BASE_URL}/api/history/osint/${id}/status`
        : `${API_BASE_URL}/api/user/history/osint/${id}/status`;
    const res = await fetchWithAuth(url, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
    });
    if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please login.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to update status');
    return (body as any).data;
}

// ─── Monitoring module (MONITORING_CODE.md) ──────────────────────────────────

export interface Monitor {
    id: number;
    user_id: number;
    // Every value runMonitorCheck() (services/monitoring/checkers.js)
    // dispatches on. This union previously stopped at 'threat_actor' and
    // said so ("were already real monitor types server-side but missing from
    // this union"); the five dark-web/malware/credential-leak types below
    // were reachable from the API but not representable here. Completed now
    // that the unified Monitors list renders all of them.
    type: 'domain' | 'ip' | 'ioc' | 'credential' | 'social_username' | 'telegram_source' | 'brand' | 'threat_actor'
        | 'malware_family' | 'dark_web_source' | 'dark_web_ioc' | 'dark_web_entity' | 'credential_leak_domain';
    ioc_type: 'ip' | 'domain' | 'url' | 'hash' | 'email' | 'username' | 'phone' | null;
    target: string;
    label: string | null;
    status: 'active' | 'paused';
    check_interval_minutes: number;
    last_checked_at: string | null;
    last_success_at: string | null;
    last_error: string | null;
    consecutive_failures: number;
    last_risk: string | null;
    baseline_json: Record<string, any> | null;
    // APT_GROUP_PHASE3.md §4/§5 — optional per-monitor threshold config.
    config_json: { thresholds?: MonitorThreshold[] } | null;
    // BRAND.md §16-§18 "STALE BRAND MONITOR REFERENCES" — 'valid' unless the
    // checker has reported the monitor's target entity gone (brand/
    // threat_actor/telegram_source today).
    reference_status: 'valid' | 'stale_reference';
    created_at: string | null;
    updated_at: string | null;
}

export interface MonitorThreshold {
    condition: 'risk_level' | 'new_campaign_count' | 'new_ioc_count' | 'new_malware_count' | 'new_ttp_count' | 'new_vulnerability_count' | 'new_infrastructure_count';
    operator: '>=' | '>' | '==';
    value: string | number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    enabled: boolean;
}

export interface MonitorEvent {
    id: number;
    event_type: string;
    summary: string;
    details: Record<string, any> | null;
    severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
    created_at: string | null;
}

export interface MonitoringHistoryItem extends MonitorEvent {
    monitor_id: number;
    monitor_type: string;
    monitor_target: string;
}

export interface Alert {
    id: number;
    user_id: number;
    monitor_id: number | null;
    monitor_event_id: number | null;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    description: string | null;
    source: string;
    target: string;
    status: 'new' | 'acknowledged' | 'investigating' | 'resolved' | 'false_positive' | 'suppressed';
    status_updated_at: string | null;
    created_at: string | null;
    updated_at: string | null;
}

export interface MonitoringOverview {
    activeMonitors: number;
    newAlerts: number;
    criticalAlerts: number;
    triggeredToday: number;
    failedMonitors: number;
    health: { type: string; total: number; status: 'operational' | 'degraded' | 'failed' | 'disabled'; last_success_at: string | null; last_checked_at: string | null }[];
}

export interface LiveFeed {
    id: string;
    name: string;
    category: string;
    configured: boolean;
    operational: boolean;
    planned?: boolean;
    lastUpdate?: string | null;
    newItems?: number;
    itemsProcessed?: number;
    errors?: number;
}

export interface CveWatchCriteria {
    id: number;
    user_id: number;
    vendor: string | null;
    product: string | null;
    keyword: string | null;
    min_severity: string | null;
    min_cvss: number | null;
    status: 'active' | 'paused';
    last_checked_at: string | null;
    last_error: string | null;
    created_at: string | null;
}

export interface CveMatch {
    id: number;
    criteria_id: number;
    cve_id: string;
    title: string | null;
    severity: string | null;
    cvss: number | null;
    affected_product: string | null;
    published_at: string | null;
    detected_at: string | null;
    status: 'new' | 'reviewed' | 'dismissed';
    criteria: { vendor: string | null; product: string | null; keyword: string | null };
}

async function monitoringJson<T>(path: string, options?: RequestInit, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, options);
    if (res.status === 401 || res.status === 403) {
        throw new Error('Authentication required. Please login.');
    }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getMonitoringOverview(): Promise<MonitoringOverview> {
    const body = await monitoringJson<{ data: MonitoringOverview }>('/api/monitoring/overview', undefined, 'Failed to load monitoring overview');
    return body.data;
}

export async function getMonitors(params: { type?: string; status?: string; q?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.type) qs.set('type', params.type);
    if (params.status) qs.set('status', params.status);
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return monitoringJson<{ items: Monitor[]; total: number; page: number; pageSize: number }>(
        `/api/monitoring/monitors?${qs.toString()}`, undefined, 'Failed to load monitors'
    );
}

export async function createMonitor(payload: { type: string; iocType?: string; target: string; label?: string; checkIntervalMinutes?: number }) {
    const body = await monitoringJson<{ data: { id: number } }>('/api/monitoring/monitors', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, 'Failed to create monitor');
    return body.data;
}

export async function getMonitor(id: number): Promise<Monitor> {
    const body = await monitoringJson<{ data: Monitor }>(`/api/monitoring/monitors/${id}`, undefined, 'Failed to load monitor');
    return body.data;
}

export async function updateMonitor(id: number, payload: { label?: string; checkIntervalMinutes?: number; status?: 'active' | 'paused' }) {
    return monitoringJson(`/api/monitoring/monitors/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, 'Failed to update monitor');
}

export async function deleteMonitor(id: number) {
    return monitoringJson(`/api/monitoring/monitors/${id}`, { method: 'DELETE' }, 'Failed to delete monitor');
}

export async function checkMonitorNow(id: number): Promise<{ monitor: Monitor; events: any[] }> {
    const body = await monitoringJson<{ data: { monitor: Monitor; events: any[] } }>(
        `/api/monitoring/monitors/${id}/check`, { method: 'POST' }, 'Failed to run check'
    );
    return body.data;
}

export async function getMonitorEvents(id: number, params: { page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return monitoringJson<{ items: MonitorEvent[]; total: number; page: number; pageSize: number }>(
        `/api/monitoring/monitors/${id}/events?${qs.toString()}`, undefined, 'Failed to load monitor history'
    );
}

export async function getMonitoringHistory(params: { q?: string; monitorType?: string; severity?: string; from?: string; to?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.monitorType) qs.set('monitorType', params.monitorType);
    if (params.severity) qs.set('severity', params.severity);
    if (params.from) qs.set('from', params.from);
    if (params.to) qs.set('to', params.to);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return monitoringJson<{ items: MonitoringHistoryItem[]; total: number; page: number; pageSize: number }>(
        `/api/monitoring/history?${qs.toString()}`, undefined, 'Failed to load monitoring history'
    );
}

export async function getAlerts(params: { severity?: string; status?: string; source?: string; q?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.severity) qs.set('severity', params.severity);
    if (params.status) qs.set('status', params.status);
    if (params.source) qs.set('source', params.source);
    if (params.q) qs.set('q', params.q);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return monitoringJson<{ items: Alert[]; total: number; page: number; pageSize: number }>(
        `/api/monitoring/alerts?${qs.toString()}`, undefined, 'Failed to load alerts'
    );
}

export async function updateAlertStatus(id: number, status: Alert['status']) {
    return monitoringJson(`/api/monitoring/alerts/${id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    }, 'Failed to update alert');
}

export async function getCveWatchCriteria(): Promise<CveWatchCriteria[]> {
    const body = await monitoringJson<{ data: CveWatchCriteria[] }>('/api/monitoring/cve-criteria', undefined, 'Failed to load CVE watch criteria');
    return body.data;
}

export async function createCveWatchCriteria(payload: { vendor?: string; product?: string; keyword?: string; minSeverity?: string; minCvss?: number }) {
    const body = await monitoringJson<{ data: { id: number } }>('/api/monitoring/cve-criteria', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, 'Failed to create CVE watch criteria');
    return body.data;
}

export async function updateCveWatchCriteria(id: number, payload: { status: 'active' | 'paused' }) {
    return monitoringJson(`/api/monitoring/cve-criteria/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, 'Failed to update CVE watch criteria');
}

export async function deleteCveWatchCriteria(id: number) {
    return monitoringJson(`/api/monitoring/cve-criteria/${id}`, { method: 'DELETE' }, 'Failed to delete CVE watch criteria');
}

export async function getCveMatches(params: { status?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return monitoringJson<{ items: CveMatch[]; total: number; page: number; pageSize: number }>(
        `/api/monitoring/cve-matches?${qs.toString()}`, undefined, 'Failed to load CVE matches'
    );
}

// ─── Threat Intelligence Phase 1 (THREAT_INTELLIGENCE_MODULE_PHASE1.md) ────

export interface Ioc {
    id: number; type: string; value: string; risk: string | null; confidence: string;
    status: string; threat_category: string | null; first_seen_at: string | null; last_seen_at: string | null;
    source_count?: number; sources?: string[];
}
export interface IocSource { source_type: string; source_label: string; source_ref: string | null; first_seen_at: string | null; last_seen_at: string | null; }
export interface IocRelatedRef { id: number; [key: string]: unknown; }
// THREAT_INTELLIGENCE_MODULE_PHASE2.md — a resolved entity_relationships
// edge target, as returned by getEntityRelationships/getRelationshipGraph.
export interface EntityRef {
    type: 'ioc' | 'campaign' | 'threat_actor' | 'malware' | 'vulnerability' | 'attack_technique'
        | 'report' | 'workspace' | 'company' | 'image' | 'social_investigation' | 'social_account'
        | 'telegram_source' | 'brand'
        // MALWARE_INTELLIGENCE_PHASE1.md §21 — a real entity_relationships
        // target type (malware_sample --Associated With--> malware); every
        // other type above was already resolvable, this one was just never
        // typed yet.
        | 'malware_sample';
    id: string; label: string; meta?: Record<string, unknown>;
}
export interface EntityRelationship {
    id: number; direction: 'outgoing' | 'incoming'; relationship_type: string;
    basis: 'observed' | 'inferred'; confidence: string | null; source: string; detection_method: string | null;
    created_at: string | null; updated_at: string | null; entity: EntityRef;
}

export interface IocDetail extends Omit<Ioc, 'sources'> {
    sources: IocSource[];
    relatedCampaigns: { id: number; name: string; status: string; severity: string | null }[];
    relatedMonitors: { id: number; type: string; status: string }[];
    relatedAlerts: { id: number; severity: string; title: string; status: string; created_at: string | null }[];
    relatedInvestigations: { id: number; module: string; risk_level: string | null; created_at: string | null }[];
    relatedThreatActors: EntityRef[];
    relatedMalware: EntityRef[];
}
export interface Campaign {
    id: number; name: string; description: string | null; status: string; severity: string | null;
    confidence: string; source_type: string; source_ref_id: number | null;
    first_seen_at: string | null; last_seen_at: string | null; ioc_count?: number; technique_count?: number;
}
export interface CampaignDetail extends Campaign {
    iocs: { id: number; type: string; value: string; risk: string | null }[];
    techniques: { technique_id: string; name: string; tactic: string; tactics: string[] }[];
    timeline: { id: number; event_type: string; summary: string; occurred_at: string | null }[];
    relatedInvestigations: { id: number; module: string; target: string; risk_level: string | null; created_at: string | null }[];
}
export interface IntelligenceFeed {
    id: string; name: string; provider: string | null; type: string;
    configured: boolean; operational: boolean; reliability?: string; planned?: boolean;
    lastUpdate?: string | null; indicators?: number; errors?: number;
}
export interface FeedDetail extends IntelligenceFeed {
    description: string;
    lastSuccessfulRun: string | null; lastFailedRun: string | null; lastError: string | null;
    lastRun: { startedAt: string | null; finishedAt: string | null; status: string; itemsCollected: number; itemsAdded: number; itemsUpdated: number; duplicates: number; rejected: number } | null;
    totalRuns: number; totalAdded: number; totalUpdated: number; totalDuplicates: number; totalRejected: number; indicatorsInRepo: number;
}
export interface AttackTechnique {
    technique_id: string; name: string; tactic: string; description: string | null; url: string | null;
    // Full ordered tactic list (from attack_technique_tactics junction). A
    // technique can map to multiple tactics (e.g. T1053 Scheduled Task/Job is
    // Execution, Persistence, and Privilege Escalation). `tactic` is the
    // primary (tactics[0]) for backwards compatibility.
    tactics?: string[];
    observed_count?: number; related_iocs_count?: number;
}
export interface AttackTechniqueDetail extends AttackTechnique {
    relatedCampaigns: { id: number; name: string; status: string; severity: string | null }[];
    relatedIocs: { id: number; type: string; value: string; risk: string | null }[];
    relatedThreatActors: EntityRef[];
    relatedMalware: EntityRef[];
}
export interface IntelligenceOverview {
    totalIocs: number; activeIocs: number; criticalIocs: number; activeCampaigns: number;
    mitreTechniquesObserved: number; newIocsToday: number; updatedIocsToday: number;
    threatLandscape: { category: string; count: number }[];
    threatFeedsConfigured: number;
    recentActivity: { event_type: string; severity: string | null; summary: string; target: string; source: string | null; occurred_at: string | null; ref_type: string; ref_id: number }[];
}
export interface AttackOverview {
    techniquesObserved: number; tacticsObserved: number;
    mostCommonTechniques: { technique_id: string; name: string; tactic: string; tactics: string[]; count: number }[];
    recentMappings: { campaign_id: number; campaign_name: string; technique_id: string; technique_name: string; tactic: string; tactics: string[]; added_at: string | null }[];
    tacticCounts: { tactic: string; count: number }[];
}

async function intelligenceJson<T>(path: string, fallbackMessage = 'Request failed', init?: RequestInit): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
    const body = await intelligenceJson<{ data: IntelligenceOverview }>('/api/intelligence/overview', 'Failed to load intelligence overview');
    return body.data;
}

export async function getIocs(params: { q?: string; type?: string; risk?: string; confidence?: string; status?: string; source?: string; dateFrom?: string; dateTo?: string; sortBy?: string; sortDir?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: Ioc[]; total: number; page: number; pageSize: number }>(`/api/intelligence/iocs?${qs.toString()}`, 'Failed to load indicators');
}

export async function getIocSources(): Promise<string[]> {
    const body = await intelligenceJson<{ data: { sources: string[] } }>('/api/intelligence/ioc-sources', 'Failed to load IOC sources');
    return body.data.sources;
}

export async function getIoc(id: number): Promise<IocDetail> {
    const body = await intelligenceJson<{ data: { ioc: IocDetail } }>(`/api/intelligence/iocs/${id}`, 'Failed to load indicator');
    return body.data.ioc;
}

// ── IOC_PHASE1.md — IOC Analyzer: Analysis Foundation, Normalization,
// Context & Existing Intelligence. §2 "ANALYSIS layer, not a repository" —
// this is read-only orchestration; every action button below calls an
// EXISTING endpoint (Evidence/Notes/Investigations), never a new one.
export type IocAnalyzerType = 'auto' | 'ipv4' | 'ipv6' | 'domain' | 'url' | 'md5' | 'sha1' | 'sha256' | 'email' | 'username' | 'phone' | 'certificate' | 'file' | 'other' | 'cve';
export interface IocMispContext { status: 'not_configured' | 'no_match' | 'match' | 'unavailable' | 'not_applicable'; matches?: any[]; errorMessage?: string | null; }
export interface IocReputationContext { status: 'available' | 'not_configured'; reason?: string; threatIntel?: { reputation: string; phishing: string; malware: string; abuseConfidenceScore: number | null; totalReports: number | null }; blocklists?: Record<string, string>; }
export interface IocBrandContext { id: number; findingType: string; status: string; riskLevel: string | null; brandId: number; brandName: string; }
export interface IocMonitoringContext { status: 'configured' | 'not_configured'; reason?: string; monitorId?: number; monitorStatus?: string; lastChecked?: string | null; consecutiveFailures?: number; recentEvents?: { id: number; eventType: string; summary: string; severity: string; createdAt: string | null }[]; }
export interface IocEvidenceItem { id: number; source: string; url: string | null; description: string | null; confidence: string | null; username?: string | null; created_at: string | null; observed_at?: string | null; }
export interface IocCaseItem { id: number; case_number: string; title: string; status: string; updated_at: string | null; }
export interface IocNoteItem { id: string; title: string | null; contentPreview: string; noteType: string; createdBy: string | null; createdAt: string | null; }
export interface IocKnowledgeItem { id: number; title: string; slug?: string; reason?: string; [key: string]: any; }
export interface IocThreatBriefItem { id: number; title: string; report_type: string; status: string; published_at: string | null; created_at: string | null; }
export interface IocTimelineItem { action: string; previous_value: string | null; new_value: string | null; source: string; user_id: number | null; created_at: string | null; }

export interface IocAnalyzerResult {
    status: 'invalid' | 'unknown' | 'existing';
    input: string; type: IocAnalyzerType | null; normalized: string | null;
    reason?: string; note?: string;
    ioc?: IocDetail & { relationships: EntityRelationship[] };
    vulnerability?: any;
    risk?: string;
    relationships?: EntityRelationship[];
    misp?: IocMispContext; reputation?: IocReputationContext; brand?: IocBrandContext[];
    monitoring?: IocMonitoringContext;
    evidence?: IocEvidenceItem[]; cases?: IocCaseItem[]; notes?: IocNoteItem[]; knowledge?: IocKnowledgeItem[];
    threatBriefs?: IocThreatBriefItem[]; timeline?: IocTimelineItem[];
    age?: number | null; sources?: string[]; sourceCount?: number;
}
export async function analyzeIoc(input: string, type: IocAnalyzerType = 'auto'): Promise<IocAnalyzerResult> {
    const body = await intelligenceJson<{ data: IocAnalyzerResult }>('/api/ai/ioc-analyzer/analyze', 'Failed to analyze IOC', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, type }),
    });
    return body.data;
}

// ── IOC_PHASE2.md — Bulk IOC Analysis, Cross IOC Correlation, IOC
// Evolution & Operational Context.
export interface IocBulkJob {
    id: number; createdByUserId: number; status: 'queued' | 'validating' | 'normalizing' | 'analyzing' | 'correlating' | 'finalizing' | 'completed' | 'partial' | 'failed' | 'cancelled';
    inputCount: number; uniqueCount: number; progressCurrent: number; progressTotal: number; progressLabel: string | null;
    cancelRequested: boolean; summary: IocBulkSummary | null; lastError: string | null;
    createdAt: string | null; startedAt: string | null; completedAt: string | null;
}
export interface IocBulkSummary { unique: number; invalid: number; existing: number; new: number; mispMatches: number; }
export interface IocBulkItem {
    id: number; inputOrder: number; originalInputs: string[]; occurrenceCount: number;
    type: string | null; normalizedValue: string | null; validationStatus: 'valid' | 'invalid'; invalidReason: string | null;
    existingStatus: 'existing' | 'unknown' | null; iocId: number | null; vulnerabilityId: number | null;
    risk: string | null; mispStatus: string | null; hasEvidence: boolean; hasAlert: boolean; hasMonitor: boolean;
    firstSeenAt: string | null; lastSeenAt: string | null; itemStatus: 'pending' | 'completed' | 'failed'; errorMessage: string | null;
    result: IocAnalyzerResult | null;
}
export interface IocGroup { key: string; label: string; reason: string; confidence: 'High' | 'Medium' | 'Low'; memberCount: number; memberIds: number[]; types: string[]; sources: string[]; members: { id: number; type: string | null; value: string | null; risk: string | null }[]; }
export interface IocCoverage { existingIoc: number; noIocRecord: number; misp: number; evidence: number; campaign: number; malware: number; actor: number; }
export interface IocRiskDistribution { Critical: number; High: number; Medium: number; Low: number; Unknown: number; }
export interface IocAttentionItem { id: number; type: string | null; value: string | null; risk: string | null; reasons: string[]; }
export interface IocBulkResults {
    job: IocBulkJob; items: IocBulkItem[]; total: number; page: number; pageSize: number;
    summary: IocBulkSummary; groups: IocGroup[]; coverage: IocCoverage; riskDistribution: IocRiskDistribution;
    attention: IocAttentionItem[]; conflicts: any[];
}
export interface IocBulkSubmitResponse { jobId: number; inputCount: number; uniqueCount: number; sync: boolean; jobStatus?: string; outcome?: any; job?: IocBulkJob; items?: IocBulkItem[]; total?: number; page?: number; pageSize?: number; summary?: IocBulkSummary; groups?: IocGroup[]; coverage?: IocCoverage; riskDistribution?: IocRiskDistribution; attention?: IocAttentionItem[]; conflicts?: any[]; }

export async function submitIocBulkAnalysis(input: string): Promise<{ status: number; data: IocBulkSubmitResponse }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/ai/ioc-analyzer/bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok && res.status !== 202) throw new Error((body as any)?.message || 'Failed to start bulk analysis');
    return { status: res.status, data: (body as any).data };
}
export async function getIocBulkJob(jobId: number | string): Promise<IocBulkJob> {
    const body = await intelligenceJson<{ data: IocBulkJob }>(`/api/ai/ioc-analyzer/jobs/${jobId}`, 'Failed to load job status');
    return body.data;
}
export async function getIocBulkJobResults(jobId: number | string, params: { page?: number; pageSize?: number; q?: string; type?: string; risk?: string; status?: string; existing?: string; mispMatch?: string; hasEvidence?: string; hasAlert?: string; hasMonitor?: string; sortBy?: string; sortDir?: string } = {}): Promise<IocBulkResults> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: IocBulkResults }>(`/api/ai/ioc-analyzer/jobs/${jobId}/results${qs.toString() ? `?${qs}` : ''}`, 'Failed to load job results');
    return body.data;
}
export async function cancelIocBulkJob(jobId: number | string): Promise<{ cancelled: boolean; reason?: string }> {
    const body = await intelligenceJson<{ data: { cancelled: boolean; reason?: string } }>(`/api/ai/ioc-analyzer/jobs/${jobId}/cancel`, 'Failed to cancel job', { method: 'POST' });
    return body.data;
}
export async function getIocEvolution(entityType: string, entityId: number | string): Promise<{ entityType: string; entityId: string; events: { type: string; at: string; detail?: string; recent?: boolean }[]; mispChange: any }> {
    const body = await intelligenceJson<{ data: any }>(`/api/ai/ioc-analyzer/evolution/${entityType}/${entityId}`, 'Failed to load IOC evolution');
    return body.data;
}
export async function compareIocsApi(a: { type: string; value: string }, b: { type: string; value: string }): Promise<{ a: IocAnalyzerResult; b: IocAnalyzerResult; fields: { field: string; a: any; b: any }[]; shared: string[]; onlyA: string[]; onlyB: string[] }> {
    const qs = new URLSearchParams({ aType: a.type, aValue: a.value, bType: b.type, bValue: b.value });
    const body = await intelligenceJson<{ data: any }>(`/api/ai/ioc-analyzer/compare?${qs}`, 'Failed to compare indicators');
    return body.data;
}

// ── IOC_PHASE3.md — AI IOC Analyst, Advanced Correlation Explanation,
// Intelligence Assessment & Operational Support. Recommendations reuse the
// SAME generic `AiActionPreview`/`AiRecommendation`/`approveAiRecommendation`
// Threat Summary Phase 3 already defined below — one Action Preview →
// Approve → existing-API flow for the whole app, never a second one.
export interface IocAiSummary {
    assessment: string; keyFindings: string[]; supportingIntelligence?: string[]; importantGroups?: string[];
    majorChanges: string[]; conflicts: string[]; unknowns: string[]; recommendations: string[]; sources: string[];
    citations?: string[]; note: string;
}
export async function getIocAiStatus(): Promise<{ available: boolean }> {
    const body = await intelligenceJson<{ data: { available: boolean } }>('/api/ai/ioc-analyzer/ai-status', 'Failed to load AI status');
    return body.data;
}
export interface IocAiSummaryResponse {
    generatedAt: string; dataWindow: any; aiStatus: string; fallback: boolean;
    result: IocAnalyzerResult; summary: IocAiSummary; recommendations: AiRecommendation[];
}
export async function getIocAiSummary(input: string, type: IocAnalyzerType = 'auto'): Promise<IocAiSummaryResponse> {
    const body = await intelligenceJson<{ data: IocAiSummaryResponse }>('/api/ai/ioc-analyzer/ai-summary', 'Failed to generate IOC AI summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input, type }),
    });
    return body.data;
}
export interface IocBulkAiSummaryResponse {
    generatedAt: string; dataWindow: any; aiStatus: string; fallback: boolean;
    summary: IocAiSummary; recommendations: AiRecommendation[];
}
export async function getIocBulkAiSummary(jobId: number | string): Promise<IocBulkAiSummaryResponse> {
    const body = await intelligenceJson<{ data: IocBulkAiSummaryResponse }>(`/api/ai/ioc-analyzer/bulk/${jobId}/ai-summary`, 'Failed to generate bulk AI summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    });
    return body.data;
}
export interface IocForecast { status: 'ok' | 'insufficient_data'; direction: string; confidence: string; basis: string; language: string; note?: string; }
export async function getIocForecastApi(iocId: number | string): Promise<IocForecast> {
    const body = await intelligenceJson<{ data: IocForecast }>(`/api/ai/ioc-analyzer/forecast?iocId=${encodeURIComponent(String(iocId))}`, 'Failed to load forecast');
    return body.data;
}

// ── DARK_WEB_PHASE1.md — Dark Web Source Management, Observation
// Collection, Search, Normalization & Exposure Foundation. §2 "no live Tor
// crawling" — every function below is a plain CRUD/search call, never a
// browse/fetch of anything a source claims to point at.
export type DarkWebSourceType = 'onion_service' | 'forum' | 'marketplace' | 'paste_site' | 'channel' | 'leak_site' | 'threat_feed' | 'analyst_submission';
export type DarkWebSourceStatus = 'active' | 'inactive' | 'not_configured' | 'unavailable';
export type DarkWebCollectionMethod = 'analyst_submitted' | 'imported' | 'provider' | 'crawler';
export type DarkWebObservationStatus = 'unreviewed' | 'reviewed' | 'relevant' | 'irrelevant' | 'archived';

export interface DarkWebSource {
    id: number; name: string; type: DarkWebSourceType; address: string | null; description: string | null;
    status: DarkWebSourceStatus; tags: string[]; owner: string | null; createdByUserId: number;
    lastCheckedAt: string | null; observationCount: number; lastObservationAt: string | null;
    createdAt: string | null; updatedAt: string | null;
}
export interface DarkWebIocMention { id: number; rawType: string | null; iocType: string; value: string; iocId: number | null; vulnerabilityId: number | null; matchStatus: 'existing' | 'new_candidate'; }
export interface DarkWebEntityMention { id: number; entityType: string; entityId: string; mentionText: string; matchConfidence: 'exact' | 'possible'; claimType: 'mention' | 'claim'; label?: string; }
export interface DarkWebObservation {
    id: number; formattedId: string; sourceId: number; sourceName: string; sourceType: DarkWebSourceType;
    title: string | null; sourceReference: string | null; authorUsername: string | null; externalReference: string | null;
    observedAt: string | null; collectedAt: string | null; collectionMethod: DarkWebCollectionMethod;
    status: DarkWebObservationStatus; reviewReason: string | null; importSource: string | null; originalReference: string | null;
    snippet: string | null; iocs: DarkWebIocMention[]; entities: DarkWebEntityMention[]; createdAt: string | null;
}
export interface DarkWebMeta { sourceTypes: DarkWebSourceType[]; sourceStatuses: DarkWebSourceStatus[]; collectionMethods: DarkWebCollectionMethod[]; observationStatuses: DarkWebObservationStatus[]; }
export async function getDarkWebMeta(): Promise<DarkWebMeta> {
    const body = await intelligenceJson<{ data: DarkWebMeta }>('/api/osint/dark-web/meta', 'Failed to load Dark Web metadata');
    return body.data;
}
export interface DarkWebDashboard {
    sources: number; activeSources: number; observations: number; newObservations: number; iocMentions: number; entityMentions: number;
    recentObservations: { id: number; formattedId: string; title: string | null; sourceName: string; collectedAt: string | null }[];
    topSources: { id: number; name: string; type: DarkWebSourceType; observationCount: number }[];
    recentIocMentions: { value: string; iocType: string; matchStatus: string; count: number }[];
    collectionStatus: { provider: string; manualInput: string; importedData: string };
}
export async function getDarkWebDashboard(): Promise<DarkWebDashboard> {
    const body = await intelligenceJson<{ data: DarkWebDashboard }>('/api/osint/dark-web', 'Failed to load Dark Web Intelligence dashboard');
    return body.data;
}
export async function getDarkWebSources(params: { q?: string; type?: string; status?: string; page?: number; pageSize?: number } = {}): Promise<{ items: DarkWebSource[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: DarkWebSource[]; total: number; page: number; pageSize: number } }>(`/api/osint/dark-web/sources${qs.toString() ? `?${qs}` : ''}`, 'Failed to load Dark Web sources');
    return body.data;
}
export async function createDarkWebSource(payload: { name: string; type: DarkWebSourceType; address?: string; description?: string; status?: DarkWebSourceStatus; tags?: string[] }): Promise<{ id: number; name: string; type: DarkWebSourceType; status: DarkWebSourceStatus }> {
    const body = await intelligenceJson<{ data: { id: number; name: string; type: DarkWebSourceType; status: DarkWebSourceStatus } }>('/api/osint/dark-web/sources', 'Failed to create source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export interface DarkWebSourceDetail {
    source: DarkWebSource;
    recentObservations: { id: number; formattedId: string; title: string | null; status: DarkWebObservationStatus; collectionMethod: DarkWebCollectionMethod; observedAt: string | null }[];
    iocCount: number; entityCount: number;
    configurationStatus: { provider: string; manualInput: string; importedData: string };
}
export async function getDarkWebSourceDetail(id: number | string): Promise<DarkWebSourceDetail> {
    const body = await intelligenceJson<{ data: DarkWebSourceDetail }>(`/api/osint/dark-web/sources/${id}`, 'Failed to load source');
    return body.data;
}
export async function updateDarkWebSource(id: number | string, payload: { status?: DarkWebSourceStatus; description?: string; tags?: string[] }): Promise<{ updated: boolean }> {
    const body = await intelligenceJson<{ data: { updated: boolean } }>(`/api/osint/dark-web/sources/${id}`, 'Failed to update source', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function getDarkWebObservations(params: {
    q?: string; sourceId?: number | string; sourceType?: string; collectionMethod?: string; status?: string; dateFrom?: string; dateTo?: string; iocType?: string; entityType?: string;
    hasIoc?: string; hasMisp?: string; hasCredentialExposure?: string; hasTelegram?: string; hasBrand?: string; hasThreatActor?: string; hasMalware?: string; hasCampaign?: string; hasEvidence?: string; hasAlert?: string;
    // DARK_WEB_PHASE3.md §88/§89 — additive filters, all optional.
    monitored?: string; hasChange?: string; activitySurge?: string;
    sortBy?: string; sortDir?: string; page?: number; pageSize?: number;
} = {}): Promise<{ items: DarkWebObservation[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: DarkWebObservation[]; total: number; page: number; pageSize: number } }>(`/api/osint/dark-web/observations${qs.toString() ? `?${qs}` : ''}`, 'Failed to load observations');
    return body.data;
}
export async function createDarkWebObservation(payload: { sourceId: number; title?: string; sourceReference?: string; content: string; authorUsername?: string; externalReference?: string; observedAt?: string; notes?: string }): Promise<{ id: number; formattedId: string; duplicate: boolean }> {
    const body = await intelligenceJson<{ data: { id: number; formattedId: string; duplicate: boolean } }>('/api/osint/dark-web/observations', 'Failed to add observation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export interface DarkWebObservationDetail {
    observation: DarkWebObservation; content: string | null;
    source: { id: number; name: string; type: DarkWebSourceType; address: string | null; status: DarkWebSourceStatus };
    iocs: DarkWebIocMention[]; entities: DarkWebEntityMention[];
    evidence: any[]; cases: any[]; notes: any[]; knowledge: any[]; timeline: any[];
    mispConfigured: boolean;
}
export async function getDarkWebObservationDetail(id: number | string): Promise<DarkWebObservationDetail> {
    const body = await intelligenceJson<{ data: DarkWebObservationDetail }>(`/api/osint/dark-web/observations/${id}`, 'Failed to load observation');
    return body.data;
}
export async function reviewDarkWebObservation(id: number | string, payload: { status: DarkWebObservationStatus; reason?: string }): Promise<{ updated: boolean; status: DarkWebObservationStatus }> {
    const body = await intelligenceJson<{ data: { updated: boolean; status: DarkWebObservationStatus } }>(`/api/osint/dark-web/observations/${id}/review`, 'Failed to update observation', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export interface DarkWebMispCheckResult { status: string; results: (DarkWebIocMention & { misp: any })[]; }
export async function checkDarkWebObservationMisp(id: number | string): Promise<DarkWebMispCheckResult> {
    const body = await intelligenceJson<{ data: DarkWebMispCheckResult }>(`/api/osint/dark-web/observations/${id}/misp`, 'Failed to check MISP', { method: 'POST' });
    return body.data;
}
export interface DarkWebImportResult { status: 'complete' | 'partial' | 'failed'; total: number; imported: number; duplicates: number; invalid: number; errors: { row: number; reason: string }[]; }
export async function importDarkWebObservations(payload: { sourceId: number; format: 'json' | 'csv'; data: string; importSource?: string }): Promise<DarkWebImportResult> {
    const body = await intelligenceJson<{ data: DarkWebImportResult }>('/api/osint/dark-web/import', 'Failed to import observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function getDarkWebMentionsForIoc(iocId: number | string, params: { page?: number; pageSize?: number } = {}): Promise<{ items: DarkWebObservation[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: DarkWebObservation[]; total: number; page: number; pageSize: number } }>(`/api/osint/dark-web/observations/mentions/ioc/${iocId}${qs.toString() ? `?${qs}` : ''}`, 'Failed to load Dark Web mentions');
    return body.data;
}
export async function getDarkWebMentionsForEntity(entityType: string, entityId: number | string, params: { page?: number; pageSize?: number } = {}): Promise<{ items: DarkWebObservation[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: DarkWebObservation[]; total: number; page: number; pageSize: number } }>(`/api/osint/dark-web/observations/mentions/entity/${entityType}/${entityId}${qs.toString() ? `?${qs}` : ''}`, 'Failed to load Dark Web mentions');
    return body.data;
}

// ── DARK_WEB_PHASE2.md — Cross Source Correlation, IOC/Entity Exposure,
// MISP Enrichment, Historical Change Detection & Analyst Investigation.
export interface DarkWebIocCorrelation {
    id: number; kind: 'ioc' | 'vulnerability'; rawType: string | null; iocType: string; value: string; iocId: number | null; matchStatus?: 'existing' | 'new_candidate';
    vulnerability?: { id: number; cveId: string; severity: string } | null;
    darkWeb?: { occurrences: number; otherObservations: { id: number; formattedId: string; sourceId: number; sourceName: string; observedAt: string | null }[] };
    existingIoc?: { id: number; risk: string | null; confidence: string | null; status: string | null; firstSeenAt: string | null; lastSeenAt: string | null } | null;
    threatIntelligenceRelationshipCount?: number;
    misp?: { status: string; eventId?: string | null; attributeId?: string | null; firstSeen?: string | null; lastSeen?: string | null; checkedAt?: string };
    credentialLeak?: { status: string; exposureStatus?: string; totalExposures?: number | null; exposedDataTypes?: string[]; sources?: string[]; latestExposure?: string | null; checkedAt?: string } | null;
    telegram?: { status: string; occurrences?: number; investigationCount?: number };
    brand?: { matched: boolean; via: string; brandId: number; brandName: string; status: string | null; riskLevel: string | null } | null;
    sourceMatrix?: { darkWeb: boolean; misp: boolean; brand: boolean; telegram: boolean; threatIntelligence: boolean };
    sourceDiversityCount?: number; corroborated?: boolean;
    reappeared?: { isReappearance: boolean; gapDays: number } | null;
    newMispCorrelation?: boolean; newCredentialExposure?: boolean; distinctSourceCount?: number;
}
export interface DarkWebEntityCorrelation {
    id: number; entityType: string; entityId: string; mentionText: string; matchConfidence: 'exact' | 'possible'; claimType: 'mention' | 'claim';
    label: string; context: Record<string, any> | null; isNewMention: boolean;
}
export interface DarkWebConflict { id: number; conflictType: string; object: string; claimA: string; claimB: string; status: string; sourceCount: number; }
export interface DarkWebCorrelations {
    observationId: number; iocCorrelations: DarkWebIocCorrelation[]; entityCorrelations: DarkWebEntityCorrelation[]; conflicts: DarkWebConflict[];
    crossSourceSummary: { iocMatches: number; entityMatches: number; mispMatches: number; credentialLeakMatches: number; telegramMatches: number; brandMatches: number };
    exposureSummary: { darkWebObservations: number; credentialExposure: number; knownIoc: number; misp: number; brand: number; telegram: number; threatIntelligence: number; level: 'Low' | 'Medium' | 'High' };
    attention: { required: boolean; reasons: string[] };
}
export async function getDarkWebObservationCorrelations(observationId: number | string): Promise<DarkWebCorrelations> {
    const body = await intelligenceJson<{ data: DarkWebCorrelations }>(`/api/osint/dark-web/correlations/${observationId}`, 'Failed to load correlations');
    return body.data;
}
export interface DarkWebHistory { observationId: number; status: 'ok' | 'no_change' | 'insufficient_history'; changes: { type: string; value: string; detail: string }[]; }
export async function getDarkWebObservationHistory(observationId: number | string): Promise<DarkWebHistory> {
    const body = await intelligenceJson<{ data: DarkWebHistory }>(`/api/osint/dark-web/history/${observationId}`, 'Failed to load history');
    return body.data;
}
export interface DarkWebRelatedObservations { observationId: number; items: (DarkWebObservation & { reasons: string[] })[]; }
export async function getDarkWebRelatedObservations(observationId: number | string): Promise<DarkWebRelatedObservations> {
    const body = await intelligenceJson<{ data: DarkWebRelatedObservations }>(`/api/osint/dark-web/related/${observationId}`, 'Failed to load related observations');
    return body.data;
}
export interface DarkWebExposureSummary { iocType: string; value: string; darkWebObservations: number; misp: { status: string; eventId?: string | null; checkedAt?: string }; credentialLeak: { status: string; exposureStatus?: string; checkedAt?: string } | null; telegram: { status: string; occurrences?: number }; brand: { matched: boolean; brandId: number; brandName: string } | null; }
export async function getDarkWebExposureSummary(iocType: string, identifier: string): Promise<DarkWebExposureSummary> {
    const body = await intelligenceJson<{ data: DarkWebExposureSummary }>(`/api/osint/dark-web/exposure/${encodeURIComponent(identifier)}?type=${encodeURIComponent(iocType)}`, 'Failed to load exposure summary');
    return body.data;
}
export interface DarkWebCredentialLeakCheckResult { status: string; results: (DarkWebIocMention & { status: string; exposureStatus?: string; totalExposures?: number | null; exposedDataTypes?: string[]; sources?: string[]; latestExposure?: string | null; errorMessage?: string })[]; }
export async function checkDarkWebObservationCredentialLeak(observationId: number | string): Promise<DarkWebCredentialLeakCheckResult> {
    const body = await intelligenceJson<{ data: DarkWebCredentialLeakCheckResult }>(`/api/osint/dark-web/observations/${observationId}/credential-leak`, 'Failed to check Credential Leak', { method: 'POST' });
    return body.data;
}
export async function bulkReviewDarkWebObservations(observationIds: number[], status: DarkWebObservationStatus, reason?: string): Promise<{ updated: number; failed: number; total: number }> {
    const body = await intelligenceJson<{ data: { updated: number; failed: number; total: number } }>('/api/osint/dark-web/bulk-review', 'Failed to bulk review observations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observationIds, status, reason }) });
    return body.data;
}
export async function bulkAddDarkWebObservationsToCase(observationIds: number[], caseId: number | string): Promise<{ added: number; failed: number; total: number }> {
    const body = await intelligenceJson<{ data: { added: number; failed: number; total: number } }>('/api/osint/dark-web/add-to-case', 'Failed to add observations to case', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ observationIds, caseId }) });
    return body.data;
}
export function darkWebExportUrl(params: { observationIds?: number[]; format: 'csv' | 'json'; sourceId?: number; status?: string }): string {
    const qs = new URLSearchParams();
    if (params.observationIds?.length) qs.set('observationIds', params.observationIds.join(','));
    if (params.sourceId) qs.set('sourceId', String(params.sourceId));
    if (params.status) qs.set('status', params.status);
    qs.set('format', params.format);
    return `/api/osint/dark-web/export?${qs.toString()}`;
}

// ── DARK_WEB_PHASE3.md — Continuous Monitoring, Advanced Change Detection,
// Exposure Intelligence, AI Analysis & Analyst Alerting. §5 widens the
// EXISTING generic `monitors` architecture (getMonitors/updateMonitor/
// deleteMonitor/checkMonitorNow above are reused verbatim for [Check Now]/
// [Edit]/[Pause]/[Delete] — never a second monitor API). AI recommendations
// reuse the SAME generic `AiActionPreview`/`AiRecommendation`/
// `approveAiRecommendation` defined below (Threat Summary Phase 3) — one
// Action Preview → Approve → existing-API flow for the whole app.
export interface DarkWebMonitor {
    id: number; type: 'dark_web_source' | 'dark_web_ioc' | 'dark_web_entity'; target: string; targetLabel: string; label: string | null;
    status: 'active' | 'paused'; checkIntervalMinutes: number; lastCheckedAt: string | null; lastSuccessAt: string | null;
    consecutiveFailures: number; recentEvents: { id: number; eventType: string; summary: string; severity: string; createdAt: string | null }[];
    recentEventCount: number; highestSeverity: string; createdAt: string | null;
}
export async function getDarkWebMonitors(): Promise<{ items: DarkWebMonitor[] }> {
    const body = await intelligenceJson<{ data: { items: DarkWebMonitor[] } }>('/api/osint/dark-web/monitors', 'Failed to load Dark Web monitors');
    return body.data;
}
export async function createDarkWebMonitor(payload:
    | { kind: 'source'; sourceId: number; label?: string; checkIntervalMinutes?: number }
    | { kind: 'ioc'; value: string; label?: string; checkIntervalMinutes?: number }
    | { kind: 'entity'; entityType: string; entityId: string | number; label?: string; checkIntervalMinutes?: number }
): Promise<{ id: number }> {
    const body = await intelligenceJson<{ data: { id: number } }>('/api/osint/dark-web/monitors', 'Failed to create monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export interface DarkWebAttentionItem { id: number; monitorId: number; monitorType: string; target: string; eventType: string; summary: string; severity: string; createdAt: string | null; }
export async function getDarkWebAttention(): Promise<{ items: DarkWebAttentionItem[] }> {
    const body = await intelligenceJson<{ data: { items: DarkWebAttentionItem[] } }>('/api/osint/dark-web/attention', 'Failed to load analyst attention');
    return body.data;
}
export interface DarkWebActivityTrend { last24h: number; last7d: number; last30d: number; }
export interface DarkWebIocTrend { newIoc7d: number; repeatedIoc: number; mispMatches: number; credentialExposures: number; }
export interface DarkWebEntityTrend { newThreatActorMentions: number; newMalwareMentions: number; newCampaignMentions: number; newBrandMentions: number; }
export interface DarkWebTrends { activity: DarkWebActivityTrend; ioc: DarkWebIocTrend; entity: DarkWebEntityTrend; }
export async function getDarkWebTrends(): Promise<DarkWebTrends> {
    const body = await intelligenceJson<{ data: DarkWebTrends }>('/api/osint/dark-web/trends', 'Failed to load trends');
    return body.data;
}
export interface DarkWebSourceTrendData { current: number; previous: number; change: number; changePercent: number | null; }
export async function getDarkWebSourceTrend(sourceId: number | string): Promise<DarkWebSourceTrendData> {
    const body = await intelligenceJson<{ data: DarkWebSourceTrendData }>(`/api/osint/dark-web/sources/${sourceId}/trend`, 'Failed to load source trend');
    return body.data;
}
export async function getDarkWebAiStatus(): Promise<{ available: boolean }> {
    const body = await intelligenceJson<{ data: { available: boolean } }>('/api/osint/dark-web/ai-status', 'Failed to load AI status');
    return body.data;
}
export interface DarkWebObservationAiSummary {
    assessment: string; keyObservations: string[]; newExposure: string[]; correlations: string[];
    threatActorContext: string[]; malwareContext: string[]; campaignContext: string[]; misp: string[]; credentialExposure: string[];
    conflicts: string[]; unknowns: string[]; recommendations: string[]; sources: string[]; citations?: string[]; note: string;
}
export async function getDarkWebObservationAiSummary(observationId: number | string): Promise<{ generatedAt: string; dataAsOf: string | null; aiStatus: string; fallback: boolean; summary: DarkWebObservationAiSummary; recommendations: AiRecommendation[] }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; dataAsOf: string | null; aiStatus: string; fallback: boolean; summary: DarkWebObservationAiSummary; recommendations: AiRecommendation[] } }>(`/api/osint/dark-web/observations/${observationId}/ai-summary`, 'Failed to generate AI summary', { method: 'POST' });
    return body.data;
}
export interface DarkWebSourceAiSummary { assessment: string; newIocs: string[]; newEntities: string[]; activityTrend: string[]; correlations: string[]; recommendations: string[]; sources: string[]; citations?: string[]; note: string; }
export async function getDarkWebSourceAiSummary(sourceId: number | string): Promise<{ generatedAt: string; aiStatus: string; fallback: boolean; summary: DarkWebSourceAiSummary }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; aiStatus: string; fallback: boolean; summary: DarkWebSourceAiSummary } }>(`/api/osint/dark-web/sources/${sourceId}/ai-summary`, 'Failed to generate source AI summary', { method: 'POST' });
    return body.data;
}
export interface DarkWebDashboardAiSummary {
    executiveSummary: string; keyObservations: string[]; newExposure: string[]; correlations: string[];
    threatActorContext: string[]; malwareContext: string[]; campaignContext: string[]; misp: string[]; credentialExposure: string[];
    conflicts: string[]; unknowns: string[]; recommendations: string[]; sources: string[]; citations?: string[]; note: string;
}
export async function getDarkWebDashboardAiSummary(): Promise<{ generatedAt: string; aiStatus: string; fallback: boolean; summary: DarkWebDashboardAiSummary }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; aiStatus: string; fallback: boolean; summary: DarkWebDashboardAiSummary } }>('/api/osint/dark-web/ai-summary', 'Failed to generate Dark Web Intelligence Assessment', { method: 'POST' });
    return body.data;
}
// §51/§52 — factual (non-LLM) restatements of Phase 2's own exposure data;
// deliberately do NOT duplicate IOC Analyzer's or the entity page's own analysis.
export async function getDarkWebIocContext(iocType: string, value: string): Promise<DarkWebExposureSummary> {
    const body = await intelligenceJson<{ data: DarkWebExposureSummary }>(`/api/osint/dark-web/context/ioc?type=${encodeURIComponent(iocType)}&value=${encodeURIComponent(value)}`, 'Failed to load Dark Web context');
    return body.data;
}
export interface DarkWebEntityContext { entityType: string; entityId: string; mentionCount: number; recentMentions: any[]; }
export async function getDarkWebEntityContext(entityType: string, entityId: string | number): Promise<DarkWebEntityContext> {
    const body = await intelligenceJson<{ data: DarkWebEntityContext }>(`/api/osint/dark-web/context/entity/${entityType}/${entityId}`, 'Failed to load Dark Web context');
    return body.data;
}
// §66-68 FORECAST — deterministic; never predicts a specific future event.
export interface DarkWebForecast { status: 'ok' | 'insufficient_data'; direction: string; confidence: string; basis: string; language: string; note?: string; }
export async function getDarkWebSourceForecast(sourceId: number | string): Promise<DarkWebForecast> {
    const body = await intelligenceJson<{ data: DarkWebForecast }>(`/api/osint/dark-web/sources/${sourceId}/forecast`, 'Failed to load forecast');
    return body.data;
}

// ── CREDENTIAL_LEAK_PHASE1.md — Paranoid Lab Domain Watchlist Integration.
// §5/§62 — the Watchlist Domain is the EXISTING Target Management `Target`
// (type='domain'; see the `Target` interface below) — this module never
// defines a second domain entity, it only adds Credential-Leak-specific
// state/counts on top of it.
export type CredentialLeakProviderStatusValue = 'available' | 'unavailable' | 'not_configured' | 'auth_error' | 'rate_limited';
export interface CredentialLeakProviderStatus { status: CredentialLeakProviderStatusValue; detail: string | null; }
export async function getCredentialLeakProviderStatus(): Promise<CredentialLeakProviderStatus> {
    const body = await intelligenceJson<{ data: CredentialLeakProviderStatus }>('/api/osint/credential-leak/provider-status', 'Failed to check Paranoid Lab status');
    return body.data;
}

export interface CredentialLeakDomainState {
    paranoidlabTargetId: number | null; isVerified: boolean; verifyToken: string | null;
    lastCheckedAt: string | null; lastCheckStatus: CredentialLeakProviderStatusValue | null;
    lastRequestId: number | null; lastRequestStatus: 'pending' | 'running' | 'completed' | 'error' | null; lastError: string | null;
}
// CREDENTIAL_LEAK_PHASE3.md §7/§64/CASE 26 — 'stale' added: a monitor whose
// Watchlist Domain was removed (the existing generic reference_status
// convention), surfaced honestly instead of being left as a misleading
// 'healthy'/'error'.
export type CredentialLeakMonitorStatus = 'not_monitored' | 'healthy' | 'paused' | 'error' | 'stale';
export interface WatchlistDomain extends Target {
    credentialLeak: {
        state: CredentialLeakDomainState | null;
        exposureCount: number; newExposureCount: number; highPriorityCount: number;
        passwordCount: number; cookieCount: number; piiCount: number; autofillCount: number; stealerCount: number; accountCount: number;
        monitorStatus: CredentialLeakMonitorStatus; lastCheckedAt: string | null;
    };
}
export async function getWatchlistDomains(params: { q?: string; page?: number; pageSize?: number } = {}): Promise<{ items: WatchlistDomain[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: WatchlistDomain[]; total: number; page: number; pageSize: number } }>(`/api/osint/credential-leak/domains${qs.toString() ? `?${qs}` : ''}`, 'Failed to load Watchlist Domains');
    return body.data;
}
export interface WatchlistDomainDetail {
    domain: { id: number; value: string; normalizedValue: string; status: string; createdAt: string | null };
    monitoringStatus: 'not_registered' | 'pending_verification' | 'verified';
    state: CredentialLeakDomainState | null;
    // CREDENTIAL_LEAK_PHASE2.md §43 DOMAIN MONITOR CARD — the domain's own
    // Credential Leak monitor (the EXISTING generic `monitors` row), if one
    // exists; [Check Now]/[Pause]/[Edit]/[Delete] target monitor.id via the
    // existing generic /api/monitoring/monitors/:id* routes.
    // CREDENTIAL_LEAK_PHASE3.md §119 — per-category backfill progress. A
    // check ingests a bounded slice and resumes from where it stopped, so a
    // domain with tens of thousands of provider records fills in over
    // successive checks; this reports how far along that is, honestly.
    monitor: {
        id: number; status: 'active' | 'paused'; checkIntervalMinutes: number;
        lastCheckedAt: string | null; nextCheckAt: string | null;
        consecutiveFailures: number; lastError: string | null;
        backfill: ({
            inProgress: boolean;
        } & Record<'password' | 'cookie' | 'autofill', { ingested: number; providerTotal: number | null; nextOffset: number; sweepComplete: boolean } | null>) | null;
    } | null;
    exposureCount: number; newExposureCount: number; highPriorityCount: number;
    passwordCount: number; cookieCount: number; piiCount: number; autofillCount: number; stealerCount: number; accountCount: number;
    recentExposures: CredentialExposure[];
    historicalChanges: { id: number; action: string; oldValue: string | null; newValue: string | null; username: string | null; createdAt: string | null }[];
    brandContext: { matched: boolean; via: string; brandId: number; brandName: string; status: string | null; riskLevel: string | null } | null;
}
export async function getWatchlistDomainDetail(id: number | string): Promise<WatchlistDomainDetail> {
    const body = await intelligenceJson<{ data: WatchlistDomainDetail }>(`/api/osint/credential-leak/domains/${id}`, 'Failed to load domain');
    return body.data;
}
// §34 CHECK NOW — see the backend's own orchestration comment
// (database/credentialLeakStorage.js) for the full 7-step flow this triggers.
// CREDENTIAL_LEAK_PHASE3.md §60 — the manual check now runs through the
// EXISTING monitoring architecture (checkMonitorNow), so the response is the
// monitor's own result, not a second provider flow's. The old /v1 fields
// (requestId/requestStatus/totalScanned, and the `_token` DNS verification
// payload) are gone with the retired /v1 path; p3 domain verification is
// surfaced through the monitor's own lastError instead.
export interface CredentialLeakCheckResult {
    providerStatus: CredentialLeakProviderStatusValue; detail?: string; checked: boolean;
    needsMonitor?: boolean; monitorId?: number; newCount?: number;
    events?: { event_type?: string; summary?: string; severity?: string }[];
    error?: string | null;
}
export async function checkWatchlistDomainNow(id: number | string): Promise<CredentialLeakCheckResult> {
    const body = await intelligenceJson<{ data: CredentialLeakCheckResult }>(`/api/osint/credential-leak/domains/${id}/check`, 'Failed to check domain', { method: 'POST' });
    return body.data;
}

// CREDENTIAL_LEAK_PHASE2.md §16/§21/§47 — 'autofill' (the External API's
// own category, distinct from Phase 1's /v1-sourced 'pii') and 'dormant'
// (a record absent from the provider's current set without being
// explicitly resolved, §49) are real, additive states.
export type CredentialExposureType = 'password' | 'cookie' | 'pii' | 'autofill';
export type CredentialExposureSource = 'malware' | 'combo';
export type CredentialExposureStatus = 'new' | 'known' | 'resolved' | 'dormant';
export interface CredentialExposure {
    id: number; formattedId: string; targetId: number; provider: string; providerRecordId: string | null;
    exposureType: CredentialExposureType; source: CredentialExposureSource;
    exposedIdentifier: string | null; exposedUrl: string | null; hasPassword: boolean; hasCookie: boolean;
    riskLevel: 'low' | 'medium' | 'high' | 'critical' | null; riskScore: number | null;
    occurredAt: string | null; uploadedAt: string | null; status: CredentialExposureStatus;
    firstSeenAt: string | null; lastSeenAt: string | null; domainValue?: string;
}
export async function getCredentialExposures(params: {
    domainId?: number | string; exposureType?: string; source?: string; riskLevel?: string; status?: string;
    dateFrom?: string; dateTo?: string; q?: string; sortBy?: string; page?: number; pageSize?: number;
    // CREDENTIAL_LEAK_PHASE3.md §101/§102 — `user` is the dedicated account
    // filter; the three has* flags were already supported by the storage
    // layer but were being dropped by the route until Phase 3 wired them.
    user?: string; hasIoc?: string; hasEvidence?: string; hasAlert?: string;
} = {}): Promise<{ items: CredentialExposure[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: CredentialExposure[]; total: number; page: number; pageSize: number } }>(`/api/osint/credential-leak/exposures${qs.toString() ? `?${qs}` : ''}`, 'Failed to load exposures');
    return body.data;
}
export interface CredentialExposureDetail {
    exposure: CredentialExposure;
    relatedIoc: { id: number; type: string; value: string; risk: string | null; confidence: string | null; status: string | null } | null;
    brandContext: { matched: boolean; via: string; brandId: number; brandName: string; status: string | null; riskLevel: string | null } | null;
    // CREDENTIAL_LEAK_PHASE2.md §40 — real, already-recorded Threat Actor/
    // Malware/Campaign relationships on the matched IOC, never inferred.
    threatIntelligence: { id: number; direction: 'outgoing' | 'incoming'; relationship_type: string; entity: { type: string; id: string; label: string } }[];
    evidence: { id: number; source: string; url: string | null; description: string | null; confidence: string | null; username: string | null; createdAt: string | null }[];
    cases: { id: number; caseNumber: string; title: string; status: string }[];
    notes: { id: number; title: string | null; contentPreview: string; createdBy: string | null; createdAt: string | null }[];
    timeline: { id: number; action: string; previousValue: string | null; newValue: string | null; source: string; createdAt: string | null }[];
}
export async function getCredentialExposureDetail(id: number | string): Promise<CredentialExposureDetail> {
    const body = await intelligenceJson<{ data: CredentialExposureDetail }>(`/api/osint/credential-leak/exposures/${id}`, 'Failed to load exposure');
    return body.data;
}
export async function reviewCredentialExposure(id: number | string, status: 'known' | 'resolved'): Promise<{ updated: boolean; status: string }> {
    const body = await intelligenceJson<{ data: { updated: boolean; status: string } }>(`/api/osint/credential-leak/exposures/${id}/review`, 'Failed to update exposure', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    return body.data;
}
// §65/§105 EXPORT — never Password/Cookie/Token/API Key/Secret. Accepts the
// same filter set the list view uses so Export always matches what the
// analyst is currently looking at.
export function credentialLeakExportUrl(params: {
    domainId?: number | string; format: 'csv' | 'json'; exposureType?: string; status?: string;
    source?: string; riskLevel?: string; q?: string; user?: string; dateFrom?: string; dateTo?: string;
    hasIoc?: string; hasEvidence?: string; hasAlert?: string;
}): string {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (k === 'format') return;
        if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    qs.set('format', params.format);
    return `/api/osint/credential-leak/export?${qs.toString()}`;
}

// ── CREDENTIAL_LEAK_PHASE2.md — Paranoid Lab Domain Monitoring, Baselines,
// Exposure Change Detection, Alerting, History & Operational Integration.
// §57/§81 — [Check Now]/[Pause]/[Resume]/[Delete] all reuse the EXISTING
// generic checkMonitorNow/updateMonitor/deleteMonitor functions already
// defined above (see the Monitoring section of this file) — only monitor
// CREATION needs its own wrapper (ownership + duplicate-prevention).
export interface CredentialLeakMonitorSummary {
    id: number; targetId: number; domainValue: string; domainStatus: string | null;
    status: 'active' | 'paused' | 'stale'; referenceStatus?: 'valid' | 'stale_reference'; checkIntervalMinutes: number; lastCheckedAt: string | null; nextCheckAt: string | null;
    exposureCount: number; newExposureCount: number;
    lastEvent: { eventType: string; summary: string; severity: string; createdAt: string } | null;
    consecutiveFailures: number; lastError: string | null;
}
export async function createCredentialLeakDomainMonitor(domainId: number | string, payload: { label?: string; checkIntervalMinutes?: number } = {}): Promise<{ id: number }> {
    const body = await intelligenceJson<{ data: { id: number } }>(`/api/osint/credential-leak/domains/${domainId}/monitor`, 'Failed to create monitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function getCredentialLeakMonitors(): Promise<{ items: CredentialLeakMonitorSummary[] }> {
    const body = await intelligenceJson<{ data: { items: CredentialLeakMonitorSummary[] } }>('/api/osint/credential-leak/monitors', 'Failed to load monitors');
    return body.data;
}
// CREDENTIAL_LEAK_PHASE3.md §3-9/§63/CASE 1/CASE 27 AUTOMATIC WATCHLIST SYNC
// — analyst-controlled "Enable Monitoring for All" (never contacts
// ParanoidLab itself; only enrolls domains into the existing scheduler).
export interface CredentialLeakSyncResult {
    discovered: number; created: number; alreadyMonitored: number;
    items: { targetId: number; domain: string; status: 'created' | 'already_monitored' | 'error'; monitorId?: number; error?: string }[];
}
export async function syncCredentialLeakWatchlistMonitors(): Promise<CredentialLeakSyncResult> {
    const body = await intelligenceJson<{ data: CredentialLeakSyncResult }>('/api/osint/credential-leak/watchlist/sync', 'Failed to sync Watchlist Domains', { method: 'POST' });
    return body.data;
}
// §45/§34 EXPOSURE TREND — 24h/7d/30d/90d, real persisted checks only.
export interface CredentialLeakExposureTrend { last24h: number; last7d: number; last30d: number; last90d: number; }
export async function getCredentialExposureTrend(domainId: number | string): Promise<CredentialLeakExposureTrend> {
    const body = await intelligenceJson<{ data: CredentialLeakExposureTrend }>(`/api/osint/credential-leak/domains/${domainId}/trend`, 'Failed to load trend');
    return body.data;
}
// §46 NEW EXPOSURE TREND — Date / New Records / Exposure Type. Volume only
// — never interpreted as attack activity.
export async function getNewExposureTrend(domainId: number | string): Promise<{ items: { date: string; exposureType: CredentialExposureType; newRecords: number }[] }> {
    const body = await intelligenceJson<{ data: { items: { date: string; exposureType: CredentialExposureType; newRecords: number }[] } }>(`/api/osint/credential-leak/domains/${domainId}/new-exposure-trend`, 'Failed to load new exposure trend');
    return body.data;
}
// §38 TOP EXPOSED ACCOUNTS — metadata only, never a password/cookie/token value.
export interface CredentialLeakTopAccount { identifier: string; exposureTypes: string[]; recordCount: number; lastSeenAt: string | null; }
export async function getTopExposedAccounts(domainId: number | string, limit = 10): Promise<{ items: CredentialLeakTopAccount[] }> {
    const body = await intelligenceJson<{ data: { items: CredentialLeakTopAccount[] } }>(`/api/osint/credential-leak/domains/${domainId}/top-accounts?limit=${limit}`, 'Failed to load top exposed accounts');
    return body.data;
}
// §49/CASE 17 MISP — on demand only.
export interface CredentialLeakMispResult { status: 'match' | 'no_match' | 'not_configured' | 'unavailable'; matches?: { mispEventId?: string | number; mispAttributeId?: string | number; firstSeen?: string | null; lastSeen?: string | null }[]; errorMessage?: string; }
export async function checkMispForWatchlistDomain(domainId: number | string): Promise<CredentialLeakMispResult> {
    const body = await intelligenceJson<{ data: CredentialLeakMispResult }>(`/api/osint/credential-leak/domains/${domainId}/misp`, 'Failed to check MISP');
    return body.data;
}
// §75 AI DOMAIN COMPARISON — deterministic, factual side-by-side.
export interface CredentialLeakDomainComparisonSide {
    id: number; value: string; exposureCount: number; newExposureCount: number; highPriorityCount: number;
    passwordCount: number; cookieCount: number; autofillCount: number; stealerCount: number; accountCount: number;
    monitorStatus: CredentialLeakMonitorStatus; lastCheckedAt: string | null;
}
export async function compareWatchlistDomains(domainIdA: number | string, domainIdB: number | string): Promise<{ domainA: CredentialLeakDomainComparisonSide; domainB: CredentialLeakDomainComparisonSide }> {
    const body = await intelligenceJson<{ data: { domainA: CredentialLeakDomainComparisonSide; domainB: CredentialLeakDomainComparisonSide } }>(`/api/osint/credential-leak/compare?a=${domainIdA}&b=${domainIdB}`, 'Failed to compare domains');
    return body.data;
}
// §61/§100/§123 COMPANY OVERVIEW & MONITORING SUMMARY — real, summed totals across every accessible domain.
export interface CredentialLeakCompanyOverview {
    domainCount: number; totalExposure: number; newExposure: number; highPriority: number;
    passwordExposures: number; cookieExposures: number; autofillExposures: number; stealerRecords: number;
    monitoredCount: number; healthyCount: number; errorCount: number; pausedCount: number;
    domains: { id: number; value: string; exposureCount: number; newExposureCount: number; highPriorityCount: number; lastCheckedAt: string | null; monitorStatus: CredentialLeakMonitorStatus; passwordCount: number; cookieCount: number; autofillCount: number; stealerCount: number }[];
}
export async function getCredentialLeakCompanyOverview(): Promise<CredentialLeakCompanyOverview> {
    const body = await intelligenceJson<{ data: CredentialLeakCompanyOverview }>('/api/osint/credential-leak/overview', 'Failed to load company overview');
    return body.data;
}
// §35 BULK CASE ACTION — reuses the existing Investigation API per selected exposure.
export async function bulkAddCredentialExposuresToCase(exposureIds: number[], caseId: number | string): Promise<{ added: number; failed: number; total: number }> {
    const body = await intelligenceJson<{ data: { added: number; failed: number; total: number } }>('/api/osint/credential-leak/bulk-add-to-case', 'Failed to add to case', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ exposureIds, caseId }) });
    return body.data;
}

// ── CREDENTIAL_LEAK_PHASE3.md §71-96 AI CREDENTIAL ANALYST — mirrors the
// Dark Web AI Analyst's own api.ts shape exactly (see getDarkWebObservationAiSummary et al.).
export interface CredentialLeakAiRecommendation {
    id: string; type: string; label: string; reason: string; source: string[]; priority: 'Low' | 'Medium' | 'High';
    stateChanging: boolean; actionPreview: { method: string; endpoint: string; permission: string | null; payload: Record<string, unknown> } | null;
}
export interface CredentialLeakAiDomainSummary {
    assessment: string; keyObservations: string[]; whatChanged: string[]; trend: string[]; misp: string[]; brand: string[];
    unknowns: string[]; recommendations: string[]; sources: string[]; citations: string[]; note: string;
}
export async function getCredentialLeakAiStatus(): Promise<{ available: boolean }> {
    const body = await intelligenceJson<{ data: { available: boolean } }>('/api/osint/credential-leak/ai-status', 'Failed to check AI status');
    return body.data;
}
export async function getCredentialLeakDomainAiSummary(domainId: number | string): Promise<{ generatedAt: string; dataAsOf: string | null; aiStatus: 'Available' | 'Unavailable'; fallback: boolean; summary: CredentialLeakAiDomainSummary; recommendations: CredentialLeakAiRecommendation[] }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; dataAsOf: string | null; aiStatus: 'Available' | 'Unavailable'; fallback: boolean; summary: CredentialLeakAiDomainSummary; recommendations: CredentialLeakAiRecommendation[] } }>(`/api/osint/credential-leak/domains/${domainId}/ai-summary`, 'Failed to generate AI summary', { method: 'POST' });
    return body.data;
}
export interface CredentialLeakForecast { status: 'ok' | 'insufficient_data'; direction: string; confidence: string; basis: string; language: string; note: string; }
export async function getCredentialLeakDomainForecast(domainId: number | string): Promise<CredentialLeakForecast> {
    const body = await intelligenceJson<{ data: CredentialLeakForecast }>(`/api/osint/credential-leak/domains/${domainId}/forecast`, 'Failed to load forecast');
    return body.data;
}
export interface CredentialLeakAiDashboardSummary {
    executiveSummary: string; keyObservations: string[]; newExposure: string[]; unknowns: string[]; recommendations: string[]; sources: string[]; citations: string[]; note: string;
}
export async function getCredentialLeakDashboardAiSummary(): Promise<{ generatedAt: string; aiStatus: 'Available' | 'Unavailable'; fallback: boolean; summary: CredentialLeakAiDashboardSummary }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; aiStatus: 'Available' | 'Unavailable'; fallback: boolean; summary: CredentialLeakAiDashboardSummary } }>('/api/osint/credential-leak/ai-summary', 'Failed to generate AI summary', { method: 'POST' });
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT_GENERATOR_PHASE1.md — Report Foundation, Templates, Intelligence
// Selection, Structured Composition, Preview, Draft & Export. Distinct from
// Threat Briefs (`getThreatBriefs`/`createThreatBrief` elsewhere in this
// file) — §36 "Threat Brief and Report are distinct... do not silently
// merge their records".
// ═══════════════════════════════════════════════════════════════════════
export type ReportGeneratorStatus = 'draft' | 'ready' | 'published' | 'archived';
export type ReportGeneratorClassification = 'Unclassified' | 'Internal' | 'Confidential' | 'Restricted';
export type ReportGeneratorItemType = 'ioc' | 'campaign' | 'threat_actor' | 'malware' | 'vulnerability' | 'brand' | 'company' | 'case' | 'dark_web_observation' | 'credential_exposure' | 'social_investigation' | 'evidence' | 'timeline_event' | 'attack_technique';
// REPORT_GENERATOR_PHASE2.md §4 — the subset of ReportGeneratorItemType with a real, searchable list endpoint behind it.
export type ReportGeneratorSearchableType = 'ioc' | 'threat_actor' | 'malware' | 'campaign' | 'vulnerability' | 'brand' | 'company' | 'case' | 'dark_web_observation' | 'credential_exposure' | 'social_investigation';

export interface ReportGeneratorTemplatesResponse {
    reportTypes: string[];
    templates: Record<string, { key: string; sections: string[] }>;
    sectionLabels: Record<string, string>;
}
export async function getReportGeneratorTemplates(): Promise<ReportGeneratorTemplatesResponse> {
    const body = await intelligenceJson<{ data: ReportGeneratorTemplatesResponse }>('/api/report-generator/templates', 'Failed to load report templates');
    return body.data;
}

export interface ReportGeneratorDashboard {
    total: number; drafts: number; ready: number; published: number; archived: number;
    recent: { id: number; title: string; reportType: string; status: ReportGeneratorStatus; updatedAt: string | null }[];
}
export async function getReportGeneratorDashboard(): Promise<ReportGeneratorDashboard> {
    const body = await intelligenceJson<{ data: ReportGeneratorDashboard }>('/api/report-generator/dashboard', 'Failed to load dashboard');
    return body.data;
}

export interface ReportGeneratorSectionConfig { key: string; enabled: boolean; }
export interface ReportGeneratorSelectionRef { itemType: ReportGeneratorItemType; itemId: string; role: 'primary' | 'related'; section: string | null; addedAt: string | null; }
export interface ReportGeneratorNarrative { introduction: string; executiveSummary: string; keyFindingsNarrative: string; recommendations: string; conclusion: string; }
export interface ReportGeneratorReport {
    id: number; title: string; reportType: string; templateKey: string; classification: ReportGeneratorClassification;
    description: string | null; status: ReportGeneratorStatus;
    primaryScope: { type: string; id: string } | null; caseId: number | null;
    sections: ReportGeneratorSectionConfig[]; narrative: ReportGeneratorNarrative;
    lastComposedAt: string | null; createdByUserId: number; updatedByUserId: number | null;
    publishedByUserId: number | null; publishedAt: string | null; archivedAt: string | null;
    createdAt: string | null; updatedAt: string | null;
    authorUsername?: string | null; selectionCount?: number;
}
export interface ReportGeneratorReportDetail extends ReportGeneratorReport { selections: ReportGeneratorSelectionRef[]; }

export async function getReportGeneratorReports(params: {
    q?: string; reportType?: string; status?: ReportGeneratorStatus; caseId?: number | string; author?: string;
    dateFrom?: string; dateTo?: string; primaryScopeType?: string; page?: number; pageSize?: number;
} = {}): Promise<{ items: ReportGeneratorReport[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ReportGeneratorReport[]; total: number; page: number; pageSize: number } }>(`/api/report-generator/reports${qs.toString() ? `?${qs}` : ''}`, 'Failed to load reports');
    return body.data;
}
export async function createReportGeneratorReport(payload: {
    title: string; reportType: string; classification?: ReportGeneratorClassification; description?: string;
    primaryScope?: { type: ReportGeneratorItemType; id: string | number }; caseId?: number;
}): Promise<{ id: number; duplicateTitle: boolean }> {
    const body = await intelligenceJson<{ data: { id: number; duplicateTitle: boolean } }>('/api/report-generator/reports', 'Failed to create report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function getReportGeneratorReport(id: number | string): Promise<ReportGeneratorReportDetail> {
    const body = await intelligenceJson<{ data: ReportGeneratorReportDetail }>(`/api/report-generator/reports/${id}`, 'Failed to load report');
    return body.data;
}
export async function updateReportGeneratorReport(id: number | string, patch: Partial<{
    title: string; description: string; classification: ReportGeneratorClassification;
    introduction: string; executiveSummary: string; keyFindingsNarrative: string; recommendations: string; conclusion: string;
    sections: ReportGeneratorSectionConfig[];
}>): Promise<{ updated: boolean }> {
    const body = await intelligenceJson<{ data: { updated: boolean } }>(`/api/report-generator/reports/${id}`, 'Failed to update report', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    return body.data;
}
export async function setReportGeneratorStatus(id: number | string, status: ReportGeneratorStatus): Promise<{ status: ReportGeneratorStatus }> {
    const body = await intelligenceJson<{ data: { status: ReportGeneratorStatus } }>(`/api/report-generator/reports/${id}/status`, 'Failed to update status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    return body.data;
}
export async function deleteReportGeneratorReport(id: number | string): Promise<{ deleted: boolean }> {
    const body = await intelligenceJson<{ data: { deleted: boolean } }>(`/api/report-generator/reports/${id}`, 'Failed to delete report', { method: 'DELETE' });
    return body.data;
}
export async function duplicateReportGeneratorReport(id: number | string): Promise<{ id: number }> {
    const body = await intelligenceJson<{ data: { id: number } }>(`/api/report-generator/reports/${id}/duplicate`, 'Failed to duplicate report', { method: 'POST' });
    return body.data;
}
export async function addReportGeneratorSelection(id: number | string, payload: { itemType: ReportGeneratorItemType; itemId: string | number; role?: 'primary' | 'related'; section?: string }): Promise<{ added: boolean }> {
    const body = await intelligenceJson<{ data: { added: boolean } }>(`/api/report-generator/reports/${id}/selections`, 'Failed to add selection', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function removeReportGeneratorSelection(id: number | string, itemType: ReportGeneratorItemType, itemId: string | number): Promise<{ removed: boolean }> {
    const body = await intelligenceJson<{ data: { removed: boolean } }>(`/api/report-generator/reports/${id}/selections?itemType=${encodeURIComponent(itemType)}&itemId=${encodeURIComponent(String(itemId))}`, 'Failed to remove selection', { method: 'DELETE' });
    return body.data;
}

// §77/§78 REPORT CONTEXT — the composed, RBAC-revalidated, bounded data
// behind every section (never trusted from selection labels alone).
export interface ReportGeneratorContext {
    report: ReportGeneratorReportDetail extends infer R ? Omit<R, 'selections'> : never;
    scope: { type: string; id: string; role: 'primary' | 'related'; label: string }[];
    sections: {
        iocs: any[]; threatActors: any[]; malware: any[]; campaigns: any[]; vulnerabilities: any[]; attack: any[];
        attackByTactic: { tactic: string; techniques: any[] }[];
        evidence: any[]; timeline: any[]; risk: any[]; brand: any[]; darkWeb: any[]; credentialLeak: any[];
        misp: { status: string; matches: any[] }; case: any | null;
    };
    sources: { type: string; id: string | number }[];
    dataAsOf: string | null;
}
export async function getReportGeneratorContext(id: number | string): Promise<ReportGeneratorContext> {
    const body = await intelligenceJson<{ data: ReportGeneratorContext }>(`/api/report-generator/reports/${id}/context`, 'Failed to load report context');
    return body.data;
}

// REPORT_GENERATOR_PHASE2.md §31-§35 / §41-§43 — real counts and a
// structural completeness percentage, explicitly NOT a threat score.
export interface ReportGeneratorCorrelationSummary {
    totalEntities: number; primaryEntities: number; relatedEntities: number;
    iocCount: number; threatActorCount: number; malwareCount: number; campaignCount: number; vulnerabilityCount: number;
    attackTechniqueCount: number; evidenceCount: number; timelineEventCount: number; mispMatchCount: number; sourceCount: number;
}
export interface ReportGeneratorCompleteness {
    percent: number; label: string;
    checklist: { key: string; label: string; pass: boolean }[];
}
export interface ReportGeneratorConflict { id: number; conflictType: string; object: string; claimA: string; claimB: string; status: string; }

export interface ReportGeneratorPreview {
    header: { title: string; reportType: string; classification: ReportGeneratorClassification; generatedAt: string; dataAsOf: string | null };
    metadata: { status: ReportGeneratorStatus; primaryScope: { type: string; id: string; label: string } | null; caseId: number | null };
    sections: { key: string; label: string; hasData: boolean }[];
    context: ReportGeneratorContext;
    footer: { sources: number; evidence: number; timelineEvents: number };
    warnings: string[];
    correlationSummary: ReportGeneratorCorrelationSummary;
    completeness: ReportGeneratorCompleteness;
    conflicts: ReportGeneratorConflict[];
}
export async function getReportGeneratorPreview(id: number | string, forceAllSections = false): Promise<ReportGeneratorPreview> {
    const body = await intelligenceJson<{ data: ReportGeneratorPreview }>(`/api/report-generator/reports/${id}/preview${forceAllSections ? '?forceAllSections=true' : ''}`, 'Failed to build preview');
    return body.data;
}

// §61-66 EXPORT — JSON/HTML/CSV only where actually supported; PDF reports
// "Not Configured" honestly rather than a broken file (§62).
export function reportGeneratorExportUrl(id: number | string, format: 'json' | 'html' | 'csv' | 'pdf'): string {
    return `/api/report-generator/reports/${id}/export?format=${format}`;
}
export async function exportReportGeneratorReport(id: number | string, format: 'json' | 'html' | 'csv' | 'pdf'): Promise<{ notConfigured?: boolean; message?: string; data?: unknown }> {
    const body = await intelligenceJson<{ data: any }>(reportGeneratorExportUrl(id, format), 'Failed to export report');
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT_GENERATOR_PHASE2.md — Searchable Entity Picker, Related
// Intelligence Discovery, Bulk Selection, Timeline Candidates, Conflict
// Detection, Report Comparison, Change History, Refresh Intelligence,
// Ready-State Validation, Review Checklist.
// ═══════════════════════════════════════════════════════════════════════
export interface ReportGeneratorSearchResultItem { itemType: ReportGeneratorSearchableType; id: string; label: string; extra: Record<string, unknown>; }
export async function searchReportGeneratorEntities(params: { itemType: ReportGeneratorSearchableType; q?: string; page?: number; pageSize?: number }): Promise<{ items: ReportGeneratorSearchResultItem[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ReportGeneratorSearchResultItem[]; total: number; page: number; pageSize: number } }>(`/api/report-generator/entity-search?${qs}`, 'Failed to search entities');
    return body.data;
}

export async function addReportGeneratorSelectionsBulk(id: number | string, items: { itemType: ReportGeneratorItemType; itemId: string | number; role?: 'primary' | 'related'; section?: string }[]): Promise<{ added: { itemType: string; itemId: string }[]; rejected: { itemType: string; itemId: string; reason: string }[]; requested: number; capped: boolean }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/selections/bulk`, 'Failed to add selections', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items }) });
    return body.data;
}

export interface ReportGeneratorDiscoveryCandidate { itemType: ReportGeneratorItemType; id: string; label: string; reasons: { reason: string; confidence: string | null; temporalOnly: boolean }[]; }
export interface ReportGeneratorDiscoveryResult {
    candidates: ReportGeneratorDiscoveryCandidate[]; reasonVocabulary: string[];
    // §28/§29 — read-only, "where supported"; never merged into Report Generator's own selections.
    relatedKnowledge: { id: string; label: string }[]; relatedThreatBriefs: { id: string; label: string }[];
}
export async function getReportGeneratorDiscovery(id: number | string): Promise<ReportGeneratorDiscoveryResult> {
    const body = await intelligenceJson<{ data: ReportGeneratorDiscoveryResult }>(`/api/report-generator/reports/${id}/discovery`, 'Failed to discover related intelligence');
    return body.data;
}

export async function getReportGeneratorConflicts(id: number | string): Promise<ReportGeneratorConflict[]> {
    const body = await intelligenceJson<{ data: ReportGeneratorConflict[] }>(`/api/report-generator/reports/${id}/conflicts`, 'Failed to load conflicts');
    return body.data;
}

export interface ReportGeneratorTimelineCandidate { id: string; timestamp: string | null; event: string; source: string; entity: { type: string; id: string; label: string } | null; alreadySelected: boolean; }
export async function getReportGeneratorTimelineCandidates(id: number | string, filters: { dateFrom?: string; dateTo?: string; source?: string; entityType?: string; entityId?: string; eventType?: string; severity?: string; confidence?: string; search?: string } = {}): Promise<{ items: ReportGeneratorTimelineCandidate[]; total: number }> {
    const qs = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ReportGeneratorTimelineCandidate[]; total: number } }>(`/api/report-generator/reports/${id}/timeline-candidates${qs.toString() ? `?${qs}` : ''}`, 'Failed to load timeline candidates');
    return body.data;
}

export interface ReportGeneratorReadyCheck {
    completeness: ReportGeneratorCompleteness;
    sourceAuthorization: { pass: boolean; issues: { type: string; id: string | number }[] };
    conflicts: { pass: boolean; count: number };
    freshness: { pass: boolean; stale: boolean };
    overallPass: boolean; note: string;
}
export async function getReportGeneratorReadyCheck(id: number | string): Promise<ReportGeneratorReadyCheck> {
    const body = await intelligenceJson<{ data: ReportGeneratorReadyCheck }>(`/api/report-generator/reports/${id}/ready-check`, 'Failed to validate Ready state');
    return body.data;
}

export interface ReportGeneratorRefreshDiff {
    added: Record<string, string[]>; removed: Record<string, string[]>; changedRisk: { entity: string; from: string | null; to: string | null }[];
    caseStatusChanged: { from: string | null; to: string | null } | null; hasChanges: boolean; neverComposedBefore: boolean;
    lastRefreshedAt: string | null; dataAsOf: string | null; note: string;
}
export async function getReportGeneratorRefreshDiff(id: number | string): Promise<ReportGeneratorRefreshDiff> {
    const body = await intelligenceJson<{ data: ReportGeneratorRefreshDiff }>(`/api/report-generator/reports/${id}/refresh-diff`, 'Failed to build refresh diff');
    return body.data;
}
export async function applyReportGeneratorRefresh(id: number | string): Promise<{ refreshed: boolean; dataAsOf: string | null }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/refresh/apply`, 'Failed to apply refresh', { method: 'POST' });
    return body.data;
}
export async function dismissReportGeneratorRefresh(id: number | string): Promise<{ dismissed: boolean }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/refresh/dismiss`, 'Failed to dismiss refresh', { method: 'POST' });
    return body.data;
}

export interface ReportGeneratorHistoryEntry { id: number; action: string; previousValue: string | null; newValue: string | null; source: string | null; username: string | null; createdAt: string | null; }
export async function getReportGeneratorHistory(id: number | string): Promise<ReportGeneratorHistoryEntry[]> {
    const body = await intelligenceJson<{ data: ReportGeneratorHistoryEntry[] }>(`/api/report-generator/reports/${id}/history`, 'Failed to load history');
    return body.data;
}

export interface ReportGeneratorComparison {
    reportA: { id: number; title: string }; reportB: { id: number; title: string };
    metadata: { changed: { field: string; from: unknown; to: unknown }[]; unchanged: string[] };
    narrative: { changed: string[]; unchanged: string[] };
    sections: Record<string, { added: string[]; removed: string[]; unchanged: string[] }>;
    note: string;
}
export async function compareReportGeneratorReports(idA: number | string, idB: number | string): Promise<ReportGeneratorComparison> {
    const body = await intelligenceJson<{ data: ReportGeneratorComparison }>(`/api/report-generator/compare?a=${idA}&b=${idB}`, 'Failed to compare reports');
    return body.data;
}

export type ReportGeneratorReviewStatus = 'not_reviewed' | 'in_review' | 'reviewed';
export interface ReportGeneratorReviewChecklist {
    reviewStatus: ReportGeneratorReviewStatus; reviewedAt: string | null; reviewedByUserId: number | null;
    items: { key: string; label: string; checked: boolean }[];
}
export async function getReportGeneratorReviewChecklist(id: number | string): Promise<ReportGeneratorReviewChecklist> {
    const body = await intelligenceJson<{ data: ReportGeneratorReviewChecklist }>(`/api/report-generator/reports/${id}/review`, 'Failed to load review checklist');
    return body.data;
}
export async function updateReportGeneratorReviewChecklist(id: number | string, patch: { items?: Record<string, boolean>; reviewStatus?: ReportGeneratorReviewStatus }): Promise<{ updated: boolean }> {
    const body = await intelligenceJson<{ data: { updated: boolean } }>(`/api/report-generator/reports/${id}/review`, 'Failed to update review checklist', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// REPORT_GENERATOR_PHASE3.md — AI Report Analyst: grounded generation,
// citations, fact check, comparison explanation, and a narrow,
// approval-gated set of recommended actions.
// ═══════════════════════════════════════════════════════════════════════
export type ReportGeneratorAiSectionType = 'executive_summary' | 'key_findings' | 'timeline_summary' | 'risk_explanation' | 'change_summary' | 'intelligence_gaps' | 'recommendations' | 'conclusion' | 'quality_review';
export type ReportGeneratorAiView = 'executive' | 'technical' | 'analyst';
export interface ReportGeneratorAiRecommendation { action: string; group: 'Immediate Review' | 'Recommended' | 'Optional'; reason: string; }
export interface ReportGeneratorAiIssue { category: string; detail: string; }
export interface ReportGeneratorAiDraft {
    text: string; citations: string[]; gaps?: string[]; recommendations?: ReportGeneratorAiRecommendation[]; issues?: ReportGeneratorAiIssue[];
    generatedAt: string; dataAsOf: string | null; model: string; provider: 'openai' | 'heuristic'; contextFingerprint: string;
    status: 'draft' | 'inserted' | 'discarded'; note: string | null; insertedText?: string; insertedAt?: string;
    stale?: boolean; analystEdited?: boolean;
}
export async function generateReportGeneratorAiDraft(id: number | string, sectionType: ReportGeneratorAiSectionType, view?: ReportGeneratorAiView): Promise<ReportGeneratorAiDraft> {
    const body = await intelligenceJson<{ data: ReportGeneratorAiDraft }>(`/api/report-generator/reports/${id}/ai/generate`, 'Report Generator AI is temporarily unavailable', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sectionType, view }) });
    return body.data;
}
export async function getReportGeneratorAiDrafts(id: number | string): Promise<Record<string, ReportGeneratorAiDraft>> {
    const body = await intelligenceJson<{ data: Record<string, ReportGeneratorAiDraft> }>(`/api/report-generator/reports/${id}/ai/drafts`, 'Failed to load AI drafts');
    return body.data;
}
export async function insertReportGeneratorAiDraft(id: number | string, sectionType: ReportGeneratorAiSectionType, overwrite = false): Promise<{ inserted: boolean }> {
    const body = await intelligenceJson<{ data: { inserted: boolean } }>(`/api/report-generator/reports/${id}/ai/drafts/${sectionType}/insert`, 'This section already contains analyst content.', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ overwrite }) });
    return body.data;
}
export async function discardReportGeneratorAiDraft(id: number | string, sectionType: ReportGeneratorAiSectionType): Promise<{ discarded: boolean }> {
    const body = await intelligenceJson<{ data: { discarded: boolean } }>(`/api/report-generator/reports/${id}/ai/drafts/${sectionType}/discard`, 'Failed to discard AI draft', { method: 'POST' });
    return body.data;
}
export interface ReportGeneratorFactCheckFinding { field: string; excerpt: string; category: 'Supported' | 'Partially Supported' | 'Unsupported' | 'Contradictory' | 'Unknown'; detail: string; }
export async function runReportGeneratorFactCheck(id: number | string): Promise<{ findings: ReportGeneratorFactCheckFinding[]; provider: string; note?: string }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/ai/fact-check`, 'Report Generator AI is temporarily unavailable', { method: 'POST' });
    return body.data;
}
export async function explainReportGeneratorComparison(idA: number | string, idB: number | string): Promise<{ comparison: ReportGeneratorComparison; explanation: { text: string; provider: string; note?: string } }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/ai/compare-explain?a=${idA}&b=${idB}`, 'Report Generator AI is temporarily unavailable');
    return body.data;
}
export interface ReportGeneratorActionCandidate { action: string; targetType: string; targetId: string; targetLabel: string; reason: string; payload: Record<string, unknown>; }
export async function getReportGeneratorActionCandidates(id: number | string): Promise<ReportGeneratorActionCandidate[]> {
    const body = await intelligenceJson<{ data: ReportGeneratorActionCandidate[] }>(`/api/report-generator/reports/${id}/ai/action-candidates`, 'Failed to load action candidates');
    return body.data;
}
export interface ReportGeneratorAiAction {
    id: number; action: string; targetType: string | null; targetId: string | null; targetLabel: string | null;
    reason: string | null; impact: string | null; status: 'proposed' | 'unavailable' | 'approved' | 'rejected' | 'executed' | 'failed';
    error: string | null; resultSummary: unknown; createdAt: string | null; decidedAt: string | null; executedAt: string | null;
}
export async function proposeReportGeneratorAction(id: number | string, candidate: ReportGeneratorActionCandidate): Promise<ReportGeneratorAiAction> {
    const body = await intelligenceJson<{ data: ReportGeneratorAiAction }>(`/api/report-generator/reports/${id}/ai/actions`, 'Failed to propose action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(candidate) });
    return body.data;
}
export async function listReportGeneratorActions(id: number | string): Promise<ReportGeneratorAiAction[]> {
    const body = await intelligenceJson<{ data: ReportGeneratorAiAction[] }>(`/api/report-generator/reports/${id}/ai/actions`, 'Failed to load actions');
    return body.data;
}
export async function approveReportGeneratorAction(id: number | string, actionId: number): Promise<{ id: number; status: string; result?: unknown; error?: string }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/ai/actions/${actionId}/approve`, 'Failed to approve action', { method: 'POST' });
    return body.data;
}
export async function rejectReportGeneratorAction(id: number | string, actionId: number): Promise<{ id: number; status: string }> {
    const body = await intelligenceJson<{ data: any }>(`/api/report-generator/reports/${id}/ai/actions/${actionId}/reject`, 'Failed to reject action', { method: 'POST' });
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// MITRE_MAPPER_PHASE1.md — ATT&CK Mapping Foundation. Technique browsing
// reuses getAttackOverview()/getAttackTechniques() above verbatim (the SAME
// endpoints Threat Intelligence's own ATT&CK section already uses); these
// new functions cover only what's genuinely new: mapping-enriched
// technique detail, entity search/view, manual mapping CRUD, comparison,
// search, dashboard, and export.
// ═══════════════════════════════════════════════════════════════════════
export type MitreEntityType = 'threat_actor' | 'malware' | 'campaign' | 'case' | 'ioc' | 'brand' | 'company' | 'social_investigation' | 'dark_web_observation' | 'credential_exposure';
export type MitreReviewStatus = 'suggested' | 'confirmed' | 'rejected';
export type MitreConfidence = 'Low' | 'Medium' | 'High';

// MITRE_MAPPER_PHASE2.md §27/§28 — one additional supporting source
// preserved with full per-source provenance (never blended into the
// mapping's own primary source/reason/confidence above).
export interface MitreSuggestionSource { source: string; reason: string; confidence: MitreConfidence; evidenceId: number | null; detectedAt: string; }

export interface MitreMapping {
    id: number; sourceType: string; sourceId: string; techniqueId: string; techniqueName?: string;
    relationshipType: string; basis: 'observed' | 'inferred'; confidence: MitreConfidence | null;
    source: string; detectionMethod: string | null; reviewStatus: MitreReviewStatus | null;
    reason: string | null; evidenceId: number | null; createdByUserId: number | null;
    createdAt: string | null; updatedAt: string | null; duplicate?: boolean;
    entityType?: string; entityId?: string; entityLabel?: string;
    // Phase 2 additive fields — absent/empty on rows Phase 1 code paths return unchanged.
    sources?: MitreSuggestionSource[]; stale?: boolean;
}

export interface MitreTactic { tactic: string; techniqueCount: number; }

export interface MitreTechniqueDetail {
    technique_id: string; name: string; tactic: string; description: string; url: string | null;
    tactics: string[]; parentTechniqueId: string | null;
    relatedCampaigns: { id: number; name: string; status: string; severity: string }[];
    relatedIocs: { id: number; type: string; value: string; risk: string | null }[];
    relatedThreatActors: { type: string; id: string; label: string }[];
    relatedMalware: { type: string; id: string; label: string }[];
    mappedEntities: MitreMapping[]; mappingSourceCount: number;
    mappingCounts: { suggested: number; confirmed: number; rejected: number };
}

export async function getMitreTechniqueDetail(techniqueId: string): Promise<MitreTechniqueDetail> {
    const body = await intelligenceJson<{ data: MitreTechniqueDetail }>(`/api/mitre-mapper/techniques/${encodeURIComponent(techniqueId)}`, 'Failed to load technique');
    return body.data;
}
export async function getMitreTactics(): Promise<MitreTactic[]> {
    const body = await intelligenceJson<{ data: MitreTactic[] }>('/api/mitre-mapper/tactics', 'Failed to load tactics');
    return body.data;
}

export interface MitreEntitySearchResult { itemType: string; id: string; label: string; extra: Record<string, unknown>; }
export async function searchMitreEntities(itemType: MitreEntityType, q: string, pageSize = 20): Promise<{ items: MitreEntitySearchResult[]; total: number }> {
    const qs = new URLSearchParams({ itemType, q, pageSize: String(pageSize) });
    const body = await intelligenceJson<{ data: { items: MitreEntitySearchResult[]; total: number } }>(`/api/mitre-mapper/entity-search?${qs}`, 'Failed to search entities');
    return body.data;
}

// MITRE_MAPPER_PHASE2.md §5/§6/§7 — a Malware Family's own Sample-derived
// rollup entry; ALWAYS kept separate from `techniques` (Direct), never merged.
export interface MitreSampleDerivedTechnique {
    techniqueId: string; techniqueName: string; tactics: string[]; parentTechniqueId: string | null;
    status: 'suggested' | 'confirmed'; sampleIds: number[]; reasons: { sampleId: number; confidence: string | null; reason: string }[];
}
export interface MitreEntityView {
    entity: { type: string; id: string; label: string; isAptGroup?: boolean };
    techniques: (MitreMapping & { techniqueId: string; techniqueName: string; tactics: string[]; parentTechniqueId: string | null })[];
    counts: { mapped: number; confirmed: number; suggested: number; rejected: number };
    mappingsDisabled?: boolean; reason?: string;
    sampleLevel?: boolean; // entityType === 'malware_sample'
    sampleDerivedTechniques?: MitreSampleDerivedTechnique[]; sampleDerivedSampleCount?: number; // entityType === 'malware'
}
export async function getMitreEntityView(entityType: string, entityId: string | number): Promise<MitreEntityView> {
    const body = await intelligenceJson<{ data: MitreEntityView }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}`, 'Failed to load entity view');
    return body.data;
}
export interface MitreEvidenceItem { id: number; source: string; url: string | null; description: string | null; confidence: string | null; username: string | null; created_at: string | null; observed_at: string | null; }
export async function getMitreEntityEvidence(entityType: string, entityId: string | number): Promise<MitreEvidenceItem[]> {
    const body = await intelligenceJson<{ data: MitreEvidenceItem[] }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/evidence`, 'Failed to load evidence');
    return body.data;
}
// §70/§71/§79 CONFLICT REVIEW ENRICHMENT — each side now carries enough
// (mapping id, source, reason, evidence reference) for a "View Evidence /
// Source / Mapping" action, not just a bare source-name string.
export interface MitreConflictSide { mappingId: number; source: string; reason: string | null; confidence?: string | null; reviewStatus?: string | null; evidenceId: number | null; }
export interface MitreConflict { techniqueId: string; techniqueName: string; rejectedBy: MitreConflictSide[]; acceptedBy: MitreConflictSide[]; }
export async function getMitreConflicts(entityType: string, entityId: string | number): Promise<MitreConflict[]> {
    const body = await intelligenceJson<{ data: MitreConflict[] }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/conflicts`, 'Failed to load conflicts');
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// MITRE_MAPPER_PHASE2.md — Automatic Suggestions, Review Queue + Bulk
// Review, Coverage/Tactic Coverage, Matrix status filter, Technique
// History/Entity Evolution, Malware Sample as a viewable entity + review
// delegate, Malware Sample comparison.
// ═══════════════════════════════════════════════════════════════════════
export interface MitreSuggestionsSummary {
    newSuggestions: number; highConfidence: number; needsReview: number;
    recentlyConfirmed: number; recentlyRejected: number; confirmedTotal: number; rejectedTotal: number;
}
export async function getMitreSuggestionsSummary(): Promise<MitreSuggestionsSummary> {
    const body = await intelligenceJson<{ data: MitreSuggestionsSummary }>('/api/mitre-mapper/suggestions/summary', 'Failed to load suggestions summary');
    return body.data;
}
export interface MitreSuggestionsQueueParams {
    tactic?: string; technique?: string; entityType?: string; confidence?: string; status?: string;
    source?: string; search?: string; staleOnly?: string; evidenceSupported?: string; sort?: string; order?: string; page?: number; pageSize?: number;
}
export async function getMitreSuggestionsQueue(params: MitreSuggestionsQueueParams = {}): Promise<{ items: MitreMapping[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: MitreMapping[]; total: number; page: number; pageSize: number } }>(`/api/mitre-mapper/suggestions?${qs}`, 'Failed to load suggestions');
    return body.data;
}
export interface MitreRecalculateResult { created: { techniqueId: string; mappingId: number; sourceCount: number }[]; merged: { techniqueId: string; mappingId: number; sourceCount: number }[]; skippedConfirmed: { techniqueId: string; mappingId: number }[]; skippedRejected: { techniqueId: string; mappingId: number }[]; skippedExistingRelationship: { techniqueId: string }[]; techniquesScanned: number; }
export async function recalculateMitreSuggestions(entityType: string, entityId: string | number): Promise<MitreRecalculateResult> {
    const body = await intelligenceJson<{ data: MitreRecalculateResult }>('/api/mitre-mapper/suggestions/recalculate', 'Failed to recalculate suggestions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId }) });
    return body.data;
}
export async function bulkReviewMitreMappings(mappingIds: number[], action: 'confirmed' | 'rejected'): Promise<{ succeeded: number[]; failed: { id: number; error: string }[] }> {
    const body = await intelligenceJson<{ data: { succeeded: number[]; failed: { id: number; error: string }[] } }>('/api/mitre-mapper/suggestions/bulk-review', 'Failed to bulk-review mappings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappingIds, action }) });
    return body.data;
}
export interface MitreMatrixEntry { techniqueId: string; confirmed: number; suggested: number; rejected: number; sampleDerived: number; }
export async function getMitreMatrixData(status?: string): Promise<MitreMatrixEntry[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const body = await intelligenceJson<{ data: { entries: MitreMatrixEntry[] } }>(`/api/mitre-mapper/matrix${qs}`, 'Failed to load matrix data');
    return body.data.entries;
}
export interface MitreTacticCoverageRow { tactic: string; confirmed: number; suggested: number; rejected: number; existingRelationship: number; sampleDerived: number; }
export interface MitreCoverage { entity: { type: string; id: string; label: string }; tacticCoverage: MitreTacticCoverageRow[]; totals: Omit<MitreTacticCoverageRow, 'tactic'>; note: string; }
export async function getMitreCoverage(entityType: string, entityId: string | number): Promise<MitreCoverage> {
    const body = await intelligenceJson<{ data: MitreCoverage }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/coverage`, 'Failed to load coverage');
    return body.data;
}
export interface MitreFamilyCoverage {
    entity: { type: string; id: string; label: string };
    direct: { count: number; confirmed: number; suggested: number; rejected: number };
    sampleDerived: { count: number; sampleCount: number };
    combined: { count: number; techniques: { techniqueId: string; techniqueName: string; tactics: string[]; inDirect: boolean; inSampleDerived: boolean; directStatus: string | null; sampleDerivedStatus: string | null }[] };
}
export async function getMalwareFamilyCoverage(malwareId: string | number): Promise<MitreFamilyCoverage> {
    const body = await intelligenceJson<{ data: MitreFamilyCoverage }>(`/api/mitre-mapper/malware/${encodeURIComponent(String(malwareId))}/family-coverage`, 'Failed to load family coverage');
    return body.data;
}
export interface MitreTechniqueHistoryEntry { id: number; entityType: string; entityId: string; action: string; previousValue: string | null; newValue: string | null; source: string; username: string | null; createdAt: string | null; }
export async function getMitreTechniqueHistory(techniqueId: string, entityType?: string, entityId?: string | number): Promise<MitreTechniqueHistoryEntry[]> {
    const qs = new URLSearchParams(); if (entityType) qs.set('entityType', entityType); if (entityId != null) qs.set('entityId', String(entityId));
    const body = await intelligenceJson<{ data: MitreTechniqueHistoryEntry[] }>(`/api/mitre-mapper/techniques/${encodeURIComponent(techniqueId)}/history?${qs}`, 'Failed to load technique history');
    return body.data;
}
export interface MitreEvolutionEvent { techniqueId: string; eventType: 'Added' | 'Removed' | 'Confirmed' | 'Rejected' | 'Reappeared'; source: string; username: string | null; createdAt: string | null; }
export async function getMitreEntityEvolution(entityType: string, entityId: string | number): Promise<{ entityType: string; entityId: string; timeline: MitreEvolutionEvent[] }> {
    const body = await intelligenceJson<{ data: { entityType: string; entityId: string; timeline: MitreEvolutionEvent[] } }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/evolution`, 'Failed to load evolution');
    return body.data;
}
export interface MitreSampleComparison {
    entityA: { type: string; id: string; label: string }; entityB: { type: string; id: string; label: string };
    shared: { techniqueId: string; techniqueName: string; status: string | null }[]; aOnly: { techniqueId: string; techniqueName: string; status: string | null }[]; bOnly: { techniqueId: string; techniqueName: string; status: string | null }[];
    similarity: { overallScore: number; overallLabel: string; sameFingerprint: boolean } | null;
}
// Named distinctly from Malware Analysis Phase 3's own compareMalwareSamples
// (a different endpoint/shape — import/behavioral similarity comparison,
// not ATT&CK technique sets) to avoid a duplicate export in this file.
export async function compareMitreMalwareSamples(sampleIdA: string | number, sampleIdB: string | number): Promise<MitreSampleComparison> {
    const qs = new URLSearchParams({ sampleIdA: String(sampleIdA), sampleIdB: String(sampleIdB) });
    const body = await intelligenceJson<{ data: MitreSampleComparison }>(`/api/mitre-mapper/malware-samples/compare?${qs}`, 'Failed to compare samples');
    return body.data;
}
export async function reviewMalwareSampleTechnique(sampleId: string | number, techniqueId: string, action: 'confirmed' | 'rejected'): Promise<{ updated: boolean }> {
    const body = await intelligenceJson<{ data: { updated: boolean } }>(`/api/mitre-mapper/malware-samples/${encodeURIComponent(String(sampleId))}/techniques/${encodeURIComponent(techniqueId)}/review`, 'Failed to review technique', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    return body.data;
}

export async function createMitreMapping(payload: { entityType: string; entityId: string | number; techniqueId: string; reason: string; confidence?: MitreConfidence; evidenceId?: number }): Promise<MitreMapping> {
    const body = await intelligenceJson<{ data: MitreMapping }>('/api/mitre-mapper/mappings', 'Failed to create mapping', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
export async function reviewMitreMapping(mappingId: number, action: 'confirmed' | 'rejected'): Promise<{ id: number; reviewStatus: string }> {
    const body = await intelligenceJson<{ data: { id: number; reviewStatus: string } }>(`/api/mitre-mapper/mappings/${mappingId}`, 'Failed to update mapping', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
    return body.data;
}
export async function removeMitreMapping(mappingId: number): Promise<{ removed: boolean }> {
    const body = await intelligenceJson<{ data: { removed: boolean } }>(`/api/mitre-mapper/mappings/${mappingId}`, 'Failed to remove mapping', { method: 'DELETE' });
    return body.data;
}

export async function getMitreMappingsPage(params: { tactic?: string; technique?: string; entityType?: string; confidence?: string; status?: string; evidenceSupported?: string; source?: string; search?: string; staleOnly?: string; sort?: string; order?: string; page?: number; pageSize?: number } = {}): Promise<{ items: MitreMapping[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: MitreMapping[]; total: number; page: number; pageSize: number } }>(`/api/mitre-mapper/mappings?${qs}`, 'Failed to load mappings');
    return body.data;
}

export interface MitreComparison {
    entityA: { type: string; id: string; label: string }; entityB: { type: string; id: string; label: string };
    // §79 IMPROVED COMPARISON — source-category label + review status
    // alongside each technique, never collapsed into a bare id/name pair.
    shared: { techniqueId: string; techniqueName: string; sourceA: string | null; sourceB: string | null; reviewStatusA: string | null; reviewStatusB: string | null }[];
    aOnly: { techniqueId: string; techniqueName: string; source: string | null; reviewStatus: string | null }[];
    bOnly: { techniqueId: string; techniqueName: string; source: string | null; reviewStatus: string | null }[];
}
export async function compareMitreEntities(typeA: string, idA: string | number, typeB: string, idB: string | number): Promise<MitreComparison> {
    const qs = new URLSearchParams({ typeA, idA: String(idA), typeB, idB: String(idB) });
    const body = await intelligenceJson<{ data: MitreComparison }>(`/api/mitre-mapper/compare?${qs}`, 'Failed to compare entities');
    return body.data;
}

export interface MitreSearchResult { techniques: { techniqueId: string; name: string; tactics: string[] }[]; mappings: MitreMapping[]; matchingEntities: { type: string; id: string }[]; }
export async function searchMitre(q: string): Promise<MitreSearchResult> {
    const body = await intelligenceJson<{ data: MitreSearchResult }>(`/api/mitre-mapper/search?q=${encodeURIComponent(q)}`, 'Search failed');
    return body.data;
}

export interface MitreDashboard {
    techniquesTotal: number; mappedEntities: number; mappingsTotal: number; confirmed: number; suggested: number; rejected: number;
    topTechniques: { techniqueId: string; name: string; count: number }[]; recentMappings: MitreMapping[];
}
export async function getMitreDashboard(): Promise<MitreDashboard> {
    const body = await intelligenceJson<{ data: MitreDashboard }>('/api/mitre-mapper/dashboard', 'Failed to load dashboard');
    return body.data;
}

export function mitreMapperExportUrl(format: 'json' | 'csv', params: Record<string, string> = {}): string {
    const qs = new URLSearchParams({ format, ...params });
    return `/api/mitre-mapper/export?${qs}`;
}
export async function exportMitreMappingsJson(params: Record<string, string> = {}): Promise<unknown[]> {
    const qs = new URLSearchParams(params);
    const body = await intelligenceJson<{ data: unknown[] }>(`/api/mitre-mapper/export?format=json&${qs}`, 'Failed to export mappings');
    return body.data;
}

// ═══════════════════════════════════════════════════════════════════════
// MITRE_MAPPER_PHASE3.md — Detection Rule Correlation (Sigma/YARA),
// Detection Coverage/Gaps, Confidence Heatmap, enhanced Evolution/Trend,
// bundled Entity Profile, enhanced Comparison + Technique Comparison, and
// the AI MITRE Analyst layer.
// ═══════════════════════════════════════════════════════════════════════
export interface MitreDetectionRuleRef { id: number; name: string; status: string; sampleId: number; }
export interface MitreDetectionSupport { entityType: string; entityId: string; sampleCount: number; techniques: { techniqueId: string; sigmaRules: MitreDetectionRuleRef[]; yaraRules: MitreDetectionRuleRef[] }[]; }
export async function getMitreDetectionSupport(entityType: string, entityId: string | number): Promise<MitreDetectionSupport> {
    const body = await intelligenceJson<{ data: MitreDetectionSupport }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/detection-support`, 'Failed to load detection support');
    return body.data;
}
export interface MitreDetectionCoverageRow { techniqueId: string; techniqueName: string; evidence: boolean; sigma: string | null; yara: string | null; behavior: boolean; analyst: string; }
export interface MitreDetectionCoverage { entity: { type: string; id: string; label: string }; rows: MitreDetectionCoverageRow[]; }
export async function getMitreDetectionCoverage(entityType: string, entityId: string | number): Promise<MitreDetectionCoverage> {
    const body = await intelligenceJson<{ data: MitreDetectionCoverage }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/detection-coverage`, 'Failed to load detection coverage');
    return body.data;
}
export interface MitreDetectionGap { techniqueId: string; techniqueName: string; mappingStatus: string; detectionGap: string; }
export async function getMitreDetectionGaps(entityType: string, entityId: string | number): Promise<{ entity: { type: string; id: string; label: string }; gaps: MitreDetectionGap[] }> {
    const body = await intelligenceJson<{ data: { entity: { type: string; id: string; label: string }; gaps: MitreDetectionGap[] } }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/detection-gaps`, 'Failed to load detection gaps');
    return body.data;
}
export interface MitreHeatmapCell { techniqueId: string; techniqueName?: string; tactics?: string[]; reviewStatus: string | null; confidence: string | null; tier: number; tierLabel: string; }
export async function getMitreEntityHeatmap(entityType: string, entityId: string | number): Promise<{ entity: { type: string; id: string; label: string }; cells: MitreHeatmapCell[]; formula: string }> {
    const body = await intelligenceJson<{ data: { entity: { type: string; id: string; label: string }; cells: MitreHeatmapCell[]; formula: string } }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/heatmap`, 'Failed to load heatmap');
    return body.data;
}
export async function getMitreHeatmap(status?: string): Promise<{ cells: MitreHeatmapCell[]; formula: string }> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const body = await intelligenceJson<{ data: { cells: MitreHeatmapCell[]; formula: string } }>(`/api/mitre-mapper/heatmap${qs}`, 'Failed to load heatmap');
    return body.data;
}
export interface MitreTrendWindow { eventCount: number; techniqueEvents: number; }
export interface MitreAdoptionEntry { techniqueId: string; state: string; firstSeen: string | null; lastSeen: string | null; }
export async function getMitreTechniqueTrend(entityType: string, entityId: string | number): Promise<{ entityType: string; entityId: string; windows: Record<'7d' | '30d' | '90d', MitreTrendWindow>; adoption: MitreAdoptionEntry[] }> {
    const body = await intelligenceJson<{ data: { entityType: string; entityId: string; windows: Record<'7d' | '30d' | '90d', MitreTrendWindow>; adoption: MitreAdoptionEntry[] } }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/trend`, 'Failed to load trend');
    return body.data;
}
export interface MitreEntityProfile {
    entity: { type: string; id: string; label: string; isAptGroup?: boolean };
    techniques: MitreEntityView['techniques']; sampleDerivedTechniques: MitreSampleDerivedTechnique[] | null;
    sampleDerivedSampleCount?: number;
    summary: { confirmed: number; suggested: number; observed: number; detectionCovered: number; detectionGaps: number };
    detectionCoverage: MitreDetectionCoverageRow[]; heatmap: MitreHeatmapCell[]; recentEvolution: MitreEvolutionEvent[];
}
export async function getMitreEntityProfile(entityType: string, entityId: string | number): Promise<MitreEntityProfile> {
    const body = await intelligenceJson<{ data: MitreEntityProfile }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/profile`, 'Failed to load entity profile');
    return body.data;
}
export interface MitreEnhancedComparison extends MitreComparison { sharedTactics: string[]; }
export async function getMitreEnhancedComparison(typeA: string, idA: string | number, typeB: string, idB: string | number): Promise<MitreEnhancedComparison> {
    const qs = new URLSearchParams({ typeA, idA: String(idA), typeB, idB: String(idB) });
    const body = await intelligenceJson<{ data: MitreEnhancedComparison }>(`/api/mitre-mapper/compare-enhanced?${qs}`, 'Failed to compare entities');
    return body.data;
}
export interface MitreTechniqueComparison {
    techniqueA: { techniqueId: string; name: string; tactics: string[]; parentTechniqueId: string | null; mappingCounts: { suggested: number; confirmed: number; rejected: number } };
    techniqueB: { techniqueId: string; name: string; tactics: string[]; parentTechniqueId: string | null; mappingCounts: { suggested: number; confirmed: number; rejected: number } };
    sharedTactics: string[]; sameParentTechnique: boolean; note: string;
}
export async function compareMitreTechniques(techniqueIdA: string, techniqueIdB: string): Promise<MitreTechniqueComparison> {
    const qs = new URLSearchParams({ a: techniqueIdA, b: techniqueIdB });
    const body = await intelligenceJson<{ data: MitreTechniqueComparison }>(`/api/mitre-mapper/techniques/compare?${qs}`, 'Failed to compare techniques');
    return body.data;
}

// §41-§69 AI MITRE ANALYST
export type MitreAiTaskType = 'technique_suggestion' | 'technique_explanation' | 'evidence_explanation' | 'ttp_summary' | 'evolution_summary' | 'detection_gap_analysis' | 'conflict_explanation' | 'recommendations';
export interface MitreAiDraft {
    taskType: MitreAiTaskType; text: string; provider: 'openai' | 'heuristic'; note: string | null;
    generatedAt: string; dataAsOf: string; model: string;
    doesNotEstablish?: string[]; gaps?: { techniqueId: string; missingSigma: boolean; missingYara: boolean }[];
    recommendations?: { action: string; reason: string }[];
    suggestions?: { techniqueId: string; reason: string; confidence: MitreConfidence; citations: string[] }[];
}
export async function generateMitreAiAnalysis(entityType: string, entityId: string | number, taskType: MitreAiTaskType, options: { techniqueId?: string; view?: string } = {}): Promise<MitreAiDraft> {
    const body = await intelligenceJson<{ data: MitreAiDraft }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/ai/analyze`, 'AI analysis failed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskType, ...options }) });
    return body.data;
}
export interface MitreAiSuggestion {
    id: number; entityType: string; entityId: string; entityLabel: string; techniqueId: string; reason: string; source: string;
    aiModel: string | null; citations: string[]; contextFingerprint: string; status: 'suggested' | 'accepted' | 'rejected' | 'stale';
    stale: boolean; createdByUserId: number | null; decidedByUserId: number | null; decidedAt: string | null; acceptedMappingId: number | null; createdAt: string | null;
}
export async function generateMitreAiTechniqueSuggestion(entityType: string, entityId: string | number): Promise<{ text: string; provider: string; note: string | null; suggestions: MitreAiSuggestion[] }> {
    const body = await intelligenceJson<{ data: { text: string; provider: string; note: string | null; suggestions: MitreAiSuggestion[] } }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/ai/suggest`, 'AI suggestion failed', { method: 'POST' });
    return body.data;
}
export async function getMitreAiSuggestions(params: { entityType?: string; entityId?: string | number; status?: string; page?: number; pageSize?: number } = {}): Promise<{ items: MitreAiSuggestion[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: MitreAiSuggestion[]; total: number; page: number; pageSize: number } }>(`/api/mitre-mapper/ai/suggestions?${qs}`, 'Failed to load AI suggestions');
    return body.data;
}
export async function acceptMitreAiSuggestion(id: number, confidence?: MitreConfidence): Promise<{ id: number; status: string; mapping: MitreMapping }> {
    const body = await intelligenceJson<{ data: { id: number; status: string; mapping: MitreMapping } }>(`/api/mitre-mapper/ai/suggestions/${id}/accept`, 'Failed to accept suggestion', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confidence }) });
    return body.data;
}
export async function rejectMitreAiSuggestion(id: number): Promise<{ id: number; status: string }> {
    const body = await intelligenceJson<{ data: { id: number; status: string } }>(`/api/mitre-mapper/ai/suggestions/${id}/reject`, 'Failed to reject suggestion', { method: 'POST' });
    return body.data;
}
export interface MitreAiActionCandidate { action: string; targetType: string; targetId: string; targetLabel: string; reason: string; payload: Record<string, unknown>; }
export async function getMitreAiActionCandidates(entityType: string, entityId: string | number): Promise<MitreAiActionCandidate[]> {
    const body = await intelligenceJson<{ data: MitreAiActionCandidate[] }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/ai/actions/candidates`, 'Failed to load action candidates');
    return body.data;
}
export interface MitreAiAction {
    id: number; action: string; targetType: string | null; targetId: string | null; targetLabel: string | null;
    reason: string | null; impact: string | null; status: 'proposed' | 'unavailable' | 'approved' | 'rejected' | 'executed' | 'failed';
    error: string | null; resultSummary: unknown; createdAt: string | null; decidedAt: string | null; executedAt: string | null;
}
export async function proposeMitreAiAction(entityType: string, entityId: string | number, candidate: MitreAiActionCandidate): Promise<MitreAiAction> {
    const body = await intelligenceJson<{ data: MitreAiAction }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/ai/actions`, 'Failed to propose action', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(candidate) });
    return body.data;
}
export async function listMitreAiActions(entityType: string, entityId: string | number): Promise<MitreAiAction[]> {
    const body = await intelligenceJson<{ data: MitreAiAction[] }>(`/api/mitre-mapper/entities/${entityType}/${encodeURIComponent(String(entityId))}/ai/actions`, 'Failed to load actions');
    return body.data;
}
export async function approveMitreAiAction(id: number): Promise<{ id: number; status: string; result?: unknown }> {
    const body = await intelligenceJson<{ data: { id: number; status: string; result?: unknown } }>(`/api/mitre-mapper/ai/actions/${id}/approve`, 'Failed to approve action', { method: 'POST' });
    return body.data;
}
export async function rejectMitreAiAction(id: number): Promise<{ id: number; status: string }> {
    const body = await intelligenceJson<{ data: { id: number; status: string } }>(`/api/mitre-mapper/ai/actions/${id}/reject`, 'Failed to reject action', { method: 'POST' });
    return body.data;
}

export async function getCampaigns(params: { q?: string; status?: string; severity?: string; confidence?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: Campaign[]; total: number; page: number; pageSize: number }>(`/api/intelligence/campaigns?${qs.toString()}`, 'Failed to load campaigns');
}

export async function getCampaign(id: number): Promise<CampaignDetail> {
    const body = await intelligenceJson<{ data: { campaign: CampaignDetail } }>(`/api/intelligence/campaigns/${id}`, 'Failed to load campaign');
    return body.data.campaign;
}

export async function getIntelligenceFeeds(): Promise<IntelligenceFeed[]> {
    const body = await intelligenceJson<{ data: { feeds: IntelligenceFeed[] } }>('/api/intelligence/feeds', 'Failed to load threat feeds');
    return body.data.feeds;
}

export async function getIntelligenceFeed(id: string): Promise<FeedDetail> {
    const body = await intelligenceJson<{ data: { feed: FeedDetail } }>(`/api/intelligence/feeds/${id}`, 'Failed to load feed detail');
    return body.data.feed;
}

export async function getAttackOverview(): Promise<AttackOverview> {
    const body = await intelligenceJson<{ data: AttackOverview }>('/api/intelligence/attack/overview', 'Failed to load ATT&CK overview');
    return body.data;
}

export async function getAttackTechniques(params: { q?: string; tactic?: string; campaignId?: number; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: AttackTechnique[]; total: number; page: number; pageSize: number }>(`/api/intelligence/attack/techniques?${qs.toString()}`, 'Failed to load ATT&CK techniques');
}

// ─── Threat Intelligence Phase 2 (THREAT_INTELLIGENCE_MODULE_PHASE2.md) ────

export interface ThreatActorAttribution {
    country: string | null; confidence: string | null; reasoning: string | null;
    updated_at: string | null; updated_by_user_id: number | null;
}
export interface ThreatActor {
    id: number; name: string; description: string | null; status: string; confidence: string;
    motivation: string | null; target_sectors: string[]; target_regions: string[]; source_type: string;
    first_seen_at: string | null; last_seen_at: string | null; risk?: string | null;
    campaign_count?: number; malware_count?: number; ioc_count?: number; technique_count?: number;
    // APT_GROUP_PHASE1.md §5/§6/§8 — present on every threat_actors row
    // (mapThreatActorRow always includes these), not only APT-classified ones.
    is_apt_group?: boolean; attribution?: ThreatActorAttribution;
}
export interface ThreatActorDetail extends ThreatActor {
    aliases: string[]; relationships: EntityRelationship[];
    // §7 — aliasRecords carries the alias row id so a single alias can be removed.
    aliasRecords?: { id: number; alias: string }[];
}
export interface Malware {
    id: number; name: string; family: string | null; type: string | null; description: string | null;
    confidence: string; source_type: string; first_seen_at: string | null; last_seen_at: string | null;
    risk?: string | null; campaign_count?: number; threat_actor_count?: number; ioc_count?: number; technique_count?: number;
    sample_count?: number;
}
export interface MalwareAlias { id: number; alias: string; }
export interface MalwareReport { id: number; title: string; report_type: string; status: string; published_at: string | null; created_at: string | null; }
export interface MalwareDetail extends Malware {
    relationships: EntityRelationship[];
    aliases: MalwareAlias[];
    reports: MalwareReport[];
}
export interface MalwareCaseRef { id: number; case_number: string; title: string; status: string; updated_at: string | null; }
export interface MalwareTimelineEvent {
    id: string; timestamp: string | null; event_type: string; title: string; description: string;
    source_module: string; entity_type: string; entity_id: string; entity_label: string | null;
    severity: string | null; confidence: string | null; actor: string | null;
}
export interface Vulnerability {
    id: number; cve_id: string; title: string | null; description: string | null;
    cvss: number | null; severity: string | null; cvss_version: string | null;
    vendor: string | null; product: string | null;
    affected_versions: { startIncluding: string | null; startExcluding: string | null; endIncluding: string | null; endExcluding: string | null }[];
    exploit_availability: string; known_exploitation: string; cisa_kev_added_at: string | null;
    source: string;
    published_at: string | null; first_seen_at: string | null; last_seen_at: string | null; updated_at: string | null;
    campaign_count?: number; threat_actor_count?: number;
}
export interface VulnerabilityReference {
    url: string; source: string | null; tags: string[]; position: number;
}
export interface VulnerabilityDetail extends Vulnerability {
    references: VulnerabilityReference[];
    relationships: EntityRelationship[];
}
export interface CorrelationDashboard {
    totalRelationships: number; newLast24h: number; highConfidenceCount: number;
    recentlyUpdated: { id: number; relationship_type: string; basis: string; confidence: string | null; source: string; updated_at: string | null; sourceEntity: EntityRef; targetEntity: EntityRef }[];
    highlyConnectedEntities: { edgeCount: number; entity: EntityRef }[];
    potentialCampaignConnections: { campaignId: number; campaignName: string; relatedEntity: EntityRef }[];
}
export interface RelationshipGraphNode extends EntityRef { risk?: string | null; confidence?: string | null; }
export interface RelationshipGraphEdge {
    id: number; sourceType: string; sourceId: string; targetType: string; targetId: string;
    relationshipType: string; basis: string; confidence: string | null;
}
export interface RelationshipGraph { nodes: RelationshipGraphNode[]; edges: RelationshipGraphEdge[]; truncated: boolean; }

export async function getThreatActors(params: { q?: string; status?: string; confidence?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: ThreatActor[]; total: number; page: number; pageSize: number }>(`/api/intelligence/actors?${qs.toString()}`, 'Failed to load threat actors');
}

export async function getThreatActor(id: number): Promise<ThreatActorDetail> {
    const body = await intelligenceJson<{ data: { actor: ThreatActorDetail } }>(`/api/intelligence/actors/${id}`, 'Failed to load threat actor');
    return body.data.actor;
}

// ─── APT Group Intelligence (APT_GROUP_PHASE1.md) ──────────────────────────
// An "APT Group" is a ThreatActorDetail with is_apt_group = true — these
// endpoints operate on the same threat_actors rows as the functions above,
// they don't add a second entity type on the frontend either.

export interface AptGroupDashboard {
    totalAptGroups: number; activeGroups: number; recentlyActive: number;
    highRisk: number; activeCampaigns: number; recentIntelligence: number;
    // APT_GROUP_PHASE2.md §31 — additive to Phase 1's tiles.
    monitoredGroups: number; openAptAlerts: number; recentChanges: number;
    recentRiskChanges: number; newCampaigns: number; newIOCs: number; activeHighRiskGroups: number;
}
export interface AptGroupRelatedAlert { id: number; severity: string; title: string; target: string; status: string; createdAt: string | null; }
export interface AptGroupTimelineItem { id: number; action: string; previousValue: string | null; newValue: string | null; source: string; username: string | null; createdAt: string | null; }
export interface AptGroupAiSummary {
    profileSummary: string; attributionSummary: string; campaignSummary: string; malwareSummary: string;
    ttpSummary: string; vulnSummary: string; iocSummary: string; timelineSummary: string; riskSummary: string; note: string;
}
// §27 "SEARCH RESULTS" — APT Group / Matching Field / Matching Value / Related Intelligence / Risk / Source.
export interface AptGroupSearchMatch { field: string; value: string; entityType: string; entityId: string; }
export interface AptGroupSearchResultItem { actor: ThreatActor; matches: AptGroupSearchMatch[]; }
// §32 "RECENT APT ACTIVITY" — a real monitor_events-backed stream.
export interface AptGroupActivityItem { id: number; actorId: number; actorName: string; eventType: string; summary: string; severity: string; createdAt: string | null; }
// §34 "AI CHANGE SUMMARY"
export interface AptChangeSummary { changeSummary: string; confidence: string; evidenceNote: string; note: string; }

export async function getAptGroups(params: {
    q?: string; status?: string; attribution?: string; attributionConfidence?: string; region?: string; sector?: string;
    campaignId?: number; malwareId?: number; techniqueId?: string; cveId?: string;
    risk?: string; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number;
    // P1-7 — one list over the single `threat_actors` table; omitted keeps
    // the server's existing APT-only default.
    classification?: 'all' | 'apt' | 'non-apt';
} = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: ThreatActor[]; total: number; page: number; pageSize: number }>(`/api/intelligence/apt-groups?${qs.toString()}`, 'Failed to load APT groups');
}
export async function searchAptGroups(q: string, limit?: number): Promise<{ items: AptGroupSearchResultItem[] }> {
    const qs = new URLSearchParams({ q });
    if (limit) qs.set('limit', String(limit));
    const body = await intelligenceJson<{ data: { items: AptGroupSearchResultItem[] } }>(`/api/intelligence/apt-groups/search?${qs.toString()}`, 'Failed to search APT groups');
    return body.data;
}
export async function getAptGroupActivity(limit = 20): Promise<AptGroupActivityItem[]> {
    const body = await intelligenceJson<{ data: { items: AptGroupActivityItem[] } }>(`/api/intelligence/apt-groups/activity?limit=${limit}`, 'Failed to load recent APT activity');
    return body.data.items;
}
export async function createAptGroupMonitor(id: number, checkIntervalMinutes?: number): Promise<{ id: number }> {
    const body = await intelligenceJson<{ data: { monitor: { id: number } } }>(`/api/intelligence/apt-groups/${id}/monitor`, 'Failed to create monitor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkIntervalMinutes })
    });
    return body.data.monitor;
}
export async function generateAptChangeSummary(id: number): Promise<AptChangeSummary> {
    const body = await intelligenceJson<{ data: AptChangeSummary }>(`/api/intelligence/apt-groups/${id}/change-summary`, 'Failed to generate change summary', { method: 'POST' });
    return body.data;
}

// ─── APT Group Intelligence Phase 3 (APT_GROUP_PHASE3.md) ──────────────────

export interface AptDigestGroup {
    actorId: number; actorName: string; changes: Record<string, number>; eventCount: number;
    riskChange: string | null; attributionChanged: boolean; priority: 'Critical' | 'High' | 'Medium' | 'Low'; priorityReason: string;
}
export interface AptActivityDigest {
    windowHours: number; availableWindows: number[]; groupsChanged: number; totalAlerts: number; highPriorityAlerts: number; requiresReviewCount: number; groups: AptDigestGroup[];
}
export interface AptLeaderboardItem {
    actorId: number; actorName: string; risk: string; status: string; openAlerts: number; newCampaigns7d: number; newIOCs7d: number; recentChanges7d: number; activityPriorityScore: number;
}
export interface AptAttributionConflict { actorId: number; actorName: string; attributionCountry: string | null; reasoning: string | null; updatedAt: string | null; note: string; }
export interface AptCrossCorrelationSignal { type: string; label: string; count: number; }
export interface AptCrossCorrelationItem { otherActorId: number; otherActorName: string; signals: AptCrossCorrelationSignal[]; confidence: 'High' | 'Medium' | 'Low' | 'Unknown'; note: string; }
export interface AptAttackTacticCoverage { tactic: string; observedCount: number; totalTechniquesInTactic: number; percentage: number; }
export interface AptAttackTechnique { techniqueId: string; name: string; tactic: string; isSubTechnique: boolean; }
export interface AptAttackAnalytics {
    actorId: number; actorName: string; tacticCoverage: AptAttackTacticCoverage[]; techniques: AptAttackTechnique[];
    newTechniques: { summary: string; observedAt: string | null }[];
    campaignSpecificTechniques: { techniqueId: string; campaignId: number; campaignName: string }[];
    mostFrequentAcrossAllApt: { techniqueId: string; name: string; actorCount: number }[];
}
export interface AptRiskEvolution { actorId: number; current: { level: string; score: number; reasons: string[] } | null; history: { summary: string; changedAt: string | null }[]; }
export interface AptAttributionEvolutionEntry { summary: string; changedBy: string; source: string; changedAt: string | null; }
export interface AptEvidenceGap { type: string; description: string; }
export interface AptEvidenceGaps { actorId: number; actorName: string; gaps: AptEvidenceGap[]; }
export interface AptGroupScorecard {
    actorId: number; actorName: string; risk: string; activeCampaigns: number; newIOCs: number; newMalware: number; newTechniques: number; recentAlerts: number; lastActivity: string | null;
}
export interface AptExecutiveSummary { executiveSummary: string; evidenceGapsSummary: string; note: string; }
export interface AptAttackSummary { attackSummary: string; note: string; }
export interface AptCrossSummary { crossAptSummary: string; note: string; }
export interface CampaignEvolution {
    campaignId: number; campaignName: string; sinceDays: number;
    current: { domains: number; ips: number; otherIocs: number; techniques: number };
    previous: { domains: number; ips: number; otherIocs: number; techniques: number };
    change: { domains: number; ips: number; otherIocs: number; techniques: number };
    malware: null; vulnerabilities: null;
    risk: { current: { level: string; score: number; reasons: string[] } | null; history: { summary: string; changedAt: string | null }[] };
    timeline: { id: number; eventType: string; summary: string; occurredAt: string | null }[];
}
export interface ThresholdTestResult {
    available: boolean; actorName?: string; counts?: Record<string, string | number>;
    thresholds?: MonitorThreshold[];
    results?: (MonitorThreshold & { actualValue: string | number; wouldTrigger: boolean })[];
    anyTriggered?: boolean; highestSeverity?: string | null;
}

export async function getAptActivityDigest(windowHours = 24): Promise<AptActivityDigest> {
    const body = await intelligenceJson<{ data: AptActivityDigest }>(`/api/intelligence/apt-groups/digest?windowHours=${windowHours}`, 'Failed to load APT activity digest');
    return body.data;
}
export async function getAptLeaderboard(limit = 10): Promise<{ items: AptLeaderboardItem[] }> {
    const body = await intelligenceJson<{ data: { items: AptLeaderboardItem[] } }>(`/api/intelligence/apt-groups/leaderboard?limit=${limit}`, 'Failed to load APT leaderboard');
    return body.data;
}
export async function getAptAttributionConflicts(): Promise<AptAttributionConflict[]> {
    const body = await intelligenceJson<{ data: { items: AptAttributionConflict[] } }>('/api/intelligence/apt-groups/attribution-conflicts', 'Failed to load attribution conflicts');
    return body.data.items;
}
export async function getAptCrossCorrelation(id: number): Promise<{ items: AptCrossCorrelationItem[] }> {
    const body = await intelligenceJson<{ data: { items: AptCrossCorrelationItem[] } }>(`/api/intelligence/apt-groups/${id}/cross-correlation`, 'Failed to load cross-APT correlation');
    return body.data;
}
export async function generateAptCrossSummary(id: number, otherActorId: number): Promise<AptCrossSummary> {
    const body = await intelligenceJson<{ data: AptCrossSummary }>(`/api/intelligence/apt-groups/${id}/cross-summary`, 'Failed to generate cross-APT summary', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ otherActorId })
    });
    return body.data;
}
export async function getAptAttackAnalytics(id: number): Promise<AptAttackAnalytics> {
    const body = await intelligenceJson<{ data: AptAttackAnalytics }>(`/api/intelligence/apt-groups/${id}/attack-analytics`, 'Failed to load ATT&CK analytics');
    return body.data;
}
export async function generateAptAttackSummary(id: number): Promise<AptAttackSummary> {
    const body = await intelligenceJson<{ data: AptAttackSummary }>(`/api/intelligence/apt-groups/${id}/attack-summary`, 'Failed to generate ATT&CK summary', { method: 'POST' });
    return body.data;
}
export async function getAptRiskEvolution(id: number): Promise<AptRiskEvolution | null> {
    try {
        const body = await intelligenceJson<{ data: AptRiskEvolution }>(`/api/intelligence/apt-groups/${id}/risk-evolution`, 'Failed to load risk evolution');
        return body.data;
    } catch { return null; }
}
export async function getAptAttributionEvolution(id: number): Promise<{ actorId: number; history: AptAttributionEvolutionEntry[] }> {
    const body = await intelligenceJson<{ data: { actorId: number; history: AptAttributionEvolutionEntry[] } }>(`/api/intelligence/apt-groups/${id}/attribution-evolution`, 'Failed to load attribution evolution');
    return body.data;
}
export async function getAptEvidenceGaps(id: number): Promise<AptEvidenceGaps> {
    const body = await intelligenceJson<{ data: AptEvidenceGaps }>(`/api/intelligence/apt-groups/${id}/evidence-gaps`, 'Failed to load evidence gaps');
    return body.data;
}
export async function getAptGroupScorecard(id: number): Promise<AptGroupScorecard> {
    const body = await intelligenceJson<{ data: AptGroupScorecard }>(`/api/intelligence/apt-groups/${id}/scorecard`, 'Failed to load scorecard');
    return body.data;
}
export async function generateAptExecutiveSummary(id: number): Promise<AptExecutiveSummary> {
    const body = await intelligenceJson<{ data: AptExecutiveSummary }>(`/api/intelligence/apt-groups/${id}/executive-summary`, 'Failed to generate executive summary', { method: 'POST' });
    return body.data;
}
export async function getCampaignEvolution(campaignId: number, sinceDays = 30): Promise<CampaignEvolution | null> {
    const body = await intelligenceJson<{ data: CampaignEvolution }>(`/api/intelligence/campaigns/${campaignId}/evolution?sinceDays=${sinceDays}`, 'Failed to load campaign evolution');
    return body.data;
}
export async function updateMonitorThresholds(monitorId: number, thresholds: MonitorThreshold[]): Promise<{ thresholds: MonitorThreshold[] }> {
    const body = await intelligenceJson<{ data: { thresholds: MonitorThreshold[] } }>(`/api/monitoring/monitors/${monitorId}/thresholds`, 'Failed to update thresholds', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thresholds })
    });
    return body.data;
}
export async function testMonitorThresholds(monitorId: number): Promise<ThresholdTestResult> {
    const body = await intelligenceJson<{ data: ThresholdTestResult }>(`/api/monitoring/monitors/${monitorId}/threshold-test`, 'Failed to test thresholds', { method: 'POST' });
    return body.data;
}
export async function getAptGroupDashboard(): Promise<AptGroupDashboard> {
    const body = await intelligenceJson<{ data: AptGroupDashboard }>('/api/intelligence/apt-groups/dashboard', 'Failed to load APT group dashboard');
    return body.data;
}
export async function getAptGroup(id: number): Promise<ThreatActorDetail> {
    const body = await intelligenceJson<{ data: { actor: ThreatActorDetail } }>(`/api/intelligence/apt-groups/${id}`, 'Failed to load APT group');
    return body.data.actor;
}
export async function createAptGroup(payload: {
    name: string; description?: string; status?: string; confidence?: string; motivation?: string;
    targetRegions?: string[]; targetSectors?: string[]; isAptGroup?: boolean;
}): Promise<ThreatActorDetail> {
    const body = await intelligenceJson<{ data: { actor: ThreatActorDetail } }>('/api/intelligence/apt-groups', 'Failed to create APT group', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    return body.data.actor;
}
export async function updateAptGroupAttribution(id: number, payload: {
    isAptGroup?: boolean; attributionCountry?: string | null; attributionConfidence?: string | null; attributionReasoning?: string | null;
}): Promise<ThreatActorDetail> {
    const body = await intelligenceJson<{ data: { actor: ThreatActorDetail } }>(`/api/intelligence/apt-groups/${id}/attribution`, 'Failed to update attribution', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    return body.data.actor;
}
export async function addAptGroupAlias(id: number, alias: string): Promise<{ id: number; alias: string }[]> {
    const body = await intelligenceJson<{ data: { aliases: { id: number; alias: string }[] } }>(`/api/intelligence/apt-groups/${id}/aliases`, 'Failed to add alias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alias })
    });
    return body.data.aliases;
}
export async function removeAptGroupAlias(id: number, aliasId: number): Promise<{ id: number; alias: string }[]> {
    const body = await intelligenceJson<{ data: { aliases: { id: number; alias: string }[] } }>(`/api/intelligence/apt-groups/${id}/aliases/${aliasId}`, 'Failed to remove alias', { method: 'DELETE' });
    return body.data.aliases;
}
export async function getAptGroupTimeline(id: number, params: { page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return intelligenceJson<{ items: AptGroupTimelineItem[]; total: number; page: number; pageSize: number }>(`/api/intelligence/apt-groups/${id}/timeline?${qs.toString()}`, 'Failed to load timeline');
}
export async function getAptGroupRelatedAlerts(id: number): Promise<AptGroupRelatedAlert[]> {
    const body = await intelligenceJson<{ data: { alerts: AptGroupRelatedAlert[] } }>(`/api/intelligence/apt-groups/${id}/alerts`, 'Failed to load related alerts');
    return body.data.alerts;
}
export async function generateAptGroupAiSummary(id: number): Promise<AptGroupAiSummary> {
    const body = await intelligenceJson<{ data: AptGroupAiSummary }>(`/api/intelligence/apt-groups/${id}/ai-summary`, 'Failed to generate AI summary', { method: 'POST' });
    return body.data;
}

export async function getMalwareList(params: { q?: string; type?: string; family?: string; confidence?: string; dateFrom?: string; dateTo?: string; threatActorId?: number; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: Malware[]; total: number; page: number; pageSize: number }>(`/api/intelligence/malware?${qs.toString()}`, 'Failed to load malware intelligence');
}

export async function getMalware(id: number): Promise<MalwareDetail> {
    const body = await intelligenceJson<{ data: { malware: MalwareDetail } }>(`/api/intelligence/malware/${id}`, 'Failed to load malware');
    return body.data.malware;
}

// MALWARE_INTELLIGENCE_PHASE1.md §7 ALIASES.
export async function addMalwareAlias(id: number, alias: string): Promise<{ aliases: MalwareAlias[] }> {
    const body = await intelligenceJson<{ data: { aliases: MalwareAlias[] } }>(`/api/intelligence/malware/${id}/aliases`, 'Failed to add alias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alias })
    });
    return body.data;
}
export async function removeMalwareAlias(id: number, aliasId: number): Promise<{ aliases: MalwareAlias[] }> {
    const body = await intelligenceJson<{ data: { aliases: MalwareAlias[] } }>(`/api/intelligence/malware/${id}/aliases/${aliasId}`, 'Failed to remove alias', { method: 'DELETE' });
    return body.data;
}
// §33 INVESTIGATION.
export async function getMalwareInvestigations(id: number): Promise<MalwareCaseRef[]> {
    const body = await intelligenceJson<{ data: MalwareCaseRef[] }>(`/api/intelligence/malware/${id}/investigations`, 'Failed to load investigations');
    return body.data;
}
// §27 TIMELINE — thin wrapper over the existing generic Timeline.
export async function getMalwareTimeline(id: number, pageSize = 20): Promise<{ items: MalwareTimelineEvent[]; total: number }> {
    return intelligenceJson<{ items: MalwareTimelineEvent[]; total: number }>(`/api/intelligence/malware/${id}/timeline?pageSize=${pageSize}`, 'Failed to load timeline');
}

// ── MALWARE_INTELLIGENCE_PHASE2.md — CTI correlation / historical
// intelligence / campaign context / analyst workspace ─────────────────────
// MALWARE_INTELLIGENCE_PHASE3.md §26/§27 — sourceTypes categorizes the
// same corroboration.sources list into upstream categories; evidenceDensity
// surfaces Evidence Count / Sources / Conflicts per relationship.
export interface MalwareCorroboration { sourceCount: number; sources: string[]; sourceTypes: string[]; corroborated: boolean; }
export interface MalwareConflict { conflictType: string; reason: string; note: string; }
export interface MalwareEvidenceDensity { supportingEvidence: number; sources: number; conflicts: number; }
export interface MalwareCorrelatedRelationship extends EntityRelationship {
    corroboration: MalwareCorroboration;
    conflict: MalwareConflict | null;
    evidenceDensity: MalwareEvidenceDensity;
}
export interface MalwareCampaignRanking {
    directRelationship: boolean; sourceCount: number; recentActivity30d: number; evidenceCount: number;
}
// §12/§13 CAMPAIGN EVOLUTION / ACTIVITY PHASE.
export interface MalwareCampaignEvolution {
    campaignId: number; firstSeen: string | null; lastSeen: string | null;
    newIocs: number; newTechniques: number; newActorRelationships: number; newMalware: number; riskChangedRecently: boolean;
    phase: 'Early' | 'Expansion' | 'Active' | 'Declining' | 'Dormant'; phaseNote: string;
}
export interface MalwareRelationshipContext {
    malwareId: number; malwareName: string;
    summary: { threatActors: number; campaigns: number; attackTechniques: number; iocs: number; vulnerabilities: number; samples: number };
    threatActors: (MalwareCorrelatedRelationship & { context: { campaignCount: number; malwareCount: number; attackTechniqueCount: number; iocCount: number } })[];
    campaigns: (MalwareCorrelatedRelationship & { ranking: MalwareCampaignRanking; context: { iocCount: number; threatActorCount: number; attackTechniqueCount: number }; evolution: MalwareCampaignEvolution | null })[];
    attackTechniques: (MalwareCorrelatedRelationship & { context: { relatedCampaigns: number; relatedActors: number } })[];
    iocsByType: Record<string, (MalwareCorrelatedRelationship & { firstSeenAt: string | null; lastSeenAt: string | null })[]>;
    vulnerabilities: MalwareCorrelatedRelationship[];
    samples: MalwareCorrelatedRelationship[];
    other: MalwareCorrelatedRelationship[];
}
export async function getMalwareRelationshipContext(id: number): Promise<MalwareRelationshipContext> {
    const body = await intelligenceJson<{ data: MalwareRelationshipContext }>(`/api/intelligence/malware/${id}/relationships`, 'Failed to load relationship context');
    return body.data;
}

export interface MalwareChangeDelta { type: string; previous: number; current: number; delta: number; }
export interface MalwareChangeReview { status: 'unreviewed' | 'reviewed' | 'dismissed'; reviewerUserId: number | null; reason: string | null; updatedAt: string | null; }
export interface MalwareChangeTimelineEntry {
    changeRef: string; date: string; change: string; entity: EntityRef;
    significance: 'Informational' | 'Notable' | 'Important' | 'Critical'; reason: string; review: MalwareChangeReview;
}
export interface MalwareChanges {
    malwareId: number; sinceDays: number; cutoff: string;
    previous: Record<string, number>; current: Record<string, number>; deltas: MalwareChangeDelta[];
    changeTimeline: MalwareChangeTimelineEntry[];
}
export async function getMalwareChanges(id: number, sinceDays = 30): Promise<MalwareChanges> {
    const body = await intelligenceJson<{ data: MalwareChanges }>(`/api/intelligence/malware/${id}/changes?sinceDays=${sinceDays}`, 'Failed to load historical changes');
    return body.data;
}
// MALWARE_INTELLIGENCE_PHASE3.md §49/§50 "ANALYST REVIEW" / "CHANGE REVIEW".
export async function setMalwareChangeReview(id: number, changeRef: string, status: 'unreviewed' | 'reviewed' | 'dismissed', reason?: string): Promise<MalwareChangeReview> {
    const body = await intelligenceJson<{ data: { status: string; reviewerUserId: number | null; reason: string | null; updatedAt: string | null } }>(
        `/api/intelligence/malware/${id}/changes/${encodeURIComponent(changeRef)}/review`, 'Failed to record review',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status, reason }) }
    );
    return body.data as MalwareChangeReview;
}

export interface MalwareActivityWeek { weekStart: string; events: number; }
export interface MalwareActivity {
    weeks: MalwareActivityWeek[]; interpretation: string;
    recentIntelligence: { action: string; previous_value: string | null; new_value: string | null; source: string; created_at: string | null; relatedEntity: EntityRef | null }[];
}
export async function getMalwareActivity(id: number, weeks = 8): Promise<MalwareActivity> {
    const body = await intelligenceJson<{ data: MalwareActivity }>(`/api/intelligence/malware/${id}/activity?weeks=${weeks}`, 'Failed to load activity');
    return body.data;
}

export interface MalwareFamilyContext {
    malwareId: number; ctiFamily: string;
    sampleSimilarityMatches: { clusterId: number; clusterKey: string; status: string; memberCount: number; familyConfidence: string | null; matchReason: string | null; note: string }[];
    ctiVsObserved: {
        techniques: { techniqueId: string; techniqueName: string; knownViaCti: boolean; observedInSample: boolean }[];
        knownIocCount: number; observedIocCount: number; sharedIocValues: string[]; note: string;
    };
}
export async function getMalwareFamilyContext(id: number): Promise<MalwareFamilyContext> {
    const body = await intelligenceJson<{ data: MalwareFamilyContext }>(`/api/intelligence/malware/${id}/family-context`, 'Failed to load family context');
    return body.data;
}

export interface MalwareRelatedAlert { id: number; severity: string; title: string; target: string; status: string; createdAt: string | null; }
export async function getMalwareAlerts(id: number): Promise<{ malwareId: number; alerts: MalwareRelatedAlert[] }> {
    const body = await intelligenceJson<{ data: { malwareId: number; alerts: MalwareRelatedAlert[] } }>(`/api/intelligence/malware/${id}/alerts`, 'Failed to load alerts');
    return body.data;
}

export interface MalwareRiskHistory {
    malwareId: number; current: { level: string; score: number; reasons: string[] } | null;
    history: { summary: string | null; changedAt: string | null }[];
}
export async function getMalwareRiskHistory(id: number): Promise<MalwareRiskHistory> {
    const body = await intelligenceJson<{ data: MalwareRiskHistory }>(`/api/intelligence/malware/${id}/risk-history`, 'Failed to load risk history');
    return body.data;
}

export interface MalwareRecommendation { action: string; target?: string; reason: string; recommended?: boolean; note?: string; }
export interface MalwareCoverageDimension { count: number; coverage: 'Good' | 'Partial' | 'Limited' | 'Unknown'; }
export interface MalwareCoverage {
    profileExists: boolean; aliasesPresent: boolean;
    threatActorLinks: MalwareCoverageDimension; campaignLinks: MalwareCoverageDimension; iocCoverage: MalwareCoverageDimension;
    attackCoverage: MalwareCoverageDimension; evidenceCoverage: MalwareCoverageDimension; sourceCoverage: MalwareCoverageDimension;
    recentActivity90d: boolean;
}
export interface MalwareThreatContext {
    malware: { id: number; name: string };
    summary: MalwareRelationshipContext['summary'];
    threatActors: { label: string; corroboration: MalwareCorroboration; conflict: MalwareConflict | null }[];
    campaigns: { label: string; ranking: MalwareCampaignRanking; context: { iocCount: number; threatActorCount: number; attackTechniqueCount: number }; evolution: MalwareCampaignEvolution | null }[];
    attackTechniques: { id: string; label: string; context: { relatedCampaigns: number; relatedActors: number } }[];
    iocCounts: Record<string, number>;
    risk: { level: string; score: number; reasons: string[] } | null;
    recentActivity: { interpretation: string; weeks: MalwareActivityWeek[] } | null;
    recentIntelligence: { event: string; summary: string | null; date: string | null; relatedEntity: EntityRef | null }[];
    investigations: { caseNumber: string; title: string; status: string }[];
    openAlerts: number;
    mispMatchCount: number;
    // MALWARE_INTELLIGENCE_PHASE3.md fields.
    activityBurst: { elevated?: boolean; status?: string; label: string };
    conflicts: { conflictType: string; source: string; statement: string; note: string }[];
    coverage: MalwareCoverage | null;
    intelligenceGaps: string[];
    recommendations: MalwareRecommendation[];
    note: string;
}
export async function getMalwareThreatContext(id: number): Promise<MalwareThreatContext> {
    const body = await intelligenceJson<{ data: MalwareThreatContext }>(`/api/intelligence/malware/${id}/context`, 'Failed to load threat context');
    return body.data;
}

export interface MalwareComparisonField { shared: string[]; onlyA: string[]; onlyB: string[]; }
export interface MalwareComparison {
    malwareA: { id: number; name: string }; malwareB: { id: number; name: string };
    aliases: MalwareComparisonField;
    threatActors: MalwareComparisonField; campaigns: MalwareComparisonField;
    attackTechniques: MalwareComparisonField; iocs: MalwareComparisonField; vulnerabilities: MalwareComparisonField;
    risk: { a: { level: string; score: number } | null; b: { level: string; score: number } | null };
    note: string;
}
export async function compareMalware(idA: number, idB: number): Promise<MalwareComparison> {
    const body = await intelligenceJson<{ data: MalwareComparison }>(`/api/intelligence/malware/compare?a=${idA}&b=${idB}`, 'Failed to compare malware');
    return body.data;
}

export interface MalwareCorrelationSearchResult { query: string; matched: { type: string; id: string; label: string } | null; results: EntityRef[]; }
export async function searchMalwareCorrelation(q: string): Promise<MalwareCorrelationSearchResult> {
    const body = await intelligenceJson<{ data: MalwareCorrelationSearchResult }>(`/api/intelligence/malware/search-correlation?q=${encodeURIComponent(q)}`, 'Failed to search');
    return body.data;
}

// ── MALWARE_INTELLIGENCE_PHASE3.md — advanced CTI, evolution, operational
// monitoring, AI analysis & intelligence production ────────────────────────
export interface MalwareActivityBurst {
    malwareId: number; status: 'ok' | 'insufficient_data'; reason?: string;
    baseline?: { days: number; events: number; perDay: number }; current?: { days: number; events: number; perDay: number };
    elevated?: boolean; label: string; note?: string;
}

export interface MalwareAssessment {
    malwareId: number; malwareName: string;
    activityBurst: MalwareActivityBurst;
    familyActivity: { malwareId: number; family: string | null; note?: string; members?: { id: number; name: string }[]; memberCount?: number; campaigns?: number; actors?: number; iocs?: number; recentActivity30d?: number };
    actorEvolution: { newActorAssociations: (EntityRef & { change: string })[] };
    attackEvolution: { newTechniques: string[]; label?: string };
    iocEvolution: { newCount: number; reappearedCount: number; expiredCount: number };
    conflicts: { conflictType: string; source: string; statement: string; note: string }[];
    coverage: MalwareCoverage | null;
    gaps: string[];
    recommendations: MalwareRecommendation[];
    note: string;
}
export async function getMalwareAssessment(id: number): Promise<MalwareAssessment> {
    const body = await intelligenceJson<{ data: MalwareAssessment }>(`/api/intelligence/malware/${id}/assessment`, 'Failed to load assessment');
    return body.data;
}

export interface MalwareEvolutionBundle {
    actor: { malwareId: number; previous: EntityRef[]; current: EntityRef[]; newActorAssociations: (EntityRef & { change: string })[]; note: string };
    attack: { malwareId: number; previous: string[]; current: string[]; newTechniques: string[]; label: string; note: string };
    ioc: {
        malwareId: number; sinceDays: number;
        newIocs: { id: number; type: string; value: string; status: string; firstSeenAt: string | null; lastSeenAt: string | null }[];
        reappeared: { id: number; type: string; value: string; change: string; reason: string }[];
        infrastructure: { id: number; type: string; value: string; change: string; firstSeen: string | null }[];
        expired: { id: number; type: string; value: string; status: string }[];
        note: string;
    };
    familyActivity: MalwareAssessment['familyActivity'];
}
export async function getMalwareEvolution(id: number, sinceDays = 30): Promise<MalwareEvolutionBundle> {
    const body = await intelligenceJson<{ data: MalwareEvolutionBundle }>(`/api/intelligence/malware/${id}/evolution?sinceDays=${sinceDays}`, 'Failed to load evolution');
    return body.data;
}

export interface MalwareRelationshipPathHop { from: string; to: string; entity: EntityRef; source: string | null; }
export interface MalwareRelationshipPath { hops: MalwareRelationshipPathHop[]; sources: string[]; sameSourceLineageAs?: number[]; }
export interface MalwareRelationshipPaths { malwareId: number; target: EntityRef; pathCount: number; paths: MalwareRelationshipPath[]; note?: string; }
export async function getMalwareRelationshipPaths(id: number, targetType: string, targetId: string): Promise<MalwareRelationshipPaths> {
    const body = await intelligenceJson<{ data: MalwareRelationshipPaths }>(`/api/intelligence/malware/${id}/paths?targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`, 'Failed to load relationship paths');
    return body.data;
}

export async function getVulnerabilities(params: { q?: string; severity?: string; minCvss?: number; vendor?: string; product?: string; exploitAvailability?: string; knownExploitation?: string; dateFrom?: string; dateTo?: string; sort?: string; order?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: Vulnerability[]; total: number; page: number; pageSize: number; totalPages: number }>(`/api/intelligence/vulnerabilities?${qs.toString()}`, 'Failed to load vulnerabilities');
}

export async function getVulnerability(cveId: string): Promise<VulnerabilityDetail> {
    const body = await intelligenceJson<{ data: { vulnerability: VulnerabilityDetail } }>(`/api/intelligence/vulnerabilities/${encodeURIComponent(cveId)}`, 'Failed to load vulnerability');
    return body.data.vulnerability;
}

export async function lookupVulnerability(cveId: string): Promise<VulnerabilityDetail> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/intelligence/vulnerabilities/lookup`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ cveId })
    });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to look up vulnerability');
    return (body as any).data.vulnerability;
}

/** Admin-only: trigger an NVD CVE sync (incremental or initial backfill). */
export async function syncVulnerabilities(mode: 'incremental' | 'initial' = 'incremental', maxPages?: number): Promise<{ ok: boolean; mode: string; pages: number; cvesFetched: number; cvesUpserted: number; cvesFailed: number; rateLimited: boolean }> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/intelligence/vulnerabilities/sync`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, maxPages })
    });
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    if (res.status === 409) throw new Error('A sync is already in progress. Try again in a moment.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to sync vulnerabilities');
    return (body as any).data.sync;
}

export async function getCorrelationDashboard(): Promise<CorrelationDashboard> {
    const body = await intelligenceJson<{ data: CorrelationDashboard }>('/api/intelligence/correlation', 'Failed to load correlation dashboard');
    return body.data;
}

export async function getRelationshipGraph(entityType: string, entityId: string | number, depth = 1): Promise<RelationshipGraph> {
    const body = await intelligenceJson<{ data: RelationshipGraph }>(`/api/intelligence/graph/${entityType}/${entityId}?depth=${depth}`, 'Failed to load relationship graph');
    return body.data;
}

export async function getEntityRelationships(entityType: string, entityId: string | number): Promise<EntityRelationship[]> {
    const body = await intelligenceJson<{ data: { relationships: EntityRelationship[] } }>(`/api/intelligence/relationships/${entityType}/${entityId}`, 'Failed to load relationships');
    return body.data.relationships;
}

// ─── Threat Intelligence Phase 3 (THREAT_INTELLIGENCE_MODULE_PHASE3.md) ────

export type Phase3EntityType = 'ioc' | 'campaign' | 'threat_actor' | 'malware' | 'vulnerability' | 'attack_technique';

// THREAT_BRIEF_PHASE1.md — "Threat Brief" is this SAME Intelligence Report
// record, with additive fields/lifecycle states (see database/storage.js's
// §1 comment for the full reuse rationale). status now covers the full
// Draft → Review → Published → Archived lifecycle.
export interface IntelligenceReport {
    id: number; title: string; report_type: string; classification: string;
    threat_category: string | null; severity: string | null; confidence: string | null;
    executive_summary: string | null; threat_overview: string | null; key_findings: string[];
    analyst_assessment: string | null; recommendations: string | null; ai_summary_draft: string | null;
    // THREAT_BRIEF_PHASE2.md §14/§5 — the full multi-section AI suggestion
    // and the source context this brief was generated from, if any.
    ai_draft: ThreatBriefAiDraft | null; context_type: string | null; context_id: string | null;
    status: 'draft' | 'review' | 'published' | 'archived'; created_by_user_id: number; author_username: string | null;
    audience: string | null; reporting_period_start: string | null; reporting_period_end: string | null;
    created_at: string | null; updated_at: string | null; published_at: string | null; archived_at: string | null;
    entity_count?: number;
    // THREAT_BRIEF_PHASE3.md §5/§26/§32/§33
    freshness_status: 'current' | 'updates_available' | 'stale';
    last_change_check_at: string | null; pending_change_summary: unknown | null; stale_after_days: number | null;
    current_revision: number; ai_executive: unknown | null;
}
export interface ReportEntity { entity_type: string; entity_id: string; section: string | null; entity: EntityRef; resolved?: boolean; added_at: string | null; }
export interface ReportDetail extends IntelligenceReport { entities: ReportEntity[]; }
export interface ReportTimelineItem {
    id: number; action: string; previousValue: string | null; newValue: string | null;
    source: string; username: string | null; createdAt: string | null;
}
export interface ReportRiskItem { entity_type: string; entity_id: string; label: string; risk: RiskAssessmentResult | null; unsupported: boolean; }
export interface ReportRiskAssessment { reportId: number; items: ReportRiskItem[]; }
export interface ReportsMetadata { reportTypes: string[]; threatCategories: string[]; severityLevels: string[]; confidenceLevels: string[]; statuses: string[]; }

// ── Threat Briefs Phase 2 (THREAT_BRIEF_PHASE2.md) ──
export type ThreatBriefContextType = 'threat_actor' | 'campaign' | 'ioc' | 'malware' | 'vulnerability' | 'brand' | 'company' | 'social_investigation' | 'alert' | 'monitor' | 'telegram_source';
export interface ThreatBriefTemplate { label: string; contextTypes: string[]; sections: string[]; }
export interface RankedEvidenceItem {
    id: number; source: string; url: string | null; description: string | null; confidence: string | null;
    username: string | null; created_at: string | null; entity_type: string; entity_id: string;
    score: number; rank: 'primary' | 'supporting' | 'contextual'; reasons: string[];
}
export interface ThreatBriefFinding { entity_type: string; entity_id: string; label: string; statement: string; sources: string[]; observedAt: string | null; confidence: string; }
export interface ThreatBriefRecommendation { action: string; targetType: string; targetId: string; targetLabel: string | null; reason: string; }
export interface ThreatBriefTimelineEvent { timestamp: string; label: string; source: string; eventType: string; }
export interface ThreatBriefRiskAggregate {
    primary: (RiskAssessmentResult & { relatedType?: string; relatedId?: string }) | null;
    contributors: (RiskAssessmentResult & { relatedType: string; relatedId: string })[];
    overallScore: number; overallLevel: string; explanation: string[];
}
export interface ThreatBriefAlertsAggregate { open: number; resolved: number; items: { id: number; severity: string; title: string; target: string; status: string; created_at: string | null }[]; }
export interface ThreatBriefMonitoringAggregate { monitors: { id: number; type: string; target: string; label: string | null; status: string; lastCheckedAt: string | null; lastSuccessAt: string | null; lastError: string | null }[]; }
export interface ThreatBriefInvestigationAggregate { id: number; target: string; status: string; createdAt: string | null; accountCount: number; correlationCount: number; risk: RiskAssessmentResult | null; recentTimeline: unknown[]; }
export interface ThreatBriefContext {
    primary: EntityRef; contextType: string; contextId: string;
    relatedEntities: RelationshipGraphNode[]; relatedByType: Record<string, number>;
    indicators: RelationshipGraphNode[]; risk: ThreatBriefRiskAggregate; evidence: RankedEvidenceItem[];
    timeline: ThreatBriefTimelineEvent[]; alerts: ThreatBriefAlertsAggregate; monitoring: ThreatBriefMonitoringAggregate;
    investigation: ThreatBriefInvestigationAggregate | null; findings: ThreatBriefFinding[]; recommendations: ThreatBriefRecommendation[];
    graphTruncated: boolean;
}
export interface ThreatBriefAiDraft {
    executiveSummary: string; threatOverview: string; keyFindings: string[]; affectedEntitiesSummary: string;
    threatContext: string; timelineSummary: string; riskSummary: string; recommendations: string[]; note: string;
}
export interface ThreatBriefJob {
    id: number; report_id: number | null; context_type: string; context_id: string; template_key: string | null;
    request_ai_draft: boolean; status: 'queued' | 'collecting_evidence' | 'aggregating' | 'generating_draft' | 'finalizing' | 'completed' | 'partial' | 'failed' | 'cancelled';
    progress_current: number; progress_total: number; progress_label: string | null;
    ai_status: 'pending' | 'generated' | 'unavailable' | 'failed' | 'skipped'; last_error: string | null;
    is_schedule_definition: boolean; schedule_frequency: 'none' | 'daily' | 'weekly';
    max_records: number | null; retention_days: number | null; next_run_at: string | null;
    created_by_user_id: number; created_at: string | null; started_at: string | null; completed_at: string | null;
}
export interface EvidenceRanking { evidence_id: number; rank: 'primary' | 'supporting' | 'contextual'; included: boolean; reasons: string[]; }
export interface QualityCheckResult { canPublish: boolean; issues: string[]; insufficientEvidence: boolean; }

export async function getThreatBriefContextTypes(): Promise<{ contextTypes: string[]; templates: Record<string, ThreatBriefTemplate> }> {
    const body = await intelligenceJson<{ data: { contextTypes: string[]; templates: Record<string, ThreatBriefTemplate> } }>('/api/intelligence/threat-brief-context-types', 'Failed to load context types');
    return body.data;
}
export async function getThreatBriefContext(contextType: string, contextId: string | number): Promise<ThreatBriefContext> {
    const body = await intelligenceJson<{ data: ThreatBriefContext }>(`/api/intelligence/threat-brief-context/${contextType}/${contextId}`, 'Failed to collect context');
    return body.data;
}
export async function createThreatBriefJob(payload: { contextType: string; contextId: string | number; templateKey?: string; requestAiDraft?: boolean }) {
    return intelligenceJson<{ data: { id: number } }>('/api/intelligence/threat-brief-jobs', 'Failed to create job', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function getThreatBriefJobs(params: { page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return intelligenceJson<{ items: ThreatBriefJob[]; total: number; page: number; pageSize: number }>(`/api/intelligence/threat-brief-jobs?${qs.toString()}`, 'Failed to load jobs');
}
export async function getThreatBriefJob(id: number): Promise<ThreatBriefJob> {
    const body = await intelligenceJson<{ data: { job: ThreatBriefJob } }>(`/api/intelligence/threat-brief-jobs/${id}`, 'Failed to load job');
    return body.data.job;
}
export async function cancelThreatBriefJob(id: number) {
    return intelligenceJson(`/api/intelligence/threat-brief-jobs/${id}/cancel`, 'Failed to cancel job', { method: 'POST' });
}
export async function getReportQualityCheck(reportId: number): Promise<QualityCheckResult> {
    const body = await intelligenceJson<{ data: QualityCheckResult }>(`/api/intelligence/reports/${reportId}/quality-check`, 'Failed to check report quality');
    return body.data;
}
export async function publishReportForced(id: number, force = false) {
    return intelligenceJson(`/api/intelligence/reports/${id}/publish`, 'Failed to publish report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) });
}
export async function regenerateReportAiDraft(reportId: number, analystContext?: string): Promise<ThreatBriefAiDraft> {
    const body = await intelligenceJson<{ data: ThreatBriefAiDraft }>(`/api/intelligence/reports/${reportId}/regenerate-ai-draft`, 'Failed to regenerate AI draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ analystContext }) });
    return body.data;
}
export async function getReportEvidenceRankings(reportId: number): Promise<EvidenceRanking[]> {
    const body = await intelligenceJson<{ data: { rankings: EvidenceRanking[] } }>(`/api/intelligence/reports/${reportId}/evidence-rankings`, 'Failed to load evidence rankings');
    return body.data.rankings;
}
export async function setEvidenceRank(reportId: number, evidenceId: number, payload: { rank?: string; included?: boolean; reasons?: string[] }) {
    return intelligenceJson(`/api/intelligence/reports/${reportId}/evidence/${evidenceId}/rank`, 'Failed to update evidence rank', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

// ── Threat Briefs Phase 3 (THREAT_BRIEF_PHASE3.md) ──
export interface ChangeSummary {
    newRelatedEntities: string[]; removedRelatedEntities: string[]; newIocs: string[]; removedIocs: string[]; newAlerts: string[];
    riskChanged: boolean; riskFrom: string | null; riskTo: string | null; evidenceDelta: number; isMeaningful: boolean; lines: string[];
}
export interface FreshnessInfo {
    freshness_status: 'current' | 'updates_available' | 'stale'; last_change_check_at: string | null;
    pending_change_summary: ChangeSummary | null; stale_after_days: number | null; published_at: string | null;
}
export interface RevisionEntitySnapshot { type: string; id: string; label: string; }
export interface RevisionEvidenceSnapshot { id: number; source: string; confidence: string | null; rank: string; }
export interface ReportRevision {
    id: number; report_id: number; revision_number: number; title: string; report_type: string | null; classification: string | null;
    threat_category: string | null; severity: string | null; confidence: string | null; executive_summary: string | null; threat_overview: string | null;
    key_findings: string[]; analyst_assessment: string | null; recommendations: string | null;
    entities: RevisionEntitySnapshot[]; evidence: RevisionEvidenceSnapshot[];
    comparison_snapshot: Record<string, unknown> | null; change_summary: { fieldChanges: unknown; contextChanges: ChangeSummary | null } | null;
    published_at: string | null; published_by_username: string | null; created_at: string | null;
}
export interface RevisionComparison {
    a: { revision: number | 'current'; severity: string | null; confidence: string | null };
    b: { revision: number | 'current'; severity: string | null; confidence: string | null };
    severityChanged: boolean; confidenceChanged: boolean;
    newFindings: string[]; removedFindings: string[];
    newEntities: RevisionEntitySnapshot[]; removedEntities: RevisionEntitySnapshot[];
    newEvidence: RevisionEvidenceSnapshot[];
}
export interface TrendMetric { label: string; current?: number; previous?: number; changePct?: number; interpretation?: string; insufficientData: boolean; reason?: string; }
export interface ThreatTrendResult { contextType: string; contextId: string; window: string; days: number; metrics: Record<string, TrendMetric>; }
export interface BriefPriority { level: 'Critical' | 'High' | 'Medium' | 'Low'; score: number; reasons: string[]; }
export interface BriefQualityScore { score: number; missing: string[]; }
export interface ExecutiveBriefView {
    threat: string; severity: string | null; confidence: string | null; currentStatus: string;
    businessImpact: string | null; affectedEntities: string[]; keyEvidence: { source: string; description: string | null; confidence: string | null }[];
    trendAvailable: boolean; currentRisk: { level: string; score: number } | null; recommendedAction: string | null;
    keyChange: string | null; generatedFromAi: boolean;
}
export interface AiExecutiveSummary { threat: string; businessImpact: string; keyChange: string; recommendedAction: string; note: string; }
export interface AiChangeSummaryResult { summary: string; note: string; }
export interface BriefingDashboard {
    activeBriefs: number; publishedBriefs: number; drafts: number; inReview: number; archived: number;
    updatesAvailable: number; staleBriefs: number; highRisk: number; critical: number; scheduledBriefs: number;
    recentChanges: { id: number; reportId: number; action: string; newValue: string | null; username: string | null; createdAt: string | null }[];
}

export async function getReportFreshness(reportId: number): Promise<FreshnessInfo> {
    const body = await intelligenceJson<{ data: FreshnessInfo }>(`/api/intelligence/reports/${reportId}/freshness`, 'Failed to load freshness status');
    return body.data;
}
export async function checkReportUpdates(reportId: number) {
    return intelligenceJson<{ data: { reportId: number; freshnessStatus: string; changeSummary: ChangeSummary | null; isStale: boolean } | { skipped: true; reason: string } }>(`/api/intelligence/reports/${reportId}/check-updates`, 'Failed to check for updates', { method: 'POST' }).then((b) => b.data);
}
export async function createReportRevision(reportId: number) {
    return intelligenceJson(`/api/intelligence/reports/${reportId}/create-revision`, 'Failed to create revision', { method: 'POST' });
}
export async function getReportRevisions(reportId: number): Promise<ReportRevision[]> {
    const body = await intelligenceJson<{ data: { revisions: ReportRevision[] } }>(`/api/intelligence/reports/${reportId}/revisions`, 'Failed to load revisions');
    return body.data.revisions;
}
export async function compareReportRevisions(reportId: number, a: number | 'current', b: number | 'current'): Promise<RevisionComparison> {
    const body = await intelligenceJson<{ data: RevisionComparison }>(`/api/intelligence/reports/${reportId}/revisions/compare?a=${a}&b=${b}`, 'Failed to compare revisions');
    return body.data;
}
export async function getReportTrend(reportId: number, window: '24h' | '7d' | '30d' | '90d' = '7d'): Promise<ThreatTrendResult & { insufficientContext?: boolean }> {
    const body = await intelligenceJson<{ data: ThreatTrendResult & { insufficientContext?: boolean } }>(`/api/intelligence/reports/${reportId}/trend?window=${window}`, 'Failed to compute trend');
    return body.data;
}
export async function getReportPriority(reportId: number): Promise<BriefPriority> {
    const body = await intelligenceJson<{ data: BriefPriority }>(`/api/intelligence/reports/${reportId}/priority`, 'Failed to compute priority');
    return body.data;
}
export async function getReportQualityScore(reportId: number): Promise<BriefQualityScore> {
    const body = await intelligenceJson<{ data: BriefQualityScore }>(`/api/intelligence/reports/${reportId}/quality-score`, 'Failed to compute quality score');
    return body.data;
}
export async function getExecutiveBriefView(reportId: number): Promise<ExecutiveBriefView> {
    const body = await intelligenceJson<{ data: ExecutiveBriefView }>(`/api/intelligence/reports/${reportId}/executive-view`, 'Failed to load executive view');
    return body.data;
}
export async function generateAiExecutiveSummary(reportId: number): Promise<AiExecutiveSummary> {
    const body = await intelligenceJson<{ data: AiExecutiveSummary }>(`/api/intelligence/reports/${reportId}/ai-executive-summary`, 'Failed to generate executive summary', { method: 'POST' });
    return body.data;
}
export async function generateAiChangeSummary(reportId: number): Promise<AiChangeSummaryResult> {
    const body = await intelligenceJson<{ data: AiChangeSummaryResult }>(`/api/intelligence/reports/${reportId}/ai-change-summary`, 'Failed to generate change summary', { method: 'POST' });
    return body.data;
}
export async function distributeReport(reportId: number, method: 'download' | 'dashboard' | 'repository', recipientUserId?: number) {
    return intelligenceJson<{ data: { distributed: boolean; method: string; recipientUsername: string | null } }>(`/api/intelligence/reports/${reportId}/distribute`, 'Failed to distribute report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, recipientUserId }) }).then((b) => b.data);
}
export async function getBriefingDashboard(): Promise<BriefingDashboard> {
    const body = await intelligenceJson<{ data: BriefingDashboard }>('/api/intelligence/briefing-dashboard', 'Failed to load briefing dashboard');
    return body.data;
}
export async function downloadReportExportMode(reportId: number, title: string, mode: 'analyst' | 'executive') {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/intelligence/reports/${reportId}/export?mode=${mode}`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    if (!res.ok) throw new Error('Failed to export report');
    const blob = await res.blob();
    downloadBlob(blob, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'threat-brief'}-${mode}.json`);
}

export interface HuntResult {
    target: string; ioc: Ioc | null; relationships: EntityRelationship[];
    campaigns: { id: number; name: string; status: string; severity: string | null }[];
    threatActors: { id: number; name: string; status: string; confidence: string }[];
    malware: { id: number; name: string; type: string | null; confidence: string }[];
    vulnerabilities: { id: number; cve_id: string; severity: string | null; cvss: number | null }[];
    techniques: { technique_id: string; name: string; tactic: string; tactics: string[] }[];
    investigations: { id: number; module: string; target: string; risk_level: string | null; created_at: string | null }[];
    alerts: { id: number; severity: string; title: string; target: string; status: string; created_at: string | null }[];
    monitors: { id: number; type: string; status: string }[];
    timeline: { timestamp: string; label: string; source: string }[];
}

export interface IntelligenceHistoryItem {
    id: number; entity_type: string; entity_id: string; entity: EntityRef;
    action: string; previous_value: string | null; new_value: string | null;
    source: string; username: string | null; created_at: string | null;
}

export interface RiskAssessmentResult { entityType: string; entityId: string; score: number; level: string; confidence: string; reasons: string[]; }
export interface AnalystAssessment {
    id: number; assessment: string; confidence: string; reasoning: string | null;
    recommendation: string | null; notes: string | null; username: string | null; created_at: string | null;
}

export interface IntelligenceWorkspace {
    id: number; name: string; description: string | null; created_by_user_id: number;
    created_at: string | null; updated_at: string | null; entity_count?: number;
}
export interface WorkspaceEntity { entity_type: string; entity_id: string; entity: EntityRef; added_at: string | null; }
export interface WorkspaceNote { id: number; note: string; username: string | null; created_at: string | null; }
export interface WorkspaceDetail extends IntelligenceWorkspace { entities: WorkspaceEntity[]; notes: WorkspaceNote[]; }

export interface EvidenceItem {
    id: number; source: string; url: string | null; description: string | null;
    confidence: string | null; username: string | null; created_at: string | null;
}

export interface SearchResultItem { type: string; id: string; label: string; meta: string | null; }

// ── Reports / Threat Briefs ──
export async function getReportsMetadata(): Promise<ReportsMetadata> {
    const body = await intelligenceJson<{ data: ReportsMetadata }>('/api/intelligence/reports-metadata', 'Failed to load report metadata');
    return body.data;
}
export async function getReports(params: { q?: string; status?: string; reportType?: string; threatCategory?: string; severity?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: IntelligenceReport[]; total: number; page: number; pageSize: number }>(`/api/intelligence/reports?${qs.toString()}`, 'Failed to load reports');
}
export async function createReport(payload: {
    title: string; reportType: string; classification?: string; threatCategory?: string; severity?: string; confidence?: string;
    executiveSummary?: string; threatOverview?: string; keyFindings?: string[]; analystAssessment?: string; recommendations?: string;
    audience?: string; reportingPeriodStart?: string; reportingPeriodEnd?: string;
}) {
    return intelligenceJson<{ data: { id: number } }>('/api/intelligence/reports', 'Failed to create report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function getReport(id: number): Promise<ReportDetail> {
    const body = await intelligenceJson<{ data: { report: ReportDetail } }>(`/api/intelligence/reports/${id}`, 'Failed to load report');
    return body.data.report;
}
export async function updateReportFields(id: number, fields: Partial<{
    title: string; report_type: string; classification: string; threat_category: string; severity: string; confidence: string;
    executive_summary: string; threat_overview: string; key_findings: string[]; analyst_assessment: string; recommendations: string;
    audience: string; reporting_period_start: string; reporting_period_end: string;
}>) {
    return intelligenceJson(`/api/intelligence/reports/${id}`, 'Failed to update report', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
}
export async function deleteReport(id: number) {
    return intelligenceJson(`/api/intelligence/reports/${id}`, 'Failed to delete report', { method: 'DELETE' });
}
// §4 lifecycle — Draft → Review → Published → Archived.
export async function submitReportForReview(id: number) {
    return intelligenceJson(`/api/intelligence/reports/${id}/submit-for-review`, 'Failed to submit report for review', { method: 'POST' });
}
export async function publishReport(id: number) {
    return intelligenceJson(`/api/intelligence/reports/${id}/publish`, 'Failed to publish report', { method: 'POST' });
}
export async function archiveReport(id: number) {
    return intelligenceJson(`/api/intelligence/reports/${id}/archive`, 'Failed to archive report', { method: 'POST' });
}
export async function addReportEntity(reportId: number, entityType: string, entityId: string | number, section?: string) {
    return intelligenceJson(`/api/intelligence/reports/${reportId}/entities`, 'Failed to add entity to report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId, section }) });
}
export async function removeReportEntity(reportId: number, entityType: string, entityId: string | number) {
    return intelligenceJson(`/api/intelligence/reports/${reportId}/entities/${entityType}/${entityId}`, 'Failed to remove entity from report', { method: 'DELETE' });
}
export async function getReportTimeline(reportId: number, params: { page?: number; pageSize?: number } = {}): Promise<{ items: ReportTimelineItem[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return intelligenceJson(`/api/intelligence/reports/${reportId}/timeline?${qs.toString()}`, 'Failed to load report timeline');
}
export async function getReportRiskAssessment(reportId: number): Promise<ReportRiskAssessment> {
    const body = await intelligenceJson<{ data: ReportRiskAssessment }>(`/api/intelligence/reports/${reportId}/risk`, 'Failed to load report risk assessment');
    return body.data;
}
export async function generateReportAiSummary(reportId: number): Promise<{ draftSummary: string; note?: string }> {
    const body = await intelligenceJson<{ data: { draftSummary: string; note?: string } }>(`/api/intelligence/reports/${reportId}/ai-summary`, 'Failed to generate AI summary', { method: 'POST' });
    return body.data;
}
// §24 — JSON export (the guaranteed-available minimum; see server.js route
// comment for why PDF isn't built in Phase 1). Downloads via the browser's
// normal authenticated fetch rather than a bare <a href>, since the API
// requires the Authorization header fetchWithAuth attaches.
export async function downloadReportExport(reportId: number, title: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/intelligence/reports/${reportId}/export`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    if (!res.ok) throw new Error('Failed to export report');
    const blob = await res.blob();
    downloadBlob(blob, `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60) || 'threat-brief'}.json`);
}

// ── Threat Hunting ──
export async function huntIntelligence(target: string): Promise<HuntResult> {
    const body = await intelligenceJson<{ data: HuntResult }>(`/api/intelligence/hunt?target=${encodeURIComponent(target)}`, 'Failed to search intelligence');
    return body.data;
}

// ── Intelligence History ──
export async function getIntelligenceHistory(params: { q?: string; entityType?: string; action?: string; source?: string; userId?: number; dateFrom?: string; dateTo?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: IntelligenceHistoryItem[]; total: number; page: number; pageSize: number }>(`/api/intelligence/history?${qs.toString()}`, 'Failed to load intelligence history');
}

// ── Risk & Assessment ──
export async function getEntityRisk(entityType: string, entityId: string | number): Promise<RiskAssessmentResult | null> {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/intelligence/risk/${entityType}/${entityId}`);
    if (res.status === 404) return null;
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || 'Failed to compute risk');
    return (body as any).data.risk;
}
export async function getEntityAssessments(entityType: string, entityId: string | number): Promise<AnalystAssessment[]> {
    const body = await intelligenceJson<{ data: { assessments: AnalystAssessment[] } }>(`/api/intelligence/assessments/${entityType}/${entityId}`, 'Failed to load assessments');
    return body.data.assessments;
}
export async function createAssessment(payload: { entityType: string; entityId: string | number; assessment: string; confidence?: string; reasoning?: string; recommendation?: string; notes?: string }) {
    return intelligenceJson<{ data: { id: number } }>('/api/intelligence/assessments', 'Failed to create assessment', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}

// ── Intelligence Workspace ──
export async function getWorkspaces(params: { q?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: IntelligenceWorkspace[]; total: number; page: number; pageSize: number }>(`/api/intelligence/workspaces?${qs.toString()}`, 'Failed to load workspaces');
}
export async function createWorkspace(payload: { name: string; description?: string }) {
    return intelligenceJson<{ data: { id: number } }>('/api/intelligence/workspaces', 'Failed to create workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function getWorkspace(id: number): Promise<WorkspaceDetail> {
    const body = await intelligenceJson<{ data: { workspace: WorkspaceDetail } }>(`/api/intelligence/workspaces/${id}`, 'Failed to load workspace');
    return body.data.workspace;
}
export async function deleteWorkspace(id: number) {
    return intelligenceJson(`/api/intelligence/workspaces/${id}`, 'Failed to delete workspace', { method: 'DELETE' });
}
export async function addWorkspaceEntity(workspaceId: number, entityType: string, entityId: string | number) {
    return intelligenceJson(`/api/intelligence/workspaces/${workspaceId}/entities`, 'Failed to add entity to workspace', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId }) });
}
export async function removeWorkspaceEntity(workspaceId: number, entityType: string, entityId: string | number) {
    return intelligenceJson(`/api/intelligence/workspaces/${workspaceId}/entities/${entityType}/${entityId}`, 'Failed to remove entity from workspace', { method: 'DELETE' });
}
export async function addWorkspaceNote(workspaceId: number, note: string) {
    return intelligenceJson<{ data: { id: number } }>(`/api/intelligence/workspaces/${workspaceId}/notes`, 'Failed to add note', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }).then((b) => b.data);
}
export async function addToWatchlist(workspaceId: number, entityType: string, entityId: string | number): Promise<{ monitorId: number }> {
    const body = await intelligenceJson<{ data: { monitorId: number } }>(`/api/intelligence/workspaces/${workspaceId}/watchlist`, 'Failed to add to watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId }) });
    return body.data;
}

// ── Evidence ──
export async function getEvidence(entityType: string, entityId: string | number): Promise<EvidenceItem[]> {
    const body = await intelligenceJson<{ data: { evidence: EvidenceItem[] } }>(`/api/intelligence/evidence/${entityType}/${entityId}`, 'Failed to load evidence');
    return body.data.evidence;
}
export async function addEvidence(payload: { entityType: string; entityId: string | number; source: string; url?: string; description?: string; confidence?: string }) {
    return intelligenceJson<{ data: { id: number } }>('/api/intelligence/evidence', 'Failed to add evidence', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function deleteEvidence(id: number) {
    return intelligenceJson(`/api/intelligence/evidence/${id}`, 'Failed to delete evidence', { method: 'DELETE' });
}

// ── Unified Search ──
export async function searchIntelligence(q: string): Promise<SearchResultItem[]> {
    const body = await intelligenceJson<{ items: SearchResultItem[] }>(`/api/intelligence/search?q=${encodeURIComponent(q)}`, 'Search failed');
    return body.items;
}

// ── Knowledge Base (KNOWLEDGE_BASE_PHASE1.md) ──
export type KnowledgeStatus = 'draft' | 'review' | 'published' | 'archived';
export type KnowledgeConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';
export interface KnowledgeMetadata { categories: string[]; confidenceLevels: KnowledgeConfidence[]; statuses: KnowledgeStatus[]; sourceTypes: string[]; relationshipTypes: string[]; coverageDimensions: string[]; }
export interface KnowledgeEntry {
    id: number; title: string; slug: string; summary: string | null; content: string | null;
    category: string; confidence: KnowledgeConfidence; status: KnowledgeStatus; current_revision: number;
    created_by_user_id: number; author_username: string | null; updated_by_user_id: number | null; published_by_user_id: number | null;
    created_at: string | null; updated_at: string | null; published_at: string | null; archived_at: string | null; last_reviewed_at: string | null;
    last_reviewed_by_user_id: number | null;
    // KNOWLEDGE_BASE_PHASE2.md §32/§34 "KNOWLEDGE FRESHNESS" / "STALE KNOWLEDGE"
    review_status?: 'current' | 'review_recommended';
    // KNOWLEDGE_BASE_PHASE3.md §5/§9/§10/§22
    review_recommended: boolean; review_recommended_reason: string | null; review_recommended_at: string | null;
    review_interval_days: number | null; last_health_check_at: string | null;
    tags: string[];
}
export interface KnowledgeSourceItem { id: number; source_type: string; description: string | null; username: string | null; created_at: string | null; }
export interface KnowledgeReferenceItem {
    id: number; title: string; url: string | null; source: string | null;
    published_date: string | null; accessed_date: string | null; notes: string | null; username: string | null; created_at: string | null;
    // KNOWLEDGE_BASE_PHASE3.md §7 "SOURCE CHANGE DETECTION"
    availability_status: 'unknown' | 'available' | 'unavailable'; availability_checked_at: string | null;
}
export interface KnowledgeEntityLink { entity_type: string; entity_id: string; relationship_type: string; entity: EntityRef; resolved: boolean; restricted?: boolean; added_at: string | null; }
export interface KnowledgeEntryDetail extends KnowledgeEntry { sources: KnowledgeSourceItem[]; references: KnowledgeReferenceItem[]; entities: KnowledgeEntityLink[]; reviewer_username?: string | null; }
export interface KnowledgeRevision {
    id: number; entry_id: number; revision_number: number; title: string; summary: string | null; content: string | null;
    category: string | null; confidence: string | null; tags: string[];
    entities: { type: string; id: string; label: string; relationshipType: string }[];
    sources: { id: number; source_type: string; description: string | null }[];
    references: { id: number; title: string; url: string | null }[];
    published_at: string | null; published_by_username: string | null; created_at: string | null;
}
export interface KnowledgeQualityCheck { canPublish: boolean; issues: string[]; }
export interface RelatedKnowledgeEntry extends KnowledgeEntry { matchedVia: ('entity' | 'tag' | 'category')[]; }

export async function getKnowledgeMetadata(): Promise<KnowledgeMetadata> {
    const body = await intelligenceJson<{ data: KnowledgeMetadata }>('/api/knowledge/metadata', 'Failed to load knowledge base metadata');
    return body.data;
}
export async function getKnowledgeEntries(params: { q?: string; category?: string; status?: string; confidence?: string; tag?: string; author?: string; relatedEntityType?: string; relatedEntityId?: string; healthState?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: KnowledgeEntry[]; total: number; page: number; pageSize: number }>(`/api/knowledge?${qs.toString()}`, 'Failed to load knowledge entries');
}
export async function createKnowledgeEntry(payload: { title: string; summary?: string; content?: string; category: string; confidence?: string; tags?: string[] }) {
    return intelligenceJson<{ data: { id: number; slug: string } }>('/api/knowledge', 'Failed to create knowledge entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function getKnowledgeEntry(id: number): Promise<KnowledgeEntryDetail> {
    const body = await intelligenceJson<{ data: { entry: KnowledgeEntryDetail } }>(`/api/knowledge/${id}`, 'Failed to load knowledge entry');
    return body.data.entry;
}
export async function updateKnowledgeEntry(id: number, fields: Partial<{ title: string; summary: string; content: string; category: string; confidence: string; tags: string[] }>) {
    return intelligenceJson(`/api/knowledge/${id}`, 'Failed to update knowledge entry', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(fields) });
}
export async function deleteKnowledgeEntry(id: number) {
    return intelligenceJson(`/api/knowledge/${id}`, 'Failed to delete knowledge entry', { method: 'DELETE' });
}
export async function submitKnowledgeForReview(id: number) {
    return intelligenceJson(`/api/knowledge/${id}/submit-for-review`, 'Failed to submit entry for review', { method: 'POST' });
}
export async function getKnowledgeQualityCheck(id: number): Promise<KnowledgeQualityCheck> {
    const body = await intelligenceJson<{ data: KnowledgeQualityCheck }>(`/api/knowledge/${id}/quality-check`, 'Failed to check knowledge quality');
    return body.data;
}
export async function publishKnowledgeEntry(id: number, force = false) {
    return intelligenceJson(`/api/knowledge/${id}/publish`, 'Failed to publish knowledge entry', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ force }) });
}
export async function archiveKnowledgeEntry(id: number) {
    return intelligenceJson(`/api/knowledge/${id}/archive`, 'Failed to archive knowledge entry', { method: 'POST' });
}
export async function createKnowledgeEntryRevision(id: number) {
    return intelligenceJson(`/api/knowledge/${id}/create-revision`, 'Failed to start a new revision', { method: 'POST' });
}
export async function getKnowledgeRevisions(id: number): Promise<KnowledgeRevision[]> {
    const body = await intelligenceJson<{ data: { revisions: KnowledgeRevision[] } }>(`/api/knowledge/${id}/revisions`, 'Failed to load revision history');
    return body.data.revisions;
}
export async function addKnowledgeSource(id: number, payload: { sourceType: string; description?: string }) {
    return intelligenceJson<{ data: { id: number } }>(`/api/knowledge/${id}/sources`, 'Failed to add source', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function removeKnowledgeSource(id: number, sourceId: number) {
    return intelligenceJson(`/api/knowledge/${id}/sources/${sourceId}`, 'Failed to remove source', { method: 'DELETE' });
}
export async function addKnowledgeReference(id: number, payload: { title: string; url?: string; source?: string; publishedDate?: string; accessedDate?: string; notes?: string }) {
    return intelligenceJson<{ data: { id: number } }>(`/api/knowledge/${id}/references`, 'Failed to add reference', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }).then((b) => b.data);
}
export async function removeKnowledgeReference(id: number, referenceId: number) {
    return intelligenceJson(`/api/knowledge/${id}/references/${referenceId}`, 'Failed to remove reference', { method: 'DELETE' });
}
export async function addKnowledgeEntity(id: number, entityType: string, entityId: string | number, relationshipType?: string) {
    return intelligenceJson(`/api/knowledge/${id}/entities`, 'Failed to link entity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId, relationshipType }) });
}
export async function removeKnowledgeEntity(id: number, entityType: string, entityId: string | number) {
    return intelligenceJson(`/api/knowledge/${id}/entities/${entityType}/${entityId}`, 'Failed to unlink entity', { method: 'DELETE' });
}
export async function getRelatedKnowledge(id: number): Promise<RelatedKnowledgeEntry[]> {
    const body = await intelligenceJson<{ data: { items: RelatedKnowledgeEntry[] } }>(`/api/knowledge/${id}/related`, 'Failed to load related knowledge');
    return body.data.items;
}
// §22 "ENTITY TO KNOWLEDGE LINK" — an existing intelligence page (APT
// Group/Malware/MITRE) asking "what Knowledge Entries reference ME" is the
// SAME list endpoint above, filtered server-side by relatedEntityType/Id —
// no second query surface.
export async function getKnowledgeForEntity(entityType: string, entityId: string | number): Promise<KnowledgeEntry[]> {
    const body = await getKnowledgeEntries({ relatedEntityType: entityType, relatedEntityId: String(entityId), pageSize: 10 });
    return body.items;
}

// ── Knowledge Base Phase 2 (KNOWLEDGE_BASE_PHASE2.md) ──
export type KnowledgeMatchReasonType = 'entity' | 'tag' | 'category' | 'explicit';
export interface KnowledgeMatchReason { type: KnowledgeMatchReasonType; detail: string; }
export interface KnowledgeRecommendation extends KnowledgeEntry { matchReasons: KnowledgeMatchReason[]; }
export interface KnowledgeCoverage { profile: boolean; techniques: boolean; campaigns: boolean; malware: boolean; detection: boolean; mitigation: boolean; }
export interface KnowledgeContextSource { entryId: number; sourceType: string; description: string | null; }
export interface KnowledgeContextReference { entryId: number; title: string; url: string | null; }
export interface KnowledgeFeedbackTally { useful: number; not_relevant: number; }
export interface KnowledgeContext {
    entity: { type: string; id: string; label: string };
    relatedKnowledge: KnowledgeRecommendation[];
    knowledgeGap: boolean;
    coverage: KnowledgeCoverage;
    sources: KnowledgeContextSource[];
    references: KnowledgeContextReference[];
    feedback: Record<number, KnowledgeFeedbackTally>;
    restricted?: boolean;
}
export interface KnowledgeDashboardRecentItem { id: number; title: string; status: KnowledgeStatus; author: string | null; updatedAt: string | null; publishedAt: string | null; lastReviewedAt: string | null; }
export interface KnowledgeDashboardStats {
    total: number; draft: number; review: number; published: number; archived: number;
    recentUpdates: KnowledgeDashboardRecentItem[]; reviewRecommended: number; knowledgeGaps: number;
    // KNOWLEDGE_BASE_PHASE3.md §26 "KNOWLEDGE REVIEW DASHBOARD"
    conflicts: number; pendingSuggestions: number;
}
export interface KnowledgeGapEntity { type: string; id: string; label: string; }
export interface KnowledgeQueryResult { answer: string; citedEntryIds: number[]; note: string; }

// §26 "KNOWLEDGE CONTEXT PANEL" — the ONE bundled call the reusable panel
// component makes for any entity type it's mounted on.
export async function getKnowledgeContext(entityType: string, entityId: string | number): Promise<KnowledgeContext> {
    const body = await intelligenceJson<{ data: KnowledgeContext }>(`/api/knowledge/context/${entityType}/${entityId}`, 'Failed to load knowledge context');
    return body.data;
}
// §33 "KNOWLEDGE REVIEW"
export async function markKnowledgeReviewed(id: number, note?: string) {
    return intelligenceJson(`/api/knowledge/${id}/mark-reviewed`, 'Failed to mark entry reviewed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) });
}
// §37 "KNOWLEDGE BASE DASHBOARD"
export async function getKnowledgeDashboard(): Promise<KnowledgeDashboardStats> {
    const body = await intelligenceJson<{ data: KnowledgeDashboardStats }>('/api/knowledge/dashboard', 'Failed to load knowledge dashboard');
    return body.data;
}
// §24 "KNOWLEDGE GAP DETECTION"
export async function getAptGroupKnowledgeGaps(): Promise<KnowledgeGapEntity[]> {
    const body = await intelligenceJson<{ data: { items: KnowledgeGapEntity[] } }>('/api/knowledge/gaps/apt-groups', 'Failed to load knowledge gaps');
    return body.data.items;
}
// §28-30 "AI KNOWLEDGE QUERY"
export async function askKnowledgeAi(entityType: string, entityId: string | number): Promise<KnowledgeQueryResult> {
    const body = await intelligenceJson<{ data: KnowledgeQueryResult }>('/api/knowledge/ai-query', 'Failed to answer knowledge query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId }) });
    return body.data;
}
// §31 "KNOWLEDGE FEEDBACK"
export async function submitKnowledgeFeedback(entryId: number, entityType: string, entityId: string | number, feedback: 'useful' | 'not_relevant') {
    return intelligenceJson(`/api/knowledge/${entryId}/feedback`, 'Failed to record feedback', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entityType, entityId, feedback }) });
}

// ── Knowledge Base Phase 3 (KNOWLEDGE_BASE_PHASE3.md) ──
export interface KnowledgeHealth {
    freshness: 'current' | 'stale'; reviewRecommended: boolean; reviewRecommendedReason: string | null;
    sourceAvailability: { total: number; primary: number; secondary: number; unavailableReferences: number };
    entityLinkIntegrity: { total: number; broken: number };
    referenceIntegrity: { total: number; unavailable: number };
    confidence: string; lastReviewedAt: string | null; lastUpdatedAt: string | null;
    openConflicts: number; qualityPercent: number; missing: string[];
}
export interface KnowledgeConflict {
    id: number; entry_id: number; conflict_type: string; description: string; detail: any;
    status: 'open' | 'dismissed'; detected_at: string | null; resolved_by_user_id: number | null; resolved_at: string | null;
}
export interface KnowledgeSuggestionDiffItem { field: string; current: any; suggested: any; }
export interface KnowledgeSuggestion {
    id: number; entry_id: number; suggestion_type: string; reason: string; diff: KnowledgeSuggestionDiffItem[];
    status: 'pending' | 'applied' | 'rejected'; created_at: string | null; resolved_by_user_id: number | null; resolved_at: string | null;
}
export interface KnowledgeReviewQueueItem extends KnowledgeEntry {
    categories: string[]; priority: 'HIGH' | 'MEDIUM' | 'LOW'; priorityReason: string;
}
export interface KnowledgeCoverageEntry { total: number | null; covered: number; status: 'Covered' | 'Partial' | 'Missing'; }
export type KnowledgeCoverageDashboard = Record<string, KnowledgeCoverageEntry>;

// §4 "KNOWLEDGE HEALTH"
export async function getKnowledgeHealth(id: number): Promise<{ entry: { id: number; title: string; status: string }; health: KnowledgeHealth; conflicts: KnowledgeConflict[] }> {
    const body = await intelligenceJson<{ data: { entry: { id: number; title: string; status: string }; health: KnowledgeHealth; conflicts: KnowledgeConflict[] } }>(`/api/knowledge/${id}/health`, 'Failed to load knowledge health');
    return body.data;
}
// §9/§10 "KNOWLEDGE REVIEW QUEUE" / "REVIEW PRIORITY"
export async function getKnowledgeReviewQueue(category?: string): Promise<{ items: KnowledgeReviewQueueItem[]; total: number; highPriorityCount: number }> {
    const qs = category ? `?category=${encodeURIComponent(category)}` : '';
    return intelligenceJson<{ items: KnowledgeReviewQueueItem[]; total: number; highPriorityCount: number }>(`/api/knowledge/review-queue${qs}`, 'Failed to load review queue');
}
// §12 "KNOWLEDGE COVERAGE DASHBOARD"
export async function getKnowledgeCoverageDashboard(): Promise<KnowledgeCoverageDashboard> {
    const body = await intelligenceJson<{ data: KnowledgeCoverageDashboard }>('/api/knowledge/coverage', 'Failed to load knowledge coverage');
    return body.data;
}
// §22 "KNOWLEDGE FRESHNESS"
export async function setKnowledgeReviewInterval(id: number, days: number | null) {
    return intelligenceJson(`/api/knowledge/${id}/review-interval`, 'Failed to set review interval', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ days }) });
}
// §8 "KNOWLEDGE CONFLICT DETECTION"
export async function getKnowledgeConflicts(id: number, status?: 'open' | 'dismissed'): Promise<KnowledgeConflict[]> {
    const qs = status ? `?status=${status}` : '';
    const body = await intelligenceJson<{ data: { items: KnowledgeConflict[] } }>(`/api/knowledge/${id}/conflicts${qs}`, 'Failed to load conflicts');
    return body.data.items;
}
export async function dismissKnowledgeConflict(id: number, conflictId: number) {
    return intelligenceJson(`/api/knowledge/${id}/conflicts/${conflictId}/dismiss`, 'Failed to dismiss conflict', { method: 'POST' });
}
// §7 "SOURCE CHANGE DETECTION"
export async function checkKnowledgeReferenceAvailability(id: number, referenceId: number): Promise<{ status: string }> {
    const body = await intelligenceJson<{ data: { status: string } }>(`/api/knowledge/${id}/references/${referenceId}/check-availability`, 'Failed to check reference availability', { method: 'POST' });
    return body.data;
}
// §13/§14 "KNOWLEDGE CREATION ASSISTANT" / "AI KNOWLEDGE DRAFTING"
export async function generateKnowledgeDraft(payload: { entityType: string; entityId: string | number; entityLabel: string; selectedEntryIds: number[] }): Promise<{ id: number; slug: string; citedEntryIds: number[]; conflictNote: string | null; note: string }> {
    const body = await intelligenceJson<{ data: { id: number; slug: string; citedEntryIds: number[]; conflictNote: string | null; note: string } }>('/api/knowledge/draft', 'Failed to generate AI draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    return body.data;
}
// §18/§19 "AI KNOWLEDGE UPDATE" / "DIFF VIEW"
export async function suggestKnowledgeUpdate(id: number): Promise<KnowledgeSuggestion & { conflictNote: string | null; note?: string }> {
    const body = await intelligenceJson<{ data: KnowledgeSuggestion & { conflictNote: string | null; note?: string } }>(`/api/knowledge/${id}/suggest-update`, 'Failed to generate update suggestion', { method: 'POST' });
    return body.data;
}
export async function getKnowledgeSuggestions(id: number): Promise<KnowledgeSuggestion[]> {
    const body = await intelligenceJson<{ data: { items: KnowledgeSuggestion[] } }>(`/api/knowledge/${id}/suggestions`, 'Failed to load suggestions');
    return body.data.items;
}
export async function applyKnowledgeSuggestion(suggestionId: number): Promise<{ applied: boolean; reopenedToDraft: boolean }> {
    const body = await intelligenceJson<{ data: { applied: boolean; reopenedToDraft: boolean } }>(`/api/knowledge/suggestions/${suggestionId}/apply`, 'Failed to apply suggestion', { method: 'POST' });
    return body.data;
}
export async function rejectKnowledgeSuggestion(suggestionId: number) {
    return intelligenceJson(`/api/knowledge/suggestions/${suggestionId}/reject`, 'Failed to reject suggestion', { method: 'POST' });
}

// ── OSINT Target Management ──
export type TargetType = 'domain' | 'url' | 'ipv4' | 'ipv6' | 'email' | 'username' | 'phone' | 'person' | 'company' | 'brand' | 'file_hash' | 'keyword';
export type TargetRisk = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
export type TargetStatus = 'active' | 'investigating' | 'monitoring' | 'resolved' | 'archived';
export type TargetPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Target {
    id: number;
    type: TargetType;
    value: string;
    normalizedValue: string;
    description: string | null;
    risk: TargetRisk | null;
    status: TargetStatus;
    priority: TargetPriority;
    notes: string | null;
    ownerId: number | null;
    ownerUsername: string | null;
    createdAt: string | null;
    updatedAt: string | null;
    lastScannedAt: string | null;
    archivedAt: string | null;
    tags: string[];
}

export interface TargetActivityEntry {
    id: number; action: string; oldValue: string | null; newValue: string | null;
    username: string | null; createdAt: string | null;
}
export interface TargetFinding {
    id: number; module: string; riskLevel: string | null; investigationType: string | null; createdAt: string | null;
}
export interface TargetScan { id: number; createdAt: string | null; }

export interface TargetDetail extends Target {
    activity: TargetActivityEntry[];
    findings: TargetFinding[];
    scans: TargetScan[];
    relatedTargets: Target[];
}

export interface TargetsSummary {
    total: number; active: number; highRisk: number; recentlyAdded: number; investigating: number;
}

export interface TargetImportRowResult {
    row: number; target: string; type: string; tags: string[]; priority: string;
    valid: boolean; duplicate: boolean; reason: string | null; existingId?: number;
}
export interface TargetImportPreview {
    total: number; valid: number; invalid: number; duplicate: number; rows: TargetImportRowResult[];
}

async function targetsJson<T>(path: string, init?: RequestInit, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err: any = new Error((body as any)?.message || fallbackMessage);
        err.data = (body as any)?.data;
        err.status = res.status;
        throw err;
    }
    return body as T;
}

export async function getTargetsSummary(): Promise<TargetsSummary> {
    const body = await targetsJson<{ data: TargetsSummary }>('/api/targets/summary', undefined, 'Failed to load target summary');
    return body.data;
}

export async function getTargetTags(): Promise<string[]> {
    const body = await targetsJson<{ data: { tags: string[] } }>('/api/targets/tags', undefined, 'Failed to load tags');
    return body.data.tags;
}

export async function getTargets(params: { q?: string; type?: string; risk?: string; status?: string; tag?: string; sortBy?: string; sortDir?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return targetsJson<{ items: Target[]; total: number; page: number; pageSize: number }>(`/api/targets?${qs.toString()}`, undefined, 'Failed to load targets');
}

export async function checkTargetDuplicate(type: string, value: string): Promise<{ duplicate: boolean; existing: Target | null }> {
    const body = await targetsJson<{ data: { duplicate: boolean; existing: Target | null } }>(`/api/targets/check-duplicate?type=${encodeURIComponent(type)}&value=${encodeURIComponent(value)}`, undefined, 'Failed to check for duplicates');
    return body.data;
}

export async function createTarget(payload: { type: string; value: string; description?: string; tags?: string[]; priority?: string; status?: string; notes?: string }) {
    return targetsJson<{ data: { target: Target } }>('/api/targets', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    }, 'Failed to create target');
}

export async function getTarget(id: number): Promise<TargetDetail> {
    const body = await targetsJson<{ data: { target: TargetDetail } }>(`/api/targets/${id}`, undefined, 'Failed to load target');
    return body.data.target;
}

export async function updateTargetFields(id: number, payload: { description?: string; risk?: string; status?: string; priority?: string; notes?: string }) {
    return targetsJson(`/api/targets/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'Failed to update target');
}

export async function deleteTarget(id: number) {
    return targetsJson(`/api/targets/${id}`, { method: 'DELETE' }, 'Failed to delete target');
}

export async function addTargetNote(id: number, note: string) {
    return targetsJson(`/api/targets/${id}/notes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ note }) }, 'Failed to add note');
}

export async function addTargetTag(id: number, tag: string) {
    return targetsJson(`/api/targets/${id}/tags`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tag }) }, 'Failed to add tag');
}

export async function removeTargetTag(id: number, tag: string) {
    return targetsJson(`/api/targets/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }, 'Failed to remove tag');
}

export async function bulkUpdateTargets(ids: number[], action: 'status' | 'risk' | 'add_tag' | 'remove_tag' | 'archive' | 'delete', payload: Record<string, any> = {}) {
    return targetsJson<{ data: { succeeded: number; failed: { id: number; reason: string }[]; total: number } }>('/api/targets/bulk', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, action, payload })
    }, 'Failed to run bulk action').then((b) => b.data);
}

export async function previewTargetImport(rows: { target: string; type: string; tags?: string; priority?: string }[]): Promise<TargetImportPreview> {
    const body = await targetsJson<{ data: TargetImportPreview }>('/api/targets/import/preview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows })
    }, 'Failed to validate import');
    return body.data;
}

export async function commitTargetImport(rows: TargetImportRowResult[]): Promise<{ created: number; failed: { target: string; reason: string }[] }> {
    const body = await targetsJson<{ data: { created: number; failed: { target: string; reason: string }[] } }>('/api/targets/import/commit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows })
    }, 'Failed to import targets');
    return body.data;
}

// Auth is Bearer-token based (not cookies), so a plain <a href> to the export
// route would 401 — fetch with the token attached and trigger the download
// client-side instead, same as OsintPage.tsx's own exportResults().
export async function exportTargets(params: { q?: string; type?: string; risk?: string; status?: string; tag?: string } = {}): Promise<void> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) qs.set(k, String(v)); });
    const res = await fetchWithAuth(`${API_BASE_URL}/api/targets/export?${qs.toString()}`);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    if (!res.ok) throw new Error('Failed to export targets');
    const blob = await res.blob();
    downloadBlob(blob, `targets_${new Date().toISOString().replace(/[:.]/g, '-')}.csv`);
}

export async function getActiveSessions() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/sessions`);

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to load sessions');
    }
    return res.json();
}

export async function terminateSession(sessionId: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/sessions/${sessionId}`, {
        method: 'DELETE'
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to terminate session');
    }
    return res.json();
}

export async function terminateUserSessions(userId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/sessions/user/${userId}`, {
        method: 'DELETE'
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to terminate user sessions');
    }
    return res.json();
}

export async function terminateAllSessionsExceptMe() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/admin/sessions/all-except-me`, {
        method: 'DELETE'
    });

    if (res.status === 401 || res.status === 403) {
        throw new Error("Authentication required. Please login.");
    }
    if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to terminate sessions');
    }
    return res.json();
}

// BRAND_INTELLIGENCE_PASS1.md — brand profile CRUD. authenticateToken only
// (no admin gate) — plan §17 deliberately keeps this at investigative-setup
// tier, not administrative. Brand Identities are managed inline within a
// brand's detail view via addBrandIdentity / deleteBrandIdentity.
export async function getBrands() {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands`);
    if (res.status === 401) throw new Error('Authentication required. Please login.');
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load brands'); }
    return res.json();
}

export async function getBrand(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${id}`);
    if (res.status === 401) throw new Error('Authentication required. Please login.');
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load brand'); }
    return res.json();
}

export async function createBrandProfile(payload: { name: string; aliases?: string[]; keywords?: string[]; primaryColorHex?: string; secondaryColorHex?: string; logoReferenceUrl?: string; notes?: string }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to create brand'); }
    return res.json();
}

export async function updateBrandProfile(id: number, payload: { name: string; aliases?: string[]; keywords?: string[]; primaryColorHex?: string; secondaryColorHex?: string; logoReferenceUrl?: string; notes?: string }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to update brand'); }
    return res.json();
}

export async function deleteBrandProfile(id: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${id}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to delete brand'); }
    return res.json();
}

export async function addBrandIdentityItem(brandId: number, payload: { identityType: string; value: string; platform?: string; isPrimary?: boolean }) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/identities`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to add identity'); }
    return res.json();
}

export async function deleteBrandIdentityItem(brandId: number, identityId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/identities/${identityId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to delete identity'); }
    return res.json();
}

// ---- Brand Intelligence Pass 2 — job queue + candidates ----

export async function startBrandScan(brandId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/scan`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({})
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to start investigation'); }
    return res.json() as Promise<{ status: string; jobId: number }>;
}

export async function getBrandJobs(brandId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/jobs`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load investigations'); }
    return res.json();
}

export async function getBrandScanJob(jobId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load job'); }
    return res.json();
}

export async function getBrandScanCandidates(jobId: number, params?: { page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}/candidates?${qs}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load candidates'); }
    return res.json();
}

export async function getBrandScanCandidate(jobId: number, candidateId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}/candidates/${candidateId}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load candidate'); }
    return res.json();
}

export async function cancelBrandScanJob(jobId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}`, { method: 'DELETE' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to cancel investigation'); }
    return res.json();
}

// ---- Brand Intelligence Pass 7 — job retry ----

export async function retryBrandScanJob(jobId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}/retry`, { method: 'POST' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to retry investigation'); }
    return res.json();
}

// ---- Brand Intelligence Pass 4 — campaign API ----

export async function getBrandCampaigns(jobId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}/campaigns`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load campaigns'); }
    return res.json();
}

export async function getBrandCampaignMembers(campaignId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/campaigns/${campaignId}/members`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load campaign members'); }
    return res.json();
}

// ---- Brand Intelligence Pass 5 — evidence, timeline, AI analysis ----

export async function getBrandJobEvidence(jobId: number, candidateId?: number) {
    const qs = candidateId != null ? `?candidateId=${candidateId}` : '';
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/jobs/${jobId}/evidence${qs}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load evidence'); }
    return res.json() as Promise<{ status: string; evidence: import('../types/index').BrandEvidence[] }>;
}

export async function getBrandCampaignEvidence(campaignId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/campaigns/${campaignId}/evidence`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load campaign evidence'); }
    return res.json() as Promise<{ status: string; evidence: import('../types/index').BrandEvidence[] }>;
}

export async function getBrandTimeline(brandId: number, params?: { page?: number; pageSize?: number }) {
    const qs = new URLSearchParams();
    if (params?.page)     qs.set('page',     String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/timeline${q}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load timeline'); }
    return res.json() as Promise<import('../types/index').BrandTimelinePage & { status: string }>;
}

// ---- Brand Intelligence Pass 6 — Deep Scan ----

// ---- Brand Intelligence Pass 7 — persistent campaigns, overview, monitoring ----

export async function getBrandPersistentCampaigns(brandId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/persistent-campaigns`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load persistent campaigns'); }
    return res.json() as Promise<{ status: string; campaigns: import('../types/index').BrandPersistentCampaign[] }>;
}

export async function getBrandOverview(brandId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/overview`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load overview'); }
    return res.json() as Promise<{ status: string; overview: import('../types/index').BrandOverview }>;
}

export async function createBrandMonitor(brandId: number, checkIntervalMinutes?: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/monitor`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkIntervalMinutes })
    });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to create monitor'); }
    return res.json() as Promise<{ status: string; monitor: { id: number } }>;
}

// ---- Brand Intelligence CTI & Monitoring hardening pass ----
// (BRAND_INTELLIGENCE_IMPROVEMENT.md §47/§52 — persistent findings)

export interface BrandPersistentFinding {
    id: number; brand_id: number; finding_type: 'domain' | 'social_account';
    normalized_value: string; platform: string | null; fingerprint: string;
    status: 'active' | 'dormant' | 'resolved' | 'reappeared';
    confidence_state: 'Observed' | 'Correlated' | 'Confirmed';
    threat_intel_status: 'no_match' | 'observed_correlation' | 'suspicious_correlation' | 'known_threat_intelligence_match' | 'confirmed_by_existing_intelligence';
    misp_status: 'not_configured' | 'no_match' | 'match' | 'unavailable';
    misp_matches: { mispEventId: number | null; mispAttributeId: number | null; iocType: string | null; iocValue: string | null; category: string | null; firstSeen: string | null; lastSeen: string | null; threatLevel: string | null; tags: string[]; references: string[] }[];
    misp_checked_at: string | null;
    risk_level: string | null; risk_score: number | null;
    first_seen_at: string; last_seen_at: string; resolved_at: string | null;
    iocs?: { id: number; type: string; value: string; risk: string | null; threat_status: string; first_seen_at: string; last_seen_at: string; source: string }[];
    threatActorRelationships?: { id: number; name: string; relationshipType: string; basis: string; confidence: string | null; source: string }[];
    malwareRelationships?: { id: number; name: string; relationshipType: string; basis: string; confidence: string | null; source: string }[];
    campaignRelationships?: { id: number; name: string; relationshipType: string; basis: string; confidence: string | null; source: string }[];
    evidence?: { id: number; finding: string; source: string; detection_reason: string; confidence: number; url: string | null; created_at: string }[];
}

export async function getBrandFindings(brandId: number, params: { status?: string; findingType?: string; confidenceState?: string; mispStatus?: string; threatIntelStatus?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/brands/${brandId}/findings?${qs.toString()}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load findings'); }
    return res.json() as Promise<{ status: string; items: BrandPersistentFinding[]; total: number; page: number; pageSize: number }>;
}

export async function getBrandFinding(findingId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/findings/${findingId}`);
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to load finding'); }
    return res.json() as Promise<{ status: string; finding: BrandPersistentFinding }>;
}

export async function resolveBrandFinding(findingId: number) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/brand-intel/findings/${findingId}/resolve`, { method: 'PATCH' });
    if (!res.ok) { const b = await res.json().catch(() => ({})); throw new Error(b?.message || 'Failed to resolve finding'); }
    return res.json() as Promise<{ status: string; finding: BrandPersistentFinding }>;
}

export async function runBrandDeepScan(jobId: number, candidateId: number) {
    const res = await fetchWithAuth(
        `${API_BASE_URL}/api/brand-intel/jobs/${jobId}/candidates/${candidateId}/deep-scan`,
        { method: 'POST' }
    );
    if (res.status === 429) {
        const b = await res.json().catch(() => ({}));
        throw Object.assign(new Error(b?.message || 'Daily Deep Scan quota reached'), { code: 'QUOTA_EXCEEDED' });
    }
    if (res.status === 403) throw Object.assign(new Error('You do not have permission to run Deep Scans'), { code: 'FORBIDDEN' });
    if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.message || 'Deep Scan failed');
    }
    return res.json() as Promise<{
        status: string;
        deepScan: import('../types/index').DeepScanResult;
        riskScore: number;
        riskLevel: string;
        reasons: string[];
    }>;
}

// ── Company Intelligence (COMPANY_INTELLIGENCE.md) ──
// An aggregation/correlation layer, not a scanner — types/wrappers here
// mirror the shapes database/storage.js's Company Intelligence block
// returns. Risk/Relationships/Assessments reuse the existing generic
// entityType='company' path (getEntityRisk/getEntityRelationships/
// getEntityAssessments/createAssessment/getRelationshipGraph above) rather
// than duplicating those wrappers.

export type CompanyConfidence = 'Confirmed' | 'High Confidence' | 'Possible' | 'Unverified' | 'Unknown';
export type CompanyItemConfidence = 'Confirmed' | 'High' | 'Medium' | 'Low' | 'Unknown';
export type CompanyRisk = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';

export interface Company {
    id: number; name: string; legalName: string | null; tradingName: string | null;
    industry: string | null; companyType: string | null; country: string | null; location: string | null;
    website: string | null; description: string | null; foundedDate: string | null;
    parentCompanyId: number | null; parentCompanyName?: string; source: string | null;
    confidence: CompanyConfidence; risk: CompanyRisk | null; riskMode: 'manual' | 'preliminary' | null;
    ownerUsername?: string; createdAt: string | null; updatedAt: string | null;
    subsidiaries?: { id: number; name: string }[];
    domainCount?: number; ipCount?: number;
}

export interface CompanyDomain {
    id: number; domain: string; kind: 'primary' | 'related' | 'subdomain';
    // COMPANY_INTELLIGENCE_PHASE2.md §14/§24 — provenance, distinct from
    // `confidence` (certainty) and `source` (free-text prose). Set once at
    // creation, never revised by a later re-analysis.
    origin: 'analyst' | 'discovered' | 'inferred';
    ip: string | null; httpStatus: number | null;
    registrar: string | null; registrationDate: string | null; expirationDate: string | null; nameservers: string[];
    hostingProvider: string | null; cdn: string | null; cloudProvider: string | null;
    source: string | null; confidence: CompanyItemConfidence; risk: CompanyRisk | null;
    firstSeenAt: string | null; lastSeenAt: string | null;
}
export interface CompanyIp {
    id: number; domainId: number | null; ip: string; ipVersion: 'ipv4' | 'ipv6'; asn: string | null; org: string | null;
    isp: string | null; country: string | null; city: string | null; reverseDns: string[]; reputation: string | null;
    source: string | null; confidence: CompanyItemConfidence; firstSeenAt: string | null; lastSeenAt: string | null;
}
export interface CompanyCertificate {
    id: number; domain: string; issuer: string | null; validFrom: string | null; validUntil: string | null;
    sans: string[]; fingerprint: string | null; status: 'valid' | 'expired' | 'self_signed' | 'unknown';
    source: string | null; firstSeenAt: string | null;
}
export interface CompanyTechnology {
    id: number; technology: string; category: string | null; source: string | null; confidence: CompanyItemConfidence;
    // COMPANY_INTELLIGENCE_PHASE2.md §6 — the real reason string(s) this was
    // detected (e.g. "CF-Ray response header"), so an analyst can see why,
    // not just a bare label.
    evidence: string[];
    firstSeenAt: string | null; lastSeenAt: string | null;
}
export interface CompanyPerson {
    id: number; name: string; jobTitle: string | null; department: string | null;
    category: 'executive' | 'director' | 'employee' | 'associated'; profileUrl: string | null;
    source: string | null; confidence: CompanyItemConfidence; addedBy: string | null; createdAt: string | null;
}
export interface CompanySocialAccount {
    id: number; platform: string; username: string; profileUrl: string | null;
    verificationStatus: 'Confirmed' | 'Unverified' | 'Unknown'; source: string | null; confidence: CompanyItemConfidence; lastSeenAt: string | null;
}
export interface CompanyEmail {
    id: number; email: string; source: string | null; confidence: CompanyItemConfidence;
    breachCheckedAt: string | null; breachTotalExposures: number | null; breachLatestExposure: string | null;
    breachExposedTypes: string[]; breachSources: string[]; createdAt: string | null;
}
export interface CompanyRelationship {
    id: number; relationshipType: 'parent' | 'subsidiary' | 'acquisition' | 'partner' | 'vendor' | 'associated';
    relatedCompanyId: number | null; relatedEntityName: string; source: string | null; confidence: CompanyItemConfidence; createdAt: string | null;
}
export interface CompanySummary {
    domains: number; ipAddresses: number; subdomains: number; people: number; technologies: number;
    socialAccounts: number; digitalAssets: number; exposures: number; risk: CompanyRisk | null;
}
export interface CompanyDigitalAsset {
    assetType: string; value: string; source: string | null; firstSeen: string | null; lastSeen: string | null;
    confidence: CompanyItemConfidence; risk: CompanyRisk | null;
}
export interface CompanyBrandPresence {
    linkedBrand: { id: number; name: string } | null;
    officialIdentities: { type: string; value: string; platform: string | null; isPrimary: boolean }[];
    suspiciousCandidates: { id: number; value: string; candidateType: string; riskLevel: string; discoveryMethod: string; discoveredAt: string | null }[];
}
export interface CompanyTimelineEntry {
    id: number; action: string; previousValue: string | null; newValue: string | null; source: string | null;
    username: string | null; createdAt: string | null;
}
export interface CompanyAiSummary {
    executiveSummary: string; keyFindings: string[]; riskFactors: string[]; importantRelationships: string[];
    notableExposure: string[]; recommendedActions: string[]; note: string;
}

async function companiesJson<T>(path: string, init?: RequestInit, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getCompanies(params: { q?: string; industry?: string; risk?: string; sortBy?: string; sortDir?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return companiesJson<{ items: Company[]; total: number; page: number; pageSize: number }>(`/api/companies?${qs.toString()}`, undefined, 'Failed to load companies');
}

export async function analyzeCompany(input: string) {
    const body = await companiesJson<{ data: { company: Company; created: boolean; domainAnalyzed: boolean; socialAccountsFound: number; threatIntelMatches: number } }>(
        '/api/companies/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ input }) }, 'Failed to analyze company'
    );
    return body.data;
}

export async function reanalyzeCompany(id: number, domain?: string) {
    const body = await companiesJson<{ data: { company: Company } }>(
        `/api/companies/${id}/analyze`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain }) }, 'Failed to re-analyze company'
    );
    return body.data;
}

export async function getCompany(id: number): Promise<Company> {
    const body = await companiesJson<{ data: { company: Company } }>(`/api/companies/${id}`, undefined, 'Failed to load company');
    return body.data.company;
}

export async function updateCompany(id: number, patch: Partial<{ legalName: string; tradingName: string; industry: string; companyType: string; country: string; location: string; website: string; description: string; foundedDate: string; parentCompanyId: number | null; source: string; confidence: CompanyConfidence; risk: CompanyRisk | '' }>) {
    return companiesJson(`/api/companies/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) }, 'Failed to update company');
}

export async function deleteCompany(id: number) {
    return companiesJson(`/api/companies/${id}`, { method: 'DELETE' }, 'Failed to delete company');
}

export async function getCompanySummary(id: number): Promise<CompanySummary> {
    const body = await companiesJson<{ data: { summary: CompanySummary } }>(`/api/companies/${id}/summary`, undefined, 'Failed to load company summary');
    return body.data.summary;
}

export async function getCompanyDomains(id: number, kind?: string): Promise<CompanyDomain[]> {
    const qs = kind ? `?kind=${encodeURIComponent(kind)}` : '';
    const body = await companiesJson<{ data: { domains: CompanyDomain[] } }>(`/api/companies/${id}/domains${qs}`, undefined, 'Failed to load domains');
    return body.data.domains;
}

export async function getCompanyIps(id: number): Promise<CompanyIp[]> {
    const body = await companiesJson<{ data: { ips: CompanyIp[] } }>(`/api/companies/${id}/ips`, undefined, 'Failed to load IP addresses');
    return body.data.ips;
}

export async function getCompanyCertificates(id: number): Promise<CompanyCertificate[]> {
    const body = await companiesJson<{ data: { certificates: CompanyCertificate[] } }>(`/api/companies/${id}/certificates`, undefined, 'Failed to load certificates');
    return body.data.certificates;
}

export async function getCompanyTechnologies(id: number): Promise<CompanyTechnology[]> {
    const body = await companiesJson<{ data: { technologies: CompanyTechnology[] } }>(`/api/companies/${id}/technologies`, undefined, 'Failed to load technologies');
    return body.data.technologies;
}

export async function getCompanyDigitalAssets(id: number): Promise<CompanyDigitalAsset[]> {
    const body = await companiesJson<{ data: { assets: CompanyDigitalAsset[] } }>(`/api/companies/${id}/assets`, undefined, 'Failed to load digital assets');
    return body.data.assets;
}

export async function getCompanyPeople(id: number): Promise<CompanyPerson[]> {
    const body = await companiesJson<{ data: { people: CompanyPerson[] } }>(`/api/companies/${id}/people`, undefined, 'Failed to load people');
    return body.data.people;
}

export async function addCompanyPerson(id: number, payload: { name: string; jobTitle?: string; department?: string; category?: string; profileUrl?: string; source?: string; confidence?: string }) {
    return companiesJson(`/api/companies/${id}/people`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'Failed to add person');
}

export async function deleteCompanyPerson(id: number, personId: number) {
    return companiesJson(`/api/companies/${id}/people/${personId}`, { method: 'DELETE' }, 'Failed to remove person');
}

export async function getCompanySocialAccounts(id: number): Promise<CompanySocialAccount[]> {
    const body = await companiesJson<{ data: { accounts: CompanySocialAccount[] } }>(`/api/companies/${id}/social-accounts`, undefined, 'Failed to load social accounts');
    return body.data.accounts;
}

export async function updateCompanySocialAccountVerification(id: number, accountId: number, verificationStatus: string) {
    return companiesJson(`/api/companies/${id}/social-accounts/${accountId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ verificationStatus }) }, 'Failed to update social account');
}

export async function getCompanyEmails(id: number): Promise<CompanyEmail[]> {
    const body = await companiesJson<{ data: { emails: CompanyEmail[] } }>(`/api/companies/${id}/emails`, undefined, 'Failed to load emails');
    return body.data.emails;
}

export async function addCompanyEmail(id: number, email: string, checkBreach = true) {
    const body = await companiesJson<{ data: { id: number; emails: CompanyEmail[] } }>(
        `/api/companies/${id}/emails`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, checkBreach }) }, 'Failed to add email'
    );
    return body.data;
}

export async function deleteCompanyEmail(id: number, emailId: number) {
    return companiesJson(`/api/companies/${id}/emails/${emailId}`, { method: 'DELETE' }, 'Failed to remove email');
}

export async function getCompanyBrandPresence(id: number): Promise<CompanyBrandPresence> {
    const body = await companiesJson<{ data: { brandPresence: CompanyBrandPresence } }>(`/api/companies/${id}/brand-presence`, undefined, 'Failed to load brand presence');
    return body.data.brandPresence;
}

export async function getCompanyRelationships(id: number): Promise<CompanyRelationship[]> {
    const body = await companiesJson<{ data: { relationships: CompanyRelationship[] } }>(`/api/companies/${id}/relationships`, undefined, 'Failed to load related companies');
    return body.data.relationships;
}

export async function addCompanyRelationship(id: number, payload: { relationshipType: string; relatedCompanyId?: number; relatedEntityName?: string; source?: string; confidence?: string }) {
    return companiesJson(`/api/companies/${id}/relationships`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'Failed to add relationship');
}

export async function deleteCompanyRelationship(id: number, relationshipId: number) {
    return companiesJson(`/api/companies/${id}/relationships/${relationshipId}`, { method: 'DELETE' }, 'Failed to remove relationship');
}

export async function getCompanyThreatIntel(id: number): Promise<EntityRelationship[]> {
    const body = await companiesJson<{ data: { relationships: EntityRelationship[] } }>(`/api/companies/${id}/threat-intel`, undefined, 'Failed to load threat intelligence relationships');
    return body.data.relationships;
}

export async function getCompanyTimeline(id: number, params: { page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    return companiesJson<{ items: CompanyTimelineEntry[]; total: number; page: number; pageSize: number }>(`/api/companies/${id}/timeline?${qs.toString()}`, undefined, 'Failed to load timeline');
}

export async function getCompanyAiSummary(id: number): Promise<{ evidence: any; aiSummary: CompanyAiSummary }> {
    const body = await companiesJson<{ data: { evidence: any; aiSummary: CompanyAiSummary } }>(`/api/companies/${id}/ai-summary`, undefined, 'Failed to generate AI summary');
    return body.data;
}

// ─────────────────────────────────────────────────────────────────────────
// Image Intelligence (IMAGE_INTELLIGENCE.md)
// ─────────────────────────────────────────────────────────────────────────

export interface ImageExifFields {
    cameraMake: string | null; cameraModel: string | null; lens: string | null; software: string | null;
    dateTaken: string | null; dateModified: string | null; orientation: string | null; exposureTime: string | null;
    fNumber: string | null; iso: string | null; focalLength: string | null; author: string | null;
    copyright: string | null; comments: string | null;
}
export interface ImageGps { latitude: number; longitude: number; altitude: number | null; timestamp: string | null; }
export interface ImageMetadata {
    width: number | null; height: number | null; colorModel: string | null; format: string | null; hasAlpha: boolean;
    exif: { available: boolean; fields: ImageExifFields; gps: ImageGps | null };
}
export interface ImageObservable { type: string; value: string; source: string; confidence: string; }
export interface ImageOcrResult { text: string; confidence: number | null; available: boolean; reason: string | null; observables: ImageObservable[]; }
export interface ImageQrCode { qrType: string; decodedValue: string; location: any; confidence: string; observables: ImageObservable[]; }
export interface ImageForensicsIndicator { type: string; severity: 'info' | 'warning'; description: string; }
export interface ImageForensics { signatureMismatch: boolean; mismatchReason: string | null; trailingByteCount: number | null; indicators: ImageForensicsIndicator[]; summary: string; }
export interface ImageScreenshotAnalysis { looksLikeScreenshot: boolean; detectedElements: string[]; indicators: string[]; note: string; }
export interface ImageBrandMention { brand: string; brandId: number | null; source: string; confidence: string; officialDomains: string[]; }
export interface ImageThreatAssessment { risk: 'High' | 'Medium' | 'Low' | 'Informational'; evidence: string[]; note: string | null; }

export interface ImageRecord {
    id: number; filename: string | null; originalFilename: string | null;
    sha256: string; md5: string; sha1: string; phash: string | null; dhash: string | null; ahash: string | null;
    mimeType: string | null; detectedMimeType: string | null; signatureMismatch: boolean;
    fileSize: number | null; width: number | null; height: number | null; colorModel: string | null; format: string | null;
    storagePath: string | null; sourceUrl: string | null; source: 'upload' | 'url';
    metadataJson: ImageMetadata | null; ocrJson: ImageOcrResult | null; qrJson: ImageQrCode[] | null;
    forensicsJson: ImageForensics | null; screenshotJson: ImageScreenshotAnalysis | null;
    brandJson: ImageBrandMention[] | null; threatJson: ImageThreatAssessment | null;
    uploadedByUsername?: string; createdAt: string | null; analyzedAt: string | null;
}

export interface ImageSimilarityMatch { imageId: number; filename: string; similarity: number; hashType: string; firstSeen: string; lastSeen: string; }

export interface ImageReverseSearchResult {
    // id/searchId come from the underlying image_reverse_results/
    // image_reverse_searches rows (mapReverseResultRow in storage.js) —
    // present on every result read back from the DB (both the live-search
    // response and the history/AI-summary read paths), needed so
    // [Save Evidence] can record which search produced a given result
    // (IMAGE_INTELLIGENCE_PHASE3.md §6 "Search ID").
    id?: number; searchId?: number;
    provider: string; providerLabel?: string; providers?: string[]; queryId: string | null;
    matchType: 'exact' | 'near_exact' | 'visually_similar' | 'related_page' | 'possible_source';
    similarity: number | null; confidence: string | null; title: string | null; pageUrl: string | null;
    imageUrl: string | null; thumbnailUrl: string | null; sourceDomain: string | null;
    publicationDate: string | null; retrievedAt: string;
    relatedImageId?: number; firstSeen?: string; lastSeen?: string;
}
export interface ImageReverseSearchRun { providerId: string; label: string; ok: boolean; status: string; errorMessage: string | null; results: ImageReverseSearchResult[]; }
export interface ImageReverseSearchHistoryEntry {
    id: number; imageId: number; provider: string; queryId: string | null; status: string; resultCount: number;
    errorMessage: string | null; requestedByUsername?: string; startedAt: string | null; completedAt: string | null;
}
export interface ImageSourceDiscoveryEntry {
    domain: string | null; pageUrl: string | null; pageTitle: string | null; earliestObserved: string | null;
    matchType: string; providerConfidence: string | null; matchConfidence: string; providers: string[];
}
export interface ImageSourceTimelineYear {
    year: number;
    entries: { domain: string | null; pageTitle: string | null; pageUrl: string | null; date: string; matchType: string; providers: string[] }[];
}
export interface ImageProviderStatus {
    id: string; label: string;
    capabilities: { exactMatch: boolean; visualSimilarity: boolean; sourceDiscovery: boolean; objectRecognition: boolean; pageSearch: boolean };
    status: { available: boolean; reason: string | null };
}
export interface ImageTimelineEntry { id: number; action: string; previousValue: string | null; newValue: string | null; source: string | null; username: string | null; createdAt: string | null; }
export interface ImageAiSummary {
    executiveSummary: string; keyFindings: string[]; riskFactors: string[]; observedEvidence: string[];
    aiInterpretation: string[]; recommendedActions: string[]; note: string;
}

async function imagesJson<T>(path: string, init?: RequestInit, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export async function getImages(params: { q?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return imagesJson<{ items: ImageRecord[]; total: number; page: number; pageSize: number }>(`/api/images?${qs.toString()}`, undefined, 'Failed to load images');
}

export async function getImageProviders(): Promise<ImageProviderStatus[]> {
    const body = await imagesJson<{ data: { providers: ImageProviderStatus[] } }>('/api/images/providers', undefined, 'Failed to load provider status');
    return body.data.providers;
}

// §3 "Upload Image ... Analyze" — multipart. Deliberately no Content-Type
// header (the browser sets the multipart boundary itself).
export async function analyzeImageUpload(file: File): Promise<{ image: ImageRecord; created: boolean }> {
    const form = new FormData();
    form.append('image', file);
    const body = await imagesJson<{ data: { image: ImageRecord; created: boolean } }>(
        '/api/images/analyze', { method: 'POST', body: form }, 'Failed to analyze image'
    );
    return body.data;
}

export async function analyzeImageUrl(url: string): Promise<{ image: ImageRecord; created: boolean }> {
    const body = await imagesJson<{ data: { image: ImageRecord; created: boolean } }>(
        '/api/images/analyze-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }) }, 'Failed to analyze image'
    );
    return body.data;
}

export async function getImage(id: number): Promise<ImageRecord> {
    const body = await imagesJson<{ data: { image: ImageRecord } }>(`/api/images/${id}`, undefined, 'Failed to load image');
    return body.data.image;
}

export async function reanalyzeImage(id: number): Promise<ImageRecord> {
    const body = await imagesJson<{ data: { image: ImageRecord } }>(`/api/images/${id}/reanalyze`, { method: 'POST' }, 'Failed to re-analyze image');
    return body.data.image;
}

export async function deleteImageRecord(id: number) {
    return imagesJson(`/api/images/${id}`, { method: 'DELETE' }, 'Failed to delete image');
}

export async function getImageSimilarity(id: number): Promise<ImageSimilarityMatch[]> {
    const body = await imagesJson<{ data: { matches: ImageSimilarityMatch[] } }>(`/api/images/${id}/similarity`, undefined, 'Failed to load similarity matches');
    return body.data.matches;
}

// §30 "PRIVACY & DATA CONTROL" — the frontend must show the external-search
// consent dialog BEFORE calling this; this function itself just performs
// the (already-consented-to) search.
export async function runImageReverseSearch(id: number, providerIds?: string[]): Promise<{ runs: ImageReverseSearchRun[]; results: ImageReverseSearchResult[]; sources: ImageSourceDiscoveryEntry[]; timeline: ImageSourceTimelineYear[]; threat: ImageThreatAssessment }> {
    const body = await imagesJson<{ data: { runs: ImageReverseSearchRun[]; results: ImageReverseSearchResult[]; sources: ImageSourceDiscoveryEntry[]; timeline: ImageSourceTimelineYear[]; threat: ImageThreatAssessment } }>(
        `/api/images/${id}/reverse-search`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerIds: providerIds || null }) }, 'Failed to run reverse image search'
    );
    return body.data;
}

export async function getImageReverseSearchHistory(id: number): Promise<{ history: ImageReverseSearchHistoryEntry[]; results: ImageReverseSearchResult[]; sources: ImageSourceDiscoveryEntry[]; timeline: ImageSourceTimelineYear[] }> {
    const body = await imagesJson<{ data: { history: ImageReverseSearchHistoryEntry[]; results: ImageReverseSearchResult[]; sources: ImageSourceDiscoveryEntry[]; timeline: ImageSourceTimelineYear[] } }>(
        `/api/images/${id}/reverse-searches`, undefined, 'Failed to load reverse search history'
    );
    return body.data;
}

export async function getImageTimeline(id: number): Promise<{ items: ImageTimelineEntry[]; total: number }> {
    return imagesJson<{ items: ImageTimelineEntry[]; total: number }>(`/api/images/${id}/timeline`, undefined, 'Failed to load timeline');
}

export async function addImageObservable(id: number, type: string, value: string) {
    return imagesJson(`/api/images/${id}/observables`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, value }) }, 'Failed to add observable');
}

export async function getImageAiSummary(id: number): Promise<{ evidence: any; summary: ImageAiSummary }> {
    const body = await imagesJson<{ data: { evidence: any; summary: ImageAiSummary } }>(`/api/images/${id}/ai-summary`, undefined, 'Failed to generate AI summary');
    return body.data;
}

/** Resolves an images-table storage path (served statically under /uploads) into a browser-loadable absolute URL. */
export function imageFileUrl(image: Pick<ImageRecord, 'sha256' | 'format'>): string {
    return `${API_BASE_URL}/uploads/images/${image.sha256}.${(image.format || '').toLowerCase()}`;
}

// ─── Social Media Intelligence (SOCIALMEDIA_PHASE1.md) ─────────────────────

async function socialJson<T>(path: string, init?: RequestInit, fallbackMessage = 'Request failed'): Promise<T> {
    const res = await fetchWithAuth(`${API_BASE_URL}${path}`, init);
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((body as any)?.message || fallbackMessage);
    return body as T;
}

export type SocialToolStatus = 'completed' | 'unavailable' | 'error';
// BRAND_INTELLIGENCE_FIX.md §17/§18 — durationMs/startedAt/completedAt back
// the "Discovery Engines" result matrix. Optional because investigations run
// before this change have no timing recorded, and the UI must render those
// honestly (a dash) rather than inventing a duration.
export interface SocialToolOutcome {
    tool: string; status: SocialToolStatus; reason: string | null; resultCount?: number;
    durationMs?: number | null; startedAt?: string | null; completedAt?: string | null;
}

// §8/§9 — live readiness of the three discovery engines.
export type SocialToolHealthState = 'AVAILABLE' | 'UNAVAILABLE' | 'ERROR';
export interface SocialToolHealthEntry {
    tool: string; state: SocialToolHealthState; available: boolean;
    reason: string | null; version: string | null;
}
export interface SocialToolHealth {
    tools: SocialToolHealthEntry[];
    toolsAvailable: number; toolsFailed: number;
    environment: { venvDir: string; interpreterResolved: boolean };
    checkedAt: string;
}

/**
 * §8/§9 — real runtime readiness, re-checked server-side. `refresh` bypasses
 * the server's short cache after an operator installs something.
 */
export async function getSocialToolHealth(refresh = false): Promise<SocialToolHealth> {
    const body = await socialJson<{ data: SocialToolHealth }>(
        `/api/social/tool-health${refresh ? '?refresh=true' : ''}`,
        undefined,
        'Failed to check discovery engine health'
    );
    return body.data;
}
export type SocialAccountStatus = 'FOUND' | 'NOT_FOUND' | 'UNKNOWN' | 'BLOCKED' | 'RATE_LIMITED' | 'ERROR' | 'UNAVAILABLE';
export type SocialConfidence = 'High' | 'Medium' | 'Low' | 'Unknown';

// SOCIALMEDIA_PHASE2.md §7 — a vocabulary distinct from SocialAccountStatus
// (discovery outcome) rather than collapsed into it.
export type SocialProfileStatus = 'ANALYZED' | 'PARTIAL' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export interface SocialProfileData {
    status: SocialProfileStatus;
    displayName: string | null; bio: string | null; location: string | null; website: string | null;
    avatarUrl: string | null; company: string | null; publicEmail: string | null;
    metadata: Record<string, unknown>; analyzedAt: string | null;
}
export interface SocialAccountResult {
    id: number; investigationId: number; platform: string; username: string; profileUrl: string | null;
    status: SocialAccountStatus; sources: string[]; confidence: SocialConfidence; errorMessage: string | null;
    detectedAt: string | null; profile?: SocialProfileData;
}

// §3 "PLATFORM CAPABILITY MODEL"
export interface SocialPlatformCapability {
    platform: string; supportsDiscovery: boolean; supportsProfileAnalysis: boolean;
    publicDisplayName: boolean; publicBio: boolean; publicWebsite: boolean; publicEmail: boolean;
    publicCompany: boolean; publicLocation: boolean; publicAvatar: boolean; publicMetadata: boolean;
}
// §11/§12
export interface SocialProfileLink { id: number; accountId: number; url: string; linkType: string; sourcePlatform: string; detectedAt: string | null }
// §18-21 (Phase 2) + §4/§5 (Phase 3) — every signal carries its own
// STRONG/MEDIUM/WEAK strength classification, never an unexplained score.
export type SocialSignalStrength = 'STRONG' | 'MEDIUM' | 'WEAK';
export interface SocialCorrelationSignal { label: string; strength: SocialSignalStrength }
export interface SocialCorrelation {
    id: number;
    accountA: { id: number; platform: string; username: string };
    accountB: { id: number; platform: string; username: string };
    signals: SocialCorrelationSignal[]; confidence: SocialConfidence; relationshipLabel: string; createdAt: string | null;
}
// §27-33 — query generation only; googleUrl is the same manual-verification
// link pattern the existing Google Dorking module already uses.
export interface SocialDorkQuery { query: string; category: string; googleUrl: string }
export interface SocialInvestigation {
    id: number; target: string; targetType: 'username'; status: 'running' | 'completed' | 'partial' | 'failed';
    tools: SocialToolOutcome[]; ownerUsername?: string; createdAt: string | null; completedAt: string | null;
}
export interface SocialInvestigationSummary {
    platformsFound: number; platformsNotFound: number; unknown: number; errors: number;
    toolsAvailable: number; toolsFailed: number;
}
export interface SocialInvestigationRunResult {
    investigationId: number; target: string; status: 'completed' | 'partial' | 'failed';
    tools: SocialToolOutcome[]; summary: SocialInvestigationSummary; accounts: SocialAccountResult[];
}

export async function runSocialInvestigation(username: string): Promise<SocialInvestigationRunResult> {
    const body = await socialJson<{ data: SocialInvestigationRunResult }>(
        '/api/social/investigations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) }, 'Failed to run social media investigation'
    );
    return body.data;
}

export async function getSocialInvestigations(params: { q?: string; page?: number; pageSize?: number; mine?: boolean } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return socialJson<{ data: { items: SocialInvestigation[]; total: number; page: number; pageSize: number } }>(`/api/social/investigations?${qs.toString()}`, undefined, 'Failed to load investigations').then((b) => b.data);
}

export async function getSocialInvestigation(id: number): Promise<SocialInvestigation> {
    const body = await socialJson<{ data: SocialInvestigation }>(`/api/social/investigations/${id}`, undefined, 'Failed to load investigation');
    return body.data;
}

export async function getSocialInvestigationResults(id: number, params: { search?: string; platform?: string; status?: string; source?: string; confidence?: string } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await socialJson<{ data: { investigation: SocialInvestigation; accounts: SocialAccountResult[] } }>(`/api/social/investigations/${id}/results?${qs.toString()}`, undefined, 'Failed to load investigation results');
    return body.data;
}

// ─── Phase 2 (SOCIALMEDIA_PHASE2.md) ───────────────────────────────────────

// SOCIALMEDIA_FIX.md §36 "PROFILE ANALYSIS SUMMARY" — real counters from the
// run. BLOCKED and RATE_LIMITED are first-class outcomes, never folded into
// unavailable (§7/§48).
export interface SocialProfileAnalysisSummary {
    totalAccounts: number; analyzed: number; partial: number;
    blocked: number; rateLimited: number; unavailable: number;
    platformsProcessed: number;
}
export type SocialProfileJobStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
// §37 — Phase 2 runs as a background job; a real investigation can carry
// hundreds of accounts, which cannot complete inside an HTTP request.
export interface SocialProfileJob {
    id: number; investigationId: number; status: SocialProfileJobStatus;
    totalAccounts: number; processedAccounts: number; currentPlatform: string | null;
    summary: SocialProfileAnalysisSummary | null; lastError: string | null;
    cancelRequested: boolean;
    createdAt: string | null; startedAt: string | null; completedAt: string | null;
}

/** §37 — queues the analysis and returns immediately with a job id. */
export async function analyzeSocialProfiles(id: number): Promise<{ jobId: number; totalAccounts?: number; alreadyRunning: boolean }> {
    const body = await socialJson<{ data: { jobId: number; totalAccounts?: number; alreadyRunning: boolean } }>(
        `/api/social/investigations/${id}/analyze-profiles`, { method: 'POST' }, 'Failed to queue profile analysis'
    );
    return body.data;
}

export async function getSocialProfileJob(jobId: number): Promise<SocialProfileJob> {
    const body = await socialJson<{ data: { job: SocialProfileJob } }>(
        `/api/social/profile-jobs/${jobId}`, undefined, 'Failed to load profile analysis job'
    );
    return body.data.job;
}

/** The job the UI resumes polling after a reload; null when none has ever run. */
export async function getLatestSocialProfileJob(id: number): Promise<SocialProfileJob | null> {
    const body = await socialJson<{ data: { job: SocialProfileJob | null } }>(
        `/api/social/investigations/${id}/profile-job`, undefined, 'Failed to load profile analysis job'
    );
    return body.data.job;
}

export async function cancelSocialProfileJob(jobId: number): Promise<void> {
    await socialJson(`/api/social/profile-jobs/${jobId}/cancel`, { method: 'POST' }, 'Failed to cancel profile analysis');
}

export async function getSocialInvestigationLinks(id: number): Promise<SocialProfileLink[]> {
    const body = await socialJson<{ data: { links: SocialProfileLink[] } }>(`/api/social/investigations/${id}/links`, undefined, 'Failed to load links');
    return body.data.links;
}

export async function getSocialInvestigationCorrelations(id: number): Promise<SocialCorrelation[]> {
    const body = await socialJson<{ data: { correlations: SocialCorrelation[] } }>(`/api/social/investigations/${id}/correlations`, undefined, 'Failed to load correlations');
    return body.data.correlations;
}

export async function getSocialInvestigationDorks(id: number): Promise<SocialDorkQuery[]> {
    const body = await socialJson<{ data: { dorks: SocialDorkQuery[] } }>(`/api/social/investigations/${id}/dorks`, undefined, 'Failed to load dork queries');
    return body.data.dorks;
}

export async function addSocialObservable(investigationId: number, type: string, value: string) {
    return socialJson<{ data: { ok: boolean; iocId: number } }>(
        `/api/social/investigations/${investigationId}/observables`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, value }) },
        'Failed to add observable'
    ).then((b) => b.data);
}

export interface SocialEvidence { id: number; source: string; url: string | null; description: string | null; confidence: string | null; username: string | null; created_at: string | null }
export async function getSocialInvestigationEvidence(id: number): Promise<SocialEvidence[]> {
    const body = await socialJson<{ data: { evidence: SocialEvidence[] } }>(`/api/social/investigations/${id}/evidence`, undefined, 'Failed to load evidence');
    return body.data.evidence;
}
export async function addSocialInvestigationEvidence(id: number, payload: { source: string; url?: string; description?: string; confidence?: string }) {
    return socialJson<{ data: { id: number } }>(
        `/api/social/investigations/${id}/evidence`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'Failed to add evidence'
    ).then((b) => b.data);
}

// ─── Phase 3 (SOCIALMEDIA_PHASE3.md, hardened by SOCIALMEDIA_FIX_PHASE3.md) ─

// §27/§28 "BACKGROUND PROCESSING"/"PROGRESS" — Deep Analysis (image hashing +
// correlation folding + threat enrichment + evidence) runs as a background
// job for the same reason Phase 2 profile analysis does: measured at 41.3s
// hashing 100 real avatars, which cannot complete inside an HTTP request.
export interface SocialDeepAnalysisSummary {
    imageMatches: number; correlationsFolded: number; threatMatches: number;
    evidenceCreated: number; problems: string[];
}
export type SocialDeepAnalysisJobStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type SocialDeepAnalysisStage = 'queued' | 'image_analysis' | 'correlating' | 'threat_enrichment' | 'finalizing' | 'done';
export interface SocialDeepAnalysisJob {
    id: number; investigationId: number; status: SocialDeepAnalysisJobStatus; stage: SocialDeepAnalysisStage;
    totalAvatars: number; processedAvatars: number;
    summary: SocialDeepAnalysisSummary | null; lastError: string | null; cancelRequested: boolean;
    createdAt: string | null; startedAt: string | null; completedAt: string | null;
}

/** §27 — queues Deep Analysis and returns immediately with a job id. */
export async function runSocialDeepAnalysis(id: number): Promise<{ jobId: number; totalAvatars?: number; alreadyRunning: boolean }> {
    const body = await socialJson<{ data: { jobId: number; totalAvatars?: number; alreadyRunning: boolean } }>(
        `/api/social/investigations/${id}/deep-analysis`, { method: 'POST' }, 'Failed to queue deep analysis'
    );
    return body.data;
}

export async function getSocialDeepAnalysisJob(jobId: number): Promise<SocialDeepAnalysisJob> {
    const body = await socialJson<{ data: { job: SocialDeepAnalysisJob } }>(
        `/api/social/deep-analysis-jobs/${jobId}`, undefined, 'Failed to load deep analysis job'
    );
    return body.data.job;
}

/** The job the UI resumes polling after a reload; null when none has ever run. */
export async function getLatestSocialDeepAnalysisJob(id: number): Promise<SocialDeepAnalysisJob | null> {
    const body = await socialJson<{ data: { job: SocialDeepAnalysisJob | null } }>(
        `/api/social/investigations/${id}/deep-analysis-job`, undefined, 'Failed to load deep analysis job'
    );
    return body.data.job;
}

export async function cancelSocialDeepAnalysisJob(jobId: number): Promise<void> {
    await socialJson(`/api/social/deep-analysis-jobs/${jobId}/cancel`, { method: 'POST' }, 'Failed to cancel deep analysis');
}

// §8/§9 — honest §32 vocabulary: HASHED (real hash computed) / UNAVAILABLE
// (download failed) / NOT_AVAILABLE (platform exposes no avatar).
export type SocialImageStatus = 'HASHED' | 'UNAVAILABLE' | 'NOT_AVAILABLE';
export interface SocialProfileImage {
    id: number; accountId: number; imageUrl: string | null; status: SocialImageStatus;
    hashes: { sha256: string | null; md5: string | null; phash: string | null; dhash: string | null; ahash: string | null };
    errorMessage: string | null; fetchedAt: string | null;
}
export interface SocialImageMatch { accountAId: number; accountBId: number; similarity: number; method: string; confidence: SocialConfidence }

export async function getSocialInvestigationImages(id: number): Promise<SocialProfileImage[]> {
    const body = await socialJson<{ data: { images: SocialProfileImage[] } }>(`/api/social/investigations/${id}/images`, undefined, 'Failed to load images');
    return body.data.images;
}
export async function getSocialInvestigationImageMatches(id: number): Promise<SocialImageMatch[]> {
    const body = await socialJson<{ data: { matches: SocialImageMatch[] } }>(`/api/social/investigations/${id}/image-matches`, undefined, 'Failed to load image matches');
    return body.data.matches;
}

// §10-13 — real capability + accounts Phase 1 already discovered on Telegram.
// TELEGRAM_INTELLIGENCE.md Phase 1 widens the status union: capability is now
// computed from a live CyberOps TSI probe, so a capability can also report the
// specific blocking state, or LIMITED (incremental crawl — upstream has no
// native incremental support, see §18/UPSTREAM.md §2.5).
export type SocialCapabilityStatus =
    | 'AVAILABLE' | 'LIMITED' | 'NOT_CONFIGURED' | 'AUTH_REQUIRED'
    | 'DEPENDENCY_MISSING' | 'UNAVAILABLE'
    // CONFIGURATION COMPLETION §21 — a downstream Telegram capability that is
    // blocked purely because the Telegram Client above it isn't ready. The
    // suffix is the real root probe state (never fabricated), so the UI can
    // render "Blocked — <that reason>" instead of repeating it four times.
    | 'BLOCKED_NOT_CONFIGURED' | 'BLOCKED_AUTH_REQUIRED'
    | 'BLOCKED_DEPENDENCY_MISSING' | 'BLOCKED_UNAVAILABLE';
export interface SocialTelegramCapability {
    publicUsernameCheck: SocialCapabilityStatus; sourceManagement: SocialCapabilityStatus; telegramClient: SocialCapabilityStatus;
    crawler: SocialCapabilityStatus; messageCollection: SocialCapabilityStatus; incrementalCrawl: SocialCapabilityStatus;
    crawlHistory: SocialCapabilityStatus; messageSearch: SocialCapabilityStatus;
}

// TELEGRAM_INTELLIGENCE.md Phase 1 — engine metadata. Never contains any
// credential value; `missingConfig` names variables only (§7).
export interface TelegramEngineInfo {
    name: string; version: string | null; state: string; message: string | null;
    pythonAvailable: boolean; pythonVersion: string | null;
    telethonInstalled: boolean; telethonVersion: string | null;
    configured: boolean; missingConfig: string[]; sessionPresent: boolean;
    upstream: string; license: string;
    limits: {
        maxMessagesPerRun: number; maxMediaPerRun: number; maxMediaBytes: number;
        maxRuntimeSec: number; maxConcurrentJobs: number; maxOutputBytes: number;
    };
    incrementalCrawlNote: string; platformNote: string;
}

export type TelegramSourceType = 'username' | 'public_link' | 'numeric_id';
export type TelegramValidationState =
    | 'UNVALIDATED' | 'VALID' | 'INVALID' | 'NOT_CONFIGURED'
    | 'AUTH_REQUIRED' | 'ACCESS_DENIED' | 'UNAVAILABLE' | 'ERROR';
export type TelegramSourceStatus = 'active' | 'paused' | 'failed';

export interface TelegramSource {
    id: number; investigationId: number; sourceType: TelegramSourceType; target: string;
    displayName: string | null; description: string | null;
    status: TelegramSourceStatus; validationState: TelegramValidationState;
    validationMessage: string | null; validatedAt: string | null;
    resolvedEntity: { id?: number; title?: string | null; username?: string | null; type?: string } | null;
    lastCrawlAt: string | null; lastError: string | null; lastMessageId: number | null;
    createdAt: string | null; messagesCollected?: number; mediaCollected?: number;
}

// CONFIGURATION COMPLETION §13 — 'test' is a small, fixed, bounded run (text
// only, a handful of messages) to verify a source and the collection
// pipeline end-to-end before committing to a real crawl.
export type TelegramCrawlMode = 'initial' | 'historical' | 'incremental' | 'test';
export type TelegramJobStatus = 'queued' | 'starting' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface TelegramCrawlJob {
    id: number; sourceId: number; investigationId: number;
    mode: TelegramCrawlMode; status: TelegramJobStatus; cancelRequested: boolean;
    maxMessages: number; maxMedia: number; minMessageId: number | null;
    messagesRetrieved: number; messagesImported: number; mediaImported: number; mediaBytes: number;
    errorCount: number; truncatedReason: string | null; outputLocation: string | null;
    lastError: string | null; engineVersion: string | null;
    startedAt: string | null; completedAt: string | null; createdAt: string | null;
    sourceTarget?: string; sourceDisplayName?: string;
}

export interface TelegramDashboard {
    configuredSources: number; activeSources: number; pausedSources: number; failedSources: number;
    messagesCollected: number; mediaCollected: number;
    lastSuccessfulCrawl: string | null; currentCrawl: TelegramCrawlJob | null; lastError: string | null;
    // TELEGRAM_INTELLIGENCE_PHASE4_CORRECTION.md §10 "TELEGRAM OVERVIEW".
    totalCollections: number; failedCollections: number;
}

export interface TelegramMessageMedia {
    id: number; mediaType: string | null; fileName: string | null;
    fileSize: number | null; available: boolean; collectedAt: string | null;
}

export interface TelegramMessage {
    id: number; sourceId: number; investigationId: number; telegramMessageId: number;
    messageDate: string | null; senderId: string | null; messageText: string | null;
    messageType: 'text' | 'media' | 'service'; hasMedia: boolean; publicUrl: string | null;
    replyToMessageId: number | null; forwardedFrom: string | null; collectedAt: string | null;
    sourceTarget: string | null; sourceDisplayName: string | null;
    mediaCount?: number; media?: TelegramMessageMedia[];
}

export async function getSocialInvestigationTelegram(id: number): Promise<{
    capability: SocialTelegramCapability; engine: TelegramEngineInfo;
    sources: TelegramSource[]; dashboard: TelegramDashboard; accounts: SocialAccountResult[];
}> {
    const body = await socialJson<{ data: {
        capability: SocialTelegramCapability; engine: TelegramEngineInfo;
        sources: TelegramSource[]; dashboard: TelegramDashboard; accounts: SocialAccountResult[];
    } }>(`/api/social/investigations/${id}/telegram`, undefined, 'Failed to load Telegram data');
    return body.data;
}

// TELEGRAM_INTELLIGENCE_PHASE4_CORRECTION.md §1/§2 — Telegram's own entry
// point. No username, no investigation picker: this resolves (or silently
// creates, on first use) the calling user's own Telegram-only workspace and
// returns its investigationId alongside the same shape
// getSocialInvestigationTelegram() already returns.
export async function getTelegramWorkspace(): Promise<{
    investigationId: number;
    capability: SocialTelegramCapability; engine: TelegramEngineInfo;
    sources: TelegramSource[]; dashboard: TelegramDashboard; accounts: SocialAccountResult[];
}> {
    const body = await socialJson<{ data: {
        investigationId: number;
        capability: SocialTelegramCapability; engine: TelegramEngineInfo;
        sources: TelegramSource[]; dashboard: TelegramDashboard; accounts: SocialAccountResult[];
    } }>(`/api/social/telegram/workspace`, undefined, 'Failed to load Telegram workspace');
    return body.data;
}

// §10 "SOURCE FORM" — Save. Never starts a crawl.
export async function addTelegramSource(investigationId: number, payload: {
    sourceType: TelegramSourceType; target: string; displayName?: string; description?: string;
}): Promise<TelegramSource> {
    const body = await socialJson<{ data: { source: TelegramSource } }>(
        `/api/social/investigations/${investigationId}/telegram/sources`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        'Failed to save Telegram source'
    );
    return body.data.source;
}

// §11 — Validate only; explicitly does not start a collection.
export async function validateTelegramSource(sourceId: number): Promise<{
    state: TelegramValidationState; message: string | null; source: TelegramSource;
}> {
    const body = await socialJson<{ data: { state: TelegramValidationState; message: string | null; source: TelegramSource } }>(
        `/api/social/telegram/sources/${sourceId}/validate`, { method: 'POST' }, 'Failed to validate Telegram source'
    );
    return body.data;
}

export async function setTelegramSourceStatus(sourceId: number, status: TelegramSourceStatus): Promise<TelegramSource> {
    const body = await socialJson<{ data: { source: TelegramSource } }>(
        `/api/social/telegram/sources/${sourceId}`,
        { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) },
        'Failed to update Telegram source'
    );
    return body.data.source;
}

export async function deleteTelegramSource(sourceId: number): Promise<void> {
    await socialJson(`/api/social/telegram/sources/${sourceId}`, { method: 'DELETE' }, 'Failed to delete Telegram source');
}

// §12/§38 — returns a job id immediately; the UI then polls the job.
export async function startTelegramCrawl(sourceId: number, payload: {
    mode: TelegramCrawlMode; maxMessages?: number; maxMedia?: number;
}): Promise<{ jobId: number; mode: TelegramCrawlMode; maxMessages: number; maxMedia: number; minMessageId: number }> {
    const body = await socialJson<{ data: { jobId: number; mode: TelegramCrawlMode; maxMessages: number; maxMedia: number; minMessageId: number } }>(
        `/api/social/telegram/sources/${sourceId}/crawl`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        'Failed to start Telegram crawl'
    );
    return body.data;
}

export async function getTelegramCrawlJob(jobId: number): Promise<TelegramCrawlJob> {
    const body = await socialJson<{ data: { job: TelegramCrawlJob } }>(
        `/api/social/telegram/jobs/${jobId}`, undefined, 'Failed to load crawl job'
    );
    return body.data.job;
}

// §30 "CANCELLATION".
export async function cancelTelegramCrawlJob(jobId: number): Promise<{ cancelRequested: boolean; processStopped: boolean }> {
    const body = await socialJson<{ data: { cancelRequested: boolean; processStopped: boolean } }>(
        `/api/social/telegram/jobs/${jobId}/cancel`, { method: 'POST' }, 'Failed to cancel crawl job'
    );
    return body.data;
}

// §20 "CRAWL HISTORY".
export async function getTelegramCrawlHistory(investigationId: number, params: { page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const body = await socialJson<{ data: { items: TelegramCrawlJob[]; total: number; page: number; pageSize: number } }>(
        `/api/social/investigations/${investigationId}/telegram/jobs?${qs.toString()}`, undefined, 'Failed to load crawl history'
    );
    return body.data;
}

// §24 "MESSAGE SEARCH" — server-side.
export async function searchTelegramMessages(investigationId: number, params: {
    q?: string; sourceId?: number; messageType?: 'text' | 'media' | 'service';
    dateFrom?: string; dateTo?: string; page?: number; pageSize?: number;
} = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await socialJson<{ data: { items: TelegramMessage[]; total: number; page: number; pageSize: number } }>(
        `/api/social/investigations/${investigationId}/telegram/messages?${qs.toString()}`, undefined, 'Failed to search Telegram messages'
    );
    return body.data;
}

// §25 "MESSAGE DETAILS".
export async function getTelegramMessage(messageId: number): Promise<TelegramMessage> {
    const body = await socialJson<{ data: { message: TelegramMessage } }>(
        `/api/social/telegram/messages/${messageId}`, undefined, 'Failed to load message'
    );
    return body.data.message;
}

// ─── Telegram Intelligence Phase 2 (TELEGRAM_INTELLIGENCE_PHASE2.md) ───────
// Message intelligence: entity extraction over messages ALREADY collected by
// Phase 1 (§3 — no re-crawl required).

export type TelegramEntityType =
    | 'URL' | 'Domain' | 'IPv4' | 'IPv6' | 'Email' | 'Phone' | 'Username' | 'Hashtag'
    | 'Mention' | 'Crypto' | 'MD5' | 'SHA1' | 'SHA256' | 'CVE'
    | 'Malware' | 'ThreatActor' | 'Company' | 'Brand';

export type TelegramExtractionScope = 'message' | 'source' | 'crawl_run' | 'investigation';
export type TelegramExtractionStatus = 'queued' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';

export interface TelegramExtractionJob {
    id: number; investigationId: number; sourceId: number | null; messageRowId: number | null;
    scope: TelegramExtractionScope; crawlJobId: number | null;
    status: TelegramExtractionStatus; cancelRequested: boolean; batchSize: number;
    messagesTotal: number; messagesProcessed: number;
    entitiesExtracted: number; observablesUpserted: number;
    lastMessageRowId: number | null; errorCount: number; lastError: string | null;
    startedAt: string | null; completedAt: string | null; createdAt: string | null;
}

/** §20 — one entity occurrence, with the provenance §20 requires. */
export interface TelegramMessageEntity {
    id: number; messageRowId: number; sourceId: number; investigationId: number;
    entityType: TelegramEntityType; entitySubtype: string | null;
    rawValue: string; normalizedValue: string;
    extractionMethod: string; confidence: 'Low' | 'Medium' | 'High' | 'Confirmed';
    confidenceReason: string | null;
    // §15-18 — "Malware Mention" / "Threat Actor Mention" / etc. Never a
    // confirmed activity or attribution claim.
    claim: string | null;
    linkedEntityId: number | null; iocId: number | null;
    messageDate: string | null; extractedAt: string | null;
    telegramMessageId?: number; sourceTarget?: string; sourceDisplayName?: string;
}

/** §22 — one distinct normalized entity plus its real occurrence count. */
export interface TelegramEntitySummary {
    entityType: TelegramEntityType; entitySubtype: string | null; normalizedValue: string;
    extractionMethod: string; claim: string | null;
    linkedEntityId: number | null; iocId: number | null;
    confidence: 'Low' | 'Medium' | 'High' | 'Confirmed'; confidenceReason: string | null;
    occurrenceCount: number; sourceCount: number;
    firstSeen: string | null; lastSeen: string | null;
}

/** §33/§35 — computed from actual stored data, never hardcoded. */
export interface TelegramIntelStats {
    messages: number;
    messagesWithEntities: number;
    byType: Record<string, { distinct: number; occurrences: number }>;
}

// §3/§42 — enqueue only; the background worker performs the extraction.
export async function startTelegramExtraction(investigationId: number, payload: {
    scope: TelegramExtractionScope; sourceId?: number; messageRowId?: number;
    crawlJobId?: number; batchSize?: number;
}): Promise<{ jobId: number; scope: TelegramExtractionScope }> {
    const body = await socialJson<{ data: { jobId: number; scope: TelegramExtractionScope } }>(
        `/api/social/investigations/${investigationId}/telegram/extract`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) },
        'Failed to start message analysis'
    );
    return body.data;
}

export async function getTelegramExtractionJob(jobId: number): Promise<TelegramExtractionJob> {
    const body = await socialJson<{ data: { job: TelegramExtractionJob } }>(
        `/api/social/telegram/extraction-jobs/${jobId}`, undefined, 'Failed to load extraction job'
    );
    return body.data.job;
}

export async function cancelTelegramExtractionJob(jobId: number): Promise<void> {
    await socialJson(`/api/social/telegram/extraction-jobs/${jobId}/cancel`, { method: 'POST' }, 'Failed to cancel extraction job');
}

export async function getTelegramExtractionJobs(investigationId: number): Promise<TelegramExtractionJob[]> {
    const body = await socialJson<{ data: { jobs: TelegramExtractionJob[] } }>(
        `/api/social/investigations/${investigationId}/telegram/extraction-jobs`, undefined, 'Failed to load extraction jobs'
    );
    return body.data.jobs;
}

export async function getTelegramEntities(investigationId: number, params: {
    entityType?: TelegramEntityType; sourceId?: number; q?: string; page?: number; pageSize?: number;
} = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await socialJson<{ data: { items: TelegramEntitySummary[]; total: number; page: number; pageSize: number } }>(
        `/api/social/investigations/${investigationId}/telegram/entities?${qs.toString()}`, undefined, 'Failed to load extracted entities'
    );
    return body.data;
}

// §22 — the messages a given normalized entity was observed in.
export async function getTelegramEntityOccurrences(investigationId: number, entityType: TelegramEntityType, value: string) {
    const qs = new URLSearchParams({ entityType, value });
    const body = await socialJson<{ data: { occurrences: TelegramMessageEntity[] } }>(
        `/api/social/investigations/${investigationId}/telegram/entity-occurrences?${qs.toString()}`,
        undefined, 'Failed to load entity occurrences'
    );
    return body.data.occurrences;
}

export async function getTelegramIntelStats(investigationId: number, sourceId?: number): Promise<TelegramIntelStats> {
    const qs = new URLSearchParams();
    if (sourceId) qs.set('sourceId', String(sourceId));
    const body = await socialJson<{ data: TelegramIntelStats }>(
        `/api/social/investigations/${investigationId}/telegram/intel-stats?${qs.toString()}`,
        undefined, 'Failed to load intelligence statistics'
    );
    return body.data;
}

// §34 — the entities extracted from one message.
export async function getTelegramMessageEntities(messageRowId: number): Promise<TelegramMessageEntity[]> {
    const body = await socialJson<{ data: { entities: TelegramMessageEntity[] } }>(
        `/api/social/telegram/messages/${messageRowId}/entities`, undefined, 'Failed to load message entities'
    );
    return body.data.entities;
}

// §32 — message search with entity filters, resolved server-side.
export async function searchTelegramMessagesByEntity(investigationId: number, params: {
    q?: string; sourceId?: number; messageType?: 'text' | 'media' | 'service';
    entityType?: TelegramEntityType; entityValue?: string;
    dateFrom?: string; dateTo?: string; page?: number; pageSize?: number;
} = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await socialJson<{ data: { items: (TelegramMessage & { entityCount?: number })[]; total: number; page: number; pageSize: number } }>(
        `/api/social/investigations/${investigationId}/telegram/message-search?${qs.toString()}`,
        undefined, 'Failed to search Telegram messages'
    );
    return body.data;
}

// §14-16 — a real, analyst-submitted result (never an automated scrape).
export interface SocialDorkResult {
    id?: number; query: string | null; category: string | null; resultUrl: string; title: string | null;
    snippet: string | null; platform: string | null; extractedUsername: string | null; source: string; retrievedAt: string | null;
}
export interface SocialGoogleDorkingCapability { queryGeneration: SocialCapabilityStatus; automatedResultRetrieval: SocialCapabilityStatus }

export async function getSocialInvestigationDorkResults(id: number): Promise<SocialDorkResult[]> {
    const body = await socialJson<{ data: { results: SocialDorkResult[] } }>(`/api/social/investigations/${id}/dork-results`, undefined, 'Failed to load dork results');
    return body.data.results;
}
export async function saveSocialDorkResult(id: number, payload: { query?: string; category?: string; resultUrl: string; title?: string; snippet?: string }): Promise<SocialDorkResult> {
    const body = await socialJson<{ data: SocialDorkResult }>(
        `/api/social/investigations/${id}/dork-results`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }, 'Failed to save dork result'
    );
    return body.data;
}
export async function getSocialGoogleDorkingCapability(): Promise<SocialGoogleDorkingCapability> {
    const body = await socialJson<{ data: SocialGoogleDorkingCapability }>('/api/social/google-dorking-capability', undefined, 'Failed to load Google Dorking capability');
    return body.data;
}

// §17-19 — real matches against the existing IOC repository.
export interface SocialThreatMatch { id: number; type: string; value: string; risk: string | null }
export async function getSocialInvestigationThreatContext(id: number): Promise<{ observablesChecked: number; matches: SocialThreatMatch[] }> {
    const body = await socialJson<{ data: { observablesChecked: number; matches: SocialThreatMatch[] } }>(`/api/social/investigations/${id}/threat-context`, undefined, 'Failed to load threat context');
    return body.data;
}

// §21 — real intelligence_history events only.
export interface SocialTimelineEvent { id: number; action: string; previousValue: string | null; newValue: string | null; source: string; username: string | null; createdAt: string | null }
export async function getSocialInvestigationTimeline(id: number): Promise<{ items: SocialTimelineEvent[]; total: number; page: number; pageSize: number }> {
    const body = await socialJson<{ data: { items: SocialTimelineEvent[]; total: number; page: number; pageSize: number } }>(`/api/social/investigations/${id}/timeline`, undefined, 'Failed to load timeline');
    return body.data;
}

// §22/§23 — reuses the same computeEntityRisk() every other module uses.
export interface SocialRisk { entityType: string; entityId: string; score: number; level: string; confidence: string; reasons: string[] }
export async function getSocialInvestigationRisk(id: number): Promise<SocialRisk> {
    const body = await socialJson<{ data: { risk: SocialRisk } }>(`/api/social/investigations/${id}/risk`, undefined, 'Failed to compute risk');
    return body.data.risk;
}

// §27/§28 — must distinguish Observed / Correlated / Inferred; never
// invents an account, identity, relationship, actor, campaign, IOC, or source.
export interface SocialAiSummary {
    executiveSummary: string; observed: string[]; correlated: string[]; inferred: string[];
    threatContext: string[]; riskFactors: string[]; recommendedActions: string[]; note?: string;
}
export async function getSocialInvestigationAiSummary(id: number): Promise<SocialAiSummary> {
    const body = await socialJson<{ data: SocialAiSummary }>(`/api/social/investigations/${id}/ai-summary`, undefined, 'Failed to generate AI summary');
    return body.data;
}

// ── Telegram Intelligence — Phase 3 (CTI correlation, monitoring, investigation) ──
// TELEGRAM_INTELLIGENCE_PHASE3.md §5-§20, §21-§26, §29-§40.

/** §7 — the claim ladder. 'Attributed' is never set automatically by any code path. */
export type TelegramClaim = 'Referenced' | 'Observed' | 'Related' | 'Correlated' | 'Attributed';
export type TelegramCorrelationConfidence = 'Unknown' | 'Low' | 'Medium' | 'High';
export type TelegramCorrelationType =
    | 'ioc_match' | 'threat_actor' | 'malware' | 'vulnerability' | 'company' | 'brand'
    | 'cross_platform_identity' | 'campaign_candidate' | 'image_reuse';

/**
 * §20 "CORRELATION CONFIDENCE" — every correlation carries the signals that
 * produced it, so the UI never has to show an unexplained score.
 */
export interface TelegramCorrelation {
    id: number; investigationId: number; sourceId: number | null;
    correlationType: TelegramCorrelationType;
    subjectEntityType: string; subjectValue: string;
    matchedEntityType: string; matchedEntityId: number | null; matchedEntityLabel: string | null;
    claim: TelegramClaim; confidence: TelegramCorrelationConfidence;
    signals: string[];
    occurrenceCount: number; sourceCount: number;
    firstSeen: string | null; lastSeen: string | null;
    createdAt: string | null; updatedAt: string | null;
    sourceTarget?: string; sourceDisplayName?: string;
}

/** §37 "THREAT CONTEXT VIEW" — grouped by what the finding actually is. */
export interface TelegramThreatContext {
    knownIntelligenceMatches: TelegramCorrelation[];
    observedIndicators: TelegramCorrelation[];
    threatActors: TelegramCorrelation[];
    malware: TelegramCorrelation[];
    vulnerabilities: TelegramCorrelation[];
    companies: TelegramCorrelation[];
    brands: TelegramCorrelation[];
    campaignCandidates: TelegramCorrelation[];
    crossPlatformIdentities: TelegramCorrelation[];
    total: number;
}

/** §35 "TELEGRAM SOURCE INTELLIGENCE DASHBOARD" — "All data must be real." */
export interface TelegramSourceIntelligence {
    sourceId: number; target: string; displayName: string | null;
    status: string; validationState: string;
    lastCrawlAt: string | null; lastError: string | null;
    messages: number;
    entities: Record<string, number>;
    correlations: Record<string, number>;
    knownIntelMatches: number;
    alerts: { total: number; open: number };
    monitor: { id: number; status: string; intervalMinutes: number; lastCheckedAt: string | null } | null;
}

/** §36 — real buckets only; `hasHistoricalData` gates the whole view. */
export interface TelegramActivityWindow { messages: number; newEntities: number; threatMatches: number; alerts: number }
export interface TelegramActivityTimeline {
    hasHistoricalData: boolean;
    windows: { last24h: TelegramActivityWindow; last7d: TelegramActivityWindow; last30d: TelegramActivityWindow };
}

/** §29 — reuses the existing intelligence_history store. */
export interface TelegramTimelineEvent {
    id: number; action: string; newValue: string | null; previousValue: string | null;
    source: string; username: string | null; createdAt: string | null;
}

/** §39 — the AI must keep these categories strictly separate. */
export interface TelegramAiSummary {
    executiveSummary: string;
    observed: string[]; correlated: string[]; inferred: string[];
    analystAssessed: string[]; unknown: string[];
    threatContext: string[]; riskFactors: string[]; recommendedActions: string[];
    note?: string;
}

// §4/§10 — re-correlate what Phases 1-2 already collected. This runs no crawl.
export async function runTelegramCorrelation(investigationId: number, sourceId?: number): Promise<{
    correlationCount: number; inserted: number; updated: number; graphEdges: number; entitiesEvaluated: number;
}> {
    const body = await socialJson<{ data: { correlationCount: number; inserted: number; updated: number; graphEdges: number; entitiesEvaluated: number } }>(
        `/api/social/investigations/${investigationId}/telegram/correlate`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceId }) },
        'Failed to run correlation'
    );
    return body.data;
}

export async function getTelegramCorrelations(investigationId: number, params: {
    correlationType?: TelegramCorrelationType; sourceId?: number; claim?: TelegramClaim;
    page?: number; pageSize?: number;
} = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null) qs.set(k, String(v)); });
    const body = await socialJson<{ data: { items: TelegramCorrelation[]; total: number; page: number; pageSize: number } }>(
        `/api/social/investigations/${investigationId}/telegram/correlations?${qs.toString()}`,
        undefined, 'Failed to load correlations'
    );
    return body.data;
}

export async function getTelegramThreatContext(investigationId: number, sourceId?: number): Promise<TelegramThreatContext> {
    const qs = new URLSearchParams();
    if (sourceId) qs.set('sourceId', String(sourceId));
    const body = await socialJson<{ data: TelegramThreatContext }>(
        `/api/social/investigations/${investigationId}/telegram/threat-context?${qs.toString()}`,
        undefined, 'Failed to load threat context'
    );
    return body.data;
}

export async function getTelegramSourceIntelligence(sourceId: number): Promise<TelegramSourceIntelligence> {
    const body = await socialJson<{ data: TelegramSourceIntelligence }>(
        `/api/social/telegram/sources/${sourceId}/intelligence`, undefined, 'Failed to load source intelligence'
    );
    return body.data;
}

export async function getTelegramActivityTimeline(investigationId: number, sourceId?: number): Promise<TelegramActivityTimeline> {
    const qs = new URLSearchParams();
    if (sourceId) qs.set('sourceId', String(sourceId));
    const body = await socialJson<{ data: TelegramActivityTimeline }>(
        `/api/social/investigations/${investigationId}/telegram/activity?${qs.toString()}`,
        undefined, 'Failed to load activity timeline'
    );
    return body.data;
}

export async function getTelegramTimeline(investigationId: number, pageSize?: number): Promise<TelegramTimelineEvent[]> {
    const qs = new URLSearchParams();
    if (pageSize) qs.set('pageSize', String(pageSize));
    const body = await socialJson<{ data: { timeline: TelegramTimelineEvent[] } }>(
        `/api/social/investigations/${investigationId}/telegram/timeline?${qs.toString()}`,
        undefined, 'Failed to load timeline'
    );
    return body.data.timeline;
}

// §31/§32 — the SAME computeEntityRisk() every other module uses, so the
// score and its factors are produced by one engine, not a Telegram-private one.
export async function getTelegramSourceRisk(sourceId: number): Promise<RiskAssessmentResult> {
    const body = await socialJson<{ data: RiskAssessmentResult }>(
        `/api/social/telegram/sources/${sourceId}/risk`, undefined, 'Failed to compute risk'
    );
    return body.data;
}

export async function getTelegramAiSummary(investigationId: number, sourceId?: number): Promise<TelegramAiSummary> {
    const qs = new URLSearchParams();
    if (sourceId) qs.set('sourceId', String(sourceId));
    const body = await socialJson<{ data: TelegramAiSummary }>(
        `/api/social/investigations/${investigationId}/telegram/ai-summary?${qs.toString()}`,
        undefined, 'Failed to generate AI summary'
    );
    return body.data;
}

// §21 — registers the source with the EXISTING monitoring system; the shared
// scheduler, Alert Center, dedup and lifecycle then apply unchanged.
export async function createTelegramSourceMonitor(sourceId: number, checkIntervalMinutes?: number): Promise<{ monitor: { id: number } }> {
    const body = await socialJson<{ data: { monitor: { id: number } } }>(
        `/api/social/telegram/sources/${sourceId}/monitor`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkIntervalMinutes }) },
        'Failed to create monitor'
    );
    return body.data;
}

// ── Malware Analysis (MALWARE_ANALYSIS_PHASE1.md) ──────────────────────────
export type MalwareSampleStatus = 'uploaded' | 'queued' | 'analyzing' | 'completed' | 'partial' | 'failed' | 'unsupported' | 'rejected';
export type MalwareClassification = 'malicious' | 'suspicious' | 'benign' | 'unknown';
export interface MalwareSample {
    id: number; sha256: string; sha1: string; md5: string; file_size: number;
    original_filename: string | null; detected_type: string | null; detected_mime_type: string | null;
    claimed_extension: string | null; signature_mismatch: boolean; mismatch_reason: string | null;
    architecture: string | null; subsystem: string | null; entry_point: string | null; image_base: string | null;
    compile_timestamp: string | null; entropy: number | null;
    status: MalwareSampleStatus; status_message: string | null; progress: Record<string, string> | null;
    classification: MalwareClassification; classified_by_user_id: number | null; classified_at: string | null;
    risk: string | null; confidence: string | null;
    static_findings: any; strings: any;
    ai_summary: { summary: string; riskFactors?: string[]; note: string } | null;
    uploaded_by_user_id: number | null; uploaded_by_username: string | null;
    created_at: string | null; updated_at: string | null; analyzed_at: string | null;
}
export interface MalwareSampleFilenameObservation { id: number; filename: string; username: string | null; uploaded_at: string | null; }
export interface MalwareSampleIoc { id: number; type: string; value: string; risk: string | null; confidence: string; extraction_method: string; observed_at: string | null; }
export interface MalwareAnalysisJob { id: number; sample_id?: number; status: string; stage: string | null; error_message: string | null; started_at: string | null; completed_at: string | null; created_at: string | null; }
export interface MalwareSampleDetail extends MalwareSample {
    filenames: MalwareSampleFilenameObservation[];
    iocs: MalwareSampleIoc[];
    evidence: EvidenceItem[];
    assessments: AnalystAssessment[];
    relationships: any[];
    jobs: MalwareAnalysisJob[];
    timeline: { action: string; previous_value: string | null; new_value: string | null; source: string; user_id: number | null; created_at: string | null }[];
    risk_assessment: RiskAssessmentResult | null;
}
export interface MalwareDashboardStats {
    total: number; analyzed: number; queued: number; failed: number; malicious: number; suspicious: number;
    knownFamilies: { id: number; name: string }[];
    recentSamples: { id: number; filename: string; sha256: string; status: string; classification: string; risk: string | null; created_at: string | null }[];
    recentThreatMatches: { sampleId: number; filename: string; iocValue: string; risk: string | null; observed_at: string | null }[];
}
export interface MalwareAnalysisMetadata { classifications: MalwareClassification[]; maxFileSizeBytes: number; }

export async function getMalwareAnalysisMetadata(): Promise<MalwareAnalysisMetadata> {
    const body = await intelligenceJson<{ data: MalwareAnalysisMetadata }>('/api/malware-analysis/metadata', 'Failed to load metadata');
    return body.data;
}

// §25 "ANALYSIS JOB" — 202 Accepted + a job id; the caller polls
// getMalwareAnalysisJob()/getMalwareSample() for progress, never a blocking
// request. multipart/form-data — never JSON-wrapped.
export async function uploadMalwareSample(file: File): Promise<{ sampleId: number; jobId: number | null; created: boolean; detectedType: string; signatureMismatch: boolean; mismatchReason: string | null }> {
    const form = new FormData();
    form.append('sample', file, file.name);
    const res = await fetchWithAuth(`${API_BASE_URL}/api/malware-analysis/upload`, { method: 'POST', body: form });
    const responseBody = await res.json().catch(() => ({}));
    if (res.status === 401 || res.status === 403) throw new Error('Authentication required. Please login.');
    if (!res.ok) throw new Error(responseBody?.message || 'Failed to upload sample');
    return responseBody.data;
}

export async function getMalwareSamples(params: { q?: string; type?: string; status?: string; classification?: string; risk?: string; architecture?: string; dateFrom?: string; dateTo?: string; threatMatch?: boolean; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: MalwareSample[]; total: number; page: number; pageSize: number }>(`/api/malware-analysis/samples?${qs.toString()}`, 'Failed to load samples');
}
export async function getMalwareSample(id: number): Promise<MalwareSampleDetail> {
    const body = await intelligenceJson<{ data: { sample: MalwareSampleDetail } }>(`/api/malware-analysis/samples/${id}`, 'Failed to load sample');
    return body.data.sample;
}
export async function getMalwareAnalysisDashboard(): Promise<MalwareDashboardStats> {
    const body = await intelligenceJson<{ data: MalwareDashboardStats }>('/api/malware-analysis/dashboard', 'Failed to load dashboard');
    return body.data;
}
export async function getMalwareAnalysisJob(id: number): Promise<MalwareAnalysisJob> {
    const body = await intelligenceJson<{ data: MalwareAnalysisJob }>(`/api/malware-analysis/jobs/${id}`, 'Failed to load job');
    return body.data;
}
// §33 "REANALYSIS"
export async function reanalyzeMalwareSample(id: number): Promise<{ jobId: number }> {
    const body = await intelligenceJson<{ data: { jobId: number } }>(`/api/malware-analysis/samples/${id}/reanalyze`, 'Failed to queue reanalysis', { method: 'POST' });
    return body.data;
}
// §30 "ANALYST ASSESSMENT" — the structured classification field; free-text
// Assessment/Notes go through the existing createAssessment()/
// getEntityAssessments() (entityType='malware_sample') already used by
// every other module.
export async function setMalwareSampleClassification(id: number, classification: MalwareClassification) {
    return intelligenceJson(`/api/malware-analysis/samples/${id}/classification`, 'Failed to set classification', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classification }) });
}
// §21 "EXISTING MALWARE INTELLIGENCE"
export async function linkMalwareSampleToFamily(id: number, malwareId: number): Promise<{ linked: boolean; malwareName: string }> {
    const body = await intelligenceJson<{ data: { linked: boolean; malwareName: string } }>(`/api/malware-analysis/samples/${id}/link-malware`, 'Failed to link family', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ malwareId }) });
    return body.data;
}
export async function deleteMalwareSample(id: number) {
    return intelligenceJson(`/api/malware-analysis/samples/${id}`, 'Failed to delete sample', { method: 'DELETE' });
}
// §36 "DOWNLOAD SECURITY" — authenticated blob fetch, never a bare <a href>
// (the endpoint requires malware_intel.download + a Bearer token).
export async function downloadMalwareSample(id: number, sha256: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/malware-analysis/samples/${id}/download`, {});
    if (res.status === 401 || res.status === 403) throw new Error('You do not have permission to download samples.');
    if (!res.ok) throw new Error('Failed to download sample');
    const blob = await res.blob();
    downloadBlob(blob, `${sha256}.bin`);
}

// ── Malware Analysis — Behavioral Analysis / Sandbox (MALWARE_ANALYSIS_
// PHASE2.md) ─────────────────────────────────────────────────────────────
export type SandboxHealthStatus = 'available' | 'not_configured' | 'unavailable' | 'authentication_error' | 'timeout' | 'error';
export interface SandboxHealth { provider: string; displayName: string; status: SandboxHealthStatus; version?: string | null; capabilities?: string[]; reason?: string | null; }
export type BehaviorJobStatus = 'queued' | 'submitting' | 'submitted' | 'running' | 'collecting' | 'normalizing' | 'enriching' | 'completed' | 'partial' | 'timed_out' | 'failed' | 'cancelled';
export interface BehaviorJob {
    id: number; sample_id: number; provider: string; sandbox_task_id: string | null;
    status: BehaviorJobStatus; stage: string | null; error_message: string | null; cancel_requested: boolean;
    submitted_at: string | null; started_at: string | null; completed_at: string | null; timeout_at: string | null;
    behavior_fingerprint: string | null; ai_summary: { summary: string; riskFactors?: string[]; note: string } | null;
    created_at: string | null; updated_at: string | null;
    normalized_summary?: BehaviorNormalizedSummary | null;
}
export interface BehaviorEvent {
    id: number; job_id: number; sample_id: number; type: 'PROCESS' | 'FILE' | 'REGISTRY' | 'NETWORK' | 'DNS' | 'PERSISTENCE';
    timestamp: string | null; process: { name: string | null; pid: number | null; parentPid: number | null } | null;
    source: string | null; target: string | null; value: string | null; metadata: Record<string, any> | null;
    reviewed_status: 'unreviewed' | 'confirmed' | 'rejected'; reviewed_by_user_id: number | null; reviewed_at: string | null; created_at: string | null;
}
export interface BehaviorNormalizedSummary {
    sectionAvailability: { process: boolean; file: boolean; registry: boolean; network: boolean };
    counts: { process: number; network: number; file: number; registry: number; persistence: number };
    iocsFound: number;
    techniques: { techniqueId: string; techniqueName: string; reason: string; confidence: string }[];
    similarSamples: { id: number; filename: string; sha256: string; classification: string; risk: string | null }[];
    familyContext: { families: { id: number; name: string }[]; threatActors: { id: number; name: string; confidence: string }[] };
    campaignCorrelations: { id: number; name: string; status: string; severity: string; sharedIocCount: number }[];
}
export interface BehaviorEventsByType {
    process: BehaviorEvent[]; file: BehaviorEvent[]; registry: BehaviorEvent[]; network: BehaviorEvent[]; dns: BehaviorEvent[]; persistence: BehaviorEvent[];
}

// §6 "SANDBOX HEALTH" — a real check every call; never assumed Available client-side.
export async function getSandboxHealth(): Promise<SandboxHealth> {
    const body = await intelligenceJson<{ data: SandboxHealth }>('/api/malware-analysis/sandbox/health', 'Failed to check sandbox health');
    return body.data;
}
// §7/§48 "SUBMISSION WORKFLOW" / "BACKGROUND JOB" — 202 Accepted + a job id.
export async function submitBehaviorAnalysis(sampleId: number): Promise<{ jobId: number }> {
    const body = await intelligenceJson<{ data: { jobId: number } }>(`/api/malware-analysis/samples/${sampleId}/behavior-analysis`, 'Failed to submit for behavioral analysis', { method: 'POST' });
    return body.data;
}
export async function getBehaviorJob(id: number): Promise<BehaviorJob> {
    const body = await intelligenceJson<{ data: BehaviorJob }>(`/api/malware-analysis/behavior-jobs/${id}`, 'Failed to load behavior job');
    return body.data;
}
// §38 "CANCELLATION"
export async function cancelBehaviorAnalysis(jobId: number): Promise<{ alreadyTerminal: boolean }> {
    const body = await intelligenceJson<{ data: { alreadyTerminal: boolean } }>(`/api/malware-analysis/behavior-jobs/${jobId}/cancel`, 'Failed to cancel analysis', { method: 'POST' });
    return body.data;
}
// §41 "SANDBOX RESULT UI" — the one bundled results call.
export async function getMalwareSampleBehavior(sampleId: number): Promise<{ latestJob: BehaviorJob | null; jobs: BehaviorJob[]; events: BehaviorEventsByType }> {
    const body = await intelligenceJson<{ data: { latestJob: BehaviorJob | null; jobs: BehaviorJob[]; events: BehaviorEventsByType } }>(`/api/malware-analysis/samples/${sampleId}/behavior`, 'Failed to load behavioral results');
    return body.data;
}
// §33 "ANALYST REVIEW" — [Confirm Finding] / [Reject Finding]
export async function reviewBehaviorEvent(eventId: number, action: 'confirm' | 'reject') {
    return intelligenceJson(`/api/malware-analysis/behavior-events/${eventId}/review`, 'Failed to review finding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
}
export async function reviewMitreTechniqueFinding(sampleId: number, techniqueId: string, action: 'confirm' | 'reject') {
    return intelligenceJson(`/api/malware-analysis/samples/${sampleId}/techniques/${encodeURIComponent(techniqueId)}/review`, 'Failed to review technique finding', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) });
}

// ── Malware Analysis — Advanced Intelligence (MALWARE_ANALYSIS_PHASE3.md) ──
export interface SimilarityCategory { key: string; label: string; similarityLabel: string; score: number | null; weight: number; evidence: Record<string, any>; }
export interface SampleSimilarity { overallScore: number; overallLabel: string; sameFingerprint: boolean; categories: SimilarityCategory[]; disclaimer: string; }
export interface SimilarSampleResult { otherSampleId: number; overallScore: number; overallLabel: string; sameFingerprint: boolean; categories: SimilarityCategory[]; computedAt: string | null; }
export interface ClusterMember { sampleId: number; filename: string; sha256: string; detectedType: string | null; classification: string; risk: string | null; similarityToCluster: number | null; firstSeen: string | null; joinedAt: string | null; }
export interface MalwareCluster {
    id: number; cluster_key: string; status: 'new' | 'expanded' | 'stable' | 'merged' | 'split' | 'archived'; member_count: number;
    characteristics: Array<{ key: string; label: string; corroboratingSamples: number; examples: string[] }>;
    matched_malware_id: number | null; family_confidence: string | null; family_match_reason: string | null;
    created_at: string | null; updated_at: string | null; last_computed_at: string | null; members?: ClusterMember[];
}
export interface DetectionCoverage {
    yara: { total: number; byStatus: Record<string, number> }; sigma: { total: number; byStatus: Record<string, number> };
    attack: { mappedTechniqueCount: number }; ioc: { extractedCount: number };
    behavior: { observed: boolean; categories: string[] };
    gaps: Array<{ observed: string; detection: string; recommendation: string }>;
}
export interface AttributionCandidate { actorId: number; actorName: string; signals: Array<{ signal: string; present: boolean }>; attributionSupportScore: number; existingConfidence: string; assessment: string; }
export interface AttributionSupport { candidates: AttributionCandidate[]; conflict: boolean; conflictReason: string | null; note?: string; disclaimer: string; }
export interface FingerprintHistory {
    jobs: Array<{ jobId: number; fingerprint: string | null; status: string; completedAt: string | null; createdAt: string | null }>;
    comparison: { changed: boolean; previousJobId: number; currentJobId: number; processDiff: any; networkDiff: any; persistenceDiff: any; techniqueDiff: any } | null;
}
export interface AdvancedIntelligence {
    similarSamples: SimilarSampleResult[]; clusters: MalwareCluster[]; detectionCoverage: DetectionCoverage | null;
    attribution: AttributionSupport | null; fingerprintHistory: FingerprintHistory;
    aiSummary: { summary: string; riskFactors?: string[]; note: string } | null;
}
export interface DetectionRuleVersion { id: number; rule_id: number; version_number: number; content: string; test_result: string; test_details: any; tested_at: string | null; created_at: string | null; }
export interface DetectionRule {
    id: number; rule_type: 'yara' | 'sigma'; name: string; status: 'draft' | 'review' | 'approved' | 'published' | 'rejected';
    purpose: string | null; matched_features: Record<string, any>; source_sample_ids: number[]; source_cluster_id: number | null;
    current_version: number; created_by_user_id: number; created_by_username: string | null;
    reviewed_by_user_id: number | null; reviewed_at: string | null; published_at: string | null;
    created_at: string | null; updated_at: string | null; versions?: DetectionRuleVersion[]; currentContent?: string | null;
}

export async function getMalwareSampleAdvanced(sampleId: number): Promise<AdvancedIntelligence> {
    const body = await intelligenceJson<{ data: AdvancedIntelligence }>(`/api/malware-analysis/samples/${sampleId}/advanced`, 'Failed to load advanced intelligence');
    return body.data;
}
export async function recomputeMalwareAdvanced(sampleId: number) {
    return intelligenceJson<{ data: { clustered: boolean; clusterId?: number; clusterKey?: string; status?: string; memberCount?: number; reason?: string } }>(`/api/malware-analysis/samples/${sampleId}/recompute-advanced`, 'Failed to recompute similarity/clusters', { method: 'POST' }).then((b) => b.data);
}
export async function compareMalwareSamples(sampleAId: number, sampleBId: number) {
    const body = await intelligenceJson<{ data: { sampleAId: number; sampleBId: number; similarity: SampleSimilarity; importComparison: { shared: string[]; addedInB: string[]; removedFromA: string[] } } }>(`/api/malware-analysis/samples/${sampleAId}/compare/${sampleBId}`, 'Failed to compare samples');
    return body.data;
}
export async function getMalwareClusters(params: { status?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    return intelligenceJson<{ items: MalwareCluster[]; total: number; page: number; pageSize: number }>(`/api/malware-analysis/clusters?${qs.toString()}`, 'Failed to load clusters');
}
export async function getMalwareCluster(id: number): Promise<MalwareCluster> {
    const body = await intelligenceJson<{ data: MalwareCluster }>(`/api/malware-analysis/clusters/${id}`, 'Failed to load cluster');
    return body.data;
}
export async function mergeMalwareClusters(clusterId: number, targetClusterId: number) {
    return intelligenceJson(`/api/malware-analysis/clusters/${clusterId}/merge`, 'Failed to merge clusters', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetClusterId }) });
}
export async function generateYaraForSample(sampleId: number) {
    const body = await intelligenceJson<{ data: { generated: boolean; ruleId?: number; name?: string; reason?: string } }>(`/api/malware-analysis/samples/${sampleId}/yara`, 'Failed to generate YARA rule', { method: 'POST' });
    return body.data;
}
export async function generateYaraForCluster(clusterId: number) {
    const body = await intelligenceJson<{ data: { generated: boolean; ruleId?: number; name?: string; reason?: string } }>(`/api/malware-analysis/clusters/${clusterId}/yara`, 'Failed to generate YARA rule', { method: 'POST' });
    return body.data;
}
export async function generateSigmaForSample(sampleId: number) {
    const body = await intelligenceJson<{ data: { generated: Array<{ ruleId: number; name: string; ruleType: string; structurallyValid: boolean }>; reason?: string } }>(`/api/malware-analysis/samples/${sampleId}/sigma`, 'Failed to generate Sigma rule(s)', { method: 'POST' });
    return body.data;
}
export async function getDetectionRules(params: { ruleType?: string; status?: string; q?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: DetectionRule[]; total: number; page: number; pageSize: number }>(`/api/malware-analysis/detection-rules?${qs.toString()}`, 'Failed to load detection rules');
}
export async function getDetectionRuleDashboard() {
    const body = await intelligenceJson<{ data: { byType: Record<string, Record<string, number>>; recent: DetectionRule[] } }>('/api/malware-analysis/detection-rules/dashboard', 'Failed to load detection rule dashboard');
    return body.data;
}
export async function getDetectionRule(id: number): Promise<DetectionRule> {
    const body = await intelligenceJson<{ data: DetectionRule }>(`/api/malware-analysis/detection-rules/${id}`, 'Failed to load detection rule');
    return body.data;
}
export async function addDetectionRuleVersion(ruleId: number, content: string) {
    return intelligenceJson(`/api/malware-analysis/detection-rules/${ruleId}/versions`, 'Failed to save rule version', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) });
}
export async function testDetectionRule(ruleId: number, params: { positiveSampleId?: number; negativeSampleId?: number } = {}) {
    const body = await intelligenceJson<{ data: any }>(`/api/malware-analysis/detection-rules/${ruleId}/test`, 'Failed to test rule', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    return body.data;
}
export async function transitionDetectionRule(ruleId: number, status: DetectionRule['status']) {
    return intelligenceJson(`/api/malware-analysis/detection-rules/${ruleId}/transition`, 'Failed to update rule status', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
}
export async function createKnowledgeEntryFromCluster(clusterId: number) {
    const body = await intelligenceJson<{ data: { entryId: number } }>(`/api/malware-analysis/clusters/${clusterId}/knowledge-entry`, 'Failed to create knowledge entry', { method: 'POST' });
    return body.data;
}
export async function createKnowledgeEntryFromMalwareFamily(malwareId: number) {
    const body = await intelligenceJson<{ data: { entryId: number } }>(`/api/malware-analysis/families/${malwareId}/knowledge-entry`, 'Failed to create knowledge entry', { method: 'POST' });
    return body.data;
}

// ── Ask AI (ASK_AI_PHASE1.md, ASK_AI_PHASE2.md) ─────────────────────────────
export interface AskAiSource { label: string; }
export interface AskAiEntity { type: string; id: string; label: string; }
export interface AskAiPageContext { type: string; id: string | number; label?: string; }
export interface AskAiContext { type: string; id?: string; label?: string; usedAmbientContext?: boolean; }
export type AskAiMode = 'analyst' | 'executive' | 'technical';

// §6/§7/§22 "RELATIONSHIP GRAPH CONTEXT" / "PATH EXPLANATION" / "MULTI ENTITY QUESTIONS"
export interface AskAiRelationshipHop { from: AskAiEntity | null; to: AskAiEntity | null; relationshipType: string | null; basis: string | null; confidence: string | null; }
export interface AskAiRelationshipPathItem { from: AskAiEntity; to: AskAiEntity; found: boolean; hops: AskAiRelationshipHop[]; restricted?: boolean; }
export interface AskAiRelationshipPath { supported: boolean; reason?: string; anchor?: AskAiEntity; paths?: AskAiRelationshipPathItem[]; graphTruncated?: boolean; }

// §23/§24 "COMPARE ENTITIES" / "COMPARE INVESTIGATIONS"
export interface AskAiComparisonSide { id?: string; type?: string; label?: string; restricted?: boolean; riskLevel?: string | null; evidenceCount?: number; relationshipCount?: number; relatedEntityCount?: number; }
export interface AskAiComparison { type: string; supported: boolean; reason?: string; a?: AskAiComparisonSide; b?: AskAiComparisonSide; similarity?: { overallScore?: number; [key: string]: unknown }; [key: string]: unknown; }

// §8/§9 "EVIDENCE RANKING" / "STRONGEST EVIDENCE QUERY"
export interface AskAiEvidenceItem { source: string; description?: string; confidence?: string | null; created_at?: string | null; rank: string; score: number; entity_type?: string; entity_id?: string; }
export interface AskAiEvidenceRanking { primary: AskAiEvidenceItem[]; supporting: AskAiEvidenceItem[]; contextual: AskAiEvidenceItem[]; weak: AskAiEvidenceItem[]; strongest: AskAiEvidenceItem | null; }

// §25/§26 "CHANGE ANALYSIS" / "TIME AWARE QUESTIONS"
export interface AskAiChangeAnalysis { timeRange: { label: string; since: string | null }; supported: boolean; reason?: string; hasChanges?: boolean; events?: Array<{ timestamp: string; label: string; source: string; eventType: string }>; riskSignals?: string[]; }

// §10 "CONTRADICTION DETECTION"
export interface AskAiContradiction { subject: string; statement: string; claims: Array<{ value: string; sources: string[] }>; }

// §12/§51/§52 "GAP ANALYSIS"
export interface AskAiGaps { evidence: string[]; knowledge: string[]; investigation: string[]; }

// §30/§31 "ANALYST RECOMMENDATIONS" / "RECOMMENDATION EXPLANATION"
export interface AskAiRecommendation { action: string; targetType: string | null; targetId: string | null; targetLabel: string | null; reason: string; }

// ASK_AI_PHASE3.md — Operational AI Analyst types.
export type AskAiOperationalMode = 'analyze' | 'investigate' | 'threat_hunt' | 'explain' | 'compare' | 'plan' | 'review';
// §5-§7 "INVESTIGATION PLANNER" / "PLAN EXECUTION"
export interface AskAiPlanStep { label: string; toolName: string; params: Record<string, unknown>; executed: boolean; }
export interface AskAiInvestigationPlan { entity: AskAiEntity; steps: AskAiPlanStep[]; suggestCreateInvestigation: boolean; }
// §16-§18 "THREAT HUNTING ASSISTANT" / "QUERIES"
export interface AskAiSuggestedQuery { tool: string; dataSource: string; target: string; scope: string; params: Record<string, unknown>; }
export interface AskAiThreatHunt { hypothesis: string; confidence: string; evidence: string[]; status: string; relevantTechniques: AskAiEntity[]; relevantIocs: AskAiEntity[]; suggestedDataSources: string[]; suggestedQueries: AskAiSuggestedQuery[]; expectedSignals: string[]; }
// §13-§15 "HYPOTHESES"
export interface AskAiHypothesisDraft { statement: string; supporting: string[]; contradicting: string[]; unknowns: string[]; confidence: string; status: string; }
// §27 "EVIDENCE GAP ANALYST"
export interface AskAiEvidenceGapReport { missingEvidence: string[]; weakEvidence: Array<{ description: string; reasons?: string[] }>; conflictingEvidence: AskAiContradiction[]; outdatedEvidence: Array<{ description: string; ageDays: number }>; unverifiedRelationships: Array<{ relationshipType: string; entity: AskAiEntity; confidence: string | null; source: string }>; }
// §28 "INVESTIGATION PRIORITY"
export interface AskAiPriority { level: 'HIGH' | 'MEDIUM' | 'LOW'; reasons: string[]; }
// §9-§12/§51-§53 "CONTROLLED ACTIONS" / "ACTION APPROVAL" / "ACTION RESULT"
export interface AskAiActionProposal {
    id: number; action: string; label?: string; status: 'proposed' | 'unavailable' | 'approved' | 'rejected' | 'executed' | 'failed';
    target?: string; targetType?: string | null; targetId?: string | null; targetLabel?: string | null;
    reason?: string; impact?: string; requiredPermission?: string | null; unavailableReason?: string | null;
    result?: Record<string, unknown> | null; error?: string | null; created_at?: string | null; decided_at?: string | null; executed_at?: string | null;
}
export interface AskAiOperationalJob { id: number; status: 'queued' | 'running' | 'completed' | 'failed'; kind: string; result?: (AskAiAnswer & Record<string, unknown>) | null; error?: string | null; }

export interface AskAiAnswer {
    conversationId: number; answer: string; sources: AskAiSource[]; entities: AskAiEntity[];
    confidence: string; suggestedQuestions: string[]; queryType: string; context: AskAiContext;
    aiProvider: 'openai' | 'heuristic'; resultStatus: string;
    // ASK_AI_PHASE2.md §75 "UI" — every field below is optional: present only
    // when the corresponding Phase 2 analysis actually ran for this turn.
    mode?: AskAiMode; timeRange?: { label: string; since: string | null } | null;
    entities2?: AskAiEntity[]; // reserved — the multi-entity list is exposed as top-level `entities` on the wire; see AskAiMessage below for the per-message shape
    relationshipPath?: AskAiRelationshipPath; comparison?: AskAiComparison; changeAnalysis?: AskAiChangeAnalysis;
    evidenceRanking?: AskAiEvidenceRanking; contradictions?: AskAiContradiction[]; gaps?: AskAiGaps; recommendations?: AskAiRecommendation[];
    dataAvailability?: string; evidenceConfidence?: string; interpretationConfidence?: string;
    // ASK_AI_PHASE3.md §50 "UI (OPERATIONAL AI ANALYST)" — every field below
    // is optional: present only when this turn used an operational capability.
    operationalMode?: AskAiOperationalMode; investigationPlan?: AskAiInvestigationPlan; threatHunt?: AskAiThreatHunt;
    evidenceGapReport?: AskAiEvidenceGapReport; priority?: AskAiPriority; hypothesisDraft?: AskAiHypothesisDraft;
    actionProposals?: AskAiActionProposal[]; assessment?: string; unknowns?: string[]; reasoningSummary?: string;
    assessmentConfidence?: string; actionConfidence?: string;
    // §54 "BACKGROUND TASKS" — present instead of a normal answer when this
    // turn was backgrounded (a full Case analysis); poll getAskAiJob(jobId).
    jobId?: number; jobStatus?: 'queued';
}
export interface AskAiMessage {
    id: number; conversation_id: number; role: 'user' | 'assistant'; content: string;
    sources: AskAiSource[]; entities: AskAiEntity[]; suggestedQuestions: string[];
    confidence: string | null; queryType: string | null; contextType: string | null; contextEntityId: string | null;
    aiProvider: string | null; resultStatus: string | null; created_at: string | null;
}
export interface AskAiConversationSummary { id: number; title: string; messageCount: number; created_at: string | null; updated_at: string | null; }
export interface AskAiConversationDetail { id: number; title: string | null; created_at: string | null; updated_at: string | null; messages: AskAiMessage[]; }

export async function getAskAiContextTypes(): Promise<string[]> {
    const body = await intelligenceJson<{ data: { contextTypes: string[] } }>('/api/ai/context-types', 'Failed to load context types');
    return body.data.contextTypes;
}
// §12/§44/§45 "QUERY GROUNDING" / "RATE LIMITING" / "CONCURRENT REQUESTS"
// §46/§75 "AI SUMMARY MODES" / "UI (Mode Selector)" — `mode` is OMITTED
// entirely from the request body unless the analyst explicitly picked one,
// so the default (no mode selected) request is byte-identical to Phase 1.
// ASK_AI_PHASE3.md §4/§50 "OPERATIONAL AI MODES" / "UI" — `operationalMode`
// is likewise omitted unless explicitly selected, for the identical reason.
export async function askAi(question: string, opts: { conversationId?: number | null; pageContext?: AskAiPageContext | null; mode?: AskAiMode | null; operationalMode?: AskAiOperationalMode | null } = {}): Promise<AskAiAnswer> {
    const body = await intelligenceJson<{ data: AskAiAnswer }>('/api/ai/ask', 'Ask AI is temporarily unavailable', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, conversationId: opts.conversationId ?? null, pageContext: opts.pageContext ?? null, ...(opts.mode ? { mode: opts.mode } : {}), ...(opts.operationalMode ? { operationalMode: opts.operationalMode } : {}) })
    });
    return body.data;
}

// ASK_AI_PHASE3.md §51/§52/§53 "ACTION APPROVAL UI" / "ACTION RESULT" / "ACTION FAILURE"
export async function approveAskAiAction(id: number): Promise<{ id: number; status: string; result?: unknown; error?: string }> {
    const body = await intelligenceJson<{ data: { id: number; status: string; result?: unknown; error?: string } }>(`/api/ai/actions/${id}/approve`, 'Failed to approve action', { method: 'POST' });
    return body.data;
}
export async function rejectAskAiAction(id: number): Promise<{ id: number; status: string }> {
    const body = await intelligenceJson<{ data: { id: number; status: string } }>(`/api/ai/actions/${id}/reject`, 'Failed to reject action', { method: 'POST' });
    return body.data;
}
// §50 UI "Action History".
export async function getAskAiActionHistory(conversationId?: number): Promise<AskAiActionProposal[]> {
    const qs = conversationId ? `?conversationId=${conversationId}` : '';
    const body = await intelligenceJson<{ data: AskAiActionProposal[] }>(`/api/ai/actions${qs}`, 'Failed to load action history');
    return body.data;
}
// §54 "BACKGROUND TASKS" — polled while a backgrounded analysis runs.
export async function getAskAiJob(jobId: number): Promise<AskAiOperationalJob> {
    const body = await intelligenceJson<{ data: AskAiOperationalJob }>(`/api/ai/jobs/${jobId}`, 'Failed to load job status');
    return body.data;
}
// §7/§18 "PLAN EXECUTION" / "QUERY PREVIEW" — "[Run Step]"/"[Run Query]".
export async function runAskAiTool(name: string, params: Record<string, unknown> = {}): Promise<{ tool: string; status: string; data?: unknown; error?: string }> {
    const body = await intelligenceJson<{ data: { tool: string; status: string; data?: unknown; error?: string } }>(`/api/ai/tools/${encodeURIComponent(name)}/run`, 'Failed to run tool', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ params })
    });
    return body.data;
}
export async function getAskAiConversations(): Promise<AskAiConversationSummary[]> {
    const body = await intelligenceJson<{ data: AskAiConversationSummary[] }>('/api/ai/conversations', 'Failed to load conversations');
    return body.data;
}
export async function createAskAiConversation(): Promise<{ id: number }> {
    const body = await intelligenceJson<{ data: { id: number } }>('/api/ai/conversations', 'Failed to create conversation', { method: 'POST' });
    return body.data;
}
export async function getAskAiConversation(id: number): Promise<AskAiConversationDetail> {
    const body = await intelligenceJson<{ data: AskAiConversationDetail }>(`/api/ai/conversations/${id}`, 'Failed to load conversation');
    return body.data;
}
export async function deleteAskAiConversation(id: number) {
    return intelligenceJson(`/api/ai/conversations/${id}`, 'Failed to delete conversation', { method: 'DELETE' });
}

// ── DOCUMENT_INTELLIGENCE_PHASE1.md — Document Repository, Ingestion,
// Metadata, Text Extraction & Search ─────────────────────────────────────
export type DocumentType = 'PDF' | 'DOCX' | 'TXT' | 'CSV' | 'JSON' | 'HTML' | 'XML' | 'Unsupported';
export type DocumentExtractionStatus = 'pending' | 'processing' | 'completed' | 'partial' | 'failed' | 'unsupported';
export type DocumentSource = 'analyst_upload' | 'threat_intelligence' | 'investigation' | 'threat_brief' | 'knowledge_base' | 'external_report' | 'other';

export interface DocumentRecord {
    id: number; documentId: string; filename: string;
    detectedType: DocumentType; detectedMimeType: string | null; claimedExtension: string | null;
    signatureMismatch: boolean; mismatchReason: string | null;
    fileSize: number; sha256: string; sha1: string | null; md5: string | null;
    source: DocumentSource; sourceModule: string | null; sourceReference: string | null;
    uploadedByUserId: number | null; uploadedByUsername: string | null;
    extractionStatus: DocumentExtractionStatus; extractionError: string | null;
    pageCount: number | null; pagesExtracted: number | null; charCount: number | null;
    hasTextLayer: boolean | null;
    extractionStartedAt: string | null; extractionCompletedAt: string | null; createdAt: string | null;
    // DOCUMENT_INTELLIGENCE_PHASE3.md §42/§43/§28-§29 — real, persisted-at-analysis-time fields.
    suggestedType?: string | null; topics?: string[]; reviewedAt?: string | null; reviewedByUserId?: number | null;
}

export interface DocumentContent { id: number; extractionStatus: DocumentExtractionStatus; text: string; hasTextLayer: boolean | null; charCount: number | null; }
export interface DocumentPage { pageNumber: number; charCount: number; content: string; }
export interface DocumentSearchResult { query: string; totalMatches: number; pages: { pageNumber: number; matchCount: number; snippets: string[] }[]; }
export interface DocumentStats {
    total: number; pending: number; processing: number; completed: number; partial: number; failed: number; unsupported: number;
    totalStorageBytes: number; documentsWithoutText: number; documentsFailed: number;
}

// §5 "DOCUMENT UPLOAD" — multipart upload; validation happens server-side
// against the real bytes, never the browser's claimed type.
export async function uploadDocument(file: File, meta: { source?: DocumentSource; sourceModule?: string; sourceReference?: string } = {}): Promise<{ id: number; documentId: string; sha256: string; detectedType: DocumentType; signatureMismatch: boolean; mismatchReason: string | null }> {
    const form = new FormData();
    form.append('file', file);
    if (meta.source) form.append('source', meta.source);
    if (meta.sourceModule) form.append('sourceModule', meta.sourceModule);
    if (meta.sourceReference) form.append('sourceReference', meta.sourceReference);
    const body = await intelligenceJson<{ data: { id: number; documentId: string; sha256: string; detectedType: DocumentType; signatureMismatch: boolean; mismatchReason: string | null } }>('/api/documents', 'Failed to upload document', { method: 'POST', body: form });
    return body.data;
}

export async function getDocuments(params: { q?: string; type?: string; extractionStatus?: string; source?: string; uploadedBy?: number; caseId?: number; dateFrom?: string; dateTo?: string; sort?: string; page?: number; pageSize?: number } = {}) {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    return intelligenceJson<{ items: DocumentRecord[]; total: number; page: number; pageSize: number }>(`/api/documents?${qs.toString()}`, 'Failed to load documents');
}

export async function getDocumentStats(): Promise<DocumentStats> {
    const body = await intelligenceJson<{ data: DocumentStats }>('/api/documents/stats', 'Failed to load document statistics');
    return body.data;
}

export async function getDocument(id: number): Promise<DocumentRecord> {
    const body = await intelligenceJson<{ data: DocumentRecord }>(`/api/documents/${id}`, 'Failed to load document');
    return body.data;
}

export async function getDocumentContent(id: number): Promise<DocumentContent> {
    const body = await intelligenceJson<{ data: DocumentContent }>(`/api/documents/${id}/content`, 'Failed to load document content');
    return body.data;
}

export async function getDocumentPages(id: number): Promise<DocumentPage[]> {
    const body = await intelligenceJson<{ data: { pages: DocumentPage[] } }>(`/api/documents/${id}/pages`, 'Failed to load document pages');
    return body.data.pages;
}

// §30/§31 "DOCUMENT CONTENT SEARCH" / "SEARCH SNIPPETS".
export async function searchWithinDocument(id: number, q: string): Promise<DocumentSearchResult> {
    const body = await intelligenceJson<{ data: DocumentSearchResult }>(`/api/documents/${id}/search?q=${encodeURIComponent(q)}`, 'Search failed');
    return body.data;
}

export interface EntityCaseRef { id: number; case_number: string; title: string; status: string; updated_at: string | null; }
// §32/§33 "CASE INTEGRATION" / "INVESTIGATION INTEGRATION" — generic, reused for Documents (and any future entity type).
export async function getCasesForEntity(entityType: string, entityId: string | number, limit = 20): Promise<EntityCaseRef[]> {
    const body = await intelligenceJson<{ data: EntityCaseRef[] }>(`/api/investigations/entity/${encodeURIComponent(entityType)}/${encodeURIComponent(String(entityId))}/cases?limit=${limit}`, 'Failed to load investigations');
    return body.data;
}

// §43/§44 "DOCUMENT DOWNLOAD" / "DOWNLOAD SECURITY" — authenticated blob
// fetch, never a bare <a href> (the endpoint requires a Bearer token; same
// pattern as downloadMalwareSample above).
export async function downloadDocument(id: number, filename: string) {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/documents/${id}/download`, {});
    if (res.status === 401 || res.status === 403) throw new Error('You do not have permission to download this document.');
    if (res.status === 404) throw new Error('Document not found.');
    if (!res.ok) throw new Error('Failed to download document');
    const blob = await res.blob();
    downloadBlob(blob, filename);
}

// ── DOCUMENT_INTELLIGENCE_PHASE2.md — IOC Extraction, Entity Extraction,
// CTI Correlation & Document Analysis ─────────────────────────────────────
export type CandidateReviewState = 'unreviewed' | 'accepted' | 'rejected';
export type DocumentAnalysisStatus = 'not_analyzed' | 'queued' | 'processing' | 'completed' | 'partial' | 'failed';

export interface DocumentAnalysisSummary {
    documentId: number; analysisStatus: DocumentAnalysisStatus; analysisError: string | null;
    analysisStartedAt: string | null; analysisCompletedAt: string | null;
    iocCandidates: { unreviewed: number; accepted: number; rejected: number; total: number };
    entityCandidates: { unreviewed: number; accepted: number; rejected: number; total: number };
    relationshipCandidates: { unreviewed: number; accepted: number; rejected: number; total: number };
    evidenceCreated: number;
}

export interface DocumentIocCandidate {
    id: number; type: string; value: string; pageNumber: number | null; snippet: string | null;
    occurrenceCount: number; confidence: string; extractionMethod: string;
    existingIocId: number | null; status: string; reviewState: CandidateReviewState;
    reviewedByUserId: number | null; reviewedAt: string | null; createdEvidenceId: number | null; createdAt: string | null;
    misp: { matched: boolean; eventInfo: string | null; attributeType: string | null } | null;
}
export interface DocumentEntityCandidateMatch { entityType: string; entityId: string; label: string; viaAlias: boolean; }
export interface DocumentEntityCandidate {
    id: number; entityType: string; candidateText: string; matchedEntityId: string | null; matchedEntityLabel: string | null;
    matchConfidence: 'exact' | 'strong' | 'possible' | 'ambiguous' | 'unknown'; matches: DocumentEntityCandidateMatch[];
    pageNumber: number | null; snippet: string | null; occurrenceCount: number; reviewState: CandidateReviewState;
    reviewedByUserId: number | null; reviewedAt: string | null; createdEvidenceId: number | null; createdAt: string | null;
}
export interface DocumentRelationshipCandidate {
    id: number; source: { type: string; text: string; entityId: string | null }; target: { type: string; text: string; entityId: string | null };
    relationshipType: string; pageNumber: number | null; snippet: string | null; confidence: string;
    reviewState: CandidateReviewState; reviewedByUserId: number | null; reviewedAt: string | null; createdAt: string | null;
}

export async function analyzeDocument(id: number) {
    return intelligenceJson<{ data: { queued: boolean } }>(`/api/documents/${id}/analyze`, 'Failed to queue analysis', { method: 'POST' });
}
export async function getDocumentAnalysis(id: number): Promise<DocumentAnalysisSummary> {
    const body = await intelligenceJson<{ data: DocumentAnalysisSummary }>(`/api/documents/${id}/analysis`, 'Failed to load analysis');
    return body.data;
}
export async function getDocumentIocCandidates(id: number, reviewState?: string): Promise<DocumentIocCandidate[]> {
    const body = await intelligenceJson<{ data: { items: DocumentIocCandidate[] } }>(`/api/documents/${id}/iocs${reviewState ? `?reviewState=${reviewState}` : ''}`, 'Failed to load IOC candidates');
    return body.data.items;
}
export async function getDocumentEntityCandidates(id: number, reviewState?: string): Promise<DocumentEntityCandidate[]> {
    const body = await intelligenceJson<{ data: { items: DocumentEntityCandidate[] } }>(`/api/documents/${id}/entities${reviewState ? `?reviewState=${reviewState}` : ''}`, 'Failed to load entity candidates');
    return body.data.items;
}
export async function getDocumentRelationshipCandidates(id: number, reviewState?: string): Promise<DocumentRelationshipCandidate[]> {
    const body = await intelligenceJson<{ data: { items: DocumentRelationshipCandidate[] } }>(`/api/documents/${id}/relationships${reviewState ? `?reviewState=${reviewState}` : ''}`, 'Failed to load relationship candidates');
    return body.data.items;
}

// §17/§20-22/§31 "IOC REVIEW" / "ENTITY MATCHING" / "ANALYST APPROVAL" — every
// action is an explicit analyst decision; Accept always delegates to the
// existing IOC/Relationship write path server-side, never a new one here.
export async function acceptIocCandidate(documentId: number, candidateId: number) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/ioc/${candidateId}/accept`, 'Failed to accept candidate', { method: 'POST' });
}
export async function rejectIocCandidate(documentId: number, candidateId: number, reason?: string) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/ioc/${candidateId}/reject`, 'Failed to reject candidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}
export async function acceptEntityCandidate(documentId: number, candidateId: number, matchedEntityId?: string) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/entity/${candidateId}/accept`, 'Failed to accept candidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matchedEntityId }) });
}
export async function rejectEntityCandidate(documentId: number, candidateId: number, reason?: string) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/entity/${candidateId}/reject`, 'Failed to reject candidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}
export async function acceptRelationshipCandidate(documentId: number, candidateId: number) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/relationship/${candidateId}/accept`, 'Failed to accept candidate', { method: 'POST' });
}
export async function rejectRelationshipCandidate(documentId: number, candidateId: number, reason?: string) {
    return intelligenceJson(`/api/documents/${documentId}/candidates/relationship/${candidateId}/reject`, 'Failed to reject candidate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}
// §38-40/§79 "EVIDENCE CREATION" — a separate, explicit action from Accept.
export async function createEvidenceFromCandidate(documentId: number, candidateType: 'ioc' | 'entity', candidateId: number) {
    return intelligenceJson<{ data: { evidenceId: number } }>(`/api/documents/${documentId}/candidates/${candidateType}/${candidateId}/evidence`, 'Failed to create evidence', { method: 'POST' });
}

// §49 "ENTITY INTELLIGENCE VIEW" — "Documents Mentioning This Entity", reusable from any Malware/APT/Campaign/IOC detail page.
export async function getDocumentsMentioningEntity(entityType: string, entityId: string | number): Promise<{ total: number; recent: number; documents: { id: number; filename: string; createdAt: string | null }[] }> {
    const body = await intelligenceJson<{ data: { total: number; recent: number; documents: { id: number; filename: string; createdAt: string | null }[] } }>(`/api/intelligence/${entityType}/${entityId}/documents`, 'Failed to load documents');
    return body.data;
}

// ── DOCUMENT_INTELLIGENCE_PHASE3.md — Claims, Correlation, Comparison,
// Conflicts, Review Queue, Dashboard & Knowledge/Threat Brief Drafts ───────
export type ClaimReviewState = 'unreviewed' | 'reviewed' | 'accepted' | 'rejected' | 'dismissed';
export interface DocumentClaimEntityRef { type: string; text: string; matchedId: string | null; label: string | null; }
export interface DocumentClaim {
    id: number; claimType: string; subject: DocumentClaimEntityRef; object: DocumentClaimEntityRef; context: DocumentClaimEntityRef | null;
    pageNumber: number | null; snippet: string | null; occurrenceCount: number;
    extractionConfidence: string; relationshipConfidence: string; reviewState: ClaimReviewState;
    reviewedByUserId: number | null; reviewedAt: string | null;
    createdRelationshipId: number | null; createdEvidenceId: number | null; createdAt: string | null; status: string;
}
export interface DocumentConflict {
    id: number; conflictType: string; objectType: string; objectMatchedId: string;
    claimA: DocumentClaim & { documentId: number; filename: string }; claimB: DocumentClaim & { documentId: number; filename: string };
    reviewState: 'unreviewed' | 'reviewed' | 'dismissed'; resolutionNote: string | null;
    reviewedByUserId: number | null; reviewedAt: string | null; createdAt: string | null; status: string;
}
export interface RelatedDocument { documentId: number; filename: string; createdAt: string | null; similarityScore: number; basis: string[]; }
export interface DocumentSimilarityResult { restricted: boolean; similarityScore?: number; basis?: string[]; textSimilarityPercent?: number; }
export interface DocumentDuplicatesResult {
    exactDuplicates: { documentId: number; filename: string; createdAt: string | null }[];
    nearDuplicates: { documentId: number; filename: string; textSimilarityPercent: number }[];
    potentialVersions: { documentId: number; filename: string; textSimilarityPercent: number; relation: string }[];
}
export interface DocumentComparisonResult {
    restricted: boolean;
    documentA?: { id: number; filename: string }; documentB?: { id: number; filename: string };
    iocs?: { added: string[]; removed: string[] }; threatActors?: { added: string[]; removed: string[] }; malware?: { added: string[]; removed: string[] };
    campaigns?: { added: string[]; removed: string[] }; attack?: { added: string[]; removed: string[] }; vulnerabilities?: { added: string[]; removed: string[] };
    claims?: { added: string[]; removed: string[] }; textChanged?: boolean; intelligenceChanged?: boolean; totalIntelligenceChanges?: number;
}
export interface DocumentIntelligenceDashboard {
    documents: number; analyzed: number; pendingReviewDocuments: number; newIocCandidates: number; entityCandidates: number;
    relationshipCandidates: number; claimCandidates: number; conflicts: number;
    recentlyAnalyzed: { documentId: number; filename: string; analyzedAt: string | null }[];
}
export interface ReviewQueueItem { id: number; documentId: number; kind: 'ioc' | 'entity' | 'relationship' | 'claim' | 'conflict'; label: string; }

export async function getDocumentClaims(id: number, reviewState?: string): Promise<DocumentClaim[]> {
    const body = await intelligenceJson<{ data: { items: DocumentClaim[] } }>(`/api/documents/${id}/claims${reviewState ? `?reviewState=${reviewState}` : ''}`, 'Failed to load claims');
    return body.data.items;
}
export async function acceptClaim(documentId: number, claimId: number) {
    return intelligenceJson(`/api/documents/${documentId}/claims/${claimId}/accept`, 'Failed to accept claim', { method: 'POST' });
}
export async function rejectClaim(documentId: number, claimId: number, reason?: string) {
    return intelligenceJson(`/api/documents/${documentId}/claims/${claimId}/reject`, 'Failed to reject claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}
export async function dismissClaim(documentId: number, claimId: number, reason?: string) {
    return intelligenceJson(`/api/documents/${documentId}/claims/${claimId}/dismiss`, 'Failed to dismiss claim', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) });
}
export async function createEvidenceFromClaim(documentId: number, claimId: number) {
    return intelligenceJson<{ data: { evidenceId: number } }>(`/api/documents/${documentId}/claims/${claimId}/evidence`, 'Failed to create evidence', { method: 'POST' });
}
export async function getClaimCorroboration(documentId: number, claimId: number) {
    const body = await intelligenceJson<{ data: { sourceCount: number; independentSourceCount: number; documents: number[]; sourceIndependenceNote: string | null } }>(`/api/documents/${documentId}/claims/${claimId}/corroboration`, 'Failed to load corroboration');
    return body.data;
}

export async function getDocumentConflicts(id: number): Promise<DocumentConflict[]> {
    const body = await intelligenceJson<{ data: { items: DocumentConflict[] } }>(`/api/documents/${id}/conflicts`, 'Failed to load conflicts');
    return body.data.items;
}
export async function reviewConflict(conflictId: number, dismiss: boolean, note?: string) {
    return intelligenceJson(`/api/documents/conflicts/${conflictId}/review`, 'Failed to review conflict', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dismiss, note }) });
}

export async function getRelatedDocuments(id: number): Promise<RelatedDocument[]> {
    const body = await intelligenceJson<{ data: { items: RelatedDocument[] } }>(`/api/documents/${id}/related`, 'Failed to load related documents');
    return body.data.items;
}
export async function getDocumentSimilarity(id: number, otherId: number): Promise<DocumentSimilarityResult> {
    const body = await intelligenceJson<{ data: DocumentSimilarityResult }>(`/api/documents/${id}/similarity/${otherId}`, 'Failed to compute similarity');
    return body.data;
}
export async function getDocumentDuplicates(id: number): Promise<DocumentDuplicatesResult> {
    const body = await intelligenceJson<{ data: DocumentDuplicatesResult }>(`/api/documents/${id}/duplicates`, 'Failed to detect duplicates');
    return body.data;
}
export async function compareDocumentsApi(id: number, otherId: number): Promise<DocumentComparisonResult> {
    const body = await intelligenceJson<{ data: DocumentComparisonResult }>(`/api/documents/${id}/compare/${otherId}`, 'Failed to compare documents');
    return body.data;
}
export async function getIntelligenceGaps(id: number): Promise<{ type: string; description: string }[]> {
    const body = await intelligenceJson<{ data: { items: { type: string; description: string }[] } }>(`/api/documents/${id}/gaps`, 'Failed to load intelligence gaps');
    return body.data.items;
}
export async function markDocumentReviewed(id: number) {
    return intelligenceJson(`/api/documents/${id}/reviewed`, 'Failed to mark reviewed', { method: 'POST' });
}
export async function getDocumentReviewQueue(documentId?: number): Promise<ReviewQueueItem[]> {
    const body = await intelligenceJson<{ data: { items: ReviewQueueItem[] } }>(`/api/documents/review-queue${documentId ? `?documentId=${documentId}` : ''}`, 'Failed to load review queue');
    return body.data.items;
}
export async function getDocumentIntelligenceDashboard(): Promise<DocumentIntelligenceDashboard> {
    const body = await intelligenceJson<{ data: DocumentIntelligenceDashboard }>('/api/documents/intelligence-dashboard', 'Failed to load dashboard');
    return body.data;
}
export async function createKnowledgeDraftFromDocument(documentId: number, params: { title: string; summary?: string; category?: string; confidence?: string; entityRefs?: { entityType: string; entityId: string | number }[] }) {
    return intelligenceJson<{ data: { id: number; slug: string } }>(`/api/documents/${documentId}/knowledge-draft`, 'Failed to create knowledge draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
}
export async function createThreatBriefDraftFromDocument(documentId: number, params: { title: string; reportType?: string; executiveSummary?: string; entityRefs?: { entityType: string; entityId: string | number }[] }) {
    return intelligenceJson<{ data: { id: number } }>(`/api/documents/${documentId}/threat-brief-draft`, 'Failed to create threat brief draft', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
}
// §63 "EXPORT" — authenticated blob fetch, same established pattern as
// downloadDocument above (the endpoint requires a Bearer token, never a bare <a href>).
export async function exportDocumentAnalysis(id: number, kind: 'analysis' | 'iocs.csv' | 'entities.csv' | 'relationships.csv', filenamePrefix = 'document') {
    const res = await fetchWithAuth(`${API_BASE_URL}/api/documents/${id}/export/${kind}`, {});
    if (res.status === 401 || res.status === 403) throw new Error('You do not have permission to export this document.');
    if (res.status === 404) throw new Error('Document not found.');
    if (!res.ok) throw new Error('Failed to export');
    const blob = await res.blob();
    downloadBlob(blob, `${filenamePrefix}-${id}-${kind === 'analysis' ? 'analysis.json' : kind}`);
}

// ── THREAT_SUMMARY_PHASE1.md — Operational Threat Overview, Intelligence
// Aggregation & Priority View. One aggregated GET endpoint (§50); every
// number here is a real, bounded server-side query — nothing is computed here. ──
export type ThreatSummaryWindow = '24h' | '7d' | '30d';
export interface ThreatSummaryParams {
    window?: ThreatSummaryWindow; from?: string; to?: string;
    severity?: string; risk?: string; module?: string; entityType?: string;
}
export interface ThreatMetrics {
    newAlerts: number; newIocs: number; campaignChanges: number; aptActivity: number;
    malwareActivity: number; riskChanges: number; monitoringEvents: number; newIntelligence: number;
}
export interface PriorityThreatItem {
    severity: string; entity: string; change: string; source: string; time: string;
    sourceModule: string; refType: string; refId: number | string;
}
export interface RecentIntelligenceItem {
    time: string; eventType: string; entity: string; entityType: string; entityId: string;
    module: string; severity: string | null; detail: string | null;
}
export interface AlertSummary { bySeverity: { critical: number; high: number; medium: number; low: number }; byStatus: { new: number; acknowledged: number; investigating: number; resolved: number }; total: number; }
export interface MonitoringSummary { activeMonitors: number; recentEvents: number; newChanges: number; alertGeneratingMonitors: number; }
export interface RiskSummary { combined: { Critical: number; High: number; Medium: number; Low: number }; bySource: Record<string, Record<string, number>>; }
export interface RiskChangeSummary { increased: number; decreased: number; newHighRisk: number; total: number; }
export interface AptSummary { newThreatActors: number; newCampaigns: number; newMalwareLinks: number; riskChanges: number; totalActivity: number; }
export interface MalwareSummary { newMalware: number; newSamples: number; newIocs: number; newCampaigns: number; riskChanges: number; totalActivity: number; }
export interface BrandSummary { newImpersonation: number; newDomains: number; newSocialFindings: number; mispMatches: number; campaignChanges: number; }
export interface IocSummary { newIocs: number; highRiskIocs: number; recentlyObserved: number; mispMatches: number; }
export interface CampaignSummary { newCampaigns: number; campaignGrowth: number; riskChanges: number; }
export interface VulnerabilitySummary { newVulnerabilities: number; highSeverity: number; relatedMalware: number; relatedCampaigns: number; }
export interface ThreatSummaryData {
    window: { from: string; to: string; preset: string };
    metrics: ThreatMetrics; priorityThreats: PriorityThreatItem[]; recentIntelligence: RecentIntelligenceItem[];
    categoryActivity: Record<string, number>; sourceModuleSummary: Record<string, number>;
    alertSummary: AlertSummary; monitoringSummary: MonitoringSummary; riskSummary: RiskSummary; riskChangeSummary: RiskChangeSummary;
    aptSummary: AptSummary; malwareSummary: MalwareSummary; brandSummary: BrandSummary; iocSummary: IocSummary;
    campaignSummary: CampaignSummary; vulnerabilitySummary: VulnerabilitySummary;
    dataFreshness: string | null; dataSources: string[]; sourceHealth: Record<string, string>;
    partialIntelligence: boolean; emptyState: boolean; sourcesChecked: string[];
    // THREAT_SUMMARY_PHASE2.md §43 — finer-grained Available/Limited/Not Configured status alongside Phase 1's own binary sourceHealth.
    sourceHealthDetailed?: Record<string, string>;
}
export async function getThreatSummary(params: ThreatSummaryParams = {}): Promise<ThreatSummaryData> {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: ThreatSummaryData }>(`/api/ai/threat-summary${qs.toString() ? `?${qs}` : ''}`, 'Failed to load threat summary');
    return body.data;
}
export async function searchThreatSummary(q: string): Promise<{ type: string; id: string; label: string; meta: string | null }[]> {
    const body = await intelligenceJson<{ data: { items: { type: string; id: string; label: string; meta: string | null }[] } }>(`/api/ai/threat-summary/search?q=${encodeURIComponent(q)}`, 'Failed to search');
    return body.data.items;
}
export async function getThreatSummaryEntityContext(entityType: string, entityId: string | number): Promise<{ hasEvidence: boolean; hasInvestigation: boolean; hasKnowledge: boolean; hasThreatBrief: boolean }> {
    const body = await intelligenceJson<{ data: { hasEvidence: boolean; hasInvestigation: boolean; hasKnowledge: boolean; hasThreatBrief: boolean } }>(`/api/ai/threat-summary/context/${entityType}/${entityId}`, 'Failed to load context');
    return body.data;
}

// ── THREAT_SUMMARY_PHASE2.md — Cross Source Correlation, Threat Trends,
// Activity Evolution & Entity Drill Down ───────────────────────────────────
export interface ThreatTrendPoint { current: number; previous: number; change: number; changePercent: number | null; }
export interface CorrelationCluster { key: string; label: string; confidence: string; reasons: string[]; eventCount: number; entityCount: number; sources: string[]; severityDistribution: { critical: number; high: number; medium: number; low: number }; }
export interface TopActiveEntity { entityType: string; entityId: string; label: string; eventCount: number; recentHighSeverityEvents: number; basis: string; }
export interface CorroborationItem { entityType: string; entityId: string; label: string; sourceCount: number; sources: string[]; note: string; }
export interface ConflictItem { id: number; conflictType: string; object: string; claimA: string; claimB: string; status: string; sourceCount: number; }
export interface ThreatCorrelationsData {
    window: { from: string; to: string; windowMinutes: number }; totalEvents: number; correlatedEvents: number;
    clusters: CorrelationCluster[]; sharedContext: { iocs: { type: string; id: string; label: string }[]; campaigns: { type: string; id: string; label: string }[] };
    modules: string[]; sourceDiversity: { moduleCount: number; eventTypeCount: number };
    topActiveEntities: TopActiveEntity[]; corroboration: CorroborationItem[]; conflicts: ConflictItem[];
}
export interface ThreatTrendsData {
    window: { from: string; to: string }; previousWindow: { from: string; to: string };
    categoryTrends: Record<string, ThreatTrendPoint>;
    severityTrend: { Critical: ThreatTrendPoint; High: ThreatTrendPoint; Medium: ThreatTrendPoint; Low: ThreatTrendPoint };
    riskTrend: { increased: ThreatTrendPoint; decreased: ThreatTrendPoint; newHighRisk: ThreatTrendPoint; newCriticalRisk: ThreatTrendPoint };
    alertTrendDetail: { newAlerts: ThreatTrendPoint; criticalAlerts: ThreatTrendPoint; highAlerts: ThreatTrendPoint; resolvedAlerts: ThreatTrendPoint };
    monitoringTrendDetail: { monitorEvents: ThreatTrendPoint; highPriorityEvents: ThreatTrendPoint };
    iocTrendDetail: { newIocs: ThreatTrendPoint; mispMatches: ThreatTrendPoint };
    velocity: { current: number; baseline: number | null; velocity: number | null; label: string; insufficientHistory: boolean };
    burst: { detected: boolean; insufficientHistory: boolean; label: string | null; currentPerHour?: number; baselinePerHour?: number; increase?: number; note?: string };
    note: string;
}
export interface EntityActivityData {
    entityType: string; entityId: string; deepLinkView: string | null;
    activity: ThreatTrendPoint; crossModuleActivity: Record<string, number>;
    relatedEntities: { id: number; direction: string; relationship_type: string; confidence: string | null; source: string; entity: { type: string; id: string; label: string } }[];
    relatedCounts: Record<string, number>;
    recentEvents: { eventId: string; time: string; type: string; module: string; severity: string | null }[];
    hasEvidence: boolean; hasInvestigation: boolean; hasKnowledge: boolean; hasThreatBrief: boolean;
}
export interface ActivitySequenceData { label: string; window: { from: string; to: string }; events: { eventId: string; time: string; type: string; entity: string | null; module: string; severity: string | null }[]; }

export async function getThreatCorrelations(params: ThreatSummaryParams = {}): Promise<ThreatCorrelationsData> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: ThreatCorrelationsData }>(`/api/ai/threat-summary/correlations${qs.toString() ? `?${qs}` : ''}`, 'Failed to load correlations');
    return body.data;
}
export async function getThreatTrends(params: ThreatSummaryParams = {}): Promise<ThreatTrendsData> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: ThreatTrendsData }>(`/api/ai/threat-summary/trends${qs.toString() ? `?${qs}` : ''}`, 'Failed to load trends');
    return body.data;
}
export async function getThreatSummaryActivitySequence(params: ThreatSummaryParams & { entityType?: string; entityId?: string } = {}): Promise<ActivitySequenceData> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: ActivitySequenceData }>(`/api/ai/threat-summary/activity${qs.toString() ? `?${qs}` : ''}`, 'Failed to load activity');
    return body.data;
}
export async function getEntityActivity(entityType: string, entityId: string | number, params: ThreatSummaryParams = {}): Promise<EntityActivityData> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: EntityActivityData }>(`/api/ai/threat-summary/entity/${entityType}/${entityId}${qs.toString() ? `?${qs}` : ''}`, 'Failed to load entity activity');
    return body.data;
}
export async function getThreatSummaryChanges(eventId: string, params: { window?: string; limit?: number } = {}): Promise<any> {
    const qs = new URLSearchParams({ eventId, ...(params.window ? { window: params.window } : {}), ...(params.limit ? { limit: String(params.limit) } : {}) });
    const body = await intelligenceJson<{ data: any }>(`/api/ai/threat-summary/changes?${qs}`, 'Failed to load changes');
    return body.data;
}

// ── THREAT_SUMMARY_PHASE3.md — AI Threat Analyst, Executive Summary,
// Explainable Prioritization & Forecasting. §2 "AI is an analysis
// assistant, never the authority" — nothing here executes a state changing
// action; getAiRecommendations only returns an Action Preview payload
// TEMPLATE, and the caller (ThreatSummaryPage.tsx) only calls the target
// endpoint (Monitor/Timeline Draft/Notes) after explicit analyst approval.
export interface AiThreatOverview {
    executiveAssessment: string; keyDevelopments: string[]; priorityThreats: string[]; notableChanges: string[];
    supportingEvidence: string[]; conflicts: string[]; unknowns: string[]; analystRecommendations: string[];
    sources: string[]; citations: string[]; note: string;
}
export interface ExecutiveSummaryView {
    overallSituation: string; topDevelopments: string[]; priorityThreats: string[]; majorChanges: string[];
    unknowns: string[]; recommendedAttention: string[]; note?: string;
}
export interface AnalystSummaryView {
    executiveAssessment: string; keyDevelopments: string[]; priorityThreats: string[]; notableChanges: string[];
    timeline: string[]; correlations: string[]; evidence: string[]; conflicts: string[]; unknowns: string[];
    recommendations: string[]; sources: string[]; note?: string;
}
export interface AiAnalyzeResponse {
    generatedAt: string; dataWindow: { from: string; to: string; preset: string }; dataFreshness: string | null;
    aiStatus: 'Available' | 'Unavailable'; fallback: boolean;
    overview: AiThreatOverview; executiveSummary: ExecutiveSummaryView; analystSummary: AnalystSummaryView;
}
export async function getAiStatus(): Promise<{ available: boolean }> {
    const body = await intelligenceJson<{ data: { available: boolean } }>('/api/ai/threat-summary/ai-status', 'Failed to load AI status');
    return body.data;
}
export async function analyzeThreatSummary(params: ThreatSummaryParams = {}): Promise<AiAnalyzeResponse> {
    const body = await intelligenceJson<{ data: AiAnalyzeResponse }>('/api/ai/threat-summary/analyze', 'Failed to generate AI Threat Overview', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params),
    });
    return body.data;
}

export interface PriorityExplanation {
    entity: string; severity: string; change: string; whyImportant: string; sources: string[];
    recentChanges: string[]; riskContext: string; evidenceCount: number; unknowns: string[]; note: string;
}
export interface IntelligenceGap { type: string; description: string; }
export interface AiAssessmentData {
    priorityExplanations: PriorityExplanation[]; multiSourceAssessment: Record<string, number>;
    intelligenceGaps: IntelligenceGap[]; window: { from: string; to: string; preset: string };
}
export async function getThreatSummaryAssessment(params: ThreatSummaryParams = {}): Promise<AiAssessmentData> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: AiAssessmentData }>(`/api/ai/threat-summary/assessment${qs.toString() ? `?${qs}` : ''}`, 'Failed to load assessment');
    return body.data;
}

export interface ThreatForecastHorizon { label: string; direction: string; confidence: string; }
export interface ThreatForecast {
    status: 'ok' | 'insufficient_data'; direction: string; confidence: string; horizons: ThreatForecastHorizon[];
    basis: string; language: string; note?: string;
}
export async function getThreatSummaryForecast(params: ThreatSummaryParams = {}): Promise<ThreatForecast> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: ThreatForecast }>(`/api/ai/threat-summary/forecast${qs.toString() ? `?${qs}` : ''}`, 'Failed to load forecast');
    return body.data;
}

// §20/§67 ACTION PREVIEW — `actionPreview` is a TEMPLATE only (endpoint +
// method + a suggested payload); the frontend calls that endpoint directly
// ONLY after the analyst clicks Approve, never automatically.
export interface AiActionPreview { method: 'POST'; endpoint: string; permission: string | null; payload: Record<string, any>; }
export interface AiRecommendation {
    id: string; type: string; label: string; reason: string; source: string[]; priority: 'High' | 'Medium' | 'Low';
    stateChanging: boolean; actionPreview: AiActionPreview | null;
}
export async function getThreatSummaryRecommendations(params: ThreatSummaryParams = {}): Promise<AiRecommendation[]> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: { recommendations: AiRecommendation[] } }>(`/api/ai/threat-summary/recommendations${qs.toString() ? `?${qs}` : ''}`, 'Failed to load recommendations');
    return body.data.recommendations;
}
// Generic "call the endpoint an approved recommendation points at" helper —
// this is the ONLY place a recommendation's action ever actually executes,
// and only because the analyst explicitly clicked Approve. The target API
// (Monitor/Timeline Draft/Notes) re-checks RBAC itself at this moment.
// §22 "RBAC FOR ACTIONS" — a 403 here must surface as "Permission Required",
// distinct from an expired session, so this calls fetchWithAuth directly
// rather than intelligenceJson (which collapses 401/403 into one generic
// "please login" message and would hide a genuine permission denial).
export async function approveAiRecommendation(preview: AiActionPreview): Promise<any> {
    const res = await fetchWithAuth(`${API_BASE_URL}${preview.endpoint}`, {
        method: preview.method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(preview.payload),
        // A 403 here means "you lack this specific permission" (§22), not an
        // expired session — suppress the generic app-wide re-auth toast so
        // the accurate "Permission Required" message (shown in the Action
        // Preview modal) isn't overshadowed by a misleading one.
        suppressAuthRedirect: true,
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err: any = new Error((body as any)?.message || 'Failed to complete the approved action');
        err.status = res.status;
        throw err;
    }
    return (body as any).data;
}

export interface EntityAiSummaryView {
    currentState: string; recentChanges: string[]; relatedEntities: string[]; risk: string;
    evidence: string[]; conflicts: string[]; recommendations: string[]; note: string;
}
export async function getEntityAiSummary(entityType: string, entityId: string | number, params: ThreatSummaryParams = {}): Promise<{ generatedAt: string; aiStatus: string; summary: EntityAiSummaryView }> {
    const qs = new URLSearchParams(); for (const [k, v] of Object.entries(params)) if (v) qs.set(k, String(v));
    const body = await intelligenceJson<{ data: { generatedAt: string; aiStatus: string; summary: EntityAiSummaryView } }>(`/api/ai/threat-summary/entity/${entityType}/${entityId}/ai-summary${qs.toString() ? `?${qs}` : ''}`, 'Failed to load entity AI summary');
    return body.data;
}

export interface CaseAiSummaryView {
    summary: string; majorEvents: string[]; evidence: string[]; findings: string[]; hypotheses: string[];
    openGaps: string[]; recentChanges: string[]; note: string;
}
export async function getCaseAiSummary(caseId: string | number): Promise<{ generatedAt: string; aiStatus: string; summary: CaseAiSummaryView }> {
    const body = await intelligenceJson<{ data: { generatedAt: string; aiStatus: string; summary: CaseAiSummaryView } }>(`/api/ai/threat-summary/case/${caseId}/ai-summary`, 'Failed to load case AI summary');
    return body.data;
}

// ============================================================================
// SHADOWSERVER_INTEGRATION_PLAN.md Phase 1 — /api/clients (core platform
// tenant primitive, plan §5) and /api/shadowserver (the module itself).
// ============================================================================

export interface PlatformClient {
    id: number;
    name: string;
    slug: string;
    status: 'active' | 'inactive';
    createdAt: string | null;
}

export async function getClients(): Promise<PlatformClient[]> {
    const body = await intelligenceJson<{ data: PlatformClient[] }>('/api/clients', 'Failed to load clients');
    return body.data;
}
export async function createPlatformClient(input: { name: string; slug?: string }): Promise<PlatformClient> {
    const body = await intelligenceJson<{ data: PlatformClient }>('/api/clients', 'Failed to create client', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return body.data;
}
export async function getClient(id: number | string): Promise<PlatformClient> {
    const body = await intelligenceJson<{ data: PlatformClient }>(`/api/clients/${id}`, 'Failed to load client');
    return body.data;
}
export async function updatePlatformClient(id: number | string, input: { name?: string; status?: 'active' | 'inactive' }): Promise<PlatformClient> {
    const body = await intelligenceJson<{ data: PlatformClient }>(`/api/clients/${id}`, 'Failed to update client', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return body.data;
}

export interface ClientMember { id: number; username: string; email: string | null; }
export async function getClientMembers(clientId: number | string): Promise<ClientMember[]> {
    const body = await intelligenceJson<{ data: ClientMember[] }>(`/api/clients/${clientId}/members`, 'Failed to load members');
    return body.data;
}
export async function addClientMember(clientId: number | string, userId: number | string): Promise<{ userId: number; clientId: number }> {
    const body = await intelligenceJson<{ data: { userId: number; clientId: number } }>(`/api/clients/${clientId}/members`, 'Failed to add member', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userId }) });
    return body.data;
}
export async function removeClientMember(clientId: number | string, userId: number | string): Promise<{ removed: boolean }> {
    const body = await intelligenceJson<{ data: { removed: boolean } }>(`/api/clients/${clientId}/members/${userId}`, 'Failed to remove member', { method: 'DELETE' });
    return body.data;
}
// Plan §8 Phase 4 "Onboarding" — creates a brand-new user with the
// is_client_scoped role and adds them to this client in one action.
export async function createClientContact(clientId: number | string, input: { username: string; email: string; password: string; firstName?: string; lastName?: string }): Promise<{ id: number; username: string; email: string; clientId: number }> {
    const body = await intelligenceJson<{ data: { id: number; username: string; email: string; clientId: number } }>(`/api/clients/${clientId}/contacts`, 'Failed to create client contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return body.data;
}

export async function startViewAsClient(clientId: number | string): Promise<{ viewingAs: PlatformClient; auditId: number }> {
    const body = await intelligenceJson<{ data: { viewingAs: PlatformClient; auditId: number } }>('/api/clients/view-as', 'Failed to start view-as', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId }) });
    return body.data;
}
export async function endViewAsClient(): Promise<{ viewingAs: null }> {
    const body = await intelligenceJson<{ data: { viewingAs: null } }>('/api/clients/view-as/end', 'Failed to end view-as', { method: 'POST' });
    return body.data;
}
export async function getViewAsStatus(): Promise<{ viewingAs: PlatformClient | null }> {
    const body = await intelligenceJson<{ data: { viewingAs: PlatformClient | null } }>('/api/clients/view-as/status', 'Failed to load view-as status');
    return body.data;
}
export interface ViewAsAuditEntry {
    id: number; adminUserId: number; adminUsername: string; clientId: number; clientName: string;
    startedAt: string | null; endedAt: string | null;
}
export async function getViewAsAudit(params: { page?: number; pageSize?: number } = {}): Promise<{ items: ViewAsAuditEntry[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const body = await intelligenceJson<{ data: { items: ViewAsAuditEntry[]; total: number; page: number; pageSize: number } }>(`/api/clients/view-as/audit?${qs}`, 'Failed to load audit log');
    return body.data;
}
export async function getMyClients(): Promise<PlatformClient[]> {
    const body = await intelligenceJson<{ data: PlatformClient[] }>('/api/users/me/clients', 'Failed to load your clients');
    return body.data;
}

export interface ShadowserverCredentialMeta {
    id: number; clientId: number; label: string | null; status: 'active' | 'revoked';
    createdByUserId: number; createdAt: string | null;
}
export async function createShadowserverCredential(clientId: number | string, input: { apiKey: string; apiSecret: string; label?: string }): Promise<ShadowserverCredentialMeta> {
    const body = await intelligenceJson<{ data: ShadowserverCredentialMeta }>(`/api/shadowserver/clients/${clientId}/credentials`, 'Failed to save credential', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return body.data;
}
export async function getShadowserverCredentials(clientId: number | string): Promise<ShadowserverCredentialMeta[]> {
    const body = await intelligenceJson<{ data: ShadowserverCredentialMeta[] }>(`/api/shadowserver/clients/${clientId}/credentials`, 'Failed to load credentials');
    return body.data;
}
export async function revokeShadowserverCredential(id: number | string): Promise<{ revoked: boolean }> {
    const body = await intelligenceJson<{ data: { revoked: boolean } }>(`/api/shadowserver/credentials/${id}`, 'Failed to revoke credential', { method: 'DELETE' });
    return body.data;
}

// filtersApiStatus/filtersApiError are only ever present on the response of
// createShadowserverRange/removeShadowserverRange (plan §8 Phase 3's
// best-effort Filters API sync) — never stored, so absent from
// getShadowserverRanges' plain list.
export interface ShadowserverRange {
    id: number; clientId: number; cidr: string; label: string | null; active: boolean;
    confirmedReal: boolean; confirmedByUserId: number | null; confirmedAt: string | null;
    addedByUserId: number; createdAt: string | null;
    filtersApiStatus?: 'not_configured' | 'ok' | 'unavailable';
    filtersApiError?: string | null;
}
export async function createShadowserverRange(clientId: number | string, input: { cidr: string; label?: string }): Promise<ShadowserverRange> {
    const body = await intelligenceJson<{ data: ShadowserverRange }>(`/api/shadowserver/clients/${clientId}/ranges`, 'Failed to add range', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) });
    return body.data;
}
export async function getShadowserverRanges(clientId?: number | string): Promise<ShadowserverRange[]> {
    const qs = clientId ? `?clientId=${clientId}` : '';
    const body = await intelligenceJson<{ data: ShadowserverRange[] }>(`/api/shadowserver/ranges${qs}`, 'Failed to load ranges');
    return body.data;
}
// Plan §5/§11 Q04 — admin-only, one explicit action; there is deliberately
// no bulk-confirm function here.
export async function confirmShadowserverRangeReal(rangeId: number | string): Promise<ShadowserverRange> {
    const body = await intelligenceJson<{ data: ShadowserverRange }>(`/api/shadowserver/ranges/${rangeId}/confirm-real`, 'Failed to confirm range', { method: 'POST' });
    return body.data;
}
// Plan §8 Phase 3 — SOFT removal only (active:false, findings kept); best-
// effort Filters API unregistration is attempted first, its outcome
// reported in filtersApiStatus regardless of whether it succeeded.
export async function removeShadowserverRange(rangeId: number | string): Promise<ShadowserverRange> {
    const body = await intelligenceJson<{ data: ShadowserverRange }>(`/api/shadowserver/ranges/${rangeId}/remove`, 'Failed to remove range', { method: 'POST' });
    return body.data;
}

export interface ShadowserverReadiness { ready: boolean; hasActiveCredential: boolean; hasConfirmedRange: boolean; reason: string | null; }
export async function getShadowserverReadiness(clientId: number | string): Promise<ShadowserverReadiness> {
    const body = await intelligenceJson<{ data: ShadowserverReadiness }>(`/api/shadowserver/clients/${clientId}/readiness`, 'Failed to load readiness');
    return body.data;
}

export interface ShadowserverSyncResult {
    status: 'not_configured' | 'ok' | 'unavailable';
    ranges: { cidr: string; label: string | null }[];
    addedCidrs?: string[];
    errorMessage: string | null;
}
// Plan §5 "Sync from Shadowserver" — populates range CANDIDATES only; never
// auto-confirms. confirmShadowserverRangeReal() above is still required.
export async function syncShadowserverClient(clientId: number | string): Promise<ShadowserverSyncResult> {
    const body = await intelligenceJson<{ data: ShadowserverSyncResult }>(`/api/shadowserver/clients/${clientId}/sync`, 'Failed to sync from Shadowserver', { method: 'POST' });
    return body.data;
}

export interface ShadowserverFinding {
    id: number; clientId: number; rangeId: number; reportType: string; fingerprint: string;
    category: 'indicator' | 'exposure'; ip: string | null; port: number | null; protocol: string | null;
    hostname: string | null; asn: number | null; country: string | null; tag: string | null;
    severity: 'critical' | 'high' | 'medium' | 'low' | 'info'; status: 'active' | 'dormant' | 'resolved';
    rawRow: unknown; firstSeenAt: string | null; lastSeenAt: string | null;
    resolvedByUserId: number | null; resolvedAt: string | null;
}
export async function getShadowserverFindings(params: {
    clientId?: number | string; rangeId?: number | string; reportType?: string;
    category?: string; status?: string; page?: number; pageSize?: number;
} = {}): Promise<{ items: ShadowserverFinding[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ShadowserverFinding[]; total: number; page: number; pageSize: number } }>(`/api/shadowserver/findings?${qs}`, 'Failed to load findings');
    return body.data;
}
export async function resolveShadowserverFinding(id: number | string): Promise<{ resolved: boolean }> {
    const body = await intelligenceJson<{ data: { resolved: boolean } }>(`/api/shadowserver/findings/${id}/resolve`, 'Failed to resolve finding', { method: 'POST' });
    return body.data;
}

// SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — IOC, as a
// narrow corroboration enrichment bolted onto findings the caller can
// already see — never a new "IOC" concept, never source labels or other
// clients' identities (see database/shadowserverStorage.js's
// getIocCorroborationForFindings() header). Keyed by finding id; a finding
// missing from the result never became a real IOC (exposure-category) or
// has no corroboration data yet — never fabricated as zero/absent.
export interface IocCorroboration {
    risk: string | null; confidence: string | null; threatCategory: string | null;
    otherSourceCount: number; corroboratedByOtherSources: boolean;
}
export async function getIocCorroboration(findingIds: (number | string)[]): Promise<Record<number, IocCorroboration>> {
    if (!findingIds.length) return {};
    const body = await intelligenceJson<{ data: Record<number, IocCorroboration> }>('/api/shadowserver/findings/corroboration', 'Failed to load corroboration data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findingIds }) });
    return body.data;
}

// SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — MITRE,
// the same narrow-enrichment shape as IOC corroboration above — never a
// client-scoped MITRE Mapper surface (see database/shadowserverStorage.js's
// getMitreMappingsForFindings() header). Applies to both indicator- and
// exposure-category findings (technique tagging keys on report type, not
// category); a finding missing from the result has no technique mapping
// (or only a rejected one) — never fabricated.
export interface MitreFindingMapping {
    techniqueId: string; techniqueName: string; tactics: string[];
    confidence: string | null; confirmed: boolean;
}
export async function getMitreMappingsForFindings(findingIds: (number | string)[]): Promise<Record<number, MitreFindingMapping>> {
    if (!findingIds.length) return {};
    const body = await intelligenceJson<{ data: Record<number, MitreFindingMapping> }>('/api/shadowserver/findings/mitre-techniques', 'Failed to load technique data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ findingIds }) });
    return body.data;
}

// Plan §8 Phase 3 "trend/dashboard view" — new findings per day (by real
// discovery date, split indicator/exposure) and resolved per day. Never an
// "active over time" series — this schema has no snapshot history to
// answer that honestly (see database/shadowserverStorage.js's own comment).
export interface ShadowserverTrendPoint { date: string; count: number; }
export interface ShadowserverTrend {
    windowDays: number;
    newIndicator: ShadowserverTrendPoint[];
    newExposure: ShadowserverTrendPoint[];
    resolved: ShadowserverTrendPoint[];
}
export async function getShadowserverTrend(clientId: number | string, days: number = 30): Promise<ShadowserverTrend> {
    const body = await intelligenceJson<{ data: ShadowserverTrend }>(`/api/shadowserver/clients/${clientId}/trend?days=${days}`, 'Failed to load trend');
    return body.data;
}

// ============================================================================
// MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 0/1 — the generic
// service-entitlement layer. `services` is metadata only (plan §7, no
// secrets); the entitlement functions below are the Administration ->
// Clients -> Client X -> Service Entitlements surface (plan §12/§14) —
// admin-only to mutate, readable by a client for its own client.
// ============================================================================

export interface PlatformService {
    serviceKey: string; displayName: string; category: string;
    credentialModel: 'per_client' | 'global' | 'none'; status: 'active' | 'beta' | 'deprecated';
}
export async function getServices(): Promise<PlatformService[]> {
    const body = await intelligenceJson<{ data: PlatformService[] }>('/api/services', 'Failed to load services');
    return body.data;
}

export interface ClientServiceEntitlement extends PlatformService {
    serviceStatus: 'active' | 'beta' | 'deprecated';
    entitlementStatus: 'enabled' | 'disabled';
    enabledAt: string | null; disabledAt: string | null;
}
export async function getClientServiceEntitlements(clientId: number | string): Promise<ClientServiceEntitlement[]> {
    const body = await intelligenceJson<{ data: ClientServiceEntitlement[] }>(`/api/clients/${clientId}/service-entitlements`, 'Failed to load service entitlements');
    return body.data;
}
// Plan §15 — always an explicit administrative action, never inferred from
// credential existence.
export async function setClientServiceEntitlement(clientId: number | string, serviceKey: string, status: 'enabled' | 'disabled'): Promise<{ clientId: number; serviceKey: string; status: string; previousStatus: string | null }> {
    const body = await intelligenceJson<{ data: { clientId: number; serviceKey: string; status: string; previousStatus: string | null } }>(
        `/api/clients/${clientId}/service-entitlements/${serviceKey}`, 'Failed to update service entitlement',
        { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) }
    );
    return body.data;
}
export interface ServiceEntitlementAuditEntry {
    id: number; serviceKey: string; actorUserId: number; actorUsername: string | null;
    previousStatus: string | null; newStatus: string; createdAt: string | null;
}
export async function getServiceEntitlementAudit(clientId: number | string, params: { page?: number; pageSize?: number } = {}): Promise<{ items: ServiceEntitlementAuditEntry[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    if (params.page) qs.set('page', String(params.page));
    if (params.pageSize) qs.set('pageSize', String(params.pageSize));
    const body = await intelligenceJson<{ data: { items: ServiceEntitlementAuditEntry[]; total: number; page: number; pageSize: number } }>(`/api/clients/${clientId}/service-entitlements/audit?${qs}`, 'Failed to load entitlement audit log');
    return body.data;
}

// SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — Cases is
// the platform-wide client-scoping primitive's second consumer. Deliberately
// a minimal, list-only shape (no notes/findings/hypotheses) — see
// database/investigationStorage.js's getCasesForClient() header for why.
export interface ClientCaseSummary {
    id: number; case_number: string; title: string; summary: string | null;
    status: string; severity: string; priority: string; type: string;
    client_id: number | null; created_at: string | null; updated_at: string | null; closed_at: string | null;
}
export async function getCasesForClient(clientId: number | string, params: { status?: string; page?: number; pageSize?: number } = {}): Promise<{ items: ClientCaseSummary[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '') qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ClientCaseSummary[]; total: number; page: number; pageSize: number } }>(`/api/clients/${clientId}/cases?${qs}`, 'Failed to load cases');
    return body.data;
}

// SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — Evidence,
// via case inheritance (no new column anywhere — see
// database/investigationStorage.js's getCaseEvidenceForClient() header).
// Only ever "evidence linked to THIS client's case" — never a cross-case
// or cross-entity browse, which stays the admin/analyst-only Evidence
// Repository.
export interface ClientCaseEvidence {
    id: number; source: string; url: string | null; description: string | null;
    confidence: string | null; created_at: string | null;
}
export async function getCaseEvidenceForClient(clientId: number | string, caseId: number | string): Promise<ClientCaseEvidence[]> {
    const body = await intelligenceJson<{ data: ClientCaseEvidence[] }>(`/api/clients/${clientId}/cases/${caseId}/evidence`, 'Failed to load evidence');
    return body.data;
}

// SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — Reports,
// via case inheritance (report_generator_reports.case_id -> cases.client_id;
// no new column — see database/reportGeneratorStorage.js's
// getReportsForClient()/getReportForClient() header). PUBLISHED-only.
export interface ClientReportSummary {
    id: number; title: string; reportType: string; classification: string;
    publishedAt: string | null; caseId: number; caseNumber: string;
}
export async function getReportsForClient(clientId: number | string, params: { page?: number; pageSize?: number } = {}): Promise<{ items: ClientReportSummary[]; total: number; page: number; pageSize: number }> {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined) qs.set(k, String(v)); });
    const body = await intelligenceJson<{ data: { items: ClientReportSummary[]; total: number; page: number; pageSize: number } }>(`/api/clients/${clientId}/reports?${qs}`, 'Failed to load reports');
    return body.data;
}
export interface ClientReportDetail {
    id: number; title: string; reportType: string; classification: string; publishedAt: string | null; caseId: number;
    narrative: { introduction: string; executiveSummary: string; keyFindingsNarrative: string; recommendations: string; conclusion: string };
}
export async function getReportForClient(clientId: number | string, reportId: number | string): Promise<ClientReportDetail> {
    const body = await intelligenceJson<{ data: ClientReportDetail }>(`/api/clients/${clientId}/reports/${reportId}`, 'Failed to load report');
    return body.data;
}
