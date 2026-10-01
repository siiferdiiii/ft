"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { BottomNav } from "@/components/ui/BottomNav";
import { formatCurrency } from "@/lib/currency";
import { UserProfileDto } from "@/lib/types";
import { PRODUCT_PACKAGES } from "@/lib/constants/products";

export default function ProfilPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfileDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Form state
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [isSavingCredentials, setIsSavingCredentials] = useState(false);
  const [credMsg, setCredMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [copied, setCopied] = useState(false);

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

  const handleCopyCode = () => {
    if (!profile?.userCode) return;
    navigator.clipboard.writeText(profile.userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
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
  const tierColor = profile?.tier === "PRO" ? "text-amber-400" : "text-text-secondary";

  return (
    <div className="flex-1 flex flex-col pb-24 min-h-screen bg-background">
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
          <p className="text-[12px] text-text-secondary">Pengaturan Akun</p>
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
                <span className={`text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                  profile?.tier === "PRO"
                    ? "bg-amber-500/10 text-amber-400 border-amber-400/30"
                    : "bg-chip text-text-secondary border-border"
                }`}>
                  {tierLabel}
                </span>
              </div>
              <div className="text-[15px] font-bold text-text mb-0.5">
                {profile?.name || "Pengguna"}
              </div>
              <div className="text-[12px] text-text-secondary">{profile?.email}</div>
            </div>

            {/* User ID Card — Untuk Lynk.id */}
            <div className="bg-surface rounded-card-lg border border-border p-5">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-2">
                ID Referensi Pembelian
              </p>
              <p className="text-[12px] text-text-secondary mb-3">
                Salin ID ini ke kolom <strong>catatan</strong> saat membeli paket di Lynk.id agar kuota langsung
                ditambahkan ke akun Anda.
              </p>
              <div className="flex items-center gap-3 bg-field rounded-control px-4 py-3">
                <span className="text-[22px] font-bold text-primary tracking-widest flex-1 font-mono">
                  {profile?.userCode || "FT-XXXXX"}
                </span>
                <button
                  id="btn-copy-user-code"
                  onClick={handleCopyCode}
                  className={`text-[12px] font-semibold px-3 py-1.5 rounded-full transition-all duration-200 ${
                    copied
                      ? "bg-income/20 text-income"
                      : "bg-primary/10 text-primary hover:bg-primary/20"
                  }`}
                >
                  {copied ? "Tersalin ✓" : "Salin ID"}
                </button>
              </div>
            </div>

            {/* Kuota Penggunaan */}
            <div className="bg-surface rounded-card-lg border border-border p-5">
              <p className="text-[11px] font-semibold text-text-secondary uppercase tracking-wide mb-3">
                Kuota Tersisa
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-field rounded-control p-3 text-center">
                  <div className={`text-[28px] font-bold mb-0.5 ${
                    (profile?.ocrQuota ?? 0) > 0 ? "text-primary" : "text-expense"
                  }`}>
                    {profile?.ocrQuota ?? 0}
                  </div>
                  <div className="text-[11px] text-text-secondary font-medium">Scan Resi AI</div>
                </div>
                <div className="bg-field rounded-control p-3 text-center">
                  <div className={`text-[28px] font-bold mb-0.5 ${
                    (profile?.aiBudgetQuota ?? 0) > 0 ? "text-primary" : "text-expense"
                  }`}>
                    {profile?.aiBudgetQuota ?? 0}
                  </div>
                  <div className="text-[11px] text-text-secondary font-medium">Susun Budget AI</div>
                </div>
              </div>
              {(profile?.ocrQuota ?? 0) === 0 && (
                <p className="text-[11px] text-expense mt-3 text-center font-medium">
                  Kuota habis — Beli paket di bawah untuk mengisi ulang.
                </p>
              )}
            </div>

            {/* Paket Produk */}
            <div>
              <p className="text-[12px] font-bold text-text-secondary uppercase tracking-wide mb-2 px-1">
                Paket Produk
              </p>
              <div className="space-y-3">
                {PRODUCT_PACKAGES.map((pkg) => (
                  <div
                    key={pkg.id}
                    className={`bg-surface rounded-card-lg border p-4 relative overflow-hidden transition-all ${
                      pkg.comingSoon
                        ? "border-border opacity-70"
                        : pkg.popular
                        ? "border-primary shadow-[0_0_0_1px_rgba(78,68,229,0.15)]"
                        : "border-border"
                    }`}
                  >
                    {/* Badge popular */}
                    {pkg.popular && !pkg.comingSoon && (
                      <div className="absolute top-0 right-0 bg-primary text-white text-[10px] font-bold px-2.5 py-1 rounded-bl-control">
                        {pkg.badge}
                      </div>
                    )}

                    {/* Badge coming soon */}
                    {pkg.comingSoon && (
                      <div className="absolute top-0 right-0 bg-chip text-text-secondary text-[10px] font-bold px-2.5 py-1 rounded-bl-control">
                        🔒 Segera Hadir
                      </div>
                    )}

                    {/* Badge non-popular biasa */}
                    {!pkg.popular && !pkg.comingSoon && pkg.badge && (
                      <span className="text-[10px] font-semibold text-text-secondary bg-chip px-2 py-0.5 rounded-full mb-2 inline-block">
                        {pkg.badge}
                      </span>
                    )}

                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className="text-[14px] font-bold text-text">{pkg.name}</div>
                        <div className="text-[12px] text-text-secondary mt-0.5 leading-relaxed">{pkg.description}</div>
                      </div>
                      <div className={`text-[16px] font-bold ml-3 whitespace-nowrap flex-shrink-0 ${pkg.comingSoon ? "text-text-secondary" : "text-primary"}`}>
                        {formatCurrency(pkg.price)}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mb-3">
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${pkg.comingSoon ? "bg-chip text-text-secondary" : "bg-primary/10 text-primary"}`}>
                        📷 {pkg.ocrQuota}x Scan AI
                      </span>
                      <span className={`text-[10px] font-semibold rounded-full px-2 py-0.5 ${pkg.comingSoon ? "bg-chip text-text-secondary" : "bg-income/10 text-income"}`}>
                        🤖 {pkg.aiBudgetQuota}x Budget AI
                      </span>
                      <span className="text-[10px] font-semibold bg-chip text-text-secondary rounded-full px-2 py-0.5">
                        ∞ Tidak kedaluwarsa
                      </span>
                    </div>

                    {pkg.comingSoon ? (
                      <div className="w-full text-center py-2.5 rounded-control text-[13px] font-semibold text-text-secondary bg-chip cursor-not-allowed select-none">
                        Segera Hadir
                      </div>
                    ) : (
                      <a
                        href={pkg.lynkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        id={`btn-buy-${pkg.id}`}
                        className={`block w-full text-center py-2.5 rounded-control text-[13px] font-bold transition-all active:scale-[0.98] ${
                          pkg.popular
                            ? "bg-primary text-white hover:opacity-90 shadow-[0_6px_16px_rgba(78,68,229,0.3)]"
                            : "bg-chip text-primary hover:bg-primary/10 border border-primary/20"
                        }`}
                      >
                        Beli Sekarang →
                      </a>
                    )}
                  </div>
                ))}
              </div>

              {/* Instruksi cara beli */}
              <div className="mt-3 bg-primary/5 border border-primary/15 rounded-[14px] px-4 py-3 space-y-2">
                <p className="text-[11px] font-bold text-primary">📋 Cara Membeli</p>
                <ol className="space-y-1.5">
                  {["Klik tombol Beli — kamu akan diarahkan ke Lynk.id", `Di kolom catatan, masukkan ID Akun kamu: ${profile?.userCode || "FT-XXXXX"}`, "Selesaikan pembayaran — kuota otomatis ditambahkan dalam beberapa menit"].map((step, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="flex-shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                      <span className="text-[11px] text-text-secondary leading-relaxed">{step}</span>
                    </li>
                  ))}
                </ol>
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

      <BottomNav />
    </div>
  );
}
