"use client";

import React, { useState, useEffect } from "react";
import { AssetDto, AssetLiquidityTier } from "@/lib/types";
import { CloseIcon, ScaleIcon } from "@/components/ui/Icons";

interface AssetFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAsset?: AssetDto | null;
}

const CATEGORY_SUGGESTIONS = [
  "Investasi",
  "Properti",
  "Kendaraan",
  "Tabungan",
  "Logam Mulia",
  "Elektronik",
  "Koleksi",
];

export const AssetFormModal: React.FC<AssetFormModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  editingAsset,
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [value, setValue] = useState<string>("");
  const [liquidityTier, setLiquidityTier] = useState<AssetLiquidityTier>("T3");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (editingAsset) {
      setName(editingAsset.name);
      setCategory(editingAsset.category);
      setValue(editingAsset.value.toString());
      setLiquidityTier(editingAsset.liquidityTier);
    } else {
      setName("");
      setCategory("");
      setValue("");
      setLiquidityTier("T3");
    }
    setErrorMsg(null);
  }, [editingAsset, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const numericValue = parseFloat(value);
    if (!name.trim()) {
      setErrorMsg("Nama aset wajib diisi");
      return;
    }
    if (!category.trim()) {
      setErrorMsg("Kategori aset wajib diisi");
      return;
    }
    if (isNaN(numericValue) || numericValue < 0) {
      setErrorMsg("Nilai aset tidak boleh negatif");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingAsset ? `/api/assets/${editingAsset.id}` : "/api/assets";
      const method = editingAsset ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          value: numericValue,
          liquidityTier,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMsg(json.error?.message || "Gagal menyimpan data aset");
        return;
      }

      onSuccess();
      onClose();
    } catch {
      setErrorMsg("Terjadi kendala jaringan");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-md bg-surface rounded-card-lg border border-border shadow-xl p-5 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <ScaleIcon className="w-4 h-4" />
            </div>
            <h2 className="text-[16px] font-bold text-text">
              {editingAsset ? "Perbarui Data Aset" : "Tambah Aset Baru"}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-text-secondary hover:text-text rounded-control hover:bg-field"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-2.5 bg-expense/10 text-expense text-[12px] font-medium rounded-control border border-expense/20">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Nama Aset */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Nama Aset
            </label>
            <input
              type="text"
              required
              placeholder="Contoh: Rumah di Bandung, Emas Antam 10gr"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Kategori Aset (Bebas teks per PRD_ASET_UTANG §2.2) */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Kategori
            </label>
            <input
              type="text"
              required
              placeholder="Ketik kategori bebas (misal: Investasi, Properti)"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
            {/* Saran kategori cepat */}
            <div className="flex gap-1.5 mt-1.5 flex-wrap">
              {CATEGORY_SUGGESTIONS.map((sug) => (
                <button
                  key={sug}
                  type="button"
                  onClick={() => setCategory(sug)}
                  className="px-2 py-0.5 bg-field hover:bg-border/60 text-text-secondary text-[10px] font-medium rounded-control border border-border/80"
                >
                  {sug}
                </button>
              ))}
            </div>
          </div>

          {/* Nilai Terkini (Rp) */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Nilai Estimasi Terkini (Rp)
            </label>
            <input
              type="number"
              required
              min="0"
              step="1000"
              placeholder="0"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-full px-3 py-2 bg-field text-text text-[14px] font-bold rounded-control border border-border focus:outline-hidden focus:border-primary"
            />
          </div>

          {/* Tingkat Likuiditas (Bahasa Awam per PRD_ASET_UTANG §2.2) */}
          <div>
            <label className="block text-[12px] font-semibold text-text mb-1">
              Kemudahan Pencairan Dana
            </label>
            <select
              value={liquidityTier}
              onChange={(e) => setLiquidityTier(e.target.value as AssetLiquidityTier)}
              className="w-full px-3 py-2 bg-field text-text text-[13px] rounded-control border border-border focus:outline-hidden focus:border-primary"
            >
              <option value="INSTANT">
                Bisa dicairkan hari ini (e-wallet, tabungan, deposito fleksibel)
              </option>
              <option value="T3">
                Butuh proses ~3 hari kerja (reksadana, saham, obligasi ritel)
              </option>
              <option value="ILLIQUID">
                Susah dicairkan cepat (properti, kendaraan, barang koleksi)
              </option>
            </select>
            <p className="text-[11px] text-text-secondary mt-1">
              Aset dengan opsi &quot;hari ini&quot; atau &quot;~3 hari&quot; otomatis masuk ke hitungan uang yang bisa dicairkan cepat.
            </p>
          </div>

          {/* Tombol Simpan */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-[13px] font-semibold text-text-secondary hover:text-text rounded-control hover:bg-field transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
            >
              {isSubmitting
                ? "Menyimpan..."
                : editingAsset
                ? "Simpan Perubahan"
                : "Tambah Aset"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
