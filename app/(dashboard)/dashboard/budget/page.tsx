"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { EditIcon } from "@/components/ui/Icons";
import { CategoryDto } from "@/lib/types";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { useAppData } from "@/lib/context/AppDataContext";
import { BudgetInterviewModal } from "@/components/features/BudgetInterviewModal";
import { BudgetInterviewBanner } from "@/components/features/BudgetInterviewBanner";

export default function BudgetPage() {
  const {
    categories: allCategories,
    isInitialLoading: isLoading,
    refreshData,
    mutateCategories,
  } = useAppData();

  const categories = allCategories.filter((c) => c.type === "EXPENSE");

  // Ringkasan anggaran bulanan
  const totalBudget = categories.reduce((sum, c) => sum + (c.budgetLimit || 0), 0);
  const totalSpent = categories.reduce((sum, c) => sum + (c.currentExpense || 0), 0);
  const totalRemaining = Math.max(0, totalBudget - totalSpent);
  const spentPercent = totalBudget > 0 ? Math.min(100, Math.round((totalSpent / totalBudget) * 100)) : 0;
  const isOverBudget = totalBudget > 0 && totalSpent > totalBudget;

  // Edit budget modal state
  const [selectedCategory, setSelectedCategory] = useState<CategoryDto | null>(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // AI Interview modal state
  const [isInterviewOpen, setIsInterviewOpen] = useState(false);
  const [perpetualFundPercent, setPerpetualFundPercent] = useState(10);

  // Fetch perpetualFundPercent dari user settings untuk dikirim ke modal AI
  useEffect(() => {
    fetch("/api/user/settings")
      .then((r) => r.json())
      .then((json) => {
        if (json.data?.perpetualFundPercent) {
          setPerpetualFundPercent(json.data.perpetualFundPercent);
        }
      })
      .catch(() => { /* abaikan jika gagal, default 10% sudah memadai */ });
  }, []);

  const handleOpenEdit = (category: CategoryDto) => {
    setSelectedCategory(category);
    setBudgetLimitInput(category.budgetLimit ? formatCurrencyInput(category.budgetLimit) : "");
    setErrorMessage(null);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setErrorMessage(null);
    const parsed = parseCurrencyInput(budgetLimitInput);
    const numericLimit = budgetLimitInput.trim() ? (parsed > 0 ? parsed : null) : null;

    // Mutasi instan di memori (0ms!)
    mutateCategories((prev) =>
      prev.map((c) =>
        c.id === selectedCategory.id ? { ...c, budgetLimit: numericLimit } : c
      )
    );

    setIsSaving(true);
    try {
      const res = await fetch(`/api/categories/${selectedCategory.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          budgetLimit: numericLimit,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Gagal memperbarui budget");
        refreshData(true);
        return;
      }

      refreshData(true);
      setSelectedCategory(null);
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan budget");
      refreshData(true);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusBadge = (cat: CategoryDto) => {
    if (!cat.budgetLimit) {
      return (
        <span className="text-[11px] font-medium text-text-secondary">
          Tanpa Batas
        </span>
      );
    }

    const colorClasses = {
      green: "bg-budget-green text-white",
      yellow: "bg-budget-yellow text-text",
      orange: "bg-budget-orange text-white",
      red: "bg-budget-red text-white",
      neutral: "bg-field text-text-secondary",
    };

    const color = cat.statusColor || "neutral";

    return (
      <span
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colorClasses[color]}`}
      >
        Sisa {cat.remainingPercent ?? 0}%
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      {/* Header + tombol AI */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Manajemen Pengeluaran
          </span>
          <h1 className="text-[20px] font-bold text-text">Budget Bulanan</h1>
        </div>
        <button
          type="button"
          onClick={() => setIsInterviewOpen(true)}
          id="btn-ai-budget-interview"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[12px] bg-chip text-primary text-[12px] font-semibold hover:bg-primary/10 transition-colors flex-shrink-0 mt-1"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="2" y="4" width="10" height="7" rx="2" fill="#4E44E5" opacity="0.2"/>
            <rect x="4" y="2" width="6" height="4" rx="1.5" fill="#4E44E5"/>
            <circle cx="5.5" cy="4" r="0.8" fill="white"/>
            <circle cx="8.5" cy="4" r="0.8" fill="white"/>
            <path d="M5 6.5h4" stroke="#4E44E5" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          Susun dengan AI
        </button>
      </div>

      {/* Banner otomatis untuk user baru tanpa budget */}
      <BudgetInterviewBanner
        categories={allCategories}
        onStartInterview={() => setIsInterviewOpen(true)}
      />

      {/* Ringkasan Anggaran Bulanan (Total Anggaran, Tersisa, Terpakai) */}
      <div className="bg-surface p-5 rounded-[20px] border border-border shadow-sm space-y-4">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Total Anggaran Bulanan
          </span>
          <div className="flex items-baseline justify-between mt-1">
            <h2 className="text-[26px] font-bold text-text tracking-tight">
              {formatCurrency(totalBudget)}
            </h2>
            {totalBudget > 0 && (
              <span
                className={`text-[12px] font-semibold px-2.5 py-0.5 rounded-full ${
                  isOverBudget
                    ? "bg-expense/10 text-expense"
                    : "bg-primary/10 text-primary"
                }`}
              >
                {isOverBudget ? "Melebihi Anggaran" : `Terpakai ${spentPercent}%`}
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar Pemakaian Anggaran Keseluruhan */}
        {totalBudget > 0 && (
          <div className="w-full bg-field h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                isOverBudget
                  ? "bg-expense"
                  : spentPercent > 80
                  ? "bg-budget-orange"
                  : spentPercent > 50
                  ? "bg-budget-yellow"
                  : "bg-primary"
              }`}
              style={{ width: `${Math.min(100, spentPercent)}%` }}
            />
          </div>
        )}

        {/* Total Tersisa & Total Terpakai */}
        <div className="grid grid-cols-2 gap-3 pt-1 border-t border-border/60">
          <div className="bg-field/70 rounded-[14px] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-income" />
              <span className="text-[11px] font-medium text-text-secondary">
                Total Tersisa
              </span>
            </div>
            <p className="text-[16px] font-bold text-income">
              {formatCurrency(totalRemaining)}
            </p>
          </div>

          <div className="bg-field/70 rounded-[14px] p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <span className="w-2 h-2 rounded-full bg-expense" />
              <span className="text-[11px] font-medium text-text-secondary">
                Total Terpakai
              </span>
            </div>
            <p className="text-[16px] font-bold text-expense">
              {formatCurrency(totalSpent)}
            </p>
          </div>
        </div>
      </div>

      {/* Daftar Kategori & Budget */}
      <div className="space-y-3">
        {categories.map((cat) => {
          const expense = cat.currentExpense || 0;
          const limit = cat.budgetLimit;
          const progressPercent = limit ? Math.min(100, (expense / limit) * 100) : 0;

          return (
            <div
              key={cat.id}
              className="bg-surface p-4 rounded-card-lg border border-border flex flex-col space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-chip text-primary font-bold text-xs flex items-center justify-center">
                    {cat.name.charAt(0)}
                  </div>
                  <span className="text-[14px] font-semibold text-text">
                    {cat.name}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {getStatusBadge(cat)}
                  <button
                    onClick={() => handleOpenEdit(cat)}
                    className="p-1 rounded-control text-text-secondary hover:text-text hover:bg-field"
                    title="Ubah batas budget"
                  >
                    <EditIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Progress bar visual */}
              {limit && (
                <div className="w-full bg-field h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      cat.statusColor === "red"
                        ? "bg-budget-red"
                        : cat.statusColor === "orange"
                        ? "bg-budget-orange"
                        : cat.statusColor === "yellow"
                        ? "bg-budget-yellow"
                        : "bg-budget-green"
                    }`}
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              )}

              {/* Angka pemakaian vs limit */}
              <div className="flex items-center justify-between text-[12px]">
                <span className="text-text-secondary">Terpakai:</span>
                <span className="font-semibold text-text">
                  {formatCurrency(expense)}
                  {limit && (
                    <span className="text-text-secondary font-normal">
                      {" "}
                      / {formatCurrency(limit)}
                    </span>
                  )}
                </span>
              </div>
            </div>
          );
        })}

        {categories.length === 0 && !isLoading && (
          <div className="py-8 text-center text-[13px] text-text-secondary bg-surface rounded-card-lg border border-border">
            Belum ada kategori pengeluaran. Buat di tab Kategori.
          </div>
        )}
      </div>

      {/* Modal Edit Budget Limit */}
      <BottomSheet
        isOpen={Boolean(selectedCategory)}
        onClose={() => setSelectedCategory(null)}
        title={`Atur Budget: ${selectedCategory?.name}`}
      >
        <form onSubmit={handleSaveBudget} className="flex flex-col flex-1 min-h-0 relative">
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

      {/* Modal AI Budget Interview */}
      <BudgetInterviewModal
        isOpen={isInterviewOpen}
        onClose={() => setIsInterviewOpen(false)}
        expenseCategories={categories}
        perpetualFundPercent={perpetualFundPercent}
        onDone={() => refreshData(true)}
      />

      <BottomNav />
    </div>
  );
}
