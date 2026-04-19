"use client";

import { X } from "lucide-react";
import { useLibraryStore } from "@/stores/library-store";
import { translateCategory, translateMechanic } from "@/lib/bgg-translations";
import { cn } from "@/lib/utils";

interface LibraryFilterSheetProps {
  availableCategories: string[];
  availableMechanics: string[];
  onClose: () => void;
}

export function LibraryFilterSheet({
  availableCategories,
  availableMechanics,
  onClose,
}: LibraryFilterSheetProps) {
  const { filter, setFilter } = useLibraryStore();
  const selectedCategories = filter.categories ?? [];
  const selectedMechanics = filter.mechanics ?? [];

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

  const totalActive = selectedCategories.length + selectedMechanics.length;

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="fixed bottom-0 left-0 right-0 z-50 bg-background rounded-t-3xl shadow-2xl flex flex-col"
        style={{ maxHeight: "80dvh" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-lg font-semibold">Filter</h2>
            {totalActive > 0 && (
              <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                {totalActive}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {totalActive > 0 && (
              <button
                onClick={() =>
                  setFilter({ ...filter, categories: undefined, mechanics: undefined })
                }
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

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
          {availableCategories.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Kategorien
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

          {availableMechanics.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2.5">
                Mechanismen
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
      </div>
    </>
  );
}
