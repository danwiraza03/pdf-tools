/**
 * PDF Tools — PDF Studio Fill & Sign Controller
 * Manages Acrobat-style Fill & Sign mode, form marks placement, signature pad drawing,
 * typed calligraphy signatures, preset stamps, and local signature saving.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioSign = (function () {
  let ctx = null;

  let activeFillSignSubTool = 'text';
  let activeFillSignInkColor = '#111827';
  let uploadedStampDataUrl = null;
  let modalMode = 'draw';
  let selectedCalligraphyFont = "'Great Vibes', 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
  let isSigDrawing = false;

  function init(context) {
    ctx = context;
    bindEventListeners();
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : null;
  }

  function getActiveSubTool() {
    return activeFillSignSubTool;
  }

  function setFillSignSubTool(sub) {
    activeFillSignSubTool = sub;
    const fsToolText = document.getElementById('fsToolText');
    const fsToolCheck = document.getElementById('fsToolCheck');
    const fsToolCross = document.getElementById('fsToolCross');
    const fsToolDot = document.getElementById('fsToolDot');
    const fsToolCircle = document.getElementById('fsToolCircle');
    const fsToolLine = document.getElementById('fsToolLine');
    const fsToolDate = document.getElementById('fsToolDate');

    [fsToolText, fsToolCheck, fsToolCross, fsToolDot, fsToolCircle, fsToolLine, fsToolDate].forEach(b => {
      if (b) b.classList.remove('active');
    });
    if (sub === 'text' && fsToolText) fsToolText.classList.add('active');
    if (sub === 'check' && fsToolCheck) fsToolCheck.classList.add('active');
    if (sub === 'cross' && fsToolCross) fsToolCross.classList.add('active');
    if (sub === 'dot' && fsToolDot) fsToolDot.classList.add('active');
    if (sub === 'circle' && fsToolCircle) fsToolCircle.classList.add('active');
    if (sub === 'line' && fsToolLine) fsToolLine.classList.add('active');
    if (sub === 'date' && fsToolDate) fsToolDate.classList.add('active');
  }

  async function activateFillSignMode() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Please open a PDF document first to fill and sign.');
      }
      if (ctx && ctx.triggerOpen) ctx.triggerOpen();
      return;
    }

    if (ctx && ctx.getViewMode && ctx.getViewMode() !== 'single' && ctx.setViewMode) {
      await ctx.setViewMode('single');
    }

    const editModeBar = document.getElementById('editModeBar');
    if (editModeBar) editModeBar.classList.remove('active');

    if (ctx && ctx.showRightFormatPanel) ctx.showRightFormatPanel(false);
    if (ctx && ctx.switchTool) ctx.switchTool('fillSign');
    setFillSignSubTool('text');

    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.info('Fill & Sign active: Click on form to place text/marks or Add Signature.');
    }
  }

  function openSignModal(mode = 'draw') {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Please open a PDF document first.');
      }
      if (ctx && ctx.triggerOpen) ctx.triggerOpen();
      return;
    }

    const stampModal = document.getElementById('stampModal');
    if (!stampModal) return;
    stampModal.classList.add('active');

    const modalDrawTab = document.getElementById('modalDrawTab');
    const modalTypeTab = document.getElementById('modalTypeTab');
    const modalPresetsTab = document.getElementById('modalPresetsTab');
    const modalUploadTab = document.getElementById('modalUploadTab');

    if (mode === 'type') {
      modalTypeTab?.click();
    } else if (mode === 'presets') {
      modalPresetsTab?.click();
    } else if (mode === 'upload') {
      modalUploadTab?.click();
    } else {
      modalDrawTab?.click();
      initSigPad();
    }
  }

  function initSigPad() {
    const sigPadCanvas = document.getElementById('sigPadCanvas');
    if (!sigPadCanvas) return;
    const padCtx = sigPadCanvas.getContext('2d');
    padCtx.clearRect(0, 0, sigPadCanvas.width, sigPadCanvas.height);
    padCtx.lineWidth = 2.5;
    padCtx.lineCap = 'round';
    padCtx.lineJoin = 'round';
    padCtx.strokeStyle = '#1E3A8A';
  }

  function generatePresetStampDataUrl(presetType) {
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 110;
    const padCtx = canvas.getContext('2d');
    padCtx.clearRect(0, 0, 320, 110);

    if (presetType === 'approved') {
      padCtx.strokeStyle = '#22C55E';
      padCtx.lineWidth = 4;
      padCtx.strokeRect(6, 6, 308, 98);
      padCtx.fillStyle = '#22C55E';
      padCtx.font = 'bold 30px Helvetica, Arial, sans-serif';
      padCtx.textAlign = 'center';
      padCtx.textBaseline = 'middle';
      padCtx.fillText('APPROVED', 160, 55);
    } else if (presetType === 'confidential') {
      padCtx.strokeStyle = '#EF4444';
      padCtx.lineWidth = 4;
      padCtx.strokeRect(6, 6, 308, 98);
      padCtx.fillStyle = '#EF4444';
      padCtx.font = 'bold 26px Helvetica, Arial, sans-serif';
      padCtx.textAlign = 'center';
      padCtx.textBaseline = 'middle';
      padCtx.fillText('CONFIDENTIAL', 160, 55);
    } else if (presetType === 'draft') {
      padCtx.strokeStyle = '#94A3B8';
      padCtx.lineWidth = 4;
      padCtx.strokeRect(6, 6, 308, 98);
      padCtx.fillStyle = '#94A3B8';
      padCtx.font = 'bold 30px Helvetica, Arial, sans-serif';
      padCtx.textAlign = 'center';
      padCtx.textBaseline = 'middle';
      padCtx.fillText('DRAFT', 160, 55);
    } else if (presetType === 'materai') {
      padCtx.strokeStyle = '#0EA5E9';
      padCtx.lineWidth = 3;
      padCtx.strokeRect(6, 6, 308, 98);
      padCtx.fillStyle = 'rgba(14, 165, 233, 0.08)';
      padCtx.fillRect(6, 6, 308, 98);
      padCtx.fillStyle = '#0EA5E9';
      padCtx.font = 'bold 16px Helvetica, Arial, sans-serif';
      padCtx.textAlign = 'center';
      padCtx.fillText('METERAI ELEKTRONIK', 160, 40);
      padCtx.font = 'bold 22px Helvetica, Arial, sans-serif';
      padCtx.fillText('Rp 10.000', 160, 72);
    }
    return canvas.toDataURL('image/png');
  }

  function renderSavedSignatures() {
    const savedList = document.getElementById('savedSignaturesList');
    if (!savedList) return;
    const saved = JSON.parse(localStorage.getItem('pdf_studio_saved_signatures') || '[]');
    if (saved.length === 0) {
      savedList.innerHTML = '<span style="font-size: 0.75rem; color: #9aa0a6;">No saved signatures yet.</span>';
      return;
    }
    savedList.innerHTML = '';
    saved.forEach((item, idx) => {
      const card = document.createElement('div');
      card.style.cssText = 'border: 1px solid #444; border-radius: 4px; padding: 4px 8px; background: #2b2b2b; cursor: pointer; display: flex; align-items: center; gap: 6px; position: relative;';
      const img = document.createElement('img');
      img.src = item;
      img.style.cssText = 'height: 32px; max-width: 90px; object-fit: contain; background: transparent;';
      card.appendChild(img);

      card.addEventListener('click', () => {
        placeStampOnDocument(item);
        document.getElementById('stampModal')?.classList.remove('active');
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.innerHTML = '<svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      del.style.cssText = 'position: absolute; top: -6px; right: -6px; width: 16px; height: 16px; border-radius: 50%; background: #EF4444; color: white; border: none; font-size: 8px; cursor: pointer; display: flex; align-items: center; justify-content: center;';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        saved.splice(idx, 1);
        localStorage.setItem('pdf_studio_saved_signatures', JSON.stringify(saved));
        renderSavedSignatures();
      });
      card.appendChild(del);
      savedList.appendChild(card);
    });
  }

  function placeStampOnDocument(dataUrl, width = 140, height = 60) {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Please open a PDF document first.');
      }
      return;
    }
    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const newStamp = {
      id: 'stamp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      type: 'signature',
      dataUrl: dataUrl,
      x: 100,
      y: 100,
      width: width,
      height: height
    };
    if (!pageAnn.stamps) pageAnn.stamps = [];
    pageAnn.stamps.push(newStamp);

    if (ctx && ctx.undoStack) {
      ctx.undoStack.push({ pageNum: currentDoc.currentPage, type: 'stamp', item: newStamp });
    }
    if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();

    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.success('Signature / Stamp placed on page! (Drag to position, drag corner to resize)');
    }
  }

  function addFormMarkAtPoint(type, clickX, clickY) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const color = activeFillSignInkColor || '#111827';

    // 1. Circle & Line create flexible interactive vector shape widgets
    if (type === 'circle') {
      const newShape = {
        id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'circle',
        x: Math.max(0, clickX - 25),
        y: Math.max(0, clickY - 18),
        width: 50,
        height: 36,
        strokeColor: color,
        strokeWidth: 2,
        fillColor: 'transparent'
      };
      if (!pageAnn.shapes) pageAnn.shapes = [];
      pageAnn.shapes.push(newShape);
      if (ctx && ctx.undoStack) ctx.undoStack.push({ pageNum: currentDoc.currentPage, type: 'shape', item: newShape });
      if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
      if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
      if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success('Circle placed! Drag to move, use handles to resize.');
      }
      return;
    }

    if (type === 'line') {
      const newShape = {
        id: 'shape_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        type: 'line',
        x: Math.max(0, clickX - 35),
        y: Math.max(0, clickY - 10),
        width: 70,
        height: 20,
        strokeColor: color,
        strokeWidth: 2,
        fillColor: 'transparent'
      };
      if (!pageAnn.shapes) pageAnn.shapes = [];
      pageAnn.shapes.push(newShape);
      if (ctx && ctx.undoStack) ctx.undoStack.push({ pageNum: currentDoc.currentPage, type: 'shape', item: newShape });
      if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
      if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
      if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success('Line placed! Drag to move, use handles to lengthen/resize.');
      }
      return;
    }

    let text = '';
    let fontSize = 18;
    let fontFam = 'Helvetica';

    if (type === 'check') {
      text = '✓';
      fontSize = 24;
    } else if (type === 'cross') {
      text = '✕';
      fontSize = 24;
    } else if (type === 'dot') {
      text = '●';
      fontSize = 22;
    } else if (type === 'date') {
      const today = new Date();
      const d = String(today.getDate()).padStart(2, '0');
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const y = today.getFullYear();
      text = `${d}/${m}/${y}`;
      fontSize = 14;
    } else {
      text = 'Type text...';
      fontSize = 14;
    }

    const newText = {
      id: 'text_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
      text: text,
      x: Math.max(0, clickX - (type === 'text' ? 0 : 8)),
      y: Math.max(0, clickY - (type === 'text' ? 0 : 12)),
      fontSize: fontSize,
      fontFamily: fontFam,
      bold: (type === 'check' || type === 'cross' || type === 'dot'),
      italic: false,
      color: color,
      headerOffsetY: 0
    };
    pageAnn.texts.push(newText);
    if (ctx && ctx.undoStack) ctx.undoStack.push({ pageNum: currentDoc.currentPage, type: 'text', item: newText });
    if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
    if (ctx && ctx.focusLatestTextWidget) ctx.focusLatestTextWidget();

    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.success(`${type === 'text' ? 'Text box' : type.toUpperCase()} placed!`);
    }
  }

  function bindEventListeners() {
    const fsToolText = document.getElementById('fsToolText');
    const fsToolCheck = document.getElementById('fsToolCheck');
    const fsToolCross = document.getElementById('fsToolCross');
    const fsToolDot = document.getElementById('fsToolDot');
    const fsToolCircle = document.getElementById('fsToolCircle');
    const fsToolLine = document.getElementById('fsToolLine');
    const fsToolDate = document.getElementById('fsToolDate');
    const fsAddSigBtn = document.getElementById('fsAddSigBtn');
    const fsAddInitialsBtn = document.getElementById('fsAddInitialsBtn');
    const fsQuickStampsBtn = document.getElementById('fsQuickStampsBtn');
    const closeFillSignModeBtn = document.getElementById('closeFillSignModeBtn');

    if (fsToolText) fsToolText.addEventListener('click', () => setFillSignSubTool('text'));
    if (fsToolCheck) fsToolCheck.addEventListener('click', () => setFillSignSubTool('check'));
    if (fsToolCross) fsToolCross.addEventListener('click', () => setFillSignSubTool('cross'));
    if (fsToolDot) fsToolDot.addEventListener('click', () => setFillSignSubTool('dot'));
    if (fsToolCircle) fsToolCircle.addEventListener('click', () => setFillSignSubTool('circle'));
    if (fsToolLine) fsToolLine.addEventListener('click', () => setFillSignSubTool('line'));
    if (fsToolDate) fsToolDate.addEventListener('click', () => setFillSignSubTool('date'));

    document.querySelectorAll('.fs-ink-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.fs-ink-btn').forEach(b => {
          b.classList.remove('active');
          b.style.borderColor = 'transparent';
        });
        btn.classList.add('active');
        btn.style.borderColor = '#2563eb';
        activeFillSignInkColor = btn.dataset.color || '#111827';
      });
    });

    if (fsAddSigBtn) fsAddSigBtn.addEventListener('click', () => openSignModal('draw'));
    if (fsAddInitialsBtn) fsAddInitialsBtn.addEventListener('click', () => openSignModal('type'));
    if (fsQuickStampsBtn) fsQuickStampsBtn.addEventListener('click', () => openSignModal('presets'));
    if (closeFillSignModeBtn) {
      closeFillSignModeBtn.addEventListener('click', () => {
        if (ctx && ctx.switchTool) ctx.switchTool('select');
      });
    }

    const toolSign = document.getElementById('toolSign');
    const paneFillSign = document.getElementById('paneFillSign');
    const menuEsign = document.getElementById('menuEsign');
    const menuEsignType = document.getElementById('menuEsignType');

    if (toolSign) toolSign.addEventListener('click', activateFillSignMode);
    if (paneFillSign) paneFillSign.addEventListener('click', activateFillSignMode);
    if (menuEsign) menuEsign.addEventListener('click', () => openSignModal('draw'));
    if (menuEsignType) menuEsignType.addEventListener('click', () => openSignModal('type'));

    const stampModal = document.getElementById('stampModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');

    closeModalBtn?.addEventListener('click', () => stampModal?.classList.remove('active'));
    cancelModalBtn?.addEventListener('click', () => stampModal?.classList.remove('active'));

    const modalDrawTab = document.getElementById('modalDrawTab');
    const modalTypeTab = document.getElementById('modalTypeTab');
    const modalPresetsTab = document.getElementById('modalPresetsTab');
    const modalUploadTab = document.getElementById('modalUploadTab');
    const modalDrawView = document.getElementById('modalDrawView');
    const modalTypeView = document.getElementById('modalTypeView');
    const modalPresetsView = document.getElementById('modalPresetsView');
    const modalUploadView = document.getElementById('modalUploadView');

    modalDrawTab?.addEventListener('click', () => {
      modalMode = 'draw';
      [modalDrawTab, modalTypeTab, modalPresetsTab, modalUploadTab].forEach(t => { if (t) t.classList.replace('btn-primary', 'btn-ghost'); });
      modalDrawTab.classList.replace('btn-ghost', 'btn-primary');
      if (modalDrawView) modalDrawView.style.display = 'block';
      if (modalTypeView) modalTypeView.style.display = 'none';
      if (modalPresetsView) modalPresetsView.style.display = 'none';
      if (modalUploadView) modalUploadView.style.display = 'none';
    });

    modalTypeTab?.addEventListener('click', () => {
      modalMode = 'type';
      [modalDrawTab, modalTypeTab, modalPresetsTab, modalUploadTab].forEach(t => { if (t) t.classList.replace('btn-primary', 'btn-ghost'); });
      modalTypeTab.classList.replace('btn-ghost', 'btn-primary');
      if (modalDrawView) modalDrawView.style.display = 'none';
      if (modalTypeView) modalTypeView.style.display = 'flex';
      if (modalPresetsView) modalPresetsView.style.display = 'none';
      if (modalUploadView) modalUploadView.style.display = 'none';
    });

    modalPresetsTab?.addEventListener('click', () => {
      modalMode = 'presets';
      [modalDrawTab, modalTypeTab, modalPresetsTab, modalUploadTab].forEach(t => { if (t) t.classList.replace('btn-primary', 'btn-ghost'); });
      modalPresetsTab.classList.replace('btn-ghost', 'btn-primary');
      if (modalDrawView) modalDrawView.style.display = 'none';
      if (modalTypeView) modalTypeView.style.display = 'none';
      if (modalPresetsView) modalPresetsView.style.display = 'flex';
      if (modalUploadView) modalUploadView.style.display = 'none';
      renderSavedSignatures();
    });

    modalUploadTab?.addEventListener('click', () => {
      modalMode = 'upload';
      [modalDrawTab, modalTypeTab, modalPresetsTab, modalUploadTab].forEach(t => { if (t) t.classList.replace('btn-primary', 'btn-ghost'); });
      modalUploadTab.classList.replace('btn-ghost', 'btn-primary');
      if (modalDrawView) modalDrawView.style.display = 'none';
      if (modalTypeView) modalTypeView.style.display = 'none';
      if (modalPresetsView) modalPresetsView.style.display = 'none';
      if (modalUploadView) modalUploadView.style.display = 'block';
    });

    // Preset Stamp Buttons Click
    document.querySelectorAll('.stamp-preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        const dataUrl = generatePresetStampDataUrl(preset);
        placeStampOnDocument(dataUrl, 160, 56);
        stampModal?.classList.remove('active');
      });
    });

    const typeSigInput = document.getElementById('typeSigInput');
    const typeSigPreview = document.getElementById('typeSigPreview');
    const fontGreatVibes = document.getElementById('fontGreatVibes');
    const fontDancingScript = document.getElementById('fontDancingScript');
    const fontCaveat = document.getElementById('fontCaveat');

    typeSigInput?.addEventListener('input', () => {
      if (typeSigPreview) typeSigPreview.textContent = typeSigInput.value || 'Signature';
    });

    fontGreatVibes?.addEventListener('click', () => {
      selectedCalligraphyFont = "'Great Vibes', 'Segoe Script', 'Brush Script MT', 'Lucida Handwriting', cursive";
      if (typeSigPreview) typeSigPreview.style.fontFamily = selectedCalligraphyFont;
    });
    fontDancingScript?.addEventListener('click', () => {
      selectedCalligraphyFont = "'Dancing Script', 'Segoe Script', 'Brush Script MT', cursive";
      if (typeSigPreview) typeSigPreview.style.fontFamily = selectedCalligraphyFont;
    });
    fontCaveat?.addEventListener('click', () => {
      selectedCalligraphyFont = "'Caveat', 'Segoe Script', cursive";
      if (typeSigPreview) typeSigPreview.style.fontFamily = selectedCalligraphyFont;
    });

    // Signature Pad Drawing
    const sigPadCanvas = document.getElementById('sigPadCanvas');
    const clearSigPadBtn = document.getElementById('clearSigPadBtn');

    if (sigPadCanvas) {
      const getSigPos = (e) => {
        const rect = sigPadCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
          x: (clientX - rect.left) * (sigPadCanvas.width / rect.width),
          y: (clientY - rect.top) * (sigPadCanvas.height / rect.height)
        };
      };

      sigPadCanvas.addEventListener('mousedown', (e) => {
        isSigDrawing = true;
        const pos = getSigPos(e);
        const padCtx = sigPadCanvas.getContext('2d');
        padCtx.beginPath();
        padCtx.moveTo(pos.x, pos.y);
      });

      sigPadCanvas.addEventListener('mousemove', (e) => {
        if (!isSigDrawing) return;
        const pos = getSigPos(e);
        const padCtx = sigPadCanvas.getContext('2d');
        padCtx.lineTo(pos.x, pos.y);
        padCtx.stroke();
      });

      sigPadCanvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        isSigDrawing = true;
        const pos = getSigPos(e);
        const padCtx = sigPadCanvas.getContext('2d');
        padCtx.beginPath();
        padCtx.moveTo(pos.x, pos.y);
      }, { passive: false });

      sigPadCanvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (!isSigDrawing) return;
        const pos = getSigPos(e);
        const padCtx = sigPadCanvas.getContext('2d');
        padCtx.lineTo(pos.x, pos.y);
        padCtx.stroke();
      }, { passive: false });

      sigPadCanvas.addEventListener('touchend', () => { isSigDrawing = false; });
      window.addEventListener('mouseup', () => { isSigDrawing = false; });
    }

    clearSigPadBtn?.addEventListener('click', initSigPad);

    if (window.PDFTools && window.PDFTools.Dropzone) {
      window.PDFTools.Dropzone('stampDropzone', {
        accept: 'image/png, image/jpeg, image/webp',
        multiple: false,
        onFiles: async function (files) {
          if (files.length > 0 && window.PDFTools.FileUtils) {
            uploadedStampDataUrl = await window.PDFTools.FileUtils.readAsDataURL(files[0]);
            if (window.PDFTools.Toast) window.PDFTools.Toast.success('Stamp loaded!');
          }
        }
      });
    }

    const applyStampBtn = document.getElementById('applyStampBtn');
    applyStampBtn?.addEventListener('click', () => {
      const currentDoc = getDoc();
      if (!currentDoc) {
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.info('Please open a PDF document first.');
        }
        return;
      }
      let dataUrl = null;

      if (modalMode === 'draw') {
        if (!sigPadCanvas) return;
        const padCtx = sigPadCanvas.getContext('2d');
        const imgData = padCtx.getImageData(0, 0, sigPadCanvas.width, sigPadCanvas.height);
        let hasPixels = false;
        for (let i = 3; i < imgData.data.length; i += 4) {
          if (imgData.data[i] > 0) { hasPixels = true; break; }
        }
        if (!hasPixels) {
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Please draw your signature on the pad first.');
          }
          return;
        }
        dataUrl = sigPadCanvas.toDataURL('image/png');
      } else if (modalMode === 'type') {
        const tCanvas = document.createElement('canvas');
        tCanvas.width = 400;
        tCanvas.height = 160;
        const tCtx = tCanvas.getContext('2d');
        tCtx.clearRect(0, 0, 400, 160);
        tCtx.font = `48px ${selectedCalligraphyFont}`;
        tCtx.fillStyle = '#1E3A8A';
        tCtx.textAlign = 'center';
        tCtx.textBaseline = 'middle';
        tCtx.fillText(typeSigInput?.value || 'Signature', 200, 80);
        dataUrl = tCanvas.toDataURL('image/png');
      } else if (modalMode === 'upload') {
        dataUrl = uploadedStampDataUrl;
      }

      if (!dataUrl) {
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.error('Please create or select signature first.');
        }
        return;
      }

      const saveCheck = document.getElementById('saveSigCheck');
      if (saveCheck && saveCheck.checked) {
        try {
          const saved = JSON.parse(localStorage.getItem('pdf_studio_saved_signatures') || '[]');
          if (!saved.includes(dataUrl)) {
            saved.unshift(dataUrl);
            if (saved.length > 6) saved.pop();
            localStorage.setItem('pdf_studio_saved_signatures', JSON.stringify(saved));
          }
        } catch (e) {}
      }

      placeStampOnDocument(dataUrl, 140, 60);
      stampModal?.classList.remove('active');
    });
  }

  return {
    init,
    getActiveSubTool,
    setFillSignSubTool,
    activateFillSignMode,
    openSignModal,
    generatePresetStampDataUrl,
    renderSavedSignatures,
    placeStampOnDocument,
    addFormMarkAtPoint
  };
})();
