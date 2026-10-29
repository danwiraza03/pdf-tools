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

    let currentFile = null;
    let rotations = {}; // pageIndex: degrees (0, 90, 180, 270)
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
        rotations[idx] = ((rotations[idx] || 0) + degDelta + 360) % 360;
        updateCardRotation(card, rotations[idx]);
      });
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: false,
      onFiles: async function (files) {
        currentFile = files[0];
        dropzoneEl.style.display = 'none';
        controlsPanel.style.display = 'block';
        pageGrid.style.display = 'grid';
        actionBar.classList.add('active');

        rotations = {};
        const res = await PDFTools.Preview.renderAllPages(currentFile, pageGrid, {
          selectable: false
        });

        // Add individual click to rotate handler
        res.pageCards.forEach((card, idx) => {
          rotations[idx] = 0;

          const badge = document.createElement('div');
          badge.className = 'rotate-badge';
          badge.textContent = '+90°';
          card.appendChild(badge);

          card.addEventListener('click', function () {
            rotations[idx] = (rotations[idx] + 90) % 360;
            updateCardRotation(card, rotations[idx]);
          });
        });
      }
    });

    document.getElementById('rotateLeftAllBtn').addEventListener('click', () => rotateAllBy(-90));
    document.getElementById('rotateRightAllBtn').addEventListener('click', () => rotateAllBy(90));
    document.getElementById('rotate180AllBtn').addEventListener('click', () => rotateAllBy(180));

    applyRotateBtn.addEventListener('click', async function () {
      if (!currentFile) return;

      applyRotateBtn.disabled = true;
      progress.show(PDFTools.i18n.t('action.processing'));

      try {
        rotatedPdfBytes = await PDFTools.Rotate.rotate(currentFile, rotations, function (percent, text) {
          progress.update(percent, text);
        });

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
          currentFile = file;
          dropzoneEl.style.display = 'none';
          controlsPanel.style.display = 'block';
          pageGrid.style.display = 'grid';
          actionBar.classList.add('active');

          rotations = {};
          const res = await PDFTools.Preview.renderAllPages(currentFile, pageGrid, { selectable: false });
          res.pageCards.forEach((card, idx) => {
            rotations[idx] = 0;
            const badge = document.createElement('div');
            badge.className = 'rotate-badge';
            badge.textContent = '+90°';
            card.appendChild(badge);
            card.addEventListener('click', function () {
              rotations[idx] = (rotations[idx] + 90) % 360;
              updateCardRotation(card, rotations[idx]);
            });
          });
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
      currentFile = null;
      rotatedPdfBytes = null;
      rotations = {};
      applyRotateBtn.disabled = false;
      resultArea.classList.remove('active');
      dropzoneEl.style.display = 'block';
      controlsPanel.style.display = 'none';
      pageGrid.style.display = 'none';
      pageGrid.innerHTML = '';
    });
  });
})();
