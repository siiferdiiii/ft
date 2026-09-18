"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BottomNav } from "@/components/ui/BottomNav";
import { useAppData } from "@/lib/context/AppDataContext";
import { formatCurrency } from "@/lib/currency";
import { InfinityIcon, TrendingUpIcon, ShieldIcon, SparkleIcon } from "@/components/ui/Icons";
import { AccordionGroup, AccordionItem } from "@/components/ui/Accordion";
import { SimulatorACompoundModal } from "@/components/features/SimulatorACompoundModal";
import { SimulatorBSustainabilityModal } from "@/components/features/SimulatorBSustainabilityModal";
import { DanaAbadiStatsDto } from "@/lib/types";

export default function DanaAbadiPage() {
  const { wallets } = useAppData();

  const [stats, setStats] = useState<DanaAbadiStatsDto | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const cached = localStorage.getItem("ft_cache_dana_abadi_stats");
        if (cached) return JSON.parse(cached);
      } catch {}
    }
    return null;
  });
  const [allocationPercent, setAllocationPercent] = useState<number>(() => stats?.perpetualFundPercent ?? 10);
  const [isSavingPercent, setIsSavingPercent] = useState(false);
  const [percentSuccessMsg, setPercentSuccessMsg] = useState<string | null>(null);

  // Modals state
  const [isSimAOpen, setIsSimAOpen] = useState(false);
  const [isSimBOpen, setIsSimBOpen] = useState(false);
  const [savedSimulatedAmount, setSavedSimulatedAmount] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("ft_saved_simulated_investment");
      if (saved && !isNaN(Number(saved))) return Number(saved);
    }
    return 2818269939; // Default Rp 2.818.269.939
  });

  // Hitung total saldo dana abadi dari state terkini
  const danaAbadiWallets = wallets.filter((w) => Boolean(w.isPerpetualFund));
  const liveTotalBalance = danaAbadiWallets.reduce((sum, w) => sum + w.balance, 0);

  useEffect(() => {
    // Muat analitik statistik Dana Abadi
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/dana-abadi/stats");
        const json = await res.json();
        if (json.data) {
          setStats(json.data);
          setAllocationPercent(json.data.perpetualFundPercent ?? 10);
          if (typeof window !== "undefined") {
            try {
              localStorage.setItem("ft_cache_dana_abadi_stats", JSON.stringify(json.data));
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Gagal memuat statistik Dana Abadi:", err);
      }
    };

    fetchStats();
  }, [wallets]);

  const handleSavePercent = async () => {
    setIsSavingPercent(true);
    setPercentSuccessMsg(null);
    try {
      const res = await fetch("/api/user/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ perpetualFundPercent: allocationPercent }),
      });
      const json = await res.json();
      if (json.data) {
        setPercentSuccessMsg("Persentase alokasi berhasil disimpan!");
        setTimeout(() => setPercentSuccessMsg(null), 3000);
      }
    } catch {
      alert("Gagal menyimpan persentase alokasi");
    } finally {
      setIsSavingPercent(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col px-5 pt-6 pb-24 space-y-5">
      {/* Header & Tombol Kembali */}
      <div>
        <Link
          href="/dashboard/dompet"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-text-secondary hover:text-text mb-2 transition-colors"
        >
          <span>← Kembali ke Dompet</span>
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-[12px] font-medium text-text-secondary block">
              Prinsip Bayar Diri Sendiri Dulu
            </span>
            <h1 className="text-[20px] font-bold text-text flex items-center gap-2">
              <InfinityIcon className="w-5 h-5 text-primary" />
              <span>Dana Abadi</span>
            </h1>
          </div>
        </div>
      </div>

      {/* Hero Card Total Saldo Kumulatif Dana Abadi */}
      <div className="bg-surface p-5 rounded-card-lg border border-border relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-28 h-28 rounded-full bg-chip/50 pointer-events-none" />
        <span className="text-[12px] font-medium text-text-secondary block mb-1">
          Total Akumulasi Dana Abadi
        </span>
        <div className="text-[30px] font-bold text-primary tracking-tight">
          {formatCurrency(liveTotalBalance)}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
          <span>
            {danaAbadiWallets.length > 0
              ? `Tersimpan di ${danaAbadiWallets.length} dompet Dana Abadi`
              : "Belum ada dompet bertanda Dana Abadi"}
          </span>
          <span className="font-bold text-text">Target: {allocationPercent}% pemasukan</span>
        </div>
      </div>

      {/* Pengaturan Persentase Alokasi (User.perpetualFundPercent) */}
      <div className="bg-surface p-4 rounded-card-lg border border-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-text">Persentase Alokasi Pemasukan</h3>
            <span className="text-[11px] text-text-secondary">
              Disarankan menyisihkan minimal 10% dari setiap pemasukan
            </span>
          </div>
          <span className="text-[16px] font-bold text-primary">
            {allocationPercent}%
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={50}
          step={1}
          value={allocationPercent}
          onChange={(e) => setAllocationPercent(Number(e.target.value))}
          className="w-full accent-primary h-2 bg-field rounded-lg cursor-pointer"
        />

        <div className="flex justify-between text-[10px] text-text-secondary">
          <span>1%</span>
          <span>10% (Rekomendasi)</span>
          <span>50%</span>
        </div>

        {percentSuccessMsg && (
          <div className="text-[11px] text-income font-medium animate-in fade-in">
            ✓ {percentSuccessMsg}
          </div>
        )}

        <button
          type="button"
          disabled={isSavingPercent}
          onClick={handleSavePercent}
          className="w-full py-2 bg-field text-text text-[13px] font-semibold rounded-control hover:bg-border/60 transition-colors disabled:opacity-50"
        >
          {isSavingPercent ? "Menyimpan..." : "Perbarui Persentase Alokasi"}
        </button>
      </div>

      {/* Seksi Simulator & Edukasi dengan Dropdown / Accordion per referensi Less is More */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[12px] font-semibold text-text-secondary">
            Simulasi & Informasi
          </span>
          <span className="text-[11px] text-text-secondary">
            Sentuh untuk membuka
          </span>
        </div>

        <AccordionGroup>
          {/* Simulator A: Bayar Diri Sendiri */}
          <AccordionItem
            id="accordion-sim-a"
            title="Simulator: Bunga Majemuk 25 Tahun"
            subtitle="Hitung proyeksi akumulasi dari alokasi bulanan"
            icon={<TrendingUpIcon className="w-4 h-4" />}
            defaultOpen={false}
          >
            <div className="space-y-3 pt-1">
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Lihat visualisasi perbandingan nyata antara uang yang hanya didiamkan di rekening kas vs dibiarkan bertumbuh dengan imbal hasil majemuk selama 25 tahun ke depan.
              </p>
              <button
                type="button"
                onClick={() => setIsSimAOpen(true)}
                className="w-full py-2.5 bg-primary text-white text-[13px] font-bold rounded-control hover:opacity-90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span>Buka Simulator Bunga Majemuk</span>
                <span>↗</span>
              </button>
            </div>
          </AccordionItem>

          {/* Simulator B: Ketahanan 50 Tahun */}
          <AccordionItem
            id="accordion-sim-b"
            title="Simulator: Ketahanan 50 Tahun"
            subtitle="Uji apakah pokok Dana Abadi tidak akan pernah habis"
            icon={<ShieldIcon className="w-4 h-4" />}
            defaultOpen={false}
          >
            <div className="space-y-3 pt-1">
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Menguji ketahanan hasil investasi bunga majemuk 25 tahun Anda terhadap kebutuhan pengeluaran hidup tahunan agar pokok dana abadi tetap utuh selamanya.
              </p>
              <button
                type="button"
                onClick={() => setIsSimBOpen(true)}
                className="w-full py-2.5 bg-field text-text text-[13px] font-bold rounded-control hover:bg-border/60 active:scale-[0.98] transition-all border border-border flex items-center justify-center gap-2"
              >
                <span>Lihat Proyeksi Ketahanan</span>
                <span>↗</span>
              </button>
            </div>
          </AccordionItem>

          {/* Filosofi & Prinsip Dana Abadi */}
          <AccordionItem
            id="accordion-konsep"
            title="Kenapa Harus Menyisihkan 10%?"
            subtitle="Filosofi 'Pay Yourself First'"
            icon={<SparkleIcon className="w-4 h-4" />}
            defaultOpen={false}
          >
            <div className="space-y-2 pt-1 text-[12px] text-text-secondary leading-relaxed">
              <p>
                Dengan metode <strong className="text-text">Pay Yourself First</strong>, 10% disisihkan otomatis di awal setiap menerima pendapatan, sebelum dialokasikan untuk kebutuhan sehari-hari atau gaya hidup.
              </p>
              <p>
                Dana ini bukan dana darurat ataupun tabungan belanja, melainkan <em>mesin pencetak uang</em> pribadi yang pokoknya tidak boleh berkurang sehingga kelak imbal hasilnya dapat mendanai hidup Anda.
              </p>
            </div>
          </AccordionItem>

          {/* Akses Mitra Platform */}
          <AccordionItem
            id="accordion-mitra"
            title="Kembangkan Dana Abadi"
            subtitle="Pilihan instrumen reksadana, SBN, saham & emas"
            badge={
              <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded">
                Mitra OJK
              </span>
            }
            icon={<InfinityIcon className="w-4 h-4" />}
            defaultOpen={false}
          >
            <div className="space-y-3 pt-1">
              <p className="text-[12px] text-text-secondary leading-relaxed">
                Temukan daftar platform investasi resmi yang berizin dan diawasi oleh OJK/Bappebti untuk menempatkan alokasi dana Anda secara aman.
              </p>
              <Link
                href="/dashboard/investasi"
                className="inline-flex items-center justify-center gap-1.5 w-full py-2.5 bg-surface text-primary border border-primary/30 rounded-control text-[13px] font-bold hover:bg-chip/50 transition-all"
              >
                <span>Kembangkan Uangmu (Pilihan Platform)</span>
                <span>→</span>
              </Link>
            </div>
          </AccordionItem>
        </AccordionGroup>
      </div>

      {/* Modal Simulator A */}
      <SimulatorACompoundModal
        isOpen={isSimAOpen}
        onClose={() => setIsSimAOpen(false)}
        initialMonthlyAmount={stats?.monthlyAllocationAverage || 1500000}
        onSaveSimulation={(amount) => setSavedSimulatedAmount(amount)}
      />

      {/* Modal Simulator B */}
      <SimulatorBSustainabilityModal
        isOpen={isSimBOpen}
        onClose={() => setIsSimBOpen(false)}
        initialRealBalance={liveTotalBalance}
        initialMonthlySavings={stats?.monthlyAllocationAverage || 1500000}
        initialAnnualExpense={stats?.annualExpenseTotal || 36000000}
        savedSimulatedAmount={savedSimulatedAmount}
      />

      <BottomNav />
    </div>
  );
}
