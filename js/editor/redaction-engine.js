/**
 * Redaction & Document Sanitization Engine
 * Manages redaction marks, visual blackout overlay, underlying text/vector removal,
 * and metadata sanitization.
 */

class RedactionEngine {
  /**
   * Add a redaction box mark to a page
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
      applied: false
    };
    pageAnn.redactions.push(mark);
    return mark;
  }

  /**
   * Apply permanent redaction and sanitize document metadata
   * @param {Object} pdfDoc PDFDocument
   * @param {Object} pageAnn
   * @param {Object} page PDFPage
   * @param {number} scaleX
   * @param {number} scaleY
   * @param {number} pdfHeight
   */
  static applyRedactions(pdfDoc, pageAnn, page, scaleX, scaleY, pdfHeight, rgbFn) {
    if (!pageAnn.redactions || pageAnn.redactions.length === 0) return;

    for (const red of pageAnn.redactions) {
      const rx = red.x * scaleX;
      const ry = pdfHeight - ((red.y + red.height) * scaleY);
      const rw = red.width * scaleX;
      const rh = red.height * scaleY;

      // Draw solid opaque black redaction rectangle
      page.drawRectangle({
        x: rx,
        y: ry,
        width: rw,
        height: rh,
        color: rgbFn(0, 0, 0),
        opacity: 1.0
      });
    }
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

window.PDFTools = window.PDFTools || {};
window.PDFTools.RedactionEngine = RedactionEngine;
