"use client";

import { X } from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { translateCategory, translateMechanic } from "@/lib/bgg-translations";
import { cn } from "@/lib/utils";
import type { LibrarySortKey } from "@/types";

const SORT_OPTIONS: { key: LibrarySortKey; label: string; icon: string }[] = [
  { key: "name_asc",     label: "Name A → Z",          icon: "🔤" },
  { key: "name_desc",    label: "Name Z → A",          icon: "🔤" },
  { key: "added_desc",   label: "Neueste zuerst",       icon: "🕐" },
  { key: "added_asc",    label: "Älteste zuerst",       icon: "🕐" },
  { key: "rating",       label: "Bewertung ↓",          icon: "⭐" },
  { key: "rating_asc",   label: "Bewertung ↑",          icon: "⭐" },
  { key: "plays_desc",   label: "Meist gespielt",       icon: "🎲" },
  { key: "plays_asc",    label: "Wenigst gespielt",     icon: "🎲" },
  { key: "players_asc",  label: "Wenigste Spieler",     icon: "👤" },
  { key: "players_desc", label: "Meiste Spieler",       icon: "👥" },
];

interface Props {
  availableCategories: string[];
  availableMechanics: string[];
  filteredCount: number;
  onClose: () => void;
}

export function LibrarySortFilterSheet({
  availableCategories,
  availableMechanics,
  filteredCount,
  onClose,
}: Props) {
  const { filter, setFilter, sortKey, setSortKey } = useLibraryStore();
  const selectedCategories = filter.categories ?? [];
  const selectedMechanics = filter.mechanics ?? [];

  const tagFilterCount = selectedCategories.length + selectedMechanics.length;
  const isModified = sortKey !== "name_asc" || tagFilterCount > 0;

  function toggleCategory(cat: string) {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    setFilter({ ...filter, categories: next.length ? next : undefined });
  }

  function toggleMechanic(mech: string) {
    const next = selectedMechanics.includes(mech)
      ? selectedMechanics.filter((m) => m !== mech)
      : [...selectedMechanics, mech];
    setFilter({ ...filter, mechanics: next.length ? next : undefined });
  }

  function resetAll() {
    setSortKey("name_asc");
    setFilter({ ...filter, categories: undefined, mechanics: undefined });
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "88dvh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <h2 className="font-display text-lg font-semibold">Sortierung & Filter</h2>
          <div className="flex items-center gap-2">
            {isModified && (
              <button
                onClick={resetAll}
                className="text-xs text-amber-600 font-medium px-2 py-1 rounded-lg hover:bg-amber-50 transition-colors"
              >
                Zurücksetzen
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6 pb-2">

          {/* Sort */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Sortierung
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {SORT_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-xl text-sm text-left transition-colors",
                    sortKey === opt.key
                      ? "bg-amber-500 text-white font-semibold"
                      : "bg-muted/60 text-foreground hover:bg-muted"
                  )}
                >
                  <span className="text-base leading-none">{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Categories */}
          {availableCategories.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Kategorien
                {selectedCategories.length > 0 && (
                  <span className="ml-2 bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {selectedCategories.length}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      selectedCategories.includes(cat)
                        ? "bg-amber-500 text-white border-amber-500"
                        : "bg-background text-foreground border-border hover:border-amber-300 hover:bg-amber-50"
                    )}
                  >
                    {translateCategory(cat)}
                  </button>
                ))}
              </div>
            </section>
          )}

          {/* Mechanics */}
          {availableMechanics.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Mechanismen
                {selectedMechanics.length > 0 && (
                  <span className="ml-2 bg-slate-700 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {selectedMechanics.length}
                  </span>
                )}
              </h3>
              <div className="flex flex-wrap gap-2">
                {availableMechanics.map((mech) => (
                  <button
                    key={mech}
                    onClick={() => toggleMechanic(mech)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-sm font-medium border transition-colors",
                      selectedMechanics.includes(mech)
                        ? "bg-slate-700 text-white border-slate-700"
                        : "bg-background text-foreground border-border hover:border-slate-400 hover:bg-slate-50"
                    )}
                  >
                    {translateMechanic(mech)}
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Sticky footer */}
        <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-background">
          <button
            onClick={onClose}
            className="w-full py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-sm transition-colors"
          >
            {filteredCount === 0
              ? "Keine Spiele gefunden"
              : `${filteredCount} ${filteredCount === 1 ? "Spiel" : "Spiele"} anzeigen`}
          </button>
        </div>
      </div>
    </>
  );
}
