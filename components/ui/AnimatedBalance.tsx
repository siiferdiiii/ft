"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedBalanceProps {
  value: number;
  duration?: number; // ms
  className?: string;
  formatter?: (val: number) => string;
  /** Key unik untuk menyimpan saldo terakhir di localStorage. Default: "ft_last_seen_balance" */
  storageKey?: string;
}

/**
 * Animasi angka saldo yang smooth saat nilainya berubah.
 * - Menyimpan saldo terakhir yang dilihat di localStorage agar animasi
 *   berjalan saat user kembali ke halaman dashboard (bukan real-time).
 * - Warna merah saat saldo berkurang, hijau saat saldo bertambah.
 * - Menggunakan requestAnimationFrame agar performa tetap 60fps.
 */
export function AnimatedBalance({
  value,
  duration = 1200,
  className = "",
  formatter,
  storageKey = "ft_last_seen_balance",
}: AnimatedBalanceProps) {
  // Baca saldo terakhir yang tersimpan di localStorage (untuk animasi saat kembali ke dashboard)
  const getStoredBalance = (): number => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) return parseInt(stored, 10) || 0;
    } catch { /* ignore */ }
    return value;
  };

  const [displayValue, setDisplayValue] = useState(() => getStoredBalance());
  const [direction, setDirection] = useState<"up" | "down" | "none">("none");
  const [isAnimating, setIsAnimating] = useState(false);
  const prevValueRef = useRef(getStoredBalance());
  const animationRef = useRef<number | null>(null);
  const hasAnimatedRef = useRef(false);

  const defaultFormatter = (val: number) => {
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString("id-ID");
    return val < 0 ? `-Rp${formatted}` : `Rp${formatted}`;
  };

  const format = formatter || defaultFormatter;

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;

    // Jika sama, tidak perlu animasi
    if (from === to) {
      setDisplayValue(to);
      setDirection("none");
      setIsAnimating(false);
      // Simpan saldo ke localStorage
      try { localStorage.setItem(storageKey, String(to)); } catch { /* ignore */ }
      return;
    }

    // Tentukan arah perubahan
    const dir = to > from ? "up" : "down";
    setDirection(dir);
    setIsAnimating(true);

    const diff = to - from;
    const startTime = performance.now();

    // Cancel animasi sebelumnya jika ada
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out cubic untuk feel yang smooth & premium
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentValue = Math.round(from + diff * eased);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        prevValueRef.current = to;
        animationRef.current = null;

        // Kembali ke warna normal setelah animasi selesai (delay 400ms)
        setTimeout(() => {
          setIsAnimating(false);
          setDirection("none");
        }, 400);

        // Simpan saldo terbaru ke localStorage
        try { localStorage.setItem(storageKey, String(to)); } catch { /* ignore */ }
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    prevValueRef.current = to;
    hasAnimatedRef.current = true;

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  // Tentukan warna berdasarkan arah animasi
  const colorClass = isAnimating
    ? direction === "down"
      ? "text-expense transition-colors"
      : direction === "up"
        ? "text-income transition-colors"
        : ""
    : "transition-colors duration-500";

  return (
    <span className={`${className} ${colorClass}`}>
      {format(displayValue)}
    </span>
  );
}
