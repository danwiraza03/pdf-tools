/**
 * PDF Tools — Password Protection & Unlock Engine
 * Encrypts (AES-256) or Decrypts PDF documents client-side using @cantoo/pdf-lib
 */
(function () {
  const globalObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
  globalObj.PDFTools = globalObj.PDFTools || {};

  /**
   * Helper to check if Uint8Array contains '/Encrypt' pattern
   * @param {Uint8Array} bytes 
   * @returns {boolean}
   */
  function hasEncryptDictionary(bytes) {
    if (!bytes || bytes.length === 0) return false;
    // '/Encrypt' in ASCII is [47, 69, 110, 99, 114, 121, 112, 116]
    const pattern = [47, 69, 110, 99, 114, 121, 112, 116];
    let matched = 0;
    for (let i = 0; i < bytes.length; i++) {
      if (bytes[i] === pattern[matched]) {
        matched++;
        if (matched === pattern.length) return true;
      } else {
        matched = bytes[i] === pattern[0] ? 1 : 0;
      }
    }
    return false;
  }

  /**
   * Encrypt PDF with user and owner passwords and granular permissions
   * @param {File|Blob|ArrayBuffer|Uint8Array} fileInput 
   * @param {string} userPassword 
   * @param {string} [ownerPassword] 
   * @param {Object} [permissions] 
   * @param {Function} [onProgress] 
   * @returns {Promise<Uint8Array>}
   */
  async function protectPdf(fileInput, userPassword, ownerPassword, permissions = {}, onProgress) {
    const PDFLib = globalObj.PDFLib || (typeof require === 'function' ? require('../lib/pdf-lib.min.js') : null);
    if (!PDFLib || !PDFLib.PDFDocument) {
      throw new Error('PDF library is not loaded.');
    }

    if (!userPassword && !ownerPassword) {
      throw new Error('Please specify a password to protect the PDF document.');
    }

    const { PDFDocument } = PDFLib;

    let arrayBuffer;
    if (fileInput instanceof ArrayBuffer) {
      arrayBuffer = fileInput;
    } else if (fileInput instanceof Uint8Array) {
      arrayBuffer = fileInput.buffer.slice(fileInput.byteOffset, fileInput.byteOffset + fileInput.byteLength);
    } else if (globalObj.PDFTools && globalObj.PDFTools.FileUtils && typeof globalObj.PDFTools.FileUtils.readAsArrayBuffer === 'function') {
      arrayBuffer = await globalObj.PDFTools.FileUtils.readAsArrayBuffer(fileInput);
    } else if (fileInput && typeof fileInput.arrayBuffer === 'function') {
      arrayBuffer = await fileInput.arrayBuffer();
    } else {
      throw new Error('Unsupported file input format.');
    }

    if (typeof onProgress === 'function') onProgress(20, 'Loading PDF document...');

    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (typeof onProgress === 'function') onProgress(50, 'Configuring security permissions...');

    // Build permissions map
    const permConfig = {};

    if (permissions.printing !== undefined) {
      if (permissions.printing === 'high' || permissions.printing === 'highResolution' || permissions.printing === true) {
        permConfig.printing = 'highResolution';
      } else if (permissions.printing === 'low' || permissions.printing === 'lowResolution') {
        permConfig.printing = 'lowResolution';
      } else {
        permConfig.printing = false;
      }
    } else {
      permConfig.printing = 'highResolution'; // default allow printing
    }

    if (permissions.copying !== undefined) {
      permConfig.copying = Boolean(permissions.copying);
    }
    if (permissions.modifying !== undefined) {
      permConfig.modifying = Boolean(permissions.modifying);
    }
    if (permissions.annotating !== undefined) {
      permConfig.annotating = Boolean(permissions.annotating);
    }
    if (permissions.fillingForms !== undefined) {
      permConfig.fillingForms = Boolean(permissions.fillingForms);
    }
    // Accessibility (contentAccessibility) must ALWAYS remain true regardless of user settings
    // so assistive technology and screen readers for visually impaired users can always read the document.
    permConfig.contentAccessibility = true;

    if (permissions.documentAssembly !== undefined) {
      permConfig.documentAssembly = Boolean(permissions.documentAssembly);
    }

    if (typeof onProgress === 'function') onProgress(70, 'Applying AES encryption...');

    if (typeof pdfDoc.encrypt !== 'function') {
      throw new Error('Loaded PDF-Lib engine does not support encryption. Please ensure @cantoo/pdf-lib is loaded.');
    }

    pdfDoc.encrypt({
      userPassword: userPassword || '',
      ownerPassword: ownerPassword || userPassword || '',
      permissions: permConfig
    });

    if (typeof onProgress === 'function') onProgress(90, 'Serializing protected document...');

    const encryptedBytes = await pdfDoc.save();

    // Strict validation: Ensure /Encrypt dictionary is present in the output
    if (!hasEncryptDictionary(encryptedBytes)) {
      throw new Error('Encryption failed: The output PDF is missing the required /Encrypt dictionary.');
    }

    if (typeof onProgress === 'function') onProgress(100, 'Protection complete!');
    return encryptedBytes;
  }

  /**
   * Unlock a password protected PDF
   * @param {File|Blob|ArrayBuffer|Uint8Array} fileInput 
   * @param {string} password 
   * @param {Function} [onProgress] 
   * @returns {Promise<Uint8Array>}
   */
  async function unlockPdf(fileInput, password, onProgress) {
    const PDFLib = globalObj.PDFLib || (typeof require === 'function' ? require('../lib/pdf-lib.min.js') : null);
    if (!PDFLib || !PDFLib.PDFDocument) {
      throw new Error('PDF library is not loaded.');
    }

    const { PDFDocument } = PDFLib;

    let arrayBuffer;
    if (fileInput instanceof ArrayBuffer) {
      arrayBuffer = fileInput;
    } else if (fileInput instanceof Uint8Array) {
      arrayBuffer = fileInput.buffer.slice(fileInput.byteOffset, fileInput.byteOffset + fileInput.byteLength);
    } else if (globalObj.PDFTools && globalObj.PDFTools.FileUtils && typeof globalObj.PDFTools.FileUtils.readAsArrayBuffer === 'function') {
      arrayBuffer = await globalObj.PDFTools.FileUtils.readAsArrayBuffer(fileInput);
    } else if (fileInput && typeof fileInput.arrayBuffer === 'function') {
      arrayBuffer = await fileInput.arrayBuffer();
    } else {
      throw new Error('Unsupported file input format.');
    }

    if (typeof onProgress === 'function') onProgress(30, 'Verifying password and decrypting...');

    let encryptedDoc;
    try {
      encryptedDoc = await PDFDocument.load(arrayBuffer, {
        password: password || '',
        ignoreEncryption: false
      });
    } catch (err) {
      throw new Error('Incorrect password or unable to decrypt this PDF: ' + (err.message || 'Access denied'));
    }

    if (typeof onProgress === 'function') onProgress(60, 'Removing encryption restrictions...');

    // Create a pristine document and copy all pages from the decrypted document
    const cleanDoc = await PDFDocument.create();
    const pageIndices = encryptedDoc.getPageIndices();
    let copiedPages = [];
    if (pageIndices.length > 0) {
      copiedPages = await cleanDoc.copyPages(encryptedDoc, pageIndices);
      copiedPages.forEach(page => cleanDoc.addPage(page));
    }

    const PdfCopy = (globalObj.PDFTools && globalObj.PDFTools.PdfCopy)
      || (typeof require === 'function' ? (function () {
        try { return require('./pdf-copy.js'); } catch (e) {
          try { return require('./js/core/pdf-copy.js'); } catch (e2) { return null; }
        }
      })() : null);

    if (PdfCopy && typeof PdfCopy.finalize === 'function' && pageIndices.length > 0) {
      const innerMap = new Map();
      copiedPages.forEach((p, idx) => innerMap.set(pageIndices[idx], p.ref));
      const pageMap = new Map([[encryptedDoc, innerMap]]);
      await PdfCopy.finalize(cleanDoc, pageMap, { primarySource: encryptedDoc });
    } else {
      // Fallback metadata copy if PdfCopy is not present
      try {
        if (encryptedDoc.getTitle()) cleanDoc.setTitle(encryptedDoc.getTitle());
        if (encryptedDoc.getAuthor()) cleanDoc.setAuthor(encryptedDoc.getAuthor());
        if (encryptedDoc.getSubject()) cleanDoc.setSubject(encryptedDoc.getSubject());
        if (encryptedDoc.getKeywords()) cleanDoc.setKeywords(encryptedDoc.getKeywords());
        if (encryptedDoc.getProducer()) cleanDoc.setProducer(encryptedDoc.getProducer());
        if (encryptedDoc.getCreator()) cleanDoc.setCreator(encryptedDoc.getCreator());
      } catch (e) {
        // Non-fatal metadata copy
      }
    }

    // Strip digital signature locks if applicable
    if (globalObj.PDFTools && globalObj.PDFTools.Compress && typeof globalObj.PDFTools.Compress.removeDigitalSignatures === 'function') {
      try {
        await globalObj.PDFTools.Compress.removeDigitalSignatures(cleanDoc);
      } catch (e) {
        console.warn('Signature unlock notice:', e);
      }
    }

    if (typeof onProgress === 'function') onProgress(90, 'Saving unlocked PDF document...');

    const unlockedBytes = await cleanDoc.save();

    // Verify that /Encrypt dictionary is completely gone
    if (hasEncryptDictionary(unlockedBytes)) {
      throw new Error('Unlock failed: Document still contains an /Encrypt dictionary.');
    }

    if (typeof onProgress === 'function') onProgress(100, 'Unlock complete!');
    return unlockedBytes;
  }

  globalObj.PDFTools.Protect = {
    protectPdf,
    unlockPdf,
    hasEncryptDictionary
  };
})();
