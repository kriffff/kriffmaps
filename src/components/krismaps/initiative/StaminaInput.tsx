import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  value: number;
  /** shown after the value, e.g. "/ 40" */
  max?: string | undefined;
  onChange: (value: number) => void;
  /** step for the - / + buttons */
  step?: number;
  badge?: React.ReactNode;
  danger?: boolean;
}

/** a labelled number with - / + buttons, used for every Stamina value */
export function StaminaInput({ label, value, max, onChange, step = 1, badge, danger }: Props) {
  return (
    <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
      <span className="w-16 truncate tabular-nums">{label}</span>
      <Button
        size="icon"
        variant="secondary"
        className="size-6"
        aria-label={`${label} down`}
        onClick={() => onChange(value - step)}
      >
        <Minus className="size-3" />
      </Button>
      <input
        type="number"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        className={cn(
          "h-6 w-14 rounded border border-input bg-background px-1 text-right text-xs text-foreground",
          danger && "border-destructive/70 text-destructive",
        )}
      />
      {max ? <span className="text-foreground/60">{max}</span> : null}
      <Button
        size="icon"
        variant="secondary"
        className="ml-auto size-6"
        aria-label={`${label} up`}
        onClick={() => onChange(value + step)}
      >
        <Plus className="size-3" />
      </Button>
      {badge}
    </div>
  );
}
