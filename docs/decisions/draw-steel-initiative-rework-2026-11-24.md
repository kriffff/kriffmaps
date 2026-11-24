# Proposal: Draw Steel initiative rework

Status: **implemented** (2026-11-24). The owner's answers are recorded under "Decisions" at the end.

## What's wrong today

### Rules gaps (checked against the Draw Steel combat rules)

1. **Round order doesn't persist.** In Draw Steel the side that goes first in
   round 1 goes first every round. Today either side may start every round.
2. **No start-of-combat step.** Surprise and the d10 roll aren't modelled. (If
   both sides have creatures that aren't surprised, roll a d10: on 6+ the players
   choose which side goes first, otherwise the Director chooses. If every
   creature on one side is surprised, the other side goes first.)
3. **Director turns are one entry at a time.** A Director turn activates a
   _group_, e.g. a minion squad and its captain, which can be different
   creatures. Today a group can only be N copies of one creature.
4. **Minions are tracked one by one.** Squads share a Stamina pool: damage
   comes off the pool and a minion dies for each full minion's worth lost.
   Today each minion has its own Stamina box.
5. **Dead creatures still need a turn.** A monster on 0 Stamina blocks the
   round until the Director clicks through it. (Heroes on 0 are dying, not
   out, so they keep their turns.)
6. **Wording.** Draw Steel calls half Stamina _winded_; the app says
   _Bloodied_.

### Code and quality problems

- Rules live in two places. `initiative.ts` has the turn rules, but
  `InitiativePanel.tsx` also edits state directly (add, remove, rename, OCR
  results) and derives "required side", pools and round-complete itself.
- Side effects (remembering heroes and monster Stamina) run inside state
  updater functions, which React may call twice.
- The saved state can contradict itself (e.g. `currentId` pointing at a
  removed or already-acted combatant), and nothing repairs it on load.
- No tests. The original design notes asked for them; none were written.

## Proposed design

### 1. One pure reducer

`src/lib/initiative/` (new folder):

- `model.ts`: types. An encounter has **groups**. A group belongs to a side and
  has one or more **members** (each with a name, max Stamina and, for minions,
  a shared squad pool). A hero is a one-member group. An optional captain
  joins a minion squad's group.
- `reducer.ts`: `initiativeReducer(state, action)` handling every change as a
  typed action: `addGroup`, `removeGroup`, `renameMember`, `startCombat {
firstSide, surprised }`, `startTurn`, `endTurn`, `goNext`, `nextRound`,
  `damage`, `heal`, `setMode`, `setLayout`. Nothing else writes state.
- `selectors.ts`: everything the UI shows, derived and never stored: pools
  (active / unacted / acted / out), eligible groups, the side that must act,
  round complete, winded and dead counts, the overlay order.
- `normalize.ts`: repairs any loaded or imported state so the invariants
  below always hold.

The panel and overlay become thin: they render selectors and dispatch actions.
Remembering heroes and monster Stamina moves to effects outside the reducer.
This is also the main pre-work for splitting `InitiativePanel.tsx` (phase 6).

### 2. Rules as specified

- **Start of combat:** a "Start combat" step asks who goes first (with an
  optional d10 roller and surprise toggles).
- **Each round:** the first side from round 1 starts. Sides alternate. The
  heroes' side picks any unacted hero; the Director picks any unacted group.
  When a side runs out, the rest act back to back. "Go next" stays as a
  Director override.
- **Groups:** one Director turn activates the whole group (squad + captain).
- **Minion squads:** one shared Stamina pool. The app shows how many minions
  are left and removes them as the pool drops.
- **Dead monsters** drop out of the turn order automatically. Dying heroes stay
  in.
- **Round end:** an explicit "Start next round", as now.
- **D&D mode** stays the simple fixed order and isn't otherwise touched.

### 3. Testing and quality

- **Unit tests** per rule (bun test). Every rule above gets a named test.
- **Scenario tests:** full rounds written as short scripts ("heroes win the
  roll; Kris, goblin squad, Ana, ogre…") checked step by step.
- **Property-based tests** (`fast-check`): generate thousands of random
  encounters and random legal action sequences, and check invariants after
  every step:
  - every combatant still in the fight acts exactly once per round;
  - the same side never acts twice in a row while the other side has someone
    eligible, unless "go next" was used;
  - the round-1 first side starts every round;
  - `currentId` always points at an existing, unacted, living group;
  - the round only completes when everyone still in the fight has acted;
  - minion counts always match the squad pool.
    This is the kind of test that would have caught the bugs Lovable kept
    hitting: they cover combinations nobody thinks to write by hand.
- **Saved-data tests:** `normalize` turns any old or corrupt state into a valid
  one (also property-tested).
- **Browser smoke tests:** move the Playwright checks used during the migration
  into `e2e/` so one command checks Director and Map View sync, persistence
  and OCR in a real browser.
- **CI** already runs lint, typecheck, tests and build on every push.

Old saved initiative data can be dropped (confirmed: no current users), so no
migration is needed.

## Decisions (owner, 2026-11-24)

1. **First side:** the table always rolls the d10 itself. The app just offers
   "Heroes first" / "Enemies first". No roller.
2. **Surprise:** not tracked.
3. **Squads:** minion squads share one Stamina pool. A squad is minions,
   sometimes plus a captain, and the captain acts on the squad's turn.
4. **Grouping:** different non-minion monsters are often grouped into one turn,
   so any enemies can be grouped freely ("Act together with…"), and split back
   out.
5. **Wording:** keep "Bloodied". It's the term used at the table. (Minions are
   never shown as bloodied.)

6. **Solo monsters** (added later the same day): a solo takes two turns each
   round and can't take them back to back. Built into the turn order rather
   than a "go again" button. A pasted stat block that says "Solo" sets it, and
   a toggle on any enemy card sets it by hand. If the solo's remaining turn
   could only come straight after its own (nobody else left), the round can
   end without it, and "go next" still lets the Director force it.

7. **Malice** (added later): per the Steel Compendium, the Director gains
   the heroes' average Victories when combat starts, and heroes + round
   number at the start of every round (round 1 included). Granted
   automatically when the first side is tapped and on each new round
   (Draw Steel mode only). Spent with quick buttons. Director-only, never on
   the Map View.

8. **Conditions** (added later): the nine Draw Steel conditions plus Marked,
   on any creature, with three durations. **EoT** ends when that creature's
   turn ends. **Save ends** gets a "Save vs X?" prompt at the end of each of
   its turns (Saved removes it, Failed keeps it). **Until removed** stays until
   cleared. Conditions on a creature type apply to the whole member (all N
   copies), not per individual. Shown on the Map View.

## As built

- Rules core: `src/lib/krismaps/initiative/` (model, members, reducer,
  selectors, normalize, parse).
- Tests: `src/lib/krismaps/__tests__/initiative.rules.test.ts` (one test per
  rule plus scenarios) and `initiative.properties.test.ts` (fast-check: random
  encounters and action sequences, invariants checked after every step). The
  property tests caught that "go next" could start combat before a first side
  was chosen.
- UI: `src/components/krismaps/initiative/` (panel split into AddToCombat,
  TurnOrder, GroupCard, MemberCard, StatBlock, OverlaySettings, sharing a
  context). Map View overlay: `InitiativeOverlay.tsx`.
- e2e: `e2e/initiative.spec.ts` plays a full combat through the UI.
- Saved initiative from before the rework is discarded on load (state version
  2). The overlay layout is kept.
