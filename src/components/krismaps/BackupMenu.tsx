import { useEffect, useRef, useState } from "react";
import { DatabaseBackup, Download, Eraser, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LAST_BACKUP_KEY,
  backupStatus,
  downloadBackup,
  parseBackup,
  restoreBackup,
  summarise,
  type BackupFile,
  type BackupSummary,
} from "@/lib/krismaps/backup";
import { applyCleanup, cleanupTotal, planCleanup, type CleanupPlan } from "@/lib/krismaps/cleanup";
import {
  STORE_FOG,
  STORE_SETTINGS,
  STORE_STATBLOCKS,
  STORE_STATE,
  idbGet,
  idbKeys,
  idbSet,
} from "@/lib/krismaps/db";
import type { MapEntry } from "@/lib/krismaps/types";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

interface Props {
  /** maps in the currently chosen folder; cleanup is only offered once one is loaded */
  entries: MapEntry[];
  /** called after stale data is deleted, so in-memory state can drop it too */
  onCleaned?: (plan: CleanupPlan) => void;
}

/**
 * Header menu: export all saved data to one file, replace it from such a file,
 * or delete saved data for maps no longer in the chosen folder.
 */
export function BackupMenu({ entries, onCleaned }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [pending, setPending] = useState<{ file: BackupFile; summary: BackupSummary } | null>(null);
  const [busy, setBusy] = useState(false);
  const [cleanup, setCleanup] = useState<CleanupPlan | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<number | undefined>(undefined);
  const [hasData, setHasData] = useState(false);

  // when was the last backup, and is there anything worth backing up?
  const refreshStatus = () => {
    void idbGet<number>(STORE_STATE, LAST_BACKUP_KEY)
      .then((t) => setLastBackupAt(typeof t === "number" ? t : undefined))
      .catch(() => undefined);
    void Promise.all([STORE_SETTINGS, STORE_FOG, STORE_STATBLOCKS].map((s) => idbKeys(s)))
      .then((keys) => setHasData(keys.some((k) => k.length > 0)))
      .catch(() => undefined);
  };
  useEffect(refreshStatus, []);
  const status = backupStatus(lastBackupAt, Date.now(), hasData);

  const onPlanCleanup = async () => {
    try {
      const plan = await planCleanup(entries);
      if (cleanupTotal(plan) === 0) toast.info("Nothing to clean up — all saved data is in use.");
      else setCleanup(plan);
    } catch (error) {
      console.error(error);
      toast.error("Couldn't check saved data.");
    }
  };

  const onConfirmCleanup = async () => {
    if (!cleanup) return;
    setBusy(true);
    try {
      await applyCleanup(cleanup);
      onCleaned?.(cleanup);
      toast.success(`Removed ${plural(cleanupTotal(cleanup), "unused record")}.`);
    } catch (error) {
      console.error(error);
      toast.error("Clean-up failed — nothing was deleted.");
    } finally {
      setBusy(false);
      setCleanup(null);
    }
  };

  const onExport = async () => {
    try {
      const backup = await downloadBackup();
      const at = Date.now();
      await idbSet(STORE_STATE, LAST_BACKUP_KEY, at);
      setLastBackupAt(at);
      const { counts } = summarise(backup);
      toast.success(
        `Exported ${plural(counts["settings"] ?? 0, "map setting")} and ${plural(counts["fog"] ?? 0, "fog mask")}.`,
      );
    } catch (error) {
      console.error(error);
      toast.error("Couldn't export your data.");
    }
  };

  const onPickFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const parsed = parseBackup(await file.text());
      setPending({ file: parsed, summary: summarise(parsed) });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't read that file.");
    }
  };

  const onConfirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      await restoreBackup(pending.file);
      toast.success("Data imported — reloading…");
      // every view reads IndexedDB on mount, so a reload picks up the restored data
      setTimeout(() => window.location.reload(), 600);
    } catch (error) {
      console.error(error);
      toast.error("Import failed — your existing data was left unchanged.");
      setBusy(false);
      setPending(null);
    }
  };

  const counts = pending?.summary.counts ?? {};

  return (
    <>
      <DropdownMenu onOpenChange={(open) => open && refreshStatus()}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="secondary"
            size="sm"
            className="relative"
            title={status.stale ? `${status.label} — consider exporting a backup` : status.label}
          >
            <DatabaseBackup className="size-4" />
            Backup
            {status.stale ? (
              <span
                data-testid="backup-nudge"
                className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary"
              />
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <p className="px-2 py-1 text-[0.7rem] text-muted-foreground">{status.label}</p>
          <DropdownMenuItem onSelect={() => void onExport()}>
            <Download className="size-4" />
            Export data…
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => fileRef.current?.click()}>
            <Upload className="size-4" />
            Import data…
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem disabled={entries.length === 0} onSelect={() => void onPlanCleanup()}>
            <Eraser className="size-4" />
            {entries.length === 0 ? "Clean up (choose a map folder first)" : "Clean up saved data…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        data-testid="backup-import-input"
        onChange={(event) => {
          void onPickFile(event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      <AlertDialog open={pending !== null} onOpenChange={(open) => !open && setPending(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace all saved data?</AlertDialogTitle>
            <AlertDialogDescription>
              This backup
              {pending?.summary.exportedAt
                ? ` from ${new Date(pending.summary.exportedAt).toLocaleString()}`
                : ""}{" "}
              holds {plural(counts["settings"] ?? 0, "map setting")},{" "}
              {plural(counts["fog"] ?? 0, "fog mask")}, {plural(counts["thumbs"] ?? 0, "thumbnail")}
              , {plural(counts["statblocks"] ?? 0, "stat block")} and{" "}
              {plural(counts["state"] ?? 0, "app state record")}. Importing replaces everything
              currently saved in this browser. Your map files themselves are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmImport();
              }}
            >
              Replace and import
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={cleanup !== null} onOpenChange={(open) => !open && setCleanup(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete data for missing maps?</AlertDialogTitle>
            <AlertDialogDescription>
              These maps aren&apos;t in the folder you&apos;ve chosen:{" "}
              {plural(cleanup?.settings.length ?? 0, "map setting")},{" "}
              {plural(cleanup?.fog.length ?? 0, "fog mask")} and{" "}
              {plural(cleanup?.thumbs.length ?? 0, "old thumbnail")} will be deleted. If you only
              picked part of your map collection, cancel and choose your top-level maps folder
              first. Consider exporting a backup before cleaning up.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(event) => {
                event.preventDefault();
                void onConfirmCleanup();
              }}
            >
              Delete unused data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
