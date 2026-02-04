import { useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { Sidebar } from "./components/Sidebar";
import { ControlBar } from "./components/ControlBar";
import { ExplorerView } from "./components/ExplorerView";
import { DiskVisualizer } from "./components/DiskVisualizer";
import { SetupScreen } from "./components/SetupScreen";
import { useFileStore } from "./stores/useFileStore";
import type { DiskVizNode } from "./types/diskViz";
import { Loader2 } from "lucide-react";

const GLASS =
  "rounded-3xl border border-border-subtle bg-secondary/80 backdrop-blur-glass";

function App() {
  const { currentPath, loadFavorites, favorites, navigateTo } = useFileStore();
  const [searchQuery, setSearchQuery] = useState("");
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
  }, [currentPath]);

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
      <div className="flex flex-col gap-4 p-6">
        <ControlBar searchQuery={searchQuery} onSearchChange={setSearchQuery} />
        <div className="flex min-h-0 flex-1 gap-4">
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
        </div>
      </div>
    </Layout>
  );
}

export default App;
