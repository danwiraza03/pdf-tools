/**
 * PDF Tools — Main Application Initializer & Global Controller
 */
document.addEventListener('DOMContentLoaded', function () {
  // --- 0. Setup Unified Global Header (Ensures 100% Consistency Across All Pages) ---
  function setupUnifiedHeader() {
    if (window.PDFTools && window.PDFTools.Header) {
      window.PDFTools.Header.init();
      return;
    }
    const header = document.querySelector('.header');
    if (!header || document.body.classList.contains('tool-page-viewer')) return;

    const isPagesDir = window.location.pathname.replace(/\\/g, '/').includes('/pages/');
    const homeUrl = isPagesDir ? '../index.html' : 'index.html';
    const pagesUrl = isPagesDir ? '' : 'pages/';

    // Path detect current file
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const currentFile = currentPath.split('/').pop() || 'index.html';

    // 1. Unified Header Inner HTML
    header.innerHTML = `
      <div class="header-inner">
        <!-- Logo: PDF Tools with Status Dot -->
        <a href="${homeUrl}" class="app-logo">
          <div class="logo-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          </div>
          <div class="logo-title">
            <span>PDF Tools</span>
            <span class="logo-status-dot" title="100% Offline & Private"></span>
          </div>
        </a>

        <!-- Main Navigation Menu -->
        <nav class="header-nav">
          <a href="${pagesUrl}merge.html" class="nav-link-item ${currentFile === 'merge.html' ? 'active' : ''}" data-i18n="nav.merge">MERGE PDF</a>
          <a href="${pagesUrl}split.html" class="nav-link-item ${currentFile === 'split.html' ? 'active' : ''}" data-i18n="nav.split">SPLIT PDF</a>
          <a href="${pagesUrl}compress.html" class="nav-link-item ${currentFile === 'compress.html' ? 'active' : ''}" data-i18n="nav.compress">COMPRESS PDF</a>
          
          <!-- Convert PDF Dropdown Menu -->
          <div class="dropdown-nav-wrapper" id="convertDropdownWrapper">
            <a href="javascript:void(0)" class="nav-link-item ${['pdf-to-docx.html', 'pdf-to-xlsx.html', 'pdf-to-jpg.html', 'jpg-to-pdf.html', 'docx-to-pdf.html', 'xlsx-to-pdf.html'].includes(currentFile) ? 'active' : ''}" id="convertPdfTrigger">
              <span data-i18n="nav.convert">CONVERT PDF</span> <span class="nav-chevron" id="convertChevron">▾</span>
            </a>
            <div class="convert-dropdown-menu" id="convertDropdownMenu">
              <a href="${pagesUrl}pdf-to-docx.html" class="dropdown-item-link">
                <div class="item-icon icon-pdf-word" style="background: #2563EB; color: #fff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.pdf_docx">PDF to Word</span>
                  <span class="item-desc">Convert to editable DOCX</span>
                </div>
              </a>
              <a href="${pagesUrl}pdf-to-xlsx.html" class="dropdown-item-link">
                <div class="item-icon icon-pdf-excel" style="background: #15803D; color: #fff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg></div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.pdf_xlsx">PDF to Excel</span>
                  <span class="item-desc">Extract tabular data to XLSX</span>
                </div>
              </a>
              <a href="${pagesUrl}pdf-to-jpg.html" class="dropdown-item-link">
                <div class="item-icon icon-pdf-jpg">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
                </div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.pdf_jpg">PDF to JPG</span>
                  <span class="item-desc">Save pages as images</span>
                </div>
              </a>
              <a href="${pagesUrl}jpg-to-pdf.html" class="dropdown-item-link">
                <div class="item-icon icon-jpg-pdf" style="background: #EAB308; color: #fff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="9.5" cy="12.5" r="1.5"/><path d="M16 18l-3-3-4 4"/></svg></div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.jpg_pdf">JPG to PDF</span>
                  <span class="item-desc">Convert images to PDF</span>
                </div>
              </a>
              <a href="${pagesUrl}docx-to-pdf.html" class="dropdown-item-link">
                <div class="item-icon icon-pdf-word" style="background: #2563EB; color: #fff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="7.5 13 9 17 11.5 14 14 17 15.5 13"/></svg></div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.docx_pdf">Word to PDF</span>
                  <span class="item-desc">Convert DOCX to PDF</span>
                </div>
              </a>
              <a href="${pagesUrl}xlsx-to-pdf.html" class="dropdown-item-link">
                <div class="item-icon icon-pdf-excel" style="background: #15803D; color: #fff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8.5" y1="12.5" x2="15.5" y2="17.5"/><line x1="15.5" y1="12.5" x2="8.5" y2="17.5"/></svg></div>
                <div class="item-text">
                  <span class="item-title" data-i18n="tool.xlsx_pdf">Excel to PDF</span>
                  <span class="item-desc">Convert XLSX to PDF</span>
                </div>
              </a>
            </div>
          </div>

          <!-- ALL PDF TOOLS Mega Menu Trigger -->
          <a href="javascript:void(0)" class="nav-link-item all-tools-toggle" id="allToolsTrigger">
            <span data-i18n="nav.all_tools">ALL PDF TOOLS</span> <span class="nav-chevron" id="allToolsChevron">▾</span>
          </a>
        </nav>

        <!-- Right Controls -->
        <div class="header-controls">
          <button class="theme-toggle" id="themeToggle" title="Toggle Light/Dark Theme" aria-label="Toggle Light/Dark Theme">Light</button>
          <button class="lang-toggle" id="langToggle" aria-label="Toggle Language">ID</button>
          <a href="${pagesUrl}viewer.html" class="btn-header-studio" data-i18n="nav.studio" aria-label="Open PDF Studio"><svg class="btn-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg> PDF Studio</a>
          <button type="button" class="nine-dots-btn" id="nineDotsBtn" title="All Quick Actions" aria-label="Quick Actions Menu">⠿</button>
          <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open Navigation Menu" aria-expanded="false">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
        </div>
      </div>
    `;

    // 2. Ensure Mega Menu exists in body
    let megaOverlay = document.getElementById('megaMenuOverlay');
    if (!megaOverlay) {
      megaOverlay = document.createElement('div');
      megaOverlay.className = 'mega-menu-overlay';
      megaOverlay.id = 'megaMenuOverlay';
      megaOverlay.innerHTML = `
        <div class="mega-menu-container">
          <!-- 1. ORGANIZE PDF -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.organize">ORGANIZE PDF</div>
            <a href="${pagesUrl}merge.html" class="mega-item-link">
              <span class="mega-item-icon icon-merge"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg></span> <span data-i18n="tool.merge">Merge PDF</span>
            </a>
            <a href="${pagesUrl}split.html" class="mega-item-link">
              <span class="mega-item-icon icon-split"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg></span> <span data-i18n="tool.split">Split PDF</span>
            </a>
            <a href="${pagesUrl}remove-pages.html" class="mega-item-link">
              <span class="mega-item-icon icon-remove"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg></span> <span data-i18n="tool.remove">Remove pages</span>
            </a>
            <a href="${pagesUrl}reorder.html" class="mega-item-link">
              <span class="mega-item-icon icon-reorder"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></span> <span data-i18n="tool.reorder">Reorder pages</span>
            </a>
            <a href="${pagesUrl}rotate.html" class="mega-item-link">
              <span class="mega-item-icon icon-rotate"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg></span> <span data-i18n="tool.rotate">Rotate PDF</span>
            </a>
            <a href="${pagesUrl}crop.html" class="mega-item-link">
              <span class="mega-item-icon icon-crop"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg></span> <span data-i18n="tool.crop">Crop PDF</span>
            </a>
          </div>

          <!-- 2. OPTIMIZE PDF -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.optimize">OPTIMIZE PDF</div>
            <a href="${pagesUrl}compress.html" class="mega-item-link">
              <span class="mega-item-icon icon-compress"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg></span> <span data-i18n="tool.compress">Compress PDF</span>
            </a>
            <a href="${pagesUrl}ocr.html" class="mega-item-link">
              <span class="mega-item-icon icon-ocr"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg></span> <span data-i18n="tool.ocr">OCR PDF</span>
            </a>
            <a href="${pagesUrl}grayscale.html" class="mega-item-link">
              <span class="mega-item-icon icon-grayscale"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg></span> <span data-i18n="tool.grayscale">PDF to Grayscale</span>
            </a>
            <a href="${pagesUrl}flatten.html" class="mega-item-link">
              <span class="mega-item-icon icon-flatten"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg></span> <span data-i18n="tool.flatten">Flatten PDF</span>
            </a>
          </div>

          <!-- 3. CONVERT TO PDF -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.convert_to">CONVERT TO PDF</div>
            <a href="${pagesUrl}jpg-to-pdf.html" class="mega-item-link">
              <span class="mega-item-icon icon-jpg-pdf"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="9.5" cy="12.5" r="1.5"/><path d="M16 18l-3-3-4 4"/></svg></span> <span data-i18n="tool.jpg_pdf">JPG to PDF</span>
            </a>
            <a href="${pagesUrl}docx-to-pdf.html" class="mega-item-link">
              <span class="mega-item-icon icon-pdf-word" style="background: #2563EB; color: #ffffff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="7.5 13 9 17 11.5 14 14 17 15.5 13"/></svg></span> <span data-i18n="tool.docx_pdf">WORD to PDF</span>
            </a>
            <a href="${pagesUrl}xlsx-to-pdf.html" class="mega-item-link">
              <span class="mega-item-icon icon-pdf-excel" style="background: #15803D; color: #ffffff;"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8.5" y1="12.5" x2="15.5" y2="17.5"/><line x1="15.5" y1="12.5" x2="8.5" y2="17.5"/></svg></span> <span data-i18n="tool.xlsx_pdf">EXCEL to PDF</span>
            </a>
          </div>

          <!-- 4. CONVERT FROM PDF -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.convert_from">CONVERT FROM PDF</div>
            <a href="${pagesUrl}pdf-to-docx.html" class="mega-item-link">
              <span class="mega-item-icon icon-pdf-word"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></span> <span data-i18n="tool.pdf_docx">PDF to WORD</span>
            </a>
            <a href="${pagesUrl}pdf-to-xlsx.html" class="mega-item-link">
              <span class="mega-item-icon icon-pdf-excel"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg></span> <span data-i18n="tool.pdf_xlsx">PDF to EXCEL</span>
            </a>
            <a href="${pagesUrl}pdf-to-jpg.html" class="mega-item-link">
              <span class="mega-item-icon icon-pdf-jpg"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg></span> <span data-i18n="tool.pdf_jpg">PDF to JPG</span>
            </a>
          </div>

          <!-- 5. EDIT PDF -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.edit">EDIT PDF</div>
            <a href="${pagesUrl}viewer.html" class="mega-item-link">
              <span class="mega-item-icon icon-studio"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></span> <span data-i18n="tool.studio">Edit in PDF Studio</span>
            </a>
            <a href="${pagesUrl}rotate.html" class="mega-item-link">
              <span class="mega-item-icon icon-rotate">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>
              </span> <span data-i18n="tool.rotate">Rotate PDF</span>
            </a>
            <a href="${pagesUrl}page-number.html" class="mega-item-link">
              <span class="mega-item-icon icon-pagenum"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg></span> <span data-i18n="tool.page_number">Page numbers</span>
            </a>
            <a href="${pagesUrl}watermark.html" class="mega-item-link">
              <span class="mega-item-icon icon-watermark"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg></span> <span data-i18n="tool.watermark">Add watermark</span>
            </a>
            <a href="${pagesUrl}crop.html" class="mega-item-link">
              <span class="mega-item-icon icon-crop">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>
              </span> <span data-i18n="tool.crop">Crop PDF</span>
            </a>
            <a href="${pagesUrl}form-fill.html" class="mega-item-link">
              <span class="mega-item-icon icon-form"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg></span> <span data-i18n="tool.form_fill">PDF Forms</span>
            </a>
          </div>

          <!-- 6. PDF SECURITY -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.security">PDF SECURITY</div>
            <a href="${pagesUrl}protect.html" class="mega-item-link">
              <span class="mega-item-icon icon-protect"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span> <span data-i18n="tool.protect">Protect / Unlock PDF</span>
            </a>
            <a href="${pagesUrl}sign.html" class="mega-item-link">
              <span class="mega-item-icon icon-sign"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg></span> <span data-i18n="tool.sign">Sign PDF</span>
            </a>
            <a href="${pagesUrl}flatten.html" class="mega-item-link">
              <span class="mega-item-icon icon-flatten">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
              </span> <span data-i18n="tool.flatten">Flatten & Lock PDF</span>
            </a>
          </div>

          <!-- 7. WORKFLOWS -->
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="mega.workflows">WORKFLOWS</div>
            <a href="${pagesUrl}batch.html" class="mega-item-link">
              <span class="mega-item-icon icon-batch"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span> <span data-i18n="tool.batch">Batch Processing</span>
            </a>
          </div>
        </div>
      `;
      document.body.appendChild(megaOverlay);
    }

    // 3. Ensure Quick Modal exists in body
    let quickModal = document.getElementById('quickModalBackdrop');
    if (!quickModal) {
      quickModal = document.createElement('div');
      quickModal.className = 'quick-modal-backdrop';
      quickModal.id = 'quickModalBackdrop';
      quickModal.innerHTML = `
        <div class="quick-modal-content">
          <div class="quick-modal-header">
            <h3>Choose a PDF Tool</h3>
            <p>Select an action for your document:</p>
          </div>
          <div class="quick-modal-grid">
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}viewer.html">
              <span class="quick-action-btn-icon" style="background: rgba(147, 51, 234, 0.12); color: #9333EA;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
              </span>
              <span class="quick-action-btn-label">PDF Studio</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}merge.html">
              <span class="quick-action-btn-icon" style="background: rgba(225, 29, 72, 0.12); color: #E11D48;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg>
              </span>
              <span class="quick-action-btn-label">Merge PDF</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}compress.html">
              <span class="quick-action-btn-icon" style="background: rgba(22, 163, 74, 0.12); color: #16A34A;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>
              </span>
              <span class="quick-action-btn-label">Compress PDF</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}split.html">
              <span class="quick-action-btn-icon" style="background: rgba(234, 88, 12, 0.12); color: #EA580C;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>
              </span>
              <span class="quick-action-btn-label">Split PDF</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}pdf-to-docx.html">
              <span class="quick-action-btn-icon" style="background: rgba(37, 99, 235, 0.12); color: #2563EB;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
              </span>
              <span class="quick-action-btn-label">PDF to Word</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}pdf-to-xlsx.html">
              <span class="quick-action-btn-icon" style="background: rgba(21, 128, 61, 0.12); color: #15803D;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
              </span>
              <span class="quick-action-btn-label">PDF to Excel</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}sign.html">
              <span class="quick-action-btn-icon" style="background: rgba(30, 58, 138, 0.12); color: #1E3A8A;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg>
              </span>
              <span class="quick-action-btn-label">Sign PDF</span>
            </button>
            <button type="button" class="quick-action-btn" data-target="${pagesUrl}batch.html">
              <span class="quick-action-btn-icon" style="background: rgba(13, 148, 136, 0.12); color: #0D9488;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
              </span>
              <span class="quick-action-btn-label">Batch Process</span>
            </button>
          </div>
          <div class="quick-modal-footer">
            <button type="button" class="btn btn-ghost btn-md" id="closeQuickModalBtn">Cancel</button>
          </div>
        </div>
      `;
      document.body.appendChild(quickModal);
    }

    // 4. Attach Interactive Dropdown Event Listeners
    const convertTrigger = document.getElementById('convertPdfTrigger');
    const convertMenu = document.getElementById('convertDropdownMenu');
    const convertChevron = document.getElementById('convertChevron');
    const allToolsBtn = document.getElementById('allToolsTrigger');
    const allToolsChevron = document.getElementById('allToolsChevron');

    function toggleConvert(show) {
      if (!convertMenu) return;
      const willShow = show !== undefined ? show : !(convertMenu.classList.contains('show') || convertMenu.classList.contains('active'));
      const wrapper = document.getElementById('convertDropdownWrapper');
      if (willShow) {
        convertMenu.classList.add('show', 'active');
        if (wrapper) wrapper.classList.add('open');
        if (convertTrigger) {
          convertTrigger.classList.add('show', 'menu-open');
          convertTrigger.setAttribute('aria-expanded', 'true');
        }
        const ch = convertChevron || (convertTrigger && convertTrigger.querySelector('.nav-chevron-svg, .nav-chevron'));
        if (ch) ch.classList.add('rotated');
        toggleMega(false);
      } else {
        convertMenu.classList.remove('show', 'active');
        if (wrapper) wrapper.classList.remove('open');
        if (convertTrigger) {
          convertTrigger.classList.remove('show', 'menu-open');
          convertTrigger.setAttribute('aria-expanded', 'false');
        }
        const ch = convertChevron || (convertTrigger && convertTrigger.querySelector('.nav-chevron-svg, .nav-chevron'));
        if (ch) ch.classList.remove('rotated');
      }
    }

    function toggleMega(show) {
      if (!megaOverlay) return;
      const willShow = show !== undefined ? show : !(megaOverlay.classList.contains('show') || megaOverlay.classList.contains('active'));
      if (willShow) {
        megaOverlay.classList.add('show', 'active');
        if (allToolsBtn) {
          allToolsBtn.classList.add('show', 'menu-open');
          allToolsBtn.setAttribute('aria-expanded', 'true');
        }
        const ch = allToolsChevron || (allToolsBtn && allToolsBtn.querySelector('.nav-chevron-svg, .nav-chevron'));
        if (ch) ch.classList.add('rotated');
        toggleConvert(false);
      } else {
        megaOverlay.classList.remove('show', 'active');
        if (allToolsBtn) {
          allToolsBtn.classList.remove('show', 'menu-open');
          allToolsBtn.setAttribute('aria-expanded', 'false');
        }
        const ch = allToolsChevron || (allToolsBtn && allToolsBtn.querySelector('.nav-chevron-svg, .nav-chevron'));
        if (ch) ch.classList.remove('rotated');
      }
    }

    if (convertTrigger) {
      convertTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleConvert();
      });
    }

    if (allToolsBtn) {
      allToolsBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleMega();
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#convertDropdownWrapper')) toggleConvert(false);
      if (!e.target.closest('.mega-menu-overlay') && !e.target.closest('#allToolsTrigger')) toggleMega(false);
    });

    // 5. Quick Modal Handlers
    const nineDotsBtn = document.getElementById('nineDotsBtn');
    const closeQuickBtn = document.getElementById('closeQuickModalBtn');

    if (nineDotsBtn) {
      nineDotsBtn.addEventListener('click', () => quickModal.classList.add('active'));
    }
    if (closeQuickBtn) {
      closeQuickBtn.addEventListener('click', () => quickModal.classList.remove('active'));
    }
    quickModal.addEventListener('click', (e) => {
      if (e.target === quickModal) quickModal.classList.remove('active');
    });

    quickModal.querySelectorAll('.quick-action-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        if (target) window.location.href = target;
      });
    });
  }

  // --- 0.1 Synchronize Hero Tool Icon with Exact SVG from index.html ---
  function syncHeroToolIcon() {
    const heroIcon = document.querySelector('.tool-hero-icon');
    if (!heroIcon) return;

    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const currentFile = (currentPath.split('/').pop() || '').toLowerCase();

    const ICONS_MAP = {
      'merge.html': {
        color: '#E11D48',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg>`
      },
      'split.html': {
        color: '#EA580C',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>`
      },
      'compress.html': {
        color: '#16A34A',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>`
      },
      'pdf-to-docx.html': {
        color: '#2563EB',
        svg: `<span style="font-weight:900;font-size:1.8rem;color:#ffffff;line-height:1;user-select:none;">W</span>`
      },
      'pdf-to-xlsx.html': {
        color: '#15803D',
        svg: `<span style="font-weight:900;font-size:1.8rem;color:#ffffff;line-height:1;user-select:none;">X</span>`
      },
      'pdf-to-jpg.html': {
        color: '#EAB308',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>`
      },
      'jpg-to-pdf.html': {
        color: '#EAB308',
        svg: `<span style="font-weight:800;font-size:1.2rem;color:#ffffff;letter-spacing:-0.05em;line-height:1;user-select:none;">JPG</span>`
      },
      'docx-to-pdf.html': {
        color: '#2563EB',
        svg: `<span style="font-weight:900;font-size:1.8rem;color:#ffffff;line-height:1;user-select:none;">W</span>`
      },
      'xlsx-to-pdf.html': {
        color: '#15803D',
        svg: `<span style="font-weight:900;font-size:1.8rem;color:#ffffff;line-height:1;user-select:none;">X</span>`
      },
      'viewer.html': {
        color: '#9333EA',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>`
      },
      'sign.html': {
        color: '#1E3A8A',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg>`
      },
      'form-fill.html': {
        color: '#0284C7',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`
      },
      'protect.html': {
        color: '#3B82F6',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`
      },
      'watermark.html': {
        color: '#DB2777',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
      },
      'rotate.html': {
        color: '#7C3AED',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>`
      },
      'page-number.html': {
        color: '#059669',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`
      },
      'crop.html': {
        color: '#D97706',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>`
      },
      'remove.html': {
        color: '#DC2626',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`
      },
      'remove-pages.html': {
        color: '#DC2626',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>`
      },
      'reorder.html': {
        color: '#8B5CF6',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>`
      },
      'ocr.html': {
        color: '#0891B2',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>`
      },
      'grayscale.html': {
        color: '#475569',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>`
      },
      'flatten.html': {
        color: '#4F46E5',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`
      },
      'batch.html': {
        color: '#0D9488',
        svg: `<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`
      }
    };

    if (ICONS_MAP[currentFile]) {
      const { color, svg } = ICONS_MAP[currentFile];
      heroIcon.innerHTML = svg;
      heroIcon.style.background = color;
      heroIcon.style.boxShadow = `0 8px 24px ${color}66`;
      document.documentElement.style.setProperty('--tool-color', color);
    }
  }

  // --- 0.2 Unified Footer (Injected via JS for DN. branding consistency) ---
  function setupUnifiedFooter() {
    const footer = document.querySelector('footer.footer');
    if (!footer || document.body.classList.contains('tool-page-viewer')) return;

    footer.innerHTML = `
      <div class="container">
        <div class="footer-unified">
          <p data-i18n="footer.text">PDF Tools (DN.) — All processing is done locally in your browser.</p>
        </div>
      </div>
    `;
  }

  // --- 0.3 Mobile Hamburger Menu ---
  function setupMobileMenu() {
    if (document.body.classList.contains('tool-page-viewer')) return;

    const isPagesDir = window.location.pathname.replace(/\\/g, '/').includes('/pages/');
    const pagesUrl = isPagesDir ? '' : 'pages/';

    let drawer = document.getElementById('mobileNavDrawer');
    if (!drawer) {
      drawer = document.createElement('div');
      drawer.className = 'mobile-nav-drawer';
      drawer.id = 'mobileNavDrawer';
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-label', 'Navigation Menu');
      drawer.innerHTML = `
        <div class="mobile-nav-backdrop" id="mobileNavBackdrop"></div>
        <div class="mobile-nav-panel">
          <div class="mobile-nav-header">
            <span class="mobile-nav-title">PDF Tools (DN.)</span>
            <button type="button" class="mobile-nav-close" id="mobileNavClose" aria-label="Close Navigation">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <nav class="mobile-nav-links" role="navigation">
            <a href="${pagesUrl}merge.html" class="mobile-nav-link" data-i18n="mobile_nav.merge">Merge PDF</a>
            <a href="${pagesUrl}split.html" class="mobile-nav-link" data-i18n="mobile_nav.split">Split PDF</a>
            <a href="${pagesUrl}compress.html" class="mobile-nav-link" data-i18n="mobile_nav.compress">Compress PDF</a>
            <div class="mobile-nav-divider"></div>
            <span class="mobile-nav-section" data-i18n="mobile_nav.section_convert">Convert</span>
            <a href="${pagesUrl}pdf-to-docx.html" class="mobile-nav-link" data-i18n="mobile_nav.pdf_docx">PDF to Word</a>
            <a href="${pagesUrl}pdf-to-xlsx.html" class="mobile-nav-link" data-i18n="mobile_nav.pdf_xlsx">PDF to Excel</a>
            <a href="${pagesUrl}pdf-to-jpg.html" class="mobile-nav-link" data-i18n="mobile_nav.pdf_jpg">PDF to JPG</a>
            <a href="${pagesUrl}jpg-to-pdf.html" class="mobile-nav-link" data-i18n="mobile_nav.jpg_pdf">JPG to PDF</a>
            <a href="${pagesUrl}docx-to-pdf.html" class="mobile-nav-link" data-i18n="mobile_nav.docx_pdf">Word to PDF</a>
            <a href="${pagesUrl}xlsx-to-pdf.html" class="mobile-nav-link" data-i18n="mobile_nav.xlsx_pdf">Excel to PDF</a>
            <div class="mobile-nav-divider"></div>
            <span class="mobile-nav-section" data-i18n="mobile_nav.section_edit">Edit & Organize</span>
            <a href="${pagesUrl}rotate.html" class="mobile-nav-link" data-i18n="mobile_nav.rotate">Rotate PDF</a>
            <a href="${pagesUrl}crop.html" class="mobile-nav-link" data-i18n="mobile_nav.crop">Crop PDF</a>
            <a href="${pagesUrl}reorder.html" class="mobile-nav-link" data-i18n="mobile_nav.reorder">Reorder Pages</a>
            <a href="${pagesUrl}remove-pages.html" class="mobile-nav-link" data-i18n="mobile_nav.remove">Remove Pages</a>
            <a href="${pagesUrl}watermark.html" class="mobile-nav-link" data-i18n="mobile_nav.watermark">Watermark</a>
            <a href="${pagesUrl}page-number.html" class="mobile-nav-link" data-i18n="mobile_nav.page_number">Page Numbers</a>
            <div class="mobile-nav-divider"></div>
            <span class="mobile-nav-section" data-i18n="mobile_nav.section_security">Security & Tools</span>
            <a href="${pagesUrl}protect.html" class="mobile-nav-link" data-i18n="mobile_nav.protect">Protect / Unlock</a>
            <a href="${pagesUrl}sign.html" class="mobile-nav-link" data-i18n="mobile_nav.sign">Sign PDF</a>
            <a href="${pagesUrl}flatten.html" class="mobile-nav-link" data-i18n="mobile_nav.flatten">Flatten PDF</a>
            <a href="${pagesUrl}grayscale.html" class="mobile-nav-link" data-i18n="mobile_nav.grayscale">Grayscale</a>
            <a href="${pagesUrl}ocr.html" class="mobile-nav-link" data-i18n="mobile_nav.ocr">OCR PDF</a>
            <a href="${pagesUrl}form-fill.html" class="mobile-nav-link" data-i18n="mobile_nav.form_fill">Fill Forms</a>
            <a href="${pagesUrl}batch.html" class="mobile-nav-link" data-i18n="mobile_nav.batch">Batch Processing</a>
            <div class="mobile-nav-divider"></div>
            <a href="${pagesUrl}viewer.html" class="mobile-nav-link mobile-nav-studio" data-i18n="mobile_nav.studio">PDF Studio</a>
          </nav>
        </div>
      `;
      document.body.appendChild(drawer);
      if (window.PDFTools && PDFTools.i18n) {
        PDFTools.i18n.updatePage();
      }
    }

    const menuBtn = document.getElementById('mobileMenuBtn');
    const closeBtn = document.getElementById('mobileNavClose');
    const backdrop = document.getElementById('mobileNavBackdrop');

    function openDrawer() {
      drawer.classList.add('open');
      document.body.style.overflow = 'hidden';
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'true');
      if (window.PDFTools && PDFTools.i18n) {
        PDFTools.i18n.updatePage();
      }
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      document.body.style.overflow = '';
      if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
    }

    if (menuBtn) menuBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('open')) {
        closeDrawer();
      }
    });
  }

  // --- 0.4 SEO Meta Tags per Tool Page ---
  function injectSEOMeta() {
    const currentPath = window.location.pathname.replace(/\\/g, '/');
    const currentFile = (currentPath.split('/').pop() || '').toLowerCase();

    const META_MAP = {
      'merge.html': 'Merge multiple PDF files into one document. 100% free, offline, and private — no upload needed.',
      'split.html': 'Split PDF pages into separate files or extract specific page ranges. Works entirely offline.',
      'compress.html': 'Compress and reduce PDF file size while maintaining quality. 100% client-side processing.',
      'rotate.html': 'Rotate PDF pages to any angle — 90, 180, or 270 degrees. Free and offline.',
      'remove-pages.html': 'Remove unwanted pages from your PDF document with a visual page selector.',
      'reorder.html': 'Drag and drop to rearrange PDF pages into your desired order. No upload required.',
      'watermark.html': 'Add text watermarks to your PDF documents with custom styling and positioning.',
      'page-number.html': 'Add page numbers to your PDF with customizable position, format, and font styling.',
      'protect.html': 'Protect your PDF with a password or unlock password-protected PDF files. 100% offline.',
      'flatten.html': 'Flatten PDF form fields and annotations into the document permanently.',
      'grayscale.html': 'Convert color PDFs to grayscale (black and white) to save printer ink.',
      'crop.html': 'Crop and trim PDF page margins with an interactive visual editor.',
      'pdf-to-docx.html': 'Convert PDF to editable Word (DOCX) documents. Offline and private processing.',
      'pdf-to-xlsx.html': 'Extract tables from PDF and convert to Excel (XLSX) spreadsheets.',
      'pdf-to-jpg.html': 'Convert PDF pages to high-quality JPG images. Free and offline.',
      'jpg-to-pdf.html': 'Convert JPG, PNG, and WEBP images to PDF documents. 100% client-side.',
      'docx-to-pdf.html': 'Convert Word (DOCX) documents to PDF format. Runs entirely in your browser.',
      'xlsx-to-pdf.html': 'Convert Excel (XLSX) spreadsheets to formatted PDF documents offline.',
      'ocr.html': 'OCR: Extract text from scanned PDFs and images to create searchable PDF documents.',
      'sign.html': 'Digitally sign PDF documents with drawn, typed, or uploaded signatures. 100% offline.',
      'form-fill.html': 'Fill interactive PDF form fields directly in your browser. No upload needed.',
      'batch.html': 'Batch process multiple PDF files at once — compress, watermark, rotate, and more.',
      'viewer.html': 'PDF Studio — Full-featured PDF editor with watermark, compress, crop, and more tools built-in.'
    };

    if (META_MAP[currentFile]) {
      let metaDesc = document.querySelector('meta[name="description"]');
      if (!metaDesc) {
        metaDesc = document.createElement('meta');
        metaDesc.setAttribute('name', 'description');
        document.head.appendChild(metaDesc);
      }
      metaDesc.setAttribute('content', META_MAP[currentFile]);
    }
  }

  // --- 0.5 Accessibility Enhancements ---
  function setupAccessibility() {
    // Add aria-expanded to dropdown triggers
    const convertTrigger = document.getElementById('convertPdfTrigger');
    if (convertTrigger) convertTrigger.setAttribute('aria-expanded', 'false');
    const allToolsTrigger = document.getElementById('allToolsTrigger');
    if (allToolsTrigger) allToolsTrigger.setAttribute('aria-expanded', 'false');

    // Add keyboard support to dropzones
    document.querySelectorAll('.dropzone').forEach(function (dz) {
      if (!dz.getAttribute('role')) dz.setAttribute('role', 'button');
      if (!dz.getAttribute('tabindex')) dz.setAttribute('tabindex', '0');
      if (!dz.getAttribute('aria-label')) dz.setAttribute('aria-label', 'Click or drop files here to upload');

      dz.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          dz.click();
        }
      });
    });

    // Close mega menu / quick modal on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        const mega = document.getElementById('megaMenuOverlay');
        if (mega && (mega.classList.contains('show') || mega.classList.contains('active'))) {
          mega.classList.remove('show', 'active');
          const allTools = document.getElementById('allToolsTrigger');
          if (allTools) {
            allTools.classList.remove('show', 'menu-open');
            allTools.setAttribute('aria-expanded', 'false');
            const ch = allTools.querySelector('.nav-chevron-svg, .nav-chevron');
            if (ch) ch.classList.remove('rotated');
          }
          const chevron = document.getElementById('allToolsChevron');
          if (chevron) chevron.classList.remove('rotated');
        }
        const convertMenu = document.getElementById('convertDropdownMenu');
        if (convertMenu && (convertMenu.classList.contains('show') || convertMenu.classList.contains('active'))) {
          convertMenu.classList.remove('show', 'active');
          const wrapper = document.getElementById('convertDropdownWrapper');
          if (wrapper) wrapper.classList.remove('open');
          const convertTrigger = document.getElementById('convertPdfTrigger');
          if (convertTrigger) {
            convertTrigger.classList.remove('show', 'menu-open');
            convertTrigger.setAttribute('aria-expanded', 'false');
            const ch = convertTrigger.querySelector('.nav-chevron-svg, .nav-chevron');
            if (ch) ch.classList.remove('rotated');
          }
          const chevron = document.getElementById('convertChevron');
          if (chevron) chevron.classList.remove('rotated');
        }
        const quickModal = document.getElementById('quickModalBackdrop');
        if (quickModal && quickModal.classList.contains('active')) {
          quickModal.classList.remove('active');
        }
      }
    });
  }

  // Run Unified Header & Tool Icon Sync
  setupUnifiedHeader();
  syncHeroToolIcon();
  setupUnifiedFooter();
  setupMobileMenu();
  injectSEOMeta();
  setupAccessibility();

  // --- 1. Theme Management (Ultra-Reliable Global Delegation & System Sync) ---
  const storedTheme = localStorage.getItem('pdf_tools_theme');
  // Default is light theme across all pages & menus
  const initialTheme = storedTheme || 'light';

  function updateAllThemeButtons(theme) {
    const isLight = theme === 'light';
    const buttons = document.querySelectorAll('#themeToggle, .theme-toggle, [data-action="toggle-theme"]');
    buttons.forEach(btn => {
      // Clean SVG icons (Sun for switching to light, Moon for switching to dark)
      const sunSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;
      const moonSvg = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      
      btn.innerHTML = isLight ? `${moonSvg}<span>Dark</span>` : `${sunSvg}<span>Light</span>`;
      btn.setAttribute('aria-label', isLight ? 'Switch to Dark Theme' : 'Switch to Light Theme');
      btn.setAttribute('title', isLight ? 'Switch to Dark Theme (Ctrl+D)' : 'Switch to Light Theme (Ctrl+D)');
      btn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
    });
  }

  function applyTheme(theme, save = true) {
    const nextTheme = theme === 'light' ? 'light' : 'dark';
    const root = document.documentElement;
    root.setAttribute('data-theme', nextTheme);
    root.classList.toggle('light-theme', nextTheme === 'light');
    root.classList.toggle('dark-theme', nextTheme === 'dark');
    if (document.body) {
      document.body.setAttribute('data-theme', nextTheme);
      document.body.classList.toggle('light-theme', nextTheme === 'light');
      document.body.classList.toggle('dark-theme', nextTheme === 'dark');
    }
    root.style.colorScheme = nextTheme;
    if (save) {
      localStorage.setItem('pdf_tools_theme', nextTheme);
    }
    updateAllThemeButtons(nextTheme);
    return nextTheme;
  }

  // Immediately apply initial theme
  applyTheme(initialTheme, Boolean(storedTheme));

  // Global Event Delegation for any Theme Toggle Click anywhere on page
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#themeToggle, .theme-toggle, [data-action="toggle-theme"]');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();

    const current = document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('light-theme') ? 'light' : 'dark');
    const nextTheme = current === 'light' ? 'dark' : 'light';
    applyTheme(nextTheme, true);

    if (window.PDFTools && PDFTools.Toast) {
      PDFTools.Toast.info(nextTheme === 'light' ? 'Light Mode Active' : 'Dark Mode Active');
    }
  });

  // Global Keyboard Shortcut: Ctrl + D or Alt + T
  document.addEventListener('keydown', function (e) {
    if ((e.ctrlKey && (e.key === 'd' || e.key === 'D')) || (e.altKey && (e.key === 't' || e.key === 'T'))) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
      e.preventDefault();
      const current = document.documentElement.getAttribute('data-theme') || (document.documentElement.classList.contains('light-theme') ? 'light' : 'dark');
      const nextTheme = current === 'light' ? 'dark' : 'light';
      applyTheme(nextTheme, true);

      if (window.PDFTools && PDFTools.Toast) {
        PDFTools.Toast.info(nextTheme === 'light' ? 'Light Mode Active' : 'Dark Mode Active');
      }
    }
  });

  // Cross-tab theme synchronization
  window.addEventListener('storage', function (e) {
    if (e.key === 'pdf_tools_theme' && e.newValue) {
      applyTheme(e.newValue, false);
    }
  });

  // --- 2. Initialize i18n & Language Management (Ultra-Reliable Global Delegation) ---
  function updateAllLangButtons(lang) {
    const current = (lang || (window.PDFTools && PDFTools.i18n && PDFTools.i18n.getLang()) || 'id').toLowerCase();
    const buttons = document.querySelectorAll('#langToggle, .lang-toggle, [data-action="toggle-lang"]');
    buttons.forEach(btn => {
      btn.textContent = current === 'id' ? 'ID 🇮🇩' : 'EN 🇬🇧';
      btn.setAttribute('aria-label', current === 'id' ? 'Ganti ke Bahasa Inggris' : 'Switch to Indonesian');
      btn.setAttribute('title', current === 'id' ? 'Klik untuk beralih ke English' : 'Click to switch to Indonesian');
    });
  }

  // Global Event Delegation for Language Toggle anywhere on page
  document.addEventListener('click', function (e) {
    const btn = e.target.closest('#langToggle, .lang-toggle, [data-action="toggle-lang"]');
    if (!btn) return;
    
    e.preventDefault();
    e.stopPropagation();

    if (window.PDFTools && PDFTools.i18n) {
      const newLang = PDFTools.i18n.toggleLang();
      updateAllLangButtons(newLang);
      if (window.PDFTools.Toast) {
        PDFTools.Toast.info(newLang === 'id' ? 'Bahasa Indonesia Aktif 🇮🇩' : 'English Active 🇬🇧');
      }
    }
  });

  // Listen for language change events
  window.addEventListener('pdftools:langchange', function (e) {
    updateAllLangButtons(e.detail ? e.detail.lang : null);
  });

  // Cross-tab language sync
  window.addEventListener('storage', function (e) {
    if (e.key === 'pdftools-lang' && e.newValue && window.PDFTools && PDFTools.i18n) {
      PDFTools.i18n.setLang(e.newValue);
      updateAllLangButtons(e.newValue);
    }
  });

  // Initial i18n run on current DOM
  if (window.PDFTools && PDFTools.i18n) {
    PDFTools.i18n.updatePage();
    updateAllLangButtons(PDFTools.i18n.getLang());
  }

  // --- 3. Global Keyboard Shortcuts ---
  window.addEventListener('keydown', function (e) {
    // Ignore when typing in editable inputs or contenteditable
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || e.target.isContentEditable) {
      if (e.key === 'Escape') {
        e.target.blur();
      }
      return;
    }

    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

    // Ctrl/Cmd + O: Open file picker on active dropzone
    if (isCmdOrCtrl && (e.key === 'o' || e.key === 'O')) {
      e.preventDefault();
      const dropzone = document.querySelector('.dropzone, #dropzone, input[type="file"]');
      if (dropzone) {
        dropzone.click();
      }
    }

    // Ctrl/Cmd + S: Save / Download result
    if (isCmdOrCtrl && (e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      const downloadBtn = document.querySelector('#downloadMainBtn, #downloadBtn, #confirmSaveAsBtn, #saveBtn, .btn-download');
      if (downloadBtn && !downloadBtn.disabled) {
        downloadBtn.click();
      }
    }
  });
});
