const { chromium } = require('playwright');
const { startTestServer } = require('./helpers');
const { runStudioRedactionTests } = require('./test_studio_redaction');
const { runSkippedToolsTests } = require('./test_skipped_tools');
const { runCompressEffectivenessTest } = require('./test_compress_effectiveness');

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
