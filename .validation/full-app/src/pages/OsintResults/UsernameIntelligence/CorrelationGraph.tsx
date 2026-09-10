import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { CorrelationData } from '../../../types';
import '../../../components/DomainRelationshipTree.css';

type NodeKind = 'username' | 'email' | 'company' | 'website' | 'breach' | 'social' | 'alias';

interface TreeNodeDatum {
    id: string;
    label: string;
    kind: NodeKind;
    detail?: string;
    children?: TreeNodeDatum[];
}

type D3Node = d3.HierarchyPointNode<TreeNodeDatum> & { x0?: number; y0?: number };

const NODE_COLOR: Record<NodeKind, string> = {
    username: '#eceff1',
    social: '#00e5ff',
    website: '#00c853',
    company: '#ffd600',
    email: '#b388ff',
    breach: '#ff5252',
    alias: '#90a4ae'
};

function buildHierarchyInput(data: CorrelationData): TreeNodeDatum {
    const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
    const rootNode = data.nodes.find((n) => n.id === 'root') || data.nodes[0];
    const children: TreeNodeDatum[] = data.edges
        .filter((e) => e.source === rootNode?.id)
        .map((e) => {
            const target = nodesById.get(e.target);
            return {
                id: e.target,
                label: target?.label ?? e.target,
                kind: (target?.kind as NodeKind) ?? 'alias',
                detail: [target?.detail, e.relationship, typeof e.confidence === 'number' ? `${e.confidence}% confidence` : null]
                    .filter(Boolean)
                    .join(' — ')
            };
        });

    return {
        id: rootNode?.id ?? 'root',
        label: rootNode?.label ?? 'Target',
        kind: 'username',
        children
    };
}

const CANVAS_HEIGHT = 420;

const CorrelationGraph: React.FC<{ data: CorrelationData }> = ({ data }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const [zoomPct, setZoomPct] = useState(80);

    useEffect(() => {
        const container = containerRef.current;
        const svgEl = svgRef.current;
        const gEl = gRef.current;
        if (!container || !svgEl || !gEl || !data?.nodes?.length) return;

        const height = container.clientHeight || CANVAS_HEIGHT;

        const svg = d3.select(svgEl);
        const g = d3.select(gEl);
        g.selectAll('*').remove();

        const treeLayout = d3.tree<TreeNodeDatum>().nodeSize([36, 260]);
        const root = d3.hierarchy(buildHierarchyInput(data), (d) => d.children) as D3Node;
        const treeData = treeLayout(root as d3.HierarchyNode<TreeNodeDatum>) as unknown as D3Node;
        const nodes = treeData.descendants() as D3Node[];
        const links = treeData.links() as unknown as Array<{ source: D3Node; target: D3Node }>;

        const linkGen = d3
            .linkHorizontal<unknown, { x: number; y: number }>()
            .x((d) => d.y)
            .y((d) => d.x);

        const linkSel = g
            .selectAll<SVGPathElement, { source: D3Node; target: D3Node }>('path.tree-link')
            .data(links, (d) => d.target.data.id)
            .enter()
            .insert('path', 'g')
            .attr('class', 'tree-link')
            .attr('d', (d) => linkGen({ source: d.source, target: d.target }) ?? '');

        const nodeSel = g
            .selectAll<SVGGElement, D3Node>('g.tree-node')
            .data(nodes, (d) => d.data.id)
            .enter()
            .append('g')
            .attr('class', 'tree-node')
            .attr('transform', (d) => `translate(${d.y},${d.x})`)
            .style('cursor', 'pointer')
            .on('click', (_event, d) => {
                const isConnected = (l: { source: D3Node; target: D3Node }) => l.source.data.id === d.data.id || l.target.data.id === d.data.id;
                linkSel.style('opacity', (l) => (isConnected(l) ? 1 : 0.15));
                nodeSel.style('opacity', (n) => (n.data.id === d.data.id || n.data.id === 'root' || isConnected({ source: root as D3Node, target: n }) ? 1 : 0.35));
            });

        nodeSel
            .append('circle')
            .attr('class', 'tree-node-circle')
            .attr('r', (d) => (d.data.kind === 'username' ? 0 : 5))
            .attr('stroke', (d) => NODE_COLOR[d.data.kind])
            .attr('fill', (d) => NODE_COLOR[d.data.kind]);

        nodeSel
            .append('text')
            .attr('class', 'tree-node-text')
            .attr('dy', '0.32em')
            .attr('x', (d) => (d.data.kind === 'username' ? -12 : 10))
            .attr('text-anchor', (d) => (d.data.kind === 'username' ? 'end' : 'start'))
            .style('fill', (d) => NODE_COLOR[d.data.kind])
            .style('font-weight', (d) => (d.data.kind === 'username' ? 700 : 400))
            .text((d) => d.data.label)
            .append('title')
            .text((d) => d.data.detail || d.data.label);

        svg.on('click.reset', (event) => {
            if (event.target !== svgEl) return;
            linkSel.style('opacity', 1);
            nodeSel.style('opacity', 1);
        });

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.2, 2.5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform.toString());
                setZoomPct(Math.round(event.transform.k * 100));
            });
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        const initialTransform = d3.zoomIdentity.translate(80, height / 2).scale(0.8);
        svg.call(zoom.transform, initialTransform);

        return () => {
            svg.on('.zoom', null);
            svg.on('click.reset', null);
        };
    }, [data]);

    const zoomBy = useCallback((factor: number) => {
        if (!svgRef.current || !zoomBehaviorRef.current) return;
        d3.select(svgRef.current).transition().duration(200).call(zoomBehaviorRef.current.scaleBy, factor);
    }, []);

    const resetZoom = useCallback(() => {
        if (!svgRef.current || !zoomBehaviorRef.current || !containerRef.current) return;
        const height = containerRef.current.clientHeight || CANVAS_HEIGHT;
        d3.select(svgRef.current)
            .transition()
            .duration(250)
            .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(80, height / 2).scale(0.8));
    }, []);

    if (!data?.nodes?.length) {
        return (
            <section className="uint-card" aria-label="Correlation">
                <div className="uint-card-title">Correlation</div>
                <div className="uint-empty">No correlated identity signals found for this username.</div>
            </section>
        );
    }

    return (
        <div className="domain-tree-wrap">
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
                <span><i style={{ background: NODE_COLOR.social }} /> Platform account</span>
                <span><i style={{ background: NODE_COLOR.website }} /> Linked website</span>
                <span><i style={{ background: NODE_COLOR.company }} /> Linked company</span>
                <span><i style={{ background: NODE_COLOR.email }} /> Linked email</span>
                <span><i style={{ background: NODE_COLOR.breach }} /> Breach source</span>
                <span><i style={{ background: NODE_COLOR.alias }} /> Other alias</span>
            </div>
        </div>
    );
};

export default CorrelationGraph;
