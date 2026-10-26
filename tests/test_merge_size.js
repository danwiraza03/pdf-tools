/**
 * Automated Test: Merge Size Optimization & Resource Sharing
 *
 * Verifies that merging pages from source PDFs does not duplicate shared resources
 * (fonts, large images, XObjects) per page.
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');
const zlib = require('zlib');

const ROOT_DIR = path.resolve(__dirname, '..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// Mock browser globals for PDFTools
global.window = global;
global.PDFLib = PDFLib;
global.pdfjsLib = pdfjs;

// Filter out harmless PDF.js worker font fetching warnings in Node environment
const _origStderrWrite = process.stderr.write;
process.stderr.write = function (chunk, ...args) {
  if (chunk && chunk.toString().includes('fetchStandardFontData')) return true;
  return _origStderrWrite.apply(process.stderr, [chunk, ...args]);
};

// Load FileUtils and Merge core modules
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/utils/file-utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-merge.js'), 'utf8'));

/**
 * Creates a valid PNG buffer (~300 KB) with pseudo-random noise
 * to prevent zlib deflate from over-compressing it.
 */
function createNoisePngBuffer(width = 320, height = 320) {
  const raw = Buffer.alloc(height * (1 + width * 3));
  let seed = 987654321;
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 3)] = 0; // Filter type None
    for (let x = 0; x < width * 3; x++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      raw[y * (1 + width * 3) + 1 + x] = (seed >> 16) & 0xff;
    }
  }

  const def = zlib.deflateSync(raw);

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB
  ihdr[10] = 0; // compression method
  ihdr[11] = 0; // filter method
  ihdr[12] = 0; // interlace method

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = zlib.crc32(toCrc);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc >>> 0, 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', def),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

/**
 * Builds Fixture A: 60 pages sharing ONE ~300 KB PNG and unique text per page.
 */
async function buildFixtureDocA(pngBuffer) {
  const doc = await PDFLib.PDFDocument.create();
  const img = await doc.embedPng(pngBuffer);

  for (let i = 0; i < 60; i++) {
    const page = doc.addPage([595, 842]);
    page.drawImage(img, { x: 50, y: 150, width: 200, height: 200 });
    const pageTag = `HAL-A-${String(i + 1).padStart(2, '0')}`;
    page.drawText(pageTag, { x: 50, y: 750, size: 20 });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { doc, bytes };
}

/**
 * Builds Fixture B: 5 pages with unique text per page.
 */
async function buildFixtureDocB() {
  const doc = await PDFLib.PDFDocument.create();

  for (let i = 0; i < 5; i++) {
    const page = doc.addPage([595, 842]);
    const pageTag = `HAL-B-${String(i + 1).padStart(2, '0')}`;
    page.drawText(pageTag, { x: 50, y: 750, size: 20 });
  }

  const bytes = await doc.save({ useObjectStreams: true });
  return { doc, bytes };
}

/**
 * Counts image XObjects matching the test image dimensions in the PDFDocument context.
 */
function countImageObjects(pdfDoc) {
  let count = 0;
  for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (obj && obj.dict && typeof obj.dict.get === 'function') {
      const subtype = obj.dict.get(PDFLib.PDFName.of('Subtype'));
      if (subtype && subtype.toString() === '/Image') {
        const width = obj.dict.get(PDFLib.PDFName.of('Width'));
        const height = obj.dict.get(PDFLib.PDFName.of('Height'));
        if (width && width.numberValue === 320 && height && height.numberValue === 320) {
          count++;
        }
      }
    }
  }
  return count;
}

async function runMergeSizeTest() {
  console.log('========================================================================');
  console.log('>>> [TEST] Merge Size & Shared Resource Retention Test');
  console.log('========================================================================\n');

  console.log('1. Generating fixtures (Doc A: 60 pages with ~300 KB image, Doc B: 5 pages)...');
  const pngBuffer = createNoisePngBuffer(320, 320);
  console.log(`   - Generated noise PNG: ${pngBuffer.length} bytes (~${(pngBuffer.length / 1024).toFixed(1)} KB)`);

  const fixtureA = await buildFixtureDocA(pngBuffer);
  const fixtureB = await buildFixtureDocB();

  const sizeA = fixtureA.bytes.length;
  const sizeB = fixtureB.bytes.length;
  const sumSourceSizes = sizeA + sizeB;

  console.log(`   - Doc A size: ${sizeA} bytes (~${(sizeA / 1024).toFixed(1)} KB, 60 pages)`);
  console.log(`   - Doc B size: ${sizeB} bytes (~${(sizeB / 1024).toFixed(1)} KB, 5 pages)`);
  console.log(`   - Sum of source sizes: ${sumSourceSizes} bytes (~${(sumSourceSizes / 1024).toFixed(1)} KB)\n`);

  const fileA = {
    name: 'DocA_Thesis.pdf',
    size: sizeA,
    lastModified: 1000,
    buffer: fixtureA.bytes.buffer.slice(fixtureA.bytes.byteOffset, fixtureA.bytes.byteOffset + fixtureA.bytes.byteLength)
  };

  const fileB = {
    name: 'DocB_Appendix.pdf',
    size: sizeB,
    lastModified: 2000,
    buffer: fixtureB.bytes.buffer.slice(fixtureB.bytes.byteOffset, fixtureB.bytes.byteOffset + fixtureB.bytes.byteLength)
  };

  // Build requested page sequence:
  // - Two documents interleaved: A1, B1, A2, B2, A3, B3, A4, B4, A5, B5 (indices 0..4)
  // - One page rotated 90 degrees: e.g. A page 2 (HAL-A-03)
  // - Partial random order: shuffle subset of pages 5..15 from A
  // - One page requested twice (duplicate): e.g. A page 0 (HAL-A-01) requested again
  // - Remaining pages from A (16..59)
  const items = [];
  const expectedPages = [];

  // 1. Interleaving A and B for first 5 pages
  for (let i = 0; i < 5; i++) {
    const rotA = (i === 2) ? 90 : 0; // Rotate page A-03 by 90°
    items.push({ file: fileA, doc: fixtureA.doc, pageIndex: i, rotation: rotA });
    expectedPages.push({ expectedText: `HAL-A-${String(i + 1).padStart(2, '0')}`, expectedRotation: rotA });

    items.push({ file: fileB, doc: fixtureB.doc, pageIndex: i, rotation: 0 });
    expectedPages.push({ expectedText: `HAL-B-${String(i + 1).padStart(2, '0')}`, expectedRotation: 0 });
  }

  // 2. Duplicate page: Page A-01 requested a second time
  items.push({ file: fileA, doc: fixtureA.doc, pageIndex: 0, rotation: 0 });
  expectedPages.push({ expectedText: 'HAL-A-01', expectedRotation: 0, isDuplicate: true });

  // 3. Partial random order of pages from A (indices 5 to 14)
  const shuffledAIndices = [10, 7, 5, 12, 8, 14, 6, 11, 9, 13];
  for (const idx of shuffledAIndices) {
    items.push({ file: fileA, doc: fixtureA.doc, pageIndex: idx, rotation: 0 });
    expectedPages.push({ expectedText: `HAL-A-${String(idx + 1).padStart(2, '0')}`, expectedRotation: 0 });
  }

  // 4. Remaining sequential pages from A (indices 15 to 59)
  for (let idx = 15; idx < 60; idx++) {
    items.push({ file: fileA, doc: fixtureA.doc, pageIndex: idx, rotation: 0 });
    expectedPages.push({ expectedText: `HAL-A-${String(idx + 1).padStart(2, '0')}`, expectedRotation: 0 });
  }

  const duplicatePagesCount = 1;
  const duplicateRounds = 1;
  console.log(`2. Merging ${items.length} pages via Page Mode (interleaved, rotated, shuffled, and 1 duplicate page)...`);

  const mergeResult = await PDFTools.Merge.merge(items);
  const mergedBytes = mergeResult.bytes;
  console.log(`   - Merged result size: ${mergedBytes.length} bytes (~${(mergedBytes.length / (1024 * 1024)).toFixed(2)} MB)\n`);

  console.log('3. Validating assertions:');

  // a. Ukuran hasil <= 1.15 x jumlah ukuran sumber + 100 KB per halaman duplikat
  const allowedMaxSize = Math.round(1.15 * sumSourceSizes + (duplicatePagesCount * 100 * 1024));
  console.log(`   [Assert A] Result size: ${mergedBytes.length} bytes vs Allowed max: ${allowedMaxSize} bytes`);
  assert(
    mergedBytes.length <= allowedMaxSize,
    `Merge size exploded! Got ${mergedBytes.length} bytes (~${(mergedBytes.length / (1024 * 1024)).toFixed(2)} MB), ` +
    `expected <= ${allowedMaxSize} bytes (~${(allowedMaxSize / 1024).toFixed(1)} KB)`
  );
  console.log('   ✓ [PASS Assert A] Merged size is within optimal limit.');

  // b. Jumlah objek gambar identik tidak lebih dari (1 + jumlah putaran duplikat)
  const loadedMergedDoc = await PDFLib.PDFDocument.load(mergedBytes);
  const imgObjectCount = countImageObjects(loadedMergedDoc);
  const maxAllowedImages = 1 + duplicateRounds;
  console.log(`   [Assert B] Image XObjects in merged PDF: ${imgObjectCount} vs Max allowed: ${maxAllowedImages}`);
  assert(
    imgObjectCount <= maxAllowedImages,
    `Image object duplicated excessively! Found ${imgObjectCount} image objects (expected <= ${maxAllowedImages}, not ${items.length})`
  );
  console.log('   ✓ [PASS Assert B] Image objects deduplicated properly.');

  // c. Urutan, isi teks (lewat PDF.js), jumlah halaman, rotasi, dan halaman ganda
  const pdfjsDoc = await pdfjs.getDocument({ data: new Uint8Array(mergedBytes).slice(0), verbosity: 0 }).promise;
  assert.strictEqual(pdfjsDoc.numPages, items.length, `Total page count mismatch: expected ${items.length}, got ${pdfjsDoc.numPages}`);

  for (let p = 1; p <= pdfjsDoc.numPages; p++) {
    const page = await pdfjsDoc.getPage(p);
    const expected = expectedPages[p - 1];

    // Verify rotation
    assert.strictEqual(page.rotate, expected.expectedRotation, `Page ${p} rotation mismatch: expected ${expected.expectedRotation}, got ${page.rotate}`);

    // Verify extracted text
    const textContent = await page.getTextContent();
    const str = textContent.items.map(it => it.str).join(' ');
    assert(
      str.includes(expected.expectedText),
      `Page ${p} text mismatch: expected to contain "${expected.expectedText}", got "${str}"`
    );
  }
  console.log(`   ✓ [PASS Assert C] All ${pdfjsDoc.numPages} pages verified with PDF.js for exact text order, rotation, and duplicates.`);

  console.log('\n✅ [PASS] All Merge Size & Shared Resource Retention tests passed successfully!\n');
  return { success: true };
}

if (require.main === module) {
  runMergeSizeTest()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('\n❌ [FAIL] Merge Size Test Failed with error:');
      console.error(err.message || err);
      process.exit(1);
    });
}

module.exports = { runMergeSizeTest };
