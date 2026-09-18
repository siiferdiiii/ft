"use client";

import React, { useState, useEffect, useCallback } from "react";
import { BottomNav } from "@/components/ui/BottomNav";
import { GoalCard } from "@/components/features/GoalCard";
import { GoalFormModal } from "@/components/features/GoalFormModal";
import { QuickSaveGoalModal } from "@/components/features/QuickSaveGoalModal";
import { PlusIcon, TargetNavIcon } from "@/components/ui/Icons";
import { GoalDto } from "@/lib/types";
import { formatCurrency } from "@/lib/currency";
import { useAppData } from "@/lib/context/AppDataContext";

export default function GoalsPage() {
  const { wallets, refreshData } = useAppData();

  const [goals, setGoals] = useState<GoalDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "completed">("active");

  // Modal states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<GoalDto | null>(null);
  const [quickSaveGoal, setQuickSaveGoal] = useState<GoalDto | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const fetchGoals = useCallback(async () => {
    try {
      const res = await fetch("/api/goals");
      const json = await res.json();
      if (json.data) {
        setGoals(json.data);
      }
    } catch (err) {
      console.error("Gagal memuat daftar goal:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGoals();
  }, [fetchGoals]);

  const handleOpenCreate = () => {
    setEditingGoal(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (goal: GoalDto) => {
    setEditingGoal(goal);
    setIsFormOpen(true);
  };

  const handleArchive = async (goal: GoalDto) => {
    const hasBalance = goal.walletBalance > 0;
    const confirmMsg = hasBalance
      ? `Arsipkan goal "${goal.name}"? Sisa saldo ${formatCurrency(goal.walletBalance)} akan otomatis ditransfer balik ke dompet utama.`
      : `Yakin ingin mengarsipkan goal "${goal.name}"?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (res.ok) {
        if (json.data?.returnedBalance > 0) {
          setNotification(
            `Goal diarsipkan. Sisa saldo ${formatCurrency(json.data.returnedBalance)} telah dikembalikan ke dompet utama.`
          );
        } else {
          setNotification("Goal berhasil diarsipkan.");
        }
        fetchGoals();
        refreshData(true);
      } else {
        alert(json.error?.message || "Gagal mengarsipkan goal");
      }
    } catch {
      alert("Terjadi kendala jaringan saat mengarsipkan goal");
    }
  };

  // Filter goals
  const activeGoals = goals.filter((g) => !g.isCompleted && g.walletBalance < g.targetAmount);
  const completedGoals = goals.filter((g) => g.isCompleted || g.walletBalance >= g.targetAmount);

  // Hitung akumulasi
  const totalSaved = goals.reduce((sum, g) => sum + g.walletBalance, 0);
  const totalTarget = goals.reduce((sum, g) => sum + g.targetAmount, 0);

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      {/* Header Halaman */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-[12px] font-medium text-text-secondary block">
            Tabungan Bertujuan
          </span>
          <h1 className="text-[20px] font-bold text-text flex items-center gap-2">
            <TargetNavIcon className="w-5 h-5 text-primary" />
            <span>Goals Saya</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-control text-[13px] font-semibold hover:opacity-90 active:scale-95 transition-all shadow-xs"
        >
          <PlusIcon className="w-4 h-4" />
          <span>Goal Baru</span>
        </button>
      </div>

      {/* Notification Banner */}
      {notification && (
        <div className="p-3 bg-primary/10 text-primary text-[12px] font-medium rounded-control border border-primary/20 flex items-center justify-between animate-in fade-in">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="ml-2 font-bold hover:opacity-75"
          >
            ✕
          </button>
        </div>
      )}

      {/* Summary Card Akumulasi Goals */}
      <div className="p-4 bg-surface rounded-card-lg border border-border shadow-xs">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] font-medium text-text-secondary block mb-1">
              Total Terkumpul di Goals
            </span>
            <div className="text-[18px] font-bold text-text">
              {isLoading ? "..." : formatCurrency(totalSaved)}
            </div>
            <span className="text-[10px] text-text-secondary">
              dari total target {formatCurrency(totalTarget)}
            </span>
          </div>

          <div className="border-l border-border pl-4">
            <span className="text-[11px] font-medium text-text-secondary block mb-1">
              Status Capaian
            </span>
            <div className="text-[18px] font-bold text-primary">
              {completedGoals.length} / {goals.length}
            </div>
            <span className="text-[10px] text-text-secondary">
              Goal telah tercapai
            </span>
          </div>
        </div>
      </div>

      {/* Tab Filter (Aktif vs Tercapai) */}
      <div className="flex gap-2 p-1 bg-field rounded-control">
        <button
          type="button"
          onClick={() => setActiveTab("active")}
          className={`flex-1 py-1.5 text-[12px] font-semibold rounded-control transition-all ${
            activeTab === "active"
              ? "bg-surface text-primary shadow-xs"
              : "text-text-secondary hover:text-text"
          }`}
        >
          Aktif ({activeGoals.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`flex-1 py-1.5 text-[12px] font-semibold rounded-control transition-all ${
            activeTab === "completed"
              ? "bg-surface text-primary shadow-xs"
              : "text-text-secondary hover:text-text"
          }`}
        >
          Tercapai ({completedGoals.length})
        </button>
      </div>

      {/* List Goal Cards */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="py-10 text-center text-[13px] text-text-secondary">
            Memuat daftar tujuan tabungan...
          </div>
        ) : activeTab === "active" ? (
          activeGoals.length > 0 ? (
            activeGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onQuickSave={(g) => setQuickSaveGoal(g)}
                onEdit={handleOpenEdit}
                onArchive={handleArchive}
              />
            ))
          ) : (
            <div className="p-8 bg-surface rounded-card-lg border border-dashed border-border text-center space-y-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <TargetNavIcon className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-[14px] font-bold text-text">Belum ada goal aktif</h4>
                <p className="text-[12px] text-text-secondary mt-1">
                  Mulai tetapkan tujuan finansialmu, misal: beli motor, gadget, atau liburan.
                </p>
              </div>
              <button
                type="button"
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-[12px] font-semibold rounded-control hover:opacity-90 transition-all"
              >
                <PlusIcon className="w-3.5 h-3.5" />
                <span>Buat Goal Pertama</span>
              </button>
            </div>
          )
        ) : (
          completedGoals.length > 0 ? (
            completedGoals.map((goal) => (
              <GoalCard
                key={goal.id}
                goal={goal}
                onQuickSave={(g) => setQuickSaveGoal(g)}
                onEdit={handleOpenEdit}
                onArchive={handleArchive}
              />
            ))
          ) : (
            <div className="py-10 text-center text-[13px] text-text-secondary">
              Belum ada goal yang tercapai. Tetap konsisten menabung!
            </div>
          )
        )}
      </div>

      {/* Modal Form Tambah/Edit Goal */}
      <GoalFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={() => {
          fetchGoals();
          refreshData(true);
        }}
        editingGoal={editingGoal}
      />

      {/* Modal Quick Save / Setor Tabungan */}
      <QuickSaveGoalModal
        isOpen={Boolean(quickSaveGoal)}
        onClose={() => setQuickSaveGoal(null)}
        goal={quickSaveGoal}
        wallets={wallets}
        onSuccess={() => {
          fetchGoals();
          refreshData(true);
        }}
      />

      {/* Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
