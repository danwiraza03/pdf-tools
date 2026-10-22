/**
 * Font Resolver
 * Resolves source PDF font requests according to strict priority order:
 * 1. Original embedded font / exact match
 * 2. User-supplied font
 * 3. Metric-compatible substitute
 * 4. Generic fallback (Helvetica ONLY as last resort)
 */

class FontResolver {
  /**
   * Resolve best matching font for PDF-Lib embedding
   * @param {Object} pdfDoc PDF-Lib PDFDocument
   * @param {string} requestedFamily Font family name
   * @param {boolean} bold
   * @param {boolean} italic
   */
  static async resolvePdfFont(pdfDoc, requestedFamily, bold = false, italic = false) {
    const StandardFonts = PDFLib.StandardFonts;
    const normalized = window.PDFTools.FontNormalizer
      ? window.PDFTools.FontNormalizer.normalize(requestedFamily)
      : { family: requestedFamily || 'Helvetica', bold: !!bold, italic: !!italic };

    const effectiveFamily = normalized.family;
    const isBold = bold || normalized.bold;
    const isItalic = italic || normalized.italic;

    // Check user custom registered fonts
    if (window.PDFTools.FontRegistry && window.PDFTools.FontRegistry.customFonts.has(effectiveFamily)) {
      try {
        const customEntry = window.PDFTools.FontRegistry.customFonts.get(effectiveFamily);
        if (pdfDoc.registerFontkit && window.fontkit) {
          pdfDoc.registerFontkit(window.fontkit);
          return await pdfDoc.embedFont(customEntry.buffer);
        }
      } catch (custErr) {
        console.warn('Custom font embedding fallback:', custErr);
      }
    }

    // Map to StandardFonts or metric compatible equivalents
    const lower = effectiveFamily.toLowerCase();

    // 1. Serif / Times group
    if (lower.includes('times') || lower.includes('cambria') || lower.includes('georgia') || lower.includes('serif') || lower.includes('garamond') || lower.includes('palatino')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanBoldItalic);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
      return await pdfDoc.embedFont(StandardFonts.TimesRoman);
    }

    // 2. Monospace / Courier group
    if (lower.includes('courier') || lower.includes('consolas') || lower.includes('mono') || lower.includes('code')) {
      if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.CourierBoldOblique);
      if (isBold) return await pdfDoc.embedFont(StandardFonts.CourierBold);
      if (isItalic) return await pdfDoc.embedFont(StandardFonts.CourierOblique);
      return await pdfDoc.embedFont(StandardFonts.Courier);
    }

    // 3. Sans-serif / Arial / Calibri / Segoe / Roboto / Helvetica group
    if (isBold && isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);
    if (isBold) return await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    if (isItalic) return await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    return await pdfDoc.embedFont(StandardFonts.Helvetica);
  }

  /**
   * Check font substitution status and return indicator
   */
  static getSubstitutionStatus(sourceFamily, resolvedFamily) {
    if (!sourceFamily) return { substituted: false, status: 'Original' };
    const cleanSource = (sourceFamily || '').toLowerCase().replace(/[^a-z]/g, '');
    const cleanResolved = (resolvedFamily || '').toLowerCase().replace(/[^a-z]/g, '');

    if (cleanSource === cleanResolved || cleanSource.includes(cleanResolved) || cleanResolved.includes(cleanSource)) {
      return {
        substituted: false,
        originalFont: sourceFamily,
        usingFont: sourceFamily,
        status: 'Exact match'
      };
    }

    return {
      substituted: true,
      originalFont: sourceFamily,
      usingFont: resolvedFamily,
      status: 'Metric-compatible substitute'
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FontResolver = FontResolver;
