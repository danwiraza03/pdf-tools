/**
 * PDF Tools — Batch Processing Standalone Page Controller
 * Extracted from pages/batch.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    // State
    let fileQueue = []; // [{ id, file, status: 'pending'|'processing'|'done'|'error', resultBytes, errorMsg }]
    let activeOperation = 'compress';

    // DOM Elements
    const queueCountBadge = document.getElementById('queueCountBadge');
    const queueEmptyArea = document.getElementById('queueEmptyArea');
    const fileQueueList = document.getElementById('fileQueueList');
    const batchFileInput = document.getElementById('batchFileInput');
    const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
    const clearQueueBtn = document.getElementById('clearQueueBtn');
    const startBatchBtn = document.getElementById('startBatchBtn');
    const downloadZipBtn = document.getElementById('downloadZipBtn');
    const globalProgressCard = document.getElementById('globalProgressCard');
    const globalProgressBar = document.getElementById('globalProgressBar');
    const globalProgressPercent = document.getElementById('globalProgressPercent');
    const globalProgressLabel = document.getElementById('globalProgressLabel');

    // Operation Sub-Panels
    const subPanels = {
      compress: document.getElementById('settingsCompress'),
      grayscale: document.getElementById('settingsGrayscale'),
      watermark: document.getElementById('settingsWatermark'),
      flatten: document.getElementById('settingsFlatten'),
      protect: document.getElementById('settingsProtect')
    };

    // File Add Handlers
    addMoreFilesBtn.addEventListener('click', () => batchFileInput.click());
    queueEmptyArea.addEventListener('click', () => batchFileInput.click());

    batchFileInput.addEventListener('change', e => {
      if (e.target.files) addFilesToQueue(Array.from(e.target.files));
      batchFileInput.value = '';
    });

    ['dragenter', 'dragover'].forEach(evt => {
      queueEmptyArea.addEventListener(evt, e => { e.preventDefault(); queueEmptyArea.classList.add('drag-over'); });
    });
    ['dragleave', 'drop'].forEach(evt => {
      queueEmptyArea.addEventListener(evt, e => { e.preventDefault(); queueEmptyArea.classList.remove('drag-over'); });
    });
    queueEmptyArea.addEventListener('drop', e => {
      if (e.dataTransfer.files) addFilesToQueue(Array.from(e.dataTransfer.files));
    });

    function addFilesToQueue(files) {
      const validPdfs = files.filter(f => f.name.toLowerCase().endsWith('.pdf'));
      if (validPdfs.length === 0) {
        if (PDFTools.Toast) PDFTools.Toast.error('Please upload valid PDF files.');
        return;
      }

      validPdfs.forEach(file => {
        fileQueue.push({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
          file: file,
          status: 'pending',
          resultBytes: null,
          errorMsg: null
        });
      });

      renderQueue();
      if (PDFTools.Toast) PDFTools.Toast.success(`Added ${validPdfs.length} file(s) to batch queue.`);
    }

    function renderQueue() {
      const total = fileQueue.length;
      queueCountBadge.textContent = `${total} file${total !== 1 ? 's' : ''}`;

      if (total === 0) {
        queueEmptyArea.style.display = 'block';
        fileQueueList.style.display = 'none';
        startBatchBtn.disabled = true;
        downloadZipBtn.style.display = 'none';
        return;
      }

      queueEmptyArea.style.display = 'none';
      fileQueueList.style.display = 'flex';
      startBatchBtn.disabled = false;

      fileQueueList.innerHTML = '';
      fileQueue.forEach(item => {
        const row = document.createElement('div');
        row.className = 'queue-item';
        row.id = `row_${item.id}`;

        let badgeClass = 'badge-pending';
        let badgeText = 'Pending';
        if (item.status === 'processing') { badgeClass = 'badge-processing'; badgeText = 'Processing...'; }
        else if (item.status === 'done') { badgeClass = 'badge-done'; badgeText = 'Done'; }
        else if (item.status === 'error') { badgeClass = 'badge-error'; badgeText = 'Failed'; }

        row.innerHTML = `
          <div class="queue-item-info">
            <div class="queue-item-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="color: var(--tool-color);"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div class="queue-item-meta">
              <div class="queue-item-name" title="${item.file.name}">${item.file.name}</div>
              <div class="queue-item-sub">
                <span>${PDFTools.FileUtils.formatSize(item.file.size)}</span>
                ${item.resultBytes ? `<span>&rarr; <strong>${PDFTools.FileUtils.formatSize(item.resultBytes.length)}</strong></span>` : ''}
              </div>
            </div>
          </div>
          <div class="queue-item-status">
            <span class="badge-status ${badgeClass}" id="badge_${item.id}">${badgeText}</span>
            ${item.resultBytes ? `<button type="button" class="btn btn-ghost btn-sm" id="dl_${item.id}" title="Download this file" style="padding: 4px 8px; display: inline-flex; align-items: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg></button>` : ''}
            <button type="button" class="btn-item-del" data-id="${item.id}" title="Remove file" style="display: inline-flex; align-items: center;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
          </div>
        `;

        // Delete action
        row.querySelector('.btn-item-del').addEventListener('click', (e) => {
          const id = e.currentTarget.dataset.id;
          fileQueue = fileQueue.filter(f => f.id !== id);
          renderQueue();
        });

        // Single file download action
        if (item.resultBytes) {
          const singleDl = row.querySelector(`#dl_${item.id}`);
          if (singleDl) {
            singleDl.addEventListener('click', () => {
              const blob = new Blob([item.resultBytes], { type: 'application/pdf' });
              saveAs(blob, getResultFileName(item.file.name, activeOperation));
            });
          }
        }

        fileQueueList.appendChild(row);
      });
    }

    clearQueueBtn.addEventListener('click', () => {
      if (fileQueue.length === 0) return;
      fileQueue = [];
      renderQueue();
      globalProgressCard.style.display = 'none';
    });

    // Operation Switching
    document.querySelectorAll('.op-radio-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.op-radio-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        const radio = card.querySelector('input');
        radio.checked = true;
        activeOperation = card.dataset.op;

        // Toggle sub-panels
        Object.keys(subPanels).forEach(key => {
          subPanels[key].style.display = key === activeOperation ? 'block' : 'none';
        });
      });
    });

    // Start Batch Processing
    startBatchBtn.addEventListener('click', async () => {
      if (fileQueue.length === 0) return;

      startBatchBtn.disabled = true;
      const startBatchText = document.getElementById('startBatchText');
      if (startBatchText) startBatchText.textContent = 'Processing Queue...';
      downloadZipBtn.style.display = 'none';

      globalProgressCard.style.display = 'block';
      globalProgressBar.style.width = '0%';
      globalProgressPercent.textContent = '0%';

      const totalFiles = fileQueue.length;
      let completedFiles = 0;

      for (let i = 0; i < totalFiles; i++) {
        const item = fileQueue[i];
        item.status = 'processing';
        updateItemStatusBadge(item);
        globalProgressLabel.textContent = `Processing (${i + 1}/${totalFiles}): ${item.file.name}...`;

        try {
          const result = await processSingleFile(item.file, activeOperation);
          item.resultBytes = result;
          item.status = 'done';
        } catch (err) {
          console.error(`Batch process failed for ${item.file.name}:`, err);
          item.status = 'error';
          item.errorMsg = err.message;
        }

        completedFiles++;
        const pct = Math.round((completedFiles / totalFiles) * 100);
        globalProgressBar.style.width = `${pct}%`;
        globalProgressPercent.textContent = `${pct}%`;

        updateItemStatusBadge(item);
      }

      startBatchBtn.disabled = false;
      if (startBatchText) startBatchText.textContent = 'Start Batch Processing';
      globalProgressLabel.textContent = `Completed! Processed ${completedFiles} file(s).`;

      renderQueue();

      const successCount = fileQueue.filter(f => f.status === 'done').length;
      if (successCount > 0) {
        downloadZipBtn.style.display = 'inline-flex';
        if (PDFTools.Toast) PDFTools.Toast.success(`Batch complete! ${successCount} file(s) ready.`);
      } else {
        if (PDFTools.Toast) PDFTools.Toast.error('Batch processing completed with errors.');
      }
    });

    function updateItemStatusBadge(item) {
      const badge = document.getElementById(`badge_${item.id}`);
      if (!badge) return;
      badge.className = `badge-status badge-${item.status}`;
      if (item.status === 'processing') badge.textContent = 'Processing...';
      else if (item.status === 'done') badge.textContent = 'Done';
      else if (item.status === 'error') badge.textContent = 'Failed';
      else badge.textContent = 'Pending';
    }

    async function processSingleFile(file, operation) {
      if (operation === 'compress') {
        const level = document.getElementById('compressLevelSelect').value;
        return await PDFTools.Compress.compress(file, level === 'extreme' ? 0.45 : 0.75);
      } else if (operation === 'grayscale') {
        const mode = document.getElementById('grayscaleModeSelect').value;
        return await PDFTools.Grayscale.convertToGrayscale(file, { mode: mode, quality: 'high' });
      } else if (operation === 'watermark') {
        const text = document.getElementById('wmTextInput').value || 'CONFIDENTIAL';
        const color = document.getElementById('wmColorInput').value || '#EF4444';
        const opacity = parseFloat(document.getElementById('wmOpacitySelect').value) || 0.30;
        return await PDFTools.Watermark.applyWatermark(file, {
          text: text,
          color: color,
          opacity: opacity,
          rotation: 45,
          fontSize: 48,
          position: 'center'
        });
      } else if (operation === 'flatten') {
        const mode = document.getElementById('flattenModeSelect').value;
        return await PDFTools.Flatten.flattenPdf(file, { mode: mode });
      } else if (operation === 'protect') {
        const pass = document.getElementById('protectPassInput').value;
        if (!pass) throw new Error('Password cannot be empty');
        return await PDFTools.Protect.protectPdf(file, pass, pass);
      }
      throw new Error('Unknown operation');
    }

    function getResultFileName(originalName, operation) {
      const base = originalName.replace(/\.pdf$/i, '');
      const suffix = {
        compress: '_compressed.pdf',
        grayscale: '_grayscale.pdf',
        watermark: '_watermarked.pdf',
        flatten: '_flattened.pdf',
        protect: '_protected.pdf'
      }[operation] || '_processed.pdf';
      return base + suffix;
    }

    // Download All as ZIP Archive
    downloadZipBtn.addEventListener('click', async () => {
      downloadZipBtn.disabled = true;
      const downloadZipText = document.getElementById('downloadZipText');
      if (downloadZipText) downloadZipText.textContent = 'Compressing ZIP...';

      try {
        const zip = new JSZip();
        fileQueue.filter(f => f.status === 'done' && f.resultBytes).forEach(item => {
          const fileName = getResultFileName(item.file.name, activeOperation);
          zip.file(fileName, item.resultBytes);
        });

        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `batch_${activeOperation}_results.zip`);

        if (PDFTools.Toast) PDFTools.Toast.success('Downloaded ZIP archive with all processed PDFs!');
      } catch (zipErr) {
        console.error('ZIP generation error:', zipErr);
        if (PDFTools.Toast) PDFTools.Toast.error('Failed to create ZIP: ' + zipErr.message);
      } finally {
        downloadZipBtn.disabled = false;
        if (downloadZipText) downloadZipText.textContent = 'Download All as ZIP';
      }
    });
  });
})();
