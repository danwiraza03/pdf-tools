/**
 * PDF Tools — Remove Pages Standalone Page Controller
 * Extracted from pages/remove-pages.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const selectionHeader = document.getElementById('selectionHeader');
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    const pageGrid = document.getElementById('pageGrid');
    const actionBar = document.getElementById('actionBar');
    const removeBtn = document.getElementById('removeBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let currentFile = null;
    let removeResult = null;
    const progress = PDFTools.Progress('progressBar');

    async function loadFile(file) {
      currentFile = file;
      dropzoneEl.style.display = 'none';
      selectionHeader.style.display = 'flex';
      pageGrid.style.display = 'grid';
      actionBar.classList.add('active');
      resultArea.classList.remove('active');

      await PDFTools.Preview.renderAllPages(currentFile, pageGrid, {
        selectable: true,
        initiallySelected: false
      });
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
        hasUnsavedWork: () => pageGrid.querySelectorAll('.page-card.selected').length > 0,
        onFiles: async (files) => {
          if (files && files[0]) await loadFile(files[0]);
        }
      });
    }

    clearSelectionBtn.addEventListener('click', () => {
      pageGrid.querySelectorAll('.page-card').forEach(c => c.classList.remove('selected'));
    });

    removeBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      const selectedCards = pageGrid.querySelectorAll('.page-card.selected');
      if (selectedCards.length === 0) {
        PDFTools.Toast.error('Please select at least one page to remove.');
        return;
      }

      const pagesToRemove = Array.from(selectedCards).map(c => parseInt(c.getAttribute('data-page'), 10) - 1);

      removeBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        removeResult = await PDFTools.Remove.removePages(currentFile, pagesToRemove, function (percent, text) {
          progress.update(percent, text);
        });

        progress.hide();
        selectionHeader.style.display = 'none';
        pageGrid.style.display = 'none';
        actionBar.classList.remove('active');

        document.getElementById('resRemaining').textContent = removeResult.remainingPages;
        document.getElementById('resRemoved').textContent = removeResult.removedPagesCount;

        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Remove Pages', 'remove');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.remove_success'));
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        removeBtn.disabled = false;
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(async file => {
        if (file) {
          currentFile = file;
          dropzoneEl.style.display = 'none';
          selectionHeader.style.display = 'flex';
          pageGrid.style.display = 'grid';
          actionBar.classList.add('active');
          await PDFTools.Preview.renderAllPages(currentFile, pageGrid, {
            selectable: true,
            initiallySelected: false
          });
        }
      });
    }

    downloadBtn.addEventListener('click', function () {
      if (removeResult && removeResult.bytes) {
        PDFTools.Download.save(removeResult.bytes, `${currentFile.name.replace(/\.pdf$/i, '')}_edited.pdf`);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (removeResult && removeResult.bytes && currentFile) {
          const blob = new Blob([removeResult.bytes], { type: 'application/pdf' });
          const file = new File([blob], `${currentFile.name.replace(/\.pdf$/i, '')}_edited.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      currentFile = null;
      removeResult = null;
      removeBtn.disabled = false;
      resultArea.classList.remove('active');
      dropzoneEl.style.display = 'block';
      selectionHeader.style.display = 'none';
      pageGrid.style.display = 'none';
      pageGrid.innerHTML = '';
    });
  });
})();
