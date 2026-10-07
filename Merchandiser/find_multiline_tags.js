const fs = require('fs');
const html = fs.readFileSync('src/app/pages/clients/report-edit/report-edit.component.html', 'utf-8');
const lines = html.split('\n');

let inTag = false;
let tagName = '';
let startLine = -1;
let count = 0;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  
  if (!inTag) {
    // Look for <tagname (possibly with attributes, no > on this line)
    const m = line.match(/<([a-zA-Z][a-zA-Z0-9]*)(\s[^>]*)?$/);
    if (m && !line.includes('>') && !line.match(/\/>\s*$/)) {
      tagName = m[1];
      // Skip Angular specific
      if (!['ng-container', 'ng-template'].includes(tagName)) {
        inTag = true;
        startLine = i + 1;
      }
    }
  } else {
    if (line.includes('>')) {
      count++;
      const content = line.trim().substring(0, 60);
      console.log(`${String(startLine).padStart(4)}-${String(i+1).padStart(4)}: <${tagName} ... > | ${content}`);
      inTag = false;
    }
  }
}

console.log(`\nTotal: ${count}`);
