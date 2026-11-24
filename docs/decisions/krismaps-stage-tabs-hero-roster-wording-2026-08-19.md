# KrisMaps — Stage tabs, hero roster, wording

## 1. Hero roster (remembered heroes)

- Every hero entered into initiative is saved to a remembered hero list (name + HP), persisted locally.
- The hero entry field gains a pick-list of remembered heroes: click a name to add it to initiative instantly (with its saved HP).
- Each remembered hero has a small X to forget it.
- HP is editable in the initiative list: click the HP value on a hero or monster group and type a new number (current HP and max HP both editable). Editing a hero's HP also updates the remembered HP so next session starts from the new value.

## 2. Wording

- "Cell size" / "Cells wide" / "Cells high" / "Cell count" become "Square size" / "Squares wide" / "Squares high" / "Square count".
- The map preview pop-up button "Display on screen" becomes "Preview on Stage".

## 3. Tools and Initiative as tabs

The right-hand Stage sidebar becomes two selectable tabs — Tools and Initiative — instead of two stacked panels, so each gets the full height without scrolling past the other.

## 4. Preview tabs on the Stage + explicit "Display in Map View"

Today clicking a map immediately becomes the map on the table screen. New behaviour:

- Clicking "Preview on Stage" in the pop-up opens that map as a tab on the Stage. Several maps can be open at once.
- A tab strip runs along the top of the Stage: one tab per opened map, plus a marker on whichever map is currently live in Map View. Each tab has an X to close it.
- The live Map View map is always available as a tab even if its preview tab is closed, so you can flip back to what the players are seeing.
- A "Display in Map View" button pushes the currently selected tab to the Map View. Until pressed, nothing you do on the Stage changes what the players see, except when the selected tab _is_ the live map — then fog painting, grid and orientation changes mirror live as they do now (that is the point of the live tab).
- Fog painting, grid and orientation edits on a non-live tab are saved against that map and go live the moment it is displayed.

## 5. Persistence between sessions

- Open tabs, which tab was live, and the selected tab are stored locally and restored on reload.
- Per-map settings and painted fog already persist and continue to.
- Because browsers can't re-read a folder without permission, you still pick the map folder once per session; as soon as it's picked, the remembered tabs re-attach to their files by path. Tabs whose files are no longer in the folder are dropped.

## Technical notes

- `MapSettings` unchanged; new IndexedDB `state` keys: `stageTabs` (`{ paths: string[], activePath, livePath }`) and `heroRoster` (`{ name, hp }[]`).
- `src/routes/index.tsx` owns tab state: `openPaths`, `selectedPath`, `livePath`; `DirectorStage` renders `selectedPath` and only broadcasts `scene`/`settings`/`stroke`/`fill` when `selectedPath === livePath`. `Display in Map View` sets `livePath` and forces a scene broadcast.
- Fog masks keyed by path already, so per-tab painting needs no schema change.
- `StageToolsPanel` + `InitiativePanel` wrapped in the existing shadcn `Tabs`.
- Hero roster helpers live in `src/lib/krismaps/initiative.ts` / a small `roster.ts`; HP edit uses an inline number input that writes through `initiative.update`.
