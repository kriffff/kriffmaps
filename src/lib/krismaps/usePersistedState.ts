import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

import { STORE_STATE, idbGet, idbSet } from "./db";

/**
 * useState backed by a key in the IndexedDB `state` store. The stored value is
 * loaded once on mount (passed through `restore`, which may reject it by
 * returning undefined), and every later change is written back. Writes are held
 * until the load finishes, so the default never overwrites saved data.
 */
export function usePersistedState<T>(
  key: string,
  initial: T,
  restore: (stored: unknown) => T | undefined,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(initial);
  const loaded = useRef(false);
  const restoreRef = useRef(restore);

  useEffect(() => {
    let cancelled = false;
    idbGet<unknown>(STORE_STATE, key)
      .then((stored) => {
        if (cancelled) return;
        const restored = stored === undefined ? undefined : restoreRef.current(stored);
        if (restored !== undefined) setValue(restored);
      })
      .catch(() => undefined)
      .finally(() => {
        loaded.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [key]);

  useEffect(() => {
    if (!loaded.current) return;
    void idbSet(STORE_STATE, key, value).catch(() => undefined);
  }, [key, value]);

  return [value, setValue];
}
