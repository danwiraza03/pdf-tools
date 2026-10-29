/**
 * Repository Hygiene & Tracked File Size Guard
 *
 * Verifies that:
 * 1. Git is available (prints 'DILEWATI: git tidak ditemukan' or fails on CI).
 * 2. No tracked file exceeds 20 MB (outside js/lib/tesseract).
 *    Supports lowering threshold via MAX_FILE_SIZE_MB or REPO_HYGIENE_MAX_MB.
 * 3. No tracked files exist in forbidden directories:
 *    - scratch/
 *    - trash/
 *    - tests/browser/screenshots/
 *    - js/editor/font-engine.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('           REPOSITORY HYGIENE & TRACKED FILE SIZE GUARD                ');
console.log('========================================================================\n');

function findGitBinary() {
  const candidates = [
    process.env.GIT_BIN,
    'git',
    'C:\\laragon\\bin\\git\\cmd\\git.exe',
    'C:\\laragon\\bin\\git\\bin\\git.exe',
    'C:\\Program Files\\Git\\cmd\\git.exe',
    'C:\\Program Files (x86)\\Git\\cmd\\git.exe'
  ].filter(Boolean);

  for (const bin of candidates) {
    try {
      const out = execSync(`"${bin}" --version`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      if (out && out.includes('git version')) {
        return bin;
      }
    } catch (e) {}
  }
  return null;
}

const gitBin = findGitBinary();
if (!gitBin) {
  if (process.env.CI) {
    console.error('❌ FAIL: git tidak ditemukan di lingkungan CI');
    process.exit(1);
  } else {
    console.log('ℹ️  DILEWATI: git tidak ditemukan');
    process.exit(0);
  }
}

let trackedOutput;
try {
  trackedOutput = execSync(`"${gitBin}" ls-files`, {
    cwd: ROOT_DIR,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
} catch (err) {
  if (process.env.CI) {
    console.error('❌ FAIL: Gagal menjalankan git ls-files di lingkungan CI:', err.message);
    process.exit(1);
  } else {
    console.log('ℹ️  DILEWATI: git tidak ditemukan atau error menjalankan git ls-files');
    process.exit(0);
  }
}

const trackedFiles = trackedOutput
  .split('\n')
  .map(f => f.trim().replace(/\\/g, '/'))
  .filter(Boolean);

console.log(`Memeriksa ${trackedFiles.length} berkas terlacak di repositori...\n`);

let passed = true;
const errors = [];

// Threshold configuration:
// Default: 20 MB outside js/lib/tesseract
// Lowering threshold via MAX_FILE_SIZE_MB or REPO_HYGIENE_MAX_MB or TESSERACT_MAX_MB
const defaultMaxMb = 20;
const customMaxMb = process.env.MAX_FILE_SIZE_MB || process.env.REPO_HYGIENE_MAX_MB;
const thresholdMb = customMaxMb ? parseFloat(customMaxMb) : defaultMaxMb;
const thresholdBytes = thresholdMb * 1024 * 1024;

// If user lowers threshold via env var (< 20) or sets CHECK_TESSERACT=1 or TESSERACT_MAX_MB,
// evaluate Tesseract files against the threshold to prove test sensitivity
const checkTesseract = process.env.CHECK_TESSERACT === '1' ||
  process.env.TESSERACT_MAX_MB != null ||
  Boolean(customMaxMb && parseFloat(customMaxMb) < defaultMaxMb);

const tesseractThresholdMb = process.env.TESSERACT_MAX_MB
  ? parseFloat(process.env.TESSERACT_MAX_MB)
  : thresholdMb;
const tesseractThresholdBytes = tesseractThresholdMb * 1024 * 1024;

// 1. Check file size limits
for (const relFile of trackedFiles) {
  const fullPath = path.join(ROOT_DIR, relFile);
  if (!fs.existsSync(fullPath)) continue;

  let stat;
  try {
    stat = fs.statSync(fullPath);
  } catch (e) {
    continue;
  }

  const isTesseract = relFile.startsWith('js/lib/tesseract/');

  if (isTesseract) {
    if (checkTesseract && stat.size > tesseractThresholdBytes) {
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      errors.push(`Berkas terlacak melebihi ambang batas ukuran: ${relFile} (${mb} MB > ${tesseractThresholdMb} MB)`);
      passed = false;
    }
  } else {
    if (stat.size > thresholdBytes) {
      const mb = (stat.size / (1024 * 1024)).toFixed(2);
      errors.push(`Berkas terlacak melebihi ambang batas ukuran: ${relFile} (${mb} MB > ${thresholdMb} MB)`);
      passed = false;
    }
  }
}

// 2. Check forbidden tracked paths: scratch/, trash/, tests/browser/screenshots/, js/editor/font-engine.js
const forbiddenPrefixes = [
  'scratch/',
  'trash/',
  'tests/browser/screenshots/'
];
const forbiddenExact = [
  'js/editor/font-engine.js'
];

for (const relFile of trackedFiles) {
  for (const prefix of forbiddenPrefixes) {
    if (relFile.startsWith(prefix)) {
      errors.push(`Berkas terlacak di lokasi terlarang (${prefix}): ${relFile}`);
      passed = false;
    }
  }
  for (const exact of forbiddenExact) {
    if (relFile === exact) {
      errors.push(`Berkas sisa terlarang masih terlacak di repositori: ${relFile}`);
      passed = false;
    }
  }
}

// 3. Check for forbidden .txt, .log, or .tmp files tracked in project root
// Whitelist: berkas di akar proyek yang secara sah merupakan bagian dari proyek
const ROOT_EXT_WHITELIST = [
  // Contoh: 'LICENSE.txt' (jika ada di masa mendatang)
];

for (const relFile of trackedFiles) {
  // Berkas di akar proyek tidak mengandung '/'
  if (!relFile.includes('/')) {
    const ext = path.extname(relFile).toLowerCase();
    if (['.txt', '.log', '.tmp'].includes(ext)) {
      if (!ROOT_EXT_WHITELIST.includes(relFile)) {
        errors.push(`Berkas terlacak terlarang (.txt/.log/.tmp) ditemukan di akar proyek: ${relFile} (daftar putih: ${JSON.stringify(ROOT_EXT_WHITELIST)})`);
        passed = false;
      }
    }
  }
}

if (!passed) {
  console.error('❌ [FAIL] Repository Hygiene Checks Failed:');
  for (const err of errors) {
    console.error(`  - ${err}`);
  }
  console.log('========================================================================\n');
  process.exit(1);
} else {
  console.log('✓ Tidak ada berkas terlacak > 20 MB di luar js/lib/tesseract.');
  console.log('✓ Tidak ada berkas terlacak di scratch/, trash/, atau tests/browser/screenshots/.');
  console.log('✓ Tidak ada berkas sisa js/editor/font-engine.js.');
  console.log('✓ Tidak ada berkas .txt, .log, atau .tmp terlacak di akar proyek (di luar daftar putih).');
  console.log('\n✅ [PASS] Repository Hygiene Guard PASSED');
  console.log('========================================================================\n');
  process.exit(0);
}
