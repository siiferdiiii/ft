"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedBalanceProps {
  value: number;
  duration?: number; // ms
  className?: string;
  formatter?: (val: number) => string;
}

/**
 * Animasi angka saldo yang smooth saat nilainya berubah.
 * Menggunakan requestAnimationFrame agar performa tetap 60fps.
 */
export function AnimatedBalance({
  value,
  duration = 600,
  className = "",
  formatter,
}: AnimatedBalanceProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const prevValueRef = useRef(value);
  const animationRef = useRef<number | null>(null);

  const defaultFormatter = (val: number) => {
    const abs = Math.abs(val);
    const formatted = abs.toLocaleString("id-ID");
    return val < 0 ? `-Rp${formatted}` : `Rp${formatted}`;
  };

  const format = formatter || defaultFormatter;

  useEffect(() => {
    const from = prevValueRef.current;
    const to = value;

    // Jika pertama kali render atau sama, langsung set
    if (from === to) {
      setDisplayValue(to);
      return;
    }

    const diff = to - from;
    const startTime = performance.now();

    // Cancel animasi sebelumnya jika ada
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
    }

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing: ease-out cubic untuk feel yang smooth
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentValue = Math.round(from + diff * eased);
      setDisplayValue(currentValue);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(to);
        prevValueRef.current = to;
        animationRef.current = null;
      }
    };

    animationRef.current = requestAnimationFrame(animate);
    prevValueRef.current = to;

    return () => {
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [value, duration]);

  return <span className={className}>{format(displayValue)}</span>;
}
