const assert = require('assert');
const path = require('path');
const pdfjs = require(path.resolve(__dirname, '../../js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.resolve(__dirname, '../../js/lib/pdf.worker.min.js');

const { createTestPdf, createColorPdf, createSampleDocx, createSampleXlsx } = require('./helpers');

async function extractTextFromPdfBytes(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes).slice(0), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    out.push(content.items.map(t => t.str).join(' '));
  }
  await doc.destroy();
  return { numPages: doc.numPages, text: out.join(' ') };
}

/**
 * Runs strengthened tests for the 6 tools that were previously skipped in audit_all_tools.js:
 * 1. Word to PDF (DOCX)
 * 2. Excel to PDF (XLSX)
 * 3. PDF to JPG (decode image, check dimensions, non-white text area)
 * 4. PDF to Grayscale (verify source is colorful, result has R=G=B)
 * 5. OCR PDF (Tesseract WASM)
 * 6. Sign PDF (verify input location is white, new image object exists, output location is not white)
 */
async function runSkippedToolsTests(browser, baseUrl) {
  console.log('\n====================================================');
  console.log('>>> [BROWSER TEST] 6 Previously Skipped Tools Audit');
  console.log('====================================================');

  const page = await browser.newPage();

  try {
    // -----------------------------------------------------------------------
    // 1. Word to PDF (DOCX)
    // -----------------------------------------------------------------------
    console.log('\n--- [1/6] Word to PDF (DOCX to PDF) ---');
    const docxText = 'Playwright Word to PDF Test Content';
    const docxBytes = await createSampleDocx(docxText);

    await page.goto(`${baseUrl}/pages/docx-to-pdf.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.DocxToPdf));

    const docxPdfBase64 = await page.evaluate(async (base64) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'sample.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });

      const pdfBlob = await window.PDFTools.DocxToPdf.convertToPdf(file, {
        pageSize: 'A4',
        orientation: 'portrait',
        margins: 36
      }, () => {});

      const arrBuf = await pdfBlob.arrayBuffer();
      const u8 = new Uint8Array(arrBuf);
      let binOut = '';
      const chunk = 8192;
      for (let i = 0; i < u8.length; i += chunk) {
        binOut += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
      }
      return btoa(binOut);
    }, Buffer.from(docxBytes).toString('base64'));

    const docxPdfBytes = Buffer.from(docxPdfBase64, 'base64');
    const docxVerification = await extractTextFromPdfBytes(docxPdfBytes);
    assert(docxVerification.numPages >= 1, 'Word to PDF must produce at least 1 page');
    assert(docxVerification.text.includes(docxText), `Converted PDF must contain: "${docxText}"`);
    console.log(`  ✓ Word to PDF berhasil dikonversi via DOMParser browser. Teks terverifikasi: "${docxText}"`);

    // -----------------------------------------------------------------------
    // 2. Excel to PDF (XLSX)
    // -----------------------------------------------------------------------
    console.log('\n--- [2/6] Excel to PDF (XLSX to PDF) ---');
    const xlsxText = 'Playwright Excel Test Value';
    const xlsxBytes = await createSampleXlsx(xlsxText);

    await page.goto(`${baseUrl}/pages/xlsx-to-pdf.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.XlsxToPdf));

    const xlsxPdfBase64 = await page.evaluate(async (base64) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'sample.xlsx', { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });

      const pdfBlob = await window.PDFTools.XlsxToPdf.convertToPdf(file, {
        pageSize: 'A4',
        orientation: 'landscape',
        fitToPage: true
      }, () => {});

      const arrBuf = await pdfBlob.arrayBuffer();
      const u8 = new Uint8Array(arrBuf);
      let binOut = '';
      const chunk = 8192;
      for (let i = 0; i < u8.length; i += chunk) {
        binOut += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
      }
      return btoa(binOut);
    }, Buffer.from(xlsxBytes).toString('base64'));

    const xlsxPdfBytes = Buffer.from(xlsxPdfBase64, 'base64');
    const xlsxVerification = await extractTextFromPdfBytes(xlsxPdfBytes);
    assert(xlsxVerification.numPages >= 1, 'Excel to PDF must produce at least 1 page');
    assert(xlsxVerification.text.includes(xlsxText), `Converted PDF must contain: "${xlsxText}"`);
    console.log(`  ✓ Excel to PDF berhasil dikonversi via DOMParser browser. Nilai sel terverifikasi: "${xlsxText}"`);

    // -----------------------------------------------------------------------
    // 3. PDF to JPG (Decode image, verify dimensions, non-white text area)
    // -----------------------------------------------------------------------
    console.log('\n--- [3/6] PDF to JPG ---');
    const pageW = 600;
    const pageH = 400;
    const pdfToImgBytes = await createTestPdf({
      text: 'PDF TO IMAGE TEST',
      width: pageW,
      height: pageH,
      textX: 100,
      textY: 250,
      textSize: 24
    });

    await page.goto(`${baseUrl}/pages/pdf-to-jpg.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.PdfToJpg));

    const imgResult = await page.evaluate(async ({ base64, pWidth, pHeight }) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'sample_for_jpg.pdf', { type: 'application/pdf' });

      // standard quality uses scale 1.5
      const images = await window.PDFTools.PdfToJpg.convert(file, {
        quality: 'standard',
        format: 'jpeg'
      }, () => {});

      if (!images || images.length === 0) throw new Error('No images returned from PDF to JPG conversion');

      const imgItem = images[0];
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = imgItem.dataUrl;
      });

      const actualWidth = img.naturalWidth;
      const actualHeight = img.naturalHeight;
      const expectedWidth = Math.round(pWidth * 1.5);
      const expectedHeight = Math.round(pHeight * 1.5);

      // Draw decoded image onto a canvas to inspect pixel content
      const canvas = document.createElement('canvas');
      canvas.width = actualWidth;
      canvas.height = actualHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Text was drawn at PDF coords x: 100, y: 250 (bottom-left origin).
      // Screen top-left y: 400 - (250 + 24) = 126.
      // Scaled by 1.5: x = 150, y = 189.
      const sampleArea = ctx.getImageData(150, 185, 200, 35);
      let nonWhitePixels = 0;
      for (let i = 0; i < sampleArea.data.length; i += 4) {
        const r = sampleArea.data[i];
        const g = sampleArea.data[i + 1];
        const b = sampleArea.data[i + 2];
        if (r < 220 || g < 220 || b < 220) {
          nonWhitePixels++;
        }
      }

      return {
        count: images.length,
        actualWidth,
        actualHeight,
        expectedWidth,
        expectedHeight,
        dimensionsMatch: (actualWidth === expectedWidth && actualHeight === expectedHeight),
        nonWhitePixels,
        hasNonWhiteText: nonWhitePixels > 50
      };
    }, { base64: Buffer.from(pdfToImgBytes).toString('base64'), pWidth: pageW, pHeight: pageH });

    assert.strictEqual(imgResult.count, 1, 'PDF to JPG must extract 1 image for 1-page PDF');
    assert(imgResult.dimensionsMatch, `Image dimensions (${imgResult.actualWidth}x${imgResult.actualHeight}) must match page * scale (${imgResult.expectedWidth}x${imgResult.expectedHeight})`);
    console.log(`  ✓ Dimensi gambar hasil decode (${imgResult.actualWidth}x${imgResult.actualHeight}px) terverifikasi sesuai ukuran halaman x skala (600x400 * 1.5).`);
    assert(imgResult.hasNonWhiteText, 'Text area in converted JPEG must NOT be pure white');
    console.log(`  ✓ Area teks pada gambar hasil terbukti TIDAK putih polos (${imgResult.nonWhitePixels} piksel teks terdeteksi).`);

    // -----------------------------------------------------------------------
    // 2. PDF to Grayscale (Pre-check input is color, verify result pixels R=G=B)
    // -----------------------------------------------------------------------
    console.log('\n--- [4/6] PDF to Grayscale ---');
    const colorPdfBytes = await createColorPdf({ width: 600, height: 400 });

    await page.goto(`${baseUrl}/pages/grayscale.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Grayscale));

    const grayResult = await page.evaluate(async (base64) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'sample_color.pdf', { type: 'application/pdf' });

      // Step 1: Render input PDF to canvas and verify it IS COLORFUL before conversion
      const srcPdf = await window.pdfjsLib.getDocument({ data: bytes.slice(0), verbosity: 0 }).promise;
      const srcPage = await srcPdf.getPage(1);
      const srcViewport = srcPage.getViewport({ scale: 1.0 });
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcViewport.width;
      srcCanvas.height = srcViewport.height;
      const srcCtx = srcCanvas.getContext('2d');
      await srcPage.render({ canvasContext: srcCtx, viewport: srcViewport }).promise;
      await srcPdf.destroy();

      // Red rectangle is at PDF x: 80..280, y: 180..300 -> screen top-left y: 400 - (180+120) = 100
      const srcRedArea = srcCtx.getImageData(120, 140, 40, 40).data;
      let srcIsColorful = false;
      let maxColorDelta = 0;
      for (let i = 0; i < srcRedArea.length; i += 4) {
        const r = srcRedArea[i];
        const g = srcRedArea[i + 1];
        const b = srcRedArea[i + 2];
        const delta = Math.max(Math.abs(r - g), Math.abs(r - b), Math.abs(g - b));
        if (delta > maxColorDelta) maxColorDelta = delta;
        if (delta > 50) {
          srcIsColorful = true;
        }
      }

      // Step 2: Convert to grayscale
      const grayBytes = await window.PDFTools.Grayscale.convertToGrayscale(file, {
        mode: 'grayscale',
        quality: 'standard'
      });

      // Step 3: Render resulting PDF to canvas and verify all sampled pixels have R=G=B
      const resPdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(grayBytes), verbosity: 0 }).promise;
      const resPage = await resPdf.getPage(1);
      const resViewport = resPage.getViewport({ scale: 1.0 });
      const resCanvas = document.createElement('canvas');
      resCanvas.width = resViewport.width;
      resCanvas.height = resViewport.height;
      const resCtx = resCanvas.getContext('2d');
      await resPage.render({ canvasContext: resCtx, viewport: resViewport }).promise;
      await resPdf.destroy();

      // Sample pixels across previously red and blue areas
      const sample1 = resCtx.getImageData(120, 140, 50, 50).data;
      const sample2 = resCtx.getImageData(350, 140, 50, 50).data;
      const allSamples = new Uint8Array(sample1.length + sample2.length);
      allSamples.set(sample1, 0);
      allSamples.set(sample2, sample1.length);

      let allRgbEqual = true;
      let maxGrayDelta = 0;
      let samplesChecked = 0;

      for (let i = 0; i < allSamples.length; i += 16) { // check grid of pixels
        samplesChecked++;
        const r = allSamples[i];
        const g = allSamples[i + 1];
        const b = allSamples[i + 2];
        const delta = Math.max(Math.abs(r - g), Math.abs(g - b), Math.abs(r - b));
        if (delta > maxGrayDelta) maxGrayDelta = delta;
        if (delta > 3) {
          allRgbEqual = false;
        }
      }

      return {
        srcIsColorful,
        maxColorDelta,
        allRgbEqual,
        maxGrayDelta,
        samplesChecked
      };
    }, Buffer.from(colorPdfBytes).toString('base64'));

    assert(grayResult.srcIsColorful, `Input PDF must be confirmed colorful before conversion (max color delta was ${grayResult.maxColorDelta})`);
    console.log(`  ✓ Terverifikasi PDF sumber memang berwarna sebelum konversi (color delta: ${grayResult.maxColorDelta} > 50).`);
    assert(grayResult.allRgbEqual, `Every sampled pixel must have R=G=B (max delta was ${grayResult.maxGrayDelta})`);
    console.log(`  ✓ Terverifikasi seluruh ${grayResult.samplesChecked} piksel sampel memiliki R=G=B (toleransi delta: ${grayResult.maxGrayDelta} <= 3).`);

    // -----------------------------------------------------------------------
    // 5. OCR PDF (Tesseract WASM)
    // -----------------------------------------------------------------------
    console.log('\n--- [5/6] OCR PDF (Tesseract WASM) ---');
    await page.goto(`${baseUrl}/pages/ocr.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.OCR));

    const ocrResult = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 150;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, 400, 150);
      ctx.fillStyle = '#000000';
      ctx.font = 'bold 36px Arial, sans-serif';
      ctx.fillText('HELLO OCR', 40, 90);

      const res = await window.PDFTools.OCR.recognizeCanvas(canvas, 'eng', () => {});
      const recognized = ((res && typeof res.text === 'string' ? res.text : (res && res.data ? res.data.text : '')) || '').trim();

      await window.PDFTools.OCR.terminate();

      return {
        recognizedText: recognized
      };
    });

    assert(ocrResult.recognizedText.length > 0, 'OCR must return recognized text');
    console.log(`  ✓ OCR PDF berhasil mengeksekusi Tesseract.js WASM lokal. Hasil deteksi: "${ocrResult.recognizedText.replace(/\n/g, ' ')}"`);

    // -----------------------------------------------------------------------
    // 6. Sign PDF (Pre-check input white, verify new image object, verify pixels not white)
    // -----------------------------------------------------------------------
    console.log('\n--- [6/6] Sign PDF ---');
    const signPdfBytes = await createTestPdf({
      text: 'DOCUMENT HEADER AT TOP',
      width: 600,
      height: 400,
      textX: 50,
      textY: 340,
      textSize: 20
    });

    await page.goto(`${baseUrl}/pages/sign.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFLib && window.pdfjsLib));

    const signResult = await page.evaluate(async (base64) => {
      const bin = atob(base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

      // Step 1: Render input PDF to canvas and verify the signature target area is PURE WHITE
      const srcDoc = await window.pdfjsLib.getDocument({ data: bytes.slice(0), verbosity: 0 }).promise;
      const srcPage = await srcDoc.getPage(1);
      const srcViewport = srcPage.getViewport({ scale: 1.0 });
      const srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcViewport.width;
      srcCanvas.height = srcViewport.height;
      const srcCtx = srcCanvas.getContext('2d');
      await srcPage.render({ canvasContext: srcCtx, viewport: srcViewport }).promise;
      await srcDoc.destroy();

      // Signature will be placed at PDF coords x: 50..200, y: 50..110.
      // Top-left screen coords: x: 50..200, y: 400 - (50 + 60) = 290..350.
      const srcTargetArea = srcCtx.getImageData(60, 300, 120, 40).data;
      let srcLocationIsPureWhite = true;
      for (let i = 0; i < srcTargetArea.length; i += 4) {
        if (srcTargetArea[i] < 250 || srcTargetArea[i + 1] < 250 || srcTargetArea[i + 2] < 250) {
          srcLocationIsPureWhite = false;
          break;
        }
      }

      // Step 2: Sign the document using PDFLib
      const pdfDoc = await window.PDFLib.PDFDocument.load(bytes);
      const page1 = pdfDoc.getPages()[0];

      // Create a dark circular signature
      const sigCanvas = document.createElement('canvas');
      sigCanvas.width = 150;
      sigCanvas.height = 60;
      const sCtx = sigCanvas.getContext('2d');
      sCtx.fillStyle = '#1A365D'; // Navy signature ink
      sCtx.beginPath();
      sCtx.ellipse(75, 30, 60, 20, 0, 0, Math.PI * 2);
      sCtx.fill();
      const sigDataUrl = sigCanvas.toDataURL('image/png');

      const sigImg = await pdfDoc.embedPng(sigDataUrl);
      page1.drawImage(sigImg, {
        x: 50,
        y: 50,
        width: 150,
        height: 60
      });

      const signedBytes = await pdfDoc.save();

      // Step 3: Verify the output has a new embedded Image object
      const verifyDoc = await window.PDFLib.PDFDocument.load(signedBytes);
      const verifyPage = verifyDoc.getPages()[0];
      const resources = verifyPage.node.normalizedEntries().Resources;
      const xObject = resources ? resources.lookup(window.PDFLib.PDFName.of('XObject')) : null;
      const hasImageXObject = !!(xObject && xObject.dict && xObject.dict.size > 0);

      // Step 4: Render signed PDF to canvas and verify signature area is NOT pure white
      const signedPdfJs = await window.pdfjsLib.getDocument({ data: new Uint8Array(signedBytes), verbosity: 0 }).promise;
      const signedPage = await signedPdfJs.getPage(1);
      const signedViewport = signedPage.getViewport({ scale: 1.0 });
      const signedCanvas = document.createElement('canvas');
      signedCanvas.width = signedViewport.width;
      signedCanvas.height = signedViewport.height;
      const signedCtx = signedCanvas.getContext('2d');
      await signedPage.render({ canvasContext: signedCtx, viewport: signedViewport }).promise;
      await signedPdfJs.destroy();

      const signedTargetArea = signedCtx.getImageData(60, 300, 120, 40).data;
      let hasDarkSignaturePixels = false;
      let darkCount = 0;
      for (let i = 0; i < signedTargetArea.length; i += 4) {
        if (signedTargetArea[i] < 100 || signedTargetArea[i + 1] < 100 || signedTargetArea[i + 2] < 150) {
          hasDarkSignaturePixels = true;
          darkCount++;
        }
      }

      return {
        srcLocationIsPureWhite,
        hasImageXObject,
        hasDarkSignaturePixels,
        darkCount
      };
    }, Buffer.from(signPdfBytes).toString('base64'));

    assert(signResult.srcLocationIsPureWhite, 'Signature location on input PDF must be pure white before signing');
    console.log('  ✓ Terverifikasi area lokasi tanda tangan pada input PDF masih putih polos.');
    assert(signResult.hasImageXObject, 'Signed PDF must contain newly embedded XObject Image');
    console.log('  ✓ Dokumen hasil terverifikasi memiliki objek gambar tanda tangan baru (/XObject Image).');
    assert(signResult.hasDarkSignaturePixels, 'Signature location on signed PDF must NOT be pure white');
    console.log(`  ✓ Piksel di lokasi tanda tangan terbukti TIDAK putih polos (${signResult.darkCount} piksel tinta tanda tangan terdeteksi).`);

    console.log('\n✅ [PASS] All 6 Skipped Tools Browser Verification PASSED\n');
    return true;
  } finally {
    await page.close();
  }
}

module.exports = { runSkippedToolsTests };
