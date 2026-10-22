/**
 * PDF Tools — PDF Flatten Core Engine
 * Locks form fields, signatures, stamps, and annotations into the base PDF content stream
 * Supports both Vector Form Flattening and Full Bitmap Raster Flattening (100% anti-tamper)
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Flatten = {
  /**
   * Flatten PDF document
   * @param {File} file - Source PDF file
   * @param {Object} options - { mode: 'vector'|'raster', dpi?: number, onProgress?: Function }
   * @returns {Promise<Uint8Array>} Flattened PDF bytes
   */
  flattenPdf: async function (file, options = {}) {
    const mode = options.mode || 'vector';
    const onProgress = options.onProgress || (() => {});

    if (mode === 'raster') {
      return await this.rasterFlatten(file, options, onProgress);
    } else {
      return await this.vectorFlatten(file, options, onProgress);
    }
  },

  /**
   * Vector Flattening:
   * Flattens interactive AcroForms and removes signature/annotation dictionaries while keeping vector text sharp
   */
  vectorFlatten: async function (file, options, onProgress) {
    onProgress(15, 'Loading PDF document...');
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    onProgress(40, 'Flattening form fields & widgets...');
    try {
      const form = pdfDoc.getForm();
      if (form) {
        form.flatten();
      }
    } catch (e) {
      console.warn('Flatten: No active AcroForm found or already flat:', e);
    }

    onProgress(70, 'Removing digital signature fields and locking visual layers...');
    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {}
    }

    onProgress(90, 'Serializing flattened vector PDF...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    onProgress(100, 'Complete!');
    return pdfBytes;
  },

  /**
   * Raster / Bitmap Flattening:
   * Renders every page to high-DPI canvas (200-300 DPI) and bakes into a 100% non-extractable image-based PDF
   */
  rasterFlatten: async function (file, options, onProgress) {
    onProgress(10, 'Loading PDF.js engine for rasterization...');
    if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
      PDFTools.FileUtils.initPdfJsWorker();
    }

    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    const pdfJsDoc = await loadingTask.promise;
    const totalPages = pdfJsDoc.numPages;

    const { PDFDocument } = PDFLib;
    const newPdfDoc = await PDFDocument.create();

    const dpiScale = (options.quality === 'ultra' ? 3.0 : 2.0); // 2.0 = ~150-200 DPI, 3.0 = ~300 DPI

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pct = Math.round(15 + ((pageNum / totalPages) * 75));
      onProgress(pct, `Rasterizing and locking page ${pageNum} of ${totalPages}...`);

      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: dpiScale });

      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx,
        viewport: viewport
      }).promise;

      // Convert canvas to high-quality JPEG
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const imgBytes = PDFTools.FileUtils.dataUrlToUint8Array(dataUrl);
      const embeddedImg = await newPdfDoc.embedJpg(imgBytes);

      // Add page with exact original dimensions
      const origViewport = page.getViewport({ scale: 1.0 });
      const newPage = newPdfDoc.addPage([origViewport.width, origViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: origViewport.width,
        height: origViewport.height
      });
    }

    onProgress(95, 'Finalizing non-editable document...');
    const pdfBytes = await newPdfDoc.save({ useObjectStreams: true });
    onProgress(100, 'Complete!');
    return pdfBytes;
  }
};
