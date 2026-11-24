import { useEffect, useState } from "react";
import { Gem, Sparkles } from "lucide-react";

import { STORE_THUMBS, idbGet, idbSet } from "@/lib/krismaps/db";
import { makeThumbnail, thumbKey } from "@/lib/krismaps/library";
import type { MapEntry } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

interface Props {
  entry: MapEntry;
  size: number;
  favourite: boolean;
  active: boolean;
  onOpen: () => void;
}

export function MapThumb({ entry, size, favourite, active, onOpen }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    (async () => {
      const key = thumbKey(entry);
      let blob = await idbGet<Blob>(STORE_THUMBS, key);
      if (!blob) {
        blob = (await makeThumbnail(entry)) ?? undefined;
        if (blob) await idbSet(STORE_THUMBS, key, blob);
      }
      if (!blob || cancelled) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    })().catch(() => undefined);
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [entry]);

  return (
    <button
      type="button"
      onClick={onOpen}
      style={{ width: size }}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card text-left transition-colors",
        active ? "border-primary" : "border-border hover:border-primary/50",
      )}
    >
      <div
        className="relative flex w-full items-center justify-center overflow-hidden bg-muted"
        style={{ height: Math.round(size * 0.68) }}
      >
        {url ? (
          <img src={url} alt={entry.name} className="h-full w-full object-cover" loading="lazy" />
        ) : (
          <div className="h-full w-full animate-pulse bg-muted" />
        )}
        {entry.kind === "video" ? (
          <Sparkles className="absolute bottom-1.5 left-1.5 size-4 text-primary drop-shadow" />
        ) : null}
        {favourite ? (
          <Gem className="absolute right-1.5 top-1.5 size-4 fill-primary text-primary drop-shadow" />
        ) : null}
      </div>
      <span className="truncate px-2 py-1.5 text-xs text-foreground">{entry.name}</span>
    </button>
  );
}
