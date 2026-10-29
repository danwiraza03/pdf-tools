/**
 * Automated Test: i18n Locale Detection, Storage Persistence & Mobile Drawer Navigation
 *
 * Verifies:
 * 1. Default display language is English ('en') for all new visitors:
 *    - browser id-ID without stored choice -> 'en' (<html lang="en">).
 *    - browser en-US without stored choice -> 'en' (<html lang="en">).
 * 2. Stored user preference in localStorage ('pdftools-lang') is respected:
 *    - stored 'id' -> 'id' even on en-US browser.
 *    - stored 'en' -> 'en' even on id-ID browser.
 * 3. Clicking language button in header switches to Indonesian, saves preference, and persists across reload.
 * 4. Mobile menu drawer links and section titles are fully translated in both id and en,
 *    and "PDF Tools (DN.)" in drawer title is preserved in both languages.
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

    // --- TEST 1: Default Locale en-US without localStorage -> must be 'en' ---
    console.log('\n--- 1. Testing Default Locale en-US (no localStorage) -> "en" ---');
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
      console.log('  ✓ en-US without stored choice correctly initialized to English ("en").');
    }

    // --- TEST 2: Default Locale id-ID without localStorage -> must be 'en' ---
    console.log('\n--- 2. Testing Default Locale id-ID (no localStorage) -> "en" ---');
    {
      const context = await browser.newContext({
        locale: 'id-ID'
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      const langAttr = await page.evaluate(() => document.documentElement.lang);
      const activeLang = await page.evaluate(() => window.PDFTools && window.PDFTools.i18n && window.PDFTools.i18n.getLang());

      console.log(`  id-ID -> html.lang: "${langAttr}", activeLang: "${activeLang}"`);
      assert.strictEqual(activeLang, 'en', `Expected default language to be 'en' for locale id-ID without stored choice, got '${activeLang}'`);
      assert.strictEqual(langAttr, 'en', `Expected <html lang="en">, got '${langAttr}'`);

      await context.close();
      console.log('  ✓ id-ID without stored choice correctly initialized to English ("en").');
    }

    // --- TEST 3: Stored preference overrides browser locale ---
    console.log('\n--- 3. Testing Stored Preferences (localStorage) ---');
    {
      // 3a. Stored 'id' on en-US browser -> must be 'id'
      const contextId = await browser.newContext({ locale: 'en-US' });
      await contextId.addInitScript(() => {
        try { localStorage.setItem('pdftools-lang', 'id'); } catch (e) {}
      });
      const pageId = await contextId.newPage();
      await pageId.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      const langAttrId = await pageId.evaluate(() => document.documentElement.lang);
      const activeLangId = await pageId.evaluate(() => window.PDFTools && window.PDFTools.i18n && window.PDFTools.i18n.getLang());
      console.log(`  stored 'id' with en-US browser -> html.lang: "${langAttrId}", activeLang: "${activeLangId}"`);
      assert.strictEqual(activeLangId, 'id', `Stored 'id' on en-US browser must be 'id', got '${activeLangId}'`);
      assert.strictEqual(langAttrId, 'id', `Stored 'id' on en-US browser must set html.lang='id', got '${langAttrId}'`);
      await contextId.close();
      console.log('  ✓ Stored "id" respected even on en-US browser.');

      // 3b. Stored 'en' on id-ID browser -> must be 'en'
      const contextEn = await browser.newContext({ locale: 'id-ID' });
      await contextEn.addInitScript(() => {
        try { localStorage.setItem('pdftools-lang', 'en'); } catch (e) {}
      });
      const pageEn = await contextEn.newPage();
      await pageEn.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      const langAttrEn = await pageEn.evaluate(() => document.documentElement.lang);
      const activeLangEn = await pageEn.evaluate(() => window.PDFTools && window.PDFTools.i18n && window.PDFTools.i18n.getLang());
      console.log(`  stored 'en' with id-ID browser -> html.lang: "${langAttrEn}", activeLang: "${activeLangEn}"`);
      assert.strictEqual(activeLangEn, 'en', `Stored 'en' on id-ID browser must be 'en', got '${activeLangEn}'`);
      assert.strictEqual(langAttrEn, 'en', `Stored 'en' on id-ID browser must set html.lang='en', got '${langAttrEn}'`);
      await contextEn.close();
      console.log('  ✓ Stored "en" respected even on id-ID browser.');
    }

    // --- TEST 4: Click language toggle in header switches to ID, saves, and persists ---
    console.log('\n--- 4. Testing Header Toggle Click -> Switch to ID & Persist ---');
    {
      const context = await browser.newContext({ locale: 'en-US' });
      const page = await context.newPage();
      await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });

      // Initial state is English
      const initialLang = await page.evaluate(() => window.PDFTools.i18n.getLang());
      assert.strictEqual(initialLang, 'en', `Initial language must be 'en', got '${initialLang}'`);

      // Click language toggle button in header
      const langBtn = page.locator('#langToggle');
      await langBtn.waitFor({ state: 'visible', timeout: 4000 });
      await langBtn.click();
      await page.waitForTimeout(100);

      const switchedLang = await page.evaluate(() => window.PDFTools.i18n.getLang());
      const switchedHtmlLang = await page.evaluate(() => document.documentElement.lang);
      const storedAfterClick = await page.evaluate(() => localStorage.getItem('pdftools-lang'));

      assert.strictEqual(switchedLang, 'id', `After clicking toggle, language must be 'id', got '${switchedLang}'`);
      assert.strictEqual(switchedHtmlLang, 'id', `html.lang must be 'id', got '${switchedHtmlLang}'`);
      assert.strictEqual(storedAfterClick, 'id', `localStorage must store 'id', got '${storedAfterClick}'`);

      // Reload page to verify persistence
      await page.reload({ waitUntil: 'domcontentloaded' });
      const reloadedLang = await page.evaluate(() => window.PDFTools.i18n.getLang());
      const reloadedHtmlLang = await page.evaluate(() => document.documentElement.lang);
      assert.strictEqual(reloadedLang, 'id', `Choice 'id' must persist after reload, got '${reloadedLang}'`);
      assert.strictEqual(reloadedHtmlLang, 'id', `html.lang must remain 'id' after reload, got '${reloadedHtmlLang}'`);

      await context.close();
      console.log('  ✓ Clicking language toggle switches to Indonesian, saves to localStorage, and persists after reload.');
    }

    // --- TEST 5: Mobile Nav Drawer Links & Sections Translation & Drawer Title ---
    console.log('\n--- 5. Testing Mobile Nav Drawer Translation & Title Preservation ---');
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

      // Drawer title must be "PDF Tools (DN.)" in English
      const enDrawerTitle = await page.locator('.mobile-nav-title').textContent();
      assert.strictEqual(enDrawerTitle.trim(), 'PDF Tools (DN.)', 'Drawer title in English must be "PDF Tools (DN.)"');

      // Test English mobile drawer labels
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

      // Switch to Indonesian and verify drawer title is still "PDF Tools (DN.)"
      await page.evaluate(() => window.PDFTools.i18n.setLang('id'));

      const idDrawerTitle = await page.locator('.mobile-nav-title').textContent();
      assert.strictEqual(idDrawerTitle.trim(), 'PDF Tools (DN.)', 'Drawer title in Indonesian must remain "PDF Tools (DN.)"');
      console.log('  ✓ Drawer title preserved as "PDF Tools (DN.)" in both English and Indonesian.');

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
