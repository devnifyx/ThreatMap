import { useEffect, useRef, useState } from 'react';
import { SEVERITY_COLORS } from './types';
import type { NormalizedSeverity, NormalizedThreatEvent } from './types';

// PROTOTYPE. MapLibre is taken from the global that prototype.html loads from a
// CDN, because this project's node_modules is a symlink into another project and
// installing there would modify it. To productionise: `npm i maplibre-gl`, then
// replace `maplibre()` with a normal `import maplibregl from 'maplibre-gl'`.
declare global {
    interface Window { maplibregl?: MapLibreGlobal }
}
type MapLibreGlobal = { Map: new (options: Record<string, unknown>) => MapLibreMap; Popup: new (options?: Record<string, unknown>) => MapLibrePopup };
interface MapLibrePopup { setLngLat(position: [number, number]): MapLibrePopup; setHTML(html: string): MapLibrePopup; addTo(map: MapLibreMap): MapLibrePopup; remove(): void }
interface MapLibreMap {
    on(event: string, listener: (payload: never) => void): void;
    on(event: string, layer: string, listener: (payload: never) => void): void;
    addSource(id: string, source: Record<string, unknown>): void;
    addLayer(layer: Record<string, unknown>): void;
    getSource(id: string): { setData(data: unknown): void; getClusterExpansionZoom(id: number): Promise<number> } | undefined;
    getLayer(id: string): unknown;
    setLayoutProperty(layer: string, property: string, value: unknown): void;
    setProjection(projection: Record<string, unknown>): void;
    setSky(sky: Record<string, unknown>): void;
    easeTo(options: Record<string, unknown>): void;
    getZoom(): number;
    getCanvas(): HTMLCanvasElement;
    remove(): void;
}

const SEVERITY_RANK: Record<NormalizedSeverity, number> = { low: 1, medium: 2, high: 3, critical: 4 };

// Esri and CARTO both allow this kind of evaluation use with attribution. Swap in
// a licensed provider (and proxy the key server side) before shipping publicly.
const SATELLITE_TILES = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const DARK_TILES = ['a', 'b', 'c', 'd'].map(sub => `https://${sub}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`);

function toFeatureCollection(events: NormalizedThreatEvent[]) {
    return {
        type: 'FeatureCollection',
        features: events.map(event => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [event.source.longitude, event.source.latitude] },
            properties: {
                id: event.id,
                type: event.type,
                severity: event.severity,
                rank: SEVERITY_RANK[event.severity],
                country: event.source.country ?? '',
            },
        })),
    };
}

const severityColor = ['match', ['get', 'severity'],
    'critical', SEVERITY_COLORS.critical,
    'high', SEVERITY_COLORS.high,
    'medium', SEVERITY_COLORS.medium,
    SEVERITY_COLORS.low];

// Clusters take the colour of the worst event they contain.
const clusterColor = ['step', ['get', 'maxRank'],
    SEVERITY_COLORS.low,
    2, SEVERITY_COLORS.medium,
    3, SEVERITY_COLORS.high,
    4, SEVERITY_COLORS.critical];

interface MapLibreGlobeProps {
    events: NormalizedThreatEvent[];
    onEventSelect?: (id: string) => void;
}

export function MapLibreGlobe({ events, onEventSelect }: MapLibreGlobeProps) {
    const container = useRef<HTMLDivElement>(null);
    const map = useRef<MapLibreMap | null>(null);
    const selectRef = useRef(onEventSelect);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [globe, setGlobe] = useState(true);
    const [satellite, setSatellite] = useState(true);
    const [zoom, setZoom] = useState(2);
    const [cursor, setCursor] = useState<[number, number] | null>(null);

    selectRef.current = onEventSelect;

    useEffect(() => {
        const maplibregl = window.maplibregl;
        if (!container.current) return;
        if (!maplibregl) { setError('MapLibre failed to load from the CDN. Check the network tab.'); return; }

        const instance = new maplibregl.Map({
            container: container.current,
            center: [10, 25],
            zoom: 2,
            attributionControl: { compact: true },
            style: {
                version: 8,
                projection: { type: 'globe' },
                glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
                sources: {
                    satellite: { type: 'raster', tiles: [SATELLITE_TILES], tileSize: 256, maxzoom: 19, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
                    dark: { type: 'raster', tiles: DARK_TILES, tileSize: 256, maxzoom: 20, attribution: '&copy; OpenStreetMap contributors, &copy; CARTO' },
                },
                layers: [
                    { id: 'space', type: 'background', paint: { 'background-color': '#0b141c' } },
                    { id: 'dark', type: 'raster', source: 'dark', layout: { visibility: 'none' } },
                    { id: 'satellite', type: 'raster', source: 'satellite' },
                ],
            },
        });
        map.current = instance;

        instance.on('load', () => {
            try { instance.setSky({ 'sky-color': '#0d2033', 'horizon-color': '#3f6d8c', 'fog-color': '#0b141c', 'sky-horizon-blend': 0.6, 'atmosphere-blend': ['interpolate', ['linear'], ['zoom'], 0, 0.9, 6, 0.2, 10, 0] }); } catch { /* older builds have no sky */ }

            instance.addSource('threats', {
                type: 'geojson',
                data: toFeatureCollection(events),
                cluster: true,
                clusterRadius: 48,
                clusterMaxZoom: 12,
                clusterProperties: { maxRank: ['max', ['get', 'rank']] },
            });
            instance.addLayer({
                id: 'clusters', type: 'circle', source: 'threats', filter: ['has', 'point_count'],
                paint: {
                    'circle-color': '#101f2b',
                    'circle-stroke-color': clusterColor,
                    'circle-stroke-width': 2,
                    'circle-opacity': 0.85,
                    'circle-radius': ['step', ['get', 'point_count'], 14, 10, 19, 50, 26],
                },
            });
            instance.addLayer({
                id: 'cluster-count', type: 'symbol', source: 'threats', filter: ['has', 'point_count'],
                layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-font': ['Open Sans Regular'], 'text-size': 12 },
                paint: { 'text-color': '#edf4f6' },
            });
            instance.addLayer({
                id: 'threat-points', type: 'circle', source: 'threats', filter: ['!', ['has', 'point_count']],
                paint: {
                    'circle-color': severityColor,
                    'circle-radius': ['interpolate', ['linear'], ['zoom'], 2, 4, 10, 8, 16, 14],
                    'circle-stroke-color': '#0b141c',
                    'circle-stroke-width': 1.5,
                },
            });

            const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });
            instance.on('mouseenter', 'threat-points', (payload: never) => {
                const hit = payload as unknown as { features?: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }[] };
                const feature = hit.features?.[0];
                if (!feature) return;
                instance.getCanvas().style.cursor = 'pointer';
                popup.setLngLat(feature.geometry.coordinates)
                    .setHTML(`<strong>${feature.properties.type}</strong><br/>${feature.properties.severity}${feature.properties.country ? ` · ${feature.properties.country}` : ''}`)
                    .addTo(instance);
            });
            instance.on('mouseleave', 'threat-points', () => { instance.getCanvas().style.cursor = ''; popup.remove(); });
            instance.on('click', 'threat-points', (payload: never) => {
                const hit = payload as unknown as { features?: { properties: Record<string, string> }[] };
                const id = hit.features?.[0]?.properties.id;
                if (id) selectRef.current?.(id);
            });
            // Clicking a cluster zooms to exactly the level where it splits.
            instance.on('click', 'clusters', (payload: never) => {
                const hit = payload as unknown as { features?: { properties: Record<string, number>; geometry: { coordinates: [number, number] } }[] };
                const feature = hit.features?.[0];
                const source = instance.getSource('threats');
                if (!feature || !source) return;
                void source.getClusterExpansionZoom(feature.properties.cluster_id).then(next => {
                    instance.easeTo({ center: feature.geometry.coordinates, zoom: next, duration: 600 });
                });
            });
            setReady(true);
        });

        instance.on('error', (payload: never) => {
            const failure = payload as unknown as { error?: { message?: string } };
            if (failure.error?.message) setError(failure.error.message);
        });
        instance.on('zoom', () => setZoom(instance.getZoom()));
        instance.on('mousemove', (payload: never) => {
            const move = payload as unknown as { lngLat: { lat: number; lng: number } };
            setCursor([move.lngLat.lat, move.lngLat.lng]);
        });

        return () => { instance.remove(); map.current = null; };
        // The map is created once; data and view changes are pushed in below.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!ready) return;
        map.current?.getSource('threats')?.setData(toFeatureCollection(events));
    }, [events, ready]);

    useEffect(() => {
        if (!ready) return;
        // This single call is the whole 3D/2D toggle.
        map.current?.setProjection({ type: globe ? 'globe' : 'mercator' });
    }, [globe, ready]);

    useEffect(() => {
        if (!ready) return;
        map.current?.setLayoutProperty('satellite', 'visibility', satellite ? 'visible' : 'none');
        map.current?.setLayoutProperty('dark', 'visibility', satellite ? 'none' : 'visible');
    }, [satellite, ready]);

    return <div className="mlg-root">
        <div ref={container} className="mlg-canvas" />
        <div className="mlg-toolbar">
            <button type="button" className={globe ? 'is-active' : ''} onClick={() => setGlobe(true)}>3D GLOBE</button>
            <button type="button" className={globe ? '' : 'is-active'} onClick={() => setGlobe(false)}>2D FLAT</button>
            <span className="mlg-divider" />
            <button type="button" className={satellite ? 'is-active' : ''} onClick={() => setSatellite(true)}>SAT</button>
            <button type="button" className={satellite ? '' : 'is-active'} onClick={() => setSatellite(false)}>MAP</button>
        </div>
        <div className="mlg-hud">
            <span>ZOOM <b>{zoom.toFixed(1)}</b></span>
            <span>CURSOR <b>{cursor ? `${cursor[0].toFixed(4)}, ${cursor[1].toFixed(4)}` : '—'}</b></span>
            <span>EVENTS <b>{events.length}</b></span>
        </div>
        {error && <div className="mlg-error">{error}</div>}
    </div>;
}
