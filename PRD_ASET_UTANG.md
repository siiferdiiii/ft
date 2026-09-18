# PRD Update — Aset, Utang, Liquid Cash T+3, Free Cash Flow

> Delta di atas fitur budget yang sudah ada. Fitur ini menggeser sebagian scope app dari "pencatat arus kas harian" ke juga mencakup **snapshot kekayaan bersih** — sengaja dibuat sebagai **halaman terpisah**, tidak dicampur ke flow pencatatan harian (dashboard/voice input) yang sudah dirancang sesimpel mungkin.

⚠️ **Benturan dengan keputusan lama:** PRD utama menetapkan "notifikasi push" di luar scope. Reminder cicilan di fitur ini didesain sebagai **reminder pasif in-app** (muncul saat user buka halaman, bukan push notification aktif) — kalau nanti mau upgrade ke push sungguhan, itu butuh infrastruktur baru (FCM/APNs) yang belum ada, dicatat terpisah di bagian 6.

## 1. Konteks & Tujuan

Menambahkan halaman "Aset & Utang" untuk melacak kekayaan bersih: aset (custom oleh user, seperti pola dompet/kategori yang sudah ada), utang dengan jadwal cicilan, metrik "uang yang bisa dicairkan cepat" (Liquid Cash T+3), dan Free Cash Flow bulanan.

**Prinsip bahasa:** istilah teknis (T+3, liquidity tier) dipakai di kode/logic, **bukan** ditampilkan mentah ke user — UI pakai bahasa awam (lihat 2.1).

## 2. Fitur Detail

### 2.1 Halaman "Aset & Utang" (Baru)
- [ ] Halaman terpisah, diakses dari menu navigasi utama.
- [ ] Summary card di atas: **Total Aset**, **Total Utang**, **Kekayaan Bersih** (= saldo semua dompet + total aset − total utang), dan **"Uang yang bisa dicairkan dalam 3 hari"** (label UI — ini representasi awam dari Liquid Cash T+3, lihat 2.2).

### 2.2 Aset (Custom oleh User)
- [ ] User bikin aset sendiri (nama bebas + kategori bebas diisi teks, sama pola dengan kategori transaksi/dompet yang sudah ada) — tidak ada daftar kategori aset yang dihardcode.
- [ ] Setiap aset wajib pilih **tingkat likuiditas** lewat dropdown berbahasa awam:
  - "Bisa dicairkan hari ini" → `INSTANT` (mis. tabungan, e-wallet).
  - "Butuh proses ~3 hari kerja" → `T3` (mis. reksadana, saham, deposito jangka pendek).
  - "Susah dicairkan cepat" → `ILLIQUID` (mis. properti, kendaraan, barang koleksi).
- [ ] Nilai aset diinput/diupdate **manual** oleh user (tidak ada integrasi harga pasar real-time — di luar scope).
- [ ] `lastValuationAt` dipakai untuk menampilkan reminder halus ("terakhir diupdate 4 bulan lalu") kalau nilai aset sudah lama tidak diperbarui — bukan wajib update, cuma pengingat visual.
- [ ] Aset bisa diarsipkan (bukan hard delete) kalau sudah tidak dimiliki lagi (mis. terjual).

### 2.3 Utang (dengan Jadwal Cicilan & Reminder)
- [ ] User catat utang: nama bebas, total utang awal (`principal`), sisa utang berjalan (`remainingBalance`), cicilan per bulan (opsional), tanggal jatuh tempo tiap bulan (opsional, 1-31), bunga per tahun (opsional).
- [ ] **Reminder cicilan (in-app, bukan push):** saat user membuka halaman "Aset & Utang" **atau** dashboard, sistem cek utang aktif yang `dueDayOfMonth`-nya dalam ≤3 hari dari tanggal hari ini → tampilkan banner/badge ("Cicilan [nama] jatuh tempo dalam N hari, Rp [nominal]"). Ini bukan notifikasi push — hanya muncul kalau user membuka aplikasi.
- [ ] User bisa tandai utang "lunas" (`isPaidOff = true`) — bukan dihapus, tetap tersimpan sebagai riwayat.
- [ ] Setelah bayar cicilan, user **tidak otomatis** update `remainingBalance` dari transaksi pengeluaran biasa (tidak ada linking otomatis ke `Transaction` di versi ini) — user update manual di halaman ini. (Linking otomatis dicatat sebagai opsi masa depan, lihat bagian 6.)

### 2.4 Liquid Cash T+3
- [ ] Kalkulasi: total saldo semua dompet aktif (dompet selalu dianggap instant-liquid) **+** total nilai aset dengan `liquidityTier` `INSTANT` atau `T3`.
- [ ] Aset `ILLIQUID` **tidak** dihitung dalam metrik ini.
- [ ] Ditampilkan di summary card halaman ini dengan label awam (lihat 2.1) — istilah "T+3"/"liquidity tier" tidak pernah muncul di UI, hanya di kode/dokumentasi teknis.

### 2.5 Free Cash Flow (Bulanan)
- [ ] Ditampilkan di halaman Statistik (bukan halaman Aset & Utang) karena sifatnya berbasis periode seperti metrik statistik lain yang sudah ada.
- [ ] Kalkulasi: Total Pemasukan bulan berjalan − Total Pengeluaran bulan berjalan − Total `monthlyPayment` dari semua utang aktif (belum lunas).
- [ ] Ini murni angka turunan (read-only), tidak ada input baru dari user untuk metrik ini.

## 3. Data Model

Ditambahkan ke `schema.prisma`: model `Asset` (dengan enum `AssetLiquidityTier`) dan `Debt` — detail lengkap sudah ada di file `schema.prisma`.

## 4. Non-Functional Requirements
- Semua kalkulasi (Kekayaan Bersih, Liquid Cash T+3, Free Cash Flow) dihitung server-side dari data Prisma saat halaman dibuka — bukan disimpan sebagai angka statis yang bisa basi.
- Nilai uang tetap pakai `Decimal`, konsisten dengan `CODING_STANDARDS.md`.
- Query aset/utang wajib filter `userId`, konsisten dengan `SECURITY_STANDARDS.md`.

## 5. Berdiri Sendiri (Belum Terhubung ke Fitur Lain)
- Sesuai keputusan saat ini, data Aset & Utang **tidak** dipakai di Simulator "Dana Abadi Tidak Pernah Habis" (tetap pakai saldo dompet ber-flag Dana Abadi seperti sebelumnya). Ini bisa dihubungkan nanti kalau sudah divalidasi fitur dasarnya jalan dengan baik.

## 6. Eksplisit Di Luar Scope (Update Ini)
- Reminder cicilan lewat **push notification sungguhan** (butuh infrastruktur FCM/APNs baru) — versi ini hanya reminder in-app pasif.
- Integrasi harga pasar real-time untuk aset investasi (saham/reksadana) — nilai tetap input manual.
- Auto-update `remainingBalance` utang dari transaksi pengeluaran otomatis — user update manual.
- Menghubungkan data Aset & Utang ke Simulator Dana Abadi (lihat bagian 5) — opsi masa depan.
- Riwayat perubahan nilai aset dari waktu ke waktu (grafik kekayaan bersih historis) — versi ini hanya snapshot terkini.

Jangan implementasikan item di atas kecuali diminta eksplisit.
