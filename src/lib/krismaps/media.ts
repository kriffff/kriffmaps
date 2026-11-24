import type { MediaKind } from "./types";

export interface LoadedMedia {
  kind: MediaKind;
  source: CanvasImageSource;
  width: number;
  height: number;
  video: HTMLVideoElement | null;
  dispose: () => void;
}

export function makeVideoElement(src: string, muted: boolean) {
  const video = document.createElement("video");
  video.src = src;
  video.loop = true;
  video.autoplay = true;
  video.muted = muted;
  video.playsInline = true;
  video.preload = "auto";
  video.crossOrigin = "anonymous";
  return video;
}

export async function loadMedia(blob: Blob, kind: MediaKind, muted = true): Promise<LoadedMedia> {
  if (kind === "image") {
    const bitmap = await createImageBitmap(blob);
    return {
      kind,
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      video: null,
      dispose: () => bitmap.close(),
    };
  }

  const url = URL.createObjectURL(blob);
  const video = makeVideoElement(url, muted);
  await new Promise<void>((resolve, reject) => {
    const ok = () => resolve();
    video.addEventListener("loadeddata", ok, { once: true });
    video.addEventListener("error", () => reject(new Error("Video failed to load")), {
      once: true,
    });
  });
  try {
    await video.play();
  } catch {
    // autoplay with sound can be blocked; a muted retry keeps the map moving
    video.muted = true;
    void video.play().catch(() => undefined);
  }
  return {
    kind,
    source: video,
    width: video.videoWidth || 1920,
    height: video.videoHeight || 1080,
    video,
    dispose: () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      URL.revokeObjectURL(url);
    },
  };
}
