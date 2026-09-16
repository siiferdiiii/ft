/**
 * Helper untuk manajemen multi-key Google Gemini API.
 * Mendukung Round-Robin Load Balancing dan Automatic Failover jika terkena rate-limit (429).
 */

let currentKeyIndex = 0;

/**
 * Mengambil array API keys dari environment variable.
 * Mendukung GEMINI_API_KEYS atau GEMINI_API_KEY (dipisahkan tanda koma jika lebih dari satu).
 */
export function getGeminiApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.trim())
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
}

/**
 * Melakukan pemanggilan REST API Gemini dengan failover otomatis antar-key.
 * Jika key pertama terkena rate limit (429) atau error server, sistem otomatis
 * mencoba key cadangan berikutnya tanpa membuat request user gagal.
 */
export async function callGeminiWithFailover(
  payload: unknown,
  model = "gemini-1.5-flash-latest"
): Promise<GeminiCallResult> {
  const keys = getOrderedGeminiKeys();

  if (keys.length === 0) {
    return {
      res: null,
      status: 503,
      allQuotaExceeded: false,
      errorDetail: "Fitur AI belum dikonfigurasi. GEMINI_API_KEY belum diisi.",
    };
  }

  let lastStatus = 0;
  let all429 = true;
  let lastErrText = "";

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // Jika kuota/rate-limit habis (429)
      if (res.status === 429) {
        console.warn(
          `[Gemini Rotation] Key #${i + 1} terkena rate-limit (429). Mencoba key berikutnya (${i + 1}/${keys.length})...`
        );
        lastStatus = 429;
        continue;
      }

      // Jika error 400 (Bad Request), masalah pada format prompt/payload, jangan buang key lain
      if (res.status === 400) {
        return { res, status: 400, allQuotaExceeded: false };
      }

      // Jika 403 (Invalid key/leaked/quota habis) atau 5xx (Google server error), coba key berikutnya
      if (res.status === 403 || res.status >= 500) {
        lastErrText = await res.text().catch(() => "");
        console.warn(
          `[Gemini Rotation] Key #${i + 1} error status ${res.status}. Mencoba key berikutnya...`,
          lastErrText
        );
        all429 = false;
        lastStatus = res.status;
        continue;
      }

      // Respon sukses / valid
      return { res, status: res.status, allQuotaExceeded: false };
    } catch (err) {
      console.error(`[Gemini Rotation] Exception saat fetch dengan key #${i + 1}:`, err);
      all429 = false;
      lastStatus = 500;
      continue;
    }
  }

  return {
    res: null,
    status: lastStatus || 500,
    allQuotaExceeded: all429 && lastStatus === 429,
    errorDetail: lastErrText,
  };
}
