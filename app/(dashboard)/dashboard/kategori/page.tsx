"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PlusIcon, TrashIcon, EditIcon } from "@/components/ui/Icons";
import { CategoryDto, TransactionType } from "@/lib/types";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { useAppData } from "@/lib/context/AppDataContext";

export default function CategoriesPage() {
  const {
    categories,
    isInitialLoading: isLoading,
    refreshData,
    mutateCategories,
  } = useAppData();

  const [activeTab, setActiveTab] = useState<TransactionType>("EXPENSE");

  // Form modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<CategoryDto | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [budgetLimit, setBudgetLimit] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadCategories = () => refreshData(true);

  const handleOpenCreate = () => {
    setEditingCategory(null);
    setName("");
    setType(activeTab);
    setBudgetLimit("");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (c: CategoryDto) => {
    setEditingCategory(c);
    setName(c.name);
    setType(c.type);
    setBudgetLimit(c.budgetLimit ? formatCurrencyInput(c.budgetLimit) : "");
    setErrorMessage(null);
    setIsModalOpen(true);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Nama kategori wajib diisi");
      return;
    }

    const parsedLimit = parseCurrencyInput(budgetLimit);
    const numericLimit = budgetLimit.trim() ? (parsedLimit > 0 ? parsedLimit : null) : null;

    setIsSaving(true);
    try {
      if (editingCategory) {
        mutateCategories((prev) =>
          prev.map((c) =>
            c.id === editingCategory.id
              ? { ...c, name: name.trim(), budgetLimit: numericLimit }
              : c
          )
        );
        const res = await fetch(`/api/categories/${editingCategory.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            budgetLimit: numericLimit,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message || "Gagal memperbarui kategori");
          refreshData(true);
          return;
        }
      } else {
        const res = await fetch("/api/categories", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            type,
            budgetLimit: numericLimit,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message || "Gagal menambahkan kategori");
          return;
        }
        if (json.data) {
          mutateCategories((prev) => [...prev, json.data]);
        }
      }

      refreshData(true);
      setIsModalOpen(false);
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan kategori");
      refreshData(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Hapus kategori ini? Transaksi terkait tidak akan terhapus.")) return;

    mutateCategories((prev) => prev.filter((c) => c.id !== id));
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error?.message || "Gagal menghapus kategori");
        refreshData(true);
        return;
      }
      refreshData(true);
    } catch {
      alert("Terjadi kesalahan jaringan");
      refreshData(true);
    }
  };

  const filteredCategories = categories.filter((c) => c.type === activeTab);

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Pengelompokan Transaksi
          </span>
          <h1 className="text-[20px] font-bold text-text">Daftar Kategori</h1>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-control text-[13px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Tab Pengeluaran / Pemasukan */}
      <div>
        <SegmentedControl value={activeTab} onChange={setActiveTab} />
      </div>

      {/* List Kategori */}
      <div className="space-y-3">
        {filteredCategories.map((c) => (
          <div
            key={c.id}
            className="bg-surface p-4 rounded-card-wallet border border-border flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-chip text-primary font-bold text-xs flex items-center justify-center">
                {c.name.charAt(0)}
              </div>
              <div>
                <span className="text-[14px] font-semibold text-text block">
                  {c.name}
                </span>
                <span className="text-[11px] text-text-secondary">
                  {c.budgetLimit
                    ? `Budget: ${formatCurrency(c.budgetLimit)}`
                    : "Tanpa batas budget"}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => handleOpenEdit(c)}
                className="p-2 text-text-secondary hover:text-text hover:bg-field rounded-control transition-colors"
                title="Edit kategori"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteCategory(c.id)}
                className="p-2 text-text-secondary hover:text-expense hover:bg-field rounded-control transition-colors"
                title="Hapus kategori"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {filteredCategories.length === 0 && !isLoading && (
          <div className="py-8 text-center text-[13px] text-text-secondary bg-surface rounded-card-lg border border-border">
            Belum ada kategori untuk tipe ini. Klik "+ Tambah" di atas untuk membuat kategori baru.
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Kategori */}
      <BottomSheet
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingCategory ? "Edit Kategori" : "Tambah Kategori Baru"}
      >
        <form onSubmit={handleSaveCategory} className="flex flex-col flex-1 min-h-0 relative">
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-28">
            {errorMessage && (
              <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Nama Kategori
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Makanan, Transport, Hiburan"
                required
                className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>

            {!editingCategory && (
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Tipe Transaksi
                </label>
                <SegmentedControl value={type} onChange={setType} />
              </div>
            )}

            {type === "EXPENSE" && (
              <div>
                <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                  Batas Budget Bulanan (Opsional)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={budgetLimit}
                  onChange={(e) => setBudgetLimit(formatCurrencyInput(e.target.value))}
                  placeholder="Rp 0 (Contoh: Rp 1.000.000)"
                  className="w-full bg-field text-text text-[18px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            )}
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
            <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
              {editingCategory ? "Simpan Perubahan" : "Buat Kategori"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      <BottomNav />
    </div>
  );
}
