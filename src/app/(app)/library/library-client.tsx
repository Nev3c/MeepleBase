"use client";

import { useMemo, useState } from "react";
import { LibraryHeader } from "@/components/library/library-header";
import { LibraryEmptyState } from "@/components/library/library-empty-state";
import { GameCard } from "@/components/library/game-card";
import { AddGameSheet } from "@/components/library/add-game-sheet";
import { useLibraryStore } from "@/stores/library-store";
import type { UserGame, Profile } from "@/types";
import type { User } from "@supabase/supabase-js";
import { cn } from "@/lib/utils";

interface LibraryClientProps {
  initialGames: UserGame[];
  user?: User | null;
  profile?: Profile | null;
}

export function LibraryClient({ initialGames, user, profile }: LibraryClientProps) {
  const { view, filter, sortKey } = useLibraryStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetInitialTab, setSheetInitialTab] = useState<"search" | "import">("search");

  // Client-side filter + sort (will move to React Query + server when Supabase is wired)
  const filteredGames = useMemo(() => {
    let games = [...initialGames];

    if (filter.status) {
      games = games.filter((g) => g.status === filter.status);
    }

    if (filter.search) {
      const q = filter.search.toLowerCase();
      games = games.filter((g) => g.game?.name.toLowerCase().includes(q));
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
          // personal_rating first, fall back to BGG average rating
          return (b.personal_rating ?? b.game?.rating_avg ?? 0) - (a.personal_rating ?? a.game?.rating_avg ?? 0);
        default:
          return 0;
      }
    });

    return games;
  }, [initialGames, filter, sortKey]);

  const isEmpty = filteredGames.length === 0;
  const isFiltered = !!(filter.search || filter.status);

  return (
    <>
      <div className="flex flex-col min-h-[calc(100dvh-72px)]">
        <LibraryHeader
          user={user}
          profile={profile}
          onAddGame={() => { setSheetInitialTab("search"); setSheetOpen(true); }}
        />

        {/* Content */}
        {isEmpty ? (
          isFiltered ? (
            // Filtered empty state
            <div className="flex flex-col items-center justify-center flex-1 px-6 py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-8 h-8 text-muted-foreground" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 15.803M10.5 7.5v6m3-3h-6" />
                </svg>
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">
                Kein Spiel gefunden
              </h3>
              <p className="text-muted-foreground text-sm max-w-xs">
                Versuch einen anderen Suchbegriff oder entferne den Filter.
              </p>
            </div>
          ) : (
            <LibraryEmptyState
              onAddGame={() => { setSheetInitialTab("search"); setSheetOpen(true); }}
            />
          )
        ) : (
          <div className="px-4 py-4 max-w-2xl mx-auto w-full">
            {/* Game count */}
            <p className="text-xs text-muted-foreground mb-3 font-medium">
              {filteredGames.length} {filteredGames.length === 1 ? "Spiel" : "Spiele"}
            </p>

            {/* Grid or List */}
            <div
              className={cn(
                view === "grid"
                  ? "grid grid-cols-2 sm:grid-cols-3 gap-3"
                  : "flex flex-col gap-2"
              )}
            >
              {filteredGames.map((userGame) => (
                <GameCard key={userGame.id} userGame={userGame} view={view} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add Game Sheet */}
      <AddGameSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        bggUsername={profile?.bgg_username}
        initialTab={sheetInitialTab}
      />
    </>
  );
}
