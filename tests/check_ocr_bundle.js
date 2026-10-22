const fs = require('fs');
const path = require('path');

const bundlePath = path.resolve(__dirname, '../js/lib/tesseract/tesseract-worker.bundle.js');
let bundle = fs.readFileSync(bundlePath, 'utf8');
const targetStr = 'define([],()=>TesseractCore);';
console.log('Found define:', bundle.includes(targetStr));

if (!bundle.includes('self.TesseractCore = TesseractCore')) {
  const replacement = 'define([],()=>TesseractCore); if (typeof self !== "undefined") self.TesseractCore = TesseractCore; if (typeof globalThis !== "undefined") globalThis.TesseractCore = TesseractCore;';
  bundle = bundle.replace(targetStr, replacement);
  fs.writeFileSync(bundlePath, bundle, 'utf8');
  console.log('Patched tesseract-worker.bundle.js successfully!');
} else {
  console.log('Already patched!');
}
