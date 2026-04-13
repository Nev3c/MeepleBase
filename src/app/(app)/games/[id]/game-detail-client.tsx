"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft,
  Users,
  Clock,
  Star,
  ExternalLink,
  Trash2,
  Edit2,
  Check,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Game, UserGame, GameStatus } from "@/types";

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: "owned", label: "Im Besitz" },
  { value: "wishlist", label: "Wunschliste" },
  { value: "want_to_play", label: "Möchte spielen" },
  { value: "for_trade", label: "Zum Tausch" },
  { value: "previously_owned", label: "Ehemals besessen" },
];

const STATUS_COLORS: Record<GameStatus, string> = {
  owned: "bg-emerald-100 text-emerald-800",
  wishlist: "bg-violet-100 text-violet-800",
  want_to_play: "bg-sky-100 text-sky-800",
  for_trade: "bg-orange-100 text-orange-800",
  previously_owned: "bg-slate-100 text-slate-600",
};

interface GameDetailClientProps {
  game: Game;
  userGame: UserGame | null;
}

export function GameDetailClient({ game, userGame }: GameDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GameStatus>(userGame?.status ?? "owned");
  const [editingStatus, setEditingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleStatusSave(newStatus: GameStatus) {
    if (!userGame) return;
    setSaving(true);
    try {
      await fetch(`/api/user-games/${userGame.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setStatus(newStatus);
    } finally {
      setSaving(false);
      setEditingStatus(false);
    }
  }

  async function handleDelete() {
    if (!userGame) return;
    setDeleting(true);
    const res = await fetch(`/api/user-games/${userGame.id}`, { method: "DELETE" });
    if (res.ok) {
      router.push("/library");
      router.refresh();
    } else {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  const hasMeta = game.min_players || game.max_players || game.min_playtime || game.max_playtime;

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Hero image + back button */}
      <div className="relative w-full aspect-[16/9] bg-muted overflow-hidden">
        {game.image_url || game.thumbnail_url ? (
          <Image
            src={(game.image_url ?? game.thumbnail_url)!}
            alt={game.name}
            fill
            className="object-cover"
            sizes="100vw"
            priority
          />
        ) : (
          <PlaceholderHero name={game.name} />
        )}
        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-background/20 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md"
          aria-label="Zurück"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-col gap-5 px-4 pb-10 -mt-6 relative z-10">
        {/* Title + year */}
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground leading-tight">
            {game.name}
          </h1>
          {game.year_published && (
            <p className="text-muted-foreground text-sm mt-0.5">{game.year_published}</p>
          )}
        </div>

        {/* Status badge + edit */}
        {userGame && (
          <div className="flex items-center gap-2">
            {editingStatus ? (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex flex-wrap gap-2">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleStatusSave(opt.value)}
                      disabled={saving}
                      className={cn(
                        "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                        status === opt.value
                          ? "bg-amber-500 text-white"
                          : "bg-muted text-foreground hover:bg-muted/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setEditingStatus(false)}
                  className="self-start text-xs text-muted-foreground flex items-center gap-1"
                >
                  <X size={12} /> Abbrechen
                </button>
              </div>
            ) : (
              <>
                <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[status])}>
                  {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                </span>
                <button
                  onClick={() => setEditingStatus(true)}
                  className="w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                  aria-label="Status ändern"
                >
                  <Edit2 size={13} />
                </button>
              </>
            )}
          </div>
        )}

        {/* Meta stats */}
        {hasMeta && (
          <div className="flex flex-wrap gap-3">
            {(game.min_players || game.max_players) && (
              <Stat icon={<Users size={14} />} label={formatPlayers(game.min_players, game.max_players)} />
            )}
            {(game.min_playtime || game.max_playtime) && (
              <Stat icon={<Clock size={14} />} label={formatTime(game.min_playtime, game.max_playtime)} />
            )}
            {game.complexity && (
              <Stat icon={<Star size={14} />} label={`${game.complexity.toFixed(1)} / 5`} sublabel="Komplexität" />
            )}
            {game.rating_avg && (
              <Stat icon={<Star size={14} className="text-amber-500" />} label={game.rating_avg.toFixed(1)} sublabel="BGG-Wertung" />
            )}
          </div>
        )}

        {/* Description */}
        {game.description && (
          <section>
            <h2 className="text-sm font-semibold text-foreground mb-2">Beschreibung</h2>
            <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
              {game.description}
            </p>
          </section>
        )}

        {/* Categories + Mechanics */}
        {(game.categories?.length || game.mechanics?.length) && (
          <section className="flex flex-col gap-3">
            {game.categories && game.categories.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Kategorien</h2>
                <div className="flex flex-wrap gap-1.5">
                  {game.categories.map((c) => (
                    <span key={c} className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs rounded-full font-medium">
                      {c}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {game.mechanics && game.mechanics.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Mechanismen</h2>
                <div className="flex flex-wrap gap-1.5">
                  {game.mechanics.slice(0, 8).map((m) => (
                    <span key={m} className="px-2.5 py-1 bg-slate-100 text-slate-700 text-xs rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* Designers */}
        {game.designers && game.designers.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Designer</h2>
            <p className="text-sm text-foreground">{game.designers.join(", ")}</p>
          </section>
        )}

        {/* BGG Link */}
        <a
          href={`https://boardgamegeek.com/boardgame/${game.bgg_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-sm text-amber-600 font-medium"
        >
          <ExternalLink size={14} />
          Auf BoardGameGeek ansehen
        </a>

        {/* Delete section */}
        {userGame && (
          <div className="mt-4 pt-4 border-t border-border">
            {deleteConfirm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground font-medium">
                  &quot;{game.name}&quot; wirklich aus der Bibliothek entfernen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold transition-opacity disabled:opacity-50"
                  >
                    {deleting ? (
                      <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    ) : (
                      <Check size={14} />
                    )}
                    Ja, entfernen
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(false)}
                    className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setDeleteConfirm(true)}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-red-500 transition-colors"
              >
                <Trash2 size={14} />
                Aus Bibliothek entfernen
              </button>
            )}
          </div>
        )}

        {/* Not in library hint */}
        {!userGame && (
          <div className="mt-4 pt-4 border-t border-border">
            <Link
              href="/library"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Zur Bibliothek
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ icon, label, sublabel }: { icon: React.ReactNode; label: string; sublabel?: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-2 bg-muted rounded-xl">
      <span className="text-muted-foreground">{icon}</span>
      <div>
        <p className="text-sm font-semibold text-foreground leading-none">{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
      </div>
    </div>
  );
}

function PlaceholderHero({ name }: { name: string }) {
  const hue = name.charCodeAt(0) % 360;
  return (
    <div
      className="w-full h-full flex items-center justify-center"
      style={{ background: `hsl(${hue} 35% 35%)` }}
    >
      <span className="font-display font-bold text-white/20 text-8xl select-none">
        {name[0]?.toUpperCase()}
      </span>
    </div>
  );
}

function formatPlayers(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}–${max} Spieler`;
  if (min || max) return `${min ?? max} Spieler`;
  return "";
}

function formatTime(min: number | null, max: number | null): string {
  if (min && max && min !== max) return `${min}–${max} Min`;
  if (min || max) return `${min ?? max} Min`;
  return "";
}
