"use client";

import React, { useState, useEffect } from "react";
import { PRODUCT_PACKAGES, ProductPackage } from "@/lib/constants/products";
import { formatCurrency } from "@/lib/currency";
import { CloseIcon } from "../ui/Icons";

export type QuotaTriggerSource = "ocr_empty" | "ocr_low" | "budget_empty";

interface QuotaPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  triggerSource: QuotaTriggerSource;
  userCode?: string | null;
}

export const QuotaPaywallModal: React.FC<QuotaPaywallModalProps> = ({
  isOpen,
  onClose,
  triggerSource,
  userCode: propUserCode,
}) => {
  const [userCode, setUserCode] = useState<string | null>(propUserCode || null);
  const [selectedPkg, setSelectedPkg] = useState<ProductPackage>(() => {
    return PRODUCT_PACKAGES.find((p) => p.popular) || PRODUCT_PACKAGES[0];
  });
  const [isCopiedAndProceeding, setIsCopiedAndProceeding] = useState(false);

  // Jika userCode belum tersedia via props, coba fetch cepat dari profile
  useEffect(() => {
    if (propUserCode) {
      setUserCode(propUserCode);
      return;
    }
    if (isOpen && !userCode) {
      fetch("/api/user/profile")
        .then((res) => res.json())
        .then((json) => {
          if (json.data?.userCode) setUserCode(json.data.userCode);
        })
        .catch(() => {});
    }
  }, [isOpen, propUserCode, userCode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCopiedAndProceeding) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose, isCopiedAndProceeding]);

  if (!isOpen) return null;

  const handleBuyAndProceed = async () => {
    if (!selectedPkg) return;
    if (userCode) {
      try {
        await navigator.clipboard.writeText(userCode);
      } catch {
        // Fallback jika permission clipboard diblokir
      }
    }
    setIsCopiedAndProceeding(true);
    setTimeout(() => {
      window.open(selectedPkg.lynkUrl, "_blank", "noopener,noreferrer");
      setIsCopiedAndProceeding(false);
      onClose();
    }, 700);
  };

  // Copywriting kontekstual sesuai triggerSource
  const getHeaderInfo = () => {
    switch (triggerSource) {
      case "ocr_empty":
        return {
          badge: "⚡ Tanpa Ketik Manual",
          title: "Kuota Scan AI Anda Habis",
          desc: "Hindari lelah mengetik puluhan nota belanjaan. Isi kuota sekarang agar semua item & diskon tercatat instan.",
        };
      case "ocr_low":
        return {
          badge: "🎉 Transaksi Sukses",
          title: "Sisa Kuota Scan AI Tinggal Sedikit",
          desc: "Struk belanja berhasil disimpan. Amankan kuota tambahan sekarang agar pencatatan belanja berikutnya tidak terhenti.",
        };
      case "budget_empty":
        return {
          badge: "🤖 Konsultasi Fin AI",
          title: "Kuota Susun Budget Habis",
          desc: "Buka sesi evaluasi keuangan interaktif bersama Fin dan dapatkan juga bonus puluhan kuota scan struk belanja.",
        };
    }
  };

  const header = getHeaderInfo();

  // Urutkan paket: Populer ditaruh di awal
  const sortedPackages = [...PRODUCT_PACKAGES].sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-[#0D0D17]/70 backdrop-blur-sm transition-opacity"
        onClick={() => !isCopiedAndProceeding && onClose()}
        aria-hidden="true"
      />

      {/* Sheet Container */}
      <div className="relative z-10 w-full max-w-md max-h-[90vh] bg-surface rounded-t-sheet flex flex-col border-t border-border animate-in slide-in-from-bottom duration-200 shadow-2xl overflow-hidden">
        {/* Grabber handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header */}
        <div className="px-5 pt-2 pb-3 border-b border-border flex items-start justify-between flex-shrink-0">
          <div>
            <span className="inline-block text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-1">
              {header.badge}
            </span>
            <h2 className="text-[17px] font-bold text-text leading-tight">{header.title}</h2>
            <p className="text-[11px] text-text-secondary mt-1 leading-relaxed">
              {header.desc}
            </p>
          </div>
          <button
            type="button"
            onClick={() => !isCopiedAndProceeding && onClose()}
            className="p-1 rounded-full text-text-secondary hover:text-text hover:bg-field transition-colors ml-2 -mt-1"
            aria-label="Tutup"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content Area - Scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          <p className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">
            Pilih Paket Kuota (Permanen Tanpa Masa Hangus)
          </p>

          <div className="space-y-2.5">
            {sortedPackages.map((pkg) => {
              const isSelected = selectedPkg.id === pkg.id;
              const pricePerScan = Math.round(pkg.price / pkg.ocrQuota);
              const isPopular = pkg.popular;

              return (
                <div
                  key={pkg.id}
                  onClick={() => setSelectedPkg(pkg)}
                  className={`p-3.5 rounded-control border cursor-pointer transition-all relative ${
                    isSelected
                      ? "border-2 border-primary bg-primary/[0.03] shadow-[0_4px_16px_rgba(78,68,229,0.12)]"
                      : "border-border bg-surface hover:border-primary/30"
                  }`}
                >
                  {isPopular && (
                    <div className="absolute top-0 right-0 bg-primary text-white text-[9px] font-bold px-2.5 py-0.5 rounded-bl-control">
                      ⭐ Terlaris • Hemat 16%
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2.5">
                      {/* Radio Circle */}
                      <div className="mt-0.5">
                        <div
                          className={`w-4 h-4 rounded-full border flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-primary bg-primary text-white"
                              : "border-text-secondary/40 bg-surface"
                          }`}
                        >
                          {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[14px] font-bold text-text">{pkg.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] font-semibold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                            📷 {pkg.ocrQuota}x Scan AI
                          </span>
                          <span className="text-[10px] font-semibold bg-income/10 text-income px-2 py-0.5 rounded-full">
                            🤖 {pkg.aiBudgetQuota}x Budget
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[15px] font-bold text-text">
                        {formatCurrency(pkg.price)}
                      </div>
                      <div className="text-[10px] font-medium text-text-secondary mt-0.5">
                        Rp{pricePerScan.toLocaleString("id-ID")}/scan
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* User Code Box & Notice */}
          <div className="bg-field border border-primary/20 rounded-control p-3 flex items-center justify-between gap-3 mt-3">
            <div className="min-w-0">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-wider block">
                ID Akun Anda (Wajib untuk Catatan Lynk.id)
              </span>
              <span className="text-[16px] font-bold text-primary font-mono tracking-wider block truncate">
                {userCode || "FT-XXXXX"}
              </span>
            </div>
            <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2.5 py-1 rounded-full shrink-0">
              ⚡ Otomatis Disalin
            </span>
          </div>
        </div>

        {/* Footer Action */}
        <div className="px-5 py-3.5 bg-background border-t border-border flex-shrink-0 space-y-2">
          <button
            type="button"
            id="btn-paywall-checkout"
            onClick={handleBuyAndProceed}
            disabled={isCopiedAndProceeding}
            className="w-full bg-primary text-white text-[13px] font-bold py-3.5 rounded-control active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_6px_20px_rgba(78,68,229,0.35)] disabled:opacity-80"
          >
            {isCopiedAndProceeding ? (
              <>
                <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>ID Tersalin! Menuju Pembayaran...</span>
              </>
            ) : (
              <span>
                Salin ID & Bayar {selectedPkg.name} ({formatCurrency(selectedPkg.price)}) →
              </span>
            )}
          </button>
          <p className="text-[10px] text-text-secondary text-center">
            Pembayaran via QRIS, GoPay, ShopeePay, & Virtual Bank di Lynk.id
          </p>
        </div>
      </div>
    </div>
  );
};
