/**
 * Playwright Browser Test: Rotate PDF page card action buttons (Rotate Left, Rotate Right, Delete)
 */

'use strict';

const assert = require('assert');
const { startTestServer, createTestPdf, launchChromium } = require('./helpers');
const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

async function createMultiPagePdf(count = 3) {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([400, 400]);
    page.drawText(`Page ${i + 1}`, { x: 50, y: 300 });
  }
  return await doc.save();
}

async function runRotatePageActionsSuite(browser, baseUrl) {
  console.log('========================================================================');
  console.log('     ROTATE PDF: PAGE CARD ACTION BUTTONS (LEFT, RIGHT, DELETE) TEST    ');
  console.log('========================================================================\n');

  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const multiPdfBytes = await createMultiPagePdf(3);

    await page.goto(`${baseUrl}/pages/rotate.html`, { waitUntil: 'domcontentloaded' });

    // 1. Upload 3-page PDF via dropzone input
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.click('#dropzone')
    ]);

    await fileChooser.setFiles([{
      name: 'sample3.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(multiPdfBytes)
    }]);

    // Wait for all 3 page cards to appear
    await page.waitForFunction(() => document.querySelectorAll('#pageGrid .page-card').length === 3, { timeout: 8000 });
    const cards = await page.$$('#pageGrid .page-card');
    assert.strictEqual(cards.length, 3, 'Harus merender 3 page-card');

    // 2. Check each card has action buttons
    const actionBtnsCount = await page.evaluate(() => {
      const allActionBars = document.querySelectorAll('.page-card-actions');
      const allLeft = document.querySelectorAll('.page-action-rotate-left');
      const allRight = document.querySelectorAll('.page-action-rotate-right');
      const allDel = document.querySelectorAll('.page-action-delete');
      return {
        bars: allActionBars.length,
        left: allLeft.length,
        right: allRight.length,
        del: allDel.length
      };
    });

    assert.strictEqual(actionBtnsCount.bars, 3, 'Setiap kartu harus memiliki action bar');
    assert.strictEqual(actionBtnsCount.left, 3, 'Setiap kartu harus memiliki tombol rotate left');
    assert.strictEqual(actionBtnsCount.right, 3, 'Setiap kartu harus memiliki tombol rotate right');
    assert.strictEqual(actionBtnsCount.del, 3, 'Setiap kartu harus memiliki tombol delete');
    console.log('  ✓ Tombol aksi (rotate left, rotate right, delete) tersedia pada setiap kartu pratinjau.');

    // 3. Test rotate right (+90°) on card 1
    await page.click('.page-card:nth-child(1) .page-action-rotate-right');
    const card1HasRot90 = await page.evaluate(() => {
      const card = document.querySelector('.page-card:nth-child(1)');
      return card && card.classList.contains('rotated-90');
    });
    assert.strictEqual(card1HasRot90, true, 'Card 1 harus memiliki kelas rotated-90 setelah klik rotate right');
    console.log('  ✓ Tombol rotate right berhasil memutar halaman 90 derajat searah jarum jam.');

    // 4. Test rotate left (-90°) on card 2 (0 - 90 = 270)
    await page.click('.page-card:nth-child(2) .page-action-rotate-left');
    const card2HasRot270 = await page.evaluate(() => {
      const card = document.querySelector('.page-card:nth-child(2)');
      return card && card.classList.contains('rotated-270');
    });
    assert.strictEqual(card2HasRot270, true, 'Card 2 harus memiliki kelas rotated-270 setelah klik rotate left');
    console.log('  ✓ Tombol rotate left berhasil memutar halaman 90 derajat berlawanan arah jarum jam (+270°).');

    // 5. Test delete page on card 2
    await page.click('.page-card:nth-child(2) .page-action-delete');
    // Wait for card 2 to be hidden
    await page.waitForFunction(() => {
      const c2 = document.querySelector('.page-card:nth-child(2)');
      return c2 && c2.style.display === 'none';
    }, { timeout: 3000 });
    console.log('  ✓ Tombol delete berhasil menyembunyikan kartu halaman.');

    // Toast with Undo action should appear
    const toastAppeared = await page.waitForSelector('.toast', { timeout: 3000 });
    assert(toastAppeared, 'Toast notifikasi harus muncul setelah menghapus halaman');

    // 6. Test delete page on card 1
    await page.click('.page-card:nth-child(1) .page-action-delete');
    await page.waitForFunction(() => {
      const c1 = document.querySelector('.page-card:nth-child(1)');
      return c1 && c1.style.display === 'none';
    }, { timeout: 3000 });

    // 7. Try to delete the last remaining page (card 3) -> should be prevented!
    await page.click('.page-card:nth-child(3) .page-action-delete');
    await page.waitForTimeout(300);
    const card3StillVisible = await page.evaluate(() => {
      const c3 = document.querySelector('.page-card:nth-child(3)');
      return c3 && c3.style.display !== 'none';
    });
    assert.strictEqual(card3StillVisible, true, 'Halaman terakhir tidak boleh dihapus (minimal 1 halaman harus tersisa)');
    console.log('  ✓ Validasi minimal 1 halaman tersisa bekerja dengan benar.');

    // 8. Test Apply Rotation produces rotated & pruned PDF
    await page.click('#applyRotateBtn');
    await page.waitForSelector('#resultArea.active', { timeout: 8000 });
    console.log('  ✓ Tombol Apply Rotation berhasil memproses PDF.');

    console.log('\n🎉 SELURUH PENGUJIAN TOMBOL AKSI ROTATE & HAPUS HALAMAN LULUS!\n');
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  (async () => {
    const server = await startTestServer(8798);
    const browser = await launchChromium();
    try {
      await runRotatePageActionsSuite(browser, 'http://127.0.0.1:8798');
    } finally {
      await browser.close();
      server.close();
    }
  })().catch(err => {
    console.error('Test error:', err);
    process.exit(1);
  });
}

module.exports = { runRotatePageActionsSuite };
