import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryView, LibraryFilter, LibrarySortKey } from "@/types";

interface LibraryState {
  view: LibraryView;
  filter: LibraryFilter;
  sortKey: LibrarySortKey;
  tagLang: "de" | "en";
  setView: (view: LibraryView) => void;
  setFilter: (filter: LibraryFilter) => void;
  setSortKey: (key: LibrarySortKey) => void;
  setTagLang: (lang: "de" | "en") => void;
  resetFilter: () => void;
}

const defaultFilter: LibraryFilter = {};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      view: "grid",
      filter: defaultFilter,
      sortKey: "name_asc",
      tagLang: "de",
      setView: (view) => set({ view }),
      setFilter: (filter) => set({ filter }),
      setSortKey: (sortKey) => set({ sortKey }),
      setTagLang: (tagLang) => set({ tagLang }),
      resetFilter: () => set({ filter: defaultFilter }),
    }),
    {
      name: "meeplebase-library",
      partialize: (state) => ({ view: state.view, sortKey: state.sortKey, tagLang: state.tagLang }),
    }
  )
);
