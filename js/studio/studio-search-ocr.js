/**
 * PDF Tools — PDF Studio Document Search & Offline OCR Module
 * Manages in-document text search (Ctrl+F, F3, match navigation, highlight overlays)
 * and offline OCR recognition drawer (page OCR, batch OCR, searchable PDF export).
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioSearchOCR = (function () {
  let ctx = null;

  // Search State
  let searchMatches = [];
  let currentMatchIdx = -1;
  let searchTextCache = new Map();
  let searchRequestId = 0;
  let searchQuery = '';
  let matchCase = false;
  let wholeWord = false;
  let searchDebounceTimer = null;

  // OCR State
  let isOcrBatchRunning = false;
  let shouldCancelBatchOcr = false;

  function init(context) {
    ctx = context;
    bindEventListeners();
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : null;
  }

  function getCurrentScale() {
    return ctx && ctx.getCurrentScale ? ctx.getCurrentScale() : 1.0;
  }

  function getViewMode() {
    return ctx && ctx.getViewMode ? ctx.getViewMode() : 'continuous';
  }

  function getSearchMatches() {
    return searchMatches;
  }

  function getCurrentMatchIdx() {
    return currentMatchIdx;
  }

  function getSearchQuery() {
    return searchQuery;
  }

  function resetSearchState() {
    searchRequestId++;
    searchTextCache.clear();
    searchMatches = [];
    currentMatchIdx = -1;
    searchQuery = '';
    const findMatchesLabel = document.getElementById('findMatchesLabel');
    if (findMatchesLabel) findMatchesLabel.textContent = '0/0';
    clearSearchHighlights();
  }

  // --- Search Highlight Rendering & Scrolling ---

  function renderSinglePageSearchHighlights() {
    const searchHighlightLayer = ctx?.getSearchHighlightLayer?.() || document.getElementById('searchHighlightLayer');
    if (!searchHighlightLayer) return;
    searchHighlightLayer.innerHTML = '';

    const currentDoc = getDoc();
    if (!currentDoc || !searchQuery || searchMatches.length === 0) return;

    const pageMatches = searchMatches.filter(m => m.pageNumber === currentDoc.currentPage);
    const fragment = document.createDocumentFragment();
    const scale = getCurrentScale();

    pageMatches.forEach(m => {
      const isCurrentActive = (searchMatches[currentMatchIdx] === m);
      const el = document.createElement('div');
      el.className = `search-highlight ${isCurrentActive ? 'active-match' : ''}`;
      el.style.left = `${m.rect.x * scale}px`;
      el.style.top = `${m.rect.y * scale}px`;
      el.style.width = `${m.rect.width * scale}px`;
      el.style.height = `${m.rect.height * scale}px`;
      if (isCurrentActive) {
        el.id = 'activeSearchHighlight';
      }
      fragment.appendChild(el);
    });

    searchHighlightLayer.appendChild(fragment);
  }

  function renderContinuousSearchHighlights() {
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    if (!pageStack) return;

    const scale = getCurrentScale();

    pageStack.querySelectorAll('.continuous-highlight-layer').forEach(layer => {
      const p = parseInt(layer.dataset.page, 10);
      layer.innerHTML = '';
      if (!searchQuery || searchMatches.length === 0) return;

      const pageMatches = searchMatches.filter(m => m.pageNumber === p);
      const fragment = document.createDocumentFragment();

      pageMatches.forEach(m => {
        const isCurrentActive = (searchMatches[currentMatchIdx] === m);
        const el = document.createElement('div');
        el.className = `search-highlight ${isCurrentActive ? 'active-match' : ''}`;
        el.style.left = `${m.rect.x * scale}px`;
        el.style.top = `${m.rect.y * scale}px`;
        el.style.width = `${m.rect.width * scale}px`;
        el.style.height = `${m.rect.height * scale}px`;
        if (isCurrentActive) {
          el.id = 'activeContinuousHighlight';
        }
        fragment.appendChild(el);
      });

      layer.appendChild(fragment);
    });
  }

  function clearSearchHighlights() {
    const searchHighlightLayer = ctx?.getSearchHighlightLayer?.() || document.getElementById('searchHighlightLayer');
    if (searchHighlightLayer) searchHighlightLayer.innerHTML = '';
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    if (pageStack) {
      pageStack.querySelectorAll('.continuous-highlight-layer').forEach(l => {
        l.innerHTML = '';
      });
    }
  }

  function scrollToActiveMatchSingle(match) {
    const el = document.getElementById('activeSearchHighlight');
    const acrobatViewport = ctx?.getAcrobatViewport?.() || document.getElementById('acrobatViewport');
    const scale = getCurrentScale();

    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } else if (match && acrobatViewport) {
      const matchY = match.rect.y * scale;
      acrobatViewport.scrollTo({
        top: Math.max(0, matchY - acrobatViewport.clientHeight / 2),
        behavior: 'smooth'
      });
    }
  }

  function scrollToActiveMatchContinuous(match) {
    if (!match) return;
    const pageStack = ctx?.getPageStack?.() || document.getElementById('pageStack');
    const pageFrame = pageStack ? pageStack.querySelector(`[data-page="${match.pageNumber}"]`) : null;
    if (!pageFrame) return;

    const el = document.getElementById('activeContinuousHighlight');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    } else {
      pageFrame.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // --- Search Logic & Match Extraction ---

  async function getPageSearchData(pageNum) {
    if (searchTextCache.has(pageNum)) {
      return searchTextCache.get(pageNum);
    }
    const currentDoc = getDoc();
    if (!currentDoc || !currentDoc.pdfJsDoc) {
      return { items: [], unscaledViewport: null };
    }
    try {
      const page = await currentDoc.pdfJsDoc.getPage(pageNum);
      const textContent = await page.getTextContent({ normalizeWhitespace: true });
      const unscaledViewport = page.getViewport({ scale: 1.0 });

      const items = [];
      textContent.items.forEach(item => {
        if (!item.str) return;
        const tx = window.pdfjsLib ? window.pdfjsLib.Util.transform(unscaledViewport.transform, item.transform) : item.transform;
        const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]));
        items.push({
          str: item.str,
          transform: tx,
          unscaledX: tx[4],
          unscaledY: tx[5] - fontHeight,
          unscaledWidth: item.width || (item.str.length * fontHeight * 0.52),
          unscaledHeight: fontHeight,
          pdfItem: item
        });
      });

      const data = { items, unscaledViewport };
      searchTextCache.set(pageNum, data);
      return data;
    } catch (err) {
      console.warn(`Failed to extract search data for page ${pageNum}:`, err);
      return { items: [], unscaledViewport: null };
    }
  }

  async function findMatchesOnPage(pageNum, query, caseSensitive, wholeWordOnly) {
    const matches = [];
    const { items } = await getPageSearchData(pageNum);
    const qLen = query.length;
    const targetQ = caseSensitive ? query : query.toLowerCase();

    // 1. PDF.js Content Items
    items.forEach(item => {
      const rawStr = item.str || '';
      const str = caseSensitive ? rawStr : rawStr.toLowerCase();
      let startPos = 0;

      while (startPos < str.length) {
        const foundIndex = str.indexOf(targetQ, startPos);
        if (foundIndex === -1) break;

        if (wholeWordOnly) {
          const beforeChar = foundIndex > 0 ? rawStr[foundIndex - 1] : ' ';
          const afterChar = (foundIndex + qLen < rawStr.length) ? rawStr[foundIndex + qLen] : ' ';
          const isWordBoundary = /\W/.test(beforeChar) && /\W/.test(afterChar);
          if (!isWordBoundary) {
            startPos = foundIndex + 1;
            continue;
          }
        }

        const totalLen = Math.max(1, rawStr.length);
        const charWidth = item.unscaledWidth / totalLen;
        const matchX = item.unscaledX + (foundIndex * charWidth);
        const matchWidth = Math.max(charWidth * qLen, 4);

        matches.push({
          pageNumber: pageNum,
          rect: {
            x: matchX,
            y: item.unscaledY,
            width: matchWidth,
            height: item.unscaledHeight
          },
          text: rawStr.substring(foundIndex, foundIndex + qLen)
        });

        startPos = foundIndex + qLen;
      }
    });

    // 2. Custom User Added Texts & In-Place Edits
    const currentDoc = getDoc();
    if (currentDoc) {
      const pageAnn = currentDoc.getPageAnnotation(pageNum);
      (pageAnn.texts || []).forEach(tb => {
        const rawStr = tb.text || '';
        const str = caseSensitive ? rawStr : rawStr.toLowerCase();
        let startPos = 0;
        while (startPos < str.length) {
          const foundIndex = str.indexOf(targetQ, startPos);
          if (foundIndex === -1) break;
          matches.push({
            pageNumber: pageNum,
            rect: {
              x: tb.x,
              y: tb.y,
              width: Math.max(60, (tb.text || '').length * (tb.fontSize || 14) * 0.5),
              height: (tb.fontSize || 14) * 1.2
            },
            text: rawStr.substring(foundIndex, foundIndex + qLen)
          });
          startPos = foundIndex + qLen;
        }
      });

      (pageAnn.edits || []).forEach(ed => {
        const rawStr = ed.text || '';
        const str = caseSensitive ? rawStr : rawStr.toLowerCase();
        let startPos = 0;
        while (startPos < str.length) {
          const foundIndex = str.indexOf(targetQ, startPos);
          if (foundIndex === -1) break;
          matches.push({
            pageNumber: pageNum,
            rect: {
              x: ed.x,
              y: ed.y,
              width: ed.width || (rawStr.length * (ed.fontSize || 12) * 0.5),
              height: ed.height || (ed.fontSize || 12) * 1.2
            },
            text: rawStr.substring(foundIndex, foundIndex + qLen)
          });
          startPos = foundIndex + qLen;
        }
      });

      // 3. Scanned Hardcopy OCR Words (Full document search on scans)
      if (pageAnn.ocrWords && pageAnn.ocrWords.length > 0) {
        pageAnn.ocrWords.forEach(w => {
          const rawStr = w.text || '';
          const str = caseSensitive ? rawStr : rawStr.toLowerCase();
          let startPos = 0;
          while (startPos < str.length) {
            const foundIndex = str.indexOf(targetQ, startPos);
            if (foundIndex === -1) break;
            matches.push({
              pageNumber: pageNum,
              rect: {
                x: w.x,
                y: w.y,
                width: w.width || (rawStr.length * (w.height || 12) * 0.5),
                height: w.height || 14
              },
              text: rawStr.substring(foundIndex, foundIndex + qLen)
            });
            startPos = foundIndex + qLen;
          }
        });
      }
    }

    return matches;
  }

  async function executeSearch() {
    const findInput = document.getElementById('findTextInput');
    const findClearBtn = document.getElementById('findClearBtn');
    const findMatchesLabel = document.getElementById('findMatchesLabel');
    if (!findInput) return;

    const query = findInput.value.trim();
    const requestId = ++searchRequestId;
    searchQuery = query;
    searchMatches = [];
    currentMatchIdx = -1;

    if (findClearBtn) {
      findClearBtn.style.display = query.length > 0 ? 'block' : 'none';
    }

    const currentDoc = getDoc();
    if (!query || !currentDoc) {
      if (findMatchesLabel) findMatchesLabel.textContent = '0/0';
      clearSearchHighlights();
      return;
    }

    if (findMatchesLabel) findMatchesLabel.textContent = 'Searching...';
    const activePages = currentDoc.getActivePagesList();
    const allMatches = [];

    for (const p of activePages) {
      if (requestId !== searchRequestId) return;
      try {
        const pageMatches = await findMatchesOnPage(p, query, matchCase, wholeWord);
        if (requestId !== searchRequestId) return;
        allMatches.push(...pageMatches);
      } catch (e) {
        console.warn('Search error on page', p, e);
      }
    }

    if (requestId !== searchRequestId) return;

    searchMatches = allMatches;
    if (searchMatches.length > 0) {
      let startIdx = searchMatches.findIndex(m => m.pageNumber >= currentDoc.currentPage);
      if (startIdx === -1) startIdx = 0;
      await selectSearchMatch(startIdx);
    } else {
      if (findMatchesLabel) findMatchesLabel.textContent = '0 of 0';
      clearSearchHighlights();
    }
  }

  async function selectSearchMatch(matchIdx) {
    const currentDoc = getDoc();
    if (!currentDoc || searchMatches.length === 0) return;

    const findMatchesLabel = document.getElementById('findMatchesLabel');
    currentMatchIdx = (matchIdx + searchMatches.length) % searchMatches.length;
    if (findMatchesLabel) {
      findMatchesLabel.textContent = `${currentMatchIdx + 1} of ${searchMatches.length}`;
    }

    const activeMatch = searchMatches[currentMatchIdx];
    if (!activeMatch) return;

    const viewMode = getViewMode();

    if (currentDoc.currentPage !== activeMatch.pageNumber) {
      currentDoc.currentPage = activeMatch.pageNumber;
      if (viewMode === 'single') {
        if (ctx && ctx.renderCurrentPageView) {
          await ctx.renderCurrentPageView();
        }
      } else {
        const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
        if (pageNumberInput) {
          pageNumberInput.value = currentDoc.getActivePagesList().indexOf(currentDoc.currentPage) + 1;
        }
        if (ctx && ctx.updateThumbnailActiveState) {
          ctx.updateThumbnailActiveState();
        }
      }
    }

    if (viewMode === 'single') {
      renderSinglePageSearchHighlights();
      scrollToActiveMatchSingle(activeMatch);
    } else {
      renderContinuousSearchHighlights();
      scrollToActiveMatchContinuous(activeMatch);
    }
  }

  // --- Search Bar View Controls ---

  function toggleFindBar() {
    const searchBar = document.getElementById('acrobatSearchBar');
    const findInput = document.getElementById('findTextInput');
    if (!searchBar) return;

    searchBar.classList.toggle('active');
    if (searchBar.classList.contains('active')) {
      if (findInput) {
        findInput.focus();
        findInput.select();
        if (findInput.value.trim().length > 0) {
          executeSearch();
        }
      }
    } else {
      clearSearchHighlights();
    }
  }

  function closeFindBar() {
    const searchBar = document.getElementById('acrobatSearchBar');
    const findClearBtn = document.getElementById('findClearBtn');
    const findMatchesLabel = document.getElementById('findMatchesLabel');
    if (searchBar) searchBar.classList.remove('active');
    searchQuery = '';
    searchMatches = [];
    currentMatchIdx = -1;
    if (findMatchesLabel) findMatchesLabel.textContent = '0/0';
    if (findClearBtn) findClearBtn.style.display = 'none';
    clearSearchHighlights();
  }

  // --- OCR Drawer Controls ---

  function toggleOcrDrawer(forceState) {
    const ocrDrawer = document.getElementById('ocrDrawer');
    const toolOcr = document.getElementById('toolOcr');
    const commentsDrawer = ctx?.getCommentsDrawer?.() || document.getElementById('commentsDrawer');
    if (!ocrDrawer) return;

    const currentDoc = getDoc();
    if (!currentDoc && forceState !== false) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Silakan buka dokumen PDF terlebih dahulu untuk menjalankan OCR.');
      }
      if (ctx && ctx.triggerOpen) ctx.triggerOpen();
      return;
    }

    const shouldOpen = typeof forceState === 'boolean' ? forceState : !ocrDrawer.classList.contains('active');
    if (shouldOpen) {
      ocrDrawer.classList.add('active');
      if (toolOcr) toolOcr.classList.add('active');
      document.getElementById('paneScanOcr')?.classList.add('active');
      if (commentsDrawer) commentsDrawer.classList.remove('active');
    } else {
      ocrDrawer.classList.remove('active');
      if (toolOcr) toolOcr.classList.remove('active');
      document.getElementById('paneScanOcr')?.classList.remove('active');
    }
  }

  async function ocrThisPage() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Silakan buka dokumen PDF terlebih dahulu.');
      }
      return;
    }

    const startOcrThisPageBtn = document.getElementById('startOcrThisPageBtn');
    const ocrLangSelect = document.getElementById('ocrLangSelect');
    const ocrOutputBox = document.getElementById('ocrOutputBox');
    const lang = ocrLangSelect ? ocrLangSelect.value : 'eng';

    if (startOcrThisPageBtn) {
      startOcrThisPageBtn.disabled = true;
      startOcrThisPageBtn.textContent = 'Memproses OCR...';
    }

    try {
      const ocrRenderScale = 2.0;
      const tempCanvas = document.createElement('canvas');
      await window.PDFTools.Studio.renderPage(currentDoc, currentDoc.currentPage, tempCanvas, ocrRenderScale);

      const ocrData = await window.PDFTools.OCR.recognizeCanvas(tempCanvas, lang, (pct) => {
        if (startOcrThisPageBtn) startOcrThisPageBtn.textContent = `Memproses ${pct}%...`;
      });

      const pageText = (ocrData.text || '').trim();
      if (ocrOutputBox) {
        ocrOutputBox.value = pageText || '(Tidak ada teks terdeteksi pada halaman ini)';
      }

      // ATTACH OCR WORDS TO CURRENT PAGE ANNOTATION FOR REAL-TIME SEARCH (Ctrl+F)
      const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      pageAnn.ocrText = pageText;
      pageAnn.ocrWords = (ocrData.words || []).map(w => ({
        text: w.text,
        confidence: w.confidence,
        x: (w.bbox.x0 || 0) / ocrRenderScale,
        y: (w.bbox.y0 || 0) / ocrRenderScale,
        width: ((w.bbox.x1 || 0) - (w.bbox.x0 || 0)) / ocrRenderScale,
        height: ((w.bbox.y1 || 0) - (w.bbox.y0 || 0)) / ocrRenderScale
      }));

      if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);

      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(`OCR Selesai! Halaman ${currentDoc.currentPage} kini 100% dapat dicari (Ctrl+F) dan disalin. Akurasi: ${Math.round(ocrData.confidence || 0)}%`);
      }

      const findInput = document.getElementById('findTextInput');
      if (findInput && findInput.value.trim().length > 0) {
        executeSearch();
      }
    } catch (err) {
      console.error('OCR Error:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(err.message || 'OCR gagal.');
      }
    } finally {
      if (startOcrThisPageBtn) {
        startOcrThisPageBtn.disabled = false;
        startOcrThisPageBtn.innerHTML = '<svg class="btn-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> OCR Halaman Ini';
      }
    }
  }

  async function ocrAllPages() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Silakan buka dokumen PDF terlebih dahulu.');
      }
      return;
    }

    const startOcrAllPagesBtn = document.getElementById('startOcrAllPagesBtn');
    const startOcrThisPageBtn = document.getElementById('startOcrThisPageBtn');
    const ocrOutputBox = document.getElementById('ocrOutputBox');
    const ocrLangSelect = document.getElementById('ocrLangSelect');

    if (isOcrBatchRunning) {
      shouldCancelBatchOcr = true;
      if (startOcrAllPagesBtn) startOcrAllPagesBtn.textContent = 'Menghentikan...';
      return;
    }

    const activePages = currentDoc.getActivePagesList();
    const totalPages = activePages.length;
    const lang = ocrLangSelect ? ocrLangSelect.value : 'eng';

    let confirmed = true;
    if (window.PDFTools && window.PDFTools.Modal && window.PDFTools.Modal.confirm) {
      confirmed = await window.PDFTools.Modal.confirm(`Jalankan OCR untuk seluruh dokumen (${totalPages} halaman)?\n\nSetiap halaman scan kertas akan langsung dapat dicari dengan Ctrl+F dan disimpan menjadi Searchable PDF.`, { title: 'Batch OCR Offline' });
    }
    if (!confirmed) return;

    isOcrBatchRunning = true;
    shouldCancelBatchOcr = false;
    if (startOcrAllPagesBtn) {
      startOcrAllPagesBtn.classList.remove('btn-primary');
      startOcrAllPagesBtn.classList.add('btn-danger');
    }
    if (startOcrThisPageBtn) startOcrThisPageBtn.disabled = true;

    const ocrRenderScale = 2.0;
    let completedCount = 0;

    try {
      for (let i = 0; i < totalPages; i++) {
        if (shouldCancelBatchOcr) {
          if (window.PDFTools && window.PDFTools.Toast) {
            window.PDFTools.Toast.info('Batch OCR dihentikan.');
          }
          break;
        }

        const pageNum = activePages[i];
        if (startOcrAllPagesBtn) {
          startOcrAllPagesBtn.textContent = `Batal (${i + 1}/${totalPages})`;
        }

        const tempCanvas = document.createElement('canvas');
        await window.PDFTools.Studio.renderPage(currentDoc, pageNum, tempCanvas, ocrRenderScale);

        const ocrData = await window.PDFTools.OCR.recognizeCanvas(tempCanvas, lang, (pct) => {
          if (startOcrAllPagesBtn) startOcrAllPagesBtn.textContent = `Hal ${i + 1}/${totalPages} (${pct}%)`;
        });

        const pageText = (ocrData.text || '').trim();
        const pageAnn = currentDoc.getPageAnnotation(pageNum);
        pageAnn.ocrText = pageText;
        pageAnn.ocrWords = (ocrData.words || []).map(w => ({
          text: w.text,
          confidence: w.confidence,
          x: (w.bbox.x0 || 0) / ocrRenderScale,
          y: (w.bbox.y0 || 0) / ocrRenderScale,
          width: ((w.bbox.x1 || 0) - (w.bbox.x0 || 0)) / ocrRenderScale,
          height: ((w.bbox.y1 || 0) - (w.bbox.y0 || 0)) / ocrRenderScale
        }));

        if (pageNum === currentDoc.currentPage && ocrOutputBox) {
          ocrOutputBox.value = pageText;
        }

        completedCount++;
        if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
      }

      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(`Selesai! ${completedCount} halaman berhasil di-OCR. Seluruh dokumen kini dapat dicari (Ctrl+F) dan disimpan.`);
      }
      const findInput = document.getElementById('findTextInput');
      if (findInput && findInput.value.trim().length > 0) {
        executeSearch();
      }
    } catch (err) {
      console.error('Batch OCR Error:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(err.message || 'Batch OCR gagal.');
      }
    } finally {
      isOcrBatchRunning = false;
      shouldCancelBatchOcr = false;
      if (startOcrAllPagesBtn) {
        startOcrAllPagesBtn.classList.remove('btn-danger');
        startOcrAllPagesBtn.classList.add('btn-primary');
        startOcrAllPagesBtn.innerHTML = '<svg class="btn-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> OCR Semua Halaman';
      }
      if (startOcrThisPageBtn) startOcrThisPageBtn.disabled = false;
    }
  }

  async function exportSearchablePdf() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.info('Silakan buka dokumen PDF terlebih dahulu.');
      }
      return;
    }

    const startSearchablePdfBtn = document.getElementById('startSearchablePdfBtn');
    const ocrLangSelect = document.getElementById('ocrLangSelect');

    if (startSearchablePdfBtn) {
      startSearchablePdfBtn.disabled = true;
      startSearchablePdfBtn.textContent = 'Menyimpan Searchable PDF...';
    }

    try {
      // If current page doesn't have OCR yet, run OCR on it first
      const currentAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
      if (!currentAnn.ocrWords || currentAnn.ocrWords.length === 0) {
        if (startSearchablePdfBtn) startSearchablePdfBtn.textContent = 'Menjalankan OCR halaman...';
        const lang = ocrLangSelect ? ocrLangSelect.value : 'eng';
        const ocrRenderScale = 2.0;
        const tempCanvas = document.createElement('canvas');
        await window.PDFTools.Studio.renderPage(currentDoc, currentDoc.currentPage, tempCanvas, ocrRenderScale);
        const ocrData = await window.PDFTools.OCR.recognizeCanvas(tempCanvas, lang);
        currentAnn.ocrText = (ocrData.text || '').trim();
        currentAnn.ocrWords = (ocrData.words || []).map(w => ({
          text: w.text,
          confidence: w.confidence,
          x: (w.bbox.x0 || 0) / ocrRenderScale,
          y: (w.bbox.y0 || 0) / ocrRenderScale,
          width: ((w.bbox.x1 || 0) - (w.bbox.x0 || 0)) / ocrRenderScale,
          height: ((w.bbox.y1 || 0) - (w.bbox.y0 || 0)) / ocrRenderScale
        }));
        if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(true);
      }

      // Export document with embedded invisible searchable text layer
      const exportedBytes = await window.PDFTools.Studio.exportDocument(currentDoc, (p) => {
        if (startSearchablePdfBtn) startSearchablePdfBtn.textContent = `Menyimpan ${p}%...`;
      });

      const baseName = (currentDoc.fileName || 'document').replace(/\.pdf$/i, '');
      const finalName = `${baseName}_searchable.pdf`;
      window.PDFTools.Download.save(exportedBytes, finalName);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success(`Searchable PDF berhasil diunduh: "${finalName}"`);
      }
    } catch (err) {
      console.error('Searchable PDF Error:', err);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.error(err.message || 'Gagal membuat Searchable PDF.');
      }
    } finally {
      if (startSearchablePdfBtn) {
        startSearchablePdfBtn.disabled = false;
        startSearchablePdfBtn.innerHTML = '<svg class="btn-svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg> Unduh Searchable PDF';
      }
    }
  }

  function copyOcrText() {
    const ocrOutputBox = document.getElementById('ocrOutputBox');
    if (ocrOutputBox && ocrOutputBox.value) {
      navigator.clipboard.writeText(ocrOutputBox.value);
      if (window.PDFTools && window.PDFTools.Toast) {
        window.PDFTools.Toast.success('OCR text copied to clipboard!');
      }
    }
  }

  function pasteOcrText() {
    const ocrOutputBox = document.getElementById('ocrOutputBox');
    const currentDoc = getDoc();
    if (!ocrOutputBox || !ocrOutputBox.value || !currentDoc) return;

    const pageAnn = currentDoc.getPageAnnotation(currentDoc.currentPage);
    const newText = {
      id: 'text_ocr_' + Date.now(),
      text: ocrOutputBox.value,
      x: 40,
      y: 40,
      fontSize: 14,
      fontFamily: 'Helvetica',
      bold: false,
      italic: false,
      color: '#000000'
    };
    pageAnn.texts.push(newText);
    if (ctx && ctx.undoStack) {
      ctx.undoStack.push({ pageNum: currentDoc.currentPage, type: 'text', item: newText });
    }
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
    if (ctx && ctx.renderActivePageWidgets) ctx.renderActivePageWidgets();
    if (window.PDFTools && window.PDFTools.Toast) {
      window.PDFTools.Toast.success('OCR text placed on page!');
    }
  }

  // --- Event Listeners Binding ---

  function bindEventListeners() {
    const menuFind = document.getElementById('menuFind');
    const toolbarFindBtn = document.getElementById('toolbarFindBtn');
    const paneFindText = document.getElementById('paneFindText');
    const findCloseBtn = document.getElementById('findCloseBtn');
    const findClearBtn = document.getElementById('findClearBtn');
    const findMatchCaseBtn = document.getElementById('findMatchCaseBtn');
    const findWholeWordBtn = document.getElementById('findWholeWordBtn');
    const findInput = document.getElementById('findTextInput');
    const findNextBtn = document.getElementById('findNextBtn');
    const findPrevBtn = document.getElementById('findPrevBtn');

    if (menuFind) menuFind.addEventListener('click', toggleFindBar);
    if (toolbarFindBtn) toolbarFindBtn.addEventListener('click', toggleFindBar);
    if (paneFindText) paneFindText.addEventListener('click', toggleFindBar);
    if (findCloseBtn) findCloseBtn.addEventListener('click', closeFindBar);

    if (findClearBtn) {
      findClearBtn.addEventListener('click', () => {
        if (findInput) {
          findInput.value = '';
          findInput.focus();
        }
        findClearBtn.style.display = 'none';
        searchQuery = '';
        searchMatches = [];
        currentMatchIdx = -1;
        const findMatchesLabel = document.getElementById('findMatchesLabel');
        if (findMatchesLabel) findMatchesLabel.textContent = '0/0';
        clearSearchHighlights();
      });
    }

    if (findMatchCaseBtn) {
      findMatchCaseBtn.addEventListener('click', () => {
        matchCase = !matchCase;
        findMatchCaseBtn.classList.toggle('active', matchCase);
        executeSearch();
      });
    }

    if (findWholeWordBtn) {
      findWholeWordBtn.addEventListener('click', () => {
        wholeWord = !wholeWord;
        findWholeWordBtn.classList.toggle('active', wholeWord);
        executeSearch();
      });
    }

    if (findInput) {
      findInput.addEventListener('input', () => {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(executeSearch, 120);
      });

      findInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          selectSearchMatch(currentMatchIdx + (e.shiftKey ? -1 : 1));
        } else if (e.key === 'Escape') {
          closeFindBar();
        }
      });
    }

    if (findNextBtn) {
      findNextBtn.addEventListener('click', async () => {
        const val = findInput ? findInput.value.trim() : '';
        if (searchMatches.length === 0 && val.length > 0) {
          await executeSearch();
        } else {
          await selectSearchMatch(currentMatchIdx + 1);
        }
      });
    }

    if (findPrevBtn) {
      findPrevBtn.addEventListener('click', async () => {
        const val = findInput ? findInput.value.trim() : '';
        if (searchMatches.length === 0 && val.length > 0) {
          await executeSearch();
        } else {
          await selectSearchMatch(currentMatchIdx - 1);
        }
      });
    }

    // OCR Elements
    const toolOcr = document.getElementById('toolOcr');
    const paneScanOcr = document.getElementById('paneScanOcr');
    const closeOcrBtn = document.getElementById('closeOcrBtn');
    const startOcrThisPageBtn = document.getElementById('startOcrThisPageBtn');
    const startOcrAllPagesBtn = document.getElementById('startOcrAllPagesBtn');
    const startSearchablePdfBtn = document.getElementById('startSearchablePdfBtn');
    const copyOcrBtn = document.getElementById('copyOcrBtn');
    const pasteOcrBtn = document.getElementById('pasteOcrBtn');

    if (toolOcr) toolOcr.addEventListener('click', () => toggleOcrDrawer());
    if (paneScanOcr) paneScanOcr.addEventListener('click', () => toggleOcrDrawer());
    if (closeOcrBtn) closeOcrBtn.addEventListener('click', () => toggleOcrDrawer(false));

    if (startOcrThisPageBtn) startOcrThisPageBtn.addEventListener('click', ocrThisPage);
    if (startOcrAllPagesBtn) startOcrAllPagesBtn.addEventListener('click', ocrAllPages);
    if (startSearchablePdfBtn) startSearchablePdfBtn.addEventListener('click', exportSearchablePdf);
    if (copyOcrBtn) copyOcrBtn.addEventListener('click', copyOcrText);
    if (pasteOcrBtn) pasteOcrBtn.addEventListener('click', pasteOcrText);
  }

  return {
    init,
    toggleFindBar,
    closeFindBar,
    executeSearch,
    selectSearchMatch,
    getSearchMatches,
    getCurrentMatchIdx,
    getSearchQuery,
    resetSearchState,
    renderSinglePageSearchHighlights,
    renderContinuousSearchHighlights,
    clearSearchHighlights,
    scrollToActiveMatchSingle,
    scrollToActiveMatchContinuous,
    toggleOcrDrawer,
    ocrThisPage,
    ocrAllPages,
    exportSearchablePdf
  };
})();
