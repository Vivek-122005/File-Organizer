import { useFileStore } from "../stores/useFileStore";

/**
 * Breadcrumb path bar: e.g. "Home > Documents > Projects".
 * Uses favorite names where the path matches; otherwise shows segment names.
 */
export function PathBar() {
  const { currentPath, favorites } = useFileStore();

  if (!currentPath) return null;

  const segments: string[] = [];
  const normalized = currentPath.replace(/\\/g, "/");
  let remaining = normalized;

  const matched = favorites.find((f) => {
    const p = f.path.replace(/\\/g, "/");
    return remaining === p || remaining.startsWith(p + "/");
  });
  if (matched) {
    segments.push(matched.name);
    const prefix = matched.path.replace(/\\/g, "/");
    const rest = remaining === prefix ? "" : remaining.slice(prefix.length).replace(/^\//, "");
    if (rest) segments.push(...rest.split("/").filter(Boolean));
  } else {
    segments.push(...normalized.split("/").filter(Boolean));
  }

  return (
    <div className="flex items-center gap-1.5 truncate rounded-xl border border-border-subtle bg-secondary/60 px-3 py-2 text-xs backdrop-blur-sm">
      {segments.map((label, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-white/40">›</span>}
          <span className="truncate text-white/90">{label}</span>
        </span>
      ))}
    </div>
  );
}
