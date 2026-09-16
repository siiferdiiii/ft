"use client";

import React, { useState, useEffect } from "react";
import { CategoryDto } from "@/lib/types";

const DISMISS_KEY = "ft_interview_banner_dismissed";

interface BudgetInterviewBannerProps {
  categories: CategoryDto[];
  onStartInterview: () => void;
}

// Banner non-blocking yang muncul otomatis untuk user baru yang belum punya budget apapun.
// Dismiss disimpan di sessionStorage - muncul kembali hanya di sesi baru (PRD §2.1).
export const BudgetInterviewBanner: React.FC<BudgetInterviewBannerProps> = ({
  categories,
  onStartInterview,
}) => {
  const [isDismissed, setIsDismissed] = useState(true); // default hidden, cek storage dulu

  useEffect(() => {
    // Cek apakah sudah di-dismiss di sesi ini
    const dismissed = sessionStorage.getItem(DISMISS_KEY);
    setIsDismissed(dismissed === "true");
  }, []);

  // Hanya tampil jika semua kategori belum punya budgetLimit
  const hasAnyBudget = categories.some((c) => c.type === "EXPENSE" && c.budgetLimit !== null);
  const hasExpenseCategory = categories.some((c) => c.type === "EXPENSE");

  if (isDismissed || hasAnyBudget || !hasExpenseCategory) return null;

  const handleDismiss = () => {
    sessionStorage.setItem(DISMISS_KEY, "true");
    setIsDismissed(true);
  };

  return (
    <div className="bg-chip border border-primary/20 rounded-[16px] px-4 py-3.5 flex items-start gap-3">
      {/* Ikon AI */}
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="5.5" width="12" height="8" rx="2.5" fill="#4E44E5" opacity="0.2"/>
          <rect x="5.5" y="3" width="7" height="5" rx="2" fill="#4E44E5"/>
          <circle cx="7.5" cy="5.5" r="1" fill="white"/>
          <circle cx="10.5" cy="5.5" r="1" fill="white"/>
          <path d="M6.5 8.5h5" stroke="#4E44E5" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-text">Budget belum diatur</p>
        <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
          Biar Fin bantu susunkan budget bulananmu lewat percakapan singkat.
        </p>
        <button
          type="button"
          onClick={onStartInterview}
          className="mt-2 text-[12px] font-semibold text-primary"
          id="btn-banner-start-interview"
        >
          Susun Budget dengan AI →
        </button>
      </div>

      {/* Dismiss */}
      <button
        type="button"
        onClick={handleDismiss}
        className="p-1 text-text-secondary hover:text-text flex-shrink-0"
        aria-label="Tutup banner"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M11 3L3 11M3 3l8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
};
