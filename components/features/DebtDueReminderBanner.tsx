"use client";

import React from "react";
import { DebtDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { AlertCircleIcon, CloseIcon } from "@/components/ui/Icons";

interface DebtDueReminderBannerProps {
  debts: DebtDto[];
  onDismiss?: () => void;
  onPayDebt?: (debt: DebtDto) => void;
}

export const DebtDueReminderBanner: React.FC<DebtDueReminderBannerProps> = ({
  debts,
  onDismiss,
  onPayDebt,
}) => {
  if (!debts || debts.length === 0) return null;

  const today = new Date();
  const todayDay = today.getDate();
  const daysInThisMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  return (
    <div className="mb-4 space-y-2">
      {debts.map((debt) => {
        let diff = (debt.dueDayOfMonth ?? todayDay) - todayDay;
        if (diff < 0) {
          diff = daysInThisMonth - todayDay + (debt.dueDayOfMonth ?? 1);
        }

        const dueLabel =
          diff === 0
            ? "Jatuh tempo hari ini!"
            : diff === 1
            ? "Jatuh tempo besok!"
            : `Jatuh tempo dalam ${diff} hari`;

        const amountLabel = debt.monthlyPayment
          ? formatCurrency(debt.monthlyPayment)
          : formatCurrency(debt.remainingBalance);

        return (
          <div
            key={debt.id}
            className="p-3 bg-amber-500/10 border border-amber-500/30 text-text rounded-card-wallet flex items-center justify-between gap-3 animate-in fade-in"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                <AlertCircleIcon className="w-4 h-4" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-amber-600 uppercase tracking-wide">
                    Pengingat Cicilan: {dueLabel}
                  </span>
                </div>
                <p className="text-[13px] font-bold text-text truncate">
                  {debt.name} &bull; {amountLabel}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {onPayDebt && (
                <button
                  type="button"
                  onClick={() => onPayDebt(debt)}
                  className="px-2.5 py-1 bg-amber-600 text-white text-[11px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all shadow-xs"
                >
                  Bayar
                </button>
              )}
              {onDismiss && (
                <button
                  type="button"
                  onClick={onDismiss}
                  className="p-1 text-text-secondary hover:text-text rounded-control hover:bg-black/5"
                  title="Tutup pengingat"
                >
                  <CloseIcon className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
