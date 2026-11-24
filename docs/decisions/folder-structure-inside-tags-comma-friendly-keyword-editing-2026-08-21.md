# Folder structure inside tags + comma-friendly keyword editing

Two changes to the Library sidebar and tag rules dialog.

## 1. Folder tree under each tag

Each tag in the Tags group becomes expandable. Expanding it shows the same folder tree as the Folders section, but pruned to only the folders that actually contain maps carrying that tag, with counts reflecting the tagged maps only.

```text
Tags
  ├ City                    (34)
  │   └ Battlemaps          (34)
  │       ├ Towns           (21)
  │       └ Docks           (13)
  ├ Dungeon                 (58)
  └ Untagged                 (9)
```

- Clicking the tag name itself keeps today's behaviour: every map with that tag, from anywhere in the tree.
- Clicking a folder under a tag shows only that folder's maps (including subfolders) that carry the tag.
- Untagged gets the same treatment, scoped to untagged maps.
- Header label reads e.g. `City / Docks · 13 maps`.
- Empty folders are hidden, so the tree stays short.

## 2. Keyword editing comma fix

In the Tag rules dialog the keyword field currently re-derives its text from the parsed keyword array on every keystroke, so a trailing comma is immediately stripped and you cannot start a new keyword. The field will keep the raw text you type while the input is focused and only re-parse into keywords on blur (and on change for matching), so typing `city, town, ` works normally.

## Technical notes

- `src/lib/krismaps/tags.ts`: add `buildTagFolderTree(entries, root)` — rebuilds a `FolderNode` tree from a filtered entry list by reusing the path segments, pruning folders with zero maps. Selection sentinel extended to `__tag__:<id>` and `__tag__:<id>::<folderPath>`; add `parseTagSelection(path)` returning `{ tagId, folderPath }`. Untagged uses `__untagged__` / `__untagged__::<folderPath>`.
- `src/components/krismaps/FolderTree.tsx`: tags render as collapsible rows using the existing `TreeNode` for their pruned subtree, with an `onSelect` that prefixes the tag sentinel. Keeps current styling and icons.
- `src/routes/index.tsx`: `visibleMaps` and `selectionLabel` resolve the new tag+folder selection; per-tag pruned trees memoised from `tagIndex`.
- `src/components/krismaps/TagRulesDialog.tsx`: hold a local `draft` string per rule id for the keyword input; commit parsed keywords on change (splitting on commas, ignoring a trailing empty segment) and clear the draft on blur so the canonical list is displayed again.
