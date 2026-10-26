/**
 * Playwright Browser Test: Merge Size Optimization & UI Reordering
 * Tests both Chromium and WebKit iPhone 13 viewports.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');
const { chromium, webkit, devices } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

const { startTestServer } = require('./helpers');

/**
 * Creates ~300 KB noise PNG
 */
function createNoisePngBuffer(width = 320, height = 320) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let seed = 123456789;
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0;
    for (let x = 0; x < width * 3; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      raw[y * (1 + width * 3) + 1 + x] = (seed >> 16) & 0xff;
    }
  }

  const def = zlib.deflateSync(raw);
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', def),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

async function createFixtures(scratchDir) {
  if (!fs.existsSync(scratchDir)) {
    fs.mkdirSync(scratchDir, { recursive: true });
  }

  const pngBuf = createNoisePngBuffer(320, 320);

  // Doc A: 60 pages with ~300 KB PNG
  const docA = await PDFLib.PDFDocument.create();
  const imgA = await docA.embedPng(pngBuf);
  for (let i = 0; i < 60; i++) {
    const p = docA.addPage([595, 842]);
    p.drawImage(imgA, { x: 50, y: 150, width: 200, height: 200 });
    p.drawText(`HAL-A-${String(i + 1).padStart(2, '0')}`, { x: 50, y: 750, size: 20 });
  }
  const bytesA = await docA.save({ useObjectStreams: true });
  const pathA = path.join(scratchDir, 'DocA_Thesis.pdf');
  fs.writeFileSync(pathA, bytesA);

  // Doc B: 5 pages
  const docB = await PDFLib.PDFDocument.create();
  for (let i = 0; i < 5; i++) {
    const p = docB.addPage([595, 842]);
    p.drawText(`HAL-B-${String(i + 1).padStart(2, '0')}`, { x: 50, y: 750, size: 20 });
  }
  const bytesB = await docB.save({ useObjectStreams: true });
  const pathB = path.join(scratchDir, 'DocB_Appendix.pdf');
  fs.writeFileSync(pathB, bytesB);

  return {
    pathA,
    pathB,
    sizeA: bytesA.length,
    sizeB: bytesB.length,
    sumSizes: bytesA.length + bytesB.length
  };
}

async function runMergeBrowserTestForEngine(browser, baseUrl, fixtures, engineName = 'Chromium', contextOptions = {}) {
  console.log(`\n========================================================================`);
  console.log(`>>> [BROWSER TEST] Merge Size & UI Reorder on ${engineName}`);
  console.log(`========================================================================`);

  const context = await browser.newContext(contextOptions);
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Merge && window.PDFTools.Merge.assemble));

    // Upload fixtures via file input
    const fileInput = page.locator('#dropzone input[type="file"]');
    await fileInput.setInputFiles([fixtures.pathA, fixtures.pathB]);

    // Wait for organizer area
    await page.waitForSelector('#organizerArea', { state: 'visible', timeout: 15000 });
    console.log('  ✓ Files uploaded, organizer area displayed.');

    // Expand all file sections to view individual pages
    await page.locator('#expandAllBtn').click();
    await page.waitForSelector('.merge-page-card.expanded-page', { state: 'visible', timeout: 10000 });
    console.log('  ✓ File sections expanded to show individual page cards.');

    // Reorder one page via UI:
    // Move second card (HAL-A-02) before first card (HAL-A-01) in Group 0
    await page.evaluate(() => {
      const cards = document.querySelectorAll('.merge-file-group-body .merge-page-card');
      if (cards.length > 1) {
        const parent = cards[0].parentNode;
        parent.insertBefore(cards[1], cards[0]);
      }
    });

    console.log('  ✓ Page 1 and Page 2 reordered in UI.');

    // Click Merge button
    const mergeBtn = page.locator('#mergeBtn');
    await mergeBtn.click();

    // Wait for result area
    await page.waitForSelector('#resultArea.active', { state: 'visible', timeout: 20000 });
    console.log('  ✓ Merge completed, result area displayed.');

    // Read resSize and resPages from UI
    const resSizeUi = await page.locator('#resSize').textContent();
    const resPagesUi = await page.locator('#resPages').textContent();
    console.log(`  📊 UI Displayed Metrics: resSize = "${resSizeUi}", resPages = "${resPagesUi}"`);

    assert.strictEqual(parseInt(resPagesUi, 10), 65, `Expected 65 pages in UI, got "${resPagesUi}"`);

    // Retrieve merged bytes from page memory
    const base64Data = await page.evaluate(() => {
      const bytes = window._lastMergedData;
      let binary = '';
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return window.btoa(binary);
    });

    const mergedBytes = Buffer.from(base64Data, 'base64');
    console.log(`  - Retrieved merged bytes: ${mergedBytes.length} bytes (~${(mergedBytes.length / 1024).toFixed(1)} KB)`);

    // Verify assertion 1a: size <= 1.15 * sum of sources + 100 KB
    const allowedMaxSize = Math.round(1.15 * fixtures.sumSizes + 100 * 1024);
    console.log(`  [Assert 1a] Result size: ${mergedBytes.length} bytes <= Allowed: ${allowedMaxSize} bytes`);
    assert(
      mergedBytes.length <= allowedMaxSize,
      `Output size exploded in browser! Got ${mergedBytes.length} bytes, expected <= ${allowedMaxSize}`
    );
    console.log('  ✓ [PASS] Output size is within optimal limit.');

    // Verify text order with PDF.js:
    // Page 1 should now contain "HAL-A-02" and Page 2 should contain "HAL-A-01" due to reordering!
    const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(mergedBytes).slice(0), verbosity: 0 }).promise;
    assert.strictEqual(pdfjsDoc.numPages, 65);

    const page1 = await pdfjsDoc.getPage(1);
    const text1 = (await page1.getTextContent()).items.map(it => it.str).join(' ');
    assert(text1.includes('HAL-A-02'), `Page 1 expected "HAL-A-02" after reordering, got "${text1}"`);

    const page2 = await pdfjsDoc.getPage(2);
    const text2 = (await page2.getTextContent()).items.map(it => it.str).join(' ');
    assert(text2.includes('HAL-A-01'), `Page 2 expected "HAL-A-01" after reordering, got "${text2}"`);

    console.log('  ✓ [PASS] Reordered text order verified via PDF.js (Page 1 = HAL-A-02, Page 2 = HAL-A-01).');
    console.log(`✅ [PASS] Merge Size Browser Suite passed on ${engineName}!`);
    return { success: true, resSize: resSizeUi, resPages: resPagesUi, byteLength: mergedBytes.length };
  } finally {
    await page.close();
    await context.close();
  }
}

async function runMergeSizeBrowserSuite(chromiumBrowser, baseUrl) {
  const scratchDir = path.resolve(ROOT_DIR, 'scratch/test_merge_browser');
  const fixtures = await createFixtures(scratchDir);

  // 1. Chromium Desktop
  await runMergeBrowserTestForEngine(chromiumBrowser, baseUrl, fixtures, 'Chromium Desktop');

  // 2. WebKit iPhone 13
  let webkitBrowser;
  try {
    webkitBrowser = await webkit.launch({ headless: true });
    await runMergeBrowserTestForEngine(
      webkitBrowser,
      baseUrl,
      fixtures,
      'iPhone 13 (WebKit)',
      {
        ...devices['iPhone 13'],
        hasTouch: true
      }
    );
  } finally {
    if (webkitBrowser) {
      await webkitBrowser.close();
    }
  }
}

if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await startTestServer(8765);
      browser = await chromium.launch({ headless: true });
      await runMergeSizeBrowserSuite(browser, 'http://127.0.0.1:8765');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ [FAIL] Browser Merge Size Test failed:');
      console.error(err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = { runMergeSizeBrowserSuite };
