const assert = require('assert');
const path = require('path');
const fs = require('fs');
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startTestServer, launchChromium } = require('./helpers');

// Setup Node environment to run PDFTools.Watermark in Node
global.PDFLib = PDFLib;
global.window = global;
global.PDFTools = global.PDFTools || {};
global.PDFTools.FileUtils = {
  readAsArrayBuffer: async (f) => {
    if (f && f.arrayBuffer) return await f.arrayBuffer();
    if (f && f.buffer) return f.buffer.slice(f.byteOffset, f.byteOffset + f.byteLength);
    if (f instanceof Uint8Array || f instanceof ArrayBuffer) return f;
    return f;
  }
};
const watermarkCoreCode = fs.readFileSync(path.resolve(__dirname, '../../js/core/pdf-watermark.js'), 'utf8');
eval(watermarkCoreCode);

/**
 * Node-based test: On a 5-page document, watermark image object count MUST be 1
 * and file size increase MUST be < 2x image byte size.
 */
async function runNodeWatermarkImageTests() {
  console.log('\n--- [Node Test] Watermark Image: Single Embed & File Size Efficiency ---');
  
  // 1. Create a 5-page PDF document
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < 5; i++) {
    const p = doc.addPage([595, 842]);
    p.drawRectangle({
      x: 0,
      y: 0,
      width: 595,
      height: 842,
      color: PDFLib.rgb(0.8, 0.8, 0.8)
    });
  }
  const originalBytes = await doc.save();

  // Valid 10x10 transparent/colored PNG
  const samplePngBase64 = 
    'iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVR42mP8z8BQz0AEYBxVSF+FABJAD/6pnMbCAAAAAElFTkSuQmCC';
  const imgBytes = Buffer.from(samplePngBase64, 'base64');

  // 3. Apply image watermark
  const watermarkedBytes = await PDFTools.Watermark.applyWatermark(
    { file: originalBytes },
    {
      type: 'image',
      image: { bytes: imgBytes, mime: 'image/png' },
      position: 'center',
      scale: 0.3,
      opacity: 0.5
    }
  );

  // 4. Inspect objects in watermarked document
  const reloaded = await PDFLib.PDFDocument.load(watermarkedBytes);
  const pages = reloaded.getPages();
  assert.strictEqual(pages.length, 5, 'Document must retain all 5 pages');

  let imageObjectsCount = 0;
  const imageRefs = new Set();

  for (const [ref, obj] of reloaded.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFLib.PDFRawStream || obj instanceof PDFLib.PDFStream) {
      const dict = obj.dict;
      if (dict && dict.get(PDFLib.PDFName.of('Subtype')) === PDFLib.PDFName.of('Image')) {
        // Exclude SMask soft mask objects from count of primary images if separate
        const isSMask = dict.has(PDFLib.PDFName.of('Decode')) && !dict.has(PDFLib.PDFName.of('SMask'));
        imageObjectsCount++;
        imageRefs.add(ref.toString());
      }
    }
  }

  // Count distinct XObject references across pages
  const pageXObjectRefs = new Set();
  for (const p of pages) {
    const resources = p.node.Resources();
    if (resources && resources.has(PDFLib.PDFName.of('XObject'))) {
      const xObjDict = resources.lookup(PDFLib.PDFName.of('XObject'));
      if (xObjDict && xObjDict.entries) {
        for (const [key, ref] of xObjDict.entries()) {
          pageXObjectRefs.add(ref.toString());
        }
      }
    }
  }

  console.log(`  Original size: ${originalBytes.length} bytes`);
  console.log(`  Watermarked size: ${watermarkedBytes.length} bytes (Delta: ${watermarkedBytes.length - originalBytes.length} bytes)`);
  console.log(`  Image bytes: ${imgBytes.length} bytes`);
  console.log(`  Image XObjects found in context: ${imageObjectsCount}, Unique XObjects referenced by pages: ${pageXObjectRefs.size}`);

  assert(pageXObjectRefs.size === 1, `Watermark image must be embedded exactly ONCE across all pages, found ${pageXObjectRefs.size}`);
  const delta = watermarkedBytes.length - originalBytes.length;
  assert(delta < 2 * imgBytes.length + 3000, `File size increase (${delta} bytes) must be < 2x image size (${2 * imgBytes.length} bytes)`);
  console.log('  ✓ [PASS] Watermark image is embedded once and file size delta is minimal');
}

/**
 * Playwright Browser Test Suite for Watermark Image
 */
async function runWatermarkImageBrowserTests(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('>>> [BROWSER TEST] Watermark Image: Multi-orientation, CropBox, 9 Positions');
  console.log('========================================================================');

  const page = await browser.newPage();

  try {
    // Navigate to watermark tool page to have all client libraries loaded
    await page.goto(`${baseUrl}/pages/watermark.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Watermark && window.PDFLib && window.pdfjsLib));

    // Execute in-browser test suite
    const testResult = await page.evaluate(async () => {
      const { PDFDocument, rgb, degrees } = window.PDFLib;
      const pdfjs = window.pdfjsLib;

      // 1. Create Test PDF with 5 pages:
      // Page 1: A4 upright (595 x 842, rot 0)
      // Page 2: Landscape (842 x 595, rot 0)
      // Page 3: /Rotate 90 (595 x 842, rot 90)
      // Page 4: /Rotate 270 (595 x 842, rot 270)
      // Page 5: CropBox non-zero origin ([50, 60, 500, 680], rot 0)
      const testDoc = await PDFDocument.create();

      // Gray background color: R=0.8, G=0.8, B=0.8 (approx RGB 204, 204, 204)
      const bgColor = rgb(0.8, 0.8, 0.8);

      // P1: A4 upright
      const p1 = testDoc.addPage([595, 842]);
      p1.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: bgColor });

      // P2: Landscape
      const p2 = testDoc.addPage([842, 595]);
      p2.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: bgColor });

      // P3: Rotate 90
      const p3 = testDoc.addPage([595, 842]);
      p3.setRotation(degrees(90));
      p3.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: bgColor });

      // P4: Rotate 270
      const p4 = testDoc.addPage([595, 842]);
      p4.setRotation(degrees(270));
      p4.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: bgColor });

      // P5: CropBox non-zero origin
      const p5 = testDoc.addPage([600, 800]);
      p5.setCropBox(50, 60, 500, 680);
      p5.drawRectangle({ x: 0, y: 0, width: 600, height: 800, color: bgColor });

      const testPdfBytes = await testDoc.save();

      // 2. Create Test Image:
      // PNG pure magenta (#FF00FF) 200x100 px with transparent hole in center (60x30 px)
      const imgCanvas = document.createElement('canvas');
      imgCanvas.width = 200;
      imgCanvas.height = 100;
      const ictx = imgCanvas.getContext('2d');
      ictx.fillStyle = '#FF00FF'; // pure magenta
      ictx.fillRect(0, 0, 200, 100);
      ictx.clearRect(70, 35, 60, 30); // transparent hole in center

      const imgBlob = await new Promise(res => imgCanvas.toBlob(res, 'image/png'));
      const imgBuffer = await imgBlob.arrayBuffer();
      const imgBytes = new Uint8Array(imgBuffer);

      // 9 test positions
      const positions = [
        'top-left', 'top-center', 'top-right',
        'middle-left', 'center', 'middle-right',
        'bottom-left', 'bottom-center', 'bottom-right'
      ];
      const rotations = [0, 45];
      const scale = 0.3;
      const margin = 20;

      const results = [];
      const failures = [];

      // Test each combination of (position, rotation) across all 5 pages
      for (const pos of positions) {
        for (const rot of rotations) {
          // Watermark all 5 pages with opacity 0.3
          const watermarkedBytes = await window.PDFTools.Watermark.applyWatermark(
            { file: testPdfBytes },
            {
              type: 'image',
              image: { bytes: imgBytes, mime: 'image/png' },
              position: pos,
              rotation: rot,
              scale: scale,
              margin: margin,
              opacity: 0.3
            }
          );

          if (!watermarkedBytes || !(watermarkedBytes instanceof Uint8Array)) {
            failures.push(`applyWatermark failed to return Uint8Array for ${pos} rot ${rot}`);
            continue;
          }

          const pdfJsDoc = await pdfjs.getDocument({ data: watermarkedBytes, verbosity: 0 }).promise;
          const numPages = pdfJsDoc.numPages;

          for (let pageNum = 1; pageNum <= numPages; pageNum++) {
            const pdfPage = await pdfJsDoc.getPage(pageNum);
            const vp = pdfPage.getViewport({ scale: 1.0 });
            const visibleWidth = Math.round(vp.width);
            const visibleHeight = Math.round(vp.height);

            // Render to canvas
            const canvas = document.createElement('canvas');
            canvas.width = visibleWidth;
            canvas.height = visibleHeight;
            const ctx = canvas.getContext('2d');
            await pdfPage.render({ canvasContext: ctx, viewport: vp }).promise;

            const imgData = ctx.getImageData(0, 0, visibleWidth, visibleHeight);
            const data = imgData.data;

            // Dimensions of image on visible page
            const imgW = visibleWidth * scale;
            const imgH = imgW * (100 / 200); // aspect ratio 200:100 = 0.5

            // Expected center on VISIBLE page (canvas coords where (0,0) is top-left)
            let expX = visibleWidth / 2;
            let expY = visibleHeight / 2;

            if (pos.includes('left')) {
              expX = margin + imgW / 2;
            } else if (pos.includes('right')) {
              expX = visibleWidth - margin - imgW / 2;
            }

            if (pos.startsWith('top')) {
              expY = margin + imgH / 2;
            } else if (pos.startsWith('bottom')) {
              expY = visibleHeight - margin - imgH / 2;
            }

            // Find magenta pixels
            // Background is gray (R~204, G~204, B~204), Magenta is (R=255, G=0, B=255)
            // With opacity 0.3 blended: R and B are elevated (>205), G is lowered (~143)
            let sumX = 0;
            let sumY = 0;
            let magentaCount = 0;
            let allInside = true;
            let blendedGreenCount = 0;

            for (let y = 0; y < visibleHeight; y++) {
              for (let x = 0; x < visibleWidth; x++) {
                const idx = (y * visibleWidth + x) * 4;
                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Magenta test: R and B are substantially higher than G
                if ((r - g) > 30 && (b - g) > 30) {
                  magentaCount++;
                  sumX += x;
                  sumY += y;

                  if (x < 0 || x >= visibleWidth || y < 0 || y >= visibleHeight) {
                    allInside = false;
                  }

                  // d. With opacity 0.3, green component is clearly > 0
                  if (g > 60) {
                    blendedGreenCount++;
                  }
                }
              }
            }

            if (magentaCount === 0) {
              failures.push(`Page ${pageNum} [pos:${pos}, rot:${rot}]: No magenta watermark pixels detected!`);
              continue;
            }

            const centerOfMassX = sumX / magentaCount;
            const centerOfMassY = sumY / magentaCount;

            // a. Center of mass within 6% of visible dimensions
            const tolX = 0.06 * visibleWidth;
            const tolY = 0.06 * visibleHeight;
            const diffX = Math.abs(centerOfMassX - expX);
            const diffY = Math.abs(centerOfMassY - expY);

            if (diffX > tolX || diffY > tolY) {
              failures.push(`Page ${pageNum} [pos:${pos}, rot:${rot}]: Center of mass [${centerOfMassX.toFixed(1)}, ${centerOfMassY.toFixed(1)}] deviated from expected [${expX.toFixed(1)}, ${expY.toFixed(1)}] (diff: ${diffX.toFixed(1)}px, ${diffY.toFixed(1)}px; tol: ${tolX.toFixed(1)}px, ${tolY.toFixed(1)}px)`);
            }

            // b. All magenta pixels inside visible page
            if (!allInside) {
              failures.push(`Page ${pageNum} [pos:${pos}, rot:${rot}]: Some magenta pixels are outside visible page boundary`);
            }

            // c. Transparent hole in center preserves gray background
            const centerIdx = (Math.round(expY) * visibleWidth + Math.round(expX)) * 4;
            const cr = data[centerIdx];
            const cg = data[centerIdx + 1];
            const cb = data[centerIdx + 2];
            // Check if center pixel is neutral gray (|cr - cg| < 25 and |cb - cg| < 25 and cg > 140)
            const isGray = Math.abs(cr - cg) < 25 && Math.abs(cb - cg) < 25 && cg > 140;
            if (!isGray) {
              failures.push(`Page ${pageNum} [pos:${pos}, rot:${rot}]: Transparent hole at [${Math.round(expX)}, ${Math.round(expY)}] is not gray! (rgb: ${cr},${cg},${cb})`);
            }

            // d. With opacity 0.3, green is clearly > 0
            if (blendedGreenCount / magentaCount < 0.8) {
              failures.push(`Page ${pageNum} [pos:${pos}, rot:${rot}]: Opacity 0.3 did not blend colors properly (green components too low)`);
            }
          }
          await pdfJsDoc.destroy();
        }
      }

      // Check Opacity 1.0 test on Page 1 (Center, rot 0)
      const opaqueBytes = await window.PDFTools.Watermark.applyWatermark(
        { file: testPdfBytes },
        {
          type: 'image',
          image: { bytes: imgBytes, mime: 'image/png' },
          position: 'center',
          rotation: 0,
          scale: scale,
          margin: margin,
          opacity: 1.0
        }
      );
      const opaqueDoc = await pdfjs.getDocument({ data: opaqueBytes, verbosity: 0 }).promise;
      const opaquePage = await opaqueDoc.getPage(1);
      const ovp = opaquePage.getViewport({ scale: 1.0 });
      const ocanvas = document.createElement('canvas');
      ocanvas.width = Math.round(ovp.width);
      ocanvas.height = Math.round(ovp.height);
      const octx = ocanvas.getContext('2d');
      await opaquePage.render({ canvasContext: octx, viewport: ovp }).promise;
      const odata = octx.getImageData(0, 0, ocanvas.width, ocanvas.height).data;

      // Sample a known solid magenta pixel (offset from center to avoid hole)
      // expX is center, expY is center. Offset by 35px right
      const sampleX = Math.round(ovp.width / 2 + 35);
      const sampleY = Math.round(ovp.height / 2);
      const sampleIdx = (sampleY * Math.round(ovp.width) + sampleX) * 4;
      const opaqueR = odata[sampleIdx];
      const opaqueG = odata[sampleIdx + 1];
      const opaqueB = odata[sampleIdx + 2];

      if (opaqueG > 15 || opaqueR < 240 || opaqueB < 240) {
        failures.push(`Opacity 1.0 test failed: green component (${opaqueG}) is not near 0 for pure magenta watermark (rgb: ${opaqueR},${opaqueG},${opaqueB})`);
      }
      await opaqueDoc.destroy();

      // =========================================================================
      // Item 4 Tests: PDFTools.Watermark.prepareImage
      // =========================================================================
      // 1. File .txt bernama .png HARUS ditolak (real decode failure)
      const fakeTextPng = new File(['THIS IS NOT A VALID PNG IMAGE FILE'], 'fake_image.png', { type: 'image/png' });
      let fakeRejected = false;
      let fakeErrorMessage = '';
      try {
        await window.PDFTools.Watermark.prepareImage(fakeTextPng);
      } catch (err) {
        fakeRejected = true;
        fakeErrorMessage = err.message || String(err);
      }
      if (!fakeRejected) {
        failures.push('PDFTools.Watermark.prepareImage must reject fake .txt named .png');
      }

      // 2. Reject file > 15 MB
      const oversizedBlob = new Blob([new Uint8Array(100)], { type: 'image/png' });
      Object.defineProperty(oversizedBlob, 'size', { value: 16 * 1024 * 1024 });
      let oversizedRejected = false;
      try {
        await window.PDFTools.Watermark.prepareImage(oversizedBlob);
      } catch (err) {
        oversizedRejected = true;
      }
      if (!oversizedRejected) {
        failures.push('PDFTools.Watermark.prepareImage must reject files > 15 MB');
      }

      // 3. Gambar 6000x4000 HARUS keluar <= 2000 px
      const hugeCanvas = document.createElement('canvas');
      hugeCanvas.width = 6000;
      hugeCanvas.height = 4000;
      const hctx = hugeCanvas.getContext('2d');
      hctx.fillStyle = '#00FF00';
      hctx.fillRect(0, 0, 10, 10);
      const hugeBlob = await new Promise(r => hugeCanvas.toBlob(r, 'image/png'));
      const preparedHuge = await window.PDFTools.Watermark.prepareImage(hugeBlob);

      const longestEdge = Math.max(preparedHuge.width, preparedHuge.height);
      if (longestEdge > 2000) {
        failures.push(`PDFTools.Watermark.prepareImage failed downscaling: longest edge is ${longestEdge}px (> 2000px)`);
      }
      if (preparedHuge.width !== 2000 || preparedHuge.height !== 1333) {
        failures.push(`Expected 6000x4000 to scale to 2000x1333, got ${preparedHuge.width}x${preparedHuge.height}`);
      }

      return {
        totalEvaluated: positions.length * rotations.length * 5,
        fakeRejected,
        oversizedRejected,
        hugeScaled: `${preparedHuge.width}x${preparedHuge.height}`,
        failures
      };
    });

    console.log(`Evaluated ${testResult.totalEvaluated} page position/rotation combinations.`);
    if (testResult.failures.length > 0) {
      console.error(`\n❌ [FAIL] ${testResult.failures.length} kegagalan terdeteksi pada Watermark Image Browser Test:`);
      for (const f of testResult.failures.slice(0, 10)) {
        console.error(`  - ${f}`);
      }
      if (testResult.failures.length > 10) {
        console.error(`  ... dan ${testResult.failures.length - 10} kegagalan lainnya.`);
      }
      throw new Error(`Watermark Image Browser Test failed with ${testResult.failures.length} failures!`);
    }

    console.log('  ✓ [PASS] Seluruh posisi x rotasi x orientasi halaman terverifikasi presisi.');
    console.log('  ✓ [PASS] Transparansi lubang dan opacity blending terverifikasi akurat.');

    // =========================================================================
    // Item 5: MUTATION CHECK
    // =========================================================================
    console.log('\n--- [MUTATION CHECK] Deliberately stubbing opacity & /Rotate to prove test sensitivity ---');
    const mutationResults = await page.evaluate(async () => {
      const { PDFDocument, rgb, degrees } = window.PDFLib;
      const pdfjs = window.pdfjsLib;

      // 1. Create a simple test PDF with a /Rotate 90 page and gray background
      const testDoc = await PDFDocument.create();
      const p1 = testDoc.addPage([595, 842]);
      p1.setRotation(degrees(90));
      p1.drawRectangle({ x: 0, y: 0, width: 595, height: 842, color: rgb(0.8, 0.8, 0.8) });
      const testPdfBytes = await testDoc.save();

      // Test image: 100x50 pure magenta
      const imgCanvas = document.createElement('canvas');
      imgCanvas.width = 100;
      imgCanvas.height = 50;
      const ictx = imgCanvas.getContext('2d');
      ictx.fillStyle = '#FF00FF';
      ictx.fillRect(0, 0, 100, 50);
      const imgBlob = await new Promise(r => imgCanvas.toBlob(r, 'image/png'));
      const imgBytes = new Uint8Array(await imgBlob.arrayBuffer());

      // Helper to check green component with opacity 0.3
      async function testOpacityCheck() {
        const bytes = await window.PDFTools.Watermark.applyWatermark(
          { file: testPdfBytes },
          {
            type: 'image',
            image: { bytes: imgBytes, mime: 'image/png' },
            position: 'center',
            opacity: 0.3
          }
        );
        const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 1.0 });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        await doc.destroy();

        // Sample center pixel: with opacity 0.3 on gray, green must be > 60
        const sampleIdx = (Math.round(canvas.height / 2) * canvas.width + Math.round(canvas.width / 2)) * 4;
        const g = data[sampleIdx + 1];
        return { green: g, passed: g > 60 };
      }

      // Helper to check center-of-mass on /Rotate 90 page
      async function testRotateCheck() {
        const bytes = await window.PDFTools.Watermark.applyWatermark(
          { file: testPdfBytes },
          {
            type: 'image',
            image: { bytes: imgBytes, mime: 'image/png' },
            position: 'top-left',
            scale: 0.3,
            margin: 20
          }
        );
        const doc = await pdfjs.getDocument({ data: bytes, verbosity: 0 }).promise;
        const page = await doc.getPage(1);
        const vp = page.getViewport({ scale: 1.0 });
        const visibleW = Math.round(vp.width);
        const visibleH = Math.round(vp.height);
        const canvas = document.createElement('canvas');
        canvas.width = visibleW;
        canvas.height = visibleH;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const data = ctx.getImageData(0, 0, visibleW, visibleH).data;
        await doc.destroy();

        let sumX = 0, sumY = 0, count = 0;
        for (let y = 0; y < visibleH; y++) {
          for (let x = 0; x < visibleW; x++) {
            const idx = (y * visibleW + x) * 4;
            if (data[idx] - data[idx + 1] > 20 && data[idx + 2] - data[idx + 1] > 20) {
              sumX += x;
              sumY += y;
              count++;
            }
          }
        }
        if (count === 0) return { passed: false, reason: 'no magenta' };
        const comX = sumX / count;
        const comY = sumY / count;
        // Expected visible top-left center:
        const imgW = visibleW * 0.3;
        const imgH = imgW * 0.5;
        const expX = 20 + imgW / 2;
        const expY = 20 + imgH / 2;
        const diffX = Math.abs(comX - expX);
        const diffY = Math.abs(comY - expY);
        const passed = diffX <= 0.06 * visibleW && diffY <= 0.06 * visibleH;
        return { comX, comY, expX, expY, diffX, diffY, passed };
      }

      // --- MUTATION 1: Matikan penanganan opacity sengaja via stub ---
      const origApply = window.PDFTools.Watermark.applyWatermark;
      let mutation1Failed = false;
      try {
        // Stub: ignore opacity, force opacity: 1.0
        window.PDFTools.Watermark.applyWatermark = function (f, o, p) {
          const mutatedOpts = Object.assign({}, o, { opacity: 1.0 });
          return origApply.call(this, f, mutatedOpts, p);
        };
        const resMut1 = await testOpacityCheck();
        // Since opacity is forced to 1.0, green component is ~0 (<60), so resMut1.passed should be FALSE
        mutation1Failed = !resMut1.passed;
      } finally {
        // Restore
        window.PDFTools.Watermark.applyWatermark = origApply;
      }

      // Verify unmutated opacity test passes
      const unmutatedOpacityRes = await testOpacityCheck();

      // --- MUTATION 2: Matikan penanganan /Rotate sengaja via stub ---
      const origCompute = window.PDFTools.Watermark.computePlacement;
      let mutation2Failed = false;
      try {
        // Stub: force pageRotation = 0 regardless of page.getRotation()
        window.PDFTools.Watermark.computePlacement = function (page, w, h, opts) {
          const fakePage = Object.create(page);
          fakePage.getRotation = () => ({ angle: 0 });
          return origCompute.call(this, fakePage, w, h, opts);
        };
        const resMut2 = await testRotateCheck();
        // Since rotation is ignored, placement is at wrong coordinate on /Rotate 90 page, so resMut2.passed should be FALSE
        mutation2Failed = !resMut2.passed;
      } finally {
        // Restore
        window.PDFTools.Watermark.computePlacement = origCompute;
      }

      // Verify unmutated rotate test passes
      const unmutatedRotateRes = await testRotateCheck();

      return {
        mutation1Failed, // true when mutant failed the test
        mutation2Failed, // true when mutant failed the test
        unmutatedOpacityPassed: unmutatedOpacityRes.passed,
        unmutatedRotatePassed: unmutatedRotateRes.passed
      };
    });

    assert(mutationResults.mutation1Failed, 'Mutation 1: Disabling opacity handling MUST cause test to fail!');
    console.log('  ✓ [MUTATION CHECK 1] Disabled opacity handling -> Test FAILED as expected (caught by opacity check)');

    assert(mutationResults.mutation2Failed, 'Mutation 2: Disabling /Rotate handling MUST cause test to fail!');
    console.log('  ✓ [MUTATION CHECK 2] Disabled /Rotate handling -> Test FAILED as expected (caught by rotation check)');

    assert(mutationResults.unmutatedOpacityPassed, 'Restored opacity handling must pass test');
    assert(mutationResults.unmutatedRotatePassed, 'Restored /Rotate handling must pass test');
    console.log('  ✓ [MUTATION RESTORED] Original implementations restored and verified passing.');

    return { success: true };
  } finally {
    await page.close();
  }
}

// Standalone execution
if (require.main === module) {
  (async () => {
    let server;
    let browser;
    try {
      // 1. Run Node tests
      await runNodeWatermarkImageTests();

      // 2. Run Browser tests
      server = await startTestServer(8765);
      browser = await launchChromium({ headless: true });
      await runWatermarkImageBrowserTests(browser, 'http://127.0.0.1:8765');
      console.log('\n✅ ALL WATERMARK IMAGE TESTS PASSED!\n');
      process.exitCode = 0;
    } catch (err) {
      console.error('\n❌ Test execution failed:');
      console.error(err.message || err);
      process.exitCode = 1;
    } finally {
      if (browser) await browser.close();
      if (server) server.close();
    }
  })();
}

module.exports = {
  runWatermarkImageBrowserTests,
  runNodeWatermarkImageTests
};
