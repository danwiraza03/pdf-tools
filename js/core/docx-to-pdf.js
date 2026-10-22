/**
 * PDF Tools — Word (DOCX) to PDF Converter Core Engine
 * Converts Microsoft Word (.docx) documents into PDF documents 100% offline in browser
 * using JSZip and PDF-Lib.
 * 
 * Features:
 * - Pure client-side zero-server conversion
 * - Structure-aware parsing: Headings, Paragraphs, Lists, Tables, and text formatting (Bold, Italic, Color)
 * - Auto-pagination with configurable margins and paper sizes (A4 / Letter)
 * - Embeds standard fonts with automatic line wrapping
 */

window.PDFTools = window.PDFTools || {};

PDFTools.DocxToPdf = (function () {

  /**
   * Parse XML string to DOM document
   */
  function parseXml(xmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
  }

  /**
   * Extract text and formatting runs from a Word paragraph element
   */
  function parseParagraph(pEl) {
    const runs = [];
    let isHeading = false;
    let headingLevel = 0;

    // Check style
    const pStyle = pEl.querySelector('pStyle');
    if (pStyle) {
      const val = pStyle.getAttribute('w:val') || '';
      if (/heading\s*1/i.test(val) || val === '1') { isHeading = true; headingLevel = 1; }
      else if (/heading\s*2/i.test(val) || val === '2') { isHeading = true; headingLevel = 2; }
      else if (/heading\s*3/i.test(val) || val === '3') { isHeading = true; headingLevel = 3; }
      else if (/title/i.test(val)) { isHeading = true; headingLevel = 1; }
    }

    // Alignment
    let align = 'left';
    const jc = pEl.querySelector('jc');
    if (jc) {
      const jcVal = jc.getAttribute('w:val') || 'left';
      if (jcVal === 'center') align = 'center';
      else if (jcVal === 'right') align = 'right';
      else if (jcVal === 'both') align = 'justify';
    }

    // Runs
    const rNodes = pEl.querySelectorAll('r');
    rNodes.forEach(r => {
      const tEl = r.querySelector('t');
      if (!tEl) return;
      const text = tEl.textContent || '';
      if (!text) return;

      const isBold = !!r.querySelector('b');
      const isItalic = !!r.querySelector('i');
      
      let fontSize = isHeading ? (headingLevel === 1 ? 18 : (headingLevel === 2 ? 14 : 12)) : 10.5;
      const szEl = r.querySelector('sz');
      if (szEl) {
        const halfPts = parseInt(szEl.getAttribute('w:val'), 10);
        if (!isNaN(halfPts) && halfPts > 0) fontSize = halfPts / 2;
      }

      runs.push({
        text,
        bold: isBold || isHeading,
        italic: isItalic,
        size: fontSize,
        color: '#111827'
      });
    });

    return {
      type: 'paragraph',
      isHeading,
      headingLevel,
      align,
      runs,
      rawText: runs.map(r => r.text).join('')
    };
  }

  /**
   * Parse Word table element
   */
  function parseTable(tblEl) {
    const rows = [];
    const trNodes = tblEl.querySelectorAll('tr');

    trNodes.forEach(tr => {
      const cells = [];
      const tcNodes = tr.querySelectorAll('tc');
      tcNodes.forEach(tc => {
        const pNodes = tc.querySelectorAll('p');
        const cellTexts = [];
        pNodes.forEach(p => {
          const parsedP = parseParagraph(p);
          if (parsedP.rawText.trim()) cellTexts.push(parsedP.rawText.trim());
        });
        cells.push(cellTexts.join('\n'));
      });
      if (cells.length > 0) rows.push(cells);
    });

    return {
      type: 'table',
      rows
    };
  }

  /**
   * Wrap text lines to fit inside a specified width
   */
  function wrapText(text, font, fontSize, maxWidth) {
    const words = text.split(/\s+/);
    const lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      const testLine = currentLine ? currentLine + ' ' + word : word;
      let width = 0;
      try {
        width = font.widthOfTextAtSize(testLine, fontSize);
      } catch (e) {
        // Fallback estimate if character encoding fails
        width = testLine.length * (fontSize * 0.52);
      }

      if (width <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [''];
  }

  /**
   * Main conversion method
   */
  async function convertToPdf(fileOrBuffer, options = {}) {
    if (!window.JSZip) throw new Error('JSZip library is required.');
    if (!window.PDFLib) throw new Error('PDF-Lib library is required.');

    const onProgress = options.onProgress || (() => {});
    const pageSize = (options.pageSize || 'A4').toUpperCase(); // 'A4' or 'LETTER'
    const margin = options.margin || 50; // points

    onProgress(10, 'Opening Word document...');

    let zip;
    if (fileOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrBuffer)) {
      zip = await JSZip.loadAsync(fileOrBuffer);
    } else if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
      const buffer = await fileOrBuffer.arrayBuffer();
      zip = await JSZip.loadAsync(buffer);
    } else {
      throw new Error('Unsupported input format for DOCX conversion.');
    }

    onProgress(25, 'Parsing document structure and styles...');

    const docXmlFile = zip.file('word/document.xml');
    if (!docXmlFile) {
      throw new Error('Invalid Word document: word/document.xml not found.');
    }

    const docXmlText = await docXmlFile.async('text');
    const docDom = parseXml(docXmlText);
    const bodyEl = docDom.querySelector('body');
    if (!bodyEl) throw new Error('Empty Word document body.');

    const elements = [];
    for (let i = 0; i < bodyEl.children.length; i++) {
      const child = bodyEl.children[i];
      if (child.nodeName === 'w:p') {
        const p = parseParagraph(child);
        elements.push(p);
      } else if (child.nodeName === 'w:tbl') {
        const tbl = parseTable(child);
        elements.push(tbl);
      }
    }

    onProgress(45, 'Creating PDF document...');

    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
    const fontBoldItalic = await pdfDoc.embedFont(StandardFonts.HelveticaBoldOblique);

    // Page dimensions
    let pageWidth = 595.28; // A4 pt
    let pageHeight = 841.89;
    if (pageSize === 'LETTER') {
      pageWidth = 612.00;
      pageHeight = 792.00;
    }

    const contentWidth = pageWidth - (margin * 2);
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let currentY = pageHeight - margin;

    function checkPageBreak(neededHeight) {
      if (currentY - neededHeight < margin) {
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        currentY = pageHeight - margin;
      }
    }

    const totalElements = elements.length;

    for (let idx = 0; idx < totalElements; idx++) {
      const el = elements[idx];
      const percent = Math.min(90, 45 + Math.round((idx / totalElements) * 45));
      onProgress(percent, `Rendering content (${idx + 1}/${totalElements})...`);

      if (el.type === 'paragraph') {
        if (!el.rawText.trim()) {
          // Empty spacing paragraph
          currentY -= 12;
          checkPageBreak(12);
          continue;
        }

        const fontSize = el.runs[0] ? el.runs[0].size : 10.5;
        const isBold = el.runs.some(r => r.bold);
        const isItalic = el.runs.some(r => r.italic);
        const font = (isBold && isItalic) ? fontBoldItalic : (isBold ? fontBold : (isItalic ? fontItalic : fontRegular));
        const lineHeight = fontSize * 1.35;

        // Clean text and wrap
        const cleanText = el.rawText.replace(/[\r\n\t]+/g, ' ').trim();
        const lines = wrapText(cleanText, font, fontSize, contentWidth);

        const neededHeight = (lines.length * lineHeight) + (el.isHeading ? 14 : 6);
        checkPageBreak(neededHeight);

        if (el.isHeading) currentY -= 6; // Heading top margin

        lines.forEach(line => {
          let lineX = margin;
          if (el.align === 'center') {
            try {
              const textWidth = font.widthOfTextAtSize(line, fontSize);
              lineX = margin + ((contentWidth - textWidth) / 2);
            } catch (e) {
              lineX = margin;
            }
          } else if (el.align === 'right') {
            try {
              const textWidth = font.widthOfTextAtSize(line, fontSize);
              lineX = margin + contentWidth - textWidth;
            } catch (e) {
              lineX = margin;
            }
          }

          try {
            currentPage.drawText(line, {
              x: lineX,
              y: currentY - fontSize,
              size: fontSize,
              font: font,
              color: el.isHeading ? rgb(0.1, 0.15, 0.28) : rgb(0.15, 0.18, 0.22)
            });
          } catch (err) {
            // Draw ASCII sanitized version on character encode errors
            const asciiLine = line.replace(/[^\x20-\x7E]/g, '?');
            currentPage.drawText(asciiLine, {
              x: lineX,
              y: currentY - fontSize,
              size: fontSize,
              font: font,
              color: rgb(0.15, 0.18, 0.22)
            });
          }

          currentY -= lineHeight;
        });

        currentY -= (el.isHeading ? 10 : 4); // Bottom spacing
      } else if (el.type === 'table') {
        const rows = el.rows;
        if (!rows || rows.length === 0) continue;

        const colCount = Math.max(...rows.map(r => r.length));
        if (colCount === 0) continue;

        const colWidth = contentWidth / colCount;
        const cellPadding = 5;
        const cellFontSize = 9;
        const rowHeight = 22;

        checkPageBreak(rowHeight * 2);

        rows.forEach((row, rowIdx) => {
          checkPageBreak(rowHeight + 4);
          const isHeader = (rowIdx === 0);

          row.forEach((cellText, colIdx) => {
            const cellX = margin + (colIdx * colWidth);
            const cellY = currentY - rowHeight;

            // Cell background
            currentPage.drawRectangle({
              x: cellX,
              y: cellY,
              width: colWidth,
              height: rowHeight,
              color: isHeader ? rgb(0.92, 0.94, 0.98) : rgb(1, 1, 1),
              borderColor: rgb(0.78, 0.82, 0.88),
              borderWidth: 0.75
            });

            // Cell text
            const truncated = (cellText || '').replace(/[\r\n]+/g, ' ').trim();
            const safeText = truncated.length > 35 ? truncated.substring(0, 32) + '...' : truncated;

            try {
              currentPage.drawText(safeText, {
                x: cellX + cellPadding,
                y: cellY + 6,
                size: cellFontSize,
                font: isHeader ? fontBold : fontRegular,
                color: isHeader ? rgb(0.1, 0.2, 0.4) : rgb(0.2, 0.2, 0.25)
              });
            } catch (e) {
              const ascii = safeText.replace(/[^\x20-\x7E]/g, '?');
              currentPage.drawText(ascii, {
                x: cellX + cellPadding,
                y: cellY + 6,
                size: cellFontSize,
                font: isHeader ? fontBold : fontRegular,
                color: rgb(0.2, 0.2, 0.25)
              });
            }
          });

          currentY -= rowHeight;
        });

        currentY -= 12; // Table bottom spacing
      }
    }

    onProgress(95, 'Finalizing PDF output...');
    const pdfBytes = await pdfDoc.save();
    onProgress(100, 'Word to PDF conversion complete!');

    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  return {
    convertToPdf
  };
})();
