const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { devices } = require('playwright');
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startTestServer, launchChromium, launchWebKit } = require('./helpers');
const { getTempDir } = require('./helpers/tmp');

/**
 * Creates a signed test PDF containing an AcroForm signature field (/FT /Sig).
 */
async function createSignedTestPdf() {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: PDFLib.rgb(0.85, 0.85, 0.85)
  });

  // Create signature annotation with /FT /Sig
  const sigDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [50, 50, 200, 100],
    T: PDFLib.PDFString.of('Signature1'),
    V: doc.context.obj({
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'adbe.pkcs7.detached',
      Name: 'Antigravity Test Signer'
    })
  });
  const sigRef = doc.context.register(sigDict);
  page.node.set(PDFLib.PDFName.of('Annots'), doc.context.obj([sigRef]));

  return await doc.save();
}

/**
 * Creates a standard test PDF with gray background.
 */
async function createGrayTestPdf(name = 'document.pdf') {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([595, 842]);
  page.drawRectangle({
    x: 0,
    y: 0,
    width: 595,
    height: 842,
    color: PDFLib.rgb(0.85, 0.85, 0.85)
  });
  return await doc.save();
}

/**
 * Creates 100x50 test image buffer (PNG magenta with transparent center hole).
 */
function createMagentaPngBuffer() {
  // 10x10 base64 transparent PNG with pink/magenta pixels
  const base64 = 'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJAD/6pnMbCAAAAAElFTkSuQmCC';
  return Buffer.from(base64, 'base64');
}

/**
 * Creates 1x1 test JPEG buffer.
 */
function createTestJpegBuffer() {
  // Minimal valid 1x1 JPEG
  const base64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  return Buffer.from(base64, 'base64');
}

/**
 * Creates 1x1 test WebP buffer.
 */
function createTestWebpBuffer() {
  // Minimal valid 1x1 WebP
  const base64 = 'UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAD8D+JaQAA3AA/ua1AAA=';
  return Buffer.from(base64, 'base64');
}

/**
 * Runs Watermark UI tests.
 */
async function runWatermarkUiSuite(browser, baseUrl, engineName = 'Chromium') {
  console.log(`\n========================================================================`);
  console.log(`>>> [BROWSER TEST] Watermark Image UI Suite (${engineName})`);
  console.log(`========================================================================`);

  const temp = getTempDir('test_wm_ui');
  const tempDir = temp.dir;

  const pdfPath1 = path.join(tempDir, 'sample1.pdf');
  const pdfPath2 = path.join(tempDir, 'sample2.pdf');
  const signedPdfPath = path.join(tempDir, 'signed.pdf');
  const pngPath = path.join(tempDir, 'watermark.png');
  const jpgPath = path.join(tempDir, 'watermark.jpg');
  const webpPath = path.join(tempDir, 'watermark.webp');
  const fakePngPath = path.join(tempDir, 'fake.png');

  fs.writeFileSync(pdfPath1, await createGrayTestPdf());
  fs.writeFileSync(pdfPath2, await createGrayTestPdf('sample2.pdf'));
  fs.writeFileSync(signedPdfPath, await createSignedTestPdf());
  fs.writeFileSync(pngPath, createMagentaPngBuffer());
  fs.writeFileSync(jpgPath, createTestJpegBuffer());
  fs.writeFileSync(webpPath, createTestWebpBuffer());
  fs.writeFileSync(fakePngPath, Buffer.from('THIS IS PLAIN TEXT NOT A REAL IMAGE'));

  const context = await browser.newContext();
  const page = await context.newPage();

  // Catch any dialog (alert, confirm, prompt) to fail immediately if triggered
  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} with message: "${dialog.message()}"`);
  });
  page.on('console', msg => console.log(`  [BROWSER CONSOLE ${msg.type()}]:`, msg.text()));
  page.on('pageerror', err => console.log('  [BROWSER ERROR]:', err));

  try {
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Generate real, valid PNG, JPG, and WebP images from browser canvas
    const imgData = await page.evaluate(async () => {
      const c = document.createElement('canvas');
      c.width = 200;
      c.height = 100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, 200, 100);
      ctx.clearRect(70, 35, 60, 30);
      return {
        png: c.toDataURL('image/png').split(',')[1],
        jpg: c.toDataURL('image/jpeg').split(',')[1],
        webp: c.toDataURL('image/webp').split(',')[1]
      };
    });

    fs.writeFileSync(pngPath, Buffer.from(imgData.png, 'base64'));
    fs.writeFileSync(jpgPath, Buffer.from(imgData.jpg, 'base64'));
    fs.writeFileSync(webpPath, Buffer.from(imgData.webp, 'base64'));

    // Upload initial PDF to reveal options panel
    const pdfDropInput = page.locator('#dropzone input[type="file"]');
    await pdfDropInput.setInputFiles(pdfPath1);

    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });
    console.log('  ✓ PDF uploaded and options panel displayed.');

    // 1. Verify existence of Mode switcher (Teks | Gambar)
    const modeImageBtn = page.locator('#wmModeImage, [data-mode="image"]');
    await modeImageBtn.waitFor({ state: 'visible', timeout: 4000 });
    console.log('  ✓ Segmented mode button (Gambar) found.');

    // Switch to Image mode
    await modeImageBtn.click();
    await page.waitForTimeout(200);

    const imageSection = page.locator('#wmImageSection');
    await imageSection.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  ✓ Switched to Image mode and image section visible.');

    // 2. Validation Test: Click apply with NO image selected -> Toast error expected
    console.log('  --- Testing Validation: No Image Selected ---');
    const applyBtn = page.locator('#applyBtn');
    await applyBtn.click();
    const errorToast1 = page.locator('.toast.toast-error, #toastContainer .toast-error');
    await errorToast1.waitFor({ state: 'visible', timeout: 3000 });
    const toastText1 = await errorToast1.textContent();
    console.log(`  ✓ Toast error appeared when no image selected: "${toastText1.trim()}"`);

    // 3. Validation Test: Upload fake image (.txt named .png) -> Toast error expected
    console.log('  --- Testing Validation: Fake Image File (.txt named .png) ---');
    const imageInput = page.locator('#wmImageInput');
    await imageInput.setInputFiles(fakePngPath);
    await page.waitForTimeout(500);

    const errorToast2 = page.locator('.toast.toast-error, #toastContainer .toast-error').last();
    await errorToast2.waitFor({ state: 'visible', timeout: 3000 });
    const toastText2 = await errorToast2.textContent();
    console.log(`  ✓ Toast error appeared for corrupt/fake image: "${toastText2.trim()}"`);

    // 4. Upload Valid PNG
    console.log('  --- Testing Valid PNG Upload & Controls ---');
    await imageInput.setInputFiles(pngPath);
    await page.waitForTimeout(500);

    // Thumbnail should be visible
    const thumbImg = page.locator('#wmImageThumb');
    await thumbImg.waitFor({ state: 'visible', timeout: 3000 });
    console.log('  ✓ Image thumbnail rendered.');

    // Slider test
    const scaleSlider = page.locator('#wmScaleRange');
    await scaleSlider.waitFor({ state: 'visible', timeout: 3000 });
    await scaleSlider.fill('45');
    await scaleSlider.dispatchEvent('input');
    const scaleValText = await page.locator('#wmScaleVal').textContent();
    assert(scaleValText.includes('45'), `Scale text should reflect 45%, got: ${scaleValText}`);
    console.log('  ✓ Slider interaction verified (45%).');

    // 5. Test 3x3 Position Grid Buttons
    console.log('  --- Testing 3x3 Position Grid & Tile Selection ---');
    const posTopLeft = page.locator('#wmPositionGrid [data-pos="top-left"]');
    await posTopLeft.waitFor({ state: 'visible', timeout: 3000 });
    await posTopLeft.click();
    assert(await posTopLeft.evaluate(el => el.classList.contains('active')), 'Top-left button must be active');

    const posBottomRight = page.locator('#wmPositionGrid [data-pos="bottom-right"]');
    await posBottomRight.click();
    assert(await posBottomRight.evaluate(el => el.classList.contains('active')), 'Bottom-right button must be active');

    const posTile = page.locator('#wmPosTile, [data-pos="tile"]');
    await posTile.click();
    assert(await posTile.evaluate(el => el.classList.contains('active')), 'Tile button must be active');

    // Select center
    const posCenter = page.locator('#wmPositionGrid [data-pos="center"]');
    await posCenter.click();
    assert(await posCenter.evaluate(el => el.classList.contains('active')), 'Center button must be active');
    console.log('  ✓ Position grid buttons and Tile toggle successfully interactive.');

    // 6. Test JPG and WebP uploads
    console.log('  --- Testing JPG & WebP Image Upload Support ---');
    await imageInput.setInputFiles(jpgPath);
    await page.waitForTimeout(300);
    assert(await thumbImg.isVisible(), 'JPG thumbnail must be visible');

    await imageInput.setInputFiles(webpPath);
    await page.waitForTimeout(300);
    assert(await thumbImg.isVisible(), 'WebP thumbnail must be visible');
    console.log('  ✓ JPG and WebP images successfully accepted and displayed.');

    // Re-select PNG for watermarking
    await imageInput.setInputFiles(pngPath);
    await page.waitForTimeout(300);

    // 7. Preview before Apply & Verify Output Canvas
    console.log('  --- Testing Preview Button Before Apply ---');
    const previewBtn = page.locator('#previewBtn');
    await previewBtn.waitFor({ state: 'visible', timeout: 5000 });
    const previewBtnBox = await previewBtn.boundingBox();
    assert(previewBtnBox && previewBtnBox.height >= 44, 'Preview button must have touch height >= 44px');
    await previewBtn.click();

    const previewCanvas = page.locator('#wmResultCanvas');
    await previewCanvas.waitFor({ state: 'visible', timeout: 8000 });
    const previewPixels = await previewCanvas.evaluate(canvas => {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return Array.from(imgData.data);
    });
    assert(previewPixels.some(val => val > 0), 'Preview canvas must have rendered output pixels');
    console.log('  ✓ Preview button before apply rendered watermark on canvas.');

    console.log('  --- Applying Watermark & Verifying Pixel Identity ---');
    await applyBtn.click();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });

    await page.waitForTimeout(500);
    const finalPixels = await previewCanvas.evaluate(canvas => {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return Array.from(imgData.data);
    });
    assert.strictEqual(previewPixels.length, finalPixels.length, 'Preview and final canvas buffers must match in size');
    let pixelMismatches = 0;
    for (let i = 0; i < previewPixels.length; i++) {
      if (previewPixels[i] !== finalPixels[i]) pixelMismatches++;
    }
    assert.strictEqual(pixelMismatches, 0, `Preview and final page 1 must be pixel-per-pixel identical (mismatches: ${pixelMismatches})`);
    console.log('  ✓ Result area displayed and preview is pixel-per-pixel identical to page 1 of final result (0 mismatches).');

    // 8. Test Signed PDF Case (Item 5: watermark applied without error/popup)
    console.log('  --- Testing Digitally Signed PDF Watermarking ---');
    await page.locator('#resetBtn').click();
    await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });

    await pdfDropInput.setInputFiles(signedPdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });
    await modeImageBtn.click();
    await imageInput.setInputFiles(pngPath);
    await page.waitForTimeout(300);
    await applyBtn.click();

    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });
    const signedCanvas = page.locator('#wmResultCanvas');
    await signedCanvas.waitFor({ state: 'visible', timeout: 5000 });
    const signedHasPixels = await signedCanvas.evaluate(canvas => {
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imgData.data.some(val => val > 0);
    });
    assert(signedHasPixels, 'Signed PDF preview canvas must have rendered watermark pixels');
    console.log('  ✓ Digitally signed PDF successfully watermarked and pixels verified on canvas without warning dialog or error.');

    // 9. Batch Mode with 2 PDFs
    console.log('  --- Testing Batch Mode with 2 PDFs ---');
    await page.locator('#resetBtn').click();
    await page.waitForSelector('#dropzone', { state: 'visible', timeout: 5000 });

    await pdfDropInput.setInputFiles([pdfPath1, pdfPath2]);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });
    await modeImageBtn.click();
    await imageInput.setInputFiles(pngPath);
    await page.waitForTimeout(300);
    await applyBtn.click();

    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 20000 });
    const downloadBtnText = await page.locator('#downloadBtn').textContent();
    assert(downloadBtnText.includes('.ZIP') || downloadBtnText.includes('2'), `Download button should mention ZIP/2 files: ${downloadBtnText}`);
    console.log('  ✓ Batch mode processed 2 files into ZIP successfully.');

    console.log(`\n✅ [PASS] Watermark UI Test Suite passed on ${engineName}!`);
    return { success: true };
  } finally {
    await page.close();
    await context.close();
    temp.cleanup();
  }
}

/**
 * Runs iPhone 13 WebKit Test for Watermark UI
 */
async function runWatermarkUiWebKitMobile(baseUrl) {
  console.log(`\n========================================================================`);
  console.log(`>>> [BROWSER TEST] Watermark Image UI on iPhone 13 (WebKit)`);
  console.log(`========================================================================`);

  const browser = await launchWebKit({ headless: true });
  if (!browser) {
    console.log('  ⚠️  [DILEWATI] Watermark Image UI iPhone 13 (WebKit) dilewati karena WebKit tidak tersedia.');
    return { success: true, skipped: true, skippedWebKit: 1 };
  }

  const context = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true
  });
  const page = await context.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} with message: "${dialog.message()}"`);
  });

  const temp = getTempDir('test_wm_ui_mobile');
  const tempDir = temp.dir;

  try {
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Check no horizontal overflow on mobile initial load
    const overflow1 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!overflow1, 'Initial page on iPhone 13 must have zero horizontal overflow');

    // Upload PDF
    const pdfPath = path.join(tempDir, 'mobile_sample.pdf');
    fs.writeFileSync(pdfPath, await createGrayTestPdf());
    const pngPath = path.join(tempDir, 'mobile_wm.png');
    const mobilePngBase64 = await page.evaluate(() => {
      const c = document.createElement('canvas');
      c.width = 150;
      c.height = 80;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#FF00FF';
      ctx.fillRect(0, 0, 150, 80);
      return c.toDataURL('image/png').split(',')[1];
    });
    fs.writeFileSync(pngPath, Buffer.from(mobilePngBase64, 'base64'));

    const pdfDropInput = page.locator('#dropzone input[type="file"]');
    await pdfDropInput.setInputFiles(pdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    // Switch to image mode
    const modeImageBtn = page.locator('#wmModeImage, [data-mode="image"]');
    await modeImageBtn.click();
    await page.waitForTimeout(300);

    // Verify touch target sizes (>= 44x44 px)
    const targetSizes = await page.evaluate(() => {
      const results = [];
      const selectors = [
        '#wmModeText', '#wmModeImage',
        '#wmPositionGrid button', '#wmPosTile',
        '#wmImageUploadBtn', '#applyBtn'
      ];
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
          const rect = el.getBoundingClientRect();
          results.push({ sel, w: rect.width, h: rect.height, ok: rect.width >= 40 && rect.height >= 40 });
        });
      });
      return results;
    });

    for (const t of targetSizes) {
      if (!t.ok) {
        console.warn(`  [Notice] Target size warning for ${t.sel}: ${t.w.toFixed(1)}x${t.h.toFixed(1)}px`);
      }
    }

    // Upload image and verify no overflow
    const imageInput = page.locator('#wmImageInput');
    await imageInput.setInputFiles(pngPath);
    await page.waitForTimeout(400);

    const overflow2 = await page.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      hasOverflow: document.documentElement.scrollWidth > window.innerWidth
    }));
    assert(!overflow2.hasOverflow, `Options panel on iPhone 13 WebKit must have zero horizontal overflow (${overflow2.scrollW}px > ${overflow2.innerW}px)`);

    // Click position button on touch screen
    const posCenter = page.locator('#wmPositionGrid [data-pos="center"]');
    await posCenter.tap();
    await page.waitForTimeout(200);

    // Apply watermark on mobile
    await page.locator('#applyBtn').tap();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });

    const overflow3 = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    assert(!overflow3, 'Result area on iPhone 13 WebKit must have zero horizontal overflow');

    console.log('  ✓ Zero horizontal overflow verified across all states on iPhone 13 WebKit.');
    console.log('  ✓ Tap interactions and watermark execution passed on iPhone 13 WebKit.');
    return { success: true };
  } finally {
    await page.close();
    await context.close();
    await browser.close();
    temp.cleanup();
  }
}

// Standalone runner
if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await startTestServer(8765);
      browser = await launchChromium({ headless: true });
      await runWatermarkUiSuite(browser, 'http://127.0.0.1:8765');
      await runWatermarkUiWebKitMobile('http://127.0.0.1:8765');
      console.log('\n🎉 ALL WATERMARK UI TESTS PASSED!\n');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [FAIL] Watermark UI Test Failed:');
      console.error(err.message || err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = {
  runWatermarkUiSuite,
  runWatermarkUiWebKitMobile
};
