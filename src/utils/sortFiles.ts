import type { DirEntry } from "../types/dirEntry";
import type { SortConfig } from "../stores/useFileStore";

function compareName(a: DirEntry, b: DirEntry) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
}

function compareDate(a: DirEntry, b: DirEntry) {
  const av = a.mtimeMs ?? 0;
  const bv = b.mtimeMs ?? 0;
  return av - bv;
}

function compareSize(a: DirEntry, b: DirEntry) {
  const av = a.size ?? 0;
  const bv = b.size ?? 0;
  return av - bv;
}

export function sortFiles(entries: DirEntry[], config: SortConfig): DirEntry[] {
  const items = [...entries];
  items.sort((a, b) => {
    // Keep folders grouped before files, Finder-style
    if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;

    let cmp = 0;
    if (config.by === "name") cmp = compareName(a, b);
    else if (config.by === "date") cmp = compareDate(a, b);
    else if (config.by === "size") cmp = compareSize(a, b);

    return config.order === "asc" ? cmp : -cmp;
  });
  return items;
}

