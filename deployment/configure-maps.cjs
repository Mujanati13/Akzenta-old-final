const fs = require('node:fs');
const token = process.env.MAPBOX_PUBLIC_TOKEN || '';
if (token && !/^pk\.[A-Za-z0-9._-]+$/.test(token)) throw new Error('Only a public Mapbox token can be bundled');
const file = 'src/environments/.env.ts';
fs.writeFileSync(file, 'export const env: { [s: string]: string | null } = ' + JSON.stringify({npm_package_version: '0.0.0', MAPBOX_PUBLIC_TOKEN: token}) + ';\n');
