/**
 * PDF Tools — Page Numbering Engine
 * Adds flexible page numbers, headers, and footers to PDF pages using PDF-Lib
 */
window.PDFTools = window.PDFTools || {};

PDFTools.PageNumber = (function () {
  /**
   * Apply page numbers to a PDF document
   * @param {File|ArrayBuffer} fileInput 
   * @param {Object} options 
   * @param {Function} onProgress 
   * @returns {Promise<Uint8Array>}
   */
  async function applyPageNumbers(fileInput, options = {}, onProgress) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;

    const arrayBuffer = fileInput instanceof ArrayBuffer
      ? fileInput
      : await PDFTools.FileUtils.readAsArrayBuffer(fileInput);

    if (typeof onProgress === 'function') onProgress(15, 'Loading PDF document...');

    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    
    // Unlock any digital signatures if present
    try {
      if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc, arrayBuffer);
      }
    } catch (e) {
      console.warn('Signature unlock notice:', e);
    }

    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    // Options configuration
    const format = options.format || 'page_of_total'; // 'number_only' | 'page_of_total' | 'custom'
    const customText = options.customText || 'Page {n} of {total}';
    const position = options.position || 'bottom_center'; // 'bottom_center', 'bottom_right', 'bottom_left', 'top_center', 'top_right', 'top_left'
    const startNumber = parseInt(options.startNumber || 1, 10);
    const startPage = parseInt(options.startPage || 1, 10); // Page in doc to start numbering from
    const endPage = parseInt(options.endPage || totalPages, 10);
    const fontSize = parseInt(options.fontSize || 10, 10);
    const margin = parseInt(options.margin || 25, 10);
    const colorHex = options.color || '#333333';
    const fontName = options.fontFamily || 'Helvetica'; // 'Helvetica', 'TimesRoman', 'Courier'

    let font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    if (fontName === 'TimesRoman') font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
    if (fontName === 'Courier') font = await pdfDoc.embedFont(StandardFonts.Courier);

    const textColor = parseColorRgb(colorHex, rgb);

    for (let i = 0; i < totalPages; i++) {
      const pageIndex = i;
      const docPageNum = i + 1;

      if (typeof onProgress === 'function') {
        const pct = Math.round(20 + ((i + 1) / totalPages) * 70);
        onProgress(pct, `Applying page number to page ${docPageNum}...`);
      }

      // Skip pages outside specified range
      if (docPageNum < startPage || docPageNum > endPage) {
        continue;
      }

      const page = pages[pageIndex];
      const { width, height } = page.getSize();
      const pageNumberValue = startNumber + (docPageNum - startPage);

      // Generate text string
      let labelText = '';
      if (format === 'number_only') {
        labelText = `${pageNumberValue}`;
      } else if (format === 'page_of_total') {
        labelText = `Page ${pageNumberValue} of ${totalPages - startPage + 1}`;
      } else if (format === 'halaman_dari') {
        labelText = `Halaman ${pageNumberValue} dari ${totalPages - startPage + 1}`;
      } else {
        labelText = customText
          .replace(/\{n\}/g, `${pageNumberValue}`)
          .replace(/\{total\}/g, `${totalPages - startPage + 1}`);
      }

      const textWidth = font.widthOfTextAtSize(labelText, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      let x = margin;
      let y = margin;

      // X coordinate calculation
      if (position.includes('center')) {
        x = (width - textWidth) / 2;
      } else if (position.includes('right')) {
        x = width - textWidth - margin;
      } else {
        x = margin;
      }

      // Y coordinate calculation
      if (position.includes('top')) {
        y = height - margin - textHeight;
      } else {
        y = margin;
      }

      page.drawText(labelText, {
        x: x,
        y: y,
        size: fontSize,
        font: font,
        color: textColor
      });
    }

    if (typeof onProgress === 'function') onProgress(95, 'Saving updated PDF...');
    return await pdfDoc.save({ useObjectStreams: true });
  }

  function parseColorRgb(colorHex, rgbFn) {
    if (!colorHex || typeof colorHex !== 'string') return rgbFn(0.2, 0.2, 0.2);
    colorHex = colorHex.trim().replace('#', '');
    if (colorHex.length === 3) colorHex = colorHex.split('').map(c => c + c).join('');
    if (colorHex.length === 6) {
      const r = parseInt(colorHex.substring(0, 2), 16) / 255;
      const g = parseInt(colorHex.substring(2, 4), 16) / 255;
      const b = parseInt(colorHex.substring(4, 6), 16) / 255;
      return rgbFn(r || 0, g || 0, b || 0);
    }
    return rgbFn(0.2, 0.2, 0.2);
  }

  return {
    applyPageNumbers
  };
})();
