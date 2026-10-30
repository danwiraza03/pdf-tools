/**
 * PDF Tools — Ocr Standalone Page Controller
 * Extracted from pages/ocr.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
      const dropzoneEl = document.getElementById('dropzone');
      const optionsPanel = document.getElementById('optionsPanel');
      const selectedFileName = document.getElementById('selectedFileName');
      const selectedFileSize = document.getElementById('selectedFileSize');
      const changeDocBtn = document.getElementById('changeDocBtn');
      const pageRangeContainer = document.getElementById('pageRangeContainer');
      const pageRangeInput = document.getElementById('pageRangeInput');
      const resetRangeBtn = document.getElementById('resetRangeBtn');
      const startOcrBtn = document.getElementById('startOcrBtn');
      const resultArea = document.getElementById('resultArea');
      const resetBtn = document.getElementById('resetBtn');

      // Pre-OCR View Elements
      const preOcrCanvas = document.getElementById('preOcrCanvas');
      const preOcrPageNav = document.getElementById('preOcrPageNav');
      const prePageIndicator = document.getElementById('prePageIndicator');
      const prevPrePageBtn = document.getElementById('prevPrePageBtn');
      const nextPrePageBtn = document.getElementById('nextPrePageBtn');

      // Result Elements
      const tabSideBySideBtn = document.getElementById('tabSideBySideBtn');
      const tabTextBtn = document.getElementById('tabTextBtn');
      const tabSearchablePdfBtn = document.getElementById('tabSearchablePdfBtn');
      const tabBreakdownBtn = document.getElementById('tabBreakdownBtn');

      const viewSideBySide = document.getElementById('viewSideBySide');
      const viewText = document.getElementById('viewText');
      const viewSearchablePdf = document.getElementById('viewSearchablePdf');
      const viewBreakdown = document.getElementById('viewBreakdown');

      const ocrOutputTextarea = document.getElementById('ocrOutputTextarea');
      const copyTextBtn = document.getElementById('copyTextBtn');
      const downloadTxtBtn = document.getElementById('downloadTxtBtn');
      const downloadMdBtn = document.getElementById('downloadMdBtn');
      const downloadCsvBtn = document.getElementById('downloadCsvBtn');
      const downloadSearchablePdfBtn = document.getElementById('downloadSearchablePdfBtn');
      const openInStudioBtn = document.getElementById('openInStudioBtn');

      // Side-by-Side Inspector Elements
      const sideOcrCanvas = document.getElementById('sideOcrCanvas');
      const sideWordOverlay = document.getElementById('sideWordOverlay');
      const rotateSidePageBtn = document.getElementById('rotateSidePageBtn');
      const toggleWordBoxesBtn = document.getElementById('toggleWordBoxesBtn');
      const toggleHeatmapBtn = document.getElementById('toggleHeatmapBtn');
      const sidePageNav = document.getElementById('sidePageNav');
      const sidePageIndicator = document.getElementById('sidePageIndicator');
      const prevSidePageBtn = document.getElementById('prevSidePageBtn');
      const nextSidePageBtn = document.getElementById('nextSidePageBtn');
      const sidePageTitleLabel = document.getElementById('sidePageTitleLabel');
      const sidePageConfidenceLabel = document.getElementById('sidePageConfidenceLabel');
      const sidePageTextarea = document.getElementById('sidePageTextarea');
      const pageBreakdownList = document.getElementById('pageBreakdownList');

      const progress = PDFTools.Progress('progressBar');
      let currentFile = null;
      let pdfJsDoc = null;
      let currentPrePage = 1;
      let totalPrePages = 1;
      let currentSidePage = 1;
      let showWordBoxes = true;
      let showHeatmap = false;

      // OCR language: the default follows the active UI language (id -> ind, en -> eng).
      // langSource records who decided: 'default' (follows UI), 'manual' (user click), 'detected' (from PDF text).
      // Only 'default' is ever moved automatically when the UI language changes.
      let selectedLang = 'ind';
      let langSource = 'default';
      function uiDefaultOcrLang() {
        const ui = (window.PDFTools && PDFTools.i18n && typeof PDFTools.i18n.getLang === 'function')
          ? PDFTools.i18n.getLang()
          : (document.documentElement.lang || 'en');
        return ui === 'en' ? 'eng' : 'ind';
      }
      function applyOcrLang(lang) {
        selectedLang = lang;
        document.querySelectorAll('#langSelector .ocr-seg-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-lang') === lang);
        });
      }
      applyOcrLang(uiDefaultOcrLang());
      window.addEventListener('pdftools:langchange', function () {
        if (langSource === 'default') applyOcrLang(uiDefaultOcrLang());
      });
      let selectedFormat = 'both';
      let selectedPreprocess = 'auto';
      let selectedDpi = 200;
      let ocrFinalResult = null;

      // Check SIMD Hardware Acceleration status
      const simdBadge = document.getElementById('simdBadge');
      const simdText = document.getElementById('simdText');
      if (PDFTools.OCR && typeof PDFTools.OCR.supportsSimd === 'function' && simdBadge && simdText) {
        const hasSimd = PDFTools.OCR.supportsSimd();
        if (hasSimd) {
          simdText.textContent = 'WebAssembly SIMD 128-bit Active (Up to 50% Faster)';
          simdBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          const isDark = document.documentElement.getAttribute('data-theme') === 'dark' || document.documentElement.classList.contains('dark-theme');
          simdBadge.style.color = isDark ? '#34d399' : '#047857';
          simdBadge.style.background = 'rgba(16, 185, 129, 0.12)';
        } else {
          simdText.textContent = 'Standard WebAssembly Active (Compatible Mode)';
        }
      }

      // Language selection
      document.querySelectorAll('#langSelector .ocr-seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          langSource = 'manual';
          applyOcrLang(btn.getAttribute('data-lang'));
        });
      });

      // Output format selection
      document.querySelectorAll('#outputSelector .ocr-seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('#outputSelector .ocr-seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedFormat = btn.getAttribute('data-format');
        });
      });

      // Preprocessing mode selection
      document.querySelectorAll('#preprocessSelector .ocr-seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('#preprocessSelector .ocr-seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedPreprocess = btn.getAttribute('data-preprocess');
        });
      });

      // DPI resolution selection
      document.querySelectorAll('#dpiSelector .ocr-seg-btn').forEach(btn => {
        btn.addEventListener('click', function () {
          document.querySelectorAll('#dpiSelector .ocr-seg-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          selectedDpi = parseInt(btn.getAttribute('data-dpi'), 10) || 200;
        });
      });

      resetRangeBtn.addEventListener('click', function () {
        pageRangeInput.value = '';
      });

      changeDocBtn.addEventListener('click', function () {
        currentFile = null;
        pdfJsDoc = null;
        optionsPanel.style.display = 'none';
        dropzoneEl.style.display = 'block';
      });

      // Tab switcher
      tabSideBySideBtn.addEventListener('click', () => switchTab('side'));
      tabTextBtn.addEventListener('click', () => switchTab('text'));
      tabSearchablePdfBtn.addEventListener('click', () => switchTab('pdf'));
      tabBreakdownBtn.addEventListener('click', () => switchTab('breakdown'));

      function switchTab(tab) {
        tabSideBySideBtn.classList.toggle('active', tab === 'side');
        tabTextBtn.classList.toggle('active', tab === 'text');
        tabSearchablePdfBtn.classList.toggle('active', tab === 'pdf');
        tabBreakdownBtn.classList.toggle('active', tab === 'breakdown');

        viewSideBySide.style.display = tab === 'side' ? 'block' : 'none';
        viewText.style.display = tab === 'text' ? 'block' : 'none';
        viewSearchablePdf.style.display = tab === 'pdf' ? 'block' : 'none';
        viewBreakdown.style.display = tab === 'breakdown' ? 'block' : 'none';
      }

      // Dropzone setup
      PDFTools.Dropzone('dropzone', {
        accept: '.pdf, .jpg, .jpeg, .png, .webp',
        multiple: false,
        onFiles: async function (files) {
          if (!files || files.length === 0) return;
          await loadDocument(files[0]);
        }
      });

      if (PDFTools.PageDrop) {
        PDFTools.PageDrop.attach({
          accept: '.pdf, .jpg, .jpeg, .png, .webp',
          multiple: false,
          enabled: () => Boolean(currentFile),
          onFiles: async function (files) {
            if (files && files[0]) await loadDocument(files[0]);
          }
        });
      }

      // Check for pending handoff file from homepage (B1)
      if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
        PDFTools.FileUtils.consumePendingFile().then(async file => {
          if (file) await loadDocument(file);
        });
      }

      async function loadDocument(file) {
        currentFile = file;
        selectedFileName.textContent = currentFile.name;

        const isPdf = PDFTools.FileUtils.isPDF(currentFile);
        pageRangeContainer.style.display = isPdf ? 'block' : 'none';

        dropzoneEl.style.display = 'none';
        optionsPanel.style.display = 'block';
        resultArea.classList.remove('active');

        if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
          PDFTools.FileUtils.initPdfJsWorker();
        }

        if (isPdf) {
          try {
            const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
            const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) });
            pdfJsDoc = await loadingTask.promise;
            totalPrePages = pdfJsDoc.numPages;
            currentPrePage = 1;

            selectedFileSize.textContent = `${PDFTools.FileUtils.formatSize(currentFile.size)} • ${totalPrePages} Pages`;
            preOcrPageNav.style.display = totalPrePages > 1 ? 'flex' : 'none';

            await renderPrePage(currentPrePage);

            // Sample text for automatic language detection
            try {
              const firstPage = await pdfJsDoc.getPage(1);
              const textContent = await firstPage.getTextContent();
              const sampleStr = (textContent.items || []).map(i => i.str).join(' ');
              if (sampleStr && sampleStr.length > 20 && PDFTools.OCR.detectLanguageFromText) {
                const detected = PDFTools.OCR.detectLanguageFromText(sampleStr);
                langSource = 'detected';
                applyOcrLang(detected);
                const langName = detected === 'ind' ? 'Bahasa Indonesia' : (detected === 'eng' ? 'English' : 'ID + EN');
                PDFTools.Toast.info(`Auto-detected: ${langName}`);
              }
            } catch (langErr) {}
          } catch (err) {
            console.error('PDF preview error:', err);
            selectedFileSize.textContent = `(${PDFTools.FileUtils.formatSize(currentFile.size)})`;
          }
        } else {
          // Render Image preview
          totalPrePages = 1;
          currentPrePage = 1;
          preOcrPageNav.style.display = 'none';
          selectedFileSize.textContent = `Image • ${PDFTools.FileUtils.formatSize(currentFile.size)}`;
          renderImagePreview(file);
        }

        PDFTools.Toast.success(PDFTools.i18n.t('toast.file_loaded') || 'File loaded ready for OCR!');
      }

      async function renderPrePage(pageNum) {
        if (!pdfJsDoc) return;
        prePageIndicator.textContent = `${pageNum} / ${totalPrePages}`;
        prevPrePageBtn.disabled = (pageNum <= 1);
        nextPrePageBtn.disabled = (pageNum >= totalPrePages);

        const page = await pdfJsDoc.getPage(pageNum);
        const unscaledViewport = page.getViewport({ scale: 1.0 });
        const scale = Math.min(360 / unscaledViewport.width, 1.2);
        const viewport = page.getViewport({ scale: scale });

        preOcrCanvas.width = viewport.width;
        preOcrCanvas.height = viewport.height;
        const ctx = preOcrCanvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport: viewport }).promise;
      }

      function renderImagePreview(file) {
        const reader = new FileReader();
        reader.onload = function (e) {
          const img = new Image();
          img.onload = function () {
            const maxW = 360;
            const scale = Math.min(maxW / img.width, 1.0);
            preOcrCanvas.width = img.width * scale;
            preOcrCanvas.height = img.height * scale;
            const ctx = preOcrCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0, preOcrCanvas.width, preOcrCanvas.height);
          };
          img.src = e.target.result;
        };
        reader.readAsDataURL(file);
      }

      prevPrePageBtn.addEventListener('click', async () => {
        if (currentPrePage > 1) {
          currentPrePage--;
          await renderPrePage(currentPrePage);
        }
      });
      nextPrePageBtn.addEventListener('click', async () => {
        if (currentPrePage < totalPrePages) {
          currentPrePage++;
          await renderPrePage(currentPrePage);
        }
      });

      // Start OCR Execution
      startOcrBtn.addEventListener('click', async function () {
        if (!currentFile) return;

        startOcrBtn.disabled = true;
        progress.show('Initializing local OCR engine...');

        try {
          const deskewToggle = document.getElementById('deskewToggle');
          const result = await PDFTools.OCR.processFile(currentFile, {
            lang: selectedLang,
            outputFormat: selectedFormat,
            pageRange: pageRangeInput.value,
            preprocess: selectedPreprocess,
            dpi: selectedDpi,
            deskew: deskewToggle ? deskewToggle.checked : true
          }, function (percent, text) {
            progress.update(percent, text);
          });

          ocrFinalResult = result;

          progress.hide();
          optionsPanel.style.display = 'none';

          // Render summary stats
          document.getElementById('resPages').textContent = result.stats.pageCount;
          document.getElementById('resWords').textContent = result.stats.wordCount.toLocaleString();
          document.getElementById('resConfidence').textContent = `${result.stats.avgConfidence}%`;
          if (document.getElementById('resEngine')) {
            document.getElementById('resEngine').textContent = result.stats.simd ? 'SIMD' : 'WASM';
            document.getElementById('resEngineLabel').textContent = `${result.stats.dpi} DPI • ${result.stats.preprocess.toUpperCase()}`;
          }

          // Fill full text editor
          ocrOutputTextarea.value = result.fullText;

          // Searchable PDF tab state
          if (result.searchablePdfBytes) {
            tabSearchablePdfBtn.style.display = 'inline-block';
          } else {
            tabSearchablePdfBtn.style.display = 'none';
          }

          // Setup Side-by-Side Inspector
          currentSidePage = 1;
          await renderSideBySide(currentSidePage);

          // Render page breakdown
          renderPageBreakdown(result.pageResults);

          resultArea.classList.add('active');
          switchTab('side');

          if (PDFTools.RecentFiles && currentFile) {
            PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'OCR PDF', 'ocr');
          }

          PDFTools.Toast.success(PDFTools.i18n.t('ocr.success_title') || 'OCR Completed Successfully!');
        } catch (err) {
          console.error('OCR Error:', err);
          progress.hide();
          PDFTools.Toast.error(err.message || 'OCR processing failed.');
          startOcrBtn.disabled = false;
        }
      });

      async function renderSideBySide(pageNum) {
        if (!ocrFinalResult || !ocrFinalResult.pageResults) return;
        const total = ocrFinalResult.pageResults.length;
        sidePageIndicator.textContent = `Page ${pageNum} / ${total}`;
        prevSidePageBtn.disabled = (pageNum <= 1);
        nextSidePageBtn.disabled = (pageNum >= total);

        const pageData = ocrFinalResult.pageResults[pageNum - 1] || {};
        sidePageTitleLabel.textContent = `Page ${pageNum} OCR Text`;
        sidePageConfidenceLabel.textContent = `${pageData.confidence || 0}% Accuracy`;
        sidePageTextarea.value = pageData.text || '';

        // Render Canvas on left pane
        if (pdfJsDoc) {
          const page = await pdfJsDoc.getPage(pageNum);
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          const scale = Math.min(380 / unscaledViewport.width, 1.2);
          const viewport = page.getViewport({ scale: scale });

          sideOcrCanvas.width = viewport.width;
          sideOcrCanvas.height = viewport.height;
          const ctx = sideOcrCanvas.getContext('2d');
          await page.render({ canvasContext: ctx, viewport: viewport }).promise;

          const scaleX = sideOcrCanvas.width / (pageData.renderedWidth || pageData.width || sideOcrCanvas.width);
          const scaleY = sideOcrCanvas.height / (pageData.renderedHeight || pageData.height || sideOcrCanvas.height);
          renderWordBoxes(pageData, scaleX, scaleY);
        } else if (currentFile) {
          // Render image
          const reader = new FileReader();
          reader.onload = function (e) {
            const img = new Image();
            img.onload = function () {
              const maxW = 380;
              const scale = Math.min(maxW / img.width, 1.0);
              sideOcrCanvas.width = img.width * scale;
              sideOcrCanvas.height = img.height * scale;
              const ctx = sideOcrCanvas.getContext('2d');
              ctx.drawImage(img, 0, 0, sideOcrCanvas.width, sideOcrCanvas.height);

              const scaleX = sideOcrCanvas.width / (pageData.renderedWidth || pageData.width || img.width);
              const scaleY = sideOcrCanvas.height / (pageData.renderedHeight || pageData.height || img.height);
              renderWordBoxes(pageData, scaleX, scaleY);
            };
            img.src = e.target.result;
          };
          reader.readAsDataURL(currentFile);
        }
      }

      function renderWordBoxes(pageData, scaleX, scaleY) {
        if (!sideWordOverlay) return;
        sideWordOverlay.innerHTML = '';
        if (!showWordBoxes || !pageData || !pageData.words || pageData.words.length === 0) return;

        pageData.words.forEach((word) => {
          if (!word.bbox || !word.text) return;
          const box = document.createElement('div');
          box.className = 'ocr-word-box';
          const left = word.bbox.x0 * scaleX;
          const top = word.bbox.y0 * scaleY;
          const width = (word.bbox.x1 - word.bbox.x0) * scaleX;
          const height = (word.bbox.y1 - word.bbox.y0) * scaleY;

          box.style.left = `${left}px`;
          box.style.top = `${top}px`;
          box.style.width = `${Math.max(4, width)}px`;
          box.style.height = `${Math.max(4, height)}px`;
          box.title = `${word.text} (${word.confidence || 0}%)`;

          // Apply Confidence Heatmap Colors if enabled
          if (showHeatmap) {
            const conf = word.confidence || 0;
            if (conf >= 90) {
              box.style.borderColor = 'rgba(16, 185, 129, 0.75)';
              box.style.background = 'rgba(16, 185, 129, 0.22)';
            } else if (conf >= 70) {
              box.style.borderColor = 'rgba(245, 158, 11, 0.75)';
              box.style.background = 'rgba(245, 158, 11, 0.25)';
            } else if (conf >= 50) {
              box.style.borderColor = 'rgba(249, 115, 22, 0.75)';
              box.style.background = 'rgba(249, 115, 22, 0.30)';
            } else {
              box.style.borderColor = 'rgba(239, 68, 68, 0.85)';
              box.style.background = 'rgba(239, 68, 68, 0.38)';
            }
          }

          box.addEventListener('mouseenter', () => {
            const tip = document.createElement('div');
            tip.className = 'ocr-word-tooltip';
            tip.textContent = `${word.text} • ${word.confidence || 0}%`;
            box.appendChild(tip);
          });
          box.addEventListener('mouseleave', () => {
            const tip = box.querySelector('.ocr-word-tooltip');
            if (tip) tip.remove();
          });

          box.addEventListener('click', () => {
            document.querySelectorAll('.ocr-word-box').forEach(b => b.classList.remove('active'));
            box.classList.add('active');

            const text = sidePageTextarea.value;
            const wordTrimmed = word.text.trim();
            const pos = text.indexOf(wordTrimmed);
            if (pos !== -1) {
              sidePageTextarea.focus();
              sidePageTextarea.setSelectionRange(pos, pos + wordTrimmed.length);
            }
          });

          sideWordOverlay.appendChild(box);
        });
      }

      toggleWordBoxesBtn.addEventListener('click', () => {
        showWordBoxes = !showWordBoxes;
        toggleWordBoxesBtn.classList.toggle('active', showWordBoxes);
        toggleWordBoxesBtn.style.background = showWordBoxes ? 'rgba(6, 182, 212, 0.15)' : 'transparent';
        sideWordOverlay.style.display = showWordBoxes ? 'block' : 'none';
        if (showWordBoxes && ocrFinalResult) {
          const pageData = ocrFinalResult.pageResults[currentSidePage - 1] || {};
          const scaleX = sideOcrCanvas.width / (pageData.renderedWidth || pageData.width || sideOcrCanvas.width);
          const scaleY = sideOcrCanvas.height / (pageData.renderedHeight || pageData.height || sideOcrCanvas.height);
          renderWordBoxes(pageData, scaleX, scaleY);
        }
      });

      toggleHeatmapBtn.addEventListener('click', () => {
        showHeatmap = !showHeatmap;
        toggleHeatmapBtn.classList.toggle('active', showHeatmap);
        toggleHeatmapBtn.style.background = showHeatmap ? 'rgba(245, 158, 11, 0.2)' : 'transparent';
        toggleHeatmapBtn.style.borderColor = showHeatmap ? '#f59e0b' : 'var(--border-color)';
        if (ocrFinalResult) {
          const pageData = ocrFinalResult.pageResults[currentSidePage - 1] || {};
          const scaleX = sideOcrCanvas.width / (pageData.renderedWidth || pageData.width || sideOcrCanvas.width);
          const scaleY = sideOcrCanvas.height / (pageData.renderedHeight || pageData.height || sideOcrCanvas.height);
          renderWordBoxes(pageData, scaleX, scaleY);
        }
      });

      rotateSidePageBtn.addEventListener('click', () => {
        if (PDFTools.OCR && PDFTools.OCR.rotateCanvas) {
          PDFTools.OCR.rotateCanvas(sideOcrCanvas, 90);
          sideWordOverlay.innerHTML = '';
          PDFTools.Toast.info('Page rotated 90°');
        }
      });

      prevSidePageBtn.addEventListener('click', async () => {
        if (currentSidePage > 1) {
          currentSidePage--;
          await renderSideBySide(currentSidePage);
        }
      });
      nextSidePageBtn.addEventListener('click', async () => {
        if (ocrFinalResult && currentSidePage < ocrFinalResult.pageResults.length) {
          currentSidePage++;
          await renderSideBySide(currentSidePage);
        }
      });

      // Side page textarea edits sync back to full text
      sidePageTextarea.addEventListener('input', () => {
        if (ocrFinalResult && ocrFinalResult.pageResults[currentSidePage - 1]) {
          ocrFinalResult.pageResults[currentSidePage - 1].text = sidePageTextarea.value;
          ocrOutputTextarea.value = ocrFinalResult.pageResults.map(p => p.text).join('\n\n--- Page Break ---\n\n');
        }
      });

      function renderPageBreakdown(pageResults) {
        pageBreakdownList.innerHTML = '';
        pageResults.forEach((p, idx) => {
          const item = document.createElement('div');
          item.className = 'page-breakdown-item';
          item.style.cursor = 'pointer';

          const header = document.createElement('div');
          header.className = 'page-breakdown-item-header';

          const title = document.createElement('strong');
          title.textContent = `Page ${p.pageNum}`;

          const conf = document.createElement('span');
          conf.className = 'confidence-badge';
          conf.textContent = `${p.confidence}% Accuracy (${(p.words || []).length} words)`;

          header.appendChild(title);
          header.appendChild(conf);

          const textPreview = document.createElement('div');
          textPreview.className = 'page-breakdown-text';
          textPreview.textContent = p.text ? p.text.substring(0, 240) + '…' : '(No text recognized)';

          item.appendChild(header);
          item.appendChild(textPreview);

          item.addEventListener('click', async () => {
            currentSidePage = idx + 1;
            await renderSideBySide(currentSidePage);
            switchTab('side');
          });

          pageBreakdownList.appendChild(item);
        });
      }

      // Actions
      copyTextBtn.addEventListener('click', function () {
        const text = ocrOutputTextarea.value;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
          PDFTools.Toast.success(PDFTools.i18n.t('ocr.copied') || 'Text copied to clipboard!');
        });
      });

      downloadTxtBtn.addEventListener('click', function () {
        const text = ocrOutputTextarea.value;
        if (!text) return;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const name = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'ocr_result';
        saveAs(blob, `${name}_ocr.txt`);
      });

      downloadMdBtn.addEventListener('click', function () {
        const text = ocrOutputTextarea.value;
        if (!text) return;
        const blob = new Blob([`# OCR Result: ${currentFile ? currentFile.name : 'Document'}\n\n${text}`], { type: 'text/markdown;charset=utf-8' });
        const name = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'ocr_result';
        saveAs(blob, `${name}_ocr.md`);
      });

      downloadCsvBtn.addEventListener('click', function () {
        if (!ocrFinalResult || !ocrFinalResult.pageResults) return;
        const csvContent = PDFTools.OCR.convertOcrToCsv(ocrFinalResult.pageResults);
        if (!csvContent) {
          PDFTools.Toast.info('No tabular data detected to export.');
          return;
        }
        const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const name = currentFile ? currentFile.name.replace(/\.[^/.]+$/, '') : 'ocr_result';
        saveAs(blob, `${name}_ocr.csv`);
        PDFTools.Toast.success('Structured CSV exported successfully!');
      });

      downloadSearchablePdfBtn.addEventListener('click', function () {
        if (ocrFinalResult && ocrFinalResult.searchablePdfBytes) {
          const name = currentFile ? currentFile.name.replace(/\.pdf$/i, '') : 'document';
          PDFTools.Download.save(ocrFinalResult.searchablePdfBytes, `${name}_searchable.pdf`);
          PDFTools.Toast.success('Searchable PDF downloaded!');
        }
      });

      openInStudioBtn.addEventListener('click', async function () {
        if (ocrFinalResult && ocrFinalResult.searchablePdfBytes) {
          const searchableFile = new File([ocrFinalResult.searchablePdfBytes], `${currentFile.name.replace(/\.pdf$/i, '')}_searchable.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            await PDFTools.FileUtils.setPendingFile(searchableFile);
          }
          window.location.href = 'viewer.html';
        }
      });

      resetBtn.addEventListener('click', function () {
        currentFile = null;
        ocrFinalResult = null;
        pdfJsDoc = null;
        startOcrBtn.disabled = false;
        resultArea.classList.remove('active');
        optionsPanel.style.display = 'none';
        dropzoneEl.style.display = 'block';
      });
    });
})();
