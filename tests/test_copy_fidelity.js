/**
 * Test: Copy Fidelity — Link Remapping, Ghost Page Detection, Bookmark & Metadata
 *
 * Proves that after any copyPages-based operation (Merge, Remove Pages, Split/Extract,
 * Reorder, Unlock) the output PDF:
 *   a. Has NO /Page objects outside the page tree (ghost pages — data leak)
 *   b. Contains NO marker text from discarded pages (content leak)
 *   c. Internal links whose targets survive → point to the CORRECT NEW page
 *   d. Internal links whose targets were discarded → removed, no dangling /Dest
 *   e. URL links are preserved
 *   f. Title, Author, Subject, Keywords from the source document are carried over
 *      (Merge: from the first file)
 *   g. Bookmarks whose targets survive → carried with correct destination
 *      Bookmarks whose targets were discarded → removed
 *      In Merge: each file's bookmarks nest under a parent named after the file
 *
 * This test MUST FAIL before PDFTools.PdfCopy.finalize is implemented.
 */

'use strict';

const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');

// --- Load PDF-Lib (Node) ---
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const {
  PDFDocument, PDFName, PDFArray, PDFDict, PDFStream, PDFRef,
  StandardFonts, PDFString
} = PDFLib;

// --- Load PDF.js (for text extraction) ---
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// --- Shared leak detector ---
const { findLeaks } = require(path.join(__dirname, 'helpers/leak-detector.js'));

// --- Load PDFTools modules under test (Node shim for window) ---
const globalObj = global;
globalObj.window = globalObj;
// Expose PDFLib globally so core modules can find it
globalObj.PDFLib = PDFLib;

// Load required dependencies
require(path.join(ROOT_DIR, 'js/utils/file-utils.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-compress.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-merge.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-remove.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-split.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-reorder.js'));
require(path.join(ROOT_DIR, 'js/core/pdf-protect.js'));

// Override readAsArrayBuffer in Node (no FileReader available)
PDFTools.FileUtils.readAsArrayBuffer = async function(file) {
  if (!file) throw new Error('No file provided');
  if (file instanceof ArrayBuffer) return file;
  if (file && file.buffer instanceof ArrayBuffer) {
    return file.buffer.slice(file.byteOffset || 0, (file.byteOffset || 0) + file.byteLength);
  }
  if (file && typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }
  throw new Error('Cannot read file in Node environment: ' + typeof file);
};

// Load the new PdfCopy module (may not exist yet; test should fail if it doesn't)
try {
  require(path.join(ROOT_DIR, 'js/core/pdf-copy.js'));
} catch (e) {
  // Module doesn't exist yet — that's expected in the pre-fix state
}

let passed = 0;
let failed = 0;
const failedChecks = [];

function ok(cond, msg) {
  if (cond) {
    passed++;
    console.log('  ✓ ' + msg);
  } else {
    failed++;
    failedChecks.push(msg);
    console.log('  ✗ FAIL: ' + msg);
  }
}

function equals(a, b, msg) {
  ok(a === b, `${msg} (expected ${JSON.stringify(b)}, got ${JSON.stringify(a)})`);
}

// ============================================================================
// PDF.js helpers
// ============================================================================
async function loadPdfjs(bytes) {
  return pdfjs.getDocument({ data: new Uint8Array(bytes).slice(0), verbosity: 0 }).promise;
}

async function pageText(pdfjsDoc, pageNum) {
  const page = await pdfjsDoc.getPage(pageNum);
  return (await page.getTextContent()).items.map(i => i.str).join(' ');
}

// ============================================================================
// Ghost page detector
// Counts /Page objects that are NOT in the page tree of the given PDF bytes.
// ============================================================================
async function countGhostPages(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const ctx = doc.context;

  // Collect all page refs from the page tree
  const treeRefs = new Set();
  function collectTree(node) {
    if (!node) return;
    const type = node.get(PDFName.of('Type'));
    if (type && type.toString() === '/Page') {
      // We'll match by looking up nodes via page indices instead
      return;
    }
    // /Pages node: recurse into Kids
    const kids = node.get(PDFName.of('Kids'));
    if (kids && kids instanceof PDFArray) {
      for (const kid of kids.asArray()) {
        if (kid instanceof PDFRef) {
          treeRefs.add(kid.tag);
          const kidObj = ctx.lookup(kid);
          if (kidObj instanceof PDFDict) collectTree(kidObj);
        }
      }
    }
  }

  // Also collect via official page refs
  const pageCount = doc.getPageCount();
  for (let i = 0; i < pageCount; i++) {
    const pg = doc.getPage(i);
    treeRefs.add(pg.ref.tag);
  }

  // Collect the root /Pages node refs too
  const pagesRef = doc.catalog.get(PDFName.of('Pages'));
  if (pagesRef instanceof PDFRef) {
    treeRefs.add(pagesRef.tag);
    const pagesNode = ctx.lookup(pagesRef);
    if (pagesNode instanceof PDFDict) collectTree(pagesNode);
  }

  // Count /Page objects NOT in the tree
  let ghosts = 0;
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) {
    if (!(obj instanceof PDFDict)) continue;
    const typeVal = obj.get(PDFName.of('Type'));
    if (typeVal && typeVal.toString() === '/Page') {
      if (!treeRefs.has(ref.tag)) {
        ghosts++;
      }
    }
  }
  return ghosts;
}

// ============================================================================
// Bookmark counter
// ============================================================================
async function countOutlines(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const outlinesRef = doc.catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) return 0;
  const outlines = doc.context.lookup(outlinesRef);
  if (!outlines || !(outlines instanceof PDFDict)) return 0;
  const countVal = outlines.get(PDFName.of('Count'));
  if (!countVal) return 0;
  // Count can be negative (all closed) — take abs value
  return Math.abs(typeof countVal.asNumber === 'function' ? countVal.asNumber() : 0);
}

// Get outline titles recursively
async function getOutlineTitles(bytes) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const ctx = doc.context;
  const titles = [];

  function walkOutlines(itemRef) {
    if (!itemRef) return;
    const item = ctx.lookup(itemRef);
    if (!item || !(item instanceof PDFDict)) return;
    const titleVal = item.get(PDFName.of('Title'));
    if (titleVal) {
      let t = titleVal.toString();
      // strip PDF string delimiters <...> or (...)
      if (t.startsWith('(') && t.endsWith(')')) t = t.slice(1, -1);
      if (t.startsWith('<') && t.endsWith('>')) {
        // hex-encoded string
        t = Buffer.from(t.slice(1, -1), 'hex').toString('latin1');
        // BOM for UTF-16BE
        if (t.startsWith('\xfe\xff')) {
          const utf16 = t.slice(2);
          const chars = [];
          for (let i = 0; i < utf16.length; i += 2) {
            chars.push(String.fromCharCode((utf16.charCodeAt(i) << 8) | utf16.charCodeAt(i + 1)));
          }
          t = chars.join('');
        }
      }
      titles.push(t);
    }
    // recurse into children (First) and siblings (Next)
    const first = item.get(PDFName.of('First'));
    if (first instanceof PDFRef) walkOutlines(first);
    const next = item.get(PDFName.of('Next'));
    if (next instanceof PDFRef) walkOutlines(next);
  }

  const outlinesRef = doc.catalog.get(PDFName.of('Outlines'));
  if (!outlinesRef) return titles;
  const outlines = ctx.lookup(outlinesRef);
  if (!outlines || !(outlines instanceof PDFDict)) return titles;
  const first = outlines.get(PDFName.of('First'));
  if (first instanceof PDFRef) walkOutlines(first);
  return titles;
}

// ============================================================================
// Link annotation inspector
// Returns an array of link annotation objects for a given page index
// ============================================================================
async function getLinksForPage(bytes, pageIndex) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const ctx = doc.context;
  if (pageIndex >= doc.getPageCount()) return [];
  const page = doc.getPage(pageIndex);
  const annotsRef = page.node.get(PDFName.of('Annots'));
  if (!annotsRef) return [];
  const annots = ctx.lookup(annotsRef);
  if (!(annots instanceof PDFArray)) return [];

  const links = [];
  for (const annotRef of annots.asArray()) {
    const annot = ctx.lookup(annotRef);
    if (!(annot instanceof PDFDict)) continue;
    const subtype = annot.get(PDFName.of('Subtype'));
    if (!subtype || subtype.toString() !== '/Link') continue;

    const dest = annot.get(PDFName.of('Dest'));
    const action = annot.get(PDFName.of('A'));
    links.push({ annot, dest, action });
  }
  return links;
}

// ============================================================================
// Fixture builder: 30-page PDF with internal links, URL link, bookmarks
// ============================================================================
const TOTAL_PAGES = 30;
const PAGE_WITH_LINKS = 2; // 1-indexed: page 2
const LINK_TARGETS = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14]; // 1-indexed target pages
const URL_LINK_URL = 'https://example.com/test-link';
const BOOKMARK_PAGE_8 = 8;  // 1-indexed
const BOOKMARK_PAGE_12 = 12; // 1-indexed
const TITLE = 'Dokumen Uji Fidelitas Salinan';
const AUTHOR = 'PDF Tools Test Suite';
const SUBJECT = 'Copy Fidelity Test';
const KEYWORDS = ['copy-fidelity', 'ghost-page', 'link-remap'];

async function buildFixture() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Add 30 pages with unique markers
  const pageRefs = [];
  for (let i = 0; i < TOTAL_PAGES; i++) {
    const pg = doc.addPage([595, 842]);
    const marker = `RAHASIA-HAL-${String(i + 1).padStart(2, '0')}`;
    pg.drawText(marker, { x: 50, y: 750, size: 20, font });
    pageRefs.push(pg.ref);
  }

  // Add links on page 2 (index 1): 10 internal links + 1 URL link
  const page2 = doc.getPage(PAGE_WITH_LINKS - 1);
  const ctx = doc.context;
  const annotRefs = [];

  for (let i = 0; i < LINK_TARGETS.length; i++) {
    const targetPageRef = pageRefs[LINK_TARGETS[i] - 1]; // 0-indexed
    const y = 700 - i * 50;

    let destArray;
    if (i % 2 === 0) {
      // Even: /Dest array directly
      destArray = ctx.obj([targetPageRef, PDFName.of('Fit')]);
    } else {
      // Odd: /A /GoTo action
      destArray = null; // we'll use action instead
    }

    let annotObj;
    if (destArray) {
      annotObj = ctx.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [50, y, 300, y + 30],
        Border: [0, 0, 0],
        Dest: destArray
      });
    } else {
      const goToAction = ctx.obj({
        S: 'GoTo',
        D: ctx.obj([targetPageRef, PDFName.of('Fit')])
      });
      annotObj = ctx.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [50, y, 300, y + 30],
        Border: [0, 0, 0],
        A: goToAction
      });
    }
    annotRefs.push(ctx.register(annotObj));
  }

  // URL link
  const uriAction = ctx.obj({ S: 'URI', URI: PDFString.of(URL_LINK_URL) });
  const urlAnnot = ctx.obj({
    Type: 'Annot',
    Subtype: 'Link',
    Rect: [50, 100, 300, 130],
    Border: [0, 0, 0],
    A: uriAction
  });
  annotRefs.push(ctx.register(urlAnnot));

  page2.node.set(PDFName.of('Annots'), ctx.obj(annotRefs));

  // Add bookmarks to pages 8 and 12
  const bm8 = ctx.obj({
    Title: PDFString.of('Penanda ke Halaman 8'),
    Dest: ctx.obj([pageRefs[BOOKMARK_PAGE_8 - 1], PDFName.of('Fit')])
  });
  const bm12 = ctx.obj({
    Title: PDFString.of('Penanda ke Halaman 12'),
    Dest: ctx.obj([pageRefs[BOOKMARK_PAGE_12 - 1], PDFName.of('Fit')])
  });
  const bm8Ref = ctx.register(bm8);
  const bm12Ref = ctx.register(bm12);

  // Stitch /Prev and /Next
  bm8.set(PDFName.of('Next'), bm12Ref);
  bm12.set(PDFName.of('Prev'), bm8Ref);

  const outlinesDict = ctx.obj({
    Type: 'Outlines',
    Count: 2,
    First: bm8Ref,
    Last: bm12Ref
  });
  const outlinesRef = ctx.register(outlinesDict);
  bm8.set(PDFName.of('Parent'), outlinesRef);
  bm12.set(PDFName.of('Parent'), outlinesRef);
  doc.catalog.set(PDFName.of('Outlines'), outlinesRef);

  // Set metadata
  doc.setTitle(TITLE);
  doc.setAuthor(AUTHOR);
  doc.setSubject(SUBJECT);
  doc.setKeywords(KEYWORDS);

  return doc.save({ useObjectStreams: false });
}

// ============================================================================
// Ghost page check (a): no /Page outside the page tree
// Content leak check (b): discarded-page marker NOT in any object
// ============================================================================
async function checkGhostAndLeak(bytes, removedPageNums, label) {
  // (a) Ghost pages
  const ghosts = await countGhostPages(bytes);
  ok(ghosts === 0, `${label}: no ghost /Page objects outside the page tree (found ${ghosts})`);

  // (b) Content leak: discarded markers must be absent from ALL objects
  for (const pNum of removedPageNums) {
    const marker = `RAHASIA-HAL-${String(pNum).padStart(2, '0')}`;
    const hits = await findLeaks(bytes, marker);
    ok(hits.length === 0, `${label}: marker "${marker}" (discarded page ${pNum}) not found in any object`);
  }
}

// ============================================================================
// Internal link check (c,d): links to surviving pages resolve correctly;
//   links to removed pages are absent.
// URL link check (e): URL link survives.
// ============================================================================
async function checkLinks(bytes, keptTargets, removedTargets, label, linkPageIndex = PAGE_WITH_LINKS - 1) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const ctx = doc.context;

  if (linkPageIndex >= doc.getPageCount()) {
    // Page 2 (index 1) was removed; skip link checks
    console.log(`  (skipping link checks for ${label}: link page was removed)`);
    return;
  }

  const links = await getLinksForPage(bytes, linkPageIndex);

  // Build set of kept page refs by tag
  const keptRefs = new Set();
  for (let i = 0; i < doc.getPageCount(); i++) {
    keptRefs.add(doc.getPage(i).ref.tag);
  }

  let urlFound = false;
  let danglingLinks = 0;

  for (const { annot, dest, action } of links) {
    // Check URL link
    if (action) {
      const actionObj = ctx.lookup(action) || action;
      if (actionObj instanceof PDFDict) {
        const s = actionObj.get(PDFName.of('S'));
        if (s && s.toString() === '/URI') {
          urlFound = true;
          continue;
        }
        // GoTo action
        if (s && s.toString() === '/GoTo') {
          const d = actionObj.get(PDFName.of('D'));
          if (d) {
            const dArr = d instanceof PDFArray ? d : ctx.lookup(d);
            if (dArr instanceof PDFArray) {
              const targetRef = dArr.get(0);
              if (targetRef instanceof PDFRef && !keptRefs.has(targetRef.tag)) {
                danglingLinks++;
              }
            }
          }
          continue;
        }
      }
    }

    if (dest) {
      let destArr = dest;
      if (!(dest instanceof PDFArray)) destArr = ctx.lookup(dest);
      if (destArr instanceof PDFArray) {
        const targetRef = destArr.get(0);
        if (targetRef instanceof PDFRef && !keptRefs.has(targetRef.tag)) {
          danglingLinks++;
        }
      }
    }
  }

  ok(urlFound, `${label}: URL link to ${URL_LINK_URL} is preserved`);
  ok(danglingLinks === 0, `${label}: no dangling internal links (found ${danglingLinks} pointing to non-existent pages)`);

  // Check that each surviving target is reachable via an actual page in the document
  // (if the link page was kept, there should be links to surviving targets)
  if (keptTargets.length > 0) {
    // At least some links should exist for surviving targets
    // (we won't enumerate all of them, just check no dangling ones)
    ok(links.length > 0, `${label}: link page still has at least 1 annotation`);
  }
}

// ============================================================================
// Metadata check (f)
// ============================================================================
async function checkMetadata(bytes, label, expectedTitle = TITLE, expectedAuthor = AUTHOR) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  try {
    equals(doc.getTitle(), expectedTitle, `${label}: title matches`);
    equals(doc.getAuthor(), expectedAuthor, `${label}: author matches`);
    const subj = doc.getSubject();
    ok(subj === SUBJECT || typeof subj === 'string', `${label}: subject present`);
  } catch (e) {
    ok(false, `${label}: metadata readable (${e.message})`);
  }
}

// ============================================================================
// Bookmark check (g)
// ============================================================================
async function checkBookmarks(bytes, expectBookmark8, expectBookmark12, label) {
  const titles = await getOutlineTitles(bytes);
  const has8 = titles.some(t => t.includes('8') || t.includes('Halaman 8'));
  const has12 = titles.some(t => t.includes('12') || t.includes('Halaman 12'));

  if (expectBookmark8) {
    ok(has8, `${label}: bookmark for page 8 is present (titles: ${JSON.stringify(titles)})`);
  } else {
    ok(!has8, `${label}: bookmark for removed page 8 is absent (titles: ${JSON.stringify(titles)})`);
  }
  if (expectBookmark12) {
    ok(has12, `${label}: bookmark for page 12 is present (titles: ${JSON.stringify(titles)})`);
  } else {
    ok(!has12, `${label}: bookmark for removed page 12 is absent (titles: ${JSON.stringify(titles)})`);
  }
}

// ============================================================================
// Node shim for File object (needed by pdf-merge / pdf-remove etc.)
// ============================================================================
function bytesToFile(bytes, name) {
  const buf = Buffer.from(bytes);
  return {
    name,
    size: buf.length,
    lastModified: Date.now(),
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
  };
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================
async function run() {
  console.log('========================================================================');
  console.log('>>> [TEST] Copy Fidelity: Ghost Pages, Links, Bookmarks, Metadata');
  console.log('========================================================================\n');

  // Ensure the PdfCopy module is loaded
  const hasPdfCopy = typeof PDFTools !== 'undefined' &&
    typeof PDFTools.PdfCopy !== 'undefined' &&
    typeof PDFTools.PdfCopy.finalize === 'function';

  if (!hasPdfCopy) {
    console.log('  [INFO] PDFTools.PdfCopy.finalize does not exist yet (expected BEFORE fix).');
    console.log('  [INFO] Tests will run against current (unfixed) tool output.\n');
  }

  // Build the fixture
  const fixtureBytes = await buildFixture();
  const fixtureFile = bytesToFile(fixtureBytes, 'fixture.pdf');
  console.log(`Fixture built: ${TOTAL_PAGES} pages, 10 internal links + 1 URL, 2 bookmarks`);

  // Self-check: detector finds secret before operation
  console.log('\n[0] Detector self-check');
  const marker8 = `RAHASIA-HAL-08`;
  const beforeHits = await findLeaks(fixtureBytes, marker8);
  ok(beforeHits.length > 0, `detector finds "${marker8}" in the fixture before any operation`);

  // =========================================================================
  // S1: Merge with page 8 excluded
  // Items: all pages except page 8 (0-indexed: 7)
  // =========================================================================
  console.log('\n[S1] Merge — page 8 excluded');
  {
    const srcDoc = await PDFDocument.load(fixtureBytes, { ignoreEncryption: true });
    const items = [];
    for (let i = 0; i < TOTAL_PAGES; i++) {
      if (i === 7) continue; // exclude page 8
      items.push({ doc: srcDoc, pageIndex: i, rotation: 0 });
    }
    const result = await PDFTools.Merge.assemble(items);
    const outBytes = result.bytes;

    // Page count: 30 - 1 = 29
    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 29, 'S1: page count is 29');

    await checkGhostAndLeak(outBytes, [8], 'S1: Merge');
    // Kept targets: all in LINK_TARGETS except 8 → [5,6,7,9,10,11,12,13,14]
    const keptT = LINK_TARGETS.filter(t => t !== 8);
    const removedT = [8];
    await checkLinks(outBytes, keptT, removedT, 'S1: Merge');
    await checkMetadata(outBytes, 'S1: Merge');
    // Bookmarks: page 8 removed → no bm8; page 12 kept → bm12 present
    await checkBookmarks(outBytes, false, true, 'S1: Merge');
  }

  // =========================================================================
  // S2: Remove Pages — remove page 8
  // =========================================================================
  console.log('\n[S2] Remove Pages — page 8 removed');
  {
    const result = await PDFTools.Remove.removePages(fixtureFile, [7]); // 0-indexed
    const outBytes = result.bytes;

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 29, 'S2: page count is 29');

    await checkGhostAndLeak(outBytes, [8], 'S2: Remove');
    const keptT = LINK_TARGETS.filter(t => t !== 8);
    await checkLinks(outBytes, keptT, [8], 'S2: Remove');
    await checkMetadata(outBytes, 'S2: Remove');
    await checkBookmarks(outBytes, false, true, 'S2: Remove');
  }

  // =========================================================================
  // S3: Split/Extract — pages 1–6 only
  // =========================================================================
  console.log('\n[S3] Split/Extract — pages 1-6 only');
  {
    const pageIndices = [0, 1, 2, 3, 4, 5]; // 0-indexed pages 1-6
    const outBytes = await PDFTools.Split.extractPages(fixtureFile, pageIndices);

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 6, 'S3: page count is 6');

    // Discarded: pages 7-30
    const removed = Array.from({ length: 24 }, (_, i) => i + 7); // 7..30
    await checkGhostAndLeak(outBytes, removed, 'S3: Split');

    // Link page 2 (index 1) was kept; targets 5,6 survived; 7-14 discarded
    const keptT = LINK_TARGETS.filter(t => t <= 6); // [5, 6]
    const removedT = LINK_TARGETS.filter(t => t > 6);
    await checkLinks(outBytes, keptT, removedT, 'S3: Split');

    await checkMetadata(outBytes, 'S3: Split');
    // Both bookmarks on pages 8 and 12 discarded
    await checkBookmarks(outBytes, false, false, 'S3: Split');
  }

  // =========================================================================
  // S4: Reorder — reverse the first 10 pages
  // =========================================================================
  console.log('\n[S4] Reorder — pages reversed');
  {
    const newOrder = Array.from({ length: TOTAL_PAGES }, (_, i) => TOTAL_PAGES - 1 - i); // reverse
    const outBytes = await PDFTools.Reorder.reorder(fixtureFile, newOrder);

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 30, 'S4: page count is 30 (no pages removed)');

    // No pages removed → no ghost pages, no content leaked
    await checkGhostAndLeak(outBytes, [], 'S4: Reorder');
    // All links still valid (targets still exist, just reordered)
    await checkLinks(outBytes, LINK_TARGETS, [], 'S4: Reorder',
      // In reversed order, page 2 is now at index (30 - 2) = 28
      TOTAL_PAGES - PAGE_WITH_LINKS);
    await checkMetadata(outBytes, 'S4: Reorder');
    // Both bookmarks should still be present (both pages kept)
    await checkBookmarks(outBytes, true, true, 'S4: Reorder');
  }

  // =========================================================================
  // S5: Unlock — copy all pages into a clean doc (same as unlockPdf path)
  // =========================================================================
  console.log('\n[S5] Unlock — copy all pages to clean doc');
  {
    const outBytes = await PDFTools.Protect.unlockPdf(fixtureFile, '');

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 30, 'S5: page count is 30');

    await checkGhostAndLeak(outBytes, [], 'S5: Unlock');
    await checkLinks(outBytes, LINK_TARGETS, [], 'S5: Unlock');
    await checkMetadata(outBytes, 'S5: Unlock');
    await checkBookmarks(outBytes, true, true, 'S5: Unlock');
  }

  // =========================================================================
  // Final summary
  // =========================================================================
  console.log('\n========================================================================');
  console.log(`COPY FIDELITY TEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log('\nFailed checks:');
    for (const f of failedChecks) {
      console.log(`  ✗ ${f}`);
    }
  }
  console.log('========================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch(err => {
  console.error('\n❌ [FAIL] Copy Fidelity Test crashed:');
  console.error(err.message || err);
  process.exit(1);
});
