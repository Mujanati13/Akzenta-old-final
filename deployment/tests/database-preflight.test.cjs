const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../Backend/deployment/check-database.cjs'), 'utf8');
async function check({ queries = [], accounts = [], files = [], available = [], env = {} } = {}) {
  let options, destroyed = false;
  const sql = [], output = [];
  class DataSource {
    constructor(config) {
      options = config;
      this.entityMetadatas = Array(71).fill({});
      this.driver = { createSchemaBuilder: () => ({ log: async () => ({ upQueries: queries.map(query => ({ query })) }) }) };
    }
    async initialize() {}
    async query(query) {
      sql.push(query);
      if (query.includes('FROM "user"')) return accounts;
      if (query.includes('FROM "file"')) return files;
      throw new Error('Unexpected SQL: ' + query);
    }
    async destroy() { destroyed = true; }
  }
  const state = { env: { NODE_ENV: 'production', DATABASE_SYNCHRONIZE: 'false', ...env }, exitCode: 0 };
  const context = {
    require: name => {
      if (name === 'reflect-metadata') return {};
      if (name === 'typeorm') return { DataSource };
      if (name === 'node:path') return path.posix;
      if (name === 'node:fs') return { existsSync: p => available.includes(p) };
      if (name === 'bcryptjs') return { compare: async (_password, hash) => hash === 'default-secret-hash' };
      throw new Error('Unexpected module: ' + name);
    },
    __dirname: '/app/deployment', URL, process: state,
    console: { log: message => output.push(message), error: message => output.push(message), warn: message => output.push(message) },
  };
  await vm.runInNewContext(source, context);
  return { options, destroyed, sql, output: output.join('\n'), exitCode: state.exitCode };
}
test('database preflight uses read-only sessions, disables extension/schema/migration writes, and accepts optional index drift', async () => {
  const r = await check({ queries: ['CREATE INDEX optional ON report (id)'] });
  assert.equal(r.exitCode, 0, r.output);
  assert.equal(r.options.synchronize, false);
  assert.equal(r.options.migrationsRun, false);
  assert.equal(r.options.installExtensions, false);
  assert.equal(r.options.extra.options, '-c default_transaction_read_only=on');
  assert.ok(r.destroyed);
  assert.ok(r.sql.every(query => query.startsWith('SELECT ')));
});
test('structural drift refuses deployment before reading business tables', async () => {
  const r = await check({ queries: ['ALTER TABLE "user" DROP COLUMN email'] });
  assert.equal(r.exitCode, 1);
  assert.equal(r.sql.length, 0);
  assert.match(r.output, /compatibility check failed/);
  assert.ok(r.destroyed);
});
test('missing referenced upload stops deployment; source and persistent copies are both accepted', async () => {
  const file = { path: '/api/v1/uploads/profile/photo.webp' };
  const missing = await check({ files: [file] });
  assert.equal(missing.exitCode, 1);
  assert.match(missing.output, /referenced upload/);
  for (const base of ['/source-uploads', '/app/uploads']) {
    const present = await check({ files: [file], available: [base + '/profile/photo.webp'] });
    assert.equal(present.exitCode, 0, present.output);
  }
});
test('known default development account refuses deployment without altering its password', async () => {
  const r = await check({ accounts: [{ email: 'admin@example.com', password: 'default-secret-hash' }] });
  assert.equal(r.exitCode, 1);
  assert.match(r.output, /development account/);
  assert.ok(r.sql.every(query => query.startsWith('SELECT ')));
});

test('missing uploads may warn only for an explicitly selected restored test database', async()=>{
 const files=[{path:'/uploads/missing.jpg'}];
 const env={DEPLOYMENT_TEST_DATA:'true',ALLOW_MISSING_TEST_UPLOADS:'true',DATABASE_NAME:'akzente_restore_0123456789abcdef'};
 const allowed=await check({files,env});assert.equal(allowed.exitCode,0,allowed.output);assert.match(allowed.output,/TEST DATA ONLY/);
 const production=await check({files,env:{...env,DATABASE_NAME:'production'}});assert.equal(production.exitCode,1);
 const unapproved=await check({files,env:{...env,ALLOW_MISSING_TEST_UPLOADS:'false'}});assert.equal(unapproved.exitCode,1);
});
