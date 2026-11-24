/**
 * Finds and removes saved data for maps that are no longer in the chosen map
 * folder: per-map settings, painted fog and thumbnails (including thumbnails of
 * older versions of a file that has since changed).
 */
import { STORE_FOG, STORE_SETTINGS, STORE_THUMBS, idbDeleteMany, idbKeys } from "./db";
import { thumbKey } from "./library";
import type { MapEntry } from "./types";

export interface CleanupPlan {
  settings: string[];
  fog: string[];
  thumbs: string[];
}

export function cleanupTotal(plan: CleanupPlan) {
  return plan.settings.length + plan.fog.length + plan.thumbs.length;
}

/** pure: which stored keys don't belong to any map in `entries` */
export function staleKeys(
  entries: Pick<MapEntry, "path" | "lastModified" | "size">[],
  stored: { settings: string[]; fog: string[]; thumbs: string[] },
): CleanupPlan {
  const paths = new Set(entries.map((e) => e.path));
  const thumbs = new Set(entries.map((e) => thumbKey(e)));
  return {
    settings: stored.settings.filter((k) => !paths.has(k)),
    fog: stored.fog.filter((k) => !paths.has(k)),
    thumbs: stored.thumbs.filter((k) => !thumbs.has(k)),
  };
}

export async function planCleanup(entries: MapEntry[]): Promise<CleanupPlan> {
  const [settings, fog, thumbs] = await Promise.all([
    idbKeys(STORE_SETTINGS),
    idbKeys(STORE_FOG),
    idbKeys(STORE_THUMBS),
  ]);
  return staleKeys(entries, { settings, fog, thumbs });
}

export function applyCleanup(plan: CleanupPlan) {
  return idbDeleteMany({
    [STORE_SETTINGS]: plan.settings,
    [STORE_FOG]: plan.fog,
    [STORE_THUMBS]: plan.thumbs,
  });
}
