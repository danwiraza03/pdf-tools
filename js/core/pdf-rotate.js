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

    const deletedPages = (options && (options.deletedPages || options.pagesToRemove)) || [];
    const deletedSet = new Set(deletedPages);

    if (deletedSet.size > 0) {
      const keepIndices = [];
      for (let i = 0; i < totalPages; i++) {
        if (!deletedSet.has(i)) {
          keepIndices.push(i);
        }
      }

      if (keepIndices.length === 0) {
        throw new Error('Cannot remove all pages. At least one page must remain.');
      }

      const { PDFDocument } = PDFLib;
      const newDoc = await PDFDocument.create();
      const copiedPages = await newDoc.copyPages(pdfDoc, keepIndices);
      copiedPages.forEach(p => newDoc.addPage(p));

      const PdfCopy = (typeof PDFTools !== 'undefined' && PDFTools.PdfCopy)
        || (typeof window !== 'undefined' && window.PDFTools && window.PDFTools.PdfCopy)
        || (typeof global !== 'undefined' && global.PDFTools && global.PDFTools.PdfCopy)
        || (function () {
          try { return require('./pdf-copy.js'); } catch (e) {
            try { return require('./js/core/pdf-copy.js'); } catch (e2) { return null; }
          }
        })();

      if (PdfCopy && typeof PdfCopy.finalize === 'function') {
        const innerMap = new Map();
        copiedPages.forEach((p, idx) => innerMap.set(keepIndices[idx], p.ref));
        const pageMap = new Map([[pdfDoc, innerMap]]);
        await PdfCopy.finalize(newDoc, pageMap, { primarySource: pdfDoc });
      }

      const pdfBytes = await newDoc.save({ useObjectStreams: true });

      if (typeof onProgress === 'function') {
        onProgress(100, 'Complete!');
      }

      return pdfBytes;
    }

    const pdfBytes = await pdfDoc.save();

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
