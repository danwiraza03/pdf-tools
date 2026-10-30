/**
 * PDF Tools — Excel (XLSX) to PDF Standalone Page Controller
 * Extracted from pages/xlsx-to-pdf.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    let currentFile = null;
    let convertedPdfBlob = null;

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('fileInput');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileSizeLabel = document.getElementById('fileSizeLabel');
    const changeFileBtn = document.getElementById('changeFileBtn');
    const convertBtn = document.getElementById('convertBtn');
    const progressBox = document.getElementById('progressBox');
    const progressFill = document.getElementById('progressFill');
    const progressStatusLabel = document.getElementById('progressStatusLabel');
    const progressPercentLabel = document.getElementById('progressPercentLabel');
    const downloadReadyArea = document.getElementById('downloadReadyArea');
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    const openInStudioBtn = document.getElementById('openInStudioBtn');
    const resetBtn = document.getElementById('resetBtn');
    const orientationSelect = document.getElementById('orientationSelect');
    const pageSizeSelect = document.getElementById('pageSizeSelect');

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
        accept: '.xlsx',
        multiple: false,
        enabled: () => Boolean(currentFile),
        onFiles: async (files) => {
          if (files && files[0]) handleFile(files[0]);
        }
      });
    }

    function handleFile(file) {
      if (!file.name.toLowerCase().endsWith('.xlsx')) {
        if (PDFTools.Toast) PDFTools.Toast.error('Please select a valid Excel workbook (.xlsx).');
        return;
      }
      currentFile = file;
      fileNameLabel.textContent = file.name;
      fileSizeLabel.textContent = PDFTools.FileUtils ? PDFTools.FileUtils.formatSize(file.size) : `${(file.size / 1024).toFixed(1)} KB`;

      uploadState.style.display = 'none';
      workspaceState.style.display = 'block';
      downloadReadyArea.style.display = 'none';
      convertBtn.style.display = 'block';
      convertBtn.disabled = false;
      progressBox.style.display = 'none';
    }

    changeFileBtn.addEventListener('click', () => {
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
      currentFile = null;
      convertedPdfBlob = null;
      fileInput.value = '';
    });

    resetBtn.addEventListener('click', () => {
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
      currentFile = null;
      convertedPdfBlob = null;
      fileInput.value = '';
    });

    convertBtn.addEventListener('click', async () => {
      if (!currentFile) return;

      convertBtn.disabled = true;
      progressBox.style.display = 'block';
      progressFill.style.width = '0%';
      progressPercentLabel.textContent = '0%';

      try {
        convertedPdfBlob = await PDFTools.XlsxToPdf.convertToPdf(currentFile, {
          orientation: orientationSelect.value,
          pageSize: pageSizeSelect.value,
          onProgress: (percent, msg) => {
            progressFill.style.width = `${percent}%`;
            progressPercentLabel.textContent = `${percent}%`;
            progressStatusLabel.textContent = msg;
          }
        });

        convertBtn.style.display = 'none';
        downloadReadyArea.style.display = 'block';
        if (PDFTools.Toast) PDFTools.Toast.success('Konversi Excel ke PDF berhasil!');
      } catch (err) {
        console.error(err);
        if (PDFTools.Toast) PDFTools.Toast.error('Gagal mengonversi: ' + err.message);
        convertBtn.disabled = false;
      }
    });

    downloadPdfBtn.addEventListener('click', () => {
      if (!convertedPdfBlob || !currentFile) return;
      const pdfName = currentFile.name.replace(/\.xlsx$/i, '') + '.pdf';
      if (window.saveAs) {
        saveAs(convertedPdfBlob, pdfName);
      } else {
        const a = document.createElement('a');
        const url = URL.createObjectURL(convertedPdfBlob);
        a.href = url;
        a.download = pdfName;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 100);
      }
    });

    openInStudioBtn.addEventListener('click', async () => {
      if (!convertedPdfBlob || !currentFile) return;
      const pdfName = currentFile.name.replace(/\.xlsx$/i, '') + '.pdf';
      const file = new File([convertedPdfBlob], pdfName, { type: 'application/pdf' });
      if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
        await PDFTools.FileUtils.setPendingFile(file);
      }
      window.location.href = 'viewer.html';
    });
  });
})();
