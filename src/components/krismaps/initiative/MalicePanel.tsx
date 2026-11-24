import { Flame, Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { maliceForRound } from "@/lib/krismaps/initiative";

import { usePanel } from "./context";

/** common Malice costs on Draw Steel stat blocks */
const SPEND = [1, 2, 3, 5];

/** the Director's Malice: gained automatically each round, spent by hand */
export function MalicePanel() {
  const { state, dispatch } = usePanel();
  if (state.mode !== "drawsteel") return null;
  const started = state.firstSide !== null;
  const nextGain = maliceForRound(state, state.round + (started ? 1 : 0));

  return (
    <div data-testid="malice">
      <div className="flex items-center gap-2">
        <Label className="text-xs tracking-widest text-muted-foreground uppercase">Malice</Label>
        <Flame className="size-3.5 text-primary" />
        <span className="font-display text-2xl text-primary tabular-nums" aria-label="Malice">
          {state.malice}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Malice down"
            onClick={() => dispatch({ type: "adjustMalice", delta: -1 })}
          >
            <Minus className="size-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-7"
            aria-label="Malice up"
            onClick={() => dispatch({ type: "adjustMalice", delta: 1 })}
          >
            <Plus className="size-3.5" />
          </Button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-1">
        <span className="mr-1 text-[0.7rem] text-muted-foreground">Spend</span>
        {SPEND.map((n) => (
          <Button
            key={n}
            size="sm"
            variant="secondary"
            className="h-7 flex-1 px-0 text-xs"
            disabled={state.malice < n}
            onClick={() => dispatch({ type: "adjustMalice", delta: -n })}
          >
            {n}
          </Button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-muted-foreground">
        <label htmlFor="avg-victories">Average Victories</label>
        <input
          id="avg-victories"
          type="number"
          min={0}
          value={state.victories}
          onChange={(e) => dispatch({ type: "setVictories", value: Number(e.target.value) || 0 })}
          className="h-6 w-12 rounded border border-input bg-background px-1 text-right text-xs text-foreground"
        />
        <span className="ml-auto text-right">
          {started
            ? `+${nextGain} at round ${state.round + 1}`
            : `+${state.victories + nextGain} when combat starts`}
        </span>
      </div>
    </div>
  );
}
