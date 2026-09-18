"use client";

import React, { useState } from "react";

export interface AccordionItemProps {
  id?: string;
  title: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
  subtitle?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}

export const AccordionItem: React.FC<AccordionItemProps> = ({
  id,
  title,
  icon,
  badge,
  subtitle,
  children,
  defaultOpen = false,
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border-b border-border/80 last:border-b-0 transition-colors">
      <button
        id={id}
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full py-3.5 px-4 flex items-center justify-between gap-3 text-left hover:bg-field/50 transition-colors select-none group"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3 min-w-0">
          {icon && (
            <div className="w-8 h-8 rounded-full bg-chip text-primary flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-text truncate">
                {title}
              </span>
              {badge}
            </div>
            {subtitle && (
              <span className="text-[11px] text-text-secondary block truncate mt-0.5">
                {subtitle}
              </span>
            )}
          </div>
        </div>

        <svg
          className={`w-4 h-4 text-text-secondary transition-transform duration-200 flex-shrink-0 ${
            isOpen ? "rotate-180 text-primary" : ""
          }`}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className="px-4 pb-4 pt-1 text-[12px] text-text-secondary leading-relaxed animate-in fade-in duration-200">
          {children}
        </div>
      )}
    </div>
  );
};

export const AccordionGroup: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = "" }) => {
  return (
    <div
      className={`bg-surface rounded-card-lg border border-border overflow-hidden divide-y divide-border/80 ${className}`}
    >
      {children}
    </div>
  );
};
