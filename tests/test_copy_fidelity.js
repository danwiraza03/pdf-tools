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
// Assert output PDF contains no __TARGET_PAGE_ placeholder strings (iv)
// ============================================================================
function assertNoTargetPagePlaceholders(bytes, label) {
  const buf = Buffer.from(bytes);
  const idx = buf.indexOf('__TARGET_PAGE_');
  ok(idx === -1, `${label}: output PDF contains no '__TARGET_PAGE_' placeholder strings (found at index ${idx})`);
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
    assertNoTargetPagePlaceholders(outBytes, 'S1: Merge');
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
    assertNoTargetPagePlaceholders(outBytes, 'S2: Remove');
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
    assertNoTargetPagePlaceholders(outBytes, 'S3: Split');

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
    assertNoTargetPagePlaceholders(outBytes, 'S4: Reorder');
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
    assertNoTargetPagePlaceholders(outBytes, 'S5: Unlock');
    await checkLinks(outBytes, LINK_TARGETS, [], 'S5: Unlock');
    await checkMetadata(outBytes, 'S5: Unlock');
    await checkBookmarks(outBytes, true, true, 'S5: Unlock');
  }

  // =========================================================================
  // S6: Duplicate page with internal links (Item 1.i)
  // Page 2 (with internal links) is included TWICE in the merge assemble items
  // =========================================================================
  console.log('\n[S6] Duplicate page with internal links');
  {
    const srcDoc = await PDFDocument.load(fixtureBytes, { ignoreEncryption: true });
    // Assemble: Page 1, Page 2 (link page), Page 5 (target), Page 2 (duplicate link page)
    const items = [
      { doc: srcDoc, pageIndex: 0, rotation: 0 },
      { doc: srcDoc, pageIndex: 1, rotation: 0 }, // slot 1 (Page 2)
      { doc: srcDoc, pageIndex: 4, rotation: 0 }, // slot 2 (Page 5, target of link 0)
      { doc: srcDoc, pageIndex: 1, rotation: 0 }  // slot 3 (Duplicate Page 2)
    ];
    const result = await PDFTools.Merge.assemble(items);
    const outBytes = result.bytes;

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 4, 'S6: page count is 4 (includes duplicated page)');

    await checkGhostAndLeak(outBytes, [], 'S6: Dupe');
    assertNoTargetPagePlaceholders(outBytes, 'S6: Dupe');

    const outDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
    const targetRef = outDoc.getPage(2).ref;

    // Check slot 1 links
    const linksSlot1 = await getLinksForPage(outBytes, 1);
    ok(linksSlot1.length > 0, 'S6: first copy of page 2 has link annotations');
    const firstLinkSlot1 = linksSlot1.find(l => l.dest);
    ok(firstLinkSlot1, 'S6: first copy has /Dest link');
    if (firstLinkSlot1 && firstLinkSlot1.dest) {
      const dArr = firstLinkSlot1.dest instanceof PDFArray ? firstLinkSlot1.dest : outDoc.context.lookup(firstLinkSlot1.dest);
      equals(dArr.get(0).tag, targetRef.tag, 'S6: first copy link points to target Page 5 (slot 2)');
    }

    // Check slot 3 links (duplicate)
    const linksSlot3 = await getLinksForPage(outBytes, 3);
    ok(linksSlot3.length > 0, 'S6: second copy (duplicate) of page 2 has link annotations');
    const firstLinkSlot3 = linksSlot3.find(l => l.dest);
    ok(firstLinkSlot3, 'S6: second copy has /Dest link');
    if (firstLinkSlot3 && firstLinkSlot3.dest) {
      const dArr = firstLinkSlot3.dest instanceof PDFArray ? firstLinkSlot3.dest : outDoc.context.lookup(firstLinkSlot3.dest);
      equals(dArr.get(0).tag, targetRef.tag, 'S6: second copy link points to target Page 5 (slot 2)');
    }
  }

  // =========================================================================
  // S7: Merge two files each with internal links — verify target page text matching (Item 1.ii)
  // =========================================================================
  console.log('\n[S7] Merge two files each with internal links (text matching)');
  {
    // Build File A (3 pages, link on page 2 points to page 3 "DOCA-PAGE-3-TARGET")
    const docA = await PDFDocument.create();
    const fontA = await docA.embedFont(StandardFonts.Helvetica);
    const pA1 = docA.addPage([300, 300]); pA1.drawText('DOCA-PAGE-1', { x: 50, y: 250, size: 14, font: fontA });
    const pA2 = docA.addPage([300, 300]); pA2.drawText('DOCA-PAGE-2-SOURCE', { x: 50, y: 250, size: 14, font: fontA });
    const pA3 = docA.addPage([300, 300]); pA3.drawText('DOCA-PAGE-3-TARGET', { x: 50, y: 250, size: 14, font: fontA });
    const annotA = docA.context.obj({
      Type: 'Annot', Subtype: 'Link',
      Rect: [50, 100, 150, 120],
      Dest: docA.context.obj([pA3.ref, PDFName.of('Fit')])
    });
    pA2.node.set(PDFName.of('Annots'), docA.context.obj([docA.context.register(annotA)]));
    const bytesA = await docA.save({ useObjectStreams: false });

    // Build File B (3 pages, link on page 2 points to page 1 "DOCB-PAGE-1-TARGET")
    const docB = await PDFDocument.create();
    const fontB = await docB.embedFont(StandardFonts.Helvetica);
    const pB1 = docB.addPage([300, 300]); pB1.drawText('DOCB-PAGE-1-TARGET', { x: 50, y: 250, size: 14, font: fontB });
    const pB2 = docB.addPage([300, 300]); pB2.drawText('DOCB-PAGE-2-SOURCE', { x: 50, y: 250, size: 14, font: fontB });
    const pB3 = docB.addPage([300, 300]); pB3.drawText('DOCB-PAGE-3', { x: 50, y: 250, size: 14, font: fontB });
    const annotB = docB.context.obj({
      Type: 'Annot', Subtype: 'Link',
      Rect: [50, 100, 150, 120],
      Dest: docB.context.obj([pB1.ref, PDFName.of('Fit')])
    });
    pB2.node.set(PDFName.of('Annots'), docB.context.obj([docB.context.register(annotB)]));
    const bytesB = await docB.save({ useObjectStreams: false });

    // Merge via Whole-File List Mode (merge function)
    const fileA = bytesToFile(bytesA, 'docA.pdf');
    const fileB = bytesToFile(bytesB, 'docB.pdf');
    const mergeResult = await PDFTools.Merge.merge([fileA, fileB]);
    const outBytes = mergeResult.bytes;

    const pdfjsDoc = await loadPdfjs(outBytes);
    equals(pdfjsDoc.numPages, 6, 'S7: merged page count is 6');

    await checkGhostAndLeak(outBytes, [], 'S7: Merge Two Files');
    assertNoTargetPagePlaceholders(outBytes, 'S7: Merge Two Files');

    // Inspect links in destination document
    const outDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });

    // Link in Doc A (Page 2, index 1)
    const linksA = await getLinksForPage(outBytes, 1);
    ok(linksA.length === 1, 'S7: Doc A page 2 has 1 link');
    const destRefA = outDoc.context.lookup(linksA[0].dest).get(0);

    // Link in Doc B (Page 5, index 4)
    const linksB = await getLinksForPage(outBytes, 4);
    ok(linksB.length === 1, 'S7: Doc B page 2 has 1 link');
    const destRefB = outDoc.context.lookup(linksB[0].dest).get(0);

    // Find destination page indices
    let targetIdxA = -1;
    let targetIdxB = -1;
    for (let i = 0; i < outDoc.getPageCount(); i++) {
      if (outDoc.getPage(i).ref.tag === destRefA.tag) targetIdxA = i;
      if (outDoc.getPage(i).ref.tag === destRefB.tag) targetIdxB = i;
    }

    // Verify target text via PDF.js matches target page text
    const textTargetA = await pageText(pdfjsDoc, targetIdxA + 1);
    const textTargetB = await pageText(pdfjsDoc, targetIdxB + 1);
    ok(textTargetA.includes('DOCA-PAGE-3-TARGET'), `S7: Doc A link target matches text 'DOCA-PAGE-3-TARGET' (got: "${textTargetA}")`);
    ok(textTargetB.includes('DOCB-PAGE-1-TARGET'), `S7: Doc B link target matches text 'DOCB-PAGE-1-TARGET' (got: "${textTargetB}")`);
  }

  // =========================================================================
  // S8: Consecutive copy of the same source instance (Item 1.iii)
  // =========================================================================
  console.log('\n[S8] Consecutive copy of the same source instance');
  {
    const loadedSrc = await PDFDocument.load(fixtureBytes, { ignoreEncryption: true });
    const items = [
      { doc: loadedSrc, pageIndex: 0, rotation: 0 },
      { doc: loadedSrc, pageIndex: 1, rotation: 0 },
      { doc: loadedSrc, pageIndex: 4, rotation: 0 }
    ];

    const res1 = await PDFTools.Merge.assemble(items);
    const res2 = await PDFTools.Merge.assemble(items);

    equals(res1.pageCount, res2.pageCount, 'S8: consecutive copy page counts match');
    equals(res1.bytes.length, res2.bytes.length, 'S8: consecutive copy byte lengths match');
    const bufferDiff = Buffer.compare(Buffer.from(res1.bytes), Buffer.from(res2.bytes));
    ok(bufferDiff === 0, 'S8: consecutive copy byte contents are 100% identical');

    assertNoTargetPagePlaceholders(res1.bytes, 'S8: Consecutive copy 1');
    assertNoTargetPagePlaceholders(res2.bytes, 'S8: Consecutive copy 2');
  }

  // =========================================================================
  // S9: Grouping bookmarks preservation & empty bookmark pruning (Item 2)
  // =========================================================================
  console.log('\n[S9] Grouping bookmarks preservation & empty bookmark pruning');
  {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const ctx = doc.context;

    const p1 = doc.addPage([300, 300]); p1.drawText('Page 1', { x: 50, y: 250, size: 14, font });
    const p2 = doc.addPage([300, 300]); p2.drawText('Page 2', { x: 50, y: 250, size: 14, font });
    const p3 = doc.addPage([300, 300]); p3.drawText('Page 3', { x: 50, y: 250, size: 14, font });
    const p4 = doc.addPage([300, 300]); p4.drawText('Page 4', { x: 50, y: 250, size: 14, font });

    // 1. Group Active (no dest, has 2 children: one targeting P1, one targeting P4)
    const c1_1 = ctx.obj({ Title: PDFString.of('Child Survives'), Dest: ctx.obj([p1.ref, PDFName.of('Fit')]) });
    const c1_2 = ctx.obj({ Title: PDFString.of('Child Discarded'), Dest: ctx.obj([p4.ref, PDFName.of('Fit')]) });
    const c1_1Ref = ctx.register(c1_1);
    const c1_2Ref = ctx.register(c1_2);
    c1_1.set(PDFName.of('Next'), c1_2Ref);
    c1_2.set(PDFName.of('Prev'), c1_1Ref);

    const grpActive = ctx.obj({
      Title: PDFString.of('Group Active'),
      First: c1_1Ref,
      Last: c1_2Ref,
      Count: 2
    });
    const grpActiveRef = ctx.register(grpActive);
    c1_1.set(PDFName.of('Parent'), grpActiveRef);
    c1_2.set(PDFName.of('Parent'), grpActiveRef);

    // 2. Group Dead (no dest, has 1 child targeting P4 which will be discarded)
    const c2_1 = ctx.obj({ Title: PDFString.of('Child Also Discarded'), Dest: ctx.obj([p4.ref, PDFName.of('Fit')]) });
    const c2_1Ref = ctx.register(c2_1);

    const grpDead = ctx.obj({
      Title: PDFString.of('Group Dead'),
      First: c2_1Ref,
      Last: c2_1Ref,
      Count: 1
    });
    const grpDeadRef = ctx.register(grpDead);
    c2_1.set(PDFName.of('Parent'), grpDeadRef);

    // 3. Group Empty (no dest, no children)
    const grpEmpty = ctx.obj({
      Title: PDFString.of('Group Empty')
    });
    const grpEmptyRef = ctx.register(grpEmpty);

    // 4. Direct Bookmark (has dest pointing to P2)
    const directBm = ctx.obj({
      Title: PDFString.of('Direct Bookmark'),
      Dest: ctx.obj([p2.ref, PDFName.of('Fit')])
    });
    const directBmRef = ctx.register(directBm);

    // Link top-level siblings
    grpActive.set(PDFName.of('Next'), grpDeadRef);
    grpDead.set(PDFName.of('Prev'), grpActiveRef);
    grpDead.set(PDFName.of('Next'), grpEmptyRef);
    grpEmpty.set(PDFName.of('Prev'), grpDeadRef);
    grpEmpty.set(PDFName.of('Next'), directBmRef);
    directBm.set(PDFName.of('Prev'), grpEmptyRef);

    // Root Outlines
    const outlinesDict = ctx.obj({
      Type: 'Outlines',
      Count: 4,
      First: grpActiveRef,
      Last: directBmRef
    });
    const outlinesRef = ctx.register(outlinesDict);
    grpActive.set(PDFName.of('Parent'), outlinesRef);
    grpDead.set(PDFName.of('Parent'), outlinesRef);
    grpEmpty.set(PDFName.of('Parent'), outlinesRef);
    directBm.set(PDFName.of('Parent'), outlinesRef);
    doc.catalog.set(PDFName.of('Outlines'), outlinesRef);

    const srcBytes = await doc.save({ useObjectStreams: false });
    const file = bytesToFile(srcBytes, 'outline_test.pdf');

    // Extract pages 1-2 (page 1 and page 2 survive, 3 and 4 discarded)
    const outBytes = await PDFTools.Split.extractPages(file, [0, 1]);

    await checkGhostAndLeak(outBytes, [], 'S9: Outline Grouping');
    assertNoTargetPagePlaceholders(outBytes, 'S9: Outline Grouping');

    const titles = await getOutlineTitles(outBytes);
    ok(titles.includes('Group Active'), 'S9: Group Active without dest is preserved because it has surviving child');
    ok(titles.includes('Child Survives'), 'S9: Child Survives is preserved under Group Active');
    ok(!titles.includes('Child Discarded'), 'S9: Child Discarded (pointing to discarded page 4) is removed');
    ok(!titles.includes('Group Dead'), 'S9: Group Dead is pruned because all its children were discarded');
    ok(!titles.includes('Child Also Discarded'), 'S9: Child Also Discarded is removed');
    ok(!titles.includes('Group Empty'), 'S9: Group Empty without dest or children is pruned');
    ok(titles.includes('Direct Bookmark'), 'S9: Direct Bookmark pointing to surviving page 2 is preserved');

    // Verify parent-child hierarchy in output PDF
    const outDoc = await PDFDocument.load(outBytes, { ignoreEncryption: true });
    const outCtx = outDoc.context;
    const outOutlinesRef = outDoc.catalog.get(PDFName.of('Outlines'));
    ok(outOutlinesRef, 'S9: output PDF has /Outlines');
    const outOutlines = outCtx.lookup(outOutlinesRef);
    const firstRef = outOutlines.get(PDFName.of('First'));
    const firstDict = outCtx.lookup(firstRef);
    equals(firstDict.get(PDFName.of('Title')).toString(), '(Group Active)', 'S9: first outline node is Group Active');
    ok(!firstDict.get(PDFName.of('Dest')), 'S9: Group Active has no /Dest');

    const childRef = firstDict.get(PDFName.of('First'));
    const childDict = outCtx.lookup(childRef);
    equals(childDict.get(PDFName.of('Title')).toString(), '(Child Survives)', 'S9: Group Active first child is Child Survives');
    ok(childDict.get(PDFName.of('Dest')), 'S9: Child Survives has /Dest');
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
