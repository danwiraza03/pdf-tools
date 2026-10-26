const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const vm = require('vm');

const REPO_ROOT = path.resolve(__dirname, '..');
const bundlePath = path.resolve(REPO_ROOT, 'js/lib/tesseract/tesseract-worker.bundle.js');

console.log('>>> [1/2] Checking syntax of tesseract-worker.bundle.js with node --check...');
const checkResult = spawnSync(process.execPath, ['--check', bundlePath], {
  cwd: REPO_ROOT,
  encoding: 'utf8'
});

if (checkResult.status !== 0) {
  console.error('❌ node --check GAGAL: tesseract-worker.bundle.js mengandung kesalahan sintaks!');
  console.error(checkResult.stderr || checkResult.stdout);
  process.exit(1);
}
console.log('✓ node --check lolos tanpa error sintaks.');

console.log('>>> [2/2] Checking window.__TESSERACT_WORKER_CODE__ definition upon execution...');
try {
  const bundleCode = fs.readFileSync(bundlePath, 'utf8');
  const sandbox = {
    window: {},
    globalThis: {}
  };
  sandbox.globalThis = sandbox;
  sandbox.window = sandbox;

  vm.createContext(sandbox);
  vm.runInContext(bundleCode, sandbox);

  if (typeof sandbox.window.__TESSERACT_WORKER_CODE__ !== 'string' || sandbox.window.__TESSERACT_WORKER_CODE__.length === 0) {
    console.error('❌ window.__TESSERACT_WORKER_CODE__ tidak terdefinisi atau kosong setelah script dijalankan!');
    process.exit(1);
  }

  console.log(`✓ window.__TESSERACT_WORKER_CODE__ terdefinisi (${sandbox.window.__TESSERACT_WORKER_CODE__.length} karakter).`);
  console.log('✔ OCR Bundle Integrity Check PASSED!');
  process.exit(0);
} catch (err) {
  console.error('❌ Gagal menjalankan tesseract-worker.bundle.js:', err);
  process.exit(1);
}
