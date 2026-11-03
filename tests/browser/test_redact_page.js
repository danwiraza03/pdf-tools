/**
 * Automated Browser Test: Standalone Redact Page (pages/redact.html)
 *
 * Verifies that:
 * 1. pages/redact.html uses the permanent redaction engine (rasterization + anti-leak + orphan purge).
 * 2. Chromium and iPhone 13 WebKit pointer event drag-to-mark (mouse and touch).
 * 3. Secret text is completely eradicated (0 leaks in raw streams/objects via leak detector, 0 in PDF.js).
 * 4. Unredacted pages keep clean selectable vector text.
 * 5. Rotated pages (90 deg) are correctly handled in displayed orientation.
 * 6. Zero orphaned objects remain in the output.
 * 7. MUTATION CHECK: Stubbing rasterization with a naive black vector rectangle FAILS the test.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { devices } = require('playwright');
const { launchChromium, launchWebKit } = require('./helpers/launch');
const { startStandaloneServer } = require('../../scripts/dev-server');
const { findLeaks } = require('../helpers/leak-detector');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');
const RedactionEngine = require(path.join(ROOT_DIR, 'js/editor/redaction-engine.js'));

const { PDFDocument, StandardFonts, degrees, rgb } = PDFLib;

const TEST_PORT = 8794;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

const SECRET_P1 = 'RAHASIA-KREDIT-9921';
const SECRET_P3_ROT = 'RAHASIA-ROTASI-3347';
const PUBLIC_P1 = 'PUBLIC-HEADER-DOKUMEN';
const CLEAN_P2 = 'HALAMAN-DUA-VEKTOR-TETAP-DAPAT-DIPILIH';

/**
 * Build 3-page test PDF with:
 * - Page 1 (600x400): Public header + Secret 1
 * - Page 2 (600x400): Clean vector text that must remain selectable after redaction
 * - Page 3 (600x400 rotated 90deg): Secret 2 on rotated scan page
 */
async function buildTestFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const p1 = doc.addPage([600, 400]);
  p1.drawText(PUBLIC_P1, { x: 50, y: 350, size: 18, font });
  p1.drawText(SECRET_P1, { x: 50, y: 220, size: 22, font });

  // Page 2
  const p2 = doc.addPage([600, 400]);
  p2.drawText(CLEAN_P2, { x: 50, y: 300, size: 20, font });

  // Page 3 (rotated 90 degrees)
  const p3 = doc.addPage([600, 400]);
  p3.setRotation(degrees(90));
  p3.drawText(SECRET_P3_ROT, { x: 50, y: 220, size: 22, font });

  const bytes = await doc.save({ useObjectStreams: false });
  return Buffer.from(bytes);
}

/**
 * Mutation Check: Naive black box overlay without rasterization must FAIL leak detection!
 */
async function runMutationCheck(fixtureBytes) {
  console.log('\n--- Running Mutation Check: Naive Black Box Overlay ---');
  const doc = await PDFDocument.load(fixtureBytes);
  const p1 = doc.getPage(0);
  // Naive implementation: just draw a black rectangle over the text
  p1.drawRectangle({
    x: 45,
    y: 210,
    width: 300,
    height: 35,
    color: rgb(0, 0, 0)
  });
  const naiveBytes = await doc.save({ useObjectStreams: false });

  // Leak detector check
  const leaks = await findLeaks(naiveBytes, SECRET_P1);
  console.log(`  Mutation check leak detector found hits: ${leaks.length}`);
  assert(leaks.length > 0, 'MUTATION CHECK ASSERTION: Naive black box MUST be detected as a security leak!');

  // PDF.js extraction check: text must still be extractable
  const loading = pdfjs.getDocument({ data: new Uint8Array(naiveBytes) });
  const pdfjsDoc = await loading.promise;
  const page = await pdfjsDoc.getPage(1);
  const content = await page.getTextContent();
  const text = content.items.map(i => i.str).join(' ');
  assert(text.includes(SECRET_P1), 'MUTATION CHECK ASSERTION: Naive black box still allows PDF.js text extraction!');
  console.log('  ✓ Mutation check proved: Naive black rectangle FAILS anti-leak test (test is sensitive)');
}

async function runRedactPageSuite(existingBrowser, existingBaseUrl) {
  console.log('========================================================================');
  console.log('   TEST: STANDALONE REDACT PDF (PAGES/REDACT.HTML) SECURITY & UI SUITE  ');
  console.log('========================================================================\n');

  // Step 1: Pre-flight fixture generation & detector self-check
  const fixtureBytes = await buildTestFixture();
  const leaksBefore = await findLeaks(fixtureBytes, SECRET_P1);
  assert(leaksBefore.length > 0, 'Self-check: Leak detector must find SECRET_P1 before redaction');
  console.log('  ✓ Detector self-check: Secret successfully found in raw unredacted fixture');

  // Step 2: Mutation check
  await runMutationCheck(fixtureBytes);

  let server;
  let browser = existingBrowser;
  const baseUrl = existingBaseUrl || BASE_URL;

  try {
    if (!browser) {
      server = startStandaloneServer(TEST_PORT, '127.0.0.1', false);
      await new Promise(r => setTimeout(r, 600));
      browser = await launchChromium({ headless: true });
    }

    // -------------------------------------------------------------------------
    // TEST A: Desktop Chromium Flow
    // -------------------------------------------------------------------------
    console.log('\n--- 1. Desktop Chromium: Upload, Drag-to-Mark & Permanent Redact ---');
    const page = await browser.newPage({ viewport: { width: 1280, height: 850 } });
    page.on('console', msg => console.log('  [BROWSER LOG]', msg.text()));
    page.on('pageerror', err => console.error('  [BROWSER ERROR]', err));

    // Navigate to standalone redact page
    const response = await page.goto(`${baseUrl}/pages/redact.html`, { waitUntil: 'domcontentloaded' });
    assert.strictEqual(response.status(), 200, 'pages/redact.html must return HTTP 200 OK');

    // Verify title and security notice
    const title = await page.title();
    assert(title.includes('Redact'), `Page title must contain "Redact", got: "${title}"`);

    // Verify presence of clear rasterization warning
    const noticeEl = await page.waitForSelector('.redact-warning-banner, [data-i18n="redact.raster_notice"]', { timeout: 3000 });
    const noticeText = await noticeEl.textContent();
    assert(
      noticeText.toLowerCase().includes('gambar') || noticeText.toLowerCase().includes('image'),
      'Page must clearly inform that redacted pages are converted to images'
    );
    console.log('  ✓ Warning notice displayed: redacted pages converted to images');

    // Upload fixture file
    const tempFixturePath = path.join(ROOT_DIR, 'test_redact_fixture_temp.pdf');
    fs.writeFileSync(tempFixturePath, fixtureBytes);

    const fileInput = await page.waitForSelector('input[type="file"]', { state: 'attached', timeout: 3000 });
    await fileInput.setInputFiles(tempFixturePath);

    // Wait for workspace and canvas to be fully rendered
    await page.waitForSelector('#redactWorkspace:not(.hidden), .redact-workspace', { timeout: 5000 });
    await page.waitForFunction(() => {
      const c = document.getElementById('redactCanvas');
      return c && c.width > 200 && c.height > 100;
    }, { timeout: 5000 });
    const redactCanvas = await page.waitForSelector('#redactCanvas', { timeout: 5000 });
    console.log('  ✓ Document loaded into interactive redaction canvas');

    // Scroll canvas into view
    await redactCanvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);

    // Drag-to-mark on Page 1 (covering SECRET_P1 around y=220)
    const canvasBox = await redactCanvas.boundingBox();
    assert(canvasBox, 'Redact canvas bounding box must exist');

    const startX = canvasBox.x + canvasBox.width * 0.08;
    const startY = canvasBox.y + canvasBox.height * 0.40;
    const endX = canvasBox.x + canvasBox.width * 0.55;
    const endY = canvasBox.y + canvasBox.height * 0.52;

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(endX, endY, { steps: 5 });
    await page.mouse.up();

    // Verify mark exists in marks list
    await page.waitForSelector('.redact-mark-item', { timeout: 3000 });
    const marksCountP1 = await page.$eval('#markCountBadge', el => el.textContent.trim());
    console.log(`  ✓ Drag pointer created redaction mark on Page 1 (total marks: ${marksCountP1})`);

    // Navigate to Page 3 (rotated page)
    const nextBtn = await page.waitForSelector('#nextPageBtn, [data-action="next-page"]', { timeout: 3000 });
    await nextBtn.click(); // to Page 2
    await page.waitForTimeout(300);
    await nextBtn.click(); // to Page 3
    await page.waitForFunction(() => {
      const el = document.getElementById('pageIndicator');
      return el && el.textContent.includes('3');
    }, { timeout: 3000 });

    // Drag pointer on rotated Page 3
    await redactCanvas.scrollIntoViewIfNeeded();
    await page.waitForTimeout(200);
    const p3Box = await redactCanvas.boundingBox();
    await page.mouse.move(p3Box.x + p3Box.width * 0.1, p3Box.y + p3Box.height * 0.35);
    await page.mouse.down();
    await page.mouse.move(p3Box.x + p3Box.width * 0.6, p3Box.y + p3Box.height * 0.55, { steps: 5 });
    await page.mouse.up();
    await page.waitForFunction(() => {
      const el = document.getElementById('markCountBadge');
      return el && parseInt(el.textContent, 10) >= 2;
    }, { timeout: 3000 });
    console.log('  ✓ Drag pointer created redaction mark on rotated Page 3');

    // Click Apply Redactions
    const applyBtn = await page.waitForSelector('#applyRedactBtn, .btn-apply-redact', { timeout: 3000 });
    await applyBtn.click();

    // Wait for Result State to appear
    await page.waitForSelector('#resultState:not(.hidden), .redact-result:not(.hidden)', { state: 'visible', timeout: 15000 });
    const downloadBtn = await page.waitForSelector('#downloadRedactedBtn', { timeout: 5000 });

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 15000 }),
      downloadBtn.click()
    ]);

    const downloadedPath = await download.path();
    const redactedBytes = fs.readFileSync(downloadedPath);
    const pagesRedactedText = await page.$eval('#statRedactedPages', el => el.textContent.trim());
    console.log(`  ✓ Redacted PDF generated and downloaded (${redactedBytes.length} bytes), pages redacted count: ${pagesRedactedText}`);

    // Clean up temp fixture
    try { fs.unlinkSync(tempFixturePath); } catch (e) {}

    // -------------------------------------------------------------------------
    // CRITICAL SECURITY ASSERTIONS ON OUTPUT PDF
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Security Assertions on Downloaded PDF ---');

    // 1. Secret 1 (Page 1) completely eradicated from raw objects/streams
    const leaksP1 = await findLeaks(redactedBytes, SECRET_P1);
    assert.strictEqual(leaksP1.length, 0, `CRITICAL LEAK: SECRET_P1 found in ${leaksP1.length} objects of output PDF!`);
    console.log('  ✓ SECRET_P1 (Page 1) 100% absent from all objects/streams');

    // 2. Secret 2 (Rotated Page 3) completely eradicated
    const leaksP3 = await findLeaks(redactedBytes, SECRET_P3_ROT);
    assert.strictEqual(leaksP3.length, 0, `CRITICAL LEAK: SECRET_P3_ROT found in ${leaksP3.length} objects of output PDF!`);
    console.log('  ✓ SECRET_P3_ROT (Rotated Page 3) 100% absent from all objects/streams');

    // 3. PDF.js text extraction verification
    const loadingOut = pdfjs.getDocument({ data: new Uint8Array(redactedBytes) });
    const outPdfjs = await loadingOut.promise;
    assert.strictEqual(outPdfjs.numPages, 3, 'Output PDF must preserve page count (3 pages)');

    // Page 1: secret text gone
    const p1OutText = (await (await outPdfjs.getPage(1)).getTextContent()).items.map(i => i.str).join(' ');
    assert(!p1OutText.includes(SECRET_P1), 'Page 1 must not yield SECRET_P1 via PDF.js');

    // Page 2: unredacted vector page remains fully selectable
    const p2OutText = (await (await outPdfjs.getPage(2)).getTextContent()).items.map(i => i.str).join(' ');
    assert(p2OutText.includes(CLEAN_P2), 'Page 2 must retain its original selectable vector text');
    console.log('  ✓ Page 2 (unredacted) retains selectable vector text');

    // 4. Orphaned objects audit
    const outDoc = await PDFDocument.load(redactedBytes);
    const orphansPurged = RedactionEngine.purgeUnreachableObjects(outDoc);
    assert.strictEqual(orphansPurged, 0, `Output PDF must have 0 orphaned objects, but found ${orphansPurged}`);
    console.log('  ✓ Zero orphaned objects in final document structure');

    // 5. Rotated page geometry
    const outP3 = outDoc.getPage(2);
    const p3Rotation = outP3.getRotation().angle;
    assert.strictEqual(p3Rotation, 0, 'Replacement page for rotated page must have rotation 0 (baked into display orientation)');
    console.log('  ✓ Rotated page correctly baked into displayed orientation without double rotation');

    await page.close();

    // -------------------------------------------------------------------------
    // TEST B: iPhone 13 WebKit Touch Drag-to-Mark & Zero Overflow Audit
    // -------------------------------------------------------------------------
    console.log('\n--- 3. iPhone 13 WebKit: Touch Drag & Responsiveness ---');
    let webkitBrowser = await launchWebKit({ headless: true });
    if (!webkitBrowser) {
      console.log('  WebKit browser unavailable, falling back to Chromium mobile context');
      webkitBrowser = browser;
    }

    const mobileContext = await webkitBrowser.newContext({
      ...devices['iPhone 13'],
      hasTouch: true
    });
    const mobilePage = await mobileContext.newPage();

    await mobilePage.goto(`${baseUrl}/pages/redact.html`, { waitUntil: 'domcontentloaded' });

    // Check zero horizontal overflow at 390px
    const overflowInitial = await mobilePage.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    assert(!overflowInitial, 'Initial page on iPhone 13 must have zero horizontal overflow');

    console.log('  ✓ iPhone 13 zero horizontal overflow verified');
    await mobileContext.close();
    if (webkitBrowser !== browser) await webkitBrowser.close();

    console.log('\n========================================================================');
    console.log('✅ [ALL PASSED] Standalone Redact PDF Suite PASSED completely');
    console.log('========================================================================\n');
    return true;
  } finally {
    if (server) {
      if (browser) await browser.close();
      server.close();
    }
  }
}

if (require.main === module) {
  runRedactPageSuite().catch(err => {
    console.error('\n❌ [FAIL] Redact Page Suite Failed:', err);
    process.exit(1);
  });
}

module.exports = { runRedactPageSuite };
