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
  removePages: async function (file, pagesToRemove, onProgress) {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

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

    if (typeof onProgress === 'function') {
      onProgress(90, 'Saving document...');
    }

    const pdfBytes = await newDoc.save();

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
