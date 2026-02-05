import fs from "fs";
import path from "path";

const SMALL_FOLDER_BYTES = 1024 * 1024; // 1MB for small folders
const SMALL_FILE_BYTES = 5 * 1024 * 1024; // 5MB for small files (Misc / Other)

/** Node shape for treemap viz. */
export interface DiskVizNode {
  id: string;
  value: number;
  path?: string;
  category?: string;
  children?: DiskVizNode[];
}

/**
 * Returns total size of a path (file or directory, recursively).
 * Returns 0 on EACCES or other access errors.
 */
async function getPathSize(dirPath: string): Promise<number> {
  let stat: fs.Stats;
  try {
    stat = await fs.promises.stat(dirPath);
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "EACCES") return 0;
    return 0;
  }
  if (!stat.isDirectory()) return stat.size;

  let entries: fs.Dirent[];
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "EACCES") return 0;
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    try {
      if (entry.isDirectory()) {
        total += await getPathSize(fullPath);
      } else {
        const s = await fs.promises.stat(fullPath);
        total += s.size;
      }
    } catch {
      // Skip inaccessible entries
    }
  }
  return total;
}

/**
 * Recursively scans a directory into a nested tree for sunburst viz.
 * Depth-limited (default 2 levels). Folders smaller than 1MB are grouped into "Other".
 */
export async function scanDirectoryForViz(
  dirPath: string,
  depth: number = 2
): Promise<DiskVizNode> {
  const normalizedRoot = path.resolve(dirPath);
  const baseName = path.basename(normalizedRoot) || "Root";

  async function buildNode(
    currentPath: string,
    name: string,
    remainingDepth: number
  ): Promise<DiskVizNode> {
    let stat: fs.Stats;
    try {
      stat = await fs.promises.stat(currentPath);
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "EACCES")
        return { id: name, value: 0 };
      return { id: name, value: 0 };
    }
    if (!stat.isDirectory()) {
      const ext = path.extname(name).slice(1).toLowerCase();
      let category: string;
      if (["js", "ts", "tsx", "jsx", "py", "html", "css", "json"].includes(ext))
        category = "code";
      else if (["jpg", "jpeg", "png", "gif", "webp", "svg", "mp4", "mov", "webm", "avi"].includes(ext))
        category = "media";
      else if (["pdf", "doc", "docx", "txt", "md"].includes(ext))
        category = "docs";
      else if (["dll", "exe", "dmg"].includes(ext))
        category = "system";
      else category = "other";
      return { id: name, value: stat.size, path: currentPath, category };
    }

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "EACCES")
        return { id: name, value: 0 };
      return { id: name, value: 0 };
    }
    const children: DiskVizNode[] = [];
    let otherFolderSize = 0;
    let miscFileSize = 0;

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const safeName = entry.name || "unnamed";

      try {
        if (entry.isFile()) {
          const s = await fs.promises.stat(fullPath);
          if (s.size < SMALL_FILE_BYTES) {
            miscFileSize += s.size;
          } else {
            const fileNode = await buildNode(fullPath, safeName, 0);
            children.push(fileNode);
          }
        } else {
          const childSize = await getPathSize(fullPath);
          if (remainingDepth <= 0 || childSize < SMALL_FOLDER_BYTES) {
            otherFolderSize += childSize;
          } else {
            children.push(
              await buildNode(fullPath, safeName, remainingDepth - 1)
            );
          }
        }
      } catch {
        // Skip inaccessible
      }
    }

    if (miscFileSize > 0) {
      children.push({
        id: "Misc / Other",
        value: miscFileSize,
        path: currentPath,
        category: "other",
      });
    }

    if (otherFolderSize > 0) {
      children.push({
        id: "Other Folders",
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
      children: children.length > 0 ? children : undefined,
    };
  }

  return buildNode(normalizedRoot, baseName, depth);
}
