import { useState } from "react";
import { ImagePlus, Minus, Pencil, Plus, Split, Trash2, Users } from "lucide-react";

import { Button } from "@/components/ui/button";
import { bloodiedCount, minionsLeft, type Group, type Member } from "@/lib/krismaps/initiative";
import { cn } from "@/lib/utils";

import { statBlockKey, usePanel } from "./context";
import { Conditions } from "./Conditions";
import { StaminaInput } from "./StaminaInput";
import { StatBlock } from "./StatBlock";

const badge =
  "rounded bg-destructive px-1.5 py-0.5 text-[0.6rem] tracking-widest text-destructive-foreground uppercase";

interface Props {
  group: Group;
  member: Member;
  /** stat blocks open by default while this group is taking its turn */
  active: boolean;
  /** show the name row (always for multi-member groups) */
  showName: boolean;
}

/** one creature type inside a turn group: name, count, Stamina and stat block */
export function MemberCard({ group, member, active, showName }: Props) {
  const ctx = usePanel();
  const { dispatch } = ctx;
  const ids = { groupId: group.id, memberId: member.id };
  const enemy = group.side === "enemy";
  const [renaming, setRenaming] = useState<string | null>(null);
  const [arming, setArming] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const [wasActive, setWasActive] = useState(active);
  // a manual open/close holds until the turn changes
  if (wasActive !== active) {
    setWasActive(active);
    setOpen(null);
  }
  const hasBlock = !!ctx.statBlocks[statBlockKey(member.name)];
  const multi = group.members.length > 1;

  const rename = (to: string) => {
    setRenaming(null);
    const name = to.trim();
    if (!name || statBlockKey(name) === statBlockKey(member.name)) return;
    if (enemy) {
      ctx.renameStatBlock(member.name, name);
      ctx.renameMonster(member.name, name);
    }
    dispatch({ type: "renameMember", ...ids, name });
  };

  const setMax = (maxStamina: number) => {
    dispatch({ type: "setMaxStamina", ...ids, maxStamina });
    if (enemy) ctx.rememberMonster(member.name, maxStamina);
    else ctx.rememberHero(member.name, maxStamina);
  };

  const count = member.kind === "minions" ? member.count : member.stamina.length;

  return (
    <div className={cn(multi && "mt-2 rounded-md border border-border/60 p-1.5")}>
      {showName || renaming !== null ? (
        <div className="flex items-center gap-1">
          {renaming !== null ? (
            <input
              autoFocus
              aria-label="New name"
              value={renaming}
              onChange={(e) => setRenaming(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") rename(renaming);
                else if (e.key === "Escape") setRenaming(null);
              }}
              onBlur={() => rename(renaming)}
              className="h-6 min-w-0 flex-1 rounded border border-input bg-background px-1.5 text-xs text-foreground outline-none"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
              {member.name}
              {member.kind === "minions" ? (
                <span className="ml-1 text-[0.65rem] text-muted-foreground uppercase">minions</span>
              ) : null}
            </span>
          )}
        </div>
      ) : null}

      {member.info ? (
        <p className="mt-0.5 text-[0.65rem] text-muted-foreground">{member.info}</p>
      ) : null}

      <div className="mt-1 flex flex-wrap items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          className="size-6"
          title={`Rename ${member.name}`}
          onClick={() => setRenaming(member.name)}
        >
          <Pencil className="size-3.5" />
        </Button>
        {enemy ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title={hasBlock ? "Replace stat block (Ctrl+V)" : "Add stat block (Ctrl+V)"}
              onClick={() => setArming((v) => !v)}
            >
              <ImagePlus className={cn("size-3.5", hasBlock && "text-primary")} />
            </Button>
            <Button
              size="sm"
              variant={member.kind === "minions" ? "default" : "ghost"}
              className="h-6 px-1.5 text-[0.65rem]"
              title={
                member.kind === "minions"
                  ? "Minion squad sharing one Stamina pool — click to track individually"
                  : "Make this a minion squad with a shared Stamina pool"
              }
              onClick={() =>
                dispatch({ type: "setMinion", ...ids, minion: member.kind !== "minions" })
              }
            >
              <Users className="size-3" /> Minions
            </Button>
          </>
        ) : null}
        {multi ? (
          <>
            <Button
              size="icon"
              variant="ghost"
              className="ml-auto size-6"
              title={`Give ${member.name} its own turn`}
              onClick={() => dispatch({ type: "splitMember", ...ids })}
            >
              <Split className="size-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="size-6"
              title={`Remove ${member.name}`}
              onClick={() => dispatch({ type: "removeMember", ...ids })}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </>
        ) : null}
      </div>

      {enemy || count > 1 ? (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-16">{member.kind === "minions" ? "Minions" : "Count"}</span>
          <Button
            size="icon"
            variant="secondary"
            className="size-6"
            aria-label="Fewer"
            onClick={() =>
              count <= 1 && !multi
                ? dispatch({ type: "removeGroup", groupId: group.id })
                : count <= 1
                  ? dispatch({ type: "removeMember", ...ids })
                  : dispatch({ type: "setCount", ...ids, count: count - 1 })
            }
          >
            <Minus className="size-3" />
          </Button>
          <span className="w-6 text-center tabular-nums text-foreground">{count}</span>
          <Button
            size="icon"
            variant="secondary"
            className="size-6"
            aria-label="More"
            onClick={() => dispatch({ type: "setCount", ...ids, count: count + 1 })}
          >
            <Plus className="size-3" />
          </Button>
          {member.kind === "minions" ? (
            <span className="ml-auto text-[0.65rem]">
              <span className="text-foreground tabular-nums">{minionsLeft(member)}</span> of {count}{" "}
              left
            </span>
          ) : bloodiedCount(member) > 0 ? (
            <span className={cn("ml-auto", badge)}>
              {count > 1 ? `${bloodiedCount(member)} bloodied` : "Bloodied"}
            </span>
          ) : null}
        </div>
      ) : null}

      {member.kind === "minions" ? (
        <>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-16">Per minion</span>
            <input
              type="number"
              aria-label="Stamina per minion"
              value={member.maxStamina}
              onChange={(e) => setMax(Number(e.target.value) || 0)}
              className="h-6 w-14 rounded border border-input bg-background px-1 text-right text-xs text-foreground"
            />
          </div>
          <StaminaInput
            label="Squad pool"
            value={member.pool}
            max={member.maxStamina > 0 ? `/ ${member.count * member.maxStamina}` : undefined}
            onChange={(value) => dispatch({ type: "setPool", ...ids, value })}
            danger={member.maxStamina > 0 && member.pool === 0}
          />
        </>
      ) : member.stamina.length === 1 ? (
        <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
          <span className="w-16">Stamina</span>
          <Button
            size="icon"
            variant="secondary"
            className="size-6"
            aria-label="Stamina down"
            onClick={() =>
              dispatch({ type: "setStamina", ...ids, index: 0, value: member.stamina[0]! - 1 })
            }
          >
            <Minus className="size-3" />
          </Button>
          <input
            type="number"
            aria-label="Stamina"
            value={member.stamina[0]}
            onChange={(e) =>
              dispatch({ type: "setStamina", ...ids, index: 0, value: Number(e.target.value) || 0 })
            }
            className="h-6 w-14 rounded border border-input bg-background px-1 text-right text-xs text-foreground"
          />
          <span className="text-foreground/60">/</span>
          <input
            type="number"
            aria-label="Max Stamina"
            value={member.maxStamina}
            onChange={(e) => setMax(Number(e.target.value) || 0)}
            className="h-6 w-14 rounded border border-input bg-background px-1 text-right text-xs text-foreground"
          />
          <Button
            size="icon"
            variant="secondary"
            className="ml-auto size-6"
            aria-label="Stamina up"
            onClick={() =>
              dispatch({ type: "setStamina", ...ids, index: 0, value: member.stamina[0]! + 1 })
            }
          >
            <Plus className="size-3" />
          </Button>
        </div>
      ) : (
        <>
          <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="w-16">Max each</span>
            <input
              type="number"
              aria-label="Max Stamina each"
              value={member.maxStamina}
              onChange={(e) => setMax(Number(e.target.value) || 0)}
              className="h-6 w-14 rounded border border-input bg-background px-1 text-right text-xs text-foreground"
            />
          </div>
          {member.stamina.map((value, index) => (
            <StaminaInput
              key={index}
              label={`#${index + 1}`}
              value={value}
              max={`/ ${member.maxStamina}`}
              onChange={(v) => dispatch({ type: "setStamina", ...ids, index, value: v })}
              danger={member.maxStamina > 0 && value === 0}
              badge={
                member.maxStamina > 0 && value > 0 && value <= member.maxStamina / 2 ? (
                  <span className="rounded bg-destructive px-1 py-0.5 text-[0.55rem] tracking-widest text-destructive-foreground uppercase">
                    Bl
                  </span>
                ) : null
              }
            />
          ))}
        </>
      )}

      <Conditions group={group} member={member} />

      {enemy ? (
        <StatBlock
          groupId={group.id}
          member={member}
          expanded={open ?? active}
          onToggle={() => setOpen(!(open ?? active))}
          arming={arming}
          onArmed={() => {
            setArming(false);
            setOpen(true);
          }}
        />
      ) : null}
    </div>
  );
}
