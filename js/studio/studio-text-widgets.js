/**
 * js/studio/studio-text-widgets.js
 * PDF Studio - Draggable Text, Image/Stamp, Shape, and AcroForm Widgets Controller
 * Strict compliance with PROJECT_RULES.md (100% offline, zero emojis, clean SVGs)
 */
(function(window) {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  let ctx = null;
  let replaceImageTarget = null;

  function init(context) {
    ctx = context || {};
    bindImageReplacement();
  }

  function getCurrentDoc() {
    return ctx && ctx.getCurrentDoc ? ctx.getCurrentDoc() : ctx?.currentDoc;
  }

  function getCurrentScale() {
    return (ctx && ctx.getCurrentScale ? ctx.getCurrentScale() : ctx?.currentScale) || 1.0;
  }

  function getActiveMode() {
    return (ctx && ctx.getActiveMode ? ctx.getActiveMode() : ctx?.activeMode) || 'select';
  }

  function getWidgetContainer() {
    return (ctx && ctx.getWidgetContainer ? ctx.getWidgetContainer() : ctx?.widgetContainer) || document.getElementById('widgetContainer');
  }

  function getFormatPane() {
    return (ctx && ctx.getFormatPane ? ctx.getFormatPane() : ctx?.formatPane) || document.getElementById('formatPane');
  }

  function getCommandManager() {
    return (ctx && ctx.getCommandManager ? ctx.getCommandManager() : ctx?.commandManager);
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  function redrawAnnotationLayer() {
    if (ctx && ctx.redrawAnnotationLayer) ctx.redrawAnnotationLayer();
  }

  function renderExistingTextLayer() {
    if (ctx && ctx.renderExistingTextLayer) {
      ctx.renderExistingTextLayer();
    } else if (window.PDFTools.StudioTextEditor?.renderExistingTextLayer) {
      window.PDFTools.StudioTextEditor.renderExistingTextLayer();
    }
  }

  function getActiveTextItem() {
    if (ctx && ctx.getActiveTextItem) return ctx.getActiveTextItem();
    return window.PDFTools.StudioTextEditor?.getActiveTextItem ? window.PDFTools.StudioTextEditor.getActiveTextItem() : null;
  }

  function setActiveText(item, el) {
    if (ctx && ctx.setActiveText) {
      ctx.setActiveText(item, el);
    } else if (window.PDFTools.StudioTextEditor?.setActiveText) {
      window.PDFTools.StudioTextEditor.setActiveText(item, el);
    }
  }

  function isFormatPaneMouseDown() {
    if (ctx && ctx.isFormatPaneMouseDown) return ctx.isFormatPaneMouseDown();
    return window.PDFTools.StudioTextEditor?.isFormatPaneMouseDown ? window.PDFTools.StudioTextEditor.isFormatPaneMouseDown() : false;
  }

  function bindImageReplacement() {
    const input = (ctx && ctx.replaceImageInput) || document.getElementById('replaceImageInput');
    if (!input || input.dataset.widgetsBound) return;
    input.dataset.widgetsBound = 'true';

    input.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      const currentDoc = getCurrentDoc();
      if (!file || !replaceImageTarget || !currentDoc) return;

      const dataUrl = await window.PDFTools.FileUtils.readAsDataURL(file);
      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);

      if (window.PDFTools.ImageEditEngine) {
        window.PDFTools.ImageEditEngine.applyImageEdit(pageAnn, replaceImageTarget, { dataUrl: dataUrl });
      }
      const cmdMgr = getCommandManager();
      if (cmdMgr && window.PDFTools.Commands && window.PDFTools.Commands.AddImageCommand) {
        cmdMgr.execute(new window.PDFTools.Commands.AddImageCommand(
          currentDoc,
          currentDoc.currentPage,
          replaceImageTarget,
          () => renderActivePageWidgets()
        ));
      }
      scheduleRecovery();
      renderActivePageWidgets();
      if (window.PDFTools.Toast) {
        window.PDFTools.Toast.success('Image replaced successfully!');
      }
      input.value = '';
      replaceImageTarget = null;
    });
  }

  function setReplaceImageTarget(target) {
    replaceImageTarget = target;
  }

  function triggerImageReplacement(target) {
    replaceImageTarget = target;
    const input = (ctx && ctx.replaceImageInput) || document.getElementById('replaceImageInput');
    if (input) input.click();
  }

  function renderActivePageWidgets() {
    const widgetContainer = getWidgetContainer();
    if (!widgetContainer) return;
    widgetContainer.innerHTML = '';

    const currentDoc = getCurrentDoc();
    if (!currentDoc) return;

    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const currentScale = getCurrentScale();
    const activeMode = getActiveMode();
    const cmdMgr = getCommandManager();

    // 1. Render Stamps / User Images
    (pageAnn.stamps || []).forEach(stamp => {
      const widget = document.createElement('div');
      widget.className = 'studio-widget';
      widget.style.left = `${stamp.x * currentScale}px`;
      widget.style.top = `${stamp.y * currentScale}px`;
      widget.style.width = `${stamp.width * currentScale}px`;
      widget.style.height = `${stamp.height * currentScale}px`;

      const img = document.createElement('img');
      img.src = stamp.dataUrl;
      widget.appendChild(img);

      const del = document.createElement('div');
      del.className = 'studio-widget-delete';
      del.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      del.title = 'Delete Image';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        if (cmdMgr && window.PDFTools.Commands && window.PDFTools.Commands.DeleteImageCommand) {
          cmdMgr.execute(new window.PDFTools.Commands.DeleteImageCommand(currentDoc, currentDoc.currentPage, stamp, () => renderActivePageWidgets()));
        } else {
          pageAnn.stamps = (pageAnn.stamps || []).filter(s => s !== stamp);
          renderActivePageWidgets();
        }
        scheduleRecovery();
      });
      widget.appendChild(del);

      const rep = document.createElement('div');
      rep.className = 'studio-widget-replace';
      rep.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';
      rep.title = 'Replace Image';
      rep.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerImageReplacement(stamp);
      });
      widget.appendChild(rep);

      const resizeDot = document.createElement('div');
      resizeDot.className = 'studio-widget-resize';
      resizeDot.title = 'Drag to Resize';
      widget.appendChild(resizeDot);

      makeWidgetDraggable(widget, stamp);
      makeWidgetResizable(widget, resizeDot, stamp);
      widgetContainer.appendChild(widget);
    });

    // 1c. Render AcroForm Interactive Field Overlays
    (pageAnn.formFields || []).forEach(field => {
      const fWidget = document.createElement('div');
      fWidget.className = 'studio-widget';
      fWidget.style.left = `${field.x * currentScale}px`;
      fWidget.style.top = `${field.y * currentScale}px`;
      fWidget.style.width = `${field.width * currentScale}px`;
      fWidget.style.height = `${field.height * currentScale}px`;
      fWidget.style.background = '#FFFFFF';
      fWidget.style.border = '1.5px solid #3B82F6';
      fWidget.style.borderRadius = '3px';
      fWidget.style.display = 'flex';
      fWidget.style.alignItems = 'center';
      fWidget.style.padding = '2px 4px';
      fWidget.style.boxSizing = 'border-box';

      if (field.type === 'text') {
        const inp = document.createElement('input');
        inp.type = 'text';
        inp.value = field.value || '';
        inp.placeholder = field.name;
        inp.style.cssText = 'width:100%; height:100%; border:none; outline:none; font-size:11px; background:transparent; color:#111827;';
        inp.addEventListener('input', (e) => { field.value = e.target.value; scheduleRecovery(); });
        fWidget.appendChild(inp);
      } else if (field.type === 'checkbox') {
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = !!field.value;
        chk.addEventListener('change', (e) => { field.value = e.target.checked; scheduleRecovery(); });
        fWidget.appendChild(chk);
      } else if (field.type === 'dropdown') {
        const sel = document.createElement('select');
        sel.style.cssText = 'width:100%; height:100%; border:none; outline:none; font-size:11px; color:#111827;';
        (field.options || ['Option 1']).forEach(opt => {
          const o = document.createElement('option');
          o.value = opt;
          o.textContent = opt;
          sel.appendChild(o);
        });
        sel.value = field.value || field.options?.[0] || '';
        sel.addEventListener('change', (e) => { field.value = e.target.value; scheduleRecovery(); });
        fWidget.appendChild(sel);
      } else if (field.type === 'button') {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = field.name;
        b.style.cssText = 'width:100%; height:100%; font-size:10px; padding:2px;';
        fWidget.appendChild(b);
      }

      const del = document.createElement('div');
      del.className = 'studio-widget-delete';
      del.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      del.title = 'Delete Field';
      del.addEventListener('click', (e) => {
        e.stopPropagation();
        pageAnn.formFields = pageAnn.formFields.filter(f => f.id !== field.id);
        fWidget.remove();
        scheduleRecovery();
      });
      fWidget.appendChild(del);

      makeWidgetDraggable(fWidget, field);
      widgetContainer.appendChild(fWidget);
    });

    // 1b. Render Detected Existing PDF Images (when in Edit Mode)
    if (activeMode === 'edit' && currentDoc.pdfJsDoc) {
      currentDoc.pdfJsDoc.getPage(currentDoc.currentPage).then(page => {
        if (!window.PDFTools.ImageExtractor) return;
        window.PDFTools.ImageExtractor.extractPageImages(page, currentDoc.currentPage).then(detectedImages => {
          const imageEdits = pageAnn.imageEdits || [];
          detectedImages.forEach(imgObj => {
            const edit = imageEdits.find(e => e.id === imgObj.id);
            if (edit && edit.deleted) return; // Deleted image

            const imgWidget = document.createElement('div');
            imgWidget.className = 'studio-existing-image';
            const curX = edit ? edit.x : imgObj.x;
            const curY = edit ? edit.y : imgObj.y;
            const curW = edit ? edit.width : imgObj.width;
            const curH = edit ? edit.height : imgObj.height;

            imgWidget.style.left = `${curX * currentScale}px`;
            imgWidget.style.top = `${curY * currentScale}px`;
            imgWidget.style.width = `${curW * currentScale}px`;
            imgWidget.style.height = `${curH * currentScale}px`;

            if (edit && edit.dataUrl) {
              const replImg = document.createElement('img');
              replImg.src = edit.dataUrl;
              replImg.style.width = '100%';
              replImg.style.height = '100%';
              imgWidget.appendChild(replImg);
            }

            const delBtn = document.createElement('div');
            delBtn.className = 'studio-widget-delete';
            delBtn.innerHTML = '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
            delBtn.title = 'Delete PDF Image';
            delBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              if (window.PDFTools.ImageEditEngine) {
                window.PDFTools.ImageEditEngine.applyImageEdit(pageAnn, imgObj, { deleted: true });
              }
              scheduleRecovery();
              renderActivePageWidgets();
              redrawAnnotationLayer();
              if (window.PDFTools.Toast) window.PDFTools.Toast.info('PDF image deleted.');
            });
            imgWidget.appendChild(delBtn);

            const repBtn = document.createElement('div');
            repBtn.className = 'studio-widget-replace';
            repBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';
            repBtn.title = 'Replace PDF Image';
            repBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              triggerImageReplacement(imgObj);
            });
            imgWidget.appendChild(repBtn);

            widgetContainer.appendChild(imgWidget);
          });
        });
      }).catch(e => console.warn('Image extraction failed:', e));
    }

    // 1d. Render Interactive Vector Shapes (Rectangles, Circles, Lines)
    (pageAnn.shapes || []).forEach(shape => {
      const sWidget = document.createElement('div');
      sWidget.className = 'studio-shape-widget';
      sWidget.dataset.shapeId = shape.id;
      
      const sx = shape.x || 50;
      const sy = shape.y || 50;
      const sw = Math.max(14, shape.width || (shape.x2 ? Math.abs(shape.x2 - shape.x) : 80));
      const sh = Math.max(14, shape.height || (shape.y2 ? Math.abs(shape.y2 - shape.y) : 60));

      sWidget.style.left = `${sx * currentScale}px`;
      sWidget.style.top = `${sy * currentScale}px`;
      sWidget.style.width = `${sw * currentScale}px`;
      sWidget.style.height = `${sh * currentScale}px`;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('viewBox', '0 0 100 100');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.style.overflow = 'visible';
      svg.style.display = 'block';

      const strokeColor = shape.strokeColor || '#EF4444';
      const strokeWidth = Math.max(1, (shape.strokeWidth || 2) * currentScale);
      const fillColor = (shape.fillColor && shape.fillColor !== 'transparent') ? shape.fillColor : 'transparent';

      if (shape.type === 'rectangle') {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', '100');
        rect.setAttribute('height', '100');
        rect.setAttribute('stroke', strokeColor);
        rect.setAttribute('stroke-width', strokeWidth);
        rect.setAttribute('fill', fillColor);
        rect.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(rect);
      } else if (shape.type === 'circle') {
        const ellipse = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
        ellipse.setAttribute('cx', '50');
        ellipse.setAttribute('cy', '50');
        ellipse.setAttribute('rx', '49');
        ellipse.setAttribute('ry', '49');
        ellipse.setAttribute('stroke', strokeColor);
        ellipse.setAttribute('stroke-width', strokeWidth);
        ellipse.setAttribute('fill', fillColor);
        ellipse.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(ellipse);
      } else if (shape.type === 'line') {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', '0');
        line.setAttribute('y1', '50');
        line.setAttribute('x2', '100');
        line.setAttribute('y2', '50');
        line.setAttribute('stroke', strokeColor);
        line.setAttribute('stroke-width', strokeWidth);
        line.setAttribute('stroke-linecap', 'round');
        line.setAttribute('vector-effect', 'non-scaling-stroke');
        svg.appendChild(line);
      }
      sWidget.appendChild(svg);

      // 8 Handles
      ['tl', 'tr', 'bl', 'br', 'tc', 'bc', 'ml', 'mr'].forEach(h => {
        const dot = document.createElement('div');
        dot.className = `studio-text-handle ${h}`;
        dot.dataset.handle = h;
        sWidget.appendChild(dot);
      });

      // Floating mini toolbar
      const toolbar = document.createElement('div');
      toolbar.className = 'studio-floating-toolbar';
      
      const btnThicker = document.createElement('button');
      btnThicker.type = 'button';
      btnThicker.className = 'sft-btn';
      btnThicker.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      btnThicker.title = 'Thicker line';
      btnThicker.addEventListener('click', (e) => {
        e.stopPropagation();
        shape.strokeWidth = Math.min(24, (shape.strokeWidth || 2) + 1);
        scheduleRecovery();
        renderActivePageWidgets();
      });
      toolbar.appendChild(btnThicker);

      const btnThinner = document.createElement('button');
      btnThinner.type = 'button';
      btnThinner.className = 'sft-btn';
      btnThinner.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>';
      btnThinner.title = 'Thinner line';
      btnThinner.addEventListener('click', (e) => {
        e.stopPropagation();
        shape.strokeWidth = Math.max(1, (shape.strokeWidth || 2) - 1);
        scheduleRecovery();
        renderActivePageWidgets();
      });
      toolbar.appendChild(btnThinner);

      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.className = 'sft-color';
      colorPicker.value = shape.strokeColor || '#EF4444';
      colorPicker.title = 'Stroke Color';
      colorPicker.addEventListener('input', (e) => {
        shape.strokeColor = e.target.value;
        scheduleRecovery();
        renderActivePageWidgets();
      });
      toolbar.appendChild(colorPicker);

      const btnFill = document.createElement('button');
      btnFill.type = 'button';
      btnFill.className = 'sft-btn';
      btnFill.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="m19 11-8-8-8.6 8.6a2 2 0 0 0 0 2.8l5.2 5.2c.8.8 2 .8 2.8 0L19 11Z"/><path d="m5 2 5 5"/><path d="M2 13h15"/></svg>';
      btnFill.title = 'Toggle Fill';
      btnFill.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!shape.fillColor || shape.fillColor === 'transparent') {
          shape.fillColor = (shape.strokeColor || '#EF4444') + '33';
        } else {
          shape.fillColor = 'transparent';
        }
        scheduleRecovery();
        renderActivePageWidgets();
      });
      toolbar.appendChild(btnFill);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'sft-btn sft-del';
      delBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.title = 'Delete Shape';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pageAnn.shapes = pageAnn.shapes.filter(s => s.id !== shape.id);
        sWidget.remove();
        scheduleRecovery();
      });
      toolbar.appendChild(delBtn);

      sWidget.appendChild(toolbar);

      makeShapeWidgetInteractive(sWidget, shape);
      widgetContainer.appendChild(sWidget);
    });

    // 2. Render Draggable Text Boxes & Form Marks (Acrobat/Word Style)
    (pageAnn.texts || []).forEach(textItem => {
      const textWidget = document.createElement('div');
      textWidget.className = 'studio-text-widget';
      if (textItem.headerOffsetY === 0) {
        textWidget.classList.add('committed');
      }
      textWidget.style.left = `${textItem.x * currentScale}px`;
      textWidget.style.top = `${textItem.y * currentScale}px`;
      if (textItem.width) {
        textWidget.style.width = `${textItem.width * currentScale}px`;
      }

      // ── Selection handles (Acrobat-style corner and side dots) ──
      const handleTL = document.createElement('div');
      handleTL.className = 'studio-text-handle tl';
      handleTL.dataset.handle = 'tl';

      const handleTR = document.createElement('div');
      handleTR.className = 'studio-text-handle tr';
      handleTR.dataset.handle = 'tr';

      const handleBL = document.createElement('div');
      handleBL.className = 'studio-text-handle bl';
      handleBL.dataset.handle = 'bl';

      const handleBR = document.createElement('div');
      handleBR.className = 'studio-text-handle br';
      handleBR.dataset.handle = 'br';

      const handleMR = document.createElement('div');
      handleMR.className = 'studio-text-handle mr';
      handleMR.dataset.handle = 'mr';

      // ── Floating Quick Toolbar for Text & Form Marks (A-, A+, Color, Delete) ──
      const toolbar = document.createElement('div');
      toolbar.className = 'studio-floating-toolbar';

      const btnDec = document.createElement('button');
      btnDec.type = 'button';
      btnDec.className = 'sft-btn';
      btnDec.innerHTML = 'A-';
      btnDec.title = 'Smaller Size';
      btnDec.addEventListener('click', (e) => {
        e.stopPropagation();
        textItem.fontSize = Math.max(8, (textItem.fontSize || 14) - 2);
        content.style.fontSize = `${textItem.fontSize * currentScale}px`;
        scheduleRecovery();
      });
      toolbar.appendChild(btnDec);

      const btnInc = document.createElement('button');
      btnInc.type = 'button';
      btnInc.className = 'sft-btn';
      btnInc.innerHTML = 'A+';
      btnInc.title = 'Larger Size';
      btnInc.addEventListener('click', (e) => {
        e.stopPropagation();
        textItem.fontSize = Math.min(140, (textItem.fontSize || 14) + 2);
        content.style.fontSize = `${textItem.fontSize * currentScale}px`;
        scheduleRecovery();
      });
      toolbar.appendChild(btnInc);

      const colorPicker = document.createElement('input');
      colorPicker.type = 'color';
      colorPicker.className = 'sft-color';
      colorPicker.value = textItem.color || '#000000';
      colorPicker.title = 'Change Color';
      colorPicker.addEventListener('input', (e) => {
        textItem.color = e.target.value;
        content.style.color = textItem.color;
        scheduleRecovery();
      });
      toolbar.appendChild(colorPicker);

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'sft-btn sft-del';
      delBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      delBtn.title = 'Delete';
      delBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        pageAnn.texts = pageAnn.texts.filter(t => t.id !== textItem.id);
        textWidget.remove();
        if (getActiveTextItem() === textItem) setActiveText(null, null);
        scheduleRecovery();
      });
      toolbar.appendChild(delBtn);

      // ── Editable content area (100% Transparent) ──
      const content = document.createElement('div');
      content.className = 'studio-text-content';
      content.contentEditable = true;
      content.spellcheck = false;
      content.style.fontSize = `${(textItem.fontSize || 14) * currentScale}px`;
      content.style.color = textItem.color || '#000000';
      content.style.fontFamily = textItem.fontFamily === 'Times'
        ? 'Times New Roman, serif'
        : textItem.fontFamily === 'Courier'
          ? 'Courier New, monospace'
          : 'Helvetica, Arial, sans-serif';
      content.style.fontWeight = textItem.bold ? 'bold' : 'normal';
      content.style.fontStyle = textItem.italic ? 'italic' : 'normal';
      content.style.textAlign = textItem.align || 'left';
      content.innerText = textItem.text || 'Type text here...';

      content.addEventListener('focus', () => {
        widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
        textWidget.classList.add('selected');
        textWidget.classList.remove('committed');
        setActiveText(textItem, content);
      });
      content.addEventListener('click', (e) => {
        e.stopPropagation();
        widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
        textWidget.classList.add('selected');
        textWidget.classList.remove('committed');
        setActiveText(textItem, content);
      });

      content.addEventListener('input', () => {
        textItem.text = content.innerText;
        scheduleRecovery();
      });

      content.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          commitTextInPlace(textWidget, content, textItem);
          textWidget.classList.remove('selected');
          content.blur();
        }
      });

      content.addEventListener('blur', () => {
        setTimeout(() => {
          const focused = document.activeElement;
          const formatPane = getFormatPane();
          const inFormatPane = formatPane && formatPane.contains(focused);
          const inWidget = textWidget.contains(focused);
          if (!inFormatPane && !inWidget && !isFormatPaneMouseDown()) {
            commitTextInPlace(textWidget, content, textItem);
            textWidget.classList.remove('selected');
          }
        }, 80);
      });

      textWidget.appendChild(handleTL);
      textWidget.appendChild(handleTR);
      textWidget.appendChild(handleBL);
      textWidget.appendChild(handleBR);
      textWidget.appendChild(handleMR);
      textWidget.appendChild(toolbar);
      textWidget.appendChild(content);

      makeTextWidgetDraggable(textWidget, content, textItem);
      widgetContainer.appendChild(textWidget);
    });

    renderExistingTextLayer();
  }

  function focusLatestTextWidget() {
    const widgetContainer = getWidgetContainer();
    if (!widgetContainer) return;
    const textContents = widgetContainer.querySelectorAll('.studio-text-content');
    const latestTextContent = textContents[textContents.length - 1];
    if (!latestTextContent) return;
    latestTextContent.focus();
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(latestTextContent);
    selection.removeAllRanges();
    selection.addRange(range);
    
    const currentDoc = getCurrentDoc();
    if (currentDoc) {
      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      const latestItem = (pageAnn.texts || [])[pageAnn.texts.length - 1];
      if (latestItem) {
        setActiveText(latestItem, latestTextContent);
      }
    }
  }

  // Commit text in-place WITHOUT closing edit mode or the format bar
  function commitTextInPlace(textWidget, content, textItem) {
    const currentDoc = getCurrentDoc();
    const value = content.innerText.trim();
    if (!value || value === 'Type text here...') {
      if (currentDoc) {
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        pageAnn.texts = pageAnn.texts.filter(item => item.id !== textItem.id);
      }
      textWidget.remove();
      if (getActiveTextItem() === textItem) setActiveText(null, null);
      return;
    }
    textItem.text = value;
    textItem.headerOffsetY = 0;
    scheduleRecovery();
    content.innerText = value;
    textWidget.classList.add('committed');
  }

  // finishTextEditing: used when user explicitly closes edit mode
  function finishTextEditing(textWidget, content, textItem, pageAnn) {
    const value = content.innerText.trim();
    if (!value || value === 'Type text here...' || value === 'New text') {
      pageAnn.texts = pageAnn.texts.filter(item => item.id !== textItem.id);
      textWidget.remove();
      if (getActiveTextItem() === textItem) setActiveText(null, null);
      return;
    }
    textItem.text = value;
    textItem.headerOffsetY = 0;
    scheduleRecovery();
    content.innerText = value;
    textWidget.classList.add('committed');
  }

  function makeWidgetDraggable(widget, stamp) {
    let isDragging = false;
    let startX, startY;

    widget.addEventListener('mousedown', (e) => {
      if (e.target.classList.contains('studio-widget-delete') || e.target.classList.contains('studio-widget-resize')) return;
      isDragging = true;
      const currentScale = getCurrentScale();
      startX = e.clientX - (stamp.x * currentScale);
      startY = e.clientY - (stamp.y * currentScale);
      widget.classList.add('selected');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const currentScale = getCurrentScale();
      stamp.x = Math.max(0, (e.clientX - startX) / currentScale);
      stamp.y = Math.max(0, (e.clientY - startY) / currentScale);
      widget.style.left = `${stamp.x * currentScale}px`;
      widget.style.top = `${stamp.y * currentScale}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        widget.classList.remove('selected');
        scheduleRecovery();
      }
    });
  }

  function makeWidgetResizable(widget, resizeDot, stamp) {
    let isResizing = false;
    let startX, startY, startW, startH;

    resizeDot.addEventListener('mousedown', (e) => {
      e.stopPropagation();
      isResizing = true;
      startX = e.clientX;
      startY = e.clientY;
      startW = stamp.width;
      startH = stamp.height;
    });

    window.addEventListener('mousemove', (e) => {
      if (!isResizing) return;
      const currentScale = getCurrentScale();
      const dw = (e.clientX - startX) / currentScale;
      const dh = (e.clientY - startY) / currentScale;
      stamp.width = Math.max(40, startW + dw);
      stamp.height = Math.max(25, startH + dh);
      widget.style.width = `${stamp.width * currentScale}px`;
      widget.style.height = `${stamp.height * currentScale}px`;
    });

    window.addEventListener('mouseup', () => {
      if (isResizing) scheduleRecovery();
      isResizing = false;
    });
  }

  function makeShapeWidgetInteractive(sWidget, shape) {
    let isDragging = false;
    let isResizing = false;
    let activeHandle = null;
    let startX, startY, startW, startH, startLeft, startTop;

    sWidget.addEventListener('mousedown', (e) => {
      if (e.target.closest('.studio-floating-toolbar')) return;

      const currentScale = getCurrentScale();
      const widgetContainer = getWidgetContainer();

      if (e.target.classList.contains('studio-text-handle')) {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        activeHandle = e.target.dataset.handle;
        startX = e.clientX;
        startY = e.clientY;
        startW = sWidget.offsetWidth / currentScale;
        startH = sWidget.offsetHeight / currentScale;
        startLeft = shape.x;
        startTop = shape.y;
        if (widgetContainer) {
          widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
        }
        sWidget.classList.add('selected');
        return;
      }

      e.stopPropagation();
      isDragging = true;
      startX = e.clientX - (shape.x * currentScale);
      startY = e.clientY - (shape.y * currentScale);
      if (widgetContainer) {
        widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
      }
      sWidget.classList.add('selected');
    });

    window.addEventListener('mousemove', (e) => {
      const currentScale = getCurrentScale();
      if (isDragging) {
        shape.x = Math.max(0, (e.clientX - startX) / currentScale);
        shape.y = Math.max(0, (e.clientY - startY) / currentScale);
        sWidget.style.left = `${shape.x * currentScale}px`;
        sWidget.style.top = `${shape.y * currentScale}px`;
      } else if (isResizing) {
        const dx = (e.clientX - startX) / currentScale;
        const dy = (e.clientY - startY) / currentScale;

        if (activeHandle === 'br') {
          shape.width = Math.max(10, startW + dx);
          shape.height = Math.max(10, startH + dy);
        } else if (activeHandle === 'mr') {
          shape.width = Math.max(10, startW + dx);
        } else if (activeHandle === 'bc') {
          shape.height = Math.max(10, startH + dy);
        } else if (activeHandle === 'tr') {
          shape.width = Math.max(10, startW + dx);
          shape.height = Math.max(10, startH - dy);
          shape.y = Math.max(0, startTop + dy);
          sWidget.style.top = `${shape.y * currentScale}px`;
        } else if (activeHandle === 'bl') {
          shape.width = Math.max(10, startW - dx);
          shape.height = Math.max(10, startH + dy);
          shape.x = Math.max(0, startLeft + dx);
          sWidget.style.left = `${shape.x * currentScale}px`;
        } else if (activeHandle === 'tl') {
          shape.width = Math.max(10, startW - dx);
          shape.height = Math.max(10, startH - dy);
          shape.x = Math.max(0, startLeft + dx);
          shape.y = Math.max(0, startTop + dy);
          sWidget.style.left = `${shape.x * currentScale}px`;
          sWidget.style.top = `${shape.y * currentScale}px`;
        } else if (activeHandle === 'tc') {
          shape.height = Math.max(10, startH - dy);
          shape.y = Math.max(0, startTop + dy);
          sWidget.style.top = `${shape.y * currentScale}px`;
        } else if (activeHandle === 'ml') {
          shape.width = Math.max(10, startW - dx);
          shape.x = Math.max(0, startLeft + dx);
          sWidget.style.left = `${shape.x * currentScale}px`;
        }
        sWidget.style.width = `${shape.width * currentScale}px`;
        sWidget.style.height = `${shape.height * currentScale}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging || isResizing) {
        scheduleRecovery();
      }
      isDragging = false;
      isResizing = false;
    });
  }

  function makeTextWidgetDraggable(textWidget, content, textItem) {
    let isDragging = false;
    let isResizing = false;
    let activeHandle = null;
    let startX, startY;
    let startW;
    let startFontSize = 14;

    const BORDER_MARGIN = 8; // px distance from edges treated as move area

    const isNearBorder = (e) => {
      const rect = textWidget.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      return (
        x <= BORDER_MARGIN ||
        x >= rect.width - BORDER_MARGIN ||
        y <= BORDER_MARGIN ||
        y >= rect.height - BORDER_MARGIN ||
        e.target.classList.contains('studio-text-handle')
      );
    };

    textWidget.addEventListener('mousemove', (e) => {
      if (isDragging || isResizing) return;
      if (e.target.closest('.studio-floating-toolbar') || e.target.classList.contains('studio-text-del-btn')) {
        textWidget.style.cursor = 'default';
        return;
      }
      if (e.target.classList.contains('studio-text-handle')) return;

      if (isNearBorder(e) || textWidget.classList.contains('committed')) {
        textWidget.style.cursor = 'move';
        content.style.cursor = 'move';
      } else {
        textWidget.style.cursor = 'default';
        content.style.cursor = 'text';
      }
    });

    textWidget.addEventListener('mouseleave', () => {
      if (!isDragging && !isResizing) {
        content.style.cursor = 'text';
        textWidget.style.cursor = 'default';
      }
    });

    textWidget.addEventListener('mousedown', (e) => {
      if (e.target.closest('.studio-floating-toolbar') || e.target.classList.contains('studio-text-del-btn')) return;

      const currentScale = getCurrentScale();
      const widgetContainer = getWidgetContainer();

      // Resize Handle Dragging
      if (e.target.classList.contains('studio-text-handle')) {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        activeHandle = e.target.dataset.handle;
        startX = e.clientX;
        startY = e.clientY;
        startW = textWidget.offsetWidth / currentScale;
        startFontSize = textItem.fontSize || 14;
        if (widgetContainer) {
          widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
        }
        textWidget.classList.add('selected');
        setActiveText(textItem, content);
        return;
      }

      // Border Dragging or clicking committed box
      if (isNearBorder(e) || textWidget.classList.contains('committed')) {
        e.stopPropagation();
        isDragging = true;
        startX = e.clientX - (textItem.x * currentScale);
        startY = e.clientY - (textItem.y * currentScale);
        if (widgetContainer) {
          widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
        }
        textWidget.classList.add('selected');
        setActiveText(textItem, content);
        return;
      }

      // Interior clicking -> focus text
      if (widgetContainer) {
        widgetContainer.querySelectorAll('.studio-text-widget, .studio-shape-widget').forEach(w => w.classList.remove('selected'));
      }
      textWidget.classList.add('selected');
      textWidget.classList.remove('committed');
      setActiveText(textItem, content);
    });

    window.addEventListener('mousemove', (e) => {
      const currentScale = getCurrentScale();
      if (isDragging) {
        textItem.x = Math.max(0, (e.clientX - startX) / currentScale);
        textItem.y = Math.max(0, (e.clientY - startY) / currentScale);
        textWidget.style.left = `${textItem.x * currentScale}px`;
        textWidget.style.top = `${textItem.y * currentScale}px`;
      } else if (isResizing) {
        const dx = (e.clientX - startX) / currentScale;
        if (activeHandle === 'br' || activeHandle === 'bl' || activeHandle === 'tr' || activeHandle === 'tl') {
          const delta = (activeHandle === 'br' || activeHandle === 'tr') ? dx : -dx;
          const newFontSize = Math.max(8, Math.min(140, Math.round(startFontSize + (delta * 0.35))));
          textItem.fontSize = newFontSize;
          content.style.fontSize = `${newFontSize * currentScale}px`;
        } else if (activeHandle === 'mr') {
          const newW = Math.max(30, startW + dx);
          textItem.width = newW;
          textWidget.style.width = `${newW * currentScale}px`;
        }
      }
    });

    window.addEventListener('mouseup', () => {
      if (isDragging || isResizing) {
        scheduleRecovery();
      }
      isDragging = false;
      isResizing = false;
    });
  }

  window.PDFTools.StudioTextWidgets = {
    init,
    renderActivePageWidgets,
    focusLatestTextWidget,
    commitTextInPlace,
    finishTextEditing,
    makeWidgetDraggable,
    makeWidgetResizable,
    makeShapeWidgetInteractive,
    makeTextWidgetDraggable,
    triggerImageReplacement,
    setReplaceImageTarget,
    getReplaceImageTarget: () => replaceImageTarget
  };

})(window);
