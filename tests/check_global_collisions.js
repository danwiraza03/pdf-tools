/**
 * Static Guard: Top-Level Global Collisions Across Loaded Scripts
 *
 * For every HTML page (index.html and pages/*.html):
 * 1. Extracts local script tags in order of inclusion.
 * 2. Parses top-level declarations (class, let, const, function, var).
 * 3. FAILS if two scripts on the same page declare the same top-level identifier.
 *
 * Also includes a sensitivity self-test proving that duplicate declarations
 * (such as FontIntelligenceEngine in commit 1fe4128) are caught.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

let espree;
try {
  espree = require('espree');
} catch (e) {
  espree = require(path.join(__dirname, '../node_modules/espree'));
}

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('========================================================================');
console.log('          STATIC GUARD: ZERO GLOBAL COLLISIONS ACROSS SCRIPTS           ');
console.log('========================================================================\n');

/**
 * Extract top-level declarations from JavaScript source code.
 * @param {string} code 
 * @param {string} filePath 
 * @returns {Array<{ name: string, type: string, line: number }>}
 */
function extractTopLevelDeclarations(code, filePath = '') {
  const declared = [];
  let ast;
  try {
    ast = espree.parse(code, {
      ecmaVersion: 'latest',
      sourceType: 'script',
      loc: true
    });
  } catch (err) {
    try {
      ast = espree.parse(code, {
        ecmaVersion: 'latest',
        sourceType: 'module',
        loc: true
      });
    } catch (err2) {
      console.warn(`[Warning] Could not parse ${filePath}: ${err.message}`);
      return declared;
    }
  }

  for (const node of ast.body) {
    if (node.type === 'ClassDeclaration' && node.id) {
      declared.push({ name: node.id.name, type: 'class', line: node.loc.start.line });
    } else if (node.type === 'FunctionDeclaration' && node.id) {
      declared.push({ name: node.id.name, type: 'function', line: node.loc.start.line });
    } else if (node.type === 'VariableDeclaration') {
      for (const decl of node.declarations) {
        if (decl.id && decl.id.type === 'Identifier') {
          declared.push({ name: decl.id.name, type: node.kind, line: decl.loc.start.line });
        }
      }
    }
  }
  return declared;
}

/**
 * Audit an HTML file and its referenced local scripts for collisions.
 * @param {string} htmlFilePath Relative or absolute path to HTML file
 * @param {string} baseDir Base directory of the repository
 * @returns {Array<{ symbol: string, first: string, second: string }>}
 */
function checkHtmlPageCollisions(htmlFilePath, baseDir = ROOT_DIR) {
  const fullHtmlPath = path.isAbsolute(htmlFilePath) ? htmlFilePath : path.join(baseDir, htmlFilePath);
  const htmlContent = fs.readFileSync(fullHtmlPath, 'utf8');

  // Extract <script src="...">
  const scriptRegex = /<script\s+[^>]*src=["']([^"']+)["'][^>]*>/gi;
  const scriptPaths = [];
  let m;
  while ((m = scriptRegex.exec(htmlContent)) !== null) {
    const src = m[1];
    // Ignore external URLs
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) continue;
    // Resolve relative path from HTML file location
    const resolvedPath = path.normalize(path.join(path.dirname(fullHtmlPath), src));
    // Ignore third-party vendor libraries in js/lib/
    if (resolvedPath.replace(/\\/g, '/').includes('js/lib/')) continue;
    scriptPaths.push(resolvedPath);
  }

  const seenSymbols = new Map(); // name -> { file, type, line }
  const collisions = [];

  for (const scriptPath of scriptPaths) {
    if (!fs.existsSync(scriptPath)) continue;
    const scriptCode = fs.readFileSync(scriptPath, 'utf8');
    const relScriptPath = path.relative(baseDir, scriptPath).replace(/\\/g, '/');
    const decls = extractTopLevelDeclarations(scriptCode, relScriptPath);

    for (const d of decls) {
      if (seenSymbols.has(d.name)) {
        const prev = seenSymbols.get(d.name);
        collisions.push({
          symbol: d.name,
          first: `${prev.file}:${prev.line} (${prev.type})`,
          second: `${relScriptPath}:${d.line} (${d.type})`
        });
      } else {
        seenSymbols.set(d.name, { file: relScriptPath, type: d.type, line: d.line });
      }
    }
  }

  return collisions;
}

/**
 * Prove detector sensitivity using a temporary HTML fixture and historical
 * FontIntelligenceEngine duplicate files outside the repository.
 */
function verifyDetectorSensitivity() {
  console.log('--- [MUTATION / SENSITIVITY CHECK] Verifying detector on FontIntelligenceEngine collision ---');

  const tempDir = path.join(process.env.TEMP, 'test_global_collision_sensitivity');
  const tempPagesDir = path.join(tempDir, 'pages');
  const tempJsDir = path.join(tempDir, 'js', 'editor');
  fs.mkdirSync(tempPagesDir, { recursive: true });
  fs.mkdirSync(tempJsDir, { recursive: true });

  try {
    // 1. Get historical font-engine.js and font-intelligence.js from commit 1fe4128~1
    const oldFontEngine = execSync('git show 1fe4128~1:js/editor/font-engine.js', { cwd: ROOT_DIR, encoding: 'utf8' });
    const oldFontIntelligence = execSync('git show 1fe4128~1:js/editor/font-intelligence.js', { cwd: ROOT_DIR, encoding: 'utf8' });

    fs.writeFileSync(path.join(tempJsDir, 'font-engine.js'), oldFontEngine, 'utf8');
    fs.writeFileSync(path.join(tempJsDir, 'font-intelligence.js'), oldFontIntelligence, 'utf8');

    // 2. Create fixture HTML loading both scripts
    const fixtureHtml = `
      <!DOCTYPE html>
      <html>
      <head><title>Test Viewer</title></head>
      <body>
        <script src="../js/editor/font-engine.js"></script>
        <script src="../js/editor/font-intelligence.js"></script>
      </body>
      </html>
    `;
    const fixtureHtmlPath = path.join(tempPagesDir, 'viewer.html');
    fs.writeFileSync(fixtureHtmlPath, fixtureHtml, 'utf8');

    // 3. Run collision check
    const collisions = checkHtmlPageCollisions(fixtureHtmlPath, tempDir);
    const caught = collisions.some(c => c.symbol === 'FontIntelligenceEngine');

    if (!caught) {
      throw new Error('Sensitivity test failed: Detector did NOT catch FontIntelligenceEngine duplicate class collision!');
    }

    console.log(`  ✓ Sensitivity verified: Caught duplicate class "${collisions[0].symbol}" between:`);
    console.log(`    First:  ${collisions[0].first}`);
    console.log(`    Second: ${collisions[0].second}`);
    console.log('  ✓ Test proves detector is sensitive and catches duplicate declarations.\n');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function runAudit() {
  // 1. First run sensitivity check
  verifyDetectorSensitivity();

  // 2. Audit all repository HTML files
  const htmlFiles = [
    'index.html',
    ...fs.readdirSync(path.join(ROOT_DIR, 'pages'))
      .filter(f => f.endsWith('.html'))
      .map(f => `pages/${f}`)
  ];

  console.log(`Auditing ${htmlFiles.length} HTML pages in repository for global collisions...\n`);

  let totalCollisions = 0;
  const allCollisions = [];

  for (const page of htmlFiles) {
    const collisions = checkHtmlPageCollisions(page, ROOT_DIR);
    if (collisions.length > 0) {
      console.error(`❌ [FAIL COLLISION] ${page}:`);
      for (const col of collisions) {
        console.error(`   - Symbol '${col.symbol}' declared multiple times:`);
        console.error(`       1) ${col.first}`);
        console.error(`       2) ${col.second}`);
      }
      totalCollisions += collisions.length;
      allCollisions.push({ page, collisions });
    } else {
      console.log(`  ✓ [PASS] ${page}`);
    }
  }

  console.log('\n========================================================================');
  console.log(`COLLISION AUDIT SUMMARY: ${htmlFiles.length} pages audited, ${totalCollisions} collisions found.`);
  console.log('========================================================================\n');

  if (totalCollisions > 0) {
    console.error(`❌ [FAIL] ${totalCollisions} top-level declaration collision(s) detected!`);
    process.exit(1);
  } else {
    console.log('✅ [PASS] Zero top-level declaration collisions across all pages! PASSED');
    process.exit(0);
  }
}

runAudit();

module.exports = {
  extractTopLevelDeclarations,
  checkHtmlPageCollisions,
  verifyDetectorSensitivity
};
