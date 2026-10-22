# 🔍 Analisis & Rekomendasi Fitur OCR PDF
### Dari Perspektif Senior Software Engineer — Document Intelligence & OCR Systems

---

## Audit Arsitektur Saat Ini

### Stack Teknologi OCR

| Komponen | Implementasi | Catatan |
|----------|-------------|---------|
| **OCR Engine** | Tesseract.js v5.x (WebAssembly LSTM) | Neural net LSTM, berjalan 100% di browser |
| **Worker System** | Inline Blob Worker + Fallback ke CDN | 3-tier: Offline Bundle → Local Worker → CDN Fallback |
| **Language Models** | `ind.traineddata.gz` (3.8 MB) + `eng.traineddata.gz` (10.9 MB) | Total ~15 MB di-embed sebagai Base64 JS |
| **WASM Core** | `tesseract-core-lstm.wasm.js` (3.9 MB) | LSTM-only mode (`oem: 1`) |
| **SIMD Core** | `tesseract-core-simd-lstm.wasm.js` (3.9 MB) | ⚠️ **Ada tapi TIDAK PERNAH digunakan** |
| **Image Preprocessing** | `preprocessCanvasForOcr()` — fixed threshold binarization | Sederhana, hanya 1 metode |
| **PDF Rendering** | PDF.js → Canvas (scale 2.0 = 144 DPI) | Resolusi render tetap |
| **Searchable PDF** | pdf-lib: invisible text overlay (word-level bounding boxes) | `opacity: 0.0`, `StandardFonts.Helvetica` |
| **Output Formats** | Plain Text, Markdown, Searchable PDF | Side-by-side view, page breakdown, confidence scores |

### Fitur UI yang Sudah Ada

| Fitur | Status | Catatan |
|-------|--------|---------|
| Dropzone (PDF + Image) | ✅ Lengkap | PDF, JPG, PNG, WebP |
| Language Selection (ID/EN/ID+EN) | ✅ Lengkap | Segmented button UI |
| Output Format Selection | ✅ Lengkap | Text + PDF / Text only / PDF only |
| Page Range Selection | ✅ Lengkap | e.g. "1-5, 8" |
| Live Page Preview (Pre-OCR) | ✅ Lengkap | Canvas navigation |
| Side-by-Side Inspector | ✅ Lengkap | Original page vs Extracted text |
| Per-Page Confidence Score | ✅ Lengkap | Percentage badge |
| Editable Text Result | ✅ Lengkap | Textarea, sync per-page ↔ full text |
| Page Breakdown Tab | ✅ Lengkap | Clickable card per page |
| Copy to Clipboard | ✅ Lengkap | — |
| Download TXT / MD / Searchable PDF | ✅ Lengkap | — |
| Open in PDF Studio | ✅ Lengkap | `setPendingFile()` → `viewer.html` |
| **Image Preprocessing Options** | ❌ Tidak ada | User tidak bisa pilih metode preprocessing |
| **Auto-Rotate / Deskew** | ❌ Tidak ada | Halaman miring tidak dikoreksi |
| **Table Detection / Layout** | ❌ Tidak ada | Tabel dikenali sebagai teks terpisah |
| **Multi-Language Auto-Detect** | ❌ Tidak ada | User harus pilih bahasa manual |
| **Batch / Multi-File OCR** | ❌ Tidak ada | Hanya 1 file per sesi |
| **Word Highlight Overlay** | ❌ Tidak ada | Tidak bisa klik kata di canvas |
| **DOCX / Excel Export** | ❌ Tidak ada | Hanya TXT dan MD |

---

## 🐛 Masalah & Kelemahan yang Ditemukan

### 1. Preprocessing Image Terlalu Sederhana (Fixed Threshold)

```javascript
// preprocessCanvasForOcr() — baris 300-326
if (gray > 200) v = 255;           // Paper → white
else if (gray < 160) v = gray * 0.65; // Ink → darker
else v = ((gray - 160) / 40) * 255;   // Mid → linear
```

**Masalah:** Threshold tetap (160, 200) tidak adaptif. Dokumen scan dengan latar belakang kecokelatan (kertas tua, foto KTP, formulir berwarna) akan menghasilkan banyak noise karena latar belakang tidak terhapus dengan baik.

> [!WARNING]
> Dokumen-dokumen khas Indonesia seperti **KTP, Akta Kelahiran, Ijazah, dan STTB** seringkali berwarna kekuningan/kecokelatan dan memiliki *watermark* latar belakang. Preprocessing fixed-threshold saat ini sangat buruk untuk jenis dokumen ini.

---

### 2. SIMD WebAssembly Core Tidak Dimanfaatkan

File [`tesseract-core-simd-lstm.wasm.js`](file:///c:/laragon/www/pdf/js/lib/tesseract/tesseract-core-simd-lstm.wasm.js) (3.9 MB) sudah ada di folder tapi **tidak pernah dipanggil**. Browser modern (Chrome 91+, Firefox 89+, Edge 91+) mendukung SIMD yang bisa **mempercepat OCR 30-50%**.

```javascript
// Saat ini selalu menggunakan:
corePath: 'tesseract-core-lstm.wasm.js'  // Non-SIMD

// Seharusnya cek:
const useSimd = typeof WebAssembly.validate === 'function' &&
  WebAssembly.validate(new Uint8Array([0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11]));
const corePath = useSimd ? 'tesseract-core-simd-lstm.wasm.js' : 'tesseract-core-lstm.wasm.js';
```

---

### 3. Searchable PDF Hanya Mendukung Latin (StandardFonts.Helvetica)

```javascript
// generateSearchablePdfFromDoc() — baris 669-710
const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
// ...
} catch (drawErr) {
  // Skip unsupported Unicode chars in standard font ← SILENT FAILURE
}
```

**Masalah:** `StandardFonts.Helvetica` tidak memiliki glyph untuk:
- Aksara Jawa / Bali / Sunda (jika ada di dokumen)
- Karakter CJK (Mandarin, Jepang, Korea)
- Huruf Arab, Devanagari, Thai
- Bahkan beberapa karakter Latin Extended (ñ, ü, dll.) bisa bermasalah

Ketika karakter tidak ditemukan, engine **diam-diam melewatinya** (`catch (drawErr) {}`) — user kehilangan kata tanpa peringatan.

---

### 4. Render DPI Tetap (scale = 2.0 = 144 DPI)

```javascript
const scale = options.scale || 2.0; // baris 379
```

DPI 144 cukup untuk teks cetak standar, tapi **kurang** untuk:
- Teks kecil (font 6-8pt) pada formulir resmi
- Stempel / cap basah
- Tulisan tangan di catatan medis

Sebaliknya, DPI 144 **berlebihan** untuk:
- Dokumen A4 sederhana dengan font 12pt
- Menghabiskan memori berlebih untuk file 100+ halaman

---

## 🚀 Rekomendasi Peningkatan

### 🟢 Prioritas 1 — Dampak Tinggi, Effort Rendah

#### 1. Aktifkan SIMD WebAssembly Acceleration

**Effort:** ~15 baris kode | **Impact:** Kecepatan OCR naik 30-50%

Deteksi dukungan SIMD di browser, lalu muat core yang sesuai. Ini adalah peningkatan performa **gratis** karena file WASM SIMD sudah tersedia.

```javascript
// Feature detect SIMD support
function supportsSimd() {
  try {
    return WebAssembly.validate(new Uint8Array([
      0,97,115,109,1,0,0,0,1,5,1,96,0,1,123,
      3,2,1,0,10,10,1,8,0,65,0,253,15,253,98,11
    ]));
  } catch(e) { return false; }
}
const corePath = supportsSimd()
  ? 'tesseract-core-simd-lstm.wasm.js'
  : 'tesseract-core-lstm.wasm.js';
```

---

#### 2. Adaptive Image Preprocessing (Otsu + Morphological Cleanup)

**Effort:** ~80 baris | **Impact:** Akurasi naik signifikan untuk dokumen scan Indonesia

Ganti threshold tetap dengan **Otsu's Binarization** yang menghitung threshold optimal secara otomatis berdasarkan histogram:

```
Sebelum (Fixed):    gray > 200 → white, gray < 160 → dark
Sesudah (Adaptive): threshold = otsu(histogram) → optimal per-image
```

Tambahkan juga **opsi preprocessing** di UI agar user bisa memilih:

| Preset | Algoritma | Use Case |
|--------|-----------|----------|
| 🔄 **Auto (Rekomendasi)** | Otsu binarization + noise removal | Default untuk semua dokumen |
| 📝 **Teks Cetak Standar** | High-contrast binarization | Dokumen Word/PDF digital |
| 📷 **Foto / Scan Kamera HP** | Adaptive threshold + unsharp mask | Foto dokumen dari kamera |
| 🏛️ **Dokumen Resmi (KTP/Akta)** | Background removal + color thresholding | Latar berwarna/watermark |
| ✍️ **Tulisan Tangan** | Gentle thresholding + dilation | Formulir isian tangan |

---

#### 3. Adaptive DPI / Render Scale Berdasarkan Ukuran Teks

**Effort:** ~30 baris | **Impact:** Akurasi naik + hemat memori

```javascript
// Analisis ukuran viewport untuk estimasi kepadatan teks
const pageArea = viewport.width * viewport.height;
let autoScale;
if (pageArea < 200000) autoScale = 3.0;      // Halaman kecil → render tinggi
else if (pageArea < 500000) autoScale = 2.5;  // Standar
else if (pageArea > 1000000) autoScale = 1.5; // Besar → hemat memori
else autoScale = 2.0;
```

Dan tambahkan **slider DPI di UI** agar user bisa override:

```
🔍 Resolusi OCR: [━━━━━●━━━] 200 DPI
   72 DPI ←——→ 400 DPI
   (Lebih tinggi = lebih akurat tapi lebih lambat)
```

---

### 🟡 Prioritas 2 — Dampak Tinggi, Effort Sedang

#### 4. Auto-Rotate & Deskew Detection

Halaman miring atau terbalik 90°/180° menghasilkan akurasi OCR ~0%. Tesseract sebenarnya bisa mendeteksi orientasi:

```javascript
// Setelah recognize, cek orientasi
const osdResult = await worker.detect(canvas); // Orientation & Script Detection
if (osdResult && osdResult.data) {
  const rotation = osdResult.data.orientation_degrees;
  if (rotation !== 0) {
    // Rotate canvas dan re-recognize
    rotateCanvas(canvas, -rotation);
    ocrData = await worker.recognize(canvas);
  }
}
```

UI: Tombol **"🔄 Auto-Rotate & Deskew"** di panel opsi.

---

#### 5. Word Bounding Box Highlight Overlay

**Konsep:** Ketika user hover atau klik kata di textarea, highlight posisi kata tersebut di canvas preview (dan sebaliknya).

```
┌─────────────────────┐  ┌──────────────────────┐
│  [Canvas Preview]   │  │  [Text Result]       │
│                     │  │                       │
│  ┌─────────┐        │  │  The quick brown      │
│  │ "brown" │ ← highlight  │  [fox] jumps over  │
│  └─────────┘        │  │  the lazy dog.        │
└─────────────────────┘  └──────────────────────┘
```

Fitur ini memungkinkan:
- **Verifikasi visual** kata yang sulit dikenali
- **Koreksi manual** langsung di side-by-side view
- **Debugging** area dokumen yang akurasinya rendah

---

#### 6. Confidence Color Heatmap

Warnai setiap kata di canvas berdasarkan skor keyakinan:

| Confidence | Warna | Arti |
|------------|-------|------|
| 90-100% | 🟢 Hijau transparan | Sangat yakin |
| 70-89% | 🟡 Kuning transparan | Cukup yakin |
| 50-69% | 🟠 Oranye transparan | Kurang yakin |
| < 50% | 🔴 Merah transparan | Perlu koreksi manual |

Ditampilkan sebagai tombol toggle: **"🌡️ Show Confidence Heatmap"**

---

#### 7. Custom Font Embedding untuk Searchable PDF

Ganti `StandardFonts.Helvetica` dengan font Unicode embedded (misalnya Noto Sans) agar karakter non-Latin dan Unicode extended tidak hilang di Searchable PDF.

**Pilihan implementasi:**
- Embed subset font Noto Sans Regular (~50 KB) ke dalam pdf-lib
- Atau gunakan `pdfDoc.embedFont(customFontBytes, { subset: true })`

Ini memastikan semua karakter Indonesia (termasuk á, é, ñ, ü, dan simbol khusus) tercakup.

---

### 🔵 Prioritas 3 — Dampak Sedang, Effort Besar

#### 8. Table Detection & Structured Export

**Konsep:** Deteksi baris/kolom tabel dari posisi bounding box kata, lalu rekonstruksi sebagai:
- **Tabel Markdown** (`| Kolom1 | Kolom2 | Kolom3 |`)
- **CSV Export** untuk dibuka di Excel
- **HTML Table Export**

Algoritma dasar:
1. Cluster Y-coordinates bounding box → deteksi baris tabel
2. Cluster X-coordinates → deteksi kolom
3. Cek keseragaman jarak → konfirmasi ini tabel vs paragraf
4. Map kata ke sel (row, col)

---

#### 9. Batch / Multi-File OCR Queue

Tambahkan dukungan **multi-file** seperti halaman Compress:
- Drop banyak file sekaligus
- Queue manager dengan progress per-file
- Download semua hasil sebagai ZIP
- Total summary (total halaman, total kata, rata-rata akurasi)

---

#### 10. OCR dari Viewer (In-Studio OCR)

Sama seperti fitur Compress di `viewer.html`, tambahkan modal **OCR** di viewer agar user bisa:
- Menjalankan OCR pada dokumen yang sedang dibuka
- Melihat teks hasil OCR per-halaman di sidebar
- Menyimpan sebagai Searchable PDF tanpa meninggalkan viewer

---

#### 11. Language Auto-Detection

Deteksi bahasa dokumen secara otomatis dari halaman pertama:
1. OCR halaman 1 dengan model `ind+eng`
2. Analisis kata-kata yang dikenali (common words frequency)
3. Rekomendasikan bahasa yang paling cocok
4. Tampilkan badge: **"🔍 Detected: Bahasa Indonesia (89% confidence)"**

---

#### 12. Export ke DOCX (Word)

Konversi hasil OCR ke format `.docx` dengan mempertahankan:
- Paragraf dan line breaks
- Heading detection (font besar → H1/H2)
- Tabel (jika table detection aktif)

Library: `docx` (npm) bisa di-bundle untuk client-side.

---

## Ringkasan Prioritas Implementasi

| # | Fitur | Impact | Effort | Rekomendasi |
|---|-------|--------|--------|-------------|
| 1 | SIMD WebAssembly Acceleration | ⭐⭐⭐⭐⭐ | 🔧 Sangat Rendah | **Implementasi segera** — file sudah ada |
| 2 | Adaptive Preprocessing (Otsu) | ⭐⭐⭐⭐⭐ | 🔧 Rendah | **Prioritas tinggi** — dampak besar di dokumen Indonesia |
| 3 | Adaptive DPI / Render Scale | ⭐⭐⭐⭐ | 🔧 Rendah | **Quick win** — config + UI slider |
| 4 | Auto-Rotate & Deskew | ⭐⭐⭐⭐ | 🔧🔧 Sedang | Penting untuk scan kamera HP |
| 5 | Word Highlight Overlay | ⭐⭐⭐⭐ | 🔧🔧 Sedang | UX premium, verifikasi visual |
| 6 | Confidence Heatmap | ⭐⭐⭐ | 🔧🔧 Sedang | Debugging & koreksi visual |
| 7 | Custom Font Embedding | ⭐⭐⭐⭐ | 🔧🔧 Sedang | Memperbaiki bug Unicode di Searchable PDF |
| 8 | Table Detection | ⭐⭐⭐⭐ | 🔧🔧🔧 Tinggi | Fitur premium — tabel ke CSV/Excel |
| 9 | Batch Multi-File OCR | ⭐⭐⭐ | 🔧🔧 Sedang | UX improvement |
| 10 | In-Studio OCR (Viewer) | ⭐⭐⭐ | 🔧🔧 Sedang | Integrasi viewer |
| 11 | Language Auto-Detection | ⭐⭐ | 🔧🔧 Sedang | Nice to have |
| 12 | Export ke DOCX | ⭐⭐⭐ | 🔧🔧🔧 Tinggi | Fitur enterprise |

---

> [!TIP]
> **Rekomendasi urutan implementasi:**
> **Fase 1** → #1 (SIMD Acceleration) + #2 (Adaptive Preprocessing) + #3 (Adaptive DPI)
> **Fase 2** → #4 (Auto-Rotate) + #5 (Word Highlight) + #7 (Custom Font)
> **Fase 3** → #6 (Heatmap) + #9 (Batch OCR) + #10 (In-Studio OCR)
> **Fase 4** → #8 (Table Detection) + #11 (Language Auto-Detect) + #12 (DOCX Export)

---

## Catatan Kritis untuk Konteks Indonesia 🇮🇩

> [!IMPORTANT]
> **Dokumen-dokumen yang paling sering di-OCR oleh pengguna Indonesia:**
> 1. **Scan KTP / KK** — background berwarna biru/hijau, huruf kecil, watermark Garuda
> 2. **Ijazah / STTB** — kertas kuning/cokelat, teks formal, stempel basah
> 3. **Akta Kelahiran** — format tabel, background pola, teks mesin ketik
> 4. **Surat Keputusan (SK)** — kop surat, nomor surat panjang, tanda tangan basah
> 5. **Faktur / Invoice** — tabel angka, banyak kolom, teks kecil
>
> Fitur **#2 (Adaptive Preprocessing)** dan **#4 (Auto-Rotate)** adalah yang paling berdampak untuk jenis dokumen ini.
