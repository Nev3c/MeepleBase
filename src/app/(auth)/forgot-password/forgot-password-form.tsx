"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Check } from "lucide-react";

export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });

    if (error) {
      // Don't reveal whether the email exists — show generic success anyway
      // (Supabase may return an error for rate-limits; we show that specifically)
      if (error.message.toLowerCase().includes("rate limit") || error.status === 429) {
        setError("Zu viele Versuche – bitte warte kurz und versuche es erneut.");
        setLoading(false);
        return;
      }
    }

    // Always show success to prevent email enumeration
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <Check className="w-6 h-6 text-green-600" strokeWidth={2.5} />
        </div>
        <div>
          <p className="font-semibold text-foreground">E-Mail unterwegs!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Falls ein Account mit <strong>{email}</strong> existiert, bekommst du
            gleich einen Reset-Link zugeschickt.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Nichts angekommen? Schau auch im Spam-Ordner nach.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">E-Mail-Adresse</Label>
        <Input
          id="email"
          type="email"
          placeholder="du@beispiel.de"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Wir schicken dir einen Link um dein Passwort neu zu setzen.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="text-sm text-destructive bg-red-50 border border-red-200 rounded-lg px-3 py-2"
        >
          {error}
        </div>
      )}

      <Button
        type="submit"
        className="w-full h-11 mt-1"
        disabled={loading || !email.trim()}
      >
        {loading ? <LoadingSpinner /> : "Reset-Link senden"}
      </Button>
    </form>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
