"use client";

import {
  X,
  ArrowUpAZ, ArrowDownAZ,
  Clock, Star, Users,
  TrendingUp, TrendingDown, Paintbrush,
} from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { translateCategory, translateMechanic } from "@/lib/bgg-translations";
import { cn } from "@/lib/utils";
import type { LibrarySortKey } from "@/types";

interface SortOption {
  key: LibrarySortKey;
  label: string;
  icon: React.ReactNode;
}

const SORT_OPTIONS: SortOption[] = [
  { key: "name_asc",     label: "Name A → Z",      icon: <ArrowUpAZ   size={14} strokeWidth={2} /> },
  { key: "name_desc",    label: "Name Z → A",      icon: <ArrowDownAZ size={14} strokeWidth={2} /> },
  { key: "added_desc",   label: "Neueste zuerst",  icon: <Clock       size={14} strokeWidth={2} /> },
  { key: "added_asc",    label: "Älteste zuerst",  icon: <Clock       size={14} strokeWidth={2} /> },
  { key: "rating",       label: "Bewertung ↓",     icon: <Star        size={14} strokeWidth={2} /> },
  { key: "rating_asc",   label: "Bewertung ↑",     icon: <Star        size={14} strokeWidth={2} /> },
  { key: "plays_desc",   label: "Meist gespielt",  icon: <TrendingUp  size={14} strokeWidth={2} /> },
  { key: "plays_asc",    label: "Wenigst gespielt", icon: <TrendingDown size={14} strokeWidth={2} /> },
  { key: "players_asc",  label: "Wenigste Spieler", icon: <Users      size={14} strokeWidth={2} /> },
  { key: "players_desc", label: "Meiste Spieler",  icon: <Users       size={14} strokeWidth={2} /> },
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
  const { filter, setFilter, sortKey, setSortKey, tagLang, setTagLang } = useLibraryStore();
  const selectedCategories = filter.categories ?? [];
  const selectedMechanics = filter.mechanics ?? [];

  const tagFilterCount = selectedCategories.length + selectedMechanics.length;
  const isModified = sortKey !== "name_asc" || tagFilterCount > 0 || !!filter.customized;

  function toggleCustomized() {
    setFilter({ ...filter, customized: filter.customized ? undefined : true });
  }

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
    setFilter({ ...filter, categories: undefined, mechanics: undefined, customized: undefined });
  }

  const hasTagSections = availableCategories.length > 0 || availableMechanics.length > 0;

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
                  <span className="flex-shrink-0">{opt.icon}</span>
                  <span className="truncate">{opt.label}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Individualisiert filter */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
              Sonstiges
            </h3>
            <button
              onClick={toggleCustomized}
              className={cn(
                "flex items-center gap-2.5 w-full px-3 py-2.5 rounded-xl text-sm text-left transition-colors border",
                filter.customized
                  ? "bg-violet-500 text-white border-violet-500 font-semibold"
                  : "bg-muted/60 text-foreground border-transparent hover:bg-muted"
              )}
            >
              <Paintbrush size={14} className="flex-shrink-0" />
              <span>Nur individualisierte Spiele</span>
              {filter.customized && <span className="ml-auto text-[10px] bg-white/25 rounded-full px-1.5 py-0.5 font-bold">aktiv</span>}
            </button>
          </section>

          {/* Language toggle — only when tags are available */}
          {hasTagSections && (
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Tags
                </h3>
                <div className="flex items-center bg-muted rounded-lg p-0.5 gap-0.5">
                  <button
                    onClick={() => setTagLang("de")}
                    className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-md transition-all",
                      tagLang === "de"
                        ? "bg-white shadow-sm text-amber-600"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    DE
                  </button>
                  <button
                    onClick={() => setTagLang("en")}
                    className={cn(
                      "text-xs font-semibold px-2.5 py-1 rounded-md transition-all",
                      tagLang === "en"
                        ? "bg-white shadow-sm text-amber-600"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    EN
                  </button>
                </div>
              </div>
            </section>
          )}

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
                    {tagLang === "de" ? translateCategory(cat) : cat}
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
                    {tagLang === "de" ? translateMechanic(mech) : mech}
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
