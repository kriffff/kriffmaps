import { useCallback, useEffect, useState } from "react";

import { STORE_SETTINGS, idbEntries, idbSet } from "./db";
import { defaultSettings, type MapSettings } from "./types";

/** per-map settings (grid, fog toggle, favourite, tags…), keyed by map path */
export function useMapSettings() {
  const [settings, setSettings] = useState<Record<string, MapSettings>>({});

  useEffect(() => {
    idbEntries<MapSettings>(STORE_SETTINGS)
      .then((rows) => setSettings(Object.fromEntries(rows)))
      .catch(() => undefined);
  }, []);

  const settingsFor = useCallback(
    (path: string | null): MapSettings => (path && settings[path]) || { ...defaultSettings },
    [settings],
  );

  const update = useCallback((path: string, patch: Partial<MapSettings>) => {
    setSettings((prev) => {
      const next = { ...(prev[path] ?? defaultSettings), ...patch };
      void idbSet(STORE_SETTINGS, path, next);
      return { ...prev, [path]: next };
    });
  }, []);

  /** drops records from memory after they've been deleted from storage */
  const forget = useCallback((paths: string[]) => {
    setSettings((prev) => {
      const next = { ...prev };
      for (const path of paths) delete next[path];
      return next;
    });
  }, []);

  return { settings, settingsFor, update, forget };
}
