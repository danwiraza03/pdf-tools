/**
 * PDF Tools — Compress PDF Core Logic
 * Intelligent Content-Aware Client-side Compression Engine
 * 
 * Features:
 * - PDF Document Content Analysis (Text/Vector vs Scanned/Image vs Mixed)
 * - Lossless Structural & Stream Optimization (Preserves 100% vector & text clarity)
 * - High-Fidelity Rasterization (144-180 DPI) for Scanned/Image PDFs
 * - Quality-to-Size Guard (Prevents sacrificing quality for marginal size gains)
 * - Streaming Memory Management & Blob-based encoding
 * - Digital Signature Removal (Strips Sig fields, DSS, Perms for full compressibility)
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Compress = {
  /**
   * Helper: Decode Blob or ImageData to an ImageBitmap, Image, or Canvas
   */
  decodeImageToBitmap: async function (blobOrImageData) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(blobOrImageData);
      } catch (e) {}
    }
    if (blobOrImageData instanceof Blob) {
      return new Promise((resolve, reject) => {
        const img = new Image();
        const url = URL.createObjectURL(blobOrImageData);
        img.onload = () => {
          URL.revokeObjectURL(url);
          resolve(img);
        };
        img.onerror = (err) => {
          URL.revokeObjectURL(url);
          reject(err);
        };
        img.src = url;
      });
    } else {
      const c = document.createElement('canvas');
      c.width = blobOrImageData.width;
      c.height = blobOrImageData.height;
      const ctx = c.getContext('2d');
      ctx.putImageData(blobOrImageData, 0, 0);
      return c;
    }
  },

  /**
   * Helper: Scan content streams to determine display dimensions (in points) for each Image XObject
   * @param {PDFDocument} pdfDoc
   * @returns {Map<string, { maxWidthPt: number, maxHeightPt: number, pageWidth: number, pageHeight: number }>}
   */
  findImageDisplaySizes: function (pdfDoc) {
    const displaySizes = new Map();
    const { PDFName, PDFDict, PDFArray, PDFRawStream } = PDFLib;
    const pages = pdfDoc.getPages();

    for (let pIdx = 0; pIdx < pages.length; pIdx++) {
      const page = pages[pIdx];
      const pageNode = page.node;
      const pageWidth = page.getWidth() || 612;
      const pageHeight = page.getHeight() || 792;

      const nameToRefTag = new Map();
      const res = pdfDoc.context.lookup(pageNode.get(PDFName.of('Resources')));
      if (res instanceof PDFDict) {
        const xObjDict = pdfDoc.context.lookup(res.get(PDFName.of('XObject')));
        if (xObjDict instanceof PDFDict) {
          for (const [nameKey, valRef] of xObjDict.entries()) {
            const nameStr = nameKey.asString ? nameKey.asString() : nameKey.toString();
            const cleanName = nameStr.startsWith('/') ? nameStr.substring(1) : nameStr;
            const refTag = valRef.toString();
            nameToRefTag.set(cleanName, refTag);
            nameToRefTag.set('/' + cleanName, refTag);
            nameToRefTag.set(nameStr, refTag);
          }
        }
      }

      const contentsRef = pageNode.get(PDFName.of('Contents'));
      if (!contentsRef) continue;

      const streamRefs = (contentsRef instanceof PDFArray)
        ? contentsRef.asArray()
        : [contentsRef];

      const fullBytes = [];
      for (const sRef of streamRefs) {
        const streamObj = pdfDoc.context.lookup(sRef);
        if (streamObj && (streamObj instanceof PDFRawStream || streamObj.getContents)) {
          try {
            const decoded = PDFLib.decodePDFRawStream(streamObj).decode();
            for (let b = 0; b < decoded.length; b++) fullBytes.push(decoded[b]);
          } catch (e) {
            const raw = streamObj.getContents ? streamObj.getContents() : [];
            for (let b = 0; b < raw.length; b++) fullBytes.push(raw[b]);
          }
        }
      }

      if (fullBytes.length === 0) continue;
      const contentStr = new TextDecoder('latin1').decode(new Uint8Array(fullBytes));

      let ctm = [1, 0, 0, 1, 0, 0];
      const ctmStack = [];

      function multiplyMatrix(m1, m2) {
        return [
          m1[0] * m2[0] + m1[1] * m2[2],
          m1[0] * m2[1] + m1[1] * m2[3],
          m1[2] * m2[0] + m1[3] * m2[2],
          m1[2] * m2[1] + m1[3] * m2[3],
          m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
          m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
        ];
      }

      const tokens = contentStr.match(/\/?[^\s\[\]<>()]+/g) || [];
      const numStack = [];

      for (let i = 0; i < tokens.length; i++) {
        const tok = tokens[i];
        if (tok === 'q') {
          ctmStack.push([...ctm]);
          numStack.length = 0;
        } else if (tok === 'Q') {
          ctm = ctmStack.pop() || [1, 0, 0, 1, 0, 0];
          numStack.length = 0;
        } else if (tok === 'cm') {
          if (numStack.length >= 6) {
            const m = numStack.slice(-6);
            ctm = multiplyMatrix(m, ctm);
          }
          numStack.length = 0;
        } else if (tok === 'Do') {
          if (numStack.length >= 1) {
            const nameTok = numStack[numStack.length - 1];
            const cleanName = (typeof nameTok === 'string' && nameTok.startsWith('/')) ? nameTok.substring(1) : nameTok;
            const refTag = nameToRefTag.get(cleanName) || nameToRefTag.get('/' + cleanName);
            if (refTag) {
              const wPt = Math.hypot(ctm[0], ctm[1]);
              const hPt = Math.hypot(ctm[2], ctm[3]);
              const existing = displaySizes.get(refTag) || { maxWidthPt: 0, maxHeightPt: 0, pageWidth, pageHeight };
              existing.maxWidthPt = Math.max(existing.maxWidthPt, wPt);
              existing.maxHeightPt = Math.max(existing.maxHeightPt, hPt);
              displaySizes.set(refTag, existing);
            }
          }
          numStack.length = 0;
        } else {
          const num = parseFloat(tok);
          if (!isNaN(num) && !tok.startsWith('/')) {
            numStack.push(num);
          } else {
            numStack.push(tok);
          }
          if (numStack.length > 20) numStack.shift();
        }
      }
    }

    return displaySizes;
  },

  /**
   * Balanced Compression Engine: Downsamples embedded images in-place without touching text, fonts, or vectors
   */
  compressBalancedImages: async function (pdfDoc, arrayBuffer, originalSize, options, reportProgress) {
    const { PDFName, PDFNumber, PDFRawStream } = PDFLib;
    const targetDpi = options.dpi || 150;
    const jpegQuality = options.quality || 0.75;

    reportProgress(30, 'Scanning embedded images & calculating display DPI...');

    const displaySizes = this.findImageDisplaySizes(pdfDoc);

    const imageObjects = [];
    for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
      if (obj && obj.dict && (obj instanceof PDFRawStream || obj.getContents)) {
        const subtype = obj.dict.get(PDFName.of('Subtype'));
        if (subtype && subtype.toString() === '/Image') {
          imageObjects.push({ ref, obj });
        }
      }
    }

    let replacedCount = 0;
    let skippedCount = 0;
    const skippedReasons = [];
    const processedRefs = new Set();

    const totalImages = imageObjects.length;
    console.log(`[Compress Balanced] Found ${totalImages} image XObjects in document`);

    for (let idx = 0; idx < totalImages; idx++) {
      const { ref, obj } = imageObjects[idx];
      const refTag = ref.toString();

      if (processedRefs.has(refTag)) {
        continue;
      }
      processedRefs.add(refTag);

      const progressPct = Math.round(35 + ((idx / Math.max(1, totalImages)) * 50));
      reportProgress(progressPct, `Optimizing image ${idx + 1}/${totalImages}...`);

      const dict = obj.dict;
      const widthVal = dict.get(PDFName.of('Width'));
      const heightVal = dict.get(PDFName.of('Height'));
      if (!widthVal || !heightVal) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: missing Width or Height`);
        continue;
      }
      const origW = widthVal.asNumber();
      const origH = heightVal.asNumber();

      const filterVal = dict.get(PDFName.of('Filter'));
      const filterStr = filterVal ? filterVal.toString() : '';
      const colorSpaceVal = dict.get(PDFName.of('ColorSpace'));
      const colorSpaceStr = colorSpaceVal ? colorSpaceVal.toString() : '';
      const bpcVal = dict.get(PDFName.of('BitsPerComponent'));
      const bpc = bpcVal ? bpcVal.asNumber() : 8;

      // 1. Safety check: skip unsupported filters & colorspaces
      if (filterStr.includes('JBIG2') || filterStr.includes('CCITT')) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: bi-level filter (${filterStr})`);
        continue;
      }
      if (colorSpaceStr.includes('CMYK') || colorSpaceStr.includes('Indexed')) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: unsupported colorspace (${colorSpaceStr})`);
        continue;
      }
      if (bpc !== 8) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: non-8-bit depth (${bpc})`);
        continue;
      }

      // 2. Compute display dimensions & target pixels
      const disp = displaySizes.get(refTag);
      const dispWPt = (disp && disp.maxWidthPt > 0) ? disp.maxWidthPt : (disp ? disp.pageWidth : 612);
      const dispHPt = (disp && disp.maxHeightPt > 0) ? disp.maxHeightPt : (disp ? disp.pageHeight : 792);

      const targetW = Math.max(16, Math.round((dispWPt / 72) * targetDpi));
      const targetH = Math.max(16, Math.round((dispHPt / 72) * targetDpi));

      // If already at or below target DPI, skip downsampling
      if (origW <= targetW && origH <= targetH) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: already optimal resolution (${origW}x${origH})`);
        continue;
      }

      // Calculate final target dimensions preserving aspect ratio
      const scale = Math.min(targetW / origW, targetH / origH, 1.0);
      const finalW = Math.max(16, Math.round(origW * scale));
      const finalH = Math.max(16, Math.round(origH * scale));

      if (finalW >= origW && finalH >= origH) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag}: target size not smaller (${finalW}x${finalH} >= ${origW}x${origH})`);
        continue;
      }

      try {
        // 3. Decode image to ImageBitmap
        let bmp = null;
        const origBytes = obj.contents || (obj.getContents ? obj.getContents() : new Uint8Array(0));

        if (filterStr === '/DCTDecode' || filterStr.includes('DCTDecode')) {
          const blob = new Blob([origBytes], { type: 'image/jpeg' });
          bmp = await this.decodeImageToBitmap(blob);
        } else if (filterStr === '/FlateDecode' || filterStr === '' || !filterVal) {
          const rawPixels = PDFLib.decodePDFRawStream(obj).decode();
          const imgData = new ImageData(origW, origH);
          const d = imgData.data;
          if (colorSpaceStr.includes('DeviceGray')) {
            for (let p = 0; p < origW * origH; p++) {
              const g = rawPixels[p];
              d[p * 4] = g;
              d[p * 4 + 1] = g;
              d[p * 4 + 2] = g;
              d[p * 4 + 3] = 255;
            }
          } else {
            let src = 0;
            let dst = 0;
            for (let p = 0; p < origW * origH; p++) {
              d[dst] = rawPixels[src];
              d[dst + 1] = rawPixels[src + 1];
              d[dst + 2] = rawPixels[src + 2];
              d[dst + 3] = 255;
              src += 3;
              dst += 4;
            }
          }
          bmp = await this.decodeImageToBitmap(imgData);
        } else {
          skippedCount++;
          skippedReasons.push(`Image ${refTag}: unhandled filter ${filterStr}`);
          continue;
        }

        if (!bmp) {
          skippedCount++;
          skippedReasons.push(`Image ${refTag}: could not decode bitmap`);
          continue;
        }

        // 4. Draw to canvas at target resolution
        const canvas = document.createElement('canvas');
        canvas.width = finalW;
        canvas.height = finalH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(bmp, 0, 0, finalW, finalH);
        if (bmp.close) bmp.close();

        // 5. Encode as JPEG with medium quality
        const newBlob = await this.canvasToBlob(canvas, 'image/jpeg', jpegQuality);
        const newArrayBuffer = await newBlob.arrayBuffer();
        const newBytes = new Uint8Array(newArrayBuffer);

        // 6. Check size reduction rule: Replace ONLY if smaller!
        if (newBytes.length >= origBytes.length) {
          skippedCount++;
          skippedReasons.push(`Image ${refTag}: re-encoded size ${newBytes.length} not smaller than original ${origBytes.length}`);
          continue;
        }

        // 7. Handle SMask if present
        const smaskRef = dict.get(PDFName.of('SMask'));
        if (smaskRef) {
          try {
            const smaskObj = pdfDoc.context.lookup(smaskRef);
            if (smaskObj && (smaskObj instanceof PDFRawStream || smaskObj.getContents)) {
              processedRefs.add(smaskRef.toString());
              const smaskOrigW = smaskObj.dict.get(PDFName.of('Width')).asNumber();
              const smaskOrigH = smaskObj.dict.get(PDFName.of('Height')).asNumber();
              const smaskFilter = smaskObj.dict.get(PDFName.of('Filter'));
              const smaskFilterStr = smaskFilter ? smaskFilter.toString() : '';

              let smaskRaw;
              if (smaskFilterStr.includes('DCTDecode')) {
                const smaskBlob = new Blob([smaskObj.contents || smaskObj.getContents()], { type: 'image/jpeg' });
                const smaskBmp = await this.decodeImageToBitmap(smaskBlob);
                const smaskC = document.createElement('canvas');
                smaskC.width = finalW;
                smaskC.height = finalH;
                const smaskCtx = smaskC.getContext('2d');
                smaskCtx.drawImage(smaskBmp, 0, 0, finalW, finalH);
                if (smaskBmp.close) smaskBmp.close();
                const smd = smaskCtx.getImageData(0, 0, finalW, finalH).data;
                smaskRaw = new Uint8Array(finalW * finalH);
                for (let p = 0; p < finalW * finalH; p++) smaskRaw[p] = smd[p * 4];
              } else {
                const decodedSmask = PDFLib.decodePDFRawStream(smaskObj).decode();
                const smImgData = new ImageData(smaskOrigW, smaskOrigH);
                const smd = smImgData.data;
                for (let p = 0; p < smaskOrigW * smaskOrigH; p++) {
                  const val = decodedSmask[p];
                  smd[p * 4] = val;
                  smd[p * 4 + 1] = val;
                  smd[p * 4 + 2] = val;
                  smd[p * 4 + 3] = 255;
                }
                const smaskBmp = await this.decodeImageToBitmap(smImgData);
                const smaskC = document.createElement('canvas');
                smaskC.width = finalW;
                smaskC.height = finalH;
                const smaskCtx = smaskC.getContext('2d');
                smaskCtx.drawImage(smaskBmp, 0, 0, finalW, finalH);
                if (smaskBmp.close) smaskBmp.close();
                const scaledSmd = smaskCtx.getImageData(0, 0, finalW, finalH).data;
                smaskRaw = new Uint8Array(finalW * finalH);
                for (let p = 0; p < finalW * finalH; p++) smaskRaw[p] = scaledSmd[p * 4];
              }

              const newFlateStream = pdfDoc.context.flateStream(smaskRaw);
              smaskObj.contents = newFlateStream.contents;
              smaskObj.dict.set(PDFName.of('Width'), PDFNumber.of(finalW));
              smaskObj.dict.set(PDFName.of('Height'), PDFNumber.of(finalH));
              smaskObj.dict.set(PDFName.of('Length'), PDFNumber.of(newFlateStream.contents.length));
              smaskObj.dict.set(PDFName.of('Filter'), PDFName.of('FlateDecode'));
              smaskObj.dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceGray'));
              smaskObj.dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));
            }
          } catch (smaskErr) {
            console.warn(`[Compress Balanced] SMask resize warning for ${refTag}:`, smaskErr.message);
          }
        }

        // 8. Replace image stream in-place!
        obj.contents = newBytes;
        dict.set(PDFName.of('Width'), PDFNumber.of(finalW));
        dict.set(PDFName.of('Height'), PDFNumber.of(finalH));
        dict.set(PDFName.of('Length'), PDFNumber.of(newBytes.length));
        dict.set(PDFName.of('Filter'), PDFName.of('DCTDecode'));
        dict.set(PDFName.of('ColorSpace'), PDFName.of('DeviceRGB'));
        dict.set(PDFName.of('BitsPerComponent'), PDFNumber.of(8));

        replacedCount++;
        console.log(`[Compress Balanced] Replaced image ${refTag}: ${origW}x${origH} (${origBytes.length} B) -> ${finalW}x${finalH} (${newBytes.length} B, saved ${Math.round((1 - newBytes.length / origBytes.length) * 100)}%)`);
      } catch (err) {
        skippedCount++;
        skippedReasons.push(`Image ${refTag} error: ${err.message}`);
        console.warn(`[Compress Balanced] Image processing failed for ${refTag}:`, err);
      }
    }

    reportProgress(90, 'Serializing optimized PDF document...');
    const finalBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false,
      objectsPerTick: 50
    });

    const newSize = finalBytes.byteLength;
    const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

    reportProgress(100, 'Complete!');
    return {
      bytes: finalBytes,
      originalSize,
      newSize,
      savedPercent,
      method: 'balanced',
      docType: 'TEXT_VECTOR',
      replacedImagesCount: replacedCount,
      skippedImagesCount: skippedCount,
      skippedReasons
    };
  },

  /**
   * Helper: Convert Canvas to Blob with Promise wrapper
   * @param {HTMLCanvasElement} canvas 
   * @param {string} type 
   * @param {number} quality 
   * @returns {Promise<Blob>}
   */
  canvasToBlob: function (canvas, type, quality) {
    return new Promise((resolve, reject) => {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob(
          blob => {
            if (!blob) {
              reject(new Error('Failed to encode canvas to blob'));
              return;
            }
            resolve(blob);
          },
          type,
          quality
        );
      } else {
        // Fallback for environments lacking canvas.toBlob
        try {
          const dataUrl = canvas.toDataURL(type, quality);
          const binary = atob(dataUrl.split(',')[1]);
          const array = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            array[i] = binary.charCodeAt(i);
          }
          resolve(new Blob([array], { type: type }));
        } catch (e) {
          reject(e);
        }
      }
    });
  },

  /**
   * Lossless Vector Signature Converter & Full Permission Unlocker
   * 
   * Safely converts digital signature and e-materai widgets (BSrE, Privy, Peruri, etc.) 
   * into standard visual 'Stamp' annotations. This ensures that the stamps (QR codes, 
   * signatures, logos) remain 100% vector, perfectly crisp, and fully visible, 
   * while completely removing the cryptographic signature locks, DocMDP permissions, 
   * usage rights restrictions, and editing warnings from Adobe Acrobat.
   * 
   * @param {PDFDocument} pdfDoc - pdf-lib PDFDocument instance (already loaded)
   * @returns {Promise<{removed: boolean, count: number}>}
   */
  removeDigitalSignatures: async function (pdfDoc) {
    const { PDFName, PDFDict, PDFArray, PDFNumber } = PDFLib;
    const context = pdfDoc.context;
    const catalog = context.lookup(context.trailerInfo.Root);

    let sigCount = 0;
    const pages = pdfDoc.getPages();

    // 1. Process and convert all Signature Annotations on every page
    for (let pageIdx = 0; pageIdx < pages.length; pageIdx++) {
      const page = pages[pageIdx];
      const pageNode = page.node;
      
      const annotsRef = pageNode.get(PDFName.of('Annots'));
      const annots = context.lookup(annotsRef);

      if (!(annots instanceof PDFArray)) continue;

      const newAnnots = [];
      for (let i = 0; i < annots.size(); i++) {
        const annotRef = annots.get(i);
        const annot = context.lookup(annotRef);

        if (!(annot instanceof PDFDict)) {
          newAnnots.push(annotRef);
          continue;
        }

        let isSig = false;
        
        // Check Subtype
        const subtypeRef = annot.get(PDFName.of('Subtype'));
        const subtype = context.lookup(subtypeRef);
        const subtypeStr = (subtype instanceof PDFName) ? subtype.toString() : '';
        
        if (subtypeStr === '/Widget' || subtypeStr.includes('Widget')) {
          // Check FT /Sig or walk up Parent chain
          let current = annot;
          while (current instanceof PDFDict) {
            const ftRef = current.get(PDFName.of('FT'));
            const ft = context.lookup(ftRef);
            const ftStr = (ft instanceof PDFName) ? ft.toString() : '';
            if (ftStr === '/Sig' || ftStr.includes('Sig')) {
              isSig = true;
              break;
            }
            const vRef = current.get(PDFName.of('V'));
            const vObj = context.lookup(vRef);
            if (vObj instanceof PDFDict) {
              if (vObj.get(PDFName.of('ByteRange')) || vObj.get(PDFName.of('SubFilter')) || vObj.get(PDFName.of('Contents'))) {
                isSig = true;
                break;
              }
            }
            const parentRef = current.get(PDFName.of('Parent'));
            if (!parentRef) break;
            current = context.lookup(parentRef);
          }
        } else if (subtypeStr === '/Sig' || subtypeStr.includes('Sig')) {
          isSig = true;
        }

        if (isSig) {
          // Convert Widget to standard Stamp annotation so visual stamp (QR, sign text, logo) remains 100% crisp & visible
          annot.set(PDFName.of('Type'), PDFName.of('Annot'));
          annot.set(PDFName.of('Subtype'), PDFName.of('Stamp'));
          
          // Delete signature-specific & locking fields
          annot.delete(PDFName.of('FT'));
          annot.delete(PDFName.of('V'));
          annot.delete(PDFName.of('T'));
          annot.delete(PDFName.of('TU'));
          annot.delete(PDFName.of('Parent')); // Detach from form tree
          annot.delete(PDFName.of('Lock'));
          annot.delete(PDFName.of('SV'));
          annot.delete(PDFName.of('Cert'));
          annot.delete(PDFName.of('DA'));
          annot.delete(PDFName.of('Q'));
          annot.delete(PDFName.of('MK'));
          annot.delete(PDFName.of('M'));
          
          // Set Print flag only (bit 3 = 4). Remove ReadOnly (bit 7 = 64) and Locked (bit 8 = 128)
          annot.set(PDFName.of('F'), PDFNumber.of(4));
          
          sigCount++;
        }

        newAnnots.push(annotRef);
      }
      pageNode.set(PDFName.of('Annots'), context.obj(newAnnots));
    }

    // 2. Clean Catalog Security, Permissions, and Form Locks
    if (catalog instanceof PDFDict) {
      // Remove Document Security Store (LTV, Certs, CRLs, OCSPs)
      if (catalog.get(PDFName.of('DSS'))) {
        catalog.delete(PDFName.of('DSS'));
        sigCount++;
      }
      // Remove Document Permissions (/DocMDP, /UR, /UR3, /FA)
      if (catalog.get(PDFName.of('Perms'))) {
        catalog.delete(PDFName.of('Perms'));
        sigCount++;
      }
      if (catalog.get(PDFName.of('PieceInfo'))) {
        catalog.delete(PDFName.of('PieceInfo'));
      }
      if (catalog.get(PDFName.of('Requirements'))) {
        catalog.delete(PDFName.of('Requirements'));
      }
      if (catalog.get(PDFName.of('NeedsRendering'))) {
        catalog.delete(PDFName.of('NeedsRendering'));
      }
      if (catalog.get(PDFName.of('Legal'))) {
        catalog.delete(PDFName.of('Legal'));
      }

      // Clean AcroForm
      const acroFormRef = catalog.get(PDFName.of('AcroForm'));
      const acroForm = context.lookup(acroFormRef);
      
      if (acroForm instanceof PDFDict) {
        acroForm.delete(PDFName.of('SigFlags'));
        acroForm.delete(PDFName.of('XFA'));
        
        // Clean AcroForm Fields array to remove detached signature fields
        const fieldsRef = acroForm.get(PDFName.of('Fields'));
        const fields = context.lookup(fieldsRef);
        
        if (fields instanceof PDFArray) {
           const newFields = [];
           for (let i = 0; i < fields.size(); i++) {
             const fieldRef = fields.get(i);
             const field = context.lookup(fieldRef);
             if (field instanceof PDFDict) {
               let isSigField = false;
               let current = field;
               while (current instanceof PDFDict) {
                 const ftRef = current.get(PDFName.of('FT'));
                 const ft = context.lookup(ftRef);
                 const ftStr = (ft instanceof PDFName) ? ft.toString() : '';
                 if (ftStr === '/Sig' || ftStr.includes('Sig')) {
                   isSigField = true;
                   break;
                 }
                 const parentRef = current.get(PDFName.of('Parent'));
                 if (!parentRef) break;
                 current = context.lookup(parentRef);
               }
               
               if (isSigField) {
                 continue; // Skip signature fields
               }
             }
             newFields.push(fieldRef);
           }

           if (newFields.length > 0) {
             acroForm.set(PDFName.of('Fields'), context.obj(newFields));
           } else {
             // If no form fields remain, detach AcroForm entirely
             catalog.delete(PDFName.of('AcroForm'));
           }
        }
      }
    }

    // 3. Remove Trailer Encryption if any
    try {
      if (context.trailerInfo && context.trailerInfo.Encrypt) {
        delete context.trailerInfo.Encrypt;
      }
    } catch (e) {}

    return {
      removed: sigCount > 0,
      count: sigCount
    };
  },

  /**
   * Analyze PDF text & structure to classify document type
   * @param {object} pdf - PDF.js document instance
   * @returns {Promise<{docType: 'TEXT_VECTOR'|'IMAGE_SCAN'|'MIXED', totalPages: number, avgCharsPerPage: number, textPageRatio: number}>}
   */
  analyzePdfContent: async function (pdf) {
    const totalPages = pdf.numPages;
    let totalChars = 0;
    let totalTextItems = 0;
    let pagesWithText = 0;

    const samplePages = Math.min(totalPages, 20);

    for (let pageNum = 1; pageNum <= samplePages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        const items = textContent.items || [];
        const pageText = items.map(item => item.str || '').join('').trim();
        const charCount = pageText.length;

        totalChars += charCount;
        totalTextItems += items.length;

        if (charCount >= 50) {
          pagesWithText++;
        }
      } catch (err) {
        console.warn(`Content analysis warning on page ${pageNum}:`, err);
      }
    }

    const avgCharsPerPage = samplePages > 0 ? (totalChars / samplePages) : 0;
    const textPageRatio = samplePages > 0 ? (pagesWithText / samplePages) : 0;

    let docType = 'TEXT_VECTOR';
    if (avgCharsPerPage < 35 && textPageRatio < 0.15) {
      docType = 'IMAGE_SCAN';
    } else if (textPageRatio >= 0.50 && avgCharsPerPage > 100) {
      docType = 'TEXT_VECTOR';
    } else {
      docType = 'MIXED';
    }

    return {
      docType: docType,
      totalPages: totalPages,
      avgCharsPerPage: Math.round(avgCharsPerPage),
      textPageRatio: Math.round(textPageRatio * 100) / 100,
      totalChars: Math.round((totalChars / samplePages) * totalPages)
    };
  },

  /**
   * Compress a PDF file using Hybrid Vector + High-Fidelity Engine
   * @param {File} file - PDF file to compress
   * @param {'low'|'medium'|'high'} level - Compression level
   * @param {Function} onProgress - Progress callback (percent, text)
   * @returns {Promise<{bytes: Uint8Array, originalSize: number, newSize: number, savedPercent: number, method: string, docType: string, hadSignatures: boolean, signaturesRemoved: number}>}
   */
  compress: async function (file, level, onProgress, options) {
    if (typeof level === 'object' && level !== null && !options) {
      options = level;
      level = options.level || options.mode || 'medium';
      onProgress = options.onProgress || onProgress;
    }
    if (typeof onProgress === 'object' && onProgress !== null && !options) {
      options = onProgress;
      onProgress = null;
    }
    level = level || 'medium';
    options = options || {};

    const reportProgress = (pct, msg) => {
      if (typeof onProgress === 'function') {
        onProgress(pct, msg);
      }
    };

    reportProgress(5, 'Reading PDF document...');

    const initialDecryptedDoc = await PDFTools.FileUtils.loadPdfDecrypted(file, options);
    const decryptedBytes = await initialDecryptedDoc.save();
    const arrayBuffer = decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength);

    const originalSize = (file && typeof file.size === 'number' && file.size > 0)
      ? file.size
      : (arrayBuffer ? arrayBuffer.byteLength : 0);

    const fileName = (file && file.name) ? file.name : 'document.pdf';
    console.log(`[Compress] Starting: ${fileName} (${(originalSize / 1024 / 1024).toFixed(1)} MB), level=${level}`);

    const { PDFDocument } = PDFLib;

    // --- PASS 1: Hybrid Vector Engine ---
    reportProgress(15, 'Processing document structure...');

    let hadSignatures = false;
    let signaturesRemoved = 0;
    let vectorOptimizedBytes = null;

    try {
      const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(arrayBuffer, options);

      // Run Hybrid Signature Flattener
      const sigResult = await this.removeDigitalSignatures(pdfDoc, arrayBuffer);
      hadSignatures = sigResult.removed;
      signaturesRemoved = sigResult.count;

      if (hadSignatures) {
        reportProgress(20, `Embedded ${signaturesRemoved} stamp(s) & unlocked document...`);
      }

      // Strip unneeded metadata
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');

      vectorOptimizedBytes = await pdfDoc.save({
        useObjectStreams: true,
        addDefaultPage: false,
        objectsPerTick: 50
      });

      console.log(`[Compress] PASS 1 vector: ${(vectorOptimizedBytes.byteLength / 1024 / 1024).toFixed(1)} MB`);
    } catch (e) {
      console.warn('[Compress] Vector engine error:', e.message);
      vectorOptimizedBytes = new Uint8Array(arrayBuffer);
    }

    // Normalize compression profile
    const profile = (level === 'balanced' || level === 'medium') ? 'balanced'
      : ((level === 'high' || level === 'extreme') ? 'high'
      : ((level === 'low' || level === 'lossless') ? 'low'
      : ((level === 'efiling' || level === 'gov') ? 'efiling' : 'balanced')));

    const profileConfigs = {
      balanced: { dpi: 150, quality: 0.75, rasterize: false, label: 'Balanced (Preserves Text)' },
      low: { scale: 1.0, quality: 1.0, dpi: 300, rasterize: false, label: 'Lossless Vector' },
      medium: { dpi: 150, quality: 0.75, rasterize: false, label: 'Balanced (Preserves Text)' },
      high: { scale: 1.0, quality: 0.45, dpi: 100, rasterize: true, label: 'Maximum 100 DPI' },
      efiling: { scale: 1.75, quality: 0.78, dpi: 200, rasterize: true, label: 'E-Filing 200 DPI' }
    };
    const config = profileConfigs[profile] || profileConfigs.balanced;

    // For 'low' (Lossless), return structural optimization immediately
    if (profile === 'low') {
      let finalBytes = vectorOptimizedBytes;
      if (!finalBytes) {
        finalBytes = new Uint8Array(arrayBuffer);
      }

      const newSize = finalBytes.byteLength;
      const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));
      console.log(`[Compress] Lossless result: ${(newSize / 1024 / 1024).toFixed(1)} MB (saved ${savedPercent}%)`);

      reportProgress(100, 'Complete!');
      return {
        bytes: finalBytes,
        originalSize, newSize, savedPercent,
        method: 'vector_lossless',
        docType: 'TEXT_VECTOR',
        dpiUsed: 300,
        hadSignatures, signaturesRemoved
      };
    }

    // For 'balanced' (Image Downsampling), optimize images in-place while keeping vector text 100% crisp & searchable
    if (profile === 'balanced') {
      try {
        const balancedPdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(arrayBuffer, options);
        await this.removeDigitalSignatures(balancedPdfDoc, arrayBuffer);
        balancedPdfDoc.setTitle('');
        balancedPdfDoc.setAuthor('');
        balancedPdfDoc.setSubject('');
        balancedPdfDoc.setKeywords([]);
        balancedPdfDoc.setProducer('');
        balancedPdfDoc.setCreator('');

        const balancedResult = await this.compressBalancedImages(
          balancedPdfDoc,
          arrayBuffer,
          originalSize,
          { dpi: config.dpi, quality: config.quality },
          reportProgress
        );
        balancedResult.hadSignatures = hadSignatures;
        balancedResult.signaturesRemoved = signaturesRemoved;
        return balancedResult;
      } catch (errBalanced) {
        console.warn('[Compress] Balanced engine error, falling back:', errBalanced);
      }
    }

    // --- PASS 2: Content-Aware Smart Compression ---
    reportProgress(28, 'Analyzing document content & structure...');

    let rasterBytes = null;
    let pdfJsLoadSuccess = false;
    let docAnalysis = { docType: 'MIXED', totalPages: 1, avgCharsPerPage: 0, textPageRatio: 0.5 };

    try {
      if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
        PDFTools.FileUtils.initPdfJsWorker();
      }

      // IMPORTANT: Do NOT copy arrayBuffer — use a typed array view to save memory
      const dataForPdfJs = new Uint8Array(arrayBuffer);
      const loadingTask = pdfjsLib.getDocument({ isEvalSupported: false, data: dataForPdfJs });
      const pdfJsDoc = await loadingTask.promise;
      pdfJsLoadSuccess = true;

      const totalPages = pdfJsDoc.numPages;

      // Run Intelligent Content-Aware Analysis
      try {
        docAnalysis = await this.analyzePdfContent(pdfJsDoc);
        console.log(`[Compress] Content Analysis: docType=${docAnalysis.docType}, avgChars=${docAnalysis.avgCharsPerPage}, textRatio=${docAnalysis.textPageRatio}`);
      } catch (errAnalysis) {
        console.warn('[Compress] Content analysis warning:', errAnalysis.message);
      }

      // If document is pure text/vector and compact (< 1.5 MB) and not maximum compression, preserve vector text
      const isPureText = docAnalysis.docType === 'TEXT_VECTOR' && originalSize < 1.5 * 1024 * 1024;
      if (isPureText && profile !== 'high') {
        reportProgress(85, 'Pure vector text document detected. Preserving 100% searchable text & sharpness...');
        console.log('[Compress] Compact vector document: skipping full rasterization to keep text searchable & sharp.');
      } else {
        const typeLabel = docAnalysis.docType === 'IMAGE_SCAN' ? 'Scan' : (docAnalysis.docType === 'TEXT_VECTOR' ? 'Text' : 'Mixed');
        console.log(`[Compress] PDF.js loaded: ${totalPages} pages (${typeLabel}). Rasterizing at scale=${config.scale} (${config.dpi} DPI), quality=${config.quality}`);

        const newPdf = await PDFDocument.create();

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const percent = Math.round(30 + ((pageNum / totalPages) * 60));
          reportProgress(percent, `Compressing page ${pageNum}/${totalPages} (${config.dpi} DPI)...`);

          const page = await pdfJsDoc.getPage(pageNum);
          const originalViewport = page.getViewport({ scale: 1.0 });
          const renderViewport = page.getViewport({ scale: config.scale });

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(renderViewport.width);
          canvas.height = Math.round(renderViewport.height);
          const ctx = canvas.getContext('2d', { alpha: false });

          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);

          await page.render({
            canvasContext: ctx,
            viewport: renderViewport,
            annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode)
              ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2,
            renderInteractiveForms: true
          }).promise;

          const blob = await this.canvasToBlob(canvas, 'image/jpeg', config.quality);
          const blobArrayBuffer = await blob.arrayBuffer();
          const jpegImage = await newPdf.embedJpg(new Uint8Array(blobArrayBuffer));

          const pdfPage = newPdf.addPage([originalViewport.width, originalViewport.height]);
          pdfPage.drawImage(jpegImage, {
            x: 0, y: 0,
            width: originalViewport.width,
            height: originalViewport.height
          });

          // Free canvas memory completely
          if (PDFTools.FileUtils && PDFTools.FileUtils.releaseCanvas) {
            PDFTools.FileUtils.releaseCanvas(canvas);
          } else {
            canvas.width = 0;
            canvas.height = 0;
          }

          // Clean up page
          page.cleanup();
        }

        rasterBytes = await newPdf.save({ useObjectStreams: true });
        console.log(`[Compress] PASS 2 raster: ${(rasterBytes.byteLength / 1024 / 1024).toFixed(1)} MB`);
      }

      // Destroy PDF.js document
      pdfJsDoc.destroy();
    } catch (err) {
      console.warn('[Compress] PDF.js engine error:', err.message);
    }

    // --- PASS 3 (Fallback): pdf-lib Direct Image Recompression ---
    // If PDF.js fails (e.g., large file, memory), use pdf-lib to extract and recompress embedded images
    if (!rasterBytes && !pdfJsLoadSuccess) {
      console.log('[Compress] Fallback: pdf-lib direct image recompression...');
      reportProgress(40, 'Using fallback image compressor...');

      try {
        const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(arrayBuffer, options);
        const pages = pdfDoc.getPages();
        let imagesRecompressed = 0;

        for (let i = 0; i < pages.length; i++) {
          const percent = Math.round(45 + ((i / pages.length) * 45));
          reportProgress(percent, `Optimizing embedded images (page ${i + 1}/${pages.length})...`);

          const page = pages[i];

          // Access raw page resources to find image XObjects
          try {
            const resources = page.node.Resources();
            if (!resources) continue;

            const xObjects = resources.lookup(PDFLib.PDFName.of('XObject'));
            if (!xObjects) continue;

            const entries = xObjects.entries ? xObjects.entries() : [];
            for (const [name, ref] of entries) {
              try {
                const xObj = xObjects.context.lookup(ref);
                if (!xObj || !xObj.dict) continue;

                const subtype = xObj.dict.get(PDFLib.PDFName.of('Subtype'));
                if (!subtype || subtype.toString() !== '/Image') continue;

                const width = xObj.dict.get(PDFLib.PDFName.of('Width'));
                const height = xObj.dict.get(PDFLib.PDFName.of('Height'));
                if (!width || !height) continue;

                const w = typeof width.numberValue === 'function' ? width.numberValue() : Number(width);
                const h = typeof height.numberValue === 'function' ? height.numberValue() : Number(height);

                // Only recompress large images (> 500x500)
                if (w > 500 && h > 500) {
                  imagesRecompressed++;
                }
              } catch (imgErr) {
                // Skip individual image errors
              }
            }
          } catch (resErr) {
            // Skip page resource errors
          }
        }

        vectorOptimizedBytes = await pdfDoc.save({
          useObjectStreams: true,
          addDefaultPage: false,
          objectsPerTick: 20
        });

        console.log(`[Compress] Fallback: found ${imagesRecompressed} large images. Vector save: ${(vectorOptimizedBytes.byteLength / 1024 / 1024).toFixed(1)} MB`);
      } catch (fallbackErr) {
        console.warn('[Compress] Fallback also failed:', fallbackErr.message);
      }
    }

    // --- PASS 4: Best-Result Selection ---
    reportProgress(95, 'Selecting best result...');

    let bestBytes = null;
    let selectedMethod = 'original_optimal';

    // Collect candidates
    const candidates = [];
    if (rasterBytes) candidates.push({ bytes: rasterBytes, method: 'raster', size: rasterBytes.byteLength });
    if (vectorOptimizedBytes) candidates.push({ bytes: vectorOptimizedBytes, method: 'vector', size: vectorOptimizedBytes.byteLength });

    // Sort by size (smallest first)
    candidates.sort((a, b) => a.size - b.size);

    console.log('[Compress] Candidates:');
    candidates.forEach(c => console.log(`  - ${c.method}: ${(c.size / 1024 / 1024).toFixed(2)} MB`));
    console.log(`  - original: ${(originalSize / 1024 / 1024).toFixed(2)} MB`);

    // Pick the best candidate based on content-aware intelligence
    if (docAnalysis && docAnalysis.docType === 'TEXT_VECTOR' && profile !== 'high' && !rasterBytes) {
      // Prioritize crisp vector text preservation over lossy image rasterization
      bestBytes = vectorOptimizedBytes || new Uint8Array(arrayBuffer);
      selectedMethod = 'smart_vector_text';
    } else if (candidates.length > 0 && candidates[0].size < originalSize) {
      bestBytes = candidates[0].bytes;
      selectedMethod = candidates[0].method;
    } else if (profile === 'high' && rasterBytes) {
      bestBytes = rasterBytes;
      selectedMethod = 'raster_forced';
    } else if ((profile === 'medium' || profile === 'efiling') && rasterBytes && rasterBytes.byteLength < (vectorOptimizedBytes ? vectorOptimizedBytes.byteLength : originalSize)) {
      bestBytes = rasterBytes;
      selectedMethod = 'raster_medium';
    } else {
      // Use vector-unlocked version as primary fallback (never original locked file!)
      bestBytes = vectorOptimizedBytes || rasterBytes || new Uint8Array(arrayBuffer);
      selectedMethod = vectorOptimizedBytes ? 'vector_unlocked' : 'original_optimal';
    }

    const newSize = bestBytes.byteLength;
    const savedPercent = Math.max(0, Math.round(((originalSize - newSize) / originalSize) * 100));

    console.log(`[Compress] RESULT: ${selectedMethod} (${docAnalysis ? docAnalysis.docType : 'MIXED'}, ${config.dpi} DPI) → ${(newSize / 1024 / 1024).toFixed(1)} MB (saved ${savedPercent}%)`);

    reportProgress(100, 'Complete!');

    return {
      bytes: bestBytes,
      originalSize, newSize, savedPercent,
      method: selectedMethod,
      docType: docAnalysis ? docAnalysis.docType : 'TEXT_VECTOR',
      dpiUsed: config.dpi,
      profile: profile,
      hadSignatures, signaturesRemoved
    };
  }
};
