import {
  Home,
  Monitor,
  Download,
  Music,
  Folder,
  Star,
  FolderGit2,
  Book,
  HardDrive,
  Trash2,
} from "lucide-react";
import {
  useFileStore,
  type SidebarFavorite,
} from "../stores/useFileStore";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";

const FAVORITE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Home,
  Desktop: Monitor,
  Downloads: Download,
  Music,
};

function iconForSidebar(f: SidebarFavorite) {
  switch (f.icon) {
    case "download":
      return Download;
    case "music":
      return Music;
    case "monitor":
      return Monitor;
    case "file-text":
      return Book;
    case "folder-git-2":
      return FolderGit2;
    default:
      return Folder;
  }
}

function SidebarFavoriteRow({ item }: { item: SidebarFavorite }) {
  const { currentPath, navigateTo, removeFavorite } = useFileStore();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const Icon = iconForSidebar(item);
  const isActive = currentPath === item.path;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    removeFavorite(item.id);
  };

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => navigateTo(item.path)}
      onContextMenu={handleContextMenu}
      className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs [-webkit-app-region:no-drag] ${isActive
          ? "rounded-xl bg-blue-500/80 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
          : "rounded-xl text-white/80 hover:bg-white/5"
        } ${isDragging ? "opacity-80" : ""}`}
      style={style}
      {...attributes}
      {...listeners}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{item.name}</span>
    </button>
  );
}

interface SidebarProps {
  activeBin?: boolean;
  onBinClick?: () => void;
}

/**
 * Finder-style sidebar with customizable Favorites (drag-reorder),
 * plus static Locations and a Bin entry.
 */
export function Sidebar({ activeBin, onBinClick }: SidebarProps) {
  const {
    favorites,
    sidebarFavorites,
    currentPath,
    navigateTo,
    reorderFavorites,
  } = useFileStore();

  const [binCount, setBinCount] = useState(0);

  useEffect(() => {
    window.electron?.listTrashItems?.().then((items) => {
      setBinCount(items?.length ?? 0);
    });
  }, [activeBin]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  if (favorites.length === 0) return null;

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = sidebarFavorites.findIndex((f) => f.id === active.id);
    const newIndex = sidebarFavorites.findIndex((f) => f.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    reorderFavorites(oldIndex, newIndex);
  };

  const handleLocationClick = (itemPath: string) => {
    navigateTo(itemPath);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col gap-3">
        <div>
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            <span>Favorites</span>
            <Star className="h-3 w-3 text-white/40" />
          </div>
          <SortableContext
            items={sidebarFavorites.map((f) => f.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="flex flex-col gap-0.5">
              {sidebarFavorites.map((item) => (
                <SidebarFavoriteRow key={item.id} item={item} />
              ))}
              {sidebarFavorites.length === 0 && (
                <p className="px-2 py-1 text-[11px] text-white/40">
                  Drag folders here to pin them.
                </p>
              )}
            </div>
          </SortableContext>
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            <span>Locations</span>
            <HardDrive className="h-3 w-3 text-white/40" />
          </div>
          <div className="flex flex-col gap-0.5">
            {favorites.map((item) => {
              const isActive = !activeBin && currentPath === item.path;
              const Icon = FAVORITE_ICONS[item.name] ?? Folder;
              return (
                <button
                  key={item.path}
                  type="button"
                  onClick={() => handleLocationClick(item.path)}
                  className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs [-webkit-app-region:no-drag] ${isActive
                      ? "rounded-xl bg-blue-500/80 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.4)]"
                      : "rounded-xl text-white/80 hover:bg-white/5"
                    }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bin */}
        <div>
          <div className="mb-1 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/50">
            <span>Bin</span>
            <Trash2 className="h-3 w-3 text-white/40" />
          </div>
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={onBinClick}
              className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-xs [-webkit-app-region:no-drag] ${activeBin
                  ? "rounded-xl bg-red-500/60 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.3)]"
                  : "rounded-xl text-white/80 hover:bg-white/5"
                }`}
            >
              <Trash2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">Trash</span>
              {binCount > 0 && (
                <span className="ml-auto rounded-full bg-red-500/30 px-1.5 py-0.5 text-[10px] tabular-nums text-red-300">
                  {binCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </DndContext>
  );
}
