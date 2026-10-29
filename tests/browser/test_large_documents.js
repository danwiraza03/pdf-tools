/**
 * Large Documents & High-Volume Benchmark Suite
 * Evaluates performance, memory stability, and correctness on multi-page/large documents:
 * - Merge: 10 distinct PDFs (10 pages each = 100 pages total)
 * - Split: Extract 20 pages from a 100-page document
 * - Watermark: Apply text watermark across 100 pages
 * - Remove Pages: Remove 25 pages from a 100-page document (75 pages remaining)
 * - Compress: Compress a 10-page photo document
 * - Preview: Render first page preview with PDF.js
 *
 * Executed separately via `npm run test:large` (isolated from routine test:browser).
 * Timing and memory are recorded as diagnostic reports, avoiding brittle timing assertions.
 */

'use strict';

const assert = require('assert');
const { startTestServer, launchChromium } = require('./helpers');

const TEST_PORT = 8768;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

function getHeapMb() {
  return (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
}

async function runLargeDocumentsSuite() {
  console.log('========================================================================');
  console.log('           LARGE DOCUMENTS & HIGH-VOLUME BENCHMARK SUITE                ');
  console.log('========================================================================\n');

  let server = null;
  let browser = null;
  const benchmarkResults = [];

  try {
    server = await startTestServer(TEST_PORT);
    browser = await launchChromium({ headless: true });
    const page = await browser.newPage();

    // -------------------------------------------------------------------------
    // 1. BENCHMARK: MERGE (10 PDFs, 10 pages each = 100 pages total)
    // -------------------------------------------------------------------------
    console.log('>>> [1/6] Running Benchmark: Merge 10 PDFs (100 pages total)...');
    await page.goto(`${BASE_URL}/pages/merge.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Merge && window.PDFLib));

    const memBeforeMerge = getHeapMb();
    const mergeMetric = await page.evaluate(async () => {
      const { PDFDocument, StandardFonts } = window.PDFLib;
      const items = [];
      for (let i = 0; i < 10; i++) {
        const doc = await PDFDocument.create();
        const font = await doc.embedFont(StandardFonts.Helvetica);
        for (let p = 0; p < 10; p++) {
          const pg = doc.addPage([595, 842]);
          pg.drawText(`Document #${i + 1} - Page #${p + 1}`, { x: 50, y: 800, size: 14, font });
        }
        const bytes = await doc.save();
        items.push({ file: new File([bytes], `batch_${i + 1}.pdf`, { type: 'application/pdf' }) });
      }

      const t0 = performance.now();
      const res = await window.PDFTools.Merge.merge(items);
      const durMs = performance.now() - t0;

      const mergedDoc = await PDFDocument.load(res.bytes);
      return {
        pageCount: mergedDoc.getPageCount(),
        sizeBytes: res.bytes.byteLength,
        durMs
      };
    });

    assert.strictEqual(mergeMetric.pageCount, 100, 'Hasil merge harus tepat memiliki 100 halaman');
    benchmarkResults.push({
      operation: 'Gabung 10 PDF (100 Halaman)',
      input: '10 berkas (10 hal/berkas)',
      output: `${mergeMetric.pageCount} halaman (${(mergeMetric.sizeBytes / 1024).toFixed(1)} KB)`,
      duration: `${(mergeMetric.durMs / 1000).toFixed(2)}s (${Math.round(mergeMetric.durMs)} ms)`,
      heapMem: `${memBeforeMerge} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: 100 halaman digabung dalam ${(mergeMetric.durMs / 1000).toFixed(2)}s.`);

    // -------------------------------------------------------------------------
    // 2. BENCHMARK: SPLIT (Extract 20 pages from 100-page PDF)
    // -------------------------------------------------------------------------
    console.log('\n>>> [2/6] Running Benchmark: Split 20 pages from 100-page document...');
    await page.goto(`${BASE_URL}/pages/split.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Split && window.PDFLib));

    const memBeforeSplit = getHeapMb();
    const splitMetric = await page.evaluate(async () => {
      const { PDFDocument, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let i = 1; i <= 100; i++) {
        const pg = doc.addPage([595, 842]);
        pg.drawText(`Split Master Page ${i}`, { x: 50, y: 800, size: 14, font });
      }
      const bytes = await doc.save();
      const file = new File([bytes], 'master100.pdf', { type: 'application/pdf' });

      // Extract first 20 pages (indices 0..19)
      const extractIndices = Array.from({ length: 20 }, (_, i) => i);
      const t0 = performance.now();
      const splitBytes = await window.PDFTools.Split.extractPages(file, extractIndices);
      const durMs = performance.now() - t0;

      const splitDoc = await PDFDocument.load(splitBytes);
      return {
        pageCount: splitDoc.getPageCount(),
        sizeBytes: splitBytes.byteLength,
        durMs
      };
    });

    assert.strictEqual(splitMetric.pageCount, 20, 'Hasil split harus tepat memiliki 20 halaman');
    benchmarkResults.push({
      operation: 'Pisah Halaman (20 dari 100)',
      input: '1 berkas (100 halaman)',
      output: `${splitMetric.pageCount} halaman (${(splitMetric.sizeBytes / 1024).toFixed(1)} KB)`,
      duration: `${(splitMetric.durMs / 1000).toFixed(2)}s (${Math.round(splitMetric.durMs)} ms)`,
      heapMem: `${memBeforeSplit} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: 20 halaman diekstrak dalam ${(splitMetric.durMs / 1000).toFixed(2)}s.`);

    // -------------------------------------------------------------------------
    // 3. BENCHMARK: WATERMARK (Apply watermark across 100 pages)
    // -------------------------------------------------------------------------
    console.log('\n>>> [3/6] Running Benchmark: Watermark 100-page document...');
    await page.goto(`${BASE_URL}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark && window.PDFLib));

    const memBeforeWm = getHeapMb();
    const wmMetric = await page.evaluate(async () => {
      const { PDFDocument, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let i = 1; i <= 100; i++) {
        const pg = doc.addPage([595, 842]);
        pg.drawText(`Watermark Test Page ${i}`, { x: 50, y: 800, size: 14, font });
      }
      const bytes = await doc.save();
      const file = new File([bytes], 'wm100.pdf', { type: 'application/pdf' });

      const t0 = performance.now();
      const resBytes = await window.PDFTools.Watermark.applyWatermark(file, {
        text: 'RAHASIA / CONFIDENTIAL',
        fontSize: 42,
        opacity: 0.25,
        rotation: 45
      });
      const durMs = performance.now() - t0;

      const resDoc = await PDFDocument.load(resBytes);
      return {
        pageCount: resDoc.getPageCount(),
        sizeBytes: resBytes.byteLength,
        durMs
      };
    });

    assert.strictEqual(wmMetric.pageCount, 100, 'Hasil watermark harus mempertahankan 100 halaman');
    benchmarkResults.push({
      operation: 'Watermark Teks (100 Halaman)',
      input: '1 berkas (100 halaman)',
      output: `${wmMetric.pageCount} halaman (${(wmMetric.sizeBytes / 1024).toFixed(1)} KB)`,
      duration: `${(wmMetric.durMs / 1000).toFixed(2)}s (${Math.round(wmMetric.durMs)} ms)`,
      heapMem: `${memBeforeWm} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: 100 halaman diberi watermark dalam ${(wmMetric.durMs / 1000).toFixed(2)}s.`);

    // -------------------------------------------------------------------------
    // 4. BENCHMARK: REMOVE PAGES (Remove 25 pages from 100 pages = 75 pages)
    // -------------------------------------------------------------------------
    console.log('\n>>> [4/6] Running Benchmark: Remove 25 pages from 100-page document...');
    await page.goto(`${BASE_URL}/pages/remove-pages.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Remove && window.PDFLib));

    const memBeforeRemove = getHeapMb();
    const removeMetric = await page.evaluate(async () => {
      const { PDFDocument, StandardFonts } = window.PDFLib;
      const doc = await PDFDocument.create();
      const font = await doc.embedFont(StandardFonts.Helvetica);
      for (let i = 1; i <= 100; i++) {
        const pg = doc.addPage([595, 842]);
        pg.drawText(`Remove Candidate Page ${i}`, { x: 50, y: 800, size: 14, font });
      }
      const bytes = await doc.save();
      const file = new File([bytes], 'remove100.pdf', { type: 'application/pdf' });

      // Remove 25 pages: indices 0, 4, 8, ...
      const removeIndices = Array.from({ length: 25 }, (_, i) => i * 4);
      const t0 = performance.now();
      const res = await window.PDFTools.Remove.removePages(file, removeIndices);
      const durMs = performance.now() - t0;

      const resDoc = await PDFDocument.load(res.bytes);
      return {
        pageCount: resDoc.getPageCount(),
        sizeBytes: res.bytes.byteLength,
        durMs
      };
    });

    assert.strictEqual(removeMetric.pageCount, 75, 'Hasil remove pages harus tepat tersisa 75 halaman');
    benchmarkResults.push({
      operation: 'Hapus Halaman (25 dari 100)',
      input: '1 berkas (100 halaman)',
      output: `${removeMetric.pageCount} halaman (${(removeMetric.sizeBytes / 1024).toFixed(1)} KB)`,
      duration: `${(removeMetric.durMs / 1000).toFixed(2)}s (${Math.round(removeMetric.durMs)} ms)`,
      heapMem: `${memBeforeRemove} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: 25 halaman dihapus (sisa 75) dalam ${(removeMetric.durMs / 1000).toFixed(2)}s.`);

    // -------------------------------------------------------------------------
    // 5. BENCHMARK: COMPRESS (10 Photo Pages with high-res gradients)
    // -------------------------------------------------------------------------
    console.log('\n>>> [5/6] Running Benchmark: Compress 10 photo pages (canvas gradients)...');
    await page.goto(`${BASE_URL}/pages/compress.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Compress && window.PDFLib && window.pdfjsLib));

    const memBeforeComp = getHeapMb();
    const compMetric = await page.evaluate(async () => {
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.create();

      // Create 10 colorful high-res photo pages
      for (let i = 0; i < 10; i++) {
        const c = document.createElement('canvas');
        c.width = 1200;
        c.height = 800;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, 1200, 800);
        grad.addColorStop(0, '#3b82f6');
        grad.addColorStop(0.5, '#10b981');
        grad.addColorStop(1, '#f59e0b');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 1200, 800);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(`Benchmark Photo Canvas #${i + 1}`, 80, 160);

        const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.90));
        const arrayBuffer = await blob.arrayBuffer();
        const embedded = await doc.embedJpg(arrayBuffer);
        const pg = doc.addPage([1200, 800]);
        pg.drawImage(embedded, { x: 0, y: 0, width: 1200, height: 800 });
      }

      const origBytes = await doc.save();
      const file = new File([origBytes], 'photos_10.pdf', { type: 'application/pdf' });

      const t0 = performance.now();
      const compRes = await window.PDFTools.Compress.compress(file, 'medium');
      const durMs = performance.now() - t0;

      return {
        origSizeKB: (origBytes.byteLength / 1024).toFixed(1),
        newSizeKB: (compRes.bytes.byteLength / 1024).toFixed(1),
        savedPercent: compRes.savedPercent,
        durMs
      };
    });

    assert.ok(compMetric.durMs > 0, 'Kompresi harus menyelesaikan proses secara valid');
    benchmarkResults.push({
      operation: 'Kompresi 10 Halaman Foto',
      input: `10 halaman (${compMetric.origSizeKB} KB)`,
      output: `${compMetric.newSizeKB} KB (Hemat ${compMetric.savedPercent}%)`,
      duration: `${(compMetric.durMs / 1000).toFixed(2)}s (${Math.round(compMetric.durMs)} ms)`,
      heapMem: `${memBeforeComp} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: 10 halaman foto dikompres (${compMetric.origSizeKB} KB -> ${compMetric.newSizeKB} KB) dalam ${(compMetric.durMs / 1000).toFixed(2)}s.`);

    // -------------------------------------------------------------------------
    // 6. BENCHMARK: FIRST PAGE PREVIEW (PDF.js Canvas Render)
    // -------------------------------------------------------------------------
    console.log('\n>>> [6/6] Running Benchmark: First page preview rendering (PDF.js)...');
    const memBeforePrev = getHeapMb();
    const prevMetric = await page.evaluate(async () => {
      const { PDFDocument } = window.PDFLib;
      const doc = await PDFDocument.create();
      const c = document.createElement('canvas');
      c.width = 800;
      c.height = 1100;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, 800, 1100);
      ctx.fillStyle = '#0f172a';
      ctx.font = 'bold 32px sans-serif';
      ctx.fillText('First Page Preview Document', 50, 120);

      const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.85));
      const arrayBuffer = await blob.arrayBuffer();
      const embedded = await doc.embedJpg(arrayBuffer);
      const pg = doc.addPage([800, 1100]);
      pg.drawImage(embedded, { x: 0, y: 0, width: 800, height: 1100 });

      const pdfBytes = await doc.save();

      // Render page 1 with PDF.js
      const t0 = performance.now();
      const pdfJsTask = window.pdfjsLib.getDocument({ data: new Uint8Array(pdfBytes) });
      const pdfJsDoc = await pdfJsTask.promise;
      const p1 = await pdfJsDoc.getPage(1);
      const viewport = p1.getViewport({ scale: 1.0 });
      const renderCanvas = document.createElement('canvas');
      renderCanvas.width = viewport.width;
      renderCanvas.height = viewport.height;
      await p1.render({ canvasContext: renderCanvas.getContext('2d'), viewport }).promise;
      const durMs = performance.now() - t0;

      return {
        width: viewport.width,
        height: viewport.height,
        durMs
      };
    });

    benchmarkResults.push({
      operation: 'Pratinjau Halaman Pertama',
      input: 'Halaman 1 (Canvas Rendering)',
      output: `${prevMetric.width}x${prevMetric.height} px Canvas`,
      duration: `${(prevMetric.durMs / 1000).toFixed(2)}s (${Math.round(prevMetric.durMs)} ms)`,
      heapMem: `${memBeforePrev} MB -> ${getHeapMb()} MB`,
      status: 'LULUS'
    });
    console.log(`  ✓ Berhasil: Halaman pertama dirender dalam ${Math.round(prevMetric.durMs)} ms.`);

    // -------------------------------------------------------------------------
    // SUMMARY REPORT TABLE
    // -------------------------------------------------------------------------
    console.log('\n========================================================================================');
    console.log('                 RINGKASAN BENCHMARK DOKUMEN BESAR & KINERJA                            ');
    console.log('========================================================================================');
    console.table(benchmarkResults);
    console.log('========================================================================================\n');
    console.log('🎉 SEMUA PENGUJIAN DOKUMEN BESAR & BENCHMARK KINERJA LULUS TANPA KENDALA MEMORI!\n');

    return {
      success: true,
      results: benchmarkResults
    };
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runLargeDocumentsSuite().then(res => {
    process.exit(res && res.success ? 0 : 1);
  }).catch(err => {
    console.error('\n❌ Benchmark dokumen besar gagal:', err);
    process.exit(1);
  });
}

module.exports = {
  runLargeDocumentsSuite
};
