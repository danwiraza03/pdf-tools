/**
 * PDF Tools — Split PDF Core Logic
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Split = {
  /**
   * Parse range string like "1-3, 5, 7-10" into 0-indexed page numbers
   */
  parseRange: function (rangeStr, maxPages) {
    const pages = new Set();
    const parts = rangeStr.split(',');

    for (let part of parts) {
      part = part.trim();
      if (!part) continue;

      if (part.includes('-')) {
        const [start, end] = part.split('-').map(n => parseInt(n.trim(), 10));
        if (!isNaN(start) && !isNaN(end)) {
          const min = Math.max(1, Math.min(start, end));
          const max = Math.min(maxPages, Math.max(start, end));
          for (let i = min; i <= max; i++) {
            pages.add(i - 1);
          }
        }
      } else {
        const num = parseInt(part, 10);
        if (!isNaN(num) && num >= 1 && num <= maxPages) {
          pages.add(num - 1);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  },

  _loadDoc: async function (file) {
    const { PDFDocument } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(srcDoc);
      } catch (e) {}
    }
    return srcDoc;
  },

  /**
   * Extract selected pages into a single new PDF document
   */
  extractPages: async function (file, pageIndices, onProgress) {
    const { PDFDocument } = PDFLib;
    const srcDoc = await this._loadDoc(file);

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => newDoc.addPage(p));

    return await newDoc.save();
  },

  /**
   * Split PDF into separate individual single-page documents
   */
  splitAll: async function (file, onProgress) {
    const { PDFDocument } = PDFLib;
    const srcDoc = await this._loadDoc(file);
    const totalPages = srcDoc.getPageCount();

    const results = [];
    const baseName = file.name.replace(/\.pdf$/i, '');

    for (let i = 0; i < totalPages; i++) {
      if (typeof onProgress === 'function') {
        onProgress(Math.round(((i + 1) / totalPages) * 100), `Extracting page ${i + 1} of ${totalPages}...`);
      }
      const singleDoc = await PDFDocument.create();
      const [copied] = await singleDoc.copyPages(srcDoc, [i]);
      singleDoc.addPage(copied);
      const bytes = await singleDoc.save();
      results.push({
        name: `${baseName}_page_${i + 1}.pdf`,
        data: bytes
      });
    }

    return results;
  },

  /**
   * Split PDF every N pages
   */
  splitEveryN: async function (file, n, onProgress) {
    const { PDFDocument } = PDFLib;
    const srcDoc = await this._loadDoc(file);
    const totalPages = srcDoc.getPageCount();

    const results = [];
    const baseName = file.name.replace(/\.pdf$/i, '');
    let partNumber = 1;

    for (let i = 0; i < totalPages; i += n) {
      const pageIndices = [];
      for (let j = i; j < Math.min(i + n, totalPages); j++) {
        pageIndices.push(j);
      }

      if (typeof onProgress === 'function') {
        onProgress(Math.round(((i + 1) / totalPages) * 100), `Creating part ${partNumber}...`);
      }

      const partDoc = await PDFDocument.create();
      const copiedPages = await partDoc.copyPages(srcDoc, pageIndices);
      copiedPages.forEach(p => partDoc.addPage(p));
      const bytes = await partDoc.save();

      const pageStart = i + 1;
      const pageEnd = Math.min(i + n, totalPages);
      results.push({
        name: `${baseName}_part_${partNumber}_(pages_${pageStart}-${pageEnd}).pdf`,
        data: bytes
      });

      partNumber++;
    }

    return results;
  }
};
