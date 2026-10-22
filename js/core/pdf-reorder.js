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
  reorder: async function (file, newPageOrder, onProgress) {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

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

    if (typeof onProgress === 'function') {
      onProgress(90, 'Saving reordered document...');
    }

    const pdfBytes = await newDoc.save();

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
