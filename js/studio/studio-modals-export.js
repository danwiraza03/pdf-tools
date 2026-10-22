/**
 * PDF Tools — PDF Studio In-Studio Tool Dialogs & Document Export
 * Manages direct in-editor tool dialogs (Watermark, Page Numbering, Protect Password,
 * Compress, Flatten, Crop, Grayscale, Header & Footer, Bates Numbering,
 * Properties/Accessibility, Document Compare, Sanitize) and final Document Export & Printing.
 */
window.PDFTools = window.PDFTools || {};

window.PDFTools.StudioModalsExport = (function () {
  let ctx = null;
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

  function setDocumentDirty(dirty) {
    if (ctx && ctx.setDocumentDirty) ctx.setDocumentDirty(dirty);
  }

  function scheduleRecovery() {
    if (ctx && ctx.scheduleRecovery) ctx.scheduleRecovery();
  }

  async function openDocument(file) {
    if (ctx && ctx.openDocument) {
      await ctx.openDocument(file);
    }
  }

  // --- Watermark Dialog ---

  function openWatermarkModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const watermarkModal = document.getElementById('watermarkModal');
    if (watermarkModal) watermarkModal.classList.add('active');
  }

  function closeWatermarkModal() {
    const watermarkModal = document.getElementById('watermarkModal');
    if (watermarkModal) watermarkModal.classList.remove('active');
  }

  async function applyWatermark() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const applyWatermarkBtn = document.getElementById('applyWatermarkBtn');
    const watermarkTextInput = document.getElementById('watermarkTextInput');
    const watermarkOpacityInput = document.getElementById('watermarkOpacityInput');
    const watermarkRotationInput = document.getElementById('watermarkRotationInput');

    if (applyWatermarkBtn) {
      applyWatermarkBtn.disabled = true;
      applyWatermarkBtn.textContent = 'Applying...';
    }

    try {
      const options = {
        type: 'text',
        text: watermarkTextInput ? watermarkTextInput.value || 'CONFIDENTIAL' : 'CONFIDENTIAL',
        opacity: parseFloat(watermarkOpacityInput ? watermarkOpacityInput.value || 0.3 : 0.3),
        rotation: parseInt(watermarkRotationInput ? watermarkRotationInput.value || 45 : 45, 10),
        fontSize: 48,
        color: '#333333'
      };
      let buffer = currentDoc.arrayBuffer;
      if (!buffer || currentDoc.dirty) {
        const baked = await window.PDFTools.Studio.exportDocument(currentDoc);
        buffer = baked.buffer || baked;
      }
      const fileToWatermark = new File([buffer], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      const outputBytes = await window.PDFTools.Watermark.addWatermark(fileToWatermark, options);
      const newFile = new File([outputBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      closeWatermarkModal();
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Watermark applied to document! (Save PDF at the end to export)');
      }
    } catch (err) {
      console.error(err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Failed to apply watermark.');
    } finally {
      if (applyWatermarkBtn) {
        applyWatermarkBtn.disabled = false;
        applyWatermarkBtn.textContent = 'Apply to Document';
      }
    }
  }

  // --- Protect Password Dialog ---

  function openProtectModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const protectModal = document.getElementById('protectModal');
    if (protectModal) protectModal.classList.add('active');
  }

  function closeProtectModal() {
    const protectModal = document.getElementById('protectModal');
    if (protectModal) protectModal.classList.remove('active');
  }

  function applyProtect() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const studioProtectPassword = document.getElementById('studioProtectPassword');
    const pass = studioProtectPassword ? studioProtectPassword.value : '';
    if (!pass) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error('Please enter a password.');
      return;
    }
    currentDoc.pendingPassword = pass;
    setDocumentDirty(true);
    closeProtectModal();
    if (studioProtectPassword) studioProtectPassword.value = '';

    const tabDocName = ctx?.getTabDocName?.() || document.getElementById('tabDocName');
    if (tabDocName) {
      tabDocName.textContent = `${currentDoc.fileName} [Encrypted] *`;
    }
    if (window.PDFTools?.Toast) {
      window.PDFTools.Toast.success('Password protection enabled! Document will be encrypted when you click Save PDF.');
    }
  }

  // --- Page Numbering Dialog ---

  function openPageNumberModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const pageNumberModal = document.getElementById('pageNumberModal');
    if (pageNumberModal) pageNumberModal.classList.add('active');
  }

  function closePageNumberModal() {
    const pageNumberModal = document.getElementById('pageNumberModal');
    if (pageNumberModal) pageNumberModal.classList.remove('active');
  }

  async function applyPageNumbers() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const applyPageNumberBtn = document.getElementById('applyPageNumberBtn');
    const studioPageNumFormat = document.getElementById('studioPageNumFormat');
    const studioPageNumPos = document.getElementById('studioPageNumPos');

    if (applyPageNumberBtn) {
      applyPageNumberBtn.disabled = true;
      applyPageNumberBtn.textContent = 'Applying...';
    }

    try {
      const options = {
        format: studioPageNumFormat ? studioPageNumFormat.value : 'page_of_total',
        position: studioPageNumPos ? studioPageNumPos.value : 'bottom-center',
        fontSize: 10,
        color: '#333333',
        margin: 25
      };
      let buffer = currentDoc.arrayBuffer;
      if (!buffer || currentDoc.dirty) {
        const baked = await window.PDFTools.Studio.exportDocument(currentDoc);
        buffer = baked.buffer || baked;
      }
      const fileToNumber = new File([buffer], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      const outputBytes = await window.PDFTools.PageNumber.applyPageNumbers(fileToNumber, options);
      const newFile = new File([outputBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      closePageNumberModal();
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Page numbers applied across all pages! (Save PDF at the end to export)');
      }
    } catch (err) {
      console.error(err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Failed to number pages.');
    } finally {
      if (applyPageNumberBtn) {
        applyPageNumberBtn.disabled = false;
        applyPageNumberBtn.textContent = 'Apply to Document';
      }
    }
  }

  // --- Compress PDF Dialog & Engine ---

  function openCompressModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      const msg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('toast.open_first') : 'Please open a PDF document first.';
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info(msg);
      return;
    }
    const compressDocNameLabel = document.getElementById('compressDocNameLabel');
    const compressDocSizeLabel = document.getElementById('compressDocSizeLabel');
    const compressProgressBox = document.getElementById('compressProgressBox');
    const compressOptionsGroup = document.getElementById('compressOptionsGroup');
    const confirmCompressBtn = document.getElementById('confirmCompressBtn');
    const cancelCompressBtn = document.getElementById('cancelCompressBtn');
    const compressModal = document.getElementById('compressModal');

    if (compressDocNameLabel) compressDocNameLabel.textContent = currentDoc.fileName || 'document.pdf';
    if (compressDocSizeLabel) {
      const sz = (currentDoc.file && currentDoc.file.size) ? currentDoc.file.size : (currentDoc.arrayBuffer ? currentDoc.arrayBuffer.byteLength : 0);
      compressDocSizeLabel.textContent = window.PDFTools.FileUtils.formatFileSize(sz);
    }
    if (compressProgressBox) compressProgressBox.style.display = 'none';
    if (compressOptionsGroup) compressOptionsGroup.style.display = 'flex';
    if (confirmCompressBtn) {
      confirmCompressBtn.disabled = false;
      confirmCompressBtn.innerHTML = '<svg class="btn-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14h6m0 0v6m0-6L3 21"/><path d="M20 10h-6m0 0V4m0 6l7-7"/></svg> Compress & Apply';
    }
    if (cancelCompressBtn) cancelCompressBtn.disabled = false;
    if (compressModal) {
      compressModal.classList.add('active');
      compressModal.style.display = 'flex';
    }
  }

  function closeCompressModal() {
    const compressModal = document.getElementById('compressModal');
    if (compressModal) {
      compressModal.classList.remove('active');
      compressModal.style.display = 'none';
    }
  }

  async function confirmCompress() {
    const currentDoc = getDoc();
    if (!currentDoc) return;

    const confirmCompressBtn = document.getElementById('confirmCompressBtn');
    const cancelCompressBtn = document.getElementById('cancelCompressBtn');
    const compressOptionsGroup = document.getElementById('compressOptionsGroup');
    const compressProgressBox = document.getElementById('compressProgressBox');
    const compressProgressBar = document.getElementById('compressProgressBar');
    const compressProgressPercent = document.getElementById('compressProgressPercent');
    const compressProgressStatus = document.getElementById('compressProgressStatus');

    const selectedRadio = document.querySelector('input[name="studioCompressLevel"]:checked');
    const level = selectedRadio ? selectedRadio.value : 'medium';

    if (confirmCompressBtn) confirmCompressBtn.disabled = true;
    if (cancelCompressBtn) cancelCompressBtn.disabled = true;
    if (compressOptionsGroup) compressOptionsGroup.style.display = 'none';
    if (compressProgressBox) compressProgressBox.style.display = 'block';
    if (compressProgressBar) compressProgressBar.style.width = '0%';
    if (compressProgressPercent) compressProgressPercent.textContent = '0%';
    if (compressProgressStatus) {
      const procMsg = window.PDFTools?.i18n?.t ? window.PDFTools.i18n.t('common.processing') : 'Compressing document...';
      compressProgressStatus.textContent = procMsg;
    }

    try {
      let bufferToCompress = currentDoc.arrayBuffer;
      if (!bufferToCompress || currentDoc.dirty) {
        const bakedBytes = await window.PDFTools.Studio.exportDocument(currentDoc, (p, msg) => {
          if (compressProgressStatus) compressProgressStatus.textContent = msg || 'Preparing document...';
        });
        bufferToCompress = bakedBytes.buffer || bakedBytes;
      }

      const fileToCompress = new File([bufferToCompress], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });

      const res = await window.PDFTools.Compress.compress(fileToCompress, level, (pct, statusText) => {
        if (compressProgressBar) compressProgressBar.style.width = `${pct}%`;
        if (compressProgressPercent) compressProgressPercent.textContent = `${pct}%`;
        if (compressProgressStatus && statusText) compressProgressStatus.textContent = statusText;
      });

      if (!res || !res.bytes) {
        throw new Error('Compression returned invalid output data.');
      }

      const newFile = new File([res.bytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      closeCompressModal();

      const origStr = window.PDFTools.FileUtils.formatFileSize(res.originalSize);
      const newStr = window.PDFTools.FileUtils.formatFileSize(res.newSize);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success(`Compressed: ${origStr} &rarr; ${newStr} (-${res.savedPercent}%) in editor! (Save PDF at the end to export)`);
      }
    } catch (err) {
      console.error('[Compress Error]', err);
      if (compressProgressBox) compressProgressBox.style.display = 'none';
      if (compressOptionsGroup) compressOptionsGroup.style.display = 'flex';
      if (confirmCompressBtn) confirmCompressBtn.disabled = false;
      if (cancelCompressBtn) cancelCompressBtn.disabled = false;
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Compression failed.');
    }
  }

  // --- Flatten PDF Trigger ---

  async function triggerFlatten() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Flattening document and locking form layers in editor...');
    try {
      let buffer = currentDoc.arrayBuffer;
      if (!buffer || currentDoc.dirty) {
        const baked = await window.PDFTools.Studio.exportDocument(currentDoc);
        buffer = baked.buffer || baked;
      }
      const fileToFlat = new File([buffer], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      const flatBytes = await window.PDFTools.Flatten.flattenPdf(fileToFlat, { mode: 'vector' });
      const newFile = new File([flatBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('PDF flattened and all layers locked! (Save PDF at the end to export)');
      }
    } catch (err) {
      console.error(err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Flattening failed.');
    }
  }

  // --- Crop & Trim Dialog ---

  function openCropModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const cropModal = document.getElementById('cropModal');
    if (cropModal) cropModal.classList.add('active');
  }

  function closeCropModal() {
    const cropModal = document.getElementById('cropModal');
    if (cropModal) cropModal.classList.remove('active');
  }

  async function applyCrop() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const applyCropBtn = document.getElementById('applyCropBtn');
    if (applyCropBtn) {
      applyCropBtn.disabled = true;
      applyCropBtn.textContent = 'Cropping...';
    }

    try {
      const selectedRadio = document.querySelector('input[name="studioCropPreset"]:checked')?.value || 'auto10';
      const allPages = document.getElementById('cropAllPagesCheck')?.checked;

      let cropBox;
      if (selectedRadio === 'auto10') {
        cropBox = { x: 0.05, y: 0.05, width: 0.9, height: 0.9, normalized: true, fromTopLeft: true };
      } else if (selectedRadio === 'auto15') {
        cropBox = { x: 0.075, y: 0.075, width: 0.85, height: 0.85, normalized: true, fromTopLeft: true };
      } else {
        const tb = parseFloat(document.getElementById('cropMarginTopBottom')?.value || 36);
        const lr = parseFloat(document.getElementById('cropMarginLeftRight')?.value || 36);
        cropBox = { x: lr, y: tb, width: -1, height: -1, customCut: { lr, tb }, fromTopLeft: true };
      }

      let buffer = currentDoc.arrayBuffer;
      if (!buffer || currentDoc.dirty) {
        const baked = await window.PDFTools.Studio.exportDocument(currentDoc);
        buffer = baked.buffer || baked;
      }
      const fileToCrop = new File([buffer], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });

      const options = {
        mode: allPages ? 'all' : 'custom',
        cropBox: cropBox
      };
      if (!allPages) {
        options.pageCrops = { [currentDoc.currentPage]: cropBox };
      }

      const croppedBytes = await window.PDFTools.Crop.cropPdf(fileToCrop, options);
      const newFile = new File([croppedBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      closeCropModal();
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Crop margins applied to document! (Save PDF at the end to export)');
      }
    } catch (err) {
      console.error(err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Crop failed.');
    } finally {
      if (applyCropBtn) {
        applyCropBtn.disabled = false;
        applyCropBtn.textContent = 'Apply Crop to Document';
      }
    }
  }

  // --- Grayscale Conversion Trigger ---

  async function triggerGrayscale() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Converting document to grayscale in editor...');
    try {
      let buffer = currentDoc.arrayBuffer;
      if (!buffer || currentDoc.dirty) {
        const baked = await window.PDFTools.Studio.exportDocument(currentDoc);
        buffer = baked.buffer || baked;
      }
      const fileToGray = new File([buffer], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      const grayBytes = await window.PDFTools.Grayscale.convertToGrayscale(fileToGray, { mode: 'grayscale' });
      const newFile = new File([grayBytes], currentDoc.fileName || 'document.pdf', { type: 'application/pdf' });
      await openDocument(newFile);
      setDocumentDirty(true);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Document converted to grayscale in editor! (Save PDF at the end to export)');
      }
    } catch (err) {
      console.error(err);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error(err.message || 'Grayscale conversion failed.');
    }
  }

  // --- Header & Footer Dialog ---

  function openHeaderFooterModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const headerFooterModal = document.getElementById('headerFooterModal');
    if (headerFooterModal) headerFooterModal.classList.add('active');
  }

  function closeHeaderFooterModal() {
    const headerFooterModal = document.getElementById('headerFooterModal');
    if (headerFooterModal) headerFooterModal.classList.remove('active');
  }

  function applyHeaderFooter() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const options = {
      headerLeft: document.getElementById('hfTopLeft')?.value || '',
      headerCenter: document.getElementById('hfTopCenter')?.value || '',
      headerRight: document.getElementById('hfTopRight')?.value || '',
      footerLeft: document.getElementById('hfBottomLeft')?.value || '',
      footerCenter: document.getElementById('hfBottomCenter')?.value || '',
      footerRight: document.getElementById('hfBottomRight')?.value || ''
    };
    window.PDFTools.PageToolsEngine.applyHeaderFooter(currentDoc, options);
    closeHeaderFooterModal();
    scheduleRecovery();
    if (window.PDFTools?.Toast) {
      window.PDFTools.Toast.success('Header & Footer applied across all pages!');
    }
  }

  // --- Bates Numbering Dialog ---

  function openBatesModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const batesNumberingModal = document.getElementById('batesNumberingModal');
    if (batesNumberingModal) batesNumberingModal.classList.add('active');
  }

  function closeBatesModal() {
    const batesNumberingModal = document.getElementById('batesNumberingModal');
    if (batesNumberingModal) batesNumberingModal.classList.remove('active');
  }

  function applyBatesNumbering() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    const options = {
      prefix: document.getElementById('batesPrefix')?.value || '',
      suffix: document.getElementById('batesSuffix')?.value || '',
      startNumber: document.getElementById('batesStartNum')?.value || 1,
      numDigits: document.getElementById('batesNumDigits')?.value || 6,
      position: document.getElementById('batesPosition')?.value || 'bottom-right'
    };
    window.PDFTools.PageToolsEngine.applyBatesNumbering(currentDoc, options);
    closeBatesModal();
    scheduleRecovery();
    if (window.PDFTools?.Toast) {
      window.PDFTools.Toast.success('Bates Numbering applied across all pages!');
    }
  }

  // --- Document Properties & Accessibility Modal ---

  async function openDocProperties() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const meta = await window.PDFTools.AccessibilityEngine.extractMetadata(currentDoc.pdfJsDoc);
    const propTitle = document.getElementById('propTitle');
    const propAuthor = document.getElementById('propAuthor');
    const propSubject = document.getElementById('propSubject');
    const propKeywords = document.getElementById('propKeywords');

    if (propTitle) propTitle.value = meta.title || '';
    if (propAuthor) propAuthor.value = meta.author || '';
    if (propSubject) propSubject.value = meta.subject || '';
    if (propKeywords) propKeywords.value = meta.keywords || '';

    const accessReport = window.PDFTools.AccessibilityEngine.checkAccessibility(meta, currentDoc.getActivePagesList().length);
    const accessBadge = document.getElementById('accessScoreBadge');
    if (accessBadge) {
      accessBadge.textContent = `Conformance Score: ${accessReport.score}% (${accessReport.score >= 80 ? 'Passing' : 'Needs Optimization'})`;
      accessBadge.style.background = accessReport.score >= 80 ? '#064E3B' : '#78350F';
      accessBadge.style.color = accessReport.score >= 80 ? '#A7F3D0' : '#FDE68A';
    }

    const checkList = document.getElementById('accessCheckList');
    if (checkList) {
      checkList.innerHTML = '';
      accessReport.checks.forEach(c => {
        const item = document.createElement('div');
        item.style.cssText = `display: flex; align-items: center; gap: 8px; color: ${c.passed ? '#10B981' : '#F59E0B'};`;
        const iconSpan = document.createElement('span');
        iconSpan.innerHTML = c.passed
          ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>'
          : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
        const textSpan = document.createElement('span');
        const strong = document.createElement('strong');
        strong.textContent = (c.name || '') + ': ';
        textSpan.appendChild(strong);
        textSpan.appendChild(document.createTextNode(c.message || ''));
        item.appendChild(iconSpan);
        item.appendChild(textSpan);
        checkList.appendChild(item);
      });
    }

    const docPropertiesModal = document.getElementById('docPropertiesModal');
    if (docPropertiesModal) docPropertiesModal.classList.add('active');
  }

  function closeDocProperties() {
    const docPropertiesModal = document.getElementById('docPropertiesModal');
    if (docPropertiesModal) docPropertiesModal.classList.remove('active');
  }

  function applyDocProperties() {
    const currentDoc = getDoc();
    if (!currentDoc) return;
    if (!currentDoc.metadata) currentDoc.metadata = {};
    const propTitle = document.getElementById('propTitle');
    const propAuthor = document.getElementById('propAuthor');
    const propSubject = document.getElementById('propSubject');
    const propKeywords = document.getElementById('propKeywords');

    if (propTitle) currentDoc.metadata.title = propTitle.value.trim();
    if (propAuthor) currentDoc.metadata.author = propAuthor.value.trim();
    if (propSubject) currentDoc.metadata.subject = propSubject.value.trim();
    if (propKeywords) currentDoc.metadata.keywords = propKeywords.value.trim();

    closeDocProperties();
    scheduleRecovery();
    if (window.PDFTools?.Toast) {
      window.PDFTools.Toast.success('Document metadata updated!');
    }
  }

  // --- Compare Two PDF Documents Modal ---

  function openCompareModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a base PDF document first.');
      return;
    }
    const compareDocsModal = document.getElementById('compareDocsModal');
    const compareResultsArea = document.getElementById('compareResultsArea');
    if (compareDocsModal) compareDocsModal.classList.add('active');
    if (compareResultsArea) compareResultsArea.style.display = 'none';
  }

  function closeCompareModal() {
    const compareDocsModal = document.getElementById('compareDocsModal');
    if (compareDocsModal) compareDocsModal.classList.remove('active');
  }

  async function runCompare() {
    const compareFileInput = document.getElementById('compareFileInput');
    const runCompareBtn = document.getElementById('runCompareBtn');
    const compareResultsArea = document.getElementById('compareResultsArea');
    const file = compareFileInput?.files?.[0];
    const currentDoc = getDoc();

    if (!file || !currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please select a second PDF file to compare.');
      return;
    }
    if (runCompareBtn) {
      runCompareBtn.disabled = true;
      runCompareBtn.textContent = 'Comparing...';
    }

    try {
      const fileData = await window.PDFTools.FileUtils.readAsArrayBuffer(file);
      const pdfJsDocB = await window.pdfjsLib.getDocument({ data: new Uint8Array(fileData).slice(0) }).promise;
      const docB = {
        fileName: file.name,
        pdfJsDoc: pdfJsDocB,
        getActivePagesList: () => Array.from({ length: pdfJsDocB.numPages }, (_, i) => i + 1)
      };

      const report = await window.PDFTools.CompareEngine.compareDocuments(currentDoc, docB);
      if (compareResultsArea) {
        compareResultsArea.style.display = 'block';
        compareResultsArea.innerHTML = `
          <div style="font-weight: bold; margin-bottom: 8px; color: ${report.totalDifferences > 0 ? '#F59E0B' : '#10B981'};">
            ${report.totalDifferences > 0 ? `Found differences on ${report.totalDifferences} page(s)` : 'Documents are text-identical!'}
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            ${report.pageDiffs.map(d => `
              <div style="padding: 6px; background: #111827; border-radius: 4px; border-left: 3px solid ${d.identical ? '#10B981' : '#EF4444'};">
                <strong>Page ${d.pageIndex}:</strong> ${d.identical ? '<span style="color:#10B981;">No changes</span>' : '<span style="color:#EF4444;">Content modified</span>'}
              </div>
            `).join('')}
          </div>
        `;
      }
    } catch (compErr) {
      console.error(compErr);
      if (window.PDFTools?.Toast) window.PDFTools.Toast.error('Failed to compare documents.');
    } finally {
      if (runCompareBtn) {
        runCompareBtn.disabled = false;
        runCompareBtn.textContent = 'Run Comparison';
      }
    }
  }

  // --- Sanitize Metadata Trigger ---

  async function triggerSanitize() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    let ok = true;
    if (window.PDFTools?.Modal?.confirm) {
      ok = await window.PDFTools.Modal.confirm('Sanitize and remove all metadata, author names, producer info, and hidden layer tags?', { title: 'Sanitize Metadata', isDanger: true });
    }
    if (ok) {
      currentDoc.sanitized = true;
      scheduleRecovery();
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success('Document marked for complete metadata sanitization!');
      }
    }
  }

  // --- Save As Modal & Final PDF Export ---

  function openSaveAsModal() {
    const currentDoc = getDoc();
    if (!currentDoc) {
      if (window.PDFTools?.Toast) window.PDFTools.Toast.info('Please open a PDF document first.');
      return;
    }
    const saveAsModal = document.getElementById('saveAsModal');
    const saveAsFileNameInput = document.getElementById('saveAsFileNameInput');
    if (saveAsFileNameInput) {
      const baseName = currentDoc.fileName.replace(/\.pdf$/i, '');
      saveAsFileNameInput.value = `${baseName}_edited`;
    }
    if (saveAsModal) saveAsModal.classList.add('active');
    setTimeout(() => {
      if (saveAsFileNameInput) {
        saveAsFileNameInput.focus();
        saveAsFileNameInput.select();
      }
    }, 50);
  }

  function closeSaveAsModal() {
    const saveAsModal = document.getElementById('saveAsModal');
    if (saveAsModal) saveAsModal.classList.remove('active');
  }

  async function saveDocument(customName = null) {
    const currentDoc = getDoc();
    if (!currentDoc) return;

    // Digital Signature Check
    try {
      if (currentDoc.file && window.PDFTools?.SignatureInspector) {
        const buffer = await window.PDFTools.FileUtils.readAsArrayBuffer(currentDoc.file);
        const sigInfo = window.PDFTools.SignatureInspector.inspect(buffer);
        if (sigInfo.hasSignatures) {
          const proceed = await window.PDFTools.SignatureInspector.confirmSignedDocModification();
          if (!proceed) return;
        }
      }
    } catch (e) {}

    const savePdfBtn = ctx?.getSavePdfBtn?.() || document.getElementById('savePdfBtn');
    if (savePdfBtn) {
      savePdfBtn.disabled = true;
      savePdfBtn.textContent = 'Saving...';
    }

    try {
      let exportedBytes = await window.PDFTools.Studio.exportDocument(currentDoc, (pct) => {
        if (savePdfBtn) savePdfBtn.textContent = `Saving ${pct}%...`;
      });

      if (currentDoc.pendingPassword && window.PDFTools?.Protect?.protectPdf) {
        if (savePdfBtn) savePdfBtn.textContent = 'Encrypting...';
        exportedBytes = await window.PDFTools.Protect.protectPdf(
          exportedBytes,
          currentDoc.pendingPassword,
          currentDoc.pendingPassword
        );
      }

      let finalFileName = customName;
      if (!finalFileName) {
        const baseName = currentDoc.fileName.replace(/\.pdf$/i, '');
        finalFileName = `${baseName}_edited.pdf`;
      }
      if (!finalFileName.toLowerCase().endsWith('.pdf')) {
        finalFileName += '.pdf';
      }

      window.PDFTools.Download.save(exportedBytes, finalFileName);
      try {
        await window.PDFTools.Studio.clearRecoverySnapshot();
      } catch (recoveryErr) {
        console.warn('Recovery cleanup unavailable:', recoveryErr);
      }
      setDocumentDirty(false);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.success(`PDF saved as "${finalFileName}"!`);
      }
      closeSaveAsModal();
    } catch (err) {
      console.error('Export error:', err);
      if (window.PDFTools?.Toast) {
        window.PDFTools.Toast.error(err.message || 'Failed to export PDF.');
      }
    } finally {
      if (savePdfBtn) {
        savePdfBtn.disabled = false;
        savePdfBtn.innerHTML = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg><span data-i18n="toolbar.save">Save PDF</span>';
      }
    }
  }

  const triggerPrint = () => window.print();

  // --- Event Listeners Binding ---

  function bindEventListeners() {
    // Watermark
    document.getElementById('paneWatermark')?.addEventListener('click', openWatermarkModal);
    document.getElementById('menuToolWatermark')?.addEventListener('click', openWatermarkModal);
    document.getElementById('closeWatermarkModalBtn')?.addEventListener('click', closeWatermarkModal);
    document.getElementById('cancelWatermarkBtn')?.addEventListener('click', closeWatermarkModal);
    document.getElementById('applyWatermarkBtn')?.addEventListener('click', applyWatermark);

    // Protect
    document.getElementById('paneProtect')?.addEventListener('click', openProtectModal);
    document.getElementById('menuToolProtect')?.addEventListener('click', openProtectModal);
    document.getElementById('closeProtectModalBtn')?.addEventListener('click', closeProtectModal);
    document.getElementById('cancelProtectBtn')?.addEventListener('click', closeProtectModal);
    document.getElementById('applyProtectBtn')?.addEventListener('click', applyProtect);

    // Page Numbers
    document.getElementById('panePageNumbers')?.addEventListener('click', openPageNumberModal);
    document.getElementById('menuToolPageNumber')?.addEventListener('click', openPageNumberModal);
    document.getElementById('closePageNumberModalBtn')?.addEventListener('click', closePageNumberModal);
    document.getElementById('cancelPageNumberBtn')?.addEventListener('click', closePageNumberModal);
    document.getElementById('applyPageNumberBtn')?.addEventListener('click', applyPageNumbers);

    // Compress
    document.getElementById('paneCompressPdf')?.addEventListener('click', openCompressModal);
    document.getElementById('menuToolCompress')?.addEventListener('click', openCompressModal);
    document.getElementById('closeCompressModalBtn')?.addEventListener('click', closeCompressModal);
    document.getElementById('cancelCompressBtn')?.addEventListener('click', closeCompressModal);
    document.getElementById('confirmCompressBtn')?.addEventListener('click', confirmCompress);

    // Flatten & Grayscale
    document.getElementById('paneFlattenPdf')?.addEventListener('click', triggerFlatten);
    document.getElementById('paneGrayscalePdf')?.addEventListener('click', triggerGrayscale);

    // Crop
    document.getElementById('paneCropPdf')?.addEventListener('click', openCropModal);
    document.getElementById('closeCropModalBtn')?.addEventListener('click', closeCropModal);
    document.getElementById('cancelCropBtn')?.addEventListener('click', closeCropModal);
    document.getElementById('applyCropBtn')?.addEventListener('click', applyCrop);

    // Header & Footer
    document.getElementById('menuToolHeaderFooter')?.addEventListener('click', openHeaderFooterModal);
    document.getElementById('closeHeaderFooterModalBtn')?.addEventListener('click', closeHeaderFooterModal);
    document.getElementById('cancelHeaderFooterBtn')?.addEventListener('click', closeHeaderFooterModal);
    document.getElementById('applyHeaderFooterBtn')?.addEventListener('click', applyHeaderFooter);

    // Bates
    document.getElementById('menuToolBates')?.addEventListener('click', openBatesModal);
    document.getElementById('closeBatesModalBtn')?.addEventListener('click', closeBatesModal);
    document.getElementById('cancelBatesBtn')?.addEventListener('click', closeBatesModal);
    document.getElementById('applyBatesBtn')?.addEventListener('click', applyBatesNumbering);

    // Document Properties & Accessibility
    document.getElementById('menuDocProps')?.addEventListener('click', openDocProperties);
    document.getElementById('closeDocPropsModalBtn')?.addEventListener('click', closeDocProperties);
    document.getElementById('cancelDocPropsBtn')?.addEventListener('click', closeDocProperties);
    document.getElementById('applyDocPropsBtn')?.addEventListener('click', applyDocProperties);

    const tabPropsDescription = document.getElementById('tabPropsDescription');
    const tabPropsAccessibility = document.getElementById('tabPropsAccessibility');
    const viewPropsDescription = document.getElementById('viewPropsDescription');
    const viewPropsAccessibility = document.getElementById('viewPropsAccessibility');

    if (tabPropsDescription && tabPropsAccessibility) {
      tabPropsDescription.addEventListener('click', () => {
        tabPropsDescription.className = 'btn btn-primary btn-sm';
        tabPropsAccessibility.className = 'btn btn-ghost btn-sm';
        if (viewPropsDescription) viewPropsDescription.style.display = 'block';
        if (viewPropsAccessibility) viewPropsAccessibility.style.display = 'none';
      });
      tabPropsAccessibility.addEventListener('click', () => {
        tabPropsDescription.className = 'btn btn-ghost btn-sm';
        tabPropsAccessibility.className = 'btn btn-primary btn-sm';
        if (viewPropsDescription) viewPropsDescription.style.display = 'none';
        if (viewPropsAccessibility) viewPropsAccessibility.style.display = 'block';
      });
    }

    // Compare
    document.getElementById('menuToolCompare')?.addEventListener('click', openCompareModal);
    document.getElementById('closeCompareModalBtn')?.addEventListener('click', closeCompareModal);
    document.getElementById('closeCompareBtn')?.addEventListener('click', closeCompareModal);
    document.getElementById('runCompareBtn')?.addEventListener('click', runCompare);

    // Sanitize
    document.getElementById('menuToolSanitize')?.addEventListener('click', triggerSanitize);

    // Save As
    document.getElementById('menuSaveAsDoc')?.addEventListener('click', openSaveAsModal);
    document.getElementById('closeSaveAsModalBtn')?.addEventListener('click', closeSaveAsModal);
    document.getElementById('cancelSaveAsBtn')?.addEventListener('click', closeSaveAsModal);

    const saveAsFileNameInput = document.getElementById('saveAsFileNameInput');
    document.getElementById('confirmSaveAsBtn')?.addEventListener('click', () => {
      const chosenName = saveAsFileNameInput ? saveAsFileNameInput.value.trim() : '';
      saveDocument(chosenName || null);
    });

    if (saveAsFileNameInput) {
      saveAsFileNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const chosenName = saveAsFileNameInput.value.trim();
          saveDocument(chosenName || null);
        } else if (e.key === 'Escape') {
          closeSaveAsModal();
        }
      });
    }

    // Direct Save triggers
    document.getElementById('savePdfBtn')?.addEventListener('click', () => saveDocument());
    document.getElementById('paneSavePdf')?.addEventListener('click', () => saveDocument());
    document.getElementById('menuSaveDoc')?.addEventListener('click', () => saveDocument());

    // Print triggers
    document.getElementById('printDocBtn')?.addEventListener('click', triggerPrint);
    document.getElementById('menuPrintDoc')?.addEventListener('click', triggerPrint);
  }

  return {
    init,
    openWatermarkModal,
    closeWatermarkModal,
    applyWatermark,
    openProtectModal,
    closeProtectModal,
    applyProtect,
    openPageNumberModal,
    closePageNumberModal,
    applyPageNumbers,
    openCompressModal,
    closeCompressModal,
    confirmCompress,
    triggerCompress: openCompressModal,
    triggerFlatten,
    openCropModal,
    closeCropModal,
    applyCrop,
    triggerGrayscale,
    openHeaderFooterModal,
    closeHeaderFooterModal,
    applyHeaderFooter,
    openBatesModal,
    closeBatesModal,
    applyBatesNumbering,
    openDocProperties,
    closeDocProperties,
    applyDocProperties,
    openCompareModal,
    closeCompareModal,
    runCompare,
    triggerSanitize,
    openSaveAsModal,
    closeSaveAsModal,
    saveDocument,
    triggerPrint
  };
})();
