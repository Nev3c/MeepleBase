"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, ExternalLink, Languages, X, RefreshCw, Globe, Users, Lock, MapPin, Locate } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import type { Profile, LibraryVisibility } from "@/types";
import { cn } from "@/lib/utils";
import Link from "next/link";

type BggStatus = "idle" | "checking" | "found" | "not_found" | "error";
type LocationStatus = "idle" | "detecting" | "geocoding" | "detected" | "not-found" | "error";
type SaveStatus = "idle" | "saving" | "saved" | "error";
type TranslatePhase = "idle" | "counting" | "running" | "done" | "error";
type RefreshPhase   = "idle" | "running" | "done" | "error";

interface SettingsClientProps {
  user: User;
  profile: Profile | null;
}

export function SettingsClient({ user, profile }: SettingsClientProps) {
  const router = useRouter();

  const [displayName, setDisplayName] = useState(profile?.display_name ?? "");
  const [bggUsername, setBggUsername] = useState(profile?.bgg_username ?? "");
  const [libraryVisibility, setLibraryVisibility] = useState<LibraryVisibility>(
    (profile?.library_visibility as LibraryVisibility) ?? "friends"
  );
  const [location, setLocation] = useState(profile?.location ?? "");
  const [locationLat, setLocationLat] = useState<number | null>(profile?.location_lat ?? null);
  const [locationLng, setLocationLng] = useState<number | null>(profile?.location_lng ?? null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("idle");
  const [bggStatus, setBggStatus] = useState<BggStatus>("idle");
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [translatePhase, setTranslatePhase] = useState<TranslatePhase>("idle");
  const [translatePending, setTranslatePending] = useState<number | null>(null);
  const [translateTotal, setTranslateTotal] = useState(0);
  const [translateDone, setTranslateDone] = useState(0);
  const [translateNames, setTranslateNames] = useState<string[]>([]);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const translateAbort = useRef(false);

  // ── BGG Bulk Refresh state ─────────────────────────────────────────────────
  const [refreshPhase, setRefreshPhase]   = useState<RefreshPhase>("idle");
  const [refreshPending, setRefreshPending] = useState<number | null>(null);
  const [refreshTotal, setRefreshTotal]   = useState(0);
  const [refreshDone, setRefreshDone]     = useState(0);
  const [refreshNames, setRefreshNames]   = useState<string[]>([]);
  const [refreshErrors, setRefreshErrors] = useState(0);
  const refreshAbort = useRef(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const geocodeRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  async function detectLocation() {
    if (!navigator.geolocation) {
      setLocationStatus("error");
      return;
    }
    setLocationStatus("detecting");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&zoom=10&accept-language=de`,
            { headers: { "User-Agent": "MeepleBase/1.0" } }
          );
          const data = await res.json() as { address?: Record<string, string> };
          const addr = data.address ?? {};
          const city =
            addr.city ?? addr.town ?? addr.village ?? addr.municipality ?? addr.county ?? addr.state ?? "";
          setLocation(city);
          setLocationLat(latitude);
          setLocationLng(longitude);
          setLocationStatus("detected");
        } catch {
          // Geolocation worked, just use coords without city name
          setLocationLat(latitude);
          setLocationLng(longitude);
          setLocationStatus("detected");
        }
      },
      () => setLocationStatus("error"),
      { timeout: 10000, maximumAge: 60000 }
    );
  }

  async function handleSave() {
    setSaveStatus("saving");
    setSaveError(null);

    const supabase = createClient();
    const updates: Record<string, string | number | null> = {};

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

    const originalVisibility = (profile?.library_visibility as LibraryVisibility) ?? "friends";
    if (libraryVisibility !== originalVisibility) {
      updates.library_visibility = libraryVisibility;
    }

    const trimmedLocation = location.trim();
    if (trimmedLocation !== (profile?.location ?? "")) {
      updates.location = trimmedLocation || null;
    }
    if (locationLat !== (profile?.location_lat ?? null)) {
      updates.location_lat = locationLat;
    }
    if (locationLng !== (profile?.location_lng ?? null)) {
      updates.location_lng = locationLng;
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

  // Fetch pending count once on component mount and after translation
  const fetchPending = useCallback(async () => {
    try {
      const res = await fetch("/api/translate/batch");
      const data = await res.json() as { pending?: number };
      setTranslatePending(data.pending ?? 0);
    } catch {
      // ignore — non-critical
    }
  }, []);

  useEffect(() => { fetchPending(); }, [fetchPending]);

  // ── BGG Bulk Refresh functions ─────────────────────────────────────────────
  const fetchRefreshPending = useCallback(async () => {
    try {
      const res = await fetch("/api/games/refresh-bulk");
      const data = await res.json() as { pending?: number };
      setRefreshPending(data.pending ?? 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchRefreshPending(); }, [fetchRefreshPending]);

  async function handleStartRefresh() {
    refreshAbort.current = false;
    const pending = refreshPending ?? 0;
    if (pending === 0) return;

    setRefreshPhase("running");
    setRefreshTotal(pending);
    setRefreshDone(0);
    setRefreshNames([]);
    setRefreshErrors(0);

    let remaining = pending;
    while (remaining > 0 && !refreshAbort.current) {
      try {
        const res = await fetch("/api/games/refresh-bulk", { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as {
          refreshed: number; errors: number; names: string[]; remaining: number; done: boolean;
        };
        setRefreshDone((d) => d + data.refreshed);
        setRefreshErrors((e) => e + data.errors);
        setRefreshNames((n) => [...n, ...data.names]);
        remaining = data.remaining;
        if (data.done) break;
      } catch {
        setRefreshPhase("error");
        return;
      }
    }

    if (!refreshAbort.current) {
      setRefreshPhase("done");
      setRefreshPending(0);
    }
  }

  function handleStopRefresh() {
    refreshAbort.current = true;
    setRefreshPhase("idle");
    fetchRefreshPending();
  }

  async function handleStartTranslate() {
    translateAbort.current = false;
    const pending = translatePending ?? 0;
    if (pending === 0) return;

    setTranslatePhase("running");
    setTranslateTotal(pending);
    setTranslateDone(0);
    setTranslateNames([]);
    setTranslateError(null);

    let totalDone = 0;

    while (!translateAbort.current) {
      try {
        const res = await fetch("/api/translate/batch", { method: "POST" });
        const data = await res.json() as {
          translated?: number; errors?: number; names?: string[];
          remaining?: number; done?: boolean; error?: string;
        };
        if (!res.ok) throw new Error(data.error ?? "Serverfehler");

        totalDone += data.translated ?? 0;
        setTranslateDone(totalDone);
        setTranslateNames((prev) => [...(data.names ?? []), ...prev].slice(0, 40));

        if (data.done || (data.remaining ?? 0) === 0) {
          setTranslatePhase("done");
          setTranslatePending(0);
          break;
        }
      } catch (e) {
        setTranslateError(e instanceof Error ? e.message : "Unbekannter Fehler");
        setTranslatePhase("error");
        break;
      }
    }
  }

  function handleStopTranslate() {
    translateAbort.current = true;
    setTranslatePhase("idle");
    fetchPending();
  }

  const originalVisibility = (profile?.library_visibility as LibraryVisibility) ?? "friends";
  const hasChanges =
    displayName.trim() !== (profile?.display_name ?? "") ||
    bggUsername.trim() !== originalBgg ||
    libraryVisibility !== originalVisibility ||
    location.trim() !== (profile?.location ?? "") ||
    locationLat !== (profile?.location_lat ?? null) ||
    locationLng !== (profile?.location_lng ?? null);

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

            {/* Standort */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="location" className="text-sm font-medium text-foreground">
                Standort
              </label>
              <p className="text-xs text-muted-foreground -mt-1 leading-relaxed">
                Wird anderen Spielern angezeigt und ermöglicht die Suche nach Spielern in deiner Nähe.
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <input
                    id="location"
                    type="text"
                    value={location}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocation(val);
                      setLocationLat(null);
                      setLocationLng(null);

                      if (geocodeRef.current) clearTimeout(geocodeRef.current);

                      if (val.trim().length < 2) {
                        setLocationStatus("idle");
                        return;
                      }

                      setLocationStatus("geocoding");
                      geocodeRef.current = setTimeout(async () => {
                        try {
                          const res = await fetch(
                            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(val.trim())}&format=json&limit=1`,
                            { headers: { "User-Agent": "MeepleBase/1.0" } }
                          );
                          const data = await res.json() as Array<{ lat: string; lon: string }>;
                          if (data.length > 0) {
                            setLocationLat(parseFloat(data[0].lat));
                            setLocationLng(parseFloat(data[0].lon));
                            setLocationStatus("detected");
                          } else {
                            setLocationStatus("not-found");
                          }
                        } catch {
                          setLocationStatus("idle");
                        }
                      }, 800);
                    }}
                    placeholder="z.B. Ulm"
                    className="w-full h-11 pl-9 pr-3.5 rounded-xl border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-all min-w-0"
                  />
                </div>
                <button
                  type="button"
                  onClick={detectLocation}
                  disabled={locationStatus === "detecting"}
                  className="flex items-center gap-1.5 px-3 h-11 rounded-xl border border-border bg-background text-sm text-muted-foreground hover:text-foreground hover:border-amber-400 transition-all disabled:opacity-50 flex-shrink-0"
                  title="Aktuellen Standort erkennen"
                >
                  {locationStatus === "detecting" ? (
                    <SpinnerIcon />
                  ) : (
                    <Locate size={15} />
                  )}
                </button>
              </div>
              {locationStatus === "geocoding" && (
                <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded-full border-2 border-amber-400 border-t-transparent animate-spin inline-block" />
                  Koordinaten werden ermittelt…
                </p>
              )}
              {locationStatus === "detected" && locationLat !== null && (
                <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                  <Check size={12} /> Koordinaten gefunden{location ? ` · ${location}` : ""}
                </p>
              )}
              {locationStatus === "not-found" && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  Ort nicht gefunden — bitte genauer eingeben (z.B. Stadt oder PLZ).
                </p>
              )}
              {locationStatus === "error" && (
                <p className="text-xs text-red-600">
                  Standortzugriff verweigert. Bitte in den Browser-Einstellungen erlauben oder Ort manuell eingeben.
                </p>
              )}
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
              <p className="text-sm font-medium text-foreground mb-0.5">Spielbeschreibungen übersetzen</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Übersetzt englische Spielbeschreibungen automatisch auf Deutsch (Google Translate).
              </p>
            </div>

            {/* Idle / pending count */}
            {translatePhase === "idle" && (
              <>
                {translatePending === null ? (
                  <p className="text-xs text-muted-foreground">Lade…</p>
                ) : translatePending === 0 ? (
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                    <Check size={13} /> Alle Beschreibungen bereits auf Deutsch
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{translatePending}</span> Spiele ohne deutsche Beschreibung
                  </p>
                )}
                <button
                  onClick={handleStartTranslate}
                  disabled={!translatePending}
                  className="flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  <Languages size={15} />
                  {translatePending ? `Alle ${translatePending} Spiele übersetzen` : "Nichts zu übersetzen"}
                </button>
              </>
            )}

            {/* Running */}
            {translatePhase === "running" && (
              <div className="flex flex-col gap-2.5">
                {/* Progress bar */}
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{translateDone} / {translateTotal} übersetzt</span>
                  <button onClick={handleStopTranslate} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <X size={12} /> Stopp
                  </button>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${translateTotal > 0 ? Math.round((translateDone / translateTotal) * 100) : 0}%` }}
                  />
                </div>
                {/* Translated names */}
                {translateNames.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-2.5 max-h-28 overflow-y-auto">
                    {translateNames.map((n, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-snug flex items-center gap-1.5">
                        <Check size={11} className="text-green-500 flex-shrink-0" /> {n}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground animate-pulse">Übersetze…</p>
              </div>
            )}

            {/* Done */}
            {translatePhase === "done" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                  <Check size={15} /> {translateDone} Spiele übersetzt!
                </p>
                {translateNames.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-2.5 max-h-28 overflow-y-auto">
                    {translateNames.map((n, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-snug">✓ {n}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => { setTranslatePhase("idle"); fetchPending(); }} className="text-xs text-amber-600 underline underline-offset-2 text-left">
                  Zurücksetzen
                </button>
              </div>
            )}

            {/* Error */}
            {translatePhase === "error" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-600 font-medium">{translateError}</p>
                <button onClick={() => { setTranslatePhase("idle"); fetchPending(); }} className="text-xs text-amber-600 underline underline-offset-2 text-left">
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── BGG-Daten aktualisieren ────────────────────────── */}
        <section>
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">BGG-Daten aktualisieren</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Holt Komplexität, Verlag, Community-Spielerempfehlung, Alternativnamen und Titelbilder (offizielles Cover) für alle Spiele deiner Bibliothek von BGG.
              </p>
            </div>

            {/* Idle */}
            {refreshPhase === "idle" && (
              <>
                {refreshPending === null ? (
                  <p className="text-xs text-muted-foreground">Lade…</p>
                ) : refreshPending === 0 ? (
                  <p className="text-xs text-green-700 font-medium flex items-center gap-1.5">
                    <Check size={13} /> Alle Spiele bereits aktuell
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{refreshPending}</span> Spiele noch nicht vollständig aktualisiert
                  </p>
                )}
                <button
                  onClick={handleStartRefresh}
                  disabled={!refreshPending}
                  className="flex items-center justify-center gap-2 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium hover:bg-amber-100 active:bg-amber-200 transition-colors disabled:opacity-50"
                >
                  <RefreshCw size={15} />
                  {refreshPending ? `Alle ${refreshPending} Spiele aktualisieren` : "Nichts zu aktualisieren"}
                </button>
              </>
            )}

            {/* Running */}
            {refreshPhase === "running" && (
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{refreshDone} / {refreshTotal} aktualisiert</span>
                  <button onClick={handleStopRefresh} className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors">
                    <X size={12} /> Stopp
                  </button>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${refreshTotal > 0 ? Math.round((refreshDone / refreshTotal) * 100) : 0}%` }}
                  />
                </div>
                {refreshNames.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-2.5 max-h-28 overflow-y-auto">
                    {refreshNames.map((n, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-snug flex items-center gap-1.5">
                        <Check size={11} className="text-green-500 flex-shrink-0" /> {n}
                      </p>
                    ))}
                  </div>
                )}
                <p className="text-[11px] text-muted-foreground animate-pulse">Frage BGG an… (ca. {Math.ceil((refreshTotal - refreshDone) / 5 * 3)} Sek.)</p>
              </div>
            )}

            {/* Done */}
            {refreshPhase === "done" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
                  <Check size={15} /> {refreshDone} Spiele aktualisiert{refreshErrors > 0 ? `, ${refreshErrors} Fehler` : ""}
                </p>
                {refreshNames.length > 0 && (
                  <div className="bg-muted/50 rounded-xl p-2.5 max-h-28 overflow-y-auto">
                    {refreshNames.map((n, i) => (
                      <p key={i} className="text-xs text-muted-foreground leading-snug">✓ {n}</p>
                    ))}
                  </div>
                )}
                <button onClick={() => { setRefreshPhase("idle"); fetchRefreshPending(); }} className="text-xs text-amber-600 underline underline-offset-2 text-left">
                  Zurücksetzen
                </button>
              </div>
            )}

            {/* Error */}
            {refreshPhase === "error" && (
              <div className="flex flex-col gap-2">
                <p className="text-xs text-red-600 font-medium">BGG nicht erreichbar — bitte erneut versuchen.</p>
                <button onClick={() => { setRefreshPhase("idle"); fetchRefreshPending(); }} className="text-xs text-amber-600 underline underline-offset-2 text-left">
                  Erneut versuchen
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Privatsphäre ──────────────────────────────────── */}
        <section>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Privatsphäre</p>
          <div className="bg-card rounded-2xl border border-border shadow-card p-4 flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium text-foreground mb-0.5">Bibliothek-Sichtbarkeit</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Lege fest, wer deine Spielebibliothek sehen kann. Andere sehen nur: Cover, Spielname und Anzahl Partien — keine persönlichen Notizen oder Preise.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              {([
                { value: "public" as LibraryVisibility, icon: <Globe size={15} />, label: "Öffentlich", desc: "Alle registrierten Spieler können deine Bibliothek sehen" },
                { value: "friends" as LibraryVisibility, icon: <Users size={15} />, label: "Nur Freunde", desc: "Nur bestätigte Freunde sehen deine Bibliothek" },
                { value: "private" as LibraryVisibility, icon: <Lock size={15} />, label: "Privat", desc: "Niemand kann deine Bibliothek sehen" },
              ] as const).map(({ value, icon, label, desc }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLibraryVisibility(value)}
                  className={cn(
                    "flex items-start gap-3 w-full px-3.5 py-3 rounded-xl border text-left transition-all",
                    libraryVisibility === value
                      ? "bg-amber-50 border-amber-400"
                      : "bg-background border-border hover:border-muted-foreground/30"
                  )}
                >
                  <span className={cn("mt-0.5 flex-shrink-0", libraryVisibility === value ? "text-amber-600" : "text-muted-foreground")}>
                    {icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-sm font-medium", libraryVisibility === value ? "text-amber-800" : "text-foreground")}>
                      {label}
                    </p>
                    <p className="text-xs text-muted-foreground leading-snug mt-0.5">{desc}</p>
                  </div>
                  <span className={cn(
                    "mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all",
                    libraryVisibility === value ? "border-amber-500 bg-amber-500" : "border-border"
                  )}>
                    {libraryVisibility === value && (
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    )}
                  </span>
                </button>
              ))}
            </div>
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
