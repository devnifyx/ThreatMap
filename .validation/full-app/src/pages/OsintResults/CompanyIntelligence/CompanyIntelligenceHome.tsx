import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import './CompanyIntelligence.css';
import { timeAgo } from '../../../utils/timeAgo';
import {
    getCompanies, analyzeCompany as apiAnalyzeCompany, reanalyzeCompany, getCompany, updateCompany, deleteCompany,
    getCompanySummary, getCompanyDomains, getCompanyIps, getCompanyCertificates, getCompanyTechnologies,
    getCompanyDigitalAssets, getCompanyPeople, addCompanyPerson as apiAddCompanyPerson, deleteCompanyPerson as apiDeleteCompanyPerson,
    getCompanySocialAccounts, updateCompanySocialAccountVerification, getCompanyEmails, addCompanyEmail as apiAddCompanyEmail,
    deleteCompanyEmail as apiDeleteCompanyEmail, getCompanyBrandPresence, getCompanyRelationships, addCompanyRelationship as apiAddCompanyRelationship,
    deleteCompanyRelationship as apiDeleteCompanyRelationship, getCompanyThreatIntel, getCompanyTimeline, getCompanyAiSummary,
    getRelationshipGraph,
    type Company, type CompanySummary, type CompanyDomain, type CompanyIp, type CompanyCertificate, type CompanyTechnology,
    type CompanyDigitalAsset, type CompanyPerson, type CompanySocialAccount, type CompanyEmail, type CompanyRelationship,
    type CompanyBrandPresence, type EntityRelationship, type CompanyTimelineEntry, type CompanyAiSummary, type RelationshipGraph as GraphData
} from '../../../services/api';
import { formatDateTime } from '../../ThreatIntelligence/ThreatIntelligenceShared';
import RiskAssessmentBlock from '../../ThreatIntelligence/sections/RiskAssessmentBlock';
import RelationshipGraphViz from '../../ThreatIntelligence/sections/RelationshipGraph';

const CONFIDENCE_OPTIONS = ['Confirmed', 'High Confidence', 'Possible', 'Unverified', 'Unknown'];
const RISK_OPTIONS = ['Critical', 'High', 'Medium', 'Low', 'Informational'];
const RELATIONSHIP_TYPES = ['parent', 'subsidiary', 'acquisition', 'partner', 'vendor', 'associated'];
const SUSPICIOUS_PREFIXES = ['admin', 'dev', 'test', 'staging', 'vpn', 'api'];

function ConfidenceBadge({ confidence }: { confidence: string | null | undefined }) {
    if (!confidence) return <span className="cm-badge cm-badge--unknown">Unknown</span>;
    const cls = confidence.toLowerCase().replace(/\s+/g, '-');
    return <span className={`cm-badge cm-badge--${cls}`}>{confidence}</span>;
}
function RiskBadge({ risk }: { risk: string | null | undefined }) {
    if (!risk) return <span className="cm-risk-badge cm-risk-badge--none">Not assessed</span>;
    return <span className={`cm-risk-badge cm-risk-badge--${risk.toLowerCase()}`}>{risk}</span>;
}

const ORIGIN_LABELS: Record<string, string> = { analyst: 'Analyst Provided', discovered: 'Discovered', inferred: 'Inferred' };
function OriginBadge({ origin }: { origin: string | null | undefined }) {
    const key = origin || 'discovered';
    return <span className={`cm-badge cm-badge--origin-${key}`}>{ORIGIN_LABELS[key] || key}</span>;
}
function isSuspiciousSubdomain(domain: string): boolean {
    const label = domain.split('.')[0]?.toLowerCase() || '';
    return SUSPICIOUS_PREFIXES.includes(label);
}

function ConfirmDialog({ title, message, onConfirm, onCancel }: { title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
    return (
        <div className="cm-confirm-overlay" data-lenis-prevent role="dialog" aria-modal="true" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
            <div className="cm-confirm-box">
                <h3>{title}</h3>
                <p>{message}</p>
                <div className="cm-confirm-actions">
                    <button type="button" className="cm-btn" onClick={onCancel}>Cancel</button>
                    <button type="button" className="cm-btn cm-btn--danger" onClick={onConfirm}>Delete</button>
                </div>
            </div>
        </div>
    );
}

function EditCompanyModal({ company, onClose, onSaved }: { company: Company; onClose: () => void; onSaved: () => void }) {
    const [form, setForm] = useState({
        legalName: company.legalName || '', tradingName: company.tradingName || '', industry: company.industry || '',
        companyType: company.companyType || '', country: company.country || '', location: company.location || '',
        website: company.website || '', description: company.description || '', foundedDate: company.foundedDate || '',
        confidence: company.confidence, risk: company.risk || ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const submit = async () => {
        setSaving(true); setError(null);
        try {
            await updateCompany(company.id, form as any);
            onSaved();
        } catch (err: any) {
            setError(err?.message || 'Failed to update company.');
        } finally {
            setSaving(false);
        }
    };

    return createPortal(
        <div className="cm-modal-overlay" data-lenis-prevent role="dialog" aria-modal="true" aria-label="Edit company" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="cm-modal">
                <div className="cm-modal-header"><h2>Edit Company Profile</h2><button type="button" className="cm-modal-close" onClick={onClose} aria-label="Close">×</button></div>
                <div className="cm-modal-body">
                    <div className="cm-form-grid">
                        <label className="cm-field"><span>Legal Name</span><input type="text" value={form.legalName} onChange={(e) => setForm((f) => ({ ...f, legalName: e.target.value }))} /></label>
                        <label className="cm-field"><span>Trading Name</span><input type="text" value={form.tradingName} onChange={(e) => setForm((f) => ({ ...f, tradingName: e.target.value }))} /></label>
                        <label className="cm-field"><span>Industry</span><input type="text" value={form.industry} onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))} /></label>
                        <label className="cm-field"><span>Company Type</span><input type="text" value={form.companyType} onChange={(e) => setForm((f) => ({ ...f, companyType: e.target.value }))} placeholder="Public / Private / Nonprofit…" /></label>
                        <label className="cm-field"><span>Country</span><input type="text" value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} /></label>
                        <label className="cm-field"><span>Location</span><input type="text" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="City, region…" /></label>
                        <label className="cm-field"><span>Website</span><input type="text" value={form.website} onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))} /></label>
                        <label className="cm-field"><span>Founded Date</span><input type="date" value={form.foundedDate} onChange={(e) => setForm((f) => ({ ...f, foundedDate: e.target.value }))} /></label>
                        <label className="cm-field">
                            <span>Profile Confidence</span>
                            <select value={form.confidence} onChange={(e) => setForm((f) => ({ ...f, confidence: e.target.value as any }))}>
                                {CONFIDENCE_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </label>
                        <label className="cm-field">
                            <span>Manual Risk</span>
                            <select value={form.risk} onChange={(e) => setForm((f) => ({ ...f, risk: e.target.value }))}>
                                <option value="">Not assessed</option>
                                {RISK_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="cm-field"><span>Description</span><textarea rows={3} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} /></label>
                    {error && <div className="cm-error">{error}</div>}
                </div>
                <div className="cm-modal-footer">
                    <button type="button" className="cm-btn cm-btn--primary" onClick={submit} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
                    <button type="button" className="cm-btn" onClick={onClose} disabled={saving}>Cancel</button>
                </div>
            </div>
        </div>,
        document.body
    );
}

interface CompanyIntelligenceHomeProps {
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    // Opens ONE specific entity on the Threat Intelligence page. The
    // Relationship Graph emits a real (type, id) per node; previously every
    // node except 'ioc' was ignored and 'ioc' was sent to the OSINT
    // 'vulnerability-intel' module — wrong destination, and a module that was
    // an unimplemented placeholder, so the click dead-ended.
    onOpenEntity?: (entityType: string, entityId: string) => void;
    prefillValue?: string;
}

const CompanyIntelligenceHome: React.FC<CompanyIntelligenceHomeProps> = ({ onNavigateToModule, prefillValue, onOpenEntity }) => {
    // ── Search / list ──
    const [searchInput, setSearchInput] = useState(prefillValue ?? '');
    const [analyzing, setAnalyzing] = useState(false);
    const [analyzeError, setAnalyzeError] = useState<string | null>(null);
    const [recentCompanies, setRecentCompanies] = useState<Company[]>([]);
    const [recentLoading, setRecentLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);

    useEffect(() => {
        if (!prefillValue) return;
        setSearchInput(prefillValue);
        setSelectedId(null);
    }, [prefillValue]);

    const loadRecent = useCallback(() => {
        setRecentLoading(true);
        getCompanies({ sortBy: 'created_at', sortDir: 'desc', pageSize: 20 })
            .then((res) => setRecentCompanies(res.items))
            .catch(() => {})
            .finally(() => setRecentLoading(false));
    }, []);
    useEffect(() => { loadRecent(); }, [loadRecent]);

    const runAnalyze = async () => {
        if (!searchInput.trim()) return;
        setAnalyzing(true); setAnalyzeError(null);
        try {
            const result = await apiAnalyzeCompany(searchInput.trim());
            setSelectedId(result.company.id);
            setSearchInput('');
            loadRecent();
        } catch (err: any) {
            setAnalyzeError(err?.message || 'Failed to analyze company.');
        } finally {
            setAnalyzing(false);
        }
    };

    if (selectedId != null) {
        return <CompanyDetail companyId={selectedId} onBack={() => { setSelectedId(null); loadRecent(); }} onNavigateToModule={onNavigateToModule} onOpenEntity={onOpenEntity} />;
    }

    return (
        <div className="cm-page">
            <div className="cm-header">
                <div className="cm-header-text">
                    <h2>Company Intelligence</h2>
                    <p>Investigate an organization, its digital footprint, infrastructure, people, exposure, and threat relationships.</p>
                </div>
            </div>

            <div className="cm-card">
                <div className="cm-search-box">
                    <input
                        type="text" placeholder="Enter company name, domain, or identifier…" value={searchInput}
                        onChange={(e) => { setSearchInput(e.target.value); setAnalyzeError(null); }}
                        onKeyDown={(e) => e.key === 'Enter' && runAnalyze()}
                    />
                    <button type="button" className="cm-btn cm-btn--primary" onClick={runAnalyze} disabled={analyzing || !searchInput.trim()}>
                        {analyzing ? 'Analyzing…' : 'Analyze'}
                    </button>
                </div>
                {analyzeError && <div className="cm-error" style={{ marginTop: '10px' }}>{analyzeError}</div>}
            </div>

            <div className="cm-card">
                <div className="cm-card-title">Recent Companies</div>
                {recentLoading ? (
                    <div className="cm-loading">Loading…</div>
                ) : recentCompanies.length === 0 ? (
                    <div className="cm-empty">No companies have been investigated yet. Enter a company name, domain, or website above to begin.</div>
                ) : (
                    <div className="cm-list-companies">
                        {recentCompanies.map((c) => (
                            <div key={c.id} className="cm-company-row" onClick={() => setSelectedId(c.id)}>
                                <div>
                                    <div className="cm-company-row-name">{c.name}</div>
                                    <div className="cm-company-row-meta">{c.industry || 'Industry unknown'} · {c.domainCount ?? 0} domain(s) · {c.ipCount ?? 0} IP(s)</div>
                                </div>
                                <RiskBadge risk={c.risk} />
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────
// Company Detail — the full profile once a company is selected/analyzed.
// ─────────────────────────────────────────────────────────────────────────

interface CompanyDetailProps {
    companyId: number;
    onBack: () => void;
    onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
    onOpenEntity?: (entityType: string, entityId: string) => void;
}

const CompanyDetail: React.FC<CompanyDetailProps> = ({ companyId, onBack, onNavigateToModule, onOpenEntity }) => {
    const [company, setCompany] = useState<Company | null>(null);
    const [summary, setSummary] = useState<CompanySummary | null>(null);
    const [domains, setDomains] = useState<CompanyDomain[]>([]);
    const [ips, setIps] = useState<CompanyIp[]>([]);
    const [certificates, setCertificates] = useState<CompanyCertificate[]>([]);
    const [technologies, setTechnologies] = useState<CompanyTechnology[]>([]);
    const [assets, setAssets] = useState<CompanyDigitalAsset[]>([]);
    const [people, setPeople] = useState<CompanyPerson[]>([]);
    const [social, setSocial] = useState<CompanySocialAccount[]>([]);
    const [emails, setEmails] = useState<CompanyEmail[]>([]);
    const [brandPresence, setBrandPresence] = useState<CompanyBrandPresence | null>(null);
    const [relationships, setRelationships] = useState<CompanyRelationship[]>([]);
    const [threatIntel, setThreatIntel] = useState<EntityRelationship[]>([]);
    const [timeline, setTimeline] = useState<CompanyTimelineEntry[]>([]);
    const [graph, setGraph] = useState<GraphData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [reanalyzing, setReanalyzing] = useState(false);
    const [showEdit, setShowEdit] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);

    const load = useCallback(() => {
        setLoading(true); setError(null);
        Promise.all([
            getCompany(companyId), getCompanySummary(companyId), getCompanyDomains(companyId), getCompanyIps(companyId),
            getCompanyCertificates(companyId), getCompanyTechnologies(companyId), getCompanyDigitalAssets(companyId),
            getCompanyPeople(companyId), getCompanySocialAccounts(companyId), getCompanyEmails(companyId),
            getCompanyBrandPresence(companyId), getCompanyRelationships(companyId), getCompanyThreatIntel(companyId),
            getCompanyTimeline(companyId, { pageSize: 50 }), getRelationshipGraph('company', companyId, 1).catch(() => ({ nodes: [], edges: [], truncated: false }))
        ])
            .then(([c, s, d, ip, certs, tech, asset, ppl, soc, eml, brand, rel, ti, tl, g]) => {
                setCompany(c); setSummary(s); setDomains(d); setIps(ip); setCertificates(certs); setTechnologies(tech);
                setAssets(asset); setPeople(ppl); setSocial(soc); setEmails(eml); setBrandPresence(brand);
                setRelationships(rel); setThreatIntel(ti); setTimeline(tl.items); setGraph(g);
            })
            .catch((err) => setError(err?.message || 'Failed to load company'))
            .finally(() => setLoading(false));
    }, [companyId]);
    useEffect(() => { load(); }, [load]);

    const reanalyze = async () => {
        setReanalyzing(true);
        try { await reanalyzeCompany(companyId); load(); } finally { setReanalyzing(false); }
    };

    const doDelete = async () => {
        setConfirmDelete(false);
        await deleteCompany(companyId);
        onBack();
    };

    if (loading) return <div className="cm-page"><div className="cm-loading">Loading company profile…</div></div>;
    if (error || !company) return (
        <div className="cm-page">
            <div className="cm-error">{error || 'Company not found'}<button type="button" className="cm-btn cm-btn--sm" onClick={onBack}>Back</button></div>
        </div>
    );

    const primaryDomains = domains.filter((d) => d.kind === 'primary' || d.kind === 'related');
    const subdomains = domains.filter((d) => d.kind === 'subdomain');
    const exposedEmails = emails.filter((e) => (e.breachTotalExposures || 0) > 0);

    return (
        <div className="cm-page">
            <div className="cm-header">
                <div className="cm-header-text">
                    <button type="button" className="cm-btn cm-btn--sm" onClick={onBack} style={{ marginBottom: '10px' }}>‹ All Companies</button>
                    <h2>{company.name}</h2>
                    <p>{company.industry || 'Industry unknown'} {company.website ? `· ${company.website}` : ''}</p>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <ConfidenceBadge confidence={company.confidence} />
                    <RiskBadge risk={company.risk} />
                    <button type="button" className="cm-btn cm-btn--sm" onClick={reanalyze} disabled={reanalyzing}>{reanalyzing ? 'Analyzing…' : 'Re-Analyze'}</button>
                    <button type="button" className="cm-btn cm-btn--sm" onClick={() => setShowEdit(true)}>Edit</button>
                    <button type="button" className="cm-btn cm-btn--danger cm-btn--sm" onClick={() => setConfirmDelete(true)}>Delete</button>
                </div>
            </div>

            {/* §5 — Overview Dashboard: 8 real summary cards */}
            <div className="cm-summary">
                <div className="cm-summary-card"><span className="cm-summary-card-label">Domains</span><span className="cm-summary-card-value">{summary?.domains ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">IP Addresses</span><span className="cm-summary-card-value">{summary?.ipAddresses ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">Subdomains</span><span className="cm-summary-card-value">{summary?.subdomains ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">People</span><span className="cm-summary-card-value">{summary?.people ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">Technologies</span><span className="cm-summary-card-value">{summary?.technologies ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">Digital Assets</span><span className="cm-summary-card-value">{summary?.digitalAssets ?? 0}</span></div>
                <div className="cm-summary-card cm-summary-card--exposure"><span className="cm-summary-card-label">Exposure</span><span className="cm-summary-card-value">{summary?.exposures ?? 0}</span></div>
                <div className="cm-summary-card"><span className="cm-summary-card-label">Risk</span><span className="cm-summary-card-value"><RiskBadge risk={summary?.risk} /></span></div>
            </div>

            {/* §6/§7 — Company Overview + Corporate Identity */}
            <div className="cm-card">
                <div className="cm-card-title">Company Overview &amp; Corporate Identity</div>
                <div className="cm-kv-grid-2col">
                    <div className="cm-kv">
                        <span className="k">Legal Name</span><span className="v">{company.legalName || '—'}</span>
                        <span className="k">Trading Name</span><span className="v">{company.tradingName || '—'}</span>
                        <span className="k">Industry</span><span className="v">{company.industry || '—'}</span>
                        <span className="k">Company Type</span><span className="v">{company.companyType || '—'}</span>
                        <span className="k">Country</span><span className="v">{company.country || '—'}</span>
                        <span className="k">Headquarters / Location</span><span className="v">{company.location || '—'}</span>
                    </div>
                    <div className="cm-kv">
                        <span className="k">Website</span><span className="v">{company.website ? <a href={company.website} target="_blank" rel="noopener noreferrer">{company.website}</a> : '—'}</span>
                        <span className="k">Founded</span><span className="v">{company.foundedDate || '—'}</span>
                        <span className="k">Company Registration</span><span className="v">Not collected — no public registry integration exists yet.</span>
                        <span className="k">Parent Company</span>
                        <span className="v">{company.parentCompanyName || 'None on record'}</span>
                        <span className="k">Subsidiaries</span>
                        <span className="v">{company.subsidiaries?.length ? company.subsidiaries.map((s) => s.name).join(', ') : 'None on record'}</span>
                        <span className="k">Source</span><span className="v">{company.source || '—'}</span>
                    </div>
                </div>
                {company.description && <p style={{ marginTop: '12px', fontSize: '0.86rem', color: 'rgba(224,224,224,0.85)' }}>{company.description}</p>}
            </div>

            {/* §8 — Domain & Infrastructure */}
            <div className="cm-card">
                <div className="cm-card-title">Domain &amp; Infrastructure <span className="cm-card-title-count">{primaryDomains.length} domain(s)</span></div>
                {primaryDomains.length === 0 ? (
                    <div className="cm-empty">No domain identified for this company yet. Re-run Analyze with a domain or website to populate this section.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>Domain</th><th>Origin</th><th>Registrar</th><th>Registered</th><th>Expires</th><th>Nameservers</th><th>Hosting / Cloud</th><th>IP</th><th>Confidence</th><th></th></tr></thead>
                            <tbody>
                                {primaryDomains.map((d) => (
                                    <tr key={d.id}>
                                        <td className="cm-mono">{d.domain}</td>
                                        <td><OriginBadge origin={d.origin} /></td>
                                        <td>{d.registrar || '—'}</td>
                                        <td>{d.registrationDate ? formatDateTime(d.registrationDate) : '—'}</td>
                                        <td>{d.expirationDate ? formatDateTime(d.expirationDate) : '—'}</td>
                                        <td><span className="cm-truncate" title={d.nameservers.join(', ')}>{d.nameservers.length ? d.nameservers.join(', ') : '—'}</span></td>
                                        <td>{d.cloudProvider || d.hostingProvider || '—'}</td>
                                        <td className="cm-mono">{d.ip || '—'}</td>
                                        <td><ConfidenceBadge confidence={d.confidence} /></td>
                                        <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => onNavigateToModule?.('domain-intel', d.domain)}>Open in Domain Intel</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §9 — Subdomains */}
            <div className="cm-card">
                <div className="cm-card-title">Subdomain Intelligence <span className="cm-card-title-count">{subdomains.length} discovered</span></div>
                {subdomains.length === 0 ? (
                    <div className="cm-empty">No subdomains discovered yet.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>Subdomain</th><th>Origin</th><th>First Seen</th><th>Source</th><th></th></tr></thead>
                            <tbody>
                                {subdomains.slice(0, 100).map((d) => (
                                    <tr key={d.id}>
                                        <td className={isSuspiciousSubdomain(d.domain) ? 'cm-mono cm-suspicious-name' : 'cm-mono'} title={isSuspiciousSubdomain(d.domain) ? 'Name commonly associated with elevated exposure risk — not proof of a vulnerability' : undefined}>{d.domain}</td>
                                        <td><OriginBadge origin={d.origin} /></td>
                                        <td>{d.firstSeenAt ? timeAgo(d.firstSeenAt) : '—'}</td>
                                        <td>{d.source || '—'}</td>
                                        <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => onNavigateToModule?.('domain-intel', d.domain)}>Open</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §11 — Certificates */}
            <div className="cm-card">
                <div className="cm-card-title">Certificate Intelligence <span className="cm-card-title-count">{certificates.length}</span></div>
                {certificates.length === 0 ? (
                    <div className="cm-empty">No certificates on record.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>Domain</th><th>Issuer</th><th>Valid From</th><th>Valid Until</th><th>SANs</th><th>Status</th></tr></thead>
                            <tbody>
                                {certificates.map((c) => (
                                    <tr key={c.id}>
                                        <td className="cm-mono">{c.domain}</td>
                                        <td><span className="cm-truncate" title={c.issuer || ''}>{c.issuer || '—'}</span></td>
                                        <td>{c.validFrom ? formatDateTime(c.validFrom) : '—'}</td>
                                        <td>{c.validUntil ? formatDateTime(c.validUntil) : '—'}</td>
                                        <td><span className="cm-truncate" title={c.sans.join(', ')}>{c.sans.length || 0} SAN(s)</span></td>
                                        <td><span className={`cm-badge cm-badge--${c.status === 'valid' ? 'confirmed' : c.status === 'expired' ? 'low' : 'unknown'}`}>{c.status}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §10 — IP & Network */}
            <div className="cm-card">
                <div className="cm-card-title">IP &amp; Network Intelligence <span className="cm-card-title-count">{ips.length}</span></div>
                {ips.length === 0 ? (
                    <div className="cm-empty">No IP addresses on record.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>IP</th><th>Version</th><th>ASN</th><th>Org</th><th>Country</th><th>Reverse DNS</th><th>Confidence</th><th></th></tr></thead>
                            <tbody>
                                {ips.map((ip) => (
                                    <tr key={ip.id}>
                                        <td className="cm-mono">{ip.ip}</td>
                                        <td>{ip.ipVersion.toUpperCase()}</td>
                                        <td>{ip.asn || '—'}</td>
                                        <td><span className="cm-truncate" title={ip.org || ''}>{ip.org || '—'}</span></td>
                                        <td>{ip.country || '—'}</td>
                                        <td><span className="cm-truncate" title={ip.reverseDns.join(', ')}>{ip.reverseDns.length ? ip.reverseDns.join(', ') : '—'}</span></td>
                                        <td><ConfidenceBadge confidence={ip.confidence} /></td>
                                        <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => onNavigateToModule?.('ip-intel', ip.ip)}>Open in IP Intel</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <TechnologyStackSection technologies={technologies} />

            {/* §15 — Digital Assets (unified view) */}
            <div className="cm-card">
                <div className="cm-card-title">Digital Assets <span className="cm-card-title-count">{assets.length}</span></div>
                {assets.length === 0 ? (
                    <div className="cm-empty">No digital assets collected yet.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>Type</th><th>Value</th><th>Source</th><th>First Seen</th><th>Last Seen</th><th>Confidence</th><th>Risk</th></tr></thead>
                            <tbody>
                                {assets.map((a, i) => (
                                    <tr key={i}>
                                        <td>{a.assetType}</td><td className="cm-mono"><span className="cm-truncate">{a.value}</span></td>
                                        <td>{a.source || '—'}</td>
                                        <td>{a.firstSeen ? timeAgo(a.firstSeen) : '—'}</td>
                                        <td>{a.lastSeen ? timeAgo(a.lastSeen) : '—'}</td>
                                        <td><ConfidenceBadge confidence={a.confidence} /></td>
                                        <td><RiskBadge risk={a.risk} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §13 — Employees & People */}
            <PeopleSection companyId={companyId} people={people} onChanged={load} />

            {/* §14 — Social Media */}
            <SocialSection companyId={companyId} social={social} onChanged={load} />

            {/* §16/§17 — Email Intelligence + Breach & Exposure */}
            <EmailSection companyId={companyId} emails={emails} exposedEmails={exposedEmails} onChanged={load} onNavigateToModule={onNavigateToModule} />

            {/* §18 — Brand Presence */}
            <div className="cm-card">
                <div className="cm-card-title">Brand Presence</div>
                {!brandPresence?.linkedBrand ? (
                    <div className="cm-empty">No matching Brand Intelligence profile found for this company. Source could not be verified.</div>
                ) : (
                    <>
                        <div className="cm-kv" style={{ marginBottom: '12px' }}>
                            <span className="k">Linked Brand</span><span className="v">{brandPresence.linkedBrand.name}</span>
                        </div>
                        <div className="cm-modal-subtitle" style={{ marginBottom: '6px' }}>Official Identities ({brandPresence.officialIdentities.length})</div>
                        {brandPresence.officialIdentities.length === 0 ? <div className="cm-section-empty">None on record.</div> : (
                            <div className="cm-chip-list" style={{ marginBottom: '14px' }}>
                                {brandPresence.officialIdentities.map((id, i) => <span key={i} className="cm-chip">{id.type}: {id.value}</span>)}
                            </div>
                        )}
                        <div className="cm-modal-subtitle" style={{ marginBottom: '6px' }}>Suspicious / Lookalike Candidates ({brandPresence.suspiciousCandidates.length})</div>
                        {brandPresence.suspiciousCandidates.length === 0 ? <div className="cm-empty">None found.</div> : (
                            <div className="cm-table-wrap">
                                <table className="cm-table">
                                    <thead><tr><th>Value</th><th>Type</th><th>Risk</th><th>Discovered</th></tr></thead>
                                    <tbody>
                                        {brandPresence.suspiciousCandidates.map((c) => (
                                            <tr key={c.id}><td className="cm-mono">{c.value}</td><td>{c.candidateType}</td><td><RiskBadge risk={c.riskLevel} /></td><td>{c.discoveredAt ? timeAgo(c.discoveredAt) : '—'}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* §19 — Related Companies */}
            <RelatedCompaniesSection companyId={companyId} relationships={relationships} onChanged={load} />

            {/* §20 — Threat Intelligence */}
            <div className="cm-card">
                <div className="cm-card-title">Threat Intelligence <span className="cm-card-title-count">{threatIntel.length}</span></div>
                {threatIntel.length === 0 ? (
                    <div className="cm-empty">No threat intelligence relationships found for this company's known infrastructure yet.</div>
                ) : (
                    <div className="cm-table-wrap">
                        <table className="cm-table">
                            <thead><tr><th>Type</th><th>Entity</th><th>Relationship</th><th>Basis</th><th>Confidence</th></tr></thead>
                            <tbody>
                                {threatIntel.map((r) => (
                                    <tr key={r.id}>
                                        <td style={{ textTransform: 'capitalize' }}>{r.entity.type.replace(/_/g, ' ')}</td>
                                        <td>{r.entity.label}</td>
                                        <td>{r.relationship_type.replace(/_/g, ' ')}</td>
                                        <td style={{ textTransform: 'capitalize' }}>{r.basis}</td>
                                        <td><ConfidenceBadge confidence={r.confidence} /></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* §21 — Risk Assessment (reused as-is) */}
            <div className="cm-card">
                <div className="cm-card-title">Risk Assessment</div>
                <RiskAssessmentBlock entityType="company" entityId={company.id} />
            </div>

            {/* §22 — Relationship Graph (reused as-is) */}
            <div className="cm-card">
                <div className="cm-card-title">Relationship Graph</div>
                {graph ? <RelationshipGraphViz data={graph} onNodeOpen={(type, id) => onOpenEntity?.(type, id)} /> : <div className="cm-empty">No relationships to graph yet.</div>}
            </div>

            {/* §23 — Timeline */}
            <div className="cm-card">
                <div className="cm-card-title">Timeline <span className="cm-card-title-count">{timeline.length}</span></div>
                {timeline.length === 0 ? (
                    <div className="cm-empty">No activity recorded yet.</div>
                ) : (
                    timeline.map((t) => (
                        <div key={t.id} className="cm-timeline-item">
                            <div className="cm-timeline-dot" />
                            <div className="cm-timeline-content">
                                <span className="cm-timeline-action">{t.action.replace(/_/g, ' ')}</span>
                                {t.newValue && <span> — {t.newValue}</span>}
                                <div className="cm-timeline-meta">{t.source || 'System'}{t.username ? ` · ${t.username}` : ''} · {t.createdAt ? timeAgo(t.createdAt) : ''}</div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* §24 — AI Intelligence Summary */}
            <AiSummarySection companyId={companyId} />

            {showEdit && <EditCompanyModal company={company} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); load(); }} />}
            {confirmDelete && <ConfirmDialog title="Delete company?" message="This will remove the company and its collected metadata from Company Intelligence. This action cannot be undone from this screen." onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />}
        </div>
    );
};

function TechnologyStackSection({ technologies }: { technologies: CompanyTechnology[] }) {
    const [expanded, setExpanded] = useState<Set<number>>(new Set());
    const toggle = (id: number) => setExpanded((s) => { const next = new Set(s); if (next.has(id)) next.delete(id); else next.add(id); return next; });
    return (
        <div className="cm-card">
            <div className="cm-card-title">Technology Stack <span className="cm-card-title-count">{technologies.length}</span></div>
            {technologies.length === 0 ? (
                <div className="cm-empty">No technology signatures matched this site.</div>
            ) : (
                <div className="cm-table-wrap">
                    <table className="cm-table">
                        <thead><tr><th></th><th>Technology</th><th>Category</th><th>Confidence</th><th>Evidence</th><th>Source</th><th>First Seen</th><th>Last Seen</th></tr></thead>
                        <tbody>
                            {technologies.map((t) => (
                                <React.Fragment key={t.id}>
                                    <tr>
                                        <td>
                                            {t.evidence.length > 0 && (
                                                <button type="button" className="cm-btn cm-btn--sm" onClick={() => toggle(t.id)} aria-expanded={expanded.has(t.id)}>
                                                    {expanded.has(t.id) ? '▾' : '▸'}
                                                </button>
                                            )}
                                        </td>
                                        <td>{t.technology}</td><td>{t.category || '—'}</td>
                                        <td><ConfidenceBadge confidence={t.confidence} /></td>
                                        <td>{t.evidence.length} signal{t.evidence.length === 1 ? '' : 's'}</td>
                                        <td>{t.source || '—'}</td>
                                        <td>{t.firstSeenAt ? timeAgo(t.firstSeenAt) : '—'}</td>
                                        <td>{t.lastSeenAt ? timeAgo(t.lastSeenAt) : '—'}</td>
                                    </tr>
                                    {expanded.has(t.id) && t.evidence.length > 0 && (
                                        <tr className="cm-evidence-row">
                                            <td></td>
                                            <td colSpan={7}>
                                                <ul className="cm-ai-list" style={{ margin: 0 }}>
                                                    {t.evidence.map((e, i) => <li key={i}>{e}</li>)}
                                                </ul>
                                            </td>
                                        </tr>
                                    )}
                                </React.Fragment>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function PeopleSection({ companyId, people, onChanged }: { companyId: number; people: CompanyPerson[]; onChanged: () => void }) {
    const [name, setName] = useState(''); const [jobTitle, setJobTitle] = useState(''); const [category, setCategory] = useState('associated');
    const [busy, setBusy] = useState(false);
    const add = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try { await apiAddCompanyPerson(companyId, { name: name.trim(), jobTitle: jobTitle.trim() || undefined, category }); setName(''); setJobTitle(''); onChanged(); } finally { setBusy(false); }
    };
    return (
        <div className="cm-card">
            <div className="cm-card-title">Employees &amp; People <span className="cm-card-title-count">{people.length}</span></div>
            {people.length === 0 ? <div className="cm-empty">No people on record. No scraper exists for this — add publicly available professional information manually.</div> : (
                <div className="cm-table-wrap">
                    <table className="cm-table">
                        <thead><tr><th>Name</th><th>Job Title</th><th>Category</th><th>Source</th><th>Confidence</th><th></th></tr></thead>
                        <tbody>
                            {people.map((p) => (
                                <tr key={p.id}>
                                    <td>{p.profileUrl ? <a href={p.profileUrl} target="_blank" rel="noopener noreferrer">{p.name}</a> : p.name}</td>
                                    <td>{p.jobTitle || '—'}</td><td style={{ textTransform: 'capitalize' }}>{p.category}</td><td>{p.source || '—'}</td>
                                    <td><ConfidenceBadge confidence={p.confidence} /></td>
                                    <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => apiDeleteCompanyPerson(companyId, p.id).then(onChanged)}>Remove</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="cm-inline-form">
                <input type="text" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
                <input type="text" placeholder="Job title (optional)" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} />
                <select value={category} onChange={(e) => setCategory(e.target.value)}>
                    <option value="executive">Executive</option><option value="director">Director</option>
                    <option value="employee">Employee</option><option value="associated">Publicly Associated</option>
                </select>
                <button type="button" className="cm-btn cm-btn--sm" onClick={add} disabled={busy || !name.trim()}>Add Person</button>
            </div>
        </div>
    );
}

function SocialSection({ companyId, social, onChanged }: { companyId: number; social: CompanySocialAccount[]; onChanged: () => void }) {
    return (
        <div className="cm-card">
            <div className="cm-card-title">Social Media <span className="cm-card-title-count">{social.length}</span></div>
            {social.length === 0 ? (
                <div className="cm-empty">No social media accounts discovered under this company's name.</div>
            ) : (
                <div className="cm-table-wrap">
                    <table className="cm-table">
                        <thead><tr><th>Platform</th><th>Username</th><th>Verification</th><th>Source</th><th>Confidence</th><th>Last Seen</th><th></th></tr></thead>
                        <tbody>
                            {social.map((s) => (
                                <tr key={s.id}>
                                    <td>{s.platform}</td>
                                    <td>{s.profileUrl ? <a href={s.profileUrl} target="_blank" rel="noopener noreferrer">{s.username}</a> : s.username}</td>
                                    <td><span className={`cm-badge cm-badge--${s.verificationStatus.toLowerCase()}`}>{s.verificationStatus}</span></td>
                                    <td>{s.source || '—'}</td><td><ConfidenceBadge confidence={s.confidence} /></td>
                                    <td>{s.lastSeenAt ? timeAgo(s.lastSeenAt) : '—'}</td>
                                    <td>
                                        {s.verificationStatus !== 'Confirmed' && (
                                            <button type="button" className="cm-btn cm-btn--sm" onClick={() => updateCompanySocialAccountVerification(companyId, s.id, 'Confirmed').then(onChanged)}>Mark Confirmed</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function EmailSection({ companyId, emails, exposedEmails, onChanged, onNavigateToModule }: {
    companyId: number; emails: CompanyEmail[]; exposedEmails: CompanyEmail[]; onChanged: () => void; onNavigateToModule?: (moduleId: string, targetValue?: string) => void;
}) {
    const [email, setEmail] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
    const add = async () => {
        if (!email.trim()) return;
        setBusy(true); setError(null);
        try { await apiAddCompanyEmail(companyId, email.trim()); setEmail(''); onChanged(); } catch (err: any) { setError(err?.message || 'Failed to add email.'); } finally { setBusy(false); }
    };
    return (
        <div className="cm-card">
            <div className="cm-card-title">Email Intelligence &amp; Breach / Exposure <span className="cm-card-title-count">{emails.length} email(s), {exposedEmails.length} exposed</span></div>
            {emails.length === 0 ? (
                <div className="cm-empty">No email addresses linked yet.</div>
            ) : (
                <div className="cm-table-wrap">
                    <table className="cm-table">
                        <thead><tr><th>Email</th><th>Source</th><th>Confidence</th><th>Breach Exposures</th><th>Latest Exposure</th><th colSpan={2}></th></tr></thead>
                        <tbody>
                            {emails.map((e) => (
                                <tr key={e.id}>
                                    <td className="cm-mono">{e.email}</td><td>{e.source || '—'}</td><td><ConfidenceBadge confidence={e.confidence} /></td>
                                    <td>{e.breachTotalExposures != null ? e.breachTotalExposures : 'Not checked'}</td>
                                    <td>{e.breachLatestExposure ? formatDateTime(e.breachLatestExposure) : '—'}</td>
                                    <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => onNavigateToModule?.('email', e.email)}>Open in Email Intel</button></td>
                                    <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => apiDeleteCompanyEmail(companyId, e.id).then(onChanged)}>Remove</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="cm-inline-form">
                <input type="email" placeholder="employee@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button type="button" className="cm-btn cm-btn--sm" onClick={add} disabled={busy || !email.trim()}>{busy ? 'Checking…' : 'Add & Check Exposure'}</button>
            </div>
            {error && <div className="cm-error" style={{ marginTop: '8px' }}>{error}</div>}
            <div className="cm-field-hint" style={{ marginTop: '8px', fontSize: '0.76rem', color: 'rgba(148,163,184,0.75)' }}>
                Never displays plaintext passwords or credentials — breach data is exposure counts/dates/sources only.
            </div>
        </div>
    );
}

function RelatedCompaniesSection({ companyId, relationships, onChanged }: { companyId: number; relationships: CompanyRelationship[]; onChanged: () => void }) {
    const [type, setType] = useState('associated'); const [name, setName] = useState(''); const [busy, setBusy] = useState(false);
    const add = async () => {
        if (!name.trim()) return;
        setBusy(true);
        try { await apiAddCompanyRelationship(companyId, { relationshipType: type, relatedEntityName: name.trim() }); setName(''); onChanged(); } finally { setBusy(false); }
    };
    return (
        <div className="cm-card">
            <div className="cm-card-title">Related Companies <span className="cm-card-title-count">{relationships.length}</span></div>
            {relationships.length === 0 ? <div className="cm-empty">No related companies on record.</div> : (
                <div className="cm-table-wrap">
                    <table className="cm-table">
                        <thead><tr><th>Relationship</th><th>Entity</th><th>Source</th><th>Confidence</th><th></th></tr></thead>
                        <tbody>
                            {relationships.map((r) => (
                                <tr key={r.id}>
                                    <td style={{ textTransform: 'capitalize' }}>{r.relationshipType}</td><td>{r.relatedEntityName}</td>
                                    <td>{r.source || '—'}</td><td><ConfidenceBadge confidence={r.confidence} /></td>
                                    <td><button type="button" className="cm-btn cm-btn--sm" onClick={() => apiDeleteCompanyRelationship(companyId, r.id).then(onChanged)}>Remove</button></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
            <div className="cm-inline-form">
                <select value={type} onChange={(e) => setType(e.target.value)}>
                    {RELATIONSHIP_TYPES.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
                </select>
                <input type="text" placeholder="Related organization name" value={name} onChange={(e) => setName(e.target.value)} />
                <button type="button" className="cm-btn cm-btn--sm" onClick={add} disabled={busy || !name.trim()}>Add Relationship</button>
            </div>
        </div>
    );
}

function AiSummarySection({ companyId }: { companyId: number }) {
    const [result, setResult] = useState<{ evidence: any; aiSummary: CompanyAiSummary } | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const generate = async () => {
        setLoading(true); setError(null);
        try { setResult(await getCompanyAiSummary(companyId)); } catch (err: any) { setError(err?.message || 'Failed to generate summary.'); } finally { setLoading(false); }
    };

    return (
        <div className="cm-card">
            <div className="cm-card-title">
                AI Intelligence Summary
                <button type="button" className="cm-btn cm-btn--sm" onClick={generate} disabled={loading}>{loading ? 'Generating…' : result ? 'Regenerate' : 'Generate Summary'}</button>
            </div>
            {error && <div className="cm-error">{error}</div>}
            {!result && !loading && !error && <div className="cm-empty">Generate an AI summary of everything collected above — it only summarizes real, already-observed evidence and never invents findings.</div>}
            {result && (
                <div className="cm-ai-section">
                    <div>
                        <span className="cm-interpretation-tag">AI Interpretation</span>
                        <p style={{ margin: '4px 0 0', fontSize: '0.88rem', color: 'rgba(224,224,224,0.92)' }}>{result.aiSummary.executiveSummary}</p>
                    </div>
                    {result.aiSummary.keyFindings.length > 0 && (
                        <div><div className="cm-ai-block-title">Key Findings</div><ul className="cm-ai-list">{result.aiSummary.keyFindings.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.aiSummary.riskFactors.length > 0 && (
                        <div><div className="cm-ai-block-title">Risk Factors</div><ul className="cm-ai-list">{result.aiSummary.riskFactors.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.aiSummary.importantRelationships.length > 0 && (
                        <div><div className="cm-ai-block-title">Important Relationships</div><ul className="cm-ai-list">{result.aiSummary.importantRelationships.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.aiSummary.notableExposure.length > 0 && (
                        <div><div className="cm-ai-block-title">Notable Exposure</div><ul className="cm-ai-list">{result.aiSummary.notableExposure.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    {result.aiSummary.recommendedActions.length > 0 && (
                        <div><div className="cm-ai-block-title">Recommended Analyst Actions</div><ul className="cm-ai-list">{result.aiSummary.recommendedActions.map((f, i) => <li key={i}>{f}</li>)}</ul></div>
                    )}
                    <div>
                        <span className="cm-evidence-tag">Observed Evidence</span>
                        <p className="cm-ai-note">{result.evidence.domainCount} domain(s), {result.evidence.ipCount} IP(s), {result.evidence.subdomainCount} subdomain(s), {result.evidence.technologyCount} technolog(y/ies), {result.evidence.peopleCount} people, {result.evidence.socialAccountCount} social account(s), {result.evidence.exposureCount} exposed email(s).</p>
                    </div>
                    <div className="cm-ai-note">{result.aiSummary.note}</div>
                </div>
            )}
        </div>
    );
}

export default CompanyIntelligenceHome;
