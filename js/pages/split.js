/**
 * PDF Tools — Split PDF Standalone Page Controller
 * Extracted from pages/split.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const optionsPanel = document.getElementById('optionsPanel');
    const pageGridContainer = document.getElementById('pageGridContainer');
    const pageGrid = document.getElementById('pageGrid');
    const rangeInputContainer = document.getElementById('rangeInputContainer');
    const rangeInput = document.getElementById('rangeInput');
    const everyNContainer = document.getElementById('everyNContainer');
    const everyNInput = document.getElementById('everyNInput');
    const selectAllBtn = document.getElementById('selectAllBtn');
    const deselectAllBtn = document.getElementById('deselectAllBtn');
    const actionBar = document.getElementById('actionBar');
    const splitBtn = document.getElementById('splitBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let currentFile = null;
    let totalPages = 0;
    let selectedMode = 'extract';
    let splitOutput = null; // Uint8Array or Array of {name, data}
    const progress = PDFTools.Progress('progressBar');

    async function loadFile(file) {
      currentFile = file;
      dropzoneEl.style.display = 'none';
      optionsPanel.style.display = 'block';
      pageGridContainer.style.display = 'block';
      actionBar.classList.add('active');
      resultArea.classList.remove('active');

      try {
        const res = await PDFTools.Preview.renderAllPages(currentFile, pageGrid, {
          initiallySelected: true
        });
        totalPages = res.totalPages;
        everyNInput.max = totalPages;
      } catch (e) {
        PDFTools.Toast.error('Could not render PDF pages.');
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
        onFiles: async (files) => {
          if (files && files[0]) await loadFile(files[0]);
        }
      });
    }

    // Mode toggle
    document.querySelectorAll('.option-group .option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.option-group .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedMode = btn.getAttribute('data-mode');

        if (selectedMode === 'extract') {
          pageGridContainer.style.display = 'block';
          rangeInputContainer.style.display = 'none';
          everyNContainer.style.display = 'none';
        } else if (selectedMode === 'range') {
          pageGridContainer.style.display = 'none';
          rangeInputContainer.style.display = 'block';
          everyNContainer.style.display = 'none';
        } else if (selectedMode === 'every') {
          pageGridContainer.style.display = 'none';
          rangeInputContainer.style.display = 'none';
          everyNContainer.style.display = 'block';
        }
      });
    });

    selectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.page-card').forEach(c => c.classList.add('selected'));
    });

    deselectAllBtn.addEventListener('click', () => {
      document.querySelectorAll('.page-card').forEach(c => c.classList.remove('selected'));
    });

    splitBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      splitBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        if (selectedMode === 'extract') {
          const selectedCards = document.querySelectorAll('.page-card.selected');
          if (selectedCards.length === 0) {
            throw new Error(PDFTools.i18n.t('toast.select_pages'));
          }
          const indices = Array.from(selectedCards).map(c => parseInt(c.getAttribute('data-page'), 10) - 1);
          splitOutput = {
            type: 'single',
            data: await PDFTools.Split.extractPages(currentFile, indices),
            filename: `${currentFile.name.replace(/\.pdf$/i, '')}_extracted.pdf`
          };
        } else if (selectedMode === 'range') {
          const val = rangeInput.value.trim();
          if (!val) throw new Error('Please enter a valid page range.');
          const indices = PDFTools.Split.parseRange(val, totalPages);
          if (indices.length === 0) throw new Error('No valid pages found in specified range.');
          splitOutput = {
            type: 'single',
            data: await PDFTools.Split.extractPages(currentFile, indices),
            filename: `${currentFile.name.replace(/\.pdf$/i, '')}_range.pdf`
          };
        } else if (selectedMode === 'every') {
          const n = parseInt(everyNInput.value, 10) || 1;
          const parts = await PDFTools.Split.splitEveryN(currentFile, n, function (percent, text) {
            progress.update(percent, text);
          });
          splitOutput = {
            type: 'zip',
            files: parts,
            filename: `${currentFile.name.replace(/\.pdf$/i, '')}_split_parts.zip`
          };
        }

        progress.hide();
        optionsPanel.style.display = 'none';
        pageGridContainer.style.display = 'none';
        actionBar.classList.remove('active');
        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Split PDF', 'split');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.split_success'));
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        splitBtn.disabled = false;
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) {
          currentFile = file;
          dropzoneEl.style.display = 'none';
          optionsPanel.style.display = 'block';
          pageGridContainer.style.display = 'block';
          actionBar.classList.add('active');
          PDFTools.Preview.renderAllPages(currentFile, pageGrid, { initiallySelected: true }).then(res => {
            totalPages = res.totalPages;
            everyNInput.max = totalPages;
          }).catch(() => PDFTools.Toast.error('Could not render PDF pages.'));
        }
      });
    }

    downloadBtn.addEventListener('click', function () {
      if (!splitOutput) return;
      if (splitOutput.type === 'single') {
        PDFTools.Download.save(splitOutput.data, splitOutput.filename);
      } else if (splitOutput.type === 'zip') {
        PDFTools.Download.saveAsZip(splitOutput.files, splitOutput.filename);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (!splitOutput) return;
        let fileToOpen = null;
        if (splitOutput.type === 'single' && splitOutput.data) {
          const blob = new Blob([splitOutput.data], { type: 'application/pdf' });
          fileToOpen = new File([blob], splitOutput.filename || 'split_document.pdf', { type: 'application/pdf' });
        } else if (splitOutput.type === 'zip' && splitOutput.files && splitOutput.files.length > 0) {
          const first = splitOutput.files[0];
          const blob = new Blob([first.data], { type: 'application/pdf' });
          fileToOpen = new File([blob], first.name || 'split_part_1.pdf', { type: 'application/pdf' });
        }
        if (fileToOpen && PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
          PDFTools.FileUtils.setPendingFile(fileToOpen);
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      currentFile = null;
      splitOutput = null;
      splitBtn.disabled = false;
      resultArea.classList.remove('active');
      dropzoneEl.style.display = 'block';
      optionsPanel.style.display = 'none';
      pageGridContainer.style.display = 'none';
      pageGrid.innerHTML = '';
    });
  });
})();
