const fs = require('node:fs');
const data = JSON.parse(fs.readFileSync('threat-map/assets/countries.geo.json','utf8'));
const ids = data.features.map(f=>f.id);
console.log('Duplicate country IDs:', ids.filter((id,i)=>ids.indexOf(id)!==i));
console.log('Unmapped:',data.features.filter(f=>!f.properties.countryCode).map(f=>[f.id,f.properties.name]));
