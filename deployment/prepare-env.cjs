const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const net = require('node:net');

// Read dotenv data without executing it as shell code.
function parseDotenv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    let value = match[2].trim();
    if (value.startsWith('"') || value.startsWith("'")) {
      const quote = value[0], end = value.lastIndexOf(quote);
      if (end === 0 || !/^\s*(?:#.*)?$/.test(value.slice(end + 1))) throw new Error('Invalid quoted value: ' + match[1]);
      value = value.slice(1, end);
      if (quote === '"') value = value.replace(/\\n/g, '\n').replace(/\\r/g, '\r').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
    } else value = value.replace(/\s*#.*$/, '').trim();
    values[match[1]] = value;
  }
  return values;
}
function parseRaw(text) {
  return Object.fromEntries(text.split(/\r?\n/).filter(line => line && !line.startsWith('#')).map(line => {
    const i = line.indexOf('=');
    if (i < 1) throw new Error('Invalid production environment line');
    return [line.slice(0, i), line.slice(i + 1)];
  }));
}
function validate(values) {
  if (values.NODE_ENV !== 'production' || values.DATABASE_SYNCHRONIZE !== 'false') throw new Error('Production mode and DATABASE_SYNCHRONIZE=false are required');
  if (!values.DATABASE_URL) for (const key of ['DATABASE_HOST', 'DATABASE_NAME', 'DATABASE_USERNAME', 'DATABASE_PASSWORD']) {
    if (!values[key]) throw new Error('Missing ' + key + '; copy your existing connection into Backend/.env before deploying');
  }
  if (values.DATABASE_HOST === 'localhost' || values.DATABASE_HOST === '127.0.0.1') throw new Error('Use host.docker.internal for a database on the VPS host, or its reachable IP');
  if (values.DATABASE_URL && ['localhost', '127.0.0.1'].includes(new URL(values.DATABASE_URL).hostname)) throw new Error('DATABASE_URL must use a database hostname reachable from Docker');
  if (!values.MAIL_HOST || !values.MAIL_DEFAULT_EMAIL) throw new Error('Mail configuration is missing');
  for (const key of ['AUTH_JWT_SECRET', 'AUTH_REFRESH_SECRET', 'AUTH_FORGOT_SECRET', 'AUTH_CONFIRM_EMAIL_SECRET']) {
    if (!values[key] || values[key].length < 32) throw new Error('Set a strong production secret for ' + key);
  }
  if (values.MAPBOX_PUBLIC_TOKEN && !/^pk\.[A-Za-z0-9._-]+$/.test(values.MAPBOX_PUBLIC_TOKEN)) throw new Error('MAPBOX_PUBLIC_TOKEN must be a Mapbox public token starting with pk.');
  const ports = ['HEAD_OFFICE_PORT', 'CLIENT_PORT', 'MERCHANDISER_PORT'].map(key => Number(values[key]));
  if (ports.some(p => !Number.isInteger(p) || p < 1 || p > 65535) || new Set(ports).size !== 3) throw new Error('Portal ports must be distinct numbers from 1 to 65535');
  const origin = new URL(values.BACKEND_DOMAIN);
  if (origin.protocol !== 'http:' || !net.isIP(origin.hostname.replace(/^\[|\]$/g, ''))) throw new Error('This deployment expects an HTTP IP address as BACKEND_DOMAIN');
  if (values.AUTH_COOKIE_SECURE !== 'false') throw new Error('IP HTTP access requires AUTH_COOKIE_SECURE=false');
  const host = origin.hostname;
  const url = p => 'http://' + host + (p === 80 ? '' : ':' + p);
  if (values.FRONTEND_DOMAIN !== url(ports[0]) || values.CLIENT_FRONTEND_DOMAIN !== url(ports[1]) || values.MERCHANDISER_FRONTEND_DOMAIN !== url(ports[2]) || values.BACKEND_DOMAIN !== values.FRONTEND_DOMAIN) throw new Error('Portal URLs must match the IP and configured ports');
  for (const [key, value] of Object.entries(values)) if (/\r|\n/.test(value)) throw new Error('Multiline values are unsupported in the raw production environment: ' + key);
}
function prepare(base, ip) {
  const target = path.join(base, '.env.production');
  let values;
  if (fs.existsSync(target)) {
    values = parseRaw(fs.readFileSync(target, 'utf8'));
    validate(values);
    if (ip && new URL(values.BACKEND_DOMAIN).hostname.replace(/^\[|\]$/g, '') !== ip) throw new Error('Existing .env.production has a different IP; update its public URLs before redeploying');
  } else {
    if (!net.isIP(ip || '')) throw new Error('Usage: bash deploy.sh YOUR_VPS_IP');
    const source = path.join(base, 'Backend', '.env');
    if (!fs.existsSync(source)) throw new Error('Backend/.env is required to preserve the existing database and SMTP settings');
    const old = parseDotenv(fs.readFileSync(source, 'utf8'));
    const hostname = net.isIP(ip) === 6 ? '[' + ip + ']' : ip;
    const publicURL = 'http://' + hostname;
    values = {
      NODE_ENV: 'production', APP_PORT: '3000', APP_NAME: 'Akzente', API_PREFIX: 'api',
      APP_FALLBACK_LANGUAGE: old.APP_FALLBACK_LANGUAGE || 'de', APP_HEADER_LANGUAGE: old.APP_HEADER_LANGUAGE || 'x-custom-lang',
      HEAD_OFFICE_PORT: '80', CLIENT_PORT: '8081', MERCHANDISER_PORT: '8082',
      FRONTEND_DOMAIN: publicURL, BACKEND_DOMAIN: publicURL,
      CLIENT_FRONTEND_DOMAIN: publicURL + ':8081', MERCHANDISER_FRONTEND_DOMAIN: publicURL + ':8082',
      CORS_ALLOWED_ORIGINS: '', CORS_TRUSTED_HOST_SUFFIX: '', TRUST_PROXY: '1', AUTH_COOKIE_SECURE: 'false',
      DATABASE_TYPE: 'postgres', DATABASE_HOST: old.DATABASE_HOST || '', DATABASE_PORT: old.DATABASE_PORT || '5432',
      DATABASE_USERNAME: old.DATABASE_USERNAME || '', DATABASE_PASSWORD: old.DATABASE_PASSWORD || '', DATABASE_NAME: old.DATABASE_NAME || '', DATABASE_URL: old.DATABASE_URL || '',
      DATABASE_SYNCHRONIZE: 'false', DATABASE_MAX_CONNECTIONS: '20',
      DATABASE_SSL_ENABLED: old.DATABASE_SSL_ENABLED || 'false', DATABASE_REJECT_UNAUTHORIZED: old.DATABASE_REJECT_UNAUTHORIZED || 'true',
      DATABASE_CA: old.DATABASE_CA || '', DATABASE_KEY: old.DATABASE_KEY || '', DATABASE_CERT: old.DATABASE_CERT || '',
      MAPBOX_PUBLIC_TOKEN: old.MAPBOX_PUBLIC_TOKEN || '',
      FILE_DRIVER: 'local', MAIL_HOST: old.MAIL_HOST || 'maildev', MAIL_PORT: old.MAIL_PORT || '587',
      MAIL_USER: old.MAIL_USER || '', MAIL_PASSWORD: old.MAIL_PASSWORD || '',
      MAIL_DEFAULT_EMAIL: old.MAIL_DEFAULT_EMAIL || 'noreply@example.com', MAIL_DEFAULT_NAME: old.MAIL_DEFAULT_NAME || 'Akzente',
      MAIL_IGNORE_TLS: 'false', MAIL_SECURE: old.MAIL_SECURE || (old.MAIL_PORT === '465' ? 'true' : 'false'), MAIL_REQUIRE_TLS: old.MAIL_REQUIRE_TLS || 'true',
      AUTH_JWT_TOKEN_EXPIRES_IN: '15m', AUTH_SESSION_MAX_AGE: '8h', AUTH_REFRESH_TOKEN_EXPIRES_IN: '7d',
      AUTH_FORGOT_TOKEN_EXPIRES_IN: '30m', AUTH_CONFIRM_EMAIL_TOKEN_EXPIRES_IN: '1d',
    };
    for (const key of ['AUTH_JWT_SECRET', 'AUTH_REFRESH_SECRET', 'AUTH_FORGOT_SECRET', 'AUTH_CONFIRM_EMAIL_SECRET']) values[key] = crypto.randomBytes(48).toString('hex');
    validate(values);
  }
  if (values.DEPLOYMENT_STACK !== 'managed') {
    const source = path.join(base, '.env.source');
    if (!fs.existsSync(source)) writeRaw(source, values);
    const databaseFile = path.join(base, '.env.database');
    if (!fs.existsSync(databaseFile)) writeRaw(databaseFile, {
      POSTGRES_USER: 'postgres', POSTGRES_PASSWORD: crypto.randomBytes(48).toString('hex'), POSTGRES_DB: 'postgres',
    });
    values = {
      ...values, DEPLOYMENT_STACK: 'managed', DATABASE_HOST: 'postgres', DATABASE_PORT: '5432', DATABASE_URL: '',
      DATABASE_NAME: ['postgres', 'template0', 'template1'].includes(values.DATABASE_NAME) ? 'akzente' : (values.DATABASE_NAME || 'akzente'),
      DATABASE_USERNAME: 'akzente_app', DATABASE_PASSWORD: crypto.randomBytes(48).toString('hex'),
      DATABASE_SSL_ENABLED: 'false', DATABASE_REJECT_UNAUTHORIZED: 'true', DATABASE_CA: '', DATABASE_KEY: '', DATABASE_CERT: '',
      MAIL_HOST: 'maildev', MAIL_PORT: '1025', MAIL_USER: '', MAIL_PASSWORD: '',
      MAIL_SECURE: 'false', MAIL_REQUIRE_TLS: 'false', MAIL_IGNORE_TLS: 'true',
    };
  }
  if (!fs.existsSync(path.join(base, '.env.source')) || !fs.existsSync(path.join(base, '.env.database'))) throw new Error('Managed credentials are missing; restore .env.source and .env.database');
  validate(values);
  writeRaw(target, values);
  return values;
}
function writeRaw(file, values) {
  fs.writeFileSync(file + '.tmp', Object.entries(values).map(([k,v]) => k + '=' + v).join('\n') + '\n', {mode: 0o600});
  fs.renameSync(file + '.tmp', file);
}
if (require.main === module) {
  try {
    const values = prepare(process.cwd(), process.argv[2]);
    console.log([values.HEAD_OFFICE_PORT, values.CLIENT_PORT, values.MERCHANDISER_PORT, values.MAPBOX_PUBLIC_TOKEN || ''].join(' '));
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
module.exports = { parseDotenv, parseRaw, validate, prepare };
