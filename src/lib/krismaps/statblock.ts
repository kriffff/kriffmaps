/**
 * On-device stat block OCR.
 *
 * Everything runs in the browser through Tesseract's WebAssembly build — the
 * pasted image never leaves the machine. The engine and English data are
 * served from this site's own /tesseract/ folder and then cached by the browser.
 */

import { parseStatBlock, type OcrWord, type StatBlockRead } from "./statblockParse";

export type { StatBlockRead } from "./statblockParse";

type AnyRecord = Record<string, unknown>;

let workerPromise: Promise<{
  recognize: (image: Blob, opts?: unknown, output?: unknown) => Promise<{ data: AnyRecord }>;
}> | null = null;

async function getWorker() {
  if (!workerPromise) {
    workerPromise = import("tesseract.js")
      .then((mod) => {
        // Self-hosted copies of the worker, WASM core and language data
        // (see scripts/copy-tesseract-assets.mjs). Absolute URLs because the
        // worker runs from a blob: URL.
        const base = new URL("/tesseract/", window.location.origin).href;
        return mod.createWorker("eng", undefined, {
          workerPath: `${base}worker.min.js`,
          corePath: `${base}core`,
          langPath: `${base}lang`,
        });
      })
      .then((worker) => worker as never);
  }
  return workerPromise;
}

/** Tesseract nests words under blocks -> paragraphs -> lines; flatten whatever shape we get. */
function collectWords(data: AnyRecord): OcrWord[] {
  const out: OcrWord[] = [];
  const push = (value: unknown) => {
    const w = value as AnyRecord;
    const bbox = w?.["bbox"] as AnyRecord | undefined;
    const text = typeof w?.["text"] === "string" ? (w["text"] as string).trim() : "";
    if (!bbox || !text) return;
    out.push({
      text,
      x0: Number(bbox["x0"]),
      y0: Number(bbox["y0"]),
      x1: Number(bbox["x1"]),
      y1: Number(bbox["y1"]),
    });
  };

  // prefer the nested blocks; fall back to a flat word list, never both (no duplicates)
  const blocks = data["blocks"];
  const flat = data["words"];
  if (!Array.isArray(blocks) && Array.isArray(flat)) flat.forEach(push);
  if (Array.isArray(blocks)) {
    for (const block of blocks as AnyRecord[]) {
      for (const para of (block?.["paragraphs"] as AnyRecord[] | undefined) ?? []) {
        for (const line of (para?.["lines"] as AnyRecord[] | undefined) ?? []) {
          for (const word of (line?.["words"] as unknown[] | undefined) ?? []) push(word);
        }
      }
    }
  }
  return out;
}

/**
 * Stat blocks are tinted (gold header, cream body) which the engine reads badly.
 * Upscaling and hard-thresholding to black-on-white lifts recognition a lot.
 */
async function prepare(image: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(image);
  const scale = Math.min(3, Math.max(1, 1600 / bitmap.width));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return image;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const frame = ctx.getImageData(0, 0, w, h);
  const px = frame.data;
  for (let i = 0; i < px.length; i += 4) {
    const grey = 0.299 * px[i]! + 0.587 * px[i + 1]! + 0.114 * px[i + 2]!;
    const value = grey < 150 ? 0 : 255;
    px[i] = value;
    px[i + 1] = value;
    px[i + 2] = value;
    px[i + 3] = 255;
  }
  ctx.putImageData(frame, 0, 0);
  return new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob ?? image), "image/png"),
  );
}

export async function recognizeStatBlock(image: Blob): Promise<StatBlockRead> {
  const worker = await getWorker();
  const prepared = await prepare(image).catch(() => image);
  const { data } = await worker.recognize(prepared, undefined, { blocks: true, text: true });
  return parseStatBlock(collectWords(data));
}
