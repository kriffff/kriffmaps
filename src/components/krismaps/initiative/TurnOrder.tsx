import { Hourglass, Minus, Plus, Shield, Skull, Swords } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  needsFirstSide,
  pools,
  requiredSide,
  roundComplete,
  type Group,
} from "@/lib/krismaps/initiative";

import { usePanel } from "./context";
import { GroupCard, type Pool } from "./GroupCard";

function Section({
  title,
  groups,
  pool,
  empty,
}: {
  title: string;
  groups: Group[];
  pool: Pool;
  empty?: string;
}) {
  if (groups.length === 0 && !empty) return null;
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs tracking-widest text-muted-foreground uppercase">{title}</h3>
        <span className="text-xs text-muted-foreground">{groups.length}</span>
      </div>
      {groups.length > 0 ? (
        groups.map((g) => <GroupCard key={g.id} group={g} pool={pool} />)
      ) : (
        <p className="text-xs text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

const sideName = { hero: "heroes", enemy: "enemies" } as const;

/** round counter, the first-side choice, what happens next, and the pools */
export function TurnOrder() {
  const { state, dispatch } = usePanel();
  const p = pools(state);
  const drawSteel = state.mode === "drawsteel";

  if (state.groups.length === 0) {
    return (
      <>
        <RoundCounter />
        <p className="text-xs text-muted-foreground">
          Nobody in combat yet. Type a group or hero above.
        </p>
      </>
    );
  }

  const prompt = () => {
    if (needsFirstSide(state)) {
      return (
        <div className="space-y-2 rounded-md border border-primary/40 bg-primary/10 p-2">
          <p className="text-xs text-foreground">Roll for initiative. Who goes first?</p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              className="bg-[#2f9e57] text-white hover:bg-[#37b464]"
              onClick={() => dispatch({ type: "setFirstSide", side: "hero" })}
            >
              <Shield className="size-4" /> Heroes first
            </Button>
            <Button
              size="sm"
              className="bg-[#b3202a] text-white hover:bg-[#c9262f]"
              onClick={() => dispatch({ type: "setFirstSide", side: "enemy" })}
            >
              <Skull className="size-4" /> Enemies first
            </Button>
          </div>
        </div>
      );
    }
    if (p.active) return null;
    if (roundComplete(state)) {
      return (
        <Button className="w-full" onClick={() => dispatch({ type: "nextRound" })}>
          <Hourglass className="size-4" /> Start round {state.round + 1}
        </Button>
      );
    }
    if (!drawSteel) return null;
    const side = requiredSide(state);
    return (
      <p className="rounded-md border border-primary/40 bg-primary/10 p-2 text-xs text-foreground">
        {state.goNextId
          ? "Go next is set — that group acts next."
          : side === "hero"
            ? "The heroes pick who acts next."
            : side === "enemy"
              ? "Pick an enemy turn."
              : "Pick who acts next."}
      </p>
    );
  };

  return (
    <div className="space-y-3">
      <RoundCounter />
      {drawSteel && state.firstSide ? (
        <p className="flex items-center gap-1 text-[0.7rem] text-muted-foreground">
          {state.firstSide === "hero" ? "Heroes" : "Enemies"} go first each round.
          <button
            type="button"
            className="underline decoration-dotted hover:text-foreground"
            onClick={() =>
              dispatch({
                type: "setFirstSide",
                side: state.firstSide === "hero" ? "enemy" : "hero",
              })
            }
          >
            Switch to {sideName[state.firstSide === "hero" ? "enemy" : "hero"]}
          </button>
        </p>
      ) : null}
      {prompt()}
      {p.active ? (
        <section className="space-y-2">
          <h3 className="text-xs tracking-widest text-primary uppercase">Active</h3>
          <GroupCard group={p.active} pool="active" />
        </section>
      ) : null}
      <Section
        title={drawSteel ? "Unacted" : "Turn order"}
        groups={p.unacted}
        pool="unacted"
        empty="Everyone has acted."
      />
      <div className="border-t border-border pt-3">
        <Section title="Acted" groups={p.acted} pool="acted" empty="Nobody has acted yet." />
      </div>
      {p.out.length > 0 ? (
        <div className="border-t border-border pt-3">
          <Section title="Dead" groups={p.out} pool="out" />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "resetTurns" })}>
          <Hourglass className="size-4" /> Reset turns
        </Button>
        <Button variant="ghost" size="sm" onClick={() => dispatch({ type: "clearCombat" })}>
          <Swords className="size-4" /> Clear combat
        </Button>
      </div>
    </div>
  );
}

function RoundCounter() {
  const { state, dispatch } = usePanel();
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs tracking-widest text-muted-foreground uppercase">Round</span>
      <span className="font-display text-lg text-primary">{state.round}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Previous round"
          onClick={() => dispatch({ type: "setRound", round: state.round - 1 })}
        >
          <Minus className="size-3.5" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          aria-label="Next round"
          onClick={() => dispatch({ type: "nextRound" })}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}
