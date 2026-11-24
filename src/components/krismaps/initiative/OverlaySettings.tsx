import { useRef } from "react";
import { Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { OverlayLayout, OverlayRotation } from "@/lib/krismaps/initiative";

import { usePanel } from "./context";

const PRESETS = [
  { label: "TL", x: 0.12, y: 0.14 },
  { label: "T", x: 0.5, y: 0.1 },
  { label: "TR", x: 0.88, y: 0.14 },
  { label: "L", x: 0.1, y: 0.5 },
  { label: "C", x: 0.5, y: 0.5 },
  { label: "R", x: 0.9, y: 0.5 },
  { label: "BL", x: 0.12, y: 0.86 },
  { label: "B", x: 0.5, y: 0.9 },
  { label: "BR", x: 0.88, y: 0.86 },
];

/** where and how the initiative tracker appears on the Map View */
export function OverlaySettings() {
  const { state, dispatch } = usePanel();
  const layout = state.layout;
  const padRef = useRef<HTMLDivElement | null>(null);
  const setLayout = (patch: Partial<OverlayLayout>) => dispatch({ type: "setLayout", patch });

  const onPadPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const pad = padRef.current;
    if (!pad || event.buttons === 0) return;
    const rect = pad.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height));
    setLayout({ x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="tracker-visible" className="flex items-center gap-2 text-sm">
          {layout.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
          Show on Map View
        </Label>
        <Switch
          id="tracker-visible"
          checked={layout.visible}
          onCheckedChange={(visible) => setLayout({ visible })}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["vertical", "horizontal"] as const).map((o) => (
          <Button
            key={o}
            size="sm"
            variant={layout.orientation === o ? "default" : "secondary"}
            onClick={() => setLayout({ orientation: o })}
            className="capitalize"
          >
            {o}
          </Button>
        ))}
      </div>

      <div>
        <Label className="text-xs tracking-widest text-muted-foreground uppercase">
          Size ({Math.round(layout.scale * 100)}%)
        </Label>
        <Slider
          className="mt-3"
          min={50}
          max={200}
          step={5}
          value={[Math.round(layout.scale * 100)]}
          onValueChange={([v]) => setLayout({ scale: (v ?? 100) / 100 })}
        />
      </div>

      <div>
        <Label className="text-xs tracking-widest text-muted-foreground uppercase">Rotation</Label>
        <div className="mt-2 grid grid-cols-4 gap-1">
          {([0, 90, 180, 270] as OverlayRotation[]).map((r) => (
            <Button
              key={r}
              size="sm"
              variant={layout.rotation === r ? "default" : "secondary"}
              onClick={() => setLayout({ rotation: r })}
            >
              {r}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-xs tracking-widest text-muted-foreground uppercase">Position</Label>
        <div
          ref={padRef}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            onPadPointer(e);
          }}
          onPointerMove={onPadPointer}
          className="relative mt-2 h-24 w-full cursor-crosshair rounded-md border border-border bg-[#08090c]"
        >
          <div
            className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary"
            style={{ left: `${layout.x * 100}%`, top: `${layout.y * 100}%` }}
          />
        </div>
        <div className="mt-2 grid grid-cols-3 gap-1">
          {PRESETS.map((preset) => (
            <Button
              key={preset.label}
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setLayout({ x: preset.x, y: preset.y })}
            >
              {preset.label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
