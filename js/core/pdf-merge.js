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
    let mergedBytes;

    try {
      if (isPageLevel) {
        // --- MODE 2: Page Organizer Mode ---
        const totalPages = items.length;
        const assembledItems = [];
        for (let i = 0; i < totalPages; i++) {
          const item = items[i];
          const sourcePdf = item.doc || await getOrLoadDoc(item.file);
          assembledItems.push({
            doc: sourcePdf,
            pageIndex: item.pageIndex,
            rotation: item.rotation || 0,
            file: item.file
          });
        }

        const assembledResult = await PDFTools.Merge.assemble(assembledItems, {
          targetDoc: mergedPdf,
          onProgress: function (pct, status) {
            if (typeof onProgress === 'function') {
              onProgress(Math.round(pct * 0.90), status);
            }
          }
        });

        totalPagesMerged = assembledResult.pageCount;
        mergedBytes = assembledResult.bytes;
      } else {
        // --- MODE 1: Whole-File List Mode ---
        const totalFiles = items.length;
        const pageMapMode1 = new Map(); // srcDoc -> Map<srcIdx, destRef>
        const sourceNamesMode1 = new Map();
        let firstSourceMode1 = null;

        for (let i = 0; i < totalFiles; i++) {
          const file = items[i];
          if (typeof onProgress === 'function') {
            const percent = Math.round(((i + 1) / totalFiles) * 85);
            onProgress(percent, `Processing file ${i + 1} of ${totalFiles}: ${file.name}`);
          }

          const sourcePdf = await getOrLoadDoc(file);
          if (!firstSourceMode1) firstSourceMode1 = sourcePdf;
          const pageIndices = sourcePdf.getPageIndices();
          const copiedPages = await mergedPdf.copyPages(sourcePdf, pageIndices);
          const innerMap = new Map();
          copiedPages.forEach((page, idx) => {
            mergedPdf.addPage(page);
            innerMap.set(pageIndices[idx], page.ref);
            totalPagesMerged++;
          });
          pageMapMode1.set(sourcePdf, innerMap);
          sourceNamesMode1.set(sourcePdf, file.name || `Document ${i + 1}`);
        }

        if (typeof onProgress === 'function') {
          onProgress(88, 'Remapping links and bookmarks...');
        }

        // Apply copy-fidelity post-processing
        if (PDFTools.PdfCopy && typeof PDFTools.PdfCopy.finalize === 'function') {
          await PDFTools.PdfCopy.finalize(mergedPdf, pageMapMode1, {
            primarySource: firstSourceMode1,
            mergeMode: totalFiles > 1,
            sourceNames: sourceNamesMode1
          });
        }

        if (typeof onProgress === 'function') {
          onProgress(90, 'Saving merged PDF document...');
        }

        mergedBytes = await mergedPdf.save({ useObjectStreams: true });
      }

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
  },

  /**
   * Assemble a list of individual pages from loaded PDFDocuments into a single document.
   * Efficiently batches copyPages calls by grouping per source document and duplicate rounds,
   * preserving shared resources (fonts, images, streams) and preventing file size explosion.
   *
   * @param {Array<{doc?: PDFDocument, file?: File, pageIndex: number, rotation?: number}>} items - Page items
   * @param {Object|Function} [options={}] - Options object or onProgress callback
   * @returns {Promise<{doc: PDFDocument, bytes: Uint8Array, pageCount: number}>}
   */
  assemble: async function (items, options = {}) {
    if (!items || items.length === 0) {
      throw new Error('At least one page item is required for assemble');
    }

    const lib = typeof PDFLib !== 'undefined' ? PDFLib : (typeof window !== 'undefined' ? window.PDFLib : null);
    if (!lib) {
      throw new Error('PDFLib library is required for assemble');
    }
    const { PDFDocument, degrees } = lib;

    const onProgress = typeof options === 'function' ? options : (options && options.onProgress);
    const targetDoc = (options && options.targetDoc) || await PDFDocument.create();

    const totalPages = items.length;
    if (typeof onProgress === 'function') {
      onProgress(5, `Preparing ${totalPages} page(s) for assembly...`);
    }

    // Step 1: Group requested entries by source document
    const docGroups = new Map(); // doc -> array of { resultSlot, pageIndex, rotation }

    for (let slot = 0; slot < totalPages; slot++) {
      const item = items[slot];
      const doc = item.doc || item.sourceDoc || (item.file && item.file.doc);
      if (!doc) {
        throw new Error(`Item at position ${slot} is missing a source PDFDocument ('doc')`);
      }
      const pageIndex = item.pageIndex;
      const rotation = item.rotation || 0;

      if (!docGroups.has(doc)) {
        docGroups.set(doc, []);
      }
      docGroups.get(doc).push({ resultSlot: slot, pageIndex: pageIndex, rotation: rotation });
    }

    // Array to hold the copied page and rotation for each result slot (0 .. totalPages - 1)
    const resultSlots = new Array(totalPages);

    const totalDocs = docGroups.size;
    let completedDocs = 0;

    // Step 2: One copyPages call per source document with all requested indices
    for (const [doc, entries] of docGroups.entries()) {
      const pageIndices = entries.map(e => e.pageIndex);
      const copiedPages = await targetDoc.copyPages(doc, pageIndices);

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        resultSlots[entry.resultSlot] = {
          page: copiedPages[i],
          rotation: entry.rotation
        };
      }

      completedDocs++;
      if (typeof onProgress === 'function') {
        const pct = Math.round(10 + (completedDocs / totalDocs) * 65);
        onProgress(pct, `Copied pages from document ${completedDocs} of ${totalDocs}...`);
      }
    }

    // Step 3: Add pages to the result document in the requested order and apply rotation
    for (let slot = 0; slot < totalPages; slot++) {
      const slotData = resultSlots[slot];
      if (!slotData || !slotData.page) {
        continue;
      }
      const copiedPage = slotData.page;
      const rotation = slotData.rotation || 0;

      if (rotation !== 0) {
        const currentRot = copiedPage.getRotation().angle || 0;
        copiedPage.setRotation(degrees((currentRot + rotation) % 360));
      }

      targetDoc.addPage(copiedPage);

      if (typeof onProgress === 'function' && (slot % 10 === 0 || slot === totalPages - 1)) {
        const pct = Math.round(75 + ((slot + 1) / totalPages) * 15);
        onProgress(pct, `Assembled page ${slot + 1} of ${totalPages}...`);
      }
    }

    if (typeof onProgress === 'function') {
      onProgress(88, 'Remapping links, bookmarks, and metadata...');
    }

    // Step 4: Build pageMap for PdfCopy.finalize
    // Map each source doc -> (srcPageIndex -> destPageRef)
    const pageMap = new Map();
    const sourceNames = new Map();
    for (const [doc, entries] of docGroups.entries()) {
      const innerMap = new Map();
      for (const entry of entries) {
        const slotData = resultSlots[entry.resultSlot];
        if (slotData && slotData.page) {
          innerMap.set(entry.pageIndex, slotData.page.ref);
        }
      }
      pageMap.set(doc, innerMap);
      // Find source name from items
      const matchItem = items.find(it => (it.doc === doc || it.sourceDoc === doc));
      if (matchItem && matchItem.file && matchItem.file.name) {
        sourceNames.set(doc, matchItem.file.name);
      }
    }

    const primarySource = items[0] && (items[0].doc || items[0].sourceDoc);
    const isMultiSource = docGroups.size > 1;

    // Call finalize: remap links, rebuild bookmarks, copy metadata, purge ghosts
    if (PDFTools.PdfCopy && typeof PDFTools.PdfCopy.finalize === 'function') {
      await PDFTools.PdfCopy.finalize(targetDoc, pageMap, {
        primarySource,
        mergeMode: isMultiSource,
        sourceNames
      });
    }

    if (typeof onProgress === 'function') {
      onProgress(92, 'Optimizing and saving document streams...');
    }

    // Save with useObjectStreams: true for optimal compression
    const bytes = await targetDoc.save({ useObjectStreams: true });

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return {
      doc: targetDoc,
      bytes: bytes,
      pageCount: totalPages
    };
  }
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFTools.Merge;
}


