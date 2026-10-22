const fs = require('fs');
const path = require('path');

const ROOT = 'c:/laragon/www/pdf';

function normalizeSvg(str) {
  if (!str) return 'MISSING';
  const elements = str.match(/<(path|rect|circle|line|polyline|polygon)[^>]*>/gi) || [];
  return elements.map(el => el.replace(/\s+/g, ' ').trim()).join('');
}

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const cmdPalette = fs.readFileSync(path.join(ROOT, 'js/components/command-palette.js'), 'utf8');

// Parse tools from command-palette.js
const regex = /{\s*id:\s*'([^']+)',[\s\S]*?icon:\s*'([^']+)'/g;
let match;
let count = 0;
let errors = 0;

console.log('=== CHECKING COMMAND PALETTE ICONS VS INDEX GRID ===');

while ((match = regex.exec(cmdPalette)) !== null) {
  const toolId = match[1];
  const cmdSvg = normalizeSvg(match[2]);

  // Find corresponding tool in index.html (grid card or hero)
  let targetFile = toolId;
  if (toolId === 'studio' || toolId === 'edit-studio') targetFile = 'viewer';
  if (toolId === 'batch') targetFile = 'batch';

  const gridM = indexHtml.match(new RegExp(`pages/${targetFile}\\.html"[^>]*class="tool-grid-card"[\\s\\S]*?<svg[^>]*>([\\s\\S]*?)<\\/svg>`, 'i'));
  if (gridM) {
    count++;
    const gridSvg = normalizeSvg(gridM[1]);
    if (cmdSvg !== gridSvg) {
      console.log(`[MISMATCH] ${toolId}`);
      console.log(`   CmdPalette: ${cmdSvg}`);
      console.log(`   GridCard:   ${gridSvg}`);
      errors++;
    } else {
      console.log(`[MATCH] ${toolId.padEnd(16)}: OK`);
    }
  } else {
    console.log(`[INFO] ${toolId.padEnd(16)}: No direct grid card (e.g. specialized action)`);
  }
}

console.log(`\nResult: ${errors} errors found in ${count} tools checked.`);
