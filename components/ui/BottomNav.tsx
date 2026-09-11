"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WalletIcon, StatsIcon, BudgetIcon, CategoryIcon } from "./Icons";

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems = [
    {
      label: "Utama",
      href: "/dashboard",
      icon: <WalletIcon className="w-5 h-5" />,
      active: pathname === "/dashboard",
    },
    {
      label: "Statistik",
      href: "/dashboard/statistik",
      icon: <StatsIcon className="w-5 h-5" />,
      active: pathname === "/dashboard/statistik",
    },
    {
      label: "Budget",
      href: "/dashboard/budget",
      icon: <BudgetIcon className="w-5 h-5" />,
      active: pathname === "/dashboard/budget",
    },
    {
      label: "Dompet",
      href: "/dashboard/dompet",
      icon: <WalletIcon className="w-5 h-5" />,
      active: pathname === "/dashboard/dompet",
    },
    {
      label: "Kategori",
      href: "/dashboard/kategori",
      icon: <CategoryIcon className="w-5 h-5" />,
      active: pathname === "/dashboard/kategori",
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface/95 backdrop-blur-sm border-t border-border py-2 px-3">
      <div className="max-w-md mx-auto flex items-center justify-around">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-col items-center justify-center py-1 px-2 rounded-control transition-colors ${
              item.active
                ? "text-primary font-semibold"
                : "text-text-secondary hover:text-text font-medium"
            }`}
          >
            <div className="mb-0.5">{item.icon}</div>
            <span className="text-[10px]">{item.label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};
