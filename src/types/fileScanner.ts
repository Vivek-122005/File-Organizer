export interface ScannedFile {
  name: string;
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
