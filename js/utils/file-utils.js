const globalObj = typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis);
globalObj.PDFTools = globalObj.PDFTools || {};

const FileUtils = {
  /**
   * Safely loads and decrypts a PDF document client-side.
   * If protected, decrypts in-memory using unlockPdf and returns a pristine, unencrypted PDFDocument.
   *
   * @param {File|Blob|ArrayBuffer|Uint8Array|Object} file
   * @param {Object} [options={}]
   * @param {Function} [options.getPassword] - async (fileName, attempt) => password|null
   * @param {string} [options.fileName]
   * @param {boolean} [options.updateMetadata=true]
   * @returns {Promise<PDFDocument>}
   */
  loadPdfDecrypted: async function (file, options = {}) {
    const PDFLib = globalObj.PDFLib || (typeof require === 'function' ? require('../lib/pdf-lib.min.js') : null);
    if (!PDFLib || !PDFLib.PDFDocument) {
      throw new Error('PDF library is not loaded.');
    }
    const { PDFDocument } = PDFLib;

    const Protect = (globalObj.PDFTools && globalObj.PDFTools.Protect)
      || (typeof require === 'function' ? (function () {
        try { return require('../core/pdf-protect.js'); } catch (e) {
          try { return require('./js/core/pdf-protect.js'); } catch (e2) { return null; }
        }
      })() : null);

    const readFn = (this && typeof this.readAsArrayBuffer === 'function')
      ? this.readAsArrayBuffer.bind(this)
      : (FileUtils.readAsArrayBuffer
        ? FileUtils.readAsArrayBuffer.bind(FileUtils)
        : (globalObj.PDFTools && globalObj.PDFTools.FileUtils && globalObj.PDFTools.FileUtils.readAsArrayBuffer));
    const arrayBuffer = await readFn(file);
    const bytes = new Uint8Array(arrayBuffer);
    const fileName = (file && file.name) ? file.name : (options.fileName || 'Dokumen.pdf');
    const loadOptions = {
      updateMetadata: options.updateMetadata !== false
    };

    // Check if document has /Encrypt dictionary
    const isEncrypted = Protect && typeof Protect.hasEncryptDictionary === 'function'
      ? Protect.hasEncryptDictionary(bytes)
      : (function () {
          const p = [47, 69, 110, 99, 114, 121, 112, 116];
          let m = 0;
          for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === p[m]) {
              m++;
              if (m === p.length) return true;
            } else {
              m = bytes[i] === p[0] ? 1 : 0;
            }
          }
          return false;
        })();

    if (!isEncrypted) {
      return await PDFDocument.load(arrayBuffer, loadOptions);
    }

    if (!Protect || typeof Protect.unlockPdf !== 'function') {
      console.error('PDFTools.Protect.unlockPdf is required to decrypt protected PDF documents.');
      const isId = (globalObj.PDFTools && globalObj.PDFTools.i18n && globalObj.PDFTools.i18n.getCurrentLang && globalObj.PDFTools.i18n.getCurrentLang() === 'id');
      const userMsg = isId
        ? 'PDF terproteksi ini tidak bisa dibuka. Coba alat Unlock PDF.'
        : 'This protected PDF cannot be opened. Try the Unlock PDF tool.';
      const err = new Error(userMsg);
      err.code = 'PROTECT_MODULE_MISSING';
      err.fileName = fileName;
      throw err;
    }

    // Attempt 0: Try empty password (handles permissions-only encryption / empty user password)
    try {
      const unlockedBytes = await Protect.unlockPdf(arrayBuffer, '');
      return await PDFDocument.load(unlockedBytes, loadOptions);
    } catch (emptyErr) {
      // Document has a non-empty user password
    }

    // Resolve getPassword function (fallback to options.password or custom modal if in browser)
    let getPassword = options.getPassword;
    if (typeof getPassword !== 'function' && typeof options.password === 'string') {
      getPassword = () => options.password;
    }
    if (typeof getPassword !== 'function' && globalObj.PDFTools && globalObj.PDFTools.Modal && typeof globalObj.PDFTools.Modal.requestPassword === 'function') {
      getPassword = (fn, att) => globalObj.PDFTools.Modal.requestPassword(fn, att);
    }

    if (typeof getPassword !== 'function') {
      const isId = (globalObj.PDFTools && globalObj.PDFTools.i18n && globalObj.PDFTools.i18n.getCurrentLang && globalObj.PDFTools.i18n.getCurrentLang() === 'id');
      const userMsg = isId
        ? `Password diperlukan untuk membuka PDF: ${fileName}`
        : `Password is required to open PDF: ${fileName}`;
      const err = new Error(userMsg);
      err.code = 'PASSWORD_REQUIRED';
      err.fileName = fileName;
      throw err;
    }

    let unlockedBytes = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let pass = await getPassword(fileName, attempt);
      if (pass === null || pass === undefined) {
        const isId = (globalObj.PDFTools && globalObj.PDFTools.i18n && globalObj.PDFTools.i18n.getCurrentLang && globalObj.PDFTools.i18n.getCurrentLang() === 'id');
        const userMsg = isId
          ? `Pembukaan PDF dibatalkan oleh pengguna: ${fileName}`
          : `Opening PDF cancelled by user: ${fileName}`;
        const err = new Error(userMsg);
        err.code = 'PASSWORD_CANCELLED';
        err.fileName = fileName;
        throw err;
      }
      if (typeof pass !== 'string') {
        pass = String(pass);
      }
      try {
        unlockedBytes = await Protect.unlockPdf(arrayBuffer, pass);
        pass = null; // Transient in-memory only: clear immediately
        break;
      } catch (decryptErr) {
        pass = null; // Transient in-memory only: clear immediately
        if (attempt === 3) {
          const isId = (globalObj.PDFTools && globalObj.PDFTools.i18n && globalObj.PDFTools.i18n.getCurrentLang && globalObj.PDFTools.i18n.getCurrentLang() === 'id');
          const userMsg = isId
            ? `Password salah (3 kali percobaan terlampaui): ${fileName}`
            : `Incorrect password (3 attempts exceeded): ${fileName}`;
          const err = new Error(userMsg);
          err.code = 'PASSWORD_INCORRECT';
          err.fileName = fileName;
          err.originalError = decryptErr;
          throw err;
        }
      }
    }

    if (!unlockedBytes) {
      console.error(`Failed to unlock protected PDF: ${fileName}`);
      const isId = (globalObj.PDFTools && globalObj.PDFTools.i18n && globalObj.PDFTools.i18n.getCurrentLang && globalObj.PDFTools.i18n.getCurrentLang() === 'id');
      const userMsg = isId
        ? 'PDF terproteksi ini tidak bisa dibuka. Coba alat Unlock PDF.'
        : 'This protected PDF cannot be opened. Try the Unlock PDF tool.';
      const err = new Error(userMsg);
      err.code = 'PASSWORD_INCORRECT';
      err.fileName = fileName;
      throw err;
    }

    return await PDFDocument.load(unlockedBytes, loadOptions);
  },
  /**
   * Format bytes to human-readable string
   */
  formatSize: function (bytes) {
    if (!bytes || bytes === 0) return '0 B';
    var units = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i > 0 ? 1 : 0) + ' ' + units[i];
  },

  formatFileSize: function (bytes) {
    return this.formatSize(bytes);
  },

  /**
   * Convert Data URL to Uint8Array 100% offline without fetch()
   */
  dataUrlToUint8Array: function (dataUrl) {
    var parts = dataUrl.split(',');
    var base64 = parts.length > 1 ? parts[1] : parts[0];
    var binaryStr = atob(base64);
    var len = binaryStr.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  },

  dataUrlToArrayBuffer: function (dataUrl) {
    return this.dataUrlToUint8Array(dataUrl).buffer;
  },

  /**
   * Read file as ArrayBuffer
   */
  readAsArrayBuffer: function (file) {
    if (!file) return Promise.reject(new Error('No file provided to readAsArrayBuffer'));
    if (file && file.file && (file.file instanceof Blob || file.file instanceof File || file.file instanceof ArrayBuffer || file.file.buffer)) {
      file = file.file;
    }
    if (file instanceof ArrayBuffer) return Promise.resolve(file.slice(0));
    if (file && file.buffer instanceof ArrayBuffer) return Promise.resolve(file.buffer.slice(file.byteOffset || 0, (file.byteOffset || 0) + (file.byteLength || file.buffer.byteLength)));
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsArrayBuffer(file);
    });
  },

  /**
   * Read file as Data URL
   */
  readAsDataURL: function (file) {
    if (!file) return Promise.reject(new Error('No file provided to readAsDataURL'));
    if (file && file.file && (file.file instanceof Blob || file.file instanceof File)) {
      file = file.file;
    }
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(reader.result); };
      reader.onerror = function () { reject(reader.error); };
      reader.readAsDataURL(file);
    });
  },

  /**
   * Get file extension
   */
  getExtension: function (filename) {
    if (!filename || typeof filename !== 'string') return '';
    return filename.split('.').pop().toLowerCase();
  },

  /**
   * Check if file is PDF
   */
  isPDF: function (file) {
    if (!file) return false;
    const name = file.name || '';
    return file.type === 'application/pdf' || this.getExtension(name) === 'pdf';
  },

  /**
   * Check if file is an image
   */
  isImage: function (file) {
    if (!file) return false;
    const name = file.name || '';
    return (file.type && file.type.startsWith('image/')) || ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].indexOf(this.getExtension(name)) !== -1;
  },

  /**
   * Generate unique ID
   */
  uid: function () {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
  },

  /**
   * Universal PDF.js Worker Initializer (A2 Deduplication)
   * Ensures worker is configured for PDF.js
   */
  initPdfJsWorker: function () {
    if (typeof pdfjsLib === 'undefined') return;
    if (typeof window.pdfjsWorker !== 'undefined') {
      // In-memory worker already available via script tag
      return;
    }
    try {
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc || !pdfjsLib.GlobalWorkerOptions.workerSrc.includes('pdf.worker')) {
        const scriptTag = document.querySelector('script[src*="pdf.min.js"]') || document.querySelector('script[src*="pdf.js"]');
        if (scriptTag) {
          const src = scriptTag.getAttribute('src');
          pdfjsLib.GlobalWorkerOptions.workerSrc = src.replace(/pdf(\.min)?\.js/, 'pdf.worker$1.js');
        } else {
          const isSubPage = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
          pdfjsLib.GlobalWorkerOptions.workerSrc = isSubPage ? '../js/lib/pdf.worker.min.js' : 'js/lib/pdf.worker.min.js';
        }
      }
    } catch (e) {
      console.warn('PDF.js worker init notice:', e);
    }
  },

  /**
   * Aggressive Canvas Memory Release (A1 Memory Leak Prevention)
   */
  releaseCanvas: function (canvas) {
    if (!canvas) return;
    try {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      canvas.width = 0;
      canvas.height = 0;
      if (canvas.remove) canvas.remove();
    } catch (e) {}
  },

  /**
   * IndexedDB Cross-Page File Handoff (B1 Universal Dropzone)
   */
  setPendingFile: function (file) {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(); return; }
      try {
        const req = indexedDB.open('pdf_tools_handoff', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('handoff'); };
        req.onsuccess = function () {
          const db = req.result;
          const tx = db.transaction('handoff', 'readwrite');
          tx.objectStore('handoff').put(file, 'pending_file');
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { resolve(); };
        };
        req.onerror = function () { resolve(); };
      } catch (e) {
        resolve();
      }
    });
  },

  consumePendingFile: function () {
    return new Promise(function (resolve) {
      if (!window.indexedDB) { resolve(null); return; }
      try {
        const req = indexedDB.open('pdf_tools_handoff', 1);
        req.onupgradeneeded = function () { req.result.createObjectStore('handoff'); };
        req.onsuccess = function () {
          const db = req.result;
          const tx = db.transaction('handoff', 'readwrite');
          const store = tx.objectStore('handoff');
          const getReq = store.get('pending_file');
          getReq.onsuccess = function () {
            const file = getReq.result;
            if (file) {
              store.delete('pending_file');
            }
            resolve(file || null);
          };
          getReq.onerror = function () { resolve(null); };
        };
        req.onerror = function () { resolve(null); };
      } catch (e) {
        resolve(null);
      }
    });
  }
};

globalObj.PDFTools.FileUtils = FileUtils;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = FileUtils;
}

/**
 * Recent Files & Activity Store (B3 Feature)
 */
PDFTools.RecentFiles = {
  STORAGE_KEY: 'pdf_tools_recent_activity',
  MAX_ITEMS: 8,

  get: function () {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  add: function (fileName, fileSize, toolName, toolIcon) {
    if (!fileName) return;
    try {
      const list = this.get();
      const newItem = {
        id: Date.now().toString(36),
        name: fileName,
        size: typeof fileSize === 'number' ? PDFTools.FileUtils.formatSize(fileSize) : fileSize,
        tool: toolName || 'PDF Tool',
        icon: toolIcon || 'pdf',
        timestamp: Date.now(),
        dateStr: new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
      };

      // Filter out duplicate fileName within same tool
      const filtered = list.filter(item => !(item.name === fileName && item.tool === toolName));
      filtered.unshift(newItem);

      if (filtered.length > this.MAX_ITEMS) {
        filtered.pop();
      }

      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Recent files save notice:', e);
    }
  },

  clear: function () {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
    } catch (e) {}
  }
};

/**
 * Chained Actions: Seamless in-memory document pipeline across standalone tools
 */
PDFTools.ChainedActions = {
  render: function (target, options) {
    if (typeof document === 'undefined') return;
    const container = typeof target === 'string' ? document.querySelector(target) : target;
    if (!container) return;

    const existing = container.querySelector('.chained-actions-wrapper');
    if (existing) existing.remove();

    const currentTool = (options && options.currentTool) || '';
    const getFile = options && options.getFile;
    const baseFileName = (options && options.fileName) || 'document.pdf';

    const allActions = [
      {
        id: 'compress',
        href: 'compress.html',
        i18nKey: 'chained.compress',
        defaultLabel: 'Compress PDF',
        color: '#3B82F6',
        svg: '<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m8 17 4 4 4-4"/>'
      },
      {
        id: 'sign',
        href: 'sign.html',
        i18nKey: 'chained.sign',
        defaultLabel: 'Sign PDF',
        color: '#10B981',
        svg: '<path d="M20 19.5v.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8.5L20 7.5V12"/><path d="M14 2v6h6"/><path d="M12 18v-4"/><path d="m9 15 3-3 3 3"/>'
      },
      {
        id: 'protect',
        href: 'protect.html',
        i18nKey: 'chained.protect',
        defaultLabel: 'Protect PDF',
        color: '#EF4444',
        svg: '<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'
      },
      {
        id: 'watermark',
        href: 'watermark.html',
        i18nKey: 'chained.watermark',
        defaultLabel: 'Add Watermark',
        color: '#EC4899',
        svg: '<circle cx="12" cy="12" r="10"/><path d="M12 8v8"/><path d="M8 12h8"/>'
      },
      {
        id: 'flatten',
        href: 'flatten.html',
        i18nKey: 'chained.flatten',
        defaultLabel: 'Flatten PDF',
        color: '#6366F1',
        svg: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/>'
      }
    ];

    const filtered = allActions.filter(a => a.id !== currentTool).slice(0, 4);

    const wrapper = document.createElement('div');
    wrapper.className = 'chained-actions-wrapper';
    wrapper.style.cssText = 'margin-top: 24px; padding: 18px 20px; border-radius: var(--radius-lg, 14px); background: var(--bg-card); border: 1px solid var(--border-color); text-align: left; box-shadow: var(--shadow-sm, 0 2px 8px rgba(0,0,0,0.03));';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;';
    
    const titleText = (PDFTools.i18n && PDFTools.i18n.t('chained.title')) || 'Continue with this document in:';
    const subText = (PDFTools.i18n && PDFTools.i18n.t('chained.subtitle')) || 'Zero re-upload • Kept in browser memory';

    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary-color);"><polyline points="13 17 18 12 13 7"/><polyline points="6 17 11 12 6 7"/></svg>
        <span data-i18n="chained.title">${titleText}</span>
      </div>
      <span style="font-size: 0.78rem; color: var(--text-muted);" data-i18n="chained.subtitle">${subText}</span>
    `;
    wrapper.appendChild(header);

    const buttonsContainer = document.createElement('div');
    buttonsContainer.style.cssText = 'display: flex; gap: 10px; flex-wrap: wrap;';

    filtered.forEach(action => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary btn-sm';
      btn.style.cssText = 'display: inline-flex; align-items: center; gap: 6px; font-weight: 600; padding: 8px 14px;';
      const labelText = (PDFTools.i18n && PDFTools.i18n.t(action.i18nKey)) || action.defaultLabel;
      btn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="color: ${action.color};">
          ${action.svg}
        </svg>
        <span data-i18n="${action.i18nKey}">${labelText}</span>
      `;

      btn.addEventListener('click', async () => {
        try {
          btn.disabled = true;
          let file = typeof getFile === 'function' ? await getFile() : null;
          if (!file) {
            btn.disabled = false;
            return;
          }
          if (file instanceof Uint8Array || file instanceof ArrayBuffer) {
            file = new Blob([file], { type: 'application/pdf' });
          }
          if (file instanceof Blob && !(file instanceof File)) {
            file = new File([file], baseFileName, { type: 'application/pdf' });
          }
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            await PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = action.href;
        } catch (err) {
          console.error('Failed to handoff file:', err);
          btn.disabled = false;
        }
      });

      buttonsContainer.appendChild(btn);
    });

    wrapper.appendChild(buttonsContainer);
    container.appendChild(wrapper);
  }
};
