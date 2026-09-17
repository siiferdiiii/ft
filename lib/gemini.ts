/**
 * Helper untuk manajemen multi-key Google Gemini API.
 * Mendukung Round-Robin Load Balancing dan Automatic Failover jika terkena rate-limit (429)
 * atau key tidak valid / error server.
 */

let currentKeyIndex = 0;

/**
 * Mengambil array API keys dari environment variable.
 * Mendukung pemisah koma (,), titik koma (;), atau baris baru (newline).
 * Membersihkan tanda kutip ("), ('), spasi, dan whitespace secara agresif.
 */
export function getGeminiApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(/[\n,;]+/)
    .map((k) => k.replace(/["'\r\s]/g, "").trim())
    .filter(Boolean);
}

/**
 * Mengambil daftar API key dengan urutan round-robin,
 * sehingga beban request terbagi merata di antara akun yang berbeda.
 */
export function getOrderedGeminiKeys(): string[] {
  const keys = getGeminiApiKeys();
  if (keys.length <= 1) return keys;

  const start = currentKeyIndex % keys.length;
  currentKeyIndex = (currentKeyIndex + 1) % keys.length;

  return [...keys.slice(start), ...keys.slice(0, start)];
}

export interface GeminiCallResult {
  res: Response | null;
  status: number;
  allQuotaExceeded: boolean;
  errorDetail?: string;
  data?: unknown;
}

/**
 * Melakukan pemanggilan REST API Gemini dengan failover otomatis antar-key.
 * Jika salah satu key terkena limit, invalid, atau error, sistem otomatis
 * mencoba key cadangan berikutnya tanpa membuat request user gagal.
 */
export async function callGeminiWithFailover(
  payload: unknown,
  model = process.env.GEMINI_MODEL || "gemini-2.5-flash"
): Promise<GeminiCallResult> {
  const keys = getOrderedGeminiKeys();

  if (keys.length === 0) {
    return {
      res: null,
      status: 503,
      allQuotaExceeded: false,
      errorDetail: "Fitur AI belum dikonfigurasi. GEMINI_API_KEY belum diisi di Environment Variables.",
    };
  }

  let lastStatus = 0;
  let all429 = true;
  const errors: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "(key pendek)";

    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastStatus = res.status;
        errors.push(`Key #${i + 1}: HTTP ${res.status}`);

        console.warn(
          `[Gemini Rotation] Key #${i + 1} (${maskedKey}) gagal dengan status ${res.status}:`,
          errText
        );

        if (res.status !== 429) {
          all429 = false;
        }

        // Jika masih ada key lain dalam daftar, coba key berikutnya
        if (i < keys.length - 1) {
          continue;
        }

        // Ini key terakhir dan semuanya gagal
        return {
          res: null,
          status: res.status,
          allQuotaExceeded: all429 && res.status === 429,
          errorDetail: errors.join(" | "),
        };
      }

      // Respon sukses (200 OK)
      const data = await res.json();
      return { res, status: res.status, allQuotaExceeded: false, data };
    } catch (err) {
      console.error(`[Gemini Rotation] Exception saat fetch dengan key #${i + 1} (${maskedKey}):`, err);
      all429 = false;
      lastStatus = 500;
      errors.push(`Key #${i + 1} (${maskedKey}): Exception ${String(err).slice(0, 100)}`);
      continue;
    }
  }

  return {
    res: null,
    status: lastStatus || 500,
    allQuotaExceeded: all429 && lastStatus === 429,
    errorDetail: errors.join(" | ") || "Semua API key gagal merespons",
  };
}
