/**
 * PDF Tools — PDF to Word (DOCX) Standalone Page Controller
 * Extracted from pages/pdf-to-docx.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let currentFile = null;
    let convertedDocxBlob = null;

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileMetaLabel = document.getElementById('fileMetaLabel');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const thumbCanvas = document.getElementById('thumbCanvas');
    const convertBtn = document.getElementById('convertBtn');
    const progressBox = document.getElementById('progressBox');
    const progressFill = document.getElementById('progressFill');
    const progressStatusLabel = document.getElementById('progressStatusLabel');
    const progressPercentLabel = document.getElementById('progressPercentLabel');
    const downloadReadyArea = document.getElementById('downloadReadyArea');
    const downloadDocxBtn = document.getElementById('downloadDocxBtn');

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => {
      if (e.target.files && e.target.files[0]) handleFile(e.target.files[0]);
    });
    ['dragenter', 'dragover'].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      dropzone.addEventListener(evt, e => { e.preventDefault(); dropzone.classList.remove('drag-over'); });
    });
    dropzone.addEventListener('drop', e => {
      if (e.dataTransfer.files && e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    });

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: false,
        enabled: () => Boolean(currentFile),
        onFiles: async (files) => {
          if (files && files[0]) await handleFile(files[0]);
        }
      });
    }

    changeFileBtn.addEventListener('click', () => {
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
      currentFile = null;
      convertedDocxBlob = null;
      fileInput.value = '';
    });

    // Check pending file
    (async function checkPending() {
      if (window.PDFTools && PDFTools.FileUtils && PDFTools.FileUtils.getPendingFile) {
        const pending = await PDFTools.FileUtils.getPendingFile();
        if (pending) handleFile(pending);
      }
    })();

    async function handleFile(file) {
      if (!file.name.toLowerCase().endsWith('.pdf')) {
        if (PDFTools.Toast) PDFTools.Toast.error('Please select a valid PDF file.');
        return;
      }

      currentFile = file;
      fileNameLabel.textContent = file.name;
      downloadReadyArea.style.display = 'none';
      convertBtn.style.display = 'block';
      convertBtn.disabled = false;
      progressBox.style.display = 'none';

      if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
        PDFTools.FileUtils.initPdfJsWorker();
      }

      // Render page 1 thumbnail
      try {
        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
        const pdf = await loadingTask.promise;
        const page = await pdf.getPage(1);
        const viewport = page.getViewport({ scale: 0.5 });

        thumbCanvas.width = viewport.width;
        thumbCanvas.height = viewport.height;
        const ctx = thumbCanvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, viewport.width, viewport.height);

        await page.render({ canvasContext: ctx, viewport }).promise;

        fileMetaLabel.textContent = `${PDFTools.FileUtils.formatSize(file.size)} • ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}`;
      } catch (err) {
        fileMetaLabel.textContent = `${PDFTools.FileUtils.formatSize(file.size)}`;
      }

      uploadState.style.display = 'none';
      workspaceState.style.display = 'block';
    }

    // Convert Button
    convertBtn.addEventListener('click', async () => {
      if (!currentFile) return;

      convertBtn.disabled = true;
      progressBox.style.display = 'block';
      progressFill.style.width = '0%';
      progressPercentLabel.textContent = '0%';

      try {
        convertedDocxBlob = await PDFTools.PdfToDocx.convertToDocx(currentFile, {
          onProgress: (percent, message) => {
            progressFill.style.width = `${percent}%`;
            progressPercentLabel.textContent = `${percent}%`;
            progressStatusLabel.textContent = message;
          }
        });

        convertBtn.style.display = 'none';
        downloadReadyArea.style.display = 'block';

        if (PDFTools.Toast) PDFTools.Toast.success('Conversion to Word (.docx) successful!');

        if (PDFTools.RecentFiles) {
          PDFTools.RecentFiles.add({
            name: currentFile.name,
            tool: 'PDF to Word',
            size: PDFTools.FileUtils.formatSize(convertedDocxBlob.size),
            icon: 'W'
          });
        }
      } catch (err) {
        console.error('PDF to Word error:', err);
        if (PDFTools.Toast) PDFTools.Toast.error('Conversion failed: ' + err.message);
        convertBtn.disabled = false;
      }
    });

    // Download Button
    downloadDocxBtn.addEventListener('click', () => {
      if (!convertedDocxBlob || !currentFile) return;
      const docxName = currentFile.name.replace(/\.pdf$/i, '') + '.docx';
      saveAs(convertedDocxBlob, docxName);
      if (PDFTools.Toast) PDFTools.Toast.success(`Downloaded: ${docxName}`);
    });

    // Open in PDF Studio Button
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
  });
})();
