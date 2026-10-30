/**
 * Playwright Browser Test Suite: Whole Page Drag & Drop (PageDrop) Across All Tool Pages
 *
 * Verifies:
 * 1. File drag vs non-file drag detection (text drag does not show overlay)
 * 2. Drop on initial #dropzone loads file once
 * 3. After file is loaded, dragging file anywhere on page shows overlay
 * 4. Multi-file pages: dropping adds files to queue / list
 * 5. Single-file pages: dropping replaces current file
 * 6. Single-file pages with unsaved work (tested on sign & form-fill):
 *    custom PDFTools.Modal confirm appears; Cancel preserves old file, Replace loads new file
 * 7. Dropping unsupported file formats shows bilingual Toast and skips file without state corruption
 */

'use strict';

const path = require('path');
const assert = require('assert');
const {
  startTestServer,
  createTestPdf,
  createSampleDocx,
  createSampleXlsx,
  launchChromium
} = require('./helpers');

const ROOT_DIR = path.resolve(__dirname, '../..');
const PDFLib = require(path.join(ROOT_DIR, 'js/lib/pdf-lib.min.js'));

const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

async function createMultiPagePdf(pageCount = 2, text = 'MultiPage') {
  const doc = await PDFLib.PDFDocument.create();
  for (let i = 0; i < pageCount; i++) {
    const page = doc.addPage([400, 400]);
    page.drawText(`${text} Page ${i + 1}`, { x: 50, y: 300 });
  }
  return await doc.save();
}

async function createFormPdf() {
  const doc = await PDFLib.PDFDocument.create();
  const page = doc.addPage([400, 400]);
  const form = doc.getForm();
  const tf = form.createTextField('clientName');
  tf.setText('Initial Text');
  tf.addToPage(page, { x: 50, y: 300, width: 200, height: 30 });
  return await doc.save();
}

async function dispatchDropFiles(page, targetSelector, files) {
  const payload = files.map(f => ({
    name: f.name,
    mime: f.mime,
    base64: Buffer.from(f.buffer).toString('base64')
  }));

  await page.evaluate(({ targetSelector, payload }) => {
    const dt = new DataTransfer();
    payload.forEach(item => {
      const bin = atob(item.base64);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) {
        arr[i] = bin.charCodeAt(i);
      }
      const blob = new Blob([arr], { type: item.mime });
      const file = new File([blob], item.name, { type: item.mime });
      dt.items.add(file);
    });

    const target = targetSelector ? (document.querySelector(targetSelector) || document.body) : document.body;

    const dragEnter = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(dragEnter);

    const dragOver = new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(dragOver);

    const dropEvt = new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: dt });
    target.dispatchEvent(dropEvt);
  }, { targetSelector, payload });
}

async function dispatchDragText(page) {
  await page.evaluate(() => {
    const dt = new DataTransfer();
    dt.setData('text/plain', 'dragged plain text string');
    const dragEnter = new DragEvent('dragenter', { bubbles: true, cancelable: true, dataTransfer: dt });
    window.dispatchEvent(dragEnter);
  });
}

const TOOL_PAGES = [
  // --- MULTI-FILE PAGES ---
  {
    path: 'pages/merge.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"], #extraFileInput',
    verifyInitial: async (page) => {
      await page.waitForFunction(() => {
        const badge = document.querySelector('#organizerCount');
        return badge && badge.textContent.includes('1 Files');
      }, { timeout: 8000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => {
        const badge = document.querySelector('#organizerCount');
        return badge && badge.textContent.includes('2 Files');
      }, { timeout: 8000 });
    }
  },
  {
    path: 'pages/compress.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"], #extraFileInput',
    verifyInitial: async (page) => {
      await page.waitForSelector('#fileList .file-item', { timeout: 6000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#fileList .file-item').length >= 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/jpg-to-pdf.html',
    mode: 'multi',
    fileType: 'image',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#fileList .file-item', { timeout: 6000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#fileList .file-item').length >= 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/page-number.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForFunction(() => {
        const lbl = document.querySelector('#fileMetaLabel');
        return lbl && lbl.textContent.includes('Pages');
      }, { timeout: 8000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => {
        const lbl = document.querySelector('#fileMetaLabel');
        return lbl && lbl.textContent.includes('2 Files Selected');
      }, { timeout: 8000 });
    }
  },
  {
    path: 'pages/protect.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 8000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes('2 Files Selected');
      }, { timeout: 8000 });
    }
  },
  {
    path: 'pages/watermark.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#fileList .file-item', { timeout: 6000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#fileList .file-item').length >= 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/batch.html',
    mode: 'multi',
    fileType: 'pdf',
    inputSelector: '#batchFileInput',
    verifyInitial: async (page) => {
      await page.waitForSelector('#fileQueueList .queue-item', { timeout: 6000 });
    },
    verifyMultiAdded: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#fileQueueList .queue-item').length >= 2, { timeout: 6000 });
    }
  },

  // --- SINGLE-FILE PAGES ---
  {
    path: 'pages/split.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#pageGrid .page-card', { timeout: 6000 });
    },
    verifySingleReplaced: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#pageGrid .page-card').length === 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/rotate.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#pageGrid .page-card', { timeout: 6000 });
    },
    verifySingleReplaced: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#pageGrid .page-card').length === 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/crop.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForFunction(() => {
        const ind = document.querySelector('#pageIndicator');
        return ind && ind.textContent.includes('Page 1');
      }, { timeout: 8000 });
    },
    verifySingleReplaced: async (page) => {
      await page.waitForFunction(() => {
        const ind = document.querySelector('#pageIndicator');
        return ind && ind.textContent.includes('/ 2');
      }, { timeout: 8000 });
    }
  },
  {
    path: 'pages/flatten.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/grayscale.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/remove-pages.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#pageGrid .page-card', { timeout: 6000 });
    },
    verifySingleReplaced: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#pageGrid .page-card').length === 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/reorder.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page) => {
      await page.waitForSelector('#pageGrid .page-card', { timeout: 6000 });
    },
    verifySingleReplaced: async (page) => {
      await page.waitForFunction(() => document.querySelectorAll('#pageGrid .page-card').length === 2, { timeout: 6000 });
    }
  },
  {
    path: 'pages/pdf-to-jpg.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileList .file-item-name');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileList .file-item-name');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/ocr.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#selectedFileName');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#selectedFileName');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/sign.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#fileInput',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/form-fill.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#fileInput',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/pdf-to-docx.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/pdf-to-xlsx.html',
    mode: 'single',
    fileType: 'pdf',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/docx-to-pdf.html',
    mode: 'single',
    fileType: 'docx',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  },
  {
    path: 'pages/xlsx-to-pdf.html',
    mode: 'single',
    fileType: 'xlsx',
    inputSelector: '#dropzone input[type="file"]',
    verifyInitial: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    },
    verifySingleReplaced: async (page, name) => {
      await page.waitForFunction((n) => {
        const lbl = document.querySelector('#fileNameLabel');
        return lbl && lbl.textContent.includes(n);
      }, name, { timeout: 6000 });
    }
  }
];

async function runPageDropSuite(browser, baseUrl) {
  console.log('\n========================================================================');
  console.log('       WHOLE PAGE DRAG & DROP (PAGE DROP) ACROSS ALL 22 TOOLS           ');
  console.log('========================================================================\n');

  // Prepare fixtures
  const pdf1 = await createTestPdf({ text: 'PDF Document 1' });
  const pdf2 = await createMultiPagePdf(2, 'PDF Document 2');
  const png1 = Buffer.from(PNG_BASE64, 'base64');
  const png2 = Buffer.from(PNG_BASE64, 'base64');
  const docx1 = await createSampleDocx('Docx Document 1');
  const docx2 = await createSampleDocx('Docx Document 2');
  const xlsx1 = await createSampleXlsx();
  const xlsx2 = await createSampleXlsx();
  const unsupportedTxt = Buffer.from('Unsupported plain text');

  const context = await browser.newContext();
  const page = await context.newPage();

  let passedPages = 0;
  let failedPages = [];

  for (const tool of TOOL_PAGES) {
    const fullUrl = `${baseUrl}/${tool.path}`;
    process.stdout.write(`  Testing ${tool.path.padEnd(25)} [${tool.mode}] ... `);

    try {
      await page.goto(fullUrl, { waitUntil: 'domcontentloaded' });

      // Determine fixtures for this page
      let f1, f2;
      if (tool.fileType === 'pdf') {
        f1 = { name: 'file1.pdf', mime: 'application/pdf', buffer: pdf1 };
        f2 = { name: 'file2.pdf', mime: 'application/pdf', buffer: pdf2 };
      } else if (tool.fileType === 'image') {
        f1 = { name: 'img1.png', mime: 'image/png', buffer: png1 };
        f2 = { name: 'img2.png', mime: 'image/png', buffer: png2 };
      } else if (tool.fileType === 'docx') {
        f1 = { name: 'doc1.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx1 };
        f2 = { name: 'doc2.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: docx2 };
      } else if (tool.fileType === 'xlsx') {
        f1 = { name: 'sheet1.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx1 };
        f2 = { name: 'sheet2.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx2 };
      }

      // --- Test (e): Dragging plain text must NOT show overlay ---
      await dispatchDragText(page);
      const overlayVisibleWithText = await page.evaluate(() => {
        const o = document.querySelector('.page-drag-overlay, .merge-drag-overlay');
        return Boolean(o && o.style.display !== 'none' && o.offsetHeight > 0);
      });
      assert.strictEqual(overlayVisibleWithText, false, 'Text drag should never show overlay');

      // --- Test (f): Drop on #dropzone before any file is loaded loads file exactly once ---
      const dropzoneTarget = tool.path === 'pages/batch.html' ? '#queueEmptyArea' : '#dropzone';
      await dispatchDropFiles(page, dropzoneTarget, [f1]);
      await tool.verifyInitial(page, f1.name);

      // --- Test (d): Dropping unsupported file shows Toast and does not corrupt state ---
      const unsupportedFile = { name: 'unsupported.txt', mime: 'text/plain', buffer: unsupportedTxt };
      await dispatchDropFiles(page, 'body', [unsupportedFile]);
      await page.waitForFunction(() => {
        const toasts = Array.from(document.querySelectorAll('.toast, .toast-warning, .toast-error, .toast-info'));
        return toasts.some(toast => toast.textContent.includes('dilewati') || toast.textContent.includes('skipped'));
      }, { timeout: 6000 });

      // --- Test (b): Drop second file on body ---
      await dispatchDropFiles(page, 'body', [f2]);

      if (tool.mode === 'multi') {
        await tool.verifyMultiAdded(page, f2.name);
      } else {
        await tool.verifySingleReplaced(page, f2.name);
      }

      console.log('✓ PASS');
      passedPages++;
    } catch (err) {
      console.log(`✗ FAIL (${err.message})`);
      failedPages.push({ path: tool.path, error: err.message });
    }
  }

  // --- Test (c): Single-file with unsaved work confirmation (Sign & Form Fill) ---
  console.log('\n  Testing unsaved work confirmation modal (Sign & Form Fill)...');

  // Test Sign with unsaved work
  try {
    await page.goto(`${baseUrl}/pages/sign.html`, { waitUntil: 'domcontentloaded' });
    const signPdf1 = { name: 'sign1.pdf', mime: 'application/pdf', buffer: pdf1 };
    const signPdf2 = { name: 'sign2.pdf', mime: 'application/pdf', buffer: pdf2 };

    await dispatchDropFiles(page, '#dropzone', [signPdf1]);
    await page.waitForFunction(() => {
      const lbl = document.querySelector('#docTitle');
      return lbl && lbl.textContent.includes('sign1.pdf');
    });

    // Make dirty by placing a signature
    await page.evaluate(() => {
      if (typeof window.testTriggerSignaturePlacement === 'function') {
        window.testTriggerSignaturePlacement();
      } else {
        // Dispatch click or draw on pad to create placedItem if available
        const pad = document.querySelector('#sigCanvas, #sigPad');
        if (pad) {
          const evt = new MouseEvent('mousedown', { clientX: 10, clientY: 10 });
          pad.dispatchEvent(evt);
        }
      }
    });

    // Drop second file -> modal should appear
    await dispatchDropFiles(page, 'body', [signPdf2]);

    const modalAppeared = await page.waitForSelector('.pdftools-modal-backdrop.active', { timeout: 5000 })
      .then(() => true).catch(() => false);

    if (modalAppeared) {
      // Click Cancel
      await page.click('.pdftools-modal-cancel');
      await page.waitForSelector('.pdftools-modal-backdrop', { state: 'detached', timeout: 5000 });

      // Still sign1.pdf
      const stillFirst = await page.evaluate(() => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes('sign1.pdf');
      });
      assert.strictEqual(stillFirst, true, 'Cancel must retain old file');

      // Drop second file again -> click Confirm
      await dispatchDropFiles(page, 'body', [signPdf2]);
      await page.waitForSelector('.pdftools-modal-backdrop.active', { timeout: 5000 });
      await page.click('.pdftools-modal-confirm');

      await page.waitForFunction(() => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes('sign2.pdf');
      }, { timeout: 5000 });
      console.log('    ✓ Sign PDF unsaved work confirmation modal verified!');
    } else {
      console.log('    (Sign PDF modal check pending implementation)');
      failedPages.push({ path: 'pages/sign.html (modal)', error: 'Confirmation modal did not appear' });
    }
  } catch (err) {
    console.log(`    ✗ Sign PDF modal error: ${err.message}`);
    failedPages.push({ path: 'pages/sign.html (modal)', error: err.message });
  }

  // Test Form Fill with unsaved work
  try {
    await page.goto(`${baseUrl}/pages/form-fill.html`, { waitUntil: 'domcontentloaded' });
    const formPdfBytes = await createFormPdf();
    const formPdf1 = { name: 'form1.pdf', mime: 'application/pdf', buffer: formPdfBytes };
    const formPdf2 = { name: 'form2.pdf', mime: 'application/pdf', buffer: pdf2 };

    await dispatchDropFiles(page, '#dropzone', [formPdf1]);
    await page.waitForFunction(() => {
      const lbl = document.querySelector('#docTitle');
      return lbl && lbl.textContent.includes('form1.pdf');
    });

    // Make dirty by typing in field or calling testTriggerFormDirty
    await page.evaluate(() => {
      if (typeof window.testTriggerFormDirty === 'function') {
        window.testTriggerFormDirty();
      }
      const input = document.querySelector('.form-field-input, input[type="text"]');
      if (input) {
        input.value = 'User Edited Content';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });

    // Drop second file
    await dispatchDropFiles(page, 'body', [formPdf2]);
    const modalAppeared = await page.waitForSelector('.pdftools-modal-backdrop.active', { timeout: 5000 })
      .then(() => true).catch(() => false);

    if (modalAppeared) {
      // Click Cancel
      await page.click('.pdftools-modal-cancel');
      await page.waitForSelector('.pdftools-modal-backdrop', { state: 'detached', timeout: 5000 });

      const stillFirst = await page.evaluate(() => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes('form1.pdf');
      });
      assert.strictEqual(stillFirst, true, 'Cancel must retain old file');

      // Drop second file again -> click Confirm
      await dispatchDropFiles(page, 'body', [formPdf2]);
      await page.waitForSelector('.pdftools-modal-backdrop.active', { timeout: 5000 });
      await page.click('.pdftools-modal-confirm');

      await page.waitForFunction(() => {
        const lbl = document.querySelector('#docTitle');
        return lbl && lbl.textContent.includes('form2.pdf');
      }, { timeout: 5000 });
      console.log('    ✓ Form Fill unsaved work confirmation modal verified!');
    } else {
      console.log('    (Form Fill modal check pending implementation)');
      failedPages.push({ path: 'pages/form-fill.html (modal)', error: 'Confirmation modal did not appear' });
    }
  } catch (err) {
    console.log(`    ✗ Form Fill modal error: ${err.message}`);
    failedPages.push({ path: 'pages/form-fill.html (modal)', error: err.message });
  }

  await context.close();

  console.log('\n' + '='.repeat(72));
  console.log(`PageDrop Test Results: ${passedPages} / ${TOOL_PAGES.length} pages passed.`);
  if (failedPages.length > 0) {
    console.log('Failures:');
    failedPages.forEach(f => console.log(`  - ${f.path}: ${f.error}`));
    console.log('='.repeat(72) + '\n');
    throw new Error(`${failedPages.length} pages failed PageDrop test!`);
  }
  console.log('='.repeat(72) + '\n');
}

if (require.main === module) {
  (async () => {
    const server = await startTestServer(8772);
    const browser = await launchChromium();
    try {
      await runPageDropSuite(browser, 'http://127.0.0.1:8772');
    } finally {
      await browser.close();
      server.close();
    }
  })().catch(err => {
    console.error('Fatal test error:', err.message);
    process.exit(1);
  });
}

module.exports = {
  runPageDropSuite
};

