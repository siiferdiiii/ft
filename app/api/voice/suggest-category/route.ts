import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestCategorySchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { parseVoiceInput, INCOME_DICTIONARY } from "@/lib/parseVoiceAmount";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = suggestCategorySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input tidak valid",
        400
      );
    }

    const { rawInput } = parsed.data;
    const normalizedInput = rawInput.toLowerCase();

    // 1. Cek analisis arah transaksi & kamus pemasukan (income dictionary)
    const voiceAnalysis = parseVoiceInput(rawInput);

    if (voiceAnalysis.type === "INCOME") {
      // Ambil seluruh kategori bertipe INCOME milik user
      const incomeCategories = await prisma.category.findMany({
        where: { userId: user.id, type: "INCOME" },
      });

      if (incomeCategories.length > 0) {
        // Cocokkan dengan kategori gaji/upah/honor
        if (
          INCOME_DICTIONARY.gaji.some((k) =>
            new RegExp(`\\b${k}\\b`, "i").test(normalizedInput)
          )
        ) {
          const matched =
            incomeCategories.find((c) => /gaji|upah|salary|honor/i.test(c.name)) ||
            incomeCategories[0];
          return apiSuccess({
            categoryId: matched.id,
            categoryName: matched.name,
            type: "INCOME",
            confidence: 10,
          });
        }

        // Cocokkan dengan kategori bonus/thr/hadiah
        if (
          INCOME_DICTIONARY.bonus.some((k) =>
            new RegExp(`\\b${k}\\b`, "i").test(normalizedInput)
          )
        ) {
          const matched =
            incomeCategories.find((c) => /bonus|thr|hadiah|lain/i.test(c.name)) ||
            incomeCategories[0];
          return apiSuccess({
            categoryId: matched.id,
            categoryName: matched.name,
            type: "INCOME",
            confidence: 10,
          });
        }

        // Default pemasukan lainnya
        const fallback =
          incomeCategories.find((c) => /lain|bonus/i.test(c.name)) ||
          incomeCategories[0];
        return apiSuccess({
          categoryId: fallback.id,
          categoryName: fallback.name,
          type: "INCOME",
          confidence: 5,
        });
      }
    }

    // 2. Jika bukan pemasukan, cek histori pemakaian user di CategoryKeyword
    const words = normalizedInput
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && isNaN(Number(w)));

    if (words.length > 0) {
      const matchedKeywords = await prisma.categoryKeyword.findMany({
        where: {
          userId: user.id,
          keyword: { in: words },
        },
        include: {
          category: true,
        },
        orderBy: { frequency: "desc" },
        take: 5,
      });

      if (matchedKeywords.length > 0) {
        const categoryFrequencyMap: Record<string, { count: number; name: string }> = {};
        for (const item of matchedKeywords) {
          if (!categoryFrequencyMap[item.categoryId]) {
            categoryFrequencyMap[item.categoryId] = {
              count: 0,
              name: item.category.name,
            };
          }
          categoryFrequencyMap[item.categoryId].count += item.frequency;
        }

        const sortedCategories = Object.entries(categoryFrequencyMap).sort(
          (a, b) => b[1].count - a[1].count
        );

        const topMatch = sortedCategories[0];
        return apiSuccess({
          categoryId: topMatch[0],
          categoryName: topMatch[1].name,
          type: "EXPENSE",
          confidence: topMatch[1].count,
        });
      }
    }

    // 3. Kamus bawaan pengeluaran umum (Day-1 Fallback)
    const expenseCategories = await prisma.category.findMany({
      where: { userId: user.id, type: "EXPENSE" },
    });

    if (expenseCategories.length > 0) {
      if (/kopi|teh|makan|minum|nasi|ayam|mie|roti|snack|soto|bakso/i.test(normalizedInput)) {
        const cat = expenseCategories.find((c) => /makan|minum|food/i.test(c.name));
        if (cat) return apiSuccess({ categoryId: cat.id, categoryName: cat.name, type: "EXPENSE", confidence: 5 });
      }

      if (/bensin|pertalite|pertamax|parkir|tol|gojek|grab|ojol|angkot|kereta|bus/i.test(normalizedInput)) {
        const cat = expenseCategories.find((c) => /transport/i.test(c.name));
        if (cat) return apiSuccess({ categoryId: cat.id, categoryName: cat.name, type: "EXPENSE", confidence: 5 });
      }

      if (/belanja|baju|sepatu|minimarket|indomaret|alfamart|supermarket/i.test(normalizedInput)) {
        const cat = expenseCategories.find((c) => /belanja|shopping/i.test(c.name));
        if (cat) return apiSuccess({ categoryId: cat.id, categoryName: cat.name, type: "EXPENSE", confidence: 5 });
      }

      if (/listrik|pln|air|pdam|wifi|internet|pulsa|kuota|kos/i.test(normalizedInput)) {
        const cat = expenseCategories.find((c) => /tagihan|utilitas/i.test(c.name));
        if (cat) return apiSuccess({ categoryId: cat.id, categoryName: cat.name, type: "EXPENSE", confidence: 5 });
      }
    }

    return apiSuccess({ categoryId: null, categoryName: null, type: voiceAnalysis.type, confidence: 0 });
  } catch (error) {
    console.error("POST /api/voice/suggest-category error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menebak kategori", 500);
  }
}
