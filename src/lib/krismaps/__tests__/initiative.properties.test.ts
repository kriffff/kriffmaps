/**
 * Property-based tests: thousands of random encounters and random sequences of
 * Director actions, with the rules' invariants checked after every step.
 */
import { describe, expect, test } from "bun:test";
import fc from "fast-check";

import {
  creatures,
  eligibleIds,
  emptyInitiative,
  inFight,
  initiativeReducer,
  minions,
  normalizeInitiative,
  roundComplete,
  maliceForRound,
  sideToAct,
  turnsOf,
  turnsTakenOf,
  type Group,
  type InitiativeAction,
  type InitiativeState,
  type Member,
  type Side,
} from "../initiative";

// ---------- generators ----------

const memberArb: fc.Arbitrary<Member> = fc
  .record({
    minion: fc.boolean(),
    name: fc.constantFrom("Goblin", "Ogre", "Rat", "Captain", "Kris", "Ana"),
    count: fc.integer({ min: 1, max: 4 }),
    stamina: fc.integer({ min: 0, max: 20 }),
  })
  .map(({ minion, name, count, stamina }) =>
    minion ? minions(name, count, stamina) : creatures(name, count, stamina),
  );

const groupArb = (side: Side): fc.Arbitrary<Group> =>
  fc
    .record({
      members: fc.array(memberArb, { minLength: 1, maxLength: side === "hero" ? 1 : 3 }),
      // roughly one enemy group in five is a solo with two turns a round
      solo: fc.integer({ min: 0, max: 4 }).map((n) => side === "enemy" && n === 0),
    })
    .map(({ members, solo }) => ({
      id: Math.random().toString(36).slice(2),
      side,
      members,
      acted: false,
      ...(solo ? { turns: 2 } : {}),
    }));

const encounterArb: fc.Arbitrary<InitiativeState> = fc
  .record({
    heroes: fc.array(groupArb("hero"), { minLength: 0, maxLength: 4 }),
    enemies: fc.array(groupArb("enemy"), { minLength: 0, maxLength: 5 }),
    firstSide: fc.constantFrom<Side | null>("hero", "enemy", null),
    mode: fc.constantFrom<InitiativeState["mode"]>("drawsteel", "drawsteel", "dnd"),
  })
  .chain(({ heroes, enemies, firstSide, mode }) =>
    fc
      .shuffledSubarray([...heroes, ...enemies], {
        minLength: heroes.length + enemies.length,
      })
      .map((groups) => ({ ...emptyInitiative, groups, firstSide, mode })),
  );

/** an abstract step, resolved against whatever groups exist when it runs */
const stepArb = fc.record({
  op: fc.constantFrom(
    "start",
    "start",
    "start",
    "end",
    "end",
    "end",
    "goNext",
    "nextRound",
    "damage",
    "heal",
    "pool",
    "count",
    "max",
    "minion",
    "join",
    "split",
    "remove",
    "removeMember",
    "move",
    "firstSide",
    "resetTurns",
    "mode",
    "add",
    "turns",
    "malice",
    "condition",
  ),
  a: fc.nat(),
  b: fc.nat(),
  value: fc.integer({ min: -5, max: 60 }),
});
type Step = typeof stepArb extends fc.Arbitrary<infer T> ? T : never;

function toAction(s: InitiativeState, step: Step): InitiativeAction | null {
  const groups = s.groups;
  const pick = <T>(xs: T[], n: number) => (xs.length ? xs[n % xs.length]! : undefined);
  const g = pick(groups, step.a);
  const m = g ? pick(g.members, step.b) : undefined;
  const gm = g && m ? { groupId: g.id, memberId: m.id } : null;
  switch (step.op) {
    case "start": {
      // mostly pick an eligible group, sometimes an arbitrary one (must be refused)
      const id = step.b % 4 ? pick(eligibleIds(s), step.a) : g?.id;
      return id ? { type: "startTurn", groupId: id } : null;
    }
    case "end":
      return { type: "endTurn", groupId: step.b % 4 ? (s.activeId ?? "none") : (g?.id ?? "none") };
    case "goNext":
      return g ? { type: "toggleGoNext", groupId: g.id } : null;
    case "nextRound":
      return { type: "nextRound" };
    case "damage":
    case "heal":
      return gm && m?.kind === "creatures"
        ? { type: "setStamina", ...gm, index: step.b % m.stamina.length, value: step.value }
        : null;
    case "pool":
      return gm ? { type: "setPool", ...gm, value: step.value } : null;
    case "count":
      return gm ? { type: "setCount", ...gm, count: step.value } : null;
    case "max":
      return gm ? { type: "setMaxStamina", ...gm, maxStamina: step.value } : null;
    case "minion":
      return gm ? { type: "setMinion", ...gm, minion: step.value % 2 === 0 } : null;
    case "join": {
      const into = pick(groups, step.b);
      return g && into ? { type: "joinGroup", groupId: g.id, intoId: into.id } : null;
    }
    case "split":
      return gm ? { type: "splitMember", ...gm } : null;
    case "remove":
      return step.value > 40 && g ? { type: "removeGroup", groupId: g.id } : null;
    case "removeMember":
      return step.value > 40 && gm ? { type: "removeMember", ...gm } : null;
    case "move":
      return g ? { type: "moveGroup", groupId: g.id, delta: (step.b % 3) - 1 } : null;
    case "firstSide":
      return { type: "setFirstSide", side: step.b % 2 ? "hero" : "enemy" };
    case "resetTurns":
      return step.value > 50 ? { type: "resetTurns" } : null;
    case "mode":
      return step.value > 55 ? { type: "setMode", mode: step.b % 2 ? "dnd" : "drawsteel" } : null;
    case "condition":
      return gm
        ? {
            type: "addCondition",
            ...gm,
            name: ["Slowed", "Weakened", "Prone"][step.b % 3]!,
            duration: (["eot", "save", "manual"] as const)[step.a % 3]!,
          }
        : null;
    case "malice":
      return step.b % 2
        ? { type: "adjustMalice", delta: step.value - 20 }
        : { type: "setVictories", value: step.value % 10 };
    case "turns":
      return g ? { type: "setTurns", groupId: g.id, turns: 1 + (step.b % 2) } : null;
    case "add":
      return {
        type: "addGroup",
        side: step.b % 2 ? "hero" : "enemy",
        members: [creatures("Extra", 1 + (step.a % 3), Math.max(0, step.value))],
      };
  }
  return null;
}

// ---------- invariants ----------

function checkInvariants(s: InitiativeState) {
  const ids = s.groups.map((g) => g.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const g of s.groups) {
    expect(g.members.length).toBeGreaterThan(0);
    for (const m of g.members) {
      expect(m.maxStamina).toBeGreaterThanOrEqual(0);
      if (m.kind === "creatures") {
        expect(m.stamina.length).toBeGreaterThan(0);
        for (const v of m.stamina) {
          expect(v).toBeGreaterThanOrEqual(0);
          if (m.maxStamina > 0) expect(v).toBeLessThanOrEqual(m.maxStamina);
        }
      } else {
        expect(m.count).toBeGreaterThan(0);
        expect(m.pool).toBeGreaterThanOrEqual(0);
        if (m.maxStamina > 0) expect(m.pool).toBeLessThanOrEqual(m.count * m.maxStamina);
      }
    }
  }
  // pointers only name existing groups that haven't acted
  for (const id of [s.activeId, s.goNextId]) {
    if (id !== null) expect(s.groups.some((g) => g.id === id && !g.acted)).toBe(true);
  }
  if (s.goNextId !== null) expect(s.goNextId).not.toBe(s.activeId);
  expect(s.malice).toBeGreaterThanOrEqual(0);
  // "acted" always matches the turn count
  for (const g of s.groups) {
    expect(turnsTakenOf(g)).toBeLessThanOrEqual(turnsOf(g));
    expect(g.acted).toBe(turnsTakenOf(g) >= turnsOf(g));
  }
  if (s.lastGroupId !== null) expect(s.groups.some((g) => g.id === s.lastGroupId)).toBe(true);

  // eligibility
  const eligible = eligibleIds(s);
  const fighting = new Set(inFight(s).map((g) => g.id));
  for (const id of eligible) {
    expect(fighting.has(id)).toBe(true);
    expect(s.groups.find((g) => g.id === id)!.acted).toBe(false);
  }
  if (s.activeId) expect(eligible).toEqual([]);
  if (s.mode === "drawsteel" && s.firstSide === null) expect(eligible).toEqual([]);
  // nobody eligible while fighters remain means a turn is running, nobody can
  // start yet, or the only one left is a solo that just took its turn
  const remaining = inFight(s).filter((g) => !g.acted);
  if (eligible.length === 0 && remaining.length > 0) {
    const blockedSolo = remaining.every((g) => g.id === s.lastGroupId);
    expect(
      s.activeId !== null || (s.mode === "drawsteel" && s.firstSide === null) || blockedSolo,
    ).toBe(true);
    if (blockedSolo && s.activeId === null && s.firstSide !== null)
      expect(roundComplete(s)).toBe(true);
  }
}

/** a turn that just started must be the right side, a go-next, or a spent-side fallback */
function checkTurnStart(before: InitiativeState, after: InitiativeState) {
  if (before.activeId !== null || after.activeId === null || before.mode !== "drawsteel") return;
  if (after.activeId === before.goNextId) return;
  // nobody takes two turns in a row without the Director's override
  expect(after.activeId).not.toBe(before.lastGroupId);
  const started = after.groups.find((g) => g.id === after.activeId)!;
  const want = sideToAct(before)!;
  const wantLeft = inFight(before).some(
    (g) => !g.acted && g.side === want && g.id !== before.lastGroupId,
  );
  if (wantLeft) expect(started.side).toBe(want);
}

const RUNS = 1500;

describe("random play", () => {
  test("every action keeps the encounter valid and follows the turn rules", () => {
    fc.assert(
      fc.property(encounterArb, fc.array(stepArb, { maxLength: 60 }), (start, steps) => {
        let s = initiativeReducer(start, { type: "resetTurns" });
        checkInvariants(s);
        for (const step of steps) {
          const action = toAction(s, step);
          if (!action) continue;
          const next = initiativeReducer(s, action);
          checkInvariants(next);
          checkTurnStart(s, next);
          // a group's EoT conditions are gone once its turn has ended
          if (action.type === "endTurn" && s.activeId === action.groupId) {
            const ended = next.groups.find((g) => g.id === action.groupId)!;
            for (const m of ended.members) {
              expect((m.conditions ?? []).some((c) => c.duration === "eot")).toBe(false);
              for (const c of m.conditions ?? []) {
                if (c.duration === "save") expect(c.saveDue).toBe(true);
              }
            }
          }
          if (action.type === "nextRound") {
            expect(next.groups.every((g) => !g.acted)).toBe(true);
            // Malice grows by heroes + round number once a Draw Steel combat has begun
            const gain = s.mode === "drawsteel" && s.firstSide ? maliceForRound(s, s.round + 1) : 0;
            expect(next.malice).toBe(s.malice + gain);
            expect(next.round).toBe(s.round + 1);
            // the round-1 first side starts every round
            if (next.mode === "drawsteel" && next.firstSide && !next.goNextId) {
              const firstLeft = inFight(next).some((g) => g.side === next.firstSide);
              const sides = new Set(
                eligibleIds(next).map((id) => next.groups.find((g) => g.id === id)!.side),
              );
              if (firstLeft) expect([...sides]).toEqual([next.firstSide]);
            }
          }
          s = next;
        }
      }),
      { numRuns: RUNS },
    );
  });

  test("a full round gives everyone still fighting all their turns, alternating sides", () => {
    fc.assert(
      fc.property(
        encounterArb,
        fc.constantFrom<Side>("hero", "enemy"),
        fc.array(fc.nat(), { minLength: 40, maxLength: 40 }),
        (start, first, choices) => {
          let s: InitiativeState = { ...start, mode: "drawsteel", firstSide: first };
          const fighters = inFight(s).map((g) => g.id);
          const turns: Group[] = [];
          for (const choice of choices) {
            const eligible = eligibleIds(s);
            if (eligible.length === 0) break;
            const id = eligible[choice % eligible.length]!;
            // before the turn: was the other side still able to act?
            const want = sideToAct(s)!;
            const wantLeft = inFight(s).some(
              (g) => !g.acted && g.side === want && g.id !== s.lastGroupId,
            );
            expect(id).not.toBe(s.lastGroupId);
            const g = s.groups.find((x) => x.id === id)!;
            if (wantLeft) expect(g.side).toBe(want);
            s = initiativeReducer(s, { type: "startTurn", groupId: id });
            s = initiativeReducer(s, { type: "endTurn", groupId: id });
            turns.push(g);
          }
          // every group gets all its turns, except that a solo may lose a
          // turn that could only have come straight after its own
          const last = turns[turns.length - 1]?.id;
          for (const id of fighters) {
            const g = start.groups.find((x) => x.id === id)!;
            const taken = turns.filter((t) => t.id === id).length;
            if (taken < turnsOf(g)) {
              expect(id).toBe(last!);
              expect(taken).toBe(turnsOf(g) - 1);
            } else {
              expect(taken).toBe(turnsOf(g));
            }
          }
          expect(roundComplete(s) || fighters.length === 0).toBe(true);
          if (turns.length > 0)
            expect(
              turns[0]!.side === first ||
                !fighters.some((id) => s.groups.find((g) => g.id === id)!.side === first),
            ).toBe(true);
        },
      ),
      { numRuns: RUNS },
    );
  });
});

describe("loading", () => {
  test("anything at all loads as a valid encounter", () => {
    fc.assert(
      fc.property(fc.anything(), (raw) => {
        checkInvariants(normalizeInitiative(raw));
      }),
      { numRuns: RUNS },
    );
  });

  test("corrupted versions of real states load as valid encounters", () => {
    fc.assert(
      fc.property(
        encounterArb,
        fc.array(stepArb, { maxLength: 20 }),
        fc.anything(),
        fc.nat(),
        (start, steps, junk, at) => {
          let s = start;
          for (const step of steps) {
            const action = toAction(s, step);
            if (action) s = initiativeReducer(s, action);
          }
          const json = JSON.parse(JSON.stringify(s)) as Record<string, unknown>;
          const keys = Object.keys(json);
          json[keys[at % keys.length]!] = junk;
          checkInvariants(normalizeInitiative(json));
        },
      ),
      { numRuns: RUNS },
    );
  });

  test("valid states load back unchanged", () => {
    fc.assert(
      fc.property(encounterArb, fc.array(stepArb, { maxLength: 30 }), (start, steps) => {
        let s = initiativeReducer(start, { type: "resetTurns" });
        for (const step of steps) {
          const action = toAction(s, step);
          if (action) s = initiativeReducer(s, action);
        }
        expect(normalizeInitiative(JSON.parse(JSON.stringify(s)))).toEqual(s);
      }),
      { numRuns: RUNS },
    );
  });
});
