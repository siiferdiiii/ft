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
 * Preprocess gambar untuk OCR: resize + grayscale + tingkatkan kontras.
 * Ini meningkatkan akurasi Tesseract.js secara drastis.
 */
function preprocessImageForOCR(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1600;
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

      // Gambar asli
      ctx.drawImage(img, 0, 0, w, h);

      // Ambil pixel data untuk preprocessing
      const imageData = ctx.getImageData(0, 0, w, h);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        // Convert ke grayscale
        const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        // Tingkatkan kontras (threshold-based binarization untuk teks)
        const val = gray > 140 ? 255 : 0;
        data[i] = val;
        data[i + 1] = val;
        data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);

      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Canvas toBlob failed")),
        "image/png" // PNG tanpa kompresi agar teks tajam
      );
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

/**
 * Parsing teks resi untuk mengeluarkan amount, merchant, dan tanggal.
 * Logika parsing yang lebih cerdas — prioritaskan "Total" di atas "Rp" standalone.
 */
function parseReceiptText(text: string) {
  let amount: number | null = null;
  let merchant: string | null = null;
  let txDate: string | null = null;

  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);

  // === MERCHANT DETECTION ===
  // Cari nama toko/merchant — biasanya ada kata kunci tertentu
  const merchantKeywords = /(?:toko|oleh|penjual|merchant|store|shop|galeri|seller|outlet)/i;
  for (const line of lines) {
    if (merchantKeywords.test(line)) {
      // Bersihkan karakter aneh, ambil text setelah keyword
      const cleaned = line
        .replace(/[^\w\s\-&.]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (cleaned.length > 3 && cleaned.length < 60) {
        merchant = cleaned;
        break;
      }
    }
  }

  // Fallback: cari baris pertama yang punya ≥2 huruf kapital berturut & panjang wajar
  if (!merchant) {
    for (const line of lines.slice(0, 5)) {
      const cleaned = line.replace(/[^\w\s\-&.]/g, " ").replace(/\s+/g, " ").trim();
      // Skip baris yang cuma angka, atau terlalu pendek
      if (cleaned.length > 3 && cleaned.length < 50 && /[A-Za-z]{2,}/.test(cleaned)) {
        // Skip baris yang terlihat seperti harga/angka
        if (!/^\d/.test(cleaned) && !/^rp/i.test(cleaned)) {
          merchant = cleaned;
          break;
        }
      }
    }
  }

  // === AMOUNT DETECTION ===
  // Prioritas 1: "Total" diikuti angka (paling akurat untuk resi)
  const totalPatterns = [
    /(?:grand\s*total|total\s*(?:bayar|belanja|pembayaran|pesanan|harga|akhir|semua|order|payment))\s*[:.\-=]?\s*(?:rp\.?\s*)?([0-9][0-9.,]*)/i,
    /(?:total\s*\d+\s*produk)\s*[:.\-=]?\s*(?:rp\.?\s*)?([0-9][0-9.,]*)/i,
    /(?:total)\s*[:.\-=]?\s*(?:rp\.?\s*)?([0-9][0-9.,]*)/i,
  ];

  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const clean = match[1].replace(/[^\d]/g, "");
      const val = parseInt(clean, 10);
      if (val > 0 && val < 1000000000) {
        amount = val;
        break;
      }
    }
  }

  // Prioritas 2: "Rp" + angka (bukan bagian dari item list, ambil yang paling besar)
  if (!amount) {
    const rpRegex = /rp\.?\s*([0-9][0-9.,]*)/gi;
    const amounts: number[] = [];
    let rpMatch;
    while ((rpMatch = rpRegex.exec(text)) !== null) {
      const clean = rpMatch[1].replace(/[^\d]/g, "");
      const val = parseInt(clean, 10);
      if (val >= 500 && val < 100000000) {
        amounts.push(val);
      }
    }
    // Ambil angka terbesar (biasanya total)
    if (amounts.length > 0) {
      amount = Math.max(...amounts);
    }
  }

  // Prioritas 3: Angka terbesar yang masuk akal
  if (!amount) {
    const numberRegex = /\b(\d{1,3}(?:[.,]\d{3})+|\d{4,})\b/g;
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

  // === DATE DETECTION ===
  // Format: DD/MM/YYYY, DD-MM-YYYY, DD MM YYYY
  const dateRegex = /\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b/;
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

  // Fallback tanggal: cari nama bulan Indonesia
  if (!txDate) {
    const bulanMap: Record<string, string> = {
      jan: "01", feb: "02", mar: "03", apr: "04", mei: "05", jun: "06",
      jul: "07", agu: "08", aug: "08", sep: "09", okt: "10", oct: "10",
      nov: "11", des: "12", dec: "12",
    };
    const bulanRegex = /(\d{1,2})\s*(jan|feb|mar|apr|mei|jun|jul|agu|aug|sep|okt|oct|nov|des|dec)\w*\s*(\d{2,4})?/i;
    const bulanMatch = text.match(bulanRegex);
    if (bulanMatch) {
      const day = bulanMatch[1].padStart(2, "0");
      const monthKey = bulanMatch[2].toLowerCase().slice(0, 3);
      const month = bulanMap[monthKey] || "01";
      const year = bulanMatch[3]?.length === 2 ? `20${bulanMatch[3]}` : bulanMatch[3] || new Date().getFullYear().toString();
      const parsedDate = new Date(`${year}-${month}-${day}`);
      if (!isNaN(parsedDate.getTime())) {
        txDate = parsedDate.toISOString();
      }
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
      // 1. Preprocess: resize + grayscale + binarize untuk OCR lebih akurat
      const processed = await preprocessImageForOCR(file);

      setProgress("Memuat OCR engine...");

      // 2. Jalankan Tesseract.js di browser (Web Worker)
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker(["eng", "ind"], undefined, {
        logger: (m: { status: string; progress: number }) => {
          if (m.status === "recognizing text") {
            setProgress(`Membaca resi... ${Math.round(m.progress * 100)}%`);
          }
        },
      });

      setProgress("Membaca resi...");
      const ret = await worker.recognize(processed);
      const text = ret.data.text;
      await worker.terminate();

      // 3. Parse hasil OCR
      const { amount, merchant, txDate } = parseReceiptText(text);

      // 4. Buat preview URL dari gambar asli
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
