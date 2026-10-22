/**
 * Font Normalizer
 * Strips 6-letter random subset prefixes (e.g. ABCDEE+ArialMT -> Arial)
 * and resolves clean font family, bold weight, and italic styles.
 */

class FontNormalizer {
  /**
   * Normalize raw PDF font name into standardized family, bold, italic properties
   * @param {string} rawFontName e.g. "ABCDEE+ArialMT", "GHJKLM+Calibri-Bold", "TimesNewRomanPSMT"
   */
  static normalize(rawFontName) {
    if (!rawFontName || typeof rawFontName !== 'string') {
      return {
        rawName: rawFontName || '',
        family: 'Helvetica',
        normalizedFamily: 'Helvetica',
        bold: false,
        italic: false,
        weight: 'normal'
      };
    }

    let cleanName = rawFontName.trim();

    // 1. Strip 6-letter subset prefix (e.g. "ABCDEF+Arial" -> "Arial")
    if (/^[A-Z]{6}\+/.test(cleanName)) {
      cleanName = cleanName.substring(7);
    }

    let bold = false;
    let italic = false;

    // 2. Detect bold / italic from suffixes
    if (/(bold|black|heavy|semibold|b)/i.test(cleanName)) {
      bold = true;
    }
    if (/(italic|oblique|it|slanted)/i.test(cleanName)) {
      italic = true;
    }

    // 3. Normalize common PostScript aliases
    let family = cleanName
      .replace(/-(Bold|Italic|BoldItalic|Oblique|BoldOblique|Regular|Roman|Light|Semibold|Medium|Black|MT|PSMT|PS)/gi, '')
      .replace(/(Bold|Italic|BoldItalic|Oblique|BoldOblique|Regular|Roman|Light|Semibold|Medium|Black|MT|PSMT|PS)$/gi, '')
      .trim();

    // Specific known standard font mappings
    const mappings = {
      'TimesNewRoman': 'Times New Roman',
      'TimesNewRomanPS': 'Times New Roman',
      'Times': 'Times New Roman',
      'Arial': 'Arial',
      'ArialMT': 'Arial',
      'Calibri': 'Calibri',
      'Cambria': 'Cambria',
      'CambriaMath': 'Cambria Math',
      'Verdana': 'Verdana',
      'Tahoma': 'Tahoma',
      'TrebuchetMS': 'Trebuchet MS',
      'Georgia': 'Georgia',
      'CenturyGothic': 'Century Gothic',
      'BookAntiqua': 'Book Antiqua',
      'PalatinoLinotype': 'Palatino Linotype',
      'Garamond': 'Garamond',
      'FranklinGothic': 'Franklin Gothic',
      'SegoeUI': 'Segoe UI',
      'MicrosoftSansSerif': 'Microsoft Sans Serif',
      'Consolas': 'Consolas',
      'LucidaConsole': 'Lucida Console',
      'LucidaSansUnicode': 'Lucida Sans Unicode',
      'Corbel': 'Corbel',
      'Candara': 'Candara',
      'Constantia': 'Constantia',
      'Rockwell': 'Rockwell',
      'Impact': 'Impact',
      'ComicSansMS': 'Comic Sans MS',
      'Roboto': 'Roboto',
      'OpenSans': 'Open Sans',
      'Lato': 'Lato',
      'Montserrat': 'Montserrat',
      'Poppins': 'Poppins',
      'Inter': 'Inter',
      'NotoSans': 'Noto Sans',
      'NotoSerif': 'Noto Serif',
      'LiberationSans': 'Liberation Sans',
      'LiberationSerif': 'Liberation Serif',
      'LiberationMono': 'Liberation Mono',
      'Courier': 'Courier',
      'CourierNew': 'Courier New',
      'Helvetica': 'Helvetica'
    };

    const mapped = mappings[family] || family;

    return {
      rawName: rawFontName,
      cleanName: cleanName,
      family: mapped,
      normalizedFamily: mapped,
      bold: bold,
      italic: italic,
      weight: bold ? 'bold' : 'normal'
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FontNormalizer = FontNormalizer;
