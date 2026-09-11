"use client";

import React, { useState, useRef, useCallback } from "react";
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

/**
 * Resize gambar di canvas agar lebih kecil & cepat diproses OCR.
 * Target: max 1200px sisi terpanjang, JPEG quality 0.7
 */
function resizeImageForOCR(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1200;
      let w = img.width;
      let h = img.height;
      if (w > MAX || h > MAX) {
        if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
        else { w = Math.round(w * MAX / h); h = MAX; }
      }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, w, h);
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
        "image/jpeg",
        0.7
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/**
 * Parsing teks resi untuk mengeluarkan amount, merchant, dan tanggal.
 * Sama persis logikanya dengan versi server sebelumnya.
 */
function parseReceiptText(text: string) {
  let amount: number | null = null;
  let merchant: string | null = null;
  let txDate: string | null = null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // Merchant biasanya di 1-2 baris pertama
  if (lines.length > 0) {
    const firstLine = lines[0].replace(/[^\w\s]/g, "").trim();
    if (firstLine.length > 2 && firstLine.length < 40) {
      merchant = firstLine;
    }
  }

  // Cari pola TOTAL / JUMLAH / RP
  const totalRegex = /(?:total|jumlah|grand total|rp|subtotal)\s*[:.=]?\s*([0-9.,]+)/i;
  const numberRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/g;

  const totalMatch = text.match(totalRegex);
  if (totalMatch && totalMatch[1]) {
    const clean = totalMatch[1].replace(/[^\d]/g, "");
    const val = parseInt(clean, 10);
    if (val > 0 && val < 1000000000) {
      amount = val;
    }
  }

  if (!amount) {
    const allNumbers: number[] = [];
    let match;
    while ((match = numberRegex.exec(text)) !== null) {
      const clean = match[1].replace(/[^\d]/g, "");
      const val = parseInt(clean, 10);
      if (val >= 1000 && val < 100000000) {
        allNumbers.push(val);
      }
    }
    if (allNumbers.length > 0) {
      amount = Math.max(...allNumbers);
    }
  }

  // Cari pola tanggal
  const dateRegex = /\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/;
  const dateMatch = text.match(dateRegex);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, "0");
    const month = dateMatch[2].padStart(2, "0");
    let year = dateMatch[3];
    if (year.length === 2) year = `20${year}`;
    const parsedDate = new Date(`${year}-${month}-${day}`);
    if (!isNaN(parsedDate.getTime())) {
      txDate = parsedDate.toISOString();
    }
  }

  return { amount, merchant, txDate };
}

export const ReceiptScannerModal: React.FC<ReceiptScannerModalProps> = ({
  isOpen,
  onClose,
  onParsedResult,
  activeWalletId,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input
    e.target.value = "";
    setErrorMessage(null);
    setIsLoading(true);
    setProgress("Mempersiapkan gambar...");

    try {
      // 1. Resize gambar dulu agar OCR lebih cepat
      const resized = await resizeImageForOCR(file);

      setProgress("Memuat OCR engine...");

      // 2. Jalankan Tesseract.js langsung di browser (Web Worker — tidak blocking UI)
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng", undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setProgress(`Membaca resi... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      setProgress("Membaca resi...");
      const ret = await worker.recognize(resized);
      const text = ret.data.text;
      await worker.terminate();

      // 3. Parse hasil OCR
      const { amount, merchant, txDate } = parseReceiptText(text);

      // 4. Buat data URI preview dari gambar asli (bukan resized)
      const previewUrl = URL.createObjectURL(file);

      onParsedResult({
        type: "EXPENSE",
        walletId: activeWalletId,
        amount: amount || null,
        note: merchant || "Resi Pembelian",
        source: "RECEIPT_SCAN",
        receiptImageUrl: previewUrl,
        transactionDate: txDate || new Date().toISOString(),
      });
      onClose();
    } catch (err) {
      console.warn("Client-side OCR error:", err);
      setErrorMessage("Gagal membaca resi. Coba lagi dengan gambar yang lebih jelas.");
    } finally {
      setIsLoading(false);
      setProgress("");
    }
  }, [activeWalletId, onClose, onParsedResult]);

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Pindai Resi Pembelian">
      <div className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-6 flex flex-col items-center space-y-4 pb-36 text-center">
          {errorMessage && (
            <div className="w-full p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control text-left">
              {errorMessage}
            </div>
          )}

          <div className="w-20 h-20 rounded-full bg-chip text-primary flex items-center justify-center mt-2">
            <CameraIcon className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-[16px] font-bold text-text mb-1">
              Unggah atau Foto Struk
            </h3>
            <p className="text-[13px] text-text-secondary max-w-xs mx-auto">
              Sistem OCR akan mendeteksi total harga, merchant, dan tanggal dari resi Anda secara otomatis.
            </p>
          </div>

          {/* Progress indicator */}
          {isLoading && progress && (
            <div className="w-full bg-chip rounded-full h-8 flex items-center justify-center">
              <p className="text-[13px] font-medium text-primary animate-pulse">
                {progress}
              </p>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-4 bg-surface/95 backdrop-blur-md border-t border-border z-30 shadow-[0_-4px_16px_rgba(0,0,0,0.08)] space-y-2">
          <Button
            type="button"
            variant="primary"
            fullWidth
            isLoading={isLoading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isLoading ? progress || "Membaca Resi..." : "Ambil Foto / Pilih dari Galeri"}
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
