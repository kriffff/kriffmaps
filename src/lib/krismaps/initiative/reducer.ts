/**
 * The initiative reducer: every change to initiative state goes through here as
 * a typed action. It is pure (no I/O, no React), so it can be tested
 * exhaustively; the UI only renders selectors and dispatches actions.
 */
import * as M from "./members";
import {
  STATE_VERSION,
  newId,
  turnsOf,
  turnsTakenOf,
  type Group,
  type InitiativeMode,
  type ConditionDuration,
  type InitiativeState,
  type Member,
  type OverlayLayout,
  type Side,
} from "./model";
import { eligibleIds, maliceForRound, roundComplete } from "./selectors";

export type InitiativeAction =
  // combat setup
  /** `id` is optional; give one when the caller needs to refer to the new group */
  | { type: "addGroup"; side: Side; members: Member[]; id?: string }
  | { type: "removeGroup"; groupId: string }
  | { type: "moveGroup"; groupId: string; delta: number }
  | { type: "joinGroup"; groupId: string; intoId: string }
  | { type: "splitMember"; groupId: string; memberId: string }
  | { type: "removeMember"; groupId: string; memberId: string }
  // member edits
  | { type: "renameMember"; groupId: string; memberId: string; name: string }
  | { type: "setStamina"; groupId: string; memberId: string; index: number; value: number }
  | { type: "setPool"; groupId: string; memberId: string; value: number }
  | { type: "setCount"; groupId: string; memberId: string; count: number }
  | { type: "setMaxStamina"; groupId: string; memberId: string; maxStamina: number }
  | { type: "setMinion"; groupId: string; memberId: string; minion: boolean }
  | ({ type: "applyStatBlock"; groupId: string; memberId: string } & M.StatBlockUpdate)
  // turns
  | { type: "setFirstSide"; side: Side }
  | { type: "startTurn"; groupId: string }
  | { type: "endTurn"; groupId: string }
  | { type: "toggleGoNext"; groupId: string }
  /** solo monsters take 2 turns a round */
  | { type: "setTurns"; groupId: string; turns: number }
  | { type: "nextRound" }
  | { type: "setRound"; round: number }
  | { type: "resetTurns" }
  | { type: "clearCombat" }
  | { type: "setMode"; mode: InitiativeMode }
  | { type: "setLayout"; patch: Partial<OverlayLayout> }
  | { type: "setMalice"; value: number }
  /** spend (negative) or gain (positive) Malice */
  | { type: "adjustMalice"; delta: number }
  | { type: "setVictories"; value: number }
  | {
      type: "addCondition";
      groupId: string;
      memberId: string;
      name: string;
      duration: ConditionDuration;
    }
  | { type: "removeCondition"; groupId: string; memberId: string; conditionId: string }
  /** the saving throw for a save-ends condition: saved removes it, failed keeps it */
  | { type: "resolveSave"; groupId: string; memberId: string; conditionId: string; saved: boolean };

const mapGroup = (state: InitiativeState, id: string, fn: (g: Group) => Group): Group[] =>
  state.groups.map((g) => (g.id === id ? fn(g) : g));

const mapMember = (
  state: InitiativeState,
  groupId: string,
  memberId: string,
  fn: (m: Member) => Member,
): InitiativeState => ({
  ...state,
  groups: mapGroup(state, groupId, (g) => ({
    ...g,
    members: g.members.map((m) => (m.id === memberId ? fn(m) : m)),
  })),
});

/** sets a member's conditions, dropping the field when there are none */
function withConditions(m: Member, conditions: Member["conditions"]): Member {
  const { conditions: _old, ...rest } = m;
  return conditions && conditions.length > 0 ? { ...rest, conditions } : rest;
}

/** at the end of a creature's turn: EoT conditions end, save-ends ones ask for a save */
function endOfTurnConditions(m: Member): Member {
  if (!m.conditions?.length) return m;
  return withConditions(
    m,
    m.conditions
      .filter((c) => c.duration !== "eot")
      .map((c) => (c.duration === "save" ? { ...c, saveDue: true } : c)),
  );
}

const resetTurns = (state: InitiativeState): InitiativeState => ({
  ...state,
  groups: state.groups.map(({ turnsTaken: _taken, ...g }) => ({ ...g, acted: false })),
  activeId: null,
  lastSide: null,
  lastGroupId: null,
  goNextId: null,
});

/**
 * Restores the invariants after any change: no empty groups, and the active
 * and go-next pointers only ever name existing groups that haven't acted.
 */
export function repair(state: InitiativeState): InitiativeState {
  const groups = state.groups
    .filter((g) => g.members.length > 0)
    .map((g) => {
      // "acted" is always derived from the turn count, so the two can't disagree
      const turns = Math.min(3, Math.max(1, Math.floor(turnsOf(g)) || 1));
      const taken = Math.min(turns, Math.max(0, Math.floor(turnsTakenOf(g)) || 0));
      const { turns: _t, turnsTaken: _tt, ...rest } = g;
      return {
        ...rest,
        ...(turns > 1 ? { turns } : {}),
        ...(taken > 0 ? { turnsTaken: taken } : {}),
        acted: taken >= turns,
      };
    });
  const valid = (id: string | null) =>
    id !== null && groups.some((g) => g.id === id && !g.acted) ? id : null;
  const activeId = valid(state.activeId);
  const lastGroupId = groups.some((g) => g.id === state.lastGroupId) ? state.lastGroupId : null;
  const goNextId = valid(state.goNextId) === activeId ? null : valid(state.goNextId);
  return { ...state, version: STATE_VERSION, groups, activeId, goNextId, lastGroupId };
}

function reduce(state: InitiativeState, action: InitiativeAction): InitiativeState {
  switch (action.type) {
    case "addGroup": {
      if (action.members.length === 0) return state;
      const taken = !action.id || state.groups.some((g) => g.id === action.id);
      const id = taken ? newId() : action.id!;
      return {
        ...state,
        groups: [...state.groups, { id, side: action.side, members: action.members, acted: false }],
      };
    }

    case "removeGroup":
      return { ...state, groups: state.groups.filter((g) => g.id !== action.groupId) };

    case "moveGroup": {
      const from = state.groups.findIndex((g) => g.id === action.groupId);
      const to = from + action.delta;
      if (from < 0 || to < 0 || to >= state.groups.length) return state;
      const groups = [...state.groups];
      const [moved] = groups.splice(from, 1);
      groups.splice(to, 0, moved!);
      return { ...state, groups };
    }

    case "joinGroup": {
      // the joining group's members take the target group's turn
      const source = state.groups.find((g) => g.id === action.groupId);
      const target = state.groups.find((g) => g.id === action.intoId);
      if (!source || !target || source === target || source.side !== target.side) return state;
      return {
        ...state,
        groups: state.groups
          .filter((g) => g.id !== source.id)
          .map((g) =>
            g.id === target.id ? { ...g, members: [...g.members, ...source.members] } : g,
          ),
        activeId: state.activeId === source.id ? target.id : state.activeId,
        goNextId: state.goNextId === source.id ? target.id : state.goNextId,
      };
    }

    case "splitMember": {
      // a member leaves its group and gets a turn of its own, placed right after
      const index = state.groups.findIndex((g) => g.id === action.groupId);
      const source = state.groups[index];
      const member = source?.members.find((m) => m.id === action.memberId);
      if (!source || !member || source.members.length < 2) return state;
      const groups = [...state.groups];
      groups[index] = { ...source, members: source.members.filter((m) => m !== member) };
      // the split-off member has already had a turn if its group had one
      const taken = Math.min(1, turnsTakenOf(source));
      groups.splice(index + 1, 0, {
        id: newId(),
        side: source.side,
        members: [member],
        acted: taken >= 1,
        ...(taken > 0 ? { turnsTaken: taken } : {}),
      });
      return { ...state, groups };
    }

    case "removeMember":
      return {
        ...state,
        groups: mapGroup(state, action.groupId, (g) => ({
          ...g,
          members: g.members.filter((m) => m.id !== action.memberId),
        })),
      };

    case "renameMember": {
      const name = action.name.trim();
      if (!name) return state;
      return mapMember(state, action.groupId, action.memberId, (m) => ({ ...m, name }));
    }

    case "setStamina":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        m.kind === "creatures" ? M.setCreatureStamina(m, action.index, action.value) : m,
      );

    case "setPool":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        m.kind === "minions" ? M.setPool(m, action.value) : m,
      );

    case "setCount":
      return mapMember(state, action.groupId, action.memberId, (m) => M.setCount(m, action.count));

    case "setMaxStamina":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        M.setMaxStamina(m, action.maxStamina),
      );

    case "setMinion":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        M.setMinion(m, action.minion),
      );

    case "applyStatBlock": {
      // a solo's stat block gives its group two turns a round
      const withTurns = action.solo
        ? { ...state, groups: mapGroup(state, action.groupId, (g) => ({ ...g, turns: 2 })) }
        : state;
      return mapMember(withTurns, action.groupId, action.memberId, (m) =>
        M.applyStatBlock(m, {
          name: action.name?.trim() || undefined,
          maxStamina: action.maxStamina,
          info: action.info?.trim() || undefined,
          squadSize: action.squadSize,
        }),
      );
    }

    case "setFirstSide": {
      const starting = state.firstSide === null && state.mode === "drawsteel";
      // combat starts: average Victories, plus the round's gain
      const gain = starting ? state.victories + maliceForRound(state, state.round) : 0;
      return { ...state, firstSide: action.side, malice: state.malice + gain };
    }

    case "addCondition": {
      const name = action.name.trim();
      if (!name) return state;
      return mapMember(state, action.groupId, action.memberId, (m) => ({
        ...m,
        conditions: [
          ...(m.conditions ?? []).filter((c) => c.name !== name),
          { id: newId(), name, duration: action.duration },
        ],
      }));
    }

    case "removeCondition":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        withConditions(
          m,
          (m.conditions ?? []).filter((c) => c.id !== action.conditionId),
        ),
      );

    case "resolveSave":
      return mapMember(state, action.groupId, action.memberId, (m) =>
        withConditions(
          m,
          (m.conditions ?? []).flatMap((c) => {
            if (c.id !== action.conditionId) return [c];
            if (action.saved) return [];
            const { saveDue: _due, ...rest } = c;
            return [rest];
          }),
        ),
      );

    case "setMalice":
      return { ...state, malice: Math.max(0, Math.floor(action.value) || 0) };

    case "adjustMalice":
      return { ...state, malice: Math.max(0, state.malice + Math.floor(action.delta || 0)) };

    case "setVictories":
      return { ...state, victories: Math.max(0, Math.floor(action.value) || 0) };

    case "startTurn":
      if (!eligibleIds(state).includes(action.groupId)) return state;
      return { ...state, activeId: action.groupId, goNextId: null };

    case "endTurn": {
      const g = state.groups.find((x) => x.id === action.groupId);
      if (!g || state.activeId !== g.id) return state;
      const next: InitiativeState = {
        ...state,
        groups: mapGroup(state, g.id, (x) => {
          const taken = turnsTakenOf(x) + 1;
          return {
            ...x,
            turnsTaken: taken,
            acted: taken >= turnsOf(x),
            members: x.members.map(endOfTurnConditions),
          };
        }),
        activeId: null,
        lastSide: g.side,
        lastGroupId: g.id,
      };
      // Draw Steel waits for the Director to pick, and for an explicit new round
      if (state.mode === "drawsteel") return next;
      // D&D runs down the list on its own
      if (roundComplete(next)) return { ...resetTurns(next), round: next.round + 1 };
      const [first] = eligibleIds(next);
      return first ? { ...next, activeId: first } : next;
    }

    case "toggleGoNext": {
      const g = state.groups.find((x) => x.id === action.groupId);
      if (!g || g.acted || g.id === state.activeId) return state;
      return { ...state, goNextId: state.goNextId === g.id ? null : g.id };
    }

    case "setTurns":
      return {
        ...state,
        groups: mapGroup(state, action.groupId, (g) => ({ ...g, turns: action.turns })),
      };

    case "nextRound": {
      const round = state.round + 1;
      // the Director gains Malice at the start of each round once combat has begun
      const gain = state.mode === "drawsteel" && state.firstSide ? maliceForRound(state, round) : 0;
      return { ...resetTurns(state), round, malice: state.malice + gain };
    }

    case "setRound":
      return { ...state, round: Math.max(1, Math.floor(action.round) || 1) };

    case "resetTurns":
      return resetTurns(state);

    case "clearCombat":
      return {
        ...resetTurns(state),
        groups: [],
        round: 1,
        firstSide: null,
        malice: 0,
      };

    case "setMode":
      if (action.mode === state.mode) return state;
      return { ...resetTurns(state), mode: action.mode };

    case "setLayout":
      return { ...state, layout: { ...state.layout, ...action.patch } };
  }
}

export function initiativeReducer(
  state: InitiativeState,
  action: InitiativeAction,
): InitiativeState {
  return repair(reduce(state, action));
}
