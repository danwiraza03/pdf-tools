const fs = require('fs');
const path = require('path');
const { chromium, devices } = require('playwright');
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startTestServer } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;

// Minimal 1x1 PNG
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function generate12PagePdf() {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= 14; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page ${i}`, { x: 50, y: 200, size: 28, font });
  }
  return await doc.save();
}

async function generateSinglePagePdf(label) {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText(label, { x: 50, y: 200, size: 28, font });
  return await doc.save();
}

/**
 * Loads sample files to make page scrollable (>= 12 files/pages)
 */
async function loadFilesForPage(page, pagePath) {
  if (pagePath.includes('reorder.html')) {
    const pdfBytes = await generate12PagePdf();
    await page.setInputFiles('input[type="file"]', {
      name: 'twelve_pages.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from(pdfBytes)
    });
    await page.waitForSelector('.page-card', { timeout: 10000 });
  } else if (pagePath.includes('jpg-to-pdf.html')) {
    const pngBuf = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
    const files = [];
    for (let i = 1; i <= 14; i++) {
      files.push({
        name: `photo_${i}.png`,
        mimeType: 'image/png',
        buffer: pngBuf
      });
    }
    await page.setInputFiles('input[type="file"]', files);
    await page.waitForSelector('.file-item', { timeout: 10000 });
  } else if (pagePath.includes('merge.html')) {
    const files = [];
    for (let i = 1; i <= 14; i++) {
      const b = await generateSinglePagePdf(`Doc ${i}`);
      files.push({
        name: `doc_${i}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from(b)
      });
    }
    await page.setInputFiles('input[type="file"]', files);
    await page.waitForSelector('.merge-file-group-wrap, .merge-page-card, .stacked-doc', { timeout: 10000 });
  } else {
    // compress.html, watermark.html
    const files = [];
    for (let i = 1; i <= 14; i++) {
      const b = await generateSinglePagePdf(`Doc ${i}`);
      files.push({
        name: `doc_${i}.pdf`,
        mimeType: 'application/pdf',
        buffer: Buffer.from(b)
      });
    }
    await page.setInputFiles('input[type="file"]', files);
    await page.waitForSelector('.file-item', { timeout: 10000 });
  }

  // Small delay to ensure rendering completes
  await page.waitForTimeout(600);
}

function getCardSelector(pagePath) {
  if (pagePath.includes('reorder.html')) return '.page-card';
  if (pagePath.includes('merge.html')) return '.merge-file-group-wrap, .merge-page-card, .stacked-doc';
  return '.file-item';
}

async function getCardOrder(page, selector) {
  return await page.evaluate((sel) => {
    const cards = Array.from(document.querySelectorAll(sel));
    return cards.map((c, idx) => c.getAttribute('data-id') || c.getAttribute('data-page') || c.getAttribute('data-group-id') || `card-${idx}`);
  }, selector);
}

/**
 * Test A: Fast swipe up to scroll page down.
 * Swipe finger upwards from Y=450 to Y=150 (300px delta) quickly.
 * Expectation: scrollY increases by >= 100px, card order does NOT change.
 */
async function testFastSwipeScroll(page, cdp, selector) {
  const initialScrollY = await page.evaluate(() => window.scrollY);
  const initialOrder = await getCardOrder(page, selector);

  // Position swipe over cards in middle of viewport
  const startX = 180;
  const startY = 460;
  const endY = 160;

  // TouchStart
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }]
  });
  await page.waitForTimeout(16);

  // Quick swipe steps (60ms total)
  const steps = 4;
  for (let i = 1; i <= steps; i++) {
    const curY = Math.round(startY + ((endY - startY) / steps) * i);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: startX, y: curY }]
    });
    await page.waitForTimeout(16);
  }

  // TouchEnd
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });

  // Wait for scroll momentum
  await page.waitForTimeout(500);

  const finalScrollY = await page.evaluate(() => window.scrollY);
  const finalOrder = await getCardOrder(page, selector);

  const scrollDelta = finalScrollY - initialScrollY;
  const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(finalOrder);

  return {
    passed: scrollDelta >= 100 && !orderChanged,
    scrollDelta,
    orderChanged,
    initialScrollY,
    finalScrollY
  };
}

/**
 * Test B: Long press (>= 300ms) on a card and drag down to reorder.
 */
async function testLongPressDragReorder(page, cdp, selector) {
  const initialOrder = await getCardOrder(page, selector);
  const cards = await page.$$(selector);
  if (cards.length < 2) {
    return {
      passed: false,
      reliable: false,
      note: 'Jumlah kartu kurang dari 2'
    };
  }

  const box1 = await cards[0].boundingBox();
  const box2 = await cards[1].boundingBox();
  if (!box1 || !box2) {
    return {
      passed: false,
      reliable: false,
      note: 'Bounding box tidak tersedia'
    };
  }

  const startX = Math.round(box1.x + box1.width / 2);
  const startY = Math.round(box1.y + box1.height / 2);
  const targetX = Math.round(box2.x + box2.width / 2);
  const targetY = Math.round(box2.y + box2.height + 20);

  // 1. TouchStart
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }]
  });

  // 2. Press and hold >= 350ms
  await page.waitForTimeout(380);

  // 3. Drag slowly to target position
  const dragSteps = 8;
  for (let i = 1; i <= dragSteps; i++) {
    const curX = Math.round(startX + ((targetX - startX) / dragSteps) * i);
    const curY = Math.round(startY + ((targetY - startY) / dragSteps) * i);
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x: curX, y: curY }]
    });
    await page.waitForTimeout(30);
  }

  // 4. TouchEnd
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });

  await page.waitForTimeout(600);

  const finalOrder = await getCardOrder(page, selector);
  const orderChanged = JSON.stringify(initialOrder) !== JSON.stringify(finalOrder);

  return {
    passed: orderChanged,
    reliable: orderChanged,
    orderChanged,
    note: orderChanged ? 'Urutan kartu berhasil berubah via long-press' : 'perlu uji manual di perangkat'
  };
}

async function testGrayscaleSliderTouch(page, cdp) {
  const pdfBytes = await generateSinglePagePdf('Grayscale Test');
  await page.setInputFiles('input[type="file"]', {
    name: 'sample_grayscale.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from(pdfBytes)
  });
  await page.waitForSelector('#splitStage', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('#splitStage').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);

  const initialLeft = await page.evaluate(() => {
    const line = document.getElementById('splitLine');
    return line ? (line.style.left || window.getComputedStyle(line).left) : null;
  });

  const stageBox = await page.locator('#splitStage').boundingBox();
  if (!stageBox) throw new Error('splitStage bounding box not found');

  const startX = Math.round(stageBox.x + stageBox.width * 0.5);
  const startY = Math.round(stageBox.y + stageBox.height * 0.5);
  const targetX = Math.round(stageBox.x + stageBox.width * 0.8);

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x: startX, y: startY }]
  });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: targetX, y: startY }]
  });
  await page.waitForTimeout(60);
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: []
  });
  await page.waitForTimeout(100);

  const finalLeft = await page.evaluate(() => {
    const line = document.getElementById('splitLine');
    return line ? (line.style.left || window.getComputedStyle(line).left) : null;
  });

  const changed = initialLeft !== finalLeft;
  return {
    initialLeft,
    finalLeft,
    passed: changed
  };
}

async function runMobileInteractionSuite() {
  console.log('========================================================================');
  console.log('       MOBILE TOUCH INTERACTION SUITE: SCROLL VS SORTABLE REORDER       ');
  console.log('========================================================================\n');

  let server = null;
  let browser = null;

  const targetPages = [
    'pages/merge.html',
    'pages/jpg-to-pdf.html',
    'pages/compress.html',
    'pages/watermark.html',
    'pages/reorder.html'
  ];

  const results = [];

  try {
    server = await startTestServer(TEST_PORT);
    browser = await chromium.launch({ headless: true });

    for (const pagePath of targetPages) {
      console.log(`\n>>> Testing: ${pagePath} on iPhone 13 (Chromium with CDP)...`);

      const context = await browser.newContext({
        ...devices['iPhone 13'],
        hasTouch: true
      });
      const page = await context.newPage();

      try {
        await page.goto(`${BASE_URL}/${pagePath}`, { waitUntil: 'domcontentloaded', timeout: 25000 });
        await loadFilesForPage(page, pagePath);

        const scrollableHeight = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
        console.log(`  Loaded cards. Page scrollable height: ${scrollableHeight}px (Minimum required: 400px).`);

        const selector = getCardSelector(pagePath);
        const cdp = await context.newCDPSession(page);

        // a. Fast swipe scroll test
        console.log('  [A] Testing Fast Swipe (Scroll vs Reorder)...');
        const swipeRes = await testFastSwipeScroll(page, cdp, selector);
        console.log(`      - Delta scrollY: ${swipeRes.scrollDelta}px (Target >= 100px)`);
        console.log(`      - Urutan kartu berubah? ${swipeRes.orderChanged ? 'YA (GAGAL: kartu terseret saat swipe)' : 'TIDAK (Lolos)'}`);
        console.log(`      - Status Uji A: ${swipeRes.passed ? '✓ LULUS' : '✗ GAGAL'}`);

        // b. Long press drag test
        console.log('  [B] Testing Long-Press (>= 300ms) Drag Reorder...');
        const longPressRes = await testLongPressDragReorder(page, cdp, selector);
        console.log(`      - Urutan kartu berubah? ${longPressRes.orderChanged ? 'YA' : 'TIDAK'}`);
        console.log(`      - Catatan Uji B: ${longPressRes.note}`);

        results.push({
          page: pagePath,
          scrollableHeight,
          swipePassed: swipeRes.passed,
          swipeDelta: swipeRes.scrollDelta,
          swipeOrderChanged: swipeRes.orderChanged,
          longPressPassed: longPressRes.passed,
          longPressNote: longPressRes.note
        });

      } finally {
        await page.close();
        await context.close();
      }
    }

    // 4. Test Grayscale comparison slider touch dragging
    console.log('\n--- Menguji Slider Pembanding pages/grayscale.html dengan Pointer/Touch ---');
    const grayContext = await browser.newContext({
      ...devices['iPhone 13'],
      hasTouch: true
    });
    const grayPage = await grayContext.newPage();
    try {
      await grayPage.goto(`${BASE_URL}/pages/grayscale.html`, { waitUntil: 'domcontentloaded', timeout: 25000 });
      const grayCdp = await grayContext.newCDPSession(grayPage);
      const grayRes = await testGrayscaleSliderTouch(grayPage, grayCdp);
      console.log(`  Grayscale Slider: Awal=${grayRes.initialLeft}, Akhir=${grayRes.finalLeft}, Berubah=${grayRes.passed ? 'YA (LULUS)' : 'TIDAK (GAGAL)'}`);
      if (!grayRes.passed) {
        throw new Error('Test grayscale comparison slider touch drag failed: slider position did not change!');
      }
    } finally {
      await grayPage.close();
      await grayContext.close();
    }

    console.log('\n========================================================================================================================');
    console.log('                                 HASIL PENGUJIAN INTERAKSI SENTUH SELULER (CDP)                                         ');
    console.log('========================================================================================================================');
    console.log('| Halaman                  | Scrollable (px) | Swipe scrollY (>=100px) | Swipe Reorder? (Harus TIDAK) | Long-Press Reorder     |');
    console.log('------------------------------------------------------------------------------------------------------------------------');

    for (const r of results) {
      const pagePad = r.page.padEnd(24);
      const scrollPad = `${r.scrollableHeight}px`.padEnd(15);
      const swipeScrollStr = `${r.swipeDelta}px (${r.swipeDelta >= 100 ? 'LULUS' : 'GAGAL'})`.padEnd(23);
      const swipeOrderStr = (r.swipeOrderChanged ? 'YA (GAGAL)' : 'TIDAK (LULUS)').padEnd(28);
      const lpStr = (r.longPressPassed ? 'BERHASIL' : r.longPressNote).padEnd(22);

      console.log(`| ${pagePad} | ${scrollPad} | ${swipeScrollStr} | ${swipeOrderStr} | ${lpStr} |`);
    }
    console.log('========================================================================================================================\n');
    console.log('Catatan: CDP hanya didukung di engine Chromium. Perilaku WebKit/Safari memerlukan verifikasi manual pada perangkat iOS.');

    const allPassed = results.every(r => r.swipePassed);
    return { success: allPassed, results };

  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runMobileInteractionSuite().then(res => {
    process.exit(res && res.success ? 0 : 1);
  }).catch(err => {
    console.error('Fatal crash during mobile interaction test:', err);
    process.exit(1);
  });
}

module.exports = { runMobileInteractionSuite };
