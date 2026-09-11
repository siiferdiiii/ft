"use client";

import React, { useState, useEffect, useCallback } from "react";
import { WalletCard } from "@/components/features/WalletCard";
import { VoiceMicButton } from "@/components/features/VoiceMicButton";
import {
  TransactionConfirmModal,
  PreFillTransactionData,
} from "@/components/features/TransactionConfirmModal";
import { ReceiptScannerModal } from "@/components/features/ReceiptScannerModal";
import { BottomNav } from "@/components/ui/BottomNav";
import { CameraIcon, PlusIcon } from "@/components/ui/Icons";
import { WalletDto, CategoryDto, TransactionDto, TransactionType, InputSource } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { ParsedVoiceResult } from "@/lib/parseVoiceAmount";

export default function DashboardPage() {
  const [wallets, setWallets] = useState<WalletDto[]>([]);
  const [activeWalletId, setActiveWalletId] = useState<string>("");
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [recentTransactions, setRecentTransactions] = useState<TransactionDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [preFillData, setPreFillData] = useState<PreFillTransactionData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [walletsRes, categoriesRes, txRes] = await Promise.all([
        fetch("/api/wallets"),
        fetch("/api/categories"),
        fetch("/api/transactions?limit=10"),
      ]);

      const [walletsJson, categoriesJson, txJson] = await Promise.all([
        walletsRes.json(),
        categoriesRes.json(),
        txRes.json(),
      ]);

      if (walletsJson.data) {
        setWallets(walletsJson.data);
        if (!activeWalletId && walletsJson.data.length > 0) {
          setActiveWalletId(walletsJson.data[0].id);
        }
      }

      if (categoriesJson.data) {
        setCategories(categoriesJson.data);
      }

      if (txJson.data) {
        setRecentTransactions(txJson.data);
      }
    } catch (err) {
      console.error("Gagal memuat data dashboard:", err);
    } finally {
      setIsLoading(false);
    }
  }, [activeWalletId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Total kumulasi saldo seluruh dompet
  const totalBalance = wallets.reduce((sum, w) => sum + w.balance, 0);

  // Handle hasil parse suara
  const handleVoiceResult = (
    result: ParsedVoiceResult,
    suggestedCategoryId?: string | null
  ) => {
    setPreFillData({
      type: result.type,
      walletId: activeWalletId || (wallets[0]?.id ?? ""),
      categoryId: suggestedCategoryId || null,
      amount: result.amount,
      note: result.note,
      source: "VOICE",
      rawInput: result.rawInput,
    });
    setIsConfirmModalOpen(true);
  };

  // Handle buka form manual (+Catat)
  const handleOpenManual = () => {
    setPreFillData({
      type: "EXPENSE",
      walletId: activeWalletId || (wallets[0]?.id ?? ""),
      categoryId: null,
      amount: null,
      note: "",
      source: "MANUAL",
    });
    setIsConfirmModalOpen(true);
  };

  // Handle hasil scan resi
  const handleReceiptResult = (data: PreFillTransactionData) => {
    setPreFillData(data);
    setIsConfirmModalOpen(true);
  };

  // Handle simpan transaksi secara OPTIMISTIK (Instan 0ms, Tanpa Delay)
  const handleSaveTransaction = async (txData: {
    walletId: string;
    categoryId: string | null;
    type: TransactionType;
    amount: number;
    note: string | null;
    source: InputSource;
    rawInput: string | null;
    receiptImageUrl: string | null;
    transactionDate: string;
  }) => {
    // 1. Snapshot state sebelumnya untuk rollback jika server gagal
    const prevWallets = [...wallets];
    const prevTransactions = [...recentTransactions];

    const targetWallet = wallets.find((w) => w.id === txData.walletId) || wallets[0];
    const targetCategory = categories.find((c) => c.id === txData.categoryId);

    // 2. Pembaruan Saldo Instan di Layar (0ms!)
    const balanceDiff = txData.type === "INCOME" ? txData.amount : -txData.amount;
    setWallets((prev) =>
      prev.map((w) =>
        w.id === txData.walletId ? { ...w, balance: w.balance + balanceDiff } : w
      )
    );

    // 3. Tambahkan Transaksi Baru ke Daftar Paling Atas Secara Instan (0ms!)
    const tempId = "optimistic-" + Date.now();
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
    setRecentTransactions((prev) => [optimisticTx, ...prev]);

    // 4. Catat ke Database di Latar Belakang (Background Sync)
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txData),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error?.message || "Gagal mencatat transaksi");
      }

      // Perbarui ID sementara dengan ID resmi dari database
      if (json.data?.id) {
        setRecentTransactions((prev) =>
          prev.map((t) => (t.id === tempId ? { ...t, id: json.data.id } : t))
        );
      }
    } catch (err) {
      console.error("Gagal sinkronisasi transaksi:", err);
      // Rollback ke state sebelumnya jika terjadi error jaringan
      setWallets(prevWallets);
      setRecentTransactions(prevTransactions);
      handleNotification("Gagal menyimpan transaksi ke database. Saldo dikembalikan.");
    }
  };

  const handleNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24">
      {/* Header Aplikasi */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Finance Tracker
          </span>
          <h1 className="text-[18px] font-bold text-text">Dashboard</h1>
        </div>
      </div>

      {/* Banner Notifikasi / Error jika ada */}
      {notification && (
        <div className="mb-4 p-3 bg-chip text-primary text-[12px] font-medium rounded-control border border-border flex items-center justify-between animate-in fade-in">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 font-bold hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Hero Card Total Saldo Kumulatif */}
      <div className="bg-surface p-5 rounded-card-lg border border-border mb-6">
        <span className="text-[12px] font-medium text-text-secondary block mb-1">
          Total Kumulasi Saldo
        </span>
        <div className="text-[32px] font-bold text-text tracking-tight">
          {isLoading ? "Memuat..." : formatCurrency(totalBalance)}
        </div>
        <div className="mt-2 text-[11px] text-text-secondary">
          Tercakup dari {wallets.length} dompet aktif
        </div>
      </div>

      {/* Section Dompet Saya */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-text">Dompet Saya</h2>
          <span className="text-[11px] text-text-secondary">
            Ketuk untuk jadikan aktif
          </span>
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-5 px-5 no-scrollbar">
          {wallets.map((wallet) => (
            <WalletCard
              key={wallet.id}
              wallet={wallet}
              isActive={wallet.id === activeWalletId}
              onSelect={(w) => setActiveWalletId(w.id)}
            />
          ))}
          {wallets.length === 0 && !isLoading && (
            <div className="p-4 bg-surface rounded-card-wallet border border-border text-[13px] text-text-secondary w-full text-center">
              Belum ada dompet aktif. Tambahkan di tab Dompet.
            </div>
          )}
        </div>
      </div>

      {/* Hero Tombol Mic di Tengah Layar */}
      <VoiceMicButton
        onParsedResult={handleVoiceResult}
        onError={handleNotification}
      />

      {/* Tombol Aksi Cepat (+Catat & Scan Resi) */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleOpenManual}
          className="flex items-center gap-2 px-5 py-2.5 bg-field text-text rounded-control text-[14px] font-semibold hover:bg-border/70 active:scale-95 transition-all"
        >
          <PlusIcon className="w-4 h-4 text-primary" />
          <span>+ Catat</span>
        </button>

        <button
          type="button"
          onClick={() => setIsReceiptModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-field text-text rounded-control text-[14px] font-semibold hover:bg-border/70 active:scale-95 transition-all"
          aria-label="Scan Resi Pembelian"
          title="Scan Resi"
        >
          <CameraIcon className="w-4 h-4 text-primary" />
          <span>Scan Resi</span>
        </button>
      </div>

      {/* Riwayat Transaksi Terbaru */}
      <div className="flex-1">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[14px] font-semibold text-text">
            Transaksi Terbaru
          </h2>
          <span className="text-[11px] text-text-secondary">10 Terakhir</span>
        </div>

        <div className="bg-surface rounded-card-lg border border-border divide-y divide-border overflow-hidden">
          {recentTransactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between p-3.5 hover:bg-field/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Ikon kategori = dot bulat fill chip per DESIGN_SYSTEM §6 */}
                <div className="w-8 h-8 rounded-full bg-chip flex items-center justify-center text-primary font-bold text-xs">
                  {tx.categoryName ? tx.categoryName.charAt(0) : "•"}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-text truncate max-w-[170px]">
                    {tx.note || tx.categoryName || "Transaksi"}
                  </div>
                  <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
                    <span>{tx.walletName || "Dompet"}</span>
                    <span>•</span>
                    <span>{new Date(tx.transactionDate).toLocaleDateString("id-ID")}</span>
                  </div>
                </div>
              </div>

              {/* Nominal di kanan warna income/expense */}
              <div
                className={`text-[14px] font-bold ${
                  tx.type === "INCOME" ? "text-income" : "text-expense"
                }`}
              >
                {tx.type === "INCOME" ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </div>
            </div>
          ))}

          {recentTransactions.length === 0 && !isLoading && (
            <div className="py-8 text-center text-[13px] text-text-secondary">
              Belum ada transaksi. Tekan mic atau tombol +Catat untuk memulai.
            </div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Transaksi (Voice & Manual) */}
      <TransactionConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onSave={handleSaveTransaction}
        onSuccess={loadData}
        wallets={wallets}
        categories={categories}
        initialData={preFillData}
      />

      {/* Modal Scan Resi */}
      <ReceiptScannerModal
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
        onParsedResult={handleReceiptResult}
        activeWalletId={activeWalletId || (wallets[0]?.id ?? "")}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
