const fs = require('node:fs');
const path = require('node:path');
const { parseDotenv, parseRaw } = require('./prepare-env.cjs');
function missingSourceSettings(base) {
  const production = path.join(base, '.env.production');
  const file = fs.existsSync(production) ? '.env.production' : 'Backend/.env';
  const values = (file === '.env.production' ? parseRaw : parseDotenv)(fs.readFileSync(path.join(base, file), 'utf8'));
  // Never prompt for or replace credentials of an already managed database.
  const keys = values.DEPLOYMENT_STACK === 'managed' || values.DATABASE_URL?.trim() ? [] :
    ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD'].filter(key => !values[key]?.trim());
  return { file, keys };
}
if (require.main === module) {
  try { const result = missingSourceSettings(process.cwd()); console.log([result.file, ...result.keys].join('\n')); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { missingSourceSettings };
