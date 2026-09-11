"use client";

import React, { useEffect } from "react";
import { CloseIcon } from "./Icons";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export const BottomSheet: React.FC<BottomSheetProps> = ({
  isOpen,
  onClose,
  title,
  children,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop: #0D0D17 translusen */}
      <div
        className="fixed inset-0 bg-[#0D0D17]/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet Container: menutupi ~65-70% layar, radius atas 28px */}
      <div className="relative z-10 w-full max-w-md max-h-[85vh] overflow-y-auto bg-surface rounded-t-sheet p-5 flex flex-col border-t border-border animate-in slide-in-from-bottom duration-200">
        {/* Grabber handle 40x4px */}
        <div className="flex justify-center mb-3">
          <div className="w-10 h-1 bg-border rounded-full" />
        </div>

        {/* Header modal */}
        <div className="flex items-center justify-between pb-3 border-b border-border mb-4">
          <h2 className="text-[16px] font-bold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-text-secondary hover:text-text hover:bg-field transition-colors"
            aria-label="Tutup modal"
          >
            <CloseIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
};
