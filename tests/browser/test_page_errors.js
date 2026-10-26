const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { startTestServer } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const REPO_ROOT = path.resolve(__dirname, '../..');

async function testAllPagesForErrors() {
  console.log('========================================================================');
  console.log('      PAGE CONSOLE & RUNTIME ERROR AUDIT (ALL HTML PAGES)              ');
  console.log('========================================================================\n');

  const pagesDir = path.resolve(REPO_ROOT, 'pages');
  const pageFiles = fs.readdirSync(pagesDir).filter(f => f.endsWith('.html')).map(f => `pages/${f}`);
  const allPages = ['index.html', ...pageFiles];

  console.log(`Found ${allPages.length} pages to audit.`);

  let server;
  let browser;
  const failureReports = [];

  try {
    server = await startTestServer(TEST_PORT);
    browser = await chromium.launch({ headless: true });

    for (const pagePath of allPages) {
      const pageUrl = `${BASE_URL}/${pagePath}`;
      const context = await browser.newContext();
      const page = await context.newPage();

      const pageErrors = [];
      const consoleErrors = [];

      page.on('pageerror', err => {
        pageErrors.push(err.message || String(err));
      });

      page.on('console', msg => {
        if (msg.type() === 'error') {
          consoleErrors.push(msg.text());
        }
      });

      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
        // Give scripts time to execute inline logic
        await page.waitForTimeout(500);
      } catch (navErr) {
        pageErrors.push(`Navigation error: ${navErr.message}`);
      }

      const hasError = pageErrors.length > 0 || consoleErrors.length > 0;
      if (hasError) {
        console.log(`  ✗ [FAIL] ${pagePath}:`);
        if (pageErrors.length > 0) {
          console.log(`     - Page Errors: ${pageErrors.join(' | ')}`);
        }
        if (consoleErrors.length > 0) {
          console.log(`     - Console Errors: ${consoleErrors.join(' | ')}`);
        }
        failureReports.push({
          page: pagePath,
          pageErrors,
          consoleErrors
        });
      } else {
        console.log(`  ✓ [PASS] ${pagePath}`);
      }

      await page.close();
      await context.close();
    }
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }

  console.log('\n========================================================================');
  console.log('                            AUDIT SUMMARY                              ');
  console.log('========================================================================');
  if (failureReports.length > 0) {
    console.error(`❌ Ditemukan kesalahan pada ${failureReports.length} dari ${allPages.length} halaman:`);
    for (const f of failureReports) {
      console.error(`\n• [${f.page}]`);
      if (f.pageErrors.length > 0) {
        console.error(`  - Uncaught Page Errors: ${f.pageErrors.join('; ')}`);
      }
      if (f.consoleErrors.length > 0) {
        console.error(`  - Console Errors: ${f.consoleErrors.join('; ')}`);
      }
    }
    return false;
  } else {
    console.log(`✔ Semua ${allPages.length} halaman bebas dari pageerror dan console.error!`);
    return true;
  }
}

if (require.main === module) {
  testAllPagesForErrors().then(passed => {
    process.exit(passed ? 0 : 1);
  }).catch(err => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
  });
}

module.exports = { testAllPagesForErrors };
