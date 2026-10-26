const { chromium } = require('playwright');
const { startTestServer } = require('./helpers');
const { runStudioRedactionTests } = require('./test_studio_redaction');
const { runSkippedToolsTests } = require('./test_skipped_tools');
const { runCompressEffectivenessTest } = require('./test_compress_effectiveness');
const { testAllPagesForErrors } = require('./test_page_errors');
const { runOcrEnvironmentTests } = require('./test_ocr_environments');
const { runPageWeightSuite } = require('./test_page_weight');
const { runMobileHeaderSuite } = require('./test_mobile_header');
const { runMobileInteractionSuite } = require('./test_mobile_interaction');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function main() {
  console.log('========================================================================');
  console.log('         PLAYWRIGHT BROWSER AUTOMATION TEST SUITE (OFFLINE PDF)         ');
  console.log('========================================================================');
  console.log(`Starting standalone local test server at ${BASE_URL}...`);

  let server;
  let browser;

  try {
    server = await startTestServer(TEST_PORT);
    console.log(`Test server is active on ${BASE_URL}`);

    console.log('Launching Playwright Chromium browser...');
    browser = await chromium.launch({
      headless: true
    });
    console.log('Browser launched successfully.');

    // 1. PDF Studio Redaction Tests (Normal & /Rotate 90)
    await runStudioRedactionTests(browser, BASE_URL);

    // 2. Previously Skipped Tools Audit (DOCX, XLSX, JPG, Grayscale, OCR, Sign)
    await runSkippedToolsTests(browser, BASE_URL);

    // 3. Measure Compress Effectiveness on Photo PDF (Extreme, Recommended, Less)
    await runCompressEffectivenessTest(browser, BASE_URL);

    // 4. Page Console & Runtime Error Audit across all HTML pages
    const auditPassed = await testAllPagesForErrors(browser, BASE_URL);
    if (!auditPassed) {
      throw new Error('Audit kegagalan konsol / pageerror pada halaman HTML gagal!');
    }

    // 5. OCR Environments Test (Local HTTP & Direct file:///, with optional live site)
    const ocrResults = await runOcrEnvironmentTests(browser, BASE_URL);
    const ocrFailed = ocrResults && ocrResults.some(r => r.status !== 'BERHASIL');
    if (ocrFailed) {
      throw new Error('Satu atau lebih skenario pengujian lingkungan OCR gagal!');
    }

    // 6. Page Weight & On-Demand OCR Lazy Loading Audit
    const weightResult = await runPageWeightSuite(browser, BASE_URL);
    if (!weightResult || !weightResult.success) {
      throw new Error('Audit beban unduhan halaman dan lazy loading OCR gagal!');
    }

    // 7. Mobile Responsive Header & Navigation Audit across breakpoints
    const headerResult = await runMobileHeaderSuite(browser, server);
    if (!headerResult || !headerResult.success) {
      throw new Error(`Audit header dan navigasi seluler gagal dengan ${headerResult ? headerResult.failures.length : 0} kegagalan!`);
    }

    // 8. Mobile Touch Drag vs Vertical Scroll Interaction Audit
    const interactionResult = await runMobileInteractionSuite(browser, BASE_URL);
    if (!interactionResult || !interactionResult.success) {
      throw new Error('Audit interaksi sentuh seluler (scroll vs drag reorder) gagal!');
    }

    console.log('========================================================================');
    console.log('                 BROWSER TESTS COMPLETE: ALL PASSED!                   ');
    console.log('========================================================================\n');
    process.exitCode = 0;
  } catch (err) {
    console.error('\n❌ [FAIL] Browser test failed with error:');
    console.error(err);
    process.exitCode = 1;
  } finally {
    if (browser) {
      console.log('Closing browser...');
      await browser.close();
    }
    if (server) {
      console.log('Stopping test server...');
      server.close();
    }
  }
}

main();
