import type { FogMode, MapSettings, StrokePoint } from "./types";

export const MASK_MAX = 1024;

export function maskSize(imgW: number, imgH: number) {
  const scale = Math.min(1, MASK_MAX / Math.max(imgW, imgH));
  return {
    width: Math.max(1, Math.round(imgW * scale)),
    height: Math.max(1, Math.round(imgH * scale)),
  };
}

export function createMask(imgW: number, imgH: number, filled = true) {
  const { width, height } = maskSize(imgW, imgH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  if (filled) fillMask(canvas, "hide");
  return canvas;
}

export function fillMask(mask: HTMLCanvasElement, mode: FogMode) {
  const ctx = mask.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  ctx.clearRect(0, 0, mask.width, mask.height);
  if (mode === "hide") {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, mask.width, mask.height);
  }
  ctx.restore();
}

/** points and radius are normalised to the mask's longest edge (0..1) */
export function strokeMask(
  mask: HTMLCanvasElement,
  points: StrokePoint[],
  radius: number,
  mode: FogMode,
) {
  const ctx = mask.getContext("2d");
  if (!ctx || points.length === 0) return;
  const r = Math.max(1, radius * Math.max(mask.width, mask.height));
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = mode === "reveal" ? "destination-out" : "source-over";
  ctx.fillStyle = "#000000";
  ctx.strokeStyle = "#000000";
  ctx.lineWidth = r * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  if (points.length === 1) {
    const p = points[0]!;
    ctx.beginPath();
    ctx.arc(p.x * mask.width, p.y * mask.height, r, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.beginPath();
    points.forEach((p, i) => {
      const x = p.x * mask.width;
      const y = p.y * mask.height;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
  ctx.restore();
}

export interface ViewTransform {
  imgW: number;
  imgH: number;
  viewW: number;
  viewH: number;
  rotation: number;
  flipH: boolean;
  flipV: boolean;
  zoom?: number;
  panX?: number;
  panY?: number;
}

export function computeTransform(o: ViewTransform): DOMMatrix {
  const swap = o.rotation === 90 || o.rotation === 270;
  const rw = swap ? o.imgH : o.imgW;
  const rh = swap ? o.imgW : o.imgH;
  const fit = Math.min(o.viewW / rw, o.viewH / rh) * (o.zoom ?? 1);
  let m = new DOMMatrix();
  m = m.translate(o.viewW / 2 + (o.panX ?? 0), o.viewH / 2 + (o.panY ?? 0));
  m = m.scale(fit, fit);
  m = m.rotate(o.rotation);
  m = m.scale(o.flipH ? -1 : 1, o.flipV ? -1 : 1);
  m = m.translate(-o.imgW / 2, -o.imgH / 2);
  return m;
}

export function screenToImage(m: DOMMatrix, x: number, y: number) {
  const p = m.inverse().transformPoint(new DOMPoint(x, y));
  return { x: p.x, y: p.y };
}

export interface DrawOptions extends ViewTransform {
  image: CanvasImageSource;
  mask: HTMLCanvasElement | null;
  settings: MapSettings;
  fogAlpha: number;
  background: string;
}

/** effective grid step in image pixels for each axis */
export function gridSteps(settings: MapSettings, imgW: number, imgH: number) {
  if (settings.gridMode === "count") {
    const wide = Math.max(1, settings.cellsWide || 1);
    const high = Math.max(1, settings.cellsHigh || 1);
    return { stepX: imgW / wide, stepY: imgH / high };
  }
  const step = Math.max(1, settings.cell);
  return { stepX: step, stepY: step };
}

export function drawScene(ctx: CanvasRenderingContext2D, o: DrawOptions) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, o.viewW, o.viewH);
  ctx.fillStyle = o.background;
  ctx.fillRect(0, 0, o.viewW, o.viewH);

  const m = computeTransform(o);
  const scale = Math.hypot(m.a, m.b) || 1;
  ctx.setTransform(m);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(o.image, 0, 0, o.imgW, o.imgH);

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, o.imgW, o.imgH);
  ctx.clip();

  const { stepX, stepY } = gridSteps(o.settings, o.imgW, o.imgH);
  if (o.settings.grid && stepX >= 4 && stepY >= 4) {
    ctx.globalAlpha = o.settings.gridOpacity;
    ctx.strokeStyle = o.settings.gridColor;
    ctx.lineWidth = Math.max(0.5 / scale, 1 / scale);
    ctx.beginPath();
    const startX = o.settings.offsetX % stepX;
    for (let x = startX; x <= o.imgW + 0.001; x += stepX) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, o.imgH);
    }
    const startY = o.settings.offsetY % stepY;
    for (let y = startY; y <= o.imgH + 0.001; y += stepY) {
      ctx.moveTo(0, y);
      ctx.lineTo(o.imgW, y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (o.settings.fog && o.mask) {
    ctx.globalAlpha = o.fogAlpha;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(o.mask, 0, 0, o.imgW, o.imgH);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return m;
}

export function maskToBlob(mask: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => mask.toBlob((b) => resolve(b), "image/png"));
}

export async function drawBlobToMask(mask: HTMLCanvasElement, blob: Blob) {
  const bitmap = await createImageBitmap(blob);
  const ctx = mask.getContext("2d");
  if (!ctx) return;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = "copy";
  ctx.drawImage(bitmap, 0, 0, mask.width, mask.height);
  ctx.restore();
  bitmap.close();
}

/** the fog mask's alpha channel, for undo snapshots */
export function readMaskAlpha(mask: HTMLCanvasElement): Uint8ClampedArray {
  const ctx = mask.getContext("2d", { willReadFrequently: true });
  if (!ctx) return new Uint8ClampedArray(0);
  const px = ctx.getImageData(0, 0, mask.width, mask.height).data;
  const alpha = new Uint8ClampedArray(px.length / 4);
  for (let i = 0; i < alpha.length; i++) alpha[i] = px[i * 4 + 3]!;
  return alpha;
}

/** restores a snapshot taken with readMaskAlpha (black fog, varying alpha) */
export function writeMaskAlpha(mask: HTMLCanvasElement, alpha: Uint8ClampedArray) {
  const ctx = mask.getContext("2d", { willReadFrequently: true });
  if (!ctx || alpha.length !== mask.width * mask.height) return;
  const image = ctx.createImageData(mask.width, mask.height);
  for (let i = 0; i < alpha.length; i++) image.data[i * 4 + 3] = alpha[i]!;
  ctx.putImageData(image, 0, 0);
}

/** like maskToBlob, but synchronous (for saving while the page unloads) */
export function maskToBlobSync(mask: HTMLCanvasElement): Blob {
  const [head, data] = mask.toDataURL("image/png").split(",");
  const bytes = Uint8Array.from(atob(data ?? ""), (c) => c.charCodeAt(0));
  return new Blob([bytes], { type: head?.match(/:(.*?);/)?.[1] ?? "image/png" });
}
