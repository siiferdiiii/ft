"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Root page — menentukan apakah user sudah login atau belum.
 *
 * Dibuat client component agar bisa baca localStorage secara langsung.
 * Ini krusial untuk PWA karena cookies dari `document.cookie` kadang
 * tidak persist di PWA Android setelah restart, tapi localStorage selalu persist.
 */
export default function HomePage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const hasLocalFlag = localStorage.getItem("ft_logged_in") === "true";
    const hasCookieFlag = document.cookie.includes("ft_logged_in=true");

    // Cek juga Supabase auth cookies
    const hasSupabaseCookie = document.cookie
      .split(";")
      .some(
        (c) =>
          c.trim().startsWith("sb-") || c.trim().includes("auth-token")
      );

    if (hasLocalFlag || hasCookieFlag || hasSupabaseCookie) {
      // Sudah login → dashboard
      router.replace("/dashboard");
    } else {
      // Belum login → register
      router.replace("/register");
    }

    setChecking(false);
  }, [router]);

  // Tampilkan splash screen singkat saat mengecek status
  if (checking) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3">
        <div className="w-12 h-12 rounded-card-wallet bg-primary text-white font-bold text-xl flex items-center justify-center shadow-none animate-pulse">
          FT
        </div>
        <p className="text-[13px] text-text-secondary animate-pulse">
          Memuat...
        </p>
      </div>
    );
  }

  return null;
}
