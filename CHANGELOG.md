# Catatan Perubahan (Changelog)

Format mengacu pada [Keep a Changelog](https://keepachangelog.com/id-ID/1.1.0/) dan penomoran versi mengikuti [Semantic Versioning](https://semver.org/lang/id/). Daftar keterbatasan yang sudah diketahui ada di bagian *Masalah yang Diketahui* pada [README](README.md).

## [Unreleased]

### Ditambahkan

- **Redaksi PDF Mandiri**: Redaksi PDF sebagai alat mandiri (`pages/redact.html`), memakai mesin redaksi permanen yang sama dengan Edit PDF.
- **Peringatan Layar Sentuh untuk Edit PDF (PDF Studio)**: Modal kustom ramah sentuh (`#studioTouchModalBackdrop`) yang memperingatkan pengguna perangkat layar sentuh bahwa "Edit PDF paling nyaman dipakai di komputer" dengan tombol Lanjutkan dan Batal, mencegah navigasi tidak sengaja di layar kecil tanpa menggunakan dialog bawaan browser.
- **Rangkaian Pengujian Browser Navigasi Edit PDF**: Menambahkan pengujian otomatis Playwright `test_edit_pdf_nav.js` yang memverifikasi keseragaman label dwibahasa (EN & ID), navigasi langsung di desktop tanpa modal, dan pemunculan modal peringatan pada emulasi layar sentuh.

### Diubah

- **Penyelarasan PDF Studio sebagai Alat "Edit PDF"**: Menyeragamkan label alat pada kartu beranda kategori Edit, mega menu, laci menu seluler, dan tombol header menjadi "Edit PDF" (dwibahasa EN/ID) agar konsisten dengan kata kerja aksi navigasi utama lainnya (MERGE PDF, SPLIT PDF, COMPRESS PDF, CONVERT PDF). Logika internal Studio tetap utuh tanpa modifikasi.
- **Metadata Dokumen Edit PDF**: Memperbarui judul dan deskripsi halaman `<head>` pada `pages/viewer.html` menjadi "Edit PDF — Professional PDF Editor Workspace" agar selaras dengan identitas alat baru.

## [1.1.0] - 2026-11-03

### Keamanan

- **Content Security Policy (CSP) ketat tanpa 'unsafe-eval'**: Seluruh 23 halaman HTML menerapkan kebijakan keamanan konten yang memblokir injeksi skrip eksternal, gambar pelacak, dan permintaan jaringan luar. Opsi `'unsafe-eval'` berhasil dihilangkan dengan menyetel `isEvalSupported: false` pada PDF.js di seluruh modul di luar PDF Studio.

### Ditambahkan

- **Progressive Web App (PWA) & Service Worker**: Aplikasi dapat dipasang langsung ke layar utama desktop maupun seluler dan beroperasi 100% offline setelah kunjungan pertama dengan app shell precache (~3,63 MB) dan pemberitahuan pembaruan versi baru secara interaktif.
- **Pintasan PWA & Tangkapan Layar**: Menambahkan pintasan langsung (*shortcuts*) ke Gabung PDF, Kompres PDF, dan Tanda Tangan PDF dari ikon aplikasi di OS, serta tangkapan layar pratinjau desktop dan seluler pada dialog pemasangan.
- **Tipografi Font Inter Lokal**: Menyertakan font Inter WOFF2 (`Inter-Regular`, `Inter-Medium`, `Inter-SemiBold`) secara lokal di folder `fonts/` tanpa ketergantungan pada Google Fonts eksternal.
- **Komponen Seret & Lepas (PageDrop) di Seluruh Halaman**: Berkas dapat diseret dan dilepas ke bagian layar mana pun pada semua alat. Alat banyak berkas menambahkan berkas ke antrean, sedangkan alat satu berkas mengganti berkas yang sedang dibuka dengan konfirmasi modal yang aman.
- **Penyisipan Berkas di Tengah Antrean Gabung PDF**: Menambahkan tombol untuk menyisipkan dokumen baru setelah halaman atau dokumen tertentu tanpa membongkar urutan yang sudah ada.
- **Peningkatan Putar PDF (Rotate)**: Tombol putar kiri (-90°), putar kanan (+90°), dan hapus halaman individual pada kartu pratinjau dengan notifikasi pemulihan (undo), serta modal perbesar pratinjau interaktif.
- **Peningkatan Penomoran Halaman (Page Number)**: Pratinjau penempatan nomor langsung pada kanvas PDF asli, navigasi pratinjau halaman, dan dukungan opsi font Arial.
- **Peningkatan Watermark**: Palet warna preset ala Microsoft Word, pemilih warna kustom (color picker), dan ukuran font bebas.
- **Optimasi Mesin Pencari (SEO) & Berbagi Sosial**: Tag meta deskripsi, Open Graph, Twitter Cards, canonical URL, gambar pratinjau `assets/og-image.png`, serta `sitemap.xml` otomatis di seluruh halaman publik.
- **Aksesibilitas Penuh (A11y)**: Tautan lewati ke konten (*skip-to-content*), penanda semantik (landmark), pengelolaan fokus keyboard pada dialog modal, dan rasio kontras warna standar WCAG AA diuji dengan Axe-core (0 pelanggaran).
- **Ekspansi Rangkaian Pengujian Otomatis**: Pengujian bertambah dari 13 suite menjadi 61 suite (34 suite pengujian Node.js dan 27 suite browser Playwright).

### Diubah

- **Alur Caching Service Worker Anti-Version Skew**: Berkas aplikasi milik situs sendiri (HTML, JS, CSS, font, ikon) menggunakan strategi *Network-First* dengan batas waktu jaringan 5 detik agar pengguna yang online selalu menerima versi rilis terbaru yang serasi dengan berkas HTML.
- **Pemisahan Cache Vendor OCR**: Pustaka lokal di `js/lib/**` dan aset model bahasa OCR disimpan di cache vendor persisten terpisah (`pdf-tools-vendor-v<hash>`) sehingga tidak diunduh ulang setiap ada rilis perbaikan aplikasi.
- **Lokalisasi Homepage & Navigasi 100% Dwibahasa**: Seluruh 23 deskripsi alat, tombol filter kategori, judul mega menu, tombol cancel dan batch modal, serta tautan footer diterjemahkan lengkap ke dalam bahasa Inggris dan Indonesia.
- **Area Kerja Gabung PDF Lebih Bersih**: Area pengerjaan kartu disembunyikan otomatis begitu proses penggabungan selesai, menyajikan menu unduhan yang ringkas dan tombol atur ulang untuk kembali ke tata letak sebelumnya.
- **Penyatuan Header Dokumen pada Gabung PDF**: Menyisipkan berkas baru mempertahankan satu kesatuan header dokumen agar tidak terpecah menjadi kartu terpisah.
- **Pembersihan Arsitektur Berfokus Aplikasi Web**: Menghapus dukungan lingkungan lokal `file://` dan memindahkan server pengembangan statis ke `scripts/dev-server.js`.
- **Konsolidasi Peta Jalan (Roadmap)**: Menggabungkan rencana pengembangan menjadi satu dokumen rujukan terpadu di `docs/ROADMAP.md`.

### Diperbaiki

- **Tumpang Tindih Ikon Pindah di Layar Sentuh**: Ikon drag handle pada kartu Gabung PDF di layar sentuh dipindahkan ke tepi kiri bawah pratinjau sehingga tidak lagi menutupi tombol putar, perbesar, dan hapus.
- **Rasio Kontras Judul Tanda Tangan**: Memperbaiki kontras warna teks judul pada `pages/sign.html` agar memenuhi standar aksesibilitas WCAG AA.
- **Mencegah Reload Berulang pada Service Worker**: Memperbaiki alur inisialisasi agar halaman tidak memuat ulang tanpa interaksi pengguna.

### Dihapus

- Peluncur desktop Windows (`Jalankan_PDF_Tools.bat` dan `Buka_Aplikasi.bat`).
- Penanganan khusus protokol `file://` pada modul OCR dan worker PDF.js.
- Berkas lama tidak terpakai: folder `docs/archive/`, `scripts/validate_workflow_yaml.js`, serta berkas rencana lama `docs/IMPROVEMENT_PLAN.md` dan `docs/IMPROVEMENT_ROADMAP.md`.

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

[Unreleased]: https://github.com/danwiraza03/pdf-tools/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/danwiraza03/pdf-tools/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/danwiraza03/pdf-tools/releases/tag/v1.0.0
