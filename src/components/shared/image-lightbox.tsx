"use client";

import { useEffect, useCallback } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";

interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
  /** Called with the current image index when the user confirms delete */
  onDelete?: (index: number) => void;
}

export function ImageLightbox({ images, currentIndex, onClose, onNavigate, onDelete }: ImageLightboxProps) {
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < images.length - 1;

  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") onClose();
    if (e.key === "ArrowLeft" && hasPrev) onNavigate(currentIndex - 1);
    if (e.key === "ArrowRight" && hasNext) onNavigate(currentIndex + 1);
  }, [onClose, onNavigate, currentIndex, hasPrev, hasNext]);

  useEffect(() => {
    document.addEventListener("keydown", handleKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = "";
    };
  }, [handleKey]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      onClick={onClose}
    >
      {/* Top-right controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {onDelete && (
          <button
            onClick={(e) => { e.stopPropagation(); if (confirm("Bild löschen?")) { onDelete(currentIndex); onClose(); } }}
            className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-red-500/70 transition-colors"
            aria-label="Bild löschen"
          >
            <Trash2 size={18} />
          </button>
        )}
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Schließen"
        >
          <X size={20} />
        </button>
      </div>

      {/* Counter */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 text-white/70 text-sm font-medium">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* Prev */}
      {hasPrev && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex - 1); }}
          className="absolute left-3 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Vorheriges Bild"
        >
          <ChevronLeft size={22} />
        </button>
      )}

      {/* Image */}
      <div
        className="relative max-w-[92vw] max-h-[88vh] w-full h-full flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <Image
          src={images[currentIndex]}
          alt={`Bild ${currentIndex + 1}`}
          fill
          className="object-contain"
          sizes="92vw"
          priority
        />
      </div>

      {/* Next */}
      {hasNext && (
        <button
          onClick={(e) => { e.stopPropagation(); onNavigate(currentIndex + 1); }}
          className="absolute right-3 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors"
          aria-label="Nächstes Bild"
        >
          <ChevronRight size={22} />
        </button>
      )}

      {/* Swipe dots */}
      {images.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); onNavigate(i); }}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === currentIndex ? "bg-white w-4" : "bg-white/40"}`}
              aria-label={`Bild ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
