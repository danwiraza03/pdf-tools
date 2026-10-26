const fs = require('fs');
const path = require('path');
const { chromium, webkit, devices } = require('playwright');
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startTestServer } = require('./helpers');

const TEST_PORT = 8765;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}`;
const SCREENSHOT_DIR = path.resolve(__dirname, 'screenshots');

// Ensure screenshots directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate sample multi-page PDF for reorder
async function generate6PagePdf() {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= 6; i++) {
    const page = doc.addPage([300, 400]);
    page.drawText(`Page ${i}`, { x: 50, y: 200, size: 28, font });
  }
  return await doc.save();
}

// Generate single-page sample PDF
async function generate1PagePdf(label = 'Page') {
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  const page = doc.addPage([300, 400]);
  page.drawText(label, { x: 50, y: 200, size: 28, font });
  return await doc.save();
}

// Minimal 1x1 transparent/red PNG
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function auditPageOnDevice(browser, deviceConfig, pagePath) {
  const context = await browser.newContext({
    ...deviceConfig.descriptor,
    hasTouch: true
  });

  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  page.on('pageerror', err => {
    pageErrors.push(err.message || String(err));
  });

  let loadSuccess = false;
  let overflow = { hasOverflow: false, overflowPx: 0, scrollWidth: 0, viewportWidth: 0 };
  let touchTargets = { count: 0, samples: [] };
  let clipped = { count: 0, samples: [] };

  try {
    const url = `${BASE_URL}/${pagePath}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(300);
    loadSuccess = true;

    // 1. Measure Horizontal Overflow
    overflow = await page.evaluate(() => {
      const scrollW = document.documentElement.scrollWidth;
      const clientW = window.innerWidth;
      const hasOverflow = scrollW > clientW;
      return {
        hasOverflow,
        scrollWidth: scrollW,
        viewportWidth: clientW,
        overflowPx: Math.max(0, scrollW - clientW)
      };
    });

    // 2. Interactive elements < 44px
    touchTargets = await page.evaluate(() => {
      const interactive = Array.from(document.querySelectorAll('button, a[href], input, select, label'));
      const small = [];
      for (const el of interactive) {
        if (el.tagName.toLowerCase() === 'input' && el.type === 'file') continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.width < 44 || r.height < 44) {
          small.push({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.value || el.id || el.className || '').trim().substring(0, 25),
            w: Math.round(r.width),
            h: Math.round(r.height)
          });
        }
      }
      return {
        count: small.length,
        samples: small.slice(0, 3)
      };
    });

    // 3. Elements clipped / partially out of screen (ignoring intentional offscreen drawers & visually-hidden elements)
    clipped = await page.evaluate(() => {
      const all = Array.from(document.querySelectorAll('body *'));
      const vw = window.innerWidth;
      const off = [];
      for (const el of all) {
        // Ignore intentional offscreen elements: mobile drawer, backdrop, visually hidden
        if (el.closest('.mobile-nav-panel') || el.closest('.mobile-nav-backdrop') || el.classList.contains('mobile-nav-panel') || el.classList.contains('visually-hidden') || el.classList.contains('sr-only')) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -1 || r.right > vw + 1) {
          // Avoid noise from ancestor containers if child is already identified
          const hasClippedChild = Array.from(el.children).some(c => {
            const cr = c.getBoundingClientRect();
            return cr.left < -1 || cr.right > vw + 1;
          });
          if (!hasClippedChild) {
            off.push({
              tag: el.tagName.toLowerCase(),
              id: el.id || '',
              cls: (el.className && typeof el.className === 'string') ? el.className.substring(0, 30) : '',
              left: Math.round(r.left),
              right: Math.round(r.right),
              vw
            });
          }
        }
      }
      return {
        count: off.length,
        samples: off.slice(0, 3)
      };
    });

    // 4. Capture Screenshot
    const pageSlug = pagePath.replace(/\.html$/i, '').replace(/[\/\\]/g, '_');
    const deviceSlug = deviceConfig.name.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const screenshotName = `${pageSlug}_${deviceSlug}.png`;
    const screenshotPath = path.join(SCREENSHOT_DIR, screenshotName);
    await page.screenshot({ path: screenshotPath, fullPage: false });

  } catch (err) {
    pageErrors.push(`Failed to audit page: ${err.message || String(err)}`);
  } finally {
    await page.close();
    await context.close();
  }

  // Calculate severity score
  // Console errors: 100pts each | Overflow: 50pts + overflowPx | Clipped: 0pts | Target <44px: 1pt
  const severityScore =
    (consoleErrors.length + pageErrors.length) * 100 +
    (overflow.hasOverflow ? (50 + Math.min(100, overflow.overflowPx)) : 0) +
    touchTargets.count * 1;

  return {
    page: pagePath,
    device: deviceConfig.name,
    browserType: deviceConfig.browserType,
    loadSuccess,
    hasOverflow: overflow.hasOverflow,
    overflowPx: overflow.overflowPx,
    consoleErrorsCount: consoleErrors.length,
    pageErrorsCount: pageErrors.length,
    smallTargetsCount: touchTargets.count,
    clippedElementsCount: clipped.count,
    severityScore,
    consoleErrors,
    pageErrors,
    touchTargetSamples: touchTargets.samples,
    clippedSamples: clipped.samples
  };
}

/**
 * Audit touch interaction on SortableJS list:
 * - Load 6 sample files/pages
 * - Dispatch vertical touch drag using CDP (Input.dispatchTouchEvent)
 * - Record: (a) scrollY changed? (b) card order changed?
 */
async function auditSortableTouch(browser, deviceConfig, pagePath) {
  const context = await browser.newContext({
    ...deviceConfig.descriptor,
    hasTouch: true
  });
  const page = await context.newPage();

  let scrollYChanged = false;
  let scrollDelta = 0;
  let cardOrderChanged = false;
  let cardCount = 0;
  let touchLog = '';

  try {
    const url = `${BASE_URL}/${pagePath}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(400);

    // Prepare files according to page requirements
    if (pagePath.includes('reorder.html')) {
      const sixPagePdf = await generate6PagePdf();
      await page.setInputFiles('input[type="file"]', {
        name: 'multipage6.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(sixPagePdf)
      });
      // Wait for 6 page-card elements
      await page.waitForSelector('.page-card', { timeout: 8000 });
    } else if (pagePath.includes('jpg-to-pdf.html')) {
      const pngBuf = Buffer.from(SAMPLE_PNG_BASE64, 'base64');
      const files = [1, 2, 3, 4, 5, 6].map(i => ({
        name: `photo_${i}.png`,
        mimeType: 'image/png',
        buffer: pngBuf
      }));
      await page.setInputFiles('input[type="file"]', files);
      await page.waitForSelector('.file-item', { timeout: 8000 });
    } else if (pagePath.includes('merge.html')) {
      const files = [];
      for (let i = 1; i <= 6; i++) {
        const b = await generate1PagePdf(`Doc ${i}`);
        files.push({
          name: `doc_${i}.pdf`,
          mimeType: 'application/pdf',
          buffer: Buffer.from(b)
        });
      }
      await page.setInputFiles('input[type="file"]', files);
      await page.waitForSelector('.merge-file-group-wrap, .merge-page-card, .stacked-doc', { timeout: 8000 });
    } else {
      // compress.html, watermark.html
      const files = [];
      for (let i = 1; i <= 6; i++) {
        const b = await generate1PagePdf(`Doc ${i}`);
        files.push({
          name: `doc_${i}.pdf`,
          mimeType: 'application/pdf',
          buffer: Buffer.from(b)
        });
      }
      await page.setInputFiles('input[type="file"]', files);
      await page.waitForSelector('.file-item', { timeout: 8000 });
    }

    await page.waitForTimeout(600);

    // Get cards
    const initialOrder = await page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('.file-item, .page-card, .merge-file-group-wrap, .merge-page-card'));
      return cards.map((c, idx) => c.getAttribute('data-id') || c.getAttribute('data-page') || c.getAttribute('data-group-id') || `card-${idx}`);
    });
    cardCount = initialOrder.length;

    const initialScrollY = await page.evaluate(() => window.scrollY);

    // Find card to touch
    const cardHandle = await page.$('.file-item, .page-card, .merge-file-group-wrap, .merge-page-card');
    if (cardHandle) {
      const box = await cardHandle.boundingBox();
      if (box) {
        const startX = Math.round(box.x + box.width / 2);
        const startY = Math.round(box.y + box.height / 2);

        // Open CDP session
        const client = await context.newCDPSession(page);

        // Dispatch TouchStart
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchStart',
          touchPoints: [{ x: startX, y: startY }]
        });
        await page.waitForTimeout(30);

        // Dispatch vertical swipe (drag finger vertically downwards by 180px)
        const dragDistance = 180;
        const dragSteps = 10;
        for (let s = 1; s <= dragSteps; s++) {
          const currentY = Math.round(startY + (dragDistance / dragSteps) * s);
          await client.send('Input.dispatchTouchEvent', {
            type: 'touchMove',
            touchPoints: [{ x: startX, y: currentY }]
          });
          await page.waitForTimeout(25);
        }

        // Dispatch TouchEnd
        await client.send('Input.dispatchTouchEvent', {
          type: 'touchEnd',
          touchPoints: []
        });

        await page.waitForTimeout(500);

        const finalScrollY = await page.evaluate(() => window.scrollY);
        scrollDelta = Math.round(finalScrollY - initialScrollY);
        scrollYChanged = Math.abs(scrollDelta) > 2;

        const finalOrder = await page.evaluate(() => {
          const cards = Array.from(document.querySelectorAll('.file-item, .page-card, .merge-file-group-wrap, .merge-page-card'));
          return cards.map((c, idx) => c.getAttribute('data-id') || c.getAttribute('data-page') || c.getAttribute('data-group-id') || `card-${idx}`);
        });

        cardOrderChanged = JSON.stringify(initialOrder) !== JSON.stringify(finalOrder);
        touchLog = `Swipe vertikal 180px dari Y=${startY}. Kartu: ${cardCount}. Delta Scroll: ${scrollDelta}px.`;
      } else {
        touchLog = 'Card bounding box null';
      }
    } else {
      touchLog = 'Tidak ada elemen kartu ditemukan';
    }
  } catch (err) {
    touchLog = `Error saat touch interaction: ${err.message || String(err)}`;
  } finally {
    await page.close();
    await context.close();
  }

  return {
    page: pagePath,
    device: deviceConfig.name,
    cardCount,
    scrollYChanged,
    scrollDelta,
    cardOrderChanged,
    touchLog
  };
}

async function runMobileAuditSuite() {
  console.log('========================================================================');
  console.log('               MOBILE READINESS & TOUCH INTERACTION AUDIT               ');
  console.log('========================================================================\n');

  let server = null;
  let chromiumBrowser = null;
  let webkitBrowser = null;

  try {
    server = await startTestServer(TEST_PORT);
    console.log(`[Test Server] Standalone server active on ${BASE_URL}`);

    chromiumBrowser = await chromium.launch({ headless: true });
    console.log('[Browser] Chromium engine launched successfully.');

    // Check WebKit availability
    let hasWebKit = false;
    try {
      webkitBrowser = await webkit.launch({ headless: true });
      hasWebKit = true;
      console.log('[Browser] WebKit engine launched successfully.');
    } catch (e) {
      console.warn('[Browser] WebKit tidak tersedia / gagal dibuka:', e.message);
    }

    // Define Device Matrix
    const deviceMatrix = [
      {
        name: 'iPhone 13 (Chromium)',
        browser: chromiumBrowser,
        browserType: 'chromium',
        descriptor: devices['iPhone 13']
      },
      {
        name: 'Pixel 7 (Chromium)',
        browser: chromiumBrowser,
        browserType: 'chromium',
        descriptor: devices['Pixel 7']
      },
      {
        name: 'iPad (gen 7) (Chromium)',
        browser: chromiumBrowser,
        browserType: 'chromium',
        descriptor: devices['iPad (gen 7)']
      }
    ];

    if (hasWebKit && webkitBrowser) {
      deviceMatrix.push({
        name: 'iPhone 13 (WebKit)',
        browser: webkitBrowser,
        browserType: 'webkit',
        descriptor: devices['iPhone 13']
      });
    }

    // Collect all HTML pages except viewer.html
    const pagesDir = path.resolve(__dirname, '../../pages');
    const pageFiles = fs.readdirSync(pagesDir)
      .filter(f => f.endsWith('.html') && f !== 'viewer.html')
      .map(f => `pages/${f}`);
    
    const allPagesToAudit = ['index.html', ...pageFiles];
    console.log(`Auditing ${allPagesToAudit.length} pages across ${deviceMatrix.length} device configurations (${allPagesToAudit.length * deviceMatrix.length} total runs)...`);

    const auditResults = [];

    for (const dev of deviceMatrix) {
      console.log(`\n>>> Auditing on device: ${dev.name}...`);
      for (const pagePath of allPagesToAudit) {
        process.stdout.write(`  • ${pagePath.padEnd(24)} `);
        const res = await auditPageOnDevice(dev.browser, dev, pagePath);
        auditResults.push(res);
        const overflowStatus = res.hasOverflow ? `OVERFLOW (+${res.overflowPx}px)` : 'No Overflow';
        console.log(`[${overflowStatus.padEnd(18)}] [Touch <44px: ${String(res.smallTargetsCount).padStart(2)}] [Errors: ${res.consoleErrorsCount + res.pageErrorsCount}]`);
      }
    }

    // -------------------------------------------------------------------------
    // SortableJS Touch Drag vs Scroll Audit
    // -------------------------------------------------------------------------
    const sortablePages = [
      'pages/merge.html',
      'pages/reorder.html',
      'pages/jpg-to-pdf.html',
      'pages/compress.html',
      'pages/watermark.html'
    ];

    console.log('\n========================================================================');
    console.log('             SORTABLEJS TOUCH INTERACTION (DRAG VS SCROLL)              ');
    console.log('========================================================================');
    console.log('Testing vertical finger touch gestures over card lists via CDP...');

    const sortableResults = [];
    const mobileChromiumDevices = deviceMatrix.filter(d => d.browserType === 'chromium' && d.name.includes('iPhone'));

    for (const dev of mobileChromiumDevices) {
      for (const sp of sortablePages) {
        console.log(`  • Testing ${sp} on ${dev.name}...`);
        const sortRes = await auditSortableTouch(dev.browser, dev, sp);
        sortableResults.push(sortRes);
        console.log(`    - scrollY berubah? ${sortRes.scrollYChanged ? 'YA (' + sortRes.scrollDelta + 'px)' : 'TIDAK (0px)'}`);
        console.log(`    - Urutan kartu berubah? ${sortRes.cardOrderChanged ? 'YA' : 'TIDAK'}`);
      }
    }

    // -------------------------------------------------------------------------
    // Render Summary Table Sorted by Severity (Worst First)
    // -------------------------------------------------------------------------
    auditResults.sort((a, b) => b.severityScore - a.severityScore);

    console.log('\n\n========================================================================================================================');
    console.log('                                  HASIL AUDIT KESIAPAN SELULER (URUT DARI TERPARAH)                                     ');
    console.log('========================================================================================================================');
    console.log('| Halaman                  | Perangkat                | Overflow? (px)  | Error Konsol/Page | Target <44px | Elemen Keluar | Skor |');
    console.log('------------------------------------------------------------------------------------------------------------------------');

    for (const r of auditResults) {
      const pagePad = r.page.padEnd(24);
      const devPad = r.device.padEnd(24);
      const overflowStr = r.hasOverflow ? `YA (+${r.overflowPx}px)`.padEnd(15) : 'TIDAK'.padEnd(15);
      const errStr = `${r.consoleErrorsCount + r.pageErrorsCount}`.padEnd(17);
      const touchStr = `${r.smallTargetsCount}`.padEnd(12);
      const clipStr = `${r.clippedElementsCount}`.padEnd(13);
      const scoreStr = `${r.severityScore}`.padEnd(4);

      console.log(`| ${pagePad} | ${devPad} | ${overflowStr} | ${errStr} | ${touchStr} | ${clipStr} | ${scoreStr} |`);
    }
    console.log('========================================================================================================================\n');

    // Sortable Interaction Summary
    console.log('\n========================================================================================================================');
    console.log('                            HASIL INTERAKSI SENTUH SORTABLEJS (SWIPE VERTIKAL)                                          ');
    console.log('========================================================================================================================');
    console.log('| Halaman                  | Perangkat                | scrollY Berubah? (Scroll) | Urutan Berubah? (Reorder) | Diagnosis UX Sentuh |');
    console.log('------------------------------------------------------------------------------------------------------------------------');

    for (const s of sortableResults) {
      const pagePad = s.page.padEnd(24);
      const devPad = s.device.padEnd(24);
      const scrollStr = (s.scrollYChanged ? `YA (${s.scrollDelta}px)` : 'TIDAK (0px)').padEnd(25);
      const orderStr = (s.cardOrderChanged ? 'YA' : 'TIDAK').padEnd(25);
      
      let diagnosis = 'Aman (Dapat scroll)';
      if (!s.scrollYChanged && s.cardOrderChanged) {
        diagnosis = 'Kartu terseret bukan scroll';
      } else if (!s.scrollYChanged && !s.cardOrderChanged) {
        diagnosis = 'Terkunci (Gesture diblokir)';
      } else if (s.scrollYChanged && s.cardOrderChanged) {
        diagnosis = 'Konflik (Scroll dan reorder ganda)';
      }

      console.log(`| ${pagePad} | ${devPad} | ${scrollStr} | ${orderStr} | ${diagnosis.padEnd(19)} |`);
    }
    console.log('========================================================================================================================\n');

    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    return { success: true, auditResults, sortableResults };
  } catch (fatalErr) {
    console.error('Fatal crash during mobile audit:', fatalErr);
    return { success: false, error: fatalErr };
  } finally {
    if (chromiumBrowser) await chromiumBrowser.close();
    if (webkitBrowser) await webkitBrowser.close();
    if (server) server.close();
  }
}

if (require.main === module) {
  runMobileAuditSuite().then(res => {
    // Only fail if browser crashed
    process.exit(res && res.success ? 0 : 1);
  }).catch(err => {
    console.error('Crash in main runner:', err);
    process.exit(1);
  });
}

module.exports = { runMobileAuditSuite };
