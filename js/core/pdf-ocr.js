/**
 * PDF Tools — Offline OCR (Optical Character Recognition) Core Logic
 * Powered by Tesseract.js (WebAssembly & Local Neural Net Models)
 * 
 * Features:
 * - 100% Offline client-side OCR
 * - Multilingual support: Bahasa Indonesia (ind), English (eng), or combined (ind+eng)
 * - Real-time word & line bounding box recognition
 * - Searchable PDF Generator (Invisible selectable text layer over scans)
 * - Plain Text & Markdown exporter with confidence scoring
 */
window.PDFTools = window.PDFTools || {};

PDFTools.OCR = (function () {
  let activeWorker = null;
  let currentLang = null;

  /**
   * Feature-detect WebAssembly SIMD support in the client browser
   * @returns {boolean}
   */
  function supportsSimd() {
    try {
      if (typeof WebAssembly !== 'undefined' && typeof WebAssembly.validate === 'function') {
        return WebAssembly.validate(new Uint8Array([
          0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123,
          3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0, 253, 15, 253, 98, 11
        ]));
      }
    } catch (e) {}
    return false;
  }

  /**
   * Get optimal Tesseract WASM core filename
   */
  function getCoreFilename() {
    return supportsSimd() ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
  }

  /**
   * Get base absolute URL for local Tesseract assets
   */
  function getTesseractBasePath() {
    const isSubPage = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
    const relPath = isSubPage ? '../js/lib/tesseract/' : 'js/lib/tesseract/';
    try {
      return new URL(relPath, window.location.href).href;
    } catch (e) {
      return relPath;
    }
  }

  /**
   * Helper to convert Base64 string to Uint8Array
   */
  function base64ToUint8Array(base64) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }

  /**
   * Create an offline inline Web Worker using embedded bundle & language data
   * @param {string} lang - 'ind' | 'eng' | 'ind+eng'
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Worker wrapper
   */
  async function createOfflineWorker(lang, onProgress) {
    const blob = new Blob([window.__TESSERACT_WORKER_CODE__], { type: 'application/javascript' });
    const blobUrl = URL.createObjectURL(blob);
    const rawWorker = new Worker(blobUrl);
    let jobCounter = 0;
    const activeListeners = new Map();

    rawWorker.onerror = function (e) {
      const errMsg = e && (e.message || (e.filename ? `${e.message || 'Worker runtime error'} (${e.filename}:${e.lineno || 0})` : String(e)));
      console.error('[OCR Engine] Offline Web Worker raw error:', e);
      for (const [jobId, listener] of activeListeners.entries()) {
        listener.reject(new Error(`Worker startup/execution failed: ${errMsg || 'Unknown Worker Error'}`));
      }
      activeListeners.clear();
    };

    rawWorker.onmessage = function (e) {
      const msg = e.data;
      if (!msg) return;
      if (msg.status === 'progress' && typeof onProgress === 'function' && msg.data) {
        const pct = Math.round((msg.data.progress || 0) * 100);
        const text = msg.data.status === 'recognizing text'
          ? `Recognizing text (${pct}%)...`
          : `${msg.data.status}...`;
        onProgress(pct, text);
      } else if (msg.jobId && activeListeners.has(msg.jobId)) {
        const { resolve, reject } = activeListeners.get(msg.jobId);
        if (msg.status === 'resolve') {
          activeListeners.delete(msg.jobId);
          resolve(msg.data);
        } else if (msg.status === 'reject') {
          activeListeners.delete(msg.jobId);
          reject(new Error(msg.data || 'OCR Job Failed'));
        }
      }
    };

    function sendJob(action, payload, timeoutMs = 0) {
      return new Promise((resolve, reject) => {
        const jobId = 'Job-0-' + (++jobCounter);
        let timer = null;
        if (timeoutMs > 0) {
          timer = setTimeout(() => {
            activeListeners.delete(jobId);
            reject(new Error(`Tesseract offline worker timeout (${timeoutMs / 1000}s) during action '${action}'`));
          }, timeoutMs);
        }
        activeListeners.set(jobId, {
          resolve: (val) => {
            if (timer) clearTimeout(timer);
            resolve(val);
          },
          reject: (err) => {
            if (timer) clearTimeout(timer);
            reject(err);
          }
        });
        rawWorker.postMessage({
          workerId: 'Worker-0',
          jobId: jobId,
          action: action,
          payload: payload || {}
        });
      });
    }

    const optimalCore = getCoreFilename();
    const hasSimd = supportsSimd();
    console.log(`[OCR Engine] Initializing WASM core: ${optimalCore} (SIMD: ${hasSimd ? 'YES' : 'NO'})`);

    if (typeof onProgress === 'function') onProgress(5, `Initializing local OCR Core (${hasSimd ? 'SIMD' : 'Standard'})...`);
    await sendJob('load', {
      options: {
        lstmOnly: true,
        corePath: optimalCore,
        logging: false
      }
    }, 30000);

    if (typeof onProgress === 'function') onProgress(15, `Loading neural language models (${lang})...`);
    const langList = lang.includes('+') ? lang.split('+') : [lang];
    const langPayloads = [];

    for (const l of langList) {
      let dataBytes = null;
      if (l === 'ind' && window.__TESSDATA_IND__) {
        dataBytes = base64ToUint8Array(window.__TESSDATA_IND__);
      } else if (l === 'eng' && window.__TESSDATA_ENG__) {
        dataBytes = base64ToUint8Array(window.__TESSDATA_ENG__);
      }
      if (dataBytes) {
        langPayloads.push({ code: l, data: dataBytes });
      }
    }

    if (langPayloads.length > 0) {
      await sendJob('loadLanguage', {
        langs: langPayloads,
        options: {
          langPath: '',
          dataPath: '',
          cachePath: '',
          cacheMethod: 'none',
          gzip: true,
          lstmOnly: true
        }
      }, 30000);
    }

    if (typeof onProgress === 'function') onProgress(25, `Configuring OCR engine...`);
    await sendJob('initialize', {
      langs: lang,
      oem: 1,
      config: {}
    }, 30000);

    return {
      async recognize(imageSource, options, output) {
        options = options || {};
        output = output || { text: true, blocks: true, hocr: true };

        let imgBytes = null;
        if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
          try {
            const dataUrl = imageSource.toDataURL('image/png');
            const binStr = atob(dataUrl.split(',')[1]);
            imgBytes = new Uint8Array(binStr.length);
            for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);
          } catch (e) {
            const blob = await new Promise(res => imageSource.toBlob(res, 'image/png'));
            const arrayBuf = await blob.arrayBuffer();
            imgBytes = new Uint8Array(arrayBuf.slice(0));
          }
        } else if (typeof OffscreenCanvas !== 'undefined' && imageSource instanceof OffscreenCanvas) {
          const blob = await imageSource.convertToBlob({ type: 'image/png' });
          const arrayBuf = await blob.arrayBuffer();
          imgBytes = new Uint8Array(arrayBuf.slice(0));
        } else if (typeof HTMLImageElement !== 'undefined' && imageSource instanceof HTMLImageElement) {
          const c = document.createElement('canvas');
          c.width = imageSource.naturalWidth || imageSource.width;
          c.height = imageSource.naturalHeight || imageSource.height;
          const ctx = c.getContext('2d');
          ctx.drawImage(imageSource, 0, 0);
          const dataUrl = c.toDataURL('image/png');
          const binStr = atob(dataUrl.split(',')[1]);
          imgBytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);
        } else if ((typeof Blob !== 'undefined' && imageSource instanceof Blob) || (typeof File !== 'undefined' && imageSource instanceof File)) {
          const arrayBuf = await imageSource.arrayBuffer();
          imgBytes = new Uint8Array(arrayBuf.slice(0));
        } else if (imageSource instanceof Uint8Array) {
          imgBytes = imageSource.slice(0);
        } else if (imageSource instanceof ArrayBuffer) {
          imgBytes = new Uint8Array(imageSource.slice(0));
        } else if (typeof imageSource === 'string') {
          const b64 = imageSource.includes(',') ? imageSource.split(',')[1] : imageSource;
          const binStr = atob(b64);
          imgBytes = new Uint8Array(binStr.length);
          for (let i = 0; i < binStr.length; i++) imgBytes[i] = binStr.charCodeAt(i);
        }

        const rawData = await sendJob('recognize', {
          image: imgBytes,
          options: options,
          output: output
        });

        const resultObj = Object.assign({ data: rawData }, rawData);
        return resultObj;
      },
      async terminate() {
        try {
          await sendJob('terminate', {});
        } catch (e) {}
        try {
          rawWorker.terminate();
        } catch (e) {}
        URL.revokeObjectURL(blobUrl);
      }
    };
  }

  /**
   * Initialize or retrieve local Tesseract worker
   * @param {string} lang - 'ind' | 'eng' | 'ind+eng'
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>}
   */
  async function getWorker(lang, onProgress) {
    lang = lang || 'ind';

    // Reuse existing worker if language matches
    if (activeWorker && currentLang === lang) {
      return activeWorker;
    }

    // Clean up any previous worker
    if (activeWorker) {
      try {
        await activeWorker.terminate();
      } catch (e) {
        console.warn('Worker termination cleanup error:', e);
      }
      activeWorker = null;
    }

    let worker = null;

    let firstPathError = null;

    // 1. First priority: Offline Bundle Engine (works 100% on file:/// and offline)
    if (typeof window !== 'undefined' && window.__TESSERACT_WORKER_CODE__) {
      try {
        worker = await createOfflineWorker(lang, onProgress);
        activeWorker = worker;
        currentLang = lang;
        return worker;
      } catch (offlineErr) {
        firstPathError = offlineErr;
        console.warn('Offline worker bundle initialization notice:', offlineErr);
      }
    } else {
      firstPathError = new Error('Bundel OCR offline (window.__TESSERACT_WORKER_CODE__) belum dimuat atau tidak tersedia');
    }

    // 2. Second priority: Standard Tesseract.js instance with local paths
    const basePath = getTesseractBasePath();
    const workerUrl = new URL('worker.min.js', basePath).href;
    const coreUrl = new URL(getCoreFilename(), basePath).href;
    const langUrl = new URL('lang-data/', basePath).href;

    const primaryOptions = {
      workerPath: workerUrl,
      corePath: coreUrl,
      langPath: langUrl,
      gzip: true,
      logger: m => {
        if (typeof onProgress === 'function' && m.status) {
          const statusText = m.status === 'recognizing text'
            ? `Recognizing text (${Math.round((m.progress || 0) * 100)}%)...`
            : `${m.status}...`;
          onProgress(Math.round((m.progress || 0) * 100), statusText);
        }
      }
    };

    try {
      worker = await Tesseract.createWorker(lang, 1, primaryOptions);
    } catch (primaryErr) {
      console.warn('Local OCR initialization notice:', primaryErr);
      try {
        const altOptions = Object.assign({}, primaryOptions, { gzip: false });
        worker = await Tesseract.createWorker(lang, 1, altOptions);
      } catch (secErr) {
        console.error('Failed to load local offline OCR worker (secondary path):', secErr);
        if (firstPathError) {
          console.error('Root cause from primary offline path (createOfflineWorker):', firstPathError);
        }

        const isIndonesian = typeof window !== 'undefined' && window.PDFTools?.i18n?.currentLang === 'id';
        const isFileProtocol = typeof window !== 'undefined' && window.location.protocol === 'file:';

        const firstCauseText = firstPathError
          ? (firstPathError.message || String(firstPathError))
          : 'Bundel offline tidak tersedia';

        let errorMsg;
        if (isIndonesian) {
          errorMsg = `Gagal memuat modul OCR offline lokal. Jalur utama offline gagal: "${firstCauseText}".`;
          if (isFileProtocol) {
            errorMsg += ' Jika membuka via file:///, jalankan aplikasi melalui server lokal portabel (klik ganda "Jalankan_PDF_Tools.bat" atau "Buka_Aplikasi.bat") agar fitur OCR dapat beroperasi dengan izin peramban penuh.';
          } else {
            errorMsg += ' Pastikan file model bahasa dan runtime WASM di folder js/lib/tesseract/ tersedia.';
          }
        } else {
          errorMsg = `Failed to load local offline OCR module. Primary offline path failed: "${firstCauseText}".`;
          if (isFileProtocol) {
            errorMsg += ' If accessing via file:///, please run the application through the portable local server (double-click "Jalankan_PDF_Tools.bat" or run "node server.js") to grant full browser worker permissions.';
          } else {
            errorMsg += ' Please ensure language model and WASM runtime files in js/lib/tesseract/ are available.';
          }
        }

        if (typeof window !== 'undefined' && window.PDFTools?.Toast?.error) {
          window.PDFTools.Toast.error(errorMsg, 6000);
        }
        throw new Error(errorMsg);
      }
    }

    activeWorker = worker;
    currentLang = lang;
    return worker;
  }

  /**
   * Calculate optimal binarization threshold using Otsu's method
   * Maximizes inter-class variance between background paper and foreground text
   * @param {Uint32Array} histogram - 256-bin grayscale intensity distribution
   * @param {number} totalPixels 
   * @returns {number} optimal threshold (0-255)
   */
  function calculateOtsuThreshold(histogram, totalPixels) {
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }

    let sumB = 0;
    let wB = 0;
    let wF = 0;
    let maxVariance = 0;
    let threshold = 128;

    for (let t = 0; t < 256; t++) {
      wB += histogram[t];
      if (wB === 0) continue;
      wF = totalPixels - wB;
      if (wF === 0) break;

      sumB += t * histogram[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;

      const betweenVariance = wB * wF * (mB - mF) * (mB - mF);
      if (betweenVariance > maxVariance) {
        maxVariance = betweenVariance;
        threshold = t;
      }
    }

    return threshold;
  }

  /**
   * Preprocess canvas to enhance OCR accuracy (Otsu adaptive binarization & document filtering)
   * @param {HTMLCanvasElement} canvas 
   * @param {'auto'|'doc'|'clean'|'none'} mode 
   * @returns {HTMLCanvasElement}
   */
  function preprocessCanvasForOcr(canvas, mode) {
    mode = mode || 'auto';
    if (mode === 'none') return canvas;

    const ctx = canvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    const totalPixels = canvas.width * canvas.height;
    const histogram = new Uint32Array(256);

    // Pass 1: Compute custom grayscale luminance tailored for document types
    const grays = new Uint8Array(totalPixels);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      let gray;
      if (mode === 'doc') {
        // Special weighting for colored official documents (KTP blue background, Akta/Ijazah yellow parchment)
        // Downweighting blue suppresses background noise from Indonesian e-KTP while emphasizing black printed text
        gray = Math.round((r * 0.45) + (g * 0.45) + (b * 0.10));
      } else {
        // Standard Rec. 601 luminance
        gray = Math.round((r * 0.299) + (g * 0.587) + (b * 0.114));
      }

      grays[p] = gray;
      histogram[gray]++;
    }

    if (mode === 'clean') {
      // High-contrast clean scan mode (sharpen text, bleach background)
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const g = grays[p];
        const v = g > 185 ? 255 : (g < 135 ? Math.max(0, Math.round(g * 0.45)) : Math.round(((g - 135) / 50) * 255));
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
    } else {
      // Calculate Otsu optimal threshold
      let threshold = calculateOtsuThreshold(histogram, totalPixels);

      // Safe bounds according to document profile
      if (mode === 'doc') {
        // Slightly bias to keep thin text strokes connected against noisy backgrounds
        threshold = Math.min(165, Math.max(105, threshold + 8));
      } else {
        threshold = Math.min(175, Math.max(85, threshold));
      }

      // Apply adaptive binarization
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const v = grays[p] > threshold ? 255 : 0;
        data[i] = v;
        data[i + 1] = v;
        data[i + 2] = v;
      }
    }

    ctx.putImageData(imgData, 0, 0);
    return canvas;
  }

  /**
   * Automatically detect and correct skew angle of a scanned document
   * Uses projection profile analysis on horizontal slices
   * @param {HTMLCanvasElement} canvas
   * @returns {number} detected skew angle in degrees
   */
  function autoDeskewCanvas(canvas) {
    if (!canvas || canvas.width < 50 || canvas.height < 50) return 0;

    const targetWidth = 200;
    const scale = targetWidth / canvas.width;
    const thumbWidth = targetWidth;
    const thumbHeight = Math.max(100, Math.round(canvas.height * scale));

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width = thumbWidth;
    thumbCanvas.height = thumbHeight;
    const tCtx = thumbCanvas.getContext('2d');
    tCtx.drawImage(canvas, 0, 0, thumbWidth, thumbHeight);

    let imgData;
    try {
      imgData = tCtx.getImageData(0, 0, thumbWidth, thumbHeight);
    } catch (e) {
      return 0;
    }
    const data = imgData.data;

    // Convert to binary 0/1 array (dark text = 1, bright paper = 0)
    const bin = new Uint8Array(thumbWidth * thumbHeight);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
      const g = (data[i] * 0.299) + (data[i + 1] * 0.587) + (data[i + 2] * 0.114);
      bin[p] = g < 160 ? 1 : 0;
    }

    // Search angles from -8 to +8 degrees in steps of 0.5 deg
    let bestAngle = 0;
    let maxVariance = -1;

    for (let angle = -8; angle <= 8; angle += 0.5) {
      if (Math.abs(angle) < 0.1) continue;
      const rad = (angle * Math.PI) / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);
      const cx = thumbWidth / 2;
      const cy = thumbHeight / 2;

      const profile = new Float32Array(thumbHeight);
      let count = 0;

      const marginX = Math.round(thumbWidth * 0.1);
      const marginY = Math.round(thumbHeight * 0.1);

      for (let y = marginY; y < thumbHeight - marginY; y += 2) {
        const rowOffset = y * thumbWidth;
        for (let x = marginX; x < thumbWidth - marginX; x += 2) {
          if (bin[rowOffset + x] === 1) {
            const rotY = Math.round(cy + (-(x - cx) * sinA + (y - cy) * cosA));
            if (rotY >= 0 && rotY < thumbHeight) {
              profile[rotY]++;
              count++;
            }
          }
        }
      }

      if (count > 30) {
        const mean = count / thumbHeight;
        let variance = 0;
        for (let y = 0; y < thumbHeight; y++) {
          const diff = profile[y] - mean;
          variance += diff * diff;
        }
        if (variance > maxVariance) {
          maxVariance = variance;
          bestAngle = angle;
        }
      }
    }

    // If significant skew is detected (>= 0.5 deg), rotate canvas straight
    if (Math.abs(bestAngle) >= 0.5) {
      const temp = document.createElement('canvas');
      temp.width = canvas.width;
      temp.height = canvas.height;
      const tempCtx = temp.getContext('2d');
      tempCtx.drawImage(canvas, 0, 0);

      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((-bestAngle * Math.PI) / 180);
      ctx.drawImage(temp, -canvas.width / 2, -canvas.height / 2);
      ctx.restore();

      temp.width = 1;
      temp.height = 1;
    }

    return bestAngle;
  }

  /**
   * Terminate active worker to free memory
   */
  async function terminate() {
    if (activeWorker) {
      try {
        await activeWorker.terminate();
      } catch (e) {
        console.warn('Worker terminate error:', e);
      }
      activeWorker = null;
      currentLang = null;
    }
  }

  /**
   * Recognize text on a canvas element with auto preprocessing
   * @param {HTMLCanvasElement} canvas 
   * @param {string} lang 
   * @param {Function} onProgress 
   * @returns {Promise<Object>}
   */
  async function recognizeCanvas(canvas, lang, onProgress) {
    const worker = await getWorker(lang, onProgress);
    
    // Create preprocessed clone to avoid modifying visual canvas
    const processedCanvas = document.createElement('canvas');
    processedCanvas.width = canvas.width;
    processedCanvas.height = canvas.height;
    const pCtx = processedCanvas.getContext('2d');
    pCtx.drawImage(canvas, 0, 0);
    autoDeskewCanvas(processedCanvas);
    preprocessCanvasForOcr(processedCanvas, 'doc');

    const result = await worker.recognize(processedCanvas);
    
    processedCanvas.width = 1;
    processedCanvas.height = 1;
    return result.data;
  }

  /**
   * Process a PDF or Image file for full OCR
   * @param {File} file 
   * @param {Object} options - { lang: 'ind'|'eng'|'ind+eng', outputFormat: 'both'|'text'|'pdf', pageRange: string, scale: number, dpi: number, preprocess: 'auto'|'doc'|'clean'|'none' }
   * @param {Function} onProgress - Progress callback (percent, text)
   * @returns {Promise<{fullText: string, pageResults: Array, searchablePdfBytes: Uint8Array, stats: Object}>}
   */
  async function processFile(file, options, onProgress) {
    options = options || {};
    const lang = options.lang || 'ind';
    const outputFormat = options.outputFormat || 'both'; // 'both' | 'text' | 'pdf'
    const preprocessMode = options.preprocess || 'auto';
    const targetDpi = options.dpi ? parseInt(options.dpi, 10) : 200;
    const scale = options.scale || (targetDpi / 72); // 150 DPI = 2.08, 200 DPI = 2.77, 300 DPI = 4.16

    const reportProgress = (pct, msg) => {
      if (typeof onProgress === 'function') {
        onProgress(pct, msg);
      }
    };

    // Unwrap StudioDoc if passed
    if (file && file.file && file.arrayBuffer) {
      file = file.file;
    }

    const isPdf = file && (
      (file.name && PDFTools.FileUtils.isPDF(file)) ||
      (file.type && file.type.includes('pdf')) ||
      (file instanceof ArrayBuffer) ||
      (file instanceof Uint8Array)
    );
    const isImage = file && !isPdf && (
      (file.name && PDFTools.FileUtils.isImage(file)) ||
      (file.type && file.type.startsWith('image/'))
    );

    if (!isPdf && !isImage) {
      throw new Error('Unsupported file format. Please upload a valid PDF or image file.');
    }

    const worker = await getWorker(lang, (pct, status) => {
      reportProgress(Math.round(5 + (pct * 0.15)), status);
    });

    const pageResults = [];
    let fullText = '';
    let searchablePdfBytes = null;

    if (isImage) {
      // --- IMAGE OCR ---
      reportProgress(20, 'Loading and preparing image for OCR...');
      const dataUrl = await PDFTools.FileUtils.readAsDataURL(file);
      
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = dataUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);

      // Apply Auto-Deskew if enabled
      if (options.deskew) {
        reportProgress(25, 'Detecting and correcting image skew angle...');
        const skewAngle = autoDeskewCanvas(canvas);
        if (Math.abs(skewAngle) >= 0.5) {
          console.log(`[OCR Deskew] Image rotated by ${skewAngle.toFixed(1)}°`);
        }
      }

      // Apply Adaptive Preprocessing Filter
      if (preprocessMode !== 'none') {
        reportProgress(28, `Cleaning image (${preprocessMode.toUpperCase()} Otsu Filter)...`);
        preprocessCanvasForOcr(canvas, preprocessMode);
      }

      reportProgress(32, 'Performing neural character recognition on image...');
      const ocrData = await worker.recognize(canvas);

      pageResults.push({
        pageNum: 1,
        text: ocrData.text || '',
        confidence: Math.round(ocrData.confidence || 0),
        lines: ocrData.lines || [],
        words: ocrData.words || [],
        width: img.width,
        height: img.height
      });

      fullText = ocrData.text || '';

      // Generate Searchable PDF from Image if requested
      if (outputFormat === 'pdf' || outputFormat === 'both') {
        reportProgress(85, 'Creating searchable PDF overlay...');
        searchablePdfBytes = await generateSearchablePdfFromImage(file, img, ocrData);
      }

      canvas.width = 1;
      canvas.height = 1;
    } else {
      // --- PDF OCR ---
      reportProgress(15, 'Extracting PDF pages with PDF.js engine...');

      // Dynamic worker setup
      if (typeof pdfjsLib !== 'undefined' && window.location.protocol !== 'file:' && (!pdfjsLib.GlobalWorkerOptions.workerSrc || !pdfjsLib.GlobalWorkerOptions.workerSrc.includes('pdf.worker'))) {
        const isSubPage = window.location.pathname.includes('/pages/') || window.location.href.includes('/pages/');
        pdfjsLib.GlobalWorkerOptions.workerSrc = isSubPage ? '../js/lib/pdf.worker.min.js' : 'js/lib/pdf.worker.min.js';
      }

      const arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
      const pdfJsData = (arrayBuffer instanceof ArrayBuffer)
        ? new Uint8Array(arrayBuffer.slice(0))
        : (arrayBuffer instanceof Uint8Array ? arrayBuffer.slice(0) : new Uint8Array(arrayBuffer));
      const loadingTask = pdfjsLib.getDocument({ data: pdfJsData });
      const pdfJsDoc = await loadingTask.promise;
      const totalPages = pdfJsDoc.numPages;

      // Determine which pages to OCR
      let targetPages = [];
      if (options.pageRange && options.pageRange.trim() !== '') {
        targetPages = parsePageRange(options.pageRange, totalPages);
      } else {
        for (let p = 1; p <= totalPages; p++) targetPages.push(p);
      }

      if (targetPages.length === 0) {
        throw new Error('No valid pages selected for OCR.');
      }

      const totalTargetPages = targetPages.length;

      for (let idx = 0; idx < totalTargetPages; idx++) {
        const pageNum = targetPages[idx];
        const basePct = Math.round(20 + ((idx / totalTargetPages) * 65));
        const pageWeight = Math.round(65 / totalTargetPages);

        reportProgress(basePct, `Rendering page ${pageNum} (${idx + 1}/${totalTargetPages} @ ${targetDpi} DPI)...`);

        const page = await pdfJsDoc.getPage(pageNum);
        const originalViewport = page.getViewport({ scale: 1.0 });
        const renderViewport = page.getViewport({ scale: scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(renderViewport.width);
        canvas.height = Math.round(renderViewport.height);
        const ctx = canvas.getContext('2d', { alpha: false });
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        await page.render({
          canvasContext: ctx,
          viewport: renderViewport,
          annotationMode: (typeof pdfjsLib !== 'undefined' && pdfjsLib.AnnotationMode) ? pdfjsLib.AnnotationMode.ENABLE_FORMS : 2
        }).promise;

        // Apply Auto-Deskew if enabled
        if (options.deskew) {
          const skewAngle = autoDeskewCanvas(canvas);
          if (Math.abs(skewAngle) >= 0.5) {
            reportProgress(basePct + Math.round(pageWeight * 0.15), `Correcting page ${pageNum} skew (${skewAngle > 0 ? '+' : ''}${skewAngle.toFixed(1)}°)...`);
          }
        }

        // Apply Adaptive Preprocessing Filter
        if (preprocessMode !== 'none') {
          reportProgress(basePct + Math.round(pageWeight * 0.25), `Cleaning page ${pageNum} (${preprocessMode.toUpperCase()} filter)...`);
          preprocessCanvasForOcr(canvas, preprocessMode);
        }

        reportProgress(basePct + Math.round(pageWeight * 0.45), `Recognizing text on page ${pageNum}...`);

        const ocrData = await worker.recognize(canvas);

        const pageText = (ocrData.text || '').trim();
        pageResults.push({
          pageNum: pageNum,
          text: pageText,
          confidence: Math.round(ocrData.confidence || 0),
          lines: ocrData.lines || [],
          words: ocrData.words || [],
          width: originalViewport.width,
          height: originalViewport.height,
          renderedWidth: renderViewport.width,
          renderedHeight: renderViewport.height
        });

        if (pageText) {
          if (fullText) fullText += '\n\n' + `--- [ Halaman ${pageNum} ] ---` + '\n\n';
          fullText += pageText;
        }

        // Cleanup canvas & page
        canvas.width = 1;
        canvas.height = 1;
        page.cleanup();
      }

      // Generate Searchable PDF if requested
      if (outputFormat === 'pdf' || outputFormat === 'both') {
        reportProgress(90, 'Embedding invisible OCR text layer into PDF...');
        searchablePdfBytes = await generateSearchablePdfFromDoc(arrayBuffer, pageResults);
      }

      pdfJsDoc.destroy();
    }

    reportProgress(100, 'OCR Complete!');

    // Calculate aggregated statistics
    let totalWords = 0;
    let totalConfidenceSum = 0;
    pageResults.forEach(p => {
      totalWords += (p.words || []).length;
      totalConfidenceSum += p.confidence;
    });

    const avgConfidence = pageResults.length > 0 
      ? Math.round(totalConfidenceSum / pageResults.length) 
      : 0;

    return {
      fullText: fullText.trim(),
      pageResults: pageResults,
      searchablePdfBytes: searchablePdfBytes,
      stats: {
        pageCount: pageResults.length,
        wordCount: totalWords,
        charCount: fullText.length,
        avgConfidence: avgConfidence,
        lang: lang,
        dpi: targetDpi,
        preprocess: preprocessMode,
        simd: supportsSimd()
      }
    };
  }

  /**
   * Helper: Parse page range string (e.g. "1-3, 5, 8-10")
   */
  function parsePageRange(rangeStr, maxPages) {
    const pages = new Set();
    const parts = rangeStr.split(',');

    for (let part of parts) {
      part = part.trim();
      if (part.includes('-')) {
        const [startStr, endStr] = part.split('-');
        const start = parseInt(startStr, 10);
        const end = parseInt(endStr, 10);
        if (!isNaN(start) && !isNaN(end)) {
          const s = Math.max(1, Math.min(start, end));
          const e = Math.min(maxPages, Math.max(start, end));
          for (let i = s; i <= e; i++) pages.add(i);
        }
      } else {
        const p = parseInt(part, 10);
        if (!isNaN(p) && p >= 1 && p <= maxPages) {
          pages.add(p);
        }
      }
    }

    return Array.from(pages).sort((a, b) => a - b);
  }

  /**
   * Sanitize text string for safe WinAnsi encoding in pdf-lib StandardFonts
   * Prevents entire words from being dropped due to unicode quotes, dashes, or bullets
   * @param {string} str 
   * @returns {string}
   */
  function sanitizeForPdfWinAnsi(str) {
    if (!str) return '';
    return str
      .replace(/[\u201C\u201D""]/g, '"')
      .replace(/[\u2018\u2019'']/g, "'")
      .replace(/[\u2013\u2014–—]/g, '-')
      .replace(/…/g, '...')
      .replace(/•/g, '*')
      .replace(/[\u00A0\u2000-\u200B]/g, ' ')
      .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
  }

  /**
   * Helper: Rotate canvas element by 90, 180, or 270 degrees
   * @param {HTMLCanvasElement} canvas 
   * @param {number} degrees 
   * @returns {HTMLCanvasElement}
   */
  function rotateCanvas(canvas, degrees) {
    degrees = (degrees % 360 + 360) % 360;
    if (degrees === 0) return canvas;

    const temp = document.createElement('canvas');
    const rad = degrees * Math.PI / 180;
    if (degrees === 90 || degrees === 270) {
      temp.width = canvas.height;
      temp.height = canvas.width;
    } else {
      temp.width = canvas.width;
      temp.height = canvas.height;
    }

    const ctx = temp.getContext('2d');
    ctx.translate(temp.width / 2, temp.height / 2);
    ctx.rotate(rad);
    ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

    canvas.width = temp.width;
    canvas.height = temp.height;
    const mainCtx = canvas.getContext('2d');
    mainCtx.drawImage(temp, 0, 0);

    return canvas;
  }

  /**
   * Generate Searchable PDF from a Scanned Image
   */
  async function generateSearchablePdfFromImage(imageFile, imgElement, ocrData) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const imageBytes = await PDFTools.FileUtils.readAsArrayBuffer(imageFile);
    const safeImageBytes = (imageBytes instanceof ArrayBuffer)
      ? new Uint8Array(imageBytes.slice(0))
      : (imageBytes instanceof Uint8Array ? imageBytes.slice(0) : new Uint8Array(imageBytes));
    let embeddedImg;
    const ext = PDFTools.FileUtils.getExtension(imageFile.name || '');

    if (ext === 'png') {
      embeddedImg = await pdfDoc.embedPng(safeImageBytes);
    } else {
      embeddedImg = await pdfDoc.embedJpg(safeImageBytes);
    }

    const pdfPage = pdfDoc.addPage([imgElement.width, imgElement.height]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: imgElement.width,
      height: imgElement.height
    });

    // Overlay invisible text for each word
    const words = ocrData.words || [];
    for (const word of words) {
      if (!word.text || !word.bbox) continue;
      const { x0, y0, x1, y1 } = word.bbox;
      const wordWidth = x1 - x0;
      const wordHeight = y1 - y0;
      const fontSize = Math.max(6, Math.round(wordHeight * 0.85));

      // PDF coordinates: origin (0,0) is bottom-left
      const pdfX = x0;
      const pdfY = imgElement.height - y1;

      const safeText = sanitizeForPdfWinAnsi(word.text);
      if (!safeText || safeText.trim() === '') continue;

      try {
        pdfPage.drawText(safeText, {
          x: pdfX,
          y: pdfY,
          size: fontSize,
          font: font,
          color: rgb(0, 0, 0),
          opacity: 0.0 // Completely invisible text layer
        });
      } catch (drawErr) {
        // Skip characters outside font encoding
      }
    }

    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Generate Searchable PDF from an Existing PDF Document
   */
  async function generateSearchablePdfFromDoc(arrayBuffer, pageResults) {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const safeBytes = (arrayBuffer instanceof ArrayBuffer)
      ? new Uint8Array(arrayBuffer.slice(0))
      : (arrayBuffer instanceof Uint8Array ? arrayBuffer.slice(0) : new Uint8Array(arrayBuffer));
    const pdfDoc = await PDFDocument.load(safeBytes, { ignoreEncryption: true });
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();

    for (const res of pageResults) {
      const pageIndex = res.pageNum - 1;
      if (pageIndex < 0 || pageIndex >= pages.length) continue;

      const page = pages[pageIndex];
      const { width: pdfWidth, height: pdfHeight } = page.getSize();
      const scaleX = pdfWidth / (res.renderedWidth || pdfWidth);
      const scaleY = pdfHeight / (res.renderedHeight || pdfHeight);

      const words = res.words || [];
      for (const word of words) {
        if (!word.text || !word.bbox) continue;
        const { x0, y0, x1, y1 } = word.bbox;
        const pdfX = x0 * scaleX;
        const pdfY = pdfHeight - (y1 * scaleY);
        const wordHeight = (y1 - y0) * scaleY;
        const fontSize = Math.max(5, Math.round(wordHeight * 0.85));

        const safeText = sanitizeForPdfWinAnsi(word.text);
        if (!safeText || safeText.trim() === '') continue;

        try {
          page.drawText(safeText, {
            x: pdfX,
            y: pdfY,
            size: fontSize,
            font: font,
            color: rgb(0, 0, 0),
            opacity: 0.0 // Invisible selectable layer
          });
        } catch (drawErr) {
          // Skip any remaining unsupported glyphs
        }
      }
    }

    return await pdfDoc.save({ useObjectStreams: true });
  }

  /**
   * Detect table structure from OCR word bounding boxes and reconstruct CSV format
   * @param {Array} pageResults 
   * @returns {string} CSV string
   */
  function convertOcrToCsv(pageResults) {
    if (!pageResults || pageResults.length === 0) return '';
    let csvRows = [];

    pageResults.forEach(page => {
      const words = (page.words || []).slice(0);
      if (words.length === 0) return;

      // Group words into lines based on Y-axis overlap
      words.sort((a, b) => (a.bbox.y0 - b.bbox.y0) || (a.bbox.x0 - b.bbox.x0));

      const lines = [];
      words.forEach(w => {
        const midY = (w.bbox.y0 + w.bbox.y1) / 2;
        let matchedLine = lines.find(l => Math.abs(l.midY - midY) <= 8);
        if (matchedLine) {
          matchedLine.words.push(w);
        } else {
          lines.push({ midY: midY, words: [w] });
        }
      });

      // Sort lines top to bottom
      lines.sort((a, b) => a.midY - b.midY);

      lines.forEach(line => {
        // Sort words left to right
        line.words.sort((a, b) => a.bbox.x0 - b.bbox.x0);

        // Group words into columns if horizontal gap > 28px
        const columns = [];
        let currentCell = [];
        let lastX1 = -1;

        line.words.forEach(w => {
          if (lastX1 > 0 && (w.bbox.x0 - lastX1) > 28) {
            columns.push(currentCell.join(' '));
            currentCell = [w.text];
          } else {
            currentCell.push(w.text);
          }
          lastX1 = w.bbox.x1;
        });
        if (currentCell.length > 0) {
          columns.push(currentCell.join(' '));
        }

        if (columns.length > 0) {
          const rowStr = columns.map(c => `"${c.replace(/"/g, '""')}"`).join(',');
          csvRows.push(rowStr);
        }
      });
    });

    return csvRows.join('\r\n');
  }

  /**
   * Sample text to auto-detect whether document is primarily Indonesian or English
   * @param {string} sampleText 
   * @returns {'ind'|'eng'|'ind+eng'}
   */
  function detectLanguageFromText(sampleText) {
    if (!sampleText || sampleText.trim().length < 20) return 'ind';

    const lower = sampleText.toLowerCase();
    const indWords = ['yang', 'dan', 'dengan', 'adalah', 'untuk', 'pada', 'dari', 'ini', 'oleh', 'keputusan', 'republik', 'indonesia', 'surat', 'nomor', 'pasal'];
    const engWords = ['the', 'and', 'with', 'this', 'that', 'from', 'for', 'have', 'agreement', 'section', 'article', 'general', 'document', 'report', 'shall'];

    let indScore = 0;
    let engScore = 0;

    indWords.forEach(w => {
      const regex = new RegExp('\\b' + w + '\\b', 'g');
      const matches = lower.match(regex);
      if (matches) indScore += matches.length;
    });

    engWords.forEach(w => {
      const regex = new RegExp('\\b' + w + '\\b', 'g');
      const matches = lower.match(regex);
      if (matches) engScore += matches.length;
    });

    if (indScore >= 2 && engScore >= 2) return 'ind+eng';
    if (indScore > engScore) return 'ind';
    if (engScore > indScore) return 'eng';
    return 'ind';
  }

  return {
    getWorker,
    terminate,
    recognizeCanvas,
    processFile,
    processDocument: processFile,
    supportsSimd,
    calculateOtsuThreshold,
    preprocessCanvas: preprocessCanvasForOcr,
    autoDeskew: autoDeskewCanvas,
    rotateCanvas,
    sanitizeForPdfWinAnsi,
    convertOcrToCsv,
    detectLanguageFromText
  };
})();
