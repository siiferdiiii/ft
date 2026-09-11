"use client";

import React, { useState, useRef } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { CameraIcon } from "../ui/Icons";
import { PreFillTransactionData } from "./TransactionConfirmModal";

interface ReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onParsedResult: (data: PreFillTransactionData) => void;
  activeWalletId: string;
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onParsedResult,
  activeWalletId,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = "";
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/receipts/parse", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Gagal memindai resi");
        setIsLoading(false);
        return;
      }

      onParsedResult({
        type: "EXPENSE",
        walletId: activeWalletId,
        amount: json.data.amount || null,
        note: json.data.note || "Resi Pembelian",
        source: "RECEIPT_SCAN",
        receiptImageUrl: json.data.receiptImageUrl || null,
        transactionDate: json.data.transactionDate,
      });
      onClose();
    } catch {
      setErrorMessage("Terjadi gangguan koneksi saat mengunggah foto resi");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Pindai Resi Pembelian">
      <div className="flex flex-col items-center py-4 space-y-4">
        {errorMessage && (
          <div className="w-full p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
            {errorMessage}
          </div>
        )}

        <div className="w-20 h-20 rounded-full bg-chip text-primary flex items-center justify-center">
          <CameraIcon className="w-10 h-10" />
        </div>

        <div className="text-center">
          <h3 className="text-[16px] font-bold text-text mb-1">
            Unggah atau Foto Struk
          </h3>
          <p className="text-[13px] text-text-secondary max-w-xs">
            Sistem OCR akan mendeteksi total harga, merchant, dan tanggal dari resi Anda secara otomatis.
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-full space-y-2 pt-3">
          <Button
            type="button"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? "Membaca Resi..." : "Ambil Foto / Pilih dari Galeri"}
          </Button>

          <Button
            type="button"
            variant="secondary"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            Batal
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
};
