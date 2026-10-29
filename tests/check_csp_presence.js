/**
 * Static Guard: Content Security Policy (CSP) Audit
 *
 * Verifies that all 23 public pages (index.html + 22 standalone pages)
 * declare a strict offline Content-Security-Policy meta tag preventing
 * external script/style/font/network injection.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const REQUIRED_DIRECTIVES = [
  "default-src 'self'",
  "script-src",
  "style-src",
  "img-src",
  "font-src",
  "connect-src",
  "worker-src",
  "frame-src",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'"
];

console.log('='.repeat(72));
console.log('       STATIC GUARD: CONTENT SECURITY POLICY (CSP) AUDIT        ');
console.log('='.repeat(72));

const pages = [
  'index.html',
  ...fs.readdirSync(path.join(ROOT_DIR, 'pages'))
    .filter(f => f.endsWith('.html') && f !== 'viewer.html')
    .map(f => path.join('pages', f))
].sort();

let passed = true;
let auditedCount = 0;

pages.forEach(relPath => {
  const fullPath = path.join(ROOT_DIR, relPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  // Match CSP meta tag (content enclosed in double or single quotes)
  const cspMatch = content.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content="([^"]+)"/i)
    || content.match(/<meta\s+http-equiv=["']Content-Security-Policy["']\s+content='([^']+)'/i);

  if (!cspMatch) {
    console.error(`  ✗ [FAIL] ${relPath}: Missing <meta http-equiv="Content-Security-Policy">`);
    passed = false;
    return;
  }

  const cspContent = cspMatch[1];

  // Verify required directives
  for (const dir of REQUIRED_DIRECTIVES) {
    if (!cspContent.includes(dir)) {
      console.error(`  ✗ [FAIL] ${relPath}: CSP missing required directive "${dir}"`);
      passed = false;
      return;
    }
  }

  // Verify no dangerous open sources like http: or https: or wildcard *
  if (/\b(https?:|\*)/i.test(cspContent)) {
    console.error(`  ✗ [FAIL] ${relPath}: CSP contains forbidden open/external source (https: or *): "${cspContent}"`);
    passed = false;
    return;
  }

  auditedCount++;
  console.log(`  ✓ [PASS] ${relPath}`);
});

console.log('='.repeat(72));
if (!passed) {
  console.error(`❌ CSP Audit FAILED: One or more pages have missing or invalid CSP.`);
  process.exit(1);
} else {
  console.log(`✅ [ALL PASSED] Content Security Policy verified across all ${auditedCount} pages!`);
  console.log('='.repeat(72));
}
