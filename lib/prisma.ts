import { PrismaClient } from "@prisma/client";
import { mockDb, MockTransaction } from "./mockDb";

const hasValidDbUrl = Boolean(
  process.env.DATABASE_URL &&
    process.env.DATABASE_URL.startsWith("postgres") &&
    !process.env.DATABASE_URL.includes("dummy") &&
    process.env.DATABASE_URL.length > 20
);

// Fallback mock Prisma client untuk menjalankan app saat PostgreSQL Supabase belum dikonfigurasi
const createMockPrisma = () => {
  return {
    user: {
      async findUnique({ where }: { where: { id?: string; email?: string } }) {
        return (
          mockDb.users.find(
            (u) =>
              (where.id && u.id === where.id) ||
              (where.email && u.email === where.email)
          ) || null
        );
      },
      async create({ data }: { data: { id: string; email: string; name?: string | null } }) {
        const u = {
          id: data.id,
          email: data.email,
          name: data.name || null,
          createdAt: new Date(),
        };
        mockDb.users.push(u);
        return u;
      },
    },

    wallet: {
      async findMany({ where }: { where: { userId: string; isArchived?: boolean } }) {
        return mockDb.wallets.filter(
          (w) =>
            w.userId === where.userId &&
            (where.isArchived === undefined || w.isArchived === where.isArchived)
        );
      },
      async findFirst({ where }: { where: { id?: string; userId?: string } }) {
        return (
          mockDb.wallets.find(
            (w) =>
              (!where.id || w.id === where.id) &&
              (!where.userId || w.userId === where.userId)
          ) || null
        );
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          type: "CASH" | "EWALLET" | "BANK" | "OTHER";
          color?: string | null;
          icon?: string | null;
          balance?: number;
        };
      }) {
        const newWallet = {
          id: `w-${Date.now()}`,
          userId: data.userId,
          name: data.name,
          type: data.type,
          color: data.color || null,
          icon: data.icon || null,
          balance: data.balance || 0,
          isArchived: false,
          createdAt: new Date(),
        };
        mockDb.wallets.push(newWallet);
        return newWallet;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          type?: "CASH" | "EWALLET" | "BANK" | "OTHER";
          isArchived?: boolean;
          balance?: { increment?: number; decrement?: number } | number;
        };
      }) {
        const wallet = mockDb.wallets.find((w) => w.id === where.id);
        if (!wallet) throw new Error("Wallet not found");

        if (data.name !== undefined) wallet.name = data.name;
        if (data.type !== undefined) wallet.type = data.type;
        if (data.isArchived !== undefined) wallet.isArchived = data.isArchived;
        if (data.balance !== undefined) {
          if (typeof data.balance === "number") {
            wallet.balance = data.balance;
          } else if (data.balance.increment !== undefined) {
            wallet.balance += Number(data.balance.increment);
          } else if (data.balance.decrement !== undefined) {
            wallet.balance -= Number(data.balance.decrement);
          }
        }
        return wallet;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.wallets.findIndex((w) => w.id === where.id);
        if (idx !== -1) mockDb.wallets.splice(idx, 1);
        return { id: where.id };
      },
    },

    category: {
      async findMany({
        where,
      }: {
        where: { userId: string };
        include?: { transactions?: unknown };
      }) {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        return mockDb.categories
          .filter((c) => c.userId === where.userId)
          .map((c) => {
            const relevantTx = mockDb.transactions.filter(
              (t) =>
                t.categoryId === c.id &&
                t.type === "EXPENSE" &&
                t.transactionDate >= startOfMonth
            );
            return {
              ...c,
              transactions: relevantTx.map((t) => ({ amount: t.amount })),
            };
          });
      },
      async findFirst({ where }: { where: { id?: string; userId?: string } }) {
        return (
          mockDb.categories.find(
            (c) =>
              (!where.id || c.id === where.id) &&
              (!where.userId || c.userId === where.userId)
          ) || null
        );
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          type: "INCOME" | "EXPENSE";
          icon?: string | null;
          budgetLimit?: number | null;
          budgetPeriod?: "WEEKLY" | "MONTHLY";
        };
      }) {
        const newCat = {
          id: `cat-${Date.now()}`,
          userId: data.userId,
          name: data.name,
          icon: data.icon || null,
          type: data.type,
          budgetLimit: data.budgetLimit || null,
          budgetPeriod: data.budgetPeriod || "MONTHLY",
          createdAt: new Date(),
        };
        mockDb.categories.push(newCat);
        return newCat;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          budgetLimit?: number | null;
          budgetPeriod?: "WEEKLY" | "MONTHLY";
        };
      }) {
        const cat = mockDb.categories.find((c) => c.id === where.id);
        if (!cat) throw new Error("Category not found");
        if (data.name !== undefined) cat.name = data.name;
        if (data.budgetLimit !== undefined) cat.budgetLimit = data.budgetLimit;
        if (data.budgetPeriod !== undefined) cat.budgetPeriod = data.budgetPeriod;
        return cat;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.categories.findIndex((c) => c.id === where.id);
        if (idx !== -1) mockDb.categories.splice(idx, 1);
        return { id: where.id };
      },
    },

    transaction: {
      async findMany({
        where,
        take,
      }: {
        where: {
          userId: string;
          walletId?: string;
          categoryId?: string;
          type?: "INCOME" | "EXPENSE";
          transactionDate?: { gte?: Date; lte?: Date };
        };
        take?: number;
      }) {
        let list = mockDb.transactions.filter((t) => {
          if (t.userId !== where.userId) return false;
          if (where.walletId && t.walletId !== where.walletId) return false;
          if (where.categoryId && t.categoryId !== where.categoryId) return false;
          if (where.type && t.type !== where.type) return false;
          if (where.transactionDate?.gte && t.transactionDate < where.transactionDate.gte)
            return false;
          if (where.transactionDate?.lte && t.transactionDate > where.transactionDate.lte)
            return false;
          return true;
        });

        list.sort((a, b) => b.transactionDate.getTime() - a.transactionDate.getTime());
        if (take) list = list.slice(0, take);

        return list.map((t) => {
          const w = mockDb.wallets.find((wallet) => wallet.id === t.walletId);
          const c = mockDb.categories.find((cat) => cat.id === t.categoryId);
          return {
            ...t,
            wallet: w ? { name: w.name } : null,
            category: c ? { name: c.name } : null,
          };
        });
      },
      async findFirst({ where }: { where: { id: string; userId: string } }) {
        return (
          mockDb.transactions.find(
            (t) => t.id === where.id && t.userId === where.userId
          ) || null
        );
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          walletId: string;
          categoryId?: string | null;
          type: "INCOME" | "EXPENSE";
          amount: number;
          note?: string | null;
          source: "VOICE" | "MANUAL" | "RECEIPT_SCAN";
          rawInput?: string | null;
          receiptImageUrl?: string | null;
          transactionDate?: Date;
        };
      }) {
        const newTx = {
          id: `tx-${Date.now()}`,
          userId: data.userId,
          walletId: data.walletId,
          categoryId: data.categoryId || null,
          type: data.type,
          amount: data.amount,
          note: data.note || null,
          source: data.source,
          rawInput: data.rawInput || null,
          receiptImageUrl: data.receiptImageUrl || null,
          transactionDate: data.transactionDate || new Date(),
          createdAt: new Date(),
        };
        mockDb.transactions.push(newTx);
        const w = mockDb.wallets.find((wallet) => wallet.id === newTx.walletId);
        const c = mockDb.categories.find((cat) => cat.id === newTx.categoryId);
        return {
          ...newTx,
          wallet: w ? { name: w.name } : null,
          category: c ? { name: c.name } : null,
        };
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<MockTransaction>;
      }) {
        const tx = mockDb.transactions.find((t) => t.id === where.id);
        if (!tx) throw new Error("Transaction not found");
        Object.assign(tx, data);
        return tx;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.transactions.findIndex((t) => t.id === where.id);
        if (idx !== -1) mockDb.transactions.splice(idx, 1);
        return { id: where.id };
      },
      async updateMany({
        where,
        data,
      }: {
        where: { categoryId: string };
        data: { categoryId: null };
      }) {
        mockDb.transactions.forEach((t) => {
          if (t.categoryId === where.categoryId) {
            t.categoryId = data.categoryId;
          }
        });
        return { count: 1 };
      },
    },

    transfer: {
      async findMany({ where, take }: { where: { userId: string }; take?: number }) {
        let list = mockDb.transfers.filter((tr) => tr.userId === where.userId);
        list.sort((a, b) => b.transferDate.getTime() - a.transferDate.getTime());
        if (take) list = list.slice(0, take);
        return list.map((tr) => {
          const fromW = mockDb.wallets.find((w) => w.id === tr.fromWalletId);
          const toW = mockDb.wallets.find((w) => w.id === tr.toWalletId);
          return {
            ...tr,
            fromWallet: { name: fromW?.name || "Dompet Asal" },
            toWallet: { name: toW?.name || "Dompet Tujuan" },
          };
        });
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          fromWalletId: string;
          toWalletId: string;
          amount: number;
          note?: string | null;
          transferDate?: Date;
        };
      }) {
        const newTr = {
          id: `tr-${Date.now()}`,
          userId: data.userId,
          fromWalletId: data.fromWalletId,
          toWalletId: data.toWalletId,
          amount: data.amount,
          note: data.note || null,
          transferDate: data.transferDate || new Date(),
          createdAt: new Date(),
        };
        mockDb.transfers.push(newTr);
        const fromW = mockDb.wallets.find((w) => w.id === newTr.fromWalletId);
        const toW = mockDb.wallets.find((w) => w.id === newTr.toWalletId);
        return {
          ...newTr,
          fromWallet: { name: fromW?.name || "Dompet Asal" },
          toWallet: { name: toW?.name || "Dompet Tujuan" },
        };
      },
    },

    categoryKeyword: {
      async findMany({
        where,
        take,
      }: {
        where: { userId: string; keyword: { in: string[] } };
        take?: number;
      }) {
        const matches = mockDb.keywords.filter(
          (k) => k.userId === where.userId && where.keyword.in.includes(k.keyword)
        );
        matches.sort((a, b) => b.frequency - a.frequency);
        const limited = take ? matches.slice(0, take) : matches;
        return limited.map((k) => {
          const cat = mockDb.categories.find((c) => c.id === k.categoryId);
          return {
            ...k,
            category: cat || { id: k.categoryId, name: "Kategori" },
          };
        });
      },
      async upsert({
        where,
        create,
      }: {
        where: { userId_keyword_categoryId: { userId: string; keyword: string; categoryId: string } };
        update: { frequency: { increment: number } };
        create: { userId: string; keyword: string; categoryId: string; frequency: number };
      }) {
        const existing = mockDb.keywords.find(
          (k) =>
            k.userId === where.userId_keyword_categoryId.userId &&
            k.keyword === where.userId_keyword_categoryId.keyword &&
            k.categoryId === where.userId_keyword_categoryId.categoryId
        );
        if (existing) {
          existing.frequency += 1;
          existing.updatedAt = new Date();
          return existing;
        } else {
          const newK = {
            id: `kw-${Date.now()}-${Math.random()}`,
            userId: create.userId,
            keyword: create.keyword,
            categoryId: create.categoryId,
            frequency: create.frequency,
            updatedAt: new Date(),
          };
          mockDb.keywords.push(newK);
          return newK;
        }
      },
    },

    async $transaction<T>(callback: (tx: any) => Promise<T>): Promise<T> {
      return callback(createMockPrisma());
    },
  };
};

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  (hasValidDbUrl
    ? new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
      })
    : (createMockPrisma() as unknown as PrismaClient));

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
