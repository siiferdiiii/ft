import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { StatisticsDto } from "@/lib/types";

// Warna kategori yang harmonis dan sesuai DESIGN_SYSTEM
const CATEGORY_COLORS = [
  "#4E44E5", // Primary indigo
  "#F97316", // Orange
  "#EAB308", // Yellow
  "#16A34A", // Green
  "#06B6D4", // Cyan
  "#8B5CF6", // Purple
  "#EC4899", // Pink
  "#6B7280", // Gray
];

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);

    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "monthly"; // "weekly" | "monthly"
    const monthOffset = parseInt(searchParams.get("monthOffset") || "0", 10);

    const now = new Date();
    // Hitung bulan target berdasarkan offset (0 = bulan ini, -1 = bulan lalu, dst.)
    const targetDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    const targetYear = targetDate.getFullYear();
    const targetMonth = targetDate.getMonth();

    const monthLabel = targetDate.toLocaleDateString("id-ID", {
      month: "long",
      year: "numeric",
    });

    let startDate: Date;
    let endDate: Date;

    if (period === "weekly") {
      // 7 hari terakhir dari sekarang jika bulan berjalan, atau 7 hari akhir dari bulan target
      const refDate = monthOffset === 0 ? now : new Date(targetYear, targetMonth + 1, 0);
      startDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate() - 6, 0, 0, 0);
      endDate = new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 23, 59, 59, 999);
    } else {
      // Awal hingga akhir bulan yang dipilih
      startDate = new Date(targetYear, targetMonth, 1, 0, 0, 0);
      endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    }

    // Ambil transaksi, utang, dompet, dan aset secara paralel dalam satu waktu
    const tenWeeksAgo = new Date(Date.now() - 70 * 24 * 60 * 60 * 1000);

    const [
      transactions,
      activeDebts,
      allDebts,
      wallets,
      assets,
      recentTransactions,
    ] = await Promise.all([
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          transactionDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          category: true,
        },
      }),
      prisma.debt.findMany({
        where: {
          userId: user.id,
          isPaidOff: false,
        },
      }),
      prisma.debt.findMany({
        where: {
          userId: user.id,
        },
      }),
      prisma.wallet.findMany({
        where: {
          userId: user.id,
          isArchived: false,
        },
      }),
      prisma.asset.findMany({
        where: {
          userId: user.id,
          isArchived: false,
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId: user.id,
          transactionDate: {
            gte: tenWeeksAgo,
          },
        },
        select: {
          amount: true,
          type: true,
          transactionDate: true,
        },
      }),
    ]);

    // 1. Agregasi pengeluaran per kategori
    const expenseMap = new Map<string, { name: string; amount: number }>();
    const incomeMap = new Map<string, { name: string; amount: number }>();
    let totalExpense = 0;
    let totalIncome = 0;
    let expenseTxCount = 0;

    for (const t of transactions) {
      const amount = Number(t.amount);
      const catId = t.categoryId || "uncategorized";
      const catName = t.category?.name || "Lainnya";

      if (t.type === "EXPENSE") {
        totalExpense += amount;
        expenseTxCount += 1;
        const curr = expenseMap.get(catId) || { name: catName, amount: 0 };
        curr.amount += amount;
        expenseMap.set(catId, curr);
      } else {
        totalIncome += amount;
        const curr = incomeMap.get(catId) || { name: catName, amount: 0 };
        curr.amount += amount;
        incomeMap.set(catId, curr);
      }
    }

    // Format data pengeluaran
    const expenseArray = Array.from(expenseMap.entries())
      .map(([id, item], idx) => ({
        categoryId: id,
        categoryName: item.name,
        amount: item.amount,
        percentage: totalExpense > 0 ? Math.round((item.amount / totalExpense) * 100) : 0,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
        isLargest: false,
      }))
      .sort((a, b) => b.amount - a.amount);

    if (expenseArray.length > 0 && expenseArray[0].amount > 0) {
      expenseArray[0].isLargest = true;
    }

    // Format data pemasukan
    const incomeArray = Array.from(incomeMap.entries())
      .map(([id, item], idx) => ({
        categoryId: id,
        categoryName: item.name,
        amount: item.amount,
        percentage: totalIncome > 0 ? Math.round((item.amount / totalIncome) * 100) : 0,
        color: CATEGORY_COLORS[idx % CATEGORY_COLORS.length],
      }))
      .sort((a, b) => b.amount - a.amount);

    // 2. Kalender Heatmap untuk bulan target (reuse transactions jika period === 'monthly')
    const endOfTargetMonth = new Date(targetYear, targetMonth + 1, 0);

    const monthTransactions =
      period === "monthly"
        ? transactions
        : await prisma.transaction.findMany({
            where: {
              userId: user.id,
              transactionDate: {
                gte: new Date(targetYear, targetMonth, 1, 0, 0, 0),
                lte: new Date(targetYear, targetMonth + 1, 0, 23, 59, 59),
              },
            },
            select: {
              amount: true,
              transactionDate: true,
            },
          });

    const dayActivityMap = new Map<string, { count: number; totalAmount: number }>();
    for (const t of monthTransactions) {
      const dateKey = (t.transactionDate instanceof Date ? t.transactionDate : new Date(t.transactionDate))
        .toISOString()
        .slice(0, 10);
      const curr = dayActivityMap.get(dateKey) || { count: 0, totalAmount: 0 };
      curr.count += 1;
      curr.totalAmount += Number(t.amount);
      dayActivityMap.set(dateKey, curr);
    }

    const calendarHeatmap: StatisticsDto["calendarHeatmap"] = [];
    const totalDays = endOfTargetMonth.getDate();

    for (let day = 1; day <= totalDays; day++) {
      const d = new Date(targetYear, targetMonth, day);
      const dateStr = d.toISOString().slice(0, 10);
      const activity = dayActivityMap.get(dateStr) || { count: 0, totalAmount: 0 };

      let intensity: 0 | 1 | 2 | 3 | 4 = 0;
      if (activity.count === 0) intensity = 0;
      else if (activity.count === 1) intensity = 1;
      else if (activity.count <= 3) intensity = 2;
      else if (activity.count <= 5) intensity = 3;
      else intensity = 4;

      calendarHeatmap.push({
        date: dateStr,
        count: activity.count,
        totalAmount: activity.totalAmount,
        intensity,
      });
    }

    // 3. Kalkulasi Free Cash Flow (Bulanan) per PRD_ASET_UTANG §2.5
    const totalMonthlyDebtPayments = activeDebts.reduce(
      (sum, d) => sum + (d.monthlyPayment !== null ? Number(d.monthlyPayment) : 0),
      0
    );

    const freeCashFlow = {
      amount: totalIncome - totalExpense - totalMonthlyDebtPayments,
      totalIncome,
      totalExpense,
      totalMonthlyDebtPayments,
    };

    // 4. Kalkulasi Nilai Terkini Aset, Utang, dan Kas Dompet
    const currentWalletsBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );
    const currentAssetsValue = assets.reduce(
      (sum, a) => sum + Number(a.value),
      0
    );
    const currentTotalAssets = currentWalletsBalance + currentAssetsValue;
    const currentTotalDebts = activeDebts.reduce(
      (sum, d) => sum + Number(d.remainingBalance),
      0
    );
    const currentNetWorth = currentTotalAssets - currentTotalDebts;

    // Liquid Cash T+3: Saldo Dompet + Aset INSTANT & T3
    const liquidCashT3 =
      currentWalletsBalance +
      assets
        .filter((a) => a.liquidityTier === "INSTANT" || a.liquidityTier === "T3")
        .reduce((sum, a) => sum + Number(a.value), 0);

    // 5. Kalkulasi Indikator Finansial Lengkap (Financial Health)
    const savingsRate =
      totalIncome > 0
        ? Number((((totalIncome - totalExpense) / totalIncome) * 100).toFixed(1))
        : totalExpense > 0
        ? -100
        : 0;

    let savingsRateStatus: "EXCELLENT" | "GOOD" | "FAIR" | "LOW" | "DEFICIT" = "FAIR";
    if (totalIncome === 0 && totalExpense > 0) {
      savingsRateStatus = "DEFICIT";
    } else if (savingsRate >= 30) {
      savingsRateStatus = "EXCELLENT";
    } else if (savingsRate >= 20) {
      savingsRateStatus = "GOOD";
    } else if (savingsRate >= 10) {
      savingsRateStatus = "FAIR";
    } else if (savingsRate >= 0) {
      savingsRateStatus = "LOW";
    } else {
      savingsRateStatus = "DEFICIT";
    }

    // Hari aktif dalam periode untuk daily burn rate
    let activeDaysCount = 1;
    if (period === "weekly") {
      activeDaysCount = 7;
    } else {
      if (monthOffset === 0) {
        activeDaysCount = Math.max(1, now.getDate());
      } else {
        activeDaysCount = totalDays;
      }
    }

    const dailyAverageExpense = Math.round(totalExpense / activeDaysCount);
    const averageExpensePerTransaction =
      expenseTxCount > 0 ? Math.round(totalExpense / expenseTxCount) : 0;
    const debtToAssetRatio =
      currentTotalAssets > 0
        ? Number(((currentTotalDebts / currentTotalAssets) * 100).toFixed(1))
        : 0;
    const debtToIncomeRatio =
      totalIncome > 0
        ? Number(((totalMonthlyDebtPayments / totalIncome) * 100).toFixed(1))
        : 0;

    const financialHealth = {
      savingsRate,
      savingsRateStatus,
      netCashFlow: totalIncome - totalExpense,
      dailyAverageExpense,
      totalTransactionsCount: transactions.length,
      expenseTransactionCount: expenseTxCount,
      averageExpensePerTransaction,
      debtToAssetRatio,
      debtToIncomeRatio,
      liquidCashT3,
    };

    // 6. Rekonstruksi Riwayat Mingguan Net Worth & Total Aset (8 Minggu Terakhir)
    const WEEKS_COUNT = 8;
    const weeklyPoints: StatisticsDto["weeklyNetWorthGrowth"] extends infer T
      ? T extends { history: (infer P)[] }
        ? P[]
        : never
      : never = [];

    // Referensi akhir minggu ke-8
    const refEnd =
      monthOffset === 0
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
        : new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    for (let i = WEEKS_COUNT - 1; i >= 0; i--) {
      const weekIndex = WEEKS_COUNT - i;
      // Waktu akhir minggu ke-i
      const weekEndTime = new Date(refEnd.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const weekStartTime = new Date(weekEndTime.getTime() - 7 * 24 * 60 * 60 * 1000 + 1);

      const startDateStr = weekStartTime.toISOString().slice(0, 10);
      const endDateStr = weekEndTime.toISOString().slice(0, 10);

      const startLabel = weekStartTime.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      const endLabel = weekEndTime.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
      });
      const endFullLabel = weekEndTime.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });

      // Saldo kas dompet pada akhir minggu: rollback cash flow setelah weekEndTime
      let netCashFlowAfter = 0;
      for (const tx of recentTransactions) {
        const txDate = new Date(tx.transactionDate);
        if (txDate > weekEndTime) {
          if (tx.type === "INCOME") {
            netCashFlowAfter += Number(tx.amount);
          } else {
            netCashFlowAfter -= Number(tx.amount);
          }
        }
      }
      const walletsBalanceAtWeek = Math.max(0, currentWalletsBalance - netCashFlowAfter);

      // Nilai aset tercatat pada akhir minggu
      const assetsAtWeek = assets.filter(
        (a) => new Date(a.createdAt) <= weekEndTime
      );
      const assetsValueAtWeek =
        assetsAtWeek.length > 0
          ? assetsAtWeek.reduce((sum, a) => sum + Number(a.value), 0)
          : currentAssetsValue;

      // Utang aktif pada akhir minggu
      const debtsAtWeek = allDebts.filter(
        (d) => !d.isPaidOff && new Date(d.createdAt) <= weekEndTime
      );
      const debtsValueAtWeek =
        debtsAtWeek.length > 0
          ? debtsAtWeek.reduce((sum, d) => sum + Number(d.remainingBalance), 0)
          : currentTotalDebts;

      const totalAssetsAtWeek = walletsBalanceAtWeek + assetsValueAtWeek;
      const netWorthAtWeek = totalAssetsAtWeek - debtsValueAtWeek;

      weeklyPoints.push({
        weekIndex,
        weekLabel: `M${weekIndex}`,
        shortLabel: endLabel,
        startDate: startDateStr,
        endDate: endDateStr,
        formattedDateRange: `${startLabel} – ${endFullLabel}`,
        walletsBalance: Math.round(walletsBalanceAtWeek),
        assetsValue: Math.round(assetsValueAtWeek),
        totalAssets: Math.round(totalAssetsAtWeek),
        debtsRemaining: Math.round(debtsValueAtWeek),
        netWorth: Math.round(netWorthAtWeek),
        wowNetWorthChange: 0,
        wowNetWorthPercent: 0,
        wowTotalAssetsChange: 0,
      });
    }

    // Hitung perubahan Week-over-Week (WoW) untuk setiap minggu
    for (let idx = 0; idx < weeklyPoints.length; idx++) {
      if (idx > 0) {
        const prev = weeklyPoints[idx - 1];
        const curr = weeklyPoints[idx];

        const nwDiff = curr.netWorth - prev.netWorth;
        const nwPct =
          Math.abs(prev.netWorth) > 0
            ? Number(((nwDiff / Math.abs(prev.netWorth)) * 100).toFixed(1))
            : 0;

        const assetDiff = curr.totalAssets - prev.totalAssets;

        curr.wowNetWorthChange = Math.round(nwDiff);
        curr.wowNetWorthPercent = nwPct;
        curr.wowTotalAssetsChange = Math.round(assetDiff);
      }
    }

    const latestPoint = weeklyPoints[weeklyPoints.length - 1];
    const prevPoint = weeklyPoints[weeklyPoints.length - 2] || latestPoint;

    const latestWoWNetWorthDiff = latestPoint.netWorth - prevPoint.netWorth;
    const latestWoWNetWorthPercent =
      Math.abs(prevPoint.netWorth) > 0
        ? Number(((latestWoWNetWorthDiff / Math.abs(prevPoint.netWorth)) * 100).toFixed(1))
        : 0;

    const latestWoWAssetsDiff = latestPoint.totalAssets - prevPoint.totalAssets;
    const latestWoWAssetsPercent =
      prevPoint.totalAssets > 0
        ? Number(((latestWoWAssetsDiff / prevPoint.totalAssets) * 100).toFixed(1))
        : 0;

    const weeklyNetWorthGrowth = {
      history: weeklyPoints,
      currentNetWorth,
      currentTotalAssets,
      currentTotalDebts,
      currentWalletsBalance,
      currentAssetsValue,
      latestWoWNetWorthDiff,
      latestWoWNetWorthPercent,
      latestWoWAssetsDiff,
      latestWoWAssetsPercent,
      debtToAssetRatio,
    };

    const result: StatisticsDto = {
      totalExpense,
      totalIncome,
      expenseByCategory: expenseArray,
      incomeByCategory: incomeArray,
      calendarHeatmap,
      freeCashFlow,
      weeklyNetWorthGrowth,
      financialHealth,
      monthLabel,
      monthOffset,
      hasNextMonth: monthOffset < 0,
      hasPrevMonth: true,
    };

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/statistics error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat statistik", 500);
  }
}
