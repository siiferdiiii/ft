"use client";

import React, { useState, useEffect } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { Button } from "@/components/ui/Button";
import { TransferModal } from "@/components/features/TransferModal";
import { PlusIcon, TransferIcon, TrashIcon, EditIcon, WalletIcon } from "@/components/ui/Icons";
import { WalletDto, WalletType } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";

export default function WalletsPage() {
  const [wallets, setWallets] = useState<WalletDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [editingWallet, setEditingWallet] = useState<WalletDto | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [type, setType] = useState<WalletType>("CASH");
  const [initialBalance, setInitialBalance] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadWallets = async () => {
    try {
      const res = await fetch("/api/wallets");
      const json = await res.json();
      if (json.data) {
        setWallets(json.data);
      }
    } catch (err) {
      console.error("Gagal memuat dompet:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallets();
  }, []);

  const handleOpenCreate = () => {
    setEditingWallet(null);
    setName("");
    setType("CASH");
    setInitialBalance("");
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const handleOpenEdit = (w: WalletDto) => {
    setEditingWallet(w);
    setName(w.name);
    setType(w.type);
    setInitialBalance("");
    setErrorMessage(null);
    setIsCreateModalOpen(true);
  };

  const handleSaveWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!name.trim()) {
      setErrorMessage("Nama dompet wajib diisi");
      return;
    }

    setIsSaving(true);
    try {
      if (editingWallet) {
        // Edit dompet
        const res = await fetch(`/api/wallets/${editingWallet.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim(), type }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message || "Gagal memperbarui dompet");
          return;
        }
      } else {
        // Buat dompet baru
        const bal = parseFloat(initialBalance.replace(/[^0-9.]/g, "")) || 0;
        const res = await fetch("/api/wallets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: name.trim(),
            type,
            initialBalance: bal,
          }),
        });
        const json = await res.json();
        if (!res.ok || json.error) {
          setErrorMessage(json.error?.message || "Gagal membuat dompet");
          return;
        }
      }

      await loadWallets();
      setIsCreateModalOpen(false);
    } catch {
      setErrorMessage("Terjadi kesalahan koneksi saat menyimpan dompet");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWallet = async (walletId: string) => {
    if (!confirm("Arsipkan atau hapus dompet ini?")) return;

    try {
      const res = await fetch(`/api/wallets/${walletId}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        alert(json.error?.message || "Gagal menghapus dompet");
        return;
      }
      await loadWallets();
    } catch {
      alert("Terjadi kesalahan jaringan");
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

      {/* List Dompet */}
      <div className="space-y-3">
        {wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="bg-surface p-4 rounded-card-wallet border border-border flex items-center justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-chip flex items-center justify-center text-primary">
                <WalletIcon className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-text-secondary uppercase tracking-wider block">
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
      <BottomSheet
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={editingWallet ? "Edit Dompet" : "Tambah Dompet Baru"}
      >
        <form onSubmit={handleSaveWallet} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Nama Dompet
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Cash Harian, BCA, GoPay"
              required
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Tipe Dompet
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as WalletType)}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            >
              <option value="CASH">Tunai (Cash)</option>
              <option value="EWALLET">E-Wallet (GoPay, OVO, ShopeePay)</option>
              <option value="BANK">Rekening Bank</option>
              <option value="OTHER">Lainnya</option>
            </select>
          </div>

          {!editingWallet && (
            <div>
              <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
                Saldo Awal (Rp)
              </label>
              <input
                type="number"
                value={initialBalance}
                onChange={(e) => setInitialBalance(e.target.value)}
                placeholder="0"
                className="w-full bg-field text-text text-[20px] font-bold px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
              />
            </div>
          )}

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth isLoading={isSaving}>
              {editingWallet ? "Simpan Perubahan" : "Buat Dompet"}
            </Button>
          </div>
        </form>
      </BottomSheet>

      {/* Modal Transfer Antar Dompet */}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        onSuccess={loadWallets}
        wallets={wallets}
      />

      <BottomNav />
    </div>
  );
}
