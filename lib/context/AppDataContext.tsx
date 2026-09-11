"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { WalletDto, CategoryDto, TransactionDto, TransactionType, InputSource } from "@/lib/types";

interface AppDataContextType {
  wallets: WalletDto[];
  categories: CategoryDto[];
  recentTransactions: TransactionDto[];
  activeWalletId: string;
  setActiveWalletId: (id: string) => void;
  isInitialLoading: boolean;
  isRefreshing: boolean;
  refreshData: (background?: boolean) => Promise<void>;
  addTransactionOptimistic: (txData: {
    walletId: string;
    categoryId: string | null;
    type: TransactionType;
    amount: number;
    note: string | null;
    source: InputSource;
    rawInput: string | null;
    receiptImageUrl: string | null;
    transactionDate: string;
  }) => Promise<{ success: boolean; error?: string }>;
  transferOptimistic: (
    fromWalletId: string,
    toWalletId: string,
    amount: number
  ) => void;
  mutateWallets: (updater: WalletDto[] | ((prev: WalletDto[]) => WalletDto[])) => void;
  mutateCategories: (updater: CategoryDto[] | ((prev: CategoryDto[]) => CategoryDto[])) => void;
}

const AppDataContext = createContext<AppDataContextType | undefined>(undefined);

const STORAGE_KEYS = {
  WALLETS: "ft_cache_wallets",
  CATEGORIES: "ft_cache_categories",
  TRANSACTIONS: "ft_cache_transactions",
  ACTIVE_WALLET: "ft_cache_active_wallet",
};

export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [wallets, setWallets] = useState<WalletDto[]>([]);
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionDto[]>([]);
  const [activeWalletId, setActiveWalletIdState] = useState<string>("");
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const channelRef = useRef<BroadcastChannel | null>(null);

  // Helper simpan ke localStorage
  const saveToStorage = (key: string, data: unknown) => {
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch {
      // Abaikan jika storage penuh atau restricted
    }
  };

  // 1. Instant Hydration dari LocalStorage saat app pertama kali render (0ms Delay!)
  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        const cachedWallets = localStorage.getItem(STORAGE_KEYS.WALLETS);
        const cachedCats = localStorage.getItem(STORAGE_KEYS.CATEGORIES);
        const cachedTxs = localStorage.getItem(STORAGE_KEYS.TRANSACTIONS);
        const cachedActiveWallet = localStorage.getItem(STORAGE_KEYS.ACTIVE_WALLET);

        let hasCachedData = false;

        if (cachedWallets) {
          const parsed = JSON.parse(cachedWallets);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setWallets(parsed);
            hasCachedData = true;
          }
        }

        if (cachedCats) {
          const parsed = JSON.parse(cachedCats);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCategories(parsed);
            hasCachedData = true;
          }
        }

        if (cachedTxs) {
          const parsed = JSON.parse(cachedTxs);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setRecentTransactions(parsed);
            hasCachedData = true;
          }
        }

        if (cachedActiveWallet) {
          setActiveWalletIdState(cachedActiveWallet);
        }

        // Jika sudah ada cache, UI langsung bisa dipakai (0ms delay)
        if (hasCachedData) {
          setIsInitialLoading(false);
        }
      } catch (err) {
        console.warn("Gagal membaca cache lokal:", err);
      }
    }
  }, []);

  const setActiveWalletId = useCallback((id: string) => {
    setActiveWalletIdState(id);
    saveToStorage(STORAGE_KEYS.ACTIVE_WALLET, id);
  }, []);

  // 2. Refresh Data di Latar Belakang (Stale-While-Revalidate)
  const refreshData = useCallback(async (background = false) => {
    if (!background) {
      setIsRefreshing(true);
    }

    try {
      const [walletsRes, categoriesRes, txRes] = await Promise.all([
        fetch("/api/wallets"),
        fetch("/api/categories"),
        fetch("/api/transactions?limit=15"),
      ]);

      const [walletsJson, categoriesJson, txJson] = await Promise.all([
        walletsRes.json(),
        categoriesRes.json(),
        txRes.json(),
      ]);

      if (walletsJson.data && Array.isArray(walletsJson.data)) {
        setWallets(walletsJson.data);
        saveToStorage(STORAGE_KEYS.WALLETS, walletsJson.data);

        // Pastikan active wallet valid
        setActiveWalletIdState((prev) => {
          if (prev && walletsJson.data.some((w: WalletDto) => w.id === prev)) {
            return prev;
          }
          const defaultId = walletsJson.data[0]?.id || "";
          saveToStorage(STORAGE_KEYS.ACTIVE_WALLET, defaultId);
          return defaultId;
        });
      }

      if (categoriesJson.data && Array.isArray(categoriesJson.data)) {
        setCategories(categoriesJson.data);
        saveToStorage(STORAGE_KEYS.CATEGORIES, categoriesJson.data);
      }

      if (txJson.data && Array.isArray(txJson.data)) {
        setRecentTransactions(txJson.data);
        saveToStorage(STORAGE_KEYS.TRANSACTIONS, txJson.data);
      }
    } catch (err) {
      console.warn("Background sync offline / fallback:", err);
    } finally {
      setIsInitialLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // 3. Setup BroadcastChannel untuk Realtime Sync antar tab / jendela browser
  useEffect(() => {
    if (typeof window !== "undefined" && "BroadcastChannel" in window) {
      const channel = new BroadcastChannel("ft_realtime_sync");
      channelRef.current = channel;

      channel.onmessage = (event) => {
        if (event.data?.type === "DATA_UPDATED") {
          refreshData(true);
        }
      };

      return () => {
        channel.close();
      };
    }
  }, [refreshData]);

  // Panggil refreshData saat mount dan saat window refocus
  useEffect(() => {
    refreshData(true);

    const handleFocus = () => {
      refreshData(true);
    };

    window.addEventListener("focus", handleFocus);
    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [refreshData]);

  const notifySync = () => {
    try {
      channelRef.current?.postMessage({ type: "DATA_UPDATED" });
    } catch {
      // Abaikan jika tidak didukung
    }
  };

  // 4. Optimistic Transaction Submission (0ms Feedback!)
  const addTransactionOptimistic = async (txData: {
    walletId: string;
    categoryId: string | null;
    type: TransactionType;
    amount: number;
    note: string | null;
    source: InputSource;
    rawInput: string | null;
    receiptImageUrl: string | null;
    transactionDate: string;
  }): Promise<{ success: boolean; error?: string }> => {
    // Snapshot state awal untuk rollback jika gagal
    const prevWallets = [...wallets];
    const prevCategories = [...categories];
    const prevTransactions = [...recentTransactions];

    // Dummy ID sementara
    const tempId = `temp_${Date.now()}`;
    const targetWallet = wallets.find((w) => w.id === txData.walletId);
    const targetCategory = categories.find((c) => c.id === txData.categoryId);

    const optimisticTx: TransactionDto = {
      id: tempId,
      walletId: txData.walletId,
      walletName: targetWallet?.name,
      categoryId: txData.categoryId,
      categoryName: targetCategory?.name || null,
      type: txData.type,
      amount: txData.amount,
      note: txData.note,
      source: txData.source,
      rawInput: txData.rawInput,
      receiptImageUrl: txData.receiptImageUrl,
      transactionDate: txData.transactionDate,
      createdAt: new Date().toISOString(),
    };

    // 1. Terapkan pembaruan langsung di memori & localStorage (0ms!)
    const nextTransactions = [optimisticTx, ...prevTransactions];
    const nextWallets = prevWallets.map((w) => {
      if (w.id === txData.walletId) {
        const balanceDelta = txData.type === "INCOME" ? txData.amount : -txData.amount;
        return { ...w, balance: w.balance + balanceDelta };
      }
      return w;
    });

    const nextCategories = prevCategories.map((c) => {
      if (c.id === txData.categoryId && txData.type === "EXPENSE") {
        return { ...c, currentExpense: (c.currentExpense || 0) + txData.amount };
      }
      return c;
    });

    setRecentTransactions(nextTransactions);
    setWallets(nextWallets);
    setCategories(nextCategories);

    saveToStorage(STORAGE_KEYS.TRANSACTIONS, nextTransactions);
    saveToStorage(STORAGE_KEYS.WALLETS, nextWallets);
    saveToStorage(STORAGE_KEYS.CATEGORIES, nextCategories);

    notifySync();

    // 2. Kirim ke server di background
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txData),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        // Rollback jika server menolak
        setRecentTransactions(prevTransactions);
        setWallets(prevWallets);
        setCategories(prevCategories);
        saveToStorage(STORAGE_KEYS.TRANSACTIONS, prevTransactions);
        saveToStorage(STORAGE_KEYS.WALLETS, prevWallets);
        saveToStorage(STORAGE_KEYS.CATEGORIES, prevCategories);
        return { success: false, error: json.error?.message || "Gagal menyimpan transaksi" };
      }

      // Gantikan ID sementara dengan data riil dari database
      if (json.data) {
        setRecentTransactions((curr) =>
          curr.map((t) => (t.id === tempId ? json.data : t))
        );
      }

      return { success: true };
    } catch {
      // Rollback jika terjadi offline error
      setRecentTransactions(prevTransactions);
      setWallets(prevWallets);
      setCategories(prevCategories);
      saveToStorage(STORAGE_KEYS.TRANSACTIONS, prevTransactions);
      saveToStorage(STORAGE_KEYS.WALLETS, prevWallets);
      saveToStorage(STORAGE_KEYS.CATEGORIES, prevCategories);
      return { success: false, error: "Gangguan koneksi saat sinkronisasi data" };
    }
  };

  // 5. Transfer Optimistic
  const transferOptimistic = (
    fromWalletId: string,
    toWalletId: string,
    amount: number
  ) => {
    setWallets((prev) => {
      const updated = prev.map((w) => {
        if (w.id === fromWalletId) {
          return { ...w, balance: w.balance - amount };
        }
        if (w.id === toWalletId) {
          return { ...w, balance: w.balance + amount };
        }
        return w;
      });
      saveToStorage(STORAGE_KEYS.WALLETS, updated);
      return updated;
    });
    notifySync();
  };

  const mutateWallets = (updater: WalletDto[] | ((prev: WalletDto[]) => WalletDto[])) => {
    setWallets((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(STORAGE_KEYS.WALLETS, next);
      notifySync();
      return next;
    });
  };

  const mutateCategories = (updater: CategoryDto[] | ((prev: CategoryDto[]) => CategoryDto[])) => {
    setCategories((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      saveToStorage(STORAGE_KEYS.CATEGORIES, next);
      notifySync();
      return next;
    });
  };

  return (
    <AppDataContext.Provider
      value={{
        wallets,
        categories,
        recentTransactions,
        activeWalletId,
        setActiveWalletId,
        isInitialLoading,
        isRefreshing,
        refreshData,
        addTransactionOptimistic,
        transferOptimistic,
        mutateWallets,
        mutateCategories,
      }}
    >
      {children}
    </AppDataContext.Provider>
  );
};

export const useAppData = () => {
  const context = useContext(AppDataContext);
  if (!context) {
    throw new Error("useAppData harus digunakan di dalam <AppDataProvider>");
  }
  return context;
};
