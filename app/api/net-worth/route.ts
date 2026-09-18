import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { NetWorthSummaryDto, DebtDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    // Ambil semua dompet aktif (termasuk goal dan dana abadi — uang riil user)
    const wallets = await prisma.wallet.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
    });

    const totalWalletsBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    // Ambil semua aset aktif
    const assets = await prisma.asset.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
    });

    const totalAssetsValue = assets.reduce(
      (sum, a) => sum + Number(a.value),
      0
    );

    // Liquid Cash T+3: saldo semua dompet + aset INSTANT + aset T3 (PRD_ASET_UTANG §2.4)
    const liquidCashT3 =
      totalWalletsBalance +
      assets
        .filter((a) => a.liquidityTier === "INSTANT" || a.liquidityTier === "T3")
        .reduce((sum, a) => sum + Number(a.value), 0);

    // Ambil utang aktif
    const debts = await prisma.debt.findMany({
      where: {
        userId: user.id,
      },
    });

    const activeDebts = debts.filter((d) => !d.isPaidOff && Number(d.remainingBalance) > 0);

    const totalDebtsRemaining = activeDebts.reduce(
      (sum, d) => sum + Number(d.remainingBalance),
      0
    );

    // Kekayaan Bersih = Saldo Dompet + Total Aset − Total Utang (PRD_ASET_UTANG §2.1)
    const netWorth = totalWalletsBalance + totalAssetsValue - totalDebtsRemaining;

    // Deteksi reminder cicilan aktif yang dueDayOfMonth-nya dalam <= 3 hari dari hari ini
    const today = new Date();
    const todayDay = today.getDate();
    const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

    const upcomingDebts: DebtDto[] = [];

    for (const d of activeDebts) {
      if (d.dueDayOfMonth !== null && d.dueDayOfMonth !== undefined) {
        let diff = d.dueDayOfMonth - todayDay;
        if (diff < 0) {
          // Tangani pergantian bulan (misal hari ini tgl 30, tempo tgl 2)
          diff = daysInThisMonth - todayDay + d.dueDayOfMonth;
        }

        if (diff >= 0 && diff <= 3) {
          upcomingDebts.push({
            id: d.id,
            name: d.name,
            principal: Number(d.principal),
            remainingBalance: Number(d.remainingBalance),
            monthlyPayment: d.monthlyPayment !== null ? Number(d.monthlyPayment) : null,
            dueDayOfMonth: d.dueDayOfMonth,
            interestRate: d.interestRate !== null ? Number(d.interestRate) : null,
            isPaidOff: d.isPaidOff,
            createdAt: d.createdAt.toISOString(),
          });
        }
      }
    }

    const summary: NetWorthSummaryDto = {
      netWorth,
      totalWalletsBalance,
      totalAssetsValue,
      totalDebtsRemaining,
      liquidCashT3,
      upcomingDebts,
    };

    return apiSuccess(summary);
  } catch (error) {
    console.error("GET /api/net-worth error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat kalkulasi kekayaan bersih", 500);
  }
}
