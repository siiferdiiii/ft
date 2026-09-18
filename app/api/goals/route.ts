import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { goalSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { GoalDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const goals = await prisma.goal.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
      include: {
        wallet: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const result: GoalDto[] = goals.map((g) => ({
      id: g.id,
      name: g.name,
      targetAmount: Number(g.targetAmount),
      targetDate: g.targetDate ? g.targetDate.toISOString() : null,
      allocationPercent: g.allocationPercent,
      walletId: g.walletId,
      walletBalance: g.wallet ? Number(g.wallet.balance) : 0,
      isCompleted: Boolean(g.isCompleted || (g.wallet && Number(g.wallet.balance) >= Number(g.targetAmount))),
      isArchived: g.isArchived,
      createdAt: g.createdAt.toISOString(),
    }));

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/goals error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat daftar goal", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = goalSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input goal tidak valid",
        400
      );
    }

    const { name, targetAmount, targetDate, allocationPercent } = parsed.data;

    // Dedicated wallet 1:1 wajib dibuat bersamaan dalam prisma.$transaction (PRD_GOALS §2 & CODING_STANDARDS)
    const result = await prisma.$transaction(async (tx) => {
      const dedicatedWallet = await tx.wallet.create({
        data: {
          userId: user.id,
          name: `Goal: ${name}`,
          type: "OTHER",
          color: "#8B5CF6",
          icon: "target",
          balance: 0,
          isArchived: false,
          isPerpetualFund: false,
        },
      });

      const goal = await tx.goal.create({
        data: {
          userId: user.id,
          name,
          targetAmount,
          targetDate: targetDate ? new Date(targetDate) : null,
          allocationPercent: allocationPercent ?? 5,
          walletId: dedicatedWallet.id,
          isCompleted: false,
          isArchived: false,
        },
        include: {
          wallet: true,
        },
      });

      return goal;
    });

    const dto: GoalDto = {
      id: result.id,
      name: result.name,
      targetAmount: Number(result.targetAmount),
      targetDate: result.targetDate ? result.targetDate.toISOString() : null,
      allocationPercent: result.allocationPercent,
      walletId: result.walletId,
      walletBalance: result.wallet ? Number(result.wallet.balance) : 0,
      isCompleted: result.isCompleted,
      isArchived: result.isArchived,
      createdAt: result.createdAt.toISOString(),
    };

    return apiSuccess(dto, 201);
  } catch (error) {
    console.error("POST /api/goals error:", error);
    return apiError("INTERNAL_ERROR", "Gagal membuat goal baru", 500);
  }
}
