/**
 * Pure derivations for the Director View's library pane: which maps are shown
 * for the current sidebar selection (a folder, Favourites, Last Used, a tag or
 * a folder inside a tag), the header label, and tag override edits.
 */
import { FAVOURITES_PATH, LAST_USED_PATH, flattenFolders } from "./library";
import {
  UNTAGGED_PATH,
  autoTagsFor,
  buildTagFolderTree,
  buildTagIndex,
  findNode,
  parseTagSelection,
  tagsForEntry,
  type TagIndex,
  type TagRule,
  type TagSelection,
} from "./tags";
import { defaultSettings, type FolderNode, type MapEntry, type MapSettings } from "./types";

/** how many maps the Last Used list keeps */
export const LAST_USED_LIMIT = 40;

export interface LibraryViewInput {
  root: FolderNode | null;
  entries: MapEntry[];
  settings: Record<string, MapSettings>;
  rules: TagRule[];
  /** sidebar selection: a folder path or one of the special sentinels */
  selected: string;
}

export interface LibraryView {
  folders: Array<{ node: FolderNode; depth: number }>;
  favourites: MapEntry[];
  lastUsed: MapEntry[];
  tagIndex: TagIndex;
  tagCounts: Record<string, number>;
  /** per tag id (and UNTAGGED_PATH): the folder tree pruned to that tag's maps */
  tagTrees: Record<string, FolderNode | undefined>;
  tagSelection: TagSelection | null;
  visibleMaps: MapEntry[];
  label: string;
  /** shown when `visibleMaps` is empty */
  emptyMessage: string;
}

export function favouriteMaps(entries: MapEntry[], settings: Record<string, MapSettings>) {
  return entries.filter((entry) => settings[entry.path]?.favourite);
}

export function lastUsedMaps(entries: MapEntry[], settings: Record<string, MapSettings>) {
  return entries
    .filter((entry) => settings[entry.path]?.lastUsed)
    .sort((a, b) => (settings[b.path]?.lastUsed ?? 0) - (settings[a.path]?.lastUsed ?? 0))
    .slice(0, LAST_USED_LIMIT);
}

export function tagFolderTrees(tagIndex: TagIndex, rootName: string) {
  const out: Record<string, FolderNode | undefined> = {};
  for (const [id, maps] of Object.entries(tagIndex.byTag)) {
    out[id] = buildTagFolderTree(maps, rootName);
  }
  out[UNTAGGED_PATH] = buildTagFolderTree(tagIndex.untagged, rootName);
  return out;
}

export function libraryView({
  root,
  entries,
  settings,
  rules,
  selected,
}: LibraryViewInput): LibraryView {
  const folders = root ? flattenFolders(root) : [];
  const favourites = favouriteMaps(entries, settings);
  const lastUsed = lastUsedMaps(entries, settings);
  const tagIndex = buildTagIndex(entries, rules, settings);
  const tagCounts = Object.fromEntries(
    Object.entries(tagIndex.byTag).map(([id, maps]) => [id, maps.length]),
  ) as Record<string, number>;
  const tagTrees = tagFolderTrees(tagIndex, root?.name ?? "Maps");
  const tagSelection = parseTagSelection(selected);

  let visibleMaps: MapEntry[];
  let label: string;
  if (selected === FAVOURITES_PATH) {
    visibleMaps = favourites;
    label = "Favourites";
  } else if (selected === LAST_USED_PATH) {
    visibleMaps = lastUsed;
    label = "Last Used";
  } else if (tagSelection) {
    const key = tagSelection.untagged ? UNTAGGED_PATH : (tagSelection.tagId ?? "");
    const maps = tagSelection.untagged ? tagIndex.untagged : (tagIndex.byTag[key] ?? []);
    if (tagSelection.folderPath) {
      const tree = tagTrees[key];
      const node = tree ? findNode(tree, tagSelection.folderPath) : null;
      visibleMaps = node ? node.maps : [];
    } else {
      visibleMaps = maps;
    }
    const base = tagSelection.untagged
      ? "Untagged"
      : (rules.find((r) => r.id === tagSelection.tagId)?.label ?? "Tag");
    label = tagSelection.folderPath
      ? `${base} / ${tagSelection.folderPath.split("/").pop()}`
      : base;
  } else {
    const node = folders.find((f) => f.node.path === selected)?.node;
    visibleMaps = node ? node.maps : [];
    label = node?.name ?? "Maps";
  }

  const emptyMessage =
    selected === FAVOURITES_PATH
      ? "No favourites yet — open a map and star it."
      : selected === LAST_USED_PATH
        ? "Nothing used yet — display a map and it lands here."
        : tagSelection
          ? "No maps match this tag."
          : "No maps or videos in this folder.";

  return {
    folders,
    favourites,
    lastUsed,
    tagIndex,
    tagCounts,
    tagTrees,
    tagSelection,
    visibleMaps,
    label,
    emptyMessage,
  };
}

/**
 * Settings patch that turns one tag on or off for a map. Overrides are stored
 * relative to the automatic keyword rules: switching on an automatic tag just
 * clears a removal; switching on any other tag records an addition (and the
 * reverse for switching off).
 */
export function toggleTagPatch(
  entry: MapEntry,
  rules: TagRule[],
  settings: MapSettings | undefined,
  tagId: string,
): Pick<MapSettings, "tagsAdd" | "tagsRemove"> {
  const current = settings ?? defaultSettings;
  const auto = autoTagsFor(entry, rules);
  const active = tagsForEntry(entry, rules, current);
  const add = new Set(current.tagsAdd ?? []);
  const remove = new Set(current.tagsRemove ?? []);
  if (active.includes(tagId)) {
    add.delete(tagId);
    if (auto.includes(tagId)) remove.add(tagId);
  } else {
    remove.delete(tagId);
    if (!auto.includes(tagId)) add.add(tagId);
  }
  return { tagsAdd: [...add], tagsRemove: [...remove] };
}
