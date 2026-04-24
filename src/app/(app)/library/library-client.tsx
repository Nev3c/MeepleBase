"use client";

import { useMemo, useState, useRef, useDeferredValue } from "react";
import Image from "next/image";
import Link from "next/link";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { Users, Clock, Star, ChevronRight, Dices } from "lucide-react";
import { LibraryHeader } from "@/components/library/library-header";
import { LibraryEmptyState } from "@/components/library/library-empty-state";
import { LibrarySortFilterSheet } from "@/components/library/library-sort-filter-sheet";
import { GameCard } from "@/components/library/game-card";
import { useLibraryStore } from "@/stores/library-store";
import { translateCategory, translateMechanic, } from "@/lib/bgg-translations";
import { cn, formatPlayerCount, formatPlaytime } from "@/lib/utils";
import type { UserGame, Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

// Lazy-load the heavy AddGameSheet (CSV parser + search + upload logic)
const AddGameSheet = dynamic(
  () => import("@/components/library/add-game-sheet").then((m) => ({ default: m.AddGameSheet })),
  { ssr: false }
);

interface LibraryClientProps {
  initialGames: UserGame[];
  user?: User | null;
  profile?: Profile | null;
  playCounts?: Record<string, number>;
}

export function LibraryClient({ initialGames, user, profile, playCounts }: LibraryClientProps) {
  const { view, filter, sortKey } = useLibraryStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetInitialTab, setSheetInitialTab] = useState<"search" | "import">("search");
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  // Spielen-Tab wurde aus der Bibliothek entfernt (→ später unter Partien)

  // Defer search input so typing stays instant while filter catches up
  const deferredSearch = useDeferredValue(filter.search);

  // Collect all unique categories + mechanics across the library (sorted by translated name)
  const { availableCategories, availableMechanics } = useMemo(() => {
    const cats = new Set<string>();
    const mechs = new Set<string>();
    for (const ug of initialGames) {
      for (const c of ug.game?.categories ?? []) cats.add(c);
      for (const m of ug.game?.mechanics ?? []) mechs.add(m);
    }
    return {
      availableCategories: Array.from(cats).sort((a, b) =>
        translateCategory(a).localeCompare(translateCategory(b), "de")
      ),
      availableMechanics: Array.from(mechs).sort((a, b) =>
        translateMechanic(a).localeCompare(translateMechanic(b), "de")
      ),
    };
  }, [initialGames]);

  const filteredGames = useMemo(() => {
    let games = [...initialGames];

    if (filter.status) {
      games = games.filter((g) => g.status === filter.status);
    }

    if (deferredSearch) {
      const q = deferredSearch.toLowerCase();
      games = games.filter((g) => g.game?.name.toLowerCase().includes(q));
    }

    if (filter.playerCount) {
      const n = filter.playerCount;
      games = games.filter((g) => {
        const min = g.game?.min_players ?? 1;
        const max = g.game?.max_players ?? 99;
        return min <= n && n <= max;
      });
    }

    if (filter.categories?.length) {
      games = games.filter((g) =>
        filter.categories!.some((c) => g.game?.categories?.includes(c))
      );
    }

    if (filter.mechanics?.length) {
      games = games.filter((g) =>
        filter.mechanics!.some((m) => g.game?.mechanics?.includes(m))
      );
    }

    if (filter.customized) {
      games = games.filter((g) => g.custom_fields?.customized === true);
    }

    games.sort((a, b) => {
      switch (sortKey) {
        case "name_asc":
          return (a.game?.name ?? "").localeCompare(b.game?.name ?? "", "de");
        case "name_desc":
          return (b.game?.name ?? "").localeCompare(a.game?.name ?? "", "de");
        case "added_desc":
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        case "added_asc":
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case "players_asc": {
          const aMin = a.game?.min_players ?? 999;
          const bMin = b.game?.min_players ?? 999;
          if (aMin !== bMin) return aMin - bMin;
          return (a.game?.max_players ?? 999) - (b.game?.max_players ?? 999);
        }
        case "players_desc": {
          const aMin = a.game?.min_players ?? -1;
          const bMin = b.game?.min_players ?? -1;
          if (aMin !== bMin) return bMin - aMin;
          return (b.game?.max_players ?? -1) - (a.game?.max_players ?? -1);
        }
        case "rating":
          return (b.personal_rating ?? b.game?.rating_avg ?? 0) - (a.personal_rating ?? a.game?.rating_avg ?? 0);
        case "rating_asc":
          return (a.personal_rating ?? a.game?.rating_avg ?? 0) - (b.personal_rating ?? b.game?.rating_avg ?? 0);
        case "plays_desc":
          return (playCounts?.[b.game_id] ?? 0) - (playCounts?.[a.game_id] ?? 0);
        case "plays_asc":
          return (playCounts?.[a.game_id] ?? 0) - (playCounts?.[b.game_id] ?? 0);
        default:
          return 0;
      }
    });

    return games;
  }, [initialGames, filter.status, filter.playerCount, filter.categories, filter.mechanics, filter.customized, deferredSearch, sortKey, playCounts]);

  const isEmpty = filteredGames.length === 0;
  const isFiltered = !!(filter.search || filter.status || filter.playerCount || filter.categories?.length || filter.mechanics?.length || filter.customized);
  const tagFilterCount = (filter.categories?.length ?? 0) + (filter.mechanics?.length ?? 0);
  const sortFilterActive = sortKey !== "name_asc" || tagFilterCount > 0 || !!filter.customized;

  function openAdd() { setSheetInitialTab("search"); setSheetOpen(true); }

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-72px)]">
        <LibraryHeader
          user={user}
          profile={profile}
          onAddGame={openAdd}
          onSortFilter={() => setFilterSheetOpen(true)}
          sortFilterActive={sortFilterActive}
          sortFilterCount={tagFilterCount}
        />

        {isEmpty ? (
          isFiltered ? (
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-muted-foreground" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803M10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">Kein Spiel gefunden</h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Versuch einen anderen Suchbegriff oder entferne den Filter.
              </p>
            </div>
          ) : (
            <LibraryEmptyState onAddGame={openAdd} />
          )
        ) : (
          <div className="px-4 py-4 max-w-2xl mx-auto w-full">
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              {filteredGames.length} {filteredGames.length === 1 ? "Spiel" : "Spiele"}
            </p>

            {view === "grid" ? (
              <GridView games={filteredGames} playCounts={playCounts} />
            ) : (
              <ListView games={filteredGames} playCounts={playCounts} />
            )}
          </div>
        )}
      </div>

      <AddGameSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        bggUsername={profile?.bgg_username}
        initialTab={sheetInitialTab}
      />

      {filterSheetOpen && (
        <LibrarySortFilterSheet
          availableCategories={availableCategories}
          availableMechanics={availableMechanics}
          filteredCount={filteredGames.length}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </>
  );
}

// ── Spielen Tab ────────────────────────────────────────────────────────────────

type SpielSubTab = "ungespielt" | "heute";

function SpielenTab({
  userGames,
  playCounts,
}: {
  userGames: UserGame[];
  playCounts?: Record<string, number>;
}) {
  const [subTab, setSubTab] = useState<SpielSubTab>("ungespielt");

  return (
    <div className="flex flex-col max-w-2xl mx-auto w-full">
      <div className="flex gap-1.5 px-4 pt-3 pb-2">
        {([
          { key: "ungespielt" as SpielSubTab, label: "Ungespielt" },
          { key: "heute" as SpielSubTab, label: "Was heute spielen?" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setSubTab(key)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors whitespace-nowrap",
              subTab === key
                ? "bg-amber-500 text-white"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {label}
          </button>
        ))}
      </div>
      {subTab === "ungespielt"
        ? <UngespieltSection userGames={userGames} playCounts={playCounts} />
        : <HeuteSection userGames={userGames} playCounts={playCounts} />
      }
    </div>
  );
}

// ── Ungespielt ─────────────────────────────────────────────────────────────────

function UngespieltSection({
  userGames,
  playCounts,
}: {
  userGames: UserGame[];
  playCounts?: Record<string, number>;
}) {
  const unplayed = userGames
    .filter((ug) => ug.status === "owned" && !(playCounts?.[ug.game_id]) && ug.game)
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
                  <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" loading="lazy" />
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

function HeuteSection({
  userGames,
  playCounts,
}: {
  userGames: UserGame[];
  playCounts?: Record<string, number>;
}) {
  const [players, setPlayers] = useState(3);
  const [time, setTime] = useState(90);
  const [suggestions, setSuggestions] = useState<UserGame[] | null>(null);

  const ownedGames = userGames.filter((ug) => ug.status === "owned" && ug.game);

  function findGames() {
    const matches = ownedGames.filter((ug) => {
      const g = ug.game!;
      return (
        (g.min_players == null || players >= g.min_players) &&
        (g.max_players == null || players <= g.max_players) &&
        (g.min_playtime == null || g.min_playtime <= time)
      );
    });

    setSuggestions(
      matches
        .sort((a, b) => {
          const rA = a.personal_rating ?? a.game?.rating_avg ?? 0;
          const rB = b.personal_rating ?? b.game?.rating_avg ?? 0;
          if (rB !== rA) return rB - rA;
          return (playCounts?.[b.game_id] ?? 0) - (playCounts?.[a.game_id] ?? 0);
        })
        .slice(0, 8)
    );
  }

  return (
    <div className="px-4 pb-8">
      <div className="bg-card border border-border rounded-2xl p-4 mb-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="text-sm font-medium flex items-center gap-1.5 mb-2">
              <Users size={14} className="text-amber-500" /> Spieleranzahl
            </label>
            <div className="flex gap-1.5 flex-wrap">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <button
                  key={n}
                  onClick={() => { setPlayers(n); setSuggestions(null); }}
                  className={cn(
                    "w-9 h-9 rounded-xl text-sm font-semibold transition-all",
                    players === n ? "bg-amber-500 text-white shadow-sm" : "bg-muted text-muted-foreground hover:bg-amber-100 hover:text-amber-700"
                  )}
                  aria-pressed={players === n}
                >
                  {n === 8 ? "8+" : n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium flex items-center gap-1.5">
                <Clock size={14} className="text-amber-500" /> Max. Zeit
              </label>
              <span className="text-sm font-bold text-amber-600 w-16 text-right">
                {time < 60 ? `${time} Min` : `${Math.floor(time / 60)}h${time % 60 > 0 ? ` ${time % 60}m` : ""}`}
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

      {suggestions !== null && (
        suggestions.length === 0 ? (
          <div className="text-center py-10">
            <p className="text-muted-foreground text-sm">Kein passendes Spiel gefunden.</p>
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
                    className="flex items-center gap-3 p-3 bg-card rounded-xl border border-border shadow-card active:scale-[0.99] transition-all"
                  >
                    <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {g.thumbnail_url ? (
                        <Image src={g.thumbnail_url} alt={g.name} fill className="object-cover" sizes="56px" loading="lazy" />
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
                      {(playCounts?.[ug.game_id] ?? 0) > 0 && (
                        <p className="text-[10px] text-amber-600 font-medium mt-0.5">{playCounts?.[ug.game_id]}× gespielt</p>
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
        )
      )}
    </div>
  );
}

// ── Virtualized List View ──────────────────────────────────────────────────────

function ListView({ games, playCounts }: { games: UserGame[]; playCounts?: Record<string, number> }) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: games.length,
    getScrollElement: () => document.documentElement, // use window scroll
    estimateSize: () => 84, // estimated row height in px (list card + gap)
    overscan: 8,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{ height: virtualizer.getTotalSize(), position: "relative" }}
      className="flex flex-col"
    >
      {items.map((vItem) => (
        <div
          key={vItem.key}
          data-index={vItem.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vItem.start}px)`,
            paddingBottom: 8,
          }}
        >
          <GameCard
            userGame={games[vItem.index]}
            view="list"
            playCount={playCounts?.[games[vItem.index].game_id] ?? 0}
          />
        </div>
      ))}
    </div>
  );
}

// ── Virtualized Grid View ──────────────────────────────────────────────────────

function GridView({ games, playCounts }: { games: UserGame[]; playCounts?: Record<string, number> }) {
  // For grid: group into rows of 2, virtualize rows
  const COLS = 2;
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => {
    const result: UserGame[][] = [];
    for (let i = 0; i < games.length; i += COLS) {
      result.push(games.slice(i, i + COLS));
    }
    return result;
  }, [games]);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => document.documentElement,
    estimateSize: () => 220, // estimated grid row height
    overscan: 4,
  });

  const items = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      style={{ height: virtualizer.getTotalSize(), position: "relative" }}
    >
      {items.map((vItem) => (
        <div
          key={vItem.key}
          data-index={vItem.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${vItem.start}px)`,
            paddingBottom: 12,
          }}
          className="grid grid-cols-2 sm:grid-cols-3 gap-3"
        >
          {rows[vItem.index].map((userGame) => (
            <GameCard
              key={userGame.id}
              userGame={userGame}
              view="grid"
              playCount={playCounts?.[userGame.game_id] ?? 0}
            />
          ))}
        </div>
      ))}
    </div>
  );
}
