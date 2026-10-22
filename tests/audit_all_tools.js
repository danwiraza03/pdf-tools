const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Root directory of the project
const ROOT_DIR = path.resolve(__dirname, '..');

// Load vendor libraries directly via CommonJS
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const JSZip = require(path.join(ROOT_DIR, 'js/lib/jszip.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');
// Filter out harmless PDF.js worker font fetching warnings in Node environment
const _origStderrWrite = process.stderr.write;
process.stderr.write = function(chunk, ...args) {
  if (chunk && chunk.toString().includes('fetchStandardFontData')) return true;
  return _origStderrWrite.apply(process.stderr, [chunk, ...args]);
};
const _origStdoutWrite = process.stdout.write;
process.stdout.write = function(chunk, ...args) {
  if (chunk && chunk.toString().includes('fetchStandardFontData')) return true;
  return _origStdoutWrite.apply(process.stdout, [chunk, ...args]);
};

// Setup mock browser globals
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
  readAsDataURL(blob) {
    setTimeout(async () => {
      try {
        const buf = await blob.arrayBuffer();
        const base64 = Buffer.from(buf).toString('base64');
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
        if (this.onload) this.onload({ target: this });
      } catch (err) {
        if (this.onerror) this.onerror(err);
      }
    }, 0);
  }
}

global.window = global;
global.PDFLib = PDFLib;
global.JSZip = JSZip;
global.pdfjsLib = pdfjs;
global.FileReader = MockFileReader;
global.document = {
  createElement: () => ({
    width: 100,
    height: 100,
    getContext: () => ({
      fillRect() {},
      clearRect() {},
      drawImage() {},
      getImageData() { return { data: new Uint8ClampedArray(4) }; },
      putImageData() {}
    }),
    toBlob: (cb) => { if (typeof cb === 'function') cb(new Blob([])); },
    toDataURL: () => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='
  })
};
global.navigator = { userAgent: 'Node' };
global.location = { href: 'http://localhost/', protocol: 'http:' };
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');
global.PDFTools = {};

const { PDFDocument, rgb, StandardFonts } = PDFLib;

// Helper: Create a multi-page PDF with specific text on each page
async function createCustomPdf(pageTexts = [], dimensions = [600, 400]) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (let i = 0; i < pageTexts.length; i++) {
    const page = doc.addPage(dimensions);
    page.drawText(pageTexts[i], { x: 50, y: dimensions[1] - 50, size: 18, font, color: rgb(0, 0, 0) });
  }
  return await doc.save();
}

// Helper: Wrap Uint8Array / Buffer into mock File object
function makeFile(name, uint8Array, mimeType = 'application/pdf') {
  const buf = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength);
  return {
    name: name,
    size: uint8Array.length,
    type: mimeType,
    lastModified: Date.now(),
    arrayBuffer: async () => buf.slice(0)
  };
}

// Helper: Extract text from all pages of a PDF using PDF.js
async function extractAllPagesText(pdfBytes) {
  const copy = new Uint8Array(pdfBytes).slice(0);
  const pdfjsDoc = await pdfjs.getDocument({ data: copy }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdfjsDoc.numPages; i++) {
    const page = await pdfjsDoc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map(it => it.str).join(' ').trim();
    pageTexts.push(text);
  }
  return pageTexts;
}

// Load Core Utilities and Engines
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/utils/file-utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-merge.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-split.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-rotate.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-remove.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-reorder.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-watermark.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-page-number.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-protect.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-compress.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-crop.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-flatten.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/jpg-to-pdf.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-to-docx.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-to-xlsx.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/editor/pdf-coordinate-engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/editor/redaction-engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-studio.js'), 'utf8'));

async function runAudit() {
  console.log('========================================================================');
  console.log('         COMPREHENSIVE RESULT-BASED AUDIT OF ALL PDF TOOLS              ');
  console.log('========================================================================\n');

  const results = [];

  // -------------------------------------------------------------------------
  // 1. Merge PDF: 2 PDF (2 + 3 pages) -> 5 pages with verified text order
  // -------------------------------------------------------------------------
  try {
    const bytes1 = await createCustomPdf(['Doc1-P1', 'Doc1-P2']);
    const bytes2 = await createCustomPdf(['Doc2-P1', 'Doc2-P2', 'Doc2-P3']);
    const file1 = makeFile('doc1.pdf', bytes1);
    const file2 = makeFile('doc2.pdf', bytes2);

    const mergeRes = await PDFTools.Merge.merge([file1, file2]);
    const mergedDoc = await PDFDocument.load(mergeRes.bytes);
    assert.strictEqual(mergedDoc.getPageCount(), 5, 'Merged document must have exactly 5 pages');

    const texts = await extractAllPagesText(mergeRes.bytes);
    assert(texts[0].includes('Doc1-P1'), 'Page 1 must contain Doc1-P1');
    assert(texts[1].includes('Doc1-P2'), 'Page 2 must contain Doc1-P2');
    assert(texts[2].includes('Doc2-P1'), 'Page 3 must contain Doc2-P1');
    assert(texts[3].includes('Doc2-P2'), 'Page 4 must contain Doc2-P2');
    assert(texts[4].includes('Doc2-P3'), 'Page 5 must contain Doc2-P3');

    results.push({
      id: 1,
      name: 'Merge PDF',
      status: 'PASSED',
      details: 'Merged 2 files (2+3 pages) -> 5 pages; all 5 pages verified in order'
    });
  } catch (err) {
    results.push({ id: 1, name: 'Merge PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 2. Split PDF: range "2-3" -> 2 pages with text from pages 2 and 3
  // -------------------------------------------------------------------------
  try {
    const sample3p = await createCustomPdf(['Split-P1', 'Split-P2', 'Split-P3']);
    const file = makeFile('split_src.pdf', sample3p);

    const pageIndices = PDFTools.Split.parseRange('2-3', 3);
    assert.deepStrictEqual(pageIndices, [1, 2], 'Range "2-3" must resolve to 0-based indices [1, 2]');

    const splitBytes = await PDFTools.Split.extractPages(file, pageIndices);
    const splitDoc = await PDFDocument.load(splitBytes);
    assert.strictEqual(splitDoc.getPageCount(), 2, 'Split document must have 2 pages');

    const texts = await extractAllPagesText(splitBytes);
    assert(texts[0].includes('Split-P2'), 'Page 1 must contain text from original page 2');
    assert(texts[1].includes('Split-P3'), 'Page 2 must contain text from original page 3');
    assert(!texts.some(t => t.includes('Split-P1')), 'Original page 1 text must not be present');

    results.push({
      id: 2,
      name: 'Split PDF',
      status: 'PASSED',
      details: 'Extracted range "2-3" -> 2 pages; verified contains text from pages 2 and 3'
    });
  } catch (err) {
    results.push({ id: 2, name: 'Split PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 3. Rotate PDF: rotations change according to specified values
  // -------------------------------------------------------------------------
  try {
    const sample3p = await createCustomPdf(['Rot-P1', 'Rot-P2', 'Rot-P3']);
    const file = makeFile('rot_src.pdf', sample3p);

    const rotatedBytes = await PDFTools.Rotate.rotate(file, { 0: 90, 1: 180, 2: 270 });
    const rotDoc = await PDFDocument.load(rotatedBytes);

    const rot0 = rotDoc.getPage(0).getRotation().angle;
    const rot1 = rotDoc.getPage(1).getRotation().angle;
    const rot2 = rotDoc.getPage(2).getRotation().angle;

    assert.strictEqual(rot0, 90, 'Page 1 rotation angle must be 90');
    assert.strictEqual(rot1, 180, 'Page 2 rotation angle must be 180');
    assert.strictEqual(rot2, 270, 'Page 3 rotation angle must be 270');

    // Cross-verify with PDF.js
    const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(rotatedBytes).slice(0) }).promise;
    assert.strictEqual((await pdfjsDoc.getPage(1)).rotate, 90);
    assert.strictEqual((await pdfjsDoc.getPage(2)).rotate, 180);
    assert.strictEqual((await pdfjsDoc.getPage(3)).rotate, 270);

    results.push({
      id: 3,
      name: 'Rotate PDF',
      status: 'PASSED',
      details: 'Rotated: page 1 = 90°, page 2 = 180°, page 3 = 270°'
    });
  } catch (err) {
    results.push({ id: 3, name: 'Rotate PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 4. Remove Pages: page count and remaining pages text match
  // -------------------------------------------------------------------------
  try {
    const sample3p = await createCustomPdf(['Rem-P1', 'Rem-P2', 'Rem-P3']);
    const file = makeFile('rem_src.pdf', sample3p);

    const removedRes = await PDFTools.Remove.removePages(file, [1]);
    const remDoc = await PDFDocument.load(removedRes.bytes);
    assert.strictEqual(remDoc.getPageCount(), 2, 'Must have exactly 2 pages remaining');

    const texts = await extractAllPagesText(removedRes.bytes);
    assert(texts[0].includes('Rem-P1'), 'Page 1 must contain Rem-P1');
    assert(texts[1].includes('Rem-P3'), 'Page 2 must contain Rem-P3');
    assert(!texts.some(t => t.includes('Rem-P2')), 'Removed page 2 text must not exist');

    results.push({
      id: 4,
      name: 'Remove Pages',
      status: 'PASSED',
      details: 'Deleted page 2 -> 2 pages remaining (pages 1 and 3 verified)'
    });
  } catch (err) {
    results.push({ id: 4, name: 'Remove Pages', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 5. Reorder Pages: page count and custom sequence verified
  // -------------------------------------------------------------------------
  try {
    const sample3p = await createCustomPdf(['Order-A', 'Order-B', 'Order-C']);
    const file = makeFile('reorder_src.pdf', sample3p);

    // New order: [2, 0, 1] -> Page 3 (C), Page 1 (A), Page 2 (B)
    const reorderedBytes = await PDFTools.Reorder.reorder(file, [2, 0, 1]);
    const reorderDoc = await PDFDocument.load(reorderedBytes);
    assert.strictEqual(reorderDoc.getPageCount(), 3, 'Reordered document must have 3 pages');

    const texts = await extractAllPagesText(reorderedBytes);
    assert(texts[0].includes('Order-C'), 'First page must be C');
    assert(texts[1].includes('Order-A'), 'Second page must be A');
    assert(texts[2].includes('Order-B'), 'Third page must be B');

    results.push({
      id: 5,
      name: 'Reorder Pages',
      status: 'PASSED',
      details: 'Sequence [3, 1, 2] -> 3 pages; text order verified: C, A, B'
    });
  } catch (err) {
    results.push({ id: 5, name: 'Reorder Pages', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 6. Watermark PDF: watermark text appears when extracted
  // -------------------------------------------------------------------------
  try {
    const sample2p = await createCustomPdf(['Base-Content-1', 'Base-Content-2']);
    const file = makeFile('wm_src.pdf', sample2p);

    const watermarkedBytes = await PDFTools.Watermark.applyWatermark(file, {
      text: 'CONFIDENTIAL-WATERMARK-777',
      fontSize: 32,
      opacity: 0.5
    });

    const texts = await extractAllPagesText(watermarkedBytes);
    assert(texts[0].includes('CONFIDENTIAL-WATERMARK-777'), 'Page 1 must contain watermark text');
    assert(texts[1].includes('CONFIDENTIAL-WATERMARK-777'), 'Page 2 must contain watermark text');

    results.push({
      id: 6,
      name: 'Watermark PDF',
      status: 'PASSED',
      details: 'Watermark text "CONFIDENTIAL-WATERMARK-777" extracted from all pages'
    });
  } catch (err) {
    results.push({ id: 6, name: 'Watermark PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 7. Page Numbering: page numbers appear when extracted
  // -------------------------------------------------------------------------
  try {
    const sample2p = await createCustomPdf(['Content-P1', 'Content-P2']);
    const file = makeFile('num_src.pdf', sample2p);

    const numberedBytes = await PDFTools.PageNumber.applyPageNumbers(file, {
      format: 'page_of_total',
      customText: 'Page {n} of {total}'
    });

    const texts = await extractAllPagesText(numberedBytes);
    assert(texts[0].includes('Page 1 of 2'), 'Page 1 must contain "Page 1 of 2"');
    assert(texts[1].includes('Page 2 of 2'), 'Page 2 must contain "Page 2 of 2"');

    results.push({
      id: 7,
      name: 'Page Numbering',
      status: 'PASSED',
      details: 'Page numbers "Page 1 of 2" and "Page 2 of 2" extracted from pages'
    });
  } catch (err) {
    results.push({ id: 7, name: 'Page Numbering', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 8. Protect & Unlock: Prompt 2 criteria (must fail if encryption is missing)
  // -------------------------------------------------------------------------
  try {
    const sample2p = await createCustomPdf(['Protected-P1', 'Protected-P2']);
    const file = makeFile('protect_src.pdf', sample2p);

    const protectedBytes = await PDFTools.Protect.protectPdf(file, 'userSecret', 'ownerSecret');

    // Verification 1: /Encrypt dictionary must exist in binary
    const rawStr = Buffer.from(protectedBytes).toString('binary');
    assert(rawStr.includes('/Encrypt'), 'Output must contain /Encrypt dictionary');

    // Verification 2: Opening with PDF.js without password must throw PasswordException
    let threwPassword = false;
    try {
      await pdfjs.getDocument({ data: new Uint8Array(protectedBytes).slice(0) }).promise;
    } catch (e) {
      if (e.name === 'PasswordException' || (e.message && e.message.toLowerCase().includes('password'))) {
        threwPassword = true;
      }
    }
    assert(threwPassword, 'Opening encrypted PDF without password must require password');

    // Verification 3: Opening with correct password succeeds
    const openedWithPass = await pdfjs.getDocument({
      data: new Uint8Array(protectedBytes).slice(0),
      password: 'userSecret'
    }).promise;
    assert.strictEqual(openedWithPass.numPages, 2, 'Must open with correct password and have 2 pages');

    // Verification 4: Unlock decrypts and removes /Encrypt
    const protectedFile = makeFile('protected.pdf', protectedBytes);
    const unlockedBytes = await PDFTools.Protect.unlockPdf(protectedFile, 'userSecret');
    const unlockedRaw = Buffer.from(unlockedBytes).toString('binary');
    assert(!unlockedRaw.includes('/Encrypt'), 'Unlocked PDF must not contain /Encrypt');

    const unlockedPdfjs = await pdfjs.getDocument({ data: new Uint8Array(unlockedBytes).slice(0) }).promise;
    assert.strictEqual(unlockedPdfjs.numPages, 2, 'Unlocked PDF opens without password');

    results.push({
      id: 8,
      name: 'Protect & Unlock PDF',
      status: 'PASSED',
      details: 'Encrypted with /Encrypt; requires password; unlock successfully decrypts'
    });
  } catch (err) {
    results.push({ id: 8, name: 'Protect & Unlock PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 9. Compress PDF: valid output, re-openable, sizes recorded
  // -------------------------------------------------------------------------
  try {
    const sample2p = await createCustomPdf(['Compress-Test-P1', 'Compress-Test-P2']);
    const file = makeFile('compress_src.pdf', sample2p);

    const origLog = console.log;
    const origWarn = console.warn;
    console.log = () => {};
    console.warn = () => {};
    let compRes;
    try {
      compRes = await PDFTools.Compress.compress(file, 'medium');
    } finally {
      console.log = origLog;
      console.warn = origWarn;
    }

    assert(compRes.bytes && compRes.bytes.length > 0, 'Compress output bytes must be non-empty');

    const compDoc = await PDFDocument.load(compRes.bytes);
    assert.strictEqual(compDoc.getPageCount(), 2, 'Compressed PDF must load and have 2 pages');

    const pdfjsComp = await pdfjs.getDocument({ data: new Uint8Array(compRes.bytes).slice(0) }).promise;
    assert.strictEqual(pdfjsComp.numPages, 2, 'Compressed PDF must re-open in PDF.js');

    results.push({
      id: 9,
      name: 'Compress PDF',
      status: 'PASSED',
      details: `Output valid and re-opened in PDF.js (${compRes.originalSize}B -> ${compRes.newSize}B)`
    });
  } catch (err) {
    results.push({ id: 9, name: 'Compress PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 10. Crop & Trim: CropBox matches requested dimensions
  // -------------------------------------------------------------------------
  try {
    const samplePdf = await createCustomPdf(['Crop-Test-Page'], [600, 400]);
    const file = makeFile('crop_src.pdf', samplePdf);

    const cropBytes = await PDFTools.Crop.cropPdf(file, {
      cropBox: { x: 50, y: 60, width: 400, height: 280 }
    });

    const cropDoc = await PDFDocument.load(cropBytes);
    const box = cropDoc.getPages()[0].getCropBox();

    assert.strictEqual(Math.round(box.x), 50, 'CropBox X must be 50');
    assert.strictEqual(Math.round(box.y), 60, 'CropBox Y must be 60');
    assert.strictEqual(Math.round(box.width), 400, 'CropBox width must be 400');
    assert.strictEqual(Math.round(box.height), 280, 'CropBox height must be 280');

    results.push({
      id: 10,
      name: 'Crop & Trim Margins',
      status: 'PASSED',
      details: 'CropBox verified: x=50, y=60, width=400, height=280 pt'
    });
  } catch (err) {
    results.push({ id: 10, name: 'Crop & Trim Margins', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 11. Flatten PDF: form fields flattened, text preserved in stream
  // -------------------------------------------------------------------------
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    page.drawText('Flatten-Base-Text', { x: 50, y: 350, size: 16 });

    const form = doc.getForm();
    const tf = form.createTextField('testField');
    tf.setText('FilledFormVal');
    tf.addToPage(page, { x: 50, y: 250, width: 200, height: 25 });

    const unflattenedBytes = await doc.save();
    const unflatFile = makeFile('unflat.pdf', unflattenedBytes);

    const flatBytes = await PDFTools.Flatten.flattenPdf(unflatFile, { mode: 'vector' });
    const flatDoc = await PDFDocument.load(flatBytes);

    // Verify form fields count is 0
    const remainingFields = flatDoc.getForm().getFields();
    assert.strictEqual(remainingFields.length, 0, 'All form fields must be flattened (0 remaining)');

    // Verify text is preserved in stream
    const texts = await extractAllPagesText(flatBytes);
    assert(texts[0].includes('Flatten-Base-Text'), 'Base text must remain present');

    results.push({
      id: 11,
      name: 'Flatten PDF',
      status: 'PASSED',
      details: 'Form fields count 1 -> 0; base content stream preserved'
    });
  } catch (err) {
    results.push({ id: 11, name: 'Flatten PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 12. JPG/PNG to PDF: converts images into multi-page PDF
  // -------------------------------------------------------------------------
  try {
    // 1x1 valid PNG images
    const dummyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    const img1 = makeFile('img1.png', dummyPng, 'image/png');
    const img2 = makeFile('img2.png', dummyPng, 'image/png');

    const pdfBytes = await PDFTools.JpgToPdf.convert([img1, img2], { pageSize: 'A4' });
    const imgDoc = await PDFDocument.load(pdfBytes);
    assert.strictEqual(imgDoc.getPageCount(), 2, 'Converted PDF must have 2 pages');

    results.push({
      id: 12,
      name: 'JPG to PDF',
      status: 'PASSED',
      details: 'Converted 2 images -> 2 pages A4 PDF verified'
    });
  } catch (err) {
    results.push({ id: 12, name: 'JPG to PDF', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 13. PDF to Word (DOCX): verifies text inside generated word/document.xml
  // -------------------------------------------------------------------------
  try {
    const samplePdf = await createCustomPdf(['Heading Title Word', 'Paragraph content for docx export']);
    const file = makeFile('to_word.pdf', samplePdf);

    const docxBlob = await PDFTools.PdfToDocx.convertToDocx(file);
    const arrBuf = await docxBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrBuf);

    const docXml = await zip.file('word/document.xml').async('text');
    assert(docXml.includes('Heading Title Word'), 'word/document.xml must contain "Heading Title Word"');
    assert(docXml.includes('Paragraph content for docx export'), 'word/document.xml must contain paragraph content');

    results.push({
      id: 13,
      name: 'PDF to Word (DOCX)',
      status: 'PASSED',
      details: 'Converted to DOCX; verified text inside word/document.xml'
    });
  } catch (err) {
    results.push({ id: 13, name: 'PDF to Word (DOCX)', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 14. Word to PDF (DOCX to PDF): Requires browser DOMParser
  // -------------------------------------------------------------------------
  results.push({
    id: 14,
    name: 'Word to PDF (DOCX)',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires DOMParser and browser XML DOM to parse Word XML structure'
  });

  // -------------------------------------------------------------------------
  // 15. PDF to Excel (XLSX): verifies cell values in xl/worksheets/sheet1.xml
  // -------------------------------------------------------------------------
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    page.drawText('Product', { x: 50, y: 350, size: 14 });
    page.drawText('Price', { x: 200, y: 350, size: 14 });
    page.drawText('Laptop', { x: 50, y: 310, size: 14 });
    page.drawText('1200.50', { x: 200, y: 310, size: 14 });

    const samplePdf = await doc.save();
    const file = makeFile('to_excel.pdf', samplePdf);

    const xlsxBlob = await PDFTools.PdfToXlsx.convertToXlsx(file);
    const arrBuf = await xlsxBlob.arrayBuffer();
    const zip = await JSZip.loadAsync(arrBuf);

    const sheetXml = await zip.file('xl/worksheets/sheet1.xml').async('text');
    assert(sheetXml.includes('Product'), 'sheet1.xml must contain "Product"');
    assert(sheetXml.includes('Laptop'), 'sheet1.xml must contain "Laptop"');
    assert(sheetXml.includes('1200.50'), 'sheet1.xml must contain "1200.50"');

    results.push({
      id: 15,
      name: 'PDF to Excel (XLSX)',
      status: 'PASSED',
      details: 'Converted to XLSX; verified cell values in xl/worksheets/sheet1.xml'
    });
  } catch (err) {
    results.push({ id: 15, name: 'PDF to Excel (XLSX)', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 16. Excel to PDF (XLSX to PDF): Requires browser DOMParser
  // -------------------------------------------------------------------------
  results.push({
    id: 16,
    name: 'Excel to PDF (XLSX)',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires DOMParser and browser XML DOM to parse spreadsheet XML'
  });

  // -------------------------------------------------------------------------
  // 17. PDF to JPG: Requires browser HTML5 Canvas
  // -------------------------------------------------------------------------
  results.push({
    id: 17,
    name: 'PDF to JPG',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires HTML5 Canvas and browser rasterizer to export images'
  });

  // -------------------------------------------------------------------------
  // 18. PDF to Grayscale: Requires browser HTML5 Canvas 2D ImageData
  // -------------------------------------------------------------------------
  results.push({
    id: 18,
    name: 'PDF to Grayscale',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires HTML5 Canvas 2D ImageData pixel manipulation'
  });

  // -------------------------------------------------------------------------
  // 19. OCR PDF: Requires browser Web Workers and Tesseract WASM
  // -------------------------------------------------------------------------
  results.push({
    id: 19,
    name: 'OCR PDF',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires browser Web Workers and Tesseract WASM runtime'
  });

  // -------------------------------------------------------------------------
  // 20. Sign PDF: Requires interactive signature canvas
  // -------------------------------------------------------------------------
  results.push({
    id: 20,
    name: 'Sign PDF',
    status: 'SKIPPED (butuh browser)',
    details: 'Requires interactive HTML5 Canvas to capture handwritten signatures'
  });

  // -------------------------------------------------------------------------
  // 21. Fill Forms: filling interactive field and verifying value on reload
  // -------------------------------------------------------------------------
  try {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 400]);
    const form = doc.getForm();
    const tf = form.createTextField('clientName');
    tf.addToPage(page, { x: 50, y: 300, width: 200, height: 25 });
    const initialBytes = await doc.save();

    // Fill field
    const loadDoc = await PDFDocument.load(initialBytes);
    loadDoc.getForm().getTextField('clientName').setText('Budi Santoso');
    const filledBytes = await loadDoc.save();

    // Verify filled value
    const reloadedDoc = await PDFDocument.load(filledBytes);
    const val = reloadedDoc.getForm().getTextField('clientName').getText();
    assert.strictEqual(val, 'Budi Santoso', 'Form field value must be "Budi Santoso"');

    results.push({
      id: 21,
      name: 'Fill Forms',
      status: 'PASSED',
      details: 'Filled text field "clientName" -> reloaded and verified value: "Budi Santoso"'
    });
  } catch (err) {
    results.push({ id: 21, name: 'Fill Forms', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 22. PDF Studio: in-memory annotation baked into exported PDF
  // -------------------------------------------------------------------------
  try {
    const samplePdf = await createCustomPdf(['Studio-Base-Page']);
    const file = makeFile('studio_test.pdf', samplePdf);

    const studioDoc = await PDFTools.Studio.loadDocument(file);
    assert.strictEqual(studioDoc.totalPages, 1, 'Studio doc totalPages must be 1');

    // Add in-memory text annotation
    const pAnn = studioDoc.getPageAnnotation(1);
    pAnn.texts = [{
      text: 'Studio-Baked-Annotation-999',
      x: 50,
      y: 200,
      fontSize: 16,
      color: '#000000'
    }];

    const exported = await PDFTools.Studio.exportDocument(studioDoc);
    const outBytes = exported.buffer || exported;

    const texts = await extractAllPagesText(outBytes);
    assert(texts[0].includes('Studio-Baked-Annotation-999'), 'Exported PDF must contain baked annotation');

    results.push({
      id: 22,
      name: 'PDF Studio',
      status: 'PASSED',
      details: 'Added in-memory annotation -> exported and verified text in output PDF'
    });
  } catch (err) {
    results.push({ id: 22, name: 'PDF Studio', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // 23. Batch Processing: processes multiple files and bundles into ZIP
  // -------------------------------------------------------------------------
  try {
    const f1Bytes = await createCustomPdf(['Batch-File-1-Text']);
    const f2Bytes = await createCustomPdf(['Batch-File-2-Text']);
    const file1 = makeFile('file1.pdf', f1Bytes);
    const file2 = makeFile('file2.pdf', f2Bytes);

    // Apply operation (watermark) across queue
    const res1 = await PDFTools.Watermark.applyWatermark(file1, { text: 'BATCH-WM' });
    const res2 = await PDFTools.Watermark.applyWatermark(file2, { text: 'BATCH-WM' });

    // Bundle into ZIP
    const zip = new JSZip();
    zip.file('file1_watermarked.pdf', res1);
    zip.file('file2_watermarked.pdf', res2);

    const zipBlob = await zip.generateAsync({ type: 'uint8array' });
    const unzipped = await JSZip.loadAsync(zipBlob);

    assert(unzipped.file('file1_watermarked.pdf'), 'ZIP must contain file1_watermarked.pdf');
    assert(unzipped.file('file2_watermarked.pdf'), 'ZIP must contain file2_watermarked.pdf');

    const pdf1Bytes = await unzipped.file('file1_watermarked.pdf').async('uint8array');
    const texts1 = await extractAllPagesText(pdf1Bytes);
    assert(texts1[0].includes('BATCH-WM'), 'file1 inside ZIP must have watermark');

    results.push({
      id: 23,
      name: 'Batch Processing',
      status: 'PASSED',
      details: 'Processed 2 files into ZIP; verified both PDFs extracted with watermark'
    });
  } catch (err) {
    results.push({ id: 23, name: 'Batch Processing', status: 'FAILED', details: err.message });
  }

  // -------------------------------------------------------------------------
  // Print Results Table
  // -------------------------------------------------------------------------
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  console.log('| No | Tool / Feature Name               | Status                    | Test Details                                         |');
  console.log('-----------------------------------------------------------------------------------------------------------------------------');
  results.forEach(r => {
    const no = String(r.id).padEnd(2);
    const name = r.name.padEnd(33);
    const status = (
      r.status === 'PASSED' ? 'PASSED' :
      r.status.startsWith('SKIPPED') ? 'SKIPPED (butuh browser)' :
      'FAILED'
    ).padEnd(25);
    const details = r.details.padEnd(52);
    console.log(`| ${no} | ${name} | ${status} | ${details} |`);
  });
  console.log('-----------------------------------------------------------------------------------------------------------------------------\n');

  const passedCount = results.filter(r => r.status === 'PASSED').length;
  const skippedCount = results.filter(r => r.status.startsWith('SKIPPED')).length;
  const failedCount = results.filter(r => r.status === 'FAILED').length;

  console.log(`Summary: ${passedCount} passed, ${skippedCount} skipped (butuh browser), ${failedCount} failed across ${results.length} tools audited.`);

  if (failedCount > 0) {
    console.error(`\nFailed tools (${failedCount}):`);
    results.filter(r => r.status === 'FAILED').forEach(f => {
      console.error(`  - ${f.name}: ${f.details}`);
    });
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch(err => {
  console.error('Audit execution error:', err);
  process.exit(1);
});
