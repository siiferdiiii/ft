# Security Standards — Finance Tracker

> Dokumen ini WAJIB diikuti AI code generator. Ini aplikasi keuangan pribadi — data yang disimpan sensitif meskipun tidak ada integrasi bank langsung. Jangan skip poin manapun demi kecepatan development.

## 1. Autentikasi (Supabase Auth, Email + Password)

- **Hashing & penyimpanan password:** ditangani sepenuhnya oleh Supabase Auth — aplikasi **tidak menyimpan password sama sekali** di tabel sendiri. Ini pengurangan risiko besar dibanding custom auth.
- **Validasi password saat registrasi:** minimal 8 karakter (validasi di client sebelum kirim ke Supabase, plus Supabase punya validasi minimum sendiri).
- **Email confirmation:** dinonaktifkan di Supabase Dashboard (Authentication → Settings → "Confirm email" off) — user langsung aktif setelah signup, sesuai keputusan produk tanpa friksi verifikasi.
- **Rate limiting login:** Supabase Auth punya rate limiting bawaan untuk endpoint auth — tidak perlu implementasi manual, tapi cek limit default di dashboard cukup untuk kebutuhan MVP.
- **Session:** dikelola Supabase Auth lewat `@supabase/ssr` (cookie-based session untuk Next.js App Router) — jangan simpan token auth manual di localStorage.
- **Sinkronisasi user ke tabel aplikasi:** setiap signup sukses, server (API route) wajib membuat row `User` di database aplikasi dengan `id` yang sama persis dengan `auth.users.id` (lihat `DATABASE_ARCHITECTURE.md` bagian 2). Kalau step ini gagal setelah `auth.users` berhasil dibuat, harus ada retry/reconciliation — jangan biarkan user "auth-only tanpa profil aplikasi".

### ⚠️ Soal "Tidak Ada Reset Password"

Ini keputusan **level UI/produk**, bukan mematikan kapabilitas Supabase Auth sepenuhnya (lihat penjelasan teknis di `DATABASE_ARCHITECTURE.md` bagian 1). Konsekuensi praktis: kalau user lupa password, tidak ada jalan keluar dari dalam aplikasi kecuali kamu (developer) turun tangan manual lewat Supabase Dashboard untuk reset akun tersebut. Untuk skala kecil ini oke; kalau user bertambah banyak, pertimbangkan menambah UI reset password standar Supabase (`resetPasswordForEmail`) — infrastrukturnya sudah ada, tinggal dibuatkan halamannya.

AI code generator: jangan membangun halaman/tombol "lupa password" kecuali diminta eksplisit oleh developer (Ferdi).

## 2. Validasi Input

- Setiap API route: validasi body/query dengan Zod **sebelum** menyentuh database. Tidak ada input yang langsung dipakai mentah.
- Validasi tipe, panjang string, dan range angka (mis. `amount` harus `> 0` dan punya batas atas wajar untuk mencegah overflow/abuse).
- Sanitasi teks bebas (`note`, `name` dompet/kategori) sebelum render ke HTML — cegah stored XSS. Next.js React sudah escape default, tapi hindari `dangerouslySetInnerHTML` untuk data user sama sekali.

## 3. Database & Query

- Semua akses DB lewat Prisma — **tidak ada raw SQL string concatenation**. Kalau terpaksa raw query, wajib pakai parameterized query (`$queryRaw` dengan tagged template, bukan string interpolation).
- Setiap query yang mengambil/mengubah data (transaksi, dompet, kategori) wajib filter `where: { userId: session.user.id }` — user tidak boleh bisa akses/edit data user lain lewat manipulasi ID di request.
- Operasi multi-tabel (transaksi + update saldo, transfer antar dompet) wajib `prisma.$transaction()` untuk mencegah data tidak konsisten kalau salah satu step gagal.

## 4. Upload File (Resi)

- Validasi MIME type di server (bukan hanya ekstensi file) — hanya terima `image/jpeg`, `image/png`, `image/webp`.
- Batasi ukuran file (mis. maks 5MB).
- Generate nama file baru (random/UUID) saat upload — jangan pakai nama file asli dari user (path traversal risk).
- Storage bucket (Supabase Storage/S3) untuk resi harus **private by default**, akses lewat signed URL dengan expiry, bukan public URL permanen — ini data finansial pribadi.

## 5. Secrets & Environment

- Semua secret (database URL, JWT signing secret, storage API key) di `.env`, **tidak pernah** hardcode di kode atau commit ke git.
- `.env` wajib ada di `.gitignore` sejak commit pertama.
- Signing secret untuk session/JWT minimal 32 karakter random, generate sekali, jangan pakai default/contoh dari tutorial.

## 6. Rate Limiting & Abuse Prevention

- Selain login, endpoint yang berat (OCR parsing, voice category suggestion) sebaiknya di-rate-limit per user untuk mencegah abuse/biaya server membengkak.

## 7. Dependency

- Jangan menambahkan package dengan maintenance yang sudah mati atau tanpa TypeScript types kalau ada alternatif aktif.
- Jalankan audit dependency (`npm audit`) secara berkala, terutama sebelum deploy.

## 8. Logging & Privasi Data

- **Jangan pernah log** password (plaintext maupun hash), session token, atau isi lengkap `rawInput`/gambar resi ke console/log produksi tanpa masking.
- Log error boleh menyertakan ID transaksi/user untuk debugging, tapi tidak nilai uang detail di log level yang bisa diakses luas — pertimbangkan audit trail terpisah kalau diperlukan.

## 9. Transport

- Deploy wajib di belakang HTTPS (Vercel/hosting modern otomatis menyediakan ini) — tidak ada pengecualian, termasuk saat staging/demo ke orang lain.
