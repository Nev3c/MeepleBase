import type { Metadata } from "next";
import { RegisterForm } from "./register-form";
import { AppLogo } from "@/components/shared/app-logo";

export const metadata: Metadata = { title: "Registrieren" };

export default function RegisterPage() {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      {/* Logo + Headline */}
      <div className="text-center flex flex-col items-center gap-3">
        <AppLogo size={64} />
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Deine Base starten
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Kostenlos, keine Kreditkarte nötig.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <RegisterForm />
      </div>

      {/* Login link */}
      <p className="text-center text-sm text-muted-foreground">
        Schon dabei?{" "}
        <a href="/login" className="text-amber-600 font-semibold hover:text-amber-700 underline-offset-4 hover:underline">
          Anmelden
        </a>
      </p>
    </div>
  );
}
