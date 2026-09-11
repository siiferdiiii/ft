"use client";

import React, { useState, useEffect } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = "" }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Cek apakah sudah berjalan dalam mode PWA Standalone (Layar Penuh / Aplikasi)
    if (typeof window !== "undefined") {
      const isStandaloneMode =
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true;
      setIsStandalone(isStandaloneMode);

      // Cek apakah perangkat iOS (Safari)
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
      setIsIOS(isAppleDevice);

      // 2. Tangkap event beforeinstallprompt (Android, Chrome, Edge, Windows)
      const handleBeforeInstallPrompt = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
      };

      const handleAppInstalled = () => {
        setIsInstalled(true);
        setDeferredPrompt(null);
      };

      window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.addEventListener("appinstalled", handleAppInstalled);

      return () => {
        window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
        window.removeEventListener("appinstalled", handleAppInstalled);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      // Trigger dialog instalasi native di Android/Chrome/Desktop
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      // Buka petunjuk instalasi untuk pengguna iPhone/iPad di Safari
      setShowIOSGuide(true);
    } else {
      // Jika browser belum melempar prompt (atau browser lain), tampilkan modal petunjuk
      setShowIOSGuide(true);
    }
  };

  // Jika sudah dalam mode aplikasi terinstall, tampilkan badge kecil
  if (isStandalone || isInstalled) {
    return (
      <div className={`flex items-center justify-center gap-2 p-3 bg-chip/60 border border-primary/20 rounded-card-wallet text-text text-[13px] ${className}`}>
        <span className="text-income font-bold">✓</span>
        <span className="font-medium text-text-secondary">
          Aplikasi PWA sudah terpasang di perangkat Anda
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={`relative ${className}`}>
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full flex items-center justify-between p-3.5 bg-gradient-to-r from-primary/15 to-primary/5 hover:from-primary/25 hover:to-primary/10 border border-primary/30 rounded-card-wallet transition-all group shadow-sm active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white shadow-sm flex-shrink-0">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
            </div>
            <div className="text-left">
              <span className="text-[14px] font-bold text-text block group-hover:text-primary transition-colors">
                Pasang Aplikasi di HP (PWA)
              </span>
              <span className="text-[11px] text-text-secondary block">
                Buka lebih cepat dari layar utama & tanpa browser
              </span>
            </div>
          </div>

          <div className="px-2.5 py-1 bg-primary text-white text-[11px] font-bold rounded-full">
            Install
          </div>
        </button>
      </div>

      {/* Modal Petunjuk Instalasi (Khusus iOS atau Browser Manual) */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-surface border border-border w-full max-w-sm rounded-card-lg p-5 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h3 className="font-bold text-[16px] text-text">
                Cara Pasang Aplikasi di Layar Utama
              </h3>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-text-secondary hover:text-text p-1 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-text-secondary">
              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  1
                </span>
                <p>
                  {isIOS ? (
                    <>
                      Ketuk tombol <strong>Bagikan (Share)</strong> <span className="text-primary font-bold">⎋</span> di bilah bawah browser Safari Anda.
                    </>
                  ) : (
                    <>
                      Buka menu browser Anda (ikon titik tiga <strong>⋮</strong> di pojok kanan atas).
                    </>
                  )}
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  2
                </span>
                <p>
                  Cari dan pilih opsi <strong>"Tambah ke Layar Utama"</strong> (Add to Home Screen) atau <strong>"Install App"</strong>.
                </p>
              </div>

              <div className="flex items-start gap-3">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-white text-xs font-bold flex-shrink-0">
                  3
                </span>
                <p>
                  Ketuk <strong>Tambah</strong>. Ikon Finance Tracker akan langsung muncul di menu aplikasi HP Anda!
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2.5 bg-primary text-white text-[13px] font-semibold rounded-control mt-2"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
};
