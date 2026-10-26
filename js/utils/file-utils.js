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

    const arrayBuffer = await this.readAsArrayBuffer(file);
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
      throw new Error('PDFTools.Protect.unlockPdf is required to decrypt protected PDF documents.');
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
      const err = new Error(`Password diperlukan untuk membuka PDF: ${fileName}`);
      err.code = 'PASSWORD_REQUIRED';
      err.fileName = fileName;
      throw err;
    }

    let unlockedBytes = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      let pass = await getPassword(fileName, attempt);
      if (pass === null || pass === undefined) {
        const err = new Error(`Pembukaan PDF dibatalkan oleh pengguna: ${fileName}`);
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
          const err = new Error(`Password salah (3 kali percobaan terlampaui): ${fileName}`);
          err.code = 'PASSWORD_INCORRECT';
          err.fileName = fileName;
          err.originalError = decryptErr;
          throw err;
        }
      }
    }

    if (!unlockedBytes) {
      const err = new Error(`Password salah untuk membuka PDF: ${fileName}`);
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
   * Ensures seamless main-thread execution on file:/// or worker fallback
   */
  initPdfJsWorker: function () {
    if (typeof pdfjsLib === 'undefined') return;
    if (typeof window.pdfjsWorker !== 'undefined') {
      // In-memory worker already available via script tag
      return;
    }
    try {
      if (window.location.protocol === 'file:') {
        // Under file:// protocol, Chromium disables external Web Workers due to null origin.
        // PDF.js safely falls back to fake worker in the main thread.
        return;
      }
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
