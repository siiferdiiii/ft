import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { apiSuccess, apiError } from "@/lib/apiResponse";
import { BalanceGrowthDto, MonthlyBalanceGrowthPoint } from "@/lib/types";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return apiError("UNAUTHORIZED", "Silakan login terlebih dahulu", 401);
    }

    // 1. Ambil seluruh dompet aktif untuk menghitung saldo total saat ini
    const wallets = await prisma.wallet.findMany({
      where: {
        userId: user.id,
        isArchived: false,
      },
    });

    const currentTotalBalance = wallets.reduce(
      (sum, w) => sum + Number(w.balance),
      0
    );

    // 2. Siapkan rentang 6 bulan terakhir (bulan -5 s/d bulan 0 / sekarang)
    const now = new Date();
    const MONTHS_COUNT = 6;
    const startOfOldestMonth = new Date(
      now.getFullYear(),
      now.getMonth() - (MONTHS_COUNT - 1),
      1,
      0,
      0,
      0
    );

    // 3. Ambil seluruh transaksi dalam 6 bulan terakhir
    const transactions = await prisma.transaction.findMany({
      where: {
        userId: user.id,
        transactionDate: {
          gte: startOfOldestMonth,
        },
      },
      select: {
        amount: true,
        type: true,
        transactionDate: true,
      },
    });

    // 4. Siapkan bucket bulanan
    interface MonthBucket {
      monthKey: string;
      label: string;
      fullLabel: string;
      start: Date;
      end: Date;
      income: number;
      expense: number;
      net: number;
    }

    const buckets: MonthBucket[] = [];

    for (let i = MONTHS_COUNT - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();

      const start = new Date(year, month, 1, 0, 0, 0);
      const end =
        i === 0
          ? new Date() // Bulan berjalan s/d detik ini
          : new Date(year, month + 1, 0, 23, 59, 59, 999);

      const label = d.toLocaleDateString("id-ID", { month: "short" });
      const fullLabel = d.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric",
      });
      const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;

      buckets.push({
        monthKey,
        label,
        fullLabel,
        start,
        end,
        income: 0,
        expense: 0,
        net: 0,
      });
    }

    // 5. Agregasi transaksi ke dalam masing-masing bucket
    for (const tx of transactions) {
      const txDate = new Date(tx.transactionDate);
      const amount = Number(tx.amount);

      for (const bucket of buckets) {
        if (txDate >= bucket.start && txDate <= bucket.end) {
          if (tx.type === "INCOME") {
            bucket.income += amount;
          } else {
            bucket.expense += amount;
          }
          break;
        }
      }
    }

    // Hitung net per bucket
    for (const b of buckets) {
      b.net = b.income - b.expense;
    }

    // 6. Hitung saldo kumulatif per akhir tiap bulan secara rolling backward
    // Titik terakhir (bulan berjalan) = currentTotalBalance
    const history: MonthlyBalanceGrowthPoint[] = [];

    for (let i = 0; i < buckets.length; i++) {
      const bucket = buckets[i];
      let balanceAtMonthEnd: number;

      if (i === buckets.length - 1) {
        // Bulan berjalan saat ini
        balanceAtMonthEnd = currentTotalBalance;
      } else {
        // Hitung total perubahan netto yang terjadi SETELAH akhir bulan ini
        let netChangesAfter = 0;
        for (const tx of transactions) {
          const txDate = new Date(tx.transactionDate);
          if (txDate > bucket.end) {
            if (tx.type === "INCOME") {
              netChangesAfter += Number(tx.amount);
            } else {
              netChangesAfter -= Number(tx.amount);
            }
          }
        }
        balanceAtMonthEnd = Math.max(0, currentTotalBalance - netChangesAfter);
      }

      history.push({
        monthKey: bucket.monthKey,
        label: bucket.label,
        fullLabel: bucket.fullLabel,
        balance: Math.round(balanceAtMonthEnd),
        income: Math.round(bucket.income),
        expense: Math.round(bucket.expense),
        net: Math.round(bucket.net),
      });
    }

    // 7. Komparasi Bulan Ini vs Bulan Lalu
    const currentMonthBucket = buckets[buckets.length - 1];
    const prevMonthBucket = buckets[buckets.length - 2] || {
      fullLabel: "Bulan Lalu",
      income: 0,
      expense: 0,
      net: 0,
    };

    const prevMonthBalance =
      history.length >= 2 ? history[history.length - 2].balance : currentTotalBalance;

    const balanceDifference = currentTotalBalance - prevMonthBalance;
    const growthPercentage =
      prevMonthBalance > 0
        ? Number(((balanceDifference / prevMonthBalance) * 100).toFixed(1))
        : 0;

    const result: BalanceGrowthDto = {
      currentBalance: currentTotalBalance,
      history,
      thisMonth: {
        label: currentMonthBucket.fullLabel,
        income: currentMonthBucket.income,
        expense: currentMonthBucket.expense,
        net: currentMonthBucket.net,
        isSurplus: currentMonthBucket.net >= 0,
      },
      prevMonth: {
        label: prevMonthBucket.fullLabel,
        income: prevMonthBucket.income,
        expense: prevMonthBucket.expense,
        net: prevMonthBucket.net,
        isSurplus: prevMonthBucket.net >= 0,
      },
      monthOverMonth: {
        difference: balanceDifference,
        percentage: growthPercentage,
        isPositive: balanceDifference >= 0,
        incomeDifference: currentMonthBucket.income - prevMonthBucket.income,
      },
    };

    return apiSuccess(result);
  } catch (error) {
    console.error("GET /api/statistics/balance-growth error:", error);
    return apiError("INTERNAL_ERROR", "Gagal memuat histori pertumbuhan saldo", 500);
  }
}
