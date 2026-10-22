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
    console.log('\n✅ [PASS] Compress Effectiveness on Photo PDF PASSED');
  } finally {
    await page.close();
  }
}

module.exports = {
  runCompressEffectivenessTest
};
