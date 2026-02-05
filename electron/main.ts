import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  shell,
  protocol,
  net,
} from "electron";
import { Worker } from "worker_threads";
import fs from "fs";
import path from "path";
import { scanDirectory } from "./fileScanner";
import { scanDirectoryForViz } from "./diskVizScanner";

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
    win.loadFile(path.join(__dirname, "../dist/index.html"));
  }
}

app.whenReady().then(() => {
  // 1. Register the handler
  protocol.handle("media", (request) => {
    // Convert "media://path/to/file" -> "/path/to/file"
    const url = request.url.replace("media://", "");
    // Decode URL (e.g., "%20" -> " ") so the OS can find the file
    const decodedPath = decodeURIComponent(url);
    // Return the file safely using net.fetch with the file:// protocol
    return net.fetch("file://" + decodedPath);
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
}
