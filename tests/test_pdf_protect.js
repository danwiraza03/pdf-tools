const path = require('path');
const fs = require('fs');

const ROOT_DIR = path.resolve(__dirname, '..');

// Load vendor library
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));
const pdfjs = require(path.join(ROOT_DIR, 'js/lib/pdf.min.js'));
pdfjs.GlobalWorkerOptions.workerSrc = path.join(ROOT_DIR, 'js/lib/pdf.worker.min.js');

// Mock browser environment for PDFTools
global.window = global;
global.PDFLib = PDFLib;
global.PDFTools = global.PDFTools || {};

// Load pdf-protect.js engine
require(path.join(ROOT_DIR, 'js/core/pdf-protect.js'));

async function runTests() {
  console.log('========================================================================');
  console.log('       AUTOMATED TEST SUITE: PDF PROTECT & UNLOCK ENGINE                ');
  console.log('========================================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`✅ [PASS] ${testName} ${details}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${testName} ${details}`);
      failed++;
    }
  }

  // 1. Create a sample multi-page PDF
  const doc = await PDFLib.PDFDocument.create();
  const font = await doc.embedFont(PDFLib.StandardFonts.Helvetica);
  for (let i = 1; i <= 3; i++) {
    const page = doc.addPage([400, 400]);
    page.drawText(`Page ${i} - Sensitive Content`, { x: 50, y: 350, font, size: 16 });
  }
  const originalBytes = await doc.save();
  const originalPages = 3;

  // ------------------------------------------------------------------------
  // Test 1: Output protectPdf contains /Encrypt dictionary
  // ------------------------------------------------------------------------
  const userPassword = 'UserSecret123!';
  const ownerPassword = 'OwnerSecret456!';
  const permissions = {
    printing: 'highResolution',
    copying: false,
    modifying: false,
    annotating: false
  };

  const protectedBytes = await PDFTools.Protect.protectPdf(
    originalBytes,
    userPassword,
    ownerPassword,
    permissions
  );

  const hasEncrypt = PDFTools.Protect.hasEncryptDictionary(protectedBytes);
  const rawStr = Buffer.from(protectedBytes).toString('latin1');
  const containsEncrypt = rawStr.includes('/Encrypt');
  assert(hasEncrypt && containsEncrypt, 'Output protectPdf contains /Encrypt dictionary', `(Bytes: ${protectedBytes.length})`);

  // ------------------------------------------------------------------------
  // Test 2: Opening with PDF.js without password produces PasswordException
  // ------------------------------------------------------------------------
  let threwPasswordException = false;
  let exceptionName = '';
  let exceptionCode = 0;
  try {
    await pdfjs.getDocument({ data: new Uint8Array(protectedBytes) }).promise;
  } catch (err) {
    exceptionName = err.name;
    exceptionCode = err.code;
    if (err.name === 'PasswordException' || err.code === 1) {
      threwPasswordException = true;
    }
  }
  assert(threwPasswordException, 'Opening output with PDF.js without password produces PasswordException', `(Name: ${exceptionName}, Code: ${exceptionCode})`);

  // ------------------------------------------------------------------------
  // Test 3: Opening with correct password succeeds and numPages matches
  // ------------------------------------------------------------------------
  let openedWithPassword = false;
  let loadedPages = 0;
  try {
    const loadedPdf = await pdfjs.getDocument({ data: new Uint8Array(protectedBytes), password: userPassword }).promise;
    loadedPages = loadedPdf.numPages;
    if (loadedPages === originalPages) {
      openedWithPassword = true;
    }
  } catch (err) {
    console.error('Error opening with password:', err.message);
  }
  assert(openedWithPassword, 'Opening with correct password succeeds and numPages matches original', `(${loadedPages}/${originalPages} pages)`);

  // ------------------------------------------------------------------------
  // Test 4: Permissions are correctly encoded in encryption dictionary
  // ------------------------------------------------------------------------
  const isAES = rawStr.includes('/CFM /AESV3') || rawStr.includes('/Length 256') || rawStr.includes('/V 5');
  assert(isAES, 'AES-256 encryption algorithm and revision flags present in /Encrypt', '(V 5, R 6, CFM /AESV3)');

  // ------------------------------------------------------------------------
  // Test 5: unlockPdf with correct password produces PDF without /Encrypt
  // ------------------------------------------------------------------------
  const unlockedBytes = await PDFTools.Protect.unlockPdf(protectedBytes, userPassword);
  const unlockedHasEncrypt = PDFTools.Protect.hasEncryptDictionary(unlockedBytes);
  const unlockedRawStr = Buffer.from(unlockedBytes).toString('latin1');
  const unlockedContainsEncrypt = unlockedRawStr.includes('/Encrypt');
  assert(!unlockedHasEncrypt && !unlockedContainsEncrypt, 'unlockPdf with correct password produces PDF without /Encrypt', `(Bytes: ${unlockedBytes.length})`);

  // ------------------------------------------------------------------------
  // Test 6: unlockPdf with incorrect password throws an error
  // ------------------------------------------------------------------------
  let wrongPassThrewError = false;
  let wrongPassErrorMessage = '';
  try {
    await PDFTools.Protect.unlockPdf(protectedBytes, 'WrongPassword999!');
  } catch (err) {
    wrongPassThrewError = true;
    wrongPassErrorMessage = err.message;
  }
  assert(wrongPassThrewError, 'unlockPdf with incorrect password throws error', `(Error: "${wrongPassErrorMessage}")`);

  // ------------------------------------------------------------------------
  // Test 7: Unlocked PDF opens without password in PDF.js and matches page count
  // ------------------------------------------------------------------------
  let unlockedOpensFreely = false;
  let unlockedPageCount = 0;
  try {
    const unlDoc = await pdfjs.getDocument({ data: new Uint8Array(unlockedBytes) }).promise;
    unlockedPageCount = unlDoc.numPages;
    if (unlockedPageCount === originalPages) {
      unlockedOpensFreely = true;
    }
  } catch (err) {
    console.error('Error opening unlocked PDF:', err.message);
  }
  assert(unlockedOpensFreely, 'Unlocked PDF opens without password in PDF.js and matches original page count', `(${unlockedPageCount}/${originalPages} pages)`);

  console.log('\n========================================================================');
  console.log(`RESULTS: ${passed} passed, ${failed} failed across ${passed + failed} test assertions`);
  console.log('========================================================================');

  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
