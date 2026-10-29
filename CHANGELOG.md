# Catatan Perubahan (Changelog)

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan penomoran versi mengikuti [Semantic Versioning](https://semver.org/lang/id/). Daftar keterbatasan yang sudah diketahui ada di bagian *Masalah yang Diketahui* pada [README](README.md).

## [Unreleased]

### Diubah

- Aplikasi difokuskan sebagai aplikasi web; server pengembangan dipindahkan ke `scripts/dev-server.js`.
- Bahasa tampilan bawaan kini bahasa Inggris; bahasa Indonesia tetap tersedia lewat tombol bahasa di header, dan pilihan Anda diingat.

### Dihapus

- Peluncur Windows (.bat), dukungan membuka aplikasi langsung dari berkas (file://), dokumen arsip lama (`docs/archive/`), dan berkas tidak terpakai (`scripts/validate_workflow_yaml.js`).

## [1.0.0] - 2026-10-27

Rilis stabil pertama. Seluruh pemrosesan berjalan di browser Anda; berkas tidak dikirim ke server mana pun.

### Keamanan

- **Proteksi PDF kini benar-benar mengenkripsi.** Sebelumnya opsi password diabaikan diam-diam dan berkas tetap bisa dibuka tanpa password. Sekarang hasilnya terenkripsi AES-256 dengan izin yang dipilih (cetak, salin, ubah). Buka Kunci (Unlock) juga bisa membuka PDF terenkripsi buatan aplikasi lain.
- **Redaksi permanen sungguhan.** Halaman yang ditandai kini dirender menjadi gambar dengan kotak hitam, dan semua objek tersembunyi dibuang, sehingga teks aslinya tidak bisa dipulihkan. Halaman berotasi dan suntingan yang dibuat sebelum redaksi ikut ditangani dengan benar.
- **Halaman yang dibuang tidak lagi tersimpan tersembunyi.** Pada Gabung, Hapus Halaman, Pisah/Ekstrak, dan Urutkan, isi halaman yang sengaja dibuang sebelumnya masih bisa terbawa di dalam berkas hasil sebagai "halaman hantu". Itu sudah dihapus.
- **PDF terproteksi diproses dengan benar.** Sebelumnya beberapa alat menghasilkan berkas dengan isi halaman rusak tanpa pesan error jika sumbernya terproteksi. Sekarang PDF didekripsi dulu: PDF yang hanya dibatasi izinnya langsung diproses, dan PDF ber-password meminta password lewat dialog. Password hanya ada di memori dan tidak disimpan. Hasil selalu tanpa proteksi.
- Server lokal hanya menerima koneksi dari komputer sendiri (127.0.0.1) dan kebal terhadap path traversal. Aplikasi tidak lagi memuat font atau skrip dari internet.
- Izin aksesibilitas pada PDF terkunci selalu aktif, agar pembaca layar tetap berfungsi.

### Ditambahkan

- **Watermark gambar** (PNG, JPG, atau WebP): ukuran dalam persen lebar halaman, posisi 9 titik atau ubin berulang, opasitas 1-100%, rotasi bebas, pratinjau halaman pertama sebelum diterapkan, dan pilihan rentang halaman. Berlaku juga untuk watermark teks.
- **Dialog password** untuk PDF terenkripsi (Indonesia dan Inggris).
- **Tanda tangan (Sign):** layar hasil dengan tombol "Unduh lagi", "Tanda tangani file lain", dan "Ganti file".
- **Bahasa tampilan otomatis** mengikuti bahasa browser (Indonesia atau Inggris); pilihan manual tetap diingat. Menu di HP ikut diterjemahkan, dan bahasa OCR bawaan mengikuti bahasa tampilan.
- Situs publik di GitHub Pages, lisensi MIT, dan daftar lisensi pustaka pihak ketiga (`THIRD_PARTY_NOTICES.md`).
- Rangkaian pengujian otomatis (Node dan browser dengan Chromium dan WebKit iPhone 13) yang memeriksa hasil nyata: isi PDF, piksel, dan struktur berkas.

### Diubah

- Ditambahkan pengecekan kode otomatis (ESLint) untuk menangkap variabel tak terdefinisi dan nama ganda, serta test yang memastikan operasi salin halaman tidak bergantung pada fitur khusus Node.
- **OCR dimuat saat dibutuhkan.** Membuka halaman tidak lagi mengunduh mesin dan model OCR (turun dari sekitar 25 MB menjadi 0,3 MB untuk beranda dan sekitar 3 MB untuk PDF Studio). Hanya model bahasa yang dipilih yang diunduh.
- **Gabung PDF jauh lebih hemat ukuran:** dua berkas 5,5 MB yang sebelumnya menjadi 136 MB kini sekitar 5,2 MB. Daftar isi (link internal), bookmark, dan metadata dokumen ikut terbawa ke hasil.
- Tanda tangan digital pada berkas yang ditulis ulang (Watermark, Gabung, Tanda Tangan, dan lainnya) diubah menjadi stempel visual tanpa dialog. Tanda tangan itu tidak lagi sah secara kriptografi (lihat Masalah yang Diketahui).
- **Tampilan HP dan tablet:** area sentuh minimal 44 piksel, tanpa overflow di lebar 360 sampai 430 piksel, dan menu hamburger dipakai sampai lebar 991 piksel. Daftar kartu yang bisa diurutkan (Gabung, Urutkan, JPG ke PDF, Kompres, Watermark) memakai tekan-tahan di layar sentuh. Potong (Crop) dan slider pembanding Grayscale bisa digeser dengan jari.
- Header dan navigasi disatukan menjadi satu komponen; emoji diganti ikon SVG; dialog bawaan browser diganti dialog kustom.
- PDF Studio dipecah menjadi modul-modul kecil (dari sekitar 9.900 baris menjadi sekitar 4.200 pada berkas utamanya).
- Dokumentasi disatukan menjadi satu PRD; dokumen lama dipindahkan ke arsip.

### Diperbaiki

- **Gabung PDF gagal di browser pada PDF tertentu.** Jika judul bookmark (daftar isi di panel samping) disimpan sebagai string heksadesimal UTF-16, penyalinan bookmark memakai fungsi khusus Node yang tidak ada di browser, sehingga proses berhenti dengan galat. Alat lain yang menyalin bookmark (Hapus Halaman, Pisah/Ekstrak, Urutkan, Buka Kunci) memakai kode yang sama dan ikut diperbaiki.
- **Judul bookmark rusak pada karakter di luar Latin-1.** Tanda pisah "–", tanda kutip lengkung, dan huruf non-Latin pada judul bookmark sebelumnya berubah menjadi karakter kontrol saat bookmark disalin. Kini judul tersalin utuh.
- OCR offline yang rusak sejak awal: berkas bundel mesin OCR memuat tanda kutip yang tidak di-escape sehingga jalur offline tidak pernah berjalan dan OCR hanya bekerja lewat server. Kini OCR berjalan lewat server lokal maupun dibuka langsung dari berkas.
- Grayscale yang selalu gagal karena variabel tidak terdefinisi.
- Statistik ukuran berkas yang tidak tampil di halaman Gabung.
- Tombol menu keluar layar di iPhone (lebar 390 piksel dengan layar sentuh), menu desktop yang tampil di HP pada beranda, dan overflow horizontal di halaman Batch pada Safari.
- Tombol unduh di halaman Tanda Tangan yang tertahan di "Baking signatures into PDF..." setelah unduhan selesai.
- Nilai rotasi atau opasitas nol yang diam-diam diganti nilai bawaan; kini watermark bawaannya lurus (0 derajat).
- Deklarasi ganda di PDF Studio dan galat 404 pada beranda.

### Dihapus

- Service worker (`sw.js`) yang tidak pernah aktif, font dan skrip yang dimuat dari internet (Google Fonts, jsDelivr), serta berkas sisa percobaan.

[1.0.0]: https://github.com/danwiraza03/pdf-tools/releases/tag/v1.0.0
