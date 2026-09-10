import React, { useCallback, useEffect, useState } from 'react';
import { getCorrelationDashboard, getRelationshipGraph, type CorrelationDashboard, type RelationshipGraph as GraphData } from '../../../services/api';
import { EntityChip, formatDateTime } from '../ThreatIntelligenceShared';
import RelationshipGraphViz from './RelationshipGraph';

interface Props {
    onOpenEntity?: (type: string, id: string) => void;
}

const CorrelationSection: React.FC<Props> = ({ onOpenEntity }) => {
    const [dashboard, setDashboard] = useState<CorrelationDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        setError(null);
        getCorrelationDashboard().then(setDashboard).catch((err) => setError(err?.message || 'Failed to load correlation dashboard')).finally(() => setLoading(false));
    }, []);
    useEffect(() => { load(); }, [load]);

    const [graphTarget, setGraphTarget] = useState<{ type: string; id: string } | null>(null);
    const [graphData, setGraphData] = useState<GraphData | null>(null);
    const [graphLoading, setGraphLoading] = useState(false);
    const [graphError, setGraphError] = useState<string | null>(null);
    const [graphDepth, setGraphDepth] = useState(1);

    const loadGraph = useCallback((target: { type: string; id: string }, depth: number) => {
        setGraphLoading(true);
        setGraphError(null);
        getRelationshipGraph(target.type, target.id, depth)
            .then(setGraphData)
            .catch((err) => setGraphError(err?.message || 'Failed to load relationship graph'))
            .finally(() => setGraphLoading(false));
    }, []);

    useEffect(() => {
        if (graphTarget) loadGraph(graphTarget, graphDepth);
    }, [graphTarget, graphDepth, loadGraph]);

    const openEntityAndGraph = useCallback((type: string, id: string) => {
        setGraphTarget({ type, id });
    }, []);

    return (
        <>
            <div className="ti-card">
                <div className="ti-section-header">
                    <span className="ti-card-title">Correlation</span>
                    <button type="button" className="ti-refresh-btn" onClick={load} disabled={loading}>{loading ? 'Loading…' : 'Refresh'}</button>
                </div>

                {error ? (
                    <div className="ti-error">{error}<button type="button" className="ti-retry-btn" onClick={load}>Retry</button></div>
                ) : loading || !dashboard ? (
                    <div className="ti-loading">Loading…</div>
                ) : (
                    <>
                        <div className="ti-kpi-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                            <div className="ti-kpi-card"><div className="ti-kpi-value">{dashboard.totalRelationships.toLocaleString()}</div><div className="ti-kpi-label">Total Relationships</div></div>
                            <div className="ti-kpi-card"><div className="ti-kpi-value">{dashboard.newLast24h.toLocaleString()}</div><div className="ti-kpi-label">New (24h)</div></div>
                            <div className="ti-kpi-card"><div className="ti-kpi-value">{dashboard.highConfidenceCount.toLocaleString()}</div><div className="ti-kpi-label">High Confidence / Observed</div></div>
                        </div>

                        <div style={{ marginTop: '18px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '10px' }}>Highly Connected Entities</div>
                            {dashboard.highlyConnectedEntities.length === 0 ? <div className="ti-empty">No relationships discovered yet.</div> : (
                                <div className="ti-chip-list">
                                    {dashboard.highlyConnectedEntities.map((h, i) => (
                                        <button key={i} type="button" className="ti-chip" onClick={() => openEntityAndGraph(h.entity.type, h.entity.id)}>
                                            {h.entity.label} <span style={{ opacity: 0.6 }}>· {h.edgeCount}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '18px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '10px' }}>Recently Updated Relationships</div>
                            {dashboard.recentlyUpdated.length === 0 ? <div className="ti-empty">No relationships discovered yet.</div> : (
                                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                    {dashboard.recentlyUpdated.map((r) => (
                                        <div key={r.id} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap' }}>
                                            <EntityChip entity={r.sourceEntity} onOpen={openEntityAndGraph} />
                                            <span className="ti-note">{r.relationship_type.replace(/_/g, ' ')}</span>
                                            <EntityChip entity={r.targetEntity} onOpen={openEntityAndGraph} />
                                            <span className="ti-note" style={{ marginLeft: 'auto' }}>via {r.source} · {formatDateTime(r.updated_at)}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '18px' }}>
                            <div className="ti-card-title" style={{ marginBottom: '10px' }}>Potential Campaign Connections</div>
                            <div className="ti-note" style={{ marginBottom: '8px' }}>Inferred — an IOC in a known campaign that's also linked to a threat actor or malware family. Not a confirmed attribution.</div>
                            {dashboard.potentialCampaignConnections.length === 0 ? <div className="ti-empty">None found yet.</div> : (
                                <div className="ti-list" style={{ paddingLeft: 0, listStyle: 'none' }}>
                                    {dashboard.potentialCampaignConnections.map((c, i) => (
                                        <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '5px 0', flexWrap: 'wrap' }}>
                                            <button type="button" className="ti-chip" onClick={() => openEntityAndGraph('campaign', String(c.campaignId))}>{c.campaignName}</button>
                                            <span className="ti-note">may relate to</span>
                                            <EntityChip entity={c.relatedEntity} onOpen={openEntityAndGraph} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>

            <div className="ti-card">
                <div className="ti-section-header">
                    <span className="ti-card-title">Relationship Graph</span>
                    {graphTarget && (
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <label className="ti-note" htmlFor="ti-graph-depth">Depth</label>
                            <select id="ti-graph-depth" value={graphDepth} onChange={(e) => setGraphDepth(Number(e.target.value))}>
                                <option value={1}>1 hop</option>
                                <option value={2}>2 hops</option>
                            </select>
                            <button type="button" className="ti-refresh-btn" onClick={() => loadGraph(graphTarget, graphDepth)} disabled={graphLoading}>{graphLoading ? 'Loading…' : 'Refresh'}</button>
                        </div>
                    )}
                </div>
                {!graphTarget ? (
                    <div className="ti-empty">Click any entity above (or from an IOC/Campaign/Threat Actor/Malware/Vulnerability/ATT&CK detail view) to visualize its relationships.</div>
                ) : graphError ? (
                    <div className="ti-error">{graphError}</div>
                ) : graphLoading || !graphData ? (
                    <div className="ti-loading">Loading…</div>
                ) : (
                    <RelationshipGraphViz data={graphData} onNodeOpen={onOpenEntity ?? openEntityAndGraph} />
                )}
            </div>
        </>
    );
};

export default CorrelationSection;
