const path = require('path');
const JSZip = require(path.resolve(__dirname, '../../js/lib/jszip.min.js'));
const PDFLib = require(path.resolve(__dirname, '../../js/lib/pdf-lib.min.js'));
const { startStandaloneServer } = require(path.resolve(__dirname, '../../server.js'));

async function createTestPdf({ text = 'SECRET_TEXT', rotation = 0, width = 600, height = 400, textX = 100, textY = 250, textSize = 20 } = {}) {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([width, height]);
  if (rotation !== 0) {
    page.setRotation(PDFLib.degrees(rotation));
  }
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  page.drawText(text, {
    x: textX,
    y: textY,
    size: textSize,
    font,
    color: PDFLib.rgb(0, 0, 0)
  });
  return await doc.save();
}

async function createColorPdf({ width = 600, height = 400 } = {}) {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([width, height]);
  // Vibrant pure red rectangle (R=255, G=0, B=0)
  page.drawRectangle({
    x: 80,
    y: 180,
    width: 200,
    height: 120,
    color: PDFLib.rgb(1, 0, 0)
  });
  // Vibrant pure blue rectangle (R=0, G=0, B=255)
  page.drawRectangle({
    x: 320,
    y: 180,
    width: 200,
    height: 120,
    color: PDFLib.rgb(0, 0, 1)
  });
  return await doc.save();
}

async function createSampleDocx(text = 'Hello from DOCX Browser Test') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr><w:pStyle w:val="Heading1"/></w:pPr>
      <w:r><w:t>${text}</w:t></w:r>
    </w:p>
  </w:body>
</w:document>`);

  return await zip.generateAsync({ type: 'uint8array' });
}

async function createSampleXlsx(cellText = 'Hello Excel Browser Test') {
  const zip = new JSZip();
  zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);

  zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);

  zip.file('xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="Sheet1" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);

  zip.file('xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);

  zip.file('xl/worksheets/sheet1.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr">
        <is><t>${cellText}</t></is>
      </c>
      <c r="B1">
        <v>999.50</v>
      </c>
    </row>
  </sheetData>
</worksheet>`);

  return await zip.generateAsync({ type: 'uint8array' });
}

function startTestServer(port = 8765) {
  return new Promise((resolve) => {
    const server = startStandaloneServer(port, '127.0.0.1', false);
    // Give it a tiny tick to bind
    setTimeout(() => {
      resolve(server);
    }, 200);
  });
}

module.exports = {
  createTestPdf,
  createColorPdf,
  createSampleDocx,
  createSampleXlsx,
  startTestServer
};
