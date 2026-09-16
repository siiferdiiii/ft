import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetInterviewSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { callGeminiWithFailover, getGeminiApiKeys } from "@/lib/gemini";

// Endpoint POST: terima riwayat percakapan multi-turn, kirim ke Gemini, return balasan AI.
// State percakapan tidak disimpan ke DB - hanya ada di client session (sesuai PRD §2.2).
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

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

    // System prompt: mendefinisikan persona, alur 6 langkah, dan guardrail topik.
    const systemPrompt = `Kamu adalah asisten keuangan pribadi bernama "Fin" yang membantu user menyusun rencana budget bulanan.
Percakapan ini bersifat privat - data hanya dipakai untuk sesi ini, tidak disimpan permanen.

KONTEKS USER:
- Persentase Dana Abadi saat ini: ${perpetualPercent}%
- Pendapatan bulanan terakhir: ${effectiveIncome ? `Rp ${effectiveIncome.toLocaleString("id-ID")}` : "belum diketahui"}
- Kategori pengeluaran yang tersedia:
${categoryList || "  (belum ada kategori - beritahu user untuk membuat kategori di menu Kategori)"}

ALUR INTERVIEW (ikuti urutan ini):
1. Tanya total pengeluaran bulanan rata-rata user.
2. Tanya kategori mana yang paling banyak menghabiskan uang (jawaban bebas).
3. Tanya pendapatan/income bulanan. Jika sudah diketahui dari konteks, konfirmasi saja.
4. Arahkan user untuk menyisihkan ${perpetualPercent}% dari income ke Dana Abadi untuk masa depan. User bisa minta ubah persentasenya.
5. Tanya berapa tambahan yang ingin ditabung di luar Dana Abadi (misalnya beli barang tertentu, liburan).
6. Hitung sisa (income minus alokasi Dana Abadi minus tabungan tambahan), bagi ke kategori yang tersedia dengan bobot lebih besar ke kategori yang paling banyak disebut user. Ajukan usulan angka per kategori.

ATURAN PENTING:
- Tetap di topik budget. Tolak pertanyaan soal investasi, utang spesifik, atau nasihat finansial lainnya.
- Gunakan bahasa Indonesia yang ramah dan santai.
- Saat kamu siap mengajukan usulan budget FINAL di langkah 6, sertakan blok JSON ini di akhir responmu:
\`\`\`json
{
  "proposedBudgets": [
    {"categoryId": "<id>", "categoryName": "<nama>", "amount": <angka>}
  ],
  "proposedPerpetualPercent": ${perpetualPercent},
  "done": true
}
\`\`\`
- Jangan sertakan blok JSON sampai kamu benar-benar siap dengan angka final di langkah 6.
- Maksimal percakapan 12 putaran. Jika mendekati batas, segera arahkan ke kesimpulan.`;

    // Jika ini pesan pertama (messages kosong), return sapaan pembuka langsung tanpa panggil Gemini
    if (messages.length === 0) {
      const openingText = savedIncome
        ? `Halo! Aku Fin, asisten budgetmu. Terakhir kamu menyebut pendapatan sekitar Rp ${savedIncome.toLocaleString("id-ID")} - masih sama, atau ada perubahan? Kalau sama, kita langsung lanjut ya! 😊`
        : `Halo! Aku Fin, asisten budgetmu. Aku akan bantu kamu menyusun rencana budget bulanan lewat beberapa pertanyaan singkat.\n\nPertama, kira-kira berapa total pengeluaranmu per bulan? (estimasi kasar saja, tidak harus tepat)`;

      return apiSuccess({ reply: openingText, proposedBudgets: null, done: false });
    }

    // Bangun payload Gemini multi-turn chat
    const geminiPayload = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages.map((m) => ({
        role: m.role,
        parts: [{ text: m.content }],
      })),
      generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
    };

    const { res: geminiRes, status: geminiStatus, allQuotaExceeded } =
      await callGeminiWithFailover(geminiPayload);

    // Handle jika semua key terkena kuota/rate limit (429)
    if (!geminiRes || !geminiRes.ok) {
      const errDetail = geminiRes ? await geminiRes.text().catch(() => "") : "";
      console.error("Gemini call failed with status:", geminiStatus, errDetail);
      if (allQuotaExceeded || geminiStatus === 429) {
        return apiError(
          "QUOTA_EXCEEDED",
          "Fitur AI lagi sibuk - seluruh kuota harian sedang penuh. Coba lagi nanti, atau gunakan 'Hitung otomatis dari histori' sebagai alternatif.",
          429
        );
      }
      return apiError("AI_ERROR", "Terjadi gangguan saat menghubungi asisten AI. Silakan coba lagi.", 502);
    }

    const geminiData = await geminiRes.json();
    const rawReply: string = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!rawReply) {
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
