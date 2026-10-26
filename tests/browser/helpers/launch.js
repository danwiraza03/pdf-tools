/**
 * Playwright Browser Launch Helpers
 *
 * Provides resilient browser launching for Chromium and WebKit.
 * - launchChromium: Launches Chromium browser
 * - launchWebKit: Launches WebKit browser.
 *   - If WebKit is missing on CI: throws explicit Error ("WebKit wajib di CI: jalankan npx playwright install --with-deps webkit")
 *   - If WebKit is missing locally: prints warning and returns null
 */

'use strict';

const { chromium, webkit } = require('playwright');

async function launchChromium(options = {}) {
  return await chromium.launch(options);
}

async function launchWebKit(options = {}) {
  try {
    return await webkit.launch(options);
  } catch (err) {
    const isCI = Boolean(process.env.CI);
    if (isCI) {
      const ciErr = new Error('WebKit wajib di CI: jalankan npx playwright install --with-deps webkit');
      ciErr.originalError = err;
      throw ciErr;
    } else {
      console.warn('⚠️  [DILEWATI] WebKit tidak terpasang di lingkungan lokal: jalankan npx playwright install --with-deps webkit');
      return null;
    }
  }
}

module.exports = {
  launchChromium,
  launchWebKit
};
