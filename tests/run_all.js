const { spawnSync } = require('child_process');
const path = require('path');

const TESTS_DIR = __dirname;

const tests = [
  { name: 'Repository JS Syntax Validation', file: 'validate_repo_syntax.js' },
  { name: 'HTML Inline Scripts Syntax Validation', file: 'validate_html_scripts.js' },
  { name: 'Core Scripts Syntax Validation', file: 'validate_all_scripts.js' },
  { name: 'Compress Page Script Validation', file: 'validate_compress_syntax.js' },
  { name: 'Multi-Menu & Hero SVG Icon Consistency Audit', file: 'check_icon_consistency.js' },
  { name: 'Command Palette Icon Parity Audit', file: 'check_palette_icons.js' },
  { name: 'OCR Bundle Integrity Check', file: 'check_ocr_bundle.js' },
  { name: 'Header Dropdown & Mega Menu Verification', file: 'test_header_dropdown.js' },
  { name: 'PDF Studio In-Memory Page Operations (Insert, Duplicate, Delete)', file: 'test_studio_page_ops.js' },
  { name: 'End-to-End Functional Tools Audit', file: 'audit_all_tools.js' },
  { name: 'PDF Protect & Unlock Engine Verification', file: 'test_pdf_protect.js' },
  { name: 'Permanent Redaction & Anti-Leak Test', file: 'test_redaction_rasterize.js' },
  { name: 'PDF Studio Export Redaction Ordering Test', file: 'test_studio_export_redaction.js' },
  { name: 'UI Consistency (Zero Emoji & Zero Native Dialogs)', file: 'check_ui_rules.js' },
  { name: 'Local Server Security & Path Traversal Audit', file: 'test_server_security.js' },
  { name: 'Zero External HTTP(S) URLs Offline Compliance', file: 'test_no_external_urls.js' },
  { name: 'SortableJS Mobile Touch Options Audit (delayOnTouchOnly)', file: 'check_sortable_touch.js' },
  { name: 'Guard Audit: Batched copyPages Loops', file: 'check_copypages_loops.js' },
  { name: 'Merge Size & Resource Retention Verification', file: 'test_merge_size.js' },
  { name: 'Copy Fidelity (Ghost Pages, Link Remapping, Bookmarks)', file: 'test_copy_fidelity.js' },
  { name: 'Repository Hygiene Guard (File Size & Untracked Paths)', file: 'check_repo_hygiene.js' },
  { name: 'Browser Launch Helper & Fallback Audit', file: 'test_launch_helper.js' },
  { name: 'Encrypted Inputs Test Suite (All 15 Tools x 4 Variants)', file: 'test_encrypted_inputs.js' },
  { name: 'Zero Unsanitized ignoreEncryption: true Guard', file: 'check_no_ignore_encryption.js' },
  { name: 'Digitally Signed PDF Merging & Stamp Conversion', file: 'test_merge_signed.js' }
];

console.log('========================================================================');
console.log('                RUNNING ALL PDF TOOLS TEST SUITES                       ');
console.log('========================================================================\n');

let failedTests = [];
let skippedToolsCount = 0;

for (const test of tests) {
  const filePath = path.join(TESTS_DIR, test.file);
  console.log(`>>> [TEST] Running: ${test.name} (${test.file})`);
  console.log('------------------------------------------------------------------------');

  const result = spawnSync(process.execPath, [filePath], {
    cwd: path.resolve(TESTS_DIR, '..'),
    encoding: 'utf8'
  });

  const stdout = result.stdout || '';
  const stderr = result.stderr || '';

  if (stdout.trim()) {
    console.log(stdout.trimEnd());
  }
  if (stderr.trim()) {
    console.error(stderr.trimEnd());
  }

  // Parse skipped tools if running audit_all_tools.js
  if (test.file === 'audit_all_tools.js') {
    const skipMatch = (stdout + '\n' + stderr).match(/(\d+)\s+skipped/i);
    if (skipMatch) {
      skippedToolsCount = parseInt(skipMatch[1], 10);
    }
  }

  // Check exit code
  let failed = result.status !== 0;

  // Check output for explicit error reports when script returns exit code 0
  const combinedOutput = stdout + '\n' + stderr;
  if (/Result:\s+[1-9]\d*\s+(syntax\s+)?errors/i.test(combinedOutput)) {
    failed = true;
  }
  if (/mismatches found:\s+[1-9]\d*/i.test(combinedOutput) || /[1-9]\d*\s+mismatches found/i.test(combinedOutput)) {
    failed = true;
  }
  if (/SYNTAX ERROR in/i.test(combinedOutput) || /Syntax error in/i.test(combinedOutput)) {
    failed = true;
  }
  if (/MISSING FILE:/i.test(combinedOutput)) {
    failed = true;
  }
  if (/\[FAIL\]|❌ FAILED/i.test(combinedOutput)) {
    failed = true;
  }

  if (failed) {
    console.log(`\n❌ [FAIL] ${test.name} FAILED!`);
    failedTests.push({ name: test.name, file: test.file, code: result.status });
  } else {
    console.log(`\n✅ [PASS] ${test.name} PASSED`);
  }

  console.log('========================================================================\n');
}

console.log('========================================================================');
console.log('                           FINAL SUMMARY                                ');
console.log('========================================================================');

const passedSuites = tests.length - failedTests.length;
const failedSuites = failedTests.length;

console.log(`Hasil: ${passedSuites} lulus, ${failedSuites} gagal, ${skippedToolsCount} tool dilewati`);

if (failedSuites === 0 && skippedToolsCount === 0) {
  console.log(`🎉 SEMUA ${tests.length} TEST SUITE LULUS LENGKAP (0 tool dilewati).`);
  console.log('========================================================================');
  process.exit(0);
} else if (failedSuites === 0) {
  console.log(`ℹ️  ${passedSuites} suite lulus, ${failedSuites} gagal, ${skippedToolsCount} tool dilewati di audit_all_tools.js (diverifikasi terpisah via browser).`);
  console.log('========================================================================');
  process.exit(0);
} else {
  console.error(`💥 ${failedSuites} dari ${tests.length} TEST SUITE GAGAL:`);
  for (const f of failedTests) {
    console.error(`  - ${f.name} (${f.file}) [Exit Code: ${f.code}]`);
  }
  console.log('========================================================================');
  process.exit(1);
}
