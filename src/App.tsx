import { useEffect, useState } from "react";
import type { ScanResult } from "./types/fileScanner";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { ControlBar } from "./components/ControlBar";
import { ExplorerView } from "./components/ExplorerView";
import { DiskVisualizer } from "./components/DiskVisualizer";
import { SetupScreen } from "./components/SetupScreen";
import { Dashboard } from "./components/Dashboard";
import { useFileStore } from "./stores/useFileStore";
import type { DiskVizNode } from "./types/diskViz";
import { Loader2 } from "lucide-react";

const GLASS =
  "rounded-2xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

function App() {
  const { currentPath, loadFavorites, favorites, navigateTo } = useFileStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<"explorer" | "dashboard">("explorer");
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [scanLoading, setScanLoading] = useState(false);
  const [vizData, setVizData] = useState<DiskVizNode | null>(null);
  const [vizLoading, setVizLoading] = useState(false);
  const [accessState, setAccessState] = useState<{
    checked: boolean;
    hasAccess: boolean;
  }>({ checked: false, hasAccess: false });

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

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
    setVizLoading(true);
    setVizData(null);
    window.electron
      .scanDirectoryForViz(currentPath, 2)
      .then(setVizData)
      .catch(() => setVizData(null))
      .finally(() => setVizLoading(false));

    if (activeTab === "dashboard" && window.electron.scanDirectory) {
      setScanLoading(true);
      window.electron
        .scanDirectory(currentPath, 2) // shallow scan by default for Dashboard
        .then(setScanResult)
        .catch(() => setScanResult(null))
        .finally(() => setScanLoading(false));
    }
  }, [currentPath, activeTab]);

  const handleDeepScan = (path: string) => {
    if (!window.electron?.scanDirectoryForVizDeep) return;
    setVizLoading(true);
    setVizData(null);
    window.electron
      .scanDirectoryForVizDeep(path)
      .then(setVizData)
      .catch(() => setVizData(null))
      .finally(() => setVizLoading(false));
  };

  const handleGrantedAccess = (path: string) => {
    navigateTo(path);
    setAccessState((s) => ({ ...s, hasAccess: true }));
  };

  if (favorites.length === 0) {
    return (
      <Layout sidebarContent={<Sidebar />}>
        <div className="flex flex-1 items-center justify-center p-8">
          <Loader2 className="h-8 w-8 animate-spin text-white/50" />
        </div>
      </Layout>
    );
  }

  if (accessState.checked && !accessState.hasAccess) {
    return (
      <Layout sidebarContent={null}>
        <SetupScreen onGranted={handleGrantedAccess} />
      </Layout>
    );
  }

  return (
    <Layout sidebarContent={<Sidebar />}>
      <div className="flex flex-col gap-4 p-6 h-full">
        <ControlBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 rounded-xl border border-border-subtle bg-secondary/80 p-1 backdrop-blur-glass w-fit">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === "explorer" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
          >
            Files
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${activeTab === "dashboard" ? "bg-white/15 text-white shadow-sm" : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
          >
            Auto Organize Summary
          </button>
        </div>

        <div className="flex min-h-0 flex-1 gap-4">
          {activeTab === "explorer" ? (
            <>
              <div className="flex min-w-0 flex-[7] flex-col overflow-auto">
                <ExplorerView searchQuery={searchQuery} />
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
    </Layout>
  );
}

export default App;
