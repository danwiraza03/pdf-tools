/**
 * PDF Tools — PDF to Excel (XLSX) Converter Core Engine
 * Converts tabular PDF documents into editable Microsoft Excel (.xlsx) spreadsheets
 * 100% offline in browser using native Office Open XML (SpreadsheetML) and JSZip.
 * 
 * Features:
 * - Table & Column Grid inference based on spatial X/Y coordinate clustering
 * - Automatic data type parsing (integers, floats, currency vs text)
 * - Multi-sheet option (one sheet per PDF page or combined sheet)
 * - Pure client-side zero-server OOXML generation
 */

window.PDFTools = window.PDFTools || {};

PDFTools.PdfToXlsx = (function () {

  /**
   * Escape XML special characters
   */
  function escapeXml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Convert 0-indexed column number to Excel column letters (0 -> A, 1 -> B, 26 -> AA)
   */
  function getColumnLetter(colIndex) {
    let temp = colIndex + 1;
    let letter = '';
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter;
  }

  /**
   * Parse value and determine if it should be an Excel number or inline string
   */
  function parseCellValue(rawStr) {
    const trimmed = (rawStr || '').trim();
    if (!trimmed) return { type: 'empty', val: '' };

    // Check if numeric (including currency signs, commas as thousands separators, dots as decimals)
    const cleanNum = trimmed.replace(/^[$€£¥Rp\s]+/, '').replace(/,/g, '');
    if (/^-?\d+(\.\d+)?$/.test(cleanNum)) {
      return { type: 'number', val: cleanNum };
    }

    return { type: 'string', val: trimmed };
  }

  /**
   * Build [Content_Types].xml for Excel XLSX package
   */
  function buildContentTypes(sheetsCount) {
    let sheetsXml = '';
    for (let i = 1; i <= sheetsCount; i++) {
      sheetsXml += `  <Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>\n`;
    }

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
${sheetsXml}</Types>`;
  }

  /**
   * Build _rels/.rels
   */
  function buildRootRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
  }

  /**
   * Build xl/_rels/workbook.xml.rels
   */
  function buildWorkbookRels(sheetsCount) {
    let relsXml = '';
    for (let i = 1; i <= sheetsCount; i++) {
      relsXml += `  <Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>\n`;
    }
    const stylesId = sheetsCount + 1;
    relsXml += `  <Relationship Id="rId${stylesId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n`;

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relsXml}</Relationships>`;
  }

  /**
   * Build xl/workbook.xml
   */
  function buildWorkbook(sheetNames) {
    let sheetsXml = '';
    sheetNames.forEach((name, idx) => {
      const sheetId = idx + 1;
      const safeName = escapeXml(name.substring(0, 31)); // Excel max sheet name length is 31
      sheetsXml += `    <sheet name="${safeName}" sheetId="${sheetId}" r:id="rId${sheetId}"/>\n`;
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"
          xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
${sheetsXml}  </sheets>
</workbook>`;
  }

  /**
   * Build xl/styles.xml with standard header and data font styling
   */
  function buildStyles() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b/>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1">
    <border><left/><right/><top/><bottom/><diagonal/></border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>
  </cellXfs>
</styleSheet>`;
  }

  /**
   * Build worksheet XML from grid of row cells
   * @param {Array<Array<{colIndex: number, text: string}>>} rowsData
   */
  function buildWorksheet(rowsData) {
    let sheetDataXml = '';

    rowsData.forEach((rowCells, rIdx) => {
      const rowNum = rIdx + 1;
      if (!rowCells || rowCells.length === 0) return;

      let cellsXml = '';
      rowCells.forEach(cell => {
        const colLetter = getColumnLetter(cell.colIndex);
        const cellRef = `${colLetter}${rowNum}`;
        const parsed = parseCellValue(cell.text);

        if (parsed.type === 'number') {
          cellsXml += `<c r="${cellRef}"><v>${parsed.val}</v></c>`;
        } else if (parsed.type === 'string') {
          cellsXml += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(parsed.val)}</t></is></c>`;
        }
      });

      if (cellsXml) {
        sheetDataXml += `    <row r="${rowNum}">${cellsXml}</row>\n`;
      }
    });

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
${sheetDataXml}  </sheetData>
</worksheet>`;
  }

  /**
   * Spatial clustering algorithm to group text items into table columns
   */
  function clusterColumns(rawLines) {
    // 1. Gather all starting X positions
    const allX = [];
    rawLines.forEach(line => {
      line.items.forEach(it => {
        allX.push(it.x);
      });
    });

    if (allX.length === 0) return [0];

    allX.sort((a, b) => a - b);

    // Cluster X coordinates within 18px tolerance
    const colClusters = [];
    let currentCluster = [allX[0]];

    for (let i = 1; i < allX.length; i++) {
      const x = allX[i];
      const avg = currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length;
      if (Math.abs(x - avg) < 18) {
        currentCluster.push(x);
      } else {
        colClusters.push(avg);
        currentCluster = [x];
      }
    }
    if (currentCluster.length > 0) {
      colClusters.push(currentCluster.reduce((s, v) => s + v, 0) / currentCluster.length);
    }

    return colClusters;
  }

  /**
   * Map an X position to the nearest column cluster index
   */
  function findColIndex(x, colClusters) {
    let nearestIdx = 0;
    let minDiff = Infinity;
    for (let i = 0; i < colClusters.length; i++) {
      const diff = Math.abs(x - colClusters[i]);
      if (diff < minDiff) {
        minDiff = diff;
        nearestIdx = i;
      }
    }
    return nearestIdx;
  }

  /**
   * Main Converter Method
   * @param {File|Blob|ArrayBuffer} input - Source PDF
   * @param {Object} options - { combineSheets?: boolean, onProgress?: Function }
   * @returns {Promise<Blob>} XLSX Blob
   */
  async function convertToXlsx(input, options = {}) {
    const onProgress = options.onProgress || (() => {});
    const combineSheets = !!options.combineSheets;

    onProgress(5, 'Initializing PDF table parser engine...');
    if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
      PDFTools.FileUtils.initPdfJsWorker();
    }

    let arrayBuffer;
    if (input instanceof ArrayBuffer) {
      arrayBuffer = input;
    } else if (input.arrayBuffer) {
      arrayBuffer = await input.arrayBuffer();
    } else {
      arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(input);
    }

    let pdfDoc;
    try {
      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
      pdfDoc = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException' || (err.message && err.message.toLowerCase().includes('password'))) {
        throw new Error('Dokumen PDF ini dilindungi kata sandi. Silakan buka kuncinya terlebih dahulu di menu Protect & Unlock.');
      }
      throw new Error('Gagal membaca PDF: Dokumen rusak atau format tidak didukung.');
    }
    const totalPages = pdfDoc.numPages;

    const parsedPagesData = []; // Array of rowsData per page

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pct = Math.round(10 + ((pageNum / totalPages) * 70));
      onProgress(pct, `Extracting tabular rows from page ${pageNum} of ${totalPages}...`);

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });
      const viewport = page.getViewport({ scale: 1.0 });

      // Group into lines by Y coordinate
      const lines = [];
      const yTolerance = 5;

      for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;

        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const x = tx[4];
        const y = tx[5];

        let line = lines.find(l => Math.abs(l.y - y) <= yTolerance);
        if (!line) {
          line = { y: y, items: [] };
          lines.push(line);
        }

        line.items.push({
          text: item.str,
          x: x,
          width: item.width || 0
        });
      }

      // Sort lines top-to-bottom
      lines.sort((a, b) => a.y - b.y);

      // Sort items inside each line left-to-right
      lines.forEach(l => l.items.sort((a, b) => a.x - b.x));

      // Infer table column structure
      const colClusters = clusterColumns(lines);

      // Map lines to table cells
      const pageRowsData = [];
      lines.forEach(line => {
        const rowCellsMap = new Map(); // colIndex -> text

        line.items.forEach(it => {
          const cIdx = findColIndex(it.x, colClusters);
          if (rowCellsMap.has(cIdx)) {
            // Concatenate multi-words within same cell
            rowCellsMap.set(cIdx, rowCellsMap.get(cIdx) + ' ' + it.text);
          } else {
            rowCellsMap.set(cIdx, it.text);
          }
        });

        const rowCells = [];
        rowCellsMap.forEach((text, colIndex) => {
          rowCells.push({ colIndex: colIndex, text: text.trim() });
        });
        rowCells.sort((a, b) => a.colIndex - b.colIndex);

        if (rowCells.length > 0) {
          pageRowsData.push(rowCells);
        }
      });

      parsedPagesData.push(pageRowsData);
    }

    onProgress(85, 'Constructing Excel OpenXML workbook structure...');

    const zip = new JSZip();
    const sheetNames = [];

    if (combineSheets || totalPages === 1) {
      // Single combined sheet
      sheetNames.push('Sheet1');
      const combinedRows = [];
      parsedPagesData.forEach((pageRows, pIdx) => {
        if (pIdx > 0 && pageRows.length > 0) {
          // Empty spacer row between pages
          combinedRows.push([]);
        }
        pageRows.forEach(r => combinedRows.push(r));
      });
      zip.file('xl/worksheets/sheet1.xml', buildWorksheet(combinedRows));
    } else {
      // One sheet per page
      parsedPagesData.forEach((pageRows, pIdx) => {
        const sheetNum = pIdx + 1;
        sheetNames.push(`Page ${sheetNum}`);
        zip.file(`xl/worksheets/sheet${sheetNum}.xml`, buildWorksheet(pageRows));
      });
    }

    const sheetsCount = sheetNames.length;
    zip.file('[Content_Types].xml', buildContentTypes(sheetsCount));
    zip.file('_rels/.rels', buildRootRels());
    zip.file('xl/_rels/workbook.xml.rels', buildWorkbookRels(sheetsCount));
    zip.file('xl/workbook.xml', buildWorkbook(sheetNames));
    zip.file('xl/styles.xml', buildStyles());

    onProgress(92, 'Packaging final XLSX spreadsheet file...');

    const xlsxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    onProgress(100, 'Excel spreadsheet ready!');
    return xlsxBlob;
  }

  return {
    convertToXlsx: convertToXlsx
  };
})();
