/**
 * Clean Script for PDF Tools Repository
 *
 * Removes ephemeral build artifacts, test outputs, screenshots, and logs:
 * - tests/browser/screenshots/
 * - scratch/
 * - trash/
 * - test-results/
 * - playwright-report/
 * - *.log test files
 * - node_modules/ (only when --deep flag is passed)
 *
 * SAFETY GUARANTEES:
 * - NEVER touches .git or anything inside .git
 * - NEVER touches js/lib or anything inside js/lib
 * - NEVER deletes any git-tracked files
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const isDeep = process.argv.includes('--deep');

console.log('========================================================================');
console.log(`🧹 CLEAN REPOSITORY ${isDeep ? '(--deep mode)' : ''}`.trim());
console.log('========================================================================\n');

function getTrackedSet() {
  const gitBins = [
    process.env.GIT_BIN,
    'git',
    'C:\\laragon\\bin\\git\\cmd\\git.exe',
    'C:\\laragon\\bin\\git\\bin\\git.exe',
    'C:\\Program Files\\Git\\cmd\\git.exe'
  ].filter(Boolean);

  for (const bin of gitBins) {
    try {
      const out = execSync(`"${bin}" ls-files`, {
        cwd: ROOT_DIR,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore']
      });
      const set = new Set(
        out.split('\n').map(s => path.resolve(ROOT_DIR, s.trim()).toLowerCase()).filter(Boolean)
      );
      return set;
    } catch (e) {}
  }
  return new Set();
}

function getItemSize(itemPath) {
  if (!fs.existsSync(itemPath)) return 0;
  try {
    const stat = fs.statSync(itemPath);
    if (!stat.isDirectory()) return stat.size;
    let total = 0;
    const entries = fs.readdirSync(itemPath, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(itemPath, entry.name);
      if (entry.isDirectory()) {
        total += getItemSize(full);
      } else {
        total += fs.statSync(full).size;
      }
    }
    return total;
  } catch (e) {
    return 0;
  }
}

function formatBytes(bytes) {
  if (bytes >= 1024 * 1024) {
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }
  if (bytes >= 1024) {
    return (bytes / 1024).toFixed(2) + ' KB';
  }
  return bytes + ' B';
}

function findLogFiles(dir) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      const rel = path.relative(ROOT_DIR, full).replace(/\\/g, '/');
      if (
        rel === '.git' || rel.startsWith('.git/') ||
        rel === 'js/lib' || rel.startsWith('js/lib/') ||
        rel === 'node_modules' || rel.startsWith('node_modules/')
      ) {
        continue;
      }
      if (entry.isDirectory()) {
        results.push(...findLogFiles(full));
      } else if (entry.isFile() && entry.name.endsWith('.log')) {
        results.push(full);
      }
    }
  } catch (e) {}
  return results;
}

const trackedSet = getTrackedSet();

// Candidate paths relative to ROOT_DIR
const standardDirs = [
  'tests/browser/screenshots',
  'scratch',
  'trash',
  'test-results',
  'playwright-report'
];

if (isDeep) {
  standardDirs.push('node_modules');
}

let totalFreed = 0;
let deletedCount = 0;

console.log('Memeriksa target pembersihan...');

// 1. Process directories
for (const relDir of standardDirs) {
  const fullPath = path.resolve(ROOT_DIR, relDir);
  if (!fs.existsSync(fullPath)) continue;

  // Strict safety check
  const rel = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
  if (rel === '.git' || rel.startsWith('.git/') || rel === 'js/lib' || rel.startsWith('js/lib/')) {
    console.warn(`[LEWATI] Lokasi dilindungi: ${rel}`);
    continue;
  }
  if (trackedSet.has(fullPath.toLowerCase())) {
    console.warn(`[LEWATI] Berkas terlacak di git: ${rel}`);
    continue;
  }

  const size = getItemSize(fullPath);
  try {
    fs.rmSync(fullPath, { recursive: true, force: true });
    totalFreed += size;
    deletedCount++;
    console.log(`  ✓ Dihapus: ${relDir.padEnd(30)} (${formatBytes(size)})`);
  } catch (err) {
    console.error(`  ✗ Gagal menghapus ${relDir}: ${err.message}`);
  }
}

// 2. Process log files
const logFiles = findLogFiles(ROOT_DIR);
for (const logPath of logFiles) {
  const rel = path.relative(ROOT_DIR, logPath).replace(/\\/g, '/');
  if (trackedSet.has(logPath.toLowerCase())) {
    continue;
  }

  const size = getItemSize(logPath);
  try {
    fs.rmSync(logPath, { force: true });
    totalFreed += size;
    deletedCount++;
    console.log(`  ✓ Dihapus berkas log: ${rel.padEnd(25)} (${formatBytes(size)})`);
  } catch (err) {
    console.error(`  ✗ Gagal menghapus berkas log ${rel}: ${err.message}`);
  }
}

console.log('\n------------------------------------------------------------------------');
if (deletedCount === 0) {
  console.log('Repositori sudah bersih. Tidak ada berkas sementara yang perlu dihapus.');
} else {
  console.log(`Total dihapus: ${deletedCount} item.`);
  console.log(`Ukuran yang dibebaskan: ${formatBytes(totalFreed)}.`);
}
console.log('========================================================================\n');
