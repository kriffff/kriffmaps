import { createContext, useContext, useState } from "react";

import type { InitiativeAction, InitiativeState, Member } from "@/lib/krismaps/initiative";
import type { RosterHero } from "@/lib/krismaps/roster";
import type { StatBlockRead } from "@/lib/krismaps/statblockParse";

export interface PanelContext {
  state: InitiativeState;
  dispatch: (action: InitiativeAction) => void;
  /** remembered heroes (name + max Stamina) */
  roster: RosterHero[];
  rememberHero: (name: string, stamina: number) => void;
  forgetHero: (name: string) => void;
  /** remembered monster max Stamina, keyed by lower-cased name */
  rememberMonster: (name: string, stamina: number) => void;
  lookupMonster: (name: string) => number;
  renameMonster: (from: string, to: string) => void;
  forgetMonster: (name: string) => void;
  /** stat block images: lower-cased monster name -> object URL */
  statBlocks: Record<string, string>;
  setStatBlock: (name: string, image: Blob) => void;
  clearStatBlock: (name: string) => void;
  renameStatBlock: (from: string, to: string) => void;
  ocr: StatBlockReader;
}

export const Panel = createContext<PanelContext | null>(null);

export function usePanel(): PanelContext {
  const ctx = useContext(Panel);
  if (!ctx) throw new Error("usePanel must be used inside the initiative panel");
  return ctx;
}

export const statBlockKey = (name: string) => name.trim().toLowerCase();

export interface StatBlockReader {
  busy: Record<string, boolean>;
  failed: Record<string, boolean>;
  /** reads a stat block image and applies its name and Stamina to the member */
  read: (groupId: string, member: Member, image: Blob) => Promise<void>;
}

/**
 * On-device OCR of pasted stat blocks. Side effects (remembering Stamina,
 * moving the stored image to the read name) happen here, after the read,
 * never inside a state update.
 */
export function useStatBlockReader(
  deps: Pick<
    PanelContext,
    "dispatch" | "lookupMonster" | "rememberMonster" | "renameStatBlock" | "renameMonster"
  >,
): StatBlockReader {
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  const read = async (groupId: string, member: Member, image: Blob) => {
    setBusy((p) => ({ ...p, [member.id]: true }));
    setFailed((p) => ({ ...p, [member.id]: false }));
    try {
      const { recognizeStatBlock } = await import("@/lib/krismaps/statblock");
      const result = await recognizeStatBlock(image);
      if (!result.name && result.stamina === undefined) {
        setFailed((p) => ({ ...p, [member.id]: true }));
        return;
      }
      const name = result.name;
      const stamina = result.stamina ?? (name ? deps.lookupMonster(name) || undefined : undefined);
      if (name && statBlockKey(name) !== statBlockKey(member.name)) {
        deps.renameStatBlock(member.name, name);
        deps.renameMonster(member.name, name);
      }
      if (name && stamina) deps.rememberMonster(name, stamina);
      deps.dispatch({
        type: "applyStatBlock",
        groupId,
        memberId: member.id,
        name,
        maxStamina: stamina,
        info: statBlockInfo(result),
        squadSize: result.organization === "Minion" ? result.squadSize : undefined,
        solo: result.organization === "Solo",
      });
    } catch {
      setFailed((p) => ({ ...p, [member.id]: true }));
    } finally {
      setBusy((p) => ({ ...p, [member.id]: false }));
    }
  };

  return { busy, failed, read };
}

/** "Level 4 Minion Artillery · EV 6" from what the stat block reader found */
export function statBlockInfo(read: StatBlockRead): string | undefined {
  const title = [
    read.level !== undefined ? `Level ${read.level}` : undefined,
    read.organization,
    read.role,
  ]
    .filter(Boolean)
    .join(" ");
  const ev = read.ev !== undefined ? `EV ${read.ev}` : undefined;
  return [title, ev].filter(Boolean).join(" · ") || undefined;
}

/** the first image in a paste or file-picker payload */
export function firstImage(files: FileList | null | undefined): File | undefined {
  return files ? Array.from(files).find((f) => f.type.startsWith("image/")) : undefined;
}
