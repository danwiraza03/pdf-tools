/**
 * PDF Tools — Crop & Trim PDF Margins Standalone Page Controller
 * Extracted from pages/crop.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let selectedFile = null;
    let pdfJsDoc = null;
    let currentPage = 1;
    let totalPages = 1;
    let fitMode = 'page'; // 'page' | 'width'

    // Normalized crop box (0..1 coordinates)
    let cropRect = { x: 0.05, y: 0.05, width: 0.90, height: 0.90 };
    const pageCrops = {}; // pageNum -> cropRect

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const cropStageContainer = document.getElementById('cropStageContainer');
    const cropCanvas = document.getElementById('cropCanvas');
    const cropSheetWrapper = document.getElementById('cropSheetWrapper');
    const cropOverlay = document.getElementById('cropOverlay');
    const cropBox = document.getElementById('cropBox');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const btnFitPage = document.getElementById('btnFitPage');
    const btnFitWidth = document.getElementById('btnFitWidth');
    const btnAutoTrim = document.getElementById('btnAutoTrim');
    const btnResetCrop = document.getElementById('btnResetCrop');
    const cropScopeSelect = document.getElementById('cropScopeSelect');
    const cropDimensionsBadge = document.getElementById('cropDimensionsBadge');
    const btnApplyCrop = document.getElementById('btnApplyCrop');

    function updateCropBoxUI() {
      const w = cropCanvas.width;
      const h = cropCanvas.height;
      cropBox.style.left = `${cropRect.x * w}px`;
      cropBox.style.top = `${cropRect.y * h}px`;
      cropBox.style.width = `${cropRect.width * w}px`;
      cropBox.style.height = `${cropRect.height * h}px`;

      const pctW = Math.round(cropRect.width * 100);
      const pctH = Math.round(cropRect.height * 100);
      cropDimensionsBadge.textContent = `Crop Area: ${pctW}% × ${pctH}%`;
    }

    async function renderPage(pageNum) {
      if (!pdfJsDoc) return;
      pageIndicator.textContent = `Page ${pageNum} / ${totalPages}`;
      prevPageBtn.disabled = (pageNum <= 1);
      nextPageBtn.disabled = (pageNum >= totalPages);

      const page = await pdfJsDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Calculate fit scale so 100% of the full page fits on screen without cutoffs
      const stagePadding = 48;
      const availableW = Math.max(300, cropStageContainer.clientWidth - stagePadding);
      const availableH = Math.max(300, (window.innerHeight * 0.72) - stagePadding);

      let renderScale;
      if (fitMode === 'width') {
        renderScale = Math.min(2.0, availableW / unscaledViewport.width);
      } else {
        // Fit Page (Both Width AND Height fit completely on screen!)
        const scaleW = availableW / unscaledViewport.width;
        const scaleH = availableH / unscaledViewport.height;
        renderScale = Math.min(scaleW, scaleH, 1.5);
      }

      const viewport = page.getViewport({ scale: renderScale });

      cropCanvas.width = viewport.width;
      cropCanvas.height = viewport.height;
      cropSheetWrapper.style.width = `${viewport.width}px`;
      cropSheetWrapper.style.height = `${viewport.height}px`;

      const ctx = cropCanvas.getContext('2d');
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      if (pageCrops[pageNum]) {
        cropRect = { ...pageCrops[pageNum] };
      }
      updateCropBoxUI();
    }

    async function handleFile(file) {
      selectedFile = file;
      uploadState.style.display = 'none';
      workspaceState.style.display = 'block';

      if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
        PDFTools.FileUtils.initPdfJsWorker();
      }

      try {
        const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
        pdfJsDoc = await loadingTask.promise;
        totalPages = pdfJsDoc.numPages;
        currentPage = 1;

        await renderPage(currentPage);
        updateCropBoxUI();
        PDFTools.Toast.success('PDF loaded for visual cropping!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error('Could not load PDF document.');
      }
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        if (files && files.length > 0) handleFile(files[0]);
      }
    });

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: false,
        enabled: () => Boolean(selectedFile),
        hasUnsavedWork: () => {
          return cropRect.x !== 0.05 || cropRect.y !== 0.05 ||
            cropRect.width !== 0.90 || cropRect.height !== 0.90 ||
            Object.keys(pageCrops).length > 0;
        },
        onFiles: async (files) => {
          if (files && files[0]) handleFile(files[0]);
        }
      });
    }

    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) handleFile(file);
      });
    }

    // Drag & Resize Controller
    let isDragging = false;
    let activeHandle = null;
    let startX;
    let startY;
    let origRect;

    const onPointerDown = (clientX, clientY, target) => {
      let handle = (target.dataset && target.dataset.handle) ? target.dataset.handle : null;
      let actualTarget = target;
      if (!handle) {
        const hitEl = document.elementFromPoint(clientX, clientY);
        if (hitEl && hitEl.dataset && hitEl.dataset.handle) {
          handle = hitEl.dataset.handle;
          actualTarget = hitEl;
        } else {
          const handles = cropBox.querySelectorAll('.crop-handle');
          for (const h of handles) {
            const rect = h.getBoundingClientRect();
            const hx = rect.x + rect.width / 2;
            const hy = rect.y + rect.height / 2;
            if (Math.hypot(clientX - hx, clientY - hy) <= 24) {
              handle = h.dataset.handle;
              actualTarget = h;
              break;
            }
          }
        }
      }

      if (handle) {
        activeHandle = handle;
        actualTarget.classList.add('is-dragging');
      } else if (actualTarget === cropBox || cropBox.contains(actualTarget)) {
        isDragging = true;
        cropBox.classList.add('is-dragging');
      } else {
        return false;
      }
      cropOverlay.classList.add('is-dragging');
      startX = clientX;
      startY = clientY;
      origRect = { ...cropRect };
      return true;
    };

    cropOverlay.addEventListener('mousedown', (e) => {
      if (onPointerDown(e.clientX, e.clientY, e.target)) {
        e.preventDefault();
      }
    });

    cropOverlay.addEventListener('touchstart', (e) => {
      if (e.touches && e.touches.length > 0) {
        const started = onPointerDown(e.touches[0].clientX, e.touches[0].clientY, e.target);
        if (started && e.cancelable) e.preventDefault();
      }
    }, { passive: false });

    const onPointerMove = (clientX, clientY) => {
      if (!isDragging && !activeHandle) return;
      const dx = (clientX - startX) / cropCanvas.width;
      const dy = (clientY - startY) / cropCanvas.height;

      if (isDragging) {
        cropRect.x = Math.max(0, Math.min(1 - origRect.width, origRect.x + dx));
        cropRect.y = Math.max(0, Math.min(1 - origRect.height, origRect.y + dy));
      } else if (activeHandle) {
        if (activeHandle.includes('r')) {
          cropRect.width = Math.max(0.05, Math.min(1 - origRect.x, origRect.width + dx));
        }
        if (activeHandle.includes('b')) {
          cropRect.height = Math.max(0.05, Math.min(1 - origRect.y, origRect.height + dy));
        }
        if (activeHandle.includes('l')) {
          const newW = Math.max(0.05, origRect.width - dx);
          cropRect.x = Math.max(0, origRect.x + (origRect.width - newW));
          cropRect.width = newW;
        }
        if (activeHandle.includes('t')) {
          const newH = Math.max(0.05, origRect.height - dy);
          cropRect.y = Math.max(0, origRect.height - dy, origRect.y + (origRect.height - newH));
          cropRect.height = newH;
        }
      }
      updateCropBoxUI();
    };

    window.addEventListener('mousemove', (e) => onPointerMove(e.clientX, e.clientY));
    window.addEventListener('touchmove', (e) => {
      if (isDragging || activeHandle) {
        if (e.cancelable) e.preventDefault();
        if (e.touches && e.touches.length > 0) {
          onPointerMove(e.touches[0].clientX, e.touches[0].clientY);
        }
      }
    }, { passive: false });

    const onPointerUp = () => {
      if (isDragging || activeHandle) {
        pageCrops[currentPage] = { ...cropRect };
      }
      isDragging = false;
      activeHandle = null;
      cropOverlay.classList.remove('is-dragging');
      cropBox.classList.remove('is-dragging');
      document.querySelectorAll('.crop-handle.is-dragging').forEach(h => h.classList.remove('is-dragging'));
    };

    window.addEventListener('mouseup', onPointerUp);
    window.addEventListener('touchend', onPointerUp);
    window.addEventListener('touchcancel', onPointerUp);

    // Fit Mode Toggles
    btnFitPage.addEventListener('click', async () => {
      fitMode = 'page';
      btnFitPage.className = 'btn btn-secondary btn-sm';
      btnFitWidth.className = 'btn btn-ghost btn-sm';
      await renderPage(currentPage);
    });

    btnFitWidth.addEventListener('click', async () => {
      fitMode = 'width';
      btnFitWidth.className = 'btn btn-secondary btn-sm';
      btnFitPage.className = 'btn btn-ghost btn-sm';
      await renderPage(currentPage);
    });

    // Window resize re-fits canvas
    window.addEventListener('resize', () => {
      if (pdfJsDoc) renderPage(currentPage);
    });

    // Page Navigation
    prevPageBtn.addEventListener('click', async () => {
      if (currentPage > 1) {
        currentPage--;
        await renderPage(currentPage);
      }
    });

    nextPageBtn.addEventListener('click', async () => {
      if (currentPage < totalPages) {
        currentPage++;
        await renderPage(currentPage);
      }
    });

    // Auto-Trim & Reset
    btnAutoTrim.addEventListener('click', () => {
      const autoBox = PDFTools.Crop.autoDetectWhitespace(cropCanvas);
      cropRect = { ...autoBox };
      pageCrops[currentPage] = { ...cropRect };
      updateCropBoxUI();
      PDFTools.Toast.success('Auto-trimmed whitespace margins!');
    });

    btnResetCrop.addEventListener('click', () => {
      cropRect = { x: 0.05, y: 0.05, width: 0.90, height: 0.90 };
      pageCrops[currentPage] = { ...cropRect };
      updateCropBoxUI();
      PDFTools.Toast.info('Crop box reset to full page.');
    });

    // Apply & Download
    btnApplyCrop.addEventListener('click', async () => {
      if (!selectedFile) return;
      btnApplyCrop.disabled = true;
      const applyCropText = document.getElementById('applyCropText');
      if (applyCropText) applyCropText.textContent = 'Cropping...';

      try {
        const scope = cropScopeSelect.value;
        const options = {
          cropBox: { ...cropRect, normalized: true, fromTopLeft: true },
          pageCrops: scope === 'current' ? { [currentPage]: { ...cropRect, normalized: true, fromTopLeft: true } } : {}
        };

        const croppedBytes = await PDFTools.Crop.cropPdf(selectedFile, options);
        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        PDFTools.Download.save(croppedBytes, `${baseName}_cropped.pdf`);
        PDFTools.Toast.success('PDF cropped and downloaded successfully!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Failed to crop PDF.');
      } finally {
        btnApplyCrop.disabled = false;
        if (applyCropText) applyCropText.textContent = 'Crop & Download PDF';
      }
    });

    // Secondary Action: Open in PDF Studio
    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        openStudioBtn.disabled = true;

        try {
          const scope = cropScopeSelect.value;
          const options = {
            cropBox: { ...cropRect, normalized: true, fromTopLeft: true },
            pageCrops: scope === 'current' ? { [currentPage]: { ...cropRect, normalized: true, fromTopLeft: true } } : {}
          };

          const croppedBytes = await PDFTools.Crop.cropPdf(selectedFile, options);
          const baseName = selectedFile.name.replace(/\.pdf$/i, '');
          const blob = new Blob([croppedBytes], { type: 'application/pdf' });
          const file = new File([blob], `${baseName}_cropped.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        } catch (err) {
          console.error(err);
          PDFTools.Toast.error(err.message || 'Failed to crop PDF.');
          openStudioBtn.disabled = false;
        }
      });
    }
  });
})();
