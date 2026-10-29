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

    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileMetaLabel = document.getElementById('fileMetaLabel');
    const liveMarker = document.getElementById('liveMarker');

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

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: true,
      onFiles: async function (files) {
        if (files.length > 0) {
          queuedFiles = files;
          currentFile = files[0];
          isBatchMode = files.length > 1;

          try {
            const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(currentFile);
            totalDocPages = pdfDoc.getPages().length;

            if (isBatchMode) {
              fileMetaLabel.textContent = `Batch Queue: ${files.length} Files Selected • Primary: ${currentFile.name}`;
              applyPageNumbersBtn.textContent = `Number ${files.length} Documents & Download (.ZIP)`;
            } else {
              fileMetaLabel.textContent = `${currentFile.name} • ${totalDocPages} Pages • ${PDFTools.FileUtils.formatSize(currentFile.size)}`;
              applyPageNumbersBtn.textContent = 'Apply Page Numbers & Download';
            }
            startPageInput.max = totalDocPages;

            uploadState.style.display = 'none';
            workspaceState.style.display = 'block';
            updateLivePreview();
          } catch (err) {
            PDFTools.Toast.error('Could not load PDF file.');
          }
        }
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(async file => {
        if (file) {
          queuedFiles = [file];
          currentFile = file;
          isBatchMode = false;
          try {
            const pdfDoc = await PDFTools.FileUtils.loadPdfDecrypted(currentFile);
            totalDocPages = pdfDoc.getPages().length;
            fileMetaLabel.textContent = `${currentFile.name} • ${totalDocPages} Pages • ${PDFTools.FileUtils.formatSize(currentFile.size)}`;
            startPageInput.max = totalDocPages;
            uploadState.style.display = 'none';
            workspaceState.style.display = 'block';
            updateLivePreview();
          } catch (err) {}
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

    [customTextInput, fontSizeSelect, fontFamilySelect, colorPicker, startNumberInput].forEach(el => {
      el.addEventListener('input', updateLivePreview);
      el.addEventListener('change', updateLivePreview);
    });

    function updateLivePreview() {
      const fmt = formatSelect.value;
      const startNum = parseInt(startNumberInput.value || 1, 10);
      let previewText = '';

      if (fmt === 'number_only') {
        previewText = `${startNum}`;
      } else if (fmt === 'page_of_total') {
        previewText = `Page ${startNum} of ${totalDocPages}`;
      } else if (fmt === 'halaman_dari') {
        previewText = `Halaman ${startNum} dari ${totalDocPages}`;
      } else {
        previewText = (customTextInput.value || 'Page {n}')
          .replace(/\{n\}/g, `${startNum}`)
          .replace(/\{total\}/g, `${totalDocPages}`);
      }

      liveMarker.textContent = previewText;
      liveMarker.style.fontSize = `${Math.min(18, parseInt(fontSizeSelect.value, 10) * 1.2)}px`;
      liveMarker.style.color = colorPicker.value;
      liveMarker.style.fontFamily = fontFamilySelect.value === 'TimesRoman' ? 'Times New Roman, serif' : (fontFamilySelect.value === 'Courier' ? 'Courier, monospace' : 'Helvetica, sans-serif');

      // Reset positions
      liveMarker.style.top = '';
      liveMarker.style.bottom = '';
      liveMarker.style.left = '';
      liveMarker.style.right = '';
      liveMarker.style.transform = '';

      if (selectedPosition === 'top_left') {
        liveMarker.style.top = '16px';
        liveMarker.style.left = '16px';
      } else if (selectedPosition === 'top_center') {
        liveMarker.style.top = '16px';
        liveMarker.style.left = '50%';
        liveMarker.style.transform = 'translateX(-50%)';
      } else if (selectedPosition === 'top_right') {
        liveMarker.style.top = '16px';
        liveMarker.style.right = '16px';
      } else if (selectedPosition === 'bottom_left') {
        liveMarker.style.bottom = '16px';
        liveMarker.style.left = '16px';
      } else if (selectedPosition === 'bottom_center') {
        liveMarker.style.bottom = '16px';
        liveMarker.style.left = '50%';
        liveMarker.style.transform = 'translateX(-50%)';
      } else {
        liveMarker.style.bottom = '16px';
        liveMarker.style.right = '16px';
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
      lastNumberedBytes = null;
      if (openStudioBtn) openStudioBtn.style.display = 'none';
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
    });
  });
})();
