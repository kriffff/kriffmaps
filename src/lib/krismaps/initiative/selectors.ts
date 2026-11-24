/**
 * Everything the UI shows about initiative is derived here from the stored
 * state; none of it is stored itself, so it can never fall out of step.
 */
import {
  opposite,
  turnsOf,
  turnsTakenOf,
  type Group,
  type InitiativeState,
  type Member,
  type Side,
} from "./model";

/** minions still standing in a squad */
export function minionsLeft(m: Extract<Member, { kind: "minions" }>): number {
  if (m.maxStamina <= 0) return m.count;
  return Math.min(m.count, Math.ceil(Math.max(0, m.pool) / m.maxStamina));
}

/** creatures (or minions) of this member still standing */
export function aliveCount(m: Member): number {
  if (m.kind === "minions") return minionsLeft(m);
  if (m.maxStamina <= 0) return m.stamina.length;
  return m.stamina.filter((s) => s > 0).length;
}

/** total creatures in the member, standing or not */
export function totalCount(m: Member): number {
  return m.kind === "minions" ? m.count : m.stamina.length;
}

/** creatures at or below half Stamina and still standing (minions are never bloodied) */
export function bloodiedCount(m: Member): number {
  if (m.kind === "minions" || m.maxStamina <= 0) return 0;
  return m.stamina.filter((s) => s > 0 && s <= m.maxStamina / 2).length;
}

export function isMemberDown(m: Member): boolean {
  return m.maxStamina > 0 && aliveCount(m) === 0;
}

/**
 * A group is out of the fight when every enemy in it is dead. Heroes on 0
 * Stamina are dying, not out, so hero groups never drop out.
 */
export function isOut(g: Group): boolean {
  return g.side === "enemy" && g.members.length > 0 && g.members.every(isMemberDown);
}

/** e.g. "Bone Rattler ×3 + Grave Captain" */
export function groupLabel(g: Group): string {
  return g.members
    .map((m) => {
      const n = m.kind === "minions" ? minionsLeft(m) : totalCount(m);
      return n > 1 || m.kind === "minions" ? `${m.name} ×${n}` : m.name;
    })
    .join(" + ");
}

export function inFight(state: InitiativeState): Group[] {
  return state.groups.filter((g) => !isOut(g));
}

/** Draw Steel needs the first side chosen before anyone can act */
export function needsFirstSide(state: InitiativeState): boolean {
  return state.mode === "drawsteel" && state.firstSide === null && state.groups.length > 0;
}

/** the side whose turn it is (before overrides), or null if either may act */
export function sideToAct(state: InitiativeState): Side | null {
  if (state.mode !== "drawsteel") return null;
  if (state.lastSide) return opposite(state.lastSide);
  return state.firstSide;
}

/** ids of groups that may legally start the next turn */
export function eligibleIds(state: InitiativeState): string[] {
  if (state.activeId) return [];
  // Draw Steel: nothing happens until the Director taps who goes first
  if (state.mode === "drawsteel" && state.firstSide === null) return [];
  const remaining = inFight(state).filter((g) => !g.acted);
  if (remaining.length === 0) return [];
  // the Director's override may even give a solo back-to-back turns
  if (state.goNextId && remaining.some((g) => g.id === state.goNextId)) return [state.goNextId];
  const available = waiting(state);
  if (available.length === 0) return [];
  if (state.mode === "dnd") return [available[0]!.id];
  const want = sideToAct(state)!;
  const wanted = available.filter((g) => g.side === want);
  // when one side has nobody left to act, the other side's groups act back to back
  return (wanted.length > 0 ? wanted : available).map((g) => g.id);
}

/** the side that must pick next, when only one side has eligible groups */
export function requiredSide(state: InitiativeState): Side | null {
  const ids = new Set(eligibleIds(state));
  const sides = new Set(state.groups.filter((g) => ids.has(g.id)).map((g) => g.side));
  return sides.size === 1 ? [...sides][0]! : null;
}

/**
 * Malice gained at the start of a round: one per hero in the battle plus the
 * round number (Draw Steel). Dying heroes are still in the battle.
 */
export function maliceForRound(state: InitiativeState, round: number): number {
  const heroes = state.groups
    .filter((g) => g.side === "hero")
    .reduce((n, g) => n + g.members.reduce((k, m) => k + totalCount(m), 0), 0);
  return heroes + round;
}

/** turns a group still has this round */
export function turnsLeft(g: Group): number {
  return Math.max(0, turnsOf(g) - turnsTakenOf(g));
}

/**
 * Groups still to act this round that may take the next turn: a group with
 * turns left (a solo) can't take two turns in a row.
 */
function waiting(state: InitiativeState): Group[] {
  return inFight(state).filter((g) => !g.acted && g.id !== state.lastGroupId);
}

/**
 * Everyone still fighting has had their turns. A solo whose remaining turn
 * would have to come straight after its own last turn doesn't hold the round
 * open (the Director can still force it with "go next").
 */
export function roundComplete(state: InitiativeState): boolean {
  return inFight(state).length > 0 && !state.activeId && waiting(state).length === 0;
}

export interface Pools {
  active: Group | null;
  unacted: Group[];
  acted: Group[];
  out: Group[];
}

/** the Director's lists, each in list order */
export function pools(state: InitiativeState): Pools {
  const active = state.groups.find((g) => g.id === state.activeId) ?? null;
  return {
    active,
    unacted: state.groups.filter((g) => g !== active && !g.acted && !isOut(g)),
    acted: state.groups.filter((g) => g !== active && g.acted && !isOut(g)),
    out: state.groups.filter((g) => g !== active && isOut(g)),
  };
}

/**
 * The Map View's order. Draw Steel: [active] | [still to act] | [acted], with
 * dead enemies hidden. D&D: the fixed list order.
 */
export function overlaySections(state: InitiativeState): Group[][] {
  if (state.mode === "dnd") return [inFight(state)].filter((s) => s.length > 0);
  const p = pools(state);
  const active = p.active && !isOut(p.active) ? [p.active] : [];
  return [active, p.unacted, p.acted].filter((s) => s.length > 0);
}
