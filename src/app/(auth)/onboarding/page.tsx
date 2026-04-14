import type { Metadata } from "next";
import { OnboardingForm } from "./onboarding-form";
import { AppLogo } from "@/components/shared/app-logo";

export const metadata: Metadata = { title: "Willkommen bei MeepleBase" };

export default function OnboardingPage() {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="text-center flex flex-col items-center gap-3">
        <AppLogo size={64} />
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Herzlich willkommen! 🎲
          </h1>
          <p className="text-muted-foreground text-sm mt-2 leading-relaxed">
            Eine letzte Frage, dann gehts los –<br />
            hast du einen BGG-Account?
          </p>
        </div>
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <OnboardingForm />
      </div>

      {/* PWA Install hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <span className="text-2xl flex-shrink-0 mt-0.5">📱</span>
        <div>
          <p className="text-sm font-semibold text-amber-900">App auf den Startbildschirm</p>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed">
            <strong>iPhone:</strong> Teilen-Symbol → &quot;Zum Home-Bildschirm&quot;<br />
            <strong>Android:</strong> Menü (⋮) → &quot;Zum Startbildschirm hinzufügen&quot;
          </p>
          <p className="text-[11px] text-amber-700 mt-1.5">
            Dann öffnet sich MeepleBase wie eine echte App – ohne Browser-Leiste.
          </p>
        </div>
      </div>
    </div>
  );
}
