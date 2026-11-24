import { useState } from "react";
import { Check, Plus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CONDITIONS,
  type ConditionDuration,
  type Group,
  type Member,
} from "@/lib/krismaps/initiative";
import { cn } from "@/lib/utils";

import { usePanel } from "./context";

const DURATIONS: Array<{ value: ConditionDuration; label: string; short: string }> = [
  { value: "eot", label: "Until end of its turn (EoT)", short: "EoT" },
  { value: "save", label: "Save ends", short: "save" },
  { value: "manual", label: "Until removed", short: "" },
];
const shortFor = (d: ConditionDuration) => DURATIONS.find((x) => x.value === d)?.short ?? "";

const select =
  "h-6 rounded border border-input bg-background px-1 text-[0.7rem] text-foreground outline-none";

/** a creature's conditions: chips, saving-throw prompts and an add row */
export function Conditions({ group, member }: { group: Group; member: Member }) {
  const { dispatch } = usePanel();
  const ids = { groupId: group.id, memberId: member.id };
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState<string>(CONDITIONS[0]);
  const [duration, setDuration] = useState<ConditionDuration>("save");
  const conditions = member.conditions ?? [];

  return (
    <div className="mt-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {conditions.map((c) =>
          c.saveDue ? (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-md border border-primary bg-primary/15 py-0.5 pl-1.5 text-[0.65rem] text-foreground"
            >
              Save vs {c.name}?
              <button
                type="button"
                className="flex items-center rounded px-1 text-chart-3 hover:bg-chart-3/20"
                title="Saved: the condition ends"
                onClick={() =>
                  dispatch({ type: "resolveSave", ...ids, conditionId: c.id, saved: true })
                }
              >
                <Check className="size-3" /> Saved
              </button>
              <button
                type="button"
                className="flex items-center rounded px-1 text-destructive hover:bg-destructive/20"
                title="Failed: the condition stays"
                onClick={() =>
                  dispatch({ type: "resolveSave", ...ids, conditionId: c.id, saved: false })
                }
              >
                <X className="size-3" /> Failed
              </button>
            </span>
          ) : (
            <span
              key={c.id}
              className="flex items-center rounded-md border border-border bg-secondary py-0.5 pl-1.5 text-[0.65rem] text-foreground"
            >
              {c.name}
              {shortFor(c.duration) ? (
                <span className="text-muted-foreground"> ({shortFor(c.duration)})</span>
              ) : null}
              <button
                type="button"
                title={`Remove ${c.name}`}
                aria-label={`Remove ${c.name}`}
                className="px-1 text-muted-foreground hover:text-destructive"
                onClick={() => dispatch({ type: "removeCondition", ...ids, conditionId: c.id })}
              >
                <X className="size-3" />
              </button>
            </span>
          ),
        )}
        {!adding ? (
          <Button
            size="sm"
            variant="ghost"
            className={cn("h-6 px-1.5 text-[0.65rem] text-muted-foreground")}
            onClick={() => setAdding(true)}
          >
            <Plus className="size-3" /> Condition
          </Button>
        ) : null}
      </div>
      {adding ? (
        <div className="mt-1 flex items-center gap-1">
          <select
            aria-label="Condition"
            className={select}
            value={name}
            onChange={(e) => setName(e.target.value)}
          >
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <select
            aria-label="Duration"
            className={select}
            value={duration}
            onChange={(e) => setDuration(e.target.value as ConditionDuration)}
          >
            {DURATIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <Button
            size="sm"
            className="h-6 px-2 text-[0.65rem]"
            onClick={() => {
              dispatch({ type: "addCondition", ...ids, name, duration });
              setAdding(false);
            }}
          >
            Add
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-label="Cancel"
            onClick={() => setAdding(false)}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
