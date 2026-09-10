import { useEffect, useState } from 'react';
import './ApiKeysPage.css';
import { getProviderStatus } from '../../services/api';
import Logo from '../../picture/Logo.png';
import PersonalApiKeysSection from '../../components/PersonalApiKeysSection';

interface ProviderEntry {
    configured: boolean;
    status: string;
    detail: string | null;
}

type ProviderKey =
    | 'openai' | 'exa' | 'firecrawl' | 'censys' | 'whois'
    | 'shodan' | 'securitytrails' | 'whoisfreaks' | 'github' | 'paranoidlab'
    | 'abuseipdb' | 'otx' | 'googleSafeBrowsing' | 'ipinfo';

const PROVIDER_META: Array<{ key: ProviderKey; name: string; feature: string }> = [
    { key: 'openai', name: 'OpenAI', feature: 'AI Analysis (LLM summaries)' },
    { key: 'exa', name: 'Exa', feature: 'AI-powered web search' },
    { key: 'firecrawl', name: 'Firecrawl', feature: 'Web scraping & content extraction' },
    { key: 'censys', name: 'Censys', feature: 'Subdomain & asset enumeration' },
    { key: 'whois', name: 'WhoisXMLAPI', feature: 'WHOIS domain lookups' },
    { key: 'shodan', name: 'Shodan', feature: 'Subdomain enrichment, AssetRadar' },
    { key: 'securitytrails', name: 'SecurityTrails', feature: 'Subdomain enumeration, AssetRadar' },
    { key: 'whoisfreaks', name: 'WhoisFreaks', feature: 'WHOIS lookups (fallback provider)' },
    { key: 'github', name: 'GitHub', feature: 'Code Hunter, Account Discovery' },
    { key: 'paranoidlab', name: 'ParanoidLab', feature: 'Leak Check (breach exposure)' },
    { key: 'abuseipdb', name: 'AbuseIPDB', feature: 'Threat Intelligence, Global Threat Map' },
    { key: 'otx', name: 'AlienVault OTX', feature: 'Threat Intelligence, Global Threat Map' },
    { key: 'googleSafeBrowsing', name: 'Google Safe Browsing', feature: 'Threat Intelligence (URL safety)' },
    { key: 'ipinfo', name: 'IPinfo', feature: 'AssetRadar (IP geolocation)' }
];

const STATUS_LABEL: Record<string, string> = {
    configured: 'Configured',
    missing: 'Missing',
    ok: 'OK',
    invalid: 'Invalid',
    rate_limited: 'Rate Limited',
    timeout: 'Timeout',
    error: 'Error',
    quota: 'Quota Exceeded',
    unknown: 'Unknown'
};

interface ApiKeysPageProps {
    onBack: () => void;
}

export default function ApiKeysPage({ onBack }: ApiKeysPageProps) {
    const [mode, setMode] = useState<'presence' | 'active'>('presence');
    const [providers, setProviders] = useState<Record<string, ProviderEntry>>({});
    const [checkedAt, setCheckedAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async (targetMode: 'presence' | 'active') => {
        setLoading(true);
        setError(null);
        try {
            const res = await getProviderStatus(targetMode);
            if (res.status === 'success') {
                setProviders(res.providers || {});
                setCheckedAt(res.checkedAt || null);
                setMode(res.mode || targetMode);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to load provider status');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load('presence');
    }, []);

    return (
        <div className="api-keys-page">
            <header className="api-keys-header">
                <div className="brand">
                    <div className="logo-icon">
                        <img src={Logo} alt="BaeSpy" />
                    </div>
                    <div className="api-keys-header-text">
                        <h1>API Keys</h1>
                        <p>Read-only third-party provider configuration status</p>
                    </div>
                </div>
                <button className="api-keys-back" onClick={onBack} type="button">
                    ← Back
                </button>
            </header>

            {error && <div className="api-keys-error">{error}</div>}

            <section className="api-keys-content">
                <div className="api-keys-toolbar">
                    <div className="api-keys-mode-toggle">
                        <button
                            type="button"
                            className={mode === 'presence' ? 'active' : ''}
                            disabled={loading}
                            onClick={() => load('presence')}
                        >
                            Presence
                        </button>
                        <button
                            type="button"
                            className={mode === 'active' ? 'active' : ''}
                            disabled={loading}
                            onClick={() => load('active')}
                        >
                            Active Check
                        </button>
                    </div>
                    {mode === 'active' && (
                        <p className="api-keys-mode-note">
                            Active mode makes a real outbound call to each configured provider to verify the key actually works.
                        </p>
                    )}
                    {checkedAt && !loading && (
                        <span className="api-keys-checked-at">Last checked: {new Date(checkedAt).toLocaleString()}</span>
                    )}
                </div>

                {loading ? (
                    <div className="api-keys-loading">Checking providers…</div>
                ) : (
                    <div className="api-keys-table">
                        <div className="api-keys-thead">
                            <div>Provider</div>
                            <div>Status</div>
                            <div>Unlocks</div>
                            <div>Detail</div>
                        </div>
                        {PROVIDER_META.map(({ key, name, feature }) => {
                            const entry = providers[key];
                            const status = entry?.status || 'missing';
                            const label = STATUS_LABEL[status] || status;
                            return (
                                <div key={key} className="api-keys-tr">
                                    <div className="api-keys-cell" data-label="Provider">{name}</div>
                                    <div className="api-keys-cell" data-label="Status">
                                        <span className={`api-key-status-badge status-${status}`}>{label}</span>
                                    </div>
                                    <div className="api-keys-cell" data-label="Unlocks">{feature}</div>
                                    <div className="api-keys-cell api-keys-detail" data-label="Detail">{entry?.detail || '—'}</div>
                                </div>
                            );
                        })}
                    </div>
                )}

                <PersonalApiKeysSection />
            </section>
        </div>
    );
}
