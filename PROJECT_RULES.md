# 📋 PDF Tools — Master Architecture & Project Rules

> **PENTING UNTUK SEMUA AI AGENT & DEVELOPER:**  
> Dokumen ini adalah **Sumber Kebenaran Tunggal (Single Source of Truth)** untuk seluruh arsitektur, standar desain antarmuka, penyeragaman icon, sistem tema warna, modul editor, dan alur pemrosesan dokumen di proyek **PDF Tools**.  
> **Sebelum menambahkan fitur, memodifikasi halaman, atau membuat tool baru, Anda WAJIB membaca dan mematuhi seluruh aturan di bawah ini secara ketat.**

---

## ⚡ Ringkasan 10 Aturan Wajib (Quick Reference)

1. **100% Client-Side Offline**: Seluruh pemrosesan berkas wajib berjalan lokal di browser tanpa server, cloud, atau telemetri.
2. **Zero External URLs**: Dilarang memuat resource http(s):// eksternal pada kode produksi (wajib lokal offline).
3. **Larangan Mutlak Emoji**: Tombol, dropzone, toast, header, dan modal wajib menggunakan inline SVG vektor, bukan emoji.
4. **Konsistensi Tema & Token**: Pertahankan token `--tool-color` resmi serta kompatibilitas penuh Light & Dark theme.
5. **PDF Studio In-Memory Workflow**: Modul di `pages/viewer.html` memodifikasi `currentDoc` in-memory tanpa unduhan perantara.
6. **Bilingual i18n Mandat**: Semua teks UI wajib terdaftar di kamus `en` dan `id` pada `js/utils/i18n.js` tanpa emoji.
7. **Anatomi Halaman 6 Bagian**: Seluruh halaman standalone wajib memiliki struktur Header, Hero, Dropzone, Workspace, Action Bar, Result.
8. **Bebas Dialog Bawaan Browser**: Dilarang memanggil `alert()`, `confirm()`, atau `prompt()`; gunakan Toast atau modal kustom.
9. **Verifikasi Hasil Nyata pada Test**: Test harus memverifikasi hasil, bukan keberadaan fungsi.
10. **Integritas Klaim & Uji Keamanan Wajib**: Dilarang menulis klaim fitur di README, test, toast, atau komentar yang belum dibuktikan oleh test; untuk fitur keamanan (enkripsi, redaksi, tanda tangan), wajib ada test yang membuktikan data benar-benar terlindungi.

---

## 1. 🛡️ Prinsip Utama Aplikasi (Core Philosophy & Architectural Guarantees)

1. **100% Client-Side & Offline (Zero Server Transfer)**:
   - Seluruh pemrosesan berkas PDF, Word (DOCX), Excel (XLSX), Gambar, dan OCR dieksekusi langsung di dalam browser pengguna (RAM) menggunakan Web APIs dan library client-side:
     - `pdf-lib.min.js`: Manipulasi tingkat rendah dokumen PDF, pembuatan halaman, form filling, penggabungan, enkripsi, dan mutasi stream.
     - `pdf.min.js` & `pdf.worker.min.js`: Rendering halaman ke HTML5 Canvas, ekstraksi teks, kalkulasi koordinat glyph, dan text layer.
     - `jszip.min.js`: Pemaketan multi-berkas batch processing ke dalam arsip `.zip`.
     - `FileSaver.min.js`: Pengunduhan berkas lokal aman tanpa roundtrip jaringan.
     - `tesseract.min.js` + WASM & SIMD: Mesin OCR LSTM offline berbasis WebAssembly.
     - `Sortable.min.js`: Penataan visual urutan halaman / kartu berkas secara interaktif (drag-and-drop).
   - **Dilarang keras** menambahkan dependensi endpoint backend server eksternal atau layanan cloud pihak ketiga untuk pemrosesan dokumen. Berkas pengguna **tidak boleh sekalipun meninggalkan perangkat komputer pengguna**.
   - Zero Telemetry, Zero Analytics, Zero Remote Tracking.

2. **Manajemen Memori & Siklus Hidup Objek (Memory Lifecycle)**:
   - Bersihkan selalu Object URL sementara menggunakan `URL.revokeObjectURL(url)` setelah unduhan selesai atau pratinjau diganti.
   - Bersihkan instance dokumen PDF.js (`pdfDoc.destroy()`) dan batalkan render task yang tertunda (`renderTask.cancel()`) saat pengguna berganti halaman untuk mencegah kebocoran memori (memory leak).
   - Pada pemrosesan batch besar, lepaskan referensi ArrayBuffer dan ImageData yang sudah tidak digunakan.

3. **Standar Render High-DPI (Retina / 4K Displays)**:
   - Semua elemen canvas pratinjau wajib dikalibrasikan dengan `window.devicePixelRatio` (biasanya 2x atau 3x) untuk memastikan ketajaman visual maksimal tanpa blur, dengan ukuran CSS tetap proporsional.

4. **Desain Kelas Dunia & Estetika SaaS Modern**:
   - Tampilan visual harus terlihat seperti aplikasi SaaS profesional kelas atas (setara Adobe Acrobat Pro / Figma / Apple Web).
   - Jangan pernah menggunakan gaya antarmuka HTML kasar atau tabel polos. Gunakan glassmorphism, rounded card (`border-radius: 14px–24px`), border halus transparan, bayangan bertingkat (*multi-layer elevation*), dan mikro-animasi (*hover transition & spring*).

---

## 2. 🎨 Sistem Tema & Aturan Warna (Design Tokens & Color Palette)

Aplikasi memiliki dua tema bawaan yang tersinkronisasi otomatis dengan preferensi sistem OS pengguna atau dapat dialihkan via tombol toggle di header:
- **Light Theme (Default)**: Putih bersih (`--bg-body: #f8fafc` / `#ffffff`), kartu (`--card-bg: #ffffff`), border (`--border: #e2e8f0`), teks utama (`--text-main: #0f172a`), teks sekunder (`--text-muted: #64748b`).
- **Dark Theme (Dark Slate)**: Dark Slate modern (`--bg-body: #0b0f19` / `#111827`), kartu (`--card-bg: rgba(22, 30, 46, 0.85)`), border (`--border: rgba(255, 255, 255, 0.08)`), teks utama (`--text-main: #f8fafc`), teks sekunder (`--text-muted: #94a3b8`).

### Palet Warna Resmi Seluruh Tool (23 Standalone Pages + Tools)

Setiap tool memiliki warna identitas unik (`--tool-color`) yang diterapkan pada badge hero icon, highlight border, progress bar, dan aksen tombol utama:

| No | Tool Name | File Halaman | `--tool-color` Hex | Kategori Menu | Deskripsi / Badge |
| :-: | :--- | :--- | :--- | :--- | :--- |
| 1 | **PDF Studio** | `pages/viewer.html` | `#9333EA` (Ungu) | Flagship Studio | Workspace lengkap, text edit, anotasi, live canvas |
| 2 | **Merge PDF** | `pages/merge.html` | `#E11D48` (Rose / Merah) | Organize | Gabung banyak dokumen PDF jadi satu |
| 3 | **Split PDF** | `pages/split.html` | `#EA580C` (Oranye) | Organize | Pisah halaman, rentang, atau per n-halaman |
| 4 | **Rotate PDF** | `pages/rotate.html` | `#3B82F6` (Biru Muda) | Organize | Putar orientasi halaman 90°, 180°, 270° |
| 5 | **Remove Pages** | `pages/remove-pages.html`| `#EF4444` (Merah) | Organize | Hapus halaman PDF secara visual |
| 6 | **Reorder Pages** | `pages/reorder.html` | `#8B5CF6` (Ungu Violet) | Organize | Susun ulang urutan halaman drag & drop |
| 7 | **Crop & Trim** | `pages/crop.html` | `#F59E0B` (Amber) | Organize | Pangkas margin interaktif & auto-trim |
| 8 | **Compress PDF** | `pages/compress.html` | `#16A34A` (Hijau) | Optimize & Protect | Optimasi ukuran (3 preset) + Batch ZIP |
| 9 | **Grayscale PDF** | `pages/grayscale.html` | `#64748B` (Slate) | Optimize & Protect | Konversi warna ke abu-abu / pure photocopy B&W |
| 10 | **Flatten PDF** | `pages/flatten.html` | `#6366F1` (Indigo) | Optimize & Protect | Kunci isian formulir & anotasi anti-tamper |
| 11 | **Protect / Unlock** | `pages/protect.html` | `#EF4444` (Merah Gembok)| Optimize & Protect | Enkripsi sandi dokumen & dekripsi |
| 12 | **PDF to Word** | `pages/pdf-to-docx.html`| `#2563EB` (Biru Word) | Convert | Konversi PDF ke berkas editable DOCX |
| 13 | **Word to PDF** | `pages/docx-to-pdf.html`| `#2563EB` (Biru Word) | Convert | Konversi berkas DOCX ke dokumen PDF |
| 14 | **PDF to Excel** | `pages/pdf-to-xlsx.html`| `#15803D` (Hijau Excel) | Convert | Ekstraksi tabel data PDF ke XLSX |
| 15 | **Excel to PDF** | `pages/xlsx-to-pdf.html`| `#15803D` (Hijau Excel) | Convert | Konversi spreadsheet XLSX ke PDF |
| 16 | **PDF to JPG** | `pages/pdf-to-jpg.html` | `#06B6D4` (Cyan) | Convert | Render halaman PDF ke JPG / PNG kualitas tinggi |
| 17 | **JPG to PDF** | `pages/jpg-to-pdf.html` | `#EAB308` (Kuning Emas) | Convert | Konversi gambar (JPG, PNG, WebP) ke PDF |
| 18 | **Watermark PDF** | `pages/watermark.html` | `#EC4899` (Pink) | Edit & Stamp | Stempel teks / cap air kustom + Batch ZIP |
| 19 | **Page Numbering** | `pages/page-number.html`| `#10B981` (Emerald) | Edit & Stamp | Penomoran halaman otomatis, header & footer |
| 20 | **Sign PDF (E-Sign)** | `pages/sign.html` | `#1E3A8A` (Biru Navy) | Edit & Stamp | Tanda tangan digital (draw, type, stamp) |
| 21 | **Fill Forms** | `pages/form-fill.html` | `#0284C7` (Sky Blue) | Edit & Stamp | Pengisi form PDF interaktif |
| 22 | **OCR PDF** | `pages/ocr.html` | `#06B6D4` (Teal/Cyan) | Advanced | Ekstrak teks & buat Searchable PDF offline |
| 23 | **Batch Processing**| `pages/batch.html` | `#0D9488` (Teal) | Advanced | Otomatisasi multi-berkas antrean ke ZIP |

### Command Palette Terpadu (Ctrl + K / Cmd + K)
Seluruh halaman terintegrasi dengan modul `js/components/command-palette.js`. Pengguna dapat menekan `Ctrl + K` (atau `Cmd + K` di macOS) untuk mencari tool apa pun, berpindah halaman secara instan, dan melihat shortcut aksi cepat.

---

## 3. 🚫 Aturan Standarisasi Icon & Larangan Emoji (Icon Rules)

### ❌ ATURAN MUTLAK: JANGAN PERNAH GUNAKAN EMOJI UNICODE DI DALAM UI!
- **DILARANG KERAS** menggunakan emoji teks biasa (seperti `📁`, `📄`, `🗑️`, `🔄`, `✂️`, `🔒`, `✨`, `💡`, `✓`, `➕`, `➖`, `✏️`, `💾`, `✍️`, `🔍`, `🔀`, `🗜️`, `📷`, `🏷️`, `🔢`, `🛡️`, `🎨`, `📦`) pada:
  - Tombol aksi (*action buttons*, toolbar, modal buttons)
  - Dropzone unggah berkas (*file upload area*)
  - Badge hero header halaman (`.tool-hero-icon`)
  - Kartu thumbnail pratinjau halaman / organizer
  - Dropdown navigasi & Mega Menu
  - Dialog pop-up / modal konfirmasi
  - Teks terjemahan bahasa di `js/utils/i18n.js`
  - Pesan notifikasi Toast

### ✅ GUNAKAN INLINE VEKTOR SVG STANDAR:
Semua icon harus berupa elemen `<svg>` vektor murni dengan atribut standar:
```html
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <!-- path data -->
</svg>
```

### Standar Ukuran SVG Sesuai Komponen:
1. **Hero Header Badge (`.tool-hero-icon`)**: `width="34" height="34"`, berada di dalam kotak rounded (`64x64px`, `border-radius: 14px`, warna tema solid dengan box-shadow dinamis).
2. **Dropzone Cloud Icon (`.dropzone-icon`)**: `width="36" height="36"`, warna mengikuti `var(--tool-color)`.
3. **Dropdown Menu, Mega Menu, & Command Palette Items**: `width="18" height="18"` atau `20x20px`.
4. **Tombol Standar / Modal Buttons (`.btn-md`, `.btn-lg`)**: `width="14" height="14"` hingga `16x16px`.
5. **Tombol Mini / Thumbnail Action Card (`.merge-card-btn`, `.thumb-mini-btn`)**: `width="11" height="11"` hingga `13x13px`.
6. **Status Hasil Berhasil (`.result-icon`)**: `width="24" height="24"` atau `28x28px` (Checkmark).

### Perpustakaan SVG Standar Proyek (Standard SVG Library):

Seluruh kode SVG inline standar (Upload Cloud, Rotate, Delete, Plus, Checkmark, Edit, Download, Eye, Lock) telah dipindahkan ke dokumen terpusat:  
👉 **[docs/svg-library.md](docs/svg-library.md)**.  
Gunakan format dan ukuran SVG yang terdokumentasi di sana untuk menjaga konsistensi visual di seluruh komponen aplikasi.

---

## 4. ⚡ PDF Studio Pro (`pages/viewer.html` & `js/editor/`): Arsitektur Mesin Penyuntingan

### Prinsip Utama: "PRESERVE FIRST, NOT REFLOW FIRST"
Ketika menyunting teks dalam dokumen PDF yang sudah ada, **dilarang merusak layout asli dokumen**. Default mode adalah **Fixed Layout Mode**, bukan Auto-Reflow Mode.
Menyunting kata atau baris teks dalam PDF hanya boleh mengubah karakter yang diedit. Aplikasi **TIDAK BOLEH** secara tidak sengaja mengubah:
- Posisi dan koordinat baseline teks
- Ukuran font (*font size*)
- Jarak antar karakter (*character spacing*) & kata (*word spacing*)
- Perataan paragraf (*paragraph alignment*)
- Penataan kolom atau tabel tetangga
- Gambar dan vektor latar belakang

### Model Geometri `PDFTextRun`:
Setiap teks yang diekstrak dan dapat diedit dikemas dalam objek `PDFTextRun`:
```javascript
{
  id: string,
  pageNumber: number,
  originalText: string,
  currentText: string,
  bbox: { x: number, y: number, width: number, height: number },
  transformMatrix: number[],
  baseline: number,
  font: {
    pdfFontName: string,
    normalizedFamily: string,
    postScriptName: string,
    size: number,
    weight: number,
    bold: boolean,
    italic: boolean,
    embedded: boolean
  },
  color: string,
  opacity: number,
  characterSpacing: number,
  wordSpacing: number,
  horizontalScale: number,
  rotation: number
}
```

### 27 Modul Mesin Editor (`js/editor/`):
Struktur internal editor PDF Studio Pro dipecah ke dalam modul-modul modular berikut:

1. **Text Extraction & Layout Detection**:
   - `pdf-text-extractor.js`: Ekstraksi text runs dan glyph coordinates dari PDF.js.
   - `text-block-detector.js`: Mengelompokkan kata menjadi baris (*line*) dan baris menjadi paragraf/blok (*block*).
   - `text-model.js`: Definisi kelas model data `PDFTextRun`, `PDFLine`, `PDFParagraph`, `PDFTextBlock`.
   - `text-edit-engine.js`: Mesin utama overlay penyuntingan teks baris per baris.
   - `text-fit-engine.js`: Kalkulasi skala font dan horizontal scale agar teks pas dalam bounding box asli.
   - `paragraph-engine.js`: Pengelolaan reflow terbatas ketika pengguna secara sengaja melakukan multiline edit.
   - `ocr-layout-engine.js`: Deteksi zona teks hasil OCR untuk pembuatan layer teks tersembunyi.

2. **Font Intelligence & Embedding Subsystem**:
   - `font-normalizer.js`: Parser PostScript Font Name dan pemetaan nama font standar.
   - `font-intelligence.js`: Inferensi bobot (*weight*), gaya (*style*), dan fallback font point-based.
   - `font-resolver.js`: Pemetaan font PDF-Lib (Standard 14 Fonts: Helvetica, Times, Courier, dll.).
   - `font-registry.js`: Registri font lokal dan font sistem yang tersedia.
   - `font-engine.js`: Mesin embedding dan subsetting font TrueType / OpenType ke dalam PDF.

3. **Koordinat, Kanvas & Background Sampling**:
   - `pdf-coordinate-engine.js`: Transformasi dua arah antara sistem koordinat PDF (origin kiri-bawah) dan koordinat Canvas/DOM (origin kiri-atas), zoom, dan rotasi.
   - `background-sampler.js`: Sampling warna latar belakang di sekeliling bounding box teks untuk menambal teks lama secara mulus sebelum menimpa teks baru.

4. **Anotasi, Formulir, Keamanan & Redaction**:
   - `annotation-engine.js`: Penyorot teks (highlight), garis bawah, coret, pensil bebas, dan bentuk geometris (panah, kotak, lingkaran).
   - `comments-engine.js`: Catatan tempel (*sticky notes*) dan thread komentar.
   - `form-engine.js`: Pembuat dan pengisi AcroForm fields (teks, checkbox, radio, dropdown).
   - `redaction-engine.js`: Redaksi permanen berbasis rasterisasi. Halaman bertanda redaksi dirender PDF.js ke canvas (default 200 DPI), diberi persegi hitam, lalu diganti halaman gambar berukuran TAMPILAN (rotasi & CropBox sudah diterapkan, tanpa /Rotate). Setelah itu: form field di halaman tersebut dihapus, semua referensi ke halaman lama (link, bookmark, destinasi) dialihkan ke halaman baru, structure tree (/StructTreeRoot, bisa berisi /ActualText) dihapus, dan SEMUA objek yatim dibuang (`purgeUnreachableObjects`) karena pdf-lib menyimpan objek tak terpakai saat save. Di PDF Studio, redaksi dijalankan sebagai langkah TERAKHIR ekspor (`redactBakedDocument`) agar suntingan pengguna ikut terasterisasi. Tanpa canvas dan tanpa `options.rasterize`, engine melempar error (tidak pernah menghasilkan halaman kosong diam-diam). Halaman tanpa redaksi tetap vektor.
   - `security-engine.js`: Analisis hak akses (*permissions*), enkripsi, dan sanitasi metadata.
   - `signature-inspector.js`: Inspeksi tanda tangan digital (`ByteRange`, `SigFlags`) untuk mencegah kerusakan berkas bertanda tangan.

5. **Manajemen Perintah & Alat Tambahan**:
   - `command-manager.js`: Stack Undo/Redo (`execute`, `undo`, `redo`) untuk seluruh mutasi dokumen.
   - `image-edit-engine.js` & `image-extractor.js`: Ekstraksi, penggantian, pemindahan, dan penghapusan gambar raster tertanam.
   - `accessibility-engine.js`: Tagging PDF/UA dan pembaca urutan baca (*reading order*).
   - `compare-engine.js`: Komparasi visual dan teks antara dua versi dokumen PDF.
   - `page-tools-engine.js`: Pembuat nomor halaman, Bates numbering, header, dan footer dinamis.

### Alur Kerja In-Memory (NO Intermediate Downloads):
1. **Tidak Ada Unduhan Perantara**:
   - Setiap fitur (Watermark, Page Numbering, Compress, Grayscale, Flatten, Crop & Trim, Password, Add Pages) **TIDAK BOLEH** memicu unduhan berkas saat tombol "Apply" diklik di modal PDF Studio.
   - Semua operasi langsung memperbarui memori aktif dokumen (`currentDoc`), merender ulang canvas aktif (`renderCurrentPageView()`), memperbarui thumbnail samping (`buildSidebarThumbnails()`), dan menandai status dokumen menjadi dirty (`currentDoc.dirty = true`).
2. **Satu-Satunya Titik Unduhan**:
   - Berkas akhir diekspor ke komputer pengguna **hanya saat tombol "Save PDF" (`#savePdfBtn`)** di pojok kanan atas toolbar viewer diklik secara eksplisit oleh pengguna.

### Protokol Perlindungan Tanda Tangan Digital (Digital Signatures):
- Memodifikasi, menggabungkan, atau mengompresi PDF yang mengandung Tanda Tangan Digital (*Digital Signature*) akan merusak integritas kriptografis tanda tangan tersebut.
- Modul `signature-inspector.js` mendeteksi keberadaan tanda tangan digital.
- Jika pengguna ingin memproses dokumen tersebut (misal di Merge atau Compress), tampilkan modal peringatan persetujuan sanitasi tanda tangan (`removeDigitalSignatures`) agar output PDF tidak corrupt.

---

## 5. 🌐 Aturan Multi-Bahasa (i18n Localization Rules)

Sistem lokalisasi dikelola terpusat di file [`js/utils/i18n.js`](js/utils/i18n.js).

1. **Selalu Tambahkan di Kedua Bahasa**:
   - Setiap kali membuat label, placeholder, atau pesan teks baru, wajib mendaftarkannya di kamus `en` (English) dan `id` (Bahasa Indonesia).
2. **DILARANG Menyisipkan Emoji dalam Kamus Translasi**:
   - ❌ **SALAH**: `'merge.rotate_all': '🔄 Putar Semua'`
   - ✅ **BENAR**: `'merge.rotate_all': 'Putar Semua'`
   - Tempatkan icon SVG secara terpisah di HTML sebelum atau sesudah tag `<span data-i18n="...">`.
3. **Format Penggunaan di HTML & JavaScript**:
   - Di HTML:
     ```html
     <button type="button" class="btn btn-primary btn-md">
       <svg ...></svg>
       <span data-i18n="tool.merge">Merge PDF</span>
     </button>
     ```
   - Di JavaScript:
     ```javascript
     const label = PDFTools.i18n.t('action.download');
     ```

---

## 6. 📁 Struktur File & Arsitektur Direktori Lengkap

```text
pdf/
├── index.html                   # Halaman Utama (23 Tool Cards, Mega Menu, Quick Modal)
├── PROJECT_RULES.md             # Dokumen ini (Single Source of Truth)
├── AGENTS.md                    # Panduan mandat AI agent
├── README.md                    # Panduan pengguna publik (23 Tools)
├── server.js                    # Local static server (127.0.0.1, path-traversal protected)
├── manifest.json                # Web App Manifest PWA
├── icon.svg                     # Vector App Logo Icon
├── docs/                        # Dokumentasi Proyek
│   ├── PRD.md                   # Product Requirements Document (Kondisi Aktual 23 Tools)
│   ├── svg-library.md           # Pustaka Ikon SVG Standar Terpusat
│   └── archive/                 # Arsip Dokumen Spesifikasi Lama
├── fonts/                       # Font Kaligrafi Offline (OFL-1.1) untuk E-Sign
│   ├── fonts.css                # Definisi lokal @font-face
│   ├── OFL.txt                  # Dokumentasi lisensi SIL Open Font License
│   └── *.ttf                    # File font lokal (Caveat, Dancing Script, dsb.)
├── css/
│   ├── style.css                # Design System Global, Token CSS, Header, Dropzone, Modal, Theme Tokens
│   ├── home.css                 # Hero Beranda, Filter Kategori, Grid Tool Cards
│   └── tool.css                 # Styling spesifik Tool (Tool Hero, Toolbars, Action Bars, Thumbnails)
├── js/
│   ├── app.js                   # Header sinkron, Mega Menu, System Theme listener, Navigation Dropdown
│   ├── components/              # Komponen UI Terstandarisasi (command-palette, dropzone, toast, dsb.)
│   ├── core/                    # Engine Pemrosesan Dokumen Client-Side (merge, compress, ocr, dsb.)
│   ├── editor/                  # 27 Mesin Modular PDF Studio Pro (text-edit, redaction, annotations, dsb.)
│   ├── lib/                     # Vendor Libraries Lokal (PDF-Lib, PDF.js, Tesseract WASM, JSZip)
│   └── utils/                   # Helper download, file-utils, dan kamus i18n
├── pages/                       # 23 Halaman Standalone Tools (viewer, merge, compress, ocr, dsb.)
└── tests/                       # 13 Automated Test Suites (run_all.js, security, quality gates)
```

---

## 7. 🚀 Anatomi Standar Halaman Tool (Standard 6-Part Architecture)

Setiap halaman tool berdiri sendiri (*standalone tool page*) di folder `pages/` wajib mengikuti struktur 6 bagian yang seragam:

```
+-------------------------------------------------------------------+
| 1. Header (Navbar, Logo, Tool Dropdowns, Mega Menu, Theme Toggle) |
+-------------------------------------------------------------------+
| 2. Tool Hero Section (Hero Icon 34x34 SVG Badge, H1 Title, Desc)  |
+-------------------------------------------------------------------+
| 3. Dropzone Area (Standard Cloud SVG 36x36, Drag & Drop Trigger)  |
+-------------------------------------------------------------------+
| 4. Workspace Area (Thumbnails, Options, Sliders, Multi-file Queue)|
+-------------------------------------------------------------------+
| 5. Action Bar (Primary Action Button, Loading Spinner, Progress)  |
+-------------------------------------------------------------------+
| 6. Result Card (SVG Checkmark 24x24, Stats, Download + OpenStudio)|
+-------------------------------------------------------------------+
```

### Rincian Kode 6 Bagian:

1. **Bagian 1: Header Terpadu**:
   - Sertakan `<header class="header">` resmi dengan dropdown menu, tombol 9-dots mega menu, dan script `../js/app.js` agar sinkronisasi tema dan navigasi berjalan otomatis.
2. **Bagian 2: Tool Hero Section**:
   - Memiliki background hero badge solid berukuran `64x64px`, `border-radius: 14px`, inline SVG `34x34px`, dan bayangan bercahaya warna tema:
   ```html
   <section class="tool-hero">
     <div class="tool-hero-icon" style="background: var(--tool-color); box-shadow: 0 8px 24px rgba(...);">
       <!-- Inline SVG 34x34 -->
     </div>
     <h1 data-i18n="tool.namatool">Nama Tool</h1>
     <p data-i18n="tool.namatool.desc">Deskripsi fungsi alat.</p>
   </section>
   ```
3. **Bagian 3: Dropzone Standar**:
   - Gunakan `<div class="dropzone" id="dropzone">` dengan `<div class="dropzone-icon">` memuat SVG Upload Cloud standar 36x36px.
4. **Bagian 4: Workspace & Opsi**:
   - Berisi opsi konfigurasi (preset, slider, color picker) atau thumbnail grid halaman yang tersembunyi hingga berkas diunggah.
5. **Bagian 5: Action Bar**:
   - Terletak di bawah workspace dengan tombol utama `.btn-primary.btn-lg` dan container progress bar `#progressBar`.
6. **Bagian 6: Result Card & Jembatan ke PDF Studio**:
   - Menampilkan status keberhasilan dengan SVG Checkmark 24x24px, statistik dokumen (ukuran lama vs baru, jumlah halaman), dan **Dua Tombol Aksi**:
     - **Tombol Utama**: Unduh hasil langsung (`#downloadBtn`).
     - **Tombol Sekunder**: Buka di PDF Studio (`#openStudioBtn`).
   ```javascript
   // Standar pengiriman berkas ke PDF Studio:
   openStudioBtn.addEventListener('click', () => {
     PDFTools.FileUtils.setPendingFile(processedBlob, outputFilename);
     window.location.href = 'viewer.html';
   });
   ```

---

## 8. ⚠️ Standar Notifikasi, Dialog & Penanganan Kesalahan (Error Handling)

1. **Dilarang Menggunakan Dialog Bawaan Browser**:
   - **JANGAN PERNAH** menggunakan `alert()`, `confirm()`, atau `prompt()` bawaan browser. Dialog browser memblokir thread JavaScript dan merusak tampilan modern aplikasi.
2. **Gunakan Notifikasi Toast Modern (`PDFTools.Toast`)**:
   ```javascript
   PDFTools.Toast.show('Dokumen berhasil digabungkan!', 'success');
   PDFTools.Toast.show('Gagal memproses berkas PDF: File terenkripsi', 'error');
   PDFTools.Toast.show('Tanda tangan digital telah disanitasi', 'warning');
   PDFTools.Toast.show('Memulai konversi...', 'info');
   ```
3. **Gunakan Modal untuk Konfirmasi Aksi Destruktif**:
   - Untuk aksi berbahaya (seperti *"Hapus Semua Halaman"*, *"Sanitasi Tanda Tangan Digital"*), sediakan modal HTML kustom dengan tombol konfirmasi dan batal yang jelas.

---

## 9. 🧪 Pengujian Kualitas Otomatis & Standar Uji Mutlak

### Standar Wajib Pengujian (Mandatory Test Rules):
1. **Verifikasi Hasil Aktual (Bukan Keberadaan Fungsi)**:
   - Test harus memverifikasi hasil, bukan keberadaan fungsi. Setiap assert wajib menguji mutasi buffer biner, struktur objek PDF, teks yang diekstrak, atau data hasil keluaran nyata, bukan sekadar memeriksa apakah suatu fungsi dideklarasikan (`typeof fn === 'function'`).
2. **Larangan Klaim Fitur Tanpa Bukti Test**:
   - Dilarang menulis klaim fitur di README, test, toast, atau komentar yang belum dibuktikan oleh test. Seluruh deskripsi kapabilitas harus faktual dan dapat dipertanggungjawabkan melalui pengujian otomatis.
3. **Uji Keamanan & Proteksi Data Wajib**:
   - Untuk fitur keamanan (enkripsi, redaksi, tanda tangan), wajib ada test yang membuktikan data benar-benar terlindungi.
     - Enkripsi password wajib diuji dengan verifikasi kamus `/Encrypt`, kegagalan akses tanpa password, dan keberhasilan pembukaan dengan password yang benar (`tests/test_pdf_protect.js`).
     - Redaksi permanen wajib diuji dengan mendekode SELURUH objek file dan mencari rahasia dalam bentuk teks biasa DAN heksadesimal (pdf-lib menulis teks sebagai hex), termasuk teks di Form XObject, gambar, /ActualText, dan form field (`tests/test_redaction_rasterize.js`, `tests/test_studio_export_redaction.js`).
     - Keamanan server lokal wajib diuji mengikat ke 127.0.0.1, bebas CORS eksternal, dan kebal path traversal (`tests/test_server_security.js`).
     - Kepatuhan offline wajib diverifikasi dengan audit zero external HTTP/HTTPS URLs (`tests/test_no_external_urls.js`).
4. **Test Keamanan Wajib Membuktikan Dirinya Sensitif (Mutation Check)**:
   - Detektor kebocoran wajib dijalankan dulu pada input YANG BELUM dilindungi dan harus MENEMUKAN rahasia.
   - Setiap mekanisme perlindungan wajib diuji dengan mematikannya secara sengaja di dalam test; test harus mendeteksi kebocoran. Test yang tetap lulus saat perlindungan dimatikan dianggap tidak menguji apa pun.
   - Perbaikan bug wajib disertai test yang terbukti GAGAL pada kode sebelum perbaikan.
5. **Penyelesaian Tugas**:
   - Selesaikan tugas dengan menjalankan `node tests/run_all.js` dan menempel outputnya sebagai bukti bahwa seluruh test suite berhasil dilewati (baris `FINAL SUMMARY` tanpa kegagalan).

---

> **Kesimpulan Akhir:**  
> Kepatuhan mutlak terhadap pedoman ini menjamin seluruh aplikasi **PDF Tools** tetap elegan, berkinerja tinggi, bebas bug visual, aman secara offline, dan mempertahankan reputasi sebagai suite pengolah dokumen PDF offline terbaik.
