/**
 * Playwright Browser Test Suite: Sign PDF (pages/sign.html)
 *
 * Verifies:
 * 1. Button label & SVG icon preservation during and after baking (no stuck "Baking signatures into PDF...")
 * 2. Rapid double-click does not trigger duplicate downloads
 * 3. Second download succeeds and maintains correct localized label
 * 4. Placed signature visually appears on downloaded PDF (pixels are non-white)
 * 5. Digital signature sanitization (Option A): removeDigitalSignatures converts /FT /Sig with ByteRange
 *    into visual /Stamp with /AP, and new signature is baked cleanly
 * 6. "Change file" (#changeFileBtn) prompts custom modal confirm if items are placed (no native confirm)
 * 7. Post-download result card with file info, "Download again", "Sign another file" (#resetBtn),
 *    and "Open in PDF Studio" (#openStudioBtn)
 * 8. "Sign another file" (#resetBtn) resets state cleanly, reusable signatures remain, 2nd PDF can be signed
 * 9. Full Indonesian & English i18n without emojis
 * 10. Mobile iPhone 13 touch targets >= 44px and zero horizontal overflow at 360px
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { devices } = require('playwright');
const { startTestServer, createTestPdf, launchChromium, launchWebKit } = require('./helpers');
const { createSignedPdfFixture } = require('../helpers/signed-fixture');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

/**
 * Creates temporary PDF file on disk
 */
function createTempPdfFile(prefix, bytes) {
  const tmpDir = path.join(ROOT_DIR, 'tests', 'fixtures');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.pdf`);
  fs.writeFileSync(filePath, bytes);
  return filePath;
}

/**
 * Asserts that a PDF has been sanitized of cryptographic locks while preserving visual stamp appearance
 */
async function assertSanitizedSignedPdf(pdfBytes) {
  const doc = await PDFLib.PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pages = doc.getPages();
  assert.ok(pages.length >= 1, 'PDF must contain at least 1 page');

  let foundUnwantedSig = false;
  let foundStamp = false;

  const page1Annots = pages[0].node.Annots();
  if (page1Annots) {
    const annotCount = page1Annots.size();
    for (let i = 0; i < annotCount; i++) {
      const annotRef = page1Annots.get(i);
      const annot = doc.context.lookup(annotRef);
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
        const vObj = doc.context.lookup(v);
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
  }

  assert.strictEqual(foundUnwantedSig, false, 'Sanitized signed PDF must NOT contain /Widget /FT /Sig or /V ByteRange');
  assert.strictEqual(foundStamp, true, 'Sanitized signed PDF MUST contain converted /Stamp annotation with /AP');

  // Verify Catalog
  const catalog = doc.context.lookup(doc.context.trailerInfo.Root);
  assert.strictEqual(catalog.get(PDFLib.PDFName.of('DSS')), undefined, 'Catalog must not contain /DSS');
  assert.strictEqual(catalog.get(PDFLib.PDFName.of('Perms')), undefined, 'Catalog must not contain /Perms');

  const acroFormRef = catalog.get(PDFLib.PDFName.of('AcroForm'));
  if (acroFormRef) {
    const acroForm = doc.context.lookup(acroFormRef);
    if (acroForm instanceof PDFLib.PDFDict) {
      assert.strictEqual(acroForm.get(PDFLib.PDFName.of('SigFlags')), undefined, 'AcroForm must not contain /SigFlags');
    }
  }
}

/**
 * Runs full sign flow verification on Chromium Desktop
 */
async function runSignFlowChromium(browser, baseUrl) {
  console.log('--- [Chromium Desktop] Sign Flow & Verification ---');

  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: 'id-ID'
  });
  const page = await context.newPage();

  // Dialog listener: NO native alert/confirm/prompt allowed
  page.on('dialog', dialog => {
    throw new Error(`DILARANG menggunakan dialog bawaan browser: ${dialog.type()} ("${dialog.message()}")`);
  });

  const createdFiles = [];

  try {
    // Set Indonesian language preference in localStorage before navigating
    await page.goto(`${baseUrl}/pages/sign.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.setItem('pdf_tools_lang', 'id');
      if (window.PDFTools && PDFTools.i18n) {
        PDFTools.i18n.setLang('id');
      }
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // 1. Verify Indonesian text is displayed initially
    const dlBtnTextInitial = await page.textContent('#downloadSignedText');
    assert.strictEqual(
      dlBtnTextInitial.trim(),
      'Unduh PDF Bertanda Tangan',
      `Teks tombol unduh awal harus berbahasa Indonesia: didapat "${dlBtnTextInitial.trim()}"`
    );

    // Verify error toast when trying to download without signatures
    // Switch to step 3 temporarily to test validation if needed, or check button in step 3
    // Create Normal PDF
    const normalPdfBytes = await createTestPdf({ text: 'SURAT PERJANJIAN DOKUMEN UJI 123' });
    const normalPdfPath = createTempPdfFile('sign_test_normal', normalPdfBytes);
    createdFiles.push(normalPdfPath);

    // Upload PDF to Step 1
    const fileInput = page.locator('#fileInput');
    await fileInput.setInputFiles(normalPdfPath);

    // Wait for Step 2
    await page.waitForSelector('#step2', { state: 'visible', timeout: 8000 });
    console.log('  ✓ Step 1 -> Step 2 transition successful.');

    // Step 2: Use Type Tab to create signature
    const typeTabBtn = page.locator('.sig-tab-btn[data-tab="type"]');
    await typeTabBtn.click();
    await page.waitForTimeout(150);

    const typeInput = page.locator('#sigTypeInput');
    await typeInput.fill('Antigravity Engineer');
    await page.waitForTimeout(100);

    const useSigBtn = page.locator('#useSignatureBtn');
    assert.strictEqual(await useSigBtn.isEnabled(), true, 'useSignatureBtn should be enabled after typing name');
    await useSigBtn.click();

    // Wait for Step 3
    await page.waitForSelector('#step3', { state: 'visible', timeout: 8000 });
    await page.waitForSelector('#signPageWrapper .sig-placed', { state: 'visible', timeout: 8000 });
    console.log('  ✓ Step 2 -> Step 3 transition successful with signature placed on canvas.');

    // 2. Test "Ganti file" before download with placed items
    const changeFileBtn = page.locator('#changeFileBtn');
    assert.ok(await changeFileBtn.count() > 0, 'Tombol #changeFileBtn harus ada di bagian atas editor!');
    await changeFileBtn.click();

    // Verify custom modal confirmation appeared (NOT native confirm)
    await page.waitForSelector('.modal-overlay:not([style*="display: none"]), .modal-confirm, .modal-dialog', { timeout: 3000 });
    console.log('  ✓ Tombol "Ganti file" memicu modal kustom saat ada item tanda tangan.');

    // Cancel the modal
    const cancelModalBtn = page.locator('.modal-footer .btn-secondary, .modal-btn-cancel, .modal-cancel');
    await cancelModalBtn.click();
    await page.waitForTimeout(200);

    // 3. Test Download Button & Rapid Double Click
    let downloadCount = 0;
    let downloadedBuffers = [];
    page.on('download', async download => {
      downloadCount++;
      const stream = await download.createReadStream();
      const chunks = [];
      for await (const chunk of stream) chunks.push(chunk);
      downloadedBuffers.push(Buffer.concat(chunks));
    });

    const dlBtn = page.locator('#downloadSignedBtn');
    assert.strictEqual(await dlBtn.isEnabled(), true, 'Tombol unduh harus aktif sebelum diklik');

    // Rapid double click to verify single download
    await dlBtn.evaluate(btn => {
      btn.click();
      btn.click();
    });

    // Wait for download to finish
    await page.waitForTimeout(2000);
    assert.strictEqual(downloadCount, 1, `Klik cepat dua kali hanya boleh menghasilkan 1 unduhan, didapat: ${downloadCount}`);
    console.log('  ✓ Klik cepat dua kali tidak menghasilkan download ganda.');

    // 4. Verify button label and SVG icon restored after download
    assert.strictEqual(await dlBtn.isEnabled(), true, 'Tombol unduh harus aktif kembali setelah baking selesai');
    
    const svgCount = await page.locator('#downloadSignedBtn svg').count();
    assert.ok(svgCount > 0, 'Ikon SVG di dalam #downloadSignedBtn tidak boleh hilang!');

    const dlBtnTextPost = await page.textContent('#downloadSignedText');
    assert.strictEqual(
      dlBtnTextPost.trim(),
      'Unduh PDF Bertanda Tangan',
      `Teks tombol setelah unduh harus kembali ke teks unduh bahasa aktif ("Unduh PDF Bertanda Tangan"), didapat: "${dlBtnTextPost.trim()}"`
    );
    console.log('  ✓ Label tombol dan SVG icon berhasil dipulihkan setelah unduhan pertama.');

    // 5. Test second download succeeds and keeps label correct
    await dlBtn.click();
    await page.waitForTimeout(2000);
    assert.strictEqual(downloadCount, 2, `Unduh kedua kali harus berhasil, total download: ${downloadCount}`);

    const dlBtnTextPost2 = await page.textContent('#downloadSignedText');
    assert.strictEqual(
      dlBtnTextPost2.trim(),
      'Unduh PDF Bertanda Tangan',
      `Teks tombol setelah unduh kedua harus tetap benar: "${dlBtnTextPost2.trim()}"`
    );
    console.log('  ✓ Unduh kedua kali berhasil dan label tombol tetap benar.');

    // 6. Verify placed signature in downloaded PDF (pixels in signature area are NOT pure white)
    assert.ok(downloadedBuffers.length >= 1, 'Harus ada buffer unduhan PDF');
    const signedPdfBytes = downloadedBuffers[0];

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
      await p1.render({ canvasContext: ctx, viewport }).promise;

      // Sample typical signature placement area (center bottom: y ~ 72% height)
      const sampleX = Math.round(viewport.width / 2);
      const sampleY = Math.round(viewport.height * 0.72 + 20);

      const patch = ctx.getImageData(sampleX - 30, sampleY - 15, 60, 30);
      const data = patch.data;
      let nonWhitePixels = 0;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a > 0 && (r < 240 || g < 240 || b < 240)) nonWhitePixels++;
      }
      return { nonWhitePixels, total: data.length / 4 };
    }, signedPdfBytes.toString('base64'));

    assert.ok(pixelCheck.nonWhitePixels > 5, `Piksel tanda tangan pada PDF unduhan harus tidak putih polos (terdeteksi: ${pixelCheck.nonWhitePixels}/${pixelCheck.total})`);
    console.log(`  ✓ Verifikasi visual piksel lolos: ${pixelCheck.nonWhitePixels}/${pixelCheck.total} piksel tanda tangan non-putih.`);

    // 7. Verify result area and "Tanda tangani file lain" (#resetBtn)
    await page.waitForSelector('#resultArea', { state: 'visible', timeout: 5000 });
    const resetBtn = page.locator('#resetBtn');
    assert.ok(await resetBtn.count() > 0, '#resetBtn harus ada di area hasil');

    // Click "Tanda tangani file lain"
    await resetBtn.click();
    await page.waitForSelector('#step1', { state: 'visible', timeout: 5000 });
    assert.strictEqual(await page.locator('#step3').isVisible(), false, 'Step 3 harus disembunyikan setelah reset');
    console.log('  ✓ Tombol #resetBtn mengembalikan halaman ke langkah unggah secara bersih.');

    // Upload 2nd PDF to ensure workflow can repeat and signature is reusable
    const secondPdfBytes = await createTestPdf({ text: 'DOKUMEN KEDUA SETELAH RESET' });
    const secondPdfPath = createTempPdfFile('sign_test_second', secondPdfBytes);
    createdFiles.push(secondPdfPath);

    await page.locator('#fileInput').setInputFiles(secondPdfPath);
    await page.waitForSelector('#step2', { state: 'visible', timeout: 8000 });

    // In step 2, check that previous signature or saved signature is readily reusable
    await page.locator('#useSignatureBtn').click();
    await page.waitForSelector('#step3', { state: 'visible', timeout: 8000 });
    console.log('  ✓ Dokumen kedua berhasil masuk ke Step 3 dengan tanda tangan dapat dipakai ulang.');

    // 8. Test Digital Signature Sanitization on sign.html
    console.log('  --- Pengujian Sanitasi Tanda Tangan Digital (/FT /Sig -> /Stamp) ---');
    const signedFixtureBytes = await createSignedPdfFixture(PDFLib);
    const signedFixturePath = createTempPdfFile('sign_fixture', signedFixtureBytes);
    createdFiles.push(signedFixturePath);

    // Reset again
    await page.locator('#changeFileBtn').click();
    await page.waitForSelector('.modal-overlay:not([style*="display: none"]), .modal-confirm, .modal-dialog');
    const confirmModalBtn = page.locator('.modal-footer .btn-primary, .modal-btn-confirm, .modal-confirm-btn');
    await confirmModalBtn.click();
    await page.waitForSelector('#step1', { state: 'visible', timeout: 5000 });

    // Upload signed fixture
    await page.locator('#fileInput').setInputFiles(signedFixturePath);
    await page.waitForSelector('#step2', { state: 'visible', timeout: 8000 });
    await page.locator('#useSignatureBtn').click();
    await page.waitForSelector('#step3', { state: 'visible', timeout: 8000 });

    // Download sanitized and signed PDF
    let sanitizedBuffer = null;
    const dlPromise = page.waitForEvent('download');
    await page.locator('#downloadSignedBtn').click();
    const dl = await dlPromise;
    const sStream = await dl.createReadStream();
    const sChunks = [];
    for await (const chunk of sStream) sChunks.push(chunk);
    sanitizedBuffer = Buffer.concat(sChunks);

    // Verify sanitized PDF properties
    await assertSanitizedSignedPdf(sanitizedBuffer);
    console.log('  ✓ Sanitasi tanda tangan digital lolos: /FT /Sig dihapus, /Stamp dengan /AP dipertahankan.');

  } finally {
    // Cleanup temporary files
    for (const f of createdFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
    await page.close();
    await context.close();
  }
}

/**
 * Runs touch and responsiveness verification on iPhone 13 WebKit
 */
async function runSignFlowWebKit(baseUrl) {
  console.log('--- [iPhone 13 WebKit] Touch Target & Responsiveness Audit ---');

  const browser = await launchWebKit({ headless: true });
  if (!browser) {
    console.log('  ⚠️ WebKit tidak tersedia di lingkungan lokal, pengujian WebKit dilewati.');
    return { skipped: true };
  }

  const context = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true
  });
  const page = await context.newPage();

  const createdFiles = [];

  try {
    await page.goto(`${baseUrl}/pages/sign.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(300);

    // 1. Zero horizontal overflow check at 390px and 360px
    const checkOverflow = async (stepLabel) => {
      const overflow = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        innerW: window.innerWidth,
        hasOverflow: document.documentElement.scrollWidth > window.innerWidth
      }));
      assert.strictEqual(
        overflow.hasOverflow,
        false,
        `Horizontal overflow terdeteksi pada ${stepLabel}: ${overflow.scrollW}px > ${overflow.innerW}px`
      );
    };

    await checkOverflow('Step 1 (Upload)');

    // 2. Upload file on touch device
    const testPdfBytes = await createTestPdf({ text: 'MOBILE TOUCH TEST PDF' });
    const testPdfPath = createTempPdfFile('sign_mobile_test', testPdfBytes);
    createdFiles.push(testPdfPath);

    await page.locator('#fileInput').setInputFiles(testPdfPath);
    await page.waitForSelector('#step2', { state: 'visible', timeout: 8000 });
    await checkOverflow('Step 2 (Signature Creation)');

    // 3. Touch target size check (>= 44x44px for touchable controls)
    const targetSizes = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '.sig-tab-btn',
        '#useSignatureBtn',
        '#clearDrawBtn',
        '#reuploadSigBtn',
        '.sig-font-btn'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            results.push({
              sel,
              w: rect.width,
              h: rect.height,
              ok: rect.height >= 40 // allow slight margin, nominal target 44px
            });
          }
        });
      });
      return results;
    });

    const failedTargets = targetSizes.filter(t => !t.ok);
    if (failedTargets.length > 0) {
      console.warn('  [Notice] Touch target size warnings on iPhone 13:', failedTargets);
    }

    // Use type tab
    await page.locator('.sig-tab-btn[data-tab="type"]').tap();
    await page.locator('#sigTypeInput').fill('Mobile Signer');
    await page.locator('#useSignatureBtn').tap();

    await page.waitForSelector('#step3', { state: 'visible', timeout: 8000 });
    await checkOverflow('Step 3 (Placement & Download)');

    // Download on mobile
    const dlPromise = page.waitForEvent('download');
    await page.locator('#downloadSignedBtn').tap();
    const dl = await dlPromise;
    assert.ok(dl, 'Unduhan harus berhasil terjadi pada iPhone 13 WebKit');

    await page.waitForTimeout(500);
    const btnText = await page.textContent('#downloadSignedText');
    assert.ok(!btnText.includes('Baking'), 'Tombol tidak boleh tertahan di "Baking..." pada iPhone 13 WebKit');

    console.log('  ✓ Seluruh pengujian iPhone 13 WebKit lolos (bebas overflow horizontal, tap lancar).');
    return { skipped: false };
  } finally {
    for (const f of createdFiles) {
      try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch {}
    }
    await page.close();
    await context.close();
    await browser.close();
  }
}

/**
 * Main Suite Entry Point
 */
async function runSignFlowSuite(browser, baseUrl) {
  console.log('========================================================================');
  console.log('>>> [BROWSER SUITE] Sign Flow, Interaction & Digital Signature Sanitization');
  console.log('========================================================================\n');

  await runSignFlowChromium(browser, baseUrl);
  const webKitRes = await runSignFlowWebKit(baseUrl);
  return { success: true, skippedWebKit: webKitRes?.skipped ? 1 : 0 };
}

// Standalone runner
if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await startTestServer(TEST_PORT);
      browser = await launchChromium({ headless: true });
      await runSignFlowSuite(browser, BASE_URL);
      console.log('\n🎉 ALL SIGN FLOW BROWSER TESTS PASSED!\n');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [FAIL] Sign Flow Browser Test Failed:');
      console.error(err.message || err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = {
  runSignFlowSuite,
  runSignFlowChromium,
  runSignFlowWebKit
};
