import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { DirEntry } from "../types/dirEntry";

export interface FavoriteItem {
  name: string;
  path: string;
}

export interface SidebarFavorite {
  id: string;
  name: string;
  path: string;
  icon: string;
}

export type ViewMode = "grid" | "list";

export type SortBy = "name" | "date" | "size";
export type SortOrder = "asc" | "desc";

export interface SortConfig {
  by: SortBy;
  order: SortOrder;
}

interface FileStore {
  currentPath: string | null;
  history: string[];
  future: string[];
  favorites: FavoriteItem[];
  sidebarFavorites: SidebarFavorite[];
  viewMode: ViewMode;
  sortConfig: SortConfig;
  selectedEntry: DirEntry | null;
  setCurrentPath: (path: string | null) => void;
  setFavorites: (items: FavoriteItem[]) => void;
  loadFavorites: () => Promise<void>;
  /** Navigate to path: push current to history, set path, clear future. */
  navigateTo: (path: string) => void;
  goBack: () => void;
  goForward: () => void;
  goUp: () => void;
  setViewMode: (mode: ViewMode) => void;
  setSortConfig: (config: SortConfig) => void;
  setSelectedEntry: (entry: DirEntry | null) => void;
  addFavorite: (path: string) => void;
  removeFavorite: (id: string) => void;
  reorderFavorites: (oldIndex: number, newIndex: number) => void;
}

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
  currentPath: null,
  history: [],
  future: [],
  favorites: [],
  sidebarFavorites: [],
   viewMode: "grid",
   sortConfig: { by: "name", order: "asc" },
  selectedEntry: null,

  setCurrentPath: (path) => set({ currentPath: path }),

  setFavorites: (items) => set({ favorites: items }),

  loadFavorites: async () => {
    const api = window.electron;
    if (!api?.getSystemPaths) return;
    const paths = await api.getSystemPaths();
    const items: FavoriteItem[] = [
      { name: "Home", path: paths.home },
      { name: "Desktop", path: paths.desktop },
      { name: "Downloads", path: paths.downloads },
      { name: "Music", path: paths.music },
    ];
    set({
      favorites: items,
      currentPath: paths.home,
      history: [],
      future: [],
    });
  },

  navigateTo: (path) => {
    set((s) => ({
      currentPath: path,
      history:
        s.currentPath != null && s.currentPath !== path
          ? [...s.history, s.currentPath]
          : s.history,
      future: [],
    }));
  },

  goBack: () => {
    const { history, currentPath } = get();
    if (history.length === 0 || currentPath == null) return;
    const prev = history[history.length - 1];
    set({
      currentPath: prev,
      history: history.slice(0, -1),
      future: [currentPath, ...get().future],
    });
  },

  goForward: () => {
    const { future, currentPath } = get();
    if (future.length === 0 || currentPath == null) return;
    const next = future[0];
    set({
      currentPath: next,
      history: [...get().history, currentPath],
      future: future.slice(1),
    });
  },

  goUp: () => {
    const api = window.electron;
    const { currentPath } = get();
    if (!currentPath || !api?.getParentPath) return;
    api.getParentPath(currentPath).then((parent) => {
      if (parent != null && parent !== currentPath) get().navigateTo(parent);
    });
  },

  setViewMode: (mode) => set({ viewMode: mode }),

  setSortConfig: (config) => set({ sortConfig: config }),

  setSelectedEntry: (entry) => set({ selectedEntry: entry }),

  addFavorite: (path) => {
    const existing = get().sidebarFavorites.find((f) => f.path === path);
    if (existing) return;
    const name = path.split(/[\\/]/).filter(Boolean).pop() ?? path;
    let icon = "folder";
    const lower = name.toLowerCase();
    if (lower.includes("download")) icon = "download";
    else if (lower.includes("music")) icon = "music";
    else if (lower.includes("desktop")) icon = "monitor";
    else if (lower.includes("doc")) icon = "file-text";
    else if (lower.includes("project")) icon = "folder-git-2";

    const id = `${name}-${Date.now()}`;
    set((s) => ({
      sidebarFavorites: [
        ...s.sidebarFavorites,
        { id, name, path, icon },
      ],
    }));
  },

  removeFavorite: (id) =>
    set((s) => ({
      sidebarFavorites: s.sidebarFavorites.filter((f) => f.id !== id),
    })),

  reorderFavorites: (oldIndex, newIndex) =>
    set((s) => {
      const list = [...s.sidebarFavorites];
      const [item] = list.splice(oldIndex, 1);
      list.splice(newIndex, 0, item);
      return { sidebarFavorites: list };
    }),
    }),
    {
      name: "nexus-file-store",
      partialize: (state) => ({
        sidebarFavorites: state.sidebarFavorites,
        viewMode: state.viewMode,
        sortConfig: state.sortConfig,
      }),
    }
  )
);
