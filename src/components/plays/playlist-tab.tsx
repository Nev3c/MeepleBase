"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import {
  ChevronUp, ChevronDown, Trash2, Plus, X, ListOrdered,
  Users, Clock, ChevronDown as DropDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { PlaylistEntry } from "@/types";

// ── Local types ───────────────────────────────────────────────────────────────

interface LibraryGame {
  id: string;
  name: string;
  thumbnail_url: string | null;
  bgg_id: number;
}

interface AddableGame {
  id?: string;
  bgg_id?: number;
  name: string;
  thumbnail_url: string | null;
}

// ── PlaylistTab ───────────────────────────────────────────────────────────────

export function PlaylistTab({
  initialEntries,
  libraryGames,
}: {
  initialEntries: PlaylistEntry[];
  libraryGames: LibraryGame[];
}) {
  const [entries, setEntries] = useState<PlaylistEntry[]>(initialEntries);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  async function handleMoveUp(id: string, rank: number) {
    if (rank <= 1) return;
    setPendingIds((s) => new Set(s).add(id));

    // Optimistic update
    setEntries((prev) => {
      const next = [...prev];
      const idx = next.findIndex((e) => e.id === id);
      const neighborIdx = next.findIndex((e) => e.rank === rank - 1);
      if (idx === -1 || neighborIdx === -1) return prev;
      const temp = next[idx].rank;
      next[idx] = { ...next[idx], rank: next[neighborIdx].rank };
      next[neighborIdx] = { ...next[neighborIdx], rank: temp };
      return [...next].sort((a, b) => a.rank - b.rank);
    });

    await fetch(`/api/playlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: "up" }),
    });
    setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function handleMoveDown(id: string, rank: number) {
    if (rank >= entries.length) return;
    setPendingIds((s) => new Set(s).add(id));

    // Optimistic update
    setEntries((prev) => {
      const next = [...prev];
      const idx = next.findIndex((e) => e.id === id);
      const neighborIdx = next.findIndex((e) => e.rank === rank + 1);
      if (idx === -1 || neighborIdx === -1) return prev;
      const temp = next[idx].rank;
      next[idx] = { ...next[idx], rank: next[neighborIdx].rank };
      next[neighborIdx] = { ...next[neighborIdx], rank: temp };
      return [...next].sort((a, b) => a.rank - b.rank);
    });

    await fetch(`/api/playlist/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction: "down" }),
    });
    setPendingIds((s) => { const n = new Set(s); n.delete(id); return n; });
  }

  async function handleDelete(id: string, rank: number) {
    // Optimistic update
    setEntries((prev) =>
      prev
        .filter((e) => e.id !== id)
        .map((e) => e.rank > rank ? { ...e, rank: e.rank - 1 } : e)
    );
    await fetch(`/api/playlist/${id}`, { method: "DELETE" });
  }

  async function handleAdd(game: AddableGame) {
    // If not a library game, ensure it exists in DB first
    let game_id = game.id;

    if (!game_id && game.bgg_id) {
      const res = await fetch("/api/games/ensure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgg_id: game.bgg_id, name: game.name, thumbnail_url: game.thumbnail_url }),
      });
      if (!res.ok) return;
      const data = await res.json() as { game_id: string };
      game_id = data.game_id;
    }

    if (!game_id) return;

    const res = await fetch("/api/playlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ game_id }),
    });
    if (!res.ok) return;

    const data = await res.json() as { entry: PlaylistEntry };
    setEntries((prev) => [...prev, data.entry]);
    setAddSheetOpen(false);
  }

  const existingGameIds = new Set(entries.map((e) => e.game_id));

  return (
    <div className="flex flex-col">
      {/* Info header */}
      {entries.length > 0 && (
        <div className="mb-4 px-1">
          <p className="text-xs text-muted-foreground leading-snug">
            Deine Top-{entries.length} Wunschspiele · bei der Lotterie priorisiert nach Rang
          </p>
        </div>
      )}

      {entries.length === 0 ? (
        <EmptyStatePlaylist onAdd={() => setAddSheetOpen(true)} />
      ) : (
        <>
          {/* Ranked list */}
          <div className="flex flex-col gap-2">
            {entries.map((entry, i) => (
              <PlaylistEntryRow
                key={entry.id}
                entry={entry}
                isFirst={i === 0}
                isLast={i === entries.length - 1}
                isPending={pendingIds.has(entry.id)}
                onMoveUp={() => handleMoveUp(entry.id, entry.rank)}
                onMoveDown={() => handleMoveDown(entry.id, entry.rank)}
                onDelete={() => handleDelete(entry.id, entry.rank)}
              />
            ))}
          </div>

          {/* Add more button */}
          {entries.length < 10 && (
            <button
              onClick={() => setAddSheetOpen(true)}
              className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-amber-200 hover:border-amber-400 hover:bg-amber-50 text-amber-600 hover:text-amber-700 text-sm font-medium transition-all"
            >
              <Plus size={15} strokeWidth={2.5} />
              Spiel hinzufügen ({entries.length}/10)
            </button>
          )}

          {entries.length >= 10 && (
            <p className="mt-3 text-center text-xs text-muted-foreground bg-muted/40 rounded-xl py-2">
              Playlist voll · Entferne ein Spiel um ein anderes hinzuzufügen
            </p>
          )}
        </>
      )}

      {/* Add to playlist sheet */}
      {addSheetOpen && (
        <AddToPlaylistSheet
          libraryGames={libraryGames}
          existingGameIds={existingGameIds}
          onClose={() => setAddSheetOpen(false)}
          onAdd={handleAdd}
        />
      )}
    </div>
  );
}

// ── PlaylistEntryRow ──────────────────────────────────────────────────────────

function PlaylistEntryRow({
  entry, isFirst, isLast, isPending, onMoveUp, onMoveDown, onDelete,
}: {
  entry: PlaylistEntry;
  isFirst: boolean;
  isLast: boolean;
  isPending: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  const rankColors: Record<number, string> = {
    1: "text-amber-500",
    2: "text-slate-500",
    3: "text-amber-700",
  };
  const rankColor = rankColors[entry.rank] ?? "text-muted-foreground";

  return (
    <div className={cn(
      "bg-card border border-border rounded-2xl overflow-hidden transition-all",
      isPending && "opacity-60"
    )}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Rank number */}
        <span className={cn(
          "w-7 text-center font-display font-bold text-xl flex-shrink-0",
          rankColor
        )}>
          {entry.rank}
        </span>

        {/* Game cover */}
        <div className="relative w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 bg-amber-50">
          {entry.game?.thumbnail_url ? (
            <Image
              src={entry.game.thumbnail_url}
              alt={entry.game?.name ?? ""}
              fill
              className="object-cover"
              sizes="44px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="text-amber-500 font-bold text-lg">
                {entry.game?.name?.[0] ?? "?"}
              </span>
            </div>
          )}
        </div>

        {/* Game info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight truncate">
            {entry.game?.name ?? "Unbekanntes Spiel"}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {entry.game?.min_players && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Users size={9} />
                {entry.game.min_players}
                {entry.game.max_players && entry.game.max_players !== entry.game.min_players
                  ? `–${entry.game.max_players}`
                  : ""}
              </span>
            )}
            {entry.game?.min_playtime && (
              <span className="flex items-center gap-0.5 text-[11px] text-muted-foreground">
                <Clock size={9} />
                {entry.game.min_playtime}
                {entry.game.max_playtime && entry.game.max_playtime !== entry.game.min_playtime
                  ? `–${entry.game.max_playtime}`
                  : ""}
                {" Min"}
              </span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            onClick={onMoveUp}
            disabled={isFirst || isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Höher"
          >
            <ChevronUp size={16} />
          </button>
          <button
            onClick={onMoveDown}
            disabled={isLast || isPending}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            aria-label="Niedriger"
          >
            <ChevronDown size={16} />
          </button>
          <button
            onClick={() => setConfirmDelete(true)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-red-400 hover:bg-red-50 transition-colors"
            aria-label="Entfernen"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div className="border-t border-border px-3 py-2.5 bg-red-50 flex items-center justify-between gap-3">
          <p className="text-xs text-red-700 font-medium">Aus Playlist entfernen?</p>
          <div className="flex gap-2">
            <button
              onClick={onDelete}
              className="px-3 py-1 rounded-lg bg-red-500 text-white text-xs font-semibold"
            >
              Entfernen
            </button>
            <button
              onClick={() => setConfirmDelete(false)}
              className="px-3 py-1 rounded-lg bg-white border border-border text-xs font-medium"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── AddToPlaylistSheet ────────────────────────────────────────────────────────

function AddToPlaylistSheet({
  libraryGames,
  existingGameIds,
  onClose,
  onAdd,
}: {
  libraryGames: LibraryGame[];
  existingGameIds: Set<string>;
  onClose: () => void;
  onAdd: (game: AddableGame) => void;
}) {
  const [search, setSearch] = useState("");
  const [globalResults, setGlobalResults] = useState<{ bgg_id: number; name: string; thumbnail_url: string | null }[]>([]);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  // Library search (excluding already-added games)
  const filteredLibrary = libraryGames.filter(
    (g) =>
      !existingGameIds.has(g.id) &&
      (!search || g.name.toLowerCase().includes(search.toLowerCase()))
  );

  // Global BGG search (when no library results)
  useEffect(() => {
    const trimmed = search.trim();
    if (trimmed.length < 2) { setGlobalResults([]); return; }
    if (filteredLibrary.length > 0) { setGlobalResults([]); return; }

    setGlobalSearching(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/games/search?q=${encodeURIComponent(trimmed)}`);
        if (res.ok) {
          const data = await res.json() as { results: { bgg_id: number; name: string; thumbnail_url: string | null }[] };
          setGlobalResults((data.results ?? []).filter((g) => {
            // Filter out games already in library (by name match since we don't have game_id for BGG results here)
            return true;
          }));
        }
      } finally {
        setGlobalSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  async function selectGame(game: AddableGame) {
    if (adding) return;
    setAdding(true);
    await onAdd(game);
    setAdding(false);
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "80dvh" }}
      >
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-display text-lg font-semibold">Zur Playlist hinzufügen</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Suche in deiner Bibliothek oder bei BGG</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
            <X size={20} />
          </button>
        </div>

        {/* Search input */}
        <div className="px-4 py-3 border-b border-border flex-shrink-0">
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Spielname suchen…"
            className="w-full text-sm px-3 py-2.5 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {/* Library results */}
          {filteredLibrary.length > 0 && (
            <>
              {search && (
                <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  Deine Bibliothek
                </div>
              )}
              {filteredLibrary.slice(0, 30).map((g) => (
                <button
                  key={g.id}
                  onClick={() => selectGame({ id: g.id, name: g.name, thumbnail_url: g.thumbnail_url })}
                  disabled={adding}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-amber-50">
                    {g.thumbnail_url ? (
                      <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-amber-500 font-bold">{g.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium text-left truncate">{g.name}</span>
                  <Plus size={14} className="text-amber-500 flex-shrink-0" />
                </button>
              ))}
            </>
          )}

          {/* Global BGG results */}
          {globalSearching && (
            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
              <svg className="animate-spin h-4 w-4 mr-2 text-amber-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Suche…
            </div>
          )}
          {!globalSearching && globalResults.length > 0 && (
            <>
              <div className="px-4 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide bg-muted/30 border-t border-border">
                Alle Spiele (BGG)
              </div>
              {globalResults.map((g) => (
                <button
                  key={g.bgg_id}
                  onClick={() => selectGame({ bgg_id: g.bgg_id, name: g.name, thumbnail_url: g.thumbnail_url })}
                  disabled={adding}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors disabled:opacity-50"
                >
                  <div className="relative w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-muted">
                    {g.thumbnail_url ? (
                      <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="40px" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <span className="text-muted-foreground font-bold">{g.name[0]}</span>
                      </div>
                    )}
                  </div>
                  <span className="flex-1 text-sm font-medium text-left truncate">{g.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex-shrink-0">BGG</span>
                </button>
              ))}
            </>
          )}

          {/* Empty/initial state */}
          {!search && filteredLibrary.length === 0 && (
            <div className="flex flex-col items-center py-10 px-6 text-center">
              <ListOrdered size={28} className="text-amber-300 mb-3" />
              <p className="text-sm text-muted-foreground">Tippe um in deiner Bibliothek zu suchen</p>
            </div>
          )}
          {search && !globalSearching && filteredLibrary.length === 0 && globalResults.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <p className="text-sm text-muted-foreground">Nichts gefunden für „{search}"</p>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyStatePlaylist({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center px-6">
      <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-100 to-amber-50 flex items-center justify-center mb-5 shadow-inner">
        <ListOrdered size={34} className="text-amber-400" />
        <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-amber-500 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold">10</span>
        </div>
      </div>
      <h3 className="font-display text-xl font-semibold text-foreground mb-2">
        Deine Wunschliste
      </h3>
      <p className="text-muted-foreground text-sm mb-2 max-w-xs leading-relaxed">
        Füge bis zu 10 Spiele hinzu, die du unbedingt spielen möchtest.
      </p>
      <p className="text-muted-foreground text-xs mb-6 max-w-xs leading-relaxed bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
        🎰 Bei der <strong className="text-amber-700">Lotterie</strong> fließen alle Listen der Teilnehmer ein — Rang 1 bekommt die meisten Lose.
      </p>
      <button
        onClick={onAdd}
        className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors shadow-sm"
      >
        <Plus size={16} /> Erstes Spiel hinzufügen
      </button>
    </div>
  );
}
