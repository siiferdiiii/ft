"use client";

import React, { useState, useEffect, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { formatCurrency } from "@/lib/currency";
import { InfinityIcon, ShieldIcon, TrendingUpIcon } from "../ui/Icons";

interface SimulatorBSustainabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialRealBalance: number; // Dana saat ini di akun
  initialMonthlySavings?: number; // Alokasi bulanan simulasi 25 tahun
  initialAnnualExpense?: number; // Total pengeluaran 12 bulan terakhir
  savedSimulatedAmount?: number; // Nominal yang diinvestasikan dari Simulator A (Rp 2.818.269.939)
}

export const SimulatorBSustainabilityModal: React.FC<SimulatorBSustainabilityModalProps> = ({
  isOpen,
  onClose,
  initialRealBalance,
  initialMonthlySavings = 300000,
  initialAnnualExpense = 36000000,
  savedSimulatedAmount,
}) => {
  const currentRealBalance = Math.max(0, initialRealBalance || 0);

  // Inisialisasi Dana Hasil Simulasi Investasi (Default: Rp 2.818.269.939 sesuai permintaan user)
  const [simulatedFund, setSimulatedFund] = useState<number>(() => {
    if (savedSimulatedAmount && savedSimulatedAmount > 0) return savedSimulatedAmount;
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_saved_simulated_investment");
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 2818269939; // Default: Rp 2.818.269.939
  });

  // Sinkronisasi jika prop berubah atau modal dibuka
  useEffect(() => {
    if (savedSimulatedAmount && savedSimulatedAmount > 0) {
      setSimulatedFund(savedSimulatedAmount);
    } else if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_saved_simulated_investment");
      if (saved && !isNaN(Number(saved))) {
        setSimulatedFund(Number(saved));
      }
    }
  }, [savedSimulatedAmount, isOpen]);

  const [annualReturn, setAnnualReturn] = useState<number>(7);
  const [annualWithdrawal, setAnnualWithdrawal] = useState<number>(
    initialAnnualExpense > 0 ? initialAnnualExpense : 36000000
  );
  const [useSimulatedFund, setUseSimulatedFund] = useState<boolean>(true);

  // Dana pokok aktif yang diuji untuk ketahanan 50 tahun (default: Dana simulasi hasil investasi)
  const activePrincipal = useSimulatedFund ? simulatedFund : currentRealBalance;

  // Selisih uang yang perlu dikumpulkan
  const gap = Math.max(0, simulatedFund - currentRealBalance);
  const progressPercent =
    simulatedFund > 0 ? (currentRealBalance / simulatedFund) * 100 : 0;

  // Kalkulasi Trayektori Ketahanan 50 Tahun ke Depan
  const simulation = useMemo(() => {
    const rate = annualReturn / 100;
    const annualGain = activePrincipal * rate;
    let balance = activePrincipal;
    const history: Array<{ year: number; balance: number }> = [{ year: 0, balance: activePrincipal }];
    let depletedYear: number | null = null;

    for (let y = 1; y <= 50; y++) {
      if (balance <= 0) {
        if (depletedYear === null) depletedYear = y - 1;
        balance = 0;
      } else {
        const gain = balance * rate;
        balance = balance + gain - annualWithdrawal;
        if (balance <= 0) {
          if (depletedYear === null) depletedYear = y;
          balance = 0;
        }
      }
      history.push({ year: y, balance: Math.max(0, Math.round(balance)) });
    }

    // Penentuan Badge Status 3 Kondisi Warna per PRD §3.4 & §3.4.1:
    let status: "green" | "yellow" | "red";
    let statusLabel: string;
    let statusDetail: string;

    if (activePrincipal <= 0) {
      status = "red";
      statusLabel = "Pokok Dana Rp0";
      statusDetail = "Tingkatkan alokasi bulanan untuk membangun pokok dana abadi yang cukup.";
    } else if (annualWithdrawal <= 0.7 * annualGain) {
      status = "green";
      statusLabel = "Bertahan Selamanya, Margin Aman";
      statusDetail = `Penarikan tahunan (${formatCurrency(annualWithdrawal)}) ≤ 70% dari return tahunan (${formatCurrency(annualGain)}). Pokok dana abadi tetap utuh dan terus bertumbuh melampaui inflasi.`;
    } else if (annualWithdrawal <= 1.0 * annualGain) {
      status = "yellow";
      statusLabel = "Bertahan, Tapi Margin Tipis";
      statusDetail = `Penarikan tahunan (${formatCurrency(annualWithdrawal)}) berada di antara 70%–100% dari return tahunan (${formatCurrency(annualGain)}). Bertahan selama return pasar stabil, namun rentan tergerus jika return riil turun.`;
    } else {
      status = "red";
      const yearText = depletedYear ? `${depletedYear} tahun` : "kurang dari 1 tahun";
      statusLabel = `Akan habis dalam ${yearText}`;
      statusDetail = `Penarikan tahunan (${formatCurrency(annualWithdrawal)}) melebihi return tahunan (${formatCurrency(annualGain)}). Pokok dana akan tergerus habis seiring waktu.`;
    }

    return {
      history,
      annualGain,
      depletedYear,
      status,
      statusLabel,
      statusDetail,
    };
  }, [activePrincipal, annualReturn, annualWithdrawal]);

  // SVG Chart Geometry
  const chartWidth = 320;
  const chartHeight = 130;
  const paddingX = 16;
  const paddingY = 16;

  const maxBalance = Math.max(
    activePrincipal,
    ...simulation.history.map((h) => h.balance),
    1
  );

  const points = simulation.history
    .map((h) => {
      const x = paddingX + (h.year / 50) * (chartWidth - paddingX * 2);
      const y = chartHeight - paddingY - (h.balance / maxBalance) * (chartHeight - paddingY * 2);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Simulator: Dana Abadi 50 Tahun">
      <div className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 pb-16">
          {/* Card 1: Total Saldo Riil Dana Abadi (Tap untuk diuji di trayektori 50 tahun) */}
          <button
            type="button"
            onClick={() => setUseSimulatedFund(false)}
            className={`w-full text-left p-4 rounded-card-lg transition-all duration-200 cursor-pointer active:scale-[0.99] ${
              !useSimulatedFund
                ? "bg-surface border-2 border-primary ring-2 ring-primary/20 shadow-sm"
                : "bg-surface/75 border border-border hover:border-border/80 hover:bg-surface opacity-85 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-medium text-text-secondary">
                    Total Saldo Riil Dana Abadi
                  </span>
                  {!useSimulatedFund ? (
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 border border-primary/25">
                      Sedang Diuji ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-secondary font-medium">
                      (Tap untuk diuji)
                    </span>
                  )}
                </div>
                <div className="text-[22px] font-bold text-text tracking-tight">
                  {formatCurrency(currentRealBalance)}
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  !useSimulatedFund ? "bg-primary text-white" : "bg-chip text-primary"
                }`}
              >
                <InfinityIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">
              *Diambil otomatis dari gabungan saldo seluruh dompet ber-flag Dana Abadi.
            </p>
          </button>

          {/* Card 2: Dana simulasi hasil investasi (Posisinya tepat dibawah Total Saldo Riil Dana Abadi, Tap untuk diuji) */}
          <button
            type="button"
            onClick={() => setUseSimulatedFund(true)}
            className={`w-full text-left p-4 rounded-card-lg transition-all duration-200 cursor-pointer active:scale-[0.99] ${
              useSimulatedFund
                ? "bg-chip/35 border-2 border-primary ring-2 ring-primary/20 shadow-sm"
                : "bg-surface/75 border border-border hover:border-border/80 hover:bg-surface opacity-85 hover:opacity-100"
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[12px] font-bold text-primary">
                    Dana simulasi hasil investasi
                  </span>
                  {useSimulatedFund ? (
                    <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/15 border border-primary/25">
                      Sedang Diuji ✓
                    </span>
                  ) : (
                    <span className="text-[10px] text-text-secondary font-medium">
                      (Tap untuk diuji)
                    </span>
                  )}
                </div>
                <div className="text-[24px] font-bold text-primary tracking-tight">
                  {formatCurrency(simulatedFund)}
                </div>
              </div>
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                  useSimulatedFund ? "bg-primary text-white" : "bg-primary/10 text-primary"
                }`}
              >
                <TrendingUpIcon className="w-5 h-5" />
              </div>
            </div>
            <p className="text-[11px] text-text-secondary mt-2 leading-relaxed">
              *Disimpan dari nominal yang diinvestasikan pada Simulator Bunga Majemuk 25 Tahun.
            </p>
          </button>

          {/* Card 3: Perbandingan Langsung (User bisa liat langsung perbedaanya) */}
          <div className="p-4 bg-field rounded-card-lg border border-border space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-bold text-text">
                Perbandingan Saldo Riil vs Dana Simulasi
              </span>
              <span className="text-[11px] font-bold text-primary px-2 py-0.5 rounded bg-primary/10">
                {progressPercent < 0.1 ? "< 0.1%" : `${progressPercent.toFixed(2)}%`} Terkumpul
              </span>
            </div>

            {/* Progress Bar Visual */}
            <div className="space-y-1.5">
              <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-primary h-2.5 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(100, Math.max(1.5, progressPercent))}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-text-secondary font-medium">
                <span>Saldo Riil: {formatCurrency(currentRealBalance)}</span>
                <span>Dana Simulasi: {formatCurrency(simulatedFund)}</span>
              </div>
            </div>

            {/* Callout Selisih Kumpulkan Uang */}
            {gap > 0 ? (
              <div className="pt-2 border-t border-border/70">
                <p className="text-[12px] font-semibold text-text leading-snug">
                  Kumpulkan uang <span className="text-primary font-bold">{formatCurrency(gap)}</span> untuk membuat dana abadi bekerja
                </p>
              </div>
            ) : (
              <div className="pt-2 border-t border-border/70 text-[12px] font-semibold text-income">
                ✓ Saldo riil Anda telah mencapai target simulasi!
              </div>
            )}
          </div>

          {/* Badge Status 3 Kondisi Warna per PRD §3.4 & §3.4.1 */}
          <div
            className={`p-4 rounded-card-lg border transition-colors ${
              simulation.status === "green"
                ? "bg-budget-green/10 border-budget-green text-budget-green"
                : simulation.status === "yellow"
                ? "bg-budget-yellow/10 border-budget-yellow text-budget-yellow"
                : "bg-budget-red/10 border-budget-red text-budget-red"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span
                className={`w-3 h-3 rounded-full ${
                  simulation.status === "green"
                    ? "bg-budget-green"
                    : simulation.status === "yellow"
                    ? "bg-budget-yellow"
                    : "bg-budget-red"
                }`}
              />
              <span className="text-[14px] font-bold text-text">
                {simulation.statusLabel}
              </span>
            </div>
            <p className="text-[12px] text-text-secondary leading-relaxed">
              {simulation.statusDetail}
            </p>
          </div>

          {/* Grafik Saldo 50 Tahun */}
          <div className="bg-surface p-4 rounded-card-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] font-semibold text-text">
                Trayektori Saldo 50 Tahun ke Depan
              </span>
              <span className="text-[10px] text-text-secondary">Tahun 0 → 50</span>
            </div>

            <div className="w-full overflow-hidden flex justify-center py-2">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto max-w-[340px]"
              >
                {/* Garis batas dasar 0 */}
                <line
                  x1={paddingX}
                  y1={chartHeight - paddingY}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY}
                  stroke="#E6E6ED"
                  strokeWidth="1"
                />

                {/* Garis Trayektori */}
                <polyline
                  fill="none"
                  stroke={
                    simulation.status === "green"
                      ? "#16A34A"
                      : simulation.status === "yellow"
                      ? "#EAB308"
                      : "#EF4444"
                  }
                  strokeWidth="3"
                  strokeLinecap="round"
                  points={points}
                />
              </svg>
            </div>

            <div className="flex justify-between text-[10px] text-text-secondary border-t border-border pt-1">
              <span>Mulai: {formatCurrency(activePrincipal)}</span>
              <span>
                Thn 50: {formatCurrency(simulation.history[50]?.balance || 0)}
              </span>
            </div>
          </div>

          {/* Slider 1: Asumsi Return Per Tahun (3% - 12%, default 7%) */}
          <div className="bg-surface p-4 rounded-card-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-text">
                Asumsi Return Tahunan
              </label>
              <span className="text-[14px] font-bold text-primary">
                {annualReturn.toFixed(1)}% / thn
              </span>
            </div>
            <input
              type="range"
              min={3}
              max={12}
              step={0.5}
              value={annualReturn}
              onChange={(e) => setAnnualReturn(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-field rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-secondary">
              <span>3% (Obligasi/SBN)</span>
              <span>7% (Campuran/Reksadana)</span>
              <span>12% (Saham)</span>
            </div>
          </div>

          {/* Slider 2: Estimasi Penarikan Per Tahun (Prefill dari total pengeluaran 12 bulan terakhir) */}
          <div className="bg-surface p-4 rounded-card-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-text">
                Estimasi Penarikan Tahunan
              </label>
              <span className="text-[14px] font-bold text-expense">
                {formatCurrency(annualWithdrawal)} / thn
              </span>
            </div>
            <input
              type="range"
              min={5000000}
              max={200000000}
              step={1000000}
              value={annualWithdrawal}
              onChange={(e) => setAnnualWithdrawal(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-field rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-secondary">
              <span>Rp5 Jt</span>
              <span>Rp100 Jt</span>
              <span>Rp200 Jt</span>
            </div>
            <p className="text-[10px] text-text-secondary italic">
              *Di-prefill dari total pengeluaran Anda dalam 12 bulan terakhir (semua kategori).
            </p>
          </div>

          {/* Disclaimer Permanen Wajib per PRD §3.4 */}
          <div className="p-3 bg-field rounded-control border border-border/80">
            <p className="text-[11px] text-text-secondary leading-normal text-center font-medium">
              ⚠️ <strong>Ilustrasi, bukan jaminan return.</strong> Return riil pasar tidak flat setiap tahun dan dipengaruhi oleh siklus ekonomi serta inflasi.
            </p>
          </div>
        </div>

        {/* Tombol Tutup */}
        <div className="p-4 bg-surface/95 backdrop-blur-md border-t border-border">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-field text-text text-[14px] font-bold rounded-control hover:bg-border/60 active:scale-[0.98] transition-all"
          >
            Tutup Proyeksi
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
