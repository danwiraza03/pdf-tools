/**
 * Automated Test: Permanent Redaction — Anti-Leak Verification
 *
 * Design rules for this test (see PROJECT_RULES.md, security tests):
 *  1. The leak detector decodes EVERY object in the file (all streams, all strings) and
 *     searches the secret as plain text AND as hex, because pdf-lib writes text as hex.
 *  2. The detector is first run on the UNREDACTED input and must FIND the secret.
 *     A detector that cannot see the secret before redaction proves nothing after it.
 *  3. Mutation checks: the protections (orphan purge, reference repointing) are switched
 *     off on purpose and the test must then DETECT a leak. If it does not, the test is blind.
 *
 * Node has no HTML5 canvas, so the rasterizer is INJECTED (options.rasterize). The
 * production canvas path must be verified in a real browser (see manual checklist).
 */

const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');
const CoordinateEngine = require(path.join(ROOT_DIR, 'js/editor/pdf-coordinate-engine.js'));
const RedactionEngine = require(path.join(ROOT_DIR, 'js/editor/redaction-engine.js'));

const {
  PDFDocument, StandardFonts, degrees, PDFName, PDFString, PDFArray, PDFDict,
  PDFStream, PDFRawStream, decodePDFRawStream
} = PDFLib;

let passed = 0;
function ok(cond, msg) {
  assert(cond, 'FAIL: ' + msg);
  passed++;
  console.log('  ✓ ' + msg);
}

// ---------------------------------------------------------------------------
// Leak detector
// ---------------------------------------------------------------------------
function decodeStream(stream) {
  try {
    if (stream instanceof PDFRawStream) return Buffer.from(decodePDFRawStream(stream).decode());
    if (typeof stream.getUnencodedContents === 'function') return Buffer.from(stream.getUnencodedContents());
  } catch (e) {
    // Image streams (DCT) may not decode; their raw bytes are still searched below
  }
  return Buffer.from(stream.getContents ? stream.getContents() : []);
}

async function findLeaks(bytes, secret) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const needles = [
    secret,
    Buffer.from(secret, 'latin1').toString('hex').toUpperCase(),
    Buffer.from(secret, 'latin1').toString('hex').toLowerCase()
  ];
  const hits = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const text = (obj instanceof PDFStream)
      ? decodeStream(obj).toString('latin1') + ' ' + obj.dict.toString()
      : obj.toString();
    if (needles.some(n => text.includes(n))) hits.push(ref.toString());
  }
  return hits;
}

async function countImagesWithSize(bytes, w, h) {
  const doc = await PDFDocument.load(bytes);
  let n = 0;
  for (const [, obj] of doc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFStream) {
      const d = obj.dict;
      const sub = d.get(PDFName.of('Subtype'));
      const W = d.get(PDFName.of('Width'));
      const H = d.get(PDFName.of('Height'));
      if (sub && sub.toString() === '/Image' && W && H && W.asNumber() === w && H.asNumber() === h) n++;
    }
  }
  return n;
}

// Injected test rasterizer: records the boxes it was asked to paint
function makeTestRasterizer(log) {
  return async ({ width, height, boxes }) => {
    log.push({ width, height, boxes });
    return { bytes: RedactionEngine.createNodeRasterPng(width, height, [255, 255, 255], boxes), isPng: true };
  };
}

async function loadPdfjs(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes).slice(0), verbosity: 0 }).promise;
}

async function pageText(pdfjsDoc, n) {
  const page = await pdfjsDoc.getPage(n);
  return (await page.getTextContent()).items.map(i => i.str).join(' ');
}

// ---------------------------------------------------------------------------
// Fixture: a document that exercises every known leak path
// ---------------------------------------------------------------------------
const SECRET_TEXT = 'RAHASIA-12345';
const SECRET_XOBJ = 'RAHASIA-XOBJ-777';
const SECRET_ALT = 'RAHASIA-ALT-999';
const IMG_W = 37;
const IMG_H = 23;

async function buildFixture() {
  // A separate document whose page is embedded as a Form XObject (common in real PDFs)
  const inner = await PDFDocument.create();
  const innerFont = await inner.embedFont(StandardFonts.Helvetica);
  inner.addPage([600, 400]).drawText(SECRET_XOBJ, { x: 50, y: 200, size: 18, font: innerFont });
  const innerBytes = await inner.save({ useObjectStreams: false });

  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.HelveticaBold);

  // Page 1: secret text + secret XObject text + distinctive image + form field
  const p1 = doc.addPage([600, 400]);
  p1.drawText(SECRET_TEXT, { x: 50, y: 300, size: 24, font });
  p1.drawText('TETAP-ADA', { x: 50, y: 100, size: 20, font });
  const [embedded] = await doc.embedPdf(innerBytes);
  p1.drawPage(embedded, { x: 0, y: 0 });
  const png = RedactionEngine.createNodeRasterPng(IMG_W, IMG_H, [200, 30, 30], []);
  const img = await doc.embedPng(png);
  p1.drawImage(img, { x: 400, y: 300, width: 74, height: 46 });
  const field = doc.getForm().createTextField('secretFieldOnPage1');
  field.setText('ConfidentialFieldVal');
  field.addToPage(p1, { x: 50, y: 50, width: 150, height: 20 });

  // Page 2: untouched vector page with a LINK pointing at page 1
  const p2 = doc.addPage([600, 400]);
  p2.drawText('HALAMAN-DUA-VEKTOR', { x: 50, y: 250, size: 22, font });
  const ctx = doc.context;
  const link = ctx.obj({
    Type: 'Annot', Subtype: 'Link', Rect: [50, 50, 200, 80], Border: [0, 0, 0],
    Dest: [p1.ref, PDFName.of('Fit')]
  });
  p2.node.set(PDFName.of('Annots'), ctx.obj([ctx.register(link)]));

  // Page 3: rotated page (common for scans)
  const p3 = doc.addPage([600, 400]);
  p3.setRotation(degrees(90));
  p3.drawText('ROT-RAHASIA', { x: 50, y: 300, size: 20, font });

  // Tagged-PDF structure tree carrying the secret in /ActualText
  const structElem = ctx.obj({ Type: 'StructElem', S: 'P', ActualText: PDFString.of(SECRET_ALT), Pg: p1.ref });
  const structRoot = ctx.obj({ Type: 'StructTreeRoot', K: ctx.register(structElem) });
  doc.catalog.set(PDFName.of('StructTreeRoot'), ctx.register(structRoot));

  return doc.save({ useObjectStreams: false });
}

const PAGE1_MARKS = [
  { isPdfCoord: true, pdfX: 45, pdfY: 295, width: 230, height: 35 },
  { isPdfCoord: true, pdfX: 0, pdfY: 0, width: 600, height: 400 } // whole page (XObject + image)
];
const PAGE3_MARK = { isPdfCoord: true, pdfX: 45, pdfY: 295, width: 200, height: 30 };

async function redact(bytes, { disablePurge = false, disableRepoint = false } = {}) {
  const doc = await PDFDocument.load(bytes);
  const pdfjsDoc = await loadPdfjs(bytes);
  const log = [];
  const origPurge = RedactionEngine.purgeUnreachableObjects;
  const origRepoint = RedactionEngine.replaceRefEverywhere;
  const origStruct = RedactionEngine.removeStructureTree;
  if (disablePurge) {
    RedactionEngine.purgeUnreachableObjects = () => 0;
    RedactionEngine.removeStructureTree = () => false;
  }
  if (disableRepoint) RedactionEngine.replaceRefEverywhere = () => 0;
  try {
    const report = await RedactionEngine.applyPermanentRedactionsToDocument(doc, pdfjsDoc, {
      1: { redactions: PAGE1_MARKS.map(m => ({ ...m })) },
      3: { redactions: [{ ...PAGE3_MARK }] }
    }, { dpi: 100, CoordinateEngine, rasterize: makeTestRasterizer(log) });
    return { bytes: await doc.save({ useObjectStreams: false }), report, log };
  } finally {
    RedactionEngine.purgeUnreachableObjects = origPurge;
    RedactionEngine.replaceRefEverywhere = origRepoint;
    RedactionEngine.removeStructureTree = origStruct;
    await pdfjsDoc.destroy();
  }
}

async function run() {
  console.log('====================================================');
  console.log('Redaction Anti-Leak Test (detector self-check + mutations)');
  console.log('====================================================');

  const input = await buildFixture();

  console.log('\n[1] Detector self-check on the UNREDACTED input');
  for (const s of [SECRET_TEXT, SECRET_XOBJ, SECRET_ALT]) {
    ok((await findLeaks(input, s)).length > 0, `detector finds "${s}" before redaction`);
  }
  ok((await countImagesWithSize(input, IMG_W, IMG_H)) === 1, `detector finds the ${IMG_W}x${IMG_H} image before redaction`);
  ok((await pageText(await loadPdfjs(input), 1)).includes(SECRET_TEXT), 'PDF.js extracts the secret before redaction');

  console.log('\n[2] Real redaction');
  const { bytes: out, report, log } = await redact(input);
  for (const s of [SECRET_TEXT, SECRET_XOBJ, SECRET_ALT, 'ROT-RAHASIA', 'ConfidentialFieldVal']) {
    const hits = await findLeaks(out, s);
    ok(hits.length === 0, `"${s}" is absent from every object in the file${hits.length ? ' (found in ' + hits.join(', ') + ')' : ''}`);
  }
  ok((await countImagesWithSize(out, IMG_W, IMG_H)) === 0, 'original image on the redacted page is gone from the file');
  ok(report.removedObjects > 0, `orphaned objects purged (${report.removedObjects})`);
  ok(report.structTreeRemoved === true, 'structure tree with /ActualText removed');

  const outJs = await loadPdfjs(out);
  ok(outJs.numPages === 3, 'page count preserved (3)');
  ok((await pageText(outJs, 1)).trim() === '', 'page 1 has no extractable text');
  ok((await pageText(outJs, 2)).includes('HALAMAN-DUA-VEKTOR'), 'page 2 (unredacted) keeps its vector text');

  const outDoc = await PDFDocument.load(out);
  ok(!outDoc.getForm().getFields().some(f => f.getName() === 'secretFieldOnPage1'), 'form field on page 1 removed');

  // Link on page 2 must now point at the NEW page 1
  const p2 = outDoc.getPage(1);
  const annots = p2.node.lookup(PDFName.of('Annots'), PDFArray);
  const linkDict = outDoc.context.lookup(annots.get(0), PDFDict);
  const dest = linkDict.lookup(PDFName.of('Dest'), PDFArray);
  ok(dest.get(0) === outDoc.getPage(0).ref, 'link on page 2 repointed to the new page 1');

  console.log('\n[3] Rotated page');
  const p3 = outDoc.getPage(2);
  const { width: w3, height: h3 } = p3.getSize();
  ok(w3 === 400 && h3 === 600, `rotated page replaced with its DISPLAYED size 400x600 (got ${w3}x${h3})`);
  ok((p3.getRotation().angle || 0) === 0, 'replacement page has no extra /Rotate (no double rotation)');
  const rotLog = log.find(l => l.width < l.height);
  ok(rotLog && Math.abs(rotLog.width / rotLog.height - 400 / 600) < 0.01, 'raster aspect ratio matches the displayed page');
  // On a 90° page, PDF rect (45,295)-(245,325) must land at display x≈295..325, y≈45..245
  const s = 100 / 72;
  const b = rotLog.boxes[0];
  ok(Math.abs(b.x - 295 * s) <= 2 && Math.abs(b.y - 45 * s) <= 2 &&
     Math.abs(b.width - 30 * s) <= 3 && Math.abs(b.height - 200 * s) <= 3,
     `black box lands on the rotated text (x=${b.x}, y=${b.y}, w=${b.width}, h=${b.height})`);

  console.log('\n[4] Mutation checks: protections OFF must be DETECTED as leaks');
  const noPurge = await redact(input, { disablePurge: true });
  ok((await findLeaks(noPurge.bytes, SECRET_XOBJ)).length > 0, 'without orphan purge, the XObject secret leaks (test is sensitive)');
  ok((await countImagesWithSize(noPurge.bytes, IMG_W, IMG_H)) > 0, 'without orphan purge, the original image leaks (test is sensitive)');
  ok((await findLeaks(noPurge.bytes, SECRET_ALT)).length > 0, 'without struct-tree removal, /ActualText leaks (test is sensitive)');
  const noRepoint = await redact(input, { disableRepoint: true });
  const nrDoc = await PDFDocument.load(noRepoint.bytes);
  const nrAnnots = nrDoc.getPage(1).node.lookup(PDFName.of('Annots'), PDFArray);
  const nrDest = nrDoc.context.lookup(nrAnnots.get(0), PDFDict).lookup(PDFName.of('Dest'), PDFArray);
  ok(!nrDoc.context.lookup(nrDest.get(0)), 'without link repointing, the link dangles to a deleted page (test is sensitive)');

  console.log('\n[5] Fails loudly without a rasterizer');
  const doc = await PDFDocument.load(input);
  let threw = false;
  try {
    await RedactionEngine.applyPermanentRedactionsToDocument(doc, null, { 1: { redactions: [{ ...PAGE1_MARKS[0] }] } }, { CoordinateEngine });
  } catch (e) {
    threw = /rasterizer unavailable/i.test(e.message);
  }
  ok(threw, 'no canvas and no injected rasterizer -> explicit error, never a silent blank page');

  console.log('\n====================================================');
  console.log(`ALL ${passed} REDACTION CHECKS PASSED`);
  console.log('NOTE: production canvas rendering is not covered here; verify in a browser.');
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ ' + (err && err.message ? err.message : err));
  process.exit(1);
});
