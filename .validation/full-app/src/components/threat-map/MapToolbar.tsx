import { Globe2, Map, Search, Pause, Play, Maximize2, Minimize2, X, Layers, Radio, Route } from 'lucide-react';
import { SEVERITIES, THREAT_TYPES } from './types';
import type { FeedState, MapMode, MapSearchResult, ThreatDisplayMode, TimeRangePreset } from './types';

export interface MapToolbarProps {
    mapMode: MapMode;
    displayMode: ThreatDisplayMode;
    isLive: boolean;
    isFullscreen: boolean;
    feedState: FeedState;
    showConnections: boolean;
    type: string;
    severity: string;
    typeEditable: boolean;
    severityEditable: boolean;
    availableTypes: string[];
    timeRange: TimeRangePreset;
    customStart: string;
    customEnd: string;
    timeError: string | null;
    query: string;
    searchOpen: boolean;
    results: MapSearchResult[];
    onModeChange: (mode: MapMode) => void;
    onDisplayChange: (mode: ThreatDisplayMode) => void;
    onLiveChange: (live: boolean) => void;
    onFullscreen: () => void;
    onConnectionsChange: (visible: boolean) => void;
    onTypeChange: (type: string) => void;
    onSeverityChange: (severity: string) => void;
    onTimeChange: (preset: TimeRangePreset) => void;
    onCustomStartChange: (value: string) => void;
    onCustomEndChange: (value: string) => void;
    onQueryChange: (value: string) => void;
    onSearchOpenChange: (open: boolean) => void;
    onSearchSelect: (result: MapSearchResult) => void;
}

export function MapToolbar(p: MapToolbarProps) {
    const typeOptions = [...new Set([...THREAT_TYPES, ...p.availableTypes])];
    return <header className="ctm-toolbar">
        <div className="ctm-primary-controls">
            <div className="ctm-segment" role="group" aria-label="Map view">
                <button type="button" aria-pressed={p.mapMode === 'globe'} onClick={() => p.onModeChange('globe')}><Globe2 size={15} />3D Globe</button>
                <button type="button" aria-pressed={p.mapMode === 'flat'} onClick={() => p.onModeChange('flat')}><Map size={15} />2D Flat Map</button>
            </div>
            <div className="ctm-search">
                <form role="search" onSubmit={event => { event.preventDefault(); p.onSearchOpenChange(true); }}>
                    <Search size={15} aria-hidden="true" />
                    <input type="search" aria-label="Search IP, domain, IOC, country, or city" placeholder="Search IP, IOC, country, city…" value={p.query}
                        onChange={event => { p.onQueryChange(event.target.value); p.onSearchOpenChange(true); }} onFocus={() => p.onSearchOpenChange(true)}
                        onKeyDown={event => { if (event.key === 'Escape') p.onSearchOpenChange(false); }} />
                    {p.query && <button type="button" className="ctm-icon-button" aria-label="Clear search" onClick={() => { p.onQueryChange(''); p.onSearchOpenChange(false); }}><X size={14} /></button>}
                </form>
                {p.searchOpen && p.query.trim() && <div className="ctm-search-results">
                    <div className="ctm-search-caption">Countries and events in the current filters</div>
                    {p.results.length ? <ul>{p.results.map(result => <li key={result.id}><button type="button" onClick={() => p.onSearchSelect(result)}><span>{result.label}</span><small>{result.description}</small></button></li>)}</ul>
                        : <p role="status">No matching location or event. IP and IOC search requires those values in the feed.</p>}
                </div>}
            </div>
            <div className="ctm-live-controls">
                <span className={`ctm-feed-status is-${p.feedState}`}><Radio size={12} />{p.feedState}</span>
                <button type="button" className="ctm-pause" aria-pressed={!p.isLive} onClick={() => p.onLiveChange(!p.isLive)} title={p.isLive ? 'Pause visualization updates' : 'Resume visualization updates'}>
                    {p.isLive ? <Pause size={14} /> : <Play size={14} />}{p.isLive ? 'Pause' : 'Resume live'}
                </button>
                <button type="button" className="ctm-icon-button" onClick={p.onFullscreen} aria-label={p.isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'} title="Fullscreen">{p.isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}</button>
            </div>
        </div>
        <div className="ctm-secondary-controls">
            <div className="ctm-segment ctm-display-switch" role="group" aria-label="Threat display">
                <button type="button" aria-pressed={p.displayMode === 'events'} onClick={() => p.onDisplayChange('events')}><Radio size={13} />Events</button>
                <button type="button" aria-pressed={p.displayMode === 'heatmap'} onClick={() => p.onDisplayChange('heatmap')}><Layers size={13} />Heatmap</button>
            </div>
            <div className="ctm-time-controls" role="group" aria-label="Event time range">
                {(['15m', '1h', '6h', '24h', '7d', 'custom'] as TimeRangePreset[]).map(range => <button type="button" key={range} aria-pressed={p.timeRange === range} onClick={() => p.onTimeChange(range)}>{range.toUpperCase()}</button>)}
            </div>
            <button type="button" className="ctm-connections-toggle" aria-pressed={p.showConnections} onClick={() => p.onConnectionsChange(!p.showConnections)} title="Connections use confirmed source and destination coordinates"><Route size={14} />{p.showConnections ? 'Hide connections' : 'Show connections'}</button>
            {p.typeEditable && <label className="ctm-select-label">Threat<select aria-label="Threat type" value={p.type} onChange={event => p.onTypeChange(event.target.value)}>{typeOptions.map(type => <option key={type} value={type}>{type === 'all' ? 'ALL' : type.toUpperCase()}</option>)}</select></label>}
            {p.severityEditable && <label className="ctm-select-label">Severity<select aria-label="Severity" value={p.severity} onChange={event => p.onSeverityChange(event.target.value)}><option value="all">ALL</option>{SEVERITIES.map(severity => <option key={severity} value={severity}>{severity.toUpperCase()}</option>)}</select></label>}
            {!p.typeEditable && <span className="ctm-applied-filter">{p.type === 'all' ? 'All threat types' : p.type}</span>}
            {!p.severityEditable && p.severity !== 'all' && <span className="ctm-applied-filter">{p.severity}</span>}
        </div>
        {p.timeRange === 'custom' && <div className="ctm-custom-range">
            <label>From<input type="datetime-local" aria-label="Custom range start" value={p.customStart} onChange={event => p.onCustomStartChange(event.target.value)} /></label>
            <label>To<input type="datetime-local" aria-label="Custom range end" value={p.customEnd} onChange={event => p.onCustomEndChange(event.target.value)} /></label>
            <span>Local time · {Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
            {p.timeError && <span className="ctm-inline-error" role="alert">{p.timeError}</span>}
        </div>}
    </header>;
}
