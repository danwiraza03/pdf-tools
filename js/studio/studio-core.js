/**
 * js/studio/studio-core.js
 * PDF Studio - Core State, Undo/Redo Engine, Sub-module Orchestrator & App Lifecycle
 * Strict compliance with PROJECT_RULES.md (100% offline, zero emojis, clean SVGs)
 */
(function(window) {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  // Core State
  let currentDoc = null;
  let activeMode = 'select'; // 'select'|'edit'|'text'|'hand'|'draw'|'highlight'|'rect'|'circle'|'line'
  let currentScale = 1.0;
  let viewMode = 'continuous';
  let recoveryTimer = null;
  const undoStack = [];
  const commandManager = (window.PDFTools.CommandManager) ? new window.PDFTools.CommandManager(100) : null;

  function captureDocumentState() {
    if (!currentDoc) return null;
    return {
      pageRotations: { ...currentDoc.pageRotations },
      deletedPages: Array.from(currentDoc.deletedPages),
      pageOrder: [...currentDoc.pageOrder],
      annotations: structuredClone(currentDoc.annotations),
      currentPage: currentDoc.currentPage
    };
  }

  function recordDocumentState() {
    const state = captureDocumentState();
    if (state) undoStack.push({ type: 'state', state });
  }

  function setDocumentDirty(dirty) {
    if (!currentDoc) return;
    currentDoc.dirty = dirty;
    const tabDocName = document.getElementById('tabDocName');
    if (tabDocName) {
      tabDocName.textContent = `${currentDoc.fileName}${dirty ? ' *' : ''}`;
      tabDocName.title = dirty ? 'Unsaved changes' : currentDoc.fileName;
    }
  }

  function scheduleRecovery() {
    if (!currentDoc) return;
    setDocumentDirty(true);
    clearTimeout(recoveryTimer);
    recoveryTimer = setTimeout(async () => {
      try {
        if (window.PDFTools && window.PDFTools.Studio) {
          await window.PDFTools.Studio.saveRecoverySnapshot(currentDoc);
        }
      } catch (err) {
        console.warn('Recovery snapshot unavailable:', err);
      }
    }, 1200);
  }

  const performUndo = async () => {
    if (!currentDoc) return;
    const cmd = commandManager ? commandManager.undo() : null;
    if (cmd) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info(`Undone: ${cmd.name}`);
      scheduleRecovery();
    } else if (undoStack.length > 0) {
      const lastAction = undoStack.pop();
      const pageAnn = currentDoc.getPageAnnotation(lastAction.pageNum);
      if (lastAction.type === 'drawing') {
        pageAnn.drawings = (pageAnn.drawings || []).filter(d => d !== lastAction.item);
        if (window.PDFTools.StudioAnnotations?.redrawAnnotationLayer) {
          window.PDFTools.StudioAnnotations.redrawAnnotationLayer();
        }
      } else if (lastAction.type === 'shape') {
        pageAnn.shapes = (pageAnn.shapes || []).filter(s => s !== lastAction.item);
        if (window.PDFTools.StudioAnnotations?.redrawAnnotationLayer) {
          window.PDFTools.StudioAnnotations.redrawAnnotationLayer();
        }
      } else if (lastAction.type === 'text') {
        pageAnn.texts = (pageAnn.texts || []).filter(t => t.id !== lastAction.item.id);
        if (window.PDFTools.StudioTextWidgets?.renderActivePageWidgets) {
          window.PDFTools.StudioTextWidgets.renderActivePageWidgets();
        }
      } else if (lastAction.type === 'stamp') {
        pageAnn.stamps = (pageAnn.stamps || []).filter(s => s.id !== lastAction.item.id);
        if (window.PDFTools.StudioTextWidgets?.renderActivePageWidgets) {
          window.PDFTools.StudioTextWidgets.renderActivePageWidgets();
        }
      } else if (lastAction.type === 'edit') {
        pageAnn.edits = (pageAnn.edits || []).filter(edit => edit !== lastAction.item);
        if (window.PDFTools.StudioAnnotations?.redrawAnnotationLayer) {
          window.PDFTools.StudioAnnotations.redrawAnnotationLayer();
        }
        if (window.PDFTools.StudioTextEditor?.renderExistingTextLayer) {
          window.PDFTools.StudioTextEditor.renderExistingTextLayer();
        }
      }
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Action undone');
      scheduleRecovery();
    } else {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Nothing to undo.');
    }
  };

  const performRedo = async () => {
    if (!currentDoc) return;
    const cmd = commandManager ? commandManager.redo() : null;
    if (cmd) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info(`Redone: ${cmd.name}`);
      scheduleRecovery();
    } else {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Nothing to redo.');
    }
  };

  function triggerOpen() {
    const studioFileInput = document.getElementById('studioFileInput');
    if (studioFileInput) studioFileInput.click();
  }

  function closeDocument() {
    currentDoc = null;
    const tabDocName = document.getElementById('tabDocName');
    if (tabDocName) tabDocName.textContent = 'No file opened';
    const emptyDropzoneState = document.getElementById('emptyDropzoneState');
    if (emptyDropzoneState) emptyDropzoneState.style.display = 'block';
    const pageStack = document.getElementById('pageStack');
    if (pageStack) { pageStack.innerHTML = ''; pageStack.style.display = 'none'; }
    const sheetWrapper = document.getElementById('sheetWrapper');
    if (sheetWrapper) sheetWrapper.style.display = 'none';
    const thumbScrollList = document.getElementById('thumbnailContainer');
    if (thumbScrollList) thumbScrollList.innerHTML = '';
    const bookmarksContainer = document.getElementById('bookmarksContainer');
    if (bookmarksContainer) bookmarksContainer.innerHTML = '';
    const attachmentsContainer = document.getElementById('attachmentsContainer');
    if (attachmentsContainer) attachmentsContainer.innerHTML = '';
    if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Document closed.');
  }

  async function routeToTool(url) {
    if (currentDoc && currentDoc.originalFile && window.PDFTools.FileUtils && window.PDFTools.FileUtils.setPendingFile) {
      await window.PDFTools.FileUtils.setPendingFile(currentDoc.originalFile);
    }
    window.location.href = url;
  }

  function initTextEditedListener() {
    if (document.body.dataset.textEditedBound) return;
    document.body.dataset.textEditedBound = 'true';

    document.addEventListener('pdf-text-edited', async (e) => {
      const { line, newText, domElement, scale, deleted } = e.detail;
      if (!line || newText === undefined || newText === null || !currentDoc) return;
      
      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      if (!pageAnn.edits) pageAnn.edits = [];
      
      const run = (line.runs && line.runs[0]) || {};
      const font = run.font || {};
      const fontSize = font.size || 11;
      const fontFamily = font.normalizedFamily || font.family || 'Helvetica';
      const color = run.color || '#111827';
      const baselinePdfY = run.baselinePdfY !== undefined ? run.baselinePdfY : (line.bbox.y + fontSize);
      const baselineScreenY = run.baselineScreenY !== undefined ? run.baselineScreenY : (line.bbox.y + fontSize * 0.82);

      const pdfCanvas = document.getElementById('pdfCanvas');
      const sampledBg = window.PDFTools.BackgroundSampler && pdfCanvas
          ? window.PDFTools.BackgroundSampler.sampleBackground(
              pdfCanvas,
              line.bbox.x * currentScale,
              line.bbox.y * currentScale,
              line.bbox.width * currentScale,
              line.bbox.height * currentScale
          ) : '#ffffff';
      const finalBg = (sampledBg && sampledBg !== 'transparent') ? sampledBg : '#ffffff';

      const newX = e.detail.x !== undefined ? e.detail.x : line.bbox.x;
      const newY = e.detail.y !== undefined ? e.detail.y : line.bbox.y;
      const origX = e.detail.originalX !== undefined ? e.detail.originalX : line.bbox.x;
      const origY = e.detail.originalY !== undefined ? e.detail.originalY : line.bbox.y;
      const origW = e.detail.originalWidth !== undefined ? e.detail.originalWidth : line.bbox.width;
      const origH = e.detail.originalHeight !== undefined ? e.detail.originalHeight : line.bbox.height;

      const existingIndex = pageAnn.edits.findIndex(ed => 
        ed.lineId === line.id || 
        (Math.abs((ed.originalX !== undefined ? ed.originalX : ed.x) - line.bbox.x) < 4 && Math.abs((ed.originalY !== undefined ? ed.originalY : ed.y) - line.bbox.y) < 4) ||
        (Math.abs(ed.x - line.bbox.x) < 4 && Math.abs(ed.y - line.bbox.y) < 4)
      );

      const isDeleted = (newText === '' || deleted === true);

      let actualW = line.bbox.width;
      if (domElement) {
        const domRect = domElement.getBoundingClientRect();
        if (domRect && domRect.width > 0) {
          actualW = Math.max(actualW, domRect.width / currentScale);
        }
      }

      const editRecord = {
        id: existingIndex >= 0 ? pageAnn.edits[existingIndex].id : `edit_${Date.now()}`,
        lineId: line.id,
        originalText: line.text,
        text: newText,
        deleted: isDeleted,
        x: newX,
        y: newY,
        originalX: origX,
        originalY: origY,
        originalWidth: origW,
        originalHeight: origH,
        width: actualW,
        height: line.bbox.height,
        fontSize: fontSize,
        fontFamily: fontFamily,
        bold: !!font.bold,
        italic: !!font.italic,
        color: color,
        align: 'left',
        reflowMode: 'fixed',
        baselinePdfY: baselinePdfY,
        baselineScreenY: (run.baselineScreenY !== undefined) ? run.baselineScreenY : (line.bbox.y + fontSize * 0.82),
        backgroundColor: finalBg,
        runsToRemove: (line.runs || []).map(r => ({
          text: r.originalText || r.text,
          bbox: r.bbox
        }))
      };
      
      if (existingIndex >= 0) {
        pageAnn.edits[existingIndex] = editRecord;
      } else {
        pageAnn.edits.push(editRecord);
      }
      
      undoStack.push({ pageNum: currentDoc.currentPage, type: 'edit', item: editRecord });
      scheduleRecovery();
      if (window.PDFTools.StudioAnnotations?.redrawAnnotationLayer) {
        window.PDFTools.StudioAnnotations.redrawAnnotationLayer();
      }
      if (window.PDFTools.StudioTextEditor?.renderExistingTextLayer) {
        window.PDFTools.StudioTextEditor.renderExistingTextLayer();
      }
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(isDeleted ? 'Teks berhasil dihapus!' : 'Teks berhasil diperbarui!');
      }
    });
  }

  function initSubmodules() {
    // 1. StudioRenderer
    if (window.PDFTools.StudioRenderer) {
      window.PDFTools.StudioRenderer.init({
        getDoc: () => currentDoc,
        setDoc: (d) => { currentDoc = d; },
        getScale: () => currentScale,
        setScale: (s) => { currentScale = s; },
        getViewMode: () => viewMode,
        setViewModeState: (m) => { viewMode = m; },
        getUndoStack: () => undoStack,
        setDocumentDirty: (d) => setDocumentDirty(d),
        scheduleRecovery: () => scheduleRecovery(),
        redrawAnnotationLayer: () => window.PDFTools.StudioAnnotations?.redrawAnnotationLayer(),
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        updateThumbnailActiveState: () => window.PDFTools.StudioThumbnails?.updateThumbnailActiveState(),
        buildSidebarThumbnails: () => window.PDFTools.StudioThumbnails?.buildSidebarThumbnails(),
        buildSidebarBookmarks: () => window.PDFTools.StudioPanels?.buildSidebarBookmarks(),
        buildSidebarAttachments: () => window.PDFTools.StudioPanels?.buildSidebarAttachments(),
        updateBookmarkActiveState: () => window.PDFTools.StudioPanels?.updateBookmarkActiveState(),
        renderSinglePageSearchHighlights: () => window.PDFTools.StudioSearchOCR?.renderSinglePageSearchHighlights(),
        renderContinuousSearchHighlights: () => window.PDFTools.StudioSearchOCR?.renderContinuousSearchHighlights(),
        getTabDocName: () => document.getElementById('tabDocName'),
        getEmptyDropzoneState: () => document.getElementById('emptyDropzoneState'),
        getSheetWrapper: () => document.getElementById('sheetWrapper'),
        getPageStack: () => document.getElementById('pageStack'),
        getAcrobatViewport: () => document.getElementById('acrobatViewport'),
        getPdfCanvas: () => document.getElementById('pdfCanvas'),
        getAnnotationCanvas: () => document.getElementById('annotationCanvas'),
        getTotalPagesLabel: () => document.getElementById('totalPagesLabel'),
        getPageNumberInput: () => document.getElementById('pageNumberInput')
      });
    }

    // 2. StudioAnnotations
    if (window.PDFTools.StudioAnnotations) {
      window.PDFTools.StudioAnnotations.init({
        getDoc: () => currentDoc,
        getScale: () => currentScale,
        getActiveMode: () => activeMode,
        getAnnotationCanvas: () => document.getElementById('annotationCanvas'),
        getUndoStack: () => undoStack,
        scheduleRecovery: () => scheduleRecovery(),
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        openDocument: (f) => window.PDFTools.StudioRenderer?.openDocument(f),
        setDocumentDirty: (d) => setDocumentDirty(d),
        switchTool: (t) => window.PDFTools.StudioToolbar?.switchTool(t)
      });
    }

    // 3. StudioTextEditor
    if (window.PDFTools.StudioTextEditor) {
      window.PDFTools.StudioTextEditor.init({
        getDoc: () => currentDoc,
        getScale: () => currentScale,
        getActiveMode: () => activeMode,
        getViewMode: () => viewMode,
        setViewMode: async (m) => await window.PDFTools.StudioRenderer?.setViewMode(m),
        switchTool: (t) => window.PDFTools.StudioToolbar?.switchTool(t),
        redrawAnnotationLayer: () => window.PDFTools.StudioAnnotations?.redrawAnnotationLayer(),
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        scheduleRecovery: () => scheduleRecovery(),
        getUndoStack: () => undoStack,
        commitTextInPlace: (tw, el, item) => window.PDFTools.StudioTextWidgets?.commitTextInPlace(tw, el, item),
        getWidgetContainer: () => document.getElementById('widgetContainer'),
        getPdfCanvas: () => document.getElementById('pdfCanvas')
      });
    }

    // 4. StudioTextWidgets
    if (window.PDFTools.StudioTextWidgets) {
      window.PDFTools.StudioTextWidgets.init({
        getCurrentDoc: () => currentDoc,
        getCurrentScale: () => currentScale,
        getActiveMode: () => activeMode,
        getWidgetContainer: () => document.getElementById('widgetContainer'),
        getFormatPane: () => document.getElementById('formatPane'),
        getCommandManager: () => commandManager,
        scheduleRecovery: () => scheduleRecovery(),
        redrawAnnotationLayer: () => window.PDFTools.StudioAnnotations?.redrawAnnotationLayer(),
        renderExistingTextLayer: () => window.PDFTools.StudioTextEditor?.renderExistingTextLayer(),
        getActiveTextItem: () => window.PDFTools.StudioTextEditor?.getActiveTextItem(),
        setActiveText: (item, el) => window.PDFTools.StudioTextEditor?.setActiveText(item, el),
        isFormatPaneMouseDown: () => window.PDFTools.StudioTextEditor?.isFormatPaneMouseDown(),
        replaceImageInput: document.getElementById('replaceImageInput')
      });
    }

    // 5. StudioPanels
    if (window.PDFTools.StudioPanels) {
      window.PDFTools.StudioPanels.init({
        getDoc: () => currentDoc,
        scheduleRecovery: () => scheduleRecovery(),
        navigateToPage: (p) => window.PDFTools.StudioRenderer?.navigateToPage(p)
      });
    }

    // 6. StudioThumbnails
    if (window.PDFTools.StudioThumbnails) {
      window.PDFTools.StudioThumbnails.init({
        getDoc: () => currentDoc,
        getViewMode: () => viewMode,
        renderCurrentPageView: () => window.PDFTools.StudioRenderer?.renderCurrentPageView(),
        navigateToPage: (p) => window.PDFTools.StudioRenderer?.navigateToPage(p),
        recordDocumentState: () => recordDocumentState(),
        scheduleRecovery: () => scheduleRecovery(),
        getPageNumberInput: () => document.getElementById('pageNumberInput'),
        getTotalPagesLabel: () => document.getElementById('totalPagesLabel'),
        getThumbScrollList: () => document.getElementById('thumbnailContainer'),
        getThumbnailSidebar: () => document.getElementById('thumbnailSidebar')
      });
    }

    // 7. StudioSearchOCR
    if (window.PDFTools.StudioSearchOCR) {
      window.PDFTools.StudioSearchOCR.init({
        getDoc: () => currentDoc,
        getCurrentScale: () => currentScale,
        getViewMode: () => viewMode,
        renderCurrentPageView: () => window.PDFTools.StudioRenderer?.renderCurrentPageView(),
        updateThumbnailActiveState: () => window.PDFTools.StudioThumbnails?.updateThumbnailActiveState(),
        triggerOpen: () => triggerOpen(),
        setDocumentDirty: (d) => setDocumentDirty(d),
        scheduleRecovery: () => scheduleRecovery(),
        undoStack: undoStack,
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        getPageNumberInput: () => document.getElementById('pageNumberInput'),
        getAcrobatViewport: () => document.getElementById('acrobatViewport'),
        getPageStack: () => document.getElementById('pageStack'),
        getSearchHighlightLayer: () => document.getElementById('searchHighlightLayer'),
        getCommentsDrawer: () => document.getElementById('commentsDrawer')
      });
    }

    // 8. StudioSign
    if (window.PDFTools.StudioSign) {
      window.PDFTools.StudioSign.init({
        getDoc: () => currentDoc,
        getViewMode: () => viewMode,
        setViewMode: async (m) => {
          viewMode = m;
          if (window.PDFTools.StudioRenderer) await window.PDFTools.StudioRenderer.renderCurrentPageView();
        },
        switchTool: (t) => window.PDFTools.StudioToolbar?.switchTool(t),
        showRightFormatPanel: (s) => window.PDFTools.StudioTextEditor?.showRightFormatPanel(s),
        triggerOpen: () => triggerOpen(),
        undoStack: undoStack,
        setDocumentDirty: (d) => setDocumentDirty(d),
        scheduleRecovery: () => scheduleRecovery(),
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        focusLatestTextWidget: () => window.PDFTools.StudioTextWidgets?.focusLatestTextWidget()
      });
    }

    // 9. StudioModalsExport
    if (window.PDFTools.StudioModalsExport) {
      window.PDFTools.StudioModalsExport.init({
        getDoc: () => currentDoc,
        openDocument: (f) => window.PDFTools.StudioRenderer?.openDocument(f),
        setDocumentDirty: (d) => setDocumentDirty(d),
        scheduleRecovery: () => scheduleRecovery(),
        getTabDocName: () => document.getElementById('tabDocName'),
        getSavePdfBtn: () => document.getElementById('savePdfBtn')
      });
    }

    // 10. StudioToolbar
    if (window.PDFTools.StudioToolbar) {
      window.PDFTools.StudioToolbar.init({
        getDoc: () => currentDoc,
        getScale: () => currentScale,
        getActiveMode: () => activeMode,
        onActiveModeChanged: (m) => { activeMode = m; },
        getViewMode: () => viewMode,
        setViewMode: async (m) => {
          viewMode = m;
          if (window.PDFTools.StudioRenderer) await window.PDFTools.StudioRenderer.setViewMode(m);
        },
        updateAnnotationBar: (m) => window.PDFTools.StudioAnnotations?.updateAnnotationBar(m),
        showRightFormatPanel: (s) => window.PDFTools.StudioTextEditor?.showRightFormatPanel(s),
        renderActivePageWidgets: () => window.PDFTools.StudioTextWidgets?.renderActivePageWidgets(),
        renderExistingTextLayer: () => window.PDFTools.StudioTextEditor?.renderExistingTextLayer(),
        redrawAnnotationLayer: () => window.PDFTools.StudioAnnotations?.redrawAnnotationLayer(),
        focusLatestTextWidget: () => window.PDFTools.StudioTextWidgets?.focusLatestTextWidget(),
        scheduleRecovery: () => scheduleRecovery(),
        getUndoStack: () => undoStack,
        setActiveText: (item, el) => window.PDFTools.StudioTextEditor?.setActiveText(item, el),
        addFormMarkAtPoint: (type, x, y) => window.PDFTools.StudioSign?.addFormMarkAtPoint(type, x, y),
        openSaveAsModal: () => window.PDFTools.StudioModalsExport?.openSaveAsModal(),
        saveDocument: (name) => window.PDFTools.StudioModalsExport?.saveDocument(name),
        triggerOpen: () => triggerOpen(),
        triggerPrint: () => window.PDFTools.StudioModalsExport?.triggerPrint(),
        toggleFindBar: () => window.PDFTools.StudioSearchOCR?.toggleFindBar(),
        selectSearchMatch: (idx) => window.PDFTools.StudioSearchOCR?.selectSearchMatch(idx),
        performUndo: () => performUndo(),
        performRedo: () => performRedo(),
        activateExistingTextEditing: () => window.PDFTools.StudioTextEditor?.activateExistingTextEditing(),
        activateTextAdding: () => window.PDFTools.StudioTextEditor?.activateTextAdding(),
        triggerInsertPdf: (idx) => window.PDFTools.StudioThumbnails?.triggerInsertPdf(idx),
        renderCommentsList: () => window.PDFTools.StudioAnnotations?.renderCommentsList()
      });
    }
  }

  function init() {
    initSubmodules();
    initTextEditedListener();

    // Open file triggers
    const studioFileInput = document.getElementById('studioFileInput');
    const openDocBtn = document.getElementById('openDocBtn');
    const menuOpenDoc = document.getElementById('menuOpenDoc');
    const browsePdfBtn = document.getElementById('browsePdfBtn');

    if (openDocBtn) openDocBtn.addEventListener('click', triggerOpen);
    if (menuOpenDoc) menuOpenDoc.addEventListener('click', triggerOpen);
    if (browsePdfBtn) browsePdfBtn.addEventListener('click', triggerOpen);

    if (studioFileInput) {
      studioFileInput.addEventListener('change', async function () {
        if (studioFileInput.files && studioFileInput.files.length > 0) {
          if (window.PDFTools.StudioRenderer) {
            await window.PDFTools.StudioRenderer.openDocument(studioFileInput.files[0]);
          }
        }
      });
    }

    // Undo / Redo buttons
    const btnUndo = document.getElementById('btnUndo');
    const menuUndo = document.getElementById('menuUndo');
    const btnRedo = document.getElementById('btnRedo');
    const menuRedo = document.getElementById('menuRedo');

    if (btnUndo) btnUndo.addEventListener('click', performUndo);
    if (menuUndo) menuUndo.addEventListener('click', performUndo);
    if (btnRedo) btnRedo.addEventListener('click', performRedo);
    if (menuRedo) menuRedo.addEventListener('click', performRedo);

    // Close Document
    const menuCloseDoc = document.getElementById('menuCloseDoc');
    if (menuCloseDoc) {
      menuCloseDoc.addEventListener('click', closeDocument);
    }

    // Help & About
    const menuHelpAbout = document.getElementById('menuHelpAbout');
    if (menuHelpAbout) {
      menuHelpAbout.addEventListener('click', async () => {
        if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.alert) {
          await window.PDFTools.Modal.alert('PDF Studio Pro — 100% Offline Client-side PDF Suite.\nVersion 1.0.0\nAll files are processed locally in your browser.', { title: 'About PDF Studio Pro' });
        } else if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.info('PDF Studio Pro — 100% Offline Client-side PDF Suite.');
        }
      });
    }

    // External Tools Routing Map
    const toolMap = {
      'menuToolWatermark': 'watermark.html',
      'menuToolPageNumber': 'page-number.html',
      'menuToolProtect': 'protect.html'
    };
    Object.keys(toolMap).forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        el.addEventListener('click', () => routeToTool(toolMap[id]));
      }
    });

    // Language Change Listener
    window.addEventListener('pdftools:langchange', () => {
      if (currentDoc && window.PDFTools.StudioThumbnails) {
        window.PDFTools.StudioThumbnails.buildSidebarThumbnails();
      }
    });

    // Check for pending handoff file from homepage or recovery
    if (window.PDFTools.FileUtils && window.PDFTools.FileUtils.consumePendingFile) {
      window.PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file && window.PDFTools.StudioRenderer) {
          window.PDFTools.StudioRenderer.openDocument(file);
        } else if (window.PDFTools.StudioRenderer) {
          window.PDFTools.StudioRenderer.checkForRecovery();
        }
      });
    } else if (window.PDFTools.StudioRenderer) {
      window.PDFTools.StudioRenderer.checkForRecovery();
    }
  }

  window.PDFTools.StudioCore = {
    init,
    getDoc: () => currentDoc,
    setDoc: (d) => { currentDoc = d; },
    getScale: () => currentScale,
    setScale: (s) => { currentScale = s; },
    getActiveMode: () => activeMode,
    setActiveMode: (m) => { activeMode = m; },
    getViewMode: () => viewMode,
    setViewMode: (m) => { viewMode = m; },
    getUndoStack: () => undoStack,
    getCommandManager: () => commandManager,
    setDocumentDirty,
    scheduleRecovery,
    captureDocumentState,
    recordDocumentState,
    performUndo,
    performRedo,
    closeDocument,
    triggerOpen
  };

})(window);
