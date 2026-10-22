const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, '../pages/compress.html'), 'utf8');

// Extract script tag contents
const scriptMatches = html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/gi);
let idx = 1;
for (const match of scriptMatches) {
  const code = match[1];
  try {
    new Function(code);
    console.log(`Inline script #${idx} syntax OK`);
  } catch (err) {
    console.error(`Syntax error in inline script #${idx}:`, err);
  }
  idx++;
}
