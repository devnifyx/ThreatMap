import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import type { DomainTreeData } from '../types';
import './DomainRelationshipTree.css';

type NodeKind = 'root' | 'group' | 'ip' | 'subdomain' | 'leaf-port' | 'leaf-service' | 'record';

interface TreeNodeDatum {
    id: string;
    label: string;
    kind: NodeKind;
    detail?: string;
    children?: TreeNodeDatum[];
}

type D3Node = d3.HierarchyPointNode<TreeNodeDatum> & {
    _children?: D3Node[] | null;
    x0?: number;
    y0?: number;
};

const NODE_COLOR: Record<NodeKind, string> = {
    root: '#eceff1',
    group: '#00e5ff',
    ip: '#00e5ff',
    subdomain: '#00c853',
    'leaf-port': '#ffd600',
    'leaf-service': '#b388ff',
    record: '#90a4ae'
};

// Builds the plain nested-object input d3.hierarchy() expects from the real,
// already-resolved data in DomainTreeData — no relationship here is invented,
// see the doc comment on DomainTreeData in frontend/src/types/index.ts.
function buildHierarchyInput(data: DomainTreeData): TreeNodeDatum {
    return {
        id: 'root',
        label: data.domain || 'Target',
        kind: 'root',
        children: data.groups.map((group) => {
            if (group.ipNodes && group.ipNodes.length > 0) {
                return {
                    id: `group-${group.type}`,
                    label: `${group.type} (${group.count})`,
                    kind: 'group',
                    children: group.ipNodes.map((ipNode) => ({
                        id: `ip-${ipNode.ip}`,
                        label: ipNode.provider ? `${ipNode.ip}, ${ipNode.provider}` : ipNode.ip,
                        kind: 'ip',
                        children: ipNode.subdomains.map((sub) => ({
                            id: `sub-${sub.subdomain}`,
                            label: sub.subdomain,
                            kind: 'subdomain',
                            children: [
                                {
                                    id: `${sub.subdomain}-ports`,
                                    label: sub.openPorts.label,
                                    detail: sub.openPorts.detail,
                                    kind: 'leaf-port'
                                },
                                {
                                    id: `${sub.subdomain}-service`,
                                    label: sub.service.label,
                                    detail: sub.service.detail,
                                    kind: 'leaf-service'
                                }
                            ]
                        }))
                    }))
                };
            }
            return {
                id: `group-${group.type}`,
                label: `${group.type} (${group.count})`,
                kind: 'group',
                children: (group.recordValues || []).map((value, index) => ({
                    id: `${group.type}-rec-${index}`,
                    label: value,
                    kind: 'record' as NodeKind
                }))
            };
        })
    };
}

const CANVAS_HEIGHT = 520;

const DomainRelationshipTree: React.FC<{ data: DomainTreeData; title?: string }> = ({ data, title }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement>(null);
    const gRef = useRef<SVGGElement>(null);
    const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
    const rootRef = useRef<D3Node | null>(null);
    const updateRef = useRef<((source: D3Node) => void) | null>(null);
    const [zoomPct, setZoomPct] = useState(70);
    const [collapsed, setCollapsed] = useState(false);
    const [allExpanded, setAllExpanded] = useState(false);

    useEffect(() => {
        if (collapsed) return;
        const container = containerRef.current;
        const svgEl = svgRef.current;
        const gEl = gRef.current;
        if (!container || !svgEl || !gEl) return;

        const height = container.clientHeight || CANVAS_HEIGHT;

        const svg = d3.select(svgEl);
        const g = d3.select(gEl);
        g.selectAll('*').remove();

        // Horizontal (y) spacing needs enough room for the longest label at
        // that depth — "ip, provider" nodes (e.g. "103.161.132.150, GB Network
        // Solutions") were colliding with the next column at 230px.
        const treeLayout = d3.tree<TreeNodeDatum>().nodeSize([32, 300]);
        const root = d3.hierarchy(buildHierarchyInput(data), (d) => d.children) as D3Node;
        root.x0 = height / 2;
        root.y0 = 0;

        // Start collapsed one level in — only the DNS record-type groups are
        // visible at first, matching how the reference tool opens.
        (root.children as D3Node[] | undefined)?.forEach((child) => collapse(child));

        function collapse(node: D3Node) {
            if (node.children) {
                node._children = node.children as D3Node[];
                node._children.forEach(collapse);
                node.children = undefined;
            }
        }

        const linkGen = d3
            .linkHorizontal<unknown, { x: number; y: number }>()
            .x((d) => d.y)
            .y((d) => d.x);

        function update(source: D3Node) {
            const treeData = treeLayout(root as d3.HierarchyNode<TreeNodeDatum>) as unknown as D3Node;
            const nodes = treeData.descendants() as D3Node[];
            const links = treeData.links() as unknown as Array<{ source: D3Node; target: D3Node }>;

            const node = g
                .selectAll<SVGGElement, D3Node>('g.tree-node')
                .data(nodes, (d) => d.data.id);

            const nodeEnter = node
                .enter()
                .append('g')
                .attr('class', 'tree-node')
                .attr('transform', () => `translate(${source.y0 ?? 0},${source.x0 ?? 0})`)
                .style('cursor', (d) => (d._children || d.children ? 'pointer' : 'default'))
                .on('click', (_event, d) => {
                    if (!d._children && !d.children) return;
                    if (d.children) {
                        d._children = d.children as D3Node[];
                        d.children = undefined;
                    } else {
                        d.children = d._children as D3Node[] | undefined;
                        d._children = null;
                    }
                    update(d);
                });

            nodeEnter
                .append('circle')
                .attr('class', 'tree-node-circle')
                .attr('r', 1e-6)
                .attr('stroke', (d) => NODE_COLOR[d.data.kind]);

            nodeEnter
                .append('text')
                .attr('class', 'tree-node-text')
                .attr('dy', '0.32em')
                .attr('x', (d) => (d.data.kind === 'root' ? -12 : 10))
                .attr('text-anchor', (d) => (d.data.kind === 'root' ? 'end' : 'start'))
                .style('fill', (d) => NODE_COLOR[d.data.kind])
                .style('font-weight', (d) => (d.data.kind === 'root' ? 700 : 400))
                .text((d) => d.data.label)
                .append('title')
                .text((d) => d.data.detail || d.data.label);

            const nodeMerge = nodeEnter.merge(node);
            nodeMerge
                .transition()
                .duration(280)
                .attr('transform', (d) => `translate(${d.y},${d.x})`);

            nodeMerge
                .select<SVGCircleElement>('circle.tree-node-circle')
                .attr('r', (d) => (d.data.kind === 'root' ? 0 : 5))
                .attr('fill', (d) => (d._children ? NODE_COLOR[d.data.kind] : '#0d0f13'));

            node.exit()
                .transition()
                .duration(200)
                .attr('transform', () => `translate(${source.y},${source.x})`)
                .remove();

            const link = g
                .selectAll<SVGPathElement, { source: D3Node; target: D3Node }>('path.tree-link')
                .data(links, (d) => d.target.data.id);

            link.enter()
                .insert('path', 'g')
                .attr('class', 'tree-link')
                .attr('d', () => {
                    const o = { x: source.x0 ?? 0, y: source.y0 ?? 0 };
                    return linkGen({ source: o, target: o }) ?? '';
                })
                .merge(link)
                .transition()
                .duration(280)
                .attr('d', (d) => linkGen({ source: d.source, target: d.target }) ?? '');

            link.exit()
                .transition()
                .duration(200)
                .attr('d', () => {
                    const o = { x: source.x, y: source.y };
                    return linkGen({ source: o, target: o }) ?? '';
                })
                .remove();

            nodes.forEach((d) => {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        }

        rootRef.current = root;
        updateRef.current = update;
        update(root);
        setAllExpanded(false);

        const zoom = d3
            .zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.2, 2.5])
            .on('zoom', (event) => {
                g.attr('transform', event.transform.toString());
                setZoomPct(Math.round(event.transform.k * 100));
            });
        zoomBehaviorRef.current = zoom;
        svg.call(zoom);
        const initialTransform = d3.zoomIdentity.translate(70, height / 2).scale(0.7);
        svg.call(zoom.transform, initialTransform);

        return () => {
            svg.on('.zoom', null);
        };
    }, [data, collapsed]);

    // Collapsing/expanding swings this card's height by 500px+, which shifts
    // every ScanReveal-wrapped card below it. GSAP's ScrollTrigger caches
    // each trigger's start/end as absolute document offsets and only
    // recomputes them on window resize/load — a React-driven height change
    // doesn't fire either, so those cards can get stuck at opacity:0 (still
    // "before their trigger") even once they're visibly on-screen.
    useEffect(() => {
        const id = requestAnimationFrame(() => ScrollTrigger.refresh());
        return () => cancelAnimationFrame(id);
    }, [collapsed]);

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
            .call(zoomBehaviorRef.current.transform, d3.zoomIdentity.translate(70, height / 2).scale(0.7));
    }, []);

    // Single toggle: expand every node at once, or collapse back to the
    // default view (top-level DNS groups visible, everything under them
    // collapsed). Both walks handle nodes regardless of their current
    // per-node toggle state (children vs. _children), so this works no
    // matter what's already been clicked open/closed by hand.
    const toggleExpandAll = useCallback(() => {
        const root = rootRef.current;
        const update = updateRef.current;
        if (!root || !update) return;

        if (!allExpanded) {
            const walk = (node: D3Node) => {
                const kids = node.children || node._children;
                if (kids) {
                    node.children = kids;
                    node._children = null;
                    kids.forEach(walk);
                }
            };
            walk(root);
        } else {
            const collapseAll = (node: D3Node) => {
                const kids = node.children || node._children;
                if (kids) {
                    node._children = kids;
                    node.children = undefined;
                    kids.forEach(collapseAll);
                }
            };
            if (root._children) {
                root.children = root._children;
                root._children = null;
            }
            (root.children as D3Node[] | undefined)?.forEach((child) => {
                const kids = child.children || child._children;
                if (kids) {
                    child._children = kids as D3Node[];
                    child.children = undefined;
                    (kids as D3Node[]).forEach(collapseAll);
                }
            });
        }
        update(root);
        setAllExpanded((v) => !v);
    }, [allExpanded]);

    return (
        <div className="domain-tree-wrap">
            <button
                type="button"
                className="domain-tree-header"
                onClick={() => setCollapsed((v) => !v)}
                aria-expanded={!collapsed}
            >
                <span className="domain-tree-header-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none">
                        <circle cx="5" cy="12" r="2.4" fill="currentColor" />
                        <circle cx="18" cy="5" r="2.4" fill="currentColor" />
                        <circle cx="18" cy="19" r="2.4" fill="currentColor" />
                        <path d="M7 11L16 6M7 13L16 18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                    </svg>
                </span>
                <span className="domain-tree-header-text">
                    <span className="domain-tree-title">{title || 'Domain Relationship Tree'}</span>
                    <span className="domain-tree-subtitle">Interactive visualization of domain, IPs, and subdomains</span>
                </span>
                <span className={`domain-tree-chevron${collapsed ? '' : ' domain-tree-chevron--open'}`} aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none">
                        <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                </span>
            </button>
            {!collapsed && (
                <>
                    <div className="domain-tree-canvas" ref={containerRef} style={{ height: CANVAS_HEIGHT }}>
                        <div className="domain-tree-controls">
                            <button type="button" aria-label="Zoom in" onClick={() => zoomBy(1.3)}>
                                +
                            </button>
                            <button type="button" aria-label="Zoom out" onClick={() => zoomBy(1 / 1.3)}>
                                −
                            </button>
                            <button type="button" aria-label="Reset view" onClick={resetZoom}>
                                ⟲
                            </button>
                            <div className="domain-tree-zoom-pct">{zoomPct}%</div>
                        </div>
                        <div className="domain-tree-node-actions">
                            <button type="button" className="domain-tree-expand-btn" onClick={toggleExpandAll}>
                                <span aria-hidden="true">{allExpanded ? '⤡' : '⤢'}</span> {allExpanded ? 'Shrink' : 'Expand'}
                            </button>
                        </div>
                        <svg ref={svgRef} className="domain-tree-svg">
                            <g ref={gRef} />
                        </svg>
                    </div>
                    <div className="domain-tree-legend">
                        <span><i style={{ background: NODE_COLOR.group }} /> DNS record group</span>
                        <span><i style={{ background: NODE_COLOR.ip }} /> IP address</span>
                        <span><i style={{ background: NODE_COLOR.subdomain }} /> Subdomain</span>
                        <span><i style={{ background: NODE_COLOR['leaf-port'] }} /> Open ports</span>
                        <span><i style={{ background: NODE_COLOR['leaf-service'] }} /> Service banner</span>
                    </div>
                </>
            )}
        </div>
    );
};

export default DomainRelationshipTree;
