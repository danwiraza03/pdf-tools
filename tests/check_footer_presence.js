/**
 * Guard Test: Static Verification of Unified Footer Structure Across Pages
 *
 * Ensures that:
 * 1. index.html and ALL standalone pages in pages/ (except pages/viewer.html)
 *    contain a `<footer class="footer">` element.
 * 2. Every `<footer class="footer">` contains an element with `data-i18n="footer.text"`.
 * 3. No obsolete complex footer structures (e.g. `footer-brand`, `footer-desc`)
 *    remain in static markup.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');

console.log('========================================================================');
console.log('         STATIC GUARD: UNIFIED FOOTER PRESENCE & STRUCTURE              ');
console.log('========================================================================\n');

const htmlFiles = [path.join(ROOT_DIR, 'index.html')];
const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));

pages.forEach(p => {
  if (p !== 'viewer.html') {
    htmlFiles.push(path.join(PAGES_DIR, p));
  }
});

let failed = false;

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  // 1. Check for <footer class="footer">
  const hasFooter = /<footer\s+class=["'][^"']*footer[^"']*["']/i.test(content);
  if (!hasFooter) {
    console.error(`❌ [FAIL] ${rel}: missing <footer class="footer"> element`);
    failed = true;
    return;
  }

  // 2. Check for data-i18n="footer.text"
  const hasFooterI18n = /data-i18n=["']footer\.text["']/.test(content);
  if (!hasFooterI18n) {
    console.error(`❌ [FAIL] ${rel}: footer does not contain data-i18n="footer.text"`);
    failed = true;
    return;
  }

  // 3. Check for obsolete legacy complex structures
  const hasLegacyBrand = /class=["'][^"']*footer-brand[^"']*["']/i.test(content);
  const hasLegacyDesc = /class=["'][^"']*footer-desc[^"']*["']/i.test(content);
  if (hasLegacyBrand || hasLegacyDesc) {
    console.error(`❌ [FAIL] ${rel}: contains obsolete complex footer markup (footer-brand/footer-desc)`);
    failed = true;
    return;
  }

  console.log(`  ✓ [PASS] ${rel}`);
});

console.log('------------------------------------------------------------------------');
if (failed) {
  console.error('\n❌ Static Guard Failed: Some pages do not have a uniform footer structure.\n');
  process.exit(1);
} else {
  console.log('\n✅ Static Guard PASSED: All standalone pages possess uniform footer structure.\n');
  process.exit(0);
}

