"use client";

import React from "react";
import { WalletDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { WalletIcon } from "../ui/Icons";

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
          ? "border-2 border-primary"
          : "border border-border hover:border-text-secondary/40"
      }`}
    >
      {/* Dot indicator warna primary saat aktif */}
      {isActive && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5">
          <span className="text-[11px] font-semibold text-primary">Aktif</span>
          <span className="w-2.5 h-2.5 rounded-full bg-primary" />
        </div>
      )}

      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-full bg-chip flex items-center justify-center text-primary">
          <WalletIcon className="w-4 h-4" />
        </div>
        <span className="text-[10px] font-medium text-text-secondary uppercase tracking-wider">
          {wallet.type}
        </span>
      </div>

      <div className="text-[13px] font-semibold text-text truncate mb-1">
        {wallet.name}
      </div>

      <div className="text-[15px] font-bold text-text">
        {formatCurrency(wallet.balance)}
      </div>
    </div>
  );
};
