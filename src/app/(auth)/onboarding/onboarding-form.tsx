"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";
import { Library, Dices, Compass, UserCircle, ChevronRight } from "lucide-react";

type BggStatus = "idle" | "checking" | "found" | "not_found" | "error";

// ── Step definitions ────────────────────────────────────────────────────────

const GUIDE_STEPS = [
  {
    icon: <Library size={48} className="text-amber-500" />,
    title: "Bibliothek",
    description: "Alle deine Spiele an einem Ort. Status, Bewertungen, eigene Notizen und Bilder — auch ohne Internet.",
  },
  {
    icon: <Dices size={48} className="text-amber-500" />,
    title: "Partien",
    description: "Halte jede Partie fest: Mitspieler, Punkte, Gewinner, Fotos und Spielzeit. Dein persönliches Spieltagebuch.",
  },
  {
    icon: <Compass size={48} className="text-amber-500" />,
    title: "Entdecken",
    description: "Ungespielt: welche Spiele liegen noch unberührt? Was heute spielen? Passende Spiele nach Spieleranzahl & Zeit.",
  },
  {
    icon: <UserCircle size={48} className="text-amber-500" />,
    title: "Profil",
    description: "Deine Stats auf einen Blick. QR-Code zum Teilen der App — und in Phase 2 auch dein Spieler-Profil für Freunde.",
  },
];

const TOTAL_STEPS = GUIDE_STEPS.length + 2; // guide steps + install step + profile step

// ── Main Component ──────────────────────────────────────────────────────────

export function OnboardingForm() {
  const [step, setStep] = useState(0);

  function next() { setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1)); }
  function back() { setStep((s) => Math.max(s - 1, 0)); }

  // Guide steps 0–3
  if (step < GUIDE_STEPS.length) {
    const s = GUIDE_STEPS[step];
    return <GuideStep {...s} step={step} total={TOTAL_STEPS} onNext={next} onBack={step > 0 ? back : undefined} />;
  }

  // Install step
  if (step === GUIDE_STEPS.length) {
    return <InstallStep step={step} total={TOTAL_STEPS} onNext={next} onBack={back} />;
  }

  // Profile step (last)
  return <ProfileStep step={step} total={TOTAL_STEPS} onBack={back} />;
}

// ── Dot indicator ───────────────────────────────────────────────────────────

function Dots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex gap-1.5 justify-center">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i === current ? "w-5 h-1.5 bg-amber-500" : "w-1.5 h-1.5 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Guide Step ──────────────────────────────────────────────────────────────

function GuideStep({
  icon, title, description, step, total, onNext, onBack,
}: {
  icon: React.ReactNode; title: string; description: string;
  step: number; total: number; onNext: () => void; onBack?: () => void;
}) {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="bg-card rounded-3xl border border-border shadow-card p-8 flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 rounded-2xl bg-amber-50 flex items-center justify-center">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-2xl font-semibold text-foreground mb-2">{title}</h2>
          <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Dots current={step} total={total} />
        <div className="flex gap-2">
          {onBack && (
            <Button variant="outline" className="flex-1 h-11" onClick={onBack}>
              Zurück
            </Button>
          )}
          <Button className="flex-1 h-11 gap-1" onClick={onNext}>
            Weiter <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Install Step ────────────────────────────────────────────────────────────

function InstallStep({ step, total, onNext, onBack }: { step: number; total: number; onNext: () => void; onBack: () => void }) {
  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="bg-card rounded-3xl border border-border shadow-card p-6 flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl overflow-hidden shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="MeepleBase" className="w-full h-full object-cover" />
          </div>
          <div>
            <h2 className="font-display text-xl font-semibold text-foreground">App installieren</h2>
            <p className="text-sm text-muted-foreground mt-1">Nutze MeepleBase wie eine echte App — ohne Browser-Leiste, direkt vom Homescreen.</p>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          {/* Android */}
          <div className="bg-muted/50 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl flex-shrink-0">🤖</span>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">Android (Chrome)</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Menü <span className="font-mono bg-muted px-1 rounded">⋮</span> oben rechts tippen</li>
                <li>„<strong>Zum Startbildschirm hinzufügen</strong>" wählen</li>
                <li>„Installieren" bestätigen</li>
              </ol>
            </div>
          </div>

          {/* iOS */}
          <div className="bg-muted/50 rounded-2xl p-4 flex gap-3">
            <span className="text-2xl flex-shrink-0">🍎</span>
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">iPhone / iPad (Safari)</p>
              <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Teilen-Symbol <span className="font-mono bg-muted px-1 rounded">⬆</span> unten tippen</li>
                <li>„<strong>Zum Home-Bildschirm</strong>" wählen</li>
                <li>„Hinzufügen" bestätigen</li>
              </ol>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Dots current={step} total={total} />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1 h-11" onClick={onBack}>Zurück</Button>
          <Button className="flex-1 h-11 gap-1" onClick={onNext}>
            Weiter <ChevronRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── Profile / BGG Step (last) ───────────────────────────────────────────────

function ProfileStep({ step, total, onBack }: { step: number; total: number; onBack: () => void }) {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [bggUsername, setBggUsername] = useState("");
  const [bggStatus, setBggStatus] = useState<BggStatus>("idle");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (bggUsername.trim().length < 2) { setBggStatus("idle"); return; }
    setBggStatus("checking");
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/bgg/check-user?username=${encodeURIComponent(bggUsername.trim())}`);
        const data = await res.json();
        setBggStatus(data.exists ? "found" : "not_found");
      } catch { setBggStatus("error"); }
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [bggUsername]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const updates: Record<string, string> = {};
      if (username.trim()) updates.username = username.trim();
      if (bggUsername.trim() && bggStatus === "found") updates.bgg_username = bggUsername.trim();
      if (Object.keys(updates).length > 0) {
        await supabase.from("profiles").update(updates).eq("id", user.id);
      }
    }
    router.push("/library");
  }

  return (
    <div className="flex flex-col gap-8 animate-slide-up">
      <div className="bg-card rounded-3xl border border-border shadow-card p-6">
        <div className="text-center mb-6">
          <h2 className="font-display text-xl font-semibold text-foreground">Profil einrichten</h2>
          <p className="text-sm text-muted-foreground mt-1">Optional — kann jederzeit geändert werden.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="username">Benutzername</Label>
            <Input
              id="username" type="text" placeholder="z.B. meeple_max"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
              autoComplete="off" autoCorrect="off" autoCapitalize="off" disabled={loading}
            />
            <p className="text-xs text-muted-foreground">Kleinbuchstaben, Zahlen, Unterstriche.</p>
          </div>

          <div className="border-t border-border" />

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="bgg">BGG-Username (optional)</Label>
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-1">
              <p className="text-xs text-amber-800 leading-relaxed">
                <span className="font-semibold">BoardGameGeek-Account?</span> Damit kannst du deine bestehende Sammlung mit einem Klick importieren.
              </p>
            </div>
            <div className="relative">
              <Input
                id="bgg" type="text" placeholder="z.B. MeepleMax42"
                value={bggUsername} onChange={(e) => setBggUsername(e.target.value)}
                disabled={loading} autoComplete="off" autoCorrect="off" autoCapitalize="off"
                className={bggStatus === "found" ? "border-green-400" : bggStatus === "not_found" ? "border-red-400" : ""}
              />
              {bggUsername.length >= 2 && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm">
                  {bggStatus === "checking" && <span className="text-muted-foreground">…</span>}
                  {bggStatus === "found" && <span className="text-green-600">✓</span>}
                  {bggStatus === "not_found" && <span className="text-red-500">✗</span>}
                </div>
              )}
            </div>
            {bggStatus === "found" && <p className="text-xs text-green-700 font-medium">BGG-Account gefunden — Sammlung importierbar</p>}
            {bggStatus === "not_found" && <p className="text-xs text-red-600">Nicht gefunden. Groß-/Kleinschreibung prüfen.</p>}
          </div>

          <div className="flex flex-col gap-3 pt-1">
            <Dots current={step} total={total} />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1 h-11" onClick={onBack} disabled={loading}>
                Zurück
              </Button>
              <Button type="submit" className="flex-1 h-11" disabled={loading || bggStatus === "checking"}>
                {loading ? "Speichern…" : "Loslegen 🎲"}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
