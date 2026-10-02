"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/ui/BottomNav";
import { formatCurrency } from "@/lib/currency";
import { UserProfileDto } from "@/lib/types";
import { PRODUCT_PACKAGES, ProductPackage } from "@/lib/constants/products";

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [credMsg, setCredMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [selectedPkgForBuy, setSelectedPkgForBuy] = useState<ProductPackage | null>(null);
  const [isCopiedAndProceeding, setIsCopiedAndProceeding] = useState(false);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch("/api/user/profile");
        const json = await res.json();
        if (json.data) setProfile(json.data);
      } catch {
        // Silent fail
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const handleConfirmBuyAndCopy = async () => {
    if (!selectedPkgForBuy) return;
    if (profile?.userCode) {
      try {
        await navigator.clipboard.writeText(profile.userCode);
      } catch {
        // Silent fallback
      }
    }
    setIsCopiedAndProceeding(true);
    setTimeout(() => {
      window.open(selectedPkgForBuy.lynkUrl, "_blank", "noopener,noreferrer");
      setIsCopiedAndProceeding(false);
      setSelectedPkgForBuy(null);
    }, 700);
  };

  const handleSaveCredentials = async () => {
    if (!newEmail && !newPassword) {
      setCredMsg({ type: "error", text: "Masukkan email baru atau kata sandi baru." });
      return;
    }
    setIsSavingCredentials(true);
    setCredMsg(null);
    try {
      const res = await fetch("/api/user/credentials", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(newEmail ? { email: newEmail } : {}),
          ...(newPassword ? { password: newPassword } : {}),
        }),
      });
      const json = await res.json();
      if (json.data) {
        setCredMsg({ type: "success", text: "Akun berhasil diperbarui." });
        if (newEmail && profile) setProfile({ ...profile, email: newEmail });
        setNewEmail("");
        setNewPassword("");
      } else {
        setCredMsg({ type: "error", text: json.error?.message || "Gagal memperbarui akun." });
      }
    } catch {
      setCredMsg({ type: "error", text: "Terjadi kesalahan. Coba lagi." });
    } finally {
      setIsSavingCredentials(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch { /* ignore */ }
    router.push("/login");
  };

  const tierLabel = profile?.tier === "PRO" ? "PRO" : "Gratis";

  // Quota metrics for progress bars
  const isQuotaEmpty = (profile?.ocrQuota ?? 0) === 0 || (profile?.aiBudgetQuota ?? 0) === 0;
  const ocrCap = Math.max(20, profile?.ocrQuota ?? 0);
  const aiCap = Math.max(5, profile?.aiBudgetQuota ?? 0);
  const ocrPercent = Math.min(100, Math.round(((profile?.ocrQuota ?? 0) / ocrCap) * 100));
  const aiPercent = Math.min(100, Math.round(((profile?.aiBudgetQuota ?? 0) / aiCap) * 100));

  // Sort popular first to maximize conversion anchoring
  const sortedPackages = [...PRODUCT_PACKAGES].sort((a, b) => {
    if (a.popular && !b.popular) return -1;
    if (!a.popular && b.popular) return 1;
    return 0;
  });

  return (
    <div className="flex-1 flex flex-col pb-28 min-h-screen bg-background">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 flex items-center gap-3">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-chip transition-colors"
          aria-label="Kembali"
        >
          <svg className="w-5 h-5 text-text" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-text">Profil</h1>
          <p className="text-[12px] text-text-secondary">Pengaturan Akun & Kuota</p>
        </div>
      </div>

      <div className="flex-1 px-5 space-y-4 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-surface rounded-card-lg animate-pulse border border-border" />
            ))}
          </div>
        ) : (
          <>
            {/* User Identity Card */}
            <div className="bg-surface rounded-card-lg border border-border p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                  {profile?.name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase() || "U"}
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] font-semibold bg-field text-text px-2.5 py-1 rounded-full border border-border">
                    {profile?.userCode || "FT-XXXXX"}
                  </span>
                  <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                    profile?.tier === "PRO"
                      ? "bg-amber-500/10 text-amber-400 border-amber-400/30"
                      : "bg-chip text-text-secondary border-border"
                  }`}>
                    {tierLabel}
                  </span>
                </div>
              </div>
              <div className="text-[15px] font-bold text-text mb-0.5">
                {profile?.name || "Pengguna"}
              </div>
              <div className="text-[12px] text-text-secondary">{profile?.email}</div>
            </div>

            {/* Kuota Penggunaan dengan Visual Progress */}
            <div className="bg-surface rounded-card-lg border border-border p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide">
                  Sisa Kuota AI
                </p>
                {isQuotaEmpty ? (
                  <span className="text-[10px] font-bold text-expense bg-expense/10 px-2.5 py-0.5 rounded-full border border-expense/20">
                    Perlu Diisi Ulang
                  </span>
                ) : (
                  <span className="text-[10px] font-semibold text-income bg-income/10 px-2 py-0.5 rounded-full">
                    Aktif
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-field rounded-control p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <div className={`text-[26px] font-bold ${
                        (profile?.ocrQuota ?? 0) > 0 ? "text-primary" : "text-expense"
                      }`}>
                        {profile?.ocrQuota ?? 0}
                      </div>
                      <span className="text-[10px] text-text-secondary">kali</span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-medium mt-0.5">Scan Resi AI</div>
                  </div>
                  <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        (profile?.ocrQuota ?? 0) > 0 ? "bg-primary" : "bg-expense"
                      }`}
                      style={{ width: `${(profile?.ocrQuota ?? 0) === 0 ? 0 : Math.max(10, ocrPercent)}%` }}
                    />
                  </div>
                </div>

                <div className="bg-field rounded-control p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-baseline justify-between">
                      <div className={`text-[26px] font-bold ${
                        (profile?.aiBudgetQuota ?? 0) > 0 ? "text-primary" : "text-expense"
                      }`}>
                        {profile?.aiBudgetQuota ?? 0}
                      </div>
                      <span className="text-[10px] text-text-secondary">sesi</span>
                    </div>
                    <div className="text-[11px] text-text-secondary font-medium mt-0.5">Susun Budget AI</div>
                  </div>
                  <div className="w-full bg-border/60 h-1.5 rounded-full overflow-hidden mt-3">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        (profile?.aiBudgetQuota ?? 0) > 0 ? "bg-primary" : "bg-expense"
                      }`}
                      style={{ width: `${(profile?.aiBudgetQuota ?? 0) === 0 ? 0 : Math.max(10, aiPercent)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Urgency Alert saat kuota 0 */}
              {isQuotaEmpty && (
                <div className="mt-3.5 bg-expense/10 border border-expense/25 rounded-control p-3.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[12px] font-bold text-text flex items-center gap-1.5">
                      <span className="text-expense">⚠️</span> Kuota Anda Telah Habis
                    </div>
                    <p className="text-[11px] text-text-secondary mt-0.5 leading-snug">
                      Pencatatan nota otomatis nonaktif. Beli paket di bawah untuk langsung aktifkan kembali.
                    </p>
                  </div>
                  <button
                    onClick={() => document.getElementById("section-paket")?.scrollIntoView({ behavior: "smooth" })}
                    className="shrink-0 bg-primary text-white text-[11px] font-bold px-3 py-2 rounded-full active:scale-95 transition-transform shadow-[0_4px_12px_rgba(78,68,229,0.3)] whitespace-nowrap"
                  >
                    Isi Kuota
                  </button>
                </div>
              )}
            </div>

            {/* Paket Produk (Redesigned with Urgency & Price Anchoring) */}
            <div id="section-paket" className="scroll-mt-4">
              <div className="flex items-center justify-between mb-2.5 px-1">
                <div>
                  <p className="text-[12px] font-bold text-text uppercase tracking-wide">
                    Pilihan Paket Kuota
                  </p>
                  <p className="text-[11px] text-text-secondary">
                    Kuota permanen tanpa masa hangus
                  </p>
                </div>
                <span className="text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                  ⚡ Auto-Aktif
                </span>
              </div>

              <div className="space-y-3.5">
                {sortedPackages.map((pkg) => {
                  const pricePerScan = Math.round(pkg.price / pkg.ocrQuota);
                  const isPopular = pkg.popular && !pkg.comingSoon;

                  return (
                    <div
                      key={pkg.id}
                      className={`bg-surface rounded-card-lg border relative overflow-hidden transition-all duration-200 ${
                        pkg.comingSoon
                          ? "border-border opacity-70"
                          : isPopular
                          ? "border-2 border-primary shadow-[0_10px_26px_rgba(78,68,229,0.16)]"
                          : "border-border hover:border-primary/40"
                      } p-4`}
                    >
                      {/* Badge Top Header */}
                      {isPopular && (
                        <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-3 py-1 rounded-bl-control shadow-sm flex items-center gap-1">
                          <span>⭐</span> Paling Diminati • Terlaris
                        </div>
                      )}

                      {pkg.comingSoon && (
                        <div className="absolute top-0 right-0 bg-chip text-text-secondary text-[10px] font-bold px-3 py-1 rounded-bl-control">
                          🔒 Segera Hadir
                        </div>
                      )}

                      {!isPopular && !pkg.comingSoon && pkg.badge && (
                        <span className="text-[10px] font-bold text-text-secondary bg-chip px-2.5 py-0.5 rounded-full mb-2 inline-block">
                          {pkg.badge}
                        </span>
                      )}

                      {/* Header Title & Price */}
                      <div className="flex items-start justify-between mb-1 mt-1">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[15px] font-bold text-text">{pkg.name}</h3>
                          </div>
                          <p className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">
                            {pkg.description}
                          </p>
                        </div>
                        <div className="text-right ml-2 shrink-0">
                          <div className={`text-[17px] font-bold ${pkg.comingSoon ? "text-text-secondary" : "text-primary"}`}>
                            {formatCurrency(pkg.price)}
                          </div>
                          {!pkg.comingSoon && (
                            <div className="text-[10px] font-semibold text-text-secondary mt-0.5">
                              Hanya <span className="text-primary font-bold">Rp{pricePerScan.toLocaleString("id-ID")}</span>/scan
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Feature Quota Badges */}
                      <div className="flex flex-wrap gap-1.5 my-3">
                        <span className={`text-[10px] font-semibold rounded-full px-2.5 py-1 ${pkg.comingSoon ? "bg-chip text-text-secondary" : "bg-primary/10 text-primary"}`}>
                          📷 {pkg.ocrQuota}x Scan Resi AI
                        </span>
                        <span className={`text-[10px] font-semibold rounded-full px-2.5 py-1 ${pkg.comingSoon ? "bg-chip text-text-secondary" : "bg-income/10 text-income"}`}>
                          🤖 {pkg.aiBudgetQuota}x Susun Budget AI
                        </span>
                        <span className="text-[10px] font-semibold bg-field text-text-secondary rounded-full px-2.5 py-1">
                          ∞ Tanpa Kedaluwarsa
                        </span>
                      </div>

                      {/* Social proof/urgency note for popular package */}
                      {isPopular && (
                        <div className="mb-3 text-[11px] font-medium text-primary bg-primary/5 rounded-control px-3 py-1.5 flex items-center gap-1.5">
                          <span>🔥</span>
                          <span>Pilihan utama pengguna aktif untuk hemat pengeluaran.</span>
                        </div>
                      )}

                      {/* Buy Action Button */}
                      {pkg.comingSoon ? (
                        <div className="w-full text-center py-2.5 rounded-control text-[13px] font-semibold text-text-secondary bg-chip cursor-not-allowed select-none">
                          Segera Hadir
                        </div>
                      ) : (
                        <button
                          type="button"
                          id={`btn-buy-${pkg.id}`}
                          onClick={() => setSelectedPkgForBuy(pkg)}
                          className={`w-full py-3 rounded-control text-[13px] font-bold transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 ${
                            isPopular
                              ? "bg-primary text-white hover:opacity-95 shadow-[0_6px_18px_rgba(78,68,229,0.3)]"
                              : "bg-chip text-primary hover:bg-primary/15 border border-primary/25"
                          }`}
                        >
                          <span>{isPopular ? "Pilih Paket Terlaris" : "Beli Paket Ini"}</span>
                          <span>→</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Garansi & Cara Beli Singkat */}
              <div className="mt-3.5 bg-field border border-border rounded-control p-3.5 space-y-1.5">
                <p className="text-[11px] font-bold text-text flex items-center gap-1.5">
                  <span>ℹ️</span> Cara Pengisian Kuota
                </p>
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  Pilih paket di atas, salin ID akun Anda melalui pop-up, lalu tempelkan di catatan checkout Lynk.id. Kuota langsung aktif dalam hitungan menit.
                </p>
              </div>
            </div>

            {/* Ubah Akun */}
            <div className="bg-surface rounded-card-lg border border-border p-5">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-4">
                Pengaturan Akun
              </p>

              {credMsg && (
                <div className={`mb-3 p-3 text-[12px] font-medium rounded-control ${
                  credMsg.type === "success"
                    ? "bg-income/10 text-income"
                    : "bg-expense/10 text-expense"
                }`}>
                  {credMsg.text}
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1.5">
                    Email Baru
                  </label>
                  <input
                    id="input-new-email"
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder={profile?.email || "email@baru.com"}
                    className="w-full bg-field text-text text-[13px] px-3 py-2.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary/60"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-text-secondary mb-1.5">
                    Kata Sandi Baru
                  </label>
                  <input
                    id="input-new-password"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Kata sandi baru (min. 6 karakter)"
                    className="w-full bg-field text-text text-[13px] px-3 py-2.5 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none placeholder:text-text-secondary/60"
                  />
                </div>
                <button
                  id="btn-save-credentials"
                  onClick={handleSaveCredentials}
                  disabled={isSavingCredentials}
                  className="w-full bg-primary text-white text-[13px] font-bold py-2.5 rounded-control hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {isSavingCredentials ? "Menyimpan..." : "Simpan Perubahan"}
                </button>
              </div>
            </div>

            {/* Logout */}
            <div className="pb-2">
              <button
                id="btn-logout"
                onClick={handleLogout}
                className="w-full py-3 text-[13px] font-semibold text-expense bg-expense/5 hover:bg-expense/10 rounded-control transition-colors"
              >
                Keluar dari Akun
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sticky Bottom Quota Warning Bar */}
      {isQuotaEmpty && (
        <div className="fixed bottom-[82px] min-[375px]:bottom-[86px] inset-x-0 z-30 px-4 flex justify-center pointer-events-none">
          <div className="w-full max-w-md bg-text text-white rounded-control px-4 py-3 shadow-[0_12px_32px_rgba(20,20,31,0.28)] flex items-center justify-between gap-3 pointer-events-auto border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-2.5 h-2.5 rounded-full bg-expense shrink-0 animate-pulse" />
              <div className="truncate">
                <p className="text-[12px] font-bold text-white leading-tight">Kuota AI Habis</p>
                <p className="text-[10px] text-text-secondary leading-tight truncate">Mulai Rp9.900 • Kuota permanen</p>
              </div>
            </div>
            <button
              onClick={() => document.getElementById("section-paket")?.scrollIntoView({ behavior: "smooth" })}
              className="shrink-0 bg-primary text-white text-[11px] font-bold px-3.5 py-1.5 rounded-full active:scale-95 transition-transform shadow-mic-glow whitespace-nowrap"
            >
              Isi Sekarang →
            </button>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Pembelian & Salin ID (Pop-up Checkout) */}
      {selectedPkgForBuy && (
        <div 
          className="fixed inset-0 z-50 bg-[#0D0D17]/70 backdrop-blur-sm flex items-end justify-center p-0 min-[430px]:p-4 min-[430px]:items-center animate-in fade-in duration-200"
          onClick={() => !isCopiedAndProceeding && setSelectedPkgForBuy(null)}
        >
          <div 
            className="w-full max-w-md bg-surface rounded-t-sheet min-[430px]:rounded-card-lg border border-border p-6 shadow-2xl relative animate-in slide-in-from-bottom-6 min-[430px]:slide-in-from-bottom-2 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle for mobile bottom sheet */}
            <div className="w-10 h-1 bg-border rounded-full mx-auto mb-4 min-[430px]:hidden" />

            {/* Close button */}
            <button
              onClick={() => !isCopiedAndProceeding && setSelectedPkgForBuy(null)}
              className="absolute top-5 right-5 w-8 h-8 rounded-full bg-field flex items-center justify-center text-text-secondary hover:text-text transition-colors"
              aria-label="Tutup"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="text-center mb-4">
              <span className="inline-block text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full mb-1.5">
                Langkah Terakhir Checkout
              </span>
              <h3 className="text-[17px] font-bold text-text">
                Salin ID Akun Anda
              </h3>
              <p className="text-[12px] text-text-secondary mt-1 max-w-[320px] mx-auto leading-relaxed">
                Tempelkan (Paste) ID ini di kolom <strong className="text-text">Catatan</strong> saat checkout di Lynk.id agar kuota otomatis masuk.
              </p>
            </div>

            {/* ID Box */}
            <div className="bg-field border-2 border-dashed border-primary/30 rounded-control p-4 text-center my-4 relative">
              <span className="text-[10px] font-bold text-text-secondary uppercase tracking-widest block mb-0.5">
                ID Akun Anda
              </span>
              <span className="text-[26px] font-bold text-primary font-mono tracking-widest block select-all">
                {profile?.userCode || "FT-XXXXX"}
              </span>
              <span className="text-[11px] text-text-secondary mt-1 block">
                Paket: <strong className="text-text">{selectedPkgForBuy.name}</strong> ({formatCurrency(selectedPkgForBuy.price)})
              </span>
            </div>

            {/* Info Callout */}
            <div className="bg-amber-500/10 border border-amber-500/20 rounded-control p-3 text-[11px] text-amber-900 mb-5 flex items-start gap-2.5">
              <span className="text-[14px] shrink-0 leading-none mt-0.5">💡</span>
              <p className="leading-relaxed">
                Setelah menekan tombol di bawah, ID akan <strong>otomatis tersalin</strong> dan halaman pembayaran Lynk.id akan terbuka.
              </p>
            </div>

            {/* Action Button */}
            <button
              id="btn-confirm-copy-and-buy"
              onClick={handleConfirmBuyAndCopy}
              disabled={isCopiedAndProceeding}
              className="w-full bg-primary text-white text-[14px] font-bold py-3.5 rounded-control active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(78,68,229,0.35)] disabled:opacity-80"
            >
              {isCopiedAndProceeding ? (
                <>
                  <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Tersalin! Membuka Lynk.id...</span>
                </>
              ) : (
                <span>Salin ID & Lanjutkan ke Lynk.id →</span>
              )}
            </button>

            <button
              onClick={() => !isCopiedAndProceeding && setSelectedPkgForBuy(null)}
              disabled={isCopiedAndProceeding}
              className="w-full text-center text-[12px] font-medium text-text-secondary hover:text-text py-2.5 mt-2 transition-colors"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  );
}
