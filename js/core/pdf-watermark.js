/**
 * PDF Tools — Watermark PDF Core Logic
 * Adds customizable text or stamp watermarks to PDF pages
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Watermark = {
  /**
   * Add text watermark to a PDF
   * @param {File} file - PDF file
   * @param {Object} options - Watermark settings
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Uint8Array>}
   */
  applyWatermark: async function (file, options, onProgress) {
    options = options || {};
    const text = options.text || 'CONFIDENTIAL';
    const fontSize = parseInt(options.fontSize, 10) || 48;
    const opacity = parseFloat(options.opacity) || 0.30;
    const rotationAngle = parseInt(options.rotation, 10) || 45;
    const position = options.position || 'center'; // 'center' | 'top-right' | 'bottom-right' | 'diagonal'
    const colorHex = options.color || '#e74c3c';

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

    const { PDFDocument, StandardFonts, rgb, degrees } = PDFLib;
    const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
      try {
        await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {}
    }

    // Embed bold font for crisp readable watermark
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();
    const totalPages = pages.length;

    for (let i = 0; i < totalPages; i++) {
      if (typeof onProgress === 'function') {
        const percent = Math.round(15 + ((i / totalPages) * 75));
        onProgress(percent, `Applying watermark to page ${i + 1} of ${totalPages}...`);
      }

      const page = pages[i];
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      let x = 0;
      let y = 0;
      let angle = rotationAngle;

      if (position === 'center' || position === 'diagonal') {
        // Calculate center with rotation compensation
        const rad = (angle * Math.PI) / 180;
        const rotatedTextWidth = textWidth * Math.cos(rad) - textHeight * Math.sin(rad);
        const rotatedTextHeight = textWidth * Math.sin(rad) + textHeight * Math.cos(rad);

        x = (width - rotatedTextWidth) / 2;
        y = (height - rotatedTextHeight) / 2;
      } else if (position === 'top-right') {
        x = width - textWidth - 30;
        y = height - textHeight - 30;
        angle = 0;
      } else if (position === 'bottom-right') {
        x = width - textWidth - 30;
        y = 30;
        angle = 0;
      } else if (position === 'top-left') {
        x = 30;
        y = height - textHeight - 30;
        angle = 0;
      }

      page.drawText(text, {
        x: Math.max(10, x),
        y: Math.max(10, y),
        size: fontSize,
        font: font,
        color: rgb(r, g, b),
        opacity: opacity,
        rotate: degrees(angle)
      });
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
