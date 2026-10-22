/**
 * OCR Layout Engine
 * Converts Tesseract OCR outputs (words, lines, paragraphs, bounding boxes)
 * into high-fidelity TextBlock, TextParagraph, and TextLine models for direct in-place editing.
 */

class OCRLayoutEngine {
  /**
   * Convert Tesseract OCR result into an array of editable TextBlock models
   * @param {Object} tesseractData Result from Tesseract recognize
   * @param {number} ocrScale Scale used during OCR rendering (e.g. 2.0)
   * @param {number} pageNumber
   * @returns {Array<TextBlock>}
   */
  static constructLayoutBlocks(tesseractData, ocrScale = 2.0, pageNumber = 1) {
    if (!tesseractData) return [];

    const blocks = [];
    const sourceParagraphs = (tesseractData.paragraphs && tesseractData.paragraphs.length > 0)
      ? tesseractData.paragraphs
      : [{ lines: tesseractData.lines || [] }];

    for (let pIdx = 0; pIdx < sourceParagraphs.length; pIdx++) {
      const srcPara = sourceParagraphs[pIdx];
      const lines = srcPara.lines || [];
      if (lines.length === 0) continue;

      const blockObj = new window.PDFTools.TextModel.TextBlock();
      const paraObj = new window.PDFTools.TextModel.TextParagraph();

      let pMinX = Infinity, pMinY = Infinity, pMaxX = -Infinity, pMaxY = -Infinity;

      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const l = lines[lIdx];
        const lineText = (l.text || '').replace(/[\r\n]+/g, ' ').trim();
        if (!lineText) continue;

        const x = (l.bbox.x0 || 0) / ocrScale;
        const y = (l.bbox.y0 || 0) / ocrScale;
        const width = Math.max(16, ((l.bbox.x1 || 0) - (l.bbox.x0 || 0)) / ocrScale);
        const height = Math.max(12, ((l.bbox.y1 || 0) - (l.bbox.y0 || 0)) / ocrScale);
        const fontSize = Math.max(9, Math.round(height * 0.82));
        const baseline = l.baseline ? (l.baseline.y0 / ocrScale) : (y + fontSize * 0.82);

        const lineObj = new window.PDFTools.TextModel.TextLine();
        lineObj.id = `ocr_line_${pageNumber}_${pIdx}_${lIdx}`;
        lineObj.text = lineText;
        lineObj.bbox = { x, y, width, height };

        const run = {
          id: `ocr_run_${pageNumber}_${pIdx}_${lIdx}`,
          pageNumber: pageNumber,
          text: lineText,
          originalText: lineText,
          currentText: lineText,
          baselineScreenY: baseline,
          bbox: { x, y, width, height },
          font: {
            size: fontSize,
            family: 'Helvetica',
            normalizedFamily: 'Helvetica',
            bold: false,
            italic: false
          },
          color: '#111827'
        };

        lineObj.addRun(run);
        paraObj.addLine(lineObj);

        pMinX = Math.min(pMinX, x);
        pMinY = Math.min(pMinY, y);
        pMaxX = Math.max(pMaxX, x + width);
        pMaxY = Math.max(pMaxY, y + height);
      }

      if (paraObj.lines.length > 0) {
        paraObj.bbox = { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
        blockObj.paragraphs.push(paraObj);
        blockObj.bbox = { x: pMinX, y: pMinY, width: pMaxX - pMinX, height: pMaxY - pMinY };
        blocks.push(blockObj);
      }
    }

    return blocks;
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.OCRLayoutEngine = OCRLayoutEngine;
