"use client";

import React, { useState } from "react";
import { GoalDto, WalletDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { CloseIcon, PlusIcon } from "@/components/ui/Icons";

interface QuickSaveGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  goal: GoalDto | null;
  wallets: WalletDto[];
  onSuccess: () => void;
}

export const QuickSaveGoalModal: React.FC<QuickSaveGoalModalProps> = ({
  isOpen,
  onClose,
  goal,
  wallets,
  onSuccess,
}) => {
  // Hanya dompet yang punya saldo > 0 dan bukan dompet goal itu sendiri
  const eligibleWallets = wallets.filter((w) => w.id !== goal?.walletId && w.balance > 0);

  const [fromWalletId, setFromWalletId] = useState<string>(() => {
    return eligibleWallets[0]?.id || "";
  });
  const [amount, setAmount] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync wallet default jika belum terpilih
  React.useEffect(() => {
    if (eligibleWallets.length > 0 && !fromWalletId) {
      setFromWalletId(eligibleWallets[0].id);
    }
  }, [eligibleWallets, fromWalletId]);

  if (!isOpen || !goal) return null;

  const selectedWallet = wallets.find((w) => w.id === fromWalletId);
  const remainingNeeded = Math.max(0, goal.targetAmount - goal.walletBalance);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericAmount = parseFloat(amount);
    if (!fromWalletId) {
      setErrorMsg("Pilih dompet sumber dana");
      return;
    }
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg("Nominal tabungan harus lebih besar dari 0");
      return;
    }
    if (selectedWallet && numericAmount > selectedWallet.balance) {
      setErrorMsg(
        `Saldo di ${selectedWallet.name} tidak mencukupi (${formatCurrency(selectedWallet.balance)})`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWalletId,
          toWalletId: goal.walletId,
          amount: numericAmount,
          note: `Nabung ke goal: ${goal.name}`,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal mentransfer dana tabungan");
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
            <span className="text-[11px] font-semibold text-primary uppercase tracking-wider block">
              Setor Tabungan
            </span>
            <h2 className="text-[16px] font-bold text-text truncate">
              {goal.name}
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
          {/* Pilih Dompet Asal */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Sumber Dana Dari Dompet
            </label>
            {eligibleWallets.length === 0 ? (
              <p className="text-[12px] text-expense">
                Tidak ada dompet dengan saldo mencukupi. Silakan isi saldo dompet terlebih dahulu.
              </p>
            ) : (
              <select
                value={fromWalletId}
                onChange={(e) => setFromWalletId(e.target.value)}
                className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
              >
                {eligibleWallets.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} ({formatCurrency(w.balance)})
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Nominal Nabung */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[12px] font-semibold text-text">
                Nominal Nabung (Rp)
              </label>
              {remainingNeeded > 0 && (
                <span className="text-[11px] text-text-secondary">
                  Sisa target: {formatCurrency(remainingNeeded)}
                </span>
              )}
            </div>
            <input
              type="number"
              required
              min="1000"
              step="1000"
              placeholder="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[15px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
            />

            {/* Quick chips */}
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {[50000, 100000, 500000].map((nominal) => (
                <button
                  key={nominal}
                  type="button"
                  onClick={() => setAmount(nominal.toString())}
                  className="px-2.5 py-1 bg-field hover:bg-border/60 text-text-secondary text-[11px] font-medium rounded-control border border-border/80 transition-colors"
                >
                  +{formatCurrency(nominal)}
                </button>
              ))}
              {remainingNeeded > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount(remainingNeeded.toString())}
                  className="px-2.5 py-1 bg-primary/10 hover:bg-primary/20 text-primary text-[11px] font-semibold rounded-control border border-primary/20 transition-colors"
                >
                  Genapkan Target
                </button>
              )}
            </div>
          </div>

          {/* Buttons */}
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
              disabled={isSubmitting || eligibleWallets.length === 0}
              className="flex items-center gap-1.5 px-5 py-2 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              <PlusIcon className="w-3.5 h-3.5" />
              <span>{isSubmitting ? "Mentransfer..." : "Nabung Sekarang"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
