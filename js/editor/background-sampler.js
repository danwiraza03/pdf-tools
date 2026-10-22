/**
 * Background Sampler Engine
 * Samples background pixels around a text bounding box to determine the exact
 * background color to cleanly wipe out and cover original text when edited.
 * Always returns a solid hex color (defaults to #FFFFFF for white paper).
 */

class BackgroundSampler {
  /**
   * Sample background around text bounding box from pdfCanvas
   * @param {HTMLCanvasElement} canvas The rendered PDF page canvas
   * @param {number} x Screen X
   * @param {number} y Screen Y
   * @param {number} width Screen Width
   * @param {number} height Screen Height
   * @returns {string} Hex color string
   */
  static sampleBackground(canvas, x, y, width, height) {
    if (!canvas) return '#FFFFFF';

    try {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) return '#FFFFFF';

      // Sample further outside the bounding box to avoid text anti-aliasing pixels
      const pad = 6;
      const samplePoints = [
        { px: Math.max(0, x - pad), py: y + height * 0.2 },
        { px: Math.max(0, x - pad), py: y + height * 0.8 },
        { px: Math.min(canvas.width - 1, x + width + pad), py: y + height * 0.2 },
        { px: Math.min(canvas.width - 1, x + width + pad), py: y + height * 0.8 },
        { px: x + width * 0.2, py: Math.max(0, y - pad) },
        { px: x + width * 0.8, py: Math.max(0, y - pad) },
        { px: x + width * 0.2, py: Math.min(canvas.height - 1, y + height + pad) },
        { px: x + width * 0.8, py: Math.min(canvas.height - 1, y + height + pad) }
      ];

      const colorCounts = {};
      let maxCount = 0;
      let dominantColor = { r: 255, g: 255, b: 255 };

      for (const pt of samplePoints) {
        const pixel = ctx.getImageData(Math.round(pt.px), Math.round(pt.py), 1, 1).data;
        if (pixel[3] > 10) {
          // Round to nearest 10 to group similar colors
          const r = Math.round(pixel[0] / 10) * 10;
          const g = Math.round(pixel[1] / 10) * 10;
          const b = Math.round(pixel[2] / 10) * 10;
          
          // Ignore very dark pixels (likely hitting text) unless everything is dark
          if (r < 100 && g < 100 && b < 100) continue;

          const key = `${r},${g},${b}`;
          colorCounts[key] = (colorCounts[key] || 0) + 1;
          
          if (colorCounts[key] > maxCount) {
            maxCount = colorCounts[key];
            dominantColor = { r: pixel[0], g: pixel[1], b: pixel[2] }; // Use actual unrounded color
          }
        }
      }

      // If we couldn't find any non-dark background pixels, default to white
      if (maxCount === 0) return '#FFFFFF';

      // If it's near white, snap to pure white to avoid dirty gray boxes
      const avgBrightness = (dominantColor.r + dominantColor.g + dominantColor.b) / 3;
      if (avgBrightness >= 240) {
        return '#FFFFFF';
      }

      const toHex = (n) => Math.min(255, Math.max(0, n)).toString(16).padStart(2, '0');
      return `#${toHex(dominantColor.r)}${toHex(dominantColor.g)}${toHex(dominantColor.b)}`;
    } catch (e) {
      console.warn('Background sampling notice:', e);
      return '#FFFFFF';
    }
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.BackgroundSampler = BackgroundSampler;
