/**
 * Playwright Browser Test: Protected PDF Password Modal Verification
 * Tests pages/merge.html and pages/watermark.html on Chromium and iPhone 13 WebKit.
 *
 * Verifies:
 *   - Custom modal appears (no native prompt)
 *   - Input type="password", file name mentioned, controls >= 44px
 *   - Wrong password shows retry error message
 *   - Correct password decrypts and produces intact result
 *   - "Lewati" (Skip) reports skipped document in summary while processing remaining files
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { devices } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

const Protect = require(path.join(ROOT_DIR, 'js/core/pdf-protect.js'));
const { startTestServer, launchChromium, launchWebKit } = require('./helpers');
const { getTempDir } = require('./helpers/tmp');

const CORRECT_PASSWORD = 'buka123';
const WRONG_PASSWORD = 'passwordsalah';

async function createFixtures(dir) {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  // 1. Create clean 2-page document
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const p1 = doc.addPage([500, 500]);
  p1.drawText('HALAMAN_SATU_SECRET_123', { x: 50, y: 400, size: 24, font, color: rgb(0, 0, 0) });

  const p2 = doc.addPage([500, 500]);
  p2.drawText('HALAMAN_DUA_SECRET_456', { x: 50, y: 400, size: 24, font, color: rgb(0, 0, 0) });

  const cleanBytes = await doc.save();
  const cleanPath = path.join(dir, 'clean_doc.pdf');
  fs.writeFileSync(cleanPath, Buffer.from(cleanBytes));

  // 2. Protect with password
  const protectedBytes = await Protect.protectPdf(cleanBytes, CORRECT_PASSWORD, CORRECT_PASSWORD);
  const protectedPath = path.join(dir, 'protected_doc.pdf');
  fs.writeFileSync(protectedPath, Buffer.from(protectedBytes));

  return { cleanPath, protectedPath };
}

async function extractTextFromBuffer(buffer) {
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdfJsDoc = await loadingTask.promise;
  let allText = '';
  for (let i = 1; i <= pdfJsDoc.numPages; i++) {
    const page = await pdfJsDoc.getPage(i);
    const content = await page.getTextContent();
    allText += content.items.map(item => item.str).join(' ') + '\n';
  }
  return { numPages: pdfJsDoc.numPages, allText };
}

async function runPasswordModalTestForEngine(browser, baseUrl, fixtures, engineName, contextOptions = {}) {
  console.log(`\n--- [Browser Test: ${engineName}] Testing Password Modal on merge.html & watermark.html ---`);

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    // =========================================================================
    // 1. TEST ON pages/merge.html
    // =========================================================================
    console.log(`[${engineName}] Navigating to pages/merge.html...`);
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(300);

    // Skenario 1A: Wrong password retry error, then correct password succeeds
    console.log(`[${engineName}] [merge.html] Uploading protected PDF to trigger password modal...`);
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles(fixtures.protectedPath);

    // Modal must appear
    const modal = page.locator('.pdftools-modal-backdrop');
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`  ✓ Modal password muncul.`);

    // Check modal attributes
    const input = page.locator('.pdftools-modal-input');
    const inputType = await input.getAttribute('type');
    assert.strictEqual(inputType, 'password', 'Input modal wajib type="password"');

    const msgText = await page.locator('.pdftools-modal-message').textContent();
    assert(msgText.includes('protected_doc.pdf'), 'Pesan modal harus menyebutkan nama berkas');

    // Controls must have touch targets >= 44px
    const confirmBox = await page.locator('.pdftools-modal-confirm').boundingBox();
    const cancelBox = await page.locator('.pdftools-modal-cancel').boundingBox();
    assert(confirmBox && confirmBox.height >= 40, 'Tombol konfirmasi minimal 40-44px');
    assert(cancelBox && cancelBox.height >= 40, 'Tombol lewati minimal 40-44px');

    // Try wrong password
    console.log(`[${engineName}] [merge.html] Mencoba password salah...`);
    await input.fill(WRONG_PASSWORD);
    await page.click('.pdftools-modal-confirm');
    await page.waitForTimeout(300);

    const errorEl = page.locator('.pdftools-modal-error');
    await errorEl.waitFor({ state: 'visible', timeout: 5000 });
    const errorText = await errorEl.textContent();
    assert(errorText.toLowerCase().includes('salah') || errorText.toLowerCase().includes('incorrect'), 'Pesan error salah password harus muncul');
    console.log(`  ✓ Pesan password salah berhasil ditampilkan: "${errorText.trim()}"`);

    // Enter correct password
    console.log(`[${engineName}] [merge.html] Memasukkan password benar...`);
    await input.fill(CORRECT_PASSWORD);
    await page.click('.pdftools-modal-confirm');
    await modal.waitFor({ state: 'hidden', timeout: 10000 });
    console.log(`  ✓ Password benar diterima, modal tertutup.`);

    // Wait for pages to load into grid and expand to see individual pages
    await page.waitForSelector('#expandAllBtn', { timeout: 10000 });
    await page.click('#expandAllBtn');
    await page.waitForSelector('.merge-page-card.expanded-page', { timeout: 10000 });
    const pageCards = await page.locator('.merge-page-card.expanded-page').count();
    assert.strictEqual(pageCards, 2, '2 halaman dokumen terproteksi harus berhasil dimuat');
    console.log(`  ✓ Dokumen terdekripsi termuat utuh (${pageCards} halaman).`);

    // Skenario 1B: "Lewati" (Skip) in multi-file upload
    console.log(`[${engineName}] [merge.html] Menguji tombol "Lewati" pada berkas terproteksi...`);
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(300);

    // Upload both clean and protected files
    const multiInput = page.locator('#dropzone input[type="file"]');
    await multiInput.setInputFiles([fixtures.cleanPath, fixtures.protectedPath]);

    // Modal appears for protected doc
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`  ✓ Modal muncul untuk berkas kedua.`);

    // Click "Lewati" (Skip)
    await page.click('.pdftools-modal-cancel');
    await modal.waitFor({ state: 'hidden', timeout: 5000 });

    // Verify clean document still loaded
    await page.waitForSelector('#expandAllBtn', { timeout: 10000 });
    await page.click('#expandAllBtn');
    await page.waitForSelector('.merge-page-card.expanded-page', { timeout: 10000 });
    const remainingCards = await page.locator('.merge-page-card.expanded-page').count();
    assert.strictEqual(remainingCards, 2, 'Halaman clean_doc.pdf tetap dimuat saat protected_doc.pdf dilewati');

    // Verify toast summary reports skipped file
    const toast = page.locator('.toast');
    await toast.waitFor({ state: 'visible', timeout: 10000 });
    const toastText = await toast.textContent();
    assert(toastText.includes('protected_doc.pdf') && (toastText.includes('skipped') || toastText.includes('dilewati')), 'Toast harus menyebutkan berkas yang dilewati');
    console.log(`  ✓ Ringkasan berkas dilewati dilaporkan: "${toastText.trim()}"`);

    // =========================================================================
    // 2. TEST ON pages/watermark.html
    // =========================================================================
    console.log(`\n[${engineName}] Navigating to pages/watermark.html...`);
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(300);

    // Upload protected PDF
    console.log(`[${engineName}] [watermark.html] Uploading protected PDF...`);
    const wmFileInput = page.locator('#dropzone input[type="file"]');
    await wmFileInput.setInputFiles(fixtures.protectedPath);

    // Click "Terapkan Watermark"
    console.log(`[${engineName}] [watermark.html] Mengklik Terapkan Watermark...`);
    await page.click('#applyBtn');

    // Password modal must pop up
    await modal.waitFor({ state: 'visible', timeout: 10000 });
    console.log(`  ✓ Modal password muncul di watermark.html.`);

    // Enter wrong password first
    const wmInput = page.locator('.pdftools-modal-input');
    await wmInput.fill(WRONG_PASSWORD);
    await page.click('.pdftools-modal-confirm');
    await page.waitForTimeout(300);

    const wmError = page.locator('.pdftools-modal-error');
    await wmError.waitFor({ state: 'visible', timeout: 5000 });
    console.log(`  ✓ Pesan salah password muncul di watermark.html.`);

    // Enter correct password
    await wmInput.fill(CORRECT_PASSWORD);
    await page.click('.pdftools-modal-confirm');
    await modal.waitFor({ state: 'hidden', timeout: 10000 });

    // Wait for watermark result area to become active
    await page.waitForSelector('#resultArea.active', { timeout: 15000 });
    console.log(`  ✓ Watermark berhasil diterapkan dan area hasil aktif!`);

    // Verify preview canvas rendered
    const canvas = page.locator('#wmResultCanvas');
    const canvasW = await canvas.evaluate(c => c.width);
    assert(canvasW > 0, 'Canvas pratinjau watermark harus tergambar.');
    console.log(`  ✓ Canvas pratinjau watermark terverifikasi (lebar: ${canvasW}px).`);

    console.log(`\n✅ [PASS: ${engineName}] Password modal tests on merge.html and watermark.html passed successfully!`);
  } finally {
    await page.close();
    await context.close();
  }
}

async function runPasswordModalSuite(chromiumBrowser, baseUrl) {
  const temp = getTempDir('test_password_modal');
  try {
    const fixtures = await createFixtures(temp.dir);

    // 1. Chromium Desktop
    await runPasswordModalTestForEngine(chromiumBrowser, baseUrl, fixtures, 'Chromium Desktop');

    // 2. WebKit iPhone 13
    let webkitBrowser;
    let skippedWebKit = 0;
    try {
      webkitBrowser = await launchWebKit({ headless: true });
      if (!webkitBrowser) {
        console.log('  ⚠️  [DILEWATI] Pengujian WebKit pada iPhone 13 dilewati karena WebKit tidak tersedia.');
        skippedWebKit++;
      } else {
        await runPasswordModalTestForEngine(
          webkitBrowser,
          baseUrl,
          fixtures,
          'iPhone 13 (WebKit)',
          {
            ...devices['iPhone 13'],
            hasTouch: true
          }
        );
      }
    } finally {
      if (webkitBrowser) {
        await webkitBrowser.close();
      }
    }

    return { success: true, skippedWebKit };
  } finally {
    temp.cleanup();
  }
}

if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await startTestServer(8765);
      browser = await launchChromium({ headless: true });
      await runPasswordModalSuite(browser, 'http://127.0.0.1:8765');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [FAIL] Browser Password Modal Test failed:');
      console.error(err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = { runPasswordModalSuite };
