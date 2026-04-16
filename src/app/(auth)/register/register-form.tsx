"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { createClient } from "@/lib/supabase/client";

export function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password.length < 8) {
      setError("Das Passwort muss mindestens 8 Zeichen lang sein.");
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (msg.includes("already registered") || msg.includes("already been registered")) {
        setError("Diese E-Mail ist bereits registriert. Versuch dich anzumelden.");
      } else if (msg.includes("rate limit") || msg.includes("too many") || error.status === 429) {
        setError("Zu viele Versuche – bitte warte 60 Sekunden und versuche es erneut.");
      } else if (msg.includes("invalid email") || msg.includes("unable to validate")) {
        setError("Ungültige E-Mail-Adresse.");
      } else if (msg.includes("weak password") || msg.includes("password should")) {
        setError("Passwort zu schwach – mindestens 8 Zeichen.");
      } else {
        setError(`Registrierung fehlgeschlagen: ${error.message}`);
      }
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  async function handleGoogleLogin() {
    setGoogleLoading(true);
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  // Nach erfolgreicher Registrierung: E-Mail-Bestätigung abwarten
  if (success) {
    return (
      <div className="flex flex-col items-center gap-4 py-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className="w-6 h-6 text-green-600" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </div>
        <div>
          <p className="font-semibold text-foreground">Fast geschafft!</p>
          <p className="text-sm text-muted-foreground mt-1">
            Wir haben dir eine Bestätigungs-E-Mail an <strong>{email}</strong> geschickt.
            Klick den Link darin um deinen Account zu aktivieren.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          Kein Mail? Schau auch im Spam-Ordner nach.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Google OAuth */}
      <Button
        variant="outline"
        className="w-full h-11 gap-3 font-medium"
        onClick={handleGoogleLogin}
        disabled={googleLoading || loading}
        type="button"
      >
        {googleLoading ? <LoadingSpinner /> : <GoogleIcon />}
        Mit Google registrieren
      </Button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <Separator className="flex-1" />
        <span className="text-xs text-muted-foreground font-medium">oder</span>
        <Separator className="flex-1" />
      </div>

      {/* Form */}
      <form onSubmit={handleRegister} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="username">Benutzername</Label>
          <Input
            id="username"
            type="text"
            placeholder="meeple_max"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/\s/g, "_"))}
            required
            disabled={loading}
          />
          <p className="text-xs text-muted-foreground">
            Nur Kleinbuchstaben, Zahlen und Unterstriche.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="email">E-Mail</Label>
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
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Passwort</Label>
          <Input
            id="password"
            type="password"
            placeholder="Mindestens 8 Zeichen"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />
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

        <Button type="submit" className="w-full h-11 mt-1" disabled={loading || googleLoading}>
          {loading ? <LoadingSpinner /> : "Account erstellen"}
        </Button>

        <p className="text-xs text-muted-foreground text-center leading-relaxed">
          Mit der Registrierung stimmst du unseren{" "}
          <a href="/terms" className="underline hover:text-foreground">Nutzungsbedingungen</a>{" "}
          und der{" "}
          <a href="/privacy" className="underline hover:text-foreground">Datenschutzerklärung</a>{" "}
          zu.{" "}
          <a href="/impressum" className="underline hover:text-foreground">Impressum</a>
        </p>
      </form>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 flex-shrink-0" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
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
