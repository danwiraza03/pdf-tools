/**
 * Guard Test: Enforce Zero Unsanitized `ignoreEncryption: true`
 *
 * Verifies that no code in js/core, js/components, js/utils, or pages
 * loads PDFs with `ignoreEncryption: true` without proper decryption.
 * Exceptions are strictly limited to:
 *   - pages/viewer.html
 *   - js/core/pdf-studio.js
 *   - Explicitly commented lines: `// allow-ignore-encryption: alasan`
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const TARGET_DIRS = [
  path.join(ROOT_DIR, 'js/core'),
  path.join(ROOT_DIR, 'js/components'),
  path.join(ROOT_DIR, 'js/utils'),
  path.join(ROOT_DIR, 'pages')
];

const EXCLUDED_FILES = new Set([
  path.normalize(path.join(ROOT_DIR, 'pages/viewer.html')),
  path.normalize(path.join(ROOT_DIR, 'js/core/pdf-studio.js'))
]);

function scanDirectory(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath, fileList);
    } else if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.html'))) {
      if (!EXCLUDED_FILES.has(path.normalize(fullPath))) {
        fileList.push(fullPath);
      }
    }
  }
  return fileList;
}

function runCheck() {
  console.log('========================================================================');
  console.log('   GUARD TEST: ENFORCE ZERO UNSANITIZED ignoreEncryption: true         ');
  console.log('========================================================================\n');

  const allFiles = [];
  TARGET_DIRS.forEach(dir => scanDirectory(dir, allFiles));

  console.log(`Scanning ${allFiles.length} files across core, components, utils, and pages...\n`);

  const violations = [];
  const regex = /ignoreEncryption\s*:\s*true/;

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (regex.test(line)) {
        if (!line.includes('// allow-ignore-encryption:')) {
          violations.push({
            file: path.relative(ROOT_DIR, filePath),
            line: i + 1,
            code: line.trim()
          });
        }
      }
    }
  }

  if (violations.length > 0) {
    console.error(`❌ Found ${violations.length} forbidden instance(s) of ignoreEncryption: true:\n`);
    violations.forEach(v => {
      console.error(`  - ${v.file}:${v.line} -> ${v.code}`);
    });
    console.error('\nReplace with PDFTools.FileUtils.loadPdfDecrypted(...) or add `// allow-ignore-encryption: alasan`.\n');
    process.exit(1);
  }

  console.log(`✓ 0 forbidden instances of ignoreEncryption: true found across ${allFiles.length} files.`);
  console.log('✅ [PASS] No unsanitized ignoreEncryption: true detected.\n');
}

if (require.main === module) {
  runCheck();
}

module.exports = { runCheck };
