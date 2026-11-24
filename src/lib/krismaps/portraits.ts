import { useCallback, useEffect, useRef, useState } from "react";

import { STORE_STATBLOCKS, idbDelete, idbEntries, idbSet } from "./db";

type PortraitStore = Record<string, Blob>;

const norm = (name: string) => name.trim().toLowerCase();

// Each image is its own record, so a change only writes the one that changed.
const save = (key: string, blob: Blob) =>
  void idbSet(STORE_STATBLOCKS, key, blob).catch(() => undefined);
const drop = (key: string) => void idbDelete(STORE_STATBLOCKS, key).catch(() => undefined);

/**
 * Remembered monster portraits: an image pasted for a monster name is kept so
 * the same name re-entered in a later session shows the same picture.
 * Director-side only — never mirrored to the Map View.
 */
export function useMonsterPortraits() {
  const blobs = useRef<PortraitStore>({});
  const urls = useRef<Record<string, string>>({});
  const [portraits, setPortraits] = useState<Record<string, string>>({});

  const publish = useCallback(() => {
    const next: Record<string, string> = {};
    for (const [name, blob] of Object.entries(blobs.current)) {
      if (!urls.current[name]) urls.current[name] = URL.createObjectURL(blob);
      next[name] = urls.current[name]!;
    }
    setPortraits(next);
  }, []);

  useEffect(() => {
    idbEntries<Blob>(STORE_STATBLOCKS)
      .then((rows) => {
        blobs.current = { ...Object.fromEntries(rows), ...blobs.current };
        publish();
      })
      .catch(() => undefined);
    return () => {
      for (const url of Object.values(urls.current)) URL.revokeObjectURL(url);
      urls.current = {};
    };
  }, [publish]);

  const setPortrait = useCallback(
    (name: string, blob: Blob) => {
      const key = norm(name);
      if (!key) return;
      const previous = urls.current[key];
      if (previous) {
        URL.revokeObjectURL(previous);
        delete urls.current[key];
      }
      blobs.current = { ...blobs.current, [key]: blob };
      publish();
      save(key, blob);
    },
    [publish],
  );

  const clearPortrait = useCallback(
    (name: string) => {
      const key = norm(name);
      const previous = urls.current[key];
      if (previous) {
        URL.revokeObjectURL(previous);
        delete urls.current[key];
      }
      const next = { ...blobs.current };
      delete next[key];
      blobs.current = next;
      publish();
      drop(key);
    },
    [publish],
  );

  /** moves a stored image to a new name, e.g. after OCR corrects the monster name */
  const renamePortrait = useCallback(
    (from: string, to: string) => {
      const a = norm(from);
      const b = norm(to);
      if (!a || !b || a === b) return;
      const blob = blobs.current[a];
      if (!blob) return;
      for (const key of [a, b]) {
        const previous = urls.current[key];
        if (previous) {
          URL.revokeObjectURL(previous);
          delete urls.current[key];
        }
      }
      const next = { ...blobs.current, [b]: blob };
      delete next[a];
      blobs.current = next;
      publish();
      save(b, blob);
      drop(a);
    },
    [publish],
  );

  return { portraits, setPortrait, clearPortrait, renamePortrait, portraitKey: norm };
}
