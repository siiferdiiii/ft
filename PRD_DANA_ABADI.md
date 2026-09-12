# PRD Update — Fitur Dana Abadi & Edukasi Investasi Visual

> Dokumen ini adalah spesifikasi **fitur tambahan** untuk aplikasi finance tracker yang sudah jadi (sesuai `PRD.md` versi awal). Baca sebagai delta/penambahan — bukan pengganti PRD utama. Ikuti setiap acceptance criteria sebagai kontrak fungsional.

## 1. Konteks & Tujuan

Aplikasi finance tracker sudah berjalan sesuai PRD awal (voice input, dompet, kategori, budget, statistik). Update ini menambahkan fitur yang mendorong kebiasaan menyisihkan uang ("bayar diri sendiri dulu" — 1/10 dari pemasukan) dan mengedukasi user lewat **visual interaktif**, bukan artikel teks. Fitur ini juga membuka jalur monetisasi lewat afiliasi platform investasi.

**Referensi teknis:** perubahan schema ada di `schema.prisma` (`User.perpetualFundPercent`, `Wallet.isPerpetualFund`). Konvensi kode & keamanan tetap mengikuti `CODING_STANDARDS.md` dan `SECURITY_STANDARDS.md` yang sudah ada.

## 2. Ringkasan Fitur

1. Dompet khusus "Dana Abadi" (flag pada dompet biasa, bukan tipe dompet baru).
2. Auto-suggest alokasi 10% dari setiap pemasukan ke dompet ini.
3. Dua simulator visual interaktif (bukan teks) untuk edukasi.
4. Halaman afiliasi platform investasi.

## 3. Fitur Detail

### 3.1 Dompet Dana Abadi
- [ ] User bisa menandai satu dompet sebagai Dana Abadi lewat toggle di halaman edit dompet (`Wallet.isPerpetualFund`).
- [ ] Dompet ini tampil dengan badge visual berbeda (ikon/warna khusus) di card dashboard — tetap dalam layout card dompet yang sudah ada, tidak perlu halaman terpisah.
- [ ] Saat user mencatat pengeluaran dari dompet ini (voice/manual/scan), tampilkan **satu langkah konfirmasi tambahan** di modal konfirmasi yang sudah ada — contoh copy: "Ini dari Dana Abadi kamu, lanjutkan?" dengan tombol lanjut/batal. Tidak memblokir transaksi, hanya menambah friksi sadar.

### 3.2 Auto-Suggest Alokasi 10%
- [ ] Setiap transaksi tipe `INCOME` tersimpan → sistem hitung `amount * (User.perpetualFundPercent / 100)` dan tampilkan sebagai **card/banner non-blocking** di dashboard (bukan modal blocking) berisi: nominal saran, tombol "Alokasikan" dan "Lewati".
- [ ] Kalau user tap "Alokasikan": buat `Transfer` dari dompet asal income ke dompet Dana Abadi sejumlah nominal tersebut (pakai model `Transfer` yang sudah ada, bukan `Transaction` baru).
- [ ] `User.perpetualFundPercent` bisa diubah di halaman pengaturan (default 10, range wajar 1-50).
- [ ] Kalau user tap "Lewati" 3 kali berturut-turut (hitung dari transaksi income terakhir), tampilkan Simulator A (3.3) sebagai popup non-blocking sekali — bukan setiap kali skip setelahnya.
- [ ] Kalau user belum punya dompet ber-flag Dana Abadi sama sekali, banner ini menawarkan bikin dompet baru dulu (bukan alokasi langsung).

### 3.3 Simulator A — "Bayar Diri Sendiri" (Bunga Majemuk 25 Tahun)

**Tampilan:** satu kalimat pembuka (bukan paragraf) + grafik interaktif + dua angka besar (total tanpa investasi vs dengan investasi). Tidak ada blok teks penjelasan panjang di UI.

- [ ] Kalimat pembuka ditulis ulang dengan bahasa sendiri (jangan mengutip buku manapun), contoh arah: menyoroti bahwa nominal kecil yang konsisten bisa jadi jauh lebih besar hanya karena "dibiarkan bekerja".
- [ ] Slider 1: nominal disisihkan per bulan — **prefill otomatis** dari rata-rata `amount * perpetualFundPercent%` dari transaksi income 3 bulan terakhir user. Kalau data belum cukup (user baru), prefill dengan nilai default Rp300.000.
- [ ] Slider 2: asumsi return per tahun, rentang 3%-12%, default 7%.
- [ ] Grafik garis 25 tahun: "disimpan saja" vs "diinvestasikan", dengan total akhir masing-masing ditampilkan sebagai angka besar di atas grafik.
- [ ] Disclaimer tetap terlihat (tidak bisa di-dismiss/hilang): "Ilustrasi, bukan jaminan return."
- [ ] Trigger tampil: (a) pertama kali user mengaktifkan flag Dana Abadi pada sebuah dompet, (b) setelah skip alokasi 3x berturut-turut (lihat 3.2), (c) bisa dibuka manual kapan saja dari halaman Dana Abadi.

### 3.4 Simulator B — "Dana Abadi Tidak Pernah Habis" (Sustainability 50 Tahun)

- [ ] Input saldo: otomatis dari saldo real dompet ber-flag Dana Abadi milik user (bukan input manual). Kalau user punya lebih dari satu dompet Dana Abadi, jumlahkan semua.
- [ ] Slider: asumsi return per tahun (3-12%, default 7%) dan estimasi penarikan per tahun — **prefill otomatis** dari total pengeluaran user 12 bulan terakhir (seluruh kategori, bukan hanya kebutuhan pokok — keputusan final, lihat 3.4.1), tetap bisa digeser manual.
- [ ] Grafik saldo 50 tahun ke depan.
- [ ] Badge status dengan 3 kondisi warna (final, mengganti versi binary sebelumnya):
  - **Hijau** ("bertahan selamanya, margin aman"): penarikan tahunan ≤ 70% dari return tahunan.
  - **Kuning** ("bertahan, tapi margin tipis"): penarikan tahunan antara 70%-100% dari return tahunan (secara matematis tidak habis, tapi rawan kalau return riil turun).
  - **Merah** ("akan habis dalam N tahun"): penarikan tahunan > return tahunan, tampilkan estimasi tahun habis dari hasil kalkulasi.
- [ ] Disclaimer sama seperti Simulator A, ditambah kalimat singkat soal return riil tidak flat tiap tahun.
- [ ] Trigger tampil: manual dari halaman Dana Abadi (tombol "Lihat proyeksi"), tidak muncul otomatis.

#### 3.4.1 Keputusan yang Sudah Difinalkan
- Margin aman badge hijau: **≤70% dari return** (bukan sama persis dengan return) — sudah ditetapkan di atas.
- Sumber data pengeluaran tahunan untuk prefill: **seluruh kategori pengeluaran**, bukan subset — dipilih karena lebih sederhana untuk MVP dan tetap representatif sebagai estimasi kasar.
- Jenis popup Simulator A: **non-blocking** (banner/card yang bisa di-dismiss), supaya tidak mengganggu user yang sudah terbiasa pakai flow existing app.

### 3.5 Halaman "Kembangkan Uangmu" (Afiliasi)
- [ ] Halaman baru terpisah, diakses dari menu/navigasi utama — bukan interupsi di dashboard/flow pencatatan.
- [ ] Berisi daftar partner platform investasi (data link afiliasi diinput manual oleh developer lewat seed data/CMS sederhana — tidak perlu dashboard admin kompleks untuk MVP).
- [ ] Disclaimer wajib tampil permanen di bagian atas halaman: bukan nasihat keuangan, keputusan & risiko investasi sepenuhnya di tangan user.
- [ ] Konten edukasi prinsip finansial di halaman ini ditulis ulang dengan bahasa sendiri, tidak mengutip sumber buku manapun secara langsung.
- [ ] **Di luar scope kode:** pendaftaran ke masing-masing program afiliasi dilakukan manual oleh Ferdi di luar aplikasi — developer/AI code generator hanya menyediakan tempat untuk memasukkan link yang sudah didapat.

## 4. Perubahan Data Model

Sudah tersedia final di `schema.prisma`:
- `User.perpetualFundPercent Int @default(10)`
- `Wallet.isPerpetualFund Boolean @default(false)`

Tidak ada tabel baru yang dibutuhkan — alokasi otomatis memakai model `Transfer` yang sudah ada (lihat `desain-sistem-finance-tracker.md` bagian 2).

## 5. Non-Functional Requirements
- Kedua simulator harus tetap berfungsi (dengan nilai default/prefill fallback) untuk user baru yang belum punya cukup data histori transaksi — jangan biarkan halaman kosong/error kalau data kurang.
- Disclaimer investasi tidak boleh bisa di-hardcode-hilangkan lewat state apapun di kode — harus selalu render.
- Ikuti aturan warna & komponen UI dari `CODING_STANDARDS.md` yang sudah ada (jangan bikin sistem warna terpisah untuk badge sustainability — reuse token warna hijau/kuning/merah yang sudah dipakai di fitur budget kategori).

## 6. Eksplisit Di Luar Scope (Update Ini)
- Dashboard admin untuk kelola partner afiliasi (input manual/seed data cukup untuk MVP).
- Simulasi return acak/Monte Carlo (return flat per tahun cukup untuk MVP, dicatat sebagai potensi improvement masa depan).
- Notifikasi push untuk reminder alokasi Dana Abadi.
- Perhitungan pajak/biaya platform investasi di simulator.

Jangan implementasikan item di atas kecuali diminta eksplisit.
