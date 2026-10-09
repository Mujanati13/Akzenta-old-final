const {test}=require('node:test');
const assert=require('node:assert/strict');
const {parseExport}=require('../../Backend/deployment/parse-data-export.cjs');
test('parses SQL literals, embedded semicolons, escaped quotes, arrays and JSON without executing directives',()=>{
 const text="-- export\nBEGIN; SET session_replication_role = 'replica'; INSERT INTO \"example\" (\"id\",\"name\",\"data\",\"active\",\"empty\") VALUES (12,'O''Brien; -- retained','{\"label\":\"value\"}',TRUE,NULL),(13,'second','{1,2}',FALSE,''); SET session_replication_role = 'origin'; COMMIT;";
 const parsed=parseExport(text);
 assert.equal(parsed.length,1);assert.equal(parsed[0].table,'example');
 assert.deepEqual(parsed[0].rows,[['12',"O'Brien; -- retained",'{"label":"value"}',true,null],['13','second','{1,2}',false,'']]);
});
test('refuses destructive statements and executable value expressions',()=>{
 assert.throws(()=>parseExport('DROP TABLE "user";'),/Unsupported/);
 assert.throws(()=>parseExport('INSERT INTO "user" ("id") VALUES (pg_sleep(1));'),/literal/);
 assert.throws(()=>parseExport('INSERT INTO "user" ("id","email") VALUES (1);'),/column count/);
 assert.throws(()=>parseExport('INSERT INTO "user" ("id") VALUES (\'unfinished);'),/Unterminated/);
});
