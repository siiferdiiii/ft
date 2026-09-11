/**
 * Parser suara terpusat untuk Bahasa Indonesia sesuai CODING_STANDARDS.md §8 & PRD.md §4.2.
 * Mengekstrak nominal, tipe transaksi (INCOME/EXPENSE), dan catatan/merchant dari teks transkrip.
 */

export interface ParsedVoiceResult {
  amount: number | null;
  type: "INCOME" | "EXPENSE";
  note: string;
  rawInput: string;
  categoryHint?: string;
}

// Kamus kata kunci komprehensif untuk pemasukan (income)
export const INCOME_DICTIONARY: Record<string, string[]> = {
  gaji: [
    "gaji",
    "gajian",
    "upah",
    "honor",
    "salary",
    "payroll",
    "lembur",
    "uang lembur",
  ],
  bonus: [
    "bonus",
    "thr",
    "hadiah",
    "reward",
    "insentif",
    "tip",
    "uang kaget",
    "angpau",
    "saweran",
  ],
  usaha: [
    "penjualan",
    "jual",
    "jualan",
    "untung",
    "laba",
    "omset",
    "omzet",
    "dagang",
    "orderan",
    "proyek",
    "freelance",
    "komisi",
  ],
  investasi: [
    "dividen",
    "bunga",
    "cuan",
    "crypto",
    "saham",
    "reksadana",
    "imbal hasil",
  ],
  lainnya: [
    "dapat",
    "terima",
    "masuk",
    "transfer dari",
    "transferan",
    "diberi",
    "dikasih",
    "cashback",
    "kembalian",
    "uang jajan",
    "pemasukan",
    "pesangon",
  ],
};

// Gabungan semua kata kunci pemasukan
const ALL_INCOME_WORDS = Object.values(INCOME_DICTIONARY).flat();

const WORD_TO_NUMBER: Record<string, number> = {
  nol: 0,
  satu: 1,
  se: 1,
  dua: 2,
  tiga: 3,
  empat: 4,
  lima: 5,
  enam: 6,
  tujuh: 7,
  delapan: 8,
  sembilan: 9,
  sepuluh: 10,
  sebelas: 11,
  seratus: 100,
  seribu: 1000,
  sejuta: 1000000,
};

/**
 * Mengubah kumpulan kata angka Bahasa Indonesia menjadi nilai numerik.
 * Contoh: "dua puluh lima ribu" -> 25000
 * "tiga ratus lima puluh ribu" -> 350000
 */
function parseIndonesianWordsToNumber(words: string[]): number | null {
  let total = 0;
  let current = 0;
  let hasNumberWord = false;

  for (let i = 0; i < words.length; i++) {
    const word = words[i].toLowerCase();

    if (WORD_TO_NUMBER[word] !== undefined) {
      current += WORD_TO_NUMBER[word];
      hasNumberWord = true;
    } else if (word === "belas") {
      current += 10;
      hasNumberWord = true;
    } else if (word === "puluh") {
      current = (current === 0 ? 1 : current) * 10;
      hasNumberWord = true;
    } else if (word === "ratus") {
      current = (current === 0 ? 1 : current) * 100;
      hasNumberWord = true;
    } else if (word === "ribu") {
      current = (current === 0 ? 1 : current) * 1000;
      total += current;
      current = 0;
      hasNumberWord = true;
    } else if (word === "juta") {
      current = (current === 0 ? 1 : current) * 1000000;
      total += current;
      current = 0;
      hasNumberWord = true;
    }
  }

  total += current;
  return hasNumberWord && total > 0 ? total : null;
}

/**
 * Parsing teks transkrip suara menjadi struktur transaksi.
 */
export function parseVoiceInput(transcript: string): ParsedVoiceResult {
  const rawInput = transcript.trim();
  const normalized = rawInput.toLowerCase();

  // 1. Tentukan tipe transaksi dan hint kategori dari kamus pemasukan
  let type: "INCOME" | "EXPENSE" = "EXPENSE";
  let categoryHint: string | undefined = undefined;

  for (const [catKey, keywords] of Object.entries(INCOME_DICTIONARY)) {
    for (const keyword of keywords) {
      if (new RegExp(`\\b${keyword}\\b`, "i").test(normalized)) {
        type = "INCOME";
        categoryHint = catKey;
        break;
      }
    }
    if (type === "INCOME") break;
  }

  let extractedAmount: number | null = null;
  let matchedAmountString = "";

  // 2. Pattern Regex untuk pola angka umum:
  // a) "1.5 juta", "2,5jt", "3 juta"
  const jutaRegex = /(\d+(?:[.,]\d+)?)\s*(?:juta|jt)\b/i;
  // b) "15 ribu", "15rb", "15k", "15.000"
  const ribuRegex = /(\d+(?:[.,]\d+)?)\s*(?:ribu|rb|k)\b/i;
  // c) Format mata uang rupiah langsung: "rp 50000", "rp. 50.000"
  const rpRegex = /(?:rp\.?|rupiah)\s*(\d+(?:[.,]\d+)*)/i;
  // d) Angka ribuan murni (e.g. 50000, 150.000)
  const plainNumberRegex = /\b(\d{1,3}(?:\.\d{3})+|\d{4,})\b/;

  const jutaMatch = normalized.match(jutaRegex);
  const ribuMatch = normalized.match(ribuRegex);
  const rpMatch = normalized.match(rpRegex);
  const plainMatch = normalized.match(plainNumberRegex);

  if (jutaMatch) {
    const num = parseFloat(jutaMatch[1].replace(",", "."));
    extractedAmount = Math.round(num * 1000000);
    matchedAmountString = jutaMatch[0];
  } else if (ribuMatch) {
    const num = parseFloat(ribuMatch[1].replace(",", "."));
    extractedAmount = Math.round(num * 1000);
    matchedAmountString = ribuMatch[0];
  } else if (rpMatch) {
    const cleanNum = rpMatch[1].replace(/[.,]/g, "");
    extractedAmount = parseInt(cleanNum, 10);
    matchedAmountString = rpMatch[0];
  } else if (plainMatch) {
    const cleanNum = plainMatch[1].replace(/\./g, "");
    extractedAmount = parseInt(cleanNum, 10);
    matchedAmountString = plainMatch[0];
  } else {
    // Coba deteksi angka berbasis kata (misal: "tiga belas ribu", "dua puluh ribu")
    const words = normalized.split(/\s+/);
    const wordNum = parseIndonesianWordsToNumber(words);
    if (wordNum !== null) {
      extractedAmount = wordNum;
      // Ambil bagian kata yang mewakili angka untuk dibersihkan dari catatan
      const numWords = ["nol", "satu", "se", "dua", "tiga", "empat", "lima", "enam", "tujuh", "delapan", "sembilan", "sepuluh", "sebelas", "belas", "puluh", "seratus", "ratus", "seribu", "ribu", "sejuta", "juta"];
      matchedAmountString = words.filter((w) => numWords.includes(w)).join(" ");
    }
  }

  // 3. Bersihkan teks untuk dijadikan catatan/merchant
  let cleanedNote = rawInput;
  if (matchedAmountString) {
    // Hapus nominal yang terdeteksi
    const regex = new RegExp(matchedAmountString.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
    cleanedNote = cleanedNote.replace(regex, "");
  }

  // Bersihkan kata kerja umum di awal catatan
  cleanedNote = cleanedNote
    .replace(/^\s*(?:beli|bayar|buat|untuk|dapat|terima|dari|ke|jual|makan)\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Jika catatan kosong, gunakan fallback deskriptif
  if (!cleanedNote) {
    cleanedNote = type === "INCOME" ? "Pemasukan" : "Pengeluaran";
  } else {
    // Capitalize kata pertama
    cleanedNote = cleanedNote.charAt(0).toUpperCase() + cleanedNote.slice(1);
  }

  return {
    amount: extractedAmount,
    type,
    note: cleanedNote,
    rawInput,
    categoryHint,
  };
}
