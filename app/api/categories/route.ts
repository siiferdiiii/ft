import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { categorySchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { CategoryDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const now = new Date();
    // Default rentang awal bulan ini sampai akhir bulan ini
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const categories = await prisma.category.findMany({
      where: { userId: user.id },
      include: {
        transactions: {
          where: {
            transactionDate: {
              gte: startOfMonth,
              lte: endOfMonth,
            },
            type: "EXPENSE",
          },
          select: {
            amount: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const result: CategoryDto[] = categories.map((cat) => {
      const budgetLimitNum = cat.budgetLimit ? Number(cat.budgetLimit) : null;
      const currentExpense = cat.transactions.reduce(
        (sum, t) => sum + Number(t.amount),
        0
      );

      let remainingPercent: number | null = null;
      let statusColor: CategoryDto["statusColor"] = "neutral";

      if (budgetLimitNum && budgetLimitNum > 0) {
        remainingPercent = Math.max(
          0,
          ((budgetLimitNum - currentExpense) / budgetLimitNum) * 100
        );

        if (remainingPercent > 80) {
          statusColor = "green";
        } else if (remainingPercent > 50) {
          statusColor = "yellow";
        } else if (remainingPercent > 20) {
          statusColor = "orange";
        } else {
          statusColor = "red";
        }
      }

      return {
        id: cat.id,
        name: cat.name,
        icon: cat.icon,
        type: cat.type,
        budgetLimit: budgetLimitNum,
        budgetPeriod: cat.budgetPeriod,
        currentExpense,
        remainingPercent: remainingPercent !== null ? Math.round(remainingPercent) : null,
        statusColor,
        createdAt: cat.createdAt.toISOString(),
      };
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/categories error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat kategori", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = categorySchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input kategori tidak valid",
        400
      );
    }

    const { name, type, icon, budgetLimit, budgetPeriod } = parsed.data;

    const category = await prisma.category.create({
      data: {
        userId: user.id,
        name,
        type,
        icon: icon || null,
        budgetLimit: budgetLimit || null,
        budgetPeriod: budgetPeriod || "MONTHLY",
      },
    });

    const result: CategoryDto = {
      id: category.id,
      name: category.name,
      icon: category.icon,
      type: category.type,
      budgetLimit: category.budgetLimit ? Number(category.budgetLimit) : null,
      budgetPeriod: category.budgetPeriod,
      currentExpense: 0,
      remainingPercent: category.budgetLimit ? 100 : null,
      statusColor: category.budgetLimit ? "green" : "neutral",
      createdAt: category.createdAt.toISOString(),
    };

    return apiSuccess(result, 201);
  } catch (error) {
    console.error("POST /api/categories error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menambahkan kategori", 500);
  }
}
