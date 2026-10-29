/**
 * Static Guard: Service Worker Manifest & App Shell Integrity
 *
 * Verifies that:
 * 1. sw-manifest.json exists and its composite hash matches current app shell file contents.
 * 2. sw.js exists and has the correct matching CACHE_VERSION.
 * 3. Total precached app shell size is strictly under 5 MB (preventing initial load bloat).
 * 4. Zero OCR language models (lang-data) or heavy studio files are present in precache list.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { buildManifest } = require('../scripts/build_sw_manifest');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'sw-manifest.json');
const SW_PATH = path.join(ROOT_DIR, 'sw.js');

console.log('========================================================================');
console.log('       STATIC GUARD: SERVICE WORKER MANIFEST & PRECACHE INTEGRITY       ');
console.log('========================================================================\n');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ [FAIL] sw-manifest.json tidak ditemukan! Jalankan: node scripts/build_sw_manifest.js');
  process.exit(1);
}

if (!fs.existsSync(SW_PATH)) {
  console.error('❌ [FAIL] sw.js tidak ditemukan! Jalankan: node scripts/build_sw_manifest.js');
  process.exit(1);
}

const existingManifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
const currentManifest = buildManifest();

// 1. Verify Hash & Version parity
if (existingManifest.compositeHash !== currentManifest.compositeHash) {
  console.error('❌ [FAIL] sw-manifest.json kedaluwarsa! Berkas app shell telah dimodifikasi.');
  console.error(`  Manifest saat ini : ${existingManifest.compositeHash.slice(0, 10)}`);
  console.error(`  Kalkulasi aktual  : ${currentManifest.compositeHash.slice(0, 10)}`);
  console.error('\nJalankan `node scripts/build_sw_manifest.js` untuk memperbarui sw-manifest.json dan sw.js.');
  process.exit(1);
}
console.log(`✓ Hash manifest cocok: ${existingManifest.version}`);

// 2. Verify sw.js embeds the exact version
const swContent = fs.readFileSync(SW_PATH, 'utf8');
if (!swContent.includes(`CACHE_VERSION = '${existingManifest.version}'`)) {
  console.error(`❌ [FAIL] sw.js tidak memuat CACHE_VERSION yang sesuai (${existingManifest.version})`);
  process.exit(1);
}
console.log(`✓ sw.js memuat CACHE_VERSION yang sesuai: ${existingManifest.version}`);

// 3. Verify Precache Size Limit (< 5 MB)
const MAX_PRECACHE_BYTES = 5 * 1024 * 1024;
if (existingManifest.totalBytes > MAX_PRECACHE_BYTES) {
  console.error(`❌ [FAIL] Ukuran precache (${existingManifest.totalMB} MB) melebihi batas maksimum 5.0 MB!`);
  process.exit(1);
}
console.log(`✓ Ukuran precache aman di bawah batas: ${existingManifest.totalMB} MB (< 5.0 MB)`);

// 4. Verify Exclusion of Heavy OCR Models & Viewer
const forbiddenInPrecache = [
  'viewer.html',
  'tesseract/lang-data',
  'pdf-studio.js'
];

for (const entry of existingManifest.files) {
  for (const forbidden of forbiddenInPrecache) {
    if (entry.url.includes(forbidden)) {
      console.error(`❌ [FAIL] Berkas terlarang ditemukan di precache: ${entry.url}`);
      process.exit(1);
    }
  }
}
console.log('✓ Model bahasa OCR & modul studio terkonfirmasi tidak ikut dalam precache awal.');

console.log('\n✅ [PASS] Service Worker Manifest & Precache Guard PASSED');
console.log('========================================================================\n');
