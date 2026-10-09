require('reflect-metadata');
const { DataSource } = require('typeorm');
const path = require('node:path');
const fs = require('node:fs');
async function main() {
  const e = process.env;
  if (e.NODE_ENV !== 'production' || e.DATABASE_SYNCHRONIZE !== 'false') throw new Error('Unsafe database configuration');
  const ssl = e.DATABASE_SSL_ENABLED === 'true' ? {
    rejectUnauthorized: e.DATABASE_REJECT_UNAUTHORIZED !== 'false',
    ca: e.DATABASE_CA || undefined, key: e.DATABASE_KEY || undefined, cert: e.DATABASE_CERT || undefined,
  } : undefined;
  const dataSource = new DataSource({
    type: 'postgres', url: e.DATABASE_URL || undefined,
    host: e.DATABASE_HOST, port: Number(e.DATABASE_PORT || 5432),
    username: e.DATABASE_USERNAME, password: e.DATABASE_PASSWORD, database: e.DATABASE_NAME,
    synchronize: false, migrationsRun: false, installExtensions: false,
    entities: [path.join(__dirname, '../dist/src/**/*.entity.js')],
    extra: { ssl, max: 1, connectionTimeoutMillis: 15000, statement_timeout: 30000, options: '-c default_transaction_read_only=on' },
  });
  await dataSource.initialize();
  try {
    if (dataSource.entityMetadatas.length < 50) throw new Error('Compiled entity discovery failed');
    // Generate differences in memory; never execute schema SQL or the incomplete development migrations.
    const schema = await dataSource.driver.createSchemaBuilder().log();
    const blocking = schema.upQueries.filter(({ query }) =>
      !/^\s*(?:CREATE (?:UNIQUE )?INDEX|DROP INDEX|COMMENT ON)/i.test(query));
    if (blocking.length) {
      console.error('Existing database is incompatible with this build. No database changes were made.');
      console.error('Review these differences and provide a tested migration before redeploying:');
      blocking.forEach(({ query }) => console.error(query + ';'));
      throw new Error('Database compatibility check failed');
    }
    const defaults = await dataSource.query('SELECT email, password FROM "user" WHERE email IN ($1, $2)', ['admin@example.com', 'john.doe@example.com']);
    const bcrypt = require('bcryptjs');
    for (const account of defaults) {
      if (account.password && await bcrypt.compare('secret', account.password)) throw new Error('Change or disable the development account before deployment: ' + account.email);
    }
    const files = await dataSource.query('SELECT path FROM "file" WHERE path IS NOT NULL');
    let missingUploads = 0;
    for (const file of files) {
      const pathname = new URL(file.path, 'http://placeholder.invalid').pathname;
      const match = pathname.match(/\/uploads\/(.+)$/);
      if (!match) continue; // External files are not managed by the local upload volume.
      const relative = decodeURIComponent(match[1]);
      const present = ['/app/uploads', '/source-uploads'].some(base => {
        const resolved = path.resolve(base, relative);
        return resolved.startsWith(base + path.sep) && fs.existsSync(resolved);
      });
      if (!present) missingUploads++;
    }
    if (missingUploads) {
      const testRestore = e.DEPLOYMENT_TEST_DATA === 'true' && e.ALLOW_MISSING_TEST_UPLOADS === 'true' && /^akzente_restore_[a-f0-9]{16}$/.test(e.DATABASE_NAME || '');
      if (!testRestore) throw new Error(missingUploads + ' referenced upload(s) are absent. Copy the current live uploads into Backend/uploads before deploying.');
      console.warn('TEST DATA ONLY: ' + missingUploads + ' referenced upload(s) are unavailable. Records are retained; missing images/documents will not open until their files are supplied.');
    }
    console.log('Existing database schema checked in read-only mode; data and migration history preserved.');
    if (schema.upQueries.length) console.log('Optional index/comment differences detected; no changes applied.');
  } finally { await dataSource.destroy(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
