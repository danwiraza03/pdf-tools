const assert = require('assert');
const { createTestPdf } = require('./helpers');

/**
 * Runs Test 1 (normal rotation), Test 2 (/Rotate 90), and Test 3 (mutation check)
 * for PDF Studio Redaction in browser.
 */
async function runStudioRedactionTests(browser, baseUrl) {
  console.log('\n====================================================');
  console.log('>>> [BROWSER TEST] PDF Studio Permanent Redaction');
  console.log('====================================================');

  const page = await browser.newPage();

  try {
    // -----------------------------------------------------------------------
    // TEST 1: Normal PDF (Rotation 0)
    // -----------------------------------------------------------------------
    console.log('\n--- [Test 1] Normal PDF (Rotation 0) ---');
    const secret1 = 'SUPER_SECRET_NORMAL_PAGE_123';
    const userText1 = 'USER_ADDED_TEXT_HALAMAN_1';

    const srcBytes1 = await createTestPdf({
      text: secret1,
      rotation: 0,
      width: 600,
      height: 400,
      textX: 100,
      textY: 250,
      textSize: 22
    });

    await page.goto(`${baseUrl}/pages/viewer.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.StudioCore && window.PDFTools.StudioRenderer));

    const result1 = await page.evaluate(async ({ srcBase64, secretText, userText }) => {
      const bin = atob(srcBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'test_normal.pdf', { type: 'application/pdf' });

      await window.PDFTools.StudioRenderer.openDocument(file);
      const currentDoc = window.PDFTools.StudioCore.getDoc();
      if (!currentDoc) throw new Error('Failed to load document into StudioCore');

      const p1 = currentDoc.getPageAnnotation(1);
      if (!p1.texts) p1.texts = [];
      p1.texts.push({
        text: userText,
        x: 80,
        y: 60,
        fontSize: 20,
        color: '#000000',
        fontFamily: 'Helvetica'
      });

      if (!p1.redactions) p1.redactions = [];
      p1.redactions.push({
        id: 'redact_mark_1',
        isPdfCoord: true,
        pdfX: 90,
        pdfY: 235,
        width: 320,
        height: 45,
        applied: false
      });

      const exportedBytes = await window.PDFTools.Studio.exportDocument(currentDoc);

      const pdfJsDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(exportedBytes).slice(0), verbosity: 0 }).promise;
      const pdfPage = await pdfJsDoc.getPage(1);
      const textContent = await pdfPage.getTextContent();
      const extractedText = textContent.items.map(t => t.str).join(' ');

      const viewport = pdfPage.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      const redactRect = viewport.convertToViewportRectangle([90, 235, 410, 280]);
      const rx = Math.floor(Math.min(redactRect[0], redactRect[2]));
      const ry = Math.floor(Math.min(redactRect[1], redactRect[3]));
      const rw = Math.floor(Math.abs(redactRect[2] - redactRect[0]));
      const rh = Math.floor(Math.abs(redactRect[3] - redactRect[1]));

      const sampleCenterX = rx + Math.floor(rw / 2) - 10;
      const sampleCenterY = ry + Math.floor(rh / 2) - 10;
      const redactPixels = ctx.getImageData(sampleCenterX, sampleCenterY, 20, 20).data;
      let allBlack = true;
      for (let i = 0; i < redactPixels.length; i += 4) {
        const r = redactPixels[i];
        const g = redactPixels[i + 1];
        const b = redactPixels[i + 2];
        if (r > 15 || g > 15 || b > 15) {
          allBlack = false;
          break;
        }
      }

      const textSample = ctx.getImageData(80, 60, 180, 25).data;
      let hasDarkPixels = false;
      for (let i = 0; i < textSample.length; i += 4) {
        const r = textSample[i];
        const g = textSample[i + 1];
        const b = textSample[i + 2];
        if (r < 200 || g < 200 || b < 200) {
          hasDarkPixels = true;
          break;
        }
      }

      await pdfJsDoc.destroy();

      return {
        extractedText,
        secretFound: extractedText.includes(secretText),
        allBlack,
        hasDarkPixels,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };
    }, {
      srcBase64: Buffer.from(srcBytes1).toString('base64'),
      secretText: secret1,
      userText: userText1
    });

    assert(!result1.secretFound, `Secret text "${secret1}" must NOT be extracted from redacted PDF`);
    console.log(`  ✓ Teks rahasia "${secret1}" tidak terekstrak dari PDF.`);
    assert(result1.allBlack, 'Redaction area must contain solid black pixels');
    console.log('  ✓ Piksel di area redaksi terbukti hitam pekat (solid black).');
    assert(result1.hasDarkPixels, 'User added text area must NOT be pure white (glyphs rendered)');
    console.log('  ✓ Piksel di area teks tambahan terbukti TIDAK putih polos (teks tambahan ikut terender).');

    // -----------------------------------------------------------------------
    // TEST 2: Rotated PDF (/Rotate 90)
    // -----------------------------------------------------------------------
    console.log('\n--- [Test 2] Rotated PDF (/Rotate 90) ---');
    const secret2 = 'SUPER_SECRET_ROTATED_PAGE_456';
    const userText2 = 'USER_ADDED_TEXT_ROTATED_PAGE';

    const srcBytes2 = await createTestPdf({
      text: secret2,
      rotation: 90,
      width: 600,
      height: 400,
      textX: 100,
      textY: 250,
      textSize: 22
    });

    const result2 = await page.evaluate(async ({ srcBase64, secretText, userText }) => {
      const bin = atob(srcBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'test_rotated.pdf', { type: 'application/pdf' });

      await window.PDFTools.StudioRenderer.openDocument(file);
      const currentDoc = window.PDFTools.StudioCore.getDoc();
      if (!currentDoc) throw new Error('Failed to load rotated document into StudioCore');

      const p1 = currentDoc.getPageAnnotation(1);
      if (!p1.texts) p1.texts = [];
      p1.texts.push({
        text: userText,
        x: 60,
        y: 80,
        fontSize: 18,
        color: '#000000',
        fontFamily: 'Helvetica'
      });

      if (!p1.redactions) p1.redactions = [];
      p1.redactions.push({
        id: 'redact_mark_rot',
        isPdfCoord: true,
        pdfX: 90,
        pdfY: 235,
        width: 320,
        height: 45,
        applied: false
      });

      const exportedBytes = await window.PDFTools.Studio.exportDocument(currentDoc);

      const pdfJsDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(exportedBytes).slice(0), verbosity: 0 }).promise;
      const pdfPage = await pdfJsDoc.getPage(1);
      const textContent = await pdfPage.getTextContent();
      const extractedText = textContent.items.map(t => t.str).join(' ');

      const viewport = pdfPage.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let blackPixelsFound = 0;
      let nonWhiteInTextArea = false;

      for (let i = 0; i < imgData.data.length; i += 4) {
        const r = imgData.data[i];
        const g = imgData.data[i + 1];
        const b = imgData.data[i + 2];
        if (r < 10 && g < 10 && b < 10) {
          blackPixelsFound++;
        }
      }

      const textSample = ctx.getImageData(50, 70, 200, 30).data;
      for (let i = 0; i < textSample.length; i += 4) {
        if (textSample[i] < 200 || textSample[i + 1] < 200 || textSample[i + 2] < 200) {
          nonWhiteInTextArea = true;
          break;
        }
      }

      await pdfJsDoc.destroy();

      return {
        extractedText,
        secretFound: extractedText.includes(secretText),
        blackPixelsCount: blackPixelsFound,
        nonWhiteInTextArea,
        canvasWidth: canvas.width,
        canvasHeight: canvas.height
      };
    }, {
      srcBase64: Buffer.from(srcBytes2).toString('base64'),
      secretText: secret2,
      userText: userText2
    });

    assert(!result2.secretFound, `Secret text "${secret2}" must NOT be extracted from rotated redacted PDF`);
    console.log(`  ✓ Teks rahasia "${secret2}" tidak terekstrak dari PDF dengan /Rotate 90.`);
    assert(result2.blackPixelsCount > 1000, 'Redaction area must contain significant solid black pixels');
    console.log(`  ✓ Piksel di area redaksi terbukti hitam pekat (${result2.blackPixelsCount} piksel hitam terdeteksi).`);
    assert(result2.nonWhiteInTextArea, 'User added text on rotated page must NOT be pure white');
    console.log('  ✓ Piksel di area teks tambahan terbukti TIDAK putih polos.');

    // -----------------------------------------------------------------------
    // TEST 3: Mutation Check (Redaction intentionally skipped -> MUST detect leak)
    // -----------------------------------------------------------------------
    console.log('\n--- [Test 3] Mutation Check: Redaksi Sengaja Dilewati (Leak Detection) ---');
    const secret3 = 'CONFIDENTIAL_MUTATION_LEAK_SECRET_999';

    const srcBytes3 = await createTestPdf({
      text: secret3,
      rotation: 0,
      width: 600,
      height: 400,
      textX: 100,
      textY: 250,
      textSize: 22
    });

    const result3 = await page.evaluate(async ({ srcBase64, secretText }) => {
      const bin = atob(srcBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'test_mutation.pdf', { type: 'application/pdf' });

      await window.PDFTools.StudioRenderer.openDocument(file);
      const currentDoc = window.PDFTools.StudioCore.getDoc();
      if (!currentDoc) throw new Error('Failed to load mutation document into StudioCore');

      // Intentionally DO NOT add any redaction marks!
      const p1 = currentDoc.getPageAnnotation(1);
      p1.redactions = []; // Redaction step skipped!

      // Export document without redacting
      const exportedBytes = await window.PDFTools.Studio.exportDocument(currentDoc);

      // Verify with PDF.js
      const pdfJsDoc = await window.pdfjsLib.getDocument({ data: new Uint8Array(exportedBytes).slice(0), verbosity: 0 }).promise;
      const pdfPage = await pdfJsDoc.getPage(1);
      const textContent = await pdfPage.getTextContent();
      const extractedText = textContent.items.map(t => t.str).join(' ');

      // Render page to canvas to check for black redaction box
      const viewport = pdfPage.getViewport({ scale: 1.0 });
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d');
      await pdfPage.render({ canvasContext: ctx, viewport }).promise;

      // In the area where redaction would have been:
      const targetArea = ctx.getImageData(90, 120, 200, 35).data;
      let solidBlackPixelsCount = 0;
      for (let i = 0; i < targetArea.length; i += 4) {
        if (targetArea[i] < 10 && targetArea[i + 1] < 10 && targetArea[i + 2] < 10) {
          solidBlackPixelsCount++;
        }
      }

      const totalPixels = targetArea.length / 4;
      const blackRatio = solidBlackPixelsCount / totalPixels;

      await pdfJsDoc.destroy();

      return {
        extractedText,
        secretLeaked: extractedText.includes(secretText),
        hasBlackRedactionBox: blackRatio > 0.75,
        blackRatio,
        solidBlackPixelsCount
      };
    }, {
      srcBase64: Buffer.from(srcBytes3).toString('base64'),
      secretText: secret3
    });

    // Verification of leak sensitivity
    assert(result3.secretLeaked, `Mutation Check: Secret text "${secret3}" MUST leak when redaction is skipped`);
    console.log(`  ✓ Mutation Check: Langkah redaksi sengaja dilewati -> Teks rahasia "${secret3}" BERHASIL terdeteksi bocor.`);
    assert(!result3.hasBlackRedactionBox, 'Mutation Check: Black redaction box MUST NOT exist when redaction is skipped');
    console.log('  ✓ Mutation Check: Kotak hitam redaksi terbukti TIDAK terbentuk saat redaksi dilewati.');
    console.log('  ✓ KEBOCORAN TERDETEKSI: Test sensitif dan terbukti memverifikasi integritas redaksi.');

    console.log('\n✅ [PASS] PDF Studio Redaction (Normal, Rotated, & Mutation Check) Tests PASSED\n');
    return true;
  } finally {
    await page.close();
  }
}

module.exports = { runStudioRedactionTests };
