"use client";

import React from "react";
import { WalletDto } from "@/lib/types";
import { WalletIcon, InfinityIcon } from "../ui/Icons";
import { AnimatedBalance } from "../ui/AnimatedBalance";

interface WalletCardProps {
  wallet: WalletDto;
  isActive: boolean;
  onSelect: (wallet: WalletDto) => void;
}

export const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  isActive,
  onSelect,
}) => {
  return (
    <div
      onClick={() => onSelect(wallet)}
      role="button"
      tabIndex={0}
      className={`relative min-w-[150px] flex-1 p-4 rounded-card-wallet bg-surface cursor-pointer transition-all duration-150 ${
        isActive
          ? "border-2 border-primary shadow-xs ring-1 ring-primary/20"
          : wallet.isPerpetualFund
          ? "border-2 border-primary/40 bg-chip/10 hover:border-primary/60"
          : "border border-border hover:border-text-secondary/40"
      }`}
    >
      {/* Indikator Status di Pojok Kanan Atas */}
      {isActive ? (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-primary">Aktif</span>
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
      ) : wallet.isPerpetualFund ? (
        <div className="absolute top-3 right-3 text-primary/70" title="Dana Abadi">
          <InfinityIcon className="w-4 h-4" />
        </div>
      ) : null}

      {/* Baris Atas: Ikon & Tipe Dompet (Rapi & Seragam) */}
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-chip text-primary flex items-center justify-center flex-shrink-0">
          {wallet.isPerpetualFund ? (
            <InfinityIcon className="w-3.5 h-3.5" />
          ) : (
            <WalletIcon className="w-3.5 h-3.5" />
          )}
        </div>
        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
          {wallet.type}
        </span>
      </div>

      <div className="text-[13px] font-semibold text-text truncate mb-1">
        {wallet.name}
      </div>

      <div className="text-[15px] font-bold text-text">
        <AnimatedBalance
          value={wallet.balance}
          duration={1000}
          storageKey={`ft_wallet_balance_${wallet.id}`}
        />
      </div>
    </div>
  );
};
