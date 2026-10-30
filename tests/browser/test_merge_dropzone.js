/**
 * PDF Tools — Browser Test for Merge Page Dropzone & Whole-Page Drag-and-Drop
 */

const assert = require('assert');
const { chromium } = require('playwright');
const helpers = require('./helpers');

function createSamplePdf(text) {
  const content = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 4 0 R >> >> /MediaBox [0 0 612 792] /Contents 5 0 R >>\nendobj\n4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n5 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 100 700 Td (${text || 'Test'}) Tj ET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f \n0000000010 00000 n \n0000000060 00000 n \n0000000117 00000 n \n0000000228 00000 n \n0000000305 00000 n \ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n397\n%%EOF`;
  return Buffer.from(content);
}

async function runMergeDropzoneSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       MERGE PAGE DROPZONE & WHOLE PAGE DRAG-AND-DROP SUITE             ');
  console.log('========================================================================\n');

  const context = await browser.newContext();
  const page = await context.newPage();

  const pdfBuffer1 = await createSamplePdf('Merge Document 1');
  const pdfBuffer2 = await createSamplePdf('Merge Document 2');

  const f1 = { name: 'merge1.pdf', mime: 'application/pdf', buffer: pdfBuffer1 };
  const f2 = { name: 'merge2.pdf', mime: 'application/pdf', buffer: pdfBuffer2 };

  try {
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });

    // 1. Initial dropzone load
    process.stdout.write('  1. Initial file drop on #dropzone ... ');
    await page.evaluate(async (fileData) => {
      const dt = new DataTransfer();
      const binary = atob(fileData.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], fileData.name, { type: fileData.mime });
      dt.items.add(file);

      const target = document.querySelector('#dropzone');
      target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, { name: f1.name, mime: f1.mime, base64: f1.buffer.toString('base64') });

    await page.waitForSelector('#organizerArea:not([style*="display: none"])', { timeout: 6000 });
    console.log('✓ PASS');

    // 2. Dragging text does not activate overlay
    process.stdout.write('  2. Dragging text does not activate overlay ... ');
    await page.evaluate(() => {
      const dt = new DataTransfer();
      dt.setData('text/plain', 'plain text drag');
      document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
    });
    const overlayVisible = await page.evaluate(() => {
      const o = document.querySelector('.page-drag-overlay, .merge-drag-overlay');
      return Boolean(o && o.style.display !== 'none' && o.offsetHeight > 0);
    });
    assert.strictEqual(overlayVisible, false, 'Text drag should not trigger overlay');
    console.log('✓ PASS');

    // 3. Dropping second file anywhere on body appends file
    process.stdout.write('  3. Dropping second file anywhere on body appends to merge queue ... ');
    await page.evaluate(async (fileData) => {
      const dt = new DataTransfer();
      const binary = atob(fileData.base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], fileData.name, { type: fileData.mime });
      dt.items.add(file);

      document.body.dispatchEvent(new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt }));
      document.body.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt }));
      document.body.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt }));
    }, { name: f2.name, mime: f2.mime, base64: f2.buffer.toString('base64') });

    await page.waitForFunction(() => {
      const cnt = document.querySelector('#organizerCount');
      return cnt && cnt.textContent.includes('2 Files');
    }, { timeout: 6000 });
    console.log('✓ PASS');

    console.log('\n  All merge dropzone tests passed successfully!');
    return true;
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  (async () => {
    const server = await helpers.startTestServer(8125);
    const browser = await chromium.launch({ headless: true });
    try {
      await runMergeDropzoneSuite(browser, 'http://localhost:8125');
    } finally {
      await browser.close();
      await server.close();
    }
  })().catch(err => {
    console.error('Fatal error in merge dropzone suite:', err);
    process.exit(1);
  });
}

module.exports = { runMergeDropzoneSuite };
