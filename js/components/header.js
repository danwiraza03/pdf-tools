/**
 * PDF Tools — Unified Global Header & Tools Registry Component
 * 100% Client-Side, Zero Server Transfer, Offline-First.
 * Single Source of Truth for Navigation, Mega Menu, and Command Palette Tools Data.
 */
(function () {
  'use strict';

  window.PDFTools = window.PDFTools || {};

  // Determine current depth for relative URL links
  function getPaths() {
    const rawPath = (window.location && window.location.pathname) ? window.location.pathname.replace(/\\/g, '/') : '';
    const isPagesDir = rawPath.includes('/pages/') || (window.location && window.location.href && window.location.href.includes('/pages/'));
    const homeUrl = isPagesDir ? '../index.html' : 'index.html';
    const pagesUrl = isPagesDir ? '' : 'pages/';
    const currentFile = rawPath.split('/').pop() || (isPagesDir ? 'viewer.html' : 'index.html');
    return { isPagesDir, homeUrl, pagesUrl, currentFile };
  }

  // --- SINGLE SOURCE OF TRUTH: 23 STANDALONE TOOLS DATA ---
  const TOOLS_DATA = [
    {
      id: 'studio',
      name: 'PDF Studio Pro',
      nameKey: 'tool.studio',
      file: 'viewer.html',
      color: '#9333EA',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'Editor Pro',
      desc: 'Buka workspace lengkap: sunting teks, isi formulir, tanda tangan kaligrafi, stempel & OCR.',
      descKey: 'tool.studio.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>',
      keywords: ['edit', 'editor', 'studio', 'text', 'teks', 'sunting', 'sign', 'signature', 'tanda tangan', 'paraf', 'fill', 'form', 'formulir', 'stamp', 'stempel', 'redaction', 'acrobat']
    },
    {
      id: 'merge',
      name: 'Merge PDF',
      nameKey: 'tool.merge',
      file: 'merge.html',
      color: '#E11D48',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Multi-File',
      desc: 'Gabungkan beberapa berkas PDF menjadi satu dengan Visual Page Organizer & drag-drop.',
      descKey: 'tool.merge.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg>',
      keywords: ['merge', 'gabung', 'combine', 'unite', 'join', 'satukan', 'kumpul', 'organize', 'halaman']
    },
    {
      id: 'split',
      name: 'Split PDF',
      nameKey: 'tool.split',
      file: 'split.html',
      color: '#EA580C',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Extraction',
      desc: 'Pisahkan dokumen PDF per lembar halaman, rentang halaman (range), atau setiap N halaman.',
      descKey: 'tool.split.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>',
      keywords: ['split', 'pisah', 'pecah', 'potong', 'extract', 'range', 'bagi', 'lembar']
    },
    {
      id: 'remove-pages',
      name: 'Remove Pages',
      nameKey: 'tool.remove',
      file: 'remove-pages.html',
      color: '#EF4444',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Cleaner',
      desc: 'Hapus satu atau beberapa halaman tertentu yang tidak diinginkan secara visual.',
      descKey: 'tool.remove.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/></svg>',
      keywords: ['remove', 'delete', 'hapus', 'buang', 'hilangkan', 'buang halaman', 'kurangi']
    },
    {
      id: 'reorder',
      name: 'Reorder Pages',
      nameKey: 'tool.reorder',
      file: 'reorder.html',
      color: '#8B5CF6',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Sorter',
      desc: 'Atur ulang susunan posisi halaman dokumen dengan antarmuka drag-and-drop yang cepat.',
      descKey: 'tool.reorder.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>',
      keywords: ['reorder', 'susun', 'tukar urutan', 'geser', 'posisi', 'urutkan']
    },
    {
      id: 'rotate',
      name: 'Rotate PDF',
      nameKey: 'tool.rotate',
      file: 'rotate.html',
      color: '#3B82F6',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Transform',
      desc: 'Putar orientasi halaman PDF (90°, 180°, 270°) per lembar atau serentak seluruh dokumen.',
      descKey: 'tool.rotate.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><polyline points="21 3 21 8 16 8"/></svg>',
      keywords: ['rotate', 'putar', 'orientasi', 'landscape', 'portrait', 'miring', 'balik']
    },
    {
      id: 'crop',
      name: 'Crop & Trim Margins',
      nameKey: 'tool.crop',
      file: 'crop.html',
      color: '#F59E0B',
      category: 'Organize',
      categoryGroup: 'organize',
      badge: 'Auto-Trim',
      desc: 'Pangkas margin putih berlebih dengan 8 handle visual dan deteksi otomatis Auto-Trim.',
      descKey: 'tool.crop.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2"/></svg>',
      keywords: ['crop', 'trim', 'potong', 'margin', 'whitespace', 'pangkas', 'batas kertas']
    },
    {
      id: 'compress',
      name: 'Compress PDF',
      nameKey: 'tool.compress',
      file: 'compress.html',
      color: '#16A34A',
      category: 'Optimize & Protect',
      categoryGroup: 'optimize',
      badge: 'Batch Queue',
      desc: 'Kecilkan ukuran file PDF secara adaptif tanpa merusak e-materai atau tanda tangan digital.',
      descKey: 'tool.compress.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>',
      keywords: ['compress', 'kompres', 'kecilkan', 'shrink', 'resize', 'hemat', 'mb', 'kb', 'batch', 'zip']
    },
    {
      id: 'ocr',
      name: 'OCR PDF',
      nameKey: 'tool.ocr',
      file: 'ocr.html',
      color: '#06B6D4',
      category: 'Optimize & Protect',
      categoryGroup: 'optimize',
      badge: 'WASM SIMD',
      desc: 'Ekstrak teks dari PDF pindaian (scan) / gambar & buat Searchable PDF secara offline murni.',
      descKey: 'tool.ocr.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>',
      keywords: ['ocr', 'scan', 'pindai', 'ekstrak', 'teks', 'text', 'ktp', 'ijazah', 'searchable', 'tesseract', 'foto']
    },
    {
      id: 'grayscale',
      name: 'PDF to Grayscale',
      nameKey: 'tool.grayscale',
      file: 'grayscale.html',
      color: '#64748B',
      category: 'Optimize & Protect',
      categoryGroup: 'optimize',
      badge: 'Fotokopi B&W',
      desc: 'Ubah dokumen berwarna menjadi skala abu-abu halus atau fotokopi hitam putih pekat.',
      descKey: 'tool.grayscale.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 0 0 20z" fill="currentColor"/></svg>',
      keywords: ['grayscale', 'black and white', 'hitam putih', 'fotokopi', 'bw', 'hemat tinta', 'print']
    },
    {
      id: 'flatten',
      name: 'Flatten PDF',
      nameKey: 'tool.flatten',
      file: 'flatten.html',
      color: '#6366F1',
      category: 'Optimize & Protect',
      categoryGroup: 'optimize',
      badge: 'Read-Only',
      desc: 'Kunci isian form, tanda tangan, dan stempel menjadi lapisan permanen agar anti-tamper.',
      descKey: 'tool.flatten.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>',
      keywords: ['flatten', 'kunci', 'lock', 'permanent', 'stempel aman', 'read only', 'anti edit']
    },
    {
      id: 'protect',
      name: 'Protect & Unlock PDF',
      nameKey: 'tool.protect',
      file: 'protect.html',
      color: '#EF4444',
      category: 'Optimize & Protect',
      categoryGroup: 'optimize',
      badge: 'Batch Queue',
      desc: 'Proteksi dokumen PDF dengan kata sandi enkripsi kuat atau buka kunci berkas PDF Anda.',
      descKey: 'tool.protect.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
      keywords: ['protect', 'lock', 'unlock', 'password', 'sandi', 'kunci', 'enkripsi', 'decrypt', 'aman']
    },
    {
      id: 'jpg-to-pdf',
      name: 'JPG to PDF',
      nameKey: 'tool.jpg_pdf',
      file: 'jpg-to-pdf.html',
      color: '#EAB308',
      category: 'Convert to PDF',
      categoryGroup: 'convert_to',
      badge: 'Converter',
      desc: 'Konversi gambar (JPG, PNG, WebP) ke dokumen PDF dengan kustomisasi margin & ukuran kertas.',
      descKey: 'tool.jpg_pdf.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><circle cx="9.5" cy="12.5" r="1.5"/><path d="M16 18l-3-3-4 4"/></svg>',
      keywords: ['jpg', 'png', 'webp', 'image', 'gambar', 'foto', 'convert', 'konversi', 'jadikan pdf']
    },
    {
      id: 'docx-to-pdf',
      name: 'Word to PDF',
      nameKey: 'tool.docx_pdf',
      file: 'docx-to-pdf.html',
      color: '#2563EB',
      category: 'Convert to PDF',
      categoryGroup: 'convert_to',
      badge: 'Converter',
      desc: 'Ubah berkas dokumen Word (.docx) menjadi berkas PDF berkualitas tinggi secara offline.',
      descKey: 'tool.docx_pdf.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="7.5 13 9 17 11.5 14 14 17 15.5 13"/></svg>',
      keywords: ['word', 'docx', 'doc to pdf', 'convert', 'konversi']
    },
    {
      id: 'xlsx-to-pdf',
      name: 'Excel to PDF',
      nameKey: 'tool.xlsx_pdf',
      file: 'xlsx-to-pdf.html',
      color: '#15803D',
      category: 'Convert to PDF',
      categoryGroup: 'convert_to',
      badge: 'Converter',
      desc: 'Konversi spreadsheet Excel (.xlsx) menjadi tabel PDF rapi dan siap cetak.',
      descKey: 'tool.xlsx_pdf.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8.5" y1="12.5" x2="15.5" y2="17.5"/><line x1="15.5" y1="12.5" x2="8.5" y2="17.5"/></svg>',
      keywords: ['excel', 'xlsx', 'excel to pdf', 'convert', 'tabel']
    },
    {
      id: 'pdf-to-docx',
      name: 'PDF to Word',
      nameKey: 'tool.pdf_docx',
      file: 'pdf-to-docx.html',
      color: '#2563EB',
      category: 'Convert from PDF',
      categoryGroup: 'convert_from',
      badge: 'DOCX',
      desc: 'Konversi dokumen PDF menjadi berkas Microsoft Word (.docx) yang dapat diedit.',
      descKey: 'tool.pdf_docx.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>',
      keywords: ['word', 'docx', 'doc', 'convert', 'konversi', 'edit text']
    },
    {
      id: 'pdf-to-xlsx',
      name: 'PDF to Excel',
      nameKey: 'tool.pdf_xlsx',
      file: 'pdf-to-xlsx.html',
      color: '#15803D',
      category: 'Convert from PDF',
      categoryGroup: 'convert_from',
      badge: 'XLSX',
      desc: 'Ekstrak tabel dan data angka dari PDF langsung ke lembar kerja Excel (.xlsx).',
      descKey: 'tool.pdf_xlsx.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>',
      keywords: ['excel', 'xlsx', 'xls', 'spreadsheet', 'tabel', 'angka', 'data']
    },
    {
      id: 'pdf-to-jpg',
      name: 'PDF to JPG',
      nameKey: 'tool.pdf_jpg',
      file: 'pdf-to-jpg.html',
      color: '#06B6D4',
      category: 'Convert from PDF',
      categoryGroup: 'convert_from',
      badge: 'Rasterizer',
      desc: 'Ekstrak dan ubah lembaran dokumen PDF menjadi gambar resolusi tinggi (JPG / PNG / ZIP).',
      descKey: 'tool.pdf_jpg.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
      keywords: ['pdf to jpg', 'ekstrak gambar', 'rasterize', 'export image', 'halaman ke gambar']
    },
    {
      id: 'watermark',
      name: 'Watermark PDF',
      nameKey: 'tool.watermark',
      file: 'watermark.html',
      color: '#EC4899',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'Batch Queue',
      desc: 'Bubuhkan stempel tanda air teks / logo dengan rotasi, transparansi, dan antrean batch.',
      descKey: 'tool.watermark.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>',
      keywords: ['watermark', 'cap', 'stempel', 'label', 'confidential', 'rahasia', 'draft', 'hak cipta']
    },
    {
      id: 'page-number',
      name: 'Page Numbers',
      nameKey: 'tool.page_number',
      file: 'page-number.html',
      color: '#10B981',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'Batch Queue',
      desc: 'Tambahkan penomoran halaman otomatis, Bates numbering, header dan footer dokumen.',
      descKey: 'tool.page_number.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>',
      keywords: ['page number', 'nomor halaman', 'penomoran', 'bates', 'header', 'footer', 'angka']
    },
    {
      id: 'sign',
      name: 'Sign PDF',
      nameKey: 'tool.sign',
      file: 'sign.html',
      color: '#1E3A8A',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'E-Sign',
      desc: 'Bubuhkan tanda tangan digital, paraf, atau stempel e-materai langsung di PDF.',
      descKey: 'tool.sign.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg>',
      keywords: ['sign', 'tanda tangan', 'paraf', 'signature', 'materai', 'stamp']
    },
    {
      id: 'form-fill',
      name: 'Fill PDF Forms',
      nameKey: 'tool.form_fill',
      file: 'form-fill.html',
      color: '#0284C7',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'AcroForm',
      desc: 'Isi formulir PDF interaktif, centang checkbox, dan simpan form secara instan.',
      descKey: 'tool.form_fill.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
      keywords: ['form', 'formulir', 'fill', 'isi', 'acroform', 'centang']
    },
    {
      id: 'batch',
      name: 'Batch Processing',
      nameKey: 'tool.batch',
      file: 'batch.html',
      color: '#0D9488',
      category: 'Edit & Stamp',
      categoryGroup: 'edit',
      badge: 'Workflows',
      desc: 'Proses puluhan berkas PDF sekaligus: kompres, watermark, grayscale, dan proteksi.',
      descKey: 'tool.batch.desc',
      icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
      keywords: ['batch', 'massal', 'banyak', 'queue', 'antrean', 'otomatis']
    }
  ];

  // Expose tools registry globally
  window.PDFTools.TOOLS_DATA = TOOLS_DATA;

  // Convert menu items (subset of TOOLS_DATA)
  const CONVERT_TOOL_IDS = [
    'pdf-to-docx',
    'pdf-to-xlsx',
    'pdf-to-jpg',
    'jpg-to-pdf',
    'docx-to-pdf',
    'xlsx-to-pdf'
  ];

  // Mega menu structure configuration
  const MEGA_COLUMNS = [
    { title: 'ORGANIZE PDF', titleKey: 'mega.organize', toolIds: ['merge', 'split', 'remove-pages', 'reorder', 'rotate', 'crop'] },
    { title: 'OPTIMIZE PDF', titleKey: 'mega.optimize', toolIds: ['compress', 'ocr', 'grayscale', 'flatten', 'protect'] },
    { title: 'CONVERT TO PDF', titleKey: 'mega.convert_to', toolIds: ['jpg-to-pdf', 'docx-to-pdf', 'xlsx-to-pdf'] },
    { title: 'CONVERT FROM PDF', titleKey: 'mega.convert_from', toolIds: ['pdf-to-docx', 'pdf-to-xlsx', 'pdf-to-jpg'] },
    { title: 'EDIT PDF', titleKey: 'mega.edit', toolIds: ['studio', 'page-number', 'watermark', 'sign', 'form-fill', 'batch'] }
  ];

  /**
   * Header Component Builder
   */
  const HeaderComponent = {
    initialized: false,

    init: function (force) {
      if (this.initialized && !force) return;
      if (document.body && document.body.classList.contains('tool-page-viewer')) {
        return; // Viewer / Studio has its own full-screen custom acrobat layout
      }

      const headerEl = document.querySelector('header.header, #appHeader, [data-component="header"]');
      if (!headerEl) return;

      this.render(headerEl);
      this.ensureMegaMenu();
      this.ensureQuickModal();
      this.bindEvents(headerEl);
      this.initialized = true;
    },

    render: function (headerEl) {
      const { homeUrl, pagesUrl, currentFile } = getPaths();

      const isConvertActive = CONVERT_TOOL_IDS.some(id => {
        const t = TOOLS_DATA.find(x => x.id === id);
        return t && t.file === currentFile;
      });

      // Build Convert dropdown items
      const convertItemsHtml = CONVERT_TOOL_IDS.map(id => {
        const tool = TOOLS_DATA.find(t => t.id === id);
        if (!tool) return '';
        return `
          <a href="${pagesUrl}${tool.file}" class="dropdown-item-link ${tool.file === currentFile ? 'active' : ''}">
            <div class="item-icon" style="background: ${tool.color}; color: #ffffff;">
              ${tool.icon}
            </div>
            <div class="item-text">
              <span class="item-title" data-i18n="${tool.nameKey}">${tool.name}</span>
              <span class="item-desc">${tool.badge}</span>
            </div>
          </a>
        `;
      }).join('');

      headerEl.innerHTML = `
        <div class="header-inner">
          <!-- Logo: PDF Tools with Status Dot -->
          <a href="${homeUrl}" class="app-logo">
            <div class="logo-badge">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
              </svg>
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
              <a href="javascript:void(0)" class="nav-link-item ${isConvertActive ? 'active' : ''}" id="convertPdfTrigger" aria-haspopup="true" aria-expanded="false">
                <span data-i18n="nav.convert">CONVERT PDF</span>
                <svg class="nav-chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:middle;"><polyline points="6 9 12 15 18 9"/></svg>
              </a>
              <div class="convert-dropdown-menu" id="convertDropdownMenu" role="menu">
                ${convertItemsHtml}
              </div>
            </div>

            <!-- ALL PDF TOOLS Mega Menu Trigger -->
            <a href="javascript:void(0)" class="nav-link-item all-tools-toggle" id="allToolsTrigger" aria-haspopup="true" aria-expanded="false">
              <span data-i18n="nav.all_tools">ALL PDF TOOLS</span>
              <svg class="nav-chevron-svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;vertical-align:middle;"><polyline points="6 9 12 15 18 9"/></svg>
            </a>
          </nav>

          <!-- Right Controls -->
          <div class="header-controls">
            <button class="theme-toggle" id="themeToggle" title="Toggle Light/Dark Theme (Ctrl+D)" aria-label="Toggle Light/Dark Theme">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>
              <span>Dark</span>
            </button>
            <button class="lang-toggle" id="langToggle" aria-label="Toggle Language">ID</button>
            <a href="${pagesUrl}viewer.html" class="btn-header-studio" data-i18n="nav.studio" aria-label="Open PDF Studio">
              <svg class="btn-svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
              </svg>
              <span>PDF Studio</span>
            </a>
            <button type="button" class="nine-dots-btn" id="nineDotsBtn" title="All Quick Actions" aria-label="Quick Actions Menu" aria-haspopup="true" aria-expanded="false" data-i18n-title="nav.quick_actions">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="5" r="2"/><circle cx="12" cy="5" r="2"/><circle cx="19" cy="5" r="2"/>
                <circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/>
                <circle cx="5" cy="19" r="2"/><circle cx="12" cy="19" r="2"/><circle cx="19" cy="19" r="2"/>
              </svg>
            </button>
            <button type="button" class="mobile-menu-btn" id="mobileMenuBtn" aria-label="Open Navigation Menu" aria-expanded="false">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <line x1="3" y1="6" x2="21" y2="6"/>
                <line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      `;
    },

    ensureMegaMenu: function () {
      const { pagesUrl, currentFile } = getPaths();
      let megaOverlay = document.getElementById('megaMenuOverlay');
      if (!megaOverlay) {
        megaOverlay = document.createElement('div');
        megaOverlay.className = 'mega-menu-overlay';
        megaOverlay.id = 'megaMenuOverlay';
        document.body.appendChild(megaOverlay);
      }

      const columnsHtml = MEGA_COLUMNS.map(col => {
        const itemsHtml = col.toolIds.map(tId => {
          const tool = TOOLS_DATA.find(t => t.id === tId);
          if (!tool) return '';
          return `
            <a href="${pagesUrl}${tool.file}" class="mega-item-link ${tool.file === currentFile ? 'active' : ''}">
              <span class="mega-item-icon" style="background: ${tool.color}; color: #ffffff;">
                ${tool.icon}
              </span>
              <span data-i18n="${tool.nameKey}">${tool.name}</span>
            </a>
          `;
        }).join('');

        return `
          <div class="mega-col">
            <div class="mega-col-title" data-i18n="${col.titleKey}">${col.title}</div>
            ${itemsHtml}
          </div>
        `;
      }).join('');

      megaOverlay.innerHTML = `
        <div class="mega-menu-container">
          ${columnsHtml}
        </div>
      `;
    },

    ensureQuickModal: function () {
      const { pagesUrl } = getPaths();
      let quickModal = document.getElementById('quickModalBackdrop');
      if (!quickModal) {
        quickModal = document.createElement('div');
        quickModal.className = 'quick-modal-backdrop';
        quickModal.id = 'quickModalBackdrop';
        document.body.appendChild(quickModal);
      }

      // If quick-modal-content does not exist, inject the standardized 10-tool grid
      if (!quickModal.querySelector('.quick-modal-content')) {
        const QUICK_TOOLS = [
          { id: 'quickBtnStudio', file: 'viewer.html', nameKey: 'tool.studio', name: 'PDF Studio', color: '#9333EA', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>' },
          { id: 'quickBtnMerge', file: 'merge.html', nameKey: 'tool.merge', name: 'Merge PDF', color: '#E11D48', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 9l4-4 4 4M12 5v14M5 19h14"/></svg>' },
          { id: 'quickBtnCompress', file: 'compress.html', nameKey: 'tool.compress', name: 'Compress PDF', color: '#16A34A', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6m0 0v6m0-6L3 21M20 10h-6m0 0V4m0 6l7-7"/></svg>' },
          { id: 'quickBtnSplit', file: 'split.html', nameKey: 'tool.split', name: 'Split PDF', color: '#EA580C', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4L8.12 15.88M14.47 14.48L20 20M8.12 8.12L12 12"/></svg>' },
          { id: 'quickBtnPdfWord', file: 'pdf-to-docx.html', nameKey: 'tool.pdf_docx', name: 'PDF to Word', color: '#2563EB', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>' },
          { id: 'quickBtnPdfExcel', file: 'pdf-to-xlsx.html', nameKey: 'tool.pdf_xlsx', name: 'PDF to Excel', color: '#15803D', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>' },
          { id: 'quickBtnSign', file: 'sign.html', nameKey: 'tool.sign', name: 'Sign PDF', color: '#1E3A8A', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 19.5c0 .8-.7 1.5-1.5 1.5H5.5c-.8 0-1.5-.7-1.5-1.5 0-.8.7-1.5 1.5-1.5h13c.8 0 1.5.7 1.5 1.5zM18.4 4.6a2 2 0 0 1 2.8 2.8L8.8 19.8l-4.2.9.9-4.2L18.4 4.6z"/></svg>' },
          { id: 'quickBtnWordPdf', file: 'docx-to-pdf.html', nameKey: 'tool.docx_pdf', name: 'Word to PDF', color: '#2563EB', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="7.5 13 9 17 11.5 14 14 17 15.5 13"/></svg>' },
          { id: 'quickBtnExcelPdf', file: 'xlsx-to-pdf.html', nameKey: 'tool.xlsx_pdf', name: 'Excel to PDF', color: '#15803D', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8.5" y1="12.5" x2="15.5" y2="17.5"/><line x1="15.5" y1="12.5" x2="8.5" y2="17.5"/></svg>' },
          { id: 'quickBtnBatch', file: 'batch.html', nameKey: 'tool.batch', name: 'Batch Process', color: '#0D9488', icon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>' }
        ];

        const buttonsHtml = QUICK_TOOLS.map(t => `
          <button type="button" class="quick-action-btn" id="${t.id}" data-target="${pagesUrl}${t.file}">
            <span class="quick-action-btn-icon" style="background: ${t.color}1f; color: ${t.color};">
              ${t.icon}
            </span>
            <span class="quick-action-btn-label" data-i18n="${t.nameKey}">${t.name}</span>
          </button>
        `).join('');

        quickModal.innerHTML = `
          <div class="quick-modal-content" id="quickModalContent">
            <div class="quick-modal-header" id="quickModalHeader">
              <h3 data-i18n="home.quick_action_title">Choose a PDF Tool</h3>
              <p data-i18n="home.quick_action_desc">Select an action for your document:</p>
            </div>
            <div class="quick-modal-grid" id="quickModalGrid">
              ${buttonsHtml}
            </div>
            <div class="quick-modal-footer" id="quickModalFooter">
              <button type="button" class="btn btn-ghost btn-md" id="closeQuickModalBtn" data-i18n="quick.close">Cancel</button>
            </div>
          </div>
        `;
      } else {
        // In existing modal (e.g. index.html), normalize target paths
        quickModal.querySelectorAll('.quick-action-btn').forEach(btn => {
          let target = btn.getAttribute('data-target') || '';
          if (target && !pagesUrl && target.startsWith('pages/')) {
            btn.setAttribute('data-target', target.replace(/^pages\//, ''));
          } else if (target && pagesUrl && !target.startsWith('pages/') && !target.startsWith('../')) {
            btn.setAttribute('data-target', pagesUrl + target);
          }
        });
      }
    },

    bindEvents: function (headerEl) {
      const convertTrigger = headerEl.querySelector('#convertPdfTrigger');
      const convertMenu = headerEl.querySelector('#convertDropdownMenu');
      const allToolsTrigger = headerEl.querySelector('#allToolsTrigger');
      const megaOverlay = document.getElementById('megaMenuOverlay');
      const mobileMenuBtn = headerEl.querySelector('#mobileMenuBtn');
      const navEl = headerEl.querySelector('.header-nav');
      const nineDotsBtn = headerEl.querySelector('#nineDotsBtn');

      function setConvert(open) {
        if (!convertMenu) return;
        const wrapper = convertTrigger ? convertTrigger.closest('.dropdown-nav-wrapper') : headerEl.querySelector('#convertDropdownWrapper');
        if (open) {
          setMega(false);
          setQuickModal(false);
          convertMenu.classList.add('show', 'active');
          if (wrapper) wrapper.classList.add('open');
          if (convertTrigger) {
            convertTrigger.classList.add('show', 'menu-open');
            convertTrigger.setAttribute('aria-expanded', 'true');
            const chevron = convertTrigger.querySelector('.nav-chevron-svg, .nav-chevron');
            if (chevron) chevron.classList.add('rotated');
          }
        } else {
          convertMenu.classList.remove('show', 'active');
          if (wrapper) wrapper.classList.remove('open');
          if (convertTrigger) {
            convertTrigger.classList.remove('show', 'menu-open');
            convertTrigger.setAttribute('aria-expanded', 'false');
            const chevron = convertTrigger.querySelector('.nav-chevron-svg, .nav-chevron');
            if (chevron) chevron.classList.remove('rotated');
          }
        }
      }

      function setMega(open) {
        if (!megaOverlay) return;
        if (open) {
          setConvert(false);
          setQuickModal(false);
          megaOverlay.classList.add('show', 'active');
          if (allToolsTrigger) {
            allToolsTrigger.classList.add('show', 'menu-open');
            allToolsTrigger.setAttribute('aria-expanded', 'true');
            const chevron = allToolsTrigger.querySelector('.nav-chevron-svg, .nav-chevron');
            if (chevron) chevron.classList.add('rotated');
          }
        } else {
          megaOverlay.classList.remove('show', 'active');
          if (allToolsTrigger) {
            allToolsTrigger.classList.remove('show', 'menu-open');
            allToolsTrigger.setAttribute('aria-expanded', 'false');
            const chevron = allToolsTrigger.querySelector('.nav-chevron-svg, .nav-chevron');
            if (chevron) chevron.classList.remove('rotated');
          }
        }
      }

      function setQuickModal(open) {
        const qm = document.getElementById('quickModalBackdrop');
        if (!qm) return;
        if (open) {
          setConvert(false);
          setMega(false);
          qm.classList.add('active');
          if (document.body && document.body.style) document.body.style.overflow = 'hidden';
          if (nineDotsBtn) nineDotsBtn.setAttribute('aria-expanded', 'true');
        } else {
          qm.classList.remove('active');
          if (document.body && document.body.style) document.body.style.overflow = '';
          if (nineDotsBtn) nineDotsBtn.setAttribute('aria-expanded', 'false');
        }
      }

      // Convert Dropdown Toggle
      if (convertTrigger && convertMenu) {
        convertTrigger.addEventListener('click', function (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          const isOpen = convertMenu.classList.contains('show') || convertMenu.classList.contains('active');
          setConvert(!isOpen);
        });
      }

      // Mega Menu Toggle
      if (allToolsTrigger && megaOverlay) {
        allToolsTrigger.addEventListener('click', function (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          const isOpen = megaOverlay.classList.contains('show') || megaOverlay.classList.contains('active');
          setMega(!isOpen);
        });

        megaOverlay.addEventListener('click', function (e) {
          if (e.target === megaOverlay) {
            setMega(false);
          }
        });
      }

      // Nine Dots Button -> Toggle Quick Actions Modal
      if (nineDotsBtn) {
        nineDotsBtn.addEventListener('click', function (e) {
          if (e.preventDefault) e.preventDefault();
          if (e.stopPropagation) e.stopPropagation();
          const qm = document.getElementById('quickModalBackdrop');
          const isOpen = qm && qm.classList.contains('active');
          setQuickModal(!isOpen);
        });
      }

      // Direct listeners on quick modal elements
      const qmElement = document.getElementById('quickModalBackdrop');
      if (qmElement) {
        const closeBtn = qmElement.querySelector('#closeQuickModalBtn') || document.getElementById('closeQuickModalBtn');
        if (closeBtn) {
          closeBtn.addEventListener('click', function (e) {
            if (e.preventDefault) e.preventDefault();
            setQuickModal(false);
          });
        }

        qmElement.querySelectorAll('.quick-action-btn').forEach(function (btn) {
          btn.addEventListener('click', function (e) {
            if (e.preventDefault) e.preventDefault();
            const target = btn.dataset ? btn.dataset.target : btn.getAttribute('data-target');
            if (target) {
              setQuickModal(false);
              window.location.href = target;
            }
          });
        });
      }

      // Close menus and modals on outside click (delegated)
      document.addEventListener('click', function (e) {
        if (!e.target.closest('#convertDropdownWrapper')) {
          setConvert(false);
        }
        if (!e.target.closest('#allToolsTrigger') && !e.target.closest('#megaMenuOverlay')) {
          setMega(false);
        }

        const qm = document.getElementById('quickModalBackdrop');
        if (qm) {
          // Click on backdrop outside modal content closes it
          if (e.target === qm) {
            setQuickModal(false);
            return;
          }

          // Close button click
          if (e.target.closest && e.target.closest('#closeQuickModalBtn')) {
            if (e.preventDefault) e.preventDefault();
            setQuickModal(false);
            return;
          }

          // Quick action button navigation
          if (e.target.closest) {
            const btn = e.target.closest('.quick-action-btn');
            if (btn && qm.contains && qm.contains(btn)) {
              if (e.preventDefault) e.preventDefault();
              const target = btn.dataset ? btn.dataset.target : btn.getAttribute('data-target');
              if (target) {
                setQuickModal(false);
                window.location.href = target;
              }
            }
          }
        }
      });

      // Escape key closes open menus and modal
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') {
          setConvert(false);
          setMega(false);
          setQuickModal(false);
        }
      });

      // Mobile Menu Toggle
      if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', function (e) {
          if (e.preventDefault) e.preventDefault();
          const drawer = document.getElementById('mobileNavDrawer');
          if (drawer) {
            drawer.classList.toggle('open');
            const isOpen = drawer.classList.contains('open');
            if (document.body && document.body.style) document.body.style.overflow = isOpen ? 'hidden' : '';
            mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          } else if (navEl) {
            navEl.classList.toggle('mobile-open');
            const isOpen = navEl.classList.contains('mobile-open');
            mobileMenuBtn.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
          }
        });
      }
    }
  };

  window.PDFTools.Header = HeaderComponent;

  // Auto-init on DOMContentLoaded if header placeholder is found
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      HeaderComponent.init();
    });
  } else {
    HeaderComponent.init();
  }
})();
