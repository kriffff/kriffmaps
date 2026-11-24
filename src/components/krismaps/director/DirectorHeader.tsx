import { Castle, Eye, Flame, Keyboard } from "lucide-react";

import { BackupMenu } from "@/components/krismaps/BackupMenu";
import { Button } from "@/components/ui/button";
import type { CleanupPlan } from "@/lib/krismaps/cleanup";
import type { MapEntry } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

export type DirectorTab = "library" | "stage";

interface Props {
  tab: DirectorTab;
  onTab: (tab: DirectorTab) => void;
  liveEntry: MapEntry | null;
  entries: MapEntry[];
  hasFolder: boolean;
  onChooseFolder: () => void;
  onCleaned: (plan: CleanupPlan) => void;
  onShortcuts: () => void;
}

function openMapView() {
  window.open("/table", "kriffmaps-table", "width=1280,height=800");
}

export function DirectorHeader({
  tab,
  onTab,
  liveEntry,
  entries,
  hasFolder,
  onChooseFolder,
  onCleaned,
  onShortcuts,
}: Props) {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
      <h1 className="font-display text-xl tracking-[0.2em] text-primary uppercase">KriffMaps</h1>
      <span className="hidden text-xs text-muted-foreground sm:inline">
        Director View ·{" "}
        <a
          href="https://github.com/kriffff/kriffmaps"
          target="_blank"
          rel="noreferrer"
          className="underline decoration-dotted hover:text-foreground"
        >
          by kriffff
        </a>
      </span>

      <div className="ml-4 flex items-center gap-1 rounded-lg bg-secondary p-1">
        {(["library", "stage"] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => onTab(key)}
            className={cn(
              "rounded-md px-3 py-1 text-sm capitalize transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div className="ml-auto flex items-center gap-2">
        {liveEntry ? (
          <span className="hidden max-w-[220px] truncate text-xs text-muted-foreground md:inline">
            <Flame className="mr-1 inline size-3.5 text-primary" />
            {liveEntry.name}
          </span>
        ) : null}
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
          onClick={onShortcuts}
        >
          <Keyboard className="size-4" />
        </Button>
        <BackupMenu entries={entries} onCleaned={onCleaned} />
        <Button variant="secondary" size="sm" onClick={onChooseFolder}>
          <Castle className="size-4" />
          {hasFolder ? "Change folder" : "Choose map folder"}
        </Button>
        <Button size="sm" onClick={openMapView}>
          <Eye className="size-4" /> Open Map View
        </Button>
      </div>
    </header>
  );
}
