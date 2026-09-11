"use client";

import React from "react";
import { TransactionType } from "@/lib/types";

interface SegmentedControlProps {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
  disabled?: boolean;
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="flex w-full bg-field p-1 rounded-full border border-border">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("EXPENSE")}
        className={`flex-1 py-2 text-center text-[13px] font-semibold rounded-full transition-all duration-150 ${
          value === "EXPENSE"
            ? "bg-expense text-white shadow-none"
            : "text-text-secondary hover:text-text"
        }`}
      >
        Pengeluaran
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange("INCOME")}
        className={`flex-1 py-2 text-center text-[13px] font-semibold rounded-full transition-all duration-150 ${
          value === "INCOME"
            ? "bg-income text-white shadow-none"
            : "text-text-secondary hover:text-text"
        }`}
      >
        Pemasukan
      </button>
    </div>
  );
};
