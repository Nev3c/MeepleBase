"use client";

import { useMemo, useState, useRef, useDeferredValue } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import dynamic from "next/dynamic";
import { LibraryHeader } from "@/components/library/library-header";
import { LibraryEmptyState } from "@/components/library/library-empty-state";
import { LibraryFilterSheet } from "@/components/library/library-filter-sheet";
import { GameCard } from "@/components/library/game-card";
import { useLibraryStore } from "@/stores/library-store";
import { translateCategory, translateMechanic } from "@/lib/bgg-translations";
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
      availableCategories: [...cats].sort((a, b) =>
        translateCategory(a).localeCompare(translateCategory(b), "de")
      ),
      availableMechanics: [...mechs].sort((a, b) =>
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
  }, [initialGames, filter.status, filter.playerCount, filter.categories, filter.mechanics, deferredSearch, sortKey, playCounts]);

  const isEmpty = filteredGames.length === 0;
  const isFiltered = !!(filter.search || filter.status || filter.playerCount || filter.categories?.length || filter.mechanics?.length);
  const tagFilterCount = (filter.categories?.length ?? 0) + (filter.mechanics?.length ?? 0);

  function openAdd() { setSheetInitialTab("search"); setSheetOpen(true); }

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-72px)]">
        <LibraryHeader
          user={user}
          profile={profile}
          onAddGame={openAdd}
          onFilter={() => setFilterSheetOpen(true)}
          activeFilterCount={tagFilterCount}
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
        <LibraryFilterSheet
          availableCategories={availableCategories}
          availableMechanics={availableMechanics}
          onClose={() => setFilterSheetOpen(false)}
        />
      )}
    </>
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
