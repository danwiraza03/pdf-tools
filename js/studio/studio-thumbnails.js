/**
 * PDF Tools — PDF Studio Thumbnails & Page Management Controller
 * Manages left sidebar page thumbnails, drag-and-drop page reordering,
 * page rotation/duplication/deletion, context menu, and inserting PDF/Image/Blank pages.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioThumbnails = (function () {
  let ctx = null;

  // State
  let draggedCard = null;
  let contextTargetPage = 1;
  let contextTargetIndex = 0;
  let targetInsertIndex = -1; // -1 means after active
  let modalPendingFiles = null;
  let modalInsertType = 'blank'; // 'blank' | 'pdf' | 'image'
  let isListenersBound = false;

  function init(context) {
    ctx = context;
    if (!isListenersBound) {
      bindEventListeners();
      isListenersBound = true;
    }
  }

  function getDoc() {
    return ctx && ctx.getDoc ? ctx.getDoc() : null;
  }

  function recordDocumentState() {
    if (ctx && ctx.recordDocumentState) ctx.recordDocumentState();
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  async function renderCurrentPageView() {
    if (ctx && ctx.renderCurrentPageView) {
      await ctx.renderCurrentPageView();
    }
  }

  async function navigateToPage(targetPageNum) {
    if (ctx && ctx.navigateToPage) {
      await ctx.navigateToPage(targetPageNum);
    }
  }

  function getThumbScrollList() {
    return ctx?.getThumbScrollList?.() || document.getElementById('thumbnailContainer');
  }

  function getThumbnailSidebar() {
    return ctx?.getThumbnailSidebar?.() || document.getElementById('thumbnailSidebar');
  }

  function getDropIndicator() {
    let dropIndicator = document.getElementById('thumbDropIndicator');
    if (!dropIndicator) {
      dropIndicator = document.createElement('div');
      dropIndicator.id = 'thumbDropIndicator';
      dropIndicator.className = 'thumb-drop-indicator';
      dropIndicator.style.display = 'none';
      const list = getThumbScrollList();
      if (list) list.appendChild(dropIndicator);
    }
    return dropIndicator;
  }

  // --- Thumbnail Cards Active State Sync ---

  function updateThumbnailActiveState() {
    const thumbScrollList = getThumbScrollList();
    const currentDoc = getDoc();
    if (!thumbScrollList || !currentDoc) return;
    thumbScrollList.querySelectorAll('.acrobat-thumb-card').forEach(c => {
      c.classList.toggle('active', parseInt(c.getAttribute('data-page'), 10) === currentDoc.currentPage);
    });
  }

  // --- Context Menu Positioning ---

  function showThumbContextMenu(x, y, pageNum, pageIdx) {
    const thumbContextMenu = document.getElementById('thumbContextMenu');
    if (!thumbContextMenu) return;
    contextTargetPage = pageNum;
    contextTargetIndex = pageIdx;

    thumbContextMenu.style.display = 'block';
    const menuWidth = 230;
    const menuHeight = 350;
    const posX = Math.min(x, window.innerWidth - menuWidth - 10);
    const posY = Math.min(y, window.innerHeight - menuHeight - 10);

    thumbContextMenu.style.left = `${Math.max(10, posX)}px`;
    thumbContextMenu.style.top = `${Math.max(10, posY)}px`;
  }

  // --- Page Operations Helpers ---

  async function insertFilesAt(files, targetIdx) {
    const currentDoc = getDoc();
    if (!currentDoc || !files || files.length === 0) return;
    recordDocumentState();
    let insertPos = Math.max(0, Math.min(targetIdx, currentDoc.getActivePagesList().length));
    let totalInserted = 0;

    const toastMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.processing') : 'Combining pages...';
    if (window.PDFTools?.Toast) window.PDFTools.Toast.info(toastMsg);

    for (const file of Array.from(files)) {
      const nameLower = file.name.toLowerCase();
      if (nameLower.endsWith('.pdf')) {
        const buffer = await file.arrayBuffer();
        const res = await window.PDFTools.Studio.insertPdfPages(currentDoc, insertPos, buffer);
        const count = res ? (res.insertedCount || res.count || 0) : 0;
        if (count > 0) {
          insertPos += count;
          totalInserted += count;
        }
      } else if (/\.(png|jpe?g|webp|bmp|gif)$/.test(nameLower)) {
        const buffer = await file.arrayBuffer();
        const res = await window.PDFTools.Studio.insertImagePages(currentDoc, insertPos, [{
          name: file.name,
          type: file.type || 'image/jpeg',
          mimeType: file.type || 'image/jpeg',
          data: buffer,
          arrayBuffer: buffer
        }]);
        const count = res ? (res.insertedCount || res.count || 0) : 0;
        if (count > 0) {
          insertPos += count;
          totalInserted += count;
        }
      }
    }

    if (totalInserted > 0) {
      currentDoc.currentPage = Math.min(targetIdx + 1, currentDoc.totalPages);
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();

      const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
      const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
      if (pageNumberInput) pageNumberInput.value = currentDoc.currentPage;
      if (totalPagesLabel) totalPagesLabel.textContent = currentDoc.totalPages;

      const successMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.page_inserted') : 'page(s) inserted successfully!';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.success(`${totalInserted} ${successMsg}`);
    } else {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.warning('No compatible PDF or image pages found to combine.');
    }
  }

  async function insertBlankPagesHandler(insertIdx, count = 1, size = 'a4', orientation = 'portrait') {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    recordDocumentState();
    const safeIdx = Math.max(0, Math.min(insertIdx, currentDoc.getActivePagesList().length));

    let width = 595.28;
    let height = 841.89;
    if (size === 'letter') {
      width = 612;
      height = 792;
    } else if (size === 'current' && currentDoc.pdfJsDoc) {
      try {
        const refPage = await currentDoc.pdfJsDoc.getPage(Math.min(currentDoc.currentPage, currentDoc.totalPages));
        const vp = refPage.getViewport({ scale: 1.0 });
        width = vp.width;
        height = vp.height;
      } catch (e) {
        width = 595.28;
        height = 841.89;
      }
    }

    const res = await window.PDFTools.Studio.insertBlankPages(currentDoc, safeIdx, count, { width, height, size, orientation });
    const inserted = res ? (res.insertedCount || res.count || 0) : 0;
    if (inserted > 0) {
      currentDoc.currentPage = safeIdx + 1;
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();

      const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
      const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
      if (pageNumberInput) pageNumberInput.value = currentDoc.currentPage;
      if (totalPagesLabel) totalPagesLabel.textContent = currentDoc.totalPages;

      const successMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.page_inserted') : `${count} blank page(s) inserted!`;
      if (window.PDFTools?.Toast) window.PDFTools.Toast.success(successMsg);
    }
  }

  async function duplicatePageHandler(pageIndex) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activeList = currentDoc.getActivePagesList();
    const safeIdx = typeof pageIndex === 'number'
      ? Math.max(0, Math.min(pageIndex, activeList.length - 1))
      : Math.max(0, activeList.indexOf(currentDoc.currentPage));

    recordDocumentState();
    try {
      const res = await window.PDFTools.Studio.duplicatePage(currentDoc, safeIdx);
      if (res && res.success) {
        scheduleRecovery();
        await buildSidebarThumbnails();
        await renderCurrentPageView();

        const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
        const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
        if (pageNumberInput) pageNumberInput.value = currentDoc.currentPage;
        if (totalPagesLabel) totalPagesLabel.textContent = currentDoc.totalPages;

        const successMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.page_duplicated') : 'Page duplicated!';
        if (window.PDFTools?.Toast) window.PDFTools.Toast.success(successMsg);
      }
    } catch (err) {
      console.error('Duplicate page failed:', err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Failed to duplicate page.');
    }
  }

  async function deletePageHandler(pageIndex) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activeList = currentDoc.getActivePagesList();
    if (activeList.length <= 1 || currentDoc.totalPages <= 1) {
      const err = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.cannot_delete_last') : 'Cannot delete the only page in the document.';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err);
      return;
    }

    const safeIdx = typeof pageIndex === 'number'
      ? Math.max(0, Math.min(pageIndex, activeList.length - 1))
      : Math.max(0, activeList.indexOf(currentDoc.currentPage));

    const pageDisplayNum = safeIdx + 1;

    let ok = true;
    if (window.PDFTools?.Modal?.confirm) {
      const confirmTpl = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.confirm_delete_page') : 'Delete page {page}?';
      const confirmMsg = confirmTpl.replace('{page}', pageDisplayNum);
      ok = await window.PDFTools.Modal.confirm(confirmMsg, { isDanger: true });
    }
    if (!ok) return;

    recordDocumentState();
    try {
      const res = await window.PDFTools.Studio.deletePage(currentDoc, safeIdx);
      if (res && res.success) {
        scheduleRecovery();
        await buildSidebarThumbnails();
        await renderCurrentPageView();

        const pageNumberInput = ctx?.getPageNumberInput?.() || document.getElementById('pageNumberInput');
        const totalPagesLabel = ctx?.getTotalPagesLabel?.() || document.getElementById('totalPagesLabel');
        if (pageNumberInput) pageNumberInput.value = currentDoc.currentPage;
        if (totalPagesLabel) totalPagesLabel.textContent = currentDoc.totalPages;

        const delMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.page_deleted') : 'Page deleted.';
        if (window.PDFTools?.Toast) window.PDFTools.Toast.info(delMsg);
      }
    } catch (err) {
      console.error('Delete page failed:', err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Failed to delete page.');
    }
  }

  // --- Top / Main Toolbar Actions ---

  async function rotateCurrent(deg) {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const p = currentDoc.currentPage;
    recordDocumentState();
    currentDoc.rotatePage(p, deg);
    scheduleRecovery();
    await renderCurrentPageView();
    await buildSidebarThumbnails();
  }

  async function duplicateCurrent() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activeList = currentDoc.getActivePagesList();
    const idx = activeList.indexOf(currentDoc.currentPage);
    await duplicatePageHandler(idx !== -1 ? idx : 0);
  }

  async function deleteCurrent() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const activeList = currentDoc.getActivePagesList();
    const idx = activeList.indexOf(currentDoc.currentPage);
    await deletePageHandler(idx !== -1 ? idx : 0);
  }

  function triggerInsertPdf(targetIndex) {
    const currentDoc = getDoc();
    if (currentDoc) {
      targetInsertIndex = typeof targetIndex === 'number' ? targetIndex : currentDoc.getActivePagesList().length;
    }
    const input = document.getElementById('insertPdfInput');
    if (input) input.click();
  }

  function triggerInsertImage(targetIndex) {
    const currentDoc = getDoc();
    if (currentDoc) {
      targetInsertIndex = typeof targetIndex === 'number' ? targetIndex : currentDoc.getActivePagesList().length;
    }
    const input = document.getElementById('insertImageInput');
    if (input) input.click();
  }

  // --- Insert Page Modal UI ---

  function openInsertPageModal(initialType = 'blank', targetIndex = -1) {
    const currentDoc = getDoc();
    if (!currentDoc) {
      const openFirstMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.open_first') : 'Please open a document first.';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(openFirstMsg);
      return;
    }
    targetInsertIndex = targetIndex;
    modalPendingFiles = null;
    setModalInsertType(initialType);
    const selectedInsertFileInfo = document.getElementById('selectedInsertFileInfo');
    const selectInsertFileLabel = document.getElementById('selectInsertFileLabel');
    const insertPageModal = document.getElementById('insertPageModal');
    if (selectedInsertFileInfo) selectedInsertFileInfo.style.display = 'none';
    if (selectInsertFileLabel) selectInsertFileLabel.textContent = 'Choose PDF / Image File(s)...';
    if (insertPageModal) insertPageModal.style.display = 'flex';
  }

  function closeInsertPageModal() {
    const insertPageModal = document.getElementById('insertPageModal');
    if (insertPageModal) insertPageModal.style.display = 'none';
    modalPendingFiles = null;
  }

  function setModalInsertType(type) {
    modalInsertType = type;
    const insertTypeBlankBtn = document.getElementById('insertTypeBlankBtn');
    const insertTypePdfBtn = document.getElementById('insertTypePdfBtn');
    const insertTypeImageBtn = document.getElementById('insertTypeImageBtn');
    const insertBlankOptions = document.getElementById('insertBlankOptions');
    const insertFileOptions = document.getElementById('insertFileOptions');
    const selectInsertFileLabel = document.getElementById('selectInsertFileLabel');

    insertTypeBlankBtn?.classList.toggle('btn-primary', type === 'blank');
    insertTypeBlankBtn?.classList.toggle('btn-ghost', type !== 'blank');
    insertTypePdfBtn?.classList.toggle('btn-primary', type === 'pdf');
    insertTypePdfBtn?.classList.toggle('btn-ghost', type !== 'pdf');
    insertTypeImageBtn?.classList.toggle('btn-primary', type === 'image');
    insertTypeImageBtn?.classList.toggle('btn-ghost', type !== 'image');

    if (type === 'blank') {
      if (insertBlankOptions) insertBlankOptions.style.display = 'flex';
      if (insertFileOptions) insertFileOptions.style.display = 'none';
    } else {
      if (insertBlankOptions) insertBlankOptions.style.display = 'none';
      if (insertFileOptions) insertFileOptions.style.display = 'flex';
      if (selectInsertFileLabel) {
        selectInsertFileLabel.textContent = type === 'pdf' ? 'Choose PDF File to Insert...' : 'Choose Image(s) (PNG, JPG, WebP)...';
      }
    }
  }

  // --- Build Sidebar Thumbnails DOM ---

  async function buildSidebarThumbnails() {
    const thumbScrollList = getThumbScrollList();
    if (!thumbScrollList) return;
    thumbScrollList.innerHTML = '';
    const currentDoc = getDoc();
    if (!currentDoc) return;

    const activePageNums = currentDoc.getActivePagesList();

    if (activePageNums.length === 0) {
      thumbScrollList.innerHTML = `
        <div class="thumb-drop-empty-hint">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>
          <span style="font-size: 0.8rem; color: var(--acrobat-text-muted);">Drop PDF or Image files here to add pages</span>
        </div>
      `;
      return;
    }

    activePageNums.forEach((p, idx) => {
      const card = document.createElement('div');
      card.className = `acrobat-thumb-card ${p === currentDoc.currentPage ? 'active' : ''}`;
      card.setAttribute('data-page', p);
      card.setAttribute('data-index', idx);
      card.draggable = true;

      const frame = document.createElement('div');
      frame.className = 'acrobat-thumb-frame';

      const canvas = document.createElement('canvas');
      frame.appendChild(canvas);

      window.PDFTools.Studio.renderThumbnail(currentDoc, p, canvas);

      const label = document.createElement('span');
      label.className = 'acrobat-thumb-label';
      label.textContent = `${idx + 1} (${p})`;

      // Hover Quick Action Buttons
      const hoverActions = document.createElement('div');
      hoverActions.className = 'thumb-hover-actions';
      hoverActions.innerHTML = `
        <button type="button" class="thumb-mini-btn btn-quick-insert" title="Insert blank page after this" data-i18n-title="sidebar.insert_blank">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <button type="button" class="thumb-mini-btn btn-quick-rot" title="Rotate 90° Clockwise" data-i18n-title="sidebar.rotate_cw">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
        </button>
        <button type="button" class="thumb-mini-btn btn-quick-del" title="Delete this page" style="color: #ef4444;" data-i18n-title="sidebar.delete">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        </button>
      `;

      hoverActions.querySelector('.btn-quick-insert').addEventListener('click', (e) => {
        e.stopPropagation();
        insertBlankPagesHandler(idx + 1, 1);
      });
      hoverActions.querySelector('.btn-quick-rot').addEventListener('click', async (e) => {
        e.stopPropagation();
        recordDocumentState();
        currentDoc.rotatePage(p, 90);
        scheduleRecovery();
        await buildSidebarThumbnails();
        await renderCurrentPageView();
      });
      hoverActions.querySelector('.btn-quick-del').addEventListener('click', (e) => {
        e.stopPropagation();
        deletePageHandler(idx);
      });

      card.appendChild(frame);
      card.appendChild(label);
      card.appendChild(hoverActions);

      // Card Click -> Navigate
      card.addEventListener('click', async () => {
        await navigateToPage(p);
      });

      // Right Click Context Menu
      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        showThumbContextMenu(e.clientX, e.clientY, p, idx);
      });

      // Card Drag to Reorder
      card.addEventListener('dragstart', (e) => {
        draggedCard = card;
        card.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', idx.toString());
      });

      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        document.querySelectorAll('.acrobat-thumb-card').forEach(c => c.classList.remove('drag-over'));
        const dropIndicator = getDropIndicator();
        if (dropIndicator) dropIndicator.style.display = 'none';
      });

      card.addEventListener('dragover', (e) => {
        e.preventDefault();
        // Handle file drag vs card reorder
        if (e.dataTransfer.types.includes('Files')) {
          e.dataTransfer.dropEffect = 'copy';
        } else {
          e.dataTransfer.dropEffect = 'move';
          card.classList.add('drag-over');
        }
      });

      card.addEventListener('dragleave', () => {
        card.classList.remove('drag-over');
      });

      card.addEventListener('drop', async (e) => {
        e.preventDefault();
        card.classList.remove('drag-over');
        const dropIndicator = getDropIndicator();
        if (dropIndicator) dropIndicator.style.display = 'none';

        // Check if dropping external files
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          const rect = card.getBoundingClientRect();
          const isAfter = (e.clientY - rect.top) > (rect.height / 2);
          const targetIdx = isAfter ? idx + 1 : idx;
          await insertFilesAt(e.dataTransfer.files, targetIdx);
          return;
        }

        // Card reordering
        if (draggedCard && draggedCard !== card) {
          const fromIndex = parseInt(draggedCard.getAttribute('data-index'), 10);
          const toIndex = parseInt(card.getAttribute('data-index'), 10);

          recordDocumentState();
          const movedPage = currentDoc.pageOrder.splice(fromIndex, 1)[0];
          currentDoc.pageOrder.splice(toIndex, 0, movedPage);
          scheduleRecovery();

          await buildSidebarThumbnails();
          await renderCurrentPageView();
          const reorderMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.page_reordered') : 'Page order updated!';
          if (window.PDFTools?.Toast) window.PDFTools.Toast.success(reorderMsg);
        }
      });

      thumbScrollList.appendChild(card);
    });

    // Ensure drop indicator is present at end
    const dropIndicator = getDropIndicator();
    if (dropIndicator) thumbScrollList.appendChild(dropIndicator);
  }

  // --- Event Listeners Binding ---

  function bindEventListeners() {
    const insertPageDropdownBtn = document.getElementById('insertPageDropdownBtn');
    const insertDropdownMenu = document.getElementById('insertDropdownMenu');
    const thumbContextMenu = document.getElementById('thumbContextMenu');
    const thumbnailSidebar = getThumbnailSidebar();
    const thumbScrollList = getThumbScrollList();

    function closeInsertDropdown() {
      if (insertDropdownMenu) {
        insertDropdownMenu.style.display = 'none';
        insertDropdownMenu.classList.remove('show');
        insertPageDropdownBtn?.setAttribute('aria-expanded', 'false');
      }
    }

    // Toggle Insert Dropdown
    insertPageDropdownBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      const currentDoc = getDoc();
      if (!currentDoc) {
        const msg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.open_first') : 'Please open a document first.';
        if (window.PDFTools?.Toast) window.PDFTools.Toast.error(msg);
        return;
      }
      const isOpen = insertDropdownMenu.classList.contains('show') || insertDropdownMenu.style.display === 'block';
      if (isOpen) {
        closeInsertDropdown();
      } else {
        insertDropdownMenu.style.display = 'block';
        insertDropdownMenu.classList.add('show');
        insertPageDropdownBtn.setAttribute('aria-expanded', 'true');
      }
    });

    // Close floating menus on click outside
    document.addEventListener('click', (e) => {
      if (insertDropdownMenu && !e.target.closest('#insertPageDropdownBtn')) {
        closeInsertDropdown();
      }
      if (thumbContextMenu && !e.target.closest('#thumbContextMenu')) {
        thumbContextMenu.style.display = 'none';
      }
    });

    // Modal buttons
    document.getElementById('insertTypeBlankBtn')?.addEventListener('click', () => setModalInsertType('blank'));
    document.getElementById('insertTypePdfBtn')?.addEventListener('click', () => setModalInsertType('pdf'));
    document.getElementById('insertTypeImageBtn')?.addEventListener('click', () => setModalInsertType('image'));
    document.getElementById('closeInsertPageModalBtn')?.addEventListener('click', closeInsertPageModal);
    document.getElementById('cancelInsertPageBtn')?.addEventListener('click', closeInsertPageModal);

    const insertPdfInput = document.getElementById('insertPdfInput');
    const insertImageInput = document.getElementById('insertImageInput');

    document.getElementById('selectInsertFileBtn')?.addEventListener('click', () => {
      if (modalInsertType === 'pdf') {
        insertPdfInput?.click();
      } else {
        insertImageInput?.click();
      }
    });

    // Confirm Insert Button
    document.getElementById('confirmInsertPageBtn')?.addEventListener('click', async () => {
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const activeList = currentDoc.getActivePagesList();
      const activeIdx = activeList.indexOf(currentDoc.currentPage);
      const loc = document.getElementById('insertPageLocation')?.value || 'after';

      let targetIdx = targetInsertIndex !== -1 ? targetInsertIndex : (activeIdx !== -1 ? activeIdx : 0);
      if (loc === 'after') targetIdx = targetIdx + 1;
      else if (loc === 'before') targetIdx = targetIdx;
      else if (loc === 'start') targetIdx = 0;
      else if (loc === 'end') targetIdx = activeList.length;

      if (modalInsertType === 'blank') {
        const count = parseInt(document.getElementById('insertBlankCount')?.value || '1', 10) || 1;
        const size = document.getElementById('insertBlankSize')?.value || 'a4';
        const orientation = document.querySelector('input[name="insertOrientation"]:checked')?.value || 'portrait';
        await insertBlankPagesHandler(targetIdx, count, size, orientation);
        closeInsertPageModal();
      } else if (modalPendingFiles && modalPendingFiles.length > 0) {
        await insertFilesAt(modalPendingFiles, targetIdx);
        closeInsertPageModal();
      } else {
        if (modalInsertType === 'pdf') insertPdfInput?.click();
        else insertImageInput?.click();
      }
    });

    // Insert Dropdown Items
    document.getElementById('menuInsertBlankPage')?.addEventListener('click', () => {
      closeInsertDropdown();
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const activeList = currentDoc.getActivePagesList();
      const activeIdx = activeList.indexOf(currentDoc.currentPage);
      openInsertPageModal('blank', activeIdx !== -1 ? activeIdx : 0);
    });

    document.getElementById('menuInsertPdfPage')?.addEventListener('click', () => {
      closeInsertDropdown();
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const activeList = currentDoc.getActivePagesList();
      targetInsertIndex = activeList.indexOf(currentDoc.currentPage) + 1;
      insertPdfInput?.click();
    });

    document.getElementById('menuInsertImagePage')?.addEventListener('click', () => {
      closeInsertDropdown();
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const activeList = currentDoc.getActivePagesList();
      targetInsertIndex = activeList.indexOf(currentDoc.currentPage) + 1;
      insertImageInput?.click();
    });

    document.getElementById('menuDuplicatePage')?.addEventListener('click', () => {
      closeInsertDropdown();
      duplicateCurrent();
    });

    document.getElementById('addPageBtn')?.addEventListener('click', () => {
      duplicateCurrent();
    });

    document.getElementById('deletePageThumbBtn')?.addEventListener('click', () => {
      deleteCurrent();
    });

    // Hidden file input change listeners
    const selectedInsertFileInfo = document.getElementById('selectedInsertFileInfo');
    const insertPageModal = document.getElementById('insertPageModal');

    insertPdfInput?.addEventListener('change', async (e) => {
      const currentDoc = getDoc();
      if (!currentDoc || !e.target.files || e.target.files.length === 0) return;
      const files = e.target.files;
      if (insertPageModal && insertPageModal.style.display === 'flex') {
        modalPendingFiles = files;
        if (selectedInsertFileInfo) {
          selectedInsertFileInfo.style.display = 'block';
          selectedInsertFileInfo.textContent = `Selected: ${files[0].name} (${(files[0].size / 1024).toFixed(1)} KB)`;
        }
      } else {
        const activeList = currentDoc.getActivePagesList();
        const targetIdx = targetInsertIndex !== -1 ? targetInsertIndex : activeList.indexOf(currentDoc.currentPage) + 1;
        await insertFilesAt(files, targetIdx);
      }
      insertPdfInput.value = '';
    });

    insertImageInput?.addEventListener('change', async (e) => {
      const currentDoc = getDoc();
      if (!currentDoc || !e.target.files || e.target.files.length === 0) return;
      const files = e.target.files;
      if (insertPageModal && insertPageModal.style.display === 'flex') {
        modalPendingFiles = files;
        if (selectedInsertFileInfo) {
          selectedInsertFileInfo.style.display = 'block';
          selectedInsertFileInfo.textContent = `Selected: ${files.length} image(s)`;
        }
      } else {
        const activeList = currentDoc.getActivePagesList();
        const targetIdx = targetInsertIndex !== -1 ? targetInsertIndex : activeList.indexOf(currentDoc.currentPage) + 1;
        await insertFilesAt(files, targetIdx);
      }
      insertImageInput.value = '';
    });

    // Context Menu Action Listeners
    document.getElementById('ctxInsertBlankBefore')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      insertBlankPagesHandler(contextTargetIndex, 1);
    });

    document.getElementById('ctxInsertBlankAfter')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      insertBlankPagesHandler(contextTargetIndex + 1, 1);
    });

    document.getElementById('ctxInsertPdf')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      targetInsertIndex = contextTargetIndex + 1;
      insertPdfInput?.click();
    });

    document.getElementById('ctxInsertImage')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      targetInsertIndex = contextTargetIndex + 1;
      insertImageInput?.click();
    });

    document.getElementById('ctxDuplicate')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      duplicatePageHandler(contextTargetIndex);
    });

    document.getElementById('ctxRotateCw')?.addEventListener('click', async () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      const currentDoc = getDoc();
      if (!currentDoc) return;
      recordDocumentState();
      currentDoc.rotatePage(contextTargetPage, 90);
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();
      const rotMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.rotated') : 'Page rotated 90° clockwise';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.success(rotMsg);
    });

    document.getElementById('ctxRotateCcw')?.addEventListener('click', async () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      const currentDoc = getDoc();
      if (!currentDoc) return;
      recordDocumentState();
      currentDoc.rotatePage(contextTargetPage, -90);
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();
      const rotMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.rotated') : 'Page rotated 90° counter-clockwise';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.success(rotMsg);
    });

    document.getElementById('ctxMoveUp')?.addEventListener('click', async () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      const currentDoc = getDoc();
      if (!currentDoc || contextTargetIndex <= 0) return;
      recordDocumentState();
      const moved = currentDoc.pageOrder.splice(contextTargetIndex, 1)[0];
      currentDoc.pageOrder.splice(contextTargetIndex - 1, 0, moved);
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();
    });

    document.getElementById('ctxMoveDown')?.addEventListener('click', async () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      const currentDoc = getDoc();
      if (!currentDoc) return;
      const activeList = currentDoc.getActivePagesList();
      if (contextTargetIndex >= activeList.length - 1) return;
      recordDocumentState();
      const moved = currentDoc.pageOrder.splice(contextTargetIndex, 1)[0];
      currentDoc.pageOrder.splice(contextTargetIndex + 1, 0, moved);
      scheduleRecovery();
      await buildSidebarThumbnails();
      await renderCurrentPageView();
    });

    document.getElementById('ctxDelete')?.addEventListener('click', () => {
      if (thumbContextMenu) thumbContextMenu.style.display = 'none';
      deletePageHandler(contextTargetIndex);
    });

    // Top / Sidebar Page Action Buttons
    document.getElementById('rotateLeftBtn')?.addEventListener('click', () => rotateCurrent(-90));
    document.getElementById('rotateRightBtn')?.addEventListener('click', () => rotateCurrent(90));
    document.getElementById('sideRotLeft')?.addEventListener('click', () => rotateCurrent(-90));
    document.getElementById('sideRotRight')?.addEventListener('click', () => rotateCurrent(90));
    document.getElementById('sideDuplicatePage')?.addEventListener('click', duplicateCurrent);
    document.getElementById('deletePageBtn')?.addEventListener('click', deleteCurrent);
    document.getElementById('sideDelPage')?.addEventListener('click', deleteCurrent);

    // External File Drag & Drop Merging on Thumbnail Sidebar Area
    if (thumbnailSidebar) {
      thumbnailSidebar.addEventListener('dragover', (e) => {
        if (e.dataTransfer.types.includes('Files')) {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          thumbnailSidebar.classList.add('file-drag-over');

          const dropIndicator = getDropIndicator();
          if (dropIndicator && thumbScrollList) {
            const cards = Array.from(thumbScrollList.querySelectorAll('.acrobat-thumb-card'));
            let insertBeforeCard = null;
            for (const c of cards) {
              const rect = c.getBoundingClientRect();
              if (e.clientY < rect.top + rect.height / 2) {
                insertBeforeCard = c;
                break;
              }
            }

            dropIndicator.style.display = 'block';
            if (insertBeforeCard) {
              thumbScrollList.insertBefore(dropIndicator, insertBeforeCard);
            } else {
              thumbScrollList.appendChild(dropIndicator);
            }
          }
        }
      });

      thumbnailSidebar.addEventListener('dragleave', (e) => {
        if (!thumbnailSidebar.contains(e.relatedTarget)) {
          thumbnailSidebar.classList.remove('file-drag-over');
          const dropIndicator = getDropIndicator();
          if (dropIndicator) dropIndicator.style.display = 'none';
        }
      });

      thumbnailSidebar.addEventListener('drop', async (e) => {
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          e.preventDefault();
          thumbnailSidebar.classList.remove('file-drag-over');
          const dropIndicator = getDropIndicator();
          if (dropIndicator) dropIndicator.style.display = 'none';

          const currentDoc = getDoc();
          let targetIdx = currentDoc ? currentDoc.getActivePagesList().length : 0;
          if (thumbScrollList) {
            const cards = Array.from(thumbScrollList.querySelectorAll('.acrobat-thumb-card'));
            for (let i = 0; i < cards.length; i++) {
              const rect = cards[i].getBoundingClientRect();
              if (e.clientY < rect.top + rect.height / 2) {
                targetIdx = i;
                break;
              }
            }
          }

          await insertFilesAt(e.dataTransfer.files, targetIdx);
        }
      });
    }
  }

  return {
    init,
    buildSidebarThumbnails,
    updateThumbnailActiveState,
    insertFilesAt,
    insertBlankPagesHandler,
    duplicatePageHandler,
    deletePageHandler,
    rotateCurrent,
    deleteCurrent,
    duplicateCurrent,
    triggerInsertPdf,
    triggerInsertImage,
    openInsertPageModal,
    closeInsertPageModal
  };
})();
