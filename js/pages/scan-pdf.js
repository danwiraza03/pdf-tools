/**
 * PDF Tools — Scan to PDF Page Controller
 * 100% Client-Side, Zero Server Transfer, Zero Cloud.
 */

(function () {
  'use strict';

  const ScanEngine = window.PDFTools.ScanEngine;
  const i18n = window.PDFTools.i18n;
  const Toast = window.PDFTools.Toast;
  const Progress = window.PDFTools.Progress;

  // State
  let scanPages = []; // Array of { id, originalImage, corners, canvas, rotation, filter }
  let activeCropPageIndex = -1;
  let activeStream = null;
  let activeFilter = 'original'; // 'original', 'grayscale', 'bw'
  let activePageSize = 'a4'; // 'a4', 'letter', 'fit'

  // DOM Elements
  const dropzone = document.getElementById('dropzone');
  const fileInput = document.getElementById('fileInput');
  const cameraInput = document.getElementById('cameraInput');
  const startCameraBtn = document.getElementById('startCameraBtn');
  const cameraModal = document.getElementById('cameraModal');
  const cameraVideo = document.getElementById('cameraVideo');
  const capturePhotoBtn = document.getElementById('capturePhotoBtn');
  const stopCameraBtn = document.getElementById('stopCameraBtn');
  const switchCameraBtn = document.getElementById('switchCameraBtn');

  const workspaceState = document.getElementById('workspaceState');
  const pagesGrid = document.getElementById('pagesGrid');
  const addMoreBtn = document.getElementById('addMoreBtn');

  // Crop / Rectify Modal Elements
  const cropModal = document.getElementById('cropModal');
  const cropCanvas = document.getElementById('cropCanvas');
  const applyCropBtn = document.getElementById('applyCropBtn');
  const cancelCropBtn = document.getElementById('cancelCropBtn');
  const resetCropBtn = document.getElementById('resetCropBtn');
  const filterBwBtn = document.getElementById('filterBwBtn');
  const filterGrayBtn = document.getElementById('filterGrayBtn');
  const filterOrigBtn = document.getElementById('filterOrigBtn');

  // Action Bar & Result
  const actionBar = document.getElementById('actionBar');
  const convertBtn = document.getElementById('convertBtn');
  const pageSizeSelect = document.getElementById('pageSizeSelect');
  const globalFilterSelect = document.getElementById('globalFilterSelect');
  const resultState = document.getElementById('resultState');
  const downloadPdfBtn = document.getElementById('downloadPdfBtn');
  const openStudioBtn = document.getElementById('openStudioBtn');
  const resetBtn = document.getElementById('resetBtn');

  let activeDragCorner = null; // 0: TL, 1: TR, 2: BR, 3: BL
  let cropCanvasScale = 1.0;
  let cropCanvasOffset = { x: 0, y: 0 };
  let currentCameraFacing = 'environment';
  let generatedPdfBytes = null;

  // Initialize
  function init() {
    bindEvents();
    bindTestHooks();
  }

  function bindEvents() {
    // File inputs & Dropzone
    if (fileInput) {
      fileInput.addEventListener('change', e => {
        if (e.target.files && e.target.files.length > 0) {
          handleFiles(Array.from(e.target.files));
          e.target.value = '';
        }
      });
    }

    if (cameraInput) {
      cameraInput.addEventListener('change', e => {
        if (e.target.files && e.target.files.length > 0) {
          handleFiles(Array.from(e.target.files), true);
          e.target.value = '';
        }
      });
    }

    const openCameraInputBtn = document.getElementById('openCameraInputBtn');
    if (openCameraInputBtn && cameraInput) {
      openCameraInputBtn.addEventListener('click', () => cameraInput.click());
    }

    if (dropzone) {
      dropzone.addEventListener('click', e => {
        if (e.target.closest('#startCameraBtn') || e.target.closest('#openCameraInputBtn')) return;
        if (fileInput) fileInput.click();
      });
    }

    if (addMoreBtn) {
      addMoreBtn.addEventListener('click', () => {
        if (fileInput) fileInput.click();
      });
    }

    // Live Camera Controls
    if (startCameraBtn) {
      startCameraBtn.addEventListener('click', e => {
        e.stopPropagation();
        startLiveCamera();
      });
    }

    if (stopCameraBtn) {
      stopCameraBtn.addEventListener('click', stopLiveCamera);
    }

    if (switchCameraBtn) {
      switchCameraBtn.addEventListener('click', () => {
        currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
        startLiveCamera();
      });
    }

    if (capturePhotoBtn) {
      capturePhotoBtn.addEventListener('click', captureLivePhoto);
    }

    // Clean up camera on navigation
    window.addEventListener('beforeunload', stopLiveCamera);
    window.addEventListener('pagehide', stopLiveCamera);

    // Crop Modal Controls
    if (applyCropBtn) {
      applyCropBtn.addEventListener('click', applyCurrentCrop);
    }
    if (cancelCropBtn) {
      cancelCropBtn.addEventListener('click', closeCropModal);
    }
    if (resetCropBtn) {
      resetCropBtn.addEventListener('click', resetCropCorners);
    }

    // Filter Buttons (Action Bar and Modal)
    document.querySelectorAll('.btn-filter-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const filter = btn.dataset.filter || 'original';
        handleFilterChange(filter);
      });
    });

    // Interactive pointer drag on crop canvas
    if (cropCanvas) {
      cropCanvas.addEventListener('pointerdown', handleCropPointerDown);
      cropCanvas.addEventListener('pointermove', handleCropPointerMove);
      cropCanvas.addEventListener('pointerup', handleCropPointerUp);
      cropCanvas.addEventListener('pointercancel', handleCropPointerUp);
    }

    // Page Size & Action Bar
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', e => {
        activePageSize = e.target.value;
      });
    }

    if (globalFilterSelect) {
      globalFilterSelect.addEventListener('change', e => {
        const f = e.target.value;
        scanPages.forEach(p => {
          p.filter = f;
          reprocessPageCanvas(p);
        });
        renderPagesGrid();
      });
    }

    if (convertBtn) {
      convertBtn.addEventListener('click', generatePdf);
    }

    // Result actions
    if (downloadPdfBtn) {
      downloadPdfBtn.addEventListener('click', triggerDownload);
    }

    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (!generatedPdfBytes) return;
        try {
          sessionStorage.setItem('pdf_studio_open_doc', JSON.stringify({
            name: 'scanned-document.pdf',
            data: Array.from(generatedPdfBytes)
          }));
          window.location.href = 'viewer.html';
        } catch (_) {
          window.location.href = 'viewer.html';
        }
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', resetAll);
    }

    // Sortable reordering if library present
    if (window.Sortable && pagesGrid) {
      window.Sortable.create(pagesGrid, {
        animation: 150,
        delay: 150,
        delayOnTouchOnly: true,
        handle: '.card-drag-handle, .scan-page-card',
        onEnd: evt => {
          const item = scanPages.splice(evt.oldIndex, 1)[0];
          scanPages.splice(evt.newIndex, 0, item);
          renderPagesGrid();
        }
      });
    }
  }

  function bindTestHooks() {
    // Expose programmatic test hooks
    window.setScanCorners = function (corners) {
      if (activeCropPageIndex >= 0 && scanPages[activeCropPageIndex]) {
        scanPages[activeCropPageIndex].corners = corners.map(c => ({ x: c.x, y: c.y }));
        drawCropCanvas();
      }
    };

    window.addEventListener('test-set-corners', e => {
      if (e.detail && Array.isArray(e.detail)) {
        window.setScanCorners(e.detail);
      }
    });

    window.getScanPageCanvas = function (idx = 0) {
      return scanPages[idx] ? scanPages[idx].canvas : null;
    };
  }

  // --- LIVE WEBCAM HANDLING ---
  async function startLiveCamera() {
    stopLiveCamera();
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Webcam API tidak didukung di browser ini.');
      }

      const constraints = {
        video: {
          facingMode: currentCameraFacing,
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      };

      activeStream = await navigator.mediaDevices.getUserMedia(constraints);
      if (cameraVideo) {
        cameraVideo.srcObject = activeStream;
        await cameraVideo.play().catch(() => {});
      }
      if (cameraModal) {
        cameraModal.classList.add('open');
      }
    } catch (err) {
      console.warn('Camera access error:', err);
      if (Toast) Toast.error(i18n ? i18n.t('scan.camera_error') : 'Gagal mengakses kamera.');
    }
  }

  function stopLiveCamera() {
    if (activeStream) {
      activeStream.getTracks().forEach(t => t.stop());
      activeStream = null;
    }
    if (cameraVideo) {
      cameraVideo.srcObject = null;
    }
    if (cameraModal) {
      cameraModal.classList.remove('open');
    }
  }

  function captureLivePhoto() {
    if (!cameraVideo || !activeStream) return;
    const vw = cameraVideo.videoWidth || 1280;
    const vh = cameraVideo.videoHeight || 720;

    const snapCanvas = document.createElement('canvas');
    snapCanvas.width = vw;
    snapCanvas.height = vh;
    const ctx = snapCanvas.getContext('2d');
    ctx.drawImage(cameraVideo, 0, 0, vw, vh);

    const img = new Image();
    img.onload = () => {
      addScanPage(img);
      stopLiveCamera();
      if (Toast) Toast.success(i18n ? i18n.t('scan.photo_captured') : 'Foto berhasil diambil!');
    };
    img.src = snapCanvas.toDataURL('image/jpeg', 0.95);
  }

  // --- FILE HANDLING ---
  function handleFiles(files, openCropImmediate = false) {
    const imgFiles = files.filter(f => f.type.startsWith('image/'));
    if (imgFiles.length === 0) {
      if (Toast) Toast.error('Pilih berkas gambar yang valid (JPG, PNG, WebP).');
      return;
    }

    let loaded = 0;
    imgFiles.forEach(file => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          const page = addScanPage(img);
          loaded++;
          if (loaded === imgFiles.length && openCropImmediate && page) {
            openCropModal(scanPages.length - 1);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function addScanPage(img) {
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;

    // Default corners with 5% inset
    const insetX = Math.round(w * 0.05);
    const insetY = Math.round(h * 0.05);
    const corners = [
      { x: insetX, y: insetY },
      { x: w - insetX, y: insetY },
      { x: w - insetX, y: h - insetY },
      { x: insetX, y: h - insetY }
    ];

    const page = {
      id: 'page_' + Math.random().toString(36).substr(2, 9),
      originalImage: img,
      corners: corners,
      rotation: 0,
      filter: activeFilter,
      canvas: null
    };

    reprocessPageCanvas(page);
    scanPages.push(page);
    updateWorkspaceVisibility();
    renderPagesGrid();
    return page;
  }

  function reprocessPageCanvas(page) {
    // Warp perspective
    let c = ScanEngine.warpPerspective(page.originalImage, page.corners);
    // Apply filter
    const ctx = c.getContext('2d');
    const imgData = ctx.getImageData(0, 0, c.width, c.height);
    ScanEngine.applyFilter(imgData, page.filter);
    ctx.putImageData(imgData, 0, 0);

    // Apply rotation if needed
    if (page.rotation !== 0) {
      const rot = (page.rotation % 360 + 360) % 360;
      if (rot !== 0) {
        const rotCanvas = document.createElement('canvas');
        if (rot === 90 || rot === 270) {
          rotCanvas.width = c.height;
          rotCanvas.height = c.width;
        } else {
          rotCanvas.width = c.width;
          rotCanvas.height = c.height;
        }
        const rctx = rotCanvas.getContext('2d');
        rctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
        rctx.rotate((rot * Math.PI) / 180);
        rctx.drawImage(c, -c.width / 2, -c.height / 2);
        c = rotCanvas;
      }
    }
    page.canvas = c;
  }

  function updateWorkspaceVisibility() {
    const hasPages = scanPages.length > 0;
    if (dropzone) dropzone.style.display = hasPages ? 'none' : 'block';
    if (workspaceState) workspaceState.style.display = hasPages ? 'block' : 'none';
    if (actionBar) actionBar.style.display = hasPages ? 'flex' : 'none';
    if (resultState) resultState.style.display = 'none';
  }

  function renderPagesGrid() {
    if (!pagesGrid) return;
    pagesGrid.innerHTML = '';

    scanPages.forEach((page, idx) => {
      const card = document.createElement('div');
      card.className = 'scan-page-card';
      card.setAttribute('data-page-index', idx);

      const thumbUrl = page.canvas.toDataURL('image/jpeg', 0.7);

      card.innerHTML = `
        <div class="card-thumb-wrapper">
          <img src="${thumbUrl}" alt="Page ${idx + 1}" class="card-thumb-img" />
          <span class="card-page-badge">${idx + 1}</span>
        </div>
        <div class="card-controls">
          <button type="button" class="btn-card-action btn-edit-crop" data-index="${idx}" title="Luruskan / Atur Sudut" aria-label="Atur Sudut Halaman ${idx + 1}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>
          </button>
          <button type="button" class="btn-card-action btn-rotate-page" data-index="${idx}" title="Putar 90°" aria-label="Putar Halaman ${idx + 1}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
          </button>
          <button type="button" class="btn-card-action btn-delete-page" data-index="${idx}" title="Hapus Halaman" aria-label="Hapus Halaman ${idx + 1}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      `;

      // Event bindings
      card.querySelector('.btn-edit-crop').addEventListener('click', e => {
        e.stopPropagation();
        openCropModal(idx);
      });
      card.querySelector('.btn-rotate-page').addEventListener('click', e => {
        e.stopPropagation();
        rotatePage(idx);
      });
      card.querySelector('.btn-delete-page').addEventListener('click', e => {
        e.stopPropagation();
        deletePage(idx);
      });
      card.addEventListener('click', () => {
        openCropModal(idx);
      });

      pagesGrid.appendChild(card);
    });
  }

  function rotatePage(idx) {
    if (!scanPages[idx]) return;
    scanPages[idx].rotation = (scanPages[idx].rotation + 90) % 360;
    reprocessPageCanvas(scanPages[idx]);
    renderPagesGrid();
  }

  function deletePage(idx) {
    if (!scanPages[idx]) return;
    scanPages.splice(idx, 1);
    if (scanPages.length === 0) {
      updateWorkspaceVisibility();
    } else {
      renderPagesGrid();
    }
  }

  // --- CROP / RECTIFY MODAL ---
  function openCropModal(idx) {
    if (!scanPages[idx]) return;
    activeCropPageIndex = idx;
    const page = scanPages[idx];

    // Update filter buttons active state
    updateFilterButtonActiveState(page.filter);

    if (cropModal) {
      cropModal.classList.add('open');
    }
    setupCropCanvas(page);
  }

  function closeCropModal() {
    if (cropModal) {
      cropModal.classList.remove('open');
    }
    activeCropPageIndex = -1;
    activeDragCorner = null;
  }

  function resetCropCorners() {
    if (activeCropPageIndex < 0 || !scanPages[activeCropPageIndex]) return;
    const page = scanPages[activeCropPageIndex];
    const img = page.originalImage;
    const w = img.naturalWidth || img.width;
    const h = img.naturalHeight || img.height;
    page.corners = [
      { x: Math.round(w * 0.05), y: Math.round(h * 0.05) },
      { x: Math.round(w * 0.95), y: Math.round(h * 0.05) },
      { x: Math.round(w * 0.95), y: Math.round(h * 0.95) },
      { x: Math.round(w * 0.05), y: Math.round(h * 0.95) }
    ];
    drawCropCanvas();
  }

  function handleFilterChange(filter) {
    updateFilterButtonActiveState(filter);

    if (activeCropPageIndex >= 0 && scanPages[activeCropPageIndex]) {
      // In modal: change filter for current page being edited
      scanPages[activeCropPageIndex].filter = filter;
    } else {
      // Outside modal: global filter applies to all pages
      scanPages.forEach(p => {
        p.filter = filter;
        reprocessPageCanvas(p);
      });
      renderPagesGrid();
    }
  }

  function updateFilterButtonActiveState(filter) {
    document.querySelectorAll('.btn-filter-pill').forEach(b => {
      if (b.dataset.filter === filter) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  function setupCropCanvas(page) {
    if (!cropCanvas) return;
    const img = page.originalImage;
    const imgW = img.naturalWidth || img.width;
    const imgH = img.naturalHeight || img.height;

    // Viewport box for canvas
    const container = cropCanvas.parentElement;
    const maxW = container ? container.clientWidth - 32 : 800;
    const maxH = container ? container.clientHeight - 32 : 600;

    const scale = Math.min(1.0, maxW / imgW, maxH / imgH);
    cropCanvasScale = scale;

    cropCanvas.width = imgW;
    cropCanvas.height = imgH;
    cropCanvas.style.width = Math.round(imgW * scale) + 'px';
    cropCanvas.style.height = Math.round(imgH * scale) + 'px';

    drawCropCanvas();
  }

  function drawCropCanvas() {
    if (!cropCanvas || activeCropPageIndex < 0) return;
    const page = scanPages[activeCropPageIndex];
    const ctx = cropCanvas.getContext('2d');
    const img = page.originalImage;

    ctx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    ctx.drawImage(img, 0, 0);

    const corners = page.corners; // [TL, TR, BR, BL]

    // 1. Semi-transparent dark overlay outside polygon
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);

    // Clear polygon area to show bright image inside
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // 2. Bright stroke border around quad
    ctx.save();
    ctx.strokeStyle = '#0284C7';
    ctx.lineWidth = Math.max(3, Math.round(3 / cropCanvasScale));
    ctx.beginPath();
    ctx.moveTo(corners[0].x, corners[0].y);
    ctx.lineTo(corners[1].x, corners[1].y);
    ctx.lineTo(corners[2].x, corners[2].y);
    ctx.lineTo(corners[3].x, corners[3].y);
    ctx.closePath();
    ctx.stroke();

    // 3. Draw 4 Corner Handles (minimum 44px hit-box)
    const handleRadius = Math.max(14, Math.round(14 / cropCanvasScale));
    corners.forEach((c, i) => {
      ctx.beginPath();
      ctx.arc(c.x, c.y, handleRadius, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#0284C7';
      ctx.lineWidth = Math.max(3, Math.round(3 / cropCanvasScale));
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(c.x, c.y, handleRadius * 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#0284C7';
      ctx.fill();
    });
    ctx.restore();
  }

  function handleCropPointerDown(e) {
    if (activeCropPageIndex < 0 || !scanPages[activeCropPageIndex]) return;
    const page = scanPages[activeCropPageIndex];
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;

    const clickX = (e.clientX - rect.left) * scaleX;
    const clickY = (e.clientY - rect.top) * scaleY;

    // Detect closest corner within 50px visual radius
    const threshold = 50 * scaleX;
    let closestIdx = -1;
    let minDist = Infinity;

    page.corners.forEach((c, idx) => {
      const d = Math.hypot(c.x - clickX, c.y - clickY);
      if (d < minDist && d < threshold) {
        minDist = d;
        closestIdx = idx;
      }
    });

    if (closestIdx >= 0) {
      activeDragCorner = closestIdx;
      cropCanvas.setPointerCapture(e.pointerId);
    }
  }

  function handleCropPointerMove(e) {
    if (activeDragCorner === null || activeCropPageIndex < 0) return;
    const page = scanPages[activeCropPageIndex];
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;

    let x = (e.clientX - rect.left) * scaleX;
    let y = (e.clientY - rect.top) * scaleY;

    // Clamp inside image bounds
    x = Math.max(0, Math.min(cropCanvas.width, x));
    y = Math.max(0, Math.min(cropCanvas.height, y));

    page.corners[activeDragCorner] = { x: Math.round(x), y: Math.round(y) };
    drawCropCanvas();
  }

  function handleCropPointerUp(e) {
    if (activeDragCorner !== null) {
      try { cropCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
      activeDragCorner = null;
    }
  }

  function applyCurrentCrop() {
    if (activeCropPageIndex < 0 || !scanPages[activeCropPageIndex]) return;
    const page = scanPages[activeCropPageIndex];
    reprocessPageCanvas(page);
    closeCropModal();
    renderPagesGrid();
    if (Toast) Toast.success('Sudut dokumen berhasil disesuaikan!');
  }

  function triggerDownload() {
    if (!generatedPdfBytes) return;
    const downloadName = 'scanned-document.pdf';
    if (window.PDFTools && window.PDFTools.Download && typeof window.PDFTools.Download.save === 'function') {
      window.PDFTools.Download.save(generatedPdfBytes, downloadName);
    } else if (typeof window.saveAs === 'function') {
      const blob = new Blob([generatedPdfBytes], { type: 'application/pdf' });
      window.saveAs(blob, downloadName);
    } else {
      const blob = new Blob([generatedPdfBytes], { type: 'application/pdf' });
      const u = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = u;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(u), 5000);
    }
  }

  // --- PDF ASSEMBLY ---
  async function generatePdf() {
    if (scanPages.length === 0) {
      if (Toast && typeof Toast.error === 'function') Toast.error('Belum ada halaman yang dipindai.');
      return;
    }

    try {
      const bytes = await ScanEngine.createPdfFromScanPages(scanPages, {
        pageSize: activePageSize
      });
      generatedPdfBytes = bytes;

      // Show Result View
      if (workspaceState) workspaceState.style.display = 'none';
      if (actionBar) actionBar.style.display = 'none';
      if (resultState) resultState.style.display = 'block';

      // Auto-trigger download
      triggerDownload();
      if (Toast && typeof Toast.success === 'function') Toast.success('PDF berhasil dibuat!');
    } catch (err) {
      console.error('PDF generation error:', err);
      if (Toast && typeof Toast.error === 'function') Toast.error('Gagal membuat PDF: ' + err.message);
    }
  }

  function resetAll() {
    scanPages = [];
    generatedPdfBytes = null;
    activeCropPageIndex = -1;
    stopLiveCamera();
    updateWorkspaceVisibility();
    if (dropzone) dropzone.style.display = 'block';
    if (resultState) resultState.style.display = 'none';
  }

  // Start on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

