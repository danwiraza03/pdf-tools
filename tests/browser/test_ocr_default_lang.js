/**
 * Browser Test: default OCR language follows the UI language (pages/ocr.html)
 *
 * Rules under test:
 *  1. No saved UI language: id-ID browser -> 'ind', en-US browser -> 'eng'.
 *  2. Saved UI language ('pdftools-lang') wins over the browser locale.
 *  3. Switching the UI language BEFORE choosing an OCR language updates the default.
 *  4. A manual OCR language choice is never overridden by a later UI language switch.
 *  5. Exactly one language button is active at any time.
 *  6. Running OCR with the untouched default downloads ONLY that language model
 *     (eng.js for 'eng', ind.js for 'ind'; never both).
 *
 * Run alone: node tests/browser/test_ocr_default_lang.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { startTestServer } = require('./helpers');
const { launchChromium } = require('./helpers/launch');
const { getTempDir } = require('./helpers/tmp');

const PORT = 8991;
const ACTIVE = '#langSelector .ocr-seg-btn.active';

async function activeLangs(page) {
  return page.$$eval(ACTIVE, els => els.map(e => e.getAttribute('data-lang')));
}

async function openOcrPage(browser, baseUrl, { locale, storedLang }) {
  const context = await browser.newContext({ locale });
  if (storedLang) {
    await context.addInitScript(l => { try { localStorage.setItem('pdftools-lang', l); } catch (e) {} }, storedLang);
  }
  const page = await context.newPage();
  await page.goto(`${baseUrl}/pages/ocr.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.i18n && window.PDFTools.OCR), { timeout: 8000 });
  return { context, page };
}

// Builds an IMAGE-ONLY pdf in the page (no text layer, so language auto-detect cannot interfere)
// and uploads it, which also reveals the options panel containing the language buttons.
async function loadScan(page, tmp, name) {
  const b64 = await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 420; c.height = 120;
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 420, 120);
    x.fillStyle = '#000'; x.font = 'bold 44px Arial'; x.fillText('TES OCR', 20, 78);
    const png = await (await fetch(c.toDataURL('image/png'))).arrayBuffer();
    const doc = await PDFLib.PDFDocument.create();
    const img = await doc.embedPng(png);
    const pg = doc.addPage([420, 120]); pg.drawImage(img, { x: 0, y: 0, width: 420, height: 120 });
    const bytes = await doc.save(); let s = ''; bytes.forEach(b => { s += String.fromCharCode(b); }); return btoa(s);
  });
  const pdfPath = path.join(tmp.dir, `scan_${name}.pdf`);
  fs.writeFileSync(pdfPath, Buffer.from(b64, 'base64'));
  await page.locator('input[type="file"]').first().setInputFiles(pdfPath);
  await page.waitForSelector('#startOcrBtn:not([disabled])', { timeout: 10000 });
}

async function runOcrWithDefault(browser, baseUrl, locale, tmp) {
  const { context, page } = await openOcrPage(browser, baseUrl, { locale });
  const loaded = [];
  page.on('requestfinished', r => { const u = r.url(); if (u.includes('/js/lib/tesseract/')) loaded.push(u.split('/').pop()); });
  await loadScan(page, tmp, locale);
  await page.click('#startOcrBtn');
  await page.waitForFunction(() => performance.getEntriesByType('resource').some(e => /lang-data\/(eng|ind)\.js/.test(e.name)), { timeout: 30000 });
  await page.waitForTimeout(500);
  await context.close();
  return { loaded };
}

async function runOcrDefaultLangSuite(existingBrowser, existingBaseUrl) {
  console.log('========================================================================');
  console.log('>>> [TEST] OCR default language follows UI language (pages/ocr.html)');
  console.log('========================================================================');
  let server; let browser = existingBrowser; let baseUrl = existingBaseUrl; const tmp = getTempDir('ocr_default_lang');
  const failures = [];
  const check = (cond, msg) => { if (cond) console.log('  ✓ ' + msg); else { console.log('  ✗ FAIL: ' + msg); failures.push(msg); } };

  try {
    if (!browser || !baseUrl) { server = await startTestServer(PORT); baseUrl = `http://127.0.0.1:${PORT}`; browser = await launchChromium({ headless: true }); }

    console.log('\n--- 1/2. Default from browser locale / saved UI language ---');
    for (const [label, opts, expected] of [
      ['en-US, no saved language', { locale: 'en-US' }, 'eng'],
      ['id-ID, no saved language', { locale: 'id-ID' }, 'ind'],
      ['id-ID browser but saved UI language = en', { locale: 'id-ID', storedLang: 'en' }, 'eng'],
      ['en-US browser but saved UI language = id', { locale: 'en-US', storedLang: 'id' }, 'ind']
    ]) {
      const { context, page } = await openOcrPage(browser, baseUrl, opts);
      const act = await activeLangs(page);
      check(act.length === 1 && act[0] === expected, `${label}: active OCR language = ${JSON.stringify(act)} (expected ["${expected}"])`);
      await context.close();
    }

    console.log('\n--- 3. UI language switch before any manual choice moves the default ---');
    {
      const { context, page } = await openOcrPage(browser, baseUrl, { locale: 'id-ID' });
      check(JSON.stringify(await activeLangs(page)) === '["ind"]', 'starts as ind in Indonesian UI');
      await page.evaluate(() => PDFTools.i18n.setLang('en'));
      check(JSON.stringify(await activeLangs(page)) === '["eng"]', 'switching UI to English moves default to eng');
      await page.evaluate(() => PDFTools.i18n.setLang('id'));
      check(JSON.stringify(await activeLangs(page)) === '["ind"]', 'switching UI back to Indonesian moves default to ind');
      await context.close();
    }

    console.log('\n--- 4. Manual choice is never overridden ---');
    for (const pick of ['ind+eng', 'eng']) {
      const { context, page } = await openOcrPage(browser, baseUrl, { locale: 'id-ID' });
      await loadScan(page, tmp, `manual_${pick.replace('+', '_')}`);
      await page.click(`#langSelector .ocr-seg-btn[data-lang="${pick}"]`);
      await page.evaluate(() => PDFTools.i18n.setLang('en'));
      await page.evaluate(() => PDFTools.i18n.setLang('id'));
      const act = await activeLangs(page);
      check(act.length === 1 && act[0] === pick, `manual "${pick}" survives UI language switches (active: ${JSON.stringify(act)})`);
      await context.close();
    }

    console.log('\n--- 6. OCR with the untouched default downloads only that model ---');
    for (const [locale, want, other] of [['en-US', 'eng.js', 'ind.js'], ['id-ID', 'ind.js', 'eng.js']]) {
      const r = await runOcrWithDefault(browser, baseUrl, locale, tmp);
      check(r.loaded.includes(want) && !r.loaded.includes(other),
        `${locale}: downloaded ${JSON.stringify(r.loaded)} (needs ${want}, must NOT include ${other})`);
    }

    console.log('\n========================================================================');
    if (failures.length) { console.log(`❌ ${failures.length} check(s) failed`); return { success: false, failures }; }
    console.log('✅ OCR default language tests passed');
    return { success: true, failures };
  } finally {
    tmp.cleanup();
    if (!existingBrowser && browser) await browser.close();
    if (server && server.close) server.close();
  }
}

if (require.main === module) {
  runOcrDefaultLangSuite().then(r => process.exit(r.success ? 0 : 1)).catch(e => { console.error(e); process.exit(1); });
}
module.exports = { runOcrDefaultLangSuite };
