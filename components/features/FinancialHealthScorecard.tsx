"use client";

import React from "react";
import { FinancialHealthMetricsDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface FinancialHealthScorecardProps {
  data?: FinancialHealthMetricsDto;
  isLoading?: boolean;
}

export const FinancialHealthScorecard: React.FC<FinancialHealthScorecardProps> = ({
  data,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-24 bg-surface rounded-card-lg border border-border p-4 space-y-2">
            <div className="h-3 bg-field rounded w-2/3" />
            <div className="h-6 bg-field rounded w-full" />
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  const getSavingsRateBadge = (status: FinancialHealthMetricsDto["savingsRateStatus"], rate: number) => {
    switch (status) {
      case "EXCELLENT":
        return { label: "Sangat Sehat", class: "bg-income/10 text-income" };
      case "GOOD":
        return { label: "Ideal (20%+)", class: "bg-income/10 text-income" };
      case "FAIR":
        return { label: "Cukup", class: "bg-chip text-primary" };
      case "LOW":
        return { label: "Perlu Ditingkatkan", class: "bg-[#EAB308]/15 text-[#B45309]" };
      case "DEFICIT":
        return { label: "Defisit", class: "bg-expense/10 text-expense" };
    }
  };

  const savingsBadge = getSavingsRateBadge(data.savingsRateStatus, data.savingsRate);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold text-text flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-primary" />
          <span>Indikator Finansial Lengkap</span>
        </h3>
        <span className="text-[11px] text-text-secondary">Efisiensi & Solvabilitas</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {/* Card 1: Tingkat Tabungan (Savings Rate) */}
        <div className="bg-surface p-3.5 rounded-card-lg border border-border flex flex-col justify-between">
          <div className="flex items-start justify-between gap-1 mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Tingkat Tabungan
            </span>
            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${savingsBadge.class}`}>
              {savingsBadge.label}
            </span>
          </div>
          <div className="my-1">
            <span
              className={`text-[18px] font-bold tracking-tight ${
                data.savingsRate >= 20
                  ? "text-income"
                  : data.savingsRate >= 0
                  ? "text-primary"
                  : "text-expense"
              }`}
            >
              {data.savingsRate}%
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            {data.netCashFlow >= 0 ? "Surplus: " : "Defisit: "}
            <strong className={data.netCashFlow >= 0 ? "text-income" : "text-expense"}>
              {formatCurrency(Math.abs(data.netCashFlow))}
            </strong>
          </div>
        </div>

        {/* Card 2: Rata-rata Pengeluaran Harian (Daily Burn Rate) */}
        <div className="bg-surface p-3.5 rounded-card-lg border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Rata-rata / Hari
            </span>
            <span className="text-[9.5px] font-medium text-text-secondary bg-field px-1.5 py-0.5 rounded">
              Burn Rate
            </span>
          </div>
          <div className="my-1">
            <span className="text-[18px] font-bold text-text tracking-tight">
              {formatCurrency(data.dailyAverageExpense)}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Dari {data.totalTransactionsCount} total transaksi periode ini
          </div>
        </div>

        {/* Card 3: Rata-rata per Transaksi Belanja */}
        <div className="bg-surface p-3.5 rounded-card-lg border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Biaya / Transaksi
            </span>
            <span className="text-[9.5px] font-medium text-text-secondary bg-field px-1.5 py-0.5 rounded">
              {data.expenseTransactionCount}x Belanja
            </span>
          </div>
          <div className="my-1">
            <span className="text-[18px] font-bold text-text tracking-tight">
              {formatCurrency(data.averageExpensePerTransaction)}
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Rata-rata tiap belanja keluar
          </div>
        </div>

        {/* Card 4: Rasio Utang thd Aset (Solvabilitas) */}
        <div className="bg-surface p-3.5 rounded-card-lg border border-border flex flex-col justify-between">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Beban Utang / Aset
            </span>
            <span
              className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                data.debtToAssetRatio <= 30
                  ? "bg-income/10 text-income"
                  : data.debtToAssetRatio <= 50
                  ? "bg-[#EAB308]/15 text-[#B45309]"
                  : "bg-expense/10 text-expense"
              }`}
            >
              {data.debtToAssetRatio <= 30
                ? "Aman (<30%)"
                : data.debtToAssetRatio <= 50
                ? "Moderat"
                : "Tinggi"}
            </span>
          </div>
          <div className="my-1">
            <span
              className={`text-[18px] font-bold tracking-tight ${
                data.debtToAssetRatio <= 30 ? "text-income" : "text-expense"
              }`}
            >
              {data.debtToAssetRatio}%
            </span>
          </div>
          <div className="text-[10px] text-text-secondary">
            Likuid T+3:{" "}
            <strong className="text-primary">
              {formatCurrency(data.liquidCashT3)}
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
};
