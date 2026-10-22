/**
 * UI Consistency & Zero-Emoji / Zero-Native-Dialog Verification Test
 * 
 * Audits:
 * - pages/*.html
 * - index.html
 * - js/components/*.js
 * - js/utils/i18n.js
 * 
 * Rules checked:
 * 1. Zero alert() / confirm() / prompt() (must use PDFTools.Modal or PDFTools.Toast).
 * 2. Zero Unicode emojis / pictographs in UI markup, code, and i18n dictionaries.
 * 
 * Exclusions:
 * - js/lib/
 * - Comments (HTML comments, JS block and line comments)
 * - Standard typographic marks (e.g. copyright, registered, trademark)
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('           UI RULES AUDIT: ZERO EMOJI & ZERO NATIVE DIALOGS             ');
console.log('========================================================================\n');

const targetFiles = [];

// 1. All standalone pages in pages/
const pagesDir = path.join(ROOT_DIR, 'pages');
if (fs.existsSync(pagesDir)) {
  fs.readdirSync(pagesDir).forEach(f => {
    if (f.endsWith('.html')) {
      targetFiles.push(path.join(pagesDir, f));
    }
  });
}

// 2. Landing page index.html
const indexHtml = path.join(ROOT_DIR, 'index.html');
if (fs.existsSync(indexHtml)) {
  targetFiles.push(indexHtml);
}

// 3. Components in js/components/
const componentsDir = path.join(ROOT_DIR, 'js', 'components');
if (fs.existsSync(componentsDir)) {
  fs.readdirSync(componentsDir).forEach(f => {
    if (f.endsWith('.js')) {
      targetFiles.push(path.join(componentsDir, f));
    }
  });
}

// 4. Translation dictionary js/utils/i18n.js
const i18nFile = path.join(ROOT_DIR, 'js', 'utils', 'i18n.js');
if (fs.existsSync(i18nFile)) {
  targetFiles.push(i18nFile);
}

console.log(`Auditing ${targetFiles.length} key UI & component files...\n`);

// Regex for emojis & pictographs (Extended_Pictographic covers all emoji ranges)
const emojiRegex = /\p{Extended_Pictographic}/u;

let totalLines = 0;
const violations = [];

targetFiles.forEach(filePath => {
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  let content = fs.readFileSync(filePath, 'utf8');

  // Strip multi-line comments preserving line counts
  content = content.replace(/<!--[\s\S]*?-->/g, match => match.replace(/[^\r\n]/g, ' '));
  content = content.replace(/\/\*[\s\S]*?\*\//g, match => match.replace(/[^\r\n]/g, ' '));

  const lines = content.split('\n');
  totalLines += lines.length;

  lines.forEach((rawLine, idx) => {
    const lineNum = idx + 1;
    // Strip single-line comments
    const code = rawLine.replace(/\/\/.*$/, '');

    // 1. Check for native alert/confirm/prompt
    // Allow PDFTools.Modal.confirm / alert / prompt and window.PDFTools.Modal.*
    const sanitizedModal = code.replace(/(?:window\.)?PDFTools\.Modal\.(?:confirm|prompt|alert)\s*\(/g, 'ALLOWED_MODAL(');
    const dialogMatch = sanitizedModal.match(/(?:window\.)?\b(alert|confirm|prompt)\s*\(/);
    if (dialogMatch) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: `Native Dialog: ${dialogMatch[1]}()`,
        snippet: rawLine.trim()
      });
    }

    // 2. Check for emojis (ignoring standard copyright ©, registered ®, trademark ™)
    const codeWithoutTypo = code.replace(/[©®™]/g, '');
    if (emojiRegex.test(codeWithoutTypo)) {
      violations.push({
        file: relPath,
        line: lineNum,
        type: 'Emoji / Pictograph Detected',
        snippet: rawLine.trim()
      });
    }
  });
});

console.log(`Audit Complete:`);
console.log(`- Files Checked: ${targetFiles.length}`);
console.log(`- Lines Scanned: ${totalLines}`);
console.log(`- Violations:    ${violations.length}`);

if (violations.length > 0) {
  console.error('\nFAILED! Found UI rule violations:\n');
  violations.forEach((v, i) => {
    console.error(`  ${i + 1}. [${v.type}] ${v.file}:${v.line}`);
    console.error(`     > ${v.snippet.slice(0, 100)}`);
  });
  process.exit(1);
} else {
  console.log('\nPASSED! Zero emojis and zero native dialogs found in UI files.');
  process.exit(0);
}
