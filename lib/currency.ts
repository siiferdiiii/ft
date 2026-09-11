/**
 * Utility untuk memformat nilai angka ke mata uang Rupiah (IDR).
 * Standar konsisten sesuai CODING_STANDARDS.md §8.
 */
export function formatCurrency(amount: number | string): string {
  const numericAmount = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(numericAmount)) return "Rp 0";

  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numericAmount);
}

/**
 * Memformat string input angka menjadi format "Rp 1.000.000" secara interaktif saat diketik.
 */
export function formatCurrencyInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  const cleanDigits = String(value).replace(/[^0-9]/g, "");
  if (!cleanDigits) return "";
  const normalizedDigits = cleanDigits.replace(/^0+(?=\d)/, "");
  const formattedWithDots = normalizedDigits.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `Rp ${formattedWithDots}`;
}

/**
 * Mengambil nilai numerik murni dari string berformat rupiah seperti "Rp 1.000.000" -> 1000000.
 */
export function parseCurrencyInput(formattedValue: string | number | null | undefined): number {
  if (formattedValue === null || formattedValue === undefined) return 0;
  if (typeof formattedValue === "number") return formattedValue;
  const cleanDigits = formattedValue.replace(/[^0-9]/g, "");
  return parseInt(cleanDigits, 10) || 0;
}
