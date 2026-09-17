"use client";

import React from "react";
import { TransactionDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface TransactionRowProps {
  transaction: TransactionDto;
  showDate?: boolean;
  className?: string;
}

export const TransactionRow: React.FC<TransactionRowProps> = ({
  transaction: tx,
  showDate = true,
  className = "",
}) => {
  const isIncome = tx.type === "INCOME";

  return (
    <div
      className={`flex items-center justify-between p-3.5 hover:bg-field/50 transition-colors ${className}`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <div
          className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs flex-shrink-0 ${
            isIncome ? "bg-income/10 text-income" : "bg-expense/10 text-expense"
          }`}
        >
          {tx.categoryName ? tx.categoryName.charAt(0) : "•"}
        </div>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-text truncate">
            {tx.note || tx.categoryName || "Transaksi"}
          </div>
          <div className="text-[11px] text-text-secondary flex items-center gap-1.5 truncate">
            <span>{tx.walletName || "Dompet"}</span>
            {tx.categoryName && (
              <>
                <span>•</span>
                <span className="truncate">{tx.categoryName}</span>
              </>
            )}
            {showDate && tx.transactionDate && (
              <>
                <span>•</span>
                <span>{new Date(tx.transactionDate).toLocaleDateString("id-ID")}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div
        className={`text-[14px] font-bold whitespace-nowrap ml-3 ${
          isIncome ? "text-income" : "text-expense"
        }`}
      >
        {isIncome ? "+" : "-"}
        {formatCurrency(tx.amount)}
      </div>
    </div>
  );
};
