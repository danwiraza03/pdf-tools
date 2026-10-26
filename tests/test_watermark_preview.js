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

async function main() {
  await runUnitTests();
  await runBrowserPreviewPixelTest();
  console.log('========================================================================');
  console.log('ALL WATERMARK PREVIEW TESTS PASSED SUCCESSFULLY!');
  console.log('========================================================================');
}

if (require.main === module) {
  main().catch(err => {
    console.error('❌ [TEST FAILED]:', err);
    process.exit(1);
  });
}

module.exports = { runUnitTests, runBrowserPreviewPixelTest };
