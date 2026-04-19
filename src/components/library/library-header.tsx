"use client";

import Link from "next/link";
import Image from "next/image";
import { Search, LayoutGrid, List, SlidersHorizontal, Plus, ArrowUpAZ, ArrowDownAZ, ArrowUp01, ArrowDown01, Calendar, Star, Dices } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLibraryStore } from "@/stores/library-store";
import { cn } from "@/lib/utils";
import type { Profile, LibrarySortKey } from "@/types";
import type { User } from "@supabase/supabase-js";
import { useState, useRef, useEffect } from "react";

interface LibraryHeaderProps {
  user?: User | null;
  profile?: Profile | null;
  onAddGame?: () => void;
}

const SORT_OPTIONS: { key: LibrarySortKey; label: string; icon: React.ReactNode }[] = [
  { key: "name_asc",     label: "Name A → Z",        icon: <ArrowUpAZ size={14} /> },
  { key: "name_desc",    label: "Name Z → A",        icon: <ArrowDownAZ size={14} /> },
  { key: "added_desc",   label: "Neueste zuerst",     icon: <Calendar size={14} /> },
  { key: "added_asc",    label: "Älteste zuerst",     icon: <Calendar size={14} /> },
  { key: "players_asc",  label: "Spieler ↑ (wenige)",  icon: <ArrowUp01 size={14} /> },
  { key: "players_desc", label: "Spieler ↓ (viele)",   icon: <ArrowDown01 size={14} /> },
  { key: "rating",       label: "Bewertung ↓ (beste)",   icon: <Star size={14} /> },
  { key: "rating_asc",   label: "Bewertung ↑ (schlechte)", icon: <Star size={14} /> },
  { key: "plays_desc",   label: "Meist gespielt",          icon: <Dices size={14} /> },
  { key: "plays_asc",    label: "Wenigst gespielt",        icon: <Dices size={14} /> },
];

export function LibraryHeader({ user, profile, onAddGame }: LibraryHeaderProps) {
  const { view, setView, filter, setFilter, sortKey, setSortKey } = useLibraryStore();
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  const displayName = profile?.display_name ?? profile?.username ?? user?.email?.split("@")[0] ?? "";
  const avatarUrl = profile?.avatar_url ?? user?.user_metadata?.avatar_url;
  const initial = displayName[0]?.toUpperCase() ?? "?";

  // Close dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    }
    if (sortOpen) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [sortOpen]);

  const currentSort = SORT_OPTIONS.find((o) => o.key === sortKey);

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

            {/* Sort dropdown */}
            <div className="relative" ref={sortRef}>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Sortierung"
                onClick={() => setSortOpen((o) => !o)}
                className={cn(sortKey !== "name_asc" && "text-amber-500")}
              >
                <SlidersHorizontal size={16} strokeWidth={2} />
              </Button>

              {sortOpen && (
                <div className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-zinc-900 border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide px-3 pt-3 pb-1.5">
                    Sortierung
                  </p>
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => { setSortKey(opt.key); setSortOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-left transition-colors",
                        sortKey === opt.key
                          ? "bg-amber-50 text-amber-700 font-medium"
                          : "hover:bg-muted text-foreground"
                      )}
                    >
                      <span className="text-muted-foreground">{opt.icon}</span>
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

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

          {sortKey !== "name_asc" && (
            <p className="text-[11px] text-amber-600 font-medium px-1">
              Sortiert nach: {currentSort?.label}
            </p>
          )}
        </div>
      </div>
    </header>
  );
}
