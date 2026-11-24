import type { FolderNode, MapEntry, MediaKind } from "./types";

const IMAGE_RE = /\.(jpe?g|png|webp|gif|avif|bmp)$/i;
const VIDEO_RE = /\.(m4v|webm|mp4|mov|ogv|ogg|mkv|avi|m2ts|mpe?g)$/i;

export const FAVOURITES_PATH = "__favourites__";
export const LAST_USED_PATH = "__last_used__";

export function mediaKind(name: string): MediaKind | null {
  if (IMAGE_RE.test(name)) return "image";
  if (VIDEO_RE.test(name)) return "video";
  return null;
}

export function buildLibrary(files: File[]) {
  const root: FolderNode = { path: "", name: "Maps", folders: [], maps: [] };
  const byPath = new Map<string, FolderNode>([["", root]]);

  const ensureFolder = (segments: string[]): FolderNode => {
    let current = root;
    let acc = "";
    for (const segment of segments) {
      acc = acc ? `${acc}/${segment}` : segment;
      let next = byPath.get(acc);
      if (!next) {
        next = { path: acc, name: segment, folders: [], maps: [] };
        byPath.set(acc, next);
        current.folders.push(next);
      }
      current = next;
    }
    return current;
  };

  const entries: MapEntry[] = [];

  for (const file of files) {
    const kind = mediaKind(file.name);
    if (!kind) continue;
    const relative = (file.webkitRelativePath || file.name).replace(/\\/g, "/");
    const segments = relative.split("/");
    // drop the root folder name the browser prepends
    const parts = segments.length > 1 ? segments.slice(1) : segments;
    const fileName = parts.pop() as string;
    const path = [...parts, fileName].join("/");
    const entry: MapEntry = {
      path,
      name: fileName,
      kind,
      lastModified: file.lastModified,
      size: file.size,
      file,
    };
    entries.push(entry);
    ensureFolder(parts).maps.push(entry);
  }

  const sortNode = (node: FolderNode) => {
    node.folders.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    node.maps.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    node.folders.forEach(sortNode);
  };
  sortNode(root);

  const rootName = files[0]?.webkitRelativePath?.split("/")[0];
  if (rootName) root.name = rootName;

  return { root, entries, count: entries.length };
}

export function flattenFolders(
  node: FolderNode,
  depth = 0,
): Array<{ node: FolderNode; depth: number }> {
  return [{ node, depth }, ...node.folders.flatMap((child) => flattenFolders(child, depth + 1))];
}

export function countMaps(node: FolderNode): number {
  return node.maps.length + node.folders.reduce((sum, child) => sum + countMaps(child), 0);
}

export function thumbKey(entry: Pick<MapEntry, "path" | "lastModified" | "size">) {
  return `${entry.path}|${entry.lastModified}|${entry.size}`;
}

function canvasFrom(width: number, height: number, max: number) {
  const scale = Math.min(1, max / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  return canvas;
}

function toJpeg(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", 0.8));
}

export async function makeThumbnail(entry: MapEntry, max = 512): Promise<Blob | null> {
  if (entry.kind === "video") return makeVideoThumbnail(entry.file, max);
  const bitmap = await createImageBitmap(entry.file);
  const canvas = canvasFrom(bitmap.width, bitmap.height, max);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return toJpeg(canvas);
}

async function makeVideoThumbnail(file: File, max: number): Promise<Blob | null> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadeddata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("video load failed")), { once: true });
    });
    const target = Math.min(1, (video.duration || 2) * 0.1) || 0;
    await new Promise<void>((resolve) => {
      video.addEventListener("seeked", () => resolve(), { once: true });
      video.currentTime = target;
      window.setTimeout(resolve, 1500);
    });
    const canvas = canvasFrom(video.videoWidth || 1920, video.videoHeight || 1080, max);
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return await toJpeg(canvas);
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
