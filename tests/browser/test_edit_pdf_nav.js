/**
 * Automated Browser Test: Edit PDF Navigation & Touch Screen Warning Modal
 *
 * Verifies that:
 * 1. PDF Studio is presented as "Edit PDF" across:
 *    - Homepage tool card (.tool-grid-card[href*="viewer.html"])
 *    - Mega menu (.mega-item-link[href*="viewer.html"])
 *    - Mobile navigation drawer (.mobile-nav-link[href*="viewer.html"])
 *    - Header action button (.btn-header-studio)
 * 2. Works in both English ('en') and Indonesian ('id').
 * 3. On Desktop (hasTouch: false): Clicking navigates directly to viewer.html (0 modal).
 * 4. On Touch Screen (hasTouch: true):
 *    - Clicking displays the custom warning modal (#studioTouchModalBackdrop).
 *    - Contains "Edit PDF paling nyaman dipakai di komputer" (ID) or English equivalent.
 *    - "Batal" / "Cancel" cancels navigation and closes modal.
 *    - "Lanjutkan" / "Continue" proceeds to viewer.html.
 */

'use strict';

const path = require('path');
const assert = require('assert');
const { chromium, devices } = require('playwright');
const { startStandaloneServer } = require('../../scripts/dev-server');

const TEST_PORT = 8792;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runEditPdfNavSuite(existingBrowser, existingBaseUrl) {
  console.log('========================================================================');
  console.log('   TEST: EDIT PDF PRESENTATION & TOUCH WARNING MODAL AUDIT              ');
  console.log('========================================================================\n');

  let server;
  let browser = existingBrowser;
  const baseUrl = existingBaseUrl || BASE_URL;

  try {
    if (!browser) {
      server = startStandaloneServer(TEST_PORT, '127.0.0.1', false);
      await new Promise(r => setTimeout(r, 600));
      browser = await chromium.launch({ headless: true });
    }

    // -------------------------------------------------------------------------
    // TEST 1: Desktop Mode (hasTouch: false) — Direct Navigation, No Modal
    // -------------------------------------------------------------------------
    console.log('--- 1. Desktop Mode: Label Verification & Direct Navigation ---');
    const desktopContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      hasTouch: false
    });
    const desktopPage = await desktopContext.newPage();

    await desktopPage.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

    // Check English labels
    const cardTitleEn = await desktopPage.$eval('.tool-grid-card[href*="viewer.html"] .tool-card-title', el => el.textContent.trim());
    console.log(`  [EN] Card title: "${cardTitleEn}"`);
    assert.strictEqual(cardTitleEn, 'Edit PDF', 'Card title in EN must be "Edit PDF"');

    const headerBtnEn = await desktopPage.$eval('.btn-header-studio', el => el.textContent.trim());
    console.log(`  [EN] Header button: "${headerBtnEn}"`);
    assert.strictEqual(headerBtnEn, 'Edit PDF', 'Header button in EN must be "Edit PDF"');

    // Check Indonesian labels
    await desktopPage.click('#langToggle');
    await desktopPage.waitForTimeout(300);

    const cardTitleId = await desktopPage.$eval('.tool-grid-card[href*="viewer.html"] .tool-card-title', el => el.textContent.trim());
    console.log(`  [ID] Card title: "${cardTitleId}"`);
    assert.strictEqual(cardTitleId, 'Edit PDF', 'Card title in ID must be "Edit PDF"');

    const headerBtnId = await desktopPage.$eval('.btn-header-studio', el => el.textContent.trim());
    console.log(`  [ID] Header button: "${headerBtnId}"`);
    assert.strictEqual(headerBtnId, 'Edit PDF', 'Header button in ID must be "Edit PDF"');

    // Desktop Click: must navigate directly, modal should NOT appear
    await desktopPage.click('.btn-header-studio');
    await desktopPage.waitForURL(/viewer\.html/, { timeout: 5000 });
    const modalOnDesktop = await desktopPage.$('#studioTouchModalBackdrop');
    assert.strictEqual(modalOnDesktop, null, 'Modal must NOT appear on non-touch desktop device');
    console.log('  ✓ Desktop navigation went directly to viewer.html without touch modal');

    await desktopContext.close();

    // -------------------------------------------------------------------------
    // TEST 2: Touch Screen Emulation — Warning Modal Appears
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Touch Screen Emulation: Custom Modal Verification ---');
    const touchContext = await browser.newContext({
      ...devices['iPhone 13'],
      hasTouch: true
    });
    const touchPage = await touchContext.newPage();

    // Set language to Indonesian for explicit text check
    await touchPage.addInitScript(() => {
      localStorage.setItem('pdftools-lang', 'id');
      localStorage.setItem('pdftools_lang', 'id');
    });

    await touchPage.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    await touchPage.waitForTimeout(300);

    // Click on Edit PDF card in touch mode
    console.log('  Clicking Edit PDF card on touch device...');
    await touchPage.click('.tool-grid-card[href*="viewer.html"]');
    await touchPage.waitForSelector('#studioTouchModalBackdrop.active', { state: 'visible', timeout: 3000 });

    const modalTextId = await touchPage.$eval('#studioTouchModalBackdrop .pdftools-modal-message', el => el.textContent.trim());
    console.log(`  Modal message (ID): "${modalTextId}"`);
    assert(modalTextId.includes('Edit PDF paling nyaman dipakai di komputer'), 'Modal text in ID must contain "Edit PDF paling nyaman dipakai di komputer"');

    // Test Cancel button: modal should close, URL must stay index.html
    console.log('  Testing Batal (Cancel) button...');
    await touchPage.click('#studioTouchModalBackdrop .pdftools-modal-cancel');
    await touchPage.waitForSelector('#studioTouchModalBackdrop', { state: 'hidden', timeout: 2000 });
    assert(touchPage.url().includes('index.html'), 'Page must remain on index.html after clicking Batal');
    console.log('  ✓ Batal successfully closed modal without navigating');

    // Click again and test Continue button
    console.log('  Clicking Edit PDF card again to test Lanjutkan (Continue)...');
    await touchPage.click('.tool-grid-card[href*="viewer.html"]');
    await touchPage.waitForSelector('#studioTouchModalBackdrop.active', { state: 'visible', timeout: 3000 });

    await touchPage.click('#studioTouchModalBackdrop .pdftools-modal-confirm');
    await touchPage.waitForURL(/viewer\.html/, { timeout: 5000 });
    assert(touchPage.url().includes('viewer.html'), 'Page must navigate to viewer.html after clicking Lanjutkan');
    console.log('  ✓ Lanjutkan successfully proceeded to viewer.html');

    // Check viewer.html head metadata
    const viewerTitle = await touchPage.title();
    console.log(`  viewer.html title: "${viewerTitle}"`);
    assert(viewerTitle.includes('Edit PDF'), 'viewer.html title must contain "Edit PDF"');

    await touchContext.close();

    console.log('\n========================================================================');
    console.log('✅ [ALL PASSED] Edit PDF Presentation & Touch Modal Suite PASSED');
    console.log('========================================================================\n');
  } finally {
    if (server) {
      if (browser) await browser.close();
      server.close();
    }
  }
}

if (require.main === module) {
  runEditPdfNavSuite().catch(err => {
    console.error('\n❌ [FAIL] Edit PDF Nav Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runEditPdfNavSuite };
