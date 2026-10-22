/**
 * Font Registry
 * Maintains exhaustive font registries across PDF Standard Fonts, Common Office/Windows Fonts,
 * Open Source Web Fonts, and User-Imported Custom Fonts (.ttf/.otf).
 */

class FontRegistry {
  static PDF_STANDARD_FONTS = [
    'Helvetica', 'Helvetica Bold', 'Helvetica Oblique', 'Helvetica Bold Oblique',
    'Times Roman', 'Times Bold', 'Times Italic', 'Times Bold Italic',
    'Courier', 'Courier Bold', 'Courier Oblique', 'Courier Bold Oblique',
    'Symbol', 'Zapf Dingbats'
  ];

  static OFFICE_WINDOWS_FONTS = [
    'Arial', 'Arial Narrow', 'Arial Black',
    'Calibri', 'Calibri Light',
    'Cambria', 'Cambria Math',
    'Times New Roman',
    'Verdana',
    'Tahoma',
    'Trebuchet MS',
    'Georgia',
    'Century Gothic',
    'Book Antiqua',
    'Palatino Linotype',
    'Garamond',
    'Franklin Gothic',
    'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold',
    'Microsoft Sans Serif',
    'Consolas',
    'Lucida Console',
    'Lucida Sans Unicode',
    'Corbel',
    'Candara',
    'Constantia',
    'Rockwell',
    'Impact',
    'Comic Sans MS'
  ];

  static OPEN_SOURCE_FONTS = [
    'Roboto', 'Roboto Condensed', 'Roboto Mono',
    'Open Sans',
    'Lato',
    'Montserrat',
    'Poppins',
    'Inter',
    'Noto Sans', 'Noto Serif', 'Noto Sans Mono',
    'Liberation Sans', 'Liberation Serif', 'Liberation Mono',
    'Source Sans', 'Source Serif', 'Source Code',
    'DejaVu Sans', 'DejaVu Serif', 'DejaVu Sans Mono'
  ];

  static METRIC_COMPATIBLE_PAIRS = {
    'Arial': ['Liberation Sans', 'Helvetica', 'Arimo', 'DejaVu Sans'],
    'Calibri': ['Carlito', 'Open Sans', 'Segoe UI', 'Arial'],
    'Times New Roman': ['Liberation Serif', 'Times', 'Tinos', 'DejaVu Serif'],
    'Cambria': ['Caladea', 'Georgia', 'Times New Roman'],
    'Courier New': ['Liberation Mono', 'Courier', 'Cousine', 'DejaVu Sans Mono'],
    'Consolas': ['Inconsolata', 'Source Code', 'Courier New'],
    'Segoe UI': ['Open Sans', 'Roboto', 'Arial'],
    'Verdana': ['DejaVu Sans', 'Tahoma', 'Arial'],
    'Georgia': ['Cambria', 'Times New Roman', 'DejaVu Serif']
  };

  static customFonts = new Map(); // name -> { file, dataUrl, buffer }

  /**
   * Register a user-supplied custom font (.ttf or .otf)
   */
  static async registerCustomFont(file) {
    if (!file) return null;
    const name = file.name.replace(/\.[^/.]+$/, '');
    const buffer = await file.arrayBuffer();
    
    // Create FontFace for browser display
    try {
      const fontFace = new FontFace(name, buffer);
      await fontFace.load();
      document.fonts.add(fontFace);
    } catch (e) {
      console.warn('FontFace registration notice:', e);
    }

    const entry = {
      name: name,
      fileName: file.name,
      buffer: buffer,
      size: file.size
    };
    FontRegistry.customFonts.set(name, entry);
    return entry;
  }

  /**
   * Get all available font categories
   */
  static getCategorizedFonts() {
    return {
      documentFonts: [],
      pdfStandard: FontRegistry.PDF_STANDARD_FONTS,
      officeWindows: FontRegistry.OFFICE_WINDOWS_FONTS,
      openSource: FontRegistry.OPEN_SOURCE_FONTS,
      customFonts: Array.from(FontRegistry.customFonts.keys())
    };
  }

  /**
   * Find metric compatible font substitute
   */
  static findMetricCompatibleFont(fontFamily) {
    if (!fontFamily) return 'Helvetica';
    const candidates = FontRegistry.METRIC_COMPATIBLE_PAIRS[fontFamily];
    if (candidates && candidates.length > 0) {
      return candidates[0];
    }
    return fontFamily.toLowerCase().includes('serif') ? 'Times New Roman' : 'Helvetica';
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.FontRegistry = FontRegistry;
