/**
 * PDF Tools — PDF Studio Annotations & Shape Overlays Controller
 * Manages freehand drawing (pen & highlighter with Bezier smoothing),
 * shape overlays (rectangle, circle, line, arrow), redaction marking & blackout baking,
 * annotation options bar, and in-studio sticky notes / comments drawer.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioAnnotations = (function () {
  let ctx = null;

  // Drawing & Shape creation state
  let isDrawing = false;
  let shapeStartX = 0;
  let shapeStartY = 0;
  let currentDrawPoints = [];
  let annCurrentColor = '#FACC15';
  let commentsFilter = 'all'; // 'all'|'active'|'resolved'

  // DOM Elements
  let annotationCanvas = null;
  let annOptionsBar = null;
  let annBarTitle = null;
  let annBarIcon = null;
  let annBarText = null;
  let annColorGroup = null;
  let annSwatchesContainer = null;
  let annCustomColorPicker = null;
  let annSizeGroup = null;
  let annSizeSelect = null;
  let annShapeGroup = null;
  let annFillShapeCheck = null;
  let annArrowLabel = null;
  let annArrowCheck = null;
  let annRedactGroup = null;
  let annRedactCountBadge = null;
  let annApplyRedactionsBtn = null;
  let annClearRedactionsBtn = null;
  let annFormsGroup = null;
  let annCommentsGroup = null;
  let annToggleCommentsDrawerBtn = null;
  let annCommentsCountLabel = null;
  let closeAnnOptionsBtn = null;

  // Redaction Confirmation Modal Elements
  let redactConfirmModal = null;
  let closeRedactConfirmModalBtn = null;
  let cancelRedactConfirmBtn = null;
  let confirmApplyRedactBtn = null;

  // Comments Drawer Elements
  let commentsDrawer = null;
  let closeCommentsDrawerBtn = null;
  let commentsListContainer = null;
  let toolComment = null;

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

  function getCanvas() {
    return (ctx && ctx.getAnnotationCanvas && ctx.getAnnotationCanvas()) || annotationCanvas || document.getElementById('annotationCanvas');
  }

  function getUndoStack() {
    return (ctx && ctx.getUndoStack ? ctx.getUndoStack() : ctx?.undoStack) || [];
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  function renderActivePageWidgets() {
    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
  }

  function setDocumentDirty(dirty) {
    if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(dirty);
  }

  function openDocument(file) {
    if (ctx && ctx.openDocument) return ctx.openDocument(file);
    return Promise.resolve();
  }

  function switchTool(tool) {
    if (ctx && ctx.switchTool) ctx.switchTool(tool);
  }

  function cacheElements() {
    annotationCanvas = (ctx && ctx.getAnnotationCanvas && ctx.getAnnotationCanvas()) || document.getElementById('annotationCanvas');
    annOptionsBar = document.getElementById('annOptionsBar');
    annBarTitle = document.getElementById('annBarTitle');
    annBarIcon = document.getElementById('annBarIcon');
    annBarText = document.getElementById('annBarText');
    annColorGroup = document.getElementById('annColorGroup');
    annSwatchesContainer = document.getElementById('annSwatchesContainer');
    annCustomColorPicker = document.getElementById('annCustomColorPicker');
    annSizeGroup = document.getElementById('annSizeGroup');
    annSizeSelect = document.getElementById('annSizeSelect');
    annShapeGroup = document.getElementById('annShapeGroup');
    annFillShapeCheck = document.getElementById('annFillShapeCheck');
    annArrowLabel = document.getElementById('annArrowLabel');
    annArrowCheck = document.getElementById('annArrowCheck');
    annRedactGroup = document.getElementById('annRedactGroup');
    annRedactCountBadge = document.getElementById('annRedactCountBadge');
    annApplyRedactionsBtn = document.getElementById('annApplyRedactionsBtn');
    annClearRedactionsBtn = document.getElementById('annClearRedactionsBtn');
    annFormsGroup = document.getElementById('annFormsGroup');
    annCommentsGroup = document.getElementById('annCommentsGroup');
    annToggleCommentsDrawerBtn = document.getElementById('annToggleCommentsDrawerBtn');
    annCommentsCountLabel = document.getElementById('annCommentsCountLabel');
    closeAnnOptionsBtn = document.getElementById('closeAnnOptionsBtn');

    redactConfirmModal = document.getElementById('redactConfirmModal');
    closeRedactConfirmModalBtn = document.getElementById('closeRedactConfirmModalBtn');
    cancelRedactConfirmBtn = document.getElementById('cancelRedactConfirmBtn');
    confirmApplyRedactBtn = document.getElementById('confirmApplyRedactBtn');

    commentsDrawer = document.getElementById('commentsDrawer');
    closeCommentsDrawerBtn = document.getElementById('closeCommentsDrawerBtn');
    commentsListContainer = document.getElementById('commentsListContainer');
    toolComment = document.getElementById('toolComment');
  }

  // Helper to map fontFamily to CSS value
  function fontFamilyCSS(f) {
    if (!f) return 'Helvetica, Arial, sans-serif';
    const lower = f.toLowerCase();
    if (lower.includes('times'))   return '"Times New Roman", Times, serif';
    if (lower.includes('courier')) return '"Courier New", Courier, monospace';
    if (lower.includes('roboto'))  return 'Roboto, sans-serif';
    if (lower.includes('inter'))   return 'Inter, sans-serif';
    if (lower.includes('georgia')) return 'Georgia, serif';
    if (lower.includes('verdana')) return 'Verdana, Geneva, sans-serif';
    if (lower.includes('tahoma'))  return 'Tahoma, sans-serif';
    if (lower.includes('trebuchet')) return '"Trebuchet MS", sans-serif';
    if (lower.includes('poppins')) return 'Poppins, sans-serif';
    if (lower.includes('montserrat')) return 'Montserrat, sans-serif';
    return `${f}, Arial, sans-serif`;
  }
  window.PDFTools.fontFamilyCSS = fontFamilyCSS;

  function drawArrowhead(canvasCtx, fromX, fromY, toX, toY, headLength = 12) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    canvasCtx.save();
    canvasCtx.fillStyle = canvasCtx.strokeStyle;
    canvasCtx.beginPath();
    canvasCtx.moveTo(toX, toY);
    canvasCtx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    canvasCtx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    canvasCtx.closePath();
    canvasCtx.fill();
    canvasCtx.restore();
  }

  function drawSmoothPointsOnCanvas(canvasCtx, points, color, width, isHighlight = false) {
    if (!points || points.length === 0) return;
    const currentScale = getScale();
    canvasCtx.save();
    canvasCtx.strokeStyle = color || (isHighlight ? '#FACC15' : '#EF4444');
    canvasCtx.lineWidth = (width || (isHighlight ? 18 : 3)) * currentScale;
    canvasCtx.lineCap = 'round';
    canvasCtx.lineJoin = 'round';

    if (isHighlight) {
      canvasCtx.globalAlpha = 0.38;
      canvasCtx.globalCompositeOperation = 'multiply';
    } else {
      canvasCtx.globalAlpha = 1.0;
    }

    if (points.length === 1) {
      canvasCtx.fillStyle = canvasCtx.strokeStyle;
      canvasCtx.beginPath();
      canvasCtx.arc(points[0].x * currentScale, points[0].y * currentScale, canvasCtx.lineWidth / 2, 0, Math.PI * 2);
      canvasCtx.fill();
    } else if (points.length === 2) {
      canvasCtx.beginPath();
      canvasCtx.moveTo(points[0].x * currentScale, points[0].y * currentScale);
      canvasCtx.lineTo(points[1].x * currentScale, points[1].y * currentScale);
      canvasCtx.stroke();
    } else {
      canvasCtx.beginPath();
      canvasCtx.moveTo(points[0].x * currentScale, points[0].y * currentScale);
      for (let i = 1; i < points.length - 1; i++) {
        const xc = ((points[i].x + points[i + 1].x) / 2) * currentScale;
        const yc = ((points[i].y + points[i + 1].y) / 2) * currentScale;
        canvasCtx.quadraticCurveTo(points[i].x * currentScale, points[i].y * currentScale, xc, yc);
      }
      const last = points[points.length - 1];
      canvasCtx.lineTo(last.x * currentScale, last.y * currentScale);
      canvasCtx.stroke();
    }
    canvasCtx.restore();
  }

  function redrawAnnotationLayer() {
    const canvas = getCanvas();
    if (!canvas) return;
    const canvasCtx = canvas.getContext('2d');
    canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

    const currentDoc = getDoc();
    if (!currentDoc) return;
    const currentScale = getScale();
    const activeMode = getActiveMode();
    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);

    // 1. Draw Freehand Strokes & Highlighters with Bezier Smoothing
    (pageAnn.drawings || []).forEach(draw => {
      if (!draw.points || draw.points.length === 0) return;
      drawSmoothPointsOnCanvas(canvasCtx, draw.points, draw.color, draw.width, draw.type === 'highlighter');
    });

    // 2c. Draw Sticky Note / Comment Badges
    (pageAnn.comments || []).forEach(cmt => {
      const cx = cmt.x * currentScale;
      const cy = cmt.y * currentScale;
      canvasCtx.beginPath();
      canvasCtx.fillStyle = cmt.resolved ? '#10B981' : (cmt.color || '#F59E0B');
      canvasCtx.arc(cx, cy, Math.max(10, 13 * currentScale), 0, Math.PI * 2);
      canvasCtx.fill();
      canvasCtx.strokeStyle = '#FFFFFF';
      canvasCtx.lineWidth = 2;
      canvasCtx.stroke();
      canvasCtx.fillStyle = '#FFFFFF';
      const bsz = Math.max(4, 5 * currentScale);
      canvasCtx.beginPath();
      canvasCtx.moveTo(cx - bsz, cy - bsz * 0.7);
      canvasCtx.lineTo(cx + bsz, cy - bsz * 0.7);
      canvasCtx.quadraticCurveTo(cx + bsz, cy + bsz * 0.5, cx + bsz * 0.4, cy + bsz * 0.5);
      canvasCtx.lineTo(cx, cy + bsz);
      canvasCtx.lineTo(cx - bsz * 0.3, cy + bsz * 0.5);
      canvasCtx.lineTo(cx - bsz, cy + bsz * 0.5);
      canvasCtx.closePath();
      canvasCtx.fill();
    });

    // 2d. Draw Redaction Overlays
    (pageAnn.redactions || []).forEach(red => {
      const rx = red.x * currentScale;
      const ry = red.y * currentScale;
      const rw = red.width * currentScale;
      const rh = red.height * currentScale;

      if (red.applied) {
        canvasCtx.fillStyle = '#000000';
        canvasCtx.fillRect(rx, ry, rw, rh);
        canvasCtx.fillStyle = '#FFFFFF';
        canvasCtx.font = `bold ${Math.max(8, 10 * currentScale)}px sans-serif`;
        canvasCtx.textAlign = 'center';
        canvasCtx.textBaseline = 'middle';
        canvasCtx.fillText('[REDACTED]', rx + rw / 2, ry + rh / 2);
      } else {
        // Marked preview
        canvasCtx.save();
        canvasCtx.strokeStyle = '#EF4444';
        canvasCtx.lineWidth = 2;
        canvasCtx.setLineDash([4, 4]);
        canvasCtx.strokeRect(rx, ry, rw, rh);
        canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.15)';
        canvasCtx.fillRect(rx, ry, rw, rh);
        canvasCtx.fillStyle = '#EF4444';
        canvasCtx.font = `bold 9px sans-serif`;
        canvasCtx.fillText('REDACT', rx + 4, ry + 11);
        canvasCtx.restore();
      }
    });

    (pageAnn.edits || []).forEach(edit => {
      // 1. Completely cover original text location with padded background so old text NEVER peeks through!
      const origX = (edit.originalX !== undefined ? edit.originalX : edit.x) * currentScale;
      const origY = (edit.originalY !== undefined ? edit.originalY : edit.y) * currentScale;
      const origW = (edit.originalWidth !== undefined ? edit.originalWidth : edit.width) * currentScale;
      const origH = (edit.originalHeight !== undefined ? edit.originalHeight : edit.height) * currentScale;

      const padX = 3 * currentScale;
      const padY = 2.5 * currentScale;
      const bgColor = (edit.backgroundColor && edit.backgroundColor !== 'transparent' && edit.backgroundColor !== 'none')
        ? edit.backgroundColor
        : '#ffffff';

      const hasText = edit.text && edit.text.trim().length > 0 && !edit.deleted;
      let maxLineWidth = origW;

      if (hasText) {
        const fontFam = fontFamilyCSS(edit.fontFamily || 'Helvetica');
        const boldStr = edit.bold ? 'bold ' : '';
        const italicStr = edit.italic ? 'italic ' : '';
        const fontSizePx = (edit.fontSize || 14) * currentScale;
        canvasCtx.font = `${italicStr}${boldStr}${fontSizePx}px ${fontFam}`;
        canvasCtx.textBaseline = 'alphabetic';

        const rawLines = edit.text.split('\n');
        rawLines.forEach(l => {
          const mw = canvasCtx.measureText(l).width;
          if (mw > maxLineWidth) maxLineWidth = mw;
        });
      }

      // Wipe out original text on canvas completely so old text NEVER shows underneath!
      canvasCtx.fillStyle = bgColor;
      canvasCtx.fillRect(origX - padX, origY - padY, maxLineWidth + (padX * 2), origH + (padY * 2));

      // If text was moved to a new position, also fill background at new position
      if (hasText && (edit.x !== edit.originalX || edit.y !== edit.originalY)) {
        canvasCtx.fillRect((edit.x * currentScale) - padX, (edit.y * currentScale) - padY, maxLineWidth + (padX * 2), (edit.height * currentScale) + (padY * 2));
      }

      // 2. Render replacement text on canvas:
      if (hasText && activeMode !== 'edit') {
        canvasCtx.fillStyle = edit.color || '#111827';
        const baseBaseline = (edit.baselineScreenY !== undefined)
          ? edit.baselineScreenY * currentScale
          : ((edit.y + (edit.fontSize || 14) * 0.82) * currentScale);

        const origBaseY = (edit.originalY !== undefined ? edit.originalY : edit.y) * currentScale;
        const curY = edit.y * currentScale;
        const yShift = curY - origBaseY;
        const effectiveBaselineY = baseBaseline + yShift;

        const rawLines = edit.text.split('\n');
        const fontSizePx = (edit.fontSize || 14) * currentScale;
        const lineHeightPx = fontSizePx * 1.25;
        rawLines.forEach((line, idx) => {
          canvasCtx.fillText(line, edit.x * currentScale, effectiveBaselineY + (idx * lineHeightPx));
        });
      }
    });
  }

  function setupSwatches(colors, defaultColor) {
    if (!annSwatchesContainer) return;
    annSwatchesContainer.innerHTML = '';
    annCurrentColor = defaultColor;
    colors.forEach((c) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `ann-swatch ${c === defaultColor ? 'active' : ''}`;
      btn.style.background = c;
      btn.dataset.color = c;
      btn.addEventListener('click', () => {
        annSwatchesContainer.querySelectorAll('.ann-swatch').forEach(s => s.classList.remove('active'));
        btn.classList.add('active');
        annCurrentColor = c;
        if (annCustomColorPicker) annCustomColorPicker.value = c;
      });
      annSwatchesContainer.appendChild(btn);
    });
    if (annCustomColorPicker) {
      annCustomColorPicker.value = defaultColor;
      annSwatchesContainer.appendChild(annCustomColorPicker);
    }
  }

  function getAnnStrokeWidth(mode) {
    const val = annSizeSelect ? annSizeSelect.value : 'medium';
    if (mode === 'highlight') {
      if (val === 'fine') return 10;
      if (val === 'medium') return 18;
      if (val === 'thick') return 28;
      if (val === 'extra') return 40;
      return 18;
    } else {
      if (val === 'fine') return 1.5;
      if (val === 'medium') return 3;
      if (val === 'thick') return 5;
      if (val === 'extra') return 8;
      return 3;
    }
  }

  function updateRedactBadge() {
    if (!annRedactCountBadge) return;
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const unapplied = (pageAnn.redactions || []).filter(r => !r.applied).length;
    annRedactCountBadge.textContent = `${unapplied} marked`;
  }

  function updateCommentCountBadge() {
    if (!annCommentsCountLabel) return;
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    annCommentsCountLabel.textContent = (pageAnn.comments || []).length;
  }

  function updateAnnotationBar(mode) {
    if (!annOptionsBar) return;
    if (mode === 'highlight') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 11-6 6v3h3l6-6"/><path d="m22 12-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4"/></svg>';
      annBarText.textContent = 'Highlighter';
      annColorGroup.style.display = 'flex';
      annSizeGroup.style.display = 'flex';
      annShapeGroup.style.display = 'none';
      annRedactGroup.style.display = 'none';
      annFormsGroup.style.display = 'none';
      annCommentsGroup.style.display = 'none';
      setupSwatches(['#FACC15', '#22C55E', '#38BDF8', '#F472B6', '#FB923C'], '#FACC15');
    } else if (mode === 'draw') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
      annBarText.textContent = 'Pen Drawing';
      annColorGroup.style.display = 'flex';
      annSizeGroup.style.display = 'flex';
      annShapeGroup.style.display = 'none';
      annRedactGroup.style.display = 'none';
      annFormsGroup.style.display = 'none';
      annCommentsGroup.style.display = 'none';
      setupSwatches(['#111827', '#2563EB', '#EF4444', '#10B981', '#8B5CF6'], '#111827');
    } else if (mode === 'rect' || mode === 'circle' || mode === 'line') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = mode === 'rect' ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>' : (mode === 'circle' ? '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg>' : '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="19" x2="19" y2="5"/></svg>');
      annBarText.textContent = mode === 'rect' ? 'Rectangle' : (mode === 'circle' ? 'Circle' : 'Line');
      annColorGroup.style.display = 'flex';
      annSizeGroup.style.display = 'flex';
      annShapeGroup.style.display = 'flex';
      annArrowLabel.style.display = mode === 'line' ? 'flex' : 'none';
      annRedactGroup.style.display = 'none';
      annFormsGroup.style.display = 'none';
      annCommentsGroup.style.display = 'none';
      setupSwatches(['#EF4444', '#1E3A8A', '#10B981', '#F59E0B', '#111827'], '#EF4444');
    } else if (mode === 'redact') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" fill="currentColor"/></svg>';
      annBarText.textContent = 'Redaction Mode';
      annColorGroup.style.display = 'none';
      annSizeGroup.style.display = 'none';
      annShapeGroup.style.display = 'none';
      annRedactGroup.style.display = 'flex';
      annFormsGroup.style.display = 'none';
      annCommentsGroup.style.display = 'none';
      updateRedactBadge();
    } else if (mode === 'comment') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
      annBarText.textContent = 'Comments & Notes';
      annColorGroup.style.display = 'none';
      annSizeGroup.style.display = 'none';
      annShapeGroup.style.display = 'none';
      annRedactGroup.style.display = 'none';
      annFormsGroup.style.display = 'none';
      annCommentsGroup.style.display = 'flex';
      updateCommentCountBadge();
    } else if (mode === 'forms') {
      annOptionsBar.style.display = 'flex';
      annBarIcon.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="7" y1="8" x2="17" y2="8"/><line x1="7" y1="12" x2="17" y2="12"/><line x1="7" y1="16" x2="12" y2="16"/></svg>';
      annBarText.textContent = 'AcroForms Builder';
      annColorGroup.style.display = 'none';
      annSizeGroup.style.display = 'none';
      annShapeGroup.style.display = 'none';
      annRedactGroup.style.display = 'none';
      annFormsGroup.style.display = 'flex';
      annCommentsGroup.style.display = 'none';
    } else {
      annOptionsBar.style.display = 'none';
    }
  }

  async function handleCanvasMouseDown(e, clickX, clickY) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activeMode = getActiveMode();

    if (activeMode === 'comment') {
      let author = 'Reviewer';
      let commentText = '';
      if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.prompt) {
        author = (await window.PDFTools.Modal.prompt('Author / Your Name:', 'Reviewer', { title: 'Comment Author' })) || 'Reviewer';
        commentText = await window.PDFTools.Modal.prompt('Enter comment or sticky note text:', '', { title: 'Sticky Note' });
      }
      if (commentText && commentText.trim()) {
        window.PDFTools.CommentsEngine.addComment(currentDoc, currentDoc.currentPage, clickX, clickY, commentText.trim(), author, annCurrentColor || '#F59E0B');
        if (commentsDrawer) commentsDrawer.classList.add('active');
        renderCommentsList();
        redrawAnnotationLayer();
        updateCommentCountBadge();
        scheduleRecovery();
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.success('Sticky note added!');
        }
      }
      return;
    }

    if (activeMode === 'draw' || activeMode === 'highlight') {
      isDrawing = true;
      currentDrawPoints = [{ x: clickX, y: clickY }];
    } else if (activeMode === 'rect' || activeMode === 'circle' || activeMode === 'line' || activeMode === 'redact') {
      isDrawing = true;
      shapeStartX = clickX;
      shapeStartY = clickY;
    }
  }

  function handleCanvasMouseMove(e, curX, curY) {
    if (!isDrawing) return;
    const canvas = getCanvas();
    if (!canvas) return;
    const activeMode = getActiveMode();
    const currentScale = getScale();

    if (activeMode === 'draw' || activeMode === 'highlight') {
      currentDrawPoints.push({ x: curX, y: curY });
      redrawAnnotationLayer();
      const canvasCtx = canvas.getContext('2d');
      const strokeW = getAnnStrokeWidth(activeMode);
      drawSmoothPointsOnCanvas(canvasCtx, currentDrawPoints, annCurrentColor, strokeW, activeMode === 'highlight');
    } else if (activeMode === 'rect' || activeMode === 'circle' || activeMode === 'line' || activeMode === 'redact') {
      redrawAnnotationLayer();
      const canvasCtx = canvas.getContext('2d');
      canvasCtx.beginPath();
      const strokeW = getAnnStrokeWidth('shape');
      canvasCtx.strokeStyle = activeMode === 'redact' ? '#EF4444' : (annCurrentColor || '#EF4444');
      canvasCtx.lineWidth = strokeW * currentScale;

      if (activeMode === 'redact') {
        const w = (curX - shapeStartX) * currentScale;
        const h = (curY - shapeStartY) * currentScale;
        canvasCtx.save();
        canvasCtx.setLineDash([4, 4]);
        canvasCtx.strokeRect(shapeStartX * currentScale, shapeStartY * currentScale, w, h);
        canvasCtx.fillStyle = 'rgba(239, 68, 68, 0.2)';
        canvasCtx.fillRect(shapeStartX * currentScale, shapeStartY * currentScale, w, h);
        canvasCtx.restore();
      } else if (activeMode === 'rect') {
        const sx = Math.min(shapeStartX, curX) * currentScale;
        const sy = Math.min(shapeStartY, curY) * currentScale;
        const sw = Math.abs(curX - shapeStartX) * currentScale;
        const sh = Math.abs(curY - shapeStartY) * currentScale;
        if (annFillShapeCheck && annFillShapeCheck.checked) {
          canvasCtx.fillStyle = (annCurrentColor || '#EF4444') + '33';
          canvasCtx.fillRect(sx, sy, sw, sh);
        }
        canvasCtx.rect(sx, sy, sw, sh);
        canvasCtx.stroke();
      } else if (activeMode === 'circle') {
        const cx = (shapeStartX + (curX - shapeStartX) / 2) * currentScale;
        const cy = (shapeStartY + (curY - shapeStartY) / 2) * currentScale;
        const rx = Math.abs(curX - shapeStartX) * currentScale / 2;
        const ry = Math.abs(curY - shapeStartY) * currentScale / 2;
        canvasCtx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        if (annFillShapeCheck && annFillShapeCheck.checked) {
          canvasCtx.fillStyle = (annCurrentColor || '#EF4444') + '33';
          canvasCtx.fill();
        }
        canvasCtx.stroke();
      } else if (activeMode === 'line') {
        const x1 = shapeStartX * currentScale;
        const y1 = shapeStartY * currentScale;
        const x2 = curX * currentScale;
        const y2 = curY * currentScale;
        canvasCtx.moveTo(x1, y1);
        canvasCtx.lineTo(x2, y2);
        canvasCtx.stroke();
        if (annArrowCheck && annArrowCheck.checked) {
          drawArrowhead(canvasCtx, x1, y1, x2, y2, Math.max(8, 12 * currentScale));
        }
      }
    }
  }

  function handleWindowMouseUp(e) {
    const currentDoc = getDoc();
    if (!isDrawing || !currentDoc) return;
    isDrawing = false;

    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const activeMode = getActiveMode();
    const currentScale = getScale();
    const undoStack = getUndoStack();

    if (activeMode === 'draw' || activeMode === 'highlight') {
      if (currentDrawPoints.length > 1) {
        const strokeW = getAnnStrokeWidth(activeMode);
        const newDraw = {
          type: activeMode === 'highlight' ? 'highlighter' : 'pen',
          color: annCurrentColor,
          width: strokeW,
          points: currentDrawPoints
        };
        pageAnn.drawings.push(newDraw);
        undoStack.push({ pageNum: currentDoc.currentPage, type: 'drawing', item: newDraw });
        scheduleRecovery();
        redrawAnnotationLayer();
      }
      currentDrawPoints = [];
    } else if (activeMode === 'rect' || activeMode === 'circle' || activeMode === 'line' || activeMode === 'redact') {
      const canvas = getCanvas();
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const endX = (e.clientX - rect.left) / currentScale;
      const endY = (e.clientY - rect.top) / currentScale;

      const minX = Math.min(shapeStartX, endX);
      const minY = Math.min(shapeStartY, endY);
      const w = Math.abs(endX - shapeStartX);
      const h = Math.abs(endY - shapeStartY);

      if (activeMode === 'redact') {
        if (w > 5 && h > 5) {
          if (!pageAnn.redactions) pageAnn.redactions = [];
          pageAnn.redactions.push({
            id: 'red_' + Date.now(),
            x: minX,
            y: minY,
            width: w,
            height: h,
            applied: false
          });
          redrawAnnotationLayer();
          updateRedactBadge();
          scheduleRecovery();
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Area marked for blackout. Click "Apply Permanent Blackout" to finalize.');
          }
        }
        return;
      }

      if (w > 4 || h > 4) {
        const strokeW = getAnnStrokeWidth('shape');
        const isFilled = annFillShapeCheck && annFillShapeCheck.checked;
        const isArrowLine = activeMode === 'line' && annArrowCheck && annArrowCheck.checked;

        const newShape = {
          id: 'shape_' + Date.now(),
          type: activeMode === 'rect' ? 'rectangle' : (activeMode === 'circle' ? 'circle' : 'line'),
          x: activeMode === 'line' ? shapeStartX : minX,
          y: activeMode === 'line' ? shapeStartY : minY,
          width: w,
          height: h,
          x2: endX,
          y2: endY,
          strokeColor: annCurrentColor || '#EF4444',
          strokeWidth: strokeW,
          fillColor: isFilled ? ((annCurrentColor || '#EF4444') + '33') : 'transparent',
          isArrow: isArrowLine
        };
        if (!pageAnn.shapes) pageAnn.shapes = [];
        pageAnn.shapes.push(newShape);
        undoStack.push({ pageNum: currentDoc.currentPage, type: 'shape', item: newShape });
        scheduleRecovery();
        redrawAnnotationLayer();
        renderActivePageWidgets();
      }
    }
  }

  function closeRedactModal() {
    if (redactConfirmModal) {
      redactConfirmModal.style.display = 'none';
      redactConfirmModal.classList.remove('active');
    }
  }

  function renderCommentsList() {
    const currentDoc = getDoc();
    if (!commentsListContainer || !currentDoc) return;
    const allComments = window.PDFTools.CommentsEngine.getAllComments(currentDoc);
    const filtered = allComments.filter(c => {
      if (commentsFilter === 'active') return !c.resolved;
      if (commentsFilter === 'resolved') return c.resolved;
      return true;
    });

    commentsListContainer.innerHTML = '';
    if (filtered.length === 0) {
      commentsListContainer.innerHTML = `<div style="text-align: center; color: #9CA3AF; font-size: 0.85rem; padding: 20px 0;">No ${commentsFilter !== 'all' ? commentsFilter : ''} comments. Click anywhere on the page when Comment tool is active.</div>`;
      return;
    }

    filtered.forEach(cmt => {
      const item = document.createElement('div');
      item.style.cssText = `background: #1F2937; border-radius: 6px; padding: 10px; border-left: 4px solid ${cmt.color || '#F59E0B'}; display: flex; flex-direction: column; gap: 6px;`;

      const header = document.createElement('div');
      header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #9CA3AF;';
      header.innerHTML = `<span><strong>${cmt.author}</strong> (Page ${cmt.pageNum})</span><span>${cmt.timestamp}</span>`;

      const body = document.createElement('div');
      body.style.cssText = `font-size: 0.85rem; color: ${cmt.resolved ? '#9CA3AF' : '#F3F4F6'}; ${cmt.resolved ? 'text-decoration: line-through;' : ''}`;
      body.textContent = cmt.text;

      const actions = document.createElement('div');
      actions.style.cssText = 'display: flex; gap: 8px; align-items: center; margin-top: 4px;';

      const resolveBtn = document.createElement('button');
      resolveBtn.type = 'button';
      resolveBtn.className = 'btn btn-ghost btn-sm';
      resolveBtn.style.cssText = 'padding: 2px 6px; font-size: 0.7rem;';
      resolveBtn.textContent = cmt.resolved ? 'Resolved' : 'Mark Resolved';
      resolveBtn.addEventListener('click', () => {
        window.PDFTools.CommentsEngine.toggleResolved(currentDoc, cmt.id);
        renderCommentsList();
        scheduleRecovery();
      });

      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'btn btn-ghost btn-sm';
      delBtn.style.cssText = 'padding: 2px 6px; font-size: 0.7rem; color: #EF4444;';
      delBtn.textContent = 'Delete';
      delBtn.addEventListener('click', () => {
        window.PDFTools.CommentsEngine.deleteComment(currentDoc, cmt.id);
        renderCommentsList();
        renderActivePageWidgets();
        scheduleRecovery();
      });

      actions.appendChild(resolveBtn);
      actions.appendChild(delBtn);

      // Replies list
      if (cmt.replies && cmt.replies.length > 0) {
        const repliesDiv = document.createElement('div');
        repliesDiv.style.cssText = 'display: flex; flex-direction: column; gap: 4px; padding-left: 10px; border-left: 2px solid #374151; margin-top: 4px;';
        cmt.replies.forEach(rep => {
          const rDiv = document.createElement('div');
          rDiv.style.cssText = 'font-size: 0.75rem; color: #D1D5DB;';
          rDiv.innerHTML = `<strong>${rep.author}:</strong> ${rep.text}`;
          repliesDiv.appendChild(rDiv);
        });
        item.appendChild(repliesDiv);
      }

      // Reply input box
      const replyBox = document.createElement('div');
      replyBox.style.cssText = 'display: flex; gap: 4px; margin-top: 4px;';
      const rInput = document.createElement('input');
      rInput.type = 'text';
      rInput.placeholder = 'Reply...';
      rInput.className = 'form-input';
      rInput.style.cssText = 'flex: 1; font-size: 0.75rem; padding: 2px 6px;';
      const rBtn = document.createElement('button');
      rBtn.type = 'button';
      rBtn.className = 'btn btn-primary btn-sm';
      rBtn.style.cssText = 'padding: 2px 8px; font-size: 0.7rem;';
      rBtn.textContent = 'Reply';
      rBtn.addEventListener('click', () => {
        if (rInput.value.trim()) {
          window.PDFTools.CommentsEngine.addReply(currentDoc, cmt.id, rInput.value.trim());
          renderCommentsList();
          scheduleRecovery();
        }
      });
      replyBox.appendChild(rInput);
      replyBox.appendChild(rBtn);

      item.appendChild(header);
      item.appendChild(body);
      item.appendChild(actions);
      item.appendChild(replyBox);
      commentsListContainer.appendChild(item);
    });
  }

  function bindEventListeners() {
    if (annCustomColorPicker) {
      annCustomColorPicker.addEventListener('input', (e) => {
        annCurrentColor = e.target.value;
        if (annSwatchesContainer) {
          annSwatchesContainer.querySelectorAll('.ann-swatch').forEach(s => s.classList.remove('active'));
        }
      });
    }

    if (closeAnnOptionsBtn) {
      closeAnnOptionsBtn.addEventListener('click', () => switchTool('select'));
    }

    // Redaction modal listeners
    if (closeRedactConfirmModalBtn) closeRedactConfirmModalBtn.addEventListener('click', closeRedactModal);
    if (cancelRedactConfirmBtn) cancelRedactConfirmBtn.addEventListener('click', closeRedactModal);

    if (annApplyRedactionsBtn) {
      annApplyRedactionsBtn.addEventListener('click', () => {
        const currentDoc = getDoc();
        if (!currentDoc) {
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Please open a PDF document first.');
          }
          return;
        }
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        const hasMarks = (pageAnn.redactions && pageAnn.redactions.length > 0);
        if (!hasMarks) {
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('No marked areas to redact on this page. Drag on the document first.');
          }
          return;
        }
        if (redactConfirmModal) {
          redactConfirmModal.style.display = 'flex';
          redactConfirmModal.classList.add('active');
        }
      });
    }

    if (confirmApplyRedactBtn) {
      confirmApplyRedactBtn.addEventListener('click', async () => {
        closeRedactModal();
        const currentDoc = getDoc();
        if (!currentDoc) return;

        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.info(window.PDFTools.i18n.t('modal.redact_confirm.applying') || 'Rasterizing and permanently redacting page...');
        }

        try {
          // exportDocument bakes every edit first and then runs the redaction pass on the
          // baked result (see pdf-studio.js step 4h). Rasterizing from currentDoc.pdfJsDoc
          // directly would render the ORIGINAL file and drop the user's unsaved edits.
          const newBytes = await window.PDFTools.Studio.exportDocument(currentDoc);
          const newFile = new File([newBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
          await openDocument(newFile);
          setDocumentDirty(true);

          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.success(window.PDFTools.i18n.t('modal.redact_confirm.success') || 'Permanent redaction applied successfully! Page rasterized.');
          }
        } catch (err) {
          console.error('Permanent redaction error:', err);
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.error(err.message || 'Failed to apply permanent redactions.');
          }
        }
      });
    }

    if (annClearRedactionsBtn) {
      annClearRedactionsBtn.addEventListener('click', () => {
        const currentDoc = getDoc();
        if (!currentDoc) return;
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        pageAnn.redactions = (pageAnn.redactions || []).filter(r => r.applied);
        redrawAnnotationLayer();
        updateRedactBadge();
        scheduleRecovery();
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.info('Unapplied redaction marks cleared.');
        }
      });
    }

    if (annToggleCommentsDrawerBtn) {
      annToggleCommentsDrawerBtn.addEventListener('click', () => {
        if (commentsDrawer) commentsDrawer.classList.toggle('active');
        renderCommentsList();
      });
    }

    // AcroForms Quick Buttons
    document.querySelectorAll('.ann-form-add-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const currentDoc = getDoc();
        if (!currentDoc) {
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Please open a PDF document first.');
          }
          return;
        }
        const fType = btn.dataset.fieldType;
        const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
        if (!pageAnn.formFields) pageAnn.formFields = [];

        const newField = {
          id: 'field_' + Date.now(),
          name: `${fType}_${pageAnn.formFields.length + 1}`,
          type: fType,
          x: 100,
          y: 100,
          width: fType === 'checkbox' ? 24 : 140,
          height: fType === 'checkbox' ? 24 : 32,
          value: fType === 'checkbox' ? false : (fType === 'button' ? 'Submit' : ''),
          options: fType === 'dropdown' ? ['Option 1', 'Option 2', 'Option 3'] : []
        };
        pageAnn.formFields.push(newField);
        getUndoStack().push({ pageNum: currentDoc.currentPage, type: 'field', item: newField });
        scheduleRecovery();
        renderActivePageWidgets();
        if (window.PDFTools && window.PDFTools.Toast) {
          window.PDFTools.Toast.success(`New ${fType} form field placed! Drag to position.`);
        }
      });
    });

    // Comments drawer listeners
    if (closeCommentsDrawerBtn) {
      closeCommentsDrawerBtn.addEventListener('click', () => {
        if (commentsDrawer) commentsDrawer.classList.remove('active');
      });
    }

    document.getElementById('btnFilterAllComments')?.addEventListener('click', () => {
      commentsFilter = 'all';
      renderCommentsList();
    });
    document.getElementById('btnFilterActiveComments')?.addEventListener('click', () => {
      commentsFilter = 'active';
      renderCommentsList();
    });
    document.getElementById('btnFilterResolvedComments')?.addEventListener('click', () => {
      commentsFilter = 'resolved';
      renderCommentsList();
    });

    // Window mouseup listener for drawing & shape completion
    window.addEventListener('mouseup', (e) => {
      handleWindowMouseUp(e);
    });

    // Canvas mousemove listener for drawing & shape live preview
    if (annotationCanvas) {
      annotationCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing) return;
        const rect = annotationCanvas.getBoundingClientRect();
        const currentScale = getScale();
        const curX = (e.clientX - rect.left) / currentScale;
        const curY = (e.clientY - rect.top) / currentScale;
        handleCanvasMouseMove(e, curX, curY);
      });
    }
  }

  return {
    init,
    drawArrowhead,
    drawSmoothPointsOnCanvas,
    redrawAnnotationLayer,
    setupSwatches,
    getAnnStrokeWidth,
    updateRedactBadge,
    updateCommentCountBadge,
    updateAnnotationBar,
    handleCanvasMouseDown,
    handleCanvasMouseMove,
    handleWindowMouseUp,
    renderCommentsList,
    closeRedactModal,
    getIsDrawing: () => isDrawing,
    getCurrentDrawPoints: () => currentDrawPoints,
    getAnnCurrentColor: () => annCurrentColor,
    setAnnCurrentColor: (c) => { annCurrentColor = c; }
  };
})();
