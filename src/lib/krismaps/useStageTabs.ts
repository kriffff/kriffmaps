import { useEffect, useMemo, useRef, useState } from "react";

import { STORE_STATE, idbGet, idbSet } from "./db";
import type { MapEntry } from "./types";

interface StoredTabs {
  paths?: string[];
  selectedPath?: string | null;
  livePath?: string | null;
}

/**
 * The Stage's open map tabs: which maps are open, which is selected, and which
 * is live in the Map View. Restored from the previous session; tabs whose files
 * aren't in the current folder are hidden until that folder is picked again.
 */
export function useStageTabs(entries: MapEntry[]) {
  const [openPaths, setOpenPaths] = useState<string[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [livePath, setLivePath] = useState<string | null>(null);
  const loaded = useRef(false);

  useEffect(() => {
    idbGet<StoredTabs>(STORE_STATE, "stageTabs")
      .then((stored) => {
        if (stored) {
          setOpenPaths(Array.isArray(stored.paths) ? stored.paths : []);
          setSelectedPath(stored.selectedPath ?? null);
          setLivePath(stored.livePath ?? null);
        }
        loaded.current = true;
      })
      .catch(() => {
        loaded.current = true;
      });
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    void idbSet(STORE_STATE, "stageTabs", { paths: openPaths, selectedPath, livePath }).catch(
      () => undefined,
    );
  }, [openPaths, selectedPath, livePath]);

  const byPath = (path: string | null) => entries.find((entry) => entry.path === path) ?? null;

  /** open tabs, always including whatever is live in Map View */
  const tabs = useMemo(() => {
    const paths = [...openPaths];
    if (livePath && !paths.includes(livePath)) paths.unshift(livePath);
    return paths
      .map((path) => entries.find((entry) => entry.path === path))
      .filter((entry): entry is MapEntry => !!entry);
  }, [openPaths, livePath, entries]);

  const open = (path: string) => {
    setOpenPaths((prev) => (prev.includes(path) ? prev : [...prev, path]));
    setSelectedPath(path);
  };

  const close = (path: string) => {
    setOpenPaths((prev) => prev.filter((p) => p !== path));
    if (selectedPath === path) {
      const remaining = tabs.map((e) => e.path).filter((p) => p !== path);
      setSelectedPath(remaining[remaining.length - 1] ?? null);
    }
  };

  return {
    tabs,
    openPaths,
    selectedPath,
    livePath,
    selectedEntry: byPath(selectedPath),
    liveEntry: byPath(livePath),
    isOpen: (path: string) => openPaths.includes(path),
    select: setSelectedPath,
    goLive: setLivePath,
    open,
    close,
  };
}
