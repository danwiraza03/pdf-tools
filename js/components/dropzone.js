/**
 * PDF Tools — Dropzone Component
 * Reusable, robust drag & drop file upload with window drag protection
 */
window.PDFTools = window.PDFTools || {};

// Prevent window default drag/drop behavior (which navigates away from the app)
if (!window._pdfToolsWindowDragGuarded) {
  window._pdfToolsWindowDragGuarded = true;
  window.addEventListener('dragover', function (e) {
    e.preventDefault();
  }, false);
  window.addEventListener('drop', function (e) {
    e.preventDefault();
  }, false);
}

PDFTools.Dropzone = function (elementId, options) {
  options = options || {};
  var accept = options.accept || '.pdf';
  var multiple = options.multiple !== false;
  var onFiles = options.onFiles || function () {};
  var dropzoneEl = document.getElementById(elementId);
  if (!dropzoneEl) return;

  // Accessibility: ensure dropzone is keyboard-focusable
  if (!dropzoneEl.getAttribute('role')) dropzoneEl.setAttribute('role', 'button');
  if (!dropzoneEl.getAttribute('tabindex')) dropzoneEl.setAttribute('tabindex', '0');
  if (!dropzoneEl.getAttribute('aria-label')) dropzoneEl.setAttribute('aria-label', 'Click or drop files here to upload');

  var inputEl = dropzoneEl.querySelector('.dropzone-input') || createInput();

  function createInput() {
    var input = document.createElement('input');
    input.type = 'file';
    input.className = 'dropzone-input';
    input.accept = accept;
    input.multiple = multiple;
    input.style.display = 'none';
    dropzoneEl.appendChild(input);
    return input;
  }

  // Click to browse
  dropzoneEl.addEventListener('click', function (e) {
    if (e.target.closest('.file-item') || e.target.closest('.add-more-btn') || e.target.closest('button')) return;
    inputEl.click();
  });

  // Keyboard: Enter or Space to open file picker
  dropzoneEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      inputEl.click();
    }
  });

  // File size warning helper
  function warnLargeFiles(files) {
    var SIZE_WARN = 100 * 1024 * 1024; // 100MB
    files.forEach(function (f) {
      if (f.size > SIZE_WARN && window.PDFTools && PDFTools.Toast) {
        var msg = (PDFTools.i18n && PDFTools.i18n.t('error.file_too_large')) || ('Warning: ' + f.name + ' is very large (' + Math.round(f.size / 1024 / 1024) + 'MB)');
        PDFTools.Toast.info(msg);
      }
    });
  }

  inputEl.addEventListener('change', function () {
    if (inputEl.files && inputEl.files.length > 0) {
      var files = Array.from(inputEl.files);
      warnLargeFiles(files);
      onFiles(files);
      inputEl.value = '';
    }
  });

  // Robust Drag & Drop with drag counter to prevent child flicker
  var dragCounter = 0;

  dropzoneEl.addEventListener('dragenter', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    dropzoneEl.classList.add('drag-over');
  });

  dropzoneEl.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    dropzoneEl.classList.add('drag-over');
  });

  dropzoneEl.addEventListener('dragleave', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0;
      dropzoneEl.classList.remove('drag-over');
    }
  });

  dropzoneEl.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;
    dropzoneEl.classList.remove('drag-over');

    var dt = e.dataTransfer;
    if (!dt) return;

    var rawFiles = [];
    if (dt.files && dt.files.length > 0) {
      rawFiles = Array.from(dt.files);
    } else if (dt.items && dt.items.length > 0) {
      for (var i = 0; i < dt.items.length; i++) {
        if (dt.items[i].kind === 'file') {
          var f = dt.items[i].getAsFile();
          if (f) rawFiles.push(f);
        }
      }
    }

    if (rawFiles.length === 0) return;

    if (!multiple && rawFiles.length > 1) {
      rawFiles = [rawFiles[0]];
    }

    // Filter by accept type
    var validFiles = rawFiles;
    if (accept && accept !== '*') {
      var exts = accept.split(',').map(function (s) { return s.trim().toLowerCase(); });
      validFiles = rawFiles.filter(function (f) {
        var nameExt = f.name ? ('.' + f.name.split('.').pop().toLowerCase()) : '';
        var mime = (f.type || '').toLowerCase();

        return exts.some(function (a) {
          if (a.startsWith('.')) return nameExt === a;
          if (a.includes('*')) return mime.startsWith(a.replace('*', ''));
          return mime === a;
        });
      });
    }

    if (validFiles.length > 0) {
      warnLargeFiles(validFiles);
      onFiles(validFiles);
    } else if (rawFiles.length > 0 && window.PDFTools && PDFTools.Toast) {
      var errMsg = (PDFTools.i18n && PDFTools.i18n.t('error.unsupported_format')) || ('Please drop files matching: ' + accept);
      PDFTools.Toast.error(errMsg);
    }
  });

  // Public API
  return {
    open: function () { inputEl.click(); },
    setAccept: function (a) { accept = a; inputEl.accept = a; },
    setMultiple: function (m) { multiple = Boolean(m); inputEl.multiple = Boolean(m); }
  };
};
