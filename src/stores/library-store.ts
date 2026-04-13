import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { LibraryView, LibraryFilter, LibrarySortKey } from "@/types";

interface LibraryState {
  view: LibraryView;
  filter: LibraryFilter;
  sortKey: LibrarySortKey;
  setView: (view: LibraryView) => void;
  setFilter: (filter: LibraryFilter) => void;
  setSortKey: (key: LibrarySortKey) => void;
  resetFilter: () => void;
}

const defaultFilter: LibraryFilter = {};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      view: "grid",
      filter: defaultFilter,
      sortKey: "name_asc",
      setView: (view) => set({ view }),
      setFilter: (filter) => set({ filter }),
      setSortKey: (sortKey) => set({ sortKey }),
      resetFilter: () => set({ filter: defaultFilter }),
    }),
    {
      name: "meeplebase-library",
      partialize: (state) => ({ view: state.view, sortKey: state.sortKey }),
    }
  )
);
