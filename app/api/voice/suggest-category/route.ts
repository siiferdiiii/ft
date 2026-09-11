import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { suggestCategorySchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";

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

    // Normalisasi kata
    const words = rawInput
      .toLowerCase()
      .replace(/[^\w\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && isNaN(Number(w)));

    if (words.length === 0) {
      return apiSuccess({ categoryId: null, categoryName: null, confidence: 0 });
    }

    // Cari kecocokan kata kunci di CategoryKeyword milik user
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

    if (matchedKeywords.length === 0) {
      return apiSuccess({ categoryId: null, categoryName: null, confidence: 0 });
    }

    // Ambil kategori dengan frekuensi akumulasi tertinggi
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
      confidence: topMatch[1].count,
    });
  } catch (error) {
    console.error("POST /api/voice/suggest-category error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menebak kategori", 500);
  }
}
