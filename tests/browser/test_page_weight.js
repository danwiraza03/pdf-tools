const path = require('path');
const { chromium } = require('playwright');
const { startTestServer } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

/**
 * Measures the total network transfer weight (in bytes) when loading a page,
 * and tracks all requested resources from js/lib/tesseract/.
 */
async function measurePageWeight(browser, pagePath) {
  const context = await browser.newContext();
  const page = await context.newPage();

  let totalBytes = 0;
  const requests = [];
  const tesseractRequests = [];

  page.on('response', async (response) => {
    const url = response.url();
    let bodySize = 0;
    try {
      const buffer = await response.body();
      bodySize = buffer.length;
    } catch (e) {
      const headers = response.headers();
      bodySize = parseInt(headers['content-length'] || '0', 10);
    }

    totalBytes += bodySize;
    requests.push({ url, status: response.status(), size: bodySize });

    if (url.includes('js/lib/tesseract/')) {
      tesseractRequests.push({ url, size: bodySize });
    }
  });

  const fullUrl = `${BASE_URL}/${pagePath}`;
  await page.goto(fullUrl, { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(500);

  await page.close();
  await context.close();

  return {
    page: pagePath,
    totalBytes,
    totalMB: (totalBytes / (1024 * 1024)).toFixed(2),
    requestCount: requests.length,
    tesseractRequests
  };
}

/**
 * Tests dynamic loading behavior during OCR execution:
 * - Running OCR with 'ind' only loads tesseract bundle & ind.js, NOT eng.js
 * - Running OCR a second time does not re-download scripts
 */
async function testDynamicOcrLoading(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  const downloadedScripts = [];

  page.on('response', (response) => {
    const url = response.url();
    if (url.includes('js/lib/tesseract/')) {
      downloadedScripts.push(url.split('/').pop());
    }
  });

  await page.goto(`${BASE_URL}/pages/ocr.html`, { waitUntil: 'networkidle', timeout: 30000 });

  const initialTesseractDownloads = [...downloadedScripts];

  // Helper to trigger OCR on dummy canvas
  async function triggerOcr(lang) {
    return await page.evaluate(async (targetLang) => {
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 60;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 200, 60);
      ctx.fillStyle = '#000000';
      ctx.font = '20px sans-serif';
      ctx.fillText('TEST', 10, 40);

      const res = await window.PDFTools.OCR.recognizeCanvas(canvas, targetLang);
      return res;
    }, lang);
  }

  // 1. Run first time with 'ind'
  await triggerOcr('ind');
  const afterFirstOcrDownloads = [...downloadedScripts];

  // 2. Run second time with 'ind'
  await triggerOcr('ind');
  const afterSecondOcrDownloads = [...downloadedScripts];

  await page.close();
  await context.close();

  return {
    initialTesseractDownloads,
    afterFirstOcrDownloads,
    afterSecondOcrDownloads
  };
}

async function runPageWeightSuite(passedBrowser = null, passedBaseUrl = null) {
  console.log('========================================================================');
  console.log('               PAGE WEIGHT & ON-DEMAND OCR AUDIT                        ');
  console.log('========================================================================\n');

  let server = null;
  let browser = passedBrowser;
  const targetPages = ['index.html', 'pages/viewer.html', 'pages/ocr.html'];
  const metrics = [];

  try {
    if (!browser) {
      server = await startTestServer(TEST_PORT);
      browser = await chromium.launch({ headless: true });
    }

    console.log('Measuring initial load weight for target pages (without OCR activity)...');
    for (const p of targetPages) {
      const res = await measurePageWeight(browser, p);
      metrics.push(res);
      console.log(`  • ${res.page.padEnd(20)}: ${res.totalBytes.toLocaleString('id-ID')} bytes (${res.totalMB} MB) across ${res.requestCount} requests.`);
      if (res.tesseractRequests.length > 0) {
        console.log(`    ⚠ Tesseract files loaded immediately on page load:`);
        res.tesseractRequests.forEach(r => console.log(`      - ${r.url.split('/').pop()} (${(r.size / 1024 / 1024).toFixed(2)} MB)`));
      } else {
        console.log(`    ✓ Zero Tesseract files loaded on initial page load.`);
      }
    }

    // Check if initial page loads triggered Tesseract downloads
    const prematureTesseractLoads = metrics.filter(m => (m.page === 'pages/viewer.html' || m.page === 'pages/ocr.html') && m.tesseractRequests.length > 0);

    console.log('\n========================================================================');
    console.log('                        PAGE WEIGHT SUMMARY                             ');
    console.log('========================================================================');
    console.log('| Halaman            | Total Ukuran (Bytes) | Ukuran (MB) | Tesseract Preloaded? |');
    console.log('------------------------------------------------------------------------');
    for (const m of metrics) {
      const hasTess = m.tesseractRequests.length > 0 ? `YA (${m.tesseractRequests.length} berkas)` : 'TIDAK (0 berkas)';
      console.log(`| ${m.page.padEnd(18)} | ${m.totalBytes.toLocaleString('id-ID').padEnd(20)} | ${(m.totalMB + ' MB').padEnd(11)} | ${hasTess.padEnd(20)} |`);
    }
    console.log('========================================================================\n');

    if (prematureTesseractLoads.length > 0) {
      console.error('❌ GAGAL: viewer.html dan/atau ocr.html mengunduh file tesseract sebelum OCR digunakan!');
      return { success: false, metrics };
    }

    // Now test dynamic OCR loading
    console.log('Testing dynamic on-demand loading during OCR execution...');
    const dynamicRes = await testDynamicOcrLoading(browser);

    const initialLoads = dynamicRes.initialTesseractDownloads;
    if (initialLoads.length > 0) {
      console.error('❌ GAGAL: File tesseract terunduh pada saat inisialisasi halaman!', initialLoads);
      return { success: false, metrics };
    }

    const firstRunLoads = dynamicRes.afterFirstOcrDownloads;
    console.log('  Files loaded after 1st OCR run ("ind"):', firstRunLoads);

    // Verify eng.js was NOT loaded when running 'ind'
    if (firstRunLoads.some(f => f.includes('eng.js') || f.includes('eng.traineddata'))) {
      console.error('❌ GAGAL: Model bahasa eng.js ikut terunduh padahal hanya bahasa "ind" yang dipilih!');
      return { success: false, metrics };
    }

    // Verify bundle and ind.js were loaded
    if (!firstRunLoads.some(f => f.includes('tesseract-worker.bundle.js')) || !firstRunLoads.some(f => f.includes('ind.js'))) {
      console.error('❌ GAGAL: Bundel worker dan/atau ind.js tidak terunduh saat OCR bahasa "ind" dijalankan!');
      return { success: false, metrics };
    }

    // Verify 2nd run did not re-download scripts
    const secondRunCount = dynamicRes.afterSecondOcrDownloads.length;
    if (secondRunCount !== firstRunLoads.length) {
      console.error(`❌ GAGAL: OCR kedua kali mengunduh ulang berkas! (Pertama: ${firstRunLoads.length}, Kedua: ${secondRunCount})`);
      return { success: false, metrics };
    }

    console.log('✓ Dynamic on-demand loading verified: zero premature downloads, specific language only, zero duplicate downloads.');
    return { success: true, metrics };
  } finally {
    if (!passedBrowser && browser) await browser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runPageWeightSuite().then(res => {
    process.exit(res && res.success ? 0 : 1);
  }).catch(err => {
    console.error('Fatal error during page weight test:', err);
    process.exit(1);
  });
}

module.exports = { runPageWeightSuite, measurePageWeight };
