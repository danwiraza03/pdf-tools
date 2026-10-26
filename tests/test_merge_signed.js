/**
 * Automated Test: Digitally Signed PDF Merging & Stamp Conversion
 *
 * Verifies that merging signed PDF documents converts digital signatures (/Widget, /FT /Sig)
 * into visual stamp annotations (/Stamp with /AP) without any cryptic dialogs or corruption.
 *
 * Requirements:
 * 1. Node test: PDFTools.Merge.merge([signed, normal])
 *    - Result does not contain /Widget /FT /Sig with /V ByteRange
 *    - Result contains /Stamp annotation with /AP appearance
 *    - No /SigFlags, /DSS, /Perms in catalog
 *    - Text "KONTRAK-ASLI" remains intact
 *    - Output page count is 2
 * 2. Browser test (Chromium Desktop and iPhone 13 WebKit):
 *    - Upload signed fixture and normal PDF to pages/merge.html
 *    - Click Merge and verify output with same assertions
 *    - Render page 1: pixels in signature area are NOT blank white
 *    - Zero modal dialogs / alert popups
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { devices } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

const { createSignedPdfFixture, createNormalPdfFixture } = require('./helpers/signed-fixture');
const { startTestServer } = require('./browser/helpers');
const { launchChromium, launchWebKit } = require('./browser/helpers/launch');
const { getTempDir } = require('./browser/helpers/tmp');

// Setup Node environment for PDFTools core modules
global.window = global;
global.PDFLib = PDFLib;
global.pdfjsLib = pdfjs;

// Filter out harmless PDF.js worker font fetching warnings in Node environment
const _origStderrWrite = process.stderr.write;
process.stderr.write = function (chunk, ...args) {
  if (chunk && chunk.toString().includes('fetchStandardFontData')) return true;
  return _origStderrWrite.apply(process.stderr, [chunk, ...args]);
};

require(path.join(ROOT_DIR, 'js/utils/file-utils.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-compress.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-copy.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-merge.js'));

/**
 * Asserts all integrity and security criteria on merged PDF bytes
 */
async function assertMergedPdfSignedClean(mergedBytes) {
  assert.ok(mergedBytes && mergedBytes.length > 0, 'Merged PDF bytes must not be empty');

  const outDoc = await PDFLib.PDFDocument.load(mergedBytes);
  assert.strictEqual(outDoc.getPageCount(), 2, `Expected 2 pages, got ${outDoc.getPageCount()}`);

  // Page 1: Check signature conversion
  const page1 = outDoc.getPage(0);
  const annotsRef = page1.node.get(PDFLib.PDFName.of('Annots'));
  const annots = outDoc.context.lookup(annotsRef);
  assert.ok(annots instanceof PDFLib.PDFArray && annots.size() > 0, 'Page 1 must contain annotations array');

  let foundStamp = false;
  let foundUnwantedSig = false;

  for (let i = 0; i < annots.size(); i++) {
    const annot = outDoc.context.lookup(annots.get(i));
    if (!(annot instanceof PDFLib.PDFDict)) continue;

    const subtype = annot.get(PDFLib.PDFName.of('Subtype'));
    const subtypeStr = subtype ? subtype.toString() : '';
    const ft = annot.get(PDFLib.PDFName.of('FT'));
    const ftStr = ft ? ft.toString() : '';
    const v = annot.get(PDFLib.PDFName.of('V'));

    if (subtypeStr === '/Widget' || ftStr === '/Sig') {
      foundUnwantedSig = true;
    }
    if (v) {
      const vObj = outDoc.context.lookup(v);
      if (vObj instanceof PDFLib.PDFDict && (vObj.get(PDFLib.PDFName.of('ByteRange')) || vObj.get(PDFLib.PDFName.of('Contents')))) {
        foundUnwantedSig = true;
      }
    }

    if (subtypeStr === '/Stamp') {
      const ap = annot.get(PDFLib.PDFName.of('AP'));
      assert.ok(ap, 'Converted /Stamp annotation must retain visual appearance /AP');
      foundStamp = true;
    }
  }

  assert.strictEqual(foundUnwantedSig, false, 'Merged document must NOT contain /Widget /FT /Sig or /V ByteRange');
  assert.strictEqual(foundStamp, true, 'Merged document MUST contain converted /Stamp annotation with /AP');

  // Check Catalog: no /DSS, no /Perms, no /SigFlags
  const catalog = outDoc.context.lookup(outDoc.context.trailerInfo.Root);
  assert.strictEqual(catalog.get(PDFLib.PDFName.of('DSS')), undefined, 'Catalog must not contain /DSS');
  assert.strictEqual(catalog.get(PDFLib.PDFName.of('Perms')), undefined, 'Catalog must not contain /Perms');

  const acroFormRef = catalog.get(PDFLib.PDFName.of('AcroForm'));
  if (acroFormRef) {
    const acroForm = outDoc.context.lookup(acroFormRef);
    if (acroForm instanceof PDFLib.PDFDict) {
      assert.strictEqual(acroForm.get(PDFLib.PDFName.of('SigFlags')), undefined, 'AcroForm must not contain /SigFlags');
    }
  }

  // Check text preservation via PDF.js
  const loadingTask = pdfjs.getDocument({ data: mergedBytes });
  const pdfJsDoc = await loadingTask.promise;
  const p1 = await pdfJsDoc.getPage(1);
  const textContent = await p1.getTextContent();
  const allText = textContent.items.map(it => it.str).join(' ');
  assert.ok(allText.includes('KONTRAK-ASLI'), 'Text "KONTRAK-ASLI" must remain intact on Page 1');
}

/**
 * 1.a Node Test: PDFTools.Merge.merge([signed, normal])
 */
async function runNodeMergeSignedTest() {
  console.log('========================================================================');
  console.log('>>> [NODE TEST] PDFTools.Merge.merge with Signed PDF & Stamp Conversion');
  console.log('========================================================================\n');

  const signedBytes = await createSignedPdfFixture(PDFLib);
  const normalBytes = await createNormalPdfFixture(PDFLib);

  const file1 = {
    name: 'kontrak_signed.pdf',
    size: signedBytes.length,
    lastModified: 1000,
    buffer: signedBytes.buffer.slice(signedBytes.byteOffset, signedBytes.byteOffset + signedBytes.byteLength)
  };
  const file2 = {
    name: 'lampiran_normal.pdf',
    size: normalBytes.length,
    lastModified: 2000,
    buffer: normalBytes.buffer.slice(normalBytes.byteOffset, normalBytes.byteOffset + normalBytes.byteLength)
  };

  const mergeResult = await PDFTools.Merge.merge([file1, file2]);
  assert.ok(mergeResult && mergeResult.bytes, 'PDFTools.Merge.merge must return bytes');

  await assertMergedPdfSignedClean(mergeResult.bytes);
  console.log('  ✓ (a) Node merge output passed all signature removal and stamp conversion assertions.');
}

/**
 * 1.b Browser Test for a specific engine/context
 */
async function runBrowserMergeSignedForEngine(browser, baseUrl, signedPath, normalPath, engineName, contextOptions = {}) {
  console.log(`\n--- [BROWSER TEST] Signed PDF Merge on ${engineName} ---`);

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  const unexpectedDialogs = [];
  page.on('dialog', dialog => {
    unexpectedDialogs.push(dialog.message());
    dialog.dismiss();
  });

  const pageErrors = [];
  page.on('pageerror', err => {
    pageErrors.push(err.message || String(err));
  });

  try {
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Merge));

    // Upload signed fixture and normal PDF
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles([signedPath, normalPath]);

    // Wait for organizer area to appear
    await page.waitForSelector('#organizerArea', { state: 'visible', timeout: 15000 });
    console.log('  ✓ Files uploaded, organizer area displayed without any dialogs.');

    // Click Merge button
    const mergeBtn = page.locator('#mergeBtn');
    await mergeBtn.click();

    // Wait for result area to become active
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 20000 });
    console.log('  ✓ Merge completed, result area displayed.');

    // Assert zero dialogs or alert popups
    assert.strictEqual(unexpectedDialogs.length, 0, `Unexpected dialogs: ${unexpectedDialogs.join(', ')}`);
    assert.strictEqual(pageErrors.length, 0, `Unexpected page errors: ${pageErrors.join(', ')}`);

    // Retrieve merged bytes from page memory
    const base64Data = await page.evaluate(() => {
      const bytes = window._lastMergedData;
      if (!bytes) return null;
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    });

    assert.ok(base64Data, 'window._lastMergedData must exist in page memory');
    const mergedBuf = Buffer.from(base64Data, 'base64');
    const mergedBytes = new Uint8Array(mergedBuf);

    // Apply the same assertions (no /Widget /FT /Sig with ByteRange, has /Stamp with /AP, no /SigFlags, text intact)
    await assertMergedPdfSignedClean(mergedBytes);
    console.log('  ✓ Merged output verified clean of cryptographic locks with /Stamp intact.');

    // Render page 1 in browser: pixels in signature box area [50, 450, 250, 550] NOT blank white
    const pixelCheck = await page.evaluate(async (b64) => {
      const binary = atob(b64);
      const u8 = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) u8[i] = binary.charCodeAt(i);

      const pdf = await window.pdfjsLib.getDocument({ data: u8 }).promise;
      const p1 = await pdf.getPage(1);
      const viewport = p1.getViewport({ scale: 1.0 });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');

      await p1.render({ canvasContext: ctx, viewport: viewport }).promise;

      // In PDF coordinates: rect is [50, 450, 250, 550] on 595x842 page
      // In canvas coordinates: y = viewport.height - pdfY
      // Center of box: x = 150, y = viewport.height - 500
      const sampleX = 150;
      const sampleY = Math.round(viewport.height - 500);

      // Read 30x30 patch around center of signature box
      const imgData = ctx.getImageData(sampleX - 15, sampleY - 15, 30, 30);
      const data = imgData.data;

      let nonWhitePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        // Check if pixel is colored/non-white (white is 255, 255, 255)
        if (a > 0 && (r < 240 || g < 240 || b < 240)) {
          nonWhitePixels++;
        }
      }

      return {
        nonWhitePixels,
        totalSampled: data.length / 4,
        sampleColor: [data[0], data[1], data[2], data[3]]
      };
    }, base64Data);

    assert.ok(pixelCheck.nonWhitePixels > 0, `Signature box area must not be blank white (non-white count: ${pixelCheck.nonWhitePixels}/${pixelCheck.totalSampled})`);
    console.log(`  ✓ Rendered page 1: signature box area contains ${pixelCheck.nonWhitePixels}/${pixelCheck.totalSampled} non-white pixels (sample color: rgba(${pixelCheck.sampleColor.join(',')})).`);
    console.log(`  ✓ [PASS] Merge signed test passed on ${engineName}!`);
  } finally {
    await context.close();
  }
}

/**
 * Run browser tests on both Chromium Desktop and iPhone 13 WebKit
 */
async function runMergeSignedBrowserSuite(browser, baseUrl) {
  console.log('========================================================================');
  console.log('>>> [BROWSER SUITE] Signed PDF Merging (Chromium Desktop & iPhone 13 WebKit)');
  console.log('========================================================================');

  const tmp = getTempDir('merge_signed_' + Date.now());
  const tempDir = tmp.dir;

  const signedBytes = await createSignedPdfFixture(PDFLib);
  const normalBytes = await createNormalPdfFixture(PDFLib);

  const signedPath = path.join(tempDir, 'kontrak_signed.pdf');
  const normalPath = path.join(tempDir, 'lampiran_normal.pdf');
  fs.writeFileSync(signedPath, signedBytes);
  fs.writeFileSync(normalPath, normalBytes);

  let skippedWebKit = 0;

  try {
    // 1. Chromium Desktop
    await runBrowserMergeSignedForEngine(browser, baseUrl, signedPath, normalPath, 'Chromium Desktop');

    // 2. iPhone 13 WebKit
    const webkitBrowser = await launchWebKit();
    if (webkitBrowser) {
      try {
        await runBrowserMergeSignedForEngine(
          webkitBrowser,
          baseUrl,
          signedPath,
          normalPath,
          'iPhone 13 (WebKit)',
          { ...devices['iPhone 13'], hasTouch: true }
        );
      } finally {
        await webkitBrowser.close();
      }
    } else {
      console.warn('⚠️  [DILEWATI] iPhone 13 WebKit dilewati (WebKit tidak terpasang di lokal)');
      skippedWebKit = 1;
    }

    return { success: true, skippedWebKit };
  } finally {
    tmp.cleanup();
  }
}

/**
 * 4. MUTATION CHECK: Deliberately stub removeDigitalSignatures and prove test FAILS
 */
async function runMutationCheck() {
  console.log('\n========================================================================');
  console.log('>>> [MUTATION CHECK] Deliberately Stubbing removeDigitalSignatures (NO-OP)');
  console.log('========================================================================\n');

  const signedBytes = await createSignedPdfFixture(PDFLib);
  const normalBytes = await createNormalPdfFixture(PDFLib);

  const file1 = {
    name: 'kontrak_signed.pdf',
    size: signedBytes.length,
    lastModified: 1000,
    buffer: signedBytes.buffer.slice(signedBytes.byteOffset, signedBytes.byteOffset + signedBytes.byteLength)
  };
  const file2 = {
    name: 'lampiran_normal.pdf',
    size: normalBytes.length,
    lastModified: 2000,
    buffer: normalBytes.buffer.slice(normalBytes.byteOffset, normalBytes.byteOffset + normalBytes.byteLength)
  };

  const origRemove = PDFTools.Compress.removeDigitalSignatures;
  let mutationFailedAsExpected = false;
  let caughtError = null;

  try {
    // Stub removeDigitalSignatures to do nothing
    PDFTools.Compress.removeDigitalSignatures = async function () {
      return { removed: false, count: 0 };
    };

    console.log('  [Mutation Check] Running PDFTools.Merge.merge with disabled removeDigitalSignatures...');
    const result = await PDFTools.Merge.merge([file1, file2]);
    await assertMergedPdfSignedClean(result.bytes);
  } catch (err) {
    mutationFailedAsExpected = true;
    caughtError = err;
  } finally {
    PDFTools.Compress.removeDigitalSignatures = origRemove;
  }

  assert.ok(mutationFailedAsExpected, 'Mutation check failed: test should fail when removeDigitalSignatures is disabled!');
  console.log(`  ✓ Mutation detected and rejected as expected: ${caughtError ? caughtError.message : 'Unknown'}`);
  console.log('  ✓ Original removeDigitalSignatures restored and verified safe.\n');
}

// Standalone execution entry point
if (require.main === module) {
  (async () => {
    let server = null;
    let browser = null;
    try {
      // 1. Run Node Test
      await runNodeMergeSignedTest();

      // 2. Run Mutation Check
      await runMutationCheck();

      // 3. Start server and run Browser Tests
      server = await startTestServer(8770);
      browser = await launchChromium();
      const baseUrl = 'http://127.0.0.1:8770';

      await runMergeSignedBrowserSuite(browser, baseUrl);

      console.log('\n✅ [ALL PASSED] test_merge_signed.js completed successfully!');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [TEST FAILURE]:', err.message);
      if (err.stack) console.error(err.stack);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = {
  runNodeMergeSignedTest,
  runMutationCheck,
  runMergeSignedBrowserSuite,
  assertMergedPdfSignedClean
};

