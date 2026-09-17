"use client";

import React from "react";
import { TransactionType } from "@/lib/types";

interface SegmentedControlProps {
  value: TransactionType;
  onChange: (value: TransactionType) => void;
  disabled?: boolean;
  order?: ("INCOME" | "EXPENSE")[];
}

export const SegmentedControl: React.FC<SegmentedControlProps> = ({
  value,
  onChange,
  disabled = false,
  order = ["EXPENSE", "INCOME"],
}) => {
  return (
    <div className="flex w-full bg-field p-1 rounded-full border border-border">
      {order.map((type) => {
        const isActive = value === type;
        const isExpense = type === "EXPENSE";
        return (
          <button
            key={type}
            type="button"
            disabled={disabled}
            onClick={() => onChange(type)}
            className={`flex-1 py-2 text-center text-[13px] font-semibold rounded-full transition-all duration-150 ${
              isActive
                ? isExpense
                  ? "bg-expense text-white shadow-none"
                  : "bg-income text-white shadow-none"
                : "text-text-secondary hover:text-text"
            }`}
          >
            {isExpense ? "Pengeluaran" : "Pemasukan"}
          </button>
        );
      })}
    </div>
  );
};
