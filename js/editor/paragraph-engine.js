/**
 * Paragraph & Reflow Engine
 * Handles word wrapping, line breaking, alignment offsets, and paragraph reflow calculations.
 */

class ParagraphEngine {
  constructor() {
    this._canvas = null;
    this._ctx = null;
  }

  static getContext() {
    if (!ParagraphEngine._ctx) {
      ParagraphEngine._canvas = document.createElement('canvas');
      ParagraphEngine._ctx = ParagraphEngine._canvas.getContext('2d');
    }
    return ParagraphEngine._ctx;
  }

  /**
   * Measure text width with precise font spec
   */
  static measureText(text, fontSize = 14, fontFamily = 'Helvetica', bold = false, italic = false) {
    const ctx = ParagraphEngine.getContext();
    const style = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${fontSize}px ${fontFamily}, sans-serif`;
    ctx.font = style;
    return ctx.measureText(text).width;
  }

  /**
   * Break text into word-wrapped lines fitting inside maxWidth
   */
  static calculateLineBreaks(text, maxWidth, fontSize = 14, fontFamily = 'Helvetica', bold = false, italic = false) {
    if (!text) return [];
    if (maxWidth <= 0) maxWidth = 500;

    const rawParagraphs = text.split('\n');
    const resultLines = [];

    for (const rawPara of rawParagraphs) {
      if (rawPara.trim() === '') {
        resultLines.push({ text: '', width: 0 });
        continue;
      }

      const words = rawPara.split(/\s+/);
      let currentLine = '';
      let currentWidth = 0;

      for (let i = 0; i < words.length; i++) {
        const word = words[i];
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const testWidth = ParagraphEngine.measureText(testLine, fontSize, fontFamily, bold, italic);

        if (testWidth > maxWidth && currentLine !== '') {
          resultLines.push({ text: currentLine, width: currentWidth });
          currentLine = word;
          currentWidth = ParagraphEngine.measureText(word, fontSize, fontFamily, bold, italic);
        } else {
          currentLine = testLine;
          currentWidth = testWidth;
        }
      }

      if (currentLine) {
        resultLines.push({ text: currentLine, width: currentWidth });
      }
    }

    return resultLines;
  }

  /**
   * Reflow paragraph given new text and bounds
   * @param {Object} originalBBox { x, y, width, height }
   * @param {string} newText
   * @param {Object} style { fontSize, fontFamily, bold, italic, lineHeight, align, mode: 'auto'|'fixed' }
   */
  static reflowParagraph(originalBBox, newText, style = {}) {
    const fontSize = style.fontSize || 14;
    const fontFamily = style.fontFamily || 'Helvetica';
    const bold = !!style.bold;
    const italic = !!style.italic;
    const lineHeight = (style.lineHeight || 1.25) * fontSize;
    const align = style.align || 'left';
    const mode = style.mode || 'auto'; // 'auto' reflows and expands, 'fixed' fits within width

    const maxWidth = mode === 'fixed' && originalBBox.width > 30 ? originalBBox.width : Math.max(originalBBox.width, 120);

    const lines = ParagraphEngine.calculateLineBreaks(newText, maxWidth, fontSize, fontFamily, bold, italic);
    const calculatedHeight = Math.max(lines.length * lineHeight, fontSize * 1.2);
    const maxLineWidth = lines.reduce((max, l) => Math.max(max, l.width), 0);

    const finalWidth = mode === 'fixed' ? originalBBox.width : Math.max(maxLineWidth, originalBBox.width);

    // Compute line items with positions
    const computedLines = lines.map((l, index) => {
      let offsetX = 0;
      if (align === 'center') {
        offsetX = Math.max(0, (finalWidth - l.width) / 2);
      } else if (align === 'right') {
        offsetX = Math.max(0, finalWidth - l.width);
      }

      return {
        text: l.text,
        width: l.width,
        offsetX: offsetX,
        y: originalBBox.y + (index * lineHeight),
        baseline: originalBBox.y + (index * lineHeight) + (fontSize * 0.82)
      };
    });

    return {
      x: originalBBox.x,
      y: originalBBox.y,
      width: finalWidth,
      height: calculatedHeight,
      lines: computedLines,
      lineHeight: lineHeight,
      fontSize: fontSize,
      fontFamily: fontFamily,
      align: align
    };
  }

  /**
   * Detect bounding box collisions with other boxes
   */
  static detectCollisions(targetBox, otherBoxes) {
    if (!otherBoxes || !otherBoxes.length) return [];
    return otherBoxes.filter(box => {
      if (box.id === targetBox.id) return false;
      return (
        targetBox.x < box.x + box.width &&
        targetBox.x + targetBox.width > box.x &&
        targetBox.y < box.y + box.height &&
        targetBox.y + targetBox.height > box.y
      );
    });
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.ParagraphEngine = ParagraphEngine;
