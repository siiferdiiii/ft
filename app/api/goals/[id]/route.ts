import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateGoalSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { GoalDto } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateGoalSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data perubahan goal tidak valid",
        400
      );
    }

    const existingGoal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: { wallet: true },
    });

    if (!existingGoal) {
      return apiError("NOT_FOUND", "Goal tidak ditemukan", 404);
    }

    const updateData: {
      name?: string;
      targetAmount?: number;
      targetDate?: Date | null;
      allocationPercent?: number;
      isCompleted?: boolean;
      isArchived?: boolean;
    } = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.targetAmount !== undefined) updateData.targetAmount = parsed.data.targetAmount;
    if (parsed.data.targetDate !== undefined) {
      updateData.targetDate = parsed.data.targetDate ? new Date(parsed.data.targetDate) : null;
    }
    if (parsed.data.allocationPercent !== undefined) {
      updateData.allocationPercent = parsed.data.allocationPercent;
    }
    if (parsed.data.isCompleted !== undefined) updateData.isCompleted = parsed.data.isCompleted;
    if (parsed.data.isArchived !== undefined) updateData.isArchived = parsed.data.isArchived;

    const updated = await prisma.goal.update({
      where: { id },
      data: updateData,
    });

    // Perbarui nama dompet jika nama goal diubah
    if (parsed.data.name && existingGoal.walletId) {
      await prisma.wallet.update({
        where: { id: existingGoal.walletId },
        data: { name: `Goal: ${parsed.data.name}` },
      });
    }

    const dto: GoalDto = {
      id: updated.id,
      name: updated.name,
      targetAmount: Number(updated.targetAmount),
      targetDate: updated.targetDate ? updated.targetDate.toISOString() : null,
      allocationPercent: updated.allocationPercent,
      walletId: updated.walletId,
      walletBalance: existingGoal.wallet ? Number(existingGoal.wallet.balance) : 0,
      isCompleted: updated.isCompleted,
      isArchived: updated.isArchived,
      createdAt: updated.createdAt.toISOString(),
    };

    return apiSuccess(dto);
  } catch (error) {
    console.error("PATCH /api/goals/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui goal", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;

    const existingGoal = await prisma.goal.findFirst({
      where: {
        id,
        userId: user.id,
      },
      include: { wallet: true },
    });

    if (!existingGoal) {
      return apiError("NOT_FOUND", "Goal tidak ditemukan", 404);
    }

    const balance = existingGoal.wallet ? Number(existingGoal.wallet.balance) : 0;

    // Sesuai konfirmasi user: Jika goal diarsipkan dan masih ada saldo,
    // saldo otomatis ditransfer balik ke dompet utama/pertama user.
    await prisma.$transaction(async (tx) => {
      if (balance > 0) {
        const primaryWallet = await tx.wallet.findFirst({
          where: {
            userId: user.id,
            isArchived: false,
            goal: null, // dompet non-goal
          },
          orderBy: { createdAt: "asc" },
        });

        if (primaryWallet) {
          await tx.wallet.update({
            where: { id: existingGoal.walletId },
            data: { balance: { decrement: balance } },
          });

          await tx.wallet.update({
            where: { id: primaryWallet.id },
            data: { balance: { increment: balance } },
          });

          await tx.transfer.create({
            data: {
              userId: user.id,
              fromWalletId: existingGoal.walletId,
              toWalletId: primaryWallet.id,
              amount: balance,
              note: `Pengembalian sisa tabungan dari goal "${existingGoal.name}" yang diarsipkan`,
            },
          });
        }
      }

      await tx.goal.update({
        where: { id },
        data: { isArchived: true },
      });

      await tx.wallet.update({
        where: { id: existingGoal.walletId },
        data: { isArchived: true },
      });
    });

    return apiSuccess({
      message: "Goal berhasil diarsipkan",
      returnedBalance: balance,
    });
  } catch (error) {
    console.error("DELETE /api/goals/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal mengarsipkan goal", 500);
  }
}
