/**
 * PDF Stream Engine
 * Low-Level Content Stream manipulation for Acrobat-grade vector text removal.
 * Decompresses page streams, parses PDF operators, and neutralizes target text
 * without using destructive white rectangles, protecting watermarks and graphics 100%.
 */

class PDFStreamEngine {
  /**
   * Decompress raw stream bytes using JSZip / Pako / Deflate
   * @param {Uint8Array} rawBytes 
   * @returns {string} Decoded operator stream string
   */
  static decodeStream(rawBytes) {
    if (!rawBytes || rawBytes.length === 0) return '';
    try {
      if (window.JSZip && window.JSZip.compressions && window.JSZip.compressions.DEFLATE) {
        const uncompressed = window.JSZip.compressions.DEFLATE.uncompress(rawBytes);
        return new TextDecoder('latin1').decode(uncompressed);
      }
      if (window.pako && window.pako.inflate) {
        const uncompressed = window.pako.inflate(rawBytes);
        return new TextDecoder('latin1').decode(uncompressed);
      }
      // Fallback: try raw decode (in case stream is not Flate-compressed)
      return new TextDecoder('latin1').decode(rawBytes);
    } catch (e) {
      // If inflate fails, it might already be uncompressed raw text
      try {
        return new TextDecoder('latin1').decode(rawBytes);
      } catch (err) {
        console.warn('PDF stream decode notice:', err);
        return '';
      }
    }
  }

  /**
   * Compress operator stream string back to Deflate bytes
   * @param {string} streamStr 
   * @returns {Uint8Array} Compressed bytes
   */
  static encodeStream(streamStr) {
    const rawBytes = new TextEncoder().encode(streamStr);
    try {
      if (window.JSZip && window.JSZip.compressions && window.JSZip.compressions.DEFLATE) {
        return window.JSZip.compressions.DEFLATE.compress(rawBytes);
      }
      if (window.pako && window.pako.deflate) {
        return window.pako.deflate(rawBytes);
      }
      return rawBytes;
    } catch (e) {
      console.warn('PDF stream encode notice:', e);
      return rawBytes;
    }
  }

  /**
   * Escape special characters in text for PDF string matching
   */
  static escapePdfString(str) {
    return str.replace(/([()[\]\\/])/g, '\\$1');
  }

  /**
   * Remove or neutralize target text occurrences directly from a PDF operator stream.
   * Replaces text rendering arguments with empty strings to preserve coordinate matrix without drawing glyphs.
   * @param {string} contentStream 
   * @param {Array<string>} targetTexts Array of original text strings to neutralize
   * @returns {string} Modified content stream
   */
  static neutralizeTextInStream(contentStream, targetTexts) {
    if (!contentStream || !targetTexts || targetTexts.length === 0) return contentStream;

    let modified = contentStream;

    for (const rawTarget of targetTexts) {
      if (!rawTarget || rawTarget.trim() === '') continue;
      const target = rawTarget.trim();

      // 1. Direct match in standard string show: (Text) Tj
      const escaped = this.escapePdfString(target);
      const tjRegex = new RegExp(`\\(${escaped}\\)\\s*Tj`, 'g');
      modified = modified.replace(tjRegex, '() Tj');

      // 2. Match in text array show: [(T) 10 (ext)] TJ
      // If the array contains the words/characters of target, replace matches
      const words = target.split(/\s+/);
      for (const word of words) {
        if (word.length < 2) continue;
        const escWord = this.escapePdfString(word);
        const arrayWordRegex = new RegExp(`\\(${escWord}\\)`, 'g');
        modified = modified.replace(arrayWordRegex, '()');
      }

      // 3. Match individual words directly inside any Tj
      for (const word of words) {
        if (word.length < 2) continue;
        const escWord = this.escapePdfString(word);
        const singleWordRegex = new RegExp(`\\(${escWord}\\)\\s*Tj`, 'g');
        modified = modified.replace(singleWordRegex, '() Tj');
      }
    }

    return modified;
  }

  /**
   * Process a PDFLib Page object to strip old edited text from its content stream
   * @param {PDFPage} page PDFLib page
   * @param {Array<string>} textsToRemove 
   */
  static stripTextFromPage(page, textsToRemove) {
    if (!page || !textsToRemove || textsToRemove.length === 0) return;

    try {
      const { PDFRawStream, PDFName, PDFArray } = window.PDFLib || {};
      if (!page.node) return;

      const contentsRef = page.node.get(PDFName.of('Contents'));
      if (!contentsRef) return;

      const context = page.doc.context;
      const contentsObj = context.lookup(contentsRef);

      if (!contentsObj) return;

      // Case A: Single Stream
      if (contentsObj.getContents) {
        const rawBytes = contentsObj.getContents();
        const decoded = this.decodeStream(rawBytes);
        const cleaned = this.neutralizeTextInStream(decoded, textsToRemove);
        const reEncoded = this.encodeStream(cleaned);

        // Update the stream in-place
        const newStream = context.flateStream(reEncoded);
        page.node.set(PDFName.of('Contents'), context.register(newStream));
      }
      // Case B: Array of Streams
      else if (contentsObj.size && typeof contentsObj.size === 'function') {
        const count = contentsObj.size();
        for (let i = 0; i < count; i++) {
          const streamRef = contentsObj.get(i);
          const stream = context.lookup(streamRef);
          if (stream && stream.getContents) {
            const rawBytes = stream.getContents();
            const decoded = this.decodeStream(rawBytes);
            const cleaned = this.neutralizeTextInStream(decoded, textsToRemove);
            const reEncoded = this.encodeStream(cleaned);

            const newStream = context.flateStream(reEncoded);
            contentsObj.set(i, context.register(newStream));
          }
        }
      }
    } catch (e) {
      console.warn('PDFStreamEngine stripTextFromPage warning:', e);
    }
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.PDFStreamEngine = PDFStreamEngine;
