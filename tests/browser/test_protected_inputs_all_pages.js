/**
 * PDF Tools — Browser Test: Protected PDF Inputs Verification Across All Pages
 *
 * Verifies that all pages loading file-utils.js and accepting PDF inputs
 * can successfully handle:
 * (a) Permissions-only restricted PDFs without prompting password or throwing errors.
 * (b) User-password-protected PDFs with the interactive password modal, wrong password
 *     rejection feedback, and correct password decryption.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const Protect = require(path.join(ROOT_DIR, 'js/core/pdf-protect.js'));
const helpers = require('./helpers');

const CORRECT_PASSWORD = 'buka123';
const WRONG_PASSWORD = 'passwordsalah';
const PAGE1_TEXT = 'HALAMAN_SATU_TEKS_UNIK_RAHASIA_123';
const PAGE2_TEXT = 'HALAMAN_DUA_TEKS_UNIK_RAHASIA_456';

async function createFixtures() {
  const { PDFDocument, StandardFonts, rgb } = PDFLib;

  // 1. Clean 2-page document
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const p1 = doc.addPage([500, 500]);
  p1.drawText(PAGE1_TEXT, { x: 50, y: 400, size: 16, font, color: rgb(0, 0, 0) });

  const p2 = doc.addPage([500, 500]);
  p2.drawText(PAGE2_TEXT, { x: 50, y: 400, size: 16, font, color: rgb(0, 0, 0) });

  const cleanBytes = await doc.save();

  // (b) Permissions-only restriction (empty user password, owner password set, copy/print disabled)
  const bBytes = await Protect.protectPdf(cleanBytes, '', 'owner_pass_b', {
    printing: false,
    copying: false,
    modifying: false
  });

  // (c) User password "buka123"
  const cBytes = await Protect.protectPdf(cleanBytes, CORRECT_PASSWORD, 'owner_pass_c');

  return {
    variantB_base64: Buffer.from(bBytes).toString('base64'),
    variantC_base64: Buffer.from(cBytes).toString('base64')
  };
}

function getEligiblePages(rootDir) {
  const htmlFiles = [];
  function scanDir(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.html')) {
        const content = fs.readFileSync(fullPath, 'utf8');
        if (content.includes('file-utils.js')) {
          const relPath = path.relative(rootDir, fullPath).replace(/\\/g, '/');
          htmlFiles.push({ path: relPath, fullPath, content });
        }
      }
    }
  }
  scanDir(rootDir);

  // Pages intentionally skipped with documented written reasons
  const skipped = [
    {
      page: 'index.html',
      reason: 'Halaman beranda (homepage) hanya merutekan berkas via PDFTools.FileUtils.setPendingFile ke halaman alat masing-masing dan tidak memuat/memproses PDF langsung.'
    },
    {
      page: 'pages/docx-to-pdf.html',
      reason: 'Halaman hanya menerima masukan berkas Microsoft Word (.docx, .doc), bukan dokumen PDF.'
    },
    {
      page: 'pages/xlsx-to-pdf.html',
      reason: 'Halaman hanya menerima masukan lembar sebar Excel (.xlsx, .xls, .csv), bukan dokumen PDF.'
    },
    {
      page: 'pages/jpg-to-pdf.html',
      reason: 'Halaman hanya menerima masukan berkas gambar (JPG, PNG, WebP), bukan dokumen PDF.'
    },
    {
      page: 'pages/scan-pdf.html',
      reason: 'Halaman hanya menerima masukan tangkapan kamera langsung atau berkas foto galeri gambar, bukan dokumen PDF.'
    }
  ];

  const eligible = htmlFiles.filter(h => !skipped.some(s => s.page === h.path));
  return { eligible, skipped };
}

async function runProtectedInputsAllPagesSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       BROWSER AUDIT: PROTECTED INPUTS ACROSS ALL RELEVANT PAGES        ');
  console.log('========================================================================\n');

  const { eligible, skipped } = getEligiblePages(ROOT_DIR);

  console.log(`Daftar halaman yang dilewati (${skipped.length} halaman):`);
  skipped.forEach(s => {
    console.log(`  - [LEWATI] ${s.page}: ${s.reason}`);
  });

  console.log(`\nDaftar halaman yang diuji (${eligible.length} halaman):`);
  eligible.forEach(e => {
    console.log(`  - [UJI] ${e.path}`);
  });
  console.log('');

  const fixtures = await createFixtures();
  const context = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await context.newPage();

  try {
    for (let i = 0; i < eligible.length; i++) {
      const pageItem = eligible[i];
      console.log(`>>> [${i + 1}/${eligible.length}] Menguji halaman: ${pageItem.path}`);

      await page.goto(`${baseUrl}/${pageItem.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(200);

      // Track page and console errors
      const pageErrors = [];
      const onConsole = msg => {
        if (msg.type() === 'error') pageErrors.push(msg.text());
      };
      const onPageError = err => pageErrors.push(err.message);
      page.on('console', onConsole);
      page.on('pageerror', onPageError);

      try {
        // ---------------------------------------------------------------------
        // (a) PDF dengan pembatasan izin saja (Permissions-Only / Variant B)
        // ---------------------------------------------------------------------
        const resB = await page.evaluate(async (base64) => {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let idx = 0; idx < binary.length; idx++) bytes[idx] = binary.charCodeAt(idx);
          const file = new File([bytes], 'variant_b_restricted.pdf', { type: 'application/pdf' });
          const doc = await window.PDFTools.FileUtils.loadPdfDecrypted(file);
          return { pageCount: doc.getPageCount() };
        }, fixtures.variantB_base64);

        assert.strictEqual(resB.pageCount, 2, `${pageItem.path} (a): Harusnya menghasilkan dokumen 2 halaman`);

        // Verifikasi tidak ada modal dialog password
        const modalB = page.locator('.pdftools-modal-backdrop');
        const isModalBVisible = await modalB.isVisible().catch(() => false);
        assert.strictEqual(isModalBVisible, false, `${pageItem.path} (a): Dialog password TIDAK boleh muncul untuk pembatasan izin saja`);

        // Verifikasi tidak ada toast error
        const toastB = page.locator('.toast.error, .toast-error, .toast.toast-error');
        const isToastBVisible = await toastB.isVisible().catch(() => false);
        assert.strictEqual(isToastBVisible, false, `${pageItem.path} (a): Toast error TIDAK boleh muncul untuk pembatasan izin saja`);

        // Verifikasi tidak ada galat konsol
        assert.strictEqual(pageErrors.length, 0, `${pageItem.path} (a): Galat konsol terjadi: ${pageErrors.join('; ')}`);
        console.log(`  ✓ (a) Permissions-Only PDF berhasil dimuat tanpa dialog password, tanpa toast error, dan tanpa galat konsol.`);

        // ---------------------------------------------------------------------
        // (b) PDF wajib password (Variant C)
        // ---------------------------------------------------------------------
        // Jalankan loadPdfDecrypted tanpa await langsung agar dialog password dapat diinteraksikan
        const decryptPromise = page.evaluate(async (base64) => {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let idx = 0; idx < binary.length; idx++) bytes[idx] = binary.charCodeAt(idx);
          const file = new File([bytes], 'variant_c_password.pdf', { type: 'application/pdf' });
          const doc = await window.PDFTools.FileUtils.loadPdfDecrypted(file);
          return { pageCount: doc.getPageCount() };
        }, fixtures.variantC_base64);

        const modalC = page.locator('.pdftools-modal-backdrop.active');
        await modalC.waitFor({ state: 'visible', timeout: 5000 });
        console.log(`  ✓ (b) Dialog password muncul sesuai ketentuan.`);

        // Masukkan password salah
        const inputWrong = modalC.locator('.pdftools-modal-input');
        await inputWrong.fill(WRONG_PASSWORD);
        await modalC.locator('.pdftools-modal-confirm').click();

        // Tunggu transisi modal ke attempt 2
        await page.waitForTimeout(350);

        const modalC2 = page.locator('.pdftools-modal-backdrop.active');
        await modalC2.waitFor({ state: 'visible', timeout: 5000 });
        const errorEl = modalC2.locator('.pdftools-modal-error');
        await errorEl.waitFor({ state: 'visible', timeout: 5000 });
        const errorText = await errorEl.textContent();
        assert(errorText.toLowerCase().includes('salah') || errorText.toLowerCase().includes('incorrect'), `${pageItem.path} (b): Pesan password salah harus muncul jelas`);
        console.log(`  ✓ (b) Pesan password salah ditampilkan: "${errorText.trim()}".`);

        // Masukkan password benar pada modal aktif
        const inputCorrect = modalC2.locator('.pdftools-modal-input');
        await inputCorrect.fill(CORRECT_PASSWORD);
        await modalC2.locator('.pdftools-modal-confirm').click();

        // Tunggu seluruh modal backdrop tertutup
        await page.waitForFunction(() => !document.querySelector('.pdftools-modal-backdrop.active'), { timeout: 10000 });

        const resC = await decryptPromise;
        assert.strictEqual(resC.pageCount, 2, `${pageItem.path} (b): Dokumen harus berhasil didekripsi setelah password benar`);
        console.log(`  ✓ (b) Password benar berhasil mendekripsi dokumen (2 halaman).\n`);
      } finally {
        page.off('console', onConsole);
        page.off('pageerror', onPageError);
      }
    }

    console.log('========================================================================');
    console.log('✅ [PASS] Seluruh Halaman Berhasil Memproses PDF Terproteksi!');
    console.log('========================================================================\n');
  } finally {
    await context.close();
  }
}

if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      server = await helpers.startTestServer(8765);
      browser = await chromium.launch({ headless: true });
      await runProtectedInputsAllPagesSuite(browser, 'http://127.0.0.1:8765');
      process.exitCode = 0;
    } catch (err) {
      console.error('Fatal error in runProtectedInputsAllPagesSuite:', err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = { runProtectedInputsAllPagesSuite };
