/**
 * Export / import of everything KriffMaps keeps in IndexedDB, as one JSON
 * file: per-map settings (grid, favourites, tag overrides…), painted fog
 * masks, thumbnails and app state (initiative, roster, portraits, tag rules,
 * stage tabs, panel widths).
 *
 * Blobs (fog masks, thumbnails, stat block images) are inlined as data URLs.
 */
import { ALL_STORES, idbEntries, idbReplaceAll } from "./db";

export const BACKUP_FORMAT = "kriffmaps-backup";
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  stores: Record<string, Record<string, unknown>>;
}

const BLOB_TAG = "$blob";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

/** deep-copies a stored value, swapping every Blob for `{ $blob: dataUrl }` */
async function encode(value: unknown): Promise<unknown> {
  if (value instanceof Blob) return { [BLOB_TAG]: await blobToDataUrl(value) };
  if (Array.isArray(value)) return Promise.all(value.map(encode));
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = await encode(v);
    return out;
  }
  return value;
}

/** reverses `encode` */
async function decode(value: unknown): Promise<unknown> {
  if (Array.isArray(value)) return Promise.all(value.map(decode));
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const tagged = obj[BLOB_TAG];
    if (typeof tagged === "string" && Object.keys(obj).length === 1) return dataUrlToBlob(tagged);
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = await decode(v);
    return out;
  }
  return value;
}

export async function createBackup(): Promise<BackupFile> {
  const stores: BackupFile["stores"] = {};
  for (const store of ALL_STORES) {
    const rows = await idbEntries<unknown>(store);
    const encoded: Record<string, unknown> = {};
    for (const [key, value] of rows) encoded[key] = await encode(value);
    stores[store] = encoded;
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    stores,
  };
}

/** builds the backup and hands it to the browser as a file download */
export async function downloadBackup() {
  const backup = await createBackup();
  const blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `kriffmaps-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return backup;
}

export interface BackupSummary {
  exportedAt: string;
  counts: Record<string, number>;
}

/** parses and sanity-checks a backup file; throws a readable Error if it isn't one */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON.");
  }
  const file = data as Partial<BackupFile> | null;
  if (!file || file.format !== BACKUP_FORMAT || typeof file.stores !== "object" || !file.stores) {
    throw new Error("That file isn't a KriffMaps backup.");
  }
  if (typeof file.version !== "number" || file.version > BACKUP_VERSION) {
    throw new Error("This backup was made by a newer version of KriffMaps.");
  }
  return file as BackupFile;
}

export function summarise(file: BackupFile): BackupSummary {
  const counts: Record<string, number> = {};
  for (const store of ALL_STORES) counts[store] = Object.keys(file.stores[store] ?? {}).length;
  return { exportedAt: file.exportedAt, counts };
}

/** replaces all saved data with the backup's contents (stores missing from the file are emptied) */
export async function restoreBackup(file: BackupFile) {
  const data: Record<string, Array<[string, unknown]>> = {};
  for (const store of ALL_STORES) {
    const rows: Array<[string, unknown]> = [];
    for (const [key, value] of Object.entries(file.stores[store] ?? {})) {
      rows.push([key, await decode(value)]);
    }
    data[store] = rows;
  }
  await idbReplaceAll(data);
}

/** state-store key holding when the last export happened (epoch ms) */
export const LAST_BACKUP_KEY = "lastBackupAt";
/** nudge after this long without a backup */
export const BACKUP_NUDGE_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

/**
 * Whether to nudge for a backup, and how to describe the last one. Nothing to
 * lose (no saved data yet) never nudges.
 */
export function backupStatus(
  lastBackupAt: number | undefined,
  now: number,
  hasData: boolean,
): { stale: boolean; label: string } {
  if (!lastBackupAt) return { stale: hasData, label: "Never backed up" };
  const days = Math.floor((now - lastBackupAt) / DAY);
  const label =
    days <= 0
      ? "Backed up today"
      : days === 1
        ? "Backed up yesterday"
        : `Backed up ${days} days ago`;
  return { stale: hasData && days >= BACKUP_NUDGE_DAYS, label };
}
