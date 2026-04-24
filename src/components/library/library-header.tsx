"use client";

import Link from "next/link";
import { Search, LayoutGrid, List, SlidersHorizontal, Plus, Users, Shuffle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryStore } from "@/stores/library-store";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

export type LibraryTab = "bibliothek" | "spielen";

const PLAYER_CHIPS = [
  { label: "1", value: 1 },
  { label: "2", value: 2 },
  { label: "3", value: 3 },
  { label: "4", value: 4 },
  { label: "5", value: 5 },
  { label: "6+", value: 6 },
];

interface LibraryHeaderProps {
  user?: User | null;
  profile?: Profile | null;
  onAddGame?: () => void;
  onSortFilter?: () => void;
  sortFilterActive?: boolean;
  sortFilterCount?: number;
  activeTab?: LibraryTab;
  onTabChange?: (tab: LibraryTab) => void;
  /** Quick player-count filter — passed down from library-client */
  playerCountFilter?: number | null;
  onPlayerCountChange?: (n: number | null) => void;
  onRandomPick?: () => void;
}


export function LibraryHeader({ user, profile, onAddGame, onSortFilter, sortFilterActive, sortFilterCount = 0, activeTab, onTabChange, playerCountFilter, onPlayerCountChange, onRandomPick }: LibraryHeaderProps) {
  const { view, setView, filter, setFilter } = useLibraryStore();

  const displayName = profile?.display_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  const onBibliothekTab = !activeTab || activeTab === "bibliothek";

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
      <div className={cn("px-4 pt-4 max-w-2xl mx-auto", onTabChange ? "pb-0" : "pb-3")}>
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
              Bibliothek
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Add game button — only on Bibliothek tab */}
            {onAddGame && onBibliothekTab && (
              <Button
                onClick={onAddGame}
                size="icon-sm"
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-amber"
                aria-label="Spiel hinzufügen"
              >
                <Plus size={16} strokeWidth={2.5} />
              </Button>
            )}
            {/* View toggle — only on Bibliothek tab */}
            {onBibliothekTab && (
              <div className="flex items-center bg-muted rounded-lg p-0.5">
                <button
                  onClick={() => setView("grid")}
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    view === "grid"
                      ? "bg-white shadow-sm text-amber-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Rasteransicht"
                  aria-pressed={view === "grid"}
                >
                  <LayoutGrid size={16} strokeWidth={2} />
                </button>
                <button
                  onClick={() => setView("list")}
                  className={cn(
                    "p-1.5 rounded-md transition-all duration-200",
                    view === "list"
                      ? "bg-white shadow-sm text-amber-500"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                  aria-label="Listenansicht"
                  aria-pressed={view === "list"}
                >
                  <List size={16} strokeWidth={2} />
                </button>
              </div>
            )}

            {/* Player-count quick-filter button */}
            {onPlayerCountChange && onBibliothekTab && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Für X Spieler filtern"
                  onClick={() => onPlayerCountChange(playerCountFilter ? null : 2)}
                  className={cn(playerCountFilter && "text-amber-500")}
                >
                  <Users size={16} strokeWidth={2} />
                </Button>
                {playerCountFilter && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
                    {playerCountFilter === 6 ? "6+" : playerCountFilter}
                  </span>
                )}
              </div>
            )}

            {/* Combined sort + filter button — only on Bibliothek tab */}
            {onSortFilter && onBibliothekTab && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Sortierung & Filter"
                  onClick={onSortFilter}
                  className={cn(sortFilterActive && "text-amber-500")}
                >
                  <SlidersHorizontal size={16} strokeWidth={2} />
                </Button>
                {sortFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center pointer-events-none">
                    {sortFilterCount}
                  </span>
                )}
              </div>
            )}

            {/* Avatar → Link zum Profil */}
            {user && (
              <Link href="/profile" aria-label="Zum Profil" className="flex-shrink-0">
                {avatarUrl ? (
                  <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white shadow-sm ring-1 ring-border">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center border-2 border-white shadow-sm ring-1 ring-border">
                    <span className="text-white text-xs font-bold">{initial}</span>
                  </div>
                )}
              </Link>
            )}
          </div>
        </div>

        {/* Search — only on Bibliothek tab */}
        {onBibliothekTab && (
          <div className={cn("flex flex-col gap-2", onTabChange ? "mb-0" : "")}>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                placeholder="Spiel suchen…"
                className="pl-10"
                value={filter.search ?? ""}
                onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                aria-label="Bibliothek durchsuchen"
              />
            </div>

            {/* Player count chip row */}
            {onPlayerCountChange && (
              <div className="flex items-center gap-1.5 pb-1">
                <span className="text-[11px] text-muted-foreground font-medium flex-shrink-0 flex items-center gap-1">
                  <Users size={11} /> Spieler:
                </span>
                {PLAYER_CHIPS.map(({ label, value }) => {
                  const active = playerCountFilter === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onPlayerCountChange(active ? null : value)}
                      className={cn(
                        "h-7 min-w-[32px] px-2 rounded-full text-xs font-semibold transition-all border",
                        active
                          ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                          : "bg-background border-border text-muted-foreground hover:border-amber-400 hover:text-foreground"
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
                {/* Random pick — only when a player count is selected */}
                {playerCountFilter && onRandomPick && (
                  <button
                    type="button"
                    onClick={onRandomPick}
                    title="Zufälliges Spiel für diese Spielerzahl"
                    className="ml-auto h-7 px-2.5 rounded-full text-xs font-semibold border border-dashed border-amber-400 text-amber-600 hover:bg-amber-50 transition-all flex items-center gap-1"
                  >
                    <Shuffle size={11} /> Zufällig
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab switcher */}
        {onTabChange && (
          <div className="flex gap-0 -mx-4 px-4 mt-3">
            {(["bibliothek", "spielen"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => onTabChange(t)}
                className={cn(
                  "flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors",
                  activeTab === t
                    ? "border-amber-500 text-amber-600"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                {t === "bibliothek" ? "Bibliothek" : "Spielen"}
              </button>
            ))}
          </div>
        )}
      </div>
    </header>
  );
}
