import { useState } from "react";
import { FolderOpen } from "lucide-react";

const GLASS =
  "rounded-3xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

interface SetupScreenProps {
  onGranted: (path: string) => void;
}

/**
 * Welcome / setup screen when Home directory is not readable (e.g. macOS permission).
 * "Grant Access" opens the folder dialog; selected path is passed to onGranted.
 */
export function SetupScreen({ onGranted }: SetupScreenProps) {
  const [loading, setLoading] = useState(false);

  async function handleGrantAccess() {
    const api = window.electron;
    if (!api?.askForPermission) return;
    setLoading(true);
    try {
      const path = await api.askForPermission();
      if (path) onGranted(path);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className={`flex max-w-md flex-col items-center gap-6 px-8 py-10 ${GLASS}`}>
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/20">
          <FolderOpen className="h-7 w-7 text-amber-400/90" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-white">
            Nexus Needs Access
          </h1>
          <p className="mt-2 text-sm text-white/70">
            To visualize your system, Nexus needs permission to view your Home
            folder. Select your Home folder in the next dialog to continue.
          </p>
        </div>
        <button
          type="button"
          onClick={handleGrantAccess}
          disabled={loading}
          className="rounded-2xl border border-border-subtle bg-white/10 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/15 disabled:opacity-50 [-webkit-app-region:no-drag]"
        >
          {loading ? "Opening…" : "Grant Access"}
        </button>
      </div>
    </div>
  );
}
