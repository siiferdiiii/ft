"use client";

import React, { useState } from "react";
import { TransactionGroupDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface TransactionGroupRowProps {
  group: TransactionGroupDto;
  onDelete?: (groupId: string) => void;
  isDeleting?: boolean;
}

export const TransactionGroupRow: React.FC<TransactionGroupRowProps> = ({
  group,
  onDelete,
  isDeleting = false,
}) => {
  const [expanded, setExpanded] = useState(false);

  const itemCount = group.transactions.length;
  const merchant = group.merchant || group.note || "Belanja Multi-Item";
  const dateStr = new Date(group.transactionDate).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
  });

  return (
    <div className={`transition-opacity ${isDeleting ? "opacity-40" : "opacity-100"}`}>
      {/* Group Header Row — tappable untuk expand/collapse */}
      <button
        className="w-full flex items-center justify-between px-3.5 py-3.5 hover:bg-field/50 transition-colors text-left"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Icon Grup */}
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold text-text truncate">{merchant}</div>
            {group.note && group.note !== group.merchant && !group.note.startsWith("Belanja di") && (
              <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium truncate flex items-center gap-1 mt-0.5">
                <span>🏷️</span>
                <span>{group.note}</span>
              </div>
            )}
            <div className="text-[11px] text-text-secondary flex items-center gap-1.5 mt-0.5">
              <span className="text-primary font-medium">{itemCount} item</span>
              <span>•</span>
              <span>{dateStr}</span>
              <span>•</span>
              <span className="bg-primary/10 text-primary text-[10px] px-1.5 rounded font-semibold">
                Struk AI
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-2 flex-shrink-0">
          <span className="text-[14px] font-bold text-expense">
            -{formatCurrency(group.totalAmount)}
          </span>
          <svg
            className={`w-4 h-4 text-text-secondary transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="bg-field/40 border-t border-border divide-y divide-border">
          {/* Note Banner jika ada info diskon/biaya */}
          {group.note && group.note !== group.merchant && (
            <div className="px-4 py-2 bg-emerald-500/10 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 border-b border-border flex items-center gap-1.5">
              <span>🏷️</span>
              <span>{group.note}</span>
            </div>
          )}

          {/* Item list */}
          {group.transactions.map((tx) => (
            <div
              key={tx.id}
              className="flex items-center justify-between px-4 py-2.5"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-expense/10 flex items-center justify-center text-[11px] font-bold text-expense flex-shrink-0">
                  {tx.categoryName ? tx.categoryName.charAt(0) : "•"}
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] font-semibold text-text truncate">
                    {tx.note || "Item Belanja"}
                  </div>
                  {tx.categoryName && (
                    <div className="text-[10px] text-text-secondary">{tx.categoryName}</div>
                  )}
                </div>
              </div>
              <span className="text-[12px] font-semibold text-expense ml-2 whitespace-nowrap flex-shrink-0">
                -{formatCurrency(tx.amount)}
              </span>
            </div>
          ))}

          {/* Footer summary */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-surface/60">
            <span className="text-[11px] font-semibold text-text-secondary">Total Belanja</span>
            <span className="text-[13px] font-bold text-expense">
              -{formatCurrency(group.totalAmount)}
            </span>
          </div>

          {onDelete && (
            <div className="px-4 py-2.5">
              <button
                onClick={() => onDelete(group.id)}
                disabled={isDeleting}
                className="text-[11px] text-expense font-semibold hover:opacity-70 disabled:opacity-40"
              >
                {isDeleting ? "Menghapus..." : "Hapus Grup Transaksi"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
