/**
 * Build OCR Worker Bundle
 * Merges Tesseract Core WASM runtime (tesseract-core-lstm.wasm.js) and Tesseract.js Worker (worker.min.js)
 * into a single standalone offline script (tesseract-worker.bundle.js) using JSON.stringify for proper escaping.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const REPO_ROOT = path.resolve(__dirname, '..');
const TESS_DIR = path.resolve(REPO_ROOT, 'js/lib/tesseract');

const corePath = path.resolve(TESS_DIR, 'tesseract-core-lstm.wasm.js');
const workerPath = path.resolve(TESS_DIR, 'worker.min.js');
const bundlePath = path.resolve(TESS_DIR, 'tesseract-worker.bundle.js');

console.log('Building tesseract-worker.bundle.js from:');
console.log('  Core:   ', path.relative(REPO_ROOT, corePath));
console.log('  Worker: ', path.relative(REPO_ROOT, workerPath));

if (!fs.existsSync(corePath)) {
  console.error(`Error: Core file not found: ${corePath}`);
  process.exit(1);
}
if (!fs.existsSync(workerPath)) {
  console.error(`Error: Worker file not found: ${workerPath}`);
  process.exit(1);
}

const coreCode = fs.readFileSync(corePath, 'utf8');
const workerCode = fs.readFileSync(workerPath, 'utf8');

// Ensure TesseractCore is explicitly attached to worker global scope (self / globalThis)
const exportShim = `\nif (typeof self !== 'undefined') { self.TesseractCore = TesseractCore; }\nif (typeof globalThis !== 'undefined') { globalThis.TesseractCore = TesseractCore; }\n`;

const combinedWorkerScript = coreCode + exportShim + workerCode;

// Build standalone bundle wrapper with safely serialized string literal via JSON.stringify
const bundleContent = `(function() {
  var workerCode = ${JSON.stringify(combinedWorkerScript)};
  if (typeof window !== 'undefined') {
    window.__TESSERACT_WORKER_CODE__ = workerCode;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.__TESSERACT_WORKER_CODE__ = workerCode;
  }
})();
`;

fs.writeFileSync(bundlePath, bundleContent, 'utf8');

const hash = crypto.createHash('sha256').update(fs.readFileSync(bundlePath)).digest('hex');
const stats = fs.statSync(bundlePath);

console.log('✔ Successfully generated tesseract-worker.bundle.js');
console.log(`  Size:   ${stats.size.toLocaleString('id-ID')} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
console.log(`  SHA256: ${hash}`);
