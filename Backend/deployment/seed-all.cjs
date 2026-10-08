const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {Client} = require('pg');
const bcrypt = require('bcryptjs');
const europe = require('./seeds/europe.json');
const germany = require('./seeds/germany.json');
const normalize = name => String(name || '').trim().toLowerCase();
async function seed(client, credentialsFile) {
  const credentials = fs.existsSync(credentialsFile) ? JSON.parse(fs.readFileSync(credentialsFile, 'utf8')) : {};
  const counts = {countries: 0, cities: 0, users: 0};
  await client.query('BEGIN');
  try {
    await client.query('SELECT pg_advisory_xact_lock(812732)');
    await client.query('LOCK TABLE countries, cities, "user", akzente, role, status, user_type, merchandiser_status, "report-status" IN SHARE ROW EXCLUSIVE MODE');
    for (const table of ['countries', 'cities', 'user', 'akzente', 'report-status']) {
      await client.query(`SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), GREATEST((SELECT COALESCE(MAX(id), 1) FROM "${table}"), nextval(pg_get_serial_sequence('"${table}"', 'id'))), true)`);
    }
    const lookups = {role: ['Admin','User'], status: ['Active','Inactive'], user_type: ['akzente','client','merchandiser'], merchandiser_status: ['neu','team','out']};
    for (const [table, names] of Object.entries(lookups)) for (let i=0;i<names.length;i++) await client.query(`INSERT INTO "${table}" (id,name) VALUES ($1,$2) ON CONFLICT (id) DO NOTHING`, [i+1,names[i]]);
    const reports = [
      ['pending','Pending','Pending','Pending','#9E9E9E','#9E9E9E','#9E9E9E'],
      ['scheduled','Scheduled','Scheduled','Scheduled','#00709B','#00709B','#00709B'],
      ['submitted','Review','Scheduled','Submitted','#FF8C00','#00709B','#CCAF08'],
      ['approved','Done','Available','Done','#6FCC08','#08C6CC','#6FCC08'],
      ['viewed','Done','Done','Done','#6FCC08','#6FCC08','#6FCC08']];
    for (let i=0;i<reports.length;i++) await client.query('INSERT INTO "report-status" (id,name,"akzenteName","clientName","merchandiserName","akzenteColor","clientColor","merchandiserColor") VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING',[i+1,...reports[i]]);
    const existingCountries = (await client.query('SELECT id,name FROM countries')).rows;
    const countryIds = new Map();
    for (const country of europe.countries) {
      let found = existingCountries.find(c => ['en','de','fr'].some(lang => c.name[lang] && normalize(c.name[lang]) === normalize(country.name[lang])));
      if (!found) {
        found = (await client.query('INSERT INTO countries (name,flag,"createdAt","updatedAt") VALUES ($1,NULL,NOW(),NOW()) RETURNING id,name',[country.name])).rows[0];
        existingCountries.push(found); counts.countries++;
      }
      countryIds.set(country.sourceId,found.id);
    }
    const existingCities = (await client.query('SELECT name,"countryId" FROM cities')).rows;
    const known = new Set(existingCities.map(c => c.countryId + ':' + normalize(c.name)));
    const cities = [...europe.cities, ...germany.map(c => ({...c,countrySourceId:1}))];
    for (const city of cities) {
      const countryId = countryIds.get(city.countrySourceId);
      const key = countryId + ':' + normalize(city.name);
      if (known.has(key)) continue;
      await client.query('INSERT INTO cities (name,coordinates,"countryId","createdAt","updatedAt") VALUES ($1,$2,$3,NOW(),NOW())',[city.name,city.coordinates,countryId]);
      known.add(key); counts.cities++;
    }
    for (const account of [{email:'admin@example.com',firstName:'Super',lastName:'Admin',role:1},{email:'john.doe@example.com',firstName:'John',lastName:'Doe',role:2}]) {
      const existing = (await client.query('SELECT id FROM "user" WHERE email=$1',[account.email])).rows;
      if (existing.length) continue;
      credentials[account.email] ||= crypto.randomBytes(24).toString('base64url');
      const hash = await bcrypt.hash(credentials[account.email],12);
      const user = (await client.query(`INSERT INTO "user" (email,password,provider,"firstName","lastName","roleId","statusId","typeId","createdAt","updatedAt") VALUES ($1,$2,'email',$3,$4,$5,1,1,NOW(),NOW()) RETURNING id`,[account.email,hash,account.firstName,account.lastName,account.role])).rows[0];
      await client.query('INSERT INTO akzente (user_id,"createdAt","updatedAt") VALUES ($1,NOW(),NOW())',[user.id]);
      counts.users++;
    }
    fs.writeFileSync(credentialsFile + '.tmp', JSON.stringify(credentials,null,2)+'\n', {mode:0o600});
    fs.renameSync(credentialsFile + '.tmp',credentialsFile);
    await client.query('COMMIT');
    return counts;
  } catch (error) {await client.query('ROLLBACK'); throw error;}
}
async function main() {
  const e=process.env;
  if(e.NODE_ENV !== 'production' || e.DATABASE_HOST !== 'postgres' || e.DATABASE_SYNCHRONIZE !== 'false') throw new Error('Seeding requires the managed production Docker database');
  const client = new Client({host:e.DATABASE_HOST,port:Number(e.DATABASE_PORT || 5432),database:e.DATABASE_NAME,user:e.DATABASE_USERNAME,password:e.DATABASE_PASSWORD,connectionTimeoutMillis:15000});
  await client.connect();
  try {console.log('Seed data added:',await seed(client,'/seed-output/seeder-credentials.json'));}
  finally {await client.end();}
}
if(require.main === module) main().catch(error => {console.error(error.message);process.exitCode=1;});
module.exports = {seed,normalize};
