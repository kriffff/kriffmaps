import { useRef, useState } from "react";
import { Pencil, ScrollText, Shield, Skull, Users, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  creatures,
  minions,
  newId,
  parseEntry,
  type Member,
  type Side,
} from "@/lib/krismaps/initiative";
import { cn } from "@/lib/utils";

import { firstImage, statBlockKey, usePanel } from "./context";

/** minion squads added from a known-enemy chip start at this size */
const DEFAULT_SQUAD = 4;

const enemyBtn = "bg-[#b3202a] text-white hover:bg-[#c9262f]";
const heroBtn = "bg-[#2f9e57] text-white hover:bg-[#37b464]";

/** fast entry: typed shorthand, pasted stat blocks, and remembered heroes/enemies */
export function AddToCombat() {
  const ctx = usePanel();
  const { state, dispatch } = ctx;
  const [side, setSide] = useState<Side>("enemy");
  const [minion, setMinion] = useState(false);
  const [text, setText] = useState("");
  const [renaming, setRenaming] = useState<{ key: string; text: string } | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const add = (groupSide: Side, member: Member, id?: string) =>
    dispatch({ type: "addGroup", side: groupSide, members: [member], ...(id ? { id } : {}) });

  const submit = () => {
    const parsed = parseEntry(text);
    if (!parsed) return;
    // known heroes/monsters come back at their remembered Stamina when none is typed
    const remembered =
      side === "hero"
        ? (ctx.roster.find((h) => statBlockKey(h.name) === statBlockKey(parsed.name))?.hp ?? 0)
        : ctx.lookupMonster(parsed.name);
    const stamina = parsed.stamina > 0 ? parsed.stamina : remembered;
    if (side === "hero") {
      add("hero", creatures(parsed.name, 1, stamina));
      ctx.rememberHero(parsed.name, stamina);
    } else {
      add(
        "enemy",
        minion
          ? minions(parsed.name, parsed.count, stamina)
          : creatures(parsed.name, parsed.count, stamina),
      );
      ctx.rememberMonster(parsed.name, stamina);
    }
    setText("");
    inputRef.current?.focus();
  };

  /** a pasted stat block becomes a new monster, named and statted by OCR */
  const addFromStatBlock = (files: FileList | null | undefined) => {
    const image = firstImage(files);
    if (!image) return false;
    const taken = new Set(state.groups.flatMap((g) => g.members.map((m) => statBlockKey(m.name))));
    let name = "New monster";
    for (let n = 2; taken.has(statBlockKey(name)); n++) name = `New monster ${n}`;
    const member = minion ? minions(name, DEFAULT_SQUAD, 0) : creatures(name, 1, 0);
    const groupId = newId();
    add("enemy", member, groupId);
    ctx.setStatBlock(name, image);
    void ctx.ocr.read(groupId, member, image);
    return true;
  };

  const commitRename = () => {
    if (!renaming) return;
    const name = renaming.text.trim();
    const from = renaming.key;
    setRenaming(null);
    if (!name || statBlockKey(name) === from) return;
    ctx.renameStatBlock(from, name);
    ctx.renameMonster(from, name);
    for (const g of state.groups) {
      for (const m of g.members) {
        if (g.side === "enemy" && statBlockKey(m.name) === from) {
          dispatch({ type: "renameMember", groupId: g.id, memberId: m.id, name });
        }
      }
    }
  };

  const enemyNames = state.groups
    .filter((g) => g.side === "enemy")
    .flatMap((g) => g.members.map((m) => statBlockKey(m.name)));
  const heroNames = new Set(
    state.groups
      .filter((g) => g.side === "hero")
      .flatMap((g) => g.members.map((m) => statBlockKey(m.name))),
  );
  /** remembered monsters, keyed off the stat blocks pasted in earlier sessions */
  const knownEnemies = Object.keys(ctx.statBlocks)
    .sort()
    .map((key) => ({
      key,
      name: key.replace(/\b\w/g, (ch) => ch.toUpperCase()),
      stamina: ctx.lookupMonster(key),
      inPlay: enemyNames.filter((n) => n === key).length,
    }));

  return (
    <div>
      <Label className="text-xs tracking-widest text-muted-foreground uppercase">
        Add to combat
      </Label>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button
          size="sm"
          variant={side === "enemy" ? "default" : "secondary"}
          className={cn(side === "enemy" && enemyBtn)}
          onClick={() => {
            setSide("enemy");
            inputRef.current?.focus();
          }}
        >
          <Skull className="size-4" /> Enemies
        </Button>
        <Button
          size="sm"
          variant={side === "hero" ? "default" : "secondary"}
          className={cn(side === "hero" && heroBtn)}
          onClick={() => {
            setSide("hero");
            inputRef.current?.focus();
          }}
        >
          <Shield className="size-4" /> Heroes
        </Button>
      </div>
      <div className="mt-2 flex gap-2">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            } else if (e.key === "Tab") {
              e.preventDefault();
              setSide((s) => (s === "enemy" ? "hero" : "enemy"));
            }
          }}
          placeholder={side === "enemy" ? "Goblins x4 40" : "Kris 62"}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-md border-2 bg-background px-3 text-sm outline-none",
            side === "enemy"
              ? "border-[#b3202a] text-[#ff9a9f] placeholder:text-[#ff9a9f]/40"
              : "border-[#2f9e57] text-[#9ff0b8] placeholder:text-[#9ff0b8]/40",
          )}
        />
        {side === "enemy" ? (
          <Button
            size="sm"
            variant={minion ? "default" : "secondary"}
            className={cn("h-9", minion && enemyBtn)}
            aria-pressed={minion}
            title="Add as a minion squad sharing one Stamina pool"
            onClick={() => setMinion((v) => !v)}
          >
            <Users className="size-4" /> Minions
          </Button>
        ) : null}
      </div>
      <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
        Name, then optional <span className="text-primary">x4</span> count and Stamina
        {side === "enemy" && minion ? " per minion" : ""}. Enter to add, Tab to swap side.
      </p>

      {side === "enemy" ? (
        <div
          role="button"
          tabIndex={0}
          onPaste={(e) => {
            if (addFromStatBlock(e.clipboardData?.files)) e.preventDefault();
          }}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border-2 border-dashed border-[#b3202a]/60 px-3 py-3 text-[0.7rem] text-[#ff9a9f]/80 outline-none hover:border-[#b3202a] focus-visible:border-[#b3202a]"
        >
          <ScrollText className="size-4" />
          Click here then Ctrl+V a stat block to add a monster
        </div>
      ) : null}

      {side === "enemy" && knownEnemies.length > 0 ? (
        <div className="mt-3">
          <Label className="text-xs tracking-widest text-muted-foreground uppercase">
            Known enemies
          </Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {knownEnemies.map((enemy) => (
              <span
                key={enemy.key}
                className={cn(
                  "flex items-center rounded-md border border-[#b3202a]/70 bg-[#b3202a]/10 pl-1.5 text-xs",
                  enemy.inPlay > 0 && "opacity-50",
                )}
              >
                {renaming?.key === enemy.key ? (
                  <input
                    autoFocus
                    aria-label="New name"
                    value={renaming.text}
                    onChange={(e) => setRenaming({ key: enemy.key, text: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      else if (e.key === "Escape") setRenaming(null);
                    }}
                    onBlur={commitRename}
                    className="mx-1 my-0.5 h-6 w-28 rounded border border-input bg-background px-1 text-xs text-foreground outline-none"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      add(
                        "enemy",
                        minion
                          ? minions(enemy.name, DEFAULT_SQUAD, enemy.stamina)
                          : creatures(enemy.name, 1, enemy.stamina),
                      )
                    }
                    title={`Add ${minion ? `a squad of ${DEFAULT_SQUAD} ` : ""}${enemy.name}${enemy.stamina ? ` (${enemy.stamina} Stamina)` : ""}`}
                    className="flex items-center gap-1 py-1 text-[#ff9a9f]"
                  >
                    <Skull className="size-3" />
                    {enemy.name}
                    {enemy.stamina > 0 ? (
                      <span className="tabular-nums opacity-70">{enemy.stamina}</span>
                    ) : null}
                    {enemy.inPlay > 0 ? (
                      <span className="rounded bg-[#b3202a] px-1 text-[0.6rem] text-white">
                        {enemy.inPlay}
                      </span>
                    ) : null}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRenaming({ key: enemy.key, text: enemy.name })}
                  title={`Rename ${enemy.name}`}
                  className="px-1 py-1 text-muted-foreground hover:text-primary"
                >
                  <Pencil className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    ctx.clearStatBlock(enemy.key);
                    ctx.forgetMonster(enemy.key);
                  }}
                  title={`Forget ${enemy.name}`}
                  className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {side === "hero" && ctx.roster.length > 0 ? (
        <div className="mt-3">
          <Label className="text-xs tracking-widest text-muted-foreground uppercase">
            Known heroes
          </Label>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ctx.roster.map((hero) => {
              const already = heroNames.has(statBlockKey(hero.name));
              return (
                <span
                  key={hero.name}
                  className={cn(
                    "flex items-center rounded-md border border-[#2f9e57]/70 bg-[#2f9e57]/10 pl-1.5 text-xs",
                    already && "opacity-40",
                  )}
                >
                  <button
                    type="button"
                    disabled={already}
                    onClick={() => add("hero", creatures(hero.name, 1, hero.hp))}
                    title={already ? "Already in combat" : `Add ${hero.name} (${hero.hp} Stamina)`}
                    className="flex items-center gap-1 py-1 text-[#9ff0b8] disabled:cursor-not-allowed"
                  >
                    <Shield className="size-3" />
                    {hero.name}
                    <span className="tabular-nums opacity-70">{hero.hp}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => ctx.forgetHero(hero.name)}
                    title={`Forget ${hero.name}`}
                    className="px-1.5 py-1 text-muted-foreground hover:text-destructive"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}
