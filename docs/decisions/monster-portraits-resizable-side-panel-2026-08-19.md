# Monster portraits + resizable side panel

## Monster portraits (Director panel only)

- Each enemy row in the initiative panel gets a small image icon button next to its controls.
- Clicking the icon opens a paste target: while focused, Ctrl+V pastes an image straight from the clipboard (screenshot, copied web image). A file picker fallback is included for when the clipboard has no image.
- Once pasted, the image is shown beneath that monster's controls (a compact thumbnail, clickable to enlarge, with a remove button).
- Images are remembered by monster name: typing "Goblins" again in a later session automatically shows the last image pasted for that name.
- Nothing changes on the Map View — portraits stay private to the Director.

## Resizable side panel

- The Tools/Initiative sidebar gets a drag handle on its left edge. Dragging left widens it, dragging right narrows it (clamped to a sensible min/max so the map stays usable).
- Double-clicking the handle resets to the default width.
- The chosen width persists between sessions.

## Technical notes

- New `src/lib/krismaps/portraits.ts`: `useMonsterPortraits` hook storing `name -> Blob` in the existing IndexedDB `state` store (keyed record), exposing `get/set/remove` plus object URLs created on load and revoked on unmount.
- `InitiativePanel.tsx`: new props `portraits`, `onSetPortrait`, `onClearPortrait`. Enemy rows render an `ImagePlus` icon button; a focused wrapper handles `onPaste`, reading `event.clipboardData.files`/items of type `image/*`. Thumbnail rendered under the row's controls.
- `src/routes/index.tsx`: wires the hook into `InitiativePanel`; adds `panelWidth` state with a pointer-drag handle (`pointerdown`/`pointermove`/`pointerup` on a 4px divider), replacing the fixed `w-80` with an inline width style, clamped 280–720px and persisted to IndexedDB alongside the existing stage-tab state.
