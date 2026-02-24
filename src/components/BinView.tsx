import { useEffect, useState, useCallback } from "react";
import {
  Trash2,
  RotateCcw,
  XCircle,
  Folder,
  FileText,
} from "lucide-react";
import { ConfirmDialog } from "./ConfirmDialog";
import { useToast } from "./Toast";
import type { TrashItem } from "../vite-env";

export function BinView() {
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { addToast } = useToast();

  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    item: TrashItem | null;
    isLoading: boolean;
  }>({ open: false, item: null, isLoading: false });

  const [emptyDialog, setEmptyDialog] = useState<{
    open: boolean;
    isLoading: boolean;
  }>({ open: false, isLoading: false });

  const fetchItems = useCallback(async () => {
    const list = await window.electron?.listTrashItems?.();
    setItems(list ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleRestore = async (item: TrashItem) => {
    const ok = await window.electron?.restoreFromTrash?.(item.id);
    if (ok) {
      addToast("Restored \"" + item.name + "\"", "success");
      fetchItems();
    } else {
      addToast("Failed to restore \"" + item.name + "\"", "error");
    }
  };

  const handlePermanentDelete = async () => {
    const item = deleteDialog.item;
    if (!item) return;
    setDeleteDialog((s) => ({ ...s, isLoading: true }));
    const ok = await window.electron?.permanentlyDelete?.(item.id);
    if (ok) {
      addToast("Permanently deleted \"" + item.name + "\"", "success");
      setDeleteDialog({ open: false, item: null, isLoading: false });
      fetchItems();
    } else {
      addToast("Failed to delete", "error");
      setDeleteDialog((s) => ({ ...s, isLoading: false }));
    }
  };

  const handleEmptyTrash = async () => {
    setEmptyDialog((s) => ({ ...s, isLoading: true }));
    const ok = await window.electron?.emptyTrash?.();
    if (ok) {
      addToast("Bin emptied", "success");
      setEmptyDialog({ open: false, isLoading: false });
      fetchItems();
    } else {
      addToast("Failed to empty bin", "error");
      setEmptyDialog((s) => ({ ...s, isLoading: false }));
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "\u2014";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const timeAgo = (ms: number) => {
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    const days = Math.floor(hrs / 24);
    return days + "d ago";
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-white/60">Loading bin…</p>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/5 mb-4">
          <Trash2 className="h-8 w-8 text-white/40" />
        </div>
        <h2 className="text-lg font-semibold text-white mb-2">Bin is Empty</h2>
        <p className="text-sm text-white/60 max-w-xs">
          Items you delete will appear here. You can restore them or permanently
          delete them.
        </p>
      </div>
    );
  }

  const itemCountText = items.length + " item" + (items.length !== 1 ? "s" : "");
  const emptyMsg = "This will permanently delete all " + items.length + " item" + (items.length !== 1 ? "s" : "") + " in the bin. This cannot be undone.";

  return (
    <div className="flex h-full flex-col gap-4 overflow-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 pt-6">
        <Trash2 className="h-5 w-5 text-red-400/70" />
        <h1 className="text-xl font-semibold text-white">Bin</h1>
        <span className="text-xs text-white/50 ml-1">
          {itemCountText}
        </span>
        <button
          type="button"
          onClick={() => setEmptyDialog({ open: true, isLoading: false })}
          className="ml-auto flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition hover:bg-red-500/20 [-webkit-app-region:no-drag]"
        >
          <Trash2 className="h-3 w-3" />
          Empty Bin
        </button>
      </div>

      {/* Items list */}
      <div className="flex-1 overflow-auto px-6 pb-6">
        <div className="grid gap-2">
          {items.map((item) => {
            const iconBg = item.isDirectory ? "bg-amber-500/20" : "bg-white/5";
            return (
            <div
              key={item.id}
              className="group flex items-center gap-3 rounded-xl border border-border-subtle bg-secondary/40 p-3 hover:bg-secondary/60 transition"
            >
              {/* Icon + info */}
              <div className="flex flex-1 items-center gap-3 min-w-0">
                <div className={"flex h-9 w-9 shrink-0 items-center justify-center rounded-xl " + iconBg}>
                  {item.isDirectory ? (
                    <Folder className="h-4 w-4 text-amber-400/80" />
                  ) : (
                    <FileText className="h-4 w-4 text-white/60" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">
                    {item.name}
                  </p>
                  <p className="text-xs text-white/40 truncate">
                    {item.originalPath}
                  </p>
                </div>
              </div>

              {/* Meta */}
              <span className="hidden sm:block text-[10px] text-white/40 whitespace-nowrap">
                {formatSize(item.size)}
              </span>
              <span className="text-[10px] text-white/40 whitespace-nowrap">
                {timeAgo(item.trashedAt)}
              </span>

              {/* Actions */}
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                <button
                  type="button"
                  onClick={() => handleRestore(item)}
                  title="Restore"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-green-400 hover:bg-green-500/10 transition [-webkit-app-region:no-drag]"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setDeleteDialog({ open: true, item, isLoading: false })
                  }
                  title="Delete permanently"
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-red-400 hover:bg-red-500/10 transition [-webkit-app-region:no-drag]"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Permanent delete confirm */}
      <ConfirmDialog
        open={deleteDialog.open}
        title="Permanently Delete?"
        message="This item will be permanently deleted. This action cannot be undone."
        itemName={deleteDialog.item?.name}
        isDestructive
        isLoading={deleteDialog.isLoading}
        onConfirm={handlePermanentDelete}
        onCancel={() =>
          setDeleteDialog({ open: false, item: null, isLoading: false })
        }
      />

      {/* Empty bin confirm */}
      <ConfirmDialog
        open={emptyDialog.open}
        title="Empty Bin?"
        message={emptyMsg}
        isDestructive
        isLoading={emptyDialog.isLoading}
        onConfirm={handleEmptyTrash}
        onCancel={() => setEmptyDialog({ open: false, isLoading: false })}
      />
    </div>
  );
}
