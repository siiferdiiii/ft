export interface ProductPackage {
  id: string;
  name: string;
  badge?: string;
  /** Tandai sebagai produk yang paling direkomendasikan */
  popular?: boolean;
  /** Tandai sebagai coming soon — belum bisa dibeli */
  comingSoon?: boolean;
  price: number;
  ocrQuota: number;
  aiBudgetQuota: number;
  tier: "FREE" | "PRO";
  /** URL checkout Lynk.id. 1 produk = 1 link. Kosong jika comingSoon. */
  lynkUrl: string;
  description: string;
  features: string[];
}

/**
 * Daftar paket produk Lynk.id.
 * 1 produk = 1 link khusus ke checkout Lynk.id.
 * Harga, kuota, dan link dapat diubah dengan mudah di file ini kapan saja.
 *
 * Cara pengguna membeli:
 * 1. Klik tombol "Beli" → buka link Lynk.id di tab baru
 * 2. Di kolom catatan Lynk.id, user masukkan ID akun mereka (format FT-XXXXX)
 * 3. Setelah pembayaran berhasil, Lynk.id kirim webhook ke /api/webhooks/lynkid
 * 4. Server verifikasi & tambahkan kuota ke akun yang sesuai
 */
export const PRODUCT_PACKAGES: ProductPackage[] = [
  {
    id: "hemat",
    name: "Paket Hemat",
    badge: "Coba Dulu",
    price: 9900,
    ocrQuota: 20,
    aiBudgetQuota: 3,
    tier: "PRO",
    // Ganti dengan env var di .env.local: NEXT_PUBLIC_LYNK_URL_HEMAT
    lynkUrl:
      process.env.NEXT_PUBLIC_LYNK_URL_HEMAT ||
      "http://lynk.id/werctvgybuhjn/3woxvvvmq01g/checkout",
    description: "Cocok untuk kamu yang ingin mencoba fitur AI sebelum beli paket lebih besar.",
    features: [
      "20x Scan Resi AI Multi-Item",
      "Deteksi otomatis item & harga di struk",
      "Grup transaksi rapi di Riwayat",
      "3x Sesi Susun Budget dengan AI",
      "Kuota tidak kedaluwarsa",
    ],
  },
  {
    id: "reguler",
    name: "Paket Reguler",
    badge: "Terlaris",
    popular: true,
    comingSoon: true,
    price: 24900,
    ocrQuota: 60,
    aiBudgetQuota: 10,
    tier: "PRO",
    lynkUrl: process.env.NEXT_PUBLIC_LYNK_URL_REGULER || "",
    description: "Paket terlaris untuk pengguna aktif yang sering belanja banyak item.",
    features: [
      "60x Scan Resi AI Multi-Item",
      "Deteksi otomatis item & harga di struk",
      "Grup transaksi rapi di Riwayat",
      "10x Sesi Susun Budget dengan AI",
      "Kuota tidak kedaluwarsa",
    ],
  },
  {
    id: "pro",
    name: "Paket Pro",
    badge: "Super Value",
    price: 59900,
    ocrQuota: 200,
    aiBudgetQuota: 30,
    tier: "PRO",
    lynkUrl: process.env.NEXT_PUBLIC_LYNK_URL_PRO || "http://lynk.id/werctvgybuhjn/1w6688213koz/checkout",
    description: "Kapasitas besar untuk keluarga atau pencatatan pengeluaran usaha kecil.",
    features: [
      "200x Scan Resi AI Multi-Item",
      "Deteksi otomatis item & harga di struk",
      "Grup transaksi rapi di Riwayat",
      "30x Sesi Susun Budget dengan AI",
      "Kuota tidak kedaluwarsa",
    ],
  },
];

/**
 * Cari produk berdasarkan ID (digunakan oleh webhook Lynk.id untuk menentukan
 * kuota yang akan ditambahkan ke akun pembeli).
 */
export function getProductById(id: string): ProductPackage | undefined {
  return PRODUCT_PACKAGES.find((p) => p.id === id);
}
