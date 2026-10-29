/**
 * SEO & Sitemap Builder Script
 * Injects/updates meta descriptions, Open Graph, Twitter Cards, and canonical tags across public pages.
 * Also generates sitemap.xml dynamically from config/site.json.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const PAGES_DIR = path.join(ROOT_DIR, 'pages');
const CONFIG_PATH = path.join(ROOT_DIR, 'config/site.json');

const siteConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

// Specific titles and descriptions for tools that lacked descriptions
const TOOL_METADATA = {
  'compress.html': {
    title: 'Compress PDF — Reduce PDF File Size Online & Offline',
    description: 'Compress PDF files online while maintaining maximum quality. Choose Extreme, Recommended, or Less compression 100% offline in your browser.'
  },
  'jpg-to-pdf.html': {
    title: 'JPG to PDF — Convert Images to PDF Online & Offline',
    description: 'Convert JPG, PNG, and WebP images to high-quality PDF documents 100% offline. Reorder, adjust orientation, and combine images securely.'
  },
  'merge.html': {
    title: 'Merge PDF — Combine Multiple PDF Files Online & Offline',
    description: 'Combine multiple PDF files into one single document in seconds. Reorder pages, preserve bookmarks, and process 100% offline in your browser.'
  },
  'pdf-to-jpg.html': {
    title: 'PDF to JPG — Extract PDF Pages as Images Online & Offline',
    description: 'Convert PDF pages to high-resolution JPG or PNG images 100% offline. Extract all pages or specific page ranges with zero server uploads.'
  },
  'remove-pages.html': {
    title: 'Remove Pages from PDF — Delete PDF Pages Online & Offline',
    description: 'Delete unwanted pages from your PDF document visually. Select and remove single or multiple pages securely 100% offline in your browser.'
  },
  'reorder.html': {
    title: 'Reorder PDF Pages — Rearrange PDF Pages Online & Offline',
    description: 'Easily rearrange and reorder PDF pages with intuitive drag and drop. Sort pages visually and save your updated PDF 100% offline.'
  },
  'rotate.html': {
    title: 'Rotate PDF — Rotate PDF Pages Permanently Online & Offline',
    description: 'Rotate PDF pages 90, 180, or 270 degrees clockwise or counterclockwise. Rotate specific pages or the entire document 100% offline.'
  },
  'split.html': {
    title: 'Split PDF — Separate PDF Pages Online & Offline',
    description: 'Split PDF into individual pages or extract specific page ranges into new documents. Fast, secure, and 100% offline client-side processing.'
  },
  'watermark.html': {
    title: 'Watermark PDF — Add Text & Image Watermarks to PDF Offline',
    description: 'Stamp custom text or image watermarks onto PDF pages. Customize position, opacity, rotation, and page ranges 100% offline.'
  }
};

function buildSeo() {
  console.log('========================================================================');
  console.log('           BUILDING SEO METADATA & SITEMAP GENERATOR                    ');
  console.log('========================================================================\n');

  const filesToProcess = ['index.html'];
  const pageFiles = fs.readdirSync(PAGES_DIR)
    .filter(f => f.endsWith('.html') && f !== 'viewer.html')
    .sort();

  pageFiles.forEach(f => filesToProcess.push(`pages/${f}`));

  const sitemapUrls = [];

  filesToProcess.forEach(relPath => {
    const filePath = path.join(ROOT_DIR, relPath);
    let html = fs.readFileSync(filePath, 'utf8');

    const fileName = path.basename(relPath);
    const pageUrl = relPath === 'index.html' ? siteConfig.siteUrl : `${siteConfig.siteUrl}${relPath}`;
    sitemapUrls.push(pageUrl);

    // Extract title
    let pageTitle = siteConfig.defaultTitle;
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    if (TOOL_METADATA[fileName] && TOOL_METADATA[fileName].title) {
      pageTitle = TOOL_METADATA[fileName].title;
      html = html.replace(/<title>[^<]+<\/title>/i, `<title>${pageTitle}</title>`);
    } else if (titleMatch) {
      pageTitle = titleMatch[1].trim();
    }

    // Extract or update meta description
    let pageDesc = siteConfig.defaultDescription;
    const descMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (TOOL_METADATA[fileName] && TOOL_METADATA[fileName].description) {
      pageDesc = TOOL_METADATA[fileName].description;
      if (descMatch) {
        html = html.replace(/<meta\s+name=["']description["']\s+content=["'][^"']*["']/i, `<meta name="description" content="${pageDesc}">`);
      } else {
        html = html.replace(/(<title>[^<]+<\/title>)/i, `$1\n  <meta name="description" content="${pageDesc}">`);
      }
    } else if (descMatch) {
      pageDesc = descMatch[1].trim();
    } else {
      // Add missing default description
      html = html.replace(/(<title>[^<]+<\/title>)/i, `$1\n  <meta name="description" content="${pageDesc}">`);
    }

    const ogImageUrl = `${siteConfig.siteUrl}${siteConfig.ogImage}`;

    // Remove existing canonical, og, and twitter tags to inject clean normalized ones
    html = html.replace(/\s*<link\s+rel=["']canonical["'][^>]*>/gi, '');
    html = html.replace(/\s*<meta\s+property=["']og:[^"']+["'][^>]*>/gi, '');
    html = html.replace(/\s*<meta\s+name=["']twitter:[^"']+["'][^>]*>/gi, '');

    const seoTags = [
      `  <link rel="canonical" href="${pageUrl}">`,
      `  <meta property="og:type" content="website">`,
      `  <meta property="og:site_name" content="${siteConfig.siteName}">`,
      `  <meta property="og:title" content="${pageTitle}">`,
      `  <meta property="og:description" content="${pageDesc}">`,
      `  <meta property="og:url" content="${pageUrl}">`,
      `  <meta property="og:image" content="${ogImageUrl}">`,
      `  <meta name="twitter:card" content="summary_large_image">`,
      `  <meta name="twitter:title" content="${pageTitle}">`,
      `  <meta name="twitter:description" content="${pageDesc}">`,
      `  <meta name="twitter:image" content="${ogImageUrl}">`
    ].join('\n');

    // Inject right after description meta or title
    if (html.includes('name="description"')) {
      html = html.replace(/(<meta\s+name=["']description["'][^>]*>)/i, `$1\n${seoTags}`);
    } else {
      html = html.replace(/(<title>[^<]+<\/title>)/i, `$1\n${seoTags}`);
    }

    fs.writeFileSync(filePath, html, 'utf8');
    console.log(`  ✓ Updated SEO meta in ${relPath}`);
  });

  // Generate sitemap.xml
  const sitemapXml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapUrls.map(url => `  <url>\n    <loc>${url}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${url === siteConfig.siteUrl ? '1.0' : '0.8'}</priority>\n  </url>`),
    '</urlset>',
    ''
  ].join('\n');

  const sitemapPath = path.join(ROOT_DIR, 'sitemap.xml');
  fs.writeFileSync(sitemapPath, sitemapXml, 'utf8');
  console.log(`\n✓ Generated sitemap.xml with ${sitemapUrls.length} URLs.`);
}

if (require.main === module) {
  buildSeo();
}

module.exports = { buildSeo };

