import { useEffect, useState, useMemo } from "react";
import {
  Folder,
  FileImage,
  FileCode,
  FileMusic,
  FileVideo,
  FileText,
  FileArchive,
  File,
  LayoutGrid,
  List as ListIcon,
  ArrowUpNarrowWide,
} from "lucide-react";
import { useFileStore } from "../stores/useFileStore";
import type { DirEntry } from "../types/dirEntry";
import { sortFiles } from "../utils/sortFiles";
import type { SortConfig } from "../stores/useFileStore";
import { QuickLook } from "./QuickLook";

const FILE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  code: FileCode,
  music: FileMusic,
  video: FileVideo,
  doc: FileText,
  archive: FileArchive,
};

function getFileIcon(name: string): React.ComponentType<{ className?: string }> {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const image = ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
  const code = ["js", "ts", "tsx", "jsx", "py", "html", "css", "json"].includes(ext);
  const music = ["mp3", "wav", "m4a", "flac"].includes(ext);
  const video = ["mp4", "mov", "webm", "avi"].includes(ext);
  const doc = ["pdf", "doc", "docx", "txt", "md"].includes(ext);
  const archive = ["zip", "tar", "gz", "rar"].includes(ext);
  if (image) return FILE_ICONS.image;
  if (code) return FILE_ICONS.code;
  if (music) return FILE_ICONS.music;
  if (video) return FILE_ICONS.video;
  if (doc) return FILE_ICONS.doc;
  if (archive) return FILE_ICONS.archive;
  return File;
}

interface ExplorerViewProps {
  searchQuery: string;
}

interface ContextMenuState {
  x: number;
  y: number;
  entry: DirEntry | null;
  open: boolean;
}

/**
 * Finder-style grid: folders and files. Single click = select (glow).
 * Double click folder = navigate; double click file = open with system app.
 */
export function ExplorerView({ searchQuery }: ExplorerViewProps) {
  const {
    currentPath,
    navigateTo,
    viewMode,
    sortConfig,
    setViewMode,
    setSortConfig,
    selectedEntry,
    setSelectedEntry,
    addFavorite,
  } = useFileStore();
  const [entries, setEntries] = useState<DirEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    entry: null,
    open: false,
  });
  const [quickLookOpen, setQuickLookOpen] = useState(false);

  useEffect(() => {
    if (!currentPath || !window.electron?.listDirectory) return;
    setLoading(true);
    window.electron
      .listDirectory(currentPath)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, [currentPath]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.trim().toLowerCase();
    return entries.filter((e) => e.name.toLowerCase().includes(q));
  }, [entries, searchQuery]);

  const sorted = useMemo(
    () => sortFiles(filtered, sortConfig as SortConfig),
    [filtered, sortConfig]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.code === "Space") {
        if (selectedEntry && !selectedEntry.isDirectory) {
          e.preventDefault();
          setQuickLookOpen((open) => !open);
        }
      } else if (e.code === "Escape") {
        if (quickLookOpen) {
          e.preventDefault();
          setQuickLookOpen(false);
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedEntry, quickLookOpen]);

  const handleDoubleClick = (entry: DirEntry) => {
    if (entry.isDirectory) {
      navigateTo(entry.path);
    } else {
      window.electron?.openPath(entry.path);
    }
  };

  const formatDate = (ms?: number) => {
    if (!ms) return "—";
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(ms);
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "—";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  if (!currentPath) return null;

  if (loading) {
    return (
      <div className="flex h-full min-h-[320px] items-center justify-center rounded-2xl border border-border-subtle bg-secondary/60">
        <p className="text-sm text-white/60">Loading…</p>
      </div>
    );
  }

  const isImageFile = (name: string) =>
    ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(
      name.split(".").pop()?.toLowerCase() ?? ""
    );

  const renderGrid = () => (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {sorted.map((entry) => {
        const isSelected = selectedEntry?.path === entry.path;
        const Icon = entry.isDirectory ? Folder : getFileIcon(entry.name);
        return (
          <button
            key={entry.path}
            type="button"
            onClick={() => setSelectedEntry(entry)}
            onDoubleClick={() => handleDoubleClick(entry)}
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({
                x: e.clientX,
                y: e.clientY,
                entry,
                open: true,
              });
            }}
            className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition [-webkit-app-region:no-drag] ${
              entry.isDirectory
                ? "border-border-subtle bg-secondary/60 hover:bg-secondary/80"
                : "border-border-subtle bg-secondary/40 hover:bg-secondary/60"
            } ${isSelected ? "border-white/30 bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.15)]" : ""}`}
          >
            <div
              className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
                entry.isDirectory ? "bg-amber-500/20" : "bg-white/5"
              }`}
            >
              {isImageFile(entry.name) && !entry.isDirectory ? (
                <img
                  src={`media://${encodeURIComponent(entry.path)}`}
                  alt={entry.name}
                  className="h-12 w-12 rounded-xl object-cover"
                />
              ) : (
                <Icon className="h-6 w-6 text-white/90" />
              )}
            </div>
            <span className="max-w-full truncate text-xs font-medium text-white/90">
              {entry.name}
            </span>
          </button>
        );
      })}
    </div>
  );

  const renderList = () => (
    <div className="overflow-auto rounded-2xl border border-border-subtle bg-secondary/60">
      <table className="min-w-full text-left text-xs text-white/80">
        <thead className="bg-secondary/80">
          <tr>
            <th className="px-4 py-2 font-medium">Name</th>
            <th className="px-4 py-2 font-medium">Date Modified</th>
            <th className="px-4 py-2 font-medium">Kind</th>
            <th className="px-4 py-2 font-medium text-right">Size</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const isSelected = selectedEntry?.path === entry.path;
            const Icon = entry.isDirectory ? Folder : getFileIcon(entry.name);
            const typeLabel = entry.isDirectory
              ? "Folder"
              : getFileIcon(entry.name) === FileImage
              ? "Image"
              : getFileIcon(entry.name) === FileCode
              ? "Code"
              : getFileIcon(entry.name) === FileMusic
              ? "Music"
              : getFileIcon(entry.name) === FileVideo
              ? "Video"
              : getFileIcon(entry.name) === FileArchive
              ? "Archive"
              : "File";
            return (
              <tr
                key={entry.path}
                onClick={() => setSelectedEntry(entry)}
                onDoubleClick={() => handleDoubleClick(entry)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  setContextMenu({
                    x: e.clientX,
                    y: e.clientY,
                    entry,
                    open: true,
                  });
                }}
                className={`cursor-default border-t border-white/5 align-middle transition [-webkit-app-region:no-drag] ${
                  idx % 2 === 0 ? "bg-white/0" : "bg-white/5"
                } ${
                  isSelected
                    ? "bg-white/10 shadow-[0_0_0_1px_rgba(255,255,255,0.2)]"
                    : "hover:bg-white/10"
                }`}
              >
                <td className="max-w-[260px] px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 shrink-0 text-white/80" />
                    <span className="truncate">{entry.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2 text-white/60">
                  {formatDate(entry.mtimeMs)}
                </td>
                <td className="px-4 py-2 text-white/60">{typeLabel}</td>
                <td className="px-4 py-2 text-right text-white/60">
                  {!entry.isDirectory ? formatSize(entry.size) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );

  const handleSortChange = (value: "name-asc" | "date-desc" | "size-desc") => {
    const next: SortConfig =
      value === "name-asc"
        ? { by: "name", order: "asc" }
        : value === "date-desc"
        ? { by: "date", order: "desc" }
        : { by: "size", order: "desc" };
    setSortConfig(next);
  };

  const sortValue =
    sortConfig.by === "name"
      ? "name-asc"
      : sortConfig.by === "date"
      ? "date-desc"
      : "size-desc";

  return (
    <div
      className="flex h-full flex-col gap-3"
      onClick={() =>
        contextMenu.open && setContextMenu((s) => ({ ...s, open: false }))
      }
    >
      <div className="flex items-center justify-between text-xs text-white/70">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setViewMode("grid")}
            className={`flex items-center gap-1 rounded-xl px-2 py-1 [-webkit-app-region:no-drag] ${
              viewMode === "grid"
                ? "bg-white/15 text-white"
                : "bg-secondary/70 text-white/70 hover:bg-white/5"
            }`}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Grid</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("list")}
            className={`flex items-center gap-1 rounded-xl px-2 py-1 [-webkit-app-region:no-drag] ${
              viewMode === "list"
                ? "bg-white/15 text-white"
                : "bg-secondary/70 text-white/70 hover:bg-white/5"
            }`}
          >
            <ListIcon className="h-3.5 w-3.5" />
            <span>List</span>
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowUpNarrowWide className="h-3.5 w-3.5 text-white/50" />
          <select
            value={sortValue}
            onChange={(e) =>
              handleSortChange(
                e.target.value as "name-asc" | "date-desc" | "size-desc"
              )
            }
            className="rounded-xl border border-border-subtle bg-secondary/80 px-2 py-1 text-xs text-white/80 focus:border-white/30 focus:outline-none [-webkit-app-region:no-drag]"
          >
            <option value="name-asc">Name (A–Z)</option>
            <option value="date-desc">Date Modified (Newest)</option>
            <option value="size-desc">Size (Largest)</option>
          </select>
        </div>
      </div>
      {viewMode === "grid" ? renderGrid() : renderList()}
      {contextMenu.open && contextMenu.entry && (
        <div
          className="fixed z-50 min-w-[140px] rounded-xl border border-border-subtle bg-secondary/90 py-1 text-xs text-white shadow-lg backdrop-blur-md"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="block w-full px-3 py-1.5 text-left hover:bg-white/10"
            onClick={() => {
              const entry = contextMenu.entry;
              if (entry?.isDirectory) {
                addFavorite(entry.path);
              }
              setContextMenu((s) => ({ ...s, open: false }));
            }}
          >
            Add to Favorites
          </button>
        </div>
      )}
      <QuickLook
        open={quickLookOpen}
        entry={selectedEntry}
        onClose={() => setQuickLookOpen(false)}
      />
    </div>
  );
}
