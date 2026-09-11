"use client";

import React from "react";
import { CategoryDto } from "@/lib/types";

interface CategoryBudgetButtonProps {
  category: CategoryDto;
  isSelected: boolean;
  onSelect: (category: CategoryDto) => void;
}

export const CategoryBudgetButton: React.FC<CategoryBudgetButtonProps> = ({
  category,
  isSelected,
  onSelect,
}) => {
  // Indikator warna dot/badge berdasarkan status budget
  const getBudgetBadge = () => {
    if (!category.statusColor || category.statusColor === "neutral") {
      return null;
    }

    const badgeColorMap = {
      green: "bg-budget-green",
      yellow: "bg-budget-yellow",
      orange: "bg-budget-orange",
      red: "bg-budget-red",
    };

    return (
      <span
        className={`w-2 h-2 rounded-full ${badgeColorMap[category.statusColor]}`}
        title={`Sisa budget: ${category.remainingPercent ?? 0}%`}
      />
    );
  };

  return (
    <button
      type="button"
      onClick={() => onSelect(category)}
      className={`flex items-center gap-2 px-3 py-2 rounded-control text-[13px] font-medium transition-all ${
        isSelected
          ? "bg-primary text-white border-transparent"
          : "bg-field text-text hover:bg-border/60 border border-transparent"
      }`}
    >
      <span className="truncate">{category.name}</span>
      {getBudgetBadge()}
    </button>
  );
};
