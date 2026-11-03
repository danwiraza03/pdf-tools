/**
 * PDF Tools — Browser Test: Merge Card Controls & Drag Handle Non-Overlap
 * Verifies that the drag handle never overlaps card controls (rotate, zoom, delete, checkbox, badge),
 * that elementFromPoint at each button returns the button, that delete works, and that touch targets
 * meet the >= 44x44 px requirement on touch viewports.
 */

'use strict';

const assert = require('assert');
const path = require('path');
const { chromium } = require('playwright');
const helpers = require('./helpers');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

async function createMultiPagePdf(count = 3) {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < count; i++) {
    const page = doc.addPage([400, 400]);
    const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
    page.drawText(`Page ${i + 1} of ${count}`, { x: 50, y: 200, size: 24, font });
  }
  return await doc.save();
}

function rectsOverlap(r1, r2, tolerance = 1) {
  return !(
    r1.right <= r2.left + tolerance ||
    r1.left >= r2.right - tolerance ||
    r1.bottom <= r2.top + tolerance ||
    r1.top >= r2.bottom - tolerance
  );
}

const VIEWPORT_CONFIGS = [
  { name: 'Mobile 360px (Touch)', width: 360, height: 740, hasTouch: true, isMobile: true },
  { name: 'Mobile 390px (Touch)', width: 390, height: 844, hasTouch: true, isMobile: true },
  { name: 'Mobile 430px (Touch)', width: 430, height: 932, hasTouch: true, isMobile: true },
  { name: 'Tablet/Desktop 1280px (Touch)', width: 1280, height: 800, hasTouch: true, isMobile: true },
  { name: 'Desktop 1280px (Non-touch)', width: 1280, height: 800, hasTouch: false, isMobile: false }
];

async function runMergeCardControlsSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       MERGE PAGE: CARD CONTROLS & DRAG HANDLE AUDIT SUITE              ');
  console.log('========================================================================\n');

  const pdfBytes = await createMultiPagePdf(4);

  for (const vp of VIEWPORT_CONFIGS) {
    console.log(`>>> Testing Viewport: ${vp.name} (${vp.width}x${vp.height}, hasTouch=${vp.hasTouch})`);
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      hasTouch: vp.hasTouch,
      isMobile: vp.isMobile
    });
    const page = await context.newPage();

    try {
      await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });

      // 1. Upload multi-page PDF via file input
      await page.setInputFiles('input[type="file"]', {
        name: 'sample_4p.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from(pdfBytes)
      });

      await page.waitForSelector('#organizerArea:not([style*="display: none"])', { timeout: 10000 });
      await page.waitForSelector('.merge-page-card', { timeout: 10000 });

      // Wait a moment for layout stabilization
      await page.waitForTimeout(300);

      // --- PHASE A: Stacked Document Card View ---
      console.log('  [A] Checking Stacked Document Cards View ...');
      const stackedAudit = await page.evaluate((isTouch) => {
        const issues = [];
        const cards = Array.from(document.querySelectorAll('.merge-page-card.stacked-doc'));
        if (cards.length === 0) {
          issues.push('No stacked document cards found');
          return { issues, count: 0 };
        }

        cards.forEach((card, cIdx) => {
          const handle = card.querySelector('.stacked-doc-handle');
          if (!handle) {
            issues.push(`Stacked card #${cIdx + 1} has no .stacked-doc-handle`);
            return;
          }

          const hRect = handle.getBoundingClientRect();
          // In touch mode, the handle must be displayed and >= 44x44
          if (isTouch) {
            if (hRect.width < 43.5 || hRect.height < 43.5) {
              issues.push(`Stacked card #${cIdx + 1} handle is smaller than 44x44px (${hRect.width.toFixed(1)}x${hRect.height.toFixed(1)})`);
            }
          }

          // Checkboxes and badges
          const check = card.querySelector('.merge-card-select-check');
          const badges = Array.from(card.querySelectorAll('.merge-card-badge, .merge-card-count-badge'));
          const otherControls = [check, ...badges].filter(Boolean);

          otherControls.forEach(ctrl => {
            const cRect = ctrl.getBoundingClientRect();
            if (cRect.width > 0 && cRect.height > 0) {
              const overlap = !(
                hRect.right <= cRect.left + 1 ||
                hRect.left >= cRect.right - 1 ||
                hRect.bottom <= cRect.top + 1 ||
                hRect.top >= cRect.bottom - 1
              );
              if (overlap) {
                issues.push(`Stacked card #${cIdx + 1} handle overlaps control .${ctrl.className} (handle: [${hRect.left.toFixed(0)},${hRect.top.toFixed(0)},${hRect.right.toFixed(0)},${hRect.bottom.toFixed(0)}] vs ctrl: [${cRect.left.toFixed(0)},${cRect.top.toFixed(0)},${cRect.right.toFixed(0)},${cRect.bottom.toFixed(0)}])`);
              }
            }
          });
        });

        return { issues, count: cards.length };
      }, vp.hasTouch);

      if (stackedAudit.issues.length > 0) {
        throw new Error(`Stacked doc card issues:\n  - ${stackedAudit.issues.join('\n  - ')}`);
      }
      console.log(`    ✓ Stacked document view clean (${stackedAudit.count} cards tested)`);

      // --- PHASE B: Expanded Page Cards View ---
      console.log('  [B] Expanding all pages & checking Expanded Page Cards ...');
      await page.click('#expandAllBtn');
      await page.waitForFunction(() => document.querySelectorAll('.merge-page-card.expanded-page').length >= 4, { timeout: 8000 });
      await page.waitForTimeout(300);

      const expandedAudit = await page.evaluate(async (isTouch) => {
        const issues = [];
        const cards = Array.from(document.querySelectorAll('.merge-page-card.expanded-page'));
        if (cards.length === 0) {
          issues.push('No expanded page cards found');
          return { issues, count: 0 };
        }

        for (let cIdx = 0; cIdx < cards.length; cIdx++) {
          const card = cards[cIdx];
          card.scrollIntoView({ behavior: 'instant', block: 'center' });
          // brief pause to allow viewport geometry to settle
          await new Promise(r => setTimeout(r, 20));

          const handle = card.querySelector('.expanded-page-handle');
          if (!handle) {
            issues.push(`Expanded card #${cIdx + 1} has no .expanded-page-handle`);
            continue;
          }

          const hRect = handle.getBoundingClientRect();
          if (isTouch) {
            if (hRect.width < 43.5 || hRect.height < 43.5) {
              issues.push(`Expanded card #${cIdx + 1} handle smaller than 44x44px (${hRect.width.toFixed(1)}x${hRect.height.toFixed(1)})`);
            }
          }

          // Individual controls on expanded card
          const rotateBtn = card.querySelector('.merge-card-mini-btn[title*="Rotate"], .merge-card-header-actions button:first-child');
          const zoomBtn = card.querySelector('.merge-card-mini-btn[title*="Preview"], .merge-card-mini-btn.zoom-btn');
          const deleteBtn = card.querySelector('.merge-card-mini-btn.delete-btn');
          const check = card.querySelector('.merge-card-select-check');
          const badges = Array.from(card.querySelectorAll('.merge-card-badge, .merge-page-badge, .merge-card-orig-badge'));

          const buttons = [
            { name: 'rotateBtn', el: rotateBtn },
            { name: 'zoomBtn', el: zoomBtn },
            { name: 'deleteBtn', el: deleteBtn }
          ].filter(b => b.el);

          // 1. Touch target size check (>= 44x44 on touch)
          if (isTouch) {
            buttons.forEach(b => {
              const bRect = b.el.getBoundingClientRect();
              if (bRect.width < 43.5 || bRect.height < 43.5) {
                issues.push(`Expanded card #${cIdx + 1} button ${b.name} is smaller than 44x44px (${bRect.width.toFixed(1)}x${bRect.height.toFixed(1)})`);
              }
            });
          }

          // 2. Overlap check: handle must not intersect with rotate, zoom, delete, check, badges
          const allControls = [
            ...buttons,
            { name: 'checkbox', el: check },
            ...badges.map((b, i) => ({ name: `badge_${i}`, el: b }))
          ].filter(item => item.el);

          allControls.forEach(ctrl => {
            const cRect = ctrl.el.getBoundingClientRect();
            if (cRect.width > 0 && cRect.height > 0) {
              const overlap = !(
                hRect.right <= cRect.left + 1 ||
                hRect.left >= cRect.right - 1 ||
                hRect.bottom <= cRect.top + 1 ||
                hRect.top >= cRect.bottom - 1
              );
              if (overlap) {
                issues.push(`Expanded card #${cIdx + 1} handle overlaps ${ctrl.name} (handle: [top=${hRect.top.toFixed(0)}, right=${hRect.right.toFixed(0)}, btm=${hRect.bottom.toFixed(0)}, left=${hRect.left.toFixed(0)}] vs ${ctrl.name}: [top=${cRect.top.toFixed(0)}, right=${cRect.right.toFixed(0)}, btm=${cRect.bottom.toFixed(0)}, left=${cRect.left.toFixed(0)}])`);
              }
            }
          });

          // 3. elementFromPoint check: button center must return the button itself or child
          buttons.forEach(b => {
            const bRect = b.el.getBoundingClientRect();
            const cx = bRect.left + bRect.width / 2;
            const cy = bRect.top + bRect.height / 2;
            const topEl = document.elementFromPoint(cx, cy);
            if (!topEl) {
              issues.push(`Expanded card #${cIdx + 1} ${b.name} center (${cx.toFixed(0)}, ${cy.toFixed(0)}) has no elementFromPoint`);
            } else if (!b.el.contains(topEl) && topEl !== b.el) {
              issues.push(`Expanded card #${cIdx + 1} ${b.name} obscured by <${topEl.tagName.toLowerCase()} class="${topEl.className}"> at center (${cx.toFixed(0)}, ${cy.toFixed(0)})`);
            }
          });
        }

        return { issues, count: cards.length };
      }, vp.hasTouch);

      if (expandedAudit.issues.length > 0) {
        throw new Error(`Expanded card issues:\n  - ${expandedAudit.issues.join('\n  - ')}`);
      }
      console.log(`    ✓ Expanded page cards clean (${expandedAudit.count} cards tested)`);

      // --- PHASE C: Deleting page via button actually removes the page ---
      console.log('  [C] Testing delete button functionality ...');
      const countBefore = await page.evaluate(() => document.querySelectorAll('.merge-page-card.expanded-page').length);
      assert(countBefore >= 2, 'Should have at least 2 pages before delete');

      const firstDeleteBtn = await page.$('.merge-page-card.expanded-page .merge-card-mini-btn.delete-btn');
      assert(firstDeleteBtn, 'First delete button must exist');
      await firstDeleteBtn.click();

      await page.waitForFunction((initial) => {
        const current = document.querySelectorAll('.merge-page-card.expanded-page').length;
        return current === initial - 1;
      }, countBefore, { timeout: 6000 });

      const countAfter = await page.evaluate(() => document.querySelectorAll('.merge-page-card.expanded-page').length);
      assert.strictEqual(countAfter, countBefore - 1, 'Deleting page must decrease page count by 1');
      console.log(`    ✓ Delete button successfully deleted page (${countBefore} -> ${countAfter})`);

    } finally {
      await context.close();
    }
  }

  console.log('\n✓ [PASS] All Merge Card Controls tests passed across all viewports!');
  return true;
}

if (require.main === module) {
  (async () => {
    const server = await helpers.startTestServer(8130);
    const browser = await chromium.launch({ headless: true });
    try {
      await runMergeCardControlsSuite(browser, 'http://127.0.0.1:8130');
    } finally {
      await browser.close();
      await server.close();
    }
  })().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runMergeCardControlsSuite };
