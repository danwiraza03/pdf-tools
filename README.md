# ⚡ PDF Tools — 100% Offline Client-Side PDF Suite

[![Tests](https://github.com/danwiraza03/pdf-tools/actions/workflows/test.yml/badge.svg?branch=master)](https://github.com/danwiraza03/pdf-tools/actions/workflows/test.yml)

**Versi 1.0.0** — lihat [CHANGELOG.md](CHANGELOG.md) untuk daftar perubahan.

Aplikasi pengolah dokumen PDF serbaguna yang berjalan **100% di browser lokal Anda tanpa memerlukan koneksi internet ataupun server web**. Semua proses penggabungan, pemotongan, kompresi, OCR, penandatanganan, dan pengeditan PDF dieksekusi secara instan di komputer Anda.

---

## 🚀 Cara Menjalankan Aplikasi

Cukup **klik dua kali (*double-click*) file `index.html`** pada File Explorer di Windows / Mac / Linux untuk langsung membukanya di browser favorit Anda (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, atau Safari).

> [!NOTE]
> Aplikasi ini adalah **100% Client-Side Standalone**. Anda **tidak membutuhkan web server** (seperti Laragon, Apache, Node.js, atau Nginx). Seluruh berkas PDF yang Anda proses **tidak pernah diunggah ke internet**, menjamin keamanan dan privasi data 100%.

---

## 🛠️ Daftar 23 Alat & Fitur Lengkap

| No | Tool / Fitur | File Halaman | Deskripsi Utama |
|:---:|---|---|---|
| 1 | **PDF Studio (Editor Lengkap)** | [pages/viewer.html](pages/viewer.html) | Workspace komprehensif: View, Fixed Layout Text Edit, Anotasi, Fill & Sign, Stamp, Redaction permanen, dan OCR inline. |
| 2 | **Merge PDF** | [pages/merge.html](pages/merge.html) | Gabungkan banyak berkas PDF menjadi satu dengan Visual Page Organizer, reorder halaman, & opsi sanitasi tanda tangan. |
| 3 | **Split PDF** | [pages/split.html](pages/split.html) | Pisahkan PDF per halaman, berdasarkan rentang (*range*), atau setiap *N* halaman. |
| 4 | **Compress PDF** | [pages/compress.html](pages/compress.html) | Kompresi ukuran dokumen (3 preset: Extreme, Recommended, Less) + optimasi stream vektor + antrean batch ke ZIP. |
| 5 | **PDF to Word (DOCX)** | [pages/pdf-to-docx.html](pages/pdf-to-docx.html) | Ekstraksi teks dan tata letak paragraf PDF ke dalam dokumen Microsoft Word (.docx) berbasis XML standar. |
| 6 | **Word to PDF (DOCX)** | [pages/docx-to-pdf.html](pages/docx-to-pdf.html) | Konversi dokumen Microsoft Word (.docx) ke format PDF berkualitas tinggi secara offline. |
| 7 | **PDF to Excel (XLSX)** | [pages/pdf-to-xlsx.html](pages/pdf-to-xlsx.html) | Ekstraksi tabel data dan teks berformat kolom dari PDF menjadi lembar kerja spreadsheet Excel (.xlsx). |
| 8 | **Excel to PDF (XLSX)** | [pages/xlsx-to-pdf.html](pages/xlsx-to-pdf.html) | Konversi lembar kerja Excel (.xlsx) menjadi dokumen tabel PDF secara offline. |
| 9 | **PDF to JPG** | [pages/pdf-to-jpg.html](pages/pdf-to-jpg.html) | Ekstrak halaman PDF menjadi gambar resolusi tinggi (JPG/PNG) satuan atau sekaligus dalam arsip ZIP. |
| 10 | **JPG to PDF** | [pages/jpg-to-pdf.html](pages/jpg-to-pdf.html) | Konversi gambar (JPG, PNG, WebP) ke PDF dengan opsi ukuran kertas (A4, Letter, Fit), orientasi, & margin. |
| 11 | **Rotate PDF** | [pages/rotate.html](pages/rotate.html) | Putar orientasi halaman PDF (90°, 180°, 270°) per halaman atau seluruh dokumen sekaligus. |
| 12 | **Remove Pages** | [pages/remove-pages.html](pages/remove-pages.html) | Hapus halaman tertentu secara visual dengan memilih thumbnail halaman yang ingin dibuang. |
| 13 | **Reorder Pages** | [pages/reorder.html](pages/reorder.html) | Susun ulang urutan halaman PDF dengan mudah menggunakan antarmuka *drag & drop*. |
| 14 | **Crop & Trim Margins** | [pages/crop.html](pages/crop.html) | Potong margin putih berlebih dengan 8 handle visual & tombol cerdas *Auto-Trim Whitespace*. |
| 15 | **Watermark PDF** | [pages/watermark.html](pages/watermark.html) | Tambahkan cap air teks/stempel dengan kustomisasi sudut rotasi, opasitas, posisi layer, & antrean batch ke ZIP. |
| 16 | **Page Numbers** | [pages/page-number.html](pages/page-number.html) | Tambahkan penomoran halaman otomatis, header, & footer dengan format kustom + antrean batch ke ZIP. |
| 17 | **Protect & Unlock PDF** | [pages/protect.html](pages/protect.html) | Enkripsi sandi dokumen dengan algoritma keamanan standar PDF atau buka kunci sandi dokumen. |
| 18 | **Sign PDF (E-Sign)** | [pages/sign.html](pages/sign.html) | Tanda tangan elektronik offline: gambar tangan (*draw*), ketik dengan font kaligrafi lokal (*type*), atau unggah stempel (*upload*). |
| 19 | **Fill PDF Forms** | [pages/form-fill.html](pages/form-fill.html) | Isi formulir PDF interaktif AcroForm (teks, checkbox, radio button, dropdown) dengan ekspor data & simpan dokumen. |
| 20 | **OCR PDF (100% Offline)** | [pages/ocr.html](pages/ocr.html) | Ekstrak teks (Bahasa Indonesia & English) & buat Searchable PDF tanpa internet menggunakan Tesseract WASM. |
| 21 | **PDF to Grayscale** | [pages/grayscale.html](pages/grayscale.html) | Ubah dokumen berwarna ke skala abu-abu / fotokopi B&W dengan slider perbandingan interaktif *Before/After*. |
| 22 | **Flatten PDF** | [pages/flatten.html](pages/flatten.html) | Kunci isian formulir, tanda tangan, dan stempel menjadi lapisan permanen anti-edit (*read-only*). |
| 23 | **Batch Processing** | [pages/batch.html](pages/batch.html) | Memproses puluhan berkas PDF sekaligus secara otomatis (watermark, compress, rotate, number) ke dalam satu file ZIP. |

---

## 📖 Panduan Penggunaan Lengkap

### 1. Mengedit Dokumen di PDF Studio (`pages/viewer.html`)
1. Buka `pages/viewer.html` atau klik tombol **PDF Studio** pada halaman utama.
2. Drag & drop berkas PDF Anda ke area kerja.
3. **Fitur Pengeditan**:
   - **Teks**: Tambah teks baru di mana saja, atau sunting teks yang ada dengan Fixed Layout Engine.
   - **Fill & Sign (Tanda Tangan & Formulir)**: Gunakan toolbar sekunder untuk meletakkan centang, silang, titik, lingkaran, garis, atau tanggal otomatis.
   - **Tanda Tangan Kaligrafi**: Pilih opsi *Draw* (gambar tangan/touchscreen), *Type* (ketik nama dengan font kaligrafi lokal), atau *Upload* (unggah gambar tanda tangan transparan).
   - **OCR Inline**: Ekstrak teks langsung pada halaman yang sedang dibuka untuk membuat searchable text layer.
   - **Redaksi Permanen**: Tutup teks/area sensitif dengan blok hitam permanen berbasis rasterisasi resolusi tinggi tanpa kebocoran data.
4. Klik **Save PDF** di toolbar kanan atas untuk mengunduh dokumen hasil suntingan.

### 2. Menggabungkan PDF (`pages/merge.html`)
1. Buka `pages/merge.html` dan tarik beberapa berkas PDF sekaligus ke dalam dropzone.
2. Setiap berkas akan otomatis memiliki thumbnail halaman dengan kode warna tersendiri.
3. Anda dapat menggeser (*drag*) halaman untuk mengatur urutan sesuai kebutuhan, memutar halaman perorangan, atau menghapus halaman tertentu.
4. Terdapat tombol **Clear All Pages** untuk mereset seluruh halaman dengan sekali klik.
5. Klik **Merge PDF** untuk mengunduh dokumen gabungan.

### 3. Mengompres Ukuran Dokumen (`pages/compress.html`)
1. Buka `pages/compress.html` dan masukkan 1 atau banyak berkas PDF.
2. Pilih tingkat kompresi:
   - **Extreme Compression**: Ukuran terkecil untuk portal berkuota ketat.
   - **Recommended Compression**: Keseimbangan optimal antara ketajaman teks/gambar dan ukuran file.
   - **Less Compression**: Kualitas grafis tertinggi dengan kompresi ringan.
3. Klik **Compress PDF**. Jika memasukkan banyak file, hasil kompresi otomatis dibundel ke berkas `.zip`.

### 4. Mengunci Formulir & Tanda Tangan (`pages/flatten.html`)
1. Buka `pages/flatten.html` dan pilih berkas PDF yang telah diisi formulir atau dibubuhi tanda tangan.
2. Pilih metode *Flattening*:
   - **Vector Flatten (Rekomendasi)**: Mengunci isian formulir dan stempel menjadi bagian dari vektor dasar PDF. Teks tetap tajam dan ukuran berkas kecil.
   - **Raster Image (Anti-Tamper Maksimal)**: Merender setiap halaman menjadi gambar beresolusi tinggi sehingga teks tidak dapat diinspeksi oleh pihak ketiga.
3. Klik **Flatten & Download PDF**.

### 5. Memotong Margin Halaman (`pages/crop.html`)
1. Buka `pages/crop.html` dan masukkan berkas PDF.
2. Lembar halaman tampil penuh pada area kerja.
3. Geser kotak pemotong dengan 8 titik handle di sudut dan sisi halaman, atau klik tombol **Auto-Trim Whitespace** untuk mendeteksi batas konten secara otomatis.
4. Pilih cakupan pemotongan (*All Pages* atau *Current Page Only*).
5. Klik **Crop & Download PDF**.

### 6. Mengubah PDF ke Grayscale / Hitam Putih (`pages/grayscale.html`)
1. Buka `pages/grayscale.html` dan masukkan berkas PDF.
2. Layar akan menampilkan pratinjau interaktif **Before / After Split Slider** untuk melihat perbedaan warna asli vs hasil grayscale.
3. Pilih mode:
   - **Smooth Grayscale**: Mempertahankan gradasi foto dan shading warna abu-abu yang halus.
   - **Photocopy / Pure B&W**: Mengubah teks menjadi hitam pekat dan latar belakang menjadi putih 100% (sangat hemat tinta printer).
4. Klik **Convert & Download PDF**.

### 7. OCR PDF Offline (`pages/ocr.html`)
1. Buka `pages/ocr.html` dan pilih berkas PDF pindaian (*scanned PDF*) atau gambar dokumen.
2. Pilih bahasa pengenalan teks: *Bahasa Indonesia (ID)*, *English (EN)*, atau keduanya.
3. Pilih format output:
   - **Searchable PDF**: Dokumen PDF dengan lapisan teks tersembunyi yang bisa disorot, dicari (Ctrl+F), dan disalin (*copy-paste*).
   - **Plain Text (.TXT)**: Mengekstrak teks murni ke file teks.
4. Klik **Start OCR Process**.

---

## ⌨️ Shortcut Keyboard PDF Studio

| Shortcut | Aksi |
|---|---|
| `Ctrl + O` | Buka berkas PDF baru |
| `Ctrl + S` | Simpan / Ekspor dokumen |
| `Ctrl + P` | Cetak dokumen (*Print*) |
| `Ctrl + F` | Cari teks dalam dokumen (*Find & Highlight*) |
| `Ctrl + Z` | Batalkan perubahan (*Undo*) |
| `Ctrl + Y` | Ulangi perubahan (*Redo*) |
| `Ctrl + +` / `Ctrl + -` | Perbesar (*Zoom In*) / Perkecil (*Zoom Out*) |
| `Ctrl + D` | Toggle Tema (*Dark Mode* / *Light Mode*) |

---

## 📁 Struktur Direktori Proyek

```text
pdf/
├── index.html                  # Halaman Beranda Utama (Akses seluruh 23 tools)
├── pages/                      # Seluruh 23 Halaman Standalone Tools
│   ├── viewer.html             # PDF Studio Pro (View, Edit, Fill & Sign, OCR)
│   ├── merge.html              # Merge PDF
│   ├── split.html              # Split PDF
│   ├── compress.html           # Compress PDF & Batch Queue
│   ├── pdf-to-docx.html        # PDF to Word (DOCX)
│   ├── docx-to-pdf.html        # Word to PDF
│   ├── pdf-to-xlsx.html        # PDF to Excel (XLSX)
│   ├── xlsx-to-pdf.html        # Excel to PDF
│   ├── pdf-to-jpg.html         # PDF to JPG
│   ├── jpg-to-pdf.html         # JPG to PDF
│   ├── rotate.html             # Rotate PDF
│   ├── remove-pages.html       # Remove Pages
│   ├── reorder.html            # Reorder Pages
│   ├── crop.html               # Crop & Trim Margins
│   ├── watermark.html          # Watermark PDF & Batch Queue
│   ├── page-number.html        # Page Numbers & Batch Queue
│   ├── protect.html            # Protect & Unlock PDF
│   ├── sign.html               # Sign PDF (E-Sign)
│   ├── form-fill.html          # Fill PDF Forms
│   ├── ocr.html                # OCR PDF Offline
│   ├── grayscale.html          # PDF to Grayscale & B/W
│   ├── flatten.html            # Flatten PDF
│   └── batch.html              # Batch PDF Processing ke ZIP
├── fonts/                      # Font Kaligrafi Lokal (OFL-1.1) untuk E-Sign
│   ├── fonts.css               # Definisi lokal @font-face
│   ├── OFL.txt                 # Dokumentasi lisensi SIL Open Font License
│   └── *.ttf                   # File font lokal (Caveat, Dancing Script, dsb.)
├── css/                        # Desain Sistem & Tema (style.css, home.css, tool.css)
├── js/
│   ├── app.js                  # Inisialisasi tema, header navigasi & mega menu
│   ├── lib/                    # Vendor lokal offline (PDF-Lib, PDF.js, Tesseract WASM, JSZip, FileSaver)
│   ├── core/                   # Engine algoritma PDF (merge, compress, crop, flatten, grayscale, ocr)
│   ├── editor/                 # 27 modul penyuntingan PDF Studio Pro (text, coordinate, font, redaction)
│   ├── components/             # Reusable UI (command-palette, dropzone, toast, progress, file-list)
│   └── utils/                  # Helper download, format ukuran, file parser, i18n
├── docs/                       # Dokumentasi Resmi Proyek
│   ├── PRD.md                  # Product Requirements Document (Kondisi Aktual 23 Tools)
│   ├── svg-library.md          # Pustaka Ikon SVG Standar Terpusat
│   └── archive/                # Arsip Dokumen Spesifikasi Lama
├── tests/                      # Automated Quality Gates & Security Tests (13 test suites)
│   └── run_all.js              # Runner utama pengujian otomatis (`node tests/run_all.js`)
├── server.js                   # Local static server (127.0.0.1, proteksi path traversal)
├── LICENSE                     # Lisensi Perangkat Lunak MIT
├── THIRD_PARTY_NOTICES.md      # Pemberitahuan Lisensi Pihak Ketiga & Font
├── PROJECT_RULES.md            # Standar Arsitektur & Kepatuhan Proyek
├── AGENTS.md                   # Instruksi Wajib AI Coding Assistant
└── README.md                   # Dokumentasi Resmi Proyek
```

---

## 🧪 Pengujian Otomatis (Automated Test Suite)

Untuk memvalidasi bahwa seluruh 23 modul, kepatuhan offline, dan keamanan server berjalan tanpa error, jalankan:

```bash
node tests/run_all.js
```

Rangkaian tes ini mencakup 13 suite pengujian otomatis: validasi sintaks JavaScript, konsistensi SVG, integritas model OCR offline, verifikasi fungsionalitas end-to-end, keamanan enkripsi PDF, pemusnahan kebocoran data pada redaksi permanen, keamanan host server `127.0.0.1`, pencegahan path traversal, dan kepatuhan zero external HTTP(S) URLs.

### Lingkungan Pengujian
- **Versi Node.js Lokal**: `v24.20.0` (Node 24 LTS)
- **Browser Automation**: Playwright dengan engine Chromium dan WebKit (`npx playwright install --with-deps chromium webkit`)

---

## 🔒 Privasi, Keamanan, & Kepatuhan Standalone
- **100% Berjalan Lokal di Sisi Klien**: Tidak ada data yang dikirim ke server cloud pihak ketiga manapun.
- **Bebas Ketergantungan Eksternal**: Seluruh file CSS, font kaligrafi, JavaScript, WASM binary, dan model bahasa Tesseract tersimpan lokal di dalam repositori.
- **Dukungan Protokol `file:///` Penuh**: Dapat dijalankan langsung dari USB Flashdisk, hard drive lokal, atau jaringan lokal tanpa instalasi server.

---

## Merapikan dan Mengemas (Repository Hygiene & Packaging)

Untuk menjaga ukuran repositori tetap ramping dan membersihkan berkas hasil uji sementara, gunakan perintah berikut:

### 1. Membersihkan Berkas Sementara (Clean)

Menghapus folder tangkapan layar pengujian (`tests/browser/screenshots`), berkas scratch, trash, hasil laporan Playwright (`test-results`, `playwright-report`), serta berkas log pengujian tanpa menyentuh berkas yang terlacak git:

```bash
npm run clean
```

Jika ingin membersihkan `node_modules` sekaligus:

```bash
npm run clean -- --deep
```

### 2. Pengambilan Tangkapan Layar Opsional

Pengujian responsivitas seluler (`npm run test:mobile`) secara default tidak menyimpan tangkapan layar kecuali terjadi kegagalan pada halaman. Untuk menyimpan seluruh tangkapan layar pengujian, jalankan dengan variabel lingkungan:

```bash
SAVE_SCREENSHOTS=1 npm run test:mobile
```

### 3. Mengemas Arsip Ramping (Lightweight Zip)

Untuk membuat arsip zip yang hanya memuat berkas yang sudah ter-commit di Git tanpa menyertakan model bahasa OCR Tesseract lokal:

```bash
git archive --format=zip -o ..\pdf-ringan.zip HEAD -- . ':(exclude)js/lib/tesseract'
```

---

## ⚠️ Masalah yang Diketahui (Known Issues)

Keterbatasan berikut sudah diketahui pada versi 1.0.0:

- **Redaksi permanen:** halaman yang diredaksi menjadi gambar, sehingga teksnya tidak bisa dipilih atau dicari lagi, dan struktur tag aksesibilitas halaman itu dihapus.
- **Tanda tangan digital:** alat yang menulis ulang berkas (Watermark, Gabung, Tanda Tangan, Kompres, dan lainnya) mengubah tanda tangan digital menjadi stempel visual. Tanda tangan itu tidak lagi sah secara kriptografi, karena setiap perubahan pada berkas membatalkannya. Tambahkan tanda tangan atau paraf sebelum dokumen ditandatangani secara elektronik.
- **PDF Studio:** belum dioptimalkan untuk layar sentuh dan HP (memakai event mouse), belum menangani PDF berproteksi seperti alat lainnya, dan OCR bawaannya (ID + EN) mengunduh dua model bahasa sekaligus. Disarankan memakai komputer.
- **Menyalin halaman antar dokumen** (Gabung, Pisah, Hapus Halaman, Urutkan): struktur tag aksesibilitas dan kolom formulir tidak ikut terbawa, dan bookmark tanpa tujuan serta tanpa anak tidak dibawa.
- **Buka Kunci (Unlock)** pada PDF terenkripsi buatan alat lain tidak membawa Title dan Author.
- **Kompres:** preset Extreme dan Recommended mengubah halaman menjadi gambar (teks tidak bisa dipilih atau dicari); pada uji PDF foto besar pengurangannya sekitar 95% dan 88%. Preset Less mempertahankan teks vektor tetapi bisa tidak mengecilkan ukuran (0% pada uji yang sama).
- **OCR:** pemakaian pertama mengunduh model bahasa (sekitar 5 MB untuk Indonesia dan 14,6 MB untuk Inggris; terkompres sekitar 4 MB dan 11 MB). Versi web membutuhkan internet saat dimuat; untuk pemakaian sepenuhnya offline, jalankan salinan lokal.
- **Tampilan:** font Inter belum disertakan di proyek, sehingga tampilan memakai font sistem dan lebar teks sedikit berbeda antar perangkat.
- **Belum diuji** pada dokumen sangat besar (ratusan halaman atau puluhan MB); di HP, memori browser terbatas.
- **Belum diuji pada perangkat fisik iOS dan Android.** Pengujian memakai emulasi (Chromium dan WebKit). <!-- hapus baris ini setelah diuji di HP fisik -->

---

## 📜 Lisensi

Aplikasi **PDF Tools** ini dirilis sebagai perangkat lunak sumber terbuka di bawah lisensi [MIT License](LICENSE).

Seluruh dependensi pustaka pihak ketiga (*vendor libraries*) dan font kaligrafi lokal didistribusikan di bawah lisensi resmi masing-masing (MIT, Apache-2.0, dan SIL Open Font License 1.1). Informasi pemegang hak cipta dan teks lisensi lengkap dapat dibaca pada [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

