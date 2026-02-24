/// <reference types="vite/client" />

import type { ScanResult } from "./types/fileScanner";
import type { DiskVizNode } from "./types/diskViz";
import type { DirEntry } from "./types/dirEntry";

export interface SystemPaths {
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  music: string;
}

export interface TrashItem {
  id: string;
  name: string;
  originalPath: string;
  trashedAt: number;
  size: number;
  isDirectory: boolean;
}

export type { DirEntry };

declare global {
  interface Window {
    electron?: {
      getPlatform: () => Promise<string>;
      getVersion: () => Promise<string>;
      getSystemPaths: () => Promise<SystemPaths>;
      checkAccess: (path: string) => Promise<boolean>;
      askForPermission: () => Promise<string | null>;
      selectDirectory: () => Promise<string | null>;
      scanDirectory: (dirPath: string, depth?: number) => Promise<ScanResult>;
      scanDirectoryForViz: (dirPath: string, depth?: number) => Promise<DiskVizNode>;
      scanDirectoryForVizDeep: (dirPath: string) => Promise<DiskVizNode>;
      listDirectory: (dirPath: string) => Promise<DirEntry[]>;
      getParentPath: (dirPath: string) => Promise<string | null>;
      openPath: (filePath: string) => Promise<{ error: string }>;
      readFilePreview: (filePath: string, maxBytes?: number) => Promise<string>;
      getFileThumbnail: (filePath: string, size?: number) => Promise<string | null>;
      deleteFile: (filePath: string) => Promise<boolean>;
      moveToTrash: (filePath: string) => Promise<boolean>;
      listTrashItems: () => Promise<TrashItem[]>;
      restoreFromTrash: (id: string) => Promise<boolean>;
      permanentlyDelete: (id: string) => Promise<boolean>;
      emptyTrash: () => Promise<boolean>;
      renameFile: (oldPath: string, newPath: string) => Promise<boolean>;
      watchDirectory: (dirPath: string) => void;
      unwatchDirectory: () => void;
      onDirectoryChanged: (callback: (dirPath: string) => void) => () => void;
    };
  }
}

export { };
