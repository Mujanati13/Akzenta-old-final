const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { missingSourceSettings } = require('../source-config.cjs');
function fixture(t, content, production) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akzente-source-'));
  t.after(() => fs.rmSync(dir, {recursive: true, force: true}));
  fs.mkdirSync(path.join(dir, 'Backend'));
  fs.writeFileSync(path.join(dir, 'Backend/.env'), content);
  if (production !== undefined) fs.writeFileSync(path.join(dir, '.env.production'), production);
  return dir;
}
const complete = 'DATABASE_HOST=db\nDATABASE_PORT=5432\nDATABASE_NAME=existing\nDATABASE_USERNAME=user\nDATABASE_PASSWORD=keep-secret\n';
test('existing dotenv with blank database name prompts only for that field', t => {
  const dir = fixture(t, complete.replace('DATABASE_NAME=existing', 'DATABASE_NAME=""'));
  assert.deepEqual(missingSourceSettings(dir), {file: 'Backend/.env', keys: ['DATABASE_NAME']});
  assert.equal(fs.readFileSync(path.join(dir, 'Backend/.env'), 'utf8').includes('keep-secret'), true);
});
test('complete source needs no prompts and output contains no secrets', t => {
  const result = missingSourceSettings(fixture(t, complete));
  assert.deepEqual(result.keys, []);
  assert.doesNotMatch(JSON.stringify(result), /keep-secret/);
});
test('whitespace-only missing settings are prompted', t => {
  const result = missingSourceSettings(fixture(t, 'DATABASE_NAME="   "\n'));
  assert.deepEqual(result.keys, ['DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD']);
});
test('database URL supplies the source connection', t => {
  assert.deepEqual(missingSourceSettings(fixture(t, 'DATABASE_URL=postgres://user:secret@db/existing\n')).keys, []);
});
test('legacy production file takes precedence over backend dotenv', t => {
  assert.deepEqual(missingSourceSettings(fixture(t, complete, complete.replace('DATABASE_NAME=existing', 'DATABASE_NAME='))), {file: '.env.production', keys: ['DATABASE_NAME']});
});
test('managed database credentials are never prompted or replaced', t => {
  assert.deepEqual(missingSourceSettings(fixture(t, complete, 'DEPLOYMENT_STACK=managed\n')).keys, []);
});
