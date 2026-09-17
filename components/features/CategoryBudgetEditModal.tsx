"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { CategoryDto } from "@/lib/types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

interface CategoryBudgetEditModalProps {
  category: CategoryDto | null;
  onClose: () => void;
  onSave: (categoryId: string, numericLimit: number | null) => Promise<boolean>;
}

export const CategoryBudgetEditModal: React.FC<CategoryBudgetEditModalProps> = ({
  category,
  onClose,
  onSave,
}) => {
  const [budgetLimitInput, setBudgetLimitInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (category) {
      setBudgetLimitInput(category.budgetLimit ? formatCurrencyInput(category.budgetLimit) : "");
      setErrorMessage(null);
    }
  }, [category]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category) return;

    setErrorMessage(null);
    const parsed = parseCurrencyInput(budgetLimitInput);
    const numericLimit = budgetLimitInput.trim() ? (parsed > 0 ? parsed : null) : null;

    setIsSaving(true);
    try {
      const success = await onSave(category.id, numericLimit);
      if (success) {
        onClose();
      } else {
        setErrorMessage("Gagal memperbarui budget");
      }
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan budget");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      isOpen={Boolean(category)}
      onClose={onClose}
      title={`Atur Budget: ${category?.name}`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-28">
          {errorMessage && (
            <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Batas Budget Bulanan (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={budgetLimitInput}
              onChange={(e) => setBudgetLimitInput(formatCurrencyInput(e.target.value))}
              placeholder="Rp 0 (Kosongkan untuk tanpa batas)"
              className="w-full bg-field text-text text-[20px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <span className="text-[11px] text-text-secondary mt-1 block">
              Kosongkan field ini jika kategori tidak memiliki batas budget.
            </span>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
            Simpan Perubahan
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
