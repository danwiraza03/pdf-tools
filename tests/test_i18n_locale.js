/**
 * Automated Test: i18n Locale Detection, Storage Persistence & Mobile Drawer Navigation
 *
 * Verifies:
 * 1. Locale detection order:
 *    - localStorage 'pdftools-lang' takes precedence.
 *    - Otherwise, navigator.language starting with "id" -> 'id'.
 *    - Otherwise -> 'en'.
 *    - <html lang="..."> attribute matches active language before first render.
 * 2. Manual language choice persists across reloads.
 * 3. Mobile menu drawer links and section titles are fully translated in both id and en.
 * 4. "PDF Tools (DN.)" in drawer title is preserved.
 */

'use strict';

const path = require('path');
const assert = require('assert');
const { startTestServer } = require('./browser/helpers');
const { launchChromium } = require('./browser/helpers/launch');

const PORT = 8990;

async function runI18nBrowserSuite(existingBrowser, existingBaseUrl) {
  console.log('========================================================================');
  console.log('>>> [TEST] i18n Locale Detection, Persistence & Mobile Drawer');
  console.log('========================================================================');

  let server;
  let browser = existingBrowser;
  let baseUrl = existingBaseUrl;

  try {
    if (!browser || !baseUrl) {
      server = await startTestServer(PORT);
      baseUrl = `http://127.0.0.1:${PORT}`;
      browser = await launchChromium({ headless: true });
    }

    // --- TEST 1: Locale en-US without localStorage -> should be 'en' ---
    console.log('\n--- 1. Testing Default Locale en-US (no localStorage) ---');
    {
      const context = await browser.newContext({
        locale: 'en-US'
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      const langAttr = await page.evaluate(() => document.documentElement.lang);
      const activeLang = await page.evaluate(() => window.PDFTools && window.PDFTools.i18n && window.PDFTools.i18n.getLang());
      
      console.log(`  en-US -> html.lang: "${langAttr}", activeLang: "${activeLang}"`);
      assert.strictEqual(activeLang, 'en', `Expected active language to be 'en' for locale en-US, got '${activeLang}'`);
      assert.strictEqual(langAttr, 'en', `Expected <html lang="en">, got '${langAttr}'`);
      
      await context.close();
      console.log('  ✓ en-US correctly initialized to English ("en").');
    }

    // --- TEST 2: Locale id-ID without localStorage -> should be 'id' ---
    console.log('\n--- 2. Testing Default Locale id-ID (no localStorage) ---');
    {
      const context = await browser.newContext({
        locale: 'id-ID'
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      const langAttr = await page.evaluate(() => document.documentElement.lang);
      const activeLang = await page.evaluate(() => window.PDFTools && window.PDFTools.i18n && window.PDFTools.i18n.getLang());

      console.log(`  id-ID -> html.lang: "${langAttr}", activeLang: "${activeLang}"`);
      assert.strictEqual(activeLang, 'id', `Expected active language to be 'id' for locale id-ID, got '${activeLang}'`);
      assert.strictEqual(langAttr, 'id', `Expected <html lang="id">, got '${langAttr}'`);

      await context.close();
      console.log('  ✓ id-ID correctly initialized to Indonesian ("id").');
    }

    // --- TEST 3: Manual selection stored in localStorage persists on reload ---
    console.log('\n--- 3. Testing Manual Selection Persistence across Reload ---');
    {
      const context = await browser.newContext({
        locale: 'id-ID'
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      // Set manual language to 'en'
      await page.evaluate(() => {
        window.PDFTools.i18n.setLang('en');
      });

      // Reload page
      await page.reload({ waitUntil: 'domcontentloaded' });

      const reloadedLang = await page.evaluate(() => window.PDFTools.i18n.getLang());
      const reloadedHtmlLang = await page.evaluate(() => document.documentElement.lang);

      assert.strictEqual(reloadedLang, 'en', `Manual choice 'en' must persist after reload despite id-ID locale, got '${reloadedLang}'`);
      assert.strictEqual(reloadedHtmlLang, 'en', `html.lang must be 'en', got '${reloadedHtmlLang}'`);

      // Now set manual language to 'id'
      await page.evaluate(() => {
        window.PDFTools.i18n.setLang('id');
      });
      await page.reload({ waitUntil: 'domcontentloaded' });

      const reloadedLangId = await page.evaluate(() => window.PDFTools.i18n.getLang());
      assert.strictEqual(reloadedLangId, 'id', `Manual choice 'id' must persist after reload, got '${reloadedLangId}'`);

      await context.close();
      console.log('  ✓ Manual selection persists across page reload regardless of browser locale.');
    }

    // --- TEST 4: Mobile Nav Drawer Links & Sections Translation ---
    console.log('\n--- 4. Testing Mobile Nav Drawer Translation (id & en) ---');
    {
      const context = await browser.newContext({
        viewport: { width: 375, height: 667 },
        locale: 'en-US'
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      // Click mobile hamburger menu to open drawer
      const menuBtn = page.locator('#mobileMenuBtn');
      await menuBtn.click();
      await page.waitForSelector('#mobileNavDrawer.open', { state: 'visible', timeout: 3000 });

      // Check drawer title is preserved: "PDF Tools (DN.)"
      const drawerTitle = await page.locator('.mobile-nav-title').textContent();
      assert.strictEqual(drawerTitle.trim(), 'PDF Tools (DN.)', 'Drawer title must be "PDF Tools (DN.)"');
      console.log('  ✓ Drawer title preserved as "PDF Tools (DN.)".');

      // Test English mobile drawer labels
      await page.evaluate(() => window.PDFTools.i18n.setLang('en'));
      
      const enSections = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.mobile-nav-section')).map(s => s.textContent.trim());
      });
      const enPdfToWord = await page.evaluate(() => {
        const link = document.querySelector('a.mobile-nav-link[href*="pdf-to-docx"]');
        return link ? link.textContent.trim() : null;
      });

      console.log('  [EN Sections]:', enSections);
      console.log('  [EN PDF to Word]:', enPdfToWord);

      assert.deepStrictEqual(enSections, ['Convert', 'Edit & Organize', 'Security & Tools']);
      assert.strictEqual(enPdfToWord, 'PDF to Word');

      // Test Indonesian mobile drawer labels
      await page.evaluate(() => window.PDFTools.i18n.setLang('id'));

      const idSections = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.mobile-nav-section')).map(s => s.textContent.trim());
      });
      const idPdfToWord = await page.evaluate(() => {
        const link = document.querySelector('a.mobile-nav-link[href*="pdf-to-docx"]');
        return link ? link.textContent.trim() : null;
      });

      console.log('  [ID Sections]:', idSections);
      console.log('  [ID PDF to Word]:', idPdfToWord);

      assert.deepStrictEqual(idSections, ['Konversi', 'Edit & Atur', 'Keamanan & Alat'], `Expected Indonesian sections, got: ${JSON.stringify(idSections)}`);
      assert.strictEqual(idPdfToWord, 'PDF ke Word', `Expected 'PDF ke Word', got '${idPdfToWord}'`);

      await context.close();
      console.log('  ✓ Mobile nav drawer links & section titles properly translated in Indonesian and English.');
    }

    console.log('\n========================================================================');
    console.log('✅ [ALL PASSED] i18n Locale, Persistence & Mobile Drawer Tests Passed!');
    console.log('========================================================================\n');
  } finally {
    if (!existingBrowser && browser) await browser.close();
    if (server) server.close();
  }
}

async function runTests() {
  return runI18nBrowserSuite();
}

if (require.main === module) {
  runTests().catch(err => {
    console.error('❌ [TEST FAILED]:', err);
    process.exit(1);
  });
}

module.exports = { runTests, runI18nBrowserSuite };
