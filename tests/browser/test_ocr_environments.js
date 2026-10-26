const path = require('path');
const { chromium } = require('playwright');
const { startTestServer, createTestPdf } = require('./helpers');

const TEST_PORT = 8765;
const BASE_HTTP = `http://127.0.0.1:${TEST_PORT}`;
const REPO_ROOT = path.resolve(__dirname, '../..');
const FILE_PROTOCOL_ROOT = 'file:///' + REPO_ROOT.replace(/\\/g, '/');

/**
 * Runs OCR test scenarios on pages/ocr.html and pages/viewer.html
 * under two conditions:
 *   a. Local HTTP server (http://127.0.0.1:8765)
 *   b. Direct file protocol (file:///)
 * across three languages: 'ind', 'eng', and 'ind+eng'.
 */
async function runOcrEnvironmentTests(passedBrowser = null, passedBaseUrl = null) {
  console.log('========================================================================');
  console.log('    OCR ENVIRONMENTS TEST SUITE (HTTP & FILE PROTOCOL, MULTI-LANG)     ');
  console.log('========================================================================\n');

  let server = null;
  let browser = passedBrowser;
  const baseUrl = passedBaseUrl || BASE_HTTP;

  const results = [];

  try {
    if (!browser) {
      server = await startTestServer(TEST_PORT);
      console.log(`[Test Server] Running at ${baseUrl}`);

      console.log('[Browser] Launching Chromium...');
      browser = await chromium.launch({
        headless: true
      });
    }

    const pagesToTest = [
      { name: 'pages/ocr.html', path: 'pages/ocr.html' },
      { name: 'pages/viewer.html', path: 'pages/viewer.html' }
    ];

    const conditions = [
      { name: 'http://127.0.0.1 (Server Lokal)', base: baseUrl },
      { name: 'file:/// (Tanpa Server)', base: FILE_PROTOCOL_ROOT }
    ];

    if (process.env.OCR_TEST_LIVE === '1') {
      conditions.push({
        name: 'https://danwiraza03.github.io/pdf-tools/ (Publik)',
        base: 'https://danwiraza03.github.io/pdf-tools'
      });
    }

    const languages = ['ind', 'eng', 'ind+eng'];

    for (const pageInfo of pagesToTest) {
      for (const cond of conditions) {
        for (const lang of languages) {
          const testLabel = `[${pageInfo.name}] [${cond.name}] [Lang: ${lang}]`;
          console.log(`\n>>> Testing: ${testLabel}`);

          const context = await browser.newContext();
          const page = await context.newPage();

          const capturedConsole = [];
          const capturedPageErrors = [];
          let firstPathError = null;

          page.on('console', msg => {
            const text = msg.text();
            capturedConsole.push({ type: msg.type(), text });
            if (text.includes('Offline worker bundle initialization notice:')) {
              firstPathError = text;
            }
          });

          page.on('pageerror', err => {
            const msg = err.message || String(err);
            capturedPageErrors.push(msg);
          });

          // Inject hook before scripts load to capture the raw error object from console.warn
          await page.addInitScript(() => {
            window.__firstPathNotice = null;
            const origWarn = console.warn.bind(console);
            console.warn = function (...args) {
              origWarn(...args);
              if (args[0] && typeof args[0] === 'string' && args[0].includes('Offline worker bundle initialization notice:')) {
                const err = args[1];
                window.__firstPathNotice = err ? (err.stack || err.message || String(err)) : String(args[0]);
              }
            };
          });

          const url = `${cond.base}/${pageInfo.path}`;
          let status = 'GAGAL';
          let finalError = null;
          let firstPathDetail = null;
          let ocrTextResult = null;
          let ocrExecution = null;

          try {
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });

            // Wait until PDFTools.OCR is available (or page loads)
            try {
              await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.OCR), { timeout: 4000 });
            } catch (waitOcrErr) {
              // PDFTools.OCR might not be available if script execution halted
            }

            // If on viewer.html and StudioRenderer is available, load a sample PDF
            if (pageInfo.path.includes('viewer.html')) {
              try {
                await page.waitForFunction(() => !!(window.PDFTools && window.PDFTools.StudioRenderer), { timeout: 1500 });
                const samplePdfBytes = await createTestPdf({ text: 'SAMPLE DOCUMENT FOR OCR', width: 400, height: 200 });
                await page.evaluate(async (base64) => {
                  const bin = atob(base64);
                  const bytes = new Uint8Array(bin.length);
                  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
                  const file = new File([bytes], 'ocr_test.pdf', { type: 'application/pdf' });
                  await window.PDFTools.StudioRenderer.openDocument(file);
                }, Buffer.from(samplePdfBytes).toString('base64'));
              } catch (studioErr) {
                // StudioRenderer not ready or not loaded
              }
            }

            // Run OCR with a 15-second timeout per attempt to catch hanging workers
            ocrExecution = await page.evaluate(async (targetLang) => {
              const hasWorkerBundle = typeof window !== 'undefined' && typeof window.__TESSERACT_WORKER_CODE__ !== 'undefined' && window.__TESSERACT_WORKER_CODE__ !== null;
              const hasTesseract = typeof window !== 'undefined' && typeof window.Tesseract !== 'undefined';
              const hasOcr = typeof window !== 'undefined' && !!(window.PDFTools && window.PDFTools.OCR);

              if (!hasOcr) {
                return {
                  success: false,
                  error: 'PDFTools.OCR tidak terdefinisi pada halaman ini',
                  hasWorkerBundle,
                  hasTesseract,
                  hasOcr,
                  firstPathHook: null
                };
              }

              const canvas = document.createElement('canvas');
              canvas.width = 320;
              canvas.height = 100;
              const ctx = canvas.getContext('2d');
              ctx.fillStyle = '#FFFFFF';
              ctx.fillRect(0, 0, 320, 100);
              ctx.fillStyle = '#000000';
              ctx.font = 'bold 28px Arial, sans-serif';
              ctx.fillText('TES OCR ' + targetLang.toUpperCase(), 20, 60);

              const runPromise = (async () => {
                try {
                  const res = await window.PDFTools.OCR.recognizeCanvas(canvas, targetLang);
                  const txt = (res && res.text) ? res.text.trim() : '';
                  return { success: true, text: txt };
                } catch (e) {
                  return { success: false, error: e.message || String(e), stack: e.stack };
                } finally {
                  try {
                    await window.PDFTools.OCR.terminate();
                  } catch (termErr) {}
                }
              })();

              const timeoutPromise = new Promise(resolve => {
                setTimeout(() => {
                  resolve({
                    success: false,
                    error: 'TIMEOUT (15s): Worker menggantung/tidak merespons job (rawWorker.onerror / message missing)',
                    isTimeout: true
                  });
                }, 15000);
              });

              const result = await Promise.race([runPromise, timeoutPromise]);
              const rawFirstPath = window.__firstPathNotice;

              return {
                ...result,
                hasWorkerBundle,
                hasTesseract,
                hasOcr,
                firstPathHook: rawFirstPath
              };
            }, lang);

            firstPathDetail = ocrExecution.firstPathHook || firstPathError;

            if (ocrExecution.success) {
              status = 'BERHASIL';
              ocrTextResult = ocrExecution.text;
              console.log(`  ✓ OCR Berhasil. Hasil: "${ocrTextResult.replace(/\n/g, ' ')}"`);
            } else {
              status = 'GAGAL';
              finalError = ocrExecution.error;
              console.log(`  ✗ OCR Gagal: ${finalError}`);
            }
          } catch (navOrWaitErr) {
            status = 'GAGAL';
            finalError = navOrWaitErr.message || String(navOrWaitErr);
            console.log(`  ✗ Error navigasi / inisialisasi halaman: ${finalError}`);
          } finally {
            if (!firstPathDetail) {
              const noticeLog = capturedConsole.find(c => c.text.includes('Offline worker bundle initialization notice:'));
              if (noticeLog) {
                firstPathDetail = noticeLog.text;
              } else if (ocrExecution && !ocrExecution.hasWorkerBundle) {
                const syntaxErr = capturedPageErrors.find(e => e.includes('tesseract-worker.bundle.js') || e.includes('undefined') || e.includes('SyntaxError'));
                if (syntaxErr) {
                  firstPathDetail = `Bundel worker gagal di-parse: ${syntaxErr}`;
                } else if (pageInfo.path.includes('viewer.html')) {
                  firstPathDetail = 'Bundel worker tidak dimuat di HTML (tesseract-worker.bundle.js tidak disertakan)';
                } else {
                  firstPathDetail = 'window.__TESSERACT_WORKER_CODE__ tidak terdefinisi';
                }
              }
            }

            results.push({
              page: pageInfo.name,
              condition: cond.name,
              language: lang,
              status,
              finalError: finalError || '-',
              firstPathError: firstPathDetail || 'Tidak ada notice (jalur pertama dilewati/gagal sebelum runtime)',
              textResult: ocrTextResult || '-',
              capturedConsole,
              capturedPageErrors
            });

            await page.close();
            await context.close();
          }
        }
      }
    }
  } finally {
    if (!passedBrowser && browser) {
      await browser.close();
    }
    if (server) {
      server.close();
    }
  }

  // Print Summary Table
  console.log('\n\n========================================================================================================================');
  console.log('                                          HASIL REPRODUKSI PENGUJIAN OCR                                                 ');
  console.log('========================================================================================================================');
  console.log('| Halaman                  | Kondisi                   | Bahasa  | Status   | Error Asli Jalur Pertama (createOfflineWorker)       |');
  console.log('------------------------------------------------------------------------------------------------------------------------');

  for (const r of results) {
    const pagePad = r.page.padEnd(24);
    const condPad = r.condition.padEnd(25);
    const langPad = r.language.padEnd(7);
    const statusPad = r.status.padEnd(8);
    let firstErr = r.firstPathError;
    if (r.capturedPageErrors && r.capturedPageErrors.length > 0) {
      firstErr = `[Page Error] ${r.capturedPageErrors.join('; ')}`;
    }
    const cleanErr = firstErr.replace(/\r?\n/g, ' ').substring(0, 52);
    console.log(`| ${pagePad} | ${condPad} | ${langPad} | ${statusPad} | ${cleanErr.padEnd(52)} |`);
  }
  console.log('========================================================================================================================\n');

  console.log('\n--- DETAIL PESAN KONSOL DAN ERROR PER KONDISI ---');
  for (const r of results) {
    console.log(`\n▶ [${r.page}] [${r.condition}] [${r.language}] -> Status: ${r.status}`);
    if (r.capturedPageErrors.length > 0) {
      console.log(`  [Page Errors]: ${r.capturedPageErrors.join(' | ')}`);
    }
    if (r.finalError && r.finalError !== '-') {
      console.log(`  [Pesan Error Akhir]: ${r.finalError}`);
    }
    console.log(`  [Jalur Pertama]: ${r.firstPathError}`);
    const relevantLogs = r.capturedConsole.filter(c => c.type === 'error' || c.type === 'warning');
    if (relevantLogs.length > 0) {
      console.log(`  [Console Warn/Error]:`);
      relevantLogs.forEach(l => console.log(`    - [${l.type}] ${l.text}`));
    }
  }

  return results;
}

if (require.main === module) {
  runOcrEnvironmentTests().then(results => {
    const hasFailures = results && results.some(r => r.status !== 'BERHASIL');
    if (hasFailures) {
      console.error('\n❌ Beberapa skenario OCR gagal!');
      process.exit(1);
    } else {
      console.log('\n✔ Semua skenario OCR berhasil!');
      process.exit(0);
    }
  }).catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
  });
}

module.exports = { runOcrEnvironmentTests };
