/**
 * Redaction & Document Sanitization Engine
 * Manages redaction marks, visual blackout overlay, underlying text/vector removal
 * via page rasterization (anti-leak guarantee), and document metadata sanitization.
 */

class RedactionEngine {
  /**
   * Configurable default rasterization resolution for redacting pages.
   * Default minimum is 200 DPI for high clarity and crisp visual output.
   */
  static DEFAULT_DPI = 200;

  /**
   * Add a redaction box mark to a page annotation
   */
  static addRedactionMark(pageAnn, box = {}) {
    if (!pageAnn.redactions) pageAnn.redactions = [];
    const mark = {
      id: `redact_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      x: box.x || 50,
      y: box.y || 50,
      width: box.width || 120,
      height: box.height || 24,
      fillColor: '#000000',
      overlayText: box.overlayText || '[REDACTED]',
      applied: false,
      isPdfCoord: !!box.isPdfCoord,
      pdfX: box.pdfX,
      pdfY: box.pdfY
    };
    pageAnn.redactions.push(mark);
    return mark;
  }

  /**
   * Convert Data URL to Uint8Array (works in browser and Node)
   */
  static dataUrlToBytes(dataUrl) {
    const base64 = dataUrl.split(',')[1];
    if (typeof atob === 'function') {
      const binary = atob(base64);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      return bytes;
    }
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }

  /**
   * Resolve the PDF-Lib namespace in browser or Node.
   */
  static getPdfLib() {
    if (typeof window !== 'undefined' && window.PDFLib) return window.PDFLib;
    if (typeof PDFLib !== 'undefined') return PDFLib;
    return require('../lib/pdf-lib.min.js');
  }

  /**
   * Default rasterizer: renders the page with PDF.js onto an HTML5 canvas and paints
   * solid black boxes. Only available in a browser. In any other environment the caller
   * MUST inject options.rasterize, otherwise redaction fails loudly instead of silently
   * producing a wrong page.
   */
  static async canvasRasterize({ pdfjsPage, viewport, width, height, boxes, imageFormat, imageQuality }) {
    if (typeof document === 'undefined' || !document.createElement) {
      throw new Error('Redaction rasterizer unavailable: no HTML5 canvas in this environment. Inject options.rasterize.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, width, height);
    if (pdfjsPage) {
      await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;
    }
    ctx.fillStyle = '#000000';
    for (const box of boxes) {
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    const dataUrl = canvas.toDataURL(imageFormat, imageQuality);
    const bytes = RedactionEngine.dataUrlToBytes(dataUrl);
    // Release canvas memory early
    canvas.width = 0;
    canvas.height = 0;
    return { bytes, isPng: dataUrl.startsWith('data:image/png') };
  }

  /**
   * Convert redaction marks to pixel boxes on the DISPLAYED (rotated, cropped) page raster.
   *
   * Two mark formats are supported:
   *  - PDF user-space marks (isPdfCoord / pdfX / pdfY): converted with PDF.js
   *    viewport.convertToViewportRectangle, which handles /Rotate and CropBox offsets.
   *  - Screen marks (x, y, width, height) drawn on the viewer canvas at scale 1.0: these are
   *    already in display space, so they are only scaled.
   */
  static marksToPixelBoxes(redactions, viewport, canvasScale, fallback) {
    return redactions.map(red => {
      const isPdf = red.isPdfCoord || red.pdfX !== undefined || red.pdfY !== undefined;
      if (isPdf) {
        const px = red.pdfX !== undefined ? red.pdfX : red.x;
        const py = red.pdfY !== undefined ? red.pdfY : red.y;
        const w = red.width || 0;
        const h = red.height || 0;
        if (viewport && typeof viewport.convertToViewportRectangle === 'function') {
          const r = viewport.convertToViewportRectangle([px, py, px + w, py + h]);
          return {
            x: Math.floor(Math.min(r[0], r[2])),
            y: Math.floor(Math.min(r[1], r[3])),
            width: Math.ceil(Math.abs(r[2] - r[0])) + 1,
            height: Math.ceil(Math.abs(r[3] - r[1])) + 1
          };
        }
        if (fallback && fallback.CoordEngine) {
          const b = fallback.CoordEngine.transformBox(
            { x: px - fallback.originX, y: py - fallback.originY, width: w, height: h },
            fallback.boxWidth, fallback.boxHeight, canvasScale, fallback.rotation
          );
          return { x: Math.floor(b.x), y: Math.floor(b.y), width: Math.ceil(b.width) + 1, height: Math.ceil(b.height) + 1 };
        }
        throw new Error('Cannot convert PDF-coordinate redaction without a PDF.js viewport or CoordinateEngine.');
      }
      // Screen marks: pad by 1px on every side so anti-aliased glyph edges are covered
      return {
        x: Math.floor((red.x || 0) * canvasScale) - 1,
        y: Math.floor((red.y || 0) * canvasScale) - 1,
        width: Math.ceil((red.width || 0) * canvasScale) + 2,
        height: Math.ceil((red.height || 0) * canvasScale) + 2
      };
    });
  }

  /**
   * Replace every reference to oldRef with newRef across the whole object graph
   * (outline destinations, link annotations, named destinations, OpenAction, etc.).
   * Without this, a bookmark pointing at the redacted page would keep the ORIGINAL
   * page object (and all of its secret content) alive in the saved file.
   */
  static replaceRefEverywhere(pdfDoc, oldRef, newRef) {
    const L = RedactionEngine.getPdfLib();
    const { PDFRef, PDFDict, PDFArray, PDFStream } = L;
    const visited = new Set();
    let replaced = 0;

    const visit = (obj) => {
      if (!obj || visited.has(obj)) return;
      if (obj instanceof PDFStream) {
        visit(obj.dict);
        return;
      }
      if (obj instanceof PDFDict) {
        visited.add(obj);
        for (const [key, val] of obj.entries()) {
          if (val instanceof PDFRef) {
            if (val === oldRef || val.tag === oldRef.tag) {
              obj.set(key, newRef);
              replaced++;
            }
          } else {
            visit(val);
          }
        }
        return;
      }
      if (obj instanceof PDFArray) {
        visited.add(obj);
        const items = obj.asArray();
        for (let i = 0; i < items.length; i++) {
          const val = items[i];
          if (val instanceof PDFRef) {
            if (val === oldRef || val.tag === oldRef.tag) {
              obj.set(i, newRef);
              replaced++;
            }
          } else {
            visit(val);
          }
        }
      }
    };

    for (const [, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      visit(obj);
    }
    return replaced;
  }

  /**
   * Delete every indirect object that is no longer reachable from the trailer
   * (Root / Info / Encrypt). PDF-Lib writes ALL objects in its context on save,
   * reachable or not, so without this step the original content streams, Form
   * XObjects (which often hold the real text) and images of a redacted page would
   * still be inside the output file.
   *
   * Delegates to PDFTools.PdfCopy.purgeUnreachableObjects (js/core/pdf-copy.js)
   * when available, to avoid code duplication. Falls back to a local implementation
   * so that redaction tests can run without loading pdf-copy.js.
   *
   * @returns {number} number of objects removed
   */
  static purgeUnreachableObjects(pdfDoc) {
    // Prefer the shared implementation from pdf-copy.js
    const globalObj = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : globalThis;
    if (globalObj.PDFTools && globalObj.PDFTools.PdfCopy && typeof globalObj.PDFTools.PdfCopy.purgeUnreachableObjects === 'function') {
      return globalObj.PDFTools.PdfCopy.purgeUnreachableObjects(pdfDoc);
    }
    // --- Local fallback (keeps redaction tests self-contained) ---
    const L = RedactionEngine.getPdfLib();
    const { PDFRef, PDFDict, PDFArray, PDFStream } = L;
    const ctx = pdfDoc.context;
    const reachable = new Set();
    const seenDirect = new Set();
    const stack = [];
    const ti = ctx.trailerInfo || {};
    [ti.Root, ti.Info, ti.Encrypt].forEach(o => { if (o) stack.push(o); });

    while (stack.length) {
      const o = stack.pop();
      if (!o) continue;
      if (o instanceof PDFRef) {
        if (reachable.has(o.tag)) continue;
        reachable.add(o.tag);
        const target = ctx.lookup(o);
        if (target) stack.push(target);
      } else if (o instanceof PDFStream) {
        stack.push(o.dict);
      } else if (o instanceof PDFDict) {
        if (seenDirect.has(o)) continue;
        seenDirect.add(o);
        for (const [, v] of o.entries()) stack.push(v);
      } else if (o instanceof PDFArray) {
        if (seenDirect.has(o)) continue;
        seenDirect.add(o);
        for (const v of o.asArray()) stack.push(v);
      }
    }

    let removed = 0;
    const all = ctx.enumerateIndirectObjects().slice();
    for (const [ref] of all) {
      if (!reachable.has(ref.tag)) {
        ctx.delete(ref);
        removed++;
      }
    }
    return removed;
  }

  /**
   * Remove the logical structure tree (tagged-PDF data). Structure elements can carry
   * /ActualText and /Alt strings that duplicate the redacted text verbatim.
   * Trade-off: the document loses its accessibility tags.
   * @returns {boolean} true if a structure tree was removed
   */
  static removeStructureTree(pdfDoc) {
    const L = RedactionEngine.getPdfLib();
    const catalog = pdfDoc.catalog;
    const key = L.PDFName.of('StructTreeRoot');
    if (catalog && catalog.has(key)) {
      catalog.delete(key);
      catalog.delete(L.PDFName.of('MarkInfo'));
      return true;
    }
    return false;
  }

  /**
   * Rasterize one page, paint the redaction boxes, and replace the page with the image.
   * The new page has the DISPLAYED size (rotation and CropBox already applied) and no
   * /Rotate, so it looks exactly like what the user saw while marking it.
   *
   * Does NOT purge orphaned objects by itself: call applyPermanentRedactionsToDocument,
   * or purgeUnreachableObjects afterwards.
   *
   * @param {Object} pdfDoc PDF-Lib PDFDocument
   * @param {Object} pdfjsDoc PDF.js document rendering THE SAME content as pdfDoc
   * @param {number} pageIndex 0-based index
   * @param {Array} redactions marks for this page
   * @param {Object} options dpi, imageFormat, imageQuality, CoordinateEngine, rasterize
   */
  static async rasterizeAndRedactPage(pdfDoc, pdfjsDoc, pageIndex, redactions, options = {}) {
    if (!redactions || redactions.length === 0) return;

    const L = RedactionEngine.getPdfLib();
    const dpi = options.dpi || RedactionEngine.DEFAULT_DPI;
    const canvasScale = dpi / 72;
    const imageFormat = options.imageFormat || 'image/jpeg';
    const imageQuality = options.imageQuality || 0.92;

    const origPage = pdfDoc.getPage(pageIndex);
    const oldRef = origPage.ref;
    const rotation = (((origPage.getRotation().angle || 0) % 360) + 360) % 360;
    const box = origPage.getCropBox ? origPage.getCropBox() : { x: 0, y: 0, ...origPage.getSize() };

    let pdfjsPage = null;
    if (pdfjsDoc) {
      const loaded = typeof pdfjsDoc.getPage === 'function' ? pdfjsDoc : await pdfjsDoc.promise;
      pdfjsPage = await loaded.getPage(pageIndex + 1);
    }

    const swap = rotation === 90 || rotation === 270;
    const displayW = swap ? box.height : box.width;
    const displayH = swap ? box.width : box.height;

    const viewport = pdfjsPage
      ? pdfjsPage.getViewport({ scale: canvasScale, rotation })
      : null;

    const pixelW = Math.round(viewport ? viewport.width : displayW * canvasScale);
    const pixelH = Math.round(viewport ? viewport.height : displayH * canvasScale);

    const CoordEngine = options.CoordinateEngine ||
      (typeof window !== 'undefined' && window.PDFTools && window.PDFTools.PDFCoordinateEngine) || null;

    const boxes = RedactionEngine.marksToPixelBoxes(redactions, viewport, canvasScale, {
      CoordEngine,
      originX: box.x,
      originY: box.y,
      boxWidth: box.width,
      boxHeight: box.height,
      rotation
    });

    const rasterize = options.rasterize || RedactionEngine.canvasRasterize;
    const { bytes, isPng } = await rasterize({
      pdfjsPage, viewport, width: pixelW, height: pixelH, boxes, imageFormat, imageQuality
    });

    const embeddedImg = isPng ? await pdfDoc.embedPng(bytes) : await pdfDoc.embedJpg(bytes);

    // Remove form fields that have a widget on the redacted page
    try {
      const form = pdfDoc.getForm();
      for (const field of form.getFields()) {
        const onThisPage = field.acroField.getWidgets().some(w => {
          const p = w.P ? w.P() : null;
          return (p && p.tag === oldRef.tag) || form.findWidgetPage(w) === origPage;
        });
        if (onThisPage) form.removeField(field);
      }
    } catch (e) {
      // Document has no AcroForm
    }

    const newPage = pdfDoc.insertPage(pageIndex, [displayW, displayH]);
    newPage.drawImage(embeddedImg, { x: 0, y: 0, width: displayW, height: displayH });

    // Original page is now at pageIndex + 1
    pdfDoc.removePage(pageIndex + 1);

    // Repoint bookmarks / links / destinations to the new page so nothing keeps the old one alive
    RedactionEngine.replaceRefEverywhere(pdfDoc, oldRef, newPage.ref);

    if (pdfjsPage && typeof pdfjsPage.cleanup === 'function') {
      try { pdfjsPage.cleanup(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * Apply permanent redactions to every page that has marks, then strip everything
   * that could still leak the redacted content.
   *
   * IMPORTANT: pdfjsDoc must render the same content as pdfDoc. If pdfDoc contains
   * edits that are not in pdfjsDoc, use redactBakedDocument instead.
   *
   * @param {Object} pdfDoc PDF-Lib PDFDocument
   * @param {Object} pdfjsDoc PDF.js document
   * @param {Object|Map} annotationsMap keyed by 1-based page number: { redactions: [...] }
   * @param {Object} options dpi, CoordinateEngine, rasterize, clearAnnotations (default true)
   * @returns {{redactedPages: number[], removedObjects: number, structTreeRemoved: boolean}}
   */
  static async applyPermanentRedactionsToDocument(pdfDoc, pdfjsDoc, annotationsMap = {}, options = {}) {
    const clear = options.clearAnnotations !== false;
    const pageCount = pdfDoc.getPageCount();
    const redactedPages = [];

    // Iterate from the last page so indices stay valid
    for (let pIndex = pageCount - 1; pIndex >= 0; pIndex--) {
      const pNum = pIndex + 1;
      const pageAnn = (typeof annotationsMap.get === 'function')
        ? annotationsMap.get(pNum)
        : annotationsMap[pNum];
      if (pageAnn && pageAnn.redactions && pageAnn.redactions.length > 0) {
        await RedactionEngine.rasterizeAndRedactPage(pdfDoc, pdfjsDoc, pIndex, pageAnn.redactions, options);
        redactedPages.push(pNum);
        if (clear) {
          pageAnn.redactions = [];
          pageAnn.highlights = [];
          pageAnn.drawings = [];
          pageAnn.shapes = [];
          pageAnn.texts = [];
          pageAnn.comments = [];
          pageAnn.stamps = [];
          pageAnn.formFields = [];
          pageAnn.ocrWords = [];
        }
      }
    }

    let structTreeRemoved = false;
    let removedObjects = 0;
    if (redactedPages.length > 0) {
      structTreeRemoved = RedactionEngine.removeStructureTree(pdfDoc);
      removedObjects = RedactionEngine.purgeUnreachableObjects(pdfDoc);
    }
    return { redactedPages: redactedPages.reverse(), removedObjects, structTreeRemoved };
  }

  /**
   * Redact a document that has just been modified in memory (e.g. during Studio export,
   * after text edits, signatures and stamps were baked). Saves the current state, renders
   * THAT state with PDF.js, and rasterizes from it, so user edits on a redacted page are
   * kept in the image instead of being lost.
   *
   * @param {Object} pdfDoc PDF-Lib PDFDocument (modified in place)
   * @param {Object} annotationsMap keyed by 1-based page index IN pdfDoc
   * @param {Object} options same as applyPermanentRedactionsToDocument, plus pdfjsLib
   */
  static async redactBakedDocument(pdfDoc, annotationsMap, options = {}) {
    const pdfjsLib = options.pdfjsLib || (typeof window !== 'undefined' ? window.pdfjsLib : null);
    if (!pdfjsLib) throw new Error('PDF.js is required to redact a baked document.');
    const bytes = await pdfDoc.save({ useObjectStreams: false });
    const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(bytes) }).promise;
    try {
      return await RedactionEngine.applyPermanentRedactionsToDocument(pdfDoc, pdfjsDoc, annotationsMap, options);
    } finally {
      try { await pdfjsDoc.destroy(); } catch (e) { /* ignore */ }
    }
  }

  /**
   * @deprecated Kept for backwards compatibility. Rasterizes one page AND purges orphans.
   * Prefer redactBakedDocument / applyPermanentRedactionsToDocument.
   */
  static async applyRedactions(pdfDoc, pageAnn, pageOrPageIndex, scaleX, scaleY, pdfHeight, rgbFn, options = {}) {
    if (!pageAnn || !pageAnn.redactions || pageAnn.redactions.length === 0) return;
    let pageIndex = typeof pageOrPageIndex === 'number' ? pageOrPageIndex : pdfDoc.getPages().indexOf(pageOrPageIndex);
    if (pageIndex < 0) throw new Error('applyRedactions: page not found in document');
    const map = { [pageIndex + 1]: { redactions: pageAnn.redactions } };
    if (options.pdfjsDoc) {
      return RedactionEngine.applyPermanentRedactionsToDocument(pdfDoc, options.pdfjsDoc, map, { ...options, clearAnnotations: false });
    }
    return RedactionEngine.redactBakedDocument(pdfDoc, map, { ...options, clearAnnotations: false });
  }

  /**
   * TEST HELPER ONLY: build a PNG (solid fill + black boxes) without a canvas.
   * Used by Node tests as an injected options.rasterize. It does NOT render page content,
   * so it must never be used as a production fallback.
   */
  static createNodeRasterPng(width, height, fillColor = [255, 255, 255], blackBoxes = []) {
    let zlib;
    try {
      zlib = (typeof window !== 'undefined' && window.pako) ? window.pako : require('zlib');
    } catch (e) {
      zlib = require('zlib');
    }

    const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8;
    ihdrData[9] = 2; // RGB
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;

    const crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = ((c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1));
      }
      crcTable[n] = c;
    }
    function crc32(buf) {
      let c = 0xffffffff;
      for (let i = 0; i < buf.length; i++) {
        c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
      }
      return (c ^ 0xffffffff) >>> 0;
    }

    function makeChunk(type, data) {
      const len = Buffer.alloc(4);
      len.writeUInt32BE(data.length, 0);
      const typeBuf = Buffer.from(type, 'ascii');
      const toCrc = Buffer.concat([typeBuf, data]);
      const crc = crc32(toCrc);
      const crcBuf = Buffer.alloc(4);
      crcBuf.writeUInt32BE(crc >>> 0, 0);
      return Buffer.concat([len, typeBuf, data, crcBuf]);
    }

    const ihdrChunk = makeChunk('IHDR', ihdrData);
    const rowSize = 1 + width * 3;
    const rawData = Buffer.alloc(rowSize * height);

    for (let y = 0; y < height; y++) {
      const rowOffset = y * rowSize;
      rawData[rowOffset] = 0;
      for (let x = 0; x < width; x++) {
        let isBlack = false;
        for (const b of blackBoxes) {
          if (x >= b.x && x < b.x + b.width && y >= b.y && y < b.y + b.height) {
            isBlack = true;
            break;
          }
        }
        const pxOffset = rowOffset + 1 + x * 3;
        if (isBlack) {
          rawData[pxOffset] = 0;
          rawData[pxOffset + 1] = 0;
          rawData[pxOffset + 2] = 0;
        } else {
          rawData[pxOffset] = fillColor[0];
          rawData[pxOffset + 1] = fillColor[1];
          rawData[pxOffset + 2] = fillColor[2];
        }
      }
    }

    const compressed = (zlib.deflateSync) ? zlib.deflateSync(rawData) : zlib.deflate(rawData);
    const idatChunk = makeChunk('IDAT', Buffer.from(compressed));
    const iendChunk = makeChunk('IEND', Buffer.alloc(0));
    return Buffer.concat([sig, ihdrChunk, idatChunk, iendChunk]);
  }

  /**
   * Sanitize document metadata (Author, Title, Subject, Producer, Keywords)
   */
  static sanitizeMetadata(pdfDoc) {
    if (!pdfDoc) return;
    try {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('PDF Studio Pro Sanitizer');
      pdfDoc.setCreator('PDF Studio Pro');
    } catch (e) {
      console.warn('Metadata sanitization warning:', e);
    }
  }
}

if (typeof window !== 'undefined') {
  window.PDFTools = window.PDFTools || {};
  window.PDFTools.RedactionEngine = RedactionEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = RedactionEngine;
}
