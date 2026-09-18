"use client";

import React, { useState, useEffect } from "react";
import { DebtDto } from "@/lib/types";
import { CloseIcon, CardNavIcon } from "@/components/ui/Icons";

interface DebtFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingDebt?: DebtDto | null;
}

export const DebtFormModal: React.FC<DebtFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingDebt,
}) => {
  const [name, setName] = useState("");
  const [principal, setPrincipal] = useState<string>("");
  const [remainingBalance, setRemainingBalance] = useState<string>("");
  const [monthlyPayment, setMonthlyPayment] = useState<string>("");
  const [dueDayOfMonth, setDueDayOfMonth] = useState<string>("");
  const [interestRate, setInterestRate] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingDebt) {
      setName(editingDebt.name);
      setPrincipal(editingDebt.principal.toString());
      setRemainingBalance(editingDebt.remainingBalance.toString());
      setMonthlyPayment(
        editingDebt.monthlyPayment !== null ? editingDebt.monthlyPayment.toString() : ""
      );
      setDueDayOfMonth(
        editingDebt.dueDayOfMonth !== null ? editingDebt.dueDayOfMonth.toString() : ""
      );
      setInterestRate(
        editingDebt.interestRate !== null ? editingDebt.interestRate.toString() : ""
      );
    } else {
      setName("");
      setPrincipal("");
      setRemainingBalance("");
      setMonthlyPayment("");
      setDueDayOfMonth("");
      setInterestRate("");
    }
    setErrorMsg(null);
  }, [editingDebt, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericPrincipal = parseFloat(principal);
    const numericRemaining = parseFloat(remainingBalance);
    const numericPayment = monthlyPayment ? parseFloat(monthlyPayment) : null;
    const numericDue = dueDayOfMonth ? parseInt(dueDayOfMonth, 10) : null;
    const numericInterest = interestRate ? parseFloat(interestRate) : null;

    if (!name.trim()) {
      setErrorMsg("Nama utang/kewajiban wajib diisi");
      return;
    }
    if (isNaN(numericPrincipal) || numericPrincipal <= 0) {
      setErrorMsg("Total utang awal harus lebih dari 0");
      return;
    }
    if (isNaN(numericRemaining) || numericRemaining < 0) {
      setErrorMsg("Sisa utang tidak boleh bernilai negatif");
      return;
    }
    if (numericDue !== null && (numericDue < 1 || numericDue > 31)) {
      setErrorMsg("Tanggal jatuh tempo harus antara tanggal 1 - 31");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingDebt ? `/api/debts/${editingDebt.id}` : "/api/debts";
      const method = editingDebt ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          principal: numericPrincipal,
          remainingBalance: numericRemaining,
          monthlyPayment: numericPayment,
          dueDayOfMonth: numericDue,
          interestRate: numericInterest,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal menyimpan data utang");
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
            <div className="w-8 h-8 rounded-full bg-expense/10 text-expense flex items-center justify-center">
              <CardNavIcon className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-text">
              {editingDebt ? "Perbarui Data Utang" : "Catat Utang / Cicilan"}
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

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Nama Utang */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Nama Kewajiban / Utang
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: KPR Rumah, Cicilan Motor, Pinjaman Teman"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Total Utang Awal */}
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Total Awal (Rp)
              </label>
              <input
                type="number"
                required
                min="1000"
                step="1000"
                placeholder="0"
                value={principal}
                onChange={(e) => {
                  setPrincipal(e.target.value);
                  if (!editingDebt && !remainingBalance) {
                    setRemainingBalance(e.target.value);
                  }
                }}
                className="w-full px-3 py-2 bg-field text-text text-[13px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
            </div>

            {/* Sisa Utang Berjalan */}
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Sisa Saat Ini (Rp)
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                placeholder="0"
                value={remainingBalance}
                onChange={(e) => setRemainingBalance(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[13px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Cicilan per Bulan */}
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Cicilan Bulanan (Opsional)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                placeholder="0"
                value={monthlyPayment}
                onChange={(e) => setMonthlyPayment(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
            </div>

            {/* Tanggal Jatuh Tempo */}
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Tgl Tempo (1-31)
              </label>
              <input
                type="number"
                min="1"
                max="31"
                placeholder="Contoh: 15"
                value={dueDayOfMonth}
                onChange={(e) => setDueDayOfMonth(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
            </div>
          </div>

          {/* Bunga % / tahun */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Bunga per Tahun (% Opsional)
            </label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              placeholder="0"
              value={interestRate}
              onChange={(e) => setInterestRate(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
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
                : editingDebt
                ? "Simpan Perubahan"
                : "Catat Utang"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
