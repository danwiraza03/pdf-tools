/**
 * Text Fit Engine
 * Evaluates whether replacement text fits within original bounding box constraints.
 * Protects documents from accidental layout overflow without silent automatic mutations.
 */

class TextFitEngine {
  static STATE_FIT = 'FIT';
  static STATE_NEAR_LIMIT = 'NEAR_LIMIT';
  static STATE_OVERFLOW = 'OVERFLOW';

  /**
   * Measure precise text width using canvas font metrics
   */
  static measureWidth(text, fontSize = 12, fontFamily = 'Helvetica', bold = false, italic = false) {
    if (!text) return 0;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const bStr = bold ? 'bold ' : '';
    const iStr = italic ? 'italic ' : '';
    ctx.font = `${iStr}${bStr}${fontSize}px ${fontFamily}, sans-serif`;
    return ctx.measureText(text).width;
  }

  /**
   * Evaluate if edited text fits inside original bounding box
   * @param {string} editedText
   * @param {number} originalWidth Original bounding box width in points
   * @param {number} fontSize
   * @param {string} fontFamily
   * @param {boolean} bold
   * @param {boolean} italic
   */
  static evaluateFit(editedText, originalWidth, fontSize = 12, fontFamily = 'Helvetica', bold = false, italic = false) {
    const measuredWidth = TextFitEngine.measureWidth(editedText, fontSize, fontFamily, bold, italic);
    const tolerance = 2.0; // 2pt safety buffer

    let state = TextFitEngine.STATE_FIT;
    let message = 'Fits original area';

    if (measuredWidth > (originalWidth + tolerance)) {
      state = TextFitEngine.STATE_OVERFLOW;
      message = 'Text exceeds original area';
    } else if (measuredWidth > (originalWidth - 6.0)) {
      state = TextFitEngine.STATE_NEAR_LIMIT;
      message = 'Near boundary limit';
    }

    return {
      state: state,
      originalWidth: originalWidth,
      editedWidth: measuredWidth,
      diff: measuredWidth - originalWidth,
      fits: state !== TextFitEngine.STATE_OVERFLOW,
      message: message,
      availableOptions: [
        'Keep Original Layout',
        'Reduce Font Size',
        'Expand Text Box',
        'Enable Reflow'
      ],
      defaultOption: 'Keep Original Layout'
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.TextFitEngine = TextFitEngine;
