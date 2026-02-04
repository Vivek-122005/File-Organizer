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
    };
  }
}

export {};
