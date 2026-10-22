# Product Requirements Document (PRD)
# PDF Studio Pro - Adobe Acrobat Pro Equivalent (Offline-First)

**Versi Dokumen:** 2.0
**Tanggal:** 21 Agustus 2026
**Status:** ACTIVE - In Development
**Product Manager:** PDF Tools Team

---

## 1. Visi Produk

Menjadi alternatif Adobe Acrobat Pro yang 100% offline, gratis, dan privat. Memberikan kemampuan professional-grade PDF editing langsung di browser atau desktop tanpa instalasi server, tanpa upload data, tanpa berlangganan.

---

## 2. Daftar Modul Aktif

| No | Halaman | Fungsi | Status |
|:---:|---|---|:---:|
| 1 | viewer.html | PDF Studio Pro - All-in-one viewer, editor, annotator, OCR | Active |
| 2 | merge.html | Merge PDF - Gabung beberapa file PDF | Active |
| 3 | compress.html | Compress PDF - Kompres ukuran file PDF | Active |
| 4 | split.html | Split PDF - Pisahkan/ekstrak halaman tertentu | Active |
| 5 | rotate.html | Rotate PDF - Rotasi halaman | Active |
| 6 | remove-pages.html | Remove Pages - Hapus halaman tertentu | Active |
| 7 | reorder.html | Reorder Pages - Susun ulang urutan halaman | Active |
| 8 | jpg-to-pdf.html | JPG to PDF - Konversi gambar ke PDF | Active |
| 9 | pdf-to-jpg.html | PDF to JPG - Konversi halaman PDF ke gambar | Active |
| 10 | watermark.html | Watermark - Tambah watermark teks/gambar | Active |
| 11 | ocr.html | OCR PDF - Ekstrak teks dari scan/gambar | Active |

---

## 3. Feature Requirements - PDF Studio Pro (viewer.html)

### FR-01: Document Management

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-01.1 | Open PDF | Buka file PDF via tombol / drag and drop ke viewport | P0 |
| FR-01.2 | Tab Dokumen | Nama file ditampilkan di tab header atas | P0 |
| FR-01.3 | Save / Export PDF | Bake semua anotasi ke PDF baru menggunakan pdf-lib | P0 |
| FR-01.4 | Print | Cetak dokumen via window.print() browser | P1 |
| FR-01.5 | Keyboard Shortcuts | Ctrl+O Open, Ctrl+S Save, Ctrl+Z Undo, PageUp/Down Nav | P1 |
| FR-01.6 | Recent Files | Simpan riwayat 5 file terakhir di LocalStorage | P2 |

### FR-02: Navigation & View

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-02.1 | Page Navigation | Tombol Previous / Next dengan input halaman manual | P0 |
| FR-02.2 | Zoom Controls | Dropdown 75% / 100% / 125% / 150% / 200% + Fit Width | P0 |
| FR-02.3 | Zoom In/Out Button | Tombol + dan - dengan step 25% | P0 |
| FR-02.4 | Fit Width | Auto-scale halaman sesuai lebar viewport | P0 |
| FR-02.5 | Hand Tool Pan | Drag viewport dengan kursor tangan | P1 |
| FR-02.6 | Scroll Wheel Zoom | Ctrl + Scroll untuk zoom | P2 |
| FR-02.7 | Full Screen Mode | F11 atau tombol fullscreen | P2 |
| FR-02.8 | Two-Page View | Mode tampilan dua halaman bersebelahan | P3 |

### FR-03: Page Thumbnails Sidebar

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-03.1 | Thumbnail Strip | Render thumbnail mini semua halaman di sidebar kiri | P0 |
| FR-03.2 | Active Page Highlight | Border biru #1a73e8 pada thumbnail halaman aktif | P0 |
| FR-03.3 | Click to Navigate | Klik thumbnail pindah ke halaman tersebut | P0 |
| FR-03.4 | Rotate Left/Right | Tombol rotasi di sidebar toolbar per halaman | P0 |
| FR-03.5 | Delete Page Sidebar | Hapus halaman langsung dari sidebar | P0 |
| FR-03.6 | Toggle Sidebar | Sembunyikan/tampilkan sidebar via tombol icon strip | P1 |
| FR-03.7 | Drag Reorder Thumbnails | Drag thumbnail untuk susun ulang urutan halaman | P2 |

### FR-04: Annotation & Markup Tools

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-04.1 | Highlighter Tool | Garis highlight kuning transparan via freehand pen | P0 |
| FR-04.2 | Pen / Draw Tool | Freehand drawing dengan warna kustom | P0 |
| FR-04.3 | Draw Line | Tarik garis lurus antar dua titik | P1 |
| FR-04.4 | Draw Rectangle | Gambar kotak/persegi panjang | P1 |
| FR-04.5 | Draw Circle/Ellipse | Gambar lingkaran/elips | P1 |
| FR-04.6 | Sticky Note | Tambah komentar berupa sticky note | P2 |
| FR-04.7 | Color Picker | Pilih warna untuk setiap tool anotasi | P1 |
| FR-04.8 | Line Width | Pilih ketebalan garis thin/medium/thick | P1 |
| FR-04.9 | Undo / Redo | Ctrl+Z undo per-aksi; Ctrl+Y redo | P0 |
| FR-04.10 | Strikethrough | Coret teks dengan garis horizontal merah | P2 |
| FR-04.11 | Underline | Garis bawah pada teks | P2 |
| FR-04.12 | Eraser | Hapus drawing/anotasi tertentu | P1 |

### FR-05: Text Editing - Add Text Box

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-05.1 | Add Text Box | Klik/double-klik pada canvas muncul text box interaktif | P0 |
| FR-05.2 | Draggable Header | Text box memiliki header Move untuk drag pindah posisi | P0 |
| FR-05.3 | Font Size Picker | Dropdown font size: 10, 12, 14, 18, 24, 32px | P0 |
| FR-05.4 | Color Picker | Input warna teks | P0 |
| FR-05.5 | Delete Text Box | Tombol X di header text box | P0 |
| FR-05.6 | Multi-line Support | Enter key membuat baris baru dalam satu text box | P0 |
| FR-05.7 | Font Family | Dropdown font: Helvetica, Times, Courier | P1 |
| FR-05.8 | Bold / Italic | Toggle bold / italic pada teks | P1 |
| FR-05.9 | Text Alignment | Left / Center / Right alignment | P2 |
| FR-05.10 | Resize Text Box | Drag corner untuk resize text box | P1 |
| FR-05.11 | PDF Bake on Export | Text box dikonversi ke teks native PDF-lib saat Save | P0 |

### FR-06: Fill & Sign - Signature, Stamp & E-Materai

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-06.1 | Signature Pad | Canvas signature pad - gambar tanda tangan dengan mouse | P0 |
| FR-06.2 | Transparent PNG Export | Signature diekspor sebagai PNG transparan clearRect | P0 |
| FR-06.3 | Place on Page | Tanda tangan diletakkan di halaman sebagai overlay widget | P0 |
| FR-06.4 | Drag Signature | Drag untuk pindahkan posisi tanda tangan | P0 |
| FR-06.5 | Corner Resize | Tarik sudut untuk ubah ukuran tanda tangan | P0 |
| FR-06.6 | Delete Signature | Tombol X merah di sudut widget | P0 |
| FR-06.7 | Upload Stamp/E-Materai | Upload gambar PNG/JPG untuk stamp atau e-materai | P0 |
| FR-06.8 | Type Signature | Ketik nama generate signature dari font kaligrafi | P1 |
| FR-06.9 | Signature Color | Pilih warna tinta: hitam, biru, merah | P1 |
| FR-06.10 | Date Stamp | Insert tanggal hari ini sebagai teks stamp | P1 |
| FR-06.11 | PDF Bake PNG on Export | Embed PNG signature ke PDF native menggunakan embedPng | P0 |
| FR-06.12 | Multiple Signatures | Tambah lebih dari satu tanda tangan per halaman | P0 |

### FR-07: Scan & OCR - Offline Tesseract.js

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-07.1 | OCR Drawer Panel | Panel OCR slide-in di sisi kanan workspace | P0 |
| FR-07.2 | Language Selection | Pilih bahasa: Indonesia, English, atau keduanya | P0 |
| FR-07.3 | OCR This Page | Proses OCR pada halaman yang sedang aktif | P0 |
| FR-07.4 | Progress Indicator | Persentase progress OCR real-time | P0 |
| FR-07.5 | Text Output Box | Teks hasil OCR ditampilkan di textarea yang bisa diedit | P0 |
| FR-07.6 | Copy OCR Text | Salin teks OCR ke clipboard | P0 |
| FR-07.7 | Add OCR Text to Page | Tempel hasil OCR sebagai text box di halaman | P0 |
| FR-07.8 | Image Preprocessing | Grayscale + contrast normalization sebelum OCR | P0 |
| FR-07.9 | Searchable PDF Export | Buat invisible text layer di PDF sehingga bisa di-search | P1 |
| FR-07.10 | OCR All Pages | Proses OCR semua halaman sekaligus batch | P2 |
| FR-07.11 | Confidence Score | Tampilkan skor akurasi OCR dalam persen | P1 |
| FR-07.12 | Auto-Language Detect | Deteksi otomatis bahasa dokumen | P3 |

### FR-08: Page Organization

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-08.1 | Rotate Left CCW | Rotasi halaman aktif 90 derajat berlawanan jarum jam | P0 |
| FR-08.2 | Rotate Right CW | Rotasi halaman aktif 90 derajat searah jarum jam | P0 |
| FR-08.3 | Delete Page | Hapus halaman aktif soft delete hilang saat Export | P0 |
| FR-08.4 | Insert Blank Page | Sisipkan halaman kosong sebelum/setelah halaman aktif | P2 |
| FR-08.5 | Duplicate Page | Duplikasi halaman aktif | P2 |
| FR-08.6 | Move Page | Pindahkan halaman ke posisi tertentu | P2 |
| FR-08.7 | Crop Page | Potong margin halaman | P3 |

### FR-09: Right Tools Action Pane

| ID | Fitur | Deskripsi | Link ke Modul |
|---|---|---|---|
| FR-09.1 | Combine Files | Gabung beberapa PDF | merge.html |
| FR-09.2 | Compress PDF | Kompres file aktif | compress.html |
| FR-09.3 | Edit PDF | Aktivasi mode Edit Text | Inline Tool |
| FR-09.4 | Fill & Sign | Buka modal signature & stamp | Inline Modal |
| FR-09.5 | Scan & OCR | Buka OCR Drawer | Inline Panel |
| FR-09.6 | Organize Pages | Kelola/susun halaman | split.html |
| FR-09.7 | Watermark | Tambah watermark | watermark.html |
| FR-09.8 | Export / Save | Export PDF dengan semua anotasi | Inline Export |
| FR-09.9 | Search Tools | Filter tool di pane dengan search box | Inline |

---

## 4. Feature Requirements - Modul Standalone

### FR-10: Merge PDF

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-10.1 | Multi-File Upload | Upload beberapa file PDF sekaligus | P0 |
| FR-10.2 | Page Preview per File | Thumbnail halaman setiap PDF sebelum merge | P0 |
| FR-10.3 | Drag & Drop Reorder | Susun ulang urutan file sebelum merge | P0 |
| FR-10.4 | Select Pages per File | Pilih halaman mana yang akan diikutsertakan | P1 |
| FR-10.5 | Merge & Download | Proses merge dan unduh hasilnya | P0 |
| FR-10.6 | Page Range Input | Input range halaman: 1-3, 5, 7-9 | P1 |

### FR-11: Compress PDF

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-11.1 | Quality Presets | Preset: High Quality / Balanced / Maximum Compression | P0 |
| FR-11.2 | File Size Before/After | Tampilkan ukuran asli vs hasil kompres | P0 |
| FR-11.3 | Image Downscaling | Kurangi resolusi gambar dalam PDF | P0 |
| FR-11.4 | Remove Metadata | Hapus metadata author, creation date, dll. | P1 |
| FR-11.5 | Remove Embedded Fonts | Subset font untuk kurangi ukuran | P2 |

### FR-12: Split PDF

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-12.1 | Split by Range | Pisahkan berdasarkan range: 1-3, 4-7 | P0 |
| FR-12.2 | Split Every N Pages | Pisahkan setiap N halaman | P0 |
| FR-12.3 | Extract Single Pages | Unduh setiap halaman sebagai file PDF terpisah | P1 |
| FR-12.4 | Preview Splits | Tampilkan preview hasil split sebelum download | P1 |

### FR-13: Watermark

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-13.1 | Text Watermark | Teks watermark misal: RAHASIA, DRAFT | P0 |
| FR-13.2 | Image Watermark | Upload gambar sebagai watermark | P0 |
| FR-13.3 | Opacity Control | Slider opacity watermark 0-100% | P0 |
| FR-13.4 | Rotation Angle | Atur sudut watermark diagonal, horizontal | P0 |
| FR-13.5 | Position | Pilih posisi: tengah, pojok, tile seluruh halaman | P0 |
| FR-13.6 | Font Customization | Pilih font, ukuran, dan warna teks watermark | P1 |
| FR-13.7 | Apply to All/Specific Pages | Watermark semua halaman atau halaman tertentu | P1 |

### FR-14: OCR Standalone

| ID | Fitur | Deskripsi | Prioritas |
|---|---|---|:---:|
| FR-14.1 | Upload PDF / Image | Upload file PDF scan atau gambar JPG/PNG | P0 |
| FR-14.2 | Offline Processing | Tesseract.js berjalan lokal tanpa internet | P0 |
| FR-14.3 | Multi-Language | Pilih bahasa ID, EN, atau kombinasi | P0 |
| FR-14.4 | Image Preprocessing | Grayscale + contrast normalization otomatis | P0 |
| FR-14.5 | Export Searchable PDF | Output PDF dengan invisible text layer | P1 |
| FR-14.6 | Export Text File | Download hasil OCR sebagai .txt | P1 |
| FR-14.7 | Page-by-Page Processing | Progress per halaman | P0 |

---

## 5. Stack Teknologi

| Komponen | Library | Versi | Fungsi |
|---|---|---|---|
| PDF Rendering | pdf.js Mozilla | 3.x | Render halaman PDF ke Canvas HTML5 |
| PDF Manipulation | pdf-lib | 1.17.x | Bake anotasi, teks, gambar ke PDF native |
| OCR Engine | Tesseract.js | 5.x | Offline OCR dengan WASM LSTM |
| File Download | FileSaver.js | 2.0.x | Trigger unduh file di browser |
| Markup | Vanilla HTML5 | - | Tidak ada framework |
| Styling | Vanilla CSS | - | Custom design system |
| JavaScript | Vanilla ES6+ | - | Modul terpisah per domain |

---

## 6. Bug Tracker & Known Issues

| ID | Komponen | Deskripsi Bug | Status |
|---|---|---|---|
| BUG-01 | viewer.html | Signature memiliki background putih | Fixed |
| BUG-02 | viewer.html | Text box tidak bisa dipindah | Fixed |
| BUG-03 | viewer.html | OCR tidak akurat di scan fotokopi | Fixed |
| BUG-04 | viewer.html | Posisi teks tidak presisi saat export ke PDF | Fixed |
| BUG-05 | merge.html | File tidak bisa dipreview per halaman | In Progress |
| BUG-06 | viewer.html | Hand tool tidak smooth saat pan dokumen besar | Planned |
| BUG-07 | Semua halaman | Tidak ada pesan error user-friendly jika file corrupt | Planned |

---

## 7. Fitur Keamanan & Privasi

| Fitur | Deskripsi | Status |
|---|---|---|
| 100% Offline | Semua proses terjadi di browser/lokal, tidak ada upload ke server | Implemented |
| No Tracking | Tidak ada analytics, cookies, atau tracking apapun | Implemented |
| Memory Cleanup | ArrayBuffer dan object URL dibebaskan setelah dipakai | Partial |
| Password Protect PDF | Enkripsi PDF dengan password menggunakan pdf-lib | Planned P1 |
| Password Unlock PDF | Buka PDF yang diproteksi password | Planned P1 |
| Metadata Strip | Hapus author, creation date, dan informasi sensitif dari PDF | Planned P2 |

---

## 8. Non-Functional Requirements

| Kategori | Requirement | Target |
|---|---|---|
| Performance | Render halaman pertama PDF | < 2 detik |
| Performance | Proses kompres PDF 10MB | < 5 detik |
| Performance | OCR satu halaman A4 300dpi | < 10 detik |
| Compatibility | Browser minimum | Chrome 90+, Edge 90+, Firefox 88+ |
| Accessibility | Keyboard navigable seluruh toolbar | P1 |
| File Size Limit | Ukuran file PDF yang bisa dibuka | Rekomendasi < 100MB |
| Offline Aset | Semua library tersedia di /js/lib/ | Implemented |
| Memory | Tidak menyebabkan crash di tab browser | Monitor heap usage |

---

## 9. Roadmap Pengembangan

### Sprint Aktif Q3 2026
- [x] PDF Studio Viewer + Editor viewer.html
- [x] Transparent Signature Pad & Typed Calligraphy Generator
- [x] Draggable Text Box dengan Font Family, Bold, Italic, Size
- [x] Vector Shapes Tool (Rectangle, Circle, Line)
- [x] Unlimited Undo / Redo History Stack
- [x] OCR Inline Panel dengan Tesseract.js
- [x] Rotate dan Delete halaman per page
- [x] Password Protect & Unlock PDF (pages/protect.html)
- [x] Page Numbering & Header/Footer (pages/page-number.html)

### Sprint Q4 2026 (Fitur Lanjutan Studio)
- [x] Drag & Drop Reorder Thumbnails di dalam Viewer (Sidebar Interaktif)
- [x] Quick Find & Search Text in Document (Ctrl + F)
- [x] Searchable PDF OCR Layer Export (Bake Invisible Selectable Text)
- [x] Duplicate Page in Studio (📑+)
- [ ] Interactive Form Field Generator & Filler

### Jangka Panjang 2027
- [ ] PDF to DOCX Converter
- [ ] PWA Install as Desktop App
- [ ] Digital Signature Certificate
- [ ] Batch Processing
- [ ] Cloud Sync dengan enkripsi end-to-end

---

## 10. Definition of Done (DoD)

Setiap fitur dianggap DONE ketika:
1. Fungsional - Fitur bekerja sesuai requirement di dokumen ini
2. Offline - Tidak memerlukan koneksi internet sama sekali
3. Cross-Browser - Berjalan di Chrome, Edge, dan Firefox terkini
4. Error Handled - Menampilkan pesan error yang jelas jika gagal
5. Responsive - Tidak rusak tampilan di layar 13 inci ke atas
6. Bilingual - Label UI tersedia dalam ID dan EN di i18n.js
7. No Console Errors - Tidak ada error kritis di browser console
8. Tested - Diuji manual dengan minimal 3 file PDF berbeda

---

Dokumen ini adalah living document yang akan diperbarui setiap sprint.
Terakhir diperbarui: 21 Agustus 2026 - PDF Tools Team
