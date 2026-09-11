# DESIGN_SYSTEM.md — Finance Tracker (Voice-First)

> Dokumen ini adalah kontrak visual untuk dibaca AI code generator saat implementasi UI. Ikuti token & aturan di bawah secara presisi — **jangan mengganti dengan nilai default library UI** (mis. shadcn default gray, Tailwind default `rounded-md`, Material Design elevation, dsb). Referensi visual: file Figma "Finance Tracker — Voice First" (frame 01–04).

## 1. Prinsip Desain

Ini bukan dashboard fintech generik. 3 aturan yang membedakannya dari template AI-generated biasa:

1. **Satu warna aksen, dipakai konsisten.** Hanya indigo (`primary`) yang boleh dipakai untuk elemen interaktif/branding (tombol utama, border aktif, mic button, tab aktif). Jangan tambah warna aksen kedua (biru, ungu lain, gradient) — itu ciri khas template.
2. **Merah/hijau HANYA untuk arah uang.** Merah = pengeluaran, hijau = pemasukan. Jangan pakai merah/hijau untuk hal lain (error state UI pakai warna netral + ikon, bukan merah generik).
3. **Tidak ada bayangan generik, tidak ada gradient, tidak ada ikon library (Lucide/Material/FontAwesome), tidak ada emoji sebagai ikon produksi.** Satu-satunya shadow yang boleh dipakai adalah *colored glow* di tombol mic (lihat §5). Ikon dibuat dari bentuk geometris sederhana (rounded rect/capsule/dot), bukan icon set generik — kalau perlu, ganti dengan SVG custom bergaya sama (monochrome, tebal, tanpa outline tipis ala Feather/Lucide).

## 2. Warna

Latar belakang layar bukan putih polos dan bukan abu Tailwind default — pakai off-white ber-tint lavender.

| Token | Hex | RGB (0–1) | Dipakai untuk |
|---|---|---|---|
| `bg` | `#F7F7FB` | 0.969, 0.969, 0.984 | Latar belakang layar |
| `surface` | `#FFFFFF` | 1, 1, 1 | Card, bottom sheet |
| `field` | `#F5F5FA` | 0.96, 0.96, 0.98 | Input field, tombol sekunder/ghost |
| `chip` | `#EDECFC` | 0.93, 0.925, 0.99 | Background ikon bulat di list item |
| `border` | `#E6E6ED` | 0.90, 0.90, 0.93 | Border tipis 1px (card netral, divider) |
| `primary` | `#4E44E5` | 0.306, 0.267, 0.898 | Aksen utama — tombol CTA, border aktif, mic button |
| `text` | `#14141F` | 0.078, 0.078, 0.122 | Teks utama (bukan `#000000` murni) |
| `text-secondary` | `#6B7280` | 0.42, 0.447, 0.502 | Label, caption, teks sekunder |
| `income` | `#16A34A` | 0.086, 0.639, 0.29 | Nominal pemasukan, chip "Pemasukan" aktif |
| `expense` | `#EF4444` | 0.937, 0.267, 0.267 | Nominal pengeluaran, chip "Pengeluaran" aktif |
| `budget-green` | `#16A34A` | — | Sisa budget >80% |
| `budget-yellow` | `#EAB308` | 0.918, 0.702, 0.031 | Sisa budget 50–80% |
| `budget-orange` | `#F97316` | 0.976, 0.451, 0.086 | Sisa budget 20–50% |
| `budget-red` | `#EF4444` | — | Sisa budget <20% |

Catatan: nilai ini setara Tailwind `indigo-600`, `gray-500`, `green-600`, `red-500`, `yellow-500`, `orange-500` — kalau pakai Tailwind, override lewat `tailwind.config` jadi token di atas, jangan pakai kelas default (`bg-blue-600`, `text-black`, dst).

## 3. Tipografi

Font: **Inter**. Hanya 4 weight yang dipakai: `Regular`, `Medium`, `Semi Bold`, `Bold` — jangan pakai Light/ExtraBold, jangan campur font lain.

| Ukuran | Weight | Dipakai untuk |
|---|---|---|
| 32px | Bold | Nominal saldo total (hero number) |
| 22px | Bold | Nominal di field jumlah (form/modal) |
| 20px | Bold | Judul halaman (mis. "Statistik") |
| 17–18px | Bold | Judul header layar |
| 16px | Bold | Judul bottom sheet |
| 15px | Semi Bold | Label tombol CTA, nilai field |
| 14px | Semi Bold | Judul section ("Dompet Saya", "Transaksi Terbaru") |
| 13px | Semi Bold / Medium | Nama item, body teks penting |
| 12px | Medium | Label field, caption, persentase |
| 11px | Regular | Sub-caption (catatan transkrip, metadata baris) |
| 10px | Medium | Label sangat kecil (tipe dompet di card) |

Hierarki dibentuk lewat **kombinasi ukuran + weight**, bukan warna — teks sekunder tetap pakai `text-secondary`, bukan opacity.

## 4. Radius & Spacing

Skala radius bertingkat, bukan satu radius seragam:

| Elemen | Radius |
|---|---|
| Bottom sheet (sudut atas) | 28px |
| Card besar (total saldo, statistik) | 20px |
| Card dompet, tombol aksi kecil | 14–16px |
| Field input, chip, tombol CTA | 12–14px |
| Grabber handle bottom sheet | full (pill), tinggi 4px |
| Dot indicator / avatar | full circle |
| Cell kalender heatmap | 5px, ukuran 18×18px |

Spacing: margin horizontal layar konsisten **20px** di semua sisi. Jarak antar section vertikal **18–20px**. Jarak antar elemen dalam satu grup (label→field, ikon→teks) **6–10px**. Padding dalam card **14–20px**. Jangan pakai spacing acak (`13px`, `17px`) — tetap di kelipatan 2/4 seperti di atas.

## 5. Elevation

Default: **tanpa shadow**. Card menempel di background hanya lewat perbedaan warna (`surface` di atas `bg`), bukan drop shadow — ini yang membuatnya terasa "flat modern", bukan Material Design generik.

Pengecualian tunggal: tombol **mic** memakai *colored soft glow*, bukan shadow hitam:
```
shadow: color = primary @ 40% opacity, offset y = 8px, blur = 20px
```
Ini menandakan mic adalah satu-satunya elemen "melayang"/hero di layar.

## 6. Komponen & Pola Layout

- **Frame mobile**: 375×812 (rasio iPhone standar), semua layar full-bleed dengan padding 20px di dalamnya.
- **Card netral** (dompet, tombol aksi): border 1px `border`, tanpa shadow. **Card aktif/terpilih**: border 2px `primary` + dot indicator warna `primary` — bukan berubah warna fill. Pola ini dipakai konsisten untuk semua "pilihan yang bisa di-highlight" (dompet aktif, dsb), jangan diganti jadi checkmark icon atau background fill penuh.
- **Segmented toggle** (Pengeluaran/Pemasukan): pill container, segmen aktif fill penuh warna semantik (merah/hijau) dengan teks putih bold; segmen tidak aktif flat `field` dengan teks `text-secondary`. Ini satu-satunya tempat merah/hijau dipakai sebagai *fill*, bukan cuma teks.
- **Tombol CTA primer**: full-width, fill `primary`, radius 14–16px, teks putih bold, tanpa border, tanpa shadow.
- **Tombol sekunder/ghost**: fill `field`, teks `text-secondary`, tanpa border.
- **Field input**: fill `field` (bukan putih dengan border), radius 12–14px, tanpa border — perbedaan dari card dibuat lewat warna fill, bukan outline.
- **List item transaksi**: baris fill `surface` di atas card besar/section, ikon kategori = dot bulat fill `chip` (bukan icon library), nominal di kanan pakai warna `income`/`expense`, sisanya `text`/`text-secondary`.
- **Bottom sheet modal** (konfirmasi voice/OCR): menutupi ~65–70% layar dari bawah, radius besar hanya di sudut atas (28px), ada grabber handle 40×4px abu-abu di tengah atas, latar belakang di belakangnya digelapkan (`#0D0D17` translucent), semua field di dalamnya tetap editable.
- **Chart pengeluaran**: donut/ring chart (stroke arc, bukan pie slice solid), tebal ring ±22px, radius lubang tengah menampilkan total nominal. Legend di bawahnya pakai dot warna + label + persentase, kategori terbesar ditandai label "(terbesar)" bukan badge terpisah.
- **Kalender heatmap**: grid kotak kecil rounded (bukan kalender penuh dengan angka tanggal), intensitas warna `primary` bertingkat 4 level (kosong→border abu, rendah→lavender muda, sedang→ungu medium, tinggi→primary penuh) — gaya GitHub contribution graph, bukan kalender bulanan biasa.
- **Warna kategori/budget**: 4 warna diskrit (hijau/kuning/oranye/merah) berdasarkan ambang persentase sisa budget (>80 / 50–80 / 20–50 / <20), **bukan gradient kontinu**.

## 7. Yang Harus Dihindari AI Code Generator

- Jangan pakai default shadcn/Material/Bootstrap tanpa override token di atas.
- Jangan tambah gradient di background atau tombol.
- Jangan pakai icon library generik (Lucide/Heroicons default style) tanpa menyesuaikan ke gaya monochrome tebal di atas.
- Jangan pakai emoji sebagai ikon produksi (dipakai di draft desain, tapi harus diganti SVG custom saat implementasi).
- Jangan samakan semua card pakai radius yang sama — ikuti skala bertingkat di §4.
- Jangan pakai warna merah/hijau di luar konteks arah transaksi (income/expense) dan status budget.
