"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { WalletDto } from "@/lib/types";
import { formatCurrency, formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  wallets: WalletDto[];
}

export const TransferModal: React.FC<TransferModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  wallets,
}) => {
  const [fromWalletId, setFromWalletId] = useState<string>(wallets[0]?.id || "");
  const [toWalletId, setToWalletId] = useState<string>(wallets[1]?.id || "");
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setFromWalletId(wallets[0]?.id || "");
      setToWalletId(wallets[1]?.id || "");
      setAmount("");
      setNote("");
      setErrorMessage(null);
    }
  }, [isOpen, wallets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = parseCurrencyInput(amount);
    if (numericAmount <= 0) {
      setErrorMessage("Nominal transfer harus lebih dari 0");
      return;
    }

    if (!fromWalletId || !toWalletId) {
      setErrorMessage("Pilih dompet asal dan tujuan");
      return;
    }

    if (fromWalletId === toWalletId) {
      setErrorMessage("Dompet asal dan tujuan tidak boleh sama");
      return;
    }

    const sourceWallet = wallets.find((w) => w.id === fromWalletId);
    if (sourceWallet && sourceWallet.balance < numericAmount) {
      setErrorMessage(
        `Saldo ${sourceWallet.name} tidak mencukupi (${formatCurrency(sourceWallet.balance)})`
      );
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/transfers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromWalletId,
          toWalletId,
          amount: numericAmount,
          note: note.trim() || null,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Gagal melakukan transfer");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat memproses transfer");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Transfer Antar Dompet">
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-28">
          {errorMessage && (
            <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Dompet Asal
            </label>
            <select
              value={fromWalletId}
              onChange={(e) => setFromWalletId(e.target.value)}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({formatCurrency(w.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Dompet Tujuan
            </label>
            <select
              value={toWalletId}
              onChange={(e) => setToWalletId(e.target.value)}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            >
              {wallets.map((w) => (
                <option key={w.id} value={w.id} disabled={w.id === fromWalletId}>
                  {w.name} ({formatCurrency(w.balance)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Jumlah Transfer (Rp)
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount}
              onChange={(e) => setAmount(formatCurrencyInput(e.target.value))}
              placeholder="Rp 0"
              required
              className="w-full bg-field text-text text-[22px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Catatan (Opsional)
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Tarik tunai ATM, Top up e-wallet"
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-2.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
            Proses Transfer
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
