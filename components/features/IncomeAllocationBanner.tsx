"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { InfinityIcon, TargetNavIcon, PlusIcon, CloseIcon } from "../ui/Icons";
import { WalletDto, GoalDto } from "@/lib/types";

export interface IncomeAllocationItem {
  id: string; // "dana-abadi" atau goal.id
  type: "dana-abadi" | "goal";
  title: string;
  percent: number;
  amount: number;
  targetWalletId?: string;
  goal?: GoalDto;
}

interface IncomeAllocationBannerProps {
  incomeAmount: number;
  sourceWalletId: string;
  sourceWalletName: string;
  danaAbadiWallet?: WalletDto;
  perpetualFundPercent: number;
  goals: GoalDto[];
  onAllocateDanaAbadi: (amount: number, fromWalletId: string, toWalletId: string) => Promise<void>;
  onCreateDanaAbadiWallet: () => void;
  onAllocateGoal: (goal: GoalDto, amount: number, fromWalletId: string) => Promise<void>;
  onClose: () => void;
  onSkipDanaAbadi?: () => void;
}

export const IncomeAllocationBanner: React.FC<IncomeAllocationBannerProps> = ({
  incomeAmount,
  sourceWalletId,
  sourceWalletName,
  danaAbadiWallet,
  perpetualFundPercent,
  goals,
  onAllocateDanaAbadi,
  onCreateDanaAbadiWallet,
  onAllocateGoal,
  onClose,
  onSkipDanaAbadi,
}) => {
  // Bangun daftar alokasi: Dana Abadi + setiap Goal aktif yang belum tercapai/diarsipkan
  const initialItems: IncomeAllocationItem[] = [
    {
      id: "dana-abadi",
      type: "dana-abadi",
      title: "Dana Abadi",
      percent: perpetualFundPercent,
      amount: Math.round(incomeAmount * (perpetualFundPercent / 100)),
      targetWalletId: danaAbadiWallet?.id,
    },
    ...goals
      .filter((g) => !g.isArchived)
      .map((g) => ({
        id: `goal-${g.id}`,
        type: "goal" as const,
        title: g.name,
        percent: g.allocationPercent,
        amount: Math.round(incomeAmount * (g.allocationPercent / 100)),
        targetWalletId: g.walletId,
        goal: g,
      })),
  ];

  const [activeItems, setActiveItems] = useState<IncomeAllocationItem[]>(initialItems);
  const [submittingIds, setSubmittingIds] = useState<Record<string, boolean>>({});

  const handleSkipItem = (item: IncomeAllocationItem) => {
    if (item.type === "dana-abadi" && onSkipDanaAbadi) {
      onSkipDanaAbadi();
    }
    const next = activeItems.filter((i) => i.id !== item.id);
    setActiveItems(next);
    if (next.length === 0) {
      onClose();
    }
  };

  const handleAllocateItem = async (item: IncomeAllocationItem) => {
    setSubmittingIds((prev) => ({ ...prev, [item.id]: true }));
    try {
      if (item.type === "dana-abadi") {
        if (!danaAbadiWallet) {
          onCreateDanaAbadiWallet();
          return;
        }
        await onAllocateDanaAbadi(item.amount, sourceWalletId, danaAbadiWallet.id);
      } else if (item.goal) {
        await onAllocateGoal(item.goal, item.amount, sourceWalletId);
      }

      const next = activeItems.filter((i) => i.id !== item.id);
      setActiveItems(next);
      if (next.length === 0) {
        onClose();
      }
    } finally {
      setSubmittingIds((prev) => ({ ...prev, [item.id]: false }));
    }
  };

  if (activeItems.length === 0) return null;

  return (
    <div className="mb-5 p-4 bg-surface rounded-card-lg border-2 border-primary/30 shadow-sm animate-in fade-in slide-in-from-top-3 duration-200">
      {/* Header Banner */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
            Saran Alokasi Otomatis
          </span>
          <h4 className="text-[14px] font-bold text-text">
            Pemasukan Baru: {formatCurrency(incomeAmount)}
          </h4>
          <span className="text-[11px] text-text-secondary">
            Diterima di <em>{sourceWalletName}</em>. Sisihkan untuk masa depan dan tujuanmu:
          </span>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-text-secondary hover:text-text p-1 text-xs rounded-control hover:bg-field"
          title="Tutup banner"
        >
          <CloseIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Daftar Baris Alokasi Mandiri (PRD_GOALS §3.2) */}
      <div className="space-y-2.5">
        {activeItems.map((item) => {
          const isSubmitting = submittingIds[item.id] || false;

          return (
            <div
              key={item.id}
              className="p-3 bg-field/60 rounded-card border border-border/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all"
            >
              {/* Info Alokasi */}
              <div className="flex items-center gap-2.5 min-w-0">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  item.type === "dana-abadi"
                    ? "bg-primary/10 text-primary"
                    : "bg-[#8B5CF6]/10 text-[#8B5CF6]"
                }`}>
                  {item.type === "dana-abadi" ? (
                    <InfinityIcon className="w-4 h-4" />
                  ) : (
                    <TargetNavIcon className="w-4 h-4" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[13px] font-bold text-text truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] font-semibold px-1.5 py-0.2 bg-primary/10 text-primary rounded">
                      {item.percent}%
                    </span>
                  </div>
                  <span className="text-[12px] font-bold text-primary block">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>

              {/* Tombol Aksi per Baris */}
              <div className="flex items-center gap-2 self-end sm:self-center">
                {item.type === "dana-abadi" && !danaAbadiWallet ? (
                  <button
                    type="button"
                    onClick={onCreateDanaAbadiWallet}
                    className="flex items-center gap-1 py-1.5 px-3 bg-primary text-white text-[12px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all"
                  >
                    <PlusIcon className="w-3 h-3" />
                    <span>Buat Dompet</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => handleAllocateItem(item)}
                    className="py-1.5 px-3.5 bg-primary text-white text-[12px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSubmitting ? "..." : `Alokasikan`}
                  </button>
                )}

                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleSkipItem(item)}
                  className="py-1.5 px-2.5 bg-surface text-text-secondary hover:text-text text-[12px] font-medium rounded-control border border-border hover:bg-field transition-colors"
                >
                  Lewati
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
