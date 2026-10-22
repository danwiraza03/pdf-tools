/**
 * Security Engine
 * Validates encryption dictionary, passwords, and permissions (print, copy, edit, annotate).
 */

class SecurityEngine {
  /**
   * Validate if a generated or loaded PDF buffer has valid encryption
   * @param {ArrayBuffer|Uint8Array} pdfBytes
   */
  static verifyEncryption(pdfBytes) {
    if (!pdfBytes) return { isEncrypted: false, valid: false };
    const text = new TextDecoder('latin1').decode(pdfBytes.slice(0, 4000) + pdfBytes.slice(-4000));
    const hasEncryptDict = text.includes('/Encrypt');
    const hasFilter = text.includes('/Standard');
    return {
      isEncrypted: hasEncryptDict,
      handler: hasFilter ? 'Standard' : (hasEncryptDict ? 'Custom' : 'None'),
      valid: hasEncryptDict && hasFilter
    };
  }

  /**
   * Get default permission flags
   */
  static getDefaultPermissions() {
    return {
      printing: 'highResolution', // 'none'|'lowResolution'|'highResolution'
      modifying: true,
      copying: true,
      annotating: true,
      fillingForms: true,
      contentAccessibility: true,
      documentAssembly: true
    };
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.SecurityEngine = SecurityEngine;
