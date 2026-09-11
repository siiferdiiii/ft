"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { EditIcon } from "@/components/ui/Icons";
import { CategoryDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export default function BudgetPage() {
  const [categories, setCategories] = useState<CategoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit budget modal state
  const [selectedCategory, setSelectedCategory] = useState<CategoryDto | null>(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState<string>("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCategories = async () => {
    try {
      const res = await fetch("/api/categories");
      const json = await res.json();
      if (json.data) {
        // Hanya kategori pengeluaran yang memiliki budget
        const expenseCategories = json.data.filter(
          (c: CategoryDto) => c.type === "EXPENSE"
        );
        setCategories(expenseCategories);
      }
    } catch (err) {
      console.error("Gagal memuat kategori budget:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleOpenEdit = (category: CategoryDto) => {
    setSelectedCategory(category);
    setBudgetLimitInput(category.budgetLimit ? String(category.budgetLimit) : "");
    setErrorMessage(null);
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory) return;

    setErrorMessage(null);
    const numericLimit = budgetLimitInput.trim()
      ? parseFloat(budgetLimitInput.replace(/[^0-9.]/g, ""))
      : null;

    if (numericLimit !== null && (isNaN(numericLimit) || numericLimit <= 0)) {
      setErrorMessage("Batas budget harus lebih dari 0");
      return;
    }

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
        return;
      }

      await loadCategories();
      setSelectedCategory(null);
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan budget");
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
      <div>
        <span className="text-[12px] font-medium text-text-secondary block">
          Manajemen Pengeluaran
        </span>
        <h1 className="text-[20px] font-bold text-text">Budget Bulanan</h1>
      </div>

      {/* Info Card */}
      <div className="bg-surface p-4 rounded-card-lg border border-border">
        <h2 className="text-[13px] font-semibold text-text mb-1">
          Indikator Warna Sisa Budget
        </h2>
        <div className="grid grid-cols-2 gap-2 mt-3 text-[11px] text-text-secondary">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-budget-green" />
            <span>&gt; 80% (Aman)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-budget-yellow" />
            <span>50% - 80% (Waspada)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-budget-orange" />
            <span>20% - 50% (Kritis)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-budget-red" />
            <span>&lt; 20% (Habis)</span>
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
        <form onSubmit={handleSaveBudget} className="space-y-4">
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
              type="number"
              value={budgetLimitInput}
              onChange={(e) => setBudgetLimitInput(e.target.value)}
              placeholder="Kosongkan untuk tanpa batas"
              className="w-full bg-field text-text text-[20px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
            <span className="text-[11px] text-text-secondary mt-1 block">
              Kosongkan field ini jika kategori tidak memiliki batas budget.
            </span>
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
              Simpan Perubahan
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomNav />
    </div>
  );
}
