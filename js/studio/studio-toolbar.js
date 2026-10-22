/**
 * js/studio/studio-toolbar.js
 * PDF Studio - Toolbar, Tool Switching, Navigation Menus, and Viewport Interaction Controller
 * Strict compliance with PROJECT_RULES.md (100% offline, zero emojis, clean SVGs)
 */
(function(window) {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  let ctx = null;
  let activeMode = 'select';
  let isPanning = false;
  let panStartX = 0, panStartY = 0, scrollStartX = 0, scrollStartY = 0;
  let isAnyMenuOpen = false;
  let editModeIsActive = false;

  function init(context) {
    ctx = context || {};
    activeMode = (ctx.getActiveMode && ctx.getActiveMode()) || 'select';

    initToolButtons();
    initHandTool();
    initCanvasInteractions();
    initDropdownMenus();
    initToolsSearch();
    initGlobalShortcuts();
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : ctx?.currentDoc;
  }

  function getScale() {
    return (ctx && ctx.getScale ? ctx.getScale() : ctx?.currentScale) || 1.0;
  }

  function getViewMode() {
    return (ctx && ctx.getViewMode ? ctx.getViewMode() : ctx?.viewMode) || 'single';
  }

  async function setViewMode(mode) {
    if (ctx && ctx.setViewMode) await ctx.setViewMode(mode);
  }

  function getActiveMode() {
    return activeMode;
  }

  function setActiveMode(mode) {
    activeMode = mode;
    if (ctx && ctx.onActiveModeChanged) ctx.onActiveModeChanged(mode);
  }

  async function switchTool(mode) {
    setActiveMode(mode);

    const currentDoc = getDoc();
    const viewMode = getViewMode();
    if (mode !== 'select' && mode !== 'hand' && viewMode !== 'single' && currentDoc) {
      await setViewMode('single');
    }

    const toolSelect = document.getElementById('toolSelect');
    const toolHand = document.getElementById('toolHand');
    const toolEditPdf = document.getElementById('toolEditPdf');
    const toolText = document.getElementById('toolText');
    const toolHighlight = document.getElementById('toolHighlight');
    const toolDraw = document.getElementById('toolDraw');
    const toolRect = document.getElementById('toolRect');
    const toolCircle = document.getElementById('toolCircle');
    const toolLine = document.getElementById('toolLine');
    const toolSign = document.getElementById('toolSign');
    const toolComment = document.getElementById('toolComment');
    const toolRedact = document.getElementById('toolRedact');
    const toolForms = document.getElementById('toolForms');
    const toolOcr = document.getElementById('toolOcr');

    const allToolBtns = [
      toolSelect, toolHand, toolEditPdf, toolText, toolHighlight,
      toolDraw, toolRect, toolCircle, toolLine, toolSign, toolComment,
      toolRedact, toolForms, toolOcr
    ];
    allToolBtns.forEach(btn => { if (btn) btn.classList.remove('active'); });

    if (mode === 'select' && toolSelect) toolSelect.classList.add('active');
    if (mode === 'hand' && toolHand) toolHand.classList.add('active');
    if (mode === 'edit' && toolEditPdf) toolEditPdf.classList.add('active');
    if (mode === 'text' && toolText) toolText.classList.add('active');
    if (mode === 'highlight' && toolHighlight) toolHighlight.classList.add('active');
    if (mode === 'draw' && toolDraw) toolDraw.classList.add('active');
    if (mode === 'rect' && toolRect) toolRect.classList.add('active');
    if (mode === 'circle' && toolCircle) toolCircle.classList.add('active');
    if (mode === 'line' && toolLine) toolLine.classList.add('active');
    if (mode === 'comment' && toolComment) toolComment.classList.add('active');
    if (mode === 'redact' && toolRedact) toolRedact.classList.add('active');
    if (mode === 'forms' && toolForms) toolForms.classList.add('active');
    if (mode === 'fillSign' && toolSign) toolSign.classList.add('active');
    if (mode === 'ocr' && toolOcr) toolOcr.classList.add('active');

    // Synchronize right sidebar tools highlight
    document.querySelectorAll('.acrobat-tool-item').forEach(item => item.classList.remove('active'));
    if (mode === 'edit') document.getElementById('paneEditPdf')?.classList.add('active');
    if (mode === 'text') document.getElementById('paneAddText')?.classList.add('active');
    if (mode === 'fillSign') document.getElementById('paneFillSign')?.classList.add('active');
    if (mode === 'ocr') document.getElementById('paneScanOcr')?.classList.add('active');

    if (ctx && ctx.updateAnnotationBar) {
      ctx.updateAnnotationBar(mode);
    } else if (window.PDFTools.StudioAnnotations?.updateAnnotationBar) {
      window.PDFTools.StudioAnnotations.updateAnnotationBar(mode);
    }

    const editModeBar = document.getElementById('editModeBar');
    if (mode === 'edit' || mode === 'text') {
      editModeIsActive = true;
      if (editModeBar) editModeBar.classList.add('active');
      if (ctx && ctx.showRightFormatPanel) ctx.showRightFormatPanel(true);
      else if (window.PDFTools.StudioTextEditor?.showRightFormatPanel) window.PDFTools.StudioTextEditor.showRightFormatPanel(true);
    } else {
      editModeIsActive = false;
      if (editModeBar) editModeBar.classList.remove('active');
      if (ctx && ctx.showRightFormatPanel) ctx.showRightFormatPanel(false);
      else if (window.PDFTools.StudioTextEditor?.showRightFormatPanel) window.PDFTools.StudioTextEditor.showRightFormatPanel(false);
    }

    const fillSignModeBar = document.getElementById('fillSignModeBar');
    if (fillSignModeBar) {
      fillSignModeBar.style.display = (mode === 'fillSign') ? 'flex' : 'none';
    }

    const annotationCanvas = document.getElementById('annotationCanvas');
    const acrobatViewport = document.getElementById('acrobatViewport');
    if (annotationCanvas && acrobatViewport) {
      if (mode === 'edit' || mode === 'text') {
        annotationCanvas.style.cursor = 'text';
        acrobatViewport.style.cursor = 'text';
      } else if (mode === 'draw' || mode === 'highlight' || mode === 'rect' || mode === 'circle' || mode === 'line' || mode === 'redact' || mode === 'fillSign') {
        annotationCanvas.style.cursor = 'crosshair';
        acrobatViewport.style.cursor = 'crosshair';
      } else if (mode === 'comment') {
        annotationCanvas.style.cursor = 'pointer';
        acrobatViewport.style.cursor = 'pointer';
      } else if (mode === 'hand') {
        annotationCanvas.style.cursor = 'grab';
        acrobatViewport.style.cursor = 'grab';
      } else {
        annotationCanvas.style.cursor = 'default';
        acrobatViewport.style.cursor = 'default';
      }
    }

    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
    else if (window.PDFTools.StudioTextWidgets?.renderActivePageWidgets) window.PDFTools.StudioTextWidgets.renderActivePageWidgets();

    if (ctx && ctx.renderExistingTextLayer) ctx.renderExistingTextLayer();
    else if (window.PDFTools.StudioTextEditor?.renderExistingTextLayer) window.PDFTools.StudioTextEditor.renderExistingTextLayer();

    if (ctx && ctx.redrawAnnotationLayer) ctx.redrawAnnotationLayer();
    else if (window.PDFTools.StudioAnnotations?.redrawAnnotationLayer) window.PDFTools.StudioAnnotations.redrawAnnotationLayer();
  }

  function initToolButtons() {
    const bindClick = (id, fn) => {
      const el = document.getElementById(id);
      if (el && !el.dataset.toolbarBound) {
        el.dataset.toolbarBound = 'true';
        el.addEventListener('click', fn);
      }
    };

    bindClick('toolSelect', () => switchTool('select'));
    bindClick('toolHand', () => switchTool('hand'));
    bindClick('toolEditPdf', () => {
      if (ctx && ctx.activateExistingTextEditing) ctx.activateExistingTextEditing();
      else if (window.PDFTools.StudioTextEditor?.activateExistingTextEditing) window.PDFTools.StudioTextEditor.activateExistingTextEditing();
      else switchTool('edit');
    });
    bindClick('toolText', () => {
      if (ctx && ctx.activateTextAdding) ctx.activateTextAdding();
      else if (window.PDFTools.StudioTextEditor?.activateTextAdding) window.PDFTools.StudioTextEditor.activateTextAdding();
      else switchTool('text');
    });
    bindClick('toolHighlight', () => switchTool('highlight'));
    bindClick('toolDraw', () => switchTool('draw'));
    bindClick('toolRect', () => switchTool('rect'));
    bindClick('toolCircle', () => switchTool('circle'));
    bindClick('toolLine', () => switchTool('line'));
    bindClick('toolComment', () => {
      const doc = getDoc();
      if (!doc) {
        if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
        return;
      }
      const commentsDrawer = document.getElementById('commentsDrawer');
      if (commentsDrawer) commentsDrawer.classList.toggle('active');
      if (ctx && ctx.renderCommentsList) ctx.renderCommentsList();
      else if (window.PDFTools.StudioAnnotations?.renderCommentsList) window.PDFTools.StudioAnnotations.renderCommentsList();
      switchTool('comment');
    });
    bindClick('toolRedact', () => switchTool('redact'));
    bindClick('toolForms', () => switchTool('forms'));
    bindClick('menuAddShape', () => switchTool('rect'));

    // In-Studio Combine Files & Organize Pages Trigger
    bindClick('paneCombineFiles', (e) => {
      const doc = getDoc();
      if (doc) {
        e.preventDefault();
        if (ctx && ctx.triggerInsertPdf) ctx.triggerInsertPdf(doc.getActivePagesList().length);
        if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Select a PDF file to combine into current document...');
      } else {
        window.location.href = 'merge.html';
      }
    });

    bindClick('paneOrganizePages', (e) => {
      const doc = getDoc();
      if (doc) {
        e.preventDefault();
        const thumbnailSidebar = document.getElementById('thumbnailSidebar');
        const toggleThumbStrip = document.getElementById('toggleThumbStrip');
        const toggleBookmarksStrip = document.getElementById('toggleBookmarksStrip');
        const toggleAttachmentsStrip = document.getElementById('toggleAttachmentsStrip');
        const bookmarksSidebar = document.getElementById('bookmarksSidebar');
        const attachmentsSidebar = document.getElementById('attachmentsSidebar');

        if (thumbnailSidebar) thumbnailSidebar.style.display = 'block';
        if (toggleThumbStrip) toggleThumbStrip.classList.add('active');
        if (toggleBookmarksStrip) toggleBookmarksStrip.classList.remove('active');
        if (toggleAttachmentsStrip) toggleAttachmentsStrip.classList.remove('active');
        if (bookmarksSidebar) bookmarksSidebar.style.display = 'none';
        if (attachmentsSidebar) attachmentsSidebar.style.display = 'none';
        if (window.PDFTools?.Toast) {
          window.PDFTools.Toast.info('Organize Pages active: Drag & drop page thumbnails on the left panel to reorder, duplicate, or delete pages.');
        }
      } else {
        window.location.href = 'split.html';
      }
    });
  }

  function initHandTool() {
    const acrobatViewport = document.getElementById('acrobatViewport');
    if (!acrobatViewport || acrobatViewport.dataset.handBound) return;
    acrobatViewport.dataset.handBound = 'true';

    acrobatViewport.addEventListener('mousedown', (e) => {
      if (activeMode === 'hand') {
        isPanning = true;
        panStartX = e.clientX;
        panStartY = e.clientY;
        scrollStartX = acrobatViewport.scrollLeft;
        scrollStartY = acrobatViewport.scrollTop;
        acrobatViewport.style.cursor = 'grabbing';
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (isPanning && activeMode === 'hand') {
        const dx = e.clientX - panStartX;
        const dy = e.clientY - panStartY;
        acrobatViewport.scrollLeft = scrollStartX - dx;
        acrobatViewport.scrollTop = scrollStartY - dy;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isPanning) {
        isPanning = false;
        acrobatViewport.style.cursor = activeMode === 'hand' ? 'grab' : 'default';
      }
    });
  }

  function initCanvasInteractions() {
    const annotationCanvas = document.getElementById('annotationCanvas');
    if (!annotationCanvas || annotationCanvas.dataset.canvasBound) return;
    annotationCanvas.dataset.canvasBound = 'true';

    annotationCanvas.addEventListener('mousedown', async (e) => {
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const currentScale = getScale();
      const rect = annotationCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / currentScale;
      const clickY = (e.clientY - rect.top) / currentScale;

      if (activeMode === 'select') {
        const widgetContainer = document.getElementById('widgetContainer');
        if (widgetContainer) {
          widgetContainer.querySelectorAll('.studio-text-widget').forEach(w => w.classList.remove('selected'));
        }
        if (ctx && ctx.setActiveText) ctx.setActiveText(null, null);
        else if (window.PDFTools.StudioTextEditor?.setActiveText) window.PDFTools.StudioTextEditor.setActiveText(null, null);
      }

      if (activeMode === 'fillSign') {
        const subTool = window.PDFTools.StudioSign ? window.PDFTools.StudioSign.getActiveSubTool() : 'text';
        if (ctx && ctx.addFormMarkAtPoint) {
          ctx.addFormMarkAtPoint(subTool, clickX, clickY);
        } else if (window.PDFTools.StudioSign?.addFormMarkAtPoint) {
          window.PDFTools.StudioSign.addFormMarkAtPoint(subTool, clickX, clickY);
        }
        return;
      }

      if (activeMode === 'text') {
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        let inferredStyle = window.PDFTools.FontIntelligenceEngine ? window.PDFTools.FontIntelligenceEngine.getDefaultStyle() : { size: 14, family: 'Helvetica', color: '#000000' };
        try {
          const page = await currentDoc.pdfJsDoc.getPage(currentDoc.currentPage);
          const pdfCanvas = document.getElementById('pdfCanvas');
          if (window.PDFTools.PDFTextExtractor && window.PDFTools.FontIntelligenceEngine) {
            const textRuns = await window.PDFTools.PDFTextExtractor.extractPageTextRuns(page, currentDoc.currentPage, 0, pdfCanvas);
            inferredStyle = window.PDFTools.FontIntelligenceEngine.inferStyleAtPoint(textRuns, clickX, clickY);
            if (inferredStyle.confidence > 0 && window.PDFTools.Toast) {
              window.PDFTools.Toast.info(`Font matched: ${inferredStyle.family} ${inferredStyle.size}pt`);
            }
          }
        } catch (err) {
          console.warn('Failed to infer text style:', err);
        }

        const newText = {
          id: 'text_' + Date.now(),
          text: 'Type text here...',
          x: clickX,
          y: clickY,
          fontSize: inferredStyle.size || 14,
          fontFamily: inferredStyle.family || 'Helvetica',
          bold: inferredStyle.bold || inferredStyle.weight === 'bold',
          italic: inferredStyle.italic,
          color: inferredStyle.color || '#000000',
          headerOffsetY: 0
        };
        pageAnn.texts.push(newText);
        const undoStack = (ctx && ctx.getUndoStack ? ctx.getUndoStack() : ctx?.undoStack) || [];
        undoStack.push({ pageNum: currentDoc.currentPage, type: 'text', item: newText });

        if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
        if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
        else if (window.PDFTools.StudioTextWidgets?.renderActivePageWidgets) window.PDFTools.StudioTextWidgets.renderActivePageWidgets();

        if (ctx && ctx.focusLatestTextWidget) ctx.focusLatestTextWidget();
        else if (window.PDFTools.StudioTextWidgets?.focusLatestTextWidget) window.PDFTools.StudioTextWidgets.focusLatestTextWidget();
        return;
      }

      if (['comment', 'draw', 'highlight', 'rect', 'circle', 'line', 'redact'].includes(activeMode)) {
        await window.PDFTools.StudioAnnotations?.handleCanvasMouseDown(e, clickX, clickY);
        return;
      }
    });

    annotationCanvas.addEventListener('dblclick', (e) => {
      const currentDoc = getDoc();
      if (!currentDoc) return;
      if (activeMode !== 'text' && activeMode !== 'edit') return;
      const currentScale = getScale();
      const rect = annotationCanvas.getBoundingClientRect();
      const clickX = (e.clientX - rect.left) / currentScale;
      const clickY = (e.clientY - rect.top) / currentScale;

      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      const newText = {
        id: 'text_' + Date.now(),
        text: 'New text',
        x: clickX,
        y: clickY,
        fontSize: 14,
        fontFamily: 'Helvetica',
        bold: false,
        italic: false,
        color: '#000000',
        headerOffsetY: 0
      };
      pageAnn.texts.push(newText);
      const undoStack = (ctx && ctx.getUndoStack ? ctx.getUndoStack() : ctx?.undoStack) || [];
      undoStack.push({ pageNum: currentDoc.currentPage, type: 'text', item: newText });

      if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
      if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
      else if (window.PDFTools.StudioTextWidgets?.renderActivePageWidgets) window.PDFTools.StudioTextWidgets.renderActivePageWidgets();

      if (ctx && ctx.focusLatestTextWidget) ctx.focusLatestTextWidget();
      else if (window.PDFTools.StudioTextWidgets?.focusLatestTextWidget) window.PDFTools.StudioTextWidgets.focusLatestTextWidget();
    });
  }

  function initDropdownMenus() {
    const dropdownWrappers = document.querySelectorAll('.acrobat-dropdown-wrapper');

    dropdownWrappers.forEach(wrapper => {
      if (wrapper.dataset.dropdownBound) return;
      wrapper.dataset.dropdownBound = 'true';

      const menuItem = wrapper.querySelector('.acrobat-menu-item');
      if (!menuItem) return;

      menuItem.addEventListener('click', (e) => {
        e.stopPropagation();
        const wasActive = wrapper.classList.contains('active');
        dropdownWrappers.forEach(w => w.classList.remove('active'));
        if (!wasActive) {
          wrapper.classList.add('active');
          isAnyMenuOpen = true;
        } else {
          isAnyMenuOpen = false;
        }
      });

      wrapper.addEventListener('mouseenter', () => {
        if (isAnyMenuOpen) {
          dropdownWrappers.forEach(w => w.classList.remove('active'));
          wrapper.classList.add('active');
        }
      });
    });

    if (!document.body.dataset.dropdownOutsideBound) {
      document.body.dataset.dropdownOutsideBound = 'true';
      document.addEventListener('click', () => {
        dropdownWrappers.forEach(w => w.classList.remove('active'));
        isAnyMenuOpen = false;
      });

      document.querySelectorAll('.acrobat-menu-link').forEach(link => {
        link.addEventListener('click', () => {
          dropdownWrappers.forEach(w => w.classList.remove('active'));
          isAnyMenuOpen = false;
        });
      });
    }
  }

  function initToolsSearch() {
    const searchToolsInput = document.getElementById('searchToolsInput');
    if (!searchToolsInput || searchToolsInput.dataset.searchBound) return;
    searchToolsInput.dataset.searchBound = 'true';

    searchToolsInput.addEventListener('input', () => {
      const query = searchToolsInput.value.toLowerCase().trim();
      document.querySelectorAll('.acrobat-tool-item').forEach(item => {
        const name = (item.getAttribute('data-name') || '') + item.innerText.toLowerCase();
        item.style.display = name.includes(query) ? 'flex' : 'none';
      });
    });
  }

  function initGlobalShortcuts() {
    if (document.body.dataset.shortcutsBound) return;
    document.body.dataset.shortcutsBound = 'true';

    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (ctx && ctx.openSaveAsModal) ctx.openSaveAsModal();
        else if (window.PDFTools.StudioModalsExport?.openSaveAsModal) window.PDFTools.StudioModalsExport.openSaveAsModal();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (ctx && ctx.saveDocument) ctx.saveDocument();
        else if (window.PDFTools.StudioModalsExport?.saveDocument) window.PDFTools.StudioModalsExport.saveDocument();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        if (ctx && ctx.triggerOpen) ctx.triggerOpen();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        if (ctx && ctx.triggerPrint) ctx.triggerPrint();
        else if (window.PDFTools.StudioModalsExport?.triggerPrint) window.PDFTools.StudioModalsExport.triggerPrint();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (ctx && ctx.toggleFindBar) ctx.toggleFindBar();
        else if (window.PDFTools.StudioSearchOCR?.toggleFindBar) window.PDFTools.StudioSearchOCR.toggleFindBar();
      } else if (e.key === 'F3') {
        e.preventDefault();
        const matches = window.PDFTools.StudioSearchOCR ? window.PDFTools.StudioSearchOCR.getSearchMatches() : [];
        const curIdx = window.PDFTools.StudioSearchOCR ? window.PDFTools.StudioSearchOCR.getCurrentMatchIdx() : -1;
        if (matches.length > 0) {
          if (ctx && ctx.selectSearchMatch) ctx.selectSearchMatch(curIdx + (e.shiftKey ? -1 : 1));
          else if (window.PDFTools.StudioSearchOCR?.selectSearchMatch) window.PDFTools.StudioSearchOCR.selectSearchMatch(curIdx + (e.shiftKey ? -1 : 1));
        } else {
          if (ctx && ctx.toggleFindBar) ctx.toggleFindBar();
          else if (window.PDFTools.StudioSearchOCR?.toggleFindBar) window.PDFTools.StudioSearchOCR.toggleFindBar();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.target.tagName === 'INPUT' || (e.target.isContentEditable && e.target.classList.contains('studio-text-content'))) {
          return;
        }
        e.preventDefault();
        if (e.shiftKey) {
          if (ctx && ctx.performRedo) ctx.performRedo();
        } else {
          if (ctx && ctx.performUndo) ctx.performUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        if (e.target.tagName === 'INPUT' || (e.target.isContentEditable && e.target.classList.contains('studio-text-content'))) {
          return;
        }
        e.preventDefault();
        if (ctx && ctx.performRedo) ctx.performRedo();
      } else if (e.key === 'PageDown' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        const nextPageBtn = document.getElementById('nextPageBtn');
        if (nextPageBtn) nextPageBtn.click();
      } else if (e.key === 'PageUp' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        const prevPageBtn = document.getElementById('prevPageBtn');
        if (prevPageBtn) prevPageBtn.click();
      }
    });
  }

  window.PDFTools.StudioToolbar = {
    init,
    switchTool,
    getActiveMode,
    setActiveMode,
    initToolButtons,
    initHandTool,
    initCanvasInteractions,
    initDropdownMenus,
    initToolsSearch,
    initGlobalShortcuts
  };

})(window);
