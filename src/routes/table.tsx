import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";

import { InitiativeOverlay } from "@/components/krismaps/InitiativeOverlay";
import { createChannel } from "@/lib/krismaps/channel";
import {
  emptyInitiative,
  normalizeInitiative,
  type InitiativeState,
} from "@/lib/krismaps/initiative";
import { loadMedia, type LoadedMedia } from "@/lib/krismaps/media";
import { createMask, drawBlobToMask, drawScene, fillMask, strokeMask } from "@/lib/krismaps/render";
import { defaultSettings, type MapSettings } from "@/lib/krismaps/types";

/** double-click anywhere on the Map View to enter or leave fullscreen */
function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  else void document.documentElement.requestFullscreen().catch(() => undefined);
}

export const Route = createFileRoute("/table")({
  head: () => ({
    meta: [
      { title: "Map View — KriffMaps" },
      {
        name: "description",
        content:
          "The player-facing table display for KriffMaps: battlemap, grid and fog of war, mirrored live from Director View.",
      },
      { property: "og:title", content: "Map View — KriffMaps" },
      {
        property: "og:description",
        content: "Player-facing battlemap display with grid and fog of war.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MapView,
});

function MapView() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaRef = useRef<LoadedMedia | null>(null);
  const rafRef = useRef<number | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const settingsRef = useRef<MapSettings>(defaultSettings);
  const [hasScene, setHasScene] = useState(false);
  const [initiative, setInitiative] = useState<InitiativeState>(emptyInitiative);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const media = mediaRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!media) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = "#000000";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      return;
    }
    drawScene(ctx, {
      image: media.source,
      imgW: media.width,
      imgH: media.height,
      mask: maskRef.current,
      settings: settingsRef.current,
      fogAlpha: 1,
      background: "#000000",
      viewW: canvas.width,
      viewH: canvas.height,
      rotation: settingsRef.current.rotation,
      flipH: settingsRef.current.flipH,
      flipV: settingsRef.current.flipV,
    });
  }, []);

  useEffect(() => {
    const channel = createChannel((msg) => {
      if (msg.type === "scene") {
        settingsRef.current = msg.settings;
        void (async () => {
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
          const media = await loadMedia(msg.blob, msg.kind, msg.settings.muted);
          mediaRef.current?.dispose();
          mediaRef.current = media;
          const mask = createMask(media.width, media.height, true);
          if (msg.fog) await drawBlobToMask(mask, msg.fog);
          maskRef.current = mask;
          setHasScene(true);
          draw();
          if (media.video) {
            const tick = () => {
              draw();
              rafRef.current = requestAnimationFrame(tick);
            };
            rafRef.current = requestAnimationFrame(tick);
          }
        })();
        return;
      }
      if (msg.type === "initiative") {
        setInitiative(normalizeInitiative(msg.state));
        return;
      }
      if (msg.type === "settings") {
        settingsRef.current = msg.settings;
        const video = mediaRef.current?.video;
        if (video) {
          video.muted = msg.settings.muted;
          if (!msg.settings.muted) void video.play().catch(() => undefined);
        }
        draw();
        return;
      }
      if (msg.type === "stroke") {
        if (maskRef.current) strokeMask(maskRef.current, msg.points, msg.radius, msg.mode);
        draw();
        return;
      }
      if (msg.type === "fogMask") {
        const mask = maskRef.current;
        if (mask) void drawBlobToMask(mask, msg.fog).then(draw);
        return;
      }
      if (msg.type === "fill") {
        if (maskRef.current) fillMask(maskRef.current, msg.mode);
        draw();
        return;
      }
      if (msg.type === "clear") {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
        mediaRef.current?.dispose();
        mediaRef.current = null;
        maskRef.current = null;
        setHasScene(false);
        draw();
      }
    });
    channel.post({ type: "hello" });
    const onResize = () => draw();
    window.addEventListener("resize", onResize);
    draw();
    return () => {
      window.removeEventListener("resize", onResize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      channel.close();
    };
  }, [draw]);

  return (
    <main
      className="relative h-screen w-screen overflow-hidden bg-black"
      onDoubleClick={toggleFullscreen}
    >
      <h1 className="sr-only">KriffMaps Map View</h1>
      <canvas ref={canvasRef} className="block cursor-none" />
      <InitiativeOverlay state={initiative} />
      {!hasScene ? (
        <p className="absolute inset-0 flex flex-col items-center justify-center text-sm tracking-[0.3em] text-neutral-700 uppercase">
          Waiting for the Director
          <span className="mt-3 text-[0.65rem] tracking-[0.2em] text-neutral-800">
            Double-click for fullscreen
          </span>
        </p>
      ) : null}
    </main>
  );
}
