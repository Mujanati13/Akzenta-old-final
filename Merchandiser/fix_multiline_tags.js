const fs = require('fs');
const content = fs.readFileSync('src/app/pages/clients/report-edit/report-edit.component.html', 'utf-8');
const lines = content.split('\n');

const result = [];
let i = 0;

while (i < lines.length) {
  const line = lines[i];
  
  // Detect multi-line opening tag: <tagname at end of line (no > on this line)
  const startsTag = /<([a-zA-Z][a-zA-Z0-9-]*)\s*$/.test(line);
  const isClosing = line.includes('</');
  const hasGt = line.includes('>');
  const hasSelfClose = line.includes('/>');
  
  if (startsTag && !hasGt && !isClosing && !hasSelfClose) {
    // Multi-line opening tag - collect all subsequent lines until >
    const tagLines = [line];
    let j = i + 1;
    while (j < lines.length) {
      tagLines.push(lines[j]);
      if (lines[j].includes('>')) {
        break;
      }
      j++;
    }
    
    const indent = line.match(/^\s*/)[0];
    const tagName = line.match(/<([a-zA-Z][a-zA-Z0-9]*)/)[1];
    
    // Extract everything between <tagname and > (or />)
    let attrStr = '';
    let contentAfter = '';
    const isSelfClosing = tagLines[tagLines.length - 1].includes('/>');
    
    for (let k = 0; k < tagLines.length; k++) {
      const tl = tagLines[k];
      if (k === 0) {
        // First line: get everything after tag name, or empty if just <tagname
        const afterName = tl.replace(/^.*?<[a-zA-Z][a-zA-Z0-9]*\s*/, '');
        if (afterName) attrStr += ' ' + afterName;
      } else if (k === tagLines.length - 1) {
        // Last line: may have > or />
        const bracket = isSelfClosing ? '/>' : '>';
        const idx = tl.indexOf(bracket);
        if (idx >= 0) {
          const beforeBracket = tl.substring(0, idx).trim();
          contentAfter = tl.substring(idx + bracket.length);
          if (beforeBracket) attrStr += ' ' + beforeBracket;
        }
      } else {
        // Middle lines: full attribute lines
        attrStr += ' ' + tl.trim();
      }
    }
    
    attrStr = attrStr.replace(/\s+/g, ' ').trim();
    const closingStr = isSelfClosing ? ' />' : '>';
    const newLine = `${indent}<${tagName} ${attrStr}${closingStr}${contentAfter}`;
    
    result.push(newLine);
    i = j + 1;
  } else {
    result.push(line);
    i++;
  }
}

fs.writeFileSync('src/app/pages/clients/report-edit/report-edit.component.html', result.join('\n'), 'utf-8');
console.log(`Fixed. ${result.length} lines (was ${lines.length})`);
