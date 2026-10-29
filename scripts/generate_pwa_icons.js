/**
 * Build Script: Generate PWA PNG Icons from icon.svg
 * Generates:
 * - icons/icon-192.png (192x192)
 * - icons/icon-512.png (512x512)
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const ICONS_DIR = path.join(ROOT_DIR, 'icons');
const SVG_FILE = path.join(ROOT_DIR, 'icon.svg');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function generateIcons() {
  console.log('Generating PWA icons from icon.svg...');
  const svgContent = fs.readFileSync(SVG_FILE, 'utf8');

  const browser = await chromium.launch({ headless: true });
  const sizes = [
    { size: 192, filename: 'icon-192.png' },
    { size: 512, filename: 'icon-512.png' }
  ];

  for (const { size, filename } of sizes) {
    const page = await browser.newPage({
      viewport: { width: size, height: size },
      deviceScaleFactor: 1
    });

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            width: ${size}px;
            height: ${size}px;
            overflow: hidden;
            background: transparent;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          svg {
            width: ${size}px;
            height: ${size}px;
          }
        </style>
      </head>
      <body>
        ${svgContent}
      </body>
      </html>
    `;

    await page.setContent(html);
    const outputPath = path.join(ICONS_DIR, filename);
    await page.screenshot({ path: outputPath, omitBackground: false });
    const stats = fs.statSync(outputPath);
    console.log(`  ✓ Generated ${filename} (${size}x${size}, ${(stats.size / 1024).toFixed(1)} KB)`);
    await page.close();
  }

  await browser.close();
  console.log('PWA icons generation complete.');
}

if (require.main === module) {
  generateIcons().catch(err => {
    console.error('Fatal error generating PWA icons:', err);
    process.exit(1);
  });
}

module.exports = { generateIcons };
