# Correct Draw Steel initiative flow

Replace the current implicit alternating-list interaction with an explicit two-pool workflow in Draw Steel mode, while leaving D&D initiative as a fixed ordered list.

## Director workflow

- Split Draw Steel combatants into clearly labelled **Unacted** and **Acted** pools.
- When no combatant is active, make eligible entries in **Unacted** selectable:
  - At the start of a round, either side may be selected.
  - After a turn ends, only unacted combatants from the opposing side are selectable.
  - If the opposing side has no unacted combatants, any remaining combatant is selectable.
- Selecting an eligible combatant makes them **Active** without marking them acted.
- Give the active combatant a clear **End turn** action. Ending the turn moves them into **Acted**, clears Active, and prompts selection from the required side.
- Keep the existing “go next” override, allowing one unacted combatant to be selected regardless of the required side.
- Disable or visually de-emphasize ineligible and already-acted entries so the available choice is unambiguous.

## Round transition

- Remove automatic round advancement in Draw Steel mode.
- Once every combatant is in **Acted**, show a prominent **Start next round** action instead of selecting or starting anyone automatically.
- Starting the next round increments the round counter, returns every combatant to **Unacted**, clears Active and overrides, and allows either side to choose the first combatant.
- Keep manual round controls and reset/clear controls as fallbacks.

## Map View

- Continue mirroring the same initiative state live.
- Strongly highlight the Active combatant, show unacted combatants normally, and dim combatants in the Acted pool.
- Do not expose Director-only selection and round controls on the Map View.

## Technical details

- Adjust the pure initiative helpers so `takeTurn` marks the active combatant acted but does not auto-select another combatant or auto-advance Draw Steel rounds.
- Derive Unacted, Active, Acted, required side, eligible IDs, and round-complete state from the existing persisted combatant state; no persistence migration is required.
- Branch mode-specific behavior so D&D retains its fixed top-to-bottom progression and existing automatic sequencing.
- Add focused logic tests for first selection, alternating sides, exhausted-side fallback, override selection, Active-to-Acted transition, and explicit new-round reset.
- Verify the full Director and Map View flow in the browser, including reload persistence and cross-window synchronization.
