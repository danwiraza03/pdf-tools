/**
 * PDF Tools — PDF Preview Component
 * Renders PDF page thumbnails using PDF.js
 */
window.PDFTools = window.PDFTools || {};

PDFTools.Preview = (function () {
  if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) {
    PDFTools.FileUtils.initPdfJsWorker();
  }

  /**
   * Render first page of a PDF file to a canvas
   */
  async function renderThumbnail(fileOrBuffer, canvas, scale) {
    scale = scale || 0.3;
    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('PDF.js not available');
      }

      let arrayBuffer;
      if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
        arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(fileOrBuffer);
      } else if (fileOrBuffer instanceof Uint8Array) {
        arrayBuffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset || 0, (fileOrBuffer.byteOffset || 0) + (fileOrBuffer.byteLength || fileOrBuffer.buffer.byteLength));
      } else if (fileOrBuffer instanceof ArrayBuffer) {
        arrayBuffer = fileOrBuffer.slice(0);
      } else {
        arrayBuffer = fileOrBuffer;
      }

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer).slice(0) });
      const pdf = await loadingTask.promise;
      const page = await pdf.getPage(1);

      const viewport = page.getViewport({ scale: scale });
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const context = canvas.getContext('2d');
      const renderContext = {
        canvasContext: context,
        viewport: viewport,
        annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
      };

      await page.render(renderContext).promise;
      return { totalPages: pdf.numPages, width: viewport.width, height: viewport.height };
    } catch (err) {
      console.warn('Thumbnail preview fallback:', err);
      // Fallback: draw placeholder on canvas
      const ctx = canvas.getContext('2d');
      canvas.width = 120;
      canvas.height = 160;
      ctx.fillStyle = '#1e1e38';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ee6c4d';
      ctx.font = 'bold 24px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('PDF', canvas.width / 2, canvas.height / 2 - 10);
      ctx.fillStyle = '#9090b8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText('Preview', canvas.width / 2, canvas.height / 2 + 20);
      return { totalPages: 1, width: 120, height: 160 };
    }
  }

  /**
   * Render all pages of a PDF as thumbnail elements
   */
  async function renderAllPages(fileOrBuffer, containerEl, options) {
    options = options || {};
    const onPageClick = options.onPageClick || null;
    const selectable = options.selectable !== false;

    containerEl.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">Rendering page previews...</div>';

    try {
      let arrayBuffer;
      if (fileOrBuffer instanceof File || fileOrBuffer instanceof Blob) {
        arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(fileOrBuffer);
      } else if (fileOrBuffer instanceof Uint8Array) {
        arrayBuffer = fileOrBuffer.buffer.slice(fileOrBuffer.byteOffset || 0, (fileOrBuffer.byteOffset || 0) + (fileOrBuffer.byteLength || fileOrBuffer.buffer.byteLength));
      } else if (fileOrBuffer instanceof ArrayBuffer) {
        arrayBuffer = fileOrBuffer.slice(0);
      } else {
        arrayBuffer = fileOrBuffer;
      }

      const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer).slice(0) });
      const pdf = await loadingTask.promise;
      containerEl.innerHTML = '';

      const pageCards = [];

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 0.25 });

        const card = document.createElement('div');
        card.className = 'page-card' + (options.initiallySelected ? ' selected' : '');
        card.setAttribute('data-page', pageNum);

        const previewDiv = document.createElement('div');
        previewDiv.className = 'page-card-preview';

        const canvas = document.createElement('canvas');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const ctx = canvas.getContext('2d');
        await page.render({
          canvasContext: ctx,
          viewport: viewport,
          annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
        }).promise;

        previewDiv.appendChild(canvas);

        const label = document.createElement('div');
        label.className = 'page-card-label';
        label.textContent = `${PDFTools.i18n.t('page')} ${pageNum}`;

        const check = document.createElement('div');
        check.className = 'page-card-check';
        check.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

        card.appendChild(previewDiv);
        card.appendChild(label);
        card.appendChild(check);

        if (selectable) {
          card.addEventListener('click', function () {
            card.classList.toggle('selected');
            if (typeof onPageClick === 'function') {
              onPageClick(pageNum, card.classList.contains('selected'), card);
            }
          });
        }

        containerEl.appendChild(card);
        pageCards.push(card);
      }

      return { totalPages: pdf.numPages, pageCards: pageCards };
    } catch (err) {
      console.error('Failed to render pages:', err);
      containerEl.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: #e74c3c; padding: 20px;">Failed to render previews: ${err.message}</div>`;
      throw err;
    }
  }

  return {
    renderThumbnail: renderThumbnail,
    renderAllPages: renderAllPages
  };
})();
