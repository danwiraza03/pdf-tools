/**
 * PDF Tools — File List Component with SortableJS support
 */
window.PDFTools = window.PDFTools || {};

PDFTools.FileList = function (containerId, options) {
  options = options || {};
  const container = document.getElementById(containerId);
  let files = [];
  const onFilesChange = options.onFilesChange || function () {};
  let sortableInstance = null;

  function render() {
    if (!container) return;
    container.innerHTML = '';

    files.forEach((fileObj, index) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.setAttribute('data-id', fileObj.id);

      // Handle icon for sorting
      const handle = document.createElement('div');
      handle.className = 'file-item-handle';
      handle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';
      handle.title = 'Drag to reorder';
      handle.setAttribute('aria-label', 'Drag to reorder');

      // Preview box
      const preview = document.createElement('div');
      preview.className = 'file-item-preview';
      if (fileObj.canvas) {
        preview.appendChild(fileObj.canvas);
      } else if (fileObj.previewUrl) {
        const img = document.createElement('img');
        img.src = fileObj.previewUrl;
        preview.appendChild(img);
      } else {
        const icon = document.createElement('span');
        icon.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        preview.appendChild(icon);
      }

      // Info
      const info = document.createElement('div');
      info.className = 'file-item-info';

      const name = document.createElement('div');
      name.className = 'file-item-name';
      name.textContent = (fileObj.file && fileObj.file.name) || 'document.pdf';

      const meta = document.createElement('div');
      meta.className = 'file-item-meta';
      const fileSize = (fileObj.file && typeof fileObj.file.size === 'number') ? fileObj.file.size : 0;
      const sizeStr = (PDFTools.FileUtils && PDFTools.FileUtils.formatSize) ? PDFTools.FileUtils.formatSize(fileSize) : `${Math.round(fileSize / 1024)} KB`;
      const pagesLabel = (PDFTools.i18n && typeof PDFTools.i18n.t === 'function') ? PDFTools.i18n.t('file.pages') : 'pages';
      meta.textContent = fileObj.pageCount ? `${sizeStr} • ${fileObj.pageCount} ${pagesLabel}` : sizeStr;

      info.appendChild(name);
      info.appendChild(meta);

      // Remove Action
      const actions = document.createElement('div');
      actions.className = 'file-item-actions';

      const removeBtn = document.createElement('button');
      removeBtn.className = 'file-item-remove';
      removeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
      removeBtn.title = 'Remove file';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFile(fileObj.id);
      });

      actions.appendChild(removeBtn);

      item.appendChild(handle);
      item.appendChild(preview);
      item.appendChild(info);
      item.appendChild(actions);

      container.appendChild(item);
    });

    initSortable();
    onFilesChange(files);
  }

  function initSortable() {
    if (typeof Sortable !== 'undefined' && container && files.length > 1) {
      if (sortableInstance) sortableInstance.destroy();
      sortableInstance = new Sortable(container, {
        handle: '.file-item-handle',
        animation: 150,
        ghostClass: 'sortable-ghost',
        dragClass: 'sortable-drag',
        delay: 200,
        delayOnTouchOnly: true,
        touchStartThreshold: 8,
        onEnd: function () {
          const newOrder = Array.from(container.children).map(el => el.getAttribute('data-id'));
          files = newOrder.map(id => files.find(f => f.id === id)).filter(Boolean);
          onFilesChange(files);
        }
      });
    }
  }

  function addFiles(newFiles) {
    newFiles.forEach(file => {
      const fileId = PDFTools.FileUtils.uid();
      const canvas = document.createElement('canvas');

      const fileObj = {
        id: fileId,
        file: file,
        canvas: canvas,
        pageCount: null
      };

      files.push(fileObj);

      // Asynchronously render preview thumbnail
      if (PDFTools.FileUtils.isPDF(file)) {
        PDFTools.Preview.renderThumbnail(file, canvas, 0.2).then(res => {
          fileObj.pageCount = res.totalPages;
          render();
        }).catch(() => {
          render();
        });
      } else if (PDFTools.FileUtils.isImage(file)) {
        PDFTools.FileUtils.readAsDataURL(file).then(url => {
          fileObj.previewUrl = url;
          fileObj.canvas = null;
          render();
        });
      }
    });

    render();
  }

  function removeFile(id) {
    files = files.filter(f => f.id !== id);
    render();
  }

  function clear() {
    files = [];
    render();
  }

  function getFiles() {
    return files.map(f => f.file);
  }

  return {
    addFiles: addFiles,
    removeFile: removeFile,
    clear: clear,
    getFiles: getFiles,
    getCount: () => files.length
  };
};
