export type ApiResponse<T> =
  | { data: T; error?: never }
  | { error: { code: string; message: string }; data?: never };

export type WalletType = "CASH" | "EWALLET" | "BANK" | "OTHER";
export type TransactionType = "INCOME" | "EXPENSE";
export type InputSource = "VOICE" | "MANUAL" | "RECEIPT_SCAN";
export type BudgetPeriod = "WEEKLY" | "MONTHLY";

export interface WalletDto {
  id: string;
  name: string;
  type: WalletType;
  icon: string | null;
  color: string | null;
  balance: number;
  isArchived: boolean;
  isPerpetualFund: boolean;
  createdAt: string;
}

export interface UserSettingsDto {
  perpetualFundPercent: number;
  email?: string;
  name?: string | null;
}

export interface DanaAbadiStatsDto {
  totalDanaAbadiBalance: number;
  danaAbadiWalletCount: number;
  danaAbadiWallets: Array<{
    id: string;
    name: string;
    type: WalletType;
    balance: number;
  }>;
  perpetualFundPercent: number;
  monthlyAllocationAverage: number;
  annualExpenseTotal: number;
}

export interface CategoryDto {
  id: string;
  name: string;
  icon: string | null;
  type: TransactionType;
  budgetLimit: number | null;
  budgetPeriod: BudgetPeriod;
  currentExpense?: number;
  remainingPercent?: number | null;
  statusColor?: "green" | "yellow" | "orange" | "red" | "neutral";
  createdAt: string;
}

export interface TransactionDto {
  id: string;
  walletId: string;
  walletName?: string;
  categoryId: string | null;
  categoryName?: string | null;
  type: TransactionType;
  amount: number;
  note: string | null;
  source: InputSource;
  rawInput: string | null;
  receiptImageUrl: string | null;
  transactionDate: string;
  createdAt: string;
}

export interface TransferDto {
  id: string;
  fromWalletId: string;
  fromWalletName?: string;
  toWalletId: string;
  toWalletName?: string;
  amount: number;
  note: string | null;
  transferDate: string;
  createdAt: string;
}

export interface StatisticsDto {
  totalExpense: number;
  totalIncome: number;
  expenseByCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
    isLargest: boolean;
  }>;
  incomeByCategory: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
  }>;
  calendarHeatmap: Array<{
    date: string; // YYYY-MM-DD
    count: number;
    totalAmount: number;
    intensity: 0 | 1 | 2 | 3 | 4;
  }>;
  freeCashFlow?: FreeCashFlowDto;
  weeklyNetWorthGrowth?: WeeklyNetWorthGrowthDto;
  financialHealth?: FinancialHealthMetricsDto;
  monthLabel?: string;
  monthOffset?: number;
  hasNextMonth?: boolean;
  hasPrevMonth?: boolean;
}

export interface WeeklyNetWorthPoint {
  weekIndex: number;          // 1 .. 8
  weekLabel: string;          // "M1", "M2" or "8-14 Sep"
  shortLabel: string;         // e.g. "8 Sep"
  startDate: string;          // YYYY-MM-DD
  endDate: string;            // YYYY-MM-DD
  formattedDateRange: string; // "8 Sep – 14 Sep 2026"
  walletsBalance: number;     // Saldo kas dompet pada akhir minggu ini
  assetsValue: number;        // Nilai aset non-kas pada akhir minggu ini
  totalAssets: number;        // walletsBalance + assetsValue
  debtsRemaining: number;     // Total utang aktif pada akhir minggu ini
  netWorth: number;           // totalAssets - debtsRemaining
  wowNetWorthChange: number;  // Perubahan net worth vs minggu sebelumnya (+/-)
  wowNetWorthPercent: number; // % perubahan net worth vs minggu sebelumnya
  wowTotalAssetsChange: number; // Perubahan total aset vs minggu sebelumnya (+/-)
}

export interface WeeklyNetWorthGrowthDto {
  history: WeeklyNetWorthPoint[];
  currentNetWorth: number;
  currentTotalAssets: number;
  currentTotalDebts: number;
  currentWalletsBalance: number;
  currentAssetsValue: number;
  latestWoWNetWorthDiff: number;
  latestWoWNetWorthPercent: number;
  latestWoWAssetsDiff: number;
  latestWoWAssetsPercent: number;
  debtToAssetRatio: number; // in percent (0 - 100)
}

export interface FinancialHealthMetricsDto {
  savingsRate: number; // in percent (-100 to 100)
  savingsRateStatus: "EXCELLENT" | "GOOD" | "FAIR" | "LOW" | "DEFICIT";
  netCashFlow: number; // totalIncome - totalExpense
  dailyAverageExpense: number;
  totalTransactionsCount: number;
  expenseTransactionCount: number;
  averageExpensePerTransaction: number;
  debtToAssetRatio: number;
  debtToIncomeRatio: number; // in percent
  liquidCashT3: number;
}

export interface MonthlyBalanceGrowthPoint {
  monthKey: string;      // "2026-09"
  label: string;         // "Sep"
  fullLabel: string;     // "September 2026"
  balance: number;       // total cumulative balance at end of this month
  income: number;        // total income received in this month
  expense: number;       // total expense spent in this month
  net: number;           // income - expense (surplus or minus)
}

export interface BalanceGrowthDto {
  currentBalance: number;
  history: MonthlyBalanceGrowthPoint[];
  thisMonth: {
    label: string;
    income: number;
    expense: number;
    net: number;
    isSurplus: boolean;
  };
  prevMonth: {
    label: string;
    income: number;
    expense: number;
    net: number;
    isSurplus: boolean;
  };
  monthOverMonth: {
    difference: number;      // currentBalance - prevMonthBalance
    percentage: number;      // % change
    isPositive: boolean;     // difference >= 0
    incomeDifference: number; // thisMonth.income - prevMonth.income
  };
}

export type AssetLiquidityTier = "INSTANT" | "T3" | "ILLIQUID";

export interface GoalDto {
  id: string;
  name: string;
  targetAmount: number;
  targetDate: string | null;
  allocationPercent: number;
  walletId: string;
  walletBalance: number;
  isCompleted: boolean;
  isArchived: boolean;
  createdAt: string;
}

export interface AssetDto {
  id: string;
  name: string;
  category: string;
  value: number;
  liquidityTier: AssetLiquidityTier;
  lastValuationAt: string;
  isArchived: boolean;
  createdAt: string;
}

export interface DebtDto {
  id: string;
  name: string;
  principal: number;
  remainingBalance: number;
  monthlyPayment: number | null;
  dueDayOfMonth: number | null;
  interestRate: number | null;
  isPaidOff: boolean;
  createdAt: string;
}

export interface NetWorthSummaryDto {
  netWorth: number;
  totalWalletsBalance: number;
  totalAssetsValue: number;
  totalDebtsRemaining: number;
  liquidCashT3: number;
  upcomingDebts: DebtDto[];
  assets?: AssetDto[];
  debts?: DebtDto[];
}

export interface FreeCashFlowDto {
  amount: number;
  totalIncome: number;
  totalExpense: number;
  totalMonthlyDebtPayments: number;
}

