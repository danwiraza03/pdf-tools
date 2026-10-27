/**
 * Static Guard: Node Test Isolation & Zero Browser Leak in run_all.js
 *
 * Verifies that no test suite registered in tests/run_all.js imports
 * or loads 'playwright' or 'helpers/launch'.
 *
 * This ensures CI can safely run `node tests/run_all.js` before Playwright
 * browser binaries are installed.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const TESTS_DIR = __dirname;
const RUN_ALL_FILE = path.join(TESTS_DIR, 'run_all.js');

console.log('========================================================================');
console.log('    STATIC GUARD: ZERO BROWSER / PLAYWRIGHT IMPORTS IN NODE TESTS       ');
console.log('========================================================================\n');

// 1. Read run_all.js to extract registered test suites
const runAllContent = fs.readFileSync(RUN_ALL_FILE, 'utf8');

// Match test files from the tests array: e.g. file: 'test_foo.js'
const fileMatches = Array.from(runAllContent.matchAll(/file:\s*['"]([^'"]+)['"]/g)).map(m => m[1]);

if (!fileMatches || fileMatches.length === 0) {
  console.error('❌ [FAIL] Tidak dapat menemukan daftar file pengujian di tests/run_all.js');
  process.exit(1);
}

console.log(`Memeriksa ${fileMatches.length} file test yang terdaftar di tests/run_all.js...\n`);

const violations = [];
const FORBIDDEN_PATTERNS = [
  { pattern: /require\s*\(\s*['"][^'"]*playwright[^'"]*['"]\s*\)/, reason: "Memuat modul 'playwright'" },
  { pattern: /require\s*\(\s*['"][^'"]*helpers[/\\]launch(?:\.js)?['"]\s*\)/, reason: "Memuat 'helpers/launch'" },
  { pattern: /from\s*['"][^'"]*playwright[^'"]*['"]/, reason: "Mengimpor 'playwright'" },
  { pattern: /from\s*['"][^'"]*helpers[/\\]launch(?:\.js)?['"]/, reason: "Mengimpor 'helpers/launch'" },
  { pattern: /['"][^'"]*helpers[/\\]launch(?:\.js)?['"]/, reason: "Mereferensikan path 'helpers/launch'" }
];

for (const testFile of fileMatches) {
  // Jangan periksa guard ini sendiri
  if (testFile === 'check_node_test_isolation.js') continue;

  const testFilePath = path.join(TESTS_DIR, testFile);
  if (!fs.existsSync(testFilePath)) {
    violations.push({ file: testFile, line: 0, snippet: '', reason: `File tidak ditemukan: ${testFilePath}` });
    continue;
  }

  const content = fs.readFileSync(testFilePath, 'utf8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed.startsWith('*') || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
      continue;
    }

    for (const { pattern, reason } of FORBIDDEN_PATTERNS) {
      if (pattern.test(line)) {
        violations.push({
          file: testFile,
          line: i + 1,
          snippet: trimmed,
          reason
        });
        break;
      }
    }
  }
}

if (violations.length > 0) {
  console.error(`❌ [FAIL] Ditemukan ${violations.length} pelanggaran dependensi browser di tests/run_all.js:`);
  for (const v of violations) {
    console.error(`  - [${v.file}:${v.line}] ${v.reason}: "${v.snippet}"`);
  }
  console.log('\n========================================================================');
  console.log('Penjaga statis GAGAL: Test suite di run_all.js dilarang memuat playwright atau helpers/launch!');
  console.log('========================================================================\n');
  process.exit(1);
} else {
  console.log(`✅ [PASS] Seluruh ${fileMatches.length} suite di tests/run_all.js bersih dari dependensi browser (playwright & helpers/launch).`);
  console.log('========================================================================\n');
  process.exit(0);
}
