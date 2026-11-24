/**
 * Draw Steel initiative rules, one named test per rule, plus full-round
 * scenarios. See docs/proposals/initiative-rework.md for the agreed rules.
 */
import { describe, expect, test } from "bun:test";

import {
  creatures,
  eligibleIds,
  emptyInitiative,
  groupLabel,
  initiativeReducer as reduce,
  isOut,
  minions,
  minionsLeft,
  needsFirstSide,
  normalizeInitiative,
  overlaySections,
  parseEntry,
  pools,
  roundComplete,
  turnsLeft,
  type Group,
  type InitiativeAction,
  type InitiativeState,
  type Member,
  type Side,
} from "../initiative";

/** builds a state with named groups; group ids are their first member's name */
function encounter(...groups: Array<[Side, ...Member[]]>): InitiativeState {
  return {
    ...emptyInitiative,
    groups: groups.map(([side, ...members]) => ({
      id: members[0]!.name,
      side,
      members,
      acted: false,
    })),
  };
}
const hero = (name: string, stamina = 30): [Side, Member] => ["hero", creatures(name, 1, stamina)];
const enemy = (name: string, count = 1, stamina = 10): [Side, Member] => [
  "enemy",
  creatures(name, count, stamina),
];
const run = (s: InitiativeState, ...actions: InitiativeAction[]) => actions.reduce(reduce, s);
const turn = (s: InitiativeState, id: string) =>
  run(s, { type: "startTurn", groupId: id }, { type: "endTurn", groupId: id });
const sorted = (ids: string[]) => [...ids].sort();
const g = (s: InitiativeState, id: string) => s.groups.find((x) => x.id === id)!;
const m0 = (s: InitiativeState, id: string) => g(s, id).members[0]!;

const party = () => encounter(hero("Kris"), hero("Ana"), enemy("Goblin", 3), enemy("Ogre", 1, 40));

describe("starting combat", () => {
  test("nobody can act until the first side is chosen", () => {
    const s = party();
    expect(needsFirstSide(s)).toBe(true);
    expect(eligibleIds(s)).toEqual([]);
    expect(run(s, { type: "startTurn", groupId: "Kris" }).activeId).toBeNull();
  });

  test("heroes first: any hero may start", () => {
    const s = run(party(), { type: "setFirstSide", side: "hero" });
    expect(sorted(eligibleIds(s))).toEqual(["Ana", "Kris"]);
  });

  test("enemies first: any enemy group may start", () => {
    const s = run(party(), { type: "setFirstSide", side: "enemy" });
    expect(sorted(eligibleIds(s))).toEqual(["Goblin", "Ogre"]);
  });
});

describe("taking turns", () => {
  const started = () => run(party(), { type: "setFirstSide", side: "hero" });

  test("sides alternate", () => {
    let s = turn(started(), "Kris");
    expect(sorted(eligibleIds(s))).toEqual(["Goblin", "Ogre"]);
    s = turn(s, "Ogre");
    expect(eligibleIds(s)).toEqual(["Ana"]);
  });

  test("nobody else may start while a turn is in progress", () => {
    const s = run(started(), { type: "startTurn", groupId: "Kris" });
    expect(s.activeId).toBe("Kris");
    expect(eligibleIds(s)).toEqual([]);
    expect(run(s, { type: "startTurn", groupId: "Ana" }).activeId).toBe("Kris");
  });

  test("the wrong side can't start", () => {
    expect(run(started(), { type: "startTurn", groupId: "Ogre" }).activeId).toBeNull();
  });

  test("only the active group can end its turn", () => {
    const s = run(started(), { type: "startTurn", groupId: "Kris" });
    expect(run(s, { type: "endTurn", groupId: "Ana" })).toEqual(s);
  });

  test("when one side runs out, the other acts back to back", () => {
    let s = run(encounter(hero("Kris"), enemy("A"), enemy("B"), enemy("C")), {
      type: "setFirstSide",
      side: "hero",
    });
    s = turn(s, "Kris");
    s = turn(s, "A");
    expect(sorted(eligibleIds(s))).toEqual(["B", "C"]);
    s = turn(s, "C");
    expect(eligibleIds(s)).toEqual(["B"]);
  });

  test("go next lets any unacted group act regardless of side", () => {
    let s = turn(started(), "Kris");
    s = run(s, { type: "toggleGoNext", groupId: "Ana" });
    expect(eligibleIds(s)).toEqual(["Ana"]);
    s = run(s, { type: "startTurn", groupId: "Ana" });
    expect(s.activeId).toBe("Ana");
    expect(s.goNextId).toBeNull();
  });

  test("go next can be toggled off, and can't target acted or active groups", () => {
    let s = turn(started(), "Kris");
    expect(run(s, { type: "toggleGoNext", groupId: "Kris" }).goNextId).toBeNull();
    s = run(s, { type: "toggleGoNext", groupId: "Ana" }, { type: "toggleGoNext", groupId: "Ana" });
    expect(s.goNextId).toBeNull();
  });
});

describe("rounds", () => {
  test("a round ends only when everyone still fighting has acted, and never on its own", () => {
    let s = run(party(), { type: "setFirstSide", side: "enemy" });
    for (const id of ["Goblin", "Kris", "Ogre"]) s = turn(s, id);
    expect(roundComplete(s)).toBe(false);
    s = turn(s, "Ana");
    expect(roundComplete(s)).toBe(true);
    expect(s.round).toBe(1);
  });

  test("the side that went first in round 1 goes first every round", () => {
    let s = run(party(), { type: "setFirstSide", side: "enemy" });
    for (const id of ["Goblin", "Kris", "Ogre", "Ana"]) s = turn(s, id);
    s = run(s, { type: "nextRound" });
    expect(s.round).toBe(2);
    expect(pools(s).acted).toEqual([]);
    expect(sorted(eligibleIds(s))).toEqual(["Goblin", "Ogre"]);
  });

  test("reset turns keeps the round and first side", () => {
    let s = turn(run(party(), { type: "setFirstSide", side: "hero" }), "Kris");
    s = run(s, { type: "resetTurns" });
    expect(s.round).toBe(1);
    expect(s.firstSide).toBe("hero");
    expect(sorted(eligibleIds(s))).toEqual(["Ana", "Kris"]);
  });

  test("clear combat empties the encounter but keeps the overlay layout and mode", () => {
    let s = run(
      party(),
      { type: "setLayout", patch: { x: 0.9 } },
      { type: "setFirstSide", side: "hero" },
    );
    s = run(s, { type: "clearCombat" });
    expect(s.groups).toEqual([]);
    expect(s.firstSide).toBeNull();
    expect(s.layout.x).toBe(0.9);
  });
});

describe("dead monsters and dying heroes", () => {
  test("an enemy group whose creatures are all on 0 drops out of the turn order", () => {
    let s = run(party(), { type: "setFirstSide", side: "hero" });
    s = run(s, {
      type: "setStamina",
      groupId: "Ogre",
      memberId: m0(s, "Ogre").id,
      index: 0,
      value: 0,
    });
    expect(isOut(g(s, "Ogre"))).toBe(true);
    s = turn(s, "Kris");
    expect(eligibleIds(s)).toEqual(["Goblin"]);
    expect(pools(s).out.map((x) => x.id)).toEqual(["Ogre"]);
  });

  test("the round can finish without the dead acting", () => {
    let s = run(encounter(hero("Kris"), enemy("Ogre")), { type: "setFirstSide", side: "hero" });
    s = run(s, {
      type: "setStamina",
      groupId: "Ogre",
      memberId: m0(s, "Ogre").id,
      index: 0,
      value: 0,
    });
    s = turn(s, "Kris");
    expect(roundComplete(s)).toBe(true);
  });

  test("a hero on 0 Stamina is dying, not out, and still acts", () => {
    let s = run(party(), { type: "setFirstSide", side: "hero" });
    s = run(s, {
      type: "setStamina",
      groupId: "Kris",
      memberId: m0(s, "Kris").id,
      index: 0,
      value: 0,
    });
    expect(isOut(g(s, "Kris"))).toBe(false);
    expect(eligibleIds(s)).toContain("Kris");
  });

  test("a monster with unknown Stamina is never counted dead", () => {
    const s = encounter(enemy("Mystery", 1, 0));
    expect(isOut(s.groups[0]!)).toBe(false);
  });

  test("dead enemies are hidden from the Map View", () => {
    let s = run(party(), { type: "setFirstSide", side: "hero" });
    s = run(s, {
      type: "setStamina",
      groupId: "Ogre",
      memberId: m0(s, "Ogre").id,
      index: 0,
      value: 0,
    });
    expect(
      overlaySections(s)
        .flat()
        .map((x) => x.id),
    ).not.toContain("Ogre");
  });
});

describe("minion squads", () => {
  const squad = () => encounter(hero("Kris"), ["enemy", minions("Bone Rattler", 4, 5)]);

  test("share one Stamina pool", () => {
    const m = minions("Bone Rattler", 4, 5);
    expect(m.pool).toBe(20);
    expect(minionsLeft(m)).toBe(4);
  });

  test("a minion dies for each full minion's worth of Stamina lost", () => {
    let s = squad();
    const id = m0(s, "Bone Rattler").id;
    s = run(s, { type: "setPool", groupId: "Bone Rattler", memberId: id, value: 14 });
    expect(minionsLeft(m0(s, "Bone Rattler") as never)).toBe(3);
    s = run(s, { type: "setPool", groupId: "Bone Rattler", memberId: id, value: 10 });
    expect(minionsLeft(m0(s, "Bone Rattler") as never)).toBe(2);
    expect(groupLabel(g(s, "Bone Rattler"))).toBe("Bone Rattler ×2");
  });

  test("the pool is clamped to 0..count × Stamina", () => {
    let s = squad();
    const id = m0(s, "Bone Rattler").id;
    s = run(s, { type: "setPool", groupId: "Bone Rattler", memberId: id, value: 99 });
    expect((m0(s, "Bone Rattler") as { pool: number }).pool).toBe(20);
    s = run(s, { type: "setPool", groupId: "Bone Rattler", memberId: id, value: -3 });
    expect((m0(s, "Bone Rattler") as { pool: number }).pool).toBe(0);
    expect(isOut(g(s, "Bone Rattler"))).toBe(true);
  });

  test("a captain joins the squad and they share one turn", () => {
    let s = encounter(hero("Kris"), ["enemy", minions("Runner", 4, 5)], enemy("Captain", 1, 20));
    s = run(
      s,
      { type: "joinGroup", groupId: "Captain", intoId: "Runner" },
      { type: "setFirstSide", side: "enemy" },
    );
    expect(s.groups.map((x) => x.id)).toEqual(["Kris", "Runner"]);
    expect(groupLabel(g(s, "Runner"))).toBe("Runner ×4 + Captain");
    s = turn(s, "Runner");
    expect(eligibleIds(s)).toEqual(["Kris"]);
  });

  test("the squad stays in the fight while its captain stands", () => {
    let s = encounter(["enemy", minions("Runner", 2, 5), creatures("Captain", 1, 20)]);
    s = run(s, { type: "setPool", groupId: "Runner", memberId: m0(s, "Runner").id, value: 0 });
    expect(isOut(g(s, "Runner"))).toBe(false);
  });

  test("individual creatures and a squad convert into each other", () => {
    let s = encounter(enemy("Rat", 3, 4));
    const id = m0(s, "Rat").id;
    s = run(s, { type: "setStamina", groupId: "Rat", memberId: id, index: 1, value: 1 });
    s = run(s, { type: "setMinion", groupId: "Rat", memberId: id, minion: true });
    expect(m0(s, "Rat")).toMatchObject({ kind: "minions", count: 3, pool: 9 });
    s = run(s, { type: "setMinion", groupId: "Rat", memberId: id, minion: false });
    expect(m0(s, "Rat")).toMatchObject({ kind: "creatures", stamina: [4, 4, 1] });
  });
});

describe("conditions", () => {
  const fight = () =>
    run(encounter(hero("Kris"), enemy("Ogre", 1, 40)), { type: "setFirstSide", side: "hero" });
  const ogre = (s: InitiativeState) => ({ groupId: "Ogre", memberId: m0(s, "Ogre").id });
  const names = (s: InitiativeState) => (m0(s, "Ogre").conditions ?? []).map((c) => c.name);

  test("EoT conditions end when that creature's turn ends, not before", () => {
    let s = fight();
    s = run(s, { type: "addCondition", ...ogre(s), name: "Slowed", duration: "eot" });
    s = turn(s, "Kris");
    expect(names(s)).toEqual(["Slowed"]);
    s = turn(s, "Ogre");
    expect(names(s)).toEqual([]);
  });

  test("save ends asks for a save at the end of the creature's turn", () => {
    let s = fight();
    s = run(s, { type: "addCondition", ...ogre(s), name: "Weakened", duration: "save" });
    expect(m0(s, "Ogre").conditions![0]!.saveDue).toBeUndefined();
    s = turn(turn(s, "Kris"), "Ogre");
    const c = m0(s, "Ogre").conditions![0]!;
    expect(c.saveDue).toBe(true);
    // failed: it stays, without the prompt
    s = run(s, { type: "resolveSave", ...ogre(s), conditionId: c.id, saved: false });
    expect(m0(s, "Ogre").conditions![0]).toMatchObject({ name: "Weakened" });
    expect(m0(s, "Ogre").conditions![0]!.saveDue).toBeUndefined();
    // succeeded: it ends
    s = run(s, { type: "nextRound" });
    s = turn(turn(s, "Kris"), "Ogre");
    s = run(s, { type: "resolveSave", ...ogre(s), conditionId: c.id, saved: true });
    expect(names(s)).toEqual([]);
  });

  test("until-removed conditions stay through turns and rounds", () => {
    let s = fight();
    s = run(s, { type: "addCondition", ...ogre(s), name: "Grabbed", duration: "manual" });
    s = run(turn(turn(s, "Kris"), "Ogre"), { type: "nextRound" });
    expect(names(s)).toEqual(["Grabbed"]);
    const id = m0(s, "Ogre").conditions![0]!.id;
    s = run(s, { type: "removeCondition", ...ogre(s), conditionId: id });
    expect(m0(s, "Ogre").conditions).toBeUndefined();
  });

  test("re-applying a condition replaces it rather than stacking", () => {
    let s = fight();
    s = run(s, { type: "addCondition", ...ogre(s), name: "Prone", duration: "eot" });
    s = run(s, { type: "addCondition", ...ogre(s), name: "Prone", duration: "manual" });
    expect(m0(s, "Ogre").conditions).toHaveLength(1);
    expect(m0(s, "Ogre").conditions![0]!.duration).toBe("manual");
  });

  test("conditions survive turning a monster into a minion squad and back", () => {
    let s = encounter(enemy("Rat", 2, 4));
    s = run(s, {
      type: "addCondition",
      groupId: "Rat",
      memberId: m0(s, "Rat").id,
      name: "Bleeding",
      duration: "save",
    });
    s = run(s, { type: "setMinion", groupId: "Rat", memberId: m0(s, "Rat").id, minion: true });
    expect(m0(s, "Rat").conditions?.map((c) => c.name)).toEqual(["Bleeding"]);
  });
});

describe("Malice", () => {
  /** five heroes averaging 3 Victories, as in the rules' own example */
  const five = () =>
    run(encounter(hero("A"), hero("B"), hero("C"), hero("D"), hero("E"), enemy("Ogre")), {
      type: "setVictories",
      value: 3,
    });

  test("combat start: average Victories plus heroes + round 1", () => {
    const s = run(five(), { type: "setFirstSide", side: "hero" });
    expect(s.malice).toBe(3 + 5 + 1);
  });

  test("each new round adds heroes + the round number", () => {
    let s = run(five(), { type: "setFirstSide", side: "hero" });
    s = run(s, { type: "nextRound" });
    expect(s.malice).toBe(9 + 7);
    s = run(s, { type: "nextRound" });
    expect(s.malice).toBe(9 + 7 + 8);
  });

  test("switching the first side later doesn't grant it again", () => {
    let s = run(five(), { type: "setFirstSide", side: "hero" });
    s = run(s, { type: "setFirstSide", side: "enemy" });
    expect(s.malice).toBe(9);
  });

  test("no Malice before combat starts or in D&D mode", () => {
    expect(run(five(), { type: "nextRound" }).malice).toBe(0);
    let s = run(five(), { type: "setMode", mode: "dnd" }, { type: "setFirstSide", side: "hero" });
    s = run(s, { type: "nextRound" });
    expect(s.malice).toBe(0);
  });

  test("spending can't go below zero; clear combat resets it, Victories stay", () => {
    let s = run(
      five(),
      { type: "setFirstSide", side: "hero" },
      { type: "adjustMalice", delta: -3 },
    );
    expect(s.malice).toBe(6);
    s = run(s, { type: "adjustMalice", delta: -50 });
    expect(s.malice).toBe(0);
    s = run(s, { type: "setMalice", value: 12 }, { type: "clearCombat" });
    expect(s.malice).toBe(0);
    expect(s.victories).toBe(3);
  });
});

describe("solo monsters", () => {
  /** heroes Kris and Ana against a solo with two turns a round */
  const soloFight = (first: Side = "hero") =>
    run(
      encounter(hero("Kris"), hero("Ana"), enemy("Tunnel Wyrm", 1, 200)),
      { type: "setTurns", groupId: "Tunnel Wyrm", turns: 2 },
      { type: "setFirstSide", side: first },
    );

  test("take two turns a round, alternating with the heroes", () => {
    let s = turn(soloFight(), "Kris");
    s = turn(s, "Tunnel Wyrm");
    expect(turnsLeft(g(s, "Tunnel Wyrm"))).toBe(1);
    expect(pools(s).unacted.map((x) => x.id)).toContain("Tunnel Wyrm");
    s = turn(s, "Ana");
    expect(eligibleIds(s)).toEqual(["Tunnel Wyrm"]);
    s = turn(s, "Tunnel Wyrm");
    expect(g(s, "Tunnel Wyrm").acted).toBe(true);
    expect(roundComplete(s)).toBe(true);
  });

  test("can't take two turns in a row", () => {
    let s = turn(soloFight("enemy"), "Tunnel Wyrm");
    expect(sorted(eligibleIds(s))).toEqual(["Ana", "Kris"]);
    s = turn(s, "Kris");
    expect(eligibleIds(s)).toEqual(["Tunnel Wyrm"]);
  });

  test("when only the solo is left, its back-to-back turn doesn't hold up the round", () => {
    let s = run(
      encounter(hero("Kris"), enemy("Tunnel Wyrm", 1, 200)),
      { type: "setTurns", groupId: "Tunnel Wyrm", turns: 2 },
      { type: "setFirstSide", side: "hero" },
    );
    s = turn(turn(s, "Kris"), "Tunnel Wyrm");
    expect(eligibleIds(s)).toEqual([]);
    expect(roundComplete(s)).toBe(true);
    // the Director can still give it that turn
    s = run(s, { type: "toggleGoNext", groupId: "Tunnel Wyrm" });
    expect(eligibleIds(s)).toEqual(["Tunnel Wyrm"]);
  });

  test("get both turns back each round", () => {
    let s = turn(turn(soloFight(), "Kris"), "Tunnel Wyrm");
    s = run(s, { type: "nextRound" });
    expect(turnsLeft(g(s, "Tunnel Wyrm"))).toBe(2);
    expect(s.lastGroupId).toBeNull();
  });

  test("a solo stat block gives the group two turns", () => {
    let s = encounter(enemy("New monster", 1, 0));
    s = run(s, {
      type: "applyStatBlock",
      groupId: "New monster",
      memberId: m0(s, "New monster").id,
      name: "Tunnel Wyrm",
      maxStamina: 200,
      solo: true,
    });
    expect(g(s, "New monster").turns).toBe(2);
  });

  test("splitting a member out of a group that already acted keeps it acted (regression)", () => {
    let s = run(
      encounter(hero("Kris"), ["enemy", creatures("Ogre", 1, 40), creatures("Troll", 1, 40)]),
      {
        type: "setFirstSide",
        side: "enemy",
      },
    );
    s = turn(s, "Ogre");
    s = run(s, { type: "splitMember", groupId: "Ogre", memberId: g(s, "Ogre").members[1]!.id });
    expect(s.groups.filter((x) => x.side === "enemy").every((x) => x.acted)).toBe(true);
    expect(eligibleIds(s)).toEqual(["Kris"]);
  });

  test("state saved before solo turns existed keeps who has acted", () => {
    const saved = { ...encounter(hero("Kris"), enemy("Ogre")), version: 2 };
    saved.groups[0]!.acted = true;
    const loaded = normalizeInitiative(JSON.parse(JSON.stringify(saved)));
    expect(loaded.groups[0]!.acted).toBe(true);
    expect(loaded.groups[1]!.acted).toBe(false);
  });

  test("turning a solo back to one turn after its first turn finishes it for the round", () => {
    let s = turn(turn(soloFight(), "Kris"), "Tunnel Wyrm");
    s = run(s, { type: "setTurns", groupId: "Tunnel Wyrm", turns: 1 });
    expect(g(s, "Tunnel Wyrm").acted).toBe(true);
  });
});

describe("grouping enemies", () => {
  test("different non-minion monsters can share one turn", () => {
    let s = encounter(hero("Kris"), enemy("Ogre"), enemy("Troll"));
    s = run(
      s,
      { type: "joinGroup", groupId: "Troll", intoId: "Ogre" },
      { type: "setFirstSide", side: "enemy" },
    );
    expect(eligibleIds(s)).toEqual(["Ogre"]);
    expect(groupLabel(g(s, "Ogre"))).toBe("Ogre + Troll");
  });

  test("heroes and enemies can't be grouped", () => {
    const s = party();
    expect(run(s, { type: "joinGroup", groupId: "Kris", intoId: "Ogre" })).toEqual(s);
  });

  test("a member can be split back out into its own turn, right after", () => {
    let s = encounter(enemy("Ogre"), enemy("Troll"), hero("Kris"));
    s = run(s, { type: "joinGroup", groupId: "Troll", intoId: "Ogre" });
    const troll = g(s, "Ogre").members[1]!.id;
    s = run(s, { type: "splitMember", groupId: "Ogre", memberId: troll });
    expect(s.groups).toHaveLength(3);
    expect(groupLabel(s.groups[1]!)).toBe("Troll");
  });

  test("joining the active group into another hands over the turn", () => {
    let s = run(encounter(hero("Kris"), enemy("Ogre"), enemy("Troll")), {
      type: "setFirstSide",
      side: "enemy",
    });
    s = run(
      s,
      { type: "startTurn", groupId: "Troll" },
      { type: "joinGroup", groupId: "Troll", intoId: "Ogre" },
    );
    expect(s.activeId).toBe("Ogre");
  });

  test("removing the last member removes the group, and clears the active turn", () => {
    let s = run(
      party(),
      { type: "setFirstSide", side: "hero" },
      { type: "startTurn", groupId: "Kris" },
    );
    s = run(s, { type: "removeMember", groupId: "Kris", memberId: m0(s, "Kris").id });
    expect(s.groups.map((x) => x.id)).not.toContain("Kris");
    expect(s.activeId).toBeNull();
  });
});

describe("Stamina edits", () => {
  test("setting a max on a monster with unknown Stamina starts it at full", () => {
    let s = encounter(enemy("Ogre", 2, 0));
    s = run(s, {
      type: "setMaxStamina",
      groupId: "Ogre",
      memberId: m0(s, "Ogre").id,
      maxStamina: 40,
    });
    expect(m0(s, "Ogre")).toMatchObject({ maxStamina: 40, stamina: [40, 40] });
  });

  test("lowering max Stamina caps current Stamina", () => {
    let s = encounter(enemy("Ogre", 1, 40));
    s = run(s, {
      type: "setMaxStamina",
      groupId: "Ogre",
      memberId: m0(s, "Ogre").id,
      maxStamina: 30,
    });
    expect(m0(s, "Ogre")).toMatchObject({ stamina: [30] });
  });

  test("a stat block read renames and resets to full", () => {
    let s = encounter(enemy("New monster", 2, 0));
    const id = m0(s, "New monster").id;
    s = run(s, { type: "setStamina", groupId: "New monster", memberId: id, index: 0, value: 3 });
    s = run(s, {
      type: "applyStatBlock",
      groupId: "New monster",
      memberId: id,
      name: "Ember Wisp",
      maxStamina: 15,
    });
    expect(m0(s, "New monster")).toMatchObject({
      name: "Ember Wisp",
      maxStamina: 15,
      stamina: [15, 15],
    });
  });

  test("a minion stat block turns a pasted monster into a squad of the stated size", () => {
    let s = encounter(enemy("New monster", 1, 0));
    const id = m0(s, "New monster").id;
    s = run(s, {
      type: "applyStatBlock",
      groupId: "New monster",
      memberId: id,
      name: "Bone Rattler",
      maxStamina: 7,
      info: "Level 2 Minion Artillery · EV 4",
      squadSize: 4,
    });
    expect(m0(s, "New monster")).toMatchObject({
      kind: "minions",
      name: "Bone Rattler",
      count: 4,
      maxStamina: 7,
      pool: 28,
      info: "Level 2 Minion Artillery · EV 4",
    });
  });

  test("a squad keeps its own size when its stat block is read again", () => {
    let s = encounter(["enemy", minions("Bone Rattler", 6, 7)]);
    const id = m0(s, "Bone Rattler").id;
    s = run(s, {
      type: "applyStatBlock",
      groupId: "Bone Rattler",
      memberId: id,
      maxStamina: 7,
      squadSize: 4,
    });
    expect(m0(s, "Bone Rattler")).toMatchObject({ count: 6, pool: 42 });
  });

  test("adding creatures to a group brings them in at full Stamina", () => {
    let s = encounter(enemy("Goblin", 2, 10));
    const id = m0(s, "Goblin").id;
    s = run(s, { type: "setStamina", groupId: "Goblin", memberId: id, index: 0, value: 4 });
    s = run(s, { type: "setCount", groupId: "Goblin", memberId: id, count: 3 });
    expect(m0(s, "Goblin")).toMatchObject({ stamina: [4, 10, 10] });
  });
});

describe("D&D mode", () => {
  test("acts top to bottom, moves on by itself and wraps rounds", () => {
    let s = run(encounter(hero("A"), enemy("B"), hero("C")), { type: "setMode", mode: "dnd" });
    expect(needsFirstSide(s)).toBe(false);
    expect(eligibleIds(s)).toEqual(["A"]);
    s = turn(s, "A");
    expect(s.activeId).toBe("B");
    s = run(s, { type: "endTurn", groupId: "B" }, { type: "endTurn", groupId: "C" });
    expect(s.round).toBe(2);
    expect(eligibleIds(s)).toEqual(["A"]);
  });
});

describe("fast entry", () => {
  test.each([
    ["Goblins x4 40", { name: "Goblins", count: 4, stamina: 40 }],
    ["4x Goblins 40", { name: "Goblins", count: 4, stamina: 40 }],
    ["Goblins 4 40", { name: "Goblins", count: 4, stamina: 40 }],
    ["Kris 62", { name: "Kris", count: 1, stamina: 62 }],
    ["Ember Wisp", { name: "Ember Wisp", count: 1, stamina: 0 }],
  ])("%s", (input, expected) => expect(parseEntry(input)).toEqual(expected));

  test("needs a name", () => {
    expect(parseEntry("x4 40")).toBeNull();
    expect(parseEntry("  ")).toBeNull();
  });
});

describe("loading saved state", () => {
  test("old (pre-rework) saved state starts a fresh encounter but keeps the overlay layout", () => {
    const old = { mode: "dnd", combatants: [{ id: "a" }], layout: { x: 0.7, visible: false } };
    const s = normalizeInitiative(old);
    expect(s.groups).toEqual([]);
    expect(s.mode).toBe("dnd");
    expect(s.layout).toMatchObject({ x: 0.7, visible: false });
  });

  test("a valid state survives a round trip through JSON", () => {
    const s = run(
      party(),
      { type: "setFirstSide", side: "hero" },
      { type: "startTurn", groupId: "Kris" },
    );
    expect(normalizeInitiative(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });

  test("dangling pointers and empty groups are repaired", () => {
    const s = { ...party(), activeId: "nobody", goNextId: "Ogre" } as InitiativeState;
    const broken = {
      ...s,
      groups: [...s.groups, { id: "empty", side: "enemy", members: [], acted: false } as Group],
    };
    const fixed = normalizeInitiative(broken);
    expect(fixed.activeId).toBeNull();
    expect(fixed.goNextId).toBe("Ogre");
    expect(fixed.groups.map((x) => x.id)).not.toContain("empty");
  });
});
