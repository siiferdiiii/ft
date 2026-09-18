import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { updateDebtSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { DebtDto } from "@/lib/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;
    const body = await req.json();
    const parsed = updateDebtSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Data perubahan utang tidak valid",
        400
      );
    }

    const existing = await prisma.debt.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Data utang tidak ditemukan", 404);
    }

    const updateData: {
      name?: string;
      principal?: number;
      remainingBalance?: number;
      monthlyPayment?: number | null;
      dueDayOfMonth?: number | null;
      interestRate?: number | null;
      isPaidOff?: boolean;
    } = {};

    if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
    if (parsed.data.principal !== undefined) updateData.principal = parsed.data.principal;
    if (parsed.data.monthlyPayment !== undefined) updateData.monthlyPayment = parsed.data.monthlyPayment;
    if (parsed.data.dueDayOfMonth !== undefined) updateData.dueDayOfMonth = parsed.data.dueDayOfMonth;
    if (parsed.data.interestRate !== undefined) updateData.interestRate = parsed.data.interestRate;

    if (parsed.data.remainingBalance !== undefined) {
      updateData.remainingBalance = parsed.data.remainingBalance;
      if (parsed.data.remainingBalance <= 0) {
        updateData.isPaidOff = true;
      }
    }

    if (parsed.data.isPaidOff !== undefined) {
      updateData.isPaidOff = parsed.data.isPaidOff;
      if (parsed.data.isPaidOff && updateData.remainingBalance === undefined) {
        updateData.remainingBalance = 0;
      }
    }

    const updated = await prisma.debt.update({
      where: { id },
      data: updateData,
    });

    const dto: DebtDto = {
      id: updated.id,
      name: updated.name,
      principal: Number(updated.principal),
      remainingBalance: Number(updated.remainingBalance),
      monthlyPayment: updated.monthlyPayment !== null ? Number(updated.monthlyPayment) : null,
      dueDayOfMonth: updated.dueDayOfMonth,
      interestRate: updated.interestRate !== null ? Number(updated.interestRate) : null,
      isPaidOff: updated.isPaidOff,
      createdAt: updated.createdAt.toISOString(),
    };

    return apiSuccess(dto);
  } catch (error) {
    console.error("PATCH /api/debts/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memperbarui data utang", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { id } = await params;

    const existing = await prisma.debt.findFirst({
      where: { id, userId: user.id },
    });

    if (!existing) {
      return apiError("NOT_FOUND", "Data utang tidak ditemukan", 404);
    }

    await prisma.debt.delete({
      where: { id },
    });

    return apiSuccess({ message: "Data utang berhasil dihapus" });
  } catch (error) {
    console.error("DELETE /api/debts/[id] error:", error);
    return apiError("INTERNAL_ERROR", "Gagal menghapus data utang", 500);
  }
}
