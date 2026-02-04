import { ChevronLeft, ChevronRight, ChevronUp, Search } from "lucide-react";
import { useFileStore } from "../stores/useFileStore";

const GLASS_BTN =
  "rounded-xl border border-border-subtle bg-secondary/80 p-2 text-white/90 backdrop-blur-glass transition hover:bg-white/10 hover:border-white/20 disabled:opacity-40 disabled:pointer-events-none [-webkit-app-region:no-drag]";

interface ControlBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
}

/**
 * Top bar: Back / Forward / Up, clickable breadcrumbs, search filter.
 */
export function ControlBar({ searchQuery, onSearchChange }: ControlBarProps) {
  const {
    currentPath,
    history,
    future,
    favorites,
    navigateTo,
    goBack,
    goForward,
    goUp,
  } = useFileStore();

  const canBack = history.length > 0;
  const canForward = future.length > 0;
  const canUp = currentPath != null && currentPath.length > 1;

  const segments: { label: string; path: string }[] = [];
  if (currentPath) {
    const normalized = currentPath.replace(/\\/g, "/");
    const matched = favorites.find((f) => {
      const p = f.path.replace(/\\/g, "/");
      return normalized === p || normalized.startsWith(p + "/");
    });
    if (matched) {
      const prefix = matched.path.replace(/\\/g, "/");
      const rest = normalized === prefix ? [] : normalized.slice(prefix.length).replace(/^\//, "").split("/").filter(Boolean);
      let acc = matched.path;
      segments.push({ label: matched.name, path: acc });
      for (const part of rest) {
        acc = acc.replace(/\\/g, "/") + "/" + part;
        segments.push({ label: part, path: acc });
      }
    } else {
      const parts = normalized.split("/").filter(Boolean);
      const sep = currentPath!.includes("\\") ? "\\" : "/";
      let acc = "";
      for (const part of parts) {
        acc = acc ? acc + sep + part : part;
        segments.push({ label: part, path: acc });
      }
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border-subtle bg-secondary/80 px-4 py-2.5 backdrop-blur-glass">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={goBack}
          disabled={!canBack}
          className={GLASS_BTN}
          title="Back"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goForward}
          disabled={!canForward}
          className={GLASS_BTN}
          title="Forward"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={goUp}
          disabled={!canUp}
          className={GLASS_BTN}
          title="Up"
        >
          <ChevronUp className="h-4 w-4" />
        </button>
      </div>

      <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
        {segments.map((seg, i) => (
          <span key={seg.path} className="flex items-center gap-1.5 overflow-hidden">
            {i > 0 && <span className="text-white/40">›</span>}
            <button
              type="button"
              onClick={() => navigateTo(seg.path)}
              className="truncate rounded-lg px-1.5 py-0.5 text-left text-xs font-medium text-white/90 transition hover:bg-white/10 hover:text-white [-webkit-app-region:no-drag]"
            >
              {seg.label}
            </button>
          </span>
        ))}
      </div>

      <div className="relative flex items-center">
        <Search className="absolute left-2.5 h-3.5 w-3.5 text-white/50" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter this folder…"
          className="w-44 rounded-xl border border-border-subtle bg-main/80 py-1.5 pl-8 pr-3 text-xs text-white placeholder:text-white/40 focus:border-white/30 focus:outline-none [-webkit-app-region:no-drag]"
        />
      </div>
    </div>
  );
}
