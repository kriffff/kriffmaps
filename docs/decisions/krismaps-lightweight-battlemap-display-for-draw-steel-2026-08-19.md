# KrisMaps — lightweight battlemap display for Draw Steel

A two-window web app: **Director View** (your laptop) and **Map View** (the table screen). No uploads, no server — your map files stay on your drive.

## Firefox and local folders

Firefox does not support the File System Access API, so instead KrisMaps uses a folder picker (`<input webkitdirectory>`), which Firefox does support. You click "Choose map folder", pick your maps root, and the browser hands the app the whole tree — filenames, subfolder paths, and the image data — read directly from disk. Nothing is uploaded or copied anywhere; images are rendered from local memory.

The one trade-off: Firefox cannot remember the folder grant between sessions, so at the start of a session you re-pick the folder (one click, it remembers the last location). Everything else — favourites, grid settings, painted fog — is remembered per map and reattaches automatically once the folder is re-picked, matched on the file's path inside your maps root.

## 1. Map browser (Director View, main screen)

- Left: folder tree — your root, all subfolders, plus a pinned **Favourites** meta-folder at the top.
- Right: thumbnail grid of images in the selected folder, with a size slider (small → extra large, Explorer-style). Thumbnails are generated once per file and cached, so scrolling stays fast in big folders.
- Supported: jpg, jpeg, png, webp, gif, avif.
- Click a thumbnail → preview modal: large image on the left, sidebar on the right with
  - Add to / remove from **Favourites**
  - **Display on screen** (makes it the active map and pushes it to Map View)
  - **Gridded** toggle
  - **Fog of war** toggle

## 2. Opening Map View

A "Open Map View" button opens a second window (drag it to the TV, then fullscreen it). The two windows talk over a same-origin channel — image data, grid settings, fog strokes, rotation — with no network round-trip. If the window is closed or reloaded it re-syncs the current state on connect.

## 3. Director View — live map controls

Over the active map:

- **Fog brush / eraser** with adjustable brush size. Map starts fully blacked out; you paint to reveal. In Director View fog shows as a translucent overlay so you can still see the terrain underneath; on Map View it's opaque black.
- Also: reveal-all and hide-all buttons for fast scene resets.
- **Rotate** 90° left/right and **mirror** horizontally / vertically.
- **Grid**: on/off, cell size in pixels (slider + numeric input), plus X/Y offset nudge so the grid lines up with the map's own squares, and grid colour/opacity.
- Pan and zoom the Director preview independently of what the table sees (the table always shows the whole map fitted to the screen).

## 4. Map View — the table screen

Clean output only: the map fitted to the screen (respecting rotation/mirror), the grid if enabled, and opaque fog if enabled. No UI chrome, no cursor, black background.

## Per-map memory

Saved locally and keyed by the map's path under your root: favourite flag, grid on/off + size + offset, rotation/mirror, fog toggle, and the painted fog mask. Reopening a map next session restores exactly where combat left off.

## Technical notes

- Single route `/` for Director View, `/table` for Map View. Both client-only; no backend, no Lovable Cloud — nothing leaves the machine.
- Folder ingest: `<input type="file" webkitdirectory>`; `file.webkitRelativePath` reconstructs the tree. Files held as `File` handles in memory; object URLs created lazily per displayed image and revoked on eviction.
- Cross-window sync: `BroadcastChannel("krismaps")`. The active map's `Blob` is structured-cloned to Map View, which makes its own object URL — this avoids cross-window blob-URL lifetime issues in Firefox.
- Rendering: single `<canvas>` stack per view — image layer (transformed), grid layer (drawn from cell size/offset), fog layer (offscreen mask canvas at reduced resolution, ~1024px on the long edge, composited with `destination-out` for revealed areas).
- Fog sync: brush strokes broadcast as normalised point/radius events so Map View replays them on its own mask (small messages, no full-mask transfer during drawing); full mask snapshot sent on map switch or on Map View connect.
- Persistence: IndexedDB via a small store — settings records plus fog masks as PNG blobs, keyed by relative path. Thumbnail cache in the same DB, keyed by path + size + last-modified.
- Design: dark slate UI with a warm amber accent, condensed display face for headings — a game-table tool, not a SaaS dashboard. All colours as semantic tokens in `src/styles.css`.

## Not in this build

Creature tokens, measurement/ruler tools, initiative tracking, multi-user/remote play. Deliberately deferred — the fog/grid/canvas layer is built so tokens can slot in later.
