/**
 * Guard Test: Check for Single-Page copyPages in Loops
 *
 * Scans js/ and pages/ (excluding vendor/studio files) to prevent
 * performance regressions where copyPages is called with a single-element
 * array in a loop instead of batching.
 *
 * Legitimate exceptions must be documented with:
 *   // allow-single-page-copy: <reason>
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

const SCAN_DIRS = ['js', 'pages'];
const EXCLUDED_PATHS = [
  path.normalize('js/lib'),
  path.normalize('js/studio'),
  path.normalize('js/core/pdf-studio.js'),
  path.normalize('pages/viewer.html')
];

function isExcluded(filePath) {
  const norm = path.normalize(filePath);
  return EXCLUDED_PATHS.some(exc => norm.includes(exc));
}

function getAllFiles(dirPath, extensions = ['.js', '.html']) {
  let files = [];
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (isExcluded(fullPath)) {
      continue;
    }
    if (entry.isDirectory()) {
      files = files.concat(getAllFiles(fullPath, extensions));
    } else if (extensions.some(ext => entry.name.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

function auditCopyPagesLoops() {
  console.log('========================================================================');
  console.log('       GUARD AUDIT: NO UNBATCHED copyPages([item]) IN LOOPS            ');
  console.log('========================================================================\n');

  let allFiles = [];
  for (const dir of SCAN_DIRS) {
    const fullDir = path.join(ROOT_DIR, dir);
    if (fs.existsSync(fullDir)) {
      allFiles = allFiles.concat(getAllFiles(fullDir));
    }
  }

  console.log(`Scanning ${allFiles.length} files across js/ and pages/...`);

  // Matches .copyPages(..., [ single_element ])
  // e.g. .copyPages(doc, [item.pageIndex]) or .copyPages(src, [i])
  const singlePageCopyRegex = /\.copyPages\s*\([^,]+,\s*\[\s*[^,\]]+\s*\]\s*\)/;
  const allowCommentPattern = /allow-single-page-copy/i;

  const violations = [];
  const allowedExceptions = [];

  for (const file of allFiles) {
    const relPath = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
    const content = fs.readFileSync(file, 'utf8');
    const lines = content.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (singlePageCopyRegex.test(line)) {
        const prevLine = i > 0 ? lines[i - 1] : '';
        const hasAllowance = allowCommentPattern.test(line) || allowCommentPattern.test(prevLine);

        if (hasAllowance) {
          allowedExceptions.push({
            file: relPath,
            line: i + 1,
            code: line.trim()
          });
        } else {
          violations.push({
            file: relPath,
            line: i + 1,
            code: line.trim()
          });
        }
      }
    }
  }

  console.log('\nAllowed exceptions documented with // allow-single-page-copy:');
  if (allowedExceptions.length === 0) {
    console.log('  (none)');
  } else {
    for (const ex of allowedExceptions) {
      console.log(`  ✓ ${ex.file}:${ex.line} -> ${ex.code}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`TOTAL FILES SCANNED      : ${allFiles.length}`);
  console.log(`ALLOWED EXCEPTIONS FOUND : ${allowedExceptions.length}`);
  console.log(`VIOLATIONS FOUND         : ${violations.length}`);
  console.log('========================================================================\n');

  if (violations.length > 0) {
    console.error('❌ [FAIL] Unbatched single-page copyPages call(s) detected without allowance:');
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} -> ${v.code}`);
    }
    console.error('\nFix: Batch page copies in a single copyPages call to prevent stream duplication.');
    return { success: false, violations };
  }

  console.log('✅ [PASS] No unbatched copyPages single-element loops found in codebase.');
  return { success: true, violations: [] };
}

if (require.main === module) {
  const result = auditCopyPagesLoops();
  process.exit(result.success ? 0 : 1);
}

module.exports = { auditCopyPagesLoops };
