/**
 * PDF Tools — Flatten PDF Standalone Page Controller
 * Extracted from pages/flatten.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let selectedFile = null;

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

    async function handleFile(file) {
      selectedFile = file;
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = `${PDFTools.FileUtils.formatFileSize(file.size)}`;

      uploadState.style.display = 'none';
      workspaceState.style.display = 'block';
      PDFTools.Toast.success('PDF loaded successfully!');
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

    // Handle pending file from universal handoff
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

    // Flatten mode radio toggle styles
    document.querySelectorAll('input[name="flattenMode"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const isVector = radio.value === 'vector';
        optVectorCard.style.borderColor = isVector ? 'var(--primary-color)' : 'var(--border-color)';
        optVectorCard.style.background = isVector ? 'rgba(26,115,232,0.06)' : 'transparent';
        optRasterCard.style.borderColor = !isVector ? 'var(--primary-color)' : 'var(--border-color)';
        optRasterCard.style.background = !isVector ? 'rgba(26,115,232,0.06)' : 'transparent';
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
