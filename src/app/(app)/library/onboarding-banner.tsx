"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { X, Sparkles } from "lucide-react";

interface OnboardingBannerProps {
  userCreatedAt: string;
}

export function OnboardingBanner({ userCreatedAt }: OnboardingBannerProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    try {
      const done = localStorage.getItem("meeplebase_onboarding_done") === "1";
      const ageMs = Date.now() - new Date(userCreatedAt).getTime();
      const isNewAccount = ageMs < 30 * 24 * 60 * 60 * 1000; // 30 days
      setShow(!done && isNewAccount);
    } catch {
      // localStorage not available (SSR / private browsing)
    }
  }, [userCreatedAt]);

  function dismiss() {
    try {
      localStorage.setItem("meeplebase_onboarding_done", "1");
    } catch { /* ignore */ }
    setShow(false);
  }

  if (!show) return null;

  return (
    <div className="mx-4 mt-3 mb-1 bg-amber-50 border border-amber-200 rounded-2xl p-3.5 flex items-center gap-3 shadow-sm">
      <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
        <Sparkles size={18} className="text-amber-600" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-amber-900 leading-tight">Neu bei MeepleBase?</p>
        <p className="text-xs text-amber-700 leading-snug mt-0.5">Die App-Tour erklärt alle Funktionen in 2 Minuten.</p>
      </div>

      <Link
        href="/onboarding"
        className="text-xs font-bold text-amber-600 whitespace-nowrap hover:text-amber-700 active:opacity-70 transition-opacity"
      >
        Tour starten
      </Link>

      <button
        onClick={dismiss}
        aria-label="Banner schließen"
        className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-100 active:bg-amber-200 transition-colors flex-shrink-0 touch-manipulation"
      >
        <X size={14} className="text-amber-500" />
      </button>
    </div>
  );
}
