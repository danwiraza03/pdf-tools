/**
 * Automated Test Suite: PDF Studio Page Management Operations
 * Validates in-memory Blank Page Insertion, External PDF Insertion,
 * Page Duplication, Page Deletion, and Buffer Synchronization.
 * Strictly adheres to PROJECT_RULES.md Rule 4 (In-Memory Offline Guarantee).
 */
const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load vendor libraries
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// Mock browser environment for PDFTools
global.window = global;
global.PDFLib = PDFLib;
global.pdfjsLib = pdfjs;
global.PDFTools = global.PDFTools || {};

// Mock FileUtils
global.PDFTools.FileUtils = {
  readAsArrayBuffer: async (file) => file.data.buffer.slice(file.data.byteOffset, file.data.byteOffset + file.data.byteLength),
  initPdfJsWorker: () => {}
};

// Load PDF Studio Core Engine
require(path.join(ROOT_DIR, 'js/core/pdf-studio.js'));

async function runTests() {
  console.log('========================================================================');
  console.log('     AUTOMATED TEST SUITE: PDF STUDIO IN-MEMORY PAGE OPERATIONS        ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName} ${details}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName} ${details}`);
      failed++;
    }
  }

  // 1. Create a base 2-page PDF
  console.log('>>> [SETUP] Creating initial 2-page test PDF...');
  const initPdfDoc = await PDFLib.PDFDocument.create();
  const helvetica = await initPdfDoc.embedFont(PDFLib.StandardFonts.Helvetica);
  
  const page1 = initPdfDoc.addPage([595.28, 841.89]);
  page1.drawText('Original Page 1', { x: 50, y: 750, size: 24, font: helvetica });
  
  const page2 = initPdfDoc.addPage([595.28, 841.89]);
  page2.drawText('Original Page 2', { x: 50, y: 750, size: 24, font: helvetica });

  const initialBytes = await initPdfDoc.save();
  const mockFile = {
    name: 'test_document.pdf',
    data: new Uint8Array(initialBytes)
  };

  // 2. Load into PDFTools.Studio
  console.log('>>> [TEST 1] Loading document into PDFTools.Studio...');
  const studioDoc = await window.PDFTools.Studio.loadDocument(mockFile);

  assert(studioDoc.totalPages === 2, 'Initial totalPages', `Expected 2, got ${studioDoc.totalPages}`);
  assert(studioDoc.pdfJsDoc.numPages === 2, 'Initial pdfJsDoc.numPages', `Expected 2, got ${studioDoc.pdfJsDoc.numPages}`);
  assert(studioDoc.pageOrder.length === 2 && studioDoc.pageOrder[0] === 1 && studioDoc.pageOrder[1] === 2, 'Initial pageOrder', JSON.stringify(studioDoc.pageOrder));

  // 3. Test Insert Blank Page
  console.log('\n>>> [TEST 2] Inserting 1 blank A4 page at index 1 (between page 1 and page 2)...');
  const insertBlankRes = await window.PDFTools.Studio.insertBlankPages(studioDoc, 1, 1, { size: 'a4', orientation: 'portrait' });

  assert(insertBlankRes.success === true, 'insertBlankPages returns success: true');
  assert(insertBlankRes.count === 1 && insertBlankRes.insertedCount === 1, 'insertBlankPages returns count and insertedCount: 1');
  assert(insertBlankRes.newTotalPages === 3, 'insertBlankPages reports newTotalPages: 3');
  assert(studioDoc.totalPages === 3, 'studioDoc.totalPages updated to 3');
  assert(studioDoc.pdfJsDoc.numPages === 3, 'Underlying pdfJsDoc.numPages updated to 3');
  assert(studioDoc.pageOrder.length === 3, 'studioDoc.pageOrder length is 3');
  assert(studioDoc.currentPage === 2, 'studioDoc.currentPage focused on inserted page 2');

  // 4. Test Duplicate Page
  console.log('\n>>> [TEST 3] Duplicating page at index 1 (the newly inserted page)...');
  // Add annotation to page 2 first to verify independent cloning
  studioDoc.getPageAnnotation(2).texts.push({ id: 'txt_test_1', text: 'Hello Page 2', x: 100, y: 200 });

  const dupRes = await window.PDFTools.Studio.duplicatePage(studioDoc, 1);

  assert(dupRes.success === true, 'duplicatePage returns success: true');
  assert(dupRes.count === 1 && dupRes.insertedCount === 1, 'duplicatePage returns count and insertedCount: 1');
  assert(dupRes.newTotalPages === 4, 'duplicatePage reports newTotalPages: 4');
  assert(studioDoc.totalPages === 4, 'studioDoc.totalPages updated to 4');
  assert(studioDoc.pdfJsDoc.numPages === 4, 'Underlying pdfJsDoc.numPages updated to 4');
  assert(studioDoc.pageOrder.length === 4, 'studioDoc.pageOrder length is 4');
  assert(studioDoc.currentPage === 3, 'studioDoc.currentPage focused on duplicate page 3');

  // Verify annotations were cloned with distinct IDs
  const annotPage2 = studioDoc.getPageAnnotation(2);
  const annotPage3 = studioDoc.getPageAnnotation(3);
  assert(annotPage2.texts.length === 1 && annotPage3.texts.length === 1, 'Both duplicate pages have annotation');
  assert(annotPage2.texts[0].id !== annotPage3.texts[0].id, 'Cloned annotation has fresh unique ID (no ID collision)');

  // 5. Test Insert External PDF Pages
  console.log('\n>>> [TEST 4] Inserting external 2-page PDF at beginning (index 0)...');
  const extPdfDoc = await PDFLib.PDFDocument.create();
  extPdfDoc.addPage([500, 500]);
  extPdfDoc.addPage([500, 500]);
  const extPdfBytes = await extPdfDoc.save();

  const insertPdfRes = await window.PDFTools.Studio.insertPdfPages(studioDoc, 0, extPdfBytes.buffer);

  assert(insertPdfRes.success === true, 'insertPdfPages returns success: true');
  assert(insertPdfRes.count === 2 && insertPdfRes.insertedCount === 2, 'insertPdfPages returns count and insertedCount: 2');
  assert(insertPdfRes.newTotalPages === 6, 'insertPdfPages reports newTotalPages: 6');
  assert(studioDoc.totalPages === 6, 'studioDoc.totalPages updated to 6');
  assert(studioDoc.pdfJsDoc.numPages === 6, 'Underlying pdfJsDoc.numPages updated to 6');
  assert(studioDoc.currentPage === 1, 'studioDoc.currentPage focused at insertion point');

  // 6. Test Delete Page
  console.log('\n>>> [TEST 5] Deleting page at index 0 (first page)...');
  const delRes = await window.PDFTools.Studio.deletePage(studioDoc, 0);

  assert(delRes.success === true, 'deletePage returns success: true');
  assert(delRes.newTotalPages === 5, 'deletePage reports newTotalPages: 5');
  assert(studioDoc.totalPages === 5, 'studioDoc.totalPages updated to 5');
  assert(studioDoc.pdfJsDoc.numPages === 5, 'Underlying pdfJsDoc.numPages updated to 5');
  assert(studioDoc.pageOrder.length === 5, 'studioDoc.pageOrder length is 5');
  assert(studioDoc.currentPage === 1, 'studioDoc.currentPage adjusted to 1');

  // 7. Test Safety Constraint: Cannot Delete Last Page
  console.log('\n>>> [TEST 6] Safety Check: Preventing deletion of the only remaining page...');
  const singlePageDoc = await PDFLib.PDFDocument.create();
  singlePageDoc.addPage([300, 300]);
  const singleBytes = await singlePageDoc.save();
  const singleStudioDoc = await window.PDFTools.Studio.loadDocument({ name: 'single.pdf', data: new Uint8Array(singleBytes) });

  let threwError = false;
  try {
    await window.PDFTools.Studio.deletePage(singleStudioDoc, 0);
  } catch (err) {
    threwError = true;
    assert(err.message.includes('Cannot delete'), 'Error message prohibits deleting only page', err.message);
  }
  assert(threwError === true, 'deletePage threw error on 1-page document');
  assert(singleStudioDoc.totalPages === 1, 'singleStudioDoc totalPages remains 1');

  // 8. Test Drag-and-Drop Reorder + Sync Buffer Integration
  console.log('\n>>> [TEST 7] Drag-and-Drop Reorder + Sync Buffer Integration...');
  // Simulate user dragging page 5 to position 0
  studioDoc.pageOrder = [5, 1, 2, 3, 4];
  // Now duplicate page index 0 (which is visual page 5)
  const dupReorderedRes = await window.PDFTools.Studio.duplicatePage(studioDoc, 0);
  assert(dupReorderedRes.success === true, 'duplicatePage after reordering succeeded');
  assert(studioDoc.totalPages === 6, 'studioDoc totalPages correctly incremented to 6');
  assert(studioDoc.pageOrder.length === 6, 'studioDoc pageOrder length is 6');

  // 9. Test Export Document Integrity (Rule 4)
  console.log('\n>>> [TEST 8] Lossless PDF Export Verification (Rule 4 Compliance)...');
  const exportedBytes = await window.PDFTools.Studio.exportDocument(studioDoc);
  assert(exportedBytes instanceof Uint8Array || exportedBytes.buffer, 'exportDocument returned binary ArrayBuffer/Uint8Array');

  const verifyDoc = await PDFLib.PDFDocument.load(exportedBytes, { ignoreEncryption: true });
  assert(verifyDoc.getPageCount() === 6, 'Exported PDF contains exactly 6 pages matching in-memory document state');

  console.log('\n------------------------------------------------------------------------');
  console.log(`SUMMARY: ${passed} passed, ${failed} failed`);
  console.log('------------------------------------------------------------------------');

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal error during test suite:', err);
  process.exit(1);
});
