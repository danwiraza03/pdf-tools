# Panduan & Lembar Uji Perangkat Fisik (Physical Device Testing Protocol)

Dokumen ini menyediakan lembar kerja dan protokol pengujian komprehensif pada **perangkat fisik nyata** (iOS Safari dan Android Chrome).

Meskipun seluruh 23 halaman telah lulus 414 pengecekan emulasi seluler otomatis via Playwright (iPhone 13 WebKit dan Chromium Mobile), pengujian pada perangkat fisik sungguhan wajib dilakukan untuk memvalidasi interaksi gestur sentuh nyata (*touch events*), pemilih berkas bawaan OS (*native file picker* / kamera / galeri), kinerja prosesor seluler (*thermal & memory throttling*), dan pengunduhan berkas lokal tanpa server.

---

## 1. Daftar Periksa Skenario Pengujian (Test Checklist)

Lakukan pengujian berikut secara berurutan pada peramban seluler perangkat fisik:

### Skenario 1: Navigasi Header & Menu Hamburger
- **Halaman:** `index.html` dan sembarang halaman `pages/*.html`.
- **Langkah:**
  1. Buka situs di peramban seluler (layar vertikal/portrait).
  2. Periksa bahwa logo, inisial `(DN.)`, tombol toggle bahasa (`ID`/`EN`), toggle tema, dan tombol hamburger muat dalam satu baris tanpa terpotong atau keluar layar.
  3. Ketuk tombol hamburger: menu drawer harus meluncur mulus dari samping kanan.
  4. Ketuk salah satu menu atau tombol tutup (ikon silang): drawer menutup mulus.
- **Kriteria Lulus:** Teks tajam dengan font Inter lokal, tidak ada *horizontal overflow* (lebar layar pas 100%), drawer responsif.

---

### Skenario 2: Gabung PDF & Unduh Hasil
- **Halaman:** `pages/merge.html`.
- **Langkah:**
  1. Ketuk area dropzone dan pilih 2–3 berkas PDF dari penyimpanan HP (*Files* / *Download*).
  2. Coba ubah urutan berkas menggunakan *drag-and-drop* sentuhan (tahan jari sebentar lalu geser).
  3. Ketuk tombol **Gabungkan PDF**.
  4. Ketuk tombol unduh: periksa bahwa berkas hasil gabungan terunduh ke folder unduhan HP.
  5. Buka berkas unduhan di pembaca PDF bawaan HP: seluruh halaman harus utuh.
- **Kriteria Lulus:** Pemrosesan 100% luring berhasil, berkas terunduh sempurna, ukuran tidak membengkak.

---

### Skenario 3: Watermark Gambar dari Galeri Foto
- **Halaman:** `pages/watermark.html`.
- **Langkah:**
  1. Pilih satu dokumen PDF.
  2. Pilih tab **Watermark Gambar** -> ketuk tombol pilih gambar.
  3. Pilih foto langsung dari galeri foto / kamera HP.
  4. Atur slider opasitas dan rotasi.
  5. Ketuk tombol **Terapkan Watermark** dan unduh hasilnya.
- **Kriteria Lulus:** Gambar galeri berhasil disematkan dengan transparansi yang sesuai tanpa membuat memori peramban *crash*.

---

### Skenario 4: Tanda Tangan Layar Sentuh (Canvas Signature)
- **Halaman:** `pages/sign.html`.
- **Langkah:**
  1. Pilih satu dokumen PDF.
  2. Di kanvas tanda tangan, goreskan tanda tangan menggunakan ujung jari.
  3. Periksa kelancaran goresan kurva tanda tangan (tidak patah-patah).
  4. Ketuk tombol bersihkan, lalu coba buat ulang tanda tangan.
  5. Masuk ke langkah penempatan: ketuk dan geser tanda tangan ke posisi yang diinginkan pada pratinjau PDF.
  6. Simpan dan unduh berkas bertanda tangan.
- **Kriteria Lulus:** Goresan responsif terhadap sentuhan jari, posisi tanda tangan pada berkas akhir akurat.

---

### Skenario 5: Kompresi Dokumen Banyak Halaman
- **Halaman:** `pages/compress.html`.
- **Langkah:**
  1. Pilih dokumen PDF berukuran sedang/besar (berisi 10–20 halaman atau pindaian foto).
  2. Pilih profil kompresi **Rekomendasi (Seimbang)**.
  3. Periksa bilah kemajuan (*progress bar*) selama proses kompresi.
  4. Unduh hasil dan periksa kualitas teks/vektor tetap tajam.
- **Kriteria Lulus:** Tidak ada galat memori (*out of memory*) atau peramban tertutup sendiri (*browser tab crash*).

---

### Skenario 6: Pengenalan Teks Luring (Client-Side OCR)
- **Halaman:** `pages/ocr.html`.
- **Langkah:**
  1. Masukkan berkas PDF pindaian atau foto dokumen.
  2. Matikan koneksi internet (aktifkan mode pesawat / *Airplane mode*) setelah halaman selesai dimuat.
  3. Ketuk tombol proses OCR (bahasa Indonesia atau Inggris).
  4. Periksa teks hasil pengenalan karakter yang ditampilkan.
- **Kriteria Lulus:** OCR berjalan 100% luring di perangkat HP tanpa transfer data ke server mana pun.

---

### Skenario 7: Pembukaan PDF Terproteksi Kata Sandi
- **Halaman:** `pages/protect.html` atau coba buka PDF terproteksi di `pages/merge.html`.
- **Langkah:**
  1. Buat dokumen dengan kata sandi di `pages/protect.html`.
  2. Masukkan dokumen tersebut ke alat lain: modal dialog kustom harus muncul menanyakan kata sandi.
  3. Masukkan kata sandi salah: pesan peringatan percobaan muncul.
  4. Masukkan kata sandi benar: dokumen berhasil terbuka.
- **Kriteria Lulus:** Keyboard virtual seluler muncul normal, input tipe password tersembunyi, fokus input otomatis aktif.

---

## 2. Lembar Hasil Pengujian Perangkat Fisik (Test Log)

| Tanggal Uji | Model Perangkat Fisik | Sistem Operasi | Peramban & Versi | Hasil Uji (Skenario 1 - 7) | Catatan / Penguji |
| :--- | :--- | :--- | :--- | :--- | :--- |
| *(Isi saat pengujian)* | Apple iPhone (misal: 13/14/15) | iOS 17.x / 18.x | Safari Mobile | [ ] S1 [ ] S2 [ ] S3 [ ] S4 [ ] S5 [ ] S6 [ ] S7 | Pengujian fisik oleh pemilik proyek |
| *(Isi saat pengujian)* | Android (misal: Samsung/Pixel/Xiaomi) | Android 13.x / 14.x | Google Chrome Mobile | [ ] S1 [ ] S2 [ ] S3 [ ] S4 [ ] S5 [ ] S6 [ ] S7 | Pengujian fisik oleh pemilik proyek |

---

## 3. Prosedur Pasca Pengujian

Setelah pengujian pada minimal satu perangkat iPhone nyata dan satu perangkat Android nyata selesai dilakukan dan seluruh skenario bertanda lulus:
1. Perbarui lembar hasil pada tabel di atas.
2. Hapus baris peringatan berikut dari berkas `README.md` (bagian Status Pengujian):
   ```markdown
   - **Belum diuji pada perangkat fisik iOS dan Android.** Pengujian memakai emulasi (Chromium dan WebKit).
   ```
3. Lakukan komit pembaruan dokumentasi:
   ```bash
   git add docs/DEVICE_TESTING.md README.md
   git commit -m "docs(test): lengkapi hasil uji perangkat fisik iOS dan Android"
   ```
