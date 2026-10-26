/**
 * PDF Tools — Watermark PDF Core Logic
 * Adds customizable text or stamp watermarks to PDF pages
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Watermark = {
  /**
   * Validates and prepares an image file for watermarking.
   * - Decodes image data to guarantee validity (rejects fake files)
   * - Enforces maximum file size of 15 MB
   * - Converts WebP/BMP or formats requiring conversion to PNG via canvas
   * - Downscales image so longest side does not exceed 2000 px
   * - Preserves alpha transparency
   *
   * @param {File|Blob|Object} file - Image file or blob
   * @returns {Promise<{ bytes: Uint8Array, mime: string, width: number, height: number }>}
   */
  prepareImage: async function (file) {
    if (file && file.file) {
      file = file.file;
    }
    if (!file || typeof file.size !== 'number') {
      throw new Error('Berkas gambar tidak ditemukan atau tidak valid.');
    }

    // 1. Check file size limit: 15 MB
    const MAX_BYTES = 15 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      throw new Error(`Ukuran berkas (${(file.size / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimum 15 MB.`);
    }

    // 2. Decode verification: real image decoding, rejecting non-images or corrupted files
    let bitmap;
    let cleanupBitmap = false;
    try {
      if (typeof createImageBitmap === 'function') {
        bitmap = await createImageBitmap(file);
        cleanupBitmap = true;
      } else {
        bitmap = await new Promise((resolve, reject) => {
          const url = URL.createObjectURL(file);
          const img = new Image();
          img.onload = () => {
            URL.revokeObjectURL(url);
            resolve(img);
          };
          img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Decode error'));
          };
          img.src = url;
        });
      }
    } catch (err) {
      throw new Error('Berkas bukan merupakan format gambar yang valid atau data gambar rusak.');
    }

    const origWidth = bitmap.width;
    const origHeight = bitmap.height;
    if (!origWidth || !origHeight) {
      if (cleanupBitmap && bitmap.close) bitmap.close();
      throw new Error('Dimensi gambar tidak valid.');
    }

    // 3. Determine if downscaling is required (longest edge <= 2000 px)
    const MAX_DIMENSION = 2000;
    const longestSide = Math.max(origWidth, origHeight);
    const needsResize = longestSide > MAX_DIMENSION;

    let targetWidth = origWidth;
    let targetHeight = origHeight;
    if (needsResize) {
      const scaleRatio = MAX_DIMENSION / longestSide;
      targetWidth = Math.round(origWidth * scaleRatio);
      targetHeight = Math.round(origHeight * scaleRatio);
    }

    // 4. Check if format conversion is required:
    // WebP, BMP, or any resized image MUST be rendered via canvas to PNG preserving alpha
    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();
    const isWebP = fileType === 'image/webp' || fileName.endsWith('.webp');
    const isBmp = fileType === 'image/bmp' || fileName.endsWith('.bmp');
    const isJpeg = (fileType === 'image/jpeg' || fileType === 'image/jpg' || fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) && !isWebP && !isBmp;

    // If it's JPEG without resize, keep JPEG bytes
    if (isJpeg && !needsResize) {
      const buffer = await (file.arrayBuffer ? file.arrayBuffer() : PDFTools.FileUtils.readAsArrayBuffer(file));
      if (cleanupBitmap && bitmap.close) bitmap.close();
      return {
        bytes: new Uint8Array(buffer),
        mime: 'image/jpeg',
        width: origWidth,
        height: origHeight
      };
    }

    // Otherwise render to canvas to export as PNG (preserving alpha)
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, targetWidth, targetHeight);
    ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    if (cleanupBitmap && bitmap.close) {
      bitmap.close();
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const arrayBuffer = await blob.arrayBuffer();

    return {
      bytes: new Uint8Array(arrayBuffer),
      mime: 'image/png',
      width: targetWidth,
      height: targetHeight
    };
  },
  /**
   * Unified placement calculation for both text and image watermarks.
   * Takes into account page /Rotate, CropBox, item center-based rotation,
   * margins, and 9 standard positions plus tiling.
   *
   * @param {PDFPage} page - PDF-Lib page instance
   * @param {number} itemWidth - Width of the item in points
   * @param {number} itemHeight - Height of the item in points
   * @param {Object} options - Placement options
   * @returns {{ placements: Array<{x: number, y: number, rotate: number}>, x: number, y: number, rotate: number, visibleWidth: number, visibleHeight: number }}
   */
  computePlacement: function (page, itemWidth, itemHeight, options) {
    options = options || {};
    const margin = typeof options.margin === 'number' ? options.margin : 20;
    const tileGap = typeof options.tileGap === 'number' ? options.tileGap : 50;
    let position = options.position || 'center';
    let itemRotation = 0;
    if (options.rotation !== undefined && options.rotation !== null) {
      const parsedRot = typeof options.rotation === 'number' ? options.rotation : parseInt(options.rotation, 10);
      if (Number.isFinite(parsedRot)) {
        itemRotation = parsedRot;
      }
    } else if (position === 'diagonal') {
      itemRotation = 45;
    }

    // Handle legacy 'diagonal' preset as center
    if (position === 'diagonal') {
      position = 'center';
    }

    // 1. Resolve CropBox & MediaBox boundaries
    const cropBox = (page && typeof page.getCropBox === 'function')
      ? page.getCropBox()
      : { x: 0, y: 0, width: page.getSize().width, height: page.getSize().height };
    const cropX = cropBox.x || 0;
    const cropY = cropBox.y || 0;
    const cropW = cropBox.width || (page.getSize ? page.getSize().width : 600);
    const cropH = cropBox.height || (page.getSize ? page.getSize().height : 800);

    // 2. Resolve page rotation (0, 90, 180, 270)
    const pageRotation = page && page.getRotation ? ((page.getRotation().angle % 360) + 360) % 360 : 0;

    // Visible dimensions as seen in viewer
    let visibleWidth, visibleHeight;
    if (pageRotation === 90 || pageRotation === 270) {
      visibleWidth = cropH;
      visibleHeight = cropW;
    } else {
      visibleWidth = cropW;
      visibleHeight = cropH;
    }

    // Map visible Cartesian coordinate (vx: 0..visibleWidth from left, vy: 0..visibleHeight from bottom)
    // to raw PDF coordinates (pdfX, pdfY)
    function mapVisibleToPdf(vx, vy) {
      if (pageRotation === 0) return { x: cropX + vx, y: cropY + vy };
      if (pageRotation === 90) return { x: cropX + cropW - vy, y: cropY + vx };
      if (pageRotation === 180) return { x: cropX + cropW - vx, y: cropY + cropH - vy };
      if (pageRotation === 270) return { x: cropX + vy, y: cropY + cropH - vx };
      return { x: cropX + vx, y: cropY + vy };
    }

    // Effective rotation in raw PDF space: counter-act page rotation to orient to visible page
    const effectiveAngle = ((itemRotation + pageRotation) % 360 + 360) % 360;
    const rad = (effectiveAngle * Math.PI) / 180;

    // Center offset vector: when rotating around center (cx, cy),
    // origin (x, y) = center - (w/2 * cos - h/2 * sin, w/2 * sin + h/2 * cos)
    const dx = (itemWidth / 2) * Math.cos(rad) - (itemHeight / 2) * Math.sin(rad);
    const dy = (itemWidth / 2) * Math.sin(rad) + (itemHeight / 2) * Math.cos(rad);

    function calcOriginFromVisibleCenter(centerVx, centerVy) {
      const pdfCenter = mapVisibleToPdf(centerVx, centerVy);
      return {
        x: pdfCenter.x - dx,
        y: pdfCenter.y - dy,
        rotate: effectiveAngle
      };
    }

    // Tile mode: repeat item in grid across visible page
    if (position === 'tile') {
      const stepX = itemWidth + tileGap;
      const stepY = itemHeight + tileGap;
      const cols = Math.max(1, Math.floor((visibleWidth - 2 * margin) / stepX));
      const rows = Math.max(1, Math.floor((visibleHeight - 2 * margin) / stepY));
      const startX = (visibleWidth - (cols - 1) * stepX) / 2;
      const startY = (visibleHeight - (rows - 1) * stepY) / 2;

      const placements = [];
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const cvx = startX + c * stepX;
          const cvy = startY + r * stepY;
          placements.push(calcOriginFromVisibleCenter(cvx, cvy));
        }
      }
      return {
        placements,
        x: placements[0].x,
        y: placements[0].y,
        rotate: effectiveAngle,
        visibleWidth,
        visibleHeight
      };
    }

    // 9 standard positions:
    // Horizontal alignment
    let centerVx = visibleWidth / 2;
    if (position.includes('left')) {
      centerVx = margin + itemWidth / 2;
    } else if (position.includes('right')) {
      centerVx = visibleWidth - margin - itemWidth / 2;
    }

    // Vertical alignment (vy=0 is bottom, vy=visibleHeight is top)
    let centerVy = visibleHeight / 2;
    if (position.startsWith('top')) {
      centerVy = visibleHeight - margin - itemHeight / 2;
    } else if (position.startsWith('bottom')) {
      centerVy = margin + itemHeight / 2;
    }

    const singlePlacement = calcOriginFromVisibleCenter(centerVx, centerVy);
    return {
      placements: [singlePlacement],
      x: singlePlacement.x,
      y: singlePlacement.y,
      rotate: singlePlacement.rotate,
      visibleWidth,
      visibleHeight
    };
  },

  /**
   * Parse pages option into a sorted array of 0-based page indices.
   * Supports 'all', 'first', number arrays (0-based), and range strings (1-based, e.g. "1, 3-5").
   *
   * @param {string|number[]|'all'|'first'|null|undefined} pagesOption
   * @param {number} totalPages
   * @returns {number[]} 0-based page indices to process
   */
  parsePageRange: function (pagesOption, totalPages) {
    if (!totalPages || totalPages < 1) {
      throw new Error('Total halaman dokumen tidak valid.');
    }

    if (pagesOption === undefined || pagesOption === null || pagesOption === 'all') {
      const all = [];
      for (let i = 0; i < totalPages; i++) all.push(i);
      return all;
    }

    if (pagesOption === 'first') {
      return [0];
    }

    if (Array.isArray(pagesOption)) {
      if (pagesOption.length === 0) {
        throw new Error('Daftar halaman tidak boleh kosong.');
      }
      const indices = [];
      for (const item of pagesOption) {
        const idx = typeof item === 'number' ? item : parseInt(item, 10);
        if (!Number.isInteger(idx) || idx < 0 || idx >= totalPages) {
          throw new Error(`Indeks halaman ${item} tidak valid (total ${totalPages} halaman).`);
        }
        indices.push(idx);
      }
      return Array.from(new Set(indices)).sort((a, b) => a - b);
    }

    if (typeof pagesOption === 'string') {
      const str = pagesOption.trim();
      if (!str) {
        throw new Error('Rentang halaman tidak boleh kosong.');
      }
      if (str.toLowerCase() === 'all') {
        const all = [];
        for (let i = 0; i < totalPages; i++) all.push(i);
        return all;
      }
      if (str.toLowerCase() === 'first') {
        return [0];
      }

      // Check for valid characters: only digits, commas, hyphens, and whitespace
      if (!/^[0-9,\-\s]+$/.test(str)) {
        throw new Error(`Rentang halaman mengandung karakter tidak valid: "${str}". Format yang benar: "1, 3-5".`);
      }

      const parts = str.split(',').map(p => p.trim()).filter(Boolean);
      if (parts.length === 0) {
        throw new Error('Rentang halaman tidak boleh kosong.');
      }

      const indices = [];
      for (const part of parts) {
        if (part.includes('-')) {
          const rangeParts = part.split('-').map(s => s.trim());
          if (rangeParts.length !== 2 || !rangeParts[0] || !rangeParts[1]) {
            throw new Error(`Format rentang halaman tidak valid: "${part}". Contoh: "1-5".`);
          }
          const start = parseInt(rangeParts[0], 10);
          const end = parseInt(rangeParts[1], 10);
          if (!Number.isInteger(start) || !Number.isInteger(end)) {
            throw new Error(`Nomor halaman pada rentang "${part}" harus berupa angka bulat.`);
          }
          if (start < 1) {
            throw new Error(`Nomor halaman awal rentang (${start}) harus minimal 1.`);
          }
          if (start > end) {
            throw new Error(`Rentang halaman tidak valid: awal rentang (${start}) lebih besar dari akhir rentang (${end}).`);
          }
          if (end > totalPages) {
            throw new Error(`Halaman ${end} melebihi jumlah halaman dokumen (${totalPages}).`);
          }
          for (let p = start; p <= end; p++) {
            indices.push(p - 1);
          }
        } else {
          const pageNum = parseInt(part, 10);
          if (!Number.isInteger(pageNum)) {
            throw new Error(`Nomor halaman "${part}" tidak valid.`);
          }
          if (pageNum < 1) {
            throw new Error(`Nomor halaman (${pageNum}) harus minimal 1.`);
          }
          if (pageNum > totalPages) {
            throw new Error(`Halaman ${pageNum} melebihi jumlah halaman dokumen (${totalPages}).`);
          }
          indices.push(pageNum - 1);
        }
      }

      const uniqueSorted = Array.from(new Set(indices)).sort((a, b) => a - b);
      if (uniqueSorted.length === 0) {
        throw new Error('Rentang halaman tidak valid.');
      }
      return uniqueSorted;
    }

    throw new Error('Format opsi halaman tidak didukung.');
  },

  /**
   * Add text or image watermark to a PDF
   * @param {File|Object} file - PDF file or wrapper
   * @param {Object} options - Watermark settings
   *   options.type: 'text' (default) | 'image'
   *   options.image: { bytes, mime } or raw buffer
   *   options.scale: 0.05-1.0 (fraction of visible page width, default 0.3)
   *   options.margin: margin in points (default 20)
   *   options.position: 'center' | 'top-left' | 'top-center' | 'top-right' | 'middle-left' | 'middle-right' | 'bottom-left' | 'bottom-center' | 'bottom-right' | 'tile' | 'diagonal'
   *   options.tileGap: gap between tiles in points (default 50)
   *   options.opacity: 0.0-1.0 (default 0.3)
   *   options.rotation: angle in degrees (default 0 or 45 for diagonal)
   *   options.pages: 'all' (default) | 'first' | [0, 1] | '1,3-5'
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Uint8Array>}
   */
  applyWatermark: async function (file, options, onProgress) {
    if (typeof onProgress === 'object' && onProgress !== null) {
      options = Object.assign({}, onProgress, options);
      onProgress = options.onProgress;
    }
    options = options || {};
    const type = options.type === 'image' ? 'image' : 'text';
    const text = options.text || 'CONFIDENTIAL';
    const fontSize = parseInt(options.fontSize, 10) || 48;
    let opacity = 0.30;
    if (options.opacity !== undefined && options.opacity !== null) {
      const parsedOp = typeof options.opacity === 'number' ? options.opacity : parseFloat(options.opacity);
      if (Number.isFinite(parsedOp)) {
        opacity = parsedOp;
      }
    }

    let rotationAngle = 0;
    if (options.rotation !== undefined && options.rotation !== null) {
      const parsedRot = typeof options.rotation === 'number' ? options.rotation : parseInt(options.rotation, 10);
      if (Number.isFinite(parsedRot)) {
        rotationAngle = parsedRot;
      }
    } else if (options.position === 'diagonal') {
      rotationAngle = 45;
    }
    const position = options.position || 'center';
    const colorHex = options.color || '#e74c3c';
    const margin = typeof options.margin === 'number' ? options.margin : 20;
    const tileGap = typeof options.tileGap === 'number' ? options.tileGap : 50;

    let scale = typeof options.scale === 'number' ? options.scale : 0.30;
    if (scale < 0.05) scale = 0.05;
    if (scale > 1.0) scale = 1.0;

    // Parse hex color to 0..1 RGB for pdf-lib
    function hexToRgb(hex) {
      hex = hex.replace('#', '');
      if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
      const r = parseInt(hex.substring(0, 2), 16) / 255;
      const g = parseInt(hex.substring(2, 4), 16) / 255;
      const b = parseInt(hex.substring(4, 6), 16) / 255;
      return { r, g, b };
    }

    const { r, g, b } = hexToRgb(colorHex);

    if (typeof onProgress === 'function') {
      onProgress(15, 'Loading PDF document for watermarking...');
    }

    if (file && file.file) {
      file = file.file;
    }

    const { StandardFonts, rgb, degrees } = PDFLib;
    const loadDoc = (PDFTools.FileUtils && typeof PDFTools.FileUtils.loadPdfDecrypted === 'function')
      ? PDFTools.FileUtils.loadPdfDecrypted.bind(PDFTools.FileUtils)
      : (function () {
          if (typeof require !== 'function') return null;
          try { return require('../utils/file-utils.js').loadPdfDecrypted; } catch (e) {
            try { return require('../../js/utils/file-utils.js').loadPdfDecrypted; } catch (e2) {
              try { return require('./js/utils/file-utils.js').loadPdfDecrypted; } catch (e3) { return null; }
            }
          }
        })();
    const pdfDoc = await loadDoc(file, options);

    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {}
    }

    let font = null;
    let embeddedImage = null;
    let imgAspectRatio = 1.0;

    // Single embedding per document: embed font or image once before page loop
    if (type === 'image') {
      if (!options.image) {
        throw new Error('Watermark image is required when type is "image"');
      }
      let rawBytes = options.image.bytes || options.image;
      if (rawBytes instanceof ArrayBuffer) {
        rawBytes = new Uint8Array(rawBytes);
      } else if (rawBytes && rawBytes.buffer && !(rawBytes instanceof Uint8Array)) {
        rawBytes = new Uint8Array(rawBytes.buffer, rawBytes.byteOffset, rawBytes.byteLength);
      }

      const mime = (options.image && options.image.mime) || '';
      const isJpg = mime === 'image/jpeg' || mime === 'image/jpg' ||
        (rawBytes && rawBytes.length >= 3 && rawBytes[0] === 0xFF && rawBytes[1] === 0xD8 && rawBytes[2] === 0xFF);

      embeddedImage = isJpg ? await pdfDoc.embedJpg(rawBytes) : await pdfDoc.embedPng(rawBytes);
      const imgSize = embeddedImage.size();
      imgAspectRatio = imgSize.height / imgSize.width;
    } else {
      font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;
    const targetIndices = PDFTools.Watermark.parsePageRange(options.pages, totalPages);

    for (let idx = 0; idx < targetIndices.length; idx++) {
      const i = targetIndices[idx];
      if (typeof onProgress === 'function') {
        const percent = Math.round(15 + (((idx + 1) / targetIndices.length) * 75));
        onProgress(percent, `Applying watermark to page ${i + 1} of ${totalPages}...`);
      }

      const page = pages[i];

      if (type === 'image') {
        // Resolve visible dimensions to scale image proportionally
        const cropBox = (page && typeof page.getCropBox === 'function')
          ? page.getCropBox()
          : { x: 0, y: 0, width: page.getSize().width, height: page.getSize().height };
        const cropW = cropBox.width || (page.getSize ? page.getSize().width : 600);
        const cropH = cropBox.height || (page.getSize ? page.getSize().height : 800);
        const pageRotation = page && page.getRotation ? ((page.getRotation().angle % 360) + 360) % 360 : 0;
        const visibleWidth = (pageRotation === 90 || pageRotation === 270) ? cropH : cropW;

        const targetWidth = visibleWidth * scale;
        const targetHeight = targetWidth * imgAspectRatio;

        const placement = PDFTools.Watermark.computePlacement(page, targetWidth, targetHeight, {
          position,
          rotation: rotationAngle,
          margin,
          tileGap
        });

        for (const pl of placement.placements) {
          page.drawImage(embeddedImage, {
            x: pl.x,
            y: pl.y,
            width: targetWidth,
            height: targetHeight,
            opacity: opacity,
            rotate: degrees(pl.rotate)
          });
        }
      } else {
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const textHeight = font.heightAtSize(fontSize);

        const placement = PDFTools.Watermark.computePlacement(page, textWidth, textHeight, {
          position,
          rotation: rotationAngle,
          margin,
          tileGap
        });

        for (const pl of placement.placements) {
          page.drawText(text, {
            x: pl.x,
            y: pl.y,
            size: fontSize,
            font: font,
            color: rgb(r, g, b),
            opacity: opacity,
            rotate: degrees(pl.rotate)
          });
        }
      }
    }

    if (typeof onProgress === 'function') {
      onProgress(95, 'Saving watermarked document...');
    }

    const pdfBytes = await pdfDoc.save();

    if (typeof onProgress === 'function') {
      onProgress(100, 'Complete!');
    }

    return pdfBytes;
  }
};
