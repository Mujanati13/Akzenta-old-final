const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseDotenv, parseRaw, prepare, validate } = require('../prepare-env.cjs');
function fixture(t, overrides = '') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'akzente-env-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'Backend'));
  fs.writeFileSync(path.join(dir, 'Backend', '.env'),
    "DATABASE_HOST=198.51.100.20\nDATABASE_PORT=5432\nDATABASE_NAME=existing\nDATABASE_USERNAME=existing_user\nDATABASE_PASSWORD='literal$secret#value=rest'\nMAIL_HOST=smtp.example.com\nMAIL_PORT=465\nMAIL_DEFAULT_EMAIL=sender@example.com\n" + overrides);
  return dir;
}
test('parses dotenv without evaluating shell substitutions', () => {
  assert.deepEqual(parseDotenv("A='$(touch /tmp/never)'\nB=\"quoted # value\" # comment\nC=bare # comment\n"),
    { A: '$(touch /tmp/never)', B: 'quoted # value', C: 'bare' });
});
test('preserves connection credentials, generates strong stable secrets, and keeps raw values literal', t => {
  const dir = fixture(t);
  const first = prepare(dir, '203.0.113.10');
  assert.equal(first.DATABASE_PASSWORD, 'literal$secret#value=rest');
  assert.equal(first.DATABASE_HOST, '198.51.100.20');
  assert.equal(first.DATABASE_NAME, 'existing');
  assert.equal(first.DATABASE_SYNCHRONIZE, 'false');
  assert.equal(first.AUTH_COOKIE_SECURE, 'false');
  assert.equal(first.MAIL_IGNORE_TLS, 'false');
  assert.equal(first.CLIENT_FRONTEND_DOMAIN, 'http://203.0.113.10:8081');
  assert.equal(first.AUTH_JWT_SECRET.length, 96);
  assert.notEqual(first.AUTH_JWT_SECRET, first.AUTH_REFRESH_SECRET);
  const serialized = fs.readFileSync(path.join(dir, '.env.production'), 'utf8');
  assert.deepEqual(parseRaw(serialized), first);
  assert.deepEqual(prepare(dir), first);
  assert.throws(() => prepare(dir, '203.0.113.11'), /different IP/);
});
test('supports IPv6 origins', t => {
  const values = prepare(fixture(t), '2001:db8::1');
  assert.equal(values.FRONTEND_DOMAIN, 'http://[2001:db8::1]');
  assert.equal(values.CLIENT_FRONTEND_DOMAIN, 'http://[2001:db8::1]:8081');
});
test('rejects invalid IP, absent credentials, and Docker loopback without writing configuration', t => {
  const dir = fixture(t, 'DATABASE_PASSWORD=\n');
  assert.throws(() => prepare(dir, 'example.com'), /VPS_IP/);
  assert.throws(() => prepare(dir, '203.0.113.10'), /DATABASE_PASSWORD/);
  assert.equal(fs.existsSync(path.join(dir, '.env.production')), false);
  const loopback = fixture(t, 'DATABASE_HOST=localhost\n');
  assert.throws(() => prepare(loopback, '203.0.113.10'), /host.docker.internal/);
});
test('rejects destructive settings, duplicate ports, and URLs inconsistent with published ports', t => {
  const values = prepare(fixture(t), '203.0.113.10');
  assert.throws(() => validate({ ...values, DATABASE_SYNCHRONIZE: 'true' }), /SYNCHRONIZE/);
  assert.throws(() => validate({ ...values, CLIENT_PORT: '80' }), /distinct/);
  assert.throws(() => validate({ ...values, CLIENT_PORT: '9000' }), /URLs/);
  assert.throws(() => validate({ ...values, AUTH_JWT_SECRET: 'secret' }), /strong/);
  assert.throws(() => validate({ ...values, MAPBOX_PUBLIC_TOKEN: 'sk.not-for-browser' }), /public token/);
  validate({ ...values, MAPBOX_PUBLIC_TOKEN: 'pk.test-token' });
});
