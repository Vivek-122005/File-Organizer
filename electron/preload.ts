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
};

contextBridge.exposeInMainWorld("electron", electronAPI);

export type ElectronAPI = typeof electronAPI;
