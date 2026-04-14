"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { Search, Users, Clock, Star, Check, ChevronRight, Dices, BookOpen, UserSearch } from "lucide-react";
import { cn, formatPlayerCount, formatPlaytime } from "@/lib/utils";
import type { GameStatus } from "@/types";

// ── Types ──────────────────────────────────────────────────────────────────────

interface LibraryGame {
  game_id: string;
  status: GameStatus;
  personal_rating: number | null;
  game: {
    id: string;
    name: string;
    thumbnail_url: string | null;
    min_players: number | null;
    max_players: number | null;
    min_playtime: number | null;
    max_playtime: number | null;
    rating_avg: number | null;
    year_published: number | null;
  } | null;
}

interface SearchResult {
  bgg_id: number;
  name: string;
  year_published: number | null;
  thumbnail_url?: string | null;
}

type DiscoverTab = "spiele" | "spieler";
type SpielTab = "suche" | "ungemspielt" | "heute";

// ── Main Component ─────────────────────────────────────────────────────────────

export function DiscoverClient({
  userGames,
  playCountMap,
}: {
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const [tab, setTab] = useState<DiscoverTab>("spiele");
  const [spielTab, setSpielTab] = useState<SpielTab>("suche");

  return (
    <div className="flex flex-col min-h-[calc(100dvh-72px)]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border px-4 pt-4 pb-0">
        <div className="max-w-2xl mx-auto">
          <h1 className="font-display text-2xl font-semibold text-foreground mb-3">Entdecken</h1>

          {/* Main tabs: Spiele / Spieler */}
          <div className="flex gap-0 border-b border-border -mx-4 px-4">
            {([
              { key: "spiele" as DiscoverTab, label: "Spiele", icon: BookOpen },
              { key: "spieler" as DiscoverTab, label: "Spieler", icon: UserSearch },
            ] as const).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  tab === key
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-2xl mx-auto w-full">
        {tab === "spiele" ? (
          <SpielTab
            activeTab={spielTab}
            setActiveTab={setSpielTab}
            userGames={userGames}
            playCountMap={playCountMap}
          />
        ) : (
          <SpielerTab />
        )}
      </div>
    </div>
  );
}

// ── Spiele Tab ─────────────────────────────────────────────────────────────────

function SpielTab({
  activeTab,
  setActiveTab,
  userGames,
  playCountMap,
}: {
  activeTab: SpielTab;
  setActiveTab: (t: SpielTab) => void;
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const libraryGameIds = new Set(userGames.map((ug) => ug.game_id));

  return (
    <div className="flex flex-col">
      {/* Sub-tabs */}
      <div className="flex gap-1 px-4 pt-3 pb-2">
        {([
          { key: "suche" as SpielTab, label: "Suche" },
          { key: "ungemspielt" as SpielTab, label: "Ungemspielt" },
          { key: "heute" as SpielTab, label: "Was heute spielen?" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveTab(key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              activeTab === key
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === "suche" && <GameSearchTab libraryGameIds={libraryGameIds} />}
      {activeTab === "ungemspielt" && <UngespieltTab userGames={userGames} playCountMap={playCountMap} />}
      {activeTab === "heute" && <HeuteTab userGames={userGames} playCountMap={playCountMap} />}
    </div>
  );
}

// ── Spielesuche ────────────────────────────────────────────────────────────────

function GameSearchTab({ libraryGameIds }: { libraryGameIds: Set<string> }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  const [addingId, setAddingId] = useState<number | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/games/search?q=${encodeURIComponent(q)}`);
      const data = await res.json() as { results: SearchResult[] };
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(query), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  async function handleAdd(result: SearchResult, status: GameStatus = "owned") {
    setAddingId(result.bgg_id);
    try {
      const res = await fetch("/api/games/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bgg_id: result.bgg_id, name: result.name, status }),
      });
      if (res.ok) {
        setAddedIds((prev) => new Set(prev).add(result.bgg_id));
      }
    } finally {
      setAddingId(null);
    }
  }

  return (
    <div className="px-4 pb-8">
      {/* Search input */}
      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Spiel suchen…"
          className="w-full pl-9 pr-4 py-2.5 rounded-2xl border border-border bg-muted/40 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
          autoFocus
        />
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="animate-spin h-4 w-4 text-amber-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
            </svg>
          </div>
        )}
      </div>

      {query.trim().length < 2 && (
        <p className="text-center text-sm text-muted-foreground py-12">Mindestens 2 Zeichen eingeben…</p>
      )}

      {results.length > 0 && (
        <div className="flex flex-col gap-2">
          {results.map((r) => {
            const inLib = libraryGameIds.has(String(r.bgg_id));
            const added = addedIds.has(r.bgg_id);
            const busy = addingId === r.bgg_id;
            return (
              <div key={r.bgg_id} className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card">
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {r.thumbnail_url ? (
                    <Image src={r.thumbnail_url} alt={r.name} width={48} height={48} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-amber-100">
                      <span className="text-amber-600 font-bold text-lg">{r.name[0]}</span>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  {r.year_published && (
                    <p className="text-xs text-muted-foreground">{r.year_published}</p>
                  )}
                </div>
                {inLib || added ? (
                  <span className="flex items-center gap-1 text-xs text-green-600 font-medium bg-green-50 px-2.5 py-1 rounded-full">
                    <Check size={11} /> In Bibliothek
                  </span>
                ) : (
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => handleAdd(r, "owned")}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-xl bg-amber-500 text-white font-medium hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {busy ? "…" : "+ Besitz"}
                    </button>
                    <button
                      onClick={() => handleAdd(r, "wishlist")}
                      disabled={busy}
                      className="text-xs px-3 py-1.5 rounded-xl bg-muted text-muted-foreground font-medium hover:bg-muted/80 disabled:opacity-50 transition-colors"
                    >
                      ♡
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && query.trim().length >= 2 && results.length === 0 && (
        <p className="text-center text-sm text-muted-foreground py-12">{`Keine Ergebnisse für "${query}"`}</p>
      )}
    </div>
  );
}

// ── Ungemspielt ────────────────────────────────────────────────────────────────

function UngespieltTab({
  userGames,
  playCountMap,
}: {
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const unplayed = userGames
    .filter((ug) => ug.status === "owned" && !playCountMap[ug.game_id] && ug.game)
    .sort((a, b) => (b.personal_rating ?? b.game?.rating_avg ?? 0) - (a.personal_rating ?? a.game?.rating_avg ?? 0));

  if (unplayed.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center px-6">
        <div className="text-5xl mb-4">🎉</div>
        <h3 className="font-display text-xl font-semibold mb-2">Alles gespielt!</h3>
        <p className="text-muted-foreground text-sm">Du hast alle deine Spiele mindestens einmal gespielt. Respekt!</p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8">
      <p className="text-xs text-muted-foreground mb-3 font-medium">
        {unplayed.length} {unplayed.length === 1 ? "Spiel" : "Spiele"} noch nie gespielt · sortiert nach Bewertung
      </p>
      <div className="flex flex-col gap-2">
        {unplayed.map((ug) => {
          const g = ug.game!;
          return (
            <Link
              key={ug.game_id}
              href={`/games/${g.id}`}
              className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all active:scale-[0.99]"
            >
              <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                {g.thumbnail_url ? (
                  <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-amber-100">
                    <span className="text-amber-600 font-bold text-xl">{g.name[0]}</span>
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                {g.year_published && <p className="text-xs text-muted-foreground">{g.year_published}</p>}
                <div className="flex items-center gap-3 mt-1">
                  {(g.min_players || g.max_players) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users size={10} /> {formatPlayerCount(g.min_players, g.max_players)}
                    </span>
                  )}
                  {(g.min_playtime || g.max_playtime) && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock size={10} /> {formatPlaytime(g.min_playtime, g.max_playtime)}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 flex-shrink-0">
                {ug.personal_rating != null ? (
                  <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                    <Star size={10} fill="currentColor" />{ug.personal_rating}
                  </span>
                ) : g.rating_avg != null ? (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Star size={9} strokeWidth={1.5} />{g.rating_avg.toFixed(1)}
                  </span>
                ) : null}
                <ChevronRight size={14} className="text-muted-foreground" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Was heute spielen? ─────────────────────────────────────────────────────────

function HeuteTab({
  userGames,
  playCountMap,
}: {
  userGames: LibraryGame[];
  playCountMap: Record<string, number>;
}) {
  const [players, setPlayers] = useState(3);
  const [time, setTime] = useState(90);
  const [suggestions, setSuggestions] = useState<LibraryGame[] | null>(null);

  const ownedGames = userGames.filter((ug) => ug.status === "owned" && ug.game);

  function findGames() {
    const matches = ownedGames.filter((ug) => {
      const g = ug.game!;
      const fitsPlayers =
        (g.min_players == null || players >= g.min_players) &&
        (g.max_players == null || players <= g.max_players);
      const fitsTime =
        g.min_playtime == null || g.min_playtime <= time;
      return fitsPlayers && fitsTime;
    });

    // Sort: personal_rating desc, then bgg rating, then most played
    const sorted = matches.sort((a, b) => {
      const rA = a.personal_rating ?? a.game?.rating_avg ?? 0;
      const rB = b.personal_rating ?? b.game?.rating_avg ?? 0;
      if (rB !== rA) return rB - rA;
      return (playCountMap[b.game_id] ?? 0) - (playCountMap[a.game_id] ?? 0);
    });

    setSuggestions(sorted.slice(0, 8));
  }

  return (
    <div className="px-4 pb-8">
      {/* Controls */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex flex-col gap-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Users size={14} className="text-amber-500" /> Spieler
              </label>
              <span className="text-sm font-bold text-amber-600 w-8 text-center">{players}</span>
            </div>
            <input
              type="range" min={1} max={8} value={players}
              onChange={(e) => { setPlayers(Number(e.target.value)); setSuggestions(null); }}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>1</span><span>8</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" /> Max. Zeit
              </label>
              <span className="text-sm font-bold text-amber-600 w-16 text-right">
                {time < 60 ? `${time} Min` : `${Math.floor(time/60)}h${time%60>0 ? ` ${time%60}m` : ""}`}
              </span>
            </div>
            <input
              type="range" min={15} max={240} step={15} value={time}
              onChange={(e) => { setTime(Number(e.target.value)); setSuggestions(null); }}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
              <span>15 Min</span><span>4h</span>
            </div>
          </div>
        </div>

        <button
          onClick={findGames}
          className="w-full mt-4 py-2.5 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors"
        >
          <Dices size={16} /> Spiele finden
        </button>
      </div>

      {/* Results */}
      {suggestions !== null && (
        <>
          {suggestions.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-muted-foreground text-sm">Kein passendes Spiel in deiner Sammlung gefunden.</p>
              <p className="text-xs text-muted-foreground mt-1">Versuch mehr Spieler oder mehr Zeit.</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-muted-foreground mb-3 font-medium">
                {suggestions.length} passende Spiele für {players} Spieler · max. {time} Min.
              </p>
              <div className="flex flex-col gap-2">
                {suggestions.map((ug) => {
                  const g = ug.game!;
                  return (
                    <Link
                      key={ug.game_id}
                      href={`/games/${g.id}`}
                      className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover transition-all active:scale-[0.99]"
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {g.thumbnail_url ? (
                          <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-amber-100">
                            <span className="text-amber-600 font-bold text-xl">{g.name[0]}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{g.name}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {(g.min_players || g.max_players) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Users size={10} /> {formatPlayerCount(g.min_players, g.max_players)}
                            </span>
                          )}
                          {(g.min_playtime || g.max_playtime) && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock size={10} /> {formatPlaytime(g.min_playtime, g.max_playtime)}
                            </span>
                          )}
                        </div>
                        {playCountMap[ug.game_id] > 0 && (
                          <p className="text-[10px] text-amber-600 font-medium mt-0.5">{playCountMap[ug.game_id]}× gespielt</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {ug.personal_rating != null ? (
                          <span className="flex items-center gap-0.5 text-xs font-bold text-amber-500">
                            <Star size={10} fill="currentColor" />{ug.personal_rating}
                          </span>
                        ) : g.rating_avg != null ? (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Star size={9} strokeWidth={1.5} />{g.rating_avg.toFixed(1)}
                          </span>
                        ) : null}
                        <ChevronRight size={14} className="text-muted-foreground" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Spieler Tab (Coming Soon) ──────────────────────────────────────────────────

function SpielerTab() {
  return (
    <div className="px-4 py-8 flex flex-col gap-5">
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center">
        <div className="text-4xl mb-3">👥</div>
        <h3 className="font-display text-lg font-semibold text-amber-900 mb-1">Spieler finden</h3>
        <p className="text-sm text-amber-700 leading-relaxed">
          Finde Mitspieler in deiner Nähe, die deine Lieblingsspiele mögen.
        </p>
        <span className="inline-block mt-3 text-xs bg-amber-200 text-amber-800 font-semibold px-3 py-1 rounded-full">Phase 2</span>
      </div>

      {[
        { icon: "🏘️", title: "Spielgruppen", desc: "Erstelle oder tritt lokalen Spielgruppen bei." },
        { icon: "📅", title: "Spieleabende", desc: "Plane Spieleabende und lade Freunde ein." },
        { icon: "🔍", title: "Nach Standort suchen", desc: "Finde Brettspieler in deiner Stadt." },
        { icon: "📊", title: "Aktivitätsfeed", desc: "Sieh was deine Freunde gerade spielen." },
      ].map(({ icon, title, desc }) => (
        <div key={title} className="flex items-start gap-3 p-4 bg-card border border-border rounded-xl opacity-60">
          <span className="text-2xl flex-shrink-0">{icon}</span>
          <div>
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
          </div>
          <span className="ml-auto text-[10px] bg-muted text-muted-foreground font-medium px-2 py-0.5 rounded-full flex-shrink-0">Bald</span>
        </div>
      ))}
    </div>
  );
}
