/**
 * Daftar Mitra Platform Investasi Resmi (Afiliasi)
 *
 * Developer / Ferdi dapat memasukkan tautan afiliasi / kode referral masing-masing platform
 * pada properti `affiliateUrl` di bawah ini.
 */

export interface AffiliatePartner {
  id: string;
  name: string;
  category: string;
  assetTypes: string[];
  description: string;
  minimumInvestment: string;
  regulationBadge: string;
  affiliateUrl: string;
  referralCode?: string;
  isPopular?: boolean;
}

export const AFFILIATE_PARTNERS: AffiliatePartner[] = [
  {
    id: "bibit",
    name: "Bibit",
    category: "Reksadana, SBN & Obligasi FR",
    assetTypes: ["Pasar Uang", "Pendapatan Tetap", "Saham", "SBN"],
    description:
      "Platform investasi otomatis dengan fitur Robo Advisor pintar yang membantu menempatkan dana sesuai profil risiko secara bertahap.",
    minimumInvestment: "Mulai Rp10.000",
    regulationBadge: "Berizin & Diawasi OJK",
    affiliateUrl: "https://bibit.id", // Ganti dengan link afiliasi / referral kamu
    referralCode: "DANAABADI",
    isPopular: true,
  },
  {
    id: "bareksa",
    name: "Bareksa",
    category: "Supermarket Reksadana & SBN",
    assetTypes: ["Reksadana", "SBN Ritel", "Emas Digital", "Umroh"],
    description:
      "Marketplace reksadana dan mitra distribusi SBN resmi terlengkap di Indonesia dengan puluhan manajer investasi terpercaya.",
    minimumInvestment: "Mulai Rp10.000",
    regulationBadge: "Berizin & Diawasi OJK",
    affiliateUrl: "https://bareksa.com", // Ganti dengan link afiliasi / referral kamu
  },
  {
    id: "stockbit",
    name: "Stockbit",
    category: "Investasi Saham & Pasar Modal",
    assetTypes: ["Saham IDX", "e-IPO", "Komunitas Finansial"],
    description:
      "Aplikasi trading dan investasi saham modern dengan tools analisis fundamental lengkap, chart profesional, dan komunitas investor aktif.",
    minimumInvestment: "Bebas Minimal Deposit",
    regulationBadge: "Anggota BEI & Diawasi OJK",
    affiliateUrl: "https://stockbit.com", // Ganti dengan link afiliasi / referral kamu
  },
  {
    id: "pluang",
    name: "Pluang",
    category: "Multi-Aset (Emas, Saham AS & Kripto)",
    assetTypes: ["Emas Fisik Digital", "Indeks AS (S&P 500)", "Aset Digital"],
    description:
      "Satu aplikasi untuk diversifikasi aset global dan lokal, mulai dari tabungan emas murni hingga indeks saham global terkemuka.",
    minimumInvestment: "Mulai Rp10.000",
    regulationBadge: "Terdaftar Bappebti & Diawasi",
    affiliateUrl: "https://pluang.com", // Ganti dengan link afiliasi / referral kamu
  },
];
