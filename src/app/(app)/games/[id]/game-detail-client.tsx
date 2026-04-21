"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowLeft, Users, Clock, Star, ExternalLink, Trash2,
  Edit2, Check, X, Plus, Camera, FileText, BookOpen,
  ChevronDown, ChevronUp, RefreshCw, Paintbrush, PlayCircle, Music2, Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { translateCategories, translateMechanics } from "@/lib/bgg-translations";
import { useLibraryStore } from "@/stores/library-store";
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
  const [draftYoutubeUrl, setDraftYoutubeUrl] = useState(customFields.youtube_url ?? "");
  const [draftSpotifyUrl, setDraftSpotifyUrl] = useState(customFields.spotify_url ?? "");
  const [savingInfo, setSavingInfo] = useState(false);
  // Purchase price
  const [pricePaid, setPricePaid] = useState<string>(userGame?.price_paid?.toString() ?? "");
  const [savedPrice, setSavedPrice] = useState<string>(userGame?.price_paid?.toString() ?? "");
  const [savingPrice, setSavingPrice] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<"idle" | "ok" | "error">("idle");
  const [refreshLabel, setRefreshLabel] = useState("BGG aktualisieren");
  const [gameData, setGameData] = useState(game);

  async function handleRefreshBGG() {
    setRefreshing(true);
    setRefreshStatus("idle");
    try {
      const res = await fetch(`/api/games/${game.id}/refresh`, { method: "POST" });
      const data = await res.json() as {
        success?: boolean;
        error?: string;
        updated?: string[];
        complexity?: number | null;
        publishers?: string[];
        best_players?: number[] | null;
        alternate_names?: string[];
        thumbnail_url?: string | null;
      };
      if (res.ok && data.success) {
        setGameData((prev) => ({
          ...prev,
          ...(data.complexity != null ? { complexity: data.complexity } : {}),
          ...(data.publishers != null && data.publishers.length > 0 ? { publishers: data.publishers } : {}),
          ...(data.best_players != null ? { best_players: data.best_players } : {}),
          ...(data.alternate_names != null && data.alternate_names.length > 0 ? { alternate_names: data.alternate_names } : {}),
          ...(data.thumbnail_url ? { thumbnail_url: data.thumbnail_url, image_url: data.thumbnail_url } : {}),
        }));
        const LABELS: Record<string, string> = { complexity: "Komplexität", publishers: "Verlag", best_players: "Best", alternate_names: "Alternativnamen", thumbnail_url: "Bild" };
        const updated = (data.updated ?? []) as string[];
        const msg = updated.length > 0
          ? updated.map((k) => LABELS[k] ?? k).join(", ") + " ✓"
          : "Keine neuen BGG-Daten ✓";
        setRefreshLabel(msg);
        setRefreshStatus("ok");
        setTimeout(() => { setRefreshStatus("idle"); setRefreshLabel("BGG aktualisieren"); }, 4000);
      } else {
        console.error("[refresh]", data.error);
        setRefreshLabel("Fehler – nochmal?");
        setRefreshStatus("error");
        setTimeout(() => { setRefreshStatus("idle"); setRefreshLabel("BGG aktualisieren"); }, 4000);
      }
    } catch {
      setRefreshStatus("error");
      setTimeout(() => setRefreshStatus("idle"), 4000);
    } finally {
      setRefreshing(false);
    }
  }

  async function handleToggleCustomized() {
    if (!userGame) return;
    const newVal = !customFields.customized;
    const newCustom = { ...customFields };
    if (newVal) newCustom.customized = true;
    else delete newCustom.customized;
    setCustomFields(newCustom);
    await fetch(`/api/user-games/${userGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields: Object.keys(newCustom).length > 0 ? newCustom : null }),
    });
  }

  async function handleSetHeroImage(url: string | null) {
    if (!userGame) return;
    const newCustom = { ...customFields };
    if (url) newCustom.hero_image_url = url;
    else delete newCustom.hero_image_url;
    setCustomFields(newCustom);
    await fetch(`/api/user-games/${userGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields: Object.keys(newCustom).length > 0 ? newCustom : null }),
    });
  }

  const displayName = customFields.name ?? gameData.name;
  const displayDesc = customFields.description ?? gameData.description_de ?? gameData.description;

  // Effective player/playtime values (custom overrides BGG)
  const effMinPlayers = customFields.min_players ?? gameData.min_players;
  const effMaxPlayers = customFields.max_players ?? gameData.max_players;
  const effMinPlaytime = customFields.min_playtime ?? gameData.min_playtime;
  const effMaxPlaytime = customFields.max_playtime ?? gameData.max_playtime;

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

    // YouTube URL
    if (draftYoutubeUrl.trim()) {
      newCustom.youtube_url = draftYoutubeUrl.trim();
    } else {
      delete newCustom.youtube_url;
    }

    // Spotify URL
    if (draftSpotifyUrl.trim()) {
      newCustom.spotify_url = draftSpotifyUrl.trim();
    } else {
      delete newCustom.spotify_url;
    }

    await fetch(`/api/user-games/${userGame.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ custom_fields: Object.keys(newCustom).length > 0 ? newCustom : null }),
    });
    setCustomFields(newCustom);
    setEditingInfo(false);
    setSavingInfo(false);
  }

  const { tagLang, setTagLang } = useLibraryStore();

  // Raw BGG values (English strings)
  const rawCategories = gameData.categories ?? [];
  const rawMechanics = gameData.mechanics ?? [];

  // Language-aware display values (custom categories always shown as-is)
  const categories = customFields.categories
    ? customFields.categories
    : tagLang === "de" ? translateCategories(rawCategories) : rawCategories;
  const mechanics = tagLang === "de" ? translateMechanics(rawMechanics) : rawMechanics;

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

  const hasMeta = effMinPlayers || effMaxPlayers || effMinPlaytime || effMaxPlaytime || gameData.complexity != null;

  // Plays summary data
  const playCount = initialPlays.length;
  const allPlayerNames = Array.from(
    new Set(initialPlays.flatMap((p) => p.players?.map((pl) => pl.display_name) ?? []))
  );
  const recentPlays = initialPlays.slice(0, 3);

  return (
    <div className="flex flex-col min-h-dvh bg-background">
      {/* ── Hero with title overlay ─────────────────────────────────────────── */}
      <div className="relative w-full bg-muted overflow-hidden" style={{ aspectRatio: "4/3", maxHeight: "60vw" }}>
        {(() => {
          const heroSrc = customFields.hero_image_url ?? gameData.image_url ?? gameData.thumbnail_url;
          return heroSrc ? (
            <Image
              src={heroSrc}
              alt={gameData.name}
              fill
              className="object-cover"
              sizes="100vw"
              priority
            />
          ) : (
            <PlaceholderHero name={game.name} />
          );
        })()}
        {/* Gradient scrim — bottom 60% */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-transparent" />

        {/* Back button */}
        <button
          onClick={() => router.back()}
          className="absolute top-4 left-4 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow-md text-white"
          aria-label="Zurück"
        >
          <ArrowLeft size={18} />
        </button>

        {/* Edit button (top-right) */}
        {userGame && !editingInfo && (
          <button
            onClick={() => setEditingInfo(true)}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/30 backdrop-blur-sm flex items-center justify-center shadow-md text-white"
            aria-label="Bearbeiten"
          >
            <Edit2 size={14} />
          </button>
        )}

        {/* Title at bottom of hero */}
        {!editingInfo && (
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-4 pt-8">
            <h1 className="font-display text-xl font-bold text-white leading-tight drop-shadow-sm">
              {displayName}
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {gameData.year_published && (
                <span className="text-white/65 text-sm">{gameData.year_published}</span>
              )}
              {customFields.name && (
                <span className="text-amber-300 text-xs font-medium">Eigener Name</span>
              )}
              {customFields.hero_image_url && (
                <span className="flex items-center gap-1 text-violet-300 text-xs font-medium">
                  <Crown size={11} /> Eigenes Titelbild
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-4 px-4 pb-12 pt-4 relative z-10">

        {/* ── Edit form (inline, shown below hero when active) ──────────────── */}
        {editingInfo && (
          <div className="flex flex-col gap-3 bg-muted/30 rounded-2xl p-4">
            <h2 className="text-sm font-semibold text-foreground">Infos bearbeiten</h2>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Name</label>
              <input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                className="w-full text-base font-semibold bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
              {/* Alternate name picker */}
              <div className="mt-2">
                <p className="text-[11px] text-muted-foreground mb-1.5">Schnellauswahl:</p>
                <div className="flex flex-wrap gap-1.5">
                  {/* Original BGG name always shown first */}
                  <button
                    type="button"
                    onClick={() => setDraftName(game.name)}
                    className={cn(
                      "px-2.5 py-1 text-xs rounded-full border transition-colors font-medium",
                      draftName === game.name
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-background text-foreground border-border hover:border-amber-400 hover:bg-amber-50"
                    )}
                  >
                    {game.name}
                  </button>
                  {/* Alternate names from BGG */}
                  {(gameData.alternate_names ?? []).map((altName) => (
                    <button
                      key={altName}
                      type="button"
                      onClick={() => setDraftName(altName)}
                      className={cn(
                        "px-2.5 py-1 text-xs rounded-full border transition-colors font-medium",
                        draftName === altName
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-background text-foreground border-border hover:border-amber-400 hover:bg-amber-50"
                      )}
                    >
                      {altName}
                    </button>
                  ))}
                  {/* Hint when no alternate names loaded yet */}
                  {!gameData.alternate_names?.length && (
                    <span className="text-[11px] text-muted-foreground/70 self-center">
                      Keine Alternativnamen — klicke auf &ldquo;BGG aktualisieren&rdquo;
                    </span>
                  )}
                </div>
              </div>
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
                <input type="number" value={draftMinPlayers} onChange={(e) => setDraftMinPlayers(e.target.value)} placeholder={game.min_players?.toString() ?? "–"} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spieler Max</label>
                <input type="number" value={draftMaxPlayers} onChange={(e) => setDraftMaxPlayers(e.target.value)} placeholder={game.max_players?.toString() ?? "–"} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spielzeit Min</label>
                <input type="number" value={draftMinPlaytime} onChange={(e) => setDraftMinPlaytime(e.target.value)} placeholder={game.min_playtime?.toString() ?? "–"} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Spielzeit Max</label>
                <input type="number" value={draftMaxPlaytime} onChange={(e) => setDraftMaxPlaytime(e.target.value)} placeholder={game.max_playtime?.toString() ?? "–"} className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block">Kategorien (kommagetrennt)</label>
              <input value={draftCategories} onChange={(e) => setDraftCategories(e.target.value)} placeholder="z.B. Strategie, Familienspiel" className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block flex items-center gap-1.5">
                <PlayCircle size={12} className="text-red-500" /> YouTube Tutorial
              </label>
              <input
                type="url"
                value={draftYoutubeUrl}
                onChange={(e) => setDraftYoutubeUrl(e.target.value)}
                placeholder="https://youtube.com/watch?v=…"
                className="w-full text-sm bg-background border border-border rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1 block flex items-center gap-1.5">
                <Music2 size={12} className="text-green-500" /> Spotify Playlist
              </label>
              <input
                type="url"
                value={draftSpotifyUrl}
                onChange={(e) => setDraftSpotifyUrl(e.target.value)}
                placeholder="https://open.spotify.com/playlist/…"
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
                setDraftYoutubeUrl(customFields.youtube_url ?? "");
                setDraftSpotifyUrl(customFields.spotify_url ?? "");
              }} className="px-3 py-2 rounded-xl bg-muted text-sm font-medium">
                Abbrechen
              </button>
            </div>
            {/* Hero image info — shown inside edit form */}
            {customFields.hero_image_url && (
              <div className="flex items-center gap-3 p-3 bg-violet-50 border border-violet-200 rounded-xl">
                <div className="relative w-12 h-12 rounded-lg overflow-hidden flex-shrink-0">
                  <Image src={customFields.hero_image_url} alt="Aktuelles Titelbild" fill className="object-cover" sizes="48px" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-violet-800">Eigenes Titelbild aktiv</p>
                  <p className="text-[11px] text-violet-600">Das Bild oben kommt aus deinen eigenen Fotos.</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSetHeroImage(null)}
                  className="text-xs text-violet-600 font-medium px-2.5 py-1.5 rounded-lg hover:bg-violet-100 transition-colors flex-shrink-0"
                >
                  Zurücksetzen
                </button>
              </div>
            )}
            {(customFields.name || customFields.description) && (
              <p className="text-[11px] text-amber-600">Eigene Angaben aktiv — BGG-Daten werden beim Import nicht überschrieben.</p>
            )}
          </div>
        )}

        {/* ── Description + links directly under hero ──────────────────────── */}
        {displayDesc && (
          <div>
            <ExpandableDescription text={displayDesc} />
            {customFields.description && <p className="text-[11px] text-amber-600 mt-1">Eigene Beschreibung</p>}
          </div>
        )}
        {(customFields.youtube_url || customFields.spotify_url) && (
          <div className="flex flex-col gap-2">
            {customFields.youtube_url && (
              <a href={customFields.youtube_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-2xl shadow-sm active:bg-red-50/50 transition-all">
                <div className="w-9 h-9 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
                  <PlayCircle size={18} className="text-red-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Tutorial ansehen</p>
                  <p className="text-[11px] text-muted-foreground truncate">{customFields.youtube_url}</p>
                </div>
                <ExternalLink size={14} className="text-muted-foreground flex-shrink-0" />
              </a>
            )}
            {customFields.spotify_url && (
              <a href={customFields.spotify_url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-4 py-3 bg-card border border-border rounded-2xl shadow-sm active:bg-green-50/50 transition-all">
                <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                  <Music2 size={18} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">Playlist öffnen</p>
                  <p className="text-[11px] text-muted-foreground truncate">{customFields.spotify_url}</p>
                </div>
                <ExternalLink size={14} className="text-muted-foreground flex-shrink-0" />
              </a>
            )}
          </div>
        )}

        {/* ── Overview card: status + inline meta ──────────────────────────── */}
        {userGame && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {editingStatus ? (
              <div className="px-4 py-3 flex flex-col gap-2">
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
              <div className="px-4 py-3 flex flex-col gap-2">
                {/* Status badge + edit button */}
                <div className="flex items-center">
                  <span className={cn("px-3 py-1 rounded-full text-sm font-medium", STATUS_COLORS[status])}>
                    {STATUS_OPTIONS.find((o) => o.value === status)?.label}
                  </span>
                  <button
                    onClick={() => setEditingStatus(true)}
                    className="ml-auto w-7 h-7 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                    aria-label="Status ändern"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                {/* Inline meta stats — no chip boxes, just icon + text */}
                {hasMeta && (
                  <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                    {(effMinPlayers || effMaxPlayers) && (() => {
                      const bestArr = customFields.best_players_override?.length
                        ? customFields.best_players_override
                        : (gameData.best_players?.length ? gameData.best_players : null);
                      return (
                        <div className="flex items-center gap-1.5 text-sm text-foreground">
                          <Users size={13} className="text-muted-foreground flex-shrink-0" />
                          <span>{formatPlayers(effMinPlayers ?? null, effMaxPlayers ?? null)}</span>
                          {bestArr && <span className="text-xs text-muted-foreground">· Best {bestArr.join(", ")}</span>}
                          {(customFields.min_players != null || customFields.max_players != null) && (
                            <span className="text-[8px] bg-amber-400 text-white rounded-full px-1 font-bold leading-4">!</span>
                          )}
                        </div>
                      );
                    })()}
                    {(effMinPlaytime || effMaxPlaytime) && (
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Clock size={13} className="text-muted-foreground flex-shrink-0" />
                        <span>{formatTime(effMinPlaytime ?? null, effMaxPlaytime ?? null)}</span>
                        {(customFields.min_playtime != null || customFields.max_playtime != null) && (
                          <span className="text-[8px] bg-amber-400 text-white rounded-full px-1 font-bold leading-4">!</span>
                        )}
                      </div>
                    )}
                    {gameData.complexity != null && (
                      <div className="flex items-center gap-1.5 text-sm text-foreground">
                        <Star size={13} className="text-muted-foreground flex-shrink-0" />
                        <span>{gameData.complexity.toFixed(1)}<span className="text-xs text-muted-foreground"> / 5</span></span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Meta for non-library games */}
        {!userGame && hasMeta && (
          <div className="flex items-center gap-x-4 gap-y-1 flex-wrap px-1">
            {(effMinPlayers || effMaxPlayers) && (
              <div className="flex items-center gap-1.5 text-sm text-foreground">
                <Users size={13} className="text-muted-foreground" />
                {formatPlayers(effMinPlayers ?? null, effMaxPlayers ?? null)}
              </div>
            )}
            {(effMinPlaytime || effMaxPlaytime) && (
              <div className="flex items-center gap-1.5 text-sm text-foreground">
                <Clock size={13} className="text-muted-foreground" />
                {formatTime(effMinPlaytime ?? null, effMaxPlaytime ?? null)}
              </div>
            )}
            {gameData.complexity != null && (
              <div className="flex items-center gap-1.5 text-sm text-foreground">
                <Star size={13} className="text-muted-foreground" />
                {gameData.complexity.toFixed(1)}<span className="text-xs text-muted-foreground"> / 5</span>
              </div>
            )}
          </div>
        )}

        {/* ── Personal card: rating + best players + price ──────────────────── */}
        {userGame && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {/* Rating */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between mb-2.5">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Eigene Wertung</span>
                {personalRating && (
                  <button onClick={() => handleRatingClick(personalRating)} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                    Löschen
                  </button>
                )}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    onClick={() => handleRatingClick(n)}
                    className={cn(
                      "w-7 h-7 rounded-lg text-xs font-bold transition-all flex-shrink-0",
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
              {gameData.rating_avg != null && (
                <div className="flex items-center gap-1.5 mt-2.5">
                  <Star size={11} className="text-amber-400" strokeWidth={2} />
                  <span className="text-xs text-muted-foreground">BGG: <span className="font-medium text-foreground">{gameData.rating_avg.toFixed(1)}</span></span>
                </div>
              )}
            </div>

            {/* Best-players override */}
            <div className="px-4 py-3 border-b border-border">
              <BestPlayersOverride
                value={customFields.best_players_override ?? []}
                onChange={async (newVal) => {
                  const newCustom = { ...customFields };
                  if (newVal.length > 0) newCustom.best_players_override = newVal;
                  else delete newCustom.best_players_override;
                  await fetch(`/api/user-games/${userGame.id}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ custom_fields: Object.keys(newCustom).length > 0 ? newCustom : null }),
                  });
                  setCustomFields(newCustom);
                }}
              />
            </div>

            {/* Customized toggle */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Paintbrush size={14} className={customFields.customized ? "text-violet-500" : "text-muted-foreground"} />
                <span className="text-sm text-foreground">Individualisiert</span>
                {customFields.customized && (
                  <span className="text-[10px] text-violet-500 font-medium bg-violet-50 px-1.5 py-0.5 rounded-full">aktiv</span>
                )}
              </div>
              <button
                onClick={handleToggleCustomized}
                className={cn(
                  "relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0",
                  customFields.customized ? "bg-violet-500" : "bg-muted"
                )}
                aria-label="Individualisiert umschalten"
              >
                <span
                  className={cn(
                    "inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform",
                    customFields.customized ? "translate-x-5" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            {/* Purchase price */}
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm text-muted-foreground">Kaufpreis</span>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">€</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="–"
                  value={pricePaid}
                  onChange={(e) => setPricePaid(e.target.value)}
                  onKeyDown={async (e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                      if (!userGame || pricePaid === savedPrice) return;
                      setSavingPrice(true);
                      const val = pricePaid !== "" ? parseFloat(pricePaid) : null;
                      await fetch(`/api/user-games/${userGame.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ price_paid: val }),
                      });
                      setSavedPrice(pricePaid);
                      setSavingPrice(false);
                    }
                  }}
                  className="w-20 text-sm text-right bg-transparent border-b border-border focus:border-amber-400 focus:outline-none transition-colors py-0.5 tabular-nums"
                />
                {savingPrice ? (
                  <span className="text-[10px] text-amber-500 w-6 text-center">…</span>
                ) : pricePaid !== savedPrice ? (
                  <button
                    onClick={async () => {
                      if (!userGame) return;
                      setSavingPrice(true);
                      const val = pricePaid !== "" ? parseFloat(pricePaid) : null;
                      await fetch(`/api/user-games/${userGame.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ price_paid: val }),
                      });
                      setSavedPrice(pricePaid);
                      setSavingPrice(false);
                    }}
                    className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center flex-shrink-0 transition-all"
                    aria-label="Preis speichern"
                  >
                    <Check size={12} strokeWidth={2.5} />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {/* ── Spielinfos: Categories + Designer + Publisher ─────────────────── */}
        {(categories.length > 0 || mechanics.length > 0 || (gameData.designers?.length ?? 0) > 0 || (gameData.publishers?.length ?? 0) > 0) && (
          <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
            {/* Categories + Mechanics */}
            {(categories.length > 0 || mechanics.length > 0) && (
              <div className={cn("px-4 py-4", (gameData.designers?.length || gameData.publishers?.length) && "border-b border-border")}>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-foreground">Kategorien & Mechanismen</h2>
                  {!customFields.categories && (rawCategories.length > 0 || rawMechanics.length > 0) && (
                    <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                      <button
                        onClick={() => setTagLang("de")}
                        className={cn("text-xs font-semibold px-2.5 py-1 rounded-md transition-all", tagLang === "de" ? "bg-white shadow-sm text-amber-600" : "text-muted-foreground")}
                      >DE</button>
                      <button
                        onClick={() => setTagLang("en")}
                        className={cn("text-xs font-semibold px-2.5 py-1 rounded-md transition-all", tagLang === "en" ? "bg-white shadow-sm text-amber-600" : "text-muted-foreground")}
                      >EN</button>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3">
                  {categories.length > 0 && <TagRow label="Kategorien" tags={categories} color="amber" hasCustom={!!customFields.categories} />}
                  {mechanics.length > 0 && <TagRow label="Mechanismen" tags={mechanics} color="slate" />}
                </div>
              </div>
            )}
            {/* Designer row */}
            {gameData.designers && gameData.designers.length > 0 && (
              <div className={cn("flex items-start gap-3 px-4 py-3", gameData.publishers?.length && "border-b border-border")}>
                <span className="text-xs text-muted-foreground w-14 pt-0.5 flex-shrink-0">Design</span>
                <span className="text-sm text-foreground leading-snug">{gameData.designers.join(", ")}</span>
              </div>
            )}
            {/* Publisher row */}
            {gameData.publishers && gameData.publishers.length > 0 && (
              <div className="flex items-start gap-3 px-4 py-3">
                <span className="text-xs text-muted-foreground w-14 pt-0.5 flex-shrink-0">Verlag</span>
                <span className="text-sm text-foreground leading-snug">{gameData.publishers.slice(0, 3).join(", ")}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Eigene Bilder ─────────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm px-4 py-4">
          <OwnImagesSection
            gameId={game.id}
            images={images}
            setImages={setImages}
            heroImageUrl={customFields.hero_image_url}
            onHeroChange={userGame ? handleSetHeroImage : undefined}
          />
        </div>

        {/* ── Hausregeln + Notizen (one card, two sections) ─────────────────── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <div className="px-4 py-4 border-b border-border">
            <NoteSection
              gameId={game.id}
              noteType="house_rules"
              title="Hausregeln"
              icon={<BookOpen size={15} />}
              placeholder="Eigene Regeländerungen, Varianten oder Hausregeln notieren…"
              notes={notes.filter((n) => n.note_type === "house_rules")}
              setNotes={setNotes}
            />
          </div>
          <div className="px-4 py-4">
            <NoteSection
              gameId={game.id}
              noteType="general"
              title="Notizen"
              icon={<FileText size={15} />}
              placeholder="Strategie-Hinweise, Links, Erinnerungen…"
              notes={notes.filter((n) => n.note_type === "general")}
              setNotes={setNotes}
            />
          </div>
        </div>

        {/* ── Mit wem gespielt ──────────────────────────────────────────────── */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm px-4 py-4">
          <SectionHeader icon={<Users size={15} />} title="Mit wem gespielt" />
          <div className="mt-3">
            {playCount === 0 ? (
              <div className="text-center py-2">
                <p className="text-sm text-muted-foreground">Wird aus erfassten Partien befüllt.</p>
                <Link href="/plays" className="text-xs text-amber-600 font-medium mt-1 inline-block">
                  Partie erfassen →
                </Link>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-foreground font-medium">
                  {playCount} {playCount === 1 ? "Partie" : "Partien"}
                  {allPlayerNames.length > 0 && (
                    <span className="text-muted-foreground font-normal"> · {allPlayerNames.join(", ")}</span>
                  )}
                </p>
                <div className="flex flex-col gap-1.5">
                  {recentPlays.map((play) => {
                    const dateStr = new Date(play.played_at).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
                    const playerNames = play.players?.map((p) => p.display_name).join(", ");
                    return (
                      <div key={play.id} className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
                        <span className="text-xs text-muted-foreground flex-shrink-0">{dateStr}</span>
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
                  Alle Partien →
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* ── BGG Link + Refresh ────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-1">
          <a
            href={`https://boardgamegeek.com/boardgame/${gameData.bgg_id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-sm text-amber-600 font-medium"
          >
            <ExternalLink size={14} />
            BoardGameGeek
          </a>
          {gameData.bgg_id && (
            <button
              onClick={handleRefreshBGG}
              disabled={refreshing}
              className={cn(
                "flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50",
                refreshStatus === "ok"    ? "text-emerald-600" :
                refreshStatus === "error" ? "text-red-500" :
                "text-muted-foreground"
              )}
              title="BGG-Daten aktualisieren"
            >
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Lädt…" : refreshLabel}
            </button>
          )}
        </div>

        {/* Delete */}
        {userGame && (
          <div className="mt-2 pt-4 border-t border-border">
            {deleteConfirm ? (
              <div className="flex flex-col gap-3">
                <p className="text-sm text-foreground font-medium">
                  &quot;{gameData.name}&quot; wirklich entfernen?
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
  gameId, images, setImages, heroImageUrl, onHeroChange,
}: {
  gameId: string;
  images: UserGameImage[];
  setImages: React.Dispatch<React.SetStateAction<UserGameImage[]>>;
  heroImageUrl?: string;
  onHeroChange?: (url: string | null) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingHero, setSettingHero] = useState(false);

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
          <>
            {onHeroChange && (
              <p className="text-[11px] text-muted-foreground">
                Krone antippen um ein Bild als Titelbild oben zu setzen.
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              {images.map((img, i) => {
                const isHero = img.url === heroImageUrl;
                return (
                  <div key={img.id} className="relative aspect-square rounded-xl overflow-hidden bg-muted">
                    {/* Tap to open lightbox — entire tile minus the crown button */}
                    <button
                      className="absolute inset-0 z-10"
                      onClick={() => setLightboxIndex(i)}
                      aria-label={`Bild ${i + 1} vergrößern`}
                    />
                    <Image src={img.url} alt={img.label ?? "Spielbild"} fill className="object-cover" sizes="33vw" />
                    {/* Crown button — always visible, top-right */}
                    {onHeroChange && (
                      <button
                        className={cn(
                          "absolute top-1.5 right-1.5 z-20 w-7 h-7 rounded-full flex items-center justify-center shadow-lg transition-colors disabled:opacity-50",
                          isHero
                            ? "bg-violet-500 text-white"
                            : "bg-black/40 text-white/70"
                        )}
                        onClick={async (e) => {
                          e.stopPropagation();
                          setSettingHero(true);
                          await onHeroChange(isHero ? null : img.url);
                          setSettingHero(false);
                        }}
                        disabled={settingHero}
                        aria-label={isHero ? "Titelbild zurücksetzen" : "Als Titelbild setzen"}
                      >
                        <Crown size={13} fill={isHero ? "currentColor" : "none"} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
        {lightboxIndex !== null && (
          <ImageLightbox
            images={imageUrls}
            currentIndex={lightboxIndex}
            onClose={() => setLightboxIndex(null)}
            onNavigate={setLightboxIndex}
            onDelete={(i) => handleDelete(images[i].id)}
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
        <p className="text-[10px] text-muted-foreground/50">max. 1200 px · JPEG 85 %</p>
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
        {/* Empty state omitted intentionally — the "+ Hinzufügen" button is sufficient */}
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
    <div className="bg-muted/30 rounded-xl px-4 py-3">
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note.content}</p>
      <div className="flex items-center gap-3 mt-2">
        <button onClick={onEdit} className="text-xs text-muted-foreground/60 active:text-foreground flex items-center gap-1">
          <Edit2 size={11} /> Bearbeiten
        </button>
        <button onClick={onDelete} className="text-xs text-muted-foreground/60 active:text-red-500 flex items-center gap-1">
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

function TagRow({ label, tags, color, hasCustom, cap = 8 }: { label: string; tags: string[]; color: "amber" | "slate"; hasCustom?: boolean; cap?: number }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? tags : tags.slice(0, cap);
  const hidden = tags.length - cap;

  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
        {hasCustom && <span className="text-[10px] text-amber-600 font-medium">(eigene Angabe)</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visible.map((t) => (
          <span
            key={t}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full font-medium",
              color === "amber" ? "bg-amber-50 text-amber-800 border border-amber-100" : "bg-slate-100 text-slate-700 border border-slate-200"
            )}
          >
            {t}
          </span>
        ))}
        {!expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(true)}
            className={cn(
              "px-2.5 py-1 text-xs rounded-full font-medium border transition-colors",
              color === "amber"
                ? "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100"
                : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
            )}
          >
            +{hidden} weitere
          </button>
        )}
        {expanded && hidden > 0 && (
          <button
            onClick={() => setExpanded(false)}
            className="px-2.5 py-1 text-xs rounded-full font-medium border border-border text-muted-foreground hover:bg-muted transition-colors"
          >
            Weniger
          </button>
        )}
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

// ── Best-Players Override (manual chip selector) ──────────────────────────────

function BestPlayersOverride({
  value,
  onChange,
}: {
  value: number[];
  onChange: (val: number[]) => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);

  async function toggle(n: number) {
    setSaving(true);
    const next = value.includes(n) ? value.filter((x) => x !== n) : [...value, n].sort((a, b) => a - b);
    await onChange(next);
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Optimale Spielerzahl</span>
        {value.length > 0 && (
          <button
            onClick={async () => { setSaving(true); await onChange([]); setSaving(false); }}
            disabled={saving}
            className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
          >
            Löschen
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
          <button
            key={n}
            onClick={() => toggle(n)}
            disabled={saving}
            className={cn(
              "w-8 h-8 rounded-lg text-xs font-bold transition-all disabled:opacity-50",
              value.includes(n)
                ? "bg-amber-500 text-white shadow-sm"
                : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
            )}
          >
            {n === 8 ? "8+" : n}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted-foreground">Deine persönliche Einschätzung (unabhängig von BGG)</p>
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
