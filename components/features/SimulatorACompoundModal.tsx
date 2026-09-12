"use client";

import React, { useState, useMemo } from "react";
import { BottomSheet } from "../ui/BottomSheet";
import { formatCurrency } from "@/lib/currency";
import { TrendingUpIcon, InfinityIcon } from "../ui/Icons";

interface SimulatorACompoundModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMonthlyAmount?: number;
  onSaveSimulation?: (savedAmount: number, monthly: number, returnRate: number) => void;
}

export const SimulatorACompoundModal: React.FC<SimulatorACompoundModalProps> = ({
  isOpen,
  onClose,
  initialMonthlyAmount,
  onSaveSimulation,
}) => {
  // Inisialisasi: cek apakah user sudah pernah simpan nilai sebelumnya di localStorage
  const [monthlyAmount, setMonthlyAmount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_saved_sim_monthly");
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return initialMonthlyAmount && initialMonthlyAmount > 0 ? initialMonthlyAmount : 1500000;
  });

  const [annualReturn, setAnnualReturn] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_saved_sim_return");
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 12; // 12% menghasilkan Rp 2.818.269.939 di tahun ke-25 dengan Rp 1.500.000/bln
  });

  const [selectedYear, setSelectedYear] = useState<number>(25);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Kalkulasi proyeksi 25 tahun
  const projectionData = useMemo(() => {
    const years = 25;
    const monthlyRate = annualReturn / 100 / 12;
    const data: Array<{
      year: number;
      savedOnly: number;
      invested: number;
    }> = [];

    for (let y = 0; y <= years; y++) {
      const months = y * 12;
      const savedOnly = months * monthlyAmount;
      let invested = savedOnly;

      if (monthlyRate > 0 && months > 0) {
        invested = Math.round(
          monthlyAmount * ((Math.pow(1 + monthlyRate, months) - 1) / monthlyRate)
        );
      }

      data.push({
        year: y,
        savedOnly,
        invested,
      });
    }

    return data;
  }, [monthlyAmount, annualReturn]);

  const final25 = projectionData[selectedYear] || projectionData[25];
  const maxVal = Math.max(1, projectionData[25]?.invested || 1);

  // Handler simpan simulasi
  const handleSaveSimulation = () => {
    const amountToSave = projectionData[25]?.invested || final25.invested;
    if (typeof window !== "undefined") {
      localStorage.setItem("ft_saved_simulated_investment", amountToSave.toString());
      localStorage.setItem("ft_saved_sim_monthly", monthlyAmount.toString());
      localStorage.setItem("ft_saved_sim_return", annualReturn.toString());
    }
    if (onSaveSimulation) {
      onSaveSimulation(amountToSave, monthlyAmount, annualReturn);
    }
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 600);
  };

  // SVG Chart Geometry
  const chartWidth = 320;
  const chartHeight = 140;
  const paddingX = 16;
  const paddingY = 16;

  const getCoordinates = (year: number, val: number) => {
    const x = paddingX + (year / 25) * (chartWidth - paddingX * 2);
    const y = chartHeight - paddingY - (val / maxVal) * (chartHeight - paddingY * 2);
    return { x, y };
  };

  const investedPoints = projectionData
    .map((d) => {
      const { x, y } = getCoordinates(d.year, d.invested);
      return `${x},${y}`;
    })
    .join(" ");

  const savedPoints = projectionData
    .map((d) => {
      const { x, y } = getCoordinates(d.year, d.savedOnly);
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <BottomSheet isOpen={isOpen} onClose={onClose} title="Simulator: Bayar Diri Sendiri">
      <div className="flex flex-col flex-1 min-h-0 relative">
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 pb-20">
          {/* Kalimat Pembuka Orisinal (bukan kutipan buku) per PRD §3.3 */}
          <div className="p-3.5 bg-field rounded-control border border-border">
            <p className="text-[13px] font-semibold text-text leading-snug">
              Nominal kecil yang disisihkan secara konsisten akan berlipat ganda jauh melampaui tabungan biasa ketika dibiarkan bekerja.
            </p>
          </div>

          {/* Dua Angka Besar (Total Tanpa Investasi vs Dengan Investasi) */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3.5 bg-surface rounded-card border border-border">
              <span className="text-[11px] font-medium text-text-secondary block mb-1">
                Hanya Disimpan ({selectedYear} Thn)
              </span>
              <div className="text-[16px] font-bold text-text-secondary tracking-tight">
                {formatCurrency(final25.savedOnly)}
              </div>
            </div>

            <div className="p-3.5 bg-chip/60 rounded-card border border-primary/20">
              <span className="text-[11px] font-semibold text-primary block mb-1">
                Diinvestasikan ({selectedYear} Thn)
              </span>
              <div className="text-[18px] font-bold text-primary tracking-tight">
                {formatCurrency(final25.invested)}
              </div>
              <div className="mt-1 text-[10px] font-bold text-income">
                +{formatCurrency(final25.invested - final25.savedOnly)} keuntungan
              </div>
            </div>
          </div>

          {/* Grafik Garis Interaktif 25 Tahun */}
          <div className="bg-surface p-4 rounded-card-lg border border-border">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <TrendingUpIcon className="w-4 h-4 text-primary" />
                <span className="text-[12px] font-semibold text-text">
                  Proyeksi Pertumbuhan 25 Tahun
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] font-medium">
                <span className="flex items-center gap-1 text-text-secondary">
                  <span className="w-2.5 h-0.5 bg-text-secondary rounded-full" />
                  Disimpan
                </span>
                <span className="flex items-center gap-1 text-primary font-bold">
                  <span className="w-2.5 h-1 bg-primary rounded-full" />
                  Investasi
                </span>
              </div>
            </div>

            <div className="w-full overflow-hidden flex justify-center py-2">
              <svg
                viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                className="w-full h-auto max-w-[340px]"
              >
                {/* Grid horizontal */}
                <line
                  x1={paddingX}
                  y1={chartHeight - paddingY}
                  x2={chartWidth - paddingX}
                  y2={chartHeight - paddingY}
                  stroke="#E6E6ED"
                  strokeWidth="1"
                />
                <line
                  x1={paddingX}
                  y1={chartHeight / 2}
                  x2={chartWidth - paddingX}
                  y2={chartHeight / 2}
                  stroke="#E6E6ED"
                  strokeWidth="1"
                  strokeDasharray="3 3"
                />

                {/* Garis Disimpan Saja */}
                <polyline
                  fill="none"
                  stroke="#9CA3AF"
                  strokeWidth="2"
                  strokeLinecap="round"
                  points={savedPoints}
                />

                {/* Garis Diinvestasikan */}
                <polyline
                  fill="none"
                  stroke="#4E44E5"
                  strokeWidth="3"
                  strokeLinecap="round"
                  points={investedPoints}
                />

                {/* Titik interaktif tahun terpilih */}
                {(() => {
                  const pt = getCoordinates(selectedYear, final25.invested);
                  const ptSaved = getCoordinates(selectedYear, final25.savedOnly);
                  return (
                    <g>
                      <line
                        x1={pt.x}
                        y1={paddingY}
                        x2={pt.x}
                        y2={chartHeight - paddingY}
                        stroke="#4E44E5"
                        strokeWidth="1"
                        strokeDasharray="2 2"
                        opacity="0.4"
                      />
                      <circle cx={ptSaved.x} cy={ptSaved.y} r="3.5" fill="#6B7280" />
                      <circle cx={pt.x} cy={pt.y} r="5" fill="#4E44E5" stroke="#FFFFFF" strokeWidth="2" />
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Selector Tahun Cepat */}
            <div className="flex items-center justify-between text-[10px] text-text-secondary pt-1 border-t border-border">
              <span>Tahun 0</span>
              <div className="flex gap-2">
                {[5, 10, 15, 20, 25].map((y) => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setSelectedYear(y)}
                    className={`px-2 py-0.5 rounded text-[10px] transition-colors ${
                      selectedYear === y
                        ? "bg-primary text-white font-bold"
                        : "text-text-secondary hover:text-text bg-field"
                    }`}
                  >
                    Thn {y}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Slider 1: Nominal disisihkan per bulan */}
          <div className="bg-surface p-4 rounded-card-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-text">
                Disisihkan Per Bulan
              </label>
              <span className="text-[14px] font-bold text-primary">
                {formatCurrency(monthlyAmount)}
              </span>
            </div>
            <input
              type="range"
              min={50000}
              max={5000000}
              step={50000}
              value={monthlyAmount}
              onChange={(e) => setMonthlyAmount(Number(e.target.value))}
              className="w-full accent-primary h-2 bg-field rounded-lg cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-text-secondary">
              <span>Rp50.000</span>
              <span>Rp2.500.000</span>
              <span>Rp5.000.000</span>
            </div>
          </div>

          {/* Slider 2: Asumsi Return Per Tahun (3% - 12%, default 12% untuk simulasi Rp 2,81 M) */}
          <div className="bg-surface p-4 rounded-card-lg border border-border space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-[12px] font-semibold text-text">
                Asumsi Return Per Tahun
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
              <span>3% (Konservatif)</span>
              <span>7% (Moderat)</span>
              <span>12% (Agresif / Saham)</span>
            </div>
          </div>

          {/* Disclaimer Permanen Wajib per PRD §3.3 & §5 */}
          <div className="p-3 bg-field rounded-control border border-border/80">
            <p className="text-[11px] text-text-secondary leading-normal text-center font-medium">
              ⚠️ <strong>Ilustrasi, bukan jaminan return.</strong> Hasil riil bergantung pada kinerja instrumen pasar yang dipilih.
            </p>
          </div>
        </div>

        {/* Tombol Simpan Simulasi (Menggantikan Tutup Simulator sesuai instruksi user) */}
        <div className="p-4 bg-surface/95 backdrop-blur-md border-t border-border flex flex-col gap-2">
          <button
            type="button"
            onClick={handleSaveSimulation}
            className={`w-full py-3 text-[14px] font-bold rounded-control transition-all active:scale-[0.98] shadow-sm flex items-center justify-center gap-2 ${
              saveSuccess
                ? "bg-income text-white"
                : "bg-primary text-white hover:opacity-95"
            }`}
          >
            {saveSuccess ? (
              <span>✓ Hasil Simulasi Tersimpan!</span>
            ) : (
              <>
                <span>Simpan Simulasi</span>
                <span className="text-[12px] font-normal opacity-90">
                  ({formatCurrency(projectionData[25]?.invested || final25.invested)})
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </BottomSheet>
  );
};
