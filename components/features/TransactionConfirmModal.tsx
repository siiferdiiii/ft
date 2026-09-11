"use client";

import React, { useState, useEffect } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { SegmentedControl } from "../ui/SegmentedControl";
import { CategoryBudgetButton } from "./CategoryBudgetButton";
import { WalletDto, CategoryDto, TransactionType, InputSource } from "@/lib/types";

export interface PreFillTransactionData {
  type: TransactionType;
  walletId: string;
  categoryId?: string | null;
  amount: number | null;
  note: string;
  source: InputSource;
  rawInput?: string | null;
  receiptImageUrl?: string | null;
  transactionDate?: string;
}

interface TransactionConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSave?: (data: {
    walletId: string;
    categoryId: string | null;
    type: TransactionType;
    amount: number;
    note: string | null;
    source: InputSource;
    rawInput: string | null;
    receiptImageUrl: string | null;
    transactionDate: string;
  }) => Promise<void> | void;
  wallets: WalletDto[];
  categories: CategoryDto[];
  initialData: PreFillTransactionData | null;
}

export const TransactionConfirmModal: React.FC<TransactionConfirmModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  onSave,
  wallets,
  categories,
  initialData,
}) => {
  const [type, setType] = useState<TransactionType>("EXPENSE");
  const [walletId, setWalletId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [amount, setAmount] = useState<string>("");
  const [note, setNote] = useState<string>("");
  const [transactionDate, setTransactionDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initialData) {
      setType(initialData.type || "EXPENSE");
      setWalletId(initialData.walletId || (wallets[0]?.id ?? ""));
      setCategoryId(initialData.categoryId || null);
      setAmount(initialData.amount ? String(initialData.amount) : "");
      setNote(initialData.note || "");
      if (initialData.transactionDate) {
        setTransactionDate(initialData.transactionDate.slice(0, 10));
      } else {
        setTransactionDate(new Date().toISOString().slice(0, 10));
      }
      setErrorMessage(null);
    }
  }, [initialData, wallets]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const numericAmount = parseFloat(amount.replace(/[^0-9.]/g, ""));
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMessage("Nominal transaksi harus lebih dari 0");
      return;
    }

    const effectiveWalletId = walletId || (wallets[0]?.id ?? "");
    if (!effectiveWalletId) {
      setErrorMessage("Pilih dompet untuk transaksi ini");
      return;
    }

    const payload = {
      walletId: effectiveWalletId,
      categoryId: categoryId || null,
      type,
      amount: numericAmount,
      note: note.trim() || null,
      source: initialData?.source || "MANUAL",
      rawInput: initialData?.rawInput || null,
      receiptImageUrl: initialData?.receiptImageUrl || null,
      transactionDate: new Date(transactionDate).toISOString(),
    };

    // Jika mode Optimistic UI aktif, langsung tutup modal & kirim ke state dashboard (0ms!)
    if (onSave) {
      onClose();
      onSave(payload);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Gagal menyimpan transaksi");
        return;
      }

      onSuccess?.();
      onClose();
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat menyimpan transaksi");
    } finally {
      setIsLoading(false);
    }
  };

  const isVoice = initialData?.source === "VOICE";
  const filteredCategories = categories.filter((c) => c.type === type);

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={onClose}
      title={
        isVoice
          ? "Konfirmasi Suara"
          : initialData?.source === "RECEIPT_SCAN"
          ? "Konfirmasi Resi"
          : "Catat Transaksi"
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 relative">
        {/* Konten formulir yang dapat di-scroll secara bebas */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-28">
          {errorMessage && (
            <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
              {errorMessage}
            </div>
          )}

          {/* Teks suara asli / rawInput untuk verifikasi audit */}
          {initialData?.rawInput && (
            <div className="p-3 bg-field rounded-control border border-border">
              <span className="text-[11px] font-medium text-text-secondary block mb-1">
                Transkrip Suara:
              </span>
              <p className="text-[13px] text-text font-medium italic">
                "{initialData.rawInput}"
              </p>
            </div>
          )}

          {/* Segmented control: Pengeluaran vs Pemasukan - HANYA JIKA MANUAL */}
          {!isVoice && (
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Arah Transaksi
              </label>
              <SegmentedControl value={type} onChange={setType} />
            </div>
          )}

          {/* Nominal jumlah hero input */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Jumlah (Rp)
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                required
                className={`w-full bg-field text-[22px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none ${
                  type === "INCOME" ? "text-income" : "text-text"
                }`}
              />
            </div>
          </div>

          {/* Pilihan Kategori */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[12px] font-medium text-text-secondary">
                Kategori {isVoice && (type === "INCOME" ? "(Pemasukan)" : "(Pengeluaran)")}
              </label>
              {isVoice && (
                <span className="text-[11px] text-text-secondary">
                  Otomatis disesuaikan
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto">
              {filteredCategories.map((c) => (
                <CategoryBudgetButton
                  key={c.id}
                  category={c}
                  isSelected={categoryId === c.id}
                  onSelect={(cat) => setCategoryId(cat.id)}
                />
              ))}
              {filteredCategories.length === 0 && (
                <span className="text-[12px] text-text-secondary py-1">
                  Belum ada kategori untuk tipe ini
                </span>
              )}
            </div>
          </div>

          {/* Catatan / Merchant */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Catatan / Merchant
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contoh: Kopi Kenangan, Makan Siang"
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-2.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          {/* Tanggal */}
          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Tanggal Transaksi
            </label>
            <input
              type="date"
              value={transactionDate}
              onChange={(e) => setTransactionDate(e.target.value)}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-2.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>
        </div>

        {/* Tombol Konfirmasi Posisinya ABSOLUT di atas Navbar, Tidak Pernah Tenggelam */}
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)]">
          <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
            Simpan Transaksi
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
};
