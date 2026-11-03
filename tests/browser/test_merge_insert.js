/**
 * PDF Tools — Browser Test: Merge Insert Files In-Between
 * Tests:
 * 1. Insert multi-page file B after page 2 of document A via card insert button.
 * 2. Verifies exact sequence on screen and in assembled PDF (via PDF.js): A1, A2, B1, B2, A3, A4, A5.
 * 3. Tests Undo reverts back to A only.
 * 4. Tests insert file C after document 1 via document header insert button.
 * 5. Tests touch viewport (390px) ensures insert buttons are visible, >= 44x44px, and not obscured.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');
const helpers = require('./helpers');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjsLib = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));

async function createDocumentWithPages(prefix, pageCount) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= pageCount; i++) {
    const page = doc.addPage([500, 300]);
    page.drawText(`${prefix}_PAGE_${i}`, {
      x: 50,
      y: 150,
      size: 20,
      font,
      color: PDFLib.rgb(0, 0, 0)
    });
  }
  return await doc.save();
}

async function extractTextFromPdfBuffer(pdfBuffer) {
  const data = new Uint8Array(pdfBuffer);
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdfDoc = await loadingTask.promise;
  const pageTexts = [];
  for (let i = 1; i <= pdfDoc.numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(item => item.str).join(' ');
    pageTexts.push(text.trim());
  }
  return pageTexts;
}

async function runMergeInsertSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       MERGE PAGE: INSERT FILES IN-BETWEEN AUDIT SUITE                   ');
  console.log('========================================================================\n');

  const pdfABytes = await createDocumentWithPages('DOC_A', 5);
  const pdfBBytes = await createDocumentWithPages('DOC_B', 2);
  const pdfCBytes = await createDocumentWithPages('DOC_C', 1);

  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    hasTouch: false
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });

    // --- STEP 1: Load Document A (5 pages) ---
    console.log('  1. Loading Document A (5 pages) ...');
    await page.setInputFiles('input[type="file"]', {
      name: 'doc_A.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfABytes)
    });

    await page.waitForSelector('#organizerArea:not([style*="display: none"])', { timeout: 10000 });
    await page.click('#expandAllBtn');
    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length === 5, { timeout: 8000 });
    console.log('    ✓ Document A loaded (5 pages)');

    // --- STEP 2: Insert Document B (2 pages) after Page 2 via card insert button ---
    console.log('  2. Inserting Document B (2 pages) after Page 2 ...');
    const cards = await page.$$('.merge-page-card.expanded-page');
    assert.strictEqual(cards.length, 5, 'Should have 5 cards');

    // Page 2 is cards[1]
    const card2 = cards[1];
    const insertBtnPage2 = await card2.$('.merge-card-insert-btn, button[data-action="insert-after-page"]');
    assert(insertBtnPage2, 'Insert button on card 2 (.merge-card-insert-btn) must exist');

    const [fileChooserB] = await Promise.all([
      page.waitForEvent('filechooser'),
      insertBtnPage2.click()
    ]);

    await fileChooserB.setFiles([{
      name: 'doc_B.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfBBytes)
    }]);

    // Wait for 7 total pages
    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length === 7, { timeout: 10000 });

    // Verify order on screen: card source files & original pages
    const screenOrder = await page.evaluate(() => {
      const allCards = Array.from(document.querySelectorAll('.merge-page-card.expanded-page'));
      return allCards.map(c => {
        const titleEl = c.querySelector('.merge-card-title-text');
        const origBadge = c.querySelector('.merge-card-orig-badge');
        return {
          title: titleEl ? titleEl.title || titleEl.textContent : '',
          orig: origBadge ? origBadge.textContent.trim() : ''
        };
      });
    });

    console.log('    Screen order after insertion:');
    screenOrder.forEach((o, i) => console.log(`      [${i + 1}] ${o.title} (${o.orig})`));

    // Card 1: doc_A (Orig 1)
    // Card 2: doc_A (Orig 2)
    // Card 3: doc_B (Orig 1)
    // Card 4: doc_B (Orig 2)
    // Card 5: doc_A (Orig 3)
    // Card 6: doc_A (Orig 4)
    // Card 7: doc_A (Orig 5)
    assert(screenOrder[0].title.includes('doc_A'), 'Item 1 must be doc_A');
    assert(screenOrder[1].title.includes('doc_A'), 'Item 2 must be doc_A');
    assert(screenOrder[2].title.includes('doc_B'), 'Item 3 must be doc_B');
    assert(screenOrder[3].title.includes('doc_B'), 'Item 4 must be doc_B');
    assert(screenOrder[4].title.includes('doc_A'), 'Item 5 must be doc_A');
    assert(screenOrder[5].title.includes('doc_A'), 'Item 6 must be doc_A');
    assert(screenOrder[6].title.includes('doc_A'), 'Item 7 must be doc_A');

    // --- STEP 3: Merge and Verify Assembled PDF Content via PDF.js ---
    console.log('  3. Merging and verifying PDF text stream order ...');
    await page.click('#mergeBtn');
    await page.waitForSelector('#resultArea.active', { timeout: 15000 });

    // Extract the merged PDF bytes
    const mergedPdfBase64 = await page.evaluate(async () => {
      const dlBtn = document.getElementById('downloadBtn');
      if (!dlBtn || !dlBtn.href) throw new Error('Download button has no href');
      const resp = await fetch(dlBtn.href);
      const buf = await resp.arrayBuffer();
      let binary = '';
      const bytes = new Uint8Array(buf);
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
    });

    const mergedBuffer = Buffer.from(mergedPdfBase64, 'base64');
    const pageTexts = await extractTextFromPdfBuffer(mergedBuffer);
    console.log('    Extracted PDF pages text:', pageTexts);

    assert.strictEqual(pageTexts.length, 7, 'Merged PDF must have exactly 7 pages');
    assert(pageTexts[0].includes('DOC_A_PAGE_1'), 'Page 1 must contain DOC_A_PAGE_1');
    assert(pageTexts[1].includes('DOC_A_PAGE_2'), 'Page 2 must contain DOC_A_PAGE_2');
    assert(pageTexts[2].includes('DOC_B_PAGE_1'), 'Page 3 must contain DOC_B_PAGE_1');
    assert(pageTexts[3].includes('DOC_B_PAGE_2'), 'Page 4 must contain DOC_B_PAGE_2');
    assert(pageTexts[4].includes('DOC_A_PAGE_3'), 'Page 5 must contain DOC_A_PAGE_3');
    assert(pageTexts[5].includes('DOC_A_PAGE_4'), 'Page 6 must contain DOC_A_PAGE_4');
    assert(pageTexts[6].includes('DOC_A_PAGE_5'), 'Page 7 must contain DOC_A_PAGE_5');
    console.log('    ✓ Assembled PDF order verified: A1, A2, B1, B2, A3, A4, A5');

    // --- STEP 4: Undo Action ---
    console.log('  4. Testing Undo ...');
    await page.click('#undoBtn');
    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length === 5, { timeout: 8000 });

    const orderAfterUndo = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.merge-page-card.expanded-page')).map(c => {
        const titleEl = c.querySelector('.merge-card-title-text');
        return titleEl ? titleEl.title || titleEl.textContent : '';
      });
    });
    assert(orderAfterUndo.every(t => t.includes('doc_A')), 'After Undo, only doc_A pages should remain');
    console.log('    ✓ Undo successfully reverted to Document A alone (5 pages)');

    // --- STEP 5: Insert Document C after Document 1 header ---
    console.log('  5. Inserting Document C after Document 1 header ...');
    const docHeaderInsertBtn = await page.$('.merge-file-group-header .merge-group-insert-btn, .merge-file-group-header button[data-action="insert-after-doc"], .merge-page-card.stacked-doc .merge-group-insert-btn');
    assert(docHeaderInsertBtn, 'Document header insert button (.merge-group-insert-btn) must exist');

    const [fileChooserC] = await Promise.all([
      page.waitForEvent('filechooser'),
      docHeaderInsertBtn.click()
    ]);

    await fileChooserC.setFiles([{
      name: 'doc_C.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfCBytes)
    }]);

    await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length === 6, { timeout: 10000 });
    const orderAfterC = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.merge-page-card.expanded-page')).map(c => {
        const titleEl = c.querySelector('.merge-card-title-text');
        return titleEl ? titleEl.title || titleEl.textContent : '';
      });
    });
    console.log('    Order after inserting C after doc 1:', orderAfterC);
    assert(orderAfterC.slice(0, 5).every(t => t.includes('doc_A')), 'First 5 pages must be doc_A');
    assert(orderAfterC[5].includes('doc_C'), 'Page 6 must be doc_C');
    console.log('    ✓ Insert after document header verified');

  } finally {
    await context.close();
  }

  // --- STEP 6: Touch Viewport 390px Check ---
  console.log('  6. Testing Touch Viewport (390px) insert buttons ...');
  const mobileCtx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true
  });
  const mobilePage = await mobileCtx.newPage();

  try {
    await mobilePage.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });
    await mobilePage.setInputFiles('input[type="file"]', {
      name: 'doc_A.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfABytes)
    });

    await mobilePage.waitForSelector('#organizerArea:not([style*="display: none"])', { timeout: 10000 });

    // Check stacked doc header insert button touch target
    const stackedInsertBtn = await mobilePage.$('.merge-page-card.stacked-doc .merge-group-insert-btn, .merge-file-group-header .merge-group-insert-btn');
    assert(stackedInsertBtn, 'Stacked doc / group header insert button must exist in touch mode');
    const sRect = await stackedInsertBtn.boundingBox();
    assert(sRect && sRect.width >= 43.5 && sRect.height >= 43.5, `Stacked insert button must be >= 44x44px (got ${sRect.width}x${sRect.height})`);

    // Expand
    await mobilePage.click('#expandAllBtn');
    await mobilePage.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length === 5, { timeout: 8000 });

    const cardInsertBtn = await mobilePage.$('.merge-page-card.expanded-page .merge-card-insert-btn');
    assert(cardInsertBtn, 'Expanded card insert button must exist in touch mode');
    const cRect = await cardInsertBtn.boundingBox();
    assert(cRect && cRect.width >= 43.5 && cRect.height >= 43.5, `Expanded card insert button must be >= 44x44px (got ${cRect.width}x${cRect.height})`);

    // Ensure it is clickable via elementFromPoint
    const centerClickable = await mobilePage.evaluate(() => {
      const btn = document.querySelector('.merge-page-card.expanded-page .merge-card-insert-btn');
      if (!btn) return false;
      const r = btn.getBoundingClientRect();
      const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return Boolean(el && (btn.contains(el) || el === btn));
    });
    assert(centerClickable, 'Expanded card insert button center must be reachable via elementFromPoint');
    console.log('    ✓ Touch viewport 390px insert buttons meet >= 44x44px and are unobscured');

  } finally {
    await mobileCtx.close();
  }

  console.log('\n✓ [PASS] All Merge Insert tests passed successfully!');
  return true;
}

if (require.main === module) {
  (async () => {
    const server = await helpers.startTestServer(8135);
    const browser = await chromium.launch({ headless: true });
    try {
      await runMergeInsertSuite(browser, 'http://127.0.0.1:8135');
    } finally {
      await browser.close();
      await server.close();
    }
  })().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runMergeInsertSuite };
