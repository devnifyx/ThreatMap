import React, { useState, useCallback, useRef, KeyboardEvent } from 'react';
import type { Brand } from '../../../types/index';

interface BrandProfileFormProps {
    brand?: Brand;
    saving: boolean;
    error: string | null;
    onSave: (payload: {
        name: string;
        aliases: string[];
        keywords: string[];
        primaryColorHex: string;
        secondaryColorHex: string;
        logoReferenceUrl: string;
        notes: string;
    }) => void;
    onCancel: () => void;
}

function toStringArray(v: unknown): string[] {
    if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
    if (typeof v === 'string') {
        try { const p = JSON.parse(v); return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : []; }
        catch { return []; }
    }
    return [];
}

const BrandProfileForm: React.FC<BrandProfileFormProps> = ({ brand, saving, error, onSave, onCancel }) => {
    const [name, setName] = useState(brand?.name ?? '');
    const [aliases, setAliases] = useState<string[]>(toStringArray(brand?.aliases_json));
    const [keywords, setKeywords] = useState<string[]>(toStringArray(brand?.keywords_json));
    const [primaryColorHex, setPrimaryColorHex] = useState(brand?.primary_color_hex ?? '');
    const [secondaryColorHex, setSecondaryColorHex] = useState(brand?.secondary_color_hex ?? '');
    const [logoReferenceUrl, setLogoReferenceUrl] = useState(brand?.logo_reference_url ?? '');
    const [notes, setNotes] = useState(brand?.notes ?? '');
    const [aliasInput, setAliasInput] = useState('');
    const [keywordInput, setKeywordInput] = useState('');
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoUploadError, setLogoUploadError] = useState<string | null>(null);
    const logoFileRef = useRef<HTMLInputElement>(null);

    const handleLogoFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoUploading(true);
        setLogoUploadError(null);
        try {
            const formData = new FormData();
            formData.append('logo', file);
            const token = localStorage.getItem('token');
            const res = await fetch('/api/brand-intel/upload-logo', {
                method: 'POST',
                headers: token ? { Authorization: `Bearer ${token}` } : {},
                body: formData
            });
            const json = await res.json();
            if (json.status === 'success') {
                setLogoReferenceUrl(json.url);
            } else {
                setLogoUploadError(json.message ?? 'Upload failed');
            }
        } catch {
            setLogoUploadError('Upload failed');
        } finally {
            setLogoUploading(false);
            if (logoFileRef.current) logoFileRef.current.value = '';
        }
    }, []);

    const addAlias = useCallback(() => {
        const v = aliasInput.trim();
        if (v && !aliases.includes(v)) setAliases((prev) => [...prev, v]);
        setAliasInput('');
    }, [aliasInput, aliases]);

    const removeAlias = useCallback((a: string) => setAliases((prev) => prev.filter((x) => x !== a)), []);

    const addKeyword = useCallback(() => {
        const v = keywordInput.trim();
        if (v && !keywords.includes(v)) setKeywords((prev) => [...prev, v]);
        setKeywordInput('');
    }, [keywordInput, keywords]);

    const removeKeyword = useCallback((k: string) => setKeywords((prev) => prev.filter((x) => x !== k)), []);

    const handleKeyDown = (onAdd: () => void) => (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') { e.preventDefault(); onAdd(); }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSave({ name: name.trim(), aliases, keywords, primaryColorHex, secondaryColorHex, logoReferenceUrl, notes });
    };

    const isEdit = Boolean(brand);

    return (
        <form className="bi-form" onSubmit={handleSubmit} aria-label={isEdit ? 'Edit brand profile' : 'Create brand profile'}>
            <p className="bi-form-title">{isEdit ? 'Edit Profile' : 'New Brand Profile'}</p>

            {error && <div className="bi-error" role="alert">{error}</div>}

            {/* Row 1: Name (full width) */}
            <div className="bi-field full">
                <label className="bi-label" htmlFor="bi-name">Brand Name *</label>
                <input
                    id="bi-name"
                    className="bi-input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g., WhatsApp"
                    required
                    autoComplete="off"
                />
            </div>

            {/* Row 2: Aliases + Keywords */}
            <div className="bi-form-row">
                {/* Aliases */}
                <div className="bi-field bi-tag-field">
                    <span className="bi-label">Aliases</span>
                    {aliases.length > 0 && (
                        <div className="bi-tag-chips" aria-label="Alias chips">
                            {aliases.map((a) => (
                                <span key={a} className="bi-chip">
                                    {a}
                                    <button
                                        type="button"
                                        className="bi-chip-remove"
                                        aria-label={`Remove alias ${a}`}
                                        onClick={() => removeAlias(a)}
                                    >×</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="bi-tag-add-row">
                        <input
                            className="bi-input"
                            value={aliasInput}
                            onChange={(e) => setAliasInput(e.target.value)}
                            onKeyDown={handleKeyDown(addAlias)}
                            placeholder="Type and press Enter"
                            aria-label="Add alias"
                            autoComplete="off"
                        />
                        <button type="button" className="bi-tag-add-btn" onClick={addAlias}>Add</button>
                    </div>
                </div>

                {/* Keywords */}
                <div className="bi-field bi-tag-field">
                    <span className="bi-label">Keywords</span>
                    {keywords.length > 0 && (
                        <div className="bi-tag-chips" aria-label="Keyword chips">
                            {keywords.map((k) => (
                                <span key={k} className="bi-chip">
                                    {k}
                                    <button
                                        type="button"
                                        className="bi-chip-remove"
                                        aria-label={`Remove keyword ${k}`}
                                        onClick={() => removeKeyword(k)}
                                    >×</button>
                                </span>
                            ))}
                        </div>
                    )}
                    <div className="bi-tag-add-row">
                        <input
                            className="bi-input"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={handleKeyDown(addKeyword)}
                            placeholder="Type and press Enter"
                            aria-label="Add keyword"
                            autoComplete="off"
                        />
                        <button type="button" className="bi-tag-add-btn" onClick={addKeyword}>Add</button>
                    </div>
                </div>
            </div>

            {/* Row 3: Colors */}
            <div className="bi-form-row">
                <div className="bi-field">
                    <label className="bi-label" htmlFor="bi-primary-color">Primary Color</label>
                    <div className="bi-color-row">
                        <span
                            className="bi-color-swatch"
                            style={{ background: primaryColorHex || 'transparent' }}
                            aria-hidden="true"
                        />
                        <input
                            id="bi-primary-color"
                            className="bi-input"
                            value={primaryColorHex}
                            onChange={(e) => setPrimaryColorHex(e.target.value)}
                            placeholder="#RRGGBB"
                            maxLength={7}
                            autoComplete="off"
                        />
                    </div>
                </div>
                <div className="bi-field">
                    <label className="bi-label" htmlFor="bi-secondary-color">Secondary Color</label>
                    <div className="bi-color-row">
                        <span
                            className="bi-color-swatch"
                            style={{ background: secondaryColorHex || 'transparent' }}
                            aria-hidden="true"
                        />
                        <input
                            id="bi-secondary-color"
                            className="bi-input"
                            value={secondaryColorHex}
                            onChange={(e) => setSecondaryColorHex(e.target.value)}
                            placeholder="#RRGGBB"
                            maxLength={7}
                            autoComplete="off"
                        />
                    </div>
                </div>
            </div>

            {/* Row 4: Logo URL (full width) + file upload */}
            <div className="bi-field full">
                <label className="bi-label" htmlFor="bi-logo-url">Logo Reference URL</label>
                <div className="bi-logo-row">
                    {logoReferenceUrl && (
                        <img
                            src={logoReferenceUrl}
                            alt="Logo preview"
                            className="bi-logo-preview"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                    )}
                    <input
                        id="bi-logo-url"
                        className="bi-input"
                        type="url"
                        value={logoReferenceUrl}
                        onChange={(e) => setLogoReferenceUrl(e.target.value)}
                        placeholder="https://example.com/logo.png"
                        autoComplete="off"
                    />
                    <button
                        type="button"
                        className="bi-tag-add-btn"
                        onClick={() => logoFileRef.current?.click()}
                        disabled={logoUploading}
                        title="Upload from folder"
                    >
                        {logoUploading ? '…' : '📁'}
                    </button>
                    <input
                        ref={logoFileRef}
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={handleLogoFileChange}
                    />
                </div>
                {logoUploadError && <span className="bi-upload-error">{logoUploadError}</span>}
            </div>

            {/* Row 5: Notes (full width) */}
            <div className="bi-field full">
                <label className="bi-label" htmlFor="bi-notes">Notes</label>
                <textarea
                    id="bi-notes"
                    className="bi-textarea"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional context about this brand…"
                    rows={3}
                />
            </div>

            <div className="bi-form-actions">
                <button type="button" className="bi-btn-secondary" onClick={onCancel} disabled={saving}>
                    Cancel
                </button>
                <button type="submit" className="bi-btn-primary" disabled={saving || !name.trim()}>
                    {saving ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Brand')}
                </button>
            </div>
        </form>
    );
};

export default BrandProfileForm;
