"use client";

import React, { useRef, useState, useCallback } from "react";

interface SwipeDeleteRowProps {
  children: React.ReactNode;
  onDelete: () => void;
  isDeleting?: boolean;
}

/**
 * Wrapper component yang bisa di-swipe ke kiri untuk menampilkan tombol hapus.
 * Touch-based (mobile) dan mouse-based (desktop) support.
 */
export function SwipeDeleteRow({ children, onDelete, isDeleting }: SwipeDeleteRowProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [offsetX, setOffsetX] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const startXRef = useRef(0);
  const currentXRef = useRef(0);
  const isDraggingRef = useRef(false);

  const DELETE_THRESHOLD = 80; // px to reveal delete button

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    currentXRef.current = offsetX;
    isDraggingRef.current = true;
  }, [offsetX]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDraggingRef.current) return;
    const diff = e.touches[0].clientX - startXRef.current;
    const newOffset = Math.min(0, Math.max(-DELETE_THRESHOLD, currentXRef.current + diff));
    setOffsetX(newOffset);
  }, []);

  const handleTouchEnd = useCallback(() => {
    isDraggingRef.current = false;
    if (offsetX < -DELETE_THRESHOLD / 2) {
      setOffsetX(-DELETE_THRESHOLD);
      setIsOpen(true);
    } else {
      setOffsetX(0);
      setIsOpen(false);
    }
  }, [offsetX]);

  const handleClose = useCallback(() => {
    setOffsetX(0);
    setIsOpen(false);
    setShowConfirm(false);
  }, []);

  const handleDeleteClick = useCallback(() => {
    setShowConfirm(true);
  }, []);

  const handleConfirmDelete = useCallback(() => {
    onDelete();
    setShowConfirm(false);
  }, [onDelete]);

  return (
    <div className="relative overflow-hidden">
      {/* Delete button behind the row */}
      <div className="absolute right-0 top-0 bottom-0 flex items-stretch z-0">
        {!showConfirm ? (
          <button
            onClick={handleDeleteClick}
            disabled={isDeleting}
            className="w-20 bg-expense flex items-center justify-center text-white font-semibold text-[12px] transition-opacity hover:opacity-90 active:opacity-75"
          >
            {isDeleting ? (
              <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
            ) : (
              <div className="flex flex-col items-center gap-0.5">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                </svg>
                <span>Hapus</span>
              </div>
            )}
          </button>
        ) : (
          <div className="flex items-stretch">
            <button
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="w-16 bg-expense flex items-center justify-center text-white font-bold text-[11px] hover:opacity-90"
            >
              {isDeleting ? (
                <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                "Ya"
              )}
            </button>
            <button
              onClick={handleClose}
              disabled={isDeleting}
              className="w-16 bg-text-secondary flex items-center justify-center text-white font-bold text-[11px] hover:opacity-90"
            >
              Tidak
            </button>
          </div>
        )}
      </div>

      {/* Swipeable content */}
      <div
        ref={containerRef}
        className="relative z-10 bg-surface transition-transform"
        style={{
          transform: `translateX(${showConfirm ? -132 : offsetX}px)`,
          transition: isDraggingRef.current ? "none" : "transform 0.25s ease-out",
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Tap to close when open */}
        {(isOpen || showConfirm) && (
          <div
            className="absolute inset-0 z-20"
            onClick={handleClose}
          />
        )}
        {children}
      </div>
    </div>
  );
}
