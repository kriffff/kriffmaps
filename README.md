# KriffMaps

A lightweight battlemap display for tabletop RPG combat (built for Draw Steel,
with a D&D initiative mode too).

Live at **https://kriffmaps.pages.dev**

- **Director View** (`/`) is your laptop window. Browse battlemaps (images or
  videos) straight from a folder on your drive, paint fog of war, set a grid,
  rotate/mirror, and run initiative. You can paste a stat block screenshot and
  the monster's name and Stamina are read on your device.
- **Map View** (`/table`) is the window for the table screen. Open it with
  **Open Map View**, drag it to the TV and make it fullscreen. It mirrors the
  Director live.

Nothing is uploaded. Your maps stay on your drive, and everything KriffMaps
remembers (grids, fog, favourites, tags, initiative, heroes, stat blocks) is
saved in your browser. Pick your map folder once per session and it all
re-attaches.

After your first visit KriffMaps works offline, including stat block reading,
and you can install it as an app (browser menu → Install / Add to Home Screen).
Updates download quietly in the background and apply the next time you open it.

## Backing up / moving your data

Saved data belongs to one browser on one site address. Use **Backup → Export
data…** to save it all to a file, and **Backup → Import data…** to load it
elsewhere (another browser, another computer, or a new site address).

## Development

Requires [bun](https://bun.sh) 1.4+.

```sh
bun install
bun run dev        # http://localhost:5173
```

Other commands: `bun run build`, `bun run lint`, `bun run typecheck`,
`bun run preview` (production build on Cloudflare's local runtime, port 8788).

## Deployment

Hosted on Cloudflare Pages, project `kriffmaps` (`wrangler.jsonc`). Deploys are
done by hand with `bun run deploy` (after `bunx wrangler login`, or with
`CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` set). There is no automatic
deploy: GitHub Actions (`.github/workflows/ci.yml`) only lints, type-checks and
builds every push and pull request.

## Built with

React, TypeScript, Vite, TanStack Router, Tailwind CSS, shadcn/ui, tesseract.js.
Architecture notes for contributors and AI agents are in [CLAUDE.md](CLAUDE.md).
Feature design records are in [docs/decisions](docs/decisions).

## Licence and credits

KriffMaps is made by **kriffff** and released under the [MIT licence](LICENSE):
you're free to use, change and share it for any purpose, as long as the
copyright notice stays with the code.

KriffMaps is an unofficial fan tool. It isn't affiliated with or endorsed by
MCDM Productions. _Draw Steel_ is a trademark of MCDM Productions, LLC. The
stat blocks in the test fixtures are original creations made to mimic the
layout, not MCDM content.

Third-party components keep their own licences: Tesseract OCR and its English
language data (Apache-2.0), the Barlow and Oswald fonts (SIL Open Font
License) and the npm packages listed in `package.json` (mostly MIT).
