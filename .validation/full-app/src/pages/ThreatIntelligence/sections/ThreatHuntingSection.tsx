import React, { useState } from 'react';
import { huntIntelligence, type HuntResult } from '../../../services/api';
import { RiskBadge, ConfidenceBadge, formatDateTime, EntityChip, IOC_TYPE_LABELS, IOC_TYPE_TO_OSINT_TAB, InvestigateButton } from '../ThreatIntelligenceShared';

interface Props {
    onOpenEntity?: (type: string, id: string) => void;
    onInvestigate?: (target: string, tab?: string) => void;
}

const ThreatHuntingSection: React.FC<Props> = ({ onOpenEntity, onInvestigate }) => {
    const [target, setTarget] = useState('');
    const [result, setResult] = useState<HuntResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState(false);

    const runHunt = async () => {
        if (!target.trim()) return;
        setLoading(true);
        setError(null);
        setSearched(true);
        try {
            const r = await huntIntelligence(target.trim());
            setResult(r);
        } catch (err: any) {
            setError(err?.message || 'Search failed');
            setResult(null);
        } finally {
            setLoading(false);
        }
    };

    const totalResults = result ? (result.ioc ? 1 : 0) + result.campaigns.length + result.threatActors.length + result.malware.length + result.vulnerabilities.length + result.techniques.length : 0;

    return (
        <div className="ti-card">
            <div className="ti-section-header">
                <span className="ti-card-title">Threat Hunting</span>
            </div>
            <div className="ti-note" style={{ marginBottom: '10px' }}>Search across the existing intelligence repository — IOCs, campaigns, threat actors, malware, vulnerabilities, MITRE techniques, investigations, and alerts.</div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                <input
                    type="text" placeholder="IP, domain, URL, hash, email, username, campaign, actor, malware, or CVE…"
                    value={target} onChange={(e) => setTarget(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runHunt(); }}
                    style={{ flex: 1, background: '#0d0f14', border: '1px solid var(--ui-border)', color: '#e6edf3', borderRadius: 'var(--radius-sm)', padding: '8px 12px', fontSize: '0.9rem' }}
                />
                <button type="button" className="ti-action-btn" style={{ background: 'rgba(0,229,255,0.12)', borderColor: 'rgba(0,229,255,0.4)', color: 'rgba(0,229,255,0.95)', padding: '8px 16px' }} onClick={runHunt} disabled={loading || !target.trim()}>
                    {loading ? 'Searching…' : 'Search Intelligence'}
                </button>
            </div>

            {error && <div className="ti-error">{error}</div>}

            {!searched ? null : loading ? (
                <div className="ti-loading">Searching…</div>
            ) : !result ? null : totalResults === 0 && result.investigations.length === 0 && result.alerts.length === 0 ? (
                <div className="ti-empty">No hunting results found for "{result.target}".</div>
            ) : (
                <>
                    {result.ioc && (
                        <div style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Indicator</div>
                            <div className="ti-kv">
                                <span className="k">Type</span><span className="v">{IOC_TYPE_LABELS[result.ioc.type] ?? result.ioc.type}</span>
                                <span className="k">Risk</span><span className="v"><RiskBadge risk={result.ioc.risk} /></span>
                                <span className="k">Confidence</span><span className="v"><ConfidenceBadge confidence={result.ioc.confidence} /></span>
                            </div>
                            <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                                <button type="button" className="ti-chip" onClick={() => onOpenEntity?.('ioc', String(result.ioc!.id))}>{result.ioc.value}</button>
                                <InvestigateButton target={result.ioc.value} tab={IOC_TYPE_TO_OSINT_TAB[result.ioc.type]} onInvestigate={onInvestigate} />
                            </div>
                        </div>
                    )}

                    {result.relationships.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Correlated Relationships ({result.relationships.length})</div>
                            <div className="ti-chip-list">
                                {result.relationships.map((r) => <EntityChip key={r.id} entity={r.entity} onOpen={onOpenEntity} />)}
                            </div>
                        </div>
                    )}

                    {(result.campaigns.length > 0 || result.threatActors.length > 0 || result.malware.length > 0 || result.vulnerabilities.length > 0 || result.techniques.length > 0) && (
                        <div style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Name Matches</div>
                            <div className="ti-chip-list">
                                {result.campaigns.map((c) => <EntityChip key={`c${c.id}`} entity={{ type: 'campaign', id: String(c.id), label: c.name }} onOpen={onOpenEntity} />)}
                                {result.threatActors.map((a) => <EntityChip key={`a${a.id}`} entity={{ type: 'threat_actor', id: String(a.id), label: a.name }} onOpen={onOpenEntity} />)}
                                {result.malware.map((m) => <EntityChip key={`m${m.id}`} entity={{ type: 'malware', id: String(m.id), label: m.name }} onOpen={onOpenEntity} />)}
                                {result.vulnerabilities.map((v) => <EntityChip key={`v${v.id}`} entity={{ type: 'vulnerability', id: v.cve_id, label: v.cve_id }} onOpen={onOpenEntity} />)}
                                {result.techniques.map((t) => <EntityChip key={`t${t.technique_id}`} entity={{ type: 'attack_technique', id: t.technique_id, label: `${t.technique_id} ${t.name}` }} onOpen={onOpenEntity} />)}
                            </div>
                        </div>
                    )}

                    {result.investigations.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Investigations ({result.investigations.length})</div>
                            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                {result.investigations.map((i) => (
                                    <div key={i.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                        <span style={{ textTransform: 'capitalize' }}>{i.module.replace(/-/g, ' ')}</span>
                                        <RiskBadge risk={i.risk_level} />
                                        <span className="ti-note" style={{ marginLeft: 'auto' }}>{formatDateTime(i.created_at)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.alerts.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Monitoring Alerts ({result.alerts.length})</div>
                            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                {result.alerts.map((a) => (
                                    <div key={a.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0' }}>
                                        <RiskBadge risk={a.severity} /><span style={{ flex: 1 }}>{a.title}</span>
                                        <span className="ti-note">{formatDateTime(a.created_at)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {result.timeline.length > 0 && (
                        <div>
                            <div className="ti-card-title" style={{ marginBottom: '8px' }}>Timeline</div>
                            <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                {result.timeline.map((e, i) => (
                                    <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '4px 0', borderLeft: '2px solid rgba(0,229,255,0.3)', paddingLeft: '10px' }}>
                                        <span style={{ flex: 1 }}>{e.label}</span>
                                        <span className="ti-note">{e.source}</span>
                                        <span className="ti-note">{formatDateTime(e.timestamp)}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default ThreatHuntingSection;
