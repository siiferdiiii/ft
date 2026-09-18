"use client";

import React from "react";
import { GoalDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { PlusIcon, EditIcon, ArchiveIcon, CheckCircleIcon, ClockIcon } from "@/components/ui/Icons";

interface GoalCardProps {
  goal: GoalDto;
  onQuickSave: (goal: GoalDto) => void;
  onEdit: (goal: GoalDto) => void;
  onArchive: (goal: GoalDto) => void;
}

export const GoalCard: React.FC<GoalCardProps> = ({
  goal,
  onQuickSave,
  onEdit,
  onArchive,
}) => {
  const percent = Math.min(
    100,
    Math.round((goal.walletBalance / (goal.targetAmount || 1)) * 100)
  );

  const isCompleted = Boolean(goal.isCompleted || goal.walletBalance >= goal.targetAmount);

  // Format target date jika ada
  let formattedDate: string | null = null;
  if (goal.targetDate) {
    const d = new Date(goal.targetDate);
    formattedDate = d.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <div className={`p-4 bg-surface rounded-card-wallet border transition-all ${
      isCompleted
        ? "border-income/40 bg-income/[0.02]"
        : "border-border hover:border-primary/40 shadow-sm"
    }`}>
      {/* Header card: Nama & Status */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h3 className="text-[15px] font-bold text-text truncate">
              {goal.name}
            </h3>
            {isCompleted && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-income/10 text-income text-[10px] font-bold rounded-full">
                <CheckCircleIcon className="w-3 h-3" />
                <span>Tercapai!</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 mt-1 text-[11px] text-text-secondary">
            <span className="bg-field px-1.5 py-0.5 rounded font-medium text-primary">
              Auto: {goal.allocationPercent}%
            </span>
            {formattedDate && (
              <span className="inline-flex items-center gap-1">
                <ClockIcon className="w-3 h-3" />
                <span>Target: {formattedDate}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action icons (Edit & Archive) */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onEdit(goal)}
            className="p-1.5 text-text-secondary hover:text-text rounded-control hover:bg-field transition-colors"
            title="Edit Goal"
            aria-label="Edit Goal"
          >
            <EditIcon className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onArchive(goal)}
            className="p-1.5 text-text-secondary hover:text-expense rounded-control hover:bg-field transition-colors"
            title="Arsipkan Goal"
            aria-label="Arsipkan Goal"
          >
            <ArchiveIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5 my-3">
        <div className="flex items-center justify-between text-[12px]">
          <span className="font-bold text-text">
            {formatCurrency(goal.walletBalance)}
          </span>
          <span className="text-text-secondary font-medium">
            dari {formatCurrency(goal.targetAmount)} ({percent}%)
          </span>
        </div>

        <div className="w-full h-2.5 bg-field rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              isCompleted ? "bg-income" : "bg-primary"
            }`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Footer & Tombol Nabung Cepat */}
      <div className="flex items-center justify-between pt-1">
        <span className="text-[11px] text-text-secondary">
          {isCompleted
            ? "Target telah tercapai!"
            : `Kurang ${formatCurrency(Math.max(0, goal.targetAmount - goal.walletBalance))}`}
        </span>

        <button
          type="button"
          onClick={() => onQuickSave(goal)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-[12px] font-semibold rounded-control hover:opacity-90 active:scale-95 transition-all shadow-xs"
        >
          <PlusIcon className="w-3.5 h-3.5" />
          <span>Nabung</span>
        </button>
      </div>
    </div>
  );
};
