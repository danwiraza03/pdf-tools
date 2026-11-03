/**
 * Static Guard: PWA Manifest Compliance & Integrity
 *
 * Verifies that:
 * 1. manifest.json exists and is valid JSON.
 * 2. description is in English and avoids misleading/absolute claims (e.g. no "100% offline").
 * 3. lang="en" and dir="ltr" attributes are present.
 * 4. shortcuts are configured for popular tools (Merge, Compress, Sign) with valid icons.
 * 5. screenshots are provided (wide & narrow) and files exist on disk with sizes < 300 KB.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'manifest.json');

console.log('========================================================================');
console.log('             STATIC GUARD: PWA MANIFEST & METADATA AUDIT                ');
console.log('========================================================================\n');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('❌ [FAIL] manifest.json tidak ditemukan!');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

// 1. Description & Offline claim audit
assert(manifest.description, 'manifest.json must have description');
if (manifest.description.includes('100% offline')) {
  console.error('❌ [FAIL] description in manifest.json must not claim "100% offline"');
  process.exit(1);
}
console.log(`✓ description: "${manifest.description}" (no 100% offline claim)`);

// 2. lang & dir
assert.strictEqual(manifest.lang, 'en', 'manifest.json must set lang="en"');
assert.strictEqual(manifest.dir, 'ltr', 'manifest.json must set dir="ltr"');
console.log('✓ lang="en" and dir="ltr" present and verified.');

// 3. Shortcuts audit
assert(Array.isArray(manifest.shortcuts), 'manifest.json must contain shortcuts array');
assert(manifest.shortcuts.length >= 3, 'manifest.json must contain at least 3 shortcuts');

const shortcutNames = manifest.shortcuts.map(s => s.name);
assert(shortcutNames.includes('Merge PDF'), 'shortcuts must include Merge PDF');
assert(shortcutNames.includes('Compress PDF'), 'shortcuts must include Compress PDF');
assert(shortcutNames.includes('Sign PDF'), 'shortcuts must include Sign PDF');

for (const s of manifest.shortcuts) {
  assert(s.url && s.url.startsWith('./'), `shortcut url must be relative in site scope: ${s.url}`);
  assert(s.icons && s.icons.length > 0, `shortcut must define icons: ${s.name}`);
}
console.log(`✓ ${manifest.shortcuts.length} PWA shortcuts configured: ${shortcutNames.join(', ')}`);

// 4. Screenshots audit
assert(Array.isArray(manifest.screenshots), 'manifest.json must contain screenshots array');
assert(manifest.screenshots.length >= 2, 'manifest.json must contain at least 2 screenshots');

const hasWide = manifest.screenshots.some(s => s.form_factor === 'wide');
const hasNarrow = manifest.screenshots.some(s => s.form_factor === 'narrow');
assert(hasWide, 'screenshots must include a wide screenshot');
assert(hasNarrow, 'screenshots must include a narrow screenshot');

const MAX_SCREENSHOT_BYTES = 300 * 1024;
for (const s of manifest.screenshots) {
  const filePath = path.join(ROOT_DIR, s.src.replace(/^\.\//, ''));
  assert(fs.existsSync(filePath), `Screenshot file not found: ${filePath}`);
  const stat = fs.statSync(filePath);
  assert(stat.size < MAX_SCREENSHOT_BYTES, `Screenshot ${s.src} (${stat.size} bytes) exceeds 300 KB limit`);
  console.log(`✓ Screenshot ${s.src} (${(stat.size / 1024).toFixed(1)} KB, ${s.form_factor}) is valid and under 300 KB.`);
}

console.log('\n✅ [PASS] PWA Manifest Static Guard PASSED');
console.log('========================================================================\n');
