/**
 * PDF Tools — Reorder Pages Core Logic
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Reorder = {
  /**
   * Reorder pages of a PDF in a new custom sequence
   * @param {File} file
   * @param {number[]} newPageOrder - Array of 0-based page indices in the desired new order
   * @param {Function} onProgress
   */
  reorder: async function (file, newPageOrder, onProgress, options) {
    if (typeof onProgress === 'object' && onProgress !== null && !options) {
      options = onProgress;
      onProgress = null;
    }
    const { PDFDocument } = PDFLib;
    const srcDoc = await PDFTools.FileUtils.loadPdfDecrypted(file, options);

    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(srcDoc);
      } catch (e) {}
    }

    if (typeof onProgress === 'function') {
      onProgress(40, 'Arranging pages in new order...');
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, newPageOrder);
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
      copiedPages.forEach((p, idx) => innerMap.set(newPageOrder[idx], p.ref));
      const pageMap = new Map([[srcDoc, innerMap]]);
      await PdfCopy.finalize(newDoc, pageMap, { primarySource: srcDoc });
    }

    if (typeof onProgress === 'function') {
      onProgress(90, 'Saving reordered document...');
    }

    const pdfBytes = await newDoc.save({ useObjectStreams: true });

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
