/**
 * Initiative data model.
 *
 * An encounter is a list of turn groups. A group is what acts on one turn: a
 * hero, or (on the Director's side) any set of enemies the Director chooses to
 * activate together, e.g. a minion squad with its captain, or two ogres.
 *
 * A group holds members. A member is either
 *  - "creatures": one or more individually tracked creatures of one kind (a
 *    hero, a monster, a captain, or N copies of a non-minion monster), each with
 *    its own Stamina; or
 *  - "minions": a squad of N minions of one kind sharing one Stamina pool. A
 *    minion dies for each full minion's worth of Stamina lost.
 */
export type Side = "hero" | "enemy";

/**
 * "drawsteel": sides alternate, the acting side picks any unacted group, and the
 * side that went first in round 1 goes first every round.
 * "dnd": a fixed turn order, top to bottom.
 */
export type InitiativeMode = "drawsteel" | "dnd";

export type OverlayOrientation = "vertical" | "horizontal";
export type OverlayRotation = 0 | 90 | 180 | 270;

/** Draw Steel conditions, plus "Marked" which many abilities apply */
export const CONDITIONS = [
  "Bleeding",
  "Dazed",
  "Frightened",
  "Grabbed",
  "Prone",
  "Restrained",
  "Slowed",
  "Taunted",
  "Weakened",
  "Marked",
] as const;

/**
 * "eot": ends at the end of the affected creature's turn.
 * "save": save ends: a saving throw is due at the end of each of its turns.
 * "manual": lasts until removed (e.g. "until the end of the encounter").
 */
export type ConditionDuration = "eot" | "save" | "manual";

export interface Condition {
  id: string;
  name: string;
  duration: ConditionDuration;
  /** save ends: the creature's turn just ended and its saving throw hasn't been resolved */
  saveDue?: boolean;
}

export interface CreatureMember {
  id: string;
  kind: "creatures";
  name: string;
  /** e.g. "Level 1 Leader · EV 12", read from the stat block */
  info?: string;
  conditions?: Condition[];
  /** max Stamina per creature; 0 = unknown */
  maxStamina: number;
  /** current Stamina of each creature; the length is the number of creatures */
  stamina: number[];
}

export interface MinionMember {
  id: string;
  kind: "minions";
  name: string;
  /** e.g. "Level 4 Minion Artillery · EV 6", read from the stat block */
  info?: string;
  conditions?: Condition[];
  /** Stamina of one minion; 0 = unknown */
  maxStamina: number;
  /** minions the squad started with */
  count: number;
  /** current shared Stamina pool, 0..count * maxStamina */
  pool: number;
}

export type Member = CreatureMember | MinionMember;

export interface Group {
  id: string;
  side: Side;
  members: Member[];
  /** done for this round (every turn it gets this round has been taken) */
  acted: boolean;
  /** turns per round; solo monsters get 2. Absent = 1 */
  turns?: number;
  /** turns taken so far this round. Absent = 0 */
  turnsTaken?: number;
}

export const turnsOf = (g: Group) => g.turns ?? 1;
export const turnsTakenOf = (g: Group) => g.turnsTaken ?? 0;

export interface OverlayLayout {
  visible: boolean;
  orientation: OverlayOrientation;
  /** 0.5 – 2 */
  scale: number;
  rotation: OverlayRotation;
  /** centre position as a fraction of the screen */
  x: number;
  y: number;
}

export const STATE_VERSION = 2;

export interface InitiativeState {
  version: typeof STATE_VERSION;
  mode: InitiativeMode;
  groups: Group[];
  round: number;
  /** Draw Steel: the side that goes first every round; null until combat starts */
  firstSide: Side | null;
  /** the group taking its turn right now */
  activeId: string | null;
  /** side of the most recently finished turn this round */
  lastSide: Side | null;
  /** group that took the most recent turn this round; it can't go again straight away */
  lastGroupId: string | null;
  /** Director override: this group may act next regardless of sides */
  goNextId: string | null;
  /** Draw Steel: the Director's Malice */
  malice: number;
  /** Draw Steel: the heroes' average Victories, added to Malice when combat starts */
  victories: number;
  layout: OverlayLayout;
}

export const defaultLayout: OverlayLayout = {
  visible: true,
  orientation: "vertical",
  scale: 1,
  rotation: 0,
  x: 0.12,
  y: 0.5,
};

export const emptyInitiative: InitiativeState = {
  version: STATE_VERSION,
  mode: "drawsteel",
  groups: [],
  round: 1,
  firstSide: null,
  activeId: null,
  lastSide: null,
  lastGroupId: null,
  goNextId: null,
  malice: 0,
  victories: 0,
  layout: defaultLayout,
};

export function newId() {
  return Math.random().toString(36).slice(2, 10);
}

export const opposite = (side: Side): Side => (side === "hero" ? "enemy" : "hero");

export function creatures(name: string, count: number, maxStamina: number): CreatureMember {
  const n = Math.max(1, Math.floor(count) || 1);
  const max = Math.max(0, Math.floor(maxStamina) || 0);
  return { id: newId(), kind: "creatures", name, maxStamina: max, stamina: Array(n).fill(max) };
}

export function minions(name: string, count: number, maxStamina: number): MinionMember {
  const n = Math.max(1, Math.floor(count) || 1);
  const max = Math.max(0, Math.floor(maxStamina) || 0);
  return { id: newId(), kind: "minions", name, maxStamina: max, count: n, pool: n * max };
}

export function group(side: Side, members: Member[]): Group {
  return { id: newId(), side, members, acted: false };
}
