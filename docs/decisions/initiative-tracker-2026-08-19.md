# Initiative Tracker

Add Draw Steel style alternating initiative, controlled from Director View and mirrored onto the Map View with a movable, resizable, rotatable overlay.

## Fast data entry

A single input at the top of a new Initiative panel in the Director sidebar:

- Toggle (or `Tab`) switches the input between Enemy (red) and Hero (green); `Enter` adds and keeps focus for the next entry.
- Typed shorthand parsed as you go: `Goblins x4 40` = name `Goblins`, count 4, HP 40 (count and HP optional, either order tolerated).
- Entries render as coloured plates: red for enemy groups, green for heroes.

## Per-entry controls (Director only)

- Count badge with +/- (drops to 0 = removed from the round).
- HP with +/- and a direct type-in field; max HP remembered so "Bloodied" can be computed.
- Mark turn taken, insert-next, remove, drag to reorder.

## Turn order rules

- Pick any entry to go first. After each turn the tracker highlights the opposite side (enemy -> hero -> enemy).
- If one side has no un-acted entries left, all remaining entries of the other side are eligible in one block.
- "Go next" override on any entry forces it to be the next turn regardless of alternation.
- Clicking an entry marks its turn taken; when every entry has acted, the round counter advances and all turns reset.
- Round counter with manual +/- as a fallback.

## Map View overlay

- Shows the same list: current turn strongly highlighted, acted entries dimmed.
- Heroes show name and current/max HP. Enemies show name and count only — no numbers — plus a "Bloodied" marker when at or below half HP.
- Orientation switchable between vertical list and horizontal bar.

## Overlay placement controls (from Director)

A small Overlay section in the Initiative panel:

- Orientation: vertical / horizontal.
- Scale slider (roughly 50%–200%).
- Rotation: 0 / 90 / 180 / 270.
- Position: drag a mini preview pad, plus nudge arrows and quick presets (corners / edges). Position stored as a fraction of screen size so it survives resolution changes.
- Show/hide toggle for the whole tracker on the table screen.

## Persistence

Initiative list, round number and overlay layout are saved locally and restored on reload. A Clear Combat button empties the list and keeps the layout.

## Technical notes

- New `src/lib/krismaps/initiative.ts`: types (`Combatant`, `Side`, `InitiativeState`, `OverlayLayout`), the entry parser, and pure turn-order helpers (`nextEligible`, `markActed`, `advanceRound`).
- New store `initiative` in the existing IndexedDB helper (`db.ts`, version bump to 2) holding one persisted state record; loaded on mount in both views.
- Extend `KrisMessage` in `channel.ts` with `{ type: "initiative"; state: InitiativeState }`; Director broadcasts on every change, and replies to the existing `hello` so a freshly opened Map View syncs immediately.
- New `src/components/krismaps/InitiativePanel.tsx` (Director controls) and `src/components/krismaps/InitiativeOverlay.tsx` (DOM overlay rendered above the canvas in both `/table` and, at reduced opacity, in `DirectorStage` for reference).
- Overlay is DOM/CSS (absolute positioning + `transform: translate/rotate/scale`), not canvas, so it never interferes with fog painting or the video redraw loop.
