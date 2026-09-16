# PRD Update — Interview Budget dengan AI (Percakapan Multi-Turn)

> Delta di atas `PRD_AI_BUDGET_VOICE.md`. Dokumen ini **menggantikan** spesifikasi "2.2.B Saran alokasi budget per kategori" di dokumen tersebut — bukan tambahan sejajar, tapi versi yang lebih lengkap: dari "AI kasih satu saran" jadi "AI diskusi dulu baru kasih saran".

## 1. Konteks & Tujuan

AI menanyakan gaji/pendapatan dan kondisi keuangan user (cicilan, tanggungan, dsb) lewat percakapan suara bergantian, lalu menyusun usulan budget per kategori berdasarkan jawaban tersebut — bukan cuma dari histori transaksi seperti versi sebelumnya (yang tetap dipakai untuk user yang skip interview ini).

⚠️ **Ini butuh LLM sungguhan** (bukan rule-based seperti Opsi A di `PRD_AI_BUDGET_VOICE.md`) karena jawaban user soal kondisi keuangan bentuknya bebas, bukan pola tetap. Tapi karena dipakai jarang (bukan tiap transaksi), realistis tetap gratis di Gemini free tier — lihat bagian 5.

## 2. Fitur Detail

### 2.1 Trigger
- [ ] Tombol "Susun budget dengan AI" di halaman Budget — terpisah dari tombol AI Q&A harian yang sudah ada.
- [ ] Ditawarkan otomatis (banner non-blocking, bisa di-dismiss) ke user baru yang belum pernah set budget kategori sama sekali — bukan wajib.

### 2.2 Alur Percakapan (Multi-Turn) — Flow Final

**Konfirmasi pendekatan: pakai Opsi B (LLM sungguhan, Gemini) — bukan rule-based.** Percakapan ini butuh pemahaman jawaban bebas, jadi Opsi A tidak relevan di sini.

**Langkah 0 — Alert pembuka (statis, bukan dari LLM):**
- [ ] Saat tombol trigger ditap, tampilkan dialog/alert (native, bukan hasil generate AI) berisi salam + disclaimer, kira-kira: *"Halo, aku asisten yang membantu kamu mengatur keuangan. Percakapan kita tidak disimpan permanen — data disimpan sementara hanya untuk memberi saran yang relevan."*
- [ ] Ini teks statis yang sama tiap kali (tidak perlu dipanggil ke LLM) — konsisten dengan prinsip "tidak menyimpan transkrip permanen" yang sudah ditetapkan.
- [ ] Percakapan suara baru mulai **setelah** alert ini ditutup user.

**Langkah 1-3 — Pertanyaan berurutan (AI, via LLM):**
1. AI tanya total pengeluaran bulanan.
2. AI tanya kategori mana yang paling banyak menghabiskan uang (jawaban bebas, mis. "makan di luar" atau "transportasi").
3. AI tanya income/pendapatan bulanan.

**Langkah 4 — Arahan Dana Abadi:**
- [ ] AI **mengarahkan** (bukan cuma menawarkan pasif) user untuk menyisihkan 10% dari income ke Dana Abadi untuk masa depan — reuse narasi "bayar diri sendiri" yang sudah dispek di `PRD_DANA_ABADI.md`. Kalau user sudah punya `perpetualFundPercent` custom (bukan default 10%), AI pakai angka itu, bukan hardcode 10%.
- [ ] User bisa setuju atau minta ubah persentase di titik ini — kalau diubah, ini juga yang jadi nilai baru `User.perpetualFundPercent` (dikonfirmasi dulu di langkah akhir, bukan langsung tersimpan).

**Langkah 5 — Tabungan tambahan (di luar Dana Abadi):**
- [ ] AI tanya berapa jumlah **tambahan** yang ingin ditabung, terpisah dari alokasi Dana Abadi 10% tadi (mis. nabung buat beli barang tertentu, dana liburan, dst — bukan dana abadi jangka panjang).
- [ ] Nominal ini dicatat sebagai bagian dari alokasi (mengurangi sisa yang akan dibagi ke kategori pengeluaran di langkah 6), tapi **tidak otomatis membuat dompet/kategori baru** — hanya jadi angka pengurang saat kalkulasi, user yang nanti memutuskan mau taruh di dompet mana lewat flow biasa.

**Langkah 6 — Susun budget per kategori:**
- [ ] Sisa uang (income − alokasi Dana Abadi − tabungan tambahan) dibagi ke kategori pengeluaran yang **sudah ada di akun user** (tidak membuat kategori baru), dengan bobot lebih besar ke kategori yang disebut user paling banyak menghabiskan uang di Langkah 2.
- [ ] AI ajukan usulan angka per kategori — dibacakan ringkas + ditampilkan visual per kategori (kartu, bukan cuma suara).
- [ ] User bisa minta revisi lewat suara ("kategori makan terlalu kecil, naikkan") — AI sesuaikan dan ajukan ulang.
- [ ] User konfirmasi final → baru `Category.budgetLimit` per kategori (dan `User.perpetualFundPercent` kalau berubah) diupdate sekaligus. **Tidak ada auto-apply di tengah percakapan**, hanya di langkah konfirmasi akhir ini.

- [ ] Percakapan dibatasi maksimal (mis. 10 putaran, disesuaikan karena flow ini sudah 6 langkah inti + revisi) — kalau belum selesai, AI wajib mengarah ke kesimpulan/usulan, bukan terus bertanya tanpa akhir (kontrol biaya & UX).
- [ ] Selama percakapan berlangsung, riwayat percakapan disimpan **sementara di state client/session saja** — tidak ditulis ke database sebagai log lengkap, sesuai disclaimer di Langkah 0 (konsisten dengan keputusan sebelumnya di `PRD_AI_BUDGET_VOICE.md` bagian 3).

### 2.3 Penyimpanan Hasil
- [ ] `User.monthlyIncome` (baru, di `schema.prisma`) menyimpan angka pendapatan terakhir yang disebut user — dipakai supaya interview berikutnya tidak perlu tanya ulang dari nol, AI bisa konfirmasi ("terakhir kamu bilang gajimu Rp X, masih sama?").
- [ ] Pengeluaran wajib/tetap yang disebut user (cicilan, dll) **tidak disimpan sebagai teks bebas** ke database — hanya dipakai sebagai konteks kalkulasi saat itu. Kalau user mau data ini persisten, sarankan dicatat sebagai kategori pengeluaran rutin biasa (pakai fitur pencatatan yang sudah ada), bukan field baru khusus.

### 2.4 Sensitivitas Data
- [ ] `User.monthlyIncome` adalah data finansial paling sensitif di aplikasi ini (lebih dari nominal transaksi biasa) — perlakukan dengan standar akses yang sama ketatnya seperti data lain di `SECURITY_STANDARDS.md` (query selalu filter `userId`, tidak pernah expose ke endpoint publik manapun).
- [ ] Kalau data ini dikirim ke LLM sebagai konteks percakapan, pastikan itu **hanya** dikirim untuk sesi interview yang sedang berjalan (bukan dikirim ulang ke request AI Q&A harian yang sifatnya beda topik).

## 3. Perbedaan dari Versi Sebelumnya (`PRD_AI_BUDGET_VOICE.md` 2.2.B)
- Versi lama: satu kali AI hitung dari histori transaksi → langsung kasih saran angka. Tetap dipertahankan sebagai **jalur cepat** untuk user yang tidak mau diinterview (mis. tombol "Hitung otomatis dari histori" tetap ada berdampingan dengan "Susun budget dengan AI").
- Versi baru (dokumen ini): percakapan yang menggali kondisi keuangan user secara langsung, bukan cuma dari data transaksi yang sudah tercatat — lebih akurat untuk user baru yang histori transaksinya belum banyak.

## 4. Non-Functional Requirements
- Kalau user berhenti di tengah percakapan (keluar app, dsb), tidak ada state yang tersimpan setengah jalan — user mulai ulang dari awal kalau kembali lagi (state percakapan tidak persisten di database, sesuai 2.2).
- AI wajib tetap dalam batasan topik budget (reuse guardrail dari `PRD_AI_BUDGET_VOICE.md` 5.3) — tidak melebar ke nasihat investasi/utang spesifik di tengah interview ini.

## 5. Implikasi Biaya
- Fitur ini **wajib pakai LLM sungguhan** (Opsi A rule-based di `PRD_AI_BUDGET_VOICE.md` tidak cukup untuk percakapan bebas seperti ini).
- Karena dipakai jarang per user (bukan per transaksi harian), volume panggilan API realistis tetap kecil — Gemini free tier (lihat catatan limit yang bisa berubah di `PRD_AI_BUDGET_VOICE.md` 5.1) kemungkinan besar cukup, tapi tetap pasang batas jumlah sesi interview per user per bulan (mis. 5x) sebagai pengaman kalau ada pola pemakaian yang tidak terduga.

⚠️ **Kuota gratis berlaku untuk seluruh aplikasi (per API key/project), bukan per user.** Kalau user aplikasi bertambah banyak dan interview ini dipakai bersamaan oleh banyak orang, kuota harian gratis bisa habis untuk **semua user sekaligus** — bukan cuma yang minta duluan gagal, tapi siapapun yang minta setelah kuota habis hari itu.
- [ ] **Wajib** ada penanganan graceful saat kuota LLM habis (response 429 dari provider): tampilkan pesan jujur ke user ("fitur ini lagi sibuk, coba lagi nanti/besok") — jangan error teknis mentah, dan jangan biarkan user mengira ada bug di app-nya.
- [ ] Pertimbangkan monitoring sederhana (log jumlah panggilan LLM harian) supaya developer (Ferdi) tahu kapan mendekati batas kuota, sebelum user yang mengeluh duluan.
- TTS/STT tetap browser-native, gratis, tidak berubah dari fitur sebelumnya.

## 6. Eksplisit Di Luar Scope (Update Ini)
- Interview finansial yang lebih dalam (utang, investasi eksisting, dana pensiun) — cukup pendapatan & pengeluaran wajib untuk MVP.
- Riwayat/replay percakapan interview sebelumnya (tidak disimpan, sesuai 2.2).
- Rekomendasi otomatis berkala tanpa diminta (mis. AI proaktif ajak interview ulang tiap bulan) — user yang inisiasi sendiri kapan mau susun ulang.

Jangan implementasikan item di atas kecuali diminta eksplisit.
