import { useEffect, useState } from 'react';
import './SettingsPage.css';
import { getAppSettings, updateAppSetting } from '../../services/api';
import Logo from '../../picture/Logo.png';

interface SettingEntry {
    key: string;
    value: string;
    updatedAt: string | null;
    updatedByUsername: string | null;
}

const SETTING_META: Array<{ key: string; label: string; hint: string }> = [
    {
        key: 'max_concurrent_users',
        label: 'Max Concurrent Users',
        hint: 'How many active login sessions the system allows at once, system-wide.'
    },
    {
        key: 'session_ttl_hours',
        label: 'Session Duration (hours)',
        hint: 'How long a login session (and its cookie) stays valid before it expires.'
    },
    {
        key: 'scan_rate_limit_per_15min',
        label: 'Scan Rate Limit (per 15 min)',
        hint: 'Max scan requests a single IP can make in a 15-minute window.'
    },
    {
        key: 'api_rate_limit_per_15min',
        label: 'API Rate Limit (per 15 min)',
        hint: 'Max general API requests a single IP can make in a 15-minute window.'
    }
];

interface SettingsPageProps {
    onBack: () => void;
}

export default function SettingsPage({ onBack }: SettingsPageProps) {
    const [settings, setSettings] = useState<Record<string, SettingEntry>>({});
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [savingKey, setSavingKey] = useState<string | null>(null);
    const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
    const [savedKey, setSavedKey] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await getAppSettings();
            if (res.status === 'success') {
                const byKey: Record<string, SettingEntry> = {};
                const nextDrafts: Record<string, string> = {};
                for (const s of res.settings || []) {
                    byKey[s.key] = s;
                    nextDrafts[s.key] = s.value;
                }
                setSettings(byKey);
                setDrafts(nextDrafts);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load settings');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const handleSave = async (key: string) => {
        setSavingKey(key);
        setSavedKey(null);
        setRowErrors((prev) => ({ ...prev, [key]: '' }));
        try {
            await updateAppSetting(key, drafts[key]);
            await load();
            setSavedKey(key);
            setTimeout(() => setSavedKey((k) => (k === key ? null : k)), 2000);
        } catch (e: any) {
            setRowErrors((prev) => ({ ...prev, [key]: e?.message || 'Failed to save setting' }));
        } finally {
            setSavingKey(null);
        }
    };

    return (
        <div className="settings-page">
            <header className="settings-header">
                <div className="brand">
                    <div className="logo-icon">
                        <img src={Logo} alt="BaeSpy" />
                    </div>
                    <div className="settings-header-text">
                        <h1>Settings</h1>
                        <p>System-wide operational configuration — changes take effect immediately, no restart</p>
                    </div>
                </div>
                <button className="settings-back" onClick={onBack} type="button">
                    ← Back
                </button>
            </header>

            {error && <div className="settings-error">{error}</div>}

            <section className="settings-content">
                {loading ? (
                    <div className="settings-loading">Loading settings…</div>
                ) : (
                    <div className="settings-table">
                        {SETTING_META.map(({ key, label, hint }) => {
                            const entry = settings[key];
                            const draft = drafts[key] ?? '';
                            const dirty = entry && draft !== entry.value;
                            const rowError = rowErrors[key];
                            return (
                                <div key={key} className="settings-row">
                                    <div className="settings-row-main">
                                        <label htmlFor={`setting-${key}`}>{label}</label>
                                        <p className="settings-row-hint">{hint}</p>
                                        {entry?.updatedAt && entry?.updatedByUsername && (
                                            <p className="settings-row-meta">
                                                Last changed {new Date(entry.updatedAt).toLocaleString()} by {entry.updatedByUsername}
                                            </p>
                                        )}
                                    </div>
                                    <div className="settings-row-edit">
                                        <input
                                            id={`setting-${key}`}
                                            type="number"
                                            inputMode="numeric"
                                            value={draft}
                                            onChange={(e) => setDrafts((prev) => ({ ...prev, [key]: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            disabled={!dirty || savingKey === key}
                                            onClick={() => handleSave(key)}
                                        >
                                            {savingKey === key ? 'Saving…' : 'Save'}
                                        </button>
                                    </div>
                                    {savedKey === key && !rowError && (
                                        <div className="settings-row-success">Saved.</div>
                                    )}
                                    {rowError && <div className="settings-row-error">{rowError}</div>}
                                </div>
                            );
                        })}
                    </div>
                )}
            </section>
        </div>
    );
}
