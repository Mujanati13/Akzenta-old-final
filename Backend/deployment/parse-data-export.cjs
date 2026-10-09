// Parse the repository's data-only SQL export as literals; never execute its SQL directives.
function statements(text) {
  const result=[];let token='',quote='';
  for(let i=0;i<text.length;i++) {
    const ch=text[i];
    if(quote) {token+=ch;if(ch===quote){if(text[i+1]===quote){token+=text[++i];}else quote='';}continue;}
    if(ch==='\''||ch==='"'){quote=ch;token+=ch;continue;}
    if(ch==='-'&&text[i+1]==='-'){while(i<text.length&&text[i]!==String.fromCharCode(10))i++;token+=String.fromCharCode(10);continue;}
    if(ch===';'){if(token.trim())result.push(token.trim());token='';}else token+=ch;
  }
  if(quote)throw new Error('Unterminated SQL literal');
  if(token.trim())result.push(token.trim());return result;
}
function rows(text, columns) {
  let i=0;const result=[];const ws=()=>{while(/\s/.test(text[i]||'')&&i<text.length)i++;};
  while(i<text.length) {
    ws();if(text[i++]!=='(')throw new Error('Expected export row');const row=[];
    for(;;) {
      ws();let value;
      if(text[i]==='\'') {i++;value='';let closed=false;while(i<text.length){if(text[i]==='\''){if(text[i+1]==='\''){value+='\'';i+=2;}else{i++;closed=true;break;}}else value+=text[i++];}if(!closed)throw new Error('Unterminated export value');}
      else {const m=text.slice(i).match(/^(NULL|TRUE|FALSE|[-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)/i);if(!m)throw new Error('Only SQL literal values are accepted');i+=m[0].length;value=/^null$/i.test(m[0])?null:/^true$/i.test(m[0])?true:/^false$/i.test(m[0])?false:m[0];}
      row.push(value);ws();if(text[i]===','){i++;continue;}if(text[i++]!==')')throw new Error('Expected row terminator');break;
    }
    if(row.length!==columns)throw new Error('Export column count mismatch');result.push(row);ws();if(i===text.length)break;if(text[i++]!==',')throw new Error('Expected row separator');
  }
  return result;
}
function parseExport(text) {
  return statements(text).flatMap(statement=>{
    if(/^(?:BEGIN|COMMIT)$/i.test(statement)||/^SET session_replication_role = '(?:replica|origin)'$/i.test(statement))return [];
    const m=statement.match(/^INSERT INTO (?:public\.)?"([\w-]+)"\s*\(([^)]+)\)\s*VALUES\s*([\s\S]+)$/i);
    if(!m)throw new Error('Unsupported statement in data-only export');
    const columns=m[2].split(',').map(s=>{const c=s.trim().match(/^"(\w+)"$/);if(!c)throw new Error('Invalid export column');return c[1];});
    return [{table:m[1],columns,rows:rows(m[3],columns.length)}];
  });
}
module.exports={parseExport};
