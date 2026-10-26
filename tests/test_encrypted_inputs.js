/**
 * PDF Tools — Test Suite: Encrypted Inputs Across All PDF Loading Tools
 *
 * Verifies that tools reject/decrypt protected PDFs properly instead of
 * blindly loading with { ignoreEncryption: true }.
 *
 * 4 Variants:
 * (a) Unprotected 2-page PDF
 * (b) Permissions-only restriction (empty user password, copy/print restricted)
 * (c) Open password "buka123"
 * (d) AES-256 encrypted PDF via protectPdf with custom password
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

// Vendor libs
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjsLib = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjsLib.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// Mock browser globals for core modules
global.window = global;
global.PDFLib = PDFLib;
global.pdfjsLib = pdfjsLib;
global.PDFTools = global.PDFTools || {};
// Mock FileReader for Node environment
class MockFileReader {
  readAsArrayBuffer(blob) {
    setTimeout(async () => {
      try {
        const buf = await blob.arrayBuffer();
        this.result = buf;
        if (this.onload) this.onload({ target: this });
      } catch (err) {
        if (this.onerror) this.onerror(err);
      }
    }, 0);
  }
}
global.FileReader = MockFileReader;
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Silence harmless font warning from pdf.js in Node
const _origStderr = process.stderr.write;
process.stderr.write = function (chunk, ...args) {
  if (chunk && chunk.toString().includes('fetchStandardFontData')) return true;
  return _origStderr.apply(process.stderr, [chunk, ...args]);
};

// Load utilities and core modules
require(path.join(ROOT_DIR, 'js/utils/file-utils.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-copy.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-protect.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-watermark.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-rotate.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-split.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-crop.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-flatten.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-merge.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-compress.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-page-number.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-reorder.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-remove.js'));

// Optional modules if present
try { require(path.join(ROOT_DIR, 'js/core/pdf-form-fill.js')); } catch (e) {}
try { require(path.join(ROOT_DIR, 'js/core/pdf-sign.js')); } catch (e) {}
try { require(path.join(ROOT_DIR, 'js/core/pdf-batch.js')); } catch (e) {}

const { PDFDocument, StandardFonts, rgb } = PDFLib;

const PAGE1_TEXT = 'HALAMAN_SATU_TEKS_UNIK_RAHASIA_123';
const PAGE2_TEXT = 'HALAMAN_DUA_TEKS_UNIK_RAHASIA_456';
const PASSWORD_C = 'buka123';
const PASSWORD_D = 'aes256_super_pass';

// 1x1 transparent PNG for image watermark / sign
const SAMPLE_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
const SAMPLE_PNG_BYTES = Buffer.from(SAMPLE_PNG_BASE64, 'base64');

async function createBaseTwoPagePdf() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const p1 = doc.addPage([500, 500]);
  p1.drawText(PAGE1_TEXT, { x: 50, y: 400, size: 16, font, color: rgb(0, 0, 0) });

  const p2 = doc.addPage([500, 500]);
  p2.drawText(PAGE2_TEXT, { x: 50, y: 400, size: 16, font, color: rgb(0, 0, 0) });

  return await doc.save();
}

async function extractTextFromPdf(bytes) {
  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(bytes),
    useSystemFonts: true,
    disableFontFace: true
  });
  const pdfDoc = await loadingTask.promise;
  const numPages = pdfDoc.numPages;
  const pageTexts = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdfDoc.getPage(i);
    const content = await page.getTextContent();
    const str = content.items.map(it => it.str).join(' ');
    pageTexts.push(str);
  }

  return { numPages, pageTexts, allText: pageTexts.join(' ') };
}

// Wrap bytes into mock File object
function wrapFile(name, bytes) {
  const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  return {
    name,
    size: bytes.length,
    lastModified: Date.now(),
    arrayBuffer: async () => buf.slice(0)
  };
}

// Tool runner registry
const tools = [
  {
    name: 'Watermark (Mode Teks)',
    run: async (file, options) => {
      return await PDFTools.Watermark.applyWatermark(file, {
        text: 'WATERMARK',
        opacity: 0.5,
        rotation: 45
      }, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Watermark (Mode Gambar)',
    run: async (file, options) => {
      return await PDFTools.Watermark.applyWatermark(file, {
        type: 'image',
        image: SAMPLE_PNG_BYTES,
        opacity: 0.5,
        rotation: 0
      }, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Rotate',
    run: async (file, options) => {
      return await PDFTools.Rotate.rotate(file, { 0: 90, 1: 90 }, null, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Split',
    run: async (file, options) => {
      return await PDFTools.Split.extractPages(file, [0, 1], null, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Crop',
    run: async (file, options) => {
      return await PDFTools.Crop.cropPdf(file, {
        cropBox: { x: 10, y: 10, width: 480, height: 480 },
        ...options
      });
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Flatten',
    run: async (file, options) => {
      return await PDFTools.Flatten.flattenPdf(file, { mode: 'vector', ...options });
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Merge (Seluruh Berkas)',
    run: async (file, options) => {
      const res = await PDFTools.Merge.merge([file], options);
      return res.bytes || res;
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Merge (Mode Halaman / pages/merge.html)',
    run: async (file, options) => {
      const res = await PDFTools.Merge.merge([
        { file, pageIndex: 0 },
        { file, pageIndex: 1 }
      ], options);
      return res.bytes || res;
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Compress',
    run: async (file, options) => {
      const res = await PDFTools.Compress.compress(file, { mode: 'recommended', ...options });
      return res.bytes || res;
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'PageNumber',
    run: async (file, options) => {
      return await PDFTools.PageNumber.applyPageNumbers(file, {
        format: 'page_of_total',
        ...options
      });
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Reorder',
    run: async (file, options) => {
      return await PDFTools.Reorder.reorder(file, [1, 0], null, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Remove',
    run: async (file, options) => {
      // Remove page 2 (index 1), keeping page 1 (index 0)
      const res = await PDFTools.Remove.removePages(file, [1], null, options);
      return res.bytes || res;
    },
    expectedPages: 1,
    checkPage1: true,
    checkPage2: false
  },
  {
    name: 'FormFill',
    run: async (file, options) => {
      if (PDFTools.FormFill && typeof PDFTools.FormFill.fillForm === 'function') {
        return await PDFTools.FormFill.fillForm(file, {}, options);
      }
      // If helper function loadPdfDecrypted is used directly:
      if (PDFTools.FileUtils && typeof PDFTools.FileUtils.loadPdfDecrypted === 'function') {
        const doc = await PDFTools.FileUtils.loadPdfDecrypted(file, options);
        return await doc.save();
      }
      // Legacy fallback (fails on encryption)
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      return await doc.save();
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Sign',
    run: async (file, options) => {
      if (PDFTools.Sign && typeof PDFTools.Sign.applySignature === 'function') {
        return await PDFTools.Sign.applySignature(file, [], options);
      }
      if (PDFTools.FileUtils && typeof PDFTools.FileUtils.loadPdfDecrypted === 'function') {
        const doc = await PDFTools.FileUtils.loadPdfDecrypted(file, options);
        return await doc.save();
      }
      const buf = await file.arrayBuffer();
      const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
      return await doc.save();
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  },
  {
    name: 'Batch',
    run: async (file, options) => {
      if (PDFTools.Batch && typeof PDFTools.Batch.processItem === 'function') {
        return await PDFTools.Batch.processItem(file, 'watermark', options);
      }
      // Batch uses watermark as underlying operation
      return await PDFTools.Watermark.applyWatermark(file, {
        text: 'BATCH-WATERMARK',
        opacity: 0.5,
        rotation: 45
      }, options);
    },
    expectedPages: 2,
    checkPage1: true,
    checkPage2: true
  }
];

async function runTestSuite() {
  console.log('========================================================================');
  console.log('       TEST SUITE: ENCRYPTED INPUTS ACROSS ALL PDF LOADING TOOLS        ');
  console.log('========================================================================\n');

  console.log('Generating 4 test PDF fixtures...');
  const baseBytes = await createBaseTwoPagePdf();

  // (a) Unprotected
  const variantA = wrapFile('variant_a_clean.pdf', baseBytes);

  // (b) Permissions-only restriction (empty user password, owner password set, copy/print disabled)
  const bBytes = await PDFTools.Protect.protectPdf(baseBytes, '', 'owner_pass_b', {
    printing: false,
    copying: false,
    modifying: false
  });
  assert(PDFTools.Protect.hasEncryptDictionary(bBytes), 'Variant B must contain /Encrypt dictionary');
  const variantB = wrapFile('variant_b_restricted.pdf', bBytes);

  // (c) User password "buka123"
  const cBytes = await PDFTools.Protect.protectPdf(baseBytes, PASSWORD_C, 'owner_pass_c');
  assert(PDFTools.Protect.hasEncryptDictionary(cBytes), 'Variant C must contain /Encrypt dictionary');
  const variantC = wrapFile('variant_c_password.pdf', cBytes);

  // (d) AES-256 protected with protectPdf
  const dBytes = await PDFTools.Protect.protectPdf(baseBytes, PASSWORD_D, 'owner_pass_d');
  assert(PDFTools.Protect.hasEncryptDictionary(dBytes), 'Variant D must contain /Encrypt dictionary');
  const variantD = wrapFile('variant_d_aes256.pdf', dBytes);

  console.log('✔ Fixtures generated successfully:\n');
  console.log('  - (a) Unprotected       : ' + variantA.size + ' bytes');
  console.log('  - (b) Permissions-Only  : ' + variantB.size + ' bytes (userPassword: "")');
  console.log('  - (c) Open Password     : ' + variantC.size + ' bytes (userPassword: "' + PASSWORD_C + '")');
  console.log('  - (d) AES-256 Protected : ' + variantD.size + ' bytes (userPassword: "' + PASSWORD_D + '")\n');

  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  for (const tool of tools) {
    console.log(`>>> Testing Tool: ${tool.name}`);

    // --- (a) Unprotected ---
    try {
      const resA = await tool.run(variantA, {});
      assert(resA && resA.length > 0, `${tool.name} (a): Output bytes must not be empty`);
      assert(!PDFTools.Protect.hasEncryptDictionary(resA), `${tool.name} (a): Result must not have /Encrypt`);

      const textA = await extractTextFromPdf(resA);
      assert.strictEqual(textA.numPages, tool.expectedPages, `${tool.name} (a): Expected ${tool.expectedPages} pages`);
      if (tool.checkPage1) assert(textA.allText.includes(PAGE1_TEXT), `${tool.name} (a): Page 1 text missing`);
      if (tool.checkPage2) assert(textA.allText.includes(PAGE2_TEXT), `${tool.name} (a): Page 2 text missing`);

      console.log(`  ✓ (a) Unprotected: Berhasil, teks asli utuh.`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ (a) Unprotected FAILED: ${err.message}`);
      failedTests++;
      failures.push({ tool: tool.name, variant: '(a) Unprotected', error: err.message });
    }

    // --- (b) Permissions-only restriction ---
    try {
      const resB = await tool.run(variantB, {});
      assert(resB && resB.length > 0, `${tool.name} (b): Output bytes must not be empty`);
      assert(!PDFTools.Protect.hasEncryptDictionary(resB), `${tool.name} (b): Result must be decrypted (ZERO /Encrypt)`);

      const textB = await extractTextFromPdf(resB);
      assert.strictEqual(textB.numPages, tool.expectedPages, `${tool.name} (b): Expected ${tool.expectedPages} pages`);
      if (tool.checkPage1) assert(textB.allText.includes(PAGE1_TEXT), `${tool.name} (b): Page 1 text missing`);
      if (tool.checkPage2) assert(textB.allText.includes(PAGE2_TEXT), `${tool.name} (b): Page 2 text missing`);

      console.log(`  ✓ (b) Permissions-Only: Berhasil, teks utuh, TANPA /Encrypt.`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ (b) Permissions-Only FAILED: ${err.message}`);
      failedTests++;
      failures.push({ tool: tool.name, variant: '(b) Permissions-Only', error: err.message });
    }

    // --- (c1) Open Password with CORRECT password ---
    try {
      const resC = await tool.run(variantC, {
        getPassword: async (fileName, attempt) => PASSWORD_C
      });
      assert(resC && resC.length > 0, `${tool.name} (c-correct): Output bytes must not be empty`);
      assert(!PDFTools.Protect.hasEncryptDictionary(resC), `${tool.name} (c-correct): Result must be decrypted (ZERO /Encrypt)`);

      const textC = await extractTextFromPdf(resC);
      assert.strictEqual(textC.numPages, tool.expectedPages, `${tool.name} (c-correct): Expected ${tool.expectedPages} pages`);
      if (tool.checkPage1) assert(textC.allText.includes(PAGE1_TEXT), `${tool.name} (c-correct): Page 1 text missing`);
      if (tool.checkPage2) assert(textC.allText.includes(PAGE2_TEXT), `${tool.name} (c-correct): Page 2 text missing`);

      console.log(`  ✓ (c) Password Benar: Berhasil, teks utuh, TANPA /Encrypt.`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ (c) Password Benar FAILED: ${err.message}`);
      failedTests++;
      failures.push({ tool: tool.name, variant: '(c) Password Benar', error: err.message });
    }

    // --- (c2) Open Password WITHOUT password or WRONG password -> must throw coded error ---
    try {
      let threwCodedError = false;
      let returnedBytes = false;
      try {
        const badRes = await tool.run(variantC, {
          // Wrong password provided
          getPassword: async (fileName, attempt) => 'salah_total'
        });
        if (badRes && badRes.length > 0) {
          returnedBytes = true;
        }
      } catch (err) {
        if (err.code === 'PASSWORD_REQUIRED' || err.code === 'PASSWORD_INCORRECT') {
          threwCodedError = true;
        } else {
          // If error thrown but code missing, still note it
          throw new Error(`Expected err.code to be PASSWORD_REQUIRED or PASSWORD_INCORRECT, got: "${err.message}" (code: ${err.code})`);
        }
      }

      assert(!returnedBytes, `${tool.name} (c-wrong): Dilarang mengembalikan berkas jika password salah/kosong!`);
      assert(threwCodedError, `${tool.name} (c-wrong): Wajib melempar error berkode PASSWORD_REQUIRED / PASSWORD_INCORRECT`);

      console.log(`  ✓ (c) Password Salah: Melempar error berkode & TIDAK mengembalikan berkas.`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ (c) Password Salah/Kosong FAILED: ${err.message}`);
      failedTests++;
      failures.push({ tool: tool.name, variant: '(c) Password Salah/Kosong', error: err.message });
    }

    // --- (d) AES-256 with correct password ---
    try {
      const resD = await tool.run(variantD, {
        getPassword: async (fileName, attempt) => PASSWORD_D
      });
      assert(resD && resD.length > 0, `${tool.name} (d-aes256): Output bytes must not be empty`);
      assert(!PDFTools.Protect.hasEncryptDictionary(resD), `${tool.name} (d-aes256): Result must have ZERO /Encrypt`);

      const textD = await extractTextFromPdf(resD);
      assert.strictEqual(textD.numPages, tool.expectedPages, `${tool.name} (d-aes256): Expected ${tool.expectedPages} pages`);
      if (tool.checkPage1) assert(textD.allText.includes(PAGE1_TEXT), `${tool.name} (d-aes256): Page 1 text missing`);
      if (tool.checkPage2) assert(textD.allText.includes(PAGE2_TEXT), `${tool.name} (d-aes256): Page 2 text missing`);

      console.log(`  ✓ (d) AES-256: Berhasil, teks utuh, TANPA /Encrypt.\n`);
      passedTests++;
    } catch (err) {
      console.error(`  ❌ (d) AES-256 FAILED: ${err.message}\n`);
      failedTests++;
      failures.push({ tool: tool.name, variant: '(d) AES-256', error: err.message });
    }
  }

  console.log('========================================================================');
  console.log(`TEST RESULTS: ${passedTests} passed, ${failedTests} failed`);
  if (failedTests > 0) {
    console.log('\nDAFTAR KEGAGALAN:');
    failures.forEach((f, idx) => {
      console.log(`  ${idx + 1}. [${f.tool}] [${f.variant}] -> ${f.error}`);
    });
    console.log('\n❌ [FAIL] Encrypted inputs test suite failed as expected prior to fix.');
    process.exit(1);
  }

  // --- MUTATION CHECK (Requirement 4) ---
  console.log('\n========================================================================');
  console.log('   MUTATION CHECK: TEMPORARILY STUBBING ignoreEncryption: true          ');
  console.log('========================================================================\n');

  const originalRotate = PDFTools.Rotate.rotate;
  let mutationFailedAsExpected = false;
  let mutationCaughtError = null;

  try {
    // Deliberately stub Rotate to use legacy ignoreEncryption: true without decrypting
    PDFTools.Rotate.rotate = async function (file, rotationsMap) {
      const { PDFDocument, degrees } = PDFLib;
      const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
      // Stubbed with forbidden pattern:
      const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true }); // allow-ignore-encryption: mutation stub check
      const pages = pdfDoc.getPages();
      for (let i = 0; i < pages.length; i++) {
        pages[i].setRotation(degrees(90));
      }
      return await pdfDoc.save();
    };

    console.log('[Mutation Check] Testing Rotate with stubbed ignoreEncryption: true on variant (b)...');
    const mutatedBytes = await PDFTools.Rotate.rotate(variantB, { 0: 90, 1: 90 });
    const extracted = await extractTextFromPdf(mutatedBytes);
    if (!extracted.allText.includes(PAGE1_TEXT) || PDFTools.Protect.hasEncryptDictionary(mutatedBytes)) {
      mutationFailedAsExpected = true;
      mutationCaughtError = new Error('Corrupted text / remaining /Encrypt detected from ignoreEncryption: true');
    }
  } catch (err) {
    mutationFailedAsExpected = true;
    mutationCaughtError = err;
  } finally {
    // Restore original implementation immediately
    PDFTools.Rotate.rotate = originalRotate;
  }

  assert(mutationFailedAsExpected, 'Mutation check failed: stubbed ignoreEncryption: true did not trigger failure!');
  console.log(`  ✓ Mutation detected and rejected as expected: ${mutationCaughtError ? mutationCaughtError.message : 'Unknown'}`);
  console.log('  ✓ Original implementation restored and verified safe.\n');

  console.log('✅ [PASS] All encrypted inputs tests and mutation check passed!');
  process.exit(0);
}

runTestSuite().catch(err => {
  console.error('\nFatal Crash during test suite:', err);
  process.exit(1);
});
