"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Plus, X, Check, Trash2, Users, Clock, MapPin, ChevronDown, Edit2, SlidersHorizontal, Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface LibraryGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  bgg_id: number;
}

interface PlayPlayer {
  id: string;
  display_name: string;
  score: number | null;
  winner: boolean;
  color: string | null;
}

interface Play {
  id: string;
  game_id: string;
  played_at: string;
  duration_minutes: number | null;
  location: string | null;
  notes: string | null;
  cooperative: boolean;
  image_url?: string | null;
  game?: LibraryGame | null;
  players?: PlayPlayer[];
}

interface DraftPlayer {
  display_name: string;
  score: string;
  winner: boolean;
}

type PlaySortKey = "date_desc" | "date_asc" | "game_asc";

export function PlaysClient({
  initialPlays,
  libraryGames,
}: {
  initialPlays: Play[];
  libraryGames: LibraryGame[];
}) {
  const router = useRouter();
  const [plays, setPlays] = useState<Play[]>(initialPlays);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editPlay, setEditPlay] = useState<Play | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<PlaySortKey>("date_desc");
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [sortOpen]);

  const sortedPlays = [...plays].sort((a, b) => {
    switch (sortKey) {
      case "date_desc": return new Date(b.played_at).getTime() - new Date(a.played_at).getTime();
      case "date_asc": return new Date(a.played_at).getTime() - new Date(b.played_at).getTime();
      case "game_asc": return (a.game?.name ?? "").localeCompare(b.game?.name ?? "", "de");
      default: return 0;
    }
  });

  async function handleDelete(id: string) {
    await fetch(`/api/plays/${id}`, { method: "DELETE" });
    setPlays((prev) => prev.filter((p) => p.id !== id));
    setDeleteId(null);
  }

  function handleCreated(play: Play) {
    setPlays((prev) => [play, ...prev]);
    setSheetOpen(false);
    router.refresh();
  }

  function handleUpdated(play: Play) {
    setPlays((prev) => prev.map((p) => (p.id === play.id ? play : p)));
    setEditPlay(null);
    router.refresh();
  }

  const totalPlays = plays.length;
  const uniqueGames = new Set(plays.map((p) => p.game_id)).size;

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-72px)]">
        <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-3">
          <div className="flex items-center justify-between max-w-2xl mx-auto">
            <div>
              <h1 className="font-display text-2xl font-semibold text-foreground">Partien</h1>
              {totalPlays > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {totalPlays} {totalPlays === 1 ? "Partie" : "Partien"} · {uniqueGames} {uniqueGames === 1 ? "Spiel" : "Spiele"}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <div className="relative" ref={sortRef}>
                <button
                  type="button"
                  onClick={() => setSortOpen((o) => !o)}
                  className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
                >
                  <SlidersHorizontal size={14} />
                </button>
                {sortOpen && (
                  <div className="absolute right-0 top-full mt-2 w-44 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                    {[
                      { key: "date_desc" as PlaySortKey, label: "Neueste zuerst" },
                      { key: "date_asc" as PlaySortKey, label: "Älteste zuerst" },
                      { key: "game_asc" as PlaySortKey, label: "Spiel A → Z" },
                    ].map((opt) => (
                      <button
                        type="button"
                        key={opt.key}
                        onClick={() => { setSortKey(opt.key); setSortOpen(false); }}
                        className={cn(
                          "w-full px-3 py-2.5 text-sm text-left transition-colors",
                          sortKey === opt.key ? "bg-amber-50 text-amber-700 font-medium" : "hover:bg-muted text-foreground"
                        )}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="w-9 h-9 rounded-full bg-amber-500 hover:bg-amber-600 text-white flex items-center justify-center shadow-sm transition-colors"
                aria-label="Partie erfassen"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 py-4 max-w-2xl mx-auto w-full">
          {plays.length === 0 ? (
            <EmptyState onAdd={() => setSheetOpen(true)} />
          ) : (
            <div className="flex flex-col gap-2">
              {sortedPlays.map((play) => (
                <PlayCard
                  key={play.id}
                  play={play}
                  onEdit={() => setEditPlay(play)}
                  onDelete={() => setDeleteId(play.id)}
                  showDeleteConfirm={deleteId === play.id}
                  onConfirmDelete={() => handleDelete(play.id)}
                  onCancelDelete={() => setDeleteId(null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {sheetOpen && (
        <PlaySheet
          libraryGames={libraryGames}
          onClose={() => setSheetOpen(false)}
          onSaved={handleCreated}
        />
      )}

      {editPlay && (
        <PlaySheet
          libraryGames={libraryGames}
          editPlay={editPlay}
          onClose={() => setEditPlay(null)}
          onSaved={handleUpdated}
        />
      )}
    </>
  );
}

function PlayCard({
  play, onEdit, onDelete, showDeleteConfirm, onConfirmDelete, onCancelDelete,
}: {
  play: Play;
  onEdit: () => void;
  onDelete: () => void;
  showDeleteConfirm: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
}) {
  const date = new Date(play.played_at);
  const dateStr = date.toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" });
  const winner = play.players?.find((p) => p.winner);
  const withScores = play.players?.some((p) => p.score != null) && !winner;

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card">
      <div className="flex items-start gap-3 p-3">
        <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
          {play.game?.thumbnail_url ? (
            <Image src={play.game.thumbnail_url} alt={play.game?.name ?? ""} fill className="object-cover" sizes="56px" />
          ) : (
            <div className="w-full h-full bg-amber-100 flex items-center justify-center">
              <span className="text-amber-600 font-bold text-lg">{play.game?.name?.[0] ?? "?"}</span>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm text-foreground leading-tight truncate">
            {play.game?.name ?? "Unbekanntes Spiel"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">{dateStr}</p>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
            {play.players && play.players.length > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users size={11} />
                {play.players.map((p) => p.display_name).join(", ")}
              </span>
            )}
            {play.duration_minutes && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock size={11} />
                {play.duration_minutes} Min
              </span>
            )}
            {play.location && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={11} />
                {play.location}
              </span>
            )}
          </div>

          {winner && (
            <div className="mt-1.5">
              <span className="text-xs bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-full">
                🏆 {winner.display_name}{winner.score != null && ` (${winner.score})`}
              </span>
            </div>
          )}
          {withScores && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {play.players?.sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).map((p) => (
                <span key={p.id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {p.display_name}: {p.score}
                </span>
              ))}
            </div>
          )}
          {play.cooperative && (
            <span className="mt-1.5 inline-block text-xs bg-sky-100 text-sky-700 px-2 py-0.5 rounded-full font-medium">Kooperativ</span>
          )}
          {play.notes && (
            <p className="mt-1.5 text-xs text-muted-foreground italic line-clamp-2">{play.notes}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5 flex-shrink-0 mt-0.5">
          <button onClick={onEdit} className="text-muted-foreground hover:text-foreground transition-colors" aria-label="Bearbeiten">
            <Edit2 size={14} />
          </button>
          <button onClick={onDelete} className="text-muted-foreground hover:text-red-400 transition-colors" aria-label="Löschen">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {play.image_url && (
        <div className="relative w-full h-32 overflow-hidden">
          <img src={play.image_url} alt="" className="w-full h-full object-cover" />
        </div>
      )}

      {showDeleteConfirm && (
        <div className="border-t border-border px-3 py-2.5 bg-red-50 flex items-center justify-between gap-3">
          <p className="text-xs text-red-700 font-medium">Partie wirklich löschen?</p>
          <div className="flex gap-2">
            <button onClick={onConfirmDelete} className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold">Löschen</button>
            <button onClick={onCancelDelete} className="px-3 py-1 rounded-lg bg-muted text-xs font-medium">Abbrechen</button>
          </div>
        </div>
      )}
    </div>
  );
}

function PlaySheet({
  libraryGames, editPlay, onClose, onSaved,
}: {
  libraryGames: LibraryGame[];
  editPlay?: Play | null;
  onClose: () => void;
  onSaved: (play: Play) => void;
}) {
  const isEdit = !!editPlay;
  const today = new Date().toISOString().slice(0, 10);

  const [gameId, setGameId] = useState<string>(editPlay?.game_id ?? "");
  const [gameSearch, setGameSearch] = useState("");
  const [gameDropdownOpen, setGameDropdownOpen] = useState(false);
  const [playedAt, setPlayedAt] = useState(editPlay?.played_at?.slice(0, 10) ?? today);
  const [duration, setDuration] = useState(editPlay?.duration_minutes?.toString() ?? "");
  const [location, setLocation] = useState(editPlay?.location ?? "");
  const [notes, setNotes] = useState(editPlay?.notes ?? "");
  const [cooperative, setCooperative] = useState(editPlay?.cooperative ?? false);
  const [players, setPlayers] = useState<DraftPlayer[]>(
    editPlay?.players && editPlay.players.length > 0
      ? editPlay.players.map((p) => ({ display_name: p.display_name, score: p.score?.toString() ?? "", winner: p.winner }))
      : [{ display_name: "", score: "", winner: false }]
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(editPlay?.image_url ?? null);

  const selectedGame = libraryGames.find((g) => g.id === gameId);
  const filteredGames = gameSearch
    ? libraryGames.filter((g) => g.name.toLowerCase().includes(gameSearch.toLowerCase()))
    : libraryGames;

  function addPlayer() {
    setPlayers((prev) => [...prev, { display_name: "", score: "", winner: false }]);
  }

  function removePlayer(i: number) {
    setPlayers((prev) => prev.filter((_, idx) => idx !== i));
  }

  function updatePlayer(i: number, field: keyof DraftPlayer, value: string | boolean) {
    setPlayers((prev) => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  }

  function toggleWinner(i: number) {
    setPlayers((prev) => prev.map((p, idx) => ({
      ...p,
      winner: idx === i ? !p.winner : false,
    })));
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  async function handleSave() {
    if (!gameId) { setError("Bitte ein Spiel auswählen"); return; }
    setSaving(true);
    setError(null);

    const validPlayers = players
      .filter((p) => p.display_name.trim())
      .map((p) => ({
        display_name: p.display_name.trim(),
        score: p.score !== "" ? Number(p.score) : null,
        winner: p.winner,
      }));

    const payload = {
      game_id: gameId,
      played_at: playedAt,
      duration_minutes: duration ? Number(duration) : null,
      location: location.trim() || null,
      notes: notes.trim() || null,
      cooperative,
      players: validPlayers,
    };

    let image_url: string | null = editPlay?.image_url ?? null;
    if (imageFile) {
      const form = new FormData();
      form.append("file", imageFile, `${Date.now()}.jpg`);
      form.append("play_id", isEdit ? editPlay!.id : "pending");
      const uploadRes = await fetch("/api/play-images", { method: "POST", body: form });
      if (uploadRes.ok) {
        const uploadData = await uploadRes.json() as { url: string };
        image_url = uploadData.url;
      }
    }

    const finalPayload = { ...payload, image_url };

    const res = isEdit
      ? await fetch(`/api/plays/${editPlay!.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        })
      : await fetch("/api/plays", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(finalPayload),
        });

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? "Fehler"); setSaving(false); return; }
    onSaved(data as Play);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col" style={{ maxHeight: "92dvh" }}>
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-semibold">{isEdit ? "Partie bearbeiten" : "Partie erfassen"}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
          {/* Game selector */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Spiel *</label>
            <div className="relative">
              <button
                onClick={() => setGameDropdownOpen((o) => !o)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-colors",
                  gameId ? "border-amber-400 bg-amber-50" : "border-border bg-background"
                )}
              >
                {selectedGame?.thumbnail_url && (
                  <Image src={selectedGame.thumbnail_url} alt="" width={32} height={32} className="rounded-md object-cover flex-shrink-0" />
                )}
                <span className={cn("flex-1 text-sm truncate", !gameId && "text-muted-foreground")}>
                  {selectedGame?.name ?? "Spiel auswählen…"}
                </span>
                <ChevronDown size={16} className={cn("text-muted-foreground transition-transform", gameDropdownOpen && "rotate-180")} />
              </button>

              {gameDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl z-10 overflow-hidden max-h-60">
                  <div className="p-2 border-b border-border">
                    <input
                      value={gameSearch}
                      onChange={(e) => setGameSearch(e.target.value)}
                      placeholder="Suchen…"
                      className="w-full text-sm px-3 py-1.5 rounded-lg bg-muted focus:outline-none"
                      autoFocus
                    />
                  </div>
                  <div className="overflow-y-auto max-h-44">
                    {filteredGames.map((g) => (
                      <button
                        key={g.id}
                        onClick={() => { setGameId(g.id); setGameDropdownOpen(false); setGameSearch(""); }}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 text-sm text-left hover:bg-muted transition-colors",
                          gameId === g.id && "bg-amber-50 text-amber-700 font-medium"
                        )}
                      >
                        {g.thumbnail_url && (
                          <Image src={g.thumbnail_url} alt="" width={28} height={28} className="rounded object-cover flex-shrink-0" />
                        )}
                        <span className="truncate">{g.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Datum</label>
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Dauer (Min)</label>
              <input
                type="number"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                placeholder="z.B. 90"
                className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              <MapPin size={11} className="inline mr-1" />Ort (optional)
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="z.B. Zuhause, Spieleabend bei Marc…"
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div className="flex items-center justify-between px-3 py-2.5 bg-muted/40 rounded-xl">
            <span className="text-sm font-medium">Kooperativ gespielt</span>
            <button
              type="button"
              onClick={() => {
                setCooperative((c) => {
                  const next = !c;
                  // clear winner flags when switching to cooperative mode
                  if (next) setPlayers((prev) => prev.map((p) => ({ ...p, winner: false })));
                  return next;
                });
              }}
              className={cn("rounded-full transition-colors relative flex-shrink-0", cooperative ? "bg-amber-500" : "bg-border")}
              style={{ width: "40px", height: "22px" }}
              aria-checked={cooperative}
              role="switch"
            >
              <span className={cn("absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform pointer-events-none", cooperative ? "translate-x-5" : "translate-x-0.5")} />
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Users size={11} className="inline mr-1" />Spieler
              </label>
              <button onClick={addPlayer} className="text-xs text-amber-600 font-medium flex items-center gap-1">
                <Plus size={12} /> Hinzufügen
              </button>
            </div>
            <div className="flex flex-col gap-2">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={p.display_name}
                    onChange={(e) => updatePlayer(i, "display_name", e.target.value)}
                    placeholder={`Spieler ${i + 1}`}
                    className="flex-1 text-sm px-3 py-2 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <input
                    value={p.score}
                    onChange={(e) => updatePlayer(i, "score", e.target.value)}
                    placeholder="Pkt"
                    type="number"
                    className="w-16 text-sm px-2 py-2 rounded-xl border border-border bg-background text-center focus:outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  {!cooperative && (
                    <button
                      onClick={() => toggleWinner(i)}
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center transition-colors flex-shrink-0",
                        p.winner ? "bg-amber-500 text-white" : "bg-muted text-muted-foreground hover:bg-amber-100"
                      )}
                      title="Gewinner"
                    >
                      🏆
                    </button>
                  )}
                  {players.length > 1 && (
                    <button onClick={() => removePlayer(i)} className="text-muted-foreground hover:text-red-400 flex-shrink-0">
                      <X size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Photo */}
          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">
              Foto (optional)
            </label>
            {imagePreview ? (
              <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-muted">
                <img src={imagePreview} alt="Vorschau" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 text-white flex items-center justify-center"
                >
                  <X size={13} />
                </button>
              </div>
            ) : (
              <>
                <input ref={photoRef} type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-dashed border-border hover:border-amber-400 hover:bg-amber-50 transition-all text-sm text-muted-foreground hover:text-amber-700 self-start"
                >
                  <Camera size={14} /> Foto hinzufügen
                </button>
              </>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block">Notizen (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Highlights, besondere Momente…"
              rows={3}
              className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        </div>

        <div className="px-4 py-4 border-t border-border flex-shrink-0">
          <button
            onClick={handleSave}
            disabled={saving || !gameId}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
          >
            {saving ? (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
            ) : (
              <Check size={16} />
            )}
            {isEdit ? "Änderungen speichern" : "Partie speichern"}
          </button>
        </div>
      </div>
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-6">
      <div className="w-20 h-20 rounded-3xl bg-amber-50 flex items-center justify-center mb-4">
        <span className="text-4xl">🎲</span>
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">Noch keine Partien</h3>
      <p className="text-muted-foreground text-sm mb-6 max-w-xs">
        Erfasse deine erste Partie und behalte den Überblick über deine Spielsessions.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 text-white font-semibold text-sm"
      >
        <Plus size={16} />
        Erste Partie erfassen
      </button>
    </div>
  );
}
