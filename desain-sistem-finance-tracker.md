# Desain Sistem — Finance Tracker (Voice-First)

## 1. Ringkasan Arsitektur

**Stack:** Next.js (App Router, full stack) + Prisma ORM + PostgreSQL (Supabase/Neon)
**Voice-to-text:** Web Speech API (browser-native, gratis)
**OCR resi:** perlu API tambahan (lihat bagian 6)
**Auth:** Supabase Auth — email + password, email confirmation off, tanpa UI reset password. Lihat DATABASE_ARCHITECTURE.md & SECURITY_STANDARDS.md
**State management:** Zustand atau React Query (untuk sync saldo real-time antar card dompet)

Flow tingkat tinggi:

```
[Voice/Form/Scan Input] → [Parser/Extractor] → [Halaman Konfirmasi] → [Simpan ke DB] → [Update saldo dompet + Update sisa budget kategori]
```

---

## 2. Data Model (Prisma Schema)

```prisma
model User {
  id           String   @id // sama dengan auth.users.id dari Supabase Auth (UUID)
  email        String   @unique // mirror dari auth.users.email
  name         String?
  wallets      Wallet[]
  categories   Category[]
  transactions Transaction[]
  createdAt    DateTime @default(now())
}
```
> **Auth:** Supabase Auth (email + password), email confirmation dinonaktifkan, tanpa UI reset password. Detail lengkap di `DATABASE_ARCHITECTURE.md` dan `SECURITY_STANDARDS.md`.

```prisma

model Wallet {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  name         String   // "Cash", "GoPay", "BCA", atau custom
  type         WalletType // CASH | EWALLET | BANK | OTHER
  icon         String?  // untuk tampilan card
  color        String?  // untuk tampilan card
  balance      Decimal  @default(0) // saldo ter-cache, dihitung ulang dari transaksi
  isArchived   Boolean  @default(false)
  transactions Transaction[]
  createdAt    DateTime @default(now())
}

enum WalletType {
  CASH
  EWALLET
  BANK
  OTHER
}

model Category {
  id          String   @id @default(cuid())
  userId      String
  user        User     @relation(fields: [userId], references: [id])
  name        String
  icon        String?
  type        TransactionType // INCOME | EXPENSE (kategori terpisah per tipe)
  budgetLimit Decimal? // nullable — kategori tanpa budget tidak ikut logika warna
  budgetPeriod BudgetPeriod @default(MONTHLY)
  transactions Transaction[]
  createdAt   DateTime @default(now())
}

enum BudgetPeriod {
  WEEKLY
  MONTHLY
}

model Transaction {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  walletId     String
  wallet       Wallet   @relation(fields: [walletId], references: [id])
  categoryId   String?
  category     Category? @relation(fields: [categoryId], references: [id])
  type         TransactionType // INCOME | EXPENSE
  amount       Decimal
  note         String?
  source       InputSource // VOICE | MANUAL | RECEIPT_SCAN
  rawInput     String?  // teks asli hasil voice-to-text, untuk audit/debug parser
  receiptImageUrl String?
  transactionDate DateTime @default(now())
  createdAt    DateTime @default(now())
}

enum TransactionType {
  INCOME
  EXPENSE
}

enum InputSource {
  VOICE
  MANUAL
  RECEIPT_SCAN
}

model Transfer {
  id             String   @id @default(cuid())
  userId         String
  fromWalletId   String
  toWalletId     String
  amount         Decimal
  note           String?
  transferDate   DateTime @default(now())
  createdAt      DateTime @default(now())
}
```

**Catatan Transfer:** transfer TIDAK dicatat sebagai dua `Transaction` (income di satu dompet, expense di dompet lain), karena itu akan mengotori laporan pengeluaran/pemasukan dan pie chart statistik (transfer bukan pengeluaran/pemasukan riil). Ditangani sebagai entity terpisah yang hanya mempengaruhi `Wallet.balance` kedua dompet, dan ditampilkan di riwayat sebagai jenis aktivitas berbeda dari transaksi.

**Catatan desain:**
- `Wallet.balance` sebaiknya kolom ter-cache (bukan dihitung on-the-fly tiap request) supaya card dompet di dashboard cepat dimuat. Update lewat transaction saat create/update/delete transaksi (idealnya dalam satu DB transaction Prisma `$transaction`).
- `rawInput` penting untuk voice — kalau parser sering salah, kamu punya data historis buat evaluasi/improve parsing tanpa harus rekam ulang.

---

## 3. Flow Detail per Fitur

### A. Voice Input
1. User tap dompet aktif di dashboard (disimpan di state, jadi default wallet untuk transaksi berikutnya).
2. User tap tombol mic → browser minta izin mic → Web Speech API mulai mendengarkan.
3. Hasil transkrip (misal: "beli kopi 13 ribu") dikirim ke **parser**.
4. Parser mengekstrak: `amount`, `note/merchant`, `type` (income/expense — default expense kecuali ada kata kunci seperti "dapat", "gajian", "terima"), dan mencoba menebak `category` berdasarkan kata kunci note.
5. Tampilkan **halaman/modal konfirmasi**: dompet, kategori (bisa diganti manual), jumlah, catatan — semua editable sebelum disimpan.
6. User konfirmasi → simpan transaksi → update saldo dompet & sisa budget kategori.

### B. Manual Form
1. User tap `+Catat` → buka form.
2. Form: tipe (income/expense), dompet (default: dompet aktif), kategori, jumlah, catatan, tanggal (default: hari ini).
3. Simpan langsung tanpa langkah konfirmasi tambahan (form itu sendiri sudah jadi "verifikasi").

### C. Scan Resi
1. User tap tombol kamera (di samping `+Catat`) → pilih dari galeri atau kamera langsung.
2. Gambar dikirim ke OCR service → hasil ekstraksi total, tanggal, nama merchant.
3. Hasil masuk ke halaman konfirmasi yang sama seperti voice (form pre-filled, user bisa koreksi sebelum simpan).
4. `receiptImageUrl` disimpan (upload ke storage — Supabase Storage/S3) untuk arsip bukti transaksi.

**Kenapa disatukan flow konfirmasinya:** voice dan scan resi sama-sama "input tidak 100% akurat", jadi satu komponen `TransactionConfirmModal` yang menerima data pre-filled dari sumber manapun (voice/OCR) — lebih maintainable daripada dua modal terpisah.

---

## 4. Logika Warna Budget Kategori

Dihitung per kategori, per periode budget (mingguan/bulanan):

```
sisaPersen = (budgetLimit - totalPengeluaranPeriodeIni) / budgetLimit * 100

if sisaPersen > 80%        → Hijau
if 50% < sisaPersen <= 80% → Kuning
if 20% < sisaPersen <= 50% → Oranye
if sisaPersen <= 20%       → Merah
```

Periode default: **Bulanan** (`BudgetPeriod.MONTHLY`), sesuai `Category.budgetPeriod` di schema.

Kategori tanpa `budgetLimit` di-set → tombol kategori tampil warna netral (abu-abu), tidak ikut logika ini.

---

## 5. Struktur Halaman (Frontend)

```
/dashboard          → Card dompet + total saldo, tombol mic tengah, +Catat, riwayat transaksi terbaru
/dashboard/statistik → Pie chart income/expense, kategori terbesar, kalender heatmap transaksi
/dashboard/budget   → Pengaturan budget per kategori
/dashboard/dompet   → CRUD dompet custom
/dashboard/kategori → CRUD kategori custom + set budget
/settings           → Profil, preferensi
```

Komponen kunci yang dipakai lintas halaman:
- `WalletCard` (dashboard + halaman dompet)
- `CategoryBudgetButton` (warna dinamis — dipakai di form manual, modal konfirmasi, halaman budget)
- `TransactionConfirmModal` (dipakai voice & scan resi)

---

## 6. Keputusan Terkonfirmasi

- **OCR resi:** Tesseract.js.
- **Periode budget default:** Bulanan.
- **Transfer antar dompet:** dibutuhkan — lihat model `Transfer` di bagian 2.
- **Deteksi kategori otomatis:** belajar dari histori pilihan user (bukan kamus statis) — lihat desain di bagian 6a.

## 6a. Desain Category Learning (dari histori user)

Karena kategori bersifat custom per user, pendekatannya bukan NLP model besar, tapi **frequency-based matching** yang cukup untuk MVP dan bisa di-upgrade nanti:

1. Setiap kali transaksi disimpan (voice/manual/scan), simpan pasangan `(kata kunci dari note, categoryId)` yang dipilih user — misal ke tabel `CategoryKeyword`.
2. Saat voice baru masuk, ekstrak kata benda/kunci dari `rawInput` (mis. "kopi" dari "beli kopi 13 ribu"), cocokkan dengan `CategoryKeyword` milik user tersebut.
3. Kalau ada match dengan confidence cukup (mis. kata itu sudah dipakai ≥2x untuk kategori yang sama), auto-pilih kategori itu di halaman konfirmasi — tapi tetap **editable**, bukan final.
4. Kalau tidak ada match, biarkan kategori kosong di form konfirmasi → wajib dipilih manual user, sekaligus jadi data training untuk keyword berikutnya.

```prisma
model CategoryKeyword {
  id         String   @id @default(cuid())
  userId     String
  keyword    String   // kata kunci, lowercase, sudah di-normalize
  categoryId String
  category   Category @relation(fields: [categoryId], references: [id])
  frequency  Int      @default(1) // berapa kali kata ini dipakai untuk kategori ini
  updatedAt  DateTime @updatedAt

  @@unique([userId, keyword, categoryId])
}
```

Pendekatan ini sengaja sederhana (bukan ML) supaya bisa jalan tanpa infra tambahan, tapi tetap "belajar" — akurasi akan naik seiring user pakai aplikasi.

## 6b. Masih Perlu Diputuskan

1. **Parsing angka dari suara** — "13 ribu", "13rb", "tiga belas ribu" perlu normalizer khusus Bahasa Indonesia (regex + kamus angka), Web Speech API tidak melakukan ini otomatis.
2. **Kalkulasi ulang saldo dompet** — pastikan update saldo (termasuk dari Transfer) dan pengecekan budget terjadi dalam satu database transaction agar tidak ada race condition.
3. **Ambang confidence untuk auto-pilih kategori** — di desain 6a, angka "≥2x" itu contoh awal, perlu disesuaikan setelah ada data pemakaian nyata.

---

## 7. Ringkasan API Routes (Next.js App Router)

```
POST   /api/transactions          → buat transaksi (voice/manual/scan)
GET    /api/transactions          → riwayat + filter (dompet, kategori, tanggal)
PATCH  /api/transactions/:id      → edit
DELETE /api/transactions/:id      → hapus

GET/POST   /api/wallets
PATCH/DELETE /api/wallets/:id

GET/POST   /api/categories
PATCH/DELETE /api/categories/:id  → termasuk update budgetLimit

POST   /api/receipts/parse        → upload gambar → OCR → return data pre-fill
GET    /api/statistics            → agregat untuk pie chart + kalender

POST   /api/transfers             → buat transfer antar dompet
GET    /api/transfers             → riwayat transfer

POST   /api/voice/suggest-category → input: rawInput teks → return: categoryId tersugesti (dari CategoryKeyword) atau null
```

> Catatan implementasi: relasi `CategoryKeyword` ↔ `Category`/`User` dan `Transfer` ↔ `Wallet` perlu ditambahkan di schema Prisma final (di atas disederhanakan supaya fokus ke struktur data intinya).
