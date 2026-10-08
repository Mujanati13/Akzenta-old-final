const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const script = fs.readFileSync(path.join(__dirname, '../../deploy.sh'), 'utf8');
const dockerMock = [
  '#!/usr/bin/env bash',
  'printf "docker %s\\n" "$*" >>"$MOCK_LOG"',
  'if [[ "$1" == info ]]; then exit 0; fi',
  'if [[ "$*" == *"source-config.cjs"* ]]; then echo ".env.production"; exit 0; fi',
  'if [[ "$1" == run ]]; then echo "80 8081 8082"; exit 0; fi',
  'if [[ "$*" == *"db-bootstrap status"* ]]; then if [[ "$MOCK_FAIL" == repeat ]]; then echo done; else echo pending; fi; exit 0; fi',
  'if [[ "$1" == inspect ]]; then echo "previous:stable"; exit 0; fi',
  'if [[ "$*" == *"version --short"* ]]; then echo "2.30.0"; exit 0; fi',
  'if [[ "$*" == *"ps -q api"* ]]; then echo "old_api"; exit 0; fi',
  'if [[ "$*" == *"ps -q web"* ]]; then echo "old_web"; exit 0; fi',
  'if [[ "$MOCK_FAIL" == build && "$*" == *"build --pull"* ]]; then exit 7; fi',
  'if [[ "$MOCK_FAIL" == schema && "$*" == *"run --rm --no-deps db-check"* ]]; then exit 8; fi',
  'exit 0',
].join('\n') + '\n';
function scenario(t, failure) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akzente-deploy-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin'); fs.mkdirSync(bin);
  fs.writeFileSync(path.join(dir, 'deploy.sh'), script);
  fs.writeFileSync(path.join(dir, '.env.production'), 'NODE_ENV=production\n');
  fs.writeFileSync(path.join(dir, '.env.source'), 'NODE_ENV=production\n');
  fs.writeFileSync(path.join(dir, '.env.database'), 'POSTGRES_USER=postgres\n');
  fs.writeFileSync(path.join(bin, 'docker'), dockerMock, { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'flock'), '#!/usr/bin/env bash\nexit 0\n', { mode: 0o755 });
  fs.writeFileSync(path.join(bin, 'curl'), '#!/usr/bin/env bash\nprintf "curl %s\\n" "$*" >>"$MOCK_LOG"\n[[ "$MOCK_FAIL" != health ]]\n', { mode: 0o755 });
  const bash = process.env.BASH_BIN || 'bash';
  const log = path.join(dir, 'calls.log');
  // Let Bash prepend its platform-native bin path, including on Windows/MSYS.
  const result = spawnSync(bash, ['-c', 'export PATH="$(cd "$1/bin" && pwd):$PATH"; cd "$1"; bash deploy.sh 203.0.113.10', '--', dir.replace(/\\/g, '/')], {
    env: { ...process.env, MOCK_FAIL: failure, MOCK_LOG: log.replace(/\\/g, '/') }, encoding: 'utf8', timeout: 30000,
  });
  if (result.error) throw result.error;
  return { ...result, calls: fs.readFileSync(log, 'utf8') };
}
test('successful deployment backs up and checks before replacing services; probes all three portals', t => {
  const r = scenario(t, 'none');
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.calls.indexOf('source-check') < r.calls.indexOf('source-backup'));
  assert.ok(r.calls.indexOf('source-backup') < r.calls.indexOf('run --rm --no-deps db-bootstrap\n'));
  assert.ok(r.calls.indexOf('db-check') < r.calls.indexOf('db-backup'));
  assert.match(r.calls, /180 postgres maildev adminer api web/);
  assert.ok(r.calls.indexOf('db-check') < r.calls.indexOf('upload-init'));
  assert.ok(r.calls.indexOf('upload-backup') < r.calls.indexOf('180 postgres maildev adminer api web'));
  assert.equal(r.calls.split('\n').filter(l => l.startsWith('curl ')).length, 9);
  assert.doesNotMatch(r.calls, /\bdown\b|migration:run|seed:run|schema:drop/);
});
test('build failure leaves the running stack untouched', t => {
  const r = scenario(t, 'build');
  assert.notEqual(r.status, 0);
  assert.doesNotMatch(r.calls, /up -d|db-backup|upload-init/);
});
test('incompatible schema stops before upload import or service replacement', t => {
  const r = scenario(t, 'schema');
  assert.notEqual(r.status, 0);
  assert.match(r.calls, /source-backup/);
  assert.doesNotMatch(r.calls, /180 postgres maildev adminer api web|upload-init/);
});
test('failed public health check attempts rollback using the previous images', t => {
  const r = scenario(t, 'health');
  assert.notEqual(r.status, 0);
  assert.match(r.calls, /-f deployment\/\.rollback.yml up -d/);
  assert.match(r.stderr, /Restoring the previous/);
});

test('later deployments retain Docker data and never repeat source import', t => {
  const r = scenario(t, 'repeat');
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.calls, /source-backup|source-check|run --rm --no-deps db-bootstrap\n/);
  assert.match(r.calls, /db-backup/);
});
