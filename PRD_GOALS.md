# PRD Update — Halaman Goals (Tabungan Bertujuan)

> Delta di atas fitur yang sudah ada. Nav sekarang jadi **5**: Dashboard, Statistik, Budget (dengan btn Kategori di dalamnya), Dompet, **Goals** (baru).

## 1. Konteks & Tujuan

User bisa bikin tujuan tabungan spesifik (mis. "Beli Motor") dengan target nominal. Saat mencatat pemasukan, sistem menyarankan alokasi otomatis ke Dana Abadi **dan** ke goal aktif — keduanya independen, keduanya bisa di-skip.

## 2. Keputusan Arsitektur Penting

**Setiap Goal punya dompet dedicated 1:1** (`Goal.walletId`), bukan sekadar angka pembukuan terpisah. Alasannya: kalau `Goal.currentAmount` cuma angka mandiri (tidak terikat ke dompet nyata), gampang jadi tidak sinkron dengan uang yang benar-benar ada — atau lebih parah, uangnya bisa "double-counted" (dianggap ada di goal sekaligus bisa dipakai bebas dari dompet biasa). Dengan dompet dedicated:
- `Goal.currentAmount` yang ditampilkan ke user = `Wallet.balance` dompet itu langsung — satu sumber kebenaran, sesuai pola yang sama dipakai fitur Dana Abadi.
- Alokasi ke goal pakai mekanisme **`Transfer`** yang sudah ada (dari dompet asal pemasukan ke dompet dedicated goal) — tidak perlu logic baru.
- Dompet goal **tidak muncul** di halaman Dompet biasa (di-filter berdasarkan `Wallet.goal` terisi atau tidak) — supaya tidak campur dengan dompet transaksi harian, hanya muncul di halaman Goals sebagai progress bar.

## 3. Fitur Detail

### 3.1 Halaman Goals (Baru)
- [ ] Nav item baru "Goals".
- [ ] List semua goal aktif sebagai card: nama, progress bar (`wallet.balance` / `targetAmount`), target tanggal (kalau diisi), tombol edit/arsipkan.
- [ ] Tombol "+ Goal Baru": input nama bebas, target nominal, target tanggal (opsional), persentase alokasi otomatis (default 5%, bisa diubah user per goal).
- [ ] Saat goal dibuat, sistem otomatis bikin `Wallet` dedicated di baliknya (tidak terlihat sebagai dompet biasa oleh user, cukup direpresentasikan sebagai goal).
- [ ] Goal yang sudah tercapai (`wallet.balance >= targetAmount`) ditandai visual (`isCompleted = true`) — tetap muncul di list, tidak otomatis hilang, user yang putuskan mau diarsipkan atau lanjut nabung lebih.

### 3.2 Auto-Suggest Alokasi (Generalisasi dari Fitur Dana Abadi)
- [ ] Banner non-blocking setelah transaksi `INCOME` tersimpan (perilaku existing dari `PRD_DANA_ABADI.md` 3.2) **diperluas**: sekarang menampilkan saran alokasi untuk **Dana Abadi + setiap goal aktif**, masing-masing sebagai baris terpisah dengan tombol "Alokasikan"/"Lewati" sendiri-sendiri — bukan satu tombol gabungan.
- [ ] Contoh tampilan: "Sisihkan 10% ke Dana Abadi (Rp X)" dan "Sisihkan 5% ke goal Motor (Rp Y)" — user bisa pilih salah satu, keduanya, atau lewati semua.
- [ ] Tiap "Alokasikan" pada goal → buat `Transfer` dari dompet asal ke `Goal.walletId` terkait, sejumlah `amount × (Goal.allocationPercent / 100)`.
- [ ] Kalau user tidak punya goal aktif sama sekali, baris saran goal tidak muncul (hanya Dana Abadi seperti sebelumnya).

### 3.3 Dana Darurat — Belum Difinalkan (Diskusi Lanjutan)

Ini masih konsep, belum saya masukkan sebagai spesifikasi final. Usulan saya: **Dana Darurat tidak perlu jadi model/fitur terpisah** — ini bisa jadi **preset Goal** dengan dua pembeda dari goal biasa:
1. **Target disarankan otomatis** dari data yang sudah ada di aplikasi: umumnya aturan dana darurat itu 3-6x pengeluaran bulanan rata-rata (angka yang sudah bisa dihitung dari histori transaksi user, sama seperti yang dipakai Simulator B).
2. **Ditawarkan proaktif** ke user baru (mis. banner "mau mulai dana darurat?") — beda dari goal biasa yang user inisiasi sendiri.

Ini masih usulan, bukan keputusan final — perlu dikonfirmasi dulu sebelum saya tuliskan sebagai spesifikasi resmi.

## 4. Non-Functional Requirements
- Konsisten dengan `CODING_STANDARDS.md`: operasi transfer ke goal tetap wajib `prisma.$transaction()` (update saldo dua dompet sekaligus).
- Query goal wajib filter `userId`, konsisten `SECURITY_STANDARDS.md`.

## 5. Eksplisit Di Luar Scope (Update Ini)
- Dana Darurat sebagai fitur final (masih tahap diskusi, lihat 3.3).
- Notifikasi/reminder kalau goal mendekati deadline tapi progressnya jauh dari target.
- Berbagi/kolaborasi goal antar user (goal keluarga/bersama).

Jangan implementasikan item di atas kecuali diminta eksplisit.
