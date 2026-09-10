// SHADOWSERVER_INTEGRATION_PLAN.md Phase 4 — the restricted shell a
// client-scoped account sees INSTEAD of the full admin/analyst app
// (App.tsx renders this in place of AppShell entirely, never alongside
// it — see App.tsx's own comment on isClientScoped). No sidebar, no nav to
// any other module: this page IS the whole app for a client account.
//
// Read-mostly by design: credentials, watched-range management, and the
// confirmed_real ingestion gate stay admin-only (those routes 403 for a
// client-scoped caller regardless, but this UI doesn't even offer them) —
// a client sees their own findings and ranges, and can resolve a finding,
// nothing else. Onboarding these accounts happens from ClientsPage.tsx's
// "Create client contact" action; this page is what the account they
// create actually lands on.
import { useEffect, useState } from 'react';
import './ClientPortalPage.css';
import {
    getMyClients, getShadowserverFindings, getShadowserverRanges, resolveShadowserverFinding,
    // SHADOWSERVER_INTEGRATION_PLAN.md §5's confirmed rollout order — Cases
    // is the platform-wide primitive's second consumer; list-only, minimal
    // fields (see database/investigationStorage.js's getCasesForClient()).
    getCasesForClient,
    // Evidence, via case inheritance — expand-on-demand per case row, never
    // a standalone cross-case browse (see getCaseEvidenceForClient()'s header).
    getCaseEvidenceForClient,
    // Reports, via case inheritance — published-only deliverables (see
    // getReportsForClient()/getReportForClient()'s header).
    getReportsForClient, getReportForClient,
    // IOC — a narrow corroboration enrichment on findings the client
    // already sees, never a new browsable indicator list (see
    // getIocCorroborationForFindings()'s own header).
    getIocCorroboration,
    // MITRE — the same narrow-enrichment shape, never a client-scoped
    // MITRE Mapper surface (see getMitreMappingsForFindings()'s own
    // header). Applies to exposure-category findings too, unlike
    // corroboration above.
    getMitreMappingsForFindings,
    // MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 3 — which CTI
    // services THIS client is actually entitled to. Cases/Evidence/Reports
    // above are core platform modules, not CTI provider integrations, so
    // they stay unconditional; only the Shadowserver-sourced sections below
    // (findings, ranges, IOC corroboration, MITRE mappings) are gated by
    // this — and the backend enforces the same gate independently (plan
    // §11/§13: frontend hiding here is a UX nicety, never the real boundary).
    getClientServiceEntitlements,
    type PlatformClient, type ShadowserverFinding, type ShadowserverRange, type ClientCaseSummary, type ClientCaseEvidence,
    type ClientReportSummary, type ClientReportDetail, type IocCorroboration, type MitreFindingMapping
} from '../../services/api';

interface ClientPortalPageProps {
    user: { username?: string } | null;
    onLogout: () => void;
}

export default function ClientPortalPage({ user, onLogout }: ClientPortalPageProps) {
    const [clients, setClients] = useState<PlatformClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [findings, setFindings] = useState<ShadowserverFinding[]>([]);
    const [ranges, setRanges] = useState<ShadowserverRange[]>([]);
    const [cases, setCases] = useState<ClientCaseSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [expandedCaseId, setExpandedCaseId] = useState<number | null>(null);
    const [caseEvidence, setCaseEvidence] = useState<ClientCaseEvidence[]>([]);
    const [reports, setReports] = useState<ClientReportSummary[]>([]);
    const [openReport, setOpenReport] = useState<ClientReportDetail | null>(null);
    const [corroboration, setCorroboration] = useState<Record<number, IocCorroboration>>({});
    const [mitreMappings, setMitreMappings] = useState<Record<number, MitreFindingMapping>>({});
    const [enabledServices, setEnabledServices] = useState<Set<string>>(new Set());
    const shadowserverEnabled = enabledServices.has('shadowserver');

    useEffect(() => {
        getMyClients()
            .then((data) => {
                setClients(data);
                if (data.length) setSelectedClientId(data[0].id);
            })
            .catch((e) => setError(e?.message || 'Failed to load your client organization'))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        if (selectedClientId == null) return;
        // Reset per-service state on every client switch so a multi-client
        // user never briefly sees the PREVIOUS client's Shadowserver section
        // while the new client's own entitlement check is still in flight.
        setFindings([]); setRanges([]); setCorroboration({}); setMitreMappings({});
        setEnabledServices(new Set());

        // Cases/Evidence/Reports are core platform modules, not CTI
        // services — always fetched, never entitlement-gated (plan §3's
        // "not every service" rule is about CTI provider integrations
        // specifically).
        getCasesForClient(selectedClientId, { pageSize: 50 })
            .then((casesPage) => setCases(casesPage.items))
            .catch((e) => setError(e?.message || 'Failed to load your cases'));
        getReportsForClient(selectedClientId, { pageSize: 50 })
            .then((reportsPage) => setReports(reportsPage.items))
            .catch((e) => setError(e?.message || 'Failed to load your reports'));

        // Which CTI services this client is actually entitled to — fetched
        // first, so the Shadowserver-sourced calls below are only ever made
        // when there is real access to show for them (the backend enforces
        // the same gate independently either way, plan §11/§13).
        getClientServiceEntitlements(selectedClientId)
            .then((entitlements) => {
                const enabled = new Set(entitlements.filter((s) => s.entitlementStatus === 'enabled').map((s) => s.serviceKey));
                setEnabledServices(enabled);
                if (!enabled.has('shadowserver')) return;

                Promise.all([
                    getShadowserverFindings({ clientId: selectedClientId, pageSize: 50 }),
                    getShadowserverRanges(selectedClientId)
                ])
                    .then(([findingsPage, rngs]) => {
                        setFindings(findingsPage.items);
                        setRanges(rngs);
                        // Corroboration is only ever meaningful for indicator-
                        // category findings (only those become a real IOC) —
                        // fetched as one batch call, never per-row.
                        const indicatorIds = findingsPage.items.filter((f) => f.category === 'indicator').map((f) => f.id);
                        if (indicatorIds.length) {
                            getIocCorroboration(indicatorIds).then(setCorroboration).catch(() => {});
                        }
                        // MITRE technique tagging keys on report type, not
                        // category — an exposure-category finding (e.g.
                        // Accessible-RDP) can have a real mapping too, so
                        // every finding id is checked.
                        const allFindingIds = findingsPage.items.map((f) => f.id);
                        if (allFindingIds.length) {
                            getMitreMappingsForFindings(allFindingIds).then(setMitreMappings).catch(() => {});
                        }
                    })
                    .catch((e) => setError(e?.message || 'Failed to load your Shadowserver data'));
            })
            .catch((e) => setError(e?.message || 'Failed to load your service entitlements'));
    }, [selectedClientId]);

    const openReportDetail = async (reportId: number) => {
        if (selectedClientId == null) return;
        try {
            setOpenReport(await getReportForClient(selectedClientId, reportId));
        } catch (e: any) {
            setError(e?.message || 'Failed to load report');
        }
    };

    const handleResolve = async (findingId: number) => {
        try {
            await resolveShadowserverFinding(findingId);
            if (selectedClientId != null) {
                const page = await getShadowserverFindings({ clientId: selectedClientId, pageSize: 50 });
                setFindings(page.items);
            }
        } catch (e: any) {
            setError(e?.message || 'Failed to resolve finding');
        }
    };

    const toggleCaseEvidence = async (caseId: number) => {
        if (expandedCaseId === caseId) { setExpandedCaseId(null); return; }
        setExpandedCaseId(caseId);
        if (selectedClientId == null) return;
        try {
            setCaseEvidence(await getCaseEvidenceForClient(selectedClientId, caseId));
        } catch (e: any) {
            setError(e?.message || 'Failed to load evidence');
        }
    };

    const selectedClient = clients.find((c) => c.id === selectedClientId) || null;

    return (
        <div className="client-portal">
            <header className="client-portal-header">
                <div className="client-portal-brand">
                    <span className="client-portal-logo">LekirraX</span>
                    <span className="client-portal-subtitle">Client Portal</span>
                </div>
                <div className="client-portal-header-right">
                    {clients.length > 1 && (
                        <select
                            value={selectedClientId ?? ''}
                            onChange={(e) => setSelectedClientId(Number(e.target.value))}
                        >
                            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    )}
                    <span className="client-portal-username">{user?.username}</span>
                    <button className="client-portal-logout" onClick={onLogout}>Log out</button>
                </div>
            </header>

            <main className="client-portal-content">
                {loading ? (
                    <div className="client-portal-loading">Loading…</div>
                ) : clients.length === 0 ? (
                    <div className="client-portal-empty">
                        <h2>No client organization assigned yet</h2>
                        <p>Your account isn't linked to a client organization. Contact your LekirraX administrator.</p>
                    </div>
                ) : (
                    <>
                        <h1>{selectedClient?.name}</h1>
                        {error && <div className="client-portal-error">{error}</div>}

                        <section className="client-portal-section">
                            <h2>Cases</h2>
                            <ul className="client-portal-list">
                                {cases.map((c) => (
                                    <li key={c.id} className="client-portal-case-row">
                                        <div className="client-portal-case-row-main">
                                            <span>{c.case_number} — {c.title} <span className="client-portal-case-status">({c.status})</span></span>
                                            <span className={`client-portal-severity ${c.severity.toLowerCase()}`}>{c.severity}</span>
                                            <button onClick={() => toggleCaseEvidence(c.id)}>
                                                {expandedCaseId === c.id ? 'Hide evidence' : 'View evidence'}
                                            </button>
                                        </div>
                                        {expandedCaseId === c.id && (
                                            <ul className="client-portal-evidence-list">
                                                {caseEvidence.map((e) => (
                                                    <li key={e.id}>
                                                        <span className="client-portal-evidence-source">{e.source}</span>
                                                        {e.description && <span>{e.description}</span>}
                                                        {e.url && <a href={e.url} target="_blank" rel="noreferrer">Link</a>}
                                                    </li>
                                                ))}
                                                {caseEvidence.length === 0 && <li className="client-portal-empty-row">No evidence yet.</li>}
                                            </ul>
                                        )}
                                    </li>
                                ))}
                                {cases.length === 0 && <li className="client-portal-empty-row">No cases yet.</li>}
                            </ul>
                        </section>

                        <section className="client-portal-section">
                            <h2>Reports</h2>
                            <ul className="client-portal-list">
                                {reports.map((r) => (
                                    <li key={r.id}>
                                        <span>{r.title} <span className="client-portal-case-status">({r.caseNumber})</span></span>
                                        <button onClick={() => openReportDetail(r.id)}>View</button>
                                    </li>
                                ))}
                                {reports.length === 0 && <li className="client-portal-empty-row">No published reports yet.</li>}
                            </ul>
                            {openReport && (
                                <div className="client-portal-report-detail">
                                    <div className="client-portal-report-detail-header">
                                        <h3>{openReport.title}</h3>
                                        <button onClick={() => setOpenReport(null)}>Close</button>
                                    </div>
                                    {openReport.narrative.executiveSummary && <p><strong>Executive Summary</strong><br />{openReport.narrative.executiveSummary}</p>}
                                    {openReport.narrative.keyFindingsNarrative && <p><strong>Key Findings</strong><br />{openReport.narrative.keyFindingsNarrative}</p>}
                                    {openReport.narrative.recommendations && <p><strong>Recommendations</strong><br />{openReport.narrative.recommendations}</p>}
                                    {openReport.narrative.conclusion && <p><strong>Conclusion</strong><br />{openReport.narrative.conclusion}</p>}
                                </div>
                            )}
                        </section>

                        {/* MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md
                            Phase 3 — Shadowserver-sourced sections render
                            only when THIS client is actually entitled to the
                            service (plan §13's own example: a client not
                            entitled to a CTI service simply doesn't see its
                            section at all, never an error or an empty-by-
                            omission table that reads as "just no data yet").
                            The backend enforces the identical gate
                            independently (plan §11), so an absent section
                            here is a UX nicety, not the real boundary. */}
                        {shadowserverEnabled ? (
                            <>
                                <section className="client-portal-section">
                                    <h2>Watched ranges</h2>
                                    <ul className="client-portal-list">
                                        {ranges.filter((r) => r.active).map((r) => (
                                            <li key={r.id}>
                                                {r.cidr} {r.label ? `(${r.label})` : ''}
                                                <span className={`client-portal-badge ${r.confirmedReal ? 'ready' : 'pending'}`}>
                                                    {r.confirmedReal ? 'Monitoring active' : 'Pending confirmation'}
                                                </span>
                                            </li>
                                        ))}
                                        {ranges.filter((r) => r.active).length === 0 && (
                                            <li className="client-portal-empty-row">No ranges configured yet.</li>
                                        )}
                                    </ul>
                                </section>

                                <section className="client-portal-section">
                                    <h2>Findings</h2>
                                    <div className="client-portal-table">
                                        <div className="client-portal-thead">
                                            <div>Report type</div><div>Category</div><div>Target</div><div>Severity</div><div>Status</div><div>Actions</div>
                                        </div>
                                        {findings.map((f) => {
                                            const corr = f.category === 'indicator' ? corroboration[f.id] : undefined;
                                            const mitre = mitreMappings[f.id];
                                            return (
                                                <div className="client-portal-tr" key={f.id}>
                                                    <div>{f.reportType}</div>
                                                    <div>{f.category}</div>
                                                    <div>
                                                        {f.ip || f.hostname || '—'}{f.port ? `:${f.port}` : ''}
                                                        {corr && (
                                                            <div className="client-portal-corroboration">
                                                                {corr.corroboratedByOtherSources ? (
                                                                    <span className="client-portal-badge ready">
                                                                        Corroborated by {corr.otherSourceCount} other source{corr.otherSourceCount === 1 ? '' : 's'}
                                                                    </span>
                                                                ) : (
                                                                    <span className="client-portal-badge pending">Shadowserver only</span>
                                                                )}
                                                                {(corr.threatCategory || corr.risk || corr.confidence) && (
                                                                    <span className="client-portal-corroboration-detail">
                                                                        {[corr.threatCategory, corr.risk && `risk: ${corr.risk}`, corr.confidence && `confidence: ${corr.confidence}`]
                                                                            .filter(Boolean).join(' · ')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        )}
                                                        {mitre && (
                                                            <div className="client-portal-corroboration">
                                                                <span className={`client-portal-badge ${mitre.confirmed ? 'ready' : 'pending'}`}>
                                                                    {mitre.techniqueId} — {mitre.techniqueName}
                                                                </span>
                                                                {mitre.tactics.length > 0 && (
                                                                    <span className="client-portal-corroboration-detail">{mitre.tactics.join(' · ')}</span>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div><span className={`client-portal-severity ${f.severity}`}>{f.severity}</span></div>
                                                    <div>{f.status}</div>
                                                    <div>
                                                        {f.status !== 'resolved' && (
                                                            <button onClick={() => handleResolve(f.id)}>Resolve</button>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {findings.length === 0 && <div className="client-portal-empty-row">No findings yet.</div>}
                                    </div>
                                </section>
                            </>
                        ) : (
                            <section className="client-portal-section">
                                <h2>Threat Intelligence</h2>
                                <p className="client-portal-empty-row">
                                    Your organization isn't currently subscribed to any threat intelligence service.
                                    Contact your LekirraX administrator to enable one.
                                </p>
                            </section>
                        )}
                    </>
                )}
            </main>
        </div>
    );
}
