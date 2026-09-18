"use client";

import React, { useState } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { TransferModal } from "@/components/features/TransferModal";
import { WalletFormModal } from "@/components/features/WalletFormModal";
import { PlusIcon, TransferIcon, TrashIcon, EditIcon, WalletIcon, InfinityIcon, TrendingUpIcon, ScaleIcon } from "@/components/ui/Icons";
import { SimulatorACompoundModal } from "@/components/features/SimulatorACompoundModal";
import { WalletDto, WalletType } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { useAppData } from "@/lib/context/AppDataContext";

export default function WalletsPage() {
  const {
    wallets,
    isInitialLoading: isLoading,
    refreshData,
    mutateWallets,
  } = useAppData();

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isSimAOpen, setIsSimAOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletDto | null>(null);

  const loadWallets = () => refreshData(true);

  // Total saldo Dana Abadi saat ini
  const totalDanaAbadi = wallets
    .filter((w) => Boolean(w.isPerpetualFund))
    .reduce((sum, w) => sum + w.balance, 0);

  const handleOpenCreate = () => {
    setEditingWallet(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (w: WalletDto) => {
    setEditingWallet(w);
    setIsCreateModalOpen(true);
  };

  const handleSaveWallet = async (data: {
    name: string;
    type: WalletType;
    initialBalance?: number;
    isPerpetualFund: boolean;
    editingId?: string;
  }) => {
    if (data.editingId) {
      // Edit dompet
      const res = await fetch(`/api/wallets/${data.editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          isPerpetualFund: data.isPerpetualFund,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { success: false, error: json.error?.message || "Gagal memperbarui dompet" };
      }
      mutateWallets((prev) =>
        prev.map((w) =>
          w.id === data.editingId
            ? { ...w, name: data.name, type: data.type, isPerpetualFund: data.isPerpetualFund }
            : w
        )
      );
    } else {
      const res = await fetch("/api/wallets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          type: data.type,
          initialBalance: data.initialBalance,
          isPerpetualFund: data.isPerpetualFund,
        }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        return { success: false, error: json.error?.message || "Gagal membuat dompet" };
      }
      if (json.data) {
        mutateWallets((prev) => [...prev, json.data]);
      }
    }

    refreshData(true);
    return { success: true };
  };

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm("Arsipkan atau hapus dompet ini?")) return;

    mutateWallets((prev) => prev.filter((w) => w.id !== walletId));
    try {
      const res = await fetch(`/api/wallets/${walletId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error?.message || "Gagal menghapus dompet");
        refreshData(true);
        return;
      }
      refreshData(true);
    } catch {
      alert("Terjadi kesalahan jaringan");
      refreshData(true);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Pengelolaan Rekening & Kas
          </span>
          <h1 className="text-[20px] font-bold text-text">Daftar Dompet</h1>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-control text-[13px] font-semibold hover:opacity-90 transition-all"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Tambah</span>
        </button>
      </div>

      {/* Tombol aksi Transfer Antar Dompet */}
      {wallets.length >= 2 && (
        <button
          type="button"
          onClick={() => setIsTransferModalOpen(true)}
          className="w-full flex items-center justify-center gap-2 p-3 bg-surface text-primary border border-primary/30 rounded-card-wallet font-semibold text-[14px] hover:bg-chip/50 transition-colors"
        >
          <TransferIcon className="w-4 h-4 text-primary" />
          <span>Transfer Antar Dompet</span>
        </button>
      )}

      {/* Tombol Akses Fitur: Dana Abadi & Kembangkan Uangmu (Sesuai Preferensi: di Halaman Dompet) */}
      <div className="grid grid-cols-2 gap-2.5">
        <Link
          href="/dashboard/dana-abadi"
          className="p-3.5 bg-surface rounded-card-wallet border border-primary/30 hover:border-primary flex flex-col justify-between transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <InfinityIcon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
              Buka →
            </span>
          </div>
          <div>
            <span className="text-[13px] font-bold text-text block">Dana Abadi</span>
            <span className="text-[11px] text-text-secondary">
              {totalDanaAbadi > 0 ? formatCurrency(totalDanaAbadi) : "Alokasi 10%"}
            </span>
          </div>
        </Link>

        <Link
          href="/dashboard/investasi"
          className="p-3.5 bg-surface rounded-card-wallet border border-border hover:border-text-secondary/40 flex flex-col justify-between transition-all group"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-7 h-7 rounded-full bg-chip text-primary flex items-center justify-center">
              <TrendingUpIcon className="w-4 h-4" />
            </div>
            <span className="text-[11px] font-bold text-text-secondary group-hover:translate-x-0.5 transition-transform">
              Buka →
            </span>
          </div>
          <div>
            <span className="text-[13px] font-bold text-text block">Kembangkan</span>
            <span className="text-[11px] text-text-secondary">Mitra Investasi OJK</span>
          </div>
        </Link>

        {/* Card Akses Aset & Utang / Kekayaan Bersih (Opsi A) */}
        <Link
          href="/dashboard/aset-utang"
          className="col-span-2 p-3.5 bg-surface rounded-card-wallet border border-border hover:border-primary/50 flex items-center justify-between transition-all group shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ScaleIcon className="w-4 h-4" />
            </div>
            <div>
              <span className="text-[13px] font-bold text-text block">Aset & Utang (Kekayaan Bersih)</span>
              <span className="text-[11px] text-text-secondary">
                Lacak aset fisik/investasi, kewajiban utang, & liquid cash T+3
              </span>
            </div>
          </div>
          <span className="text-[11px] font-bold text-primary group-hover:translate-x-0.5 transition-transform">
            Buka →
          </span>
        </Link>
      </div>

      {/* List Dompet */}
      <div className="space-y-3">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className={`p-4 rounded-card-wallet border flex items-center justify-between transition-all ${
              wallet.isPerpetualFund
                ? "bg-surface border-2 border-primary/40 shadow-xs hover:border-primary/60"
                : "bg-surface border border-border"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center bg-chip text-primary flex-shrink-0">
                {wallet.isPerpetualFund ? (
                  <InfinityIcon className="w-5 h-5" />
                ) : (
                  <WalletIcon className="w-5 h-5" />
                )}
              </div>
              <div>
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block mb-0.5">
                  {wallet.type}
                </span>
                <span className="text-[15px] font-semibold text-text block">
                  {wallet.name}
                </span>
                <span className="text-[14px] font-bold text-text">
                  {formatCurrency(wallet.balance)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              {wallet.isPerpetualFund && (
                <div
                  className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-1"
                  title="Dana Abadi"
                >
                  <InfinityIcon className="w-3.5 h-3.5" />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleOpenEdit(wallet)}
                className="p-2 text-text-secondary hover:text-text hover:bg-field rounded-control transition-colors"
                title="Edit dompet"
              >
                <EditIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => handleDeleteWallet(wallet.id)}
                className="p-2 text-text-secondary hover:text-expense hover:bg-field rounded-control transition-colors"
                title="Arsipkan dompet"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}

        {wallets.length === 0 && !isLoading && (
          <div className="py-8 text-center text-[13px] text-text-secondary bg-surface rounded-card-lg border border-border">
            Belum ada dompet terdaftar. Klik "+ Tambah" di atas untuk membuat dompet baru.
          </div>
        )}
      </div>

      {/* Modal Tambah / Edit Dompet */}
      <WalletFormModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        editingWallet={editingWallet}
        onSave={handleSaveWallet}
        onPerpetualActivated={() => setIsSimAOpen(true)}
      />

      {/* Modal Transfer Antar Dompet */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={loadWallets}
        wallets={wallets}
      />

      {/* Modal Simulator A saat mengaktifkan Dana Abadi per PRD §3.3 */}
      <SimulatorACompoundModal
        isOpen={isSimAOpen}
        onClose={() => setIsSimAOpen(false)}
      />

      <BottomNav />
    </div>
  );
}
