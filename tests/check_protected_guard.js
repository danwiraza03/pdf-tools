/**
 * Static Guard: Protected PDF (pdf-protect.js & modal.js) Presence Audit
 *
 * Verifies that any HTML page loading file-utils.js MUST also load
 * both pdf-protect.js and modal.js so that PDFTools.FileUtils.loadPdfDecrypted
 * can properly decrypt protected documents and display password prompts.
 */

'use strict';

const fs = require('fs');
const path = require('path');

function findHtmlFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== '.git') {
        findHtmlFiles(fullPath, fileList);
      }
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

function verifyHtmlFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  if (!content.includes('file-utils.js')) {
    return null; // Not applicable
  }

  const missing = [];
  if (!content.includes('pdf-protect.js')) {
    missing.push('pdf-protect.js');
  }
  if (!content.includes('modal.js')) {
    missing.push('modal.js');
  }

  if (missing.length > 0) {
    return {
      file: filePath,
      missing
    };
  }
  return null;
}

function runAudit(targetDir) {
  console.log('========================================================================');
  console.log('   STATIC GUARD: PDF-PROTECT.JS & MODAL.JS PRESENCE AUDIT               ');
  console.log('========================================================================\n');

  const rootDir = targetDir || path.resolve(__dirname, '..');
  const htmlFiles = findHtmlFiles(rootDir);

  console.log(`Scanning ${htmlFiles.length} HTML files in ${rootDir}...\n`);

  const violations = [];
  let checkedCount = 0;

  for (const file of htmlFiles) {
    const result = verifyHtmlFile(file);
    const content = fs.readFileSync(file, 'utf8');
    if (content.includes('file-utils.js')) {
      checkedCount++;
      if (result) {
        violations.push(result);
      }
    }
  }

  console.log(`Ditemukan ${checkedCount} halaman HTML yang memuat file-utils.js.`);

  if (violations.length > 0) {
    console.error(`\n❌ [GAGAL] ${violations.length} halaman memuat file-utils.js tanpa dependensi lengkap:`);
    for (const v of violations) {
      const rel = path.relative(rootDir, v.file).replace(/\\/g, '/');
      console.error(`  - ${rel}: Kurang ${v.missing.join(' dan ')}`);
    }
    console.log('\n========================================================================\n');
    return false;
  }

  console.log(`\n✅ [LULUS] Semua ${checkedCount} halaman HTML yang memuat file-utils.js telah menyertakan pdf-protect.js dan modal.js.`);
  console.log('========================================================================\n');
  return true;
}

if (require.main === module) {
  const customDir = process.argv[2] ? path.resolve(process.argv[2]) : null;
  const passed = runAudit(customDir);
  process.exitCode = passed ? 0 : 1;
}

module.exports = { runAudit, verifyHtmlFile, findHtmlFiles };

