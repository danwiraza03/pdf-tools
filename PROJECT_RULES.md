# 📋 PDF Tools — Master Architecture & Project Rules

> **PENTING UNTUK SEMUA AI AGENT & DEVELOPER:**  
> Dokumen ini adalah **Sumber Kebenaran Tunggal (Single Source of Truth)** untuk seluruh arsitektur, standar desain antarmuka, penyeragaman icon, sistem tema warna, modul editor, dan alur pemrosesan dokumen di proyek **PDF Tools**.  
> **Sebelum menambahkan fitur, memodifikasi halaman, atau membuat tool baru, Anda WAJIB membaca dan mematuhi seluruh aturan di bawah ini secara ketat.**

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

#### 1. Upload Cloud (Gunakan pada seluruh Dropzone):
```html
<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
  <path d="M12 12v9"/>
  <path d="m16 16-4-4-4 4"/>
</svg>
```

#### 2. Rotate Clockwise (Putar Searah Jarum Jam):
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
  <polyline points="21 3 21 8 16 8"/>
</svg>
```

#### 3. Rotate Counter-Clockwise / Reset (Putar Berlawanan):
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
  <polyline points="3 3 3 8 8 8"/>
</svg>
```

#### 4. Delete / Trash Can (Hapus):
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <line x1="10" y1="11" x2="10" y2="17"/>
  <line x1="14" y1="11" x2="14" y2="17"/>
</svg>
```

#### 5. Plus / Add (Tambah Berkas / Tambah Halaman):
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg>
```

#### 6. Checkmark (Selesai / Sukses):
```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>
```

#### 7. Edit in PDF Studio / Pen Tool:
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
</svg>
```

#### 8. Download / Simpan:
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>
```

#### 9. Eye / Quick Preview:
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>
```

#### 10. Lock / Protect:
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>
```

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
   - `redaction-engine.js`: True vector/image redaction (menghapus stream teks dan gambar di area redaksi secara permanen, bukan sekadar menggambar kotak hitam di atasnya).
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

Sistem lokalisasi dikelola terpusat di file [`js/utils/i18n.js`](file:///c:/laragon/www/pdf/js/utils/i18n.js).

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
c:\laragon\www\pdf\
├── index.html                   # Halaman Utama (Tool Grid, Mega Menu, Quick Modal, Smart Drag & Drop)
├── PROJECT_RULES.md             # Dokumen ini (Single Source of Truth)
├── AGENTS.md                    # Panduan singkat mandat AI agent
├── README.md                    # Dokumentasi publik & panduan pengguna
├── server.js                    # Zero-dependency local server (Laragon port 80 check / standalone 8080)
├── sw.js                        # Service Worker untuk full offline PWA caching
├── manifest.json                # Web App Manifest PWA
├── icon.svg                     # Vector App Logo Icon
├── css/
│   ├── style.css                # Design System Global, Token CSS, Header, Dropzone, Modal, Theme Tokens
│   ├── home.css                 # Hero Beranda, Filter Kategori, Grid Tool Cards
│   └── tool.css                 # Styling spesifik Tool (Tool Hero, Toolbars, Action Bars, Thumbnails)
├── js/
│   ├── app.js                   # Header sinkron, Mega Menu, System Theme listener, Navigation Dropdown
│   ├── components/              # Komponen UI Terstandarisasi:
│   │   ├── command-palette.js   # Quick Launcher (Ctrl+K) lintas halaman
│   │   ├── dropzone.js          # Standar Drag-and-Drop file uploader
│   │   ├── file-list.js         # Pengelola daftar berkas terpilih
│   │   ├── pdf-preview.js       # Generator thumbnail halaman PDF
│   │   ├── progress.js          # Progress Bar terpadu
│   │   └── toast.js             # Notifikasi Toast modern (success, error, warning, info)
│   ├── core/                    # Engine Pemrosesan Dokumen Client-Side:
│   │   ├── docx-to-pdf.js       # Word (.docx) ke PDF Converter
│   │   ├── jpg-to-pdf.js        # JPG/PNG/WebP ke PDF Converter
│   │   ├── pdf-compress.js      # Vector stream compression engine & Signature stripper
│   │   ├── pdf-crop.js          # In-memory Crop & Auto-trim calculation
│   │   ├── pdf-flatten.js       # Flatten Form & Anotasi ke base vector
│   │   ├── pdf-grayscale.js     # Grayscale & Photocopy B&W Converter
│   │   ├── pdf-merge.js         # PDF Merge & Visual Page Organizer Engine
│   │   ├── pdf-ocr.js           # 100% Offline Tesseract OCR Engine (WASM + SIMD)
│   │   ├── pdf-page-number.js   # Page Numbering & Header/Footer Engine
│   │   ├── pdf-protect.js       # AES Encryption & Password Protection Engine
│   │   ├── pdf-remove.js        # Page Deletion Engine
│   │   ├── pdf-reorder.js       # Page Reordering Engine
│   │   ├── pdf-rotate.js        # Page Rotation Engine
│   │   ├── pdf-split.js         # Split Engine (By Page, Range, Every N)
│   │   ├── pdf-stream-engine.js # Low-level PDF Content Stream Manipulator
│   │   ├── pdf-studio.js        # Bridge Core Studio Engine
│   │   ├── pdf-to-docx.js       # PDF ke Word (.docx) Converter
│   │   ├── pdf-to-jpg.js        # PDF ke Gambar High-DPI Exporter
│   │   ├── pdf-to-xlsx.js       # PDF ke Spreadsheet (.xlsx) Converter
│   │   ├── pdf-watermark.js     # Engine stempel & teks tanda air
│   │   └── xlsx-to-pdf.js       # Excel (.xlsx) ke PDF Converter
│   ├── editor/                  # 27 Mesin Modular PDF Studio Pro:
│   │   ├── text-edit-engine.js  # Fixed Layout line-level text editor
│   │   ├── text-block-detector.js# Word-to-line & line-to-paragraph detector
│   │   ├── pdf-text-extractor.js# PDF.js glyph & text run extractor
│   │   ├── text-model.js        # PDFTextRun, PDFLine, PDFParagraph models
│   │   ├── text-fit-engine.js   # Text auto-scaling & spacing optimizer
│   │   ├── text-extractor.js    # Alternative fast text extractor
│   │   ├── paragraph-engine.js  # Paragraph reflow calculator
│   │   ├── font-normalizer.js   # PostScript Font Name normalizer
│   │   ├── font-intelligence.js # Font fallback inference engine
│   │   ├── font-resolver.js     # PDF-Lib Standard 14 font resolver
│   │   ├── font-registry.js     # Font catalog & system font registry
│   │   ├── font-engine.js       # Font embedding engine
│   │   ├── background-sampler.js# Precision pixel color sampler
│   │   ├── pdf-coordinate-engine.js# Coordinate transform (PDF to DOM/Canvas)
│   │   ├── command-manager.js   # Undo / Redo command stack
│   │   ├── signature-inspector.js# Digital signature detector (ByteRange/SigFlags)
│   │   ├── annotation-engine.js # Highlights, shapes, ink pen
│   │   ├── comments-engine.js   # Sticky notes & comment threads
│   │   ├── form-engine.js       # AcroForm fields builder & filler
│   │   ├── redaction-engine.js  # True vector redaction sanitizer
│   │   ├── security-engine.js   # Permissions & security flags analyzer
│   │   ├── image-edit-engine.js # Image move, replace, resize, delete
│   │   ├── image-extractor.js   # Embedded raster image extractor
│   │   ├── accessibility-engine.js# PDF/UA accessibility & reading order
│   │   ├── compare-engine.js    # Visual & text document comparator
│   │   ├── page-tools-engine.js # Header, footer, and Bates numbering
│   │   └── ocr-layout-engine.js # OCR bounding box layout detector
│   ├── lib/                     # Vendor Libraries (100% Offline Local):
│   │   ├── pdf-lib.min.js       # PDF-Lib Core
│   │   ├── pdf.min.js           # PDF.js Main
│   │   ├── pdf.worker.min.js    # PDF.js Web Worker
│   │   ├── FileSaver.min.js     # Local FileSaver
│   │   ├── Sortable.min.js      # Drag-and-drop Page Sorter
│   │   ├── jszip.min.js         # Zip file packager
│   │   └── tesseract/           # Offline Tesseract OCR WASM & Language Data
│   └── utils/
│       ├── download.js          # Helper download trigger
│       ├── file-utils.js        # Format ukuran berkas & Pending File Bridge
│       └── i18n.js              # Kamus terpusat EN & ID
├── pages/                       # 23 Halaman Berdiri Sendiri (Standalone Tool Pages):
│   ├── viewer.html              # PDF Studio Pro (Flagship In-Memory Live Editor)
│   ├── merge.html               # Penggabung PDF & Visual Organizer
│   ├── split.html               # Pemisah Halaman PDF
│   ├── compress.html            # Kompresi Ukuran Dokumen + Batch ZIP
│   ├── docx-to-pdf.html         # Word to PDF Converter
│   ├── xlsx-to-pdf.html         # Excel to PDF Converter
│   ├── pdf-to-docx.html         # PDF to Word Converter
│   ├── pdf-to-xlsx.html         # PDF to Excel Converter
│   ├── jpg-to-pdf.html          # Gambar ke PDF Converter
│   ├── pdf-to-jpg.html          # PDF ke Gambar Exporter
│   ├── rotate.html              # Rotasi Halaman PDF
│   ├── crop.html                # Pangkas Halaman & Auto-Trim Margins
│   ├── watermark.html           # Stempel & Tanda Air
│   ├── protect.html             # Enkripsi Sandi & Dekripsi
│   ├── flatten.html             # Kunci Form & Anotasi Anti-Tamper
│   ├── grayscale.html           # PDF Skala Abu-Abu & Photocopy B&W
│   ├── page-number.html         # Penomoran Halaman, Header & Footer
│   ├── ocr.html                 # 100% Offline Searchable PDF OCR
│   ├── sign.html                # Tanda Tangan Digital & Kaligrafi
│   ├── form-fill.html           # Pengisi Formulir PDF
│   ├── reorder.html             # Pengatur Urutan Halaman
│   ├── remove-pages.html        # Penghapus Halaman PDF
│   └── batch.html               # Pemrosesan Massal (Batch Queue ke ZIP)
└── tests/                       # Automated Quality Gates & Syntax Tests:
    ├── validate_repo_syntax.js  # Validasi sintaks seluruh file JavaScript
    ├── check_icon_consistency.js# Audit konsistensi SVG lintas menu & hero
    └── audit_all_tools.js       # E2E functional test seluruh 17+ tools
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

## 9. 🧪 Pengujian Kualitas Otomatis (Automated Quality Gates & Testing)

Sebelum menyatakan tugas coding selesai, setiap developer atau AI assistant **WAJIB menjalankan 3 pengujian otomatis berikut** melalui command line Node.js:

1. **Validasi Sintaks JavaScript Seluruh Repositori**:
   ```bash
   node tests/validate_repo_syntax.js
   ```
   *Harus menghasilkan 0 syntax error di seluruh 68+ berkas JS.*

2. **Audit Konsistensi Icon Lintas Menu & Halaman**:
   ```bash
   node tests/check_icon_consistency.js
   ```
   *Harus menghasilkan 0 mismatch icon antara index dropdown, mega menu, grid beranda, navbar app.js, dan hero header halaman.*

3. **Uji Fungsionalitas End-to-End Tools**:
   ```bash
   node tests/audit_all_tools.js
   ```
   *Seluruh 17+ tools harus bertatus PASSED.*

---

> **Kesimpulan Akhir:**  
> Kepatuhan mutlak terhadap pedoman ini menjamin seluruh aplikasi **PDF Tools** tetap elegan, berkinerja tinggi, bebas bug visual, aman secara offline, dan mempertahankan reputasi sebagai suite pengolah dokumen PDF offline terbaik.
