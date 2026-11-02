/**
 * PDF Tools — Page Numbers Standalone Page Controller
 * Extracted from pages/page-number.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let currentFile = null;
    let queuedFiles = [];
    let isBatchMode = false;
    let totalDocPages = 1;
    let selectedPosition = 'bottom_right';
    let pdfjsDoc = null;
    let currentPreviewPage = 1;
    let pdfPageWidth = 595;
    let pdfPageHeight = 842;
    let activeRenderTask = null;

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileMetaLabel = document.getElementById('fileMetaLabel');
    const previewSheet = document.getElementById('previewSheet');
    const previewSkeleton = document.getElementById('previewSkeleton');
    const previewCanvas = document.getElementById('previewCanvas');
    const liveMarker = document.getElementById('liveMarker');
    const previewNav = document.getElementById('previewNav');
    const prevPreviewPageBtn = document.getElementById('prevPreviewPageBtn');
    const nextPreviewPageBtn = document.getElementById('nextPreviewPageBtn');
    const previewPageIndicator = document.getElementById('previewPageIndicator');

    const formatSelect = document.getElementById('formatSelect');
    const customTemplateGroup = document.getElementById('customTemplateGroup');
    const customTextInput = document.getElementById('customTextInput');
    const fontSizeSelect = document.getElementById('fontSizeSelect');
    const fontFamilySelect = document.getElementById('fontFamilySelect');
    const colorPicker = document.getElementById('colorPicker');
    const marginInput = document.getElementById('marginInput');
    const startPageInput = document.getElementById('startPageInput');
    const startNumberInput = document.getElementById('startNumberInput');
    const applyPageNumbersBtn = document.getElementById('applyPageNumbersBtn');
    const resetBtn = document.getElementById('resetBtn');

    async function renderPreviewPage(pageNum) {
      if (!pdfjsDoc) return;
      if (pageNum < 1) pageNum = 1;
      if (pageNum > totalDocPages) pageNum = totalDocPages;
      currentPreviewPage = pageNum;

      if (activeRenderTask) {
        try { activeRenderTask.cancel(); } catch (_) {}
        activeRenderTask = null;
      }

      try {
        const page = await pdfjsDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        pdfPageWidth = unscaledViewport.width;
        pdfPageHeight = unscaledViewport.height;

        if (previewSheet) {
          previewSheet.style.aspectRatio = `${pdfPageWidth} / ${pdfPageHeight}`;
        }

        const targetWidth = Math.min(800, (previewSheet ? previewSheet.clientWidth : 380) * (window.devicePixelRatio || 1.5));
        const renderScale = Math.max(1.0, targetWidth / unscaledViewport.width);
        const viewport = page.getViewport({ scale: renderScale });

        if (previewCanvas) {
          previewCanvas.width = viewport.width;
          previewCanvas.height = viewport.height;
          const ctx = previewCanvas.getContext('2d');

          activeRenderTask = page.render({
            canvasContext: ctx,
            viewport: viewport,
            annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
          });

          await activeRenderTask.promise;
          activeRenderTask = null;

          if (previewSkeleton) previewSkeleton.style.display = 'none';
          previewCanvas.style.display = 'block';
        }
      } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('Failed to render PDF page preview:', err);
        }
      }

      updateNavUI();
      updateLivePreview();
    }

    function updateNavUI() {
      if (!previewNav) return;
      if (totalDocPages > 1) {
        previewNav.style.display = 'flex';
        const pageLabel = (PDFTools.i18n && PDFTools.i18n.t('page')) || 'Page';
        if (previewPageIndicator) {
          previewPageIndicator.textContent = `${pageLabel} ${currentPreviewPage} / ${totalDocPages}`;
        }
        if (prevPreviewPageBtn) prevPreviewPageBtn.disabled = (currentPreviewPage <= 1);
        if (nextPreviewPageBtn) nextPreviewPageBtn.disabled = (currentPreviewPage >= totalDocPages);
      } else {
        previewNav.style.display = 'none';
      }
    }

    if (prevPreviewPageBtn) {
      prevPreviewPageBtn.addEventListener('click', () => {
        if (currentPreviewPage > 1) {
          renderPreviewPage(currentPreviewPage - 1);
        }
      });
    }

    if (nextPreviewPageBtn) {
      nextPreviewPageBtn.addEventListener('click', () => {
        if (currentPreviewPage < totalDocPages) {
          renderPreviewPage(currentPreviewPage + 1);
        }
      });
    }

    async function loadDocument(file, allFiles = null) {
      if (!file) return;
      currentFile = file;
      if (allFiles && allFiles.length > 0) {
        queuedFiles = allFiles;
      } else if (queuedFiles.indexOf(file) === -1) {
        queuedFiles = [file];
      }
      isBatchMode = queuedFiles.length > 1;

      try {
        if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
          PDFTools.FileUtils.initPdfJsWorker();
        }

        const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(currentFile);
        totalDocPages = pdfDoc.getPages().length;
        const decryptedBytes = await pdfDoc.save();

        if (isBatchMode) {
          fileMetaLabel.textContent = `Batch Queue: ${queuedFiles.length} Files Selected • Primary: ${currentFile.name}`;
          applyPageNumbersBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Number ${queuedFiles.length} Documents & Download (.ZIP)</span>`;
        } else {
          fileMetaLabel.textContent = `${currentFile.name} • ${totalDocPages} Pages • ${PDFTools.FileUtils.formatSize(currentFile.size)}`;
          applyPageNumbersBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Apply Page Numbers & Download</span>`;
        }
        startPageInput.max = totalDocPages;

        uploadState.style.display = 'none';
        workspaceState.style.display = 'block';

        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(decryptedBytes) });
        pdfjsDoc = await loadingTask.promise;

        currentPreviewPage = parseInt(startPageInput.value || 1, 10);
        if (currentPreviewPage > totalDocPages || currentPreviewPage < 1) currentPreviewPage = 1;
        await renderPreviewPage(currentPreviewPage);
      } catch (err) {
        console.error('Failed to load PDF file:', err);
        PDFTools.Toast.error('Could not load PDF file.');
      }
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: true,
      onFiles: async function (files) {
        if (files.length > 0) {
          await loadDocument(files[0], files);
        }
      }
    });

    function appendFiles(newFiles) {
      if (!newFiles || newFiles.length === 0) return;
      queuedFiles = queuedFiles.concat(newFiles);
      if (!currentFile && queuedFiles.length > 0) {
        loadDocument(queuedFiles[0], queuedFiles);
        return;
      }
      isBatchMode = queuedFiles.length > 1;
      if (isBatchMode) {
        fileMetaLabel.textContent = `Batch Queue: ${queuedFiles.length} Files Selected • Primary: ${currentFile.name}`;
        applyPageNumbersBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Number ${queuedFiles.length} Documents & Download (.ZIP)</span>`;
      } else if (currentFile) {
        fileMetaLabel.textContent = `${currentFile.name} • ${totalDocPages} Pages • ${PDFTools.FileUtils.formatSize(currentFile.size)}`;
        applyPageNumbersBtn.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Apply Page Numbers & Download</span>`;
      }
      if (PDFTools.Toast) {
        PDFTools.Toast.success(`${newFiles.length} ${PDFTools.i18n.t('toast.files_added')}`);
      }
    }

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: true,
        enabled: () => Boolean(currentFile || queuedFiles.length > 0),
        onFiles: appendFiles
      });
    }

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(async file => {
        if (file) {
          await loadDocument(file, [file]);
        }
      });
    }

    // Position Buttons
    document.querySelectorAll('.pos-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedPosition = btn.getAttribute('data-pos');
        updateLivePreview();
      });
    });

    formatSelect.addEventListener('change', () => {
      customTemplateGroup.style.display = formatSelect.value === 'custom' ? 'block' : 'none';
      updateLivePreview();
    });

    [customTextInput, fontSizeSelect, fontFamilySelect, colorPicker, marginInput, startNumberInput].forEach(el => {
      if (el) {
        el.addEventListener('input', updateLivePreview);
        el.addEventListener('change', updateLivePreview);
      }
    });

    if (startPageInput) {
      startPageInput.addEventListener('input', () => {
        updateLivePreview();
      });
      startPageInput.addEventListener('change', () => {
        const sp = parseInt(startPageInput.value || 1, 10);
        if (sp >= 1 && sp <= totalDocPages && sp !== currentPreviewPage) {
          renderPreviewPage(sp);
        } else {
          updateLivePreview();
        }
      });
    }

    let resizeTimer = null;
    window.addEventListener('resize', () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(updateLivePreview, 100);
    });

    function updateLivePreview() {
      const fmt = formatSelect.value;
      const startNum = parseInt(startNumberInput.value || 1, 10);
      const startPage = parseInt(startPageInput.value || 1, 10);
      const margin = parseInt(marginInput.value || 25, 10);
      const fontSizePt = parseInt(fontSizeSelect.value, 10) || 10;
      const totalPagesForLabel = Math.max(1, totalDocPages - startPage + 1);

      let previewText = '';
      const isNumberedOnThisPage = currentPreviewPage >= startPage;
      const pageNumberValue = startNum + (currentPreviewPage - startPage);

      if (fmt === 'number_only') {
        previewText = `${pageNumberValue}`;
      } else if (fmt === 'page_of_total') {
        previewText = `Page ${pageNumberValue} of ${totalPagesForLabel}`;
      } else if (fmt === 'halaman_dari') {
        previewText = `Halaman ${pageNumberValue} dari ${totalPagesForLabel}`;
      } else {
        previewText = (customTextInput.value || 'Page {n}')
          .replace(/\{n\}/g, `${pageNumberValue}`)
          .replace(/\{total\}/g, `${totalPagesForLabel}`);
      }

      liveMarker.textContent = previewText;
      liveMarker.style.color = colorPicker.value;
      liveMarker.style.fontFamily = fontFamilySelect.value === 'TimesRoman' ? 'Times New Roman, serif' : (fontFamilySelect.value === 'Courier' ? 'Courier, monospace' : 'Helvetica, sans-serif');

      const sheetW = previewSheet ? (previewSheet.clientWidth || 300) : 300;
      const scaleRatio = pdfPageWidth > 0 ? (sheetW / pdfPageWidth) : 0.5;
      const scaledMargin = Math.max(6, Math.round(margin * scaleRatio));
      const scaledFontSize = Math.max(9, Math.round(fontSizePt * scaleRatio * 1.3));

      liveMarker.style.fontSize = `${scaledFontSize}px`;

      if (!isNumberedOnThisPage) {
        liveMarker.style.opacity = '0.3';
        liveMarker.title = `Numbering starts on page ${startPage}`;
      } else {
        liveMarker.style.opacity = '1';
        liveMarker.title = '';
      }

      // Reset positions
      liveMarker.style.top = '';
      liveMarker.style.bottom = '';
      liveMarker.style.left = '';
      liveMarker.style.right = '';
      liveMarker.style.transform = '';

      const marginPx = `${scaledMargin}px`;

      if (selectedPosition === 'top_left') {
        liveMarker.style.top = marginPx;
        liveMarker.style.left = marginPx;
      } else if (selectedPosition === 'top_center') {
        liveMarker.style.top = marginPx;
        liveMarker.style.left = '50%';
        liveMarker.style.transform = 'translateX(-50%)';
      } else if (selectedPosition === 'top_right') {
        liveMarker.style.top = marginPx;
        liveMarker.style.right = marginPx;
      } else if (selectedPosition === 'bottom_left') {
        liveMarker.style.bottom = marginPx;
        liveMarker.style.left = marginPx;
      } else if (selectedPosition === 'bottom_center') {
        liveMarker.style.bottom = marginPx;
        liveMarker.style.left = '50%';
        liveMarker.style.transform = 'translateX(-50%)';
      } else {
        // bottom_right
        liveMarker.style.bottom = marginPx;
        liveMarker.style.right = marginPx;
      }
    }

    let lastNumberedBytes = null;

    applyPageNumbersBtn.addEventListener('click', async () => {
      if (!queuedFiles || queuedFiles.length === 0) return;

      applyPageNumbersBtn.disabled = true;
      applyPageNumbersBtn.textContent = 'Numbering Pages...';

      try {
        const options = {
          format: formatSelect.value,
          customText: customTextInput.value,
          position: selectedPosition,
          fontSize: parseInt(fontSizeSelect.value, 10),
          fontFamily: fontFamilySelect.value,
          color: colorPicker.value,
          margin: parseInt(marginInput.value || 25, 10),
          startPage: parseInt(startPageInput.value || 1, 10),
          startNumber: parseInt(startNumberInput.value || 1, 10),
          endPage: totalDocPages
        };

        if (isBatchMode && queuedFiles.length > 1) {
          const zip = new JSZip();
          const total = queuedFiles.length;

          for (let i = 0; i < total; i++) {
            const f = queuedFiles[i];
            applyPageNumbersBtn.textContent = `[${i + 1}/${total}] ${f.name}...`;
            const resBytes = await PDFTools.PageNumber.applyPageNumbers(f, options);
            const outName = `${f.name.replace(/\.pdf$/i, '')}_numbered.pdf`;
            zip.file(outName, resBytes);
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'numbered_documents.zip');
          PDFTools.Toast.success(`All ${total} documents numbered and saved to ZIP!`);
        } else {
          const outputBytes = await PDFTools.PageNumber.applyPageNumbers(currentFile, options, (pct) => {
            applyPageNumbersBtn.textContent = `Processing (${pct}%)...`;
          });
          lastNumberedBytes = outputBytes;

          const baseName = currentFile.name.replace(/\.pdf$/i, '');
          PDFTools.Download.save(outputBytes, `${baseName}_numbered.pdf`);

          if (PDFTools.RecentFiles && currentFile) {
            PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Page Numbers', 'number');
          }

          PDFTools.Toast.success('Page numbers added successfully!');
        }
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Failed to apply page numbers.');
      } finally {
        applyPageNumbersBtn.disabled = false;
        applyPageNumbersBtn.innerHTML = (isBatchMode && queuedFiles.length > 1) 
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Number ${queuedFiles.length} Documents (.ZIP)</span>` 
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M12 6v6"/><path d="m10 8 2-2"/></svg> <span>Apply Page Numbers & Download</span>`;
        if (lastNumberedBytes && openStudioBtn) openStudioBtn.style.display = 'inline-flex';
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (!lastNumberedBytes || !currentFile) return;
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        const blob = new Blob([lastNumberedBytes], { type: 'application/pdf' });
        const file = new File([blob], `${baseName}_numbered.pdf`, { type: 'application/pdf' });
        if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
          PDFTools.FileUtils.setPendingFile(file);
        }
        window.location.href = 'viewer.html';
      });
    }

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      queuedFiles = [];
      isBatchMode = false;
      lastNumberedBytes = null;
      pdfjsDoc = null;
      currentPreviewPage = 1;
      if (activeRenderTask) {
        try { activeRenderTask.cancel(); } catch (_) {}
        activeRenderTask = null;
      }
      if (openStudioBtn) openStudioBtn.style.display = 'none';
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';

      if (previewCanvas) {
        previewCanvas.style.display = 'none';
        const ctx = previewCanvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
      }
      if (previewSkeleton) previewSkeleton.style.display = 'flex';
      if (previewNav) previewNav.style.display = 'none';
      if (previewSheet) previewSheet.style.aspectRatio = '210/297';
    });
  });
})();
