# Grid sizing: pixels or cell counts

Add a mode toggle under Grid in the Stage tools panel so you can size the grid either by pixel cell size (today's behaviour) or by how many cells fit across and down the map — with separate "cells wide" and "cells high" numbers, so cells can be non-square.

## Behaviour

- New segmented toggle at the top of the Grid settings box: **Pixels** / **Cell count**.
- Pixels mode: unchanged — one Cell size number + slider, square cells.
- Cell count mode: two controls, **Cells wide** and **Cells high** (number input + slider, 1–100 each). Grid step becomes imageWidth / cellsWide horizontally and imageHeight / cellsHigh vertically, so lines always land exactly on the map edges.
- Offset X/Y sliders stay in both modes, ranged against the effective step for that axis.
- Line colour and opacity unchanged.
- Setting is per-map, saved with the rest of that map's settings, and mirrors live to the Map View.

## Technical notes

- `MapSettings` gains `gridMode: "pixels" | "count"`, `cellsWide: number`, `cellsHigh: number` (defaults `"pixels"`, 20, 20). Existing saved maps without these fields fall back to defaults, so nothing breaks.
- `drawScene` in `src/lib/krismaps/render.ts` computes `stepX`/`stepY` from the mode instead of the single `cell` value, and uses each per axis when drawing lines.
- `StageToolsPanel.tsx` renders the toggle and the two count controls; `MapPreviewDialog` is untouched.
- Existing broadcast channel already sends the full settings object, so Map View needs no change.
