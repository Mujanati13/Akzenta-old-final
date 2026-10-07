const fs = require('fs');
const file = 'src/app/shared/shared.module.ts';
let content = fs.readFileSync(file, 'utf8');

if (!content.includes('ProjectMobileFilterSheetComponent')) {
  // Try finding imports.ts or similar? Wait, the module might be named something else. Let's check the content first.
}
