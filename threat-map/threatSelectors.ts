import { createCountryLookup, countryFocus } from './geographicData';
import { SEVERITIES } from './types';
import type { CountryActivity, CountryFeature, GeographicPoint, MapSearchResult, NormalizedThreatEvent, ThreatCluster, ThreatStatistics, TimeRangePreset } from './types';

export const TIME_RANGES: Record<Exclude<TimeRangePreset, 'custom'>, number> = {
    '15m': 900_000, '1h': 3_600_000, '6h': 21_600_000, '24h': 86_400_000, '7d': 604_800_000,
};
export const typeKey = (value: string) => value.trim().toLowerCase().replace(/[\s_-]+/g, ' ');

export interface ThreatFilters {
    type: string;
    severity: string;
    start: number;
    end: number;
    countryId: string | null;
    region?: string | null;
}

export function eventInCountry(event: NormalizedThreatEvent, id: string, lookup: (point: GeographicPoint) => CountryFeature | undefined): boolean {
    return lookup(event.source)?.id === id || (!!event.destination && lookup(event.destination)?.id === id);
}

export function filterThreatEvents(events: NormalizedThreatEvent[], filters: ThreatFilters, countries: CountryFeature[]): NormalizedThreatEvent[] {
    const lookup = createCountryLookup(countries);
    return events.filter(event => {
        const time = Date.parse(event.timestamp);
        return (filters.type === 'all' || typeKey(event.type) === typeKey(filters.type))
            && (filters.severity === 'all' || event.severity === filters.severity.toLowerCase())
            && time >= filters.start && time <= filters.end
            && (!filters.countryId || eventInCountry(event, filters.countryId, lookup))
            && (!filters.region || [event.source, event.destination].some(point => !!point && point.region === filters.region && (!filters.countryId || lookup(point)?.id === filters.countryId)));
    });
}

export function summarizeEvents(events: NormalizedThreatEvent[]): ThreatStatistics {
    const bySeverity: ThreatStatistics['bySeverity'] = { low: 0, medium: 0, high: 0, critical: 0 };
    const types = new Map<string, number>();
    const sources = new Set<string>();
    const destinations = new Set<string>();
    for (const event of events) {
        bySeverity[event.severity]++;
        types.set(event.type, (types.get(event.type) ?? 0) + 1);
        sources.add(`${event.source.latitude},${event.source.longitude}`);
        if (event.destination) destinations.add(`${event.destination.latitude},${event.destination.longitude}`);
    }
    return { eventCount: events.length, sourceCount: sources.size, destinationCount: destinations.size, severity: SEVERITIES.find(s => bySeverity[s] > 0), bySeverity, byType: [...types].sort((a, b) => b[1] - a[1]) };
}

export function countryActivity(events: NormalizedThreatEvent[], countries: CountryFeature[]): Map<string, CountryActivity> {
    const activity = new Map<string, CountryActivity>();
    const lookup = createCountryLookup(countries);
    for (const event of events) {
        const sourceId = lookup(event.source)?.id;
        const destinationId = event.destination ? lookup(event.destination)?.id : undefined;
        for (const id of new Set([sourceId, destinationId])) {
            if (!id) continue;
            const value = activity.get(id) ?? { count: 0, sourceCount: 0, destinationCount: 0, severity: event.severity };
            value.count++;
            if (id === sourceId) value.sourceCount++;
            if (id === destinationId) value.destinationCount++;
            if (SEVERITIES.indexOf(event.severity) < SEVERITIES.indexOf(value.severity)) value.severity = event.severity;
            activity.set(id, value);
        }
    }
    return activity;
}

// Geographic grid clustering bounds the marker count, including at high zoom.
// Longitude wraps and polar cells widen, so dateline neighbours stay together.
export function clusterThreatEvents(events: NormalizedThreatEvent[], cellDegrees: number): ThreatCluster[] {
    const cells = new Map<string, NormalizedThreatEvent[]>();
    for (const event of events) {
        const { latitude, longitude } = event.source;
        const row = Math.floor((latitude + 90) / cellDegrees);
        const centerLat = Math.min(90, (row + 0.5) * cellDegrees - 90);
        const columns = Math.max(1, Math.round(360 * Math.cos(centerLat * Math.PI / 180) / cellDegrees));
        const column = ((Math.round((longitude + 180) / 360 * columns) % columns) + columns) % columns;
        const key = `${row}:${column}`;
        const cell = cells.get(key);
        if (cell) cell.push(event); else cells.set(key, [event]);
    }
    return [...cells].map(([id, members]) => {
        let x = 0; let y = 0; let z = 0;
        for (const event of members) {
            const lat = event.source.latitude * Math.PI / 180;
            const lng = event.source.longitude * Math.PI / 180;
            x += Math.cos(lat) * Math.cos(lng); y += Math.cos(lat) * Math.sin(lng); z += Math.sin(lat);
        }
        return {
            id, count: members.length, events: members,
            latitude: members.length === 1 ? members[0].source.latitude : Math.atan2(z, Math.hypot(x, y)) * 180 / Math.PI,
            longitude: members.length === 1 ? members[0].source.longitude : Math.atan2(y, x) * 180 / Math.PI,
            severity: SEVERITIES.find(s => members.some(event => event.severity === s))!,
        };
    });
}

export function searchMap(query: string, events: NormalizedThreatEvent[], countries: CountryFeature[]): MapSearchResult[] {
    const text = query.trim().toLowerCase();
    if (!text) return [];
    const countryResults: MapSearchResult[] = countries.filter(country => country.properties.name.toLowerCase().includes(text) || country.properties.countryCode?.toLowerCase() === text)
        .slice(0, 8).map(country => ({ id: `country:${country.id}`, label: country.properties.name, description: 'Country', country, focus: { ...countryFocus(country), countryCode: country.properties.countryCode, zoom: 3 } }));
    const eventResults: MapSearchResult[] = events.filter(event => {
        const fields = [event.id, event.ioc, event.identifier, event.type, event.source.country, event.source.countryCode, event.source.city, event.destination?.country, event.destination?.city];
        return fields.some(field => field?.toLowerCase().includes(text));
    }).slice(0, 30).map(event => ({ id: `event:${event.id}`, label: event.ioc ?? event.identifier ?? event.id, description: `${event.type} · ${event.source.city ?? event.source.country ?? 'Source location'}`, event, focus: { ...event.source, eventId: event.id, zoom: 5 } }));
    return [...countryResults, ...eventResults];
}
