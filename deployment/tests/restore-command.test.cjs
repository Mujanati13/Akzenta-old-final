const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
const script=fs.readFileSync(path.join(__dirname,'../../restore-existing.sh'),'utf8');
function scenario(t,failure='none',allow=false){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'akzente-restore-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 fs.mkdirSync(path.join(dir,'bin'));fs.mkdirSync(path.join(dir,'deployment/import'),{recursive:true});
 fs.writeFileSync(path.join(dir,'restore-existing.sh'),script);fs.writeFileSync(path.join(dir,'deployment/import/existing-data.sql'),'private fixture');
 fs.writeFileSync(path.join(dir,'.env.production'),'DATABASE_NAME=original\n');fs.writeFileSync(path.join(dir,'.env.database'),'POSTGRES_USER=postgres\n');
 fs.writeFileSync(path.join(dir,'deploy.sh'),'#!/usr/bin/env bash\n[[ "$MOCK_FAIL" != deploy ]]\n');
 const log=path.join(dir,'calls.log');
 fs.writeFileSync(path.join(dir,'bin/docker'),[
 '#!/usr/bin/env bash',
 'printf "%s\\n" "$*" >>"$MOCK_LOG"',
 'if [[ "$*" == *"ps -q api"* ]]; then echo old_api; exit 0; fi',
 'if [[ "$*" == *"ps -q web"* ]]; then echo old_web; exit 0; fi',
 'if [[ "$1" == inspect ]]; then echo old:stable; exit 0; fi',
 'if [[ "$*" == *"db-restore-existing"* ]]; then echo akzente_restore_0123456789abcdef >deployment/.restore-target; fi',
 'if [[ "$*" == *"db-check"* && "$MOCK_FAIL" == preflight ]]; then exit 8; fi',
 'if [[ "$*" == *"select-restored-database.cjs"* ]]; then echo DATABASE_NAME=restored >.env.production.next; fi',
 'exit 0'].join('\n')+'\n',{mode:0o755});
 fs.writeFileSync(path.join(dir,'bin/flock'),'#!/usr/bin/env bash\nexit 0\n',{mode:0o755});
 const result=spawnSync(process.env.BASH_BIN||'bash',['-c','export PATH="$(cd "$1/bin" && pwd):$PATH"; cd "$1"; bash restore-existing.sh $MOCK_ARGS','--',dir.replace(/\\/g,'/')],{env:{...process.env,MOCK_FAIL:failure,MOCK_ARGS:allow?'--allow-missing-test-uploads':'',MOCK_LOG:log.replace(/\\/g,'/')},encoding:'utf8',timeout:30000});
 if(result.error)throw result.error;
 return {...result,calls:fs.readFileSync(log,'utf8'),env:fs.readFileSync(path.join(dir,'.env.production'),'utf8')};
}
test('restore backs up and validates before selecting the new database',t=>{const r=scenario(t);assert.equal(r.status,0,r.stderr);assert.ok(r.calls.indexOf('db-backup')<r.calls.indexOf('db-restore-existing'));assert.ok(r.calls.indexOf('db-check')<r.calls.indexOf('select-restored-database'));assert.match(r.calls,/ALLOW_MISSING_TEST_UPLOADS=false/);assert.match(r.env,/restored/);});
test('failed preflight preserves the original configuration',t=>{const r=scenario(t,'preflight');assert.notEqual(r.status,0);assert.equal(r.env,'DATABASE_NAME=original\n');assert.doesNotMatch(r.calls,/select-restored-database/);});
test('failed deployment restores the original database selection and service images',t=>{const r=scenario(t,'deploy',true);assert.notEqual(r.status,0);assert.equal(r.env,'DATABASE_NAME=original\n');assert.match(r.calls,/ALLOW_MISSING_TEST_UPLOADS=true/);assert.match(r.calls,/rollback.yml up -d/);});
