import { useEffect, useState, type FormEvent } from 'react';
import './PreferencesModal.css';
import { getUserPreferences, updateUserPreferences } from '../services/api';
import { PHONE_CODES } from '../constants/phoneCodes';

// ADMINISTRATION_PASS3.md Part C — a modal off the topbar user area, not a
// new page/nav-tree entry (this is deliberately small: 2 fields). Reuses
// UserManagementPage.tsx's modal-overlay/modal structural pattern for
// visual consistency, with its own scoped class prefix (preferences-modal-*)
// so nothing here collides with UserManagementPage.css's own .form-group
// fix (see that file's note on why bare ".form-group" is unsafe to reuse).
interface PreferencesModalProps {
    onClose: () => void;
}

export default function PreferencesModal({ onClose }: PreferencesModalProps) {
    const [defaultPhoneCountryCode, setDefaultPhoneCountryCode] = useState('+60');
    const [notificationsEnabled, setNotificationsEnabled] = useState(true);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let cancelled = false;
        getUserPreferences()
            .then((res) => {
                if (cancelled) return;
                const prefs = res?.preferences || {};
                setDefaultPhoneCountryCode(prefs.default_phone_country_code || '+60');
                setNotificationsEnabled(prefs.notifications_enabled !== false);
            })
            .catch((e: any) => {
                if (!cancelled) setError(e?.message || 'Failed to load preferences');
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => { cancelled = true; };
    }, []);

    const handleSave = async (e: FormEvent) => {
        e.preventDefault();
        setSaving(true);
        setError(null);
        setSaved(false);
        try {
            await updateUserPreferences({ defaultPhoneCountryCode, notificationsEnabled });
            setSaved(true);
        } catch (e: any) {
            setError(e?.message || 'Failed to save preferences');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="preferences-modal-overlay" onClick={onClose}>
            <div className="preferences-modal" data-lenis-prevent onClick={(e) => e.stopPropagation()}>
                <div className="preferences-modal-header">
                    <h2>Preferences</h2>
                    <button type="button" className="preferences-modal-close" onClick={onClose}>
                        ×
                    </button>
                </div>
                {loading ? (
                    <div className="preferences-modal-loading">Loading…</div>
                ) : (
                    <form className="preferences-modal-body" onSubmit={handleSave}>
                        <div className="form-group">
                            <label>Default Phone Country Code</label>
                            <select
                                value={defaultPhoneCountryCode}
                                onChange={(e) => setDefaultPhoneCountryCode(e.target.value)}
                            >
                                {PHONE_CODES.map((c) => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                            <p className="preferences-modal-hint">Used as the starting country code in OSINT Toolkit's Phone Intelligence.</p>
                        </div>
                        <div className="form-group">
                            <label>
                                <input
                                    type="checkbox"
                                    checked={notificationsEnabled}
                                    onChange={(e) => setNotificationsEnabled(e.target.checked)}
                                />
                                Notifications enabled
                            </label>
                        </div>
                        {error && <div className="preferences-modal-error">{error}</div>}
                        {saved && !error && <div className="preferences-modal-success">Saved.</div>}
                        <div className="preferences-modal-actions">
                            <button type="button" onClick={onClose}>Close</button>
                            <button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save'}</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
