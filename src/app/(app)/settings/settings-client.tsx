"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Languages } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile } from "@/types";
import Link from "next/link";

type BggStatus = "idle" | "checking" | "found" | "not_found" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type TranslateStatus = "idle" | "running" | "done" | "error";

interface SettingsClientProps {
  user: User;
  profile: Profile | null;
}

export function SettingsClient({ user, profile }: SettingsClientProps) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bggUsername, setBggUsername] = useState(profile?.bgg_username ?? "");
  const [bggStatus, setBggStatus] = useState<BggStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [translateStatus, setTranslateStatus] = useState<TranslateStatus>("idle");
  const [translateResult, setTranslateResult] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const originalBgg = profile?.bgg_username ?? "";

  // BGG-Username live prüfen (nur wenn geändert)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const trimmed = bggUsername.trim();

    // Nichts geändert → kein Check nötig
    if (trimmed === originalBgg) {
      setBggStatus("idle");
      return;
    }

    if (trimmed.length < 2) {
      setBggStatus("idle");
      return;
    }

    setBggStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bgg/check-user?username=${encodeURIComponent(trimmed)}`);
        const data = await res.json();
        if (data.exists === true) setBggStatus("found");
        else if (data.exists === false) setBggStatus("not_found");
        else setBggStatus("error"); // exists === null means BGG unreachable
      } catch {
        setBggStatus("error");
      }
    }, 700);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [bggUsername, originalBgg]);

  async function handleSave() {
    setSaveStatus("saving");
    setSaveError(null);

    const supabase = createClient();
    const updates: Record<string, string | null> = {};

    const trimmedName = displayName.trim();
    if (trimmedName !== (profile?.display_name ?? "")) {
      updates.display_name = trimmedName || null;
    }

    const trimmedBgg = bggUsername.trim();
    if (trimmedBgg !== originalBgg) {
      // Nur blockieren wenn definitiv "nicht gefunden" oder noch am Prüfen
      if (bggStatus === "not_found") {
        setSaveError("BGG-Username nicht gefunden. Bitte prüfe die Schreibweise.");
        setSaveStatus("error");
        return;
      } else if (bggStatus === "checking") {
        setSaveError("Bitte warte bis die BGG-Prüfung abgeschlossen ist.");
        setSaveStatus("error");
        return;
      }
      // "found", "error" (unreachable) oder "" → speichern erlaubt
      updates.bgg_username = trimmedBgg || null;
    }

    if (Object.keys(updates).length === 0) {
      setSaveStatus("idle");
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", user.id);

    if (error) {
      setSaveError("Speichern fehlgeschlagen. Bitte nochmal versuchen.");
      setSaveStatus("error");
      return;
    }

    setSaveStatus("saved");
    router.refresh();
    setTimeout(() => setSaveStatus("idle"), 2500);
  }

  async function handleTranslate() {
    setTranslateStatus("running");
    setTranslateResult(null);
    try {
      const res = await fetch("/api/translate/batch", { method: "POST" });
      const data = await res.json() as { translated?: number; errors?: number; message?: string };
      if (!res.ok) throw new Error(data.message ?? "Fehler");
      if (data.message) {
        setTranslateResult(data.message);
      } else {
        setTranslateResult(`${data.translated ?? 0} Beschreibungen übersetzt, ${data.errors ?? 0} Fehler.`);
      }
      setTranslateStatus("done");
    } catch (e) {
      setTranslateResult(e instanceof Error ? e.message : "Unbekannter Fehler");
      setTranslateStatus("error");
    }
  }

  const hasChanges =
    displayName.trim() !== (profile?.display_name ?? "") ||
    bggUsername.trim() !== originalBgg;

  const canSave =
    hasChanges &&
    bggStatus !== "checking" &&
    bggStatus !== "not_found" &&
    saveStatus !== "saving";

  // When BGG is unreachable we still allow saving (error = can't verify, not "doesn't exist")

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)] bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-border">
        <Link
          href="/profile"
          className="p-2 -ml-2 rounded-xl hover:bg-muted transition-colors"
          aria-label="Zurück"
        >
          <ArrowLeft size={20} />
        </Link>
        <h1 className="font-display text-xl font-semibold text-foreground">Einstellungen</h1>
      </div>

      <div className="flex flex-col gap-5 px-4 py-6 max-w-lg mx-auto w-full">

        {/* ── Profil ─────────────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Profil</p>
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-4">

            {/* E-Mail (read-only) */}
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-muted-foreground">E-Mail</label>
              <p className="text-sm text-foreground">{user.email}</p>
            </div>

            {/* Anzeigename */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="displayName" className="text-sm font-medium text-foreground">
                Anzeigename
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="z.B. Max Mustermann"
                className="h-11 px-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all"
              />
            </div>
          </div>
        </section>

        {/* ── BGG-Verknüpfung ────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">BoardGameGeek</p>
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">

            <p className="text-xs text-muted-foreground leading-relaxed">
              Mit deinem BGG-Benutzernamen kannst du deine Sammlung importieren.
              Du findest deinen Benutzernamen auf{" "}
              <a
                href="https://boardgamegeek.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-600 underline underline-offset-2"
              >
                boardgamegeek.com
              </a>{" "}
              oben rechts nach dem Einloggen.
            </p>

            {/* BGG Input */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bggUsername" className="text-sm font-medium text-foreground">
                BGG-Benutzername
              </label>
              <div className="relative">
                <input
                  id="bggUsername"
                  type="text"
                  value={bggUsername}
                  onChange={(e) => setBggUsername(e.target.value)}
                  placeholder="z.B. Dein BGG-Username"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  className={`w-full h-11 pl-3.5 pr-10 rounded-xl border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:border-transparent transition-all ${
                    bggStatus === "found"
                      ? "border-green-400 focus:ring-green-400"
                      : bggStatus === "not_found"
                      ? "border-red-400 focus:ring-red-400"
                      : "border-border focus:ring-amber-400"
                  }`}
                />
                {/* Status icon */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {bggStatus === "checking" && <SpinnerIcon />}
                  {bggStatus === "found" && <CheckCircleIcon />}
                  {bggStatus === "not_found" && <XCircleIcon />}
                </div>
              </div>

              {/* Status text */}
              {bggStatus === "found" && (
                <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                  <Check size={12} /> BGG-Account gefunden
                </p>
              )}
              {bggStatus === "not_found" && (
                <p className="text-xs text-red-600">
                  Kein BGG-Account mit diesem Namen gefunden. Groß-/Kleinschreibung beachten.
                </p>
              )}
              {bggStatus === "error" && (
                <p className="text-xs text-muted-foreground">
                  BGG gerade nicht erreichbar – du kannst den Namen trotzdem speichern.
                </p>
              )}
            </div>

            {/* Link zur BGG-Sammlung */}
            {(profile?.bgg_username || bggStatus === "found") && (
              <a
                href={`https://boardgamegeek.com/collection/user/${bggUsername.trim() || profile?.bgg_username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-amber-600 font-medium hover:text-amber-700"
              >
                <ExternalLink size={12} />
                Sammlung auf BGG ansehen
              </a>
            )}
          </div>
        </section>

        {/* ── Fehler ─────────────────────────────────────────── */}
        {saveError && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-3.5 py-3 text-sm text-red-700">
            {saveError}
          </div>
        )}

        {/* ── Beschreibungen übersetzen ──────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Bibliothek</p>
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">Beschreibungen übersetzen</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Übersetzt bis zu 20 englische Spielbeschreibungen auf Deutsch. Kannst du mehrmals aufrufen.
              </p>
            </div>
            {translateResult && (
              <p className={`text-xs font-medium ${translateStatus === "error" ? "text-red-600" : "text-green-700"}`}>
                {translateResult}
              </p>
            )}
            <button
              onClick={handleTranslate}
              disabled={translateStatus === "running"}
              className="flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors disabled:opacity-50"
            >
              {translateStatus === "running" ? (
                <><SpinnerIcon /> Übersetze…</>
              ) : (
                <><Languages size={15} /> 20 Beschreibungen übersetzen</>
              )}
            </button>
          </div>
        </section>

        {/* ── Speichern-Button ───────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={!canSave}
          className={`w-full h-12 rounded-xl font-semibold text-base transition-all duration-200 flex items-center justify-center gap-2 ${
            saveStatus === "saved"
              ? "bg-green-500 text-white"
              : canSave
              ? "bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-sm"
              : "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {saveStatus === "saving" ? (
            <><SpinnerIcon /> Speichern…</>
          ) : saveStatus === "saved" ? (
            <><Check size={20} /> Gespeichert!</>
          ) : (
            "Änderungen speichern"
          )}
        </button>

      </div>
    </div>
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

function CheckCircleIcon() {
  return (
    <svg className="h-4 w-4 text-green-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
    </svg>
  );
}

function XCircleIcon() {
  return (
    <svg className="h-4 w-4 text-red-500" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
    </svg>
  );
}
