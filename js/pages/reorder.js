/**
 * PDF Tools — Reorder Pages Standalone Page Controller
 * Extracted from pages/reorder.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const instructionBanner = document.getElementById('instructionBanner');
    const pageGrid = document.getElementById('pageGrid');
    const actionBar = document.getElementById('actionBar');
    const saveOrderBtn = document.getElementById('saveOrderBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let currentFile = null;
    let reorderedPdfBytes = null;
    let sortable = null;
    const progress = PDFTools.Progress('progressBar');

    async function loadFile(file) {
      currentFile = file;
      dropzoneEl.style.display = 'none';
      instructionBanner.style.display = 'flex';
      pageGrid.style.display = 'grid';
      actionBar.classList.add('active');
      resultArea.classList.remove('active');

      await PDFTools.Preview.renderAllPages(currentFile, pageGrid, {
        selectable: false
      });

      if (typeof Sortable !== 'undefined') {
        if (sortable) sortable.destroy();
        sortable = new Sortable(pageGrid, {
          animation: 200,
          ghostClass: 'sortable-ghost',
          dragClass: 'sortable-drag',
          delay: 200,
          delayOnTouchOnly: true,
          touchStartThreshold: 8
        });
      }
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        if (files && files[0]) await loadFile(files[0]);
      }
    });

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: false,
        enabled: () => Boolean(currentFile),
        hasUnsavedWork: () => {
          const cards = pageGrid.querySelectorAll('.page-card');
          return Array.from(cards).some((c, idx) => parseInt(c.getAttribute('data-page'), 10) !== idx + 1);
        },
        onFiles: async (files) => {
          if (files && files[0]) await loadFile(files[0]);
        }
      });
    }

    saveOrderBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      const cards = pageGrid.querySelectorAll('.page-card');
      const newOrder = Array.from(cards).map(c => parseInt(c.getAttribute('data-page'), 10) - 1);

      saveOrderBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        reorderedPdfBytes = await PDFTools.Reorder.reorder(currentFile, newOrder, function (percent, text) {
          progress.update(percent, text);
        });

        progress.hide();
        instructionBanner.style.display = 'none';
        pageGrid.style.display = 'none';
        actionBar.classList.remove('active');
        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Reorder Pages', 'reorder');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.reorder_success'));
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        saveOrderBtn.disabled = false;
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(async file => {
        if (file) {
          currentFile = file;
          dropzoneEl.style.display = 'none';
          instructionBanner.style.display = 'flex';
          pageGrid.style.display = 'grid';
          actionBar.classList.add('active');
          await PDFTools.Preview.renderAllPages(currentFile, pageGrid, { selectable: false });
          if (typeof Sortable !== 'undefined') {
            if (sortable) sortable.destroy();
            sortable = new Sortable(pageGrid, {
              animation: 200,
              ghostClass: 'sortable-ghost',
              dragClass: 'sortable-drag',
              delay: 200,
              delayOnTouchOnly: true,
              touchStartThreshold: 8
            });
          }
        }
      });
    }

    downloadBtn.addEventListener('click', function () {
      if (reorderedPdfBytes) {
        PDFTools.Download.save(reorderedPdfBytes, `${currentFile.name.replace(/\.pdf$/i, '')}_reordered.pdf`);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (reorderedPdfBytes && currentFile) {
          const blob = new Blob([reorderedPdfBytes], { type: 'application/pdf' });
          const file = new File([blob], `${currentFile.name.replace(/\.pdf$/i, '')}_reordered.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      currentFile = null;
      reorderedPdfBytes = null;
      if (sortable) {
        sortable.destroy();
        sortable = null;
      }
      saveOrderBtn.disabled = false;
      resultArea.classList.remove('active');
      dropzoneEl.style.display = 'block';
      instructionBanner.style.display = 'none';
      pageGrid.style.display = 'none';
      pageGrid.innerHTML = '';
    });
  });
})();
