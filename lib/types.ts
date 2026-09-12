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
  monthLabel?: string;
  monthOffset?: number;
  hasNextMonth?: boolean;
  hasPrevMonth?: boolean;
}
