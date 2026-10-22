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
   * Render a page with PDF.js to canvas, paint solid black rectangles over redactions,
   * replace the original page with the rasterized canvas image, and remove annotations/form fields.
   *
   * @param {Object} pdfDoc PDF-Lib PDFDocument instance
   * @param {Object} pdfjsDoc PDF.js PDFDocumentLoadingTask or Document instance
   * @param {number} pageIndex 0-based page index to redact
   * @param {Array} redactions List of redaction marks on this page
   * @param {Object} options Optional settings: dpi, imageFormat, imageQuality, CoordinateEngine
   */
  static async rasterizeAndRedactPage(pdfDoc, pdfjsDoc, pageIndex, redactions, options = {}) {
    if (!redactions || redactions.length === 0) return;

    const dpi = options.dpi || RedactionEngine.DEFAULT_DPI;
    const canvasScale = dpi / 72;
    const imageFormat = options.imageFormat || 'image/jpeg';
    const imageQuality = options.imageQuality || 0.92;

    const pageNum = pageIndex + 1;
    const origPage = pdfDoc.getPage(pageIndex);
    const { width: pageWidth, height: pageHeight } = origPage.getSize();
    const pageRotation = origPage.getRotation().angle || 0;

    let imageBytes = null;
    let isPng = imageFormat.toLowerCase().includes('png');

    // Get PDF.js page instance if available
    let pdfjsPage = null;
    if (pdfjsDoc) {
      if (typeof pdfjsDoc.getPage === 'function') {
        pdfjsPage = await pdfjsDoc.getPage(pageNum);
      } else if (pdfjsDoc.promise) {
        const loaded = await pdfjsDoc.promise;
        pdfjsPage = await loaded.getPage(pageNum);
      }
    }

    const viewport = pdfjsPage
      ? pdfjsPage.getViewport({ scale: canvasScale, rotation: pageRotation })
      : { width: Math.round(pageWidth * canvasScale), height: Math.round(pageHeight * canvasScale) };

    const targetWidth = Math.round(viewport.width);
    const targetHeight = Math.round(viewport.height);

    // Resolve Coordinate Engine for precise coordinate transformation
    const CoordEngine = options.CoordinateEngine ||
      (typeof PDFCoordinateEngine !== 'undefined' ? PDFCoordinateEngine : null) ||
      (typeof window !== 'undefined' && window.PDFTools && window.PDFTools.PDFCoordinateEngine) ||
      (typeof require === 'function' ? (() => { try { return require('./pdf-coordinate-engine.js'); } catch (e) { return null; } })() : null);

    const canvasBoxes = redactions.map(red => {
      if (CoordEngine && typeof CoordEngine.redactionToCanvas === 'function') {
        return CoordEngine.redactionToCanvas(red, pageWidth, pageHeight, canvasScale, pageRotation);
      }
      if (red.isPdfCoord || red.pdfX !== undefined || red.pdfY !== undefined) {
        const px = red.pdfX !== undefined ? red.pdfX : red.x;
        const py = red.pdfY !== undefined ? red.pdfY : red.y;
        return {
          x: Math.round(px * canvasScale),
          y: Math.round((pageHeight - (py + (red.height || 0))) * canvasScale),
          width: Math.round((red.width || 0) * canvasScale),
          height: Math.round((red.height || 0) * canvasScale)
        };
      }
      return {
        x: Math.round((red.x || 0) * canvasScale),
        y: Math.round((red.y || 0) * canvasScale),
        width: Math.round((red.width || 0) * canvasScale),
        height: Math.round((red.height || 0) * canvasScale)
      };
    });

    // 1. Browser environment with HTML5 Canvas
    if (typeof document !== 'undefined' && document.createElement) {
      const canvas = document.createElement('canvas');
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext('2d');

      // Pre-fill solid white background
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, targetWidth, targetHeight);

      if (pdfjsPage) {
        await pdfjsPage.render({ canvasContext: ctx, viewport }).promise;
      }

      // Draw solid black redaction rectangles
      ctx.fillStyle = '#000000';
      for (const box of canvasBoxes) {
        ctx.fillRect(box.x, box.y, box.width, box.height);
      }

      const dataUrl = canvas.toDataURL(imageFormat, imageQuality);
      imageBytes = RedactionEngine.dataUrlToBytes(dataUrl);
      isPng = dataUrl.startsWith('data:image/png');
    } else {
      // 2. Node.js / Headless environment (generate valid raster PNG)
      imageBytes = RedactionEngine.createNodeRasterPng(targetWidth, targetHeight, [255, 255, 255], canvasBoxes);
      isPng = true;
    }

    // Embed the raster image into pdfDoc
    const embeddedImg = isPng
      ? await pdfDoc.embedPng(imageBytes)
      : await pdfDoc.embedJpg(imageBytes);

    // 1. Remove form fields associated with the redacted page first (before removing the page)
    try {
      const form = pdfDoc.getForm();
      if (form) {
        const fields = form.getFields();
        for (const field of fields) {
          const widgets = field.acroField.getWidgets();
          let onThisPage = false;
          for (const w of widgets) {
            const widgetPage = form.findWidgetPage(w);
            if (widgetPage === origPage) {
              onThisPage = true;
              break;
            }
          }
          if (onThisPage) {
            form.removeField(field);
          }
        }
      }
    } catch (e) {
      // Ignore if document has no AcroForm
    }

    // 2. Insert replacement page at the same index
    const newPage = pdfDoc.insertPage(pageIndex, [pageWidth, pageHeight]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: pageWidth,
      height: pageHeight
    });

    if (pageRotation) {
      const PDFLib = (typeof window !== 'undefined' && window.PDFLib)
        ? window.PDFLib
        : (typeof require === 'function' ? require('../lib/pdf-lib.min.js') : null);
      if (PDFLib && PDFLib.degrees) {
        newPage.setRotation(PDFLib.degrees(pageRotation));
      }
    }

    // 3. Purge original page's /Contents streams to guarantee zero raw byte leaks
    try {
      const contents = origPage.node.Contents();
      if (contents) {
        if (contents.asArray) {
          contents.asArray().forEach(ref => pdfDoc.context.delete(ref));
        } else {
          pdfDoc.context.delete(contents);
        }
      }
    } catch (e) {
      console.warn('Purge old page contents warning:', e);
    }

    // 4. Remove the original page (which was shifted to pageIndex + 1)
    pdfDoc.removePage(pageIndex + 1);
  }

  /**
   * Apply permanent redactions across all marked pages in the document.
   * Only pages with redaction marks are rasterized; unredacted pages remain pure vectors.
   *
   * @param {Object} pdfDoc PDF-Lib PDFDocument instance
   * @param {Object} pdfjsDoc PDF.js PDFDocument instance
   * @param {Object|Map} annotationsMap Map or object of page annotations (keyed by 1-based page number)
   * @param {Object} options Configuration options (dpi, CoordinateEngine, etc.)
   */
  static async applyPermanentRedactionsToDocument(pdfDoc, pdfjsDoc, annotationsMap = {}, options = {}) {
    const pageCount = pdfDoc.getPageCount();
    for (let pIndex = pageCount - 1; pIndex >= 0; pIndex--) {
      const pNum = pIndex + 1;
      const pageAnn = annotationsMap[pNum] ||
        (typeof annotationsMap.get === 'function' ? annotationsMap.get(pNum) : null);
      if (pageAnn && pageAnn.redactions && pageAnn.redactions.length > 0) {
        await RedactionEngine.rasterizeAndRedactPage(pdfDoc, pdfjsDoc, pIndex, pageAnn.redactions, options);
        // Clear annotations on redacted page since it is now a flattened image
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

  /**
   * Backwards-compatible hook called during studio export or direct baking.
   */
  static async applyRedactions(pdfDoc, pageAnn, pageOrPageIndex, scaleX, scaleY, pdfHeight, rgbFn, options = {}) {
    if (!pageAnn || !pageAnn.redactions || pageAnn.redactions.length === 0) return;

    let pageIndex = typeof pageOrPageIndex === 'number' ? pageOrPageIndex : null;
    if (pageIndex === null && pageOrPageIndex && typeof pageOrPageIndex.getIndex === 'function') {
      pageIndex = pageOrPageIndex.getIndex();
    }
    if (pageIndex === null && typeof pdfDoc.getPages === 'function') {
      const pages = pdfDoc.getPages();
      pageIndex = pages.indexOf(pageOrPageIndex);
    }
    if (pageIndex === null || pageIndex < 0) pageIndex = 0;

    const pdfjsDoc = options.pdfjsDoc ||
      (typeof window !== 'undefined' && window._currentPdfjsDoc) ||
      (options.doc && options.doc.pdfJsDoc);

    await RedactionEngine.rasterizeAndRedactPage(pdfDoc, pdfjsDoc, pageIndex, pageAnn.redactions, options);
  }

  /**
   * Helper to generate a valid PNG image in pure JS (for Node.js test environment)
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
