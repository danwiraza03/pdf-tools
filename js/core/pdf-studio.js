/**
 * PDF Tools — PDF Studio Core Engine (Viewer, Direct Editor & Annotator)
 * Combines PDF.js rendering, interactive canvas annotation layer, and PDF-Lib baking
 * 
 * Features:
 * - High-DPI Page Rendering & Thumbnail Generation
 * - Vector Text Box placement (font size, color, font family)
 * - Freehand Pen Drawing & Semitransparent Highlighter
 * - Visual Stamp & Signature placement (Drag & Resize)
 * - Interactive Inline OCR integration
 * - Lossless PDF-Lib Export Engine (bakes annotations into native PDF elements)
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Studio = (function () {
  /**
   * PDF Studio Document State Class
   */
  class StudioDoc {
    constructor(file, arrayBuffer) {
      this.file = file;
      this.fileName = file.name;
      this.arrayBuffer = arrayBuffer;
      this.dirty = false;
      this.pdfJsDoc = null;
      this.totalPages = 0;
      this.currentPage = 1;
      this.zoom = 1.0;
      this.pageRotations = {}; // pageNum -> additional rotation (0, 90, 180, 270)
      this.deletedPages = new Set(); // set of deleted pageNums
      this.pageOrder = []; // Ordered list of page numbers (supports reordering & duplicates)
      
      // Page Annotations: pageNum -> { texts: [], edits: [], drawings: [], shapes: [], stamps: [], ocrText: '' }
      this.annotations = {};
      this.bookmarks = []; // Outline/Bookmarks tree: [{ id, title, pageNum, items: [] }]
      this.attachments = []; // File attachments: [{ id, name, size, mimeType, data }]
    }

    getPageAnnotation(pageNum) {
      if (!this.annotations[pageNum]) {
        this.annotations[pageNum] = {
          texts: [],     // { id, text, x, y, fontSize, color, fontFamily, bold, italic }
          edits: [],     // { id, sourceIndex, text, x, y, width, height, fontSize, color }
          drawings: [],  // { type: 'pen'|'highlighter', color, width, points: [{x, y}] }
          shapes: [],    // { id, type: 'rectangle'|'circle'|'line', x, y, width, height, x2, y2, strokeColor, fillColor, strokeWidth }
          stamps: [],    // { id, type: 'signature'|'stamp', imageBytes, dataUrl, x, y, width, height }
          ocrText: ''
        };
      }
      return this.annotations[pageNum];
    }

    getActivePagesList() {
      if (this.pageOrder && this.pageOrder.length > 0) {
        return this.pageOrder.filter(p => !this.deletedPages.has(p));
      }
      const active = [];
      for (let p = 1; p <= this.totalPages; p++) {
        if (!this.deletedPages.has(p)) {
          active.push(p);
        }
      }
      return active;
    }
  }

  /**
   * Initialize a Studio Document from File
   * @param {File} file 
   * @returns {Promise<StudioDoc>}
   */
  async function loadDocument(file) {
    if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
      PDFTools.FileUtils.initPdfJsWorker();
    }

    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
    const pdfJsDoc = await loadingTask.promise;

    const doc = new StudioDoc(file, arrayBuffer);
    doc.pdfJsDoc = pdfJsDoc;
    doc.totalPages = pdfJsDoc.numPages;
    doc.pageOrder = Array.from({ length: doc.totalPages }, (_, i) => i + 1);

    // Extract Outline / Bookmarks
    try {
      const outline = await pdfJsDoc.getOutline();
      if (outline && outline.length > 0) {
        const resolveItems = async (items) => {
          const result = [];
          for (const item of items) {
            let targetPage = 1;
            try {
              let dest = item.dest;
              if (typeof dest === 'string') {
                dest = await pdfJsDoc.getDestination(dest);
              }
              if (Array.isArray(dest) && dest.length > 0) {
                const pageRef = dest[0];
                if (typeof pageRef === 'number') {
                  targetPage = pageRef + 1;
                } else if (pageRef && typeof pageRef === 'object') {
                  const pageIdx = await pdfJsDoc.getPageIndex(pageRef);
                  targetPage = pageIdx + 1;
                }
              }
            } catch (e) {}

            result.push({
              id: 'bm_' + Math.random().toString(36).substr(2, 9),
              title: item.title || 'Untitled',
              pageNum: targetPage,
              bold: !!item.bold,
              italic: !!item.italic,
              items: (item.items && item.items.length > 0) ? await resolveItems(item.items) : []
            });
          }
          return result;
        };
        doc.bookmarks = await resolveItems(outline);
      }
    } catch (e) {
      console.warn('Could not extract PDF bookmarks:', e);
    }

    // Extract Embedded File Attachments
    try {
      const attachments = await pdfJsDoc.getAttachments();
      if (attachments) {
        for (const [filename, fileObj] of Object.entries(attachments)) {
          if (fileObj && fileObj.content) {
            doc.attachments.push({
              id: 'att_' + Math.random().toString(36).substr(2, 9),
              name: fileObj.filename || filename,
              size: fileObj.content.byteLength || fileObj.content.length || 0,
              mimeType: 'application/octet-stream',
              data: new Uint8Array(fileObj.content),
              creationDate: new Date()
            });
          }
        }
      }
    } catch (e) {
      console.warn('Could not extract PDF attachments:', e);
    }

    return doc;
  }

  const RECOVERY_DB_NAME = 'pdf-tools-recovery';
  const RECOVERY_STORE_NAME = 'snapshots';
  const RECOVERY_KEY = 'active-document';

  function openRecoveryStore() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error('IndexedDB is unavailable'));
        return;
      }

      const request = indexedDB.open(RECOVERY_DB_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(RECOVERY_STORE_NAME);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Unable to open recovery storage'));
    });
  }

  function serializeDocumentState(doc) {
    return {
      fileName: doc.fileName,
      currentPage: doc.currentPage,
      pageRotations: doc.pageRotations,
      deletedPages: Array.from(doc.deletedPages),
      pageOrder: doc.pageOrder,
      annotations: doc.annotations,
      bookmarks: doc.bookmarks,
      attachments: (doc.attachments || []).map(a => ({
        id: a.id,
        name: a.name,
        size: a.size,
        mimeType: a.mimeType,
        data: a.data
      }))
    };
  }

  function restoreDocumentState(doc, state) {
    if (!state) return doc;
    doc.currentPage = state.currentPage || 1;
    doc.pageRotations = state.pageRotations || {};
    doc.deletedPages = new Set(state.deletedPages || []);
    doc.pageOrder = state.pageOrder || doc.pageOrder;
    doc.annotations = state.annotations || {};
    doc.bookmarks = state.bookmarks || doc.bookmarks || [];
    doc.attachments = state.attachments || doc.attachments || [];
    doc.dirty = true;
    return doc;
  }

  async function saveRecoverySnapshot(doc) {
    const db = await openRecoveryStore();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(RECOVERY_STORE_NAME, 'readwrite');
      transaction.objectStore(RECOVERY_STORE_NAME).put({
        fileName: doc.fileName,
        arrayBuffer: doc.arrayBuffer,
        state: serializeDocumentState(doc),
        updatedAt: Date.now()
      }, RECOVERY_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Unable to save recovery snapshot'));
    });
    db.close();
  }

  async function getRecoverySnapshot() {
    const db = await openRecoveryStore();
    const snapshot = await new Promise((resolve, reject) => {
      const request = db.transaction(RECOVERY_STORE_NAME, 'readonly')
        .objectStore(RECOVERY_STORE_NAME).get(RECOVERY_KEY);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error || new Error('Unable to read recovery snapshot'));
    });
    db.close();
    return snapshot;
  }

  async function clearRecoverySnapshot() {
    const db = await openRecoveryStore();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(RECOVERY_STORE_NAME, 'readwrite');
      transaction.objectStore(RECOVERY_STORE_NAME).delete(RECOVERY_KEY);
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error || new Error('Unable to clear recovery snapshot'));
    });
    db.close();
  }

  /**
   * Render a specific page to a canvas element with zoom and custom rotation
   * @param {StudioDoc} doc 
   * @param {number} pageNum 
   * @param {HTMLCanvasElement} canvas 
   * @param {number} scale 
   * @returns {Promise<{width: number, height: number, viewport: Object}>}
   */
  async function renderPage(doc, pageNum, canvas, scale) {
    scale = scale || 1.0;
    const page = await doc.pdfJsDoc.getPage(pageNum);
    
    const extraRotation = doc.pageRotations[pageNum] || 0;
    const viewport = page.getViewport({ scale: scale, rotation: (page.rotate + extraRotation) % 360 });

    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
    }).promise;

    return {
      width: viewport.width,
      height: viewport.height,
      viewport: viewport
    };
  }

  /**
   * Render thumbnail preview for sidebar
   */
  async function renderThumbnail(doc, pageNum, canvas) {
    return renderPage(doc, pageNum, canvas, 0.22);
  }

  /**
   * Resolve and cache standard and custom PDF fonts with bold/italic styles
   */
  async function resolvePdfFont(pdfDoc, fontFamily, bold, italic) {
    if (window.PDFTools && window.PDFTools.FontResolver) {
      return await window.PDFTools.FontResolver.resolvePdfFont(pdfDoc, fontFamily, bold, italic);
    }
    const { StandardFonts } = PDFLib;
    try {
      return (bold && italic) ? await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique)
        : bold ? await pdfDoc.embedFont(StandardFonts.HelveticaBold)
        : italic ? await pdfDoc.embedFont(StandardFonts.HelveticaOblique)
        : await pdfDoc.embedFont(StandardFonts.Helvetica);
    } catch (e) {
      return await pdfDoc.embedFont(StandardFonts.Helvetica);
    }
  }

  /**
   * Bake and Export all edits, annotations, stamps, and rotations into a new PDF
   * @param {StudioDoc} doc 
   * @param {Function} onProgress 
   * @returns {Promise<Uint8Array>}
   */
  async function exportDocument(doc, onProgress) {
    const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;

    if (typeof onProgress === 'function') {
      onProgress(10, 'Loading base PDF document...');
    }

    const pdfDoc = await PDFDocument.load(doc.arrayBuffer, { ignoreEncryption: true });
    
    // Unlock any digital signatures / stamps so they stay 100% visible
    try {
      if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc, doc.arrayBuffer);
      }
    } catch (e) {
      console.warn('Signature unlock warning:', e);
    }

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const activePageNums = doc.getActivePagesList();
    const totalActive = activePageNums.length;

    // Stamp cache to avoid re-embedding same image data
    const embeddedImagesCache = new Map();

    for (let i = 0; i < totalActive; i++) {
      const pageNum = activePageNums[i];
      const pageIndex = pageNum - 1;
      const page = pages[pageIndex];

      if (typeof onProgress === 'function') {
        const percent = Math.round(15 + ((i + 1) / totalActive) * 75);
        onProgress(percent, `Baking annotations & stamps on page ${pageNum}...`);
      }

      // 1. Apply additional rotation
      const extraRot = doc.pageRotations[pageNum] || 0;
      if (extraRot !== 0) {
        const currentRot = page.getRotation().angle || 0;
        page.setRotation(degrees((currentRot + extraRot) % 360));
      }

      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const pageAnn = doc.getPageAnnotation(pageNum);

      // We need original page dimensions rendered at scale 1.0 to compute proportional ratios
      const pdfJsPage = await doc.pdfJsDoc.getPage(pageNum);
      const viewport = pdfJsPage.getViewport({ scale: 1.0, rotation: (pdfJsPage.rotate + extraRot) % 360 });
      const viewWidth = viewport.width;
      const viewHeight = viewport.height;

      const scaleX = pdfWidth / viewWidth;
      const scaleY = pdfHeight / viewHeight;

      // 1. Bake Paragraph and Run Text Edits (Acrobat-Grade Vector Stream Stripping)
      if (pageAnn.edits && pageAnn.edits.length > 0) {
        // Collect all original text strings to strip from the PDF stream
        const textsToRemove = [];
        for (const edit of pageAnn.edits) {
          if (edit.originalText) {
            textsToRemove.push(edit.originalText);
            edit.originalText.split('\n').forEach(l => { if (l.trim()) textsToRemove.push(l.trim()); });
          }
          if (edit.runsToRemove) {
            edit.runsToRemove.forEach(r => { if (r.text) textsToRemove.push(r.text); });
          }
        }

        if (window.PDFTools && window.PDFTools.PDFStreamEngine) {
          window.PDFTools.PDFStreamEngine.stripTextFromPage(page, textsToRemove);
        }

        // Draw newly edited replacement text
        for (const edit of pageAnn.edits) {
          const editX = edit.x * scaleX;
          const editWidth = edit.width * scaleX;

          // If text was moved or has background, cover original text bounds
          const origX = (edit.originalX !== undefined ? edit.originalX : edit.x) * scaleX;
          const origY = (edit.originalY !== undefined ? edit.originalY : edit.y) * scaleY;
          const origW = (edit.originalWidth !== undefined ? edit.originalWidth : edit.width) * scaleX;
          const origH = (edit.originalHeight !== undefined ? edit.originalHeight : edit.height) * scaleY;

          if (edit.backgroundColor && edit.backgroundColor !== 'transparent' && edit.backgroundColor !== 'none') {
            try {
              const bgRgb = parseColorRgb(edit.backgroundColor || '#ffffff', rgb);
              page.drawRectangle({
                x: origX,
                y: pdfHeight - (origY + origH),
                width: origW,
                height: origH,
                color: bgRgb
              });
            } catch (bgErr) {}
          }

          const editFont = await resolvePdfFont(pdfDoc, edit.fontFamily, edit.bold, edit.italic);
          const fontSize = (edit.fontSize || 14) * scaleY;
          const textColor = parseColorRgb(edit.color || '#000000', rgb);

          // Compute ascent from font metrics when available, otherwise use font-family-aware ratio
          let editAscentRatio = 0.8;
          try {
            if (edit.ascentRatio) {
              editAscentRatio = edit.ascentRatio;
            } else if (editFont.heightAtSize) {
              const fullH = editFont.heightAtSize(fontSize, { descender: false });
              editAscentRatio = Math.min(0.92, Math.max(0.7, fullH / fontSize));
            }
          } catch (e) {}

          const rawLines = (edit.text || '').split('\n');
          const lineHeight = fontSize * 1.25;

          for (let l = 0; l < rawLines.length; l++) {
            const line = rawLines[l];
            if (!line) continue;
            let lineOffsetX = 0;
            if (edit.align === 'center' || edit.align === 'right') {
              try {
                const measuredW = editFont.widthOfTextAtSize(line, fontSize);
                if (edit.align === 'center') lineOffsetX = Math.max(0, (editWidth - measuredW) / 2);
                if (edit.align === 'right') lineOffsetX = Math.max(0, editWidth - measuredW);
              } catch (e) {}
            }
            const lineY = pdfHeight - ((edit.y + (l * lineHeight) + (fontSize * editAscentRatio)) * scaleY);
            try {
              page.drawText(line, {
                x: editX + lineOffsetX,
                y: lineY,
                size: fontSize,
                font: editFont,
                color: textColor
              });
            } catch (drawErr) {
              console.warn('PDF edit draw error:', drawErr);
            }
          }
        }
      }

      // 2. Bake Freehand Drawings & Highlighters
      if (pageAnn.drawings && pageAnn.drawings.length > 0) {
        for (const draw of pageAnn.drawings) {
          if (!draw.points || draw.points.length < 2) continue;

          const isHighlighter = draw.type === 'highlighter';
          const strokeColor = parseColorRgb(draw.color || '#FACC15', rgb);
          const strokeWidth = (draw.width || 3) * Math.min(scaleX, scaleY);
          const opacity = isHighlighter ? 0.45 : 1.0;

          for (let p = 1; p < draw.points.length; p++) {
            const p0 = draw.points[p - 1];
            const p1 = draw.points[p];

            // Convert canvas top-left coordinates to PDF bottom-left coordinates
            const startX = p0.x * scaleX;
            const startY = pdfHeight - (p0.y * scaleY);
            const endX = p1.x * scaleX;
            const endY = pdfHeight - (p1.y * scaleY);

            page.drawLine({
              start: { x: startX, y: startY },
              end: { x: endX, y: endY },
              thickness: strokeWidth,
              color: strokeColor,
              opacity: opacity
            });
          }
        }
      }

      // 2b. Bake Vector Shapes
      if (pageAnn.shapes && pageAnn.shapes.length > 0) {
        for (const shape of pageAnn.shapes) {
          const strokeColor = parseColorRgb(shape.strokeColor || '#EF4444', rgb);
          const strokeWidth = (shape.strokeWidth || 2) * Math.min(scaleX, scaleY);

          if (shape.type === 'rectangle') {
            const shapeX = shape.x * scaleX;
            const shapeY = pdfHeight - ((shape.y + shape.height) * scaleY);
            const shapeW = shape.width * scaleX;
            const shapeH = shape.height * scaleY;
            const opts = {
              x: shapeX,
              y: shapeY,
              width: shapeW,
              height: shapeH,
              borderColor: strokeColor,
              borderWidth: strokeWidth
            };
            if (shape.fillColor && shape.fillColor !== 'transparent') {
              opts.color = parseColorRgb(shape.fillColor, rgb);
            }
            page.drawRectangle(opts);
          } else if (shape.type === 'circle') {
            const centerX = (shape.x + shape.width / 2) * scaleX;
            const centerY = pdfHeight - ((shape.y + shape.height / 2) * scaleY);
            const radiusX = (shape.width / 2) * scaleX;
            const radiusY = (shape.height / 2) * scaleY;
            const opts = {
              x: centerX,
              y: centerY,
              xScale: radiusX,
              yScale: radiusY,
              borderColor: strokeColor,
              borderWidth: strokeWidth
            };
            if (shape.fillColor && shape.fillColor !== 'transparent') {
              opts.color = parseColorRgb(shape.fillColor, rgb);
            }
            page.drawEllipse(opts);
          } else if (shape.type === 'line') {
            const centerY = shape.y + (shape.height ? shape.height / 2 : 0);
            const startX = shape.x * scaleX;
            const startY = pdfHeight - ((shape.y2 !== undefined ? shape.y : centerY) * scaleY);
            const endX = (shape.x2 !== undefined ? shape.x2 : shape.x + shape.width) * scaleX;
            const endY = pdfHeight - ((shape.y2 !== undefined ? shape.y2 : centerY) * scaleY);
            page.drawLine({
              start: { x: startX, y: startY },
              end: { x: endX, y: endY },
              thickness: strokeWidth,
              color: strokeColor
            });
          }
        }
      }

      // 3. Bake Stamps & Signatures
      if (pageAnn.stamps && pageAnn.stamps.length > 0) {
        for (const stamp of pageAnn.stamps) {
          if (!stamp.imageBytes && !stamp.dataUrl) continue;

          let embeddedImg = null;
          const cacheKey = stamp.dataUrl ? stamp.dataUrl.substring(0, 100) : stamp.id;

          if (embeddedImagesCache.has(cacheKey)) {
            embeddedImg = embeddedImagesCache.get(cacheKey);
          } else {
            let imgBytes = stamp.imageBytes;
            if (!imgBytes && stamp.dataUrl) {
              const bin = atob(stamp.dataUrl.split(',')[1]);
              imgBytes = new Uint8Array(bin.length);
              for (let b = 0; b < bin.length; b++) imgBytes[b] = bin.charCodeAt(b);
            }

            if (stamp.dataUrl && stamp.dataUrl.includes('image/png')) {
              embeddedImg = await pdfDoc.embedPng(imgBytes);
            } else {
              embeddedImg = await pdfDoc.embedJpg(imgBytes);
            }
            embeddedImagesCache.set(cacheKey, embeddedImg);
          }

          const stampWidth = stamp.width * scaleX;
          const stampHeight = stamp.height * scaleY;
          const stampX = stamp.x * scaleX;
          const stampY = pdfHeight - ((stamp.y + stamp.height) * scaleY);

          page.drawImage(embeddedImg, {
            x: stampX,
            y: stampY,
            width: stampWidth,
            height: stampHeight,
            opacity: stamp.opacity !== undefined ? stamp.opacity : 1.0
          });
        }
      }

      // 3b. Bake Existing Image Edits (Replace / Move / Delete)
      if (pageAnn.imageEdits && pageAnn.imageEdits.length > 0) {
        for (const imgEdit of pageAnn.imageEdits) {
          // If deleted or moved/replaced, cover the original position
          if (imgEdit.original) {
            const origX = imgEdit.original.x * scaleX;
            const origY = pdfHeight - ((imgEdit.original.y + imgEdit.original.height) * scaleY);
            const origW = imgEdit.original.width * scaleX;
            const origH = imgEdit.original.height * scaleY;
            page.drawRectangle({
              x: origX,
              y: origY,
              width: origW,
              height: origH,
              color: rgb(1, 1, 1)
            });
          }

          if (!imgEdit.deleted && imgEdit.dataUrl) {
            let embeddedImg = null;
            const cacheKey = imgEdit.dataUrl.substring(0, 100);
            if (embeddedImagesCache.has(cacheKey)) {
              embeddedImg = embeddedImagesCache.get(cacheKey);
            } else {
              const bin = atob(imgEdit.dataUrl.split(',')[1]);
              const imgBytes = new Uint8Array(bin.length);
              for (let b = 0; b < bin.length; b++) imgBytes[b] = bin.charCodeAt(b);
              if (imgEdit.dataUrl.includes('image/png')) {
                embeddedImg = await pdfDoc.embedPng(imgBytes);
              } else {
                embeddedImg = await pdfDoc.embedJpg(imgBytes);
              }
              embeddedImagesCache.set(cacheKey, embeddedImg);
            }

            const editW = imgEdit.width * scaleX;
            const editH = imgEdit.height * scaleY;
            const editX = imgEdit.x * scaleX;
            const editY = pdfHeight - ((imgEdit.y + imgEdit.height) * scaleY);

            page.drawImage(embeddedImg, {
              x: editX,
              y: editY,
              width: editW,
              height: editH,
              opacity: imgEdit.opacity !== undefined ? imgEdit.opacity : 1.0
            });
          }
        }
      }

      // 4. Bake Text Items
      if (pageAnn.texts && pageAnn.texts.length > 0) {
        for (const textItem of pageAnn.texts) {
          if (!textItem.text || textItem.text.trim() === '') continue;

          const textFont = await resolvePdfFont(pdfDoc, textItem.fontFamily, textItem.bold, textItem.italic);

          const textColor = parseColorRgb(textItem.color || '#000000', rgb);
          const fontSize = (textItem.fontSize || 14) * scaleY;
          const textX = (textItem.x || 0) * scaleX;
          // Font baseline in PDF coordinates — use font metrics or font-family-aware ascent ratio
          let textAscentRatio = 0.8;
          try {
            if (textItem.ascentRatio) {
              textAscentRatio = textItem.ascentRatio;
            } else if (textFont.heightAtSize) {
              const fullH = textFont.heightAtSize(fontSize, { descender: false });
              textAscentRatio = Math.min(0.92, Math.max(0.7, fullH / fontSize));
            }
          } catch (e) {}
          const textY = pdfHeight - (((textItem.y || 0) + (textItem.fontSize || 14) * textAscentRatio) * scaleY);
          const boxWidth = (textItem.width ? textItem.width * scaleX : 0);

          const lines = textItem.text.split('\n');
          for (let l = 0; l < lines.length; l++) {
            const line = lines[l];
            if (!line) continue;

            let lineOffsetX = 0;
            if ((textItem.align === 'center' || textItem.align === 'right') && boxWidth > 0) {
              try {
                const lineW = textFont.widthOfTextAtSize(line, fontSize);
                if (textItem.align === 'center') lineOffsetX = Math.max(0, (boxWidth - lineW) / 2);
                if (textItem.align === 'right') lineOffsetX = Math.max(0, boxWidth - lineW);
              } catch (e) {}
            }

            const lineY = textY - (l * fontSize * 1.25);

            try {
              page.drawText(line, {
                x: textX + lineOffsetX,
                y: lineY,
                size: fontSize,
                font: textFont,
                color: textColor
              });
            } catch (drawErr) {
              // Skip unsupported glyphs
            }
          }
        }
      }

      // 4b. Bake Header & Footer
      if (pageAnn.headerFooter) {
        const hf = pageAnn.headerFooter;
        const hfFont = await resolvePdfFont(pdfDoc, hf.fontFamily || 'Helvetica', false, false);
        const hfSize = (hf.fontSize || 10) * scaleY;
        const hfColor = parseColorRgb(hf.color || '#374151', rgb);
        const topMarginY = pdfHeight - (25 * scaleY);
        const bottomMarginY = 25 * scaleY;
        const sideMarginX = 36 * scaleX;

        // Top Left, Center, Right
        if (hf.headerLeft) {
          try { page.drawText(hf.headerLeft, { x: sideMarginX, y: topMarginY, size: hfSize, font: hfFont, color: hfColor }); } catch (e) {}
        }
        if (hf.headerCenter) {
          try {
            const w = hfFont.widthOfTextAtSize(hf.headerCenter, hfSize);
            page.drawText(hf.headerCenter, { x: (pdfWidth - w) / 2, y: topMarginY, size: hfSize, font: hfFont, color: hfColor });
          } catch (e) {}
        }
        if (hf.headerRight) {
          try {
            const w = hfFont.widthOfTextAtSize(hf.headerRight, hfSize);
            page.drawText(hf.headerRight, { x: pdfWidth - sideMarginX - w, y: topMarginY, size: hfSize, font: hfFont, color: hfColor });
          } catch (e) {}
        }

        // Bottom Left, Center, Right
        if (hf.footerLeft) {
          try { page.drawText(hf.footerLeft, { x: sideMarginX, y: bottomMarginY, size: hfSize, font: hfFont, color: hfColor }); } catch (e) {}
        }
        if (hf.footerCenter) {
          try {
            const w = hfFont.widthOfTextAtSize(hf.footerCenter, hfSize);
            page.drawText(hf.footerCenter, { x: (pdfWidth - w) / 2, y: bottomMarginY, size: hfSize, font: hfFont, color: hfColor });
          } catch (e) {}
        }
        if (hf.footerRight) {
          try {
            const w = hfFont.widthOfTextAtSize(hf.footerRight, hfSize);
            page.drawText(hf.footerRight, { x: pdfWidth - sideMarginX - w, y: bottomMarginY, size: hfSize, font: hfFont, color: hfColor });
          } catch (e) {}
        }
      }

      // 4c. Bake Bates Numbering
      if (pageAnn.batesNumber && pageAnn.batesNumber.text) {
        const bn = pageAnn.batesNumber;
        const bnFont = await resolvePdfFont(pdfDoc, bn.fontFamily || 'Helvetica', true, false);
        const bnSize = (bn.fontSize || 10) * scaleY;
        const bnColor = parseColorRgb(bn.color || '#1F2937', rgb);
        try {
          const bnWidth = bnFont.widthOfTextAtSize(bn.text, bnSize);
          let bnX = pdfWidth - (36 * scaleX) - bnWidth;
          let bnY = 25 * scaleY;

          if (bn.position === 'top_right') {
            bnX = pdfWidth - (36 * scaleX) - bnWidth;
            bnY = pdfHeight - (25 * scaleY);
          } else if (bn.position === 'top_center') {
            bnX = (pdfWidth - bnWidth) / 2;
            bnY = pdfHeight - (25 * scaleY);
          } else if (bn.position === 'bottom_center') {
            bnX = (pdfWidth - bnWidth) / 2;
            bnY = 25 * scaleY;
          } else if (bn.position === 'bottom_left') {
            bnX = 36 * scaleX;
            bnY = 25 * scaleY;
          }

          page.drawText(bn.text, { x: bnX, y: bnY, size: bnSize, font: bnFont, color: bnColor });
        } catch (e) {}
      }

      // 4d. Bake Searchable Invisible OCR Text Layer (Makes hardcopy scans 100% searchable)
      if (pageAnn.ocrWords && pageAnn.ocrWords.length > 0) {
        const ocrFont = await resolvePdfFont(pdfDoc, 'Helvetica', false, false);
        for (const w of pageAnn.ocrWords) {
          if (!w.text) continue;
          const pdfX = (w.x || 0) * scaleX;
          const wordH = (w.height || 14) * scaleY;
          const pdfY = pdfHeight - (((w.y || 0) + (w.height || 14)) * scaleY);
          const fontSize = Math.max(5, Math.round(wordH * 0.82));
          const safeText = (window.PDFTools && window.PDFTools.OCR && window.PDFTools.OCR.sanitizeForPdfWinAnsi)
            ? window.PDFTools.OCR.sanitizeForPdfWinAnsi(w.text)
            : w.text;
          if (!safeText || safeText.trim() === '') continue;
          try {
            page.drawText(safeText, {
              x: pdfX,
              y: pdfY,
              size: fontSize,
              font: ocrFont,
              color: rgb(0, 0, 0),
              opacity: 0.0 // Invisible selectable & searchable layer
            });
          } catch (e) {}
        }
      }

      // 4d. Bake Redactions (Rasterizes redacted pages to prevent underlying text leakage)
      if (pageAnn.redactions && pageAnn.redactions.length > 0 && window.PDFTools.RedactionEngine) {
        await window.PDFTools.RedactionEngine.applyRedactions(pdfDoc, pageAnn, pageIndex, scaleX, scaleY, pdfHeight, rgb, {
          pdfjsDoc: doc.pdfJsDoc,
          doc
        });
      }
    }

    // 4e. Bake Form Fields
    const allFormFields = [];
    activePageNums.forEach(p => {
      const pAnn = doc.getPageAnnotation(p);
      if (pAnn.formFields && pAnn.formFields.length > 0) {
        allFormFields.push(...pAnn.formFields);
      }
    });
    if (allFormFields.length > 0 && window.PDFTools.FormEngine) {
      await window.PDFTools.FormEngine.bakeFormFields(pdfDoc, allFormFields);
    }

    // 4f. Apply Metadata / Sanitization
    if (doc.sanitized && window.PDFTools.RedactionEngine) {
      window.PDFTools.RedactionEngine.sanitizeMetadata(pdfDoc);
    } else if (doc.metadata && window.PDFTools.AccessibilityEngine) {
      window.PDFTools.AccessibilityEngine.applyMetadata(pdfDoc, doc.metadata);
    }

    // 4g. Bake File Attachments
    if (doc.attachments && doc.attachments.length > 0) {
      for (const att of doc.attachments) {
        if (att && att.data) {
          try {
            await pdfDoc.attach(att.data, att.name, {
              mimeType: att.mimeType || 'application/octet-stream',
              description: att.name,
              creationDate: att.creationDate || new Date(),
              modificationDate: new Date()
            });
          } catch (e) {
            console.warn('Could not embed attachment in pdfDoc:', e);
          }
        }
      }
    }

    // 5. Build final document with active page order & duplicates
    const isModifiedOrder = doc.deletedPages.size > 0 || (doc.pageOrder && doc.pageOrder.some((p, idx) => p !== idx + 1)) || activePageNums.length !== doc.totalPages;

    if (isModifiedOrder) {
      const finalDoc = await PDFDocument.create();
      const indicesToCopy = activePageNums.map(p => p - 1);
      const copiedPages = await finalDoc.copyPages(pdfDoc, indicesToCopy);
      copiedPages.forEach(p => finalDoc.addPage(p));

      if (doc.sanitized && window.PDFTools.RedactionEngine) {
        window.PDFTools.RedactionEngine.sanitizeMetadata(finalDoc);
      } else if (doc.metadata && window.PDFTools.AccessibilityEngine) {
        window.PDFTools.AccessibilityEngine.applyMetadata(finalDoc, doc.metadata);
      }

      if (doc.attachments && doc.attachments.length > 0) {
        for (const att of doc.attachments) {
          if (att && att.data) {
            try {
              await finalDoc.attach(att.data, att.name, {
                mimeType: att.mimeType || 'application/octet-stream',
                description: att.name,
                creationDate: att.creationDate || new Date(),
                modificationDate: new Date()
              });
            } catch (e) {
              console.warn('Could not embed attachment in finalDoc:', e);
            }
          }
        }
      }

      if (typeof onProgress === 'function') {
        onProgress(95, 'Finalizing and compressing exported document...');
      }
      return await finalDoc.save({ useObjectStreams: true });
    }

    if (typeof onProgress === 'function') {
      onProgress(95, 'Finalizing and compressing exported document...');
    }

    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Shift annotations and rotations when pages are inserted or deleted
   */
  function shiftAnnotationsOnInsert(doc, insertIndex, count) {
    const startPage = insertIndex + 1; // 1-based page number
    const newAnnotations = {};
    const newRotations = {};

    Object.keys(doc.annotations).forEach(key => {
      const p = parseInt(key, 10);
      if (p < startPage) {
        newAnnotations[p] = doc.annotations[p];
      } else {
        newAnnotations[p + count] = doc.annotations[p];
      }
    });

    Object.keys(doc.pageRotations).forEach(key => {
      const p = parseInt(key, 10);
      if (p < startPage) {
        newRotations[p] = doc.pageRotations[p];
      } else {
        newRotations[p + count] = doc.pageRotations[p];
      }
    });

    doc.annotations = newAnnotations;
    doc.pageRotations = newRotations;
  }

  /**
   * Insert blank pages into StudioDoc at given 0-based index
   * @param {StudioDoc} doc 
   * @param {number} insertIndex 0-based index where pages are inserted
   * @param {number} count Number of blank pages
   * @param {Object} options { width, height, orientation }
   */
  async function insertBlankPages(doc, insertIndex, count = 1, options = {}) {
    const { PDFDocument } = PDFLib;
    const pdfDoc = await PDFDocument.load(doc.arrayBuffer, { ignoreEncryption: true });

    let w = options.width || 595.28; // Standard A4 width
    let h = options.height || 841.89; // Standard A4 height

    if (options.orientation === 'landscape' && w < h) {
      const tmp = w; w = h; h = tmp;
    } else if (options.orientation === 'portrait' && w > h) {
      const tmp = w; w = h; h = tmp;
    }

    const totalCurrent = pdfDoc.getPageCount();
    const safeIdx = Math.max(0, Math.min(insertIndex, totalCurrent));

    for (let c = 0; c < count; c++) {
      pdfDoc.insertPage(safeIdx + c, [w, h]);
    }

    const newBytes = await pdfDoc.save({ useObjectStreams: true });
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(newBytes.slice(0)) });
    doc.pdfJsDoc = await loadingTask.promise;
    doc.arrayBuffer = newBytes.buffer || newBytes;
    doc.totalPages = doc.pdfJsDoc.numPages;
    doc.pageOrder = Array.from({ length: doc.totalPages }, (_, i) => i + 1);
    doc.deletedPages = new Set();
    shiftAnnotationsOnInsert(doc, safeIdx, count);
    doc.currentPage = safeIdx + 1;
    doc.dirty = true;

    return { count, newTotalPages: doc.totalPages, targetPage: doc.currentPage };
  }

  /**
   * Insert pages from an external PDF ArrayBuffer into StudioDoc
   * @param {StudioDoc} doc 
   * @param {number} insertIndex 0-based index where pages are inserted
   * @param {ArrayBuffer} sourcePdfBuffer 
   * @param {number[]|null} sourcePageIndices 0-based indices of pages to copy
   */
  async function insertPdfPages(doc, insertIndex, sourcePdfBuffer, sourcePageIndices = null) {
    const { PDFDocument } = PDFLib;
    const targetPdfDoc = await PDFDocument.load(doc.arrayBuffer, { ignoreEncryption: true });
    const sourcePdfDoc = await PDFDocument.load(sourcePdfBuffer, { ignoreEncryption: true });

    const sourceTotal = sourcePdfDoc.getPageCount();
    const indicesToCopy = Array.isArray(sourcePageIndices) && sourcePageIndices.length > 0
      ? sourcePageIndices.filter(i => i >= 0 && i < sourceTotal)
      : Array.from({ length: sourceTotal }, (_, i) => i);

    if (indicesToCopy.length === 0) return { count: 0, newTotalPages: doc.totalPages };

    const copiedPages = await targetPdfDoc.copyPages(sourcePdfDoc, indicesToCopy);
    const targetTotal = targetPdfDoc.getPageCount();
    const safeIdx = Math.max(0, Math.min(insertIndex, targetTotal));

    copiedPages.forEach((page, idx) => {
      targetPdfDoc.insertPage(safeIdx + idx, page);
    });

    const newBytes = await targetPdfDoc.save({ useObjectStreams: true });
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(newBytes.slice(0)) });
    doc.pdfJsDoc = await loadingTask.promise;
    doc.arrayBuffer = newBytes.buffer || newBytes;
    doc.totalPages = doc.pdfJsDoc.numPages;
    doc.pageOrder = Array.from({ length: doc.totalPages }, (_, i) => i + 1);
    doc.deletedPages = new Set();
    shiftAnnotationsOnInsert(doc, safeIdx, copiedPages.length);
    doc.currentPage = safeIdx + 1;
    doc.dirty = true;

    return { count: copiedPages.length, newTotalPages: doc.totalPages, targetPage: doc.currentPage };
  }

  /**
   * Insert image(s) as PDF pages into StudioDoc
   * @param {StudioDoc} doc 
   * @param {number} insertIndex 
   * @param {Array<{arrayBuffer: ArrayBuffer, mimeType: string, width?: number, height?: number}>} imageItems 
   */
  async function insertImagePages(doc, insertIndex, imageItems = []) {
    if (!imageItems || imageItems.length === 0) return { count: 0, newTotalPages: doc.totalPages };
    const { PDFDocument } = PDFLib;
    const targetPdfDoc = await PDFDocument.load(doc.arrayBuffer, { ignoreEncryption: true });

    const targetTotal = targetPdfDoc.getPageCount();
    const safeIdx = Math.max(0, Math.min(insertIndex, targetTotal));
    let insertedCount = 0;

    for (let i = 0; i < imageItems.length; i++) {
      const item = imageItems[i];
      let imgBytes = item.arrayBuffer;
      if (!imgBytes && item.bytes) imgBytes = item.bytes;

      if (!imgBytes) continue;

      let embeddedImg;
      const isPng = (item.mimeType && item.mimeType.includes('png')) || (item.name && item.name.toLowerCase().endsWith('.png'));

      try {
        if (isPng) {
          embeddedImg = await targetPdfDoc.embedPng(imgBytes);
        } else {
          embeddedImg = await targetPdfDoc.embedJpg(imgBytes);
        }
      } catch (embedErr) {
        // Fallback: try embedJpg if embedPng failed, or vice-versa
        try {
          embeddedImg = isPng ? await targetPdfDoc.embedJpg(imgBytes) : await targetPdfDoc.embedPng(imgBytes);
        } catch (e) {
          console.warn('Could not embed image:', e);
          continue;
        }
      }

      const imgDims = embeddedImg.scale(1);
      // Fit to standard A4 with margin or use native image size
      const maxW = 595.28;
      const maxH = 841.89;
      let pageW = maxW;
      let pageH = maxH;
      
      const ratio = Math.min((maxW - 40) / imgDims.width, (maxH - 40) / imgDims.height);
      const drawW = imgDims.width * ratio;
      const drawH = imgDims.height * ratio;
      const drawX = (pageW - drawW) / 2;
      const drawY = (pageH - drawH) / 2;

      const page = targetPdfDoc.insertPage(safeIdx + insertedCount, [pageW, pageH]);
      page.drawImage(embeddedImg, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH
      });
      insertedCount++;
    }

    if (insertedCount === 0) return { count: 0, newTotalPages: doc.totalPages };

    const newBytes = await targetPdfDoc.save({ useObjectStreams: true });
    const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(newBytes.slice(0)) });
    doc.pdfJsDoc = await loadingTask.promise;
    doc.arrayBuffer = newBytes.buffer || newBytes;
    doc.totalPages = doc.pdfJsDoc.numPages;
    doc.pageOrder = Array.from({ length: doc.totalPages }, (_, i) => i + 1);
    doc.deletedPages = new Set();
    shiftAnnotationsOnInsert(doc, safeIdx, insertedCount);
    doc.currentPage = safeIdx + 1;
    doc.dirty = true;

    return { count: insertedCount, newTotalPages: doc.totalPages, targetPage: doc.currentPage };
  }

  /**
   * Helper: Parse hex/named color to PDF-Lib rgb object
   */
  function parseColorRgb(colorHex, rgbFn) {
    if (!colorHex || typeof colorHex !== 'string') return rgbFn(0, 0, 0);

    colorHex = colorHex.trim().replace('#', '');
    if (colorHex.length === 3) {
      colorHex = colorHex.split('').map(c => c + c).join('');
    }

    if (colorHex.length === 6) {
      const r = parseInt(colorHex.substring(0, 2), 16) / 255;
      const g = parseInt(colorHex.substring(2, 4), 16) / 255;
      const b = parseInt(colorHex.substring(4, 6), 16) / 255;
      return rgbFn(r || 0, g || 0, b || 0);
    }

    return rgbFn(0, 0, 0);
  }

  return {
    loadDocument,
    restoreDocumentState,
    renderPage,
    renderThumbnail,
    exportDocument,
    insertBlankPages,
    insertPdfPages,
    insertImagePages,
    saveRecoverySnapshot,
    getRecoverySnapshot,
    clearRecoverySnapshot
  };
})();

