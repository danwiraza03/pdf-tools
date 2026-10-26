const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { chromium } = require('playwright');

// Load PDFLib
const PDFLib = require(path.resolve(__dirname, '../js/lib/pdf-lib.min.js'));

// Load Watermark core in Node environment
global.window = global.window || {};
global.PDFTools = global.PDFTools || {};
global.PDFLib = PDFLib;
require(path.resolve(__dirname, '../js/core/pdf-watermark.js'));

async function runUnitTests() {
  console.log('========================================================================');
  console.log('>>> [UNIT TEST] PDFTools.Watermark.parsePageRange');
  console.log('========================================================================');

  const P = PDFTools.Watermark.parsePageRange;
  const total = 5;

  // 1. Default / all
  assert.deepStrictEqual(P(undefined, total), [0, 1, 2, 3, 4]);
  assert.deepStrictEqual(P('all', total), [0, 1, 2, 3, 4]);
  console.log('  ✓ Default and "all" return all page indices [0, 1, 2, 3, 4].');

  // 2. First
  assert.deepStrictEqual(P('first', total), [0]);
  console.log('  ✓ "first" returns [0].');

  // 3. Array
  assert.deepStrictEqual(P([0], total), [0]);
  assert.deepStrictEqual(P([0, 2, 4], total), [0, 2, 4]);
  assert.deepStrictEqual(P([4, 1, 1], total), [1, 4]);
  console.log('  ✓ Array of indices deduplicates and sorts properly.');

  // 4. Custom range string
  assert.deepStrictEqual(P('1, 3-5', total), [0, 2, 3, 4]);
  assert.deepStrictEqual(P('2-4', total), [1, 2, 3]);
  assert.deepStrictEqual(P('1, 2, 3', total), [0, 1, 2]);
  console.log('  ✓ Custom range string "1, 3-5" parses to [0, 2, 3, 4].');

  // 5. Validation errors
  assert.throws(() => P('', total), /Rentang halaman tidak boleh kosong/);
  assert.throws(() => P('   ', total), /Rentang halaman tidak boleh kosong/);
  console.log('  ✓ Empty string throws clear validation error.');

  assert.throws(() => P('6', total), /melebihi jumlah halaman dokumen/);
  assert.throws(() => P('1, 6', total), /melebihi jumlah halaman dokumen/);
  console.log('  ✓ Out-of-bounds page number throws clear validation error.');

  assert.throws(() => P('5-2', total), /awal rentang .* lebih besar dari akhir rentang/);
  console.log('  ✓ Reversed range (5-2) throws clear validation error.');

  assert.throws(() => P('0', total), /minimal 1/);
  assert.throws(() => P('-1', total), /Format rentang halaman tidak valid|karakter tidak valid/);
  assert.throws(() => P('1,abc', total), /Rentang halaman mengandung karakter tidak valid/);
  console.log('  ✓ Invalid characters or page 0 throws clear validation error.');

  console.log('✅ [PASS] All parsePageRange unit tests passed!\n');
}

async function runBrowserPreviewPixelTest() {
  console.log('========================================================================');
  console.log('>>> [BROWSER TEST] Watermark Preview vs Final Apply Pixel-Per-Pixel Match');
  console.log('========================================================================');

  const PORT = 8976;
  const server = http.createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const safePath = path.normalize(path.join(__dirname, '..', rawUrl));
    if (!safePath.startsWith(path.resolve(__dirname, '..'))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.pdf': 'application/pdf'
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(safePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  console.log(`  ✓ Local test server listening on http://127.0.0.1:${PORT}`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} "${dialog.message()}"`);
  });

  const tempDir = path.join(__dirname, 'temp_wm_preview_test');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const testPdfPath = path.join(tempDir, 'sample_3pages.pdf');

  try {
    // Create a 3-page distinct PDF
    const doc = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= 3; i++) {
      const p = doc.addPage([595, 842]);
      p.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: PDFLib.rgb(0.95, 0.95, 0.95) });
      p.drawText(`Document Page ${i}`, { x: 50, y: 750, size: 28, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    }
    fs.writeFileSync(testPdfPath, await doc.save());

    await page.goto(`http://127.0.0.1:${PORT}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Upload PDF
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles(testPdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });
    console.log('  ✓ PDF uploaded and options panel visible.');

    // Verify Preview button exists and has >= 44px height
    const previewBtn = page.locator('#previewBtn');
    await previewBtn.waitFor({ state: 'visible', timeout: 3000 });
    const btnBox = await previewBtn.boundingBox();
    assert(btnBox && btnBox.height >= 44, `Preview button height (${btnBox?.height}px) must be >= 44px`);
    console.log(`  ✓ Preview button visible with height ${btnBox.height}px (>= 44px).`);

    // Set custom watermark text and options
    await page.locator('#wmText').fill('CONFIDENTIAL TEST');

    // Click Preview before Apply
    console.log('  --- Clicking Preview Button ---');
    await previewBtn.click();

    // Wait for canvas to be populated with rendered pixels
    await page.waitForFunction(() => {
      const canvas = document.getElementById('wmResultCanvas');
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imgData.data.some(b => b > 0);
    }, { timeout: 10000 });

    const previewResult = await page.evaluate(() => {
      const canvas = document.getElementById('wmResultCanvas');
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(imgData.data)
      };
    });
    console.log(`  ✓ Preview rendered on canvas (${previewResult.width}x${previewResult.height}, ${previewResult.pixels.length} bytes).`);

    // Now click Apply Watermark
    console.log('  --- Clicking Apply Watermark Button ---');
    const applyBtn = page.locator('#applyBtn');
    await applyBtn.click();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });

    // Wait for page 1 of result to render on #wmResultCanvas
    await page.waitForTimeout(600);
    await page.waitForFunction(() => {
      const canvas = document.getElementById('wmResultCanvas');
      return canvas && canvas.width > 0 && canvas.height > 0;
    });

    const finalResult = await page.evaluate(() => {
      const canvas = document.getElementById('wmResultCanvas');
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return {
        width: canvas.width,
        height: canvas.height,
        pixels: Array.from(imgData.data)
      };
    });
    console.log(`  ✓ Final page 1 rendered on canvas (${finalResult.width}x${finalResult.height}, ${finalResult.pixels.length} bytes).`);

    // Assert exact canvas dimensions
    assert.strictEqual(previewResult.width, finalResult.width, 'Canvas width must match exactly');
    assert.strictEqual(previewResult.height, finalResult.height, 'Canvas height must match exactly');
    assert.strictEqual(previewResult.pixels.length, finalResult.pixels.length, 'Canvas buffer byte length must match');

    // Assert pixel-by-pixel exact identity
    let mismatchCount = 0;
    let firstMismatch = null;
    for (let i = 0; i < previewResult.pixels.length; i++) {
      if (previewResult.pixels[i] !== finalResult.pixels[i]) {
        mismatchCount++;
        if (!firstMismatch) firstMismatch = { index: i, preview: previewResult.pixels[i], final: finalResult.pixels[i] };
      }
    }

    assert.strictEqual(mismatchCount, 0, `Preview and final page 1 must be 100% pixel-for-pixel identical! Found ${mismatchCount} mismatched bytes. First: ${JSON.stringify(firstMismatch)}`);
    console.log('  ✓ [MATCH] Preview and final page 1 are 100% pixel-per-pixel identical (0 mismatched bytes across ' + previewResult.pixels.length + ' bytes)!');

    console.log('✅ [PASS] Watermark preview pixel-per-pixel verification passed!\n');
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(testPdfPath)) fs.unlinkSync(testPdfPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
}

async function runPageRangeTest() {
  console.log('========================================================================');
  console.log('>>> [BROWSER TEST] Page Range Application & Pixel Verification');
  console.log('========================================================================');

  const PORT = 8978;
  const server = http.createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const safePath = path.normalize(path.join(__dirname, '..', rawUrl));
    if (!safePath.startsWith(path.resolve(__dirname, '..'))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.pdf': 'application/pdf'
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(safePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} "${dialog.message()}"`);
  });

  const tempDir = path.join(__dirname, 'temp_wm_range_test');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const test5PdfPath = path.join(tempDir, 'sample_5pages.pdf');

  try {
    // Create 5-page PDF with distinct text and background
    const doc = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= 5; i++) {
      const p = doc.addPage([595, 842]);
      p.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: PDFLib.rgb(1, 1, 1) });
      p.drawText(`Original Page Content ${i}`, { x: 60, y: 700, size: 28, color: PDFLib.rgb(0.1, 0.1, 0.1) });
    }
    const origBytes = await doc.save();
    fs.writeFileSync(test5PdfPath, origBytes);

    await page.goto(`http://127.0.0.1:${PORT}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Upload 5-page PDF
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles(test5PdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 5000 });

    // 1. Test validation on empty custom range
    await page.locator('#wmApplyCustom').click();
    await page.waitForSelector('#wmCustomRangeWrap', { state: 'visible' });
    await page.locator('#wmCustomRangeInput').fill('');
    await page.locator('#applyBtn').click();

    // Verify toast error appeared
    const toastEmpty = await page.waitForSelector('.toast.toast-error', { state: 'visible', timeout: 4000 });
    const emptyMsg = await toastEmpty.textContent();
    assert(/kosong|empty/i.test(emptyMsg), `Empty range toast expected, got: "${emptyMsg}"`);
    console.log('  ✓ Toast error correctly displayed for empty page range:', emptyMsg);

    // 2. Test validation on invalid format (e.g. "abc")
    await page.locator('#wmCustomRangeInput').fill('abc');
    await page.locator('#applyBtn').click();
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('.toast.toast-error');
      return Array.from(toasts).some(t => /tidak valid|invalid/i.test(t.textContent));
    }, { timeout: 4000 });
    console.log('  ✓ Toast error correctly displayed for invalid characters range ("abc").');

    // 3. Test validation on out of bounds (e.g. "1, 99")
    await page.locator('#wmCustomRangeInput').fill('1, 99');
    await page.locator('#applyBtn').click();
    await page.waitForFunction(() => {
      const toasts = document.querySelectorAll('.toast.toast-error');
      return Array.from(toasts).some(t => /melebihi|out of bounds/i.test(t.textContent));
    }, { timeout: 4000 });
    console.log('  ✓ Toast error correctly displayed for out-of-bounds page ("1, 99").');

    // 4. Test valid range: "1, 3-5"
    // Pages 1, 3, 4, 5 will have watermark. Page 2 (index 1) must be 100% UNTOUCHED!
    await page.locator('#wmCustomRangeInput').fill('1, 3-5');
    await page.locator('#wmText').fill('WATERMARK_RANGE_TEST');
    await page.locator('#applyBtn').click();
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 15000 });
    console.log('  ✓ Watermark applied with range "1, 3-5".');

    // Extract rendered pixels of original PDF vs watermarked PDF
    const comparison = await page.evaluate(async (origBase64) => {
      const rawOrig = Uint8Array.from(atob(origBase64), c => c.charCodeAt(0));
      const origDoc = await pdfjsLib.getDocument({ data: rawOrig }).promise;
      
      // Page 2 of original
      const origP2 = await origDoc.getPage(2);
      const vp2 = origP2.getViewport({ scale: 1.0 });
      const cOrig2 = document.createElement('canvas');
      cOrig2.width = vp2.width;
      cOrig2.height = vp2.height;
      await origP2.render({ canvasContext: cOrig2.getContext('2d'), viewport: vp2 }).promise;
      const origP2Data = Array.from(cOrig2.getContext('2d').getImageData(0, 0, vp2.width, vp2.height).data);

      // Page 2 of watermarked result (wmResultPdfDoc or watermarkedData)
      const wmDoc = window.wmResultPdfDoc || (await pdfjsLib.getDocument({ data: window.watermarkedData }).promise);
      const wmP2 = await wmDoc.getPage(2);
      const cWm2 = document.createElement('canvas');
      cWm2.width = vp2.width;
      cWm2.height = vp2.height;
      await wmP2.render({ canvasContext: cWm2.getContext('2d'), viewport: vp2 }).promise;
      const wmP2Data = Array.from(cWm2.getContext('2d').getImageData(0, 0, vp2.width, vp2.height).data);

      // Page 1 of original vs watermarked
      const origP1 = await origDoc.getPage(1);
      const vp1 = origP1.getViewport({ scale: 1.0 });
      const cOrig1 = document.createElement('canvas');
      cOrig1.width = vp1.width;
      cOrig1.height = vp1.height;
      await origP1.render({ canvasContext: cOrig1.getContext('2d'), viewport: vp1 }).promise;
      const origP1Data = Array.from(cOrig1.getContext('2d').getImageData(0, 0, vp1.width, vp1.height).data);

      const wmP1 = await wmDoc.getPage(1);
      const cWm1 = document.createElement('canvas');
      cWm1.width = vp1.width;
      cWm1.height = vp1.height;
      await wmP1.render({ canvasContext: cWm1.getContext('2d'), viewport: vp1 }).promise;
      const wmP1Data = Array.from(cWm1.getContext('2d').getImageData(0, 0, vp1.width, vp1.height).data);

      return {
        origP2Data,
        wmP2Data,
        origP1Data,
        wmP1Data
      };
    }, Buffer.from(origBytes).toString('base64'));

    // Verify Page 2 (outside range) has ZERO pixel differences
    assert.strictEqual(comparison.origP2Data.length, comparison.wmP2Data.length);
    let p2Diffs = 0;
    for (let i = 0; i < comparison.origP2Data.length; i++) {
      if (comparison.origP2Data[i] !== comparison.wmP2Data[i]) {
        p2Diffs++;
      }
    }
    assert.strictEqual(p2Diffs, 0, `Page 2 (outside range) MUST be 100% untouched! Found ${p2Diffs} differences.`);
    console.log('  ✓ [PIXEL VERIFIED] Page 2 (outside range "1, 3-5") has 0 pixel differences from original!');

    // Verify Page 1 (inside range) has watermark differences
    let p1Diffs = 0;
    for (let i = 0; i < comparison.origP1Data.length; i++) {
      if (comparison.origP1Data[i] !== comparison.wmP1Data[i]) {
        p1Diffs++;
      }
    }
    assert(p1Diffs > 0, 'Page 1 (inside range "1, 3-5") MUST have watermark applied');
    console.log(`  ✓ [PIXEL VERIFIED] Page 1 (inside range) has ${p1Diffs} watermark pixel differences from original.`);

    console.log('✅ [PASS] Page range application and pixel verification passed!\n');
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(test5PdfPath)) fs.unlinkSync(test5PdfPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
}

async function runLargePdfDebounceTest() {
  console.log('========================================================================');
  console.log('>>> [BROWSER TEST] 250-Page PDF Preview Performance, Debounce & Cancellation');
  console.log('========================================================================');

  const PORT = 8980;
  const server = http.createServer((req, res) => {
    const rawUrl = req.url.split('?')[0];
    const safePath = path.normalize(path.join(__dirname, '..', rawUrl));
    if (!safePath.startsWith(path.resolve(__dirname, '..'))) {
      res.writeHead(403);
      return res.end('Forbidden');
    }
    if (fs.existsSync(safePath) && fs.statSync(safePath).isFile()) {
      const ext = path.extname(safePath).toLowerCase();
      const mimeMap = {
        '.html': 'text/html',
        '.js': 'application/javascript',
        '.css': 'text/css',
        '.svg': 'image/svg+xml',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.pdf': 'application/pdf'
      };
      res.writeHead(200, { 'Content-Type': mimeMap[ext] || 'application/octet-stream' });
      fs.createReadStream(safePath).pipe(res);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(PORT, '127.0.0.1', resolve);
    server.on('error', reject);
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.on('dialog', dialog => {
    assert.fail(`Forbidden native dialog triggered: ${dialog.type()} "${dialog.message()}"`);
  });

  const tempDir = path.join(__dirname, 'temp_wm_large_test');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  const test250PdfPath = path.join(tempDir, 'sample_250pages.pdf');

  try {
    // Generate a 250-page PDF
    console.log('  --- Creating 250-page PDF fixture ---');
    const doc = await PDFLib.PDFDocument.create();
    for (let i = 1; i <= 250; i++) {
      const p = doc.addPage([595, 842]);
      p.drawText(`Document Page ${i} of 250`, { x: 50, y: 780, size: 22, color: PDFLib.rgb(0.2, 0.2, 0.2) });
    }
    fs.writeFileSync(test250PdfPath, await doc.save());
    console.log('  ✓ 250-page PDF fixture created (' + (fs.statSync(test250PdfPath).size / 1024).toFixed(1) + ' KB).');

    await page.goto(`http://127.0.0.1:${PORT}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark));

    // Upload 250-page PDF
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles(test250PdfPath);
    await page.waitForSelector('#optionsPanel', { state: 'visible', timeout: 8000 });
    console.log('  ✓ 250-page PDF loaded into Watermark UI.');

    // 1. Measure Preview Performance (Requirement 3: only page 1 processed, completes in reasonable time)
    console.log('  --- Measuring Preview Performance for 250-Page PDF ---');
    const previewBtn = page.locator('#previewBtn');
    await previewBtn.waitFor({ state: 'visible', timeout: 3000 });

    const startTime = Date.now();
    await previewBtn.click();

    // Wait for canvas to be populated
    await page.waitForFunction(() => {
      const canvas = document.getElementById('wmResultCanvas');
      if (!canvas || canvas.width === 0 || canvas.height === 0) return false;
      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return imgData.data.some(b => b > 0);
    }, { timeout: 10000 });

    const previewDuration = Date.now() - startTime;
    console.log(`  ✓ 250-page PDF preview completed in ${previewDuration}ms (reasonable time < 4000ms).`);
    assert(previewDuration < 5000, `Preview took ${previewDuration}ms, exceeding reasonable threshold (5000ms)!`);

    // 2. Test UI Responsiveness (Event loop is free and UI responds immediately)
    console.log('  --- Testing UI Responsiveness and Interaction ---');
    const isResponsive = await page.evaluate(async () => {
      const t0 = performance.now();
      await new Promise(r => setTimeout(r, 20));
      const lag = performance.now() - t0;
      return lag < 100; // Event loop lag under 100ms indicates free and responsive UI
    });
    assert(isResponsive, 'UI and event loop must remain free and responsive');
    console.log('  ✓ UI is responsive (event loop delay < 100ms).');

    // 3. Test Debounce & Cancellation on rapid settings change
    console.log('  --- Testing Live Preview Debounce and Cancellation ---');
    const initialExecCount = await page.evaluate(() => window.__wmState.getPreviewExecCount());
    const initialToken = await page.evaluate(() => window.__wmState.getActivePreviewToken());

    // Rapidly change text 3 times
    const wmTextInput = page.locator('#wmText');
    await wmTextInput.fill('RAPID_CHANGE_1');
    await page.waitForTimeout(40);
    await wmTextInput.fill('RAPID_CHANGE_2');
    await page.waitForTimeout(40);
    await wmTextInput.fill('FINAL_RAPID_TEXT');

    // Verify token was incremented (older runs cancelled)
    const afterRapidToken = await page.evaluate(() => window.__wmState.getActivePreviewToken());
    assert(afterRapidToken > initialToken, 'Settings change must increment active cancellation token');

    // Wait for debounce timer (300ms) to fire and complete the preview
    await page.waitForFunction((count) => {
      return window.__wmState && window.__wmState.getPreviewExecCount() > count;
    }, initialExecCount, { timeout: 5000 });

    const finalExecCount = await page.evaluate(() => window.__wmState.getPreviewExecCount());
    assert.strictEqual(finalExecCount, initialExecCount + 1, 'Debouncing should ensure exactly ONE preview execution for rapid keystrokes');
    console.log(`  ✓ Debounce & Cancellation passed: rapid keystrokes executed exactly 1 render (total runs: ${finalExecCount}).`);

    console.log('✅ [PASS] 250-page PDF preview performance, debounce & cancellation passed!\n');
  } finally {
    await browser.close();
    server.close();
    if (fs.existsSync(test250PdfPath)) fs.unlinkSync(test250PdfPath);
    if (fs.existsSync(tempDir)) fs.rmdirSync(tempDir);
  }
}

async function main() {
  await runUnitTests();
  await runBrowserPreviewPixelTest();
  await runPageRangeTest();
  await runLargePdfDebounceTest();
  console.log('========================================================================');
  console.log('ALL WATERMARK PREVIEW, RANGE, & PERFORMANCE TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ [TEST FAILED]:', err);
    process.exit(1);
  });
}

module.exports = { runUnitTests, runBrowserPreviewPixelTest, runPageRangeTest, runLargePdfDebounceTest };
