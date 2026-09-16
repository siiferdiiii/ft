import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { applyBudgetSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";

// Endpoint POST: menyimpan hasil akhir interview budget ke database.
// Dipanggil hanya saat user konfirmasi final - tidak ada auto-apply di tengah percakapan (PRD §2.2).
// Semua update dibungkus prisma.$transaction() agar konsisten (CODING_STANDARDS §6.3).
export async function POST(req: NextRequest): Promise<Response> {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = applyBudgetSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input tidak valid",
        400
      );
    }

    const { budgets, perpetualFundPercent, monthlyIncome } = parsed.data;

    // Validasi IDOR: pastikan semua categoryId milik user ini - bukan user lain
    // (SECURITY_STANDARDS §3: query selalu filter userId)
    const categoryIds = budgets.map((b) => b.categoryId);
    const ownedCategories = await prisma.category.findMany({
      where: { id: { in: categoryIds }, userId: user.id, type: "EXPENSE" },
      select: { id: true },
    });

    const ownedIds = new Set(ownedCategories.map((c) => c.id));
    const invalidIds = categoryIds.filter((id) => !ownedIds.has(id));
    if (invalidIds.length > 0) {
      return apiError(
        "FORBIDDEN",
        "Beberapa kategori tidak ditemukan atau bukan milikmu",
        403
      );
    }

    // Semua update dalam satu transaksi database untuk konsistensi
    await prisma.$transaction(async (tx) => {
      // Update budgetLimit per kategori
      for (const budget of budgets) {
        await tx.category.update({
          where: { id: budget.categoryId },
          data: { budgetLimit: budget.budgetLimit },
        });
      }

      // Update User: perpetualFundPercent (jika berubah) + monthlyIncome
      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(perpetualFundPercent !== undefined && { perpetualFundPercent }),
          ...(monthlyIncome !== undefined && { monthlyIncome }),
        },
      });
    });

    return apiSuccess({
      message: "Budget berhasil disimpan",
      updatedCategories: categoryIds.length,
    });
  } catch (error) {
    console.error("POST /api/ai/budget-interview/apply error:", error);
    return apiError("INTERNAL_ERROR", "Terjadi kesalahan saat menyimpan budget. Silakan coba lagi.", 500);
  }
}
