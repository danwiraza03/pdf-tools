/**
 * Test: page-copy operations must not depend on Node-only globals (Buffer)
 *
 * Why: ESLint found `Buffer.from(hex, 'hex')` in js/core/pdf-copy.js (bookmark title decoding).
 * `Buffer` exists in Node, where every other test runs, but NOT in a browser. A PDF whose
 * bookmark titles are stored as hex strings (UTF-16, e.g. <FEFF0042...>) therefore made
 * Merge, Remove, Split, Reorder and Unlock crash for real users while all tests passed.
 *
 * This test removes `Buffer` for the duration of each operation (like a browser) and checks
 * that hex-encoded bookmark titles survive, including non-ASCII text and nesting.
 *
 * Second bug caught by the same fixture: titles were written back with PDFString.of, which
 * truncates characters above Latin-1 (e.g. the en dash U+2013 became a control character).
 * The child title below deliberately contains such a character.
 */
'use strict';

const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const { PDFDocument, PDFName, PDFHexString } = PDFLib;

global.window = global;
global.PDFLib = PDFLib;
require(path.join(ROOT_DIR, 'js/utils/file-utils.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-compress.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-copy.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-merge.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-remove.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-split.js'));

PDFTools.FileUtils.readAsArrayBuffer = async function (file) {
  if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  throw new Error('Cannot read file in Node environment');
};

let passed = 0;
function ok(cond, msg) { assert(cond, 'FAIL: ' + msg); passed++; console.log('  ✓ ' + msg); }

const TITLES = { parent: 'Bab Satu Pendahuluan', child: 'Latar Belakang é ü – Ringkasan' };

// 3-page PDF; bookmark "parent" -> page 2 with a nested "child" -> page 3. Titles are HEX UTF-16.
async function buildFixture() {
  const d = await PDFDocument.create();
  d.addPage([300, 200]); const p2 = d.addPage([300, 200]); const p3 = d.addPage([300, 200]);
  const ctx = d.context;
  const outlinesRef = ctx.nextRef(); const parentRef = ctx.nextRef(); const childRef = ctx.nextRef();
  ctx.assign(childRef, ctx.obj({ Title: PDFHexString.fromText(TITLES.child), Parent: parentRef, Dest: [p3.ref, PDFName.of('Fit')] }));
  ctx.assign(parentRef, ctx.obj({ Title: PDFHexString.fromText(TITLES.parent), Parent: outlinesRef, First: childRef, Last: childRef, Count: 1, Dest: [p2.ref, PDFName.of('Fit')] }));
  ctx.assign(outlinesRef, ctx.obj({ Type: 'Outlines', First: parentRef, Last: parentRef, Count: 2 }));
  d.catalog.set(PDFName.of('Outlines'), outlinesRef);
  return d.save();
}

function asFile(bytes, name) { const f = new Blob([bytes]); f.name = name; f.lastModified = 1; return f; }

// Collect outline titles (depth-first) from a saved PDF
async function outlineTitles(bytes) {
  const d = await PDFDocument.load(bytes, { updateMetadata: false });
  const root = d.catalog.lookup(PDFName.of('Outlines'));
  const out = [];
  if (!root) return out;
  const walk = (ref, depth) => {
    while (ref) {
      const n = d.context.lookup(ref);
      const t = n.get(PDFName.of('Title'));
      out.push('>'.repeat(depth) + (t && t.decodeText ? t.decodeText() : String(t)));
      const first = n.get(PDFName.of('First')); if (first) walk(first, depth + 1);
      ref = n.get(PDFName.of('Next'));
    }
  };
  walk(root.get(PDFName.of('First')), 0);
  return out;
}

// Run `fn` with Buffer removed, exactly as in a browser; always restore afterwards
async function withoutBuffer(fn) {
  const saved = globalThis.Buffer;
  globalThis.Buffer = undefined;
  try { return await fn(); } finally { globalThis.Buffer = saved; }
}

(async () => {
  console.log('====================================================');
  console.log('Copy operations without Node-only globals (browser-safe)');
  console.log('====================================================');

  const bytes = await buildFixture();
  ok(Buffer !== undefined, 'sanity: Buffer exists in this Node process before the checks');

  console.log('\n[1] Merge (two copies of the file)');
  const merged = await withoutBuffer(() => PDFTools.Merge.merge([asFile(bytes, 'a.pdf'), asFile(bytes, 'b.pdf')]));
  const mergedTitles = await outlineTitles(merged.bytes || merged);
  ok(mergedTitles.includes('a.pdf') && mergedTitles.includes('b.pdf'), 'merge wrapper bookmarks per source file are present');
  // Merge nests each file's bookmarks under a wrapper named after the file: wrapper (0) > parent (1) > child (2)
  ok(mergedTitles.filter(t => t === '>' + TITLES.parent).length === 2, `hex-encoded parent title "${TITLES.parent}" survives for both files, under its file wrapper`);
  ok(mergedTitles.filter(t => t === '>>' + TITLES.child).length === 2, 'non-ASCII child title survives, still nested one level below its parent');

  console.log('\n[2] Remove Pages (drop page 1, keep both bookmarks)');
  const removed = await withoutBuffer(() => PDFTools.Remove.removePages(asFile(bytes, 'r.pdf'), [0]));
  const removedTitles = await outlineTitles(removed.bytes || removed);
  ok(removedTitles.includes(TITLES.parent) && removedTitles.includes('>' + TITLES.child), 'titles survive Remove Pages with nesting intact');

  console.log('\n[3] Split / Extract (pages 2-3)');
  const extracted = await withoutBuffer(() => PDFTools.Split.extractPages(asFile(bytes, 's.pdf'), [1, 2]));
  const extractedTitles = await outlineTitles(extracted.bytes || extracted);
  ok(extractedTitles.includes(TITLES.parent) && extractedTitles.includes('>' + TITLES.child), 'titles survive Split/Extract with nesting intact');

  console.log('\n====================================================');
  console.log(`ALL ${passed} BROWSER-SAFE COPY CHECKS PASSED`);
  console.log('====================================================');
})().catch(err => {
  console.error('❌ ' + (err && err.message ? err.message : err));
  process.exit(1);
});
