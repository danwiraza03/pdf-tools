/**
 * Page Tools Engine
 * Provides Page Cropping, Header & Footer generation, Bates Numbering, and Page Resizing.
 */

class PageToolsEngine {
  /**
   * Apply Header and Footer to document pages
   * @param {Object} doc StudioDoc
   * @param {Object} options { headerLeft, headerCenter, headerRight, footerLeft, footerCenter, footerRight, fontSize, font, color, pageRange }
   */
  static applyHeaderFooter(doc, options = {}) {
    if (!doc) return;
    const pages = doc.getActivePagesList();
    const totalPages = pages.length;

    const parseText = (template, pageNum, pageIdx) => {
      if (!template) return '';
      return template
        .replace(/<<page>>|{n}/gi, pageIdx + 1)
        .replace(/<<total>>|{total}/gi, totalPages)
        .replace(/<<date>>|{date}/gi, new Date().toLocaleDateString())
        .replace(/<<title>>|{title}/gi, doc.fileName ? doc.fileName.replace(/\.pdf$/i, '') : 'Document');
    };

    pages.forEach((pageNum, pageIdx) => {
      const pageAnn = doc.getPageAnnotation(pageNum);
      if (!pageAnn.headerFooter) pageAnn.headerFooter = {};

      pageAnn.headerFooter = {
        headerLeft: parseText(options.headerLeft, pageNum, pageIdx),
        headerCenter: parseText(options.headerCenter, pageNum, pageIdx),
        headerRight: parseText(options.headerRight, pageNum, pageIdx),
        footerLeft: parseText(options.footerLeft, pageNum, pageIdx),
        footerCenter: parseText(options.footerCenter, pageNum, pageIdx),
        footerRight: parseText(options.footerRight, pageNum, pageIdx),
        fontSize: options.fontSize || 10,
        fontFamily: options.fontFamily || 'Helvetica',
        color: options.color || '#374151'
      };
    });
  }

  /**
   * Apply Bates Numbering across document pages
   * @param {Object} doc StudioDoc
   * @param {Object} options { prefix, startNumber, numDigits, suffix, position, fontSize, font, color }
   */
  static applyBatesNumbering(doc, options = {}) {
    if (!doc) return;
    const pages = doc.getActivePagesList();
    const prefix = options.prefix || '';
    const suffix = options.suffix || '';
    const startNum = parseInt(options.startNumber, 10) || 1;
    const digits = parseInt(options.numDigits, 10) || 6;
    const pos = options.position || 'bottom_right'; // 'top_right'|'bottom_right'|'bottom_center'|'bottom_left'

    pages.forEach((pageNum, idx) => {
      const pageAnn = doc.getPageAnnotation(pageNum);
      const batesNum = (startNum + idx).toString().padStart(digits, '0');
      const fullBatesText = `${prefix}${batesNum}${suffix}`;

      pageAnn.batesNumber = {
        text: fullBatesText,
        position: pos,
        fontSize: options.fontSize || 10,
        fontFamily: options.fontFamily || 'Helvetica',
        color: options.color || '#1F2937'
      };
    });
  }

  /**
   * Set Crop Box for page
   */
  static setPageCrop(doc, pageNum, cropBox) {
    if (!doc) return;
    if (!doc.pageCropBoxes) doc.pageCropBoxes = {};
    doc.pageCropBoxes[pageNum] = { ...cropBox };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.PageToolsEngine = PageToolsEngine;
