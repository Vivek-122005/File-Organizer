import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ScanResult } from "./types/fileScanner";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { ControlBar } from "./components/ControlBar";
import { ExplorerView } from "./components/ExplorerView";
import { DiskVisualizer } from "./components/DiskVisualizer";
import { SetupScreen } from "./components/SetupScreen";
import { Dashboard } from "./components/Dashboard";
import { BinView } from "./components/BinView";
import { useFileStore } from "./stores/useFileStore";
import type { DiskVizNode } from "./types/diskViz";
import {
  Activity,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Gauge,
  HelpCircle,
  ImageIcon,
  Loader2,
  X,
} from "lucide-react";

const GLASS =
  "glass-surface rounded-3xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

function App() {
  const {
    currentPath,
    loadFavorites,
    favorites,
    navigateTo,
    performanceMode,
    setPerformanceMode,
  } = useFileStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"explorer" | "dashboard">("explorer");
  const [showBin, setShowBin] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [vizData, setVizData] = useState<DiskVizNode | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [permissionGateOpen, setPermissionGateOpen] = useState(true);
  const [perfPanelCollapsed, setPerfPanelCollapsed] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);
  const helpButtonRef = useRef<HTMLButtonElement | null>(null);

  type TourStep = {
    title: string;
    description: string;
    getTarget?: () => HTMLElement | null;
    onEnter?: () => void;
  };

  const byTour = (id: string): HTMLElement | null =>
    document.querySelector(`[data-tour="${id}"]`);

  const tourSteps = useMemo(
    (): TourStep[] => [
      {
        title: "Sidebar overview",
        description:
          "This sidebar is your command center: pinned favorites, system locations, and bin access.",
        getTarget: () => byTour("sidebar-root"),
        onEnter: () => {
          setShowBin(false);
          setActiveTab("explorer");
        },
      },
      {
        title: "Favorites (quick access)",
        description:
          "Pin folders for faster navigation. You can drag to reorder and right-click a favorite to remove it.",
        getTarget: () => byTour("sidebar-favorites"),
      },
      {
        title: "Locations",
        description:
          "These are default system paths like Home, Desktop, Downloads, and Music.",
        getTarget: () => byTour("sidebar-locations"),
      },
      {
        title: "Trash / Bin",
        description:
          "Deleted files are moved to Bin first, so you can restore or permanently delete later.",
        getTarget: () => byTour("sidebar-bin"),
      },
      {
        title: "Control bar navigation",
        description:
          "Use Back, Forward, Up and the search box to quickly navigate and filter the current folder.",
        getTarget: () => byTour("control-bar"),
        onEnter: () => {
          setShowBin(false);
          setActiveTab("explorer");
        },
      },
      {
        title: "Switch between views",
        description:
          "Use these tabs to switch between Files view and Auto Organize Summary dashboard.",
        getTarget: () => byTour("main-tabs"),
      },
      {
        title: "Explorer tools",
        description:
          "Toggle Grid/List view and sort by name, date modified, or size.",
        getTarget: () => byTour("explorer-toolbar"),
      },
      {
        title: "File explorer",
        description:
          "Single-click selects an item, double-click opens it. Right-click items to rename, trash, or favorite folders.",
        getTarget: () => byTour("explorer-content"),
      },
      {
        title: "Quick Look preview",
        description:
          "Select a file and press Space to open Quick Look. Great for fast preview of media and code.",
        getTarget: () => byTour("explorer-content"),
      },
      {
        title: "Disk usage map",
        description:
          "This chart shows how storage is distributed. Hover segments for details and click folder segments for deeper scans.",
        getTarget: () => byTour("disk-visualizer"),
      },
      {
        title: "Dashboard summary",
        description:
          "Now switching to the Auto Organize Summary tab where category cards show file distribution.",
        getTarget: () => byTour("dashboard-categories"),
        onEnter: () => {
          setShowBin(false);
          setActiveTab("dashboard");
        },
      },
      {
        title: "Category drill-down",
        description:
          "Click any category card to reveal the files table and open matching files directly.",
        getTarget: () => byTour("dashboard-root"),
      },
      {
        title: "Bin management",
        description:
          "Now switching to Bin view. Restore files, delete permanently, or empty the entire bin.",
        getTarget: () => byTour("bin-header"),
        onEnter: () => {
          setShowBin(true);
          setActiveTab("explorer");
        },
      },
      {
        title: "Help anytime",
        description:
          "Click this ? button whenever you need a quick refresher or want to replay the guided tour.",
        getTarget: () => helpButtonRef.current,
        onEnter: () => {
          setShowBin(false);
          setActiveTab("explorer");
        },
      },
    ],
    []
  );
  const [accessState, setAccessState] = useState<{
    checked: boolean;
    hasAccess: boolean;
  }>({ checked: false, hasAccess: false });
  const [perfStats, setPerfStats] = useState<{
    vizMs: number | null;
    dashboardMs: number | null;
    vizRunning: boolean;
    dashboardRunning: boolean;
    thumbnailLoaded: number;
    thumbnailTotal: number;
    thumbnailRunning: boolean;
  }>({
    vizMs: null,
    dashboardMs: null,
    vizRunning: false,
    dashboardRunning: false,
    thumbnailLoaded: 0,
    thumbnailTotal: 0,
    thumbnailRunning: false,
  });

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Exit bin view whenever the user navigates somewhere
  useEffect(() => {
    if (currentPath) setShowBin(false);
  }, [currentPath]);

  useEffect(() => {
    if (
      favorites.length === 0 ||
      !currentPath ||
      accessState.checked ||
      !window.electron?.checkAccess
    )
      return;
    window.electron.checkAccess(currentPath).then((ok) => {
      setAccessState({ checked: true, hasAccess: ok });
    });
  }, [favorites.length, currentPath, accessState.checked]);

  useEffect(() => {
    if (!currentPath || !window.electron?.scanDirectoryForViz) return;
    let cancelled = false;
    const delayMs = performanceMode ? 320 : 80;
    const scanDepth = performanceMode ? 1 : 2;

    const timer = window.setTimeout(() => {
      const vizStart = performance.now();
      setVizLoading(true);
      setVizData(null);
      setPerfStats((s) => ({ ...s, vizRunning: true }));
      window.electron
        .scanDirectoryForViz(currentPath, scanDepth)
        .then((data) => {
          if (!cancelled) setVizData(data);
        })
        .catch(() => {
          if (!cancelled) setVizData(null);
        })
        .finally(() => {
          if (cancelled) return;
          setVizLoading(false);
          setPerfStats((s) => ({
            ...s,
            vizRunning: false,
            vizMs: Math.round(performance.now() - vizStart),
          }));
        });

      if (activeTab === "dashboard" && window.electron?.scanDirectory) {
        const dashboardStart = performance.now();
        setScanLoading(true);
        setPerfStats((s) => ({ ...s, dashboardRunning: true }));
        window.electron
          .scanDirectory(currentPath, scanDepth)
          .then((result) => {
            if (!cancelled) setScanResult(result);
          })
          .catch(() => {
            if (!cancelled) setScanResult(null);
          })
          .finally(() => {
            if (cancelled) return;
            setScanLoading(false);
            setPerfStats((s) => ({
              ...s,
              dashboardRunning: false,
              dashboardMs: Math.round(performance.now() - dashboardStart),
            }));
          });
      }
    }, delayMs);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [currentPath, activeTab, performanceMode]);

  const handleDeepScan = (path: string) => {
    if (!window.electron?.scanDirectoryForViz) return;
    const api = window.electron;
    const vizStart = performance.now();
    setVizLoading(true);
    setVizData(null);
    setPerfStats((s) => ({ ...s, vizRunning: true }));
    const task = performanceMode
      ? api.scanDirectoryForViz(path, 3)
      : api.scanDirectoryForVizDeep
        ? api.scanDirectoryForVizDeep(path)
        : api.scanDirectoryForViz(path, 6);
    task
      .then(setVizData)
      .catch(() => setVizData(null))
      .finally(() => {
        setVizLoading(false);
        setPerfStats((s) => ({
          ...s,
          vizRunning: false,
          vizMs: Math.round(performance.now() - vizStart),
        }));
      });
  };

  const handleThumbnailProgress = useCallback(
    (progress: { loaded: number; total: number; running: boolean }) => {
      setPerfStats((s) => {
        if (
          s.thumbnailLoaded === progress.loaded &&
          s.thumbnailTotal === progress.total &&
          s.thumbnailRunning === progress.running
        ) {
          return s;
        }
        return {
          ...s,
          thumbnailLoaded: progress.loaded,
          thumbnailTotal: progress.total,
          thumbnailRunning: progress.running,
        };
      });
    },
    []
  );

  const handleGrantedAccess = (path: string) => {
    navigateTo(path);
    setAccessState((s) => ({ ...s, hasAccess: true }));
  };

  const thumbnailLoaded = Math.min(
    perfStats.thumbnailLoaded,
    perfStats.thumbnailTotal
  );
  const thumbnailPercent =
    perfStats.thumbnailTotal > 0
      ? Math.round((thumbnailLoaded / perfStats.thumbnailTotal) * 100)
      : 0;
  const loadLevel: "normal" | "medium" | "high" = (() => {
    if (
      perfStats.vizRunning ||
      perfStats.dashboardRunning ||
      (perfStats.thumbnailRunning && perfStats.thumbnailTotal > 180) ||
      (perfStats.vizMs ?? 0) > 1400 ||
      (perfStats.dashboardMs ?? 0) > 1700
    ) {
      return "high";
    }
    if (
      (perfStats.vizMs ?? 0) > 850 ||
      (perfStats.dashboardMs ?? 0) > 1100 ||
      (perfStats.thumbnailRunning && perfStats.thumbnailTotal > 60)
    ) {
      return "medium";
    }
    return "normal";
  })();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setHelpOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!tourOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTourOpen(false);
      if (e.key === "ArrowRight") {
        setTourStep((s) => Math.min(s + 1, tourSteps.length - 1));
      }
      if (e.key === "ArrowLeft") {
        setTourStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [tourOpen, tourSteps.length]);

  useEffect(() => {
    if (!tourOpen) return;
    tourSteps[tourStep]?.onEnter?.();
  }, [tourOpen, tourStep, tourSteps]);

  useEffect(() => {
    if (!tourOpen) {
      setTourTargetRect(null);
      return;
    }
    const updateRect = () => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const target = tourSteps[tourStep]?.getTarget?.();
          if (!target) {
            setTourTargetRect(null);
            return;
          }
          setTourTargetRect(target.getBoundingClientRect());
        });
      });
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [tourOpen, tourStep, tourSteps]);

  const startTour = () => {
    setHelpOpen(false);
    setShowBin(false);
    setActiveTab("explorer");
    setTourStep(0);
    setTourOpen(true);
  };

  if (favorites.length === 0) {
    return (
      <Layout sidebarContent={<Sidebar activeBin={showBin} onBinClick={() => setShowBin(true)} />}>
        <div className="flex flex-1 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      </Layout>
    );
  }

  if (permissionGateOpen || (accessState.checked && !accessState.hasAccess)) {
    return (
      <Layout sidebarContent={null}>
        <SetupScreen
          onGranted={(path) => {
            handleGrantedAccess(path);
            setPermissionGateOpen(false);
          }}
          onContinue={() => setPermissionGateOpen(false)}
          canContinue={accessState.checked && accessState.hasAccess}
          checkingAccess={!accessState.checked}
        />
      </Layout>
    );
  }

  return (
    <Layout sidebarContent={<Sidebar activeBin={showBin} onBinClick={() => setShowBin(true)} />}>
      {showBin ? (
        <div className="flex flex-col gap-4 p-6 h-full">
          <BinView />
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-6 h-full">
          <ControlBar
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            performanceMode={performanceMode}
            onTogglePerformanceMode={() => setPerformanceMode(!performanceMode)}
          />

          {/* Navigation Tabs */}
          <div
            data-tour="main-tabs"
            className="glass-surface flex items-center gap-1 rounded-2xl border border-border-subtle bg-secondary/80 p-1.5 backdrop-blur-glass w-fit"
          >
            <button
              onClick={() => setActiveTab("explorer")}
              className={`px-4 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === "explorer" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
            >
              Files
            </button>
            <button
              onClick={() => setActiveTab("dashboard")}
              className={`px-4 py-1.5 text-sm font-medium rounded-xl transition-all duration-200 ${activeTab === "dashboard" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
            >
              Auto Organize Summary
            </button>
          </div>
          <div className="glass-surface rounded-3xl border border-border-subtle bg-secondary/70 p-3 backdrop-blur-glass">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                    loadLevel === "high"
                      ? "border-red-400/40 bg-red-500/20 text-red-200"
                      : loadLevel === "medium"
                        ? "border-amber-400/40 bg-amber-500/20 text-amber-200"
                        : "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" />
                  Load {loadLevel}
                </span>
                <button
                  type="button"
                  onClick={() => setPerfPanelCollapsed((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-0.5 text-white/70 transition hover:bg-white/10 hover:text-white"
                >
                  {perfPanelCollapsed ? (
                    <>
                      <ChevronDown className="h-3.5 w-3.5" />
                      Expand
                    </>
                  ) : (
                    <>
                      <ChevronUp className="h-3.5 w-3.5" />
                      Minimize
                    </>
                  )}
                </button>
              </div>
              <span
                className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 ${
                  performanceMode
                    ? "border-cyan-300/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-white/5 text-white/70"
                }`}
              >
                <Gauge className="h-3 w-3" />
                Performance Mode {performanceMode ? "On" : "Off"}
              </span>
              <span className="text-white/45">
                {performanceMode
                  ? "Balanced for smoother navigation on large folders."
                  : "Full-detail scanning and aggressive thumbnails."}
              </span>
            </div>

            {!perfPanelCollapsed && (
            <div className="grid gap-2 text-[11px] text-white/70 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3 text-cyan-300" />
                    Viz scan
                  </span>
                  <span className="text-white/60">
                    {perfStats.vizRunning
                      ? "running…"
                      : perfStats.vizMs != null
                        ? `${perfStats.vizMs} ms`
                        : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      perfStats.vizRunning ? "w-3/4 animate-pulse bg-cyan-400" : "w-full bg-cyan-400/40"
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <Activity className="h-3 w-3 text-blue-300" />
                    Summary scan
                  </span>
                  <span className="text-white/60">
                    {activeTab !== "dashboard"
                      ? "inactive"
                      : perfStats.dashboardRunning
                        ? "running…"
                        : perfStats.dashboardMs != null
                          ? `${perfStats.dashboardMs} ms`
                          : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      activeTab === "dashboard" && perfStats.dashboardRunning
                        ? "w-3/4 animate-pulse bg-blue-400"
                        : "w-full bg-blue-400/30"
                    }`}
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="h-3 w-3 text-violet-300" />
                    Thumbnails
                  </span>
                  <span className="text-white/60">
                    {perfStats.thumbnailTotal > 0
                      ? `${thumbnailLoaded}/${perfStats.thumbnailTotal}`
                      : "—"}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10">
                  <div
                    className={`h-1.5 rounded-full transition-all ${
                      perfStats.thumbnailRunning
                        ? "bg-violet-400"
                        : "bg-violet-400/40"
                    }`}
                    style={{
                      width:
                        perfStats.thumbnailTotal > 0
                          ? `${Math.max(6, thumbnailPercent)}%`
                          : "0%",
                    }}
                  />
                </div>
              </div>
            </div>
            )}
          </div>

          <div className="flex min-h-0 flex-1 gap-4">
            {activeTab === "explorer" ? (
              <>
                <div className="flex min-w-0 flex-[7] flex-col overflow-auto">
                  <ExplorerView
                    searchQuery={searchQuery}
                    performanceMode={performanceMode}
                    onThumbnailProgress={handleThumbnailProgress}
                  />
                </div>
                <div className="flex min-w-0 flex-[3] flex-col overflow-hidden">
                  <div className={`flex min-h-[360px] flex-col ${GLASS} p-4`}>
                    <h2 className="mb-2 text-sm font-medium text-white/70">
                      Disk usage
                    </h2>
                    {vizLoading && (
                      <div className="flex flex-1 items-center justify-center gap-2">
                        <Loader2 className="h-5 w-5 animate-spin text-white/60" />
                        <span className="text-sm text-white/60">Building disk map…</span>
                      </div>
                    )}
                    {!vizLoading && vizData && (
                      <DiskVisualizer
                        data={vizData}
                        isLoading={false}
                        onDeepScan={handleDeepScan}
                      />
                    )}
                    {!vizLoading && !vizData && (
                      <p className="flex flex-1 items-center justify-center text-sm text-white/50">
                        No disk data
                      </p>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 overflow-auto w-full">
                <Dashboard
                  result={scanResult}
                  vizData={vizData}
                  vizLoading={vizLoading}
                  loading={scanLoading}
                  error={null}
                  directoryPath={currentPath}
                />
              </div>
            )}
          </div>
        </div>
      )}
      <button
        ref={helpButtonRef}
        type="button"
        onClick={() => setHelpOpen(true)}
        className="fixed bottom-6 right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-cyan-300/30 bg-cyan-500/20 text-cyan-100 shadow-[0_8px_24px_rgba(6,182,212,0.35)] backdrop-blur-glass transition duration-200 hover:scale-105 hover:bg-cyan-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        title="How to use this app"
        aria-label="Open help"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          onClick={() => setHelpOpen(false)}
        >
          <div
            className="glass-surface w-full max-w-2xl rounded-3xl border border-border-subtle bg-secondary/95 p-5 shadow-2xl backdrop-blur-glass"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-white">Welcome to Nexus</h2>
                <p className="mt-1 text-sm text-white/70">
                  A desktop file organizer and disk usage visualizer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="rounded-lg p-1.5 text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                aria-label="Close help"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-3 text-sm text-white/80 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <h3 className="mb-1 font-medium text-white">What you can do</h3>
                <ul className="space-y-1 text-white/70">
                  <li>- Browse files in grid or list view</li>
                  <li>- Search and sort current folder items</li>
                  <li>- Add frequent folders to Favorites</li>
                  <li>- Open Quick Look with the Space key</li>
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
                <h3 className="mb-1 font-medium text-white">Disk visualization</h3>
                <ul className="space-y-1 text-white/70">
                  <li>- Right panel shows folder size breakdown</li>
                  <li>- Hover segments to inspect file/folder size</li>
                  <li>- Click a folder segment for deeper scan</li>
                  <li>- Use Dashboard for category-wise summary</li>
                </ul>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-cyan-300/20 bg-cyan-500/10 p-3 text-xs text-cyan-100/90">
              Built for Operating Systems concepts: process separation (main/renderer), IPC communication, and worker-thread scanning for responsiveness.
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={startTour}
                className="rounded-2xl border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-sm font-medium text-cyan-100 transition duration-200 hover:bg-cyan-500/30 hover:-translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
              >
                Start guided walkthrough
              </button>
            </div>
          </div>
        </div>
      )}
      {tourOpen && (
        <div className="fixed inset-0 z-[70]">
          <div className="absolute inset-0 bg-black/65" />
          {tourTargetRect && (
            <div
              className="pointer-events-none fixed rounded-2xl border border-cyan-300/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.68),0_0_0_2px_rgba(34,211,238,0.5),0_0_30px_rgba(34,211,238,0.35)]"
              style={{
                top: tourTargetRect.top - 8,
                left: tourTargetRect.left - 8,
                width: tourTargetRect.width + 16,
                height: tourTargetRect.height + 16,
              }}
            />
          )}
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="w-full max-w-xl rounded-2xl border border-border-subtle bg-secondary/95 shadow-2xl backdrop-blur-glass">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <p className="text-[11px] font-semibold tracking-[0.16em] text-white/60">
                  STEP {tourStep + 1} OF {tourSteps.length}
                </p>
                <button
                  type="button"
                  onClick={() => setTourOpen(false)}
                  className="rounded-md p-1 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Close tour"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="px-5 py-4">
                <h3 className="text-xl font-semibold text-white">
                  {tourSteps[tourStep].title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-white/75">
                  {tourSteps[tourStep].description}
                </p>
              </div>
              <div className="flex items-center justify-between border-t border-white/10 px-5 py-3">
                <button
                  type="button"
                  onClick={() => setTourStep((s) => Math.max(0, s - 1))}
                  disabled={tourStep === 0}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/90 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Back
                </button>
                <div className="flex items-center gap-1.5">
                  {tourSteps.map((_, idx) => (
                    <span
                      key={idx}
                      className={`h-1.5 w-1.5 rounded-full ${idx === tourStep ? "bg-white" : "bg-white/30"}`}
                    />
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (tourStep === tourSteps.length - 1) {
                      setTourOpen(false);
                      return;
                    }
                    setTourStep((s) => Math.min(s + 1, tourSteps.length - 1));
                  }}
                  className="rounded-lg border border-cyan-300/40 bg-cyan-500/20 px-3 py-1.5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-500/30"
                >
                  {tourStep === tourSteps.length - 1 ? "Finish" : "Next"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

export default App;
