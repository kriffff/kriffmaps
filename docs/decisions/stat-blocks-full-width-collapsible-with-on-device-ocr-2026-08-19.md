# Stat blocks: full width, collapsible, with on-device OCR

Monster images are stat blocks, not portraits, so they get treated as reference sheets: readable at panel width, out of the way when it isn't that monster's turn, and able to fill in the monster's name and Stamina by reading the pasted image locally.

## Display

- A pasted stat block renders at the full width of the Initiative panel (so it scales up as the sidebar is dragged wider), with its natural aspect ratio.
- The active monster's stat block is expanded automatically. Every other monster's collapses to a thin labelled strip.
- Any collapsed stat block can be clicked open at any time, out of turn, and any number can stay open at once. A manual open/close always wins over the auto-behaviour until the turn changes.
- Expanded blocks keep a max height with scroll so a tall block can't push the rest of the list off screen; clicking the image still opens the full-size version in a new tab, and the remove button stays.
- Terminology in these rows changes from HP to Stamina (labels and tooltips); the underlying value is the same one already tracked.

## OCR (fully on-device)

- On paste (or file pick) the image is handed to Tesseract running as WebAssembly in the browser. Nothing is uploaded; the engine and English data are fetched once and cached by the browser.
- A small "Reading stat block..." indicator shows on that row while it runs, then:
  - **Name** — taken from the largest text line in the top-left region of the block.
  - **Stamina** — the number sitting directly above the word "Stamina" in the header strip, matched by word position rather than reading order.
- Both fields are filled in only when confidently found, are always editable afterwards, and a failed read leaves the row untouched with a quiet "couldn't read that" note. A re-run button lets the user retry.
- Renaming from OCR re-keys the remembered image so the same name pasted in a future session brings the stat block back, as it does today.
- One stat block per paste is assumed. If the pasted screenshot contains two side-by-side blocks, the left one is used — cropping to a single block gives the best result.

## Technical notes

- Add `tesseract.js`; import it dynamically inside the paste handler so the worker/WASM never enters the SSR or server bundle, and instantiate a single lazily-created worker reused across pastes.
- New `src/lib/krismaps/statblock.ts`: `recognizeStatBlock(blob)` returning `{ name?: string; stamina?: number }`. Uses `recognize` with word-level output, then:
  - name: words in the top ~18% and left ~55% of the image, grouped by line, largest average glyph height wins;
  - stamina: locate the word `Stamina` (case-insensitive), then pick the numeric word whose bbox centre-x is within that word's column and whose bottom is above it.
- `portraits.ts` gains a `renamePortrait(from, to)` helper so an OCR'd name can move the stored blob key.
- `InitiativePanel.tsx`: stat block block moves out of the row's control cluster into a full-width area below it; new `expandedIds` set state plus derived default from `state.currentId`; new `ocrBusy` / `ocrError` per-row state; on successful OCR it calls `update` to set the combatant's `name`, `hp` and `maxHp`, and `onRemember` for the roster where relevant.
- No change to `InitiativeOverlay.tsx` or the channel: stat blocks stay Director-only.
