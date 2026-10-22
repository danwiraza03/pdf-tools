/**
 * PDF Text Extractor
 * Extracts structured PDFTextRun models with exact transformation matrices,
 * normalized fonts, baseline offsets, colors, and spatial bounding boxes.
 * Uses PDF.js Util.transform for 100% pixel-perfect coordinate mapping with the canvas.
 *
 * v2.0 — Improved accuracy:
 *   - canvas.measureText() for proportional width estimation
 *   - Canvas pixel sampling for text color detection
 *   - Font-family-aware ascent ratio table (not hardcoded 0.8)
 */

class PDFTextExtractor {

  /**
   * Font-family-aware ascent ratio lookup.
   * Ascent ratio = distance from baseline to top of uppercase letters / em size.
   * Falls back to 0.8 if font family is unknown.
   */
  static _getAscentRatio(fontFamily) {
    const key = (fontFamily || '').toLowerCase().replace(/[^a-z]/g, '');
    const ratios = {
      'helvetica': 0.77, 'arial': 0.76, 'sansserif': 0.76,
      'timesnewroman': 0.82, 'times': 0.82, 'serif': 0.82,
      'georgia': 0.84, 'cambria': 0.83,
      'courier': 0.75, 'couriernew': 0.75, 'monospace': 0.75,
      'verdana': 0.76, 'tahoma': 0.76, 'trebuchetms': 0.78,
      'roboto': 0.75, 'opensans': 0.77, 'lato': 0.77,
      'inter': 0.79, 'nunito': 0.78, 'poppins': 0.77,
      'calibri': 0.76, 'segoeui': 0.78,
      'notosans': 0.77, 'notoserif': 0.82,
    };
    for (const [fontKey, ratio] of Object.entries(ratios)) {
      if (key.includes(fontKey)) return ratio;
    }
    return 0.8; // Safe default
  }

  /**
   * Measure text width using an offscreen canvas for proportional accuracy.
   * Falls back to character-count estimation if canvas is unavailable.
   */
  static _measureTextWidth(text, fontFamily, fontSize, bold, italic) {
    try {
      if (typeof OffscreenCanvas !== 'undefined') {
        const oc = new OffscreenCanvas(1, 1);
        const ctx = oc.getContext('2d');
        const style = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}, Arial, sans-serif`;
        ctx.font = style;
        return ctx.measureText(text).width;
      }
      // Fallback for environments without OffscreenCanvas
      if (!PDFTextExtractor._measureCanvas) {
        PDFTextExtractor._measureCanvas = document.createElement('canvas');
        PDFTextExtractor._measureCanvas.width = 1;
        PDFTextExtractor._measureCanvas.height = 1;
      }
      const ctx = PDFTextExtractor._measureCanvas.getContext('2d');
      const style = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}, Arial, sans-serif`;
      ctx.font = style;
      return ctx.measureText(text).width;
    } catch (e) {
      // Final fallback: proportional width estimate
      return text.length * fontSize * 0.52;
    }
  }

  /**
   * Sample text color from the rendered canvas at a specific position.
   * Returns hex color string, or null if sampling fails.
   */
  static sampleColorFromCanvas(canvas, x, y, fontHeight) {
    try {
      if (!canvas) return null;
      const ctx = canvas.getContext('2d');
      // Sample a few pixels around the vertical center of the text baseline area
      const sampleY = Math.round(y + fontHeight * 0.5);
      const sampleX = Math.round(x + 2); // Slight offset to avoid edge artifacts

      if (sampleX < 0 || sampleX >= canvas.width || sampleY < 0 || sampleY >= canvas.height) return null;

      // Sample a small horizontal strip and pick the darkest (most ink-like) pixel
      const stripWidth = Math.min(6, canvas.width - sampleX);
      const imageData = ctx.getImageData(sampleX, sampleY, stripWidth, 1).data;

      let darkestLum = 999;
      let darkestR = 0, darkestG = 0, darkestB = 0;
      let foundNonWhite = false;

      for (let i = 0; i < stripWidth * 4; i += 4) {
        const r = imageData[i], g = imageData[i + 1], b = imageData[i + 2], a = imageData[i + 3];
        if (a < 128) continue; // Skip transparent pixels

        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        // Skip near-white background pixels (luminance > 240)
        if (lum > 240) continue;

        foundNonWhite = true;
        if (lum < darkestLum) {
          darkestLum = lum;
          darkestR = r; darkestG = g; darkestB = b;
        }
      }

      if (!foundNonWhite) return null;

      const hex = '#' + [darkestR, darkestG, darkestB]
        .map(c => c.toString(16).padStart(2, '0')).join('');
      return hex;
    } catch (e) {
      return null;
    }
  }

  /**
   * Extract high-fidelity PDFTextRuns from a PDF.js page
   * @param {Object} page PDF.js PageProxy
   * @param {number} pageNumber
   * @param {number} extraRotation
   * @param {HTMLCanvasElement} [renderedCanvas] Optional rendered canvas for color sampling
   */
  static async extractPageTextRuns(page, pageNumber = 1, extraRotation = 0, renderedCanvas = null) {
    const textContent = await page.getTextContent({ normalizeWhitespace: false });
    const totalRotation = ((page.rotate || 0) + (extraRotation || 0) + 360) % 360;
    const viewport = page.getViewport({ scale: 1.0, rotation: totalRotation });

    const runs = [];

    for (let idx = 0; idx < textContent.items.length; idx++) {
      const item = textContent.items[idx];
      if (!item.str || item.str.trim() === '') continue;

      let screenX, screenY, fontHeight, txResult = null;

      if (typeof pdfjsLib !== 'undefined' && pdfjsLib.Util && typeof pdfjsLib.Util.transform === 'function') {
        // Native PDF.js viewport transformation matrix (pixel-perfect with canvas render)
        txResult = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontWidth = Math.max(4, Math.hypot(txResult[0], txResult[1]));
        const fontHeightRaw = Math.max(4, Math.hypot(txResult[2], txResult[3]));
        fontHeight = Math.min(fontHeightRaw, fontWidth * 1.5); // Clamp absurd line-heights
        screenX = txResult[4];
      } else {
        const transform = item.transform;
        const fontWidth = Math.max(4, Math.hypot(transform[0], transform[1]));
        const fontHeightRaw = Math.max(4, Math.hypot(transform[2], transform[3]));
        fontHeight = Math.min(fontHeightRaw, fontWidth * 1.5);
        const [ptX, ptY] = viewport.convertToViewportPoint(transform[4], transform[5]);
        screenX = ptX;
        txResult = [0, 0, 0, 0, ptX, ptY]; // Mimic transform result for unified handling
      }

      // Normalize font name
      const fontObj = textContent.styles ? textContent.styles[item.fontName] : null;
      const rawFontName = fontObj ? (fontObj.fontFamily || item.fontName) : item.fontName;
      const normalizedFont = window.PDFTools.FontNormalizer
        ? window.PDFTools.FontNormalizer.normalize(rawFontName)
        : { family: 'Helvetica', bold: false, italic: false };

      // Font-family-aware ascent ratio (not hardcoded 0.8)
      const ascentRatio = PDFTextExtractor._getAscentRatio(normalizedFont.family);
      screenY = txResult[5] - (fontHeight * ascentRatio);

      // Proportional width via canvas.measureText() instead of magic number 0.52
      let width;
      if (item.width > 0) {
        width = item.width;
      } else {
        width = PDFTextExtractor._measureTextWidth(
          item.str,
          normalizedFont.family,
          fontHeight,
          normalizedFont.bold,
          normalizedFont.italic
        );
      }

      // Use fontHeight exclusively for visual bounding box to prevent overlapping adjacent lines
      const height = fontHeight * 1.15;

      const baselineY = txResult[5];

      // Color detection: try canvas pixel sampling, fallback to reasonable default
      let color = '#111827';
      if (renderedCanvas) {
        const sampledColor = PDFTextExtractor.sampleColorFromCanvas(
          renderedCanvas, screenX, screenY, fontHeight
        );
        if (sampledColor) {
          color = sampledColor;
        }
      }

      const run = {
        id: `run_${pageNumber}_${idx}`,
        pageNumber: pageNumber,
        text: item.str,
        originalText: item.str,
        currentText: item.str,
        baselineScreenY: baselineY,
        ascentRatio: ascentRatio,
        bbox: {
          x: screenX,
          y: screenY,
          width: width,
          height: height
        },
        font: {
          pdfFontName: item.fontName || 'F1',
          normalizedFamily: normalizedFont.family,
          postScriptName: normalizedFont.cleanName || normalizedFont.family,
          size: fontHeight,
          weight: normalizedFont.weight,
          bold: normalizedFont.bold,
          italic: normalizedFont.italic
        },
        color: color
      };

      runs.push(run);
    }

    return runs;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.PDFTextExtractor = PDFTextExtractor;
