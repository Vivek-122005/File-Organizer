import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { File as FileIcon } from "lucide-react";
import type { DirEntry } from "../types/dirEntry";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface QuickLookProps {
  open: boolean;
  entry: DirEntry | null;
  onClose: () => void;
}

const IMAGE_EXT = ["jpg", "jpeg", "png", "gif", "webp", "svg"];
const VIDEO_EXT = ["mp4", "mov", "webm", "avi"];
const CODE_EXT = ["js", "ts", "tsx", "jsx", "json", "py"];

function getExt(name: string): string {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

function isImage(name: string) {
  return IMAGE_EXT.includes(getExt(name));
}

function isVideo(name: string) {
  return VIDEO_EXT.includes(getExt(name));
}

function isCode(name: string) {
  return CODE_EXT.includes(getExt(name));
}

function isPdf(name: string) {
  return getExt(name) === "pdf";
}

function formatBytes(bytes?: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function languageForExt(ext: string): string {
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "py":
      return "python";
    default:
      return "text";
  }
}

export function QuickLook({ open, entry, onClose }: QuickLookProps) {
  const [previewText, setPreviewText] = useState<string>("");

  useEffect(() => {
    if (!open || !entry || !isCode(entry.name) || !window.electron?.readFilePreview) {
      setPreviewText("");
      return;
    }
    let cancelled = false;
    window.electron
      .readFilePreview(entry.path, 10000)
      .then((txt) => {
        if (cancelled) return;
        const lines = txt.split("\n").slice(0, 50).join("\n");
        setPreviewText(lines);
      })
      .catch(() => {
        if (!cancelled) setPreviewText("");
      });
    return () => {
      cancelled = true;
    };
  }, [open, entry]);

  if (!open || !entry) return null;

  const ext = getExt(entry.name);
  const fileUrl = `media://${encodeURIComponent(entry.path)}`;

  const image = isImage(entry.name);
  const video = isVideo(entry.name);
  const code = isCode(entry.name);
  const pdf = isPdf(entry.name);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-3xl border border-border-subtle bg-secondary/90 p-4 text-white shadow-2xl backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-4 border-b border-white/10 pb-2 text-xs">
              <div className="min-w-0">
                <div className="truncate text-[11px] font-semibold tracking-[0.18em] text-cyan-300">
                  QUICK LOOK
                </div>
                <div className="truncate text-sm font-medium text-white">
                  {entry.name}
                </div>
              </div>
              <div className="text-right text-[11px] text-white/60">
                {formatBytes(entry.size)}
              </div>
            </div>

            <div className="max-h-[80vh] overflow-auto rounded-2xl bg-black/40 p-3">
              {image && (
                <img
                  src={fileUrl}
                  alt={entry.name}
                  className="max-h-[80vh] max-w-full rounded-2xl object-contain"
                />
              )}
              {video && !image && (
                <video
                  src={fileUrl}
                  className="max-h-[80vh] max-w-full rounded-2xl"
                  autoPlay
                  muted
                  controls
                />
              )}
              {code && !image && !video && (
                <SyntaxHighlighter
                  language={languageForExt(ext)}
                  style={oneDark}
                  wrapLongLines
                  customStyle={{
                    maxHeight: "70vh",
                    fontSize: "11px",
                    borderRadius: "0.75rem",
                  }}
                >
                  {previewText || "// No preview available"}
                </SyntaxHighlighter>
              )}
              {pdf && !image && !video && !code && (
                <iframe
                  src={fileUrl}
                  className="h-[70vh] w-[80vw] max-w-full rounded-2xl border border-border-subtle bg-black"
                  title={entry.name}
                />
              )}
              {!image && !video && !code && !pdf && (
                <div className="flex h-[40vh] flex-col items-center justify-center gap-3 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-500/10">
                    <FileIcon className="h-8 w-8 text-cyan-400" />
                  </div>
                  <div className="text-sm font-medium text-white">
                    No Preview Available
                  </div>
                  <div className="max-w-sm truncate text-[11px] text-white/60">
                    {entry.path}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

