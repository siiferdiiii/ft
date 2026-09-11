"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAppData } from "@/lib/context/AppDataContext";
import { TransactionDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { BottomNav } from "@/components/ui/BottomNav";
import { SwipeDeleteRow } from "@/components/ui/SwipeDeleteRow";
import Link from "next/link";

export default function RiwayatPage() {
  const { wallets, categories, refreshData } = useAppData();

  // State filter
  const [search, setSearch] = useState("");
  const [filterWalletId, setFilterWalletId] = useState("");
  const [filterCategoryId, setFilterCategoryId] = useState("");
  const [filterType, setFilterType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const PAGE_SIZE = 30;

  // Data state
  const [transactions, setTransactions] = useState<TransactionDto[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchTransactions = useCallback(async (append = false) => {
    if (append) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }
    try {
      const params = new URLSearchParams();
      const offset = append ? transactions.length : 0;
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String(offset));
      if (search) params.set("search", search);
      if (filterWalletId) params.set("walletId", filterWalletId);
      if (filterCategoryId) params.set("categoryId", filterCategoryId);
      if (filterType) params.set("type", filterType);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const json = await res.json();
      if (json.data) {
        if (append) {
          setTransactions((prev) => [...prev, ...json.data]);
        } else {
          setTransactions(json.data);
        }
        setHasMore(json.data.length >= PAGE_SIZE);
      }
    } catch (err) {
      console.warn("Gagal memuat transaksi:", err);
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, [search, filterWalletId, filterCategoryId, filterType, dateFrom, dateTo, transactions.length]);

  const handleDeleteTransaction = useCallback(async (txId: string) => {
    setDeletingId(txId);
    try {
      const res = await fetch(`/api/transactions/${txId}`, { method: "DELETE" });
      if (res.ok) {
        // Hapus dari UI secara optimistic
        setTransactions((prev) => prev.filter((t) => t.id !== txId));
        // Refresh data context agar saldo dompet juga ter-update
        refreshData(true);
      }
    } catch (err) {
      console.warn("Gagal menghapus transaksi:", err);
    } finally {
      setDeletingId(null);
    }
  }, [refreshData]);

  // Debounce search, fetch langsung untuk filter lain
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchTransactions(false);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fetchTransactions]);

  const activeFilterCount = [filterWalletId, filterCategoryId, filterType, dateFrom, dateTo].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearch("");
    setFilterWalletId("");
    setFilterCategoryId("");
    setFilterType("");
    setDateFrom("");
    setDateTo("");
  };

  // Group transactions by date
  const grouped: Record<string, TransactionDto[]> = {};
  for (const tx of transactions) {
    const dateKey = new Date(tx.transactionDate).toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(tx);
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-bg/95 backdrop-blur-sm border-b border-border px-5 pt-5 pb-3">
        <div className="flex items-center gap-3 mb-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-full bg-field flex items-center justify-center text-text-secondary hover:text-text transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </Link>
          <h1 className="text-[18px] font-bold text-text">Riwayat Transaksi</h1>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari catatan atau nominal..."
            className="w-full pl-10 pr-12 py-2.5 bg-field text-text text-[14px] font-medium rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
          />
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${
              showFilters || activeFilterCount > 0 ? "bg-primary/15 text-primary" : "text-text-secondary hover:text-text"
            }`}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
            </svg>
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        {/* Filter Panel (collapsible) */}
        {showFilters && (
          <div className="mt-3 p-3 bg-surface rounded-card border border-border space-y-3 animate-in slide-in-from-top-2">
            {/* Tipe */}
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1.5">Tipe Transaksi</label>
              <div className="flex gap-2">
                {[
                  { value: "", label: "Semua" },
                  { value: "EXPENSE", label: "Pengeluaran" },
                  { value: "INCOME", label: "Pemasukan" },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilterType(opt.value)}
                    className={`px-3 py-1.5 rounded-full text-[12px] font-medium transition-colors ${
                      filterType === opt.value
                        ? "bg-primary text-white"
                        : "bg-field text-text-secondary hover:text-text"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Dompet */}
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1.5">Dompet</label>
              <select
                value={filterWalletId}
                onChange={(e) => setFilterWalletId(e.target.value)}
                className="w-full bg-field text-text text-[13px] font-medium px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Semua Dompet</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>

            {/* Kategori */}
            <div>
              <label className="block text-[11px] font-medium text-text-secondary mb-1.5">Kategori</label>
              <select
                value={filterCategoryId}
                onChange={(e) => setFilterCategoryId(e.target.value)}
                className="w-full bg-field text-text text-[13px] font-medium px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            {/* Rentang Tanggal */}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1.5">Dari Tanggal</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full bg-field text-text text-[13px] font-medium px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-text-secondary mb-1.5">Sampai Tanggal</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full bg-field text-text text-[13px] font-medium px-3 py-2 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Tombol Reset */}
            {activeFilterCount > 0 && (
              <button
                onClick={clearAllFilters}
                className="w-full py-2 text-[13px] font-medium text-expense hover:underline"
              >
                Hapus Semua Filter
              </button>
            )}
          </div>
        )}
      </div>

      {/* Result Summary */}
      <div className="px-5 py-3 flex items-center justify-between">
        <span className="text-[12px] text-text-secondary">
          {isLoading ? "Memuat..." : `${transactions.length} transaksi ditemukan`}
        </span>
        {(search || activeFilterCount > 0) && !isLoading && (
          <button
            onClick={clearAllFilters}
            className="text-[12px] text-primary font-medium hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {/* Transaction List - Grouped by Date */}
      <div className="flex-1 px-5 space-y-4">
        {Object.entries(grouped).map(([dateLabel, txs]) => (
          <div key={dateLabel}>
            <div className="text-[12px] font-semibold text-text-secondary mb-2 uppercase tracking-wide">
              {dateLabel}
            </div>
            <div className="bg-surface rounded-card-lg border border-border divide-y divide-border overflow-hidden">
              {txs.map((tx) => (
                <SwipeDeleteRow
                  key={tx.id}
                  onDelete={() => handleDeleteTransaction(tx.id)}
                  isDeleting={deletingId === tx.id}
                >
                  <div className="flex items-center justify-between p-3.5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                        tx.type === "INCOME" ? "bg-income/15 text-income" : "bg-expense/15 text-expense"
                      }`}>
                        {tx.categoryName ? tx.categoryName.charAt(0) : "•"}
                      </div>
                      <div>
                        <div className="text-[13px] font-semibold text-text truncate max-w-[180px]">
                          {tx.note || tx.categoryName || "Transaksi"}
                        </div>
                        <div className="text-[11px] text-text-secondary flex items-center gap-1.5">
                          <span>{tx.walletName || "Dompet"}</span>
                          {tx.categoryName && (
                            <>
                              <span>•</span>
                              <span>{tx.categoryName}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div
                      className={`text-[14px] font-bold whitespace-nowrap ${
                        tx.type === "INCOME" ? "text-income" : "text-expense"
                      }`}
                    >
                      {tx.type === "INCOME" ? "+" : "-"}
                      {formatCurrency(tx.amount)}
                    </div>
                  </div>
                </SwipeDeleteRow>
              ))}
            </div>
          </div>
        ))}

        {/* Empty State */}
        {!isLoading && transactions.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-chip text-text-secondary mx-auto flex items-center justify-center mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
            </div>
            <p className="text-[14px] font-semibold text-text mb-1">Tidak ada transaksi</p>
            <p className="text-[13px] text-text-secondary">
              {search || activeFilterCount > 0
                ? "Coba ubah kata kunci atau filter pencarian."
                : "Belum ada transaksi yang tercatat."}
            </p>
          </div>
        )}

        {/* Load More Button */}
        {!isLoading && hasMore && transactions.length > 0 && (
          <button
            onClick={() => fetchTransactions(true)}
            disabled={isLoadingMore}
            className="w-full py-3 bg-surface rounded-card border border-border text-[13px] font-semibold text-primary hover:bg-field/50 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
          >
            {isLoadingMore ? (
              <>
                <div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                <span>Memuat...</span>
              </>
            ) : (
              <span>Muat 30 Transaksi Lagi</span>
            )}
          </button>
        )}

        {/* Loading Skeleton */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="bg-surface rounded-card-lg border border-border p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-field" />
                  <div className="flex-1">
                    <div className="h-3 bg-field rounded w-2/3 mb-2" />
                    <div className="h-2.5 bg-field rounded w-1/3" />
                  </div>
                  <div className="h-4 bg-field rounded w-20" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </div>
  );
}
