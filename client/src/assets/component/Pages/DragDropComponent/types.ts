/* ─────────────────────────────────────────
   Types
───────────────────────────────────────── */

export interface DroppedFile {
  id: string;
  file: File;
  preview: string | null; // data URL – only populated for images
}

export type DropZoneStatus = "idle" | "over" | "rejected";

/* ─────────────────────────────────────────
   Helpers
───────────────────────────────────────── */

/** Format bytes → "1.2 MB", "340 KB", etc. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/** Return an emoji icon based on MIME type. */
export function fileIcon(type: string): string {
  if (type.startsWith("image/")) return "🖼️";
  if (type.startsWith("video/")) return "🎬";
  if (type.startsWith("audio/")) return "🎵";
  if (type === "application/pdf") return "📄";
  if (type.includes("zip") || type.includes("tar") || type.includes("gz")) return "🗜️";
  if (type.includes("word") || type.includes("document")) return "📝";
  if (type.includes("sheet") || type.includes("excel")) return "📊";
  if (type.includes("javascript") || type.includes("typescript") || type.includes("json")) return "💻";
  return "📁";
}
