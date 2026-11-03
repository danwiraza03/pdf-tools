const assert = require('assert');

/**
 * Measure Compress Effectiveness on Large Photo PDF (3 High-Res Photos 3000x2000)
 * Evaluates the 3 presets: Extreme ('high'), Recommended ('medium'), Less ('low').
 */
async function runCompressEffectivenessTest(browser, baseUrl) {
  console.log('\n====================================================');
  console.log('>>> [BROWSER TEST] Compress Effectiveness (Photo PDF)');
  console.log('====================================================');

  const page = await browser.newPage();

  try {
    console.log('Generating PDF with 3 high-resolution photos (3000x2000) and text...');
    await page.goto(`${baseUrl}/pages/compress.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.Compress && window.PDFLib && window.pdfjsLib));

    const testResults = await page.evaluate(async () => {
      const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Helper to generate a 3000x2000 photo with rich gradients & noise
      function generatePhotoDataUrl(patternType) {
        const c = document.createElement('canvas');
        c.width = 3000;
        c.height = 2000;
        const ctx = c.getContext('2d');

        if (patternType === 1) {
          const grad = ctx.createLinearGradient(0, 0, 3000, 2000);
          grad.addColorStop(0, '#e11d48');
          grad.addColorStop(0.3, '#f59e0b');
          grad.addColorStop(0.7, '#10b981');
          grad.addColorStop(1, '#3b82f6');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 3000, 2000);
        } else if (patternType === 2) {
          const grad = ctx.createRadialGradient(1500, 1000, 100, 1500, 1000, 1600);
          grad.addColorStop(0, '#8b5cf6');
          grad.addColorStop(0.5, '#06b6d4');
          grad.addColorStop(1, '#0f172a');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 3000, 2000);
        } else {
          const grad = ctx.createLinearGradient(0, 2000, 3000, 0);
          grad.addColorStop(0, '#10b981');
          grad.addColorStop(0.5, '#6366f1');
          grad.addColorStop(1, '#ec4899');
          ctx.fillStyle = grad;
          ctx.fillRect(0, 0, 3000, 2000);
        }

        // Draw multi-colored geometric noise to make it realistic photo content
        for (let i = 0; i < 250; i++) {
          ctx.fillStyle = `rgba(${(i * 17) % 256}, ${(i * 31) % 256}, ${(i * 47) % 256}, 0.65)`;
          ctx.fillRect((i * 41) % 2850, (i * 29) % 1850, 150, 120);
          ctx.beginPath();
          ctx.arc((i * 37) % 2900, (i * 53) % 1900, (i % 60) + 20, 0, Math.PI * 2);
          ctx.fill();
        }

        const dataUrl = c.toDataURL('image/jpeg', 0.90);
        c.width = 0;
        c.height = 0;
        return dataUrl;
      }

      // Add 3 separate pages with distinct 3000x2000 photos and text
      const pageTexts = [
        'Sample Document Page 1 High Resolution Photo Text',
        'Sample Document Page 2 High Resolution Photo Text',
        'Sample Document Page 3 High Resolution Photo Text'
      ];

      for (let i = 1; i <= 3; i++) {
        const dataUrl = generatePhotoDataUrl(i);
        const bin = atob(dataUrl.split(',')[1]);
        const imgBytes = new Uint8Array(bin.length);
        for (let b = 0; b < bin.length; b++) imgBytes[b] = bin.charCodeAt(b);

        const embeddedJpg = await pdfDoc.embedJpg(imgBytes);
        const p = pdfDoc.addPage([600, 400]);
        p.drawImage(embeddedJpg, { x: 0, y: 0, width: 600, height: 400 });
        p.drawText(pageTexts[i - 1], {
          x: 40,
          y: 360,
          font: font,
          size: 16,
          color: rgb(1, 1, 1)
        });
      }

      const originalBytes = await pdfDoc.save();
      const originalFile = new File([originalBytes], 'high_res_photo_doc.pdf', { type: 'application/pdf' });

      // Run the 3 presets
      const presetsToTest = [
        { id: 'high', name: 'Extreme' },
        { id: 'medium', name: 'Recommended' },
        { id: 'low', name: 'Less' }
      ];

      const reportRows = [];

      for (const preset of presetsToTest) {
        const compResult = await window.PDFTools.Compress.compress(originalFile, preset.id);

        // Verify output can be opened by PDF.js without errors
        let canOpen = false;
        let numPages = 0;
        let extractedText = '';

        try {
          const loaded = await window.pdfjsLib.getDocument({ data: compResult.bytes }).promise;
          numPages = loaded.numPages;
          canOpen = (numPages === 3);

          for (let pIdx = 1; pIdx <= numPages; pIdx++) {
            const pdfPage = await loaded.getPage(pIdx);
            const tc = await pdfPage.getTextContent();
            const pageStr = tc.items.map(it => it.str).join(' ');
            if (pageStr) {
              extractedText += (extractedText ? ' | ' : '') + pageStr.trim();
            }
          }
        } catch (openErr) {
          canOpen = false;
        }

        reportRows.push({
          preset: preset.name,
          levelId: preset.id,
          origSize: Number(originalBytes.length),
          newSize: Number(compResult.newSize || (compResult.bytes ? compResult.bytes.length : 0)),
          savedPercent: compResult.savedPercent,
          canOpen,
          numPages,
          hasExtractableText: extractedText.length > 0,
          extractedTextSummary: extractedText.length > 0
            ? `Ya ("${extractedText.substring(0, 45)}...")`
            : 'Tidak (Rasterized ke piksel JPEG)'
        });
      }

      return {
        originalSize: originalBytes.length,
        rows: reportRows
      };
    });

    // Format helper for bytes to KB / MB
    function formatBytes(bytes) {
      const b = Number(bytes) || 0;
      if (b >= 1024 * 1024) return (b / (1024 * 1024)).toFixed(2) + ' MB';
      return (b / 1024).toFixed(1) + ' KB';
    }

    console.log('\n--- TABEL PENGUKURAN EFEKTIVITAS KOMPRESI PADA PDF FOTO BESAR ---');
    console.log('-------------------------------------------------------------------------------------------------------------------');
    console.log('| Preset        | Ukuran Awal   | Ukuran Hasil  | Pengurangan (%) | Teks Terekstrak?                              |');
    console.log('-------------------------------------------------------------------------------------------------------------------');

    for (const row of testResults.rows) {
      const pName = row.preset.padEnd(13);
      const origS = formatBytes(row.origSize).padEnd(13);
      const newS = formatBytes(row.newSize).padEnd(13);
      const pct = (row.savedPercent + '%').padEnd(15);
      const txt = row.extractedTextSummary.padEnd(45);
      console.log(`| ${pName} | ${origS} | ${newS} | ${pct} | ${txt} |`);
    }
    console.log('-------------------------------------------------------------------------------------------------------------------\n');

    // Assertions:
    // Test fails ONLY if output is corrupted (cannot open) or text is lost in Less preset
    for (const r of testResults.rows) {
      assert(r.canOpen, `Output PDF for preset "${r.preset}" must open without errors in PDF.js`);
      assert(r.numPages === 3, `Output PDF for preset "${r.preset}" must preserve page count (expected 3, got ${r.numPages})`);
    }

    const lessRow = testResults.rows.find(r => r.preset === 'Less');
    assert(lessRow, 'Less preset row must exist in test results');
    assert(lessRow.hasExtractableText, 'Preset Less (Lossless Vector) must preserve extractable text on pages');

    console.log('  ✓ Ketiga preset (Extreme, Recommended, Less) menghasilkan PDF valid yang bisa dibuka di PDF.js.');
    console.log('  ✓ Preset Less terbukti mempertahankan teks vektor dokumen agar tetap bisa diekstrak.');
    console.log('  ✓ Persentase pengurangan untuk masing-masing preset berhasil diukur dan dilaporkan.');

    // =========================================================================
    // PART 2: BALANCED COMPRESSION SUITE (Downsampling without page rasterization)
    // Fixture: 5 pages (large photos, SMask transparent PNG, shared image across 2 pages, text-only page)
    // =========================================================================
    console.log('\n====================================================');
    console.log('>>> [BROWSER TEST] Balanced Mode: Image Downsampling & Text Preservation');
    console.log('====================================================');

    const balancedTestResult = await page.evaluate(async () => {
      const { PDFDocument, rgb, StandardFonts, PDFName } = window.PDFLib;
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 1. Helper to generate a large photo JPEG (1800x1200)
      function createPhotoBytes(w, h, color1, color2) {
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        const ctx = c.getContext('2d');
        const grad = ctx.createLinearGradient(0, 0, w, h);
        grad.addColorStop(0, color1);
        grad.addColorStop(1, color2);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, w, h);
        for (let i = 0; i < 150; i++) {
          ctx.fillStyle = `rgba(${(i * 23) % 256}, ${(i * 37) % 256}, ${(i * 41) % 256}, 0.7)`;
          ctx.fillRect((i * 29) % (w - 100), (i * 19) % (h - 80), 80, 60);
        }
        const dataUrl = c.toDataURL('image/jpeg', 0.92);
        const bin = atob(dataUrl.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }

      // 2. Helper to generate transparent PNG with alpha circle (600x600)
      function createTransparentPngBytes() {
        const c = document.createElement('canvas');
        c.width = 600;
        c.height = 600;
        const ctx = c.getContext('2d');
        ctx.clearRect(0, 0, 600, 600);
        ctx.fillStyle = '#ff0000';
        ctx.beginPath();
        ctx.arc(300, 300, 240, 0, Math.PI * 2);
        ctx.fill();
        const dataUrl = c.toDataURL('image/png');
        const bin = atob(dataUrl.split(',')[1]);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        return bytes;
      }

      // Page texts
      const pageTexts = [
        'Page 1 Header: First high-resolution photo with searchable text.',
        'Page 2 Header: Semi-transparent graphic with SMask overlay.',
        'Page 3 Header: First appearance of shared image in document.',
        'Page 4 Header: Second appearance of shared image in document.',
        'Page 5 Header: Pure vector text-only page without any images.'
      ];

      // Page 1: Large Photo 1 (1800x1200)
      const photo1Bytes = createPhotoBytes(1800, 1200, '#e11d48', '#3b82f6');
      const photo1 = await pdfDoc.embedJpg(photo1Bytes);
      const p1 = pdfDoc.addPage([600, 400]);
      p1.drawImage(photo1, { x: 50, y: 50, width: 400, height: 266 });
      p1.drawText(pageTexts[0], { x: 50, y: 350, font, size: 14, color: rgb(0, 0, 0) });

      // Page 2: Transparent PNG with SMask
      const smaskPngBytes = createTransparentPngBytes();
      const smaskPng = await pdfDoc.embedPng(smaskPngBytes);
      const p2 = pdfDoc.addPage([600, 400]);
      p2.drawRectangle({ x: 50, y: 50, width: 300, height: 300, color: rgb(0, 1, 0) });
      p2.drawImage(smaskPng, { x: 50, y: 50, width: 300, height: 300 });
      p2.drawText(pageTexts[1], { x: 50, y: 360, font, size: 14, color: rgb(0, 0, 0) });

      // Page 3 & 4: Shared Photo (1600x1000)
      const sharedPhotoBytes = createPhotoBytes(1600, 1000, '#10b981', '#8b5cf6');
      const sharedPhoto = await pdfDoc.embedJpg(sharedPhotoBytes);
      const p3 = pdfDoc.addPage([600, 400]);
      p3.drawImage(sharedPhoto, { x: 50, y: 50, width: 400, height: 250 });
      p3.drawText(pageTexts[2], { x: 50, y: 350, font, size: 14, color: rgb(0, 0, 0) });

      const p4 = pdfDoc.addPage([600, 400]);
      p4.drawImage(sharedPhoto, { x: 50, y: 50, width: 400, height: 250 });
      p4.drawText(pageTexts[3], { x: 50, y: 350, font, size: 14, color: rgb(0, 0, 0) });

      // Page 5: Text only (no images)
      const p5 = pdfDoc.addPage([600, 400]);
      p5.drawText(pageTexts[4], { x: 50, y: 350, font, size: 14, color: rgb(0, 0, 0) });
      p5.drawText('Additional paragraph verifying text streams remain completely untouched.', { x: 50, y: 320, font, size: 12, color: rgb(0.2, 0.2, 0.2) });

      const fixtureBytes = await pdfDoc.save();
      const fixtureFile = new File([fixtureBytes], 'balanced_compression_fixture.pdf', { type: 'application/pdf' });

      // Execute Balanced Compression
      const compResult = await window.PDFTools.Compress.compress(fixtureFile, 'balanced');

      // Verify Output with PDF.js
      const loadedDoc = await window.pdfjsLib.getDocument({ data: compResult.bytes }).promise;
      const extractedPagesText = [];

      for (let i = 1; i <= loadedDoc.numPages; i++) {
        const pageObj = await loadedDoc.getPage(i);
        const textContent = await pageObj.getTextContent();
        const str = textContent.items.map(it => it.str).join(' ').trim();
        extractedPagesText.push(str);
      }

      // Verify Pixel Transparency of Page 2 (SMask)
      const page2Obj = await loadedDoc.getPage(2);
      const vp2 = page2Obj.getViewport({ scale: 1.0 });
      const c2 = document.createElement('canvas');
      c2.width = Math.round(vp2.width);
      c2.height = Math.round(vp2.height);
      const ctx2 = c2.getContext('2d');
      await page2Obj.render({ canvasContext: ctx2, viewport: vp2 }).promise;

      const pixelOutside = ctx2.getImageData(60, 60, 1, 1).data;
      const pixelInside = ctx2.getImageData(200, 200, 1, 1).data;

      // Count unique image XObjects in compressed PDF using PDFLib
      const parsedCompDoc = await PDFDocument.load(compResult.bytes);
      const imageObjectRefs = new Set();
      for (const [ref, obj] of parsedCompDoc.context.enumerateIndirectObjects()) {
        if (obj && obj.dict && obj.getContents) {
          const subtype = obj.dict.get(PDFName.of('Subtype'));
          if (subtype && subtype.toString() === '/Image') {
            imageObjectRefs.add(ref.toString());
          }
        }
      }

      // Check Page 5 has no images in Resources
      const page5Node = parsedCompDoc.getPage(4).node;
      const page5Res = parsedCompDoc.context.lookup(page5Node.get(PDFName.of('Resources')));
      const page5XObj = page5Res && page5Res.get ? parsedCompDoc.context.lookup(page5Res.get(PDFName.of('XObject'))) : null;
      const page5HasImages = !!(page5XObj && page5XObj.size && page5XObj.size() > 0);

      // --- MUTATION CHECK ---
      let mutationCaught = false;
      try {
        const rasterStubDoc = await PDFDocument.create();
        for (let i = 1; i <= loadedDoc.numPages; i++) {
          const p = await loadedDoc.getPage(i);
          const vp = p.getViewport({ scale: 1.0 });
          const rc = document.createElement('canvas');
          rc.width = vp.width;
          rc.height = vp.height;
          const rctx = rc.getContext('2d');
          rctx.fillStyle = '#ffffff';
          rctx.fillRect(0, 0, rc.width, rc.height);
          await p.render({ canvasContext: rctx, viewport: vp }).promise;
          const rblob = await new Promise(res => rc.toBlob(res, 'image/jpeg', 0.5));
          const rBytes = new Uint8Array(await rblob.arrayBuffer());
          const rImg = await rasterStubDoc.embedJpg(rBytes);
          const rp = rasterStubDoc.addPage([vp.width, vp.height]);
          rp.drawImage(rImg, { x: 0, y: 0, width: vp.width, height: vp.height });
        }
        const rasterBytes = await rasterStubDoc.save();
        const rasterCheck = await window.pdfjsLib.getDocument({ data: rasterBytes }).promise;
        const p1Check = await rasterCheck.getPage(1);
        const p1Tc = await p1Check.getTextContent();
        const p1Str = p1Tc.items.map(it => it.str).join(' ').trim();
        if (!p1Str.includes('Page 1 Header')) {
          mutationCaught = true;
        }
      } catch (e) {
        mutationCaught = true;
      }

      return {
        originalSize: fixtureBytes.length,
        compressedSize: compResult.bytes.length,
        savedPercent: compResult.savedPercent,
        method: compResult.method,
        numPages: loadedDoc.numPages,
        pageTexts,
        extractedPagesText,
        pixelOutside: Array.from(pixelOutside),
        pixelInside: Array.from(pixelInside),
        totalImageObjects: imageObjectRefs.size,
        page5HasImages,
        mutationCaught
      };
    });

    console.log(`\n  Fixture size    : ${formatBytes(balancedTestResult.originalSize)}`);
    console.log(`  Compressed size : ${formatBytes(balancedTestResult.compressedSize)}`);
    console.log(`  Size reduction  : ${balancedTestResult.savedPercent}%`);
    console.log(`  Method reported : ${balancedTestResult.method}`);
    console.log(`  Total images in doc : ${balancedTestResult.totalImageObjects}`);

    // Assertion 1: All 5 pages have extractable text identical to original
    for (let i = 0; i < 5; i++) {
      const orig = balancedTestResult.pageTexts[i];
      const extracted = balancedTestResult.extractedPagesText[i] || '';
      console.log(`  Page ${i + 1} text match check: "${extracted.substring(0, 40)}..."`);
      assert(extracted.includes(orig.split(':')[0]), `Page ${i + 1} must preserve original text header "${orig}", got "${extracted}"`);
    }

    // Assertion 2: File size decreased
    assert(balancedTestResult.compressedSize < balancedTestResult.originalSize,
      `Balanced mode must reduce file size (got ${balancedTestResult.compressedSize} >= ${balancedTestResult.originalSize})`);

    // Assertion 3: SMask transparency is preserved
    const [rOut, gOut, bOut] = balancedTestResult.pixelOutside;
    console.log(`  SMask outside pixel (background green): rgba(${rOut}, ${gOut}, ${bOut})`);
    assert(gOut > 120 && rOut < 100, `SMask transparent region must reveal green background! Got rgb(${rOut},${gOut},${bOut})`);

    const [rIn, gIn, bIn] = balancedTestResult.pixelInside;
    console.log(`  SMask inside pixel (circle red): rgba(${rIn}, ${gIn}, ${bIn})`);
    assert(rIn > 120 && gIn < 100, `SMask circle region must render red foreground! Got rgb(${rIn},${gIn},${bIn})`);

    // Assertion 4: Page 5 (pure text) has 0 images
    assert(!balancedTestResult.page5HasImages, 'Page 5 must remain a pure vector text page with no image XObjects');

    // Assertion 5: Mutation check proved naive rasterization fails text test
    assert(balancedTestResult.mutationCaught, 'Mutation check must prove naive rasterization fails text preservation');
    console.log('  ✓ Mutation check verified: naive rasterization stub correctly failed text extraction.');

    console.log('\n✅ [PASS] Balanced Mode Compression & Text Preservation PASSED');
    console.log('\n🎉 [PASS] Compress Effectiveness on Photo PDF PASSED');
  } finally {
    await page.close();
  }
}

module.exports = {
  runCompressEffectivenessTest
};
