import {
  Flame,
  FlipHorizontal,
  FlipVertical,
  Grid3x3,
  Maximize,
  Moon,
  Move,
  CloudFog,
  Sunrise,
  Redo2,
  RotateCcw,
  RotateCw,
  Undo2,
  Volume2,
  VolumeX,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { DirectorStageHandle } from "@/components/krismaps/DirectorStage";
import type { FogMode, MapEntry, MapSettings, Rotation, Tool } from "@/lib/krismaps/types";
import { cn } from "@/lib/utils";

interface Props {
  tool: Tool;
  setTool: (tool: Tool) => void;
  brush: number;
  setBrush: (brush: number) => void;
  stageRef: React.RefObject<DirectorStageHandle | null>;
  settings: MapSettings;
  onSettings: (patch: Partial<MapSettings>) => void;
  entry: MapEntry | null;
  canUndoFog: boolean;
  canRedoFog: boolean;
}

export function StageToolsPanel({
  tool,
  setTool,
  brush,
  setBrush,
  stageRef,
  settings,
  onSettings,
  entry,
  canUndoFog,
  canRedoFog,
}: Props) {
  const gridMode = settings.gridMode ?? "pixels";
  const offsetMax = gridMode === "count" ? 400 : Math.max(8, settings.cell);
  const fill = (mode: FogMode) => stageRef.current?.fill(mode);
  const resetView = () => stageRef.current?.resetView();

  const rotate = (delta: number) => {
    const next = (((settings.rotation + delta) % 360) + 360) % 360;
    onSettings({ rotation: next as Rotation });
  };

  return (
    <div className="space-y-5">
      <h2 className="font-display text-sm tracking-[0.25em] text-primary uppercase">Tools</h2>

      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">Tool</Label>
        <div className="mt-2 grid grid-cols-3 gap-2">
          <Button
            variant={tool === "reveal" ? "default" : "secondary"}
            size="sm"
            onClick={() => setTool("reveal")}
          >
            <Flame className="size-4" />
          </Button>
          <Button
            variant={tool === "hide" ? "default" : "secondary"}
            size="sm"
            onClick={() => setTool("hide")}
          >
            <Moon className="size-4" />
          </Button>
          <Button
            variant={tool === "pan" ? "default" : "secondary"}
            size="sm"
            onClick={() => setTool("pan")}
          >
            <Move className="size-4" />
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {tool === "reveal"
            ? "Reveal fog"
            : tool === "hide"
              ? "Re-hide with fog"
              : "Pan (shift-drag anywhere)"}
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between">
          <Label className="text-xs uppercase tracking-widest text-muted-foreground">Brush</Label>
          <span className="text-xs text-muted-foreground">{Math.round(brush * 200)}</span>
        </div>
        <Slider
          className="mt-3"
          min={1}
          max={30}
          step={1}
          value={[Math.round(brush * 200)]}
          onValueChange={([v]) => setBrush((v ?? 12) / 200)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!canUndoFog}
          title="Undo fog (Ctrl+Z)"
          onClick={() => stageRef.current?.undoFog()}
        >
          <Undo2 className="size-4" /> Undo
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!canRedoFog}
          title="Redo fog (Ctrl+Shift+Z)"
          onClick={() => stageRef.current?.redoFog()}
        >
          <Redo2 className="size-4" /> Redo
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fill("hide")}>
          <CloudFog className="size-4" /> Hide all
        </Button>
        <Button variant="secondary" size="sm" onClick={() => fill("reveal")}>
          <Sunrise className="size-4" /> Reveal all
        </Button>
      </div>

      <Separator />

      <div className="flex items-center justify-between">
        <Label htmlFor="fog-toggle" className="text-sm">
          Fog of war
        </Label>
        <Switch
          id="fog-toggle"
          checked={settings.fog}
          onCheckedChange={(fog) => onSettings({ fog })}
        />
      </div>

      {entry?.kind === "video" ? (
        <div className="flex items-center justify-between">
          <Label htmlFor="mute-toggle" className="flex items-center gap-2 text-sm">
            {settings.muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            Sound
          </Label>
          <Switch
            id="mute-toggle"
            checked={!settings.muted}
            onCheckedChange={(audible) => onSettings({ muted: !audible })}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between">
        <Label htmlFor="grid-toggle" className="flex items-center gap-2 text-sm">
          <Grid3x3 className="size-4" /> Grid
        </Label>
        <Switch
          id="grid-toggle"
          checked={settings.grid}
          onCheckedChange={(grid) => onSettings({ grid })}
        />
      </div>

      {settings.grid ? (
        <div className="space-y-4 rounded-lg border border-border bg-card p-3">
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Size by
            </Label>
            <div className="mt-2 flex items-center gap-1 rounded-md bg-secondary p-1">
              {(["pixels", "count"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => onSettings({ gridMode: mode })}
                  className={cn(
                    "flex-1 rounded px-2 py-1 text-xs transition-colors",
                    (settings.gridMode ?? "pixels") === mode
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {mode === "pixels" ? "Pixels" : "Square count"}
                </button>
              ))}
            </div>
          </div>

          {(settings.gridMode ?? "pixels") === "pixels" ? (
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                  Square size
                </Label>
                <input
                  type="number"
                  min={8}
                  max={600}
                  value={settings.cell}
                  onChange={(e) => onSettings({ cell: Number(e.target.value) || 8 })}
                  className="h-7 w-16 rounded border border-input bg-background px-2 text-right text-xs"
                />
              </div>
              <Slider
                className="mt-3"
                min={8}
                max={400}
                step={1}
                value={[settings.cell]}
                onValueChange={([v]) => onSettings({ cell: v ?? 100 })}
              />
            </div>
          ) : (
            <>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Squares wide
                  </Label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.cellsWide ?? 20}
                    onChange={(e) =>
                      onSettings({ cellsWide: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="h-7 w-16 rounded border border-input bg-background px-2 text-right text-xs"
                  />
                </div>
                <Slider
                  className="mt-3"
                  min={1}
                  max={100}
                  step={1}
                  value={[settings.cellsWide ?? 20]}
                  onValueChange={([v]) => onSettings({ cellsWide: v ?? 20 })}
                />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-widest text-muted-foreground">
                    Squares high
                  </Label>
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={settings.cellsHigh ?? 20}
                    onChange={(e) =>
                      onSettings({ cellsHigh: Math.max(1, Number(e.target.value) || 1) })
                    }
                    className="h-7 w-16 rounded border border-input bg-background px-2 text-right text-xs"
                  />
                </div>
                <Slider
                  className="mt-3"
                  min={1}
                  max={100}
                  step={1}
                  value={[settings.cellsHigh ?? 20]}
                  onValueChange={([v]) => onSettings({ cellsHigh: v ?? 20 })}
                />
              </div>
            </>
          )}
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Offset X ({settings.offsetX})
            </Label>
            <Slider
              className="mt-3"
              min={0}
              max={offsetMax}
              step={1}
              value={[settings.offsetX % offsetMax]}
              onValueChange={([v]) => onSettings({ offsetX: v ?? 0 })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Offset Y ({settings.offsetY})
            </Label>
            <Slider
              className="mt-3"
              min={0}
              max={offsetMax}
              step={1}
              value={[settings.offsetY % offsetMax]}
              onValueChange={([v]) => onSettings({ offsetY: v ?? 0 })}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Line opacity
            </Label>
            <Slider
              className="mt-3"
              min={5}
              max={100}
              step={5}
              value={[Math.round(settings.gridOpacity * 100)]}
              onValueChange={([v]) => onSettings({ gridOpacity: (v ?? 40) / 100 })}
            />
          </div>
          <div className="flex items-center justify-between">
            <Label className="text-xs uppercase tracking-widest text-muted-foreground">
              Line colour
            </Label>
            <input
              type="color"
              value={settings.gridColor}
              onChange={(e) => onSettings({ gridColor: e.target.value })}
              className="h-7 w-12 rounded border border-input bg-background"
            />
          </div>
        </div>
      ) : null}

      <Separator />

      <div>
        <Label className="text-xs uppercase tracking-widest text-muted-foreground">
          Orientation
        </Label>
        <div className="mt-2 grid grid-cols-4 gap-2">
          <Button variant="secondary" size="sm" onClick={() => rotate(-90)}>
            <RotateCcw className="size-4" />
          </Button>
          <Button variant="secondary" size="sm" onClick={() => rotate(90)}>
            <RotateCw className="size-4" />
          </Button>
          <Button
            variant={settings.flipH ? "default" : "secondary"}
            size="sm"
            onClick={() => onSettings({ flipH: !settings.flipH })}
          >
            <FlipHorizontal className="size-4" />
          </Button>
          <Button
            variant={settings.flipV ? "default" : "secondary"}
            size="sm"
            onClick={() => onSettings({ flipV: !settings.flipV })}
          >
            <FlipVertical className="size-4" />
          </Button>
        </div>
      </div>

      <Button variant="ghost" size="sm" className="w-full" onClick={resetView}>
        <Maximize className="size-4" /> Fit view
      </Button>
    </div>
  );
}
