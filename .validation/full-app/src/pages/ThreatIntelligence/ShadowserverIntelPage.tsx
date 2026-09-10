// MULTI_SERVICE_CTI_ENTITLEMENT_ARCHITECTURE_PLAN.md Phase 1 — the
// Shadowserver INTELLIGENCE experience (findings, trend), moved out of
// Administration -> Clients per plan §4/§8/§11: that page keeps only
// organization/membership/entitlement/credential configuration now (see
// ClientsPage.tsx's own header). This page is what "Threat Intelligence ->
// Shadowserver" actually shows admin/staff — findings, dashboards, search —
// never duplicated back into Clients.
//
// Backend enforcement (requireServiceEntitlement in server.js) remains
// authoritative regardless of what this page renders — an admin/staff
// viewer bypasses entitlement entirely (plan §4), so this page is reachable
// unconditionally from the sidebar the same way MITRE Mapper/Malware
// Analysis are; a client-scoped account never reaches this page at all
// (routed into ClientPortalPage.tsx instead, plan §11).
import { useEffect, useState } from 'react';
import './ShadowserverIntelPage.css';
import MultiSeriesChart from '../../components/MultiSeriesChart';
import {
    getClients, getShadowserverFindings, resolveShadowserverFinding, getShadowserverTrend, getShadowserverReadiness,
    type PlatformClient, type ShadowserverFinding, type ShadowserverTrend, type ShadowserverReadiness
} from '../../services/api';

export default function ShadowserverIntelPage() {
    const [clients, setClients] = useState<PlatformClient[]>([]);
    const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
    const [findings, setFindings] = useState<ShadowserverFinding[]>([]);
    const [trend, setTrend] = useState<ShadowserverTrend | null>(null);
    const [readiness, setReadiness] = useState<ShadowserverReadiness | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        getClients()
            .then((data) => {
                setClients(data);
                if (data.length) setSelectedClientId(data[0].id);
            })
            .catch((e) => setError(e?.message || 'Failed to load clients'))
            .finally(() => setLoading(false));
    }, []);

    const reload = async (clientId: number) => {
        try {
            const [findingsPage, trendData, ready] = await Promise.all([
                getShadowserverFindings({ clientId, pageSize: 50 }),
                getShadowserverTrend(clientId, 30),
                getShadowserverReadiness(clientId).catch(() => null) // admin-only; a non-admin viewer here shouldn't happen, but degrade gracefully
            ]);
            setFindings(findingsPage.items);
            setTrend(trendData);
            setReadiness(ready);
        } catch (e: any) {
            // A client with no Shadowserver entitlement yet surfaces here as
            // an explicit 403 (entitlement_denied) — shown plainly rather
            // than a silent empty state, matching plan §13.
            setError(e?.message || 'Failed to load Shadowserver data');
        }
    };

    useEffect(() => {
        if (selectedClientId != null) reload(selectedClientId);
    }, [selectedClientId]);

    const handleResolve = async (id: number) => {
        if (!selectedClientId) return;
        try {
            await resolveShadowserverFinding(id);
            reload(selectedClientId);
        } catch (e: any) {
            setError(e?.message || 'Failed to resolve finding');
        }
    };

    if (loading) return <div className="ssintel-loading">Loading…</div>;

    return (
        <div className="ssintel-page">
            <header className="ssintel-header">
                <h1>Shadowserver</h1>
                <p>Exposure and indicator findings, per client. Credentials, watched ranges, and service entitlement are managed under Administration → Clients.</p>
            </header>

            {error && <div className="ssintel-error">{error}</div>}

            <div className="ssintel-toolbar">
                <label>Client:&nbsp;</label>
                <select value={selectedClientId ?? ''} onChange={(e) => setSelectedClientId(Number(e.target.value))}>
                    {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                {readiness && (
                    <span className={`ssintel-badge ${readiness.ready ? 'ready' : 'not-ready'}`}>
                        {readiness.ready ? 'Ingestion ready' : `Not ready — ${readiness.reason}`}
                    </span>
                )}
            </div>

            <section className="ssintel-section">
                <h2>Findings trend (last 30 days)</h2>
                {trend && (
                    <MultiSeriesChart
                        series={[
                            { label: 'New — Indicator', color: 'var(--ui-critical, #ff0055)', points: trend.newIndicator },
                            { label: 'New — Exposure', color: 'var(--ui-warning, #f59e0b)', points: trend.newExposure },
                            { label: 'Resolved', color: 'var(--ui-success, #10b981)', points: trend.resolved }
                        ]}
                        emptyText="No findings in the last 30 days yet."
                    />
                )}
            </section>

            <section className="ssintel-section">
                <h2>Findings</h2>
                <div className="ssintel-table">
                    <div className="ssintel-thead">
                        <div>Report type</div><div>Category</div><div>Target</div><div>Severity</div><div>Status</div><div>Actions</div>
                    </div>
                    {findings.map((f) => (
                        <div className="ssintel-tr" key={f.id}>
                            <div>{f.reportType}</div>
                            <div>{f.category}</div>
                            <div>{f.ip || f.hostname || '—'}{f.port ? `:${f.port}` : ''}</div>
                            <div><span className={`ssintel-severity ${f.severity}`}>{f.severity}</span></div>
                            <div>{f.status}</div>
                            <div>
                                {f.status !== 'resolved' && <button onClick={() => handleResolve(f.id)}>Resolve</button>}
                            </div>
                        </div>
                    ))}
                    {findings.length === 0 && <div className="ssintel-empty">No findings for this client yet.</div>}
                </div>
            </section>
        </div>
    );
}
