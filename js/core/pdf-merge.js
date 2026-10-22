/**
 * PDF Tools — Merge PDF Core Logic
 * Supports merging signed PDFs by stripping digital signature protection
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Merge = {
  /**
   * Merge multiple PDF files or individual page items into a single Uint8Array
   * Supports:
   * - Array of File objects (whole-file merging)
   * - Array of page descriptors: [{ file: File, pageIndex: number, rotation?: number }] (custom organize mode)
   * 
   * Automatically removes digital signature protection from source files
   * while preserving all visual content (stamps, materai, signature images)
   * 
   * @param {File[]|Array<{file: File, pageIndex: number, rotation?: number}>} items - Files or page descriptors
   * @param {Function} onProgress - Progress callback (percent, text)
   * @returns {Promise<{bytes: Uint8Array, hadSignatures: boolean, sigFileCount: number, pageCount: number}>}
   */
  merge: async function (items, onProgress) {
    if (!items || items.length === 0) {
      throw new Error('At least one item or page is required for merging');
    }

    const { PDFDocument, degrees } = PDFLib;
    const mergedPdf = await PDFDocument.create();

    let hadSignatures = false;
    let sigFileCount = 0;

    // Check if items are page descriptors (organized mode) or File objects (classic mode)
    const isPageLevel = items[0] && typeof items[0].pageIndex === 'number';

    // Cache loaded PDFDocuments by File instance/name to avoid reloading/reparsing
    const docCache = new Map();

    const getOrLoadDoc = async (file) => {
      const cacheKey = file.name + '_' + file.size + '_' + file.lastModified;
      if (docCache.has(cacheKey)) {
        return docCache.get(cacheKey);
      }

      const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
      let pdf;
      try {
        pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true, updateMetadata: false });
      } catch (loadErr) {
        console.warn(`Merge: Initial load failed for "${file.name}", retrying with fallback:`, loadErr);
        pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
      }

      // Remove digital signatures and bake e-materai stamps
      try {
        if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
          const sigResult = await PDFTools.Compress.removeDigitalSignatures(pdf);
          if (sigResult && sigResult.removed) {
            hadSignatures = true;
            sigFileCount++;
            console.log(`Merge: Processed and embedded ${sigResult.count} signature(s) from "${file.name}"`);
          }
        }
      } catch (sigErr) {
        console.warn(`Merge: Signature removal notice for "${file.name}":`, sigErr);
      }

      docCache.set(cacheKey, pdf);
      return pdf;
    };

    let totalPagesMerged = 0;

    try {
      if (isPageLevel) {
        // --- MODE 2: Page Organizer Mode ---
        const totalPages = items.length;
        for (let i = 0; i < totalPages; i++) {
          const item = items[i];
          if (typeof onProgress === 'function') {
            const percent = Math.round(((i + 1) / totalPages) * 85);
            onProgress(percent, `Merging page ${i + 1} of ${totalPages} (${item.file.name} - p.${item.pageIndex + 1})...`);
          }

          const sourcePdf = await getOrLoadDoc(item.file);
          const [copiedPage] = await mergedPdf.copyPages(sourcePdf, [item.pageIndex]);

          // Apply rotation if specified
          if (item.rotation) {
            const currentRot = copiedPage.getRotation().angle || 0;
            copiedPage.setRotation(degrees((currentRot + item.rotation) % 360));
          }

          mergedPdf.addPage(copiedPage);
          totalPagesMerged++;
        }
      } else {
        // --- MODE 1: Whole-File List Mode ---
        const totalFiles = items.length;
        for (let i = 0; i < totalFiles; i++) {
          const file = items[i];
          if (typeof onProgress === 'function') {
            const percent = Math.round(((i + 1) / totalFiles) * 85);
            onProgress(percent, `Processing file ${i + 1} of ${totalFiles}: ${file.name}`);
          }

          const sourcePdf = await getOrLoadDoc(file);
          const pageIndices = sourcePdf.getPageIndices();
          const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
          copiedPages.forEach(page => {
            mergedPdf.addPage(page);
            totalPagesMerged++;
          });
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(90, 'Saving merged PDF document...');
      }

      const mergedBytes = await mergedPdf.save({ useObjectStreams: true });

      if (typeof onProgress === 'function') {
        onProgress(100, 'Complete!');
      }

      // Clear memory cache
      docCache.clear();

      return {
        bytes: mergedBytes,
        hadSignatures: hadSignatures,
        sigFileCount: sigFileCount,
        pageCount: totalPagesMerged
      };
    } catch (mergeError) {
      docCache.clear();
      throw mergeError;
    }
  }
};

