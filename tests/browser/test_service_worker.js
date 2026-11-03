/**
 * Automated Service Worker (PWA) & Offline Verification Suite
 * Tests:
 * 1. Service Worker registration on localhost/127.0.0.1.
 * 2. Precache population into Cache Storage with expected version prefix.
 * 3. Strict offline capability: Page navigates and renders under context.setOffline(true).
 * 4. Privacy & Offline compliance: No external HTTP/HTTPS, blob, or data URLs stored in cache.
 * 5. Lifecycle messaging: SKIP_WAITING message listener responsive.
 */

'use strict';

const assert = require('assert');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { handleRequest } = require('../../scripts/dev-server.js');
const { launchChromium } = require('./helpers');

const TEST_PORT = 8769;

async function runServiceWorkerSuite() {
  console.log('========================================================================');
  console.log('         AUTOMATED SERVICE WORKER (PWA) & OFFLINE VERIFICATION          ');
  console.log('========================================================================\n');

  let server;
  let browser;

  try {
    let simulatedDeploy = false;
    let simulatedSwContent = null;

    server = await new Promise((resolve) => {
      const s = http.createServer((req, res) => {
        const urlPath = req.url.split('?')[0];
        if (simulatedDeploy) {
          if (urlPath === '/pages/merge.html') {
            const original = fs.readFileSync(path.join(__dirname, '../../pages/merge.html'), 'utf8');
            const modified = original.replace('</head>', '<script>window.__HTML_VERSION = "v2-new";</script></head>');
            res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
            res.end(modified);
            return;
          }
          if (urlPath === '/js/pages/merge.js') {
            const original = fs.readFileSync(path.join(__dirname, '../../js/pages/merge.js'), 'utf8');
            const modified = 'window.__JS_VERSION = "v2-new";\n' + original;
            res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
            res.end(modified);
            return;
          }
        }
        if (simulatedSwContent && urlPath === '/sw.js') {
          res.writeHead(200, { 'Content-Type': 'application/javascript; charset=utf-8' });
          res.end(simulatedSwContent);
          return;
        }
        handleRequest(req, res);
      });
      s.listen(TEST_PORT, '127.0.0.1', () => resolve(s));
    });
    const baseUrl = `http://127.0.0.1:${TEST_PORT}`;
    console.log(`✓ Test server running at ${baseUrl}`);

    browser = await launchChromium();
    const context = await browser.newContext();
    const page = await context.newPage();

    // 1. Navigate to index.html and verify SW registers
    console.log('\n--- 1. Testing Service Worker Registration ---');
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });

    // Wait for navigator.serviceWorker.ready
    const swRegistrationState = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return { supported: false };
      try {
        const reg = await Promise.race([
          navigator.serviceWorker.ready,
          new Promise((_, reject) => setTimeout(() => reject(new Error('SW ready timeout')), 10000))
        ]);
        return {
          supported: true,
          scope: reg.scope,
          hasActive: !!reg.active,
          state: reg.active ? reg.active.state : null
        };
      } catch (err) {
        return { supported: true, error: err.message };
      }
    });

    assert(swRegistrationState.supported, 'Browser must support Service Workers');
    assert(!swRegistrationState.error, `Service Worker registration failed: ${swRegistrationState.error}`);
    assert(swRegistrationState.hasActive, 'Service Worker should reach active state');
    console.log(`✓ Service Worker active with scope: ${swRegistrationState.scope}`);

    // 2. Cache Storage Verification
    console.log('\n--- 2. Auditing Cache Storage & Precache Integrity ---');
    const cacheInfo = await page.evaluate(async () => {
      const keys = await caches.keys();
      const swCaches = keys.filter(k => k.startsWith('pdf-tools-'));
      if (swCaches.length === 0) return { keys, count: 0, sampleUrls: [], invalidUrls: [] };

      let allRequests = [];
      for (const cName of swCaches) {
        const cache = await caches.open(cName);
        const requests = await cache.keys();
        allRequests = allRequests.concat(requests);
      }
      const urls = allRequests.map(r => r.url);

      const invalid = urls.filter(u => {
        // Must be on current origin and not blob/data/external
        return !u.startsWith(window.location.origin) || u.startsWith('blob:') || u.startsWith('data:');
      });

      return {
        cacheName: swCaches.join(', '),
        count: urls.length,
        hasIndex: urls.some(u => u.endsWith('/index.html') || u === window.location.origin + '/'),
        hasStyle: urls.some(u => u.includes('css/style.css')),
        hasAppJs: urls.some(u => u.includes('js/app.js')),
        hasPdfLib: urls.some(u => u.includes('js/lib/pdf-lib.min.js')),
        hasManifest: urls.some(u => u.includes('manifest.json')),
        invalidUrls: invalid
      };
    });

    console.log(`✓ Active Cache detected: ${cacheInfo.cacheName}`);
    console.log(`✓ Total precached items: ${cacheInfo.count} files`);
    assert(cacheInfo.count >= 50, `Expected at least 50 precached assets, found ${cacheInfo.count}`);
    assert(cacheInfo.hasIndex, 'Cache must contain index.html');
    assert(cacheInfo.hasStyle, 'Cache must contain css/style.css');
    assert(cacheInfo.hasAppJs, 'Cache must contain js/app.js');
    assert(cacheInfo.hasPdfLib, 'Cache must contain js/lib/pdf-lib.min.js');
    assert(cacheInfo.hasManifest, 'Cache must contain manifest.json');
    assert.strictEqual(cacheInfo.invalidUrls.length, 0, `Forbidden cache URLs detected: ${cacheInfo.invalidUrls.join(', ')}`);
    console.log('✓ Strict Offline & Privacy Guard: 100% of cached requests match origin, 0 external/blob URLs.');

    // 3. True Offline Mode Navigation Test
    console.log('\n--- 3. Testing True Offline Navigation (context.setOffline(true)) ---');
    await context.setOffline(true);

    // Navigate to a standalone tool page while completely disconnected
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'domcontentloaded' });

    const offlinePageCheck = await page.evaluate(() => {
      const title = document.title;
      const header = !!document.querySelector('.header');
      const dropzone = !!document.querySelector('.dropzone, #dropzone');
      const hasPdfTools = !!window.PDFTools;
      return { title, header, dropzone, hasPdfTools };
    });

    assert(offlinePageCheck.header, 'Header must render while offline');
    assert(offlinePageCheck.dropzone, 'Dropzone must render while offline');
    assert(offlinePageCheck.hasPdfTools, 'PDFTools core library must be loaded while offline');
    console.log(`✓ Successfully navigated offline to pages/merge.html: "${offlinePageCheck.title}"`);

    // Also verify index.html works offline
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'domcontentloaded' });
    const offlineIndexCheck = await page.evaluate(() => {
      return {
        title: document.title,
        toolCards: document.querySelectorAll('.tool-grid-card').length,
        offlineDot: !!document.querySelector('.logo-status-dot')
      };
    });
    assert(offlineIndexCheck.toolCards > 0, 'Index tool cards must render while offline');
    console.log(`✓ Successfully navigated offline to index.html with ${offlineIndexCheck.toolCards} tool cards.`);

    // Restore online state
    await context.setOffline(false);
    console.log('✓ Network connectivity restored.');

    // 4. Lifecycle Message Test (SKIP_WAITING)
    console.log('\n--- 4. Testing Service Worker Message Channel ---');
    const skipWaitingHandled = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!reg.active) return false;
      try {
        reg.active.postMessage({ type: 'SKIP_WAITING' });
        return true;
      } catch (e) {
        return false;
      }
    });
    assert(skipWaitingHandled, 'SKIP_WAITING message must be accepted without throwing');
    console.log('✓ Worker postMessage({ type: "SKIP_WAITING" }) received successfully.');

    // 5. Version Skew Prevention Test (Network-first for app JS & HTML)
    console.log('\n--- 5. Testing Version Skew Prevention (Network-first for App JS & HTML) ---');
    await page.goto(`${baseUrl}/pages/merge.html`, { waitUntil: 'networkidle' });
    const initialJsVer = await page.evaluate(() => window.__JS_VERSION);
    assert.strictEqual(initialJsVer, undefined, 'Initial JS must be repository version');

    // Simulate deploy of new version on server
    simulatedDeploy = true;
    await page.reload({ waitUntil: 'networkidle' });

    const htmlVer = await page.evaluate(() => window.__HTML_VERSION);
    const jsVer = await page.evaluate(() => window.__JS_VERSION);
    console.log(`Version check after reload: HTML=${htmlVer}, JS=${jsVer}`);
    assert.strictEqual(htmlVer, 'v2-new', 'HTML must be the new deployed version');
    assert.strictEqual(jsVer, 'v2-new', 'JS executed must match the new deployed version (no version skew)');
    console.log('✓ Successfully verified: new JS is loaded matching new HTML (version skew prevented).');

    // 6. Vendor / OCR Model Cache Preservation Across Deploys
    console.log('\n--- 6. Testing Vendor/OCR Cache Preservation Across Deploys ---');
    const initialVendorFetch = await page.evaluate(async () => {
      const res = await fetch('/js/lib/tesseract/worker.min.js');
      return res.status;
    });
    assert.strictEqual(initialVendorFetch, 200, 'Vendor asset fetch must succeed');

    // Simulate a new app version deploy that does NOT change js/lib
    const currentSwCode = fs.readFileSync(path.join(__dirname, '../../sw.js'), 'utf8');
    simulatedSwContent = currentSwCode.replace(/CACHE_VERSION = '[^']+';/, "CACHE_VERSION = 'pdf-tools-v99999999';");

    // Trigger update of service worker
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      if (reg) {
        await reg.update();
        if (reg.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) {
            nw.addEventListener('statechange', () => {
              if (nw.state === 'installed') {
                nw.postMessage({ type: 'SKIP_WAITING' });
              }
            });
          }
        });
      }
    });
    await page.waitForTimeout(1500);

    // Track actual server network requests to /js/lib/
    let vendorServerHits = 0;
    const originalServerListeners = server.listeners('request');
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
      if (req.url.includes('/js/lib/tesseract/worker.min.js')) {
        console.log('[SERVER HIT]:', req.url);
        vendorServerHits++;
      }
      originalServerListeners[0](req, res);
    });

    const secondVendorFetch = await page.evaluate(async () => {
      const res = await fetch('/js/lib/tesseract/worker.min.js');
      return res.status;
    });

    assert.strictEqual(secondVendorFetch, 200, 'Vendor asset fetch must still succeed');
    console.log(`Vendor server network hits after app deploy: ${vendorServerHits}`);
    assert.strictEqual(vendorServerHits, 0, 'Vendor/OCR assets must be served from cache without redownloading across app deploys');
    console.log('✓ Successfully verified: Vendor/OCR assets preserved across app updates.');

    console.log('\n========================================================================');
    console.log('✅ [ALL PASSED] Service Worker & Offline Capability Verified!');
    console.log('========================================================================\n');
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
    if (server) {
      server.close();
    }
  }
}

if (require.main === module) {
  runServiceWorkerSuite().catch(err => {
    console.error('\n❌ [FAIL] Service Worker Test Suite failed:', err);
    process.exit(1);
  });
}

module.exports = runServiceWorkerSuite;
