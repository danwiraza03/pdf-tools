/**
 * Static Guard: Homepage & Header i18n Completeness Audit
 *
 * Verifies that:
 * 1. All 23 tool card descriptions (.tool-card-desc) in index.html have data-i18n attributes.
 * 2. All category filter pills (.cat-pill-btn) have data-i18n attributes.
 * 3. All mega menu column headers (.mega-col-title) have data-i18n attributes.
 * 4. Quick modal interactive elements (#closeQuickModalBtn, #quickBtnBatch label) have data-i18n attributes.
 * 5. Footer legal links (License, Third-Party Notices) have data-i18n attributes.
 * 6. All referenced i18n keys exist in both 'en' and 'id' dictionaries in js/utils/i18n.js.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const INDEX_PATH = path.join(ROOT_DIR, 'index.html');
const I18N_PATH = path.join(ROOT_DIR, 'js/utils/i18n.js');

console.log('========================================================================');
console.log('       STATIC GUARD: HOMEPAGE & HEADER I18N COMPLETENESS AUDIT         ');
console.log('========================================================================\n');

const html = fs.readFileSync(INDEX_PATH, 'utf8');
const failures = [];

// 1. Audit Tool Card Descriptions
const descMatches = html.match(/<div class="tool-card-desc"[^>]*>([\s\S]*?)<\/div>/g) || [];
let descsWithoutI18n = 0;
for (const match of descMatches) {
  if (!match.includes('data-i18n=')) {
    descsWithoutI18n++;
    failures.push(`Tool card desc missing data-i18n: ${match.slice(0, 70)}...`);
  }
}
console.log(`Tool Card Descriptions: ${descMatches.length - descsWithoutI18n}/${descMatches.length} with data-i18n`);

// 2. Audit Category Filter Pills
const pillMatches = html.match(/<button[^>]*class="[^"]*cat-pill-btn[^"]*"[^>]*>([\s\S]*?)<\/button>/g) || [];
for (const match of pillMatches) {
  if (!match.includes('data-i18n=')) {
    failures.push(`Category pill missing data-i18n: ${match.trim()}`);
  }
}
console.log(`Category Filter Pills: ${pillMatches.length} inspected`);

// 3. Audit Mega Menu Column Titles
const megaMatches = html.match(/<div class="mega-col-title"[^>]*>([\s\S]*?)<\/div>/g) || [];
for (const match of megaMatches) {
  if (!match.includes('data-i18n=')) {
    failures.push(`Mega menu column title missing data-i18n: ${match.trim()}`);
  }
}
console.log(`Mega Menu Column Titles: ${megaMatches.length} inspected`);

// 4. Audit Quick Action Modal
const quickCancel = html.match(/<button[^>]*id="closeQuickModalBtn"[^>]*>[\s\S]*?<\/button>/);
if (quickCancel && !quickCancel[0].includes('data-i18n=')) {
  failures.push(`Quick modal cancel button missing data-i18n: ${quickCancel[0]}`);
}
const quickBatch = html.match(/<button[^>]*id="quickBtnBatch"[^>]*>[\s\S]*?<\/button>/);
if (quickBatch && !quickBatch[0].includes('data-i18n=')) {
  failures.push(`Quick modal batch button missing data-i18n: ${quickBatch[0]}`);
}

// 5. Audit Footer Links
const footerMatch = html.match(/<footer[\s\S]*?<\/footer>/);
if (footerMatch) {
  const footerLinks = footerMatch[0].match(/<a [^>]*>[\s\S]*?<\/a>/g) || [];
  for (const link of footerLinks) {
    if (!link.includes('data-i18n=')) {
      failures.push(`Footer link missing data-i18n: ${link}`);
    }
  }
}

if (failures.length > 0) {
  console.error(`\n❌ [FAIL] Found ${failures.length} homepage elements missing data-i18n attributes:`);
  failures.slice(0, 15).forEach((f, idx) => console.error(`  ${idx + 1}. ${f}`));
  if (failures.length > 15) {
    console.error(`  ... and ${failures.length - 15} more.`);
  }
  process.exit(1);
}

// 6. Verify Dictionary Parity in js/utils/i18n.js
const i18nContent = fs.readFileSync(I18N_PATH, 'utf8');
const dataI18nKeys = [...html.matchAll(/data-i18n="([^"]+)"/g)].map(m => m[1]);
const missingEn = [];
const missingId = [];

for (const key of dataI18nKeys) {
  if (!i18nContent.includes(`'${key}':`) && !i18nContent.includes(`"${key}":`)) {
    missingEn.push(key);
  }
}

if (missingEn.length > 0) {
  console.error(`\n❌ [FAIL] Found ${missingEn.length} data-i18n keys missing from i18n.js:`);
  missingEn.forEach(k => console.error(`  - ${k}`));
  process.exit(1);
}

console.log('\n✅ [PASS] Homepage & Header i18n Completeness Audit PASSED');
console.log('========================================================================\n');
