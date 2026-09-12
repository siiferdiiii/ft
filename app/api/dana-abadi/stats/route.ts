import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { DanaAbadiStatsDto } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    const [dbUser, wallets, incomeTransactions, expenseTransactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: user.id },
      }),
      prisma.wallet.findMany({
        where: {
          userId: user.id,
          isArchived: false,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "INCOME",
          transactionDate: { gte: threeMonthsAgo },
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: "EXPENSE",
          transactionDate: { gte: twelveMonthsAgo },
        },
      }),
    ]);

    const percent = (dbUser as unknown as { perpetualFundPercent?: number })?.perpetualFundPercent ?? 10;

    // Filter dompet Dana Abadi
    const danaAbadiWallets = wallets.filter((w) => Boolean((w as unknown as { isPerpetualFund?: boolean }).isPerpetualFund));
    const totalDanaAbadiBalance = danaAbadiWallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    // Hitung rata-rata alokasi bulanan 3 bulan terakhir (amount * percent%)
    let monthlyAllocationAverage = 300000; // Fallback default sesuai PRD §3.3
    if (incomeTransactions.length > 0) {
      const totalIncomeAllocation = incomeTransactions.reduce(
        (sum, tx) => sum + (Number(tx.amount) * (percent / 100)),
        0
      );
      // Rata-rata per bulan dalam rentang 3 bulan
      const calculatedAvg = Math.round(totalIncomeAllocation / 3);
      if (calculatedAvg > 0) {
        monthlyAllocationAverage = calculatedAvg;
      }
    }

    // Hitung total pengeluaran 12 bulan terakhir (seluruh kategori per PRD §3.4.1)
    let annualExpenseTotal = 36000000; // Fallback wajar default: Rp3jt x 12 bulan
    if (expenseTransactions.length > 0) {
      const totalExpense = expenseTransactions.reduce(
        (sum, tx) => sum + Number(tx.amount),
        0
      );
      if (totalExpense > 0) {
        annualExpenseTotal = Math.round(totalExpense);
      }
    }

    const result: DanaAbadiStatsDto = {
      totalDanaAbadiBalance,
      danaAbadiWalletCount: danaAbadiWallets.length,
      danaAbadiWallets: danaAbadiWallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        balance: Number(w.balance),
      })),
      perpetualFundPercent: percent,
      monthlyAllocationAverage,
      annualExpenseTotal,
    };

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/dana-abadi/stats error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat statistik Dana Abadi", 500);
  }
}
