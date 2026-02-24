export function toMediaUrl(filePath: string): string {
  return "media://file/" + encodeURIComponent(filePath);
}
