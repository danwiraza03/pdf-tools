/**
 * PDF Tools — Browser Test: Merge Loading State & Asynchronous Loading Queue
 *
 * Verifies:
 * 1. During file extraction, toolbar buttons (#expandAllBtn, #collapseAllBtn, etc.)
 *    and #mergeBtn are disabled and have aria-disabled="true".
 * 2. #organizerArea has aria-busy="true" during loading and visible loading indicator.
 * 3. After loading completes, buttons are re-enabled and aria-busy is removed.
 * 4. If Expand All is active, newly added files are immediately rendered expanded.
 *    If Collapse All is active, newly added files are rendered collapsed.
 * 5. Files added while loading is still in progress are queued and processed in order.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');
const helpers = require('./helpers');
const { getTempDir } = require('./helpers/tmp');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

async function createLargeMultiPagePdf(pageCount = 60) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([500, 300]);
    page.drawText(`LARGE_DOC_PAGE_${i}`, {
      x: 50,
      y: 150,
      size: 18,
      font,
      color: PDFLib.rgb(0, 0, 0)
    });
  }
  return await doc.save();
}

async function createSmallPdf(pageCount = 4, prefix = 'SMALL') {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([500, 300]);
    page.drawText(`${prefix}_PAGE_${i}`, {
      x: 50,
      y: 150,
      size: 18,
      font,
      color: PDFLib.rgb(0.2, 0.4, 0.8)
    });
  }
  return await doc.save();
}

async function runMergeLoadingStateSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       MERGE PAGE: LOADING STATE & QUEUE MANAGEMENT AUDIT               ');
  console.log('========================================================================\n');

  const temp = getTempDir('merge_loading_test_');
  const tempDir = temp.path;

  const pdf60Bytes = await createLargeMultiPagePdf(60);
  const pdf60Path = path.join(tempDir, 'large_doc_60p.pdf');
  fs.writeFileSync(pdf60Path, pdf60Bytes);

  const pdfSmallBytes1 = await createSmallPdf(3, 'DOC2');
  const pdfSmallPath1 = path.join(tempDir, 'doc2_3p.pdf');
  fs.writeFileSync(pdfSmallPath1, pdfSmallBytes1);

  const pdfSmallBytes2 = await createSmallPdf(2, 'DOC3');
  const pdfSmallPath2 = path.join(tempDir, 'doc3_2p.pdf');
  fs.writeFileSync(pdfSmallPath2, pdfSmallBytes2);

  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });

  try {
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });

    // -------------------------------------------------------------------------
    // TEST PART 1: Verification during active loading of large PDF
    // -------------------------------------------------------------------------
    console.log('  1. Uploading large 60-page PDF and checking loading state...');
    const dropzoneInput = page.locator('#dropzone input[type="file"]');

    // Trigger file selection
    await dropzoneInput.setInputFiles(pdf60Path);

    // IMMEDIATELY inspect loading state before parsing finishes
    const loadingStateDuring = await page.evaluate(() => {
      const organizer = document.getElementById('organizerArea');
      const expandAllBtn = document.getElementById('expandAllBtn');
      const collapseAllBtn = document.getElementById('collapseAllBtn');
      const rotateAllBtn = document.getElementById('rotateAllBtn');
      const resetOrderBtn = document.getElementById('resetOrderBtn');
      const clearAllPagesBtn = document.getElementById('clearAllPagesBtn');
      const mergeBtn = document.getElementById('mergeBtn');

      const isAriaBusy = organizer && organizer.getAttribute('aria-busy') === 'true';

      const toolbarButtons = [expandAllBtn, collapseAllBtn, rotateAllBtn, resetOrderBtn, clearAllPagesBtn, mergeBtn];
      const allDisabled = toolbarButtons.every(btn => btn && btn.disabled === true);
      const allAriaDisabled = toolbarButtons.every(btn => btn && btn.getAttribute('aria-disabled') === 'true');

      // Check for visible loading indicator or aria-live status text
      const loadingIndicator = document.querySelector('.merge-loading-indicator, #mergeLoadingStatus, [data-merge-loading]');
      const hasVisibleIndicator = Boolean(loadingIndicator && window.getComputedStyle(loadingIndicator).display !== 'none');

      return {
        isAriaBusy,
        allDisabled,
        allAriaDisabled,
        hasVisibleIndicator
      };
    });

    // Sub-requirement 1a: toolbar & mergeBtn disabled, aria-disabled, aria-busy="true", visible indicator
    assert.strictEqual(loadingStateDuring.isAriaBusy, true, 'Organizer area must have aria-busy="true" during loading');
    assert.strictEqual(loadingStateDuring.allDisabled, true, 'Toolbar buttons and mergeBtn must be disabled during loading');
    assert.strictEqual(loadingStateDuring.allAriaDisabled, true, 'Toolbar buttons and mergeBtn must have aria-disabled="true" during loading');
    assert.strictEqual(loadingStateDuring.hasVisibleIndicator, true, 'There must be a visible loading indicator or status message during loading');
    console.log('  ✓ 1a. Toolbar and merge buttons disabled, aria-disabled, aria-busy="true", and loading indicator verified.');

    // -------------------------------------------------------------------------
    // TEST PART 2: Verification after loading finishes
    // -------------------------------------------------------------------------
    console.log('  2. Waiting for loading to finish...');
    // Wait until aria-busy is removed or false and buttons are re-enabled
    await page.waitForFunction(() => {
      const organizer = document.getElementById('organizerArea');
      const mergeBtn = document.getElementById('mergeBtn');
      const busy = organizer && organizer.getAttribute('aria-busy');
      return (!busy || busy === 'false') && mergeBtn && !mergeBtn.disabled;
    }, { timeout: 25000 });

    const loadingStateAfter = await page.evaluate(() => {
      const organizer = document.getElementById('organizerArea');
      const expandAllBtn = document.getElementById('expandAllBtn');
      const collapseAllBtn = document.getElementById('collapseAllBtn');
      const mergeBtn = document.getElementById('mergeBtn');
      const busy = organizer ? organizer.getAttribute('aria-busy') : null;
      return {
        isBusy: busy === 'true',
        expandDisabled: expandAllBtn ? expandAllBtn.disabled : true,
        collapseDisabled: collapseAllBtn ? collapseAllBtn.disabled : true,
        mergeDisabled: mergeBtn ? mergeBtn.disabled : true
      };
    });

    assert.strictEqual(loadingStateAfter.isBusy, false, 'aria-busy must be false or removed after loading completes');
    assert.strictEqual(loadingStateAfter.expandDisabled, false, 'Expand All button must be enabled after loading');
    assert.strictEqual(loadingStateAfter.collapseDisabled, false, 'Collapse All button must be enabled after loading');
    assert.strictEqual(loadingStateAfter.mergeDisabled, false, 'Merge button must be enabled after loading');
    console.log('  ✓ 1b. Buttons re-enabled and aria-busy cleared after loading completes.');

    // -------------------------------------------------------------------------
    // TEST PART 3: Global view state persistence (Expand All vs Collapse All)
    // -------------------------------------------------------------------------
    console.log('  3. Testing global view state persistence on newly added files...');
    // Click Expand All so the global view mode becomes "expanded"
    await page.click('#expandAllBtn');
    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length >= 60, { timeout: 10000 });

    // Add a second document via extraFileInput
    const extraFileInput = page.locator('#extraFileInput');
    await extraFileInput.setInputFiles(pdfSmallPath1);

    // Wait until second document is loaded
    await page.waitForFunction(() => {
      const groups = document.querySelectorAll('.merge-file-group-wrap, .merge-page-card.stacked-doc');
      return groups.length >= 2;
    }, { timeout: 15000 });

    // Verify that since "Expand All" was active, the newly added document is immediately EXPANDED
    const isDoc2Expanded = await page.evaluate(() => {
      const wraps = document.querySelectorAll('.merge-file-group-wrap');
      // Look for the group of doc2
      const doc2Wrap = Array.from(wraps).find(w => w.textContent.includes('doc2_3p'));
      return Boolean(doc2Wrap && doc2Wrap.querySelectorAll('.merge-page-card.expanded-page').length === 3);
    });
    assert.strictEqual(isDoc2Expanded, true, 'Newly added file must immediately render expanded when Expand All is active');
    console.log('  ✓ 1c(i). Newly added file immediately rendered expanded following Expand All state.');

    // Now click Collapse All
    await page.click('#collapseAllBtn');
    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.stacked-doc').length >= 2, { timeout: 10000 });

    // Add a third document via extraFileInput
    await extraFileInput.setInputFiles(pdfSmallPath2);

    // Wait until third document is loaded
    await page.waitForFunction(() => {
      const groups = document.querySelectorAll('.merge-file-group-wrap, .merge-page-card.stacked-doc');
      return groups.length >= 3;
    }, { timeout: 15000 });

    // Verify that since "Collapse All" was active, newly added document is rendered COLLAPSED (stacked-doc)
    const isDoc3Collapsed = await page.evaluate(() => {
      const stackedCards = document.querySelectorAll('.merge-page-card.stacked-doc');
      const doc3Card = Array.from(stackedCards).find(c => c.textContent.includes('doc3_2p'));
      return Boolean(doc3Card);
    });
    assert.strictEqual(isDoc3Collapsed, true, 'Newly added file must render collapsed when Collapse All is active');
    console.log('  ✓ 1c(ii). Newly added file rendered collapsed following Collapse All state.');

    // -------------------------------------------------------------------------
    // TEST PART 4: Queue processing when files added concurrently during active load
    // -------------------------------------------------------------------------
    console.log('  4. Testing file queue when input triggered during active load...');
    // Reset state
    await page.click('#clearAllPagesBtn');
    const confirmModalBtn = await page.$('#confirmModalOkBtn, .btn-confirm-ok');
    if (confirmModalBtn) await confirmModalBtn.click();
    await page.waitForTimeout(400);

    // Trigger upload of large PDF
    await dropzoneInput.setInputFiles(pdf60Path);
    // While loading is active, immediately push doc2 into queue
    await page.waitForTimeout(50);
    await extraFileInput.setInputFiles(pdfSmallPath1);

    // Wait until all files in queue finish loading
    await page.waitForFunction(() => {
      const organizer = document.getElementById('organizerArea');
      const busy = organizer ? organizer.getAttribute('aria-busy') : null;
      const groups = document.querySelectorAll('.merge-file-group-wrap, .merge-page-card.stacked-doc');
      return (!busy || busy === 'false') && groups.length === 2;
    }, { timeout: 30000 });

    // Verify correct order: large_doc_60p first, then doc2_3p
    const fileOrder = await page.evaluate(() => {
      const cards = document.querySelectorAll('.merge-file-group-wrap, .merge-page-card.stacked-doc');
      return Array.from(cards).map(c => c.textContent.trim());
    });
    assert.ok(fileOrder[0].includes('large_doc_60p'), 'First document in queue must be large_doc_60p');
    assert.ok(fileOrder[1].includes('doc2_3p'), 'Second document in queue must be doc2_3p');
    console.log('  ✓ 1d. Concurrent file additions properly queued and processed in correct sequence.');

    console.log('\n========================================================================');
    console.log('✅ [PASS] Merge Loading State & Asynchronous Loading Queue Passed!');
    console.log('========================================================================\n');
  } finally {
    await page.close();
    temp.cleanup();
  }
}

if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await helpers.startTestServer(8765);
      browser = await chromium.launch({ headless: true });
      await runMergeLoadingStateSuite(browser, 'http://127.0.0.1:8765');
      process.exitCode = 0;
    } catch (err) {
      console.error('Fatal error in runMergeLoadingStateSuite:', err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = { runMergeLoadingStateSuite };
