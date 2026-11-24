import { ChevronDown, ChevronUp, CircleCheck, Combine, Repeat2, Trash2, Zap } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { eligibleIds, groupLabel, turnsLeft, turnsOf, type Group } from "@/lib/krismaps/initiative";
import { cn } from "@/lib/utils";

import { usePanel } from "./context";
import { MemberCard } from "./MemberCard";

export type Pool = "active" | "unacted" | "acted" | "out";

/** one turn: a hero, or a group of enemies acting together */
export function GroupCard({ group, pool }: { group: Group; pool: Pool }) {
  const { state, dispatch } = usePanel();
  const enemy = group.side === "enemy";
  const active = pool === "active";
  const canStart = eligibleIds(state).includes(group.id);
  const index = state.groups.indexOf(group);
  const label = groupLabel(group);
  // other enemy turns this group could join (e.g. a captain joining a squad)
  const joinTargets = enemy
    ? state.groups.filter((g) => g.side === "enemy" && g.id !== group.id)
    : [];

  return (
    <div
      data-testid="initiative-group"
      className={cn(
        "rounded-lg border-2 p-2 transition-colors",
        enemy ? "border-destructive/70 bg-destructive/10" : "border-chart-3/70 bg-chart-3/10",
        active && "ring-2 ring-primary",
        (pool === "acted" || pool === "out") && "opacity-45",
        pool === "unacted" && !canStart && state.mode === "drawsteel" && "opacity-70",
      )}
    >
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!active && !canStart}
          onClick={() => dispatch({ type: active ? "endTurn" : "startTurn", groupId: group.id })}
          className={cn(
            "h-auto min-w-0 flex-1 justify-start truncate px-1 py-0 text-left font-display text-sm tracking-wide",
            enemy ? "text-destructive" : "text-chart-3",
          )}
          title={active ? "End turn" : canStart ? "Start this turn" : "Not eligible yet"}
        >
          <span className="truncate">{label}</span>
          {canStart ? <span className="ml-1 text-[0.6rem] text-primary">select</span> : null}
          {pool === "out" ? <span className="ml-1 text-[0.6rem]">dead</span> : null}
        </Button>
        {pool === "unacted" ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            title="Go next (ignores whose side it is)"
            onClick={() => dispatch({ type: "toggleGoNext", groupId: group.id })}
          >
            <Zap
              className={cn(
                "size-3.5",
                state.goNextId === group.id ? "text-primary" : "text-muted-foreground",
              )}
            />
          </Button>
        ) : null}
        {enemy ? (
          <Button
            size="icon"
            variant="ghost"
            className="size-6"
            aria-pressed={turnsOf(group) > 1}
            title={
              turnsOf(group) > 1
                ? "Solo: two turns a round, never back to back. Click for one turn."
                : "Solo monster: give this two turns a round"
            }
            onClick={() =>
              dispatch({ type: "setTurns", groupId: group.id, turns: turnsOf(group) > 1 ? 1 : 2 })
            }
          >
            <Repeat2
              className={cn(
                "size-3.5",
                turnsOf(group) > 1 ? "text-primary" : "text-muted-foreground",
              )}
            />
          </Button>
        ) : null}
        {joinTargets.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="size-6" title="Act together with…">
                <Combine className="size-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel className="text-xs">Act together with</DropdownMenuLabel>
              {joinTargets.map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() => dispatch({ type: "joinGroup", groupId: group.id, intoId: t.id })}
                >
                  {groupLabel(t)}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          title="Move up"
          disabled={index <= 0}
          onClick={() => dispatch({ type: "moveGroup", groupId: group.id, delta: -1 })}
        >
          <ChevronUp className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          title="Move down"
          disabled={index >= state.groups.length - 1}
          onClick={() => dispatch({ type: "moveGroup", groupId: group.id, delta: 1 })}
        >
          <ChevronDown className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          title="Remove from combat"
          onClick={() => dispatch({ type: "removeGroup", groupId: group.id })}
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>

      {turnsOf(group) > 1 ? (
        <p className="mt-1 px-1 text-[0.65rem] text-muted-foreground">
          Solo · {turnsOf(group) - turnsLeft(group) + (active ? 1 : 0)} of {turnsOf(group)} turns
          {pool === "unacted" && state.lastGroupId === group.id && !canStart
            ? " · can't go again straight away"
            : ""}
        </p>
      ) : null}

      {active ? (
        <Button
          className="mt-2 w-full"
          size="sm"
          onClick={() => dispatch({ type: "endTurn", groupId: group.id })}
        >
          <CircleCheck className="size-4" /> End turn
        </Button>
      ) : null}

      {group.members.map((m) => (
        <MemberCard
          key={m.id}
          group={group}
          member={m}
          active={active}
          showName={group.members.length > 1}
        />
      ))}
    </div>
  );
}
