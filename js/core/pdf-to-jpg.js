/**
 * PDF Tools — PDF to JPG Core Logic
 * Converts PDF pages into high-resolution JPG/PNG images
 */
window.PDFTools = window.PDFTools || {};

PDFTools.PdfToJpg = {
  /**
   * Convert all pages of a PDF into JPG/PNG image objects
   * @param {File} file - PDF file
   * @param {Object} options - { quality: 'standard'|'high', format: 'jpeg'|'png' }
   * @param {Function} onProgress - Progress callback (percent, text)
   * @returns {Promise<Array<{name: string, blob: Blob, dataUrl: string, pageNum: number}>>}
   */
  convert: async function (file, options, onProgress) {
    options = options || {};
    const quality = options.quality || 'standard';
    const format = options.format || 'jpeg';
    const mimeType = format === 'png' ? 'image/png' : 'image/jpeg';
    const ext = format === 'png' ? 'png' : 'jpg';

    // Scale 1.5 ~= 108-150 DPI, Scale 2.5 ~= 200-300 DPI
    const scale = quality === 'high' ? 2.5 : 1.5;
    const jpegQuality = quality === 'high' ? 0.92 : 0.82;

    if (typeof onProgress === 'function') {
      onProgress(10, 'Loading PDF document for image extraction...');
    }

    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
      PDFTools.FileUtils.initPdfJsWorker();
    }
    let pdf;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer).slice(0) });
      pdf = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
        throw new Error('Dokumen PDF ini dilindungi kata sandi. Silakan buka kuncinya terlebih dahulu di menu Protect & Unlock.');
      }
      throw new Error('Gagal membaca PDF: Dokumen rusak atau format tidak didukung.');
    }
    const totalPages = pdf.numPages;

    const baseName = file.name.replace(/\.pdf$/i, '');
    const results = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const percent = Math.round(10 + ((pageNum / totalPages) * 85));
      if (typeof onProgress === 'function') {
        onProgress(percent, `Converting page ${pageNum} of ${totalPages} to image...`);
      }

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
      const ctx = canvas.getContext('2d', { alpha: false });

      // Always fill clean white background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport,
        annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
      }).promise;

      const dataUrl = canvas.toDataURL(mimeType, jpegQuality);

      // Convert dataURL to Blob for fast downloading / zipping
      const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, jpegQuality));

      results.push({
        name: `${baseName}_page_${pageNum}.${ext}`,
        blob: blob,
        dataUrl: dataUrl,
        pageNum: pageNum,
        width: canvas.width,
        height: canvas.height
      });

      // Free canvas memory
      if (PDFTools.FileUtils && PDFTools.FileUtils.releaseCanvas) {
        PDFTools.FileUtils.releaseCanvas(canvas);
      }
      page.cleanup();
    }

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return results;
  }
};
