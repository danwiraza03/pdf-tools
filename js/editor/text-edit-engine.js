/**
 * Text Edit Engine
 * Implements clean, direct in-place PDF text editing (Adobe Acrobat Touchup Style).
 * Restores fast, seamless inline editing:
 * - Single direct contentEditable element (effortless click & type).
 * - Full live sync with right Format Panel (Font, Size, Color, Bold, Italic).
 * - 100% solid white background on edit/commit to completely prevent text duplication.
 * - Clean paragraph grouping without screen clutter.
 */

class TextEditEngine {
  constructor(viewerContainer, formatPaneController) {
    this.container = viewerContainer;
    this.setActiveText = formatPaneController;
  }

  clear() {
    this.container.querySelectorAll('.studio-text-block-edit, .studio-text-block-boundary').forEach(el => el.remove());
  }

  renderBlocks(blocks, scale, existingEdits = []) {
    this.clear();
    if (!blocks || blocks.length === 0) return;

    for (const block of blocks) {
      // 1. Subtle, clean paragraph boundary outline
      if (block.bbox && block.bbox.width > 20 && block.bbox.height > 8) {
        const blockBox = document.createElement('div');
        blockBox.className = 'studio-text-block-boundary';
        blockBox.style.left = `${(block.bbox.x - 4) * scale}px`;
        blockBox.style.top = `${(block.bbox.y - 3) * scale}px`;
        blockBox.style.width = `${(block.bbox.width + 8) * scale}px`;
        blockBox.style.height = `${(block.bbox.height + 6) * scale}px`;
        this.container.appendChild(blockBox);
      }

      // 2. Interactive text line hitboxes
      for (const para of block.paragraphs) {
        for (const line of para.lines) {
          if (!line.text || line.text.trim() === '') continue;

          // Find existing edit for this line
          const existingEdit = (existingEdits || []).find(edit => 
            edit.lineId === line.id || 
            (edit.originalX !== undefined && Math.abs(edit.originalX - line.bbox.x) < 4 && Math.abs(edit.originalY - line.bbox.y) < 4) ||
            (Math.abs(edit.x - line.bbox.x) < 4 && Math.abs(edit.y - line.bbox.y) < 4)
          );

          this._createLineOverlay(line, scale, existingEdit);
        }
      }
    }
  }

  _createLineOverlay(line, scale, existingEdit = null) {
    const target = document.createElement('div');
    target.className = 'studio-text-block-edit';
    target.dataset.lineId = line.id;

    const left = (existingEdit && existingEdit.x !== undefined ? existingEdit.x : line.bbox.x) * scale;
    const top = (existingEdit && existingEdit.y !== undefined ? existingEdit.y : line.bbox.y) * scale;
    const width = Math.max(line.bbox.width * scale, 24);
    const primaryFont = (line.runs && line.runs[0] && line.runs[0].font) || {
      size: 11,
      family: 'Helvetica',
      bold: false,
      italic: false
    };
    const fontSize = (existingEdit && existingEdit.fontSize) || primaryFont.size || 11;
    const height = Math.max(line.bbox.height * scale, fontSize * scale * 1.15);
    const color = (existingEdit && existingEdit.color) || (line.runs && line.runs[0] && line.runs[0].color) || '#111827';

    const isMoved = existingEdit && (
      (existingEdit.x !== undefined && Math.abs(existingEdit.x - (existingEdit.originalX !== undefined ? existingEdit.originalX : line.bbox.x)) > 1) ||
      (existingEdit.y !== undefined && Math.abs(existingEdit.y - (existingEdit.originalY !== undefined ? existingEdit.originalY : line.bbox.y)) > 1)
    );
    const isDeleted = existingEdit && (existingEdit.text === '' || existingEdit.deleted === true);
    const isCommitted = existingEdit && (existingEdit.text !== line.text || existingEdit.deleted === true || isMoved);
    const fullText = (existingEdit && existingEdit.text !== undefined) ? existingEdit.text : line.text;

    target.style.position = 'absolute';
    target.style.left = `${left}px`;
    target.style.top = `${top}px`;
    target.style.width = isCommitted ? 'auto' : `${width}px`;
    target.style.height = 'auto';
    target.style.minHeight = `${height}px`;
    target.style.pointerEvents = 'auto';
    target.style.cursor = 'text';
    target.style.zIndex = isCommitted ? '25' : '10';
    target.style.boxSizing = 'border-box';
    target.style.borderRadius = '2px';
    target.style.lineHeight = '1.25';
    target.style.whiteSpace = 'pre-wrap';
    target.style.wordBreak = 'break-word';
    target.style.outline = 'none';

    target.style.cursor = 'move';
    target.tabIndex = 0; // Allows keyboard navigation and arrow key nudging

    // 1. Dedicated Move Handle Pill (Shows on hover/selected)
    const dragHandle = document.createElement('div');
    dragHandle.className = 'studio-text-drag-handle';
    dragHandle.title = 'Tahan & geser untuk memindahkan posisi teks ini';
    dragHandle.style.color = '#ffffff';
    dragHandle.style.webkitTextFillColor = '#ffffff';
    dragHandle.innerHTML = `
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" style="flex-shrink:0;">
        <polyline points="5 9 2 12 5 15"></polyline>
        <polyline points="9 5 12 2 15 5"></polyline>
        <polyline points="15 19 12 22 9 19"></polyline>
        <polyline points="19 9 22 12 19 15"></polyline>
        <line x1="2" y1="12" x2="22" y2="12"></line>
        <line x1="12" y1="2" x2="12" y2="22"></line>
      </svg>
      <span style="color:#ffffff !important; -webkit-text-fill-color:#ffffff !important; font-weight:600; font-size:11px; letter-spacing:0.02em;">Geser</span>
    `;
    target.appendChild(dragHandle);

    // 2. Inner Text Content Span (Keeps text isolated from drag handle)
    const textSpan = document.createElement('span');
    textSpan.className = 'studio-text-content';
    textSpan.style.display = 'inline-block';
    textSpan.style.minWidth = '8px';
    textSpan.style.minHeight = '100%';
    textSpan.style.outline = 'none';

    if (isDeleted) {
      textSpan.innerText = '';
      target.style.border = '1px dashed rgba(239, 68, 68, 0.4)';
      target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
      target.style.color = 'transparent';
      target.style.webkitTextFillColor = 'transparent';
      textSpan.style.color = 'transparent';
      textSpan.style.webkitTextFillColor = 'transparent';
      target.style.fontSize = `${fontSize * scale}px`;
      target.style.padding = '0 2px';
      target.style.opacity = '1';
      target.style.overflow = 'visible';
      target.title = 'Teks dihapus (klik untuk menulis ulang)';
      target.classList.add('committed-edit');
      target.classList.add('deleted-edit');
    } else if (isCommitted) {
      textSpan.innerText = existingEdit.text;
      target.style.border = '1px solid rgba(59, 130, 246, 0.6)';
      target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
      target.style.color = color;
      target.style.webkitTextFillColor = color;
      textSpan.style.color = color;
      textSpan.style.webkitTextFillColor = color;
      target.style.fontSize = `${fontSize * scale}px`;
      target.style.fontFamily = (existingEdit.fontFamily || primaryFont.family || primaryFont.normalizedFamily || 'Helvetica') + ', Arial, sans-serif';
      target.style.fontWeight = existingEdit.bold ? 'bold' : (primaryFont.bold ? 'bold' : 'normal');
      target.style.fontStyle = existingEdit.italic ? 'italic' : (primaryFont.italic ? 'italic' : 'normal');
      target.style.padding = '0 2px';
      target.style.opacity = '1';
      target.style.overflow = 'visible';
      target.classList.add('committed-edit');
      target.classList.remove('deleted-edit');
      target.title = `Klik untuk menyunting: "${existingEdit.text}"`;
    } else {
      textSpan.innerText = fullText;
      target.style.border = '1px solid transparent';
      target.style.backgroundColor = 'transparent';
      target.style.color = 'transparent';
      target.style.webkitTextFillColor = 'transparent';
      textSpan.style.color = 'transparent';
      textSpan.style.webkitTextFillColor = 'transparent';
      target.style.fontSize = `${fontSize * scale}px`;
      target.style.fontFamily = (primaryFont.normalizedFamily || primaryFont.family || 'Helvetica') + ', Arial, sans-serif';
      target.style.opacity = '1';
      target.style.overflow = 'hidden';
      target.classList.remove('committed-edit');
      target.classList.remove('deleted-edit');
      target.title = `Klik untuk menyunting: "${fullText}"`;
    }
    target.appendChild(textSpan);

    // Hover highlight
    target.addEventListener('mouseenter', () => {
      if (!target.classList.contains('editing')) {
        target.style.boxShadow = '0 0 0 1px rgba(26, 115, 232, 0.4)';
        if (target.classList.contains('deleted-edit')) {
          target.style.border = '1.5px dashed #ef4444';
          target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
        } else if (target.classList.contains('committed-edit')) {
          target.style.border = '1.5px solid #1a73e8';
          target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
        } else {
          target.style.border = '1.5px solid #1a73e8';
          target.style.backgroundColor = 'rgba(26, 115, 232, 0.12)';
        }
      }
    });

    target.addEventListener('mouseleave', () => {
      if (!target.classList.contains('editing') && !target.classList.contains('selected-block')) {
        target.style.boxShadow = 'none';
        if (target.classList.contains('deleted-edit')) {
          target.style.border = '1px dashed rgba(239, 68, 68, 0.4)';
          target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
        } else if (target.classList.contains('committed-edit')) {
          target.style.border = '1px solid rgba(59, 130, 246, 0.6)';
          target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
        } else {
          target.style.border = '1px solid transparent';
          target.style.backgroundColor = 'transparent';
        }
      }
    });

    // Universal Drag & Move Controller
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let initialLeft = 0;
    let initialTop = 0;

    const startDrag = (e) => {
      e.preventDefault();
      e.stopPropagation();

      isDragging = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      initialLeft = parseFloat(target.style.left) || 0;
      initialTop = parseFloat(target.style.top) || 0;

      // Blur content editing if open
      if (textSpan.isContentEditable) {
        textSpan.contentEditable = 'false';
        target.classList.remove('editing');
      }

      const onMouseMove = (moveEvent) => {
        const dx = moveEvent.clientX - dragStartX;
        const dy = moveEvent.clientY - dragStartY;

        if (!isDragging && (Math.abs(dx) > 2 || Math.abs(dy) > 2)) {
          isDragging = true;
          target.classList.add('dragging-now');
          target.classList.add('committed-edit');
          target.style.backgroundColor = '#ffffff';
          target.style.color = color || '#111827';
          target.style.webkitTextFillColor = color || '#111827';
          textSpan.style.color = color || '#111827';
          textSpan.style.webkitTextFillColor = color || '#111827';
          target.style.zIndex = '9999';
        }

        if (isDragging) {
          target.style.left = `${initialLeft + dx}px`;
          target.style.top = `${initialTop + dy}px`;
        }
      };

      const onMouseUp = (upEvent) => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (isDragging) {
          upEvent.stopPropagation();
          target.classList.remove('dragging-now');
          target.classList.add('committed-edit');
          target.style.border = '1px solid rgba(59, 130, 246, 0.6)';
          target.style.backgroundColor = (existingEdit && existingEdit.backgroundColor) || '#ffffff';
          target.style.color = color || '#111827';
          target.style.webkitTextFillColor = color || '#111827';
          textSpan.style.color = color || '#111827';
          textSpan.style.webkitTextFillColor = color || '#111827';
          target.style.zIndex = '25';

          const finalDx = upEvent.clientX - dragStartX;
          const finalDy = upEvent.clientY - dragStartY;
          const newX = (initialLeft + finalDx) / scale;
          const newY = (initialTop + finalDy) / scale;

          const origX = (existingEdit && existingEdit.originalX !== undefined) ? existingEdit.originalX : line.bbox.x;
          const origY = (existingEdit && existingEdit.originalY !== undefined) ? existingEdit.originalY : line.bbox.y;
          const origW = (existingEdit && existingEdit.originalWidth !== undefined) ? existingEdit.originalWidth : line.bbox.width;
          const origH = (existingEdit && existingEdit.originalHeight !== undefined) ? existingEdit.originalHeight : line.bbox.height;

          const currentText = textSpan.innerText.trim() || line.text;

          const moveEventCustom = new CustomEvent('pdf-text-edited', {
            detail: {
              line: line,
              newText: currentText,
              domElement: target,
              scale: scale,
              x: newX,
              y: newY,
              originalX: origX,
              originalY: origY,
              originalWidth: origW,
              originalHeight: origH
            }
          });
          document.dispatchEvent(moveEventCustom);

          setTimeout(() => { isDragging = false; }, 80);
        }
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    };

    // Attach drag handler to dedicated drag handle pill
    dragHandle.addEventListener('mousedown', startDrag);

    // Also allow dragging by grabbing the box before typing
    target.addEventListener('mousedown', (e) => {
      if (e.target === dragHandle || dragHandle.contains(e.target)) return;
      if (textSpan.isContentEditable) return; // Allow normal text caret selection while typing
      startDrag(e);
    });

    // Enter text editing mode
    const enterEditMode = () => {
      textSpan.contentEditable = 'true';
      target.classList.add('editing');
      target.classList.add('selected-block');
      target.style.zIndex = '60';
      target.style.border = '2px solid #1a73e8';
      target.style.backgroundColor = '#ffffff';
      target.style.width = 'auto';
      target.style.minWidth = `${width}px`;
      target.style.color = color || '#111827';
      target.style.webkitTextFillColor = color || '#111827';
      textSpan.style.color = color || '#111827';
      textSpan.style.webkitTextFillColor = color || '#111827';
      target.style.fontSize = `${fontSize * scale}px`;
      target.style.fontFamily = (primaryFont.normalizedFamily || primaryFont.family || 'Helvetica') + ', Arial, sans-serif';
      target.style.fontWeight = primaryFont.bold ? 'bold' : 'normal';
      target.style.fontStyle = primaryFont.italic ? 'italic' : 'normal';
      target.style.padding = '0 2px';
      target.style.overflow = 'visible';
      target.style.outline = 'none';
      target.style.boxShadow = '0 2px 10px rgba(0,0,0,0.18)';

      textSpan.focus();

      // Auto-select text for easy typing
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(textSpan);
      selection.removeAllRanges();
      selection.addRange(range);

      if (this.setActiveText) {
        this.setActiveText({
          id: line.id,
          text: textSpan.innerText,
          fontSize: fontSize,
          fontFamily: primaryFont.normalizedFamily || primaryFont.family || 'Helvetica',
          bold: primaryFont.bold,
          italic: primaryFont.italic,
          color: color || '#111827',
          align: 'left'
        }, target, line);
      }
    };

    target.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isDragging) return;
      target.classList.add('selected-block');
      if (this.setActiveText) {
        this.setActiveText({
          id: line.id,
          text: textSpan.innerText,
          fontSize: fontSize,
          fontFamily: primaryFont.normalizedFamily || primaryFont.family || 'Helvetica',
          bold: primaryFont.bold,
          italic: primaryFont.italic,
          color: color || '#111827',
          align: 'left'
        }, target, line);
      }
      if (!textSpan.isContentEditable) {
        enterEditMode();
      }
    });

    target.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      enterEditMode();
    });

    target.addEventListener('input', () => {
      target.style.width = 'auto';
    });

    // Keyboard controls: Nudge position or commit
    target.addEventListener('keydown', (e) => {
      if (textSpan.isContentEditable) {
        if (e.key === 'Escape') {
          e.preventDefault();
          textSpan.innerText = isCommitted ? existingEdit.text : line.text;
          target.commitEdit();
        } else if (e.key === 'Enter') {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            target.commitEdit();
          }
          // Normal Enter & Shift+Enter cleanly insert a new line!
        }
        return;
      }

      // Nudge with Arrow keys when box is selected
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        let curLeft = parseFloat(target.style.left) || 0;
        let curTop = parseFloat(target.style.top) || 0;

        if (e.key === 'ArrowUp') curTop -= step;
        if (e.key === 'ArrowDown') curTop += step;
        if (e.key === 'ArrowLeft') curLeft -= step;
        if (e.key === 'ArrowRight') curLeft += step;

        target.style.left = `${curLeft}px`;
        target.style.top = `${curTop}px`;
        target.classList.add('committed-edit');
        target.style.backgroundColor = '#ffffff';
        target.style.color = color || '#111827';
        textSpan.style.color = color || '#111827';

        const newX = curLeft / scale;
        const newY = curTop / scale;
        const origX = (existingEdit && existingEdit.originalX !== undefined) ? existingEdit.originalX : line.bbox.x;
        const origY = (existingEdit && existingEdit.originalY !== undefined) ? existingEdit.originalY : line.bbox.y;

        const moveEventCustom = new CustomEvent('pdf-text-edited', {
          detail: {
            line: line,
            newText: textSpan.innerText.replace(/[\r\n]+/g, ' ').trim() || line.text,
            domElement: target,
            scale: scale,
            x: newX,
            y: newY,
            originalX: origX,
            originalY: origY,
            originalWidth: (existingEdit && existingEdit.originalWidth !== undefined) ? existingEdit.originalWidth : line.bbox.width,
            originalHeight: (existingEdit && existingEdit.originalHeight !== undefined) ? existingEdit.originalHeight : line.bbox.height
          }
        });
        document.dispatchEvent(moveEventCustom);
      }
    });

    // Method to commit edits
    target.commitEdit = () => {
      if (!textSpan.isContentEditable && !target.classList.contains('editing')) return;
      const rawText = textSpan.innerText || target.innerText || '';
      const cleanText = rawText.replace(/\u00A0/g, ' ').trim();
      textSpan.contentEditable = 'false';
      target.classList.remove('editing');

      const isTextDeleted = (cleanText === '');
      const hasChanged = isTextDeleted || (cleanText !== line.text);

      if (hasChanged) {
        target.classList.add('committed-edit');
        if (isTextDeleted) {
          target.classList.add('deleted-edit');
          target.style.border = '1px dashed rgba(239, 68, 68, 0.4)';
          textSpan.innerText = '';
          target.title = 'Teks dihapus (klik untuk menulis ulang)';
        } else {
          target.classList.remove('deleted-edit');
          target.style.border = '1px solid rgba(59, 130, 246, 0.6)';
          textSpan.innerText = cleanText;
          target.title = `Teks disunting: "${cleanText}"`;
        }

        // Always keep solid background to mask out the original text underneath!
        target.style.width = 'auto';
        target.style.minWidth = `${width}px`;
        target.style.backgroundColor = '#ffffff';
        target.style.color = color || '#111827';
        target.style.webkitTextFillColor = color || '#111827';
        textSpan.style.color = color || '#111827';
        textSpan.style.webkitTextFillColor = color || '#111827';
        target.style.fontSize = `${fontSize * scale}px`;
        target.style.overflow = 'visible';
        target.style.zIndex = '20';

        const currentX = (existingEdit && existingEdit.x !== undefined) ? existingEdit.x : (parseFloat(target.style.left) / scale);
        const currentY = (existingEdit && existingEdit.y !== undefined) ? existingEdit.y : (parseFloat(target.style.top) / scale);
        const origX = (existingEdit && existingEdit.originalX !== undefined) ? existingEdit.originalX : line.bbox.x;
        const origY = (existingEdit && existingEdit.originalY !== undefined) ? existingEdit.originalY : line.bbox.y;
        const origW = (existingEdit && existingEdit.originalWidth !== undefined) ? existingEdit.originalWidth : line.bbox.width;
        const origH = (existingEdit && existingEdit.originalHeight !== undefined) ? existingEdit.originalHeight : line.bbox.height;

        const event = new CustomEvent('pdf-text-edited', {
          detail: {
            line: line,
            newText: cleanText,
            deleted: isTextDeleted,
            domElement: target,
            scale: scale,
            x: currentX,
            y: currentY,
            originalX: origX,
            originalY: origY,
            originalWidth: origW,
            originalHeight: origH
          }
        });
        document.dispatchEvent(event);
      } else {
        target.classList.remove('committed-edit');
        target.classList.remove('deleted-edit');
        textSpan.innerText = line.text;
        target.style.border = '1px solid transparent';
        target.style.backgroundColor = 'transparent';
        target.style.color = 'transparent';
        target.style.webkitTextFillColor = 'transparent';
        textSpan.style.color = 'transparent';
        textSpan.style.webkitTextFillColor = 'transparent';
        target.style.fontSize = `${fontSize * scale}px`;
        target.style.overflow = 'hidden';
        target.style.zIndex = '10';
        target.style.boxShadow = 'none';
        target.title = `Click to edit: "${line.text}"`;
      }
    };
    textSpan.commitEdit = target.commitEdit;

    // Save on blur
    target.addEventListener('blur', () => {
      setTimeout(() => {
        if (!textSpan.isContentEditable && !target.classList.contains('editing')) return;

        const focused = document.activeElement;
        const inSidebar = focused && (
          focused.closest('#formatPane') || 
          focused.closest('.acrobat-tools-pane') || 
          focused.closest('.acrobat-format-pane')
        );
        if (inSidebar) return;

        target.commitEdit();
      }, 150);
    });

    this.container.appendChild(target);
  }
}

window.PDFTools = window.PDFTools || {};
window.PDFTools.TextEditEngine = TextEditEngine;
