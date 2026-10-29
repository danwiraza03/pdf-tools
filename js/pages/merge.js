/**
 * PDF Tools — Merge Standalone Page Controller
 * Extracted from pages/merge.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
      const dropzoneEl = document.getElementById('dropzone');
      const organizerArea = document.getElementById('organizerArea');
      const mergeDragOverlay = document.getElementById('mergeDragOverlay');
      const mergePageGrid = document.getElementById('mergePageGrid');
      const organizerCount = document.getElementById('organizerCount');
      const addMoreFilesBtn = document.getElementById('addMoreFilesBtn');
      const extraFileInput = document.getElementById('extraFileInput');
      const expandAllBtn = document.getElementById('expandAllBtn');
      const collapseAllBtn = document.getElementById('collapseAllBtn');
      const rotateAllBtn = document.getElementById('rotateAllBtn');
      const undoBtn = document.getElementById('undoBtn');
      const redoBtn = document.getElementById('redoBtn');
      const resetOrderBtn = document.getElementById('resetOrderBtn');
      const clearAllPagesBtn = document.getElementById('clearAllPagesBtn');
      const selectionBar = document.getElementById('selectionBar');
      const selectionCountBadge = document.getElementById('selectionCountBadge');
      const extractSelectedBtn = document.getElementById('extractSelectedBtn');
      const rotateSelectedBtn = document.getElementById('rotateSelectedBtn');
      const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
      const deselectAllBtn = document.getElementById('deselectAllBtn');
      const actionBar = document.getElementById('actionBar');
      const mergeBtn = document.getElementById('mergeBtn');
      const resultArea = document.getElementById('resultArea');
      const downloadBtn = document.getElementById('downloadBtn');
      const resetBtn = document.getElementById('resetBtn');

      // Modal Elements
      const previewModal = document.getElementById('previewModal');
      const modalFileName = document.getElementById('modalFileName');
      const modalPageBadge = document.getElementById('modalPageBadge');
      const modalRotateBtn = document.getElementById('modalRotateBtn');
      const modalCloseBtn = document.getElementById('modalCloseBtn');
      const modalPrevBtn = document.getElementById('modalPrevBtn');
      const modalNextBtn = document.getElementById('modalNextBtn');
      const modalCanvas = document.getElementById('modalCanvas');

      const progress = PDFTools.Progress('progressBar');
      let mergedData = null;

      // State
      let allUploadedFiles = []; // File references
      let pageItemsMap = new Map(); // id -> item descriptor
      let deletedItemsCache = new Map(); // id -> item descriptor (for undo recovery)
      let fileGroups = []; // Array of { id, fileIndex, fileName, colorTheme, isExpanded, pageIds: [] }
      let initialSnapshot = []; // Snapshot of initial files & pageIds for "Reset Order"
      let selectedPageIds = new Set();
      let gridSortable = null;
      let pageSortables = [];
      let pdfDocRefs = new Set();
      let thumbnailObserver = null;
      let isDraggingCard = false;

      // Undo / Redo History Stack (Item 2)
      const MAX_HISTORY = 25;
      let historyStack = [];
      let historyIndex = -1;
      let isHistoryAction = false;

      function snapshotState() {
        return {
          fileGroups: fileGroups.map(g => ({
            id: g.id,
            fileIndex: g.fileIndex,
            fileName: g.fileName,
            colorTheme: { ...g.colorTheme },
            isExpanded: g.isExpanded,
            pageIds: [...g.pageIds]
          })),
          itemRotations: Array.from(pageItemsMap.entries()).map(([id, item]) => [id, item.rotation]),
          selectedIds: Array.from(selectedPageIds)
        };
      }

      function pushHistoryState(actionLabel = '') {
        if (isHistoryAction) return;

        if (historyIndex < historyStack.length - 1) {
          historyStack = historyStack.slice(0, historyIndex + 1);
        }

        historyStack.push({
          state: snapshotState(),
          label: actionLabel
        });

        if (historyStack.length > MAX_HISTORY) {
          historyStack.shift();
        } else {
          historyIndex++;
        }

        updateHistoryButtonsUI();
      }

      function restoreHistoryState(snapshot) {
        if (!snapshot) return;
        isHistoryAction = true;

        fileGroups = snapshot.fileGroups.map(g => ({
          id: g.id,
          fileIndex: g.fileIndex,
          fileName: g.fileName,
          colorTheme: { ...g.colorTheme },
          isExpanded: g.isExpanded,
          pageIds: [...g.pageIds]
        }));

        // Revive any deleted items back to pageItemsMap for seamless undo
        fileGroups.forEach(g => {
          g.pageIds.forEach(id => {
            if (!pageItemsMap.has(id) && deletedItemsCache.has(id)) {
              pageItemsMap.set(id, deletedItemsCache.get(id));
            }
          });
        });

        if (snapshot.itemRotations) {
          snapshot.itemRotations.forEach(([id, rot]) => {
            const item = pageItemsMap.get(id);
            if (item) item.rotation = rot;
          });
        }

        selectedPageIds = new Set(snapshot.selectedIds || []);

        buildGrid();
        updateHistoryButtonsUI();

        isHistoryAction = false;
      }

      function undo() {
        if (historyIndex > 0) {
          historyIndex--;
          restoreHistoryState(historyStack[historyIndex].state);
          const isId = (PDFTools.i18n && PDFTools.i18n.getCurrentLang && PDFTools.i18n.getCurrentLang() === 'id');
          PDFTools.Toast.info(isId ? 'Aksi dibatalkan (Undo)' : 'Action undone');
        }
      }

      function redo() {
        if (historyIndex < historyStack.length - 1) {
          historyIndex++;
          restoreHistoryState(historyStack[historyIndex].state);
          const isId = (PDFTools.i18n && PDFTools.i18n.getCurrentLang && PDFTools.i18n.getCurrentLang() === 'id');
          PDFTools.Toast.info(isId ? 'Aksi diulang (Redo)' : 'Action redone');
        }
      }

      function updateHistoryButtonsUI() {
        if (undoBtn) undoBtn.disabled = (historyIndex <= 0);
        if (redoBtn) redoBtn.disabled = (historyIndex >= historyStack.length - 1);
      }

      if (undoBtn) undoBtn.addEventListener('click', undo);
      if (redoBtn) redoBtn.addEventListener('click', redo);

      let modalState = {
        pages: [],
        currentIndex: 0,
        rotation: 0
      };

      // IntersectionObserver for lazy thumbnail rendering with instant cache blit (Item 1)
      if ('IntersectionObserver' in window) {
        thumbnailObserver = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              const el = entry.target;
              const canvas = el.querySelector('canvas');
              const itemId = el.getAttribute('data-id');
              const groupId = el.getAttribute('data-group-id');

              if (canvas && !canvas.dataset.rendered) {
                canvas.dataset.rendered = 'true';
                if (itemId) {
                  const item = pageItemsMap.get(itemId);
                  if (item) renderThumbnail(item.pdfDocRef, item.pageIndex + 1, canvas, item.rotation, item);
                } else if (groupId) {
                  // Stacked card: render first page in its current pageIds list
                  const group = fileGroups.find(g => g.id === groupId);
                  if (group && group.pageIds.length > 0) {
                    const firstItem = pageItemsMap.get(group.pageIds[0]);
                    if (firstItem) renderThumbnail(firstItem.pdfDocRef, firstItem.pageIndex + 1, canvas, firstItem.rotation, firstItem);
                  }
                }
              }
              thumbnailObserver.unobserve(el);
            }
          });
        }, { rootMargin: '140px' });
      }

      function destroyAllPdfDocs() {
        pdfDocRefs.forEach(function (doc) {
          try { if (doc && doc.destroy) doc.destroy(); } catch (e) {}
        });
        pdfDocRefs.clear();
      }

      // Memory Management: Clean up any orphaned PDF.js documents (Item 5)
      function cleanupOrphanedPdfDocs() {
        const activeDocs = new Set();
        pageItemsMap.forEach(item => {
          if (item && item.pdfDocRef) activeDocs.add(item.pdfDocRef);
        });

        pdfDocRefs.forEach(doc => {
          if (!activeDocs.has(doc)) {
            try {
              if (doc && doc.destroy) doc.destroy();
            } catch (e) {}
            pdfDocRefs.delete(doc);
          }
        });
      }

      const docColorThemes = [
        { dot: '#3B82F6', bg: 'rgba(59, 130, 246, 0.15)', text: '#3B82F6' },
        { dot: '#10B981', bg: 'rgba(16, 185, 129, 0.15)', text: '#10B981' },
        { dot: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.15)', text: '#8B5CF6' },
        { dot: '#F59E0B', bg: 'rgba(245, 158, 11, 0.15)', text: '#F59E0B' },
        { dot: '#EC4899', bg: 'rgba(236, 72, 153, 0.15)', text: '#EC4899' },
        { dot: '#06B6D4', bg: 'rgba(6, 182, 212, 0.15)', text: '#06B6D4' }
      ];

      const dropzone = PDFTools.Dropzone('dropzone', {
        accept: '.pdf',
        multiple: true,
        onFiles: async function (files) {
          await handleNewFilesAdded(files);
        }
      });

      addMoreFilesBtn.addEventListener('click', function () {
        extraFileInput.click();
      });

      extraFileInput.addEventListener('change', async function () {
        if (extraFileInput.files && extraFileInput.files.length > 0) {
          await handleNewFilesAdded(Array.from(extraFileInput.files));
          extraFileInput.value = '';
        }
      });

      // ============================================================
      // DRAG & DROP EXTERNAL FILES ON WORKSPACE / OVERLAY
      // ============================================================
      function isExternalFileDrag(e) {
        if (!e.dataTransfer) return false;
        const types = Array.from(e.dataTransfer.types || []);
        return types.includes('Files');
      }

      let workspaceDragCounter = 0;

      window.addEventListener('dragenter', function (e) {
        if (organizerArea.style.display !== 'none' && isExternalFileDrag(e)) {
          e.preventDefault();
          workspaceDragCounter++;
          if (mergeDragOverlay) mergeDragOverlay.style.display = 'flex';
        }
      });

      window.addEventListener('dragover', function (e) {
        if (organizerArea.style.display !== 'none' && isExternalFileDrag(e)) {
          e.preventDefault();
          if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          if (mergeDragOverlay) mergeDragOverlay.style.display = 'flex';
        }
      });

      window.addEventListener('dragleave', function (e) {
        if (organizerArea.style.display !== 'none' && isExternalFileDrag(e)) {
          e.preventDefault();
          workspaceDragCounter--;
          if (workspaceDragCounter <= 0) {
            workspaceDragCounter = 0;
            if (mergeDragOverlay) mergeDragOverlay.style.display = 'none';
          }
        }
      });

      window.addEventListener('drop', async function (e) {
        if (organizerArea.style.display !== 'none' && isExternalFileDrag(e)) {
          e.preventDefault();
          workspaceDragCounter = 0;
          if (mergeDragOverlay) mergeDragOverlay.style.display = 'none';
          const dt = e.dataTransfer;
          if (!dt) return;
          const droppedFiles = Array.from(dt.files || []).filter(function (f) {
            return f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
          });
          if (droppedFiles.length > 0) {
            await handleNewFilesAdded(droppedFiles);
          } else if ((dt.files || []).length > 0) {
            PDFTools.Toast.error(PDFTools.i18n.t('error.unsupported_format', 'Please drop PDF files (.pdf)'));
          }
        }
      });

      // ============================================================
      // FILE LOADING
      // ============================================================

      async function handleNewFilesAdded(newFiles) {
        if (!newFiles || newFiles.length === 0) return;
        if (PDFTools.FileUtils && PDFTools.FileUtils.initPdfJsWorker) PDFTools.FileUtils.initPdfJsWorker();

        dropzoneEl.style.display = 'none';
        organizerArea.style.display = 'block';
        actionBar.classList.add('active');
        resultArea.classList.remove('active');
        progress.show(PDFTools.i18n.t('action.processing', 'Loading and extracting PDF pages...'));

        const startFileIndex = allUploadedFiles.length;

        const skippedFiles = [];
        for (let f = 0; f < newFiles.length; f++) {
          const file = newFiles[f];
          allUploadedFiles.push(file);
          const currentFileIndex = startFileIndex + f;
          const colorTheme = docColorThemes[currentFileIndex % docColorThemes.length];
          const groupId = 'group_' + currentFileIndex + '_' + Date.now();

          const group = {
            id: groupId,
            fileIndex: currentFileIndex,
            fileName: file.name,
            colorTheme: colorTheme,
            isExpanded: false, // Collapsed by default matching reference design
            pageIds: []
          };

          try {
            const decryptedDoc = await PDFTools.FileUtils.loadPdfDecrypted(file);
            const decryptedBytes = await decryptedDoc.save();
            const loadingTask = pdfjsLib.getDocument({ data: decryptedBytes });
            const pdfDoc = await loadingTask.promise;
            const totalPages = pdfDoc.numPages;

            for (let p = 1; p <= totalPages; p++) {
              const pageId = 'page_' + currentFileIndex + '_' + p + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
              const item = {
                id: pageId,
                file: file,
                fileName: file.name,
                originalFileIndex: currentFileIndex,
                originalPage: p, // Original page number in source file
                pageIndex: p - 1, // 0-indexed for pdf-lib
                rotation: 0,
                colorTheme: colorTheme,
                pdfDocRef: pdfDoc,
                decryptedDoc: decryptedDoc
              };
              pdfDocRefs.add(pdfDoc);
              pageItemsMap.set(pageId, item);
              group.pageIds.push(pageId);
            }

            fileGroups.push(group);
          } catch (err) {
            console.error('Error loading PDF file:', file.name, err);
            const idx = allUploadedFiles.indexOf(file);
            if (idx !== -1) allUploadedFiles.splice(idx, 1);

            if (err && err.code === 'PASSWORD_CANCELLED') {
              skippedFiles.push(file.name);
            } else {
              PDFTools.Toast.error(`Failed to load ${file.name}`);
            }
          }
        }

        // Save initial snapshot for "Reset Order"
        saveInitialSnapshot();

        progress.hide();
        clearSelection();
        buildGrid();
        if (skippedFiles.length > 0) {
          PDFTools.Toast.info(`${skippedFiles.length} file(s) skipped: ${skippedFiles.join(', ')}`);
        } else if (newFiles.length > 0 && fileGroups.length > 0) {
          PDFTools.Toast.success(`${newFiles.length} file(s) loaded!`);
        }
      }

      function saveInitialSnapshot() {
        initialSnapshot = fileGroups.map(g => ({
          id: g.id,
          fileIndex: g.fileIndex,
          fileName: g.fileName,
          colorTheme: g.colorTheme,
          pageIds: [...g.pageIds]
        }));
      }

      // ============================================================
      // ORDERED PAGES & NEW SEQUENCE CALCULATION
      // ============================================================

      function getOrderedPages() {
        const list = [];
        fileGroups.forEach(group => {
          group.pageIds.forEach(id => {
            const item = pageItemsMap.get(id);
            if (item) list.push({ item, group });
          });
        });
        return list;
      }

      function getGlobalPageIndex(pageId) {
        let idx = 0;
        for (let g = 0; g < fileGroups.length; g++) {
          const pIds = fileGroups[g].pageIds;
          for (let p = 0; p < pIds.length; p++) {
            idx++;
            if (pIds[p] === pageId) return idx;
          }
        }
        return 0;
      }

      function updateGlobalSequenceUI() {
        const ordered = getOrderedPages();
        const total = ordered.length;

        // Update all page cards currently in DOM
        ordered.forEach((entry, i) => {
          const newNum = i + 1;
          const card = mergePageGrid.querySelector(`.merge-page-card[data-id="${entry.item.id}"]`);
          if (card) {
            const badgeNew = card.querySelector('.merge-badge-new');
            if (badgeNew) badgeNew.textContent = `New #${newNum}`;
          }
        });

        // Update all group headers and stacked cards range badges
        let runningCount = 0;
        fileGroups.forEach((group, gIdx) => {
          const gCount = group.pageIds.length;
          const startNum = gCount > 0 ? runningCount + 1 : 0;
          const endNum = runningCount + gCount;
          runningCount += gCount;

          // If group is expanded: update header badge
          const wrap = mergePageGrid.querySelector(`.merge-file-group-wrap[data-group-id="${group.id}"]`);
          if (wrap) {
            const rangeBadge = wrap.querySelector('.merge-group-badge-new-range');
            if (rangeBadge) {
              rangeBadge.textContent = gCount > 0 ? `New #${startNum}–#${endNum}` : 'Empty';
            }
            const countBadge = wrap.querySelector('.merge-group-count-badge');
            if (countBadge) {
              countBadge.textContent = `${gCount} ${PDFTools.i18n.t('merge.pages_count', 'pages')}`;
            }
          }

          // If group is collapsed: update stacked card range badge
          const stackedCard = mergePageGrid.querySelector(`.merge-page-card.stacked-doc[data-group-id="${group.id}"]`);
          if (stackedCard) {
            const badge = stackedCard.querySelector('.merge-collapsed-badge');
            if (badge) {
              badge.innerHTML = `
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                ${gCount} ${PDFTools.i18n.t('merge.pages_count', 'pages')}
                <span class="merge-stacked-range">${gCount > 0 ? `New #${startNum}–#${endNum}` : ''}</span>
              `;
            }
          }
        });

        organizerCount.textContent = `${total} Pages from ${fileGroups.length} Files`;
        mergeBtn.disabled = (total === 0);
      }

      // ============================================================
      // IN-GRID "+ ADD MORE FILES" DROP CARD
      // ============================================================
      function createAddMoreDropCard() {
        const card = document.createElement('div');
        card.className = 'merge-add-drop-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.title = PDFTools.i18n.t('action.add_more', 'Add More Files');

        card.innerHTML = `
          <div class="merge-add-drop-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
          </div>
          <div class="merge-add-drop-title">${PDFTools.i18n.t('merge.add_card_title', 'Add More Files')}</div>
          <div class="merge-add-drop-hint">${PDFTools.i18n.t('merge.add_card_hint', 'Drop PDF here or click to browse')}</div>
        `;

        card.addEventListener('click', function () {
          extraFileInput.click();
        });

        card.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            extraFileInput.click();
          }
        });

        let cardDragCount = 0;
        card.addEventListener('dragenter', function (e) {
          if (isExternalFileDrag(e)) {
            e.preventDefault();
            e.stopPropagation();
            cardDragCount++;
            card.classList.add('drag-over');
          }
        });

        card.addEventListener('dragover', function (e) {
          if (isExternalFileDrag(e)) {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
            card.classList.add('drag-over');
          }
        });

        card.addEventListener('dragleave', function (e) {
          if (isExternalFileDrag(e)) {
            e.preventDefault();
            e.stopPropagation();
            cardDragCount--;
            if (cardDragCount <= 0) {
              cardDragCount = 0;
              card.classList.remove('drag-over');
            }
          }
        });

        card.addEventListener('drop', async function (e) {
          if (isExternalFileDrag(e)) {
            e.preventDefault();
            e.stopPropagation();
            cardDragCount = 0;
            card.classList.remove('drag-over');
            const dt = e.dataTransfer;
            if (!dt) return;
            const droppedFiles = Array.from(dt.files || []).filter(function (f) {
              return f.name.toLowerCase().endsWith('.pdf') || f.type === 'application/pdf';
            });
            if (droppedFiles.length > 0) {
              await handleNewFilesAdded(droppedFiles);
            } else if ((dt.files || []).length > 0) {
              PDFTools.Toast.error(PDFTools.i18n.t('error.unsupported_format', 'Please drop PDF files (.pdf)'));
            }
          }
        });

        return card;
      }

      // ============================================================
      // GRID BUILDER
      // ============================================================

      function buildGrid() {
        destroySortables();
        mergePageGrid.innerHTML = '';

        if (fileGroups.length === 0 || pageItemsMap.size === 0) {
          mergePageGrid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-secondary);">No pages remaining. Add more files or start over.</div>';
          updateGlobalSequenceUI();
          return;
        }

        fileGroups.forEach((group, gIdx) => {
          if (group.isExpanded) {
            // Expanded: render full file section with its inner page grid
            const groupWrap = createExpandedGroupWrap(group, gIdx);
            mergePageGrid.appendChild(groupWrap);
          } else {
            // Collapsed: render stacked document card matching reference design
            const stackedCard = createStackedDocCard(group, gIdx);
            mergePageGrid.appendChild(stackedCard);
            if (thumbnailObserver) thumbnailObserver.observe(stackedCard);
          }
        });

        // Append visual "+ Add More Files" drop-card at the end of the grid
        mergePageGrid.appendChild(createAddMoreDropCard());

        initSortables();
        updateGlobalSequenceUI();
        updateSelectionUI();
      }

      // ============================================================
      // INLINE RENAME HELPER (Item 3)
      // ============================================================

      function attachInlineRename(titleEl, group, onSave) {
        const editBtn = document.createElement('button');
        editBtn.type = 'button';
        editBtn.className = 'merge-title-edit-btn';
        editBtn.title = PDFTools.i18n.t('merge.rename_file', 'Rename File');
        editBtn.innerHTML = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>';

        function startEditing(e) {
          if (e) e.stopPropagation();
          const currentName = group.fileName;
          const input = document.createElement('input');
          input.type = 'text';
          input.className = 'merge-title-edit-input';
          input.value = currentName;

          const parent = titleEl.parentNode;
          parent.replaceChild(input, titleEl);
          input.focus();
          input.select();

          let finished = false;

          function finish(save) {
            if (finished) return;
            finished = true;
            if (save) {
              const newName = input.value.trim() || currentName;
              if (newName !== group.fileName) {
                pushHistoryState('Rename File');
                group.fileName = newName;
              }
            }
            if (parent.contains(input)) {
              parent.replaceChild(titleEl, input);
            }
            if (onSave) onSave(group.fileName);
          }

          input.addEventListener('keydown', function (evt) {
            evt.stopPropagation();
            if (evt.key === 'Enter') finish(true);
            else if (evt.key === 'Escape') finish(false);
          });

          input.addEventListener('blur', function () {
            finish(true);
          });

          input.addEventListener('click', function (evt) {
            evt.stopPropagation();
          });
        }

        editBtn.addEventListener('click', startEditing);
        titleEl.addEventListener('dblclick', startEditing);

        return editBtn;
      }

      // ============================================================
      // STACKED DOCUMENT CARD (Collapsed State)
      // ============================================================

      function createStackedDocCard(group, displayIdx) {
        const firstItemId = group.pageIds[0];
        const firstItem = pageItemsMap.get(firstItemId) || { fileName: group.fileName, colorTheme: group.colorTheme, rotation: 0 };

        const card = document.createElement('div');
        card.className = 'merge-page-card stacked-doc';
        card.setAttribute('data-group-id', group.id);
        card.setAttribute('data-type', 'stacked');

        const allSel = group.pageIds.length > 0 && group.pageIds.every(id => selectedPageIds.has(id));
        if (allSel) card.classList.add('selected');

        // Color indicator bar on left edge
        const colorBar = document.createElement('div');
        colorBar.className = 'merge-file-color-bar';
        colorBar.style.background = group.colorTheme.dot;

        // Page count badge & New Pages range (top-left)
        const badge = document.createElement('div');
        badge.className = 'merge-collapsed-badge';
        badge.innerHTML = `
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${group.pageIds.length} ${PDFTools.i18n.t('merge.pages_count', 'pages')}
          <span class="merge-stacked-range"></span>
        `;

        // Preview thumbnail of first page in this group
        const preview = document.createElement('div');
        preview.className = 'merge-card-preview';
        const canvas = document.createElement('canvas');
        preview.appendChild(canvas);

        // Checkmark indicator for Ctrl+Click selection
        const check = document.createElement('div');
        check.className = 'merge-card-select-check';
        check.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

        // Footer: Formatted title below card matching screenshot e.g. "0. 0072.SPK ....pdf" with inline rename
        const footer = document.createElement('div');
        footer.className = 'merge-card-title-footer';

        const titleWrap = document.createElement('div');
        titleWrap.className = 'merge-title-wrap';

        const titleText = document.createElement('div');
        titleText.className = 'merge-card-title-text';
        function updateStackedTitleDisplay(name) {
          const truncated = name.length > 18 ? name.substring(0, 16) + '…' : name;
          titleText.textContent = `${displayIdx}. ${truncated}`;
          titleText.title = name;
        }
        updateStackedTitleDisplay(group.fileName);

        const editBtn = attachInlineRename(titleText, group, function (newName) {
          updateStackedTitleDisplay(newName);
        });

        titleWrap.appendChild(titleText);
        titleWrap.appendChild(editBtn);
        footer.appendChild(titleWrap);

        // Floating Action Pill on the right side
        const floatingPill = document.createElement('div');
        floatingPill.className = 'merge-floating-pill';

        // 1. Expand Button (<-> inside circle matching screenshot) with Tooltip
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'merge-pill-btn expand-btn';
        expandBtn.title = `${PDFTools.i18n.t('merge.expand_file', 'Expand')} ${group.pageIds.length} ${PDFTools.i18n.t('merge.pages_count', 'pages')}`;
        expandBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="9"/>
            <polyline points="9 9.5 6.5 12 9 14.5"/>
            <polyline points="15 9.5 17.5 12 15 14.5"/>
            <line x1="6.5" y1="12" x2="17.5" y2="12"/>
          </svg>
          <span class="merge-pill-tooltip">${PDFTools.i18n.t('merge.expand_file', 'Expand')} ${group.pageIds.length} ${PDFTools.i18n.t('merge.pages_count', 'pages')}</span>
        `;
        expandBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          syncAllGroupsFromDom();
          group.isExpanded = true;
          buildGrid();
        });

        // 2. Trash Button (Remove Group) matching screenshot
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'merge-pill-btn delete-btn';
        deleteBtn.title = PDFTools.i18n.t('merge.delete_group', 'Remove File');
        deleteBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
          <span class="merge-pill-tooltip">${PDFTools.i18n.t('merge.delete_group', 'Remove File')}</span>
        `;
        deleteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteGroup(group.id);
        });

        // 3. Zoom / Quick Preview Button (+) matching screenshot
        const zoomBtn = document.createElement('button');
        zoomBtn.type = 'button';
        zoomBtn.className = 'merge-pill-btn zoom-btn';
        zoomBtn.title = PDFTools.i18n.t('merge.preview_file', 'Quick Preview');
        zoomBtn.innerHTML = `
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            <line x1="11" y1="8" x2="11" y2="14"/>
            <line x1="8" y1="11" x2="14" y2="11"/>
          </svg>
          <span class="merge-pill-tooltip">${PDFTools.i18n.t('merge.preview_file', 'Quick Preview')}</span>
        `;
        zoomBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          const items = group.pageIds.map(id => pageItemsMap.get(id)).filter(Boolean);
          openPreviewModal(items, 0);
        });

        floatingPill.appendChild(expandBtn);
        floatingPill.appendChild(deleteBtn);
        floatingPill.appendChild(zoomBtn);

        // Drag handle for touch & visual dragging
        const dragHandle = document.createElement('div');
        dragHandle.className = 'stacked-doc-handle';
        dragHandle.title = 'Drag to reorder file';
        dragHandle.setAttribute('aria-label', 'Drag to reorder file');
        dragHandle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';

        card.appendChild(colorBar);
        card.appendChild(badge);
        card.appendChild(preview);
        card.appendChild(check);
        card.appendChild(dragHandle);
        card.appendChild(footer);
        card.appendChild(floatingPill);

        // Click handler: Ctrl+Click toggles multi-select; normal click expands
        card.addEventListener('click', function (e) {
          if (isDraggingCard) return;
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            const shouldSel = !allSel;
            group.pageIds.forEach(id => {
              if (shouldSel) selectedPageIds.add(id);
              else selectedPageIds.delete(id);
            });
            updateSelectionUI();
            card.classList.toggle('selected', shouldSel);
          } else {
            syncAllGroupsFromDom();
            group.isExpanded = true;
            buildGrid();
          }
        });

        return card;
      }

      // ============================================================
      // EXPANDED GROUP SECTION
      // ============================================================

      function createExpandedGroupWrap(group, displayIdx) {
        const wrap = document.createElement('div');
        wrap.className = 'merge-file-group-wrap';
        wrap.setAttribute('data-group-id', group.id);

        // --- Header Bar ---
        const header = document.createElement('div');
        header.className = 'merge-file-group-header';

        const left = document.createElement('div');
        left.className = 'merge-group-header-left';

        // Drag handle to reorder the entire file group
        const handle = document.createElement('div');
        handle.className = 'merge-group-drag-handle';
        handle.title = 'Drag to reorder file';
        handle.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';

        // Color dot
        const dot = document.createElement('div');
        dot.style.width = '10px';
        dot.style.height = '10px';
        dot.style.borderRadius = '50%';
        dot.style.background = group.colorTheme.dot;

        // Title with inline rename
        const titleWrap = document.createElement('div');
        titleWrap.className = 'merge-title-wrap';

        const title = document.createElement('div');
        title.className = 'merge-group-title';
        function updateGroupTitleDisplay(name) {
          title.textContent = `${displayIdx}. ${name}`;
          title.title = name;
        }
        updateGroupTitleDisplay(group.fileName);

        const editBtn = attachInlineRename(title, group, function (newName) {
          updateGroupTitleDisplay(newName);
        });

        titleWrap.appendChild(title);
        titleWrap.appendChild(editBtn);

        // New pages range badge
        const rangeBadge = document.createElement('span');
        rangeBadge.className = 'merge-group-badge-new-range';
        rangeBadge.textContent = 'New Pages';

        // Count badge
        const countBadge = document.createElement('span');
        countBadge.className = 'merge-group-count-badge';
        countBadge.textContent = `${group.pageIds.length} ${PDFTools.i18n.t('merge.pages_count', 'pages')}`;

        // Collapse toggle chevron / icon on left
        const toggleIcon = document.createElement('button');
        toggleIcon.type = 'button';
        toggleIcon.className = 'merge-group-toggle-icon-btn';
        toggleIcon.title = PDFTools.i18n.t('merge.collapse_file', 'Collapse Pages');
        toggleIcon.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="14" y1="10" x2="21" y2="3"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
        toggleIcon.addEventListener('click', function (e) {
          e.stopPropagation();
          syncAllGroupsFromDom();
          group.isExpanded = false;
          buildGrid();
        });

        left.appendChild(handle);
        left.appendChild(toggleIcon);
        left.appendChild(dot);
        left.appendChild(titleWrap);
        left.appendChild(rangeBadge);
        left.appendChild(countBadge);

        // Actions on right of group header
        const actions = document.createElement('div');
        actions.className = 'merge-group-header-actions';

        // Collapse button
        const collapseBtn = document.createElement('button');
        collapseBtn.type = 'button';
        collapseBtn.className = 'merge-group-header-btn btn-collapse';
        collapseBtn.title = PDFTools.i18n.t('merge.collapse_file', 'Collapse Pages');
        collapseBtn.innerHTML = `
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="4 14 10 14 10 20"/>
            <polyline points="20 10 14 10 14 4"/>
            <line x1="14" y1="10" x2="21" y2="3"/>
            <line x1="3" y1="21" x2="10" y2="14"/>
          </svg>
          <span>${PDFTools.i18n.t('merge.collapse_file', 'Collapse')}</span>
        `;
        collapseBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          syncAllGroupsFromDom();
          group.isExpanded = false;
          buildGrid();
        });

        // Rotate all in group
        const rotateBtn = document.createElement('button');
        rotateBtn.type = 'button';
        rotateBtn.className = 'merge-group-header-btn';
        rotateBtn.title = PDFTools.i18n.t('merge.rotate_group', 'Rotate File Pages');
        rotateBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';
        rotateBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          group.pageIds.forEach(id => {
            const item = pageItemsMap.get(id);
            if (item) {
              item.rotation = (item.rotation + 90) % 360;
              const card = wrap.querySelector(`.merge-page-card[data-id="${id}"]`);
              if (card) {
                const c = card.querySelector('canvas');
                if (c) c.style.transform = `rotate(${item.rotation}deg)`;
              }
            }
          });
        });

        // Delete group
        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'merge-group-header-btn delete-btn';
        delBtn.title = PDFTools.i18n.t('merge.delete_group', 'Remove File');
        delBtn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
        delBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteGroup(group.id);
        });

        actions.appendChild(collapseBtn);
        actions.appendChild(rotateBtn);
        actions.appendChild(delBtn);

        header.appendChild(left);
        header.appendChild(actions);

        // --- Inner Grid of Pages ---
        const body = document.createElement('div');
        body.className = 'merge-file-group-body';
        body.setAttribute('data-group-id', group.id);

        group.pageIds.forEach(pageId => {
          const item = pageItemsMap.get(pageId);
          if (item) {
            const card = createExpandedPageCard(item, group);
            body.appendChild(card);
            if (thumbnailObserver) thumbnailObserver.observe(card);
          }
        });

        wrap.appendChild(header);
        wrap.appendChild(body);

        return wrap;
      }

      // ============================================================
      // EXPANDED PAGE CARD WITH OLD & NEW PAGE BADGES
      // ============================================================

      function createExpandedPageCard(item, currentGroup) {
        const card = document.createElement('div');
        card.className = 'merge-page-card expanded-page';
        card.setAttribute('data-id', item.id);
        card.setAttribute('data-group-id', currentGroup.id);
        card.setAttribute('data-type', 'page');

        if (selectedPageIds.has(item.id)) {
          card.classList.add('selected');
        }

        // Header with DUAL BADGES (New Page vs Old Page)
        const header = document.createElement('div');
        header.className = 'merge-card-header';

        const badgesWrap = document.createElement('div');
        badgesWrap.className = 'merge-page-badges';

        // NEW PAGE BADGE (e.g. New #1)
        const badgeNew = document.createElement('span');
        badgeNew.className = 'merge-badge-new';
        const globalNum = getGlobalPageIndex(item.id);
        badgeNew.textContent = `New #${globalNum || item.originalPage}`;
        badgeNew.title = 'Urutan halaman baru di dokumen hasil penggabungan';

        // OLD PAGE BADGE (e.g. Old: P.3)
        const badgeOld = document.createElement('span');
        badgeOld.className = 'merge-badge-old';
        badgeOld.textContent = `Old: P.${item.originalPage}`;
        badgeOld.title = `Halaman asal ${item.originalPage} dari ${item.fileName}`;

        badgesWrap.appendChild(badgeNew);
        badgesWrap.appendChild(badgeOld);

        const actions = document.createElement('div');
        actions.className = 'merge-card-header-actions';

        // Rotate single page
        const rotateBtn = document.createElement('button');
        rotateBtn.type = 'button';
        rotateBtn.className = 'merge-card-mini-btn';
        rotateBtn.title = 'Rotate 90°';
        rotateBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';
        rotateBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          item.rotation = (item.rotation + 90) % 360;
          const c = card.querySelector('canvas');
          if (c) c.style.transform = `rotate(${item.rotation}deg)`;
        });

        // Zoom single page
        const zoomBtn = document.createElement('button');
        zoomBtn.type = 'button';
        zoomBtn.className = 'merge-card-mini-btn';
        zoomBtn.title = PDFTools.i18n.t('merge.preview_file', 'Quick Preview');
        zoomBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>';
        zoomBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openPreviewModal([item], 0);
        });

        // Delete single page
        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'merge-card-mini-btn delete-btn';
        deleteBtn.title = 'Delete page';
        deleteBtn.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        deleteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          deleteSinglePage(item.id, currentGroup.id);
        });

        actions.appendChild(rotateBtn);
        actions.appendChild(zoomBtn);
        actions.appendChild(deleteBtn);

        header.appendChild(badgesWrap);
        header.appendChild(actions);

        // Preview canvas
        const preview = document.createElement('div');
        preview.className = 'merge-card-preview';
        const canvas = document.createElement('canvas');
        preview.appendChild(canvas);

        // Checkmark for multi-select
        const check = document.createElement('div');
        check.className = 'merge-card-select-check';
        check.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';

        // Footer: Source document name chip
        const footer = document.createElement('div');
        footer.className = 'merge-card-title-footer';
        const titleText = document.createElement('div');
        titleText.className = 'merge-card-title-text';
        titleText.textContent = item.fileName.length > 18 ? item.fileName.substring(0, 16) + '…' : item.fileName;
        titleText.title = `Source: ${item.fileName} (Original Page ${item.originalPage})`;
        footer.appendChild(titleText);

        // Drag handle for touch & visual dragging
        const dragHandle = document.createElement('div');
        dragHandle.className = 'expanded-page-handle';
        dragHandle.title = 'Drag to reorder page';
        dragHandle.setAttribute('aria-label', 'Drag to reorder page');
        dragHandle.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="5" r="1.5"/><circle cx="15" cy="5" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="19" r="1.5"/><circle cx="15" cy="19" r="1.5"/></svg>';

        card.appendChild(header);
        card.appendChild(preview);
        card.appendChild(check);
        card.appendChild(dragHandle);
        card.appendChild(footer);

        // Click handler: Ctrl+Click toggles multi-select
        card.addEventListener('click', function (e) {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            togglePageSelection(item.id);
          }
        });

        return card;
      }

      function deleteSinglePage(pageId, groupId) {
        const item = pageItemsMap.get(pageId);
        if (item) deletedItemsCache.set(pageId, item);
        selectedPageIds.delete(pageId);
        pageItemsMap.delete(pageId);

        const group = fileGroups.find(g => g.id === groupId);
        if (group) {
          group.pageIds = group.pageIds.filter(id => id !== pageId);
          if (group.pageIds.length === 0) {
            fileGroups = fileGroups.filter(g => g.id !== groupId);
          }
        }

        pushHistoryState('Delete Page');
        buildGrid();
        updateGlobalSequenceUI();
        updateSelectionUI();
        checkEmptyState();
        PDFTools.Toast.info('Page removed');
      }

      function deleteGroup(groupId) {
        const group = fileGroups.find(g => g.id === groupId);
        if (!group) return;

        group.pageIds.forEach(id => {
          const item = pageItemsMap.get(id);
          if (item) deletedItemsCache.set(id, item);
          selectedPageIds.delete(id);
          pageItemsMap.delete(id);
        });

        fileGroups = fileGroups.filter(g => g.id !== groupId);
        pushHistoryState('Delete File');

        buildGrid();
        updateGlobalSequenceUI();
        updateSelectionUI();
        checkEmptyState();
        PDFTools.Toast.info(`Removed ${group.fileName}`);
      }

      // ============================================================
      // THUMBNAIL RENDERING (Item 1: Instant In-Memory Caching)
      // ============================================================

      function renderThumbnail(pdfDoc, pageNum, canvas, rotation = 0, item = null) {
        if (!canvas) return;

        // 1. Instant Cache Path: If item already has cached canvas, blit immediately (0ms)
        if (item && item.cachedCanvas) {
          canvas.width = item.cachedCanvas.width;
          canvas.height = item.cachedCanvas.height;
          if (rotation !== 0) canvas.style.transform = `rotate(${rotation}deg)`;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(item.cachedCanvas, 0, 0);
          return;
        }

        if (!pdfDoc) return;
        pdfDoc.getPage(pageNum).then(function (page) {
          const viewport = page.getViewport({ scale: 0.35 });
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          if (rotation !== 0) canvas.style.transform = `rotate(${rotation}deg)`;
          const ctx = canvas.getContext('2d');
          const renderTask = page.render({ canvasContext: ctx, viewport: viewport });
          renderTask.promise.then(function () {
            if (item) {
              const offscreen = document.createElement('canvas');
              offscreen.width = canvas.width;
              offscreen.height = canvas.height;
              const offCtx = offscreen.getContext('2d');
              offCtx.drawImage(canvas, 0, 0);
              item.cachedCanvas = offscreen;
            }
          }).catch(function () {});
        }).catch(err => console.error('Thumbnail error page', pageNum, err));
      }

      // ============================================================
      // QUICK PREVIEW MODAL
      // ============================================================

      function openPreviewModal(pages, startIndex = 0) {
        if (!pages || pages.length === 0) return;
        modalState.pages = pages;
        modalState.currentIndex = Math.max(0, Math.min(startIndex, pages.length - 1));
        modalState.rotation = modalState.pages[modalState.currentIndex].rotation || 0;

        previewModal.style.display = 'flex';
        renderModalPage();
      }

      function closePreviewModal() {
        previewModal.style.display = 'none';
        modalState.pages = [];
      }

      function renderModalPage() {
        const item = modalState.pages[modalState.currentIndex];
        if (!item) return;

        const globalNum = getGlobalPageIndex(item.id);
        modalFileName.textContent = item.fileName;
        modalPageBadge.textContent = `New Page ${globalNum || item.originalPage} (Original: Page ${item.originalPage})`;

        modalPrevBtn.disabled = (modalState.currentIndex <= 0);
        modalNextBtn.disabled = (modalState.currentIndex >= modalState.pages.length - 1);

        modalCanvas.style.transform = `rotate(${modalState.rotation}deg)`;

        item.pdfDocRef.getPage(item.pageIndex + 1).then(page => {
          const viewport = page.getViewport({ scale: 1.2 });
          modalCanvas.width = viewport.width;
          modalCanvas.height = viewport.height;
          const ctx = modalCanvas.getContext('2d');
          page.render({ canvasContext: ctx, viewport: viewport });
        }).catch(err => console.error('Modal render error:', err));
      }

      modalPrevBtn.addEventListener('click', function () {
        if (modalState.currentIndex > 0) {
          modalState.currentIndex--;
          modalState.rotation = modalState.pages[modalState.currentIndex].rotation || 0;
          renderModalPage();
        }
      });

      modalNextBtn.addEventListener('click', function () {
        if (modalState.currentIndex < modalState.pages.length - 1) {
          modalState.currentIndex++;
          modalState.rotation = modalState.pages[modalState.currentIndex].rotation || 0;
          renderModalPage();
        }
      });

      modalRotateBtn.addEventListener('click', function () {
        modalState.rotation = (modalState.rotation + 90) % 360;
        const currentItem = modalState.pages[modalState.currentIndex];
        if (currentItem) {
          currentItem.rotation = modalState.rotation;
          const card = mergePageGrid.querySelector(`.merge-page-card[data-id="${currentItem.id}"]`);
          if (card) {
            const c = card.querySelector('canvas');
            if (c) c.style.transform = `rotate(${currentItem.rotation}deg)`;
          }
        }
        modalCanvas.style.transform = `rotate(${modalState.rotation}deg)`;
      });

      modalCloseBtn.addEventListener('click', closePreviewModal);

      previewModal.addEventListener('click', function (e) {
        if (e.target === previewModal) closePreviewModal();
      });

      // ============================================================
      // CTRL+CLICK MULTI-SELECT & MULTI-DRAG
      // ============================================================

      function togglePageSelection(pageId) {
        if (selectedPageIds.has(pageId)) {
          selectedPageIds.delete(pageId);
        } else {
          selectedPageIds.add(pageId);
        }
        updateSelectionUI();
      }

      function clearSelection() {
        selectedPageIds.clear();
        updateSelectionUI();
      }

      function updateSelectionUI() {
        const count = selectedPageIds.size;
        selectionCountBadge.textContent = count;

        if (count > 0) {
          selectionBar.classList.add('active');
        } else {
          selectionBar.classList.remove('active');
        }

        // Update card visual states
        mergePageGrid.querySelectorAll('.merge-page-card').forEach(card => {
          const type = card.getAttribute('data-type');
          if (type === 'page') {
            const id = card.getAttribute('data-id');
            card.classList.toggle('selected', selectedPageIds.has(id));
          } else if (type === 'stacked') {
            const gId = card.getAttribute('data-group-id');
            const group = fileGroups.find(g => g.id === gId);
            const allSel = group && group.pageIds.length > 0 && group.pageIds.every(id => selectedPageIds.has(id));
            card.classList.toggle('selected', !!allSel);
          }
        });
      }

      if (extractSelectedBtn) {
        extractSelectedBtn.addEventListener('click', function () {
          if (selectedPageIds.size === 0) return;

          pushHistoryState('Separate to New File');

          const extractedIds = Array.from(selectedPageIds);
          const count = extractedIds.length;

          // Remove extracted IDs from their existing groups
          fileGroups.forEach(g => {
            g.pageIds = g.pageIds.filter(pid => !selectedPageIds.has(pid));
          });

          // Filter out groups with no remaining pages
          fileGroups = fileGroups.filter(g => g.pageIds.length > 0);

          // Get first item to inherit fileName and colorTheme
          const firstItem = pageItemsMap.get(extractedIds[0]);
          const newGroupId = 'group_sep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
          const newColor = firstItem && firstItem.colorTheme
            ? firstItem.colorTheme
            : docColorThemes[fileGroups.length % docColorThemes.length];

          const newGroup = {
            id: newGroupId,
            fileIndex: firstItem ? firstItem.originalFileIndex : (fileGroups.length + 1),
            fileName: firstItem ? firstItem.fileName : 'Separated Document.pdf',
            colorTheme: newColor,
            isExpanded: false, // New collapsed bundle
            pageIds: extractedIds
          };

          fileGroups.push(newGroup);

          clearSelection();
          buildGrid();

          const isId = (PDFTools.i18n && PDFTools.i18n.getCurrentLang && PDFTools.i18n.getCurrentLang() === 'id');
          const msg = isId
            ? `${count} halaman berhasil dipisahkan menjadi berkas baru!`
            : `${count} page(s) successfully separated into a new bundle!`;
          PDFTools.Toast.success(msg);
        });
      }

      rotateSelectedBtn.addEventListener('click', function () {
        if (selectedPageIds.size === 0) return;
        pushHistoryState('Rotate Selected');
        selectedPageIds.forEach(id => {
          const item = pageItemsMap.get(id);
          if (item) {
            item.rotation = (item.rotation + 90) % 360;
            const card = mergePageGrid.querySelector(`.merge-page-card[data-id="${id}"]`);
            if (card) {
              const canvas = card.querySelector('canvas');
              if (canvas) canvas.style.transform = `rotate(${item.rotation}deg)`;
            }
          }
        });
        PDFTools.Toast.success(`Rotated ${selectedPageIds.size} page(s)`);
      });

      deleteSelectedBtn.addEventListener('click', function () {
        if (selectedPageIds.size === 0) return;
        const count = selectedPageIds.size;

        selectedPageIds.forEach(id => {
          const item = pageItemsMap.get(id);
          if (item) deletedItemsCache.set(id, item);
          pageItemsMap.delete(id);
          fileGroups.forEach(g => {
            g.pageIds = g.pageIds.filter(pid => pid !== id);
          });
        });

        fileGroups = fileGroups.filter(g => g.pageIds.length > 0);
        selectedPageIds.clear();

        pushHistoryState('Delete Selected');
        buildGrid();
        updateGlobalSequenceUI();
        updateSelectionUI();
        checkEmptyState();
        PDFTools.Toast.info(`Removed ${count} page(s)`);
      });

      deselectAllBtn.addEventListener('click', clearSelection);

      // Keyboard shortcuts
      document.addEventListener('keydown', function (e) {
        if (previewModal.style.display === 'flex') {
          if (e.key === 'Escape') closePreviewModal();
          else if (e.key === 'ArrowLeft') modalPrevBtn.click();
          else if (e.key === 'ArrowRight') modalNextBtn.click();
          return;
        }

        if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
          e.preventDefault();
          undo();
        } else if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
          e.preventDefault();
          redo();
        } else if (e.key === 'Escape') {
          clearSelection();
        } else if ((e.ctrlKey || e.metaKey) && (e.key === 'a' || e.key === 'A') && organizerArea.style.display !== 'none') {
          e.preventDefault();
          if (selectedPageIds.size === pageItemsMap.size) {
            clearSelection();
          } else {
            pageItemsMap.forEach((_, id) => selectedPageIds.add(id));
            updateSelectionUI();
          }
        }
      });

      // ============================================================
      // SORTABLE.JS DRAG-AND-DROP (PERMANENT NEW LOCATION ASSIGNMENT)
      // ============================================================

      function destroySortables() {
        if (gridSortable) {
          try { gridSortable.destroy(); } catch (e) {}
          gridSortable = null;
        }
        pageSortables.forEach(s => {
          try { s.destroy(); } catch (e) {}
        });
        pageSortables = [];
      }

      function initSortables() {
        destroySortables();

        // Variables shared between gridSortable and pageSortables
        let draggedCard = null;
        let isMultiDragging = false;
        let movingIds = [];

        // 1. Group-level Sortable (allows reordering entire files, inserting bundles, and extracting pages out to new bundles)
        gridSortable = new Sortable(mergePageGrid, {
          group: {
            name: 'merge-pages',
            pull: function (to, from, dragEl) {
              // Allow pulling bundled stacked-doc cards into expanded page grids!
              return dragEl.classList.contains('stacked-doc');
            },
            put: function (to, from, dragEl) {
              // Allow page cards from inside expanded groups to be dragged OUT to create a new collapse/bundle
              return dragEl.classList.contains('expanded-page');
            }
          },
          animation: 200,
          handle: '.merge-group-drag-handle, .stacked-doc',
          draggable: '.merge-file-group-wrap, .merge-page-card.stacked-doc',
          ghostClass: 'sortable-ghost',
          filter: '.merge-file-group-body, .merge-floating-pill, .merge-group-header-btn, .merge-pill-btn, .merge-add-drop-card',
          preventOnFilter: false,
          delay: 200,
          delayOnTouchOnly: true,
          touchStartThreshold: 8,
          onStart: function () {
            isDraggingCard = true;
          },

          onAdd: function (evt) {
            const droppedEl = evt.item;
            if (!droppedEl) return;

            // When a page card is dragged OUT of an expanded group into the main grid:
            // "ketika page keluar dari zona collase maka dia akan membuat collase baru"
            if (droppedEl.classList.contains('expanded-page')) {
              const droppedPageId = droppedEl.getAttribute('data-id');
              const sourceGroupId = droppedEl.getAttribute('data-group-id') || (evt.from && evt.from.getAttribute('data-group-id'));

              let extractedIds = [];
              if (isMultiDragging && movingIds.length > 0) {
                extractedIds = [...movingIds];
              } else if (droppedPageId) {
                extractedIds = [droppedPageId];
              }

              if (extractedIds.length === 0) return;

              pushHistoryState('Extract to New File');

              // Remove extracted pages from their current source group
              const sourceGroup = fileGroups.find(g => g.id === sourceGroupId);
              if (sourceGroup) {
                sourceGroup.pageIds = sourceGroup.pageIds.filter(pid => !extractedIds.includes(pid));
              } else {
                fileGroups.forEach(g => {
                  g.pageIds = g.pageIds.filter(pid => !extractedIds.includes(pid));
                });
              }

              // Remove any empty groups
              fileGroups = fileGroups.filter(g => g.pageIds.length > 0);

              // Retrieve metadata for new bundle from the first extracted page
              const firstItem = pageItemsMap.get(extractedIds[0]);
              const newGroupId = 'group_sep_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
              const newColor = firstItem && firstItem.colorTheme
                ? firstItem.colorTheme
                : docColorThemes[fileGroups.length % docColorThemes.length];

              const newGroup = {
                id: newGroupId,
                fileIndex: firstItem ? firstItem.originalFileIndex : (fileGroups.length + 1),
                fileName: firstItem ? firstItem.fileName : 'Separated Document.pdf',
                colorTheme: newColor,
                isExpanded: false, // Create a new collapse/bundle as requested!
                pageIds: extractedIds
              };

              // Calculate drop position among remaining file groups
              let insertIndex = 0;
              const children = Array.from(mergePageGrid.children);
              for (let i = 0; i < children.indexOf(droppedEl); i++) {
                const child = children[i];
                if (child !== droppedEl && child.hasAttribute('data-group-id')) {
                  insertIndex++;
                }
              }
              if (insertIndex > fileGroups.length) insertIndex = fileGroups.length;

              fileGroups.splice(insertIndex, 0, newGroup);

              // Reset multi-drag state and clean up DOM before buildGrid
              isMultiDragging = false;
              movingIds = [];
              draggedCard = null;
              clearSelection();

              setTimeout(() => {
                if (droppedEl.parentNode) {
                  droppedEl.parentNode.removeChild(droppedEl);
                }
                buildGrid();
                const isId = (PDFTools.i18n && PDFTools.i18n.getCurrentLang && PDFTools.i18n.getCurrentLang() === 'id');
                const msg = isId
                  ? `${extractedIds.length} halaman dipisahkan menjadi berkas baru!`
                  : `${extractedIds.length} page(s) separated into a new bundle!`;
                PDFTools.Toast.success(msg);
              }, 10);
            }
          },

          onEnd: function () {
            setTimeout(function () {
              isDraggingCard = false;
            }, 80);
            // Read DOM order of group wraps and stacked cards
            const newOrder = [];
            const elements = mergePageGrid.children;
            for (let i = 0; i < elements.length; i++) {
              const el = elements[i];
              const gId = el.getAttribute('data-group-id');
              if (gId) {
                const grp = fileGroups.find(g => g.id === gId);
                if (grp && !newOrder.includes(grp)) newOrder.push(grp);
              }
            }
            if (newOrder.length === fileGroups.length) {
              const changed = newOrder.some((g, idx) => g !== fileGroups[idx]);
              if (changed) {
                pushHistoryState('Reorder Files');
                fileGroups = newOrder;
                updateGlobalSequenceUI();
              }
            }
          }
        });

        // 2. Page-level Sortable for each expanded file group
        const groupBodies = mergePageGrid.querySelectorAll('.merge-file-group-body');

        groupBodies.forEach(body => {
          const s = new Sortable(body, {
            group: 'merge-pages', // Shared group across all open files!
            animation: 180,
            ghostClass: 'sortable-ghost',
            chosenClass: 'sortable-chosen',
            dragClass: 'sortable-drag',
            filter: '.merge-card-header-actions, .merge-card-mini-btn',
            preventOnFilter: true,
            delay: 200,
            delayOnTouchOnly: true,
            touchStartThreshold: 8,

            onAdd: function (evt) {
              // When an entire bundled file (stacked card) is dropped into this page grid!
              const droppedEl = evt.item;
              if (droppedEl && droppedEl.classList.contains('stacked-doc')) {
                const sourceGroupId = droppedEl.getAttribute('data-group-id');
                const targetGroupId = evt.to.getAttribute('data-group-id');

                if (sourceGroupId && targetGroupId && sourceGroupId !== targetGroupId) {
                  const sourceGroup = fileGroups.find(g => g.id === sourceGroupId);
                  const targetGroup = fileGroups.find(g => g.id === targetGroupId);

                  if (sourceGroup && targetGroup) {
                    pushHistoryState('Insert Bundle');
                    const children = Array.from(evt.to.children);
                    const dropIndex = children.indexOf(droppedEl);
                    const validIndex = dropIndex >= 0 ? dropIndex : targetGroup.pageIds.length;

                    // Splice all pages from the bundled file directly into the target group!
                    targetGroup.pageIds.splice(validIndex, 0, ...sourceGroup.pageIds);

                    // Remove the bundled source group
                    fileGroups = fileGroups.filter(g => g.id !== sourceGroupId);

                    // Remove the temporary dropped DOM element before buildGrid
                    if (droppedEl.parentNode) droppedEl.parentNode.removeChild(droppedEl);

                    buildGrid();
                    const isId = (PDFTools.i18n && PDFTools.i18n.getCurrentLang && PDFTools.i18n.getCurrentLang() === 'id');
                    const msg = isId
                      ? `${sourceGroup.pageIds.length} halaman dari ${sourceGroup.fileName} berhasil diselipkan ke ${targetGroup.fileName}!`
                      : `${sourceGroup.pageIds.length} page(s) from ${sourceGroup.fileName} inserted into ${targetGroup.fileName}!`;
                    PDFTools.Toast.success(msg);
                    return;
                  }
                }
              }
            },

            onStart: function (evt) {
              draggedCard = evt.item;
              const itemId = draggedCard.getAttribute('data-id');

              if (selectedPageIds.has(itemId) && selectedPageIds.size > 1) {
                isMultiDragging = true;
                movingIds = Array.from(selectedPageIds);
                movingIds.forEach(id => {
                  const c = mergePageGrid.querySelector(`.merge-page-card[data-id="${id}"]`);
                  if (c && c !== draggedCard) c.style.opacity = '0.35';
                });
              } else {
                isMultiDragging = false;
                movingIds = [];
              }
            },

            onEnd: function (evt) {
              if (evt.to === mergePageGrid) {
                // Handled cleanly by gridSortable.onAdd
                draggedCard = null;
                isMultiDragging = false;
                movingIds = [];
                return;
              }

              if (isMultiDragging && movingIds.length > 0) {
                // Move all other selected cards to follow right after dropped card in target container
                const targetContainer = evt.to;
                let insertRef = evt.item.nextSibling;

                movingIds.forEach(id => {
                  const c = mergePageGrid.querySelector(`.merge-page-card[data-id="${id}"]`);
                  if (c && c !== evt.item) {
                    c.style.opacity = '1';
                    targetContainer.insertBefore(c, insertRef);
                    insertRef = c.nextSibling;
                  }
                });
              }

              // ============================================================
              // CRITICAL: PERMANENTLY UPDATE GROUP MEMBERSHIP FROM DOM!
              // ============================================================
              pushHistoryState('Reorder Pages');
              syncAllGroupsFromDom();

              draggedCard = null;
              isMultiDragging = false;
              movingIds = [];
            }
          });
          pageSortables.push(s);
        });
      }

      // Read the current DOM elements inside each open group, and update group.pageIds
      function syncAllGroupsFromDom() {
        fileGroups.forEach(group => {
          if (group.isExpanded) {
            const body = mergePageGrid.querySelector(`.merge-file-group-body[data-group-id="${group.id}"]`);
            if (body) {
              const cards = body.querySelectorAll('.merge-page-card');
              const newIds = [];
              cards.forEach(c => {
                const id = c.getAttribute('data-id');
                if (id) newIds.push(id);
              });
              // Permanently assign new pageIds to this group!
              group.pageIds = newIds;
            }
          }
        });

        // Clean up empty groups if any group was emptied
        const hadEmpty = fileGroups.some(g => g.pageIds.length === 0);
        fileGroups = fileGroups.filter(g => g.pageIds.length > 0);

        if (hadEmpty) {
          buildGrid();
        } else {
          // Update all "New #X" page numbers and ranges dynamically!
          updateGlobalSequenceUI();
        }
      }

      // ============================================================
      // TOOLBAR CONTROLS
      // ============================================================

      expandAllBtn.addEventListener('click', function () {
        fileGroups.forEach(g => { g.isExpanded = true; });
        buildGrid();
      });

      collapseAllBtn.addEventListener('click', function () {
        // Save current DOM state before collapsing
        syncAllGroupsFromDom();
        fileGroups.forEach(g => { g.isExpanded = false; });
        buildGrid();
      });

      rotateAllBtn.addEventListener('click', function () {
        pushHistoryState('Rotate All');
        pageItemsMap.forEach(item => {
          item.rotation = (item.rotation + 90) % 360;
        });
        mergePageGrid.querySelectorAll('canvas').forEach(canvas => {
          const card = canvas.closest('.merge-page-card');
          if (card) {
            const id = card.getAttribute('data-id');
            if (id) {
              const item = pageItemsMap.get(id);
              if (item) canvas.style.transform = `rotate(${item.rotation}deg)`;
            } else {
              const gId = card.getAttribute('data-group-id');
              const group = fileGroups.find(g => g.id === gId);
              if (group && group.pageIds.length > 0) {
                const firstItem = pageItemsMap.get(group.pageIds[0]);
                if (firstItem) canvas.style.transform = `rotate(${firstItem.rotation}deg)`;
              }
            }
          }
        });
      });

      // Reset Order: Restores original files & original page sequences
      resetOrderBtn.addEventListener('click', function () {
        if (initialSnapshot.length === 0) return;
        pushHistoryState('Reset Order');

        fileGroups = initialSnapshot.map(s => ({
          id: s.id,
          fileIndex: s.fileIndex,
          fileName: s.fileName,
          colorTheme: s.colorTheme,
          isExpanded: false,
          pageIds: [...s.pageIds]
        }));

        pageItemsMap.forEach(item => { item.rotation = 0; });
        clearSelection();
        buildGrid();
        PDFTools.Toast.info(PDFTools.i18n.t('toast.order_reset', 'Order reset to original'));
      });

      clearAllPagesBtn.addEventListener('click', function () {
        destroyAllPdfDocs();
        destroySortables();
        allUploadedFiles = [];
        pageItemsMap.clear();
        deletedItemsCache.clear();
        fileGroups = [];
        initialSnapshot = [];
        historyStack = [];
        historyIndex = -1;
        updateHistoryButtonsUI();
        selectedPageIds.clear();
        buildGrid();
        checkEmptyState();
        PDFTools.Toast.info(PDFTools.i18n.t('toast.all_pages_cleared', 'All pages cleared'));
      });

      function checkEmptyState() {
        if (fileGroups.length === 0 || pageItemsMap.size === 0) {
          organizerArea.style.display = 'none';
          actionBar.classList.remove('active');
          dropzoneEl.style.display = 'block';
        }
      }

      // ============================================================
      // MERGE EXECUTION
      // ============================================================

      mergeBtn.addEventListener('click', async function () {
        syncAllGroupsFromDom();
        const ordered = getOrderedPages();

        if (ordered.length === 0) {
          PDFTools.Toast.warning(PDFTools.i18n.t('toast.no_pages_to_merge', 'No pages to merge.'));
          return;
        }

        progress.show(PDFTools.i18n.t('action.processing', 'Merging PDF files...'));
        mergeBtn.disabled = true;

        try {
          const fileDocCache = new Map();
          let hasDigitalSignatures = false;
          let signatureCount = 0;
          for (let i = 0; i < allUploadedFiles.length; i++) {
            const file = allUploadedFiles[i];
            try {
              const loaded = await PDFTools.Merge.loadSource(file);
              fileDocCache.set(file, loaded.doc);
              if (loaded.hadSignatures) {
                hasDigitalSignatures = true;
                signatureCount += loaded.signatureCount;
              }
            } catch (loadErr) {
              console.warn('PDF load failed for', file.name, loadErr);
            }
          }

          const itemsToAssemble = [];
          for (let i = 0; i < ordered.length; i++) {
            const { item } = ordered[i];
            const sourceDoc = fileDocCache.get(item.file);
            if (!sourceDoc) continue;
            itemsToAssemble.push({
              doc: sourceDoc,
              pageIndex: item.pageIndex,
              rotation: item.rotation || 0
            });
          }

          const assembleResult = await PDFTools.Merge.assemble(itemsToAssemble, {
            onProgress: function (pct, text) {
              progress.update(pct, text);
            }
          });

          mergedData = assembleResult.bytes;
          window._lastMergedData = mergedData;
          progress.hide();

          organizerArea.style.display = 'none';
          actionBar.classList.remove('active');
          resultArea.classList.add('active');

          document.getElementById('resPages').textContent = ordered.length;
          document.getElementById('resFiles').textContent = fileGroups.length;
          document.getElementById('resSize').textContent = PDFTools.FileUtils.formatSize(mergedData.byteLength);


          PDFTools.Toast.success(PDFTools.i18n.t('result.merge_success', 'PDFs merged successfully!'));
        } catch (err) {
          console.error('Merge error:', err);
          progress.hide();
          mergeBtn.disabled = false;
          PDFTools.Toast.error(PDFTools.i18n.t('toast.merge_failed', 'Merge failed: ') + (err.message || 'Unknown error'));
        }
      });

      downloadBtn.addEventListener('click', function () {
        if (!mergedData) return;
        const blob = new Blob([mergedData], { type: 'application/pdf' });
        PDFTools.Download.save(blob, 'merged-document.pdf');
      });

      const openStudioBtn = document.getElementById('openStudioBtn');
      if (openStudioBtn) {
        openStudioBtn.addEventListener('click', function () {
          if (!mergedData) return;
          try {
            const base64 = PDFTools.FileUtils.arrayBufferToBase64(mergedData.buffer || mergedData);
            localStorage.setItem('pdftools-studio-doc', base64);
            localStorage.setItem('pdftools-studio-filename', 'merged-document.pdf');
            window.location.href = 'viewer.html';
          } catch (e) {
            console.error('Handover to Studio error:', e);
            PDFTools.Toast.error('Could not open in PDF Studio due to storage quota. Please download instead.');
          }
        });
      }

      resetBtn.addEventListener('click', function () {
        destroyAllPdfDocs();
        destroySortables();
        allUploadedFiles = [];
        pageItemsMap.clear();
        deletedItemsCache.clear();
        fileGroups = [];
        initialSnapshot = [];
        historyStack = [];
        historyIndex = -1;
        updateHistoryButtonsUI();
        mergedData = null;
        selectedPageIds.clear();
        mergeBtn.disabled = false;
        resultArea.classList.remove('active');
        selectionBar.classList.remove('active');
        organizerArea.style.display = 'none';
        dropzoneEl.style.display = 'block';
      });
    });
})();
