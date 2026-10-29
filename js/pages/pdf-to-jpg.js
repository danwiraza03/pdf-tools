/**
 * PDF Tools — PDF to JPG Standalone Page Controller
 * Extracted from pages/pdf-to-jpg.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const optionsPanel = document.getElementById('optionsPanel');
    const actionBar = document.getElementById('actionBar');
    const convertBtn = document.getElementById('convertBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const resetBtn = document.getElementById('resetBtn');
    const imagePreviewGrid = document.getElementById('imagePreviewGrid');

    let currentFile = null;
    let selectedQuality = 'standard';
    let selectedFormat = 'jpeg';
    let convertedImages = [];
    const progress = PDFTools.Progress('progressBar');

    const fileList = PDFTools.FileList('fileList', {
      onFilesChange: function (files) {
        if (files.length > 0) {
          currentFile = files[0].file;
          dropzoneEl.style.display = 'none';
          optionsPanel.style.display = 'block';
          actionBar.classList.add('active');
          resultArea.classList.remove('active');
        } else {
          currentFile = null;
          dropzoneEl.style.display = 'block';
          optionsPanel.style.display = 'none';
          actionBar.classList.remove('active');
        }
      }
    });

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: function (files) {
        fileList.clear();
        fileList.addFiles([files[0]]);
      }
    });

    // Quality Toggle
    document.querySelectorAll('#qualityOptions .option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#qualityOptions .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedQuality = btn.getAttribute('data-quality');
      });
    });

    // Format Toggle
    document.querySelectorAll('#formatOptions .option-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('#formatOptions .option-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFormat = btn.getAttribute('data-format');
      });
    });

    convertBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      convertBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        convertedImages = await PDFTools.PdfToJpg.convert(currentFile, {
          quality: selectedQuality,
          format: selectedFormat
        }, function (percent, text) {
          progress.update(percent, text);
        });

        progress.hide();
        optionsPanel.style.display = 'none';
        document.getElementById('fileList').style.display = 'none';
        actionBar.classList.remove('active');

        document.getElementById('resPageCount').textContent = convertedImages.length;

        // Render individual image tiles
        imagePreviewGrid.innerHTML = '';
        convertedImages.forEach(img => {
          const card = document.createElement('div');
          card.className = 'image-preview-card';

          const previewDiv = document.createElement('div');
          previewDiv.className = 'image-preview-img';
          const imgEl = document.createElement('img');
          imgEl.src = img.dataUrl;
          previewDiv.appendChild(imgEl);

          const info = document.createElement('div');
          info.className = 'image-preview-info';
          info.innerHTML = `<span>Page ${img.pageNum}</span>`;

          const dl = document.createElement('button');
          dl.type = 'button';
          dl.className = 'image-preview-download';
          dl.setAttribute('aria-label', `Save Page ${img.pageNum}`);
          dl.innerHTML = `
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
              <polyline points="7 10 12 15 17 10"/>
              <line x1="12" y1="15" x2="12" y2="3"/>
            </svg>
            <span>Save</span>
          `;
          dl.addEventListener('click', () => {
            PDFTools.Download.save(img.blob, img.name);
          });

          info.appendChild(dl);
          card.appendChild(previewDiv);
          card.appendChild(info);
          imagePreviewGrid.appendChild(card);
        });

        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'PDF to JPG', 'image');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.pdf_jpg_success'));
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

    downloadZipBtn.addEventListener('click', function () {
      if (convertedImages.length > 0) {
        const zipFiles = convertedImages.map(img => ({
          name: img.name,
          data: img.blob
        }));
        const baseName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'images';
        PDFTools.Download.saveAsZip(zipFiles, `${baseName}_images.zip`);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (currentFile) {
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(currentFile);
          }
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      fileList.clear();
      convertedImages = [];
      currentFile = null;
      convertBtn.disabled = false;
      resultArea.classList.remove('active');
      document.getElementById('fileList').style.display = 'flex';
      dropzoneEl.style.display = 'block';
      imagePreviewGrid.innerHTML = '';
    });
  });
})();
