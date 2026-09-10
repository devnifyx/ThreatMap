import { geoBounds, geoCentroid, geoContains, geoEquirectangular, geoPath } from 'd3-geo';
import type { CountryFeature, GeographicPoint } from './types';
import { isRecord } from './threatNormalization';

export const MAP_WIDTH = 1200;
export const MAP_HEIGHT = 600;
export const worldProjection = geoEquirectangular().scale(MAP_WIDTH / (2 * Math.PI)).translate([MAP_WIDTH / 2, MAP_HEIGHT / 2]).precision(0.2);
export const worldPath = geoPath(worldProjection);
const paths = new WeakMap<CountryFeature, string>();

export function countryPath(country: CountryFeature): string {
    let path = paths.get(country);
    if (path === undefined) { path = worldPath(country) ?? ''; paths.set(country, path); }
    return path;
}

export function projectPoint(point: GeographicPoint): [number, number] {
    return worldProjection([point.longitude, point.latitude]) ?? [MAP_WIDTH / 2, MAP_HEIGHT / 2];
}

export function countryFocus(country: CountryFeature): GeographicPoint {
    const [longitude, latitude] = geoCentroid(country);
    return { latitude, longitude };
}

let countryPromise: Promise<CountryFeature[]> | undefined;

export function loadCountries(): Promise<CountryFeature[]> {
    countryPromise ??= fetch(new URL('./assets/countries.geo.json', import.meta.url).href)
        .then(async response => {
            if (!response.ok) throw new Error('Country data unavailable');
            const json: unknown = await response.json();
            if (!isRecord(json) || json.type !== 'FeatureCollection' || !Array.isArray(json.features)) throw new Error('Invalid country data');
            const countries = json.features.filter((feature: unknown): feature is CountryFeature => {
                if (!isRecord(feature) || feature.type !== 'Feature' || typeof feature.id !== 'string' || !isRecord(feature.properties) || typeof feature.properties.name !== 'string' || !isRecord(feature.geometry)) return false;
                return (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') && Array.isArray(feature.geometry.coordinates);
            });
            if (!countries.length) throw new Error('No country boundaries available');
            return countries;
        }).catch(error => { countryPromise = undefined; throw error; });
    return countryPromise;
}

// Metadata matching uses only explicit ISO codes or exact names from the
// bundled, trusted Natural Earth dataset. It never guesses from coordinates.
export function createCountryLookup(countries: CountryFeature[]) {
    const byCode = new Map(countries.filter(c => c.properties.countryCode).map(c => [c.properties.countryCode!, c]));
    const byName = new Map(countries.map(c => [c.properties.name.toLowerCase(), c]));
    return (point: GeographicPoint): CountryFeature | undefined => {
        if (point.countryCode) return byCode.get(point.countryCode);
        return point.country ? byName.get(point.country.toLowerCase()) : undefined;
    };
}

export function createCountryPicker(countries: CountryFeature[]) {
    const indexed = countries.map(country => ({ country, bounds: geoBounds(country) }));
    return (longitude: number, latitude: number): CountryFeature | undefined => indexed.find(({ country, bounds: [[west, south], [east, north]] }) => {
        const inLongitude = west <= east ? longitude >= west && longitude <= east : longitude >= west || longitude <= east;
        return inLongitude && latitude >= south && latitude <= north && geoContains(country, [longitude, latitude]);
    })?.country;
}
