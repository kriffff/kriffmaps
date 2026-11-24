import { useEffect, useState } from "react";
import { Flame, Gem } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type { TagRule } from "@/lib/krismaps/tags";
import type { MapEntry, MapSettings } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

interface Props {
  entry: MapEntry | null;
  settings: MapSettings;
  isActive: boolean;
  tagRules: TagRule[];
  autoTags: string[];
  activeTags: string[];
  onToggleTag: (id: string) => void;
  onClose: () => void;
  onSettings: (patch: Partial<MapSettings>) => void;
  onDisplay: () => void;
}

export function MapPreviewDialog({
  entry,
  settings,
  isActive,
  tagRules,
  autoTags,
  activeTags,
  onToggleTag,
  onClose,
  onSettings,
  onDisplay,
}: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!entry) {
      setUrl(null);
      return;
    }
    const objectUrl = URL.createObjectURL(entry.file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [entry]);

  return (
    <Dialog open={!!entry} onOpenChange={(open) => (open ? undefined : onClose())}>
      <DialogContent className="max-w-5xl gap-0 overflow-hidden p-0 sm:max-w-5xl">
        <div className="grid md:grid-cols-[1fr_280px]">
          <div className="flex max-h-[70vh] min-h-[320px] items-center justify-center bg-[#08090c] p-2">
            {url && entry?.kind === "video" ? (
              <video
                key={url}
                src={url}
                autoPlay
                loop
                muted={settings.muted}
                playsInline
                controls
                className="max-h-[66vh] w-auto max-w-full object-contain"
              />
            ) : url ? (
              <img
                src={url}
                alt={entry?.name ?? ""}
                className="max-h-[66vh] w-auto max-w-full object-contain"
              />
            ) : null}
          </div>
          <div className="space-y-5 border-l border-border bg-sidebar p-5">
            <div>
              <DialogTitle className="font-display text-lg leading-tight tracking-wide">
                {entry?.name}
              </DialogTitle>
              <p className="mt-1 truncate text-xs text-muted-foreground">{entry?.path}</p>
            </div>

            <Button className="w-full" onClick={onDisplay}>
              <Flame className="size-4" />
              {isActive ? "Open on Stage" : "Preview on Stage"}
            </Button>

            <Button
              variant="secondary"
              className="w-full"
              onClick={() => onSettings({ favourite: !settings.favourite })}
            >
              <Gem className={settings.favourite ? "size-4 fill-current" : "size-4"} />
              {settings.favourite ? "Remove favourite" : "Add to favourites"}
            </Button>

            <Separator />

            <div>
              <Label className="text-xs text-muted-foreground">Tags</Label>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {tagRules.map((rule) => {
                  const on = activeTags.includes(rule.id);
                  const auto = autoTags.includes(rule.id);
                  return (
                    <button
                      key={rule.id}
                      type="button"
                      onClick={() => onToggleTag(rule.id)}
                      className={cn(
                        "rounded-full border px-2 py-0.5 text-xs transition-colors",
                        on && auto
                          ? "border-primary/40 bg-primary/10 text-primary/80"
                          : on
                            ? "border-primary bg-primary/20 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                      )}
                      title={auto ? "Matched automatically from the file name" : "Set by hand"}
                    >
                      {rule.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <Label htmlFor="preview-grid" className="text-sm">
                Gridded
              </Label>
              <Switch
                id="preview-grid"
                checked={settings.grid}
                onCheckedChange={(grid) => onSettings({ grid })}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="preview-fog" className="text-sm">
                Fog of war
              </Label>
              <Switch
                id="preview-fog"
                checked={settings.fog}
                onCheckedChange={(fog) => onSettings({ fog })}
              />
            </div>

            {entry?.kind === "video" ? (
              <div className="flex items-center justify-between">
                <Label htmlFor="preview-sound" className="text-sm">
                  Sound
                </Label>
                <Switch
                  id="preview-sound"
                  checked={!settings.muted}
                  onCheckedChange={(audible) => onSettings({ muted: !audible })}
                />
              </div>
            ) : null}

            <p className="text-xs leading-relaxed text-muted-foreground">
              Previewing opens the map as a tab on the Stage. Nothing reaches the table until you
              hit Display in Map View there.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
