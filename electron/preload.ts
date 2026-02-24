import { contextBridge, ipcRenderer } from "electron";

/**
 * Exposes a minimal, safe API to the renderer via contextBridge.
 * No Node or Electron internals are exposed; only whitelisted IPC channels.
 */
const electronAPI = {
  getPlatform: (): Promise<string> => ipcRenderer.invoke("app:getPlatform"),
  getVersion: (): Promise<string> => ipcRenderer.invoke("app:getVersion"),
  getSystemPaths: () => ipcRenderer.invoke("app:getSystemPaths"),
  checkAccess: (path: string) => ipcRenderer.invoke("app:checkAccess", path),
  askForPermission: (): Promise<string | null> =>
    ipcRenderer.invoke("app:askForPermission"),
  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke("app:selectDirectory"),
  scanDirectory: (dirPath: string, depth?: number) =>
    ipcRenderer.invoke("app:scanDirectory", dirPath, depth ?? 2),
  scanDirectoryForViz: (dirPath: string, depth?: number) =>
    ipcRenderer.invoke("app:scanDirectoryForViz", dirPath, depth ?? 2),
  scanDirectoryForVizDeep: (dirPath: string) =>
    ipcRenderer.invoke("app:scanDirectoryForVizDeep", dirPath),
  listDirectory: (dirPath: string) =>
    ipcRenderer.invoke("app:listDirectory", dirPath),
  getParentPath: (dirPath: string) =>
    ipcRenderer.invoke("app:getParentPath", dirPath),
  openPath: (filePath: string) =>
    ipcRenderer.invoke("app:openPath", filePath),
  readFilePreview: (filePath: string, maxBytes?: number) =>
    ipcRenderer.invoke("app:readFilePreview", filePath, maxBytes ?? 8192),
  getFileThumbnail: (filePath: string, size?: number): Promise<string | null> =>
    ipcRenderer.invoke("app:getFileThumbnail", filePath, size ?? 96),

  deleteFile: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke("app:deleteFile", filePath),
  moveToTrash: (filePath: string): Promise<boolean> =>
    ipcRenderer.invoke("app:moveToTrash", filePath),
  listTrashItems: (): Promise<any[]> =>
    ipcRenderer.invoke("app:listTrashItems"),
  restoreFromTrash: (id: string): Promise<boolean> =>
    ipcRenderer.invoke("app:restoreFromTrash", id),
  permanentlyDelete: (id: string): Promise<boolean> =>
    ipcRenderer.invoke("app:permanentlyDelete", id),
  emptyTrash: (): Promise<boolean> =>
    ipcRenderer.invoke("app:emptyTrash"),
  renameFile: (oldPath: string, newPath: string): Promise<boolean> =>
    ipcRenderer.invoke("app:renameFile", oldPath, newPath),
  watchDirectory: (dirPath: string) =>
    ipcRenderer.send("app:watchDirectory", dirPath),
  unwatchDirectory: () => ipcRenderer.send("app:unwatchDirectory"),
  onDirectoryChanged: (callback: (dirPath: string) => void) => {
    const handler = (_event: any, dirPath: string) => callback(dirPath);
    ipcRenderer.on("directory-changed", handler);
    return () => ipcRenderer.off("directory-changed", handler);
  },
};

contextBridge.exposeInMainWorld("electron", electronAPI);

export type ElectronAPI = typeof electronAPI;
