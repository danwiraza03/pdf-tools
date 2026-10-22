/**
 * PDF Tools (DN.) — Service Worker for Offline PWA Caching
 * v3: Full pre-cache + Network-First HTML / Cache-First assets
 * Only activated on HTTP/HTTPS/localhost (bypassed on file:///)
 */
const CACHE_NAME = 'pdf-tools-v5';

// Critical assets to pre-cache on install for true offline-first
const PRECACHE_URLS = [
  './',
  './index.html',
  './css/style.css',
  './css/home.css',
  './css/tool.css',
  './js/app.js',
  './js/utils/i18n.js',
  './js/utils/file-utils.js',
  './js/utils/download.js',
  './js/components/toast.js',
  './js/components/progress.js',
  './js/components/dropzone.js',
  './js/components/pdf-preview.js',
  './js/components/file-list.js',
  './js/components/command-palette.js',
  './js/lib/pdf-lib.min.js',
  './js/lib/pdf.min.js',
  './js/lib/pdf.worker.min.js',
  './js/lib/FileSaver.min.js',
  './js/lib/Sortable.min.js',
  './js/lib/jszip.min.js',
  './js/lib/tesseract/tesseract.min.js',
  './js/lib/tesseract/worker.min.js',
  './js/core/pdf-merge.js',
  './js/core/pdf-split.js',
  './js/core/pdf-compress.js',
  './js/core/pdf-rotate.js',
  './js/core/pdf-remove.js',
  './js/core/pdf-reorder.js',
  './js/core/pdf-watermark.js',
  './js/core/pdf-page-number.js',
  './js/core/pdf-protect.js',
  './js/core/pdf-flatten.js',
  './js/core/pdf-grayscale.js',
  './js/core/pdf-crop.js',
  './js/core/pdf-to-jpg.js',
  './js/core/pdf-to-docx.js',
  './js/core/pdf-to-xlsx.js',
  './js/core/jpg-to-pdf.js',
  './js/core/docx-to-pdf.js',
  './js/core/xlsx-to-pdf.js',
  './js/core/pdf-ocr.js',
  './js/core/pdf-stream-engine.js',
  './js/core/pdf-studio.js',
  './js/editor/accessibility-engine.js',
  './js/editor/annotation-engine.js',
  './js/editor/background-sampler.js',
  './js/editor/command-manager.js',
  './js/editor/comments-engine.js',
  './js/editor/compare-engine.js',
  './js/editor/font-engine.js',
  './js/editor/font-intelligence.js',
  './js/editor/font-normalizer.js',
  './js/editor/font-registry.js',
  './js/editor/font-resolver.js',
  './js/editor/form-engine.js',
  './js/editor/image-edit-engine.js',
  './js/editor/image-extractor.js',
  './js/editor/ocr-layout-engine.js',
  './js/editor/page-tools-engine.js',
  './js/editor/paragraph-engine.js',
  './js/editor/pdf-coordinate-engine.js',
  './js/editor/pdf-text-extractor.js',
  './js/editor/redaction-engine.js',
  './js/editor/security-engine.js',
  './js/editor/signature-inspector.js',
  './js/editor/text-block-detector.js',
  './js/editor/text-edit-engine.js',
  './js/editor/text-extractor.js',
  './js/editor/text-fit-engine.js',
  './js/editor/text-model.js',
  './icon.svg',
  './manifest.json',
  './pages/merge.html',
  './pages/split.html',
  './pages/compress.html',
  './pages/rotate.html',
  './pages/remove-pages.html',
  './pages/reorder.html',
  './pages/watermark.html',
  './pages/page-number.html',
  './pages/protect.html',
  './pages/flatten.html',
  './pages/grayscale.html',
  './pages/crop.html',
  './pages/pdf-to-docx.html',
  './pages/pdf-to-xlsx.html',
  './pages/pdf-to-jpg.html',
  './pages/jpg-to-pdf.html',
  './pages/docx-to-pdf.html',
  './pages/xlsx-to-pdf.html',
  './pages/ocr.html',
  './pages/sign.html',
  './pages/form-fill.html',
  './pages/batch.html',
  './pages/viewer.html'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        console.warn('SW pre-cache partial failure:', err);
        return self.skipWaiting();
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests with http/https schemes
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  const url = new URL(event.request.url);

  // HTML pages: Network-First (get latest, fall back to cache)
  if (event.request.mode === 'navigate' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request);
        })
    );
    return;
  }

  // JS/CSS/Assets: Cache-First (fast loads, fall back to network)
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      }).catch(() => {
        return cached;
      });
    })
  );
});
