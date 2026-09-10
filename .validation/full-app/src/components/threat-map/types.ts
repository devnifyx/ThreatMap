import type { Feature, MultiPolygon, Polygon } from 'geojson';

export type NormalizedSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MapMode = 'globe' | 'flat';
export type ThreatDisplayMode = 'events' | 'heatmap';
export type TimeRangePreset = '15m' | '1h' | '6h' | '24h' | '7d' | 'custom';
export type FeedState = 'connecting' | 'live' | 'disconnected' | 'unavailable';

// Kept compatible with the original public component contract.
export interface ThreatData {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;
    source: { lat: number; lng: number; country: string };
    destination?: { lat: number; lng: number; country: string };
}

export interface ScanOverlayPoint {
    id: string;
    target: string;
    kind: string;
    lat: number;
    lng: number;
    country: string;
}

export interface GeographicPoint {
    latitude: number;
    longitude: number;
    country?: string;
    countryCode?: string;
    region?: string;
    city?: string;
}

export interface NormalizedThreatEvent {
    id: string;
    type: string;
    severity: NormalizedSeverity;
    timestamp: string;
    source: GeographicPoint;
    destination?: GeographicPoint;
    ioc?: string;
    identifier?: string;
    metadata?: Record<string, unknown>;
}

export interface InvestigationPoint extends GeographicPoint {
    id: string;
    target: string;
    kind: string;
}

export type CountryFeature = Feature<Polygon | MultiPolygon, {
    name: string;
    countryCode?: string;
}> & { id: string };

export interface MapFocusTarget {
    latitude: number;
    longitude: number;
    zoom?: number;
    eventId?: string;
    countryCode?: string;
}

export interface ThreatCluster extends GeographicPoint {
    id: string;
    count: number;
    events: NormalizedThreatEvent[];
    severity: NormalizedSeverity;
}

export interface CountryActivity {
    count: number;
    sourceCount: number;
    destinationCount: number;
    severity: NormalizedSeverity;
}

export interface ThreatStatistics {
    eventCount: number;
    sourceCount: number;
    destinationCount: number;
    severity?: NormalizedSeverity;
    bySeverity: Record<NormalizedSeverity, number>;
    byType: [string, number][];
}

export interface MapSearchResult {
    id: string;
    label: string;
    description: string;
    focus: MapFocusTarget;
    event?: NormalizedThreatEvent;
    country?: CountryFeature;
}

export interface RendererProps {
    countries: CountryFeature[];
    events: NormalizedThreatEvent[];
    investigations: InvestigationPoint[];
    activity: Map<string, CountryActivity>;
    selectedEventId: string | null;
    selectedCountryId: string | null;
    hoveredCountryId: string | null;
    countryFilter: string | null;
    displayMode: ThreatDisplayMode;
    showConnections: boolean;
    focus: MapFocusTarget | null;
    viewCommand: { action: 'in' | 'out' | 'reset'; sequence: number } | null;
    onEventSelect: (event: NormalizedThreatEvent) => void;
    onCountrySelect: (id: string) => void;
    onCountryHover: (id: string | null) => void;
    onClusterSelect: (cluster: ThreatCluster) => void;
}

export interface MapError {
    code: 'GEOGRAPHIC_DATA' | 'RENDERER' | 'SOCKET' | 'INVALID_DATA';
    message: string;
    recoverable: boolean;
}

export const SEVERITIES: NormalizedSeverity[] = ['critical', 'high', 'medium', 'low'];
export const SEVERITY_COLORS: Record<NormalizedSeverity, string> = {
    critical: '#ef727b', high: '#eca65c', medium: '#e0cf79', low: '#80b8ac',
};
export const THREAT_TYPES = ['all', 'DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'];
