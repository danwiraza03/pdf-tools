/**
 * Build Script: Generate Open Graph Preview Image (assets/og-image.png)
 * Uses Playwright headless Chromium to render an aesthetic 1200x630 banner locally.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT_DIR = path.resolve(__dirname, '..');
const ASSETS_DIR = path.join(ROOT_DIR, 'assets');
const OUTPUT_IMAGE = path.join(ASSETS_DIR, 'og-image.png');

if (!fs.existsSync(ASSETS_DIR)) {
  fs.mkdirSync(ASSETS_DIR, { recursive: true });
}

const HTML_TEMPLATE = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      width: 1200px;
      height: 630px;
      background: #0f172a;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
      color: #f8fafc;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: 70px 80px;
      position: relative;
      overflow: hidden;
    }
    .grid-pattern {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      background-image: linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
                        linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
      background-size: 40px 40px;
      z-index: 1;
    }
    .content {
      position: relative;
      z-index: 2;
    }
    .brand-row {
      display: flex;
      align-items: center;
      gap: 20px;
      margin-bottom: 30px;
    }
    .logo-box {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 10px 25px rgba(99, 102, 241, 0.4);
    }
    .logo-box svg {
      width: 36px;
      height: 36px;
      fill: none;
      stroke: #ffffff;
      stroke-width: 2.5;
    }
    .brand-title {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.5px;
      color: #ffffff;
    }
    .headline {
      font-size: 56px;
      font-weight: 800;
      line-height: 1.15;
      letter-spacing: -1.5px;
      max-width: 950px;
      margin-bottom: 24px;
      background: linear-gradient(180deg, #ffffff 0%, #cbd5e1 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .subline {
      font-size: 24px;
      color: #94a3b8;
      max-width: 850px;
      line-height: 1.45;
    }
    .footer-row {
      position: relative;
      z-index: 2;
      display: flex;
      align-items: center;
      justify-content: space-between;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
      padding-top: 30px;
    }
    .pills {
      display: flex;
      gap: 14px;
    }
    .pill {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      border-radius: 30px;
      padding: 8px 18px;
      font-size: 16px;
      font-weight: 600;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
    }
    .url {
      font-size: 20px;
      font-weight: 600;
      color: #818cf8;
      letter-spacing: -0.2px;
    }
  </style>
</head>
<body>
  <div class="grid-pattern"></div>
  <div class="content">
    <div class="brand-row">
      <div class="logo-box">
        <svg viewBox="0 0 24 24"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
      </div>
      <span class="brand-title">PDF Tools</span>
    </div>
    <h1 class="headline">Fast, Private & 100% Client-Side PDF Suite</h1>
    <p class="subline">Merge, split, compress, edit, OCR, sign, and convert PDFs locally in your browser. Zero server uploads.</p>
  </div>
  <div class="footer-row">
    <div class="pills">
      <div class="pill"><span class="pill-dot"></span> 100% Client-Side</div>
      <div class="pill">Zero Server Upload</div>
      <div class="pill">23 Offline Tools</div>
    </div>
    <div class="url">danwiraza03.github.io/pdf-tools</div>
  </div>
</body>
</html>
`;

async function generateOgImage() {
  console.log('Generating assets/og-image.png using Playwright...');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1200, height: 630 } });
  const page = await context.newPage();

  await page.setContent(HTML_TEMPLATE, { waitUntil: 'load' });
  await page.screenshot({ path: OUTPUT_IMAGE, type: 'png' });

  await browser.close();

  const stat = fs.statSync(OUTPUT_IMAGE);
  console.log(`✓ assets/og-image.png created successfully (${(stat.size / 1024).toFixed(1)} KB)`);
}

if (require.main === module) {
  generateOgImage().catch(err => {
    console.error('Error generating og-image:', err);
    process.exit(1);
  });
}

module.exports = { generateOgImage };
