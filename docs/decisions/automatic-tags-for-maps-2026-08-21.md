# Automatic tags for maps

Yes — this works entirely on-device with zero AI or cloud compute. Tags are derived from the words already in your file names and folder paths, matched against a built-in keyword dictionary of common battlemap themes. Nothing to tag by hand, and new files are tagged the moment the folder is picked.

## How auto-tagging works

Every map's full relative path (folders + file name) is split into words — separators, camelCase, digits stripped — then matched against a keyword dictionary. A map can carry several tags.

Starter dictionary (each tag has a synonym list):

- City — city, town, village, market, street, urban, tavern, inn, shop, alley, plaza, docks, harbour/harbor
- Wilderness — forest, wood, jungle, plains, hills, swamp, marsh, desert, tundra, snow, mountain, river, lake, coast, beach, road, camp
- Dungeon — dungeon, crypt, tomb, catacomb, cave, cavern, mine, lair, sewer, vault, prison, labyrinth, maze
- Interior — room, hall, chamber, library, throne, kitchen, cellar, basement, temple, chapel, church, keep, manor, house, ship interior
- Fortification — castle, fort, tower, keep, wall, gate, battlement, siege
- Water/Sea — ship, boat, sea, ocean, island, port, deck, bridge, ford
- Underdark/Cave — underdark, abyss, chasm, pit, tunnel
- Planar/Special — planar, hell, heaven, feywild, astral, void, volcano, ruins, arena, colosseum

Unmatched maps get no tag and appear under an **Untagged** entry inside Tags, so nothing gets lost.

The dictionary is editable in the app: a small "Tag rules" dialog where you can add/rename a tag, add keywords, or delete one. Rules are stored locally (IndexedDB) and re-applied automatically every session — no re-scan needed by you.

Optional per-map override: in the map preview pop-up, a tag row where you can add or remove a tag for that specific map. Overrides are stored by relative path and win over the auto rules.

## Sidebar structure

The left panel becomes three pinned meta-entries plus a Folders section:

```text
Favourites            (12)
Last Used             (23)
Tags
  ├ City              (34)
  ├ Dungeon           (58)
  ├ Wilderness        (41)
  └ Untagged          (9)
Folders
  └ <your maps root>
      ├ Battlemaps
      └ Scenes
```

- Tags is collapsible; clicking a tag shows every matching map from anywhere in the tree in the thumbnail grid.
- Folders is collapsible and holds the existing folder tree unchanged.
- Counts shown per tag, same style as folder counts.
- Multi-select tags (ctrl-click to intersect) is not in this build — one tag at a time.

## Technical notes

- New `src/lib/krismaps/tags.ts`: default rule set, `tokenise(path)`, `tagsForEntry(entry, rules)`, and an index builder returning `Map<tagId, MapEntry[]>` plus untagged. Pure string matching on word boundaries — no AI, no network.
- Rules and per-map overrides persisted in the existing IndexedDB store (`STORE_SETTINGS`/`STORE_STATE` keys `tagRules`, and `tags` added to `MapSettings` per path).
- Tag index computed with `useMemo` over the loaded library; recomputed when rules or overrides change.
- `FolderTree.tsx` gains a collapsible Tags group (icon: `Tags`/`Bookmark`) and wraps the existing tree in a collapsible "Folders" group. Selection paths use new sentinels `__tag__:<id>` and `__untagged__` alongside the existing `__favourites__` / `__last_used__`.
- `index.tsx` extends the `visibleMaps` selector to resolve tag selections; header label shows the tag name.
- `MapPreviewDialog.tsx` gains a tag chip row (add/remove, with auto-derived tags shown faintly and overrides shown solid).
