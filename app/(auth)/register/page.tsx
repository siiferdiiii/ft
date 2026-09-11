"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { PWAInstallButton } from "@/components/features/PWAInstallButton";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Jika user sudah pernah mendaftar / sudah login, langsung lempar ke dashboard
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (
        localStorage.getItem("ft_logged_in") === "true" ||
        document.cookie.includes("ft_logged_in=true")
      ) {
        router.replace("/dashboard");
      }
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!email || !password) {
      setErrorMessage("Email dan password wajib diisi");
      return;
    }

    if (password.length < 6) {
      setErrorMessage("Password minimal 6 karakter");
      return;
    }

    setIsLoading(true);
    try {
      // 1. Panggil route handler server-side untuk sinkronisasi ke tabel User & default data
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim() || undefined,
          email: email.trim().toLowerCase(),
          password,
        }),
      });

      const json = await res.json();
      if (!res.ok || json.error) {
        setErrorMessage(json.error?.message || "Pendaftaran gagal");
        setIsLoading(false);
        return;
      }

      // 2. Simpan status login permanen agar tidak kembali ke /register saat reload / buka PWA
      if (typeof window !== "undefined") {
        localStorage.setItem("ft_logged_in", "true");
        document.cookie = "ft_logged_in=true; path=/; max-age=31536000; SameSite=Lax";
      }

      // 3. Auto login di client tanpa konfirmasi email (PRD §3)
      try {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
      } catch {
        // Abaikan jika Supabase client offline
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setErrorMessage("Terjadi gangguan jaringan saat mendaftar");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col justify-center px-5 py-8">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-card-wallet bg-primary text-white font-bold text-xl mb-3 shadow-none">
          FT
        </div>
        <h1 className="text-[22px] font-bold text-text mb-1">Daftar Akun Baru</h1>
        <p className="text-[13px] text-text-secondary">
          Mulai catat keuangan pribadi lebih cepat dan rapi.
        </p>
      </div>

      <div className="bg-surface p-6 rounded-card-lg border border-border">
        <form onSubmit={handleSubmit} className="space-y-4">
          {errorMessage && (
            <div className="p-3 bg-expense/10 text-expense text-[13px] font-medium rounded-control">
              {errorMessage}
            </div>
          )}

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Nama Lengkap (Opsional)
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Anda"
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              required
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[12px] font-medium text-text-secondary mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Minimal 8 karakter"
              required
              minLength={8}
              className="w-full bg-field text-text text-[14px] font-medium px-4 py-3 rounded-control border-none focus:ring-2 focus:ring-primary focus:outline-none"
            />
          </div>

          <div className="pt-2">
            <Button type="submit" variant="primary" fullWidth isLoading={isLoading}>
              Daftar & Masuk
            </Button>
          </div>
        </form>

        <div className="mt-5 text-center text-[13px] text-text-secondary">
          Sudah punya akun?{" "}
          <Link
            href="/login"
            className="text-primary font-semibold hover:underline"
          >
            Masuk
          </Link>
        </div>
      </div>

      {/* Tombol Install Aplikasi PWA (Sesuai Permintaan User) */}
      <div className="mt-6">
        <PWAInstallButton />
      </div>
    </div>
  );
}
