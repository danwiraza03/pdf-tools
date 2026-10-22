# 📋 RPD UPDATING — PDF Studio Pro
### Rencana Pengembangan Detail (RPD) & Roadmap Perbaikan
**Project Manager:** AI PM — PDF Studio Pro  
**Tanggal:** 27 Agustus 2026  
**Versi:** v2.0 — Major Stabilization & Optimization Update  
**Platform:** Electron (Windows 10/11) + Browser-based  
**Status:** 🔴 CRITICAL — Membutuhkan Perbaikan Segera

---

## 📊 EXECUTIVE SUMMARY

PDF Studio Pro adalah aplikasi desktop PDF offline berbasis Electron yang memiliki **13 halaman tools** dan **27 engine module** di folder `js/editor/`. Berdasarkan analisis mendalam terhadap seluruh codebase, ditemukan **2 bug kritis** yang dilaporkan pengguna dan **14 area optimasi** yang perlu ditangani.

### 🔴 Bug Kritis yang Dilaporkan
| # | Bug | Severity | File Terdampak |
|---|-----|----------|----------------|
| 1 | **Edit & Add Text di PDF Viewer belum sempurna** — text editing overlay tidak presisi, font mismatch, baseline drift, dan text baru tidak ter-render dengan benar | 🔴 CRITICAL | `pages/viewer.html`, `js/editor/text-edit-engine.js`, `js/editor/pdf-text-extractor.js`, `js/core/pdf-studio.js` |
| 2 | **PDF dengan Signature tidak bisa di-Combine/Merge** — merge gagal atau crash saat memproses PDF yang mengandung digital signature | 🔴 CRITICAL | `js/core/pdf-merge.js`, `js/core/pdf-compress.js` (`removeDigitalSignatures`), `js/editor/signature-inspector.js` |

---

## 🏗️ ARSITEKTUR PROGRAM — ANALISIS LENGKAP

### A. Struktur Direktori
```
pdf/
├── index.html                    ← Home Page (Landing)
├── main.js                       ← Electron Main Process
├── preload.js                    ← Context Bridge (IPC)
├── package.json                  ← Electron + Dependencies
├── css/
│   ├── style.css                 ← Global Design System (22KB)
│   ├── home.css                  ← Home Page Styles (6KB)
│   └── tool.css                  ← Tool Pages Styles (16KB)
├── pages/
│   ├── viewer.html               ← 🔥 PDF Studio Pro (216KB, 5383 lines) — MONOLITH
│   ├── merge.html                ← Merge PDF (21KB)
│   ├── compress.html             ← Compress PDF (22KB)
│   ├── split.html                ← Split PDF (12KB)
│   ├── ocr.html                  ← OCR PDF (24KB)
│   ├── rotate.html               ← Rotate PDF
│   ├── remove-pages.html         ← Remove Pages
│   ├── reorder.html              ← Reorder Pages
│   ├── jpg-to-pdf.html           ← JPG to PDF
│   ├── pdf-to-jpg.html           ← PDF to JPG
│   ├── watermark.html            ← Watermark PDF
│   ├── protect.html              ← Protect & Unlock
│   └── page-number.html          ← Page Numbers
├── js/
│   ├── app.js                    ← Global App Init
│   ├── components/
│   │   ├── dropzone.js           ← File Drop Zone
│   │   ├── file-list.js          ← File List Component
│   │   ├── pdf-preview.js        ← PDF Preview Thumbnails
│   │   ├── progress.js           ← Progress Bar
│   │   └── toast.js              ← Toast Notifications
│   ├── core/
│   │   ├── pdf-studio.js         ← 🔥 Studio Core Engine (28KB, 732 lines)
│   │   ├── pdf-merge.js          ← 🔥 Merge Engine (4.5KB)
│   │   ├── pdf-compress.js       ← 🔥 Compress + Signature Removal (20KB)
│   │   ├── pdf-stream-engine.js  ← PDF Content Stream Manipulator (6KB)
│   │   ├── pdf-ocr.js            ← OCR Engine (17KB)
│   │   ├── pdf-split.js          ← Split Engine
│   │   ├── pdf-rotate.js         ← Rotate Engine
│   │   ├── pdf-remove.js         ← Page Removal
│   │   ├── pdf-reorder.js        ← Page Reorder
│   │   ├── pdf-watermark.js      ← Watermark Engine
│   │   ├── pdf-protect.js        ← Encryption/Decryption
│   │   ├── pdf-page-number.js    ← Page Numbering
│   │   ├── pdf-to-jpg.js         ← PDF to Image
│   │   └── jpg-to-pdf.js         ← Image to PDF
│   ├── editor/                   ← 🔥 27 ENGINE MODULES
│   │   ├── text-edit-engine.js   ← 🔴 LINE-LEVEL TEXT EDITING (8.4KB)
│   │   ├── text-block-detector.js ← Text Block Grouper (4.6KB)
│   │   ├── pdf-text-extractor.js ← PDF.js Text Run Extractor (3.4KB)
│   │   ├── text-model.js         ← TextRun/Line/Para/Block Models
│   │   ├── text-fit-engine.js    ← Text Fitting Calculator
│   │   ├── text-extractor.js     ← Alternative Text Extractor
│   │   ├── paragraph-engine.js   ← Paragraph Reflow Engine (4.7KB)
│   │   ├── font-normalizer.js    ← PostScript Font Name Parser
│   │   ├── font-intelligence.js  ← Point-based Font Inference
│   │   ├── font-resolver.js      ← PDF-Lib Font Resolver
│   │   ├── font-registry.js      ← Font Registry
│   │   ├── font-engine.js        ← Font Embedding Engine
│   │   ├── background-sampler.js ← Background Color Sampler
│   │   ├── annotation-engine.js  ← Annotation Engine
│   │   ├── command-manager.js    ← Undo/Redo Command Stack
│   │   ├── signature-inspector.js← 🔴 DIGITAL SIGNATURE DETECTOR
│   │   ├── image-edit-engine.js  ← Image Edit (Move/Replace/Delete)
│   │   ├── image-extractor.js    ← PDF Image Extractor
│   │   ├── security-engine.js    ← Security Analysis
│   │   ├── comments-engine.js    ← Sticky Notes & Comments
│   │   ├── compare-engine.js     ← Document Compare
│   │   ├── form-engine.js        ← AcroForm Builder
│   │   ├── page-tools-engine.js  ← Header/Footer/Bates
│   │   ├── redaction-engine.js   ← Redaction Engine
│   │   ├── accessibility-engine.js← PDF/UA Accessibility
│   │   ├── ocr-layout-engine.js  ← OCR Layout Detection
│   │   └── pdf-coordinate-engine.js← Coordinate Transform
│   ├── utils/
│   │   ├── download.js           ← FileSaver Wrapper
│   │   ├── file-utils.js         ← File Reader Utilities
│   │   └── i18n.js               ← Internationalization (ID/EN)
│   └── lib/                      ← Third-party Libraries
│       ├── pdf-lib.min.js        ← PDF-Lib (525KB) — PDF Creation/Modification
│       ├── pdf.min.js            ← PDF.js (320KB) — PDF Rendering
│       ├── pdf.worker.min.js     ← PDF.js Worker (1MB)
│       ├── jszip.min.js          ← JSZip (98KB)
│       ├── FileSaver.min.js      ← FileSaver
│       ├── Sortable.min.js       ← SortableJS
│       └── tesseract/            ← Tesseract.js OCR
└── assets/
    ├── fonts/                    ← Custom Fonts
    └── icons/                    ← App Icons
```

### B. Dependency Chain (Library)
| Library | Version | Fungsi | Size |
|---------|---------|--------|------|
| **PDF.js** (`pdf.min.js`) | ~4.x | Rendering PDF ke Canvas | 320KB + 1MB worker |
| **PDF-Lib** (`pdf-lib.min.js`) | ~1.17 | Membuat/Memodifikasi PDF | 525KB |
| **JSZip** | ~3.x | ZIP compression + PDF stream inflate/deflate | 98KB |
| **Tesseract.js** | 7.0 | OCR engine (offline) | npm module |
| **SortableJS** | ~1.x | Drag & drop reorder | 44KB |
| **FileSaver** | ~2.x | Client-side file download | 3KB |
| **Electron** | 31.3.1 | Desktop shell | devDep |

---

## 🔴 PERBAIKAN #1: TEXT EDITING & ADD TEXT BELUM SEMPURNA

### 1.1 Root Cause Analysis

#### Problem A: Edit Existing Text — Overlay Tidak Presisi

**File terdampak:** [`text-edit-engine.js`](file:///d:/coding/pdf/js/editor/text-edit-engine.js), [`pdf-text-extractor.js`](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js)

**Masalah detail:**
1. **Baseline Drift** — Di [`pdf-text-extractor.js` L37-38](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js#L37-L38), konversi `viewport.convertToViewportPoint()` menghasilkan `baselineScreenY` yang dikurangi `fontSize * 0.82` sebagai `screenY`. Faktor `0.82` ini adalah magic number yang tidak akurat untuk semua font — menyebabkan overlay text bergeser vertikal terutama pada font besar atau font non-Latin.

2. **Width Estimation Salah** — Di [`pdf-text-extractor.js` L39](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js#L39), width fallback `fontSize * item.str.length * 0.55` sangat tidak akurat untuk font proportional — huruf "W" dan "i" dianggap lebar yang sama.

3. **Font Size dari Transform Matrix Tidak Tepat** — Di [`pdf-text-extractor.js` L30](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js#L30), `Math.abs(scaleY)` diambil sebagai fontSize. Ini benar untuk case sederhana, tapi gagal untuk font yang di-transform (rotated text, skewed text).

4. **Text Edit Overlay Styling Mismatch** — Di [`text-edit-engine.js` L92-94](file:///d:/coding/pdf/js/editor/text-edit-engine.js#L92-L94), unedited line menggunakan `fontSize: '0px'` dan `color: transparent`. Ini menyebabkan hitbox yang tidak terlihat dan tidak bisa di-klik dengan presisi karena browser tidak bisa menghitung bounding box element dengan font size 0.

5. **Color Extraction Hardcoded** — Di [`pdf-text-extractor.js` L75](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js#L75), color selalu `'#111827'` (hardcoded dark gray). PDF.js text content items tidak expose color secara langsung di `getTextContent()` — perlu alternatif.

#### Problem B: Add New Text — Placement & Export Inaccurate

**File terdampak:** [`viewer.html` L3392-3426](file:///d:/coding/pdf/pages/viewer.html#L3392-L3426), [`pdf-studio.js` L527-571](file:///d:/coding/pdf/js/core/pdf-studio.js#L527-L571)

**Masalah detail:**
1. **Y-Coordinate Offset saat Place** — Di [`viewer.html` L3412](file:///d:/coding/pdf/pages/viewer.html#L3412), `y: clickY - (inferredStyle.size * 0.8)` menggunakan offset yang menyebabkan text tidak muncul tepat di titik klik.

2. **headerOffsetY Complexity** — Properti `headerOffsetY` di text items (diset ke `1` pada awal, `0` setelah commit) menambahkan kompleksitas yang tidak perlu dan menyebabkan jitter posisi saat commit.

3. **Export Position Mismatch** — Di [`pdf-studio.js` L537-539](file:///d:/coding/pdf/js/core/pdf-studio.js#L537-L539), kalkulasi `textY` menggunakan formula:
   ```js
   const actualScreenY = textItem.y + headerOffsetY + 4;
   const textY = pdfHeight - ((actualScreenY + (textItem.fontSize || 14) * 0.8) * scaleY);
   ```
   Magic numbers `+ 4` dan `* 0.8` menyebabkan posisi di PDF output berbeda dari yang terlihat di layar.

4. **Double-click menambah text tanpa mode check** — Di [`viewer.html` L3452-3476](file:///d:/coding/pdf/pages/viewer.html#L3452-L3476), double-click pada annotation canvas selalu menambah text baru tanpa mengecek apakah user sedang dalam mode 'text'. Ini menyebabkan text tidak sengaja terbuat.

### 1.2 Rencana Perbaikan Text Edit & Add Text

#### PHASE 1: Fix Text Extractor Accuracy
**Target file:** [`js/editor/pdf-text-extractor.js`](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js)

```
Perubahan yang diperlukan:
1. [L30] Perbaiki fontSize extraction — gunakan Math.hypot(transform[2], transform[3]) 
   untuk menangani rotated/skewed text
2. [L37-38] Perbaiki Y coordinate — gunakan baseline Y langsung dari viewport 
   tanpa magic number 0.82, dan hitung offset berdasarkan font ascent ratio
3. [L39] Perbaiki width estimation — gunakan canvas measureText() untuk 
   proportional width measurement
4. [L75] Coba extract warna dari PDF.js operator list jika tersedia, 
   fallback ke sampling background-aware color detection
```

#### PHASE 2: Fix Text Edit Engine Overlay
**Target file:** [`js/editor/text-edit-engine.js`](file:///d:/coding/pdf/js/editor/text-edit-engine.js)

```
Perubahan yang diperlukan:
1. [L92-94] Ganti fontSize: '0px' dengan fontSize yang sebenarnya (scaled) 
   tapi opacity: 0 — agar hitbox tetap bisa di-klik dengan presisi
2. [L43-53] Refine bounding box calculation — tambahkan padding tolerance 
   untuk menghindari teks terpotong
3. [L126-148] Saat masuk edit mode, ambil computed style dari overlay 
   yang sudah ter-match, bukan hardcode defaults
4. [L54] Color extraction — gunakan warna dari run data, bukan fallback
```

#### PHASE 3: Fix Add Text Placement & Export
**Target file:** [`pages/viewer.html`](file:///d:/coding/pdf/pages/viewer.html), [`js/core/pdf-studio.js`](file:///d:/coding/pdf/js/core/pdf-studio.js)

```
Perubahan yang diperlukan:
1. [viewer.html L3412] Hapus offset "- (inferredStyle.size * 0.8)" — 
   gunakan clickY langsung sebagai top of text box
2. [viewer.html L3418] Hapus headerOffsetY: 1 — selalu gunakan 0 
   (direct positioning tanpa offset)
3. [viewer.html L3452-3476] Tambahkan guard: hanya buat text pada 
   double-click jika activeMode === 'text' || activeMode === 'edit'
4. [pdf-studio.js L531-539] Simplifikasi export formula:
   - Hapus headerOffsetY dari kalkulasi
   - Hapus magic number +4 dan *0.8
   - Gunakan formula konsisten: textY = pdfHeight - ((textItem.y + fontSize) * scaleY)
5. [pdf-studio.js L536] Hapus padding +6 pada textX atau sesuaikan 
   agar konsisten dengan visual rendering
```

#### PHASE 4: Fix Commit & State Management
**Target file:** [`pages/viewer.html`](file:///d:/coding/pdf/pages/viewer.html)

```
Perubahan yang diperlukan:
1. [L3234-3252] commitTextInPlace() — jangan cek "Type text here..." 
   sebagai empty indicator, gunakan flag isPlaceholder pada textItem
2. [L3254-3269] finishTextEditing() — jangan cek "New text", 
   gunakan timestamp-based check apakah user pernah mengetik
3. Saat zoom berubah, re-render semua committed text widgets 
   dengan scale yang baru (saat ini font size * currentScale 
   bisa mismatch setelah zoom)
```

---

## 🔴 PERBAIKAN #2: PDF DENGAN SIGNATURE TIDAK BISA DI-COMBINE/MERGE

### 2.1 Root Cause Analysis

**File terdampak:** [`js/core/pdf-merge.js`](file:///d:/coding/pdf/js/core/pdf-merge.js), [`js/core/pdf-compress.js`](file:///d:/coding/pdf/js/core/pdf-compress.js#L65-L191), [`js/editor/signature-inspector.js`](file:///d:/coding/pdf/js/editor/signature-inspector.js)

**Masalah detail:**

1. **`removeDigitalSignatures()` Throw pada Edge Cases** — Di [`pdf-compress.js` L65-191](file:///d:/coding/pdf/js/core/pdf-compress.js#L65-L191), fungsi `removeDigitalSignatures` melakukan iterasi pada annotations dan AcroForm fields. Namun:
   - [L94] Perbandingan `subtype === PDFName.of('Widget')` menggunakan strict equality (`===`) pada object reference. `PDFName.of()` mungkin mengembalikan instance baru setiap kali dipanggil, sehingga perbandingan `===` selalu `false`. Ini menyebabkan signature widgets tidak terdeteksi dan tidak di-strip.
   - [L100] Sama: `ft === PDFName.of('Sig')` — perbandingan object identity, bukan string equality.
   - [L167] Nested loop pada Fields array juga menggunakan `PDFName.of('Sig')` identity check yang sama.

2. **Catch Block Terlalu Silent** — Di [`pdf-merge.js` L57-59](file:///d:/coding/pdf/js/core/pdf-merge.js#L57-L59):
   ```js
   } catch (sigErr) {
     console.warn(`Merge: Signature removal warning...`);
   }
   ```
   Error dari `removeDigitalSignatures` di-suppress sebagai warning. Jika fungsi throw error karena PDF structure yang unexpected (e.g., encrypted signature dict, malformed AcroForm), merge melanjutkan TANPA stripping signature → PDF-Lib akan crash saat `copyPages()` karena signature ByteRange references invalid.

3. **`copyPages()` Crash pada Signature ByteRange** — PDF-Lib `copyPages()` mencoba copy seluruh page tree termasuk annotation references. Jika signature annotation masih mengarah ke `/V` (value) dict yang mengandung `/ByteRange` offset ke raw PDF bytes, offset ini menjadi invalid di dokumen baru → crash atau corrupted output.

4. **`ignoreEncryption: true` Tidak Cukup** — Di [`pdf-merge.js` L45](file:///d:/coding/pdf/js/core/pdf-merge.js#L45), `PDFDocument.load(arrayBuffer, { ignoreEncryption: true })` akan skip decryption. Namun untuk PDF yang di-sign dengan DocMDP permission restrictions, beberapa objects mungkin tidak accessible → throw.

5. **SignatureInspector.inspect() Scan Limit** — Di [`signature-inspector.js` L16](file:///d:/coding/pdf/js/editor/signature-inspector.js#L16), hanya scan 500KB pertama: `bytes.slice(0, Math.min(bytes.length, 500000))`. Untuk PDF besar, signature dictionaries bisa berada di luar range ini → miss detection.

### 2.2 Rencana Perbaikan Signed PDF Combine

#### PHASE 1: Fix PDFName Comparison (ROOT CAUSE)
**Target file:** [`js/core/pdf-compress.js`](file:///d:/coding/pdf/js/core/pdf-compress.js)

```
Perubahan yang diperlukan:
1. [L94] Ganti perbandingan identity:
   SEBELUM: subtype === PDFName.of('Widget')
   SESUDAH: subtype?.toString() === '/Widget' 
            ATAU subtype?.encodedName === PDFName.of('Widget').encodedName
   
2. [L100] Ganti:
   SEBELUM: ft === PDFName.of('Sig')
   SESUDAH: ft?.toString() === '/Sig'

3. [L167] Ganti di dalam loop Fields cleanup:
   SEBELUM: ft === PDFName.of('Sig')  
   SESUDAH: ft?.toString() === '/Sig'

4. Tambahkan fallback detection: scan annotation dict secara langsung 
   untuk key /ByteRange dan /SubFilter sebagai indikator signature
```

#### PHASE 2: Improve Error Recovery in Merge
**Target file:** [`js/core/pdf-merge.js`](file:///d:/coding/pdf/js/core/pdf-merge.js)

```
Perubahan yang diperlukan:
1. [L48-59] Wrap signature removal dalam retry logic:
   - Attempt 1: removeDigitalSignatures() normal
   - Attempt 2: Jika gagal, reload PDF tanpa signature, flatten to image-based PDF
   
2. [L45] Tambahkan option { updateMetadata: false } pada PDFDocument.load()
   untuk menghindari metadata parsing error

3. [L78, L101] Wrap copyPages() dalam try-catch individual per page:
   - Jika page copy gagal, render page ke canvas → embed sebagai image page
   - Ini menjamin merge SELALU berhasil meski dengan degraded quality untuk 
     halaman bermasalah

4. Tambahkan pre-check sebelum merge:
   - Scan semua file dengan SignatureInspector.inspect()
   - Jika ada signed PDF, tampilkan warning banner di UI 
     (bukan hanya console.warn)
```

#### PHASE 3: Improve Signature Inspector
**Target file:** [`js/editor/signature-inspector.js`](file:///d:/coding/pdf/js/editor/signature-inspector.js)

```
Perubahan yang diperlukan:
1. [L16] Naikkan scan limit dari 500KB ke seluruh file:
   SEBELUM: bytes.slice(0, Math.min(bytes.length, 500000))
   SESUDAH: bytes (full scan) — dengan optimasi: scan backwards 
            dari xref table untuk efisiensi

2. Tambahkan method: inspectWithPdfLib(pdfDoc) yang menggunakan 
   PDF-Lib object model untuk deteksi akurat (bukan regex pada raw bytes)

3. Tambahkan detection untuk:
   - /DocMDP permission level (1, 2, 3)
   - /UR3 usage rights signatures
   - /SubFilter: adbe.pkcs7.detached, ETSI.CAdES.detached
   - Timestamp signatures

4. Return structured result:
   {
     hasSignatures: boolean,
     count: number,
     types: ['approval' | 'certification' | 'timestamp' | 'usage_rights'],
     permissionLevel: 1 | 2 | 3 | null,
     canModify: boolean,
     status: string,
     warning: string
   }
```

#### PHASE 4: UI Warning for Merge Page
**Target file:** [`pages/merge.html`](file:///d:/coding/pdf/pages/merge.html)

```
Perubahan yang diperlukan:
1. Setelah file di-drop, scan setiap file untuk signatures
2. Jika ditemukan signed PDF, tampilkan warning banner:
   "⚠️ File [filename] mengandung digital signature. 
    Signature akan di-strip saat merge. Visual stamp tetap dipertahankan."
3. Tambahkan info di result area jika merge berhasil:
   "ℹ️ X signature(s) dari Y file(s) telah di-embed sebagai stamp visual."
```

---

## 🟡 STABILISASI KODE

### 3.1 Viewer.html — Decomposition Required

**Problem:** [`viewer.html`](file:///d:/coding/pdf/pages/viewer.html) adalah **monolith 5383 baris / 216KB**. Ini menyebabkan:
- Sulit di-maintain dan di-debug
- Setiap perubahan kecil berisiko merusak fitur lain
- Tidak bisa di-test secara modular

**Rencana (Future Sprint):**
```
Refactor viewer.html menjadi modular:
├── viewer.html              ← Layout/HTML only (~500 lines)
├── viewer-controller.js     ← Main controller & state
├── viewer-toolbar.js        ← Toolbar & menu event handlers
├── viewer-page-render.js    ← Page rendering & zoom
├── viewer-annotation.js     ← Canvas annotation layer
├── viewer-text-widgets.js   ← Text box placement & commit
├── viewer-stamp-widgets.js  ← Image/signature placement
├── viewer-sidebar.js        ← Thumbnail sidebar
├── viewer-modals.js         ← All modal dialogs
└── viewer-shortcuts.js      ← Keyboard shortcuts
```

> **CATATAN:** Refactoring ini BUKAN prioritas saat ini. Fokus dulu pada bug fix #1 dan #2.

### 3.2 Error Handling Gaps

| Lokasi | Masalah | Solusi |
|--------|---------|-------|
| [`pdf-merge.js` L57](file:///d:/coding/pdf/js/core/pdf-merge.js#L57) | Signature error di-suppress tanpa feedback ke user | Tampilkan warning di UI |
| [`pdf-studio.js` L247-252](file:///d:/coding/pdf/js/core/pdf-studio.js#L247-L252) | Export signature unlock failure di-suppress | Log dan notify user |
| [`pdf-stream-engine.js` L157](file:///d:/coding/pdf/js/core/pdf-stream-engine.js#L157) | Stream stripping failure silent | Return success/failure status |
| [`text-edit-engine.js`](file:///d:/coding/pdf/js/editor/text-edit-engine.js) | Tidak ada error boundary pada DOM manipulation | Wrap dalam try-catch |
| [`viewer.html` L2602-2605](file:///d:/coding/pdf/pages/viewer.html#L2602-L2605) | openDocument error generic | Berikan detail spesifik (encrypted, corrupted, unsupported) |

### 3.3 Memory Management

| Lokasi | Masalah | Solusi |
|--------|---------|-------|
| [`pdf-merge.js` L36-63](file:///d:/coding/pdf/js/core/pdf-merge.js#L36-L63) | `docCache` Map tidak pernah di-clear setelah merge selesai | Clear cache setelah `mergedPdf.save()` |
| [`pdf-studio.js` L260](file:///d:/coding/pdf/js/core/pdf-studio.js#L260) | `embeddedImagesCache` Map tidak di-clear | Clear setelah export |
| [`pdf-compress.js` L370-403](file:///d:/coding/pdf/js/core/pdf-compress.js#L370-L403) | Canvas per page dibuat tapi hanya di-shrink (width=1, height=1), bukan di-remove | Set canvas reference ke null |
| [`viewer.html` thumbnails](file:///d:/coding/pdf/pages/viewer.html) | Semua thumbnail canvas hidup di memory | Virtualize — hanya render visible thumbnails |

---

## 🟢 OPTIMALISASI

### 4.1 Performance Optimization

| Area | Current State | Target | Approach |
|------|--------------|--------|----------|
| **Text extraction** | Full page extraction setiap kali masuk edit mode | Cache per page | Add `textRunCache` Map di StudioDoc |
| **Thumbnail rendering** | Render semua thumbnail saat load | Lazy render | Intersection Observer API |
| **PDF.js worker** | Single worker | Keep alive & reuse | Persist worker reference |
| **Zoom re-render** | Full re-render + re-extract text | Incremental | CSS transform untuk quick zoom, re-render debounced |
| **Annotation redraw** | Full clear + redraw semua | Dirty region | Only redraw changed annotations |

### 4.2 UX Optimization

| Area | Current State | Target |
|------|--------------|--------|
| **Font matching** | 3 fonts (Helvetica, Times, Courier) | 10+ standard PDF fonts via font-resolver.js |
| **Text editing UX** | Click → type → blur to commit | Click → type → Enter to commit, Esc to cancel (already works) |
| **Undo/Redo** | Basic undo stack, no redo | Full undo/redo with Ctrl+Y |
| **Zoom controls** | Dropdown only | Pinch-to-zoom + scroll wheel + fit-to-page/fit-to-width |
| **Save feedback** | Toast only | Progress bar + file size info |
| **Merge UX** | No signature warning | Pre-merge scan + visual warning |

### 4.3 Code Quality

| Area | Action |
|------|--------|
| **Console.log cleanup** | Remove debug console.log dari production code (`pdf-compress.js` memiliki 8+ console.log) |
| **Magic numbers** | Extract ke named constants (0.82 baseline ratio, 0.55 width ratio, etc.) |
| **Dead code** | Identifikasi dan hapus fungsi yang tidak digunakan |
| **JSDoc completion** | Lengkapi JSDoc untuk semua public methods di engine files |

---

## 📅 SPRINT PLAN

### Sprint 1: 🔴 CRITICAL BUG FIXES (Minggu 1)

| Task | File Target | Priority |
|------|------------|----------|
| Fix PDFName comparison di removeDigitalSignatures | `js/core/pdf-compress.js` L94, L100, L167 | P0 |
| Fix merge error recovery untuk signed PDFs | `js/core/pdf-merge.js` | P0 |
| Fix text extractor baseline & width | `js/editor/pdf-text-extractor.js` | P0 |
| Fix text edit overlay hitbox | `js/editor/text-edit-engine.js` | P0 |
| Fix add text Y-coordinate offset | `pages/viewer.html` L3412 | P0 |
| Fix export text position formula | `js/core/pdf-studio.js` L531-539 | P0 |
| Fix double-click guard | `pages/viewer.html` L3452 | P1 |

### Sprint 2: 🟡 STABILIZATION (Minggu 2)

| Task | File Target | Priority |
|------|------------|----------|
| Improve signature inspector coverage | `js/editor/signature-inspector.js` | P1 |
| Add merge UI warning for signed PDFs | `pages/merge.html` | P1 |
| Fix memory leaks (docCache, imageCache) | Multiple files | P1 |
| Add error boundaries to DOM manipulation | `js/editor/text-edit-engine.js` | P1 |
| Fix headerOffsetY elimination | `pages/viewer.html` + `js/core/pdf-studio.js` | P2 |

### Sprint 3: 🟢 OPTIMIZATION (Minggu 3-4)

| Task | File Target | Priority |
|------|------------|----------|
| Cache text runs per page | `pages/viewer.html` + extractor | P2 |
| Lazy thumbnail rendering | `pages/viewer.html` sidebar | P2 |
| Clean up console.log statements | All core/ and editor/ files | P3 |
| Extract magic numbers to constants | `js/editor/pdf-text-extractor.js` | P3 |
| Add Ctrl+Y redo support | `pages/viewer.html` | P3 |

---

## 🔧 INSTRUKSI UNTUK AGENT DEVELOPER

### Untuk mengerjakan Bug Fix #1 (Text Edit & Add Text):

1. **Buka dan modifikasi** [`js/editor/pdf-text-extractor.js`](file:///d:/coding/pdf/js/editor/pdf-text-extractor.js):
   - Line 30: Ganti `Math.abs(scaleY)` dengan `Math.hypot(transform[2], transform[3])` untuk font size
   - Line 37-38: Gunakan `baselineScreenY` langsung, kurangi dengan `fontSize * descentRatio` (bukan 0.82)
   - Line 39: Gunakan `ParagraphEngine.measureText(item.str, fontSize, fontFamily)` jika tersedia

2. **Buka dan modifikasi** [`js/editor/text-edit-engine.js`](file:///d:/coding/pdf/js/editor/text-edit-engine.js):
   - Line 92-94: Ganti `fontSize: '0px'` dengan:
     ```js
     target.style.fontSize = `${fontSize * scale}px`;
     target.style.opacity = '0';
     ```
   - Tambahkan `target.style.pointerEvents = 'auto'` (sudah ada, pastikan tetap)

3. **Buka dan modifikasi** [`pages/viewer.html`](file:///d:/coding/pdf/pages/viewer.html):
   - Line 3412: Ganti `y: clickY - (inferredStyle.size * 0.8)` dengan `y: clickY`
   - Line 3418: Ganti `headerOffsetY: 1` dengan `headerOffsetY: 0`
   - Line 3452-3476: Wrap double-click handler dalam `if (activeMode === 'text' || activeMode === 'edit')`
   - Line 3469: Ganti `headerOffsetY: 1` dengan `headerOffsetY: 0`

4. **Buka dan modifikasi** [`js/core/pdf-studio.js`](file:///d:/coding/pdf/js/core/pdf-studio.js):
   - Line 531-539: Simplifikasi formula posisi text baking:
     ```js
     const textX = textItem.x * scaleX;
     const textY = pdfHeight - ((textItem.y + (textItem.fontSize || 14)) * scaleY);
     ```

### Untuk mengerjakan Bug Fix #2 (Signed PDF Combine):

1. **Buka dan modifikasi** [`js/core/pdf-compress.js`](file:///d:/coding/pdf/js/core/pdf-compress.js):
   - Line 94: Ganti `subtype === PDFName.of('Widget')` dengan:
     ```js
     (subtype instanceof PDFName && subtype.asString() === '/Widget')
     ```
     Atau jika `asString()` tidak tersedia:
     ```js
     (subtype instanceof PDFName && subtype.toString().includes('/Widget'))
     ```
   - Line 100: Sama, ganti ke string comparison untuk `'/Sig'`
   - Line 167: Sama, ganti ke string comparison untuk `'/Sig'`

2. **Buka dan modifikasi** [`js/core/pdf-merge.js`](file:///d:/coding/pdf/js/core/pdf-merge.js):
   - Line 48-59: Perkuat error handling:
     ```js
     try {
       if (PDFTools.Compress && PDFTools.Compress.removeDigitalSignatures) {
         const sigResult = await PDFTools.Compress.removeDigitalSignatures(pdf, arrayBuffer);
         if (sigResult.removed) {
           hadSignatures = true;
           sigFileCount++;
         }
       }
     } catch (sigErr) {
       console.warn(`Merge: Signature removal failed for "${file.name}":`, sigErr);
       // Fallback: reload without signature processing
       try {
         docCache.delete(cacheKey);
         const freshPdf = await PDFDocument.load(arrayBuffer, { 
           ignoreEncryption: true,
           updateMetadata: false 
         });
         docCache.set(cacheKey, freshPdf);
         return freshPdf;
       } catch (reloadErr) {
         throw new Error(`Cannot process "${file.name}": ${reloadErr.message}`);
       }
     }
     ```

3. **Buka dan modifikasi** [`js/editor/signature-inspector.js`](file:///d:/coding/pdf/js/editor/signature-inspector.js):
   - Line 16: Hapus `.slice(0, Math.min(bytes.length, 500000))` — scan full document
   - Tambahkan method `inspectPdfLib(pdfDoc)` sebagai secondary detection

---

## 📊 METRICS & VALIDATION

### Acceptance Criteria Bug Fix #1:
- [ ] Edit existing text → font, size, color match original
- [ ] Edit existing text → no vertical drift (baseline stays)
- [ ] Edit existing text → neighboring text untouched
- [ ] Add new text → appears exactly at click point
- [ ] Add new text → exported PDF shows text at correct position
- [ ] Double-click hanya membuat text di mode 'text' atau 'edit'
- [ ] Zoom in/out → text overlays tetap aligned

### Acceptance Criteria Bug Fix #2:
- [ ] Merge 2+ PDF di mana salah satunya memiliki digital signature → **BERHASIL**
- [ ] Visual stamp/materai tetap terlihat di merged PDF
- [ ] Merge 2+ PDF tanpa signature → tetap bekerja normal
- [ ] Merge mixed (signed + unsigned) → berhasil
- [ ] UI menampilkan warning saat file bertanda tangan terdeteksi
- [ ] Result menampilkan info jumlah signature yang di-strip

---

## 📝 CATATAN PENTING UNTUK SEMUA AGENT

1. **JANGAN** ubah file yang tidak disebutkan dalam RPD ini tanpa konfirmasi PM
2. **JANGAN** refactor viewer.html menjadi modular — itu Sprint terpisah
3. **JANGAN** upgrade library (pdf-lib, pdf.js) — potensi breaking changes
4. **SELALU** test dengan PDF yang memiliki:
   - Digital signature (e-sign, e-materai)
   - Multiple fonts (Arial, Times, Calibri mixed)
   - Images embedded dalam page
   - Form fields
   - Encrypted/password-protected
5. **PRESERVE** semua comment dan docstring yang ada
6. **LOG** setiap perubahan yang dibuat di console dengan prefix `[FIX]`

---

*Dokumen ini disusun oleh AI Project Manager setelah analisis mendalam terhadap seluruh 60+ file dalam codebase PDF Studio Pro. Setiap instruksi merujuk pada file path dan line number yang spesifik agar agent developer bisa langsung bekerja tanpa ambiguitas.*
