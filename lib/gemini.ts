/**
 * Helper untuk manajemen multi-key Google Gemini API.
 * Mendukung Round-Robin Load Balancing dan Automatic Failover jika terkena rate-limit (429)
 * atau key tidak valid / error server.
 * Mendukung exponential backoff untuk error 503 (overload sementara).
 */

let currentKeyIndex = 0;

/** Delay helper */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  preferredModel = process.env.GEMINI_MODEL || "gemini-3.8-flash"
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

  // Model fallback list: utamakan preferredModel, lalu gemini-3.8-flash, gemini-2.5-flash, gemini-flash-latest
  const candidateModels = Array.from(
    new Set([preferredModel, "gemini-3.8-flash", "gemini-2.5-flash", "gemini-flash-latest"].filter(Boolean))
  );

  let lastStatus = 0;
  let all429 = true;
  const errors: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const apiKey = keys[i];
    const maskedKey = apiKey.length > 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : "(key pendek)";

    for (const model of candidateModels) {
      // Retry up to 2 kali untuk 503 (overload sementara) dengan exponential backoff
      const MAX_RETRIES = 2;
      let attempt = 0;
      let skipToNextModel = false;

      while (attempt <= MAX_RETRIES) {
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

            // 404: model deprecated/tidak tersedia → coba model berikutnya
            if (res.status === 404) {
              console.warn(
                `[Gemini Rotation] Model ${model} pada Key #${i + 1} (${maskedKey}) mengembalikan 404. Mencoba model berikutnya...`
              );
              skipToNextModel = true;
              break;
            }

            // 503: overload sementara → retry dengan backoff sebelum coba model lain
            if (res.status === 503 && attempt < MAX_RETRIES) {
              const delay = 1000 * Math.pow(2, attempt); // 1s, 2s
              console.warn(
                `[Gemini Rotation] Key #${i + 1} (${maskedKey}) model ${model} overload (503). Retry ke-${attempt + 1} setelah ${delay}ms...`
              );
              all429 = false;
              await sleep(delay);
              attempt++;
              continue;
            }

            errors.push(`Key #${i + 1} (${model}): HTTP ${res.status}`);
            console.warn(
              `[Gemini Rotation] Key #${i + 1} (${maskedKey}) model ${model} gagal dengan status ${res.status}:`,
              errText
            );

            if (res.status !== 429) {
              all429 = false;
            }

            // 503 habis retry atau error lain → coba model berikutnya pada key ini
            if (res.status === 503) {
              skipToNextModel = true;
              break;
            }

            // Selain 503/404 → pindah ke API key berikutnya
            break;
          }

          // Respon sukses (200 OK)
          const data = await res.json();
          return { res, status: res.status, allQuotaExceeded: false, data };
        } catch (err) {
          console.error(`[Gemini Rotation] Exception saat fetch dengan key #${i + 1} (${maskedKey}) model ${model}:`, err);
          all429 = false;
          lastStatus = 500;
          errors.push(`Key #${i + 1} (${maskedKey}): Exception ${String(err).slice(0, 100)}`);
          break;
        }

        break; // keluar dari while jika tidak ada continue
      }

      if (skipToNextModel) continue; // lanjut ke model berikutnya
      // Jika bukan skipToNextModel, keluar dari for-model → coba key berikutnya
      break;
    }
  }

  return {
    res: null,
    status: lastStatus || 500,
    allQuotaExceeded: all429 && lastStatus === 429,
    errorDetail: errors.join(" | ") || "Semua API key gagal merespons",
  };
}
