"use client";

import React, { useState, useEffect, useRef } from "react";
import { DonutRingChart, HeatmapCalendar } from "@/components/features/StatisticsCharts";
import { BottomNav } from "@/components/ui/BottomNav";
import { StatisticsDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export default function StatisticsPage() {
  const [period, setPeriod] = useState<"monthly" | "weekly">("monthly");
  const [monthOffset, setMonthOffset] = useState<number>(0);
  const [stats, setStats] = useState<StatisticsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [slideDirection, setSlideDirection] = useState<"left" | "right" | null>(null);

  // Touch gesture coordinates for swiping
  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  useEffect(() => {
    const cacheKey = `ft_stats_${period}_${monthOffset}`;

    // 1. Render instan dari cache lokal (0ms Delay)
    if (typeof window !== "undefined") {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setStats(parsed);
          setIsLoading(false);
        } catch {
          // Abaikan
        }
      }
    }

    // 2. Sinkronisasi latar belakang
    const fetchStats = async () => {
      try {
        const res = await fetch(
          `/api/statistics?period=${period}&monthOffset=${monthOffset}`
        );
        const json = await res.json();
        if (json.data) {
          setStats(json.data);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem(cacheKey, JSON.stringify(json.data));
            } catch {
              // Storage quota
            }
          }
        }
      } catch (err) {
        console.error("Gagal memuat statistik:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [period, monthOffset]);

  const handlePrevMonth = () => {
    setSlideDirection("right");
    setMonthOffset((prev) => prev - 1);
  };

  const handleNextMonth = () => {
    if (monthOffset < 0) {
      setSlideDirection("left");
      setMonthOffset((prev) => prev + 1);
    }
  };

  // Touch gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Pastikan swipe horizontal dominan (bukan scroll vertikal)
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY) * 1.3) {
      if (deltaX > 0) {
        // Geser ke kanan -> lihat bulan sebelumnya (PRD update)
        handlePrevMonth();
      } else {
        // Geser ke kiri -> lihat bulan berikutnya (sampai bulan ini)
        handleNextMonth();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-4 select-none"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Analisis Finansial
          </span>
          <h1 className="text-[20px] font-bold text-text">Statistik</h1>
        </div>

        {/* Periode filter toggle */}
        <div className="flex bg-field p-1 rounded-full border border-border">
          <button
            onClick={() => setPeriod("weekly")}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-full transition-all ${
              period === "weekly"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Minggu
          </button>
          <button
            onClick={() => setPeriod("monthly")}
            className={`px-3 py-1.5 text-[12px] font-semibold rounded-full transition-all ${
              period === "monthly"
                ? "bg-primary text-white"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Bulan
          </button>
        </div>
      </div>

      {/* Month Navigator Bar dengan Gestur Swipe & Tombol Panah */}
      <div className="bg-surface p-3 rounded-card-wallet border border-border flex items-center justify-between shadow-none">
        <button
          type="button"
          onClick={handlePrevMonth}
          className="p-2 rounded-control text-text-secondary hover:text-text hover:bg-field active:scale-95 transition-all"
          aria-label="Bulan sebelumnya"
          title="Bulan sebelumnya"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
          </svg>
        </button>

        <div className="flex flex-col items-center">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-text">
              {stats?.monthLabel || "Memuat..."}
            </span>
            {monthOffset !== 0 && (
              <span className="px-1.5 py-0.5 rounded-md bg-chip text-primary text-[10px] font-bold">
                Histori
              </span>
            )}
          </div>
          <span className="text-[10px] text-text-secondary mt-0.5">
            {monthOffset === 0
              ? "👉 Geser kanan untuk bulan sebelumnya"
              : "👈 Geser kiri/kanan untuk ganti bulan"}
          </span>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={monthOffset >= 0}
          className={`p-2 rounded-control transition-all ${
            monthOffset >= 0
              ? "text-border cursor-not-allowed"
              : "text-text-secondary hover:text-text hover:bg-field active:scale-95"
          }`}
          aria-label="Bulan berikutnya"
          title="Bulan berikutnya"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
          </svg>
        </button>
      </div>

      {/* Tombol shortcut kembali ke bulan ini jika sedang melihat histori */}
      {monthOffset !== 0 && (
        <div className="flex justify-end -mt-1">
          <button
            type="button"
            onClick={() => setMonthOffset(0)}
            className="text-[11px] font-semibold text-primary hover:underline"
          >
            ↺ Kembali ke Bulan Ini
          </button>
        </div>
      )}

      {/* Konten Data Statistik dengan Animasi Halus */}
      <div
        key={`${monthOffset}-${period}`}
        className={`space-y-4 transition-all duration-200 ${
          slideDirection === "right"
            ? "animate-in slide-in-from-left-4 fade-in"
            : slideDirection === "left"
            ? "animate-in slide-in-from-right-4 fade-in"
            : "animate-in fade-in"
        }`}
      >
        {/* Ringkasan Arus Kas */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-surface p-4 rounded-card-lg border border-border">
            <span className="text-[11px] font-medium text-text-secondary block mb-1">
              Total Pemasukan
            </span>
            <div className="text-[17px] font-bold text-income truncate">
              {isLoading ? "..." : formatCurrency(stats?.totalIncome || 0)}
            </div>
          </div>
          <div className="bg-surface p-4 rounded-card-lg border border-border">
            <span className="text-[11px] font-medium text-text-secondary block mb-1">
              Total Pengeluaran
            </span>
            <div className="text-[17px] font-bold text-expense truncate">
              {isLoading ? "..." : formatCurrency(stats?.totalExpense || 0)}
            </div>
          </div>
        </div>

        {/* Donut Chart Pengeluaran */}
        <DonutRingChart
          title={`Pengeluaran (${stats?.monthLabel || ""})`}
          total={stats?.totalExpense || 0}
          data={stats?.expenseByCategory || []}
        />

        {/* Donut Chart Pemasukan */}
        <DonutRingChart
          title={`Pemasukan (${stats?.monthLabel || ""})`}
          total={stats?.totalIncome || 0}
          data={stats?.incomeByCategory || []}
        />

        {/* Kalender Heatmap Harian */}
        {stats?.calendarHeatmap && (
          <HeatmapCalendar heatmap={stats.calendarHeatmap} />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
