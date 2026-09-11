# Database Architecture — Supabase

> Dokumen ini menjelaskan cara proyek ini memakai Supabase secara spesifik. Baca bersama `schema.prisma` (skema final) dan `SECURITY_STANDARDS.md`.

## 1. Peran Supabase di Proyek Ini

Supabase dipakai untuk:
- **Supabase Auth** — registrasi & login dengan **email + password**. Email confirmation di-**nonaktifkan** di Supabase Dashboard (Authentication → Settings) supaya user bisa langsung login setelah registrasi tanpa verifikasi email (sesuai keputusan produk: tidak ada friksi OTP/verifikasi).
- **Postgres database** (lewat Prisma untuk tabel aplikasi: Wallet, Category, Transaction, dst.) — terpisah dari tabel `auth.users` bawaan Supabase.
- **Storage** untuk gambar resi transaksi.

⚠️ **Catatan soal "tanpa reset password":** Supabase Auth secara teknis punya endpoint reset password (kirim email reset). Keputusan produk kita adalah **tidak membangun UI untuk reset password** — bukan mematikan kapabilitasnya di level Supabase (mematikannya butuh effort ekstra dan tidak perlu). Efeknya sama dari sisi user (tidak ada tombol "lupa password" di aplikasi), tapi AI code generator perlu tahu bedanya ini supaya tidak coba "menyembunyikan" fitur yang justru aman dibiarkan tidak terekspos di UI saja.

## 2. Relasi User Aplikasi ↔ Supabase Auth

- Supabase otomatis membuat & mengelola tabel `auth.users` (email, password hash, dll — kita tidak menyentuh ini langsung).
- Tabel `User` di `schema.prisma` (skema aplikasi kita, lewat Prisma) **bukan** duplikat auth, tapi tabel profil aplikasi:
  - `User.id` **harus** diisi sama dengan `auth.users.id` (UUID dari Supabase Auth) saat registrasi — bukan `@default(cuid())`.
  - `User.email` di-mirror dari `auth.users.email` supaya query di sisi aplikasi (Prisma) tidak perlu join ke skema `auth`.
- Alur registrasi:
  1. Client submit email+password ke Supabase Auth (`supabase.auth.signUp`).
  2. Supabase Auth buat row di `auth.users`, return `user.id`.
  3. Server (API route) buat row `User` di database aplikasi lewat Prisma, pakai `id` yang sama dari step 2.
  - Kedua step ini idealnya dalam satu request API route (server-side), bukan langsung dari client, supaya konsisten kalau step 2 gagal.

## 3. Koneksi Database (Connection Strings)

Untuk tabel aplikasi (lewat Prisma), Supabase menyediakan dua jenis koneksi Postgres — **wajib dibedakan**:

| Env Var | Port | Mode | Dipakai untuk |
|---|---|---|---|
| `DATABASE_URL` | 6543 | Pooled (PgBouncer, transaction mode) | Runtime aplikasi (API routes) |
| `DIRECT_URL` | 5432 | Direct connection | `prisma migrate dev/deploy` |

```prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}
```

⚠️ Migrasi lewat `DATABASE_URL` (pooled) bisa gagal karena PgBouncer transaction mode tidak mendukung prepared statements yang dibutuhkan migrasi. AI code generator wajib pakai `DIRECT_URL` untuk perintah migrate.

## 4. Row Level Security (RLS)

Karena sekarang pakai Supabase Auth, JWT user berisi `auth.uid()` asli — ini membuat RLS berbasis kepemilikan jadi opsi yang valid (beda dari rencana sebelumnya waktu masih custom auth). Tapi karena semua akses tabel aplikasi tetap lewat **Next.js API routes + Prisma di server** (bukan client langsung query Supabase pakai `anon key`), otorisasi utama tetap di application layer (setiap query Prisma filter `userId`, sesuai `SECURITY_STANDARDS.md`).

Tetap aktifkan RLS di semua tabel aplikasi sebagai defense-in-depth:

```sql
alter table "User" enable row level security;
alter table "Wallet" enable row level security;
alter table "Category" enable row level security;
alter table "Transaction" enable row level security;
alter table "Transfer" enable row level security;
alter table "CategoryKeyword" enable row level security;

-- Default deny untuk role anon/authenticated — Prisma connect pakai role yang bypass RLS.
```

## 5. Supabase Storage — Bucket Resi

- **Nama bucket:** `receipts`, visibility **private**.
- **Struktur path:** `receipts/{userId}/{transactionId}.jpg`.
- **Akses:** upload/download lewat server (API route) pakai `SUPABASE_SERVICE_ROLE_KEY`, generate **signed URL** (expiry pendek, mis. 1 jam) untuk ditampilkan di frontend.

## 6. Environment Variables

```
DATABASE_URL=                # pooled connection string, port 6543 — untuk Prisma runtime
DIRECT_URL=                  # direct connection string, port 5432 — untuk prisma migrate
SUPABASE_URL=                 # https://<project-ref>.supabase.co
SUPABASE_ANON_KEY=            # dipakai client-side untuk supabase.auth.signUp/signIn
SUPABASE_SERVICE_ROLE_KEY=    # RAHASIA — hanya dipakai server-side untuk Storage & operasi admin
```

## 7. Migration Workflow

- `schema.prisma` adalah sumber kebenaran untuk tabel aplikasi. Jangan ubah struktur tabel manual lewat Supabase Studio.
- Alur: edit `schema.prisma` → `prisma migrate dev --name <nama>` (pakai `DIRECT_URL`) → `prisma migrate deploy` saat production.
- Tabel `auth.users` dikelola penuh oleh Supabase — tidak pernah dimigrasikan lewat Prisma.

## 8. Backup

Cek retensi backup otomatis sesuai tier Supabase yang dipakai. Untuk data finansial pribadi, pertimbangkan export berkala manual (`pg_dump`) sebagai tambahan sebelum migrasi besar.
