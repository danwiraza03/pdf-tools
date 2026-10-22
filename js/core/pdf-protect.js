/**
 * PDF Tools — Password Protection & Unlock Engine
 * Encrypts or Decrypts PDF documents client-side using PDF-Lib
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Protect = (function () {
  /**
   * Encrypt PDF with user and owner passwords
   * @param {File|ArrayBuffer} fileInput 
   * @param {string} userPassword 
   * @param {string} ownerPassword 
   * @param {Object} permissions 
   * @param {Function} onProgress 
   * @returns {Promise<Uint8Array>}
   */
  async function protectPdf(fileInput, userPassword, ownerPassword, permissions = {}, onProgress) {
    const { PDFDocument } = PDFLib;

    const arrayBuffer = fileInput instanceof ArrayBuffer
      ? fileInput
      : await PDFTools.FileUtils.readAsArrayBuffer(fileInput);

    if (typeof onProgress === 'function') onProgress(20, 'Loading PDF document...');

    const pdfDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });

    if (typeof onProgress === 'function') onProgress(60, 'Applying password security...');

    const saveOptions = {
      useObjectStreams: true
    };

    if (userPassword || ownerPassword) {
      saveOptions.userPassword = userPassword || ownerPassword;
      saveOptions.ownerPassword = ownerPassword || userPassword;
      
      if (permissions.printing !== undefined) saveOptions.permissions = saveOptions.permissions || {};
      if (permissions.modifying !== undefined) saveOptions.permissions = saveOptions.permissions || {};
      if (permissions.copying !== undefined) saveOptions.permissions = saveOptions.permissions || {};
      if (permissions.annotating !== undefined) saveOptions.permissions = saveOptions.permissions || {};
    }

    if (typeof onProgress === 'function') onProgress(90, 'Encrypting and saving...');
    return await pdfDoc.save(saveOptions);
  }

  /**
   * Unlock a password protected PDF
   * @param {File|ArrayBuffer} fileInput 
   * @param {string} password 
   * @param {Function} onProgress 
   * @returns {Promise<Uint8Array>}
   */
  async function unlockPdf(fileInput, password, onProgress) {
    const { PDFDocument } = PDFLib;

    const arrayBuffer = fileInput instanceof ArrayBuffer
      ? fileInput
      : await PDFTools.FileUtils.readAsArrayBuffer(fileInput);

    if (typeof onProgress === 'function') onProgress(30, 'Decrypting PDF with provided password...');

    // Attempt to load with password
    let pdfDoc;
    try {
      pdfDoc = await PDFDocument.load(arrayBuffer, {
        password: password || '',
        ignoreEncryption: false
      });
    } catch (err) {
      throw new Error('Incorrect password or unable to decrypt this PDF.');
    }

    if (typeof onProgress === 'function') onProgress(70, 'Removing encryption & signature restrictions...');

    // Strip digital signature locks & permission restrictions
    if (window.PDFTools && window.PDFTools.Compress && typeof window.PDFTools.Compress.removeDigitalSignatures === 'function') {
      try {
        await window.PDFTools.Compress.removeDigitalSignatures(pdfDoc);
      } catch (e) {
        console.warn('Signature unlock notice:', e);
      }
    }

    // Save clean unencrypted document
    return await pdfDoc.save({ useObjectStreams: true });
  }

  return {
    protectPdf,
    unlockPdf
  };
})();
