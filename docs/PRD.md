# 📄 Product Requirements Document (PRD) — PDF Tools Suite

**Nama Produk:** PDF Tools (100% Client-Side Offline PDF Suite)  
**Status:** Production-Ready / Active  
**Versi:** 1.0.0  
**Target Platform:** Web Browser Modern (Chrome, Edge, Firefox, Safari) & Desktop Local  
**Arsitektur:** 100% Client-Side Offline, Zero Server Transfer, Pure Vanilla JS/CSS/HTML  

---

## 1. Visi & Prinsip Utama Produk

PDF Tools adalah rangkaian lengkap alat pengolah dokumen PDF berstandar profesional yang berjalan **100% di peramban (browser) lokal pengguna tanpa mengirim data ke server atau cloud pihak ketiga**.

### Prinsip Fondasi:
1. **Zero-Server Client-Side Guarantee**: Dokumen pengguna tidak pernah keluar dari memori lokal (RAM). Semua proses manipulasi PDF, OCR, konversi, rendering, dan kompresi dieksekusi secara lokal menggunakan WebAssembly dan Web APIs.
2. **Zero External URLs**: Tidak ada dependensi font eksternal (Google Fonts), CDN eksternal, atau layanan analitik/telemetri yang dihubungi saat aplikasi berjalan.
3. **No Intermediate Downloads (PDF Studio)**: Dalam workspace PDF Studio (`pages/viewer.html`), seluruh operasi dokumen diterapkan langsung ke memori dokumen (`currentDoc`) secara in-memory. Unduhan hanya dipicu saat pengguna secara eksplisit menekan tombol "Save PDF".
4. **Bilingual Support (ID & EN)**: Seluruh antarmuka mendukung Bahasa Indonesia dan Bahasa Inggris secara penuh melalui kamus lokal di `js/utils/i18n.js`.
5. **Strict Icon Standard (Zero Emojis)**: Seluruh ikon tombol, header, status, dan dropzone menggunakan inline vector SVG monokrom/tema (`viewBox="0 0 24 24"`), tanpa emoji Unicode mentah.

---

## 2. Arsitektur Teknis

### Library & Engine Lokal (Offline di `js/lib/`):
- **PDF-Lib (`pdf-lib.min.js`)**: Pembuatan PDF, penyuntingan stream biner, form filling, merge, split, enkripsi, dan pembubuhan anotasi.
- **PDF.js (`pdf.min.js`, `pdf.worker.min.js`)**: Rendering halaman PDF ke HTML5 Canvas, kalkulasi teks & koordinat glif, ekstraksi teks, dan penampil visual.
- **Tesseract.js WASM (`tesseract/`)**: Mesin OCR offline berbasis WebAssembly dengan model bahasa `ind.traineddata` dan `eng.traineddata`.
- **JSZip (`jszip.min.js`)**: Pemaketan hasil pemrosesan berkas massal ke dalam arsip `.zip`.
- **FileSaver (`FileSaver.min.js`)**: Penanganan unduhan berkas langsung ke filesystem lokal pengguna.
- **SortableJS (`Sortable.min.js`)**: Interaksi drag-and-drop untuk pengurutan halaman visual.
- **Local Fonts (`fonts/`)**: Font kaligrafi lokal bertanda tangan (Caveat, Dancing Script, Great Vibes, Pacifico, Sacramento) berlisensi SIL Open Font License 1.1.

### Server Pendukung Pengembangan (`scripts/dev-server.js`):
- Node.js HTTP server lokal tanpa dependensi eksternal.
- Mengikat secara ketat hanya ke `127.0.0.1` (`HOST = '127.0.0.1'`).
- Bebas dari header `Access-Control-Allow-Origin: *` yang tidak diperlukan.
- Dilengkapi proteksi path traversal ketat untuk mencegah akses berkas di luar direktori proyek.

---

## 3. Daftar Aktual 23 Tools & Spesifikasi Fitur

Berikut adalah 23 tool mandiri yang tersedia secara aktual di direktori `pages/` dan terdaftar di halaman beranda `index.html`:

| No | Tool Name | File Halaman | File Core Engine | Kategori | Ringkasan Fungsionalitas |
|:--:|:---|:---|:---|:---|:---|
| 1 | **PDF Studio** | `pages/viewer.html` | `js/editor/*`, `js/core/pdf-studio.js` | Flagship Editor | Workspace terpadu: view, fixed layout text editing, AcroForm filler, pen/shapes annotation, e-sign, high-DPI redaction (anti-leak), and inline OCR. |
| 2 | **Merge PDF** | `pages/merge.html` | `js/core/pdf-merge.js` | Organize | Menggabungkan banyak dokumen PDF menjadi satu dengan visual page organizer, thumbnail reorder, rotasi per halaman, dan sanitasi tanda tangan digital. |
| 3 | **Split PDF** | `pages/split.html` | `js/core/pdf-split.js` | Organize | Memisahkan dokumen PDF berdasarkan halaman tunggal, rentang halaman kustom (misal: `1-3, 5`), atau per pecahan N halaman. |
| 4 | **Rotate PDF** | `pages/rotate.html` | `js/core/pdf-rotate.js` | Organize | Memutar orientasi halaman (90°, 180°, 270°) searah atau berlawanan jarum jam per halaman atau seluruh dokumen sekaligus. |
| 5 | **Remove Pages** | `pages/remove-pages.html` | `js/core/pdf-remove.js` | Organize | Menghapus halaman-halaman yang tidak diinginkan secara visual melalui thumbnail grid selector. |
| 6 | **Reorder Pages** | `pages/reorder.html` | `js/core/pdf-reorder.js` | Organize | Mengatur ulang urutan lembar halaman PDF menggunakan antarmuka interaktif drag-and-drop. |
| 7 | **Crop & Trim PDF** | `pages/crop.html` | `js/core/pdf-crop.js` | Organize | Memotong margin halaman dengan 8 titik handle visual dan tombol deteksi batas konten otomatis (*Auto-Trim Whitespace*). |
| 8 | **Compress PDF** | `pages/compress.html` | `js/core/pdf-compress.js` | Optimize | Mengurangi ukuran file dengan 3 preset (Extreme, Recommended, Less), optimasi stream vektor, kompresi gambar, dan antrean batch ke ZIP. |
| 9 | **PDF to Grayscale** | `pages/grayscale.html` | `js/core/pdf-grayscale.js` | Optimize | Mengubah dokumen warna menjadi skala abu-abu halus (*Smooth Grayscale*) atau B&W fotokopi pekat dengan interactive before/after split slider. |
| 10 | **Flatten PDF** | `pages/flatten.html` | `js/core/pdf-flatten.js` | Security | Mengunci formulir interaktif, anotasi, dan tanda tangan menjadi lapisan dasar permanen (vektor dasar atau gambar high-DPI). |
| 11 | **Protect / Unlock PDF** | `pages/protect.html` | `js/core/pdf-protect.js` | Security | Enkripsi sandi dokumen dengan algoritma enkripsi PDF standar serta dekripsi dokumen PDF yang terkunci sandi. |
| 12 | **PDF to Word (DOCX)** | `pages/pdf-to-docx.html` | `js/core/pdf-to-docx.js` | Convert | Mengekstrak teks, paragraf, dan struktur dokumen ke dalam format Microsoft Word `.docx` berbasis OOXML ZIP. |
| 13 | **Word to PDF (DOCX)** | `pages/docx-to-pdf.html` | `js/core/docx-to-pdf.js` | Convert | Mengurai berkas Word `.docx` client-side dan merender teks, heading, serta tabel menjadi dokumen PDF vektor. |
| 14 | **PDF to Excel (XLSX)** | `pages/pdf-to-xlsx.html` | `js/core/pdf-to-xlsx.js` | Convert | Mendeteksi penjajaran baris dan kolom teks tabular dari dokumen PDF menjadi spreadsheet Microsoft Excel `.xlsx`. |
| 15 | **Excel to PDF (XLSX)** | `pages/xlsx-to-pdf.html` | `js/core/xlsx-to-pdf.js` | Convert | Membaca berkas spreadsheet `.xlsx` lokal dan merender tabel berformat ke halaman PDF. |
| 16 | **PDF to JPG** | `pages/pdf-to-jpg.html` | `js/core/pdf-to-jpg.js` | Convert | Merender setiap halaman PDF menjadi gambar resolusi tinggi (JPG/PNG) satuan atau sekaligus dalam satu file ZIP. |
| 17 | **JPG to PDF** | `pages/jpg-to-pdf.html` | `js/core/jpg-to-pdf.js` | Convert | Mengonversi gambar raster (JPG, PNG, WebP) ke dokumen PDF dengan opsi ukuran lembar (A4, Letter, Fit), orientasi, dan margin. |
| 18 | **Add Watermark** | `pages/watermark.html` | `js/core/pdf-watermark.js` | Edit | Membubuhkan stempel teks atau tanda air gambar dengan kontrol rotasi, transparansi/opasitas, ukuran font, dan posisi layer. |
| 19 | **Page Numbers** | `pages/page-number.html` | `js/core/pdf-page-number.js` | Edit | Menambahkan penomoran halaman otomatis, header, dan footer dinamis dengan format kustom (`Halaman {n} dari {total}`). |
| 20 | **Sign PDF (E-Sign)** | `pages/sign.html` | `js/core/pdf-sign.js` (inline) | Security | Menambahkan tanda tangan digital: menggambar bebas (*draw*), mengetik dengan font kaligrafi lokal (*type*), atau mengunggah gambar stempel (*upload*). |
| 21 | **Fill PDF Forms** | `pages/form-fill.html` | `js/editor/form-engine.js` | Edit | Mengisi form field interaktif AcroForm (text field, checkbox, radio button, dropdown) dengan fitur ekspor data dan simpan PDF. |
| 22 | **OCR PDF (berkas diproses di perangkat Anda, tidak diunggah)**| `pages/ocr.html` | `js/core/pdf-ocr.js` | Optimize | Mengekstrak teks dari pindaian/gambar menggunakan Tesseract WASM offline untuk menghasilkan Searchable PDF atau teks murni (.txt). |
| 23 | **Batch Processing** | `pages/batch.html` | `js/core/pdf-batch.js` (inline) | Workflow | Mengotomatisasi pemrosesan banyak berkas PDF sekaligus (watermark, compress, rotate, number) dan mengunduh seluruh hasil dalam 1 file ZIP. |

---

## 4. Standar Desain & Antarmuka Pengguna

1. **Struktur Halaman 6 Bagian**:
   - Bagian 1: Header Terpadu (Navigation, Dropdowns, Mega Menu 9-dots, Theme Toggle).
   - Bagian 2: Tool Hero Section (Hero Icon SVG Badge berukuran 34x34px, judul H1, deskripsi).
   - Bagian 3: Dropzone Area (Standard Upload Cloud SVG 36x36px dengan event drag-and-drop).
   - Bagian 4: Workspace Area (Thumbnail visual, opsi kontrol, slider, selector).
   - Bagian 5: Action Bar (Tombol primer aksen warna tema, progress bar).
   - Bagian 6: Result Card (SVG Checkmark 24x24px, metrik statistik, tombol Download, dan jembatan *"Open in PDF Studio"*).

2. **Sistem Desain & Tema Ganda**:
   - **Light Theme**: `--bg-body: #ffffff` / `#f8fafc`, kartu putih bersih dengan batas halus.
   - **Dark Theme (Slate Dark)**: `--bg-body: #0b0f19` / `#111827`, kartu slate modern semi-transparan.
   - Setiap tool memiliki token warna `--tool-color` yang konsisten di seluruh menu, hero badge, dan progress bar.

---

## 5. Kepatuhan Pengujian & Mutu (Quality Assurance)

Semua fungsionalitas diuji melalui suite pengujian otomatis (`node tests/run_all.js`) yang mencakup 13 test suite:
1. `validate_repo_syntax.js`: Validasi sintaks seluruh berkas JavaScript tanpa error.
2. `validate_html_scripts.js`: Validasi sintaks inline script pada seluruh berkas HTML.
3. `validate_all_scripts.js`: Validasi sintaks script core.
4. `validate_compress_syntax.js`: Validasi script kompresi.
5. `check_icon_consistency.js`: Audit konsistensi SVG lintas menu dropdown, mega menu, dan hero badge.
6. `check_palette_icons.js`: Audit paritas ikon pada Command Palette (Ctrl+K).
7. `check_ocr_bundle.js`: Verifikasi integritas bundle OCR offline.
8. `audit_all_tools.js`: Audit end-to-end fungsional seluruh modul alat.
9. `test_pdf_protect.js`: Verifikasi fungsional enkripsi password PDF dan dekripsi.
10. `test_redaction_rasterize.js`: Verifikasi pemusnahan data rahasia pada redaksi permanen (anti-leak test).
11. `check_ui_rules.js`: Audit bebas emoji kasar dan bebas dialog bawaan browser (`alert`/`confirm`).
12. `test_server_security.js`: Audit keamanan host `127.0.0.1`, pencegahan path traversal, dan verifikasi ketiadaan CORS `*`.
13. `test_no_external_urls.js`: Audit kepatuhan 100% offline (zero external HTTP/HTTPS URLs).

### Aturan Uji Mutlak:
- **Verifikasi Hasil Aktual**: Pengujian wajib memeriksa hasil keluaran dokumen/buffer/stream aktual, bukan hanya memeriksa ada atau tidaknya deklarasi fungsi.
- **Larangan Klaim Tanpa Pembuktian Uji**: Dilarang mencantumkan klaim fitur di README, test, toast, atau komentar yang belum dibuktikan secara otomatis oleh test harness.
- **Validasi Keamanan Data**: Untuk fitur sensitif (enkripsi sandi, redaksi permanen, sanitasi tanda tangan), wajib ada test yang membuktikan data rahasia benar-benar terenkripsi atau terhapus total tanpa kebocoran stream.

---

## 6. Masalah yang Diketahui (Known Issues)

- **Unlock PDF**: Unlock pada PDF terenkripsi buatan alat lain tidak membawa Title dan Author.

