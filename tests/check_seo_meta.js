/**
 * Static & Integrity Guard for SEO Metadata, Open Graph, Canonical, and Sitemap
 */

'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const SITE_CONFIG = JSON.parse(fs.readFileSync(path.join(ROOT_DIR, 'config/site.json'), 'utf8'));

console.log('========================================================================');
console.log('       STATIC GUARD: SEO METADATA, OPEN GRAPH & SITEMAP AUDIT           ');
console.log('========================================================================\n');

// 1. Verify sitemap.xml exists
const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
assert.ok(fs.existsSync(sitemapPath), 'sitemap.xml must exist at repository root');
const sitemapContent = fs.readFileSync(sitemapPath, 'utf8');

// 2. Verify og-image.png exists and size is reasonable (< 300KB)
const ogImagePath = path.join(ROOT_DIR, 'assets/og-image.png');
assert.ok(fs.existsSync(ogImagePath), 'assets/og-image.png must exist');
const ogImageStat = fs.statSync(ogImagePath);
assert.ok(ogImageStat.size > 1000 && ogImageStat.size < 300 * 1024, `og-image.png size must be between 1KB and 300KB, got ${ogImageStat.size} bytes`);
console.log(`✓ assets/og-image.png verified (${(ogImageStat.size / 1024).toFixed(1)} KB)`);

// 3. Inspect public standalone HTML files (excluding viewer.html per scope rules)
const htmlFiles = [path.join(ROOT_DIR, 'index.html')];
fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html') && f !== 'viewer.html').forEach(f => {
  htmlFiles.push(path.join(PAGES_DIR, f));
});

console.log(`Auditing SEO tags across ${htmlFiles.length} public standalone pages...\n`);

let hasFailure = false;

htmlFiles.forEach(file => {
  const rel = path.relative(ROOT_DIR, file).replace(/\\/g, '/');
  const content = fs.readFileSync(file, 'utf8');

  // Must have meta description
  const descMatch = content.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
  if (!descMatch || descMatch[1].trim().length < 20) {
    console.error(`❌ [FAIL] ${rel}: missing or too short <meta name="description">`);
    hasFailure = true;
  }

  // Must have canonical link
  const canonicalMatch = content.match(/<link\s+rel=["']canonical["']\s+href=["']([^"']+)["']/i);
  if (!canonicalMatch || !canonicalMatch[1].startsWith(SITE_CONFIG.siteUrl)) {
    console.error(`❌ [FAIL] ${rel}: missing or invalid <link rel="canonical">`);
    hasFailure = true;
  }

  // Must have og:title, og:description, og:url, og:image, og:type
  const hasOgTitle = /<meta\s+property=["']og:title["']/i.test(content);
  const hasOgDesc = /<meta\s+property=["']og:description["']/i.test(content);
  const hasOgUrl = /<meta\s+property=["']og:url["']/i.test(content);
  const hasOgImage = /<meta\s+property=["']og:image["']/i.test(content);
  const hasOgType = /<meta\s+property=["']og:type["']/i.test(content);
  const hasTwitterCard = /<meta\s+name=["']twitter:card["']/i.test(content);

  if (!hasOgTitle || !hasOgDesc || !hasOgUrl || !hasOgImage || !hasOgType || !hasTwitterCard) {
    console.error(`❌ [FAIL] ${rel}: missing Open Graph or Twitter card tags`);
    hasFailure = true;
  }

  // Verify file is in sitemap.xml
  const pageUrl = rel === 'index.html' ? SITE_CONFIG.siteUrl : `${SITE_CONFIG.siteUrl}${rel}`;
  if (!sitemapContent.includes(pageUrl)) {
    console.error(`❌ [FAIL] ${rel}: URL ${pageUrl} is not listed in sitemap.xml`);
    hasFailure = true;
  }

  if (!hasFailure) {
    console.log(`  ✓ [PASS] ${rel}`);
  }
});

if (hasFailure) {
  console.error('\n❌ SEO Audit Failed! Fix violations above.');
  process.exit(1);
} else {
  console.log('\n✅ [ALL PASSED] SEO Metadata, Open Graph, Canonical, and Sitemap Guard PASSED.');
  process.exit(0);
}

