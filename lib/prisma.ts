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
      async findFirst({ where }: { where?: { id?: string; email?: string } }) {
        if (!where) return mockDb.users[0] || null;
        return (
          mockDb.users.find(
            (u) =>
              (where.id && u.id === where.id) ||
              (where.email && u.email === where.email)
          ) || null
        );
      },
      async create({ data }: { data: { id: string; email: string; name?: string | null; perpetualFundPercent?: number } }) {
        const u = {
          id: data.id,
          email: data.email,
          name: data.name || null,
          perpetualFundPercent: data.perpetualFundPercent ?? 10,
          createdAt: new Date(),
        };
        mockDb.users.push(u);
        return u;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          perpetualFundPercent?: number;
        };
      }) {
        const user = mockDb.users.find((u) => u.id === where.id);
        if (!user) throw new Error("User not found");
        if (data.name !== undefined) user.name = data.name;
        if (data.perpetualFundPercent !== undefined) user.perpetualFundPercent = data.perpetualFundPercent;
        return user;
      },
    },

    wallet: {
      async findMany({
        where,
        orderBy,
      }: {
        where: { userId: string; isArchived?: boolean; isPerpetualFund?: boolean; goal?: null | object };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) {
        let list = mockDb.wallets.filter((w) => {
          if (w.userId !== where.userId) return false;
          if (where.isArchived !== undefined && w.isArchived !== where.isArchived) return false;
          if (where.isPerpetualFund !== undefined && w.isPerpetualFund !== where.isPerpetualFund) return false;
          if (where.goal === null) {
            const isLinkedToActiveGoal = mockDb.goals.some((g) => g.walletId === w.id && !g.isArchived);
            if (isLinkedToActiveGoal || w.isGoalDedicated) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (orderBy?.createdAt === "asc") {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return list;
      },
      async findFirst({
        where,
        orderBy,
      }: {
        where: { id?: string; userId?: string; isArchived?: boolean; isPerpetualFund?: boolean; goal?: null | object };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) {
        let list = mockDb.wallets.filter((w) => {
          if (where.id && w.id !== where.id) return false;
          if (where.userId && w.userId !== where.userId) return false;
          if (where.isArchived !== undefined && w.isArchived !== where.isArchived) return false;
          if (where.isPerpetualFund !== undefined && w.isPerpetualFund !== where.isPerpetualFund) return false;
          if (where.goal === null) {
            const isLinkedToActiveGoal = mockDb.goals.some((g) => g.walletId === w.id && !g.isArchived);
            if (isLinkedToActiveGoal || w.isGoalDedicated) return false;
          }
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          list.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        } else if (orderBy?.createdAt === "asc") {
          list.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
        }
        return list[0] || null;
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
          isPerpetualFund?: boolean;
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
          isPerpetualFund: Boolean(data.isPerpetualFund),
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
          isPerpetualFund?: boolean;
          balance?: { increment?: number; decrement?: number } | number;
        };
      }) {
        const wallet = mockDb.wallets.find((w) => w.id === where.id);
        if (!wallet) throw new Error("Wallet not found");

        if (data.name !== undefined) wallet.name = data.name;
        if (data.type !== undefined) wallet.type = data.type;
        if (data.isArchived !== undefined) wallet.isArchived = data.isArchived;
        if (data.isPerpetualFund !== undefined) wallet.isPerpetualFund = data.isPerpetualFund;
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

    goal: {
      async findMany({
        where,
        include,
      }: {
        where?: { userId?: string; isArchived?: boolean };
        include?: { wallet?: boolean };
      }) {
        let results = mockDb.goals.filter((g) => {
          if (where?.userId && g.userId !== where.userId) return false;
          if (where?.isArchived !== undefined && g.isArchived !== where.isArchived) return false;
          return true;
        });
        if (include?.wallet) {
          return results.map((g) => ({
            ...g,
            wallet: mockDb.wallets.find((w) => w.id === g.walletId) || null,
          }));
        }
        return results;
      },
      async findUnique({
        where,
        include,
      }: {
        where: { id?: string; walletId?: string };
        include?: { wallet?: boolean };
      }) {
        const g = mockDb.goals.find(
          (item) =>
            (where.id && item.id === where.id) ||
            (where.walletId && item.walletId === where.walletId)
        );
        if (!g) return null;
        if (include?.wallet) {
          return {
            ...g,
            wallet: mockDb.wallets.find((w) => w.id === g.walletId) || null,
          };
        }
        return g;
      },
      async findFirst({
        where,
        include,
      }: {
        where?: { id?: string; userId?: string; walletId?: string; isArchived?: boolean };
        include?: { wallet?: boolean };
      }) {
        const g = mockDb.goals.find((item) => {
          if (where?.id && item.id !== where.id) return false;
          if (where?.userId && item.userId !== where.userId) return false;
          if (where?.walletId && item.walletId !== where.walletId) return false;
          if (where?.isArchived !== undefined && item.isArchived !== where.isArchived) return false;
          return true;
        });
        if (!g) return null;
        if (include?.wallet) {
          return {
            ...g,
            wallet: mockDb.wallets.find((w) => w.id === g.walletId) || null,
          };
        }
        return g;
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          targetAmount: number | { toNumber?: () => number };
          targetDate?: Date | string | null;
          allocationPercent?: number;
          walletId: string;
        };
      }) {
        const newGoal = {
          id: `goal-${Date.now()}`,
          userId: data.userId,
          name: data.name,
          targetAmount: typeof data.targetAmount === "number" ? data.targetAmount : Number(data.targetAmount),
          targetDate: data.targetDate ? new Date(data.targetDate) : null,
          allocationPercent: data.allocationPercent ?? 5,
          walletId: data.walletId,
          isCompleted: false,
          isArchived: false,
          createdAt: new Date(),
        };
        mockDb.goals.push(newGoal);
        return newGoal;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          targetAmount?: number | { toNumber?: () => number };
          targetDate?: Date | string | null;
          allocationPercent?: number;
          isCompleted?: boolean;
          isArchived?: boolean;
        };
      }) {
        const g = mockDb.goals.find((item) => item.id === where.id);
        if (!g) throw new Error("Goal not found");
        if (data.name !== undefined) g.name = data.name;
        if (data.targetAmount !== undefined) {
          g.targetAmount = typeof data.targetAmount === "number" ? data.targetAmount : Number(data.targetAmount);
        }
        if (data.targetDate !== undefined) {
          g.targetDate = data.targetDate ? new Date(data.targetDate) : null;
        }
        if (data.allocationPercent !== undefined) g.allocationPercent = data.allocationPercent;
        if (data.isCompleted !== undefined) g.isCompleted = data.isCompleted;
        if (data.isArchived !== undefined) g.isArchived = data.isArchived;
        return g;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.goals.findIndex((item) => item.id === where.id);
        if (idx !== -1) {
          const removed = mockDb.goals.splice(idx, 1)[0];
          return removed;
        }
        throw new Error("Goal not found");
      },
    },

    asset: {
      async findMany({
        where,
        orderBy,
      }: {
        where?: { userId?: string; isArchived?: boolean };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) {
        let results = mockDb.assets.filter((a) => {
          if (where?.userId && a.userId !== where.userId) return false;
          if (where?.isArchived !== undefined && a.isArchived !== where.isArchived) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return results;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return mockDb.assets.find((a) => a.id === where.id) || null;
      },
      async findFirst({
        where,
      }: {
        where?: { id?: string; userId?: string; isArchived?: boolean };
      }) {
        return (
          mockDb.assets.find((a) => {
            if (where?.id && a.id !== where.id) return false;
            if (where?.userId && a.userId !== where.userId) return false;
            if (where?.isArchived !== undefined && a.isArchived !== where.isArchived) return false;
            return true;
          }) || null
        );
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          category: string;
          value: number | { toNumber?: () => number };
          liquidityTier: "INSTANT" | "T3" | "ILLIQUID";
        };
      }) {
        const newAsset = {
          id: `asset-${Date.now()}`,
          userId: data.userId,
          name: data.name,
          category: data.category,
          value: typeof data.value === "number" ? data.value : Number(data.value),
          liquidityTier: data.liquidityTier,
          lastValuationAt: new Date(),
          isArchived: false,
          createdAt: new Date(),
        };
        mockDb.assets.push(newAsset);
        return newAsset;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          category?: string;
          value?: number | { toNumber?: () => number };
          liquidityTier?: "INSTANT" | "T3" | "ILLIQUID";
          lastValuationAt?: Date;
          isArchived?: boolean;
        };
      }) {
        const a = mockDb.assets.find((item) => item.id === where.id);
        if (!a) throw new Error("Asset not found");
        if (data.name !== undefined) a.name = data.name;
        if (data.category !== undefined) a.category = data.category;
        if (data.value !== undefined) {
          a.value = typeof data.value === "number" ? data.value : Number(data.value);
          a.lastValuationAt = data.lastValuationAt || new Date();
        }
        if (data.liquidityTier !== undefined) a.liquidityTier = data.liquidityTier;
        if (data.isArchived !== undefined) a.isArchived = data.isArchived;
        return a;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.assets.findIndex((item) => item.id === where.id);
        if (idx !== -1) {
          return mockDb.assets.splice(idx, 1)[0];
        }
        throw new Error("Asset not found");
      },
    },

    debt: {
      async findMany({
        where,
        orderBy,
      }: {
        where?: { userId?: string; isPaidOff?: boolean };
        orderBy?: { createdAt?: "asc" | "desc" };
      }) {
        let results = mockDb.debts.filter((d) => {
          if (where?.userId && d.userId !== where.userId) return false;
          if (where?.isPaidOff !== undefined && d.isPaidOff !== where.isPaidOff) return false;
          return true;
        });
        if (orderBy?.createdAt === "desc") {
          results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        }
        return results;
      },
      async findUnique({ where }: { where: { id: string } }) {
        return mockDb.debts.find((d) => d.id === where.id) || null;
      },
      async findFirst({
        where,
      }: {
        where?: { id?: string; userId?: string; isPaidOff?: boolean };
      }) {
        return (
          mockDb.debts.find((d) => {
            if (where?.id && d.id !== where.id) return false;
            if (where?.userId && d.userId !== where.userId) return false;
            if (where?.isPaidOff !== undefined && d.isPaidOff !== where.isPaidOff) return false;
            return true;
          }) || null
        );
      },
      async create({
        data,
      }: {
        data: {
          userId: string;
          name: string;
          principal: number | { toNumber?: () => number };
          remainingBalance: number | { toNumber?: () => number };
          monthlyPayment?: number | null;
          dueDayOfMonth?: number | null;
          interestRate?: number | null;
        };
      }) {
        const newDebt = {
          id: `debt-${Date.now()}`,
          userId: data.userId,
          name: data.name,
          principal: typeof data.principal === "number" ? data.principal : Number(data.principal),
          remainingBalance: typeof data.remainingBalance === "number" ? data.remainingBalance : Number(data.remainingBalance),
          monthlyPayment: data.monthlyPayment ?? null,
          dueDayOfMonth: data.dueDayOfMonth ?? null,
          interestRate: data.interestRate ?? null,
          isPaidOff: false,
          createdAt: new Date(),
        };
        mockDb.debts.push(newDebt);
        return newDebt;
      },
      async update({
        where,
        data,
      }: {
        where: { id: string };
        data: {
          name?: string;
          principal?: number | { toNumber?: () => number };
          remainingBalance?: number | { toNumber?: () => number };
          monthlyPayment?: number | null;
          dueDayOfMonth?: number | null;
          interestRate?: number | null;
          isPaidOff?: boolean;
        };
      }) {
        const d = mockDb.debts.find((item) => item.id === where.id);
        if (!d) throw new Error("Debt not found");
        if (data.name !== undefined) d.name = data.name;
        if (data.principal !== undefined) {
          d.principal = typeof data.principal === "number" ? data.principal : Number(data.principal);
        }
        if (data.remainingBalance !== undefined) {
          d.remainingBalance = typeof data.remainingBalance === "number" ? data.remainingBalance : Number(data.remainingBalance);
        }
        if (data.monthlyPayment !== undefined) d.monthlyPayment = data.monthlyPayment;
        if (data.dueDayOfMonth !== undefined) d.dueDayOfMonth = data.dueDayOfMonth;
        if (data.interestRate !== undefined) d.interestRate = data.interestRate;
        if (data.isPaidOff !== undefined) d.isPaidOff = data.isPaidOff;
        return d;
      },
      async delete({ where }: { where: { id: string } }) {
        const idx = mockDb.debts.findIndex((item) => item.id === where.id);
        if (idx !== -1) {
          return mockDb.debts.splice(idx, 1)[0];
        }
        throw new Error("Debt not found");
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
