/**
 * Security & Offline Compliance Test: Zero External HTTP(S) URLs
 * Ensures no external network requests or dependencies exist in:
 * - pages/
 * - index.html
 * - js/core/
 * - js/editor/
 * - js/components/
 *
 * Allowed exceptions:
 * - XML / SVG namespaces (e.g., http://www.w3.org/2000/svg, xmlns definitions)
 * - Standard document schema identifiers (e.g., openxmlformats, microsoft schemas)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_TARGETS = [
  'index.html',
  'pages',
  'js/core',
  'js/editor',
  'js/components'
];

// Domains/patterns recognized as harmless XML/SVG namespaces or local identifiers
const IGNORED_URL_PATTERNS = [
  /https?:\/\/www\.w3\.org\//i,
  /https?:\/\/schemas\.openxmlformats\.org\//i,
  /https?:\/\/schemas\.microsoft\.com\//i,
  /https?:\/\/purl\.org\//i,
  /https?:\/\/xml\.org\//i,
  /https?:\/\/localhost/i,
  /https?:\/\/127\.0\.0\.1/i
];

function getFiles(relPath) {
  const fullPath = path.join(ROOT_DIR, relPath);
  if (!fs.existsSync(fullPath)) return [];

  const stat = fs.statSync(fullPath);
  if (stat.isFile()) return [fullPath];

  const results = [];
  const entries = fs.readdirSync(fullPath, { withFileTypes: true });
  for (const entry of entries) {
    const childPath = path.join(fullPath, entry.name);
    if (entry.isDirectory()) {
      results.push(...getFiles(path.relative(ROOT_DIR, childPath)));
    } else {
      results.push(childPath);
    }
  }
  return results;
}

function isNamespaceOrIgnored(url, line) {
  // Check against ignored domain patterns
  for (const pattern of IGNORED_URL_PATTERNS) {
    if (pattern.test(url)) return true;
  }

  // Check if within xmlns attribute or schema context
  if (/xmlns(?::\w+)?\s*=\s*["'][^"']*["']/i.test(line) && /w3\.org|schema/i.test(url)) {
    return true;
  }

  return false;
}

function runAudit() {
  console.log('========================================================================');
  console.log('      OFFLINE AUDIT: SCANNING FOR EXTERNAL HTTP(S) URLS                 ');
  console.log('========================================================================\n');

  const allFiles = [];
  for (const target of SCAN_TARGETS) {
    const files = getFiles(target);
    allFiles.push(...files);
  }

  console.log(`Auditing ${allFiles.length} files across target directories...\n`);

  const urlRegex = /https?:\/\/[^\s"'`><\)\]\}]+/gi;
  const violations = [];
  let totalUrlsFound = 0;
  let totalNamespacesIgnored = 0;

  for (const file of allFiles) {
    const relFile = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split('\n');

    lines.forEach((line, index) => {
      let match;
      urlRegex.lastIndex = 0;
      while ((match = urlRegex.exec(line)) !== null) {
        totalUrlsFound++;
        let rawUrl = match[0];

        // Clean trailing punctuation
        rawUrl = rawUrl.replace(/[;,\."'\)]+$/, '');

        if (isNamespaceOrIgnored(rawUrl, line)) {
          totalNamespacesIgnored++;
        } else {
          violations.push({
            file: relFile,
            line: index + 1,
            url: rawUrl,
            context: line.trim()
          });
        }
      }
    });
  }

  console.log(`Total URLs found: ${totalUrlsFound}`);
  console.log(`XML namespaces ignored (w3.org, schemas, etc.): ${totalNamespacesIgnored}`);
  console.log(`External URL violations: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error('❌ [FAIL] External HTTP(S) URLs detected in codebase:');
    violations.forEach(v => {
      console.error(`  - ${v.file}:${v.line} -> ${v.url}`);
      console.error(`    Code: ${v.context}`);
    });
    console.error('\nViolations must be removed to preserve 100% offline client-side guarantee.');
    process.exit(1);
  }

  console.log('✅ [PASS] Zero external HTTP(S) URLs detected across all inspected directories.');
  console.log('100% Offline Client-Side Guarantee verified.');
  process.exit(0);
}

runAudit();
