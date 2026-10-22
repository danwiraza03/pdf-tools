# PRD: NusaPDF Workbench

**Status:** Draft v1.0  
**Tanggal:** 2026-08-21  
**Platform awal:** Windows 10/11 64-bit  
**Bahasa:** Indonesia dan Inggris  
**Model:** Desktop-first, offline-capable, cloud optional

## 1. Ringkasan

NusaPDF Workbench adalah aplikasi PDF orisinal untuk membaca, membuat, mengedit,
mengonversi, mengisi form, memberi anotasi, menandatangani, melindungi, dan
berkolaborasi pada dokumen. PRD ini disusun berdasarkan kapabilitas yang terlihat
dari struktur instalasi Acrobat: engine PDF, plug-in markup/form/OCR/signature/
accessibility, converter, PDFMaker Office, storage connector, JavaScript,
browser integration, printer PDF, resource bahasa, dan layanan kolaborasi.

PRD ini tidak menyalin kode, branding, aset, UI, layanan, protokol, atau
implementasi proprietary. Gunakan engine, library, model OCR, dan aset dengan
lisensi redistribusi yang sesuai.

## 2. Tujuan dan Non-Tujuan

### Tujuan

- Membaca dan merender PDF dengan fidelity tinggi, cepat, aman, dan offline.
- Menyelesaikan workflow dokumen tanpa berpindah aplikasi.
- Menjaga isi, struktur, metadata, form, anotasi, dan keamanan dokumen.
- Menyediakan fondasi modular untuk OCR, Office, cloud, signature, plugin, dan CLI.
- Menjadikan aksesibilitas, privacy, audit, serta recovery sebagai default.

### Non-tujuan versi awal

- Menyalin produk atau layanan Adobe.
- Menjadi word processor penuh.
- Menjamin kompatibilitas 100% semua PDF.
- Menjalankan JavaScript atau attachment tanpa sandbox.
- Menyediakan tanda tangan yang dianggap sah secara hukum tanpa PKI/provider tepat.

## 3. Persona dan Hasil

| Persona | Pekerjaan | Hasil |
|---|---|---|
| Pembaca | Baca, cari, markup, print | First page cepat, search akurat |
| Staf kantor | Merge, split, convert, compress | Satu workflow tanpa kehilangan halaman |
| Reviewer | Anotasi dan compare | Perubahan terlokalisasi |
| Pengisi form | Isi dan validasi | Data tersimpan benar |
| Signer | Sign dan validasi | Identitas, integritas, audit jelas |
| Admin | Policy, deployment, audit | Kontrol organisasi konsisten |
| Developer | Batch dan automation | API stabil dan ter-sandbox |

## 4. Prinsip Produk

1. **Document fidelity:** tidak ada perubahan isi diam-diam.
2. **Local first:** operasi dasar berjalan tanpa akun atau internet.
3. **Explainable changes:** preview, warning, diff, dan undo tersedia.
4. **Secure by default:** semua input eksternal dianggap tidak tepercaya.
5. **Accessible by design:** keyboard, screen reader, reflow, dan tagged PDF.
6. **Modular delivery:** fitur berat dapat dipasang atau dinonaktifkan terpisah.

## 5. Fitur Fungsional

### 5.1 Shell Aplikasi

- Start screen: open, recent, template, scan/import, recovery.
- Tab dokumen, multi-window, multi-monitor, dirty/lock/permission status.
- Panel thumbnail, outline/bookmark, attachment, layer, destination, dan reflow.
- Toolbar kontekstual: select, hand, zoom, find, annotate, edit, form, sign,
  protect, organize, dan export.
- Undo/redo berbasis command, autosave recovery, atomic save, dan read-only mode.
- Tampilan single/continuous/facing/fullscreen, rotate view, theme, DPI scaling,
  dan shortcut yang dapat dikonfigurasi.

**Arah implementasi:** pisahkan `AppShell`, `DocumentSession`, dan
`CommandRegistry`. Command yang sama digunakan menu, toolbar, shortcut,
context menu, dan API.

### 5.2 Membuka, Merender, dan Membaca

- PDF modern, encrypted PDF, incremental update, xref stream, embedded font,
  transparency, vector, image, form, annotation, layer, attachment, metadata.
- Tile cache, worker thread, GPU rendering dengan software fallback.
- Zoom, rotate view, text/image selection, copy, snapshot, measurement, read aloud.
- Find satu dokumen atau banyak tab: case sensitivity, whole word, hasil per halaman.
- Print range, booklet/basic layout, scaling, duplex, dan printer selection.
- Validasi struktur serta warning bila file rusak atau permission membatasi.

**Acceptance:** PDF 500 halaman menampilkan halaman pertama kurang dari 2 detik
pada mesin referensi dan scrolling tetap responsif.

### 5.3 Membuat dan Import PDF

- Blank document: ukuran, orientasi, margin, dan template.
- Import PDF, PNG, JPEG, TIFF, scan, clipboard, dan drag-and-drop.
- HTML/Markdown ke PDF menggunakan renderer yang versinya dikunci.
- Virtual Print-to-PDF.
- Metadata title, author, subject, keywords, language, creator, producer.

Pipeline: `InputAdapter -> Normalizer -> PDFWriter`, dengan preview dan warning
sebelum commit.

### 5.4 Edit Isi PDF

- Edit text/content stream dengan font, encoding, posisi, dan fallback.
- Tambah, hapus, resize, crop, rotate, dan replace image.
- Edit vector dasar, warna, opacity, dan layer jika format mendukung.
- Text box, paragraph, line, shape, hyperlink, dan background.
- Insert, delete, extract, duplicate, rotate, crop, reorder, split, merge pages.
- Header/footer, watermark, page labels, dan Bates numbering.
- Redaction: mark, preview, apply, sanitize, serta verifikasi search/copy/export.
- Jika layout tidak dapat dipertahankan, tawarkan mode overlay atau rebuild content.

### 5.5 Anotasi dan Review

- Highlight, underline, strikeout, squiggly, caret, note, text box, stamp,
  drawing, line, arrow, rectangle, ellipse, polygon, measurement, dan callout.
- Author, subject, tanggal, warna, opacity, lock, reply, dan status.
- Comment list dengan filter halaman/author/type/status dan sorting.
- Import/export FDF dan XFDF.
- Print comment summary dan flatten dengan konfirmasi.
- Review tim: mention, resolve, reply, activity timeline, conflict resolution.

### 5.6 Organisasi dan Optimasi

- Combine files dengan preview thumbnail dan drag reorder.
- Bookmark create/edit/nest, destination, named destination, action.
- Attachment add/open/save/delete dengan malware-scan handoff.
- Portfolio/package opsional.
- Optimize image downsample, font subset, object cleanup, fast web view,
  discard private data, dan before/after size estimate.
- Preflight untuk ukuran halaman, bleed, font, color space, transparency, PDF/A,
  dan PDF/X.

### 5.7 Formulir

- Deteksi field dari scan atau layout teks.
- Text, multiline, checkbox, radio, dropdown, list, button, signature, date,
  calculation, validation, format, tooltip, required, dan tab order.
- Form designer: align, distribute, duplicate, rename, properties, preview, reset.
- Fill, save, validate, clear, print, email, import/export data, dan flatten.
- Mapping data harus eksplisit dan tidak boleh menghilangkan field tersembunyi.

### 5.8 Scan dan OCR

- WIA/TWAIN, import multi-page, deskew, despeckle, rotate, crop, blank-page
  removal, contrast, dan compression.
- OCR searchable image atau editable text.
- Pilihan bahasa, auto orientation, confidence score, preview, dan review confidence rendah.
- Export OCR ke PDF, TXT, DOCX, RTF, XML, dan HTML bila converter tersedia.
- Simpan bahasa/model, confidence, halaman gagal, serta scan asli.

### 5.9 Konversi dan Ekspor

- PDF ke/dari DOCX, XLSX, PPTX, TXT, RTF, HTML, XML, gambar, dan PDF/A sesuai engine.
- Preset smallest, office, print, archival, dan custom.
- Preview perubahan layout dan warning font hilang, tabel berubah, atau kualitas gambar turun.
- Batch queue dengan progress, retry, cancel, checkpoint, dan collision-safe output.

### 5.10 Tanda Tangan

- Fill and sign: typed, drawn, image signature, initials, date, checkbox, text field.
- Request signature via provider eksternal yang dikonfigurasi pengguna.
- Digital signature certificate store/PKCS#12, timestamp, validation, revocation
  bila tersedia, signature panel, appearance, reason, location, contact, audit.
- Lock-after-sign dan status integritas byte range.
- Tampilkan signer, trust chain, timestamp, serta status unknown secara eksplisit.
- Private key tidak pernah dikirim ke server aplikasi.

### 5.11 Security dan Privacy

- Password open/permission, AES sesuai engine, certificate encryption, policy template.
- Permanent redaction dan sanitize metadata, layer, attachment, comment, script, history.
- Trust manager untuk certificate, URL, attachment, script, dan external call.
- Protected mode untuk renderer, converter, OCR, dan plugin.
- Malware scanning hook, audit log lokal yang dapat diekspor, tanpa content telemetry.
- Target compliance: PDF/A-2b, WCAG UI, keyboard access, data minimization.

### 5.12 Accessibility

- Tag tree, reading order, alternate text, language, title, artifact, heading,
  table, list, dan figure.
- Accessibility checker dengan severity, lokasi, penjelasan, quick fix, dan report.
- Reflow untuk tagged PDF serta read aloud dengan engine OS.
- Full keyboard navigation, visible focus, screen-reader labels, high contrast,
  reduced motion, dan minimum contrast AA.

### 5.13 JavaScript dan Automation

- Developer mode dan script console terpisah.
- API page, field, annotation, bookmark, metadata, save, print, calculation.
- Event document/page/field/selection dengan timeout dan cancellation.
- Sandbox tanpa filesystem, network, atau registry access secara default.
- Permission prompt untuk operasi berisiko; script tepercaya wajib signed/hashed.
- CLI: convert, merge, extract, OCR, optimize, inspect, redact, validate.
- Batch action builder dengan dry-run, log, checkpoint, dan deterministic output.

### 5.14 Integrasi dan Plugin

- Office add-ins Word, Excel, PowerPoint: create PDF, preserve links/bookmarks,
  accessibility metadata, email/share.
- Browser capture untuk page/selection dengan native host minimal dan optional.
- Local/network share, WebDAV, S3-compatible, dan cloud OAuth dengan token di OS vault.
- Default mail client.
- Plugin SDK dengan manifest, version, capabilities, permissions, signature,
  lifecycle, compatibility, crash isolation, dan uninstall.

## 6. Arsitektur

```text
UI Shell -> Commands/Shortcuts -> Document Session + Transaction/Undo
         -> PDF Domain API
            -> Parser/Writer | Renderer/Tile Cache
            -> Annotation | Forms | Signature | Security
            -> OCR | Converter | Preflight workers
         -> File | Printer | Office | Browser | Storage | Cloud adapters
         -> Privacy-filtered opt-in telemetry
```

Modul: `core-pdf`, `render`, `document-session`, `page-organizer`, `markup`,
`forms`, `security`, `ocr`, `conversion`, `integration`, `plugin-host`, `ui`.

Keputusan teknis sebelum coding: lisensi PDF engine, framework desktop/GPU,
transaction/recovery format, OCR model/lisensi, Office converter, PKI/provider,
installer/update/code signing, enterprise deployment, dan crash boundary.

## 7. Data dan Kontrak

- Sumber immutable sampai save/commit.
- Session menyimpan URI/path, hash, revision, dirty state, permission, recovery location.
- Semua operasi mengembalikan `CommandResult` berisi status, warning, perubahan, output.
- Error memiliki stable code, pesan pengguna, detail log, dan remediation.
- Metadata sensitif disaring dari log; konten dokumen tidak masuk telemetry.
- Output tidak overwrite default dan menggunakan nama collision-safe.

## 8. Alur Pengguna Kritis

### Edit

Open dan validasi -> render halaman pertama -> edit dalam transaction stack ->
preview warning/diff -> save incremental atau file baru.

### Scan ke searchable PDF

Pilih scanner/gambar -> preprocessing/bahasa/mode -> OCR worker progress/cancel ->
review confidence rendah -> simpan text layer, scan asli, dan laporan OCR.

### Review dan sign

Shared revision/salinan -> anotasi terpisah -> resolve/export -> isi form/sign ->
review identity/audit -> commit dan lock permission.

## 9. Roadmap

### MVP

Shell, open/render/search/print/save/recovery; page organize merge/split/rotate/
extract; basic annotations; AcroForm fill/flatten; password open; redaction dasar;
sandbox renderer; keyboard access; localization; opt-in crash reporting.

### Rilis 1.5

Text/image editing, combine, optimize, watermark, header/footer, OCR, batch
conversion, form designer, data mapping, accessibility checker awal, FDF/XFDF,
compare, dan PDF/A preflight.

### Rilis 2

Digital signature, provider, Office/browser/printer/storage adapters, plugin SDK,
CLI, JavaScript sandbox, enterprise policy, team review, versioning, dan optional cloud.

### Rilis 3

Mobile/web companion, PDF/X advanced preflight, portfolio, layout reconstruction,
translation assist, AI dengan consent, data boundary, dan local option.

## 10. Requirement Nonfungsional

- Cold start <3 detik; first page normal <2 detik; scrolling standar >=50 FPS.
- Operasi berat berjalan di worker dan dapat dibatalkan; idle memory target <300 MB.
- Fuzz parser/renderer/converter/form/annotation; dependency scan dan SBOM.
- ASLR/DEP/CFG, code signing, provenance, sandbox escape testing.
- Threat model mencakup traversal, zip bomb, malicious font, XXE, script injection,
  attachment malware, dan network exfiltration.
- Atomic save; crash recovery tidak mengubah sumber; crash-free beta >=99.5%.
- Golden corpus mencakup text, scan, forms, annotations, encryption, RTL, CJK,
  malformed, large files, dan accessibility tags.
- Pixel comparison, round-trip import/export, signature integrity, DPI 100/150/200%,
  keyboard, dan screen reader tests.

## 11. Metrics

Telemetry harus opt-in, agregat, dan bebas konten dokumen. Ukur time to first
page/save, crash-free session, failed open/export/recovery, completion merge/OCR/
form/redact/sign/compare, queue/cancel rate, warning frequency, accessibility
resolution, serta plugin crash dan compatibility failures.

## 12. Acceptance Criteria MVP

- Open, search, read, print, annotate, save tanpa internet.
- Merge/reorder/rotate/extract/split mempertahankan halaman yang diharapkan.
- Supported form dapat diisi, disimpan, di-reset, dan di-flatten.
- Password file menolak kredensial salah.
- Applied redaction hilang dari search, copy, export, dan raw-object inspection.
- Crash save menjaga sumber asli dan recovery artifact.
- Open/search/annotate/save/close lulus keyboard-only workflow.
- Tidak ada critical/high vulnerability pada parser atau sandbox.
- Installer install/uninstall/update dan verifikasi signature berhasil.

## 13. Risiko dan Mitigasi

| Risiko | Dampak | Mitigasi |
|---|---|---|
| PDF kompleks | Render/edit berbeda | Engine matang, corpus, fidelity warning |
| Lisensi engine/converter | Tidak dapat distribusi | Legal review sebelum POC |
| OCR lemah | Output tidak dipercaya | Confidence, review, benchmark |
| Signature keliru | Risiko hukum | PKI/provider, status transparan, audit |
| Plugin/script berbahaya | Eksekusi/kebocoran | Sandbox, capability, signing |
| Cloud/compliance | Data keluar kontrol | Offline default, encryption, retention |
| Edit merusak layout | Kehilangan format | Overlay, diff, reversible transaction |

## 14. Deliverables

1. Discovery: interview, PDF benchmark corpus, legal matrix, threat model.
2. Technical spike: open/render/search, transaction save, annotation, OCR benchmark.
3. Vertical slice: open -> annotate -> save -> reopen dengan recovery.
4. MVP hardening: accessibility, fuzzing, installer, update, compatibility suite.
5. Beta: pilot 20-50 pengguna, feedback, performance budget, release gates.

## 15. Pertanyaan Terbuka

- Target utama individual, SMB, enterprise, atau pemerintah?
- Windows-only atau cross-platform?
- Cloud/signature provider dibuat sendiri atau integrasi?
- Standar legal signature dan arsip negara target?
- Format Office mana yang wajib fidelity tinggi?
- Apakah AI diperlukan dan di mana dokumen boleh diproses?
- Bagaimana harga, trial, dan batas free/paid?

## 16. Dasar Analisis Sumber

- `Acrobat.exe`, `Acrobat.dll`, `AdobePDFL.dll`, x86/x64: desktop app dan core PDF.
- `Annots.api`, `AcroForm.api`, `Search.api`, `Compare.api`, `Catalog.api`,
  `Accessibility.api`, `DigSig.api`, `MakeAccessible.api`: markup, form, search,
  compare, navigasi, signature, accessibility.
- `PaperCapture.api`, OCR library, dan language resources: scan/OCR multibahasa.
- `SaveAsXML.api`, `SaveAsRTF.api`, `HTML2PDF.api`, `DistillerPI.api`, DOCX/PPTX/
  XLSX filters: conversion dan export.
- `PDFMaker`: Office integration; browser native host: browser capture;
  `StorageConnectors`: storage; `Javascripts`/`EScript.api`: automation.

Inventaris file hanya memberi sinyal kapabilitas, bukan dokumentasi API atau
perilaku. Validasi setiap roadmap item melalui prototype, licensing review,
benchmark, compatibility test, dan threat model.
