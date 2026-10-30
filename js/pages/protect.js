/**
 * PDF Tools — Protect & Unlock PDF Standalone Page Controller
 * Extracted from pages/protect.html
 */

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', function () {
    let currentMode = 'protect'; // 'protect' | 'unlock'
    let currentFile = null;
    let queuedFiles = [];
    let isBatchMode = false;
    let lastProcessedBytes = null;

    const tabProtect = document.getElementById('tabProtect');
    const tabUnlock = document.getElementById('tabUnlock');
    const dropzoneTitle = document.getElementById('dropzoneTitle');
    const uploadState = document.getElementById('uploadState');
    const workspaceState = document.getElementById('workspaceState');
    const fileNameLabel = document.getElementById('fileNameLabel');
    const fileSizeLabel = document.getElementById('fileSizeLabel');

    const protectControls = document.getElementById('protectControls');
    const unlockControls = document.getElementById('unlockControls');
    const protectUserPassword = document.getElementById('protectUserPassword');
    const protectConfirmPassword = document.getElementById('protectConfirmPassword');
    const unlockPasswordInput = document.getElementById('unlockPasswordInput');

    const permPrinting = document.getElementById('permPrinting');
    const permCopying = document.getElementById('permCopying');
    const permModifying = document.getElementById('permModifying');
    const permAnnotating = document.getElementById('permAnnotating');

    const btnApplyProtect = document.getElementById('btnApplyProtect');
    const btnApplyUnlock = document.getElementById('btnApplyUnlock');
    const resetBtn = document.getElementById('resetBtn');
    const openStudioBtn = document.getElementById('openStudioBtn');

    function switchTab(mode) {
      currentMode = mode;
      if (mode === 'protect') {
        tabProtect.classList.add('btn-primary', 'active');
        tabProtect.classList.remove('btn-ghost');
        tabUnlock.classList.add('btn-ghost');
        tabUnlock.classList.remove('btn-primary', 'active');

        dropzoneTitle.textContent = PDFTools.i18n ? PDFTools.i18n.t('protect.drop_title_protect') : 'Drop PDF file to protect';
        protectControls.style.display = 'block';
        unlockControls.style.display = 'none';
      } else {
        tabUnlock.classList.add('btn-primary', 'active');
        tabUnlock.classList.remove('btn-ghost');
        tabProtect.classList.add('btn-ghost');
        tabProtect.classList.remove('btn-primary', 'active');

        dropzoneTitle.textContent = PDFTools.i18n ? PDFTools.i18n.t('protect.drop_title_unlock') : 'Drop protected PDF file to unlock';
        protectControls.style.display = 'none';
        unlockControls.style.display = 'block';
      }
    }

    tabProtect.addEventListener('click', () => switchTab('protect'));
    tabUnlock.addEventListener('click', () => switchTab('unlock'));

    function getPermissions() {
      return {
        printing: permPrinting.checked ? 'highResolution' : false,
        copying: Boolean(permCopying.checked),
        modifying: Boolean(permModifying.checked),
        annotating: Boolean(permAnnotating.checked),
        fillingForms: Boolean(permAnnotating.checked)
      };
    }

    PDFTools.Dropzone('dropzone', {
      accept: '.pdf',
      multiple: true,
      onFiles: function (files) {
        if (files.length > 0) {
          queuedFiles = files;
          currentFile = files[0];
          isBatchMode = (currentMode === 'protect' && files.length > 1);

          if (isBatchMode) {
            fileNameLabel.textContent = `Batch Queue: ${files.length} Files Selected`;
            fileSizeLabel.textContent = `Primary: ${currentFile.name}`;
            btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt ${files.length} Documents & Download (.ZIP)</span>`;
          } else {
            fileNameLabel.textContent = currentFile.name;
            fileSizeLabel.textContent = PDFTools.FileUtils.formatSize(currentFile.size);
            btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt & Download PDF</span>`;
          }

          uploadState.style.display = 'none';
          workspaceState.style.display = 'block';
        }
      }
    });

    function appendFiles(newFiles) {
      if (!newFiles || newFiles.length === 0) return;
      queuedFiles = queuedFiles.concat(newFiles);
      if (!currentFile && queuedFiles.length > 0) {
        currentFile = queuedFiles[0];
      }
      isBatchMode = (currentMode === 'protect' && queuedFiles.length > 1);
      if (isBatchMode) {
        fileNameLabel.textContent = `Batch Queue: ${queuedFiles.length} Files Selected`;
        fileSizeLabel.textContent = `Primary: ${currentFile.name}`;
        btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt ${queuedFiles.length} Documents & Download (.ZIP)</span>`;
      } else if (currentFile) {
        fileNameLabel.textContent = currentFile.name;
        fileSizeLabel.textContent = PDFTools.FileUtils.formatSize(currentFile.size);
        btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt & Download PDF</span>`;
      }
      if (PDFTools.Toast) {
        PDFTools.Toast.success(`${newFiles.length} ${PDFTools.i18n.t('toast.files_added')}`);
      }
    }

    if (PDFTools.PageDrop) {
      PDFTools.PageDrop.attach({
        accept: '.pdf',
        multiple: true,
        enabled: () => Boolean(currentFile || queuedFiles.length > 0),
        onFiles: appendFiles
      });
    }

    // Check for pending handoff file from homepage
    if (PDFTools.FileUtils && PDFTools.FileUtils.consumePendingFile) {
      PDFTools.FileUtils.consumePendingFile().then(file => {
        if (file) {
          queuedFiles = [file];
          currentFile = file;
          isBatchMode = false;
          fileNameLabel.textContent = currentFile.name;
          fileSizeLabel.textContent = PDFTools.FileUtils.formatSize(currentFile.size);
          uploadState.style.display = 'none';
          workspaceState.style.display = 'block';
        }
      });
    }

    btnApplyProtect.addEventListener('click', async () => {
      if (!queuedFiles || queuedFiles.length === 0) return;
      const pass1 = protectUserPassword.value;
      const pass2 = protectConfirmPassword.value;

      if (!pass1) {
        PDFTools.Toast.error(PDFTools.i18n ? PDFTools.i18n.t('protect.error_empty') : 'Please enter a password.');
        return;
      }
      if (pass1 !== pass2) {
        PDFTools.Toast.error(PDFTools.i18n ? PDFTools.i18n.t('protect.error_match') : 'Passwords do not match.');
        return;
      }

      btnApplyProtect.disabled = true;
      btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>${PDFTools.i18n ? PDFTools.i18n.t('protect.encrypting') : 'Encrypting PDF...'}</span>`;

      try {
        const permissions = getPermissions();
        if (isBatchMode && queuedFiles.length > 1) {
          const zip = new JSZip();
          const total = queuedFiles.length;

          for (let i = 0; i < total; i++) {
            const f = queuedFiles[i];
            btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>[${i + 1}/${total}] Encrypting ${f.name}...</span>`;
            const resBytes = await PDFTools.Protect.protectPdf(f, pass1, pass1, permissions);
            const outName = `${f.name.replace(/\.pdf$/i, '')}_protected.pdf`;
            zip.file(outName, resBytes);
          }

          const zipBlob = await zip.generateAsync({ type: 'blob' });
          saveAs(zipBlob, 'protected_documents.zip');
          PDFTools.Toast.success(`All ${total} documents encrypted with password into ZIP!`);
        } else {
          const outputBytes = await PDFTools.Protect.protectPdf(currentFile, pass1, pass1, permissions, (pct) => {
            btnApplyProtect.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>${pct}%</span>`;
          });
          lastProcessedBytes = outputBytes;
          const baseName = currentFile.name.replace(/\.pdf$/i, '');
          PDFTools.Download.save(outputBytes, `${baseName}_protected.pdf`);

          if (PDFTools.RecentFiles && currentFile) {
            PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Protect PDF', 'protect');
          }

          PDFTools.Toast.success(PDFTools.i18n ? PDFTools.i18n.t('protect.success_protect') : 'PDF encrypted successfully with password!');
        }
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Failed to protect PDF.');
      } finally {
        btnApplyProtect.disabled = false;
        btnApplyProtect.innerHTML = (isBatchMode && queuedFiles.length > 1) 
          ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt ${queuedFiles.length} Documents & Download (.ZIP)</span>` 
          : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg> <span>Encrypt & Download PDF</span>`;
        if (lastProcessedBytes && openStudioBtn) openStudioBtn.style.display = 'inline-flex';
      }
    });

    btnApplyUnlock.addEventListener('click', async () => {
      if (!currentFile) return;
      const pass = unlockPasswordInput.value;

      btnApplyUnlock.disabled = true;
      btnApplyUnlock.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>${PDFTools.i18n ? PDFTools.i18n.t('protect.unlocking') : 'Unlocking PDF...'}</span>`;

      try {
        const outputBytes = await PDFTools.Protect.unlockPdf(currentFile, pass, (pct) => {
          btnApplyUnlock.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg> <span>Unlocking (${pct}%)...</span>`;
        });
        lastProcessedBytes = outputBytes;
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        PDFTools.Download.save(outputBytes, `${baseName}_unlocked.pdf`);

        if (PDFTools.RecentFiles && currentFile) {
          PDFTools.RecentFiles.add(currentFile.name, currentFile.size, 'Unlock PDF', 'unlock');
        }

        PDFTools.Toast.success(PDFTools.i18n ? PDFTools.i18n.t('protect.success_unlock') : 'PDF unlocked successfully!');
      } catch (err) {
        console.error(err);
        PDFTools.Toast.error(err.message || 'Incorrect password.');
      } finally {
        btnApplyUnlock.disabled = false;
        btnApplyUnlock.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg> <span>Unlock & Download PDF</span>`;
        if (lastProcessedBytes && openStudioBtn) openStudioBtn.style.display = 'inline-flex';
      }
    });

    // Open in PDF Studio
    if (openStudioBtn) {
      openStudioBtn.addEventListener('click', () => {
        if (!lastProcessedBytes || !currentFile) return;
        const baseName = currentFile.name.replace(/\.pdf$/i, '');
        const blob = new Blob([lastProcessedBytes], { type: 'application/pdf' });
        const file = new File([blob], `${baseName}_processed.pdf`, { type: 'application/pdf' });
        if (PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
          PDFTools.FileUtils.setPendingFile(file);
        }
        window.location.href = 'viewer.html';
      });
    }

    resetBtn.addEventListener('click', () => {
      currentFile = null;
      lastProcessedBytes = null;
      protectUserPassword.value = '';
      protectConfirmPassword.value = '';
      unlockPasswordInput.value = '';
      if (openStudioBtn) openStudioBtn.style.display = 'none';
      workspaceState.style.display = 'none';
      uploadState.style.display = 'block';
    });
  });
})();
