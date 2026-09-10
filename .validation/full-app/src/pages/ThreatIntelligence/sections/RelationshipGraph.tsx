import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { RelationshipGraph as GraphData, RelationshipGraphNode } from '../../../services/api';
import '../../../components/DomainRelationshipTree.css';

type D3Node = RelationshipGraphNode & d3.SimulationNodeDatum;
type D3Link = { source: string; target: string; relationshipType: string; basis: string } & d3.SimulationLinkDatum<D3Node>;

const NODE_COLOR: Record<string, string> = {
    ioc: '#00e5ff', campaign: '#ffd600', threat_actor: '#ff5252', malware: '#ff8a65',
    vulnerability: '#b388ff', attack_technique: '#90a4ae', company: '#4dd0e1', image: '#f48fb1',
    social_investigation: '#69f0ae', social_account: '#82b1ff'
};
const NODE_LABELS: Record<string, string> = {
    ioc: 'IOC', campaign: 'Campaign', threat_actor: 'Threat Actor', malware: 'Malware',
    vulnerability: 'Vulnerability', attack_technique: 'ATT&CK Technique', company: 'Company', image: 'Image',
    social_investigation: 'Investigation', social_account: 'Social Account'
};

const CANVAS_HEIGHT = 460;

const RelationshipGraphViz: React.FC<{ data: GraphData; onNodeOpen?: (type: string, id: string) => void }> = ({ data, onNodeOpen }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [zoomPct, setZoomPct] = useState(100);

    useEffect(() => {
        const container = containerRef.current;
        const svgEl = svgRef.current;
        const gEl = gRef.current;
        if (!container || !svgEl || !gEl || !data?.nodes?.length) return;

        const width = container.clientWidth || 700;
        const height = container.clientHeight || CANVAS_HEIGHT;

        const svg = d3.select(svgEl);
        const g = d3.select(gEl);
        g.selectAll('*').remove();

        const nodes: D3Node[] = data.nodes.map((n) => ({ ...n }));
        const nodeById = new Map(nodes.map((n) => [`${n.type}:${n.id}`, n]));
        const links: D3Link[] = data.edges
            .map((e) => ({ source: `${e.sourceType}:${e.sourceId}`, target: `${e.targetType}:${e.targetId}`, relationshipType: e.relationshipType, basis: e.basis }))
            .filter((l) => nodeById.has(l.source) && nodeById.has(l.target));

        const simulation = d3.forceSimulation(nodes)
            .force('link', d3.forceLink<D3Node, D3Link>(links).id((d) => `${d.type}:${d.id}`).distance(90).strength(0.6))
            .force('charge', d3.forceManyBody().strength(-220))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collide', d3.forceCollide(28));

        const linkSel = g.append('g').attr('class', 'graph-links')
            .selectAll('line')
            .data(links)
            .enter().append('line')
            .attr('class', 'tree-link')
            .attr('stroke-dasharray', (d) => (d.basis === 'inferred' ? '4,3' : null));

        const nodeSel = g.append('g').attr('class', 'graph-nodes')
            .selectAll<SVGGElement, D3Node>('g.tree-node')
            .data(nodes)
            .enter().append('g')
            .attr('class', 'tree-node')
            .style('cursor', 'pointer')
            .call(
                d3.drag<SVGGElement, D3Node>()
                    .on('start', (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
                    .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
                    .on('end', (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
            )
            .on('click', (_event, d) => onNodeOpen?.(d.type, d.id));

        nodeSel.append('circle')
            .attr('class', 'tree-node-circle')
            .attr('r', 7)
            .attr('fill', (d) => NODE_COLOR[d.type] || '#8b949e')
            .attr('stroke', (d) => NODE_COLOR[d.type] || '#8b949e');

        nodeSel.append('text')
            .attr('class', 'tree-node-text')
            .attr('dy', '0.32em')
            .attr('x', 11)
            .style('fill', (d) => NODE_COLOR[d.type] || '#8b949e')
            .text((d) => d.label)
            .append('title')
            .text((d) => `${NODE_LABELS[d.type] || d.type}: ${d.label}${d.risk ? ` — ${d.risk} risk` : ''}`);

        simulation.on('tick', () => {
            linkSel
                .attr('x1', (d) => (d.source as unknown as D3Node).x ?? 0)
                .attr('y1', (d) => (d.source as unknown as D3Node).y ?? 0)
                .attr('x2', (d) => (d.target as unknown as D3Node).x ?? 0)
                .attr('y2', (d) => (d.target as unknown as D3Node).y ?? 0);
            nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
        });

        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.3, 2.5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform.toString());
                setZoomPct(Math.round(event.transform.k * 100));
            });
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);

        return () => {
            simulation.stop();
            svg.on('.zoom', null);
        };
    }, [data, onNodeOpen]);

    const zoomBy = useCallback((factor: number) => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor);
    }, []);

    const resetZoom = useCallback(() => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.transform, d3.zoomIdentity);
    }, []);

    if (!data?.nodes?.length) {
        return <div className="ti-empty">No relationships discovered for this entity yet.</div>;
    }

    return (
        <div className="domain-tree-wrap">
            {data.truncated && <div className="ti-note" style={{ marginBottom: '8px' }}>Graph truncated to the closest relationships — this entity has more connections than shown.</div>}
            <div className="domain-tree-canvas" ref={containerRef} style={{ height: CANVAS_HEIGHT }}>
                <div className="domain-tree-controls">
                    <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.3)}>+</button>
                    <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>−</button>
                    <button type="button" aria-label="Reset view" onClick={resetZoom}>⟲</button>
                    <div className="domain-tree-zoom-pct">{zoomPct}%</div>
                </div>
                <svg ref={svgRef} className="domain-tree-svg">
                    <g ref={gRef} />
                </svg>
            </div>
            <div className="domain-tree-legend">
                <span><i style={{ background: NODE_COLOR.ioc }} /> IOC</span>
                <span><i style={{ background: NODE_COLOR.campaign }} /> Campaign</span>
                <span><i style={{ background: NODE_COLOR.threat_actor }} /> Threat Actor</span>
                <span><i style={{ background: NODE_COLOR.malware }} /> Malware</span>
                <span><i style={{ background: NODE_COLOR.vulnerability }} /> Vulnerability</span>
                <span><i style={{ background: NODE_COLOR.attack_technique }} /> ATT&CK Technique</span>
            </div>
        </div>
    );
};

export default RelationshipGraphViz;
