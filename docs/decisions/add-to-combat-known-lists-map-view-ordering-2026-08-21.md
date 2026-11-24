# Add to Combat known lists + Map View ordering

## Add to combat

- Known heroes list only renders when the **Heroes** side is selected.
- When **Enemies** is selected, show a **Known enemies** list instead, built from the remembered stat block images (the saved monster portraits, keyed by monster name).
  - Each chip adds that monster with its remembered max Stamina and its saved stat block image, styled in the enemy red.
  - Chips for monsters already in combat are dimmed but still clickable (adding a second group of the same monster is allowed for enemies), showing a count marker if already present.
  - An X on each chip forgets that remembered enemy (removes its saved image and remembered Stamina).
- The "Ctrl+V a stat block" zone stays visible only on the Enemies side, since it always creates an enemy.

## Map View ordering (Draw Steel only)

Reorder the overlay list into three groups with a visible divider between them:

```text
[ Active ] | [ Unacted, in Director order ] | [ Acted ]
```

- Active combatant first, strongly highlighted.
- Unacted, non-active combatants next, keeping their Director list order.
- Acted combatants last, dimmed as they are now.
- Divider is a thin rule that follows the overlay orientation (vertical rule for horizontal layout, horizontal rule for vertical), and is only drawn when both neighbouring groups are non-empty.
- D&D mode keeps the fixed top-to-bottom list with no reordering or dividers.

## Technical details

- `InitiativePanel.tsx`: gate the roster block on `side === "hero"`; add a parallel known-enemies block driven by the portrait keys plus `useMonsterMemory` for remembered Stamina; reuse the existing add path so the portrait is attached on add.
- `portraits.ts` / `roster.ts`: expose the remembered-name list and a forget path for enemies (names already normalised lowercase, so display them capitalised as stored in monster memory where available).
- `InitiativeOverlay.tsx`: derive the grouped order from existing state (`currentId`, `acted`, `mode`) — presentation only, no changes to initiative logic or persistence.
