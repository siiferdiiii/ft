"use client";

import React from "react";
import { StatisticsDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface DonutChartProps {
  total: number;
  data: Array<{
    categoryId: string;
    categoryName: string;
    amount: number;
    percentage: number;
    color: string;
    isLargest?: boolean;
  }>;
  title: string;
}

export const DonutRingChart: React.FC<DonutChartProps> = ({ total, data, title }) => {
  // SVG Donut calculation
  // Radius R = 70, viewBox 200x200, center (100, 100), strokeWidth = 22
  const radius = 70;
  const strokeWidth = 22;
  const circumference = 2 * Math.PI * radius;

  let cumulativePercent = 0;

  return (
    <div className="bg-surface p-5 rounded-card-lg border border-border">
      <h3 className="text-[14px] font-semibold text-text mb-4">{title}</h3>

      {total === 0 || data.length === 0 ? (
        <div className="py-12 text-center text-[13px] text-text-secondary">
          Belum ada data transaksi pada periode ini
        </div>
      ) : (
        <>
          {/* Ring Chart SVG */}
          <div className="relative flex items-center justify-center my-4">
            <svg width="200" height="200" viewBox="0 0 200 200" className="rotate-[-90deg]">
              {/* Background ring */}
              <circle
                cx="100"
                cy="100"
                r={radius}
                fill="none"
                stroke="#F5F5FA"
                strokeWidth={strokeWidth}
              />
              {data.map((item) => {
                const strokeDasharray = `${(item.percentage / 100) * circumference} ${circumference}`;
                const strokeDashoffset = -((cumulativePercent / 100) * circumference);
                cumulativePercent += item.percentage;

                return (
                  <circle
                    key={item.categoryId}
                    cx="100"
                    cy="100"
                    r={radius}
                    fill="none"
                    stroke={item.color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={strokeDasharray}
                    strokeDashoffset={strokeDashoffset}
                    className="transition-all duration-300"
                  />
                );
              })}
            </svg>

            {/* Total nominal in center hole */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[11px] font-medium text-text-secondary">Total</span>
              <span className="text-[17px] font-bold text-text px-2">
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Legend list */}
          <div className="space-y-2 mt-4">
            {data.map((item) => (
              <div
                key={item.categoryId}
                className="flex items-center justify-between text-[13px]"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-text">{item.categoryName}</span>
                  {item.isLargest && (
                    <span className="text-[11px] font-semibold text-primary">
                      (terbesar)
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-text-secondary text-[12px]">
                    {item.percentage}%
                  </span>
                  <span className="font-semibold text-text">
                    {formatCurrency(item.amount)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

interface HeatmapCalendarProps {
  heatmap: StatisticsDto["calendarHeatmap"];
}

export const HeatmapCalendar: React.FC<HeatmapCalendarProps> = ({ heatmap }) => {
  // Mapping intensitas sesuai DESIGN_SYSTEM §6:
  // kosong -> border abu-abu
  // rendah (1) -> lavender muda (#EDECFC)
  // sedang (2) -> ungu medium (#8B82F6)
  // tinggi (3, 4) -> primary penuh (#4E44E5)
  const getCellClass = (intensity: number) => {
    switch (intensity) {
      case 1:
        return "bg-chip border-transparent";
      case 2:
        return "bg-[#8B82F6] border-transparent";
      case 3:
      case 4:
        return "bg-primary border-transparent";
      default:
        return "bg-surface border border-border";
    }
  };

  return (
    <div className="bg-surface p-5 rounded-card-lg border border-border">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[14px] font-semibold text-text">
          Aktivitas Transaksi Bulan Ini
        </h3>
        <span className="text-[11px] text-text-secondary">Heatmap Harian</span>
      </div>

      <div className="grid grid-cols-7 gap-2 my-2 justify-items-center">
        {heatmap.map((cell) => (
          <div
            key={cell.date}
            className={`w-[18px] h-[18px] rounded-cell transition-transform hover:scale-125 cursor-pointer ${getCellClass(
              cell.intensity
            )}`}
            title={`${cell.date}: ${cell.count} transaksi (${formatCurrency(
              cell.totalAmount
            )})`}
          />
        ))}
      </div>

      {/* Heatmap Legend */}
      <div className="flex items-center justify-end gap-1.5 mt-3 text-[11px] text-text-secondary">
        <span>Sedikit</span>
        <div className="w-[12px] h-[12px] rounded-cell bg-surface border border-border" />
        <div className="w-[12px] h-[12px] rounded-cell bg-chip" />
        <div className="w-[12px] h-[12px] rounded-cell bg-[#8B82F6]" />
        <div className="w-[12px] h-[12px] rounded-cell bg-primary" />
        <span>Banyak</span>
      </div>
    </div>
  );
};
