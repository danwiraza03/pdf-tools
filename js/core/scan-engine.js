/**
 * PDF Tools — Scan to PDF Engine & Perspective Homography
 * 100% Client-Side, Zero Server Transfer, Zero Cloud.
 *
 * Implements:
 * 1. Perspective Homography (Projective Transform) without external libraries like OpenCV.
 * 2. Bilinear interpolation for smooth rectified image quality.
 * 3. Document Filters: Original, Grayscale, and B&W (Adaptive Thresholding via Integral Image).
 * 4. PDF Generation via pdf-lib with resolution bounding (max 2048px) and paper size options.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PDFTools = root.PDFTools || {};
    root.PDFTools.ScanEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /**
   * Euclidean distance between two points
   */
  function dist(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate destination width and height from 4 quad corners:
   * [TL, TR, BR, BL]
   */
  function calculateDimensions(corners) {
    const [tl, tr, br, bl] = corners;
    const topW = dist(tl, tr);
    const botW = dist(bl, br);
    const leftH = dist(tl, bl);
    const rightH = dist(tr, br);

    const w = Math.max(10, Math.round(Math.max(topW, botW)));
    const h = Math.max(10, Math.round(Math.max(leftH, rightH)));
    return { width: w, height: h };
  }

  /**
   * Compute closed-form Homography coefficients mapping
   * normalized destination coordinates (u, v) in [0, 1]^2 to source coordinates (x, y).
   *
   * Formula:
   * x = (a*u + b*v + c) / (g*u + h*v + 1)
   * y = (d*u + e*v + f) / (g*u + h*v + 1)
   */
  function computeSquareToQuadCoefficients(tl, tr, br, bl) {
    const dx1 = tr.x - br.x;
    const dx2 = bl.x - br.x;
    const sx = tl.x - tr.x + br.x - bl.x;

    const dy1 = tr.y - br.y;
    const dy2 = bl.y - br.y;
    const sy = tl.y - tr.y + br.y - bl.y;

    if (Math.abs(sx) < 1e-7 && Math.abs(sy) < 1e-7) {
      // Affine mapping
      return {
        a: tr.x - tl.x,
        b: bl.x - tl.x,
        c: tl.x,
        d: tr.y - tl.y,
        e: bl.y - tl.y,
        f: tl.y,
        g: 0,
        h: 0
      };
    }

    const det = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(det) < 1e-9) {
      // Degenerate quad fallback to bounding box
      return {
        a: tr.x - tl.x,
        b: bl.x - tl.x,
        c: tl.x,
        d: tr.y - tl.y,
        e: bl.y - tl.y,
        f: tl.y,
        g: 0,
        h: 0
      };
    }

    const g = (sx * dy2 - sy * dx2) / det;
    const h = (dx1 * sy - dy1 * sx) / det;

    const a = tr.x - tl.x + g * tr.x;
    const b = bl.x - tl.x + h * bl.x;
    const c = tl.x;

    const d = tr.y - tl.y + g * tr.y;
    const e = bl.y - tl.y + h * bl.y;
    const f = tl.y;

    return { a, b, c, d, e, f, g, h };
  }

  /**
   * Warp source image onto destination canvas using Homography + Bilinear Interpolation.
   *
   * @param {HTMLImageElement|HTMLCanvasElement} sourceImage
   * @param {Array<{x: number, y: number}>} corners [TL, TR, BR, BL]
   * @param {number} [targetWidth]
   * @param {number} [targetHeight]
   * @returns {HTMLCanvasElement} Rectified canvas
   */
  function warpPerspective(sourceImage, corners, targetWidth, targetHeight) {
    const srcW = sourceImage.naturalWidth || sourceImage.width;
    const srcH = sourceImage.naturalHeight || sourceImage.height;

    // Get source pixel data
    let srcCanvas;
    if (sourceImage instanceof (typeof HTMLCanvasElement !== 'undefined' ? HTMLCanvasElement : Object)) {
      srcCanvas = sourceImage;
    } else {
      srcCanvas = document.createElement('canvas');
      srcCanvas.width = srcW;
      srcCanvas.height = srcH;
      const sctx = srcCanvas.getContext('2d');
      sctx.drawImage(sourceImage, 0, 0);
    }
    const sctx = srcCanvas.getContext('2d');
    const srcImageData = sctx.getImageData(0, 0, srcW, srcH);
    const srcPixels = srcImageData.data;

    // Determine target dimensions if not provided
    const dims = calculateDimensions(corners);
    const dstW = Math.min(2400, targetWidth || dims.width);
    const dstH = Math.min(2400, targetHeight || dims.height);

    const dstCanvas = document.createElement('canvas');
    dstCanvas.width = dstW;
    dstCanvas.height = dstH;
    const dctx = dstCanvas.getContext('2d');
    const dstImageData = dctx.createImageData(dstW, dstH);
    const dstPixels = dstImageData.data;

    const [tl, tr, br, bl] = corners;
    const coeff = computeSquareToQuadCoefficients(tl, tr, br, bl);
    const { a, b, c, d, e, f, g, h } = coeff;

    const invW = 1.0 / dstW;
    const invH = 1.0 / dstH;

    for (let y = 0; y < dstH; y++) {
      const v = y * invH;
      const rowOffset = y * dstW * 4;

      for (let x = 0; x < dstW; x++) {
        const u = x * invW;

        const denom = g * u + h * v + 1.0;
        const srcX = (a * u + b * v + c) / denom;
        const srcY = (d * u + e * v + f) / denom;

        // Bilinear interpolation
        const x0 = Math.floor(srcX);
        const y0 = Math.floor(srcY);
        const x1 = Math.min(srcW - 1, x0 + 1);
        const y1 = Math.min(srcH - 1, y0 + 1);

        const dx = srcX - x0;
        const dy = srcY - y0;

        const dstIdx = rowOffset + x * 4;

        if (x0 < 0 || x0 >= srcW || y0 < 0 || y0 >= srcH) {
          // Out of bounds: transparent or background
          dstPixels[dstIdx] = 255;
          dstPixels[dstIdx + 1] = 255;
          dstPixels[dstIdx + 2] = 255;
          dstPixels[dstIdx + 3] = 255;
          continue;
        }

        const idx00 = (y0 * srcW + x0) * 4;
        const idx10 = (y0 * srcW + x1) * 4;
        const idx01 = (y1 * srcW + x0) * 4;
        const idx11 = (y1 * srcW + x1) * 4;

        for (let ch = 0; ch < 3; ch++) {
          const top = srcPixels[idx00 + ch] * (1 - dx) + srcPixels[idx10 + ch] * dx;
          const bot = srcPixels[idx01 + ch] * (1 - dx) + srcPixels[idx11 + ch] * dx;
          dstPixels[dstIdx + ch] = Math.round(top * (1 - dy) + bot * dy);
        }
        dstPixels[dstIdx + 3] = 255; // Solid alpha
      }
    }

    dctx.putImageData(dstImageData, 0, 0);
    return dstCanvas;
  }

  /**
   * Apply image filter in place on ImageData:
   * - 'original': no changes
   * - 'grayscale': standard luminance
   * - 'bw': Adaptive thresholding (Bradley-Roth with Integral Image) for crisp text
   *
   * @param {ImageData} imageData
   * @param {'original'|'grayscale'|'bw'} filterType
   */
  function applyFilter(imageData, filterType) {
    if (!filterType || filterType === 'original') return;

    const data = imageData.data;
    const w = imageData.width;
    const h = imageData.height;
    const total = w * h;

    if (filterType === 'grayscale') {
      for (let i = 0; i < data.length; i += 4) {
        const lum = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        data[i] = lum;
        data[i + 1] = lum;
        data[i + 2] = lum;
      }
      return;
    }

    if (filterType === 'bw') {
      // 1. Convert to grayscale buffer
      const gray = new Uint8Array(total);
      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
      }

      // 2. Build 32-bit Integral Image
      const integral = new Uint32Array(total);
      for (let y = 0; y < h; y++) {
        let sum = 0;
        const rowOffset = y * w;
        for (let x = 0; x < w; x++) {
          sum += gray[rowOffset + x];
          if (y === 0) {
            integral[rowOffset + x] = sum;
          } else {
            integral[rowOffset + x] = integral[(y - 1) * w + x] + sum;
          }
        }
      }

      // 3. Adaptive thresholding
      // Window size approx 1/16 of width (typical document character scale)
      const s = Math.max(12, Math.floor(w / 16));
      const s2 = Math.floor(s / 2);
      const t = 0.12; // 12% below local mean is text

      for (let y = 0; y < h; y++) {
        const y1 = Math.max(0, y - s2);
        const y2 = Math.min(h - 1, y + s2);
        const rowOffset = y * w;

        for (let x = 0; x < w; x++) {
          const x1 = Math.max(0, x - s2);
          const x2 = Math.min(w - 1, x + s2);

          const count = (x2 - x1 + 1) * (y2 - y1 + 1);

          // Integral image sum inside [x1, y1] to [x2, y2]
          let sum = integral[y2 * w + x2];
          if (x1 > 0) sum -= integral[y2 * w + (x1 - 1)];
          if (y1 > 0) sum -= integral[(y1 - 1) * w + x2];
          if (x1 > 0 && y1 > 0) sum += integral[(y1 - 1) * w + (x1 - 1)];

          const threshold = (sum / count) * (1.0 - t);
          const val = gray[rowOffset + x] < threshold ? 0 : 255;

          const dataIdx = (rowOffset + x) * 4;
          data[dataIdx] = val;
          data[dataIdx + 1] = val;
          data[dataIdx + 2] = val;
          data[dataIdx + 3] = 255;
        }
      }
    }
  }

  /**
   * Helper to downscale canvas if dimensions exceed maxDimension (2048px)
   */
  function boundCanvasResolution(canvas, maxDim = 2048) {
    if (canvas.width <= maxDim && canvas.height <= maxDim) {
      return canvas;
    }
    const ratio = Math.min(maxDim / canvas.width, maxDim / canvas.height);
    const newW = Math.round(canvas.width * ratio);
    const newH = Math.round(canvas.height * ratio);

    const out = document.createElement('canvas');
    out.width = newW;
    out.height = newH;
    const ctx = out.getContext('2d');
    ctx.drawImage(canvas, 0, 0, newW, newH);
    return out;
  }

  /**
   * Assemble PDF Document from processed scan pages using PDF-Lib.
   *
   * @param {Array<{canvas: HTMLCanvasElement, rotation?: number}>} scanPages
   * @param {Object} [options]
   * @param {'a4'|'letter'|'fit'} [options.pageSize='a4']
   * @param {'portrait'|'landscape'|'auto'} [options.orientation='auto']
   * @returns {Promise<Uint8Array>}
   */
  async function createPdfFromScanPages(scanPages, options = {}) {
    if (!scanPages || scanPages.length === 0) {
      throw new Error('Tidak ada halaman untuk dibuat PDF.');
    }

    const PDFLib = (typeof window !== 'undefined' && window.PDFLib)
      ? window.PDFLib
      : (typeof require !== 'undefined' ? require('../lib/pdf-lib.min.js') : null);
    if (!PDFLib) {
      throw new Error('PDFLib tidak tersedia.');
    }
    const { PDFDocument, degrees } = PDFLib;

    const pdfDoc = await PDFDocument.create();
    const pageSizeChoice = options.pageSize || 'a4';

    // Standard dimensions in PDF points (72 DPI)
    const STANDARD_SIZES = {
      a4: { width: 595.28, height: 841.89 },
      letter: { width: 612.0, height: 792.0 }
    };

    for (const item of scanPages) {
      const srcCanvas = item.canvas;
      const rotation = item.rotation || 0; // 0, 90, 180, 270

      // Bound resolution to keep PDF size reasonable
      const bounded = boundCanvasResolution(srcCanvas, 2048);

      // Convert canvas to JPEG or PNG data URL
      const dataUrl = bounded.toDataURL('image/jpeg', 0.85);
      const imgBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);

      const imgW = embeddedImg.width;
      const imgH = embeddedImg.height;

      let pageW, pageH;
      if (pageSizeChoice === 'fit') {
        pageW = imgW;
        pageH = imgH;
      } else {
        const std = STANDARD_SIZES[pageSizeChoice] || STANDARD_SIZES.a4;
        const isImgLandscape = imgW > imgH;
        if (isImgLandscape) {
          pageW = Math.max(std.width, std.height);
          pageH = Math.min(std.width, std.height);
        } else {
          pageW = Math.min(std.width, std.height);
          pageH = Math.max(std.width, std.height);
        }
      }

      const page = pdfDoc.addPage([pageW, pageH]);

      if (rotation !== 0) {
        page.setRotation(degrees(rotation));
      }

      // Scale and center image inside page
      if (pageSizeChoice === 'fit') {
        page.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: pageW,
          height: pageH
        });
      } else {
        // Fit with margin (e.g. 20pt)
        const margin = 20;
        const availW = pageW - margin * 2;
        const availH = pageH - margin * 2;
        const scale = Math.min(availW / imgW, availH / imgH);
        const drawW = imgW * scale;
        const drawH = imgH * scale;
        const drawX = margin + (availW - drawW) / 2;
        const drawY = margin + (availH - drawH) / 2;

        page.drawImage(embeddedImg, {
          x: drawX,
          y: drawY,
          width: drawW,
          height: drawH
        });
      }
    }

    return await pdfDoc.save();
  }

  return {
    dist,
    calculateDimensions,
    computeSquareToQuadCoefficients,
    warpPerspective,
    applyFilter,
    boundCanvasResolution,
    createPdfFromScanPages
  };
});

