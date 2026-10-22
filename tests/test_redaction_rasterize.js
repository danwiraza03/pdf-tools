/**
 * Automated Test: Redaction Rasterization & Anti-Leak Verification
 *
 * Verifies that:
 * 1. Sample PDF with secret text 'RAHASIA-12345' and 'TETAP-ADA' on Page 1, and vector text on Page 2 is created.
 * 2. Area 'RAHASIA-12345' is redacted via rasterization at >= 200 DPI.
 * 3. 'RAHASIA-12345' is NOT found in raw bytes of the file.
 * 4. 'RAHASIA-12345' is NOT found in any decompressed streams.
 * 5. 'RAHASIA-12345' is NOT found in PDF.js extracted text for Page 1.
 * 6. Page 2 (unredacted) retains its crisp vector text and remains extractable with PDF.js.
 * 7. Annotations and form fields on redacted page are cleared.
 */

const path = require('path');
const zlib = require('zlib');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load vendor libraries
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// Load coordinate and redaction engines
const PDFCoordinateEngine = require(path.join(ROOT_DIR, 'js/editor/pdf-coordinate-engine.js'));
const RedactionEngine = require(path.join(ROOT_DIR, 'js/editor/redaction-engine.js'));

const { PDFDocument, rgb, StandardFonts } = PDFLib;

async function runTest() {
  console.log('====================================================');
  console.log('🧪 Starting Redaction Rasterization & Anti-Leak Test');
  console.log('====================================================');

  // Verify configurable DPI constant
  assert(typeof RedactionEngine.DEFAULT_DPI === 'number', 'RedactionEngine.DEFAULT_DPI must be a number');
  assert(RedactionEngine.DEFAULT_DPI >= 200, `DEFAULT_DPI must be >= 200 (actual: ${RedactionEngine.DEFAULT_DPI})`);
  console.log(`✓ Check 1: DEFAULT_DPI is configurable constant (DPI = ${RedactionEngine.DEFAULT_DPI})`);

  // Step 1: Create a 2-page sample PDF
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: Contains secret text and normal text
  const page1 = doc.addPage([600, 400]);
  page1.drawText('RAHASIA-12345', { x: 50, y: 300, size: 24, font, color: rgb(0, 0, 0) });
  page1.drawText('TETAP-ADA', { x: 50, y: 100, size: 20, font, color: rgb(0.2, 0.2, 0.2) });

  // Add a test form field to Page 1
  const form = doc.getForm();
  const secretField = form.createTextField('secretFieldOnPage1');
  secretField.setText('ConfidentialFieldVal');
  secretField.addToPage(page1, { x: 50, y: 50, width: 150, height: 20 });

  // Page 2: Normal vector page (must remain untouched vector)
  const page2 = doc.addPage([600, 400]);
  page2.drawText('HALAMAN-DUA-VEKTOR', { x: 50, y: 250, size: 22, font, color: rgb(0, 0, 0) });
  page2.drawText('Dokumen halaman kedua yang tidak diredaksi.', { x: 50, y: 180, size: 14, font, color: rgb(0.3, 0.3, 0.3) });

  const originalBytes = await doc.save();
  console.log(`✓ Check 2: Sample 2-page PDF generated (${originalBytes.length} bytes)`);

  // Verify initial text extraction via PDF.js (use copy so buffer is not detached)
  const pdfjsOriginal = await pdfjs.getDocument({ data: new Uint8Array(originalBytes).slice(0) }).promise;
  const origPage1 = await pdfjsOriginal.getPage(1);
  const origPage1Text = (await origPage1.getTextContent()).items.map(i => i.str).join(' ');
  assert(origPage1Text.includes('RAHASIA-12345'), 'Original Page 1 must contain RAHASIA-12345 before redaction');
  console.log('✓ Check 3: Verified RAHASIA-12345 is present on original Page 1');

  // Step 2: Load document and apply redaction over 'RAHASIA-12345'
  const redactDoc = await PDFDocument.load(originalBytes);
  const annotationsMap = {
    1: {
      redactions: [
        {
          id: 'red_test_secret',
          isPdfCoord: true,
          pdfX: 45,
          pdfY: 295,
          width: 230,
          height: 35,
          fillColor: '#000000'
        }
      ]
    }
  };

  // Perform permanent rasterized redaction
  await RedactionEngine.applyPermanentRedactionsToDocument(
    redactDoc,
    pdfjsOriginal,
    annotationsMap,
    {
      dpi: 200,
      CoordinateEngine: PDFCoordinateEngine
    }
  );

  const redactedBytes = await redactDoc.save();
  console.log(`✓ Check 4: Permanent redaction applied and document saved (${redactedBytes.length} bytes)`);

  // Step 3: Verification - Raw bytes inspection
  const rawBinary = Buffer.from(redactedBytes).toString('binary');
  const foundInRawBytes = rawBinary.includes('RAHASIA-12345');
  assert(!foundInRawBytes, 'FAIL: RAHASIA-12345 leaked in raw bytes of the file!');
  console.log('✓ Check 5: Zero raw bytes data leak: "RAHASIA-12345" NOT found in raw bytes');

  // Step 4: Verification - Decompressed streams inspection
  let foundInDecompressedStreams = false;
  let streamIdx = 0;
  while ((streamIdx = rawBinary.indexOf('stream', streamIdx)) !== -1) {
    const endstream = rawBinary.indexOf('endstream', streamIdx);
    if (endstream === -1) break;
    const nl = rawBinary.indexOf('\n', streamIdx);
    if (nl !== -1 && nl < endstream) {
      const streamBuf = Buffer.from(redactedBytes).subarray(nl + 1, endstream);
      try {
        const decompressed = zlib.inflateSync(streamBuf);
        if (decompressed.toString('binary').includes('RAHASIA-12345')) {
          foundInDecompressedStreams = true;
          break;
        }
      } catch (e) {
        // Stream may not be Flate compressed or may be image data
      }
    }
    streamIdx = endstream + 9;
  }
  assert(!foundInDecompressedStreams, 'FAIL: RAHASIA-12345 leaked in decompressed streams!');
  console.log('✓ Check 6: Zero stream data leak: "RAHASIA-12345" NOT found in any decompressed streams');

  // Step 5: Verification - PDF.js Text Content Extraction
  const pdfjsRedacted = await pdfjs.getDocument({ data: redactedBytes }).promise;
  assert.strictEqual(pdfjsRedacted.numPages, 2, 'Page count must remain 2');

  const redPage1 = await pdfjsRedacted.getPage(1);
  const redPage1Items = (await redPage1.getTextContent()).items;
  const redPage1Text = redPage1Items.map(i => i.str).join(' ');

  assert(!redPage1Text.includes('RAHASIA-12345'), 'FAIL: RAHASIA-12345 still extractable on Page 1!');
  assert.strictEqual(redPage1Items.length, 0, 'Page 1 must be rasterized to an image with 0 vector text items');
  console.log('✓ Check 7: PDF.js extracted text on redacted Page 1 has 0 text items (secret text completely eliminated)');

  // Step 6: Verification - Unredacted Page 2 remains native vector
  const redPage2 = await pdfjsRedacted.getPage(2);
  const redPage2Items = (await redPage2.getTextContent()).items;
  const redPage2Text = redPage2Items.map(i => i.str).join(' ');

  assert(redPage2Text.includes('HALAMAN-DUA-VEKTOR'), 'FAIL: Page 2 text must still be extractable!');
  assert(redPage2Items.length > 0, 'Page 2 must remain vector with selectable text items');
  console.log(`✓ Check 8: Page 2 (unredacted) vector text preserved: "${redPage2Text.trim()}"`);

  // Step 7: Form field removed on Page 1
  const remainingFields = redactDoc.getForm().getFields().map(f => f.getName());
  assert(!remainingFields.includes('secretFieldOnPage1'), 'FAIL: Form field on Page 1 must be removed');
  console.log('✓ Check 9: Form fields on redacted Page 1 successfully purged');

  console.log('====================================================');
  console.log('🎉 ALL 9 REDACTION ANTI-LEAK CHECKS PASSED!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
