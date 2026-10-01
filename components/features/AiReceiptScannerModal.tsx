"use client";

import React, { useState, useRef, useCallback } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { Button } from "../ui/Button";
import { formatCurrency } from "@/lib/currency";

export interface MultiReceiptItem {
  name: string;
  amount: number;
  quantity?: number;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  // user may edit categoryId after parsing
  categoryId: string | null;
}

export interface MultiReceiptResult {
  merchant: string | null;
  transactionDate: string;
  totalAmount: number;
  items: MultiReceiptItem[];
  receiptImageUrl: string;
  remainingQuota: number;
}

interface AiReceiptScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeWalletId: string;
  categories: Array<{ id: string; name: string; type: string }>;
  ocrQuota: number;
  onSaved: (newBalance: number, remainingQuota: number) => void;
}

export const AiReceiptScannerModal: React.FC<AiReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  activeWalletId,
  categories,
  ocrQuota,
  onSaved,
}) => {
  const [phase, setPhase] = useState<"upload" | "review" | "saving">("upload");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [result, setResult] = useState<MultiReceiptResult | null>(null);
  const [items, setItems] = useState<MultiReceiptItem[]>([]);
  const [merchant, setMerchant] = useState("");
  const [txDate, setTxDate] = useState("");

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const expenseCategories = categories.filter((c) => c.type === "EXPENSE");

  const handleClose = () => {
    setPhase("upload");
    setIsLoading(false);
    setProgress("");
    setErrorMessage(null);
    setResult(null);
    setItems([]);
    setMerchant("");
    setTxDate("");
    onClose();
  };

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setErrorMessage(null);
    setIsLoading(true);
    setProgress("Mengirim gambar ke AI...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      setProgress("Membaca rincian struk dengan AI... (10-20 detik)");
      const res = await fetch("/api/receipts/parse-multi", {
        method: "POST",
        body: formData,
      });

      const json = await res.json();

      if (!res.ok || json.error) {
        const errMsg = json.error?.message || "Gagal memproses struk dengan AI.";
        setErrorMessage(errMsg);
        setIsLoading(false);
        setProgress("");
        return;
      }

      const data: MultiReceiptResult = json.data;
      setResult(data);
      setMerchant(data.merchant || "");
      setTxDate(
        new Date(data.transactionDate).toISOString().split("T")[0] ||
          new Date().toISOString().split("T")[0]
      );
      // Initialize items with suggestedCategoryId filled in
      setItems(
        data.items.map((item) => ({
          ...item,
          categoryId: item.suggestedCategoryId,
        }))
      );
      setPhase("review");
    } catch (err) {
      console.warn("AI OCR error:", err);
      setErrorMessage("Koneksi bermasalah. Pastikan internet aktif dan coba lagi.");
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  }, []);

  const handleSave = async () => {
    if (!result || items.length === 0) return;
    setPhase("saving");
    try {
      const res = await fetch("/api/transactions/multi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletId: activeWalletId,
          merchant: merchant || null,
          note: merchant ? `Belanja di ${merchant}` : "Belanja Multi-Item",
          receiptImageUrl: result.receiptImageUrl || null,
          transactionDate: txDate ? new Date(txDate).toISOString() : new Date().toISOString(),
          items: items.map((item) => ({
            note: item.name,
            amount: item.amount,
            categoryId: item.categoryId || null,
          })),
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Gagal menyimpan transaksi.");
        setPhase("review");
        return;
      }

      onSaved(json.data.newBalance, result.remainingQuota);
      handleClose();
    } catch {
      setErrorMessage("Terjadi kesalahan saat menyimpan. Coba lagi.");
      setPhase("review");
    }
  };

  const updateItemCategory = (idx: number, categoryId: string) => {
    setItems((prev) =>
      prev.map((item, i) => (i === idx ? { ...item, categoryId } : item))
    );
  };

  const updateItemAmount = (idx: number, amount: string) => {
    const parsed = parseInt(amount.replace(/[^0-9]/g, ""), 10);
    if (!isNaN(parsed)) {
      setItems((prev) =>
        prev.map((item, i) => (i === idx ? { ...item, amount: parsed } : item))
      );
    }
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const totalItems = items.reduce((sum, item) => sum + item.amount, 0);

  return (
    <BottomSheet isOpen={isOpen} onClose={handleClose} title="Scan Resi AI Multi-Item">
      <div className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-4 pb-44 space-y-4">

          {/* Phase: Upload */}
          {phase === "upload" && (
            <>
              {/* Quota info */}
              <div className={`flex items-center gap-3 p-3.5 rounded-control ${
                ocrQuota > 0 ? "bg-primary/5 border border-primary/20" : "bg-expense/5 border border-expense/20"
              }`}>
                <div className={`text-[22px] font-bold ${ocrQuota > 0 ? "text-primary" : "text-expense"}`}>
                  {ocrQuota}
                </div>
                <div>
                  <div className={`text-[12px] font-bold ${ocrQuota > 0 ? "text-primary" : "text-expense"}`}>
                    {ocrQuota > 0 ? `${ocrQuota} Kuota Scan Tersisa` : "Kuota Habis"}
                  </div>
                  <div className="text-[11px] text-text-secondary">
                    {ocrQuota > 0
                      ? "1 kuota digunakan setiap kali scan"
                      : "Beli paket di Halaman Profil untuk mengisi ulang"}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-expense/10 text-expense text-[12px] font-medium rounded-control">
                  {errorMessage}
                </div>
              )}

              <div className="flex flex-col items-center py-4 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-[16px] font-bold text-text mb-1">Scan Struk dengan AI</h3>
                  <p className="text-[12px] text-text-secondary max-w-xs mx-auto">
                    AI akan membaca seluruh item produk, harga, nama toko, dan menyarankan kategori secara otomatis.
                  </p>
                </div>
              </div>

              {isLoading && (
                <div className="bg-chip rounded-control p-4 text-center">
                  <div className="text-[13px] font-medium text-primary animate-pulse">{progress}</div>
                  <div className="mt-2 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full animate-pulse w-3/4 transition-all" />
                  </div>
                </div>
              )}

              <input ref={cameraInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                capture="environment" onChange={handleFileChange} className="hidden" />
              <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp"
                onChange={handleFileChange} className="hidden" />
            </>
          )}

          {/* Phase: Review */}
          {phase === "review" && result && (
            <>
              {errorMessage && (
                <div className="p-3 bg-expense/10 text-expense text-[12px] font-medium rounded-control">
                  {errorMessage}
                  <button onClick={() => setErrorMessage(null)} className="ml-2 font-bold">✕</button>
                </div>
              )}

              {/* Merchant & Tanggal */}
              <div className="bg-surface rounded-card-lg border border-border p-4 space-y-3">
                <div>
                  <label className="text-[11px] font-medium text-text-secondary block mb-1.5">
                    Nama Toko / Merchant
                  </label>
                  <input
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    placeholder="Indomaret, Superindo, dsb..."
                    className="w-full bg-field text-text text-[13px] px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-text-secondary block mb-1.5">
                    Tanggal Transaksi
                  </label>
                  <input
                    type="date"
                    value={txDate}
                    onChange={(e) => setTxDate(e.target.value)}
                    className="w-full bg-field text-text text-[13px] px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                  />
                </div>
              </div>

              {/* Daftar Item */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[12px] font-bold text-text-secondary uppercase tracking-wide">
                    Rincian Item ({items.length})
                  </p>
                  <p className="text-[12px] font-semibold text-expense">
                    Total: {formatCurrency(totalItems)}
                  </p>
                </div>
                <div className="space-y-2">
                  {items.map((item, idx) => (
                    <div key={idx} className="bg-surface rounded-card-lg border border-border p-3.5">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-semibold text-text truncate">{item.name}</p>
                          {item.suggestedCategoryName && item.categoryId === item.suggestedCategoryId && (
                            <p className="text-[10px] text-primary mt-0.5">
                              💡 AI sarankan: {item.suggestedCategoryName}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => removeItem(idx)}
                          className="text-expense text-[11px] font-semibold flex-shrink-0 hover:opacity-70"
                        >
                          Hapus
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-text-secondary font-medium block mb-1">Harga</label>
                          <input
                            type="number"
                            value={item.amount}
                            onChange={(e) => updateItemAmount(idx, e.target.value)}
                            className="w-full bg-field text-text text-[12px] px-2.5 py-1.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-text-secondary font-medium block mb-1">Kategori</label>
                          <select
                            value={item.categoryId || ""}
                            onChange={(e) => updateItemCategory(idx, e.target.value)}
                            className="w-full bg-field text-text text-[12px] px-2 py-1.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                          >
                            <option value="">— Pilih —</option>
                            {expenseCategories.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Kuota sisa info */}
              <p className="text-[11px] text-text-secondary text-center">
                Setelah simpan, kuota scan tersisa:{" "}
                <strong className="text-primary">{result.remainingQuota}</strong>
              </p>
            </>
          )}

          {phase === "saving" && (
            <div className="flex flex-col items-center py-10 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                <svg className="w-6 h-6 text-primary animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
              <p className="text-[14px] font-medium text-text">Menyimpan transaksi...</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-6 pt-3 bg-background border-t border-border">
          {phase === "upload" && !isLoading && (
            <div className="space-y-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={ocrQuota <= 0}
                onClick={() => cameraInputRef.current?.click()}
              >
                📷 Foto Struk
              </Button>
              <Button
                variant="secondary"
                className="w-full"
                disabled={ocrQuota <= 0}
                onClick={() => fileInputRef.current?.click()}
              >
                🖼 Pilih dari Galeri
              </Button>
            </div>
          )}
          {phase === "review" && (
            <div className="space-y-2">
              <Button
                variant="primary"
                className="w-full"
                disabled={items.length === 0}
                onClick={handleSave}
              >
                Simpan {items.length} Transaksi
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => setPhase("upload")}>
                Ulangi Scan
              </Button>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
};
