/**
 * PDF Tools — Watermark Standalone Page Controller
 * Extracted from pages/watermark.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
      const dropzoneEl = document.getElementById('dropzone');
      const optionsPanel = document.getElementById('optionsPanel');
      const actionBar = document.getElementById('actionBar');
      const applyBtn = document.getElementById('applyBtn');
      const previewBtn = document.getElementById('previewBtn');
      const previewSlot = document.getElementById('previewSlot');
      const resultPreviewSlot = document.getElementById('resultPreviewSlot');
      const resultArea = document.getElementById('resultArea');
      const downloadBtn = document.getElementById('downloadBtn');
      const resetBtn = document.getElementById('resetBtn');

      const wmResultPreviewCard = document.getElementById('wmResultPreviewCard');
      const wmResultCanvas = document.getElementById('wmResultCanvas');
      const wmPageNav = document.getElementById('wmPageNav');
      const wmPageIndicator = document.getElementById('wmPageIndicator');
      const prevWmPageBtn = document.getElementById('prevWmPageBtn');
      const nextWmPageBtn = document.getElementById('nextWmPageBtn');
      const wmBatchFileSelectorContainer = document.getElementById('wmBatchFileSelectorContainer');
      const wmBatchFileSelect = document.getElementById('wmBatchFileSelect');
      const openInStudioBtn = document.getElementById('openInStudioBtn');

      let wmResultPdfDoc = null;
      let currentWmPage = 1;
      let totalWmPages = 1;

      let currentFile = null;
      let selectedColor = '#e74c3c';
      let watermarkedData = null;
      const progress = PDFTools.Progress('progressBar');

      let queuedFiles = [];
      let isBatchMode = false;
      let batchResults = []; // [{ name: string, data: Uint8Array }]

      const fileList = new PDFTools.FileList('fileList', {
        showPreview: false,
        onFilesChange: function () {
          queuedFiles = fileList.getFiles();
          if (queuedFiles.length > 0) {
            currentFile = queuedFiles[0];
            isBatchMode = queuedFiles.length > 1;
            dropzoneEl.style.display = 'none';
            optionsPanel.style.display = 'block';
            actionBar.classList.add('active');
            resultArea.classList.remove('active');
            applyBtn.textContent = isBatchMode ? `Apply Watermark to ${queuedFiles.length} Files (ZIP)` : 'Apply Watermark';
          } else {
            currentFile = null;
            queuedFiles = [];
            dropzoneEl.style.display = 'block';
            optionsPanel.style.display = 'none';
            actionBar.classList.remove('active');
            if (wmResultPreviewCard) {
              wmResultPreviewCard.style.display = 'none';
              resultPreviewSlot.appendChild(wmResultPreviewCard);
            }
          }
        }
      });

      PDFTools.Dropzone('dropzone', {
        accept: '.pdf',
        multiple: true,
        onFiles: function (files) {
          fileList.clear();
          fileList.addFiles(files);
        }
      });

      // Watermark state
      let currentMode = 'text'; // 'text' | 'image'
      let selectedPosition = 'center';
      let selectedImageFile = null;
      let preparedImageData = null;

      const wmModeText = document.getElementById('wmModeText');
      const wmModeImage = document.getElementById('wmModeImage');
      const wmTextSection = document.getElementById('wmTextSection');
      const wmImageSection = document.getElementById('wmImageSection');
      const wmImageInput = document.getElementById('wmImageInput');
      const wmImageUploadBtn = document.getElementById('wmImageUploadBtn');
      const wmImageUploadPrompt = document.getElementById('wmImageUploadPrompt');
      const wmImageThumbContainer = document.getElementById('wmImageThumbContainer');
      const wmImageThumb = document.getElementById('wmImageThumb');
      const wmThumbName = document.getElementById('wmThumbName');
      const wmThumbMeta = document.getElementById('wmThumbMeta');
      const wmRemoveImageBtn = document.getElementById('wmRemoveImageBtn');
      const wmScaleRange = document.getElementById('wmScaleRange');
      const wmScaleNum = document.getElementById('wmScaleNum');
      const wmScaleVal = document.getElementById('wmScaleVal');
      const wmOpacityRange = document.getElementById('wmOpacityRange');
      const wmOpacityNum = document.getElementById('wmOpacityNum');
      const wmOpacityVal = document.getElementById('wmOpacityVal');
      const wmRotationRange = document.getElementById('wmRotationRange');
      const wmRotationNum = document.getElementById('wmRotationNum');
      const wmRotationVal = document.getElementById('wmRotationVal');
      const wmResetRotationBtn = document.getElementById('wmResetRotationBtn');
      const wmPosTile = document.getElementById('wmPosTile');

      // Debounce & cancellation for live preview (Requirement 3)
      let previewDebounceTimer = null;
      let activePreviewToken = 0;
      let isPreviewActive = false;
      let previewExecCount = 0;

      window.__wmState = {
        getActivePreviewToken: () => activePreviewToken,
        getIsPreviewActive: () => isPreviewActive,
        getPreviewExecCount: () => previewExecCount
      };

      function cancelPendingPreview() {
        if (previewDebounceTimer) {
          clearTimeout(previewDebounceTimer);
          previewDebounceTimer = null;
        }
        activePreviewToken++;
      }

      function scheduleDebouncedPreview(delay = 300) {
        if (!queuedFiles || queuedFiles.length === 0) return;
        if (resultArea && resultArea.classList.contains('active')) return;

        // Immediately cancel any pending timer and invalidate in-flight generation
        cancelPendingPreview();

        // Only schedule if user has activated preview
        if (!isPreviewActive) {
          return;
        }

        previewDebounceTimer = setTimeout(() => {
          generatePreview({ isAutoDebounced: true });
        }, delay);
      }

      // Mode toggling
      wmModeText.addEventListener('click', function () {
        currentMode = 'text';
        wmModeText.classList.add('active');
        wmModeImage.classList.remove('active');
        wmTextSection.style.display = 'contents';
        wmImageSection.style.display = 'none';
        setOpacityValue(30);
        scheduleDebouncedPreview(100);
      });

      wmModeImage.addEventListener('click', function () {
        currentMode = 'image';
        wmModeImage.classList.add('active');
        wmModeText.classList.remove('active');
        wmTextSection.style.display = 'none';
        wmImageSection.style.display = 'block';
        setOpacityValue(50);
        scheduleDebouncedPreview(100);
      });

      // Position grid buttons
      const posButtons = document.querySelectorAll('#wmPositionGrid .wm-pos-btn');
      posButtons.forEach(btn => {
        btn.addEventListener('click', function () {
          posButtons.forEach(b => b.classList.remove('active'));
          wmPosTile.classList.remove('active');
          btn.classList.add('active');
          selectedPosition = btn.getAttribute('data-pos');
          scheduleDebouncedPreview(100);
        });
      });

      // Tile button
      wmPosTile.addEventListener('click', function () {
        posButtons.forEach(b => b.classList.remove('active'));
        wmPosTile.classList.add('active');
        selectedPosition = 'tile';
        scheduleDebouncedPreview(100);
      });

      // Apply-to page selection ('all' | 'first' | 'custom')
      let selectedApplyTo = 'all';
      const wmApplyAll = document.getElementById('wmApplyAll');
      const wmApplyFirst = document.getElementById('wmApplyFirst');
      const wmApplyCustom = document.getElementById('wmApplyCustom');
      const wmCustomRangeWrap = document.getElementById('wmCustomRangeWrap');
      const wmCustomRangeInput = document.getElementById('wmCustomRangeInput');

      function setApplyTo(mode) {
        selectedApplyTo = mode;
        wmApplyAll.classList.toggle('active', mode === 'all');
        wmApplyFirst.classList.toggle('active', mode === 'first');
        wmApplyCustom.classList.toggle('active', mode === 'custom');
        wmCustomRangeWrap.style.display = (mode === 'custom') ? 'block' : 'none';
        if (mode === 'custom') {
          wmCustomRangeInput.focus();
        }
      }

      wmApplyAll.addEventListener('click', () => setApplyTo('all'));
      wmApplyFirst.addEventListener('click', () => setApplyTo('first'));
      wmApplyCustom.addEventListener('click', () => setApplyTo('custom'));

      // Unified Opacity synchronization
      function setOpacityValue(val, triggerPreview = true) {
        val = parseInt(val, 10);
        if (!Number.isFinite(val) || val < 1) val = 1;
        if (val > 100) val = 100;
        wmOpacityRange.value = val;
        wmOpacityNum.value = val;
        wmOpacityVal.textContent = `${val}%`;
        if (triggerPreview) {
          scheduleDebouncedPreview(250);
        }
      }
      wmOpacityRange.addEventListener('input', function () {
        setOpacityValue(this.value);
      });
      wmOpacityNum.addEventListener('input', function () {
        const val = parseInt(this.value, 10);
        if (Number.isFinite(val)) {
          let clamped = val;
          if (clamped < 1) clamped = 1;
          if (clamped > 100) clamped = 100;
          wmOpacityRange.value = clamped;
          wmOpacityVal.textContent = `${clamped}%`;
          scheduleDebouncedPreview(250);
        }
      });
      wmOpacityNum.addEventListener('change', function () {
        setOpacityValue(this.value);
      });

      // Unified Rotation synchronization
      function setRotationValue(val, triggerPreview = true) {
        val = parseInt(val, 10);
        if (!Number.isFinite(val)) val = 0;
        if (val < -180) val = -180;
        if (val > 180) val = 180;
        wmRotationRange.value = val;
        wmRotationNum.value = val;
        wmRotationVal.textContent = `${val}°`;
        if (triggerPreview) {
          scheduleDebouncedPreview(250);
        }
      }
      wmRotationRange.addEventListener('input', function () {
        setRotationValue(this.value);
      });
      wmRotationNum.addEventListener('input', function () {
        const val = parseInt(this.value, 10);
        if (Number.isFinite(val)) {
          let clamped = val;
          if (clamped < -180) clamped = -180;
          if (clamped > 180) clamped = 180;
          wmRotationRange.value = clamped;
          wmRotationVal.textContent = `${clamped}°`;
          scheduleDebouncedPreview(250);
        }
      });
      wmRotationNum.addEventListener('change', function () {
        setRotationValue(this.value);
      });
      wmResetRotationBtn.addEventListener('click', function () {
        setRotationValue(0);
      });

      // Scale synchronization
      function setScaleValue(val, triggerPreview = true) {
        val = parseInt(val, 10);
        if (!Number.isFinite(val) || val < 5) val = 5;
        if (val > 100) val = 100;
        wmScaleRange.value = val;
        if (wmScaleNum) wmScaleNum.value = val;
        wmScaleVal.textContent = `${val}%`;
        if (triggerPreview) {
          scheduleDebouncedPreview(250);
        }
      }
      wmScaleRange.addEventListener('input', function () {
        setScaleValue(this.value);
      });
      if (wmScaleNum) {
        wmScaleNum.addEventListener('input', function () {
          const val = parseInt(this.value, 10);
          if (Number.isFinite(val)) {
            let clamped = val;
            if (clamped < 5) clamped = 5;
            if (clamped > 100) clamped = 100;
            wmScaleRange.value = clamped;
            wmScaleVal.textContent = `${clamped}%`;
            scheduleDebouncedPreview(250);
          }
        });
        wmScaleNum.addEventListener('change', function () {
          setScaleValue(this.value);
        });
      }

      // Image selection & removal
      wmImageUploadBtn.addEventListener('click', function () {
        wmImageInput.click();
      });

      wmImageInput.addEventListener('change', async function () {
        const file = this.files && this.files[0];
        if (!file) return;

        // Validation: maximum 15 MB image file size
        const MAX_SIZE_BYTES = 15 * 1024 * 1024;
        if (file.size > MAX_SIZE_BYTES) {
          PDFTools.Toast.error(PDFTools.i18n.t('watermark.error_oversized'));
          wmImageInput.value = '';
          return;
        }

        try {
          const prepared = await PDFTools.Watermark.prepareImage(file);
          selectedImageFile = file;
          preparedImageData = prepared;

          if (wmImageThumb.src && wmImageThumb.src.startsWith('blob:')) {
            URL.revokeObjectURL(wmImageThumb.src);
          }
          wmImageThumb.src = URL.createObjectURL(file);
          wmThumbName.textContent = file.name;
          wmThumbMeta.textContent = `${prepared.width} × ${prepared.height} px`;

          wmImageUploadPrompt.style.display = 'none';
          wmImageThumbContainer.style.display = 'flex';
          scheduleDebouncedPreview(150);
        } catch (err) {
          console.error(err);
          wmImageInput.value = '';
          selectedImageFile = null;
          preparedImageData = null;
          PDFTools.Toast.error(err.message || PDFTools.i18n.t('watermark.error_invalid_image'));
        }
      });

      wmRemoveImageBtn.addEventListener('click', function () {
        selectedImageFile = null;
        preparedImageData = null;
        wmImageInput.value = '';
        wmImageThumb.src = '';
        wmImageThumbContainer.style.display = 'none';
        wmImageUploadPrompt.style.display = 'flex';
        scheduleDebouncedPreview(100);
      });

      // Color Swatches
      document.querySelectorAll('#colorSwatches .color-swatch').forEach(swatch => {
        swatch.addEventListener('click', function () {
          document.querySelectorAll('#colorSwatches .color-swatch').forEach(s => s.classList.remove('active'));
          swatch.classList.add('active');
          selectedColor = swatch.getAttribute('data-color');
          scheduleDebouncedPreview(100);
        });
      });

      // Live Text & Font Size listeners
      document.getElementById('wmText').addEventListener('input', () => scheduleDebouncedPreview(300));
      document.getElementById('wmFontSize').addEventListener('change', () => scheduleDebouncedPreview(100));

      // Preview handler (Requirement 1 & 3: page 1 of first file only with options.pages = [0], cancellable & debounced)
      async function generatePreview(opts = {}) {
        if (!queuedFiles || queuedFiles.length === 0) return;
        const file = queuedFiles[0];

        if (currentMode === 'image') {
          if (!selectedImageFile || !preparedImageData) {
            if (!opts.isAutoDebounced) {
              PDFTools.Toast.error(PDFTools.i18n.t('watermark.error_no_image'));
            }
            return;
          }
        }

        if (previewDebounceTimer) {
          clearTimeout(previewDebounceTimer);
          previewDebounceTimer = null;
        }

        const thisToken = ++activePreviewToken;

        const text = document.getElementById('wmText').value.trim() || 'CONFIDENTIAL';
        const rotation = parseInt(wmRotationNum.value, 10) || 0;
        const fontSize = parseInt(document.getElementById('wmFontSize').value, 10);
        const opacity = (parseInt(wmOpacityNum.value, 10) || 30) / 100;
        const scale = (parseInt(wmScaleNum ? wmScaleNum.value : wmScaleRange.value, 10) || 30) / 100;

        previewBtn.disabled = true;

        try {
          const watermarkOptions = currentMode === 'image' ? {
            type: 'image',
            image: preparedImageData,
            position: selectedPosition,
            scale: scale,
            rotation: rotation,
            opacity: opacity,
            pages: [0]
          } : {
            type: 'text',
            text: text,
            rotation: rotation,
            fontSize: fontSize,
            opacity: opacity,
            color: selectedColor,
            position: selectedPosition,
            pages: [0]
          };

          const previewBytes = await PDFTools.Watermark.applyWatermark(file, watermarkOptions);

          // If settings changed while this preview was computing, discard this stale render
          if (thisToken !== activePreviewToken) {
            return;
          }

          previewExecCount++;
          previewSlot.appendChild(wmResultPreviewCard);
          wmResultPreviewCard.style.display = 'flex';
          wmBatchFileSelectorContainer.style.display = 'none';

          await renderWatermarkPreview(previewBytes, true);
        } catch (err) {
          if (thisToken === activePreviewToken) {
            console.error('Preview error:', err);
            if (!opts.isAutoDebounced) {
              PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
            }
          }
        } finally {
          if (thisToken === activePreviewToken) {
            previewBtn.disabled = false;
          }
        }
      }

      previewBtn.addEventListener('click', () => {
        isPreviewActive = true;
        generatePreview({ isAutoDebounced: false });
      });

      applyBtn.addEventListener('click', async function () {
        if (!queuedFiles || queuedFiles.length === 0) return;

        if (currentMode === 'image') {
          if (!selectedImageFile || !preparedImageData) {
            PDFTools.Toast.error(PDFTools.i18n.t('watermark.error_no_image'));
            return;
          }
        }

        const text = document.getElementById('wmText').value.trim() || 'CONFIDENTIAL';
        const rotation = parseInt(wmRotationNum.value, 10) || 0;
        const fontSize = parseInt(document.getElementById('wmFontSize').value, 10);
        const opacity = (parseInt(wmOpacityNum.value, 10) || 30) / 100;
        const scale = (parseInt(wmScaleNum ? wmScaleNum.value : wmScaleRange.value, 10) || 30) / 100;

        let targetPagesOption = 'all';
        if (selectedApplyTo === 'first') {
          targetPagesOption = 'first';
        } else if (selectedApplyTo === 'custom') {
          const rangeVal = wmCustomRangeInput.value.trim();
          if (!rangeVal) {
            PDFTools.Toast.error(PDFTools.i18n.t('watermark.range_error_empty') || 'Rentang halaman tidak boleh kosong.');
            wmCustomRangeInput.focus();
            return;
          }
          if (!/^[0-9,\-\s]+$/.test(rangeVal)) {
            PDFTools.Toast.error(PDFTools.i18n.t('watermark.range_error_invalid') || 'Format rentang halaman tidak valid.');
            wmCustomRangeInput.focus();
            return;
          }
          targetPagesOption = rangeVal;
        }

        applyBtn.disabled = true;
        previewBtn.disabled = true;
        progress.show(PDFTools.i18n.t('action.processing'));
        batchResults = [];

        try {
          const total = queuedFiles.length;
          const skippedFiles = [];
          for (let i = 0; i < total; i++) {
            const file = queuedFiles[i];
            const basePct = Math.round((i / total) * 100);
            progress.update(basePct, `Processing (${i + 1}/${total}): ${file.name}...`);

            // Digital signatures: transparently handled by core applyWatermark (removeDigitalSignatures)
            // without any UI warnings, alert dialogs, or blocking popups.
            const watermarkOptions = currentMode === 'image' ? {
              type: 'image',
              image: preparedImageData,
              position: selectedPosition,
              scale: scale,
              rotation: rotation,
              opacity: opacity,
              pages: targetPagesOption
            } : {
              type: 'text',
              text: text,
              rotation: rotation,
              fontSize: fontSize,
              opacity: opacity,
              color: selectedColor,
              position: selectedPosition,
              pages: targetPagesOption
            };

            try {
              const resBytes = await PDFTools.Watermark.applyWatermark(file, watermarkOptions, function (pct, status) {
                const fileStep = Math.round(basePct + (pct / total));
                progress.update(fileStep, `[${i + 1}/${total}] ${file.name} - ${status}`);
              });

              const outName = `${file.name.replace(/\.pdf$/i, '')}_watermarked.pdf`;
              batchResults.push({ name: outName, data: resBytes });
              if (!watermarkedData) watermarkedData = resBytes;
            } catch (err) {
              if (err.code === 'PASSWORD_CANCELLED') {
                skippedFiles.push(file.name);
                continue;
              }
              throw err;
            }
          }

          progress.hide();

          if (batchResults.length === 0) {
            applyBtn.disabled = false;
            previewBtn.disabled = false;
            if (skippedFiles.length > 0) {
              PDFTools.Toast.info(`${skippedFiles.length} file(s) skipped: ${skippedFiles.join(', ')}`);
            }
            return;
          }

          optionsPanel.style.display = 'none';
          document.getElementById('fileList').style.display = 'none';
          actionBar.classList.remove('active');
          resultPreviewSlot.appendChild(wmResultPreviewCard);
          wmResultPreviewCard.style.display = 'flex';
          resultArea.classList.add('active');

          if (isBatchMode) {
            downloadBtn.textContent = `Download ${batchResults.length} Files (.ZIP)`;
            wmBatchFileSelect.innerHTML = '';
            batchResults.forEach((res, idx) => {
              const opt = document.createElement('option');
              opt.value = idx;
              opt.textContent = `${idx + 1}. ${res.name}`;
              wmBatchFileSelect.appendChild(opt);
            });
            wmBatchFileSelectorContainer.style.display = 'block';
          } else {
            downloadBtn.textContent = 'Download PDF';
            wmBatchFileSelectorContainer.style.display = 'none';
          }

          if (watermarkedData) {
            window.watermarkedData = watermarkedData;
            await renderWatermarkPreview(watermarkedData, false);
          }

          if (skippedFiles.length > 0) {
            PDFTools.Toast.info(`${skippedFiles.length} file(s) skipped: ${skippedFiles.join(', ')}`);
          } else {
            PDFTools.Toast.success(isBatchMode ? `All ${total} files watermarked successfully!` : PDFTools.i18n.t('result.watermark_success'));
          }
        } catch (err) {
          console.error(err);
          progress.hide();
          PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
          applyBtn.disabled = false;
          previewBtn.disabled = false;
        }
      });

      async function renderWatermarkPreview(bytes, isPreview = false) {
        if (!bytes) return;
        try {
          if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
            PDFTools.FileUtils.initPdfJsWorker();
          }
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(bytes.slice(0)) });
          wmResultPdfDoc = await loadingTask.promise;
          window.wmResultPdfDoc = wmResultPdfDoc;
          totalWmPages = wmResultPdfDoc.numPages;
          currentWmPage = 1;

          wmPageNav.style.display = (!isPreview && totalWmPages > 1) ? 'flex' : 'none';
          await renderWmPage(currentWmPage);
        } catch (err) {
          console.error('Failed to render watermark preview:', err);
        }
      }

      async function renderWmPage(pageNum) {
        if (!wmResultPdfDoc) return;
        wmPageIndicator.textContent = `${pageNum} / ${totalWmPages}`;
        prevWmPageBtn.disabled = (pageNum <= 1);
        nextWmPageBtn.disabled = (pageNum >= totalWmPages);

        const page = await wmResultPdfDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const maxW = 460;
        const scale = Math.min(maxW / unscaledViewport.width, 1.25);
        const viewport = page.getViewport({ scale: scale });

        wmResultCanvas.width = viewport.width;
        wmResultCanvas.height = viewport.height;
        const ctx = wmResultCanvas.getContext('2d');
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
        }).promise;
      }

      prevWmPageBtn.addEventListener('click', async function () {
        if (currentWmPage > 1) {
          currentWmPage--;
          await renderWmPage(currentWmPage);
        }
      });

      nextWmPageBtn.addEventListener('click', async function () {
        if (currentWmPage < totalWmPages) {
          currentWmPage++;
          await renderWmPage(currentWmPage);
        }
      });

      wmBatchFileSelect.addEventListener('change', async function () {
        const idx = parseInt(wmBatchFileSelect.value, 10);
        if (batchResults[idx]) {
          await renderWatermarkPreview(batchResults[idx].data);
        }
      });

      openInStudioBtn.addEventListener('click', async function () {
        let bytesToOpen = watermarkedData;
        let fileName = (currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document') + '_watermarked.pdf';
        if (isBatchMode && batchResults.length > 0) {
          const idx = parseInt(wmBatchFileSelect.value || '0', 10);
          if (batchResults[idx]) {
            bytesToOpen = batchResults[idx].data;
            fileName = batchResults[idx].name;
          }
        }
        if (bytesToOpen) {
          const fileToOpen = new File([bytesToOpen], fileName, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            await PDFTools.FileUtils.setPendingFile(fileToOpen);
          }
          window.location.href = 'viewer.html';
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

      downloadBtn.addEventListener('click', async function () {
        if (isBatchMode && batchResults.length > 1) {
          const zip = new JSZip();
          batchResults.forEach(item => {
            zip.file(item.name, item.data);
          });
          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'watermarked_documents.zip');
          PDFTools.Toast.success('ZIP package downloaded!');
        } else if (watermarkedData) {
          const originalName = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
          PDFTools.Download.save(watermarkedData, `${originalName}_watermarked.pdf`);
        }
      });

      resetBtn.addEventListener('click', function () {
        fileList.clear();
        watermarkedData = null;
        currentFile = null;
        queuedFiles = [];
        batchResults = [];
        isBatchMode = false;
        applyBtn.disabled = false;
        resultArea.classList.remove('active');
        document.getElementById('fileList').style.display = 'flex';
        dropzoneEl.style.display = 'block';

        currentMode = 'text';
        selectedPosition = 'center';
        selectedImageFile = null;
        preparedImageData = null;
        wmImageInput.value = '';
        wmImageThumb.src = '';
        wmImageThumbContainer.style.display = 'none';
        wmImageUploadPrompt.style.display = 'flex';
        wmModeText.classList.add('active');
        wmModeImage.classList.remove('active');
        wmTextSection.style.display = 'contents';
        wmImageSection.style.display = 'none';
        setScaleValue(30);
        setOpacityValue(30);
        setRotationValue(0);
        setApplyTo('all');
        wmCustomRangeInput.value = '';
        posButtons.forEach(b => b.classList.toggle('active', b.getAttribute('data-pos') === 'center'));
        wmPosTile.classList.remove('active');

        wmResultPdfDoc = null;
        wmPageNav.style.display = 'none';
        wmBatchFileSelectorContainer.style.display = 'none';
        if (wmResultPreviewCard) {
          wmResultPreviewCard.style.display = 'none';
          resultPreviewSlot.appendChild(wmResultPreviewCard);
        }
        const ctx = wmResultCanvas.getContext('2d');
        ctx.clearRect(0, 0, wmResultCanvas.width, wmResultCanvas.height);
        wmResultCanvas.width = 0;
        wmResultCanvas.height = 0;
      });
    });
})();
