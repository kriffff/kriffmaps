import { Flame, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { MapEntry } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

interface Props {
  tabs: MapEntry[];
  selectedPath: string | null;
  livePath: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onGoLive: () => void;
}

/** open map tabs along the top of the Stage, plus "Display in Map View" */
export function StageTabStrip({
  tabs,
  selectedPath,
  livePath,
  onSelect,
  onClose,
  onGoLive,
}: Props) {
  const selectedIsLive = !!selectedPath && selectedPath === livePath;
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border bg-sidebar px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {tabs.length === 0 ? (
          <span className="px-2 text-xs text-muted-foreground">
            No maps open — preview one from the library.
          </span>
        ) : (
          tabs.map((entry) => (
            <span
              key={entry.path}
              className={cn(
                "flex shrink-0 items-center rounded-md border pl-2 text-xs",
                entry.path === selectedPath
                  ? "border-primary bg-primary/15 text-foreground"
                  : "border-border bg-secondary text-muted-foreground",
              )}
            >
              <button
                type="button"
                onClick={() => onSelect(entry.path)}
                className="flex max-w-[180px] items-center gap-1 py-1.5"
              >
                {entry.path === livePath ? (
                  <Flame className="size-3 shrink-0 text-primary" />
                ) : null}
                <span className="truncate">{entry.name}</span>
              </button>
              <button
                type="button"
                title="Close tab"
                onClick={() => onClose(entry.path)}
                className="px-1.5 py-1.5 hover:text-destructive"
              >
                <X className="size-3" />
              </button>
            </span>
          ))
        )}
      </div>
      <Button
        size="sm"
        className="shrink-0"
        disabled={!selectedPath || selectedIsLive}
        onClick={onGoLive}
      >
        <Flame className="size-4" />
        {selectedIsLive ? "In Map View" : "Display in Map View"}
      </Button>
    </div>
  );
}
