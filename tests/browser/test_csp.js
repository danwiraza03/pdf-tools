/**
 * Automated Browser Test: Content Security Policy (CSP) Verification
 *
 * Verifies that:
 * 1. Legitimate offline page assets and execution trigger 0 CSP violations across pages.
 * 2. External script, image, and network fetch attempts are strictly BLOCKED by the browser.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const PORT = 8771;
const ROOT_DIR = path.resolve(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm'
};

function createServer() {
  return http.createServer((req, res) => {
    let reqPath = decodeURIComponent(req.url.split('?')[0]);
    if (reqPath === '/' || reqPath === '') reqPath = '/index.html';

    const fullPath = path.join(ROOT_DIR, reqPath);
    if (!fullPath.startsWith(ROOT_DIR)) {
      res.writeHead(403);
      return res.end('Forbidden');
    }

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      const ext = path.extname(fullPath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      const content = fs.readFileSync(fullPath);
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      });
      res.end(content);
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
}

async function runCspTests() {
  console.log('='.repeat(72));
  console.log('       AUTOMATED CONTENT SECURITY POLICY (CSP) VERIFICATION     ');
  console.log('='.repeat(72));

  const server = createServer();
  await new Promise((resolve) => server.listen(PORT, '127.0.0.1', resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;
  console.log(`✓ Test server running at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const pagesToTest = [
    'index.html',
    'pages/merge.html',
    'pages/compress.html',
    'pages/ocr.html',
    'pages/sign.html',
    'pages/batch.html',
    'pages/form-fill.html'
  ];

  try {
    // 1. Verify 0 legitimate violations across representative pages
    console.log('\n--- 1. Testing Legitimate Page Operation (0 Violations Expected) ---');
    for (const pageRel of pagesToTest) {
      await page.goto(`${baseUrl}/${pageRel}`, { waitUntil: 'domcontentloaded' });

      // Check violation records collected from document
      const violations = await page.evaluate(() => {
        return window.__cspViolations || [];
      });

      if (violations.length > 0) {
        throw new Error(`Unexpected CSP violation in ${pageRel}: ${JSON.stringify(violations)}`);
      }
      console.log(`✓ [PASS] ${pageRel}: Clean execution, 0 CSP violations.`);
    }

    // 2. Actively Test Enforcement & Rejection of External Domains
    console.log('\n--- 2. Active Enforcement Test: Injecting External Resources ---');
    await page.goto(`${baseUrl}/index.html`, { waitUntil: 'networkidle' });

    // Install listener
    await page.evaluate(() => {
      window.__cspViolations = [];
      window.addEventListener('securitypolicyviolation', (e) => {
        window.__cspViolations.push({
          effectiveDirective: e.effectiveDirective,
          blockedURI: e.blockedURI,
          violatedDirective: e.violatedDirective
        });
      });
    });

    // Attempt A: External Script Injection
    console.log('  Testing blocked external script...');
    const scriptAttempt = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = 'https://malicious-cdn.example.com/evil.js';
        script.onerror = () => resolve('blocked');
        script.onload = () => resolve('loaded');
        document.head.appendChild(script);
        setTimeout(() => resolve('timeout'), 1000);
      });
    });

    // Attempt B: External Fetch / Telemetry
    console.log('  Testing blocked external fetch telemetry...');
    const fetchAttempt = await page.evaluate(async () => {
      try {
        await fetch('https://telemetry-tracker.example.com/api/ping', { mode: 'no-cors' });
        return 'allowed';
      } catch (err) {
        return 'blocked';
      }
    });

    // Attempt C: External Image Tracker
    console.log('  Testing blocked external tracking image...');
    const imgAttempt = await page.evaluate(async () => {
      return new Promise((resolve) => {
        const img = document.createElement('img');
        img.src = 'https://tracker.example.com/pixel.png';
        img.onerror = () => resolve('blocked');
        img.onload = () => resolve('loaded');
        document.body.appendChild(img);
        setTimeout(() => resolve('timeout'), 1000);
      });
    });

    // Verify all attempts were caught by CSP
    const caughtViolations = await page.evaluate(() => window.__cspViolations);
    console.log(`  Captured ${caughtViolations.length} securitypolicyviolation events.`);

    const scriptViolation = caughtViolations.some(v => v.effectiveDirective.includes('script-src'));
    const connectViolation = caughtViolations.some(v => v.effectiveDirective.includes('connect-src'));
    const imgViolation = caughtViolations.some(v => v.effectiveDirective.includes('img-src'));

    if (!scriptViolation) {
      throw new Error('FAIL: External script was not blocked by script-src CSP!');
    }
    console.log('✓ External script injection successfully BLOCKED by script-src CSP.');

    if (!connectViolation) {
      throw new Error('FAIL: External fetch was not blocked by connect-src CSP!');
    }
    console.log('✓ External telemetry fetch successfully BLOCKED by connect-src CSP.');

    if (!imgViolation) {
      throw new Error('FAIL: External image tracker was not blocked by img-src CSP!');
    }
    console.log('✓ External image tracker successfully BLOCKED by img-src CSP.');

    console.log('='.repeat(72));
    console.log('✅ [ALL PASSED] Content Security Policy fully active and enforcing!');
    console.log('='.repeat(72));
  } finally {
    await browser.close();
    server.close();
  }
}

runCspTests().catch(err => {
  console.error('\n❌ CSP Browser Verification Failed:', err);
  process.exit(1);
});
