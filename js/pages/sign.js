/**
 * PDF Tools — Sign Standalone Page Controller
 * Extracted from pages/sign.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    // === STATE ===
    let pdfFile = null;
    let pdfJsDoc = null;
    let pdfArrayBuffer = null;
    let totalPages = 1;
    let currentPage = 1;
    let activeTab = 'draw';
    let drawColor = '#1e293b';
    let typeColor = '#1e293b';
    let typeFont = "'Great Vibes', cursive";
    let penSize = 2.5;
    let signatureDataUrl = null;

    // Placed items: [{ id, page, xRatio, yRatio, wRatio, hRatio, dataUrl }]
    let placedItems = [];
    let lastSignedBlob = null;
    let lastSignedFileName = '';

    // === DOM ===
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const step1 = document.getElementById('step1');
    const step2 = document.getElementById('step2');
    const step3 = document.getElementById('step3');
    const step1Ind = document.getElementById('step1Indicator');
    const step2Ind = document.getElementById('step2Indicator');
    const step3Ind = document.getElementById('step3Indicator');
    const sigDrawCanvas = document.getElementById('sigDrawCanvas');
    const sigDrawArea = document.getElementById('sigDrawArea');
    const sigDrawHint = document.getElementById('sigDrawHint');
    const clearDrawBtn = document.getElementById('clearDrawBtn');
    const sigTypeInput = document.getElementById('sigTypeInput');
    const sigTypePreview = document.getElementById('sigTypePreview');
    const sigUploadZone = document.getElementById('sigUploadZone');
    const sigUploadInput = document.getElementById('sigUploadInput');
    const sigUploadPreview = document.getElementById('sigUploadPreview');
    const uploadPreviewArea = document.getElementById('uploadPreviewArea');
    const reuploadSigBtn = document.getElementById('reuploadSigBtn');
    const useSignatureBtn = document.getElementById('useSignatureBtn');
    const saveSigCheck = document.getElementById('saveSigCheck');
    const signPdfCanvas = document.getElementById('signPdfCanvas');
    const signPageWrapper = document.getElementById('signPageWrapper');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageInfo = document.getElementById('pageInfo');
    const downloadSignedBtn = document.getElementById('downloadSignedBtn');
    const quickAddSigBtn = document.getElementById('quickAddSigBtn');
    const quickAddDateBtn = document.getElementById('quickAddDateBtn');
    const quickAddNameBtn = document.getElementById('quickAddNameBtn');
    const changeSigBtn = document.getElementById('changeSigBtn');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const savedSigsGrid = document.getElementById('savedSigsGrid');
    const resultArea = document.getElementById('resultArea');
    const resultFileName = document.getElementById('resultFileName');
    const resultFileSize = document.getElementById('resultFileSize');
    const downloadAgainBtn = document.getElementById('downloadAgainBtn');
    const resultOpenStudioBtn = document.getElementById('resultOpenStudioBtn');
    const resetBtn = document.getElementById('resetBtn');

    // === STEP NAVIGATION ===
    function setStep(step) {
      step1.style.display = step === 1 ? 'block' : 'none';
      step2.style.display = step === 2 ? 'block' : 'none';
      step3.style.display = step === 3 ? 'block' : 'none';

      [step1Ind, step2Ind, step3Ind].forEach((el, i) => {
        el.classList.remove('active', 'done');
        if (i + 1 < step) el.classList.add('done');
        if (i + 1 === step) el.classList.add('active');
      });

      if (step === 2) {
        // Crucial fix: initialize draw canvas when container is actually visible in DOM!
        setTimeout(resizeDrawCanvas, 50);
      }
      if (window.PDFTools && PDFTools.i18n && PDFTools.i18n.updatePage) {
        PDFTools.i18n.updatePage();
      }
    }

    // === STEP 1: FILE UPLOAD ===
    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
    });
    dropzone.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    (async function checkPending() {
      if (window.PDFTools && PDFTools.FileUtils && PDFTools.FileUtils.getPendingFile) {
        const pending = await PDFTools.FileUtils.getPendingFile();
        if (pending) handleFile(pending);
      }
    })();

    async function handleFile(file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        if (PDFTools.Toast) PDFTools.Toast.error('Please select a PDF file');
        return;
      }
      try {
        const decryptedDoc = await PDFTools.FileUtils.loadPdfDecrypted(file);
        const decryptedBytes = await decryptedDoc.save();
        pdfFile = file;
        pdfArrayBuffer = decryptedBytes.buffer.slice(decryptedBytes.byteOffset, decryptedBytes.byteOffset + decryptedBytes.byteLength);

        if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
          PDFTools.FileUtils.initPdfJsWorker();
        }

        const loadingTask = pdfjsLib.getDocument({ data: decryptedBytes });
        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;
        currentPage = 1;

        if (PDFTools.Toast) PDFTools.Toast.success(`Loaded: ${file.name} (${totalPages} pages)`);
        setStep(2);
      } catch (err) {
        if (err.code !== 'PASSWORD_CANCELLED') {
          if (PDFTools.Toast) PDFTools.Toast.error(err.message || 'Could not load PDF');
        }
      }
    }

    // === STEP 2: SIGNATURE CREATION ===
    document.querySelectorAll('.sig-tab, .sig-tab-btn').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.sig-tab, .sig-tab-btn').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        activeTab = tab.dataset.tab;
        document.querySelectorAll('.sig-tab-content').forEach(c => c.style.display = 'none');
        const map = { draw: 'tabDraw', type: 'tabType', upload: 'tabUpload', saved: 'tabSaved' };
        document.getElementById(map[activeTab]).style.display = 'block';

        if (activeTab === 'draw') {
          setTimeout(resizeDrawCanvas, 30);
        } else if (activeTab === 'saved') {
          renderSavedSignatures();
        }
        validateSignature();
      });
    });

    // --- DRAW ENGINE (POINTER EVENTS) ---
    const drawCtx = sigDrawCanvas.getContext('2d');
    let isDrawing = false;
    let lastX = 0, lastY = 0;
    let hasDrawContent = false;

    function resizeDrawCanvas() {
      const rect = sigDrawArea.getBoundingClientRect();
      const newWidth = Math.round(rect.width || sigDrawArea.parentElement.clientWidth || 550);
      if (newWidth <= 0) return;

      // Preserve drawing during resize
      let tempCanvas = null;
      if (hasDrawContent && sigDrawCanvas.width > 0 && sigDrawCanvas.height > 0) {
        tempCanvas = document.createElement('canvas');
        tempCanvas.width = sigDrawCanvas.width;
        tempCanvas.height = sigDrawCanvas.height;
        tempCanvas.getContext('2d').drawImage(sigDrawCanvas, 0, 0);
      }

      sigDrawCanvas.width = newWidth;
      sigDrawCanvas.height = 200;

      if (tempCanvas) {
        drawCtx.drawImage(tempCanvas, 0, 0);
      }
    }

    window.addEventListener('resize', () => {
      if (step2.style.display !== 'none' && activeTab === 'draw') {
        resizeDrawCanvas();
      }
    });

    // Pointer events for reliable drawing on both desktop and touch
    sigDrawCanvas.addEventListener('pointerdown', e => {
      isDrawing = true;
      hasDrawContent = true;
      sigDrawArea.classList.add('has-content', 'drawing');
      const rect = sigDrawCanvas.getBoundingClientRect();
      lastX = e.clientX - rect.left;
      lastY = e.clientY - rect.top;
      sigDrawCanvas.setPointerCapture(e.pointerId);
      validateSignature();
    });

    sigDrawCanvas.addEventListener('pointermove', e => {
      if (!isDrawing) return;
      const rect = sigDrawCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      drawCtx.beginPath();
      drawCtx.moveTo(lastX, lastY);
      drawCtx.lineTo(x, y);
      drawCtx.strokeStyle = drawColor;
      drawCtx.lineWidth = penSize;
      drawCtx.lineCap = 'round';
      drawCtx.lineJoin = 'round';
      drawCtx.stroke();

      lastX = x;
      lastY = y;
    });

    sigDrawCanvas.addEventListener('pointerup', e => {
      isDrawing = false;
      sigDrawArea.classList.remove('drawing');
      try { sigDrawCanvas.releasePointerCapture(e.pointerId); } catch (err) {}
      validateSignature();
    });

    sigDrawCanvas.addEventListener('pointercancel', () => {
      isDrawing = false;
      sigDrawArea.classList.remove('drawing');
    });

    clearDrawBtn.addEventListener('click', () => {
      drawCtx.clearRect(0, 0, sigDrawCanvas.width, sigDrawCanvas.height);
      hasDrawContent = false;
      sigDrawArea.classList.remove('has-content');
      validateSignature();
    });

    // Color pickers
    document.getElementById('sigColorPicker').addEventListener('click', e => {
      const dot = e.target.closest('.sig-color-dot');
      if (!dot) return;
      document.querySelectorAll('#sigColorPicker .sig-color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      drawColor = dot.dataset.color;
    });

    document.getElementById('sigPenSize').addEventListener('input', e => {
      penSize = parseFloat(e.target.value);
    });

    // --- TYPE ENGINE ---
    sigTypeInput.addEventListener('input', () => {
      const val = sigTypeInput.value.trim();
      sigTypePreview.innerHTML = val
        ? `<span style="color: ${typeColor};">${escapeHtml(val)}</span>`
        : '<span style="color: #94a3b8;">Signature Preview</span>';
      validateSignature();
    });

    document.querySelectorAll('.sig-font-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.sig-font-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        typeFont = btn.dataset.font;
        sigTypePreview.style.fontFamily = typeFont;
      });
    });

    document.getElementById('sigTypeColorPicker').addEventListener('click', e => {
      const dot = e.target.closest('.sig-color-dot');
      if (!dot) return;
      document.querySelectorAll('#sigTypeColorPicker .sig-color-dot').forEach(d => d.classList.remove('active'));
      dot.classList.add('active');
      typeColor = dot.dataset.color;
      const val = sigTypeInput.value.trim();
      if (val) sigTypePreview.innerHTML = `<span style="color: ${typeColor};">${escapeHtml(val)}</span>`;
    });

    // --- UPLOAD ENGINE ---
    sigUploadZone.addEventListener('click', () => sigUploadInput.click());
    reuploadSigBtn.addEventListener('click', () => sigUploadInput.click());

    sigUploadInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) loadUploadedSig(e.target.files[0]);
    });

    function loadUploadedSig(file) {
      const reader = new FileReader();
      reader.onload = () => {
        removeWhiteBackground(reader.result).then(cleanedDataUrl => {
          sigUploadPreview.src = cleanedDataUrl;
          uploadPreviewArea.style.display = 'block';
          sigUploadZone.style.display = 'none';
          validateSignature();
        });
      };
      reader.readAsDataURL(file);
    }

    // --- SAVED SIGNATURES ---
    function getSavedSignatures() {
      try {
        return JSON.parse(localStorage.getItem('pdf_tools_saved_sigs') || '[]');
      } catch { return []; }
    }
    function saveSavedSignatures(sigs) {
      localStorage.setItem('pdf_tools_saved_sigs', JSON.stringify(sigs));
    }
    function renderSavedSignatures() {
      const sigs = getSavedSignatures();
      if (sigs.length === 0) {
        savedSigsGrid.innerHTML = '<p style="color: var(--text-muted); font-size: 0.85rem; grid-column: 1 / -1; text-align: center; padding: 24px 0;">No saved signatures yet. Draw or type a signature to save it here.</p>';
        return;
      }
      savedSigsGrid.innerHTML = '';
      sigs.forEach((sig, idx) => {
        const card = document.createElement('div');
        card.className = 'saved-sig-card';
        card.innerHTML = `
          <img src="${sig}" alt="Saved signature ${idx + 1}">
          <button class="saved-sig-delete" data-idx="${idx}" title="Delete"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        `;
        card.addEventListener('click', (e) => {
          const delBtn = e.target.closest('.saved-sig-delete');
          if (delBtn) {
            const list = getSavedSignatures();
            list.splice(parseInt(delBtn.dataset.idx), 1);
            saveSavedSignatures(list);
            renderSavedSignatures();
            return;
          }
          signatureDataUrl = sig;
          if (PDFTools.Toast) PDFTools.Toast.success('Saved signature selected!');
          goToStep3WithSignature();
        });
        savedSigsGrid.appendChild(card);
      });
    }

    // --- VALIDATE ---
    function validateSignature() {
      let valid = false;
      if (activeTab === 'draw') valid = hasDrawContent;
      else if (activeTab === 'type') valid = sigTypeInput.value.trim().length > 0;
      else if (activeTab === 'upload') valid = !!sigUploadPreview.src && sigUploadPreview.src !== '';
      useSignatureBtn.disabled = !valid;
    }

    function captureCurrentSignature() {
      return new Promise((resolve) => {
        if (activeTab === 'draw') {
          const trimmed = trimCanvas(sigDrawCanvas);
          resolve(trimmed.toDataURL('image/png'));
        } else if (activeTab === 'type') {
          const text = sigTypeInput.value.trim();
          if (!text) { resolve(null); return; }
          const c = document.createElement('canvas');
          c.width = 600; c.height = 160;
          const ctx = c.getContext('2d');
          ctx.font = `56px ${typeFont}`;
          ctx.fillStyle = typeColor;
          ctx.textBaseline = 'middle';
          ctx.fillText(text, 20, 80);
          const trimmed = trimCanvas(c);
          resolve(trimmed.toDataURL('image/png'));
        } else if (activeTab === 'upload') {
          resolve(sigUploadPreview.src);
        } else {
          resolve(null);
        }
      });
    }

    function trimCanvas(canvas) {
      const ctx = canvas.getContext('2d');
      const w = canvas.width, h = canvas.height;
      if (w <= 0 || h <= 0) return canvas;
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;
      let top = h, left = w, right = 0, bottom = 0;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const a = data[(y * w + x) * 4 + 3];
          if (a > 10) {
            if (y < top) top = y;
            if (y > bottom) bottom = y;
            if (x < left) left = x;
            if (x > right) right = x;
          }
        }
      }
      if (right <= left || bottom <= top) return canvas;
      const pad = 12;
      const tl = Math.max(0, left - pad), tt = Math.max(0, top - pad);
      const tw = Math.min(w - tl, (right - left) + pad * 2);
      const th = Math.min(h - tt, (bottom - top) + pad * 2);
      const trimmed = document.createElement('canvas');
      trimmed.width = tw; trimmed.height = th;
      trimmed.getContext('2d').drawImage(canvas, tl, tt, tw, th, 0, 0, tw, th);
      return trimmed;
    }

    function removeWhiteBackground(dataUrl) {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => {
          const c = document.createElement('canvas');
          c.width = img.width; c.height = img.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, c.width, c.height);
          const data = imageData.data;
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i+1], b = data[i+2];
            const lum = 0.299 * r + 0.587 * g + 0.114 * b;
            if (lum > 220) data[i+3] = 0;
          }
          ctx.putImageData(imageData, 0, 0);
          const trimmed = trimCanvas(c);
          resolve(trimmed.toDataURL('image/png'));
        };
        img.src = dataUrl;
      });
    }

    useSignatureBtn.addEventListener('click', async () => {
      signatureDataUrl = await captureCurrentSignature();
      if (!signatureDataUrl) {
        if (PDFTools.Toast) PDFTools.Toast.error('Could not capture signature');
        return;
      }
      if (saveSigCheck.checked) {
        const sigs = getSavedSignatures();
        sigs.unshift(signatureDataUrl);
        if (sigs.length > 8) sigs.length = 8;
        saveSavedSignatures(sigs);
      }
      goToStep3WithSignature();
    });

    // === STEP 3: PLACE & DOWNLOAD ===
    async function goToStep3WithSignature() {
      setStep(3);
      await renderPdfPage(currentPage);

      // UX Perfection: Automatically spawn signature on active page if none placed yet!
      if (signatureDataUrl && placedItems.filter(s => s.page === currentPage).length === 0) {
        autoPlaceSignatureOnPage(signatureDataUrl);
      }
    }

    function autoPlaceSignatureOnPage(dataUrl, defaultWidth = 160, defaultHeight = 60) {
      const wrapperRect = signPageWrapper.getBoundingClientRect();
      const wrapW = wrapperRect.width || 600;
      const wrapH = wrapperRect.height || 800;

      // Place at bottom-center area typical for signatures
      const x = Math.round((wrapW - defaultWidth) / 2);
      const y = Math.round(wrapH * 0.72);

      const item = {
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        page: currentPage,
        xRatio: x / wrapW,
        yRatio: y / wrapH,
        wRatio: defaultWidth / wrapW,
        hRatio: defaultHeight / wrapH,
        dataUrl: dataUrl
      };

      placedItems.push(item);
      renderPlacedItems();
      if (PDFTools.Toast) PDFTools.Toast.info('Signature placed! Drag to position on your document.');
    }

    async function renderPdfPage(pageNum) {
      currentPage = pageNum;
      const page = await pdfJsDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale: 1.5 });

      signPdfCanvas.width = viewport.width;
      signPdfCanvas.height = viewport.height;
      const ctx = signPdfCanvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, viewport.width, viewport.height);
      await page.render({ canvasContext: ctx, viewport }).promise;

      const isId = (window.PDFTools && PDFTools.i18n && PDFTools.i18n.getLang() === 'id');
      pageInfo.textContent = isId ? `Halaman ${pageNum} dari ${totalPages}` : `Page ${pageNum} of ${totalPages}`;
      prevPageBtn.disabled = pageNum <= 1;
      nextPageBtn.disabled = pageNum >= totalPages;
      if (window.PDFTools && PDFTools.i18n && PDFTools.i18n.updatePage) {
        PDFTools.i18n.updatePage();
      }

      renderPlacedItems();
    }

    prevPageBtn.addEventListener('click', () => { if (currentPage > 1) renderPdfPage(currentPage - 1); });
    nextPageBtn.addEventListener('click', () => { if (currentPage < totalPages) renderPdfPage(currentPage + 1); });

    // Click on PDF canvas to place signature
    signPageWrapper.addEventListener('click', (e) => {
      if (!signatureDataUrl) return;
      if (e.target.closest('.sig-placed')) return;

      const rect = signPageWrapper.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      const defW = 160;
      const defH = 60;
      const x = Math.max(0, clickX - defW / 2);
      const y = Math.max(0, clickY - defH / 2);

      placedItems.push({
        id: 'item_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        page: currentPage,
        xRatio: x / rect.width,
        yRatio: y / rect.height,
        wRatio: defW / rect.width,
        hRatio: defH / rect.height,
        dataUrl: signatureDataUrl
      });

      renderPlacedItems();
    });

    function renderPlacedItems() {
      signPageWrapper.querySelectorAll('.sig-placed').forEach(el => el.remove());
      const wrapRect = signPageWrapper.getBoundingClientRect();
      const wrapW = wrapRect.width || 600;
      const wrapH = wrapRect.height || 800;

      placedItems.filter(it => it.page === currentPage).forEach(item => {
        const el = document.createElement('div');
        el.className = 'sig-placed';
        el.dataset.id = item.id;

        const leftPx = item.xRatio * wrapW;
        const topPx = item.yRatio * wrapH;
        const widthPx = item.wRatio * wrapW;
        const heightPx = item.hRatio * wrapH;

        el.style.left = `${leftPx}px`;
        el.style.top = `${topPx}px`;
        el.style.width = `${widthPx}px`;
        el.style.height = `${heightPx}px`;

        el.innerHTML = `
          <img src="${item.dataUrl}" alt="Signature">
          <button class="sig-delete-btn" title="Remove"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round" style="pointer-events:none;"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          <div class="sig-resize-handle" title="Drag corner to resize"></div>
        `;

        // Delete
        el.querySelector('.sig-delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          placedItems = placedItems.filter(it => it.id !== item.id);
          el.remove();
        });

        // Unified Pointer Drag Controller
        let isDragging = false;
        let startPointerX, startPointerY;
        let startLeftPx = leftPx, startTopPx = topPx;

        el.addEventListener('pointerdown', (e) => {
          if (e.target.classList.contains('sig-resize-handle') || e.target.classList.contains('sig-delete-btn')) return;
          isDragging = true;
          startPointerX = e.clientX;
          startPointerY = e.clientY;
          startLeftPx = parseFloat(el.style.left) || 0;
          startTopPx = parseFloat(el.style.top) || 0;
          el.classList.add('active');
          el.setPointerCapture(e.pointerId);
          e.stopPropagation();
        });

        el.addEventListener('pointermove', (e) => {
          if (!isDragging) return;
          const dx = e.clientX - startPointerX;
          const dy = e.clientY - startPointerY;

          const newL = Math.max(0, Math.min(wrapW - (parseFloat(el.style.width) || 40), startLeftPx + dx));
          const newT = Math.max(0, Math.min(wrapH - (parseFloat(el.style.height) || 20), startTopPx + dy));

          el.style.left = `${newL}px`;
          el.style.top = `${newT}px`;

          item.xRatio = newL / wrapW;
          item.yRatio = newT / wrapH;
        });

        const stopDrag = (e) => {
          if (!isDragging) return;
          isDragging = false;
          el.classList.remove('active');
          try { el.releasePointerCapture(e.pointerId); } catch (err) {}
        };

        el.addEventListener('pointerup', stopDrag);
        el.addEventListener('pointercancel', stopDrag);

        // Resize Controller
        const handle = el.querySelector('.sig-resize-handle');
        let isResizing = false;
        let rStartX, rStartY, rStartW, rStartH;

        handle.addEventListener('pointerdown', (e) => {
          e.stopPropagation();
          isResizing = true;
          rStartX = e.clientX;
          rStartY = e.clientY;
          rStartW = parseFloat(el.style.width) || widthPx;
          rStartH = parseFloat(el.style.height) || heightPx;
          handle.setPointerCapture(e.pointerId);
        });

        handle.addEventListener('pointermove', (e) => {
          if (!isResizing) return;
          const dx = e.clientX - rStartX;
          const dy = e.clientY - rStartY;
          const delta = Math.max(dx, dy);

          const newW = Math.max(50, rStartW + delta);
          const newH = Math.max(25, rStartH + delta * (rStartH / rStartW));

          el.style.width = `${newW}px`;
          el.style.height = `${newH}px`;

          item.wRatio = newW / wrapW;
          item.hRatio = newH / wrapH;
        });

        const stopResize = (e) => {
          if (!isResizing) return;
          isResizing = false;
          try { handle.releasePointerCapture(e.pointerId); } catch (err) {}
        };

        handle.addEventListener('pointerup', stopResize);
        handle.addEventListener('pointercancel', stopResize);

        signPageWrapper.appendChild(el);
      });
    }

    // Quick Add Toolbar Buttons
    quickAddSigBtn.addEventListener('click', () => {
      if (signatureDataUrl) {
        autoPlaceSignatureOnPage(signatureDataUrl);
      } else {
        setStep(2);
      }
    });

    quickAddDateBtn.addEventListener('click', () => {
      const today = new Date().toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });
      const c = document.createElement('canvas');
      c.width = 300; c.height = 50;
      const ctx = c.getContext('2d');
      ctx.font = '20px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textBaseline = 'middle';
      ctx.fillText(today, 10, 25);
      const trimmed = trimCanvas(c);
      autoPlaceSignatureOnPage(trimmed.toDataURL('image/png'), 140, 35);
    });

    quickAddNameBtn.addEventListener('click', async () => {
      let name = 'Signer';
      if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.prompt) {
        const val = await window.PDFTools.Modal.prompt('Enter signer name:', 'Signer');
        if (!val || !val.trim()) return;
        name = val.trim();
      }
      const c = document.createElement('canvas');
      c.width = 400; c.height = 60;
      const ctx = c.getContext('2d');
      ctx.font = 'bold 22px sans-serif';
      ctx.fillStyle = '#1e293b';
      ctx.textBaseline = 'middle';
      ctx.fillText(name.trim(), 10, 30);
      const trimmed = trimCanvas(c);
      autoPlaceSignatureOnPage(trimmed.toDataURL('image/png'), 150, 38);
    });

    changeSigBtn.addEventListener('click', () => setStep(2));

    // Helper to update download button label without destroying SVG icon
    function setLabel(textOrKey) {
      const dlText = document.getElementById('downloadSignedText');
      if (dlText) {
        const translated = (window.PDFTools && PDFTools.i18n && PDFTools.i18n.t)
          ? PDFTools.i18n.t(textOrKey)
          : null;
        dlText.textContent = (translated && translated !== textOrKey) ? translated : (textOrKey.startsWith('sign.') ? (PDFTools.i18n ? PDFTools.i18n.t(textOrKey) : textOrKey) : textOrKey);
      }
    }

    // === DOWNLOAD SIGNED PDF (100% PRECISE RATIO BAKING) ===
    downloadSignedBtn.addEventListener('click', async () => {
      if (placedItems.length === 0) {
        const msg = (window.PDFTools && PDFTools.i18n) ? PDFTools.i18n.t('sign.place_required') : 'Please place at least one signature on the PDF';
        if (PDFTools.Toast) PDFTools.Toast.error(msg);
        return;
      }

      downloadSignedBtn.disabled = true;
      setLabel('sign.baking');

      try {
        const { PDFDocument } = PDFLib;
        const freshBytes = pdfArrayBuffer ? pdfArrayBuffer.slice(0) : (pdfFile ? await pdfFile.arrayBuffer() : null);
        const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(freshBytes || pdfFile);

        // Sanitize existing digital signatures into visual stamps before placing new signatures
        if (window.PDFTools && PDFTools.Compress && typeof PDFTools.Compress.removeDigitalSignatures === 'function') {
          try {
            await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
          } catch (sigErr) {
            console.warn('Digital signature sanitization notice:', sigErr);
          }
        }

        const pages = pdfDoc.getPages();

        const imageCache = new Map();

        for (const item of placedItems) {
          const pageIndex = item.page - 1;
          if (pageIndex < 0 || pageIndex >= pages.length) continue;
          const page = pages[pageIndex];
          const { width: pdfWidth, height: pdfHeight } = page.getSize();

          // Embed image (handles both PNG and JPG cleanly)
          let embeddedImg;
          if (imageCache.has(item.dataUrl)) {
            embeddedImg = imageCache.get(item.dataUrl);
          } else {
            const base64Data = item.dataUrl.split(',')[1];
            const bin = atob(base64Data);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

            if (item.dataUrl.includes('image/jpeg') || item.dataUrl.includes('image/jpg')) {
              embeddedImg = await pdfDoc.embedJpg(bytes);
            } else {
              embeddedImg = await pdfDoc.embedPng(bytes);
            }
            imageCache.set(item.dataUrl, embeddedImg);
          }

          // 100% Mathematically Precise Coordinate Transform using Ratios:
          // In PDF coordinate system, origin is bottom-left (Y increases upwards).
          const pdfItemW = item.wRatio * pdfWidth;
          const pdfItemH = item.hRatio * pdfHeight;
          const pdfItemX = item.xRatio * pdfWidth;
          const pdfItemY = pdfHeight - (item.yRatio * pdfHeight) - pdfItemH;

          page.drawImage(embeddedImg, {
            x: pdfItemX,
            y: pdfItemY,
            width: pdfItemW,
            height: pdfItemH
          });
        }

        const signedBytes = await pdfDoc.save();
        const blob = new Blob([signedBytes], { type: 'application/pdf' });
        const fileName = pdfFile.name.replace(/\.pdf$/i, '') + '_signed.pdf';

        saveAs(blob, fileName);

        lastSignedBlob = blob;
        lastSignedFileName = fileName;

        if (resultArea && resultFileName && resultFileSize) {
          resultFileName.textContent = fileName;
          resultFileSize.textContent = `(${PDFTools.FileUtils.formatSize(signedBytes.length)})`;
          resultArea.style.display = 'block';
          resultArea.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        const successMsg = (window.PDFTools && PDFTools.i18n)
          ? `${PDFTools.i18n.t('sign.download_success')}: ${fileName}`
          : `Signed PDF downloaded: ${fileName}`;
        if (PDFTools.Toast) PDFTools.Toast.success(successMsg);

        if (PDFTools.RecentFiles) {
          PDFTools.RecentFiles.add({
            name: pdfFile.name,
            tool: 'E-Sign PDF',
            size: PDFTools.FileUtils.formatSize(signedBytes.length),
            icon: 'pen'
          });
        }
      } catch (err) {
        console.error('Sign export error:', err);
        const errMsg = (window.PDFTools && PDFTools.i18n)
          ? `${PDFTools.i18n.t('sign.download_error')}: ${err.message}`
          : `Failed to export signed PDF: ${err.message}`;
        if (PDFTools.Toast) PDFTools.Toast.error(errMsg);
      } finally {
        downloadSignedBtn.disabled = false;
        if (!downloadSignedBtn.querySelector('svg')) {
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('width', '18');
          svg.setAttribute('height', '18');
          svg.setAttribute('viewBox', '0 0 24 24');
          svg.setAttribute('fill', 'none');
          svg.setAttribute('stroke', 'currentColor');
          svg.setAttribute('stroke-width', '2.3');
          svg.setAttribute('stroke-linecap', 'round');
          svg.setAttribute('stroke-linejoin', 'round');
          svg.innerHTML = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>';
          downloadSignedBtn.insertBefore(svg, downloadSignedBtn.firstChild);
        }
        setLabel('sign.download_btn');
      }
    });

    // Reset to upload step cleanly while keeping reusable signatures intact
    function resetToUploadStep() {
      pdfFile = null;
      pdfJsDoc = null;
      pdfArrayBuffer = null;
      totalPages = 1;
      currentPage = 1;
      placedItems = [];
      lastSignedBlob = null;
      lastSignedFileName = '';

      if (fileInput) fileInput.value = '';
      if (signPdfCanvas) {
        const ctx = signPdfCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, signPdfCanvas.width, signPdfCanvas.height);
      }
      if (signPageWrapper) {
        signPageWrapper.querySelectorAll('.sig-placed').forEach(el => el.remove());
      }
      if (resultArea) resultArea.style.display = 'none';

      setStep(1);
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        resetToUploadStep();
      });
    }

    if (downloadAgainBtn) {
      downloadAgainBtn.addEventListener('click', () => {
        if (lastSignedBlob && lastSignedFileName) {
          saveAs(lastSignedBlob, lastSignedFileName);
        } else {
          downloadSignedBtn.click();
        }
      });
    }

    if (changeFileBtn) {
      changeFileBtn.addEventListener('click', () => {
        if (placedItems.length > 0) {
          if (PDFTools.Modal && PDFTools.Modal.confirm) {
            const msg = (PDFTools.i18n ? PDFTools.i18n.t('sign.confirm_change_file') : null) || 'Change PDF file? Any placed signatures will be discarded.';
            PDFTools.Modal.confirm(msg, {
              title: (PDFTools.i18n ? PDFTools.i18n.t('sign.change_file') : null) || 'Change File',
              confirmText: (PDFTools.i18n ? PDFTools.i18n.t('common.confirm') : null) || 'Change',
              cancelText: (PDFTools.i18n ? PDFTools.i18n.t('common.cancel') : null) || 'Cancel',
              isDanger: true
            }).then(confirmed => {
              if (confirmed) resetToUploadStep();
            });
          } else {
            resetToUploadStep();
          }
        } else {
          resetToUploadStep();
        }
      });
    }

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', async () => {
        if (!pdfFile && !lastSignedBlob) return;
        if (lastSignedBlob && lastSignedFileName) {
          const file = new File([lastSignedBlob], lastSignedFileName, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
          return;
        }
        if (placedItems.length === 0) {
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(pdfFile);
            window.location.href = 'viewer.html';
          }
          return;
        }
        openStudioBtn.disabled = true;
        try {
          const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(pdfArrayBuffer);

          if (window.PDFTools && PDFTools.Compress && typeof PDFTools.Compress.removeDigitalSignatures === 'function') {
            try {
              await PDFTools.Compress.removeDigitalSignatures(pdfDoc);
            } catch (sigErr) {
              console.warn('Digital signature sanitization notice:', sigErr);
            }
          }

          const pages = pdfDoc.getPages();

          for (const item of placedItems) {
            const page = pages[item.page - 1];
            if (!page) continue;
            const pw = page.getWidth();
            const ph = page.getHeight();
            let embeddedImg;
            if (item.dataUrl.startsWith('data:image/png')) {
              embeddedImg = await pdfDoc.embedPng(item.dataUrl);
            } else {
              embeddedImg = await pdfDoc.embedJpg(item.dataUrl);
            }
            const pdfItemW = item.wRatio * pw;
            const pdfItemH = item.hRatio * ph;
            const pdfItemX = item.xRatio * pw;
            const pdfItemY = ph - (item.yRatio * ph) - pdfItemH;

            page.drawImage(embeddedImg, {
              x: pdfItemX,
              y: pdfItemY,
              width: pdfItemW,
              height: pdfItemH
            });
          }

          const signedBytes = await pdfDoc.save();
          const blob = new Blob([signedBytes], { type: 'application/pdf' });
          const file = new File([blob], pdfFile.name.replace(/\.pdf$/i, '') + '_signed.pdf', { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        } catch (err) {
          console.error(err);
          if (PDFTools.Toast) PDFTools.Toast.error('Failed to open signed PDF in Studio: ' + err.message);
          openStudioBtn.disabled = false;
        }
      });
    }

    if (resultOpenStudioBtn) {
      resultOpenStudioBtn.addEventListener('click', () => {
        if (openStudioBtn) openStudioBtn.click();
      });
    }

    function escapeHtml(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Init
    setStep(1);
    validateSignature();
  });
})();
