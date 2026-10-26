# Vendor Libraries Documentation (`js/lib/`)

Dokumen ini mencatat seluruh pustaka pihak ketiga (vendor libraries) yang disimpan secara lokal di dalam direktori `js/lib/`, mencakup nama pustaka, versi, sumber unduhan/repositori, dan lisensi. Seluruh pemrosesan berjalan 100% di sisi klien (client-side) tanpa ketergantungan CDN eksternal saat runtime.

---

## Ringkasan Inventaris Vendor

| Berkas / Direktori | Nama Library | Versi | Sumber Unduhan / Repositori | Lisensi |
|---|---|---|---|---|
| `js/lib/pdf-lib.min.js` | **@cantoo/pdf-lib** *(Fork dari pdf-lib)* | `2.11.1` | [cantoo-scribe/pdf-lib](https://github.com/cantoo-scribe/pdf-lib) / [npm: @cantoo/pdf-lib](https://www.npmjs.com/package/@cantoo/pdf-lib) | MIT |
| `js/lib/pdf.min.js` | **PDF.js** (Display / Viewer engine) | `3.11.174` | [mozilla/pdf.js](https://github.com/mozilla/pdf.js) / [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) | Apache-2.0 |
| `js/lib/pdf.worker.min.js` | **PDF.js Worker** | `3.11.174` | [mozilla/pdf.js](https://github.com/mozilla/pdf.js) / [npm: pdfjs-dist](https://www.npmjs.com/package/pdfjs-dist) | Apache-2.0 |
| `js/lib/FileSaver.min.js` | **FileSaver.js** | `2.0.5` | [eligrey/FileSaver.js](https://github.com/eligrey/FileSaver.js) / [npm: file-saver](https://www.npmjs.com/package/file-saver) | MIT |
| `js/lib/Sortable.min.js` | **SortableJS** | `1.15.0` | [SortableJS/Sortable](https://github.com/SortableJS/Sortable) / [npm: sortablejs](https://www.npmjs.com/package/sortablejs) | MIT |
| `js/lib/jszip.min.js` | **JSZip** | `3.10.1` | [Stuk/jszip](https://github.com/Stuk/jszip) / [npm: jszip](https://www.npmjs.com/package/jszip) | MIT / GPLv3 |
| `js/lib/tesseract/tesseract.min.js` | **Tesseract.js** | `7.0.0` | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) / [npm: tesseract.js](https://www.npmjs.com/package/tesseract.js) | Apache-2.0 |
| `js/lib/tesseract/worker.min.js` | **Tesseract.js Worker** | `7.0.0` | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 |
| `js/lib/tesseract/tesseract-worker.bundle.js` | **Tesseract.js Bundled Worker** | `7.0.0` | [naptha/tesseract.js](https://github.com/naptha/tesseract.js) | Apache-2.0 |
| `js/lib/tesseract/tesseract-core*.wasm.js` | **Tesseract.js Core (WASM / LSTM / SIMD)** | `v5.x` core build | [naptha/tesseract.js-core](https://github.com/naptha/tesseract.js-core) | Apache-2.0 |
| `js/lib/tesseract/lang-data/eng.*` | **Tesseract Traineddata (English)** | `4.00` / `fast` | [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | Apache-2.0 |
| `js/lib/tesseract/lang-data/ind.*` | **Tesseract Traineddata (Indonesian)** | `4.00` / `fast` | [tesseract-ocr/tessdata_fast](https://github.com/tesseract-ocr/tessdata_fast) | Apache-2.0 |

---

## Rincian Khusus Per Pustaka

### 1. `pdf-lib.min.js` — Fork Identifikasi: `@cantoo/pdf-lib`

* **Pustaka Asal:** `Hopding/pdf-lib` (v1.17.1).
* **Fork yang Digunakan:** **`@cantoo/pdf-lib`** (dikembangkan oleh tim [Cantoo Scribe](https://github.com/cantoo-scribe/pdf-lib), dipublikasikan di NPM sebagai [`@cantoo/pdf-lib`](https://www.npmjs.com/package/@cantoo/pdf-lib)).
* **Versi:** `2.11.1`
* **Catatan Verifikasi Berkas:**
  - Ukuran: 616.746 byte
  - SHA-256: `2294a0bb8742d8948ae2d49a60cb6a3600c0b5deae6de198e57fb368d1b79ba9`
  - Terverifikasi identik bit-per-bit dengan paket npm @cantoo/pdf-lib@2.11.1.
* **Alasan Penggunaan Fork:**
  1. Versi upstream resmi (`Hopding/pdf-lib`) tidak memiliki dukungan enkripsi atau proteksi kata sandi dan berhenti menerima pembaruan aktif.
  2. Fork `@cantoo/pdf-lib` menambahkan metode native `pdfDoc.encrypt(...)` dengan algoritma enkripsi modern **AES-256**, dukungan `userPassword`, `ownerPassword`, dan konfigurasi granular izin hak akses (`permissions`: printing, modifying, copying, annotating, dll).
  3. Fork ini juga mencakup validasi spesifikasi PDF/A (misalnya throw error jika mencoba mengenkripsi dokumen PDF/A sesuai standar ISO 19005).
* **Rujukan dalam Kode:** Digunakan langsung pada modul proteksi dokumen [`js/core/pdf-protect.js`](../core/pdf-protect.js) baris 3-4 dan baris 107:
  ```javascript
  // Loaded PDF-Lib engine does not support encryption. Please ensure @cantoo/pdf-lib is loaded.
  pdfDoc.encrypt({
    userPassword: userPassword || '',
    ownerPassword: ownerPassword || userPassword || '',
    permissions: permConfig
  });
  ```
* **Lisensi:** MIT License (Copyright (c) 2019 Andrew Dillon, Copyright (c) Cantoo).

---

### 2. `pdf.min.js` & `pdf.worker.min.js` — PDF.js

* **Vendor:** Mozilla Foundation.
* **Versi:** `3.11.174` (Build universal module definition).
* **Fungsi:** Engine render visual PDF berbasis canvas untuk seluruh preview dokumen dan workbench visual studio.
* **Sumber:** `https://github.com/mozilla/pdf.js` / `pdfjs-dist@3.11.174`.
* **Lisensi:** Apache License 2.0.

---

### 3. `FileSaver.min.js` — FileSaver.js

* **Vendor:** Eli Grey.
* **Versi:** `2.0.5`.
* **Fungsi:** Menginisiasi unduhan berkas (Blob/File) dari peramban ke penyimpanan lokal pengguna tanpa request server.
* **Sumber:** `https://github.com/eligrey/FileSaver.js` / `file-saver@2.0.5`.
* **Lisensi:** MIT License.

---

### 4. `Sortable.min.js` — SortableJS

* **Vendor:** Lebedev Konstantin dkk. (SortableJS Community).
* **Versi:** `1.15.0`.
* **Fungsi:** Reordering thumbnail halaman secara interaktif melalui antarmuka drag-and-drop HTML5 (organize, merge, studio pages panel).
* **Sumber:** `https://github.com/SortableJS/Sortable` / `sortablejs@1.15.0`.
* **Lisensi:** MIT License.

---

### 5. `jszip.min.js` — JSZip

* **Vendor:** Stuart Knightley, David Duponchel, Franz Buchinger, António Afonso.
* **Versi:** `3.10.1`.
* **Fungsi:** Kompresi dan ekstraksi arsip ZIP di memori browser (misal mengekspor banyak halaman sebagai berkas gambar terpisah dalam format .zip). Menggunakan library `pako` internal.
* **Sumber:** `https://github.com/Stuk/jszip` / `jszip@3.10.1`.
* **Lisensi:** Dual licensed: MIT License atau GPLv3.

---

### 6. `tesseract/` — Tesseract.js & WASM Cores

* **Vendor:** Naptha / Jerome Wu dkk.
* **Versi:** Tesseract.js `7.0.0` dengan Emscripten WebAssembly core.
* **Berkas:**
  - `tesseract.min.js`: Client API penghubung antarmuka OCR.
  - `worker.min.js`: Web worker pengelola thread OCR offline.
  - `tesseract-worker.bundle.js`: Bundle worker terkompilasi offline. Merupakan **hasil build lokal** yang menggabungkan `tesseract-core-lstm.wasm.js` dan `worker.min.js` dengan serialisasi `JSON.stringify` untuk keamanan escaping kutip dan karakter biner.
    - **Perintah Build:** `node scripts/build_ocr_bundle.js`
    - **Ukuran:** `4.011.355 bytes`
    - **Integritas SHA-256:** `a48ab3c9c8a1a7342f75e363f9ee7eba69cc3c87bf2dc428ead101a9334cd3b7`
  - `tesseract-core.wasm.js`, `tesseract-core-lstm.wasm.js`, `tesseract-core-simd-lstm.wasm.js`: Biner WebAssembly mesin OCR Tesseract.
  - `lang-data/eng.*` & `lang-data/ind.*`: Model bobot bahasa terlatih (English dan Bahasa Indonesia) berbasis neural network LSTM.
* **Fungsi:** Pengenalan karakter optik (OCR) 100% offline di browser klien tanpa pengiriman data ke server mana pun.
* **Sumber:** `https://github.com/naptha/tesseract.js` & `https://github.com/tesseract-ocr/tessdata_fast`.
* **Lisensi:** Apache License 2.0.
