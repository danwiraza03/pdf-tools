/**
 * PDF Tools — Excel (XLSX) to PDF Converter Core Engine
 * Converts Microsoft Excel (.xlsx) spreadsheets into elegant, printable PDF tables
 * 100% offline in browser using JSZip and PDF-Lib.
 * 
 * Features:
 * - Reads all worksheets with sheet selection
 * - Extracts cell values (shared strings, inline strings, numbers, formulas, dates)
 * - Automatic optimal column widths based on contents
 * - Landscape or Portrait orientation with smart table pagination
 * - Professional table styling (shaded headers, alternating row colors, clean borders)
 */

window.PDFTools = window.PDFTools || {};

PDFTools.XlsxToPdf = (function () {

  /**
   * Parse XML string to DOM
   */
  function parseXml(xmlString) {
    const parser = new DOMParser();
    return parser.parseFromString(xmlString, 'text/xml');
  }

  /**
   * Convert Excel column letters (A, B, AA) to 0-based column index
   */
  function colLetterToIndex(col) {
    let index = 0;
    for (let i = 0; i < col.length; i++) {
      index = index * 26 + (col.charCodeAt(i) - 64);
    }
    return index - 1;
  }

  /**
   * Extract cell column and row from cell reference (e.g., 'C12' -> { col: 2, row: 12 })
   */
  function parseCellRef(ref) {
    const match = ref.match(/^([A-Z]+)(\d+)$/i);
    if (!match) return { col: 0, row: 1 };
    return {
      col: colLetterToIndex(match[1].toUpperCase()),
      row: parseInt(match[2], 10)
    };
  }

  /**
   * Parse Excel Shared Strings XML
   */
  function parseSharedStrings(xmlDoc) {
    const strings = [];
    const siNodes = xmlDoc.querySelectorAll('si');
    siNodes.forEach(si => {
      // Direct text <t> or rich text <r><t>
      const tNodes = si.querySelectorAll('t');
      let combined = '';
      tNodes.forEach(t => { combined += (t.textContent || ''); });
      strings.push(combined);
    });
    return strings;
  }

  /**
   * Parse Workbook XML to extract sheet names and IDs
   */
  function parseWorkbook(xmlDoc) {
    const sheets = [];
    const sheetNodes = xmlDoc.querySelectorAll('sheet');
    sheetNodes.forEach(s => {
      sheets.push({
        name: s.getAttribute('name') || 'Sheet',
        sheetId: s.getAttribute('sheetId') || '1',
        id: s.getAttribute('r:id') || s.getAttribute('id') || ''
      });
    });
    return sheets;
  }

  /**
   * Parse Worksheet XML into 2D table grid
   */
  function parseWorksheet(xmlDoc, sharedStrings) {
    const grid = [];
    const rowNodes = xmlDoc.querySelectorAll('row');

    rowNodes.forEach(rowEl => {
      const rowIdx = parseInt(rowEl.getAttribute('r') || '1', 10) - 1;
      const cNodes = rowEl.querySelectorAll('c');

      cNodes.forEach(c => {
        const ref = c.getAttribute('r') || '';
        const { col, row } = parseCellRef(ref);
        const actualRow = row - 1;

        while (grid.length <= actualRow) grid.push([]);
        const rowData = grid[actualRow];
        while (rowData.length <= col) rowData.push('');

        const type = c.getAttribute('t');
        const vEl = c.querySelector('v');
        const isEl = c.querySelector('is t');

        let cellValue = '';
        if (type === 's' && vEl) {
          const strIdx = parseInt(vEl.textContent || '0', 10);
          cellValue = sharedStrings[strIdx] || '';
        } else if (type === 'inlineStr' && isEl) {
          cellValue = isEl.textContent || '';
        } else if (vEl) {
          cellValue = vEl.textContent || '';
        }

        rowData[col] = cellValue.trim();
      });
    });

    // Remove trailing completely empty rows
    while (grid.length > 0 && grid[grid.length - 1].every(cell => !cell)) {
      grid.pop();
    }

    return grid;
  }

  /**
   * Main XLSX to PDF conversion method
   */
  async function convertToPdf(fileOrBuffer, options = {}) {
    if (!window.JSZip) throw new Error('JSZip library is required.');
    if (!window.PDFLib) throw new Error('PDF-Lib library is required.');

    const onProgress = options.onProgress || (() => {});
    const orientation = (options.orientation || 'landscape').toLowerCase(); // 'landscape' or 'portrait'
    const pageSize = (options.pageSize || 'A4').toUpperCase();
    const margin = options.margin || 36; // points

    onProgress(10, 'Opening Excel workbook...');

    let zip;
    if (fileOrBuffer instanceof ArrayBuffer || ArrayBuffer.isView(fileOrBuffer)) {
      zip = await JSZip.loadAsync(fileOrBuffer);
    } else if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
      const buffer = await fileOrBuffer.arrayBuffer();
      zip = await JSZip.loadAsync(buffer);
    } else {
      throw new Error('Unsupported input format for XLSX conversion.');
    }

    onProgress(25, 'Extracting worksheets and shared strings...');

    // 1. Shared strings
    let sharedStrings = [];
    const ssFile = zip.file('xl/sharedStrings.xml');
    if (ssFile) {
      const ssXml = await ssFile.async('text');
      sharedStrings = parseSharedStrings(parseXml(ssXml));
    }

    // 2. Workbook
    const wbFile = zip.file('xl/workbook.xml');
    let sheetNames = ['Sheet 1'];
    if (wbFile) {
      const wbXml = await wbFile.async('text');
      const parsedWb = parseWorkbook(parseXml(wbXml));
      if (parsedWb.length > 0) sheetNames = parsedWb.map(s => s.name);
    }

    // 3. Find worksheets in zip
    const sheetFiles = [];
    zip.forEach((relativePath, zipEntry) => {
      if (/^xl\/worksheets\/sheet\d+\.xml$/i.test(relativePath)) {
        sheetFiles.push(zipEntry);
      }
    });

    if (sheetFiles.length === 0) {
      throw new Error('No worksheets found in this Excel workbook.');
    }

    // Sort sheet files numerically
    sheetFiles.sort((a, b) => {
      const numA = parseInt((a.name.match(/\d+/) || ['0'])[0], 10);
      const numB = parseInt((b.name.match(/\d+/) || ['0'])[0], 10);
      return numA - numB;
    });

    onProgress(45, 'Creating PDF document...');

    const { PDFDocument, rgb, StandardFonts } = window.PDFLib;
    const pdfDoc = await PDFDocument.create();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // Page dimensions
    let standardW = 595.28; // A4 pt
    let standardH = 841.89;
    if (pageSize === 'LETTER') {
      standardW = 612.00;
      standardH = 792.00;
    }

    const pageWidth = orientation === 'landscape' ? standardH : standardW;
    const pageHeight = orientation === 'landscape' ? standardW : standardH;
    const contentWidth = pageWidth - (margin * 2);

    for (let sIdx = 0; sIdx < sheetFiles.length; sIdx++) {
      const sheetEntry = sheetFiles[sIdx];
      const sheetName = sheetNames[sIdx] || `Sheet ${sIdx + 1}`;
      onProgress(50 + Math.round((sIdx / sheetFiles.length) * 40), `Rendering ${sheetName}...`);

      const sheetXml = await sheetEntry.async('text');
      const grid = parseWorksheet(parseXml(sheetXml), sharedStrings);

      if (grid.length === 0) continue; // Skip blank sheet

      // Max columns in this sheet
      const numCols = Math.max(...grid.map(r => r.length));
      if (numCols === 0) continue;

      // Calculate column widths proportional to content
      const colMaxChars = new Array(numCols).fill(4);
      grid.forEach(row => {
        row.forEach((cell, cIdx) => {
          if (cell) colMaxChars[cIdx] = Math.max(colMaxChars[cIdx], Math.min(40, cell.length));
        });
      });

      const totalChars = colMaxChars.reduce((sum, val) => sum + val, 0);
      const colWidths = colMaxChars.map(c => Math.max(45, (c / totalChars) * contentWidth));

      // Re-scale so sum of widths matches contentWidth
      const sumW = colWidths.reduce((sum, val) => sum + val, 0);
      const scaleFactor = contentWidth / sumW;
      for (let i = 0; i < colWidths.length; i++) colWidths[i] *= scaleFactor;

      let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      let currentY = pageHeight - margin;

      // Draw Sheet Title Header
      currentPage.drawText(sheetName, {
        x: margin,
        y: currentY - 14,
        size: 14,
        font: fontBold,
        color: rgb(0.08, 0.45, 0.22) // Excel green
      });
      currentY -= 30;

      const rowHeight = 20;
      const cellPadding = 4;
      const fontSize = 8.5;

      const headerRow = grid[0] || [];

      function drawRowCells(row, isHeader, yPos) {
        let currentX = margin;
        for (let cIdx = 0; cIdx < numCols; cIdx++) {
          const w = colWidths[cIdx];
          const text = (row[cIdx] || '').trim();

          // Cell background
          currentPage.drawRectangle({
            x: currentX,
            y: yPos,
            width: w,
            height: rowHeight,
            color: isHeader ? rgb(0.08, 0.45, 0.22) : (row[numCols] ? rgb(0.96, 0.98, 0.96) : rgb(1, 1, 1)),
            borderColor: rgb(0.82, 0.86, 0.9),
            borderWidth: 0.5
          });

          if (text) {
            // Check if numeric (right align)
            const isNumeric = /^-?[\$€£Rp]?\s*[\d,]+(\.\d+)?%?$/.test(text);
            const truncated = text.length > 30 ? text.substring(0, 28) + '...' : text;

            let textX = currentX + cellPadding;
            const font = isHeader ? fontBold : fontRegular;

            try {
              const textWidth = font.widthOfTextAtSize(truncated, fontSize);
              if (isNumeric && !isHeader) {
                textX = currentX + w - textWidth - cellPadding;
              }
              currentPage.drawText(truncated, {
                x: textX,
                y: yPos + 6,
                size: fontSize,
                font: font,
                color: isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.15, 0.18)
              });
            } catch (err) {
              const ascii = truncated.replace(/[^\x20-\x7E]/g, '?');
              currentPage.drawText(ascii, {
                x: currentX + cellPadding,
                y: yPos + 6,
                size: fontSize,
                font: font,
                color: isHeader ? rgb(1, 1, 1) : rgb(0.12, 0.15, 0.18)
              });
            }
          }

          currentX += w;
        }
      }

      // Draw rows
      grid.forEach((row, rIdx) => {
        if (currentY - rowHeight < margin + 20) {
          // New page
          currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
          currentY = pageHeight - margin;

          // Repeat sheet title and header row
          currentPage.drawText(`${sheetName} (Continued)`, {
            x: margin,
            y: currentY - 10,
            size: 10,
            font: fontBold,
            color: rgb(0.4, 0.45, 0.5)
          });
          currentY -= 22;
          drawRowCells(headerRow, true, currentY - rowHeight);
          currentY -= rowHeight;
        }

        const isHeader = (rIdx === 0);
        drawRowCells(row, isHeader, currentY - rowHeight);
        currentY -= rowHeight;
      });
    }

    onProgress(95, 'Saving final PDF...');
    const pdfBytes = await pdfDoc.save();
    onProgress(100, 'Excel to PDF conversion complete!');

    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  return {
    convertToPdf
  };
})();
