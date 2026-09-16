/**
 * Helper untuk manajemen multi-key Google Gemini API.
 * Mendukung Round-Robin Load Balancing dan Automatic Failover jika terkena rate-limit (429)
 * atau key tidak valid / error server.
 */

let currentKeyIndex = 0;

/**
 * Mengambil array API keys dari environment variable.
 * Membersihkan tanda kutip ("), (') dan spasi/karakter whitespace secara agresif.
 */
export function getGeminiApiKeys(): string[] {
  const raw = process.env.GEMINI_API_KEYS || process.env.GEMINI_API_KEY || "";
  return raw
    .split(",")
    .map((k) => k.replace(/["'\r\n\t]/g, "").trim())
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
 * Jika key terkena rate limit (429), key tidak valid (400), atau error server (5xx),
 * sistem otomatis mencoba key cadangan berikutnya tanpa membuat request user gagal.
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

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        lastStatus = res.status;
        lastErrText = errText;

        // Jika kuota habis (429), key bermasalah (400 API_KEY_INVALID), forbidden (403), atau server Google error (5xx)
        // -> Coba key cadangan berikutnya!
        const isKeyOrQuotaError =
          res.status === 429 ||
          res.status === 403 ||
          res.status >= 500 ||
          (res.status === 400 && errText.includes("API_KEY_INVALID"));

        if (isKeyOrQuotaError) {
          console.warn(
            `[Gemini Rotation] Key #${i + 1} (${apiKey.slice(0, 6)}...${apiKey.slice(-4)}) gagal dengan status ${res.status}. Mencoba key berikutnya...`,
            errText
          );
          if (res.status !== 429) all429 = false;
          continue;
        }

        // Error lain yang bukan terkait key (misal prompt ditolak karena safety dsb)
        return { res: null, status: res.status, allQuotaExceeded: false, errorDetail: errText };
      }

      // Respon sukses (200 OK)
      const data = await res.json();
      return { res, status: res.status, allQuotaExceeded: false, data };
    } catch (err) {
      console.error(`[Gemini Rotation] Exception saat fetch dengan key #${i + 1}:`, err);
      all429 = false;
      lastStatus = 500;
      lastErrText = String(err);
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
