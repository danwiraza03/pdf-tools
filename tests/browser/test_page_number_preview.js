/**
 * Playwright Browser Test: Page Number Live Placement Preview with Real PDF Canvas
 */

'use strict';

const assert = require('assert');
const { startTestServer, launchChromium } = require('./helpers');
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

async function createMultiPagePdf(count = 3) {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([595, 842]);
    page.drawText(`Document Page ${i + 1}`, { x: 50, y: 750, size: 24 });
    page.drawRectangle({
      x: 50,
      y: 600,
      width: 495,
      height: 100,
      color: PDFLib.rgb(0.2, 0.4, 0.8)
    });
  }
  return await doc.save();
}

async function runPageNumberPreviewSuite(browser, baseUrl) {
  console.log('========================================================================');
  console.log('       PAGE NUMBER: REAL PDF CANVAS LIVE PLACEMENT PREVIEW TEST         ');
  console.log('========================================================================\n');

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const multiPdfBytes = await createMultiPagePdf(3);

    await page.goto(`${baseUrl}/pages/page-number.html`, { waitUntil: 'domcontentloaded' });

    // 1. Upload 3-page PDF via dropzone input
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#dropzone')
    ]);

    await fileChooser.setFiles([{
      name: 'sample_doc.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(multiPdfBytes)
    }]);

    // Wait for workspace to appear
    await page.waitForSelector('#workspaceState', { state: 'visible', timeout: 8000 });
    console.log('  ✓ File loaded into workspace.');

    // 2. Verify #previewCanvas is visible and rendered
    await page.waitForSelector('#previewCanvas', { state: 'visible', timeout: 8000 });
    const canvasData = await page.evaluate(() => {
      const canvas = document.getElementById('previewCanvas');
      const skeleton = document.getElementById('previewSkeleton');
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const hasPixels = img.data.some(val => val > 0);
      return {
        width: canvas.width,
        height: canvas.height,
        displayed: window.getComputedStyle(canvas).display !== 'none',
        skeletonHidden: skeleton ? window.getComputedStyle(skeleton).display === 'none' : true,
        hasPixels: hasPixels
      };
    });

    assert(canvasData, 'Canvas pratinjau harus ada');
    assert(canvasData.width > 0 && canvasData.height > 0, 'Canvas harus memiliki dimensi > 0');
    assert.strictEqual(canvasData.displayed, true, 'Canvas pratinjau harus berstatus visible (display != none)');
    assert.strictEqual(canvasData.skeletonHidden, true, 'Skeleton placeholder harus disembunyikan saat canvas aktif');
    assert.strictEqual(canvasData.hasPixels, true, 'Canvas harus merender konten PDF asli (ada pixel gambar)');
    console.log('  ✓ Live placement preview berhasil merender halaman PDF asli ke canvas.');

    // 3. Verify Live Marker overlay text and position
    const markerInfo = await page.evaluate(() => {
      const m = document.getElementById('liveMarker');
      return {
        text: m ? m.textContent.trim() : '',
        bottom: m ? m.style.bottom : '',
        right: m ? m.style.right : ''
      };
    });
    assert.strictEqual(markerInfo.text, 'Page 1 of 3', 'Marker harus menampilkan Page 1 of 3');
    assert(markerInfo.bottom && markerInfo.bottom.includes('px'), 'Marker harus memiliki posisi bottom proporsional');
    assert(markerInfo.right && markerInfo.right.includes('px'), 'Marker harus memiliki posisi right proporsional');
    console.log(`  ✓ Marker penomoran ("${markerInfo.text}") tepat berada di atas canvas pratinjau.`);

    // 4. Test Page Navigation in Preview (Page 1 -> Page 2)
    const navVisible = await page.evaluate(() => {
      const nav = document.getElementById('previewNav');
      return nav && window.getComputedStyle(nav).display === 'flex';
    });
    assert.strictEqual(navVisible, true, 'Navigasi halaman pratinjau harus tampil untuk dokumen multi-halaman');

    await page.click('#nextPreviewPageBtn');
    await page.waitForTimeout(300);

    const page2Info = await page.evaluate(() => {
      const ind = document.getElementById('previewPageIndicator');
      const m = document.getElementById('liveMarker');
      return {
        indicator: ind ? ind.textContent.trim() : '',
        marker: m ? m.textContent.trim() : ''
      };
    });
    assert(page2Info.indicator.includes('2 / 3'), 'Indikator navigasi harus menunjukkan Halaman 2 / 3');
    assert.strictEqual(page2Info.marker, 'Page 2 of 3', 'Marker harus otomatis berganti ke Page 2 of 3');
    console.log('  ✓ Navigasi pratinjau halaman berpindah ke Halaman 2 dengan marker tersinkron.');

    // 5. Test Margin Input Change updates marker position
    const initialBottom = await page.evaluate(() => parseInt(document.getElementById('liveMarker').style.bottom, 10));
    await page.fill('#marginInput', '60');
    await page.dispatchEvent('#marginInput', 'input');
    await page.waitForTimeout(150);

    const newBottom = await page.evaluate(() => parseInt(document.getElementById('liveMarker').style.bottom, 10));
    assert(newBottom > initialBottom, `Margin 60px harus menghasilkan posisi bottom lebih besar (${newBottom} > ${initialBottom})`);
    console.log('  ✓ Pengubahan margin memperbarui posisi marker secara real-time.');

    // 6. Test Format Change
    await page.selectOption('#formatSelect', 'number_only');
    await page.waitForTimeout(100);
    const numOnlyText = await page.evaluate(() => document.getElementById('liveMarker').textContent.trim());
    assert.strictEqual(numOnlyText, '2', 'Format number_only pada halaman 2 harus menampilkan "2"');
    console.log('  ✓ Pengubahan format penomoran langsung tercermin pada live placement preview.');

    // 6b. Test Arial font selection
    await page.selectOption('#fontFamilySelect', 'Arial');
    await page.waitForTimeout(100);
    const markerFont = await page.evaluate(() => document.getElementById('liveMarker').style.fontFamily);
    assert(markerFont.includes('Arial'), 'Marker font family harus menyertakan Arial');
    console.log('  ✓ Pemilihan font Arial berhasil diterapkan pada marker penomoran.');

    // 7. Test Apply Page Numbers & Reset
    await page.click('#applyPageNumbersBtn');
    await page.waitForSelector('.toast', { timeout: 8000 });
    console.log('  ✓ Tombol Apply Page Numbers berhasil memproses PDF.');

    await page.click('#resetBtn');
    await page.waitForSelector('#uploadState', { state: 'visible', timeout: 3000 });
    console.log('  ✓ Tombol reset berhasil mengembalikan ke keadaan awal.');

    console.log('\n🎉 PENGUJIAN LIVE PLACEMENT PREVIEW REAL CANVAS LULUS 100%!\n');
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  (async () => {
    const server = await startTestServer(8799);
    const browser = await launchChromium();
    try {
      await runPageNumberPreviewSuite(browser, 'http://127.0.0.1:8799');
    } finally {
      await browser.close();
      server.close();
    }
  })().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
}

module.exports = { runPageNumberPreviewSuite };

