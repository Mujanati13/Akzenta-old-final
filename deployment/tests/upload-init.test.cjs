const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const os=require('node:os');const path=require('node:path');const {spawnSync}=require('node:child_process');
test('upload initialization copies into an existing volume root, handles nested names and preserves newer files on reruns',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'upload-init-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const write=(name,contents)=>{const file=path.join(dir,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,contents);};
 write('source/image.jpg','original');write('source/report/42/my photo.webp','report photo');write('target/keep.jpg','live upload');write('bin/chown','#!/bin/sh\nexit 0\n');
 write('import-uploads.sh',fs.readFileSync(path.join(__dirname,'../import-uploads.sh')));
 const run=()=>spawnSync(process.env.BASH_BIN||'bash',['-c','export PATH="$PWD/bin:$PATH" UPLOAD_SOURCE_DIR="$PWD/source" UPLOAD_TARGET_DIR="$PWD/target" UPLOAD_MAIL_DIR="$PWD/mail"; chmod +x bin/chown; sh import-uploads.sh'],{cwd:dir,encoding:'utf8'});
 let result=run();assert.equal(result.status,0,result.stderr);assert.match(result.stdout,/Persistent upload files: 3/);assert.equal(fs.readFileSync(path.join(dir,'target/report/42/my photo.webp'),'utf8'),'report photo');
 write('target/image.jpg','newer');write('source/extra.pdf','document');result=run();assert.equal(result.status,0,result.stderr);assert.equal(fs.readFileSync(path.join(dir,'target/image.jpg'),'utf8'),'newer');assert.equal(fs.readFileSync(path.join(dir,'target/keep.jpg'),'utf8'),'live upload');assert.equal(fs.readFileSync(path.join(dir,'target/extra.pdf'),'utf8'),'document');
});
