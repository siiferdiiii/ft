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

    // Ambil seluruh transaksi dalam rentang tanggal
    const transactions = await prisma.transaction.findMany({
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
    });

    // 1. Agregasi pengeluaran per kategori
    const expenseMap = new Map<string, { name: string; amount: number }>();
    const incomeMap = new Map<string, { name: string; amount: number }>();
    let totalExpense = 0;
    let totalIncome = 0;

    for (const t of transactions) {
      const amount = Number(t.amount);
      const catId = t.categoryId || "uncategorized";
      const catName = t.category?.name || "Lainnya";

      if (t.type === "EXPENSE") {
        totalExpense += amount;
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

    // 2. Kalender Heatmap untuk bulan target
    const endOfTargetMonth = new Date(targetYear, targetMonth + 1, 0);

    const monthTransactions = await prisma.transaction.findMany({
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
      const dateKey = t.transactionDate.toISOString().slice(0, 10);
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

    const result: StatisticsDto = {
      totalExpense,
      totalIncome,
      expenseByCategory: expenseArray,
      incomeByCategory: incomeArray,
      calendarHeatmap,
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
