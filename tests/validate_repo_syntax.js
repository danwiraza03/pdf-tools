const fs = require('fs');
const path = require('path');

const ROOT = 'c:/laragon/www/pdf';
let total = 0;
let errors = 0;

function checkDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === 'trash' || entry.name === '.git' || entry.name === 'lib') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkDir(full);
    } else if (entry.name.endsWith('.js')) {
      total++;
      const code = fs.readFileSync(full, 'utf8');
      try {
        new Function(code);
      } catch (err) {
        console.error(`SYNTAX ERROR in ${path.relative(ROOT, full)}:`, err.message);
        errors++;
      }
    }
  }
}

console.log('=== VALIDATING ALL JAVASCRIPT FILES IN REPO ===');
checkDir(path.join(ROOT, 'js'));
checkDir(path.join(ROOT, 'tests'));
const rootFiles = ['server.js', 'sw.js'];
for (const rf of rootFiles) {
  const full = path.join(ROOT, rf);
  if (fs.existsSync(full)) {
    total++;
    try {
      new Function(fs.readFileSync(full, 'utf8'));
    } catch (err) {
      console.error(`SYNTAX ERROR in ${rf}:`, err.message);
      errors++;
    }
  }
}

console.log(`\nResult: ${errors} syntax errors in ${total} JS files checked.`);
