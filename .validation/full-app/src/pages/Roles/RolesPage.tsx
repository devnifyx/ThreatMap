import { useEffect, useMemo, useState, type FormEvent } from 'react';
import './RolesPage.css';
import { getAllUsers, getRoles, getPermissions, createRole, updateRole, deleteRole } from '../../services/api';
import Logo from '../../picture/Logo.png';

interface RoleEntry {
    id: number;
    name: string;
    description: string | null;
    isSystemRole: boolean;
    permissions: string[];
    userCount: number;
}

interface PermissionEntry {
    permissionKey: string;
    description: string;
    category: string;
}

interface UserEntry {
    id: number;
    username: string;
    email: string;
    role_id: number | null;
    first_name: string | null;
    last_name: string | null;
}

// "API_KEYS.MANAGE_OTHERS" → "Api Keys Manage Others"
// Splits on underscores and dots so the raw backend key reads as a
// plain label without adding a separate display-name field to the API.
function formatPermissionKey(key: string): string {
    return key
        .split(/[._]/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}

interface RolesPageProps {
    onBack: () => void;
}

export default function RolesPage({ onBack }: RolesPageProps) {
    const [roles, setRoles] = useState<RoleEntry[]>([]);
    const [permissions, setPermissions] = useState<PermissionEntry[]>([]);
    const [users, setUsers] = useState<UserEntry[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showForm, setShowForm] = useState(false);
    const [editingRole, setEditingRole] = useState<RoleEntry | null>(null);
    const [detailRole, setDetailRole] = useState<RoleEntry | null>(null);
    const [formName, setFormName] = useState('');
    const [formDescription, setFormDescription] = useState('');
    const [formKeys, setFormKeys] = useState<Set<string>>(new Set());
    const [formError, setFormError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [rowError, setRowError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const permissionsByCategory = useMemo(() => {
        const map = new Map<string, PermissionEntry[]>();
        for (const p of permissions) {
            if (!map.has(p.category)) map.set(p.category, []);
            map.get(p.category)!.push(p);
        }
        return Array.from(map.entries());
    }, [permissions]);

    const permissionsByKey = useMemo(
        () => new Map(permissions.map((permission) => [permission.permissionKey, permission])),
        [permissions]
    );

    const detailPermissionCategories = useMemo(() => {
        if (!detailRole) return [];

        const categories = new Map<string, string[]>();
        for (const key of detailRole.permissions) {
            const category = permissionsByKey.get(key)?.category || 'Other';
            if (!categories.has(category)) categories.set(category, []);
            categories.get(category)!.push(key);
        }
        return Array.from(categories.entries());
    }, [detailRole, permissionsByKey]);

    const detailUsers = useMemo(
        () => detailRole ? users.filter((user) => user.role_id === detailRole.id) : [],
        [detailRole, users]
    );

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const [rolesRes, permsRes, usersRes] = await Promise.all([getRoles(), getPermissions(), getAllUsers()]);
            if (rolesRes.status === 'success') setRoles(rolesRes.roles || []);
            if (permsRes.status === 'success') setPermissions(permsRes.permissions || []);
            if (usersRes.status === 'success') setUsers(usersRes.users || []);
        } catch (e: any) {
            setError(e?.message || 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openCreate = () => {
        setEditingRole(null);
        setFormName('');
        setFormDescription('');
        setFormKeys(new Set());
        setFormError(null);
        setShowForm(true);
    };

    const openEdit = (role: RoleEntry) => {
        setEditingRole(role);
        setFormName(role.name);
        setFormDescription(role.description || '');
        setFormKeys(new Set(role.permissions));
        setFormError(null);
        setShowForm(true);
    };

    const openDetail = (role: RoleEntry) => {
        setDetailRole(role);
    };

    const closeForm = () => setShowForm(false);

    const fullName = (user: UserEntry) =>
        `${user.first_name || ''} ${user.last_name || ''}`.trim();

    const toggleKey = (key: string) => {
        setFormKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!formName.trim()) {
            setFormError('Role name is required');
            return;
        }
        setSaving(true);
        setFormError(null);
        try {
            const permissionKeys = Array.from(formKeys);
            if (editingRole) {
                await updateRole(editingRole.id, { name: formName.trim(), description: formDescription, permissionKeys });
            } else {
                await createRole({ name: formName.trim(), description: formDescription, permissionKeys });
            }
            setShowForm(false);
            await load();
        } catch (e: any) {
            setFormError(e?.message || 'Failed to save role');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (role: RoleEntry) => {
        setDeletingId(role.id);
        setRowError(null);
        try {
            await deleteRole(role.id);
            await load();
        } catch (e: any) {
            setRowError(e?.message || 'Failed to delete role');
        } finally {
            setDeletingId(null);
        }
    };

    return (
        <div className="roles-page">
            <header className="roles-header">
                <div className="brand">
                    <div className="logo-icon">
                        <img src={Logo} alt="BaeSpy" />
                    </div>
                    <div className="roles-header-text">
                        <h1>Roles</h1>
                        <p>Manage roles and their permissions</p>
                    </div>
                </div>
                <button className="roles-back" onClick={onBack} type="button">
                    ← Back
                </button>
            </header>

            {error && <div className="roles-error">{error}</div>}
            {rowError && <div className="roles-error">{rowError}</div>}

            <section className="roles-content">
                <div className="roles-toolbar">
                    <button type="button" className="roles-create-btn" onClick={openCreate}>
                        + Create Role
                    </button>
                </div>

                {loading ? (
                    <div className="roles-loading">Loading roles…</div>
                ) : (
                    <div className="roles-list">
                        {roles.map((role) => (
                            <div key={role.id} className="role-card">
                                <div className="role-card-header">
                                    <div className="role-card-title">
                                        <h2>{role.name}</h2>
                                        {role.isSystemRole && <span className="role-system-badge">System</span>}
                                        <span className="role-user-count">{role.userCount} user{role.userCount === 1 ? '' : 's'}</span>
                                    </div>
                                    <div className="role-card-actions">
                                        <button type="button" onClick={() => openDetail(role)}>Detail</button>
                                        <button type="button" onClick={() => openEdit(role)}>Edit</button>
                                        {!role.isSystemRole && (
                                            <button
                                                type="button"
                                                className="role-delete-btn"
                                                disabled={deletingId === role.id}
                                                onClick={() => handleDelete(role)}
                                            >
                                                {deletingId === role.id ? 'Deleting…' : 'Delete'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                                {role.description && <p className="role-card-description">{role.description}</p>}
                                <div className="role-card-permissions">
                                    {role.permissions.length === 0 ? (
                                        <span className="role-permission-empty">No permissions</span>
                                    ) : (
                                        role.permissions.map((key) => (
                                            <span key={key} className="role-permission-badge">{key}</span>
                                        ))
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {showForm && (
                <div className="roles-modal-overlay" onClick={closeForm}>
                    <div className="roles-modal" data-lenis-prevent onClick={(e) => e.stopPropagation()}>
                        <div className="roles-modal-header">
                            <h2>{editingRole ? 'Edit Role' : 'Create Role'}</h2>
                            <button type="button" className="roles-modal-close" onClick={closeForm}>×</button>
                        </div>
                        <form className="roles-modal-body" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Name</label>
                                <input
                                    type="text"
                                    value={formName}
                                    onChange={(e) => setFormName(e.target.value)}
                                    placeholder="e.g. History Viewer"
                                    disabled={editingRole?.isSystemRole}
                                    autoFocus={!editingRole?.isSystemRole}
                                />
                                {editingRole?.isSystemRole && (
                                    <span className="roles-field-hint">System role names are managed by the server and cannot be changed.</span>
                                )}
                            </div>
                            <div className="form-group">
                                <label>Description</label>
                                <textarea
                                    value={formDescription}
                                    onChange={(e) => setFormDescription(e.target.value)}
                                    placeholder="What this role is for"
                                    rows={2}
                                />
                            </div>
                            <div className="form-group">
                                <label>Permissions</label>
                                <div className="roles-permission-groups">
                                    {permissionsByCategory.map(([category, perms]) => (
                                        <div key={category} className="roles-permission-group">
                                            <h3>{category}</h3>
                                            {perms.map((p) => (
                                                <label key={p.permissionKey} className="roles-permission-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={formKeys.has(p.permissionKey)}
                                                        onChange={() => toggleKey(p.permissionKey)}
                                                    />
                                                    <span>
                                                        <strong>{formatPermissionKey(p.permissionKey)}</strong>
                                                        <em>{p.description}</em>
                                                    </span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            {formError && <div className="roles-error">{formError}</div>}
                            <div className="roles-modal-actions">
                                <button type="button" onClick={closeForm}>Cancel</button>
                                <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {detailRole && (
                <div className="roles-modal-overlay" onClick={() => setDetailRole(null)}>
                    <section
                        className="roles-modal roles-detail-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="role-detail-modal-title"
                        data-lenis-prevent
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="roles-modal-header">
                            <h2 id="role-detail-modal-title">Role Details</h2>
                            <button
                                type="button"
                                className="roles-modal-close"
                                onClick={() => setDetailRole(null)}
                                aria-label="Close role details"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="roles-detail-body">
                            <div className="roles-detail-summary">
                                <div className="roles-detail-item">
                                    <span>Role Name</span>
                                    <strong>{detailRole.name}</strong>
                                </div>
                                <div className="roles-detail-item">
                                    <span>Role Type</span>
                                    <strong className={detailRole.isSystemRole ? 'roles-detail-type roles-detail-type--system' : 'roles-detail-type'}>
                                        {detailRole.isSystemRole ? 'System' : 'Custom'}
                                    </strong>
                                </div>
                                <div className="roles-detail-item">
                                    <span>Assigned Users</span>
                                    <strong>{detailRole.userCount}</strong>
                                </div>
                                <div className="roles-detail-item roles-detail-item--wide">
                                    <span>Description</span>
                                    <strong>{detailRole.description || 'No description provided.'}</strong>
                                </div>
                            </div>

                            <div className="roles-detail-section">
                                <h3>Permissions</h3>
                                {detailPermissionCategories.length === 0 ? (
                                    <p className="role-permission-empty">No permissions</p>
                                ) : (
                                    <div className="roles-detail-permission-groups">
                                        {detailPermissionCategories.map(([category, keys]) => (
                                            <div key={category} className="roles-detail-permission-group">
                                                <h4>{category}</h4>
                                                <div className="role-card-permissions">
                                                    {keys.map((key) => (
                                                        <span key={key} className="role-permission-badge">{key}</span>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="roles-detail-section">
                                <h3>Assigned Users</h3>
                                {detailUsers.length === 0 ? (
                                    <p className="role-permission-empty">No users are assigned to this role.</p>
                                ) : (
                                    <ul className="roles-detail-users">
                                        {detailUsers.map((user) => (
                                            <li key={user.id}>
                                                <strong>{user.username}</strong>
                                                <span>{fullName(user) || user.email}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                        <div className="roles-modal-actions roles-detail-actions">
                            <button type="button" onClick={() => setDetailRole(null)}>Close</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
