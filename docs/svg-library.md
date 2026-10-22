# 🎨 Standard SVG Library — PDF Tools

Dokumen ini adalah referensi terpusat pustaka ikon vektor SVG standar yang digunakan di seluruh aplikasi **PDF Tools**.  
Sesuai dengan pedoman di [PROJECT_RULES.md](../PROJECT_RULES.md), **dilarang keras menggunakan emoji teks** (`📁`, `📄`, `🗑️`, `🔄`, `✂️`, `🔒`, `✨`, `✓`, dll.). Seluruh antarmuka wajib menggunakan elemen inline vector SVG standar dengan `viewBox="0 0 24 24"` dan `stroke="currentColor"`.

---

## Standar Ukuran SVG Menurut Komponen

1. **Hero Header Badge (`.tool-hero-icon`)**: `width="34" height="34"` dalam kotak badge `64x64px`, `border-radius: 14px`.
2. **Dropzone Cloud Icon (`.dropzone-icon`)**: `width="36" height="36"`, warna dinamis mengikuti `var(--tool-color)`.
3. **Dropdown Menu, Mega Menu, & Command Palette Items**: `width="18" height="18"` atau `20x20px`.
4. **Tombol Standar / Modal Buttons (`.btn-md`, `.btn-lg`)**: `width="14" height="14"` hingga `16x16px`.
5. **Tombol Mini / Thumbnail Action Card (`.merge-card-btn`, `.thumb-mini-btn`)**: `width="11" height="11"` hingga `13x13px`.
6. **Status Hasil Berhasil (`.result-icon`)**: `width="24" height="24"` atau `28x28px` (Checkmark).

---

## Pustaka Ikon SVG Standar

### 1. Upload Cloud (Gunakan pada seluruh Dropzone)
```html
<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/>
  <path d="M12 12v9"/>
  <path d="m16 16-4-4-4 4"/>
</svg>
```

### 2. Rotate Clockwise (Putar Searah Jarum Jam)
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/>
  <polyline points="21 3 21 8 16 8"/>
</svg>
```

### 3. Rotate Counter-Clockwise / Reset (Putar Berlawanan)
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
  <polyline points="3 3 3 8 8 8"/>
</svg>
```

### 4. Delete / Trash Can (Hapus)
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="3 6 5 6 21 6"/>
  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
  <line x1="10" y1="11" x2="10" y2="17"/>
  <line x1="14" y1="11" x2="14" y2="17"/>
</svg>
```

### 5. Plus / Add (Tambah Berkas / Tambah Halaman)
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <line x1="12" y1="5" x2="12" y2="19"/>
  <line x1="5" y1="12" x2="19" y2="12"/>
</svg>
```

### 6. Checkmark (Selesai / Sukses)
```html
<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
  <polyline points="20 6 9 17 4 12"/>
</svg>
```

### 7. Edit in PDF Studio / Pen Tool
```html
<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
</svg>
```

### 8. Download / Simpan
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
  <polyline points="7 10 12 15 17 10"/>
  <line x1="12" y1="15" x2="12" y2="3"/>
</svg>
```

### 9. Eye / Quick Preview
```html
<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
  <circle cx="12" cy="12" r="3"/>
</svg>
```

### 10. Lock / Protect
```html
<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
</svg>
```
