"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, LayoutGrid, List, SlidersHorizontal, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryStore } from "@/stores/library-store";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import type { User } from "@supabase/supabase-js";

interface LibraryHeaderProps {
  user?: User | null;
  profile?: Profile | null;
  onAddGame?: () => void;
  onSortFilter?: () => void;
  sortFilterActive?: boolean;
  sortFilterCount?: number;
}


export function LibraryHeader({ user, profile, onAddGame, onSortFilter, sortFilterActive, sortFilterCount = 0 }: LibraryHeaderProps) {
  const { view, setView, filter, setFilter } = useLibraryStore();

  const displayName = profile?.display_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  return (
    <header className="sticky top-0 z-30 bg-background/95 backdrop-blur-md border-b border-border">
      <div className="px-4 pt-4 pb-3 max-w-2xl mx-auto">
        {/* Title row */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-foreground leading-tight">
              Bibliothek
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {/* Add game button */}
            {onAddGame && (
              <Button
                onClick={onAddGame}
                size="icon-sm"
                className="bg-amber-500 hover:bg-amber-600 text-white shadow-amber"
                aria-label="Spiel hinzufügen"
              >
                <Plus size={16} strokeWidth={2.5} />
              </Button>
            )}
            {/* View toggle */}
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

            {/* Combined sort + filter button */}
            {onSortFilter && (
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
                    <Image src={avatarUrl} alt={displayName} width={32} height={32} className="object-cover" />
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

        {/* Search + active sort hint */}
        <div className="flex flex-col gap-1.5">
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

        </div>
      </div>
    </header>
  );
}
