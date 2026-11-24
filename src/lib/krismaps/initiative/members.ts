/** Pure edits to a single member's Stamina, count and type. */
import type { CreatureMember, Member, MinionMember } from "./model";

const int = (n: number) => (Number.isFinite(n) ? Math.floor(n) : 0);
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** sets one creature's Stamina, clamped to 0..max (no upper bound while max is unknown) */
export function setCreatureStamina(
  m: CreatureMember,
  index: number,
  value: number,
): CreatureMember {
  if (index < 0 || index >= m.stamina.length) return m;
  const hi = m.maxStamina > 0 ? m.maxStamina : Number.MAX_SAFE_INTEGER;
  const stamina = [...m.stamina];
  stamina[index] = clamp(int(value), 0, hi);
  return { ...m, stamina };
}

export function setPool(m: MinionMember, value: number): MinionMember {
  const hi = m.maxStamina > 0 ? m.count * m.maxStamina : Number.MAX_SAFE_INTEGER;
  return { ...m, pool: clamp(int(value), 0, hi) };
}

/** changes how many creatures/minions there are; new ones arrive at full Stamina */
export function setCount(m: Member, count: number): Member {
  const n = Math.max(1, int(count));
  if (m.kind === "minions") {
    const pool = m.pool + (n - m.count) * m.maxStamina;
    return setPool({ ...m, count: n }, pool);
  }
  const stamina = m.stamina.slice(0, n);
  while (stamina.length < n) stamina.push(m.maxStamina);
  return { ...m, stamina };
}

/**
 * Changes max Stamina. While the max was unknown (0), everyone starts at the
 * new value; otherwise current Stamina is only capped.
 */
export function setMaxStamina(m: Member, maxStamina: number): Member {
  const max = Math.max(0, int(maxStamina));
  if (m.kind === "minions") {
    const pool = m.maxStamina > 0 ? Math.min(m.pool, m.count * max) : m.count * max;
    return { ...m, maxStamina: max, pool };
  }
  const stamina =
    m.maxStamina > 0 ? m.stamina.map((s) => Math.min(s, max)) : m.stamina.map(() => max);
  return { ...m, maxStamina: max, stamina };
}

export interface StatBlockUpdate {
  name?: string | undefined;
  maxStamina?: number | undefined;
  info?: string | undefined;
  /** the stat block is a minion's: individually tracked creatures become a squad of this size */
  squadSize?: number | undefined;
  /** the stat block is a solo monster's: its group takes two turns a round */
  solo?: boolean | undefined;
}

/** a freshly read stat block: new name, info and/or max, everyone back to full */
export function applyStatBlock(m: Member, update: StatBlockUpdate): Member {
  const { name, maxStamina, info, squadSize } = update;
  let next: Member = name ? { ...m, name } : m;
  if (info) next = { ...next, info };
  if (squadSize && next.kind === "creatures") {
    next = setCount(setMinion(next, true), squadSize);
  }
  if (maxStamina !== undefined && maxStamina > 0) {
    next =
      next.kind === "minions"
        ? { ...next, maxStamina, pool: next.count * maxStamina }
        : { ...next, maxStamina, stamina: next.stamina.map(() => maxStamina) };
  }
  return next;
}

/** converts between individually tracked creatures and a minion squad */
export function setMinion(m: Member, minion: boolean): Member {
  if (minion && m.kind === "creatures") {
    return {
      ...(m.info ? { info: m.info } : {}),
      ...(m.conditions ? { conditions: m.conditions } : {}),
      id: m.id,
      kind: "minions",
      name: m.name,
      maxStamina: m.maxStamina,
      count: m.stamina.length,
      pool: m.stamina.reduce((a, b) => a + b, 0),
    };
  }
  if (!minion && m.kind === "minions") {
    // spread the pool over the standing minions, fullest first
    const stamina: number[] = [];
    let left = m.pool;
    for (let i = 0; i < m.count; i++) {
      const s = m.maxStamina > 0 ? Math.min(m.maxStamina, left) : 0;
      stamina.push(Math.max(0, s));
      left -= s;
    }
    return {
      ...(m.info ? { info: m.info } : {}),
      ...(m.conditions ? { conditions: m.conditions } : {}),
      id: m.id,
      kind: "creatures",
      name: m.name,
      maxStamina: m.maxStamina,
      stamina,
    };
  }
  return m;
}
