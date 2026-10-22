/**
 * PDF Tools — PDF to Grayscale & Black/White Core Engine
 * Converts colorful PDFs into pure grayscale or high-contrast monochrome documents
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Grayscale = {
  /**
   * Convert PDF to Grayscale / Black & White
   * @param {File} file - PDF file
   * @param {Object} options - {
   *   mode: 'grayscale'|'monochrome', // 'grayscale' (smooth) or 'monochrome' (pure black/white photocopy)
   *   threshold?: number, // 0..255 for monochrome mode (default 160)
   *   quality?: 'standard'|'high'|'print',
   *   onProgress?: Function
   * }
   * @returns {Promise<Uint8Array>}
   */
  convertToGrayscale: async function (file, options = {}) {
    const mode = options.mode || 'grayscale';
    const threshold = options.threshold || 160;
    const quality = options.quality || 'high';
    const onProgress = options.onProgress || (() => {});

    onProgress(10, 'Initializing PDF raster engine...');
    if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
      PDFTools.FileUtils.initPdfJsWorker();
    }

    let pdfJsDoc;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
      pdfJsDoc = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
        throw new Error('Dokumen PDF ini dilindungi kata sandi. Silakan buka kuncinya terlebih dahulu di menu Protect & Unlock.');
      }
      throw new Error('Gagal membaca PDF: Dokumen rusak atau format tidak didukung.');
    }
    const totalPages = pdfJsDoc.numPages;

    const { PDFDocument } = PDFLib;
    const newPdfDoc = await PDFDocument.create();

    const scale = quality === 'print' ? 3.0 : (quality === 'high' ? 2.0 : 1.5);

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pct = Math.round(15 + ((pageNum / totalPages) * 75));
      onProgress(pct, `Converting page ${pageNum} of ${totalPages} to ${mode === 'monochrome' ? 'B&W' : 'grayscale'}...`);

      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      // Apply Grayscale / Monochrome Pixel Shader
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      const len = data.length;

      if (mode === 'monochrome') {
        for (let i = 0; i < len; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = luma < threshold ? 0 : 255;
          data[i] = val;
          data[i + 1] = val;
          data[i + 2] = val;
        }
      } else {
        // Smooth Grayscale
        for (let i = 0; i < len; i += 4) {
          const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          data[i] = luma;
          data[i + 1] = luma;
          data[i + 2] = luma;
        }
      }

      ctx.putImageData(imgData, 0, 0);

      // Embed into PDF
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const imgBytes = PDFTools.FileUtils.dataUrlToUint8Array(dataUrl);
      const embeddedImg = await newPdfDoc.embedJpg(imgBytes);

      const origViewport = page.getViewport({ scale: 1.0 });
      const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });
    }

    onProgress(95, 'Finalizing grayscale PDF document...');
    const pdfBytes = await newPdfDoc.save({ useObjectStreams: true });
    onProgress(100, 'Complete!');
    return pdfBytes;
  }
};
