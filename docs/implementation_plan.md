# 📄 RPD Final: PDF Tools Application

## ✅ Keputusan Final

| Aspek | Keputusan |
|---|---|
| **Stack** | Vanilla HTML / CSS / JavaScript (tanpa framework) |
| **PDF Engine** | `pdf-lib` (client-side, semua proses di browser) |
| **Server** | Laragon (PHP local server) |
| **Bahasa UI** | Bilingual — Indonesia + English (toggle) |
| **Deployment** | Lokal dulu |

---

## 🎯 Fitur Phase 1 (7 Tools)

| # | Fitur | Library | Kesulitan |
|---|---|---|---|
| 1 | **Merge PDF** — Gabungkan beberapa PDF jadi satu | pdf-lib | ⭐⭐ |
| 2 | **Compress PDF** — Kurangi ukuran file PDF | pdf-lib + canvas | ⭐⭐⭐ |
| 3 | **Split PDF** — Pisahkan halaman | pdf-lib | ⭐⭐ |
| 4 | **JPG to PDF** — Konversi gambar ke PDF | pdf-lib | ⭐ |
| 5 | **Rotate PDF** — Putar halaman | pdf-lib | ⭐ |
| 6 | **Remove Pages** — Hapus halaman tertentu | pdf-lib | ⭐⭐ |
| 7 | **Reorder Pages** — Susun ulang via drag & drop | pdf-lib + SortableJS | ⭐⭐ |

---

## 📁 Struktur Proyek

```
d:\coding\pdf\
├── index.html                  # Landing page (semua tools)
├── merge.html                  # Tool: Merge PDF
├── compress.html               # Tool: Compress PDF
├── split.html                  # Tool: Split PDF
├── jpg-to-pdf.html             # Tool: JPG to PDF
├── rotate.html                 # Tool: Rotate PDF
├── remove-pages.html           # Tool: Remove Pages
├── reorder.html                # Tool: Reorder Pages
│
├── css/
│   ├── style.css               # Global styles & design system
│   ├── home.css                # Landing page specific
│   └── tool.css                # Tool pages shared styles
│
├── js/
│   ├── lib/
│   │   ├── pdf-lib.min.js      # PDF manipulation (from CDN or local)
│   │   ├── pdf.min.js           # PDF.js for preview/rendering
│   │   ├── pdf.worker.min.js    # PDF.js worker
│   │   └── Sortable.min.js     # Drag & drop reorder
│   │
│   ├── core/
│   │   ├── pdf-merge.js        # Merge logic
│   │   ├── pdf-compress.js     # Compress logic
│   │   ├── pdf-split.js        # Split logic
│   │   ├── pdf-rotate.js       # Rotate logic
│   │   ├── pdf-remove.js       # Remove pages logic
│   │   ├── pdf-reorder.js      # Reorder logic
│   │   └── jpg-to-pdf.js       # Image to PDF logic
│   │
│   ├── components/
│   │   ├── dropzone.js         # Drag & drop file upload component
│   │   ├── pdf-preview.js      # PDF thumbnail generator
│   │   ├── progress.js         # Progress bar component
│   │   ├── toast.js            # Notification toasts
│   │   └── file-list.js        # File list with actions
│   │
│   ├── utils/
│   │   ├── file-utils.js       # File size formatter, etc.
│   │   ├── download.js         # Trigger file download
│   │   └── i18n.js             # Bilingual support (ID/EN)
│   │
│   └── app.js                  # Main app initialization
│
├── lang/
│   ├── id.json                 # Bahasa Indonesia translations
│   └── en.json                 # English translations
│
├── assets/
│   ├── icons/                  # Tool icons (SVG)
│   ├── images/                 # Static images
│   └── fonts/                  # Custom fonts (Inter/Outfit)
│
└── README.md
```

> [!NOTE]
> Semua file `.html` bisa langsung dibuka di Laragon. Tidak perlu PHP processing karena semua PDF operations dilakukan di browser via JavaScript. PHP hanya sebagai web server.

---

## 🔧 Detail Implementasi Per Fitur

### 1. Merge PDF
- User drag & drop multiple PDF files
- Preview thumbnail tiap file (via PDF.js)
- Drag to reorder urutan file (SortableJS)
- Klik "Merge" → pdf-lib gabungkan semua → download hasil
- Tampilkan progress bar selama proses

### 2. Compress PDF  
- Upload satu atau multiple PDF
- Pilih level: Low / Medium / High compression
- **Strategi kompresi client-side:**
  - Hapus metadata & duplikat objects
  - Re-encode gambar dalam PDF dengan kualitas lebih rendah (via canvas)
  - Remove unused resources
- Tampilkan before/after file size + persentase penghematan

### 3. Split PDF
- Upload satu PDF → tampilkan semua halaman sebagai thumbnail
- Opsi split: 
  - Extract halaman tertentu (pilih per halaman)
  - Split setiap N halaman
  - Custom range (e.g., 1-3, 5, 7-10)
- Download sebagai individual files atau ZIP

### 4. JPG to PDF
- Upload multiple gambar (JPG, PNG, WebP)
- Preview & reorder gambar
- Opsi: page size (A4/Letter/Original), orientation, margin
- Gabungkan semua gambar jadi satu PDF

### 5. Rotate PDF
- Upload PDF → tampilkan semua halaman
- Klik per halaman untuk rotate (90°, 180°, 270°)
- Atau rotate semua sekaligus
- Download hasil

### 6. Remove Pages
- Upload PDF → tampilkan semua halaman sebagai thumbnail
- Klik halaman untuk select/deselect yang mau dihapus
- Preview hasil akhir → download

### 7. Reorder Pages
- Upload PDF → tampilkan semua halaman
- Drag & drop untuk reorder
- Preview hasil → download

---

## 🎨 Design System

### Warna per Tool (terinspirasi iLovePDF)
| Tool | Warna Utama | Hex |
|---|---|---|
| Merge PDF | 🟠 Orange | `#EE6C4D` |
| Compress PDF | 🟢 Green | `#8FBC5D` |
| Split PDF | 🟠 Orange | `#FF6B4D` |
| JPG to PDF | 🟡 Yellow | `#F5A623` |
| Rotate PDF | 🔵 Blue | `#4A90D9` |
| Remove Pages | 🔴 Red | `#E74C3C` |
| Reorder Pages | 🟣 Purple | `#9B59B6` |

### UI Components
- **Dark gradient background** — modern & premium feel
- **Glassmorphism cards** — backdrop-filter blur
- **Smooth animations** — hover effects, page transitions
- **Drag & drop zone** — large, dashed border, animated on hover
- **Google Fonts: Inter** — clean, professional typography

---

## 📦 Dependencies (semua via CDN, tanpa npm)

```html
<!-- PDF Manipulation -->
<script src="https://unpkg.com/pdf-lib/dist/pdf-lib.min.js"></script>

<!-- PDF Preview/Rendering -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>

<!-- Drag & Drop Reorder -->
<script src="https://cdn.jsdelivr.net/npm/sortablejs@1.15.0/Sortable.min.js"></script>

<!-- File Saver (download) -->
<script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js"></script>

<!-- JSZip (untuk split → download as ZIP) -->
<script src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>

<!-- Font -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
```

> [!TIP]
> Semua library dimuat via CDN. Tidak perlu `npm install`. Langsung jalan di Laragon!

---

## 🛣️ Urutan Development

| Step | Task | Estimasi |
|---|---|---|
| 1 | Setup project + design system (CSS) | ~ |
| 2 | Landing page (index.html) + tool grid | ~ |
| 3 | Shared components (dropzone, preview, progress) | ~ |
| 4 | **Merge PDF** tool | ~ |
| 5 | **Compress PDF** tool | ~ |
| 6 | **Split PDF** tool | ~ |
| 7 | **JPG to PDF** tool | ~ |
| 8 | **Rotate PDF** tool | ~ |
| 9 | **Remove Pages** tool | ~ |
| 10 | **Reorder Pages** tool | ~ |
| 11 | Bilingual support (i18n) | ~ |
| 12 | Polish & test semua fitur | ~ |

---

## Verification Plan

### Manual Verification
- Buka di Laragon → test setiap tool
- Test dengan berbagai ukuran PDF (kecil, sedang, besar)
- Test drag & drop di Chrome, Firefox, Edge
- Pastikan download hasil berfungsi
- Cek responsiveness di berbagai ukuran layar
