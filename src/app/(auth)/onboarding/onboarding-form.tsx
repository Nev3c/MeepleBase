"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type BggStatus = "idle" | "checking" | "found" | "not_found" | "error";

export function OnboardingForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bggUsername, setBggUsername] = useState("");
  const [bggStatus, setBggStatus] = useState<BggStatus>("idle");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // BGG-Name live prüfen (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (bggUsername.trim().length < 2) {
      setBggStatus("idle");
      return;
    }

    setBggStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/bgg/check-user?username=${encodeURIComponent(bggUsername.trim())}`
        );
        const data = await res.json();
        setBggStatus(data.exists ? "found" : "not_found");
      } catch {
        setBggStatus("error");
      }
    }, 700); // 700ms warten nach letztem Tastendruck

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [bggUsername]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      const updates: Record<string, string> = {};
      if (username.trim()) updates.username = username.trim();
      if (bggUsername.trim() && bggStatus === "found") {
        updates.bgg_username = bggUsername.trim();
      }

      if (Object.keys(updates).length > 0) {
        await supabase.from("profiles").update(updates).eq("id", user.id);
      }
    }

    router.push("/library");
  }

  function handleSkip() {
    router.push("/library");
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Username */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="username">Benutzername in MeepleBase</Label>
        <Input
          id="username"
          type="text"
          placeholder="z.B. meeple_max"
          value={username}
          onChange={(e) =>
            setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
          }
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          Nur Kleinbuchstaben, Zahlen und Unterstriche. Kann später geändert werden.
        </p>
      </div>

      {/* Trennlinie */}
      <div className="border-t border-border" />

      {/* BGG Username */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="bgg">BGG-Benutzername (optional)</Label>

        {/* Erklärbox */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-1">
          <p className="text-xs text-amber-800 leading-relaxed">
            <span className="font-semibold">Was ist BGG?</span> BoardGameGeek (bgg.cc) ist die
            größte Brettspieler-Community. Mit deinem BGG-Username kannst du deine
            bestehende Sammlung mit einem Klick importieren.
          </p>
        </div>

        {/* Input mit Status-Icon */}
        <div className="relative">
          <Input
            id="bgg"
            type="text"
            placeholder="z.B. MeepleMax42"
            value={bggUsername}
            onChange={(e) => setBggUsername(e.target.value)}
            disabled={loading}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            className={
              bggStatus === "found"
                ? "border-green-400 focus:ring-green-400"
                : bggStatus === "not_found"
                ? "border-red-400 focus:ring-red-400"
                : ""
            }
          />
          {/* Status-Icon rechts im Input */}
          {bggUsername.length >= 2 && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {bggStatus === "checking" && <SpinnerIcon />}
              {bggStatus === "found" && <CheckIcon />}
              {bggStatus === "not_found" && <CrossIcon />}
              {bggStatus === "error" && <WarningIcon />}
            </div>
          )}
        </div>

        {/* Status-Text */}
        <div className="min-h-[18px]">
          {bggStatus === "checking" && (
            <p className="text-xs text-muted-foreground">Prüfe BGG…</p>
          )}
          {bggStatus === "found" && (
            <p className="text-xs text-green-700 font-medium">
              ✓ BGG-Account gefunden – Sammlung kann importiert werden
            </p>
          )}
          {bggStatus === "not_found" && (
            <p className="text-xs text-red-600">
              Kein BGG-Account mit diesem Namen gefunden. Groß-/Kleinschreibung prüfen.
            </p>
          )}
          {bggStatus === "error" && (
            <p className="text-xs text-muted-foreground">
              BGG gerade nicht erreichbar – du kannst das später in den Einstellungen nachtragen.
            </p>
          )}
        </div>
      </div>

      {/* Buttons */}
      <div className="flex flex-col gap-2 pt-1">
        <Button
          type="submit"
          className="w-full h-11"
          disabled={loading || bggStatus === "checking"}
        >
          {loading
            ? "Speichern…"
            : username || (bggUsername && bggStatus === "found")
            ? "Speichern & loslegen"
            : "Ohne Angaben loslegen"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="w-full text-muted-foreground text-sm"
          onClick={handleSkip}
          disabled={loading}
        >
          Jetzt überspringen
        </Button>
      </div>
    </form>
  );
}

function SpinnerIcon() {
  return (
    <svg className="animate-spin h-4 w-4 text-muted-foreground" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function WarningIcon() {
  return (
    <svg className="h-4 w-4 text-amber-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}
