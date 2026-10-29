# Laporan Kinerja & Anggaran Beban Halaman (Performance & Page Weight Baseline)

Dokumen ini mencatat angka dasar (*baseline*) performa, anggaran beban transfer jaringan per halaman, dan hasil benchmark pemrosesan dokumen bervolume besar pada repositori **PDF Tools**.

Seluruh pengujian dilakukan secara 100% *client-side* di dalam peramban (*Chromium headless via Playwright*), menjamin ketiadaan transfer data dokumen ke server luar.

---

## 1. Anggaran Beban Halaman (Page Weight Budget)

Pengukuran dilakukan pada saat inisialisasi awal halaman (*first page load*) melalui `tests/browser/test_page_weight.js`.
Batas toleransi maksimum ditetapkan sebesar **angka dasar aktual + 20%** untuk mendeteksi regresi ukuran bundel atau penambahan dependensi tanpa izin.

| Halaman | Ukuran Aktual | Batas Anggaran (+20%) | Permintaan Aktual | Batas Permintaan (+20%) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `index.html` | 328.573 bytes (~0,31 MB) | 394.288 bytes | 8 reqs | 10 reqs | LULUS |
| `pages/batch.html` | 1.448.003 bytes (~1,38 MB) | 1.737.604 bytes | 16 reqs | 20 reqs | LULUS |
| `pages/compress.html` | 2.565.345 bytes (~2,45 MB) | 3.078.414 bytes | 20 reqs | 24 reqs | LULUS |
| `pages/crop.html` | 2.418.770 bytes (~2,31 MB) | 2.902.524 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/docx-to-pdf.html` | 1.065.879 bytes (~1,02 MB) | 1.279.055 bytes | 12 reqs | 15 reqs | LULUS |
| `pages/flatten.html` | 2.407.410 bytes (~2,30 MB) | 2.888.892 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/form-fill.html` | 1.315.081 bytes (~1,25 MB) | 1.578.098 bytes | 12 reqs | 15 reqs | LULUS |
| `pages/grayscale.html` | 2.419.917 bytes (~2,31 MB) | 2.903.901 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/jpg-to-pdf.html` | 1.015.476 bytes (~0,97 MB) | 1.218.572 bytes | 16 reqs | 20 reqs | LULUS |
| `pages/merge.html` | 2.598.901 bytes (~2,48 MB) | 3.118.682 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/ocr.html` (tanpa model) | 2.466.782 bytes (~2,35 MB) | 2.960.139 bytes | 16 reqs | 20 reqs | LULUS |
| `pages/page-number.html` | 2.507.505 bytes (~2,39 MB) | 3.009.006 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/pdf-to-docx.html` | 770.037 bytes (~0,73 MB) | 924.045 bytes | 12 reqs | 15 reqs | LULUS |
| `pages/pdf-to-jpg.html` | 1.870.469 bytes (~1,78 MB) | 2.244.563 bytes | 18 reqs | 22 reqs | LULUS |
| `pages/pdf-to-xlsx.html` | 774.064 bytes (~0,74 MB) | 928.877 bytes | 12 reqs | 15 reqs | LULUS |
| `pages/protect.html` | 1.107.716 bytes (~1,06 MB) | 1.329.260 bytes | 15 reqs | 18 reqs | LULUS |
| `pages/remove-pages.html` | 2.405.214 bytes (~2,29 MB) | 2.886.257 bytes | 18 reqs | 22 reqs | LULUS |
| `pages/reorder.html` | 2.447.905 bytes (~2,33 MB) | 2.937.486 bytes | 19 reqs | 23 reqs | LULUS |
| `pages/rotate.html` | 2.379.605 bytes (~2,27 MB) | 2.855.526 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/sign.html` | 1.374.310 bytes (~1,31 MB) | 1.649.172 bytes | 14 reqs | 17 reqs | LULUS |
| `pages/split.html` | 2.511.142 bytes (~2,39 MB) | 3.013.371 bytes | 19 reqs | 23 reqs | LULUS |
| `pages/viewer.html` | 3.259.040 bytes (~3,11 MB) | 3.910.848 bytes | 62 reqs | 75 reqs | LULUS |
| `pages/watermark.html` | 2.623.486 bytes (~2,50 MB) | 3.148.184 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/xlsx-to-pdf.html` | 1.065.374 bytes (~1,02 MB) | 1.278.449 bytes | 12 reqs | 15 reqs | LULUS |

> **Catatan On-Demand OCR:** Model bahasa Tesseract (`ind.js`, `eng.js`, dll.) **tidak dimuat** pada saat halaman dibuka (`0 premature requests`). Berkas hanya dimuat sesuai permintaan saat tombol proses pengenalan teks ditekan.

---

## 2. Benchmark Pemrosesan Dokumen Besar (Large Document Benchmark)

Pengujian dilakukan menggunakan perintah `npm run test:large` via [`tests/browser/test_large_documents.js`](../tests/browser/test_large_documents.js).
Pengujian ini mengevaluasi stabilitas memori peramban (*heap memory*), kebenaran struktural, dan durasi eksekusi saat menangani ratusan halaman atau berkas gambar beresolusi tinggi.

| Skenario Operasi | Input Uji | Output & Integritas | Durasi Eksekusi | Penggunaan Heap | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Gabung 10 PDF (100 Halaman)** | 10 berkas PDF (10 halaman per berkas) | 100 halaman (39,9 KB) | ~0,04 detik (37 ms) | 51,1 MB -> 51,3 MB | LULUS |
| **Pisah Halaman (20 dari 100)** | 1 berkas PDF master (100 halaman) | 20 halaman (8,4 KB) | ~0,01 detik (6 ms) | 53,9 MB -> 54,3 MB | LULUS |
| **Watermark Teks (100 Halaman)** | 1 berkas PDF master (100 halaman) | 100 halaman (76,9 KB) | ~0,06 detik (58 ms) | 49,9 MB -> 50,1 MB | LULUS |
| **Hapus Halaman (25 dari 100)** | 1 berkas PDF master (100 halaman) | 75 halaman (30,1 KB) | ~0,02 detik (25 ms) | 52,6 MB -> 52,7 MB | LULUS |
| **Kompresi 10 Halaman Foto** | 10 halaman kanvas foto berwarna (1200x800 px) | 236,0 KB (Penghematan 21%) | ~0,47 detik (466 ms) | 55,4 MB -> 55,7 MB | LULUS |
| **Pratinjau Halaman Pertama** | Halaman 1 berkas foto (PDF.js render) | 800x1100 px Kanvas | ~0,03 detik (32 ms) | 55,7 MB -> 55,8 MB | LULUS |

---

## 3. Analisis Stabilitas Memori & Efisiensi Client-Side

1. **Efisiensi Batching (`copyPagesBatched`):**
   Penggabungan 10 berkas dengan total 100 halaman selesai dalam waktu kurang dari 50 milidetik berkat pemanfaatan struktur referensi bersama (*shared resources*) dan peniadaan salinan byte yang tidak diperlukan.
2. **Kestabilan Alokasi Memori Heap:**
   Konsumsi memori *heap* JavaScript peramban tetap stabil di rentang **49 MB hingga 56 MB** selama seluruh siklus pemrosesan 100 halaman. Tidak ditemukan kebocoran memori (*memory leak*) atau lonjakan memori tak wajar.
3. **Penyimpanan Anggaran:**
   Batas anggaran beban halaman tersimpan di `tests/browser/page_weight_budget.json` dan secara otomatis diverifikasi setiap kali `npm run test:browser` atau `node tests/browser/test_page_weight.js` dijalankan.

---

## 4. Cara Menjalankan Uji Kinerja

Untuk menjalankan verifikasi anggaran beban halaman:
```bash
node tests/browser/test_page_weight.js
# atau melalui runner browser:
npm run test:browser -- --only=weight
```

Untuk menjalankan benchmark pemrosesan dokumen besar:
```bash
npm run test:large
```
