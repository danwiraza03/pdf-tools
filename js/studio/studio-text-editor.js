/**
 * PDF Tools — PDF Studio Text Editor & Format Controller
 * Manages existing document text editing via TextEditEngine, text block extraction,
 * auto-OCR fallback for scanned pages, secondary edit mode toolbar,
 * image stamp placement, and right formatting panel synchronization.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioTextEditor = (function () {
  let ctx = null;

  // Active text editing state
  let activeTextItem = null;
  let activeTextContentEl = null;
  let editModeIsActive = false;
  let formatPaneMouseDown = false;
  let textEditEngine = null;

  // Cached DOM Elements
  let widgetContainer = null;
  let pdfCanvas = null;
  let editModeBar = null;
  let closeEditModeBtn = null;
  let subToolEdit = null;
  let subToolAddText = null;
  let subToolAddImage = null;
  let subToolWatermark = null;
  let studioImageInput = null;

  let formatPane = null;
  let standardToolsPane = null;
  let formatStatusText = null;
  let rightFontFamily = null;
  let rightFontSize = null;
  let rightFontColor = null;
  let rightColorPreview = null;
  let rightBoldBtn = null;
  let rightItalicBtn = null;
  let rightAlignLeft = null;
  let rightAlignCenter = null;
  let rightAlignRight = null;
  let rightDoneEditBtn = null;

  let objAddRect = null;
  let objAddCircle = null;
  let objAddLine = null;
  let objAddSign = null;

  let paneEditPdf = null;
  let menuEditPdf = null;
  let paneAddText = null;
  let menuAddText = null;
  let toolEditPdf = null;
  let toolText = null;

  function init(context) {
    ctx = context;
    cacheElements();
    bindEventListeners();
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : null;
  }

  function getScale() {
    return ctx && ctx.getScale ? ctx.getScale() : 1.0;
  }

  function getActiveMode() {
    return ctx && ctx.getActiveMode ? ctx.getActiveMode() : 'select';
  }

  function getViewMode() {
    return ctx && ctx.getViewMode ? ctx.getViewMode() : 'continuous';
  }

  function setViewMode(mode) {
    if (ctx && ctx.setViewMode) return ctx.setViewMode(mode);
    return Promise.resolve();
  }

  function switchTool(tool) {
    if (ctx && ctx.switchTool) ctx.switchTool(tool);
  }

  function redrawAnnotationLayer() {
    if (ctx && ctx.redrawAnnotationLayer) ctx.redrawAnnotationLayer();
  }

  function renderActivePageWidgets() {
    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  function getUndoStack() {
    return (ctx && ctx.getUndoStack ? ctx.getUndoStack() : ctx?.undoStack) || [];
  }

  function cacheElements() {
    widgetContainer = (ctx && ctx.getWidgetContainer && ctx.getWidgetContainer()) || document.getElementById('widgetContainer');
    pdfCanvas = (ctx && ctx.getPdfCanvas && ctx.getPdfCanvas()) || document.getElementById('pdfCanvas');

    editModeBar = document.getElementById('editModeBar');
    closeEditModeBtn = document.getElementById('closeEditModeBtn');
    subToolEdit = document.getElementById('subToolEdit');
    subToolAddText = document.getElementById('subToolAddText');
    subToolAddImage = document.getElementById('subToolAddImage');
    subToolWatermark = document.getElementById('subToolWatermark');
    studioImageInput = document.getElementById('studioImageInput');

    formatPane = document.getElementById('formatPane');
    standardToolsPane = document.getElementById('standardToolsPane');
    formatStatusText = document.getElementById('formatStatusText');
    rightFontFamily = document.getElementById('rightFontFamily');
    rightFontSize = document.getElementById('rightFontSize');
    rightFontColor = document.getElementById('rightFontColor');
    rightColorPreview = document.getElementById('rightColorPreview');
    rightBoldBtn = document.getElementById('rightBoldBtn');
    rightItalicBtn = document.getElementById('rightItalicBtn');
    rightAlignLeft = document.getElementById('rightAlignLeft');
    rightAlignCenter = document.getElementById('rightAlignCenter');
    rightAlignRight = document.getElementById('rightAlignRight');
    rightDoneEditBtn = document.getElementById('rightDoneEditBtn');

    objAddRect = document.getElementById('objAddRect');
    objAddCircle = document.getElementById('objAddCircle');
    objAddLine = document.getElementById('objAddLine');
    objAddSign = document.getElementById('objAddSign');

    paneEditPdf = document.getElementById('paneEditPdf');
    menuEditPdf = document.getElementById('menuEditPdf');
    paneAddText = document.getElementById('paneAddText');
    menuAddText = document.getElementById('menuAddText');
    toolEditPdf = document.getElementById('toolEditPdf');
    toolText = document.getElementById('toolText');
  }

  function getFontFamilyCSS(f) {
    if (window.PDFTools && typeof window.PDFTools.fontFamilyCSS === 'function') {
      return window.PDFTools.fontFamilyCSS(f);
    }
    if (!f) return 'Helvetica, Arial, sans-serif';
    return `${f}, Arial, sans-serif`;
  }

  async function renderExistingTextLayer() {
    const currentDoc = getDoc();
    const activeMode = getActiveMode();
    const currentScale = getScale();

    if (!textEditEngine && widgetContainer) {
      textEditEngine = new window.PDFTools.TextEditEngine(widgetContainer, setActiveText);
    }
    if (textEditEngine) {
      textEditEngine.clear();
    }
    if (!currentDoc || activeMode !== 'edit' || !textEditEngine) return;

    try {
      const page = await currentDoc.pdfJsDoc.getPage(currentDoc.currentPage);
      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      const edits = pageAnn.edits || [];

      // 1. Extract raw runs with page rotation support
      const extraRot = (currentDoc.pageRotations && currentDoc.pageRotations[currentDoc.currentPage]) || 0;
      const textRuns = await window.PDFTools.PDFTextExtractor.extractPageTextRuns(page, currentDoc.currentPage, extraRot, pdfCanvas);

      // 2. Group into blocks
      let blocks = window.PDFTools.TextBlockDetector.groupRuns(textRuns);

      // 3. Acrobat-style Auto-OCR for Scanned Documents / Image Pages
      if (!blocks || blocks.length === 0) {
        if (pageAnn.ocrBlocks && pageAnn.ocrBlocks.length > 0) {
          blocks = pageAnn.ocrBlocks;
        } else if (window.PDFTools.OCR && window.PDFTools.OCRLayoutEngine) {
          if (window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Scanned page detected. Running OCR to make text editable...', 3500);
          }
          try {
            const ocrCanvas = document.createElement('canvas');
            const ocrScale = 2.0;
            await window.PDFTools.Studio.renderPage(currentDoc, currentDoc.currentPage, ocrCanvas, ocrScale);

            const langSelect = document.getElementById('ocrLangSelect');
            const lang = (langSelect && langSelect.value) ? langSelect.value : 'ind+eng';

            const ocrData = await window.PDFTools.OCR.recognizeCanvas(ocrCanvas, lang);

            if (ocrData && ((ocrData.lines && ocrData.lines.length > 0) || (ocrData.paragraphs && ocrData.paragraphs.length > 0))) {
              blocks = window.PDFTools.OCRLayoutEngine.constructLayoutBlocks(ocrData, ocrScale, currentDoc.currentPage);
              pageAnn.ocrBlocks = blocks;
              if (window.PDFTools.Toast) {
                window.PDFTools.Toast.success('OCR Complete! Click any text to edit directly.');
              }
            } else {
              if (window.PDFTools.Toast) {
                window.PDFTools.Toast.info('No text detected on this scanned page.');
              }
              return;
            }
          } catch (ocrErr) {
            console.warn('Auto-OCR in Edit PDF failed:', ocrErr);
            if (window.PDFTools.Toast) {
              window.PDFTools.Toast.info('No editable text found. You can add text using "Add Text".');
            }
            return;
          }
        } else {
          if (window.PDFTools.Toast) {
            window.PDFTools.Toast.info('No editable text found on this page.');
          }
          return;
        }
      }

      // 4. Render blocks
      textEditEngine.renderBlocks(blocks, currentScale, edits);
    } catch (err) {
      console.warn('Existing text extraction failed:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error('Edit PDF Error: ' + err.message);
      }
    }
  }

  function setActiveText(textItem, contentEl) {
    activeTextItem = textItem;
    activeTextContentEl = contentEl;

    if (!formatStatusText) {
      formatStatusText = document.getElementById('formatStatusText');
    }

    if (textItem && contentEl) {
      if (formatStatusText) {
        const preview = (textItem.text || '').replace(/\s+/g, ' ').trim();
        formatStatusText.textContent = 'Menyunting: "' + (preview.length > 22 ? preview.substring(0, 22) + '...' : preview) + '"';
      }
      // Sync Right Panel with active text
      let fontVal = textItem.fontFamily || 'Helvetica';
      if (rightFontFamily) {
        let matched = Array.from(rightFontFamily.options).some(opt => opt.value.toLowerCase() === fontVal.toLowerCase());
        if (!matched && fontVal) {
          const newOpt = document.createElement('option');
          newOpt.value = fontVal;
          newOpt.textContent = fontVal;
          rightFontFamily.appendChild(newOpt);
        }
        rightFontFamily.value = fontVal;
      }
      if (rightFontSize) rightFontSize.value = (textItem.fontSize || 14).toString();
      if (rightFontColor) rightFontColor.value = textItem.color || '#000000';
      if (rightColorPreview) rightColorPreview.style.background = textItem.color || '#000000';
      if (rightBoldBtn) rightBoldBtn.classList.toggle('active', !!textItem.bold);
      if (rightItalicBtn) rightItalicBtn.classList.toggle('active', !!textItem.italic);

      // Sync Alignment buttons
      const align = textItem.align || 'left';
      if (rightAlignLeft) rightAlignLeft.classList.toggle('active', align === 'left');
      if (rightAlignCenter) rightAlignCenter.classList.toggle('active', align === 'center');
      if (rightAlignRight) rightAlignRight.classList.toggle('active', align === 'right');
      showRightFormatPanel(true);
    } else {
      if (formatStatusText) {
        formatStatusText.textContent = 'Klik teks pada dokumen untuk menyunting';
      }
    }
  }

  function showRightFormatPanel(show) {
    const activeMode = getActiveMode();
    if (show) {
      if (formatPane) formatPane.classList.add('active');
      if (standardToolsPane) standardToolsPane.style.display = 'none';
      if (editModeBar) editModeBar.classList.add('active');
    } else {
      if (formatPane) formatPane.classList.remove('active');
      if (standardToolsPane) standardToolsPane.style.display = 'block';
      if (activeMode !== 'edit' && activeMode !== 'text') {
        if (editModeBar) editModeBar.classList.remove('active');
      }
    }
  }

  function refocusActiveText() {
    if (activeTextContentEl) {
      setTimeout(() => {
        if (activeTextContentEl) activeTextContentEl.focus();
      }, 0);
    }
  }

  async function activateExistingTextEditing() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Please open a PDF document first.');
      }
      return;
    }
    if (subToolEdit) subToolEdit.classList.add('active');
    if (subToolAddText) subToolAddText.classList.remove('active');
    showRightFormatPanel(true);
    if (getViewMode() !== 'single') {
      await setViewMode('single');
    }
    switchTool('edit');
    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.info('Click any text block on the page to edit directly.');
    }
  }

  async function activateTextAdding() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Please open a PDF document first.');
      }
      return;
    }
    if (subToolEdit) subToolEdit.classList.remove('active');
    if (subToolAddText) subToolAddText.classList.add('active');
    showRightFormatPanel(true);
    if (getViewMode() !== 'single') {
      await setViewMode('single');
    }
    switchTool('text');
    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.info('Click anywhere on the page to add a new text box.');
    }
  }

  function commitActiveTextIfAny() {
    if (activeTextContentEl) {
      if (typeof activeTextContentEl.commitEdit === 'function') {
        activeTextContentEl.commitEdit();
      } else {
        const blockEl = activeTextContentEl.closest('.studio-text-block-edit');
        if (blockEl && typeof blockEl.commitEdit === 'function') {
          blockEl.commitEdit();
        }
      }
      if (activeTextItem && ctx && ctx.commitTextInPlace) {
        const tw = activeTextContentEl.closest('.studio-text-widget');
        if (tw) ctx.commitTextInPlace(tw, activeTextContentEl, activeTextItem);
      }
    }
  }

  function bindEventListeners() {
    if (formatPane) {
      formatPane.addEventListener('mousedown', (e) => {
        const tag = e.target.tagName;
        formatPaneMouseDown = true;
        setTimeout(() => { formatPaneMouseDown = false; }, 300);
        if (tag === 'SELECT' || tag === 'INPUT') return;
        if (activeTextContentEl) {
          e.preventDefault();
        }
      });
    }

    if (rightFontFamily) {
      rightFontFamily.addEventListener('change', () => {
        if (!activeTextItem || !activeTextContentEl) return;
        activeTextItem.fontFamily = rightFontFamily.value;
        activeTextContentEl.style.fontFamily = getFontFamilyCSS(activeTextItem.fontFamily);
        scheduleRecovery();
        refocusActiveText();
      });
    }

    if (rightFontSize) {
      rightFontSize.addEventListener('change', () => {
        if (!activeTextItem || !activeTextContentEl) return;
        activeTextItem.fontSize = parseInt(rightFontSize.value, 10);
        activeTextContentEl.style.fontSize = `${activeTextItem.fontSize * getScale()}px`;
        scheduleRecovery();
        refocusActiveText();
      });
    }

    if (rightFontColor) {
      rightFontColor.addEventListener('input', () => {
        if (!activeTextItem || !activeTextContentEl) return;
        activeTextItem.color = rightFontColor.value;
        if (rightColorPreview) rightColorPreview.style.background = activeTextItem.color;
        activeTextContentEl.style.color = activeTextItem.color;
        activeTextContentEl.style.webkitTextFillColor = activeTextItem.color;
        scheduleRecovery();
      });
    }

    if (rightBoldBtn) {
      rightBoldBtn.addEventListener('click', () => {
        if (!activeTextItem || !activeTextContentEl) return;
        activeTextItem.bold = !activeTextItem.bold;
        rightBoldBtn.classList.toggle('active', activeTextItem.bold);
        activeTextContentEl.style.fontWeight = activeTextItem.bold ? 'bold' : 'normal';
        scheduleRecovery();
      });
    }

    if (rightItalicBtn) {
      rightItalicBtn.addEventListener('click', () => {
        if (!activeTextItem || !activeTextContentEl) return;
        activeTextItem.italic = !activeTextItem.italic;
        rightItalicBtn.classList.toggle('active', activeTextItem.italic);
        activeTextContentEl.style.fontStyle = activeTextItem.italic ? 'italic' : 'normal';
        scheduleRecovery();
      });
    }

    if (rightAlignLeft) {
      rightAlignLeft.addEventListener('click', () => {
        if (!activeTextContentEl) return;
        activeTextContentEl.style.textAlign = 'left';
        if (activeTextItem) activeTextItem.align = 'left';
        rightAlignLeft.classList.add('active');
        if (rightAlignCenter) rightAlignCenter.classList.remove('active');
        if (rightAlignRight) rightAlignRight.classList.remove('active');
        scheduleRecovery();
      });
    }

    if (rightAlignCenter) {
      rightAlignCenter.addEventListener('click', () => {
        if (!activeTextContentEl) return;
        activeTextContentEl.style.textAlign = 'center';
        if (activeTextItem) activeTextItem.align = 'center';
        if (rightAlignLeft) rightAlignLeft.classList.remove('active');
        rightAlignCenter.classList.add('active');
        if (rightAlignRight) rightAlignRight.classList.remove('active');
        scheduleRecovery();
      });
    }

    if (rightAlignRight) {
      rightAlignRight.addEventListener('click', () => {
        if (!activeTextContentEl) return;
        activeTextContentEl.style.textAlign = 'right';
        if (activeTextItem) activeTextItem.align = 'right';
        if (rightAlignLeft) rightAlignLeft.classList.remove('active');
        if (rightAlignCenter) rightAlignCenter.classList.remove('active');
        rightAlignRight.classList.add('active');
        scheduleRecovery();
      });
    }

    if (rightDoneEditBtn) {
      rightDoneEditBtn.addEventListener('click', () => {
        commitActiveTextIfAny();
        setActiveText(null, null);
        redrawAnnotationLayer();
        renderExistingTextLayer();
      });
    }

    if (objAddRect) objAddRect.addEventListener('click', () => switchTool('rect'));
    if (objAddCircle) objAddCircle.addEventListener('click', () => switchTool('circle'));
    if (objAddLine) objAddLine.addEventListener('click', () => switchTool('line'));
    if (objAddSign) {
      objAddSign.addEventListener('click', () => {
        const toolSign = document.getElementById('toolSign');
        if (toolSign) toolSign.click();
      });
    }

    if (subToolEdit) subToolEdit.addEventListener('click', () => activateExistingTextEditing());
    if (subToolAddText) subToolAddText.addEventListener('click', () => activateTextAdding());
    if (subToolAddImage) {
      subToolAddImage.addEventListener('click', () => {
        if (studioImageInput) studioImageInput.click();
      });
    }
    if (subToolWatermark) {
      subToolWatermark.addEventListener('click', () => {
        const paneWatermark = document.getElementById('paneWatermark');
        if (paneWatermark) paneWatermark.click();
      });
    }

    if (closeEditModeBtn) {
      closeEditModeBtn.addEventListener('click', () => {
        commitActiveTextIfAny();
        setActiveText(null, null);
        editModeIsActive = false;
        switchTool('select');
        if (editModeBar) editModeBar.classList.remove('active');
        if (formatPane) formatPane.classList.remove('active');
        if (standardToolsPane) standardToolsPane.style.display = 'block';
        redrawAnnotationLayer();
        renderExistingTextLayer();
      });
    }

    // Image Input File Reader
    if (studioImageInput) {
      studioImageInput.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        const currentDoc = getDoc();
        if (!file || !currentDoc) return;
        const dataUrl = await window.PDFTools.FileUtils.readAsDataURL(file);
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        const newStamp = {
          id: 'stamp_' + Date.now(),
          type: 'image',
          dataUrl: dataUrl,
          x: 50,
          y: 50,
          width: 150,
          height: 100
        };
        pageAnn.stamps.push(newStamp);
        getUndoStack().push({ pageNum: currentDoc.currentPage, type: 'stamp', item: newStamp });
        scheduleRecovery();
        renderActivePageWidgets();
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.info('Image added to page.');
        }
        studioImageInput.value = '';
      });
    }

    // Top menu and side pane button triggers
    if (toolEditPdf) toolEditPdf.addEventListener('click', () => activateExistingTextEditing());
    if (toolText) toolText.addEventListener('click', () => activateTextAdding());
    if (paneEditPdf) paneEditPdf.addEventListener('click', () => activateExistingTextEditing());
    if (menuEditPdf) menuEditPdf.addEventListener('click', () => activateExistingTextEditing());
    if (paneAddText) paneAddText.addEventListener('click', () => activateTextAdding());
    if (menuAddText) menuAddText.addEventListener('click', () => activateTextAdding());
  }

  return {
    init,
    renderExistingTextLayer,
    setActiveText,
    showRightFormatPanel,
    activateExistingTextEditing,
    activateTextAdding,
    refocusActiveText,
    commitActiveTextIfAny,
    getActiveTextItem: () => activeTextItem,
    getActiveTextContentEl: () => activeTextContentEl,
    isFormatPaneMouseDown: () => formatPaneMouseDown,
    isEditModeActive: () => editModeIsActive,
    setEditModeActive: (active) => { editModeIsActive = active; },
    getTextEditEngine: () => textEditEngine
  };
})();
