/**
 * PDF Tools — Rotate PDF Core Logic
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Rotate = {
  /**
   * Rotate specific or all pages of a PDF
   * @param {File} file
   * @param {Object} rotationsMap - { [pageIndex: number]: degrees (90, 180, 270) }
   * @param {Function} onProgress
   */
  rotate: async function (file, rotationsMap, onProgress, options) {
    if (typeof onProgress === 'object' && onProgress !== null && !options) {
      options = onProgress;
      onProgress = null;
    }
    const { degrees } = PDFLib;
    const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(file, options);

    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {}
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      if (typeof onProgress === 'function') {
        onProgress(Math.round(((i + 1) / totalPages) * 90), `Rotating page ${i + 1} of ${totalPages}...`);
      }

      const rotateBy = rotationsMap[i] || 0;
      if (rotateBy !== 0) {
        const page = pages[i];
        const currentRotation = page.getRotation().angle;
        const newRotation = (currentRotation + rotateBy) % 360;
        page.setRotation(degrees(newRotation));
      }
    }

    if (typeof onProgress === 'function') {
      onProgress(95, 'Saving rotated document...');
    }

    const pdfBytes = await pdfDoc.save();

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
