/**
 * Test: PDF Studio export applies redaction AFTER baking user edits.
 *
 * Regression for a bug where redacted pages were rasterized from the ORIGINAL file,
 * so text/stamps/signatures the user added on that page vanished from the export.
 *
 * Node has no canvas, so RedactionEngine.canvasRasterize is replaced with a recorder
 * that inspects which content it was asked to rasterize.
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

class MockFileReader {
  readAsArrayBuffer(blob) {
    setTimeout(async () => {
      try {
        this.result = await blob.arrayBuffer();
        if (this.onload) this.onload({ target: this });
      } catch (err) {
        if (this.onerror) this.onerror(err);
      }
    }, 0);
  }
}

global.window = global;
global.PDFLib = PDFLib;
global.pdfjsLib = pdfjs;
global.FileReader = MockFileReader;
global.navigator = { userAgent: 'Node' };
global.location = { href: 'http://localhost/', protocol: 'http:' };
global.PDFTools = {};

eval(fs.readFileSync(path.join(ROOT_DIR, 'js/utils/file-utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/editor/pdf-coordinate-engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/editor/redaction-engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT_DIR, 'js/core/pdf-studio.js'), 'utf8'));

let passed = 0;
function ok(cond, msg) {
  assert(cond, 'FAIL: ' + msg);
  passed++;
  console.log('  ✓ ' + msg);
}

async function pageTexts(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes).slice(0), verbosity: 0 }).promise;
  const out = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const p = await doc.getPage(i);
    out.push((await p.getTextContent()).items.map(t => t.str).join(' '));
  }
  await doc.destroy();
  return out;
}

async function run() {
  console.log('====================================================');
  console.log('PDF Studio export + redaction ordering test');
  console.log('====================================================');

  const RE = window.PDFTools.RedactionEngine;
  ok(RE && window.PDFTools.Studio, 'RedactionEngine and Studio loaded');

  // 2-page source: secret on page 1, normal text on page 2
  const src = await PDFLib.PDFDocument.create();
  const font = await src.embedFont(PDFLib.StandardFonts.Helvetica);
  src.addPage([600, 400]).drawText('RAHASIA-EKSPOR', { x: 50, y: 300, size: 24, font });
  src.addPage([600, 400]).drawText('HALAMAN-DUA', { x: 50, y: 300, size: 24, font });
  const srcBytes = await src.save();
  const file = new Blob([srcBytes], { type: 'application/pdf' });
  file.name = 'export_test.pdf';

  const studioDoc = await window.PDFTools.Studio.loadDocument(file);

  // User adds text on the page that will be redacted, and on page 2
  const p1 = studioDoc.getPageAnnotation(1);
  p1.texts = [{ text: 'TEKS-PENGGUNA-HAL1', x: 50, y: 300, fontSize: 16, color: '#000000' }];
  p1.redactions = [{ id: 'r1', x: 40, y: 70, width: 300, height: 45, applied: false }];
  const p2 = studioDoc.getPageAnnotation(2);
  p2.texts = [{ text: 'TEKS-PENGGUNA-HAL2', x: 50, y: 200, fontSize: 16, color: '#000000' }];

  // Record what the rasterizer is asked to draw
  const seen = [];
  const original = RE.canvasRasterize;
  RE.canvasRasterize = async ({ pdfjsPage, width, height, boxes }) => {
    const txt = (await pdfjsPage.getTextContent()).items.map(t => t.str).join(' ');
    seen.push({ txt, boxes });
    return { bytes: RE.createNodeRasterPng(width, height, [255, 255, 255], boxes), isPng: true };
  };

  let exported;
  try {
    exported = await window.PDFTools.Studio.exportDocument(studioDoc);
  } finally {
    RE.canvasRasterize = original;
  }
  const outBytes = exported.buffer ? new Uint8Array(exported) : exported;

  ok(seen.length === 1, 'exactly one page was rasterized (page 1)');
  ok(seen[0].txt.includes('TEKS-PENGGUNA-HAL1'),
    'rasterizer received the BAKED page (user text present), not the original file');
  ok(seen[0].txt.includes('RAHASIA-EKSPOR'), 'rasterizer saw the secret it must cover');

  const texts = await pageTexts(outBytes);
  ok(texts.length === 2, 'exported document still has 2 pages');
  ok(!texts[0].includes('RAHASIA-EKSPOR'), 'secret is not extractable from exported page 1');
  ok(texts[1].includes('HALAMAN-DUA') && texts[1].includes('TEKS-PENGGUNA-HAL2'),
    'page 2 keeps original and user text as vectors');

  const hex = Buffer.from('RAHASIA-EKSPOR', 'latin1').toString('hex').toUpperCase();
  const outDoc = await PDFLib.PDFDocument.load(outBytes);
  let leaked = false;
  for (const [, obj] of outDoc.context.enumerateIndirectObjects()) {
    let s = obj.toString();
    if (obj instanceof PDFLib.PDFRawStream) {
      try { s += Buffer.from(PDFLib.decodePDFRawStream(obj).decode()).toString('latin1'); } catch (e) { /* image */ }
    }
    if (s.includes('RAHASIA-EKSPOR') || s.toUpperCase().includes(hex)) leaked = true;
  }
  ok(!leaked, 'secret absent from every object of the exported file (text and hex)');

  ok(studioDoc.getPageAnnotation(1).redactions.length === 1,
    'export does not mutate the in-memory redaction marks');

  console.log('====================================================');
  console.log(`ALL ${passed} STUDIO EXPORT REDACTION CHECKS PASSED`);
  console.log('====================================================');
}

run().catch(err => {
  console.error('❌ ' + (err && err.message ? err.message : err));
  process.exit(1);
});
