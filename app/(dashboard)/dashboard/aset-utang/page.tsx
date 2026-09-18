"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { AssetFormModal } from "@/components/features/AssetFormModal";
import { DebtFormModal } from "@/components/features/DebtFormModal";
import { DebtPaymentModal } from "@/components/features/DebtPaymentModal";
import { DebtDueReminderBanner } from "@/components/features/DebtDueReminderBanner";
import {
  ScaleIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  AlertCircleIcon,
} from "@/components/ui/Icons";
import { AssetDto, DebtDto, NetWorthSummaryDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export default function AsetUtangPage() {
  const [netWorthData, setNetWorthData] = useState<NetWorthSummaryDto | null>(null);
  const [assets, setAssets] = useState<AssetDto[]>([]);
  const [debts, setDebts] = useState<DebtDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"assets" | "debts">("assets");

  // Modals
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetDto | null>(null);

  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [editingDebt, setEditingDebt] = useState<DebtDto | null>(null);

  const [paymentDebt, setPaymentDebt] = useState<DebtDto | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [nwRes, assetsRes, debtsRes] = await Promise.all([
        fetch("/api/net-worth"),
        fetch("/api/assets"),
        fetch("/api/debts"),
      ]);

      const [nwJson, assetsJson, debtsJson] = await Promise.all([
        nwRes.json(),
        assetsRes.json(),
        debtsRes.json(),
      ]);

      if (nwJson.data) setNetWorthData(nwJson.data);
      if (assetsJson.data) setAssets(assetsJson.data);
      if (debtsJson.data) setDebts(debtsJson.data);
    } catch (err) {
      console.error("Gagal memuat data aset & utang:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handler Hapus / Arsip Aset
  const handleArchiveAsset = async (asset: AssetDto) => {
    if (!confirm(`Arsipkan aset "${asset.name}"?`)) return;
    try {
      const res = await fetch(`/api/assets/${asset.id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch {
      alert("Gagal mengarsipkan aset");
    }
  };

  // Handler Hapus Utang
  const handleDeleteDebt = async (debt: DebtDto) => {
    if (!confirm(`Hapus catatan utang "${debt.name}"?`)) return;
    try {
      const res = await fetch(`/api/debts/${debt.id}`, { method: "DELETE" });
      if (res.ok) fetchData();
    } catch {
      alert("Gagal menghapus utang");
    }
  };

  // Helper cek reminder usia valuasi (>90 hari)
  const getValuationAgeNote = (lastValuationAt: string): string | null => {
    const valuationDate = new Date(lastValuationAt);
    const diffDays = Math.floor(
      (Date.now() - valuationDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays >= 90) {
      const months = Math.floor(diffDays / 30);
      return `Terakhir diupdate ${months} bulan lalu`;
    }
    return null;
  };

  const activeDebts = debts.filter((d) => !d.isPaidOff);
  const paidDebts = debts.filter((d) => d.isPaidOff);

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      {/* Header & Back Link */}
      <div>
        <Link
          href="/dashboard/dompet"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text mb-2 transition-colors"
        >
          <span>← Kembali ke Dompet</span>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[12px] font-medium text-text-secondary block">
              Snapshot Kekayaan Bersih
            </span>
            <h1 className="text-[20px] font-bold text-text flex items-center gap-2">
              <ScaleIcon className="w-5 h-5 text-primary" />
              <span>Aset & Utang</span>
            </h1>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeTab === "assets") {
                setEditingAsset(null);
                setIsAssetModalOpen(true);
              } else {
                setEditingDebt(null);
                setIsDebtModalOpen(true);
              }
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-control text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
          >
            <PlusIcon className="w-4 h-4" />
            <span>{activeTab === "assets" ? "Aset Baru" : "Catat Utang"}</span>
          </button>
        </div>
      </div>

      {/* Banner Pasif Reminder Cicilan Jatuh Tempo H-3 (PRD_ASET_UTANG §2.3) */}
      {netWorthData && netWorthData.upcomingDebts.length > 0 && (
        <DebtDueReminderBanner
          debts={netWorthData.upcomingDebts}
          onPayDebt={(debt) => setPaymentDebt(debt)}
        />
      )}

      {/* Summary Cards Kekayaan Bersih & Liquid Cash (PRD_ASET_UTANG §2.1 & §2.4) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Card 1: Kekayaan Bersih */}
        <div className="p-4 bg-surface rounded-card-lg border border-border shadow-xs">
          <span className="text-[11px] font-medium text-text-secondary block mb-1">
            Kekayaan Bersih (Net Worth)
          </span>
          <div className="text-[22px] font-bold text-text tracking-tight mb-2">
            {isLoading
              ? "..."
              : formatCurrency(netWorthData?.netWorth || 0)}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-secondary border-t border-border/70 pt-2">
            <span>Aset: {formatCurrency(netWorthData?.totalAssetsValue || 0)}</span>
            <span className="text-expense">
              Utang: -{formatCurrency(netWorthData?.totalDebtsRemaining || 0)}
            </span>
          </div>
        </div>

        {/* Card 2: Uang yang bisa dicairkan dalam 3 hari (Liquid Cash T+3) */}
        <div className="p-4 bg-primary/5 rounded-card-lg border border-primary/20 shadow-xs">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[11px] font-bold text-primary uppercase tracking-wide">
              Uang yang bisa dicairkan dalam 3 hari
            </span>
          </div>
          <div className="text-[22px] font-bold text-primary tracking-tight mb-2">
            {isLoading
              ? "..."
              : formatCurrency(netWorthData?.liquidCashT3 || 0)}
          </div>
          <p className="text-[10.5px] text-text-secondary leading-snug border-t border-primary/10 pt-2">
            Total saldo dompetmu ditambah aset yang bisa dicairkan instan atau ~3 hari kerja.
          </p>
        </div>
      </div>

      {/* Tab Switcher: Aset vs Utang */}
      <div className="flex gap-2 p-1 bg-field rounded-control">
        <button
          type="button"
          onClick={() => setActiveTab("assets")}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-control transition-all ${
            activeTab === "assets"
              ? "bg-surface text-primary shadow-xs"
              : "text-text-secondary hover:text-text"
          }`}
        >
          Daftar Aset ({assets.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("debts")}
          className={`flex-1 py-1.5 text-[13px] font-semibold rounded-control transition-all ${
            activeTab === "debts"
              ? "bg-surface text-primary shadow-xs"
              : "text-text-secondary hover:text-text"
          }`}
        >
          Daftar Utang ({activeDebts.length})
        </button>
      </div>

      {/* Konten Tab ASET */}
      {activeTab === "assets" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-10 text-center text-[13px] text-text-secondary">
              Memuat daftar aset...
            </div>
          ) : assets.length > 0 ? (
            assets.map((asset) => {
              const valuationWarning = getValuationAgeNote(asset.lastValuationAt);

              const tierLabel =
                asset.liquidityTier === "INSTANT"
                  ? "Bisa dicairkan hari ini"
                  : asset.liquidityTier === "T3"
                  ? "Butuh proses ~3 hari"
                  : "Susah dicairkan cepat";

              const tierBadgeClass =
                asset.liquidityTier === "INSTANT"
                  ? "bg-income/10 text-income"
                  : asset.liquidityTier === "T3"
                  ? "bg-primary/10 text-primary"
                  : "bg-field text-text-secondary";

              return (
                <div
                  key={asset.id}
                  className="p-4 bg-surface rounded-card-wallet border border-border hover:border-primary/40 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <h3 className="text-[14px] font-bold text-text truncate">
                          {asset.name}
                        </h3>
                        <span className="px-2 py-0.2 bg-field text-text-secondary text-[10px] font-medium rounded">
                          {asset.category}
                        </span>
                      </div>

                      <div className="text-[16px] font-bold text-text mb-1.5">
                        {formatCurrency(asset.value)}
                      </div>

                      <div className="flex items-center gap-2 flex-wrap text-[11px]">
                        <span className={`px-2 py-0.5 rounded font-medium ${tierBadgeClass}`}>
                          {tierLabel}
                        </span>

                        {valuationWarning && (
                          <span className="inline-flex items-center gap-1 text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded text-[10px] font-medium">
                            <ClockIcon className="w-3 h-3" />
                            <span>{valuationWarning}</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Tombol aksi */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingAsset(asset);
                          setIsAssetModalOpen(true);
                        }}
                        className="p-1.5 text-text-secondary hover:text-text rounded-control hover:bg-field"
                        title="Edit Nilai / Data Aset"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleArchiveAsset(asset)}
                        className="p-1.5 text-text-secondary hover:text-expense rounded-control hover:bg-field"
                        title="Arsipkan Aset"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-surface rounded-card-lg border border-dashed border-border text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <ScaleIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-text">Belum ada aset tercatat</h4>
                <p className="text-[12px] text-text-secondary mt-1">
                  Catat aset seperti reksadana, emas, kendaraan, atau properti untuk melihat kekayaan bersihmu.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingAsset(null);
                  setIsAssetModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[12px] font-semibold rounded-control hover:opacity-90 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Tambah Aset Pertama</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Konten Tab UTANG */}
      {activeTab === "debts" && (
        <div className="space-y-3">
          {isLoading ? (
            <div className="py-10 text-center text-[13px] text-text-secondary">
              Memuat data kewajiban utang...
            </div>
          ) : activeDebts.length > 0 ? (
            activeDebts.map((debt) => {
              const percentPaid = Math.min(
                100,
                Math.round(
                  ((debt.principal - debt.remainingBalance) / (debt.principal || 1)) * 100
                )
              );

              return (
                <div
                  key={debt.id}
                  className="p-4 bg-surface rounded-card-wallet border border-border hover:border-expense/40 transition-all shadow-xs"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[14px] font-bold text-text truncate">
                        {debt.name}
                      </h3>
                      <div className="flex items-center gap-2 text-[11px] text-text-secondary mt-0.5">
                        {debt.dueDayOfMonth && (
                          <span>Tempo: tiap tgl {debt.dueDayOfMonth}</span>
                        )}
                        {debt.interestRate !== null && debt.interestRate > 0 && (
                          <span>&bull; Bunga: {debt.interestRate}%/thn</span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingDebt(debt);
                          setIsDebtModalOpen(true);
                        }}
                        className="p-1.5 text-text-secondary hover:text-text rounded-control hover:bg-field"
                        title="Edit Data Utang"
                      >
                        <EditIcon className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDebt(debt)}
                        className="p-1.5 text-text-secondary hover:text-expense rounded-control hover:bg-field"
                        title="Hapus Utang"
                      >
                        <TrashIcon className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Sisa Utang & Progress Pelunasan */}
                  <div className="space-y-1.5 my-3">
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="font-bold text-expense">
                        Sisa: {formatCurrency(debt.remainingBalance)}
                      </span>
                      <span className="text-text-secondary font-medium">
                        dari {formatCurrency(debt.principal)} ({percentPaid}% terbayar)
                      </span>
                    </div>

                    <div className="w-full h-2 bg-field rounded-full overflow-hidden">
                      <div
                        className="h-full bg-income rounded-full transition-all duration-500"
                        style={{ width: `${percentPaid}%` }}
                      />
                    </div>
                  </div>

                  {/* Footer & Tombol Bayar Cicilan */}
                  <div className="flex items-center justify-between pt-1">
                    <span className="text-[11px] text-text-secondary">
                      {debt.monthlyPayment
                        ? `Cicilan: ${formatCurrency(debt.monthlyPayment)} / bln`
                        : "Tidak ada jadwal cicilan tetap"}
                    </span>

                    <button
                      type="button"
                      onClick={() => setPaymentDebt(debt)}
                      className="px-3 py-1.5 bg-field text-text hover:bg-border/60 text-[12px] font-semibold rounded-control transition-all"
                    >
                      Bayar / Update
                    </button>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-8 bg-surface rounded-card-lg border border-dashed border-border text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-income/10 text-income flex items-center justify-center mx-auto">
                <CheckCircleIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-text">Bebas dari Utang!</h4>
                <p className="text-[12px] text-text-secondary mt-1">
                  Kamu tidak memiliki utang berjalan yang aktif saat ini.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingDebt(null);
                  setIsDebtModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[12px] font-semibold rounded-control hover:opacity-90 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Catat Kewajiban Baru</span>
              </button>
            </div>
          )}

          {/* Bagian Utang Lunas */}
          {paidDebts.length > 0 && (
            <div className="mt-6 pt-4 border-t border-border">
              <span className="text-[12px] font-semibold text-text-secondary block mb-2">
                Riwayat Utang Lunas ({paidDebts.length})
              </span>
              <div className="space-y-2 opacity-75">
                {paidDebts.map((pd) => (
                  <div
                    key={pd.id}
                    className="p-3 bg-field/50 rounded-card border border-border flex items-center justify-between text-[12px]"
                  >
                    <div>
                      <span className="font-medium text-text line-through">{pd.name}</span>
                      <span className="text-income font-semibold ml-2">Lunas</span>
                    </div>
                    <span className="text-text-secondary">{formatCurrency(pd.principal)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Form Aset */}
      <AssetFormModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onSuccess={fetchData}
        editingAsset={editingAsset}
      />

      {/* Modal Form Utang */}
      <DebtFormModal
        isOpen={isDebtModalOpen}
        onClose={() => setIsDebtModalOpen(false)}
        onSuccess={fetchData}
        editingDebt={editingDebt}
      />

      {/* Modal Bayar / Update Sisa Utang */}
      <DebtPaymentModal
        isOpen={Boolean(paymentDebt)}
        onClose={() => setPaymentDebt(null)}
        debt={paymentDebt}
        onSuccess={fetchData}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
