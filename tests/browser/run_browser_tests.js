const fs = require('fs');
const path = require('path');
const { devices } = require('playwright');
const { startTestServer } = require('./helpers');
const { launchChromium } = require('./helpers/launch');
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
const { runRotationOpacitySuite, runRotationOpacityWebKitMobile } = require('./test_watermark_rotation_opacity');
const { runMergeSizeBrowserSuite } = require('./test_merge_size_browser');
const { runPasswordModalSuite } = require('./test_password_modal');
const { runNodeMergeSignedTest, runMutationCheck, runMergeSignedBrowserSuite } = require('../test_merge_signed');
const { runI18nBrowserSuite } = require('../test_i18n_locale');
const { runOcrDefaultLangSuite } = require('./test_ocr_default_lang');
const { runWatermarkPreviewSuite } = require('../test_watermark_preview');
const { run: runLaunchHelperTest } = require('../test_launch_helper');
const { runSignFlowSuite } = require('./test_sign_flow');
const { runA11ySuite } = require('./test_a11y_axe');
const { runPageDropSuite } = require('./test_page_drop');

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
    browser = await launchChromium({
      headless: true
    });
    console.log('Browser launched successfully.');

    let totalSkippedWebKit = 0;

    const suites = [
      {
        name: 'PDF Studio Redaction Tests',
        run: async () => {
          await runStudioRedactionTests(browser, BASE_URL);
        }
      },
      {
        name: 'Previously Skipped Tools Audit',
        run: async () => {
          await runSkippedToolsTests(browser, BASE_URL);
        }
      },
      {
        name: 'Measure Compress Effectiveness on Photo PDF',
        run: async () => {
          await runCompressEffectivenessTest(browser, BASE_URL);
        }
      },
      {
        name: 'Page Console & Runtime Error Audit',
        run: async () => {
          const auditPassed = await testAllPagesForErrors(browser, BASE_URL);
          if (!auditPassed) {
            throw new Error('Audit kegagalan konsol / pageerror pada halaman HTML gagal!');
          }
        }
      },
      {
        name: 'OCR Environments Test',
        run: async () => {
          const ocrResults = await runOcrEnvironmentTests(browser, BASE_URL);
          const ocrFailed = ocrResults && ocrResults.some(r => r.status !== 'BERHASIL');
          if (ocrFailed) {
            throw new Error('Satu atau lebih skenario pengujian lingkungan OCR gagal!');
          }
        }
      },
      {
        name: 'Page Weight & On-Demand OCR Lazy Loading Audit',
        run: async () => {
          const weightResult = await runPageWeightSuite(browser, BASE_URL);
          if (!weightResult || !weightResult.success) {
            throw new Error('Audit beban unduhan halaman dan lazy loading OCR gagal!');
          }
        }
      },
      {
        name: 'Mobile Responsive Header & Navigation Audit',
        run: async () => {
          const headerResult = await runMobileHeaderSuite(browser, server);
          if (!headerResult || !headerResult.success) {
            throw new Error(`Audit header dan navigasi seluler gagal dengan ${headerResult ? headerResult.failures.length : 0} kegagalan!`);
          }
          if (headerResult.skippedWebKit > 0) totalSkippedWebKit += headerResult.skippedWebKit;
        }
      },
      {
        name: 'Mobile Touch Drag vs Vertical Scroll Interaction Audit',
        run: async () => {
          const interactionResult = await runMobileInteractionSuite(browser, BASE_URL);
          if (!interactionResult || !interactionResult.success) {
            throw new Error('Audit interaksi sentuh seluler (scroll vs drag reorder) gagal!');
          }
          if (interactionResult.skippedWebKit > 0) totalSkippedWebKit += interactionResult.skippedWebKit;
        }
      },
      {
        name: 'Mobile iPhone 13 Audit: Zero Horizontal Overflow & Errors',
        run: async () => {
          const mobileAuditResult = await runMobileOverflowAndConsoleAudit(browser, BASE_URL);
          if (!mobileAuditResult || !mobileAuditResult.success) {
            throw new Error('Audit mobile iPhone 13 (horizontal overflow / console error) gagal!');
          }
        }
      },
      {
        name: 'Watermark Image & Multi-orientation Tests',
        run: async () => {
          await runNodeWatermarkImageTests();
          await runWatermarkImageBrowserTests(browser, BASE_URL);
        }
      },
      {
        name: 'Watermark Image UI Suite & iPhone 13 WebKit Mobile Verification',
        run: async () => {
          await runWatermarkUiSuite(browser, BASE_URL);
          const wmUiRes = await runWatermarkUiWebKitMobile(BASE_URL);
          if (wmUiRes?.skippedWebKit > 0) totalSkippedWebKit += wmUiRes.skippedWebKit;
        }
      },
      {
        name: 'Watermark Rotation & Opacity Unified Controls Suite',
        run: async () => {
          await runRotationOpacitySuite(browser, BASE_URL);
          const wmRotRes = await runRotationOpacityWebKitMobile(BASE_URL);
          if (wmRotRes?.skippedWebKit > 0) totalSkippedWebKit += wmRotRes.skippedWebKit;
        }
      },
      {
        name: 'Merge Size Optimization & UI Reordering Suite',
        run: async () => {
          const mergeRes = await runMergeSizeBrowserSuite(browser, BASE_URL);
          if (mergeRes?.skippedWebKit > 0) totalSkippedWebKit += mergeRes.skippedWebKit;
        }
      },
      {
        name: 'Password Modal & Protected PDF Suite',
        run: async () => {
          const passRes = await runPasswordModalSuite(browser, BASE_URL);
          if (passRes?.skippedWebKit > 0) totalSkippedWebKit += passRes.skippedWebKit;
        }
      },
      {
        name: 'Digitally Signed PDF Merging & Stamp Conversion',
        run: async () => {
          await runNodeMergeSignedTest();
          await runMutationCheck();
          const signedRes = await runMergeSignedBrowserSuite(browser, BASE_URL);
          if (signedRes?.skippedWebKit > 0) totalSkippedWebKit += signedRes.skippedWebKit;
        }
      },
      {
        name: 'Watermark Preview & Pixel Identity Verification',
        run: async () => {
          await runWatermarkPreviewSuite();
        }
      },
      {
        name: 'i18n Locale Detection, Storage Persistence & Mobile Drawer Navigation',
        run: async () => {
          await runI18nBrowserSuite(browser, BASE_URL);
        }
      },
      {
        name: 'Browser Launch Helper & Fallback Audit',
        run: async () => {
          await runLaunchHelperTest();
        }
      },
      {
        id: 'sign',
        name: 'Sign PDF Flow, Interaction & Digital Signature Sanitization',
        run: async () => {
          const signRes = await runSignFlowSuite(browser, BASE_URL);
          if (signRes?.skippedWebKit > 0) totalSkippedWebKit += signRes.skippedWebKit;
        }
      },
      {
        id: 'ocrlang',
        name: 'OCR Default Language Follows UI Language',
        run: async () => {
          const res = await runOcrDefaultLangSuite(browser, BASE_URL);
          if (!res || !res.success) throw new Error('OCR default language suite gagal: ' + ((res && res.failures) || []).join(' | '));
        }
      },
      {
        id: 'a11y',
        name: 'Automated Axe-Core Accessibility & Dialog Focus Suite',
        run: async () => {
          await runA11ySuite(browser, BASE_URL);
        }
      },
      {
        id: 'pagedrop',
        name: 'Whole Page Drag & Drop (PageDrop) Across All Tools',
        run: async () => {
          await runPageDropSuite(browser, BASE_URL);
        }
      }
    ];

    // Filter by --only argument if provided
    let targetSuites = suites;
    const onlyArg = process.argv.find(a => a.startsWith('--only=') || a === '--only');
    let onlyFilter = null;
    if (onlyArg) {
      if (onlyArg.startsWith('--only=')) {
        onlyFilter = onlyArg.split('=')[1].trim().toLowerCase();
      } else {
        const idx = process.argv.indexOf('--only');
        if (idx >= 0 && idx + 1 < process.argv.length) {
          onlyFilter = process.argv[idx + 1].trim().toLowerCase();
        }
      }
    }
    if (onlyFilter) {
      targetSuites = suites.filter(s =>
        (s.id && s.id.toLowerCase() === onlyFilter) ||
        s.name.toLowerCase().includes(onlyFilter)
      );
      console.log(`Menjalankan hanya suite dengan filter: "${onlyFilter}" (${targetSuites.length} suite ditemukan)\n`);
    }

    const suiteResults = [];

    for (const suite of targetSuites) {
      console.log(`\n========================================================================`);
      console.log(`>>> [BROWSER SUITE] ${suite.name}`);
      console.log(`========================================================================`);

      const t0 = Date.now();
      let status = 'lulus';
      let errObj = null;

      try {
        await suite.run();
        console.log(`\n✅ [PASS] ${suite.name}`);
      } catch (err) {
        status = 'gagal';
        errObj = err;
        console.error(`\n❌ [FAIL] ${suite.name} gagal dengan error:`, err.message || err);
      }

      const durationSec = ((Date.now() - t0) / 1000).toFixed(2);
      suiteResults.push({
        name: suite.name,
        status,
        duration: `${durationSec}s`,
        durationRaw: (Date.now() - t0) / 1000,
        error: errObj
      });
    }

    const summary = formatAndEvaluateSummary(suiteResults, totalSkippedWebKit);
    process.exitCode = summary.exitCode;

  } catch (err) {
    console.error('\n❌ [FATAL ERROR] Gagal memulai browser / test server:');
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

function formatAndEvaluateSummary(suiteResults, totalSkippedWebKit = 0, logger = console) {
  logger.log('\n========================================================================================');
  logger.log('                          RINGKASAN HASIL TEST BROWSER                                  ');
  logger.log('========================================================================================');

  const formattedTable = suiteResults.map(r => ({
    'Nama Suite': r.name,
    'Status': r.status === 'lulus' ? 'LULUS' : (r.status === 'dilewati' ? 'DILEWATI' : 'GAGAL'),
    'Durasi': r.duration
  }));

  if (logger && typeof logger.table === 'function') {
    logger.table(formattedTable);
  }

  const failures = suiteResults.filter(r => r.status === 'gagal');
  const passedCount = suiteResults.filter(r => r.status === 'lulus').length;
  const skippedCount = suiteResults.filter(r => r.status === 'dilewati').length;

  logger.log(`Total: ${suiteResults.length} suite | ${passedCount} lulus | ${failures.length} gagal | ${skippedCount} dilewati`);
  if (totalSkippedWebKit > 0) {
    logger.log(`(Total skenario WebKit dilewati lokal: ${totalSkippedWebKit})`);
  }
  logger.log('========================================================================================\n');

  let exitCode = 0;
  if (failures.length > 0) {
    logger.error(`💥 ${failures.length} SUITE BROWSER GAGAL:`);
    for (const f of failures) {
      logger.error(`  - ${f.name}: ${f.error ? (f.error.message || f.error) : 'Unknown error'}`);
    }
    exitCode = 1;
  } else {
    logger.log('🎉 SEMUA BROWSER TEST SUITE LULUS LENGKAP!');
    exitCode = 0;
  }

  return {
    exitCode,
    failures,
    passedCount,
    skippedCount,
    totalCount: suiteResults.length,
    formattedTable
  };
}

module.exports = {
  main,
  formatAndEvaluateSummary
};

if (require.main === module) {
  main();
}
