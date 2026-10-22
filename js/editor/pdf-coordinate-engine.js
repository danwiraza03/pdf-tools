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
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.PDFCoordinateEngine = PDFCoordinateEngine;
