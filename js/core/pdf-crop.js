/**
 * PDF Tools — PDF Crop & Margin Trimmer Core Engine
 * Visually crop page margins and trim whitespace
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Crop = {
  /**
   * Crop pages of a PDF document
   * @param {File} file - PDF file
   * @param {Object} options - {
   *   mode: 'all'|'custom',
   *   cropBox: { x: number, y: number, width: number, height: number }, // In normalized 0..1 percentage coordinates or pt
   *   pageCrops?: { [pageNum: number]: { x: number, y: number, width: number, height: number } },
   *   onProgress?: Function
   * }
   * @returns {Promise<Uint8Array>}
   */
  cropPdf: async function (file, options = {}) {
    const onProgress = options.onProgress || (() => {});
    onProgress(15, 'Loading PDF document for cropping...');

    const { PDFDocument } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {}
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    onProgress(40, 'Applying crop dimensions to pages...');

    for (let i = 0; i < totalPages; i++) {
      const pageNum = i + 1;
      const page = pages[i];
      const { width: origWidth, height: origHeight } = page.getSize();

      let crop = options.cropBox;
      if (options.pageCrops && options.pageCrops[pageNum]) {
        crop = options.pageCrops[pageNum];
      }

      if (crop) {
        // Support normalized percentages (0..1) or point dimensions or custom cut margins
        let cropX = crop.normalized ? crop.x * origWidth : crop.x;
        let cropY = crop.normalized ? crop.y * origHeight : crop.y;
        let cropW = crop.normalized ? crop.width * origWidth : crop.width;
        let cropH = crop.normalized ? crop.height * origHeight : crop.height;

        if (crop.customCut) {
          cropX = crop.customCut.lr;
          cropY = crop.customCut.tb;
          cropW = Math.max(origWidth - (crop.customCut.lr * 2), 50);
          cropH = Math.max(origHeight - (crop.customCut.tb * 2), 50);
        }

        // PDF coordinate system starts at lower-left corner (0,0)
        // If crop was defined from top-left (screen coordinates):
        const pdfX = cropX;
        const pdfY = crop.fromTopLeft ? (origHeight - (cropY + cropH)) : cropY;

        // Apply CropBox and MediaBox
        page.setCropBox(pdfX, pdfY, cropW, cropH);
        page.setMediaBox(pdfX, pdfY, cropW, cropH);
      }
    }

    onProgress(85, 'Saving cropped document...');
    const pdfBytes = await pdfDoc.save({ useObjectStreams: true });
    onProgress(100, 'Complete!');
    return pdfBytes;
  },

  /**
   * Auto-detect whitespace borders from a canvas rendering
   * @param {HTMLCanvasElement} canvas 
   * @param {number} threshold - Color threshold for white (0..255, default 245)
   * @returns {{ top: number, bottom: number, left: number, right: number, x: number, y: number, width: number, height: number }} Normalized 0..1 box
   */
  autoDetectWhitespace: function (canvas, threshold = 245) {
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;

    let minX = width;
    let minY = height;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];
        const a = data[idx + 3];

        // If pixel is not transparent and not white
        if (a > 30 && (r < threshold || g < threshold || b < threshold)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    // Add safe padding (10px)
    const pad = 12;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(width, maxX + pad);
    maxY = Math.min(height, maxY + pad);

    const cropW = Math.max(50, maxX - minX);
    const cropH = Math.max(50, maxY - minY);

    return {
      normalized: true,
      fromTopLeft: true,
      x: minX / width,
      y: minY / height,
      width: cropW / width,
      height: cropH / height
    };
  }
};
