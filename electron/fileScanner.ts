import fs from "fs";
import path from "path";

/** Extension → category label. Lowercase keys for lookup. */
const EXTENSION_CATEGORY: Record<string, string> = {
  jpg: "Image",
  jpeg: "Image",
  png: "Image",
  gif: "Image",
  webp: "Image",
  svg: "Image",
  pdf: "Doc",
  doc: "Doc",
  docx: "Doc",
  txt: "Doc",
  md: "Doc",
  py: "Code",
  js: "Code",
  ts: "Code",
  tsx: "Code",
  jsx: "Code",
  html: "Code",
  css: "Code",
  json: "Code",
  mp3: "Audio",
  wav: "Audio",
  mp4: "Video",
  mov: "Video",
  zip: "Archive",
  tar: "Archive",
  gz: "Archive",
};

export interface ScannedFile {
  filePath: string;
  relativePath: string;
  extension: string;
  category: string;
}

export interface ScanResult {
  files: ScannedFile[];
  byCategory: Record<string, ScannedFile[]>;
  totalCount: number;
}

function getCategory(ext: string): string {
  return EXTENSION_CATEGORY[ext.toLowerCase()] ?? "Other";
}

/**
 * Recursively scans a directory and categorizes files by extension.
 * Depth-limited to avoid scanning the entire disk (default 2 levels).
 * @param dirPath - Absolute path to the directory to scan
 * @param depth - Max recursion depth (default 2); 0 = current dir only
 * @returns ScanResult with flat file list and grouped by category
 */
export async function scanDirectory(
  dirPath: string,
  depth: number = 2
): Promise<ScanResult> {
  const files: ScannedFile[] = [];
  const normalizedRoot = path.resolve(dirPath);

  async function walk(currentDir: string, remainingDepth: number): Promise<void> {
    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && (err as NodeJS.ErrnoException).code === "EACCES") return;
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (remainingDepth > 0) {
          await walk(fullPath, remainingDepth - 1);
        }
        continue;
      }

      if (!entry.isFile()) continue;

      const ext = path.extname(entry.name).slice(1) || "";
      const category = getCategory(ext);
      const relativePath = path.relative(normalizedRoot, fullPath);

      files.push({
        filePath: fullPath,
        relativePath,
        extension: ext ? `.${ext}` : "",
        category,
      });
    }
  }

  await walk(normalizedRoot, depth);

  const byCategory: Record<string, ScannedFile[]> = {};
  for (const file of files) {
    if (!byCategory[file.category]) byCategory[file.category] = [];
    byCategory[file.category].push(file);
  }

  return {
    files,
    byCategory,
    totalCount: files.length,
  };
}
