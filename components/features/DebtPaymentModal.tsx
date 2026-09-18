"use client";

import React, { useState } from "react";
import { DebtDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { CloseIcon, CheckCircleIcon } from "@/components/ui/Icons";

interface DebtPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  debt: DebtDto | null;
  onSuccess: () => void;
}

export const DebtPaymentModal: React.FC<DebtPaymentModalProps> = ({
  isOpen,
  onClose,
  debt,
  onSuccess,
}) => {
  const [paidAmount, setPaidAmount] = useState<string>(() => {
    return debt?.monthlyPayment ? debt.monthlyPayment.toString() : "";
  });
  const [mode, setMode] = useState<"pay" | "manual">("pay");
  const [newRemaining, setNewRemaining] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  React.useEffect(() => {
    if (debt) {
      setPaidAmount(debt.monthlyPayment ? debt.monthlyPayment.toString() : "");
      setNewRemaining(debt.remainingBalance.toString());
      setMode("pay");
    }
    setErrorMsg(null);
  }, [debt, isOpen]);

  if (!isOpen || !debt) return null;

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    let updatedBalance = debt.remainingBalance;

    if (mode === "pay") {
      const numPaid = parseFloat(paidAmount);
      if (isNaN(numPaid) || numPaid <= 0) {
        setErrorMsg("Nominal cicilan yang dibayar harus lebih dari 0");
        return;
      }
      updatedBalance = Math.max(0, debt.remainingBalance - numPaid);
    } else {
      const numRemaining = parseFloat(newRemaining);
      if (isNaN(numRemaining) || numRemaining < 0) {
        setErrorMsg("Sisa utang tidak boleh negatif");
        return;
      }
      updatedBalance = numRemaining;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remainingBalance: updatedBalance,
          isPaidOff: updatedBalance <= 0,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal mengupdate utang");
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

  const handleMarkAsPaidOff = async () => {
    if (!confirm(`Tandai "${debt.name}" sudah lunas?`)) return;

    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/debts/${debt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          remainingBalance: 0,
          isPaidOff: true,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal menandai lunas");
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
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[11px] font-semibold text-text-secondary uppercase tracking-wider block">
              Catat Pembayaran Cicilan
            </span>
            <h2 className="text-[16px] font-bold text-text truncate">
              {debt.name}
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

        {/* Info Sisa Utang Saat Ini */}
        <div className="p-3 bg-field rounded-card border border-border/70 mb-4 flex items-center justify-between">
          <span className="text-[12px] text-text-secondary">Sisa Utang Berjalan</span>
          <span className="text-[15px] font-bold text-text">
            {formatCurrency(debt.remainingBalance)}
          </span>
        </div>

        {/* Switch Mode */}
        <div className="flex gap-2 p-1 bg-field rounded-control mb-4">
          <button
            type="button"
            onClick={() => setMode("pay")}
            className={`flex-1 py-1.5 text-[12px] font-semibold rounded-control transition-all ${
              mode === "pay" ? "bg-surface text-text shadow-xs" : "text-text-secondary"
            }`}
          >
            Bayar Cicilan (Kurangi)
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={`flex-1 py-1.5 text-[12px] font-semibold rounded-control transition-all ${
              mode === "manual" ? "bg-surface text-text shadow-xs" : "text-text-secondary"
            }`}
          >
            Set Sisa Saldo Baru
          </button>
        </div>

        <form onSubmit={handlePaySubmit} className="space-y-4">
          {mode === "pay" ? (
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Nominal yang Dibayarkan (Rp)
              </label>
              <input
                type="number"
                required
                min="1000"
                step="1000"
                placeholder="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[15px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
              {paidAmount && !isNaN(parseFloat(paidAmount)) && (
                <span className="text-[11px] text-text-secondary block mt-1">
                  Sisa utang setelah pembayaran:{" "}
                  <strong>
                    {formatCurrency(
                      Math.max(0, debt.remainingBalance - parseFloat(paidAmount))
                    )}
                  </strong>
                </span>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-[12px] font-semibold text-text mb-1">
                Sisa Utang Terkini (Rp)
              </label>
              <input
                type="number"
                required
                min="0"
                step="1000"
                placeholder="0"
                value={newRemaining}
                onChange={(e) => setNewRemaining(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[15px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
              />
            </div>
          )}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleMarkAsPaidOff}
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-income hover:bg-income/10 text-[12px] font-semibold rounded-control border border-income/30 transition-colors"
            >
              <CheckCircleIcon className="w-3.5 h-3.5" />
              <span>Tandai Lunas</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-3 py-2 text-[13px] font-semibold text-text-secondary hover:text-text rounded-control hover:bg-field transition-colors"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSubmitting ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
