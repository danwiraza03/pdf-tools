/**
 * PDF Coordinate Engine
 * Centralized coordinate translation between Browser (top-left origin) and PDF (bottom-left origin).
 * Preserves transformation matrix, scale, rotation, and baseline calculations without scattering across code.
 */

class PDFCoordinateEngine {
  /**
   * Convert Browser Top-Left coordinates to PDF Bottom-Left coordinates
   * @param {number} x Screen/Viewport X
   * @param {number} y Screen/Viewport Y
   * @param {number} height Screen/Viewport Height or Element Height
   * @param {number} pdfPageHeight Native PDF page height in points
   * @param {number} scale Current viewport zoom scale
   */
  static screenToPdf(x, y, height, pdfPageHeight, scale = 1.0) {
    const unscaledX = x / scale;
    const unscaledY = y / scale;
    const unscaledHeight = (height || 0) / scale;
    return {
      x: unscaledX,
      y: pdfPageHeight - unscaledY - unscaledHeight,
      width: (x) => x / scale,
      height: unscaledHeight
    };
  }

  /**
   * Convert PDF Bottom-Left coordinates to Browser Top-Left coordinates
   * @param {number} pdfX Native PDF X in points
   * @param {number} pdfY Native PDF Y in points
   * @param {number} pdfHeight Native PDF bounding box height in points
   * @param {number} pdfPageHeight Native PDF page height in points
   * @param {number} scale Current viewport zoom scale
   */
  static pdfToScreen(pdfX, pdfY, pdfHeight, pdfPageHeight, scale = 1.0) {
    const screenX = pdfX * scale;
    const screenY = (pdfPageHeight - pdfY - (pdfHeight || 0)) * scale;
    return {
      x: screenX,
      y: screenY,
      width: (w) => w * scale,
      height: (pdfHeight || 0) * scale
    };
  }

  /**
   * Calculate precise text baseline for PDF rendering
   * @param {number} y Top-left Y in PDF coordinates
   * @param {number} fontSize Font size in points
   * @param {number} [baselineOffset=0.8] Font-specific baseline multiplier
   */
  static calculatePdfBaseline(pdfPageHeight, screenY, fontSize, baselineOffset = 0.8) {
    return pdfPageHeight - (screenY + (fontSize * baselineOffset));
  }

  /**
   * Precise bounding box transformation accounting for rotation (0, 90, 180, 270) and scale
   * Converts native PDF bottom-left box to Canvas/DOM top-left coordinates.
   * @param {Object} box { x, y, width, height } in PDF coordinates
   * @param {number} pageWidth Page width in points
   * @param {number} pageHeight Page height in points
   * @param {number} scale Canvas scale (e.g. dpi / 72)
   * @param {number} rotation Page rotation angle (0, 90, 180, 270)
   * @returns {{x: number, y: number, width: number, height: number}}
   */
  static transformBox(box, pageWidth, pageHeight, scale = 1.0, rotation = 0) {
    const normRot = ((rotation % 360) + 360) % 360;
    const x1 = box.x;
    const y1 = box.y;
    const x2 = box.x + (box.width || 0);
    const y2 = box.y + (box.height || 0);

    let rx1, ry1, rx2, ry2;
    if (normRot === 90) {
      rx1 = y1 * scale;
      ry1 = x1 * scale;
      rx2 = y2 * scale;
      ry2 = x2 * scale;
    } else if (normRot === 180) {
      rx1 = (pageWidth - x2) * scale;
      ry1 = y1 * scale;
      rx2 = (pageWidth - x1) * scale;
      ry2 = y2 * scale;
    } else if (normRot === 270) {
      rx1 = (pageHeight - y2) * scale;
      ry1 = (pageWidth - x2) * scale;
      rx2 = (pageHeight - y1) * scale;
      ry2 = (pageWidth - x1) * scale;
    } else {
      // 0 deg
      rx1 = x1 * scale;
      ry1 = (pageHeight - y2) * scale;
      rx2 = x2 * scale;
      ry2 = (pageHeight - y1) * scale;
    }

    const minX = Math.min(rx1, rx2);
    const minY = Math.min(ry1, ry2);
    const w = Math.abs(rx2 - rx1);
    const h = Math.abs(ry2 - ry1);

    return { x: minX, y: minY, width: w, height: h };
  }

  /**
   * Convert a redaction mark (in either PDF coordinates or unscaled screen coordinates)
   * to canvas pixel coordinates for high-DPI rendering, accounting for rotation.
   * @param {Object} red Redaction mark object
   * @param {number} pageWidth PDF page width in points
   * @param {number} pageHeight PDF page height in points
   * @param {number} canvasScale Scale factor (e.g. dpi / 72)
   * @param {number} rotation Page rotation angle (0, 90, 180, 270)
   */
  static redactionToCanvas(red, pageWidth, pageHeight, canvasScale, rotation = 0) {
    if (red.isPdfCoord || red.pdfX !== undefined || red.pdfY !== undefined) {
      const px = red.pdfX !== undefined ? red.pdfX : red.x;
      const py = red.pdfY !== undefined ? red.pdfY : red.y;
      return PDFCoordinateEngine.transformBox({
        x: px,
        y: py,
        width: red.width || 0,
        height: red.height || 0
      }, pageWidth, pageHeight, canvasScale, rotation);
    }
    // If drawn on screen at scale 1.0 (relative to rendered viewport canvas):
    return {
      x: (red.x || 0) * canvasScale,
      y: (red.y || 0) * canvasScale,
      width: (red.width || 0) * canvasScale,
      height: (red.height || 0) * canvasScale
    };
  }
}

if (typeof window !== 'undefined') {
  window.PDFTools = window.PDFTools || {};
  window.PDFTools.PDFCoordinateEngine = PDFCoordinateEngine;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PDFCoordinateEngine;
}
