"use client";

import React, { useState } from "react";
import { formatCurrency } from "@/lib/currency";
import { InfinityIcon, PlusIcon } from "../ui/Icons";
import { WalletDto } from "@/lib/types";

export interface IncomeAllocationSuggestion {
  incomeAmount: number;
  allocationAmount: number;
  sourceWalletId: string;
  sourceWalletName: string;
  percent: number;
}

interface DanaAbadiSuggestBannerProps {
  suggestion: IncomeAllocationSuggestion;
  danaAbadiWallet?: WalletDto;
  onAllocate: (amount: number, fromWalletId: string, toWalletId: string) => Promise<void>;
  onCreateDanaAbadiWallet: () => void;
  onSkip: () => void;
}

export const DanaAbadiSuggestBanner: React.FC<DanaAbadiSuggestBannerProps> = ({
  suggestion,
  danaAbadiWallet,
  onAllocate,
  onCreateDanaAbadiWallet,
  onSkip,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAllocateClick = async () => {
    if (!danaAbadiWallet) {
      onCreateDanaAbadiWallet();
      return;
    }

    setIsSubmitting(true);
    try {
      await onAllocate(
        suggestion.allocationAmount,
        suggestion.sourceWalletId,
        danaAbadiWallet.id
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mb-5 p-4 bg-surface rounded-card-lg border-2 border-primary/30 shadow-sm animate-in fade-in slide-in-from-top-3 duration-200">
      <div className="flex items-start justify-between gap-3 mb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
            <InfinityIcon className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">
              Saran Alokasi Dana Abadi ({suggestion.percent}%)
            </span>
            <h4 className="text-[13px] font-bold text-text">
              Bayar diri sendiri dulu: {formatCurrency(suggestion.allocationAmount)}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={onSkip}
          className="text-text-secondary hover:text-text p-1 text-xs"
          title="Tutup banner"
        >
          ✕
        </button>
      </div>

      <p className="text-[12px] text-text-secondary leading-normal mb-3.5">
        {danaAbadiWallet ? (
          <>
            Sisihkan <strong>{formatCurrency(suggestion.allocationAmount)}</strong> dari pemasukan di <em>{suggestion.sourceWalletName}</em> ke dompet <strong>{danaAbadiWallet.name}</strong> untuk disimpan & dikembangkan.
          </>
        ) : (
          <>
            Kamu mendapat pemasukan! Tandai atau buat satu dompet sebagai <strong>Dana Abadi</strong> untuk mulai menyisihkan {suggestion.percent}% secara otomatis.
          </>
        )}
      </p>

      <div className="flex items-center gap-2">
        {danaAbadiWallet ? (
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleAllocateClick}
            className="flex-1 py-2.5 px-4 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isSubmitting ? "Mengalokasikan..." : `Alokasikan ${formatCurrency(suggestion.allocationAmount)}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onCreateDanaAbadiWallet}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-4 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-[0.98] transition-all"
          >
            <PlusIcon className="w-3.5 h-3.5" />
            <span>Buat Dompet Dana Abadi</span>
          </button>
        )}

        <button
          type="button"
          disabled={isSubmitting}
          onClick={onSkip}
          className="py-2.5 px-4 bg-field text-text-secondary hover:text-text text-[13px] font-semibold rounded-control hover:bg-border/50 transition-colors"
        >
          Lewati
        </button>
      </div>
    </div>
  );
};
