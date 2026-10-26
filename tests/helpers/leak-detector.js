/**
 * Shared Leak Detector
 * Searches every indirect PDF object (streams decoded, strings as-is,
 * hex-encoded variants) for a given secret string.
 *
 * Used by:
 *   - tests/test_redaction_rasterize.js
 *   - tests/test_copy_fidelity.js
 */

'use strict';

const path = require('path');
const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

const { PDFDocument, PDFStream, PDFRawStream, decodePDFRawStream } = PDFLib;

/**
 * Attempt to decode a PDF stream into its raw bytes.
 * Falls back to the encoded (compressed) bytes so that even DCT/JPEG
 * image streams are still searched for text appearing in the header bytes.
 */
function decodeStream(stream) {
  try {
    if (stream instanceof PDFRawStream) return Buffer.from(decodePDFRawStream(stream).decode());
    if (typeof stream.getUnencodedContents === 'function') return Buffer.from(stream.getUnencodedContents());
  } catch (e) {
    // Image streams (DCT) may not decode; their raw bytes are still searched below
  }
  return Buffer.from(stream.getContents ? stream.getContents() : []);
}

/**
 * Search every indirect object in a PDF for `secret` (plain text, uppercase hex,
 * and lowercase hex forms), because pdf-lib writes text as hex strings.
 *
 * @param {Uint8Array|Buffer} bytes  Raw PDF bytes
 * @param {string}            secret Plain-text secret to search for
 * @returns {Promise<string[]>} Array of PDFRef tags where the secret was found
 */
async function findLeaks(bytes, secret) {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  const needles = [
    secret,
    Buffer.from(secret, 'latin1').toString('hex').toUpperCase(),
    Buffer.from(secret, 'latin1').toString('hex').toLowerCase()
  ];
  const hits = [];
  for (const [ref, obj] of doc.context.enumerateIndirectObjects()) {
    const text = (obj instanceof PDFStream)
      ? decodeStream(obj).toString('latin1') + ' ' + obj.dict.toString()
      : obj.toString();
    if (needles.some(n => text.includes(n))) hits.push(ref.toString());
  }
  return hits;
}

module.exports = { findLeaks, decodeStream };
