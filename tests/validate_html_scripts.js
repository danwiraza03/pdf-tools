const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
let total = 0;
let errors = 0;

function checkHtmlFile(filePath) {
  const html = fs.readFileSync(filePath, 'utf8');
  const scriptMatches = html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi);
  let idx = 1;
  for (const m of scriptMatches) {
    total++;
    const code = m[1].trim();
    if (!code) continue;
    try {
      new Function(code);
    } catch (e) {
      console.error(`SYNTAX ERROR in ${path.relative(ROOT, filePath)} (script #${idx}):`, e.message);
      errors++;
    }
    idx++;
  }
}

checkHtmlFile(path.join(ROOT, 'index.html'));
const pagesDir = path.join(ROOT, 'pages');
for (const p of fs.readdirSync(pagesDir)) {
  if (p.endsWith('.html')) {
    checkHtmlFile(path.join(pagesDir, p));
  }
}

console.log(`\nResult: ${errors} syntax errors across ${total} inline scripts in all HTML files.`);
