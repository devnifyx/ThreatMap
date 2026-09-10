import { useEffect, useState } from 'react';
import './UserManagementPage.css';
import { getAllUsers, createUser, updateUser, deleteUser, getRoles } from '../../services/api';
import Logo from '../../picture/Logo.png';
import PasswordInput from '../../components/PasswordInput';

interface User {
    id: number;
    username: string;
    email: string;
    role: string;
    role_id: number | null;
    is_active: boolean;
    created_at: string;
    first_name: string | null;
    last_name: string | null;
    last_login?: string | null;
}

interface RoleOption {
    id: number;
    name: string;
    isSystemRole: boolean;
}

interface UserManagementPageProps {
    onBack: () => void;
}

export default function UserManagementPage({ onBack }: UserManagementPageProps) {
    const [users, setUsers] = useState<User[]>([]);
    const [roles, setRoles] = useState<RoleOption[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [detailUser, setDetailUser] = useState<User | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        roleId: null as number | null,
        is_active: true,
        password: '',
        firstName: '',
        lastName: ''
    });

    const loadUsers = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAllUsers();
            if (res.status === 'success') {
                setUsers(res.users);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const loadRoles = async () => {
        try {
            const res = await getRoles();
            if (res.status === 'success') {
                const options: RoleOption[] = (res.roles || []).map((r: any) => ({ id: r.id, name: r.name, isSystemRole: r.isSystemRole }));
                setRoles(options);
                setFormData((prev) => (prev.roleId == null ? { ...prev, roleId: options.find((r) => r.name === 'analyst')?.id ?? options[0]?.id ?? null } : prev));
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load roles');
        }
    };

    useEffect(() => {
        loadUsers();
        loadRoles();
    }, []);

    const handleOpenCreate = () => {
        setEditingUser(null);
        setFormData({
            username: '',
            email: '',
            roleId: roles.find((r) => r.name === 'analyst')?.id ?? roles[0]?.id ?? null,
            is_active: true,
            password: '',
            firstName: '',
            lastName: ''
        });
        setShowModal(true);
    };

    const handleOpenEdit = (user: User) => {
        setEditingUser(user);
        setFormData({
            username: user.username,
            email: user.email,
            roleId: user.role_id ?? roles.find((r) => r.name === user.role)?.id ?? null,
            is_active: user.is_active,
            password: '',
            firstName: user.first_name || '',
            lastName: user.last_name || ''
        });
        setShowModal(true);
    };

    const handleOpenDetail = (user: User) => {
        setDetailUser(user);
    };

    const formatDate = (value: string | null | undefined, includeTime = false) => {
        if (!value) return '—';

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return '—';

        return includeTime ? date.toLocaleString() : date.toLocaleDateString();
    };

    const getFullName = (user: User) =>
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || '—';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        try {
            if (editingUser) {
                await updateUser(editingUser.id, {
                    username: formData.username,
                    email: formData.email,
                    ...(formData.roleId != null ? { roleId: formData.roleId } : {}),
                    isActive: formData.is_active,
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    ...(formData.password ? { password: formData.password } : {})
                });
            } else {
                const selectedRole = roles.find((r) => r.id === formData.roleId);
                await createUser({
                    username: formData.username,
                    email: formData.email,
                    role: selectedRole?.name === 'admin' ? 'admin' : 'analyst',
                    ...(formData.roleId != null ? { roleId: formData.roleId } : {}),
                    password: formData.password,
                    firstName: formData.firstName,
                    lastName: formData.lastName
                });
            }
            setShowModal(false);
            loadUsers();
        } catch (e: any) {
            setError(e?.message || 'Failed to save user');
        }
    };

    const handleDelete = async (user: User) => {
        if (!confirm(`Are you sure you want to delete user "${user.username}"?`)) return;
        try {
            await deleteUser(user.id);
            loadUsers();
        } catch (e: any) {
            setError(e?.message || 'Failed to delete user');
        }
    };

    return (
        <div className="user-management-page">
            <header className="user-management-header">
                <div className="brand">
                    <div className="logo-icon">
                        <img src={Logo} alt="BaeSpy" />
                    </div>
                    <div className="user-management-header-text">
                        <h1>User Management</h1>
                        <p>Manage system users and their permissions</p>
                    </div>
                </div>
                <div style={{ display: 'flex', gap: '1rem' }}>
                    <button className="user-management-back" onClick={onBack} type="button">
                        ← Back
                    </button>
                    <button className="user-management-create" onClick={handleOpenCreate} type="button">
                        + Create User
                    </button>
                </div>
            </header>

            {error && <div className="user-management-error">{error}</div>}

            <section className="user-management-content">
                {loading ? (
                    <div className="user-management-loading">Loading users…</div>
                ) : (
                    <div className="user-management-table">
                        <div className="user-management-thead">
                            <div>Username</div>
                            <div>Name</div>
                            <div>Email</div>
                            <div>Role</div>
                            <div>Status</div>
                            <div>Created</div>
                            <div>Actions</div>
                        </div>
                        {users.map((user) => (
                            <div key={user.id} className="user-management-tr">
                                <div className="user-management-cell" data-label="Username" title={user.username}>{user.username}</div>
                                <div className="user-management-cell" data-label="Name" title={`${user.first_name || ''} ${user.last_name || ''}`.trim() || undefined}>
                                    {`${user.first_name || ''} ${user.last_name || ''}`.trim() || '—'}
                                </div>
                                <div className="user-management-cell" data-label="Email" title={user.email}>{user.email}</div>
                                <div className="user-management-cell" data-label="Role">
                                    <span className={`role-badge ${user.role}`}>{user.role.toUpperCase()}</span>
                                </div>
                                <div className="user-management-cell" data-label="Status">
                                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                                        {user.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                                <div className="user-management-cell" data-label="Created">
                                    {formatDate(user.created_at)}
                                </div>
                                <div className="user-management-cell user-management-actions" data-label="Actions">
                                    <button
                                        type="button"
                                        className="user-management-action"
                                        onClick={() => handleOpenDetail(user)}
                                    >
                                        Detail
                                    </button>
                                    <button
                                        type="button"
                                        className="user-management-action"
                                        onClick={() => handleOpenEdit(user)}
                                    >
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="user-management-action danger"
                                        onClick={() => handleDelete(user)}
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                        {users.length === 0 && (
                            <div className="user-management-empty">No users found</div>
                        )}
                    </div>
                )}
            </section>

            {showModal && (
                <div className="user-management-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="user-management-modal" data-lenis-prevent onClick={(e) => e.stopPropagation()}>
                        <div className="user-management-modal-header">
                            <h2>{editingUser ? 'Edit User' : 'Create User'}</h2>
                            <button type="button" className="user-management-modal-close" onClick={() => setShowModal(false)}>
                                ×
                            </button>
                        </div>
                        <form className="user-management-modal-body" onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Username</label>
                                <input
                                    type="text"
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>First Name</label>
                                <input
                                    type="text"
                                    value={formData.firstName}
                                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Last Name</label>
                                <input
                                    type="text"
                                    value={formData.lastName}
                                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                />
                            </div>
                            <div className="form-group">
                                <label>Email</label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    required
                                />
                            </div>
                            <div className="form-group">
                                <label>Role</label>
                                <select
                                    value={formData.roleId ?? ''}
                                    onChange={(e) => setFormData({ ...formData, roleId: e.target.value ? Number(e.target.value) : null })}
                                >

                                    {roles.map((r) => (
                                        <option key={r.id} value={r.id}>
                                            {r.name}{r.isSystemRole ? '' : ' (custom)'}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            {editingUser && (
                                <div className="form-group">
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        />
                                        Active
                                    </label>
                                </div>
                            )}
                            <div className="form-group">
                                <label>Password {editingUser && '(leave blank to keep current)'}</label>
                                <PasswordInput
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    required={!editingUser}
                                    inputLabel="User password"
                                />
                            </div>
                            {error && <div className="user-management-error">{error}</div>}
                            <div className="user-management-modal-actions">
                                <button type="button" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit">
                                    {editingUser ? 'Update' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {detailUser && (
                <div className="user-management-modal-overlay" onClick={() => setDetailUser(null)}>
                    <section
                        className="user-management-modal user-management-detail-modal"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="user-detail-modal-title"
                        data-lenis-prevent
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="user-management-modal-header">
                            <h2 id="user-detail-modal-title">User Details</h2>
                            <button
                                type="button"
                                className="user-management-modal-close"
                                onClick={() => setDetailUser(null)}
                                aria-label="Close user details"
                            >
                                &times;
                            </button>
                        </div>
                        <div className="user-management-detail-list">
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">Username</span>
                                <span className="user-management-detail-value">{detailUser.username}</span>
                            </div>
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">Full Name</span>
                                <span className="user-management-detail-value">{getFullName(detailUser)}</span>
                            </div>
                            <div className="user-management-detail-item user-management-detail-item--wide">
                                <span className="user-management-detail-label">Email</span>
                                <span className="user-management-detail-value">{detailUser.email}</span>
                            </div>
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">Role</span>
                                <span className={`role-badge ${detailUser.role}`}>{detailUser.role.toUpperCase()}</span>
                            </div>
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">Account Status</span>
                                <span className={`status-badge ${detailUser.is_active ? 'active' : 'inactive'}`}>
                                    {detailUser.is_active ? 'Active' : 'Inactive'}
                                </span>
                            </div>
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">Created Date</span>
                                <span className="user-management-detail-value">{formatDate(detailUser.created_at)}</span>
                            </div>
                            {detailUser.last_login && (
                                <div className="user-management-detail-item">
                                    <span className="user-management-detail-label">Last Login</span>
                                    <span className="user-management-detail-value">{formatDate(detailUser.last_login, true)}</span>
                                </div>
                            )}
                            <div className="user-management-detail-item">
                                <span className="user-management-detail-label">User ID</span>
                                <span className="user-management-detail-value">{detailUser.id}</span>
                            </div>
                        </div>
                        <div className="user-management-modal-actions user-management-detail-actions">
                            <button type="button" onClick={() => setDetailUser(null)}>Close</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}
