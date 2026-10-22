const fs = require('fs');
const path = require('path');

const ROOT = 'c:/laragon/www/pdf';

function normalizeSvg(str) {
  if (!str) return 'MISSING';
  // Extract paths, rects, lines, polylines, circles, polygons
  const elements = str.match(/<(path|rect|circle|line|polyline|polygon)[^>]*>/gi) || [];
  return elements.map(el => el.replace(/\s+/g, ' ').trim()).join('');
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const appJs = fs.readFileSync(path.join(ROOT, 'js/app.js'), 'utf8');
const cmdPalette = fs.readFileSync(path.join(ROOT, 'js/components/command-palette.js'), 'utf8');

const tools = [
  'merge', 'split', 'remove-pages', 'reorder', 'rotate', 'crop',
  'compress', 'ocr', 'grayscale', 'flatten',
  'pdf-to-docx', 'docx-to-pdf', 'pdf-to-xlsx', 'xlsx-to-pdf', 'pdf-to-jpg', 'jpg-to-pdf',
  'viewer', 'page-number', 'watermark', 'form-fill', 'sign', 'protect', 'unlock'
];

console.log('====================================================');
console.log('       COMPREHENSIVE MULTI-MENU ICON AUDIT          ');
console.log('====================================================\n');

let totalChecks = 0;
let mismatches = 0;

for (const tool of tools) {
  // 1. Index Dropdown (if present)
  let idxDropdown = null;
  const idxDropM = indexHtml.match(new RegExp(`pages/${tool}\\.html"[^>]*class="dropdown-item-link"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (idxDropM) idxDropdown = normalizeSvg(idxDropM[1]);

  // 2. Index Mega Menu
  let idxMega = null;
  const idxMegaM = indexHtml.match(new RegExp(`pages/${tool}\\.html"[^>]*class="mega-item-link"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (idxMegaM) idxMega = normalizeSvg(idxMegaM[1]);

  // 3. Index Grid Card
  let idxGrid = null;
  const idxGridM = indexHtml.match(new RegExp(`pages/${tool}\\.html"[^>]*class="tool-grid-card"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (idxGridM) idxGrid = normalizeSvg(idxGridM[1]);

  // 4. App Dropdown
  let appDrop = null;
  const appDropM = appJs.match(new RegExp(`pagesUrl}${tool}\\.html"[^>]*class="dropdown-item-link"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (appDropM) appDrop = normalizeSvg(appDropM[1]);

  // 5. App Mega
  let appMega = null;
  const appMegaM = appJs.match(new RegExp(`pagesUrl}${tool}\\.html"[^>]*class="mega-item-link"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (appMegaM) appMega = normalizeSvg(appMegaM[1]);

  // 6. Standalone Page Hero
  let heroSvg = null;
  const pageFile = path.join(ROOT, `pages/${tool === 'viewer' ? 'viewer' : tool}.html`);
  if (fs.existsSync(pageFile)) {
    const pageContent = fs.readFileSync(pageFile, 'utf8');
    const heroM = pageContent.match(/<div class="tool-hero-icon[^>]*>[\s\S]*?<svg[^>]*>([\s\S]*?)<\/svg>/i);
    if (heroM) heroSvg = normalizeSvg(heroM[1]);
  }

  // Compare all non-null icons
  const list = [
    { name: 'IndexDropdown', svg: idxDropdown },
    { name: 'IndexMega', svg: idxMega },
    { name: 'IndexGrid', svg: idxGrid },
    { name: 'AppDrop', svg: appDrop },
    { name: 'AppMega', svg: appMega },
    { name: 'PageHero', svg: heroSvg }
  ].filter(x => x.svg !== null);

  const baseline = list[0];
  let toolMismatch = false;
  for (const item of list) {
    totalChecks++;
    if (item.svg !== baseline.svg) {
      console.log(`[MISMATCH] ${tool}: ${baseline.name} vs ${item.name}`);
      console.log(`   Baseline: ${baseline.svg}`);
      console.log(`   Conflict: ${item.svg}`);
      toolMismatch = true;
      mismatches++;
    }
  }

  if (!toolMismatch) {
    console.log(`[PASS] ${tool.padEnd(16)}: Consistent across ${list.map(x=>x.name).join(', ')}`);
  }
}

console.log('\n====================================================');
console.log(`Audit Finished: ${mismatches} mismatches found across ${totalChecks} checks.`);
console.log('====================================================');
