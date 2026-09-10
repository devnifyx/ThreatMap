import React, { useState, useCallback } from 'react';
import type { Brand, BrandIdentity } from '../../../types/index';
import { addBrandIdentityItem, deleteBrandIdentityItem } from '../../../services/api';

interface BrandIdentitiesEditorProps {
    brand: Brand;
    onBrandUpdate: (updated: Brand) => void;
}

const IDENTITY_TYPES = ['domain', 'url', 'social_account', 'mobile_app', 'username'] as const;
type IdentityType = typeof IDENTITY_TYPES[number];

const PLATFORM_TYPES: Set<IdentityType> = new Set(['social_account', 'username']);

function groupByType(identities: BrandIdentity[]): [IdentityType, BrandIdentity[]][] {
    const map = new Map<IdentityType, BrandIdentity[]>();
    for (const t of IDENTITY_TYPES) map.set(t, []);
    for (const id of identities) {
        const bucket = map.get(id.identity_type as IdentityType);
        if (bucket) bucket.push(id);
    }
    return Array.from(map.entries()).filter(([, rows]) => rows.length > 0);
}

function labelType(t: IdentityType): string {
    return {
        domain: 'Domain',
        url: 'URL',
        social_account: 'Social Account',
        mobile_app: 'Mobile App',
        username: 'Username',
    }[t];
}

const BrandIdentitiesEditor: React.FC<BrandIdentitiesEditorProps> = ({ brand, onBrandUpdate }) => {
    const [identityType, setIdentityType] = useState<IdentityType>('domain');
    const [value, setValue] = useState('');
    const [platform, setPlatform] = useState('');
    const [isPrimary, setIsPrimary] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const showPlatform = PLATFORM_TYPES.has(identityType);

    const handleAdd = useCallback(async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = value.trim();
        if (!trimmed) return;
        setAdding(true);
        setAddError(null);
        try {
            const res = await addBrandIdentityItem(brand.id, {
                identityType,
                value: trimmed,
                platform: showPlatform && platform.trim() ? platform.trim() : undefined,
                isPrimary,
            });
            onBrandUpdate(res.brand);
            setValue('');
            setPlatform('');
            setIsPrimary(false);
        } catch (err: any) {
            setAddError(err.message || 'Failed to add identity');
        } finally {
            setAdding(false);
        }
    }, [brand.id, identityType, value, platform, isPrimary, showPlatform, onBrandUpdate]);

    const handleDelete = useCallback(async (identityId: number) => {
        setDeletingId(identityId);
        try {
            const res = await deleteBrandIdentityItem(brand.id, identityId);
            onBrandUpdate(res.brand);
        } catch {
            // Silently ignore — the row will still be visible; user can retry
        } finally {
            setDeletingId(null);
        }
    }, [brand.id, onBrandUpdate]);

    const identities = brand.identities ?? [];
    const groups = groupByType(identities);

    return (
        <div className="bi-identities" aria-label="Brand Identities">
            <p className="bi-identities-title">Official Identities</p>

            {/* Add identity form */}
            <form className="bi-identity-add-form" onSubmit={handleAdd} aria-label="Add identity">
                <div className="bi-field">
                    <label className="bi-label" htmlFor="bi-id-type">Type</label>
                    <select
                        id="bi-id-type"
                        className="bi-select"
                        value={identityType}
                        onChange={(e) => setIdentityType(e.target.value as IdentityType)}
                    >
                        {IDENTITY_TYPES.map((t) => (
                            <option key={t} value={t}>{labelType(t)}</option>
                        ))}
                    </select>
                </div>

                <div className="bi-field">
                    <label className="bi-label" htmlFor="bi-id-value">Value *</label>
                    <input
                        id="bi-id-value"
                        className="bi-input"
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder={identityType === 'domain' ? 'example.com' : identityType === 'url' ? 'https://…' : 'Identifier…'}
                        required
                        autoComplete="off"
                    />
                </div>

                <div className="bi-field" style={{ visibility: showPlatform ? 'visible' : 'hidden' }}>
                    <label className="bi-label" htmlFor="bi-id-platform">Platform</label>
                    <input
                        id="bi-id-platform"
                        className="bi-input"
                        value={platform}
                        onChange={(e) => setPlatform(e.target.value)}
                        placeholder="e.g. twitter"
                        autoComplete="off"
                        tabIndex={showPlatform ? 0 : -1}
                    />
                </div>

                <div className="bi-field">
                    <span className="bi-label">Primary</span>
                    <label className="bi-identity-primary-row">
                        <input
                            type="checkbox"
                            checked={isPrimary}
                            onChange={(e) => setIsPrimary(e.target.checked)}
                            aria-label="Mark as primary identity"
                        />
                        Primary
                    </label>
                </div>

                <div className="bi-field" style={{ alignSelf: 'flex-end' }}>
                    <button
                        type="submit"
                        className="bi-btn-primary"
                        disabled={adding || !value.trim()}
                        aria-busy={adding}
                    >
                        {adding ? 'Adding…' : 'Add'}
                    </button>
                </div>
            </form>

            {addError && <div className="bi-error" role="alert">{addError}</div>}

            {/* Identity list */}
            {identities.length === 0 ? (
                <div className="bi-empty" style={{ padding: '1.25rem', border: 'none' }}>
                    <p className="bi-empty-title">No identities yet</p>
                    <p className="bi-empty-sub">Add a domain, URL, or social account above to get started.</p>
                </div>
            ) : (
                <div className="bi-identity-groups" role="list" aria-label="Identity list">
                    {groups.map(([type, rows]) => (
                        <div key={type} className="bi-identity-group" role="listitem">
                            <div className="bi-identity-group-header">
                                {labelType(type)}
                                <span className="bi-identity-group-count">{rows.length}</span>
                            </div>
                            {rows.map((identity) => (
                                <div key={identity.id} className="bi-identity-row">
                                    <span className="bi-identity-value" title={identity.value}>
                                        {identity.value}
                                    </span>
                                    {identity.platform && (
                                        <span className="bi-identity-platform">{identity.platform}</span>
                                    )}
                                    {Boolean(identity.is_primary) && (
                                        <span className="bi-identity-primary-badge">primary</span>
                                    )}
                                    <button
                                        type="button"
                                        className="bi-identity-delete-btn"
                                        aria-label={`Delete identity ${identity.value}`}
                                        disabled={deletingId === identity.id}
                                        onClick={() => handleDelete(identity.id)}
                                    >
                                        {deletingId === identity.id ? '…' : 'Remove'}
                                    </button>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default BrandIdentitiesEditor;
