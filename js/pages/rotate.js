/**
 * PDF Tools — Rotate PDF Standalone Page Controller
 * Extracted from pages/rotate.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    const dropzoneEl = document.getElementById('dropzone');
    const controlsPanel = document.getElementById('controlsPanel');
    const pageGrid = document.getElementById('pageGrid');
    const actionBar = document.getElementById('actionBar');
    const applyRotateBtn = document.getElementById('applyRotateBtn');
    const resultArea = document.getElementById('resultArea');
    const downloadBtn = document.getElementById('downloadBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Quick Preview Modal Elements
    const previewModal = document.getElementById('previewModal');
    const modalFileName = document.getElementById('modalFileName');
    const modalPageBadge = document.getElementById('modalPageBadge');
    const modalRotateBtn = document.getElementById('modalRotateBtn');
    const modalCloseBtn = document.getElementById('modalCloseBtn');
    const modalPrevBtn = document.getElementById('modalPrevBtn');
    const modalNextBtn = document.getElementById('modalNextBtn');
    const modalCanvas = document.getElementById('modalCanvas');

    let currentFile = null;
    let pdfjsDoc = null;
    let modalCurrentIndex = 0;
    let modalRenderTask = null;
    let rotations = {}; // pageIndex: degrees (0, 90, 180, 270)
    let deletedPages = new Set(); // set of 0-based page indices
    let rotatedPdfBytes = null;
    const progress = PDFTools.Progress('progressBar');

    function updateCardRotation(card, deg) {
      card.classList.remove('rotated-90', 'rotated-180', 'rotated-270', 'has-rotation');
      if (deg > 0) {
        card.classList.add(`rotated-${deg}`, 'has-rotation');
        const badge = card.querySelector('.rotate-badge');
        if (badge) badge.textContent = `+${deg}°`;
      }
    }

    function rotateAllBy(degDelta) {
      const cards = pageGrid.querySelectorAll('.page-card');
      cards.forEach((card, idx) => {
        if (deletedPages.has(idx)) return;
        rotations[idx] = ((rotations[idx] || 0) + degDelta + 360) % 360;
        updateCardRotation(card, rotations[idx]);
      });
      if (previewModal.style.display === 'flex') {
        modalCanvas.style.transform = `rotate(${rotations[modalCurrentIndex] || 0}deg)`;
      }
    }

    function handleDeletePage(idx, card) {
      const totalCards = pageGrid.querySelectorAll('.page-card').length;
      const remainingCount = totalCards - deletedPages.size;

      if (remainingCount <= 1) {
        const minMsg = (PDFTools.i18n && PDFTools.i18n.t('rotate.min_one_page')) || 'At least one page must remain.';
        if (PDFTools.Toast) PDFTools.Toast.error(minMsg);
        return;
      }

      if (previewModal.style.display === 'flex' && modalCurrentIndex === idx) {
        closePreviewModal();
      }

      deletedPages.add(idx);
      card.style.opacity = '0';
      card.style.transform = 'scale(0.88)';
      card.style.transition = 'all 0.22s ease';
      setTimeout(() => {
        if (deletedPages.has(idx)) {
          card.style.display = 'none';
        }
      }, 220);

      const pageNum = idx + 1;
      const tmpl = (PDFTools.i18n && PDFTools.i18n.t('rotate.page_deleted')) || 'Page {n} deleted';
      const undoText = (PDFTools.i18n && PDFTools.i18n.t('action.undo')) || 'Undo';
      const msg = tmpl.replace('{n}', String(pageNum));

      if (PDFTools.Toast && typeof PDFTools.Toast.action === 'function') {
        PDFTools.Toast.action(msg, undoText, function () {
          restorePage(idx, card);
        }, 6000);
      } else if (PDFTools.Toast) {
        PDFTools.Toast.info(msg);
      }
    }

    function restorePage(idx, card) {
      if (!deletedPages.has(idx)) return;
      deletedPages.delete(idx);
      card.style.display = '';
      requestAnimationFrame(() => {
        card.style.opacity = '1';
        card.style.transform = '';
      });
      const pageNum = idx + 1;
      const tmpl = (PDFTools.i18n && PDFTools.i18n.t('rotate.page_restored')) || 'Page {n} restored';
      const msg = tmpl.replace('{n}', String(pageNum));
      if (PDFTools.Toast) PDFTools.Toast.success(msg);
    }

    function getActivePageIndices() {
      const cards = pageGrid.querySelectorAll('.page-card');
      const active = [];
      cards.forEach((card, idx) => {
        if (!deletedPages.has(idx)) {
          active.push(idx);
        }
      });
      return active;
    }

    function openPreviewModal(pageIndex) {
      if (!pdfjsDoc) return;
      modalCurrentIndex = pageIndex;
      previewModal.style.display = 'flex';
      renderModalPage();
    }

    function closePreviewModal() {
      if (modalRenderTask) {
        try { modalRenderTask.cancel(); } catch (_) {}
        modalRenderTask = null;
      }
      previewModal.style.display = 'none';
    }

    async function renderModalPage() {
      if (!pdfjsDoc) return;
      const activeIndices = getActivePageIndices();
      const activePos = activeIndices.indexOf(modalCurrentIndex);

      modalPrevBtn.disabled = (activePos <= 0);
      modalNextBtn.disabled = (activePos === -1 || activePos >= activeIndices.length - 1);

      const displayPageNum = modalCurrentIndex + 1;
      const totalPages = pdfjsDoc.numPages;
      const fileName = currentFile ? currentFile.name : 'Document';
      modalFileName.textContent = fileName;
      const pageLabel = (PDFTools.i18n && PDFTools.i18n.t('page')) || 'Page';
      modalPageBadge.textContent = `${pageLabel} ${displayPageNum} / ${totalPages}`;

      const currentRot = rotations[modalCurrentIndex] || 0;
      modalCanvas.style.transform = `rotate(${currentRot}deg)`;

      if (modalRenderTask) {
        try { modalRenderTask.cancel(); } catch (_) {}
        modalRenderTask = null;
      }

      try {
        const page = await pdfjsDoc.getPage(modalCurrentIndex + 1);
        const viewport = page.getViewport({ scale: 1.2 });
        modalCanvas.width = viewport.width;
        modalCanvas.height = viewport.height;
        const ctx = modalCanvas.getContext('2d');
        modalRenderTask = page.render({
          canvasContext: ctx,
          viewport: viewport
        });
        await modalRenderTask.promise;
        modalRenderTask = null;
      } catch (err) {
        if (err && err.name !== 'RenderingCancelledException') {
          console.error('Modal render error:', err);
        }
      }
    }

    modalPrevBtn.addEventListener('click', function () {
      const activeIndices = getActivePageIndices();
      const activePos = activeIndices.indexOf(modalCurrentIndex);
      if (activePos > 0) {
        modalCurrentIndex = activeIndices[activePos - 1];
        renderModalPage();
      }
    });

    modalNextBtn.addEventListener('click', function () {
      const activeIndices = getActivePageIndices();
      const activePos = activeIndices.indexOf(modalCurrentIndex);
      if (activePos !== -1 && activePos < activeIndices.length - 1) {
        modalCurrentIndex = activeIndices[activePos + 1];
        renderModalPage();
      }
    });

    modalRotateBtn.addEventListener('click', function () {
      rotations[modalCurrentIndex] = ((rotations[modalCurrentIndex] || 0) + 90) % 360;
      const cards = pageGrid.querySelectorAll('.page-card');
      const card = cards[modalCurrentIndex];
      if (card) {
        updateCardRotation(card, rotations[modalCurrentIndex]);
      }
      modalCanvas.style.transform = `rotate(${rotations[modalCurrentIndex]}deg)`;
    });

    modalCloseBtn.addEventListener('click', closePreviewModal);

    previewModal.addEventListener('click', function (e) {
      if (e.target === previewModal) closePreviewModal();
    });

    document.addEventListener('keydown', function (e) {
      if (previewModal.style.display !== 'flex') return;
      if (e.key === 'Escape') {
        closePreviewModal();
      } else if (e.key === 'ArrowLeft') {
        modalPrevBtn.click();
      } else if (e.key === 'ArrowRight') {
        modalNextBtn.click();
      }
    });

    async function loadFile(file) {
      currentFile = file;
      closePreviewModal();
      dropzoneEl.style.display = 'none';
      controlsPanel.style.display = 'block';
      pageGrid.style.display = 'grid';
      actionBar.classList.add('active');
      resultArea.classList.remove('active');

      rotations = {};
      deletedPages.clear();

      let arrayBuffer;
      try {
        arrayBuffer = await PDFTools.FileUtils.readAsArrayBuffer(file);
        pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer.slice(0)) }).promise;
      } catch (e) {
        console.warn('PDF.js document load for preview failed:', e);
        pdfjsDoc = null;
      }

      const res = await PDFTools.Preview.renderAllPages(arrayBuffer || file, pageGrid, {
        selectable: false
      });

      const tLeft = (PDFTools.i18n && PDFTools.i18n.t('rotate.page_left')) || 'Rotate left';
      const tRight = (PDFTools.i18n && PDFTools.i18n.t('rotate.page_right')) || 'Rotate right';
      const tView = (PDFTools.i18n && PDFTools.i18n.t('rotate.view_page')) || 'Enlarge page preview';
      const tDelete = (PDFTools.i18n && PDFTools.i18n.t('rotate.delete_page')) || 'Delete page';

      res.pageCards.forEach((card, idx) => {
        rotations[idx] = 0;

        // Top Actions Toolbar (Rotate Left, Rotate Right, Enlarge View, Delete Page)
        const actionsBar = document.createElement('div');
        actionsBar.className = 'page-card-actions';

        const rotLeftBtn = document.createElement('button');
        rotLeftBtn.type = 'button';
        rotLeftBtn.className = 'page-action-btn page-action-rotate-left';
        rotLeftBtn.title = tLeft;
        rotLeftBtn.setAttribute('aria-label', `${tLeft} (${idx + 1})`);
        rotLeftBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><polyline points="3 3 3 8 8 8"/></svg>';

        const rotRightBtn = document.createElement('button');
        rotRightBtn.type = 'button';
        rotRightBtn.className = 'page-action-btn page-action-rotate-right';
        rotRightBtn.title = tRight;
        rotRightBtn.setAttribute('aria-label', `${tRight} (${idx + 1})`);
        rotRightBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>';

        const viewBtn = document.createElement('button');
        viewBtn.type = 'button';
        viewBtn.className = 'page-action-btn page-action-view';
        viewBtn.title = tView;
        viewBtn.setAttribute('aria-label', `${tView} (${idx + 1})`);
        viewBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';

        const deleteBtn = document.createElement('button');
        deleteBtn.type = 'button';
        deleteBtn.className = 'page-action-btn page-action-delete';
        deleteBtn.title = tDelete;
        deleteBtn.setAttribute('aria-label', `${tDelete} (${idx + 1})`);
        deleteBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>';

        actionsBar.appendChild(rotLeftBtn);
        actionsBar.appendChild(rotRightBtn);
        actionsBar.appendChild(viewBtn);
        actionsBar.appendChild(deleteBtn);

        card.insertBefore(actionsBar, card.firstChild);

        const badge = document.createElement('div');
        badge.className = 'rotate-badge';
        badge.textContent = '+90°';
        card.appendChild(badge);

        rotLeftBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          rotations[idx] = ((rotations[idx] || 0) - 90 + 360) % 360;
          updateCardRotation(card, rotations[idx]);
          if (previewModal.style.display === 'flex' && modalCurrentIndex === idx) {
            modalCanvas.style.transform = `rotate(${rotations[idx]}deg)`;
          }
        });

        rotRightBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          rotations[idx] = ((rotations[idx] || 0) + 90) % 360;
          updateCardRotation(card, rotations[idx]);
          if (previewModal.style.display === 'flex' && modalCurrentIndex === idx) {
            modalCanvas.style.transform = `rotate(${rotations[idx]}deg)`;
          }
        });

        viewBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          openPreviewModal(idx);
        });

        deleteBtn.addEventListener('click', function (e) {
          e.stopPropagation();
          handleDeletePage(idx, card);
        });

        card.addEventListener('click', function (e) {
          if (e.target.closest('.page-action-btn') || e.target.closest('.page-card-actions')) return;
          rotations[idx] = ((rotations[idx] || 0) + 90) % 360;
          updateCardRotation(card, rotations[idx]);
        });
      });
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        if (files && files[0]) await loadFile(files[0]);
      }
    });

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: false,
        enabled: () => Boolean(currentFile),
        hasUnsavedWork: () => deletedPages.size > 0 || Object.values(rotations).some(deg => deg !== 0),
        onFiles: async (files) => {
          if (files && files[0]) await loadFile(files[0]);
        }
      });
    }

    document.getElementById('rotateLeftAllBtn').addEventListener('click', () => rotateAllBy(-90));
    document.getElementById('rotateRightAllBtn').addEventListener('click', () => rotateAllBy(90));
    document.getElementById('rotate180AllBtn').addEventListener('click', () => rotateAllBy(180));

    applyRotateBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      applyRotateBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        rotatedPdfBytes = await PDFTools.Rotate.rotate(
          currentFile,
          rotations,
          function (percent, text) {
            progress.update(percent, text);
          },
          { deletedPages: Array.from(deletedPages) }
        );

        progress.hide();
        controlsPanel.style.display = 'none';
        pageGrid.style.display = 'none';
        actionBar.classList.remove('active');
        resultArea.classList.add('active');

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Rotate PDF', 'rotate');
        }

        PDFTools.Toast.success(PDFTools.i18n.t('result.rotate_success'));
      } catch (err) {
        console.error(err);
        progress.hide();
        PDFTools.Toast.error(err.message || PDFTools.i18n.t('toast.error'));
        applyRotateBtn.disabled = false;
      }
    });

    // Check for pending handoff file from homepage (B1)
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(async file => {
        if (file) {
          await loadFile(file);
        }
      });
    }

    downloadBtn.addEventListener('click', function () {
      if (rotatedPdfBytes) {
        PDFTools.Download.save(rotatedPdfBytes, `${currentFile.name.replace(/\.pdf$/i, '')}_rotated.pdf`);
      }
    });

    const openStudioBtn = document.getElementById('openStudioBtn');
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (rotatedPdfBytes && currentFile) {
          const blob = new Blob([rotatedPdfBytes], { type: 'application/pdf' });
          const file = new File([blob], `${currentFile.name.replace(/\.pdf$/i, '')}_rotated.pdf`, { type: 'application/pdf' });
          if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
            PDFTools.FileUtils.setPendingFile(file);
          }
          window.location.href = 'viewer.html';
        }
      });
    }

    resetBtn.addEventListener('click', function () {
      closePreviewModal();
      pdfjsDoc = null;
      currentFile = null;
      rotatedPdfBytes = null;
      rotations = {};
      deletedPages.clear();
      applyRotateBtn.disabled = false;
      resultArea.classList.remove('active');
      dropzoneEl.style.display = 'block';
      controlsPanel.style.display = 'none';
      pageGrid.style.display = 'none';
      pageGrid.innerHTML = '';
    });
  });
})();
