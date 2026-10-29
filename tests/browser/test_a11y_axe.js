/**
 * Automated Accessibility (a11y) Verification Suite
 * Uses @axe-core/playwright to audit WCAG 2.1 Level AA compliance across:
 * - index.html
 * - all 22 standalone pages in pages/*.html (viewer.html strictly excluded per scope)
 *
 * Verifies:
 * 1. Zero 'critical' and zero 'serious' accessibility violations.
 * 2. Minor/moderate violations matched against tests/browser/a11y-baseline.json.
 * 3. Keyboard navigation: Skip-to-content receives focus on first Tab and shifts focus to #main-content.
 * 4. Dialog modal focus management: role="dialog", aria-modal="true", aria-labelledby, focus trap,
 *    and restoration of focus to trigger element upon Escape.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const AxeBuilder = require('@axe-core/playwright').default || require('@axe-core/playwright');
const { startTestServer, launchChromium } = require('./helpers');

const ROOT_DIR = path.resolve(__dirname, '../..');
const BASELINE_FILE = path.join(__dirname, 'a11y-baseline.json');

async function runA11ySuite(browser, baseUrl) {
  console.log('========================================================================');
  console.log('      AXE-CORE AUTOMATED ACCESSIBILITY AUDIT & KEYBOARD FOCUS TEST      ');
  console.log('========================================================================\n');

  const context = await browser.newContext();
  const page = await context.newPage();

  // Load baseline file if present
  let baseline = { critical: 0, serious: 0, pages: {} };
  if (fs.existsSync(BASELINE_FILE)) {
    try {
      baseline = JSON.parse(fs.readFileSync(BASELINE_FILE, 'utf8'));
    } catch (err) {
      console.warn('⚠️  Gagal membaca a11y-baseline.json, menggunakan default kosong:', err.message);
    }
  }

  // 1. Gather all target pages (index.html + 22 standalone pages, skipping viewer.html)
  const pagesDir = path.join(ROOT_DIR, 'pages');
  const pageFiles = fs.readdirSync(pagesDir)
    .filter(f => f.endsWith('.html') && f !== 'viewer.html')
    .map(f => `pages/${f}`);
  pageFiles.unshift('index.html');

  console.log(`Auditing accessibility with axe-core across ${pageFiles.length} pages...\n`);

  const auditFailures = [];

  for (const relPath of pageFiles) {
    const pageUrl = `${baseUrl}/${relPath}`;
    await page.goto(pageUrl);
    // Allow CSS animations (e.g. fadeInUp) to settle for accurate contrast calculation
    await page.waitForTimeout(450);

    const axeResults = await new AxeBuilder({ page }).analyze();
    const violations = axeResults.violations || [];

    const criticalOrSerious = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    if (criticalOrSerious.length > 0) {
      for (const viol of criticalOrSerious) {
        auditFailures.push({
          page: relPath,
          id: viol.id,
          impact: viol.impact,
          description: viol.description,
          nodes: viol.nodes.map(n => n.target.join(' '))
        });
      }
    }

    // Compare remaining violations against baseline
    const pageBaseline = (baseline.pages && baseline.pages[relPath]) || [];
    const baselineIds = new Set(pageBaseline.map(b => b.id || b));
    const unexpectedViolations = violations.filter(v => !baselineIds.has(v.id));

    if (unexpectedViolations.length > 0 && criticalOrSerious.length === 0) {
      for (const uv of unexpectedViolations) {
        auditFailures.push({
          page: relPath,
          id: uv.id,
          impact: uv.impact,
          description: `Unexpected violation exceeding baseline: ${uv.description}`,
          nodes: uv.nodes.map(n => n.target.join(' '))
        });
      }
    }
  }

  if (auditFailures.length > 0) {
    console.error(`❌ Ditemukan ${auditFailures.length} pelanggaran aksesibilitas:`);
    for (const f of auditFailures) {
      console.error(`  - [${f.page}] [${f.impact}] ${f.id}: ${f.description} (Nodes: ${f.nodes.join(', ')})`);
    }
    throw new Error(`A11y Axe audit gagal dengan ${auditFailures.length} pelanggaran.`);
  }

  console.log(`✅ [PASS] 0 pelanggaran kritis & serius di seluruh ${pageFiles.length} halaman publik.\n`);

  // 2. Keyboard Navigation Test: Skip link & main-content target
  console.log('--- Testing Keyboard Navigation: Skip-to-content ---');
  await page.goto(`${baseUrl}/index.html`);
  await page.waitForTimeout(300);

  await page.keyboard.press('Tab');
  const isSkipFocused = await page.evaluate(() => {
    return document.activeElement && document.activeElement.classList.contains('skip-link');
  });
  assert.strictEqual(isSkipFocused, true, 'Tombol skip-link harus menerima fokus pada penekanan tombol Tab pertama');
  console.log('  ✓ Skip link menerima fokus saat tombol Tab ditekan');

  await page.keyboard.press('Enter');
  const activeTargetId = await page.evaluate(() => {
    return document.activeElement ? document.activeElement.id : null;
  });
  assert.strictEqual(activeTargetId, 'main-content', 'Fokus harus berpindah ke #main-content setelah skip link diaktifkan');
  console.log('  ✓ Fokus berhasil berpindah ke #main-content setelah skip-link ditekan');

  // 3. Custom Modal Dialog Focus Trap & Escape Restoration Test
  console.log('\n--- Testing Modal Dialog: Focus Trap & Escape Dismissal ---');
  await page.goto(`${baseUrl}/pages/merge.html`);
  await page.waitForTimeout(300);

  // Set focus to trigger element before opening modal
  await page.evaluate(() => {
    const trigger = document.querySelector('#themeToggle') || document.querySelector('button');
    if (trigger) trigger.focus();
    window.modalTriggerElement = trigger;
    window.modalPromise = window.PDFTools.Modal.confirm('A11y automated verification confirmation dialog', {
      title: 'A11y Test Modal'
    });
  });

  await page.waitForSelector('.pdftools-modal-backdrop.active');

  const dialogAttributes = await page.evaluate(() => {
    const backdrop = document.querySelector('.pdftools-modal-backdrop');
    const titleEl = document.querySelector('.pdftools-modal-title');
    return {
      role: backdrop.getAttribute('role'),
      ariaModal: backdrop.getAttribute('aria-modal'),
      ariaLabelledBy: backdrop.getAttribute('aria-labelledby'),
      titleId: titleEl ? titleEl.id : null
    };
  });

  assert.strictEqual(dialogAttributes.role, 'dialog', 'Modal backdrop harus memiliki role="dialog"');
  assert.strictEqual(dialogAttributes.ariaModal, 'true', 'Modal backdrop harus memiliki aria-modal="true"');
  assert.ok(dialogAttributes.ariaLabelledBy, 'Modal backdrop harus memiliki atribut aria-labelledby');
  assert.strictEqual(dialogAttributes.ariaLabelledBy, dialogAttributes.titleId, 'aria-labelledby harus mereferensikan id judul modal');
  console.log('  ✓ Modal memenuhi atribut semantik WAI-ARIA dialog (role, aria-modal, aria-labelledby)');

  const initialFocusInside = await page.evaluate(() => {
    const backdrop = document.querySelector('.pdftools-modal-backdrop');
    return backdrop && backdrop.contains(document.activeElement);
  });
  assert.strictEqual(initialFocusInside, true, 'Fokus awal saat modal dibuka harus berada di dalam modal dialog');
  console.log('  ✓ Fokus awal otomatis diarahkan ke dalam elemen modal');

  // Verify focus trap over 4 Tab presses
  for (let step = 1; step <= 4; step++) {
    await page.keyboard.press('Tab');
    const stillTrapped = await page.evaluate(() => {
      const backdrop = document.querySelector('.pdftools-modal-backdrop');
      return backdrop && backdrop.contains(document.activeElement);
    });
    assert.strictEqual(stillTrapped, true, `Fokus harus tetap terperangkap di dalam modal (Tab step ${step})`);
  }
  console.log('  ✓ Focus trap diverifikasi: perputaran tombol Tab tetap berada di dalam modal dialog');

  // Press Escape to dismiss
  await page.keyboard.press('Escape');
  await page.waitForSelector('.pdftools-modal-backdrop', { state: 'detached', timeout: 3000 });
  console.log('  ✓ Modal berhasil ditutup dengan menekan tombol Escape');

  // Verify focus restored to previous trigger
  const focusRestored = await page.evaluate(() => {
    return document.activeElement === window.modalTriggerElement;
  });
  assert.strictEqual(focusRestored, true, 'Fokus harus dikembalikan ke elemen pemicu sebelumnya setelah modal ditutup');
  console.log('  ✓ Fokus berhasil dikembalikan ke elemen pemicu sebelumnya');

  await page.close();
  await context.close();

  return { success: true };
}

async function main() {
  let server = null;
  let browser = null;
  const PORT = 8769;
  const BASE_URL = `http://127.0.0.1:${PORT}`;

  try {
    server = await startTestServer(PORT);
    browser = await launchChromium({ headless: true });
    await runA11ySuite(browser, BASE_URL);
    console.log('\n🎉 SELURUH PENGUJIAN AKSESIBILITAS (A11Y) LULUS SEMPURNA!');
  } catch (err) {
    console.error('\n❌ Pengujian a11y gagal:', err.message || err);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server) server.close();
  }
}

module.exports = {
  runA11ySuite,
  main
};

if (require.main === module) {
  main();
}

