# CLAUDE.md

Guidance for Claude (and other coding agents) working on KriffMaps.

## Public repository rules

The repo is public under the MIT licence (`LICENSE`, © kriffff).

- Never commit MCDM content: real stat blocks, monster names, ability text or
  screenshots. Test fixtures must be original creations. Real screenshots the
  owner shares are for local checks only.
- Never commit personal data. Commits use the owner's GitHub noreply address
  (`195668544+kriffff@users.noreply.github.com`).
- New dependencies must have a licence compatible with MIT (MIT, BSD, ISC,
  Apache-2.0, OFL for fonts). Note anything else in the README.

## Hard rule

**The app must stay fully client-side unless the owner explicitly says otherwise.**
No backend, no server functions, no API routes, no databases, no analytics,
no third-party runtime services. All data lives in the user's browser.
Don't add SSR, `createServerFn`, Pages Functions / Workers code, or new external network calls
without asking first. The app makes no external requests at all: fonts
(`@fontsource/*`) and OCR files are bundled and served from our own origin.
Keep it that way.

## What it is

A two-window battlemap display for tabletop RPGs (Draw Steel / D&D):

- **Director View** (`/`, `src/routes/index.tsx`): the GM's window. Library of
  maps from a local folder, a Stage with tabs, fog painting, grid, rotation,
  and an initiative tracker with stat-block OCR.
- **Map View** (`/table`, `src/routes/table.tsx`): the players' screen. It shows
  the live map, grid, opaque fog and the initiative overlay, mirrored from the
  Director View.

Design decisions behind each feature are in `docs/decisions/` (written when the
app was built). Read the relevant one before changing a feature.

## Architecture

- **Stack:** React 19, TypeScript (strict), TanStack Router (file-based routes
  via the Vite plugin), Tailwind CSS v4, shadcn/ui (Radix), Vite 8, bun.
- **Build:** plain Vite SPA. `index.html` (static head tags) loads
  `src/main.tsx`, which renders the router; routes set their titles with
  `head()` (React 19 hoists them). There's no SSR, prerendering or hydration.
  Output is static files in `dist/`. TanStack Start was removed in Nov 2026:
  it was a server framework used only to prerender a shell.
- **Hosting:** Cloudflare Pages, project `kriffmaps`, at https://kriffmaps.pages.dev
  (`wrangler.jsonc`, `pages_build_output_dir`). Static files only, no
  Functions. With no `404.html`, Pages serves the shell for `/table` and other
  client routes. Deploys go to the production branch via `--branch main`.
- **Map files** are picked with `<input webkitdirectory>` (works in Firefox) and
  held as `File` objects in memory. They are never uploaded or copied. Per-map
  data is keyed by the file's path relative to the chosen root.
- **Cross-window sync:** `BroadcastChannel("krismaps")` (`src/lib/krismaps/channel.ts`).
  The Director posts `scene` (map Blob, settings, fog snapshot), `settings`,
  `stroke`/`fill` fog events, `initiative` and `clear`. The Map View sends
  `hello` on load and the Director replies with the current state.
  Both windows must be on the same origin and in the same browser profile.
- **Rendering:** canvas (`src/lib/krismaps/render.ts`). Image/video layer,
  grid, and a reduced-resolution fog mask composited on top. The initiative
  overlay is DOM, not canvas.
- **Offline:** `scripts/generate-sw.mjs` runs after `vite build` and writes
  `dist/sw.js`, which precaches every built file (~15 MB, mostly OCR)
  under a content-hashed cache name. Navigations are served the cached shell
  (cached as `/`, because Pages redirects `/index.html`). New versions install
  in the background and apply on the next load. The worker is registered in
  `__root.tsx` in production builds only. Anything the app loads at runtime
  must live in `dist/`, or it won't work offline. `public/manifest.webmanifest`
  and `public/icons/` make it installable. `public/_headers` stops `sw.js` being
  cached.
- **OCR:** paste a stat block → `statblock.ts` (canvas upscale + threshold,
  then `tesseract.js`, lazily imported) → `statblockParse.ts`, a pure parser for
  the Draw Steel layout. It anchors on the Size/Speed/Stamina/Stability/Free
  Strike label row, which fixes the block's extent: side-by-side screenshots
  read the left block and a solo's second column is ignored. The name comes
  from the "Level N ‹Organisation› ‹Role›" line, and minions' squad size from
  "EV 6 for four minions". Unit tests run on recorded OCR words
  (`__tests__/fixtures/statblock-words/`). `e2e/statblocks.spec.ts` pastes the
  fixtures in `e2e/fixtures/statblocks/` through the real browser pipeline.
  Those are original monsters rendered by `render.mjs` in the Draw Steel layout
  (no MCDM content). The worker, LSTM WASM cores and
  `eng.traineddata.gz` are self-hosted under `/tesseract/`, copied from
  node_modules by `scripts/copy-tesseract-assets.mjs` before every dev/build
  (git-ignored output). Don't revert to the jsdelivr defaults.

## Folder layout

```
src/
  main.tsx           entry: renders the router (router.tsx)
  routes/            __root.tsx (root layout, 404, error boundary), index.tsx (Director, composes
                     the pieces below), table.tsx (Map View), $.tsx (catch-all 404)
  routeTree.gen.ts   generated by the router plugin; never edit by hand
  components/krismaps/          app components (DirectorStage, InitiativeOverlay, BackupMenu, ...)
  components/krismaps/director/ Director View layout: header, library pane, stage tab strip,
                                side panel, resize handle, column sizes
  components/krismaps/initiative/ initiative panel: AddToCombat, TurnOrder, GroupCard,
                                MemberCard, StatBlock, OverlaySettings (shared context)
  components/ui/     the shadcn/ui primitives actually used; add new ones only when needed
  lib/krismaps/      app logic: db, channel, types, render, media, library, libraryView (pure
                     library selection logic), tags, initiative/ (Draw Steel rules core:
                     model, reducer, selectors, normalize — see below), useInitiative, roster,
                     portraits, statblock, backup, cleanup, and hooks: useMapSettings,
                     useStageTabs, usePersistedState
  lib/krismaps/__tests__/  unit tests (bun test)
  lib/utils.ts       cn() helper
  styles.css         Tailwind v4 + design tokens (dark slate, warm accent)
scripts/             build helpers (Tesseract asset copy, service worker generation)
e2e/                 Playwright specs + fixtures
docs/decisions/      feature design records
public/              static files (favicon, robots.txt; tesseract/ is generated)
```

## Initiative (Draw Steel)

Rules are in `docs/decisions/draw-steel-initiative-rework-2026-11-24.md`. In
short: an encounter is a list of turn **groups**, each a hero or any set of
enemies acting together. Groups hold **members**: individually tracked
`creatures` or a `minions` squad with a shared Stamina pool. The Director
taps Heroes first / Enemies first (that side starts every round), sides
alternate, and when one side is spent the other goes back to back. Dead
enemies drop out, while dying heroes keep acting. Solo groups (`turns: 2`)
take two turns a round, never back to back. "Go next" overrides the side.

- State changes **only** through `initiativeReducer` actions (`useInitiative().dispatch`).
  Never edit state in components. Derive everything else with the selectors.
- Side effects (remembering heroes and monster Stamina, moving stat block images)
  happen in the panel after dispatching, never inside the reducer.
- Every rule change needs a test in `initiative.rules.test.ts`, and must keep
  `initiative.properties.test.ts` passing. Add an invariant there if the rule
  is general.
- Loaded or received state always goes through `normalizeInitiative`. Bump
  `STATE_VERSION` for incompatible shape changes.

## Data model (IndexedDB `krismaps`, version 3; `src/lib/krismaps/db.ts`)

| Store        | Key                        | Value                                                                                                                    |
| ------------ | -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `settings`   | map path                   | `MapSettings` (favourite, grid mode/size/offset/colour, fog on, muted, rotation, flips, lastUsed, tagsAdd/tagsRemove)    |
| `fog`        | map path                   | PNG `Blob` of the fog mask                                                                                               |
| `thumbs`     | `path\|lastModified\|size` | thumbnail `Blob` (a cache; safe to lose)                                                                                 |
| `state`      | named keys                 | `initiative` (v2, see Initiative), `heroRoster`, `monsterStamina`, `tagRules`, `stageTabs`, `panelWidth`, `libraryWidth` |
| `statblocks` | lower-cased monster name   | stat block image `Blob` (one record per monster; v3 moved these out of `state.monsterPortraits`)                         |

Rules:

- New settings fields must be optional or have defaults in `defaultSettings`,
  because old records lack them. Never require a migration for additive changes.
- If you add a store, add it to `ALL_STORES` and bump `DB_VERSION`.
- Backup → Clean up saved data deletes `settings`, `fog` and `thumbs` records
  for maps not in the chosen folder (`src/lib/krismaps/cleanup.ts`). Backups pick
  up every store in `ALL_STORES` automatically.
- Backup file format (`src/lib/krismaps/backup.ts`):
  `{ format: "kriffmaps-backup", version: 1, exportedAt, stores: { [store]: { [key]: value } } }`
  with Blobs encoded as `{ "$blob": "<data URL>" }`. Bump `BACKUP_VERSION`
  only for incompatible changes, and keep importing older versions.

## Commands (bun)

```sh
bun install            # install deps (bun.lock is the lockfile)
bun run dev            # dev server at http://localhost:5173 (copies tesseract assets first)
bun run build          # production build to dist/
bun run preview        # build, then serve with wrangler pages dev (Cloudflare runtime) on :8788
bun run lint           # eslint + prettier check (must be 0 errors)
bun run typecheck      # tsc --noEmit
bun run test           # unit tests (bun test, src/**/__tests__)
bun run e2e            # build, then Playwright end-to-end tests against wrangler pages dev
bun run format         # prettier --write .
bun run deploy         # build + wrangler pages deploy to production (needs Cloudflare credentials)
```

Before committing, run `bun run lint && bun run typecheck && bun run test && bun run e2e`.
Unit tests sit next to the code in `__tests__/`; end-to-end specs and fixtures
are in `e2e/`. Every user-facing change needs an e2e assertion, every rule a
unit test.
CI (`.github/workflows/ci.yml`) runs the same on every push and PR. It does
**not** deploy.

## Deploying

Claude is the only one who deploys. After pushing a change to `main`, always
deploy from the session straight away so the live site matches `main`:

```sh
CLOUDFLARE_API_TOKEN="$Cloudflare_api_token" CLOUDFLARE_ACCOUNT_ID="$Cloudflare_account_id" \
  WRANGLER_SEND_METRICS=false bun run deploy
```

Then confirm through the Cloudflare API that the newest `kriffmaps` Pages
deployment is `production` with status `success`. The sandbox can't open
`kriffmaps.pages.dev` directly, so ask the owner to check the site if a change
is user-visible. Only deploy from `main`.

Cloudflare credentials are the cloud environment variables
`Cloudflare_api_token` / `Cloudflare_account_id`. Never print them.

## Conventions

- TypeScript strict mode, including `noUncheckedIndexedAccess` and
  `exactOptionalPropertyTypes`. Use `@/` imports for `src/`.
- Prettier: 100 columns, double quotes, trailing commas (see `.prettierrc`).
- Persist through the `idbGet`/`idbSet`/`idbEntries` helpers. Hooks load on
  mount and write on change, with a "loaded" guard so they don't overwrite
  stored data with defaults.
- Keep pure logic (initiative rules, tags, parsing) in `lib/` and free of React
  where possible. UI goes in `components/krismaps/`.
- Colours come from semantic tokens in `src/styles.css`. Don't hardcode new
  palette colours.
- Director-only things (stat blocks, portraits, controls) must never be sent
  over the channel to the Map View.
- Keep the Map View free of UI chrome.
- Small, focused commits with descriptive messages. Behaviour changes need
  the owner's OK.
- Verify UI changes in a real browser (Playwright is available in cloud
  sessions): load `/` and `/table`, check that the two windows sync and that the
  console has no errors.
