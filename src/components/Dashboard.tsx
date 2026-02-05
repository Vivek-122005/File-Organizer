import {
  Archive,
  Code2,
  FileText,
  Film,
  Folder,
  Image as ImageIcon,
  Loader2,
  Music,
} from "lucide-react";
import type { ScanResult } from "../types/fileScanner";
import type { DiskVizNode } from "../types/diskViz";
import { DiskVisualizer } from "./DiskVisualizer";

const GLASS_CLASS =
  "rounded-3xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Image: ImageIcon,
  Doc: FileText,
  Code: Code2,
  Audio: Music,
  Video: Film,
  Archive: Archive,
  Other: Folder,
};

interface DashboardProps {
  result: ScanResult | null;
  vizData: DiskVizNode | null;
  vizLoading: boolean;
  loading: boolean;
  error: string | null;
  directoryPath: string | null;
}

/**
 * Main dashboard: Total Files card and category breakdown in a grid layout.
 * Uses glassmorphism and rounded-3xl for the macOS 2026 look.
 */
export function Dashboard({
  result,
  vizData,
  vizLoading,
  loading,
  error,
  directoryPath,
}: DashboardProps) {
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className={`flex flex-col items-center gap-4 ${GLASS_CLASS} px-12 py-10`}
        >
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
          <p className="text-sm text-white/70">Scanning directory…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className={`flex flex-col items-center gap-2 ${GLASS_CLASS} px-10 py-8`}
        >
          <p className="text-sm font-medium text-red-400">Error</p>
          <p className="max-w-md text-center text-sm text-white/70">{error}</p>
        </div>
      </div>
    );
  }

  if (!directoryPath) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className={`flex flex-col items-center gap-2 ${GLASS_CLASS} px-10 py-8`}
        >
          <Folder className="h-12 w-12 text-white/50" />
          <p className="text-sm text-white/70">
            Select a folder in the sidebar to scan
          </p>
        </div>
      </div>
    );
  }

  if (!result || result.totalCount === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div
          className={`flex flex-col items-center gap-2 ${GLASS_CLASS} px-10 py-8`}
        >
          <FileText className="h-12 w-12 text-white/50" />
          <p className="text-sm text-white/70">No files found in this folder</p>
        </div>
      </div>
    );
  }

  const categories = Object.entries(result.byCategory).sort(
    ([, a], [, b]) => b.length - a.length
  );

  return (
    <div>
      <div className="mb-2 truncate text-xs text-white/50" title={directoryPath}>
        {directoryPath}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className={`flex flex-col justify-between p-6 sm:col-span-2 lg:col-span-1 ${GLASS_CLASS}`}
        >
          <span className="text-sm font-medium text-white/70">
            Total Files
          </span>
          <span className="mt-2 text-4xl font-semibold tracking-tight">
            {result.totalCount}
          </span>
        </div>
        {categories.map(([category, files]) => {
          const Icon = CATEGORY_ICONS[category] ?? Folder;
          return (
            <div
              key={category}
              className={`flex items-center gap-4 p-5 ${GLASS_CLASS}`}
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/5 border border-border-subtle">
                <Icon className="h-5 w-5 text-white/80" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-white">{category}</p>
                <p className="text-sm text-white/60">
                  {files.length} file{files.length !== 1 ? "s" : ""}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-6">
        <h2 className="mb-3 text-sm font-medium text-white/70">
          Disk usage
        </h2>
        {vizLoading && (
          <div className={`flex items-center justify-center gap-2 ${GLASS_CLASS} py-8`}>
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
            <span className="text-sm text-white/60">Building disk map…</span>
          </div>
        )}
        {!vizLoading && (
          <DiskVisualizer data={vizData} isLoading={vizLoading} />
        )}
      </div>
    </div>
  );
}
