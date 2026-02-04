export interface DirEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  mtimeMs?: number;
}
