/**
 * PDF Tools — Unified Page Drag & Drop Component
 * 100% Client-Side, Zero Server Transfer, Zero Emojis.
 */
(function () {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  // Standard inline SVG (viewBox="0 0 24 24", stroke="currentColor", 0 emoji)
  const DROP_ICON_SVG = '<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg>';

  function isExternalFileDrag(e) {
    if (!e || !e.dataTransfer) return false;
    const types = Array.from(e.dataTransfer.types || []);
    return types.includes('Files');
  }

  function matchesAccept(file, acceptStr) {
    if (!acceptStr || acceptStr === '*' || acceptStr === '*/*') return true;
    const parts = acceptStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    const fileName = (file.name || '').toLowerCase();
    const fileType = (file.type || '').toLowerCase();

    return parts.some(part => {
      if (part.startsWith('.')) {
        return fileName.endsWith(part);
      }
      if (part.endsWith('/*')) {
        const mainType = part.replace('/*', '');
        return fileType.startsWith(mainType + '/');
      }
      return fileType === part;
    });
  }

  function getOrCreateOverlay(multiple) {
    let overlay = document.getElementById('pageDragOverlay') || document.getElementById('mergeDragOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'pageDragOverlay';
      overlay.className = 'page-drag-overlay merge-drag-overlay';
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');

      const card = document.createElement('div');
      card.className = 'page-drag-overlay-card merge-drag-overlay-card';

      const iconEl = document.createElement('div');
      iconEl.className = 'page-drag-overlay-icon merge-drag-overlay-icon';
      iconEl.innerHTML = DROP_ICON_SVG;

      const titleEl = document.createElement('div');
      titleEl.className = 'page-drag-overlay-title merge-drag-overlay-title';

      const subtitleEl = document.createElement('div');
      subtitleEl.className = 'page-drag-overlay-subtitle merge-drag-overlay-subtitle';

      card.appendChild(iconEl);
      card.appendChild(titleEl);
      card.appendChild(subtitleEl);
      overlay.appendChild(card);
      document.body.appendChild(overlay);
    } else {
      if (!overlay.classList.contains('page-drag-overlay')) {
        overlay.classList.add('page-drag-overlay');
      }
      if (!overlay.classList.contains('merge-drag-overlay')) {
        overlay.classList.add('merge-drag-overlay');
      }
    }

    updateOverlayText(overlay, multiple);
    return overlay;
  }

  function updateOverlayText(overlay, multiple) {
    const titleEl = overlay.querySelector('.page-drag-overlay-title, .merge-drag-overlay-title');
    const subtitleEl = overlay.querySelector('.page-drag-overlay-subtitle, .merge-drag-overlay-subtitle');

    if (multiple) {
      if (titleEl) {
        titleEl.textContent = (PDFTools.i18n && PDFTools.i18n.t('page_drop.drop_add_title')) ||
          'Drop files here to add';
      }
      if (subtitleEl) {
        subtitleEl.textContent = (PDFTools.i18n && PDFTools.i18n.t('page_drop.drop_add_desc')) ||
          'Seret berkas ke halaman ini untuk menambah';
        subtitleEl.style.display = '';
      }
    } else {
      if (titleEl) {
        titleEl.textContent = (PDFTools.i18n && PDFTools.i18n.t('page_drop.drop_replace_title')) ||
          'Drop file here to replace current file';
      }
      if (subtitleEl) {
        subtitleEl.textContent = '';
        subtitleEl.style.display = 'none';
      }
    }
  }

  const PageDrop = {
    attach: function (options) {
      options = options || {};
      const accept = options.accept || '.pdf';
      const multiple = Boolean(options.multiple);
      const onFiles = typeof options.onFiles === 'function' ? options.onFiles : function () {};
      const hasUnsavedWork = typeof options.hasUnsavedWork === 'function' ? options.hasUnsavedWork : function () { return false; };
      const enabledFn = typeof options.enabled === 'function' ? options.enabled : null;

      const overlay = getOrCreateOverlay(multiple);
      let dragCounter = 0;

      function isPageReady() {
        if (enabledFn) {
          try { return Boolean(enabledFn()); } catch (err) { return false; }
        }
        // Auto-detect if workspace or organizer is active
        const workspace = document.getElementById('workspaceState') ||
                          document.getElementById('organizerArea') ||
                          document.getElementById('fileQueueList');
        if (workspace && workspace.style.display !== 'none') return true;

        const fileList = document.getElementById('fileList');
        if (fileList && fileList.style.display !== 'none' && fileList.children.length > 0) return true;

        const pageGrid = document.getElementById('pageGrid');
        if (pageGrid && pageGrid.style.display !== 'none' && pageGrid.children.length > 0) return true;

        const dropzone = document.getElementById('dropzone') ||
                         document.getElementById('uploadState') ||
                         document.getElementById('queueEmptyArea');
        if (dropzone && dropzone.style.display === 'none') return true;

        return false;
      }

      function onDragEnter(e) {
        if (!isExternalFileDrag(e)) return;
        if (!isPageReady()) return;
        e.preventDefault();
        dragCounter++;
        updateOverlayText(overlay, multiple);
        overlay.style.display = 'flex';
      }

      function onDragOver(e) {
        if (!isExternalFileDrag(e)) return;
        if (!isPageReady()) return;
        e.preventDefault();
        if (e.dataTransfer) {
          e.dataTransfer.dropEffect = 'copy';
        }
        overlay.style.display = 'flex';
      }

      function onDragLeave(e) {
        if (!isExternalFileDrag(e)) return;
        e.preventDefault();
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          overlay.style.display = 'none';
        }
      }

      async function onDrop(e) {
        if (!isExternalFileDrag(e)) return;
        if (!isPageReady()) {
          // Allow event to reach native dropzone if initial upload state
          dragCounter = 0;
          overlay.style.display = 'none';
          return;
        }

        e.preventDefault();
        dragCounter = 0;
        overlay.style.display = 'none';

        const droppedFiles = Array.from((e.dataTransfer && e.dataTransfer.files) || []);
        if (droppedFiles.length === 0) return;

        const validFiles = droppedFiles.filter(f => matchesAccept(f, accept));
        const unsupportedCount = droppedFiles.length - validFiles.length;

        if (unsupportedCount > 0) {
          const tmpl = (PDFTools.i18n && PDFTools.i18n.t('page_drop.unsupported_skipped')) ||
                       '{n} berkas tidak didukung dilewati';
          if (PDFTools.Toast) {
            PDFTools.Toast.warning(tmpl.replace('{n}', String(unsupportedCount)));
          }
        }

        if (validFiles.length === 0) return;

        if (multiple) {
          await onFiles(validFiles);
        } else {
          const chosenFile = validFiles[0];
          if (validFiles.length > 1) {
            const notice = (PDFTools.i18n && PDFTools.i18n.t('page_drop.single_file_notice')) ||
                           'Alat ini memproses satu berkas; berkas pertama dipakai';
            if (PDFTools.Toast) {
              PDFTools.Toast.info(notice);
            }
          }

          if (hasUnsavedWork()) {
            if (PDFTools.Modal && PDFTools.Modal.confirm) {
              const title = (PDFTools.i18n && PDFTools.i18n.t('page_drop.confirm_replace_title')) || 'Ganti Berkas Saat Ini?';
              const msg = (PDFTools.i18n && PDFTools.i18n.t('page_drop.confirm_replace_msg')) || 'Anda memiliki perubahan yang belum diunduh. Yakin ingin mengganti berkas saat ini dengan yang baru?';
              const confirmBtn = (PDFTools.i18n && PDFTools.i18n.t('page_drop.confirm_replace_btn')) || 'Ganti';
              const cancelBtn = (PDFTools.i18n && PDFTools.i18n.t('page_drop.confirm_cancel_btn')) || 'Batal';

              const confirmed = await PDFTools.Modal.confirm(msg, {
                title: title,
                confirmText: confirmBtn,
                cancelText: cancelBtn,
                isDanger: true
              });
              if (!confirmed) {
                return;
              }
            }
          }

          await onFiles([chosenFile]);
        }
      }

      window.addEventListener('dragenter', onDragEnter);
      window.addEventListener('dragover', onDragOver);
      window.addEventListener('dragleave', onDragLeave);
      window.addEventListener('drop', onDrop);

      return {
        overlayEl: overlay,
        detach: function () {
          window.removeEventListener('dragenter', onDragEnter);
          window.removeEventListener('dragover', onDragOver);
          window.removeEventListener('dragleave', onDragLeave);
          window.removeEventListener('drop', onDrop);
          if (overlay && overlay.parentNode) {
            overlay.parentNode.removeChild(overlay);
          }
        }
      };
    }
  };

  PDFTools.PageDrop = PageDrop;
})();

