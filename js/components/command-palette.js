/**
 * PDF Tools — Global Command Palette & Quick Launcher (Ctrl+K)
 * 100% Client-Side, Zero Server Dependency, Offline-First.
 */
(function () {
  'use strict';

  // Determine current depth for relative URL links
  function getBasePrefix() {
    const path = window.location.pathname || window.location.href;
    const isPagesDir = path.includes('/pages/') || path.includes('\\pages\\');
    return isPagesDir ? '' : 'pages/';
  }

  function getHomeUrl() {
    const path = window.location.pathname || window.location.href;
    const isPagesDir = path.includes('/pages/') || path.includes('\\pages\\');
    return isPagesDir ? '../index.html' : 'index.html';
  }

  const prefix = getBasePrefix();
  const homeUrl = getHomeUrl();

  const TOOLS_CATALOG = [
    {
      id: 'studio',
      name: 'PDF Studio Pro',
      category: 'Editor',
      color: '#8B5CF6',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      url: prefix + 'viewer.html',
      badge: 'Editor Pro',
      desc: 'Buka workspace lengkap: sunting teks, isi formulir, tanda tangan kaligrafi, stempel & OCR.',
      keywords: ['edit', 'editor', 'studio', 'text', 'teks', 'sunting', 'sign', 'signature', 'tanda tangan', 'paraf', 'fill', 'form', 'formulir', 'stamp', 'stempel', 'redaction', 'acrobat']
    },
    {
      id: 'merge',
      name: 'Merge PDF',
      category: 'Organize',
      color: '#FF6B4A',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg>',
      url: prefix + 'merge.html',
      badge: 'Multi-File',
      desc: 'Gabungkan beberapa berkas PDF menjadi satu dengan Visual Page Organizer & drag-drop.',
      keywords: ['merge', 'gabung', 'combine', 'unite', 'join', 'satukan', 'kumpul', 'organize', 'halaman']
    },
    {
      id: 'compress',
      name: 'Compress PDF',
      category: 'Optimize',
      color: '#10B981',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>',
      url: prefix + 'compress.html',
      badge: 'Batch Queue',
      desc: 'Kecilkan ukuran file PDF secara adaptif tanpa merusak e-materai atau tanda tangan digital.',
      keywords: ['compress', 'kompres', 'kecilkan', 'shrink', 'resize', 'hemat', 'mb', 'kb', 'batch', 'zip']
    },
    {
      id: 'ocr',
      name: 'OCR PDF (Offline WASM)',
      category: 'Intelligence',
      color: '#06B6D4',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
      url: prefix + 'ocr.html',
      badge: 'WASM SIMD',
      desc: 'Ekstrak teks dari PDF pindaian (scan) / gambar & buat Searchable PDF secara offline murni.',
      keywords: ['ocr', 'scan', 'pindai', 'ekstrak', 'teks', 'text', 'ktp', 'ijazah', 'searchable', 'tesseract', 'foto']
    },
    {
      id: 'split',
      name: 'Split PDF',
      category: 'Organize',
      color: '#F97316',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>',
      url: prefix + 'split.html',
      badge: 'Extraction',
      desc: 'Pisahkan dokumen PDF per lembar halaman, rentang halaman (range), atau setiap N halaman.',
      keywords: ['split', 'pisah', 'pecah', 'potong', 'extract', 'range', 'bagi', 'lembar']
    },
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      category: 'Convert',
      color: '#F59E0B',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="9.5" cy="12.5" r="1.5"/><path d="M16 18l-3-3-4 4"/></svg>',
      url: prefix + 'jpg-to-pdf.html',
      badge: 'Converter',
      desc: 'Konversi gambar (JPG, PNG, WebP) ke dokumen PDF dengan kustomisasi margin & ukuran kertas.',
      keywords: ['jpg', 'png', 'webp', 'image', 'gambar', 'foto', 'convert', 'konversi', 'jadikan pdf']
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      category: 'Convert',
      color: '#06B6D4',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      url: prefix + 'pdf-to-jpg.html',
      badge: 'Rasterizer',
      desc: 'Ekstrak dan ubah lembaran dokumen PDF menjadi gambar resolusi tinggi (JPG / PNG / ZIP).',
      keywords: ['pdf to jpg', 'ekstrak gambar', 'rasterize', 'export image', 'halaman ke gambar']
    },
    {
      id: 'crop',
      name: 'Crop & Trim Margins',
      category: 'Editor',
      color: '#F59E0B',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
      url: prefix + 'crop.html',
      badge: 'Auto-Trim',
      desc: 'Pangkas margin putih berlebih dengan 8 handle visual dan deteksi otomatis Auto-Trim.',
      keywords: ['crop', 'trim', 'potong', 'margin', 'whitespace', 'pangkas', 'batas kertas']
    },
    {
      id: 'flatten',
      name: 'Flatten PDF',
      category: 'Security',
      color: '#6366F1',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      url: prefix + 'flatten.html',
      badge: 'Read-Only',
      desc: 'Kunci isian form, tanda tangan, dan stempel menjadi lapisan permanen agar anti-tamper.',
      keywords: ['flatten', 'kunci', 'lock', 'permanent', 'stempel aman', 'read only', 'anti edit']
    },
    {
      id: 'grayscale',
      name: 'PDF to Grayscale',
      category: 'Optimize',
      color: '#64748B',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>',
      url: prefix + 'grayscale.html',
      badge: 'Fotokopi B&W',
      desc: 'Ubah dokumen berwarna menjadi skala abu-abu halus atau fotokopi hitam putih pekat.',
      keywords: ['grayscale', 'black and white', 'hitam putih', 'fotokopi', 'bw', 'hemat tinta', 'print']
    },
    {
      id: 'rotate',
      name: 'Rotate PDF',
      category: 'Organize',
      color: '#3B82F6',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>',
      url: prefix + 'rotate.html',
      badge: 'Transform',
      desc: 'Putar orientasi halaman PDF (90°, 180°, 270°) per lembar atau serentak seluruh dokumen.',
      keywords: ['rotate', 'putar', 'orientasi', 'landscape', 'portrait', 'miring', 'balik']
    },
    {
      id: 'remove-pages',
      name: 'Remove Pages',
      category: 'Organize',
      color: '#EF4444',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>',
      url: prefix + 'remove-pages.html',
      badge: 'Cleaner',
      desc: 'Hapus satu atau beberapa halaman tertentu yang tidak diinginkan secara visual.',
      keywords: ['remove', 'delete', 'hapus', 'buang', 'hilangkan', 'buang halaman', 'kurangi']
    },
    {
      id: 'reorder',
      name: 'Reorder Pages',
      category: 'Organize',
      color: '#8B5CF6',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      url: prefix + 'reorder.html',
      badge: 'Sorter',
      desc: 'Atur ulang susunan posisi halaman dokumen dengan antarmuka drag-and-drop yang cepat.',
      keywords: ['reorder', 'susun', 'tukar urutan', 'geser', 'posisi', 'urutkan']
    },
    {
      id: 'watermark',
      name: 'Watermark PDF',
      category: 'Security',
      color: '#EC4899',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      url: prefix + 'watermark.html',
      badge: 'Batch Queue',
      desc: 'Bubuhkan stempel tanda air teks / logo dengan rotasi, transparansi, dan antrean batch.',
      keywords: ['watermark', 'cap', 'stempel', 'label', 'confidential', 'rahasia', 'draft', 'hak cipta']
    },
    {
      id: 'page-number',
      name: 'Page Numbers',
      category: 'Organize',
      color: '#10B981',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      url: prefix + 'page-number.html',
      badge: 'Batch Queue',
      desc: 'Tambahkan penomoran halaman otomatis, Bates numbering, header dan footer dokumen.',
      keywords: ['page number', 'nomor halaman', 'penomoran', 'bates', 'header', 'footer', 'angka']
    },
    {
      id: 'protect',
      name: 'Protect & Unlock PDF',
      category: 'Security',
      color: '#EF4444',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      url: prefix + 'protect.html',
      badge: 'Batch Queue',
      desc: 'Proteksi dokumen PDF dengan kata sandi enkripsi kuat atau buka kunci berkas PDF Anda.',
      keywords: ['protect', 'lock', 'unlock', 'password', 'sandi', 'kunci', 'enkripsi', 'decrypt', 'aman']
    },
    {
      id: 'pdf-to-docx',
      name: 'PDF to Word',
      category: 'Convert',
      color: '#2563EB',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      url: prefix + 'pdf-to-docx.html',
      badge: 'DOCX',
      desc: 'Konversi dokumen PDF menjadi berkas Microsoft Word (.docx) yang dapat diedit.',
      keywords: ['word', 'docx', 'doc', 'convert', 'konversi', 'edit text']
    },
    {
      id: 'docx-to-pdf',
      name: 'Word to PDF',
      category: 'Convert',
      color: '#2563EB',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="7.5 13 9 17 11.5 14 14 17 15.5 13"/></svg>',
      url: prefix + 'docx-to-pdf.html',
      badge: 'Converter',
      desc: 'Ubah berkas dokumen Word (.docx) menjadi berkas PDF berkualitas tinggi secara offline.',
      keywords: ['word', 'docx', 'doc to pdf', 'convert', 'konversi']
    },
    {
      id: 'pdf-to-xlsx',
      name: 'PDF to Excel',
      category: 'Convert',
      color: '#15803D',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
      url: prefix + 'pdf-to-xlsx.html',
      badge: 'XLSX',
      desc: 'Ekstrak tabel dan data angka dari PDF langsung ke lembar kerja Excel (.xlsx).',
      keywords: ['excel', 'xlsx', 'xls', 'spreadsheet', 'tabel', 'angka', 'data']
    },
    {
      id: 'xlsx-to-pdf',
      name: 'Excel to PDF',
      category: 'Convert',
      color: '#15803D',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8.5" y1="12.5" x2="15.5" y2="17.5"/><line x1="15.5" y1="12.5" x2="8.5" y2="17.5"/></svg>',
      url: prefix + 'xlsx-to-pdf.html',
      badge: 'Converter',
      desc: 'Konversi spreadsheet Excel (.xlsx) menjadi tabel PDF rapi dan siap cetak.',
      keywords: ['excel', 'xlsx', 'excel to pdf', 'convert', 'tabel']
    },
    {
      id: 'sign',
      name: 'Sign PDF',
      category: 'Security',
      color: '#0EA5E9',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg>',
      url: prefix + 'sign.html',
      badge: 'E-Sign',
      desc: 'Bubuhkan tanda tangan digital, paraf, atau stempel e-materai langsung di PDF.',
      keywords: ['sign', 'tanda tangan', 'paraf', 'signature', 'materai', 'stamp']
    },
    {
      id: 'form-fill',
      name: 'Fill PDF Forms',
      category: 'Editor',
      color: '#8B5CF6',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      url: prefix + 'form-fill.html',
      badge: 'AcroForm',
      desc: 'Isi formulir PDF interaktif, centang checkbox, dan simpan form secara instan.',
      keywords: ['form', 'formulir', 'fill', 'isi', 'acroform', 'centang']
    },
    {
      id: 'batch',
      name: 'Batch Processing',
      category: 'Workflows',
      color: '#0D9488',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      url: prefix + 'batch.html',
      badge: 'Queue',
      desc: 'Proses puluhan berkas PDF sekaligus: kompres, watermark, grayscale, dan proteksi.',
      keywords: ['batch', 'massal', 'banyak', 'queue', 'antrean', 'otomatis']
    }
  ];

  function getCatalog() {
    if (window.PDFTools && window.PDFTools.TOOLS_DATA) {
      return window.PDFTools.TOOLS_DATA.map(t => ({
        id: t.id,
        name: t.name,
        category: t.category,
        color: t.color,
        icon: t.icon,
        url: prefix + t.file,
        badge: t.badge,
        desc: t.desc,
        keywords: t.keywords
      }));
    }
    return TOOLS_CATALOG;
  }

  class CommandPalette {
    constructor() {
      this.isOpen = false;
      this.selectedIndex = 0;
      this.filteredItems = [...getCatalog()];
      this.init();
    }

    init() {
      this.buildDOM();
      this.bindEvents();
      this.injectHeaderShortcut();
    }

    buildDOM() {
      // Backdrop & Modal Container
      this.overlay = document.createElement('div');
      this.overlay.className = 'cmd-palette-overlay';
      this.overlay.setAttribute('aria-hidden', 'true');
      this.overlay.innerHTML = `
        <div class="cmd-palette-modal" role="dialog" aria-modal="true" aria-label="Command Palette">
          <div class="cmd-palette-search-bar">
            <span class="cmd-palette-search-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
            <input type="text" class="cmd-palette-input" placeholder="Cari alat PDF atau drop berkas di sini... (Ctrl+K)" autocomplete="off" spellcheck="false">
            <span class="cmd-palette-badge-esc">ESC</span>
          </div>

          <div class="cmd-palette-drag-banner" style="display: none;">
            <div class="cmd-drag-banner-content">
              <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></span>
              <div>
                <strong>Lepaskan berkas pada salah satu alat di bawah</strong>
                <p>Alat tujuan akan langsung dibuka dengan berkas Anda siap diproses!</p>
              </div>
            </div>
          </div>

          <div class="cmd-palette-list-wrapper">
            <div class="cmd-palette-list" role="listbox"></div>
          </div>

          <div class="cmd-palette-footer">
            <div class="cmd-footer-keys">
              <span><kbd>↑</kbd><kbd>↓</kbd> Navigasi</span>
              <span><kbd>↵</kbd> Buka</span>
              <span><kbd>Esc</kbd> Tutup</span>
            </div>
            <div class="cmd-footer-hint">
              <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>Tips: Drag berkas PDF langsung ke item alat untuk instant handoff!</span>
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(this.overlay);

      this.input = this.overlay.querySelector('.cmd-palette-input');
      this.list = this.overlay.querySelector('.cmd-palette-list');
      this.dragBanner = this.overlay.querySelector('.cmd-palette-drag-banner');
      this.modal = this.overlay.querySelector('.cmd-palette-modal');
    }

    injectHeaderShortcut() {
      // Look for header navigation or controls to inject shortcut button
      const headerControls = document.querySelector('.header-controls');
      const headerInner = document.querySelector('.header-inner');
      if (!headerControls && !headerInner) return;

      const triggerBtn = document.createElement('button');
      triggerBtn.className = 'cmd-palette-trigger-btn';
      triggerBtn.type = 'button';
      triggerBtn.title = 'Quick Search & Launch Tools (Ctrl+K)';
      triggerBtn.innerHTML = `
        <span class="cmd-trigger-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
        <span class="cmd-trigger-text">Cari Alat...</span>
        <span class="cmd-trigger-kbd">Ctrl K</span>
      `;
      triggerBtn.addEventListener('click', () => this.open());

      if (headerControls) {
        headerControls.insertBefore(triggerBtn, headerControls.firstChild);
      } else {
        headerInner.appendChild(triggerBtn);
      }
    }

    bindEvents() {
      // Global Keydown listener for Ctrl+K, Cmd+K, /
      window.addEventListener('keydown', (e) => {
        const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
        const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

        // Open with Ctrl+K / Cmd+K
        if (isCmdOrCtrl && (e.key === 'k' || e.key === 'K')) {
          e.preventDefault();
          this.toggle();
          return;
        }

        // Open with Slash '/' when not typing in an input
        if (e.key === '/' && !this.isOpen) {
          const tag = (e.target.tagName || '').toLowerCase();
          if (tag !== 'input' && tag !== 'textarea' && !e.target.isContentEditable) {
            e.preventDefault();
            this.open();
            return;
          }
        }

        // Handle navigation inside palette
        if (this.isOpen) {
          if (e.key === 'Escape') {
            e.preventDefault();
            this.close();
          } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            this.moveSelection(1);
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            this.moveSelection(-1);
          } else if (e.key === 'Enter') {
            e.preventDefault();
            this.executeSelected();
          }
        }
      });

      // Overlay click to close
      this.overlay.addEventListener('click', (e) => {
        if (e.target === this.overlay) {
          this.close();
        }
      });

      // Input search
      this.input.addEventListener('input', () => {
        this.filter(this.input.value.trim());
      });

      // Drag & Drop onto palette
      this.bindDragDrop();
    }

    bindDragDrop() {
      let dragCounter = 0;

      window.addEventListener('dragenter', (e) => {
        dragCounter++;
        if (this.isOpen && e.dataTransfer && e.dataTransfer.types.includes('Files')) {
          this.dragBanner.style.display = 'block';
        }
      });

      window.addEventListener('dragleave', (e) => {
        dragCounter--;
        if (dragCounter <= 0) {
          dragCounter = 0;
          if (this.dragBanner) this.dragBanner.style.display = 'none';
        }
      });

      window.addEventListener('drop', (e) => {
        dragCounter = 0;
        if (this.dragBanner) this.dragBanner.style.display = 'none';
      });
    }

    filter(query) {
      const catalog = getCatalog();
      if (!query) {
        this.filteredItems = [...catalog];
      } else {
        const q = query.toLowerCase();
        this.filteredItems = catalog.filter(tool => {
          const nameMatch = tool.name.toLowerCase().includes(q);
          const categoryMatch = tool.category.toLowerCase().includes(q);
          const descMatch = tool.desc.toLowerCase().includes(q);
          const keywordMatch = tool.keywords.some(k => k.toLowerCase().includes(q));
          return nameMatch || categoryMatch || descMatch || keywordMatch;
        });
      }

      this.selectedIndex = 0;
      this.renderList();
    }

    renderList() {
      if (this.filteredItems.length === 0) {
        this.list.innerHTML = `
          <div class="cmd-palette-empty">
            <span class="cmd-empty-icon"><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg></span>
            <p>Tidak ditemukan alat yang cocok dengan kata kunci tersebut.</p>
            <small>Coba gunakan kata kunci seperti "kompres", "ocr", "tanda tangan", atau "gabung".</small>
          </div>
        `;
        return;
      }

      const html = this.filteredItems.map((item, idx) => {
        const isSelected = idx === this.selectedIndex;
        return `
          <div class="cmd-palette-item ${isSelected ? 'selected' : ''}" data-index="${idx}" data-url="${item.url}" role="option" aria-selected="${isSelected}">
            <div class="cmd-item-icon" style="background: ${item.color}22; color: ${item.color}; border: 1px solid ${item.color}44;">
              ${item.icon}
            </div>
            <div class="cmd-item-info">
              <div class="cmd-item-header">
                <span class="cmd-item-title">${item.name}</span>
                <span class="cmd-item-category" style="color: ${item.color}">${item.category}</span>
                <span class="cmd-item-badge">${item.badge}</span>
              </div>
              <div class="cmd-item-desc">${item.desc}</div>
            </div>
            <div class="cmd-item-action">
              <span class="cmd-item-arrow"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg></span>
            </div>
            <div class="cmd-item-drop-target">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="vertical-align: middle; margin-right: 4px;"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg><span>Lepaskan file di sini untuk buka langsung</span>
            </div>
          </div>
        `;
      }).join('');

      this.list.innerHTML = html;

      // Bind click and drag on each item
      const itemElements = this.list.querySelectorAll('.cmd-palette-item');
      itemElements.forEach((el, index) => {
        el.addEventListener('click', () => {
          this.selectedIndex = index;
          this.executeSelected();
        });

        el.addEventListener('mouseenter', () => {
          this.setSelection(index, false);
        });

        // Item-level dragover / drop
        el.addEventListener('dragover', (e) => {
          e.preventDefault();
          el.classList.add('dragover');
        });

        el.addEventListener('dragleave', () => {
          el.classList.remove('dragover');
        });

        el.addEventListener('drop', async (e) => {
          e.preventDefault();
          el.classList.remove('dragover');
          if (this.dragBanner) this.dragBanner.style.display = 'none';

          const files = e.dataTransfer ? e.dataTransfer.files : null;
          if (files && files.length > 0) {
            const file = files[0];
            const targetUrl = el.getAttribute('data-url');
            await this.handoffFileAndNavigate(file, targetUrl);
          }
        });
      });

      this.scrollToSelected();
    }

    async handoffFileAndNavigate(file, targetUrl) {
      if (window.PDFTools && PDFTools.FileUtils && PDFTools.FileUtils.setPendingFile) {
        try {
          if (window.PDFTools.Toast) {
            PDFTools.Toast.info(`Membuka berkas "${file.name}" di alat pilihan...`);
          }
          await PDFTools.FileUtils.setPendingFile(file);
        } catch (err) {
          console.warn('Handoff error:', err);
        }
      }
      window.location.href = targetUrl;
    }

    moveSelection(delta) {
      if (this.filteredItems.length === 0) return;
      this.selectedIndex = (this.selectedIndex + delta + this.filteredItems.length) % this.filteredItems.length;
      this.updateSelectionVisuals();
      this.scrollToSelected();
    }

    setSelection(index, scroll = true) {
      this.selectedIndex = index;
      this.updateSelectionVisuals();
      if (scroll) this.scrollToSelected();
    }

    updateSelectionVisuals() {
      const items = this.list.querySelectorAll('.cmd-palette-item');
      items.forEach((item, idx) => {
        if (idx === this.selectedIndex) {
          item.classList.add('selected');
          item.setAttribute('aria-selected', 'true');
        } else {
          item.classList.remove('selected');
          item.setAttribute('aria-selected', 'false');
        }
      });
    }

    scrollToSelected() {
      const selectedEl = this.list.querySelector('.cmd-palette-item.selected');
      if (selectedEl) {
        selectedEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    executeSelected() {
      if (this.filteredItems.length === 0) return;
      const selected = this.filteredItems[this.selectedIndex];
      if (selected && selected.url) {
        this.close();
        window.location.href = selected.url;
      }
    }

    open() {
      this.isOpen = true;
      this.overlay.classList.add('active');
      this.overlay.setAttribute('aria-hidden', 'false');
      this.input.value = '';
      this.filter('');
      setTimeout(() => this.input.focus(), 50);
      document.body.style.overflow = 'hidden';
    }

    close() {
      this.isOpen = false;
      this.overlay.classList.remove('active');
      this.overlay.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      if (this.dragBanner) this.dragBanner.style.display = 'none';
    }

    toggle() {
      if (this.isOpen) {
        this.close();
      } else {
        this.open();
      }
    }
  }

  // Auto-initialize when document is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.PDFCommandPalette = new CommandPalette();
      window.PDFTools = window.PDFTools || {};
      window.PDFTools.CommandPalette = window.PDFCommandPalette;
    });
  } else {
    window.PDFCommandPalette = new CommandPalette();
    window.PDFTools = window.PDFTools || {};
    window.PDFTools.CommandPalette = window.PDFCommandPalette;
  }
})();
