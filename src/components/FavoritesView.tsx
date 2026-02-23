import { useEffect, useState } from "react";
import { useFileStore, type SidebarFavorite } from "../stores/useFileStore";
import { Folder, Trash2 } from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";

interface FavoritesEntry extends SidebarFavorite {
  exists?: boolean;
}

export function FavoritesView() {
  const { sidebarFavorites, navigateTo, removeFavoriteByPath } = useFileStore();
  const { addToast } = useToast();
  const [entries, setEntries] = useState<FavoritesEntry[]>([]);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    item: FavoritesEntry | null;
    isLoading: boolean;
  }>({ open: false, item: null, isLoading: false });

  // Check which favorites still exist
  useEffect(() => {
    const checkExists = async () => {
      const checked = await Promise.all(
        sidebarFavorites.map(async (fav) => {
          const exists = await window.electron?.checkAccess(fav.path);
          return { ...fav, exists };
        })
      );
      setEntries(checked);
    };

    checkExists();
  }, [sidebarFavorites]);

  const handleDelete = async () => {
    const item = deleteDialog.item;
    if (!item) return;

    setDeleteDialog((s) => ({ ...s, isLoading: true }));
    try {
      removeFavoriteByPath(item.path);
      addToast(`Removed "${item.name}" from favorites`, "success");
      setDeleteDialog({ open: false, item: null, isLoading: false });
    } catch (err) {
      addToast("Failed to remove favorite", "error");
    } finally {
      setDeleteDialog((s) => ({ ...s, isLoading: false }));
    }
  };

  if (sidebarFavorites.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 mb-4">
          <Folder className="h-8 w-8 text-white/40" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">No Favorites Yet</h2>
        <p className="text-sm text-white/60 max-w-xs">
          Right-click on any folder to add it to your favorites for quick access.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      <div className="flex items-center gap-2 px-6 pt-6">
        <Folder className="h-5 w-5 text-white/70" />
        <h1 className="text-xl font-semibold text-white">Favorites</h1>
        <span className="text-xs text-white/50 ml-auto">
          {entries.length} item{entries.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="grid gap-2">
          {entries.map((item) => (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-secondary/40 p-3 hover:bg-secondary/60 transition"
            >
              <button
                type="button"
                onClick={() => navigateTo(item.path)}
                disabled={!item.exists}
                className="flex flex-1 items-center gap-3 text-left min-w-0 [-webkit-app-region:no-drag]"
              >
                <Folder className="h-5 w-5 shrink-0 text-amber-400/70" />
                <div className="min-w-0">
                  <p
                    className={`text-sm font-medium truncate ${
                      item.exists ? "text-white" : "text-white/50"
                    }`}
                  >
                    {item.name}
                  </p>
                  <p className="text-xs text-white/50 truncate">{item.path}</p>
                </div>
              </button>

              {!item.exists && (
                <span className="text-[10px] text-red-400/80 px-2 py-1 rounded-lg bg-red-500/10 whitespace-nowrap">
                  Missing
                </span>
              )}

              <button
                type="button"
                onClick={() =>
                  setDeleteDialog({
                    open: true,
                    item,
                    isLoading: false,
                  })
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition opacity-0 group-hover:opacity-100 [-webkit-app-region:no-drag]"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <ConfirmDialog
        open={deleteDialog.open}
        title="Remove from Favorites?"
        message="This will remove the folder from your favorites. You can still access it through Locations."
        itemName={deleteDialog.item?.name}
        isLoading={deleteDialog.isLoading}
        onConfirm={handleDelete}
        onCancel={() =>
          setDeleteDialog({ open: false, item: null, isLoading: false })
        }
      />
    </div>
  );
}
