import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { geoGraticule10 } from 'd3-geo';
import { countryPath, MAP_HEIGHT, MAP_WIDTH, projectPoint, worldPath } from './geographicData';
import { clusterThreatEvents } from './threatSelectors';
import { paintHeatmap } from './threatHeatmap';
import { SEVERITY_COLORS } from './types';
import type { CountryFeature, RendererProps } from './types';

interface Transform { x: number; y: number; scale: number }
const INITIAL: Transform = { x: 0, y: 0, scale: 1 };
const gridPath = worldPath(geoGraticule10()) ?? '';

function bounded(transform: Transform): Transform {
    return { scale: transform.scale, x: Math.max(MAP_WIDTH * (1 - transform.scale), Math.min(0, transform.x)), y: Math.max(MAP_HEIGHT * (1 - transform.scale), Math.min(0, transform.y)) };
}

interface CountryPolygonProps {
    country: CountryFeature;
    fill: string;
    selected: boolean;
    hovered: boolean;
    dimmed: boolean;
    count: number;
    onSelect: (id: string) => void;
    onHover: (id: string | null) => void;
}

const CountryPolygon = memo(function CountryPolygon({ country, fill, selected, hovered, dimmed, count, onSelect, onHover }: CountryPolygonProps) {
    return <path d={countryPath(country)} fill={fill} className={`ctm-country${selected ? ' is-selected' : ''}${hovered ? ' is-hovered' : ''}${dimmed ? ' is-dimmed' : ''}`}
        role="button" tabIndex={0} aria-label={`${country.properties.name}, ${count} events`} aria-pressed={selected}
        onMouseEnter={() => onHover(country.id)} onMouseLeave={() => onHover(null)}
        onFocus={() => onHover(country.id)} onBlur={() => onHover(null)}
        onClick={() => onSelect(country.id)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); onSelect(country.id); } }}>
        <title>{country.properties.name} · {count} events</title>
    </path>;
});

export function FlatWorldMap(props: RendererProps) {
    const { countries, events, investigations, activity, selectedCountryId, hoveredCountryId, countryFilter, selectedEventId, showConnections, displayMode, focus, viewCommand, onCountrySelect, onCountryHover, onEventSelect, onClusterSelect } = props;
    const svgRef = useRef<SVGSVGElement>(null);
    const [transform, setTransform] = useState<Transform>(INITIAL);
    const [heatImage, setHeatImage] = useState('');
    const drag = useRef<{ x: number; y: number; transform: Transform; moved: boolean; pointerId: number } | null>(null);
    const wasDragged = useRef(false);
    const arrowId = useId().replace(/:/g, '');
    // Quantising the cell lets small zoom steps reuse the previous grouping
    // instead of re-running the clusterer on every frame.
    const clusterCell = Math.max(0.8, Math.round(36 / transform.scale) / 4);
    const clusters = useMemo(() => clusterThreatEvents(events, clusterCell), [events, clusterCell]);
    const selectedEvent = useMemo(() => events.find(event => event.id === selectedEventId), [events, selectedEventId]);
    // Projecting a country's bounds and centroid walks its full geometry, so it
    // is done once per dataset. Only the legibility test depends on the zoom.
    const labelAnchors = useMemo(() => countries.flatMap(country => {
        const [[left, top], [right, bottom]] = worldPath.bounds(country);
        const width = right - left; const height = bottom - top;
        if (width > MAP_WIDTH / 2) return [];
        const [x, y] = worldPath.centroid(country);
        return Number.isFinite(x + y) ? [{ id: country.id, name: country.properties.name, x, y, width, height }] : [];
    }), [countries]);
    const labels = useMemo(() => labelAnchors.filter(anchor => anchor.width * transform.scale >= 65 && anchor.height * transform.scale >= 24), [labelAnchors, transform.scale]);

    const zoom = (factor: number, anchor = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 }) => setTransform(previous => {
        const scale = Math.max(1, Math.min(16, previous.scale * factor));
        const ratio = scale / previous.scale;
        return bounded({ scale, x: anchor.x - (anchor.x - previous.x) * ratio, y: anchor.y - (anchor.y - previous.y) * ratio });
    });

    const mapPosition = (clientX: number, clientY: number) => {
        const matrix = svgRef.current?.getScreenCTM();
        return matrix ? new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse()) : new DOMPoint();
    };

    useEffect(() => {
        const svg = svgRef.current;
        if (!svg) return;
        // Wheel events arrive faster than the map can render, so a gesture is
        // accumulated and applied once per frame. Because the zoom is
        // exponential, the summed delta matches applying each notch in turn.
        let delta = 0;
        let anchor = { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
        let frame = 0;
        const apply = () => {
            frame = 0;
            const factor = Math.exp(-delta * 0.003);
            delta = 0;
            setTransform(previous => {
                const scale = Math.max(1, Math.min(16, previous.scale * factor));
                const ratio = scale / previous.scale;
                return bounded({ scale, x: anchor.x - (anchor.x - previous.x) * ratio, y: anchor.y - (anchor.y - previous.y) * ratio });
            });
        };
        const onWheel = (event: WheelEvent) => {
            event.preventDefault();
            const matrix = svg.getScreenCTM();
            anchor = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : { x: MAP_WIDTH / 2, y: MAP_HEIGHT / 2 };
            delta += Math.max(-100, Math.min(100, event.deltaY));
            frame ||= requestAnimationFrame(apply);
        };
        svg.addEventListener('wheel', onWheel, { passive: false });
        return () => { svg.removeEventListener('wheel', onWheel); if (frame) cancelAnimationFrame(frame); };
    }, []);

    useEffect(() => {
        if (!focus) return;
        const [x, y] = projectPoint(focus);
        const scale = Math.min(16, Math.max(1, focus.zoom ?? 4));
        setTransform(bounded({ scale, x: MAP_WIDTH / 2 - x * scale, y: MAP_HEIGHT / 2 - y * scale }));
    }, [focus]);

    useEffect(() => {
        if (!viewCommand) return;
        if (viewCommand.action === 'reset') setTransform(INITIAL);
        else {
            const factor = viewCommand.action === 'in' ? 1.5 : 1 / 1.5;
            setTransform(previous => {
                const scale = Math.min(16, Math.max(1, previous.scale * factor));
                const ratio = scale / previous.scale;
                return bounded({ scale, x: MAP_WIDTH / 2 - (MAP_WIDTH / 2 - previous.x) * ratio, y: MAP_HEIGHT / 2 - (MAP_HEIGHT / 2 - previous.y) * ratio });
            });
        }
    }, [viewCommand]);

    useEffect(() => {
        if (displayMode !== 'heatmap') return;
        const canvas = document.createElement('canvas');
        paintHeatmap(canvas, events);
        setHeatImage(canvas.toDataURL());
    }, [events, displayMode]);

    // A stable identity keeps the memoised country paths from re-rendering on
    // every zoom step.
    const selectCountry = useCallback((id: string) => { if (!wasDragged.current) onCountrySelect(id); }, [onCountrySelect]);
    const connections = useMemo(() => events.filter(event => event.destination), [events]);

    return <svg ref={svgRef} className="ctm-flat-map" viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`} aria-label="Interactive world map. Drag to pan, scroll to zoom. Use arrow keys to pan and plus or minus to zoom." role="group" tabIndex={0}
        onPointerDown={event => {
            if (event.button !== 0) return;
            const point = mapPosition(event.clientX, event.clientY);
            wasDragged.current = false;
            drag.current = { x: point.x, y: point.y, transform, moved: false, pointerId: event.pointerId };
        }}
        onPointerMove={event => {
            const start = drag.current;
            if (!start || start.pointerId !== event.pointerId) return;
            const point = mapPosition(event.clientX, event.clientY);
            const dx = point.x - start.x; const dy = point.y - start.y;
            if (Math.hypot(dx, dy) > 4 || start.moved) {
                start.moved = true; wasDragged.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                setTransform(bounded({ ...start.transform, x: start.transform.x + dx, y: start.transform.y + dy }));
            }
        }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }}
        onPointerCancel={() => { drag.current = null; }}
        onKeyDown={event => {
            if (event.key === '+' || event.key === '=') { event.preventDefault(); zoom(1.5); }
            if (event.key === '-') { event.preventDefault(); zoom(1 / 1.5); }
            const offsets: Record<string, [number, number]> = { ArrowLeft: [50, 0], ArrowRight: [-50, 0], ArrowUp: [0, 50], ArrowDown: [0, -50] };
            const offset = offsets[event.key];
            if (offset) { event.preventDefault(); setTransform(previous => bounded({ ...previous, x: previous.x + offset[0], y: previous.y + offset[1] })); }
        }}>
        <defs><marker id={arrowId} markerWidth="5" markerHeight="5" refX="4.5" refY="2.5" orient="auto"><path d="M0 0L5 2.5L0 5Z" fill="#b8cbd3" /></marker></defs>
        <g transform={`translate(${transform.x} ${transform.y}) scale(${transform.scale})`}>
            <rect width={MAP_WIDTH} height={MAP_HEIGHT} fill="#101f2b" />
            <path d={gridPath} className="ctm-graticule" />
            {countries.map(country => {
                const value = activity.get(country.id);
                return <CountryPolygon key={country.id} country={country} count={value?.count ?? 0}
                    fill={value ? SEVERITY_COLORS[value.severity] : '#2a3c45'} selected={selectedCountryId === country.id}
                    hovered={hoveredCountryId === country.id} dimmed={!!countryFilter && countryFilter !== country.id}
                    onSelect={selectCountry} onHover={onCountryHover} />;
            })}
            <g className="ctm-map-labels" fontSize={10 / transform.scale}>
                {labels.map(label => <text key={label.id} x={label.x} y={label.y}>{label.name}</text>)}
            </g>
            {displayMode === 'heatmap' && heatImage && <image href={heatImage} width={MAP_WIDTH} height={MAP_HEIGHT} className="ctm-heat-raster" preserveAspectRatio="none" />}
            {displayMode === 'events' && showConnections && connections.map(event => <path key={event.id}
                d={worldPath({ type: 'LineString', coordinates: [[event.source.longitude, event.source.latitude], [event.destination!.longitude, event.destination!.latitude]] }) ?? ''}
                className="ctm-connection" stroke={SEVERITY_COLORS[event.severity]} markerEnd={`url(#${arrowId})`} />)}
            {displayMode === 'events' && clusters.map(cluster => {
                const [x, y] = projectPoint(cluster);
                const clustered = cluster.count > 1;
                const event = cluster.events[0];
                const select = () => {
                    if (wasDragged.current) return;
                    if (clustered) {
                        onClusterSelect(cluster);
                        const scale = Math.min(16, transform.scale * 2);
                        setTransform(bounded({ scale, x: MAP_WIDTH / 2 - x * scale, y: MAP_HEIGHT / 2 - y * scale }));
                    } else onEventSelect(event);
                };
                return <g key={cluster.id} transform={`translate(${x},${y}) scale(${1 / transform.scale})`} className="ctm-marker" role="button" tabIndex={0}
                    aria-label={clustered ? `${cluster.count} events, zoom and view events` : `${event.type}, ${event.severity}, ${event.source.country ?? 'source location'}`}
                    onClick={select} onKeyDown={key => { if (key.key === 'Enter' || key.key === ' ') { key.preventDefault(); key.stopPropagation(); select(); } }}>
                    <circle r={clustered ? 13 : event.severity === 'critical' ? 6 : 4.5} fill={clustered ? '#172c38' : SEVERITY_COLORS[event.severity]} stroke={SEVERITY_COLORS[cluster.severity]} strokeWidth="1.5" />
                    {clustered && <text textAnchor="middle" dy="3.5" fill="#edf4f6" fontSize="9">{cluster.count > 999 ? `${(cluster.count / 1000).toFixed(1)}k` : cluster.count}</text>}
                    <title>{clustered ? `${cluster.count} events` : `${event.type} · ${event.severity}`}</title>
                </g>;
            })}
            {displayMode === 'events' && showConnections && connections.map(event => {
                const [x, y] = projectPoint(event.destination!);
                return <circle key={`destination:${event.id}`} cx={x} cy={y} r={3.5 / transform.scale} fill="#101f2b" stroke={SEVERITY_COLORS[event.severity]} strokeWidth="1.5" vectorEffect="non-scaling-stroke"><title>Destination · {event.destination?.country ?? 'Coordinates provided'}</title></circle>;
            })}
            {selectedEvent && <circle cx={projectPoint(selectedEvent.source)[0]} cy={projectPoint(selectedEvent.source)[1]} r={10 / transform.scale} className="ctm-selected-marker" />}
            {investigations.map(point => {
                const [x, y] = projectPoint(point);
                return <g key={point.id} transform={`translate(${x},${y}) scale(${1 / transform.scale})`} className="ctm-investigation"><path d="M0 -5L5 0L0 5L-5 0Z" /><title>Investigated {point.kind}: {point.target} · separate from threat events</title></g>;
            })}
        </g>
    </svg>;
}
