/**
 * In-memory database fallback untuk pengembangan lokal tanpa koneksi PostgreSQL Supabase aktif.
 * Memastikan aplikasi tetap dapat diuji, dijalankan, dan diverifikasi secara visual.
 */

export interface MockUser {
  id: string;
  email: string;
  name?: string | null;
  perpetualFundPercent: number;
  createdAt: Date;
}

export interface MockWallet {
  id: string;
  userId: string;
  name: string;
  type: "CASH" | "EWALLET" | "BANK" | "OTHER";
  icon: string | null;
  color: string | null;
  balance: number;
  isArchived: boolean;
  isPerpetualFund: boolean;
  createdAt: Date;
}

export interface MockCategory {
  id: string;
  userId: string;
  name: string;
  icon: string | null;
  type: "INCOME" | "EXPENSE";
  budgetLimit: number | null;
  budgetPeriod: "WEEKLY" | "MONTHLY";
  createdAt: Date;
}

export interface MockTransaction {
  id: string;
  userId: string;
  walletId: string;
  categoryId: string | null;
  type: "INCOME" | "EXPENSE";
  amount: number;
  note: string | null;
  source: "VOICE" | "MANUAL" | "RECEIPT_SCAN";
  rawInput: string | null;
  receiptImageUrl: string | null;
  transactionDate: Date;
  createdAt: Date;
}

export interface MockTransfer {
  id: string;
  userId: string;
  fromWalletId: string;
  toWalletId: string;
  amount: number;
  note: string | null;
  transferDate: Date;
  createdAt: Date;
}

export interface MockKeyword {
  id: string;
  userId: string;
  keyword: string;
  categoryId: string;
  frequency: number;
  updatedAt: Date;
}

const DEFAULT_USER_ID = "demo-user-123";

class MockDatabase {
  users: MockUser[] = [
    {
      id: DEFAULT_USER_ID,
      email: "demo@financetracker.local",
      name: "Demo User",
      perpetualFundPercent: 10,
      createdAt: new Date(),
    },
  ];

  wallets: MockWallet[] = [
    {
      id: "w-cash",
      userId: DEFAULT_USER_ID,
      name: "Tunai",
      type: "CASH",
      icon: null,
      color: "#16A34A",
      balance: 750000,
      isArchived: false,
      isPerpetualFund: false,
      createdAt: new Date(Date.now() - 86400000 * 5),
    },
    {
      id: "w-ewallet",
      userId: DEFAULT_USER_ID,
      name: "GoPay",
      type: "EWALLET",
      icon: null,
      color: "#06B6D4",
      balance: 320000,
      isArchived: false,
      isPerpetualFund: false,
      createdAt: new Date(Date.now() - 86400000 * 3),
    },
    {
      id: "w-bank",
      userId: DEFAULT_USER_ID,
      name: "Bank BCA",
      type: "BANK",
      icon: null,
      color: "#4E44E5",
      balance: 4250000,
      isArchived: false,
      isPerpetualFund: true,
      createdAt: new Date(Date.now() - 86400000 * 4),
    },
  ];

  categories: MockCategory[] = [
    {
      id: "cat-food",
      userId: DEFAULT_USER_ID,
      name: "Makanan & Minuman",
      icon: null,
      type: "EXPENSE",
      budgetLimit: 1500000,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
    {
      id: "cat-transport",
      userId: DEFAULT_USER_ID,
      name: "Transportasi",
      icon: null,
      type: "EXPENSE",
      budgetLimit: 500000,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
    {
      id: "cat-shopping",
      userId: DEFAULT_USER_ID,
      name: "Belanja",
      icon: null,
      type: "EXPENSE",
      budgetLimit: 1000000,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
    {
      id: "cat-bills",
      userId: DEFAULT_USER_ID,
      name: "Tagihan & Utilitas",
      icon: null,
      type: "EXPENSE",
      budgetLimit: 750000,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
    {
      id: "cat-salary",
      userId: DEFAULT_USER_ID,
      name: "Gaji Bulanan",
      icon: null,
      type: "INCOME",
      budgetLimit: null,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
    {
      id: "cat-other-inc",
      userId: DEFAULT_USER_ID,
      name: "Bonus & Lainnya",
      icon: null,
      type: "INCOME",
      budgetLimit: null,
      budgetPeriod: "MONTHLY",
      createdAt: new Date(),
    },
  ];

  transactions: MockTransaction[] = [
    {
      id: "tx-1",
      userId: DEFAULT_USER_ID,
      walletId: "w-cash",
      categoryId: "cat-food",
      type: "EXPENSE",
      amount: 18000,
      note: "Kopi Kenangan",
      source: "VOICE",
      rawInput: "beli kopi kenangan 18 ribu",
      receiptImageUrl: null,
      transactionDate: new Date(Date.now() - 3600000 * 2),
      createdAt: new Date(Date.now() - 3600000 * 2),
    },
    {
      id: "tx-2",
      userId: DEFAULT_USER_ID,
      walletId: "w-cash",
      categoryId: "cat-transport",
      type: "EXPENSE",
      amount: 30000,
      note: "Bensin Motor",
      source: "MANUAL",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(Date.now() - 86400000 * 1),
      createdAt: new Date(Date.now() - 86400000 * 1),
    },
    // Transaksi Bulan Lalu (-30 hari)
    {
      id: "tx-prev-1",
      userId: DEFAULT_USER_ID,
      walletId: "w-bank",
      categoryId: "cat-salary",
      type: "INCOME",
      amount: 5000000,
      note: "Gaji Bulan Lalu",
      source: "MANUAL",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1),
    },
    {
      id: "tx-prev-2",
      userId: DEFAULT_USER_ID,
      walletId: "w-cash",
      categoryId: "cat-food",
      type: "EXPENSE",
      amount: 125000,
      note: "Makan Malam Bersama",
      source: "VOICE",
      rawInput: "makan malam bersama seratus dua puluh lima ribu",
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 12),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 12),
    },
    {
      id: "tx-prev-3",
      userId: DEFAULT_USER_ID,
      walletId: "w-bank",
      categoryId: "cat-bills",
      type: "EXPENSE",
      amount: 250000,
      note: "Tagihan Listrik & WiFi",
      source: "MANUAL",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 15),
    },
    {
      id: "tx-prev-4",
      userId: DEFAULT_USER_ID,
      walletId: "w-ewallet",
      categoryId: "cat-shopping",
      type: "EXPENSE",
      amount: 320000,
      note: "Belanja Bulanan",
      source: "RECEIPT_SCAN",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 1, 20),
    },
    // Transaksi 2 Bulan Lalu (-2 bulan)
    {
      id: "tx-prev2-1",
      userId: DEFAULT_USER_ID,
      walletId: "w-bank",
      categoryId: "cat-salary",
      type: "INCOME",
      amount: 5000000,
      note: "Gaji 2 Bulan Lalu",
      source: "MANUAL",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 1),
    },
    {
      id: "tx-prev2-2",
      userId: DEFAULT_USER_ID,
      walletId: "w-bank",
      categoryId: "cat-transport",
      type: "EXPENSE",
      amount: 450000,
      note: "Tiket Perjalanan",
      source: "MANUAL",
      rawInput: null,
      receiptImageUrl: null,
      transactionDate: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 10),
      createdAt: new Date(new Date().getFullYear(), new Date().getMonth() - 2, 10),
    },
  ];

  transfers: MockTransfer[] = [];
  keywords: MockKeyword[] = [
    {
      id: "kw-1",
      userId: DEFAULT_USER_ID,
      keyword: "kopi",
      categoryId: "cat-food",
      frequency: 3,
      updatedAt: new Date(),
    },
    {
      id: "kw-2",
      userId: DEFAULT_USER_ID,
      keyword: "makan",
      categoryId: "cat-food",
      frequency: 4,
      updatedAt: new Date(),
    },
    {
      id: "kw-3",
      userId: DEFAULT_USER_ID,
      keyword: "bensin",
      categoryId: "cat-transport",
      frequency: 2,
      updatedAt: new Date(),
    },
  ];
}

export const mockDb = new MockDatabase();
