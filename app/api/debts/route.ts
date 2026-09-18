import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { debtSchema } from "@/lib/validators";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { DebtDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const debts = await prisma.debt.findMany({
      where: {
        userId: user.id,
      },
      orderBy: { createdAt: "desc" },
    });

    const result: DebtDto[] = debts.map((d) => ({
      id: d.id,
      name: d.name,
      principal: Number(d.principal),
      remainingBalance: Number(d.remainingBalance),
      monthlyPayment: d.monthlyPayment !== null ? Number(d.monthlyPayment) : null,
      dueDayOfMonth: d.dueDayOfMonth,
      interestRate: d.interestRate !== null ? Number(d.interestRate) : null,
      isPaidOff: d.isPaidOff,
      createdAt: d.createdAt.toISOString(),
    }));

    // Urutkan: utang yang belum lunas di atas
    result.sort((a, b) => {
      if (a.isPaidOff === b.isPaidOff) return 0;
      return a.isPaidOff ? 1 : -1;
    });

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/debts error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat daftar utang", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const body = await req.json();
    const parsed = debtSchema.safeParse(body);

    if (!parsed.success) {
      return apiError(
        "VALIDATION_ERROR",
        parsed.error.errors[0]?.message || "Input data utang tidak valid",
        400
      );
    }

    const { name, principal, remainingBalance, monthlyPayment, dueDayOfMonth, interestRate } =
      parsed.data;

    const isPaidOff = remainingBalance <= 0;

    const debt = await prisma.debt.create({
      data: {
        userId: user.id,
        name,
        principal,
        remainingBalance,
        monthlyPayment: monthlyPayment ?? null,
        dueDayOfMonth: dueDayOfMonth ?? null,
        interestRate: interestRate ?? null,
        isPaidOff,
      },
    });

    const dto: DebtDto = {
      id: debt.id,
      name: debt.name,
      principal: Number(debt.principal),
      remainingBalance: Number(debt.remainingBalance),
      monthlyPayment: debt.monthlyPayment !== null ? Number(debt.monthlyPayment) : null,
      dueDayOfMonth: debt.dueDayOfMonth,
      interestRate: debt.interestRate !== null ? Number(debt.interestRate) : null,
      isPaidOff: debt.isPaidOff,
      createdAt: debt.createdAt.toISOString(),
    };

    return apiSuccess(dto, 201);
  } catch (error) {
    console.error("POST /api/debts error:", error);
    return apiError("INTERNAL_ERROR", "Gagal mencatat utang baru", 500);
  }
}
