/**
 * PDF Tools — Remove Pages Core Logic
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Remove = {
  /**
   * Remove specified pages from a PDF
   * @param {File} file
   * @param {number[]} pagesToRemove - Array of 0-based page indices to remove
   * @param {Function} onProgress
   */
  removePages: async function (file, pagesToRemove, onProgress, options) {
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

    const totalPages = srcDoc.getPageCount();

    const removeSet = new Set(pagesToRemove);
    const keepIndices = [];

    for (let i = 0; i < totalPages; i++) {
      if (!removeSet.has(i)) {
        keepIndices.push(i);
      }
    }

    if (keepIndices.length === 0) {
      throw new Error('Cannot remove all pages. At least one page must remain.');
    }

    if (typeof onProgress === 'function') {
      onProgress(40, 'Rebuilding document without removed pages...');
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
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
      const pageMap = new Map([[srcDoc, innerMap]]);
      await PdfCopy.finalize(newDoc, pageMap, { primarySource: srcDoc });
    }

    if (typeof onProgress === 'function') {
      onProgress(90, 'Saving document...');
    }

    const pdfBytes = await newDoc.save({ useObjectStreams: true });

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return {
      bytes: pdfBytes,
      remainingPages: keepIndices.length,
      removedPagesCount: pagesToRemove.length
    };
  }
};
