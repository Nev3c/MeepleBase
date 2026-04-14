"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Users, Clock, Star, ExternalLink, Trash2,
  Edit2, Check, X, Plus, Camera, FileText, BookOpen,
  ChevronDown, ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translateCategories, translateMechanics } from "@/lib/bgg-translations";
import type { Game, UserGame, GameStatus, GameNote, NoteType, CustomFields } from "@/types";
import { ImageLightbox } from "@/components/shared/image-lightbox";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserGameImage {
  id: string;
  url: string;
  label: string | null;
  storage_path: string;
}

interface PlaySummary {
  id: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  cooperative: boolean;
  players?: Array<{ id: string; display_name: string; winner: boolean; score: number | null }>;
}

const STATUS_OPTIONS: { value: GameStatus; label: string }[] = [
  { value: "owned",            label: "Im Besitz" },
  { value: "wishlist",         label: "Wunschliste" },
  { value: "want_to_play",     label: "Möchte spielen" },
  { value: "for_trade",        label: "Zum Tausch" },
  { value: "previously_owned", label: "Ehemals besessen" },
];

const STATUS_COLORS: Record<GameStatus, string> = {
  owned:            "bg-emerald-100 text-emerald-800",
  wishlist:         "bg-violet-100 text-violet-800",
  want_to_play:     "bg-sky-100 text-sky-800",
  for_trade:        "bg-orange-100 text-orange-800",
  previously_owned: "bg-slate-100 text-slate-600",
};

interface GameDetailClientProps {
  game: Game;
  userGame: UserGame | null;
  initialNotes?: GameNote[];
  initialImages?: UserGameImage[];
  initialPlays?: PlaySummary[];
}

// ── Main component ─────────────────────────────────────────────────────────────

export function GameDetailClient({ game, userGame, initialNotes = [], initialImages = [], initialPlays = [] }: GameDetailClientProps) {
  const router = useRouter();
  const [status, setStatus] = useState<GameStatus>(userGame?.status ?? "owned");
  const [editingStatus, setEditingStatus] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [notes, setNotes] = useState<GameNote[]>(initialNotes);
  const [images, setImages] = useState<UserGameImage[]>(initialImages);
  const [personalRating, setPersonalRating] = useState<number | null>(userGame?.personal_rating ?? null);

  // Custom overrides stored in user_games.custom_fields
  const initialCustom: CustomFields = userGame?.custom_fields ?? {};
  const [customFields, setCustomFields] = useState<CustomFields>(initialCustom);
  const [editingInfo, setEditingInfo] = useState(false);
  const [draftName, setDraftName] = useState(customFields.name ?? game.name);
  const [draftDesc, setDraftDesc] = useState(customFields.description ?? game.description_de ?? game.description ?? "");
  const [draftMinPlayers, setDraftMinPlayers] = useState(customFields.min_players?.toString() ?? "");
  const [draftMaxPlayers, setDraftMaxPlayers] = useState(customFields.max_players?.toString() ?? "");
  const [draftMinPlaytime, setDraftMinPlaytime] = useState(customFields.min_playtime?.toString() ?? "");
  const [draftMaxPlaytime, setDraftMaxPlaytime] = useState(customFields.max_playtime?.toString() ?? "");
  const [draftCategories, setDraftCategories] = useState(customFields.categories?.join(", ") ?? "");
  const [savingInfo, setSavingInfo] = useState(false);

  const displayName = customFields.name ?? game.name;
  const displayDesc = customFields.description ?? game.description_de ?? game.description;

  // Effective player/playtime values (custom overrides BGG)
  const effMinPlayers = customFields.min_players ?? game.min_players;
  const effMaxPlayers = customFields.max_players ?? game.max_players;
  const effMinPlaytime = customFields.min_playtime ?? game.min_playtime;
  const effMaxPlaytime = customFields.max_playtime ?? game.max_playtime;

  async function handleSaveInfo() {
    if (!userGame) return;
    setSavingInfo(true);

    const newCustom: CustomFields = { ...customFields };

    // Name
    if (draftName.trim() && draftName.trim() !== game.name) {
      newCustom.name = draftName.trim();
    } else {
      delete newCustom.name;
    }

    // Description
    if (draftDesc.trim() && draftDesc.trim() !== (game.description ?? "")) {
      newCustom.description = draftDesc.trim();
    } else {
      delete newCustom.description;
    }

    // Players
    const minP = draftMinPlayers !== "" ? Number(draftMinPlayers) : null;
    const maxP = draftMaxPlayers !== "" ? Number(draftMaxPlayers) : null;
    if (minP !== null) newCustom.min_players = minP; else delete newCustom.min_players;
    if (maxP !== null) newCustom.max_players = maxP; else delete newCustom.max_players;

    // Playtime
    const minT = draftMinPlaytime !== "" ? Number(draftMinPlaytime) : null;
    const maxT = draftMaxPlaytime !== "" ? Number(draftMaxPlaytime) : null;
    if (minT !== null) newCustom.min_playtime = minT; else delete newCustom.min_playtime;
    if (maxT !== null) newCustom.max_playtime = maxT; else delete newCustom.max_playtime;

    // Categories
    const cats = draftCategories.split(",").map((s) => s.trim()).filter(Boolean);
    if (cats.length > 0) newCustom.categories = cats; else delete newCustom.categories;

    await fetch(`/api/user-games/${userGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields: Object.keys(newCustom).length > 0 ? newCustom : null }),
    });
    setCustomFields(newCustom);
    setEditingInfo(false);
    setSavingInfo(false);
  }

  const categories = customFields.categories ?? translateCategories(game.categories);
  const mechanics = translateMechanics(game.mechanics);

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

  async function handleRatingClick(rating: number) {
    if (!userGame) return;
    const newRating = personalRating === rating ? null : rating;
    setPersonalRating(newRating);
    await fetch(`/api/user-games/${userGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personal_rating: newRating }),
    });
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

  const hasMeta = effMinPlayers || effMaxPlayers || effMinPlaytime || effMaxPlaytime;

  // Plays summary data
  const playCount = initialPlays.length;
  const allPlayerNames = Array.from(
    new Set(initialPlays.flatMap((p) => p.players?.map((pl) => pl.display_name) ?? []))
  );
  const recentPlays = initialPlays.slice(0, 3);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* Hero */}
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
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/10 to-transparent" />
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center shadow-md"
          aria-label="Zurück"
        >
          <ArrowLeft size={18} />
        </button>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-12 pt-4 relative z-10">
        {/* Title + Edit */}
        {editingInfo ? (
          <div className="flex flex-col gap-3 bg-muted/30 rounded-2xl p-4">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Name</label>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full text-lg font-bold bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Beschreibung</label>
              <textarea
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                rows={5}
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spieler Min</label>
                <input
                  type="number"
                  value={draftMinPlayers}
                  onChange={(e) => setDraftMinPlayers(e.target.value)}
                  placeholder={game.min_players?.toString() ?? "–"}
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spieler Max</label>
                <input
                  type="number"
                  value={draftMaxPlayers}
                  onChange={(e) => setDraftMaxPlayers(e.target.value)}
                  placeholder={game.max_players?.toString() ?? "–"}
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spielzeit Min</label>
                <input
                  type="number"
                  value={draftMinPlaytime}
                  onChange={(e) => setDraftMinPlaytime(e.target.value)}
                  placeholder={game.min_playtime?.toString() ?? "–"}
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spielzeit Max</label>
                <input
                  type="number"
                  value={draftMaxPlaytime}
                  onChange={(e) => setDraftMaxPlaytime(e.target.value)}
                  placeholder={game.max_playtime?.toString() ?? "–"}
                  className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Kategorien (kommagetrennt)</label>
              <input
                value={draftCategories}
                onChange={(e) => setDraftCategories(e.target.value)}
                placeholder="z.B. Strategie, Familienspiel"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSaveInfo} disabled={savingInfo} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500 text-white text-sm font-semibold disabled:opacity-50">
                <Check size={13} /> Speichern
              </button>
              <button onClick={() => {
                setEditingInfo(false);
                setDraftName(displayName);
                setDraftDesc(displayDesc ?? "");
                setDraftMinPlayers(customFields.min_players?.toString() ?? "");
                setDraftMaxPlayers(customFields.max_players?.toString() ?? "");
                setDraftMinPlaytime(customFields.min_playtime?.toString() ?? "");
                setDraftMaxPlaytime(customFields.max_playtime?.toString() ?? "");
                setDraftCategories(customFields.categories?.join(", ") ?? "");
              }} className="px-3 py-2 rounded-xl bg-muted text-sm font-medium">
                Abbrechen
              </button>
            </div>
            {(customFields.name || customFields.description) && (
              <p className="text-[11px] text-amber-600">Eigene Angaben aktiv — BGG-Daten werden beim Import nicht überschrieben.</p>
            )}
          </div>
        ) : (
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground leading-tight">{displayName}</h1>
              {game.year_published && <p className="text-muted-foreground text-sm mt-0.5">{game.year_published}</p>}
              {customFields.name && <p className="text-[11px] text-amber-600 mt-0.5">Eigener Name</p>}
            </div>
            {userGame && (
              <button onClick={() => setEditingInfo(true)} className="mt-1 w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground flex-shrink-0">
                <Edit2 size={13} />
              </button>
            )}
          </div>
        )}

        {/* Status */}
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
                        status === opt.value ? "bg-amber-500 text-white" : "bg-muted text-foreground hover:bg-muted/80"
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button onClick={() => setEditingStatus(false)} className="self-start text-xs text-muted-foreground flex items-center gap-1">
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

        {/* Rating Section */}
        {userGame && (
          <div className="flex flex-col gap-2 bg-muted/30 rounded-xl px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eigene Wertung</span>
              {personalRating && (
                <button onClick={() => handleRatingClick(personalRating)} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                  Löschen
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <button
                  key={n}
                  onClick={() => handleRatingClick(n)}
                  className={cn(
                    "w-7 h-7 rounded-lg text-xs font-bold transition-all",
                    personalRating === n
                      ? "bg-amber-500 text-white shadow-sm"
                      : personalRating && n <= personalRating
                      ? "bg-amber-200 text-amber-800"
                      : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
            {game.rating_avg != null && (
              <div className="flex items-center gap-1.5 mt-1">
                <Star size={12} className="text-muted-foreground" strokeWidth={1.5} />
                <span className="text-xs text-muted-foreground">BGG-Wertung: <span className="font-medium">{game.rating_avg.toFixed(1)}</span></span>
              </div>
            )}
          </div>
        )}

        {/* Meta */}
        {hasMeta && (
          <div className="flex flex-wrap gap-2">
            {(effMinPlayers || effMaxPlayers) && (
              <div className="relative">
                <Stat icon={<Users size={14} />} label={formatPlayers(effMinPlayers ?? null, effMaxPlayers ?? null)} />
                {(customFields.min_players != null || customFields.max_players != null) && (
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-amber-400 text-white rounded-full px-1 font-bold leading-4">!</span>
                )}
              </div>
            )}
            {(effMinPlaytime || effMaxPlaytime) && (
              <div className="relative">
                <Stat icon={<Clock size={14} />} label={formatTime(effMinPlaytime ?? null, effMaxPlaytime ?? null)} />
                {(customFields.min_playtime != null || customFields.max_playtime != null) && (
                  <span className="absolute -top-1.5 -right-1.5 text-[8px] bg-amber-400 text-white rounded-full px-1 font-bold leading-4">!</span>
                )}
              </div>
            )}
            {game.complexity != null && (
              <Stat icon={<Star size={14} />} label={`${game.complexity.toFixed(1)} / 5`} sublabel="Komplexität" />
            )}
          </div>
        )}

        {/* Description */}
        {displayDesc && (
          <div className="relative">
            <ExpandableDescription text={displayDesc} />
            {customFields.description && <p className="text-[11px] text-amber-600 mt-1">Eigene Beschreibung</p>}
          </div>
        )}

        {/* Categories + Mechanics */}
        {(categories.length > 0 || mechanics.length > 0) && (
          <section className="flex flex-col gap-3">
            {categories.length > 0 && (
              <TagRow label="Kategorien" tags={categories} color="amber" hasCustom={!!customFields.categories} />
            )}
            {mechanics.length > 0 && (
              <TagRow label="Mechanismen" tags={mechanics.slice(0, 10)} color="slate" />
            )}
          </section>
        )}

        {/* Designers */}
        {game.designers && game.designers.length > 0 && (
          <section>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Designer</p>
            <p className="text-sm text-foreground">{game.designers.join(", ")}</p>
          </section>
        )}

        {/* ── Eigene Bilder ─────────────────────────────────────────────────── */}
        <OwnImagesSection gameId={game.id} images={images} setImages={setImages} />

        {/* ── Hausregeln ────────────────────────────────────────────────────── */}
        <NoteSection
          gameId={game.id}
          noteType="house_rules"
          title="Hausregeln"
          icon={<BookOpen size={15} />}
          placeholder="Eigene Regeländerungen, Varianten oder Hausregeln notieren…"
          notes={notes.filter((n) => n.note_type === "house_rules")}
          setNotes={setNotes}
        />

        {/* ── Notizen ───────────────────────────────────────────────────────── */}
        <NoteSection
          gameId={game.id}
          noteType="general"
          title="Notizen"
          icon={<FileText size={15} />}
          placeholder="Strategie-Hinweise, Links, Erinnerungen…"
          notes={notes.filter((n) => n.note_type === "general")}
          setNotes={setNotes}
        />

        {/* ── Mit wem gespielt ──────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={<Users size={15} />} title="Mit wem gespielt" />
          <div className="mt-2">
            {playCount === 0 ? (
              <div className="bg-muted/40 rounded-xl px-4 py-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Wird automatisch aus deinen erfassten Partien befüllt.
                </p>
                <Link href="/plays" className="text-xs text-amber-600 font-medium mt-1 inline-block">
                  Partie erfassen →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground font-medium">
                  {playCount} {playCount === 1 ? "Partie" : "Partien"} gespielt
                  {allPlayerNames.length > 0 && (
                    <span className="text-muted-foreground font-normal"> · {allPlayerNames.join(", ")}</span>
                  )}
                </p>
                <div className="flex flex-col gap-1.5">
                  {recentPlays.map((play) => {
                    const dateStr = new Date(play.played_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
                    const playerNames = play.players?.map((p) => p.display_name).join(", ");
                    return (
                      <div key={play.id} className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-2">
                        <span className="text-xs text-muted-foreground">{dateStr}</span>
                        {playerNames && (
                          <span className="text-xs text-foreground truncate flex-1">{playerNames}</span>
                        )}
                        {play.duration_minutes && (
                          <span className="text-xs text-muted-foreground flex-shrink-0">{play.duration_minutes} Min</span>
                        )}
                      </div>
                    );
                  })}
                </div>
                <Link href="/plays" className="text-xs text-amber-600 font-medium mt-1 inline-block">
                  Alle Partien ansehen →
                </Link>
              </div>
            )}
          </div>
        </section>

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

        {/* Delete */}
        {userGame && (
          <div className="mt-2 pt-4 border-t border-border">
            {deleteConfirm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground font-medium">
                  &quot;{game.name}&quot; wirklich entfernen?
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-500 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    {deleting ? <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg> : <Check size={14} />}
                    Ja, entfernen
                  </button>
                  <button onClick={() => setDeleteConfirm(false)} className="px-4 py-2 rounded-xl bg-muted text-foreground text-sm font-medium">
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
      </div>
    </div>
  );
}

// ── Own Images Section ────────────────────────────────────────────────────────

function OwnImagesSection({
  gameId, images, setImages,
}: {
  gameId: string;
  images: UserGameImage[];
  setImages: React.Dispatch<React.SetStateAction<UserGameImage[]>>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compressImage(file: File): Promise<Blob> {
    return new Promise((resolve) => {
      const img = document.createElement("img");
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const MAX = 1200;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          const ratio = Math.min(MAX / width, MAX / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        URL.revokeObjectURL(url);
        canvas.toBlob((blob) => resolve(blob ?? file), "image/jpeg", 0.85);
      };
      img.src = url;
    });
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const compressed = await compressImage(file);
      const form = new FormData();
      form.append("file", compressed, `${Date.now()}.jpg`);
      form.append("game_id", gameId);
      const res = await fetch("/api/game-images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Upload fehlgeschlagen"); return; }
      setImages((prev) => [...prev, data]);
    } catch {
      setError("Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDelete(id: string) {
    await fetch(`/api/game-images/${id}`, { method: "DELETE" });
    setImages((prev) => prev.filter((i) => i.id !== id));
  }

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const imageUrls = images.map((img) => img.url);

  return (
    <section>
      <SectionHeader icon={<Camera size={15} />} title="Eigene Bilder" />
      <div className="mt-2 flex flex-col gap-2">
        {images.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {images.map((img, i) => (
              <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted group">
                <button
                  className="absolute inset-0 w-full h-full"
                  onClick={() => setLightboxIndex(i)}
                  aria-label={`Bild ${i + 1} vergrößern`}
                >
                  <Image src={img.url} alt={img.label ?? "Spielbild"} fill className="object-cover" sizes="33vw" />
                </button>
                <button
                  onClick={() => handleDelete(img.id)}
                  className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                  aria-label="Bild löschen"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        {lightboxIndex !== null && (
          <ImageLightbox
            images={imageUrls}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
          />
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <input ref={fileRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-amber-400 hover:bg-amber-50 transition-all text-sm text-muted-foreground hover:text-amber-700 disabled:opacity-50 self-start"
        >
          {uploading ? (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          ) : (
            <Plus size={14} />
          )}
          {uploading ? "Wird hochgeladen…" : "Bild hinzufügen"}
        </button>
        <p className="text-[11px] text-muted-foreground/70">Bilder werden vor dem Upload auf max. 1200 px komprimiert (JPEG 85%).</p>
      </div>
    </section>
  );
}

// ── Note Section ──────────────────────────────────────────────────────────────

function NoteSection({
  gameId, noteType, title, icon, placeholder, notes, setNotes,
}: {
  gameId: string;
  noteType: NoteType;
  title: string;
  icon: React.ReactNode;
  placeholder: string;
  notes: GameNote[];
  setNotes: React.Dispatch<React.SetStateAction<GameNote[]>>;
}) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftContent, setDraftContent] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!draftContent.trim()) { setAdding(false); return; }
    setSaving(true);
    const res = await fetch("/api/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id: gameId, note_type: noteType, title: "", content: draftContent.trim() }),
    });
    const data = await res.json();
    if (res.ok) {
      setNotes((prev) => [data, ...prev]);
      setDraftContent("");
      setAdding(false);
    }
    setSaving(false);
  }

  async function handleUpdate(id: string, content: string) {
    setSaving(true);
    const res = await fetch(`/api/notes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const data = await res.json();
    if (res.ok) {
      setNotes((prev) => prev.map((n) => (n.id === id ? data : n)));
      setEditingId(null);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    await fetch(`/api/notes/${id}`, { method: "DELETE" });
    setNotes((prev) => prev.filter((n) => n.id !== id));
  }

  return (
    <section>
      <div className="flex items-center justify-between">
        <SectionHeader icon={icon} title={title} />
        {!adding && (
          <button
            onClick={() => { setAdding(true); setDraftContent(""); }}
            className="text-xs text-amber-600 font-medium flex items-center gap-1"
          >
            <Plus size={12} /> Hinzufügen
          </button>
        )}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        {adding && (
          <NoteEditor
            value={draftContent}
            onChange={setDraftContent}
            placeholder={placeholder}
            onSave={handleCreate}
            onCancel={() => setAdding(false)}
            saving={saving}
          />
        )}
        {notes.map((note) => (
          editingId === note.id ? (
            <NoteEditor
              key={note.id}
              value={draftContent}
              onChange={setDraftContent}
              placeholder={placeholder}
              onSave={() => handleUpdate(note.id, draftContent)}
              onCancel={() => setEditingId(null)}
              saving={saving}
            />
          ) : (
            <NoteCard
              key={note.id}
              note={note}
              onEdit={() => { setEditingId(note.id); setDraftContent(note.content ?? ""); }}
              onDelete={() => handleDelete(note.id)}
            />
          )
        ))}
        {notes.length === 0 && !adding && (
          <p className="text-sm text-muted-foreground bg-muted/30 rounded-xl px-4 py-3">
            Noch keine {title}. Tippe auf &quot;Hinzufügen&quot;.
          </p>
        )}
      </div>
    </section>
  );
}

function NoteEditor({ value, onChange, placeholder, onSave, onCancel, saving }: {
  value: string; onChange: (v: string) => void; placeholder: string;
  onSave: () => void; onCancel: () => void; saving: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return (
    <div className="flex flex-col gap-2 bg-muted/30 rounded-xl p-3">
      <textarea
        ref={ref}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={4}
        className="w-full text-sm bg-transparent resize-none focus:outline-none text-foreground placeholder:text-muted-foreground"
      />
      <div className="flex gap-2">
        <button
          onClick={onSave}
          disabled={saving || !value.trim()}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-semibold disabled:opacity-50"
        >
          <Check size={12} /> Speichern
        </button>
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg bg-muted text-xs font-medium">
          Abbrechen
        </button>
      </div>
    </div>
  );
}

function NoteCard({ note, onEdit, onDelete }: { note: GameNote; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="bg-muted/30 rounded-xl px-4 py-3 group">
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
      <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
          <Edit2 size={11} /> Bearbeiten
        </button>
        <button onClick={onDelete} className="text-xs text-muted-foreground hover:text-red-500 flex items-center gap-1">
          <Trash2 size={11} /> Löschen
        </button>
      </div>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </div>
  );
}

function TagRow({ label, tags, color, hasCustom }: { label: string; tags: string[]; color: "amber" | "slate"; hasCustom?: boolean }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {hasCustom && <span className="text-[10px] text-amber-600 font-medium">(eigene Angabe)</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {tags.map((t) => (
          <span
            key={t}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full font-medium",
              color === "amber" ? "bg-amber-50 text-amber-800" : "bg-slate-100 text-slate-700"
            )}
          >
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

function ExpandableDescription({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = text.length > 300;
  return (
    <section>
      <h2 className="text-sm font-semibold text-foreground mb-2">Beschreibung</h2>
      <p className={cn("text-sm text-muted-foreground leading-relaxed", !expanded && isLong && "line-clamp-4")}>
        {text}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 text-xs text-amber-600 font-medium mt-1"
        >
          {expanded ? <><ChevronUp size={12} /> Weniger</> : <><ChevronDown size={12} /> Mehr lesen</>}
        </button>
      )}
    </section>
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
    <div className="w-full h-full flex items-center justify-center" style={{ background: `hsl(${hue} 35% 35%)` }}>
      <span className="font-display font-bold text-white/20 text-8xl select-none">{name[0]?.toUpperCase()}</span>
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
