import type { Metadata } from "next";
import { LoginForm } from "./login-form";
import { AppLogo } from "@/components/shared/app-logo";

export const metadata: Metadata = { title: "Anmelden" };

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      {/* Logo + Headline */}
      <div className="text-center flex flex-col items-center gap-3">
        <AppLogo size={64} />
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Willkommen zurück
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Meld dich an und zu deiner Base.
          </p>
        </div>
      </div>

      {/* Form card */}
      <div className="bg-card rounded-2xl border border-border shadow-card p-6">
        <LoginForm />
      </div>

      {/* Register link */}
      <p className="text-center text-sm text-muted-foreground">
        Noch kein Account?{" "}
        <a href="/register" className="text-amber-600 font-semibold hover:text-amber-700 underline-offset-4 hover:underline">
          Jetzt registrieren
        </a>
      </p>
    </div>
  );
}
