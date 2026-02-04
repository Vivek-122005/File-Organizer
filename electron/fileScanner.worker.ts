import { parentPort, workerData } from "worker_threads";
import fs from "fs";
import path from "path";

const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  ".cache",
  "Library",
]);

const SMALL_FOLDER_BYTES = 1024 * 1024; // 1MB for small folders
const SMALL_FILE_BYTES = 5 * 1024 * 1024; // 5MB for small files

export interface DiskVizNode {
  id: string;
  value: number;
  path?: string;
  category?: string;
  children?: DiskVizNode[];
}

interface WorkerInput {
  dirPath: string;
  depth: number;
}

function shouldIgnoreDir(name: string): boolean {
  return IGNORE_DIRS.has(name);
}

async function getPathSize(p: string): Promise<number> {
  try {
    const st = await fs.promises.stat(p);
    if (!st.isDirectory()) return st.size;

    const entries = await fs.promises.readdir(p, { withFileTypes: true });
    let total = 0;
    for (const e of entries) {
      const full = path.join(p, e.name);
      try {
        if (e.isDirectory()) total += await getPathSize(full);
        else total += (await fs.promises.stat(full)).size;
      } catch {
        // ignore
      }
    }
    return total;
  } catch {
    return 0;
  }
}

function categoryForExt(ext: string): string {
  const e = ext.toLowerCase();
  if (["js", "ts", "tsx", "jsx", "py", "html", "css", "json"].includes(e))
    return "code";
  if (
    [
      "jpg",
      "jpeg",
      "png",
      "gif",
      "webp",
      "svg",
      "mp4",
      "mov",
      "webm",
      "avi",
    ].includes(e)
  )
    return "media";
  if (["pdf", "doc", "docx", "txt", "md"].includes(e)) return "docs";
  if (["dll", "exe", "dmg"].includes(e)) return "system";
  return "other";
}

async function buildNode(
  currentPath: string,
  name: string,
  remainingDepth: number
): Promise<DiskVizNode> {
  let st: fs.Stats;
  try {
    st = await fs.promises.stat(currentPath);
  } catch {
    return { id: name, value: 0, path: currentPath, category: "other" };
  }

  if (!st.isDirectory()) {
    const ext = path.extname(name).slice(1);
    return {
      id: name,
      value: st.size,
      path: currentPath,
      category: categoryForExt(ext),
    };
  }

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(currentPath, {
      withFileTypes: true,
    });
  } catch {
    return { id: name, value: 0, path: currentPath, category: "folder" };
  }

  const children: DiskVizNode[] = [];
  let otherFolderSize = 0;
  let miscFileSize = 0;

  for (const entry of entries) {
    const full = path.join(currentPath, entry.name);
    const safeName = entry.name || "unnamed";

    if (entry.isDirectory()) {
      if (shouldIgnoreDir(entry.name)) {
        const size = await getPathSize(full);
        otherFolderSize += size;
        continue;
      }
      const childSize = await getPathSize(full);
      if (remainingDepth <= 0 || childSize < SMALL_FOLDER_BYTES) {
        otherFolderSize += childSize;
      } else {
        children.push(await buildNode(full, safeName, remainingDepth - 1));
      }
    } else if (entry.isFile()) {
      try {
        const s = await fs.promises.stat(full);
        if (s.size < SMALL_FILE_BYTES) {
          miscFileSize += s.size;
        } else {
          const ext = path.extname(entry.name).slice(1);
          children.push({
            id: safeName,
            value: s.size,
            path: full,
            category: categoryForExt(ext),
          });
        }
      } catch {
        // ignore file
      }
    }
  }

  if (miscFileSize > 0) {
    const miscId = "misc-other-" + Math.random().toString(36).substr(2, 9);
    children.push({
      id: miscId,
      value: miscFileSize,
      path: currentPath,
      category: "other",
    });
  }

  if (otherFolderSize > 0) {
    const otherId =
      "other-folders-" + Math.random().toString(36).substr(2, 9);
    children.push({
      id: otherId,
      value: otherFolderSize,
      path: currentPath,
      category: "other",
    });
  }

  const value = children.reduce((sum, c) => sum + c.value, 0);
  return {
    id: name,
    value,
    path: currentPath,
    category: "folder",
    children: children.length ? children : undefined,
  };
}

(async () => {
  const { dirPath, depth } = workerData as WorkerInput;
  const root = path.resolve(dirPath);
  const name = path.basename(root) || "Root";
  const tree = await buildNode(root, name, depth);
  parentPort?.postMessage(tree);
})();

