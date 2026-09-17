import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetInterviewSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { callGeminiWithFailover, getGeminiApiKeys } from "@/lib/gemini";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";

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

    // Ambil kategori pengeluaran milik user + data user (income terakhir + perpetual percent)
    const [expenseCategories, userData] = await Promise.all([
      prisma.category.findMany({
        where: { userId: user.id, type: "EXPENSE" },
        select: { id: true, name: true, budgetLimit: true },
      }),
      prisma.user.findUnique({
        where: { id: user.id },
        select: { perpetualFundPercent: true, monthlyIncome: true },
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

    // System prompt: persona bijak, urutan pertanyaan baru, prioritas kategori, & framing < 2 juta
    const systemPrompt = `Kamu adalah asisten keuangan pribadi bernama "Fin" yang bijak, hangat, dan realistis dalam membantu pengguna menyusun rencana anggaran bulanan yang sehat.
Percakapan ini bersifat privat - data hanya digunakan sementara untuk sesi ini, tidak disimpan permanen.

KONTEKS PENGGUNA:
- Persentase Dana Abadi saat ini: ${perpetualPercent}%
- Pendapatan bulanan terakhir: ${effectiveIncome ? `Rp ${effectiveIncome.toLocaleString("id-ID")}` : "belum diketahui"}
- Kategori pengeluaran yang tersedia di akun pengguna:
${categoryList || "  (belum ada kategori - sarankan pengguna membuat kategori di menu Kategori)"}

ALUR WAWANCARA KEUANGAN (Ikuti urutan langkah berikut secara bijak, ajukan 1 pertanyaan per putaran):
1. PENGHASILAN: Tanyakan berapa total penghasilan/pemasukan bersih bulanan pengguna. (Jika sudah ada data tersimpan, konfirmasi apakah masih sama atau ada perubahan).
2. PENGELUARAN WAJIB: Tanyakan apa saja pengeluaran wajib/rutin setiap bulan dan berapa perkiraan nominalnya (misal: sewa kos/kontrakan, cicilan, listrik/air, internet/pulsa, dll). Berikan apresiasi atas keterbukaan pengguna.
3. POS PALING BOROS: Tanyakan "Dalam 1 bulan terakhir, uang Anda paling banyak habis di mana?" untuk mengidentifikasi pos pengeluaran terbesar atau gaya hidup.
4. DANA ABADI & TABUNGAN:
   - Arahkan pengguna dengan bijak untuk menyisihkan ${perpetualPercent}% dari penghasilan ke Dana Abadi untuk masa depan (prinsip membayar diri sendiri terlebih dahulu). Pengguna bebas mengubah persentasenya jika ingin.
   - Tanyakan apakah ada rencana tabungan tambahan di luar Dana Abadi (misal: dana liburan, beli barang impian, atau dana darurat).
5. SUSUN BUDGET PER KATEGORI (PRIORITAS & FRAMING BIJAK):
   - Tentukan skala prioritas dari kategori yang dimiliki pengguna (Kebutuhan Pokok & Tagihan Rutin > Kebutuhan Pendukung > Hiburan/Keinginan).
   - ATURAN FRAMING KETAT: Set usulan budget maksimal untuk SETIAP kategori di bawah Rp 2.000.000 (< 2 juta rupiah per kategori, misalnya Rp 400.000 hingga Rp 1.800.000) untuk membiasakan hidup terencana dan terkendali, KECUALI jika pengguna secara eksplisit meminta nominal lebih tinggi atau meminta revisi.
   - Total budget yang diusulkan tidak boleh melebihi sisa uang (penghasilan dikurangi Dana Abadi dan tabungan).
   - Berikan ulasan bijak dan ajukan usulan angka per kategori.

ATURAN PENTING:
- Bertanyalah satu topik secara runtut per putaran. Jangan gabungkan 2 pertanyaan berat sekaligus.
- Bersikaplah bijak, empati, dan suportif.
- Tetap di koridor anggaran keuangan pribadi. Tolak pertanyaan spekulasi investasi berisiko atau pinjaman online.
- Gunakan bahasa Indonesia yang santun, hangat, dan mudah dipahami.
- Saat kamu siap mengajukan usulan budget FINAL di langkah 5, sertakan blok JSON ini di akhir responmu:
\`\`\`json
{
  "proposedBudgets": [
    {"categoryId": "<id>", "categoryName": "<nama>", "amount": <angka>}
  ],
  "proposedPerpetualPercent": ${perpetualPercent},
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
        maxOutputTokens: 1024,
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
    let done = false;

    const jsonMatch = rawReply.match(/```json\s*([\s\S]*?)```/);
    if (jsonMatch?.[1]) {
      try {
        const jsonData = JSON.parse(jsonMatch[1].trim());
        if (Array.isArray(jsonData.proposedBudgets)) {
          proposedBudgets = jsonData.proposedBudgets;
          proposedPerpetualPercent = jsonData.proposedPerpetualPercent ?? null;
          done = Boolean(jsonData.done);
        }
      } catch {
        // Blok JSON tidak valid - abaikan, lanjut percakapan biasa
      }
    }

    // Hapus blok JSON dari teks yang ditampilkan ke user agar rapi
    const displayReply = rawReply.replace(/```json[\s\S]*?```/g, "").trim();

    return apiSuccess({ reply: displayReply, proposedBudgets, proposedPerpetualPercent, done });
  } catch (error) {
    console.error("POST /api/ai/budget-interview error:", error);
    return apiError("INTERNAL_ERROR", "Terjadi kesalahan internal. Silakan coba lagi.", 500);
  }
}
