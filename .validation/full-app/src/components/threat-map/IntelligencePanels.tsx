import { ChevronRight, Crosshair, X } from 'lucide-react';
import { SEVERITIES, SEVERITY_COLORS } from './types';
import type { CountryFeature, FeedState, GeographicPoint, NormalizedThreatEvent, ThreatDisplayMode, ThreatStatistics } from './types';

export function SeverityBadge({ severity }: { severity: NormalizedThreatEvent['severity'] }) {
    return <span className="ctm-severity" style={{ color: SEVERITY_COLORS[severity] }}>{severity}</span>;
}

interface ThreatFeedProps {
    events: NormalizedThreatEvent[];
    selectedEventId: string | null;
    onSelect: (event: NormalizedThreatEvent) => void;
    emptyText?: string;
    page: number;
    onPageChange: (page: number) => void;
}

export function ThreatFeed({ events, selectedEventId, onSelect, emptyText = 'No events match the current filters.', page, onPageChange }: ThreatFeedProps) {
    const pageSize = 30;
    const pages = Math.max(1, Math.ceil(events.length / pageSize));
    const current = Math.min(page, pages - 1);
    return <>
        <ol className="ctm-feed-list">
            {events.slice(current * pageSize, (current + 1) * pageSize).map(event => <li key={event.id}>
                <button type="button" aria-pressed={selectedEventId === event.id} onClick={() => onSelect(event)}>
                    <div className="ctm-feed-top"><SeverityBadge severity={event.severity} /><time dateTime={event.timestamp} title={new Date(event.timestamp).toLocaleString()}>{new Date(event.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</time></div>
                    <strong>{event.type}</strong>
                    <span className="ctm-feed-route">{event.source.country ?? 'Source coordinates'}{event.destination ? <> → {event.destination.country ?? 'Destination coordinates'}</> : <small> · source only</small>}</span>
                </button>
            </li>)}
        </ol>
        {!events.length && <p className="ctm-empty">{emptyText}</p>}
        {pages > 1 && <div className="ctm-pagination"><button type="button" disabled={current === 0} onClick={() => onPageChange(current - 1)}>Previous</button><span>{current + 1} / {pages}</span><button type="button" disabled={current + 1 === pages} onClick={() => onPageChange(current + 1)}>Next</button></div>}
    </>;
}

export function NodeStatistics({ statistics, feedState, isLive }: { statistics: ThreatStatistics; feedState: FeedState; isLive: boolean }) {
    return <section className="ctm-statistics" aria-label="Node statistics">
        <div className="ctm-section-heading">Node statistics</div>
        <div className="ctm-event-total"><strong>{statistics.eventCount.toLocaleString()}</strong><span>events in view</span></div>
        <dl className="ctm-facts">
            <div><dt>Feed status</dt><dd className={`ctm-status-text is-${feedState}`}>{feedState}</dd></div>
            <div><dt>Visualization</dt><dd>{isLive ? 'Live' : 'Paused'}</dd></div>
            <div><dt>Source locations</dt><dd>{statistics.sourceCount.toLocaleString()}</dd></div>
            {statistics.destinationCount > 0 && <div><dt>Destination locations</dt><dd>{statistics.destinationCount.toLocaleString()}</dd></div>}
            <div><dt>Highest severity</dt><dd>{statistics.severity ? <SeverityBadge severity={statistics.severity} /> : 'Unavailable'}</dd></div>
        </dl>
        <div className="ctm-severity-counts">{SEVERITIES.map(severity => <div key={severity}><i style={{ background: SEVERITY_COLORS[severity] }} /><span>{severity}</span><b>{statistics.bySeverity[severity].toLocaleString()}</b></div>)}</div>
        <p className="ctm-data-note">Counts reflect the current filters. Locations are unique coordinate pairs, not confirmed sensor nodes.</p>
    </section>;
}

interface CountryIntelligenceProps {
    country: CountryFeature;
    statistics: ThreatStatistics;
    events: NormalizedThreatEvent[];
    sourceCount: number;
    destinationCount: number;
    region: string | null;
    regions: string[];
    filtered: boolean;
    onFilter: () => void;
    onClearFilter: () => void;
    onRegion: (region: string | null) => void;
    onSelect: (event: NormalizedThreatEvent) => void;
    onClose: () => void;
}

export function CountryIntelligence(p: CountryIntelligenceProps) {
    return <section className="ctm-country-intelligence" aria-label="Country intelligence">
        <div className="ctm-panel-heading"><span>Country intelligence</span><button type="button" className="ctm-icon-button" aria-label="Close country intelligence" onClick={p.onClose}><X size={15} /></button></div>
        <h2>{p.country.properties.name}</h2><span className="ctm-country-code">{p.country.properties.countryCode ?? 'Natural Earth boundary'}</span>
        <dl className="ctm-facts"><div><dt>Events</dt><dd>{p.statistics.eventCount}</dd></div><div><dt>Source events</dt><dd>{p.sourceCount}</dd></div><div><dt>Destination events</dt><dd>{p.destinationCount}</dd></div></dl>
        <button type="button" className="ctm-action-button" onClick={p.filtered ? p.onClearFilter : p.onFilter}>{p.filtered ? 'Clear country filter' : `Filter to ${p.country.properties.name}`}</button>
        {p.regions.length > 0 && <label className="ctm-region-select">Region<select aria-label="Country region" value={p.region ?? ''} onChange={event => p.onRegion(event.target.value || null)}><option value="">All available regions</option>{p.regions.map(region => <option key={region}>{region}</option>)}</select></label>}
        {p.statistics.eventCount > 0 ? <>
            <div className="ctm-section-heading">Severity breakdown</div><div className="ctm-severity-counts">{SEVERITIES.map(severity => <div key={severity}><i style={{ background: SEVERITY_COLORS[severity] }} /><span>{severity}</span><b>{p.statistics.bySeverity[severity]}</b></div>)}</div>
            <div className="ctm-section-heading">Top threat types</div><dl className="ctm-facts">{p.statistics.byType.slice(0, 5).map(([type, count]) => <div key={type}><dt>{type}</dt><dd>{count}</dd></div>)}</dl>
            <div className="ctm-section-heading">Recent events</div><ul className="ctm-recent-events">{p.events.slice(0, 5).map(event => <li key={event.id}><button type="button" onClick={() => p.onSelect(event)}><SeverityBadge severity={event.severity} /><span>{event.type}</span><ChevronRight size={12} /></button></li>)}</ul>
        </> : <p className="ctm-empty">No matching events are available for this country.</p>}
    </section>;
}

function GeographicDetails({ label, point }: { label: string; point: GeographicPoint }) {
    return <><div className="ctm-section-heading">{label}</div><dl className="ctm-facts ctm-event-facts">
        {point.country && <div><dt>Country</dt><dd>{point.country}</dd></div>}{point.countryCode && <div><dt>Country code</dt><dd>{point.countryCode}</dd></div>}
        {point.region && <div><dt>Region</dt><dd>{point.region}</dd></div>}{point.city && <div><dt>City</dt><dd>{point.city}</dd></div>}
        <div><dt>Latitude</dt><dd>{String(point.latitude)}</dd></div><div><dt>Longitude</dt><dd>{String(point.longitude)}</dd></div>
    </dl></>;
}

export function EventDetails({ event, onClose, onFocus }: { event: NormalizedThreatEvent; onClose: () => void; onFocus: () => void }) {
    const metadata = Object.entries(event.metadata ?? {}).filter(([, value]) => typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
    return <section className="ctm-event-details" aria-label="Event details" tabIndex={-1}>
        <div className="ctm-panel-heading"><span>Event details</span><button type="button" className="ctm-icon-button" aria-label="Close event details" onClick={onClose}><X size={15} /></button></div>
        <h2>{event.type}</h2><SeverityBadge severity={event.severity} />
        <dl className="ctm-facts ctm-event-facts"><div><dt>Event ID</dt><dd>{event.id}</dd></div><div><dt>Event time</dt><dd><time dateTime={event.timestamp} title={event.timestamp}>{new Date(event.timestamp).toLocaleString()}</time></dd></div>
            {event.identifier && <div><dt>Identifier</dt><dd>{event.identifier}</dd></div>}{event.ioc && <div><dt>IOC</dt><dd>{event.ioc}</dd></div>}
        </dl>
        <GeographicDetails label="Source" point={event.source} />
        {event.destination ? <GeographicDetails label="Destination" point={event.destination} /> : <p className="ctm-source-note">Source-only event. Destination information is unavailable.</p>}
        {metadata.length > 0 && <><div className="ctm-section-heading">Related information</div><dl className="ctm-facts ctm-event-facts">{metadata.map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{String(value)}</dd></div>)}</dl></>}
        <button type="button" className="ctm-action-button" onClick={onFocus}><Crosshair size={14} />Focus location</button>
        <p className="ctm-data-note">Event values are supplied by the feed. Summary counts are calculated from available events.</p>
    </section>;
}

export function MapLegend({ displayMode, connections, investigations }: { displayMode: ThreatDisplayMode; connections: boolean; investigations: boolean }) {
    return <div className="ctm-legend" aria-label="Threat legend">
        {displayMode === 'events' ? <>{[...SEVERITIES].reverse().map(severity => <span key={severity}><i style={{ background: SEVERITY_COLORS[severity] }} />{severity}</span>)}<span className="ctm-legend-symbol">◉ Cluster count</span>{connections && <span className="ctm-legend-symbol">→ Source to destination</span>}</>
            : <><span>Event density</span><span className="ctm-heat-scale" /><span>Lower → Higher</span></>}
        {investigations && <span className="ctm-legend-symbol">◇ Investigated location</span>}
    </div>;
}
