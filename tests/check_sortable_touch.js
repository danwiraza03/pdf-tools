const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const SCAN_DIRS = [
  path.join(ROOT_DIR, 'js'),
  path.join(ROOT_DIR, 'pages')
];

const EXCLUDED_PATHS = [
  path.join(ROOT_DIR, 'js', 'lib'),
  path.join(ROOT_DIR, 'js', 'studio'),
  path.join(ROOT_DIR, 'pages', 'viewer.html')
];

function isExcluded(filePath) {
  const norm = path.normalize(filePath).toLowerCase();
  return EXCLUDED_PATHS.some(ex => norm === ex.toLowerCase() || norm.startsWith(ex.toLowerCase() + path.sep));
}

function getFilesRecursively(dir) {
  let results = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    if (isExcluded(fullPath)) continue;
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else if (file.endsWith('.js') || file.endsWith('.html')) {
      results.push(fullPath);
    }
  }
  return results;
}

console.log('========================================================================');
console.log('       AUDIT OPSI SENTUH SORTABLE (delayOnTouchOnly MANDATORY)          ');
console.log('========================================================================\n');

let totalInstances = 0;
const failures = [];

const allFiles = [];
for (const dir of SCAN_DIRS) {
  allFiles.push(...getFilesRecursively(dir));
}

console.log(`Memindai ${allFiles.length} berkas di js/ dan pages/ (mengecualikan js/lib, js/studio, pages/viewer.html)...\n`);

const SORTABLE_REGEX = /(?:new\s+Sortable|Sortable\.create)\s*\(/g;

for (const filePath of allFiles) {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const content = fs.readFileSync(filePath, 'utf8');

  let match;
  while ((match = SORTABLE_REGEX.exec(content)) !== null) {
    totalInstances++;
    const matchIndex = match.index;
    const linesBefore = content.substring(0, matchIndex).split('\n');
    const lineNumber = linesBefore.length;

    // Look ahead to check the options object
    const tail = content.substring(matchIndex);
    // Find the end of this Sortable call (up to 1500 chars or closing parenthesis)
    const snippet = tail.substring(0, 1500);

    const hasTouchDelayOption = /delayOnTouchOnly\s*:\s*true/.test(snippet);

    if (!hasTouchDelayOption) {
      failures.push({
        file: relPath,
        line: lineNumber,
        snippet: snippet.substring(0, 120).replace(/\s+/g, ' ')
      });
    } else {
      console.log(`  ✓ [PASS] ${relPath}:${lineNumber} memiliki opsi 'delayOnTouchOnly: true'`);
    }
  }
}

console.log('\n========================================================================');
console.log(`TOTAL INSTANCE SORTABLE DITEMUKAN: ${totalInstances}`);
console.log(`TOTAL PELANGGARAN OPSI SENTUH     : ${failures.length}`);
console.log('========================================================================');

if (failures.length > 0) {
  console.error('\n❌ [FAIL] Ditemukan inisialisasi Sortable tanpa opsi delayOnTouchOnly:');
  for (const f of failures) {
    console.error(`  - Berkas: ${f.file}:${f.line}`);
    console.error(`    Kode  : ${f.snippet}...`);
  }
  process.exit(1);
} else {
  console.log(`\n✅ [PASS] Seluruh ${totalInstances} instance Sortable telah mematuhi opsi sentuh bersama.`);
  process.exit(0);
}
