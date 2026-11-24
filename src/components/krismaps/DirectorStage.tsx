import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";

import { createChannel } from "@/lib/krismaps/channel";
import { STORE_FOG, idbGet, idbSet } from "@/lib/krismaps/db";
import { loadMedia, type LoadedMedia } from "@/lib/krismaps/media";
import {
  createMask,
  drawBlobToMask,
  drawScene,
  fillMask,
  maskToBlob,
  maskToBlobSync,
  readMaskAlpha,
  screenToImage,
  strokeMask,
  writeMaskAlpha,
} from "@/lib/krismaps/render";
import { FogHistory } from "@/lib/krismaps/fogHistory";
import { InitiativeOverlay } from "@/components/krismaps/InitiativeOverlay";
import type { InitiativeState } from "@/lib/krismaps/initiative";
import type { FogMode, MapEntry, MapSettings, StrokePoint, Tool } from "@/lib/krismaps/types";

export interface DirectorStageHandle {
  fill: (mode: FogMode) => void;
  resetView: () => void;
  undoFog: () => void;
  redoFog: () => void;
}

export interface FogHistoryState {
  canUndo: boolean;
  canRedo: boolean;
}

interface Props {
  entry: MapEntry | null;
  settings: MapSettings;
  initiative?: InitiativeState;
  /** true when this map is the one currently shown in Map View */
  live: boolean;
  tool: Tool;
  brush: number;
  onSettings: (patch: Partial<MapSettings>) => void;
  /** told whenever fog undo/redo becomes (un)available for the shown map */
  onFogHistory?: (state: FogHistoryState) => void;
}

export const DirectorStage = forwardRef<DirectorStageHandle, Props>(function DirectorStage(
  { entry, settings, initiative, live, tool, brush, onSettings, onFogHistory },
  ref,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const mediaRef = useRef<LoadedMedia | null>(null);
  const rafRef = useRef<number | null>(null);
  const maskRef = useRef<HTMLCanvasElement | null>(null);
  const viewRef = useRef({ zoom: 1, panX: 0, panY: 0 });
  const matrixRef = useRef<DOMMatrix | null>(null);
  const channelRef = useRef<ReturnType<typeof createChannel> | null>(null);
  const saveTimer = useRef<number | null>(null);
  const dragRef = useRef<{ mode: "pan" | FogMode; last: StrokePoint | null } | null>(null);
  const historyRef = useRef(new FogHistory());
  const onFogHistoryRef = useRef(onFogHistory);
  onFogHistoryRef.current = onFogHistory;

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const entryRef = useRef(entry);
  entryRef.current = entry;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const brushRef = useRef(brush);
  brushRef.current = brush;
  const liveRef = useRef(live);
  liveRef.current = live;

  const [ready, setReady] = useState(false);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const media = mediaRef.current;
    if (!canvas || !wrap || !media) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = wrap.clientWidth;
    const h = wrap.clientHeight;
    if (w < 8 || h < 8) return;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(h * dpr);
    }
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const m = drawScene(ctx, {
      image: media.source,
      imgW: media.width,
      imgH: media.height,
      mask: maskRef.current,
      settings: settingsRef.current,
      fogAlpha: 0.55,
      background: "#08090c",
      viewW: canvas.width,
      viewH: canvas.height,
      rotation: settingsRef.current.rotation,
      flipH: settingsRef.current.flipH,
      flipV: settingsRef.current.flipV,
      zoom: viewRef.current.zoom,
      panX: viewRef.current.panX * dpr,
      panY: viewRef.current.panY * dpr,
    });
    matrixRef.current = m;
  }, []);

  const sendScene = useCallback(async () => {
    const current = entryRef.current;
    const channel = channelRef.current;
    if (!current || !channel || !liveRef.current) return;
    const mask = maskRef.current;
    const fog = mask ? await maskToBlob(mask) : null;
    channel.post({
      type: "scene",
      path: current.path,
      name: current.name,
      kind: current.kind,
      blob: current.file,
      settings: settingsRef.current,
      fog,
    });
  }, []);

  /** the fog save waiting to happen: which map, and that map's mask */
  const pendingSave = useRef<{ path: string; mask: HTMLCanvasElement } | null>(null);

  const persistMask = useCallback(() => {
    const current = entryRef.current;
    const mask = maskRef.current;
    if (!current || !mask) return;
    // remember *which* map this is now: by the time the timer fires the user
    // may have switched tabs, and the new map's fog must not be overwritten
    pendingSave.current = { path: current.path, mask };
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      saveTimer.current = null;
      const pending = pendingSave.current;
      pendingSave.current = null;
      if (!pending) return;
      const blob = await maskToBlob(pending.mask);
      if (blob) await idbSet(STORE_FOG, pending.path, blob);
    }, 700);
  }, []);

  /** save this map's fog now (end of a stroke, undo/redo, fills) */
  const saveNow = useCallback(() => {
    persistMask();
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingSave.current;
    pendingSave.current = null;
    if (!pending) return;
    void maskToBlob(pending.mask)
      .then((blob) => (blob ? idbSet(STORE_FOG, pending.path, blob) : undefined))
      .catch(() => undefined);
  }, [persistMask]);

  // A save is debounced by 0.7 s. If the page is hidden, reloaded or closed,
  // or the map changes, within that window, save straight away, encoding the
  // mask synchronously so the write is queued before the page goes away.
  const flushSave = useCallback(() => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const pending = pendingSave.current;
    pendingSave.current = null;
    if (!pending) return;
    void idbSet(STORE_FOG, pending.path, maskToBlobSync(pending.mask)).catch(() => undefined);
  }, []);

  useEffect(() => {
    const onVisibility = () => {
      if (document.visibilityState === "hidden") flushSave();
    };
    window.addEventListener("pagehide", flushSave);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      flushSave();
      window.removeEventListener("pagehide", flushSave);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [flushSave]);

  const reportHistory = useCallback(() => {
    const key = entryRef.current?.path;
    onFogHistoryRef.current?.({
      canUndo: !!key && historyRef.current.canUndo(key),
      canRedo: !!key && historyRef.current.canRedo(key),
    });
  }, []);

  /** snapshot the fog before a change so it can be undone */
  const recordFog = useCallback(() => {
    const key = entryRef.current?.path;
    const mask = maskRef.current;
    if (!key || !mask) return;
    historyRef.current.record(key, readMaskAlpha(mask));
    reportHistory();
  }, [reportHistory]);

  /** puts a restored snapshot on screen, in storage and on the Map View */
  const restoreFog = useCallback(
    (direction: "undo" | "redo") => {
      const key = entryRef.current?.path;
      const mask = maskRef.current;
      if (!key || !mask) return;
      const current = readMaskAlpha(mask);
      const snapshot =
        direction === "undo"
          ? historyRef.current.undo(key, current)
          : historyRef.current.redo(key, current);
      if (!snapshot) return;
      writeMaskAlpha(mask, snapshot);
      draw();
      saveNow();
      reportHistory();
      if (liveRef.current) {
        void maskToBlob(mask).then((fog) => {
          if (fog) channelRef.current?.post({ type: "fogMask", fog });
        });
      }
    },
    [draw, saveNow, reportHistory],
  );

  useImperativeHandle(
    ref,
    () => ({
      undoFog: () => restoreFog("undo"),
      redoFog: () => restoreFog("redo"),
      fill: (mode: FogMode) => {
        const mask = maskRef.current;
        if (!mask) return;
        recordFog();
        fillMask(mask, mode);
        draw();
        if (liveRef.current) channelRef.current?.post({ type: "fill", mode });
        saveNow();
      },
      resetView: () => {
        viewRef.current = { zoom: 1, panX: 0, panY: 0 };
        draw();
      },
    }),
    [draw, saveNow, recordFog, restoreFog],
  );

  // Broadcast channel
  useEffect(() => {
    const channel = createChannel((msg) => {
      if (msg.type === "hello") void sendScene();
    });
    channelRef.current = channel;
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, [sendScene]);

  // Load the active map (image or video)
  useEffect(() => {
    // the previous map's pending fog save goes to the previous map
    flushSave();
    let cancelled = false;
    setReady(false);
    viewRef.current = { zoom: 1, panX: 0, panY: 0 };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    if (!entry) {
      mediaRef.current?.dispose();
      mediaRef.current = null;
      maskRef.current = null;
      return;
    }
    (async () => {
      const media = await loadMedia(entry.file, entry.kind, settingsRef.current.muted);
      if (cancelled) {
        media.dispose();
        return;
      }
      mediaRef.current?.dispose();
      mediaRef.current = media;
      const mask = createMask(media.width, media.height, true);
      const stored = await idbGet<Blob>(STORE_FOG, entry.path);
      if (stored) await drawBlobToMask(mask, stored);
      if (cancelled) return;
      maskRef.current = mask;
      setReady(true);
      reportHistory();
      draw();
      void sendScene();
      if (media.video) {
        const tick = () => {
          draw();
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      }
    })();
    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [entry, draw, sendScene, reportHistory, flushSave]);

  // Pushing a newly-live map (or re-selecting the live one) sends the full scene
  useEffect(() => {
    if (live && ready) void sendScene();
  }, [live, ready, sendScene]);

  // Keep the local video audio state in sync
  useEffect(() => {
    const video = mediaRef.current?.video;
    if (video) video.muted = settings.muted;
  }, [settings.muted, ready]);

  // Redraw + push settings whenever they change
  useEffect(() => {
    draw();
    if (entryRef.current && liveRef.current)
      channelRef.current?.post({ type: "settings", settings });
  }, [settings, draw]);

  // Resize
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const observer = new ResizeObserver(() => draw());
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [draw]);

  // Wheel zoom (native, non-passive)
  const wheelRef = useRef<(e: WheelEvent) => void>(() => {});
  wheelRef.current = (event: WheelEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !mediaRef.current) return;
    const rect = canvas.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    const dy = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1);
    const view = viewRef.current;
    const next = Math.min(8, Math.max(0.2, view.zoom * Math.exp(-dy * 0.0015)));
    const k = next / view.zoom;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    view.panX = px - cx - (px - cx - view.panX) * k;
    view.panY = py - cy - (py - cy - view.panY) * k;
    view.zoom = next;
    draw();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const handler = (event: WheelEvent) => {
      event.preventDefault();
      wheelRef.current(event);
    };
    canvas.addEventListener("wheel", handler, { passive: false });
    return () => canvas.removeEventListener("wheel", handler);
  }, []);

  const toImagePoint = (clientX: number, clientY: number): StrokePoint | null => {
    const canvas = canvasRef.current;
    const media = mediaRef.current;
    const m = matrixRef.current;
    if (!canvas || !media || !m) return null;
    const rect = canvas.getBoundingClientRect();
    const dpr = canvas.width / rect.width;
    const p = screenToImage(m, (clientX - rect.left) * dpr, (clientY - rect.top) * dpr);
    return { x: p.x / media.width, y: p.y / media.height };
  };

  const applyStroke = (points: StrokePoint[], mode: FogMode) => {
    const mask = maskRef.current;
    if (!mask) return;
    strokeMask(mask, points, brushRef.current, mode);
    draw();
    if (liveRef.current)
      channelRef.current?.post({ type: "stroke", points, radius: brushRef.current, mode });
    persistMask();
  };

  const onPointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!ready) return;
    const panning = toolRef.current === "pan" || event.button === 1 || event.shiftKey;
    (event.target as HTMLElement).setPointerCapture(event.pointerId);
    if (panning) {
      dragRef.current = { mode: "pan", last: { x: event.clientX, y: event.clientY } };
      return;
    }
    const mode: FogMode = toolRef.current === "hide" ? "hide" : "reveal";
    const point = toImagePoint(event.clientX, event.clientY);
    if (!point) return;
    // one undo step per brush stroke, from pointer down to pointer up
    recordFog();
    dragRef.current = { mode, last: point };
    applyStroke([point], mode);
  };

  const onPointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.mode === "pan") {
      const last = drag.last;
      if (!last) return;
      viewRef.current.panX += event.clientX - last.x;
      viewRef.current.panY += event.clientY - last.y;
      drag.last = { x: event.clientX, y: event.clientY };
      draw();
      return;
    }
    const point = toImagePoint(event.clientX, event.clientY);
    if (!point) return;
    const from = drag.last ?? point;
    applyStroke([from, point], drag.mode);
    drag.last = point;
  };

  const endDrag = () => {
    // a finished brush stroke is saved straight away
    if (dragRef.current && dragRef.current.mode !== "pan") saveNow();
    dragRef.current = null;
  };

  if (!entry) {
    return (
      <div className="flex h-full items-center justify-center p-10 text-center">
        <div className="max-w-sm">
          <h2 className="font-display text-2xl tracking-wide text-foreground">No map on screen</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pick a map in the library and hit <span className="text-primary">Preview on Stage</span>{" "}
            to open it here.
          </p>
        </div>
      </div>
    );
  }

  const cursor = tool === "pan" ? "grab" : "crosshair";

  return (
    <div className="relative h-full min-h-0 w-full bg-[#08090c]">
      <div ref={wrapRef} className="relative h-full w-full">
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none"
          style={{ cursor }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
        />
        {initiative ? <InitiativeOverlay state={initiative} preview /> : null}
        <div className="pointer-events-none absolute left-3 top-3 rounded-md bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          {entry.name}
        </div>
      </div>
    </div>
  );
});
