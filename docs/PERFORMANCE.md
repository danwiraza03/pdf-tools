# Laporan Kinerja & Anggaran Beban Halaman (Performance & Page Weight Baseline)

Dokumen ini mencatat angka dasar (*baseline*) performa, anggaran beban transfer jaringan per halaman, dan hasil benchmark pemrosesan dokumen bervolume besar pada repositori **PDF Tools**.

Seluruh pengujian dilakukan secara 100% *client-side* di dalam peramban (*Chromium headless via Playwright*), menjamin ketiadaan transfer data dokumen ke server luar.

---

## 1. Anggaran Beban Halaman (Page Weight Budget)

Pengukuran dilakukan pada saat inisialisasi awal halaman (*first page load*) melalui `tests/browser/test_page_weight.js`.
Batas toleransi maksimum ditetapkan sebesar **angka dasar aktual + 20%** untuk mendeteksi regresi ukuran bundel atau penambahan dependensi tanpa izin.

| Halaman | Ukuran Aktual | Batas Anggaran (+20%) | Permintaan Aktual | Batas Permintaan (+20%) | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `index.html` | 453.834 bytes (~0,43 MB) | 544.601 bytes | 13 reqs | 16 reqs | LULUS |
| `pages/batch.html` | 1.573.264 bytes (~1,50 MB) | 1.887.917 bytes | 21 reqs | 26 reqs | LULUS |
| `pages/compress.html` | 2.690.606 bytes (~2,57 MB) | 3.228.728 bytes | 25 reqs | 30 reqs | LULUS |
| `pages/crop.html` | 2.544.031 bytes (~2,43 MB) | 3.052.838 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/docx-to-pdf.html` | 1.191.140 bytes (~1,14 MB) | 1.429.368 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/flatten.html` | 2.532.671 bytes (~2,42 MB) | 3.039.206 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/form-fill.html` | 1.440.342 bytes (~1,37 MB) | 1.728.411 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/grayscale.html` | 2.545.178 bytes (~2,43 MB) | 3.054.214 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/jpg-to-pdf.html` | 1.140.737 bytes (~1,09 MB) | 1.368.885 bytes | 21 reqs | 26 reqs | LULUS |
| `pages/merge.html` | 2.724.162 bytes (~2,60 MB) | 3.268.995 bytes | 27 reqs | 33 reqs | LULUS |
| `pages/ocr.html` (tanpa model) | 2.592.043 bytes (~2,47 MB) | 3.110.452 bytes | 21 reqs | 26 reqs | LULUS |
| `pages/page-number.html` | 2.632.766 bytes (~2,51 MB) | 3.159.320 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/pdf-to-docx.html` | 895.298 bytes (~0,85 MB) | 1.074.358 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/pdf-to-jpg.html` | 1.995.730 bytes (~1,90 MB) | 2.394.876 bytes | 23 reqs | 28 reqs | LULUS |
| `pages/pdf-to-xlsx.html` | 899.325 bytes (~0,86 MB) | 1.079.190 bytes | 17 reqs | 21 reqs | LULUS |
| `pages/protect.html` | 1.232.977 bytes (~1,18 MB) | 1.479.573 bytes | 20 reqs | 24 reqs | LULUS |
| `pages/remove-pages.html` | 2.530.475 bytes (~2,41 MB) | 3.036.570 bytes | 23 reqs | 28 reqs | LULUS |
| `pages/reorder.html` | 2.573.166 bytes (~2,45 MB) | 3.087.800 bytes | 24 reqs | 29 reqs | LULUS |
| `pages/rotate.html` | 2.504.866 bytes (~2,39 MB) | 3.005.840 bytes | 22 reqs | 27 reqs | LULUS |
| `pages/sign.html` | 1.503.288 bytes (~1,43 MB) | 1.803.946 bytes | 19 reqs | 23 reqs | LULUS |
| `pages/split.html` | 2.636.403 bytes (~2,51 MB) | 3.163.684 bytes | 24 reqs | 29 reqs | LULUS |
| `pages/viewer.html` | 3.263.157 bytes (~3,11 MB) | 3.915.789 bytes | 62 reqs | 75 reqs | LULUS |
| `pages/watermark.html` | 2.748.747 bytes (~2,62 MB) | 3.298.497 bytes | 27 reqs | 33 reqs | LULUS |
| `pages/xlsx-to-pdf.html` | 1.190.635 bytes (~1,14 MB) | 1.428.762 bytes | 17 reqs | 21 reqs | LULUS |

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

