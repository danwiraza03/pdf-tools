const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const { startTestServer } = require('./helpers');
const { runStudioRedactionTests } = require('./test_studio_redaction');
const { runSkippedToolsTests } = require('./test_skipped_tools');
const { runCompressEffectivenessTest } = require('./test_compress_effectiveness');
const { testAllPagesForErrors } = require('./test_page_errors');
const { runOcrEnvironmentTests } = require('./test_ocr_environments');
const { runPageWeightSuite } = require('./test_page_weight');
const { runMobileHeaderSuite } = require('./test_mobile_header');
const { runMobileInteractionSuite } = require('./test_mobile_interaction');
const { runWatermarkImageBrowserTests, runNodeWatermarkImageTests } = require('./test_watermark_image');
const { runWatermarkUiSuite, runWatermarkUiWebKitMobile } = require('./test_watermark_ui');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

async function runMobileOverflowAndConsoleAudit(browser, baseUrl) {
  console.log('========================================================================');
  console.log('      MOBILE IPHONE 13 AUDIT: ZERO HORIZONTAL OVERFLOW & CONSOLE ERRORS ');
  console.log('========================================================================\n');

  const pagesDir = path.resolve(__dirname, '../../pages');
  const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html') && f !== 'viewer.html').map(f => `pages/${f}`);
  pageFiles.unshift('index.html');

  const context = await browser.newContext({
    ...devices['iPhone 13'],
    hasTouch: true
  });

  const failures = [];

  for (const pagePath of pageFiles) {
    const page = await context.newPage();
    const consoleErrors = [];
    const pageErrors = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    page.on('pageerror', err => {
      pageErrors.push(err.message || String(err));
    });

    try {
      await page.goto(`${baseUrl}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForTimeout(200);

      const overflow = await page.evaluate(() => {
        const scrollW = document.documentElement.scrollWidth;
        const innerW = window.innerWidth;
        return {
          scrollWidth: scrollW,
          innerWidth: innerW,
          hasOverflow: scrollW > innerW,
          diff: Math.max(0, scrollW - innerW)
        };
      });

      if (overflow.hasOverflow) {
        failures.push(`${pagePath}: Horizontal overflow terdeteksi (${overflow.scrollWidth}px > ${overflow.innerWidth}px, selisih ${overflow.diff}px)`);
        console.log(`  ✗ [FAIL OVERFLOW] ${pagePath} (${overflow.scrollWidth}px > ${overflow.innerWidth}px)`);
      } else if (consoleErrors.length > 0 || pageErrors.length > 0) {
        failures.push(`${pagePath}: Error konsol / runtime terdeteksi (${consoleErrors.length + pageErrors.length} errors)`);
        console.log(`  ✗ [FAIL CONSOLE] ${pagePath}: ${consoleErrors.concat(pageErrors).join(' | ')}`);
      } else {
        console.log(`  ✓ [PASS] ${pagePath} (docWidth: ${overflow.scrollWidth}px, innerWidth: ${overflow.innerWidth}px, 0 errors)`);
      }
    } catch (err) {
      failures.push(`${pagePath}: Gagal memuat (${err.message})`);
      console.log(`  ✗ [LOAD ERROR] ${pagePath}: ${err.message}`);
    } finally {
      await page.close();
    }
  }

  await context.close();

  if (failures.length > 0) {
    console.error(`\n❌ Total kegagalan audit mobile iPhone 13: ${failures.length}`);
    return { success: false, failures };
  }

  console.log(`\n✔ Seluruh ${pageFiles.length} halaman non-Studio lolos: Bebas overflow horizontal dan bebas error konsol di iPhone 13!\n`);
  return { success: true, failures: [] };
}

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

    // 9. Mobile iPhone 13 Audit: Zero Horizontal Overflow & Zero Console Errors
    const mobileAuditResult = await runMobileOverflowAndConsoleAudit(browser, BASE_URL);
    if (!mobileAuditResult || !mobileAuditResult.success) {
      throw new Error('Audit mobile iPhone 13 (horizontal overflow / console error) gagal!');
    }

    // 10. Watermark Image & Multi-orientation Tests (Single embed, 90 combinations & Mutation Check)
    await runNodeWatermarkImageTests();
    await runWatermarkImageBrowserTests(browser, BASE_URL);

    // 11. Watermark Image UI Suite & iPhone 13 WebKit Mobile Verification
    await runWatermarkUiSuite(browser, BASE_URL);
    await runWatermarkUiWebKitMobile(BASE_URL);

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
