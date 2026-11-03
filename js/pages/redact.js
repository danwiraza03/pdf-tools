/**
 * Standalone Redact PDF Page Controller (pages/redact.html)
 * Uses the exact same permanent anti-leak redaction engine as PDF Studio Pro:
 * - Full rasterization of redacted pages with black box painting
 * - Removal of original page content streams, images, and Form XObjects
 * - Object graph reference repointing (replaceRefEverywhere)
 * - Tagged-PDF Structure Tree removal (removeStructureTree)
 * - Unreachable orphan object purging (purgeUnreachableObjects)
 * - Metadata sanitization (sanitizeMetadata)
 *
 * 100% Offline, Zero Server Upload, Zero Emojis.
 */

(function () {
  'use strict';

  // Ensure PDF.js worker is properly linked
  if (typeof pdfjsLib !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
  }

  const { PDFDocument } = window.PDFLib || {};
  const RedactionEngine = window.PDFTools && window.PDFTools.RedactionEngine;

  // DOM Elements
  const uploadState = document.getElementById('uploadState');
  const workspaceState = document.getElementById('workspaceState');
  const resultState = document.getElementById('resultState');

  const fileInput = document.getElementById('fileInput');
  const dropzone = document.getElementById('dropzone');
  const fileNameLabel = document.getElementById('fileNameLabel');
  const fileSizeLabel = document.getElementById('fileSizeLabel');
  const changeFileBtn = document.getElementById('changeFileBtn');

  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const pageIndicator = document.getElementById('pageIndicator');

  const sheetWrapper = document.getElementById('redactSheetWrapper');
  const canvas = document.getElementById('redactCanvas');
  const overlay = document.getElementById('redactOverlay');

  const marksList = document.getElementById('marksList');
  const markCountBadge = document.getElementById('markCountBadge');
  const noMarksNotice = document.getElementById('noMarksNotice');
  const clearMarksBtn = document.getElementById('clearMarksBtn');
  const applyRedactBtn = document.getElementById('applyRedactBtn');

  const downloadRedactedBtn = document.getElementById('downloadRedactedBtn');
  const redactAnotherBtn = document.getElementById('redactAnotherBtn');
  const openInStudioBtn = document.getElementById('openInStudioBtn');

  const statOrigSize = document.getElementById('statOrigSize');
  const statNewSize = document.getElementById('statNewSize');
  const statRedactedPages = document.getElementById('statRedactedPages');

  // Application State
  let currentFile = null;
  let rawPdfBytes = null;
  let pdfjsDoc = null;
  let totalPages = 0;
  let currentPage = 1;
  let currentScale = 1.0;
  let currentViewport = null;
  let marks = []; // Array of { id, pageNumber, pdfX, pdfY, width, height, isPdfCoord: true }
  let redactedPdfBytes = null;

  // Pointer Drag-to-Mark State
  let isPointerDown = false;
  let startX = 0;
  let startY = 0;
  let selectionBoxEl = null;

  function t(key, fallback) {
    if (window.PDFTools && window.PDFTools.i18n && typeof window.PDFTools.i18n.t === 'function') {
      const val = window.PDFTools.i18n.t(key);
      if (val && val !== key) return val;
    }
    return fallback || key;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Reset the entire tool to initial upload state
   */
  function resetTool() {
    currentFile = null;
    rawPdfBytes = null;
    if (pdfjsDoc) {
      try { pdfjsDoc.destroy(); } catch (e) {}
      pdfjsDoc = null;
    }
    totalPages = 0;
    currentPage = 1;
    marks = [];
    redactedPdfBytes = null;
    fileInput.value = '';

    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 0;
      canvas.height = 0;
    }
    if (overlay) overlay.innerHTML = '';

    renderMarksList();

    uploadState.style.display = 'block';
    workspaceState.style.display = 'none';
    workspaceState.classList.add('hidden');
    resultState.style.display = 'none';
    resultState.classList.add('hidden');
  }

  /**
   * Load and parse selected PDF file
   */
  async function loadFile(file) {
    if (!file || file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(t('toast.invalid_pdf', 'Please select a valid PDF file.'));
      }
      return;
    }

    try {
      currentFile = file;
      const arrayBuffer = await file.arrayBuffer();
      rawPdfBytes = new Uint8Array(arrayBuffer);

      // Attempt decrypted load if StreamEngine exists, or direct PDF.js load
      let loadingTask;
      if (window.PDFTools && window.PDFTools.StreamEngine && typeof window.PDFTools.StreamEngine.loadPdfDecrypted === 'function') {
        const decrypted = await window.PDFTools.StreamEngine.loadPdfDecrypted(rawPdfBytes);
        rawPdfBytes = decrypted.bytes;
        loadingTask = pdfjsLib.getDocument({ data: rawPdfBytes.slice(0) });
      } else {
        loadingTask = pdfjsLib.getDocument({ data: rawPdfBytes.slice(0) });
      }

      pdfjsDoc = await loadingTask.promise;
      totalPages = pdfjsDoc.numPages;
      currentPage = 1;
      marks = [];

      // Update UI Header
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = `${formatBytes(file.size)} • ${totalPages} ${t('common.pages', 'Pages')}`;

      // Switch view to workspace
      uploadState.style.display = 'none';
      resultState.style.display = 'none';
      resultState.classList.add('hidden');
      workspaceState.style.display = 'block';
      workspaceState.classList.remove('hidden');

      await renderCurrentPage();
      renderMarksList();

      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info(t('redact.loaded_toast', 'Document loaded. Drag over confidential text to redact.'));
      }
    } catch (err) {
      console.error('Failed to load PDF for redaction:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(t('toast.load_failed', 'Failed to read PDF document: ') + err.message);
      }
    }
  }

  /**
   * Render the current page on the HTML5 canvas and position overlay
   */
  async function renderCurrentPage() {
    if (!pdfjsDoc) return;

    try {
      const page = await pdfjsDoc.getPage(currentPage);

      // Compute display scale to fit comfortable desktop/mobile viewport
      const containerWidth = sheetWrapper.parentElement ? sheetWrapper.parentElement.clientWidth - 32 : 800;
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Target around 700px width on desktop, or full width on mobile
      const targetWidth = Math.min(containerWidth, 750);
      currentScale = Math.max(0.4, Math.min(2.0, targetWidth / unscaledViewport.width));
      currentViewport = page.getViewport({ scale: currentScale });

      canvas.width = Math.round(currentViewport.width);
      canvas.height = Math.round(currentViewport.height);
      sheetWrapper.style.width = `${canvas.width}px`;
      sheetWrapper.style.height = `${canvas.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: currentViewport }).promise;

      // Update Pagination Bar
      const pageOfTemplate = t('redact.page_of', 'Page {current} of {total}');
      pageIndicator.textContent = pageOfTemplate.replace('{current}', currentPage).replace('{total}', totalPages);
      prevPageBtn.disabled = currentPage <= 1;
      nextPageBtn.disabled = currentPage >= totalPages;

      drawOverlayMarks();
    } catch (err) {
      console.error('Error rendering page:', err);
    }
  }

  /**
   * Draw existing redaction marks for the current page onto the interactive overlay
   */
  function drawOverlayMarks() {
    overlay.innerHTML = '';
    if (!currentViewport) return;

    const pageMarks = marks.filter(m => m.pageNumber === currentPage);

    pageMarks.forEach(mark => {
      const rect = currentViewport.convertToViewportRectangle([
        mark.pdfX,
        mark.pdfY,
        mark.pdfX + mark.width,
        mark.pdfY + mark.height
      ]);

      const boxX = Math.floor(Math.min(rect[0], rect[2]));
      const boxY = Math.floor(Math.min(rect[1], rect[3]));
      const boxW = Math.ceil(Math.abs(rect[2] - rect[0]));
      const boxH = Math.ceil(Math.abs(rect[3] - rect[1]));

      const markBox = document.createElement('div');
      markBox.className = 'redact-mark-box';
      markBox.style.left = `${boxX}px`;
      markBox.style.top = `${boxY}px`;
      markBox.style.width = `${boxW}px`;
      markBox.style.height = `${boxH}px`;
      markBox.title = `Redaction mark on Page ${mark.pageNumber}`;

      overlay.appendChild(markBox);
    });
  }

  /**
   * Update the sidebar list of marks and enable/disable apply button
   */
  function renderMarksList() {
    markCountBadge.textContent = String(marks.length);

    if (marks.length === 0) {
      noMarksNotice.style.display = 'block';
      marksList.innerHTML = '';
      clearMarksBtn.style.display = 'none';
      applyRedactBtn.disabled = true;
      return;
    }

    noMarksNotice.style.display = 'none';
    clearMarksBtn.style.display = 'block';
    applyRedactBtn.disabled = false;
    marksList.innerHTML = '';

    marks.forEach((mark, index) => {
      const li = document.createElement('li');
      li.className = 'redact-mark-item';

      const infoSpan = document.createElement('span');
      infoSpan.style.overflow = 'hidden';
      infoSpan.style.textOverflow = 'ellipsis';
      infoSpan.style.whiteSpace = 'nowrap';
      infoSpan.textContent = `Page ${mark.pageNumber}: [${Math.round(mark.pdfX)}, ${Math.round(mark.pdfY)}, ${Math.round(mark.width)}×${Math.round(mark.height)}]`;

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn-delete-mark';
      delBtn.setAttribute('aria-label', `Delete mark ${index + 1} on page ${mark.pageNumber}`);
      delBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>';

      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeMark(mark.id);
      });

      li.appendChild(infoSpan);
      li.appendChild(delBtn);
      marksList.appendChild(li);
    });
  }

  function removeMark(id) {
    marks = marks.filter(m => m.id !== id);
    drawOverlayMarks();
    renderMarksList();
  }

  // --- Pointer Drag-to-Mark Event Handlers (Mouse and Touch) ---

  overlay.addEventListener('pointerdown', (e) => {
    if (!currentViewport) return;
    if (e.button !== undefined && e.button !== 0) return; // Only primary button

    isPointerDown = true;
    try { overlay.setPointerCapture(e.pointerId); } catch (err) {}

    const rect = overlay.getBoundingClientRect();
    startX = e.clientX - rect.left;
    startY = e.clientY - rect.top;

    selectionBoxEl = document.createElement('div');
    selectionBoxEl.className = 'redact-selection-box';
    selectionBoxEl.style.left = `${startX}px`;
    selectionBoxEl.style.top = `${startY}px`;
    selectionBoxEl.style.width = '0px';
    selectionBoxEl.style.height = '0px';
    overlay.appendChild(selectionBoxEl);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!isPointerDown || !selectionBoxEl) return;

    const rect = overlay.getBoundingClientRect();
    const curX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const curY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

    const left = Math.min(startX, curX);
    const top = Math.min(startY, curY);
    const width = Math.abs(curX - startX);
    const height = Math.abs(curY - startY);

    selectionBoxEl.style.left = `${left}px`;
    selectionBoxEl.style.top = `${top}px`;
    selectionBoxEl.style.width = `${width}px`;
    selectionBoxEl.style.height = `${height}px`;
  });

  function finishPointerDrag(e) {
    if (!isPointerDown) return;
    isPointerDown = false;

    if (selectionBoxEl) {
      const rect = overlay.getBoundingClientRect();
      const endX = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
      const endY = Math.max(0, Math.min(rect.height, e.clientY - rect.top));

      const left = Math.min(startX, endX);
      const top = Math.min(startY, endY);
      const width = Math.abs(endX - startX);
      const height = Math.abs(endY - startY);

      selectionBoxEl.remove();
      selectionBoxEl = null;

      // Filter out accidental clicks / taps (< 6px)
      if (width >= 6 && height >= 6 && currentViewport) {
        const pt1 = currentViewport.convertToPdfPoint(left, top);
        const pt2 = currentViewport.convertToPdfPoint(left + width, top + height);

        const pdfX = Math.min(pt1[0], pt2[0]);
        const pdfY = Math.min(pt1[1], pt2[1]);
        const pdfW = Math.abs(pt2[0] - pt1[0]);
        const pdfH = Math.abs(pt2[1] - pt1[1]);

        const mark = {
          id: `redact_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          pageNumber: currentPage,
          pdfX: pdfX,
          pdfY: pdfY,
          width: pdfW,
          height: pdfH,
          isPdfCoord: true
        };

        marks.push(mark);
        drawOverlayMarks();
        renderMarksList();
      }
    }
  }

  overlay.addEventListener('pointerup', finishPointerDrag);
  overlay.addEventListener('pointercancel', finishPointerDrag);

  // --- Pagination Actions ---

  prevPageBtn.addEventListener('click', async () => {
    if (currentPage > 1) {
      currentPage--;
      await renderCurrentPage();
    }
  });

  nextPageBtn.addEventListener('click', async () => {
    if (currentPage < totalPages) {
      currentPage++;
      await renderCurrentPage();
    }
  });

  clearMarksBtn.addEventListener('click', () => {
    marks = [];
    drawOverlayMarks();
    renderMarksList();
  });

  // --- File Dropzone & Change Protection ---

  function handleFileSelected(file) {
    if (marks.length > 0 && window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.confirm) {
      const confirmMsg = t(
        'redact.confirm_replace',
        'You have unsaved redaction marks. Are you sure you want to open a new file?'
      );
      window.PDFTools.Modal.confirm(confirmMsg).then(proceed => {
        if (proceed) {
          resetTool();
          loadFile(file);
        }
      });
    } else {
      resetTool();
      loadFile(file);
    }
  }

  fileInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelected(e.target.files[0]);
    }
  });

  if (dropzone) {
    dropzone.addEventListener('click', () => fileInput.click());
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('drag-over');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('drag-over'));
    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');
      if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        handleFileSelected(e.dataTransfer.files[0]);
      }
    });
  }

  changeFileBtn.addEventListener('click', () => fileInput.click());

  // Page-wide drop handler (Single-file tool behavior)
  if (window.PDFTools && window.PDFTools.PageDrop && typeof window.PDFTools.PageDrop.attach === 'function') {
    window.PDFTools.PageDrop.attach({
      onFiles: (files) => {
        if (files && files.length > 0) {
          handleFileSelected(files[0]);
        }
      },
      hasUnsavedWork: () => marks.length > 0
    });
  }

  // --- Apply Redactions (Engine Execution) ---

  applyRedactBtn.addEventListener('click', async () => {
    if (marks.length === 0 || !rawPdfBytes) return;

    applyRedactBtn.disabled = true;
    const originalText = applyRedactBtn.innerHTML;
    applyRedactBtn.innerHTML = `
      <svg class="spin-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="animation: spin 1s linear infinite;"><line x1="12" y1="2" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="22"/><line x1="4.93" y1="4.93" x2="7.76" y2="7.76"/><line x1="16.24" y1="16.24" x2="19.07" y2="19.07"/><line x1="2" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="22" y2="12"/><line x1="4.93" y1="19.07" x2="7.76" y2="16.24"/><line x1="16.24" y1="7.76" x2="19.07" y2="4.93"/></svg>
      <span>${t('redact.applying', 'Applying Permanent Redactions...')}</span>
    `;

    try {
      // Build annotations map keyed by 1-based page number
      const annotationsMap = {};
      marks.forEach(m => {
        if (!annotationsMap[m.pageNumber]) {
          annotationsMap[m.pageNumber] = { redactions: [] };
        }
        annotationsMap[m.pageNumber].redactions.push(m);
      });

      const workingPdfDoc = await PDFDocument.load(rawPdfBytes, { ignoreEncryption: true });
      const workingPdfjsTask = pdfjsLib.getDocument({ data: rawPdfBytes.slice(0) });
      const workingPdfjsDoc = await workingPdfjsTask.promise;

      await RedactionEngine.applyPermanentRedactionsToDocument(
        workingPdfDoc,
        workingPdfjsDoc,
        annotationsMap,
        { dpi: 150 }
      );

      try { await workingPdfjsDoc.destroy(); } catch (e) {}

      RedactionEngine.sanitizeMetadata(workingPdfDoc);
      RedactionEngine.purgeUnreachableObjects(workingPdfDoc);

      redactedPdfBytes = await workingPdfDoc.save({ useObjectStreams: false });

      // Update Result Screen Stats
      statOrigSize.textContent = formatBytes(rawPdfBytes.length);
      statNewSize.textContent = formatBytes(redactedPdfBytes.length);
      statRedactedPages.textContent = String(Object.keys(annotationsMap).length);

      // Switch to Result View
      workspaceState.style.display = 'none';
      workspaceState.classList.add('hidden');
      resultState.style.display = 'block';
      resultState.classList.remove('hidden');

      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(t('redact.success_title', 'PDF Redacted Successfully!'));
      }
    } catch (err) {
      console.error('Permanent redaction failed:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(t('toast.redact_failed', 'Redaction failed: ') + err.message);
      }
      applyRedactBtn.disabled = false;
      applyRedactBtn.innerHTML = originalText;
    }
  });

  // --- Result Actions ---

  downloadRedactedBtn.addEventListener('click', () => {
    if (!redactedPdfBytes) return;

    const baseName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
    const downloadName = `${baseName}_redacted.pdf`;

    if (window.PDFTools && window.PDFTools.Download && typeof window.PDFTools.Download.saveAs === 'function') {
      window.PDFTools.Download.saveAs(redactedPdfBytes, downloadName);
    } else if (typeof window.saveAs === 'function') {
      const blob = new Blob([redactedPdfBytes], { type: 'application/pdf' });
      window.saveAs(blob, downloadName);
    } else {
      const blob = new Blob([redactedPdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        URL.revokeObjectURL(url);
        a.remove();
      }, 300);
    }
  });

  redactAnotherBtn.addEventListener('click', () => {
    resetTool();
  });

  openInStudioBtn.addEventListener('click', () => {
    if (redactedPdfBytes) {
      try {
        sessionStorage.setItem('pdftools_transfer_pdf', JSON.stringify({
          name: (currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document') + '_redacted.pdf',
          data: Array.from(redactedPdfBytes)
        }));
      } catch (e) {
        // Exceeds quota; normal navigation fallback
      }
    }
    window.location.href = 'viewer.html';
  });

  // Inject spin keyframe if not present
  if (!document.getElementById('spinAnimationRedact')) {
    const style = document.createElement('style');
    style.id = 'spinAnimationRedact';
    style.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
})();
