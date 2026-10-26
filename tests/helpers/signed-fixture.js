/**
 * Test Helper: Signed PDF & Normal PDF Fixtures
 *
 * Generates synthetic PDFs for testing digital signature stripping and stamp conversion:
 * 1. Signed PDF: Page 1 with "KONTRAK-ASLI" text, visual /AP appearance Form XObject,
 *    /Widget /FT /Sig annotation containing /V with /ByteRange and /Contents,
 *    and Catalog with /AcroForm (/SigFlags 3), /DSS, and /Perms.
 * 2. Normal PDF: Standard unsigned document.
 */

'use strict';

const path = require('path');

async function createSignedPdfFixture(PDFLib) {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([595, 842]);

  // Page 1: Text "KONTRAK-ASLI"
  const helvFont = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  page.drawText('KONTRAK-ASLI', {
    x: 50,
    y: 700,
    size: 24,
    font: helvFont,
    color: PDFLib.rgb(0.1, 0.1, 0.1)
  });

  // /AP appearance stream: colored box (deep blue #2659BF) and text
  // BBox [0, 0, 200, 100], Rect [50, 450, 250, 550]
  const apStream = doc.context.flateStream(
    'q 0.15 0.35 0.75 rg 0 0 200 100 re f Q BT /Helv 12 Tf 1 1 1 rg 15 45 Td (VERIFIED DIGITAL SIGNATURE) Tj ET',
    {
      Type: 'XObject',
      Subtype: 'Form',
      BBox: [0, 0, 200, 100],
      Resources: {
        Font: {
          Helv: helvFont.ref
        }
      }
    }
  );
  const apRef = doc.context.register(apStream);

  // Signature annotation: /Widget, /FT /Sig, /V with ByteRange and Contents, /AP
  const sigDict = doc.context.obj({
    Type: 'Annot',
    Subtype: 'Widget',
    FT: 'Sig',
    Rect: [50, 450, 250, 550],
    T: PDFLib.PDFString.of('SignatureField1'),
    V: doc.context.obj({
      Type: 'Sig',
      Filter: 'Adobe.PPKLite',
      SubFilter: 'adbe.pkcs7.detached',
      ByteRange: [0, 1000, 2000, 500],
      Contents: PDFLib.PDFHexString.of('0123456789ABCDEF'),
      Name: PDFLib.PDFString.of('Antigravity Signer')
    }),
    AP: doc.context.obj({
      N: apRef
    })
  });
  const sigRef = doc.context.register(sigDict);
  page.node.set(PDFLib.PDFName.of('Annots'), doc.context.obj([sigRef]));

  // Catalog with /AcroForm (/SigFlags 3), /DSS, /Perms
  const catalog = doc.context.lookup(doc.context.trailerInfo.Root);
  catalog.set(PDFLib.PDFName.of('AcroForm'), doc.context.obj({
    Fields: [sigRef],
    SigFlags: 3
  }));
  catalog.set(PDFLib.PDFName.of('DSS'), doc.context.obj({}));
  catalog.set(PDFLib.PDFName.of('Perms'), doc.context.obj({}));

  const bytes = await doc.save();
  return bytes;
}

async function createNormalPdfFixture(PDFLib) {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const helvFont = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  page.drawText('DOKUMEN-BIASA', {
    x: 50,
    y: 700,
    size: 24,
    font: helvFont,
    color: PDFLib.rgb(0.1, 0.1, 0.1)
  });
  const bytes = await doc.save();
  return bytes;
}

module.exports = {
  createSignedPdfFixture,
  createNormalPdfFixture
};
