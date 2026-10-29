/**
 * PDF Tools — JPG to PDF Standalone Page Controller
 * Extracted from pages/jpg-to-pdf.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const optionsPanel = document.getElementById('optionsPanel');
    const actionBar = document.getElementById('actionBar');
    const convertBtn = document.getElementById('convertBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    let pageSize = 'A4';
    let orientation = 'portrait';
    let margin = 'none';
    let convertedData = null;
    const progress = PDFTools.Progress('progressBar');

    const fileList = PDFTools.FileList('fileList', {
      onFilesChange: function (files) {
        if (files.length > 0) {
          dropzoneEl.style.display = 'none';
          addMoreBtn.style.display = 'flex';
          optionsPanel.style.display = 'block';
          actionBar.classList.add('active');
          resultArea.classList.remove('active');
        } else {
          dropzoneEl.style.display = 'block';
          addMoreBtn.style.display = 'none';
          optionsPanel.style.display = 'none';
          actionBar.classList.remove('active');
        }
      }
    });

    const dropzone = PDFTools.Dropzone('dropzone', {
      accept: 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp',
      multiple: true,
      onFiles: function (files) {
        fileList.addFiles(files);
        PDFTools.Toast.success(`${files.length} ${PDFTools.i18n.t('toast.files_added')}`);
      }
    });

    addMoreBtn.addEventListener('click', () => dropzone.open());

    function setupOptionGroup(groupId, onChange) {
      document.querySelectorAll(`#${groupId} .option-btn`).forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll(`#${groupId} .option-btn`).forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          onChange(btn);
        });
      });
    }

    setupOptionGroup('sizeOptions', (b) => { pageSize = b.getAttribute('data-size'); });
    setupOptionGroup('orientOptions', (b) => { orientation = b.getAttribute('data-orient'); });
    setupOptionGroup('marginOptions', (b) => { margin = b.getAttribute('data-margin'); });

    convertBtn.addEventListener('click', async function () {
      const files = fileList.getFiles();
      if (files.length === 0) return;

      convertBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        convertedData = await PDFTools.JpgToPdf.convert(files, {
          pageSize: pageSize,
          orientation: orientation,
          margin: margin
        }, function (percent, text) {
          progress.update(percent, text);
        });

        progress.hide();
        document.getElementById('fileList').style.display = 'none';
        addMoreBtn.style.display = 'none';
        optionsPanel.style.display = 'none';
        actionBar.classList.remove('active');
        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && convertedData) {
          PDFTools.RecentFiles.add('images_converted.pdf', convertedData.byteLength, 'JPG to PDF', 'image');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.convert_success'));
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        convertBtn.disabled = false;
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) {
          fileList.addFiles([file]);
        }
      });
    }

    downloadBtn.addEventListener('click', function () {
      if (convertedData) {
        PDFTools.Download.save(convertedData, 'images_converted.pdf');
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (convertedData) {
          const blob = new Blob([convertedData], { type: 'application/pdf' });
          const file = new File([blob], 'images_converted.pdf', { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      fileList.clear();
      convertedData = null;
      convertBtn.disabled = false;
      resultArea.classList.remove('active');
      document.getElementById('fileList').style.display = 'flex';
      dropzoneEl.style.display = 'block';
    });
  });
})();
