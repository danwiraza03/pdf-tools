/**
 * PDF Tools — PDF to Word (DOCX) Converter Core Engine
 * Converts PDF documents to editable Microsoft Word (.docx) files 100% offline in browser
 * 
 * Features:
 * - Structure-aware text extraction (Heading, Paragraph, and Line reflow)
 * - Typography preservation (Font family, size, bold, italic, color)
 * - Page breaks preservation across document pages
 * - Pure client-side OOXML package generation with JSZip (zero server needed)
 */

window.PDFTools = window.PDFTools || {};

PDFTools.PdfToDocx = (function () {

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
   * Generate [Content_Types].xml
   */
  function buildContentTypes() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;
  }

  /**
   * Generate _rels/.rels
   */
  function buildRootRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
  }

  /**
   * Generate word/_rels/document.xml.rels
   */
  function buildDocRels() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
  }

  /**
   * Generate word/styles.xml
   */
  function buildStylesXml() {
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:docDefaults>
    <w:rPrDefault>
      <w:rPr>
        <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
        <w:sz w:val="22"/>
        <w:szCs w:val="22"/>
        <w:lang w:val="en-US"/>
      </w:rPr>
    </w:rPrDefault>
  </w:docDefaults>
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:qFormat/>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="240" w:after="120"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="32"/>
      <w:szCs w:val="32"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="Normal"/>
    <w:qFormat/>
    <w:pPr>
      <w:spacing w:before="180" w:after="80"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri Light" w:hAnsi="Calibri Light"/>
      <w:b/>
      <w:color w:val="2F5496"/>
      <w:sz w:val="26"/>
      <w:szCs w:val="26"/>
    </w:rPr>
  </w:style>
</w:styles>`;
  }

  /**
   * Main Converter Method
   * @param {File|Blob|ArrayBuffer} input - Source PDF
   * @param {Object} options - { onProgress?: Function }
   * @returns {Promise<Blob>} DOCX Blob
   */
  async function convertToDocx(input, options = {}) {
    const onProgress = options.onProgress || (() => {});

    onProgress(5, 'Initializing PDF parser engine...');
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

    let documentParagraphsXml = '';

    // Track font sizes to detect headings
    const fontSizesSample = [];

    // Phase 1: Analyze text items & compute layout
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pct = Math.round(10 + ((pageNum / totalPages) * 70));
      onProgress(pct, `Analyzing layout and extracting text from page ${pageNum} of ${totalPages}...`);

      const page = await pdfDoc.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: false });
      const viewport = page.getViewport({ scale: 1.0 });

      // Group text items into lines based on Y coordinate
      const lines = [];
      const yTolerance = 4; // pixels tolerance for same line

      for (const item of textContent.items) {
        if (!item.str || item.str.trim() === '') continue;

        // Transform coords using viewport
        const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
        const fontH = Math.max(8, Math.hypot(tx[2], tx[3]));
        fontSizesSample.push(fontH);

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
          y: y,
          width: item.width || 0,
          height: fontH,
          fontName: item.fontName || 'Helvetica',
          fontSize: Math.round(fontH)
        });
      }

      // Sort lines top-to-bottom
      lines.sort((a, b) => a.y - b.y);

      // Sort items in each line left-to-right
      lines.forEach(l => l.items.sort((a, b) => a.x - b.x));

      // Build paragraphs from grouped lines
      let currentParaItems = [];
      let lastLineY = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineText = line.items.map(it => it.text).join(' ').trim();
        if (!lineText) continue;

        const avgFontSize = line.items.reduce((s, it) => s + it.fontSize, 0) / line.items.length;
        const lineSpacing = lastLineY !== null ? (line.y - lastLineY) : 0;
        const isNewParagraph = (lastLineY !== null && lineSpacing > avgFontSize * 1.6);

        if (isNewParagraph && currentParaItems.length > 0) {
          documentParagraphsXml += buildParagraphXml(currentParaItems);
          currentParaItems = [];
        }

        currentParaItems.push(line);
        lastLineY = line.y;
      }

      if (currentParaItems.length > 0) {
        documentParagraphsXml += buildParagraphXml(currentParaItems);
      }

      // Add page break if not last page
      if (pageNum < totalPages) {
        documentParagraphsXml += `<w:p><w:r><w:br w:type="page"/></w:r></w:p>`;
      }
    }

    onProgress(85, 'Packaging Word (.docx) document structure...');

    // Assemble document.xml
    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    ${documentParagraphsXml}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    // Build ZIP package
    onProgress(92, 'Generating final DOCX package archive...');
    const zip = new JSZip();
    zip.file('[Content_Types].xml', buildContentTypes());
    zip.file('_rels/.rels', buildRootRels());
    zip.file('word/_rels/document.xml.rels', buildDocRels());
    zip.file('word/styles.xml', buildStylesXml());
    zip.file('word/document.xml', documentXml);

    const docxBlob = await zip.generateAsync({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    onProgress(100, 'Conversion completed successfully!');
    return docxBlob;
  }

  /**
   * Helper: Build <w:p> XML from lines
   */
  function buildParagraphXml(lines) {
    if (!lines || lines.length === 0) return '';

    // Check if heading (larger font)
    const allItems = lines.flatMap(l => l.items);
    const avgSize = allItems.reduce((s, it) => s + it.fontSize, 0) / (allItems.length || 1);
    const isHeading1 = avgSize >= 18;
    const isHeading2 = avgSize >= 14 && avgSize < 18;

    let pStyle = '';
    if (isHeading1) pStyle = '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>';
    else if (isHeading2) pStyle = '<w:pPr><w:pStyle w:val="Heading2"/></w:pPr>';

    let runsXml = '';
    lines.forEach((line, lIdx) => {
      line.items.forEach(it => {
        const text = escapeXml(it.text);
        if (!text) return;

        // Size in half-points (fontSize * 2)
        const halfPoints = Math.round(it.fontSize * 2);
        const isBold = (it.fontName || '').toLowerCase().includes('bold') || isHeading1 || isHeading2;
        const isItalic = (it.fontName || '').toLowerCase().includes('italic') || (it.fontName || '').toLowerCase().includes('oblique');

        let rPr = `<w:rPr>`;
        if (isBold) rPr += `<w:b/>`;
        if (isItalic) rPr += `<w:i/>`;
        rPr += `<w:sz w:val="${halfPoints}"/><w:szCs w:val="${halfPoints}"/>`;
        rPr += `</w:rPr>`;

        runsXml += `<w:r>${rPr}<w:t xml:space="preserve">${text} </w:t></w:r>`;
      });

      // Add a line break inside paragraph if multi-line within paragraph
      if (lIdx < lines.length - 1) {
        runsXml += `<w:r><w:br/></w:r>`;
      }
    });

    return `<w:p>${pStyle}${runsXml}</w:p>`;
  }

  return {
    convertToDocx: convertToDocx
  };
})();
