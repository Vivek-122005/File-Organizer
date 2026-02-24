import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  protocol,
  net,
  nativeImage,
} from "electron";
import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url"; // Added this import
import { randomUUID } from "crypto";
import { scanDirectory } from "./fileScanner";
import { scanDirectoryForViz } from "./diskVizScanner";

// ── Trash / Bin helpers ──────────────────────────────────────────────

interface TrashManifestEntry {
  id: string;
  name: string;
  originalPath: string;
  storedName: string;   // unique filename inside .nexus-trash/files/
  trashedAt: number;    // epoch ms
  size: number;
  isDirectory: boolean;
}

const TRASH_DIR = path.join(app.getPath("home"), ".nexus-trash");
const TRASH_FILES_DIR = path.join(TRASH_DIR, "files");
const MANIFEST_PATH = path.join(TRASH_DIR, "manifest.json");

function ensureTrashDirs(): void {
  fs.mkdirSync(TRASH_FILES_DIR, { recursive: true });
}

function readManifest(): TrashManifestEntry[] {
  ensureTrashDirs();
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, "utf8");
    return JSON.parse(raw) as TrashManifestEntry[];
  } catch {
    return [];
  }
}

function writeManifest(entries: TrashManifestEntry[]): void {
  ensureTrashDirs();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(entries, null, 2), "utf8");
}

// MUST be done before app is ready
protocol.registerSchemesAsPrivileged([
  {
    scheme: "media",
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true, // Crucial for using it in <img> tags
      bypassCSP: true, // Helps avoid some CSP issues
      corsEnabled: true, // Allows accessing resources
    },
  },
]);

export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtimeMs?: number;
}

/**
 * Creates the main application window with macOS-native styling.
 * Uses frameless window, hidden inset title bar, vibrancy, and dark background.
 */
function createWindow(): void {
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    frame: false,
    titleBarStyle: "hiddenInset",
    vibrancy: "under-window",
    backgroundColor: "#0a0a0a",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    show: false,
  });

  win.once("ready-to-show", () => win.show());

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../index.html"));
  }
}

app.whenReady().then(() => {
  // 1. Register the handler
  protocol.handle("media", (request) => {
    const parsed = new URL(request.url);

    // Preferred shape: media://file/<encodeURIComponent(absPath)>
    // Fallbacks keep compatibility with older generated URLs.
    const encodedPath =
      parsed.pathname && parsed.pathname !== "/"
        ? parsed.pathname.slice(1)
        : parsed.searchParams.get("path") ??
          request.url.slice("media://".length);

    const decodedPath = decodeURIComponent(encodedPath);
    return net.fetch(pathToFileURL(decodedPath).toString());
  });

  // 2. Existing initialization
  registerIpcHandlers();
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

export interface SystemPaths {
  home: string;
  desktop: string;
  documents: string;
  downloads: string;
  music: string;
}

const TEXT_PREVIEW_EXTENSIONS = new Set([
  "txt",
  "md",
  "js",
  "ts",
  "tsx",
  "jsx",
  "json",
  "py",
  "sh",
  "bash",
  "zsh",
  "pem",
  "env",
  "yaml",
  "yml",
  "xml",
  "ini",
  "cfg",
  "conf",
  "log",
  "csv",
]);

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function buildFallbackThumbnailDataUrl(filePath: string): Promise<string> {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  const extLabel = (ext || "file").toUpperCase().slice(0, 8);
  let line1 = ext ? `.${ext}` : "file";
  let line2 = "Preview";

  if (TEXT_PREVIEW_EXTENSIONS.has(ext)) {
    try {
      const text = await fs.promises.readFile(filePath, "utf8");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length > 0) line1 = lines[0].slice(0, 30);
      if (lines.length > 1) line2 = lines[1].slice(0, 30);
      else line2 = "Text file";
    } catch {
      line2 = "Text file";
    }
  } else if (ext === "pdf") {
    line2 = "PDF file";
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="192" height="192" viewBox="0 0 192 192">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <rect width="192" height="192" rx="20" fill="url(#g)"/>
  <rect x="12" y="12" width="168" height="40" rx="10" fill="#0b1220"/>
  <text x="24" y="38" font-family="Menlo,Monaco,monospace" font-size="18" fill="#38bdf8">${escapeXml(extLabel)}</text>
  <text x="16" y="82" font-family="Menlo,Monaco,monospace" font-size="13" fill="#e2e8f0">${escapeXml(
    line1
  )}</text>
  <text x="16" y="104" font-family="Menlo,Monaco,monospace" font-size="13" fill="#94a3b8">${escapeXml(
    line2
  )}</text>
  <text x="16" y="170" font-family="Menlo,Monaco,monospace" font-size="11" fill="#64748b">${escapeXml(
    name.slice(0, 28)
  )}</text>
</svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

async function runVizWorker(
  dirPath: string,
  depth: number
): Promise<import("./diskVizScanner").DiskVizNode> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(path.join(__dirname, "fileScanner.worker.js"), {
      workerData: { dirPath, depth },
    });
    worker.once("message", (tree) => {
      resolve(tree);
      worker.terminate();
    });
    worker.once("error", (err) => {
      reject(err);
      worker.terminate();
    });
    worker.once("exit", (code) => {
      if (code !== 0) {
        reject(new Error(`worker stopped with code ${code}`));
      }
    });
  });
}

/**
 * Checks if the process can read the given path (e.g. for macOS permission).
 * Returns false on any error (EACCES, ENOENT, etc.).
 */
async function checkAccess(targetPath: string): Promise<boolean> {
  if (typeof targetPath !== "string" || !targetPath.trim()) return false;
  try {
    await fs.promises.access(path.resolve(targetPath), fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

let currentWatcher: fs.FSWatcher | null = null;
const thumbnailCache = new Map<string, string | null>();

/** Registers safe IPC handlers for renderer communication. */
function registerIpcHandlers(): void {
  ipcMain.handle("app:getPlatform", () => process.platform);
  ipcMain.handle("app:getVersion", () => app.getVersion());

  ipcMain.handle("app:checkAccess", (_event, targetPath: string) =>
    checkAccess(targetPath)
  );

  ipcMain.handle("app:askForPermission", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options = {
      defaultPath: app.getPath("home"),
      properties: ["openDirectory" as const],
      title: "Nexus Needs Access",
      message: "Select your Home Folder to grant Nexus access to your files.",
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle("app:getSystemPaths", (): SystemPaths => ({
    home: app.getPath("home"),
    desktop: app.getPath("desktop"),
    documents: app.getPath("documents"),
    downloads: app.getPath("downloads"),
    music: app.getPath("music"),
  }));

  ipcMain.handle("app:selectDirectory", async () => {
    const win = BrowserWindow.getFocusedWindow();
    const options = {
      properties: ["openDirectory" as const],
      title: "Select directory",
    };
    const result = win
      ? await dialog.showOpenDialog(win, options)
      : await dialog.showOpenDialog(options);
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle(
    "app:scanDirectory",
    async (_event, dirPath: string, depth: number = 2) => {
      if (typeof dirPath !== "string" || !dirPath.trim()) {
        throw new Error("Invalid directory path");
      }
      return scanDirectory(dirPath, depth);
    }
  );

  ipcMain.handle(
    "app:scanDirectoryForViz",
    async (_event, dirPath: string, depth: number = 2) => {
      if (typeof dirPath !== "string" || !dirPath.trim()) {
        throw new Error("Invalid directory path");
      }
      return runVizWorker(dirPath, depth);
    }
  );

  ipcMain.handle(
    "app:scanDirectoryForVizDeep",
    async (_event, dirPath: string) => {
      if (typeof dirPath !== "string" || !dirPath.trim()) {
        throw new Error("Invalid directory path");
      }
      // deeper scan for a specific folder
      return runVizWorker(dirPath, 6);
    }
  );

  ipcMain.handle(
    "app:listDirectory",
    async (_event, dirPath: string): Promise<DirEntry[]> => {
      if (typeof dirPath !== "string" || !dirPath.trim()) return [];
      const resolved = path.resolve(dirPath);
      let entries: fs.Dirent[];
      try {
        entries = await fs.promises.readdir(resolved, { withFileTypes: true });
      } catch (err) {
        const code = err && typeof err === "object" && "code" in err ? (err as NodeJS.ErrnoException).code : "";
        if (code === "EACCES") return [];
        return [];
      }
      const result: DirEntry[] = [];
      for (const e of entries) {
        const fullPath = path.join(resolved, e.name);
        let size = 0;
        let mtimeMs = 0;
        try {
          const st = await fs.promises.stat(fullPath);
          size = st.size;
          mtimeMs = st.mtimeMs;
        } catch {
          // ignore stat errors for listing
        }
        result.push({
          name: e.name,
          path: fullPath,
          isDirectory: e.isDirectory(),
          size,
          mtimeMs,
        });
      }
      result.sort((a, b) => {
        if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1;
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      });
      return result;
    }
  );

  ipcMain.handle("app:getParentPath", (_event, dirPath: string) => {
    if (typeof dirPath !== "string" || !dirPath.trim()) return null;
    const resolved = path.resolve(dirPath);
    const parent = path.dirname(resolved);
    return parent === resolved ? null : parent;
  });

  ipcMain.handle("app:openPath", async (_event, filePath: string) => {
    if (typeof filePath !== "string" || !filePath.trim()) return { error: "Invalid path" };
    return shell.openPath(filePath);
  });

  ipcMain.handle(
    "app:readFilePreview",
    async (_event, filePath: string, maxBytes: number = 8192) => {
      if (typeof filePath !== "string" || !filePath.trim()) return "";
      try {
        const buf = await fs.promises.readFile(filePath);
        const slice = buf.slice(0, maxBytes);
        return slice.toString("utf8");
      } catch {
        return "";
      }
    }
  );

  ipcMain.handle(
    "app:getFileThumbnail",
    async (
      _event,
      filePath: string,
      size: number = 96
    ): Promise<string | null> => {
      if (typeof filePath !== "string" || !filePath.trim()) return null;
      const safeSize = Number.isFinite(size)
        ? Math.max(16, Math.min(Math.floor(size), 512))
        : 96;
      try {
        const resolved = path.resolve(filePath);
        const st = await fs.promises.stat(resolved);
        if (!st.isFile()) return null;
        const cacheKey = `${resolved}:${safeSize}:${st.mtimeMs}`;
        if (thumbnailCache.has(cacheKey)) return thumbnailCache.get(cacheKey) ?? null;
        let dataUrl: string | null = null;
        try {
          const thumb = await nativeImage.createThumbnailFromPath(resolved, {
            width: safeSize,
            height: safeSize,
          });
          if (!thumb.isEmpty()) dataUrl = thumb.toDataURL();
        } catch {
          dataUrl = null;
        }
        if (!dataUrl) {
          dataUrl = await buildFallbackThumbnailDataUrl(resolved);
        }
        if (thumbnailCache.size > 3000) thumbnailCache.clear();
        thumbnailCache.set(cacheKey, dataUrl);
        return dataUrl;
      } catch {
        return null;
      }
    }
  );

  // ── Bin / Trash handlers ─────────────────────────────────────────

  /** Move a file or folder into the in-app trash. */
  ipcMain.handle("app:moveToTrash", async (_event, filePath: string) => {
    if (typeof filePath !== "string" || !filePath.trim()) return false;
    try {
      const resolved = path.resolve(filePath);
      const stat = await fs.promises.stat(resolved);
      const name = path.basename(resolved);
      const id = randomUUID();
      const storedName = `${id}_${name}`;
      const dest = path.join(TRASH_FILES_DIR, storedName);

      // Move the item
      await fs.promises.rename(resolved, dest);

      // Record in manifest
      const manifest = readManifest();
      manifest.push({
        id,
        name,
        originalPath: resolved,
        storedName,
        trashedAt: Date.now(),
        size: stat.size,
        isDirectory: stat.isDirectory(),
      });
      writeManifest(manifest);
      return true;
    } catch {
      return false;
    }
  });

  /** Backward-compat alias for the old deleteFile channel. */
  ipcMain.handle("app:deleteFile", async (_event, filePath: string) => {
    if (typeof filePath !== "string" || !filePath.trim()) return false;
    try {
      const resolved = path.resolve(filePath);
      const stat = await fs.promises.stat(resolved);
      const name = path.basename(resolved);
      const id = randomUUID();
      const storedName = `${id}_${name}`;
      const dest = path.join(TRASH_FILES_DIR, storedName);
      await fs.promises.rename(resolved, dest);
      const manifest = readManifest();
      manifest.push({
        id,
        name,
        originalPath: resolved,
        storedName,
        trashedAt: Date.now(),
        size: stat.size,
        isDirectory: stat.isDirectory(),
      });
      writeManifest(manifest);
      return true;
    } catch {
      return false;
    }
  });

  /** List all items currently in the trash. */
  ipcMain.handle("app:listTrashItems", async () => {
    const manifest = readManifest();
    return manifest.map(({ id, name, originalPath, trashedAt, size, isDirectory }) => ({
      id,
      name,
      originalPath,
      trashedAt,
      size,
      isDirectory,
    }));
  });

  /** Restore a single item from trash to its original location. */
  ipcMain.handle("app:restoreFromTrash", async (_event, id: string) => {
    if (typeof id !== "string" || !id.trim()) return false;
    try {
      const manifest = readManifest();
      const idx = manifest.findIndex((e) => e.id === id);
      if (idx === -1) return false;
      const entry = manifest[idx];
      const src = path.join(TRASH_FILES_DIR, entry.storedName);

      // Ensure parent directory of original path exists
      const parentDir = path.dirname(entry.originalPath);
      await fs.promises.mkdir(parentDir, { recursive: true });

      await fs.promises.rename(src, entry.originalPath);
      manifest.splice(idx, 1);
      writeManifest(manifest);
      return true;
    } catch {
      return false;
    }
  });

  /** Permanently delete a single item from trash. */
  ipcMain.handle("app:permanentlyDelete", async (_event, id: string) => {
    if (typeof id !== "string" || !id.trim()) return false;
    try {
      const manifest = readManifest();
      const idx = manifest.findIndex((e) => e.id === id);
      if (idx === -1) return false;
      const entry = manifest[idx];
      const itemPath = path.join(TRASH_FILES_DIR, entry.storedName);
      await fs.promises.rm(itemPath, { recursive: true, force: true });
      manifest.splice(idx, 1);
      writeManifest(manifest);
      return true;
    } catch {
      return false;
    }
  });

  /** Empty the entire trash. */
  ipcMain.handle("app:emptyTrash", async () => {
    try {
      const manifest = readManifest();
      for (const entry of manifest) {
        const itemPath = path.join(TRASH_FILES_DIR, entry.storedName);
        await fs.promises.rm(itemPath, { recursive: true, force: true }).catch(() => { });
      }
      writeManifest([]);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("app:renameFile", async (_event, oldPath: string, newPath: string) => {
    if (typeof oldPath !== "string" || !oldPath.trim() || typeof newPath !== "string" || !newPath.trim()) return false;
    try {
      await fs.promises.rename(oldPath, newPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.on("app:watchDirectory", (event, dirPath: string) => {
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
    }
    if (typeof dirPath !== "string" || !dirPath.trim()) return;
    try {
      currentWatcher = fs.watch(dirPath, (_eventType, _filename) => {
        event.sender.send("directory-changed", dirPath);
      });
    } catch {
      // ignore
    }
  });

  ipcMain.on("app:unwatchDirectory", () => {
    if (currentWatcher) {
      currentWatcher.close();
      currentWatcher = null;
    }
  });
}
