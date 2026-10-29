/**
 * PDF Tools — Compress PDF Standalone Page Controller
 * Extracted from pages/compress.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const addMoreBtn = document.getElementById('addMoreBtn');
    const extraFileInput = document.getElementById('extraFileInput');
    const optionsPanel = document.getElementById('optionsPanel');
    const actionBar = document.getElementById('actionBar');
    const compressBtn = document.getElementById('compressBtn');
    const resultArea = document.getElementById('resultArea');
    const resultTitle = document.getElementById('resultTitle');
    const resultsList = document.getElementById('resultsList');
    const downloadMainBtn = document.getElementById('downloadMainBtn');
    const resetBtn = document.getElementById('resetBtn');
    const sigNotice = document.getElementById('sigNotice');

    let selectedLevel = 'medium';
    let compressedResults = []; // array of { file, bytes, originalSize, newSize, savedPercent, method }
    let rawFiles = [];

    const progress = PDFTools.Progress('progressBar');

    const fileList = PDFTools.FileList('fileList', {
      onFilesChange: function () {
        rawFiles = fileList.getFiles();
        if (rawFiles.length > 0) {
          dropzoneEl.style.display = 'none';
          document.getElementById('fileList').style.display = 'flex';
          addMoreBtn.style.display = 'flex';
          optionsPanel.style.display = 'block';
          actionBar.classList.add('active');
          resultArea.classList.remove('active');

          const compressText = rawFiles.length > 1 
            ? `${PDFTools.i18n.t('action.compress')} (${rawFiles.length})` 
            : PDFTools.i18n.t('action.compress');
          compressBtn.textContent = compressText;
        } else {
          dropzoneEl.style.display = 'block';
          addMoreBtn.style.display = 'none';
          optionsPanel.style.display = 'none';
          actionBar.classList.remove('active');
        }
      }
    });

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: true,
      onFiles: function (files) {
        fileList.addFiles(files);
      }
    });

    addMoreBtn.addEventListener('click', () => extraFileInput.click());
    extraFileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        fileList.addFiles(Array.from(e.target.files));
        extraFileInput.value = '';
      }
    });

    // Level selection
    document.querySelectorAll('.compress-level').forEach(el => {
      el.addEventListener('click', function () {
        document.querySelectorAll('.compress-level').forEach(c => c.classList.remove('active'));
        el.classList.add('active');
        selectedLevel = el.getAttribute('data-level');
      });
    });

    // Compress action
    compressBtn.addEventListener('click', async function () {
      if (!rawFiles || rawFiles.length === 0) return;

      compressBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));
      compressedResults = [];

      const totalFiles = rawFiles.length;
      let totalOriginal = 0;
      let totalNew = 0;

      try {
        for (let i = 0; i < totalFiles; i++) {
          const file = rawFiles[i];
          const baseProgress = (i / totalFiles) * 100;
          const stepWeight = 100 / totalFiles;

          const res = await PDFTools.Compress.compress(file, selectedLevel, function (percent, text) {
            const overallPercent = Math.round(baseProgress + ((percent / 100) * stepWeight));
            const prefix = totalFiles > 1 ? `[${i + 1}/${totalFiles}] ` : '';
            progress.update(overallPercent, `${prefix}${text}`);
          });

          compressedResults.push({
            file: file,
            bytes: res.bytes,
            originalSize: res.originalSize,
            newSize: res.newSize,
            savedPercent: res.savedPercent,
            method: res.method,
            docType: res.docType || 'TEXT_VECTOR',
            dpiUsed: res.dpiUsed || 150,
            profile: res.profile || selectedLevel,
            hadSignatures: res.hadSignatures || false,
            signaturesRemoved: res.signaturesRemoved || 0
          });

          totalOriginal += res.originalSize;
          totalNew += res.newSize;
        }

        progress.hide();
        optionsPanel.style.display = 'none';
        addMoreBtn.style.display = 'none';
        document.getElementById('fileList').style.display = 'none';
        actionBar.classList.remove('active');

        // Render summary stats
        const totalSavedPercent = Math.max(0, Math.round(((totalOriginal - totalNew) / totalOriginal) * 100));
        document.getElementById('resOrigSize').textContent = PDFTools.FileUtils.formatSize(totalOriginal);
        document.getElementById('resNewSize').textContent = PDFTools.FileUtils.formatSize(totalNew);
        if (totalSavedPercent > 0) {
          document.getElementById('resSaved').textContent = `-${totalSavedPercent}%`;
          document.getElementById('resSaved').style.color = '#8FBC5D';
        } else {
          document.getElementById('resSaved').textContent = `0% (Optimal)`;
          document.getElementById('resSaved').style.color = '#4A90D9';
        }

        if (totalFiles > 1) {
          resultTitle.textContent = PDFTools.i18n.t('result.compress_multi_success');
          downloadMainBtn.textContent = PDFTools.i18n.t('action.download_all');
        } else {
          resultTitle.textContent = PDFTools.i18n.t('result.compress_success');
          downloadMainBtn.textContent = PDFTools.i18n.t('action.download');
        }

        // Show digital signature removal notice if any file had signatures
        const anyHadSigs = compressedResults.some(r => r.hadSignatures);
        if (anyHadSigs) {
          sigNotice.style.display = 'flex';
        } else {
          sigNotice.style.display = 'none';
        }

        // Render individual file result cards
        renderResultsList();

        // Log to Recent Documents Store (B3)
        compressedResults.forEach(item => {
          if (PDFTools.RecentFiles) {
            PDFTools.RecentFiles.add(item.file.name, item.newSize, 'Compress PDF', 'compress');
          }
        });

        resultArea.classList.add('active');
        PDFTools.Toast.success(totalSavedPercent > 0 ? PDFTools.i18n.t('result.compress_success') : 'Files are already at optimal size!');
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        compressBtn.disabled = false;
      }
    });

    function renderResultsList() {
      resultsList.innerHTML = '';

      compressedResults.forEach((item) => {
        const card = document.createElement('div');
        card.className = 'result-item-card';

        const mainRow = document.createElement('div');
        mainRow.className = 'result-item-main';

        const info = document.createElement('div');
        info.className = 'result-item-info';

        const icon = document.createElement('div');
        icon.className = 'result-item-icon';
        icon.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`;

        const details = document.createElement('div');
        details.className = 'result-item-details';

        const name = document.createElement('div');
        name.className = 'result-item-name';
        name.textContent = item.file.name;
        name.title = item.file.name;

        const typeLabel = item.docType === 'IMAGE_SCAN' ? (PDFTools.i18n.t('compress.doc_type_scan') || 'Scanned')
          : (item.docType === 'TEXT_VECTOR' ? (PDFTools.i18n.t('compress.doc_type_text') || 'Vector Text')
          : (PDFTools.i18n.t('compress.doc_type_mixed') || 'Mixed'));

        const sizes = document.createElement('div');
        sizes.className = 'result-item-sizes';
        sizes.innerHTML = `
          <span>${PDFTools.FileUtils.formatSize(item.originalSize)}</span>
          <span style="opacity: 0.5;">→</span>
          <strong style="color: var(--color-compress, #10B981);">${PDFTools.FileUtils.formatSize(item.newSize)}</strong>
          <span class="result-item-badge ${item.savedPercent > 0 ? 'saved' : 'optimal'}">
            ${item.savedPercent > 0 ? `-${item.savedPercent}%` : 'Optimal'}
          </span>
          <span class="result-item-badge optimal" title="${typeLabel} • ${item.dpiUsed || 150} DPI">
            ${typeLabel} • ${item.dpiUsed || 150} DPI
          </span>
          ${item.hadSignatures ? `<span class="result-item-badge sig-badge" style="display:inline-flex;align-items:center;gap:4px;"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> ${PDFTools.i18n.t('compress.sig_removed')}</span>` : ''}
        `;

        details.appendChild(name);
        details.appendChild(sizes);
        info.appendChild(icon);
        info.appendChild(details);

        const actions = document.createElement('div');
        actions.className = 'result-item-actions';

        // Before / After Preview Button (B4)
        const previewBtn = document.createElement('button');
        previewBtn.className = 'btn btn-ghost btn-sm';
        previewBtn.style.display = 'inline-flex';
        previewBtn.style.alignItems = 'center';
        previewBtn.style.gap = '6px';
        previewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Quality Compare</span>`;
        previewBtn.title = 'Compare Visual Quality Before vs After';

        let previewContainer = null;
        previewBtn.addEventListener('click', async function () {
          if (previewContainer) {
            previewContainer.remove();
            previewContainer = null;
            previewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg><span>Quality Compare</span>`;
            return;
          }

          previewBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg><span>Close Preview</span>';
          previewContainer = document.createElement('div');
          previewContainer.className = 'quality-compare-container';
          previewContainer.style.cssText = 'width: 100%; display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 14px; padding-top: 16px; border-top: 1px solid var(--border-color); text-align: center;';

          const origBox = document.createElement('div');
          origBox.innerHTML = `<div style="font-size: 0.82rem; font-weight: 700; color: var(--text-muted); margin-bottom: 8px;">ORIGINAL (${PDFTools.FileUtils.formatSize(item.originalSize)})</div><canvas style="width: 100%; max-height: 280px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #fff; box-shadow: var(--shadow-sm);"></canvas>`;
          
          const compBox = document.createElement('div');
          compBox.innerHTML = `<div style="font-size: 0.82rem; font-weight: 700; color: var(--color-compress, #10B981); margin-bottom: 8px;">COMPRESSED (${PDFTools.FileUtils.formatSize(item.newSize)})</div><canvas style="width: 100%; max-height: 280px; object-fit: contain; border-radius: var(--radius-sm); border: 1px solid var(--border-color); background: #fff; box-shadow: var(--shadow-sm);"></canvas>`;

          previewContainer.appendChild(origBox);
          previewContainer.appendChild(compBox);
          card.appendChild(previewContainer);

          if (PDFTools.Preview && PDFTools.Preview.renderThumbnail) {
            PDFTools.Preview.renderThumbnail(item.file, origBox.querySelector('canvas'), 0.5);
            PDFTools.Preview.renderThumbnail(item.bytes, compBox.querySelector('canvas'), 0.5);
          }
        });
        actions.appendChild(previewBtn);

        // Individual Download PDF Button
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'btn btn-secondary btn-sm';
        downloadBtn.style.display = 'inline-flex';
        downloadBtn.style.alignItems = 'center';
        downloadBtn.style.gap = '6px';
        downloadBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg><span>PDF</span>`;
        downloadBtn.title = 'Download single PDF';
        downloadBtn.addEventListener('click', function () {
          const baseName = item.file.name.replace(/\.pdf$/i, '');
          PDFTools.Download.save(item.bytes, `${baseName}_compressed.pdf`);
        });
        actions.appendChild(downloadBtn);

        mainRow.appendChild(info);
        mainRow.appendChild(actions);
        card.appendChild(mainRow);
        resultsList.appendChild(card);
      });
    }

    // Open in PDF Studio Action
    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', function () {
        if (!compressedResults || compressedResults.length === 0) return;
        const first = compressedResults[0];
        const blob = new Blob([first.bytes], { type: 'application/pdf' });
        const file = new File([blob], first.file.name, { type: 'application/pdf' });
        if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
          PDFTools.FileUtils.setPendingFile(file);
        }
        window.location.href = 'viewer.html';
      });
    }

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) {
          fileList.addFiles([file]);
        }
      });
    }

    // Download Main Action (ZIP for multiple, single PDF for one)
    downloadMainBtn.addEventListener('click', async function () {
      if (!compressedResults || compressedResults.length === 0) return;

      if (compressedResults.length === 1) {
        const item = compressedResults[0];
        const baseName = item.file.name.replace(/\.pdf$/i, '');
        PDFTools.Download.save(item.bytes, `${baseName}_compressed.pdf`);
      } else {
        // Multi-file ZIP download
        downloadMainBtn.disabled = true;
        const origText = downloadMainBtn.textContent;
        downloadMainBtn.textContent = PDFTools.i18n.t('action.processing');

        try {
          const zip = new JSZip();
          compressedResults.forEach((item) => {
            const baseName = item.file.name.replace(/\.pdf$/i, '');
            zip.file(`${baseName}_compressed.pdf`, item.bytes);
          });

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'compressed_documents.zip');
          PDFTools.Toast.success('ZIP package downloaded!');
        } catch (e) {
          console.error('ZIP generation error:', e);
          PDFTools.Toast.error('Failed to create ZIP package.');
        } finally {
          downloadMainBtn.disabled = false;
          downloadMainBtn.textContent = origText;
        }
      }
    });

    // Reset
    resetBtn.addEventListener('click', function () {
      fileList.clear();
      compressedResults = [];
      rawFiles = [];
      compressBtn.disabled = false;
      resultArea.classList.remove('active');
      sigNotice.style.display = 'none';
      document.getElementById('fileList').style.display = 'flex';
      dropzoneEl.style.display = 'block';
    });
  });
})();
