/**
 * Test: Browser Launch Helper (launch.js)
 *
 * Verifies that launchWebKit() behaves correctly when WebKit is not installed:
 * 1. WebKit tidak ada + CI aktif (CI=true / 1) -> MELEMPAR ERROR (GAGAL di CI)
 * 2. WebKit tidak ada + CI tidak aktif -> Mengembalikan NULL dan mencetak peringatan DILEWATI
 */

'use strict';

const assert = require('assert');
const path = require('path');
const playwright = require('playwright');

console.log('========================================================================');
console.log('             TEST BROWSER LAUNCH HELPER (LAUNCH.JS)                     ');
console.log('========================================================================\n');

async function run() {
  const launchHelperPath = path.resolve(__dirname, 'browser/helpers/launch.js');
  const { launchChromium, launchWebKit } = require(launchHelperPath);

  assert(typeof launchChromium === 'function', 'launchChromium must be a function');
  assert(typeof launchWebKit === 'function', 'launchWebKit must be a function');

  // Backup original env & launch
  const origCI = process.env.CI;
  const origWebkitLaunch = playwright.webkit.launch;
  let passed = 0;

  try {
    // Stub playwright.webkit.launch to simulate WebKit binary missing
    playwright.webkit.launch = async () => {
      const err = new Error("Executable doesn't exist at C:\\Users\\...\\webkit\\pw_run.bat. Run \"npx playwright install\"");
      err.name = 'PlaywrightMissingBinaryError';
      throw err;
    };

    // --- Scenario 1: WebKit tidak ada + CI aktif = GAGAL (melempar error) ---
    console.log('[Skenario 1] WebKit tidak ada + CI aktif (CI=true)');
    process.env.CI = 'true';
    let threwError = false;
    let thrownMessage = '';
    try {
      await launchWebKit({ headless: true });
    } catch (err) {
      threwError = true;
      thrownMessage = err.message;
    }

    assert(threwError, 'Skenario 1: launchWebKit wajib melempar error saat di lingkungan CI');
    assert(
      thrownMessage.includes('WebKit wajib di CI: jalankan npx playwright install --with-deps webkit'),
      `Skenario 1: Pesan error harus memuat instruksi instalasi WebKit (didapat: "${thrownMessage}")`
    );
    console.log(`  ✓ Berhasil menangkap error di CI: "${thrownMessage}"`);
    passed++;

    // --- Scenario 2: WebKit tidak ada + CI tidak aktif = DILEWATI (return null) ---
    console.log('\n[Skenario 2] WebKit tidak ada + CI tidak aktif (Lokal)');
    delete process.env.CI;
    const warnings = [];
    const origWarn = console.warn;
    console.warn = (...args) => warnings.push(args.join(' '));

    let result = null;
    let noThrow = false;
    try {
      result = await launchWebKit({ headless: true });
      noThrow = true;
    } finally {
      console.warn = origWarn;
    }

    assert(noThrow, 'Skenario 2: launchWebKit tidak boleh melempar error di lingkungan lokal');
    assert(result === null, 'Skenario 2: launchWebKit harus mengembalikan null saat WebKit tidak ada di lokal');
    assert(
      warnings.some(w => w.includes('DILEWATI') || w.includes('WebKit')),
      'Skenario 2: Harus mencetak peringatan DILEWATI saat WebKit tidak ada di lokal'
    );
    console.log('  ✓ Berhasil mengembalikan null dan mencetak peringatan DILEWATI');
    passed++;

  } finally {
    // Restore
    playwright.webkit.launch = origWebkitLaunch;
    if (origCI !== undefined) {
      process.env.CI = origCI;
    } else {
      delete process.env.CI;
    }
  }

  console.log('\n========================================================================');
  console.log(`LAUNCH HELPER TEST RESULTS: ${passed} passed, 0 failed`);
  console.log('✅ [PASS] Browser Launch Helper Test PASSED');
  console.log('========================================================================\n');
}

if (require.main === module) {
  run().catch(err => {
    console.error('\n❌ [FAIL] Browser Launch Helper Test Failed:');
    console.error(err.message || err);
    process.exit(1);
  });
}

module.exports = { run };
