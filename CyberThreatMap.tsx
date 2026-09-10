import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react';
import { FlatWorldMap } from './threat-map/FlatWorldMap';
import { GlobeView } from './threat-map/GlobeView';
import { MapToolbar } from './threat-map/MapToolbar';
import { CountryIntelligence, EventDetails, MapLegend, NodeStatistics, ThreatFeed } from './threat-map/IntelligencePanels';
import { countryFocus, createCountryLookup, loadCountries } from './threat-map/geographicData';
import { normalizeInvestigations } from './threat-map/threatNormalization';
import { countryActivity, eventInCountry, filterThreatEvents, searchMap, summarizeEvents, TIME_RANGES } from './threat-map/threatSelectors';
import { useThreatMapData } from './threat-map/useThreatMapData';
import type { CountryFeature, MapError, MapFocusTarget, MapMode, MapSearchResult, NormalizedThreatEvent, RendererProps, ScanOverlayPoint, ThreatCluster, ThreatData, ThreatDisplayMode, TimeRangePreset } from './threat-map/types';
import './CyberThreatMap.css';

export type { ThreatData, ScanOverlayPoint } from './threat-map/types';

export interface CyberThreatMapProps {
    filterType?: string;
    filterSeverity?: string;
    overlayPoints?: ScanOverlayPoint[];
    onThreatClick?: (threat: ThreatData) => void;
    onError?: (error: string | null) => void;
    // Optional callbacks synchronize parent filters with fullscreen controls.
    onFilterTypeChange?: (type: string) => void;
    onFilterSeverityChange?: (severity: string) => void;
}

const EMPTY_OVERLAYS: ScanOverlayPoint[] = [];
function localDateTime(time: number): string {
    const date = new Date(time);
    return new Date(time - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

export default function CyberThreatMap({ filterType, filterSeverity, overlayPoints = EMPTY_OVERLAYS, onThreatClick, onError, onFilterTypeChange, onFilterSeverityChange }: CyberThreatMapProps) {
    const wrapper = useRef<HTMLDivElement>(null);
    const [countries, setCountries] = useState<CountryFeature[]>([]);
    const [geographicLoading, setGeographicLoading] = useState(true);
    const [geographicAttempt, setGeographicAttempt] = useState(0);
    const [mapError, setMapError] = useState<MapError | null>(null);
    const [mapMode, setMapMode] = useState<MapMode>('globe');
    const [displayMode, setDisplayMode] = useState<ThreatDisplayMode>('events');
    const [isLive, setIsLive] = useState(true);
    const [showConnections, setShowConnections] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [rendererLoading, setRendererLoading] = useState(true);
    const [localType, setLocalType] = useState('all');
    const [localSeverity, setLocalSeverity] = useState('all');
    const type = filterType ?? localType;
    const severity = filterSeverity ?? localSeverity;
    const [timeRange, setTimeRange] = useState<TimeRangePreset>('24h');
    const [now, setNow] = useState(Date.now);
    const [customStart, setCustomStart] = useState(() => localDateTime(Date.now() - TIME_RANGES['24h']));
    const [customEnd, setCustomEnd] = useState(() => localDateTime(Date.now()));
    const [selectedCountryId, setSelectedCountryId] = useState<string | null>(null);
    const [hoveredCountryId, setHoveredCountryId] = useState<string | null>(null);
    const [countryFilter, setCountryFilter] = useState<string | null>(null);
    const [region, setRegion] = useState<string | null>(null);
    const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
    const [clusterIds, setClusterIds] = useState<string[]>([]);
    const [focus, setFocus] = useState<MapFocusTarget | null>(null);
    const [viewCommand, setViewCommand] = useState<RendererProps['viewCommand']>(null);
    const [query, setQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [feedPage, setFeedPage] = useState(0);
    const [clusterPage, setClusterPage] = useState(0);
    const [feedOpen, setFeedOpen] = useState(true);
    const [intelligenceOpen, setIntelligenceOpen] = useState(true);
    const onErrorRef = useRef(onError);
    const { events, feedState, loading: threatLoading, rejectedCount, limited, originalEvent } = useThreatMapData(isLive);

    useEffect(() => { onErrorRef.current = onError; }, [onError]);
    useEffect(() => {
        let cancelled = false;
        setGeographicLoading(true);
        void loadCountries().then(data => {
            if (cancelled) return;
            setCountries(data); setGeographicLoading(false); setMapError(null); onErrorRef.current?.(null);
        }).catch(() => {
            if (cancelled) return;
            const error: MapError = { code: 'GEOGRAPHIC_DATA', message: 'Country boundaries could not load. Retry to restore the map.', recoverable: true };
            setMapError(error); setGeographicLoading(false); onErrorRef.current?.(error.message);
        });
        return () => { cancelled = true; };
    }, [geographicAttempt]);
    useEffect(() => {
        if (!isLive) return;
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), 10_000);
        return () => window.clearInterval(timer);
    }, [isLive]);
    useEffect(() => {
        const update = () => setIsFullscreen(document.fullscreenElement === wrapper.current);
        document.addEventListener('fullscreenchange', update);
        return () => document.removeEventListener('fullscreenchange', update);
    }, []);

    const start = timeRange === 'custom' ? Date.parse(customStart) : now - TIME_RANGES[timeRange];
    const end = timeRange === 'custom' ? Date.parse(customEnd) : now;
    const timeError = !Number.isFinite(start + end) ? 'Enter both dates and times.' : start > end ? 'Start time must be before end time.' : null;
    const filteredEvents = useMemo(() => filterThreatEvents(events, { type, severity, start, end, countryId: countryFilter, region }, countries), [events, type, severity, start, end, countryFilter, region, countries]);
    const statistics = useMemo(() => summarizeEvents(filteredEvents), [filteredEvents]);
    const activity = useMemo(() => countryActivity(filteredEvents, countries), [filteredEvents, countries]);
    const lookup = useMemo(() => createCountryLookup(countries), [countries]);
    const selectedCountry = countries.find(country => country.id === selectedCountryId) ?? null;
    const hoveredCountry = countries.find(country => country.id === hoveredCountryId) ?? null;
    const selectedEvent = filteredEvents.find(event => event.id === selectedEventId) ?? null;
    const countryEvents = useMemo(() => selectedCountryId ? filteredEvents.filter(event => eventInCountry(event, selectedCountryId, lookup)) : [], [filteredEvents, selectedCountryId, lookup]);
    const countryStatistics = useMemo(() => summarizeEvents(countryEvents), [countryEvents]);
    const regions = useMemo(() => [...new Set(countryEvents.flatMap(event => [event.source, event.destination].flatMap(point => point?.region && lookup(point)?.id === selectedCountryId ? [point.region] : [])))].sort(), [countryEvents, lookup, selectedCountryId]);
    const results = useMemo(() => searchMap(query, filteredEvents, countries), [query, filteredEvents, countries]);
    const investigations = useMemo(() => normalizeInvestigations(overlayPoints), [overlayPoints]);
    const clusterEvents = useMemo(() => { const ids = new Set(clusterIds); return filteredEvents.filter(event => ids.has(event.id)); }, [clusterIds, filteredEvents]);
    const availableTypes = useMemo(() => [...new Set(events.map(event => event.type))], [events]);

    const selectEvent = useCallback((event: NormalizedThreatEvent) => {
        setSelectedEventId(event.id); setFocus({ ...event.source, eventId: event.id, zoom: 5 }); setIntelligenceOpen(true);
        const original = originalEvent(event);
        if (original) onThreatClick?.(original);
    }, [onThreatClick, originalEvent]);
    const selectCountry = useCallback((id: string) => {
        setSelectedCountryId(id); setSelectedEventId(null); setClusterIds([]); setIntelligenceOpen(true);
    }, []);
    const selectCluster = useCallback((cluster: ThreatCluster) => {
        setClusterIds(cluster.events.map(event => event.id)); setClusterPage(0); setSelectedEventId(null); setIntelligenceOpen(true);
    }, []);
    const reportRendererError = useCallback((error: MapError) => {
        setRendererLoading(false); setMapError(error); onErrorRef.current?.(error.message);
        if (!error.recoverable) setMapMode('flat');
    }, []);
    const rendererReady = useCallback(() => setRendererLoading(false), []);
    const changeMode = (mode: MapMode) => { if (mode !== mapMode) { setMapMode(mode); setRendererLoading(mode === 'globe'); setHoveredCountryId(null); } };
    const clearCountryFilter = () => { setCountryFilter(null); setRegion(null); };
    const selectSearchResult = (result: MapSearchResult) => {
        setSearchOpen(false);
        if (result.event) selectEvent(result.event);
        if (result.country) selectCountry(result.country.id);
        setFocus(result.focus);
    };
    const fullscreen = async () => {
        try {
            if (document.fullscreenElement === wrapper.current) await document.exitFullscreen();
            else await wrapper.current?.requestFullscreen();
        } catch { setMapError({ code: 'RENDERER', message: 'Fullscreen could not open. Try the fullscreen button again.', recoverable: true }); }
    };
    const command = (action: 'in' | 'out' | 'reset') => {
        if (action === 'reset') setFocus(null);
        setViewCommand(previous => ({ action, sequence: (previous?.sequence ?? 0) + 1 }));
    };
    const rendererProps: RendererProps = { countries, events: filteredEvents, investigations, activity, selectedEventId, selectedCountryId, hoveredCountryId, countryFilter, displayMode, showConnections, focus, viewCommand, onEventSelect: selectEvent, onCountrySelect: selectCountry, onCountryHover: setHoveredCountryId, onClusterSelect: selectCluster };

    return <div ref={wrapper} className="cyber-map-wrapper" data-lenis-prevent>
        <MapToolbar mapMode={mapMode} displayMode={displayMode} isLive={isLive} isFullscreen={isFullscreen} feedState={feedState} showConnections={showConnections}
            type={type} severity={severity} typeEditable={filterType === undefined || !!onFilterTypeChange} severityEditable={filterSeverity === undefined || !!onFilterSeverityChange} availableTypes={availableTypes}
            timeRange={timeRange} customStart={customStart} customEnd={customEnd} timeError={timeError} query={query} searchOpen={searchOpen} results={results}
            onModeChange={changeMode} onDisplayChange={setDisplayMode} onLiveChange={setIsLive} onFullscreen={() => void fullscreen()} onConnectionsChange={setShowConnections}
            onTypeChange={onFilterTypeChange ?? setLocalType} onSeverityChange={onFilterSeverityChange ?? setLocalSeverity} onTimeChange={setTimeRange}
            onCustomStartChange={setCustomStart} onCustomEndChange={setCustomEnd} onQueryChange={setQuery} onSearchOpenChange={setSearchOpen} onSearchSelect={selectSearchResult} />
        <div className="ctm-context-bar">
            <nav aria-label="Intelligence drilldown"><button type="button" onClick={() => { clearCountryFilter(); setSelectedCountryId(null); setSelectedEventId(null); setClusterIds([]); }}>Global</button>
                {selectedCountry && <><ChevronRight size={12} /><button type="button" onClick={() => { setSelectedEventId(null); setRegion(null); }}>{selectedCountry.properties.name}</button></>}
                {region && <><ChevronRight size={12} /><span>{region}</span></>}
                {selectedEvent && <><ChevronRight size={12} /><span>Event</span></>}
            </nav>
            <div className="ctm-context-status">{!isLive && <span className="ctm-paused-label">Paused at {new Date(now).toLocaleTimeString()}</span>}{countryFilter && <button type="button" onClick={clearCountryFilter}>Clear country filter<X size={12} /></button>}<span>{filteredEvents.length.toLocaleString()} events</span></div>
        </div>
        {mapError && <div className="ctm-notice" role="status"><span>{mapError.message}</span>{mapError.code === 'GEOGRAPHIC_DATA' ? <button type="button" onClick={() => setGeographicAttempt(attempt => attempt + 1)}>Retry map</button> : <button type="button" className="ctm-icon-button" aria-label="Dismiss map notice" onClick={() => { setMapError(null); onErrorRef.current?.(null); }}><X size={14} /></button>}</div>}
        {(feedState === 'unavailable' || feedState === 'disconnected') && <div className="ctm-notice" role="status">{feedState === 'unavailable' ? 'Live threat feed is unavailable.' : 'Live feed disconnected. Waiting for the existing connection to recover.'} Retained events remain available.</div>}
        <div className="ctm-workspace">
            <aside className="ctm-sidebar ctm-feed-sidebar"><details open={feedOpen} onToggle={event => setFeedOpen(event.currentTarget.open)}>
                <summary><span className={`ctm-status-dot is-${feedState}`} />{isLive ? 'Live threat feed' : 'Paused threat feed'}<span className="ctm-count">{filteredEvents.length}</span></summary>
                <ThreatFeed events={filteredEvents} selectedEventId={selectedEventId} onSelect={selectEvent} page={feedPage} onPageChange={setFeedPage} emptyText={threatLoading ? 'Connecting to the threat feed…' : events.length === 0 ? 'No threat events are available yet.' : 'No events match the current filters.'} />
            </details></aside>
            <main className="ctm-map-viewport" aria-label="Threat map viewport">
                <div className="ctm-map-corner-label"><span>GLOBAL THREAT INTELLIGENCE</span><small>{mapMode === 'globe' ? 'Earth · geographic view' : 'World · equirectangular projection'}</small></div>
                {countries.length > 0 && (mapMode === 'globe' ? <GlobeView {...rendererProps} onError={reportRendererError} onReady={rendererReady} /> : <FlatWorldMap {...rendererProps} />)}
                {(geographicLoading || (mapMode === 'globe' && rendererLoading && countries.length > 0)) && <div className="ctm-loading" role="status"><span className="ctm-loader" />{geographicLoading ? 'Loading country boundaries…' : 'Preparing Earth…'}</div>}
                {!geographicLoading && !countries.length && <div className="ctm-loading">Geographic data unavailable</div>}
                {hoveredCountry && <div className="ctm-country-tooltip" role="status"><strong>{hoveredCountry.properties.name}</strong><span>{activity.get(hoveredCountry.id)?.count ?? 0} events in current view</span><small>Select for country intelligence</small></div>}
                {!filteredEvents.length && !threatLoading && countries.length > 0 && <div className="ctm-map-empty">{events.length ? 'No events in the selected filters and time range' : 'Waiting for threat data'}</div>}
                <div className="ctm-camera-controls" role="group" aria-label="Map navigation"><button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => command('in')}><Plus size={16} /></button><button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => command('out')}><Minus size={16} /></button><button type="button" title="Reset view" onClick={() => command('reset')}><RotateCcw size={14} /><span>Reset view</span></button></div>
            </main>
            <aside className="ctm-sidebar ctm-intelligence-sidebar"><details open={intelligenceOpen} onToggle={event => setIntelligenceOpen(event.currentTarget.open)}>
                <summary>Intelligence<span className="ctm-count">{selectedEvent ? 'Event' : selectedCountry ? 'Country' : 'Global'}</span></summary>
                <NodeStatistics statistics={statistics} feedState={feedState} isLive={isLive} />
                {selectedEventId && !selectedEvent && <p className="ctm-data-note">The selected event is outside the current filters. Adjust the filters to view its details.</p>}
                {selectedEvent && <EventDetails event={selectedEvent} onClose={() => setSelectedEventId(null)} onFocus={() => setFocus({ ...selectedEvent.source, eventId: selectedEvent.id, zoom: 5 })} />}
                {selectedCountry && <CountryIntelligence country={selectedCountry} statistics={countryStatistics} events={countryEvents} sourceCount={activity.get(selectedCountry.id)?.sourceCount ?? 0} destinationCount={activity.get(selectedCountry.id)?.destinationCount ?? 0}
                    region={region} regions={regions} filtered={countryFilter === selectedCountry.id} onFilter={() => { setCountryFilter(selectedCountry.id); setRegion(null); }} onClearFilter={clearCountryFilter}
                    onRegion={value => { setCountryFilter(selectedCountry.id); setRegion(value); }} onSelect={selectEvent} onClose={() => { setSelectedCountryId(null); clearCountryFilter(); }} />}
                {clusterIds.length > 0 && <section className="ctm-cluster-panel"><div className="ctm-panel-heading"><span>Cluster · {clusterEvents.length} events</span><button type="button" className="ctm-icon-button" aria-label="Close cluster" onClick={() => setClusterIds([])}><X size={14} /></button></div><ThreatFeed events={clusterEvents} selectedEventId={selectedEventId} onSelect={selectEvent} page={clusterPage} onPageChange={setClusterPage} /></section>}
                {!selectedCountry && !selectedEvent && !clusterIds.length && <p className="ctm-intelligence-hint">Select a country to explore its activity, or select an event to inspect the source and available intelligence.</p>}
                {selectedCountry && <button type="button" className="ctm-country-focus" onClick={() => setFocus({ ...countryFocus(selectedCountry), zoom: 3 })}>Focus {selectedCountry.properties.name}</button>}
            </details></aside>
        </div>
        <MapLegend displayMode={displayMode} connections={showConnections} investigations={investigations.length > 0} />
        <footer className="ctm-footer"><span>Available feed history · {events.length.toLocaleString()} retained{limited ? ' · retention limit reached' : ''}{rejectedCount > 0 ? ` · ${rejectedCount} invalid records excluded` : ''}</span><span>Boundaries: Natural Earth · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span></footer>
    </div>;
}
