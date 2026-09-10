const fs = require('node:fs');
const topojson = require('topojson-client');
// The ISO table used to be scraped out of a source file in another project on
// this machine. It now lives here so the build depends on nothing outside it.
const table = JSON.parse(fs.readFileSync(`${__dirname}/iso-alpha2-numeric.json`, 'utf8'));
const byNumeric = new Map(Object.entries(table).map(([alpha2, numeric]) => [numeric, alpha2]));
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
