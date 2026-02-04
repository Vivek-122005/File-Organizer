export interface DiskVizNode {
  id: string;
  value: number;
  path?: string;
  category?: string;
  children?: DiskVizNode[];
}
