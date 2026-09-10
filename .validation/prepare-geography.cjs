const fs = require('node:fs');
const topojson = require('D:/LekirraX/node_modules/topojson-client');
const source = fs.readFileSync('D:/LekirraX/frontend/src/components/HostingCountriesMap.tsx', 'utf8');
const table = source.match(/const ISO_ALPHA2_TO_NUMERIC[^=]*=\s*\{([\s\S]*?)\};/)[1];
const byNumeric = new Map([...table.matchAll(/([A-Z]{2}):\s*'(\d+)'/g)].map(m => [m[2], m[1]]));
const topo = JSON.parse(fs.readFileSync('threat-map/assets/countries-50m.topo.json', 'utf8'));
const collection = topojson.feature(topo, topo.objects.countries);
const merged = new Map();
for (const f of collection.features) {
    const numeric = f.id == null ? undefined : String(f.id).padStart(3, '0');
    const code = numeric ? byNumeric.get(numeric) : undefined;
    f.id = code || `ne:${numeric || f.properties.name}`;
    f.properties = { name: f.properties.name, ...(code ? {countryCode: code} : {}) };
    const existing = merged.get(f.id);
    if (existing) {
        const polygons = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        existing.geometry = {type:'MultiPolygon',coordinates:[...polygons(existing.geometry),...polygons(f.geometry)]};
    } else merged.set(f.id, f);
}
collection.features = [...merged.values()];
fs.writeFileSync('threat-map/assets/countries.geo.json', JSON.stringify(collection));
console.log(`${collection.features.length} unique country features; ${collection.features.filter(f=>f.properties.countryCode).length} verified ISO mappings`);
