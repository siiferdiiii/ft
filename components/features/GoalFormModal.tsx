"use client";

import React, { useState, useEffect } from "react";
import { GoalDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { CloseIcon, TargetNavIcon } from "@/components/ui/Icons";

interface GoalFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingGoal?: GoalDto | null;
}

export const GoalFormModal: React.FC<GoalFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingGoal,
}) => {
  const [name, setName] = useState("");
  const [targetAmount, setTargetAmount] = useState<string>("");
  const [targetDate, setTargetDate] = useState<string>("");
  const [allocationPercent, setAllocationPercent] = useState<number>(5);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingGoal) {
      setName(editingGoal.name);
      setTargetAmount(editingGoal.targetAmount.toString());
      setTargetDate(
        editingGoal.targetDate ? editingGoal.targetDate.slice(0, 10) : ""
      );
      setAllocationPercent(editingGoal.allocationPercent);
    } else {
      setName("");
      setTargetAmount("");
      setTargetDate("");
      setAllocationPercent(5);
    }
    setErrorMsg(null);
  }, [editingGoal, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseFloat(targetAmount);
    if (!name.trim()) {
      setErrorMsg("Nama tujuan tabungan harus diisi");
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Target nominal harus lebih besar dari 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingGoal ? `/api/goals/${editingGoal.id}` : "/api/goals";
      const method = editingGoal ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          targetAmount: numericAmount,
          targetDate: targetDate ? targetDate : null,
          allocationPercent,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal menyimpan goal");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMsg("Terjadi kendala jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-card-lg border border-border shadow-xl p-5 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <TargetNavIcon className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-text">
              {editingGoal ? "Edit Tujuan Tabungan" : "Tambah Tujuan Baru"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text rounded-control hover:bg-field"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-expense/10 text-expense text-[12px] font-medium rounded-control border border-expense/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Goal */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Nama Tujuan
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Beli Motor, Liburan Akhir Tahun"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Target Nominal */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Target Nominal (Rp)
            </label>
            <input
              type="number"
              required
              min="1000"
              step="1000"
              placeholder="0"
              value={targetAmount}
              onChange={(e) => setTargetAmount(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[14px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
            {/* Quick chips */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[2000000, 5000000, 10000000, 20000000].map((nominal) => (
                <button
                  key={nominal}
                  type="button"
                  onClick={() => setTargetAmount(nominal.toString())}
                  className="px-2.5 py-1 bg-field hover:bg-border/60 text-text-secondary text-[11px] font-medium rounded-control border border-border/80 transition-colors"
                >
                  {formatCurrency(nominal)}
                </button>
              ))}
            </div>
          </div>

          {/* Target Tanggal */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Target Tanggal (Opsional)
            </label>
            <input
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Persentase Alokasi Otomatis (PRD_GOALS §3.1) */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-text">
                Alokasi Otomatis dari Pemasukan
              </label>
              <span className="text-[13px] font-bold text-primary">
                {allocationPercent}%
              </span>
            </div>
            <p className="text-[11px] text-text-secondary mb-2">
              Saran alokasi otomatis yang muncul setiap kamu mencatat pemasukan baru.
            </p>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={allocationPercent}
              onChange={(e) => setAllocationPercent(parseInt(e.target.value, 10))}
              className="w-full accent-primary cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-secondary mt-0.5">
              <span>1%</span>
              <span>Default: 5%</span>
              <span>50%</span>
            </div>
          </div>

          {/* Tombol Simpan */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[13px] font-semibold text-text-secondary hover:text-text rounded-control hover:bg-field transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting
                ? "Menyimpan..."
                : editingGoal
                ? "Simpan Perubahan"
                : "Buat Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
