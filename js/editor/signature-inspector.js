/**
 * Digital Signature Inspector & Safe Save
 * Detects cryptographic digital signatures (ByteRange, /Sig, /DocMDP)
 * and warns users before applying modifications that invalidate signatures.
 */

class SignatureInspector {
  /**
   * Inspect PDF binary for digital signature dictionaries
   * @param {ArrayBuffer|Uint8Array} arrayBuffer
   */
  static inspect(arrayBuffer) {
    if (!arrayBuffer) return { hasSignatures: false, count: 0, status: 'Unsigned' };

    const bytes = new Uint8Array(arrayBuffer);
    // For performance, decode in reasonable chunks or full buffer if < 10MB
    const maxScanLen = Math.min(bytes.length, 10 * 1024 * 1024);
    const text = new TextDecoder('latin1').decode(bytes.subarray(0, maxScanLen));

    const sigMatches = text.match(/\/Type\s*\/Sig/g) || [];
    const byteRangeMatches = text.match(/\/ByteRange/g) || [];
    const docMdpMatches = text.match(/\/DocMDP/g) || [];
    const subFilterMatches = text.match(/\/SubFilter\s*\/adbe\.pkcs7|\/SubFilter\s*\/ETSI/g) || [];

    const count = Math.max(sigMatches.length, byteRangeMatches.length, docMdpMatches.length, subFilterMatches.length);

    if (count > 0) {
      return {
        hasSignatures: true,
        count: count,
        status: 'Signed',
        warning: 'This document contains digital signatures. Modifying it will invalidate existing signatures.'
      };
    }

    return {
      hasSignatures: false,
      count: 0,
      status: 'Unsigned'
    };
  }

  /**
   * Inspect loaded PDF-Lib PDFDocument instance for signature fields
   * @param {PDFDocument} pdfDoc
   */
  static inspectDoc(pdfDoc) {
    if (!pdfDoc) return { hasSignatures: false, count: 0 };
    try {
      const { PDFName, PDFDict } = PDFLib;
      const context = pdfDoc.context;
      const catalog = context.lookup(context.trailerInfo.Root);
      let count = 0;

      if (catalog instanceof PDFDict) {
        if (catalog.get(PDFName.of('DSS')) || catalog.get(PDFName.of('Perms'))) {
          count++;
        }
      }

      const pages = pdfDoc.getPages();
      for (const page of pages) {
        const annots = context.lookup(page.node.get(PDFName.of('Annots')));
        if (annots && typeof annots.size === 'function') {
          for (let i = 0; i < annots.size(); i++) {
            const annot = context.lookup(annots.get(i));
            if (annot instanceof PDFDict) {
              const subtype = context.lookup(annot.get(PDFName.of('Subtype')));
              const subtypeStr = subtype ? subtype.toString() : '';
              if (subtypeStr.includes('Sig')) count++;
            }
          }
        }
      }

      return {
        hasSignatures: count > 0,
        count: count
      };
    } catch (e) {
      return { hasSignatures: false, count: 0 };
    }
  }

  /**
   * Prompt user confirmation if modifying a digitally signed document
   * @returns {Promise<boolean>} Resolves true if user confirms saving a copy
   */
  static async confirmSignedDocModification() {
    return new Promise((resolve) => {
      const confirmed = window.confirm(
        '⚠️ This document contains a digital signature.\n\nEditing the file will invalidate the existing cryptographic signature.\n\nClick OK to Save a Copy and continue, or Cancel to abort.'
      );
      resolve(confirmed);
    });
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.SignatureInspector = SignatureInspector;
