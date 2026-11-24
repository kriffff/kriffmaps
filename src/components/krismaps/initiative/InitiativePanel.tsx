import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import type { InitiativeAction, InitiativeState } from "@/lib/krismaps/initiative";
import { useMonsterMemory, type RosterHero } from "@/lib/krismaps/roster";

import { AddToCombat } from "./AddToCombat";
import { MalicePanel } from "./MalicePanel";
import { Panel, useStatBlockReader, type PanelContext } from "./context";
import { OverlaySettings } from "./OverlaySettings";
import { TurnOrder } from "./TurnOrder";

interface Props {
  state: InitiativeState;
  dispatch: (action: InitiativeAction) => void;
  roster: RosterHero[];
  onRememberHero: (name: string, stamina: number) => void;
  onForgetHero: (name: string) => void;
  /** monster name (lower-cased) -> object URL of its stat block image */
  statBlocks: Record<string, string>;
  onSetStatBlock: (name: string, image: Blob) => void;
  onClearStatBlock: (name: string) => void;
  onRenameStatBlock: (from: string, to: string) => void;
}

/** the Director's initiative tracker (Stage sidebar → Initiative tab) */
export function InitiativePanel(props: Props) {
  const memory = useMonsterMemory();
  const base = {
    state: props.state,
    dispatch: props.dispatch,
    roster: props.roster,
    rememberHero: props.onRememberHero,
    forgetHero: props.onForgetHero,
    rememberMonster: memory.remember,
    lookupMonster: memory.lookup,
    renameMonster: memory.rename,
    forgetMonster: memory.forget,
    statBlocks: props.statBlocks,
    setStatBlock: props.onSetStatBlock,
    clearStatBlock: props.onClearStatBlock,
    renameStatBlock: props.onRenameStatBlock,
  };
  const ocr = useStatBlockReader(base);
  const ctx: PanelContext = { ...base, ocr };
  const { state, dispatch } = props;

  return (
    <Panel.Provider value={ctx}>
      <div className="space-y-5">
        <div>
          <Label className="text-xs tracking-widest text-muted-foreground uppercase">
            Initiative method
          </Label>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(
              [
                { key: "drawsteel", label: "Draw Steel" },
                { key: "dnd", label: "D&D" },
              ] as const
            ).map((m) => (
              <Button
                key={m.key}
                size="sm"
                variant={state.mode === m.key ? "default" : "secondary"}
                onClick={() => dispatch({ type: "setMode", mode: m.key })}
              >
                {m.label}
              </Button>
            ))}
          </div>
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
            {state.mode === "drawsteel"
              ? "Sides alternate; the acting side picks any turn that hasn't gone. The side that goes first in round 1 goes first every round. When one side is spent, the rest act back to back."
              : "Fixed turn order: entries act top to bottom down the list."}
          </p>
        </div>

        <Separator />
        <AddToCombat />
        <Separator />
        {state.mode === "drawsteel" ? (
          <>
            <MalicePanel />
            <Separator />
          </>
        ) : null}
        <TurnOrder />
        <Separator />
        <OverlaySettings />
      </div>
    </Panel.Provider>
  );
}
