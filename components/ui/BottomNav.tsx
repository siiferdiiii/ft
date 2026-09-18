"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeNavIcon, ChartNavIcon, CardNavIcon, TargetNavIcon, WalletNavIcon } from "./Icons";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      id: "nav-utama",
      label: "Utama",
      href: "/dashboard",
      icon: <HomeNavIcon className="w-[22px] h-[22px]" />,
      active: pathname === "/dashboard",
    },
    {
      id: "nav-statistik",
      label: "Statistik",
      href: "/dashboard/statistik",
      icon: <ChartNavIcon className="w-[22px] h-[22px]" />,
      active: pathname === "/dashboard/statistik" || pathname.startsWith("/dashboard/statistik/"),
    },
    {
      id: "nav-budget",
      label: "Budget",
      href: "/dashboard/budget",
      icon: <CardNavIcon className="w-[22px] h-[22px]" />,
      active: pathname === "/dashboard/budget" || pathname.startsWith("/dashboard/budget/"),
    },
    {
      id: "nav-goals",
      label: "Goals",
      href: "/dashboard/goals",
      icon: <TargetNavIcon className="w-[22px] h-[22px]" />,
      active: pathname === "/dashboard/goals" || pathname.startsWith("/dashboard/goals/"),
    },
    {
      id: "nav-dompet",
      label: "Dompet",
      href: "/dashboard/dompet",
      icon: <WalletNavIcon className="w-[22px] h-[22px]" />,
      active: pathname === "/dashboard/dompet" || pathname.startsWith("/dashboard/dompet/"),
    },
  ];

  return (
    <nav
      aria-label="Navigasi Utama"
      className="fixed inset-x-0 bottom-0 z-40 pointer-events-none flex justify-center px-4 min-[375px]:px-5 pb-[calc(18px+env(safe-area-inset-bottom,0px))]"
    >
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-full shadow-[0_12px_36px_-6px_rgba(0,0,0,0.08),inset_0_1.5px_1px_rgba(255,255,255,0.85)] border border-white/80 ring-1 ring-black/[0.03] px-2 py-2 flex items-center justify-between pointer-events-auto">
        {navItems.map((item) => (
          <Link
            id={item.id}
            key={item.href}
            href={item.href}
            prefetch={true}
            aria-current={item.active ? "page" : undefined}
            className={`flex-1 flex flex-col items-center justify-center gap-1.5 py-1.5 min-h-[48px] rounded-full transition-all duration-150 active:scale-95 select-none ${
              item.active
                ? "text-primary font-semibold"
                : "text-[#9CA3AF] hover:text-text font-medium"
            }`}
          >
            <div className="flex items-center justify-center transition-colors">
              {item.icon}
            </div>
            <span className="text-[11px] min-[360px]:text-[12px] leading-tight tracking-tight text-center">
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
};

