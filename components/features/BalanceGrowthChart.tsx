"use client";

import React, { useState } from "react";
import { MonthlyBalanceGrowthPoint } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface BalanceGrowthChartProps {
  history: MonthlyBalanceGrowthPoint[];
  isPositive?: boolean;
  className?: string;
}

export const BalanceGrowthChart: React.FC<BalanceGrowthChartProps> = ({
  history,
  isPositive = true,
  className = "",
}) => {
  const [activePointIndex, setActivePointIndex] = useState<number | null>(null);

  if (!history || history.length === 0) {
    return (
      <div className="flex items-center justify-center h-full w-full text-[10px] text-text-secondary">
        -
      </div>
    );
  }

  // Dimensi SVG kompak
  const width = 96;
  const height = 58;
  const padX = 6;
  const padTop = 6;
  const padBottom = 12;

  const balances = history.map((h) => h.balance);
  let minBal = Math.min(...balances);
  let maxBal = Math.max(...balances);

  if (minBal === maxBal) {
    minBal = Math.max(0, minBal - 100000);
    maxBal = maxBal + 100000;
  } else {
    const range = maxBal - minBal;
    minBal = Math.max(0, minBal - range * 0.1);
    maxBal = maxBal + range * 0.1;
  }

  const range = maxBal - minBal || 1;
  const availableHeight = height - padTop - padBottom;
  const availableWidth = width - padX * 2;

  const points = history.map((item, idx) => {
    const x =
      history.length === 1
        ? width / 2
        : padX + (idx / (history.length - 1)) * availableWidth;
    const y =
      height - padBottom - ((item.balance - minBal) / range) * availableHeight;
    return { x, y, data: item };
  });

  // Kurva Bezier halus
  let linePath = "";
  if (points.length === 1) {
    linePath = `M ${padX} ${points[0].y} L ${width - padX} ${points[0].y}`;
  } else {
    linePath = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i === 0 ? 0 : i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[i + 2 >= points.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      linePath += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
  }

  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(1)} ${
    height - padBottom
  } L ${firstPoint.x.toFixed(1)} ${height - padBottom} Z`;

  const strokeColor = isPositive ? "#16A34A" : "#EF4444";
  const gradientId = `chart-mini-grad-${isPositive ? "pos" : "neg"}`;
  const activePoint =
    activePointIndex !== null ? points[activePointIndex] : null;

  return (
    <div className={`relative w-full h-full flex flex-col justify-between ${className}`}>
      {/* Tooltip ringkas saat disentuh/di-hover */}
      {activePoint && (
        <div className="absolute -top-7 right-0 z-30 px-1.5 py-0.5 bg-text text-surface text-[9px] font-semibold rounded shadow-sm whitespace-nowrap pointer-events-none">
          {activePoint.data.label}: {formatCurrency(activePoint.data.balance)}
        </div>
      )}

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full h-full overflow-visible"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.30" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Fill Area */}
        <path d={areaPath} fill={`url(#${gradientId})`} />

        {/* Garis Kurva */}
        <path
          d={linePath}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Titik Terakhir (Bulan Ini) */}
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="4.5"
          fill={strokeColor}
          opacity="0.25"
        />
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.5"
          fill={strokeColor}
          stroke="#FFFFFF"
          strokeWidth="1.2"
        />

        {/* Hit area interaktif */}
        {points.map((pt, idx) => (
          <circle
            key={pt.data.monthKey}
            cx={pt.x}
            cy={pt.y}
            r="8"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setActivePointIndex(idx)}
            onMouseLeave={() => setActivePointIndex(null)}
            onTouchStart={() => setActivePointIndex(idx)}
          />
        ))}
      </svg>

      {/* Label bulan awal & akhir */}
      <div className="flex justify-between items-center text-[8px] font-medium text-text-secondary px-0.5 -mt-1 leading-none">
        <span>{history[0]?.label}</span>
        <span className="font-semibold text-text">
          {history[history.length - 1]?.label}
        </span>
      </div>
    </div>
  );
};
