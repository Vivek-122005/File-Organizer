import { useState } from "react";
import { ShieldAlert } from "lucide-react";

const GLASS =
  "rounded-3xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

interface SetupScreenProps {
  onGranted: (path: string) => void;
  onContinue?: () => void;
  canContinue?: boolean;
  checkingAccess?: boolean;
}

/**
 * Welcome / setup screen when Home directory is not readable (e.g. macOS permission).
 * "Grant Access" opens the folder dialog; selected path is passed to onGranted.
 */
export function SetupScreen({
  onGranted,
  onContinue,
  canContinue = false,
  checkingAccess = false,
}: SetupScreenProps) {
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");

  async function handleOpenFullDiskAccess() {
    const api = window.electron;
    if (!api?.openFullDiskAccessSettings) return;
    const opened = await api.openFullDiskAccessSettings();
    if (!opened) {
      setStatusMessage(
        "Unable to open System Settings automatically. Open Privacy & Security > Full Disk Access manually."
      );
      return;
    }
    setStatusMessage(
      "System Settings opened. Enable access for this app, then click 'I granted access'."
    );
  }

  async function handleRetryAccess() {
    const api = window.electron;
    if (!api?.getSystemPaths || !api?.checkAccess) return;
    setLoading(true);
    setStatusMessage("");
    try {
      const paths = await api.getSystemPaths();
      const hasHomeAccess = await api.checkAccess(paths.home);
      if (hasHomeAccess) {
        onGranted(paths.home);
        return;
      }
      setStatusMessage(
        "Access still not granted. Please enable Full Disk Access and try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center p-8">
      <div className={`flex max-w-sm flex-col items-center gap-5 px-7 py-8 ${GLASS}`}>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/15">
          <ShieldAlert className="h-6 w-6 text-amber-300/90" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-semibold text-white">Permission Required</h1>
          <p className="mt-2 text-sm text-white/70">
            Please allow Full Disk Access in System Settings to use Nexus.
          </p>
          {checkingAccess && (
            <p className="mt-2 text-xs text-white/50">Checking current permission status…</p>
          )}
        </div>
        <div className="flex w-full flex-col gap-2.5">
          <button
            type="button"
            onClick={handleOpenFullDiskAccess}
            className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-500/12 px-6 py-3 text-sm font-medium text-amber-200 transition hover:bg-amber-500/18 [-webkit-app-region:no-drag]"
          >
            Open Full Disk Access
          </button>
          <button
            type="button"
            onClick={() => {
              if (canContinue && onContinue) {
                onContinue();
                return;
              }
              void handleRetryAccess();
            }}
            disabled={loading || checkingAccess}
            className="rounded-2xl border border-border-subtle bg-white/8 px-6 py-3 text-sm font-medium text-white transition hover:bg-white/12 disabled:opacity-50 [-webkit-app-region:no-drag]"
          >
            {loading || checkingAccess
              ? "Checking…"
              : canContinue
                ? "Continue"
                : "I've Enabled Access"}
          </button>
        </div>
        {statusMessage && (
          <p className="text-center text-[11px] text-amber-200/90">{statusMessage}</p>
        )}
      </div>
    </div>
  );
}
