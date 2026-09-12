"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { WalletCard } from "@/components/features/WalletCard";
import { VoiceMicButton } from "@/components/features/VoiceMicButton";
import {
  TransactionConfirmModal,
  PreFillTransactionData,
} from "@/components/features/TransactionConfirmModal";
import { ReceiptScannerModal } from "@/components/features/ReceiptScannerModal";
import { DanaAbadiSuggestBanner, IncomeAllocationSuggestion } from "@/components/features/DanaAbadiSuggestBanner";
import { SimulatorACompoundModal } from "@/components/features/SimulatorACompoundModal";
import { BottomNav } from "@/components/ui/BottomNav";
import { CameraIcon, PlusIcon } from "@/components/ui/Icons";
import { TransactionType, InputSource } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { AnimatedBalance } from "@/components/ui/AnimatedBalance";
import { ParsedVoiceResult } from "@/lib/parseVoiceAmount";
import { useAppData } from "@/lib/context/AppDataContext";

export default function DashboardPage() {
  const router = useRouter();
  const {
    wallets,
    categories,
    recentTransactions,
    activeWalletId,
    setActiveWalletId,
    isInitialLoading: isLoading,
    addTransactionOptimistic,
    transferOptimistic,
    refreshData,
  } = useAppData();

  // Modals state
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isSimAOpen, setIsSimAOpen] = useState(false);
  const [preFillData, setPreFillData] = useState<PreFillTransactionData | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [userPercent, setUserPercent] = useState<number>(10);
  const [incomeSuggestion, setIncomeSuggestion] = useState<IncomeAllocationSuggestion | null>(null);

  // Cari dompet Dana Abadi
  const danaAbadiWallet = wallets.find((w) => Boolean(w.isPerpetualFund));

  // Ambil pengaturan persentase alokasi & cache saran income aktif
  useEffect(() => {
    const loadSettingsAndCache = async () => {
      try {
        const res = await fetch("/api/user/settings");
        const json = await res.json();
        if (json.data?.perpetualFundPercent) {
          setUserPercent(json.data.perpetualFundPercent);
        }
      } catch {
        // Fallback default 10%
      }

      if (typeof window !== "undefined") {
        try {
          const cached = localStorage.getItem("ft_pending_income_suggestion");
          if (cached) {
            setIncomeSuggestion(JSON.parse(cached));
          }
        } catch {
          // Abaikan
        }
      }
    };

    loadSettingsAndCache();
  }, []);

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
    const result = await addTransactionOptimistic(txData);
    if (!result.success && result.error) {
      handleNotification(result.error);
      return;
    }

    // Setiap transaksi tipe INCOME tersimpan -> hitung amount * (User.perpetualFundPercent / 100)
    // dan tampilkan banner non-blocking per PRD §3.2
    if (txData.type === "INCOME") {
      const percent = userPercent || 10;
      const allocAmount = Math.round(txData.amount * (percent / 100));
      const sourceW = wallets.find((w) => w.id === txData.walletId);
      const suggestion: IncomeAllocationSuggestion = {
        incomeAmount: txData.amount,
        allocationAmount: allocAmount,
        sourceWalletId: txData.walletId,
        sourceWalletName: sourceW?.name || "Dompet Asal",
        percent,
      };

      setIncomeSuggestion(suggestion);
      if (typeof window !== "undefined") {
        localStorage.setItem("ft_pending_income_suggestion", JSON.stringify(suggestion));
      }
    }
  };

  const handleAllocate = async (amount: number, fromWalletId: string, toWalletId: string) => {
    transferOptimistic(fromWalletId, toWalletId, amount);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWalletId,
          toWalletId,
          amount,
          note: "Alokasi Otomatis Dana Abadi",
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        handleNotification(json.error?.message || "Gagal mengalokasikan ke Dana Abadi");
      } else {
        handleNotification(`Berhasil mengalokasikan ${formatCurrency(amount)} ke Dana Abadi!`);
      }
    } catch {
      handleNotification("Terjadi kendala jaringan saat mentransfer alokasi");
    } finally {
      setIncomeSuggestion(null);
      if (typeof window !== "undefined") {
        localStorage.removeItem("ft_pending_income_suggestion");
        localStorage.setItem("ft_dana_abadi_consecutive_skips", "0");
      }
      refreshData(true);
    }
  };

  const handleSkipAllocation = () => {
    setIncomeSuggestion(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("ft_pending_income_suggestion");
      const currentSkips = parseInt(
        localStorage.getItem("ft_dana_abadi_consecutive_skips") || "0",
        10
      );
      const nextSkips = currentSkips + 1;
      localStorage.setItem("ft_dana_abadi_consecutive_skips", nextSkips.toString());

      // Kalau user tap "Lewati" 3 kali berturut-turut (hitung dari transaksi income terakhir),
      // tampilkan Simulator A sebagai popup non-blocking sekali per PRD §3.2
      if (nextSkips >= 3) {
        const alreadyShown = localStorage.getItem("ft_sim_a_skip_popup_shown") === "true";
        if (!alreadyShown) {
          setIsSimAOpen(true);
          localStorage.setItem("ft_sim_a_skip_popup_shown", "true");
        }
      }
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

      {/* Banner Non-Blocking Auto-Suggest Alokasi Dana Abadi 10% per PRD §3.2 */}
      {incomeSuggestion && (
        <DanaAbadiSuggestBanner
          suggestion={incomeSuggestion}
          danaAbadiWallet={danaAbadiWallet}
          onAllocate={handleAllocate}
          onCreateDanaAbadiWallet={() => router.push("/dashboard/dompet")}
          onSkip={handleSkipAllocation}
        />
      )}

      {/* Hero Card Total Saldo Kumulatif */}
      <div className="bg-surface p-5 rounded-card-lg border border-border mb-6">
        <span className="text-[12px] font-medium text-text-secondary block mb-1">
          Total Kumulasi Saldo
        </span>
        <div className="text-[32px] font-bold text-text tracking-tight">
          {isLoading ? "Memuat..." : (
            <AnimatedBalance value={totalBalance} duration={700} />
          )}
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
          <span>Catat</span>
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
          <span className="text-[11px] text-text-secondary">5 Terakhir</span>
        </div>

        <div className="bg-surface rounded-card-lg border border-border divide-y divide-border overflow-hidden">
          {recentTransactions.slice(0, 5).map((tx) => (
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
                className={`text-[14px] font-bold ${tx.type === "INCOME" ? "text-income" : "text-expense"
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

        {/* Tombol Lihat Semua Riwayat */}
        {recentTransactions.length > 0 && (
          <Link
            href="/dashboard/riwayat"
            className="flex items-center justify-center gap-2 mt-3 py-3 bg-surface rounded-card border border-border text-[13px] font-semibold text-primary hover:bg-field/50 active:scale-[0.98] transition-all"
          >
            <span>Lihat Semua Riwayat</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </Link>
        )}
      </div>

      {/* Modal Konfirmasi Transaksi (Voice & Manual) */}
      <TransactionConfirmModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onSave={handleSaveTransaction}
        onSuccess={() => refreshData(true)}
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

      {/* Modal Simulator A saat lewati 3x per PRD §3.2 & §3.3 */}
      <SimulatorACompoundModal
        isOpen={isSimAOpen}
        onClose={() => setIsSimAOpen(false)}
        initialMonthlyAmount={incomeSuggestion?.allocationAmount || 300000}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
