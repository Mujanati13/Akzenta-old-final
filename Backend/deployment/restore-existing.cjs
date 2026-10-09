require('reflect-metadata');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {Client}=require('pg');
const {DataSource}=require('typeorm');
const bcrypt=require('bcryptjs');
const {parseExport}=require('./parse-data-export.cjs');
const quote=name=>'"'+name.replaceAll('"','""')+'"';
async function validateReferences(client) {
 const keys=(await client.query("SELECT c.conname,c.conrelid::regclass::text AS child,c.confrelid::regclass::text AS parent,ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(id,n) JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum=k.id ORDER BY k.n) AS cols,ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(id,n) JOIN pg_attribute a ON a.attrelid=c.confrelid AND a.attnum=k.id ORDER BY k.n) AS refs FROM pg_constraint c WHERE c.contype='f' AND c.connamespace='public'::regnamespace")).rows;
 for(const key of keys) {
  const populated=key.cols.map(n=>'c.'+quote(n)+' IS NOT NULL').join(' AND ');
  const match=key.cols.map((n,i)=>'p.'+quote(key.refs[i])+'=c.'+quote(n)).join(' AND ');
  const invalid=(await client.query('SELECT count(*) AS n FROM '+key.child+' c WHERE '+populated+' AND NOT EXISTS (SELECT 1 FROM '+key.parent+' p WHERE '+match+')')).rows[0].n;
  if(Number(invalid))throw new Error('Snapshot has '+invalid+' broken references in '+key.child+' ('+key.conname+')');
 }
}
async function restore(e, options={}) {
 if(e.DATABASE_HOST!=='postgres'&& !options.test)throw new Error('Restore requires the managed Docker database');
 const source=options.source||'/imports/existing-data.sql';
 const output=options.output||'/restore-output';
 const sql=fs.readFileSync(source,'utf8');
 const digest=crypto.createHash('sha256').update(sql).digest('hex');
 const target='akzente_restore_'+digest.slice(0,16);
 const batches=parseExport(sql).filter(b=>b.table!=='session');
 if(!batches.some(b=>b.table==='project')||!batches.some(b=>b.table==='user'))throw new Error('Snapshot does not contain the expected application data');
 const connection={host:options.host||'postgres',port:Number(options.port||5432),user:e.POSTGRES_USER,password:e.POSTGRES_PASSWORD,connectionTimeoutMillis:15000};
 const admin=new Client({...connection,database:'postgres'});await admin.connect();
 let client,ds;
 try {
  await admin.query('SELECT pg_advisory_lock(812733)');
  await admin.query('CREATE SCHEMA IF NOT EXISTS akzente_deployment');
  await admin.query('CREATE TABLE IF NOT EXISTS akzente_deployment.restores(database_name text PRIMARY KEY,sha256 text NOT NULL,restored_at timestamptz NOT NULL DEFAULT now())');
  const complete=(await admin.query('SELECT sha256 FROM akzente_deployment.restores WHERE database_name=$1',[target])).rows;
  if(complete.length){if(complete[0].sha256!==digest)throw new Error('Restore checksum mismatch');fs.writeFileSync(path.join(output,'.restore-target'),target+'\n',{mode:0o600});console.log('Existing snapshot restore retained: '+target);return target;}
  const exists=(await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[target])).rows.length;
  if(!exists)await admin.query('CREATE DATABASE '+quote(target)+' OWNER '+quote(e.DATABASE_USERNAME));
  client=new Client({...connection,database:target});await client.connect();
  const tables=(await client.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows;
  if(tables.length)throw new Error('A previous incomplete restore database already contains tables; original database is unchanged. Inspect '+target+' before retrying.');
  await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  ds=new DataSource({type:'postgres',host:connection.host,port:connection.port,username:e.DATABASE_USERNAME,password:e.DATABASE_PASSWORD,database:target,synchronize:false,migrationsRun:false,installExtensions:false,entities:[path.join(__dirname,'../dist/src/**/*.entity.js')]});
  await ds.initialize();if(ds.entityMetadatas.length<50)throw new Error('Compiled entity discovery failed');
  const schema=await ds.driver.createSchemaBuilder().log();
  await client.query('BEGIN');
  try {
   await client.query('SET LOCAL ROLE '+quote(e.DATABASE_USERNAME));
   for(const query of schema.upQueries)await client.query(query.query,query.parameters);
   await client.query('RESET ROLE');
   await client.query("SET LOCAL session_replication_role='replica'");
   const allowed=new Set(ds.entityMetadatas.map(m=>m.tableName));
   for(const batch of batches) {
    if(!allowed.has(batch.table))throw new Error('Unknown snapshot table: '+batch.table);
    for(let start=0;start<batch.rows.length;start+=100){const rows=batch.rows.slice(start,start+100);const params=[];const values=rows.map(row=>'('+row.map(value=>{params.push(value);return '$'+params.length;}).join(',')+')').join(',');await client.query('INSERT INTO '+quote(batch.table)+' ('+batch.columns.map(quote).join(',')+') VALUES '+values,params);}
   }
   await client.query("SET LOCAL session_replication_role='origin'");
   await validateReferences(client);
   for(const table of ds.entityMetadatas){for(const column of table.generatedColumns.filter(c=>c.generationStrategy==='increment'))await client.query('SELECT setval(pg_get_serial_sequence($1,$2),GREATEST((SELECT COALESCE(MAX('+quote(column.databaseName)+'),1) FROM '+quote(table.tableName)+'),1),true)',[quote(table.tableName),column.databaseName]);}
   const credentials={};
   if(!e.BOOTSTRAP_ADMIN_EMAIL||!e.BOOTSTRAP_ADMIN_PASSWORD)throw new Error('Initial administrator credentials are missing from the saved production configuration');
   const hash=await bcrypt.hash(e.BOOTSTRAP_ADMIN_PASSWORD,12);
   const administrator=(await client.query('INSERT INTO "user" (email,password,provider,"firstName","lastName","roleId","statusId","typeId","createdAt","updatedAt") VALUES ($1,$2,\'email\',\'Administrator\',\'Akzente\',1,1,1,NOW(),NOW()) ON CONFLICT (email) DO UPDATE SET password=EXCLUDED.password,"roleId"=1,"statusId"=1,"typeId"=1,"deletedAt"=NULL RETURNING id',[e.BOOTSTRAP_ADMIN_EMAIL,hash])).rows[0];
   await client.query('INSERT INTO akzente (user_id,"createdAt","updatedAt") SELECT $1,NOW(),NOW() WHERE NOT EXISTS(SELECT 1 FROM akzente WHERE user_id=$1)',[administrator.id]);
   credentials.HeadOffice={email:e.BOOTSTRAP_ADMIN_EMAIL,password:e.BOOTSTRAP_ADMIN_PASSWORD};
   for(const [portal,type] of [['Client',2],['Merchandiser',3]]){const profile=type===2?'client':'merchandiser';const activity=type===2?'(SELECT count(*) FROM project_assigned_client a WHERE a.client_id=p.id)':'(SELECT count(*) FROM report r WHERE r.merchandiser_id=p.id)';const account=(await client.query('SELECT u.id,u.email FROM "user" u JOIN '+profile+' p ON p.user_id=u.id WHERE u."typeId"=$1 AND u."statusId"=1 AND u."deletedAt" IS NULL AND u.email IS NOT NULL ORDER BY '+activity+' DESC,u.id LIMIT 1',[type])).rows[0];if(!account)continue;const password=crypto.randomBytes(24).toString('base64url');await client.query('UPDATE "user" SET password=$1,provider=\'email\' WHERE id=$2',[await bcrypt.hash(password,12),account.id]);credentials[portal]={email:account.email,password};}
   for(const email of ['admin@example.com','john.doe@example.com']){const account=(await client.query('SELECT password FROM "user" WHERE email=$1',[email])).rows[0];if(account?.password&&await bcrypt.compare('secret',account.password)){const password=crypto.randomBytes(24).toString('base64url');await client.query('UPDATE "user" SET password=$1 WHERE email=$2',[await bcrypt.hash(password,12),email]);credentials[email]={email,password};}}
   fs.writeFileSync(path.join(output,'restored-accounts.json'),JSON.stringify(credentials,null,2)+'\n',{mode:0o600});
   await client.query('COMMIT');
  }catch(error){await client.query('ROLLBACK');throw error;}
  await validateReferences(client);
  await admin.query('BEGIN');
  await admin.query('CREATE TABLE IF NOT EXISTS akzente_deployment.imports(database_name text PRIMARY KEY,archive_name text NOT NULL,imported_at timestamptz NOT NULL DEFAULT now())');
  await admin.query('INSERT INTO akzente_deployment.imports(database_name,archive_name) VALUES($1,$2)',[target,'existing-export-'+digest]);
  await admin.query('INSERT INTO akzente_deployment.restores(database_name,sha256) VALUES($1,$2)',[target,digest]);
  await admin.query('COMMIT');
  fs.writeFileSync(path.join(output,'.restore-target'),target+'\n',{mode:0o600});
  const totals={};for(const table of ['user','client_company','client','merchandiser','project','report','branche'])totals[table]=Number((await client.query('SELECT count(*) AS n FROM '+quote(table))).rows[0].n);
  console.log('Existing test data restored:',totals);return target;
 }finally{if(ds?.isInitialized)await ds.destroy();if(client)await client.end();await admin.end();}
}
if(require.main===module)restore(process.env).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={restore,validateReferences};
