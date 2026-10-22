/**
 * PDF Tools — PDF Studio Viewport Renderer & View Mode Navigation
 * Manages document loading, recovery session restore, viewport multi-view rendering
 * (single, continuous, two-page, two-page scroll), zoom & fit width, and page navigation.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioRenderer = (function () {
  let ctx = null;
  let viewRenderId = 0;
  let resizeTimer = null;
  let resizeObserver = null;
  let isListenersBound = false;

  function init(context) {
    ctx = context;
    if (!isListenersBound) {
      bindEventListeners();
      isListenersBound = true;
    }
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : null;
  }

  function setDoc(doc) {
    if (ctx && ctx.setDoc) ctx.setDoc(doc);
  }

  function getScale() {
    return ctx && ctx.getScale ? ctx.getScale() : 1.0;
  }

  function setScale(scale) {
    if (ctx && ctx.setScale) ctx.setScale(scale);
  }

  function getViewMode() {
    return ctx && ctx.getViewMode ? ctx.getViewMode() : 'continuous';
  }

  function setViewModeState(mode) {
    if (ctx && ctx.setViewModeState) ctx.setViewModeState(mode);
  }

  function getUndoStack() {
    return ctx && ctx.getUndoStack ? ctx.getUndoStack() : [];
  }

  function setDocumentDirty(dirty) {
    if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(dirty);
  }

  // --- Document Loading & Recovery ---

  async function openDocument(file, recoveryState = null) {
    try {
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.info('Opening document in Acrobat View...');
      }
      const currentDoc = await window.PDFTools.Studio.loadDocument(file);
      setDoc(currentDoc);

      const undoStack = getUndoStack();
      undoStack.length = 0;

      if (recoveryState) {
        window.PDFTools.Studio.restoreDocumentState(currentDoc, recoveryState);
      } else {
        setDocumentDirty(false);
      }

      if (window.PDFTools && window.PDFTools.StudioSearchOCR) {
        window.PDFTools.StudioSearchOCR.resetSearchState();
      }

      const tabDocName = ctx?.getTabDocName?.() || document.getElementById('tabDocName');
      if (tabDocName) {
        tabDocName.textContent = `${file.name}${currentDoc.dirty ? ' *' : ''}`;
        tabDocName.title = currentDoc.dirty ? 'Recovered unsaved changes' : file.name;
      }

      const emptyDropzoneState = ctx?.getEmptyDropzoneState?.() || document.getElementById('emptyDropzoneState');
      const sheetWrapper = ctx?.getSheetWrapper?.() || document.getElementById('sheetWrapper');
      if (emptyDropzoneState) emptyDropzoneState.style.display = 'none';
      if (sheetWrapper) sheetWrapper.style.display = 'block';

      const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
      if (totalPagesLabel) {
        totalPagesLabel.textContent = currentDoc.getActivePagesList().length;
      }

      await renderCurrentPageView();

      if (ctx?.buildSidebarThumbnails) await ctx.buildSidebarThumbnails();
      if (ctx?.buildSidebarBookmarks) ctx.buildSidebarBookmarks();
      if (ctx?.buildSidebarAttachments) ctx.buildSidebarAttachments();

      if (window.PDFTools?.RecentFiles && file) {
        window.PDFTools.RecentFiles.add(file.name, file.size, 'PDF Studio', 'studio');
      }

      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Document loaded successfully!');
        if (recoveryState) {
          window.PDFTools.Toast.info('Recovered unsaved changes from the previous session.');
        }
      }
    } catch (err) {
      console.error('Error opening PDF:', err);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.error(err.message || 'Failed to open document.');
      }
    }
  }

  async function checkForRecovery() {
    try {
      const snapshot = await window.PDFTools.Studio.getRecoverySnapshot();
      if (!snapshot || !snapshot.arrayBuffer) return;

      let shouldRestore = true;
      if (window.PDFTools?.Modal?.confirm) {
        shouldRestore = await window.PDFTools.Modal.confirm(
          `Recover unsaved changes for "${snapshot.fileName}"?`,
          { title: 'Restore Session' }
        );
      }
      if (!shouldRestore) {
        await window.PDFTools.Studio.clearRecoverySnapshot();
        return;
      }

      const recoveredFile = new File([snapshot.arrayBuffer], snapshot.fileName, { type: 'application/pdf' });
      await openDocument(recoveredFile, snapshot.state);
    } catch (err) {
      console.warn('Recovery check unavailable:', err);
    }
  }

  // --- Multi-View Rendering ---

  async function renderCurrentPageView() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const renderId = ++viewRenderId;
    const viewMode = getViewMode();

    if (viewMode !== 'single') {
      await renderPageStack(renderId);
      return;
    }

    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    const acrobatViewport = ctx?.getAcrobatViewport?.() || document.getElementById('acrobatViewport');
    const sheetWrapper = ctx?.getSheetWrapper?.() || document.getElementById('sheetWrapper');
    const pdfCanvas = ctx?.getPdfCanvas?.() || document.getElementById('pdfCanvas');
    const annotationCanvas = ctx?.getAnnotationCanvas?.() || document.getElementById('annotationCanvas');
    const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
    const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');

    if (pageStack) {
      pageStack.dataset.viewMode = 'single';
      pageStack.style.display = 'none';
    }
    if (acrobatViewport) {
      acrobatViewport.style.display = 'flex';
      acrobatViewport.scrollTop = 0;
      acrobatViewport.scrollLeft = 0;
    }
    if (sheetWrapper) sheetWrapper.style.display = 'block';

    const activePages = currentDoc.getActivePagesList();
    if (totalPagesLabel) totalPagesLabel.textContent = activePages.length;

    const pageIdxInOrder = activePages.indexOf(currentDoc.currentPage);
    if (pageNumberInput) {
      pageNumberInput.value = pageIdxInOrder !== -1 ? pageIdxInOrder + 1 : 1;
    }

    const currentScale = getScale();
    const renderInfo = await window.PDFTools.Studio.renderPage(currentDoc, currentDoc.currentPage, pdfCanvas, currentScale);

    if (renderInfo) {
      if (annotationCanvas) {
        annotationCanvas.width = renderInfo.width;
        annotationCanvas.height = renderInfo.height;
      }
      if (sheetWrapper) {
        sheetWrapper.style.width = `${renderInfo.width}px`;
        sheetWrapper.style.height = `${renderInfo.height}px`;
      }
    }

    if (ctx?.renderSinglePageSearchHighlights) ctx.renderSinglePageSearchHighlights();
    if (ctx?.redrawAnnotationLayer) ctx.redrawAnnotationLayer();
    if (ctx?.renderActivePageWidgets) ctx.renderActivePageWidgets();
    if (ctx?.updateThumbnailActiveState) ctx.updateThumbnailActiveState();
  }

  async function renderPageStack(renderId) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activePages = currentDoc.getActivePagesList();
    const viewMode = getViewMode();
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    const sheetWrapper = ctx?.getSheetWrapper?.() || document.getElementById('sheetWrapper');
    const acrobatViewport = ctx?.getAcrobatViewport?.() || document.getElementById('acrobatViewport');
    const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
    const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
    const currentScale = getScale();

    if (pageStack) {
      pageStack.dataset.viewMode = viewMode;
      pageStack.style.display = viewMode === 'two' ? 'grid' : 'flex';
      pageStack.innerHTML = '';
    }
    if (sheetWrapper) sheetWrapper.style.display = 'none';
    if (acrobatViewport) {
      acrobatViewport.style.display = viewMode === 'two' ? 'flex' : 'block';
    }

    for (const pageNum of activePages) {
      const pageFrame = document.createElement('div');
      pageFrame.className = `continuous-page ${pageNum === currentDoc.currentPage ? 'current-page' : ''}`;
      pageFrame.dataset.page = pageNum;
      pageFrame.style.position = 'relative';

      const canvas = document.createElement('canvas');
      pageFrame.appendChild(canvas);

      const highlightLayer = document.createElement('div');
      highlightLayer.className = 'search-highlight-layer continuous-highlight-layer';
      highlightLayer.dataset.page = pageNum;
      pageFrame.appendChild(highlightLayer);

      if (pageStack) pageStack.appendChild(pageFrame);

      const renderInfo = await window.PDFTools.Studio.renderPage(currentDoc, pageNum, canvas, currentScale);
      if (renderInfo) {
        pageFrame.style.width = `${renderInfo.width}px`;
        pageFrame.style.height = `${renderInfo.height}px`;
      }
      if (renderId !== viewRenderId || getViewMode() === 'single') return;
    }

    if (totalPagesLabel) totalPagesLabel.textContent = activePages.length;
    if (pageNumberInput) {
      pageNumberInput.value = activePages.indexOf(currentDoc.currentPage) + 1;
    }

    if (ctx?.renderContinuousSearchHighlights) ctx.renderContinuousSearchHighlights();
    syncCurrentPageFromScroll();
  }

  function syncCurrentPageFromScroll() {
    const currentDoc = getDoc();
    const viewMode = getViewMode();
    if (!currentDoc || viewMode === 'single') return;

    const acrobatViewport = ctx?.getAcrobatViewport?.() || document.getElementById('acrobatViewport');
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
    if (!acrobatViewport || !pageStack) return;

    const viewportRect = acrobatViewport.getBoundingClientRect();
    let closestPage = null;
    let closestDistance = Infinity;

    pageStack.querySelectorAll('.continuous-page').forEach(pageFrame => {
      const rect = pageFrame.getBoundingClientRect();
      const distance = Math.abs((rect.top + rect.bottom) / 2 - (viewportRect.top + viewportRect.bottom) / 2);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestPage = pageFrame;
      }
      pageFrame.classList.toggle('current-page', false);
    });

    if (closestPage) {
      closestPage.classList.add('current-page');
      currentDoc.currentPage = Number(closestPage.dataset.page);
      if (pageNumberInput) {
        pageNumberInput.value = currentDoc.getActivePagesList().indexOf(currentDoc.currentPage) + 1;
      }
      if (ctx?.updateThumbnailActiveState) ctx.updateThumbnailActiveState();
    }
  }

  // --- Zoom & Fit Width Controls ---

  async function calculateFitWidthScale() {
    const currentDoc = getDoc();
    const currentScale = getScale();
    if (!currentDoc || !currentDoc.pdfJsDoc) return currentScale;

    try {
      const acrobatViewport = ctx?.getAcrobatViewport?.() || document.getElementById('acrobatViewport');
      const page = await currentDoc.pdfJsDoc.getPage(currentDoc.currentPage);
      const baseViewport = page.getViewport({ scale: 1 });
      const styles = window.getComputedStyle(acrobatViewport);
      const horizontalPadding = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
      const availableWidth = Math.max(240, acrobatViewport.clientWidth - horizontalPadding);
      return Math.min(3.0, Math.max(0.5, availableWidth / baseViewport.width));
    } catch (e) {
      return currentScale;
    }
  }

  function updateZoomIndicator() {
    const zoomSelect = document.getElementById('zoomSelect');
    if (!zoomSelect) return;
    const currentScale = getScale();
    const zoomPercent = `${Math.round(currentScale * 100)}%`;

    const matchingOption = Array.from(zoomSelect.options).find(option => {
      return option.value !== 'fitWidth' && Math.abs(parseFloat(option.value) - currentScale) < 0.001;
    });

    const customOption = zoomSelect.querySelector('[data-custom-zoom]');
    if (customOption) customOption.remove();

    if (matchingOption) {
      zoomSelect.value = matchingOption.value;
      return;
    }

    const option = document.createElement('option');
    option.value = 'custom';
    option.textContent = zoomPercent;
    option.dataset.customZoom = 'true';
    zoomSelect.appendChild(option);
    zoomSelect.value = 'custom';
  }

  async function applyZoomIn() {
    const currentScale = getScale();
    const newScale = Math.min(2.5, currentScale + 0.25);
    setScale(newScale);
    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomSelect) zoomSelect.value = newScale.toFixed(2);
    updateZoomIndicator();
    await renderCurrentPageView();
  }

  async function applyZoomOut() {
    const currentScale = getScale();
    const newScale = Math.max(0.5, currentScale - 0.25);
    setScale(newScale);
    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomSelect) zoomSelect.value = newScale.toFixed(2);
    updateZoomIndicator();
    await renderCurrentPageView();
  }

  async function applyFitWidth() {
    const fitScale = await calculateFitWidthScale();
    setScale(fitScale);
    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomSelect) zoomSelect.value = 'fitWidth';
    await renderCurrentPageView();
  }

  // --- View Mode & Navigation Helpers ---

  async function setViewMode(mode) {
    setViewModeState(mode);
    const currentDoc = getDoc();
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    if (!currentDoc) {
      if (pageStack) pageStack.dataset.viewMode = mode;
      return;
    }
    await renderCurrentPageView();
  }

  async function navigateToPage(targetPageNum) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activePages = currentDoc.getActivePagesList();
    if (!activePages.includes(targetPageNum)) return;
    currentDoc.currentPage = targetPageNum;

    const viewMode = getViewMode();
    if (viewMode === 'single') {
      await renderCurrentPageView();
    } else {
      const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
      const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
      const pageFrame = pageStack?.querySelector(`.continuous-page[data-page="${targetPageNum}"]`);
      if (pageFrame) {
        pageFrame.scrollIntoView({ behavior: 'smooth', block: 'start' });
        if (pageNumberInput) {
          pageNumberInput.value = activePages.indexOf(targetPageNum) + 1;
        }
        if (ctx?.updateThumbnailActiveState) ctx.updateThumbnailActiveState();
        if (ctx?.updateBookmarkActiveState) ctx.updateBookmarkActiveState();
      }
    }
  }

  async function goToPrevPage() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activePages = currentDoc.getActivePagesList();
    const curIdx = activePages.indexOf(currentDoc.currentPage);
    if (curIdx > 0) {
      await navigateToPage(activePages[curIdx - 1]);
    }
  }

  async function goToNextPage() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activePages = currentDoc.getActivePagesList();
    const curIdx = activePages.indexOf(currentDoc.currentPage);
    if (curIdx < activePages.length - 1) {
      await navigateToPage(activePages[curIdx + 1]);
    }
  }

  async function goToPageNumber(val) {
    const currentDoc = getDoc();
    const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
    if (!currentDoc) return;
    const activePages = currentDoc.getActivePagesList();
    if (!isNaN(val) && val >= 1 && val <= activePages.length) {
      await navigateToPage(activePages[val - 1]);
    } else if (pageNumberInput) {
      pageNumberInput.value = activePages.indexOf(currentDoc.currentPage) + 1;
    }
  }

  // --- Event Listeners Binding ---

  function bindEventListeners() {
    const acrobatViewport = document.getElementById('acrobatViewport');
    const zoomSelect = document.getElementById('zoomSelect');
    const zoomInBtn = document.getElementById('zoomInBtn');
    const zoomOutBtn = document.getElementById('zoomOutBtn');
    const fitWidthBtn = document.getElementById('fitWidthBtn');
    const menuZoomIn = document.getElementById('menuZoomIn');
    const menuZoomOut = document.getElementById('menuZoomOut');
    const menuFitWidth = document.getElementById('menuFitWidth');
    const menuViewSingle = document.getElementById('menuViewSingle');
    const menuViewContinuous = document.getElementById('menuViewContinuous');
    const menuViewTwoPage = document.getElementById('menuViewTwoPage');
    const menuViewTwoScroll = document.getElementById('menuViewTwoScroll');
    const prevPageBtn = document.getElementById('prevPageBtn');
    const nextPageBtn = document.getElementById('nextPageBtn');
    const pageNumberInput = document.getElementById('pageNumberInput');

    // Viewport Drag & Drop
    if (acrobatViewport) {
      acrobatViewport.addEventListener('dragover', (e) => e.preventDefault());
      acrobatViewport.addEventListener('drop', async (e) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          await openDocument(e.dataTransfer.files[0]);
        }
      });

      // Ctrl + Wheel Zoom
      acrobatViewport.addEventListener('wheel', async (event) => {
        const currentDoc = getDoc();
        if (!event.ctrlKey || !currentDoc) return;
        event.preventDefault();
        const currentScale = getScale();
        const zoomStep = event.deltaY < 0 ? 0.1 : -0.1;
        const newScale = Math.min(3.0, Math.max(0.5, currentScale + zoomStep));
        setScale(newScale);
        updateZoomIndicator();
        await renderCurrentPageView();
      }, { passive: false });

      // Continuous Viewport Scroll
      acrobatViewport.addEventListener('scroll', () => {
        const currentDoc = getDoc();
        const viewMode = getViewMode();
        if (!currentDoc || viewMode === 'single') return;
        syncCurrentPageFromScroll();
      });

      // ResizeObserver for Fit Width
      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(() => {
          const currentDoc = getDoc();
          if (!currentDoc || zoomSelect?.value !== 'fitWidth') return;
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(async () => {
            const fitScale = await calculateFitWidthScale();
            setScale(fitScale);
            await renderCurrentPageView();
          }, 120);
        });
        resizeObserver.observe(acrobatViewport);
      }
    }

    // Zoom Controls
    if (zoomSelect) {
      zoomSelect.addEventListener('change', async () => {
        if (zoomSelect.value === 'fitWidth') {
          const fitScale = await calculateFitWidthScale();
          setScale(fitScale);
        } else {
          setScale(parseFloat(zoomSelect.value));
        }
        await renderCurrentPageView();
      });
    }

    zoomInBtn?.addEventListener('click', applyZoomIn);
    zoomOutBtn?.addEventListener('click', applyZoomOut);
    fitWidthBtn?.addEventListener('click', applyFitWidth);
    menuZoomIn?.addEventListener('click', applyZoomIn);
    menuZoomOut?.addEventListener('click', applyZoomOut);
    menuFitWidth?.addEventListener('click', applyFitWidth);

    // View Modes
    menuViewSingle?.addEventListener('click', () => setViewMode('single'));
    menuViewContinuous?.addEventListener('click', () => setViewMode('continuous'));
    menuViewTwoPage?.addEventListener('click', () => setViewMode('two'));
    menuViewTwoScroll?.addEventListener('click', () => setViewMode('twoScroll'));

    // Navigation Buttons
    prevPageBtn?.addEventListener('click', goToPrevPage);
    nextPageBtn?.addEventListener('click', goToNextPage);

    if (pageNumberInput) {
      pageNumberInput.addEventListener('change', async () => {
        const val = parseInt(pageNumberInput.value, 10);
        await goToPageNumber(val);
      });
    }
  }

  return {
    init,
    openDocument,
    checkForRecovery,
    renderCurrentPageView,
    renderPageStack,
    syncCurrentPageFromScroll,
    calculateFitWidthScale,
    updateZoomIndicator,
    applyZoomIn,
    applyZoomOut,
    applyFitWidth,
    setViewMode,
    navigateToPage,
    goToPrevPage,
    goToNextPage,
    goToPageNumber
  };
})();
