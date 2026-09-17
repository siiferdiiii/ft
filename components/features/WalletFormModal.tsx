"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { InfinityIcon } from "@/components/ui/Icons";
import { WalletDto, WalletType } from "@/lib/types";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";

interface WalletFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingWallet: WalletDto | null;
  onSave: (data: {
    name: string;
    type: WalletType;
    initialBalance?: number;
    isPerpetualFund: boolean;
    editingId?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  onPerpetualActivated?: () => void;
}

export const WalletFormModal: React.FC<WalletFormModalProps> = ({
  isOpen,
  onClose,
  editingWallet,
  onSave,
  onPerpetualActivated,
}) => {
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("CASH");
  const [initialBalance, setInitialBalance] = useState("");
  const [isPerpetualFund, setIsPerpetualFund] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (editingWallet) {
      setName(editingWallet.name);
      setType(editingWallet.type);
      setInitialBalance("");
      setIsPerpetualFund(Boolean(editingWallet.isPerpetualFund));
      setErrorMessage(null);
    } else {
      setName("");
      setType("CASH");
      setInitialBalance("");
      setIsPerpetualFund(false);
      setErrorMessage(null);
    }
  }, [editingWallet, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Nama dompet wajib diisi");
      return;
    }

    const wasPerpetual = editingWallet ? Boolean(editingWallet.isPerpetualFund) : false;
    const willBePerpetual = isPerpetualFund;

    setIsSaving(true);
    try {
      const bal = parseCurrencyInput(initialBalance);
      const res = await onSave({
        name: name.trim(),
        type,
        initialBalance: editingWallet ? undefined : bal,
        isPerpetualFund: willBePerpetual,
        editingId: editingWallet?.id,
      });

      if (!res.success) {
        setErrorMessage(res.error || "Gagal menyimpan dompet");
        return;
      }

      onClose();

      if (!wasPerpetual && willBePerpetual && onPerpetualActivated) {
        onPerpetualActivated();
      }
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi saat menyimpan dompet");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={editingWallet ? "Edit Dompet" : "Tambah Dompet Baru"}
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
              Nama Dompet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Cash Harian, BCA, GoPay"
              required
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Tipe Dompet
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WalletType)}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="CASH">Tunai (Cash)</option>
              <option value="EWALLET">E-Wallet (GoPay, OVO, ShopeePay)</option>
              <option value="BANK">Rekening Bank</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>

          {!editingWallet && (
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Saldo Awal (Rp)
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={initialBalance}
                onChange={(e) => setInitialBalance(formatCurrencyInput(e.target.value))}
                placeholder="Rp 0"
                className="w-full bg-field text-text text-[20px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          )}

          {/* Toggle Jadikan Dana Abadi per PRD §3.1 */}
          <div className="p-3.5 bg-field rounded-control border border-border flex items-center justify-between">
            <div className="pr-3">
              <span className="text-[13px] font-bold text-text flex items-center gap-1.5">
                <InfinityIcon className="w-4 h-4 text-primary" />
                Jadikan Dana Abadi
              </span>
              <span className="text-[11px] text-text-secondary block mt-0.5 leading-snug">
                Menerima alokasi pemasukan & dilindungi friksi sadar saat pengeluaran.
              </span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
              <input
                type="checkbox"
                checked={isPerpetualFund}
                onChange={(e) => setIsPerpetualFund(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
            </label>
          </div>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
            {editingWallet ? "Simpan Perubahan" : "Buat Dompet"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
