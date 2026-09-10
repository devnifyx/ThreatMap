import { StrictMode, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { MapLibreGlobe } from './components/threat-map/MapLibreGlobe';
import type { NormalizedSeverity, NormalizedThreatEvent } from './components/threat-map/types';
import './prototype.css';

// The live feed is not connected in this harness, so the prototype ships its own
// deterministic sample so that clustering and zoom behaviour are actually visible.
const CITIES: [string, string, number, number][] = [
    ['Stara Zagora', 'Bulgaria', 42.4218, 25.6366],
    ['Sofia', 'Bulgaria', 42.6977, 23.3219],
    ['Bucharest', 'Romania', 44.4268, 26.1025],
    ['Istanbul', 'Turkey', 41.0082, 28.9784],
    ['Kuala Lumpur', 'Malaysia', 3.139, 101.6869],
    ['Singapore', 'Singapore', 1.3521, 103.8198],
    ['Jakarta', 'Indonesia', -6.2088, 106.8456],
    ['Tokyo', 'Japan', 35.6762, 139.6503],
    ['Seoul', 'South Korea', 37.5665, 126.978],
    ['Mumbai', 'India', 19.076, 72.8777],
    ['Dubai', 'UAE', 25.2048, 55.2708],
    ['Frankfurt', 'Germany', 50.1109, 8.6821],
    ['Amsterdam', 'Netherlands', 52.3676, 4.9041],
    ['London', 'UK', 51.5074, -0.1278],
    ['Paris', 'France', 48.8566, 2.3522],
    ['New York', 'USA', 40.7128, -74.006],
    ['Ashburn', 'USA', 39.0438, -77.4874],
    ['San Francisco', 'USA', 37.7749, -122.4194],
    ['Sao Paulo', 'Brazil', -23.5505, -46.6333],
    ['Lagos', 'Nigeria', 6.5244, 3.3792],
    ['Johannesburg', 'South Africa', -26.2041, 28.0473],
    ['Sydney', 'Australia', -33.8688, 151.2093],
    ['Moscow', 'Russia', 55.7558, 37.6173],
    ['Kyiv', 'Ukraine', 50.4501, 30.5234],
];
const TYPES = ['DDoS', 'Phishing', 'Malware', 'SQL Injection', 'Brute Force'];
const SEVERITIES: NormalizedSeverity[] = ['low', 'medium', 'high', 'critical'];

// A tiny seeded generator keeps the sample identical between reloads, so a
// rendering change is never confused for the data shifting underneath it.
function seeded(seed: number) {
    let state = seed;
    return () => { state = (state * 1103515245 + 12345) % 2147483648; return state / 2147483648; };
}

function sampleEvents(count: number): NormalizedThreatEvent[] {
    const random = seeded(20260910);
    return Array.from({ length: count }, (_, index) => {
        const [city, country, lat, lng] = CITIES[Math.floor(random() * CITIES.length)];
        // Scatter around the city so clusters actually split apart as you zoom.
        const spread = 0.35;
        return {
            id: `sample-${index}`,
            type: TYPES[Math.floor(random() * TYPES.length)],
            severity: SEVERITIES[Math.floor(random() * SEVERITIES.length)],
            timestamp: new Date(Date.now() - index * 15_000).toISOString(),
            source: {
                latitude: lat + (random() - 0.5) * spread,
                longitude: lng + (random() - 0.5) * spread,
                country,
                city,
            },
        };
    });
}

function Prototype() {
    const events = useMemo(() => sampleEvents(400), []);
    return <div className="proto-shell">
        <header className="proto-header">
            <div>
                <h1>MapLibre globe prototype</h1>
                <p>Tiled satellite imagery · clustering · globe and flat projection</p>
            </div>
            <a href="/index.html">← current Three.js map</a>
        </header>
        <MapLibreGlobe events={events} onEventSelect={id => console.log('selected', id)} />
        <footer className="proto-footer">
            Scroll to zoom. Keep going past the point where the old globe went soft — imagery is streamed per tile, so detail continues to street level.
        </footer>
    </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><Prototype /></StrictMode>);
