import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetInterviewSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { callGeminiWithFailover, getGeminiApiKeys } from "@/lib/gemini";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

/**
 * Auto-repair JSON yang terpotong (output Gemini habis sebelum selesai).
 * Menghapus trailing koma, key tanpa value, dan menutup bracket/brace yang belum tertutup.
 */
function autoRepairJson(raw: string): string {
  let s = raw.trim();

  // Hapus trailing comma sebelum penutup atau di akhir
  s = s.replace(/,\s*$/, "");

  // Jika terputus di tengah string value (ada kutip ganjil), tutup kutipnya
  // Hitung kutip ganda yang tidak di-escape
  const quoteCount = (s.match(/(?<!\\)"/g) || []).length;
  if (quoteCount % 2 !== 0) {
    // Hapus dari kutip terakhir yang ganjil sampai akhir, lalu tutup
    s = s.replace(/"[^"]*$/, '""');
  }

  // Hapus trailing key tanpa value (mis: "categoryName": ) di akhir
  s = s.replace(/,?\s*"[^"]*"\s*:\s*$/, "");

  // Hapus objek terakhir yang tidak lengkap di dalam array
  // Pattern: ,{ ... tanpa penutup }
  s = s.replace(/,\s*\{[^}]*$/, "");

  // Hapus trailing comma lagi setelah pembersihan
  s = s.replace(/,\s*$/, "");

  // Hitung bracket dan brace yang belum ditutup
  let openBraces = 0;
  let openBrackets = 0;
  let inString = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === '"' && (i === 0 || s[i - 1] !== "\\")) {
      inString = !inString;
    } else if (!inString) {
      if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
      else if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets--;
    }
  }

  // Tutup yang belum tertutup
  while (openBrackets > 0) { s += "]"; openBrackets--; }
  while (openBraces > 0) { s += "}"; openBraces--; }

  return s;
}

// Endpoint POST: terima riwayat percakapan multi-turn, kirim ke Gemini, return balasan AI.
// State percakapan tidak disimpan ke DB - hanya ada di client session (sesuai PRD §2.2).
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const clientIp = getClientIp(req);
    const rateLimit = checkRateLimit(`ai:${user.id}:${clientIp}`, 15, 60 * 1000);
    if (!rateLimit.success) {
      return apiError(
        "TOO_MANY_REQUESTS",
        "Terlalu banyak permintaan ke asisten AI. Silakan tunggu 1 menit sebelum mengirim pesan lagi.",
        429
      );
    }

    const body = await req.json();
    const parsed = budgetInterviewSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input tidak valid",
        400
      );
    }

    const { messages, monthlyIncomeHint } = parsed.data;

    const apiKeys = getGeminiApiKeys();
    if (apiKeys.length === 0) {
      return apiError(
        "CONFIG_ERROR",
        "Fitur AI belum dikonfigurasi. Silakan hubungi developer untuk mengatur GEMINI_API_KEY.",
        503
      );
    }

    // Ambil kategori pengeluaran milik user + data user + daftar goal tabungan aktif
    const [expenseCategories, userData, userGoals] = await Promise.all([
      prisma.category.findMany({
        where: { userId: user.id, type: "EXPENSE" },
        select: { id: true, name: true, budgetLimit: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { perpetualFundPercent: true, monthlyIncome: true },
      }),
      prisma.goal.findMany({
        where: { userId: user.id, isArchived: false },
        select: { id: true, name: true, targetAmount: true, allocationPercent: true },
      }),
    ]);

    if (!userData) {
      return apiError("NOT_FOUND", "Data user tidak ditemukan", 404);
    }

    const perpetualPercent = userData.perpetualFundPercent ?? 10;
    const savedIncome = userData.monthlyIncome ? Number(userData.monthlyIncome) : null;
    // Income hint dari client lebih fresh dari DB jika user sudah menjawab di percakapan ini
    const effectiveIncome = monthlyIncomeHint ?? savedIncome;

    const categoryList = expenseCategories
      .map((c) => `- ${c.name} (ID: ${c.id})`)
      .join("\n");

    const goalsList = userGoals.length > 0
      ? userGoals.map((g) => `- "${g.name}" (Target: Rp ${Number(g.targetAmount).toLocaleString("id-ID")})`).join("\n")
      : "  (Belum ada target tabungan terdaftar di akun pengguna)";

    // System prompt: persona bijak, urutan pertanyaan baru, batas total pengeluaran < 2 juta, dan alokasi tabungan/dana darurat
    const systemPrompt = `Kamu adalah asisten keuangan pribadi bernama "Fin" yang bijak, hangat, dan realistis dalam membantu pengguna menyusun rencana anggaran bulanan yang sehat dan disiplin.
Percakapan ini bersifat privat - data hanya digunakan sementara untuk sesi ini, tidak disimpan permanen.

KONTEKS PENGGUNA:
- Persentase Dana Abadi saat ini: ${perpetualPercent}%
- Pendapatan bulanan terakhir: ${effectiveIncome ? `Rp ${effectiveIncome.toLocaleString("id-ID")}` : "belum diketahui"}
- Kategori pengeluaran yang tersedia di akun pengguna:
${categoryList || "  (belum ada kategori - sarankan pengguna membuat kategori di menu Kategori)"}
- Tabungan Bertujuan / Goals aktif pengguna saat ini:
${goalsList}

ALUR WAWANCARA KEUANGAN (Ikuti urutan langkah berikut secara bijak, ajukan 1 pertanyaan per putaran):
1. PENGHASILAN: Tanyakan berapa total penghasilan/pemasukan bersih bulanan pengguna. (Jika sudah ada data tersimpan, konfirmasi apakah masih sama atau ada perubahan).
2. PENGELUARAN WAJIB: Tanyakan apa saja pengeluaran wajib/rutin setiap bulan dan berapa perkiraan nominalnya (misal: sewa kos/kontrakan, cicilan, listrik/air, internet/pulsa, dll). Berikan apresiasi atas keterbukaan pengguna.
3. POS PALING BOROS: Tanyakan "Dalam 1 bulan terakhir, uang Anda paling banyak habis di mana?" untuk mengidentifikasi pos pengeluaran terbesar atau gaya hidup.
4. STRATEGI ANGGARAN HEMAT & ALOKASI SISA UANG (DANA ABADI + TABUNGAN / DANA DARURAT):
   - Jelaskan konsep cerdas: Kita akan mendesain total anggaran pengeluaran bulanan agar tetap hemat & terkendali di bawah Rp 2.000.000 (< 2 juta rupiah total per bulan).
   - Dari total penghasilan pengguna, setelah dipotong kebutuhan anggaran pengeluaran (< 2 juta), seluruh sisa uangnya diselamatkan:
     a. Sisihkan ${perpetualPercent}% dari penghasilan ke Dana Abadi untuk masa depan (prinsip membayar diri sendiri terlebih dahulu).
     b. Seluruh sisa uang yang masih ada dialokasikan ke Tabungan / Goals (sebutkan nama goals pengguna jika ada, misal: ${userGoals.map(g => `"${g.name}"`).join(", ") || "target tabungan impian"} atau Dana Darurat).
     c. Jika pengguna belum memiliki pos tabungan khusus, sarankan untuk membaginya ke pos Dana Darurat untuk ketahanan finansial keluarga.
5. SUSUN ANGGARAN PENGELUARAN PER KATEGORI (ATURAN KETAT TOTAL PENGELUARAN < 2 JUTA):
   - ATURAN UTAMA: TOTAL SELURUH ANGGARAN PENGELUARAN BULANAN (jumlah akumulasi seluruh kategori yang diusulkan) HARUS DI BAWAH Rp 2.000.000 (< 2 juta rupiah total per bulan, contohnya total berkisar antara Rp 1.300.000 hingga Rp 1.950.000), agar pengguna memiliki kebiasaan hidup hemat, terukur, dan tidak boros.
   - Bagikan nominal tersebut ke masing-masing kategori pengeluaran yang ada secara proporsional dan realistis (utamakan Kebutuhan Pokok & Tagihan Rutin > Kebutuhan Pendukung > Hiburan/Gaya Hidup).
   - Hitung sisa uang (Penghasilan − Total Anggaran Pengeluaran − Alokasi Dana Abadi) dan tetapkan secara eksplisit sebagai alokasi Tabungan / Dana Darurat.
   - Berikan ulasan hangat, motivasi, dan ajukan usulan angka per kategori.

ATURAN FORMAT PENULISAN (WAJIB DIIKUTI):
- Tulis paragraf PENDEK, maksimal 2-3 kalimat per paragraf.
- SELALU sisipkan BARIS KOSONG (\n\n) antar paragraf agar tidak menumpuk.
- Jika menggunakan daftar bernomor (1., 2., dst), WAJIB taruh SETIAP nomor di BARIS BARU TERPISAH. Contoh:

1. **Poin pertama** — penjelasan singkat.

2. **Poin kedua** — penjelasan singkat.

- Jika menggunakan poin bullet (- atau •), taruh SETIAP bullet di BARIS BARU TERPISAH.
- Gunakan **teks tebal** untuk menyoroti istilah penting, nama kategori, dan nominal uang.
- JANGAN PERNAH menggabungkan beberapa poin bernomor dalam satu paragraf panjang tanpa jeda baris.

ATURAN PENTING:
- Bertanyalah satu topik secara runtut per putaran. Jangan gabungkan 2 pertanyaan berat sekaligus.
- Bersikaplah bijak, empati, dan suportif.
- Tetap di koridor anggaran keuangan pribadi. Tolak pertanyaan spekulasi investasi berisiko atau pinjaman online.
- Gunakan bahasa Indonesia yang santun, hangat, dan mudah dipahami.
- JANGAN PERNAH menyebutkan kata "JSON", "blok kode", "format data", atau istilah teknis apapun dalam kalimat percakapanmu. Blok data hanya lampiran teknis internal, bukan bagian dari percakapan.
- Saat kamu siap mengajukan usulan budget FINAL di langkah 5, TULIS DULU rangkuman narasi rencana anggaran secara lengkap dan rapi, lalu SETELAH narasi selesai, LAMPIRKAN blok JSON berikut di BARIS PALING AKHIR responmu (terpisah dari narasi):
\`\`\`json
{
  "proposedBudgets": [
    {"categoryId": "<id>", "categoryName": "<nama>", "amount": <angka>}
  ],
  "totalExpenseBudget": <total angka seluruh kategori pengeluaran, wajib < 2000000>,
  "proposedPerpetualPercent": ${perpetualPercent},
  "proposedPerpetualAmount": <nominal alokasi dana abadi>,
  "savingsAllocation": <sisa uang untuk tabungan / dana darurat>,
  "savingsRecommendationNote": "<catatan ringkas alokasi tabungan atau dana darurat>",
  "done": true
}
\`\`\`
- Jangan sertakan blok JSON sebelum langkah 1-4 selesai dibahas.`;

    // Jika ini pesan pertama (messages kosong), sapaan pembuka langsung menanyakan penghasilan
    if (messages.length === 0) {
      const openingText = savedIncome
        ? `Halo! Aku Fin, asisten keuangan pribadimu 👋 Senang bisa membantumu menyusun rencana budget bulanan yang bijak dan terarah.\n\nKita mulai dari pendapatan ya — terakhir kamu menyebut penghasilan sekitar Rp ${savedIncome.toLocaleString("id-ID")}. Apakah saat ini masih sama, atau ada perubahan?`
        : `Halo! Aku Fin, asisten keuangan pribadimu 👋 Aku akan membantumu menyusun rencana budget bulanan yang bijak dan terarah.\n\nSebagai langkah pertama, boleh tahu berapa rata-rata penghasilan atau pemasukan bersihmu per bulan?`;

      return apiSuccess({ reply: openingText, proposedBudgets: null, done: false });
    }

    // Bangun payload Gemini multi-turn chat
    const geminiPayload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 3072,
        thinkingConfig: { thinkingBudget: 0 },
      },
    };

    const { res: geminiRes, status: geminiStatus, allQuotaExceeded, errorDetail, data: geminiDataRaw } =
      await callGeminiWithFailover(geminiPayload);

    // Handle jika semua key terkena kuota/rate limit (429) atau gagal
    if (!geminiRes || !geminiRes.ok) {
      console.error("Gemini call failed with status:", geminiStatus, errorDetail);
      if (allQuotaExceeded || geminiStatus === 429) {
        return apiError(
          "QUOTA_EXCEEDED",
          "Fitur AI lagi sibuk - seluruh kuota harian sedang penuh. Coba lagi nanti, atau gunakan 'Hitung otomatis dari histori' sebagai alternatif.",
          429
        );
      }
      return apiError(
        "AI_ERROR",
        "Terjadi gangguan saat menghubungi asisten AI. Silakan coba sesaat lagi.",
        502
      );
    }

    const geminiData = geminiDataRaw as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const rawReply = (geminiData?.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();

    if (!rawReply) {
      console.error("Gemini returned empty reply. Raw response:", JSON.stringify(geminiData));
      return apiError("AI_ERROR", "Asisten AI tidak memberikan respons. Silakan coba lagi.", 502);
    }

    // Parse blok JSON dari respons AI jika ada (menandakan usulan final siap)
    let proposedBudgets: Array<{ categoryId: string; categoryName: string; amount: number }> | null = null;
    let proposedPerpetualPercent: number | null = null;
    let totalExpenseBudget: number | null = null;
    let proposedPerpetualAmount: number | null = null;
    let savingsAllocation: number | null = null;
    let savingsRecommendationNote: string | null = null;
    let done = false;

    // Ekstraksi JSON yang fail-safe: mendukung blok tertutup maupun terpotong
    // 1) Coba blok ```json ... ``` yang lengkap
    // 2) Jika tidak ada, coba blok ```json ... (tanpa penutup — output terpotong)
    // 3) Jika masih tidak ada, coba cari objek JSON mentah { "proposedBudgets": ... }
    let jsonRaw: string | null = null;
    const closedMatch = rawReply.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (closedMatch?.[1]) {
      jsonRaw = closedMatch[1].trim();
    } else {
      const openMatch = rawReply.match(/```(?:json)?\s*([\s\S]+)$/);
      if (openMatch?.[1]) {
        jsonRaw = openMatch[1].trim();
      } else {
        // Fallback: cari objek JSON mentah yang mengandung proposedBudgets
        const bareMatch = rawReply.match(/(\{[\s\S]*"proposedBudgets"[\s\S]*)/)
        if (bareMatch?.[1]) {
          jsonRaw = bareMatch[1].trim();
        }
      }
    }

    if (jsonRaw) {
      // Auto-repair JSON terpotong: tutup array/objek yang belum tertutup
      const repaired = autoRepairJson(jsonRaw);
      try {
        const jsonData = JSON.parse(repaired);
        if (Array.isArray(jsonData.proposedBudgets)) {
          proposedBudgets = jsonData.proposedBudgets;
          proposedPerpetualPercent = jsonData.proposedPerpetualPercent ?? null;
          totalExpenseBudget =
            typeof jsonData.totalExpenseBudget === "number"
              ? jsonData.totalExpenseBudget
              : jsonData.proposedBudgets.reduce((sum: number, b: { amount?: number }) => sum + (Number(b.amount) || 0), 0);
          proposedPerpetualAmount =
            typeof jsonData.proposedPerpetualAmount === "number" ? jsonData.proposedPerpetualAmount : null;
          savingsAllocation =
            typeof jsonData.savingsAllocation === "number" ? jsonData.savingsAllocation : null;
          savingsRecommendationNote =
            typeof jsonData.savingsRecommendationNote === "string" ? jsonData.savingsRecommendationNote : null;
          done = Boolean(jsonData.done);
        }
      } catch {
        // JSON masih tidak valid setelah repair — abaikan, lanjut percakapan biasa
        console.warn("[Budget Interview] JSON repair failed, raw:", jsonRaw.slice(0, 200));
      }
    }

    // Hapus SELURUH artefak JSON dari teks yang ditampilkan ke user
    // Mencakup: ```json...```, ```json...(terpotong), dan objek JSON mentah
    let displayReply = rawReply
      .replace(/```(?:json)?[\s\S]*?```/g, "")  // blok tertutup
      .replace(/```(?:json)?[\s\S]*$/g, "")      // blok terbuka (terpotong)
      .replace(/\{[\s\S]*"proposedBudgets"[\s\S]*/g, "") // JSON mentah tanpa fence
      .trim();

    return apiSuccess({
      reply: displayReply,
      proposedBudgets,
      proposedPerpetualPercent,
      totalExpenseBudget,
      proposedPerpetualAmount,
      savingsAllocation,
      savingsRecommendationNote,
      done,
    });
  } catch (error) {
    console.error("POST /api/ai/budget-interview error:", error);
    return apiError("INTERNAL_ERROR", "Terjadi kesalahan internal. Silakan coba lagi.", 500);
  }
}
