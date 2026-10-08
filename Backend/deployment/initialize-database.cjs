require('reflect-metadata');
const { DataSource } = require('typeorm');
const path = require('node:path');
const bcrypt = require('bcryptjs');
async function initialize(dataSource, e) {
  if (e.DATABASE_INITIALIZATION !== 'fresh' || e.DATABASE_HOST !== 'postgres' || e.DATABASE_SYNCHRONIZE !== 'false') throw new Error('Fresh initialization is restricted to the managed Docker database');
  if (!e.BOOTSTRAP_ADMIN_EMAIL || !e.BOOTSTRAP_ADMIN_PASSWORD || e.BOOTSTRAP_ADMIN_PASSWORD.length < 24) throw new Error('Generated administrator credentials are missing');
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  try {
    if (dataSource.entityMetadatas.length < 50) throw new Error('Compiled entity discovery failed');
    await runner.connect();
    await runner.startTransaction();
    await runner.query("SELECT pg_advisory_xact_lock(812731)");
    const tables = await runner.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public'");
    if (tables.length && tables.some(t => t.tablename === 'akzente_initial_baseline')) {
      const marker = await runner.query('SELECT version FROM public.akzente_initial_baseline WHERE version = 1');
      if (marker.length) { await runner.commitTransaction(); console.log('Fresh baseline already initialized; data retained.'); return; }
    }
    if (tables.length) throw new Error('Database already contains tables; refusing fresh initialization');
    await runner.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    // Explicit initial baseline, applied once to an empty database. Runtime sync stays disabled.
    const baseline = await dataSource.driver.createSchemaBuilder().log();
    if (!baseline.upQueries.length) throw new Error('Initial schema is empty');
    for (const {query, parameters} of baseline.upQueries) await runner.query(query, parameters);
    const repo = table => {
      const entity = dataSource.entityMetadatas.find(m => m.tableName === table);
      if (!entity) throw new Error('Required entity missing: ' + table);
      return runner.manager.getRepository(entity.target);
    };
    await repo('role').save([{id: 1, name: 'Admin'}, {id: 2, name: 'User'}]);
    await repo('status').save([{id: 1, name: 'Active'}, {id: 2, name: 'Inactive'}]);
    await repo('user_type').save([{id: 1, name: 'akzente'}, {id: 2, name: 'client'}, {id: 3, name: 'merchandiser'}]);
    await repo('merchandiser_status').save([{id: 1, name: 'neu'}, {id: 2, name: 'team'}, {id: 3, name: 'out'}]);
    const names = ['pending', 'scheduled', 'submitted', 'approved', 'viewed'];
    const labels = [['Pending','Pending','Pending'], ['Scheduled','Scheduled','Scheduled'], ['Review','Scheduled','Submitted'], ['Done','Available','Done'], ['Done','Done','Done']];
    const colors = [['#9E9E9E','#9E9E9E','#9E9E9E'], ['#00709B','#00709B','#00709B'], ['#FF8C00','#00709B','#CCAF08'], ['#6FCC08','#08C6CC','#6FCC08'], ['#6FCC08','#6FCC08','#6FCC08']];
    await repo('report-status').save(names.map((name, i) => ({id: i+1, name, akzenteName: labels[i][0], clientName: labels[i][1], merchandiserName: labels[i][2], akzenteColor: colors[i][0], clientColor: colors[i][1], merchandiserColor: colors[i][2]})));
    await runner.query(`SELECT setval(pg_get_serial_sequence('"report-status"', 'id'), 5, true)`);
    const user = await repo('user').save({email: e.BOOTSTRAP_ADMIN_EMAIL, password: await bcrypt.hash(e.BOOTSTRAP_ADMIN_PASSWORD, 12), firstName: 'Administrator', lastName: 'Akzente', provider: 'email', role: {id: 1}, status: {id: 1}, type: {id: 1}});
    await repo('akzente').save({user: {id: user.id}});
    await runner.query('CREATE TABLE public.akzente_initial_baseline (version integer PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now())');
    await runner.query('INSERT INTO public.akzente_initial_baseline (version) VALUES (1)');
    await runner.commitTransaction();
    console.log('Fresh database initialized with application schema, lookup data, and administrator.');
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction();
    throw error;
  } finally { await runner.release(); await dataSource.destroy(); }
}
async function main() {
  const e = process.env;
  const dataSource = new DataSource({type: 'postgres', host: e.DATABASE_HOST, port: Number(e.DATABASE_PORT || 5432), username: e.DATABASE_USERNAME, password: e.DATABASE_PASSWORD, database: e.DATABASE_NAME,
    synchronize: false, migrationsRun: false, installExtensions: false,
    entities: [path.join(__dirname, '../dist/src/**/*.entity.js')], extra: {max: 2, connectionTimeoutMillis: 15000}});
  await initialize(dataSource, e);
}
if (require.main === module) main().catch(error => {console.error(error.message); process.exitCode = 1;});
module.exports = { initialize };
