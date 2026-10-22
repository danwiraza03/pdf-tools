# ⚡ PDF Tools — 100% Offline Client-Side PDF Suite

Aplikasi pengolah dokumen PDF serbaguna yang berjalan **100% di browser lokal Anda tanpa memerlukan koneksi internet ataupun server web**. Semua proses penggabungan, pemotongan, kompresi, OCR, penandatanganan, dan pengeditan PDF dieksekusi secara instan di komputer Anda.

---

## 🚀 Cara Menjalankan Aplikasi

Cukup **klik dua kali (*double-click*) file `index.html`** pada File Explorer di Windows / Mac / Linux untuk langsung membukanya di browser favorit Anda (Google Chrome, Microsoft Edge, Mozilla Firefox, Brave, atau Safari).

> [!NOTE]
> Aplikasi ini adalah **100% Client-Side Standalone**. Anda **tidak membutuhkan web server** (seperti Laragon, Apache, Node.js, atau Nginx). Seluruh berkas PDF yang Anda proses **tidak pernah diunggah ke internet**, menjamin keamanan dan privasi data 100%.

---

## 🛠️ Daftar 17 Alat & Fitur Lengkap

| No | Tool / Fitur | File Halaman | Deskripsi Utama |
|:---:|---|---|---|
| 1 | **✨ PDF Studio (Editor Lengkap)** | [pages/viewer.html](file:///c:/laragon/www/pdf/pages/viewer.html) | Workspace komprehensif PDF Studio Pro: View, Text Edit, Anotasi, Fill & Sign, Stamp, Redaction, dan OCR. |
| 2 | **🔀 Merge PDF** | [pages/merge.html](file:///c:/laragon/www/pdf/pages/merge.html) | Gabungkan banyak berkas PDF menjadi satu dengan Visual Page Organizer & tombol *Clear All Pages*. |
| 3 | **🗜️ Compress PDF** | [pages/compress.html](file:///c:/laragon/www/pdf/pages/compress.html) | Kompresi ukuran dokumen (3 preset) + deteksi tanda tangan digital + **Batch Queue ke ZIP**. |
| 4 | **✂️ Split PDF** | [pages/split.html](file:///c:/laragon/www/pdf/pages/split.html) | Pisahkan PDF per halaman, berdasarkan rentang (*range*), atau setiap *N* halaman. |
| 5 | **🖼️ JPG to PDF** | [pages/jpg-to-pdf.html](file:///c:/laragon/www/pdf/pages/jpg-to-pdf.html) | Konversi gambar (JPG, PNG, WebP) ke PDF dengan opsi ukuran kertas (A4, Letter, Fit), orientasi, & margin. |
| 6 | **🔄 Rotate PDF** | [pages/rotate.html](file:///c:/laragon/www/pdf/pages/rotate.html) | Putar orientasi halaman PDF per halaman (90°, 180°, 270°) atau seluruh dokumen sekaligus. |
| 7 | **🗑️ Remove Pages** | [pages/remove-pages.html](file:///c:/laragon/www/pdf/pages/remove-pages.html) | Hapus halaman tertentu secara visual dengan mengklik thumbnail halaman yang ingin dibuang. |
| 8 | **📑 Reorder Pages** | [pages/reorder.html](file:///c:/laragon/www/pdf/pages/reorder.html) | Susun ulang urutan halaman PDF dengan mudah menggunakan antarmuka *drag & drop*. |
| 9 | **📷 PDF to JPG** | [pages/pdf-to-jpg.html](file:///c:/laragon/www/pdf/pages/pdf-to-jpg.html) | Ekstrak halaman PDF menjadi gambar resolusi tinggi (JPG/PNG) satuan atau sekaligus dalam ZIP. |
| 10 | **🏷️ Watermark PDF** | [pages/watermark.html](file:///c:/laragon/www/pdf/pages/watermark.html) | Tambahkan cap air teks/stempel dengan kustomisasi sudut, opasitas, warna + **Batch Queue ke ZIP**. |
| 11 | **🔍 OCR PDF (100% Offline)** | [pages/ocr.html](file:///c:/laragon/www/pdf/pages/ocr.html) | Ekstrak teks (Bahasa Indonesia & English) & buat Searchable PDF tanpa internet menggunakan Tesseract WASM. |
| 12 | **🔢 Page Numbers** | [pages/page-number.html](file:///c:/laragon/www/pdf/pages/page-number.html) | Tambahkan penomoran halaman otomatis, header, & footer dengan format kustom + **Batch Queue ke ZIP**. |
| 13 | **🔒 Protect & Unlock PDF** | [pages/protect.html](file:///c:/laragon/www/pdf/pages/protect.html) | Enkripsi sandi dokumen dengan proteksi militer atau buka kunci sandi + **Batch Queue ke ZIP**. |
| 14 | **🛡️ Flatten PDF (Baru)** | [pages/flatten.html](file:///c:/laragon/www/pdf/pages/flatten.html) | Kunci isian formulir, tanda tangan, dan stempel menjadi lapisan permanen anti-edit (*read-only*). |
| 15 | **✂️ Crop & Trim Margins (Baru)** | [pages/crop.html](file:///c:/laragon/www/pdf/pages/crop.html) | Potong margin putih berlebih dengan 8 handle visual & tombol cerdas *Auto-Trim Whitespace*. |
| 16 | **🎨 PDF to Grayscale (Baru)** | [pages/grayscale.html](file:///c:/laragon/www/pdf/pages/grayscale.html) | Ubah dokumen berwarna ke skala abu-abu / fotokopi B&W dengan slider perbandingan *Before/After*. |
| 17 | **📦 Batch Processing Queue** | *Terintegrasi* | Memproses puluhan berkas PDF sekaligus secara otomatis dan langsung diunduh dalam 1 paket `.zip`. |

---

## 📖 Panduan Penggunaan Lengkap

### 1. ✨ Mengedit Dokumen di PDF Studio (`pages/viewer.html`)
1. Buka `pages/viewer.html` atau klik tombol **PDF Studio** pada halaman utama.
2. Drag & drop berkas PDF Anda ke area kerja.
3. **Fitur Pengeditan**:
   - **Teks**: Klik tombol `🔤 Add Text` untuk menambah teks baru di mana saja, atau `📝 Edit Text` untuk menyunting teks yang ada.
   - **Fill & Sign (Tanda Tangan & Formulir)**: Klik tombol `✍️ Fill & Sign`. Gunakan toolbar sekunder untuk meletakkan centang (`✔`), silang (`✖`), titik (`●`), lingkaran (`⭕`), garis (`━`), atau tanggal otomatis (`📅`).
   - **Tanda Tangan Kaligrafi**: Pilih opsi *Draw* (gambar tangan/touchscreen), *Type* (ketik nama dengan font kaligrafi), atau *Upload* (unggah stempel/tanda tangan transparan).
   - **OCR Inline**: Klik `🔍 Scan & OCR` di panel kanan untuk mengekstrak teks langsung pada halaman yang sedang dibuka.
4. Klik `💾 Export / Save` untuk mengunduh dokumen hasil suntingan.

### 2. 🔀 Menggabungkan PDF (`pages/merge.html`)
1. Buka `pages/merge.html` dan tarik beberapa berkas PDF sekaligus ke dalam dropzone.
2. Setiap berkas akan otomatis memiliki thumbnail halaman dengan kode warna tersendiri.
3. Anda dapat menggeser (*drag*) halaman untuk mengatur urutan sesuai kebutuhan, memutar halaman perorangan, atau menghapus halaman tertentu.
4. Terdapat tombol **"🗑️ Clear All Pages"** untuk mereset seluruh halaman dengan sekali klik.
5. Klik **"🔀 Merge PDF"** untuk mengunduh dokumen gabungan.

### 3. 🗜️ Mengompres Ukuran Dokumen (`pages/compress.html`)
1. Buka `pages/compress.html` dan masukkan 1 atau banyak berkas PDF.
2. Pilih tingkat kompresi:
   - **Extreme Compression**: Ukuran terkecil (cocok untuk upload portal berkas berkuota ketat).
   - **Recommended Compression**: Keseimbangan optimal antara ketajaman teks/gambar dan ukuran file.
   - **Less Compression**: Kualitas grafis tertinggi dengan kompresi ringan.
3. Klik **"Compress PDF"**. Jika memasukkan banyak file, hasil kompresi otomatis dibundel ke berkas `.zip`.

### 4. 🛡️ Mengunci Formulir & Tanda Tangan (`pages/flatten.html`)
1. Buka `pages/flatten.html` dan pilih berkas PDF yang telah diisi formulir atau dibubuhi tanda tangan.
2. Pilih metode *Flattening*:
   - **Vector Flatten (Rekomendasi)**: Mengunci isian formulir dan stempel menjadi bagian dari vektor dasar PDF. Teks tetap tajam 100% dan ukuran berkas kecil.
   - **Raster Image (Anti-Tamper Maksimal)**: Merender setiap halaman menjadi gambar beresolusi tinggi sehingga tidak dapat diekstrak atau diinspeksi oleh pihak ketiga.
3. Klik **"Flatten & Download PDF"**.

### 5. ✂️ Memotong Margin Halaman (`pages/crop.html`)
1. Buka `pages/crop.html` dan masukkan berkas PDF.
2. Seluruh lembar halaman (*100% Full Page*) akan langsung tampil pada area kerja tanpa terpotong.
3. Geser kotak pemotong dengan 8 titik handle di sudut dan sisi halaman, atau klik tombol **"✨ Auto-Trim Margins"** untuk mendeteksi batas konten secara otomatis.
4. Pilih cakupan pemotongan (*All Pages* atau *Current Page Only*).
5. Klik **"✂️ Crop & Download PDF"**.

### 6. 🎨 Mengubah PDF ke Grayscale / Hitam Putih (`pages/grayscale.html`)
1. Buka `pages/grayscale.html` dan masukkan berkas PDF.
2. Layar akan menampilkan pratinjau interaktif **Before / After Split Slider**. Geser slider tengah `↔` untuk melihat perbedaan warna asli vs hasil grayscale.
3. Pilih mode:
   - **Smooth Grayscale**: Mempertahankan gradasi foto dan shading warna abu-abu yang halus.
   - **Photocopy / Pure B&W**: Mengubah teks menjadi hitam pekat dan latar belakang menjadi putih 100% (sangat hemat tinta printer).
4. Klik **"🎨 Convert & Download PDF"**.

### 7. 🔍 OCR PDF Offline (`pages/ocr.html`)
1. Buka `pages/ocr.html` dan pilih berkas PDF pindaian (*scanned PDF*) atau gambar dokumen.
2. Pilih bahasa pengenalan teks: *Bahasa Indonesia (ID)*, *English (EN)*, atau keduanya.
3. Pilih format output:
   - **Searchable PDF**: Dokumen PDF dengan lapisan teks tersembunyi yang bisa disorot, dicari (Ctrl+F), dan disalin (*copy-paste*).
   - **Plain Text (.TXT)**: Mengekstrak teks murni ke file teks.
4. Klik **"🔍 Start OCR Process"**.

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

```
pdf/
├── index.html                  # Halaman Beranda Utama (Akses seluruh 17 tools)
├── pages/                      # Seluruh Halaman Standalone Tools
│   ├── viewer.html             # PDF Studio Pro (View, Edit, Fill & Sign, OCR)
│   ├── merge.html              # Merge PDF
│   ├── compress.html           # Compress PDF & Batch Queue
│   ├── split.html              # Split PDF
│   ├── jpg-to-pdf.html         # JPG to PDF
│   ├── rotate.html             # Rotate PDF
│   ├── remove-pages.html       # Remove Pages
│   ├── reorder.html            # Reorder Pages
│   ├── pdf-to-jpg.html         # PDF to JPG
│   ├── watermark.html          # Watermark PDF & Batch Queue
│   ├── ocr.html                # OCR PDF Offline
│   ├── page-number.html        # Page Numbers & Batch Queue
│   ├── protect.html            # Protect & Unlock & Batch Queue
│   ├── flatten.html            # Flatten PDF (Baru)
│   ├── crop.html               # Crop & Trim Margins (Baru)
│   └── grayscale.html          # PDF to Grayscale & B/W (Baru)
├── css/                        # Desain Sistem & Tema
│   ├── style.css               # Token warna, typography, dark mode, dropzone
│   ├── home.css                # Styling landing page
│   └── tool.css                # Styling kartu alat & form
├── js/
│   ├── app.js                  # Inisialisasi tema & global controller
│   ├── lib/                    # Vendor lokal offline (PDF-Lib, PDF.js, Tesseract WASM, JSZip, FileSaver)
│   ├── core/                   # Engine algoritma PDF (merge, compress, crop, flatten, grayscale, ocr)
│   ├── editor/                 # Mesin manipulasi PDF Studio (font intelligence, coordinates, annotations)
│   ├── components/             # Reusable UI (dropzone, toast, theme-toggle, i18n)
│   └── utils/                  # Helper download, format ukuran, file parser
├── docs/                       # Dokumentasi Arsitektur, PRD & Rekomendasi
│   ├── PRD.md                  # Product Requirements Document
│   ├── PRD_PDF_STUDIO_PRO.md   # Spesifikasi PDF Studio Pro
│   ├── PROJECT_ANALYSIS.md     # Analisis teknis proyek
│   ├── ocr_recommendations.md  # Analisis & rekomendasi sistem OCR
│   ├── big_update.md           # Rencana & log pembaruan fitur
│   ├── RPD_updating.md         # Catatan pembaruan & tracking
│   └── implementation_plan.md  # Rencana implementasi
├── tests/                      # Automated Test Harness
│   └── audit_all_tools.js      # Verifikasi 17 tools (`node tests/audit_all_tools.js`)
└── README.md                   # Dokumentasi Resmi Proyek
```

---

## 🧪 Pengujian Otomatis (Test Harness)

Untuk memvalidasi bahwa seluruh 17 modul dan fungsionalitas PDF berjalan dengan baik tanpa error, jalankan:

```bash
node tests/audit_all_tools.js
```

---

## 🔒 Privasi, Keamanan, & Kepatuhan Standalone
- **100% Berjalan Lokal di Sisi Klien**: Tidak ada data yang dikirim ke server cloud pihak ketiga manapun.
- **Bebas Ketergantungan**: Seluruh file CSS, font, JavaScript, WASM binary, dan model bahasa Tesseract telah tersimpan di direktori lokal `js/lib/`.
- **Dukungan Protokol `file:///` Penuh**: Dapat dijalankan langsung dari USB Flashdisk, hard drive lokal, atau jaringan lokal tanpa instalasi server.
