# Coding Standards — Finance Tracker

> Dokumen ini adalah aturan wajib untuk AI code generator saat menulis kode proyek ini. Konsisten lebih penting daripada preferensi gaya pribadi — ikuti pola yang sudah ada di codebase kalau ada konflik dengan dokumen ini.

## 1. Stack & Versi

- Next.js (App Router) — TypeScript wajib, tidak ada file `.js`/`.jsx` baru.
- Prisma ORM + PostgreSQL.
- Tailwind CSS untuk styling.
- Zod untuk validasi input di setiap API route.

## 2. Struktur Folder

```
/app
  /(auth)/login/page.tsx
  /(auth)/register/page.tsx
  /(dashboard)/dashboard/page.tsx
  /(dashboard)/dashboard/statistik/page.tsx
  /(dashboard)/dashboard/budget/page.tsx
  /(dashboard)/dashboard/dompet/page.tsx
  /(dashboard)/dashboard/kategori/page.tsx
  /api/transactions/route.ts
  /api/transactions/[id]/route.ts
  /api/wallets/route.ts
  /api/transfers/route.ts
  /api/receipts/parse/route.ts
  /api/voice/suggest-category/route.ts
/components
  /ui           → komponen generik (Button, Card, Modal) — tidak boleh punya business logic
  /features     → komponen spesifik fitur (WalletCard, CategoryBudgetButton, TransactionConfirmModal)
/lib
  /prisma.ts    → Prisma client singleton
  /validators   → schema Zod, satu file per domain (transaction.ts, wallet.ts, dst.)
  /auth.ts      → helper session/auth
/prisma
  /schema.prisma
```

**Aturan:** file baru harus masuk struktur ini. Jangan membuat folder alternatif (mis. `/src`, `/utils` generik tanpa kategori) tanpa alasan yang didokumentasikan di komentar.

## 3. Penamaan

- Komponen React: PascalCase (`WalletCard.tsx`).
- File non-komponen (util, lib): kebab-case atau camelCase konsisten dengan folder sekitarnya.
- Variabel & fungsi: camelCase, deskriptif — hindari singkatan ambigu (`amt` → gunakan `amount`).
- Konstanta global: UPPER_SNAKE_CASE.
- Nama field database: camelCase di Prisma schema (sudah mengikuti konvensi di `desain-sistem-finance-tracker.md` — jangan diubah tanpa alasan kuat).
- Nama tipe/interface TypeScript: PascalCase, tanpa prefix `I` (`Transaction`, bukan `ITransaction`).

## 4. TypeScript

- `strict: true` di `tsconfig.json` — wajib.
- Dilarang pakai `any` kecuali ada komentar `// TODO: kenapa any diperlukan di sini`.
- Semua fungsi exported harus punya tipe return eksplisit.
- Gunakan `type` untuk union/props sederhana, `interface` untuk shape yang mungkin di-extend.
- Tipe request/response API didefinisikan di `/lib/types` dan diimpor di kedua sisi (client & route handler) — jangan duplikasi definisi tipe.

## 5. Komponen React

- Default ke **Server Component**. Tambahkan `"use client"` hanya kalau butuh interaktivitas (state, event handler, browser API seperti Web Speech API/kamera).
- Komponen di `/components/ui` tidak boleh fetch data atau import Prisma — murni presentational.
- Props komponen selalu didefinisikan lewat `type XProps = { ... }`, tidak inline kecuali komponen sangat kecil (<10 baris).
- Hindari prop drilling lebih dari 2 level — pakai Zustand store atau context kalau lebih dalam dari itu.

## 6. API Routes

- Setiap route handler:
  1. Validasi input dengan Zod di awal — return `400` dengan pesan jelas kalau gagal.
  2. Cek autentikasi/kepemilikan resource (user hanya boleh akses dompet/transaksi miliknya sendiri).
  3. Operasi DB yang mengubah lebih dari satu tabel (mis. transaksi + update saldo dompet) wajib dibungkus `prisma.$transaction(...)`.
  4. Response error selalu format konsisten: `{ error: { code: string, message: string } }`.
  5. Response sukses selalu format konsisten: `{ data: ... }`.
- Jangan taruh business logic di dalam route handler kalau lebih dari ~20 baris — pindahkan ke `/lib/services/`.

## 7. Error Handling

- Tidak boleh ada `catch (e) {}` kosong — minimal log error-nya.
- Error yang ditampilkan ke user harus bahasa manusia (Bahasa Indonesia), bukan stack trace atau pesan teknis Prisma mentah.
- Untuk fitur yang bergantung pada browser API (Web Speech API, kamera) yang mungkin tidak didukung/izin ditolak — selalu ada fallback UI, jangan crash atau blank screen.

## 8. Uang & Angka

- Semua nilai uang di database pakai tipe `Decimal` (Prisma), **jangan** `Float`/`Int` biasa — menghindari floating point error.
- Di frontend, format tampilan uang pakai `Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })` — konsisten di semua halaman.
- Parsing angka dari voice ("13 ribu", "13rb") harus lewat satu fungsi utilitas terpusat (`/lib/parseVoiceAmount.ts`), jangan duplikasi logic parsing di banyak tempat.

## 9. Git & Commit

- Format commit: Conventional Commits (`feat:`, `fix:`, `refactor:`, `chore:`, `docs:`).
- Satu commit = satu perubahan logis. Jangan gabung fitur tidak berkaitan dalam satu commit.

## 10. Komentar & Dokumentasi

- Komentar menjelaskan **kenapa**, bukan **apa** (kode sudah menjelaskan apa).
- Fungsi dengan logic non-trivial (mis. parser voice, kalkulasi warna budget, category learning) wajib punya komentar penjelasan di atasnya.
