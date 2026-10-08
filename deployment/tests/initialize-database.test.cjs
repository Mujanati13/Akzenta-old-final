const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../Backend/deployment/initialize-database.cjs'), 'utf8');
async function scenario(tables = [], failSeed = false) {
  const calls = [], saved = [];
  const runner = {isTransactionActive: false,
    connect: async () => {}, startTransaction: async () => {runner.isTransactionActive = true; calls.push('begin');},
    query: async sql => {calls.push(sql); if(sql.includes('FROM pg_tables')) return tables; if(sql.includes('SELECT version')) return [{version: 1}]; return [];},
    commitTransaction: async () => {calls.push('commit'); runner.isTransactionActive = false;}, rollbackTransaction: async () => {calls.push('rollback'); runner.isTransactionActive = false;}, release: async () => calls.push('release'),
    manager: {getRepository: table => ({save: async rows => {saved.push({table, rows}); if(failSeed) throw new Error('seed failure'); return {id: 1};}})}
  };
  const names = ['role','status','user_type','merchandiser_status','report-status','user','akzente'];
  const ds = {initialize: async () => calls.push('initialize'), destroy: async () => calls.push('destroy'), createQueryRunner: () => runner,
    entityMetadatas: [...names.map(tableName => ({tableName, target: tableName})), ...Array(50).fill({})],
    driver: {createSchemaBuilder: () => ({log: async () => ({upQueries: [{query: 'CREATE TABLE application_fixture (id int)'}]})})}};
  const module = {exports: {}};
  const requireMock = name => name === 'node:path' ? path : name === 'bcryptjs' ? {hash: async () => 'hashed-password'} : {};
  vm.runInNewContext(source, {require: requireMock, module, __dirname, console});
  let error;
  try {await module.exports.initialize(ds, {DATABASE_INITIALIZATION: 'fresh', DATABASE_HOST: 'postgres', DATABASE_SYNCHRONIZE: 'false', BOOTSTRAP_ADMIN_EMAIL: 'admin@akzente.local', BOOTSTRAP_ADMIN_PASSWORD: 'a-generated-password-of-at-least-24-characters'});} catch(e) {error=e;}
  return {calls, saved, error};
}
test('nonempty unmarked database refuses initialization without schema or seed writes', async () => {
  const r = await scenario([{tablename: 'user'}]);
  assert.match(r.error.message, /already contains tables/);
  assert.ok(r.calls.includes('rollback'));
  assert.equal(r.saved.length, 0);
  assert.ok(!r.calls.some(sql => sql.startsWith('CREATE')));
});
test('fresh schema and login data commit together with a hashed password and HeadOffice membership', async () => {
  const r = await scenario();
  assert.equal(r.error, undefined);
  assert.ok(r.calls.includes('commit'));
  assert.equal(r.saved.find(s => s.table === 'user').rows.password, 'hashed-password');
  assert.equal(r.saved.find(s => s.table === 'user').rows.type.id, 1);
  assert.ok(r.saved.some(s => s.table === 'akzente'));
});
test('seed failure rolls back the complete initial schema', async () => {
  const r = await scenario([], true);
  assert.match(r.error.message, /seed failure/);
  assert.ok(r.calls.includes('rollback'));
  assert.ok(!r.calls.includes('commit'));
  assert.ok(r.calls.includes('destroy'));
});
test('completed initial baseline is retained after interrupted deployment', async () => {
  const r = await scenario([{tablename: 'akzente_initial_baseline'}, {tablename: 'user'}]);
  assert.equal(r.error, undefined);
  assert.equal(r.saved.length, 0);
  assert.ok(!r.calls.some(sql => sql.startsWith('CREATE')));
});
