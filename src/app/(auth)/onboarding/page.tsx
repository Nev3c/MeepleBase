import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Willkommen bei MeepleBase" };

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 shadow-amber mb-4">
          <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8" aria-hidden="true">
            <circle cx="16" cy="10" r="5" fill="white" />
            <path d="M8 22 C8 18 11 16 16 16 C21 16 24 18 24 22 L24 28 L8 28 Z" fill="white" />
          </svg>
        </div>
        <h1 className="font-display text-3xl font-semibold text-foreground">
          Herzlich willkommen! 🎲
        </h1>
        <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
          Eine letzte Frage, dann gehts los –<br />
          hast du einen BGG-Account?
        </p>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <OnboardingForm />
      </div>
    </div>
  );
}
