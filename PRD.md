# PRD — Finance Tracker (Voice-First)

> Dokumen ini adalah spesifikasi produk untuk dibaca AI code generator. Ikuti setiap acceptance criteria sebagai kontrak fungsional — jangan menambah scope di luar yang tertulis tanpa konfirmasi.

## 1. Tujuan Produk

Aplikasi pencatatan keuangan pribadi di mana input transaksi utamanya lewat **suara**, bukan ketik manual. Target: pencatatan secepat mungkin (idealnya <10 detik per transaksi) agar user tidak malas mencatat.

**Referensi arsitektur & data model lengkap:** `desain-sistem-finance-tracker.md` (dokumen terpisah — schema Prisma, flow, API routes ada di sana. Dokumen ini fokus ke requirement fungsional & acceptance criteria).

## 2. Target Pengguna

Individu yang ingin mencatat keuangan pribadi harian tapi malas input manual. Non-teknis, pakai HP sebagai device utama.

## 3. Autentikasi

- **Registrasi:** `email` + `password`, lewat Supabase Auth. Tidak ada field username, nomor HP, atau OTP.
- **Login:** `email` + `password`.
- Email confirmation **dinonaktifkan** — user langsung bisa login setelah registrasi, tanpa klik link verifikasi.
- **Tidak ada UI untuk reset password** — ini keputusan produk yang disengaja. Jangan tambahkan tombol/halaman "lupa password" kecuali diminta eksplisit (lihat DATABASE_ARCHITECTURE.md untuk detail teknis kenapa ini beda dengan "mematikan" kapabilitasnya).
- Acceptance criteria registrasi:
  - [ ] Validasi format email standar di form (client & server).
  - [ ] Password minimal 8 karakter (lihat SECURITY_STANDARDS.md).
  - [ ] Jika email sudah terdaftar, tampilkan error jelas di form.
  - [ ] Setelah registrasi sukses, langsung login otomatis ke dashboard (tanpa menunggu verifikasi email).

## 4. Fitur Utama

### 4.1 Dashboard
- [ ] Menampilkan seluruh dompet user dalam bentuk card (nama, tipe, saldo).
- [ ] Menampilkan total kumulasi saldo dari semua dompet di bagian atas.
- [ ] User bisa tap satu card dompet untuk menjadikannya "dompet aktif" (dipakai sebagai default untuk transaksi berikutnya). Dompet aktif ditandai visual jelas (highlight/border).
- [ ] Tombol mic besar di tengah layar.
- [ ] Tombol `+Catat` untuk buka form manual.
- [ ] Tombol kamera di samping `+Catat` untuk scan resi.
- [ ] List riwayat transaksi terbaru (mis. 10 transaksi terakhir) di bawah.

### 4.2 Input Suara
- [ ] Tap mic → browser minta izin microphone (tangani kasus izin ditolak dengan pesan jelas).
- [ ] Transkrip suara diproses parser untuk ekstrak: jumlah, catatan/merchant, tipe (income/expense).
- [ ] Hasil ekstraksi ditampilkan di **modal konfirmasi** — semua field editable — sebelum disimpan.
- [ ] Jika parser gagal ekstrak jumlah, tampilkan error dan minta user ulangi atau isi manual.
- [ ] Simpan `rawInput` (transkrip asli) untuk setiap transaksi hasil voice.

### 4.3 Input Manual
- [ ] Form berisi: tipe (income/expense), dompet (default: dompet aktif), kategori, jumlah, catatan, tanggal (default: hari ini).
- [ ] Validasi: jumlah harus > 0, kategori & dompet wajib dipilih.

### 4.4 Scan Resi
- [ ] Tombol kamera membuka pilihan: ambil foto langsung atau pilih dari galeri.
- [ ] Gambar diproses OCR (Tesseract.js) untuk ekstrak total & tanggal.
- [ ] Hasil OCR pre-fill ke modal konfirmasi yang sama seperti voice — editable.
- [ ] Gambar resi disimpan (storage) dan ditautkan ke transaksi sebagai bukti.
- [ ] Jika OCR gagal membaca angka, form tetap terbuka kosong untuk diisi manual (jangan blok user).

### 4.5 Dompet
- [ ] User bisa membuat dompet custom (nama, tipe: cash/e-wallet/bank/lainnya, warna/ikon).
- [ ] User bisa edit & arsip (bukan hard delete) dompet.
- [ ] Dompet yang punya riwayat transaksi tidak boleh dihapus permanen — hanya diarsipkan.
- [ ] Fitur transfer saldo antar dompet (mis. tarik tunai bank → cash), dicatat terpisah dari transaksi income/expense (tidak masuk pie chart pengeluaran).

### 4.6 Kategori & Budget
- [ ] User bisa membuat kategori custom per tipe (income/expense).
- [ ] Setiap kategori bisa punya budget limit bulanan (opsional — kategori tanpa limit tidak ikut logika warna).
- [ ] Warna tombol kategori berdasarkan sisa budget periode berjalan:
  - Hijau: sisa >80%
  - Kuning: sisa 50-80%
  - Oranye: sisa 20-50%
  - Merah: sisa <20%
- [ ] Sistem belajar kategori dari histori pilihan user (frequency-based matching dari kata kunci `rawInput`), lalu auto-suggest kategori saat voice input berikutnya — tetap editable di modal konfirmasi.

### 4.7 Statistik
- [ ] Pie chart pengeluaran per kategori (periode dipilih user: minggu ini/bulan ini).
- [ ] Pie chart pemasukan per kategori.
- [ ] Kategori dengan pengeluaran terbesar ditonjolkan.
- [ ] Kalender bulanan menampilkan jumlah transaksi per hari (heatmap/badge count).

## 5. Non-Functional Requirements

- Aplikasi harus tetap bisa dipakai (form manual) jika browser tidak mendukung Web Speech API — jangan block seluruh UI kalau voice tidak tersedia.
- Semua endpoint yang mengubah data uang (transaksi, transfer) harus atomic (lihat SECURITY_STANDARDS.md & desain sistem — Prisma `$transaction`).
- Lihat `SECURITY_STANDARDS.md` untuk requirement keamanan — wajib diikuti, bukan opsional.
- Lihat `CODING_STANDARDS.md` untuk konvensi kode — wajib diikuti oleh AI code generator.

## 6. Eksplisit Di Luar Scope (MVP ini)

- Reset/lupa password.
- Login via email/HP/OAuth/social login.
- Multi-currency.
- Sharing dompet antar user (kolaborasi).
- Notifikasi push.
- Export laporan (PDF/Excel).

Jangan implementasikan item di atas kecuali diminta eksplisit — mencegah AI code generator menambah scope yang tidak diminta.
