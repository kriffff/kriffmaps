import { useState, type ReactNode } from "react";

import { cn } from "@/lib/utils";

import { DEFAULT_PANEL_WIDTH, clampPanelWidth } from "./layout";
import { ResizeHandle } from "./ResizeHandle";

interface Props {
  width: number;
  onWidth: (width: number) => void;
  tools: ReactNode;
  initiative: ReactNode;
}

/**
 * The Stage's resizable right-hand sidebar with Tools / Initiative tabs. Both
 * panels stay mounted (just hidden) so their local state survives tab switches.
 */
export function SidePanel({ width, onWidth, tools, initiative }: Props) {
  const [panel, setPanel] = useState<"tools" | "initiative">("tools");
  return (
    <>
      <ResizeHandle
        onDrag={(x) => onWidth(clampPanelWidth(window.innerWidth - x))}
        onReset={() => onWidth(DEFAULT_PANEL_WIDTH)}
      />
      <aside className="flex shrink-0 flex-col border-l border-border bg-sidebar" style={{ width }}>
        <div className="flex shrink-0 items-center gap-1 border-b border-border p-2">
          {(["tools", "initiative"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPanel(key)}
              className={cn(
                "flex-1 rounded-md px-3 py-1.5 font-display text-xs tracking-[0.2em] uppercase transition-colors",
                panel === key
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {key}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className={cn(panel === "tools" ? "block" : "hidden")}>{tools}</div>
          <div className={cn(panel === "initiative" ? "block" : "hidden")}>{initiative}</div>
        </div>
      </aside>
    </>
  );
}
