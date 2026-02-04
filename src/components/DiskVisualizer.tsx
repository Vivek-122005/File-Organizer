import { useMemo, useState } from "react";
import { ResponsiveSunburst } from "@nivo/sunburst";
import { AnimatePresence, motion } from "framer-motion";
import type { DiskVizNode } from "../types/diskViz";

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

interface DiskVisualizerProps {
  data: DiskVizNode | null;
  isLoading?: boolean;
  onDeepScan?: (path: string) => void;
}

interface HoverInfo {
  id: string;
  value: number;
  category?: string;
  path?: string;
  color: string;
}

// Group any node whose value is < 1% of total into an \"Other\" node
function compressSmallNodes(root: DiskVizNode): DiskVizNode {
  const total = root.value || 0;
  if (!total) return root;
  const threshold = total * 0.01;

  const walk = (node: DiskVizNode): DiskVizNode => {
    if (!node.children || node.children.length === 0) return node;

    const processedChildren = node.children.map(walk);
    const large: DiskVizNode[] = [];
    const small: DiskVizNode[] = [];
    for (const child of processedChildren) {
      if (child.value < threshold) small.push(child);
      else large.push(child);
    }

    if (small.length > 0) {
      const otherValue = small.reduce((sum, c) => sum + c.value, 0);
      large.push({
        id: `Other (<1%) - ${node.id}`,
        value: otherValue,
        path: node.path,
        category: "other",
      });
    }

    return {
      ...node,
      children: large,
    };
  };

  return walk(root);
}

const NEON_PALETTE = [
  "#00c2ff", // cyan
  "#0078ff", // deep blue
  "#ff9e00", // gold/orange
  "#ff4800", // red-orange
  "#00ffcc", // teal-green
] as const;

function colorForCategory(category?: string): string {
  switch (category) {
    case "code":
      return "#00c2ff";
    case "media":
      return "#0078ff";
    case "docs":
      return "#00ffcc";
    case "system":
      return "#ff4800";
    case "folder":
      return "#ff9e00";
    default:
      return "#020617";
  }
}

export function DiskVisualizer({ data, isLoading, onDeepScan }: DiskVisualizerProps) {
  const [hovered, setHovered] = useState<HoverInfo | null>(null);

  const processed = useMemo(
    () => (data ? compressSmallNodes(data) : null),
    [data]
  );

  if (isLoading) {
    return (
      <div className="flex h-[400px] w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-16 w-16 rounded-full border-2 border-cyan-400/40 border-t-cyan-400 animate-spin-slow shadow-[0_0_30px_rgba(34,211,238,0.5)]" />
          <div className="text-[11px] font-semibold tracking-[0.25em] text-cyan-300">
            ANALYZING SECTOR…
          </div>
        </div>
      </div>
    );
  }

  if (!processed) return null;
  if (processed.value === 0) {
    return (
      <div className="flex h-full items-center justify-center rounded-3xl border border-border-subtle bg-secondary/80 p-6 backdrop-blur-glass">
        <p className="text-center text-sm text-white/60">No disk usage data</p>
      </div>
    );
  }

  const totalBytes = processed.value;
  const active = hovered ?? {
    id: "Total",
    value: totalBytes,
    category: "folder",
    path: processed.path,
    color: "#00c2ff",
  };

  const SunburstAny = ResponsiveSunburst as any;

  const pathForDisplay = hovered?.path ?? processed.path ?? "";

  const truncatePathMiddle = (p: string, max = 60) => {
    if (!p) return "";
    if (p.length <= max) return p;
    const keep = Math.floor((max - 3) / 2);
    return p.slice(0, keep) + "..." + p.slice(-keep);
  };

  return (
    <div className="flex h-[400px] w-full flex-col gap-2">
      <div className="relative flex-1">
        <SunburstAny
        data={processed}
        id="id"
        value="value"
        innerRadius={0.45}
        cornerRadius={4}
        borderWidth={2}
        borderColor="#020617"
        colors={(datum: any) =>
          colorForCategory((datum.data as DiskVizNode).category) ||
          NEON_PALETTE[
            Math.abs(String(datum.id as string).length) %
              NEON_PALETTE.length
          ]
        }
        animate
        motionConfig="gentle"
        enableArcLabels={false}
        isInteractive
        tooltip={() => <></>}
        onMouseEnter={(node: any) => {
          const raw = node.data as DiskVizNode;
          setHovered({
            id: String(node.id),
            value: node.value,
            category: raw.category,
            path: raw.path,
            color: node.color,
          });
        }}
        onClick={(node: any) => {
          const raw = node.data as DiskVizNode;
          if (raw.category === "folder" && raw.path && onDeepScan) {
            onDeepScan(raw.path);
          }
        }}
        onMouseLeave={() => setHovered(null)}
        margin={{ top: 8, right: 8, bottom: 8, left: 8 }}
        />

        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="flex max-w-[220px] flex-col items-center justify-center text-center"
            >
              <span className="text-[10px] font-semibold tracking-[0.2em] text-white/50">
                {hovered ? "SELECTED" : "TOTAL SIZE"}
              </span>
              <span
                className="mt-1 text-2xl font-bold tracking-tight text-[#00c2ff]"
                style={{
                  textShadow:
                    "0 0 12px #00c2ff, 0 0 32px #00c2ff, 0 0 64px #00c2ff",
                }}
              >
                {formatBytes(active.value)}
              </span>
              <span className="mt-1 line-clamp-2 text-xs text-white/80">
                {hovered ? active.id : processed.id ?? "Current folder"}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
      <div className="w-full truncate text-center font-mono text-xs text-cyan-400 drop-shadow-[0_0_5px_#22d3ee]">
        {truncatePathMiddle(pathForDisplay)}
      </div>
    </div>
  );
}
