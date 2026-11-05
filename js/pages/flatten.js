/**
 * PDF Tools — Flatten PDF Standalone Page Controller
 * Extracted from pages/flatten.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let selectedFile = null;
    let currentPdfDoc = null;
    let currentPdfjsDoc = null;
    let currentPreviewPage = 1;
    let totalPages = 1;
    let activeRenderTask = null;

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileSizeLabel = document.getElementById('fileSizeLabel');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const optVectorCard = document.getElementById('optVectorCard');
    const optRasterCard = document.getElementById('optRasterCard');
    const rasterQualityGroup = document.getElementById('rasterQualityGroup');
    const rasterQualitySelect = document.getElementById('rasterQualitySelect');
    const progressContainer = document.getElementById('progressContainer');
    const progressStatus = document.getElementById('progressStatus');
    const progressPercent = document.getElementById('progressPercent');
    const progressBar = document.getElementById('progressBar');
    const btnFlattenPdf = document.getElementById('btnFlattenPdf');

    const flattenPreviewCanvas = document.getElementById('flattenPreviewCanvas');
    const previewSkeleton = document.getElementById('previewSkeleton');
    const previewPageBadge = document.getElementById('previewPageBadge');
    const previewNav = document.getElementById('previewNav');
    const prevPreviewBtn = document.getElementById('prevPreviewBtn');
    const nextPreviewBtn = document.getElementById('nextPreviewBtn');
    const previewPageIndicator = document.getElementById('previewPageIndicator');

    async function renderPreviewPage(pageNum) {
      if (!currentPdfjsDoc || !flattenPreviewCanvas) return;
      if (activeRenderTask) {
        try {
          activeRenderTask.cancel();
        } catch (_) {}
      }

      try {
        const page = await currentPdfjsDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const containerWidth = 360;
        const scale = Math.min(containerWidth / unscaledViewport.width, 1.5);
        const viewport = page.getViewport({ scale });

        flattenPreviewCanvas.width = viewport.width;
        flattenPreviewCanvas.height = viewport.height;
        const ctx = flattenPreviewCanvas.getContext('2d');

        activeRenderTask = page.render({
          canvasContext: ctx,
          viewport: viewport,
          annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
        });
        await activeRenderTask.promise;

        if (previewSkeleton) previewSkeleton.style.display = 'none';
        flattenPreviewCanvas.style.display = 'block';

        if (previewPageBadge) {
          previewPageBadge.textContent = `Page ${pageNum}`;
        }
        if (previewPageIndicator) {
          previewPageIndicator.textContent = `Page ${pageNum} / ${totalPages}`;
        }
        if (prevPreviewBtn) prevPreviewBtn.disabled = pageNum <= 1;
        if (nextPreviewBtn) nextPreviewBtn.disabled = pageNum >= totalPages;
      } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('Failed to render preview page:', err);
        }
      }
    }

    async function handleFile(file) {
      selectedFile = file;
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = `${PDFTools.FileUtils.formatFileSize(file.size)}`;

      uploadState.style.display = 'none';
      workspaceState.style.display = 'block';
      PDFTools.Toast.success(PDFTools.i18n ? PDFTools.i18n.t('toast.pdf_loaded') : 'PDF loaded successfully!');

      try {
        if (previewSkeleton) previewSkeleton.style.display = 'flex';
        if (flattenPreviewCanvas) flattenPreviewCanvas.style.display = 'none';

        const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(file);
        currentPdfDoc = pdfDoc;
        totalPages = pdfDoc.getPages().length;
        fileSizeLabel.textContent = `${PDFTools.FileUtils.formatFileSize(file.size)} • ${totalPages} ${totalPages === 1 ? 'Page' : 'Pages'}`;

        const bytes = await pdfDoc.save();
        if (typeof pdfjsLib !== 'undefined') {
          if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
            pdfjsLib.GlobalWorkerOptions.workerSrc = '../js/lib/pdf.worker.min.js';
          }
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes) });
          currentPdfjsDoc = await loadingTask.promise;
          currentPreviewPage = 1;

          if (totalPages > 1 && previewNav) {
            previewNav.style.display = 'flex';
          } else if (previewNav) {
            previewNav.style.display = 'none';
          }
          await renderPreviewPage(1);
        }
      } catch (err) {
        console.error('Error loading PDF for preview:', err);
      }
    }

    // Setup Dropzone
    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        if (files && files.length > 0) {
          handleFile(files[0]);
        }
      }
    });

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: false,
        enabled: () => Boolean(selectedFile),
        onFiles: async (files) => {
          if (files && files[0]) handleFile(files[0]);
        }
      });
    }

    // Handle pending file from universal handoff
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) handleFile(file);
      });
    }

    changeFileBtn.addEventListener('click', () => {
      selectedFile = null;
      currentPdfDoc = null;
      currentPdfjsDoc = null;
      if (activeRenderTask) {
        try { activeRenderTask.cancel(); } catch (_) {}
      }
      if (flattenPreviewCanvas) {
        flattenPreviewCanvas.style.display = 'none';
        const ctx = flattenPreviewCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, flattenPreviewCanvas.width, flattenPreviewCanvas.height);
      }
      if (previewSkeleton) previewSkeleton.style.display = 'flex';
      if (previewNav) previewNav.style.display = 'none';
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
    });

    if (prevPreviewBtn) {
      prevPreviewBtn.addEventListener('click', () => {
        if (currentPreviewPage > 1) {
          currentPreviewPage--;
          renderPreviewPage(currentPreviewPage);
        }
      });
    }
    if (nextPreviewBtn) {
      nextPreviewBtn.addEventListener('click', () => {
        if (currentPreviewPage < totalPages) {
          currentPreviewPage++;
          renderPreviewPage(currentPreviewPage);
        }
      });
    }

    // Flatten mode radio toggle styles
    document.querySelectorAll('input[name="flattenMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isVector = radio.value === 'vector';
        optVectorCard.style.borderColor = isVector ? 'var(--tool-color)' : 'var(--border-color)';
        optVectorCard.style.background = isVector ? 'color-mix(in srgb, var(--tool-color), transparent 90%)' : 'transparent';
        optRasterCard.style.borderColor = !isVector ? 'var(--tool-color)' : 'var(--border-color)';
        optRasterCard.style.background = !isVector ? 'color-mix(in srgb, var(--tool-color), transparent 90%)' : 'transparent';
        rasterQualityGroup.style.display = isVector ? 'none' : 'block';
      });
    });

    btnFlattenPdf.addEventListener('click', async () => {
      if (!selectedFile) return;
      btnFlattenPdf.disabled = true;
      progressContainer.style.display = 'block';

      const mode = document.querySelector('input[name="flattenMode"]:checked').value;
      const quality = rasterQualitySelect.value;

      try {
        const flattenedBytes = await PDFTools.Flatten.flattenPdf(selectedFile, {
          mode: mode,
          quality: quality,
          onProgress: (pct, status) => {
            progressPercent.textContent = `${pct}%`;
            progressStatus.textContent = status;
            progressBar.style.width = `${pct}%`;
          }
        });

        const baseName = selectedFile.name.replace(/\.pdf$/i, '');
        PDFTools.Download.save(flattenedBytes, `${baseName}_flattened.pdf`);
        PDFTools.Toast.success('PDF flattened & downloaded successfully!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Failed to flatten PDF.');
      } finally {
        btnFlattenPdf.disabled = false;
        setTimeout(() => { progressContainer.style.display = 'none'; }, 1500);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', async () => {
        if (!selectedFile) return;
        openStudioBtn.disabled = true;
        progressContainer.style.display = 'block';

        const mode = document.querySelector('input[name="flattenMode"]:checked').value;
        const quality = rasterQualitySelect.value;

        try {
          const flattenedBytes = await PDFTools.Flatten.flattenPdf(selectedFile, {
            mode: mode,
            quality: quality,
            onProgress: (pct, status) => {
              progressPercent.textContent = `${pct}%`;
              progressStatus.textContent = status;
              progressBar.style.width = `${pct}%`;
            }
          });

          const baseName = selectedFile.name.replace(/\.pdf$/i, '');
          const blob = new Blob([flattenedBytes], { type: 'application/pdf' });
          const file = new File([blob], `${baseName}_flattened.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        } catch (err) {
          console.error(err);
          PDFTools.Toast.error(err.message || 'Failed to flatten PDF.');
          openStudioBtn.disabled = false;
          progressContainer.style.display = 'none';
        }
      });
    }
  });
})();
