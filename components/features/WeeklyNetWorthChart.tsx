"use client";

import React, { useState } from "react";
import { WeeklyNetWorthGrowthDto, WeeklyNetWorthPoint } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

interface WeeklyNetWorthChartProps {
  data?: WeeklyNetWorthGrowthDto;
  isLoading?: boolean;
}

type ViewMode = "both" | "netWorth" | "totalAssets";

export const WeeklyNetWorthChart: React.FC<WeeklyNetWorthChartProps> = ({
  data,
  isLoading = false,
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);
  const [showTable, setShowTable] = useState<boolean>(false);

  if (isLoading) {
    return (
      <div className="bg-surface p-5 rounded-card-lg border border-border animate-pulse space-y-4">
        <div className="h-5 bg-field rounded-md w-1/2" />
        <div className="h-4 bg-field rounded-md w-3/4" />
        <div className="h-48 bg-field rounded-card-wallet w-full" />
      </div>
    );
  }

  if (!data || !data.history || data.history.length === 0) {
    return (
      <div className="bg-surface p-5 rounded-card-lg border border-border text-center py-10">
        <span className="text-[13px] text-text-secondary block">
          Belum ada data riwayat mingguan yang cukup
        </span>
      </div>
    );
  }

  const { history } = data;
  const activeIndex =
    selectedPointIndex !== null ? selectedPointIndex : history.length - 1;
  const activePoint: WeeklyNetWorthPoint = history[activeIndex] || history[history.length - 1];

  // Hitung rentang nilai untuk skala sumbu Y
  const allValues: number[] = [];
  history.forEach((h) => {
    if (viewMode === "both") {
      allValues.push(h.netWorth, h.totalAssets);
    } else if (viewMode === "netWorth") {
      allValues.push(h.netWorth);
    } else {
      allValues.push(h.totalAssets);
    }
  });

  const rawMin = Math.min(...allValues, 0);
  const rawMax = Math.max(...allValues, 100000);
  const span = rawMax - rawMin || 1;

  // Margin buffer 15% atas & bawah agar kurva tidak menempel di tepi
  const minY = Math.max(0, rawMin - span * 0.1);
  const maxY = rawMax + span * 0.15;
  const yRange = maxY - minY || 1;

  // Dimensi SVG
  const svgWidth = 320;
  const svgHeight = 170;
  const padLeft = 8;
  const padRight = 8;
  const padTop = 15;
  const padBottom = 26;

  const chartWidth = svgWidth - padLeft - padRight;
  const chartHeight = svgHeight - padTop - padBottom;

  // Helper konversi koordinat titik
  const getCoordinates = (value: number, index: number) => {
    const x =
      history.length === 1
        ? svgWidth / 2
        : padLeft + (index / (history.length - 1)) * chartWidth;
    const y = padTop + chartHeight - ((value - minY) / yRange) * chartHeight;
    return { x, y };
  };

  const netWorthPoints = history.map((item, idx) => ({
    ...getCoordinates(item.netWorth, idx),
    data: item,
  }));

  const totalAssetsPoints = history.map((item, idx) => ({
    ...getCoordinates(item.totalAssets, idx),
    data: item,
  }));

  // Generator kurva Bezier halus
  const generateSmoothPath = (
    pts: Array<{ x: number; y: number }>
  ): string => {
    if (pts.length === 0) return "";
    if (pts.length === 1) return `M ${padLeft} ${pts[0].y} L ${svgWidth - padRight} ${pts[0].y}`;

    let path = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i === 0 ? 0 : i - 1];
      const p1 = pts[i];
      const p2 = pts[i + 1];
      const p3 = pts[i + 2 >= pts.length ? i + 1 : i + 2];

      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      path += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(
        1
      )} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return path;
  };

  const netWorthLine = generateSmoothPath(netWorthPoints);
  const totalAssetsLine = generateSmoothPath(totalAssetsPoints);

  const baselineY = padTop + chartHeight;
  const netWorthArea = `${netWorthLine} L ${
    netWorthPoints[netWorthPoints.length - 1].x.toFixed(1)
  } ${baselineY} L ${netWorthPoints[0].x.toFixed(1)} ${baselineY} Z`;

  const totalAssetsArea = `${totalAssetsLine} L ${
    totalAssetsPoints[totalAssetsPoints.length - 1].x.toFixed(1)
  } ${baselineY} L ${totalAssetsPoints[0].x.toFixed(1)} ${baselineY} Z`;

  // Format angka ringkas untuk sumbu Y
  const formatCompactRupiah = (val: number): string => {
    if (val >= 1_000_000_000) {
      return `${(val / 1_000_000_000).toFixed(1)}M`;
    }
    if (val >= 1_000_000) {
      return `${Math.round(val / 1_000_000)}jt`;
    }
    if (val >= 1_000) {
      return `${Math.round(val / 1_000)}rb`;
    }
    return `${val}`;
  };

  // 3 grid line horizontal
  const gridLevels = [
    { value: maxY, y: padTop },
    { value: (maxY + minY) / 2, y: padTop + chartHeight / 2 },
    { value: minY, y: baselineY },
  ];

  return (
    <div className="bg-surface p-5 rounded-card-lg border border-border shadow-none space-y-4">
      {/* Header & Deskripsi */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/70 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-primary" />
            <h3 className="text-[14px] font-bold text-text">
              Pertumbuhan Net Worth & Total Aset
            </h3>
          </div>
          <p className="text-[11px] text-text-secondary mt-0.5">
            Tren akumulasi kekayaan bersih dan total aset 8 minggu terakhir
          </p>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center bg-field p-1 rounded-control border border-border self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setViewMode("both")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
              viewMode === "both"
                ? "bg-surface text-text shadow-xs font-bold"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Keduanya
          </button>
          <button
            type="button"
            onClick={() => setViewMode("netWorth")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
              viewMode === "netWorth"
                ? "bg-primary text-white font-bold"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Net Worth
          </button>
          <button
            type="button"
            onClick={() => setViewMode("totalAssets")}
            className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${
              viewMode === "totalAssets"
                ? "bg-income text-white font-bold"
                : "text-text-secondary hover:text-text"
            }`}
          >
            Total Aset
          </button>
        </div>
      </div>

      {/* Snapshot Angka Utama Terkini */}
      <div className="grid grid-cols-2 gap-3">
        {/* Card Net Worth Terkini */}
        <div className="p-3 bg-field/70 rounded-control border border-border/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Net Worth Terkini
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                data.latestWoWNetWorthDiff >= 0
                  ? "bg-income/10 text-income"
                  : "bg-expense/10 text-expense"
              }`}
            >
              {data.latestWoWNetWorthDiff >= 0 ? "▲ +" : "▼ "}
              {Math.abs(data.latestWoWNetWorthPercent)}%
            </span>
          </div>
          <div className="text-[16px] font-bold text-primary truncate">
            {formatCurrency(data.currentNetWorth)}
          </div>
          <div className="text-[10px] text-text-secondary mt-1">
            {data.latestWoWNetWorthDiff >= 0 ? "+" : ""}
            {formatCurrency(data.latestWoWNetWorthDiff)} vs minggu lalu
          </div>
        </div>

        {/* Card Total Aset Terkini */}
        <div className="p-3 bg-field/70 rounded-control border border-border/80">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-text-secondary">
              Total Seluruh Aset
            </span>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                data.latestWoWAssetsDiff >= 0
                  ? "bg-income/10 text-income"
                  : "bg-expense/10 text-expense"
              }`}
            >
              {data.latestWoWAssetsDiff >= 0 ? "▲ +" : "▼ "}
              {Math.abs(data.latestWoWAssetsPercent)}%
            </span>
          </div>
          <div className="text-[16px] font-bold text-income truncate">
            {formatCurrency(data.currentTotalAssets)}
          </div>
          <div className="text-[10px] text-text-secondary mt-1">
            Kas: {formatCurrency(data.currentWalletsBalance)} • Aset: {formatCurrency(data.currentAssetsValue)}
          </div>
        </div>
      </div>

      {/* SVG Canvas Grafik Mingguan */}
      <div className="relative pt-2 pb-1">
        {/* Legend Penunjuk Kurva */}
        <div className="flex items-center justify-between text-[11px] text-text-secondary mb-2 px-1">
          <div className="flex items-center gap-3">
            {(viewMode === "both" || viewMode === "netWorth") && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                <span className="font-medium text-text">Net Worth</span>
              </div>
            )}
            {(viewMode === "both" || viewMode === "totalAssets") && (
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-income" />
                <span className="font-medium text-text">Total Aset</span>
              </div>
            )}
          </div>
          <span className="text-[10px] italic">
            *Ketuk titik untuk lihat detail minggu
          </span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-auto overflow-visible select-none"
        >
          <defs>
            {/* Gradient Net Worth */}
            <linearGradient id="grad-net-worth" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4E44E5" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#4E44E5" stopOpacity="0.0" />
            </linearGradient>

            {/* Gradient Total Assets */}
            <linearGradient id="grad-total-assets" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#16A34A" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#16A34A" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Grid Lines Horizontal */}
          {gridLevels.map((gl, i) => (
            <g key={i}>
              <line
                x1={padLeft}
                y1={gl.y}
                x2={svgWidth - padRight}
                y2={gl.y}
                stroke="#E6E6ED"
                strokeDasharray="3 3"
                strokeWidth="1"
              />
              <text
                x={padLeft + 2}
                y={gl.y - 3}
                fill="#6B7280"
                fontSize="8"
                fontFamily="Inter, sans-serif"
                fontWeight="500"
              >
                {formatCompactRupiah(gl.value)}
              </text>
            </g>
          ))}

          {/* Garis Vertikal Penanda Minggu yang Sedang Dipilih */}
          {activePoint && (
            <line
              x1={getCoordinates(activePoint.netWorth, activeIndex).x}
              y1={padTop}
              x2={getCoordinates(activePoint.netWorth, activeIndex).x}
              y2={baselineY}
              stroke="#4E44E5"
              strokeWidth="1.5"
              strokeDasharray="2 2"
              opacity="0.6"
            />
          )}

          {/* Area Fill Total Assets */}
          {(viewMode === "both" || viewMode === "totalAssets") && (
            <path d={totalAssetsArea} fill="url(#grad-total-assets)" />
          )}

          {/* Area Fill Net Worth */}
          {(viewMode === "both" || viewMode === "netWorth") && (
            <path d={netWorthArea} fill="url(#grad-net-worth)" />
          )}

          {/* Kurva Garis Total Assets */}
          {(viewMode === "both" || viewMode === "totalAssets") && (
            <path
              d={totalAssetsLine}
              fill="none"
              stroke="#16A34A"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Kurva Garis Net Worth */}
          {(viewMode === "both" || viewMode === "netWorth") && (
            <path
              d={netWorthLine}
              fill="none"
              stroke="#4E44E5"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}

          {/* Titik Data Total Assets */}
          {(viewMode === "both" || viewMode === "totalAssets") &&
            totalAssetsPoints.map((pt, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <g key={`asset-${idx}`}>
                  {isSelected && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="6"
                      fill="#16A34A"
                      opacity="0.25"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? "3.5" : "2.5"}
                    fill="#16A34A"
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}

          {/* Titik Data Net Worth */}
          {(viewMode === "both" || viewMode === "netWorth") &&
            netWorthPoints.map((pt, idx) => {
              const isSelected = idx === activeIndex;
              return (
                <g key={`nw-${idx}`}>
                  {isSelected && (
                    <circle
                      cx={pt.x}
                      cy={pt.y}
                      r="6.5"
                      fill="#4E44E5"
                      opacity="0.30"
                    />
                  )}
                  <circle
                    cx={pt.x}
                    cy={pt.y}
                    r={isSelected ? "4" : "2.5"}
                    fill="#4E44E5"
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                  />
                </g>
              );
            })}

          {/* Sumbu X Label Minggu */}
          {history.map((item, idx) => {
            const coord = getCoordinates(item.netWorth, idx);
            const isSelected = idx === activeIndex;
            return (
              <text
                key={`label-${idx}`}
                x={coord.x}
                y={svgHeight - 4}
                textAnchor="middle"
                fontSize="8.5"
                fontFamily="Inter, sans-serif"
                fontWeight={isSelected ? "700" : "500"}
                fill={isSelected ? "#4E44E5" : "#6B7280"}
              >
                {item.weekLabel}
              </text>
            );
          })}

          {/* Area Interaktif Sentuh/Klik per Titik */}
          {history.map((item, idx) => {
            const coord = getCoordinates(item.netWorth, idx);
            return (
              <rect
                key={`hit-${idx}`}
                x={coord.x - chartWidth / (history.length * 2)}
                y={padTop}
                width={chartWidth / history.length}
                height={chartHeight + padBottom}
                fill="transparent"
                className="cursor-pointer"
                onClick={() => setSelectedPointIndex(idx)}
                onMouseEnter={() => setSelectedPointIndex(idx)}
              />
            );
          })}
        </svg>
      </div>

      {/* Card Detail Interaktif Minggu Terpilih */}
      {activePoint && (
        <div className="p-3.5 bg-field rounded-control border border-border space-y-2.5 transition-all">
          <div className="flex items-center justify-between border-b border-border/70 pb-2">
            <div>
              <span className="text-[12px] font-bold text-text">
                {activePoint.weekLabel}: {activePoint.formattedDateRange}
              </span>
              <span className="text-[10px] text-text-secondary block">
                Posisi keuangan pada akhir minggu ini
              </span>
            </div>
            <div className="text-right">
              <span
                className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full inline-block ${
                  activePoint.wowNetWorthChange >= 0
                    ? "bg-income/10 text-income"
                    : "bg-expense/10 text-expense"
                }`}
              >
                {activePoint.wowNetWorthChange >= 0 ? "▲ +" : "▼ "}
                {formatCurrency(activePoint.wowNetWorthChange)} (
                {activePoint.wowNetWorthPercent}%)
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <div>
              <span className="text-text-secondary block text-[10px]">
                Net Worth
              </span>
              <span className="font-bold text-primary text-[12px]">
                {formatCurrency(activePoint.netWorth)}
              </span>
            </div>

            <div>
              <span className="text-text-secondary block text-[10px]">
                Total Seluruh Aset
              </span>
              <span className="font-bold text-income text-[12px]">
                {formatCurrency(activePoint.totalAssets)}
              </span>
            </div>

            <div>
              <span className="text-text-secondary block text-[10px]">
                Sisa Utang
              </span>
              <span className="font-bold text-expense text-[12px]">
                {formatCurrency(activePoint.debtsRemaining)}
              </span>
            </div>
          </div>

          <div className="text-[10.5px] text-text-secondary/90 bg-surface p-2 rounded-md flex justify-between items-center">
            <span>
              Komposisi Aset: Kas Dompet{" "}
              <strong className="text-text">
                {formatCurrency(activePoint.walletsBalance)}
              </strong>{" "}
              + Aset{" "}
              <strong className="text-text">
                {formatCurrency(activePoint.assetsValue)}
              </strong>
            </span>
            <span className="text-[10px] font-medium text-text-secondary">
              Rasio Utang:{" "}
              {activePoint.totalAssets > 0
                ? `${Math.round(
                    (activePoint.debtsRemaining / activePoint.totalAssets) * 100
                  )}%`
                : "0%"}
            </span>
          </div>
        </div>
      )}

      {/* Tombol Buka / Tutup Tabel Riwayat Mingguan */}
      <div className="pt-1">
        <button
          type="button"
          onClick={() => setShowTable((prev) => !prev)}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 text-[12px] font-semibold text-text-secondary hover:text-text bg-field hover:bg-chip/50 rounded-control transition-all"
        >
          <span>{showTable ? "Sembunyikan Tabel Riwayat 8 Minggu" : "Lihat Tabel Rincian 8 Minggu"}</span>
          <svg
            className={`w-4 h-4 transition-transform duration-200 ${
              showTable ? "rotate-180" : ""
            }`}
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z" />
          </svg>
        </button>

        {/* Tabel Riwayat Rinci */}
        {showTable && (
          <div className="mt-3 overflow-x-auto border border-border rounded-control">
            <table className="w-full text-left text-[11px]">
              <thead className="bg-field text-text-secondary border-b border-border">
                <tr>
                  <th className="py-2 px-2.5 font-semibold">Minggu</th>
                  <th className="py-2 px-2.5 font-semibold">Net Worth</th>
                  <th className="py-2 px-2.5 font-semibold">Total Aset</th>
                  <th className="py-2 px-2.5 font-semibold">Utang</th>
                  <th className="py-2 px-2.5 font-semibold text-right">WoW</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {history.map((h, i) => (
                  <tr
                    key={h.weekIndex}
                    onClick={() => setSelectedPointIndex(i)}
                    className={`cursor-pointer transition-colors ${
                      i === activeIndex ? "bg-primary/5 font-semibold" : "hover:bg-field/50"
                    }`}
                  >
                    <td className="py-2 px-2.5 text-text">
                      <div className="font-bold">{h.weekLabel}</div>
                      <div className="text-[9.5px] text-text-secondary">{h.shortLabel}</div>
                    </td>
                    <td className="py-2 px-2.5 font-bold text-primary">
                      {formatCurrency(h.netWorth)}
                    </td>
                    <td className="py-2 px-2.5 text-income">
                      {formatCurrency(h.totalAssets)}
                    </td>
                    <td className="py-2 px-2.5 text-expense">
                      {formatCurrency(h.debtsRemaining)}
                    </td>
                    <td
                      className={`py-2 px-2.5 text-right font-medium ${
                        h.wowNetWorthChange >= 0 ? "text-income" : "text-expense"
                      }`}
                    >
                      {h.wowNetWorthChange >= 0 ? "+" : ""}
                      {formatCurrency(h.wowNetWorthChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
