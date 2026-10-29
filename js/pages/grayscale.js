/**
 * PDF Tools — PDF to Grayscale Standalone Page Controller
 * Extracted from pages/grayscale.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let selectedFile = null;
    let pdfJsDoc = null;
    let currentPage = 1;
    let totalPages = 1;

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileSizeLabel = document.getElementById('fileSizeLabel');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const splitStage = document.getElementById('splitStage');
    const canvasBefore = document.getElementById('canvasBefore');
    const canvasAfter = document.getElementById('canvasAfter');
    const layerOverlay = document.getElementById('layerOverlay');
    const splitLine = document.getElementById('splitLine');
    const badgeResultLabel = document.getElementById('badgeResultLabel');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageIndicator = document.getElementById('pageIndicator');
    const cardModeGray = document.getElementById('cardModeGray');
    const cardModeMono = document.getElementById('cardModeMono');
    const qualitySelect = document.getElementById('qualitySelect');
    const progressContainer = document.getElementById('progressContainer');
    const progressStatus = document.getElementById('progressStatus');
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const btnConvertGrayscale = document.getElementById('btnConvertGrayscale');

    function updateAfterCanvas() {
      const mode = document.querySelector('input[name="grayMode"]:checked').value;
      badgeResultLabel.textContent = mode === 'monochrome' ? 'Photocopy B&W' : 'Grayscale';

      const ctxBefore = canvasBefore.getContext('2d');
      const ctxAfter = canvasAfter.getContext('2d');

      const imgData = ctxBefore.getImageData(0, 0, canvasBefore.width, canvasBefore.height);
      const data = imgData.data;
      const len = data.length;

      if (mode === 'monochrome') {
        for (let i = 0; i < len; i += 4) {
          const luma = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
          const val = luma < 160 ? 0 : 255;
          data[i] = val; data[i + 1] = val; data[i + 2] = val;
        }
      } else {
        for (let i = 0; i < len; i += 4) {
          const luma = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
          data[i] = luma; data[i + 1] = luma; data[i + 2] = luma;
        }
      }
      ctxAfter.putImageData(imgData, 0, 0);
    }

    async function renderPreview(pageNum) {
      if (!pdfJsDoc) return;
      pageIndicator.textContent = `Page ${pageNum} / ${totalPages}`;
      prevPageBtn.disabled = (pageNum <= 1);
      nextPageBtn.disabled = (pageNum >= totalPages);

      const page = await pdfJsDoc.getPage(pageNum);
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      // Calculate preview width constrained to 440px
      const targetWidth = Math.min(440, window.innerWidth - 80);
      const scale = targetWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale: scale });

      canvasBefore.width = viewport.width;
      canvasBefore.height = viewport.height;
      canvasAfter.width = viewport.width;
      canvasAfter.height = viewport.height;

      splitStage.style.width = `${viewport.width}px`;
      splitStage.style.height = `${viewport.height}px`;

      const ctxBefore = canvasBefore.getContext('2d');
      await page.render({ canvasContext: ctxBefore, viewport: viewport }).promise;

      updateAfterCanvas();
    }

    async function handleFile(file) {
      selectedFile = file;
      fileNameLabel.textContent = file.name;

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

        fileSizeLabel.textContent = `${PDFTools.FileUtils.formatSize(file.size)} • ${totalPages} Pages`;
        await renderPreview(currentPage);
        PDFTools.Toast.success('PDF loaded for grayscale preview!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error('Could not load PDF document.');
      }
    }

    // Dropzone Setup
    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        if (files && files.length > 0) handleFile(files[0]);
      }
    });

    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) handleFile(file);
      });
    }

    changeFileBtn.addEventListener('click', () => {
      selectedFile = null;
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
    });

    // Mode toggles
    document.querySelectorAll('input[name="grayMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isGray = radio.value === 'grayscale';
        cardModeGray.classList.toggle('active', isGray);
        cardModeMono.classList.toggle('active', !isGray);
        updateAfterCanvas();
      });
    });

    // Split Slider Controller
    let isSliding = false;
    const handleSplitMove = (clientX) => {
      const rect = splitStage.getBoundingClientRect();
      if (!rect.width) return;
      const offsetX = Math.max(0, Math.min(rect.width, clientX - rect.left));
      const pct = (offsetX / rect.width) * 100;
      splitLine.style.left = `${pct}%`;
      layerOverlay.style.clipPath = `inset(0 0 0 ${pct}%)`;
    };

    splitStage.addEventListener('pointerdown', (e) => {
      isSliding = true;
      try {
        splitStage.setPointerCapture(e.pointerId);
      } catch (_) {}
      handleSplitMove(e.clientX);
    });
    splitStage.addEventListener('pointermove', (e) => {
      if (isSliding) handleSplitMove(e.clientX);
    });
    const endSplitSlide = (e) => {
      if (isSliding) {
        isSliding = false;
        try {
          if (e && e.pointerId && splitStage.hasPointerCapture(e.pointerId)) {
            splitStage.releasePointerCapture(e.pointerId);
          }
        } catch (_) {}
      }
    };
    splitStage.addEventListener('pointerup', endSplitSlide);
    splitStage.addEventListener('pointercancel', endSplitSlide);
    window.addEventListener('pointerup', endSplitSlide);

    // Page Navigation
    prevPageBtn.addEventListener('click', async () => {
      if (currentPage > 1) {
        currentPage--;
        await renderPreview(currentPage);
      }
    });
    nextPageBtn.addEventListener('click', async () => {
      if (currentPage < totalPages) {
        currentPage++;
        await renderPreview(currentPage);
      }
    });

    let lastConvertedBytes = null;

    // Action Conversion
    btnConvertGrayscale.addEventListener('click', async () => {
      if (!selectedFile) return;
      btnConvertGrayscale.disabled = true;
      progressContainer.style.display = 'block';

      const mode = document.querySelector('input[name="grayMode"]:checked').value;
      const quality = qualitySelect.value;

      try {
        const grayBytes = await PDFTools.Grayscale.convertToGrayscale(selectedFile, {
          mode: mode,
          quality: quality,
          onProgress: (pct, status) => {
            progressPercent.textContent = `${pct}%`;
            progressStatus.textContent = status;
            progressBar.style.width = `${pct}%`;
          }
        });

        lastConvertedBytes = grayBytes;
        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        PDFTools.Download.save(grayBytes, `${baseName}_${mode}.pdf`);
        PDFTools.Toast.success('PDF converted to grayscale successfully!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Failed to convert PDF.');
      } finally {
        btnConvertGrayscale.disabled = false;
        setTimeout(() => { progressContainer.style.display = 'none'; }, 1500);
      }
    });

    // Open in PDF Studio Action
    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', async () => {
        if (!selectedFile) return;

        let targetBytes = lastConvertedBytes;
        if (!targetBytes) {
          openStudioBtn.disabled = true;
          progressContainer.style.display = 'block';
          const mode = document.querySelector('input[name="grayMode"]:checked').value;
          const quality = qualitySelect.value;
          try {
            targetBytes = await PDFTools.Grayscale.convertToGrayscale(selectedFile, {
              mode: mode,
              quality: quality,
              onProgress: (pct, status) => {
                progressPercent.textContent = `${pct}%`;
                progressStatus.textContent = status;
                progressBar.style.width = `${pct}%`;
              }
            });
            lastConvertedBytes = targetBytes;
          } catch (err) {
            console.error(err);
            PDFTools.Toast.error('Failed to convert for PDF Studio.');
            openStudioBtn.disabled = false;
            progressContainer.style.display = 'none';
            return;
          }
        }

        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        const blob = new Blob([targetBytes], { type: 'application/pdf' });
        const file = new File([blob], `${baseName}_grayscale.pdf`, { type: 'application/pdf' });
        if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
          PDFTools.FileUtils.setPendingFile(file);
        }
        window.location.href = 'viewer.html';
      });
    }
  });
})();
